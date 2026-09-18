import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeTrainer } from "@/lib/normalize";
import { hashPassword, MIN_PASSWORD_LEN } from "@/lib/password";
import { finiteNumber, isBlank, INT_COLUMN_MAX } from "@/lib/form-number";
import { parseConfigNumbers, numericKind } from "@/lib/config-form";
import { SubmitButton } from "@/app/_components/submit-button";
import { ActionProgress } from "@/app/_components/action-progress";
import { AddStaffForm } from "./_components/add-staff-form";
import { SaveNotice } from "./_components/save-notice";
import { SheetMappingSections } from "./_components/sheet-mapping";
import { timed } from "@/lib/job-timing";

export const dynamic = "force-dynamic";

const RANKS = ["PT", "CT", "ST"];
const ROLES = ["trainer", "counter", "admin", "owner"];

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  await requireAdmin();
  // `err` is a **flag**, never the message — the copy lives in `_components/save-notice.tsx` and in
  // the add-staff form, and nothing the URL carries is rendered (§2.5, `/ot` precedent).
  const { err } = await searchParams;

  const [configs, rates, classes, staff, aliases, sources, colors, saveTime] = await Promise.all([
    db.payrollConfig.findMany({ orderBy: { key: "asc" } }),
    db.teachRate.findMany(),
    db.classPrice.findMany({ orderBy: { name: "asc" } }),
    db.staff.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.trainerAlias.findMany({ include: { staff: true }, orderBy: { alias: "asc" } }),
    db.sheetSource.findMany({ orderBy: { sheetName: "asc" } }),
    db.colorRule.findMany({ orderBy: { hex: "asc" } }),
    db.jobDuration.findUnique({ where: { job: "config-save" } }),
  ]);

  const activities = [...new Set([...rates.map((r) => r.activity), "yoga"])].sort();

  async function save(formData: FormData) {
    "use server";
    await requireAdmin();

    // 🔴 **Everything is parsed before anything is written** — `parseConfigNumbers` in
    // `lib/config-form.ts` carries the reasoning and the tests. `kind` is a closed set, so it is a
    // safe URL flag, and the refusal reaches the admin as words this file owns.
    const parsed = parseConfigNumbers(formData.entries());
    if (!parsed.ok) redirect(`/admin/config?err=${parsed.kind}`);
    // The parse refused every invalid numeric field, so a miss here is unreachable — this throw is
    // a type guard that keeps the write loop free of `!`, not error handling.
    const checked = (k: string) => {
      const n = parsed.values.get(k);
      if (n === undefined) throw new Error(`unvalidated numeric field: ${k}`);
      return n;
    };

    // ฟอร์มนี้บันทึกทีเดียวหลายสิบช่อง = อัปเดต DB เรียงกันหลายสิบครั้ง
    // จดเวลาไว้ ถ้าวันหลังพนักงาน/คลาสเยอะจนช้า ผู้ใช้จะได้เห็นเวลาโดยไม่ต้องแก้โค้ด
    //
    // 🔴 **One transaction around the loop**, so "ยังไม่ได้บันทึกอะไรเลยสักช่อง" stays true for a
    // failure *during* the writes and not only for a bad field found before them. Unlike
    // `runPayroll` — which must never wrap its whole period, because the work per staff member is
    // unbounded — this loop is bounded by the size of the form: ~65 round-trips for today's 18
    // config keys, 9 rates, 13 class prices, 7 staff and 4 sheets, which at 1–3 ms each sits well
    // inside the **5 s Prisma applies by default** — no `timeout` is passed here, so that number is
    // the default and not something this code states. Overrunning it is a **rollback** plus an
    // error page (P2028), i.e. the same "nothing was saved" the notice promises, minus the notice —
    // which is why the transaction is what makes a slow save safe. `timed` stays **outside** it:
    // the duration row is bookkeeping and must not be part of what rolls back.
    await timed("config-save", () =>
      db.$transaction(async (tx) => {
        for (const [k, v] of formData.entries()) {
          const val = String(v).trim();
          const [kind, ...rest] = k.split("|");

          if (kind === "cfg")
            // Stored as the admin typed it — `PayrollConfig.value` is text, and `parseConfigNumbers`
            // has already refused anything `num()` could not read back. Writing `String(checked(k))`
            // instead would quietly renormalise "0.50" to "0.5".
            await tx.payrollConfig.update({ where: { key: rest[0] }, data: { value: val } });
          else if (kind === "rate") {
            const [activity, rank] = rest;
            if (!val) await tx.teachRate.deleteMany({ where: { activity, rank } });
            else
              await tx.teachRate.upsert({
                where: { activity_rank: { activity, rank } },
                update: { rate: checked(k) },
                create: { activity, rank, rate: checked(k) },
              });
          } else if (kind === "class")
            await tx.classPrice.update({ where: { id: rest[0] }, data: { price: checked(k) } });
          else if (kind === "staff") {
            const [id, field] = rest;
            // 🔑 Ask `numericKind` rather than assuming "not rank ⇒ numeric". A posted
            // `staff|<id>|active` — a field this form never renders — used to reach `checked()`,
            // which the parse had skipped, and **throw mid-loop**. Ignored now, and the dynamic
            // Prisma key can only ever be one of the two columns the form actually has.
            if (field === "rank")
              await tx.staff.update({ where: { id }, data: { rank: val || null } });
            else if (numericKind(k))
              await tx.staff.update({ where: { id }, data: { [field]: checked(k) } });
          } else if (kind === "sheet")
            await tx.sheetSource.update({ where: { id: rest[0] }, data: { spreadsheetId: val } });
        }
      }),
    );
    revalidatePath("/admin/config");
    // Back to the clean URL so a later successful save clears a sticky `err=` — without it the
    // rejection notice would outlive the field that caused it.
    redirect("/admin/config");
  }

  /**
   * 🔴 **Every action on this page that writes ends on the clean URL.** They share one screen with
   * one `?err=` slot, so an action that only revalidates leaves whatever flag is in the address bar
   * standing over the thing it just saved: add an activity right after a refused บันทึกทั้งหมด and
   * `SaveNotice` still says "ยังไม่ได้บันทึกอะไรเลยสักช่อง" above a rate row that now exists. A
   * notice that outlives its cause is worse than no notice — it is read as the truth about the last
   * click.
   */
  async function addActivity(formData: FormData) {
    "use server";
    await requireAdmin();
    const activity = String(formData.get("activity") ?? "").trim();
    if (!activity) return;
    for (const rank of RANKS)
      await db.teachRate.upsert({
        where: { activity_rank: { activity, rank } },
        update: {},
        create: { activity, rank, rate: 0 },
      });
    revalidatePath("/admin/config");
    redirect("/admin/config");
  }

  /**
   * เพิ่มพนักงานใหม่ + ผูกชื่อที่ใช้ในชีตให้เลย
   * หลังเพิ่มแล้วกด Sync อีกครั้ง คาบเก่าที่ค้างเพราะ "ไม่รู้จักเทรนเนอร์" จะถูกจับคู่ให้อัตโนมัติ
   */
  async function addStaff(formData: FormData) {
    "use server";
    await requireAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "trainer");
    if (!name || !username || password.length < MIN_PASSWORD_LEN) return;

    // 🔴 These two become this person's `net` on **every future run**, so an unreadable one refuses
    // the whole add instead of creating a staff record around a `NaN` that nobody looks at again.
    // A field left blank keeps the documented default of 0 — the same answer `?? 0` gave before —
    // but a field that was filled in and cannot be read is a rejection, not a 0.
    // Same `Int`-column rules the bulk form applies to these two columns (`lib/config-form.ts`):
    // a fraction is **truncated** by Prisma rather than refused (`15000.5` → `15000`), and an
    // overflow throws at the write.
    const INT_COLUMN = { int: true, max: INT_COLUMN_MAX };
    const baseRaw = formData.get("baseSalary");
    const creditRaw = formData.get("classCredit");
    const baseSalary = isBlank(baseRaw) ? 0 : finiteNumber(baseRaw, INT_COLUMN);
    const classCredit = isBlank(creditRaw) ? 0 : finiteNumber(creditRaw, INT_COLUMN);
    if (baseSalary === null || classCredit === null) redirect("/admin/config?err=newstaff");

    const created = await db.staff.create({
      data: {
        name,
        username,
        passwordHash: await hashPassword(password),
        role,
        rank: role === "trainer" ? String(formData.get("rank") ?? "PT") : null,
        baseSalary,
        classCredit,
      },
    });

    // ชื่อที่พนักงานใช้จดในชีต (เว้นว่าง = ใช้ชื่อพนักงาน)
    const sheetNames = [String(formData.get("sheetName") ?? "").trim() || name];
    for (const raw of sheetNames) {
      const alias = normalizeTrainer(raw);
      if (alias)
        await db.trainerAlias.upsert({
          where: { alias },
          update: { staffId: created.id },
          create: { alias, staffId: created.id },
        });
    }
    revalidatePath("/admin/config");
    // 🔴 Not optional here. Refused → admin fixes the field → submits again → the `create`
    // **succeeds** while `?err=newstaff` is still in the address bar, so "ยังไม่ได้เพิ่มพนักงานคนนี้"
    // renders over a staff member who now exists ⇒ they add the person a second time. Two active
    // `Staff` rows for one human, the alias follows the newer one, and the orphan draws its
    // `baseSalary` in every run with no sessions to make it look wrong.
    redirect("/admin/config");
  }

  async function toggleActive(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id"));
    const target = await db.staff.findUniqueOrThrow({ where: { id } });
    await db.staff.update({ where: { id }, data: { active: !target.active } });
    // ลาออก/พักงาน → เตะออกจากระบบ แต่คาบสอนเก่ายังอยู่ครบ (สลิปย้อนหลังยังตรวจได้)
    if (target.active) await db.session.deleteMany({ where: { staffId: id } });
    revalidatePath("/admin/config");
    redirect("/admin/config");
  }

  async function addAlias(formData: FormData) {
    "use server";
    await requireAdmin();
    const alias = normalizeTrainer(String(formData.get("alias") ?? ""));
    const staffId = String(formData.get("staffId") ?? "");
    if (!alias || !staffId) return;
    await db.trainerAlias.upsert({
      where: { alias },
      update: { staffId },
      create: { alias, staffId },
    });
    revalidatePath("/admin/config");
    redirect("/admin/config");
  }

  async function addColor(formData: FormData) {
    "use server";
    await requireAdmin();
    const hex = String(formData.get("hex") ?? "")
      .trim()
      .toLowerCase();
    const meaning = String(formData.get("meaning") ?? "");
    if (!hex) return;
    await db.colorRule.upsert({
      where: { hex },
      update: { meaning, note: String(formData.get("note") ?? "") },
      create: { hex, meaning, note: String(formData.get("note") ?? "") },
    });
    revalidatePath("/admin/config");
    redirect("/admin/config");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">ตั้งค่า</h1>
      <p className="text-xs text-neutral-500">
        ทุกค่าในหน้านี้คือค่าที่ engine ใช้จริง — ไม่มีตัวเลขไหน hardcode ในโค้ด
      </p>

      {/* At the top, not beside the field: the refused field can be in any of four sections, the
          form fills the whole screen, and the page reloads at the top after the refusal. */}
      <SaveNotice err={err} />

      <form action={save} className="flex flex-col gap-6">
        <section className="card">
          <h2 className="mb-2 font-medium">ตารางเรทค่าสอน (กิจกรรม × ระดับ)</h2>
          <table className="w-full max-w-xl">
            <thead>
              <tr>
                <th className="th">กิจกรรม</th>
                {RANKS.map((r) => (
                  <th key={r} className="th">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a}>
                  <td className="td">{a}</td>
                  {RANKS.map((r) => (
                    <td key={r} className="td">
                      <input
                        name={`rate|${a}|${r}`}
                        type="number"
                        defaultValue={
                          rates.find((x) => x.activity === a && x.rank === r)?.rate ?? ""
                        }
                        placeholder="ยังไม่ตั้ง"
                        className="input w-24"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-amber-700">
            ช่องว่าง = ยังไม่มีเรท → คาบของกิจกรรมนั้นจะไม่ถูกคิดเงินและขึ้นเตือนในสลิป
          </p>
        </section>

        <section className="card">
          <h2 className="mb-2 font-medium">พนักงาน</h2>
          <table className="w-full max-w-3xl">
            <thead>
              <tr>
                {["ชื่อ", "บทบาท", "ระดับ", "ฐานเงินเดือน", "เครดิตสอนคลาส", ""].map((h) => (
                  <th key={h} className="th">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className={s.active ? "" : "opacity-40"}>
                  <td className="td">
                    {s.name}
                    <span className="ml-1 font-mono text-xs text-neutral-400">{s.username}</span>
                    {!s.active && <span className="ml-1 text-xs text-red-600">(ปิดใช้งาน)</span>}
                  </td>
                  <td className="td text-xs text-neutral-500">{s.role}</td>
                  <td className="td">
                    <select
                      name={`staff|${s.id}|rank`}
                      defaultValue={s.rank ?? ""}
                      className="input"
                    >
                      <option value="">—</option>
                      {RANKS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="td">
                    <input
                      name={`staff|${s.id}|baseSalary`}
                      type="number"
                      defaultValue={s.baseSalary}
                      className="input w-28"
                    />
                  </td>
                  <td className="td">
                    <input
                      name={`staff|${s.id}|classCredit`}
                      type="number"
                      defaultValue={s.classCredit}
                      className="input w-28"
                    />
                  </td>
                  <td className="td">
                    <SubmitButton
                      formAction={toggleActive}
                      name="id"
                      value={s.id}
                      className="btn-ghost text-xs"
                      pendingLabel="กำลังเปลี่ยน…"
                    >
                      {s.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </SubmitButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 className="mb-2 font-medium">ราคาคลาส Group</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {classes.map((c) => (
              <label key={c.id} className="flex items-center justify-between gap-2 text-sm">
                {c.name}
                <input
                  name={`class|${c.id}`}
                  type="number"
                  defaultValue={c.price}
                  className="input w-24"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="mb-2 font-medium">เกณฑ์ / เปอร์เซ็นต์ / OT</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {configs.map((c) => (
              <label key={c.key} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {c.note}
                  <span className="ml-1 font-mono text-xs text-neutral-400">{c.key}</span>
                </span>
                <input name={`cfg|${c.key}`} defaultValue={c.value} className="input w-28" />
              </label>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="mb-2 font-medium">Google Sheet</h2>
          {sources.map((s) => (
            <label key={s.id} className="flex items-center gap-2 py-1 text-sm">
              <span className="w-28">{s.sheetName}</span>
              <input
                name={`sheet|${s.id}`}
                defaultValue={s.spreadsheetId}
                className="input w-96 font-mono text-xs"
              />
            </label>
          ))}
        </section>

        {/* บันทึกทีเดียวหลายสิบช่อง = อัปเดต DB หลายสิบครั้ง กินเวลาพอให้ผู้ใช้สงสัยว่ากดติดไหม */}
        <div className="flex items-center gap-3">
          <SubmitButton className="btn" pendingLabel="กำลังบันทึกทั้งหมด…">
            บันทึกทั้งหมด
          </SubmitButton>
          <ActionProgress baselineMs={saveTime?.ms ?? null} />
        </div>
      </form>

      <section className="card">
        <h2 className="mb-2 font-medium">เพิ่มกิจกรรมใหม่</h2>
        <form action={addActivity} className="flex gap-2">
          <input name="activity" placeholder="เช่น boxing" className="input" />
          <SubmitButton className="btn-ghost" pendingLabel="กำลังเพิ่ม…">
            เพิ่ม
          </SubmitButton>
        </form>
      </section>

      <AddStaffForm action={addStaff} ranks={RANKS} roles={ROLES} rejected={err === "newstaff"} />

      <SheetMappingSections
        aliases={aliases}
        colors={colors}
        staff={staff}
        addAlias={addAlias}
        addColor={addColor}
      />
    </div>
  );
}
