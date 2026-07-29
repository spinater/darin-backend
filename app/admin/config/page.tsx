import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeTrainer } from "@/lib/normalize";

export const dynamic = "force-dynamic";

const RANKS = ["PT", "CT", "ST"];

export default async function ConfigPage() {
  await requireAdmin();

  const [configs, rates, classes, staff, aliases, sources, colors] = await Promise.all([
    db.payrollConfig.findMany({ orderBy: { key: "asc" } }),
    db.teachRate.findMany(),
    db.classPrice.findMany({ orderBy: { name: "asc" } }),
    db.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.trainerAlias.findMany({ include: { staff: true }, orderBy: { alias: "asc" } }),
    db.sheetSource.findMany({ orderBy: { sheetName: "asc" } }),
    db.colorRule.findMany({ orderBy: { hex: "asc" } }),
  ]);

  const activities = [...new Set([...rates.map((r) => r.activity), "yoga"])].sort();

  async function save(formData: FormData) {
    "use server";
    await requireAdmin();

    for (const [k, v] of formData.entries()) {
      const val = String(v).trim();
      const [kind, ...rest] = k.split("|");

      if (kind === "cfg") await db.payrollConfig.update({ where: { key: rest[0] }, data: { value: val } });
      else if (kind === "rate") {
        const [activity, rank] = rest;
        if (!val) await db.teachRate.deleteMany({ where: { activity, rank } });
        else
          await db.teachRate.upsert({
            where: { activity_rank: { activity, rank } },
            update: { rate: Number(val) },
            create: { activity, rank, rate: Number(val) },
          });
      } else if (kind === "class")
        await db.classPrice.update({ where: { id: rest[0] }, data: { price: Number(val) } });
      else if (kind === "staff") {
        const [id, field] = rest;
        await db.staff.update({
          where: { id },
          data:
            field === "rank"
              ? { rank: val || null }
              : { [field]: Number(val) },
        });
      } else if (kind === "sheet")
        await db.sheetSource.update({ where: { id: rest[0] }, data: { spreadsheetId: val } });
    }
    revalidatePath("/admin/config");
  }

  async function addActivity(formData: FormData) {
    "use server";
    await requireAdmin();
    const activity = String(formData.get("activity") ?? "").trim();
    if (!activity) return;
    for (const rank of RANKS)
      await db.teachRate.upsert({
        where: { activity_rank: { activity, rank } },
        update: {},
        create: { activity, rank, rate: 0 },
      });
    revalidatePath("/admin/config");
  }

  async function addAlias(formData: FormData) {
    "use server";
    await requireAdmin();
    const alias = normalizeTrainer(String(formData.get("alias") ?? ""));
    const staffId = String(formData.get("staffId") ?? "");
    if (!alias || !staffId) return;
    await db.trainerAlias.upsert({ where: { alias }, update: { staffId }, create: { alias, staffId } });
    revalidatePath("/admin/config");
  }

  async function addColor(formData: FormData) {
    "use server";
    await requireAdmin();
    const hex = String(formData.get("hex") ?? "").trim().toLowerCase();
    const meaning = String(formData.get("meaning") ?? "");
    if (!hex) return;
    await db.colorRule.upsert({
      where: { hex },
      update: { meaning, note: String(formData.get("note") ?? "") },
      create: { hex, meaning, note: String(formData.get("note") ?? "") },
    });
    revalidatePath("/admin/config");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">ตั้งค่า</h1>
      <p className="text-xs text-neutral-500">
        ทุกค่าในหน้านี้คือค่าที่ engine ใช้จริง — ไม่มีตัวเลขไหน hardcode ในโค้ด
      </p>

      <form action={save} className="flex flex-col gap-6">
        <section className="card">
          <h2 className="mb-2 font-medium">ตารางเรทค่าสอน (กิจกรรม × ระดับ)</h2>
          <table className="w-full max-w-xl">
            <thead>
              <tr>
                <th className="th">กิจกรรม</th>
                {RANKS.map((r) => (
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
                  {RANKS.map((r) => (
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
          <p className="mt-2 text-xs text-amber-700">
            ช่องว่าง = ยังไม่มีเรท → คาบของกิจกรรมนั้นจะไม่ถูกคิดเงินและขึ้นเตือนในสลิป
          </p>
        </section>

        <section className="card">
          <h2 className="mb-2 font-medium">พนักงาน</h2>
          <table className="w-full max-w-3xl">
            <thead>
              <tr>
                {["ชื่อ", "บทบาท", "ระดับ", "ฐานเงินเดือน", "เครดิตสอนคลาส"].map((h) => (
                  <th key={h} className="th">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="td">{s.name}</td>
                  <td className="td text-xs text-neutral-500">{s.role}</td>
                  <td className="td">
                    <select name={`staff|${s.id}|rank`} defaultValue={s.rank ?? ""} className="input">
                      <option value="">—</option>
                      {RANKS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="td">
                    <input
                      name={`staff|${s.id}|baseSalary`}
                      type="number"
                      defaultValue={s.baseSalary}
                      className="input w-28"
                    />
                  </td>
                  <td className="td">
                    <input
                      name={`staff|${s.id}|classCredit`}
                      type="number"
                      defaultValue={s.classCredit}
                      className="input w-28"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 className="mb-2 font-medium">ราคาคลาส Group</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {classes.map((c) => (
              <label key={c.id} className="flex items-center justify-between gap-2 text-sm">
                {c.name}
                <input
                  name={`class|${c.id}`}
                  type="number"
                  defaultValue={c.price}
                  className="input w-24"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="mb-2 font-medium">เกณฑ์ / เปอร์เซ็นต์ / OT</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {configs.map((c) => (
              <label key={c.key} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {c.note}
                  <span className="ml-1 font-mono text-xs text-neutral-400">{c.key}</span>
                </span>
                <input name={`cfg|${c.key}`} defaultValue={c.value} className="input w-28" />
              </label>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="mb-2 font-medium">Google Sheet</h2>
          {sources.map((s) => (
            <label key={s.id} className="flex items-center gap-2 py-1 text-sm">
              <span className="w-28">{s.sheetName}</span>
              <input
                name={`sheet|${s.id}`}
                defaultValue={s.spreadsheetId}
                className="input w-96 font-mono text-xs"
              />
            </label>
          ))}
        </section>

        <button className="btn self-start">บันทึกทั้งหมด</button>
      </form>

      <section className="card">
        <h2 className="mb-2 font-medium">เพิ่มกิจกรรมใหม่</h2>
        <form action={addActivity} className="flex gap-2">
          <input name="activity" placeholder="เช่น boxing" className="input" />
          <button className="btn-ghost">เพิ่ม</button>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-2 font-medium">ชื่อเทรนเนอร์ในชีต → พนักงาน</h2>
        <p className="mb-2 text-xs text-neutral-500">
          ชีต PT สะกดชื่อ 21 แบบสำหรับคน ~5 คน — ระบบ normalize (ตัดช่องว่าง/prefix PT/พี่) แล้วจับคู่ที่นี่
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
          <button className="btn-ghost">เพิ่ม</button>
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
            <span key={c.hex} className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-xs">
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
          <button className="btn-ghost">เพิ่ม</button>
        </form>
      </section>
    </div>
  );
}
