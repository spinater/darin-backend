/**
 * The window is unusable — say so on the page instead of taking the page down (ใบ 082, second
 * review round).
 *
 * 🔴 **One shape, four screens, so one component.** `/ot`, `/sales`, `/classes` and `/sync/review`
 * all build the same window from the same two `PayrollConfig` keys and all fail it the same way;
 * four hand-written copies of this box would drift the first time the remedy sentence changed.
 *
 * 🔑 **`reason` is `lib/date-window.ts`'s own message, printed verbatim** — it already names the
 * two offending numbers and the remedy, and it is built from `PayrollConfig`, never from the
 * request (nothing here comes from the URL, unlike the `?err=` notices beside it). Re-writing it
 * in this file would give the same sentence two homes and one of them would go stale (§2 rule 3's
 * argument applied to copy).
 *
 * 🔴 **`surface` exists because "what still works here" is *not* the same on all four screens, and
 * the wrong answer costs money** (`payroll-auditor`, ใบ 082 third round). The `rows` copy tells the
 * reader that what is already keyed can still be read and **deleted**, which is true of `/ot`,
 * `/sales` and `/classes`. `/sync/review` has **no delete**: its one enabled button is **ข้าม**,
 * which writes `status: "ignored", reviewed: true` — *this คาบ is not paid*. A reviewer who read
 * the `rows` sentence there as permission to clear a duplicate and pressed ข้าม on a queue of 12
 * June ว่ายน้ำ คาบ would drop `12 × 250 = 3,000 ฿` off the draft slip with the queue showing clean
 * (§1.2, §2 rule 4). So that screen gets its own sentence, and it says what ข้าม means.
 *
 * ⚠️ **The remedy names the keys but does not link `/admin/config`.** This box renders on `/sales`
 * too, whose gate is `requireRole("owner", "admin", "counter")`, and `counter` cannot open that
 * screen — the same decision the `dateRange` notice on that page already carries. Telling them who
 * to ask is reachable; sending them to a screen they are refused is not.
 *
 * 🔑 **The missing-key sentence is printed unconditionally**, and it is the one `app/error.tsx`
 * already carries. Since `bound()` re-tags `num()`'s throw, a *missing* or blank key lands in this
 * box rather than on the error boundary — but `/admin/config` renders one input per **existing**
 * `PayrollConfig` row (ใบ 044), so for a missing key the remedy above points at a field that is not
 * there. Both causes are possible whenever this box renders and the extra sentence is true of
 * both, so it is not branched.
 */
export function WindowFaultNotice({
  reason,
  surface = "rows",
}: {
  reason: string;
  /**
   * Which screen is rendering this — it selects the "what still works" sentence only.
   * `rows` = a screen with a delete (`/ot`, `/sales`, `/classes`); `review` = `/sync/review`,
   * whose only enabled button stops a คาบ being paid.
   */
  surface?: "rows" | "review";
}) {
  return (
    <div className="card-warn flex flex-col gap-2 text-sm" role="alert">
      <p>
        ⚠️ <b>ค่าช่วงวันที่ที่ระบบรับ ยังใช้ไม่ได้</b> — ตอนนี้จึง
        <b>บันทึกรายการที่มีวันที่ไม่ได้</b> จนกว่าจะแก้ค่าให้ถูก
      </p>
      <p className="leading-relaxed break-words">{reason}</p>
      <p className="leading-relaxed">
        {surface === "review" ? (
          <>
            หน้านี้ยัง<b>กดข้ามได้</b> แต่ <b>ข้าม ไม่ใช่การลบรายการซ้ำ</b> — มันแปลว่า
            <b>ไม่จ่ายคาบนี้</b> คาบที่ถูกข้ามจะไม่เข้าเงินเดือนงวดไหนเลย · ถ้ายังไม่แน่ใจ
            <b>ให้ปล่อยคาบไว้ในคิว</b> จนกว่าค่าจะถูกแก้ แล้วค่อยกดยืนยัน
          </>
        ) : (
          <>
            รายการที่คีย์ไว้แล้ว <b>ยังดูและลบได้ตามปกติ</b> — ถ้าเจอรายการซ้ำ ให้ลบได้เลย
          </>
        )}
      </p>
      <p className="leading-relaxed">
        ให้แจ้งผู้ดูแลระบบแก้ค่า <span className="font-mono">date.earliestYear</span> หรือ{" "}
        <span className="font-mono">date.futureDays</span> ที่หน้าตั้งค่า แล้วเปิดหน้านี้ใหม่ ·{" "}
        <b>ถ้าไม่เจอช่องนั้นที่หน้าตั้งค่า</b> แปลว่าค่านั้นยังไม่มีแถวในฐานข้อมูล
        หน้าตั้งค่าจึงไม่มีช่องให้แก้ — ให้แจ้งคนที่ดูแลเซิร์ฟเวอร์
      </p>
    </div>
  );
}
