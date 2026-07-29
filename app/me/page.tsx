import { redirect } from "next/navigation";
import { currentStaff, logout } from "@/lib/auth";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/payroll-run";

export const dynamic = "force-dynamic";

/** เทรนเนอร์เห็นเฉพาะชั่วโมง/KPI ตัวเอง — ห้ามเห็นตัวเงิน (§หัวสเปค) */
export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const me = await currentStaff();
  if (!me) redirect("/login");
  const period = (await searchParams).period ?? new Date().toISOString().slice(0, 7);
  const { from, to } = periodRange(period);

  const [sessions, classes, pending] = await Promise.all([
    db.teachSession.groupBy({
      by: ["activity"],
      where: { staffId: me.id, status: "ok", date: { gte: from, lt: to } },
      _count: { _all: true },
    }),
    db.classSession.count({ where: { staffId: me.id, date: { gte: from, lt: to } } }),
    db.teachSession.count({
      where: { staffId: me.id, status: "needs_review", date: { gte: from, lt: to } },
    }),
  ]);

  const total = sessions.reduce((s, x) => s + x._count._all, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">
          {me.name} {me.rank ? `(${me.rank})` : ""} — งวด {period}
        </h1>
        <form className="flex gap-2">
          <input name="period" defaultValue={period} className="input w-28" pattern="\d{4}-\d{2}" />
          <button className="btn-ghost">ดู</button>
        </form>
        <form
          action={async () => {
            "use server";
            await logout();
          }}
          className="ml-auto"
        >
          <button className="btn-ghost">ออกจากระบบ</button>
        </form>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="card">
          <div className="text-xs text-neutral-500">คาบสอน 1-on-1 รวม</div>
          <div className="text-2xl font-semibold">{total}</div>
        </div>
        <div className="card">
          <div className="text-xs text-neutral-500">คาบคลาส Group</div>
          <div className="text-2xl font-semibold">{classes}</div>
        </div>
        <div className="card">
          <div className="text-xs text-neutral-500">คาบที่รอตรวจ</div>
          <div className="text-2xl font-semibold text-amber-700">{pending}</div>
        </div>
      </div>

      <table className="card w-full max-w-md">
        <thead>
          <tr>
            <th className="th">กิจกรรม</th>
            <th className="th">จำนวนคาบ</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.activity}>
              <td className="td">{s.activity}</td>
              <td className="td">{s._count._all}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
