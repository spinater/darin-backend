import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/payroll-run";
import { SubmitButton } from "@/app/_components/submit-button";

export const dynamic = "force-dynamic";

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const period = (await searchParams).period ?? new Date().toISOString().slice(0, 7);
  const { from, to } = periodRange(period);

  const [rows, classes, trainers, cfg] = await Promise.all([
    db.classSession.findMany({
      where: { date: { gte: from, lt: to } },
      include: { class: true, staff: true },
      orderBy: { date: "desc" },
    }),
    db.classPrice.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.staff.findMany({ where: { role: "trainer", active: true }, orderBy: { name: "asc" } }),
    db.payrollConfig.findMany({ where: { key: { in: ["class.minAttendees", "class.halfRatio"] } } }),
  ]);

  const minAtt = Number(cfg.find((c) => c.key === "class.minAttendees")?.value ?? 3);
  const halfRatio = Number(cfg.find((c) => c.key === "class.halfRatio")?.value ?? 0.5);

  async function add(formData: FormData) {
    "use server";
    await requireAdmin();
    await db.classSession.create({
      data: {
        date: new Date(String(formData.get("date")) + "T00:00:00Z"),
        classId: String(formData.get("classId")),
        staffId: String(formData.get("staffId")),
        booked: Number(formData.get("booked")),
        noShow: Number(formData.get("noShow") ?? 0),
      },
    });
    revalidatePath("/classes");
  }

  async function del(formData: FormData) {
    "use server";
    await requireAdmin();
    await db.classSession.delete({ where: { id: String(formData.get("id")) } });
    revalidatePath("/classes");
  }

  const value = (price: number, booked: number, noShow: number) => {
    const att = booked - noShow;
    return price * (att <= 0 ? 0 : att < minAtt ? halfRatio : 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">คาบสอนคลาส Group</h1>
      <p className="text-xs text-neutral-500">
        ตารางสอนใน Sheet เป็น 1-on-1 ทั้งหมด — คาบคลาสต้องคีย์ที่นี่ ·
        คนเข้าจริง 0 = 0 บาท · 1–{minAtt - 1} คน = ×{halfRatio} · ≥{minAtt} คน = เต็มราคา
      </p>

      <form action={add} className="card grid gap-2 md:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          วันที่
          <input name="date" type="date" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          คลาส
          <select name="classId" className="input" required>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.price})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ผู้สอน
          <select name="staffId" className="input" required>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          คนจอง
          <input name="booked" type="number" min={0} required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          no-show
          <input name="noShow" type="number" min={0} defaultValue={0} className="input" />
        </label>
        <SubmitButton
          className="btn md:col-span-5 md:justify-self-start"
          pendingLabel="กำลังบันทึก…"
        >
          บันทึก
        </SubmitButton>
      </form>

      <table className="card w-full">
        <thead>
          <tr>
            {["วันที่", "คลาส", "ผู้สอน", "จอง", "no-show", "เข้าจริง", "มูลค่า", ""].map((h) => (
              <th key={h} className="th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="td">{r.date.toISOString().slice(0, 10)}</td>
              <td className="td">{r.class.name}</td>
              <td className="td">{r.staff.name}</td>
              <td className="td">{r.booked}</td>
              <td className="td">{r.noShow}</td>
              <td className="td">{r.booked - r.noShow}</td>
              <td className="td">{value(r.class.price, r.booked, r.noShow)}</td>
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
