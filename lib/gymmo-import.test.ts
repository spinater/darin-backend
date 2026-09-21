import { describe, expect, test } from "bun:test";
import type { GymmoReadProblem, GymmoRow } from "./gymmo";
import {
  diffGymmoPlan,
  gymmoPlanRange,
  gymmoSourceKey,
  planGymmoImport,
  type ClassPriceRef,
  type ExistingSession,
} from "./gymmo-import";
import { normalizeTrainer } from "./normalize";
import { run, trainer } from "./payroll/fixtures";

/** `TrainerAlias` as the table stores it: the key is already normalized. */
const ALIASES = new Map([
  [normalizeTrainer("ธันยา มูลละคร"), "s-o"],
  [normalizeTrainer("สุดารัตน์ ไก่ทอง"), "s-ploy"],
]);

/** `ClassPrice` rows — the seeded thirteen plus the five linus priced in ใบ 050 §8.2, trimmed. */
const PRICES: ClassPriceRef[] = [
  { id: "c-core", name: "Core Strength" },
  { id: "c-aqua", name: "Aqua Fit" },
  { id: "c-combat", name: "Body Combat" },
  { id: "c-pump", name: "Body Pump" },
  { id: "c-step", name: "LESMILLS BODYSTEP" },
  { id: "c-zumba", name: "ZUMBA" },
  { id: "c-yoga", name: "Yoga Essential" },
];
const PRICE_OF: Record<string, number> = {
  "c-core": 200,
  "c-aqua": 400,
  "c-combat": 400,
  "c-pump": 400,
  "c-step": 400,
  "c-zumba": 300,
  "c-yoga": 400,
};

const AUG = (day: number) => new Date(Date.UTC(2026, 7, day));

const row = (over: Partial<GymmoRow> = {}): GymmoRow => ({
  trainerSheet: "ธันยา มูลละคร",
  rowNo: 1,
  date: AUG(4),
  timeText: "18:00",
  durationMin: 45,
  className: "Core Strength",
  kind: "class",
  booked: 5,
  attendeesRaw: "เอรา,อลัน เอรา,อลัน",
  noShow: 1,
  lateCancel: 0,
  ...over,
});

const plan = (rows: GymmoRow[], problems: GymmoReadProblem[] = []) =>
  planGymmoImport({ rows, problems }, ALIASES, PRICES);

describe("gymmoSourceKey", () => {
  test("is decodable, which is what makes it injective", () => {
    const key = gymmoSourceKey(row({ className: "Body Pump" }));
    // The trainer half is `normalizeTrainer`d (the arm below is why) and the class half is raw.
    expect(JSON.parse(key)).toEqual(["ธันยามูลละคร", "2026-08-04", "18:00", "Body Pump"]);
  });

  // 🔴 ใบ 035's bug class, one module over: a name containing the separator collides with a
  // different row's key. Here that is a คาบ that vanishes or a payment that doubles.
  test("a name containing the separator cannot collide the way a joined key does", () => {
    const a = row({
      trainerSheet: "โอ|2026-08-01|07:15|Aqua Fit",
      date: new Date(Date.UTC(2026, 8, 2)),
      timeText: "09:00",
      className: "Body Pump",
    });
    const b = row({
      trainerSheet: "โอ",
      date: new Date(Date.UTC(2026, 7, 1)),
      timeText: "07:15",
      className: "Aqua Fit|2026-09-02|09:00|Body Pump",
    });
    // The pair is reachable: both fields are free text typed by staff. A `|` join merges them…
    const joined = (r: GymmoRow) =>
      [r.trainerSheet, r.date.toISOString().slice(0, 10), r.timeText, r.className].join("|");
    expect(joined(a)).toBe(joined(b));
    // …and these are two different คาบ, so the real key must keep them apart.
    expect(gymmoSourceKey(a)).not.toBe(gymmoSourceKey(b));
  });

  test("quotes, commas and backslashes in a class name stay distinct too", () => {
    // The separators of the encoding that WAS chosen — the same attack, aimed at JSON.
    const a = gymmoSourceKey(row({ className: 'x","2026-08-04","18:00","y' }));
    const b = gymmoSourceKey(row({ className: "x" }));
    expect(a).not.toBe(b);
    expect(gymmoSourceKey(row({ className: "a\\b" }))).not.toBe(
      gymmoSourceKey(row({ className: "a\\\\b" })),
    );
  });

  // The card's ⛔: `date + classId + staffId` would swallow one of these two คาบ silently.
  test("one trainer teaching one class twice in a day is two keys, not one", () => {
    expect(gymmoSourceKey(row({ timeText: "07:15" }))).not.toBe(
      gymmoSourceKey(row({ timeText: "18:00" })),
    );
  });

  test("attendance is NOT in the key — a corrected head count updates the same คาบ", () => {
    expect(gymmoSourceKey(row({ booked: 5, noShow: 1 }))).toBe(
      gymmoSourceKey(row({ booked: 9, noShow: 0 })),
    );
  });

  // 🔴 **Identity must absorb every variance that resolution absorbs.** `matchTrainer` resolves a
  // sheet through `normalizeTrainer` (lower-cased · **all** whitespace removed · a leading `pt`/`พี่`
  // stripped) after `readTrainerSheet` drops the `(Deleted)` marker Gymmo appends when somebody
  // leaves. Anything those two forgive but the key does not is a **silent** duplication: resolution
  // still succeeds ⇒ nothing reaches `problems`, every row keys afresh, `diffGymmoPlan` reads
  // `create`, and คาบ already imported are paid twice with `warnings: []`. Each spelling below would
  // have re-created all 24 of ธันยา's August คาบ — class value 8,050 → 16,100, `classPay` 3,050 ฿ →
  // **11,100 ฿ in one month**, and again for every other still-`draft` month in the file.
  test("every spelling `matchTrainer` resolves to one person is ONE key", () => {
    const base = gymmoSourceKey(row({ trainerSheet: "ธันยา มูลละคร" }));
    for (const spelling of [
      "ธันยา มูลละคร(Deleted)", // Gymmo's leaver marker — the export already carries one
      "ธันยา มูลละคร (Deleted)",
      "ธันยา มูลละคร ", // one trailing keystroke
      "ธันยา  มูลละคร", // one double space
      "PT ธันยา มูลละคร", // the account re-typed with the prefix `normalizeTrainer` strips
      "พี่ธันยา มูลละคร",
      "ธันยามูลละคร",
    ])
      expect(gymmoSourceKey(row({ trainerSheet: spelling }))).toBe(base);
    // ⚠️ The stored key is therefore **not a display name**. If a screen ever needs the trainer's
    // name as the file spelled it, that is a second column — never the identity.
    expect(JSON.parse(base)[0]).toBe("ธันยามูลละคร");
  });
});

describe("planGymmoImport", () => {
  test("a class row becomes one write, both counts verbatim", () => {
    expect(plan([row()])).toEqual({
      writes: [
        {
          sourceKey: gymmoSourceKey(row()),
          date: AUG(4),
          classId: "c-core",
          staffId: "s-o",
          booked: 5,
          noShow: 1,
        },
      ],
      // Index-parallel display columns, for the one case where a written คาบ still needs a problem
      // row: its period's slip is already closed (`closedSlipOutcome`). Asserted whole, so a column
      // added here cannot arrive unreviewed.
      writeRefs: [
        {
          where: "ธันยา มูลละคร แถว 1",
          key: gymmoSourceKey(row()),
          kind: "session",
          trainerSheet: "ธันยา มูลละคร",
          className: "Core Strength",
          date: AUG(4),
          timeText: "18:00",
        },
      ],
      problems: [],
      ptRows: 0,
    });
  });

  // ใบ 025: `noShow > booked` is unreadable input, and the engine is the thing that says so.
  // Clamping — or "repairing" — it here hides the row from that check and pays a guess.
  test("negative attendance is written verbatim, not clamped, and is not a problem", () => {
    const p = plan([row({ booked: 2, noShow: 5 })]);
    expect(p.writes[0]).toMatchObject({ booked: 2, noShow: 5 });
    expect(p.problems).toEqual([]);
  });

  test("PT rows are excluded and counted — they are not คาบ and not problems", () => {
    const p = plan([row({ kind: "pt", className: "SENIOR TRAINER" }), row({ rowNo: 2 })]);
    expect(p.ptRows).toBe(1);
    expect(p.writes).toHaveLength(1);
    expect(p.problems).toEqual([]);
  });

  test("an unknown trainer is one problem and the rest of the file still imports", () => {
    const p = plan([
      row({ trainerSheet: "จักรเพชร พรมกัลป์(Deleted)", rowNo: 7 }),
      row({ rowNo: 8, timeText: "07:15" }),
    ]);
    expect(p.writes).toHaveLength(1);
    expect(p.problems).toHaveLength(1);
    expect(p.problems[0].where).toBe("จักรเพชร พรมกัลป์(Deleted) แถว 7");
    // `lib/gymmo-map.ts`'s own Thai sentence, rendered as it is (§3 of the card) — including the
    // tail that says a retired trainer's past คาบ are still owed.
    expect(p.problems[0].reason).toBe(
      'ไม่รู้จักเทรนเนอร์ "จักรเพชร พรมกัลป์" (Gymmo ระบุว่าออกแล้ว แต่คาบที่สอนไปแล้วยังต้องจ่าย) — ต้องผูกชื่อที่หน้าตั้งค่า',
    );
  });

  test("a class with no price is one problem, not a zero and not a failed file", () => {
    const p = plan([row({ className: "Lesmills BodyJam", rowNo: 3 }), row({ rowNo: 4 })]);
    expect(p.writes).toHaveLength(1);
    // 🔴 **`toEqual`, not `toMatchObject`, and that is the point of this arm.** It is the one
    // whole-object comparison over a `GymmoProblem` in the repo, so **a field added to that type goes
    // red here** — and the only other thing standing between this table and a baht column (T12) is a
    // doc comment. The fix round briefly downgraded this to `toMatchObject` while raising the pin
    // 20 → 22, which is exactly the shape of a coverage loss a pin cannot see.
    expect(p.problems).toEqual([
      {
        where: "ธันยา มูลละคร แถว 3",
        reason: 'ไม่รู้จักคลาส "Lesmills BodyJam" — ยังไม่มีราคาในระบบ และไม่มีชื่อพ้องที่ตั้งไว้',
        key: gymmoSourceKey(row({ className: "Lesmills BodyJam", rowNo: 3 })),
        kind: "session",
        trainerSheet: "ธันยา มูลละคร",
        className: "Lesmills BodyJam",
        date: AUG(4),
        timeText: "18:00",
      },
    ]);
  });

  // 🔴 ใบ 064, and the arm that decides whether that card works at all. The problem is stored under
  // `key`, and `applyGymmoImport` clears it with a keyed `deleteMany` over exactly the `sourceKey`s it
  // writes ⇒ the two must be the **same function's** output on the same row. The scenario: `Pilates
  // Flow` has no `ClassPrice` today, so the คาบ is a problem; a price is added and the file re-uploaded
  // ⇒ the same row now writes, and its problem row has to disappear in that transaction.
  test("a refused row is keyed by `gymmoSourceKey` itself, so adding the price clears it", () => {
    const refused = row({ className: "Pilates Flow", rowNo: 3 });
    const p = plan([refused]);
    expect(p.problems).toHaveLength(1);
    expect(p.problems[0].key).toBe(gymmoSourceKey(refused));
    expect(p.problems[0].kind).toBe("session");

    // The same row, once `Pilates Flow` exists: one write, under that same key.
    const priced = planGymmoImport({ rows: [refused], problems: [] }, ALIASES, [
      ...PRICES,
      { id: "c-pilates", name: "Pilates Flow" },
    ]);
    expect(priced.problems).toEqual([]);
    expect(priced.writes[0].sourceKey).toBe(p.problems[0].key);
  });

  // The period count reads `date` and the screen reads the two names, so a problem missing either is
  // a problem no `/payslips` figure can find and no human can act on.
  test("every problem carries the columns the queue needs — date, both names, non-empty key", () => {
    const p = plan(
      [
        row({ className: "Lesmills BodyJam", rowNo: 3 }),
        row({ trainerSheet: "ไม่รู้จัก", rowNo: 9 }),
      ],
      [
        {
          sheetName: "ชีตก",
          rowText: "4",
          rawWhen: "not a date",
          date: null,
          reason: "อ่านวันเวลาไม่ออก",
        },
      ],
    );
    for (const x of p.problems) expect(x.key.length).toBeGreaterThan(0);
    // The planner's two: dated, and named as the FILE spells the trainer — never the key's
    // normalized half (`ธันยามูลละคร`), which is not a display name.
    expect(p.problems[1]).toMatchObject({
      kind: "session",
      date: AUG(4),
      timeText: "18:00",
      className: "Lesmills BodyJam",
      trainerSheet: "ธันยา มูลละคร",
    });
    expect(p.problems[2]).toMatchObject({ kind: "session", trainerSheet: "ไม่รู้จัก" });
    // The reader's: it never got as far as a date or a class, which is exactly why no import can
    // ever clear it automatically — and why `date: null` counts in every period.
    expect(p.problems[0]).toMatchObject({
      kind: "row",
      date: null,
      className: null,
      timeText: null,
      trainerSheet: "ชีตก",
      key: JSON.stringify(["ชีตก", "4", "not a date"]),
    });
  });

  test("an aliased Gymmo spelling writes the ClassPrice id of the name the system holds", () => {
    // `GYMMO_CLASS_ALIASES`: Gymmo says `Body PUMP`, `ClassPrice` says `Body Pump`.
    const p = plan([row({ className: "Body PUMP" })]);
    expect(p.writes[0].classId).toBe("c-pump");
    // …and the key keeps the RAW spelling, so adding the exact name later updates this คาบ instead
    // of inserting a second copy of it.
    expect(JSON.parse(p.writes[0].sourceKey)[3]).toBe("Body PUMP");
  });

  // 🔴 A last-write-wins inside the transaction would pick one of two different head counts with
  // nobody told — §2 rule 4 with the evidence discarded.
  test("two rows of one file with the same key → both to problems, neither written", () => {
    const p = plan([row({ rowNo: 11, booked: 5 }), row({ rowNo: 12, booked: 9 })]);
    expect(p.writes).toEqual([]);
    expect(p.problems).toHaveLength(2);
    expect(p.problems.map((x) => x.where)).toEqual([
      "ธันยา มูลละคร แถว 11",
      "ธันยา มูลละคร แถว 12",
    ]);
    // Each problem names the other row, so a human can open the file at both lines.
    for (const x of p.problems) expect(x.reason).toContain("แถว 11 · ธันยา มูลละคร แถว 12");
  });

  test("an empty export plans nothing at all", () => {
    expect(plan([])).toEqual({ writes: [], writeRefs: [], problems: [], ptRows: 0 });
  });

  // A row `lib/gymmo.ts` could not read never becomes a คาบ either. The planner takes the whole
  // `GymmoParse` so a caller cannot hand over `rows` alone and leave those rows off the screen the
  // preview is built from (§2 rule 4) — and they arrive **first**, split into the same two columns.
  test("the reader's own rejected rows are carried in, converted, ahead of the planner's", () => {
    const p = plan(
      [row({ trainerSheet: "ไม่รู้จัก", rowNo: 9 })],
      [
        {
          sheetName: "ธันยา มูลละคร",
          rowText: "4",
          rawWhen: "31 SEP 2026, 07:15",
          date: null,
          reason: 'อ่านวันเวลาไม่ออก — "31 SEP 2026, 07:15"',
        },
      ],
    );
    expect(p.problems).toHaveLength(2);
    expect(p.problems[0]).toMatchObject({
      where: "ธันยา มูลละคร แถว 4",
      reason: 'อ่านวันเวลาไม่ออก — "31 SEP 2026, 07:15"',
    });
    expect(p.problems[1].where).toBe("ไม่รู้จัก แถว 9");
  });
});

describe("diffGymmoPlan", () => {
  const existing = (r: GymmoRow, over: Partial<ExistingSession> = {}): ExistingSession => ({
    sourceKey: gymmoSourceKey(r),
    date: r.date,
    classId: "c-core",
    staffId: "s-o",
    booked: r.booked,
    noShow: r.noShow,
    ...over,
  });

  // 🔴 The card's §4 test: re-importing the same file must not change one single row.
  test("the same file a second time writes nothing", () => {
    const rows = [row({ rowNo: 1 }), row({ rowNo: 2, timeText: "07:15" })];
    const p = plan(rows);
    expect(
      diffGymmoPlan(
        p,
        rows.map((r) => existing(r)),
      ),
    ).toEqual({
      create: [],
      update: [],
      unchanged: 2,
    });
  });

  // The money half of the `(Deleted)` arm above: this is the sequence that would have paid twice.
  test("the month after a trainer leaves, their file updates — it does not re-create", () => {
    const before = row({ trainerSheet: "ธันยา มูลละคร" });
    const after = row({ trainerSheet: "ธันยา มูลละคร(Deleted)" });
    expect(diffGymmoPlan(plan([after]), [existing(before)])).toEqual({
      create: [],
      update: [],
      unchanged: 1,
    });
  });

  test("a corrected head count is an update · an unseen คาบ is a create", () => {
    const seen = row({ rowNo: 1 });
    const fresh = row({ rowNo: 2, timeText: "07:15" });
    const d = diffGymmoPlan(plan([row({ rowNo: 1, booked: 9 }), fresh]), [existing(seen)]);
    expect(d.unchanged).toBe(0);
    expect(d.update).toHaveLength(1);
    expect(d.update[0]).toMatchObject({ booked: 9, sourceKey: gymmoSourceKey(seen) });
    expect(d.create).toHaveLength(1);
    expect(d.create[0].sourceKey).toBe(gymmoSourceKey(fresh));
  });
});

describe("gymmoPlanRange", () => {
  test("spans the first day to the end of the last, and is null when nothing is written", () => {
    const p = plan([row({ date: AUG(4) }), row({ date: AUG(20), rowNo: 2 })]);
    expect(gymmoPlanRange(p)).toEqual({ from: AUG(4), to: AUG(21) });
    expect(gymmoPlanRange(plan([]))).toBeNull();
  });
});

/**
 * ⚠️ **Synthetic, not the real export.** `trainer_worklogs_01012026_to_21092026.xlsx` is on
 * linus's machine and not in this repo, so this fixture *reproduces the arithmetic* of ธันยา's
 * August slip (24 คาบ · 8,050 ฿ of class value · quota 5,000 ⇒ 3,050 ฿) with seeded prices and the
 * existing config rule. It proves the import→engine seam carries the figure; it does **not** prove
 * the nine-month file, which still has to be run against the real export (ใบ 063 §4).
 */
describe("ธันยา ส.ค. 2026 — the plan reaches 3,050 through the engine", () => {
  const aug = (day: number, timeText: string, className: string, booked: number, noShow = 0) =>
    row({ rowNo: day, date: AUG(day), timeText, className, booked, noShow });

  const rows: GymmoRow[] = [
    // 8 × BODYSTEP full (400) = 3,200 · 8 × Body Combat full (400) = 3,200
    ...Array.from({ length: 8 }, (_, i) => aug(i + 1, "07:15", "LESMILLS BODYSTEP", 6)),
    ...Array.from({ length: 8 }, (_, i) => aug(i + 1, "18:00", "Body Combat", 4)),
    // 3 × Aqua Fit full (400) = 1,200 · 1 × Aqua Fit half, 2 came (200)
    ...Array.from({ length: 3 }, (_, i) => aug(i + 10, "09:00", "Aqua Fit", 5)),
    aug(14, "09:00", "Aqua Fit", 4, 2),
    // 1 × Core Strength half, 1 came (100) · 1 × ZUMBA half, 1 came (150)
    aug(15, "19:00", "Core Strength", 1),
    aug(16, "19:00", "ZUMBA", 3, 2),
    // 2 คาบ nobody booked — 0 ฿ and, per ใบ 050 §8.2, genuinely empty classes
    aug(17, "09:00", "Aqua Fit", 0),
    aug(18, "09:00", "Aqua Fit", 0),
  ];

  test("24 คาบ · 8,050 − โควต้า 5,000 = 3,050 and no warning", () => {
    const p = plan(rows);
    expect(p.problems).toEqual([]);
    expect(p.writes).toHaveLength(24);

    // The plan's rows, as `runPayroll` hands them to the engine (`include: { class: true }`).
    const r = run({
      staff: trainer({ id: "s-o", name: "ธันยา มูลละคร", classCredit: 5000 }),
      classSessions: p.writes.map((w) => ({
        className: w.classId,
        price: PRICE_OF[w.classId],
        booked: w.booked,
        noShow: w.noShow,
      })),
    });
    const classValue = r.lines
      .filter((l) => l.group === "class" && l.amount > 0)
      .reduce((s, l) => s + l.amount, 0);
    expect(classValue).toBe(8050);
    expect(r.classPay).toBe(3050);
    expect(r.warnings).toEqual([]);
  });
});
