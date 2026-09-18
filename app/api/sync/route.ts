import { currentStaff } from "@/lib/auth";
import { syncWithRun } from "@/lib/sync-run";
import type { SyncEvent } from "@/lib/sync";

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

      const t0 = Date.now();

      try {
        // `syncWithRun` owns the `SyncRun` row, failure included; this route only forwards events.
        // The no-JS fallback on /sync calls the same helper, so both paths record a run by
        // construction rather than by two copies of the same bookkeeping staying in step.
        const { results, elapsedMs, fetchMs, processMs } = await syncWithRun(
          xlsxPath ? { xlsxPath } : {},
          (p, elapsed) => send({ ...p, elapsedMs: elapsed }),
        );
        send({ phase: "done", results, elapsedMs, fetchMs, processMs });
      } catch (e) {
        send({ phase: "error", message: (e as Error).message, elapsedMs: Date.now() - t0 });
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
