import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/payroll-run";
import { parseOtPaste, otUsernameKey, calendarDate, type OtImportState } from "@/lib/ot-import";
import { num, type Config } from "@/lib/config-keys";
import { isNextControlFlowError } from "@/lib/next-errors";
import { finiteNumber } from "@/lib/form-number";
import { SubmitButton } from "@/app/_components/submit-button";
import { PasteForm } from "./_components/paste-form";
import { timed } from "@/lib/job-timing";

export const dynamic = "force-dynamic";

export default async function OtPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; err?: string }>;
}) {
  await requireAdmin();
  // `err` is a **flag**, not the message: the Thai copy stays in this file (§2.5) and `err` itself
  // is only ever compared, never rendered, so a crafted link cannot put words on an admin's
  // screen through it. (`period` *is* rendered, in the `<h1>` below — this sentence is about
  // `err` alone.)
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
    // `staffId` is deliberately unguarded: an id nobody owns fails on `OtEntry`'s foreign key, i.e.
    // **loudly**, which is not the silent shape the two guards below exist for.
    const staffId = String(formData.get("staffId"));

    // 🔴 `type="date" required` is a *client* hint exactly as `type="number"` is below, and this
    // field was the half of the form that never acted on that (ใบ 072). `new Date()` does not
    // refuse an out-of-range day — it **rolls it into the next month**: `POST date=2026-06-31`
    // stored `2026-07-01`, which moved that day's OT into July's payroll period *and*, because the
    // upsert key is `(staffId, date)`, overwrote that person's real 1 July row. Money in the wrong
    // month and a true record destroyed, with nothing said (§2 rule 4).
    //
    // `calendarDate` is the one home for that predicate (`lib/ot-import.ts`, round-trip not
    // `isNaN`), shared with the paste path so the two refuse the same set — the same arrangement
    // `finiteNumber` already gives `hours`.
    //
    // `.trim()` is required, not tidiness: `calendarDate` compares the ISO day back against the
    // text it is given, so an untrimmed `" 2026-07-01"` would be refused while `parseOtPaste`
    // (which trims every cell) accepts it — the divergence this card exists to remove.
    // An absent field never reaches `String()` — `?? ""` turns it into the empty string, which is
    // refused as unparseable — and a file part stringifies to `"[object File]"`, refused as the
    // non-date it is. Neither needs a separate arm.
    //
    // **Checked before the hours** — one `err` slot fits in the URL, so when both fields are wrong
    // the operator sees one, fixes it, resubmits and sees the other. Date first matches
    // `parseOtPaste`'s order and its reason: a submission wrong in two ways is usually one
    // structural problem, and the date is the half that decides which month the row belongs to.
    const date = calendarDate(String(formData.get("date") ?? "").trim());
    if (date === null) redirect(`/ot?period=${encodeURIComponent(period)}&err=date`);

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
    // Back to the clean URL so a later successful save clears a sticky `err=hours`/`err=date` —
    // without it the rejection notice would outlive the row that caused it.
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
   * The three rejection buckets are decided before the write, so they survive a failed write and
   * still reach the screen (CLAUDE.md §2 rule 4).
   *
   * 🔴 **The write is all-or-nothing since task 014** — one `$transaction`, so `imported` is either
   * `rows.length` or `0` and there is no half-imported paste to describe or to retry around. The
   * per-row data problems that used to cause a mid-loop throw are all rejected by `parseOtPaste`
   * now, which is what makes the transaction an improvement rather than a regression: what is left
   * is infrastructure (connection, timeout) and one race — two admins pasting overlapping days at
   * once, where a `P2002` on `@@unique([staffId, date])` is possible. Neither moves money.
   */
  async function paste(_prev: OtImportState, formData: FormData): Promise<OtImportState> {
    "use server";
    await requireAdmin();
    const everyone = await db.staff.findMany();
    const byUsername = new Map(everyone.map((s) => [otUsernameKey(s.username), s.id]));
    const { rows, unmatched, invalidHours, invalidDates } = parseOtPaste(
      String(formData.get("bulk") ?? ""),
      byUsername,
    );

    let imported = 0;
    let error: string | null = null;
    try {
      if (rows.length > 0) {
        // วางมาทั้งเดือนก็หลายร้อยบรรทัด จดเวลาไว้ให้ผู้ใช้รู้ว่าต้องรอแค่ไหน
        //
        // 🔴 Two statements, not one round trip per row. The array form of `$transaction` is one
        // DB transaction with no interactive-transaction timeout to tune, which is what removes
        // the 5 s risk a 220-line paste over a remote DB used to carry (task 014).
        //
        // 🔴 **`OR` is a list of explicit `(staffId, date)` pairs and must stay one.**
        // `{ staffId: { in: … }, date: { in: … } }` is the cross product: it would delete a
        // person's OT for a day this paste never mentioned. This is a money-data delete.
        //
        // Delete + recreate loses nothing: `OtEntry` has no `createdAt`, and the only reader of
        // its `id` is the `del` form on this page, re-rendered on every load.
        //
        // `timed()` wraps the transaction from outside on purpose — it writes `JobDuration` in a
        // `finally` and must not be enrolled in the rollback.
        //
        // The `rows.length > 0` guard is not a micro-optimisation: `deleteMany` with an empty `OR`
        // has no obvious meaning and must not be relied on.
        await timed("ot-import", () =>
          db.$transaction([
            db.otEntry.deleteMany({
              where: { OR: rows.map((r) => ({ staffId: r.staffId, date: r.date })) },
            }),
            db.otEntry.createMany({ data: rows }),
          ]),
        );
      }
      imported = rows.length;
    } catch (e) {
      // `redirect()`/`notFound()` signal by throwing — swallowing one renders `NEXT_REDIRECT` as
      // literal text. None is thrown here today; this keeps that true if one is ever added.
      if (isNextControlFlowError(e)) throw e;
      // The raw cause stays server-side. A production build redacts uncaught server-action errors
      // anyway, and Prisma's message is English, which is not UI copy for this product.
      console.error("[ot-import] write failed, rolled back", rows.length, "row(s)", e);
      // 🔴 Name neither a row nor a cause — there is now nothing true to say about either. The
      // transaction rolled back, so no row is "the one that failed" and no earlier row is saved;
      // and the throw is either infrastructure (connection, timeout) or a `P2002` on
      // `@@unique([staffId, date])` when two admins paste overlapping days in the same second and
      // run A's delete commits between run B's delete and its insert. Retrying is the operator's
      // move in both cases, and no money moved in either — so the Thai copy stays true as written.
      error =
        "นำเข้าไม่สำเร็จ — ไม่มีบรรทัดไหนถูกบันทึก ทั้งหมดถูกยกเลิกพร้อมกัน ลองวางใหม่อีกครั้ง";
    }
    revalidatePath("/ot");
    return { imported, unmatched, invalidHours, invalidDates, error };
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

      {/* ใบ 072's box, worded from the paste form's `invalidDates` heading so the two surfaces say
          the same thing about the same refusal — one predicate, one sentence.
          🔴 It has to name **both** halves and keep the worked example. `2026-06-31` looks
          perfectly fine to the person who typed it, so a notice reading only “อ่านไม่ออก” sends
          them hunting a typo that is not there — while what the guard actually stopped was that
          day's OT being counted in the next month, on top of an existing 1 July row. */}
      {err === "date" && (
        <p className="card-warn text-sm">
          คำเตือน — วันที่อ่านไม่ออก หรือไม่มีอยู่จริง (เช่น 2026-06-31) รายการนี้ยังไม่ถูกบันทึก
          ตรวจช่อง “วันที่” แล้วบันทึกอีกครั้ง
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
