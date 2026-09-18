# The gym web-app spec (v0.3) versus this payroll system — what overlaps, what is new

- status: todo-human
- commit:

- 🚫 **Blocked on linus:** he uploaded `darin-fitness-requirements.md` v0.3 (a customer-facing gym
  app: POS + realtime class booking + trainer log) and asked which functions would be new. The
  analysis below answers that. What an agent cannot answer is the product question underneath it:
  **is that app a second product beside this one, or is it eventually the source that replaces the
  Google Sheet this payroll engine reads?** Every row in §1 below is priced differently depending on
  which, and the answer decides whether the same fact gets keyed twice.

## What was compared

`/home/linus/.claude-lim/uploads/…/89efd086-darin-fitness-requirements.md` (v0.3, living draft)
against `REQUIREMENTS.md`, `prisma/schema.prisma`, `app/**` and `lib/**` in this repo, by
`sa-requirements` on 2026-09-18.

**They are two products for the same gym.** This repo is a **staff-facing payroll engine** that turns
a hand-kept Google Sheet into pay. The uploaded document specs a **customer-facing gym app**, and its
§9 picks a different frontend (Nuxt 4) from what is built here (Next.js 16 App Router on Bun). So the
useful answer is not a list of missing features — it is where the two touch the same real-world fact.

## 1. Overlap — the same fact under two names

| Doc entity (§) | Here | The shared fact | What breaks if both exist |
|---|---|---|---|
| `transactions` (§4.3, §8) | `Sale` + `SaleAttribution` | one sale | The doc's `transactions` carries a single `staff_id` and **no closer / referrer / content-owner split**. The commission engine needs exactly that split (`comm.pt.*`, `comm.membership.*`). ⇒ either the doc's schema grows attribution roles, or `/sales` stays hand-keyed on top of it and one sale has two records. |
| `classes` · `class_schedules` · `class_sessions` · `bookings` (§5, §8) | `ClassPrice` + `ClassSession` | a class instance and who attended | `bookings` would make `booked`/`noShow` **derivable** instead of hand-keyed — a real gain. But the pay multiplier (0 / ×`class.halfRatio` / ×1 by attendee count, REQUIREMENTS.md §1.4) is payroll-only and has no counterpart in the doc. |
| `training_sessions` · `training_session_members` · `training_session_items` (§5.4, §6.2, §8) | `TeachSession` | a trainer teaching someone on a date | **The big one.** If Module C becomes the trainer's real logging tool it could retire the sheet sync (`lib/sheets.ts`, `lib/parser.ts`, `TrainerAlias`, `SheetSource`) — the piece REQUIREMENTS.md §1.6 calls *"ความเสี่ยงสูงสุดของงานนี้"*. But `TeachSession` today has **no credit concept and no many-members-per-session model**, so §5.4's pooled PT hours have zero representation here. Ship it there first and the two disagree on "how many sessions did this trainer teach today". |
| `users` · `trainers` · `members` (§8) | `Staff` (`owner`/`admin`/`counter`/`trainer`) | who people are | **No customer account exists anywhere in this codebase.** |
| `packages` · `member_packages` (§4.1, §8) | `Sale.kind` / `tier` / `productName` (free text) | what the customer bought | Not really the same problem: the doc needs a **stateful credit ledger** (`credits_remaining`, `expires_at`); `Sale` is a **snapshot for commission math**, never re-read for a balance. Only if package data starts feeding payroll do `kind`/`tier` need mapping rules. |

## 2. Genuinely new — nothing here does any of it

**Module A (POS):** customer profiles · package catalog with credit type and expiry · credit
deduction / check-in · balance and expiry view · purchase-and-usage timeline · revenue report by
package type and payment method · **the transfer-slip approval flow** (self-service upload →
Pending → Approve/Void with an audit trail) · coupons · multi-branch · auto-creating a trainee in
Module C when a PT package is approved.

**Module B (booking):** weekly recurring schedule with zone, capacity and trainer · realtime booking
with an **atomic capacity check** against overbooking · cancellation and credit-return policy ·
check-in UI · group PT / semi-private with pooled hours (§5.4).

**Module C (trainer log):** exercise library with video · per-session sets/reps/weight/time · body
metrics with graphs and InBody import · weekly programs the trainee ticks off · then Phase 2–3: chat,
homework, leaderboard, food log, MET calories, PWA, i18n, themes, LINE/push.

Only two of these touch payroll at all, and neither touches `lib/payroll*.ts` today: the slip
approval gates **gym revenue** (not staff pay), and §5.4's pooled hours would change **what payroll
consumes** (see §1 and §4).

## 3. Already built here — do not rebuild it in the new app

- Role-based access with a guard on every route (`Staff.role`, `middleware.ts`, REQUIREMENTS.md §6).
- The doc's §3 privacy rule — *"เทรนเนอร์ต้องเห็นได้เฉพาะลูกเทรนที่ถูก assign ให้เท่านั้น"* — already
  has its payroll-side counterpart: `/me` shows a trainer their own hours and never money.
- Auth: session cookie + argon2id `Staff.passwordHash` (`lib/auth.ts`, `lib/password.ts`).
- **The whole commission engine**: closer vs referrer vs content-owner, self-closed vs lead-sourced,
  promo vs full tier, the month-total incentive threshold and its retroactive rate. The doc has **no
  concept of trainer compensation at all** — Module C supplies session *facts*, never rates.
- The attendance → pay multiplier for group classes.

## 4. Decisions the doc leaves open that this repo already made

| Topic | Doc | Here |
|---|---|---|
| Frontend | §9 Nuxt 4, to merge onto the ops/marketing base | Next.js 16 App Router on Bun (CLAUDE.md §1) |
| Auth | §9 "session/JWT", an either/or | decided: session cookie + hashed password |
| Branches | `branch_id` on nearly every table (§4.4, §8), and §11 Q11 asks how many there are | single-branch by design — no branch concept in the schema |
| Roles | Owner / Staff / Trainer / **Member** | no customer-facing account exists |
| Subscriptions | §11 Q9 asks whether recurring billing is real | no subscription concept at all |

## 5. 🔑 One open question is the **same** question on both sides

The doc's §11 Q13 — *"การหักเครดิตเมื่อยุบชั่วโมง — เพื่อนเทรนด้วยกัน หักคนละ 1 ชม. เท่ากันทุกคนใช่ไหม
หรือมีสูตรอื่น (เช่น เจ้าของชั่วโมงจ่าย เพื่อนมาฟรี)?"* — is the customer-credit side of a question
this repo has had open since day one, in REQUIREMENTS.md §7 item 5: *"`PT มิกซ์` คือใคร? — สอน 2 คน?
แบ่งเงินยังไง?"* (the token appears once in the raw sheet and nothing resolves it — checked
`lib/parser.ts`, `app/admin/config/page.tsx` and every card).

One is "how many credits come off each customer", the other is "how much does the trainer get paid
for that one hour". **Ask him both at once** — and note the doc marks §5.4 as *"✅ เคลียร์แล้ว"*,
which cleared the *feature*, not the *money rule*.

## Notes

- The doc's §11 numbering skips 8 and 12. It is a live draft, not a lost requirement — named here so
  nobody silently renumbers it.
- Related cards: [012](../todo/012-requirements-gap-noncloser-membership-commission.md) is the other
  requirements gap; [021](021-leaver-base-salary-proration.md) and task 013 item 2 are the two money
  policies also waiting on him.
