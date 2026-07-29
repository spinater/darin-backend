import { redirect } from "next/navigation";
import { login } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const me = await login(
      String(formData.get("username") ?? ""),
      String(formData.get("password") ?? ""),
    );
    redirect(me ? (me.role === "trainer" ? "/me" : "/") : "/login?error=1");
  }

  return (
    <form action={action} className="card mx-auto mt-24 flex max-w-xs flex-col gap-3">
      <h1 className="text-lg font-semibold">เข้าสู่ระบบ</h1>
      <input name="username" placeholder="ชื่อผู้ใช้" className="input" required autoFocus />
      <input name="password" type="password" placeholder="รหัสผ่าน" className="input" required />
      {error && <p className="text-sm text-red-600">ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง</p>}
      <button className="btn">เข้าสู่ระบบ</button>
    </form>
  );
}
