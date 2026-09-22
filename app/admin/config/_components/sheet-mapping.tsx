import { ColorSwatches } from "@/app/_components/color-swatches";
import { SubmitButton } from "@/app/_components/submit-button";
import { COLOR_MEANINGS, COLOR_MEANING_LABELS, type ColorGap } from "@/lib/color-rules";

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
  colorGaps,
  staff,
  addAlias,
  addColor,
}: {
  aliases: { alias: string; staff: { name: string } }[];
  colors: { hex: string; meaning: string }[];
  colorGaps: ColorGap[];
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
        {/* 🔴 The half that was missing until card 043: the swatches above are the colours someone
            has already answered for, and on their own they cannot show what is **not** there. These
            are the colours on คาบ this payroll would **pay** with nobody vouching for them — no rule
            at all, or a rule the stored rows do not obey yet. Each row is its own one-click form so
            the answer costs a dropdown, not a hex typed back in by hand; the dropdown has no default
            because the default would be the answer that pays. */}
        {colorGaps.length > 0 && (
          <div className="card-warn mb-3 text-sm">
            <p className="mb-2 font-medium">
              {colorGaps.length} สีที่ยังไม่มีใครรับรอง — ระบบจ่ายให้ทุกสีที่ไม่มีกฎ
            </p>
            <ul className="flex flex-col gap-1">
              {colorGaps.map((c) => (
                // 🔴 An `unapplied` colour is **not** waiting on an answer — it has one. The form
                // stays so a wrong answer can be corrected, but the button says so, because a
                // bare "บันทึก" beside an empty dropdown reads as "this colour is unanswered" and
                // the only selection that makes the red entry disappear is `pay` — the trap this
                // card removed from the dropdown, re-entered one level up (code-reviewer, รอบ 2).
                <li key={c.hex} className="flex flex-wrap items-center gap-2">
                  <ColorSwatches colors={[c]} />
                  <form action={addColor} className="flex gap-2">
                    <input type="hidden" name="hex" value={c.hex} />
                    {/* 🔴 **Nothing is preselected, and `addColor` refuses the empty value.** With
                        "จ่ายปกติ" preselected, clearing this whole queue is one click per row and
                        the colour that meant ยกเลิก is retired to `pay` for ever — the card's own
                        failure ("a queue everyone learns to click through") reached through the
                        screen instead of through the engine. The cost of the extra click is one
                        click; the cost of the default is a month of คาบ. */}
                    <select name="meaning" defaultValue="" className="input" required>
                      <option value="" disabled>
                        — เลือกความหมาย —
                      </option>
                      {COLOR_MEANINGS.map((m) => (
                        <option key={m} value={m}>
                          {COLOR_MEANING_LABELS[m]}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="btn-ghost" pendingLabel="กำลังบันทึก…">
                      {c.state === "unapplied" ? "เปลี่ยนความหมาย" : "บันทึก"}
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              ตั้งเป็น &quot;จ่ายปกติ&quot; ก็ได้ถ้าสีนั้นไม่ได้แปลว่าอะไร — ที่ต้องการคือให้ทุกสี
              <b>ถูกคนตอบหนึ่งครั้ง</b> ไม่ใช่ให้ระบบเดาแทน · 🔴{" "}
              <b>ตั้งกฎแล้วคาบเก่ายังไม่เปลี่ยน</b> กฎสีมีผลตอน sync เท่านั้น ⇒ ต้อง sync ใหม่
              (สีที่ขึ้น<b>แดง</b>ด้านบนคือสีที่อยู่ในสภาพนี้) · ส่วนคาบที่<b>ตรวจด้วยมือแล้ว</b>{" "}
              sync จะข้ามตลอดไป ต้อง<b>กดข้ามเองจากลิงก์ข้างสีนั้น</b> — 🔴{" "}
              <b>ห้ามตั้งสีนั้นเป็น &quot;จ่ายปกติ&quot; เพื่อให้คำเตือนหาย</b>{" "}
              นั่นคือการประกาศว่าสีนั้นจ่ายจริงตลอดไป
            </p>
          </div>
        )}

        <form action={addColor} className="flex gap-2">
          <input name="hex" placeholder="#b6d7a8" className="input w-32 font-mono" required />
          <select name="meaning" defaultValue="" className="input" required>
            <option value="" disabled>
              — เลือกความหมาย —
            </option>
            {COLOR_MEANINGS.map((m) => (
              <option key={m} value={m}>
                {COLOR_MEANING_LABELS[m]}
              </option>
            ))}
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
