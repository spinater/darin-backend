/**
 * **Which queues have to be clear before a period may be paid** — one home for that question
 * (task 064, CLAUDE.md §4).
 *
 * There are two queues and there will not be one: `TeachSession.status = "needs_review"` is *a
 * payable row that exists and is flagged*, repaired in place at `/sync/review`, while a
 * `ClassImportProblem` is *a payable row that does not exist*, repaired upstream and then
 * re-uploaded. What they genuinely share is the **meaning** "this period is not clean enough to run",
 * and that is this function.
 *
 * 🔴 **Two labelled numbers, never one total.** A sum reads as one queue and hides which screen to
 * open — and the two repairs are different actions on different screens. A third queue is one edit
 * here plus one row on each of the two screens that render it.
 *
 * 🔴 **Both screens must read this, not a bare count of their own.** `/payslips` and `/` used to call
 * `pendingReviewInPeriod` separately; adding the second number in one place only is how a dashboard
 * and a run screen come to disagree about whether the month is clean.
 *
 * ⚠️ No role check lives here — `requireAdmin()` / `currentStaff()` belong to the pages that call it,
 * exactly as with `runPayroll()` and `syncSources()`, and no gate watches that
 * (`.docs/knowledge/ops/gates.md`).
 */
import { pendingClassImportInPeriod } from "./class-problems-run";
import { pendingReviewInPeriod } from "./payroll-run";

export type RunBlockers = {
  /** คาบ 1-on-1 from the Google Sheet that are flagged and still in `/sync/review`. */
  sheetReview: number;
  /** Gymmo คาบ that never became a `ClassSession` and are still unresolved (card 065 lists them). */
  classImport: number;
};

export async function runBlockers(period: string): Promise<RunBlockers> {
  const [sheetReview, classImport] = await Promise.all([
    pendingReviewInPeriod(period),
    pendingClassImportInPeriod(period),
  ]);
  return { sheetReview, classImport };
}
