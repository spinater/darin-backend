"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { thaiDuration } from "@/lib/duration";

/**
 * เกินเท่านี้ถึงจะถือว่า "นานพอที่ต้องบอกเวลา"
 * ต่ำกว่านี้การขึ้น "เหลืออีกประมาณ 0 วินาที" มีแต่ทำให้รก และดูเหมือนระบบมั่ว
 */
const SLOW_ENOUGH_MS = 1500;

/** รอให้ค้างเกินเท่านี้ก่อนค่อยโผล่ — งานที่จบใน 300ms ไม่ต้องมีนาฬิกาให้กะพริบ */
const SHOW_AFTER_MS = 600;

/**
 * นาฬิกาข้างปุ่ม สำหรับ action ที่กินเวลาหลายวินาที
 *
 * วางคู่กับ <SubmitButton> ในฟอร์มเดียวกัน: ปุ่มบอกว่า "กำลังทำอยู่"
 * ส่วนตัวนี้บอกว่า "ทำมานานแค่ไหนแล้ว และน่าจะอีกนานเท่าไร"
 *
 * เงียบเองเมื่องานเร็ว และโผล่มาเองเมื่องานเริ่มช้า (เช่นพนักงานเยอะขึ้นจนคำนวณนาน)
 * เพราะ baselineMs มาจากเวลาที่วัดได้จริงรอบที่แล้ว ไม่ใช่ค่าที่เขียนตายไว้
 *
 * ต่างจากหน้า sync ตรงที่ action ธรรมดารายงานความคืบหน้าระหว่างทางไม่ได้ (ตอบครั้งเดียว
 * ตอนจบ) เวลาที่เหลือจึงอ้างจากรอบที่แล้วล้วนๆ — เขียนกำกับว่า "ประมาณ" และไม่โชว์
 * เปอร์เซ็นต์ ไม่ทำเป็นรู้ทั้งที่ไม่รู้
 */
export function ActionProgress({ baselineMs }: { baselineMs: number | null }) {
  const { pending } = useFormStatus();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const worthShowing = baselineMs !== null && baselineMs >= SLOW_ENOUGH_MS;

  useEffect(() => {
    if (!pending) {
      setStartedAt(null);
      return;
    }
    const t0 = Date.now();
    const show = setTimeout(() => {
      setStartedAt(t0);
      setNow(Date.now());
    }, SHOW_AFTER_MS);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearTimeout(show);
      clearInterval(tick);
    };
  }, [pending]);

  if (!pending)
    return worthShowing ? (
      <span className="pb-1.5 text-xs text-neutral-400">
        ปกติใช้เวลาประมาณ {thaiDuration(baselineMs)}
      </span>
    ) : null;

  if (startedAt === null) return null; // ยังไม่ถึง SHOW_AFTER_MS — งานอาจจบก่อนด้วยซ้ำ

  const elapsed = Math.max(0, now - startedAt);
  const remaining = worthShowing ? Math.max(0, baselineMs - elapsed) : null;

  return (
    <span className="pb-1.5 text-xs text-neutral-500" role="status" aria-live="polite">
      ผ่านไป {thaiDuration(elapsed)}
      {remaining !== null &&
        (remaining > 0 ? ` · เหลืออีกประมาณ ${thaiDuration(remaining)}` : " · ใกล้เสร็จแล้ว")}
    </span>
  );
}
