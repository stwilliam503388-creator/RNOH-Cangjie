/**
 * Copyright (c) 2025 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE-MIT file in the root directory of this source tree.
 */

import mustache from 'mustache';

/**
 * C++ <-> Cangjie 桥接头文件模板。
 * 定义回调类型、注册函数与桥接 API。
 */

const TEMPLATE = `
#ifndef {{headerGuard}}
#define {{headerGuard}}

#include <cstdint>

#include "RNOHCangjieBridge/PromiseHolder.h"

{{#callbacks}}
typedef {{callbackReturnType}} (*{{callbackName}})({{{callbackParams}}});
{{/callbacks}}

extern "C" {
  {{#registers}}
  void {{registerName}}({{callbackTypeName}} callback);
  {{/registers}}
}

namespace {{bridgeNamespace}} {
  bool {{isEnabledName}}();
  {{#methods}}
  {{returnType}} {{name}}({{{params}}});
  {{/methods}}
}

#endif // {{headerGuard}}
`;

type Callback = {
  callbackReturnType: string;
  callbackName: string;
  callbackParams: string;
};

type Register = {
  registerName: string;
  callbackTypeName: string;
};

type Method = {
  returnType: string;
  name: string;
  params: string;
};

export class CppBridgeHTemplate {
  private callbacks: Callback[] = [];
  private registers: Register[] = [];
  private methods: Method[] = [];

  constructor(
    private headerGuard: string,
    private bridgeNamespace: string,
    private isEnabledName: string
  ) {}

  /**
   * 添加回调类型声明。
   */
  addCallback(callback: Callback) {
    this.callbacks.push(callback);
  }

  /**
   * 添加回调注册函数声明。
   */
  addRegister(register: Register) {
    this.registers.push(register);
  }

  /**
   * 添加桥接函数声明。
   */
  addMethod(method: Method) {
    this.methods.push(method);
  }

  /**
   * 渲染模板并输出头文件内容。
   */
  build(): string {
    return mustache.render(TEMPLATE.trimStart(), {
      headerGuard: this.headerGuard,
      bridgeNamespace: this.bridgeNamespace,
      isEnabledName: this.isEnabledName,
      callbacks: this.callbacks,
      registers: this.registers,
      methods: this.methods,
    });
  }
}
