---
sources:
  # The whole card is about rows this file plants (or withholds) — `CLASSES`, the `TRAINERS` table with
  # its `gymmo` sheet names, and the `baseSalary`/`classCredit` pair. Nothing else belongs in
  # `sources:`: the mechanism that reads these rows is gymmo-import.md's, and a narrow list is what
  # keeps a card from going stale for a reason that is not about it (CLAUDE.md §5).
  - prisma/seed.ts
---

# What the Gymmo import needs in the database — and what nobody has answered

Split out of [gymmo-import.md](gymmo-import.md) at task 063's fix round, when that card reached
195/200. That one is the mechanism (the `sourceKey`, the refusals, the write); this one is the **data**
without which the mechanism resolves nothing, and the open questions attached to it.

Everything here is seed **fixture** data, so [../ops/deploy.md](../ops/deploy.md)'s three modes apply
in full: planted on `initialize` only, **withheld on `adopt` and `already-initialized`**, never
re-created. On the live database that means all of it must be keyed in by hand.

## What the seed plants, and what it cannot

`prisma/seed.ts` carries three things this path needs: **`classCredit: 5000`** on the six trainers who
have a base salary (the quota that turns 8,050 into 3,050), the **six Gymmo sheet names as
`TrainerAlias` rows** (measured against the September timetable, ใบ 052 §10 — six for six: four
through a `gymmo` value that differs from the username, two where the sheet name **is** the username
and is written out anyway, so giving that person a nickname later cannot silently send every คาบ of
theirs to `problems`), and **five class prices** linus gave in ใบ 050 §8.2.

- On the live database that means all of it must be keyed by hand. The seed's report names the
  missing classes on every deploy (`ClassPrice` has no screen — task 046); an alias can be added at
  `/admin/config`, and until it is, every คาบ of that trainer is a `problem` row, which is loud at
  exactly the moment money would move.
- **Three class names are deliberately unpriced** — `LESMILLS CEREMONY HYROX`, `YOGA basic`,
  `Lesmills BodyJam` — because nobody has given a price (ใบ 060 §7). Their rows say
  `ยังไม่มีราคาในระบบ` and wait; a seeded guess would pay a made-up number.
- **`Reformer Pilates` is priced but its Gymmo spelling is not aliased**: Gymmo exports
  `Reformer Pilates (Platinum Class)` and the timetable says `DARIN reformer CLASS`, and which is the
  real class is an open question (ใบ 050 §8.2). A guessed alias would pay 400 ฿ per คาบ on an answer
  nobody gave.
- 🔴 Two trainers (`ประพัฒน์ พันธุ์โยศรี` · `เกวลี เถาว์จันทร์`) are seeded **`baseSalary: 0` AND
  `classCredit: 0`, as one pair**, and named in the seed's closing note. They have no sales book, so
  nobody has said what they are paid, and 10,000 copied across would be paid silently every month. The
  credit is the same decision from the other side: §1.3 deducts 5,000 of class value *because the base
  already contains it*, so a 5,000 credit on a base of 0 cancels pay that was never given — ประพัฒน์ at
  21 คาบ × 400 would be paid `max(0, 8400 − 5000) = 3,400` of the 8,400 he earned, 5,000 short a month
  with `warnings: []`. Whether a smaller base carries a smaller obligation is **open with linus**
  ([062](../../../tasks/todo-human/062-teaching-credit-is-an-obligation-not-a-deduction.md) §5) ⇒ 0
  answers nothing, 5,000 answers it against the person. `computePayslip` now warns about the 0 base —
  [payroll-rules.md](payroll-rules.md) rule 3.

## ⚠️ What is NOT proven yet

- **The nine-month file has never been imported.** The real export lives on linus's machine and is
  not in this repo, so the 3,050 arm of `lib/gymmo-import.test.ts` reproduces ธันยา's August
  arithmetic from a **synthetic** 24-row fixture. ใบ 063 §4 is measured only when the real Jan–Sep
  file runs: import → August run → 3,050, then import again → **not one `ClassSession` changes**.
  ⚠️ **And because the class *mix* in that fixture is invented, it cannot fail for the reason the real
  run is most likely to fail**: an unpriced or un-aliased class in ธันยา's actual August
  (`Reformer Pilates (Platinum Class)` · `Lesmills BodyJam` · `YOGA basic` ·
  `LESMILLS CEREMONY HYROX`) would put those คาบ in `problems`, the real class value would come in
  under 8,050 — and every assertion in this test would still be green.
- **There is no upload screen** (ใบ 063 item 4) — nothing calls these two modules yet, so no role
  check exists to review either.
- No test here touches a database; the transaction itself is reviewed, not pinned
  ([../ops/gate-tiers-and-pins.md](../ops/gate-tiers-and-pins.md)).
