import type { RawCell, RawGrid } from "./sheets";
import { serialToDate } from "./sheets";
import { normalizePhone, normalizeTrainer } from "./normalize";

export type ColMap = {
  name: number;
  nickname?: number;
  phone?: number;
  signup?: number;
  count?: number;
  /** null = ชีตนี้ไม่มีคอลัมน์ครู (สอนว่ายน้ำ) */
  trainer: number | null;
  firstSession: number;
};

export type ParsedSession = {
  rowIndex: number;
  colIndex: number;
  date: Date | null;
  staffId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  rawValue: string;
  bgColor?: string;
  status: "ok" | "needs_review" | "ignored";
  reviewNote?: string;
};

/** date serial ที่สมเหตุสมผล: 1954–2064 (กันตัวเลขหลงอย่าง 837 / 641) */
const SERIAL_MIN = 20000;
const SERIAL_MAX = 60000;

/** ป้ายกำกับแพ็ค/สถานะ — ไม่ใช่คาบสอน ข้ามได้เลย ไม่ต้องให้คนตรวจ */
const LABEL_RE =
  /(platinum|premium|gold|silver|bronze|basic|โปร|แถม|ได้จาก|ตัดไปรอบใหม่|เดือน|รายครั้ง|ทดลอง|morning|เรียนคู่|เรียนกลุ่ม)/i;

/** คำที่แปลว่า "อย่าเพิ่งจ่าย" — ต้องให้คนตัดสิน */
const SUSPECT_RE = /(หัก|ลืม|ยกเลิก|ไม่ได้มา|ไม่มา|ย้าย|เลื่อน|แทน)/;

const DATE_RE = /(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/;

function cellText(c?: RawCell): string {
  if (!c) return "";
  if (typeof c.v === "number") return c.f || String(c.v);
  return String(c.v ?? c.f ?? "").trim();
}

function isBlank(c?: RawCell): boolean {
  return !c || (c.v === null && !c.f.trim()) || cellText(c) === "";
}

type Attempt =
  | { kind: "serial"; date: Date }
  | { kind: "dmy"; d: number; m: number; y: number; extra: string }
  | { kind: "dm"; d: number; m: number; extra: string }
  | { kind: "label" }
  | { kind: "bad"; why: string };

function readCell(c: RawCell): Attempt {
  if (typeof c.v === "number") {
    if (c.v >= SERIAL_MIN && c.v <= SERIAL_MAX) return { kind: "serial", date: serialToDate(c.v) };
    return { kind: "bad", why: `ตัวเลข ${c.v} ไม่ใช่วันที่` };
  }
  const text = cellText(c);
  if (!text) return { kind: "bad", why: "ว่าง" };

  const m = DATE_RE.exec(text);
  if (m) {
    const d = +m[1];
    const mo = +m[2];
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return { kind: "bad", why: `วันที่ไม่ถูกต้อง "${text}"` };
    const extra = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
    if (m[3]) {
      let y = +m[3];
      if (y < 100) y += 2000;
      if (y > 2400) y -= 543; // เผื่อกรอกเป็น พ.ศ.
      return { kind: "dmy", d, m: mo, y, extra };
    }
    return { kind: "dm", d, m: mo, extra };
  }
  if (LABEL_RE.test(text)) return { kind: "label" };
  return { kind: "bad", why: `อ่านไม่ออก "${text}"` };
}

/** ตัดสินว่าข้อความที่เหลือจากวันที่ = ชื่อคนสอนแทน หรือ ต้องให้คนตรวจ */
function resolveExtra(
  extra: string,
  aliases: Map<string, string>,
): { staffId?: string; review?: string } {
  if (!extra) return {};
  if (SUSPECT_RE.test(extra)) return { review: `มีหมายเหตุ "${extra}"` };
  const hit = aliases.get(normalizeTrainer(extra));
  if (hit) return { staffId: hit };
  return { review: `มีข้อความพ่วง "${extra}"` };
}

/**
 * แปลง grid ดิบ → คาบสอน
 *
 * กฎ (§4.3): ข้าม header → แถวว่างล้วนข้ามโดยไม่ตัดสายสืบทอด →
 * แถวไม่มีชื่อ+เบอร์แต่มีวันที่ = continuation ของแถวก่อน (PT 30% ของชีต) →
 * เทรนเนอร์ normalize แล้ว lookup ไม่เจอไม่เดา → ปีที่หายเดาจากลำดับวันที่ในกลุ่ม
 */
export function parseGrid(
  grid: RawGrid,
  colMap: ColMap,
  headerRows: number,
  aliases: Map<string, string>,
): ParsedSession[] {
  const out: ParsedSession[] = [];

  type Ctx = {
    name: string | null;
    phone: string | null;
    staffId: string | null;
    trainerRaw: string;
    anchor: Date | null; // วันที่ล่าสุดที่รู้ปีแน่นอน ใช้เดาปีให้เซลล์ที่ไม่มีปี
    firstAnchor: Date | null;
    /** before = anchor ณ ตอนเจอเซลล์นั้น (ห้ามใช้ anchor ตอน flush — มันเดินไปข้างหน้าแล้ว) */
    pending: { s: ParsedSession; d: number; m: number; before: Date | null }[];
  };
  let ctx: Ctx | null = null;

  const flush = () => {
    if (!ctx) return;
    for (const p of ctx.pending) {
      // สมมติวันที่ในแพ็คไล่จากน้อยไปมาก
      let dt: Date;
      if (p.before) {
        dt = new Date(Date.UTC(p.before.getUTCFullYear(), p.m - 1, p.d));
        if (dt < p.before) dt = new Date(Date.UTC(dt.getUTCFullYear() + 1, p.m - 1, p.d));
      } else if (ctx.firstAnchor) {
        // ไม่มีวันที่ก่อนหน้า → เดาถอยหลังจากวันที่แรกของแพ็ค
        dt = new Date(Date.UTC(ctx.firstAnchor.getUTCFullYear(), p.m - 1, p.d));
        if (dt > ctx.firstAnchor) dt = new Date(Date.UTC(dt.getUTCFullYear() - 1, p.m - 1, p.d));
      } else {
        p.s.status = "needs_review";
        p.s.reviewNote = "ไม่มีปีในเซลล์ และทั้งแพ็คไม่มีวันที่อ้างอิง";
        continue;
      }
      p.s.date = dt;
      p.s.reviewNote = [p.s.reviewNote, `เดาปี ${dt.getUTCFullYear()} จากลำดับวันที่`]
        .filter(Boolean)
        .join(" · ");
      if (p.s.status === "ok") p.s.status = "needs_review"; // เดาปี = ต้องมีคนยืนยัน
    }
    ctx.pending = [];
  };

  for (let r = headerRows; r < grid.rows.length; r++) {
    const row = grid.rows[r] ?? [];
    const sessionCells = row.slice(colMap.firstSession);
    const hasSessions = sessionCells.some((c) => !isBlank(c));
    const name = cellText(row[colMap.name]);
    const phone = colMap.phone != null ? cellText(row[colMap.phone]) : "";

    // แถวว่างล้วน → ข้ามโดยไม่ตัดสายสืบทอด (§1.3)
    if (!name && !phone && !hasSessions) continue;

    const isContinuation = !name && !phone && hasSessions && ctx !== null;

    if (!isContinuation) {
      flush();
      const trainerRaw = colMap.trainer != null ? cellText(row[colMap.trainer]) : "";
      const staffId = trainerRaw ? (aliases.get(normalizeTrainer(trainerRaw)) ?? null) : null;
      const signup = colMap.signup != null ? row[colMap.signup] : undefined;
      const signupAttempt = signup && !isBlank(signup) ? readCell(signup) : null;
      ctx = {
        name: name || null,
        phone: phone ? normalizePhone(phone) : null,
        staffId,
        trainerRaw,
        anchor: signupAttempt?.kind === "serial" ? signupAttempt.date : null,
        firstAnchor: signupAttempt?.kind === "serial" ? signupAttempt.date : null,
        pending: [],
      };
    }
    if (!ctx) continue;
    if (!hasSessions) continue;

    for (let i = 0; i < sessionCells.length; i++) {
      const cell = sessionCells[i];
      if (isBlank(cell)) continue;
      const colIndex = colMap.firstSession + i;

      const s: ParsedSession = {
        rowIndex: r,
        colIndex,
        date: null,
        staffId: ctx.staffId,
        customerName: ctx.name,
        customerPhone: ctx.phone,
        rawValue: cellText(cell),
        bgColor: cell.bg,
        status: "ok",
      };

      const a = readCell(cell);
      switch (a.kind) {
        case "serial":
          s.date = a.date;
          ctx.anchor = a.date;
          ctx.firstAnchor ??= a.date;
          break;
        case "dmy": {
          s.date = new Date(Date.UTC(a.y, a.m - 1, a.d));
          ctx.anchor = s.date;
          ctx.firstAnchor ??= s.date;
          const e = resolveExtra(a.extra, aliases);
          if (e.staffId) {
            s.staffId = e.staffId;
            s.reviewNote = `สอนแทน: ${a.extra}`;
          }
          if (e.review) {
            s.status = "needs_review";
            s.reviewNote = e.review;
          }
          break;
        }
        case "dm": {
          const e = resolveExtra(a.extra, aliases);
          if (e.staffId) {
            s.staffId = e.staffId;
            s.reviewNote = `สอนแทน: ${a.extra}`;
          }
          if (e.review) {
            s.status = "needs_review";
            s.reviewNote = e.review;
          }
          ctx.pending.push({ s, d: a.d, m: a.m, before: ctx.anchor });
          break;
        }
        case "label":
          s.status = "ignored";
          s.reviewNote = "ป้ายกำกับแพ็ค ไม่ใช่คาบสอน";
          break;
        case "bad":
          s.status = "needs_review";
          s.reviewNote = a.why;
          break;
      }

      // ไม่มีคอลัมน์ครู หรือ จับคู่ชื่อครูไม่ได้ → ไม่เดา
      if (s.status === "ok" && !s.staffId) {
        s.status = "needs_review";
        s.reviewNote = colMap.trainer == null
          ? "ชีตนี้ไม่มีคอลัมน์ครู — ต้องระบุผู้สอนเอง"
          : ctx.trainerRaw
            ? `ไม่รู้จักเทรนเนอร์ "${ctx.trainerRaw}"`
            : "ไม่ได้ระบุเทรนเนอร์";
      }

      out.push(s);
    }
  }
  flush();
  return out;
}
