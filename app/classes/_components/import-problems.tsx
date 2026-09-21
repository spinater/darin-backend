import { problemClears, problemIsCleared, problemWhere } from "@/lib/class-problems-copy";
import type { ClassImportProblemView } from "@/lib/class-problems-run";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

/**
 * The per-row reasons behind the blocker count on `/` and `/payslips` (task 064 · card 065).
 *
 * Those two screens say *"N คาบจากไฟล์ Gymmo ที่ยังไม่ได้เข้าฐานข้อมูล"* and link here, so until this
 * table existed the link led to a screen showing none of them — and a blocker count people have
 * learned to ignore is worse than no count.
 *
 * ⚠️ **`เหตุผลตอนนำเข้า` is history, not a live claim, and the column header says so.** Whenever a
 * `ClassSession` exists under the key — `state` `"closedSlip"` or `"accountedFor"` — the stored text
 * is suspect by construction: `lib/class-problems.ts` records two reachable shapes where an
 * `unchanged` + closed-slip row is left carrying a reason that has stopped being true (delete a
 * `TrainerAlias`, re-upload, restore it). ธันยา's 08/2026 slip is `paid` at **3,050 ฿** and the
 * stranded row says *"ไม่รู้จักครู"* about a คาบ inside it. So the live answer is the `คาบอยู่ไหน`
 * column and the exit is `ทางปิดแถวนี้`, both computed from `state`; the reason is shown beside them
 * as the record of what the last import saw, and the intro says which to believe.
 *
 * ⚠️ **This table is every month, while the count that links here is one งวด** — deliberately, and
 * said out loud in the heading. `listClassImportProblems` is not period-scoped because a row's `date`
 * can be `null` (the unreadable part *was* the date), and such a row belongs to no month anybody can
 * name; filtering by period would hide exactly the rows with no other home. Two near-identical numbers
 * one click apart is a real cost, so the heading names the scope rather than leaving it inferred.
 *
 * 🔴 **A row whose problem has resolved is listed apart and its stored `reason` is NEVER printed.**
 * A closed-slip row says *"…ยังไม่ถูกจ่าย"*; the admin reopens the slip and recomputes, and nothing
 * deletes the row — `deleteMany` runs only inside `applyGymmoImport`, i.e. on the next upload. The
 * stored text then asserts that money just paid is unpaid, the opposite direction of §2 rule 4.
 * `state` is re-checked live against the database by `listClassImportProblems`, from the same helper
 * the blocker count uses.
 */
export function ImportProblems({ rows }: { rows: ClassImportProblemView[] }) {
  if (!rows.length) return null;
  // 🔴 `problemIsCleared`, never `state` alone — the count in `pendingClassImportInPeriod` calls the
  // same predicate, and when these two disagreed a `"duplicate"` row was counted as blocking and
  // displayed as resolved (`payroll-auditor`, round 3). One home, one answer.
  const live = rows.filter((r) => !problemIsCleared(r));
  const resolved = rows.filter((r) => problemIsCleared(r));

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">
        แถวจากไฟล์ Gymmo ที่ยังไม่เข้าที่ — ทุกงวดรวมกัน ({live.length})
      </h2>
      {live.length > 0 ? (
        <>
          <p className="text-xs text-neutral-500">
            ตัวเลขนี้นับ<b>ทุกเดือน</b> ส่วนตัวเลขที่หน้าสลิปนับเฉพาะงวดที่เลือก จึงไม่เท่ากันได้
            (ดูช่อง “วันที่” ว่าแถวไหนอยู่งวดไหน · <b>แถวที่ไม่มีวันที่ (—) นับอยู่ในทุกงวด</b>
            เพราะเดือนของมันคือส่วนที่อ่านไม่ออก) · <b>เชื่อช่อง “คาบอยู่ไหน” ก่อน</b> — ช่อง
            “เหตุผลตอนนำเข้า” คือข้อความที่บันทึกไว้ตอนนำเข้าครั้งล่าสุด
            แถวที่คาบอยู่ในฐานแล้วข้อความนั้นอาจเป็นของเก่าและไม่จริงแล้ว ·
            <b>แถวที่คาบอยู่ในฐานแล้ว ห้ามคีย์ซ้ำ</b> จะจ่ายสองเท่า
          </p>
          <table className="card w-full">
            <thead>
              <tr>
                {[
                  "แถวในไฟล์",
                  "ชีต (ครู)",
                  "คลาส",
                  "วันที่",
                  "เวลา",
                  "คาบอยู่ไหน",
                  "เหตุผลตอนนำเข้า",
                  "ทางปิดแถวนี้",
                ].map((h) => (
                  <th key={h} className="th">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {live.map((r) => (
                <tr key={r.key}>
                  <td className="td text-xs">{r.rowLabel}</td>
                  <td className="td text-xs">{r.trainerSheet}</td>
                  <td className="td text-xs">{r.className ?? "—"}</td>
                  <td className="td text-xs">{day(r.date)}</td>
                  <td className="td text-xs">{r.timeText ?? "—"}</td>
                  <td className="td text-xs">{problemWhere(r)}</td>
                  {/* 🔴 The stored reason is a record of what the last import saw, not a live
                      claim — a `"closedSlip"` row can be sitting on a คาบ the slip already **paid**
                      (`lib/class-problems.ts` records two reachable shapes) while still saying
                      *ยังไม่ถูกจ่าย*. The prefix marks it as history wherever a `ClassSession` exists;
                      the live answer is the `คาบอยู่ไหน` column beside it. */}
                  <td className="td text-xs">
                    {r.state !== null && r.state !== "missing" && (
                      <span className="text-neutral-500">(ข้อความตอนนำเข้า — อาจเป็นของเก่า) </span>
                    )}
                    {r.reason}
                  </td>
                  <td className="td text-xs">{problemClears(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="text-xs text-neutral-500">ไม่มีแถวค้าง</p>
      )}

      {resolved.length > 0 && (
        <details className="card text-xs">
          <summary className="cursor-pointer">
            อีก {resolved.length} แถวคลี่คลายแล้ว แต่ยังค้างอยู่ในตาราง
          </summary>
          {/* 🔴 The stored `reason` of these rows is deliberately not rendered — see the note on
              this component. What is true about them now is stated here instead, once. */}
          <p className="mt-2">
            คาบพวกนี้<b>อยู่ในฐานข้อมูลแล้ว</b> และสลิปงวดของคนนั้น<b>เปิดอยู่</b> ⇒
            รอบคิดเงินถัดไปจ่ายให้ · เหตุผลที่เก็บไว้ตอนนำเข้าเป็นของเก่าและไม่จริงแล้ว
            จึงไม่แสดงที่นี่ · แถวจะหายเองเมื่อนำเข้าไฟล์เดิมซ้ำอีกครั้ง
          </p>
          <ul className="mt-2 list-inside list-disc">
            {resolved.map((r) => (
              <li key={r.key}>
                {r.rowLabel} · {r.trainerSheet} · {r.className ?? "—"} · {day(r.date)}{" "}
                {r.timeText ?? ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
