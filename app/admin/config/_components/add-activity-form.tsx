import { SubmitButton } from "@/app/_components/submit-button";

/**
 * The flag `addActivity` redirects with when it refuses. Exported so the page names the refusal
 * through this constant rather than re-typing the string into a template literal — one home for
 * one decision (§4), the same reason `NewStaffRefusal` is a type and not a set of loose strings.
 */
export const ACTIVITY_EMPTY = "activityEmpty";

/**
 * The second flag: the name is already there. It exists because task 036 turned the write into a
 * `create` against a `@unique name` — the old `upsert … update: {}` reported **nothing** either way,
 * which is the silent-refusal shape tasks 027 and 034 already removed from the two actions beside this
 * one. Both of the action's guards redirect with this one flag, and deliberately so: the admin's
 * question is "is it there or not", and a pre-check hit and a lost `P2002` race are the same answer.
 */
export const ACTIVITY_DUP = "activityDup";

/**
 * "เพิ่มกิจกรรมใหม่" — the form and the two refusals it can report, co-located under the §4 split
 * pattern the way `add-staff-form.tsx` is.
 *
 * 🔑 **Why it says anything at all (task 034).** The action used to refuse an empty name with a
 * bare `if (!activity) return;`: the page revalidated, the box cleared, and nothing on screen said
 * the activity had not been added — the exact silent refusal task 027 removed from `addStaff` one
 * screen over. The box is `required` in the markup, so the reachable way to fail it is whitespace
 * only, and the copy therefore has to make sense to someone looking at a box that is **not** empty.
 *
 * The `err` query param stays a **flag, never the message** (`save-notice.tsx` precedent): the Thai
 * lives here and nothing the URL carries is rendered, so a crafted link cannot put words on an
 * admin's screen. With two refusals to report the test is still **two `===` comparisons and not a
 * lookup table** — that is what keeps the `Object.hasOwn` question its two neighbours have to answer
 * from reappearing here (task 027). That matters because `/admin/config` has a single `?err=` slot
 * shared by every action on the page, so the flag standing in the address bar is usually one this
 * form knows nothing about.
 *
 * 🔑 **What "เพิ่ม" now does, because the copy has to match it (task 036):** it registers the *name*
 * and no rate. So the honest thing to say after a successful add is where to go next — the three
 * boxes read `ยังไม่ตั้ง` and the activity's คาบ warn on the slip until somebody prices them. It used
 * to write `0` into all three ranks, which read as "priced at 0 ฿" to both the screen and the engine.
 */
export function AddActivityForm({
  action,
  err,
}: {
  action: (formData: FormData) => Promise<void>;
  /** The page's `?err=` flag, verbatim — compared, never rendered. */
  err?: string;
}) {
  return (
    <section className="card">
      <h2 className="mb-2 font-medium">เพิ่มกิจกรรมใหม่</h2>
      {err === ACTIVITY_EMPTY && (
        <p className="card-warn mb-2 text-sm">
          ⚠️ ชื่อกิจกรรมมีแต่เว้นวรรค ไม่มีตัวอักษรเลย — <b>ยังไม่ได้เพิ่มกิจกรรมนี้</b>{" "}
          พิมพ์ชื่อกิจกรรมลงไปแล้วกดเพิ่มอีกครั้ง
        </p>
      )}
      {err === ACTIVITY_DUP && (
        <p className="card-warn mb-2 text-sm">
          ⚠️ มีกิจกรรมชื่อนี้อยู่แล้ว — <b>ยังไม่ได้เพิ่มอะไรใหม่ และไม่มีเรทไหนถูกแก้</b>{" "}
          ดูแถวของกิจกรรมนี้ในตารางเรทค่าสอนด้านบน (ตัวพิมพ์เล็ก-ใหญ่ถือว่าเป็นคนละชื่อ)
        </p>
      )}
      <form action={action} className="flex gap-2">
        <input name="activity" placeholder="เช่น boxing" className="input" required />
        <SubmitButton className="btn-ghost" pendingLabel="กำลังเพิ่ม…">
          เพิ่ม
        </SubmitButton>
      </form>
      <p className="mt-2 text-xs text-neutral-500">
        เพิ่มแล้วจะได้ <b>ชื่อกิจกรรม</b> ในตารางเรทค่าสอน โดยยัง <b>ไม่มีเรท</b> (ขึ้นว่า
        “ยังไม่ตั้ง”) — คาบสอนของกิจกรรมนี้จะยังไม่ถูกคิดเงินและขึ้นเตือนในสลิป
        จนใส่เรทแล้วกดบันทึกทั้งหมด
      </p>
    </section>
  );
}
