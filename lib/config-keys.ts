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
  // ใบ 082 — the plausible window a hand-typed date has to fall inside (`lib/date-window.ts` reads
  // these two keys). Deliberately **generous**: a window that is too tight refuses a legitimate
  // back-dated correction, i.e. hours or a bill not recorded — §2 rule 4 in its mirror direction.
  "date.earliestYear": {
    value: "2024",
    note: "ปีเก่าสุดที่รับวันที่ได้ (กันปีพิมพ์ผิด เช่น 0226)",
  },
  "date.futureDays": { value: "31", note: "รับวันที่ล่วงหน้าได้กี่วันนับจากวันนี้" },
} as const;

export type ConfigKey = keyof typeof CONFIG_DEFAULTS;

export type Config = Record<string, string>;

/**
 * A configured value this module refuses — **the only class of failure `num()` decides on**.
 *
 * 🔴 **It exists so a caller's `catch` can be as narrow as its claim** (`payroll-auditor`, ใบ 082
 * third round). `lib/date-window.ts` re-tags this throw as its own, so that a blank or missing
 * `date.earliestYear` reports *on* the page instead of taking it down. Catching a bare `Error`
 * there would sweep up anything else that can come out of this call — a `cfg` that is not the
 * shape it claims (`cfg[key]` on a null), a fault a future edit adds here — and print it in an
 * amber box headed "the two date keys are misconfigured", i.e. a wrong cause stated confidently
 * and an exception nobody ever investigates. Tagging the throws means everything else still
 * reaches `app/error.tsx` and the log.
 *
 * ⚠️ **The messages stay here, not in the caller.** This is the one place that decides what a bad
 * config value reads like (§2 rule 3, task 013 item 4); a second copy of that sentence would go
 * stale.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Read one configured number, or **throw**.
 *
 * 🔴 The throw is the feature (task 013 item 4). Every rate, threshold and percentage the engine
 * has comes through here, and until this round two inputs walked straight past the guard:
 *
 *   • `""` / `"   "` — `Number("")` is **0**. `/admin/config`'s config boxes are plain text fields
 *     with no `required`, so clearing one and pressing บันทึกทั้งหมด stored a blank. Measured
 *     through `computePayslip`: a cleared `comm.pt.selfClosed` pays **0 ฿** instead of 2,000 ฿ on a
 *     20,000 ฿ self-closed bill; a cleared `incentive.threshold` makes `total >= 0` true for
 *     everybody, so §1.6's retroactive 12% fires for every trainer every month; a cleared
 *     `ot.ratePerHour` zeroes OT. Every one of them with `warnings: []` — the silent zero CLAUDE.md
 *     §2 rule 4 exists to forbid, at the single point where it multiplies across every payslip.
 *   • `"1e999"` — `Infinity`, which `Number.isNaN` says nothing about and which turns a payslip
 *     into `Infinity`/`NaN` rather than failing.
 *
 * A blank is **not** a zero and is not a missing key either: the key exists and the value was
 * erased, which is a different mistake to report. The write path refuses both now
 * (`lib/config-form.ts`), and this refuses them again at read time, because a value can also arrive
 * by seed or by hand in the database.
 */
export function num(cfg: Config, key: ConfigKey): number {
  const raw = cfg[key];
  if (raw == null) throw new ConfigError(`ไม่พบ config: ${key}`);
  if (raw.trim() === "")
    throw new ConfigError(`config ${key} ถูกเว้นว่างไว้ — ต้องตั้งค่าก่อนคิดเงินเดือน`);
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new ConfigError(`config ${key} ไม่ใช่ตัวเลข: ${raw}`);
  return n;
}

/** % → ตัวคูณ */
export function pct(cfg: Config, key: ConfigKey): number {
  return num(cfg, key) / 100;
}
