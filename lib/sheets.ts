import { readFile } from "node:fs/promises";
import { JWT } from "google-auth-library";

/** เซลล์เดียวในรูปแบบกลาง — Google API และ xlsx แปลงมาลงที่นี่เหมือนกัน */
export type RawCell = {
  /** ค่าดิบ: number = date serial, string = ข้อความ */
  v: number | string | null;
  /** ข้อความที่คนเห็นในชีต (ไว้ให้คนตรวจอ่าน) */
  f: string;
  /** สีพื้น "#b6d7a8" (§1.6 — ชีตใช้สีเข้ารหัสความหมาย) */
  bg?: string;
  /** Note ในเซลล์ */
  note?: string;
};

export type RawGrid = { sheetName: string; rows: RawCell[][] };

/** Sheets/Excel epoch = 1899-12-30 */
export function serialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
}

function rgbToHex(c?: { red?: number; green?: number; blue?: number }): string | undefined {
  if (!c) return undefined;
  const h = (x = 0) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${h(c.red)}${h(c.green)}${h(c.blue)}`;
}

/**
 * อ่านตรงจาก Google Sheet
 *
 * ⚠️ ต้องใช้ spreadsheets.get?includeGridData=true — ห้ามใช้ values.get
 * เพราะ values.get คืน "23/4" (ปีหาย เหมือน CSV export) ส่วนอันนี้คืน serial 45405
 * และได้สีพื้น + note ที่ทั้ง CSV และ values.get ทิ้งหมด
 */
export async function fetchGrids(spreadsheetId: string, sheetNames: string[]): Promise<RawGrid[]> {
  const key = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!process.env.GOOGLE_SA_EMAIL || !key)
    throw new Error("ยังไม่ได้ตั้ง GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY ใน .env");

  const jwt = new JWT({
    email: process.env.GOOGLE_SA_EMAIL,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const { token } = await jwt.getAccessToken();

  const params = new URLSearchParams({ includeGridData: "true" });
  for (const n of sheetNames) params.append("ranges", n);
  params.set(
    "fields",
    "sheets(properties/title,data/rowData/values(formattedValue,effectiveValue,effectiveFormat/backgroundColor,note))",
  );

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  const json = await res.json();

  return (json.sheets ?? []).map((sheet: any) => ({
    sheetName: sheet.properties.title,
    rows: (sheet.data?.[0]?.rowData ?? []).map((row: any) =>
      (row.values ?? []).map(
        (c: any): RawCell => ({
          v: c.effectiveValue?.numberValue ?? c.effectiveValue?.stringValue ?? null,
          f: c.formattedValue ?? "",
          bg: rgbToHex(c.effectiveFormat?.backgroundColor),
          note: c.note,
        }),
      ),
    ),
  }));
}

export function sheetIdFromLink(link: string): string {
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(link);
  if (!m) throw new Error(`อ่าน spreadsheetId จากลิงก์ไม่ได้: ${link}`);
  return m[1];
}

/**
 * ดาวน์โหลดชีตผ่าน export endpoint — ใช้ได้เมื่อชีตแชร์แบบ "ทุกคนที่มีลิงก์ดูได้"
 * ไม่ต้องใช้ credential ใดๆ และได้ครบทั้ง date serial + สีพื้น (ต่างจาก .csv ที่ปีหาย)
 */
export async function fetchPublicGrids(
  spreadsheetId: string,
  sheetNames?: string[],
): Promise<RawGrid[]> {
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`,
    { redirect: "follow" },
  );
  if (!res.ok) throw new Error(`โหลดชีตไม่สำเร็จ (HTTP ${res.status}) — ชีตอาจไม่ได้แชร์แบบสาธารณะ`);
  const buf = await res.arrayBuffer();
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("spreadsheetml"))
    throw new Error(`ชีตไม่ได้เปิดให้ดูด้วยลิงก์ (ได้ ${ct} แทนไฟล์ xlsx)`);
  return gridsFromXlsx(buf, sheetNames);
}

/**
 * อ่านจากไฟล์ .xlsx ในเครื่อง — ใช้เป็น fixture ของ test และตอน offline
 * xlsx เก็บ date เป็น serial (ต่างจาก .csv ที่ปีหาย) และมีสีพื้นครบ
 */
export async function loadXlsxGrids(path: string, sheetNames?: string[]): Promise<RawGrid[]> {
  const buf = await readFile(path);
  return gridsFromXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, sheetNames);
}

async function gridsFromXlsx(buf: ArrayBuffer, sheetNames?: string[]): Promise<RawGrid[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { cellDates: false, cellStyles: true });
  const names = sheetNames ?? wb.SheetNames;

  return names.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error(`ไม่พบชีต "${sheetName}" ในไฟล์`);
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    const rows: RawCell[][] = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: RawCell[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (!cell) {
          row.push({ v: null, f: "" });
          continue;
        }
        const style = (cell as { s?: { patternType?: string; fgColor?: { rgb?: string } } }).s;
        const rgb = style?.patternType === "solid" ? style.fgColor?.rgb : undefined;
        row.push({
          v: cell.t === "n" ? (cell.v as number) : String(cell.v ?? ""),
          f: String(cell.w ?? cell.v ?? ""),
          bg: rgb ? `#${rgb.slice(-6).toLowerCase()}` : undefined,
        });
      }
      rows.push(row);
    }
    return { sheetName, rows };
  });
}
