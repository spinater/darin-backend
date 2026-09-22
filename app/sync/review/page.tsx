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
import { db } from "@/lib/db";
import { NEEDS_ATTENTION, periodRange } from "@/lib/payroll-run";
import { revalidateColorGaps } from "@/lib/revalidate";
import { BadHexNotice, ColorNotice, NoRuleNotice } from "./_components/color-notice";
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

  const [rows, total, trainers, sources] = await Promise.all([
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
  ]);

  // Only the two listings whose rows are already inside a computed slip need the lock.
  const closed: ClosedSlips =
    color || ignoredMode ? await closedSlipsFor(rows) : new Map<string, string>();

  const queueMode = !color && !ignoredMode;
  const backHref = hrefFor({ color, ignoredMode, period, sheet });

  const qs = (p: number) => `${backHref}${backHref.includes("?") ? "&" : "?"}page=${p}`;

  async function resolve(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id"));
    const action = String(formData.get("action"));
    const back = String(formData.get("back") || "/sync/review");

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
      const dateStr = String(formData.get("date") ?? "");
      const staffId = String(formData.get("staffId") ?? "");
      if (!dateStr || !staffId) return; // ต้องครบทั้งคู่ถึงจะจ่ายได้
      // ⚠️ Only the queue listing offers this, and its rows are `needs_review` or trainer-less ⇒
      // inside no computed slip. Asserted rather than assumed, because moving the date of a คาบ
      // that *is* inside one pays it twice — once on the closed slip, once on the open one.
      if (row.status !== "needs_review" && row.staffId !== null) return;
      await db.teachSession.update({
        where: { id },
        data: {
          date: new Date(dateStr + "T00:00:00Z"),
          staffId,
          status: "ok",
          reviewed: true,
          reviewNote: "คนตรวจยืนยันแล้ว",
        },
      });
    }
    revalidateColorGaps("/sync/review");
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

      {err === "closed" && (
        <div className="card-warn text-sm">
          <b>บางคาบแก้ไม่ได้ เพราะงวดของมันปิดไปแล้ว</b> — สลิปที่อนุมัติหรือจ่ายแล้วจะ
          <b>ไม่ถูกคำนวณใหม่</b> ⇒ กดข้ามไม่ได้เงินคืน แต่จะทำให้คำเตือนหายไปเฉย ๆ ซึ่งแย่กว่าเดิม ·
          ต้องแก้ที่งวดนั้นก่อน (ใบ 013)
        </div>
      )}

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

      <ReviewTable
        rows={rows}
        trainers={trainers}
        closed={closed}
        editable={queueMode}
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
          <input type="hidden" name="back" value={backHref} />
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
