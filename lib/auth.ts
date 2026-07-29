import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { verifyPassword } from "./password";

const COOKIE = "darin_session";
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 30);

export type Me = { id: string; name: string; role: string; rank: string | null };

export async function login(username: string, password: string): Promise<Me | null> {
  const staff = await db.staff.findUnique({ where: { username } });
  if (!staff || !staff.active) return null;
  if (!(await verifyPassword(password, staff.passwordHash))) return null;

  const session = await db.session.create({
    data: {
      staffId: staff.id,
      expiresAt: new Date(Date.now() + TTL_DAYS * 86400000),
    },
  });
  (await cookies()).set(COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: session.expiresAt,
    path: "/",
  });
  return { id: staff.id, name: staff.name, role: staff.role, rank: staff.rank };
}

export async function logout() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await db.session.deleteMany({ where: { id } });
  jar.delete(COOKIE);
}

export async function currentSessionId(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function currentStaff(): Promise<Me | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const session = await db.session.findUnique({ where: { id }, include: { staff: true } });
  if (!session || session.expiresAt < new Date() || !session.staff.active) return null;
  const { staff } = session;
  return { id: staff.id, name: staff.name, role: staff.role, rank: staff.rank };
}

/**
 * ด่านจริงอยู่ตรงนี้ ไม่ใช่ที่ middleware — ทุกหน้า/action ที่แตะเงินต้องเรียก
 * §หัวสเปค: หน้าเงินเดือน = Owner/Admin เท่านั้น
 */
export async function requireRole(...roles: string[]): Promise<Me> {
  const me = await currentStaff();
  if (!me) redirect("/login");
  if (roles.length && !roles.includes(me.role)) redirect("/me");
  return me;
}

export const requireAdmin = () => requireRole("owner", "admin");
