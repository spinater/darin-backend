/**
 * normalize ชื่อเทรนเนอร์ก่อน lookup TrainerAlias
 * ข้อมูลจริงสะกด 21 แบบสำหรับคน ~5 คน: "pt แพท" "PTแพท" "PT พี่แพท" "แพท" ...
 */
export function normalizeTrainer(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "") // ตัดช่องว่างทั้งหมด (มีทั้ง "PT แพท" และ "PTแพท")
    .replace(/^pt/, "") // prefix "pt"/"PT" ไม่ได้แยกคน
    .replace(/^พี่/, "") // "พี่แพท" = "แพท"
    .trim();
}

/** เบอร์โทรในชีตมีทั้ง "0817479795" และ "817479795" */
export function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  return d.length === 9 ? "0" + d : d;
}
