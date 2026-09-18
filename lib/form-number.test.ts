import { expect, test, describe } from "bun:test";
import { finiteNumber, isBlank, INT_COLUMN_MAX } from "./form-number";

// `formData.get()` returns `string | File | null`, so the tests feed exactly those three shapes —
// a mocked FormData would add a fixture and pin nothing extra (§7: the expensive unit is the
// fixture, not the assertion).

describe("finiteNumber (task 013 item 4)", () => {
  test("a number that was really typed comes back, trimmed", () => {
    expect(finiteNumber("12.5")).toBe(12.5);
    expect(finiteNumber(" 7 ")).toBe(7);
    // Zero is a real answer when somebody typed it — only an *undecided* field is refused.
    expect(finiteNumber("0")).toBe(0);
  });

  test("an absent field is null, NEVER 0 — the silent overwrite this helper exists for", () => {
    expect(finiteNumber(null)).toBeNull();
  });

  test("a File part is null, never NaN", () => {
    expect(finiteNumber(new File([], "payload.bin"))).toBeNull();
  });

  test('blank and whitespace-only are null, not the 0 that `Number("")` gives', () => {
    expect(finiteNumber("")).toBeNull();
    expect(finiteNumber("   ")).toBeNull();
  });

  test("text that is not a number is null", () => {
    expect(finiteNumber("abc")).toBeNull();
    expect(finiteNumber("แปด")).toBeNull();
    expect(finiteNumber("12.5 ชม.")).toBeNull();
  });

  test("overflow and the literal spellings of non-finite are null", () => {
    // `"1e999"` is the cheap one to send and the expensive one to store: `Float` is
    // `double precision`, which accepts both `Infinity` and `NaN`.
    expect(finiteNumber("1e999")).toBeNull();
    expect(finiteNumber("Infinity")).toBeNull();
    expect(finiteNumber("-Infinity")).toBeNull();
    expect(finiteNumber("NaN")).toBeNull();
  });

  test("a negative finite value is refused by the default floor of 0", () => {
    // The `/ot` case the card names: `-5` stores, and `Math.max(0, -5 - threshold)` pays nothing.
    expect(finiteNumber("-5")).toBeNull();
    expect(finiteNumber("-0.25")).toBeNull();
  });

  test("🔴 `int` refuses a fraction — Postgres `integer` TRUNCATES it, it does not refuse", () => {
    // Measured on a throwaway postgres with this schema: 1200.5 → **1200**, 1201.5 → **1201**,
    // 2.5 → 2, 15000.5 → 15000 and **0.4 → 0**. The 1201.5 and 0.4 rows are the ones that name the
    // mechanism — truncation toward zero, not rounding — and 0.4 is the worst of them: a price
    // somebody typed becomes free. Nothing fails and nothing is said, so the guard has to be here.
    expect(finiteNumber("2.5", { int: true })).toBeNull();
    expect(finiteNumber("1200.50", { int: true })).toBeNull();
    expect(finiteNumber("0.4", { int: true })).toBeNull();
    expect(finiteNumber("15000", { int: true })).toBe(15000);
    // Without `int` a fraction is still legal — `OtEntry.hours` is a `Float` and 9.5 h is real.
    expect(finiteNumber("9.5")).toBe(9.5);
  });

  test("`max` refuses here what the column would throw about at the write", () => {
    // A `type="number"` input carries no `max`, so an overflow used to parse fine, let every write
    // ahead of it commit, and then throw "Value out of range" mid-loop.
    expect(finiteNumber("99999999999", { int: true, max: INT_COLUMN_MAX })).toBeNull();
    expect(finiteNumber(String(INT_COLUMN_MAX), { int: true, max: INT_COLUMN_MAX })).toBe(
      INT_COLUMN_MAX,
    );
    expect(INT_COLUMN_MAX).toBe(2_147_483_647);
  });

  test("the three options are independent — each refuses on its own", () => {
    expect(finiteNumber("0", { min: 1 })).toBeNull();
    expect(finiteNumber("1", { min: 1 })).toBe(1);
    expect(finiteNumber("-5", { min: -10 })).toBe(-5);
    // A fraction inside the range still fails `int`; an integer outside it still fails `max`.
    expect(finiteNumber("2.5", { int: true, max: 10 })).toBeNull();
    expect(finiteNumber("11", { int: true, max: 10 })).toBeNull();
    expect(finiteNumber("10", { int: true, max: 10 })).toBe(10);
  });
});

describe("isBlank (task 013 item 4)", () => {
  test("absent and empty are the same 'not given'", () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank("")).toBe(true);
    expect(isBlank("   ")).toBe(true);
  });

  test("🔴 a File part is GIVEN, not blank — it must be refused, never defaulted", () => {
    // The whole reason this is a function: `String(file ?? "")` is `"[object File]"`, which is
    // truthy, so the old spelling called it "given" and then `Number()`d it into `NaN`. Calling it
    // *blank* instead would be the opposite failure — an unreadable field silently taking the
    // documented default for an empty one.
    expect(isBlank(new File([], "payload.bin"))).toBe(false);
  });

  test("a value that is not a number is still a value — refusing it is finiteNumber's job", () => {
    expect(isBlank("abc")).toBe(false);
    expect(isBlank("0")).toBe(false);
  });
});
