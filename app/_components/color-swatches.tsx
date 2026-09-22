import Link from "next/link";
import { COLOR_MEANING_LABELS, type ColorGap } from "@/lib/color-rules";

/**
 * The one exit for a payable คาบ carrying this colour (task 070) — `/sync/review`'s `?hex=`
 * listing, which mirrors `colorGapsSeen()`'s filter so the page holds exactly the rows the swatch
 * counted.
 */
function reviewHref(hex: string) {
  return `/sync/review?hex=${encodeURIComponent(hex)}`;
}

/**
 * The sheet background colours a payroll run is about to pay without anyone having vouched for
 * them — swatch, hex, the คาบ count that still disagrees, and (when there *is* a rule the rows do
 * not obey) what that rule says.
 *
 * One component rather than three chains of classes, because the same list is read on three screens
 * — the dashboard banner, the `/payslips` run screen and `/admin/config` — and an owner who learns
 * to recognise a colour on one of them must see the identical thing on the next (CLAUDE.md §4: one
 * decision, one home).
 *
 * 🔴 **`unapplied` is styled apart from `unruled` on purpose.** "Nobody has answered" and "you
 * answered and it has not taken effect" need different actions — the second is the one where the
 * owner believes the matter is closed, so a list that rendered them the same would read as
 * progress.
 *
 * 🔴 **`pending` is the actionable count, never the exposure.** It is the คาบ that *openly* disagree
 * with what is known about the colour, so it is what the eye should land on — but every payable คาบ
 * is named, always: the reviewed share is called out separately in both directions, `stranded` under
 * a `skip` rule (rows no *sync* will ever re-evaluate) and `unseen` under a `review` one (rows a
 * human cleared without ever being shown the colour). ⚠️ `pending === 0` is **not** "resolved" and
 * never hides a colour — `lib/color-rules.ts` carries why `reviewed: true` is not evidence about a
 * colour at all.
 *
 * 🔑 **Both of those sentences now carry the exit** (task 070). They may point at `/sync/review`
 * only through `reviewHref()` — the bare page lists `NEEDS_ATTENTION`, which a hand-reviewed payable
 * row matches neither arm of; `?hex=` is the listing that holds it. A sentence linking to the
 * unfiltered queue sends the owner to a screen where the rows are not, which is what the previous
 * version refused to do by not linking at all.
 *
 * ⚠️ The inline `background` is the **only** hex this project writes outside `app/globals.css`, and
 * it is not a design decision: it is the datum. A swatch that renders an approximation of the cell's
 * colour is a swatch the owner cannot match against their own sheet.
 */
export function ColorSwatches({ colors }: { colors: ColorGap[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      {colors.map((c) => {
        // Two different things a hand-reviewed คาบ can mean, and they get different sentences.
        //
        // `stranded` — under a `skip` rule those rows openly contradict the rule, and a re-sync will
        // never touch them (`if (prev?.reviewed) … continue`), so the ข้าม in the colour view is the
        // only repair. Only on `unapplied`: on an *unruled* colour the claim would be premature,
        // since it is true only if the answer turns out to be ไม่จ่าย.
        //
        // `unseen` — under a `review` rule they are not in open conflict, but nobody vouched for
        // them either: they were cleared before the queue rendered `bgColor` at all (task 070), so
        // whoever cleared them was never shown this colour (`lib/color-rules.ts`). Neutral wording,
        // not red, because the repair is a second look rather than an ข้าม.
        const stranded = c.state === "unapplied" && c.meaning !== "review" ? c.reviewedSessions : 0;
        const unseen = c.state === "unapplied" && c.meaning === "review" ? c.reviewedSessions : 0;
        return (
          <span
            key={c.hex}
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs ${
              c.state === "unapplied"
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-neutral-200 bg-white text-neutral-700"
            }`}
          >
            <span className="size-3 rounded-sm border" style={{ background: c.hex }} />
            {c.hex}
            {/* `pending: 0` happens on a `review` colour whose คาบ were all hand-cleared — the
                colour is still listed, but "0 คาบ" as the lead number would read as nothing to do.
                The `unseen` sentence below carries the whole meaning in that case. */}
            {c.pending > 0 && (
              <span className={c.state === "unapplied" ? "" : "text-neutral-500"}>
                {c.pending} คาบ
              </span>
            )}
            {c.state === "unapplied" && c.meaning && (
              <span className="font-sans font-medium">
                ตั้งไว้ว่า &quot;{COLOR_MEANING_LABELS[c.meaning]}&quot; แต่ยังจ่ายอยู่
              </span>
            )}
            {stranded > 0 && (
              <span className="font-sans">
                · {stranded} คาบตรวจมือแล้ว sync จะข้ามตลอดไป —{" "}
                <Link href={reviewHref(c.hex)} className="underline">
                  กดข้ามทีละคาบที่นี่
                </Link>
              </span>
            )}
            {unseen > 0 && (
              <span className="font-sans text-neutral-600">
                · {unseen} คาบถูกตรวจด้วยมือไว้<b>ก่อนที่หน้าคิวจะแสดงสี</b> ⇒
                ยังไม่มีใครดูมันด้วยกฎสีนี้ —{" "}
                <Link href={reviewHref(c.hex)} className="underline">
                  เปิดดูทีละคาบ
                </Link>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
