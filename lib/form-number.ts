/**
 * Reading a `FormData` field that is about to become money.
 *
 * 🔴 `type="number" min={0} required` is a **client** hint. A server action is a plain HTTP
 * endpoint, so the field arrives as anything or not at all — and `Number()` answers every one of
 * those quietly, in the direction nobody checks:
 *
 *   • **absent** ⇒ `Number(null)` is **0**, so an `update` overwrites a recorded 12.5 h with a zero
 *     nobody is told about (CLAUDE.md §2 rule 4 — the undecidable becoming a zero is the failure
 *     this repo pays the most for, because it is noticed at payday and not before);
 *   • **blank** ⇒ `Number("")` and `Number("   ")` are **0** as well — the same silent zero wearing
 *     a different hat;
 *   • a **`File` part** (any multipart body can send one) or **`"1e999"`** ⇒ `NaN`/`Infinity`, and
 *     every column on this path is `Float`/`Int` ⇒ `double precision`, which **accepts `NaN`** ⇒
 *     one field carries `NaN` into `net`, the stored `Payslip.net` and the period total's
 *     `reduce`, i.e. into the row of **every** staff member on the screen, not just this one;
 *   • **`"-5"`** ⇒ a finite value that stores happily and then computes to nothing
 *     (`Math.max(0, -5 - 9)` is 0) — less severe, because the row renders `-5` where somebody can
 *     see it, but still nonsense on a money path.
 *
 * One home for the predicate, so the call sites that guard hours, head counts, prices and salaries
 * cannot drift apart (§4: one decision, one home).
 *
 * **Pure** — no DB, no env, no clock. It decides nothing about what a bad field *means*: it hands
 * back `null` and the caller picks the only two honest answers — reject the write and say so on
 * screen, or apply the default that a blank field is documented to mean.
 */
export function finiteNumber(
  raw: FormDataEntryValue | null,
  opts?: { min?: number; max?: number; int?: boolean },
): number | null {
  // Not a string ⇒ the field was absent (`null`) or arrived as a `File`. Never `Number()` it:
  // `Number(null)` is 0 and `Number(File)` is `NaN`, and both are answers to a question nobody
  // asked.
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (text === "") return null;
  const n = Number(text);
  // Rejects `NaN` and `±Infinity` together — `"1e999"`, `"Infinity"` and `"abc"` all land here.
  if (!Number.isFinite(n)) return null;
  // 🔴 `int` is not tidiness — it is the difference between a refusal and a **silent rewrite**.
  // Postgres `integer` does not reject `2.5`. Measured on a throwaway postgres with this schema:
  // 1200.5 → 1200 · 1201.5 → 1201 · 2.5 → 2 · **0.4 → 0** — truncation toward zero, not rounding,
  // so a class price typed as `1200.50` loses the 50 satang and one typed as `0.4` becomes free,
  // both with nothing said. Every `Int` column on this path passes `int: true`; `OtEntry.hours` is
  // a `Float` and deliberately does not (9.5 h is a real value).
  if (opts?.int && !Number.isInteger(n)) return null;
  // Default floor 0: every field this helper guards today is hours, a head count or baht, and none
  // of them has a meaning below zero.
  if (n < (opts?.min ?? 0)) return null;
  // `max` is the other half of the same story: a value an `Int` column cannot hold does not fail
  // quietly, it throws **at the write**, which for a loop of writes means a half-written save.
  // Refusing it here is what lets the caller promise that nothing was written.
  if (opts?.max !== undefined && n > opts.max) return null;
  return n;
}

/**
 * The largest value a PostgreSQL `integer` column holds — `Staff.baseSalary`, `Staff.classCredit`,
 * `TeachRate.rate`, `ClassPrice.price`, `ClassSession.booked`, `ClassSession.noShow`.
 *
 * A **column bound, not a business rule** ⇒ CLAUDE.md §2 rule 3 does not apply: this is not a rate,
 * threshold or percentage and it does not belong in `PayrollConfig`. It is named rather than
 * inlined because eight digits in a comparison read like a policy somebody chose. What a *sensible*
 * ceiling for a salary or a class price would be is a different question, and a spec one.
 */
export const INT_COLUMN_MAX = 2_147_483_647;

/**
 * "The user did not give this field a value" — absent **or** blank, which four of the guarded
 * fields treat as the same thing and are right to: `listPrice` left empty means "sold at list
 * price", `noShow` left empty means nobody missed the class, and a new staff member's salary
 * fields left empty keep their documented default of 0.
 *
 * Here rather than repeated at each call site so that one decision has one home (§4). The
 * distinction it draws is the one that matters: a **`File` part is not blank** — it was "given"
 * and is unreadable ⇒ it must be refused, not quietly turned into the default. That is the
 * direction the old `String(formData.get(x) ?? "")` got wrong: it stringified a `File` into
 * `"[object File]"`, which is truthy, and `Number()` then made it `NaN`.
 */
export function isBlank(raw: FormDataEntryValue | null): boolean {
  return raw === null || (typeof raw === "string" && raw.trim() === "");
}
