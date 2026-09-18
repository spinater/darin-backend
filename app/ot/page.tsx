import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/payroll-run";
import { parseOtPaste, otUsernameKey, type OtImportRow, type OtImportState } from "@/lib/ot-import";
import { num, type Config } from "@/lib/config-keys";
import { isNextControlFlowError } from "@/lib/next-errors";
import { finiteNumber } from "@/lib/form-number";
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

    // 🔴 `type="number" step="0.25" min={0} required` is a *client* hint; a server action is a
    // plain HTTP endpoint, so `hours` arrives as anything or not at all, and every wrong shape is
    // silent. `finiteNumber` is the one home for that predicate (`lib/form-number.ts` — it carries
    // the full list of what `Number()` answers quietly) and is used by the four other actions that
    // write a figure which becomes money.
    // Same hazard `parseOtPaste` routes to `invalidHours`; this is that bucket for the one-row
    // form. Rejected **before** the write and reported — never a silent `return`.
    //
    // Task 013 widened it by one case the inline `Number.isFinite` check let through: a *negative
    // finite* value. `-5` stored, rendered, and then computed to nothing through
    // `Math.max(0, -5 − threshold)`. `finiteNumber`'s default floor of 0 is the whole fix.
    const hours = finiteNumber(formData.get("hours"));
    if (hours === null) redirect(`/ot?period=${encodeURIComponent(period)}&err=hours`);

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
      // Two halves, each only stated when it is true:
      //   · saved/not-saved — the "previous rows are already saved" copy is a lie at
      //     `imported === 0`, where it tells the operator to go check a save that never happened;
      //   · "ตรวจบรรทัดนั้น" ("check that line") — only meaningful when `describeFailedRow`
      //     actually named a line. With `rows[imported]` undefined it degrades to the generic
      //     `บันทึกข้อมูลไม่ผ่าน`, and the instruction then points at a line nobody identified.
      const failedRow = rows[imported];
      const saved = imported > 0 ? "บรรทัดก่อนหน้าบันทึกแล้ว" : "ยังไม่มีบรรทัดไหนถูกบันทึก";
      const tail = failedRow
        ? `${saved} ตรวจบรรทัดนั้นแล้ววางใหม่อีกครั้ง`
        : `${saved} วางใหม่อีกครั้ง`;
      error = `นำเข้าไม่สำเร็จ — ${describeFailedRow(failedRow, everyone)} · ${tail}`;
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

  // This screen shows hours only — no formula here turns them into baht. `computePayslip` in
  // `lib/payroll.ts` is the single place that says what an hour is worth (§2 rule 2); `/ot` is a
  // check against the fingerprint import, not a preview of the payslip. `otExcess` therefore stays
  // a raw float and is never passed through `money()`: `money()` is the engine's baht rounding
  // (§2 rule 5) and there is no baht here to round (task 011).
  const otExcess = (h: number) => Math.max(0, h - threshold);

  /**
   * Hours, at most 2 dp — a **display** format, not a money one. A fingerprint export writes 9:20
   * as 9.333333333333334, and the raw float used to reach this table.
   * `money()` is deliberately not used: it is the engine's baht rounding (§2 rule 5) and this
   * column is hours. Nothing on this screen is money any more (task 011).
   */
  const hrs = (h: number) => String(Math.round(h * 100) / 100);

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
          hours field was not a usable number, so nothing was written. “หรือติดลบ” joined it at
          task 013 — a negative value is refused by the same guard now, and a notice that names
          only “ไม่ใช่ตัวเลข” sends the admin looking for a typo that is not there. */}
      {err === "hours" && (
        <p className="card-warn text-sm">
          คำเตือน — ชั่วโมงไม่ใช่ตัวเลข หรือติดลบ รายการนี้ยังไม่ถูกบันทึก ตรวจช่อง
          “ชั่วโมงทำงานวันนั้น” แล้วบันทึกอีกครั้ง
        </p>
      )}

      <PasteForm action={paste} importMs={importTime?.ms ?? null} />

      <table className="card w-full">
        <thead>
          <tr>
            {["พนักงาน", "วันที่", "ชั่วโมง", "ชม. OT", ""].map((h) => (
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
              <td className="td">{hrs(r.hours)}</td>
              <td className="td">{hrs(otExcess(r.hours))}</td>
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
