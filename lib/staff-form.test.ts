import { expect, test, describe } from "bun:test";
import { parseNewStaff } from "./staff-form";
import { MIN_PASSWORD_LEN } from "./password";
import { INT_COLUMN_MAX } from "./form-number";

/** A form the browser could really post: every field present and valid, ready to be spoiled. */
const GOOD = {
  name: "สมชาย ใจดี",
  username: "somchai",
  password: "x".repeat(MIN_PASSWORD_LEN),
  baseSalary: "15000",
  classCredit: "5000",
};

/** `undefined` in an override means **the field is absent** — what a hand-made POST looks like. */
const form = (over: Record<string, string | File | undefined> = {}): FormData => {
  const fd = new FormData();
  for (const [name, value] of Object.entries({ ...GOOD, ...over }))
    if (value !== undefined) fd.set(name, value);
  return fd;
};

describe("parseNewStaff (task 027)", () => {
  test("the happy path hands back exactly what the action writes", () => {
    expect(parseNewStaff(form())).toEqual({
      ok: true,
      values: {
        name: "สมชาย ใจดี",
        username: "somchai",
        password: "x".repeat(MIN_PASSWORD_LEN),
        baseSalary: 15000,
        classCredit: 5000,
      },
    });
  });

  test("🔴 a whitespace-only ชื่อ is refused by its own name, not in silence", () => {
    // `required` in the markup means an *empty* box never reaches here — whitespace does, and used
    // to hit a bare `return`: the page revalidated, the form cleared, and nothing said the staff
    // member had not been created.
    expect(parseNewStaff(form({ name: "   " }))).toEqual({ ok: false, kind: "newstaffName" });
    expect(parseNewStaff(form({ name: "\t\n" }))).toEqual({ ok: false, kind: "newstaffName" });
  });

  test("🔴 a whitespace-only ชื่อผู้ใช้ is refused by its own name", () => {
    expect(parseNewStaff(form({ username: " " }))).toEqual({ ok: false, kind: "newstaffUser" });
  });

  test("the password boundary is MIN_PASSWORD_LEN itself, not a number written here", () => {
    // Pinning the constant rather than 12: the day it is raised, this test moves with it instead of
    // going red for a reason that is not a defect.
    expect(parseNewStaff(form({ password: "x".repeat(MIN_PASSWORD_LEN - 1) }))).toEqual({
      ok: false,
      kind: "newstaffPass",
    });
    expect(parseNewStaff(form({ password: "x".repeat(MIN_PASSWORD_LEN) })).ok).toBe(true);
  });

  test("🔑 the password is NOT trimmed — the bytes posted are the bytes hashed", () => {
    // A password may legitimately start or end with a space. Trimming it here would hash something
    // other than what the admin typed and handed over, and the staff member could not log in with
    // the password they were given. The spaces also count toward the length.
    const padded = ` ${"x".repeat(MIN_PASSWORD_LEN - 2)} `;
    const r = parseNewStaff(form({ password: padded }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.password).toBe(padded);
    // …and a password that is only long enough *because* of its padding is still long enough.
    expect(padded.trim().length).toBe(MIN_PASSWORD_LEN - 2);
  });

  test("blank ฐานเงินเดือน / เครดิตสอนคลาส stay the documented default of 0 (task 013 item 4)", () => {
    // The behaviour this change must not move: blank is "not given" and has a documented meaning
    // here, unlike the bulk form where a blank salary would overwrite a real figure.
    const r = parseNewStaff(form({ baseSalary: "", classCredit: "   " }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.baseSalary).toBe(0);
    expect(r.values.classCredit).toBe(0);
  });

  test("🔴 a money field that was filled in and cannot be read is `newstaff`, never a 0", () => {
    // Each of these reaches an `Int` column that would not complain in the direction that costs:
    // Postgres truncates `15000.5` to 15000, accepts `NaN` in a `Float`, and throws on overflow at
    // the write — after the row before it has committed.
    for (const bad of ["abc", "1e999", "-1", "15000.5", "99999999999"])
      expect(parseNewStaff(form({ baseSalary: bad }))).toEqual({ ok: false, kind: "newstaff" });
    // 🔑 The `File` case is pinned on **both** fields, not one each. They are read by two separate
    // lines nine lines apart, so pinning it on `classCredit` alone leaves a later tidy-up that
    // wraps only `baseRaw` **green** — and a `baseSalary` posted as a file part would then create
    // the staff member at **0 ฿** instead of refusing.
    for (const field of ["baseSalary", "classCredit"])
      expect(parseNewStaff(form({ [field]: new File([], "x.bin") }))).toEqual({
        ok: false,
        kind: "newstaff",
      });
    // The ceiling itself is legal — `INT_COLUMN_MAX` is a column bound, not a business rule.
    expect(parseNewStaff(form({ baseSalary: String(INT_COLUMN_MAX) })).ok).toBe(true);
  });

  test("🔑 the refusal ORDER is fixed: name → username → password → the money fields", () => {
    // Two bad fields must always report the same one, so fixing what the notice names is progress
    // and not a notice bouncing between fields.
    const allBad = { name: " ", username: " ", password: "short", baseSalary: "abc" };
    expect(parseNewStaff(form(allBad))).toEqual({ ok: false, kind: "newstaffName" });
    expect(parseNewStaff(form({ ...allBad, name: "ดารินทร์" }))).toEqual({
      ok: false,
      kind: "newstaffUser",
    });
    expect(parseNewStaff(form({ ...allBad, name: "ดารินทร์", username: "darin" }))).toEqual({
      ok: false,
      kind: "newstaffPass",
    });
    expect(
      parseNewStaff(
        form({ ...allBad, name: "ดารินทร์", username: "darin", password: GOOD.password }),
      ),
    ).toEqual({ ok: false, kind: "newstaff" });
  });

  test("an absent field, or one posted as a File part, is refused — never stringified", () => {
    // `String(new File([], "x.bin"))` is `"[object File]"`, which is truthy and survives `.trim()`
    // ⇒ the old read would have created a staff member named `[object File]`, and a `File` password
    // would have been hashed as that same string.
    expect(parseNewStaff(form({ name: undefined }))).toEqual({ ok: false, kind: "newstaffName" });
    expect(parseNewStaff(form({ username: undefined }))).toEqual({
      ok: false,
      kind: "newstaffUser",
    });
    expect(parseNewStaff(form({ password: undefined }))).toEqual({
      ok: false,
      kind: "newstaffPass",
    });
    expect(parseNewStaff(form({ name: new File([], "x.bin") }))).toEqual({
      ok: false,
      kind: "newstaffName",
    });
    expect(parseNewStaff(form({ password: new File([], "x.bin") }))).toEqual({
      ok: false,
      kind: "newstaffPass",
    });
  });
});
