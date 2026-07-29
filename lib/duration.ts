/**
 * เวลาแบบที่คนอ่านออก — "9 วินาที" / "1 นาที 5 วินาที"
 *
 * ปัดเป็นวินาทีเสมอ เพราะทุกที่ที่ใช้เป็น "ค่าประมาณ" การโชว์ทศนิยมจะทำให้ดูแม่นเกินจริง
 */
export function thaiDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} วินาที`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} นาที ${rest} วินาที` : `${m} นาที`;
}
