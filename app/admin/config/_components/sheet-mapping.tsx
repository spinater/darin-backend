import { SubmitButton } from "@/app/_components/submit-button";

/**
 * The two tables that say **how the Google Sheet's own text and colour map onto our data** — the
 * trainer-name aliases and the colour rules. Co-located here under the §4 split pattern when task
 * 013 item 4's review round pushed `page.tsx` back toward the 500-line ceiling; pure markup, with
 * the actions and the rows still owned by the page.
 *
 * One file rather than two because they are one job: neither is payroll configuration, both exist
 * only because the sheet is written by hand, and an admin who is fixing one is usually fixing the
 * other in the same sitting.
 */
export function SheetMappingSections({
  aliases,
  colors,
  staff,
  addAlias,
  addColor,
}: {
  aliases: { alias: string; staff: { name: string } }[];
  colors: { hex: string; meaning: string }[];
  staff: { id: string; name: string }[];
  addAlias: (formData: FormData) => Promise<void>;
  addColor: (formData: FormData) => Promise<void>;
}) {
  return (
    <>
      <section className="card">
        <h2 className="mb-2 font-medium">ชื่อเทรนเนอร์ในชีต → พนักงาน</h2>
        <p className="mb-2 text-xs text-neutral-500">
          ชีต PT สะกดชื่อ 21 แบบสำหรับคน ~5 คน — ระบบ normalize (ตัดช่องว่าง/prefix PT/พี่)
          แล้วจับคู่ที่นี่
        </p>
        <div className="mb-2 flex flex-wrap gap-1">
          {aliases.map((a) => (
            <span key={a.alias} className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
              {a.alias} → {a.staff.name}
            </span>
          ))}
        </div>
        <form action={addAlias} className="flex gap-2">
          <input name="alias" placeholder='ชื่อในชีต เช่น "PT มิกซ์"' className="input" />
          <select name="staffId" className="input">
            <option value="">— พนักงาน —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <SubmitButton className="btn-ghost" pendingLabel="กำลังเพิ่ม…">
            เพิ่ม
          </SubmitButton>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-2 font-medium">สีในชีต → ความหมาย</h2>
        <p className="mb-2 text-xs text-neutral-500">
          ชีตใช้สีพื้น 28–41 แบบ ถ้าสีไหนแปลว่า &quot;ยกเลิก/ไม่จ่าย&quot; ต้องตั้งที่นี่
          ไม่งั้นระบบจะจ่ายให้ทุกสี
        </p>
        <div className="mb-2 flex flex-wrap gap-1">
          {colors.map((c) => (
            <span
              key={c.hex}
              className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-xs"
            >
              <span className="size-3 rounded-sm border" style={{ background: c.hex }} />
              {c.hex} → {c.meaning}
            </span>
          ))}
        </div>
        <form action={addColor} className="flex gap-2">
          <input name="hex" placeholder="#b6d7a8" className="input w-32 font-mono" />
          <select name="meaning" className="input">
            <option value="pay">จ่ายปกติ</option>
            <option value="skip">ไม่จ่าย (ข้าม)</option>
            <option value="review">ให้คนตรวจ</option>
          </select>
          <input name="note" placeholder="หมายเหตุ" className="input" />
          <SubmitButton className="btn-ghost" pendingLabel="กำลังเพิ่ม…">
            เพิ่ม
          </SubmitButton>
        </form>
      </section>
    </>
  );
}
