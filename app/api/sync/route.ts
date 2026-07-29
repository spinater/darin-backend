import { currentStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncSources, type SyncEvent, type SyncResult } from "@/lib/sync";

export const dynamic = "force-dynamic";

/**
 * รัน sync แล้วรายงานความคืบหน้าแบบ streaming
 *
 * ทำไมไม่ใช้ server action ธรรมดา: server action ตอบกลับได้ครั้งเดียวตอนจบ
 * ผู้ใช้จะเห็นแค่หน้าค้าง ~10 วินาทีโดยไม่รู้ว่าถึงไหนแล้ว จึงต้องเป็น route
 * ที่ทยอยส่งออกมาได้ (หน้า /sync ยังมี server action ไว้เป็นทางสำรองตอนปิด JS)
 */
export async function POST(req: Request) {
  const me = await currentStaff();
  // ไม่ใช้ requireAdmin() เพราะมัน redirect ซึ่งไม่มีความหมายกับ fetch — ตอบ 403 ให้ตรงไปตรงมา
  if (!me || (me.role !== "owner" && me.role !== "admin"))
    return Response.json({ error: "ต้องเป็น owner หรือ admin" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { xlsxPath?: string };
  const xlsxPath = body.xlsxPath?.trim();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: SyncEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));

      const run = await db.syncRun.create({ data: {} });
      const t0 = Date.now();
      let fetchMs: number | null = null;
      let units = 0;

      try {
        const results = await syncSources(xlsxPath ? { xlsxPath } : {}, (p) => {
          // event แรกของ phase process = จุดที่ดาวน์โหลดจบพอดี ใช้ปิดเวลาช่วง fetch
          if (p.phase === "process" && fetchMs === null) fetchMs = Date.now() - t0;
          if (p.total) units = p.total;
          send({ ...p, elapsedMs: Date.now() - t0 });
        });

        const elapsedMs = Date.now() - t0;
        const sum = (k: keyof SyncResult) => results.reduce((n, r) => n + (r[k] as number), 0);
        await db.syncRun.update({
          where: { id: run.id },
          data: {
            finishedAt: new Date(),
            fetchMs: fetchMs ?? elapsedMs,
            processMs: elapsedMs - (fetchMs ?? elapsedMs),
            units,
            ok: sum("ok"),
            needsReview: sum("needsReview"),
            ignored: sum("ignored"),
          },
        });

        send({
          phase: "done",
          results,
          elapsedMs,
          fetchMs: fetchMs ?? elapsedMs,
          processMs: elapsedMs - (fetchMs ?? elapsedMs),
        });
      } catch (e) {
        const message = (e as Error).message;
        // เก็บ error ไว้ด้วย แต่รอบที่พังจะไม่ถูกใช้คิดค่าประมาณเวลา (ดู lastSyncRun)
        await db.syncRun
          .update({ where: { id: run.id }, data: { finishedAt: new Date(), error: message } })
          .catch(() => {});
        send({ phase: "error", message, elapsedMs: Date.now() - t0 });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      // no-transform สำคัญ: กัน proxy/CDN ระหว่างทางรวบ chunk ไว้ส่งทีเดียวตอนจบ
      "Cache-Control": "no-cache, no-store, no-transform",
      // nginx เคารพ header นี้ = ปิด buffering เฉพาะ response นี้
      "X-Accel-Buffering": "no",
    },
  });
}
