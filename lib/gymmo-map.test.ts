import { describe, expect, test } from "bun:test";
import { GYMMO_CLASS_ALIASES, matchClassName, matchTrainer, readTrainerSheet } from "./gymmo-map";

/** The names `ClassPrice` holds today (prisma/seed.ts CLASSES) plus the four linus priced in ใบ 050. */
const KNOWN = [
  "Aqua Fit",
  "Aqua Beats",
  "TRX",
  "Body Combat",
  "BOSU Class",
  "Roller Stretch",
  "Core Strength",
  "Body Pump",
  "Functional Training",
  "Yoga Essential",
  "LesMills Pilates",
  "Darin Pilates",
  "Flow Stretch",
  "LESMILLS BODYSTEP",
  "Pilates Flow",
  "LESMILLS CEREMONY HYROX",
];

describe("readTrainerSheet", () => {
  test("keeps an ordinary sheet name untouched", () => {
    expect(readTrainerSheet("ธันยา มูลละคร")).toEqual({ name: "ธันยา มูลละคร", deleted: false });
  });

  test("splits off Gymmo's (Deleted) marker and remembers it", () => {
    // A real sheet in the Jan–Sep export. Their past sessions are still owed.
    expect(readTrainerSheet("จักรเพชร พรมกัลป์(Deleted)")).toEqual({
      name: "จักรเพชร พรมกัลป์",
      deleted: true,
    });
  });
});

describe("matchClassName", () => {
  test("an exact name matches without an alias", () => {
    expect(matchClassName("Core Strength", KNOWN)).toEqual({
      ok: true,
      className: "Core Strength",
      viaAlias: false,
    });
  });

  test.each([
    ["YOGA ESSENTIAL", "Yoga Essential"],
    ["Body PUMP", "Body Pump"],
    ["Lesmills Pilates", "LesMills Pilates"],
  ])("%s differs only by case and resolves through an alias, not by folding", (gymmo, expected) => {
    expect(matchClassName(gymmo, KNOWN)).toEqual({
      ok: true,
      className: expected,
      viaAlias: true,
    });
  });

  test("HIIT ROX is a rename and still resolves to the new priced name", () => {
    expect(matchClassName("HIIT ROX", KNOWN)).toEqual({
      ok: true,
      className: "LESMILLS CEREMONY HYROX",
      viaAlias: true,
    });
  });

  test("an exact name wins over an alias, so a real row retires the alias by itself", () => {
    const withOldName = [...KNOWN, "HIIT ROX"];
    expect(matchClassName("HIIT ROX", withOldName)).toEqual({
      ok: true,
      className: "HIIT ROX",
      viaAlias: false,
    });
  });

  test("a class with no price is refused with a reason, never guessed", () => {
    // `Lesmills BodyJam` and `YOGA basic` are both in the real export with no price yet.
    const r = matchClassName("Lesmills BodyJam", KNOWN);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toContain("Lesmills BodyJam");
  });

  test("an alias pointing at a price that does not exist yet says exactly that", () => {
    const r = matchClassName("HIIT ROX", ["Core Strength"]);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toContain("LESMILLS CEREMONY HYROX");
  });

  test("every alias target is a distinct name — no two Gymmo names collapse onto one class", () => {
    const targets = Object.values(GYMMO_CLASS_ALIASES);
    expect(new Set(targets).size).toBe(targets.length);
  });
});

describe("matchTrainer", () => {
  /** The six mappings proved against the September timetable (ใบ 052 §10). */
  const aliases = new Map([
    ["ธันยามูลละคร", "s-o"],
    ["นันทพงศ์เอี่ยมคง", "s-ton"],
    ["สุดารัตน์ไก่ทอง", "s-ploy"],
  ]);

  test("resolves a sheet name through the existing TrainerAlias table", () => {
    expect(matchTrainer("ธันยา มูลละคร", aliases)).toEqual({ ok: true, staffId: "s-o" });
  });

  test("a retired trainer still resolves when their alias is keyed", () => {
    const withRetired = new Map([...aliases, ["จักรเพชรพรมกัลป์", "s-gone"]]);
    expect(matchTrainer("จักรเพชร พรมกัลป์(Deleted)", withRetired)).toEqual({
      ok: true,
      staffId: "s-gone",
    });
  });

  test("an unknown trainer is refused, and the message says they left when Gymmo said so", () => {
    const r = matchTrainer("จักรเพชร พรมกัลป์(Deleted)", aliases);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toContain("ออกแล้ว");
  });

  test("an unknown trainer who has not left gets the plain message", () => {
    const r = matchTrainer("ไกรทัศนพงษ์ พลแสน", aliases);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).not.toContain("ออกแล้ว");
  });
});
