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

export function SaveNotice({ err }: { err?: string }) {
  const reason = err !== undefined && Object.hasOwn(REASONS, err) ? REASONS[err] : undefined;
  if (!reason) return null;
  return (
    <p className="card-warn text-sm">
      ⚠️ มีช่องใน “{reason.where}” {reason.rule} — <b>ยังไม่ได้บันทึกอะไรเลยสักช่อง</b>{" "}
      ตรวจช่องในส่วนนั้นแล้วกดบันทึกใหม่
    </p>
  );
}
