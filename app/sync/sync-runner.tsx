"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "../_components/spinner";
import { thaiDuration } from "@/lib/duration";
import type { SyncEvent, SyncResult } from "@/lib/sync";

/** สถิติรอบที่แล้ว ใช้บอกผู้ใช้ล่วงหน้าว่ารอบนี้น่าจะนานแค่ไหน */
export type LastRun = { fetchMs: number; processMs: number; totalMs: number } | null;

type State =
  | { phase: "idle" }
  | { phase: "fetch" }
  | { phase: "process"; sheetName: string; sheetIndex: number; sheetCount: number; done: number; total: number }
  | { phase: "done"; results: SyncResult[]; totalMs: number }
  | { phase: "error"; message: string };

export function SyncRunner({
  lastRun,
  fallbackAction,
}: {
  lastRun: LastRun;
  /**
   * server action เดิม — ใช้เมื่อเบราว์เซอร์ปิด JavaScript
   * ฟอร์มยังใช้งานได้ (แค่ไม่เห็นความคืบหน้า) แทนที่จะกลายเป็นปุ่มกดไม่ติด
   */
  fallbackAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "idle" });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  /** เวลาที่ช่วงดาวน์โหลดใช้จริงในรอบนี้ — รู้ตอนขึ้น phase process แล้วใช้แยกเวลา 2 ช่วงออกจากกัน */
  const [fetchMs, setFetchMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const running = state.phase === "fetch" || state.phase === "process";

  // เดินนาฬิกาเอง ไม่รอ event จากเซิร์ฟเวอร์ — ช่วง fetch ไม่มี event ส่งมาเลย
  // ถ้าไม่เดินเอง ตัวเลข "ผ่านไป…" จะค้างจนดูเหมือนแอปแฮงก์
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const elapsed = startedAt ? Math.max(0, now - startedAt) : 0;

  async function start(xlsxPath: string) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setStartedAt(Date.now());
    setNow(Date.now());
    setFetchMs(null);
    setState({ phase: "fetch" });

    let res: Response;
    try {
      res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xlsxPath }),
        signal: ac.signal,
      });
    } catch {
      setState({ phase: "error", message: "ต่อเซิร์ฟเวอร์ไม่ได้ — ลองใหม่อีกครั้ง" });
      return;
    }

    if (!res.ok || !res.body) {
      setState({
        phase: "error",
        message: res.status === 403 ? "ไม่มีสิทธิ์ sync" : `เซิร์ฟเวอร์ตอบ ${res.status}`,
      });
      return;
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    let finished = false;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        // 1 บรรทัด = 1 event · บรรทัดสุดท้ายอาจมาไม่ครบ เก็บไว้ต่อกับ chunk ถัดไป
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as SyncEvent;
          if (e.phase === "done" || e.phase === "error") finished = true;
          apply(e);
        }
      }
    } catch {
      if (!ac.signal.aborted)
        setState({ phase: "error", message: "การเชื่อมต่อหลุดกลางคัน — ลองใหม่อีกครั้ง" });
      return;
    }

    // stream จบแต่ไม่เคยได้ done/error = เซิร์ฟเวอร์ตายกลางคัน ถ้าไม่ดักไว้
    // วงหมุนจะหมุนค้างตลอดไปโดยที่ไม่มีอะไรทำงานอยู่จริง
    if (!finished && !ac.signal.aborted)
      setState({
        phase: "error",
        message: "การเชื่อมต่อจบก่อนที่ sync จะเสร็จ — เช็คสถานะแล้วลองใหม่",
      });

    function apply(e: SyncEvent) {
      setNow(Date.now());
      if (e.phase === "fetch") {
        setState({ phase: "fetch" });
      } else if (e.phase === "process") {
        setFetchMs((prev) => prev ?? e.elapsedMs);
        setState({
          phase: "process",
          sheetName: e.sheetName ?? "",
          sheetIndex: e.sheetIndex ?? 0,
          sheetCount: e.sheetCount ?? 0,
          done: e.done,
          total: e.total,
        });
      } else if (e.phase === "done") {
        setState({ phase: "done", results: e.results, totalMs: e.elapsedMs });
        // ตารางสรุปด้านล่างเป็น server component — ต้องสั่ง refresh ถึงจะเห็นตัวเลขใหม่
        router.refresh();
      } else if (e.phase === "error") {
        setState({ phase: "error", message: e.message });
      }
    }
  }

  /** เวลาที่เหลือโดยประมาณ — คิดจากความเร็วที่วัดได้จริงในรอบนี้ ไม่ใช่ค่าคงที่ */
  function remainingMs(): number | null {
    if (state.phase === "fetch") {
      // ช่วงนี้เซิร์ฟเวอร์บอกความคืบหน้าไม่ได้ (รอ Google ตอบ) จึงอ้างเวลารอบที่แล้วแทน
      if (!lastRun) return null;
      return Math.max(0, lastRun.fetchMs - elapsed);
    }
    if (state.phase === "process" && state.done > 0 && fetchMs !== null) {
      const spent = Math.max(1, elapsed - fetchMs);
      return (spent / state.done) * (state.total - state.done);
    }
    return null;
  }

  const remaining = running ? remainingMs() : null;
  const pct =
    state.phase === "process" && state.total > 0
      ? Math.min(100, Math.round((state.done / state.total) * 100))
      : null;

  return (
    <div className="flex flex-col gap-3">
      <form
        action={fallbackAction}
        // มี JS → กัน action เดิมไว้แล้ววิ่ง stream เองเพื่อให้เห็นความคืบหน้า
        // ไม่มี JS → onSubmit ไม่ทำงาน ฟอร์มตกไปที่ action ปกติ
        onSubmit={(e) => {
          e.preventDefault();
          if (running) return;
          const path = String(new FormData(e.currentTarget).get("xlsxPath") ?? "").trim();
          void start(path);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <button className="btn inline-flex items-center gap-1.5" disabled={running}>
          {running && <Spinner />}
          {running ? "กำลัง sync…" : "Sync จาก Google Sheet"}
        </button>
        <span className="pb-1.5 text-sm text-neutral-400">หรือ</span>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          อ่านจากไฟล์ .xlsx ในเครื่อง (ใช้ตอนยังไม่ได้ตั้ง service account)
          <input
            name="xlsxPath"
            className="input w-96"
            placeholder="เว้นว่าง = ใช้ Google Sheet"
            disabled={running}
          />
        </label>
      </form>

      {state.phase === "idle" && lastRun && (
        <p className="text-xs text-neutral-500">
          รอบที่แล้วใช้เวลา <b>{thaiDuration(lastRun.totalMs)}</b> — รอบนี้น่าจะใกล้เคียงกัน
        </p>
      )}

      {running && (
        <div
          className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Spinner className="size-4 text-neutral-500" />
            {state.phase === "fetch" ? (
              <span>กำลังโหลดข้อมูลจาก Google Sheet…</span>
            ) : (
              <span>
                กำลังประมวลผล — {state.sheetName}{" "}
                <span className="font-normal text-neutral-500">
                  (ชีตที่ {state.sheetIndex + 1} จาก {state.sheetCount})
                </span>
              </span>
            )}
          </div>

          {/* ช่วง fetch ไม่รู้เปอร์เซ็นต์ (รอเน็ต) ใช้แถบวิ่งไปมาแทนการโกหกว่ารู้ */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
            {pct === null ? (
              <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-neutral-500" />
            ) : (
              <div
                className="h-full rounded-full bg-neutral-800 transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span>ผ่านไป {thaiDuration(elapsed)}</span>
            {remaining !== null && <span>เหลืออีกประมาณ {thaiDuration(remaining)}</span>}
            {state.phase === "process" && (
              <span>
                {state.done.toLocaleString("th-TH")} / {state.total.toLocaleString("th-TH")} รายการ
                {pct !== null && ` (${pct}%)`}
              </span>
            )}
            {state.phase === "fetch" && !lastRun && <span>ยังไม่เคย sync — ยังประมาณเวลาไม่ได้</span>}
          </div>
        </div>
      )}

      {state.phase === "done" && (
        <div className="flex flex-col gap-2 rounded-lg border border-green-300 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-900">
            ✓ Sync เสร็จใน {thaiDuration(state.totalMs)}
          </p>
          {state.results.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-green-800/70">
                  <th className="py-1 pr-3 font-medium">ชีต</th>
                  <th className="py-1 pr-3 font-medium">เพิ่มใหม่</th>
                  <th className="py-1 pr-3 font-medium">อัปเดต</th>
                  <th className="py-1 pr-3 font-medium">ข้ามเพราะตรวจแล้ว</th>
                  <th className="py-1 pr-3 font-medium">รอตรวจ</th>
                </tr>
              </thead>
              <tbody className="text-green-900">
                {state.results.map((r) => (
                  <tr key={r.sheetName}>
                    <td className="py-0.5 pr-3">{r.sheetName}</td>
                    <td className="py-0.5 pr-3">{r.created.toLocaleString("th-TH")}</td>
                    <td className="py-0.5 pr-3">{r.updated.toLocaleString("th-TH")}</td>
                    <td className="py-0.5 pr-3">{r.skippedReviewed.toLocaleString("th-TH")}</td>
                    <td className="py-0.5 pr-3">{r.needsReview.toLocaleString("th-TH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {state.phase === "error" && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {state.message}
        </p>
      )}
    </div>
  );
}
