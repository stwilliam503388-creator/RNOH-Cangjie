/**
 * Copyright (c) 2025 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE-MIT file in the root directory of this source tree.
 */

import { TypeAnnotation } from '../../codegen/core/TypeAnnotationToTS';

/**
 * 将 RN Codegen 的类型注解转换为 Cangjie 侧的类型字符串。
 * 主要用于生成 TurboModule 方法签名与桥接声明。
 */
export class TypeAnnotationToCangjie {
  constructor(private aliasMap?: Record<string, TypeAnnotation>) {}

  /**
   * 数组元素允许映射到 Cangjie 的基础类型，超出范围则交由 JsonValue 统一承载。
   */
  private convertArrayElement(typeAnnotation: TypeAnnotation): string | null {
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
  convert(typeAnnotation: TypeAnnotation | undefined): string {
    if (!typeAnnotation) {
      return 'String';
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
        return 'JsonValue';
      case 'ReservedPropTypeAnnotation':
      case 'ObjectTypeAnnotation':
      case 'UnionTypeAnnotation':
      case 'GenericObjectTypeAnnotation':
      case 'MixedTypeAnnotation':
      case 'FunctionTypeAnnotation':
        // 复杂类型统一使用 JsonValue，占位交由业务层自行解析。
        return 'JsonValue';
      case 'PromiseTypeAnnotation':
        return this.convert(typeAnnotation.elementType);
      case 'VoidTypeAnnotation':
        return 'Unit';
      default:
        return 'JsonValue';
    }
  }

  /**
   * 将返回类型注解转换为 Cangjie 类型。
   * Promise 返回值会直接取内部 elementType。
   */
  convertReturnType(typeAnnotation: TypeAnnotation | undefined): string {
    if (!typeAnnotation) {
      return 'Unit';
    }
    if (typeAnnotation.type === 'PromiseTypeAnnotation') {
      return this.convert(typeAnnotation.elementType);
    }
    if (typeAnnotation.type === 'VoidTypeAnnotation') {
      return 'Unit';
    }
    return this.convert(typeAnnotation);
  }
}
