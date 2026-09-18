import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/payroll-run";
import { parseOtPaste, otUsernameKey, type OtImportRow, type OtImportState } from "@/lib/ot-import";
import { num, type Config } from "@/lib/config-keys";
import { money } from "@/lib/payroll";
import { isNextControlFlowError } from "@/lib/next-errors";
import { SubmitButton } from "@/app/_components/submit-button";
import { PasteForm } from "./_components/paste-form";
import { timed } from "@/lib/job-timing";

export const dynamic = "force-dynamic";

/**
 * Which row the write loop stopped on, in Thai — **without claiming why it stopped**.
 *
 * ⚠️ `toISOString()` throws `RangeError` on an `Invalid Date`, and an unparseable date is the most
 * likely reason the write failed at all ⇒ the formatter running inside the `catch` must not become
 * the next thing that throws. `row` is `undefined` only if the throw came from outside the loop.
 */
function describeFailedRow(
  row: OtImportRow | undefined,
  staff: { id: string; username: string }[],
) {
  if (!row) return "บันทึกข้อมูลไม่ผ่าน";
  const who = staff.find((s) => s.id === row.staffId)?.username ?? row.staffId;
  const when = Number.isNaN(row.date.getTime())
    ? "(วันที่อ่านไม่ออก)"
    : row.date.toISOString().slice(0, 10);
  return `หยุดที่บรรทัดของ ${who} วันที่ ${when}`;
}

export default async function OtPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; err?: string }>;
}) {
  await requireAdmin();
  // `err` is a **flag**, not the message: the Thai copy stays in this file (§2.5) and nothing the
  // URL carries is rendered, so a crafted link cannot put words on an admin's screen.
  const { period: periodParam, err } = await searchParams;
  const period = periodParam ?? new Date().toISOString().slice(0, 7);
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

  // 🔴 Read the rates with `num()`, the engine's own helper — never `?? 40` (CLAUDE.md §2 rule 3).
  // A fallback here makes the screen and the payslip disagree in the worst direction: `num()`
  // throws when `ot.ratePerHour` is missing, so the payroll run dies, while this page used to
  // invent 40 ฿/h and print a confident figure for a rate nobody configured.
  const otConfig: Config = Object.fromEntries(cfg.map((c) => [c.key, c.value]));
  const threshold = num(otConfig, "ot.thresholdHours");
  const rate = num(otConfig, "ot.ratePerHour");

  async function add(formData: FormData) {
    "use server";
    await requireAdmin();
    const staffId = String(formData.get("staffId"));
    const date = new Date(String(formData.get("date")) + "T00:00:00Z");

    // 🔴 `type="number" step="0.25" required` is a *client* hint; a server action is a plain HTTP
    // endpoint, so `hours` arrives as anything or not at all — and both ways it stays silent:
    //   • absent field ⇒ `Number(null)` is **0**, and `update: { hours }` overwrites a recorded
    //     12.5 h with a zero nobody is told about (CLAUDE.md §2 rule 4 — the undecidable becoming
    //     a zero is the exact failure this repo pays the most for);
    //   • a `File` part or `"1e999"` ⇒ `NaN`/`Infinity`, and `OtEntry.hours` is a `Float` ⇒
    //     `double precision`, which **accepts `NaN`** ⇒ §2.4's `Math.max(0, NaN − threshold)`
    //     carries it into `otPay`, `net`, the stored `Payslip.net` and the period total.
    // Same hazard `parseOtPaste` routes to `invalidHours`; this is that bucket for the one-row
    // form. Rejected **before** the write and reported — never a silent `return`.
    const raw = formData.get("hours");
    const hours = typeof raw === "string" ? Number(raw) : NaN;
    if (!Number.isFinite(hours)) redirect(`/ot?period=${encodeURIComponent(period)}&err=hours`);

    await db.otEntry.upsert({
      where: { staffId_date: { staffId, date } },
      update: { hours },
      create: { staffId, date, hours },
    });
    revalidatePath("/ot");
    // Back to the clean URL so a later successful save clears a sticky `err=hours` — without it
    // the rejection notice would outlive the row that caused it.
    redirect(`/ot?period=${encodeURIComponent(period)}`);
  }

  /**
   * วางข้อมูลจากไฟล์สแกนนิ้ว: บรรทัดละ "ชื่อผู้ใช้<TAB>YYYY-MM-DD<TAB>ชั่วโมง"
   *
   * 🔴 The `(prevState, formData)` signature is `useActionState`'s own, and this action is handed
   * to it **unwrapped**. A client closure around it (which is what held the try/catch before)
   * stops React from emitting the `$ACTION_ID` field, so a submit before hydration — or with JS
   * off — degrades to a plain GET that imports nothing and says nothing.
   *
   * ⇒ the action **returns** its failure instead of throwing, and the try/catch lives here.
   * `unmatched` and `invalidHours` are decided before the write loop, so they survive a mid-loop
   * failure and still reach the screen (CLAUDE.md §2 rule 4).
   */
  async function paste(_prev: OtImportState, formData: FormData): Promise<OtImportState> {
    "use server";
    await requireAdmin();
    const everyone = await db.staff.findMany();
    const byUsername = new Map(everyone.map((s) => [otUsernameKey(s.username), s.id]));
    const { rows, unmatched, invalidHours } = parseOtPaste(
      String(formData.get("bulk") ?? ""),
      byUsername,
    );

    // Count what actually landed, not `rows.length`: after a mid-loop failure the operator needs
    // to know how much of the paste is already in, so the retry is not a guess.
    let imported = 0;
    let error: string | null = null;
    try {
      // เขียนทีละบรรทัด — วางมาทั้งเดือนก็หลายร้อยรอบ จดเวลาไว้ให้ผู้ใช้รู้ว่าต้องรอแค่ไหน
      await timed("ot-import", async () => {
        for (const row of rows) {
          await db.otEntry.upsert({
            where: { staffId_date: { staffId: row.staffId, date: row.date } },
            update: { hours: row.hours },
            create: row,
          });
          imported++;
        }
      });
    } catch (e) {
      // `redirect()`/`notFound()` signal by throwing — swallowing one renders `NEXT_REDIRECT` as
      // literal text. None is thrown here today; this keeps that true if one is ever added.
      if (isNextControlFlowError(e)) throw e;
      // The raw cause stays server-side. A production build redacts uncaught server-action errors
      // anyway, so the old code could never show what its comment promised — and Prisma's message
      // is English, which is not UI copy for this product.
      console.error("[ot-import] write failed after", imported, "row(s)", e);
      // 🔴 Name the row, never the cause. The old copy asserted "วันที่หรือชั่วโมงไม่ถูกต้อง" for
      // *any* throw — a dropped connection, a statement timeout, a Prisma version error — and sent
      // the operator hunting a malformed date that is not there. The loop is ordered and
      // `imported` counts committed rows, so `rows[imported]` **is** the row that failed.
      error = `นำเข้าไม่สำเร็จ — ${describeFailedRow(rows[imported], everyone)} · บรรทัดก่อนหน้าบันทึกแล้ว ตรวจบรรทัดนั้นแล้ววางใหม่อีกครั้ง`;
    }
    revalidatePath("/ot");
    return { imported, unmatched, invalidHours, error };
  }

  async function del(formData: FormData) {
    "use server";
    await requireAdmin();
    await db.otEntry.delete({ where: { id: String(formData.get("id")) } });
    revalidatePath("/ot");
  }

  // 🔴 **Raw excess — never rounded here** (§2 rule 5: round once, at the end). Feeding a rounded
  // intermediate into the multiplication below is exactly "round mid-way and round again": a
  // fingerprint export writes 9:20 as 9.333333333333334, and `money(money(0.3333…) × 40)` = 13.20
  // where the engine pays `money(0.3333… × 40)` = 13.33. Over 20 such days that is 266.67 ฿ paid
  // against 264.00 ฿ shown — on the one screen whose job is checking the import against the
  // payslip, and invisible to a spot check because clean 2-dp hours agree either way.
  //
  // Each *output* rounds once, with the engine's own `money()` — that is what removed the
  // `0.6999999999999993` / `27.99999999999997` float noise this screen used to print.
  const otExcess = (h: number) => Math.max(0, h - threshold);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">OT — งวด {period}</h1>
      <p className="text-xs text-neutral-500">
        คิดรายวัน: (ชั่วโมงในวันนั้น − {threshold}) × {rate} บาท · เกิน {threshold} ชม.
        เท่านั้นถึงนับ
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

      {/* Same wording as the paste form's `invalidHours` box, one row instead of a list: the
          hours field was not a number, so nothing was written. */}
      {err === "hours" && (
        <p className="card-warn text-sm">
          คำเตือน — ชั่วโมงไม่ใช่ตัวเลข รายการนี้ยังไม่ถูกบันทึก ตรวจช่อง “ชั่วโมงทำงานวันนั้น”
          แล้วบันทึกอีกครั้ง
        </p>
      )}

      <PasteForm action={paste} importMs={importTime?.ms ?? null} />

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
              <td className="td">{money(otExcess(r.hours))}</td>
              <td className="td">{money(otExcess(r.hours) * rate)}</td>
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
