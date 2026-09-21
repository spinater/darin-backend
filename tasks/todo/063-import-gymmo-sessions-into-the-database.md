# นำคาบสอนจาก Gymmo เข้าฐานข้อมูลจริง — สะพานเส้นสุดท้ายของค่าสอนคลาส

- status: todo
- commit:
- ต่อจาก [058](../done/058-read-gymmo-worklog.md) · เอนจินคิดเงินไม่ต้องแก้ (พิสูจน์แล้วใน [060](../todo-human/060-class-pay-proven-and-finance-export.md))

ทุกชิ้นของเส้นทางนี้พิสูจน์แล้วแยกกัน **ยกเว้นชิ้นที่เขียนลงฐาน**
⇒ ใบนี้คือชิ้นเดียวที่กั้นระหว่าง "คำนวณได้ในสคริปต์" กับ "ออกสลิปได้เองทุกเดือน"

| ชิ้น | สถานะ |
|---|---|
| อ่านไฟล์ `lib/gymmo.ts` | ✅ 3,211 แถว อ่านได้ 100% |
| จับคู่ชื่อ `lib/gymmo-map.ts` | ✅ 15 เทส |
| กฎคิดเงิน `lib/payroll.ts` | ✅ ตรงสลิปจริงถึงบาท (ธันยา ส.ค. = 3,050) |
| **เขียนลง `ClassSession`** | ❌ **ยังไม่มีอะไรเลย** |

---

## 1. 🔴 ปัญหาที่ต้องแก้ก่อน — นำเข้าซ้ำ = จ่ายซ้ำ

`ClassSession` วันนี้ไม่มีคีย์เอกลักษณ์นอกจาก `id` ⇒ อัปโหลดไฟล์เดิมสองครั้ง **จ่ายสองเท่า
โดยไม่มีอะไรแดง** และคนจะรู้ตอนปลายเดือน ซึ่งคือความผิดพลาดที่แพงที่สุดของระบบนี้ (§2 ข้อ 4)

### วิธีที่เลือก: คอลัมน์ `sourceKey` ที่ `@unique`

```prisma
model ClassSession {
  ...
  /// คีย์ของ "แถวหนึ่งแถวในไฟล์ Gymmo" — ชีต + วันที่ + เวลา + ชื่อคลาส
  /// มีเพื่อให้ **นำเข้าไฟล์เดิมซ้ำแล้วไม่เกิดแถวซ้ำ** (§2 ข้อ 4: จ่ายซ้ำคือเงินที่หายเงียบ)
  /// nullable เพราะแถวที่คีย์เข้ามาด้วยมือไม่มีต้นทางในไฟล์
  sourceKey String? @unique
}
```

- คีย์ประกอบจาก **ชีต + วันที่ + `timeText` + ชื่อคลาสดิบ** — ไม่ใช้ `booked/noShow` เพราะ
  Gymmo แก้ยอดคนย้อนหลังได้ ⇒ แถวเดิมที่ยอดเปลี่ยนต้อง **อัปเดต** ไม่ใช่เพิ่มใหม่
- ⛔ **ห้ามใช้ `date + classId + staffId` เป็นคีย์** — `lib/gymmo.ts` เก็บวันที่เป็นเที่ยงคืน UTC
  และครูคนเดียวสอนคลาสเดียวกันสองรอบในวันเดียวได้จริง ⇒ คีย์แบบนั้นจะกลืนคาบหนึ่งหายไปเงียบ ๆ
- นำเข้าใช้ `upsert` บน `sourceKey`

🔴 **แก้ schema = ทำแล้วถอยไม่ได้** (§2 ข้อ 8 · `prisma db push` ไม่มี down path)
⇒ สำรองฐานก่อน และใบนี้ **ต้องผ่านเลน `payroll-auditor`** (§9 — แตะ `prisma/schema.prisma`
และเส้นทางเงิน)

## 2. ขอบเขต

1. `prisma/schema.prisma` — เพิ่ม `sourceKey` ตามข้อ 1
2. `lib/gymmo-import.ts` — **ฟังก์ชันบริสุทธิ์**: รับแถวที่อ่านแล้ว + ตารางจับคู่
   → คืน **แผนการเขียน** (`upsert` อะไรบ้าง) + `problems[]` · ไม่แตะ DB เอง ⇒ เทสได้โดยไม่ต้องมีฐาน
3. ตัวเรียกบาง ๆ ที่เอาแผนไปเขียนจริงใน transaction เดียว
4. หน้าอัปโหลด: เลือกไฟล์ → **เห็นสรุปก่อนยืนยัน** (กี่คาบใหม่ · กี่คาบอัปเดต · กี่แถวมีปัญหา
   และปัญหาอะไร) → กดยืนยันถึงเขียน
5. `Staff.classCredit = 5000` และ seed `TrainerAlias` 6 แถว + `ClassPrice` ที่ยังขาด

## 3. ⛔ สิ่งที่แถวมีปัญหาต้องไม่ทำ

แถวที่จับคู่เทรนเนอร์หรือคลาสไม่ได้ **ห้ามถูกข้ามเงียบ ๆ และห้ามทำให้ทั้งไฟล์ล้ม**
⇒ ไฟล์นำเข้าได้เท่าที่อ่านได้ ที่เหลือขึ้นหน้าจอพร้อมเหตุผลต่อแถว (§2 ข้อ 4 · §2 ข้อ 6)

`lib/gymmo-map.ts` คืนเหตุผลเป็นข้อความไทยอยู่แล้ว — เอาไปแสดงตรง ๆ ไม่ต้องแปลใหม่

## 4. เสร็จแล้ววัดยังไง

- นำเข้าไฟล์ ม.ค.–ก.ย. → รันเงินเดือนเดือน ส.ค. → **ค่าสอนคลาสของธันยาต้องได้ 3,050**
  เท่ากับสลิปจริง โดยไม่มีใครแตะตัวเลขระหว่างทาง
- **นำเข้าไฟล์เดิมซ้ำอีกครั้ง → จำนวน `ClassSession` ต้องไม่เปลี่ยนเลยสักแถว**
  (นี่คือเทสที่ถ้าไม่มี ใบนี้ยังไม่เสร็จ)

---

## 5. What landed — items 1, 2, 3 and 5 (item 4 is still open)

🔴 **Item 4 (the upload screen) is blocked on two cards, and must not be built before them:**
[064](064-gymmo-import-problems-have-no-home.md) — an import `problem` is persisted nowhere, so a
คาบ that cannot be matched leaves no trace once the request ends · and
[065](065-deleting-an-imported-class-session-is-undone-by-the-next-import.md) — deleting an imported
คาบ is re-created by the next import, so the remediation for a duplicate re-doubles the pay.
Both are harmless **only** because nothing can import today: `planGymmoImport`, `previewGymmoImport`
and `applyGymmoImport` have zero callers. They arm themselves the hour item 4 lands.

| Item | File | State |
|---|---|---|
| 1 `sourceKey` | `prisma/schema.prisma` | ✅ `sourceKey String? @unique`, reasoning in the doc comment · pushed on the gate's throwaway postgres, **never against real data** |
| 2 pure planner | `lib/gymmo-import.ts` | ✅ `planGymmoImport` · `gymmoSourceKey` · `diffGymmoPlan` · `gymmoPlanRange` — no DB, no clock, no env |
| 3 thin caller | `lib/gymmo-import-run.ts` | ✅ `loadGymmoLookups` · `previewGymmoImport` · `applyGymmoImport` (one `$transaction`) |
| 4 upload screen | — | ❌ **not started** — the plan / problem / preview types are exported and serializable for it |
| 5 seed rows | `prisma/seed.ts` | ✅ 5 `ClassPrice` · 6 Gymmo `TrainerAlias` (2 new staff rows to hang two of them on) · `classCredit: 5000` (already there, now on all eight) |

Tests: `lib/gymmo-import.test.ts` **20** · `lib/payroll/slip.test.ts` **3 → 5**, both pinned in
`scripts/junit-pins.txt`. Knowledge:
`.docs/knowledge/domain/gymmo-import.md` (new) plus the five cards whose `sources:` this change
touched. `bash scripts/verify.sh` green, including the db stage pushing the new column and running
the seed twice (`created=75`, then `created=0` — the additions are withheld on every later run).

### 🔴 §4 is NOT measured yet

The real export (`trainer_worklogs_01012026_to_21092026.xlsx`) is **not in this repo**, so the 3,050
arm is a **synthetic** 24-row August fixture that reproduces the arithmetic through the real
`computePayslip`. The card's own measurement — import Jan–Sep, run August, get 3,050, then import
again and see **zero** rows change — still needs the file from linus's machine and a screen to upload
it through (item 4).

### Decisions taken here that are worth a second pair of eyes

- **`sourceKey` is `JSON.stringify([sheet, YYYY-MM-DD, timeText, rawClassName])`** — not a joined
  string. A `|` join has a reachable collision, since a sheet name and a class name are both free
  text: sheet `โอ|2026-08-01|07:15|Aqua Fit` + class `Body Pump` collides with sheet `โอ` + class
  `Aqua Fit|2026-09-02|09:00|Body Pump`. That pair is a test (the ใบ 035 bug class).
- **Two rows of one file with the same key → both to `problems`, neither written.** A last-write-wins
  would silently pick one of two head counts.
- **Two trainers (`ประพัฒน์ พันธุ์โยศรี` · `เกวลี เถาว์จันทร์`) are new staff rows at
  `baseSalary: 0`** — they had no `Staff` row at all, so there was nothing for their alias to point
  at. 0 and not 10,000 because nobody has said what they are paid; the seed's closing note asks for
  both numbers. ⇒ `Staff.count()` on a fresh database is now **9**, not 7.
- **A hand-keyed คาบ and an imported one can both exist for the same session** (`null` is exempt from
  `@unique`) ⇒ the preview counts hand-keyed rows in the same day range and the confirm screen must
  show that count.
- **`Reformer Pilates` is priced but its Gymmo spelling is deliberately not aliased**, and
  `LESMILLS CEREMONY HYROX` / `YOGA basic` / `Lesmills BodyJam` stay unpriced — all four are open
  questions (ใบ 050 §8.2 · ใบ 060 §7), so those rows queue loudly instead of paying a guess.
- 🔴 **Nothing has been reviewed yet** — §9 asks for `code-reviewer` **and** `payroll-auditor` on this
  diff (schema + the class-pay path), and neither has run.

---

## 6. Fix round after both §9 lanes returned BLOCK

Nine findings, all landed in the same change. Three money findings (1–3) ⇒ back through
`payroll-auditor`.

| # | Was | Now |
|---|---|---|
| 1 🔴 | `sourceKey` used the **raw** sheet name, and Gymmo appends `(Deleted)` when a trainer leaves ⇒ the month after somebody goes, nine months of their คาบ re-import as `create` and are **paid twice** with `warnings: []` — inside the column added to stop double pay | the key's trainer half is `readTrainerSheet(...).name` (suffix stripped, trimmed); the class half stays raw and the asymmetry is written down in the module, the card and here. **Two new arms**: the key is identical across `(Deleted)`, `(Deleted)` with a space, and a trailing space · the money half — a leaver's file diffs to `unchanged`, not `create`. Counter-tested: keying raw again kills both |
| 2 🔴 | a trainer with `baseSalary: 0` got a slip with **no base line and no warning** — real case: 5 คาบ taught, `net 0.00`, `warnings: []` | `computePayslip` warns when `role === "trainer" && !base`, naming ฐานเงินเดือน, its pair เครดิตสอนคลาส, and `/admin/config`. `lib/payroll/slip.test.ts` **3 → 5** (the warning · the role predicate, which a `!base`-only version passes). Counter-tested |
| 3 🔴 | seed gave the two new trainers `classCredit: 5000` on a base of 0 — §1.3 deducts the credit *because the base contains it* ⇒ ประพัฒน์ paid 3,400 of 8,400, **5,000/month short**, and it answered ใบ 062 §5 against the person | both seeded `classCredit: 0`, `TRAINERS` carries the field per row, and the closing note asks for **ฐาน + เครดิต as one pair** with the direction of each error spelled out |
| 4 | `gymmo: null` meant two different things; ประพัฒน์/เกวลี resolved only because `aliasesOf` normalises `username` ⇒ giving them a nickname later would silently send every คาบ to `problems` | both carry their Gymmo name **explicitly** (`aliasesOf` de-dupes, so no extra row). `null` now means one thing: teaches no classes |
| 5 | `parseGymmoGrids`'s own rejected rows were invisible in the type the screen is built from | `planGymmoImport` takes the whole `GymmoParse`; parse problems are converted to `{ where, reason }` and come **first** in one list. +1 arm |
| 6 | `applyGymmoImport` returned counts only ⇒ problems had no home after the write | it returns `problems` too (interim; persisting them is [064](064-gymmo-import-problems-have-no-home.md)) |
| 7 | nothing said a period was **closed** — a คาบ imported onto an approved slip reports `created: 1` and the next run skips that slip with a reason no screen renders | `GymmoImportPreview.closedPeriods` = non-draft `Payslip` rows in the periods the plan writes into, and the module header says the confirm screen must show it |
| 8 | only `handKeyedInRange`; no mirror | `importedInRangeNotInFile` — rows in range already imported that this file does not mention, floored at 0. The only screen-side signal for a moved `sourceKey` |
| 9 | `readExisting` re-declared `ExistingSession` structurally · "all six mappings are measured" over four `gymmo` values · pin note said เจ็ดอาร์ม · `gymmoRowLabel` exported with one caller · §4 caveat missing | type imported · reworded to "six sheet names resolve — four through a `gymmo` value, two because the sheet name **is** the username" (same wording in the card and above) · pin note counts fixed · unexported · caveat added below |

**The §4 caveat the auditor asked for:** the synthetic fixture's class **mix** is invented, so it
cannot fail for the reason the real run is most likely to — an unpriced or un-aliased class in
ธันยา's actual August (`Reformer Pilates (Platinum Class)` · `Lesmills BodyJam` · `YOGA basic` ·
`LESMILLS CEREMONY HYROX`) would put those คาบ in `problems`, the real class value would come in under
8,050, and every assertion in the test would still be green.

⚠️ Two things I did **not** do: `domain/gymmo-import.md` ships at **172/200**, inside the cap but in
the warn band — the clean split boundary is the *"What the seed plants"* + *"What is NOT proven"*
half, whose only source is `prisma/seed.ts`; I left it whole rather than open a card nobody asked
for. And `domain/payroll-rules.md` is at **186/200** after finding 2's four lines — [042](042-split-payroll-rules-card-at-the-engine-screen-seam.md)
is that split and is now the next thing that should happen before anyone adds to it.

---

## 7. Second fix round — `payroll-auditor` APPROVE-WITH-NITS

Five items. Pins **unchanged** (`lib/gymmo-import.test.ts` 20 · `lib/payroll/slip.test.ts` 5): item 1
extended an existing arm rather than adding one.

| # | Was | Now |
|---|---|---|
| 1 **major** | the key trimmed the trainer name but did not `normalizeTrainer` it, while `matchTrainer` does ⇒ identity narrower than resolution. `PT ธันยา มูลละคร` or one double space resolves fine (**nothing in `problems`**) and re-keys all 24 August คาบ ⇒ classValue 8,050 → 16,100, `classPay` **3,050 → 11,100 ฿ in one month**, repeated for every still-`draft` month | the key is `normalizeTrainer(readTrainerSheet(name).name)`. The existing arm now walks seven spellings — `(Deleted)`, `(Deleted)` with a space, trailing space, double space, `PT …`, `พี่…`, no space — all one key. Counter-tested: dropping the normalizer kills 2 arms. ⇒ the stored key is **not** a display name, and `lib/normalize.ts` is now a `sources:` entry because changing it re-keys every row |
| 2 | `closedPeriods` was on the preview only ⇒ the write path had no belt, and a slip approved between preview and confirm reported plain success | `readClosedPeriods` is re-read **inside the transaction** and returned on `GymmoImportResult`. It **reports rather than refuses**, deliberately: the คาบ was taught, no screen reopens a slip (card 013 item 2), so refusing would leave it recordable nowhere — and the non-draft lock already means no baht moves |
| 3 | the mirror was `importedInRange − (unchanged + update)`; `readExisting` has no date filter, so 12 rows hand-edited to a date outside the range cancelled 12 in-range orphans — `100 − 100 = 0` over ~4,800 ฿ | counted directly: `count({ sourceKey: { notIn: planKeys }, NOT: { sourceKey: null }, …inRange })`. The `Math.max(0, …)` and the paragraph defending it are gone |
| 4 | "Gymmo does not decorate a class name" overstated it — `HIIT ROX` → `LESMILLS CEREMONY HYROX` is a rename Gymmo has not caught up with | claim softened to *no decoration*; a Gymmo-side **rename** does re-key, the signal is `importedInRangeNotInFile`, and keying the resolved name is still wrong (an exact `ClassPrice` row beats an alias ⇒ resolved-name keys would re-key the whole history, raw keys yield one `update`) |
| 5 | `app/admin/config/page.tsx` said "13 class prices, 7 staff" | 18 and 9, and the round-trip estimate with it (~65 → ~75) — in the page **and** in `money-input-guards.md`, which lists that page as a source and went STALE the moment the comment moved |

### One thing I did that was not on the list

`domain/gymmo-import.md` reached **195/200** with these edits, so I split it rather than ship a card
two lines from a hard cap: **`domain/gymmo-import-data.md`** now holds *what the seed plants* and
*what is not proven*, its only source is `prisma/seed.ts`, and that source came **out** of the parent's
list (§5: shrink `sources:` with the prose). Both cards have index rows and cross-link. Result: 156 and
65 lines, both inside the band.

### Nothing else is half-done

Item 4 (the upload screen) is untouched and is the only scope item left; 064/065 are yours. The two
`baseSalary`/`classCredit` pairs still read 0 and the seed says so out loud. `domain/payroll-rules.md`
sits at **186/200** — [042](042-split-payroll-rules-card-at-the-engine-screen-seam.md) is that split.
