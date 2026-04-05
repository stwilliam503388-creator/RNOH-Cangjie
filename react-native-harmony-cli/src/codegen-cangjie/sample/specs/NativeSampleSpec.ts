import type { TurboModule } from 'react-native/Libraries/TurboModule/RCTExport';
import { TurboModuleRegistry } from 'react-native';

export type UserInfo = Object;

export interface Spec extends TurboModule {
  method_v_v(): void;
  method_s_s(s: string): string;
  method_b_b(b: boolean): boolean;
  method_f_f(f: number): number;
  method_i_i(i: int32): int32;
  method_sb_v(s: string, b: boolean): number;
  method_ifsb_v(i: int32, f: number, s: string, b: boolean): void;
  method_o_o(o: Object): Object;

  // 重点关注 bridge.cj 桥接层是否做了数组类型转换
  method_sa_sa(sa: Array<string>): Array<string>;
  method_ba_ba(ba: Array<boolean>): Array<boolean>;
  method_fa_fa(fa: Array<number>): Array<number>;
  method_ia_ia(ia: Array<int32>): Array<int32>;
  // 除了基础类型的一维数组，其他类型或维度的数组整体映射为 JsonValue
  method_oa_oa(oa: Array<Object>): Array<Object>;

  // 对异步函数，重点关注 bridge.cj 中有没有正确生成 spawn 和 resolve/reject 逻辑
  method_v_vp(): Promise<void>;
  method_s_sp(s: string): Promise<string>;
  method_b_bp(b: boolean): Promise<boolean>;
  method_f_fp(f: number): Promise<number>;
  method_i_ip(i: int32): Promise<int32>;
  method_o_op(o: Object): Promise<Object>;
  method_sap_sap(sa: Array<string>): Promise<Array<string>>;
  method_bap_bap(ba: Array<boolean>): Promise<Array<boolean>>;
  method_fap_fap(fa: Array<number>): Promise<Array<number>>;
  method_iap_iap(ia: Array<int32>): Promise<Array<int32>>;
  method_oap_oap(oa: Array<Object>): Promise<Array<Object>>;
  method_sb_vp(s: string, ba: Array<boolean>): Promise<number>;
  method_ofasaoa_op(
    o: Object,
    fa: Array<number>,
    sa: Array<string>,
    oa: Array<Object>
  ): Promise<Object>;

  // 重点检查 CangjieTurboModule.cpp 模板中是否为每个参数生成了默认值
  method_fd_v(f: number = 1.5): void;
  method_bd_v(b: boolean = true): void;
  method_sd_v(s: string = 'default'): void;
  method_id_v(i: int32 = 2026): void;
  // method_fad_v(fa: Array<number> = [2026, 2, 11]): void // 暂不支持

  // 基础类型及其一维数组之外的类型，全部按 JS 对象转为为 JsonValue
  sendUser(user: UserInfo): void;
  sendNested(matrix: Array<Array<number>>): void;
  getUser(): Promise<UserInfo>;
  getNested(): Promise<Array<Array<number>>>;
}

export default TurboModuleRegistry.get<Spec>('Sample')!;
