import type { ReactNode } from "react";
import { MIN_PASSWORD_LEN } from "@/lib/password";
import type { NewStaffRefusal } from "@/lib/staff-form";
import { SubmitButton } from "@/app/_components/submit-button";

/**
 * 🔑 The sentence all five notices share, and the load-bearing half of each one: the admin's real
 * question after a refusal is "did it go in?". Here the answer is flatly **no** — `addStaff` parses
 * every field before its first write, and the duplicate is raised by the `create` itself, so no
 * refusal can leave a half-add. (The action does write **twice** — the `create`, then the alias
 * upsert — but the second only runs once the first has succeeded, which is why the claim holds
 * here without the transaction the bulk save needs to make the same promise.)
 */
const NOT_ADDED = <b>ยังไม่ได้เพิ่มพนักงานคนนี้</b>;

/**
 * Why "เพิ่มพนักงานใหม่" refused, in Thai — one entry per member of `NewStaffRefusal`.
 *
 * The `err` query param is a **flag, never the message** (the `/ot` and `save-notice.tsx`
 * precedent): nothing the URL carries is rendered, so a crafted link cannot put words on an
 * admin's screen. Typing this as `Record<NewStaffRefusal, …>` is the other half — a refusal added
 * to the closed set with no copy written for it is a **type error**, not a notice that silently
 * renders nothing.
 *
 * 🔑 This used to be one `rejected: boolean`, and the old doc-comment argued for that because there
 * was exactly **one** reason to reject (task 013's money guard). Task 027 gave the identity fields
 * and the duplicate username the same surface, so there are five, and a boolean cannot say which —
 * the shape that fits five is `save-notice.tsx`'s: the page hands over the flag, this file owns
 * every word.
 *
 * Each entry names **its own field** as the label above that box prints it, because "ตรวจข้อมูล
 * แล้วลองใหม่" would send the admin re-typing a form where one box is wrong. The password names
 * `MIN_PASSWORD_LEN` rather than a literal — the same constant the input's `minLength` uses, so
 * the notice cannot drift from the rule. `name` and `username` are `required` in the markup, so
 * the reachable way to fail them is whitespace only: the copy has to make sense to someone looking
 * at a box that is **not** empty.
 */
const NOTICES: Record<NewStaffRefusal, ReactNode> = {
  newstaff: (
    <>
      ฐานเงินเดือน หรือ เครดิตสอนคลาส ไม่ใช่จำนวนเต็มตั้งแต่ 0 ขึ้นไป — {NOT_ADDED}{" "}
      ตรวจสองช่องนั้นแล้วกดเพิ่มอีกครั้ง
    </>
  ),
  newstaffName: (
    <>
      ช่อง “ชื่อ” มีแต่เว้นวรรค ไม่มีตัวอักษรเลย — {NOT_ADDED}{" "}
      พิมพ์ชื่อพนักงานลงไปแล้วกดเพิ่มอีกครั้ง
    </>
  ),
  newstaffUser: (
    <>
      ช่อง “ชื่อผู้ใช้ (ล็อกอิน)” มีแต่เว้นวรรค ไม่มีตัวอักษรเลย — {NOT_ADDED}{" "}
      พิมพ์ชื่อที่ใช้ล็อกอินลงไปแล้วกดเพิ่มอีกครั้ง
    </>
  ),
  newstaffPass: (
    <>
      รหัสผ่านตั้งต้นสั้นกว่า {MIN_PASSWORD_LEN} ตัว — {NOT_ADDED} ตั้งรหัสใหม่ให้ยาวอย่างน้อย{" "}
      {MIN_PASSWORD_LEN} ตัวแล้วกดเพิ่มอีกครั้ง
    </>
  ),
  newstaffDup: (
    <>
      ชื่อผู้ใช้ (ล็อกอิน) นี้มีคนใช้อยู่แล้ว — {NOT_ADDED} <b>ช่องอื่นกรอกถูกหมดแล้ว</b>{" "}
      ตั้งชื่อผู้ใช้ใหม่แล้วกดเพิ่มอีกครั้ง
      (พนักงานที่ปิดใช้งานไปแล้วก็ยังจองชื่อผู้ใช้ของตัวเองไว้อยู่)
    </>
  ),
};

/**
 * The lookup, widened **by assignment and not by a cast**, so `NOTICES` above stays checked against
 * the closed set while this one may miss: `/admin/config` has a single `?err=` slot shared by every
 * action on the screen, so the flag standing in the address bar is often one this form knows
 * nothing about (`cfg`, `rate`, `class`, `staff` — `SaveNotice`'s).
 *
 * 🔴 **A miss is decided by `Object.hasOwn`, never by the truthiness of `BY_FLAG[err]`.** An object
 * literal carries `Object.prototype` with it, so `?err=__proto__` answers with an **object** and
 * `?err=constructor` with a **function** — each truthy, each landing in a React child slot, and the
 * two then break the promise differently. The **object** throws *"Objects are not valid as a React
 * child"*, in the production renderer and not only in dev ⇒ `app/error.tsx` telling the admin a
 * config value is missing on a page that is perfectly healthy: this card's own failure, the wrong
 * explanation on screen, walking back in through the URL. The **function** is dropped with a
 * dev-only console error and renders nothing, which is the same promise broken more quietly.
 * Hence: "an unknown flag renders nothing" is decided by asking whether the key is **own**, never
 * by whatever the lookup happens to return.
 */
const BY_FLAG: Partial<Record<string, ReactNode>> = NOTICES;

/**
 * "เพิ่มพนักงานใหม่" — co-located here under the §4 split pattern when task 013 added the numeric
 * guards to `page.tsx`. Pure markup: the action, the two option lists and the refusal flag come
 * from the page, so there is still exactly one home for each of them.
 */
export function AddStaffForm({
  action,
  ranks,
  roles,
  err,
}: {
  action: (formData: FormData) => Promise<void>;
  ranks: readonly string[];
  roles: readonly string[];
  /**
   * The page's `?err=` flag, verbatim — **not** a boolean any more (task 027: five reasons, and a
   * boolean cannot name which). It is still only ever a flag: the words are all in `NOTICES` above
   * and nothing from the URL reaches the screen.
   */
  err?: string;
}) {
  const notice = err !== undefined && Object.hasOwn(NOTICES, err) ? BY_FLAG[err] : undefined;
  return (
    <section className="card">
      <h2 className="mb-2 font-medium">เพิ่มพนักงานใหม่</h2>
      <p className="mb-2 text-xs text-neutral-500">
        ใส่ <b>ชื่อที่ใช้จดในชีต</b> ให้ตรงด้วย แล้วกด Sync อีกครั้ง → คาบเก่าที่ค้างอยู่เพราะ
        &quot;ไม่รู้จักเทรนเนอร์&quot; จะถูกจับคู่ให้อัตโนมัติ ไม่ต้องไล่แก้ทีละอัน
      </p>
      {notice && <p className="card-warn mb-2 text-sm">⚠️ {notice}</p>}
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
