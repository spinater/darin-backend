import { describe, expect, test } from "bun:test";
import {
  closedSlipOutcome,
  gymmoProblemRows,
  readProblemKey,
  readProblemLabel,
  toGymmoProblem,
  type GymmoProblem,
} from "./class-problems";
import type { GymmoRow } from "./gymmo";
import { gymmoSourceKey, planGymmoImport, type ClassPriceRef } from "./gymmo-import";
import { normalizeTrainer } from "./normalize";

const ALIASES = new Map([[normalizeTrainer("ธันยา มูลละคร"), "s-o"]]);
const PRICES: ClassPriceRef[] = [{ id: "c-core", name: "Core Strength" }];

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
  attendeesRaw: "",
  noShow: 1,
  lateCancel: 0,
  ...over,
});

const plan = (rows: GymmoRow[]) => planGymmoImport({ rows, problems: [] }, ALIASES, PRICES);

/** A reader reject, as `lib/gymmo.ts` now hands it over — the `#` and the `Date & Time` cell verbatim. */
const reject = (over: Partial<Parameters<typeof toGymmoProblem>[0]> = {}) => ({
  sheetName: "ชีตก",
  rowText: "4",
  rawWhen: "4 AUG 2026, 18:00",
  date: AUG(4),
  reason: "ไม่รู้จักชนิด",
  ...over,
});

describe("gymmoProblemRows", () => {
  // 🔴 **The load-bearing one.** The in-file duplicate rule pushes TWO problems — one per offending
  // row, each naming the other — for ONE `sourceKey`. Without the merge, `createMany` throws P2002
  // and the **whole import transaction aborts**: a file that imported yesterday fails on every
  // attempt today because one row in it is duplicated. Dropping the second instead would throw away
  // half the evidence about the thing a human has to look at.
  test("two problems on one key become one row carrying both labels and both reasons", () => {
    const p = plan([row({ rowNo: 11, booked: 5 }), row({ rowNo: 12, booked: 9 })]);
    expect(p.writes).toEqual([]);
    expect(p.problems).toHaveLength(2);
    expect(p.problems[0].key).toBe(p.problems[1].key);

    const rows = gymmoProblemRows(p.problems);
    expect(rows).toHaveLength(1);
    expect(rows[0].rowLabel).toBe("ธันยา มูลละคร แถว 11 · ธันยา มูลละคร แถว 12");
    // Both reasons survive — they differ, because each names the row it is not.
    for (const label of ["แถว 11", "แถว 12"]) expect(rows[0].reason).toContain(label);
    expect(rows[0].reason.split(" · ").length).toBeGreaterThan(1);
  });

  // 🔴 The arm that decides whether task 064 works at all. `applyGymmoImport` clears a problem with a
  // keyed `deleteMany` over exactly the `sourceKey`s it writes, so the stored key must be
  // `gymmoSourceKey`'s own output on that row. One byte of drift and the delete never matches: a คาบ
  // that has been fixed stays queued for ever and `/payslips` blocks a period that is in fact clean.
  test("a session key is byte-identical to gymmoSourceKey, so a clean import clears it", () => {
    const unknown = row({ trainerSheet: "จักรเพชร พรมกัลป์", rowNo: 7 });
    const rows = gymmoProblemRows(plan([unknown]).problems);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe(gymmoSourceKey(unknown));
    expect(rows[0].kind).toBe("session");

    // The clearing, as the transaction performs it: the delete set is the plan's write keys, and the
    // same row — once its `TrainerAlias` exists — writes under exactly that key.
    const fixed = planGymmoImport(
      { rows: [unknown], problems: [] },
      new Map([...ALIASES, [normalizeTrainer("จักรเพชร พรมกัลป์"), "s-jak"]]),
      PRICES,
    );
    expect(fixed.problems).toEqual([]);
    expect(fixed.writes.map((w) => w.sourceKey)).toContain(rows[0].key);
  });

  // Three shapes share one column, so they are kept apart by **arity** rather than by a prefix or a
  // separator — the decodability argument `gymmoSourceKey` already rests on (ใบ 035's bug class).
  test("a session key, a row key and a sheet key can never collide", () => {
    const session = gymmoProblemRows(plan([row({ trainerSheet: "ไม่รู้จัก" })]).problems)[0].key;
    const rowKey = readProblemKey(reject());
    const sheetKey = readProblemKey(reject({ rowText: null, rawWhen: null }));

    const arities = [session, rowKey, sheetKey].map((k) => JSON.parse(k).length);
    expect(arities).toEqual([4, 3, 1]);
    expect(new Set([session, rowKey, sheetKey]).size).toBe(3);
  });

  // A blank `#` cell is still a row. Keying it as the sheet (`null`) would merge a readable row onto
  // the sheet's own problem and lose one reason; and two blank-`#` rejects on one sheet DO share a
  // key, which is the second real case the merge above exists for.
  test("a blank `#` keys stably as a row and does not collide with the sheet", () => {
    const blank = reject({ rowText: "", reason: "ไม่มีชื่อคลาส" });
    expect(readProblemKey(blank)).toBe(JSON.stringify(["ชีตก", "", "4 AUG 2026, 18:00"]));
    expect(readProblemKey(blank)).not.toBe(
      readProblemKey({ ...blank, rowText: null, rawWhen: null }),
    );
    expect(readProblemLabel(blank)).toBe("ชีตก แถว ?");

    // Two blank-`#` rejects on one sheet: one stored row, both reasons.
    const rows = gymmoProblemRows([
      toGymmoProblem(blank),
      toGymmoProblem({ ...blank, reason: "ไม่รู้จักชนิด" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe("ไม่มีชื่อคลาส · ไม่รู้จักชนิด");
    expect(rows[0].kind).toBe("row");
    // 🔴 The date is CARRIED, not nulled: both of these rejects happened after `parseGymmoWhen`
    // succeeded, and a `null` here would put them in every period's blocker count for ever, because a
    // `"row"` problem has no clearing path (ใบ 066).
    expect(rows[0].date).toEqual(AUG(4));
  });

  // ⇒ the key's trainer half is `normalizeTrainer` output and is **not a display name**. A screen
  // that read it would show `ธันยามูลละคร`, so the file's own spelling is a stored column.
  test("trainerSheet is the file's spelling, not the normalized half of the key", () => {
    const spelled = row({ trainerSheet: "PT ธันยา  มูลละคร", className: "Pilates Flow" });
    const rows = gymmoProblemRows(plan([spelled]).problems);
    expect(rows[0].trainerSheet).toBe("PT ธันยา  มูลละคร");
    expect(JSON.parse(rows[0].key)[0]).toBe("ธันยามูลละคร");
    expect(rows[0].className).toBe("Pilates Flow");
    expect(rows[0].date).toEqual(AUG(4));
  });

  // The rows go into one `createMany`, so their order is what an unstable output would leak into the
  // database. First appearance, reader rejects first — because `planGymmoImport` puts them first.
  test("row order is first appearance and is a deterministic function of the plan", () => {
    const unpriced = row({ rowNo: 13, timeText: "07:15", className: "Pilates Flow" });
    const problems: GymmoProblem[] = [
      toGymmoProblem(
        reject({
          sheetName: "ชีตข",
          rowText: null,
          rawWhen: null,
          date: null,
          reason: "ไม่พบหัวตาราง",
        }),
      ),
      ...plan([row({ rowNo: 11 }), row({ rowNo: 12 }), unpriced]).problems,
    ];
    // Four problems — the sheet, the unpriced คาบ, and rows 11/12 which collide on one key — and the
    // duplicate pair is pushed after the row loop, so it comes last.
    expect(problems).toHaveLength(4);

    const keys = gymmoProblemRows(problems).map((r) => r.key);
    expect(keys).toEqual(gymmoProblemRows(problems).map((r) => r.key));
    expect(keys).toEqual([
      JSON.stringify(["ชีตข"]),
      gymmoSourceKey(unpriced),
      gymmoSourceKey(row({ rowNo: 11 })),
    ]);
  });
  // 🔴 **`#` is a per-sheet running number that RESTARTS in every export**, so it is not an identity
  // across files. Keyed on `[sheet, "14"]` alone, uploading September would `deleteMany` August's
  // still-true problem and write an unrelated คาบ's reason under that key — T3's silent loss reached
  // through a key that is not an identity rather than through a date range. The raw `Date & Time` cell
  // is what makes the two rows distinguishable even though neither of them parsed.
  test("row 14 of two different exports is two keys, not one", () => {
    const august = reject({ sheetName: "ประพัฒน์", rowText: "14", rawWhen: "4 AUG 2026, 18:00" });
    const september = reject({
      sheetName: "ประพัฒน์",
      rowText: "14",
      rawWhen: "2 SEP 2026, 07:15",
    });
    expect(readProblemKey(august)).not.toBe(readProblemKey(september));
    // Both survive one write — neither deletes the other.
    const rows = gymmoProblemRows([toGymmoProblem(august), toGymmoProblem(september)]);
    expect(rows).toHaveLength(2);
    // …and the label a human reads is the same for both, which is exactly why the key may not be.
    expect(new Set(rows.map((r) => r.rowLabel)).size).toBe(1);
  });

  // 🔴 **A written คาบ is not a paid คาบ.** `runPayroll` refuses to recompute a non-draft slip and no
  // screen reopens one ⇒ a คาบ imported into an `approved` month is never paid by anybody. Measured:
  // ประพัฒน์ (`baseSalary: 0`, `classCredit: 0`), 20 `Pilates Flow` คาบ in 08/2026 ⇒ 8,000 ฿, his whole
  // month. The first cut of this card deleted those twenty problem rows on the import that wrote them
  // and left `/payslips?period=2026-08` reading 0 in **both** counts.
  test("a write landing in a closed period is a problem again, under the same key", () => {
    const p = plan([row(), row({ rowNo: 2, timeText: "07:15" })]);
    expect(p.problems).toEqual([]);
    expect(p.writeRefs).toHaveLength(2);
    // As `applyGymmoImport` pairs them: `writeRefs` is index-parallel to `writes`.
    const entries = p.writeRefs.map((ref, i) => ({
      ref,
      staffId: p.writes[i].staffId,
      written: true,
    }));
    expect(entries.map((e) => e.staffId)).toEqual(["s-o", "s-o"]);

    // Nothing closed ⇒ nothing extra, so the ordinary import still clears as before.
    expect(closedSlipOutcome(entries, new Map())).toEqual({ problems: [], leaveAlone: [] });
    // A closed slip in a DIFFERENT month of the same staff member ⇒ still nothing.
    expect(closedSlipOutcome(entries, new Map([["s-o", new Map([["2026-09", "paid"]])]]))).toEqual({
      problems: [],
      leaveAlone: [],
    });
    // 🔴 And a closed slip belonging to a DIFFERENT staff member in the very same month ⇒ still
    // nothing. This is the common case, not an edge: an admin approves slips one at a time, so a
    // month routinely holds one trainer's `approved` beside another's `draft`. A period-level test
    // would flag every คาบ of that month, including ones the next run really will pay — a false
    // "ยังไม่ถูกจ่าย" is crying wolf, which kills the count this card exists to add.
    expect(
      closedSlipOutcome(entries, new Map([["s-other", new Map([["2026-08", "approved"]])]])),
    ).toEqual({ problems: [], leaveAlone: [] });

    const closed = closedSlipOutcome(
      entries,
      new Map([["s-o", new Map([["2026-08", "approved"]])]]),
    );
    expect(closed.leaveAlone).toEqual([]);
    expect(closed.problems).toHaveLength(2);
    // Same key as the write ⇒ delete-then-insert replaces the stale reason instead of colliding.
    expect(closed.problems.map((c) => c.key)).toEqual(p.writes.map((w) => w.sourceKey));
    // The reason names the period, the real status, the way out, and where the policy question lives.
    expect(closed.problems[0].reason).toContain("2026-08");
    expect(closed.problems[0].reason).toContain("approved");
    expect(closed.problems[0].reason).toContain("ใบ 013");
    expect(closed.problems[0].kind).toBe("session");
  });

  // 🔴 **The other direction, and it is the one that survived two reviews.** `unchanged` means NOTHING
  // was written — the คาบ was already in `ClassSession` — so a closed slip beside it is overwhelmingly
  // likely to be the slip that **paid** it. Measured: ธันยา (`โอ`, `classCredit: 5000`), 08/2026, 24
  // คาบ, class value 8,050 ⇒ `classPay = 3,050 ฿`, slip `paid`. Re-uploading the Jan–Sep workbook in
  // October to pick up September — the flow `lib/gymmo-import-run.ts`'s header mandates — makes August
  // `created: 0, updated: 0, unchanged: 24`, and the previous cut manufactured 24 rows claiming those
  // คาบ were **ยังไม่ถูกจ่าย**. Five paid months ⇒ five permanently non-zero false counts, and
  // ประพัฒน์'s twenty genuinely unpaid 8,000 ฿ rows become indistinguishable from them.
  //
  // ⚠️ And it is `leaveAlone`, NOT merely "no problem": the key must also leave the caller's delete
  // set, or a **true** closed-slip row an earlier import recorded gets deleted and not re-inserted —
  // a false positive traded for a false negative, in the money direction.
  test("an unchanged write in a closed period is not a problem — and is left exactly as found", () => {
    const p = plan([row(), row({ rowNo: 2, timeText: "07:15" })]);
    const august = new Map([["s-o", new Map([["2026-08", "paid"]])]]);
    const entry = (written: boolean) =>
      p.writeRefs.map((ref, i) => ({ ref, staffId: p.writes[i].staffId, written }));

    expect(closedSlipOutcome(entry(false), august)).toEqual({
      problems: [],
      leaveAlone: p.writes.map((w) => w.sourceKey),
    });
    // An unchanged write whose slip is still OPEN is not left alone — its stale reason must clear.
    expect(closedSlipOutcome(entry(false), new Map())).toEqual({ problems: [], leaveAlone: [] });
    // The two halves are disjoint by construction: a key is reported once, never in both.
    const mixed = closedSlipOutcome([...entry(true).slice(0, 1), ...entry(false).slice(1)], august);
    expect(mixed.problems.map((x) => x.key)).toEqual([p.writes[0].sourceKey]);
    expect(mixed.leaveAlone).toEqual([p.writes[1].sourceKey]);
  });

  // 🔴 The count excludes a `"session"` key whose คาบ has since imported — but an in-file duplicate's
  // คาบ may be stored at the **wrong amount** (stored booked 5 / noShow 3 ⇒ attended 2 ⇒ half of 400 =
  // 200 ฿, against the file's booked 9 / noShow 0 ⇒ 400 ฿). So its existence proves nothing, and
  // `kind` is what tells the count not to exclude it.
  test("an in-file duplicate is kind `duplicate`, so its คาบ existing proves nothing", () => {
    const rows = gymmoProblemRows(
      plan([row({ rowNo: 11, booked: 5, noShow: 3 }), row({ rowNo: 12, booked: 9, noShow: 0 })])
        .problems,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("duplicate");
    // Not "row": it does have a real `sourceKey`, so fixing the file does clear it.
    expect(JSON.parse(rows[0].key)).toHaveLength(4);
  });
});
