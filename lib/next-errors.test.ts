import { expect, test, describe } from "bun:test";
import { isNextControlFlowError } from "./next-errors";

/** What Next actually throws — an `Error` carrying a `digest` string. */
function thrown(digest: unknown) {
  return Object.assign(new Error("NEXT_REDIRECT"), { digest });
}

describe("isNextControlFlowError (task 009)", () => {
  test("redirect() is a control-flow signal, not a failure", () => {
    expect(isNextControlFlowError(thrown("NEXT_REDIRECT;replace;/ot;307;"))).toBe(true);
  });

  test("notFound() is recognised under its current marker spelling", () => {
    expect(isNextControlFlowError(thrown("NEXT_HTTP_ERROR_FALLBACK;404"))).toBe(true);
  });

  test("a plain application error is not a signal — it must still be caught and reported", () => {
    expect(isNextControlFlowError(new Error("Invalid `prisma.otEntry.upsert()` invocation"))).toBe(
      false,
    );
  });

  test("React's own numeric error digest is not a Next signal", () => {
    expect(isNextControlFlowError(thrown("1234567890"))).toBe(false);
  });

  test("a non-string digest never counts — no `.startsWith` on a number", () => {
    expect(isNextControlFlowError(thrown(404))).toBe(false);
  });

  test("null and non-objects are safe to ask about", () => {
    expect(isNextControlFlowError(null)).toBe(false);
    expect(isNextControlFlowError(undefined)).toBe(false);
    expect(isNextControlFlowError("NEXT_REDIRECT")).toBe(false);
  });
});
