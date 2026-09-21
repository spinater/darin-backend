/**
 * **Which background colours in the sheet are paying คาบ nobody has vouched for** — one home for
 * that question (task 043, CLAUDE.md §4).
 *
 * `syncSources()` reads `ColorRule` to turn a coloured cell into `ignored` / `needs_review`. On a
 * database where that table is empty — or simply missing the colour the counter staff used this
 * month — every lookup is `undefined` and the row syncs as `status: "ok"`, with `warnings: []`,
 * because nothing about it is undecided as far as the engine can tell. A cancelled คาบ then reaches
 * a payslip and nobody hears about it until payday. That is CLAUDE.md §2 rule 4's most expensive
 * shape, and the amount is a whole colour's worth of sessions per month.
 *
 * 🔴 **The gap is reported, never guessed at.** Defaulting an unknown colour to `needs_review` would
 * put the entire first sync in the review queue and train everyone to click through it; defaulting
 * it to `skip` would withhold pay on a guess. Which hex means "ยกเลิก" is a business fact that lives
 * with the counter staff, so the only honest move is to name the colours, with counts, and let the
 * owner decide each one once at `/admin/config`.
 *
 * 🔴 **And an *answered* colour is not a *fixed* one — that is the whole second half of this module**
 * (payroll-auditor, round 1). `ColorRule` is applied **only at sync time**, and `syncSources()`
 * skips a `reviewed: true` row before it ever reaches the lookup. So the คาบ already in the database
 * do not move when the rule is written: a colour answered "ไม่จ่าย" goes on being paid until the
 * next sync, and on a hand-reviewed row **for ever**. A report that retired a colour the moment it
 * was answered would go quiet at exactly the moment the money is most wrong — the owner's correct
 * answer buying silence instead of a fix. ⇒ a colour leaves this list when the **rows** agree with
 * its rule, not when the rule exists.
 *
 * ⚠️ No role check lives here — the pages that call it own `requireAdmin()` / `currentStaff()`,
 * exactly as with `runBlockers()` and `syncSources()`.
 */
import type { Prisma } from "../generated/prisma/client";
import { db } from "./db";
import { periodRange } from "./payroll-run";

/**
 * The three answers a colour may be given — **the closed set `lib/sync.ts` actually branches on**.
 *
 * 🔴 It tests `=== "skip"` and `=== "review"` and falls through everything else, so *any* other
 * string stored in `ColorRule.meaning` — `""`, a typo, a value from a stale form — reads as
 * "จ่ายปกติ" and pays every คาบ of that colour, while the owner believes they answered. One home for
 * the list, so the dropdown that offers them and the action that accepts them cannot drift apart.
 */
export const COLOR_MEANINGS = ["pay", "skip", "review"] as const;
export type ColorMeaning = (typeof COLOR_MEANINGS)[number];

/** The Thai the owner picks from — beside the list, so a fourth meaning cannot ship label-less. */
export const COLOR_MEANING_LABELS: Record<ColorMeaning, string> = {
  pay: "จ่ายปกติ",
  skip: "ไม่จ่าย (ข้าม)",
  review: "ให้คนตรวจ",
};

export function isColorMeaning(v: string): v is ColorMeaning {
  return (COLOR_MEANINGS as readonly string[]).includes(v);
}

/** A colour carried by payable คาบ. `hex` is `null` for an uncoloured cell. */
export type SeenColor = {
  hex: string | null;
  /** คาบ that this period's `runPayroll` would pay. */
  sessions: number;
  /** Of those, the ones `syncSources()` will never re-evaluate (`reviewed: true`). */
  reviewedSessions: number;
};

/**
 * `unruled` — nobody has said what this colour means, and it is being paid.
 * `unapplied` — somebody has, and it is being paid anyway, because the rows predate the rule.
 */
export type ColorGapState = "unruled" | "unapplied";

export type ColorGap = SeenColor & {
  hex: string;
  state: ColorGapState;
  /**
   * The คาบ that still **openly disagree** with what is known about this colour — the actionable
   * number, the sort key, and the one the screens lead with.
   *
   * Under `skip` that is every payable row: a human clearing a row said "pay", the colour says "do
   * not", and which wins is ใบ 066/069's open question rather than this fold's. Under `review` a
   * hand-cleared row is *not* openly in conflict — the rule asked for a human and a human was there
   * — so it is not counted here.
   *
   * 🔴 **`pending === 0` is not "resolved", and this fold must never retire a colour on it**
   * (payroll-auditor, round 3). `reviewed: true` records that somebody resolved the row's *parse*
   * problem; it is **not** evidence that anybody looked at its **colour**. `/sync/review` never
   * renders `bgColor`, and the one note that did carry it — `สีในชีตต้องให้คนตรวจ (#hex)` from
   * `lib/sync.ts` — is overwritten with `"คนตรวจยืนยันแล้ว"` the moment the row is resolved. There
   * is no `reviewedAt` and no `ColorRule.updatedAt`, so "reviewed *because of* this rule" cannot be
   * told from "reviewed a year earlier about a missing trainer name". ⇒ a colour with
   * `pending: 0` and `reviewedSessions > 0` is still **emitted**, and the screens say what is
   * actually known: these คาบ were cleared by a human who was never shown this colour.
   *
   * The ว่ายน้ำ sheet is why this is the guaranteed path rather than a corner: `prisma/seed.ts`
   * gives it `trainer: null`, so every payable swim คาบ is hand-cleared by construction. Retiring on
   * `pending === 0` meant the honest answer "ให้คนตรวจ" silenced all three screens in the same page
   * load, over 40 × 250 = 10,000 ฿ nobody had looked at — round 1's blocker through a new door.
   */
  pending: number;
  /** The answer that is not in force yet. Only on `unapplied`. */
  meaning?: ColorMeaning;
};

/**
 * Backgrounds that mean **"nobody coloured this cell"**.
 *
 * `rgbToHex()` in `lib/sheets.ts` renders an unstyled cell as `#ffffff`, and the xlsx path renders
 * a deliberately white fill as `#ffffff` too ⇒ the two are **the same bytes**, so a white "do not
 * pay" signal is not merely filtered out here, it is not in the data at all. Reporting white would
 * light the banner on every row of every sheet for ever, which is the same end state as guessing.
 *
 * 🔴 **This is why `addColor` refuses to store a rule for `#ffffff`.** Such a rule cannot be aimed:
 * `skip` on white would turn *every uncoloured row* `ignored` at the next sync — a month of ~320
 * payable คาบ dropping out of every slip with `warnings: []` and no queue to show for it.
 */
export const NEUTRAL_BG = new Set(["#ffffff"]);

export function isNeutralBg(hex: string | null | undefined): boolean {
  return !hex || NEUTRAL_BG.has(hex.trim().toLowerCase());
}

/**
 * The pure half: payable คาบ, grouped by colour, judged against the rules.
 *
 * Case is not part of a colour — `#B6D7A8` and `#b6d7a8` are one colour, on both sides. `sync.ts`
 * lowercases both before its own lookup and `addColor` stores lowercase, so this must fold them
 * together too, or the same colour is reported as unruled beside its own rule.
 *
 * 🔑 **A `pay` rule is the only one that can retire a colour by itself**, because it is the only one
 * that *agrees* with what the rows already are. `skip` and `review` disagree with the payable rows
 * still carrying the colour, and disagreement is the thing worth reporting — but *which* rows
 * disagree differs between them, which is what `pending` is for.
 *
 * ⚠️ A `meaning` outside `COLOR_MEANINGS` is treated as **unruled**, not as an answer — it is what
 * `lib/sync.ts` does with it (falls through to paying), so it is what the owner must be told.
 *
 * `unapplied` sorts above `unruled`: a written rule being ignored is a worse state than an open
 * question, and it is also the one with a deadline (a re-sync, or a hand fix).
 */
export function colorGaps(
  seen: SeenColor[],
  rules: { hex: string; meaning: string }[],
): ColorGap[] {
  const ruled = new Map(
    rules
      .filter((r) => isColorMeaning(r.meaning))
      .map((r) => [r.hex.trim().toLowerCase(), r.meaning as ColorMeaning] as const),
  );
  const byHex = new Map<string, SeenColor & { hex: string }>();
  for (const row of seen) {
    if (isNeutralBg(row.hex)) continue;
    const hex = row.hex!.trim().toLowerCase();
    const acc = byHex.get(hex) ?? { hex, sessions: 0, reviewedSessions: 0 };
    acc.sessions += row.sessions;
    acc.reviewedSessions += row.reviewedSessions;
    byHex.set(hex, acc);
  }

  const gaps: ColorGap[] = [];
  for (const acc of byHex.values()) {
    const meaning = ruled.get(acc.hex);
    if (meaning === "pay") continue;
    if (!meaning) {
      gaps.push({ ...acc, state: "unruled", pending: acc.sessions });
      continue;
    }
    const pending = meaning === "review" ? acc.sessions - acc.reviewedSessions : acc.sessions;
    // 🔴 `|| reviewedSessions > 0` is the whole of round 3's fix — see `pending`. A colour whose
    // every คาบ was hand-cleared is not a colour anybody vouched for; it is a colour nobody was
    // shown. Retiring on `pending === 0` would go quiet on the answer that asked for a human.
    if (pending > 0 || acc.reviewedSessions > 0)
      gaps.push({ ...acc, state: "unapplied", pending, meaning });
  }
  return gaps.sort(
    (a, b) =>
      Number(b.state === "unapplied") - Number(a.state === "unapplied") ||
      b.pending - a.pending ||
      b.reviewedSessions - a.reviewedSessions ||
      a.hex.localeCompare(b.hex),
  );
}

/**
 * The colours on คาบ **this period's payroll run would pay**.
 *
 * 🔴 The filter mirrors `runPayroll`'s own query (`lib/payroll-run.ts`) exactly — `status: "ok"`,
 * the period window, `staffId: { not: null }` — because the count on each swatch is presented as
 * money about to go out and is the only thing the owner has to rank 28–41 colours by. A row with no
 * trainer is paid to nobody, so counting it would inflate the one number this screen is for.
 * ⚠️ That also means an **undated** row is in no period and appears here in none; it is payable by
 * no run either. `colorGapsSeen()` has no date filter and is where such a colour surfaces.
 */
export async function colorGapsInPeriod(period: string): Promise<ColorGap[]> {
  const { from, to } = periodRange(period);
  return gapsWhere({ date: { gte: from, lt: to } });
}

/**
 * Every colour on a payable คาบ, whatever period — the list `/admin/config` renders, because the
 * owner is ruling on a *colour* and a colour answered once is answered for every period.
 */
export async function colorGapsSeen(): Promise<ColorGap[]> {
  return gapsWhere({});
}

async function gapsWhere(where: Prisma.TeachSessionWhereInput): Promise<ColorGap[]> {
  const [grouped, rules] = await Promise.all([
    db.teachSession.groupBy({
      by: ["bgColor", "reviewed"],
      where: { ...where, status: "ok", staffId: { not: null } },
      _count: { _all: true },
    }),
    db.colorRule.findMany({ select: { hex: true, meaning: true } }),
  ]);
  return colorGaps(
    grouped.map((g) => ({
      hex: g.bgColor,
      sessions: g._count._all,
      reviewedSessions: g.reviewed ? g._count._all : 0,
    })),
    rules,
  );
}
