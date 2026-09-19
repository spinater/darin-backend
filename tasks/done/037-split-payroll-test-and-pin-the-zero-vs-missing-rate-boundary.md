# Split `lib/payroll.test.ts` (469/500), and pin the `0`-vs-missing rate boundary while splitting

- status: done
- commit: d300c57

## Goal

Two things that have to happen together, because each is the reason the other cannot be done alone.

**1. The file is at the §4 warning line.** `lib/payroll.test.ts` is **469 lines** against warn-450 /
hard cap 500 (`scripts/check-file-length.sh`). The next addition to it is the one that has to pay for
the split — and task 037's own new test (below) is that addition, as is task 036's acceptance pair.

**2. The engine's most load-bearing branch is not pinned at its boundary.** `lib/payroll.ts:121-127`:

```ts
const rate = staff.rank ? teachRates.get(activity)?.get(staff.rank) : undefined;
if (rate == null) { warnings.push(`ไม่มีเรทค่าสอน …`); continue; }
```

`rate == null` is the whole of CLAUDE.md §2 rule 4 for teach pay, and **two one-character tidy-ups
break it while every current assertion stays green**:

| tidy-up | what it does | why the suite does not catch it |
|---|---|---|
| `… ?? 0` | a missing rate becomes a `0 ฿` line with `warnings: []` | task 034's yoga arm asserts `teachPay === 0` and would still pass — with the wrong reason |
| `if (!rate)` | a rate an owner deliberately set to `0` starts warning | no test configures a rate of `0` |

The first one is exactly the failure task 034 exists to remove, reintroduced green.

> 🔴 **Correction, measured while implementing (2026-09-19): the first row of that table is wrong,
> and the table was missing a third row.** All three mutants counter-tested against the finished
> suite, each on a clean engine (`scripts/counter-test.sh`, hashes matched at `restore`,
> `lib/payroll.ts` byte-identical to HEAD afterwards):
>
> | tidy-up | tests that go red | verdict |
> |---|---|---|
> | `if (!rate)` | **1** — the new zero arm, nothing else | the real hole, exactly as the card claimed. Nothing in the old 34 caught it |
> | `continue` → `break` | **1** — the missing arm, nothing else | 🔴 **found by `payroll-auditor`, not by this card.** Green against all 36 until the missing arm was given a *rated* activity to sit beside. `[...byActivity].sort()` is lexicographic ⇒ an unrated `aqua` is visited before `pt`, and `break` drops 12 คาบ = **4,800 ฿** behind one warning naming only the 4 aqua คาบ |
> | `?? 0` | **3** — `ไม่มีเรท (Yoga)`, `__proto__`, and the new missing arm | **not** the hole this card claimed. Yoga asserts the *warning* (`warnings.join()).toContain(…)`), not only `teachPay === 0` ⇒ `?? 0` was never green. What the missing arm adds over it is the **line** assertion — real, but narrow, and the yoga arm is **not** redundant |
>
> Lesson: the card reasoned about the first assertion of an existing test and stopped reading. The
> arm that mattered (`if (!rate)`) was correctly identified; the one it missed entirely was found by
> the audit lane, which is the whole reason §9 keeps `payroll-auditor` on a path list.

## Scope

**Split first** (§4's test pattern: split alongside the subject, `lib/payroll.test.ts` →
`lib/payroll/*.test.ts`), **then** add the boundary arms into the resulting file.

🔴 **The split lowers `lib/payroll.test.ts`'s junit pin and that goes red on purpose** (§7). The
task-card reason is *"the file was split; coverage moved, none was removed"* — and the honest way to
show it is that the **sum** of the new pins is ≥ the old 34 plus whatever this card adds. Add a pin row
per new file in `scripts/junit-pins.txt` and a row per raise in
[.docs/knowledge/ops/gate-tiers-and-pins.md](../../.docs/knowledge/ops/gate-tiers-and-pins.md) in the
same change. Split by **topic with a clear boundary** — the file's `describe` blocks already follow
REQUIREMENTS.md sections (§1.2 teach · §1.4 class · §1.5/§1.6 commission · §2.4 OT · config guards),
so the boundary is given rather than invented.

**The two arms to add** (both in whichever file ends up owning §1.2 teach pay):

1. a rate of **exactly `0`**, configured through `buildTeachRates`, pays `0` with
   `warnings.length === 0` **and still emits its teach line** — the owner chose it, so it must be
   visible on the slip;
2. a **missing** rate warns `ไม่มีเรทค่าสอน <activity> × <rank>` and emits **no** teach line.

🔑 Assert on `r.lines.filter(l => l.group === "teach")`, not on `teachPay` alone. This is the
task-025 lesson already recorded in `scripts/junit-pins.txt`: a clamped or accumulated total can hide
a wrong line, and here the two cases differ precisely in *whether a line exists*.

## Notes

- Raised by `code-reviewer` (finding 4: the 469 lines) and `payroll-auditor` (finding 3: the unpinned
  boundary) in the same task 034 review, 2026-09-19. Task 034 left both on purpose — splitting the
  file inside that commit would have buried a one-test money fix under a §7 pin-lowering argument.
- Cheap and worth folding in while the pins are already moving: two knowledge cards are two lines under
  the §5 warn — `.docs/knowledge/domain/money-input-guards.md` at 168 and
  `.docs/knowledge/domain/payroll-rules.md` at 170 (warn 170 · cap 200). The next sentence added to
  either one warns.
- **Coordinate with [task 036](036-addactivity-seeds-rate-zero-so-the-warning-can-never-fire.md)** —
  its acceptance test is the same `0`-vs-missing pair seen from the screen's side. Whichever card ships
  second must not write the assertions a second time.

---

## What shipped — `d300c57`, 2026-09-19

`lib/payroll.test.ts` (**468** lines, not the 469 in this card's title —
`git show HEAD:lib/payroll.test.ts | wc -l`) became:

| file | tests | owns |
|---|---|---|
| `lib/payroll/teach.test.ts` | 6 | §1.2 · the ใบ 034 `__proto__` arm · the two ใบ 037 arms |
| `lib/payroll/class.test.ts` | 6 | §1.4 · the ใบ 025 negative-attendance trio |
| `lib/payroll/commission.test.ts` | 14 | §1.5 · §1.6 · §2.2 |
| `lib/payroll/ot.test.ts` | 3 | §2.4 · the 13.33 / qty 0.33 / 266.67 reference figures |
| `lib/payroll/slip.test.ts` | 3 | §1.7 · the ใบ 013 inactive-staff pair |
| `lib/payroll/config-guards.test.ts` | 4 | `num()` (ใบ 013 item 4) |
| `lib/payroll/fixtures.ts` | — | the shared `computePayslip` input builder |

**36 = 34 moved + 2 added.** Movement proved by `diff` against `git show HEAD:lib/payroll.test.ts`:
every moved block byte-identical; `fixtures.ts` differs only by the `export` keyword and one
prettier reflow of the `config` line that `export ` pushed past 100 columns. `lib/payroll.ts`
byte-identical to HEAD throughout — this card pins a branch, it does not change one.

### The two review lanes (§9)

- **`code-reviewer` — PASS**, 8 findings, all documentation accuracy. Re-derived the redistribution
  independently (21 ใบ 001 arms + 009/013/025/034 raises + 2 = 36) and confirmed every note lands on
  the right file. Applied: the `sources:` gap (below), the false counter-test claim (below), the
  gate card implying the pin layer catches an unpinned file (it does not — it walks the pin file
  forward only), the `469`, "these six rows", the `config-guards` reason, and a 🔴 on
  `fixtures.ts` — it is the first non-test `.ts` under `lib/`, and `export const config` is
  `CONFIG_DEFAULTS`, which §2 rule 3 confines to seed time. Nothing gates import direction.
- **`payroll-auditor` — BLOCK**, one Major that was a real hole, fixed before commit. See the
  correction block above: `continue` → `break` passed all 36 green. The missing-rate arm now carries
  a *rated* activity beside the unrated one, and that mutant is red by itself.
- Both lanes independently flagged that the split had dropped `lib/payroll/class.test.ts` out of
  `payroll-rules.md`'s `sources:` while the card still quotes its figures ⇒ rewriting the ใบ 025
  class arms would have left the pin green (counts, not content) **and** `check-knowledge` silent.
  Restored, which took the card 170 → **173** and fired the §5 warn ⇒ **[task 042](../todo/042-split-payroll-rules-card-at-the-engine-screen-seam.md)**.

`bash scripts/verify.sh` → `ALL GREEN` (selftest tier ran, `scripts/**` moved), with the one expected
new warn: `payroll-rules.md` 173 > 170.
