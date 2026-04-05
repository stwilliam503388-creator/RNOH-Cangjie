# Cangjie TurboModule 互操作方案分析（以 ImageLoader 实现为例）

本文档说明 RNOH 中使用 Cangjie（仓颉）实现 TurboModule 的方案，并重点描述 C++ 如何调用 Cangjie 实现的 ImageLoader。相关代码位于：

- Cangjie 实现：`tester/harmony/react_native_openharmony/src/main/cangjie/RNOHCorePackage/turboModules/ImageLoader`
- C++ TurboModule 桥接层：`tester/harmony/react_native_openharmony/src/main/cpp/RNOHCorePackage/TurboModules/ImageLoaderTurboModule.cpp`
- C++/Cangjie 桥接公用层：`tester/harmony/react_native_openharmony/src/main/cpp/RNOHCangjieBridge`

## 总体链路

```
JS (TurboModule API)
  ↓ JSI
C++ ImageLoaderTurboModule
  ↓ PromiseHolder + ImageLoaderBridge (C 函数指针回调)
Cangjie bridge.cj (C 回调)
  ↓ Cangjie ImageLoaderTurboModule + RemoteImageLoader
Cangjie → C++ PromiseHolder (CJ_PromiseResolve/CJ_PromiseReject)
  ↓ Bridging<CJ_Object> → JSI
JS Promise resolve/reject
```

核心思想：

1. **Cangjie 在初始化时注册 C 回调**，把自身实现暴露给 C++。
2. **C++ TurboModule 调用这些 C 回调**，并把 `PromiseHolder` 指针传入 Cangjie。
3. **Cangjie 在完成后反向调用 C++ 的 `CJ_PromiseResolve/Reject`**，由 C++ 将 `CJ_Object` 转为 JS 值。

## C++ 如何拿到 Cangjie 实现

### 1) Cangjie 在 packageInit 中注册回调

`packageinit.cj` 会在模块初始化时注册回调函数给 C++，使得 C++ 可通过函数指针直接调用 Cangjie 逻辑：

```cangjie
// tester/harmony/react_native_openharmony/src/main/cangjie/RNOHCorePackage/turboModules/ImageLoader/packageinit.cj
public func packageInit(context: RNOHContext): Unit {
    ctx = context
    turboModule = ImageLoaderTurboModule()
    unsafe {
        registerGetSizeCallback(CGetSize)
        registerGetSizeWithHeadersCallback(CGetSizeWithHeaders)
        registerPrefetchImageCallback(CPrefetchImage)
        registerAbortPrefetchCallback(CAbortPrefetch)
        registerQueryCacheCallback(CQueryCache)
        registerGetPrefetchResultCallback(CGetPrefetchResult)
    }
}
```

这里的 `register*Callback` 是 **foreign 声明的 C 接口**（`foreign.cj`），对应 C++ 的 `extern "C"` 注册函数。

### 2) C++ 保存函数指针并暴露 ImageLoaderBridge

在 `ImageLoaderBridge.cpp` 中，C++ 将 Cangjie 注册的回调存入静态函数指针：

```cpp
// tester/harmony/react_native_openharmony/src/main/cpp/RNOHCangjieBridge/TurboModuleBridge/ImageLoaderBridge.cpp
static GetSizeCallback g_getSizeCallback = nullptr;

extern "C" {
  void registerGetSizeCallback(GetSizeCallback callback) {
    g_getSizeCallback = callback;
  }
}

namespace ImageLoaderBridge {
  void getSize(void* promiseHolder, const char* uri) {
    if (g_getSizeCallback) {
      g_getSizeCallback(promiseHolder, uri);
    } else {
      CJ_PromiseReject(promiseHolder, "GetSize callback not registered");
    }
  }
}
```

`ImageLoaderTurboModule.cpp` 在执行时调用 `ImageLoaderBridge::getSize`，就等价于调用了 Cangjie 的 `CGetSize`。

### 3) C++ TurboModule 直接调用 Cangjie 回调

`ImageLoaderTurboModule.cpp` 里面的 TurboModule 方法不再走 ArkTS，而是直接调用桥接层：

```cpp
// tester/harmony/react_native_openharmony/src/main/cpp/RNOHCorePackage/TurboModules/ImageLoaderTurboModule.cpp
const auto callInvoker = dynamic_cast<ImageLoaderTurboModule *>(&turboModule)->jsInvoker_;
auto asyncPromise = std::make_shared<react::AsyncPromise<CJ_Object>>(rt, callInvoker);
auto promiseHolder = new PromiseHolder<CJ_Object>(asyncPromise);
ImageLoaderBridge::getSize((void *)promiseHolder, uri.c_str());
return asyncPromise->get(rt);
```

- `PromiseHolder<CJ_Object>` 持有 `AsyncPromise`，用于异步回调。
- `promiseHolder` 作为 `void*` 传入 Cangjie，Cangjie 后续通过 `CJ_PromiseResolve/Reject` 回传结果。
- 如果 Cangjie 未注册回调（`isCjImageLoaderEnabled()` 为 false），则退回 ArkTS 方案。

## C++ 与 Cangjie 的类型转换

### 1) Promise 与返回值的桥接

Cangjie 侧通过 `Bridge/PromiseHolder.cj` 封装 `CJ_PromiseResolve`，并将值包装成 `CJ_Object`：

```cangjie
// tester/harmony/react_native_openharmony/src/main/cangjie/Bridge/PromiseHolder.cj
@C
struct CJ_Object {
    let data: CPointer<Unit>
    let valueKind: Int32
}

foreign {
    func CJ_PromiseResolve(promise: PromiseHolder, value: CJ_Object): Unit
    func CJ_PromiseReject(promise: PromiseHolder, errMsg: CString): Unit
}

public func PromiseResolve(promise: PromiseHolder, value: String): Unit {
    unsafe {
        let cStringValue = LibC.mallocCString(value).getChars()
        CJ_PromiseResolve(promise, CJ_Object(CPointer<Unit>(cStringValue), CJ_StringKind))
    }
}
```

C++ 侧在 `PromiseHolder.h` 中提供 `Bridging<CJ_Object>`，把 CJ_Object 转换为 JSI 值（包括 `String` / `Number` / `Object` 等）：

```cpp
// tester/harmony/react_native_openharmony/src/main/cpp/RNOHCangjieBridge/PromiseHolder.h
struct CJ_Object {
  void *data;
  int32_t valueKind;
};

template <>
struct Bridging<CJ_Object> {
  static jsi::Value toJs(jsi::Runtime &runtime, const CJ_Object &obj) {
    switch (obj.valueKind) {
      case CJ_UndefinedKind:
        return jsi::Value::undefined();
      case CJ_NullKind:
        return jsi::Value::null();
      case CJ_BooleanKind: {
        auto value = jsi::Value(*(bool *)(obj.data));
        free(obj.data);
        return value;
      }
      case CJ_NumberKind: {
        auto value = jsi::Value(*(double *)(obj.data));
        free(obj.data);
        return value;
      }
      case CJ_StringKind: {
        auto value = jsi::String::createFromUtf8(runtime, std::string((char *)(obj.data)));
        free(obj.data);
        return value;
      }
      case CJ_ObjectKind: {
        auto data = (uint8_t*)obj.data;
        auto value = jsi::Value::createFromJsonUtf8(runtime, data, strlen((char*)data));
        free(obj.data);
        return value;
      }
      default:
        return jsi::Value::undefined();
    }
  }
};
```

因此，**Cangjie 只需构造 CJ_Object**，就能由 C++ 桥接成 JS 能识别的 `jsi::Value`，最终触发 Promise resolve/reject。

### 2) 参数传递与 JSON 转换

C++ 侧负责将复杂参数转成 JSON 字符串传入 Cangjie，例如 `getSizeWithHeaders` 与 `queryCache`：

```cpp
// C++ 将 headers / uris 组装为 JSON 字符串
std::string headersJson = "{}"; // 默认空对象（未传入 headers 时使用）
if (count > 1 && args[1].isObject()) {
  auto jsonObj = rt.global().getPropertyAsObject(rt, "JSON");
  auto stringify = jsonObj.getPropertyAsFunction(rt, "stringify");
  headersJson = stringify.call(rt, args[1]).asString(rt).utf8(rt);
}

std::string urisStr = "[";
for (size_t i = 0; i < uris.size(); i++) {
  if (i > 0) urisStr += ",";
  urisStr += '\"' + uris[i] + '\"';
}
urisStr += "]";
ImageLoaderBridge::queryCache((void *)promiseHolder, urisStr.c_str());
```

Cangjie 侧通过 `HashMap.fromJson(...)` 或 `JsonReader` 解析为本地类型：

```cangjie
let headerMap = HashMap<String, String>.fromJson(JsonReader(ByteBuffer(unsafe { cjHeaders.rawData() })))
let result = module.getSizeWithHeaders(cjUri, headerMap)
```

## Cangjie → C++ 的回调与跨库调用

### 1) Cangjie 回调执行

Cangjie 层的 `bridge.cj` 将 `CGetSize` 等函数声明为 `@C` 回调，C++ 调用时会进入这里：

```cangjie
@C
func CGetSize(promise: PromiseHolder, uri: CString): Unit {
    let cjUri = uri.toString()
    spawn {
        let result = module.getSize(cjUri)
        let resultArray = JsonArray()
        resultArray.add(JsonInt(Int64(result[0])))
        resultArray.add(JsonInt(Int64(result[1])))
        PromiseResolve(promise, resultArray)
    }
}
```

### 2) Cangjie 调用 C++ 更新 ImageSourceMap

**注意：这部分内容是和 ImageLoader 业务相关的，不属于仓颉 TurboModule 通用方案**

在下载完成后，Cangjie 调用 `CJ_UpdateImageSourceMap`（C++ 提供），C++ 会通过 `dlopen` 从 `librnoh_app.so` 解析 `onImageSourceMapUpdate` 并执行：

```cangjie
foreign func CJ_UpdateImageSourceMap(rnInstanceId: UInt64, remoteUri: CString, fileUri: CString): Unit

static func OnImageSourceMapUpdate(rnInstanceId: UInt64, remoteUri: String, fileUri: String) {
  unsafe {
    let remoteUriC = LibC.mallocCString(remoteUri)
    let fileUriC = LibC.mallocCString(fileUri)
    CJ_UpdateImageSourceMap(rnInstanceId, remoteUriC, fileUriC)
  }
}
```

```cpp
// C++ 通过 dlsym 获取 onImageSourceMapUpdate，并在 CJ_UpdateImageSourceMap 中调用
static OnImageSourceMapUpdateFunc g_onImageSourceMapUpdateFunc = nullptr;

// Cangjie 侧使用 mallocCString 分配内存，C++ 在此处释放以避免泄漏（因此为 char*）。
// 调用后 Cangjie 不应缓存或再访问这些指针。
void CJ_UpdateImageSourceMap(unsigned long rnInstanceId, char* remoteUri, char* fileUri) {
  if (!loadOnImageSourceMapUpdateFunction()) {
    free(remoteUri);
    free(fileUri);
    return;
  }
  g_onImageSourceMapUpdateFunc(rnInstanceId, remoteUri, fileUri);
  free(remoteUri);
  free(fileUri);
}
```

## 小结

- **C++ 调用 Cangjie**：通过 `register*Callback` 注册函数指针 + `ImageLoaderBridge` 转发。
- **Promise/返回值桥接**：Cangjie 封装 `CJ_Object` 调用 `CJ_PromiseResolve`，C++ `Bridging<CJ_Object>` 转成 `jsi::Value`。
- **类型转换**：复杂结构体通过 JSON 字符串在 C++ 与 Cangjie 间转换。
- **跨库回调**：Cangjie 调用 C++ 的 `CJ_UpdateImageSourceMap`，C++ 再动态链接到 `librnoh_app.so` 的 `onImageSourceMapUpdate`。

该方案避免了 ArkTS 的性能瓶颈，同时保留了 RN TurboModule 的 Promise API 语义。
