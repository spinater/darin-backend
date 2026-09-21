/**
 * Reader for the Gymmo trainer-worklog export (task 058).
 *
 * Gymmo is the gym's live booking system. Its worklog export is one **sheet per trainer**, one
 * **row per session** — the opposite shape from the Google Sheet `lib/parser.ts` reads, where a
 * row is a customer and sessions are spread across columns. Nothing here is shared with that
 * parser on purpose: they read different documents.
 *
 *   #  ·  Date & Time  ·  Duration  ·  Class  ·  Type  ·  Students  ·  Attendees  ·  No shows  ·  Late canceled
 *
 * 🔴 **This module is pure and knows nothing about staff, prices or money.** It turns cells into
 * typed rows and says what it could not read. Mapping a sheet name to a `Staff`, a class name to
 * a `ClassPrice`, and a row to pay all happen elsewhere — see task 058 for why that seam is here
 * and not further in.
 */
import type { RawGrid } from "./sheets";

export type GymmoKind = "pt" | "class";

export type GymmoRow = {
  /** The sheet name, which in this export **is** the trainer's full name. */
  trainerSheet: string;
  /** The `#` column — with `trainerSheet` it is the export's own row identity. */
  rowNo: number;
  /**
   * Calendar date at **UTC midnight**, the same convention the review screen writes
   * (`new Date(dateStr + "T00:00:00Z")`). The clock time is kept separately in `timeText`
   * rather than folded in, because the export carries **no timezone** and payroll only ever
   * buckets by month — inventing an offset here would be a guess that silently shifts a session
   * across a month boundary at 00:xx and 07:xx.
   */
  date: Date;
  /** `"07:15"` exactly as printed. */
  timeText: string;
  durationMin: number;
  className: string;
  kind: GymmoKind;
  /** `Students` — how many were booked. `-` reads as 0. */
  booked: number;
  /** `Attendees` **verbatim**. Not split: a real row reads `เอรา,อลัน เอรา,อลัน` — the comma is
   * inside a name, so splitting on it produces people who do not exist (task 049 §8.3). */
  attendeesRaw: string;
  noShow: number;
  lateCancel: number;
};

/**
 * One thing this reader could not read. Never thrown away silently.
 *
 * 🔑 **Structured, not a rendered sentence, since task 064** — because it now has to be *stored*.
 * A problem that outlives the request has to be keyed (`readProblemKey` in
 * `lib/class-problems.ts`); splitting the sentence back apart on its first `": "` was the hack that
 * made it possible before, and a sheet name containing `": "` split early. The label and the full
 * sentence are rebuilt from these fields (`readProblemLabel`), byte-identically to what this module
 * used to emit.
 *
 * ⚠️ **This module still does not know what a `ClassImportProblem` is** — it is pure and knows
 * nothing about staff, prices, money or storage. It reports fields; another module keys them.
 */
export type GymmoReadProblem = {
  /** The sheet this was read from. For a whole-sheet reject it is all the identity there is. */
  sheetName: string;
  /**
   * The `#` cell **verbatim**, `""` included — it is part of the stored key, so it may not be
   * defaulted here. `null` means the problem is the **whole sheet**, not a row in it, and that
   * distinction is what keeps a sheet-level key (`["ชีต"]`) apart from a blank-`#` row key.
   */
  rowText: string | null;
  /**
   * The `Date & Time` cell **verbatim**, exactly as printed, whether or not it parsed.
   *
   * 🔴 **It is in the key because `#` is not an identity across exports** (task 064 fix round).
   * Gymmo's `#` is a per-sheet running number that **restarts in every export**, so "sheet ประพัฒน์
   * row 14" names one คาบ in the August file and a different one in the September file. Keyed on
   * `[sheet, "14"]` alone, uploading the second file would `deleteMany` the first file's still-true
   * problem and replace it with an unrelated row's — T3's silent loss reached through a key that is
   * not an identity rather than through a date range. The raw cell is the one thing on a rejected
   * row that names *which* คาบ even when it cannot be parsed. `null` for a whole-sheet reject.
   */
  rawWhen: string | null;
  /**
   * The UTC calendar day, when the reader got far enough to have one — `parseGymmoWhen` succeeds
   * before the `Type`, the counts and the class name are looked at, so three of the four row
   * rejects **do** know their date and only an unreadable `Date & Time` genuinely does not.
   *
   * 🔴 It is here so a stored problem can be **period-scoped**. `null` is counted in *every* period
   * (copying `pendingReviewInPeriod`), and under the no-dismissal default that is permanent ⇒
   * defaulting this to `null` for rows whose date was perfectly readable is how one bad cell in
   * August blocks every month for ever, which is what teaches an admin to ignore the count.
   */
  date: Date | null;
  /** The Thai sentence, **without** the `"<label>: "` prefix the label rebuilds. */
  reason: string;
};

export type GymmoParse = {
  rows: GymmoRow[];
  /** One entry per row (or sheet) that could not be read. Never thrown away silently. */
  problems: GymmoReadProblem[];
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const HEADERS = [
  "#",
  "date & time",
  "duration",
  "class",
  "type",
  "students",
  "attendees",
  "no shows",
  "late canceled",
] as const;

/** `"-"`, `""` and whitespace all mean "none" in this export; anything else must be a number. */
function count(raw: string): number | null {
  const s = raw.trim();
  if (s === "" || s === "-") return 0;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** `"60 mins"` → 60 · `"50 mins"` → 50. Absent reads as 0 rather than failing the row. */
function minutes(raw: string): number {
  const m = /(\d+)/.exec(raw);
  return m ? Number(m[1]) : 0;
}

/** `"1 SEP 2026, 07:15"` → UTC midnight of 2026-09-01, plus `"07:15"`. */
export function parseGymmoWhen(raw: string): { date: Date; timeText: string } | null {
  const m = /^\s*(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\s*,\s*(\d{1,2}):(\d{2})\s*$/.exec(raw);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MONTHS.indexOf(m[2].slice(0, 3).toUpperCase());
  const year = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  if (mon < 0 || day < 1 || day > 31 || hh > 23 || mm > 59) return null;
  const date = new Date(Date.UTC(year, mon, day));
  // Reject a day the month does not have (31 SEP) — Date.UTC would roll it into the next month.
  if (date.getUTCDate() !== day || date.getUTCMonth() !== mon) return null;
  return { date, timeText: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` };
}

function kindOf(raw: string): GymmoKind | null {
  const s = raw.trim().toLowerCase();
  if (s === "pt") return "pt";
  if (s === "class") return "class";
  return null;
}

/** True when the row is this export's header line, whatever sheet it sits on. */
function isHeader(cells: string[]): boolean {
  return HEADERS.every((h, i) => (cells[i] ?? "").trim().toLowerCase() === h);
}

/**
 * Read every sheet of a loaded Gymmo workbook.
 *
 * A row is skipped **with a problem line** rather than dropped when its date, type or counts
 * cannot be read: a worklog row that vanishes is a session nobody gets paid for, which is the
 * silent zero CLAUDE.md §2 rule 4 exists to prevent.
 */
export function parseGymmoGrids(grids: RawGrid[]): GymmoParse {
  const rows: GymmoRow[] = [];
  const problems: GymmoReadProblem[] = [];

  for (const grid of grids) {
    let seenHeader = false;
    /**
     * `rowText` and `rawWhen` are the two cells verbatim — `""` is kept, because together they are
     * this row's stored key. `date` is passed whenever the reader already has it, which is every
     * branch below the `parseGymmoWhen` check.
     */
    const reject = (
      rowText: string | null,
      rawWhen: string | null,
      date: Date | null,
      reason: string,
    ) => problems.push({ sheetName: grid.sheetName, rowText, rawWhen, date, reason });
    for (const raw of grid.rows) {
      const cells = raw.map((c) => String(c.f ?? c.v ?? "").trim());
      if (cells.every((c) => c === "")) continue;
      if (!seenHeader && isHeader(cells)) {
        seenHeader = true;
        continue;
      }
      if (!seenHeader) continue; // anything above the header is not data

      const rowText = cells[0] ?? "";
      const rawWhen = cells[1] ?? "";
      const when = parseGymmoWhen(rawWhen);
      // 🔴 The ONLY branch with no date — the date is the thing it could not read. Every branch
      // below it passes `when.date`, so its stored problem belongs to one month instead of to all
      // of them (task 064 fix round).
      if (!when) {
        reject(rowText, rawWhen, null, `อ่านวันเวลาไม่ออก — "${rawWhen}"`);
        continue;
      }
      const kind = kindOf(cells[4] ?? "");
      if (!kind) {
        reject(
          rowText,
          rawWhen,
          when.date,
          `ไม่รู้จักชนิด "${cells[4] ?? ""}" (รองรับ PT / Class)`,
        );
        continue;
      }
      const booked = count(cells[5] ?? "");
      const noShow = count(cells[7] ?? "");
      const lateCancel = count(cells[8] ?? "");
      if (booked === null || noShow === null || lateCancel === null) {
        reject(
          rowText,
          rawWhen,
          when.date,
          `ตัวเลขอ่านไม่ออก — จอง "${cells[5] ?? ""}" · no-show "${cells[7] ?? ""}" · ยกเลิกช้า "${cells[8] ?? ""}"`,
        );
        continue;
      }
      const className = (cells[3] ?? "").trim();
      if (!className) {
        reject(rowText, rawWhen, when.date, `ไม่มีชื่อคลาส`);
        continue;
      }

      rows.push({
        trainerSheet: grid.sheetName,
        rowNo: Number(cells[0]) || 0,
        date: when.date,
        timeText: when.timeText,
        durationMin: minutes(cells[2] ?? ""),
        className,
        kind,
        booked,
        attendeesRaw: cells[6] ?? "",
        noShow,
        lateCancel,
      });
    }
    // Every identity field `null` — the problem is the sheet, not a row in it, so no `#` cell and no
    // `Date & Time` cell was ever read. Its key is the 1-tuple `[sheetName]`.
    if (!seenHeader) reject(null, null, null, `ไม่พบแถวหัวตารางของ Gymmo — ข้ามทั้งชีต`);
  }

  return { rows, problems };
}

/**
 * Attendance actually delivered.
 *
 * ⚠️ Can be **negative** when `noShow > booked`, and this function does not clamp it. The payroll
 * engine already treats a negative as *unreadable input* and warns rather than paying 0 (task 025,
 * `lib/payroll.ts`) — clamping here would hide the row from that check.
 */
export function attendedOf(row: Pick<GymmoRow, "booked" | "noShow">): number {
  return row.booked - row.noShow;
}
