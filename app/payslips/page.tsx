import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { runPayroll } from "@/lib/payroll-run";
import { runBlockers } from "@/lib/run-blockers";
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
  searchParams: Promise<{ period?: string; err?: string }>;
}) {
  await requireAdmin();
  const { period: periodParam, err } = await searchParams;
  const period = periodParam ?? thisPeriod();

  // 🔴 Both blocker counts come from **one** function and **one** `period` — see `lib/run-blockers.ts`.
  // A period-scoped number rendered beside an all-time one, or this screen counting differently from
  // the dashboard, is how the two come to disagree about whether the month is clean.
  const [slips, blockers, lastRun] = await Promise.all([
    db.payslip.findMany({
      where: { period },
      include: { staff: true, _count: { select: { warnings: true } } },
      orderBy: { staff: { name: "asc" } },
    }),
    runBlockers(period),
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
    // 🔴 Conditional on the status this row was **rendered** for — the other half of the lock
    // `runPayroll` holds (task 013 item 1). An unconditional `update` writes onto whatever the row
    // holds *now*, so the reverse interleaving — a recompute commits first, this approval lands
    // second — closes the slip at a figure the approver never saw. That is the direction nobody
    // checks: the numbers on screen looked right when they were read, and the row ends up approved
    // at different ones with nothing said.
    const { count } = await db.payslip.updateMany({
      where: { id: String(formData.get("id")), status: String(formData.get("was")) },
      data: { status: String(formData.get("status")) },
    });
    revalidatePath("/payslips");
    // `err` is a **flag**, never the message — same precedent as `/ot`: the Thai copy lives in this
    // file (§2.5) and nothing from the URL is rendered. On success, redirect to the clean URL so a
    // stale notice cannot outlive the thing that caused it.
    if (count === 0) redirect(`/payslips?period=${encodeURIComponent(period)}&err=stale`);
    redirect(`/payslips?period=${encodeURIComponent(period)}`);
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

      {blockers.sheetReview > 0 && (
        <p className="card-warn text-sm">
          ⚠️ ยังมี <b>{blockers.sheetReview}</b> คาบค้าง
          <Link href="/sync/review" className="underline">
            คิวรอตรวจ
          </Link>{" "}
          — คำนวณตอนนี้จะ<b>จ่ายขาด</b> เคลียร์ให้หมดก่อน
        </p>
      )}

      {/* Two boxes, never one total: the repair is a different action on a different screen. A row
          in the queue above exists and is flagged; a row in the queue below **does not exist in the
          database at all**, so no slip and no `PayslipWarning` can mention it — which is why it has
          to be said here (task 064 · §2 rule 4). */}
      {blockers.classImport > 0 && (
        <p className="card-warn text-sm">
          ⚠️ มี <b>{blockers.classImport}</b> คาบจากไฟล์ Gymmo ที่<b>ยังไม่ได้เข้าฐานข้อมูล</b> —
          คำนวณตอนนี้สลิปจะขาดค่าสอนคลาสของคาบพวกนี้ <b>โดยไม่มีคำเตือนในสลิป</b> ดูเหตุผลรายแถวที่{" "}
          <Link href="/classes" className="underline">
            คาบสอนคลาส
          </Link>{" "}
          {/* 🔴 The old copy ended "แถวที่เข้าได้จะหายเอง" — a promise only `kind: "session"` rows
              keep. A row the reader could not parse is keyed by `[ชีต, #, วันเวลา]` while the same คาบ,
              once fixed, is written under a 4-tuple `sourceKey`, so no import can ever match it and
              the row survives its own repair (ใบ 066). Telling an admin it will disappear sends them
              to do what they already did, and the count they stop trusting is the one that is also
              carrying ประพัฒน์'s 8,000 ฿. */}
          แต่ละแถวบอกวิธีแก้ไว้ในเหตุผลของตัวเอง — <b>บางแถวหายเองเมื่อนำเข้าไฟล์ซ้ำ</b>{" "}
          (แก้ราคาคลาส หรือผูกชื่อเทรนเนอร์ก่อน) · แถวที่สลิปงวดนั้นปิดแล้ว ต้อง
          <b>เปิดสลิปกลับเป็นร่าง คำนวณใหม่ แล้วนำเข้าไฟล์ซ้ำ</b> · ส่วนแถวที่ตัวอ่านอ่านไม่ออก
          <b>ไม่หายเองแม้แก้ไฟล์แล้ว</b>
        </p>
      )}

      {/* The one event box on this screen, and it earns the exception: it reports something that
          happened to *this* admin's click one moment ago and is gone on the next clean load —
          unlike the state boxes below, which are true on every visit. */}
      {err === "stale" && (
        <p className="card-warn text-sm">
          ⚠️ สลิปใบนี้เปลี่ยนสถานะไปแล้วก่อนที่จะกดยืนยัน — <b>ยังไม่ได้บันทึกอะไร</b>{" "}
          ตรวจยอดและสถานะล่าสุดในตารางอีกครั้งก่อนทำซ้ำ
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
                  {/* The status this row was rendered for. The action writes only if the row still
                      holds it, so a slip that changed under the admin is refused, not overwritten. */}
                  <input type="hidden" name="was" value={s.status} />
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
