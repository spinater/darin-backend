/**
 * "ตารางเรทค่าสอน (กิจกรรม × ระดับ)" — the matrix section of the bulk `save` form.
 *
 * Moved out of `page.tsx` at task 036 under the §4 split pattern (co-locate in `_components/`), which
 * is the pre-decided first split for that file: it was 443 lines against warn-450 / cap-500 and this
 * card's action, its refusal and the note below all grew. Pure movement plus the note — no field name,
 * no `defaultValue` and no ordering changed, so the bulk save's `rate|<activity>|<rank>` contract is
 * untouched (that encoding is task 035's, not this card's).
 *
 * 🔴 **The rows are activity *names*, from `lib/activities.ts`** — not the distinct activities of the
 * rate rows, which is what they were until task 036. That is the whole fix: a name can now exist with
 * **no** `TeachRate` row, which is what makes `ยังไม่ตั้ง` an honest placeholder and lets
 * `computePayslip`'s `ไม่มีเรทค่าสอน …` warning fire for a screen-added activity instead of paying
 * 0 ฿ in silence.
 */
export function RateTable({
  activities,
  ranks,
  rates,
}: {
  /** Every name the matrix shows, already trimmed, deduped and sorted by `mergeActivityNames`. */
  activities: readonly string[];
  ranks: readonly string[];
  /** Structural, not the Prisma row type — this component only ever reads these three fields. */
  rates: readonly { activity: string; rank: string; rate: number }[];
}) {
  return (
    <section className="card">
      <h2 className="mb-2 font-medium">ตารางเรทค่าสอน (กิจกรรม × ระดับ)</h2>
      <table className="w-full max-w-xl">
        <thead>
          <tr>
            <th className="th">กิจกรรม</th>
            {ranks.map((r) => (
              <th key={r} className="th">
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => (
            <tr key={a}>
              <td className="td">{a}</td>
              {ranks.map((r) => (
                <td key={r} className="td">
                  <input
                    name={`rate|${a}|${r}`}
                    type="number"
                    defaultValue={rates.find((x) => x.activity === a && x.rank === r)?.rate ?? ""}
                    placeholder="ยังไม่ตั้ง"
                    className="input w-24"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* 🔴 Both halves: a blank and a `0` mean different things and the difference is money
          (task 036). */}
      <p className="mt-2 text-xs text-amber-700">
        ช่องว่าง = <b>ยังไม่มีเรท</b> → คาบของกิจกรรมนั้นจะไม่ถูกคิดเงินและขึ้นเตือนในสลิป
        <br />
        ใส่ <b>0</b> = ตั้งใจไม่จ่ายสำหรับระดับนั้น → คาบยังขึ้นเป็นบรรทัดในสลิปตามปกติ คิดเป็น 0 ฿
        และ <b>ไม่มีคำเตือน</b>
      </p>
    </section>
  );
}
