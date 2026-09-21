---
sources:
  # The predicate itself and the pin that keeps it honest.
  - lib/form-number.ts
  - lib/form-number.test.ts
  # `num()` is the read-time half of the same guard — it must throw on a blank, and the card says so;
  # `CONFIG_DEFAULTS`' 18 keys are also what the "not guarded here" section below counts.
  - lib/config-keys.ts
  # ⚠️ The two parses and the four screens came **out** of this list at ใบ 068 with the prose that
  # described them (§5: shrink `sources:` with the split, or the card goes stale just as often).
  # They are [form-refusals.md](form-refusals.md)'s now.
---

# Numbers arriving from a form — the guard every money field goes through

Read this before adding a form field that becomes a baht figure, an hours figure or a head count.
The engine's own rules are in [payroll-rules.md](payroll-rules.md); this card is about the edge
**before** the engine, where a figure is read off an HTTP request and written to the database.

## The defect, stated once (task 013 item 4)

`type="number" min={0} required` is a **client** hint. A server action is a plain HTTP endpoint, so
the field arrives as anything or not at all — and `Number()` answers every one of those quietly:

| What arrives | `Number()` says | What that costs |
| --- | --- | --- |
| nothing (field absent) | `0` | an `update` overwrites a recorded 12.5 h with a zero nobody is told about |
| `""` / `"   "` | `0` | same silent zero, from a field the user cleared |
| a `File` part (any multipart body can send one) | `NaN` | `Float` is `double precision`, which **accepts `NaN`** |
| `"1e999"` | `Infinity` | ditto |
| `"-5"` | `-5` | stores and then computes to nothing (`Math.max(0, -5 − threshold)`) |

🔴 **`NaN` does not stop at the one row.** It reaches `net`, the stored `Payslip.net`, and then the
`reduce` behind "รวมทั้งงวด" on `/payslips` — so one bad field blanks the period total for **every**
staff member on the screen, not just the one it was typed for. That is CLAUDE.md §2 rule 4 failing
in its most expensive direction: quiet, and noticed at payday.

## The guard

`lib/form-number.ts`, two exports, both pure:

- **`finiteNumber(raw, opts?)` → `number | null`.** `null` for a non-string (absent, or a `File`),
  for blank, for a non-finite value, for anything below `opts.min` (**default 0** — every field
  guarded today is hours, a head count or baht), for a fraction when `int` is set, and for anything
  above `opts.max`. 🔴 **`int` and `max` are not tidiness.** Measured on a throwaway postgres with
  this schema: `1200.5 → 1200` · `1201.5 → 1201` · `2.5 → 2` · `15000.5 → 15000` · **`0.4 → 0`**.
  Postgres `integer` **truncates toward zero** — it does not round and it does not refuse — so a
  price typed as `1200.50` quietly loses 50 satang and one typed as `0.4` quietly becomes free. An
  overflow does the opposite: `99999999999` throws *"Value out of range for the type"* **at the
  write**, mid-loop, after the earlier rows have already committed.
  `INT_COLUMN_MAX` (2,147,483,647) is exported beside it — a column bound, not a rate, so §2 rule 3
  does not apply, but it is named rather than inlined. A *sensible* ceiling for a salary or a price
  is a different, spec-level question and is carded.
- **`isBlank(raw)` → `boolean`.** "Not given" — absent **or** empty. 🔑 A `File` part is **not**
  blank: it was given and is unreadable, so it must be refused rather than take the default for an
  empty field. That is the distinction the old `String(formData.get(x) ?? "")` got backwards —
  `"[object File]"` is truthy, so it was treated as a value, and `Number()` then made it `NaN`.

The pair exists so a `null` is never ambiguous: the caller decides whether a *blank* field has a
documented meaning, and every other `null` is a refusal.

⇒ **Which caller decides what — the per-action table, the two parses with real logic
(`parseConfigNumbers`, `parseNewStaff`), the shared `?err=` surface and the two guards that are a
*pair* rather than a field — is [form-refusals.md](form-refusals.md)**, split out at ใบ 068. This
card stops at the predicate on purpose: the predicate is one decision and does not grow, while the
action table gains a row every time a form lands.

## What is deliberately *not* guarded here

- **A per-key ceiling for a config value.** Nothing stops `comm.pt.selfClosed` being set to `900`
  (a 900% commission) or `payday.base` to `77`. That needs a spec table beside `CONFIG_DEFAULTS`,
  one row per key, and is carded — guessing the maxima here would put the spec in the guard.
- **A non-numeric config key.** All 18 keys in `CONFIG_DEFAULTS` are non-negative numbers today, and
  the `cfg` rule assumes it. A key that is a name, a flag or a date needs its own branch in
  `parseConfigNumbers` **before** it is added, or the first owner who edits it is refused — that
  parse and the file it lives in are [form-refusals.md](form-refusals.md)'s, which sources it.
