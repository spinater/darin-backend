import { expect, test, describe } from "bun:test";
import {
  COLOR_MEANINGS,
  COLOR_MEANING_LABELS,
  colorGaps,
  isColorMeaning,
  isNeutralBg,
} from "./color-rules";

/**
 * The colour-rule gap, tested where it is pure (task 043).
 *
 * 🔴 **What these tests do NOT prove.** `colorGapsInPeriod()` and `colorGapsSeen()` run queries, and
 * `bun test` here has no database (`scripts/check-code.sh` runs it before the throwaway postgres
 * exists) ⇒ that the filter really mirrors `runPayroll`'s (`status: "ok"` · period · `staffId` not
 * null) is **reviewed**, not asserted. What is pinned is the fold those queries feed — every
 * decision of this card lives in `colorGaps`.
 *
 * 🔑 Why this fold is worth pinning at all: it is the only thing standing between "a colour the
 * counter staff use to cancel a คาบ" and a payslip that pays it. `syncSources()` has no rule for an
 * unknown colour, so the row lands as `status: "ok"` with `warnings: []` and no screen says a word
 * — the failure §2 rule 4 exists for. A fold that drops one colour drops the whole month's worth
 * of คาบ behind it, silently and in the direction of paying too much.
 */

const seen = (hex: string | null, sessions: number, reviewedSessions = 0) => ({
  hex,
  sessions,
  reviewedSessions,
});

describe("colorGaps — สีที่กำลังจ่ายโดยไม่มีใครรับรอง (ใบ 043)", () => {
  test("a colour the sheet uses and no rule explains is reported with its count", () => {
    expect(colorGaps([seen("#b6d7a8", 12)], [])).toEqual([
      { hex: "#b6d7a8", sessions: 12, reviewedSessions: 0, pending: 12, state: "unruled" },
    ]);
  });

  test("only `pay` retires a colour — `skip`/`review` stay listed while payable rows carry them", () => {
    // 🔴 The arm that BLOCKed round 1. `ColorRule` is applied **at sync time only**, and
    // `syncSources()` skips a `reviewed: true` row before it ever reaches the colour lookup ⇒
    // answering "ไม่จ่าย" does not move the คาบ already in the database. A fold that retired a
    // colour the moment it was answered would go quiet at exactly the moment the money is most
    // wrong — 12 ว่ายน้ำ คาบ × 250 = 3,000 ฿ paid for คาบ the owner has just declared cancelled,
    // with the only screen that said so switched off by their own correct answer.
    const rows = [seen("#b6d7a8", 3), seen("#ea9999", 4), seen("#ffe599", 5)];
    const rules = [
      { hex: "#b6d7a8", meaning: "pay" },
      { hex: "#ea9999", meaning: "skip" },
      { hex: "#ffe599", meaning: "review" },
    ];
    expect(colorGaps(rows, rules)).toEqual([
      {
        hex: "#ffe599",
        sessions: 5,
        reviewedSessions: 0,
        pending: 5,
        state: "unapplied",
        meaning: "review",
      },
      {
        hex: "#ea9999",
        sessions: 4,
        reviewedSessions: 0,
        pending: 4,
        state: "unapplied",
        meaning: "skip",
      },
    ]);
  });

  test("a `skip` colour with no payable rows left is gone — the queue can reach zero", () => {
    // The other half of the arm above: once a sync has actually applied the rule, the rows are
    // `ignored`, the query returns nothing for that colour, and it disappears. A list that could
    // not empty would be a list nobody reads.
    expect(colorGaps([], [{ hex: "#ea9999", meaning: "skip" }])).toEqual([]);
  });

  test("a `meaning` outside the closed set is an unruled colour, not an answer", () => {
    // `lib/sync.ts` tests `=== "skip"` / `=== "review"` and falls through everything else ⇒ a junk
    // value pays. The report must say what the sync does, not what the row claims.
    expect(colorGaps([seen("#ea9999", 4)], [{ hex: "#ea9999", meaning: "" }])).toEqual([
      { hex: "#ea9999", sessions: 4, reviewedSessions: 0, pending: 4, state: "unruled" },
    ]);
  });

  test("hand-reviewed คาบ are carried and summed — no sync will ever repair them", () => {
    // `if (prev?.reviewed) continue` in `lib/sync.ts` means these rows are skipped before the
    // colour lookup, for ever — and no screen lists them either (`NEEDS_ATTENTION` is
    // `needs_review` **or** `ok`-with-no-trainer; these are `ok` *with* one) ⇒ ยังไม่มีหน้าจอไหน
    // แก้ได้, ใบ 070. The count has to survive the fold to be able to say so.
    expect(colorGaps([seen("#ea9999", 4, 4), seen("#ea9999", 8, 2)], [])).toEqual([
      { hex: "#ea9999", sessions: 12, reviewedSessions: 6, pending: 12, state: "unruled" },
    ]);
  });

  test("case is not part of a colour — on either side, and duplicates merge", () => {
    // Google returns `#B6D7A8`; `addColor` stores `#b6d7a8`; `syncSources()` lowercases both before
    // its own lookup. If this fold did not, the same colour would be listed as unruled right beside
    // its own rule — an owner asked to answer a question they already answered stops answering.
    expect(
      colorGaps(
        [seen("#B6D7A8", 2), seen("#b6d7a8", 3), seen("#EA9999", 7)],
        [{ hex: "#EA9999", meaning: "pay" }],
      ),
    ).toEqual([{ hex: "#b6d7a8", sessions: 5, reviewedSessions: 0, pending: 5, state: "unruled" }]);
  });

  test("an uncoloured cell is never reported, however many คาบ carry it", () => {
    // `rgbToHex()` renders an unstyled cell as `#ffffff`, and the xlsx path renders a deliberate
    // white fill as `#ffffff` too — the same bytes ⇒ a white signal is not in the data to be found.
    // Reporting it would light the warning permanently for a colour that carries no decision.
    expect(
      colorGaps(
        [seen("#ffffff", 900), seen("#FFFFFF", 100), seen(null, 40), seen("#b6d7a8", 1)],
        [],
      ),
    ).toEqual([{ hex: "#b6d7a8", sessions: 1, reviewedSessions: 0, pending: 1, state: "unruled" }]);
  });

  test("a written rule being ignored sorts above an open question, then by คาบ, then by hex", () => {
    expect(
      colorGaps(
        [seen("#ffe599", 2), seen("#ea9999", 200), seen("#b6d7a8", 2), seen("#9fc5e8", 1)],
        [{ hex: "#9fc5e8", meaning: "skip" }],
      ).map((c) => c.hex),
    ).toEqual(["#9fc5e8", "#ea9999", "#b6d7a8", "#ffe599"]);
  });

  test("🔴 `pending: 0` never retires a colour — a reviewed row is not evidence about its colour", () => {
    // The round-3 BLOCK, and the highest-value arm in this file. `reviewed: true` records that
    // somebody resolved the row's **parse** problem; `/sync/review` never renders `bgColor`, and the
    // one note that carried it (`สีในชีตต้องให้คนตรวจ (#hex)`) is overwritten with
    // `"คนตรวจยืนยันแล้ว"` on resolve ⇒ nothing in the database says anyone ever saw this colour.
    //
    // ว่ายน้ำ makes it the guaranteed path, not a corner: `prisma/seed.ts` gives that sheet
    // `trainer: null`, so **every** payable swim คาบ is hand-cleared by construction. Retire on
    // `pending === 0` and the honest answer "ให้คนตรวจ" silences all three screens in the same page
    // load, over 40 × 250 = 10,000 ฿ nobody has looked at — round 1's blocker through a new door.
    expect(colorGaps([seen("#9fc5e8", 40, 40)], [{ hex: "#9fc5e8", meaning: "review" }])).toEqual([
      {
        hex: "#9fc5e8",
        sessions: 40,
        reviewedSessions: 40,
        pending: 0,
        state: "unapplied",
        meaning: "review",
      },
    ]);
  });

  test("a `review` colour counts only the คาบ nobody has looked at yet", () => {
    // The asymmetry is real, not a rounding: under `skip` a reviewed row still **openly disagrees**
    // (a human said pay, the colour says do not) and which wins is ใบ 066/069's open question, so it
    // stays in `pending`. Under `review` a human was there, which is what the rule asked for — so it
    // is not in open conflict, though it is still listed (the arm above).
    expect(colorGaps([seen("#9fc5e8", 40, 32)], [{ hex: "#9fc5e8", meaning: "review" }])).toEqual([
      {
        hex: "#9fc5e8",
        sessions: 40,
        reviewedSessions: 32,
        pending: 8,
        state: "unapplied",
        meaning: "review",
      },
    ]);
    expect(
      colorGaps([seen("#ea9999", 40, 32)], [{ hex: "#ea9999", meaning: "skip" }])[0].pending,
    ).toBe(40);
  });

  test("nothing seen is an empty list — not a falsy count", () => {
    expect(colorGaps([], [])).toEqual([]);
    expect(colorGaps([seen(null, 3)], [])).toEqual([]);
  });
});

describe("isColorMeaning — ชุดคำตอบปิด (ใบ 043 รอบรีวิว)", () => {
  test("only the three `lib/sync.ts` branches on are accepted", () => {
    // 🔴 The refusal is the point. `syncSources()` tests `=== "skip"` and `=== "review"` and falls
    // through everything else ⇒ **any** other string stored in `ColorRule.meaning` pays every คาบ of
    // that colour while the owner believes they answered. `addColor` used to accept whatever the
    // post carried, so an empty `<select>` value was a silent "จ่ายปกติ" written by the screen.
    expect(COLOR_MEANINGS.map(isColorMeaning)).toEqual([true, true, true]);
    for (const junk of ["", " ", "Pay", "ignore", "จ่าย", "__proto__"])
      expect(isColorMeaning(junk)).toBe(false);
  });

  test("every meaning has Thai to be offered under — a fourth cannot ship label-less", () => {
    expect(COLOR_MEANINGS.map((m) => COLOR_MEANING_LABELS[m])).toEqual([
      "จ่ายปกติ",
      "ไม่จ่าย (ข้าม)",
      "ให้คนตรวจ",
    ]);
  });
});

describe("isNeutralBg", () => {
  test("white and absent are neutral; a real colour is not", () => {
    expect(isNeutralBg("#ffffff")).toBe(true);
    expect(isNeutralBg(" #FFFFFF ")).toBe(true);
    expect(isNeutralBg(null)).toBe(true);
    expect(isNeutralBg(undefined)).toBe(true);
    expect(isNeutralBg("")).toBe(true);
    expect(isNeutralBg("#b6d7a8")).toBe(false);
  });
});
