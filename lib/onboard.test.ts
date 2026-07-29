import { expect, test, describe } from "bun:test";
import { parseGrid, type ColMap } from "./parser";
import { normalizeTrainer } from "./normalize";

/**
 * สถานการณ์: ยิมรับเทรนเนอร์ใหม่ ชื่อโผล่ในชีตก่อนที่ admin จะเพิ่มเข้าระบบ
 * ระบบต้อง "ไม่จ่ายผิด" ก่อน แล้วพอเพิ่มพนักงาน + sync ใหม่ ต้องจับคู่ย้อนหลังให้เอง
 */
const COLMAP: ColMap = {
  name: 0,
  nickname: 1,
  phone: 2,
  signup: 3,
  count: 4,
  trainer: 5,
  firstSession: 6,
};

const grid = (trainerCell: string) => ({
  sheetName: "PT",
  rows: [
    ["h"].map((v) => ({ v, f: v })),
    ["ลูกค้า ก", "ก", "0812345678", 45000, 10, trainerCell, 45405, 45412].map((v) =>
      typeof v === "number" ? { v, f: String(v) } : { v: String(v), f: String(v) },
    ),
  ],
});

const OLD = new Map([[normalizeTrainer("พลอย"), "id-พลอย"]]);

describe("พนักงานใหม่เข้ามา", () => {
  test("ชื่อใหม่ยังไม่อยู่ในระบบ → เข้าคิวรอตรวจ ไม่จ่ายให้ใครมั่ว", () => {
    const rows = parseGrid(grid("PT บอส"), COLMAP, 1, OLD);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.status).toBe("needs_review");
      expect(r.staffId).toBeNull();
      expect(r.reviewNote).toContain("ไม่รู้จักเทรนเนอร์");
    }
    // วันที่ยังอ่านได้ปกติ ข้อมูลไม่หาย แค่รอระบุคน
    expect(rows[0].date!.toISOString().slice(0, 10)).toBe("2024-04-23");
  });

  test("เพิ่มพนักงาน + alias แล้ว sync ใหม่ → คาบเก่าจับคู่ย้อนหลังเอง", () => {
    const after = new Map([...OLD, [normalizeTrainer("PT บอส"), "id-บอส"]]);
    const rows = parseGrid(grid("PT บอส"), COLMAP, 1, after);
    for (const r of rows) {
      expect(r.status).toBe("ok");
      expect(r.staffId).toBe("id-บอส");
    }
  });

  test("ชื่อใหม่สะกดหลายแบบ ยุบเป็น alias เดียว ไม่ต้องเพิ่มซ้ำ", () => {
    const after = new Map([[normalizeTrainer("บอส"), "id-บอส"]]);
    for (const spelling of ["PT บอส", "PTบอส", "pt บอส", "พี่บอส", "บอส", "Pt บอส"])
      expect(parseGrid(grid(spelling), COLMAP, 1, after)[0].staffId).toBe("id-บอส");
  });

  test("ลูกค้าใหม่ไม่ต้องตั้งค่าอะไรเลย — ชื่อมาจากชีตตรงๆ", () => {
    const rows = parseGrid(grid("พลอย"), COLMAP, 1, OLD);
    expect(rows[0].customerName).toBe("ลูกค้า ก");
    expect(rows[0].status).toBe("ok");
  });
});
