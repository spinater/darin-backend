---
type: contract
title: Sync progress stream
description: The NDJSON protocol between POST /api/sync and the browser — three event phases, why it is a route rather than a server action, and the headers that stop proxies from buffering it.
tags: [ndjson, streaming, progress, api]
sources:
  - app/api/sync/route.ts
  - app/sync/sync-runner.tsx
  - lib/duration.ts
  - lib/job-timing.ts
verified:
  - by: claude-code/opus-5
    at: 2026-07-29
---

# Sync progress stream

The only API route in the app. A sync takes roughly ten seconds, and a server action can answer
only once — so this streams newline-delimited JSON instead, letting the page show real progress.
The event type is declared in `lib/sync.ts` so producer and consumer cannot drift.

## Covers

| File | Role |
| --- | --- |
| `app/api/sync/route.ts` | `POST /api/sync` — auth, the `ReadableStream`, `SyncRun` bookkeeping |
| `app/sync/sync-runner.tsx` | the client component that reads the stream and renders progress |
| `lib/job-timing.ts` | `timed()` — records how long a slow job took, into `JobDuration` |
| `lib/duration.ts` | `thaiDuration(ms)` — "9 วินาที" / "1 นาที 5 วินาที" |

## The wire format

One JSON object per line. Three phases (`SyncEvent` in `lib/sync.ts`):

| Phase | Payload |
| --- | --- |
| `fetch` | `{ phase, done: 0, total: 0, elapsedMs }` — downloading; no percentage is knowable |
| `process` | `{ phase, sheetName, sheetIndex, sheetCount, done, total, elapsedMs }` |
| `done` | `{ phase, results, elapsedMs, fetchMs, processMs }` |
| `error` | `{ phase, message, elapsedMs }` |

## Invariants & gotchas

- **`Cache-Control: no-transform` and `X-Accel-Buffering: no` are load-bearing.** Without them nginx
  and Cloudflare buffer the whole response and every line arrives at once at the end — the feature
  silently stops working while still "passing". If you ever see the progress bar jump straight to
  100%, check these two headers first.
- **The route returns `403` JSON rather than redirecting.** `requireAdmin()` redirects, which is
  meaningless to a `fetch()` caller. This is deliberate and commented in the file.
- **The first `process` event marks the end of the fetch phase** — that is how `fetchMs` is derived,
  on both sides. There is no explicit "fetch finished" event.
- **The client runs its own 250 ms clock** instead of waiting for events. Nothing is emitted during
  the fetch phase, so an event-driven timer would freeze and look like a hang.
- **A stream that ends without `done` or `error` is treated as a failure.** Otherwise a server that
  dies mid-run leaves the spinner turning forever with nothing behind it.
- **The remaining-time estimate is measured, never assumed.** During `process` it extrapolates from
  this run's actual rate; during `fetch` it falls back to the previous run's `fetchMs`, and shows
  nothing at all if there has never been a successful run. The same principle drives `timed()` →
  `JobDuration` → `<ActionProgress>` elsewhere.
- **The form keeps a no-JS `fallbackAction`.** With JavaScript, `onSubmit` prevents the default and
  streams; without it, the plain server action still runs — the button is never dead.
- **A failed run is still recorded** in `SyncRun` with its `error`, but must not feed the time
  estimate.
- `router.refresh()` after `done` is required — the summary table below is a server component and
  will not otherwise show the new numbers.
- **Never wrap `redirect()` in `timed()`** — Next signals redirects by throwing, so the wrapper would
  record a meaningless duration.

## Read next

- What the stream is reporting on — [domain/sheet-sync.md](../domain/sheet-sync.md)
- The page that hosts it — [app/pages-sync.md](../app/pages-sync.md)
- Driving it by hand — [.claude/skills/verify/SKILL.md](../../skills/verify/SKILL.md)
- Where `SyncRun` / `JobDuration` live — [data/schema.md](../data/schema.md)
