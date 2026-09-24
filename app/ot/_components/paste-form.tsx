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
  disabled = false,
}: {
  action: (prev: OtImportState, formData: FormData) => Promise<OtImportState>;
  importMs: number | null;
  /**
   * ใบ 082 (second review round): true while `lib/date-window.ts` cannot build a window from the
   * two config keys. The paste is a **dated** write, so every one of its rows would be refused —
   * and the page above says why in `WindowFaultNotice`. Disabling here is the same courtesy the
   * one-row add form takes; the action re-checks regardless, and the `outOfWindowDates` bucket
   * below is unrelated (that one is a row the window *did* judge).
   */
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState<OtImportState, FormData>(action, null);
  // Lines the parser refused. "Nothing came in" must stay false while any of them exists — the
  // empty-state copy would otherwise talk about the paste format while the real answer is on
  // screen right below it.
  const rejected = state
    ? state.unmatched.length +
      state.invalidHours.length +
      state.invalidDates.length +
      state.outOfWindowDates.length
    : 0;

  return (
    <form action={formAction} className="card flex flex-col gap-2">
      {/* The label wraps the control — a sibling <label> with no htmlFor leaves the textarea with
          no accessible name. Same pattern as the add form on the page. */}
      {/* 🔴 **The column layout is on the `<fieldset>`, so that no `display: contents` behaviour
          is relied on** — the same decision as the three add forms (`app/ot/page.tsx` carries the
          argument): `contents` applies on **every** render, not only while disabled, so an engine
          that ignores it would break this layout permanently and nothing in this pipeline renders
          a browser that would catch it. The `<form>` keeps a column of its own for the warning
          boxes below, which stay **outside** the fieldset on purpose: they must remain readable
          while the paste is disabled. `border-0 p-0 m-0` clears the fieldset's own chrome;
          `min-w-0` overrides its `min-inline-size: min-content`. */}
      <fieldset disabled={disabled} className="flex flex-col gap-2 border-0 p-0 m-0 min-w-0">
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
      </fieldset>

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

      {/* Deliberately uncapped, unlike `invalidHours` below: one misspelt username in this list is
          one fix (rename the sheet entry or the staff record) that recovers a whole month, so
          nothing here is allowed to scroll off screen. A scanner variant like "9:20" can invalidate
          hundreds of hour fields at once — that list is capped instead (task 011). */}
      {state && state.unmatched.length > 0 && (
        <WarningCard
          heading={`คำเตือน (${state.unmatched.length}) — พบชื่อผู้ใช้ที่ไม่มีในระบบ ชั่วโมงกลุ่มนี้ยังไม่ถูกบันทึก`}
          items={state.unmatched}
          mono
        />
      )}

      {/* A separate box from `unmatched`: the name is fine, the hours field is not — a different
          fix, so a different heading (CLAUDE.md §2 rule 4 — neither may become a silent zero).
          Capped at 20: a single scanner-format variant (e.g. "9:20") can invalidate hundreds of
          lines in one paste, which is one fix applied many times — not hundreds of distinct
          problems worth scrolling through. */}
      {state && state.invalidHours.length > 0 && (
        <WarningCard
          heading={`คำเตือน (${state.invalidHours.length}) — ชั่วโมงไม่ใช่ตัวเลข หรือติดลบ บรรทัดกลุ่มนี้ยังไม่ถูกบันทึก`}
          items={state.invalidHours}
          mono
          max={20}
        />
      )}

      {/* The third bucket (task 014): the name is fine, the hours are fine, the *date* is not a
          real calendar day. Capped at 20 for the same reason as `invalidHours` — one wrong export
          format invalidates every line at once, which is one fix, not hundreds.
          🔴 The heading has to name **both** halves. `new Date()` turns `2026-06-31` into
          `2026-07-01` without complaint, so a heading reading only "วันที่อ่านไม่ออก" sends the
          operator hunting a typo in a value that looks perfectly fine to them — while that day's
          OT would have been counted in the wrong month. Hence the worked example in the copy. */}
      {state && state.invalidDates.length > 0 && (
        <WarningCard
          heading={`คำเตือน (${state.invalidDates.length}) — วันที่อ่านไม่ออก หรือไม่มีอยู่จริง (เช่น 2026-06-31) บรรทัดกลุ่มนี้ยังไม่ถูกบันทึก`}
          items={state.invalidDates}
          mono
          max={20}
        />
      )}

      {/* The fourth bucket (ใบ 082): the name is fine, the hours are fine, the date is a **real
          day** — in a year this gym cannot have operated in. Its own box rather than a line in the
          one above, for the same reason it is its own bucket: `0226-06-05` round-trips cleanly, so
          a heading saying “อ่านไม่ออก” names the wrong cause and sends the operator looking for a
          malformed cell that is not there (§2 rule 4 asks for a warning that is *useful*). Capped
          at 20 like its two neighbours — one bad export format invalidates every line at once. */}
      {state && state.outOfWindowDates.length > 0 && (
        <WarningCard
          heading={`คำเตือน (${state.outOfWindowDates.length}) — ปีของวันที่อยู่นอกช่วงที่ระบบรับ (เช่น 0226-06-05 ที่เกิดจากพิมพ์ปีไม่ครบ) บรรทัดกลุ่มนี้ยังไม่ถูกบันทึก`}
          items={state.outOfWindowDates}
          mono
          max={20}
        />
      )}
    </form>
  );
}
