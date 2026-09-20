import { db } from "../lib/db";
import { CONFIG_DEFAULTS } from "../lib/config-keys";
import { normalizeTrainer } from "../lib/normalize";
import { sheetIdFromLink } from "../lib/sheets";
import { generatePassword, hashPassword, LOGIN_DISABLED } from "../lib/password";
import {
  plantsFixture,
  recordsMark,
  seedMode,
  seedReport,
  type FixtureGaps,
} from "../lib/seed-policy";

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

/**
 * What a release added that this database does not have and **no screen can create** (task 040).
 *
 * Read-only, and deliberately narrow. It does **not** report missing `TeachRate` cells — that
 * matrix belongs to the owner, and listing its holes on every deploy is noise plus an invitation to
 * re-plant them — and it does not report missing `TRAINERS`, because staff are data (§2 rule 7) and
 * `/admin/config` can add one.
 *
 * Sheets are matched on `sheetName` alone, not on the `[spreadsheetId, sheetName]` pair the upsert
 * used to key on: `spreadsheetId` is owner-editable, so the pair would report all four sheets as
 * missing on every deploy after the owner corrects it.
 */
async function fixtureGaps(): Promise<FixtureGaps> {
  const havePrice = new Set(
    (await db.classPrice.findMany({ select: { name: true } })).map((r) => r.name),
  );
  const haveSheet = new Set(
    (await db.sheetSource.findMany({ select: { sheetName: true } })).map((r) => r.sheetName),
  );
  return {
    classes: CLASSES.filter(([name]) => !havePrice.has(name)).map(([name]) => name),
    sheets: SOURCES.filter((s) => !haveSheet.has(s.sheetName)).map((s) => s.sheetName),
  };
}

/**
 * The reference fixture — written on **one** run of one database, and never again (task 040).
 * Returns the number of writes it made that are able to create a row.
 *
 * 🔑 **`upsert … update: {}` stays, and is no longer load-bearing.** On this branch nothing it
 * protects against can happen; what it now covers is exactly one case — a re-run after a first boot
 * that crashed before the mark was written — and that is what makes the retry idempotent. Deleting
 * these as "dead code now" re-opens a database no later run can complete.
 *
 * 🔴 **The `Staff` block is written LAST and inside one transaction, and neither is cosmetic.**
 * `Staff.count() === 0` is the witness that decides `initialize` vs `adopt`, and this function is
 * what makes it false — so a crash *after* the staff rows and *before* the rest would make the
 * retry `adopt` and withhold the remainder forever. Written last, that window shrinks to a crash
 * inside the staff block; wrapped in `db.$transaction`, it closes: the witness can only ever read
 * 0 (rolled back) or 7 (committed over a complete fixture). The task 040 design rejected a
 * transaction here because of the `hashPassword` calls inside it — hoisting the hash out is what
 * removed that objection, and the hash must stay out.
 *
 * ⚠️ **One window is left and it is not closable from here**: a crash between the transaction's
 * commit and the credential `console.log` below leaves an owner row whose generated password was
 * never printed, and the next run reads `adopt` and will not print it. Printing before the commit
 * would hand out a credential for a run that may roll back. The repair is `OWNER_PASSWORD`.
 */
async function plantFixture(): Promise<number> {
  let writes = 0;

  // The activity **name** registry (task 036). Backfilled from the two lists this file already owns
  // — the rate matrix and the sheet sources — so `yoga` is registered as a name while deliberately
  // keeping **no rate** (§7 ข้อ 10 is still open): that is the pair the §2 rule 4 warning exists for.
  // `update: {}` on purpose — a name that is already registered is never rewritten, and nothing here
  // ever creates a `TeachRate` row for a name, because seeding a rate is what made an unpriced
  // activity look priced.
  for (const activity of new Set([...Object.keys(RATES), ...SOURCES.map((s) => s.activity)])) {
    await db.teachActivity.upsert({
      where: { name: activity },
      update: {},
      create: { name: activity },
    });
    writes++;
  }

  for (const [activity, byRank] of Object.entries(RATES))
    for (const [rank, rate] of Object.entries(byRank)) {
      await db.teachRate.upsert({
        where: { activity_rank: { activity, rank } },
        update: {},
        create: { activity, rank, rate },
      });
      writes++;
    }

  for (const [name, price] of CLASSES) {
    await db.classPrice.upsert({ where: { name }, update: {}, create: { name, price } });
    writes++;
  }

  const link = process.env.GOOGLE_SHEET_LINK;
  const spreadsheetId = link ? sheetIdFromLink(link) : "SET_ME_IN_ADMIN";
  for (const s of SOURCES) {
    // `update: {}` — the owner re-points a sheet and re-maps its columns at /admin/config, and this
    // line used to push both back on every deploy. The `where:` is still the computed id, which on
    // a database we are initialising is the only id there is.
    await db.sheetSource.upsert({
      where: { spreadsheetId_sheetName: { spreadsheetId, sheetName: s.sheetName } },
      update: {},
      create: { spreadsheetId, ...s },
    });
    writes++;
  }

  // รหัส owner: ใช้ OWNER_PASSWORD ถ้ากำหนดมา ไม่งั้นสุ่มให้แล้วพิมพ์ครั้งเดียว
  const ownerPassword = process.env.OWNER_PASSWORD || generatePassword();
  const generated = !process.env.OWNER_PASSWORD;
  // 🔴 Hashed **before** the transaction opens, and that is what makes the transaction affordable.
  // `hashPassword` is scrypt (`lib/password.ts`) — the one slow step in this function — and it
  // needs no database, so holding it inside would spend the interactive window on CPU. What is
  // left inside is 13 upserts against the 5 s Prisma applies by default, the same budget
  // `app/admin/config/page.tsx` already carries ~65 round-trips inside. No `timeout` is passed
  // here either, so that number stays Prisma's default and is not a claim this file makes.
  const ownerHash = await hashPassword(ownerPassword);
  const existingOwner = await db.staff.findUnique({ where: { username: "owner" } });

  // 🔴 **Every staff row and every alias, or none of them.** Partway through was the one state the
  // retry could not repair: the witness reads 1–6, the next run says `adopt`, and the rest of the
  // fixture is withheld forever — trainers with no `Staff` row and no `TrainerAlias`, whose sheet
  // rows then resolve to `staffId: null` and sit in the review queue unpaid, plus an owner row
  // holding a generated password that was never printed. Wrapped, the witness reads 0 or 7.
  const owner = await db.$transaction(async (tx) => {
    const row = await tx.staff.upsert({
      where: { username: "owner" },
      update: {}, // ไม่ทับรหัสที่เปลี่ยนไปแล้ว
      create: {
        name: "เจ้าของยิม",
        username: "owner",
        passwordHash: ownerHash,
        role: "owner",
        baseSalary: 0,
      },
    });

    for (const name of TRAINERS) {
      const staff = await tx.staff.upsert({
        where: { username: name },
        update: {},
        create: {
          name,
          username: name,
          // เทรนเนอร์ลงข้อมูลผ่าน Google Sheet ไม่ต้องเข้าเว็บ → ปิดการล็อกอินไว้
          // ยังต้องมีตัวตนในระบบเพื่อรับเงินและผูก alias ชื่อในชีต
          passwordHash: LOGIN_DISABLED,
          role: "trainer",
          rank: "PT", // ⚠️ ต้องให้ admin ยืนยัน
          baseSalary: 10000,
          classCredit: 5000,
        },
      });
      // `update: {}` — an alias the owner re-pointed at another staff member used to be pushed back
      // to this one on every deploy.
      await tx.trainerAlias.upsert({
        where: { alias: normalizeTrainer(name) },
        update: {},
        create: { alias: normalizeTrainer(name), staffId: staff.id },
      });
    }
    return row;
  });
  writes += 1 + TRAINERS.length * 2;

  // ⚠️ **As soon as the transaction commits** — not at the end of the fixture, where a crash in
  // between left a credential that no later run will ever print (see this function's header).
  // ⚠️ `existingOwner` is only ever non-null on a **forced** `initialize` (a mutant, or a database
  // whose mark and `Staff.count()` disagree with its rows): `plantFixture` runs behind
  // `staffCount === 0`, so on the `adopt` path this line never prints. It is a guard, not a branch
  // the deploy takes — do not read it as "adopt says this".
  if (existingOwner) {
    console.log(`บัญชี ${owner.username} มีอยู่แล้ว — ไม่แตะรหัสเดิม`);
  } else if (generated) {
    console.log("\n┌─ รหัสผ่าน owner (แสดงครั้งเดียว เก็บใส่ password manager ทันที) ─");
    console.log(`│  ผู้ใช้ : owner`);
    console.log(`│  รหัส  : ${ownerPassword}`);
    console.log("└──────────────────────────────────────────────────────────────\n");
  } else {
    console.log("บัญชี owner ใช้รหัสจาก OWNER_PASSWORD");
  }
  console.log("เทรนเนอร์ทุกคน: ปิดการล็อกอินไว้ (ลงข้อมูลผ่าน Google Sheet เหมือนเดิม)");
  console.log("⚠️  ต้องทำต่อในหน้า /admin/config ก่อนคิดเงินเดือนจริง:");
  console.log("   1. ตั้ง rank (ST/CT/PT) ของเทรนเนอร์แต่ละคน — ตอนนี้ seed เป็น PT ทั้งหมด");
  console.log("   2. ใส่เรท Yoga (ยังไม่มีในสเปค §7 ข้อ 10)");

  return writes;
}

async function main() {
  // ── one decision, read before any write ──────────────────────────────────
  const mode = seedMode({
    marked: (await db.seedMark.findUnique({ where: { name: "bootstrap" } })) !== null,
    staffCount: await db.staff.count(),
  });
  let creatingWrites = 0;

  // ── the exception: the CONFIG_DEFAULTS key set is schema, asserted in every mode ──
  // A missing key makes `num()` throw at page render and `/admin/config` renders no box for a row
  // that does not exist ⇒ no human can create it through the product. The **value** is still
  // written once and never again (§2 rule 3: ค่าใน CONFIG_DEFAULTS ใช้ตอน seed เท่านั้น), and
  // there is no delete path here — a key removed from the repo leaves its row alone.
  const have = new Set(
    (await db.payrollConfig.findMany({ select: { key: true } })).map((r) => r.key),
  );
  const missing = Object.entries(CONFIG_DEFAULTS).filter(([key]) => !have.has(key));
  if (missing.length) {
    await db.payrollConfig.createMany({
      data: missing.map(([key, { value, note }]) => ({ key, value, note })),
      skipDuplicates: true,
    });
    creatingWrites += missing.length;
  }
  // `note` is code-owned: `/admin/config` renders it as a <span>, never an input, so there is no
  // owner edit of it to overwrite. ไม่ทับค่าที่ admin แก้แล้ว — `value` is not in this update.
  for (const [key, { note }] of Object.entries(CONFIG_DEFAULTS))
    if (have.has(key)) await db.payrollConfig.update({ where: { key }, data: { note } });

  // ── everything else: only on a database we are the ones creating ─────────
  if (plantsFixture(mode)) creatingWrites += await plantFixture();

  // ← LAST. After every fixture write, so a first boot that crashes leaves no mark and the next
  //   run re-attempts the whole thing.
  if (recordsMark(mode)) {
    // 🔴 `createMany … skipDuplicates`, never a bare `create` — symmetric with the config-key
    // insert above and for the same reason. Two `migrate` containers overlap on this host as a
    // matter of routine (a push to `develop` deploys, and §6 asks for a push per commit): both
    // read `marked: false` before either writes, both reach this line, and the loser of a bare
    // `create` gets P2002 ⇒ a non-zero exit ⇒ `app` never starts, because compose gives it
    // `depends_on: migrate: condition: service_completed_successfully`. A genuine `db push`
    // mismatch is still loud; only the collision this policy itself creates is absorbed.
    await db.seedMark.createMany({
      data: [{ name: "bootstrap", mode: mode === "initialize" ? "planted" : "adopted" }],
      skipDuplicates: true,
    });
    creatingWrites++;
  }

  console.log("seed เสร็จ");
  const report = seedReport(
    mode,
    await fixtureGaps(),
    missing.map(([key]) => key),
    creatingWrites,
  );
  for (const line of report) console.log(line);
}

main().finally(() => db.$disconnect());
