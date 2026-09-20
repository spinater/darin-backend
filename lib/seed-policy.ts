/**
 * What `prisma/seed.ts` is allowed to assert about the database in front of it (task 040).
 *
 * 🔴 **Pure on purpose — no `./db`, no clock, no env.** `bun test` runs in stage 4 of
 * `scripts/check-code.sh`, *before* the throwaway Postgres exists and with no `DATABASE_URL`
 * (`.docs/knowledge/ops/gate-tiers-and-pins.md`), so anything that has to be pinned must be
 * reachable without querying. The seed keeps the two queries; this file keeps the decision.
 *
 * The rule it implements:
 *
 * > The seed plants the reference fixture **exactly once** — on a database it can prove it is
 * > initialising — and on every run after that it writes nothing, deletes nothing, and prints what
 * > it withheld; the single exception is the `CONFIG_DEFAULTS` **key set**, which is schema, not
 * > data, and is asserted on every run because its absence makes the product **throw** rather than
 * > show less.
 *
 * The seed used to re-create rows an owner had deliberately deleted: `upsert … update: {}` protects
 * an *edited* value and does nothing for a *deleted* one, because `upsert` cannot tell "removed on
 * purpose" from "never existed". A blanked `pt × PT` rate came back at 200 ฿ on the next deploy and
 * paid 8,000 ฿ over 40 คาบ with `warnings: []` — CLAUDE.md §2 rule 4's most expensive shape.
 */

import { CONFIG_DEFAULTS } from "./config-keys";

/**
 * `CONFIG_DEFAULTS` seen through a plain `string` key.
 *
 * This is an **assignment, not a cast**: the compiler still checks every entry of the real table
 * against this shape, so an entry that stops being `{ value, note }` goes red here rather than
 * being silenced. What it buys is indexing by a `string` that came out of `Object.keys`. The
 * alternative, `CONFIG_DEFAULTS[k as ConfigKey]`, is the cast that defeats the type — it keeps
 * compiling after the key it names has been deleted from the table.
 */
const DEFAULTS: Readonly<Record<string, { readonly value: string; readonly note: string }>> =
  CONFIG_DEFAULTS;

/**
 * The two facts the seed reads **before any write**, and nothing else.
 *
 * 🔴 `staffCount` is not decoration. On "no mark" alone, the host's first post-fix deploy would
 * count as fresh and plant the fixture over a live database — the fix shipping as the bug, once, on
 * the only database with real money in it. It is a sound witness because the seed itself creates
 * seven staff and the product has **no delete-staff path** (`toggleActive` deactivates;
 * `TeachSession.staffId` is `onDelete: Restrict`). It stays permanently: dropping it later silently
 * re-opens the hole for any database restored from a pre-mark backup.
 */
export type SeedEvidence = { marked: boolean; staffCount: number };

/**
 * `initialize` — we are the ones creating this database ⇒ plant the fixture, then mark it.
 * `adopt` — rows exist but no mark (the deploy host, once) ⇒ withhold everything, then mark it.
 * `already-initialized` — marked ⇒ config-key top-up only, for the rest of this database's life.
 */
export type SeedMode = "initialize" | "adopt" | "already-initialized";

export function seedMode(e: SeedEvidence): SeedMode {
  if (e.marked) return "already-initialized";
  return e.staffCount === 0 ? "initialize" : "adopt";
}

/** The reference fixture is written on exactly one run of exactly one database. */
export const plantsFixture = (m: SeedMode) => m === "initialize";

/** `adopt` records a mark too — that is what makes the host's first post-fix deploy auditable. */
export const recordsMark = (m: SeedMode) => m !== "already-initialized";

/** Names a release added that no screen can create — see `fixtureGaps()` in `prisma/seed.ts`. */
export type FixtureGaps = { classes: string[]; sheets: string[] };

/**
 * What the run must **say**. Pure, so the wording — and the omissions — are pinned by a test.
 *
 * 🔴 **It must never report missing `TeachRate` cells.** That matrix is the owner's, and listing
 * its holes on every deploy is both noise and an invitation to re-plant them; the omission is
 * pinned in `lib/seed-policy.test.ts` by whole-array comparison, because a later helpfully added
 * "missing rates" line would otherwise stay green. Missing `TRAINERS` are omitted for the same
 * reason one layer up: staff are data (§2 rule 7).
 *
 * `creatingWrites` is the number of writes this run made **that are able to create a row** — the
 * config keys it inserted, every fixture upsert it executed, and the mark. It is *not*
 * `createdKeys.length`: the last line is what `scripts/check-code.sh` greps out of the seed's
 * **second** run, and the mutant it has to kill there is a fixture write moved out of the
 * `plantsFixture` branch, which creates no config key. On the one path where an upsert can execute
 * without creating anything — a retry after a first boot that crashed before the mark — it
 * over-counts deliberately: the number exists to be zero or not zero, and a retry must not read as
 * a no-op.
 */
export function seedReport(
  mode: SeedMode,
  gaps: FixtureGaps,
  createdKeys: string[],
  creatingWrites: number,
): string[] {
  const out: string[] = [];

  if (mode === "initialize")
    out.push("seed: mode=initialize (empty database) — planting reference fixture");
  else if (mode === "adopt")
    out.push("seed: mode=adopt (database in use, no seed mark) — fixture withheld, mark recorded");
  else out.push("seed: mode=already-initialized — fixture withheld");

  if (createdKeys.length)
    out.push(
      "seed: config keys created this run: " +
        createdKeys.map((k) => `${k}=${DEFAULTS[k]?.value ?? "?"}`).join(" · "),
    );

  // Both lists are things a *release* can add and no screen can create, which is the whole reason
  // withholding them costs anything. Absent is loud; resurrected is silent and pays.
  if (gaps.classes.length)
    out.push(
      "seed: in CLASSES but not in the database (no screen can add these): " +
        gaps.classes.join(", "),
    );
  if (gaps.sheets.length)
    out.push(
      "seed: in SOURCES but not in the database (no screen can add these): " +
        gaps.sheets.join(", "),
    );

  if (!plantsFixture(mode))
    out.push(
      "seed: teach rates NOT re-asserted — the rate matrix has belonged to the owner since first boot",
    );

  // Deliberately machine-readable and deliberately last: the db stage of `scripts/check-code.sh`
  // greps this exact line out of the seed's second run.
  out.push(`seed: mode=${mode} created=${creatingWrites}`);
  return out;
}
