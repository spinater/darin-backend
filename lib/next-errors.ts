/**
 * Telling a Next.js control-flow signal apart from a real error.
 *
 * 🔴 `redirect()`, `notFound()` and friends signal by **throwing**. A `catch` that turns every
 * error into a message therefore swallows the navigation and renders the marker string
 * (`NEXT_REDIRECT;replace;/ot;…`) on the screen as if it were a failure the user caused — a
 * server action that reports its own failure instead of throwing (task 009, `/ot`) must let these
 * back out.
 *
 * Every signal that can reach this catch carries a string `digest` beginning with `NEXT_`; an
 * application error does not, and React's own error digests are numeric. (Not every Next-internal
 * signal is spelled that way — `DYNAMIC_SERVER_USAGE` and `BAILOUT_TO_CLIENT_SIDE_RENDERING` are
 * not — but neither is thrown by a server action's own body, so neither reaches the guarded
 * block.) Matching the prefix rather than one exact
 * marker is deliberate: Next renames markers between majors (`NEXT_NOT_FOUND` became
 * `NEXT_HTTP_ERROR_FALLBACK;404`), and a check pinned to the old spelling would start swallowing
 * navigation **silently**, which is the direction nobody notices.
 */
export function isNextControlFlowError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const digest = (e as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}
