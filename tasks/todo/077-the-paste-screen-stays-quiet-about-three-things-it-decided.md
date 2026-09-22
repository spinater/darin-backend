# The OT paste screen decides three things without telling the operator

- status: todo
- commit:

## Goal

Task 014 gave `/ot`'s paste three rejection buckets that all reach the screen. Three things the
same code decides are still not on it. None moves a baht today; all three are the shape §2 rule 4
is about — *the engine answered a question nobody knew it was asked*.

## 1. Two lines for one person-day collapse, last wins, with no bullet

`parseOtPaste` dedups by `(staffId, date)` and keeps the last line. A 220-line paste with 3 repeats
reports `นำเข้าแล้ว 217 รายการ` and **nothing names the 3 that merged or the values discarded**.

This is deliberate and tested — it preserves exactly what the pre-014 `upsert`-per-row loop did
silently, and `createMany` would otherwise throw on `@@unique([staffId, date])` and roll back the
whole paste. So it is not a regression. But **"two scans in one day" is a real fingerprint-export
shape**, and which of the two values wins is currently decided by line order with no one told.

Decide: is last-wins right, or should a repeat with a *different* value reach a bucket? (A repeat
with the *same* value is noise and should stay quiet either way.)

## 2. `imported` changed meaning and nothing says so

It is now `rows.length` after dedup, not a count of write operations. `นำเข้าแล้ว 217 รายการ` for a
220-line paste is **truthful** — 217 rows exist — but the operator reading it against the 220 lines
they pasted has no way to account for the 3. Shares its fix with item 1.

## 3. The `unmatched` heading contradicts one of its own bullets

`app/ot/_components/paste-form.tsx` — the heading reads `พบชื่อผู้ใช้ที่ไม่มีในระบบ` ("a username not
in the system") while one bullet in that same box is `(บรรทัดไม่มีชื่อผู้ใช้)` ("a line with no
username"). Those are different problems with different fixes, sharing one box because they share a
dedup key. Either the heading names both, or the nameless line gets its own box.
⇒ a `microcopy-writer` / `uxui-designer` pass, not a guess at the keyboard.

## Also worth doing here — a latent §2 rule 4 hole

`code-reviewer` traced why `byUsername.get("")` is safe today: `Staff.username` is non-null
`@unique`, `lib/staff-form.ts` refuses a blank username after `trim()`, the seed usernames are
non-empty, and **no action anywhere updates `username`**. So a nameless line misses the map and gets
its bullet.

That safety lives in a different file and depends on an invariant nobody restates here. If a blank
username ever became creatable, `,,176` would be **attributed to that staff member**, land in `rows`,
and report nothing. The fix makes `parseOtPaste` independent of the distant invariant — refuse the
empty key *before* the map lookup:

```ts
const key = otUsernameKey(user ?? "");
if (!key) { /* nameless line: bullet + continue, before the map lookup */ }
```

## Notes

- Items 1 and 2 found by `code-reviewer`, the hardening too, both in the task 014 round-2 review.
- Item 3 is a copy problem on a box task 014 built; the §9 lanes for it are call-by-hand.
- Related: [014](014-ot-import-atomicity.md) · [076](076-a-decimal-comma-export-pays-twenty-baht-short-in-silence.md).
