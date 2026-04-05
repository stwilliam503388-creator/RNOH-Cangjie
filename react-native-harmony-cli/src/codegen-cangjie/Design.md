# Cangjie TurboModule CodeGen 设计说明

## 目标与输入

Cangjie TurboModule CodeGen 负责把 React Native Codegen 生成的 `SpecSchema` 转换为一组可直接编译的 C++ 与仓颉（Cangjie）模板代码，以便在 RNOH 中以 **C++ 调用 Cangjie TurboModule** 的方式实现 TurboModule。入口是 `CangjieTurboModuleCodeGenerator`，由 CLI 侧传入：

- **C++ 输出目录**（TurboModule 包装层）
- **C++ Bridge 输出目录**（回调注册与转发层）
- **Cangjie 输出目录**（模块骨架与桥接层）
- **Cangjie 包名前缀**（例如 `reactnative_ohcj.RNOHCorePackage.turboModules`）
- **代码生成提示行**（用于头部注释）

输入的 `SpecSchema` 来自 RN Codegen 的 `UberSchema`，其中包含 `aliasMap`、`enumMap` 与模块方法（`schema.spec.properties`）。

## 生成流程概览

1. **解析类型**：`TypeAnnotationToCangjie` 将 RN Codegen 的类型注解映射为 Cangjie 类型字符串，用于方法签名与返回类型。
2. **生成 C++ TurboModule 包装层**：负责从 JSI 读取参数、构造 `PromiseHolder` 并调用 Bridge 层。
3. **生成 C++ Bridge 层**：维护回调指针、注册函数与 C++ 包装调用入口（与 Cangjie `@C` 函数对接）。
4. **生成 Cangjie 模块骨架**：输出 `TurboModule` 类骨架、方法签名和类型别名/枚举占位。
5. **生成 Cangjie bridge/foreign/packageinit**：
   - `bridge.cj`：`@C` 回调入口，调用 Cangjie 模块实现。
   - `foreign.cj`：声明 C++ 提供的注册函数。
   - `packageinit.cj`：初始化模块并注册回调。

## 产物文件与职责

### C++ TurboModule 层
- **`<Module>TurboModule.h`**
  - 继承 `rnoh::TurboModule`，声明静态方法入口。
- **`<Module>TurboModule.cpp`**
  - `methodMap_` 绑定 JS 方法名与 C++ 静态函数。
  - 解析 JSI 参数：字符串/对象/数组会转为 `std::string`。
  - Promise 方法会创建 `AsyncPromise<CJ_Object>` + `PromiseHolder`，并调用 Bridge 层。

### C++ Bridge 层
- **`<Module>Bridge.h`**
  - 定义回调类型 `typedef`。
  - 声明 `register*Callback` 注册函数与 Bridge 调用入口。
- **`<Module>Bridge.cpp`**
  - 保存函数指针（`static` 回调变量）。
  - 提供 `isEnabled` 供 TurboModule 判断是否已注册 Cangjie 实现。
  - Bridge 方法转发到 Cangjie 回调，若未注册则对 Promise 拒绝。

### Cangjie 侧
- **`<Module>TurboModule.cj`**
  - TurboModule 类骨架，包含方法签名与默认 `throw`。
  - `aliasMap/enumMap` 转换为 Cangjie 类型别名。
- **`bridge.cj`**
  - `@C` 回调入口，负责调用 Cangjie TurboModule 实现。
  - Promise 方法在 `spawn` 中执行，并通过 `PromiseResolve/Reject` 返回。
- **`foreign.cj`**
  - 声明 `register*Callback` 的 C 接口签名。
- **`packageinit.cj`**
  - `packageInit` 初始化模块并注册所有回调。

## 互操作与类型映射

### 参数传递

- **JSI → C++**：字符串与对象/数组转为 `std::string`，数字转为 `int32_t`，布尔转为 `bool`。
- **C++ → Cangjie (FFI)**：
  - `std::string` 通过 `c_str()` 传入 `CString`。
  - 对象/数组使用 `JSON.stringify` 序列化为字符串。

### 返回值与 Promise

- 异步方法：C++ 创建 `PromiseHolder<CJ_Object>`，Cangjie `PromiseResolve/Reject` 传回 `CJ_Object`。
- `PromiseHolder` 的 `CJ_Object` 在 C++ 侧通过 `Bridging<CJ_Object>` 转为 `jsi::Value`。

## 代码生成的关键步骤

`CangjieTurboModuleCodeGenerator.generate`：

1. 构建模板实例（C++/Cangjie）。
2. 遍历 `aliasMap`、`enumMap` 输出类型声明。
3. 遍历模块方法：
   - 根据类型注解决定 C++ 参数声明和 FFI 参数类型。
   - 组装 `Promise`/同步调用路径。
   - 生成桥接层回调注册声明与实现。
4. 输出到指定目录结构。

## 与 ImageLoader 方案的对应关系

生成的模板与 `CangjieTurboModuleFFI.md` 描述的 ImageLoader 方案保持一致：

```
JS (TurboModule) → C++ TurboModule → C++ Bridge → Cangjie @C → Cangjie Module
```

唯一差异在于模块具体业务逻辑与 JSON 解析方式由开发者在 Cangjie 实现中补充。
