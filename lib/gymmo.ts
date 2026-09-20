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

export type GymmoParse = {
  rows: GymmoRow[];
  /** One line per row that could not be read, naming sheet and row. Never thrown away silently. */
  problems: string[];
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
  const problems: string[] = [];

  for (const grid of grids) {
    let seenHeader = false;
    for (const raw of grid.rows) {
      const cells = raw.map((c) => String(c.f ?? c.v ?? "").trim());
      if (cells.every((c) => c === "")) continue;
      if (!seenHeader && isHeader(cells)) {
        seenHeader = true;
        continue;
      }
      if (!seenHeader) continue; // anything above the header is not data

      const where = `${grid.sheetName} แถว ${cells[0] || "?"}`;
      const when = parseGymmoWhen(cells[1] ?? "");
      if (!when) {
        problems.push(`${where}: อ่านวันเวลาไม่ออก — "${cells[1] ?? ""}"`);
        continue;
      }
      const kind = kindOf(cells[4] ?? "");
      if (!kind) {
        problems.push(`${where}: ไม่รู้จักชนิด "${cells[4] ?? ""}" (รองรับ PT / Class)`);
        continue;
      }
      const booked = count(cells[5] ?? "");
      const noShow = count(cells[7] ?? "");
      const lateCancel = count(cells[8] ?? "");
      if (booked === null || noShow === null || lateCancel === null) {
        problems.push(
          `${where}: ตัวเลขอ่านไม่ออก — จอง "${cells[5] ?? ""}" · no-show "${cells[7] ?? ""}" · ยกเลิกช้า "${cells[8] ?? ""}"`,
        );
        continue;
      }
      const className = (cells[3] ?? "").trim();
      if (!className) {
        problems.push(`${where}: ไม่มีชื่อคลาส`);
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
    if (!seenHeader) problems.push(`${grid.sheetName}: ไม่พบแถวหัวตารางของ Gymmo — ข้ามทั้งชีต`);
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
