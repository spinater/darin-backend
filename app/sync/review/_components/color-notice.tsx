import { COLOR_MEANING_LABELS, type ColorMeaning } from "@/lib/color-rules";

/**
 * What `/sync/review?hex=` is allowed to tell the owner to do — **one sentence per colour rule,
 * never one for all of them** (task 070, `payroll-auditor` round 1).
 *
 * 🔴 The two swatch sentences that link here mean opposite things
 * (`app/_components/color-swatches.tsx`), and a single fixed "กดข้ามตามกฎสี" collapses them:
 *
 * | rule | what it actually says | what the screen may offer |
 * |---|---|---|
 * | `skip` | these คาบ must not be paid | ข้าม, per row and in bulk |
 * | `review` | **a human should look** — it never said "do not pay" | ข้าม per row only, no bulk |
 * | `pay` / none | nothing that contradicts a payable row | **no listing at all** |
 *
 * The `review` arm is the expensive one: ว่ายน้ำ is ruled `review`, is 100% hand-cleared by
 * construction, and is the sheet the 10,000 ฿ paragraph in `lib/color-rules.ts` is about. A page
 * that told its reader to bulk-ข้าม it would withhold 40 × 250 ฿ the rule never asked to withhold —
 * ใบ 043's "one working button" trap rebuilt one screen along.
 */
export function ColorNotice({ meaning }: { meaning: ColorMeaning | undefined }) {
  if (meaning === "skip")
    return (
      <p className="text-amber-700">
        สีนี้ตั้งไว้ว่า <b>&quot;{COLOR_MEANING_LABELS.skip}&quot;</b> ⇒ คาบข้างล่างกำลัง
        <b>จ่ายสวนกฎอยู่</b> · กด <b>ข้าม</b> เพื่อเอาออกจากเงินเดือน · คาบที่ขึ้นว่า{" "}
        <b>ตรวจด้วยมือแล้ว</b> ต้องกดที่นี่เท่านั้น เพราะ sync ครั้งหน้าจะข้ามมันตลอดไป
        ส่วนคาบที่ขึ้นว่า <b>sync ครั้งหน้าจัดให้เอง</b> ไม่ต้องกดก็ได้
      </p>
    );
  if (meaning === "review")
    return (
      <p>
        สีนี้ตั้งไว้ว่า <b>&quot;{COLOR_MEANING_LABELS.review}&quot;</b> —{" "}
        <b>ไม่ได้แปลว่าไม่จ่าย</b> ⇒ กฎขอให้<b>คนดู</b> ไม่ได้บอกคำตอบไว้ล่วงหน้า · ดูทีละคาบ แล้ว
        <b>กดข้ามเฉพาะคาบที่ไม่ใช่คาบสอนจริง</b> · คาบที่ดูแล้วถูกต้อง <b>ไม่ต้องกดอะไร</b>{" "}
        มันจ่ายอยู่แล้ว · ไม่มีปุ่มข้ามทั้งหน้าในโหมดนี้โดยตั้งใจ
      </p>
    );
  return null;
}

/**
 * The refusal shown instead of a listing when the colour has no rule, or is ruled `pay`.
 *
 * 🔴 **A listing with no rule behind it is a guess wearing an instruction's clothes.** What a sheet
 * colour means is the owner's open question (REQUIREMENTS §1.6) and this product's standing answer
 * is to *ask*, never to default — `colorGaps` reports an unruled colour precisely because nobody has
 * said. A page that put fifty checkboxes under such a colour would be the default-to-`skip` that
 * `lib/color-rules.ts` refuses, reached through a URL instead of through the engine.
 */
export function NoRuleNotice({ hex, meaning }: { hex: string; meaning: ColorMeaning | undefined }) {
  return (
    <div className="card-warn text-sm">
      <p className="mb-1">
        <span
          className="mr-1 inline-block size-3 rounded-sm border align-middle"
          style={{ background: hex }}
        />
        <code className="font-mono">{hex}</code>{" "}
        {meaning === "pay" ? (
          <>
            ตั้งไว้ว่า <b>&quot;{COLOR_MEANING_LABELS.pay}&quot;</b> ⇒ คาบสีนี้
            <b>ถูกต้องอยู่แล้ว</b> ไม่มีอะไรต้องแก้ที่หน้านี้
          </>
        ) : (
          <>
            <b>ยังไม่มีใครบอกว่าสีนี้แปลว่าอะไร</b> ⇒ หน้านี้ยังไม่มีสิทธิ์บอกให้ข้ามหรือให้จ่าย
          </>
        )}
      </p>
      <p className="text-xs">
        ระบบ<b>ไม่เดาความหมายของสี</b> — ตอบที่หน้าตั้งค่าก่อน แล้วค่อยกลับมา ถ้าคำตอบคือ &quot;
        {COLOR_MEANING_LABELS.skip}&quot; หรือ &quot;
        {COLOR_MEANING_LABELS.review}&quot;
      </p>
      <p className="mt-2">
        <a href="/admin/config" className="btn">
          ไปตั้งกฎสีนี้
        </a>{" "}
        <a href="/sync/review" className="btn-ghost">
          กลับคิวรอตรวจ
        </a>
      </p>
    </div>
  );
}

/** `?hex=` that may not be aimed at rows at all — `isReportableHex` in `lib/color-rules.ts`. */
export function BadHexNotice({ hex }: { hex: string }) {
  return (
    <div className="card-warn text-sm">
      <p className="mb-2">
        <code className="font-mono">{hex}</code> ไม่ใช่สีที่หน้าจอนี้ทำงานด้วยได้ —
        ต้องเป็นรหัสหกหลักขึ้นต้นด้วย <code className="font-mono">#</code> (เช่น{" "}
        <code className="font-mono">#ea9999</code>) และ<b>ต้องไม่ใช่สีขาว</b>
      </p>
      <p className="text-xs">
        🔴 เซลล์ที่ <b>ไม่ได้ทาสี</b> กับเซลล์ที่ <b>ทาขาว</b> เป็นไบต์เดียวกัน (
        <code className="font-mono">#ffffff</code>) ⇒ เล็งสีขาวคือเล็งคาบที่จ่ายอยู่<b>ทั้งเดือน</b>{" "}
        ซึ่งหน้าตั้งค่าก็ปฏิเสธด้วยเหตุผลเดียวกัน · และ <code className="font-mono">%</code> กับ{" "}
        <code className="font-mono">_</code> เป็นอักขระแทนที่ของการค้นหา ไม่ใช่ตัวอักษรธรรมดา ·
        ที่นี่ไม่มีการเดาว่าคุณหมายถึงสีไหน
      </p>
      <p className="mt-2">
        <a href="/sync/review" className="btn-ghost">
          กลับคิวรอตรวจ
        </a>
      </p>
    </div>
  );
}
