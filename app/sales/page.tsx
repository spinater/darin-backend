import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { finiteNumber, isBlank } from "@/lib/form-number";
import { SubmitButton } from "@/app/_components/submit-button";

export const dynamic = "force-dynamic";

const KINDS = [
  ["pt", "แพ็ค PT"],
  ["membership", "สมาชิก"],
  ["course_ext", "ต่ออายุคอร์ส (ไม่มีคอม)"],
  ["freeze", "Freeze (ไม่มีคอม)"],
] as const;

const ROLES = [
  ["closer", "ผู้ปิดการขาย"],
  ["referrer", "ผู้ส่งลีด"],
  ["content_owner", "เจ้าของคลิป"],
] as const;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; err?: string }>;
}) {
  await requireRole("owner", "admin", "counter");
  // `err` is a **flag**, never the message — same precedent as `/ot` and `/payslips`: the Thai copy
  // lives in this file (§2.5) and nothing the URL carries is rendered, so a crafted link cannot put
  // words on a counter staff member's screen.
  const { period: periodParam, err } = await searchParams;
  const period = periodParam ?? new Date().toISOString().slice(0, 7);

  const [sales, staff] = await Promise.all([
    db.sale.findMany({
      where: {
        date: {
          gte: new Date(`${period}-01T00:00:00Z`),
          lt: new Date(
            new Date(`${period}-01T00:00:00Z`).setUTCMonth(
              new Date(`${period}-01T00:00:00Z`).getUTCMonth() + 1,
            ),
          ),
        },
      },
      include: { attributions: { include: { staff: true } } },
      orderBy: { date: "desc" },
    }),
    db.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  async function add(formData: FormData) {
    "use server";
    await requireRole("owner", "admin", "counter");

    // 🔴 Both prices go through `finiteNumber` (`lib/form-number.ts`), never `Number()`: this form
    // is the only source of the commission base, so an absent field's silent `0` or a `File`
    // part's `NaN` reaches `Sale.netPrice` → every commission, the incentive threshold and the
    // period total on `/payslips` (CLAUDE.md §2 rule 4). Refused before the write, said on screen.
    const netPrice = finiteNumber(formData.get("netPrice"));
    if (netPrice === null) redirect(`/sales?period=${encodeURIComponent(period)}&err=netPrice`);

    // ราคาเต็ม is genuinely optional — "ไม่ใส่ราคาเต็ม = ถือว่าขายเต็มราคา" is printed under the
    // form — so absent-or-blank stays `null` and is not an error. Anything else that is not a
    // non-negative finite number is **refused**, never quietly demoted to "no list price": that
    // demotion turns a promo sale into a full-price one and changes the commission rate with it.
    const listRaw = formData.get("listPrice");
    const listPrice = isBlank(listRaw) ? null : finiteNumber(listRaw);
    if (listPrice === null && !isBlank(listRaw))
      redirect(`/sales?period=${encodeURIComponent(period)}&err=listPrice`);

    const attributions = ROLES.flatMap(([role]) => {
      const id = String(formData.get(role) ?? "");
      return id ? [{ staffId: id, role }] : [];
    });

    await db.sale.create({
      data: {
        date: new Date(String(formData.get("date")) + "T00:00:00Z"),
        kind: String(formData.get("kind")),
        tier: String(formData.get("tier") ?? "") || null,
        productName: String(formData.get("productName")),
        listPrice,
        netPrice,
        note: String(formData.get("note") ?? "") || null,
        attributions: { create: attributions },
      },
    });
    revalidatePath("/sales");
    // Back to the clean URL so a later successful save clears a sticky `err=` — without it the
    // rejection notice would outlive the bill that caused it.
    redirect(`/sales?period=${encodeURIComponent(period)}`);
  }

  async function del(formData: FormData) {
    "use server";
    await requireRole("owner", "admin");
    await db.sale.delete({ where: { id: String(formData.get("id")) } });
    revalidatePath("/sales");
    // Clean URL like `add`: deleting a bill while `?err=netPrice` is in the address bar would leave
    // "บิลนี้ยังไม่ถูกบันทึก" standing over a delete that did happen.
    redirect(`/sales?period=${encodeURIComponent(period)}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">ยอดขาย (ฐานคำนวณค่าคอม)</h1>
      <p className="text-xs text-neutral-500">
        ตารางสอนใน Google Sheet ไม่มีข้อมูลราคาเลย — ค่าคอมทั้งหมดคำนวณจากบิลที่คีย์ในหน้านี้
      </p>

      <form action={add} className="card grid gap-2 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          วันที่
          <input name="date" type="date" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ประเภท
          <select name="kind" className="input">
            {KINDS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ระดับสมาชิก
          <select name="tier" className="input">
            <option value="">—</option>
            {["basic", "premium", "platinum", "pilates"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ชื่อสินค้า
          <input name="productName" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ราคาเต็มใน catalog
          <input name="listPrice" type="number" step="0.01" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          ราคาจ่ายจริง (ฐานคิดคอม)
          <input name="netPrice" type="number" step="0.01" required className="input" />
        </label>
        {ROLES.map(([role, label]) => (
          <label key={role} className="flex flex-col gap-1 text-xs text-neutral-500">
            {label}
            <select name={role} className="input">
              <option value="">—</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="flex flex-col gap-1 text-xs text-neutral-500 md:col-span-3">
          หมายเหตุ
          <input name="note" className="input" />
        </label>
        <SubmitButton className="btn self-end" pendingLabel="กำลังบันทึก…">
          บันทึกบิล
        </SubmitButton>
      </form>

      {/* One flag per refused field, so the notice can name the field without ever rendering
          anything the URL carried. Both say the same two things `/ot` says: what was refused, and
          that **nothing was saved** — a bill the counter believes is in is the failure mode here. */}
      {err === "netPrice" && (
        <p className="card-warn text-sm">
          ⚠️ ราคาจ่ายจริงไม่ใช่ตัวเลข หรือติดลบ — <b>บิลนี้ยังไม่ถูกบันทึก</b> ตรวจช่อง
          “ราคาจ่ายจริง (ฐานคิดคอม)” แล้วบันทึกอีกครั้ง
        </p>
      )}
      {err === "listPrice" && (
        <p className="card-warn text-sm">
          ⚠️ ราคาเต็มใน catalog ไม่ใช่ตัวเลข หรือติดลบ — <b>บิลนี้ยังไม่ถูกบันทึก</b> ตรวจช่อง
          “ราคาเต็มใน catalog” หรือเว้นว่างไว้ถ้าขายเต็มราคา แล้วบันทึกอีกครั้ง
        </p>
      )}

      <p className="text-xs text-neutral-500">
        จ่ายจริง &lt; ราคาเต็ม = ระบบถือว่าเป็นราคาโปรฯ (คอม 5%) · ไม่ใส่ราคาเต็ม =
        ถือว่าขายเต็มราคา
      </p>

      <table className="card w-full">
        <thead>
          <tr>
            {["วันที่", "ประเภท", "สินค้า", "ราคาเต็ม", "จ่ายจริง", "ผู้ได้คอม", ""].map((h) => (
              <th key={h} className="th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id}>
              <td className="td">{s.date.toISOString().slice(0, 10)}</td>
              <td className="td text-xs">
                {s.kind}
                {s.tier ? `/${s.tier}` : ""}
              </td>
              <td className="td">{s.productName}</td>
              <td className="td">{s.listPrice ?? "—"}</td>
              <td className="td">{s.netPrice.toLocaleString("th-TH")}</td>
              <td className="td text-xs">
                {s.attributions.map((a) => `${a.staff.name} (${a.role})`).join(", ") || "—"}
              </td>
              <td className="td">
                <form action={del}>
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton className="btn-ghost" pendingLabel="กำลังลบ…">
                    ลบ
                  </SubmitButton>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
