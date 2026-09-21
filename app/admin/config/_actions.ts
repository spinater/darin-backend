"use server";

/**
 * The two writers behind [`_components/sheet-mapping.tsx`](_components/sheet-mapping.tsx) — the
 * sheet's own text and colour mapped onto our data.
 *
 * Split out of `page.tsx` at ใบ 043, when the refusals below pushed that file past the 450-line warn
 * (CLAUDE.md §4). They are the natural piece to move: neither is payroll configuration, neither
 * touches the bulk `save` transaction, and both belong to the section that exists only because the
 * sheet is written by hand.
 *
 * ⚠️ `requireAdmin()` is re-asserted **inside each action**, not inherited from the page that
 * rendered the form — a server action is its own entry point and a form posted from a stale tab
 * reaches it without the page ever running.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isColorMeaning, isNeutralBg } from "@/lib/color-rules";
import { db } from "@/lib/db";
import { normalizeTrainer } from "@/lib/normalize";

export async function addAlias(formData: FormData) {
  await requireAdmin();
  const alias = normalizeTrainer(String(formData.get("alias") ?? ""));
  const staffId = String(formData.get("staffId") ?? "");
  if (!alias || !staffId) return;
  await db.trainerAlias.upsert({
    where: { alias },
    update: { staffId },
    create: { alias, staffId },
  });
  revalidatePath("/admin/config");
  redirect("/admin/config");
}

export async function addColor(formData: FormData) {
  await requireAdmin();
  const hex = String(formData.get("hex") ?? "")
    .trim()
    .toLowerCase();
  const meaning = String(formData.get("meaning") ?? "");
  if (!hex) return;
  // 🔴 Two **silent-overpay** refusals (ใบ 043 — the reasoning is in `lib/color-rules.ts`), loud
  // rather than silent because either one would otherwise leave the owner believing a rule is in
  // force while every คาบ of that colour keeps being paid. `err` is a flag, never the message: the
  // Thai lives in `_components/save-notice.tsx` (§2.5, the `/ot` precedent).
  if (!isColorMeaning(meaning)) redirect("/admin/config?err=colorMeaning");
  if (isNeutralBg(hex)) redirect("/admin/config?err=colorNeutral");
  // ⚠️ `note` absent (the per-colour quick form) vs present-but-empty (the typed form clearing it)
  // — `has()` tells those apart, `?? ""` did not and wiped the note the rule already carried.
  const note = formData.has("note") ? String(formData.get("note") ?? "") : undefined;
  await db.colorRule.upsert({
    where: { hex },
    update: { meaning, ...(note === undefined ? {} : { note }) },
    create: { hex, meaning, note: note ?? "" },
  });
  revalidatePath("/admin/config");
  redirect("/admin/config");
}
