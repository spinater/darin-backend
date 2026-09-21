/**
 * The thin database half of the Gymmo import (task 063) — everything that reads or writes, and
 * nothing that decides. Every decision is in `lib/gymmo-import.ts`, which is pure.
 *
 * 🔴 **No role check lives here.** `requireAdmin()` belongs to the page and the server action that
 * call these functions, exactly as `syncSources()` and `runPayroll()` leave it to `/sync` and
 * `/payslips` (CLAUDE.md §1 auth · `.docs/knowledge/ops/gates.md`: no gate watches this, so the
 * screen must). A caller that forgets it hands the whole class-pay path to any logged-in trainer.
 *
 * The flow the upload screen is expected to use:
 *
 *   parseGymmoGrids(grids)          — lib/gymmo.ts, pure
 *   → planGymmoImport(parse, …)     — lib/gymmo-import.ts, pure, with loadGymmoLookups() below
 *   → previewGymmoImport(plan)      — read-only: what would change, and what to look at first
 *   → (the human confirms)
 *   → applyGymmoImport(plan)        — one transaction
 *
 * 🔴 **Three fields of the preview must reach the screen before anything is written**, because each
 * one is money the database cannot refuse on its own: `problems` · `handKeyedMatches` (with its
 * residual `handKeyedUnmatchedInRange`) · `closedPeriods`. A confirm button that shows only the three
 * counts is not this contract — and **all three are on the result as well**, the latter two re-read
 * inside the transaction, so a screen that forgets them before the write cannot swallow them after it
 * either.
 *
 * 🔴 **On confirm, re-parse and re-plan — never round-trip the plan through a form field.**
 * `GymmoSessionWrite.date` is a real `Date`: a server action argument preserves it, but
 * `JSON.stringify` into a hidden input turns it into a string, and `diffGymmoPlan` then compares
 * `old.date.getTime()` against something that has no such method. The cheap, obvious shape is to
 * keep the uploaded file and run `parseGymmoGrids` → `planGymmoImport` again inside the confirm
 * action; the second plan is also the more honest one, since the lookup tables may have changed
 * while the human was reading the preview.
 */
import { closedSlipOutcome, gymmoProblemRows, utcPeriodOf } from "./class-problems";
import { readClosedByStaff } from "./class-problems-run";
import { db } from "./db";
import { gymmoHandKeyedMatches, type GymmoHandKeyedMatch } from "./gymmo-hand-keyed";
import {
  diffGymmoPlan,
  gymmoPlanPeriods,
  gymmoPlanRange,
  type ClassPriceRef,
  type ExistingSession,
  type GymmoImportPlan,
  type GymmoProblem,
} from "./gymmo-import";

/** The two lookup tables `planGymmoImport` needs, read in one round trip each. */
export async function loadGymmoLookups(): Promise<{
  aliasToStaffId: Map<string, string>;
  classPrices: ClassPriceRef[];
}> {
  const [aliases, classPrices] = await Promise.all([
    db.trainerAlias.findMany({ select: { alias: true, staffId: true } }),
    // Every price row, `active` included — see `planGymmoImport`'s doc comment: the engine reads
    // `class.price` without consulting `active`, so filtering here would report a price that
    // exists as missing.
    db.classPrice.findMany({ select: { id: true, name: true } }),
  ]);
  return {
    // `TrainerAlias.alias` is stored already normalized (`prisma/seed.ts`, `/admin/config`), which
    // is the key `matchTrainer` looks up — so nothing is re-normalized on this side.
    aliasToStaffId: new Map(aliases.map((a) => [a.alias, a.staffId] as const)),
    classPrices,
  };
}

/** A period this upload lands on whose slip is no longer `draft`. */
export type GymmoClosedPeriod = { period: string; status: string; rows: number };

/**
 * What the confirm screen shows **before** anything is written. Plain numbers and strings on
 * purpose: it crosses a server-action boundary and is rendered as it is.
 */
export type GymmoImportPreview = {
  /** คาบ that do not exist yet. */
  newCount: number;
  /** คาบ already imported whose attendance (or class, or trainer) changed in the file. */
  updateCount: number;
  /** คาบ already imported and identical — **not written at all** (task 063 §4). */
  unchangedCount: number;
  /** `Type = PT` rows, excluded by design and not a problem. */
  ptRows: number;
  /** Every row that did not become a คาบ — the reader's rejects and the planner's, in one list. */
  problems: GymmoProblem[];
  /**
   * The คาบ **keyed by hand** (`sourceKey = null`) that this upload would duplicate — **listed, not
   * counted** (card 065).
   *
   * 🔴 A hand-keyed row cannot collide with an imported one — a null is exempt from `@unique` — so
   * importing a month somebody already keyed by hand pays it **twice**, and no constraint says so.
   * The import cannot tell a duplicate from a different session, so it names the pairs and the human
   * decides (§2 rule 4). Empty in the ordinary case.
   *
   * ⚠️ Task 063 shipped this as `handKeyedInRange`, a count over the plan's whole `[min, max]` day
   * span — nine months for a Jan–Sep upload. "12 hand-keyed คาบ" beside "431 new คาบ" is true and
   * leaves the only choices *confirm blind* or *abandon*. The matching rule, and why its triple must
   * never become an import key, are on `gymmoHandKeyedMatches` in `lib/gymmo-hand-keyed.ts`.
   */
  handKeyedMatches: GymmoHandKeyedMatch[];
  /**
   * The hand-keyed คาบ in the same range that the list above does **not** claim — reported as a
   * second, separately-labelled number so the total signal can never drop to zero.
   *
   * 🔴 **The list is narrower than the count it replaced, and the gap is a real duplicate shape**
   * (`payroll-auditor`, card 065 review round). A match needs `staffId` **and** `classId` to agree,
   * and a human keying a คาบ from memory is exactly where they do not: a substitute keyed under the
   * person who taught it while the Gymmo sheet belongs to the class owner, or a class keyed against a
   * different `ClassPrice` than the raw Gymmo name maps to. Measured: 4 Aug 18:00 Core Strength
   * (200 ฿) on ธันยา's sheet — `โอ` **is** ธันยา, they are one person — keyed by hand under
   * ประพัฒน์, who actually taught it that day ⇒ the `staffId` half differs, the triple misses,
   * the confirm screen says nothing, both rows are written and `computePayslip` pays **200 ฿ twice,
   * one on each of two slips**, so neither slip looks wrong on its own. Nothing downstream catches
   * it — `importedInRangeNotInFile` is the opposite direction and the engine has no duplicate
   * detector.
   *
   * ⇒ the screen must render this as *"อีก N คาบที่คีย์เองอยู่ในช่วงนี้ที่ไฟล์ไม่แตะ — ตรวจว่าไม่ใช่คาบเดียวกัน
   * คนละครู/คนละคลาส"*. That restores exactly what the bare count bought without restoring its
   * unreadability: the actionable rows are named, the residual is one number beside them.
   */
  handKeyedUnmatchedInRange: number;
  /**
   * The mirror of the count above: คาบ inside the range that were **already imported and whose key
   * this file does not carry**.
   *
   * 0 on a first import and 0 on a re-upload of the same export. It is the only screen-side signal
   * for a `sourceKey` that has moved — a trainer or a class renamed in Gymmo, a month exported from a
   * different account — which otherwise lands as "N new คาบ" beside N orphans nobody sees. A whole
   * month appearing here before anyone confirms is the warning.
   *
   * 🔑 **Counted directly (`sourceKey notIn planKeys`), never as `imported − matched`.** The
   * subtraction looked equivalent and was not: the minuend is confined to the plan's day range while
   * `readExisting` matches keys with **no date filter**, so twelve rows whose `date` was hand-edited
   * to outside the range cancelled twelve in-range orphans — `100 − 100 = 0`, and ~4,800 ฿ about to be
   * duplicated showed as nothing. One query, one range, and no floor to defend.
   */
  importedInRangeNotInFile: number;
  /**
   * Periods this upload writes into whose payslip is **`approved` or `paid`**.
   *
   * 🔴 `runPayroll` refuses to recompute a non-draft slip (task 013), which means nothing wrong is
   * *paid* — the failure is the opposite and it is silent: a คาบ imported into a closed month is
   * reported as `created: 1`, and the next run skips that slip with a reason **no screen renders**
   * (`.docs/knowledge/domain/payslip-lifecycle.md`). The คาบ is in the database, in nobody's slip,
   * for ever. Whoever confirms has to see this first and reopen the slip deliberately.
   */
  closedPeriods: GymmoClosedPeriod[];
};

async function readExisting(
  client: Pick<typeof db, "classSession">,
  plan: GymmoImportPlan,
): Promise<ExistingSession[]> {
  // 🔑 The return type is `ExistingSession`, the type `diffGymmoPlan` compares — imported, never
  // re-declared structurally. A column added to the plan and to that type must go red **here**,
  // rather than leave the five-field compare quietly reporting `unchanged`.
  const rows = await client.classSession.findMany({
    where: { sourceKey: { in: plan.writes.map((w) => w.sourceKey) } },
    select: {
      sourceKey: true,
      date: true,
      classId: true,
      staffId: true,
      booked: true,
      noShow: true,
    },
  });
  // The `in` filter cannot match a null, so every row here has a key — narrowed rather than `!`.
  return rows.flatMap((r) => (r.sourceKey === null ? [] : [{ ...r, sourceKey: r.sourceKey }]));
}

/**
 * The periods this plan writes into whose slip is **not `draft`**, grouped and sorted.
 *
 * Read by `previewGymmoImport` **and again by `applyGymmoImport` inside its transaction**: a slip can
 * be approved between the preview and the confirm, and a caller that only ever saw the preview would
 * report `created: 1` on a month that closed while the human was reading (see `GymmoImportResult`).
 */
async function readClosedPeriods(
  client: Pick<typeof db, "payslip">,
  periods: readonly string[],
): Promise<GymmoClosedPeriod[]> {
  if (!periods.length) return [];
  const slips = await client.payslip.findMany({
    where: { period: { in: [...periods] }, status: { not: "draft" } },
    select: { period: true, status: true },
  });
  const byPeriod = new Map<string, GymmoClosedPeriod>();
  for (const s of slips) {
    const key = `${s.period}|${s.status}`;
    const cur = byPeriod.get(key);
    if (cur) cur.rows++;
    else byPeriod.set(key, { period: s.period, status: s.status, rows: 1 });
  }
  return [...byPeriod.values()].sort(
    (a, b) => a.period.localeCompare(b.period) || a.status.localeCompare(b.status),
  );
}

/**
 * Signal 1 — the hand-keyed คาบ this plan would duplicate, plus the residual it does not claim.
 *
 * 🔑 **One reader, called by `previewGymmoImport` and again by `applyGymmoImport` inside its
 * transaction**, exactly like `readClosedPeriods` and for the same race: a คาบ keyed by hand
 * *between* the preview and the confirm is written a second time and, on the preview alone, with no
 * record anywhere afterwards — one 400 ฿ Aqua Fit paid twice on one slip. This file's header calls
 * these three signals "money the database cannot refuse on its own"; a signal that exists only before
 * the write is one a screen can swallow by forgetting.
 *
 * The range filter is what bounds the read to the months the file covers rather than the whole table.
 */
async function readHandKeyedSignal(
  client: Pick<typeof db, "classSession">,
  plan: GymmoImportPlan,
): Promise<{ handKeyedMatches: GymmoHandKeyedMatch[]; handKeyedUnmatchedInRange: number }> {
  const range = gymmoPlanRange(plan);
  if (!range) return { handKeyedMatches: [], handKeyedUnmatchedInRange: 0 };
  const rows = await client.classSession.findMany({
    where: { sourceKey: null, date: { gte: range.from, lt: range.to } },
    select: {
      id: true,
      date: true,
      classId: true,
      staffId: true,
      booked: true,
      noShow: true,
      class: { select: { name: true } },
      staff: { select: { name: true } },
    },
  });
  const handKeyedMatches = gymmoHandKeyedMatches(
    plan,
    rows.map((h) => ({ ...h, className: h.class.name, staffName: h.staff.name })),
  );
  // 🔑 A difference of two numbers from **one** query — not the `imported − matched` shape this file
  // forbids two fields down, where the minuend and the subtrahend came from differently-filtered
  // reads. `handKeyedMatches` is a `filter` over `rows`, so it is a subset by construction and the
  // remainder cannot go negative or cancel a row it never contained.
  return { handKeyedMatches, handKeyedUnmatchedInRange: rows.length - handKeyedMatches.length };
}

export async function previewGymmoImport(plan: GymmoImportPlan): Promise<GymmoImportPreview> {
  const range = gymmoPlanRange(plan);
  const inRange = range ? { date: { gte: range.from, lt: range.to } } : null;
  const planKeys = plan.writes.map((w) => w.sourceKey);

  const [existing, handKeyed, importedInRangeNotInFile, closedPeriods] = await Promise.all([
    readExisting(db, plan),
    readHandKeyedSignal(db, plan),
    inRange
      ? db.classSession.count({
          // `notIn` alone would be enough in SQL — `NULL NOT IN (…)` is never true — but the
          // hand-keyed rows are the *other* count, and excluding them explicitly is what keeps these
          // two numbers from ever overlapping.
          where: { sourceKey: { notIn: planKeys }, NOT: { sourceKey: null }, ...inRange },
        })
      : 0,
    readClosedPeriods(db, gymmoPlanPeriods(plan)),
  ]);

  const diff = diffGymmoPlan(plan, existing);

  return {
    newCount: diff.create.length,
    updateCount: diff.update.length,
    unchangedCount: diff.unchanged,
    ptRows: plan.ptRows,
    problems: plan.problems,
    ...handKeyed,
    importedInRangeNotInFile,
    closedPeriods,
  };
}

/**
 * What actually landed. `unchanged` rows were not touched at all.
 *
 * 🔑 **`problems` travels with the counts**, the same decision as `OtImportState` in
 * `lib/ot-import.ts`: the rejected rows are decided before the write and must survive it, or the
 * only screen that ever showed them was the preview and the operator has nothing to act on after
 * confirming. Persisting them so they outlive the request is
 * [task 064](../tasks/done/064-gymmo-import-problems-have-no-home.md).
 *
 * 🔴 **`closedPeriods` is on the result too, re-read inside the transaction**, and it is the same
 * reasoning one step further: on the preview alone it is a number a screen can forget, and a slip can
 * be approved *between* the preview and the confirm. One 400 ฿ Aqua Fit written into an `approved`
 * 08/2026 reports `created: 1` and is then refused by every later `runPayroll` — the คาบ sits in
 * `ClassSession`, in nobody's slip, for ever.
 *
 * ⚠️ **It reports; it does not refuse, and that is a decision.** The row itself is *true* — the คาบ
 * was taught — and no screen reopens a slip (`paid → draft` is card 013 item 2, open with linus), so a
 * refusal would be a dead end: the คาบ could be recorded nowhere until a policy nobody has written
 * exists. Writing it loses nothing, because the non-draft lock means no baht moves either way and the
 * row is waiting when the slip is reopened. What must not happen is the write being reported as an
 * ordinary success — hence this field, on both types.
 */
export type GymmoImportResult = {
  created: number;
  updated: number;
  unchanged: number;
  /**
   * Signal 1, re-read **inside the transaction** for the same reason `closedPeriods` is (card 065
   * review round). A คาบ keyed by hand between the preview and the confirm is written a second time
   * with nothing to show for it afterwards — one 400 ฿ Aqua Fit paid twice on one slip. Like
   * `closedPeriods` it **reports rather than refuses**: both rows are true, the engine pays both, and
   * which one to delete is a human's call, not the import's.
   */
  handKeyedMatches: GymmoHandKeyedMatch[];
  /** The residual beside that list — see `GymmoImportPreview.handKeyedUnmatchedInRange`. */
  handKeyedUnmatchedInRange: number;
  problems: GymmoProblem[];
  /** Non-draft periods this write landed in, as read **inside** the transaction. */
  closedPeriods: GymmoClosedPeriod[];
};

/**
 * Write the plan — **one transaction**, upserting on `ClassSession.sourceKey` (§2 Prisma rule:
 * multi-step writes go inside `$transaction`).
 *
 * 🔑 **Read-then-write instead of one `upsert` per row, and the reason is the clock.** An
 * interactive transaction has Prisma's 5 s default budget, and a nine-month export is hundreds of
 * คาบ ⇒ hundreds of sequential round trips inside that window. This shape costs **two** statements
 * plus one `update` per row that genuinely changed, so the ordinary case — the same file uploaded
 * again — is a read and an empty `createMany`. No `timeout` is passed, so the budget stays Prisma's
 * default and this file makes no claim about it.
 *
 * `sourceKey`'s unique index is what makes it safe, not the read: two imports racing each other
 * both plan a `create`, and the loser's row is absorbed by `skipDuplicates` instead of doubling the
 * คาบ. `created` can over-report by that row — a count being one too high is visible and harmless;
 * a second paid คาบ would not be.
 */
export async function applyGymmoImport(plan: GymmoImportPlan): Promise<GymmoImportResult> {
  // 🔴 **Both lists, not just `writes` — and this guard is the whole of task 064's exposure.** It
  // used to read `if (!plan.writes.length)`, which is precisely the measured 064 case: an export
  // where every คาบ is a `Pilates Flow` with no `ClassPrice` plans **zero** writes and ~20 problems,
  // so the persistence below would never have run in the exact scenario the card was written for.
  // Entering the transaction with an empty plan is safe: `readExisting` asks `in: []`, and both
  // `readClosedPeriods` and `readClosedByStaff` return before querying on an empty list, so nothing but
  // the problem rows is touched.
  if (!plan.writes.length && !plan.problems.length)
    return {
      created: 0,
      updated: 0,
      unchanged: 0,
      problems: plan.problems,
      closedPeriods: [],
      // An empty plan has no day range, so there is nothing a hand-keyed คาบ could duplicate.
      handKeyedMatches: [],
      handKeyedUnmatchedInRange: 0,
    };

  return db.$transaction(async (tx) => {
    const [existing, closedPeriods, closedByStaff, handKeyed] = await Promise.all([
      readExisting(tx, plan),
      readClosedPeriods(tx, gymmoPlanPeriods(plan)),
      readClosedByStaff(
        tx,
        plan.writes.map((w) => ({ staffId: w.staffId, period: utcPeriodOf(w.date) })),
      ),
      // 🔑 Read **before** this import's own writes land, which is what keeps the answer about คาบ
      // *somebody else keyed by hand* rather than about rows this transaction is adding. Its filter
      // is `sourceKey: null`, so nothing this import writes could appear in it either way — the
      // ordering is belt and braces, and the comment is here so a later reorder is a decision.
      readHandKeyedSignal(tx, plan),
    ]);
    const diff = diffGymmoPlan(plan, existing);

    if (diff.create.length)
      await tx.classSession.createMany({ data: diff.create, skipDuplicates: true });

    for (const w of diff.update)
      await tx.classSession.update({
        where: { sourceKey: w.sourceKey },
        // `sourceKey` itself is never in `data` — it is the identity, and rewriting it would turn an
        // update into a row that the next import cannot find.
        data: {
          date: w.date,
          classId: w.classId,
          staffId: w.staffId,
          booked: w.booked,
          noShow: w.noShow,
        },
      });

    // ── task 064: the problem queue, written in the SAME transaction as the คาบ ──────────────────
    //
    // 🔑 **Delete-then-insert over `writes ∪ current problems`, keyed — never a date range.** The
    // `writes` half is the clearing: a key that now imports cleanly loses its `ClassImportProblem`
    // row in the same transaction that creates its `ClassSession`, with no manual step, because
    // `GymmoProblem.key` for such a row **is** `gymmoSourceKey(row)` (`lib/gymmo-import.ts`). The
    // `problems` half makes a *changed* reason replace the old one instead of colliding with it.
    //
    // ⛔ A range-based delete was rejected: it discards a still-true problem for a คาบ that a
    // narrower export simply does not mention — the same silent loss `importedInRangeNotInFile`
    // above exists to catch.
    //
    // 🔑 **Atomicity direction, deliberately.** If this insert fails the whole import rolls back and
    // no คาบ are written. คาบ written while their problem list failed to persist is exactly the
    // silent-money failure task 064 closes; nothing written is loud, and the admin retries.
    //
    // Cost: two extra set-based statements, so the 5 s interactive budget argument in this file's
    // header is unchanged (per-row cost is still `diff.update` only). Postgres allows 65535 bind
    // parameters per statement ⇒ safe to ~60k keys / ~8k rows; measured scale ~180. No chunking.
    // 🔴 **A written คาบ is not always a paid คาบ — and an UNCHANGED one is not a written คาบ.**
    // `closedSlipOutcome` owns that whole decision (its doc comment has the four cases and the two
    // measured failures, 8,000 ฿ in one direction and 24 false rows in the other). Both inputs come
    // from data already in hand: `written` is `diff.create ∪ diff.update`, and `writeRefs` is
    // index-parallel to `writes` (`GymmoImportPlan`), which is what pairs a ref's display columns with
    // that write's `staffId` — the one field a problem row needs to ask "is **this** คาบ's slip closed"
    // and deliberately does not store.
    const written = new Set([...diff.create, ...diff.update].map((w) => w.sourceKey));
    const closed = closedSlipOutcome(
      plan.writeRefs.map((ref, i) => ({
        ref,
        staffId: plan.writes[i].staffId,
        written: written.has(plan.writes[i].sourceKey),
      })),
      closedByStaff,
    );
    const problemRows = gymmoProblemRows([...plan.problems, ...closed.problems]);
    // 🔴 **`leaveAlone` is subtracted from the delete set, not merely from the inserts.** Those are the
    // `unchanged` + closed-slip keys: nothing was written for them this time, so a closed slip beside
    // them most likely *paid* them. Deleting the key while not re-inserting would destroy a **true**
    // closed-slip row an earlier import recorded — trading a false positive for a false negative, in
    // the money direction. Keeping the key out of `touched` leaves such a row exactly as found and
    // manufactures nothing. (A write key is never also a problem key in one plan: a row either resolves
    // and is written, or is refused, and the duplicate rule drops both copies from `writes`.)
    const leaveAlone = new Set(closed.leaveAlone);
    const touched = [
      ...plan.writes.map((w) => w.sourceKey).filter((k) => !leaveAlone.has(k)),
      ...problemRows.map((r) => r.key),
    ];
    await tx.classImportProblem.deleteMany({ where: { key: { in: touched } } });
    // ⚠️ **No `skipDuplicates` here, deliberately — unlike the `createMany` above.** That one absorbs
    // a racing import because the alternative is paying a คาบ twice. Here it is the opposite: two
    // admins importing overlapping files would both delete-then-insert the same key, and a P2002 that
    // rolls the whole import back is the **loud** outcome. `skipDuplicates` would keep the loser's
    // stale reason while reporting success — a money warning that silently contradicts the คาบ beside
    // it. Nothing written is a state the admin retries; a wrong reason is not.
    if (problemRows.length) await tx.classImportProblem.createMany({ data: problemRows });

    return {
      created: diff.create.length,
      updated: diff.update.length,
      unchanged: diff.unchanged,
      problems: plan.problems,
      closedPeriods,
      ...handKeyed,
    };
  });
}
