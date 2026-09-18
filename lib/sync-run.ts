import { db } from "./db";
import { syncSources, type SyncProgress, type SyncResult } from "./sync";

export type SyncRunOutcome = {
  results: SyncResult[];
  elapsedMs: number;
  fetchMs: number;
  processMs: number;
};

/**
 * Run a sync and record it as exactly one `SyncRun` row.
 *
 * 🔴 **Both entry points must go through this.** `/sync` marks a sheet "ไม่ได้ sync รอบล่าสุด" by
 * comparing `SheetSource.lastSyncAt` against the latest `SyncRun.startedAt`, so an entry point
 * that runs a sync without writing a row makes that marker blind to its own runs — the no-JS
 * server action used to be exactly that, which left the `?warn=<n>` banner pointing at a column
 * that could say nothing (task 009 review). The duration estimator on the same page loses that
 * sample too.
 *
 * On failure the row is closed with `error` set — `app/sync/page.tsx` filters the estimator on
 * `error: null`, so a half-finished run never drags the estimate down — and the error is rethrown
 * for the caller to present in whatever way fits it (a stream event, or a redirect).
 */
export async function syncWithRun(
  opts: { xlsxPath?: string } = {},
  onProgress?: (p: SyncProgress, elapsedMs: number) => void,
): Promise<SyncRunOutcome> {
  const run = await db.syncRun.create({ data: {} });
  const t0 = Date.now();
  let fetchMs: number | null = null;
  let units = 0;

  try {
    const results = await syncSources(opts, (p) => {
      // event แรกของ phase process = จุดที่ดาวน์โหลดจบพอดี ใช้ปิดเวลาช่วง fetch
      if (p.phase === "process" && fetchMs === null) fetchMs = Date.now() - t0;
      if (p.total) units = p.total;
      onProgress?.(p, Date.now() - t0);
    });

    const elapsedMs = Date.now() - t0;
    // No progress event at all (no active sheet) ⇒ charge the whole run to fetch, as before.
    const fetched = fetchMs ?? elapsedMs;
    const processMs = elapsedMs - fetched;
    const sum = (k: keyof SyncResult) => results.reduce((n, r) => n + (r[k] as number), 0);
    await db.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        fetchMs: fetched,
        processMs,
        units,
        ok: sum("ok"),
        needsReview: sum("needsReview"),
        ignored: sum("ignored"),
      },
    });

    return { results, elapsedMs, fetchMs: fetched, processMs };
  } catch (e) {
    await db.syncRun
      .update({
        where: { id: run.id },
        data: { finishedAt: new Date(), error: (e as Error).message },
      })
      .catch(() => {});
    throw e;
  }
}
