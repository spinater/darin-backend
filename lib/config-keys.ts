/**
 * §4 — ทุกเรท/เกณฑ์/% อยู่ที่นี่ที่เดียว ห้าม hardcode ที่อื่น
 * ค่า default ใช้ตอน seed เท่านั้น runtime อ่านจากตาราง PayrollConfig เสมอ
 */
export const CONFIG_DEFAULTS = {
  "comm.membership.basic": { value: "5", note: "% คอมขายสมาชิก Basic" },
  "comm.membership.promo": { value: "5", note: "% คอมขายราคาโปรโมชั่น (จ่ายจริง < ราคาเต็ม)" },
  "comm.membership.full": { value: "10", note: "% คอมขายราคาเต็ม Premium/Platinum/PT/Pilates" },
  "comm.pt.selfClosed": { value: "10", note: "% คอม PT เทรนเนอร์ปิดเอง" },
  "comm.pt.leadTrainer": { value: "7", note: "% คอม PT เทรนเนอร์ปิดจากลีดคนอื่น" },
  "comm.pt.leadReferrer": { value: "3", note: "% คอม PT ผู้ส่งลีด / เจ้าของคลิป" },
  "comm.pt.counterSelf": { value: "10", note: "% คอม PT เคาน์เตอร์ปิดเอง (online)" },
  "incentive.threshold": { value: "30000", note: "เกณฑ์ยอด PT self-closed ต่อเดือน" },
  "incentive.rate": { value: "12", note: "% คอมเมื่อถึงเกณฑ์ (ใช้ย้อนหลังทั้งเดือน)" },
  "class.minAttendees": { value: "3", note: "คนเข้าจริงขั้นต่ำที่ได้เต็มราคา" },
  "class.halfRatio": { value: "0.5", note: "ตัวคูณเมื่อคนเข้าจริง 1..(min-1)" },
  "ot.thresholdHours": { value: "9", note: "ชั่วโมงต่อวันก่อนเริ่มนับ OT" },
  "ot.ratePerHour": { value: "40", note: "บาท/ชม. OT" },
  "courseExt.15day": { value: "500", note: "ค่าต่ออายุคอร์ส 15 วัน (ไม่มีคอม)" },
  "courseExt.30day": { value: "900", note: "ค่าต่ออายุคอร์ส 30 วัน (ไม่มีคอม)" },
  "freeze.price": { value: "300", note: "ค่า freeze (ไม่มีคอม)" },
  "payday.base": { value: "31", note: "วันจ่ายฐานเงินเดือน" },
  "payday.variable": { value: "3", note: "วันจ่ายค่าสอน+คอม+OT ของเดือนก่อน" },
} as const;

export type ConfigKey = keyof typeof CONFIG_DEFAULTS;

export type Config = Record<string, string>;

export function num(cfg: Config, key: ConfigKey): number {
  const raw = cfg[key];
  if (raw == null) throw new Error(`ไม่พบ config: ${key}`);
  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`config ${key} ไม่ใช่ตัวเลข: ${raw}`);
  return n;
}

/** % → ตัวคูณ */
export function pct(cfg: Config, key: ConfigKey): number {
  return num(cfg, key) / 100;
}
