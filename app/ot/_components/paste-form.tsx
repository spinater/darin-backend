"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/app/_components/submit-button";
import { ActionProgress } from "@/app/_components/action-progress";
import { WarningCard } from "@/app/_components/warning-card";
import type { OtImportState } from "@/lib/ot-import";

/**
 * The bulk-paste OT form, split out of `app/ot/page.tsx` because `useActionState` needs a client
 * component.
 *
 * 🔴 **The server action is passed to `useActionState` unwrapped.** Wrapping it in a client
 * closure — which is how the try/catch used to be expressed here — makes React emit a form with
 * no `action`/`$ACTION_ID` fields, so a submit before hydration or with JS off becomes a plain
 * GET that imports nothing, silently. The action reports its own failure in `state.error`
 * instead; this component is pure rendering and decides nothing.
 */
export function PasteForm({
  action,
  importMs,
}: {
  action: (prev: OtImportState, formData: FormData) => Promise<OtImportState>;
  importMs: number | null;
}) {
  const [state, formAction] = useActionState<OtImportState, FormData>(action, null);
  // Lines the parser refused. "Nothing came in" must stay false while any of them exists — the
  // empty-state copy would otherwise talk about the paste format while the real answer is on
  // screen right below it.
  const rejected = state ? state.unmatched.length + state.invalidHours.length : 0;

  return (
    <form action={formAction} className="card flex flex-col gap-2">
      {/* The label wraps the control — a sibling <label> with no htmlFor leaves the textarea with
          no accessible name. Same pattern as the add form on the page. */}
      <label className="flex flex-col gap-2 text-xs text-neutral-500">
        หรือวางจากไฟล์สแกนนิ้ว — บรรทัดละ <code>ชื่อผู้ใช้ , วันที่(YYYY-MM-DD) , ชั่วโมง</code>
        <textarea name="bulk" rows={4} className="input font-mono text-xs" />
      </label>
      <div className="flex items-center gap-3 self-start">
        <SubmitButton className="btn-ghost" pendingLabel="กำลังนำเข้า…">
          นำเข้า
        </SubmitButton>
        <ActionProgress baselineMs={importMs} />
      </div>

      {state?.error && <p className="card-error text-sm">{state.error}</p>}

      {state && (state.imported > 0 || rejected > 0) && (
        <p className="text-sm">นำเข้าแล้ว {state.imported.toLocaleString("th-TH")} รายการ</p>
      )}

      {state && !state.error && state.imported === 0 && rejected === 0 && (
        <p className="text-sm text-neutral-500">
          ไม่พบข้อมูลที่นำเข้าได้ — ตรวจรูปแบบที่วาง (ชื่อผู้ใช้, วันที่, ชั่วโมง คั่นด้วย tab หรือ
          comma)
        </p>
      )}

      {state && state.unmatched.length > 0 && (
        <WarningCard
          heading={`คำเตือน (${state.unmatched.length}) — พบชื่อผู้ใช้ที่ไม่มีในระบบ ชั่วโมงกลุ่มนี้ยังไม่ถูกบันทึก`}
          items={state.unmatched}
          mono
        />
      )}

      {/* A separate box from `unmatched`: the name is fine, the hours field is not — a different
          fix, so a different heading (CLAUDE.md §2 rule 4 — neither may become a silent zero). */}
      {state && state.invalidHours.length > 0 && (
        <WarningCard
          heading={`คำเตือน (${state.invalidHours.length}) — ชั่วโมงไม่ใช่ตัวเลข บรรทัดกลุ่มนี้ยังไม่ถูกบันทึก`}
          items={state.invalidHours}
          mono
        />
      )}
    </form>
  );
}
