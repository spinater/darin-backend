# A missing config key is loud in the log and silent in Thai — there is no `error.tsx` anywhere

- status: todo
- commit:

## Goal

`find app -name "error.tsx" -o -name "global-error.tsx" -o -name "not-found.tsx"` returns **nothing**.
`app/loading.tsx` exists and covers §2 rule 9; there is no equivalent for the failure direction.

So when `num()` throws — which is the behaviour §2 rule 3 asks for and which task 009 gave `/ot` and
task 011 gave `/classes` — production renders Next's generic English "Application error: a
server-side exception has occurred", and the Thai message that names the key
(`ไม่พบ config: class.minAttendees`, `lib/config-keys.ts:32`) reaches the **server log only**.

Both review lanes raised this independently during the task 011 review and both ruled it out of that
diff's scope.

## Why it is worth its own card

The rule it half-satisfies is §2 rule 4 — what the system cannot decide must reach the screen. Today
the failure *is* loud (nothing is invented, nothing becomes a silent zero), which is the expensive
half. What is missing is that it is not **informative**: the person looking at the screen is a
counter staffer at Darin, and "Application error: a server-side exception has occurred" tells them
neither what broke nor who can fix it, in a language the product otherwise never uses.

The reach grew on 2026-09-18. Before task 011, `/classes` invented `?? 3` / `?? 0.5` and never threw;
now it throws exactly as `/ot` does. Closing the rule-3 hole moved the cost onto this one.

## Scope

1. **An `app/error.tsx`** (client component, per App Router) with Thai copy: what happened, that
   nothing was saved, and what to do — for a config failure that is "ตั้งค่าที่ `/admin/config` ยังไม่ครบ",
   with the key named if it can be surfaced safely.
   ⚠️ A production build **redacts** server-error messages before they reach the client `error`
   boundary (the same redaction `app/ot/page.tsx:139-141` already documents for server actions), so
   decide deliberately whether the key is passed through a typed thrown value or whether the copy
   stays generic and points at `/admin/config`. Do not assume `error.message` will arrive.
2. **A `not-found.tsx`** while the file is open — same reasoning, much smaller.
3. Decide whether a **route-level** boundary is wanted anywhere (`app/classes/error.tsx`,
   `app/ot/error.tsx`) or whether one root boundary is enough for a one-branch product.

## How to reach it, for whoever tests this

Not trivially: `/admin/config` can only `update` config rows, never delete them, so an actual missing
key needs a direct DB edit or a partial seed. Use a throwaway Postgres (the same lane
`scripts/check-code.sh` uses) rather than the dev database.

## Notes

- Found by `code-reviewer` and `payroll-auditor` during the task 011 review, both as an operational
  note rather than a finding on that diff.
- Related: [task 019](019-dashboard-sums-baht-in-a-page.md) came out of the same review round.
- Design input worth buying before writing the copy: `microcopy-writer` for the Thai, and
  `uxui-designer` if the boundary gets any layout beyond a `.card-error` block.
