import { revalidatePath } from "next/cache";

/**
 * The screens that render a `ColorGap` — one home for the list, so the two writers that can change
 * it cannot drift apart (task 070, CLAUDE.md §4).
 *
 * 🔴 There are exactly two ways a colour's entry moves: **answering** it (`addColor` in
 * `app/admin/config/_actions.ts`) and **clearing the rows** (`ignore` / bulk ข้าม in
 * `app/sync/review/page.tsx`). Before this module the first revalidated `/admin/config` only and the
 * second `/sync/review` only, which was survivable while each screen was its own entry point — and
 * stopped being survivable when the swatches on `/` and `/payslips` became the link *to* the
 * repair. The owner clicks ข้าม, navigates back, and the same red entry is still counting the row
 * they just cleared.
 *
 * ⚠️ All four pages are `force-dynamic`, so nothing here is about a *server* cache: the value is the
 * **client router cache**, which is what serves a back-navigation and what `revalidatePath` marks
 * stale. A stale number on the one screen whose job is to be believed about money reads as "the
 * button did nothing" (§2 rule 4).
 */
export const COLOR_GAP_PATHS = ["/", "/payslips", "/admin/config"];

/** Mark every colour-gap screen stale, plus whichever page the caller is on. */
export function revalidateColorGaps(...also: string[]): void {
  for (const p of [...COLOR_GAP_PATHS, ...also]) revalidatePath(p);
}
