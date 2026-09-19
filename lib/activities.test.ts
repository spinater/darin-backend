import { expect, test, describe } from "bun:test";
import { mergeActivityNames } from "./activity-names";

/**
 * The activity-name union, tested where it is pure (task 036).
 *
 * 🔴 **What these tests do NOT prove.** `listActivities()` and `activityExists()` run queries, and
 * `bun test` here has no database (`scripts/check-code.sh` runs it before the throwaway postgres
 * exists and with no `DATABASE_URL`) ⇒ the four arms really being read, and the `@unique` index
 * catching the race behind `activityExists`, are **reviewed** rather than asserted. What is pinned is
 * the fold those arms feed, which is where every decision of task 036 lives.
 *
 * 🔑 The money half of this card — an activity registered with **no rate** must warn
 * `ไม่มีเรทค่าสอน …` and pay nothing, while a rate an owner deliberately set to `0` must pay 0 with a
 * line and no warning — is the engine's own boundary pair and belongs to task 037, which owns
 * `lib/payroll.ts`'s suite and splits it. It is deliberately **not** written twice.
 */

describe("mergeActivityNames — ทะเบียนชื่อกิจกรรม (ใบ 036)", () => {
  test("the four arms become one deduped, sorted list", () => {
    // Registry · rates · sheet sources · recorded sessions, in the order `listActivities` passes
    // them, with every kind of overlap between them. The whole array is compared rather than a
    // membership check per name, so the sort order is pinned too: the matrix's rows must not
    // reshuffle between two loads of the same screen.
    expect(
      mergeActivityNames(
        ["boxing", "pt", "yoga"],
        ["pt", "pilates", "swim"],
        ["pt", "pilates", "swim", "yoga"],
        ["pt", "swim"],
      ),
    ).toEqual(["boxing", "pilates", "pt", "swim", "yoga"]);
  });

  test("an empty registry takes nothing away — the union only ever adds", () => {
    // 🔴 The fail-safe direction, and the reason `TeachActivity` is not load-bearing for money: an
    // activity with a rate row, a sheet source or one historical session renders even if its
    // registry row is missing or the whole table is dropped. If this ever fails, a rate an owner
    // typed can disappear from the screen it is edited on.
    expect(mergeActivityNames([], ["pilates"], ["yoga"], ["boxing"])).toEqual([
      "boxing",
      "pilates",
      "yoga",
    ]);
  });

  test("trimmed-exact: padding merges, case does not", () => {
    // Two names differing only by surrounding whitespace are the same activity — the form trims
    // before it writes, and a sheet column may not have. Two names differing by case are **two**
    // activities: there is no normalizer here on purpose (§4 — `lib/normalize.ts` is for trainer
    // names), so the one nobody priced warns loudly instead of inheriting the other's rate.
    expect(mergeActivityNames([" boxing ", "boxing"], ["\tboxing\n"])).toEqual(["boxing"]);
    expect(mergeActivityNames(["Boxing"], ["boxing"])).toEqual(["Boxing", "boxing"]);
  });

  test("a blank or whitespace-only name is dropped, never rendered as a nameless row", () => {
    // `SheetSource.activity` and `TeachSession.activity` are plain columns with no guard, and a
    // blank one would render a row whose three inputs are named `rate||PT` … — a field name that
    // collides with every other blank in the bulk save (task 035 is what that encoding costs).
    expect(mergeActivityNames(["", "   ", "\t\n"], ["pt"])).toEqual(["pt"]);
    expect(mergeActivityNames([])).toEqual([]);
  });

  test("a name that is a prototype key is an ordinary name and pollutes nothing", () => {
    // The task-034 lesson, kept from being re-learned in the new module: an object used as a set
    // loses exactly these names — `o["__proto__"] = true` sets the prototype instead of adding a
    // key, and `"toString" in o` is already true for a fresh `{}` ⇒ a real activity would vanish
    // from the matrix, taking the rate an owner typed with it. A `Set` has no such keys.
    expect(mergeActivityNames(["__proto__", "toString", "constructor"], ["__proto__"])).toEqual([
      "__proto__",
      "constructor",
      "toString",
    ]);
    // And the process is unharmed — the half of task 034's defect that outlived the request.
    expect(Object.hasOwn(Object.prototype, "__proto__pollution_probe")).toBe(false);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });
});
