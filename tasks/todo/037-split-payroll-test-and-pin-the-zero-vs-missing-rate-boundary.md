# Split `lib/payroll.test.ts` (469/500), and pin the `0`-vs-missing rate boundary while splitting

- status: todo
- commit:

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
