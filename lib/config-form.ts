import { finiteNumber, isBlank, INT_COLUMN_MAX } from "./form-number";

/** Which section of the form a refusal came from — a closed set, so it can be a URL flag. */
export type ConfigFieldKind = "cfg" | "rate" | "class" | "staff";

/**
 * Does this field of the `/admin/config` bulk form carry a **number**, and if so, whose?
 *
 * Field names are `kind|…`, written by the inputs in `app/admin/config/page.tsx`:
 * `cfg|<key>` · `rate|<activity>|<rank>` · `class|<id>` · `staff|<id>|<field>` · `sheet|<id>`.
 * For a `staff` row the answer depends on the *field*, not the kind — `rank` is a `<select>` and
 * anything else is not a field this form has. `sheet|…` holds spreadsheet ids and returns `null`.
 *
 * 🔑 **The write loop asks this too, not just the parse.** Its `staff` arm used to send every
 * non-`rank` field to the parsed-values lookup, so a posted `staff|<id>|active` — a field the form
 * never renders — reached a lookup that had skipped it and **threw mid-loop**, after the rate rows
 * were already written. Both sides classifying with this one function is what keeps the two passes
 * describing the same set of fields.
 */
export function numericKind(name: string): ConfigFieldKind | null {
  const [kind, ...rest] = name.split("|");
  if (kind === "cfg" || kind === "rate" || kind === "class") return kind;
  if (kind === "staff" && (rest[1] === "baseSalary" || rest[1] === "classCredit")) return "staff";
  return null;
}

/**
 * What a valid value looks like, per section. Everything is non-negative and finite; the two axes
 * that differ are whether a fraction is allowed and whether an `Int` column has to hold it.
 *
 * - **`cfg`** is stored as text in `PayrollConfig.value`, so no column bound applies — and
 *   fractions are the point: `class.halfRatio` is `0.5`. No **maximum** either: a per-key ceiling
 *   (a percentage that cannot exceed 100, a payday that cannot exceed 31) needs a spec table
 *   beside `CONFIG_DEFAULTS`, which is carded, not guessed here. ⚠️ This assumes what is true
 *   today: **all 20 keys in `CONFIG_DEFAULTS` are non-negative numbers.** ใบ 082's two date-window
 *   keys (`date.earliestYear`, `date.futureDays`) kept that true on purpose — a year and a day
 *   count are numbers, so they need no branch here and no rendering case. A key that is not — a
 *   name, a flag, a date — needs its own branch here *before* it is added, or this pass refuses
 *   the whole save the first time an owner edits it.
 * - **`rate` · `class` · `staff`** all land in PostgreSQL `integer` columns, which **truncate**
 *   a fraction instead of refusing it and **throw** on overflow. Both are refused up front.
 */
const RULES: Record<ConfigFieldKind, { int?: boolean; max?: number }> = {
  cfg: {},
  rate: { int: true, max: INT_COLUMN_MAX },
  class: { int: true, max: INT_COLUMN_MAX },
  staff: { int: true, max: INT_COLUMN_MAX },
};

export type ConfigNumbers =
  { ok: true; values: Map<string, number> } | { ok: false; kind: ConfigFieldKind };

/**
 * Parse **every** numeric field of the bulk config form before any of them is written.
 *
 * 🔴 Why this is a separate pass and not a check inside the write loop. That form posts several
 * dozen fields in one submit, and the loop used to do `Number(val)` field by field straight into
 * `PayrollConfig.value`, `TeachRate.rate`, `ClassPrice.price` and `Staff.baseSalary`/`classCredit`.
 * Two things follow from that shape, and the second is the expensive one:
 *
 *   • `Number()` is silent on every wrong input — see `lib/form-number.ts`. A `NaN` rate does not
 *     fail; it is stored and then poisons every payslip that reads it (CLAUDE.md §2 rule 4).
 *   • It fails **half-written**: the fields before the bad one are already committed, so the admin
 *     is left with a config that is part old and part new and nothing announces which is which.
 *
 * ⇒ all-or-nothing, and the caller writes inside one `$transaction` so a DB failure cannot
 * contradict the notice either.
 *
 * 🔴 **`cfg|…` is in here, and it is the field that mattered most.** These are plain text inputs
 * with no `required`, and every rate, threshold and percentage the engine has is one of them.
 * Clearing one stored `""`, and `num()` used to answer `Number("") === 0` — measured: a cleared
 * `comm.pt.selfClosed` pays **0 ฿** instead of 2,000 ฿ on a 20,000 ฿ self-closed bill, a cleared
 * `incentive.threshold` makes `total >= 0` true for everyone so §1.6's retroactive 12% fires every
 * month for every trainer, and a cleared `ot.ratePerHour` zeroes OT — each with `warnings: []`.
 * This pass is the *write-time* half of closing that; `num()` refusing a blank is the read-time
 * half, and both are needed because a value can also arrive by seed or by hand.
 *
 * Pure — no DB, no clock. `values` is keyed by the field name so the write loop can look each one
 * up instead of parsing a second time (two parses of one string is two homes for one decision).
 */
export function parseConfigNumbers(entries: Iterable<[string, FormDataEntryValue]>): ConfigNumbers {
  const values = new Map<string, number>();
  for (const [name, raw] of entries) {
    const kind = numericKind(name);
    if (!kind) continue;
    // A blank rate is not a bad rate — it is the documented way to **delete** one (the amber note
    // under that table says so), and the write loop does exactly that. Every other numeric field
    // refuses a blank, because there it would mean overwriting a real figure with a zero.
    if (kind === "rate" && isBlank(raw)) continue;
    const n = finiteNumber(raw, RULES[kind]);
    if (n === null) return { ok: false, kind };
    values.set(name, n);
  }
  return { ok: true, values };
}
