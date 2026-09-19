# `/account` puts URL text on the screen, and reads a `File` part as a password

- status: todo
- commit:

## Goal

Two defects in one small file, found by `code-reviewer` while reviewing
[task 027](../done/027-addstaff-fails-silently.md) (2026-09-19). Neither is task 027's, and both are in
`app/account/page.tsx`.

### 1. The `?err=` value is rendered verbatim — the one live counterexample to a repo-wide rule

`app/account/page.tsx:83` is `{err && <p className="card-error text-sm">{err}</p>}`, and the actions
put the **message itself** in the URL (`:38` `redirect(\`/account?err=รหัสใหม่ต้องยาวอย่างน้อย ${MIN_LEN} ตัว\`)`,
`:39`, `:43`, `:65-67`). `?msg=` at `:82` is the same.

That is the exact opposite of the rule three other screens state and that **three doc-comments
written in task 027 cite as if it held everywhere**:

> the `err` query param is a **flag**, never the message … nothing the URL carries is rendered, so
> a crafted link cannot put words on an admin's screen
> — `app/admin/config/_components/save-notice.tsx`

So `https://darin.rocketlabth.com/account?err=<anything>` renders `<anything>` in a red card, to a
logged-in staff member, on a page that is otherwise about their password. Whatever a crafted link
says there is read as the system speaking. React escapes the value, so this is **not** XSS — it is
attacker-chosen *text* in the product's own voice, which is the whole thing the rule exists to stop.

### 2. `"[object File]"` is 13 characters and `MIN_PASSWORD_LEN` is 12

`changeOwn` (`:35-37`) and `resetOther` (`:65-67`) read every password field with
`String(formData.get(…) ?? "")`. A multipart body may post any field as a `File`, and
`String(new File([], "x"))` is `"[object File]"` — **13 characters, so it clears the length check**,
and in `changeOwn` it also defeats `next !== confirm`, because both sides stringify to the same
thing. The account's `passwordHash` then becomes the hash of a literal everybody knows.

🔑 **Be honest about the severity, or this card will be over-built.** Neither path is an escalation:
`changeOwn` needs the victim's *current* password first, and `resetOther` is behind admin, who can
set any password anyway. The reason it is worth fixing is that it is the **same hole task 027 just
closed one screen over** — `lib/staff-form.ts`'s `text()` — and `/account` is the only other place
in the repo where a password is read off a form. One shape, two homes.

## Scope

- Move both reads onto the same `File`-safe shape task 027 established. `text()` currently lives
  inside `lib/staff-form.ts`; if it is used by a second caller it needs one home, most likely beside
  `isBlank` in `lib/form-number.ts` — decide that as part of this card, do not copy the function.
- Turn `?err=` / `?msg=` on `/account` into **flags**, with the Thai living in the page or a
  component, like `save-notice.tsx` and `add-staff-form.tsx`. There are five distinct messages
  (`:38` `:39` `:43` `:65-67` and the `?msg=` at `:74`), so this is a closed set.
  ⚠️ **Guard the lookup with `Object.hasOwn`.** A plain `REASONS[err]` walks the prototype chain and
  `?err=__proto__` returns `Object.prototype` — task 027 shipped that fix for the two notices on
  `/admin/config` for exactly this reason; do not re-introduce it here.
- While the file is open: it is the only page reading a password, so whatever shape is chosen should
  read as the obvious one to copy next time.

## Notes

- Found by `code-reviewer` during the task 027 review, as an adjacent finding on a file that diff
  never touched. Not folded into 027 — §6 rule 4, one feature per commit.
- Related: [031](031-role-and-rank-are-unchecked-strings.md) is the third instance of the same
  `String(formData.get(…))` shape, on `role` / `rank` / `sheetName`. Whoever takes either card
  should look at whether the fix is one change or two.
