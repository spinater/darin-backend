import { SubmitButton } from "@/app/_components/submit-button";
import { closedOf, SLIP_STATUS_TH, type ClosedSlips } from "@/lib/closed-slips";

export type ReviewRow = {
  id: string;
  rowIndex: number;
  colIndex: number;
  date: Date | null;
  staffId: string | null;
  customerName: string | null;
  rawValue: string;
  bgColor: string | null;
  reviewNote: string | null;
  reviewed: boolean;
  source: { sheetName: string };
};

/**
 * The one table all three listings of `/sync/review` share (task 070, CLAUDE.md §4).
 *
 * 🔴 **`editable` is a money decision, not a layout one.** The date box and the trainer `select`
 * belong to the queue listing, whose rows are `needs_review` or trainer-less and therefore inside
 * no computed slip. The colour and ignored listings hold `status: "ok"` rows *with* a date and a
 * trainer — คาบ already inside slips — and leaving the same controls on them gave two ways to lose
 * money the queue never had: ยืนยัน on a row a sync would have repaired for free writes
 * `reviewed: true` and **strands it permanently** (50 × 400 = 20,000 ฿ measured), and editing the
 * date of a คาบ whose period is already paid adds it to the open period without removing it from
 * the closed one — one คาบ paid twice.
 *
 * 🔴 **A row in a closed period keeps its place and loses its button.** Hiding it would be the same
 * silence the whole card exists to remove; `lib/closed-slips.ts` carries why clicking would be
 * worse than doing nothing.
 *
 * ⚠️ The bulk checkbox column is rendered even when `showBulk` is false, empty — a table whose
 * column count changes between listings is a `colSpan` waiting to be wrong.
 */
export function ReviewTable({
  rows,
  trainers,
  closed,
  editable,
  showBulk,
  ignoredMode,
  showColourNote,
  hex,
  action,
  emptyLabel,
}: {
  rows: ReviewRow[];
  trainers: { id: string; name: string }[];
  closed: ClosedSlips;
  editable: boolean;
  showBulk: boolean;
  ignoredMode: boolean;
  showColourNote: boolean;
  hex?: string;
  action: (formData: FormData) => Promise<void>;
  emptyLabel: string;
}) {
  return (
    <form action={action}>
      {hex && <input type="hidden" name="hex" value={hex} />}
      <table className="card w-full">
        <thead>
          <tr>
            {["", "ชีต", "แถว", "สี", "ค่าในชีต", "ลูกค้า", "เหตุผล", "วันที่", "ผู้สอน", ""].map(
              (h, i) => (
                <th key={i} className="th">
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="td text-sm text-neutral-500" colSpan={10}>
                {emptyLabel}
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const closedStatus = closedOf(closed, r);
            return (
              <tr key={r.id}>
                <td className="td">
                  {showBulk && !closedStatus && <input type="checkbox" name="bulk" value={r.id} />}
                </td>
                <td className="td whitespace-nowrap text-xs text-neutral-500">
                  {r.source.sheetName}
                </td>
                <td className="td text-xs text-neutral-400">
                  {r.rowIndex + 1}:{r.colIndex + 1}
                </td>
                {/* 🔴 The queue never rendered this column, so every row cleared by hand was cleared
                    by somebody who was **not shown the colour** — which is why `reviewed: true` is
                    no evidence at all about a colour (`lib/color-rules.ts`). */}
                <td className="td whitespace-nowrap">
                  {r.bgColor ? (
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-neutral-500">
                      <span
                        className="size-3 rounded-sm border"
                        style={{ background: r.bgColor }}
                      />
                      {r.bgColor}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-300">—</span>
                  )}
                </td>
                <td className="td font-mono text-xs">{r.rawValue}</td>
                <td className="td max-w-40 truncate text-xs">{r.customerName ?? "—"}</td>
                <td className="td max-w-56 text-xs text-amber-700">
                  {r.reviewNote}
                  {/* What decides whether the click is needed at all: a row a sync will
                      re-evaluate is repaired by re-syncing, for free. */}
                  {showColourNote && (
                    <div className="text-neutral-500">
                      {r.reviewed
                        ? "ตรวจด้วยมือแล้ว — sync จะข้ามตลอดไป"
                        : "sync ครั้งหน้าจัดให้เอง"}
                    </div>
                  )}
                </td>
                <td className="td">
                  {editable ? (
                    <input
                      form={`f-${r.id}`}
                      type="date"
                      name="date"
                      defaultValue={r.date?.toISOString().slice(0, 10)}
                      className="input"
                    />
                  ) : (
                    <span className="text-xs whitespace-nowrap">
                      {r.date?.toISOString().slice(0, 10) ?? "—"}
                    </span>
                  )}
                </td>
                <td className="td">
                  {editable ? (
                    <select
                      form={`f-${r.id}`}
                      name="staffId"
                      defaultValue={r.staffId ?? ""}
                      className="input"
                    >
                      <option value="">— เลือก —</option>
                      {trainers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs whitespace-nowrap">
                      {trainers.find((t) => t.id === r.staffId)?.name ?? "—"}
                    </span>
                  )}
                </td>
                <td className="td whitespace-nowrap">
                  {closedStatus ? (
                    <span className="text-xs text-neutral-500">
                      งวดปิดแล้ว ({SLIP_STATUS_TH[closedStatus] ?? closedStatus}) — แก้ที่นี่ไม่ได้
                    </span>
                  ) : (
                    <>
                      {/* ปุ่มอยู่นอก <form> แล้วผูกด้วย form="…" — useFormStatus อ่านสถานะไม่ได้
                          เพราะมันดูจาก form ที่ครอบอยู่จริง ไม่ใช่ที่ผูกด้วย attribute
                          จึงต้องคงเป็นปุ่มธรรมดา (งานตรงนี้เป็น update แถวเดียว เร็วอยู่แล้ว) */}
                      {editable && (
                        <>
                          <button form={`f-${r.id}`} name="action" value="ok" className="btn">
                            ยืนยัน
                          </button>{" "}
                        </>
                      )}
                      <button
                        form={`f-${r.id}`}
                        name="action"
                        value={ignoredMode ? "unignore" : "ignore"}
                        className="btn-ghost"
                      >
                        {ignoredMode ? "เอากลับเข้าคิว" : "ข้าม"}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {showBulk && rows.length > 0 && (
        <SubmitButton className="btn-ghost mt-2" pendingLabel="กำลังข้ามรายการที่เลือก…">
          ข้ามรายการที่เลือก<b>ในหน้านี้</b>
        </SubmitButton>
      )}
    </form>
  );
}
