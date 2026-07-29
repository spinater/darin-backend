/**
 * วงกลมหมุน — ใช้ร่วมกันทุกที่ที่ต้องรอ
 *
 * เป็น SVG + animate-spin ของ tailwind ล้วน ไม่มี state ไม่ต้องเป็น client component
 * จึงเอาไปวางในหน้า server ได้ตรงๆ
 */
export function Spinner({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
}
