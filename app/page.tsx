import Link from "next/link";
import { redirect } from "next/navigation";
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

      {(blockers.sheetReview > 0 ||
        blockers.classImport > 0 ||
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
