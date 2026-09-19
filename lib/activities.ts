import { db } from "./db";
import { mergeActivityNames } from "./activity-names";

/**
 * The list of teach activities the rate matrix shows — **names only**.
 *
 * 🔴 **Nothing in this module is a number, and nothing in it may become one.** A rate lives in
 * `TeachRate` alone (§2 rules 2 and 3). This file exists so that *"this activity exists"* and
 * *"this activity has a rate"* are two separate facts; before task 036 they were one, and the cost
 * of that is written up in `.docs/knowledge/domain/payslip-lifecycle.md`.
 * ⇒ a `?? 0`, `|| 0` or `!rate` anywhere downstream rebuilds that defect green.
 *
 * The fold itself lives in `./activity-names` and is re-exported here, so nothing that only needs
 * the pure half has to import `./db` (§4 barrel · the `buildTeachRates` precedent).
 */
export { mergeActivityNames };

/**
 * The four arms of the union, read in parallel so the caller can drop this straight into the page's
 * existing `Promise.all` without a second round trip.
 *
 * ⚠️ The `TeachSession` arm is a `groupBy` over the largest table with no `where` — named here
 * rather than discovered later. Fine at this scale, and filtering by period would hide an activity
 * whose sessions all predate the period being looked at, which is the opposite of the point.
 */
export async function listActivities(): Promise<string[]> {
  const [registered, rates, sources, sessions] = await Promise.all([
    db.teachActivity.findMany({ select: { name: true } }),
    db.teachRate.groupBy({ by: ["activity"] }),
    db.sheetSource.groupBy({ by: ["activity"] }),
    db.teachSession.groupBy({ by: ["activity"] }),
  ]);
  return mergeActivityNames(
    registered.map((r) => r.name),
    rates.map((r) => r.activity),
    sources.map((s) => s.activity),
    sessions.map((s) => s.activity),
  );
}

/**
 * Does this name already exist anywhere the matrix would show it?
 *
 * 🔑 **This is the pre-check, not the guard, and the two are not redundant.** The `@unique` index on
 * `TeachActivity.name` is the real guard — a pre-check alone is the TOCTOU race `addStaff` documents
 * one screen over. But the index can only see the **registry**, while `pt` exists in `TeachRate` and
 * `SheetSource` with no registry row, so the index alone would register a name the admin can already
 * see in the matrix and report success. This reads the union, so the refusal is honest about what is
 * on screen; the index still catches the race behind it.
 *
 * It costs the whole union to answer a yes/no. Deliberate at this size — four filtered probes would
 * be cheaper but would put the "which places count as existing" rule in a second home.
 */
export async function activityExists(name: string): Promise<boolean> {
  return (await listActivities()).includes(name.trim());
}
