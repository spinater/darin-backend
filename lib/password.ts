import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;

/** ความยาวขั้นต่ำของรหัสผ่านที่ตั้งเองได้ — ใช้ร่วมกันทุกฟอร์ม */
export const MIN_PASSWORD_LEN = 12;

/**
 * ค่าที่ใส่ใน passwordHash เพื่อ "ปิดการล็อกอิน" ของบัญชีนั้น
 * verifyPassword จะ false ทันทีเพราะ scheme ไม่ใช่ scrypt — ไม่มีรหัสไหนผ่านได้
 * ใช้กับเทรนเนอร์ที่ลงข้อมูลผ่าน Google Sheet ไม่ต้องเข้าเว็บ แต่ยังต้องมีตัวตนไว้รับเงิน
 */
export const LOGIN_DISABLED = "disabled";

/** สุ่มรหัสผ่านแบบเดาไม่ได้ (~150 bits) ไว้ใช้เป็นรหัสตั้งต้นตอน deploy */
export function generatePassword(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * node:crypto ไม่ใช่ Bun.password — เพราะ Next.js รันบน Node
 * (next dev/start ใช้ Node runtime แม้จะสั่งด้วย bun) ใช้ stdlib จึงทำงานได้ทั้งสอง runtime
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEYLEN) return false;
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), KEYLEN);
  return timingSafeEqual(actual, expected);
}
