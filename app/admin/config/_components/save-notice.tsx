/**
 * Why the bulk "บันทึกทั้งหมด" refused to write anything.
 *
 * The `err` query param is a **flag**, never the message (the `/ot` and `/payslips` precedent):
 * the Thai copy lives here, nothing the URL carries is rendered, and an unknown flag renders
 * nothing at all — so a crafted link cannot put words on an admin's screen.
 *
 * 🔴 **"Unknown" is decided by `Object.hasOwn`, not by `REASONS[err]` being falsy** (task 027).
 * This is an object literal, so it carries `Object.prototype`: `?err=__proto__` used to hand back
 * an object whose `where` and `rule` are `undefined` and print *"มีช่องใน “undefined” undefined"*,
 * and `?err=constructor` a function. Same one-liner as `add-staff-form.tsx`, same reason — a
 * crafted link must reach the same nothing an ordinary unknown flag does.
 *
 * 🔴 The wording all four share is the load-bearing part: **nothing was saved**. That form posts
 * several dozen fields at once, so the question the admin actually has after a refusal is "how much
 * of it went in?" — and the answer is only trustworthy because the action validates every field
 * before its first write *and* writes them inside one transaction.
 *
 * Each branch names its own section heading as it is printed on the page, and its own rule, because
 * the rules genuinely differ: a config value may be a fraction (`class.halfRatio` is 0.5) while
 * every rate, price and salary lands in an `Int` column, and a blank means "delete this rate" in
 * exactly one of the four places.
 */
const REASONS: Record<string, { where: string; rule: string }> = {
  cfg: {
    where: "เกณฑ์ / เปอร์เซ็นต์ / OT",
    rule: "ที่เว้นว่าง หรือไม่ใช่ตัวเลขจำนวนบวก (ทศนิยมได้)",
  },
  rate: {
    where: "ตารางเรทค่าสอน",
    rule: "ที่ไม่ใช่จำนวนเต็มตั้งแต่ 0 ขึ้นไป — เว้นว่างได้ ถ้าต้องการลบเรทนั้นทิ้ง",
  },
  class: { where: "ราคาคลาส Group", rule: "ที่เว้นว่าง หรือไม่ใช่จำนวนเต็มตั้งแต่ 0 ขึ้นไป" },
  staff: {
    where: "ฐานเงินเดือน / เครดิตสอนคลาส ในตารางพนักงาน",
    rule: "ที่เว้นว่าง หรือไม่ใช่จำนวนเต็มตั้งแต่ 0 ขึ้นไป",
  },
};

/**
 * The two ways `addColor` refuses (ใบ 043). Separate from `REASONS` because the sentence differs in
 * the only part that matters: those four are *"several dozen fields, none of them saved"*, these are
 * **one row that was not written** — and saying "ยังไม่ได้บันทึกอะไรเลยสักช่อง" about a one-field
 * form would read as a system fault rather than as a refusal the admin can act on.
 *
 * 🔴 Both refusals exist because the value would have been **paid silently**, so the notice has to
 * say what would have happened, not just that it did not: a rule the owner believes is in force is
 * exactly the state ใบ 043 exists to prevent, and a silent `return` recreates it one level up. Same
 * precedent as the silent `return`s taken out of `addActivity` (ใบ 034) and `addStaff` (ใบ 027).
 */
const COLOR_REASONS: Record<string, string> = {
  colorMeaning:
    "ต้องเลือกความหมายของสีก่อน (จ่ายปกติ / ไม่จ่าย / ให้คนตรวจ) — ยังไม่ได้บันทึกกฎสีนั้น ถ้าปล่อยไว้ ระบบจะจ่ายให้ทุกคาบที่ใช้สีนี้",
  colorNeutral:
    "ตั้งกฎให้สีขาว (#ffffff) ไม่ได้ — เซลล์ที่ไม่ได้ทาสีกับเซลล์ที่ทาขาวเป็นค่าเดียวกันในชีต กฎนี้จึงจะไปโดนทุกแถวทั้งชีต ไม่ใช่เฉพาะแถวที่ตั้งใจ",
};

export function SaveNotice({ err }: { err?: string }) {
  if (err !== undefined && Object.hasOwn(COLOR_REASONS, err))
    return <p className="card-warn text-sm">⚠️ {COLOR_REASONS[err]}</p>;
  const reason = err !== undefined && Object.hasOwn(REASONS, err) ? REASONS[err] : undefined;
  if (!reason) return null;
  return (
    <p className="card-warn text-sm">
      ⚠️ มีช่องใน “{reason.where}” {reason.rule} — <b>ยังไม่ได้บันทึกอะไรเลยสักช่อง</b>{" "}
      ตรวจช่องในส่วนนั้นแล้วกดบันทึกใหม่
    </p>
  );
}
