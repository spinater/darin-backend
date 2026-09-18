import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { runPayroll, pendingReviewInPeriod } from "@/lib/payroll-run";
import { SubmitButton } from "@/app/_components/submit-button";
import { ActionProgress } from "@/app/_components/action-progress";
import { timed } from "@/lib/job-timing";

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

  const [slips, pending, lastRun] = await Promise.all([
    db.payslip.findMany({
      where: { period },
      include: { staff: true, _count: { select: { warnings: true } } },
      orderBy: { staff: { name: "asc" } },
    }),
    pendingReviewInPeriod(period),
    db.jobDuration.findUnique({ where: { job: "payroll" } }),
  ]);

  async function compute(formData: FormData) {
    "use server";
    await requireAdmin();
    const p = String(formData.get("period"));
    // จดเวลาที่ใช้จริงไว้บอกผู้ใช้รอบหน้า — พนักงานเยอะขึ้นตัวเลขก็ขยับตามเอง
    await timed("payroll", () => runPayroll(p));
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
  // State, not event: this is derived from the whole period, so it is true on every visit long
  // after any run. Worded and styled accordingly — a permanent amber "⚠️ N ใบไม่ถูกคำนวณทับ"
  // sitting above the box that does matter is what trains people to stop reading amber boxes.
  const closedCount = slips.filter((s) => s.status !== "draft").length;
  const namesWithWarnings = slips.filter((s) => s._count.warnings > 0).map((s) => s.staff.name);

  function thaiList(names: string[]) {
    if (names.length <= 1) return names[0] ?? "";
    return `${names.slice(0, -1).join(", ")} และ ${names[names.length - 1]}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">สลิปเงินเดือน</h1>

      <form action={compute} className="card flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          งวด
          <input name="period" defaultValue={period} className="input" pattern="\d{4}-\d{2}" />
        </label>
        <SubmitButton pendingLabel="กำลังคำนวณ…">คำนวณเงินเดือนงวดนี้</SubmitButton>
        <ActionProgress baselineMs={lastRun?.ms ?? null} />
        <Link href={`/payslips?period=${period}`} className="btn-ghost">
          ดูงวดนี้
        </Link>
      </form>

      {pending > 0 && (
        <p className="card-warn text-sm">
          ⚠️ ยังมี <b>{pending}</b> คาบค้าง
          <Link href="/sync/review" className="underline">
            คิวรอตรวจ
          </Link>{" "}
          — คำนวณตอนนี้จะ<b>จ่ายขาด</b> เคลียร์ให้หมดก่อน
        </p>
      )}

      {namesWithWarnings.length > 0 && (
        <p className="card-warn text-sm">
          ⚠️ {thaiList(namesWithWarnings)} มีคำเตือนในสลิปงวดนี้ — ดูคอลัมน์ &quot;คำเตือน&quot;
          ในตาราง
        </p>
      )}

      {/* Last on purpose: this is a neutral fact, and sitting between the two `card-warn` boxes it
          split the only two things on this screen that need attention. */}
      {closedCount > 0 && (
        <p className="card text-sm text-neutral-600">
          {closedCount} ใบปิดงวดแล้ว (อนุมัติ/จ่ายแล้ว) — กดคำนวณอีกกี่ครั้งก็ไม่ทับของเดิม
        </p>
      )}

      <table className="card w-full">
        <thead>
          <tr>
            {[
              "พนักงาน",
              "ฐาน",
              "ค่าสอน",
              "คลาส",
              "คอม",
              "OT",
              "รวมสุทธิ",
              "คำเตือน",
              "สถานะ",
              "",
            ].map((h) => (
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
              <td className="td">
                {s._count.warnings > 0 ? (
                  <Link
                    href={`/payslips/${s.id}`}
                    className="font-semibold text-amber-800 underline"
                    aria-label={`ดูคำเตือน ${s._count.warnings} ข้อของ ${s.staff.name}`}
                  >
                    {s._count.warnings}
                  </Link>
                ) : s.status === "draft" ? (
                  <span className="text-neutral-400">0</span>
                ) : (
                  // A slip that has left draft is never recomputed, so an empty warnings list can
                  // just as easily mean "computed before warnings were captured" as "clean".
                  // Err toward unknown, never toward none (CLAUDE.md §2 rule 4).
                  //
                  // 🔴 The qualifier is **always visible**, never a `title`. A tooltip is invisible
                  // on touch, unreachable by keyboard (this span is not focusable) and often
                  // dropped by a screen reader on an element that already has text — and at a
                  // glance `0` and `—` are two grey glyphs in one column that do not read as two
                  // different claims. Same inline pattern as the sync table's stale marker.
                  // Not amber like that marker, though: this is a neutral caveat about a closed
                  // slip, not something to act on, and the neutral closed-count banner above says
                  // the same thing. `text-neutral-600` on the qualifier, not the `400` of the dash
                  // beside it — the whole point is that it can be read at this size.
                  <span className="text-neutral-400">
                    —
                    <span className="ml-1 text-xs font-medium text-neutral-600">
                      (ไม่ได้คำนวณใหม่)
                    </span>
                  </span>
                )}
              </td>
              <td className="td text-xs">{s.status}</td>
              <td className="td">
                <form action={setStatus} className="flex gap-1">
                  <input type="hidden" name="id" value={s.id} />
                  {s.status === "draft" && (
                    <SubmitButton name="status" value="approved" pendingLabel="กำลังอนุมัติ…">
                      อนุมัติ
                    </SubmitButton>
                  )}
                  {s.status === "approved" && (
                    <SubmitButton name="status" value="paid" pendingLabel="กำลังบันทึก…">
                      จ่ายแล้ว
                    </SubmitButton>
                  )}
                  {s.status !== "draft" && (
                    <SubmitButton
                      name="status"
                      value="draft"
                      className="btn-ghost"
                      pendingLabel="กำลังย้อน…"
                    >
                      กลับเป็นร่าง
                    </SubmitButton>
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
              <td className="td" colSpan={3} />
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
