/**
 * Copyright (c) 2025 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE-MIT file in the root directory of this source tree.
 */

import mustache from 'mustache';

/**
 * Cangjie foreign 声明模板。
 * 声明 C++ 侧注册回调的函数签名。
 */

const TEMPLATE = `
/*
{{#codegenNoticeLines}}
 * {{{line}}}
{{/codegenNoticeLines}}
 */

package {{packageName}}

import reactnative_ohcj.Bridge.CJ_Object

type PromiseHolder = CPointer<Unit>

foreign {
  {{#methods}}
  func {{registerName}}(callback: CFunc<({{{callbackSignature}}}) -> {{callbackReturnType}}>): Unit
  {{/methods}}
}
`;

type Method = {
  registerName: string;
  callbackSignature: string;
  callbackReturnType: string;
};

export class CangjieForeignTemplate {
  private methods: Method[] = [];

  constructor(private packageName: string, private codegenNoticeLines: string[]) {}

  /**
   * 添加一条注册回调声明。
   */
  addMethod(method: Method) {
    this.methods.push(method);
  }

  /**
   * 渲染模板并输出 foreign 源码。
   */
  build(): string {
    return mustache.render(TEMPLATE.trimStart(), {
      packageName: this.packageName,
      codegenNoticeLines: this.codegenNoticeLines.map((line) => ({ line })),
      methods: this.methods,
    });
  }
}
