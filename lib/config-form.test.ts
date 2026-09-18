import { expect, test, describe } from "bun:test";
import { parseConfigNumbers, numericKind } from "./config-form";
import { INT_COLUMN_MAX } from "./form-number";

/** The shape `formData.entries()` yields, without needing a FormData fixture. */
const entries = (o: Record<string, FormDataEntryValue>) => Object.entries(o);

describe("parseConfigNumbers (task 013 item 4)", () => {
  test("every numeric field comes back keyed by its own name", () => {
    const r = parseConfigNumbers(
      entries({
        "cfg|class.halfRatio": "0.5",
        "rate|yoga|PT": "450",
        "class|c1": "1200",
        "staff|s1|baseSalary": "15000",
        "staff|s1|classCredit": "0",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([...r.values]).toEqual([
      ["cfg|class.halfRatio", 0.5],
      ["rate|yoga|PT", 450],
      ["class|c1", 1200],
      ["staff|s1|baseSalary", 15000],
      ["staff|s1|classCredit", 0],
    ]);
  });

  test("the fields that are not numbers are left alone — strings stay strings", () => {
    // `sheet` is a spreadsheet id; `rank` is a <select>. Coercing either would be this gate
    // inventing a rule the form does not have.
    const r = parseConfigNumbers(entries({ "sheet|s1": "1AbC", "staff|s1|rank": "PT" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.size).toBe(0);
  });

  test("a blank rate is kept out of `values` — it is the documented way to delete a rate", () => {
    const r = parseConfigNumbers(entries({ "rate|yoga|PT": "  ", "class|c1": "800" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.has("rate|yoga|PT")).toBe(false);
    expect(r.values.get("class|c1")).toBe(800);
  });

  test("🔴 a blank on any OTHER numeric field is a refusal, never a zero", () => {
    // Blank here would overwrite a real salary with 0, and §2 rule 4 says the undecidable never
    // becomes a zero.
    expect(parseConfigNumbers(entries({ "staff|s1|baseSalary": "" }))).toEqual({
      ok: false,
      kind: "staff",
    });
    expect(parseConfigNumbers(entries({ "class|c1": "" }))).toEqual({ ok: false, kind: "class" });
  });

  test("🔴 a blank `cfg|` value is a refusal — this is the one that paid 0 ฿", () => {
    // These are plain text inputs with no `required`. Measured before the fix: a cleared
    // `comm.pt.selfClosed` paid 0 ฿ instead of 2,000 ฿ on a 20,000 ฿ self-closed bill, a cleared
    // `incentive.threshold` fired §1.6's retroactive 12% for everyone, a cleared `ot.ratePerHour`
    // zeroed OT — all with `warnings: []`.
    expect(parseConfigNumbers(entries({ "cfg|comm.pt.selfClosed": "" }))).toEqual({
      ok: false,
      kind: "cfg",
    });
    expect(parseConfigNumbers(entries({ "cfg|incentive.threshold": "  " }))).toEqual({
      ok: false,
      kind: "cfg",
    });
    expect(parseConfigNumbers(entries({ "cfg|ot.ratePerHour": "-5" }))).toEqual({
      ok: false,
      kind: "cfg",
    });
    expect(parseConfigNumbers(entries({ "cfg|incentive.rate": "1e999" }))).toEqual({
      ok: false,
      kind: "cfg",
    });
  });

  test("a config value may be a fraction; an Int column may not", () => {
    // 🔴 The asymmetry is the whole rule. `class.halfRatio` is 0.5 and lives in a text column, so a
    // fraction is legal. `ClassPrice.price` is `Int`: Postgres does **not** refuse `1200.50` —
    // Prisma truncates it to 1200 and the 50 satang vanish with nothing said. This assertion used
    // to pin `"1200.50"` → `1200.5` as *valid*, which is what let the truncation ship.
    const ok = parseConfigNumbers(entries({ "cfg|class.halfRatio": "0.5" }));
    expect(ok.ok).toBe(true);
    for (const name of ["rate|yoga|PT", "class|c1", "staff|s1|baseSalary"]) {
      expect(parseConfigNumbers(entries({ [name]: "1200.50" })).ok).toBe(false);
    }
  });

  test("a value an Int column cannot hold is refused here, not thrown at the write", () => {
    // `type="number"` carries no `max`, so `99999999999` parsed fine, every row ahead of it
    // committed, and the staff write then threw "Value out of range" mid-loop — the half-written
    // save this parse exists to make impossible.
    expect(parseConfigNumbers(entries({ "staff|s1|baseSalary": "99999999999" }))).toEqual({
      ok: false,
      kind: "staff",
    });
    const edge = parseConfigNumbers(entries({ "staff|s1|baseSalary": String(INT_COLUMN_MAX) }));
    expect(edge.ok).toBe(true);
  });

  test("the refusal names the section it came from", () => {
    expect(parseConfigNumbers(entries({ "rate|yoga|PT": "abc" }))).toEqual({
      ok: false,
      kind: "rate",
    });
    expect(parseConfigNumbers(entries({ "class|c1": "1e999" }))).toEqual({
      ok: false,
      kind: "class",
    });
    expect(parseConfigNumbers(entries({ "staff|s1|classCredit": "-1" }))).toEqual({
      ok: false,
      kind: "staff",
    });
  });

  test("a File part is refused like any other unreadable field", () => {
    expect(parseConfigNumbers(entries({ "class|c1": new File([], "x.bin") }))).toEqual({
      ok: false,
      kind: "class",
    });
  });

  test("🔴 one bad field refuses the WHOLE save — nothing after it is offered to the caller", () => {
    // The all-or-nothing promise the screen makes ("ยังไม่ได้บันทึกอะไรเลยสักช่อง") is only true
    // because this returns on the first refusal instead of collecting the good ones.
    const r = parseConfigNumbers(
      entries({ "class|c1": "800", "class|c2": "NaN", "class|c3": "900" }),
    );
    expect(r).toEqual({ ok: false, kind: "class" });
  });
});

describe("numericKind — the write loop asks it too (task 013 item 4)", () => {
  test("🔴 a `staff` field this form does not have is not numeric, and is not a refusal either", () => {
    // `staff|<id>|active` used to reach the write loop's parsed-values lookup, which had skipped
    // it, and **throw mid-loop** — after the rate rows were already written. Classified `null` on
    // both sides now, so the parse ignores it and the loop skips it.
    expect(numericKind("staff|s1|active")).toBeNull();
    expect(numericKind("staff|s1|passwordHash")).toBeNull();
    const r = parseConfigNumbers(entries({ "staff|s1|active": "true", "class|c1": "800" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.has("staff|s1|active")).toBe(false);
  });

  test("the four numeric kinds, and the two shapes that are not", () => {
    expect(numericKind("cfg|ot.ratePerHour")).toBe("cfg");
    expect(numericKind("rate|yoga|PT")).toBe("rate");
    expect(numericKind("class|c1")).toBe("class");
    expect(numericKind("staff|s1|baseSalary")).toBe("staff");
    expect(numericKind("staff|s1|classCredit")).toBe("staff");
    expect(numericKind("staff|s1|rank")).toBeNull();
    expect(numericKind("sheet|s1")).toBeNull();
  });
});
