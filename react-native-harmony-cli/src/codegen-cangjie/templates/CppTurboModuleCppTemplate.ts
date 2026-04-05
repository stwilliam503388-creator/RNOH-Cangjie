/**
 * Copyright (c) 2025 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE-MIT file in the root directory of this source tree.
 */

import mustache from 'mustache';

/**
 * C++ TurboModule 实现模板。
 * 负责生成 methodMap_ 映射与 C++ -> Cangjie 的调用封装。
 */

const TEMPLATE = `
/**
{{#codegenNoticeLines}}
 * {{{line}}}
{{/codegenNoticeLines}}
 */

#include "{{className}}.h"
#include "RNOHCangjieBridge/PromiseHolder.h"
#include "RNOHCangjieBridge/TurboModuleBridge/{{bridgeHeader}}"
#include "react/bridging/Promise.h"

#include <memory>

using namespace rnoh;
using namespace facebook;

{{className}}::{{className}}(const TurboModule::Context ctx, const std::string name)
    : TurboModule(ctx, name) {
  methodMap_ = {
    {{#methods}}
    { "{{name}}", { {{argsCount}}, {{className}}::{{name}} } },
    {{/methods}}
  };
}

{{#methods}}
facebook::jsi::Value {{className}}::{{name}}(
    facebook::jsi::Runtime& rt,
    facebook::react::TurboModule& turboModule,
    const facebook::jsi::Value* args,
    size_t count) {
  {{#cppArgDeclarations}}
  {{{line}}}
  {{/cppArgDeclarations}}
  {{#isAsync}}
  const auto callInvoker =
      dynamic_cast<{{className}}*>(&turboModule)->jsInvoker_;
  auto asyncPromise =
      std::make_shared<react::AsyncPromise<CJ_Object>>(rt, callInvoker);
  auto promiseHolder = new PromiseHolder<CJ_Object>(asyncPromise);
  {{bridgeNamespace}}::{{name}}({{{cppCallArgsWithPromise}}});
  return asyncPromise->get(rt);
  {{/isAsync}}
  {{^isAsync}}
  {{#hasReturn}}
  auto result = {{bridgeNamespace}}::{{name}}({{{cppCallArgs}}});
  return react::Bridging<CJ_Object>::toJs(rt, result);
  {{/hasReturn}}
  {{^hasReturn}}
  {{bridgeNamespace}}::{{name}}({{{cppCallArgs}}});
  return jsi::Value::undefined();
  {{/hasReturn}}
  {{/isAsync}}
}

{{/methods}}
`;

type Method = {
  name: string;
  argsCount: number;
  isAsync: boolean;
  hasReturn: boolean;
  cppArgDeclarations: { line: string }[];
  cppCallArgs: string;
  cppCallArgsWithPromise: string;
};

export class CppTurboModuleCppTemplate {
  private methods: Method[] = [];

  constructor(
    private className: string,
    private bridgeHeader: string,
    private bridgeNamespace: string,
    private codegenNoticeLines: string[]
  ) {}

  /**
   * 添加方法实现描述。
   */
  addMethod(method: Method) {
    this.methods.push(method);
  }

  /**
   * 渲染模板并输出 C++ 实现文件内容。
   */
  build(): string {
    return mustache.render(TEMPLATE.trimStart(), {
      className: this.className,
      bridgeHeader: this.bridgeHeader,
      bridgeNamespace: this.bridgeNamespace,
      codegenNoticeLines: this.codegenNoticeLines.map((line) => ({ line })),
      methods: this.methods,
    });
  }
}
