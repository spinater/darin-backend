import { existsSync } from "node:fs";
import { expect, test, describe } from "bun:test";
import { loadXlsxGrids, serialToDate } from "./sheets";
import { parseGrid, type ColMap } from "./parser";
import { normalizeTrainer } from "./normalize";

const XLSX_PATH = "docs/Darin scheduled.xlsx";
// docs/ ไม่ขึ้น git (มีชื่อ+เบอร์ลูกค้าจริง) → test ชุดนี้รันเฉพาะเครื่องที่มีไฟล์
const HAS_FIXTURE = existsSync(XLSX_PATH);
if (!HAS_FIXTURE)
  console.warn(`⚠️  ข้าม test ที่ใช้ไฟล์จริง — วาง "${XLSX_PATH}" แล้วรันใหม่เพื่อทดสอบเต็ม`);

// เทรนเนอร์ที่ seed ไว้จริง (§1.4)
const ALIASES = new Map(
  ["พลอย", "แพท", "โอ", "ต้น", "แนน", "จิ้บ"].map((n) => [normalizeTrainer(n), `id-${n}`]),
);

const SOURCES: { sheet: string; colMap: ColMap; rows: number }[] = [
  {
    sheet: "PT",
    rows: 401,
    colMap: { name: 0, nickname: 1, phone: 2, signup: 3, count: 4, trainer: 5, firstSession: 6 },
  },
  {
    sheet: "Pilates",
    rows: 185,
    colMap: { name: 1, nickname: 2, phone: 3, signup: 4, count: 5, trainer: 6, firstSession: 7 },
  },
  {
    sheet: "สอนว่ายน้ำ",
    rows: 93,
    colMap: { name: 0, nickname: 1, phone: 2, signup: 3, trainer: null, firstSession: 4 },
  },
];

describe("serialToDate", () => {
  test("serial 45405 = 2024-04-23 (ค่าที่ CSV export ทำปีหายเหลือ 23/4)", () => {
    expect(serialToDate(45405).toISOString().slice(0, 10)).toBe("2024-04-23");
  });
});

describe("normalizeTrainer — 21 การสะกดในชีต PT ยุบเหลือ 5 คน", () => {
  test("ทุกแบบของ แพท ยุบเป็นค่าเดียว", () => {
    const forms = ["pt แพท", "PT แพท", "PTแพท", "PT พี่แพท", "pt พี่แพท", "แพท", "Pt แพท", "พี่แพท"];
    expect(new Set(forms.map(normalizeTrainer)).size).toBe(1);
  });
  test("คนละคนไม่ยุบรวมกัน", () => {
    const ids = ["PT โอ", "PT ต้น", "PT พลอย", "pt แพท", "PT มิกซ์"].map(normalizeTrainer);
    expect(new Set(ids).size).toBe(5);
  });
});

describe.if(HAS_FIXTURE)("parseGrid กับไฟล์จริง", () => {
  test("อ่านทุกชีตแล้วไม่มีเซลล์หายเงียบ", async () => {
    const grids = await loadXlsxGrids(XLSX_PATH, SOURCES.map((s) => s.sheet));
    let totalOk = 0;
    let totalReview = 0;

    for (const src of SOURCES) {
      const grid = grids.find((g) => g.sheetName === src.sheet)!;
      const sessions = parseGrid(grid, src.colMap, 1, ALIASES);

      // ทุก session ต้องมีสถานะชัดเจน 1 ใน 3
      for (const s of sessions) expect(["ok", "needs_review", "ignored"]).toContain(s.status);
      // status=ok ต้องมีทั้งวันที่และผู้สอน — ไม่งั้นจ่ายเงินผิดคน
      for (const s of sessions.filter((x) => x.status === "ok")) {
        expect(s.date).not.toBeNull();
        expect(s.staffId).not.toBeNull();
      }
      // ทุก session ต้องสืบทอดลูกค้าได้ (continuation rows ต้องไม่หลุด)
      expect(sessions.filter((s) => !s.customerName && !s.customerPhone).length).toBe(0);

      totalOk += sessions.filter((s) => s.status === "ok").length;
      totalReview += sessions.filter((s) => s.status === "needs_review").length;
    }
    expect(totalOk).toBeGreaterThan(0);
    expect(totalOk + totalReview).toBeGreaterThan(4000);
  });

  test("ชีตว่ายน้ำไม่มีคอลัมน์ครู → ทุกคาบต้องเข้าคิวรอตรวจ ไม่จ่ายมั่ว", async () => {
    const [grid] = await loadXlsxGrids(XLSX_PATH, ["สอนว่ายน้ำ"]);
    const src = SOURCES.find((s) => s.sheet === "สอนว่ายน้ำ")!;
    const sessions = parseGrid(grid, src.colMap, 1, ALIASES);
    expect(sessions.length).toBeGreaterThan(500);
    expect(sessions.filter((s) => s.status === "ok").length).toBe(0);
  });

  test("continuation rows สืบทอดลูกค้าจากแถวก่อนหน้า", async () => {
    const [grid] = await loadXlsxGrids(XLSX_PATH, ["PT"]);
    const src = SOURCES.find((s) => s.sheet === "PT")!;
    const sessions = parseGrid(grid, src.colMap, 1, ALIASES);
    // มีแถวที่ไม่มีชื่อในชีต แต่ session ที่ออกมาต้องมีชื่อลูกค้าครบ
    const rowsWithName = new Set(
      sessions.filter((s) => s.customerName).map((s) => s.rowIndex),
    );
    expect(rowsWithName.size).toBeGreaterThan(200);
  });
});

describe("กฎการอ่านเซลล์", () => {
  const run = (cells: (string | number)[]) =>
    parseGrid(
      {
        sheetName: "t",
        rows: [
          [{ v: "h", f: "h" }],
          ["ลูกค้า", "เล่น", "0812345678", 45000, 10, "PT พลอย", ...cells].map((v) =>
            typeof v === "number" ? { v, f: String(v) } : { v: String(v), f: String(v) },
          ),
        ],
      },
      { name: 0, nickname: 1, phone: 2, signup: 3, count: 4, trainer: 5, firstSession: 6 },
      1,
      ALIASES,
    );

  test("serial → จ่ายได้เลย", () => {
    const [s] = run([45405]);
    expect(s.status).toBe("ok");
    expect(s.date!.toISOString().slice(0, 10)).toBe("2024-04-23");
    expect(s.staffId).toBe("id-พลอย");
  });

  test("ตัวเลขหลง (837, 7.7) → รอตรวจ ไม่แปลงเป็นวันที่", () => {
    for (const v of [837, 7.7, 641, 482]) expect(run([v])[0].status).toBe("needs_review");
  });

  test("'แนน 7/2/2025' → คนสอนแทนได้เงิน ไม่ใช่เจ้าของแพ็ค", () => {
    const [s] = run(["แนน 7/2/2025"]);
    expect(s.staffId).toBe("id-แนน");
    expect(s.date!.toISOString().slice(0, 10)).toBe("2025-02-07");
    expect(s.status).toBe("ok");
  });

  test("'หัก 16/6' → รอตรวจ ห้ามจ่ายอัตโนมัติ", () => {
    expect(run(["หัก 16/6"])[0].status).toBe("needs_review");
  });

  test("'26/6 จิ้บลืมลง' → รอตรวจ (มีคำว่าลืม)", () => {
    expect(run(["26/6 จิ้บลืมลง"])[0].status).toBe("needs_review");
  });

  test("ป้ายกำกับแพ็ค → ข้าม ไม่นับเป็นคาบ ไม่รบกวนคนตรวจ", () => {
    for (const v of ["Platinum 1 เดือน", "โปร 5.5", "ทดลอง", "ตัดไปรอบใหม่", "6.6 Gold"])
      expect(run([v])[0].status).toBe("ignored");
  });

  test("วันที่พิมพ์เพี้ยน '4/4/' '5//7' '.' → รอตรวจ", () => {
    for (const v of ["4/4/", "5//7", ".", "/"]) expect(run([v])[0].status).toBe("needs_review");
  });

  test("d/m ไม่มีปี → เดาปีจาก anchor แต่ต้องให้คนยืนยัน", () => {
    const [a, b] = run([45405, "30/4"]); // anchor 2024-04-23 → 30/4 = 2024-04-30
    expect(a.status).toBe("ok");
    expect(b.date!.toISOString().slice(0, 10)).toBe("2024-04-30");
    expect(b.status).toBe("needs_review");
  });

  test("d/m ที่ย้อนหลัง anchor → ข้ามปี", () => {
    const [, b] = run([45405, "3/1"]); // anchor 2024-04-23 → 3/1 ต้องเป็น 2025
    expect(b.date!.toISOString().slice(0, 10)).toBe("2025-01-03");
  });

  test("เทรนเนอร์ที่ไม่รู้จัก ('PT มิกซ์') → ไม่เดา เข้าคิวรอตรวจ", () => {
    const rows = parseGrid(
      {
        sheetName: "t",
        rows: [
          [{ v: "h", f: "h" }],
          ["ลูกค้า", "เล่น", "0812345678", 45000, 10, "PT มิกซ์", 45405].map((v) =>
            typeof v === "number" ? { v, f: String(v) } : { v: String(v), f: String(v) },
          ),
        ],
      },
      { name: 0, nickname: 1, phone: 2, signup: 3, count: 4, trainer: 5, firstSession: 6 },
      1,
      ALIASES,
    );
    expect(rows[0].status).toBe("needs_review");
    expect(rows[0].staffId).toBeNull();
  });
});
