/**
 * The five refusal notices of `/sync/review`, moved out of `page.tsx` at ใบ 082.
 *
 * 🔴 **The move is a §4 split, not a redesign** — the page was 449 lines against the 500 ceiling
 * (warn at 450) and ใบ 082 adds a sixth flag, so the notices were the block that could leave with a
 * clean boundary. Same pattern `/admin/config` already took for the same reason (`save-notice`,
 * `add-staff-form`); the copy below is unchanged from the page except for the new `dateRange` arm.
 *
 * 🔑 **`err` is a flag, never a message** (`.docs/knowledge/domain/form-refusals.md`): it arrives
 * from the URL, it is only ever *compared* here, and every word on screen is written in this file
 * (§2.5). A crafted link cannot put words on an admin's screen through it. The one thing rendered
 * from data is the window's two bounds, which come from `PayrollConfig` and not from the request.
 */
export function RefusalNotice({
  err,
  bounds,
}: {
  err: string | undefined;
  /**
   * The window's bounds as `YYYY-MM-DD`, from `lib/date-window.ts`'s `windowForRender` — **`null`
   * when the two config keys cannot make a window at all** (ใบ 082, second review round). The
   * `dateRange` arm below then renders nothing: there are no bounds to print, and the page shows
   * `WindowFaultNotice` instead, which says more. Everything else on this surface is unaffected.
   */
  bounds: { earliest: string; latest: string } | null;
}) {
  return (
    <>
      {/* ใบ 080 — `/ot`'s sentence and worked example, one refusal with four surfaces now. The
          sharper half is this screen's alone: the reviewer is here **because** the sheet's date was
          unreadable, so the notice has to say that a typo is stamped permanently (`reviewed: true`
          ⇒ no later sync repairs it) rather than merely "not saved". */}
      {err === "date" && (
        <div className="card-warn text-sm">
          ⚠️ วันที่อ่านไม่ออก หรือไม่มีอยู่จริง (เช่น 2026-06-31) — <b>คาบนี้ยังไม่ถูกยืนยัน</b>{" "}
          ตรวจช่อง “วันที่” แล้วกดยืนยันอีกครั้ง · วันที่ผิดเดือนจะ<b>ย้ายคาบนี้ไปอีกงวด</b>{" "}
          และเพราะการยืนยันคือการตรวจด้วยมือ <b>sync รอบหน้าจะไม่แก้คืนให้</b>
        </div>
      )}
      {/* 🔴 ใบ 082 — a **separate** flag from `date`, and this is the screen the card was opened
          for. The date above is unreadable; the date here reads perfectly and names a year this gym
          cannot have operated in (`0226-06-05`, which is what a date picker's three-digit year box
          produces). Confirming that คาบ used to write `status:"ok", reviewed:true` ⇒ it left the
          queue, landed in **no** period, and no later sync could repair it: 250 ฿ paid as 0 ฿,
          permanently, with the queue showing clean. The copy says that, and prints the real bounds
          — they are `PayrollConfig`, so typing them in here would go wrong the first time one
          moved (§2 rule 3).

          🔑 **And it carries `/ot`'s remedy sentence**, because printing the bounds says what was
          refused but not what to do when the backfill really is older than the window. Every
          reviewer here is `requireAdmin()` (`page.tsx`), which is exactly `/admin/config`'s own
          gate, so the key is one screen away. `/sales` is the one screen deliberately **without**
          the sentence: it is open to `counter`, who cannot open `/admin/config` ⇒ it would send
          them somewhere they cannot go. */}
      {err === "dateRange" && bounds && (
        <div className="card-warn text-sm">
          ⚠️ ปีในวันที่อยู่นอกช่วงที่ระบบรับ (เช่น 0226-06-05 ที่เกิดจากพิมพ์ปีไม่ครบ) —{" "}
          <b>คาบนี้ยังไม่ถูกยืนยัน</b> ช่วงที่รับคือ{" "}
          <b>
            {bounds.earliest} ถึง {bounds.latest}
          </b>{" "}
          · ปีที่ผิดแบบนี้จะทำให้คาบ<b>ไม่อยู่ในงวดไหนเลย</b> และการยืนยันคือการตรวจด้วยมือ ⇒{" "}
          <b>sync รอบหน้าจะไม่แก้คืนให้</b> ตรวจช่อง “วันที่” แล้วกดยืนยันอีกครั้ง ·
          ถ้าต้องคีย์ย้อนหลังไกลกว่านี้ ให้แก้ค่า date.earliestYear ที่หน้าตั้งค่า
        </div>
      )}
      {/* The bare `return` this replaces (ใบ 080): neither control carries `required`, so a click
          on a row with nothing filled in used to do nothing at all — indistinguishable from a
          successful ยืนยัน. Both fields are named because the refusal is one condition. */}
      {err === "need" && (
        <div className="card-warn text-sm">
          ⚠️ ต้องระบุ<b>ทั้งวันที่และผู้สอน</b>ให้ครบก่อนถึงจะยืนยันได้ —{" "}
          <b>ยังไม่มีอะไรถูกบันทึก</b> กรอกช่องที่ยังว่างในแถวนั้น แล้วกดยืนยันอีกครั้ง
        </div>
      )}
      {/* Also a bare `return` until ใบ 080. Reachable from an ordinary second tab, not only from a
          crafted post — so the copy says what changed and what to do, not that something is wrong. */}
      {err === "stale" && (
        <div className="card-warn text-sm">
          ⚠️ คาบนี้<b>ถูกตรวจไปแล้ว</b> (อาจจากอีกแท็บหรืออีกคน) จึงยืนยันซ้ำไม่ได้ —{" "}
          <b>ไม่มีอะไรถูกบันทึกเพิ่ม</b> โหลดหน้านี้ใหม่เพื่อดูของจริง ·
          ถ้าวันที่หรือผู้สอนที่บันทึกไว้ผิด ต้องแก้ที่งวดนั้น
        </div>
      )}
      {err === "closed" && (
        <div className="card-warn text-sm">
          <b>บางคาบแก้ไม่ได้ เพราะงวดของมันปิดไปแล้ว</b> — สลิปที่อนุมัติหรือจ่ายแล้วจะ
          <b>ไม่ถูกคำนวณใหม่</b> ⇒ กดข้ามไม่ได้เงินคืน แต่จะทำให้คำเตือนหายไปเฉย ๆ ซึ่งแย่กว่าเดิม ·
          ต้องแก้ที่งวดนั้นก่อน (ใบ 013)
        </div>
      )}
    </>
  );
}
