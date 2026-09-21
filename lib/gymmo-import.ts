/**
 * Turn a parsed Gymmo worklog into a **write plan** for `ClassSession` (task 063).
 *
 * 🔴 **Pure on purpose — this file must never import `./db`.** `lib/db.ts` builds a `PrismaClient`
 * at module scope from `DATABASE_URL`, which does not exist during `bun test` (stage 4 of
 * `scripts/check-code.sh` runs before the throwaway postgres). Same reason as `lib/ot-import.ts`:
 * the only test lane there is has no database, so every decision that can move money must be
 * decidable without one. The I/O half is `lib/gymmo-import-run.ts`.
 *
 * The seam: `lib/gymmo.ts` reads cells → rows · `lib/gymmo-map.ts` answers *which staff* and
 * *which price* · **this file** answers *which rows may be written, and what must a human look at
 * first*. Nothing here computes money — `computePayslip` does, from the rows this plan creates.
 */
import type { GymmoParse, GymmoRow } from "./gymmo";
import { matchClassName, matchTrainer, readTrainerSheet } from "./gymmo-map";
import { normalizeTrainer } from "./normalize";

/** A `ClassPrice` row as this planner needs it — the name to match on, the id to write. */
export type ClassPriceRef = { id: string; name: string };

/**
 * One row that did not become a `ClassSession`. It is **never** dropped and never guessed, and it
 * never fails the rest of the file (§2 rule 4 · §2 rule 6).
 *
 * `reason` is the Thai sentence `lib/gymmo.ts` or `lib/gymmo-map.ts` already produces — rendered as
 * it is, not re-translated. Both fields are plain strings so the whole plan crosses a server-action
 * boundary unchanged.
 */
export type GymmoProblem = { where: string; reason: string };

/** What the caller writes: exactly the columns of one `ClassSession`, keyed by `sourceKey`. */
export type GymmoSessionWrite = {
  sourceKey: string;
  date: Date;
  classId: string;
  staffId: string;
  booked: number;
  noShow: number;
};

export type GymmoImportPlan = {
  /** Rows ready to upsert on `sourceKey`, in the order they were read. */
  writes: GymmoSessionWrite[];
  /** **The reader's rejected rows first, then this planner's** — one list for the whole import. */
  problems: GymmoProblem[];
  /**
   * `Type = PT` rows, which are **not** `ClassSession` rows — they are 1-on-1 sessions and come
   * from the Google Sheet through `lib/sync.ts`. Counted rather than silently dropped so the screen
   * can say *"198 แถวเป็น PT ไม่ใช่คลาส"*: they are excluded on purpose and are **not** problems,
   * and a count is what tells a reader that the export was fully accounted for.
   */
  ptRows: number;
};

/** The label `lib/gymmo.ts` already uses for a row in its own `problems[]` — one format, one home. */
const gymmoRowLabel = (row: Pick<GymmoRow, "trainerSheet" | "rowNo">) =>
  `${row.trainerSheet} แถว ${row.rowNo || "?"}`;

/**
 * One line of `GymmoParse.problems` (`"<sheet> แถว <n>: <reason>"`) split into the same two fields
 * the planner's own problems carry, so the screen renders every rejected row from one list.
 *
 * Split on the **first** `": "`, which is the separator `lib/gymmo.ts` writes; the `where` half it
 * builds never contains one. A sheet name that did would split early — the whole sentence still
 * reaches the screen, in the wrong column, which is why this is a formatting risk and not a money
 * one. (Structured problems at the reader would be the real fix and belong to that module's card.)
 */
function gymmoParseProblem(line: string): GymmoProblem {
  const at = line.indexOf(": ");
  return at < 0
    ? { where: "", reason: line }
    : { where: line.slice(0, at), reason: line.slice(at + 2) };
}

/**
 * The identity of one row of one Gymmo export: **trainer · date · time · raw class name**, as a
 * JSON array.
 *
 * 🔴 **JSON, not `a|b|c|d`, and that is the whole point.** A joined key is only injective while no
 * part can contain the separator, and both a sheet name and a class name are free text typed by
 * staff. Task 035 is this exact bug one module over: an activity name containing `|` collided with
 * the field encoding `rate|<activity>|<rank>` and overwrote a *different* activity's rate. Here a
 * collision is worse than a wrong screen — two different คาบ share one row, so one session vanishes
 * or one payment doubles, silently (§2 rule 4). A reachable pair that a `|` join merges and this
 * encoding keeps apart:
 *
 *   sheet `โอ|2026-08-01|07:15|Aqua Fit` · 2026-09-02 · `09:00` · `Body Pump`
 *   sheet `โอ` · 2026-08-01 · `07:15` · `Aqua Fit|2026-09-02|09:00|Body Pump`
 *
 * JSON is injective over string tuples because it is decodable: `JSON.parse(key)` returns the exact
 * 4-tuple, so two keys are equal only when their tuples are. `lib/gymmo-import.test.ts` pins both
 * the collision pair above and the round-trip.
 *
 * 🔴 **The trainer field is keyed through the SAME normalizer that decides who this is —
 * `normalizeTrainer(readTrainerSheet(name).name)` — and that is the load-bearing line here.**
 * `matchTrainer` resolves a sheet through `normalizeTrainer` (lower-cased, **all** whitespace
 * removed, a leading `pt`/`พี่` stripped) and `readTrainerSheet` first drops the `(Deleted)` marker
 * Gymmo appends when somebody leaves. Any variance those two absorb but the key does not is a
 * **silent duplication**, because resolution still succeeds ⇒ nothing reaches `problems`, every row
 * gets a fresh key, `diffGymmoPlan` reads `create`, and the คาบ already imported are paid a second
 * time with `warnings: []`. Measured on the shapes that actually occur: a leaver's sheet renamed to
 * `…(Deleted)`, an account re-typed `PT ธันยา มูลละคร`, or one extra space — each of them would have
 * re-created all 24 of ธันยา's August คาบ, taking her class value from 8,050 to 16,100 and her
 * `classPay` from **3,050 ฿ to 11,100 ฿ in one month**, and again for every other still-`draft`
 * month in the file. §2 rule 6: one spelling variant has one home, and identity may not use a
 * narrower rule than resolution. Two people whose names normalize equal are already paid into each
 * other by `matchTrainer` (and cannot both hold a `TrainerAlias`, whose `alias` is the primary key),
 * so sharing its rule adds no risk that resolution does not already carry.
 *
 * ⇒ **the stored key is not a display name** (`ธันยามูลละคร`, no spaces, lower-cased). If a screen
 * ever needs the trainer's name as the file spelled it, that is a second column, never the identity.
 *
 * **A class name is keyed RAW, and the asymmetry is deliberate.** Gymmo does not *decorate* a class
 * name the way it decorates a leaver's sheet — but ⚠️ it can still **rename** one: `lib/gymmo-map.ts`
 * carries `HIIT ROX` → `LESMILLS CEREMONY HYROX` precisely because linus renamed the class and Gymmo
 * has not caught up. The day it does, every historical คาบ of that class re-keys and is imported
 * again (4 คาบ a month at 400 ฿ = 1,600 ฿ twice for a trainer already over the credit), and the
 * signal for it is `importedInRangeNotInFile` in `lib/gymmo-import-run.ts`. Keying the *resolved*
 * name is still the wrong fix: `matchClassName` prefers an exact `ClassPrice` name over an alias, so
 * adding a price row spelled as Gymmo spells it would change the resolved name of every historical
 * คาบ — under a resolved-name key that is a re-key of the whole history, while under the raw key it
 * changes only `classId` and lands as a plain `update` on the one row.
 *
 * **The date is the UTC calendar day and the clock stays separate** — the export carries no
 * timezone and `lib/gymmo.ts` refuses to invent one, so folding `timeText` into the timestamp here
 * would re-introduce the month-boundary shift that module's header rejects.
 */
export function gymmoSourceKey(
  row: Pick<GymmoRow, "trainerSheet" | "date" | "timeText" | "className">,
): string {
  return JSON.stringify([
    normalizeTrainer(readTrainerSheet(row.trainerSheet).name),
    row.date.toISOString().slice(0, 10),
    row.timeText,
    row.className,
  ]);
}

/**
 * Plan what one loaded export would write. **No DB, no clock, no env** — the lookups are passed in.
 *
 * 🔑 **It takes the reader's whole `GymmoParse`, not just `parse.rows`.** `parseGymmoGrids` rejects
 * rows of its own (an unreadable date, an unknown `Type`, a missing class name) and those are rows
 * that never became a คาบ either — a caller handed only `rows` would drop them, and the screen built
 * from this plan would show an import as complete while a session sat unpaid (§2 rule 4).
 *
 * `aliasToStaffId` is keyed by `normalizeTrainer(...)`, exactly as `lib/sync.ts` keys it, and
 * `classPrices` is every `ClassPrice` row (not only the active ones): `computePayslip` reads
 * `class.price` with no regard for `active`, so hiding an inactive class here would report
 * *"ยังไม่มีราคาในระบบ"* about a price that exists.
 */
export function planGymmoImport(
  parse: GymmoParse,
  aliasToStaffId: ReadonlyMap<string, string>,
  classPrices: readonly ClassPriceRef[],
): GymmoImportPlan {
  const idByName = new Map(classPrices.map((c) => [c.name.trim(), c.id] as const));
  const names = [...idByName.keys()];

  const writes: GymmoSessionWrite[] = [];
  const problems: GymmoProblem[] = parse.problems.map(gymmoParseProblem);
  let ptRows = 0;
  /** sourceKey → the rows of THIS file that produced it (see the duplicate block below). */
  const byKey = new Map<string, { where: string; index: number }[]>();

  for (const row of parse.rows) {
    const where = gymmoRowLabel(row);
    if (row.kind === "pt") {
      ptRows++;
      continue;
    }

    const staff = matchTrainer(row.trainerSheet, aliasToStaffId);
    if (!staff.ok) {
      problems.push({ where, reason: staff.reason });
      continue;
    }
    const cls = matchClassName(row.className, names);
    if (!cls.ok) {
      problems.push({ where, reason: cls.reason });
      continue;
    }
    const classId = idByName.get(cls.className);
    // Unreachable while `matchClassName` answers from `names`, which is `idByName`'s own key set —
    // kept because the alternative is a non-null assertion, and a `!` here would become a
    // `classId: undefined` write the day those two lists stop being the same list.
    if (!classId) {
      problems.push({ where, reason: `ไม่พบรหัสราคาของคลาส "${cls.className}"` });
      continue;
    }

    const sourceKey = gymmoSourceKey(row);
    byKey.set(sourceKey, [...(byKey.get(sourceKey) ?? []), { where, index: writes.length }]);
    writes.push({
      sourceKey,
      date: row.date,
      classId,
      staffId: staff.staffId,
      // 🔴 **Verbatim, never clamped.** `noShow > booked` is unreadable input, and the engine says
      // so and pays nothing rather than guessing which of the two numbers is wrong (task 025,
      // `lib/payroll.ts`). Clamping here — or "fixing" it to 0 — hides the row from the one check
      // that exists to catch it.
      booked: row.booked,
      noShow: row.noShow,
    });
  }

  // 🔴 **Two rows of the SAME file that produce one `sourceKey` are a problem, not a last write.**
  // Inside the transaction they would upsert over each other and the survivor would be whichever
  // came last — a silent choice between two different attendance counts, i.e. §2 rule 4 with the
  // evidence thrown away. Neither is written: the planner cannot tell which row is the real one,
  // and both spellings reach the screen so a human can. (An existing row in the database keeps its
  // stored value; nothing here deletes.)
  const dropped = new Set<number>();
  for (const [sourceKey, hits] of byKey) {
    if (hits.length < 2) continue;
    const others = hits.map((h) => h.where).join(" · ");
    for (const hit of hits) {
      dropped.add(hit.index);
      problems.push({
        where: hit.where,
        reason: `แถวนี้ซ้ำกับแถวอื่นในไฟล์เดียวกัน (ชีต+วันที่+เวลา+ชื่อคลาสตรงกันหมด: ${others}) — ยังไม่นำเข้าทั้งคู่ เพราะเลือกแทนไม่ได้ว่ายอดคนของแถวไหนถูก · คีย์ ${sourceKey}`,
      });
    }
  }

  return {
    writes: dropped.size ? writes.filter((_, i) => !dropped.has(i)) : writes,
    problems,
    ptRows,
  };
}

/** A `ClassSession` row the database already holds, as the diff below compares it. */
export type ExistingSession = {
  sourceKey: string;
  date: Date;
  classId: string;
  staffId: string;
  booked: number;
  noShow: number;
};

/**
 * Split a plan against what the database already holds — **pure**, so "a second import of the same
 * file changes nothing" is decided here and pinned without a database (task 063 §4).
 *
 * `unchanged` is the number that matters on a re-import: it is not an optimisation but the
 * assertion itself — a row whose six columns are identical is not written at all, so a repeat
 * upload cannot touch a single `ClassSession`.
 */
export type GymmoPlanDiff = {
  create: GymmoSessionWrite[];
  update: GymmoSessionWrite[];
  unchanged: number;
};

export function diffGymmoPlan(
  plan: GymmoImportPlan,
  existing: readonly ExistingSession[],
): GymmoPlanDiff {
  const have = new Map(existing.map((e) => [e.sourceKey, e] as const));
  const diff: GymmoPlanDiff = { create: [], update: [], unchanged: 0 };

  for (const w of plan.writes) {
    const old = have.get(w.sourceKey);
    if (!old) {
      diff.create.push(w);
      continue;
    }
    const same =
      old.date.getTime() === w.date.getTime() &&
      old.classId === w.classId &&
      old.staffId === w.staffId &&
      old.booked === w.booked &&
      old.noShow === w.noShow;
    if (same) diff.unchanged++;
    else diff.update.push(w);
  }
  return diff;
}

/**
 * The UTC day range the plan writes into, as `[from, to)` — `null` when it writes nothing.
 *
 * Used by the two counts in `lib/gymmo-import-run.ts` that no constraint can produce: the คาบ in
 * this range keyed **by hand** (`sourceKey` is null, and a null is exempt from `@unique`, so an
 * import can add a second row for a session somebody already keyed — and `computePayslip` pays
 * both), and the คาบ in this range already **imported** whose key this file does not carry.
 */
export function gymmoPlanRange(plan: GymmoImportPlan): { from: Date; to: Date } | null {
  if (!plan.writes.length) return null;
  const times = plan.writes.map((w) => w.date.getTime());
  return {
    from: new Date(Math.min(...times)),
    to: new Date(Math.max(...times) + 86400000),
  };
}

/**
 * The payroll periods (`"2026-08"`) this plan writes into, sorted and deduplicated.
 *
 * `Payslip.period` is that exact string and the run buckets by UTC month, so this is the only way to
 * ask "which slips does this upload land on top of". It is **not** derivable from
 * `gymmoPlanRange` by the caller without repeating the month convention, which is why it lives here
 * beside the writes it reads.
 */
export function gymmoPlanPeriods(plan: GymmoImportPlan): string[] {
  const periods = new Set(plan.writes.map((w) => w.date.toISOString().slice(0, 7)));
  return [...periods].sort();
}
