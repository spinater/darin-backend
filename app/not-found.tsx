import Link from "next/link";

/**
 * Root not-found screen (task 020).
 *
 * Reached today from `app/payslips/[id]/page.tsx:26`, which calls `notFound()` for a
 * payslip id that does not exist — before this file, that rendered Next's built-in English
 * 404 page. Server component, no props: Next renders this in place of the matched segment
 * whenever `notFound()` is called or no route matches.
 */
export default function NotFound() {
  return (
    <div className="card flex flex-col gap-3">
      <p className="font-semibold">ไม่พบหน้าที่เรียก</p>
      <p className="text-sm leading-relaxed">ลิงก์นี้อาจเก่าไปแล้ว หรือรายการที่เรียกถูกลบไปแล้ว</p>
      <div>
        <Link className="btn" href="/">
          กลับหน้าภาพรวม
        </Link>
      </div>
    </div>
  );
}
