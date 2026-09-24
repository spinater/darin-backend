import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { finiteNumber, isBlank } from "@/lib/form-number";
import { calendarDate } from "@/lib/ot-import";
import { type Config } from "@/lib/config-keys";
import { dateWindow, withinWindow, windowForRender } from "@/lib/date-window";
import { SubmitButton } from "@/app/_components/submit-button";
import { WindowFaultNotice } from "@/app/_components/window-fault-notice";

export const dynamic = "force-dynamic";

const KINDS = [
  ["pt", "แพ็ค PT"],
  ["membership", "สมาชิก"],
  ["course_ext", "ต่ออายุคอร์ส (ไม่มีคอม)"],
  ["freeze", "Freeze (ไม่มีคอม)"],
] as const;

const ROLES = [
  ["closer", "ผู้ปิดการขาย"],
  ["referrer", "ผู้ส่งลีด"],
  ["content_owner", "เจ้าของคลิป"],
] as const;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; err?: string }>;
}) {
  await requireRole("owner", "admin", "counter");
  // `err` is a **flag**, never the message — same precedent as `/ot` and `/payslips`: the Thai copy
  // lives in this file (§2.5) and nothing the URL carries is rendered, so a crafted link cannot put
  // words on a counter staff member's screen.
  const { period: periodParam, err } = await searchParams;
  const period = periodParam ?? new Date().toISOString().slice(0, 7);

  // 🔴 This screen had no `PayrollConfig` read at all before ใบ 082 — it shows figures that were
  // typed, not computed. The two keys below are the **only** ones it wants, and they are still read
  // through `num()` inside `dateWindow` so a key nobody seeded throws here rather than the page
  // inventing a bound of its own (§2 rule 3).
  const [sales, staff, cfg] = await Promise.all([
    db.sale.findMany({
      where: {
        date: {
          gte: new Date(`${period}-01T00:00:00Z`),
          lt: new Date(
            new Date(`${period}-01T00:00:00Z`).setUTCMonth(
              new Date(`${period}-01T00:00:00Z`).getUTCMonth() + 1,
            ),
          ),
        },
      },
      include: { attributions: { include: { staff: true } } },
      orderBy: { date: "desc" },
    }),
    db.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.payrollConfig.findMany({
      where: { key: { in: ["date.earliestYear", "date.futureDays"] } },
    }),
  ]);

  const dateConfig: Config = Object.fromEntries(cfg.map((c) => [c.key, c.value]));
  // 🔴 ใบ 082 (second review round) — **`windowForRender`, not `dateWindow`, on the render path.**
  // The throw is right on the action path and was a regression here: it took the page's
  // *correction* surface down with its write surface, so a duplicate row could no longer be seen
  // or deleted while a config key was wrong. `lib/date-window.ts` carries the measured cost. The
  // **action** below still builds its own window, from its own `new Date()`, and still throws.
  const win = windowForRender(dateConfig, new Date());

  async function add(formData: FormData) {
    "use server";
    await requireRole("owner", "admin", "counter");

    // 🔴 **The date is guarded first, and on this screen it outranks the money fields** (ใบ 080).
    // `new Date(<client text> + "T00:00:00Z")` does not refuse an out-of-range day — it **rolls it
    // into the next month** — so `POST date=2026-06-31` stored `2026-07-01` and moved the bill into
    // the next payroll period with nothing said (§2 rule 4). `calendarDate` (`lib/ot-import.ts`) is
    // the one home for that predicate, shared with `/ot` and the fingerprint paste; `.trim()` is
    // load-bearing rather than tidiness, and `app/ot/page.tsx`'s `add` carries the full reason.
    //
    // **Why before `netPrice`/`listPrice`** — the ordering question every guarded form here has to
    // answer, stated once and pointed at from `/classes` and `/sync/review`:
    //
    // 1. one `?err=` slot fits in the URL, so the order decides which problem the counter staff are
    //    told about first — they fix that one, resubmit, and meet the next;
    // 2. the date decides **which month the row belongs to**, and on this screen that is not a
    //    per-row question. §1.6's incentive threshold is applied **retroactively across the whole
    //    month**, so one bill in the wrong month re-rates every *other* bill in it, with
    //    `warnings: []`.
    //
    // ⇒ a wrong price is one wrong bill; a wrong date is one wrong bill **and** every other bill of
    // that month re-rated. The costlier refusal is reported first.
    //
    // ⚠️ The worked baht figures are **not** restated here: they live once, in the ใบ 080 table of
    // `.docs/knowledge/domain/form-refusals.md` (read the card, then the code — §5). They are
    // arithmetic over `incentive.threshold` and the commission rates, which are `PayrollConfig`
    // and not constants (§2 rule 3) ⇒ a comment repeating them is wrong, silently, the first time
    // that key moves.
    const date = calendarDate(String(formData.get("date") ?? "").trim());
    if (date === null) redirect(`/sales?period=${encodeURIComponent(period)}&err=date`);

    // 🔴 ใบ 082 — the **second** date question, on its own flag, still ahead of both prices. The
    // guard above asks whether the day exists; `0226-06-05` is a real day written exactly as typed,
    // so it passed (measured, with `0206`, `0026`, `0001-01-01`, `9999-12-31`) and a browser date
    // picker's three-digit year box is how an ordinary hand produces it. The bill then falls outside
    // every `periodRange` ⇒ it is in **no** month's commission base at all, which is strictly worse
    // than the wrong month this file's guard above was written for.
    //
    // Ordered *after* `calendarDate` and *before* the prices, which extends the argument above
    // rather than replacing it: a cell that is not a day cannot be inside or outside a window, and
    // a date in an impossible year still outranks a wrong price for the reason already stated —
    // §1.6's threshold re-rates the whole month.
    // `err=dateRange`, never `err=date`: two different mistakes, two different sentences.
    if (!withinWindow(date, dateWindow(dateConfig, new Date())))
      redirect(`/sales?period=${encodeURIComponent(period)}&err=dateRange`);

    // 🔴 Both prices go through `finiteNumber` (`lib/form-number.ts`), never `Number()`: this form
    // is the only source of the commission base, so an absent field's silent `0` or a `File`
    // part's `NaN` reaches `Sale.netPrice` → every commission, the incentive threshold and the
    // period total on `/payslips` (CLAUDE.md §2 rule 4). Refused before the write, said on screen.
    const netPrice = finiteNumber(formData.get("netPrice"));
    if (netPrice === null) redirect(`/sales?period=${encodeURIComponent(period)}&err=netPrice`);

    // ราคาเต็ม is genuinely optional — "ไม่ใส่ราคาเต็ม = ถือว่าขายเต็มราคา" is printed under the
    // form — so absent-or-blank stays `null` and is not an error. Anything else that is not a
    // non-negative finite number is **refused**, never quietly demoted to "no list price": that
    // demotion turns a promo sale into a full-price one and changes the commission rate with it.
    const listRaw = formData.get("listPrice");
    const listPrice = isBlank(listRaw) ? null : finiteNumber(listRaw);
    if (listPrice === null && !isBlank(listRaw))
      redirect(`/sales?period=${encodeURIComponent(period)}&err=listPrice`);

    const attributions = ROLES.flatMap(([role]) => {
      const id = String(formData.get(role) ?? "");
      return id ? [{ staffId: id, role }] : [];
    });

    await db.sale.create({
      data: {
        date,
        kind: String(formData.get("kind")),
        tier: String(formData.get("tier") ?? "") || null,
        productName: String(formData.get("productName")),
        listPrice,
        netPrice,
        note: String(formData.get("note") ?? "") || null,
        attributions: { create: attributions },
      },
    });
    revalidatePath("/sales");
    // Back to the clean URL so a later successful save clears a sticky `err=` — without it the
    // rejection notice would outlive the bill that caused it.
    redirect(`/sales?period=${encodeURIComponent(period)}`);
  }

  async function del(formData: FormData) {
    "use server";
    await requireRole("owner", "admin");
    await db.sale.delete({ where: { id: String(formData.get("id")) } });
    revalidatePath("/sales");
    // Clean URL like `add`: deleting a bill while `?err=netPrice` is in the address bar would leave
    // "บิลนี้ยังไม่ถูกบันทึก" standing over a delete that did happen.
    redirect(`/sales?period=${encodeURIComponent(period)}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">ยอดขาย (ฐานคำนวณค่าคอม)</h1>
      <p className="text-xs text-neutral-500">
        ตารางสอนใน Google Sheet ไม่มีข้อมูลราคาเลย — ค่าคอมทั้งหมดคำนวณจากบิลที่คีย์ในหน้านี้
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
          className="grid gap-2 border-0 p-0 m-0 min-w-0 md:grid-cols-4"
        >
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            วันที่
            <input name="date" type="date" required className="input" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            ประเภท
            <select name="kind" className="input">
              {KINDS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            ระดับสมาชิก
            <select name="tier" className="input">
              <option value="">—</option>
              {["basic", "premium", "platinum", "pilates"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            ชื่อสินค้า
            <input name="productName" required className="input" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            ราคาเต็มใน catalog
            <input name="listPrice" type="number" step="0.01" className="input" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            ราคาจ่ายจริง (ฐานคิดคอม)
            <input name="netPrice" type="number" step="0.01" required className="input" />
          </label>
          {ROLES.map(([role, label]) => (
            <label key={role} className="flex flex-col gap-1 text-xs text-neutral-500">
              {label}
              <select name={role} className="input">
                <option value="">—</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs text-neutral-500 md:col-span-3">
            หมายเหตุ
            <input name="note" className="input" />
          </label>
          <SubmitButton className="btn self-end" pendingLabel="กำลังบันทึก…">
            บันทึกบิล
          </SubmitButton>
        </fieldset>
      </form>

      {/* One flag per refused field, so the notice can name the field without ever rendering
          anything the URL carried. Both say the same two things `/ot` says: what was refused, and
          that **nothing was saved** — a bill the counter believes is in is the failure mode here. */}
      {/* ใบ 080's box, worded from `/ot`'s (ใบ 072) — one refusal, one sentence, however many
          surfaces. 🔴 It has to name **both** halves and keep the worked example: `2026-06-31`
          looks perfectly fine to the person who typed it, so a notice reading only “อ่านไม่ออก”
          sends them hunting a typo that is not there, while what the guard actually stopped was
          this bill being counted in the next month — and with it June's whole incentive threshold.
          ⚠️ The noun is this screen's (“บิลนี้”), as in the two boxes below; the sentence, the
          example and the flag are `/ot`'s unchanged. A third dialect would be a box that reads as
          copied from another screen, sitting beside two that do not. */}
      {err === "date" && (
        <p className="card-warn text-sm">
          ⚠️ วันที่อ่านไม่ออก หรือไม่มีอยู่จริง (เช่น 2026-06-31) — <b>บิลนี้ยังไม่ถูกบันทึก</b>{" "}
          ตรวจช่อง “วันที่” แล้วบันทึกอีกครั้ง
        </p>
      )}
      {/* ใบ 082's box. Deliberately **not** the sentence above: that one says the date is
          unreadable, this one says the date reads fine and names a year the system does not accept.
          A bill refused here is refused for a reason the counter staff can act on in one keystroke,
          but only if the copy names it. The bounds are printed from the window, never typed in.

          🔴 **This is the one of the four boxes with no “แก้ค่า date.earliestYear ที่หน้าตั้งค่า”
          sentence, and that is the decision, not an omission.** `/ot`, `/classes` and
          `/sync/review` are `requireAdmin()` end to end and `/admin/config` has the same gate, so
          there the remedy is one screen away. This page is `requireRole("owner", "admin",
          "counter")` — it exists for the counter staff, and `counter` cannot open `/admin/config`
          at all ⇒ the sentence would name a remedy the reader is not allowed to reach, which reads
          as "you did something wrong and there is nothing you can do". What they *can* do is check
          the year, and that is what the copy says. */}
      {/* ⚠️ `win.bounds &&` is not defensive noise: with no usable window there are no bounds to
          print, and the box above already says why in more detail. Reaching this pair needs the
          config to have broken between the refused submit and this render. */}
      {err === "dateRange" && win.bounds && (
        <p className="card-warn text-sm">
          ⚠️ ปีในวันที่อยู่นอกช่วงที่ระบบรับ (เช่น 0226-06-05 ที่เกิดจากพิมพ์ปีไม่ครบ) —{" "}
          <b>บิลนี้ยังไม่ถูกบันทึก</b> ช่วงที่รับคือ{" "}
          <b>
            {win.bounds.earliest} ถึง {win.bounds.latest}
          </b>{" "}
          ตรวจช่อง “วันที่” แล้วบันทึกอีกครั้ง
        </p>
      )}
      {err === "netPrice" && (
        <p className="card-warn text-sm">
          ⚠️ ราคาจ่ายจริงไม่ใช่ตัวเลข หรือติดลบ — <b>บิลนี้ยังไม่ถูกบันทึก</b> ตรวจช่อง
          “ราคาจ่ายจริง (ฐานคิดคอม)” แล้วบันทึกอีกครั้ง
        </p>
      )}
      {err === "listPrice" && (
        <p className="card-warn text-sm">
          ⚠️ ราคาเต็มใน catalog ไม่ใช่ตัวเลข หรือติดลบ — <b>บิลนี้ยังไม่ถูกบันทึก</b> ตรวจช่อง
          “ราคาเต็มใน catalog” หรือเว้นว่างไว้ถ้าขายเต็มราคา แล้วบันทึกอีกครั้ง
        </p>
      )}

      <p className="text-xs text-neutral-500">
        จ่ายจริง &lt; ราคาเต็ม = ระบบถือว่าเป็นราคาโปรฯ (คอม 5%) · ไม่ใส่ราคาเต็ม =
        ถือว่าขายเต็มราคา
      </p>

      <table className="card w-full">
        <thead>
          <tr>
            {["วันที่", "ประเภท", "สินค้า", "ราคาเต็ม", "จ่ายจริง", "ผู้ได้คอม", ""].map((h) => (
              <th key={h} className="th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id}>
              <td className="td">{s.date.toISOString().slice(0, 10)}</td>
              <td className="td text-xs">
                {s.kind}
                {s.tier ? `/${s.tier}` : ""}
              </td>
              <td className="td">{s.productName}</td>
              <td className="td">{s.listPrice ?? "—"}</td>
              <td className="td">{s.netPrice.toLocaleString("th-TH")}</td>
              <td className="td text-xs">
                {s.attributions.map((a) => `${a.staff.name} (${a.role})`).join(", ") || "—"}
              </td>
              <td className="td">
                <form action={del}>
                  <input type="hidden" name="id" value={s.id} />
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
