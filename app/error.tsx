"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Root error boundary — catches a throw from any page under the layout (task 020).
 *
 * Four decisions, made deliberately, so the next reader does not re-open them:
 *
 * 1. `error.message` is never rendered. A production build redacts server error messages
 *    before they reach this boundary, so printing it would only ever show Next's generic
 *    placeholder while looking informative. The copy instead names the two likely causes —
 *    a config value not set yet, and (ใบ 082) two values that are each filled in but
 *    **contradict each other**, for which "check every field is filled in" is exactly the
 *    wrong instruction: every field *is* filled in, so the reader concludes config is fine
 *    and escalates the digest while the real Thai sentence sits in the server log — and
 *    points at `/admin/config`. `error.digest` is printed
 *    when present so the operator can hand that string to whoever reads the server log,
 *    where the real Thai message (e.g. `lib/config-keys.ts`'s `ไม่พบ config: …`) actually
 *    lands. There is no `NODE_ENV` branch that renders the message in dev — a second code
 *    path that never runs in the environment that matters is not worth having.
 *    `/admin/config` (`app/admin/config/page.tsx:380`) renders one input per *existing*
 *    config row, so the `ไม่พบ config` arm of `num()` (a missing row, not a blank value —
 *    `lib/config-keys.ts:52`) leaves nothing on that page to fill in; the digest is the only
 *    handle anyone has, which is why the copy escalates to it instead of only pointing there.
 *    That escalation clause and the digest line below it share one condition (`error.digest`)
 *    rather than each testing it separately — `error.digest` is absent for a client-component
 *    render throw, and an instruction pointing at a reference code that was never printed is
 *    the same trap `app/ot/page.tsx` documents for "ตรวจบรรทัดนั้น" degrading when
 *    `describeFailedRow` named no line.
 *
 * 2. The copy never claims "nothing was saved." An uncaught server-action throw lands in
 *    this same boundary *after* it may already have written rows — `app/ot/page.tsx`
 *    documents exactly this trap (its old "previous rows are already saved" copy was a lie
 *    at `imported === 0`). So this screen only says the page could not be shown, and tells
 *    the user to check whether the save went through before pressing save again.
 *
 * 3. `app/global-error.tsx` exists alongside this file. This boundary does not catch a throw
 *    from `app/layout.tsx` itself, and that layout `await`s `currentStaff()` — a DB read on
 *    every request, the single most likely total failure. Without the global boundary that
 *    case falls through to Next's built-in English page.
 *
 * 4. No route-level boundaries (`app/classes/error.tsx`, `app/ot/error.tsx`, …). One branch,
 *    a handful of staff, and every screen fails the same two ways: a config read or the DB.
 *    This boundary renders inside the root layout, so the nav stays on screen and the user
 *    can leave the broken screen — which is the only thing a per-route boundary would have
 *    bought here.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="card-error flex flex-col gap-3" role="alert">
      <p className="font-semibold">เปิดหน้านี้ไม่สำเร็จ</p>
      <p className="text-sm leading-relaxed">
        ระบบแสดงข้อมูลของหน้านี้ไม่ได้ สาเหตุที่พบบ่อยที่สุดคือ <b>ค่าตั้งค่ายังไม่ครบ</b> หรือ
        <b>ค่าที่กรอกไว้ขัดกันเอง</b> (เช่น ช่วงวันที่ที่รับ)
      </p>
      <p className="text-sm leading-relaxed">
        <b>ถ้าคุณเป็นผู้ดูแลระบบ</b> ให้เปิดหน้า “ตั้งค่า” แล้วตรวจว่าเกณฑ์ เปอร์เซ็นต์
        และเรทถูกกรอกไว้ครบทุกช่อง <b>และไม่ขัดกันเอง</b> · <b>ถ้าไม่เจอช่องที่ขาด</b>{" "}
        แปลว่าค่านั้นยังไม่มีแถวในฐานข้อมูล หน้าตั้งค่าจึงไม่มีช่องให้แก้ —
        ให้แจ้งคนที่ดูแลเซิร์ฟเวอร์
        {error.digest && (
          <>
            {" "}
            พร้อม<b>รหัสอ้างอิงด้านล่าง</b>
          </>
        )}
      </p>
      <p className="text-sm leading-relaxed">
        ถ้าเพิ่งกดบันทึกก่อนเจอหน้านี้ <b>ให้ตรวจก่อนว่าบันทึกเข้าไปแล้วหรือยัง</b> แล้วค่อยกดซ้ำ
      </p>
      {error.digest && (
        <p className="font-mono text-xs break-all">รหัสอ้างอิงสำหรับผู้ดูแลระบบ: {error.digest}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={reset}>
          ลองใหม่อีกครั้ง
        </button>
        <Link className="btn-ghost" href="/admin/config">
          ไปหน้าตั้งค่า
        </Link>
      </div>
    </div>
  );
}
