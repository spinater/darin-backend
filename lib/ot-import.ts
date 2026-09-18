/**
 * Parse the fingerprint-scanner paste from `/ot` into rows ready to upsert.
 *
 * 🔴 **Pure on purpose — this file must never import `./db`.** `lib/db.ts` constructs a
 * `PrismaClient` at module scope from `process.env.DATABASE_URL`, which is undefined during
 * `bun test` (stage 4 of `scripts/check-code.sh` runs before the throwaway postgres exists).
 * Importing it here would make this module untestable by the only test lane that exists today.
 *
 * Splitting it out of the server action is what lets the caller *return* the unmatched usernames
 * instead of dropping them on the floor (CLAUDE.md §2 rule 4, task 009).
 */

/** One OT row the caller writes. `date` is UTC midnight, matching `OtEntry`'s `@@unique([staffId, date])`. */
export type OtImportRow = { staffId: string; date: Date; hours: number };

export type OtImportParse = {
  rows: OtImportRow[];
  /**
   * Usernames from the paste that matched no staff member — their hours are NOT in `rows` and are
   * therefore not imported. **Deduplicated** by the same normalized key the matcher uses, keeping
   * the first spelling seen: a fingerprint export repeats one bad username on every day of the
   * month, and twenty identical bullets bury the real count of distinct names to fix.
   */
  unmatched: string[];
  /**
   * Lines whose username matched but whose hours field is not a finite number (`แปด`, `Infinity`,
   * a stray unit). Their hours are NOT in `rows`.
   *
   * 🔴 **Why this is a bucket and not "it fails loudly at the DB write".** `OtEntry.hours` is a
   * `Float` ⇒ PostgreSQL `double precision`, which **accepts `NaN`**. A single bad character
   * would therefore write `hours = NaN`, and §2.4's `Math.max(0, NaN - threshold)` is `NaN`, so
   * that staff member's `otPay`, `net` and whole payslip for the month become `NaN` — one
   * character silently voiding one person's pay. Rejecting it here makes the outcome the same
   * whether or not the driver happens to refuse it (CLAUDE.md §2 rule 4).
   *
   * Not deduplicated: unlike a misspelt username, a bad hours value is per-line, and the operator
   * needs each line to go and fix it. An `Invalid Date` is deliberately **not** routed here — it
   * cannot poison arithmetic the way `NaN` does and still fails at the write (task 014).
   */
  invalidHours: string[];
};

/**
 * What the `/ot` paste server action hands back to the screen. `null` = not submitted yet.
 *
 * 🔴 `unmatched`, `invalidHours` and `error` travel together on purpose. The write loop can fail
 * partway (a row whose date is unparseable dies at the Prisma write), and both rejected buckets
 * are decided *before* that loop runs — so they must survive the failure and reach the screen,
 * never be lost with the exception (CLAUDE.md §2 rule 4). `imported` counts rows that actually
 * landed, not rows that were planned.
 */
export type OtImportState = {
  imported: number;
  unmatched: string[];
  /** Lines rejected for a non-finite hours value — same lifetime and same reason as `unmatched`. */
  invalidHours: string[];
  /** Thai, user-facing. The raw cause is logged server-side — see `app/ot/page.tsx`. */
  error: string | null;
} | null;

/** Trim + lowercase — the one normalization; the caller must key `byUsername` the same way. */
export const otUsernameKey = (username: string) => username.trim().toLowerCase();

/**
 * One line per record: `username<TAB|,>YYYY-MM-DD<TAB|,>hours`.
 *
 * Lines missing any of the three fields are skipped silently — that covers the blank line at the
 * end of every paste, and a header row, neither of which is money going missing.
 *
 * ⚠️ A line whose **date** is present but unparseable still reaches `rows` (`Invalid Date`) and
 * fails at the DB write — kept identical to the pre-009 behaviour, and owned by task 014. A
 * non-finite **hours** value is different in kind and does not get that treatment: see
 * `invalidHours` above.
 */
export function parseOtPaste(text: string, byUsername: Map<string, string>): OtImportParse {
  const rows: OtImportRow[] = [];
  const unmatched: string[] = [];
  const invalidHours: string[] = [];
  const seen = new Set<string>();

  for (const line of text.split("\n")) {
    const [user, date, hours] = line.split(/\t|,/).map((x) => x?.trim());
    if (!user || !date || !hours) continue;

    const key = otUsernameKey(user);
    const staffId = byUsername.get(key);
    if (!staffId) {
      if (!seen.has(key)) {
        seen.add(key);
        unmatched.push(user);
      }
      continue;
    }

    // Checked *after* the username lookup on purpose: a line that is wrong in both ways is one
    // problem to the operator, and the name is the fix that also recovers the other days.
    const value = Number(hours);
    if (!Number.isFinite(value)) {
      invalidHours.push(`${user} ${date} → "${hours}"`);
      continue;
    }

    rows.push({ staffId, date: new Date(date + "T00:00:00Z"), hours: value });
  }

  return { rows, unmatched, invalidHours };
}
