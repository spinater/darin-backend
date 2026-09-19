/**
 * The pure half of the activity list (task 036) — **no `db` import, on purpose.**
 *
 * `lib/activities.ts` imports `lib/db.ts`, which constructs a `PrismaClient` at module load. Task
 * 034 moved `buildTeachRates` into `lib/payroll.ts` for exactly that reason, so the tests that pin
 * baht would not fail pointing at Prisma; a pinned fold that drags the DB layer back in through a
 * different file would undo the lesson one module over. `lib/activities.ts` re-exports this (§4's
 * barrel pattern), so callers still import from one place.
 */

/**
 * Fold every list a name can be learned from into one list the rate matrix can render.
 *
 * Three decisions live here and nowhere else:
 *
 * 1. **The registry only ever *adds*.** The caller passes the `TeachActivity` names *and* the names
 *    already in `TeachRate`, `SheetSource` and `TeachSession`, so an activity with a rate, a sheet
 *    or one historical session renders **even if its registry row is missing or the whole table is
 *    dropped**. No rate can go invisible because a name was not registered.
 * 2. **Trimmed-exact — no case folding, no normalizer.** `lib/normalize.ts` collapses *trainer*
 *    spellings; a second normalizer here would be one decision in two homes (§4). `Boxing` and
 *    `boxing` are two activities, and the one nobody priced warns loudly (§2 rule 4) instead of
 *    silently inheriting the other's rate.
 *    ⚠️ The trim is **display-side only** — `buildTeachRates` and the matrix's `defaultValue` lookup
 *    both key on the raw column, so a padded `TeachRate.activity` would merge into the trimmed row
 *    here while paying from a row the screen can no longer reach. No writer produces one today; the
 *    divergence is recorded on task 029, which owns what the live rows actually contain.
 * 3. **A `Set`, never an object literal.** The names are admin-typed data (§2 rule 7) and
 *    `__proto__` is a legal one — the lesson task 034 paid for in `buildTeachRates`.
 *
 * Blank names are dropped rather than rendered: the form refuses them, but `SheetSource.activity`
 * and `TeachSession.activity` are plain columns, and a blank one would render a nameless row whose
 * inputs are named `rate||PT` — colliding with every other blank (task 035 owns that encoding).
 *
 * Ordering is presentational and is the plain code-unit `.sort()` this list has always used: no
 * amount depends on it.
 */
export function mergeActivityNames(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  for (const list of lists)
    for (const raw of list) {
      const name = raw.trim();
      if (name) seen.add(name);
    }
  return [...seen].sort();
}
