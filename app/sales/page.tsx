import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
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
  searchParams: Promise<{ period?: string }>;
}) {
  await requireRole("owner", "admin", "counter");
  const period =
    (await searchParams).period ?? new Date().toISOString().slice(0, 7);

  const [sales, staff] = await Promise.all([
    db.sale.findMany({
      where: {
        date: {
          gte: new Date(`${period}-01T00:00:00Z`),
          lt: new Date(new Date(`${period}-01T00:00:00Z`).setUTCMonth(new Date(`${period}-01T00:00:00Z`).getUTCMonth() + 1)),
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
    const listPrice = String(formData.get("listPrice") ?? "").trim();

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
        listPrice: listPrice ? Number(listPrice) : null,
        netPrice: Number(formData.get("netPrice")),
        note: String(formData.get("note") ?? "") || null,
        attributions: { create: attributions },
      },
    });
    revalidatePath("/sales");
  }

  async function del(formData: FormData) {
    "use server";
    await requireRole("owner", "admin");
    await db.sale.delete({ where: { id: String(formData.get("id")) } });
    revalidatePath("/sales");
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

      <p className="text-xs text-neutral-500">
        จ่ายจริง &lt; ราคาเต็ม = ระบบถือว่าเป็นราคาโปรฯ (คอม 5%) · ไม่ใส่ราคาเต็ม = ถือว่าขายเต็มราคา
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
