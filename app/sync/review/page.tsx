import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { NEEDS_ATTENTION } from "@/lib/payroll-run";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sheet?: string }>;
}) {
  await requireAdmin();
  const { page = "1", sheet } = await searchParams;
  const skip = (Number(page) - 1) * PAGE_SIZE;

  const where = { ...NEEDS_ATTENTION, ...(sheet ? { source: { sheetName: sheet } } : {}) };
  const [rows, total, trainers, sources] = await Promise.all([
    db.teachSession.findMany({
      where,
      include: { source: { select: { sheetName: true } } },
      orderBy: [{ sourceId: "asc" }, { rowIndex: "asc" }, { colIndex: "asc" }],
      skip,
      take: PAGE_SIZE,
    }),
    db.teachSession.count({ where }),
    db.staff.findMany({ where: { role: "trainer", active: true }, orderBy: { name: "asc" } }),
    db.sheetSource.findMany({ orderBy: { sheetName: "asc" } }),
  ]);

  async function resolve(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id"));
    const action = String(formData.get("action"));

    if (action === "ignore") {
      await db.teachSession.update({
        where: { id },
        data: { status: "ignored", reviewed: true, reviewNote: "คนตรวจสั่งข้าม" },
      });
    } else {
      const dateStr = String(formData.get("date") ?? "");
      const staffId = String(formData.get("staffId") ?? "");
      if (!dateStr || !staffId) return; // ต้องครบทั้งคู่ถึงจะจ่ายได้
      await db.teachSession.update({
        where: { id },
        data: {
          date: new Date(dateStr + "T00:00:00Z"),
          staffId,
          status: "ok",
          reviewed: true,
          reviewNote: "คนตรวจยืนยันแล้ว",
        },
      });
    }
    revalidatePath("/sync/review");
  }

  async function bulkIgnore(formData: FormData) {
    "use server";
    await requireAdmin();
    const ids = formData.getAll("bulk").map(String);
    if (ids.length)
      await db.teachSession.updateMany({
        where: { id: { in: ids } },
        data: { status: "ignored", reviewed: true, reviewNote: "คนตรวจสั่งข้าม (หลายรายการ)" },
      });
    revalidatePath("/sync/review");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">คิวรอตรวจ</h1>
        <span className="text-sm text-neutral-500">{total} รายการ</span>
      </div>
      <p className="text-xs text-neutral-500">
        คาบที่ระบบไม่กล้าตัดสินเอง — ต้องระบุ <b>วันที่ + ผู้สอน</b> ให้ครบถึงจะนับเข้าเงินเดือน
        หรือกดข้ามถ้าไม่ใช่คาบสอน
      </p>

      <div className="flex flex-wrap gap-1 text-sm">
        <a href="/sync/review" className={sheet ? "btn-ghost" : "btn"}>
          ทุกชีต
        </a>
        {sources.map((s) => (
          <a
            key={s.id}
            href={`/sync/review?sheet=${encodeURIComponent(s.sheetName)}`}
            className={sheet === s.sheetName ? "btn" : "btn-ghost"}
          >
            {s.sheetName}
          </a>
        ))}
      </div>

      <form action={bulkIgnore}>
        <table className="card w-full">
          <thead>
            <tr>
              {["", "ชีต", "แถว", "ค่าในชีต", "ลูกค้า", "เหตุผล", "วันที่", "ผู้สอน", ""].map((h, i) => (
                <th key={i} className="th">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td">
                  <input type="checkbox" name="bulk" value={r.id} />
                </td>
                <td className="td whitespace-nowrap text-xs text-neutral-500">
                  {r.source.sheetName}
                </td>
                <td className="td text-xs text-neutral-400">
                  {r.rowIndex + 1}:{r.colIndex + 1}
                </td>
                <td className="td font-mono text-xs">{r.rawValue}</td>
                <td className="td max-w-40 truncate text-xs">{r.customerName ?? "—"}</td>
                <td className="td max-w-56 text-xs text-amber-700">{r.reviewNote}</td>
                <td className="td">
                  <input
                    form={`f-${r.id}`}
                    type="date"
                    name="date"
                    defaultValue={r.date?.toISOString().slice(0, 10)}
                    className="input"
                  />
                </td>
                <td className="td">
                  <select form={`f-${r.id}`} name="staffId" defaultValue={r.staffId ?? ""} className="input">
                    <option value="">— เลือก —</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="td whitespace-nowrap">
                  <button form={`f-${r.id}`} name="action" value="ok" className="btn">
                    ยืนยัน
                  </button>{" "}
                  <button form={`f-${r.id}`} name="action" value="ignore" className="btn-ghost">
                    ข้าม
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 0 && (
          <button className="btn-ghost mt-2">ข้ามรายการที่เลือกทั้งหมด</button>
        )}
      </form>

      {rows.map((r) => (
        <form key={r.id} id={`f-${r.id}`} action={resolve} className="hidden">
          <input type="hidden" name="id" value={r.id} />
        </form>
      ))}

      <div className="flex gap-2">
        {Number(page) > 1 && (
          <a href={`?page=${Number(page) - 1}${sheet ? `&sheet=${sheet}` : ""}`} className="btn-ghost">
            ก่อนหน้า
          </a>
        )}
        {skip + PAGE_SIZE < total && (
          <a href={`?page=${Number(page) + 1}${sheet ? `&sheet=${sheet}` : ""}`} className="btn-ghost">
            ถัดไป ({skip + PAGE_SIZE}/{total})
          </a>
        )}
      </div>
    </div>
  );
}
