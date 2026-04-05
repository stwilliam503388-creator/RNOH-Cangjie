# Cangjie TurboModule CodeGen 评审与改进建议

## 已修复

1. **C++ 调用参数类型不匹配**
   - 问题：CodeGen 生成的 C++ 代码中，`std::string` 直接传入 `const char*` 形参（缺少 `.c_str()`），会导致编译错误或隐式转换失败。
   - 修复：在生成的调用参数中统一输出 `xxx.c_str()`，保证 `CString` 的互操作正确。

2. **数组默认 JSON 占位符错误**
   - 问题：对象/数组在缺省时统一使用 `{}`，数组参数在 Cangjie 侧解析时会产生类型不匹配。
   - 修复：数组参数默认值改为 `[]`，对象仍为 `{}`。

## 仍需关注的互操作风险

1. **同步返回值未支持**
   - 现状：非 Promise 方法在 C++ 侧始终返回 `undefined`，桥接层未传递 `CJ_Object`。
   - 影响：同步返回值（如 `String` / `Number`）无法正确返回给 JS。
   - 建议：
     - 为非 Promise、非 `void` 方法生成 `CJ_Object` 返回通道；
     - 在 C++ TurboModule 中使用 `Bridging<CJ_Object>` 转换为 `jsi::Value`。

2. **数值类型精度问题**
   - 现状：JS 数值全部被转换为 `int32_t/Int32`，但 JS 的 Number 是双精度浮点。
   - 影响：小数或大整数会被截断，导致业务错误。
   - 建议：引入 `double/Float64` 类型映射；必要时为 Cangjie Bridge 增加 `PromiseResolve(Float64)` 等支持。

3. **可空/可选参数缺少安全校验**
   - 现状：字符串/数值/布尔参数直接读取 `args[index]`，若 JS 未传参或传 `null`，可能触发异常。
   - 建议：根据 `NullableTypeAnnotation` 生成 `count`/`isX` 校验，并在 Cangjie 侧使用 `?Type` 或显式默认值。

4. **对象/数组的 JSON 解析未自动化**
   - 现状：C++ 侧将对象/数组序列化为 JSON 字符串，Cangjie 侧仅 `toString()` 后直接传给业务方法。
   - 影响：若业务方法签名为 `Array<T>` 或 `HashMap<K, V>`，需要手动解析；容易与签名不一致。
   - 建议：
     - 为常见类型生成 JSON → Cangjie 的解析代码（如 `JsonReader`/`HashMap.fromJson`）。
     - 或统一将对象/数组映射为 `String` 并在模板中注明需要业务解析。

5. **注册状态粒度不足**
   - 现状：Bridge 只要注册任意回调就视为模块可用（`g_isRegistered`）。
   - 建议：改为按方法统计注册完成度，或在生成的 TurboModule 侧增加缺失回调的降级路径。

## 优化方向（非强制）

- 增加生成结果的单元测试覆盖（同步返回、数组参数、对象参数、可空参数）。
- 统一输出 JSON 解析帮助函数，减少模板重复代码。
- 扩展 `TypeAnnotationToCangjie` 与 FFI 类型映射，支持 `Double`/`Float`/`Int64` 等。
