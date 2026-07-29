import { expect, test, describe } from "bun:test";
import {
  generatePassword,
  hashPassword,
  LOGIN_DISABLED,
  MIN_PASSWORD_LEN,
  verifyPassword,
} from "./password";

describe("password", () => {
  test("hash แล้ว verify ผ่าน", async () => {
    const h = await hashPassword("changeme");
    expect(await verifyPassword("changeme", h)).toBe(true);
  });

  test("รหัสผิด verify ไม่ผ่าน", async () => {
    const h = await hashPassword("changeme");
    expect(await verifyPassword("changemf", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
  });

  test("salt ต่างกันทุกครั้ง", async () => {
    expect(await hashPassword("x")).not.toBe(await hashPassword("x"));
  });

  test("hash พังหรือมาจากอัลกอริทึมอื่น → false ไม่ใช่ throw", async () => {
    for (const bad of ["", "argon2id$v=19$m=65536", "scrypt$zz", "scrypt$aa$bb"])
      expect(await verifyPassword("changeme", bad)).toBe(false);
  });

  test("บัญชีที่ปิดล็อกอินไว้ — ไม่มีรหัสไหนเข้าได้", async () => {
    for (const attempt of ["", "disabled", "changeme", LOGIN_DISABLED, generatePassword()])
      expect(await verifyPassword(attempt, LOGIN_DISABLED)).toBe(false);
  });

  test("รหัสที่สุ่มให้ยาวพอและไม่ซ้ำ", async () => {
    const pws = Array.from({ length: 50 }, () => generatePassword());
    for (const p of pws) expect(p.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LEN);
    expect(new Set(pws).size).toBe(50);
  });

  // regression guard: `bun run dev` รัน Next บน Node → Bun.* พังทั้งหมด
  test("โค้ดที่ Next.js รันต้องไม่พึ่ง global ของ Bun", async () => {
    const { Glob } = await import("bun");
    const offenders: string[] = [];
    for (const dir of ["lib", "app", "prisma"])
      for await (const f of new Glob("**/*.{ts,tsx}").scan(dir)) {
        const path = `${dir}/${f}`;
        if (path.endsWith(".test.ts")) continue; // test รันบน Bun อยู่แล้ว
        const code = (await Bun.file(path).text())
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "");
        if (/\bBun\.\w/.test(code)) offenders.push(path);
      }
    expect(offenders).toEqual([]);
  });
});
