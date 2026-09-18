import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncWithRun } from "@/lib/sync-run";
import { SyncRunner, type LastRun } from "./sync-runner";

export const dynamic = "force-dynamic";

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; warn?: string }>;
}) {
  await requireAdmin();
  const { error, warn } = await searchParams;

  const sources = await db.sheetSource.findMany({ orderBy: { sheetName: "asc" } });
  const counts = await db.teachSession.groupBy({
    by: ["sourceId", "status"],
    _count: { _all: true },
  });

  // เอาเวลาจากรอบที่สำเร็จล่าสุดไปบอกผู้ใช้ว่ารอบนี้น่าจะนานแค่ไหน
  // รอบที่พังไม่นับ เพราะมันจบเร็วผิดปกติแล้วจะทำให้ประมาณต่ำเกินจริง
  const last = await db.syncRun.findFirst({
    where: { error: null, finishedAt: { not: null }, processMs: { not: null } },
    orderBy: { startedAt: "desc" },
  });
  const lastRun: LastRun = last
    ? {
        fetchMs: last.fetchMs ?? 0,
        processMs: last.processMs ?? 0,
        totalMs: (last.fetchMs ?? 0) + (last.processMs ?? 0),
      }
    : null;
  // ใช้บอกว่าชีตไหน "sync แล้ว แต่ไม่ใช่รอบล่าสุด" — ต่างจาก "ไม่เคย sync" (lastSyncAt เป็น null)
  //
  // 🔴 Compare against the run's **start**, never `finishedAt`. `lib/sync.ts` stamps `lastSyncAt`
  // per sheet *while* the run is still going, and `finishedAt` is written after every sheet is
  // done ⇒ `lastSyncAt < finishedAt` is true for sheets that synced perfectly, which painted every
  // row amber and hid the one sheet that really was missing (task 009 review).
  //
  // 🔴 **A second query, not `last`.** One query cannot answer two different questions: the
  // estimator above must exclude failed runs (they finish early and drag the estimate down), but
  // the marker must include them — "when did the most recent *attempt* start". Reusing `last`
  // made the marker fall back to the previous *successful* run after a run that threw partway, so
  // every sheet that run never reached compared clean and no marker rendered. The `?error=` banner
  // and the streaming error state are both gone on the next refresh, so the marker was silent
  // exactly when it was the only durable signal left (task 009 second review).
  const lastAttempt = await db.syncRun.findFirst({
    where: { finishedAt: { not: null } },
    orderBy: { startedAt: "desc" },
  });
  const latestRunStartedAt = lastAttempt?.startedAt ?? null;

  /**
   * The no-JS fallback — identical to `POST /api/sync` except that it reports no progress.
   *
   * 🔑 It goes through `syncWithRun` for the same reason the streaming route does: it must write a
   * `SyncRun` row. Without one, the "ไม่ได้ sync รอบล่าสุด" marker in the table below could never
   * fire for a run started here, and the `?warn=<n>` banner it redirects to would be telling the
   * user to look at a column that has nothing to say (task 009 review).
   */
  async function run(formData: FormData) {
    "use server";
    await requireAdmin();
    const xlsxPath = String(formData.get("xlsxPath") ?? "").trim();
    let results: Awaited<ReturnType<typeof syncWithRun>>["results"];
    try {
      results = (await syncWithRun(xlsxPath ? { xlsxPath } : {})).results;
    } catch (e) {
      redirect(`/sync?error=${encodeURIComponent((e as Error).message)}`);
    }
    revalidatePath("/sync");
    const missingCount = results.filter((r) => r.missingGrid).length;
    redirect(missingCount > 0 ? `/sync?warn=${missingCount}` : "/sync");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Sync ตารางสอนจาก Google Sheet</h1>

      <div className="card flex flex-col gap-3">
        <SyncRunner lastRun={lastRun} fallbackAction={run} />
        <p className="text-xs text-neutral-500">
          ⚠️ ห้ามใช้ไฟล์ .csv — Google export CSV ทำ <b>ปีหาย</b> (serial 45405 → &quot;23/4&quot;)
          ข้อมูลคร่อม 2024–2026 จึงแยกปีไม่ออก
        </p>
        {error && <p className="card-error text-sm">{error}</p>}
        {warn && Number(warn) > 0 && (
          <p className="card-warn text-sm">
            ⚠️ {warn} ชีตไม่ได้ข้อมูล — ดูคอลัมน์ &quot;sync ล่าสุด&quot; ด้านล่างว่าชีตไหน
          </p>
        )}
      </div>

      <table className="card w-full">
        <thead>
          <tr>
            {["ชีต", "กิจกรรม", "spreadsheetId", "sync ล่าสุด", "พร้อมจ่าย", "รอตรวจ", "ข้าม"].map(
              (h) => (
                <th key={h} className="th">
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => {
            const c = (st: string) =>
              counts.find((x) => x.sourceId === s.id && x.status === st)?._count._all ?? 0;
            // `syncSources` only fetches `where: { active: true }`, so an inactive sheet's
            // `lastSyncAt` can never advance and the marker would sit there forever — permanent
            // amber is what trains people to stop reading amber. A sheet nobody expects to sync
            // has not missed a round.
            const stale =
              s.active &&
              latestRunStartedAt != null &&
              s.lastSyncAt != null &&
              s.lastSyncAt < latestRunStartedAt;
            return (
              <tr key={s.id}>
                <td className="td">{s.sheetName}</td>
                <td className="td">{s.activity}</td>
                <td className="td font-mono text-xs">{s.spreadsheetId}</td>
                <td className="td">
                  {s.lastSyncAt?.toLocaleString("th-TH") ?? "—"}
                  {stale && (
                    <span className="ml-1 text-xs font-medium text-amber-700">
                      (ไม่ได้ sync รอบล่าสุด)
                    </span>
                  )}
                </td>
                <td className="td text-green-700">{c("ok")}</td>
                <td className="td text-amber-700">
                  {c("needs_review") > 0 ? (
                    <Link href="/sync/review" className="underline">
                      {c("needs_review")}
                    </Link>
                  ) : (
                    0
                  )}
                </td>
                <td className="td text-neutral-400">{c("ignored")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
