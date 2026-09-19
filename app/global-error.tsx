"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Root-layout error boundary (task 020).
 *
 * `app/error.tsx` does not catch a throw from `app/layout.tsx` itself, and that layout
 * `await`s `currentStaff()` — a DB read on every request, the single most likely total
 * failure. This file is what covers that case; without it, a failed layout falls through to
 * Next's built-in English error page.
 *
 * Because this file *replaces* the root layout when it fires, it renders its own
 * `<html lang="th"><body>` and imports `./globals.css` itself — otherwise no token class
 * (`.card-error`, `.btn`, …) would apply. It is deliberately shorter than `app/error.tsx`:
 * it fires when the shell itself is down, so it must not depend on anything but its own
 * markup, and it has no `<Link>` — navigation belongs to the layout that just failed, so a
 * plain `reset` button is the only escape offered here.
 *
 * Same redaction rule as `app/error.tsx`: `error.message` is never rendered (a production
 * build redacts it before it reaches this boundary anyway), and `error.digest` is printed
 * when present so the operator can hand that string to whoever reads the server log.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", error);
  }, [error]);

  return (
    <html lang="th">
      <body>
        <main className="mx-auto max-w-6xl p-4">
          <div className="card-error flex flex-col gap-3" role="alert">
            <p className="font-semibold">ระบบขัดข้อง</p>
            <p className="text-sm leading-relaxed">
              เปิดระบบไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง หรือแจ้งผู้ดูแลระบบถ้ายังไม่หาย
            </p>
            {error.digest && (
              <p className="font-mono text-xs break-all">
                รหัสอ้างอิงสำหรับผู้ดูแลระบบ: {error.digest}
              </p>
            )}
            <div>
              <button className="btn" onClick={reset}>
                ลองใหม่อีกครั้ง
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
