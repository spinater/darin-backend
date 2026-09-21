/**
 * **Does this upload duplicate a คาบ somebody already keyed by hand?** — pure, no DB, no clock
 * (card 065). The I/O half is `previewGymmoImport` in `lib/gymmo-import-run.ts`, which loads the
 * hand-keyed rows in the plan's day range and hands them here; the planner itself is
 * `lib/gymmo-import.ts`, which this module only reads a type from.
 *
 * Its own module rather than a third section of the planner: that file was at **452/500** with this
 * in it, past `scripts/check-file-length.sh`'s 450 warn, and §4's remedy is to split early rather
 * than let the next person to touch the planner pay for it. The seam is real — the planner answers
 * *what does this file write*, this answers *what does the database already hold that says the same
 * thing* — and a pure leaf module is what lets `bun test` pin it with no database.
 */
import type { GymmoImportPlan } from "./gymmo-import";

/** A คาบ keyed by hand at `/classes` (`sourceKey` is null), as the confirm screen has to read it. */
export type HandKeyedSession = {
  id: string;
  date: Date;
  classId: string;
  staffId: string;
  className: string;
  staffName: string;
  booked: number;
  noShow: number;
};

/** One hand-keyed คาบ this upload is about to duplicate, with the file's side of the pair. */
export type GymmoHandKeyedMatch = {
  id: string;
  /** UTC calendar day, `YYYY-MM-DD` — a string because this crosses a server-action boundary. */
  date: string;
  className: string;
  staffName: string;
  booked: number;
  noShow: number;
  /** How many rows of **this file** land on that same day, trainer and class. */
  fileRows: number;
};

/**
 * The hand-keyed คาบ a plan would **duplicate**, named one by one (card 065).
 *
 * 🔴 **This replaces a bare count, and the reason is that the count could not be acted on.** Task 063
 * reported `handKeyedInRange`: every `sourceKey: null` คาบ inside the plan's whole `[min, max]` day
 * span, which for a Jan–Sep upload is nine months. "12 hand-keyed คาบ" beside "431 new คาบ" is a true
 * sentence that tells the person confirming nothing about **which** 12, so the only available actions
 * were to confirm blind or to abandon the import. A list of the actual pairs is the same warning made
 * decidable.
 *
 * The match is `(UTC day, staffId, classId)` — deliberately **not** `gymmoSourceKey`, which a
 * hand-keyed row does not have and never will.
 *
 * ⚠️ **This triple is a duplicate *heuristic*, and must never become an import key** — task 063's own
 * ⛔ says why: `ClassSession` stores the UTC calendar day with no clock, so one trainer teaching the
 * same class twice in a day (07:15 and 09:00) is two คาบ under one triple, and keying on it would
 * swallow one of them silently. Here that collapsing is the feature: `fileRows` is how many คาบ of
 * this file land on the triple, so a hand-keyed row against `fileRows: 2` says *"the file brings two
 * คาบ for this day and you already have one of them by hand"* — which is the question the human
 * actually has to answer.
 *
 * 🔑 **A hand-keyed row matching nothing is not reported**, and that is narrower than the count it
 * replaces: a คาบ keyed by hand in the same months that this file does not mention is not a duplicate
 * candidate at all. The mirror signal for the opposite direction — คาบ already imported that this file
 * does not carry — stays `importedInRangeNotInFile`.
 */
export function gymmoHandKeyedMatches(
  plan: GymmoImportPlan,
  handKeyed: readonly HandKeyedSession[],
): GymmoHandKeyedMatch[] {
  if (!plan.writes.length || !handKeyed.length) return [];
  // A JSON tuple, for the same reason `gymmoSourceKey` is one: `staffId` and `classId` are opaque
  // strings and a joined key is only injective while neither can contain the separator (ใบ 035).
  const triple = (day: Date, staffId: string, classId: string) =>
    JSON.stringify([day.toISOString().slice(0, 10), staffId, classId]);

  const fileRows = new Map<string, number>();
  for (const w of plan.writes) {
    const k = triple(w.date, w.staffId, w.classId);
    fileRows.set(k, (fileRows.get(k) ?? 0) + 1);
  }

  return handKeyed.flatMap((h) => {
    const rows = fileRows.get(triple(h.date, h.staffId, h.classId));
    return rows
      ? [
          {
            id: h.id,
            date: h.date.toISOString().slice(0, 10),
            className: h.className,
            staffName: h.staffName,
            booked: h.booked,
            noShow: h.noShow,
            fileRows: rows,
          },
        ]
      : [];
  });
}
