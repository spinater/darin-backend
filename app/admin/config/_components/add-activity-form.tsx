import { SubmitButton } from "@/app/_components/submit-button";

/**
 * The flag `addActivity` redirects with when it refuses. Exported so the page names the refusal
 * through this constant rather than re-typing the string into a template literal — one home for
 * one decision (§4), the same reason `NewStaffRefusal` is a type and not a set of loose strings.
 */
export const ACTIVITY_EMPTY = "activityEmpty";

/**
 * "เพิ่มกิจกรรมใหม่" — the form and the one refusal it can report, co-located under the §4 split
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
 * admin's screen. With one refusal to report the test is a string comparison — there is no lookup
 * table here, so the `Object.hasOwn` guard its two neighbours need has nothing to guard. That
 * matters because `/admin/config` has a single `?err=` slot shared by every action on the page, so
 * the flag standing in the address bar is usually one this form knows nothing about.
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
      <form action={action} className="flex gap-2">
        <input name="activity" placeholder="เช่น boxing" className="input" required />
        <SubmitButton className="btn-ghost" pendingLabel="กำลังเพิ่ม…">
          เพิ่ม
        </SubmitButton>
      </form>
    </section>
  );
}
