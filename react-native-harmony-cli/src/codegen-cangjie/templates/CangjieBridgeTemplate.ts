/**
 * Copyright (c) 2025 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE-MIT file in the root directory of this source tree.
 */

import mustache from 'mustache';

/**
 * Cangjie 桥接层模板（@C 导出函数）。
 * 负责把 C++ FFI 调用转发至 Cangjie TurboModule。
 */

const TEMPLATE = `
/*
{{#codegenNoticeLines}}
 * {{{line}}}
{{/codegenNoticeLines}}
 */

package {{packageName}}

import reactnative_ohcj.Bridge.*

{{#imports}}
import {{{name}}}
{{/imports}}

{{#methods}}
@C
func {{cFunctionName}}({{{stringifiedParams}}}): {{returnType}} {
  {{#argConversions}}
  {{{line}}}
  {{/argConversions}}
  if (let Some(module) <- turboModule) {
    {{#isAsync}}
    spawn {
      try {
        {{{asyncCallLine}}}
        {{#asyncResolveLines}}
        {{{line}}}
        {{/asyncResolveLines}}
      } catch (e: Exception) {
        PromiseReject(promise, "{{name}} failed: " + e.toString())
      }
    }
    {{/isAsync}}
    {{^isAsync}}
    try {
      {{#hasReturn}}
      let result = module.{{name}}({{{callArgs}}})
      {{#syncReturnLines}}
      {{{line}}}
      {{/syncReturnLines}}
      {{/hasReturn}}
      {{^hasReturn}}
      {{syncCallLine}}
      {{/hasReturn}}
    } catch (e: Exception) { }
    {{/isAsync}}
  }
  {{#hasReturn}}
  return CJ_Object(CPointer<Unit>(), CJ_UndefinedKind)
  {{/hasReturn}}
}

{{/methods}}
`;

type ImportModel = {
  name: string;
};

type Method = {
  name: string;
  cFunctionName: string;
  stringifiedParams: string;
  returnType: string;
  callArgs: string;
  argConversions: { line: string }[];
  isAsync: boolean;
  hasReturn: boolean;
  asyncCallLine: string;
  asyncResolveLines: { line: string }[];
  syncCallLine: string;
  syncReturnLines: { line: string }[];
};

export class CangjieBridgeTemplate {
  private methods: Method[] = [];
  private imports: ImportModel[] = [];

  constructor(private packageName: string, private codegenNoticeLines: string[]) {}

  /**
   * 添加桥接函数描述。
   */
  addMethod(method: Method) {
    this.methods.push(method);
  }

  /**
   * 追加 import 语句，避免重复。
   */
  addImport(importName: string) {
    if (!this.imports.find((item) => item.name === importName)) {
      this.imports.push({ name: importName });
    }
  }

  /**
   * 渲染模板并输出桥接层 Cangjie 源码。
   */
  build(): string {
    return mustache.render(TEMPLATE.trimStart(), {
      packageName: this.packageName,
      codegenNoticeLines: this.codegenNoticeLines.map((line) => ({ line })),
      methods: this.methods,
      imports: this.imports,
    });
  }
}
