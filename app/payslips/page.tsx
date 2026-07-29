import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { runPayroll, pendingReviewInPeriod } from "@/lib/payroll-run";

export const dynamic = "force-dynamic";

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

function thisPeriod() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function PayslipsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const period = (await searchParams).period ?? thisPeriod();

  const [slips, pending] = await Promise.all([
    db.payslip.findMany({
      where: { period },
      include: { staff: true },
      orderBy: { staff: { name: "asc" } },
    }),
    pendingReviewInPeriod(period),
  ]);

  async function compute(formData: FormData) {
    "use server";
    await requireAdmin();
    const p = String(formData.get("period"));
    await runPayroll(p);
    revalidatePath("/payslips");
    redirect(`/payslips?period=${p}`);
  }

  async function setStatus(formData: FormData) {
    "use server";
    await requireAdmin();
    await db.payslip.update({
      where: { id: String(formData.get("id")) },
      data: { status: String(formData.get("status")) },
    });
    revalidatePath("/payslips");
  }

  const total = slips.reduce((s, x) => s + x.net, 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">สลิปเงินเดือน</h1>

      <form action={compute} className="card flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          งวด
          <input name="period" defaultValue={period} className="input" pattern="\d{4}-\d{2}" />
        </label>
        <button className="btn">คำนวณเงินเดือนงวดนี้</button>
        <Link href={`/payslips?period=${period}`} className="btn-ghost">
          ดูงวดนี้
        </Link>
      </form>

      {pending > 0 && (
        <p className="card border-amber-300 bg-amber-50 text-sm text-amber-800">
          ⚠️ ยังมี <b>{pending}</b> คาบค้าง<Link href="/sync/review" className="underline">คิวรอตรวจ</Link>
          {" "}— คำนวณตอนนี้จะ<b>จ่ายขาด</b> เคลียร์ให้หมดก่อน
        </p>
      )}

      <table className="card w-full">
        <thead>
          <tr>
            {["พนักงาน", "ฐาน", "ค่าสอน", "คลาส", "คอม", "OT", "รวมสุทธิ", "สถานะ", ""].map((h) => (
              <th key={h} className="th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slips.map((s) => (
            <tr key={s.id}>
              <td className="td">
                <Link href={`/payslips/${s.id}`} className="underline">
                  {s.staff.name}
                </Link>
                <span className="ml-1 text-xs text-neutral-400">
                  {s.staff.role}
                  {s.staff.rank ? `/${s.staff.rank}` : ""}
                </span>
              </td>
              <td className="td">{baht(s.base)}</td>
              <td className="td">{baht(s.teachPay)}</td>
              <td className="td">{baht(s.classPay)}</td>
              <td className="td">{baht(s.commission)}</td>
              <td className="td">{baht(s.otPay)}</td>
              <td className="td font-semibold">{baht(s.net)}</td>
              <td className="td text-xs">{s.status}</td>
              <td className="td">
                <form action={setStatus} className="flex gap-1">
                  <input type="hidden" name="id" value={s.id} />
                  {s.status === "draft" && (
                    <button name="status" value="approved" className="btn">
                      อนุมัติ
                    </button>
                  )}
                  {s.status === "approved" && (
                    <button name="status" value="paid" className="btn">
                      จ่ายแล้ว
                    </button>
                  )}
                  {s.status !== "draft" && (
                    <button name="status" value="draft" className="btn-ghost">
                      กลับเป็นร่าง
                    </button>
                  )}
                </form>
              </td>
            </tr>
          ))}
          {slips.length > 0 && (
            <tr>
              <td className="td font-semibold" colSpan={6}>
                รวมทั้งงวด
              </td>
              <td className="td font-semibold">{baht(total)}</td>
              <td className="td" colSpan={2} />
            </tr>
          )}
        </tbody>
      </table>

      {slips.length === 0 && (
        <p className="text-sm text-neutral-500">ยังไม่มีสลิปในงวด {period} — กดคำนวณ</p>
      )}
    </div>
  );
}
