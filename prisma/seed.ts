import { db } from "../lib/db";
import { CONFIG_DEFAULTS } from "../lib/config-keys";
import { normalizeTrainer } from "../lib/normalize";
import { sheetIdFromLink } from "../lib/sheets";
import { hashPassword } from "../lib/password";

// §1.2 ตารางเรท กิจกรรม × ระดับ — Yoga จงใจไม่ seed (สเปคยังไม่ให้เรท §7 ข้อ 10)
const RATES: Record<string, Record<string, number>> = {
  pt: { PT: 200, CT: 300, ST: 400 },
  pilates: { PT: 300, CT: 400, ST: 500 },
  swim: { PT: 250, CT: 250, ST: 250 },
};

// §1.4 ราคาเต็ม 13 คลาส
const CLASSES: [string, number][] = [
  ["Aqua Fit", 400],
  ["Aqua Beats", 400],
  ["TRX", 300],
  ["Body Combat", 400],
  ["BOSU Class", 400],
  ["Roller Stretch", 200],
  ["Core Strength", 200],
  ["Body Pump", 400],
  ["Functional Training", 200],
  ["Yoga Essential", 400],
  ["LesMills Pilates", 400],
  ["Darin Pilates", 400],
  ["Flow Stretch", 200],
];

// เทรนเนอร์ที่พบในชีตจริง — rank ต้องให้ admin ยืนยัน (ดู warning ท้าย seed)
const TRAINERS = ["พลอย", "แพท", "โอ", "ต้น", "แนน", "จิ้บ"];

// §1.2 การ map คอลัมน์ต่อชีต (index 0-based) — โครงสร้างไม่เหมือนกันสักชีต
const SOURCES = [
  {
    sheetName: "PT",
    activity: "pt",
    colMap: { name: 0, nickname: 1, phone: 2, signup: 3, count: 4, trainer: 5, firstSession: 6 },
  },
  {
    sheetName: "Pilates",
    activity: "pilates",
    colMap: { name: 1, nickname: 2, phone: 3, signup: 4, count: 5, trainer: 6, firstSession: 7 },
  },
  {
    sheetName: "สอนว่ายน้ำ",
    activity: "swim",
    // ไม่มีคอลัมน์ครูเลย → ทุก session จะเข้าคิวรอตรวจ (§7 ข้อ 2)
    colMap: { name: 0, nickname: 1, phone: 2, signup: 3, trainer: null, firstSession: 4 },
  },
  {
    sheetName: "Yoga",
    activity: "yoga",
    colMap: { name: 0, nickname: 1, phone: 2, signup: 3, count: 4, trainer: 5, firstSession: 6 },
  },
];

async function main() {
  for (const [key, { value, note }] of Object.entries(CONFIG_DEFAULTS)) {
    await db.payrollConfig.upsert({
      where: { key },
      update: { note }, // ไม่ทับค่าที่ admin แก้แล้ว
      create: { key, value, note },
    });
  }

  for (const [activity, byRank] of Object.entries(RATES))
    for (const [rank, rate] of Object.entries(byRank))
      await db.teachRate.upsert({
        where: { activity_rank: { activity, rank } },
        update: {},
        create: { activity, rank, rate },
      });

  for (const [name, price] of CLASSES)
    await db.classPrice.upsert({ where: { name }, update: {}, create: { name, price } });

  const owner = await db.staff.upsert({
    where: { username: "owner" },
    update: {},
    create: {
      name: "เจ้าของยิม",
      username: "owner",
      passwordHash: await hashPassword("changeme"),
      role: "owner",
      baseSalary: 0,
    },
  });

  for (const name of TRAINERS) {
    const staff = await db.staff.upsert({
      where: { username: name },
      update: {},
      create: {
        name,
        username: name,
        passwordHash: await hashPassword("changeme"),
        role: "trainer",
        rank: "PT", // ⚠️ ต้องให้ admin ยืนยัน
        baseSalary: 10000,
        classCredit: 5000,
      },
    });
    await db.trainerAlias.upsert({
      where: { alias: normalizeTrainer(name) },
      update: { staffId: staff.id },
      create: { alias: normalizeTrainer(name), staffId: staff.id },
    });
  }

  const link = process.env.GOOGLE_SHEET_LINK;
  const spreadsheetId = link ? sheetIdFromLink(link) : "SET_ME_IN_ADMIN";
  for (const s of SOURCES)
    await db.sheetSource.upsert({
      where: { spreadsheetId_sheetName: { spreadsheetId, sheetName: s.sheetName } },
      update: { activity: s.activity, colMap: s.colMap },
      create: { spreadsheetId, ...s },
    });

  console.log(`seed เสร็จ (owner=${owner.username} / changeme)`);
  console.log("⚠️  ต้องทำต่อในหน้า /admin/config ก่อนคิดเงินเดือนจริง:");
  console.log("   1. ตั้ง rank (ST/CT/PT) ของเทรนเนอร์แต่ละคน — ตอนนี้ seed เป็น PT ทั้งหมด");
  console.log("   2. ใส่เรท Yoga (ยังไม่มีในสเปค §7 ข้อ 10)");
  console.log("   3. ใส่ spreadsheetId จริง");
  console.log("   4. เปลี่ยนรหัสผ่านทุกคน (seed = changeme)");
}

main().finally(() => db.$disconnect());
