/**
 * **The Thai a reader acts on, for one stored import problem** — pure, so the `(kind, state)` grid
 * can be pinned by `bun test` with no database (card 065 round 2).
 *
 * 🔴 **It is here rather than in the component because it is the surface both review lanes BLOCKed
 * on, twice, and nothing was watching it.** Round 1: the exit text was keyed on `kind` alone, so a
 * คาบ sitting on a closed slip was told *"แก้ต้นทางแล้วนำเข้าซ้ำ"* — an instruction `applyGymmoImport`
 * guarantees will not clear it (`leaveAlone`), while *"ไม่มีอยู่ในฐานข้อมูล"* beside it invited the
 * admin to key it in by hand, i.e. ประพัฒน์'s 8,000 ฿ paid twice. Round 2: the same shape through the
 * third `kind`. Both were reachable only by reading, because a `.tsx` string has no pin. Every cell
 * of the grid now has one, in `lib/class-problems-copy.test.ts`.
 *
 * ⚠️ **Thai here is a product string** (CLAUDE.md §2.5 — UI copy stays Thai) and is rendered as
 * **plain text**, so no markdown: emphasis is “…”, never `**…**`.
 */
import type { ClassProblemState } from "./class-problems";

/** One stored problem row, reduced to the two fields the copy depends on. */
export type ProblemCopyInput = { kind: string; state: ClassProblemState | null };

/**
 * **Is this row done with?** — `true` for exactly one of the twelve `(kind, state)` cells.
 *
 * 🔴 **One home, called by the count AND by the screen** (`payroll-auditor`, round 3). They are the
 * same rule and they drifted the moment they were written twice: `pendingClassImportInPeriod` was
 * keyed on `kind` **and** `state` while `import-problems.tsx` bucketed on `state` alone, so a
 * `"duplicate"` whose คาบ resolves to `"accountedFor"` was **counted as blocking and displayed as
 * resolved** — filed into a fold labelled "คลี่คลายแล้ว", its stored `reason` suppressed, and the two
 * strings written the round before to warn about exactly that row turned into dead code with a green
 * pin over them. When such a row is a period's only problem, `/payslips` reads *"1 คาบ"* and the
 * screen it links to prints **`ไม่มีแถวค้าง`** — the count nobody trusts, reached from the other side.
 *
 * Measured: 15 Aug 19:00 Aqua Fit (400 ฿, `class.minAttendees` 3, `class.halfRatio` 0.5) imported
 * once at 5/3 ⇒ attended 2 ⇒ **200 ฿**, then carried twice by the corrected export (9/0 and 5/3) ⇒
 * `"duplicate"` with the คาบ present and the slip still `draft`. The truth is 9/0 ⇒ **400 ฿**, the
 * queue row is the only artefact in the system saying the head count is disputed, and hiding it pays
 * the trainer **200 ฿ instead of 400 ฿** with nothing on the slip to look at (§2 rule 4).
 *
 * 🔑 **`kind` is half the predicate and may not be dropped.** A `"duplicate"`'s `ClassSession` proves
 * the คาบ exists, never that its **amount** is right — the two file rows disagree about precisely
 * that number. `"row"` can never resolve at all (ใบ 066).
 */
export const problemIsCleared = ({ kind, state }: ProblemCopyInput): boolean =>
  kind === "session" && state === "accountedFor";

/**
 * **Where the คาบ is right now** — the column that stops the stored `reason` being read as the whole
 * story, because that text is only ever a record of what the last import saw.
 *
 * 🔴 **`"duplicate"` may NOT claim the คาบ is absent.** `planGymmoImport` refuses both file rows, so
 * *this import* wrote nothing — but an earlier one may have written the key at a different head
 * count. Measured: 15 Aug 19:00 Aqua Fit imported as 5/3 ⇒ attended 2 < `class.minAttendees` ⇒ half
 * ⇒ 200 ฿; the corrected export carries it twice (9/0 and 5/3) ⇒ `"duplicate"`. Printing
 * *"ไม่เขียนทั้งคู่"* and telling the admin to trust that column has them key it by hand at 9/0 ⇒ 400 ฿
 * ⇒ **600 ฿ on the slip for one 400 ฿ คาบ**, and only the hand-keyed row is deletable.
 */
export function problemWhere({ kind, state }: ProblemCopyInput): string {
  if (kind === "row") return "อ่านไม่ออก — ไม่มีคาบ";
  if (state === "closedSlip") return "อยู่ในฐานแล้ว · สลิปงวดนั้นปิด";
  // 🔑 **`state` is tested before the `kind` fallback, not after.** The other order made
  // `session + accountedFor` read *"ยังไม่อยู่ในฐาน"* about a คาบ that is in the database — unreachable
  // only while the screen buckets that cell away, i.e. a false string one `filter` away from being
  // printed, which is how this module's whole reason for existing started.
  if (state === "accountedFor")
    return kind === "duplicate"
      ? "อยู่ในฐานแล้ว แต่ยอดคนอาจผิด — ห้ามคีย์ซ้ำ"
      : "อยู่ในฐานแล้ว · สลิปเปิด";
  if (kind === "duplicate") return "รอบนี้ไม่เขียนทั้งคู่";
  return "ยังไม่อยู่ในฐาน";
}

/**
 * **What actually closes this row** — by `kind` *and* by the state of its คาบ, never by `kind` alone.
 *
 * 🔴 `"row"` promises nothing (card 066). A reader reject is keyed `[ชีต, #, วันเวลา]` while the same
 * คาบ, once fixed, is written under a 4-tuple `sourceKey` ⇒ no import can ever match it and the row
 * survives its own repair. `app/payslips/page.tsx` was corrected in this direction at task 064; this
 * is the screen it links to and it names the same three categories.
 *
 * 🔴 **The `"closedSlip"` exit carries a caveat about the amount, for every row it covers.** The
 * state means "a `ClassSession` exists and its slip is non-draft" and that is true of two opposite
 * situations: ประพัฒน์'s twenty คาบ written *after* the slip closed (8,000 ฿ genuinely owed, reopening
 * is right) and a stale row left on a คาบ the slip already **paid** (`lib/class-problems.ts` records
 * two reachable shapes). Nothing stored tells them apart, and a recompute reads **today's** config:
 * raise Core Strength 200 → 250 at `/admin/config`, reopen ธันยา's `paid` 08/2026 and recompute, and
 * a slip transferred at 3,050 ฿ becomes 3,150 ฿ with nothing recording the 100 ฿ gap. So the exit
 * says *check the figure first* rather than pretending the distinction is available.
 * ⚠️ The alternative — a fourth `kind` written by `closedSlipOutcome` so the two are separable — is
 * deliberately **not** taken here: `pendingClassImportInPeriod`'s exclusion is keyed on `kind`, so a
 * new value silently changes the blocker count, and that is a card of its own.
 */
export function problemClears({ kind, state }: ProblemCopyInput): string {
  if (kind === "row") return "🔴 ไม่หายเองแม้แก้ไฟล์แล้ว — ยังไม่มีทางปิดแถวนี้ (ใบ 066 รอคำตอบ)";
  if (state === "closedSlip")
    return "คาบอยู่ในฐานแล้ว แต่สลิปงวดนั้นปิดไปแล้ว ⇒ นำเข้าซ้ำเฉย ๆ ไม่ทำให้หาย — ต้องเปิดสลิปกลับเป็นร่าง → คำนวณใหม่ → แล้วนำเข้าไฟล์ซ้ำ · ⚠️ ตรวจยอดค่าสอนคลาสของสลิปนั้นก่อนเปิดกลับ เพราะการคำนวณใหม่ใช้เรทของวันนี้ ยอดอาจไม่เท่าที่จ่ายไปแล้ว";
  if (kind === "duplicate")
    return "ไฟล์มีสองแถวที่เป็นคาบเดียวกันแต่ยอดคนไม่ตรง จึงไม่เขียนทั้งคู่ — แก้ไฟล์ให้เหลือแถวเดียวแล้วนำเข้าซ้ำ · ถ้าเคยนำเข้ารอบก่อน คาบอาจอยู่ในฐานแล้วที่ยอดคนผิด ห้ามคีย์ซ้ำ";
  // 🔴 The last clause is not decoration. The hand-key form sits on the same page, so "the คาบ is
  // missing" invites keying it in as a workaround; fixing the price and re-importing then writes the
  // imported row **beside** the hand-keyed one (a null `sourceKey` is exempt from `@unique`) and the
  // engine pays both — 200 + 200 on a Core Strength. `gymmoHandKeyedMatches` catches that at preview
  // only when the (day, staff, class) triple matches, so this is the same hole from the other end.
  return "แก้ต้นทาง (ราคาคลาส / ผูกชื่อเทรนเนอร์) แล้วนำเข้าไฟล์เดิมซ้ำ ⇒ แถวนี้หายเอง · ถ้าคีย์คาบนี้เองไปแล้ว ต้องลบแถวที่คีย์เองก่อนนำเข้า ไม่งั้นจะได้สองแถวและจ่ายสองเท่า";
}
