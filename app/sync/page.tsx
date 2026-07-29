import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncSources } from "@/lib/sync";
import { SyncRunner, type LastRun } from "./sync-runner";

export const dynamic = "force-dynamic";

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;

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

  async function run(formData: FormData) {
    "use server";
    await requireAdmin();
    const xlsxPath = String(formData.get("xlsxPath") ?? "").trim();
    try {
      await syncSources(xlsxPath ? { xlsxPath } : {});
    } catch (e) {
      redirect(`/sync?error=${encodeURIComponent((e as Error).message)}`);
    }
    revalidatePath("/sync");
    redirect("/sync");
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
        {error && <p className="text-sm text-red-600">{error}</p>}
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
            return (
              <tr key={s.id}>
                <td className="td">{s.sheetName}</td>
                <td className="td">{s.activity}</td>
                <td className="td font-mono text-xs">{s.spreadsheetId}</td>
                <td className="td">{s.lastSyncAt?.toLocaleString("th-TH") ?? "—"}</td>
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
