import { MIN_PASSWORD_LEN } from "@/lib/password";
import { SubmitButton } from "@/app/_components/submit-button";

/**
 * "เพิ่มพนักงานใหม่" — co-located here under the §4 split pattern when task 013 added the numeric
 * guards to `page.tsx`. Pure markup: the action, the two option lists and the one refusal flag come
 * from the page, so there is still exactly one home for each of them.
 */
export function AddStaffForm({
  action,
  ranks,
  roles,
  rejected,
}: {
  action: (formData: FormData) => Promise<void>;
  ranks: readonly string[];
  roles: readonly string[];
  /**
   * A **boolean**, not the `err` string — the copy below is the only wording this screen has for
   * the case, and a component that cannot see the URL cannot print it (§2.5, and the `/ot`
   * precedent: the flag decides, the page owns the words).
   */
  rejected: boolean;
}) {
  return (
    <section className="card">
      <h2 className="mb-2 font-medium">เพิ่มพนักงานใหม่</h2>
      <p className="mb-2 text-xs text-neutral-500">
        ใส่ <b>ชื่อที่ใช้จดในชีต</b> ให้ตรงด้วย แล้วกด Sync อีกครั้ง → คาบเก่าที่ค้างอยู่เพราะ
        &quot;ไม่รู้จักเทรนเนอร์&quot; จะถูกจับคู่ให้อัตโนมัติ ไม่ต้องไล่แก้ทีละอัน
      </p>
      {rejected && (
        <p className="card-warn mb-2 text-sm">
          ⚠️ ฐานเงินเดือน หรือ เครดิตสอนคลาส ไม่ใช่จำนวนเต็มตั้งแต่ 0 ขึ้นไป —{" "}
          <b>ยังไม่ได้เพิ่มพนักงานคนนี้</b> ตรวจสองช่องนั้นแล้วกดเพิ่มอีกครั้ง
        </p>
      )}
      <form action={action} className="grid gap-2 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ชื่อ
          <input name="name" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ชื่อผู้ใช้ (ล็อกอิน)
          <input name="username" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          รหัสผ่านตั้งต้น (≥{MIN_PASSWORD_LEN} ตัว)
          <input
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LEN}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          บทบาท
          <select name="role" className="input">
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ระดับ (เฉพาะเทรนเนอร์)
          <select name="rank" className="input">
            {ranks.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ฐานเงินเดือน
          <input name="baseSalary" type="number" defaultValue={10000} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          เครดิตสอนคลาส
          <input name="classCredit" type="number" defaultValue={5000} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ชื่อที่ใช้จดในชีต (เว้นว่าง = ใช้ชื่อด้านบน)
          <input name="sheetName" placeholder='เช่น "PT ต้น"' className="input" />
        </label>
        <SubmitButton
          className="btn md:col-span-4 md:justify-self-start"
          pendingLabel="กำลังเพิ่มพนักงาน…"
        >
          เพิ่มพนักงาน
        </SubmitButton>
      </form>
    </section>
  );
}
