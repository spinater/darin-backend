import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/payroll-run";
import { SubmitButton } from "@/app/_components/submit-button";
import { ActionProgress } from "@/app/_components/action-progress";
import { timed } from "@/lib/job-timing";

export const dynamic = "force-dynamic";

export default async function OtPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const period = (await searchParams).period ?? new Date().toISOString().slice(0, 7);
  const { from, to } = periodRange(period);

  const [rows, staff, cfg, importTime] = await Promise.all([
    db.otEntry.findMany({
      where: { date: { gte: from, lt: to } },
      include: { staff: true },
      orderBy: [{ staffId: "asc" }, { date: "asc" }],
    }),
    db.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.payrollConfig.findMany({ where: { key: { in: ["ot.thresholdHours", "ot.ratePerHour"] } } }),
    db.jobDuration.findUnique({ where: { job: "ot-import" } }),
  ]);

  const threshold = Number(cfg.find((c) => c.key === "ot.thresholdHours")?.value ?? 9);
  const rate = Number(cfg.find((c) => c.key === "ot.ratePerHour")?.value ?? 40);

  async function add(formData: FormData) {
    "use server";
    await requireAdmin();
    const staffId = String(formData.get("staffId"));
    const date = new Date(String(formData.get("date")) + "T00:00:00Z");
    const hours = Number(formData.get("hours"));
    await db.otEntry.upsert({
      where: { staffId_date: { staffId, date } },
      update: { hours },
      create: { staffId, date, hours },
    });
    revalidatePath("/ot");
  }

  /** วางข้อมูลจากไฟล์สแกนนิ้ว: บรรทัดละ "ชื่อผู้ใช้<TAB>YYYY-MM-DD<TAB>ชั่วโมง" */
  async function paste(formData: FormData) {
    "use server";
    await requireAdmin();
    const byUsername = new Map(
      (await db.staff.findMany()).map((s) => [s.username.trim().toLowerCase(), s.id]),
    );
    const errors: string[] = [];
    // เขียนทีละบรรทัด — วางมาทั้งเดือนก็หลายร้อยรอบ จดเวลาไว้ให้ผู้ใช้รู้ว่าต้องรอแค่ไหน
    await timed("ot-import", async () => {
      for (const line of String(formData.get("bulk") ?? "").split("\n")) {
        const [user, date, hours] = line.split(/\t|,/).map((x) => x?.trim());
        if (!user || !date || !hours) continue;
        const staffId = byUsername.get(user.toLowerCase());
        if (!staffId) {
          errors.push(user);
          continue;
        }
        await db.otEntry.upsert({
          where: { staffId_date: { staffId, date: new Date(date + "T00:00:00Z") } },
          update: { hours: Number(hours) },
          create: { staffId, date: new Date(date + "T00:00:00Z"), hours: Number(hours) },
        });
      }
    });
    revalidatePath("/ot");
  }

  async function del(formData: FormData) {
    "use server";
    await requireAdmin();
    await db.otEntry.delete({ where: { id: String(formData.get("id")) } });
    revalidatePath("/ot");
  }

  const otHours = (h: number) => Math.max(0, h - threshold);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">OT — งวด {period}</h1>
      <p className="text-xs text-neutral-500">
        คิดรายวัน: (ชั่วโมงในวันนั้น − {threshold}) × {rate} บาท · เกิน {threshold} ชม. เท่านั้นถึงนับ
      </p>

      <form action={add} className="card grid gap-2 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          พนักงาน
          <select name="staffId" className="input" required>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          วันที่
          <input name="date" type="date" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ชั่วโมงทำงานวันนั้น
          <input name="hours" type="number" step="0.25" min={0} required className="input" />
        </label>
        <SubmitButton className="btn self-end" pendingLabel="กำลังบันทึก…">
          บันทึก
        </SubmitButton>
      </form>

      <form action={paste} className="card flex flex-col gap-2">
        <label className="text-xs text-neutral-500">
          หรือวางจากไฟล์สแกนนิ้ว — บรรทัดละ <code>ชื่อผู้ใช้ , วันที่(YYYY-MM-DD) , ชั่วโมง</code>
        </label>
        <textarea name="bulk" rows={4} className="input font-mono text-xs" />
        <div className="flex items-center gap-3 self-start">
          <SubmitButton className="btn-ghost" pendingLabel="กำลังนำเข้า…">
            นำเข้า
          </SubmitButton>
          <ActionProgress baselineMs={importTime?.ms ?? null} />
        </div>
      </form>

      <table className="card w-full">
        <thead>
          <tr>
            {["พนักงาน", "วันที่", "ชั่วโมง", "ชม. OT", "เป็นเงิน", ""].map((h) => (
              <th key={h} className="th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="td">{r.staff.name}</td>
              <td className="td">{r.date.toISOString().slice(0, 10)}</td>
              <td className="td">{r.hours}</td>
              <td className="td">{otHours(r.hours)}</td>
              <td className="td">{otHours(r.hours) * rate}</td>
              <td className="td">
                <form action={del}>
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton className="btn-ghost" pendingLabel="กำลังลบ…">
                    ลบ
                  </SubmitButton>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
