import { db } from "./db";

/**
 * วัดเวลางานหนักแล้วจดค่าล่าสุดไว้ ให้ <ActionProgress> เอาไปบอกผู้ใช้รอบหน้าว่าต้องรอนานแค่ไหน
 *
 * ตัวเลขจึงมาจากเครื่องจริง+ข้อมูลจริงเสมอ ไม่ใช่ค่าที่เดาไว้ในโค้ด — ข้อมูลโตขึ้นเมื่อไร
 * คำเตือน "ปกติใช้เวลาประมาณ…" ก็โผล่มาเอง โดยไม่ต้องมีใครกลับมาแก้ตัวเลข
 *
 * ห้ามครอบ redirect()/revalidatePath(): redirect โยน error เป็นกลไกปกติของ Next.js
 * ครอบแล้วจะจดเวลาผิดและอ่านโค้ดยากขึ้นเปล่าๆ ครอบเฉพาะงานที่ช้าจริงพอ
 */
export async function timed<T>(job: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    // จดเวลาไม่สำเร็จไม่ควรทำให้งานหลักที่เพิ่งทำเสร็จพังตาม
    await db.jobDuration
      .upsert({
        where: { job },
        update: { ms: Date.now() - t0 },
        create: { job, ms: Date.now() - t0 },
      })
      .catch(() => {});
  }
}
