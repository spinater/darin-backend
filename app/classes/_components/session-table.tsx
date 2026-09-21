import { decodeGymmoSourceKey } from "@/lib/gymmo-import";
import { SubmitButton } from "@/app/_components/submit-button";

/**
 * One row of the คาบ table. `sourceKey` is the **provenance flag** (task 063's
 * `ClassSession.sourceKey`) — `null` is hand-keyed, anything else came from a Gymmo file.
 */
export type SessionRow = {
  id: string;
  date: Date;
  className: string;
  staffName: string;
  booked: number;
  noShow: number;
  sourceKey: string | null;
};

/**
 * The คาบ of one period.
 *
 * 🔴 **An imported row shows where it came from and is NOT offered a delete** (card 065). Deleting
 * one is undone by the next upload — `sourceKey` is how `diffGymmoPlan` recognises a คาบ it has
 * already written, so a deleted key is a key the file has never been seen to carry ⇒ it is planned
 * as a `create` and the คาบ comes back, beside whatever the admin keyed by hand to replace it.
 * Measured on ธันยา's 4 Aug 18:00 Core Strength, **200 ฿** in §1.4's price table: **200 + 200 =
 * 400 ฿ for one 200 ฿ คาบ**, repeated every month the same Jan–Sep file is re-uploaded.
 *
 * §2 rule 6 is the general form: the sheet (here, Gymmo) is the source of truth for input, so a
 * screen must not offer an edit that the next sync silently reverts. Hiding the button is the
 * **copy**; `del` in `page.tsx` refuses the same row, because a hidden button is not a guard.
 *
 * 🔴 **The refusal is the default, not a dead end** (`payroll-auditor`, round 4). *"The next upload
 * re-creates it"* holds only while the **file still carries that key**: `diffGymmoPlan` plans a
 * `create` for keys *in the file*, so a row the file no longer mentions is never re-created — and
 * this action is the **only** `classSession.delete` in the repo, so refusing it unconditionally left
 * such a row with no repair anywhere in the product. Measured: correct 4 Aug `18:00 → 18:30` in
 * Gymmo and re-upload, and ธันยา's August holds both คาบ ⇒ class value 8,050 → 8,250 ⇒ `classPay`
 * **3,050 → 3,250 ฿, 200 ฿ overpaid on a draft slip, every run, for ever** — while the banner told
 * the admin that deleting it would be undone, which is false about that row. So the delete is behind
 * a disclosure that states the condition and makes the click deliberate, rather than absent.
 */
/**
 * The `ที่มา` cell — and for an imported row it **must carry the clock**.
 *
 * 🔴 `ClassSession` has no time column: 18:00 and 18:30 of one class on one day are two rows that
 * differ in no rendered cell. That is fine until something asks the admin to choose between them,
 * which the disclosure below does — so the key is decoded and its `timeText` and the file's own class
 * name are shown. Without it the choice is 50/50 and the wrong half is restored by the next upload
 * at 200 ฿ a month (`payroll-auditor`, card 065 round 5).
 */
function source(sourceKey: string | null): string {
  if (sourceKey === null) return "คีย์เอง";
  const parts = decodeGymmoSourceKey(sourceKey);
  // The fallback says the clock is **unreadable** rather than omitting it, because the disclosure
  // below tells the reader to compare that value against the file — a cell that silently drops it
  // points at something that is not there. Unreachable while `gymmoSourceKey` is the only writer.
  return parts
    ? `นำเข้าจาก Gymmo · ${parts.timeText} · ${parts.className}`
    : "นำเข้าจาก Gymmo · อ่านเวลาจากคีย์ไม่ได้";
}

export function SessionTable({
  rows,
  del,
}: {
  rows: SessionRow[];
  del: (formData: FormData) => Promise<void>;
}) {
  return (
    <table className="card w-full">
      <thead>
        <tr>
          {["วันที่", "คลาส", "ผู้สอน", "จอง", "no-show", "เข้าจริง", "ที่มา", ""].map((h) => (
            <th key={h} className="th">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="td">{r.date.toISOString().slice(0, 10)}</td>
            <td className="td">{r.className}</td>
            <td className="td">{r.staffName}</td>
            <td className="td">{r.booked}</td>
            <td className="td">{r.noShow}</td>
            <td className="td">{r.booked - r.noShow}</td>
            <td className="td text-xs">{source(r.sourceKey)}</td>
            <td className="td">
              {r.sourceKey === null ? (
                <form action={del}>
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton className="btn-ghost" pendingLabel="กำลังลบ…">
                    ลบ
                  </SubmitButton>
                </form>
              ) : (
                <div className="text-xs text-neutral-500">
                  แก้ยอดคนที่ Gymmo แล้วนำเข้าใหม่
                  <br />
                  (ห้ามแก้วันที่/เวลา/ชื่อคลาส — คาบเดิมจะค้าง)
                  {/* 🔴 A separate `<form>` with its own `confirm` field — never the same post as the
                      hand-keyed delete. `del` refuses without it, so the two-step is the guard and
                      this disclosure is only what makes the step reachable. */}
                  <details className="mt-1">
                    <summary className="cursor-pointer">ลบทั้งที่นำเข้ามา</summary>
                    <p className="mt-1">
                      ลบได้เฉพาะคาบที่<b>ไฟล์ไม่มีแถวนี้แล้ว</b> (เช่น แก้วันที่/เวลา/ชื่อคลาสใน
                      Gymmo ไปแล้ว คาบเดิมจึงค้าง) · ถ้าไฟล์ยังมีแถวนี้อยู่
                      <b>การนำเข้ารอบหน้าจะสร้างคืน</b> · 🔴{" "}
                      <b>เทียบ “เวลา” ในคอลัมน์ “ที่มา” กับไฟล์ Gymmo ก่อนลบ</b> —
                      สองคาบของวันเดียวกันต่างกันแค่เวลา ลบผิดตัวแล้วรอบหน้าจะได้คืนมาเหมือนเดิม
                    </p>
                    <form action={del} className="mt-1">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="confirm" value="imported" />
                      <SubmitButton className="btn-ghost" pendingLabel="กำลังลบ…">
                        ยืนยันลบคาบที่นำเข้ามา
                      </SubmitButton>
                    </form>
                  </details>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
