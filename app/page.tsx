import Link from "next/link";
import { redirect } from "next/navigation";
import { ColorSwatches } from "@/app/_components/color-swatches";
import { currentStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/payroll-run";
import { runBlockers } from "@/lib/run-blockers";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const me = await currentStaff();
  if (!me) redirect("/login");
  if (me.role === "trainer" || me.role === "counter") redirect("/me");

  const period = (await searchParams).period ?? new Date().toISOString().slice(0, 7);
  const { from, to } = periodRange(period);

  // 🔑 **The same function `/payslips` reads, with the same `period`** — `lib/run-blockers.ts`. Two
  // screens counting "is this month clean" for themselves is two screens that disagree.
  const [sessions, blockers, slips, sales, missingRank, missingRate] = await Promise.all([
    db.teachSession.count({ where: { status: "ok", date: { gte: from, lt: to } } }),
    runBlockers(period),
    db.payslip.findMany({ where: { period } }),
    db.sale.aggregate({ where: { date: { gte: from, lt: to } }, _sum: { netPrice: true } }),
    db.staff.count({ where: { role: "trainer", active: true, rank: null } }),
    db.teachSession.groupBy({
      by: ["activity"],
      where: { status: "ok", date: { gte: from, lt: to } },
    }),
  ]);

  const rates = await db.teachRate.findMany();
  // Split rather than one list: the two states need different instructions (`ColorSwatches`).
  const unapplied = blockers.colorGaps.filter((c) => c.state === "unapplied");
  const unruled = blockers.colorGaps.filter((c) => c.state === "unruled");
  const activitiesWithoutRate = missingRate
    .map((a) => a.activity)
    .filter((a) => !rates.some((r) => r.activity === a));

  const stats: [string, string | number, string?][] = [
    ["คาบสอนพร้อมจ่าย", sessions],
    ["คาบรอตรวจ", blockers.sheetReview, blockers.sheetReview > 0 ? "text-amber-700" : undefined],
    // Beside it, never summed into it: this one counts คาบ that are **not in the database at all**.
    [
      "คาบนำเข้าไม่ได้",
      blockers.classImport,
      blockers.classImport > 0 ? "text-amber-700" : undefined,
    ],
    ["ยอดขายในงวด", (sales._sum.netPrice ?? 0).toLocaleString("th-TH")],
    ["สลิปที่คำนวณแล้ว", slips.length],
    ["รวมจ่ายสุทธิ", slips.reduce((s, x) => s + x.net, 0).toLocaleString("th-TH")],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">ภาพรวมงวด {period}</h1>
        <form className="flex gap-2">
          <input name="period" defaultValue={period} className="input w-28" pattern="\d{4}-\d{2}" />
          <button className="btn-ghost">ดู</button>
        </form>
      </div>

      {/* Six tiles now (task 064 added one), so the row wraps on md instead of squeezing six
          numbers into five columns — a money figure that has to be squinted at is not readable. */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, v, cls]) => (
          <div key={label} className="card">
            <div className="text-xs text-neutral-500">{label}</div>
            <div className={`text-2xl font-semibold ${cls ?? ""}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* 🔴 **Its own box, deliberately outside "ต้องเคลียร์ก่อนจ่ายจริง"** (ใบ 070). Everything in
          that list is คาบ that will be paid **short** until somebody acts; this is คาบ that will not
          be paid **at all, because somebody already acted**. Filing it as a blocker would tell the
          owner to go undo their own decision every month. It is here at all because ใบ 070 gave the
          product its first button that takes money *off* a slip, and a recomputed slip carries no
          trace of it — no `PayslipWarning`, no line, nothing on `/me`, just a smaller number
          (§2 ข้อ 4). */}
      {blockers.handIgnored > 0 && (
        <p className="card text-sm">
          งวดนี้มี <b>{blockers.handIgnored}</b> คาบที่<b>คนกดข้ามเอง</b> ⇒ ไม่เข้าเงินเดือน และ
          <b>ไม่มีบรรทัดไหนในสลิปบอกไว้</b> —{" "}
          <Link href={`/sync/review?ignored=1&period=${period}`} className="underline">
            ดูรายการ / เอากลับเข้าคิว
          </Link>
        </p>
      )}

      {(blockers.sheetReview > 0 ||
        blockers.classImport > 0 ||
        blockers.colorGaps.length > 0 ||
        missingRank > 0 ||
        activitiesWithoutRate.length > 0) && (
        <div className="card-warn text-sm">
          <p className="mb-1 font-medium">ต้องเคลียร์ก่อนจ่ายจริง</p>
          <ul className="list-inside list-disc space-y-1">
            {blockers.sheetReview > 0 && (
              <li>
                มี {blockers.sheetReview} คาบใน
                <Link href="/sync/review" className="underline">
                  คิวรอตรวจ
                </Link>{" "}
                — คำนวณตอนนี้จะจ่ายขาด
              </li>
            )}
            {blockers.classImport > 0 && (
              <li>
                มี {blockers.classImport} คาบจากไฟล์ Gymmo ที่ยังไม่ได้เข้าฐานข้อมูล →{" "}
                <Link href="/classes" className="underline">
                  คาบสอนคลาส
                </Link>{" "}
                — สลิปจะขาดค่าสอนคาบพวกนี้ โดยไม่มีคำเตือนในสลิป
              </li>
            )}
            {/* 🔴 The only lines here that report pay going out **too high**: a คาบ whose colour
                has no rule — or has one the stored rows do not obey — syncs as `ok`, so it is on
                the slip already with no warning beside it (`lib/color-rules.ts`, card 043). Two
                items, not one: "nobody answered" and "you answered and it has not taken effect"
                are different actions, and the second is the one the owner thinks is closed. */}
            {unapplied.length > 0 && (
              <li>
                <b>{unapplied.length} สีมีกฎแล้วแต่คาบเก่ายังไม่ถูกจัดตาม</b> — กฎสีมีผลตอน sync
                เท่านั้น ต้อง{" "}
                <Link href="/sync" className="underline">
                  sync ใหม่
                </Link>{" "}
                คาบพวกนี้ถึงจะเปลี่ยน · 🔴 ส่วนคาบที่<b>ตรวจด้วยมือแล้ว</b> sync จะข้ามตลอดไป ต้อง
                <b>กดข้ามเองจากลิงก์ที่อยู่ข้างสีนั้น</b> — ไม่ว่าทางไหนก็ห้ามตั้งสีเป็น
                &quot;จ่ายปกติ&quot; เพื่อให้คำเตือนหาย <ColorSwatches colors={unapplied} />
              </li>
            )}
            {unruled.length > 0 && (
              <li>
                สีพื้นในชีต {unruled.length} สีที่ยังไม่มีใครบอกว่าแปลว่าอะไร — ระบบ
                <b>จ่ายให้ทุกสีที่ยังไม่ได้ตั้งกฎ</b> ถ้าสีนั้นแปลว่า ยกเลิก / จ่ายแล้ว /
                คนอื่นสอนแทน (REQUIREMENTS §1.6) คาบพวกนี้กำลังจ่ายผิดอยู่{" "}
                <ColorSwatches colors={unruled} /> →{" "}
                <Link href="/admin/config" className="underline">
                  ตั้งค่า
                </Link>
              </li>
            )}
            {missingRank > 0 && (
              <li>
                เทรนเนอร์ {missingRank} คนยังไม่ได้ตั้งระดับ (ST/CT/PT) →{" "}
                <Link href="/admin/config" className="underline">
                  ตั้งค่า
                </Link>
              </li>
            )}
            {activitiesWithoutRate.length > 0 && (
              <li>
                ยังไม่มีเรทค่าสอนของกิจกรรม: {activitiesWithoutRate.join(", ")} →{" "}
                <Link href="/admin/config" className="underline">
                  ตั้งค่า
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <Link href="/sync" className="btn-ghost">
          Sync ตารางสอน
        </Link>
        <Link href={`/payslips?period=${period}`} className="btn">
          ไปหน้าคำนวณเงินเดือน
        </Link>
      </div>
    </div>
  );
}
