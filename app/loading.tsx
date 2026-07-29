import { Spinner } from "./_components/spinner";

/**
 * หน้าจอระหว่างเปลี่ยนหน้า
 *
 * ทุกหน้าเป็น force-dynamic (ต้องอ่าน DB สดทุกครั้ง) การกดเมนูจึงมีจังหวะรอเสมอ
 * ถ้าไม่มีไฟล์นี้ Next.js จะค้างที่หน้าเดิมเงียบๆ จนกว่าหน้าใหม่จะพร้อม —
 * ผู้ใช้แยกไม่ออกว่ากดไม่ติดหรือกำลังโหลด
 */
export default function Loading() {
  return (
    <div
      className="flex items-center gap-2 py-10 text-sm text-neutral-500"
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-4" />
      กำลังโหลด…
    </div>
  );
}
