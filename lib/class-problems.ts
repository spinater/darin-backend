/**
 * The identity and the storage shape of **a Gymmo row that did not become a `ClassSession`**
 * (task 064) — everything that decides *what is written* about an import problem, and nothing that
 * writes it.
 *
 * 🔴 **Pure on purpose — this file must never import `./db`.** Same rule and same reason as its two
 * siblings `lib/gymmo-import.ts` and `lib/ot-import.ts`: `lib/db.ts` builds a `PrismaClient` at
 * module scope from `DATABASE_URL`, which does not exist during `bun test` (stage 4 of
 * `scripts/check-code.sh` runs before the throwaway postgres). The only test lane there is has no
 * database, so every decision that can move money must be decidable without one. The I/O halves are
 * `lib/class-problems-run.ts` (the queue's reads) and, for the write, `applyGymmoImport`'s transaction
 * in `lib/gymmo-import-run.ts`. ⚠️ Neither may be re-exported from here — a barrel across that
 * boundary would drag `lib/db.ts` into every test that only wanted a key.
 *
 * 🔴 **Nothing here is a number of baht, and nothing here may become one** (§2 rules 2 and 3). The
 * only thing that turns a คาบ into an amount is `computePayslip`, over `ClassSession` rows — which
 * by definition do not exist for any key this module produces.
 */
import type { GymmoReadProblem } from "./gymmo";

/**
 * One row that did not become a `ClassSession`. It is **never** dropped and never guessed, and it
 * never fails the rest of the file (§2 rule 4 · §2 rule 6).
 *
 * `where` and `reason` are the two the screen renders: `reason` is the Thai sentence `lib/gymmo.ts`
 * or `lib/gymmo-map.ts` already produces, rendered as it is and not re-translated. They keep their
 * names and their plain-string types so `GymmoImportPreview`/`GymmoImportResult` still cross a
 * server-action boundary unchanged.
 *
 * The rest is what task 064 added so the problem can **outlive the request**: `key` is its identity
 * in `ClassImportProblem`, and the display columns are what a foreign key would have joined to if
 * there were anything to join to (there is not — that is the definition of this row).
 */
export type ClassProblemRef = {
  /** `"<sheet> แถว <n>"` — the label the screen renders. Stored as `rowLabel`, never as `where`. */
  where: string;
  /**
   * `ClassImportProblem.key`. One of three `JSON.stringify`d shapes, kept apart by **arity**:
   *
   * | arity | shape | when |
   * |---|---|---|
   * | 4 | `[normTrainer, "YYYY-MM-DD", timeText, rawClassName]` | the row reached the planner |
   * | 3 | `[sheetName, rowText, rawWhen]` | the reader rejected the row |
   * | 1 | `[sheetName]` | the reader rejected a whole sheet |
   *
   * 🔴 **The 4-arity shape is produced by calling `gymmoSourceKey` itself** (in
   * `lib/gymmo-import.ts`), never re-derived here or anywhere else. See `kind` below for what one
   * byte of drift costs.
   */
  key: string;
  /**
   * `"session"` — the key **is** a `ClassSession.sourceKey`, so an import that writes that คาบ into
   * an **open** period deletes this problem in the same transaction, with no manual step. ·
   * `"duplicate"` — also a real `sourceKey`, but the file contains **two** rows for it with
   * different head counts, so the existence of a `ClassSession` under that key proves nothing about
   * the amount (see `pendingClassImportInPeriod`: a `"duplicate"` is never excluded). ·
   * `"row"` — the reader never got a `sourceKey`, so **nothing clears this row**: no import can ever
   * match it, and task 066's dismissal is its only exit.
   *
   * 🔴 For the first two, the clearing is a keyed `deleteMany`, so `key === gymmoSourceKey(row)` is
   * the entire mechanism. One byte of drift and it never matches: a คาบ that has been fixed stays
   * queued for ever, and `/payslips` blocks a period that is in fact clean — a permanent blocker
   * count is a count people learn to ignore.
   */
  kind: "session" | "duplicate" | "row";
  /** The trainer **as the file spelled it** — never the normalized half of the key. */
  trainerSheet: string;
  /** The raw class name, as keyed. `null` for a reader reject. */
  className: string | null;
  /** UTC calendar day. `null` **only** when the date was the unreadable part, or for a whole sheet. */
  date: Date | null;
  timeText: string | null;
};

export type GymmoProblem = ClassProblemRef & { reason: string };

/**
 * The `Payslip.period` string a UTC date falls in (`"2026-08"`).
 *
 * One home for the month convention on this path — `gymmoPlanPeriods`, `closedSlipOutcome` and
 * `pendingClassImportInPeriod` all have to agree with `periodRange` in `lib/payroll-run.ts` about
 * which month a คาบ belongs to, and this is the leaf module all three can import without dragging
 * `./db` into `bun test`. It is deliberately **not** `periodRange`'s inverse by coincidence: the run
 * buckets by UTC month and `lib/gymmo.ts` stores UTC midnight, which is the whole reason the clock
 * is kept out of `ClassSession.date`.
 */
export const utcPeriodOf = (d: Date): string => d.toISOString().slice(0, 7);

/** Exactly the columns of one `ClassImportProblem`, as `createMany` takes them. */
export type ClassImportProblemRow = {
  key: string;
  kind: string;
  rowLabel: string;
  reason: string;
  trainerSheet: string;
  className: string | null;
  date: Date | null;
  timeText: string | null;
};

/**
 * The stored identity of something `lib/gymmo.ts` could not read.
 *
 * **Arity is the discriminator, and it is load-bearing.** A whole-sheet reject is `[sheetName]` and a
 * row reject is `[sheetName, rowText, rawWhen]`, so a row whose `#` cell is **blank** still keys to
 * three elements and cannot collide with `["ชีต"]`. Neither can collide with a planner key, which
 * always has four. That is the same decodability argument `gymmoSourceKey` rests on: `JSON.parse`
 * returns the exact tuple, so two keys are equal only when their tuples are.
 *
 * 🔴 **`rawWhen` is in the key because `#` alone is NOT an identity across exports** (fix round).
 * Gymmo's `#` restarts at 1 in every export, so `[sheet, "14"]` names one คาบ in the August file and
 * a different one in the September file: uploading the second would `deleteMany` the first file's
 * still-true problem and write an unrelated row's reason under that key. That is T3's silent loss
 * reached through a key that is not an identity rather than through a date range, and it was fixed
 * while the table was still empty. The raw `Date & Time` cell is the one field on a rejected row that
 * says *which* คาบ even when it cannot be parsed, which is exactly the property a key needs.
 *
 * ⚠️ `rowText` and `rawWhen` are the cells **verbatim** and are not defaulted the way the label is
 * (`"?"`): the label is for a human, the key is an identity. Two rejects that genuinely share all
 * three fields do merge onto one **stored row** — see `gymmoProblemRows`, which joins their reasons
 * rather than losing one to P2002.
 */
export function readProblemKey(p: GymmoReadProblem): string {
  return JSON.stringify(
    p.rowText === null ? [p.sheetName] : [p.sheetName, p.rowText, p.rawWhen ?? ""],
  );
}

/**
 * The label `lib/gymmo.ts` used to render inline, rebuilt from the structured problem — so
 * `` `${readProblemLabel(p)}: ${p.reason}` `` is byte-identical to the string that module emitted
 * before task 064 made these storable.
 */
export function readProblemLabel(p: GymmoReadProblem): string {
  return p.rowText === null ? p.sheetName : `${p.sheetName} แถว ${p.rowText || "?"}`;
}

/**
 * A reader reject, in the planner's own problem shape — so one list carries every row that did not
 * become a คาบ, the reader's and the planner's alike.
 *
 * 🔴 **`kind: "row"` means NO import can ever clear this row — not "the reader has to succeed first".**
 * The reader's key is the 3-tuple above; the same คาบ, once it parses, is written under a **4-tuple**
 * `sourceKey`, so the `deleteMany` cannot match and the arity-3 row survives its own repair. Fixing
 * the cell and re-uploading therefore leaves the problem listed for ever, and task 066's dismissal is
 * its **only** exit. ⇒ never write, in a comment or on a screen, that a re-upload makes it disappear.
 *
 * `date` is carried through, because three of the four row rejects happen *after* `parseGymmoWhen`
 * succeeded and a `null` date is counted in **every** period for ever. `className`/`timeText` stay
 * `null`: the reader stopped before it had them. The sheet name stands in for `trainerSheet` because
 * in this export a sheet *is* a trainer, and it is the only thing a human has to go on.
 */
export function toGymmoProblem(p: GymmoReadProblem): GymmoProblem {
  return {
    where: readProblemLabel(p),
    reason: p.reason,
    key: readProblemKey(p),
    kind: "row",
    trainerSheet: p.sheetName,
    className: null,
    date: p.date,
    timeText: null,
  };
}

/**
 * 🔴 **What a closed payslip means for the คาบ this import just handled** (task 064 fix round, twice).
 *
 * `runPayroll` **refuses to recompute a non-draft slip** (task 013) and no screen reopens one, so the
 * question "was this คาบ actually paid" is not answered by "does a `ClassSession` exist". Both
 * directions of getting it wrong are money, and both were shipped once:
 *
 * | this import | slip | answer | what getting it wrong costs |
 * |---|---|---|---|
 * | `create`/`update` | closed | **a problem** under the same key | ประพัฒน์ (`baseSalary: 0`, `classCredit: 0`), 20 `Pilates Flow` คาบ in 08/2026 ⇒ `classPay = max(0, 8000 − 0) = 8,000 ฿`, his **entire month**. The first cut deleted all twenty problem rows on the very import that wrote them and left `/payslips?period=2026-08` reading `คาบรอตรวจ 0` **and** `คาบนำเข้าไม่ได้ 0` — "reported once and then vanished", reproduced inside this card's own write |
 * | `create`/`update` | open | cleared | a stale reason outliving its repair |
 * | `unchanged` | open | cleared | as above |
 * | 🔴 `unchanged` | closed | **left exactly as found** | ธันยา (`โอ`, `classCredit: 5000`), 08/2026, 24 คาบ, class value 8,050 ⇒ `classPay = 3,050 ฿`, slip `paid`. In October the admin re-uploads the Jan–Sep workbook to pick up September — the flow `lib/gymmo-import-run.ts`'s header mandates — and August contributes `created: 0, updated: 0, unchanged: 24`. The second cut manufactured **24 rows saying those คาบ are ยังไม่ถูกจ่าย**, about คาบ paid inside that 3,050 ฿. They are `kind: "session"` with a closed slip so the count never excludes them, every later import re-creates them, and 066 leaves no dismissal ⇒ five paid months carry permanently non-zero false counts and **ประพัฒน์'s twenty genuinely unpaid rows become indistinguishable from them** |
 *
 * ⇒ **`unchanged` means nothing was written** — the คาบ was in `ClassSession` before this import — so a
 * closed slip beside it is overwhelmingly likely to be the slip that **paid** it. Such a key is
 * therefore reported in `leaveAlone` and **kept out of the caller's delete set entirely**. That is not
 * the same as "no problem": ⚠️ dropping it from the problems while leaving it in `touched` would delete
 * a *true* closed-slip row an earlier import had recorded and not re-insert it — trading a false
 * positive for a **false negative, in the money direction**. Leaving the key untouched does both jobs
 * at once, and needs no extra query.
 *
 * Reachability check for the surviving row — and it is **not** only the closed-slip row. Usually it is:
 * an unmatched-class or unmatched-trainer reason does not survive to this state, because the import that
 * resolved it saw `create` and deleted the key. But a row recorded **while the `ClassSession` already
 * existed** does survive, with a reason that has since gone stale. Two reachable shapes, both verified by
 * `payroll-auditor`:
 *
 *   1. June: the คาบ imports, slip later `paid`. July: the `TrainerAlias` is deleted at `/admin/config`
 *      and the same workbook is re-uploaded — `gymmoSourceKey` needs no alias, so the key is identical —
 *      `matchTrainer` fails and a `"session"` row lands under it. August: the alias is restored to the
 *      same `staffId` ⇒ the key is a write again, all five compared fields match ⇒ `unchanged` + closed
 *      ⇒ July's row is left alone for ever, saying a trainer is unknown who is not.
 *   2. The same shape through the duplicate rule: an earlier import writes the คาบ, a later file
 *      duplicates that row (`"duplicate"` recorded, `ClassSession` already present), the duplicate is
 *      then removed from the file ⇒ `unchanged` + closed ⇒ the `"duplicate"` row is stranded.
 *
 * 🔑 **This does not make "leave as found" the wrong rule.** Re-inserting instead would put an
 * affirmative *"ยังไม่ถูกจ่าย"* on a คาบ that **was** paid — a false claim about money, which is strictly
 * worse than a stale reason. Telling the true survivor from the stale one needs the stored row's `kind`
 * read before the delete, which is a third shape nobody has asked for. So: this rule manufactures
 * nothing and preserves the money-critical case exactly; the stale row's whole cost is a stuck count in
 * an already-closed month, no baht in either direction. Its exits are the same as every other residual —
 * reopen the slip and re-upload, or card 066.
 *
 * Nothing is refused: the คาบ was taught, the row is true, the non-draft lock means no baht moves either
 * way, and the คาบ waits for the slip to be reopened — the policy half, open with linus as **card 013
 * item 2** (`paid → draft`). A closed-slip row therefore **does** clear once the slip is reopened and the
 * file re-uploaded, unlike a reader reject.
 *
 * 🔑 **Keyed by (staffId, period), never by period alone.** `Payslip` is `@@unique([staffId, period])`,
 * and an admin approves slips one at a time on `/payslips`, so a month routinely holds one trainer's
 * `approved` beside another's `draft`. A period-level test would flag every คาบ of that month, including
 * ones the next run really will pay.
 *
 * Pure, and **the whole four-quadrant decision lives here rather than at the call site** — the defect in
 * the table above survived two reviews precisely because it sat in the reviewed-not-pinned transaction.
 * `entries` pairs each write's display ref with that write's `staffId` and whether this import actually
 * wrote it; `ClassProblemRef` deliberately stores no `staffId` (the schema comment says why), so it is
 * supplied here rather than carried into the table.
 */
export function closedSlipOutcome(
  entries: readonly { ref: ClassProblemRef; staffId: string; written: boolean }[],
  /** staffId → period → the non-draft status of that slip. */
  closedByStaff: ReadonlyMap<string, ReadonlyMap<string, string>>,
): { problems: GymmoProblem[]; leaveAlone: string[] } {
  const problems: GymmoProblem[] = [];
  const leaveAlone: string[] = [];
  if (!closedByStaff.size) return { problems, leaveAlone };

  for (const { ref, staffId, written } of entries) {
    // A write always has a date (`GymmoSessionWrite.date` is non-null); the guard is for the type.
    if (!ref.date) continue;
    const status = closedByStaff.get(staffId)?.get(utcPeriodOf(ref.date));
    if (!status) continue;
    if (!written) {
      leaveAlone.push(ref.key);
      continue;
    }
    problems.push({
      ...ref,
      reason: `คาบนี้เข้าฐานข้อมูลแล้ว แต่สลิปงวด ${utcPeriodOf(ref.date)} ของคนนี้เป็น ${status} อยู่ ⇒ runPayroll จะไม่คิดสลิปใบนั้นใหม่ คาบนี้จึง**ยังไม่ถูกจ่าย** · ต้องเปิดสลิปกลับเป็นร่าง คำนวณใหม่ แล้วนำเข้าไฟล์ซ้ำ แถวนี้จะหายเอง (ใบ 013 ข้อ 2 — ยังรอ linus)`,
    });
  }
  return { problems, leaveAlone };
}

/**
 * The rows one import writes to `ClassImportProblem` — **deduplicated by `key`, merging rather than
 * dropping**, in first-appearance order.
 *
 * 🔴 **The merge is load-bearing, not cosmetic.** Two problems really do share one key, twice:
 *
 * 1. the in-file duplicate rule in `planGymmoImport` pushes **two** problems (one per offending row,
 *    each naming the other) for **one** `sourceKey`;
 * 2. two reader rejects that share **all three** reader-key cells — same sheet, same `#`, same raw
 *    `Date & Time`. ⚠️ Narrower than it was before the key became arity 3: a blank `#` alone no longer
 *    collides, since the raw when-cell still separates two different rows. The duplicate rule above is
 *    what keeps this merge load-bearing rather than theoretical.
 *
 * Without this, `createMany` throws **P2002 and the whole import transaction aborts** — a file that
 * imported yesterday fails on every attempt today because one row in it is duplicated. Dropping the
 * second instead would throw away half the evidence about the thing the human has to look at, which
 * is the §2 rule 4 failure one level down.
 *
 * `rowLabel` and `reason` are the **distinct** values joined ` · `, so nothing is lost and a repeated
 * reason is not repeated on screen. Every other column comes from the **first** problem with that
 * key: they are display columns of one and the same คาบ, and where they can differ at all
 * (`trainerSheet` — `ธันยา มูลละคร` and `PT ธันยา มูลละคร` normalize to one key half) either spelling
 * is a true answer to "what does the file call this person".
 *
 * Order is first-appearance, which makes the output a deterministic function of the plan — the
 * reader's rejects first, because `planGymmoImport` puts them first.
 */
export function gymmoProblemRows(problems: readonly GymmoProblem[]): ClassImportProblemRow[] {
  const byKey = new Map<
    string,
    { row: ClassImportProblemRow; labels: Set<string>; reasons: Set<string> }
  >();

  for (const p of problems) {
    const seen = byKey.get(p.key);
    if (seen) {
      seen.labels.add(p.where);
      seen.reasons.add(p.reason);
      continue;
    }
    byKey.set(p.key, {
      row: {
        key: p.key,
        kind: p.kind,
        rowLabel: p.where,
        reason: p.reason,
        trainerSheet: p.trainerSheet,
        className: p.className,
        date: p.date,
        timeText: p.timeText,
      },
      labels: new Set([p.where]),
      reasons: new Set([p.reason]),
    });
  }

  return [...byKey.values()].map(({ row, labels, reasons }) => ({
    ...row,
    rowLabel: [...labels].join(" · "),
    reason: [...reasons].join(" · "),
  }));
}
