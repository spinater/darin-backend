/**
 * Naming seam between the Gymmo export and this database (task 058).
 *
 * `lib/gymmo.ts` turns cells into rows and stops. This file answers the two questions that stand
 * between those rows and a `ClassSession`: **which staff member is this sheet**, and **which
 * `ClassPrice` is this class name**. Both are lookups against data the owner controls, so neither
 * answer is hardcoded here — the tables are passed in.
 *
 * 🔴 **Nothing here folds case.** Task 036 made name comparison trimmed-exact on purpose: a second
 * normalizer puts one decision in two homes, and a loud mismatch beats a quiet wrong payment. A
 * spelling that differs only by case is therefore an **alias row**, not a clever comparison.
 */
import { normalizeTrainer } from "./normalize";

/** Gymmo marks a trainer who has left by appending `(Deleted)` to the sheet name. */
const DELETED_SUFFIX = /\s*\(Deleted\)\s*$/i;

export type TrainerSheet = {
  /** The sheet name with `(Deleted)` removed. */
  name: string;
  /** True when Gymmo has retired this trainer — their past sessions still have to be paid. */
  deleted: boolean;
};

/**
 * Split `"จักรเพชร พรมกัลป์(Deleted)"` into the name and the fact that they have left.
 *
 * The flag is kept rather than dropped because a retired trainer's **past** sessions are still
 * owed: the Jan–Sep export carries one such sheet, and silently skipping it is the §2 rule 4
 * silent zero.
 */
export function readTrainerSheet(sheetName: string): TrainerSheet {
  const deleted = DELETED_SUFFIX.test(sheetName);
  return { name: sheetName.replace(DELETED_SUFFIX, "").trim(), deleted };
}

/**
 * Gymmo's spelling of a class → the name `ClassPrice` holds.
 *
 * ⚠️ Every row here exists because the two systems spell **the same class** differently. A class
 * that Gymmo runs and `ClassPrice` has never heard of does **not** belong here — it needs a price
 * row, and until it has one the engine must say so rather than guess (§2 rule 4).
 *
 * 🔴 `HIIT ROX` is a **rename, not a typo**: linus renamed the class to `LESMILLS CEREMONY HYROX`
 * (task 050 §8.2) while Gymmo still exports the old name. Renaming the `ClassPrice` row alone
 * would strand every historical session; the alias is what keeps both readable.
 */
export const GYMMO_CLASS_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "YOGA ESSENTIAL": "Yoga Essential",
  "Body PUMP": "Body Pump",
  "Lesmills Pilates": "LesMills Pilates",
  "HIIT ROX": "LESMILLS CEREMONY HYROX",
});

export type ClassMatch =
  { ok: true; className: string; viaAlias: boolean } | { ok: false; reason: string };

/**
 * Resolve one Gymmo class name against the names `ClassPrice` actually holds.
 *
 * Order is deliberate: an **exact** name wins over an alias, so adding a real `ClassPrice` row
 * named exactly as Gymmo spells it retires the alias without anyone having to delete it.
 */
export function matchClassName(gymmoName: string, knownClassNames: readonly string[]): ClassMatch {
  const raw = gymmoName.trim();
  if (!raw) return { ok: false, reason: "ชื่อคลาสว่าง" };

  const known = new Set(knownClassNames.map((n) => n.trim()));
  if (known.has(raw)) return { ok: true, className: raw, viaAlias: false };

  const alias = GYMMO_CLASS_ALIASES[raw];
  if (alias) {
    if (known.has(alias)) return { ok: true, className: alias, viaAlias: true };
    return {
      ok: false,
      reason: `คลาส "${raw}" ตรงกับชื่อ "${alias}" แต่ยังไม่มีราคาในระบบ — เพิ่มราคาที่หน้าคลาสก่อน`,
    };
  }
  return {
    ok: false,
    reason: `ไม่รู้จักคลาส "${raw}" — ยังไม่มีราคาในระบบ และไม่มีชื่อพ้องที่ตั้งไว้`,
  };
}

export type StaffMatch = { ok: true; staffId: string } | { ok: false; reason: string };

/**
 * Resolve a Gymmo sheet name to a staff id through the **existing** `TrainerAlias` table.
 *
 * It reuses `normalizeTrainer` rather than inventing a second rule, so a name keyed for the Google
 * Sheet resolves the same way here (§2 rule 6: one spelling variant, one home). The six live
 * mappings were derived from the September class timetable and verified against what each name
 * actually taught — see task 052 §10.
 */
export function matchTrainer(
  sheetName: string,
  aliasToStaffId: ReadonlyMap<string, string>,
): StaffMatch {
  const { name, deleted } = readTrainerSheet(sheetName);
  if (!name) return { ok: false, reason: "ชื่อชีตว่าง" };

  const staffId = aliasToStaffId.get(normalizeTrainer(name));
  if (staffId) return { ok: true, staffId };

  const tail = deleted ? " (Gymmo ระบุว่าออกแล้ว แต่คาบที่สอนไปแล้วยังต้องจ่าย)" : "";
  return { ok: false, reason: `ไม่รู้จักเทรนเนอร์ "${name}"${tail} — ต้องผูกชื่อที่หน้าตั้งค่า` };
}
