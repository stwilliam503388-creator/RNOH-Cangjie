# Cangjie CodeGen 详细技术说明

## 一、整体架构与实现原理

### 1.1 工具链定位

`cangjie-codegen` 是 `@rnoh/react-native-harmony-cli` 包内的一个代码生成器，位于 `src/codegen-cangjie/`。它的职责是：

> 把 React Native 官方 Codegen 解析得到的 **SpecSchema**（模块接口描述），自动生成可直接编译的 **C++ 包装层** + **Cangjie（仓颉）桥接层**，让 JS 调用能通过 JSI → C++ → Cangjie 的链路完成。

### 1.2 完整调用链路

```
JS (TurboModule API)
   ↓  JSI
C++ <ModuleName>TurboModule.cpp      ← 读取 JSI 参数，构造 PromiseHolder
   ↓  C++ Bridge (函数指针)
C++ <ModuleName>Bridge.cpp           ← 保存/转发 Cangjie 注册的函数指针
   ↓  CFunc<...> 回调
Cangjie bridge.cj (@C 函数)          ← 接收参数，在 spawn 中调用 Cangjie 实现
   ↓
Cangjie <ModuleName>TurboModule.cj   ← 业务方填充的实现类
   ↓
PromiseResolve / PromiseReject → C++ Bridging<CJ_Object> → jsi::Value → JS
```

### 1.3 生成的 8 个文件及职责

| 文件 | 层 | 职责 |
|------|---|------|
| `<Module>TurboModule.h` | C++ | 继承 `rnoh::TurboModule`，声明静态方法入口 |
| `<Module>TurboModule.cpp` | C++ | `methodMap_` 绑定方法名；读取 JSI 参数；调用 Bridge |
| `<Module>Bridge.h` | C++ Bridge | `typedef` 回调类型；声明 `register*Callback` 和方法入口 |
| `<Module>Bridge.cpp` | C++ Bridge | 保存函数指针；提供 `isEnabled` 判断；转发到 Cangjie |
| `<Module>TurboModule.cj` | Cangjie | 模块骨架类，含类型别名/枚举占位，方法默认 `throw` |
| `bridge.cj` | Cangjie | `@C` 回调入口，异步方法用 `spawn` 执行，调用 Resolve/Reject |
| `foreign.cj` | Cangjie | 声明 `register*Callback` 的 C 外部函数签名 |
| `packageinit.cj` | Cangjie | `packageInit` 初始化模块，注册所有回调 |

---

## 二、核心代码结构

```
src/codegen-cangjie/
├── core/
│   └── TypeAnnotationToCangjie.ts   # RN 类型 → Cangjie 类型字符串映射
├── generators/
│   └── CangjieTurboModuleCodeGenerator.ts  # 主生成器（最核心）
└── templates/
    ├── CangjieTurboModuleTemplate.ts   # Cangjie 模块骨架模板
    ├── CangjieBridgeTemplate.ts        # bridge.cj 模板
    ├── CangjieForeignTemplate.ts       # foreign.cj 模板
    ├── CangjiePackageInitTemplate.ts   # packageinit.cj 模板
    ├── CppTurboModuleHTemplate.ts      # C++ .h 模板
    ├── CppTurboModuleCppTemplate.ts    # C++ .cpp 模板
    ├── CppBridgeHTemplate.ts           # C++ Bridge .h 模板
    └── CppBridgeCppTemplate.ts         # C++ Bridge .cpp 模板
```

### 2.1 类型映射 `TypeAnnotationToCangjie`

是连接 RN 类型系统与 Cangjie 类型系统的核心翻译器：

| RN Codegen 类型 | Cangjie 类型 |
|---|---|
| `BooleanTypeAnnotation` | `Bool` |
| `StringTypeAnnotation` / `StringEnumTypeAnnotation` | `String` |
| `Int32TypeAnnotation` / `Int32EnumTypeAnnotation` | `Int32` |
| `DoubleTypeAnnotation` / `FloatTypeAnnotation` / `NumberTypeAnnotation` | `Float64` |
| `NullableTypeAnnotation<T>` | `?T`（如 `?String`） |
| `ArrayTypeAnnotation<T>`（T 为基础类型） | `Array<T>`（如 `Array<String>`） |
| `ArrayTypeAnnotation<Object>` / 嵌套数组 | `JsonValue`（降级） |
| `ObjectTypeAnnotation` / `GenericObjectTypeAnnotation` | `JsonValue` |
| `VoidTypeAnnotation` | `Unit` |
| `PromiseTypeAnnotation<T>` | 取内部 `T`；无 elementType 则为 `Unit` |
| `EnumDeclaration` | 枚举名称本身（生成 `type Name = String/Int32`） |
| `ReservedTypeAnnotation { name: 'RootTag' }` | `Int32` |
| 其他未知类型 | `JsonValue`（安全降级） |

`convert()` 用于参数类型，`convertReturnType()` 专门处理返回类型（自动解包 `PromiseTypeAnnotation`）。

### 2.2 主生成器 `CangjieTurboModuleCodeGenerator.generate(schema)`

生成流程：

1. **构建 8 个模板实例**
2. **处理 aliasMap**：把 RN 类型别名转为 Cangjie `type Alias = T`
3. **处理 enumMap**：把 RN 枚举转为 `type EnumName = String/Int32`
4. **遍历每个方法**（`schema.spec.properties`）：
   - 用 `getParamKind()` 分类每个参数（string/boolean/number/int32/array/object/unknown）
   - 用 `buildCppArgDeclaration()` 生成 C++ 参数解析代码（含可选守卫 `if (count > N && args[N].isX())`）
   - 用 `buildCangjieArgConversion()` 生成 Cangjie FFI 参数转换（CString → String/JsonValue/Array）
   - 用 `getReturnTypeInfo()` 分析返回类型分支
   - 用 `buildAsyncResolveLines()` 或 `buildSyncReturnLines()` 生成结果传递代码
5. **渲染所有模板**，返回 `Map<AbsolutePath, string>`

### 2.3 参数传递的两套机制

**FFI 参数类型（`getCangjieFfiType`）**：

| 参数种类 | C++ 端类型 | Cangjie FFI 类型 |
|---|---|---|
| string / object / array | `const char*` | `CString` |
| boolean | `bool` | `Bool` |
| int32 | `int32_t` | `Int32` |
| number/float/double | `double` | `Float64` |

**Cangjie 侧转换（`buildCangjieArgConversion`）**：

- `Bool/Int32/Float64` 直接使用，无需转换
- `CString` → `.toString()` 拿到 `String`
- 对象/未知类型 → `JsonValue.fromStr(stringValue)`
- 基础类型一维数组 → 先 `fromStr()` 解析为 `JsonValue`，再遍历填入 `Array<T>`

### 2.4 Mustache 模板渲染

每个 Template 类持有一个 `const TEMPLATE` 字符串（Mustache 语法），通过 `build()` 调用 `mustache.render()` 渲染。模板的 `{{#section}}...{{/section}}` 支持条件和循环，`{{{...}}}` 表示不转义 HTML 特殊字符的原始内容插值。

---

## 三、安装与部署

### 3.1 本地开发安装

```bash
cd react-native-harmony-cli
npm install        # 安装所有依赖（包括 @react-native/codegen、mustache、ts-jest 等）
npm run build      # TypeScript 编译到 dist/（必须先 build 才能运行 sample 和部分测试）
```

主要依赖：

| 包 | 用途 |
|---|---|
| `@react-native/codegen 0.74.0` | 解析 TypeScript Spec 文件，生成 SpecSchema |
| `mustache` | Mustache 模板渲染（生成代码字符串） |
| `case` | 命名格式转换（camelCase / PascalCase / CONSTANT_CASE） |
| `ts-jest` | TypeScript 测试运行器 |
| `tmp` | 测试中创建临时目录 |

### 3.2 手动运行示例生成器（Sample）

在完成 `npm run build` 之后：

```bash
cd react-native-harmony-cli/src/codegen-cangjie/sample
node ./run-codegen.js
# 输出：Generated 8 files into .../sample/generated
```

生成结果在 `sample/generated/` 目录下，包含完整的 8 个文件，可直接对照 `NativeSampleSpec.ts` 检查所有类型的生成效果。

示例 Spec（`specs/NativeSampleSpec.ts`）覆盖了所有场景：基础类型同步/异步方法、数组参数与返回值、Object/JsonValue、默认参数、枚举等。

---

## 四、测试用例的组织与编写方式

### 4.1 测试框架

- **Jest + ts-jest**：`jest.config.js` 中配置 `preset: 'ts-jest'`，直接对 `.ts` 测试文件进行编译和执行，无需手动 `tsc`。

### 4.2 测试文件分层结构

```
tests/
├── codegen-cangjie-type-converter.test.ts   # 单元测试：TypeAnnotationToCangjie 类型映射
├── codegen-cangjie-types.test.ts            # 集成测试：常见/边界类型签名
├── codegen-cangjie-advanced.test.ts         # 集成测试：枚举/可空返回/同步/Promise<void>
├── codegen-cangjie-array-bridge.test.ts     # 集成测试：Array 参数的 JSON 解析路径
├── codegen-cangjie-object-bridge.test.ts    # 集成测试：Object 参数的 JsonValue 路径
├── codegen-cangjie-jsonvalue.test.ts        # 集成测试：自定义别名/嵌套数组的 JsonValue 降级
├── codegen-cangjie-return-types.test.ts     # 集成测试：布尔/数值数组返回、可空数组返回
└── codegen-cangjie.test.ts                  # 冒烟测试：端到端生成文件完整性
```

### 4.3 单元测试：`codegen-cangjie-type-converter.test.ts`

**不需要写 Spec 文件，直接测类型映射函数。** 写法极简：

```typescript
import { TypeAnnotationToCangjie, CjTypeAnnotation } from '../src/codegen-cangjie/core';

describe('TypeAnnotationToCangjie unit tests', () => {
  const converter = new TypeAnnotationToCangjie();

  it('maps BooleanTypeAnnotation to Bool', () => {
    expect(converter.convert({ type: 'BooleanTypeAnnotation' } as CjTypeAnnotation)).toBe('Bool');
  });

  it('maps NullableTypeAnnotation<String> to ?String', () => {
    expect(converter.convert({
      type: 'NullableTypeAnnotation',
      typeAnnotation: { type: 'StringTypeAnnotation' },
    } as CjTypeAnnotation)).toBe('?String');
  });

  it('resolves TypeAliasTypeAnnotation through aliasMap', () => {
    const aliasMap = { MyNumber: { type: 'NumberTypeAnnotation' } as CjTypeAnnotation };
    const converterWithMap = new TypeAnnotationToCangjie(aliasMap);
    expect(converterWithMap.convert({ type: 'TypeAliasTypeAnnotation', name: 'MyNumber' } as CjTypeAnnotation)).toBe('Float64');
  });
});
```

> **注意**：部分类型（如 `StringEnumTypeAnnotation`、`EnumDeclaration`）不在 TypeScript 的静态类型声明中，需要写 `as unknown as CjTypeAnnotation` 来绕过类型检查。

### 4.4 集成测试：验证完整代码生成

集成测试的通用模式：

```typescript
import fs from 'fs';
import path from 'path';
import tmp from 'tmp';
import { AbsolutePath } from '../src/core';
import { UberSchema } from '../src/codegen';
import { CangjieTurboModuleCodeGenerator } from '../src/codegen-cangjie';

describe('场景名称', () => {
  let tmpDir: tmp.DirResult | null = null;

  beforeEach(() => { tmpDir = tmp.dirSync({ unsafeCleanup: true }); });
  afterEach(() => { tmpDir?.removeCallback(); tmpDir = null; });

  it('验证某个具体场景', () => {
    // 第 1 步：在临时目录创建 TypeScript Spec 文件
    const tempDirPath = tmpDir!.name;
    const specPath = path.join(tempDirPath, 'NativeXxxSpec.ts');
    fs.writeFileSync(specPath, `
      import type { TurboModule } from 'react-native/Libraries/TurboModule/RCTExport';
      import { TurboModuleRegistry } from 'react-native';
      export interface Spec extends TurboModule {
        myMethod(param: string): Promise<boolean>;
      }
      export default TurboModuleRegistry.get<Spec>('Sample')!;
    `);

    // 第 2 步：解析 Spec → SpecSchema
    const uberSchema = UberSchema.fromSpecFilePaths([new AbsolutePath(specPath)]);
    const [schema] = uberSchema.findAllSpecSchemasByType('NativeModule');

    // 第 3 步：运行代码生成器
    const outputRoot = new AbsolutePath(tempDirPath);
    const generator = new CangjieTurboModuleCodeGenerator(
      outputRoot.copyWithNewSegment('cpp'),
      outputRoot.copyWithNewSegment('cpp-bridge'),
      outputRoot.copyWithNewSegment('cangjie'),
      'reactnative_ohcj.TestPackage.turboModules',
      ['Generated by test']
    );
    const files = generator.generate(schema);

    // 第 4 步：从 Map<AbsolutePath, string> 中取出目标文件内容
    const getContent = (key: string) => {
      return [...files.entries()].find(([k]) => k.getValue().endsWith(key))?.[1] ?? '';
    };

    const cangjieContent = getContent('SampleTurboModule.cj');
    const bridgeContent  = getContent('bridge.cj');
    const cppContent     = getContent('SampleTurboModule.cpp');

    // 第 5 步：断言关键字符串存在
    expect(cangjieContent).toContain('myMethod(param: String): Bool');
    expect(bridgeContent).toContain('PromiseResolve(promise, result)');
    expect(cppContent).toContain('auto asyncPromise');
  });
});
```

集成测试关键说明：

1. **Spec 内容内嵌在测试中**，无需独立文件。
2. `UberSchema.fromSpecFilePaths` 调用 `@react-native/codegen` 的真实解析器，非 mock。
3. `generator.generate()` 返回 `Map<AbsolutePath, string>`，键是路径对象，值是文件内容字符串。
4. 断言全部使用 `toContain(字符串片段)`，验证生成代码中的关键代码行。
5. 集成测试依赖 `npm run build` 先完成（因 `UberSchema` 从 `dist/` 引入）；`TypeAnnotationToCangjie` 单元测试可直接 `import src/` 无需 build。

---

## 五、运行测试的方法

### 5.1 运行全部测试

```bash
cd react-native-harmony-cli
npm test
# 等价于：npm run build && jest
```

`npm run build` 先把 TypeScript 编译到 `dist/`，然后 `jest` 自动发现所有 `*.test.ts` 文件并运行。

### 5.2 只跑 codegen-cangjie 相关测试

```bash
node_modules/.bin/jest tests/codegen-cangjie --no-coverage
# 匹配所有 tests/codegen-cangjie*.test.ts
```

### 5.3 只跑单个测试文件

```bash
node_modules/.bin/jest tests/codegen-cangjie-type-converter.test.ts --no-coverage
```

### 5.4 使用 package.json 内置脚本（仅 codegen 相关测试）

```bash
npm run test:codegen
# 等价于：jest ./src/codegen/.* && npm run build && jest tests/codegen.*
```

---

## 六、新增测试用例的最佳实践

### 6.1 单元测试（新增类型映射场景）

在 `codegen-cangjie-type-converter.test.ts` 末尾追加 `it(...)` 即可，无需 build：

- 使用 `as unknown as CjTypeAnnotation` 代替 `as any` 处理非标准类型
- aliasMap 场景需要 `new TypeAnnotationToCangjie(aliasMap)` 创建新实例

### 6.2 集成测试（新增生成场景）

按 4.4 节模式，在合适的测试文件（或新建文件）中写 Spec 字符串 + 断言。选择测试文件的规则：

| 场景 | 应放入的文件 |
|---|---|
| 只测类型映射字符串 | `codegen-cangjie-type-converter.test.ts`（单元层） |
| Array 参数桥接逻辑 | `codegen-cangjie-array-bridge.test.ts` |
| Object 参数 JsonValue 路径 | `codegen-cangjie-object-bridge.test.ts` |
| 返回值（布尔数组、数值数组、可空数组） | `codegen-cangjie-return-types.test.ts` |
| 枚举/可空/Promise\<void\>/同步返回等边界 | `codegen-cangjie-advanced.test.ts` |
| 完全新的场景分组 | 新建 `codegen-cangjie-<场景>.test.ts` |

---

## 七、与现有设计文档的关系

| 文档 | 内容侧重 |
|---|---|
| [`Design.md`](./Design.md) | CodeGen 整体设计说明（目标、生成流程、产物文件职责、类型映射规则） |
| [`FFI.md`](./FFI.md) | 以 ImageLoader 为例，深入说明 C++ ↔ Cangjie FFI 互操作的运行时机制 |
| [`Review.md`](./Review.md) | 代码评审记录：已修复问题与仍需关注的互操作风险 |
| `Overview.md`（本文档） | 面向新成员的全局入门指南：架构、安装、测试编写与运行一站式说明 |
