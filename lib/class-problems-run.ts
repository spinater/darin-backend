/**
 * The database half of the **class-import problem queue** (task 064) — the one place that reads or
 * writes `ClassImportProblem`, split out of `lib/gymmo-import-run.ts` in that card's fix round when
 * that file passed the 450-line warn (CLAUDE.md §4: split early, never raise the limit).
 *
 * The pair follows this repo's own convention: `lib/class-problems.ts` decides (pure, no `./db`, so
 * `bun test` can pin it without a database) and this file does the I/O, exactly as
 * `lib/gymmo-import.ts` / `lib/gymmo-import-run.ts` are split. 🔴 **The pure module must never
 * re-export this one** — a barrel across that boundary would drag `lib/db.ts` into every test that
 * only wanted a key.
 *
 * 🔴 **All `db.classImportProblem` access in this repo lives here.** That is the §4 "one decision, one
 * home" boundary for this model, and the thing a later screen will be tempted to break by querying it
 * from a page. The write is the exception that proves it: `applyGymmoImport` needs the rows inside its
 * own transaction, so it uses `tx.classImportProblem` there and takes `readClosedByStaff` from here.
 *
 * ⚠️ **No role check lives here**, same as its sibling: `requireAdmin()` belongs to the page and the
 * server action, and no gate watches that (`.docs/knowledge/ops/gates.md`).
 */
import { utcPeriodOf, type ClassProblemState } from "./class-problems";
import { problemIsCleared } from "./class-problems-copy";
import { db } from "./db";
import { periodRange } from "./payroll-run";

/**
 * **staffId → period → the non-draft status of that slip**, for the pairs asked about.
 *
 * Separate from `readClosedPeriods` on purpose: that one answers the *screen's* question ("which months
 * does this upload land on that are closed", across everybody) and its shape is a rendered contract.
 * This one answers the *money* question — "is **this** คาบ's own slip closed" — and `Payslip` is
 * `@@unique([staffId, period])`, so the inner value is one status, never a set. Reading it per staff is
 * what stops the write side flagging every คาบ of a month in which one unrelated trainer's slip happens
 * to be approved (task 064 fix round).
 *
 * ⚠️ **The predicate `closed = status: { not: "draft" }` now lives at two query sites** — here and
 * `readClosedPeriods` in `lib/gymmo-import-run.ts`. Not worth a shared helper at two calls, but a fourth
 * `Payslip.status` has to be reasoned about in **both**, and only this one gates money.
 */
export async function readClosedByStaff(
  client: Pick<typeof db, "payslip">,
  pairs: readonly { staffId: string; period: string }[],
): Promise<Map<string, Map<string, string>>> {
  const out = new Map<string, Map<string, string>>();
  if (!pairs.length) return out;
  const slips = await client.payslip.findMany({
    where: {
      status: { not: "draft" },
      staffId: { in: [...new Set(pairs.map((p) => p.staffId))] },
      period: { in: [...new Set(pairs.map((p) => p.period))] },
    },
    select: { staffId: true, period: true, status: true },
  });
  // Over-fetches the cross product of the two `in` lists and is then filtered by the exact pair on
  // lookup — nested maps rather than a `${staffId}|${period}` composite, because a joined key is only
  // injective while no part can contain the separator and this repo has paid for that once (ใบ 035).
  for (const slip of slips) {
    const byPeriod = out.get(slip.staffId);
    if (byPeriod) byPeriod.set(slip.period, slip.status);
    else out.set(slip.staffId, new Map([[slip.period, slip.status]]));
  }
  return out;
}

/** One unresolved import problem, as a screen renders it (task 064). */
export type ClassImportProblemView = {
  key: string;
  /**
   * `"session"` = an import into an open period clears it · `"duplicate"` = same key, but the file
   * contradicts itself about the head count ⇒ never excluded from the count · 🔴 `"row"` = the reader
   * never got a `sourceKey`, so **nothing clears it** and task 066 is its only exit.
   */
  kind: string;
  rowLabel: string;
  reason: string;
  trainerSheet: string;
  className: string | null;
  date: Date | null;
  timeText: string | null;
  seenAt: Date;
  /**
   * Where this row's คาบ actually stands — `null` only for `kind: "row"`, whose arity-3/1 reader key
   * can never equal a 4-tuple `sourceKey`, so no lookup is possible even in principle.
   *
   * 🔴 **Three states, not two, and the third is the one that costs money** (card 065 review round).
   * A `kind: "session"` row is written for two different situations and `kind` cannot tell them
   * apart: the คาบ never became a `ClassSession` (no price, unknown trainer) **or** it was written
   * and its slip was already closed (`closedSlipOutcome`). Collapsed to a boolean, both read as
   * *"ไม่มีอยู่ในฐานข้อมูล"* with *"แก้ต้นทางแล้วนำเข้าซ้ำ"* as the exit — and for the second that is
   * two wrong claims. Re-uploading writes into a still-closed period, `closedSlipOutcome` re-emits
   * the same key and the row does not move; meanwhile *"ไม่มีอยู่ในฐานข้อมูล"* invites the admin to key
   * those คาบ by hand, which puts a second row beside the imported one (a null `sourceKey` is exempt
   * from `@unique`) — ประพัฒน์'s twenty 08/2026 `Pilates Flow` คาบ, **8,000 ฿ paid twice**, through
   * the other door of the very trap this card closes. `app/payslips/page.tsx` already names all
   * three categories; this is the screen it links to, and it may not name fewer.
   *
   * `"accountedFor"` additionally means **the stored `reason` is no longer true and must NOT be
   * printed**: a closed-slip row says *"…ยังไม่ถูกจ่าย"*, the admin reopens the slip and recomputes,
   * and **nothing deletes the row** — `deleteMany` runs only inside `applyGymmoImport`, i.e. on the
   * next upload. Printing the stored text then asserts that money just paid is unpaid, §2 rule 4
   * pointing the wrong way.
   */
  state: ClassProblemState | null;
};

/**
 * Every unresolved import problem, **newest import first**. Only `/classes` renders it (card 065).
 *
 * Not period-scoped, on purpose: this is the queue itself rather than the blocker count, and a row's
 * `date` can be `null`. `key` breaks the `seenAt` tie so the order is total — every row of one import
 * shares a `seenAt` to the millisecond.
 */
export async function listClassImportProblems(): Promise<ClassImportProblemView[]> {
  const rows = await db.classImportProblem.findMany({
    orderBy: [{ seenAt: "desc" }, { key: "asc" }],
  });
  const states = await readProblemStates(rows);
  return rows.map((r) => ({ ...r, state: states.get(r.key) ?? null }));
}

/**
 * `ClassProblemState` per **`"session"` and `"duplicate"`** key in `rows` — every one of them, so the
 * map's key set **is** that filter and a caller cannot silently disagree about which rows were judged.
 *
 * 🔴 **`"duplicate"` is looked up too, and is never excluded from the count** (`payroll-auditor`,
 * round 2). Its คาบ may already exist at the *wrong* head count, so the screen must not tell anyone
 * nothing was written — but the same existence must not buy the row an exclusion either. Those two
 * needs used to be one boolean; they are now the state (for the screen) and the `kind` test in
 * `pendingClassImportInPeriod` (for the count), which is why that filter names `"session"` explicitly.
 *
 * 🔴 **One home for this rule, read by both callers** (card 065). Before it, the predicate existed
 * once, inside `pendingClassImportInPeriod`; the table on `/classes` needs the same answer to decide
 * whether a stored `reason` is still true and which exit to print, and two copies of a
 * money-exclusion rule is the drift §4 exists to stop. The whole justification — why excluding at all
 * is right, why a closed slip and a `"duplicate"` must not be excluded, and the 8,000 ฿ this
 * narrowing is worth — is on `pendingClassImportInPeriod` below, which is where `payroll-auditor`
 * found it.
 *
 * ⚠️ **`"missing"` is the default and the safe direction.** A key with no `ClassSession` and a key
 * whose row is not looked up at all both end up outside `"accountedFor"`, i.e. still blocking.
 */
async function readProblemStates(
  rows: readonly { key: string; kind: string }[],
): Promise<Map<string, ClassProblemState>> {
  const keyed = rows
    .filter((r) => r.kind === "session" || r.kind === "duplicate")
    .map((r) => r.key);
  const states = new Map<string, ClassProblemState>(keyed.map((k) => [k, "missing"]));
  if (!keyed.length) return states;

  const sessions = await db.classSession.findMany({
    where: { sourceKey: { in: keyed } },
    select: { sourceKey: true, date: true, staffId: true },
  });
  if (!sessions.length) return states;

  // The same per-(staffId, period) reader the write side uses, so the two halves cannot drift about
  // what "this คาบ's slip is closed" means.
  const closedByStaff = await readClosedByStaff(
    db,
    sessions.map((s) => ({ staffId: s.staffId, period: utcPeriodOf(s.date) })),
  );
  for (const s of sessions) {
    // The `in` filter cannot match a null, so every row here has a key — narrowed rather than `!`.
    if (s.sourceKey === null) continue;
    states.set(
      s.sourceKey,
      closedByStaff.get(s.staffId)?.get(utcPeriodOf(s.date)) ? "closedSlip" : "accountedFor",
    );
  }
  return states;
}

/**
 * The count `/payslips` names beside `pendingReviewInPeriod` — คาบ this period is **missing** because
 * a Gymmo row never became a `ClassSession`. A run can otherwise look complete while คาบ are absent,
 * and the payslip cannot warn about a row that does not exist (task 064).
 *
 * `date: null` counts in **every** period, copied deliberately from `pendingReviewInPeriod`: a row
 * whose date was the unreadable part belongs to a month nobody can name yet, and the safe direction
 * is to block all of them rather than none. ⚠️ It is the narrowest possible set — `lib/gymmo.ts`
 * carries the date on every reject that happens after `parseGymmoWhen` succeeded — because a `"row"`
 * problem has **no clearing path**, so an every-period row is permanent until task 066 answers, and a
 * blocker count stuck at a constant is a count people learn to ignore.
 *
 * 🔑 **Keys whose คาบ is genuinely accounted for are excluded, and that is set membership — NOT the
 * `imported − matched` subtraction this path forbids** (`.docs/knowledge/domain/gymmo-import.md`).
 * That bug's subtrahend (`matched`, no date filter) was **not a subset** of its minuend (`imported`,
 * range-confined), so twelve out-of-range rows cancelled twelve in-range orphans and `100 − 100 = 0`
 * hid ~4,800 ฿. Here every later query is keyed by the **first query's own output** and the last line
 * is a `filter` over that first list, so a row outside the period cannot appear in the excluded set at
 * all, let alone cancel one inside it.
 *
 * 🔴 **"A `ClassSession` exists" is NOT "this คาบ is accounted for" — the blocker `payroll-auditor`
 * found.** Excluding at all is right (delete a `TrainerAlias`, re-upload, and a คาบ that **is** paid
 * becomes a problem again; a count that cries wolf is a count nobody reads), but two narrowings are
 * load-bearing, and both are money:
 *
 * 1. **The slip is already closed** ⇒ `runPayroll` never recomputes it and no screen reopens one, so
 *    the คาบ is never paid by anybody — ประพัฒน์'s twenty 08/2026 `Pilates Flow` คาบ are 8,000 ฿, his
 *    whole month, and excluding them left `/payslips` reading clean. A key is excluded only when its
 *    คาบ's **own** slip (that `staffId`, that period) is absent or still `draft`.
 * 2. **`kind: "duplicate"`** ⇒ the file holds two rows for that key with different head counts, so the
 *    stored คาบ may be there at the **wrong** amount (stored 5/3 ⇒ 200 ฿ against the file's 9/0 ⇒
 *    400 ฿). Its existence proves nothing, so it is never excluded.
 *
 * ⚠️ An arity-3/1 reader key can never equal a 4-tuple `sourceKey`, so `kind: "row"` is never excluded
 * by construction — the same fact that means nothing clears it (task 066).
 * Full record: `.docs/knowledge/domain/class-import-blockers.md` (the table itself is
 * `class-import-queue.md`).
 */
export async function pendingClassImportInPeriod(period: string): Promise<number> {
  const { from, to } = periodRange(period);
  const rows = await db.classImportProblem.findMany({
    where: { OR: [{ date: { gte: from, lt: to } }, { date: null }] },
    select: { key: true, kind: true },
  });
  if (!rows.length) return 0;
  const states = await readProblemStates(rows);
  // 🔑 **`problemIsCleared` — the screen's own predicate, not a second copy of it.** It is keyed on
  // `kind` **and** `state`: `"closedSlip"` keeps blocking because that คาบ is in the database and in
  // nobody's slip (the 8,000 ฿ case below), and `"duplicate"` keeps blocking however its คาบ resolves,
  // because its existence says nothing about its **amount** (stored 5/3 ⇒ 200 ฿ against the file's
  // 9/0 ⇒ 400 ฿). Writing this rule twice is what let the table and this number disagree about one
  // cell for a whole review round (`payroll-auditor`, rounds 2 and 3).
  return rows.filter((r) => !problemIsCleared({ kind: r.kind, state: states.get(r.key) ?? null }))
    .length;
}
