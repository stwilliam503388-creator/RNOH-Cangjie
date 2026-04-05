/**
 * Copyright (c) 2025 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE-MIT file in the root directory of this source tree.
 */

import mustache from 'mustache';

/**
 * C++ 桥接实现模板。
 * 负责保存回调指针并提供 C++ 包装层调用入口。
 */

const TEMPLATE = `
/*
{{#codegenNoticeLines}}
 * {{{line}}}
{{/codegenNoticeLines}}
 */

#include "{{headerName}}"

static uint32_t g_registeredCount = 0;
static constexpr uint32_t kExpectedCallbacks = {{callbackCount}};

{{#callbacks}}
static {{callbackTypeName}} g_{{callbackName}} = nullptr;
static bool g_{{registerFlagName}} = false;
{{/callbacks}}

extern "C" {
  {{#registers}}
  void {{registerName}}({{callbackTypeName}} callback) {
    g_{{callbackName}} = callback;
    if (!g_{{registerFlagName}}) {
      g_{{registerFlagName}} = true;
      g_registeredCount++;
    }
  }
  {{/registers}}
}

namespace {{bridgeNamespace}} {
  bool {{isEnabledName}}() {
    return kExpectedCallbacks == 0 ? true : g_registeredCount == kExpectedCallbacks;
  }

  {{#methods}}
  {{returnType}} {{name}}({{{params}}}) {
    if (g_{{callbackName}}) {
      {{#hasReturn}}
      return g_{{callbackName}}({{{callArgs}}});
      {{/hasReturn}}
      {{^hasReturn}}
      g_{{callbackName}}({{{callArgs}}});
      {{/hasReturn}}
    {{#isAsync}}
    } else if (promiseHolder) {
      CJ_PromiseReject(
          promiseHolder,
          "{{bridgeNamespace}}::{{name}} callback not registered");
    }
    {{/isAsync}}
    {{^isAsync}}
    }
    {{/isAsync}}
    {{#hasReturn}}
    return CJ_Object{nullptr, CJ_UndefinedKind};
    {{/hasReturn}}
  }

  {{/methods}}
}
`;

type Callback = {
  callbackTypeName: string;
  callbackName: string;
  registerFlagName: string;
};

type Register = {
  registerName: string;
  callbackTypeName: string;
  callbackName: string;
  registerFlagName: string;
};

type Method = {
  returnType: string;
  name: string;
  params: string;
  callArgs: string;
  callbackName: string;
  isAsync: boolean;
  hasReturn: boolean;
};

export class CppBridgeCppTemplate {
  private callbacks: Callback[] = [];
  private registers: Register[] = [];
  private methods: Method[] = [];

  constructor(
    private headerName: string,
    private bridgeNamespace: string,
    private isEnabledName: string,
    private codegenNoticeLines: string[]
  ) {}

  /**
   * 添加回调指针定义。
   */
  addCallback(callback: Callback) {
    this.callbacks.push(callback);
  }

  /**
   * 添加回调注册函数实现描述。
   */
  addRegister(register: Register) {
    this.registers.push(register);
  }

  /**
   * 添加桥接函数实现描述。
   */
  addMethod(method: Method) {
    this.methods.push(method);
  }

  /**
   * 渲染模板并输出桥接实现源码。
   */
  build(): string {
    return mustache.render(TEMPLATE.trimStart(), {
      headerName: this.headerName,
      bridgeNamespace: this.bridgeNamespace,
      isEnabledName: this.isEnabledName,
      codegenNoticeLines: this.codegenNoticeLines.map((line) => ({ line })),
      callbackCount: this.callbacks.length,
      callbacks: this.callbacks,
      registers: this.registers,
      methods: this.methods,
    });
  }
}
