/**
 * Copyright (c) 2025 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE-MIT file in the root directory of this source tree.
 */

import { TypeAnnotationToCangjie, CjTypeAnnotation } from '../src/codegen-cangjie/core';

/**
 * TypeAnnotationToCangjie 单元测试。
 * 直接测试各种类型注解到 Cangjie 类型字符串的映射，
 * 无需通过 UberSchema 解析完整 spec 文件。
 */
describe('TypeAnnotationToCangjie unit tests', () => {
  const converter = new TypeAnnotationToCangjie();

  // ===== 基础类型映射 =====
  it('maps BooleanTypeAnnotation to Bool', () => {
    expect(converter.convert({ type: 'BooleanTypeAnnotation' } as CjTypeAnnotation)).toBe('Bool');
  });

  it('maps StringTypeAnnotation to String', () => {
    expect(converter.convert({ type: 'StringTypeAnnotation' } as CjTypeAnnotation)).toBe('String');
  });

  it('maps Int32TypeAnnotation to Int32', () => {
    expect(converter.convert({ type: 'Int32TypeAnnotation' } as CjTypeAnnotation)).toBe('Int32');
  });

  it('maps DoubleTypeAnnotation to Float64', () => {
    expect(converter.convert({ type: 'DoubleTypeAnnotation' } as CjTypeAnnotation)).toBe('Float64');
  });

  it('maps FloatTypeAnnotation to Float64', () => {
    expect(converter.convert({ type: 'FloatTypeAnnotation' } as CjTypeAnnotation)).toBe('Float64');
  });

  it('maps NumberTypeAnnotation to Float64', () => {
    expect(converter.convert({ type: 'NumberTypeAnnotation' } as CjTypeAnnotation)).toBe('Float64');
  });

  it('maps VoidTypeAnnotation to Unit', () => {
    expect(converter.convert({ type: 'VoidTypeAnnotation' } as CjTypeAnnotation)).toBe('Unit');
  });

  // ===== 复杂类型映射为 JsonValue =====
  it('maps ObjectTypeAnnotation to JsonValue', () => {
    expect(converter.convert({ type: 'ObjectTypeAnnotation', properties: [] } as CjTypeAnnotation)).toBe('JsonValue');
  });

  it('maps GenericObjectTypeAnnotation to JsonValue', () => {
    expect(converter.convert({ type: 'GenericObjectTypeAnnotation' } as CjTypeAnnotation)).toBe('JsonValue');
  });

  it('maps UnionTypeAnnotation to JsonValue', () => {
    expect(converter.convert({ type: 'UnionTypeAnnotation', memberType: 'StringTypeAnnotation' } as CjTypeAnnotation)).toBe('JsonValue');
  });

  it('maps MixedTypeAnnotation to JsonValue', () => {
    expect(converter.convert({ type: 'MixedTypeAnnotation' } as CjTypeAnnotation)).toBe('JsonValue');
  });

  it('maps FunctionTypeAnnotation to JsonValue', () => {
    expect(converter.convert({ type: 'FunctionTypeAnnotation', params: [], returnTypeAnnotation: { type: 'VoidTypeAnnotation' } } as CjTypeAnnotation)).toBe('JsonValue');
  });

  it('maps unknown ReservedTypeAnnotation to JsonValue', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(converter.convert({ type: 'ReservedTypeAnnotation', name: 'SomeUnknownType' } as any)).toBe('JsonValue');
  });

  it('maps ReservedTypeAnnotation RootTag to Int32', () => {
    expect(converter.convert({ type: 'ReservedTypeAnnotation', name: 'RootTag' } as CjTypeAnnotation)).toBe('Int32');
  });

  it('maps unresolvable TypeAliasTypeAnnotation to JsonValue', () => {
    // 无 aliasMap 时，未知别名降级为 JsonValue。
    expect(converter.convert({ type: 'TypeAliasTypeAnnotation', name: 'SomeCustomType' } as CjTypeAnnotation)).toBe('JsonValue');
  });

  it('maps int32 TypeAliasTypeAnnotation to Int32', () => {
    // 特殊别名 int32/Int32 直接映射为 Int32。
    expect(converter.convert({ type: 'TypeAliasTypeAnnotation', name: 'int32' } as CjTypeAnnotation)).toBe('Int32');
    expect(converter.convert({ type: 'TypeAliasTypeAnnotation', name: 'Int32' } as CjTypeAnnotation)).toBe('Int32');
  });

  it('maps undefined type annotation to JsonValue', () => {
    // 无类型注解时默认为 JsonValue。
    expect(converter.convert(undefined)).toBe('JsonValue');
  });

  // ===== 数组类型映射 =====
  it('maps Array<Bool> to Array<Bool>', () => {
    expect(converter.convert({
      type: 'ArrayTypeAnnotation',
      elementType: { type: 'BooleanTypeAnnotation' }
    } as CjTypeAnnotation)).toBe('Array<Bool>');
  });

  it('maps Array<String> to Array<String>', () => {
    expect(converter.convert({
      type: 'ArrayTypeAnnotation',
      elementType: { type: 'StringTypeAnnotation' }
    } as CjTypeAnnotation)).toBe('Array<String>');
  });

  it('maps Array<Int32> to Array<Int32>', () => {
    expect(converter.convert({
      type: 'ArrayTypeAnnotation',
      elementType: { type: 'Int32TypeAnnotation' }
    } as CjTypeAnnotation)).toBe('Array<Int32>');
  });

  it('maps Array<Float64> to Array<Float64>', () => {
    expect(converter.convert({
      type: 'ArrayTypeAnnotation',
      elementType: { type: 'DoubleTypeAnnotation' }
    } as CjTypeAnnotation)).toBe('Array<Float64>');
  });

  it('maps Array<Object> (complex element) to JsonValue', () => {
    // 数组元素为对象类型时，整个数组降级为 JsonValue。
    expect(converter.convert({
      type: 'ArrayTypeAnnotation',
      elementType: { type: 'ObjectTypeAnnotation', properties: [] }
    } as CjTypeAnnotation)).toBe('JsonValue');
  });

  it('maps nested Array<Array<string>> to JsonValue', () => {
    // 嵌套数组（高维数组）映射为 JsonValue。
    expect(converter.convert({
      type: 'ArrayTypeAnnotation',
      elementType: {
        type: 'ArrayTypeAnnotation',
        elementType: { type: 'StringTypeAnnotation' }
      }
    } as CjTypeAnnotation)).toBe('JsonValue');
  });

  // ===== 可空类型映射 =====
  it('maps NullableTypeAnnotation<String> to ?String', () => {
    expect(converter.convert({
      type: 'NullableTypeAnnotation',
      typeAnnotation: { type: 'StringTypeAnnotation' }
    } as CjTypeAnnotation)).toBe('?String');
  });

  it('maps NullableTypeAnnotation<Object> to ?JsonValue', () => {
    expect(converter.convert({
      type: 'NullableTypeAnnotation',
      typeAnnotation: { type: 'ObjectTypeAnnotation', properties: [] }
    } as CjTypeAnnotation)).toBe('?JsonValue');
  });

  // ===== 返回类型转换 =====
  it('convertReturnType maps Promise<string> to String', () => {
    expect(converter.convertReturnType({
      type: 'PromiseTypeAnnotation',
      elementType: { type: 'StringTypeAnnotation' }
    } as CjTypeAnnotation)).toBe('String');
  });

  it('convertReturnType maps Promise<void> to Unit', () => {
    expect(converter.convertReturnType({
      type: 'PromiseTypeAnnotation',
    } as CjTypeAnnotation)).toBe('Unit');
  });

  it('convertReturnType maps Promise<Object> to JsonValue', () => {
    expect(converter.convertReturnType({
      type: 'PromiseTypeAnnotation',
      elementType: { type: 'ObjectTypeAnnotation', properties: [] }
    } as CjTypeAnnotation)).toBe('JsonValue');
  });

  it('convertReturnType maps VoidTypeAnnotation to Unit', () => {
    expect(converter.convertReturnType({ type: 'VoidTypeAnnotation' } as CjTypeAnnotation)).toBe('Unit');
  });

  it('convertReturnType with undefined returns Unit', () => {
    expect(converter.convertReturnType(undefined)).toBe('Unit');
  });

  // ===== TypeAlias 解析 =====
  it('resolves TypeAliasTypeAnnotation through aliasMap', () => {
    const aliasMap: Record<string, CjTypeAnnotation> = {
      MyNumber: { type: 'NumberTypeAnnotation' } as CjTypeAnnotation,
      MyString: { type: 'StringTypeAnnotation' } as CjTypeAnnotation,
      MyObject: { type: 'ObjectTypeAnnotation', properties: [] } as CjTypeAnnotation,
    };
    const converterWithMap = new TypeAnnotationToCangjie(aliasMap);
    // 别名可解析时递归转换。
    expect(converterWithMap.convert({ type: 'TypeAliasTypeAnnotation', name: 'MyNumber' } as CjTypeAnnotation)).toBe('Float64');
    expect(converterWithMap.convert({ type: 'TypeAliasTypeAnnotation', name: 'MyString' } as CjTypeAnnotation)).toBe('String');
    // 别名解析为 Object 时应映射为 JsonValue。
    expect(converterWithMap.convert({ type: 'TypeAliasTypeAnnotation', name: 'MyObject' } as CjTypeAnnotation)).toBe('JsonValue');
  });

  // ===== WithDefaultTypeAnnotation（运行时类型）=====
  it('unwraps WithDefaultTypeAnnotation and converts inner type', () => {
    // WithDefaultTypeAnnotation 在运行时由 RN Codegen 生成（参数有默认值时），
    // 应展开内层类型后转换。
    const withDefault = {
      type: 'WithDefaultTypeAnnotation',
      typeAnnotation: { type: 'NumberTypeAnnotation' },
      default: 0,
    } as CjTypeAnnotation;
    expect(converter.convert(withDefault)).toBe('Float64');
  });

  it('unwraps WithDefaultTypeAnnotation<String> to String', () => {
    expect(converter.convert({
      type: 'WithDefaultTypeAnnotation',
      typeAnnotation: { type: 'StringTypeAnnotation' },
      default: '',
    } as CjTypeAnnotation)).toBe('String');
  });

  it('unwraps WithDefaultTypeAnnotation<Bool> to Bool', () => {
    expect(converter.convert({
      type: 'WithDefaultTypeAnnotation',
      typeAnnotation: { type: 'BooleanTypeAnnotation' },
      default: false,
    } as CjTypeAnnotation)).toBe('Bool');
  });

  it('unwraps WithDefaultTypeAnnotation<Int32> to Int32', () => {
    expect(converter.convert({
      type: 'WithDefaultTypeAnnotation',
      typeAnnotation: { type: 'Int32TypeAnnotation' },
      default: 0,
    } as CjTypeAnnotation)).toBe('Int32');
  });

  // ===== 枚举类型 =====
  it('maps StringEnumTypeAnnotation to String', () => {
    expect(converter.convert({
      type: 'StringEnumTypeAnnotation',
      values: [{ name: 'Active' }, { name: 'Inactive' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)).toBe('String');
  });

  it('maps Int32EnumTypeAnnotation to Int32', () => {
    expect(converter.convert({
      type: 'Int32EnumTypeAnnotation',
      values: [{ name: 'Zero', value: 0 }, { name: 'One', value: 1 }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)).toBe('Int32');
  });

  it('maps EnumDeclaration to its declared name', () => {
    // EnumDeclaration 在仓颉侧使用枚举名称本身（会生成 type StatusKind = String 等别名）。
    expect(converter.convert({
      type: 'EnumDeclaration',
      name: 'StatusKind',
      members: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)).toBe('StatusKind');
  });

  // ===== 更多可空类型 =====
  it('maps NullableTypeAnnotation<Bool> to ?Bool', () => {
    expect(converter.convert({
      type: 'NullableTypeAnnotation',
      typeAnnotation: { type: 'BooleanTypeAnnotation' },
    } as CjTypeAnnotation)).toBe('?Bool');
  });

  it('maps NullableTypeAnnotation<Int32> to ?Int32', () => {
    expect(converter.convert({
      type: 'NullableTypeAnnotation',
      typeAnnotation: { type: 'Int32TypeAnnotation' },
    } as CjTypeAnnotation)).toBe('?Int32');
  });

  it('maps NullableTypeAnnotation<Float64> to ?Float64', () => {
    expect(converter.convert({
      type: 'NullableTypeAnnotation',
      typeAnnotation: { type: 'NumberTypeAnnotation' },
    } as CjTypeAnnotation)).toBe('?Float64');
  });

  it('maps NullableTypeAnnotation<Array<String>> to ?Array<String>', () => {
    // 可空数组参数：Cangjie 侧使用 ?Array<String>，业务层自行判 None。
    expect(converter.convert({
      type: 'NullableTypeAnnotation',
      typeAnnotation: {
        type: 'ArrayTypeAnnotation',
        elementType: { type: 'StringTypeAnnotation' },
      },
    } as CjTypeAnnotation)).toBe('?Array<String>');
  });

  it('maps NullableTypeAnnotation<Array<Object>> to ?JsonValue', () => {
    // 可空复杂数组：元素为 Object 时数组降级为 JsonValue，外层可空则为 ?JsonValue。
    expect(converter.convert({
      type: 'NullableTypeAnnotation',
      typeAnnotation: {
        type: 'ArrayTypeAnnotation',
        elementType: { type: 'ObjectTypeAnnotation', properties: [] },
      },
    } as CjTypeAnnotation)).toBe('?JsonValue');
  });

  // ===== 更多数组元素类型 =====
  it('maps ArrayTypeAnnotation with no elementType to JsonValue', () => {
    // 无元素类型信息的数组统一降级为 JsonValue。
    expect(converter.convert({ type: 'ArrayTypeAnnotation' } as CjTypeAnnotation)).toBe('JsonValue');
  });

  it('maps Array<FloatTypeAnnotation> to Array<Float64>', () => {
    expect(converter.convert({
      type: 'ArrayTypeAnnotation',
      elementType: { type: 'FloatTypeAnnotation' },
    } as CjTypeAnnotation)).toBe('Array<Float64>');
  });

  it('maps Array<NumberTypeAnnotation> to Array<Float64>', () => {
    expect(converter.convert({
      type: 'ArrayTypeAnnotation',
      elementType: { type: 'NumberTypeAnnotation' },
    } as CjTypeAnnotation)).toBe('Array<Float64>');
  });

  it('maps Array<StringEnumTypeAnnotation> to Array<String>', () => {
    // 字符串枚举元素数组：Cangjie 侧使用 Array<String>。
    expect(converter.convert({
      type: 'ArrayTypeAnnotation',
      elementType: { type: 'StringEnumTypeAnnotation', values: [] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)).toBe('Array<String>');
  });

  it('maps Array<Int32EnumTypeAnnotation> to Array<Int32>', () => {
    // 整数枚举元素数组：Cangjie 侧使用 Array<Int32>。
    expect(converter.convert({
      type: 'ArrayTypeAnnotation',
      elementType: { type: 'Int32EnumTypeAnnotation', values: [] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)).toBe('Array<Int32>');
  });

  it('maps Array<Nullable<String>> to Array<?String>', () => {
    // 可空字符串元素数组：convertArrayElement 对 Nullable 嵌套做展开，返回 ?String。
    expect(converter.convert({
      type: 'ArrayTypeAnnotation',
      elementType: {
        type: 'NullableTypeAnnotation',
        typeAnnotation: { type: 'StringTypeAnnotation' },
      },
    } as CjTypeAnnotation)).toBe('Array<?String>');
  });

  it('maps Array<Nullable<Object>> to JsonValue', () => {
    // 可空对象元素：convertArrayElement 对 NullableObject 返回 null，数组整体降为 JsonValue。
    expect(converter.convert({
      type: 'ArrayTypeAnnotation',
      elementType: {
        type: 'NullableTypeAnnotation',
        typeAnnotation: { type: 'ObjectTypeAnnotation', properties: [] },
      },
    } as CjTypeAnnotation)).toBe('JsonValue');
  });

  // ===== 更多 PromiseTypeAnnotation 变体 =====
  it('maps PromiseTypeAnnotation<boolean> to Bool', () => {
    // Promise 返回布尔值：取内部 elementType，映射为 Bool。
    expect(converter.convert({
      type: 'PromiseTypeAnnotation',
      elementType: { type: 'BooleanTypeAnnotation' },
    } as CjTypeAnnotation)).toBe('Bool');
  });

  it('maps PromiseTypeAnnotation<Int32> to Int32', () => {
    expect(converter.convert({
      type: 'PromiseTypeAnnotation',
      elementType: { type: 'Int32TypeAnnotation' },
    } as CjTypeAnnotation)).toBe('Int32');
  });

  it('maps PromiseTypeAnnotation<Array<String>> to Array<String>', () => {
    // Promise 返回字符串数组：取内部数组类型。
    expect(converter.convert({
      type: 'PromiseTypeAnnotation',
      elementType: {
        type: 'ArrayTypeAnnotation',
        elementType: { type: 'StringTypeAnnotation' },
      },
    } as CjTypeAnnotation)).toBe('Array<String>');
  });

  // ===== ReservedPropTypeAnnotation =====
  it('maps ReservedPropTypeAnnotation to JsonValue', () => {
    // 组件属性保留类型（如 BackgroundColor）在 TurboModule 上下文中统一降级为 JsonValue。
    expect(converter.convert({
      type: 'ReservedPropTypeAnnotation',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'BackgroundColorProp',
    } as any)).toBe('JsonValue');
  });

  // ===== 更多 TypeAlias aliasMap 解析 =====
  it('resolves TypeAliasTypeAnnotation to Bool and Int32 via aliasMap', () => {
    const aliasMap: Record<string, CjTypeAnnotation> = {
      MyBool: { type: 'BooleanTypeAnnotation' } as CjTypeAnnotation,
      MyInt: { type: 'Int32TypeAnnotation' } as CjTypeAnnotation,
      MyFloat: { type: 'FloatTypeAnnotation' } as CjTypeAnnotation,
    };
    const converterWithMap = new TypeAnnotationToCangjie(aliasMap);
    expect(converterWithMap.convert({ type: 'TypeAliasTypeAnnotation', name: 'MyBool' } as CjTypeAnnotation)).toBe('Bool');
    expect(converterWithMap.convert({ type: 'TypeAliasTypeAnnotation', name: 'MyInt' } as CjTypeAnnotation)).toBe('Int32');
    expect(converterWithMap.convert({ type: 'TypeAliasTypeAnnotation', name: 'MyFloat' } as CjTypeAnnotation)).toBe('Float64');
  });

  it('resolves nested TypeAliasTypeAnnotation through aliasMap chain', () => {
    // 别名指向别名：MyAliasA → MyAliasB → NumberTypeAnnotation，应递归解析。
    const aliasMap: Record<string, CjTypeAnnotation> = {
      MyAliasA: { type: 'TypeAliasTypeAnnotation', name: 'MyAliasB' } as CjTypeAnnotation,
      MyAliasB: { type: 'NumberTypeAnnotation' } as CjTypeAnnotation,
    };
    const converterWithMap = new TypeAnnotationToCangjie(aliasMap);
    expect(converterWithMap.convert({ type: 'TypeAliasTypeAnnotation', name: 'MyAliasA' } as CjTypeAnnotation)).toBe('Float64');
  });

  // ===== convertReturnType 更多场景 =====
  it('convertReturnType maps BooleanTypeAnnotation to Bool', () => {
    expect(converter.convertReturnType({ type: 'BooleanTypeAnnotation' } as CjTypeAnnotation)).toBe('Bool');
  });

  it('convertReturnType maps Int32TypeAnnotation to Int32', () => {
    expect(converter.convertReturnType({ type: 'Int32TypeAnnotation' } as CjTypeAnnotation)).toBe('Int32');
  });

  it('convertReturnType maps NumberTypeAnnotation to Float64', () => {
    expect(converter.convertReturnType({ type: 'NumberTypeAnnotation' } as CjTypeAnnotation)).toBe('Float64');
  });

  it('convertReturnType maps StringTypeAnnotation to String', () => {
    expect(converter.convertReturnType({ type: 'StringTypeAnnotation' } as CjTypeAnnotation)).toBe('String');
  });

  it('convertReturnType maps NullableTypeAnnotation<String> to ?String', () => {
    expect(converter.convertReturnType({
      type: 'NullableTypeAnnotation',
      typeAnnotation: { type: 'StringTypeAnnotation' },
    } as CjTypeAnnotation)).toBe('?String');
  });

  it('convertReturnType maps NullableTypeAnnotation<Bool> to ?Bool', () => {
    expect(converter.convertReturnType({
      type: 'NullableTypeAnnotation',
      typeAnnotation: { type: 'BooleanTypeAnnotation' },
    } as CjTypeAnnotation)).toBe('?Bool');
  });

  it('convertReturnType maps NullableTypeAnnotation<JsonValue> to ?JsonValue', () => {
    expect(converter.convertReturnType({
      type: 'NullableTypeAnnotation',
      typeAnnotation: { type: 'ObjectTypeAnnotation', properties: [] },
    } as CjTypeAnnotation)).toBe('?JsonValue');
  });

  it('convertReturnType maps Promise<boolean> to Bool', () => {
    expect(converter.convertReturnType({
      type: 'PromiseTypeAnnotation',
      elementType: { type: 'BooleanTypeAnnotation' },
    } as CjTypeAnnotation)).toBe('Bool');
  });

  it('convertReturnType maps Promise<Int32> to Int32', () => {
    expect(converter.convertReturnType({
      type: 'PromiseTypeAnnotation',
      elementType: { type: 'Int32TypeAnnotation' },
    } as CjTypeAnnotation)).toBe('Int32');
  });

  it('convertReturnType maps Promise<Array<String>> to Array<String>', () => {
    expect(converter.convertReturnType({
      type: 'PromiseTypeAnnotation',
      elementType: {
        type: 'ArrayTypeAnnotation',
        elementType: { type: 'StringTypeAnnotation' },
      },
    } as CjTypeAnnotation)).toBe('Array<String>');
  });

  it('convertReturnType maps Array<Bool> to Array<Bool>', () => {
    // 直接返回数组（非 Promise 包装）时，convertReturnType 应等同于 convert。
    expect(converter.convertReturnType({
      type: 'ArrayTypeAnnotation',
      elementType: { type: 'BooleanTypeAnnotation' },
    } as CjTypeAnnotation)).toBe('Array<Bool>');
  });
});
