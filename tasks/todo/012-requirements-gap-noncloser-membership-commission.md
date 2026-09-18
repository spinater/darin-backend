# The payslip now shows a warning that cites a section saying something else

- status: todo
- commit:

## Goal

`lib/payroll.ts:181` emits
`… ยังไม่มีกฎคอมสำหรับบทบาท "${role}" ในการขายสมาชิก (§7 ข้อ 8) — ยังไม่จ่าย`.

`REQUIREMENTS.md` §7 item 8 is **"ต่ออายุ/walk-in/สินค้าหน้าร้าน — เรทคอม TBD"**, a different
question. `darin-payroll-system.md` §7 has only three items. The gap itself is genuinely open —
§2.2 and §3's table name only Counter/Sales as a commission recipient and give no rule for a
`referrer` on a membership bill — so **routing it to `warnings[]` is correct and must stay**
(§2 rule 4). What is wrong is only the citation.

Until task 009 shipped, the string went nowhere and the mis-citation cost nothing. Now the owner
reads it on a payslip, looks up §7 ข้อ 8, and finds an unrelated question.

## Scope

1. `sa-requirements` first: add an explicit §7 item for "บทบาทที่ไม่ใช่ `closer` ในบิลสมาชิก" —
   the requirement doc is Thai and client-facing (§2.5), so this one is written in Thai.
2. Then `backend-dev`: point the warning string at the new item number. One string.
3. `lib/payroll.test.ts:226` repeats the mis-citation in a comment added by task 009 — fix it in
   the same change. The test count does not move, so no junit pin change.

## Notes

- Found by `payroll-auditor` during the task 009 review (finding 5), ranked Minor.
- Do **not** invent a commission rule to make the warning go away — that is the forbidden move
  named in task 009's own card. This card fixes a pointer, not a policy.
