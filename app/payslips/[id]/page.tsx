import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/payroll-run";

export const dynamic = "force-dynamic";

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

const GROUP_LABEL: Record<string, string> = {
  base: "ฐานเงินเดือน",
  teach: "ค่าสอน 1-on-1",
  class: "ค่าสอนคลาส Group",
  commission: "ค่าคอมมิชชั่น",
  ot: "OT",
};

export default async function PayslipDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const slip = await db.payslip.findUnique({
    where: { id: (await params).id },
    include: { staff: true, lines: true },
  });
  if (!slip) notFound();

  const { from, to } = periodRange(slip.period);
  const sessions = await db.teachSession.findMany({
    where: { staffId: slip.staffId, status: "ok", date: { gte: from, lt: to } },
    orderBy: { date: "asc" },
  });

  const groups = [...new Set(slip.lines.map((l) => l.group))];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <Link href={`/payslips?period=${slip.period}`} className="text-sm underline">
          ← กลับ
        </Link>
        <h1 className="text-xl font-semibold">
          {slip.staff.name} — งวด {slip.period}
        </h1>
        <span className="text-sm text-neutral-500">{slip.status}</span>
      </div>

      <table className="card w-full">
        <thead>
          <tr>
            {["รายการ", "จำนวน", "เรท", "เป็นเงิน"].map((h) => (
              <th key={h} className="th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <>
              <tr key={g}>
                <td className="td bg-neutral-50 text-xs font-semibold" colSpan={4}>
                  {GROUP_LABEL[g] ?? g}
                </td>
              </tr>
              {slip.lines
                .filter((l) => l.group === g)
                .map((l) => (
                  <tr key={l.id}>
                    <td className="td pl-6">{l.label}</td>
                    <td className="td">{l.qty || ""}</td>
                    <td className="td">{l.rate || ""}</td>
                    <td className="td">{baht(l.amount)}</td>
                  </tr>
                ))}
            </>
          ))}
          <tr>
            <td className="td font-semibold" colSpan={3}>
              รวมสุทธิ
            </td>
            <td className="td font-semibold">{baht(slip.net)}</td>
          </tr>
        </tbody>
      </table>

      <details className="card">
        <summary className="cursor-pointer text-sm font-medium">
          คาบสอนที่นับในงวดนี้ ({sessions.length})
        </summary>
        <table className="mt-2 w-full">
          <thead>
            <tr>
              {["วันที่", "กิจกรรม", "ลูกค้า", "ค่าในชีต"].map((h) => (
                <th key={h} className="th">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="td">{s.date?.toISOString().slice(0, 10)}</td>
                <td className="td">{s.activity}</td>
                <td className="td">{s.customerName ?? "—"}</td>
                <td className="td font-mono text-xs text-neutral-400">{s.rawValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
