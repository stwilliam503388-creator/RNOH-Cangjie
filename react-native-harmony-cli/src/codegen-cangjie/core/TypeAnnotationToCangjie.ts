/**
 * Copyright (c) 2025 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE-MIT file in the root directory of this source tree.
 */

import { TypeAnnotation } from '../../codegen/core/TypeAnnotationToTS';

/**
 * RN Codegen 在运行时会为含默认值的参数生成 WithDefaultTypeAnnotation，
 * 但该类型未包含在 @react-native/codegen 的 TypeScript 类型声明中。
 * 这里在本地声明，以便编译期可以正确处理。
 */
type WithDefaultTypeAnnotation = {
  readonly type: 'WithDefaultTypeAnnotation';
  readonly typeAnnotation: TypeAnnotation;
  readonly default: string | boolean | number;
};

/**
 * 本地扩展的 TypeAnnotation 联合类型，包含 WithDefaultTypeAnnotation。
 * 用于处理带默认值的 TurboModule 参数。
 */
export type CjTypeAnnotation = TypeAnnotation | WithDefaultTypeAnnotation;

/**
 * 将 RN Codegen 的类型注解转换为 Cangjie 侧的类型字符串。
 * 主要用于生成 TurboModule 方法签名与桥接声明。
 */
export class TypeAnnotationToCangjie {
  constructor(private aliasMap?: Record<string, CjTypeAnnotation>) {}

  /**
   * 数组元素允许映射到 Cangjie 的基础类型，超出范围则交由 JsonValue 统一承载。
   */
  private convertArrayElement(typeAnnotation: CjTypeAnnotation): string | null {
    switch (typeAnnotation.type) {
      case 'BooleanTypeAnnotation':
        return 'Bool';
      case 'StringTypeAnnotation':
      case 'StringEnumTypeAnnotation':
        return 'String';
      case 'Int32TypeAnnotation':
      case 'Int32EnumTypeAnnotation':
        return 'Int32';
      case 'DoubleTypeAnnotation':
      case 'FloatTypeAnnotation':
      case 'NumberTypeAnnotation':
        return 'Float64';
      case 'NullableTypeAnnotation': {
        const inner = this.convertArrayElement(typeAnnotation.typeAnnotation);
        return inner ? `?${inner}` : null;
      }
      case 'TypeAliasTypeAnnotation': {
        if (typeAnnotation.name === 'int32' || typeAnnotation.name === 'Int32') {
          return 'Int32';
        }
        const alias = this.aliasMap?.[typeAnnotation.name];
        return alias ? this.convertArrayElement(alias) : null;
      }
      case 'WithDefaultTypeAnnotation':
        // 带默认值的参数展开后按内部类型处理。
        return this.convertArrayElement(typeAnnotation.typeAnnotation);
      default:
        // 复杂对象/嵌套数组在数组场景中交由 JsonValue 处理。
        return null;
    }
  }

  /**
   * 将类型注解转换为 Cangjie 参数类型。
   * 缺省时返回 JsonValue，确保复杂类型仍可被业务层接管。
   */
  convert(typeAnnotation: CjTypeAnnotation | undefined): string {
    if (!typeAnnotation) {
      // 无类型注解时默认为 JsonValue，避免生成无效类型。
      return 'JsonValue';
    }
    switch (typeAnnotation.type) {
      case 'BooleanTypeAnnotation':
        return 'Bool';
      case 'StringTypeAnnotation':
        return 'String';
      case 'Int32TypeAnnotation':
        return 'Int32';
      case 'DoubleTypeAnnotation':
      case 'FloatTypeAnnotation':
      case 'NumberTypeAnnotation':
        // JS Number 对应双精度浮点，Cangjie 使用 Float64 保留精度。
        return 'Float64';
      case 'StringEnumTypeAnnotation':
        return 'String';
      case 'Int32EnumTypeAnnotation':
        return 'Int32';
      case 'EnumDeclaration':
        // 枚举类型使用其类型别名名称（对应生成代码中的 type EnumName = Int32/String）。
        return typeAnnotation.name;
      case 'NullableTypeAnnotation':
        return `?${this.convert(typeAnnotation.typeAnnotation)}`;
      case 'ArrayTypeAnnotation': {
        // 常见基础数组支持转换为 Cangjie Array<T>，复杂类型统一交由 JsonValue。
        const elementType = typeAnnotation.elementType
          ? this.convertArrayElement(typeAnnotation.elementType)
          : null;
        return elementType ? `Array<${elementType}>` : 'JsonValue';
      }
      case 'WithDefaultTypeAnnotation':
        // 带默认值的参数展开内层类型，让调用方决定是否添加 ?。
        return this.convert(typeAnnotation.typeAnnotation);
      case 'TypeAliasTypeAnnotation': {
        if (typeAnnotation.name === 'int32' || typeAnnotation.name === 'Int32') {
          return 'Int32';
        }
        const alias = this.aliasMap?.[typeAnnotation.name];
        // 自定义别名若能解析则递归转换，否则直接降级为 JsonValue。
        return alias ? this.convert(alias) : 'JsonValue';
      }
      case 'ReservedTypeAnnotation':
        if (typeAnnotation.name === 'RootTag') {
          return 'Int32';
        }
        // 其他保留类型无法精确映射，统一使用 JsonValue。
        return 'JsonValue';
      case 'ReservedPropTypeAnnotation':
      case 'ObjectTypeAnnotation':
      case 'UnionTypeAnnotation':
      case 'GenericObjectTypeAnnotation':
      case 'MixedTypeAnnotation':
      case 'FunctionTypeAnnotation':
        // 复杂类型（自定义对象、联合类型、函数）统一使用 JsonValue，由业务层自行解析。
        return 'JsonValue';
      case 'PromiseTypeAnnotation':
        // Promise 类型取内部 elementType；无 elementType 时为 void。
        return typeAnnotation.elementType
          ? this.convert(typeAnnotation.elementType)
          : 'Unit';
      case 'VoidTypeAnnotation':
        return 'Unit';
      default:
        // 所有未知/未来新增类型统一降级为 JsonValue，保证代码可编译。
        return 'JsonValue';
    }
  }

  /**
   * 将返回类型注解转换为 Cangjie 类型。
   * Promise 返回值会直接取内部 elementType；无类型时默认为 Unit。
   */
  convertReturnType(typeAnnotation: CjTypeAnnotation | undefined): string {
    if (!typeAnnotation) {
      return 'Unit';
    }
    if (typeAnnotation.type === 'PromiseTypeAnnotation') {
      // Promise<void> 没有 elementType，直接返回 Unit。
      return typeAnnotation.elementType
        ? this.convert(typeAnnotation.elementType)
        : 'Unit';
    }
    if (typeAnnotation.type === 'VoidTypeAnnotation') {
      return 'Unit';
    }
    return this.convert(typeAnnotation);
  }
}
