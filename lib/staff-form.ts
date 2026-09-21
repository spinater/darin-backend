import { finiteNumber, isBlank, INT_COLUMN_MAX } from "./form-number";
import { MIN_PASSWORD_LEN } from "./password";

/**
 * Why "เพิ่มพนักงานใหม่" did not add anybody — a **closed set**, so it is safe to carry in the URL
 * (`?err=<kind>`) and the screen can map every member of it to Thai with no branch left unwritten.
 *
 * - **`newstaff` keeps its spelling on purpose.** It is the flag task 013 item 4 shipped for the
 *   two money fields: it is in `add-staff-form.tsx`, in URLs admins already have, and in the table
 *   in `.docs/knowledge/domain/form-refusals.md` (that table was `money-input-guards.md`'s until the
 *   ใบ 068 split). Renaming it buys nothing and invalidates
 *   that row.
 * - **`newstaffDup` is the one arm this parse can never return.** `Staff.username` is `@unique`, so
 *   a duplicate is decided by the database at the `create` and not by reading the form: the action
 *   catches Prisma's `P2002` and redirects with this flag. It belongs to the same set anyway,
 *   because the admin sees **one** notice area with five reasons, not two surfaces with one rule
 *   each.
 */
export type NewStaffRefusal =
  "newstaff" | "newstaffName" | "newstaffUser" | "newstaffPass" | "newstaffDup";

/** What the action needs from the form once every refusal has been decided. */
export type NewStaffValues = {
  name: string;
  username: string;
  /** As posted — **not** trimmed. See `parseNewStaff`. */
  password: string;
  baseSalary: number;
  classCredit: number;
};

export type NewStaff = { ok: true; values: NewStaffValues } | { ok: false; kind: NewStaffRefusal };

/**
 * A form field as text — never `String(raw)`.
 *
 * Any multipart body can post a `File` part, and `String(new File([], "x.bin"))` is
 * `"[object File]"`, which is **truthy and survives `.trim()`** ⇒ the old
 * `String(formData.get("name") ?? "")` would have created a staff member literally named
 * `[object File]`. `lib/form-number.ts` draws this same line for numbers: a `File` was *given* and
 * is unreadable, so it is refused rather than quietly taken as a value. Here "unreadable" and
 * "empty" want the same answer — refuse, naming the field — which is why one line is enough.
 */
function text(raw: FormDataEntryValue | null): string {
  return typeof raw === "string" ? raw : "";
}

/**
 * Read the "เพิ่มพนักงานใหม่" form, deciding every refusal **before** the action writes anything.
 *
 * 🔴 **Why this is a module and not three lines in the action.** `addStaff` opened with
 * `if (!name || !username || password.length < MIN_PASSWORD_LEN) return;` — and a bare `return`
 * from a server action revalidates the page, clears the form and says **nothing**. The admin's next
 * move is to hunt for the person in the staff list and wonder, or not look at all. §2 rule 4 is
 * written about money, but this is the same shape: what the code refused has to reach the screen.
 * Five outcomes instead of one is real logic ⇒ it follows `lib/config-form.ts` out of `page.tsx`
 * (§4's split pattern for a page under `app/` sends logic to `lib/`) and is tested.
 *
 * 🔑 **The order is part of the contract** — name → username → password → the two money fields,
 * first refusal wins, and the tests pin it. Two bad fields always report the same one, so an admin
 * who fixes what the notice names and resubmits makes progress instead of watching one notice
 * bounce between fields.
 *
 * ⚠️ `name` and `username` are `required` in the markup, so the reachable way to refuse them is
 * **whitespace only** (`"   "` → `.trim()` → `""`) — the copy on the screen is worded for someone
 * looking at a box that is not empty.
 *
 * **The money arm is unchanged from task 013 item 4, deliberately.** Blank keeps the documented
 * default of 0; a field that was filled in and cannot be read is `newstaff`, never a 0. Those two
 * figures are this person's `net` in every future run — this change is about *reporting* a refusal,
 * not about moving what gets refused.
 *
 * Pure — no DB, no `hashPassword`, no clock. `role`, `rank` and `sheetName` stay with the action:
 * they are not part of this parse.
 */
export function parseNewStaff(formData: FormData): NewStaff {
  const name = text(formData.get("name")).trim();
  if (name === "") return { ok: false, kind: "newstaffName" };

  const username = text(formData.get("username")).trim();
  if (username === "") return { ok: false, kind: "newstaffUser" };

  // ⚠️ **Not trimmed, and that is not an oversight.** A password may legitimately begin or end with
  // a space; trimming here would hash something other than what the admin typed and then handed to
  // the staff member, who would fail to log in with the password they were given. `verifyPassword`
  // compares the bytes as posted, so this must read them the same way.
  const password = text(formData.get("password"));
  if (password.length < MIN_PASSWORD_LEN) return { ok: false, kind: "newstaffPass" };

  // 🔴 These two become this person's `net` on **every future run**, so an unreadable one refuses
  // the whole add instead of creating a staff record around a `NaN` that nobody looks at again.
  // A field left blank keeps the documented default of 0 — the same answer `?? 0` gave before —
  // but a field that was filled in and cannot be read is a rejection, not a 0.
  // Same `Int`-column rules the bulk form applies to these two columns (`lib/config-form.ts`):
  // a fraction is **truncated** by Prisma rather than refused (`15000.5` → `15000`), and an
  // overflow throws at the write.
  const INT_COLUMN = { int: true, max: INT_COLUMN_MAX };
  const baseRaw = formData.get("baseSalary");
  const creditRaw = formData.get("classCredit");
  const baseSalary = isBlank(baseRaw) ? 0 : finiteNumber(baseRaw, INT_COLUMN);
  const classCredit = isBlank(creditRaw) ? 0 : finiteNumber(creditRaw, INT_COLUMN);
  if (baseSalary === null || classCredit === null) return { ok: false, kind: "newstaff" };

  return { ok: true, values: { name, username, password, baseSalary, classCredit } };
}
