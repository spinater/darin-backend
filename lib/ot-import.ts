/**
 * Parse the fingerprint-scanner paste from `/ot` into rows ready to write.
 *
 * 🔴 **Pure on purpose — this file must never import `./db`.** `lib/db.ts` constructs a
 * `PrismaClient` at module scope from `process.env.DATABASE_URL`, which is undefined during
 * `bun test` (stage 4 of `scripts/check-code.sh` runs before the throwaway postgres exists).
 * Importing it here would make this module untestable by the only test lane that exists today.
 *
 * Splitting it out of the server action is what lets the caller *return* the unmatched usernames
 * instead of dropping them on the floor (CLAUDE.md §2 rule 4, task 009).
 */

import { finiteNumber } from "./form-number";

/** One OT row the caller writes. `date` is UTC midnight, matching `OtEntry`'s `@@unique([staffId, date])`. */
export type OtImportRow = { staffId: string; date: Date; hours: number };

export type OtImportParse = {
  /**
   * The rows to write — **deduplicated by `staffId + date`, last line winning**, in the order the
   * operator pasted them (a repeat replaces the earlier row *in place*; it does not move to the
   * end).
   *
   * Task 014 made this explicit rather than new: the write is now one `deleteMany` + `createMany`
   * inside a transaction, and `@@unique([staffId, date])` would make a repeated pair **throw and
   * roll back the whole paste**. Last-wins is exactly what the pre-014 `upsert`-per-row loop
   * already did, silently — so this preserves the outcome and only moves the decision somewhere a
   * test can see it.
   */
  rows: OtImportRow[];
  /**
   * Usernames from the paste that matched no staff member — their hours are NOT in `rows` and are
   * therefore not imported. **Deduplicated** by the same normalized key the matcher uses, keeping
   * the first spelling seen: a fingerprint export repeats one bad username on every day of the
   * month, and twenty identical bullets bury the real count of distinct names to fix.
   *
   * A line carrying **no** username lands here too, as the literal `"(บรรทัดไม่มีชื่อผู้ใช้)"` —
   * its key is `""`, so a whole month of them collapses to one bullet, and an empty bullet would
   * be unreadable (task 014). That covers a line with a date but no name (`<TAB>2026-07-01<TAB>8`)
   * and, since round 2, a line with **hours and neither identity field** (`,,176`) — see
   * `parseOtPaste` for why the second one used to reach no bucket at all.
   */
  unmatched: string[];
  /**
   * Lines whose username matched and whose date is usable, but whose hours field is not a usable
   * number — not finite (`แปด`, `Infinity`, a stray unit), **negative**, or **absent entirely**.
   * Their hours are NOT in `rows`.
   *
   * 🔴 **Why this is a bucket and not "it fails loudly at the DB write".** `OtEntry.hours` is a
   * `Float` ⇒ PostgreSQL `double precision`, which **accepts `NaN`**. A single bad character
   * would therefore write `hours = NaN`, and §2.4's `Math.max(0, NaN - threshold)` is `NaN`, so
   * that staff member's `otPay`, `net` and whole payslip for the month become `NaN` — one
   * character silently voiding one person's pay. Rejecting it here makes the outcome the same
   * whether or not the driver happens to refuse it (CLAUDE.md §2 rule 4).
   *
   * **The negative case joined at task 013 item 4**, and the asymmetry is the reason: the one-row
   * form on `/ot` refuses `-5` through `finiteNumber`, so a paste that still accepted it left the
   * open door on the path OT actually arrives by. `-5` is not loud — it stores, and
   * `Math.max(0, -5 - threshold)` pays nothing. Same predicate, same bucket, same box on screen.
   *
   * 🔴 **The empty cell joined at task 014**, and it was the most expensive of the three because it
   * reached *no* bucket at all: `somchai<TAB>2026-07-01<TAB>` is exactly what a fingerprint export
   * writes for a day somebody did not scan out, and the old skip condition dropped it before the
   * username lookup ⇒ a 220-line paste reported "นำเข้าแล้ว 219 รายการ" with zero warnings while
   * that person's OT was short. `finiteNumber` already answers `null` for `""` and for a
   * non-string, so routing the line here needed no new predicate — only the narrower skip.
   *
   * Not deduplicated: unlike a misspelt username, a bad hours value is per-line, and the operator
   * needs each line to go and fix it.
   */
  invalidHours: string[];
  /**
   * Lines whose username matched but whose date is not a real calendar day. Their hours are NOT in
   * `rows`, which since task 014 is load-bearing twice over: the write is one transaction, so an
   * `Invalid Date` reaching it would roll back the whole paste — and the *other* half of this
   * bucket never failed at the write at all.
   *
   * 🔴 **The worse half is the date that looks fine.** Measured with this runtime's `new Date()`:
   *
   * ```
   * "2026-13-01" -> INVALID        "2026-7-1"   -> INVALID      "2026-07-01x" -> INVALID
   * "2026-02-31" -> 2026-03-03     "2026-06-31" -> 2026-07-01   "2026-02-29"  -> 2026-03-01
   * ```
   *
   * An out-of-range day **rolls over into the next month** without complaint. `2026-06-31` is a
   * real shape for a hand-edited export, and it moves that day's OT into **July's payroll period**
   * — counted for the wrong month, in silence (§2 rule 4). `Number.isNaN(getTime())` alone does
   * not catch the right-hand column, which is why the check is a **round-trip** and must not be
   * "simplified" back to an `isNaN` test. The same comparison pins the `YYYY-MM-DD` shape, so no
   * second regex is needed.
   *
   * Not deduplicated, same reasoning as `invalidHours` — it is per-line and the operator fixes each
   * line.
   */
  invalidDates: string[];
};

/**
 * What the `/ot` paste server action hands back to the screen. `null` = not submitted yet.
 *
 * 🔴 The three rejection buckets and `error` travel together on purpose. All three are decided
 * *before* the write, so they must survive a failed write and still reach the screen, never be lost
 * with the exception (CLAUDE.md §2 rule 4).
 *
 * Since task 014 the write is **one transaction** ⇒ `imported` is `rows.length` on success and `0`
 * on failure, and there is no third outcome. It is no longer a count of what landed mid-loop,
 * because nothing can land mid-loop any more.
 */
export type OtImportState = {
  imported: number;
  unmatched: string[];
  /** Lines rejected for an unusable hours value — same lifetime and same reason as `unmatched`. */
  invalidHours: string[];
  /** Lines rejected for a date that is not a real calendar day — same lifetime, same reason. */
  invalidDates: string[];
  /** Thai, user-facing. The raw cause is logged server-side — see `app/ot/page.tsx`. */
  error: string | null;
} | null;

/** Trim + lowercase — the one normalization; the caller must key `byUsername` the same way. */
export const otUsernameKey = (username: string) => username.trim().toLowerCase();

/**
 * A real calendar day written exactly as `YYYY-MM-DD`, at UTC midnight — or `null`.
 *
 * 🔴 **The round-trip is the whole check and must not be "simplified" to `Number.isNaN`.** An
 * out-of-range day does not produce an `Invalid Date`: `new Date("2026-06-31T00:00:00Z")` answers
 * **`2026-07-01`** without complaint, so `isNaN(getTime())` is green over a date the operator never
 * wrote. Comparing the ISO day back against the text is what rejects *both* halves — the
 * unparseable date and the silently shifted one — and the same comparison pins the `YYYY-MM-DD`
 * shape, so no second regex is needed. The measured table of what this runtime does to each shape
 * is on `OtImportParse.invalidDates` above, and stays there rather than being copied.
 *
 * Why it matters wherever a date becomes an `OtEntry`: the shifted day lands in the **next month's**
 * payroll period (`periodRange` is `[from, to)`), and `OtEntry` is keyed `@@unique([staffId, date])`
 * — so a write on the shifted day also **overwrites** that person's real row on it. Money moves
 * months and a true record is destroyed, in silence (CLAUDE.md §2 rule 4).
 *
 * 🔑 **Exported since ใบ 072, so the two write paths refuse exactly the same set** — this is the
 * `finiteNumber` arrangement applied to the other field (§2 rule 2's one-predicate-one-home). Both
 * `parseOtPaste` below and `/ot`'s one-row `add` action call it.
 *
 * ⚠️ **The caller trims.** The comparison is against the text it was handed, so `" 2026-07-01"`
 * is refused as unparseable. That is deliberate — the check has one job — but it means a caller
 * reading a raw form field or a raw CSV cell must `.trim()` first or the two paths diverge.
 */
export function calendarDate(text: string): Date | null {
  const d = new Date(text + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10) === text ? d : null;
}

/**
 * One line per record: `username<TAB|,>YYYY-MM-DD<TAB|,>hours`.
 *
 * 🔴 **A line is skipped only when it is wholly blank** (`!line.trim()`). Task 014 narrowed this
 * twice, and each step closed a drop that reached no bucket at all:
 *
 * 1. from "any of the three fields missing" (`!user || !date || !hours`), which dropped a line with
 *    an empty **hours** cell — see `invalidHours` for what that one cost;
 * 2. from "neither identity field" (`!user && !date`), which still dropped a line carrying **hours
 *    but no name and no date**. `,,176` and `<TAB><TAB>11.5` are what a CSV writes when the name
 *    column is blank for a scan the reader failed to identify, and `max(0, 11.5 − 9) × 40 = 100 ฿`
 *    went missing with nothing on screen — §2 rule 4's exact shape.
 *
 * The final predicate is both **narrower and simpler**: only a line with no content at all is
 * noise. What the wider conditions claimed to defend is still defended — by the parse itself
 * rather than by the skip:
 *
 * - a blank or whitespace-only line has nothing left after `trim()` ⇒ still skipped here;
 * - a header row `username,date,hours` has all three fields ⇒ its username matches nobody ⇒
 *   `unmatched`. That was always what happened to a header, under every version of the skip.
 *
 * Everything else falls through to a bucket: an unknown name — or **no** name — to `unmatched`, a
 * date that is not a real calendar day to `invalidDates`, an hours cell that is unusable *or
 * missing* to `invalidHours`. Nothing is dropped in silence (CLAUDE.md §2 rule 4).
 *
 * ⚠️ A separators-only line (`,,`) is not blank either, so it now reaches `unmatched` under the
 * existing `"(บรรทัดไม่มีชื่อผู้ใช้)"` bullet — deduplicated with every other nameless line to
 * **one** bullet. That is the deliberate cost of the simpler predicate: one visible non-event on a
 * paste that ends in an empty spreadsheet row, bought with the skip that was losing the 100 ฿.
 */
export function parseOtPaste(text: string, byUsername: Map<string, string>): OtImportParse {
  const rows: OtImportRow[] = [];
  const unmatched: string[] = [];
  const invalidHours: string[] = [];
  const invalidDates: string[] = [];
  const seen = new Set<string>();
  // Where each `staffId + date` already sits in `rows`, so a repeat replaces it in place.
  const rowAt = new Map<string, number>();

  for (const line of text.split("\n")) {
    if (!line.trim()) continue; // only a wholly blank line is noise
    const [user, date, hours] = line.split(/\t|,/).map((x) => x?.trim());

    const key = otUsernameKey(user ?? "");
    const staffId = byUsername.get(key);
    if (!staffId) {
      if (!seen.has(key)) {
        seen.add(key);
        // A line with no username keys on `""`, so a month of them collapses to one bullet — but
        // an empty bullet says nothing, so the label names the problem instead.
        unmatched.push(user || "(บรรทัดไม่มีชื่อผู้ใช้)");
      }
      continue;
    }

    // Date and hours are both checked *after* the username lookup on purpose: a line that is wrong
    // in two ways is one problem to the operator, and the name is the fix that also recovers the
    // other days.
    //
    // The date is checked before the hours so that a line missing *both* trailing fields
    // (`somchai` on its own) is reported once, as the structural problem it is, not in two boxes.
    const parsedDate = calendarDate(date ?? "");
    if (parsedDate === null) {
      invalidDates.push(`${user} → "${date ?? ""}"`);
      continue;
    }

    // `finiteNumber` is the shared predicate the five write actions use (`lib/form-number.ts`), so
    // the paste and the one-row form refuse exactly the same set — including a negative value and
    // an absent field, the two this path used to let through in different directions.
    const value = finiteNumber(hours);
    if (value === null) {
      // `hours ?? ""`: a two-field line has no third cell at all, and `${undefined}` would print
      // the word `undefined` back at the operator as if that were what they typed.
      invalidHours.push(`${user} ${date} → "${hours ?? ""}"`);
      continue;
    }

    // `date` is round-trip validated above ⇒ it is exactly the ISO day, so it keys the pair
    // unambiguously. `|` is a plain separator, not a guard: `staffId` is a cuid (`[a-z0-9]`) and
    // `date` is exactly `YYYY-MM-DD`, so neither half can contain a separator of any kind and no
    // collision is reachable. It must stay a **printable** character — this line held a literal
    // NUL until task 014 round 2, which made `grep` skip this whole money file in silence and
    // would have made git call its diff binary once the file shrank (§7, `check-text-bytes.sh`).
    const rowKey = `${staffId}|${date}`;
    const at = rowAt.get(rowKey);
    const row = { staffId, date: parsedDate, hours: value };
    if (at === undefined) {
      rowAt.set(rowKey, rows.length);
      rows.push(row);
    } else {
      rows[at] = row;
    }
  }

  return { rows, unmatched, invalidHours, invalidDates };
}
