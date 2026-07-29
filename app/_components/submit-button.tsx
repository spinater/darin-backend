"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "./spinner";

/**
 * ปุ่ม submit ที่บอกสถานะเองระหว่าง server action ทำงาน
 *
 * ทำ 2 อย่างที่ปุ่มธรรมดาทำไม่ได้:
 *   1. ขึ้นวงหมุน + เปลี่ยนข้อความ ผู้ใช้จะได้รู้ว่ากดติดแล้ว
 *   2. disable ตัวเองไว้ กันกดซ้ำจนเกิดรายการซ้ำ (สำคัญกับหน้ายอดขาย/OT ที่กดซ้ำ = ข้อมูลซ้ำ)
 *
 * useFormStatus() อ่านสถานะของ <form> ที่ครอบอยู่ จึงต้องเป็น client component
 * และต้องอยู่ "ข้างใน" form เสมอ (ถ้าอยู่นอก pending จะเป็น false ตลอด)
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn",
  name,
  value,
  disabled,
  ...rest
}: React.ComponentProps<"button"> & { pendingLabel?: React.ReactNode }) {
  const { pending, data } = useFormStatus();

  // ฟอร์มเดียวมีได้หลายปุ่ม (เช่นหน้าสลิป: อนุมัติ/จ่ายแล้ว/กลับเป็นร่าง) — useFormStatus
  // บอกแค่ว่า "ฟอร์มนี้กำลังส่ง" ไม่ได้บอกว่าปุ่มไหน ต้องเทียบ name/value กับ FormData
  // ที่ส่งไปเอง ไม่งั้นทุกปุ่มจะหมุนพร้อมกันทั้งที่กดปุ่มเดียว
  const isMine = !name || data?.get(name) === value;
  const busy = pending && isMine;

  return (
    <button
      {...rest}
      name={name}
      value={value}
      // ปุ่มอื่นในฟอร์มเดียวกันก็ต้องล็อกด้วย ไม่งั้นกดอนุมัติแล้วรีบกดจ่ายแล้วซ้อนกันได้
      disabled={disabled || pending}
      aria-busy={busy}
      className={`${className} inline-flex items-center gap-1.5`}
    >
      {busy && <Spinner />}
      {busy && pendingLabel ? pendingLabel : children}
    </button>
  );
}
