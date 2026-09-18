import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/payroll-run";
import { num, type Config } from "@/lib/config-keys";
import { finiteNumber, isBlank, INT_COLUMN_MAX } from "@/lib/form-number";
import { SubmitButton } from "@/app/_components/submit-button";

export const dynamic = "force-dynamic";

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; err?: string }>;
}) {
  await requireAdmin();
  // `err` is a **flag**, never the message — same precedent as `/ot` and `/payslips`: the Thai copy
  // lives in this file (§2.5) and nothing the URL carries is rendered.
  const { period: periodParam, err } = await searchParams;
  const period = periodParam ?? new Date().toISOString().slice(0, 7);
  const { from, to } = periodRange(period);

  const [rows, classes, trainers, cfg] = await Promise.all([
    db.classSession.findMany({
      where: { date: { gte: from, lt: to } },
      include: { class: true, staff: true },
      orderBy: { date: "desc" },
    }),
    db.classPrice.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.staff.findMany({ where: { role: "trainer", active: true }, orderBy: { name: "asc" } }),
    db.payrollConfig.findMany({
      where: { key: { in: ["class.minAttendees", "class.halfRatio"] } },
    }),
  ]);

  // 🔴 Read these with `num()`, the engine's own helper — never `?? 3` / `?? 0.5`
  // (CLAUDE.md §2 rule 3). A fallback here makes the screen and the payslip disagree in the worst
  // direction: `num()` throws when the key is missing, so the payroll run dies, while this page
  // used to invent a threshold nobody configured and print a confident figure for it. Same fix as
  // `app/ot/page.tsx`.
  const classConfig: Config = Object.fromEntries(cfg.map((c) => [c.key, c.value]));
  const minAtt = num(classConfig, "class.minAttendees");
  const halfRatio = num(classConfig, "class.halfRatio");

  async function add(formData: FormData) {
    "use server";
    await requireAdmin();

    // 🔴 These two head counts decide the full/half/no-pay branch of the whole class (the line
    // under the heading spells the branch out), so `Number()` is not good enough here either:
    // an absent `booked` was silently `0` = a class that pays nothing, and a `File` part was `NaN`
    // reaching `ClassSession.booked` (CLAUDE.md §2 rule 4). `finiteNumber` is the shared predicate
    // — see `lib/form-number.ts` for the full list of what it refuses and why.
    //
    // `int`/`max` because both are `Int` columns: a head count of `2.5` is **truncated to 2** by
    // Prisma, not refused, and an overflow throws at the write instead of here.
    const HEAD_COUNT = { int: true, max: INT_COLUMN_MAX };
    const booked = finiteNumber(formData.get("booked"), HEAD_COUNT);
    if (booked === null) redirect(`/classes?period=${encodeURIComponent(period)}&err=booked`);

    // no-show keeps today's meaning for a field left alone: absent or blank is **0**, which is what
    // `?? 0` and the input's `defaultValue={0}` already say, and is not a guess — nobody types a
    // zero. A value that *was* given and is not a non-negative number is refused instead of being
    // rounded down to "none", which would quietly promote a half-pay class to full pay.
    const noShowRaw = formData.get("noShow");
    const noShow = isBlank(noShowRaw) ? 0 : finiteNumber(noShowRaw, HEAD_COUNT);
    if (noShow === null) redirect(`/classes?period=${encodeURIComponent(period)}&err=noShow`);

    await db.classSession.create({
      data: {
        date: new Date(String(formData.get("date")) + "T00:00:00Z"),
        classId: String(formData.get("classId")),
        staffId: String(formData.get("staffId")),
        booked,
        noShow,
      },
    });
    revalidatePath("/classes");
    // Back to the clean URL so a later successful save clears a sticky `err=` — without it the
    // rejection notice would outlive the row that caused it.
    redirect(`/classes?period=${encodeURIComponent(period)}`);
  }

  async function del(formData: FormData) {
    "use server";
    await requireAdmin();
    await db.classSession.delete({ where: { id: String(formData.get("id")) } });
    revalidatePath("/classes");
    // Clean URL like `add`: deleting a row while `?err=booked` is in the address bar would leave
    // "คาบนี้ยังไม่ถูกบันทึก" standing over a delete that did happen.
    redirect(`/classes?period=${encodeURIComponent(period)}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">คาบสอนคลาส Group</h1>
      <p className="text-xs text-neutral-500">
        ตารางสอนใน Sheet เป็น 1-on-1 ทั้งหมด — คาบคลาสต้องคีย์ที่นี่ · คนเข้าจริง 0 = 0 บาท · 1–
        {minAtt - 1} คน = ×{halfRatio} · ≥{minAtt} คน = เต็มราคา
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

      {/* One flag per refused field. Each says what was refused and that **nothing was saved** —
          a คาบ the admin believes is keyed in is the failure this screen can hide. */}
      {err === "booked" && (
        <p className="card-warn text-sm">
          ⚠️ จำนวนคนจองไม่ใช่จำนวนเต็มตั้งแต่ 0 ขึ้นไป — <b>คาบนี้ยังไม่ถูกบันทึก</b> ตรวจช่อง
          “คนจอง” แล้วบันทึกอีกครั้ง
        </p>
      )}
      {err === "noShow" && (
        <p className="card-warn text-sm">
          ⚠️ จำนวน no-show ไม่ใช่จำนวนเต็มตั้งแต่ 0 ขึ้นไป — <b>คาบนี้ยังไม่ถูกบันทึก</b> ตรวจช่อง
          “no-show” หรือเว้นว่างไว้ถ้าไม่มีใครขาด แล้วบันทึกอีกครั้ง
        </p>
      )}

      <table className="card w-full">
        <thead>
          <tr>
            {["วันที่", "คลาส", "ผู้สอน", "จอง", "no-show", "เข้าจริง", ""].map((h) => (
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
