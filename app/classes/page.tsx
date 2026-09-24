import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/payroll-run";
import { num, type Config } from "@/lib/config-keys";
import { finiteNumber, isBlank, INT_COLUMN_MAX } from "@/lib/form-number";
import { calendarDate } from "@/lib/ot-import";
import { dateWindow, withinWindow, windowForRender } from "@/lib/date-window";
import { listClassImportProblems } from "@/lib/class-problems-run";
import { SubmitButton } from "@/app/_components/submit-button";
import { WindowFaultNotice } from "@/app/_components/window-fault-notice";
import { ImportProblems } from "./_components/import-problems";
import { SessionTable } from "./_components/session-table";

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

  const [rows, classes, trainers, cfg, problems] = await Promise.all([
    db.classSession.findMany({
      where: { date: { gte: from, lt: to } },
      include: { class: true, staff: true },
      orderBy: { date: "desc" },
    }),
    db.classPrice.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.staff.findMany({ where: { role: "trainer", active: true }, orderBy: { name: "asc" } }),
    db.payrollConfig.findMany({
      where: {
        key: {
          // ใบ 082's two window keys ride along in the query this page already makes.
          in: ["class.minAttendees", "class.halfRatio", "date.earliestYear", "date.futureDays"],
        },
      },
    }),
    // 🔴 Through `lib/class-problems-run.ts`, never `db.classImportProblem` from here — that model's
    // reads have one home (task 064), and this page is the caller it was written to expect.
    listClassImportProblems(),
  ]);

  // 🔴 Read these with `num()`, the engine's own helper — never `?? 3` / `?? 0.5`
  // (CLAUDE.md §2 rule 3). A fallback here makes the screen and the payslip disagree in the worst
  // direction: `num()` throws when the key is missing, so the payroll run dies, while this page
  // used to invent a threshold nobody configured and print a confident figure for it. Same fix as
  // `app/ot/page.tsx`.
  const classConfig: Config = Object.fromEntries(cfg.map((c) => [c.key, c.value]));
  const minAtt = num(classConfig, "class.minAttendees");
  const halfRatio = num(classConfig, "class.halfRatio");
  // 🔴 ใบ 082 (second review round) — **`windowForRender`, not `dateWindow`, on the render path.**
  // The throw is right on the action path and was a regression here: it took the page's
  // *correction* surface down with its write surface, so a duplicate row could no longer be seen
  // or deleted while a config key was wrong. `lib/date-window.ts` carries the measured cost. The
  // **action** below still builds its own window, from its own `new Date()`, and still throws.
  const win = windowForRender(classConfig, new Date());

  async function add(formData: FormData) {
    "use server";
    await requireAdmin();

    // 🔴 **The date is guarded first, ahead of both head counts and the pair** (ใบ 080). Same hole
    // and same predicate as `/ot` and `/sales`: `new Date(<client text> + "T00:00:00Z")` rolls an
    // out-of-range day into the next month rather than refusing it, so `POST date=2026-06-31`
    // stored `2026-07-01` and moved the คาบ into the next payroll period in silence (§2 rule 4).
    // `calendarDate` is the one home for it (`lib/ot-import.ts`), and `.trim()` is required rather
    // than tidy — `app/ot/page.tsx`'s `add` carries the full reason for both.
    //
    // **Why ahead of `booked`/`noShow`** — the ordering argument is written out once, in
    // `app/sales/page.tsx`'s `add`: one `?err=` slot, so order decides which problem is reported
    // first, and the date is the field that decides which month the row belongs to. What makes it
    // outrank a head count *here* is §1.4's credit: `classPay = max(0, classValue − classCredit)`
    // is deducted from the **month's total**, so a shifted คาบ can be destroyed **twice** — it is
    // subtracted from the month it left, *and* absorbed by the arriving month's own credit ⇒ what
    // was paid becomes 0, in both. A wrong head count moves one คาบ's own value; a wrong date can
    // delete it from both months.
    //
    // ⚠️ The worked baht figures are **not** restated here — they live once, in the ใบ 080 table
    // of `.docs/knowledge/domain/form-refusals.md` (read the card, then the code — §5), because
    // `classCredit` and the คาบ rate are `PayrollConfig`, not constants (§2 rule 3): a comment
    // repeating the arithmetic goes wrong silently the first time either key moves.
    const date = calendarDate(String(formData.get("date") ?? "").trim());
    if (date === null) redirect(`/classes?period=${encodeURIComponent(period)}&err=date`);

    // 🔴 ใบ 082 — the second date question, its own flag, still ahead of both head counts and the
    // pair. `calendarDate` asks whether the day exists, and `0226-06-05` **is** a day: it round-trips
    // exactly as typed (measured, with `0206`, `0026`, `0001-01-01`, `9999-12-31`), which is what a
    // date picker's three-digit year box produces from an ordinary slip. The คาบ then matches no
    // `periodRange` at all ⇒ §1.4's credit never sees it in either month, so what the comment above
    // calls "destroyed twice" becomes "destroyed outright".
    //
    // The order extends the argument above, it does not contradict it: the date still outranks the
    // head counts, and within the date `calendarDate` must answer first, because a cell that is not
    // a day can be neither inside nor outside a window.
    // `err=dateRange`, never `err=date` — "this day does not exist" and "this year is outside the
    // window" are two different mistakes and get two different sentences.
    if (!withinWindow(date, dateWindow(classConfig, new Date())))
      redirect(`/classes?period=${encodeURIComponent(period)}&err=dateRange`);

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

    // 🔴 Each field is sane on its own and the **pair** is still nonsense: `booked: 2,
    // noShow: 5` passed both guards above and stored, and `computePayslip` then read
    // `attended = −3` — a case §1.4 does not define. The engine no longer decides it quietly
    // (task 025), but a warning on a slip is a cost this door can avoid paying: refuse the pair
    // here, where the person who typed it is still looking at the numbers. Same surface as the two
    // field guards — a flag, not a message, and nothing is written.
    if (noShow > booked)
      redirect(`/classes?period=${encodeURIComponent(period)}&err=noShowOverBooked`);

    await db.classSession.create({
      data: {
        date,
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
    const id = String(formData.get("id"));

    // 🔴 **An imported คาบ is not deletable here, and hiding the button is not the guard** — this is
    // (card 065). `ClassSession.sourceKey` is how the next upload recognises a คาบ it has already
    // written, so a deleted key is a key the file has never been seen to carry ⇒ `diffGymmoPlan`
    // plans it as a `create` and the คาบ comes back, beside whatever was keyed by hand to replace
    // it: 4 Aug 18:00 Core Strength is **200 ฿** (§1.4's price table, `prisma/seed.ts`) ⇒ **200 +
    // 200 = 400 ฿ for one 200 ฿ คาบ**, every month the same file is re-uploaded. The
    // repair is at the source (§2 rule 6), which is what `SessionTable` says in place of the button.
    //
    // ⚠️ **Not a race.** A hand-keyed row can never acquire a `sourceKey` — `applyGymmoImport` only
    // ever does `createMany` or `update where: { sourceKey }`, so nothing writes `null → non-null` on
    // an existing row. The refusal is here because a **server action accepts any `id` posted to it**,
    // button or no button: the table's `<form>` is copy, this is the guard.
    //
    // 🔴 **Refused by default, never unconditionally** (`payroll-auditor`, round 4). The re-creation
    // argument holds only while the **file still carries that key** — `diffGymmoPlan` plans a
    // `create` for keys *in the file*, so a row whose time or class name was corrected in Gymmo is
    // orphaned rather than re-created, and this is the repo's only `classSession.delete`. Refusing it
    // outright left ธันยา's stale 18:00 คาบ with no repair anywhere: class value 8,050 → 8,250 ⇒
    // `classPay` **3,050 → 3,250 ฿, 200 ฿ overpaid every run, for ever**. The second, explicit post
    // from the table's disclosure is the decision §2 rule 4 asks for; the ordinary delete `<form>`
    // does not carry it, so one click can still never do this.
    const row = await db.classSession.findUnique({ where: { id }, select: { sourceKey: true } });
    if (!row) redirect(`/classes?period=${encodeURIComponent(period)}&err=gone`);
    if (row.sourceKey !== null && formData.get("confirm") !== "imported")
      redirect(`/classes?period=${encodeURIComponent(period)}&err=imported`);

    await db.classSession.delete({ where: { id } });
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

      {/* 🔴 ใบ 082 (second review round). Above the form it disables, because it is the reason
          the form is disabled — and above the table, which is the part of this screen that keeps
          working: a duplicate row can still be read and still be deleted while the two keys are
          wrong. `win.fault` is `lib/date-window.ts`'s own sentence; nothing here comes from the
          URL. */}
      {win.fault && <WindowFaultNotice reason={win.fault} />}

      <form action={add} className="card">
        {/* 🔴 ใบ 082 — **the form is disabled while the window is unusable, and the page is not.**
            A submit that is certain to be refused should say so before the typing, not after
            (§2 rule 4: a refusal has to be useful). `disabled` on a wrapping `<fieldset>` disables
            every control inside it in one place.
            🔴 **The grid lives on the `<fieldset>` itself, so that no `display: contents`
            behaviour is relied on.** An earlier round left the grid on the `<form>` and put
            `className="contents"` here — a class that applies on **every** render, not only in the
            fault state, so an engine that ignores it collapses these columns permanently, and
            nothing in this pipeline renders a browser that would catch that. `border-0 p-0 m-0`
            clears the fieldset's own chrome; `min-w-0` overrides its `min-inline-size:
            min-content`, which otherwise stops grid children shrinking. The server action
            re-checks anyway: this is the courtesy, never the guard. */}
        <fieldset
          disabled={!win.bounds}
          className="grid gap-2 border-0 p-0 m-0 min-w-0 md:grid-cols-5"
        >
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
        </fieldset>
      </form>

      {/* One flag per refusal — two fields plus the pair. Each says what was refused and that
          **nothing was saved**: a คาบ the admin believes is keyed in is the failure this screen
          can hide. */}
      {/* ใบ 080's box — `/ot`'s sentence and worked example with this screen's noun, for the same
          reason the guard itself is shared: one refusal, one wording. `2026-06-31` looks fine to
          whoever typed it, so naming only “อ่านไม่ออก” sends them after a typo that is not there
          while the คาบ was on its way into the next month's payslip. */}
      {err === "date" && (
        <p className="card-warn text-sm">
          ⚠️ วันที่อ่านไม่ออก หรือไม่มีอยู่จริง (เช่น 2026-06-31) — <b>คาบนี้ยังไม่ถูกบันทึก</b>{" "}
          ตรวจช่อง “วันที่” แล้วบันทึกอีกครั้ง
        </p>
      )}
      {/* ใบ 082's box — a different refusal from the one above, so a different sentence: there the
          date is unreadable, here it reads perfectly and names a year this gym cannot have
          operated in. Bounds printed from the window, never typed into the copy.

          🔑 **The remedy sentence belongs here, same as `/ot`** — printing the bounds tells the
          operator what was refused, not what to do about a backfill that is genuinely older than
          the window. This page is `requireAdmin()` end to end (line 22), and so is `/admin/config`,
          so everyone who can reach this box can reach the key. `/sales` deliberately has **no**
          such sentence: its gate is `requireRole("owner", "admin", "counter")`, and the counter
          staff it exists for cannot open `/admin/config` ⇒ pointing them there is a dead end. */}
      {/* ⚠️ `win.bounds &&` is not defensive noise: with no usable window there are no bounds to
          print, and the box above already says why in more detail. Reaching this pair needs the
          config to have broken between the refused submit and this render. */}
      {err === "dateRange" && win.bounds && (
        <p className="card-warn text-sm">
          ⚠️ ปีในวันที่อยู่นอกช่วงที่ระบบรับ (เช่น 0226-06-05 ที่เกิดจากพิมพ์ปีไม่ครบ) —{" "}
          <b>คาบนี้ยังไม่ถูกบันทึก</b> ช่วงที่รับคือ{" "}
          <b>
            {win.bounds.earliest} ถึง {win.bounds.latest}
          </b>{" "}
          ตรวจช่อง “วันที่” แล้วบันทึกอีกครั้ง · ถ้าต้องคีย์ย้อนหลังไกลกว่านี้ ให้แก้ค่า
          date.earliestYear ที่หน้าตั้งค่า
        </p>
      )}
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
      {err === "imported" && (
        <p className="card-warn text-sm">
          ⚠️ คาบนี้<b>นำเข้าจากไฟล์ Gymmo</b> จึงไม่ลบด้วยคลิกเดียว — <b>ไม่มีอะไรถูกลบ</b>{" "}
          ถ้าไฟล์ยังมีแถวนี้อยู่ การนำเข้ารอบหน้าจะ<b>สร้างคืน</b>แล้ว<b>จ่ายซ้ำ</b> ⇒ แก้{" "}
          <b>ยอดคน</b> ที่ Gymmo แล้วนำเข้าไฟล์ซ้ำแทน · <b>ห้ามแก้วันที่ เวลา หรือชื่อคลาสในไฟล์</b>{" "}
          — สามช่องนั้นคือกุญแจของคาบ แก้แล้วคาบเดิมจะค้างอยู่และได้คาบใหม่เพิ่มอีกหนึ่ง ·
          <b>ถ้าคาบนี้ค้างเพราะไฟล์ไม่มีแถวนี้แล้ว</b> ลบได้จากปุ่ม “ลบทั้งที่นำเข้ามา”
          ในตารางข้างล่าง
        </p>
      )}
      {err === "gone" && (
        <p className="card-warn text-sm">
          ⚠️ ไม่พบคาบนี้แล้ว (อาจถูกลบไปก่อนหน้าจากอีกแท็บ) — <b>ไม่มีอะไรถูกลบเพิ่ม</b>{" "}
          โหลดหน้านี้ใหม่เพื่อดูของจริง
        </p>
      )}
      {err === "noShowOverBooked" && (
        <p className="card-warn text-sm">
          ⚠️ จำนวน no-show มากกว่าคนจอง ⇒ คนเข้าจริงติดลบ ซึ่งไม่อยู่ในกติกาคิดเงินคลาส —{" "}
          <b>คาบนี้ยังไม่ถูกบันทึก</b> ตรวจช่อง “คนจอง” กับ “no-show” ให้ตรงกัน แล้วบันทึกอีกครั้ง
        </p>
      )}

      <ImportProblems rows={problems} />

      <SessionTable
        rows={rows.map((r) => ({
          id: r.id,
          date: r.date,
          className: r.class.name,
          staffName: r.staff.name,
          booked: r.booked,
          noShow: r.noShow,
          sourceKey: r.sourceKey,
        }))}
        del={del}
      />
    </div>
  );
}
