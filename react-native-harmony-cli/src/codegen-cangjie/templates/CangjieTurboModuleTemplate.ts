/**
 * Copyright (c) 2025 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE-MIT file in the root directory of this source tree.
 */

import mustache from 'mustache';

/**
 * Cangjie TurboModule 类模板。
 * 用于生成模块骨架、方法签名与基础类型别名。
 */

const TEMPLATE = `
/**
{{#codegenNoticeLines}}
 * {{{line}}}
{{/codegenNoticeLines}}
 */

package {{packageName}}

{{#imports}}
import {{{name}}}
{{/imports}}

var turboModule: ?{{className}} = None

// 注意：基础数组仍映射为 Array<T>，复杂类型/自定义别名统一映射为 JsonValue。

{{#aliases}}
type {{name}} = {{{type}}}
{{/aliases}}
{{#enums}}
type {{name}} = {{{type}}}
{{/enums}}
public class {{className}} {
  public init() {}

  {{#methods}}
  public func {{name}}({{{stringifiedArgs}}}): {{{returnType}}} {
    throw Exception("{{name}} not implemented")
  }

  {{/methods}}
}
`;

type ImportModel = {
  name: string;
};

type Alias = {
  name: string;
  type: string;
};

type EnumModel = {
  name: string;
  type: string;
};

type Method = {
  name: string;
  stringifiedArgs: string;
  returnType: string;
};

export class CangjieTurboModuleTemplate {
  private methods: Method[] = [];
  private aliases: Alias[] = [];
  private enumModels: EnumModel[] = [];
  private imports: ImportModel[] = [];

  constructor(
    private className: string,
    private packageName: string,
    private codegenNoticeLines: string[]
  ) {}

  /**
   * 添加模块方法签名。
   */
  addMethod(method: Method) {
    this.methods.push(method);
  }

  /**
   * 添加类型别名声明。
   */
  addAlias(alias: Alias) {
    this.aliases.push(alias);
  }

  /**
   * 添加枚举占位类型声明（当前以别名形式输出）。
   */
  addEnum(enumModel: EnumModel) {
    this.enumModels.push(enumModel);
  }

  /**
   * 追加 import 语句，避免重复导入。
   */
  addImport(importName: string) {
    if (!this.imports.find((item) => item.name === importName)) {
      this.imports.push({ name: importName });
    }
  }

  /**
   * 渲染模板并输出完整 Cangjie 源码。
   */
  build(): string {
    return mustache.render(TEMPLATE.trimStart(), {
      className: this.className,
      packageName: this.packageName,
      codegenNoticeLines: this.codegenNoticeLines.map((line) => ({ line })),
      methods: this.methods,
      aliases: this.aliases,
      enums: this.enumModels,
      imports: this.imports,
    });
  }
}
