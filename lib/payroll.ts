import { num, pct, type Config } from "./config-keys";

export type StaffInput = {
  id: string;
  name: string;
  role: string; // owner | admin | counter | trainer
  rank: string | null; // ST | CT | PT
  baseSalary: number;
  classCredit: number;
};

export type SessionInput = { date: Date; activity: string };
export type ClassSessionInput = { className: string; price: number; booked: number; noShow: number };
export type SaleInput = {
  id: string;
  kind: string; // pt | membership | course_ext | freeze
  tier: string | null; // basic | premium | platinum | pilates
  productName: string;
  listPrice: number | null;
  netPrice: number;
  /** ทุกคนที่ได้ส่วนแบ่งจากบิลนี้ (ใช้ตัดสินว่า closer ปิดเองหรือมีคนส่งลีด) */
  attributions: { staffId: string; role: string }[];
};
export type OtInput = { date: Date; hours: number };

export type Line = { group: string; label: string; qty: number; rate: number; amount: number };

export type PayslipResult = {
  base: number;
  teachPay: number;
  classPay: number;
  commission: number;
  otPay: number;
  net: number;
  lines: Line[];
  /** สิ่งที่ engine ไม่กล้าตัดสินเอง — ต้องขึ้นหน้าจอให้คนเห็น ห้ามกลืน */
  warnings: string[];
};

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * คิดเงินเดือน 1 คน 1 งวด (§1.7 / §2.5)
 *
 * pure function — ไม่แตะ DB ทุกตัวเลขมาจาก config ไม่มี literal ในไฟล์นี้
 * ทุกอย่างที่ตัดสินไม่ได้จะเข้า warnings ไม่ใช่กลายเป็น 0 เงียบๆ
 */
export function computePayslip(input: {
  staff: StaffInput;
  sessions: SessionInput[];
  classSessions: ClassSessionInput[];
  sales: SaleInput[];
  otEntries: OtInput[];
  config: Config;
  /** teachRates[activity][rank] */
  teachRates: Record<string, Record<string, number>>;
}): PayslipResult {
  const { staff, sessions, classSessions, sales, otEntries, config, teachRates } = input;
  const lines: Line[] = [];
  const warnings: string[] = [];

  // 1 ── ฐานเงินเดือน
  const base = staff.baseSalary;
  if (base) lines.push({ group: "base", label: "ฐานเงินเดือน", qty: 1, rate: base, amount: base });

  // 2 ── ค่าสอน 1-on-1 (Σ คาบ × เรทตามกิจกรรม/ระดับ)
  let teachPay = 0;
  const byActivity = new Map<string, number>();
  for (const s of sessions) byActivity.set(s.activity, (byActivity.get(s.activity) ?? 0) + 1);

  for (const [activity, qty] of [...byActivity].sort()) {
    const rate = staff.rank ? teachRates[activity]?.[staff.rank] : undefined;
    if (rate == null) {
      warnings.push(
        `ไม่มีเรทค่าสอน ${activity} × ${staff.rank ?? "(ไม่ได้ตั้งระดับ)"} — ${qty} คาบยังไม่ถูกคิดเงิน`,
      );
      continue;
    }
    const amount = money(qty * rate);
    teachPay += amount;
    lines.push({ group: "teach", label: `ค่าสอน ${activity}`, qty, rate, amount });
  }

  // 3 ── ค่าสอนคลาส Group: คนเข้าจริง 0 = 0 · 1..(min-1) = ครึ่งราคา · ≥min = เต็ม
  const minAtt = num(config, "class.minAttendees");
  const halfRatio = num(config, "class.halfRatio");
  let classValue = 0;
  const byClass = new Map<string, { qty: number; amount: number }>();

  for (const c of classSessions) {
    const attended = c.booked - c.noShow;
    const ratio = attended <= 0 ? 0 : attended < minAtt ? halfRatio : 1;
    const amount = money(c.price * ratio);
    classValue += amount;
    const cur = byClass.get(c.className) ?? { qty: 0, amount: 0 };
    byClass.set(c.className, { qty: cur.qty + 1, amount: money(cur.amount + amount) });
  }
  for (const [name, v] of [...byClass].sort())
    lines.push({
      group: "class",
      label: `คลาส ${name}`,
      qty: v.qty,
      rate: v.qty ? money(v.amount / v.qty) : 0,
      amount: v.amount,
    });

  const classPay = money(Math.max(0, classValue - staff.classCredit));
  if (classValue || staff.classCredit)
    lines.push({
      group: "class",
      label: `หักเครดิตสอนคลาส (มูลค่าคลาสรวม ${money(classValue)})`,
      qty: 1,
      rate: -staff.classCredit,
      amount: money(classPay - classValue),
    });

  // 4 ── ค่าคอม
  const mine = sales
    .map((sale) => ({ sale, roles: sale.attributions.filter((a) => a.staffId === staff.id) }))
    .filter((x) => x.roles.length > 0);

  // incentive: ดูยอด PT ที่ "ปิดเอง" ทั้งเดือนก่อน แล้วใช้อัตราย้อนหลังทั้งเดือน
  const isSelfClosed = (sale: SaleInput) =>
    sale.attributions.every((a) => a.role === "closer") &&
    sale.attributions.some((a) => a.staffId === staff.id && a.role === "closer");

  const selfClosedTotal = mine
    .filter((x) => x.sale.kind === "pt" && isSelfClosed(x.sale))
    .reduce((s, x) => s + x.sale.netPrice, 0);

  const hitIncentive = selfClosedTotal >= num(config, "incentive.threshold");
  const selfRateKey = staff.role === "counter" ? "comm.pt.counterSelf" : "comm.pt.selfClosed";
  const selfPct = hitIncentive ? pct(config, "incentive.rate") : pct(config, selfRateKey);
  if (hitIncentive)
    lines.push({
      group: "commission",
      label: `ถึงเกณฑ์ incentive (ยอดปิดเอง ${money(selfClosedTotal)} ≥ ${num(config, "incentive.threshold")}) → ใช้ ${num(config, "incentive.rate")}% ย้อนหลังทั้งเดือน`,
      qty: 0,
      rate: 0,
      amount: 0,
    });

  let commission = 0;
  const addComm = (label: string, base: number, rate: number) => {
    const amount = money(base * rate);
    commission += amount;
    lines.push({ group: "commission", label, qty: money(base), rate: money(rate * 100), amount });
  };

  for (const { sale, roles } of mine) {
    // §3 — ค่าต่ออายุคอร์ส / freeze เป็นรายได้ยิมทั้งหมด ไม่มีคอมให้ใคร
    if (sale.kind === "course_ext" || sale.kind === "freeze") continue;

    for (const { role } of roles) {
      if (sale.kind === "pt") {
        if (role === "closer") {
          const rate = isSelfClosed(sale) ? selfPct : pct(config, "comm.pt.leadTrainer");
          addComm(`คอม PT ${isSelfClosed(sale) ? "ปิดเอง" : "ปิดจากลีด"} — ${sale.productName}`, sale.netPrice, rate);
        } else {
          addComm(
            `คอม PT ${role === "content_owner" ? "เจ้าของคลิป" : "ส่งลีด"} — ${sale.productName}`,
            sale.netPrice,
            pct(config, "comm.pt.leadReferrer"),
          );
        }
        continue;
      }

      if (sale.kind === "membership") {
        if (role !== "closer") {
          warnings.push(
            `บิล ${sale.productName}: ยังไม่มีกฎคอมสำหรับบทบาท "${role}" ในการขายสมาชิก (§7 ข้อ 8) — ยังไม่จ่าย`,
          );
          continue;
        }
        const isPromo = sale.listPrice != null && sale.netPrice < sale.listPrice;
        const key = isPromo
          ? "comm.membership.promo"
          : sale.tier === "basic"
            ? "comm.membership.basic"
            : "comm.membership.full";
        addComm(
          `คอมสมาชิก ${isPromo ? "ราคาโปรฯ" : (sale.tier ?? "ราคาเต็ม")} — ${sale.productName}`,
          sale.netPrice,
          pct(config, key),
        );
        continue;
      }

      warnings.push(`บิล ${sale.productName}: ไม่รู้จักประเภทการขาย "${sale.kind}" — ยังไม่จ่ายคอม`);
    }
  }

  // 5 ── OT: คิดรายวัน (ไม่ใช่รวมทั้งเดือนแล้วค่อยลบเกณฑ์)
  const otThreshold = num(config, "ot.thresholdHours");
  const otRate = num(config, "ot.ratePerHour");
  const otHours = otEntries.reduce((s, e) => s + Math.max(0, e.hours - otThreshold), 0);
  const otPay = money(otHours * otRate);
  if (otHours)
    lines.push({ group: "ot", label: "OT", qty: money(otHours), rate: otRate, amount: otPay });

  const net = money(base + teachPay + classPay + commission + otPay);
  return {
    base,
    teachPay: money(teachPay),
    classPay,
    commission: money(commission),
    otPay,
    net,
    lines,
    warnings,
  };
}
