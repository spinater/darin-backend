import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth";
import { closedOf, closedSlipsFor, type ClosedSlips } from "@/lib/closed-slips";
import {
  handIgnoredWhere,
  isColorMeaning,
  payableWithColorWhere,
  type ColorMeaning,
} from "@/lib/color-rules";
import { type Config } from "@/lib/config-keys";
import { dateWindow, withinWindow, windowForRender } from "@/lib/date-window";
import { db } from "@/lib/db";
import { calendarDate } from "@/lib/ot-import";
import { NEEDS_ATTENTION, periodRange } from "@/lib/payroll-run";
import { revalidateColorGaps } from "@/lib/revalidate";
import { WindowFaultNotice } from "@/app/_components/window-fault-notice";
import { BadHexNotice, ColorNotice, NoRuleNotice } from "./_components/color-notice";
import { RefusalNotice } from "./_components/refusal-notice";
import { ReviewTable } from "./_components/review-table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * The review queue, and the two listings task 070 hung off it.
 *
 * | `?` | rows | what the owner may do |
 * |---|---|---|
 * | *(none)* | `NEEDS_ATTENTION` — คาบ the engine refused to decide | ยืนยัน (date + trainer) · ข้าม · bulk ข้าม |
 * | `hex=` | payable คาบ carrying one colour, **every period** | ข้าม only — bulk only under a `skip` rule |
 * | `ignored=1` | คาบ a person took off pay by hand | เอากลับเข้าคิว |
 *
 * 🔴 **A hand-reviewed payable คาบ matches neither arm of `NEEDS_ATTENTION`** (`status: "ok"` *with*
 * a trainer), and `syncSources()` skips `reviewed: true` rows before the colour lookup ⇒ before the
 * `hex` listing existed, such a คาบ was repairable from nowhere in the product, and the only way to
 * clear the red entry it caused was to re-rule its colour to "จ่ายปกติ" — declaring a cancelled
 * colour payable for ever. On ว่ายน้ำ, hand-cleared by construction, that was 12 × 250 = 3,000 ฿ a
 * month with no honest exit.
 *
 * 🔴 **The `hex` listing exists only for a colour ruled `skip` or `review`.** With no rule, or a
 * `pay` rule, there is nothing this screen may tell the owner to do: what a sheet colour means is
 * their open question (REQUIREMENTS §1.6) and `colorGaps` reports an unruled colour precisely
 * because nobody has answered. Fifty checkboxes under an unanswered colour is the default-to-`skip`
 * `lib/color-rules.ts` refuses, reached through a URL instead of through the engine.
 *
 * 🔴 **`ignored=1` is the way back, and it is the reason the ข้าม button is allowed to exist.** ใบ
 * 070 gave this product its first action that takes money *off* a slip; a recomputed slip carries
 * no trace of it, so the rows stay listed, the count reaches `runBlockers`, and one click returns a
 * คาบ to the queue.
 *
 * ⚠️ ข้าม moves rows **in the direction the colour rule already says**, at a human's explicit click
 * — a different act from letting a *sync* overwrite a human, which is what `reviewed: true` exists
 * to prevent and what ใบ 066/069 are waiting on an answer for.
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    sheet?: string;
    hex?: string;
    ignored?: string;
    period?: string;
    err?: string;
  }>;
}) {
  await requireAdmin();
  const { page = "1", sheet, hex, ignored, period, err } = await searchParams;
  // Case is not part of a colour — `lib/color-rules.ts` folds both sides and `addColor` stores
  // lowercase. The link is built from an already-lowercased `ColorGap.hex`; a hand-typed URL is
  // normalised here so it cannot miss its own rule.
  const rawHex = hex?.trim().toLowerCase() || undefined;
  const colorScope = rawHex ? payableWithColorWhere(rawHex) : null;
  const ignoredMode = !!ignored;

  if (rawHex && !colorScope)
    return <Shell title="สีนี้เล็งไม่ได้" body={<BadHexNotice hex={rawHex} />} />;

  // The rule is loaded **before** the listing is drawn: it decides whether there is a listing at
  // all, and which buttons it may carry (`_components/color-notice.tsx`).
  const rule = rawHex ? await db.colorRule.findUnique({ where: { hex: rawHex } }) : null;
  const meaning: ColorMeaning | undefined =
    rule && isColorMeaning(rule.meaning) ? rule.meaning : undefined;
  if (rawHex && meaning !== "skip" && meaning !== "review")
    return (
      <Shell
        title="คาบของสีนี้ที่ยังจ่ายอยู่"
        body={<NoRuleNotice hex={rawHex} meaning={meaning} />}
      />
    );

  const color = colorScope ? rawHex : undefined;
  const skip = (Number(page) - 1) * PAGE_SIZE;

  const where: Prisma.TeachSessionWhereInput = ignoredMode
    ? ignoredWhere(period)
    : (colorScope ?? { ...NEEDS_ATTENTION, ...(sheet ? { source: { sheetName: sheet } } : {}) });

  // ใบ 082: the two window keys, read through `num()` inside `dateWindow` so a key nobody seeded
  // throws rather than this page inventing a bound (§2 rule 3).
  const [rows, total, trainers, sources, cfg] = await Promise.all([
    db.teachSession.findMany({
      where,
      include: { source: { select: { sheetName: true } } },
      orderBy: [{ sourceId: "asc" }, { rowIndex: "asc" }, { colIndex: "asc" }],
      skip,
      take: PAGE_SIZE,
    }),
    db.teachSession.count({ where }),
    db.staff.findMany({ where: { role: "trainer", active: true }, orderBy: { name: "asc" } }),
    db.sheetSource.findMany({ orderBy: { sheetName: "asc" } }),
    db.payrollConfig.findMany({
      where: { key: { in: ["date.earliestYear", "date.futureDays"] } },
    }),
  ]);

  const dateConfig: Config = Object.fromEntries(cfg.map((c) => [c.key, c.value]));
  // ใบ 082 second round: `windowForRender` never throws on the render path — a broken window must
  // not take this queue down (why, measured: `.docs/knowledge/domain/date-window.md`). `resolve`
  // still builds its own window from its own `new Date()`, and still throws.
  const win = windowForRender(dateConfig, new Date());

  // Only the two listings whose rows are already inside a computed slip need the lock.
  const closed: ClosedSlips =
    color || ignoredMode ? await closedSlipsFor(rows) : new Map<string, string>();

  const queueMode = !color && !ignoredMode;
  const backHref = hrefFor({ color, ignoredMode, period, sheet });

  const qs = (p: number) => `${backHref}${backHref.includes("?") ? "&" : "?"}page=${p}`;

  // 🔴 Where a write sends the reviewer back to, and the page number is part of it. `hrefFor()`
  // carries no `page` — only `qs()` does — so posting a bare `backHref` would land every ยืนยัน /
  // ข้าม / เอากลับเข้าคิว on page 1, and with `PAGE_SIZE = 50` a first-sync queue is then a
  // re-navigation per row. It binds the three refusal redirects too, which drop the page for the
  // same reason. Page 1 keeps the clean href so the common URL stays the short one.
  const backToHere = Number(page) > 1 ? qs(Number(page)) : backHref;

  async function resolve(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id"));
    const action = String(formData.get("action"));
    // 🔴 `back` is **client-supplied** and ใบ 080 widened where it goes: it used to reach
    // `redirect()` only on the `err=closed` refusal, and now it carries every successful write
    // too. So it is pinned to this screen — anything not starting with `/sync/review` falls back
    // to the href the page computed for itself. `startsWith` rather than a pattern: the allowed
    // set is one prefix, and a regex here would be a second place to get it wrong.
    const postedBack = String(formData.get("back") ?? "");
    const back = postedBack.startsWith("/sync/review") ? postedBack : backToHere;

    const row = await db.teachSession.findUnique({
      where: { id },
      select: { staffId: true, date: true, status: true },
    });
    if (!row) return;

    // 🔴 Re-checked here, not only in the markup: a server action is its own entry point, and a
    // form posted from a tab opened before the slip was approved reaches it with the page never
    // having run again. The refusal is **loud** — a silent `return` would leave the owner believing
    // the คาบ was removed (`.docs/knowledge/domain/form-refusals.md`).
    if (action === "ignore" || action === "unignore") {
      const closedNow = await closedSlipsFor([row]);
      if (closedOf(closedNow, row)) redirect(withErr(back, "closed"));
    }

    if (action === "ignore") {
      await db.teachSession.update({
        where: { id },
        data: { status: "ignored", reviewed: true, reviewNote: "คนตรวจสั่งข้าม" },
      });
    } else if (action === "unignore") {
      // Back into the ordinary queue, **not** straight to `ok`: `reviewed: false` is what lets the
      // next sync re-apply the colour rule, and `needs_review` is what puts a human in front of the
      // date and the trainer again before it is payable.
      await db.teachSession.update({
        where: { id },
        data: { status: "needs_review", reviewed: false, reviewNote: "คนตรวจเอากลับเข้าคิว" },
      });
    } else {
      // 🔴 **The date is checked first, and on this screen it is the riskiest field in the app**
      // (ใบ 080). The ordering argument is written out once in `app/sales/page.tsx`'s `add` — one
      // `?err=` slot, and the date decides which month the row belongs to. What is particular here
      // is *who types it*: this is the one screen where a human **retypes a date by hand precisely
      // because the sheet's was unreadable**, so a typo is not a freak event, it is the expected
      // failure of the intended use. And the write is `reviewed: true`, which is what stops a later
      // sync from ever repairing the row ⇒ a June ว่ายน้ำ คาบ retyped `2026-06-31` is stamped
      // 1 July at 250 ฿, leaves June's payslip query, and the queue goes clean over it — permanent,
      // with `warnings: []`.
      //
      // The two refusals are separate flags on purpose. **Blank** is the ordinary case (neither
      // control carries `required`, and a `needs_review` row is usually missing both), so it must
      // not be told "วันที่อ่านไม่ออก" — it needs the copy that says which fields are still empty.
      // The `.trim()` and `calendarDate` halves are `/ot`'s unchanged (`lib/ot-import.ts`).
      const dateStr = String(formData.get("date") ?? "").trim();
      if (!dateStr) redirect(withErr(back, "need")); // ต้องครบทั้งคู่ถึงจะจ่ายได้
      const date = calendarDate(dateStr);
      if (date === null) redirect(withErr(back, "date"));

      // 🔴 ใบ 082, and **this screen is that card's headline**. `calendarDate` asks whether the day
      // exists, and the 5th of June of the year 226 does — `0226-06-05` round-trips exactly as
      // typed, which is what a date picker's three-digit year box produces from the same shaky hand
      // the guard above was written about. Confirming it wrote `status: "ok", reviewed: true` ⇒ the
      // คาบ left the queue, matched no `periodRange`, and no later sync could repair it: 250 ฿ paid
      // as 0 ฿, permanently, queue clean. Third in the order for the reason the two above are in
      // theirs — blank, then "is this a day at all", then "is that year one this gym could have
      // operated in" — and on its own flag, because "อ่านไม่ออก" names the wrong cause for a date
      // that reads perfectly. The window itself is `lib/date-window.ts`'s.
      if (!withinWindow(date, dateWindow(dateConfig, new Date())))
        redirect(withErr(back, "dateRange"));

      // 🔴 Was a bare `return` until ใบ 080 — a **silent** refusal on a money path, in a file whose
      // own comment 20 lines above insists the refusal must be loud. Nothing was ever lost by it
      // (the row stays in the queue), but the reviewer was told nothing, so the click that did
      // nothing looks exactly like the click that confirmed the คาบ.
      const staffId = String(formData.get("staffId") ?? "");
      if (!staffId) redirect(withErr(back, "need"));

      // ⚠️ Only the queue listing offers this, and its rows are `needs_review` or trainer-less ⇒
      // inside no computed slip. Asserted rather than assumed, because moving the date of a คาบ
      // that *is* inside one pays it twice — once on the closed slip, once on the open one.
      //
      // 🔴 **Loud since ใบ 080, and the reason is that this state is reachable without a crafted
      // post.** `resolve` itself is what takes a row out of `NEEDS_ATTENTION` (`status: "ok"` with
      // a trainer), so a second tab — or a second admin — opened before that write still renders
      // the row with its ยืนยัน button. That is the same concurrency the `closed` re-check above
      // exists for, and for the `resolve` case it gets the same answer: the assertion holds, the
      // write is still refused, and the reviewer is now **told** instead of watching their
      // correction disappear. A silent no-op here says "saved" in the only language a form has.
      //
      // ⚠️ **But this predicate is not `NEEDS_ATTENTION`, and one cell of the difference leaks:
      // `{status: "ignored", staffId: null}` is refused by neither half** — `status` is not
      // `needs_review`, yet `staffId !== null` is false, so the `&&` lets the write through on a
      // row that is no longer in the queue. `ignore` (above) writes `status: "ignored"` and never
      // sets `staffId`, so a **trainer-less** queue row that a human has just ข้าม lands exactly
      // there: tab A takes the คาบ off pay, tab B rendered earlier still shows ยืนยัน, and B's
      // click puts it back on pay at 250 ฿ **permanently**, because `reviewed: true` stops every
      // later sync from touching it. Mirroring `NEEDS_ATTENTION` properly is its own card — and
      // the obvious "simplification" of dropping `&& row.staffId !== null` is **wrong**, because
      // it would refuse the legitimate `{status: "ok", staffId: null}` arm the queue is made of.
      if (row.status !== "needs_review" && row.staffId !== null) redirect(withErr(back, "stale"));

      await db.teachSession.update({
        where: { id },
        data: {
          date,
          staffId,
          status: "ok",
          reviewed: true,
          reviewNote: "คนตรวจยืนยันแล้ว",
        },
      });
    }
    revalidateColorGaps("/sync/review");
    // 🔴 Back to the **clean** listing, the fourth point of the shared error surface
    // (`.docs/knowledge/domain/form-refusals.md`) — added at ใบ 080 with the three flags above,
    // and it binds every action on a page that writes, not only the refusing one. This action had
    // no redirect at all: it re-rendered whatever URL the browser was on, so a `?err=` left by an
    // earlier refusal stood over the next **successful** ยืนยัน. That is the worst possible moment
    // for it — the operator has just fixed the date and resubmitted, and the screen still says the
    // คาบ was not saved, which invites them to type it a second time. `err=closed` (ใบ 070) had
    // the same hazard from the same cause; it goes with them.
    redirect(back);
  }

  async function bulkIgnore(formData: FormData) {
    "use server";
    await requireAdmin();
    const hexParam = String(formData.get("hex") ?? "");
    // 🔴 **The bulk write is constrained by the listing's own filter, never by the posted ids
    // alone.** An `updateMany` that trusts `bulk` will ignore any row whose id reaches it, from a
    // stale tab or a crafted post — a bulk money action with no predicate behind it.
    const scope = hexParam ? payableWithColorWhere(hexParam) : NEEDS_ATTENTION;
    if (!scope) return;
    const ids = formData.getAll("bulk").map(String);
    if (!ids.length) return;

    const candidates = await db.teachSession.findMany({
      where: { AND: [scope, { id: { in: ids } }] },
      select: { id: true, staffId: true, date: true },
    });
    const blocked = hexParam ? await closedSlipsFor(candidates) : new Map<string, string>();
    const allowed = candidates.filter((r) => !closedOf(blocked, r)).map((r) => r.id);
    if (allowed.length)
      await db.teachSession.updateMany({
        where: { id: { in: allowed } },
        data: { status: "ignored", reviewed: true, reviewNote: "คนตรวจสั่งข้าม (หลายรายการ)" },
      });
    revalidateColorGaps("/sync/review");
    if (candidates.length !== allowed.length)
      redirect(withErr(`/sync/review?hex=${encodeURIComponent(hexParam)}`, "closed"));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">
          {color ? "คาบของสีนี้ที่ยังจ่ายอยู่" : ignoredMode ? "คาบที่คนสั่งข้ามไว้" : "คิวรอตรวจ"}
        </h1>
        {color && (
          <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs">
            {/* The inline `background` is the datum, not a design decision — the owner matches it
                against their own sheet. `isReportableHex` is what keeps this value a colour and
                nothing else, including nothing that is a CSS declaration of its own. */}
            <span className="size-3 rounded-sm border" style={{ background: color }} />
            {color}
          </span>
        )}
        <span className="text-sm text-neutral-500">{total} รายการ</span>
      </div>

      {/* The five (six since ใบ 082) refusal notices live in `_components/refusal-notice.tsx` —
          §4: this page was 449 lines of a 500 ceiling and the notices are the block with the
          cleanest boundary. `err` is still only ever compared, never rendered. */}
      <RefusalNotice err={err} bounds={win.bounds} />
      {/* `surface="review"` — this screen has no delete, so the "ลบรายการซ้ำได้เลย" sentence the
          other three print would name a button that is not here, and the nearest one that *is*
          (ข้าม) writes `status: "ignored"` = this คาบ is not paid. See the component. */}
      {win.fault && <WindowFaultNotice reason={win.fault} surface="review" />}

      {color ? (
        <div className="flex flex-col gap-1 text-xs text-neutral-500">
          <p>
            คาบที่<b>จ่ายอยู่จริง</b>และมีสีพื้นนี้ในชีต — <b>ทุกงวด</b> ไม่ใช่เฉพาะงวดที่กดมา ·{" "}
            <a href="/sync/review" className="underline">
              กลับคิวรอตรวจ
            </a>
          </p>
          <ColorNotice meaning={meaning} />
        </div>
      ) : ignoredMode ? (
        <p className="text-xs text-neutral-500">
          คาบที่<b>คนกดข้ามเอง</b>
          {period ? (
            <>
              {" "}
              ในงวด <b>{period}</b>
            </>
          ) : null}{" "}
          — ไม่ได้เข้าเงินเดือน · นี่คือ<b>ทางกลับ</b>ของปุ่มข้าม: กด <b>เอากลับเข้าคิว</b>{" "}
          แล้วคาบจะไปรอตรวจใหม่ และ sync ครั้งหน้าจะจัดมันตามกฎสีอีกครั้ง ·{" "}
          <a href="/sync/review" className="underline">
            กลับคิวรอตรวจ
          </a>
        </p>
      ) : (
        <p className="text-xs text-neutral-500">
          คาบที่ระบบไม่กล้าตัดสินเอง — ต้องระบุ <b>วันที่ + ผู้สอน</b> ให้ครบถึงจะนับเข้าเงินเดือน
          หรือกดข้ามถ้าไม่ใช่คาบสอน
        </p>
      )}

      {queueMode && (
        <div className="flex flex-wrap gap-1 text-sm">
          <a href="/sync/review" className={sheet ? "btn-ghost" : "btn"}>
            ทุกชีต
          </a>
          {sources.map((s) => (
            <a
              key={s.id}
              href={`/sync/review?sheet=${encodeURIComponent(s.sheetName)}`}
              className={sheet === s.sheetName ? "btn" : "btn-ghost"}
            >
              {s.sheetName}
            </a>
          ))}
        </div>
      )}

      {/* ใบ 082: with no usable window every ยืนยัน would be refused, so `editable` drops the date
          box and the trainer select to read-only — while ข้าม and the bulk skip, which write no
          date, keep their buttons.
          🔑 Gated on `win.bounds`, the same discriminant the other three screens' `<fieldset>`
          uses. `!win.fault` is provably equivalent through the `RenderWindow` union, but two
          spellings of one condition make a reader prove that before trusting either. */}
      <ReviewTable
        rows={rows}
        trainers={trainers}
        closed={closed}
        editable={queueMode && !!win.bounds}
        showBulk={queueMode || meaning === "skip"}
        ignoredMode={ignoredMode}
        showColourNote={!!color}
        hex={color}
        action={bulkIgnore}
        emptyLabel={
          color
            ? "ไม่มีคาบสีนี้ที่ยังจ่ายอยู่แล้ว"
            : ignoredMode
              ? "ไม่มีคาบที่คนสั่งข้ามไว้"
              : "ไม่มีคาบรอตรวจ"
        }
      />

      {rows.map((r) => (
        <form key={r.id} id={`f-${r.id}`} action={resolve} className="hidden">
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="back" value={backToHere} />
        </form>
      ))}

      <div className="flex gap-2">
        {Number(page) > 1 && (
          <a href={qs(Number(page) - 1)} className="btn-ghost">
            ก่อนหน้า
          </a>
        )}
        {skip + PAGE_SIZE < total && (
          <a href={qs(Number(page) + 1)} className="btn-ghost">
            ถัดไป ({skip + PAGE_SIZE}/{total})
          </a>
        )}
      </div>
    </div>
  );
}

/** The `?ignored=1` listing — optionally one period, which is how the two dashboards link here. */
function ignoredWhere(period: string | undefined): Prisma.TeachSessionWhereInput {
  if (!period) return { status: "ignored", reviewed: true, staffId: { not: null } };
  const { from, to } = periodRange(period);
  return handIgnoredWhere(from, to);
}

function hrefFor({
  color,
  ignoredMode,
  period,
  sheet,
}: {
  color?: string;
  ignoredMode: boolean;
  period?: string;
  sheet?: string;
}): string {
  if (color) return `/sync/review?hex=${encodeURIComponent(color)}`;
  if (ignoredMode)
    return `/sync/review?ignored=1${period ? `&period=${encodeURIComponent(period)}` : ""}`;
  // `sheet` was interpolated raw before task 070 — sheet names here are Thai with spaces.
  return sheet ? `/sync/review?sheet=${encodeURIComponent(sheet)}` : "/sync/review";
}

const withErr = (href: string, err: string) => `${href}${href.includes("?") ? "&" : "?"}err=${err}`;

function Shell({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      {body}
    </div>
  );
}
