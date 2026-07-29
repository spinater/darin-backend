import { redirect } from "next/navigation";
import { currentStaff, currentSessionId } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, MIN_PASSWORD_LEN, verifyPassword } from "@/lib/password";
import { SubmitButton } from "@/app/_components/submit-button";

export const dynamic = "force-dynamic";

const MIN_LEN = MIN_PASSWORD_LEN;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const me = await currentStaff();
  if (!me) redirect("/login");
  const { msg, err } = await searchParams;
  const isAdmin = me.role === "owner" || me.role === "admin";

  const others = isAdmin
    ? await db.staff.findMany({
        where: { active: true, NOT: { id: me.id } },
        orderBy: { name: "asc" },
      })
    : [];

  /** เปลี่ยนรหัสตัวเอง — ต้องยืนยันรหัสเดิม */
  async function changeOwn(formData: FormData) {
    "use server";
    const self = await currentStaff();
    if (!self) redirect("/login");

    const current = String(formData.get("current") ?? "");
    const next = String(formData.get("next") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (next.length < MIN_LEN) redirect(`/account?err=รหัสใหม่ต้องยาวอย่างน้อย ${MIN_LEN} ตัว`);
    if (next !== confirm) redirect("/account?err=รหัสใหม่กับยืนยันไม่ตรงกัน");

    const staff = await db.staff.findUniqueOrThrow({ where: { id: self.id } });
    if (!(await verifyPassword(current, staff.passwordHash)))
      redirect("/account?err=รหัสผ่านเดิมไม่ถูกต้อง");

    await db.staff.update({
      where: { id: self.id },
      data: { passwordHash: await hashPassword(next) },
    });
    // เตะ session อื่นออกทั้งหมด เหลือเครื่องที่กำลังใช้อยู่
    const keep = await currentSessionId();
    await db.session.deleteMany({
      where: { staffId: self.id, ...(keep ? { NOT: { id: keep } } : {}) },
    });
    redirect("/account?msg=เปลี่ยนรหัสผ่านแล้ว (อุปกรณ์อื่นถูกให้ล็อกอินใหม่)");
  }

  /** admin ตั้งรหัสให้คนอื่น — ไม่ต้องรู้รหัสเดิม แต่เตะทุก session ของคนนั้นออก */
  async function resetOther(formData: FormData) {
    "use server";
    const self = await currentStaff();
    if (!self || (self.role !== "owner" && self.role !== "admin")) redirect("/me");

    const staffId = String(formData.get("staffId") ?? "");
    const next = String(formData.get("next") ?? "");
    if (!staffId) redirect("/account?err=ไม่ได้เลือกพนักงาน");
    if (staffId === self!.id) redirect("/account?err=รหัสตัวเองให้ใช้ฟอร์มด้านบน");
    if (next.length < MIN_LEN) redirect(`/account?err=รหัสใหม่ต้องยาวอย่างน้อย ${MIN_LEN} ตัว`);

    const target = await db.staff.findUniqueOrThrow({ where: { id: staffId } });
    await db.staff.update({ where: { id: staffId }, data: { passwordHash: await hashPassword(next) } });
    await db.session.deleteMany({ where: { staffId } });
    redirect(`/account?msg=ตั้งรหัสใหม่ให้ ${target.name} แล้ว`);
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <h1 className="text-xl font-semibold">บัญชีของ {me.name}</h1>

      {msg && <p className="card border-green-300 bg-green-50 text-sm text-green-800">{msg}</p>}
      {err && <p className="card border-red-300 bg-red-50 text-sm text-red-700">{err}</p>}

      <form action={changeOwn} className="card flex flex-col gap-3">
        <h2 className="font-medium">เปลี่ยนรหัสผ่านของฉัน</h2>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          รหัสผ่านเดิม
          <input name="current" type="password" required className="input" autoComplete="current-password" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          รหัสผ่านใหม่ (อย่างน้อย {MIN_LEN} ตัว)
          <input
            name="next"
            type="password"
            required
            minLength={MIN_LEN}
            className="input"
            autoComplete="new-password"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ยืนยันรหัสผ่านใหม่
          <input
            name="confirm"
            type="password"
            required
            minLength={MIN_LEN}
            className="input"
            autoComplete="new-password"
          />
        </label>
        {/* scrypt ตั้งใจให้ช้า (กัน brute-force) การกดแล้วเงียบ ~ครึ่งวินาทีจึงเป็นเรื่องปกติ
            ต้องมีวงหมุนบอก ไม่งั้นผู้ใช้จะกดซ้ำ */}
        <SubmitButton className="btn self-start" pendingLabel="กำลังบันทึก…">
          บันทึก
        </SubmitButton>
      </form>

      {isAdmin && (
        <form action={resetOther} className="card flex flex-col gap-3">
          <h2 className="font-medium">ตั้งรหัสใหม่ให้พนักงาน</h2>
          <p className="text-xs text-neutral-500">
            ใช้ตอนพนักงานลืมรหัส — ตั้งเสร็จคนนั้นจะถูกให้ล็อกอินใหม่ทุกเครื่อง
          </p>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            พนักงาน
            <select name="staffId" required className="input">
              <option value="">— เลือก —</option>
              {others.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.username} · {s.role})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            รหัสผ่านใหม่ (อย่างน้อย {MIN_LEN} ตัว)
            <input name="next" type="password" required minLength={MIN_LEN} className="input" />
          </label>
          <SubmitButton className="btn self-start" pendingLabel="กำลังตั้งรหัสใหม่…">
            ตั้งรหัสใหม่
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
