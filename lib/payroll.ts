import { num, pct, type Config } from "./config-keys";

export type StaffInput = {
  id: string;
  name: string;
  role: string; // owner | admin | counter | trainer
  rank: string | null; // ST | CT | PT
  baseSalary: number;
  classCredit: number;
  /**
   * Still employed. Read **only** to raise a warning — deactivation is an HR fact, not a rate, so
   * it may not move a single baht. See the first warning in `computePayslip` (task 013 item 3).
   */
  active: boolean;
};

export type SessionInput = { date: Date; activity: string };
export type ClassSessionInput = {
  className: string;
  price: number;
  booked: number;
  noShow: number;
};
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

/**
 * ปัดเงินครั้งเดียว ทศนิยม 2 ตำแหน่ง (§2 rule 5)
 *
 * 🔴 **As of task 011 this has no caller outside this file** — every use is internal to
 * `lib/payroll.ts`, and the export is kept so the rounding rule has one named home. It is **not** a
 * licence for a screen-side baht preview: computing money in `app/**` is a §2 rule 2 violation
 * (`computePayslip` is the only thing that turns raw input into an amount), which is why `/ot`'s
 * `เป็นเงิน` and `/classes`'s `มูลค่า` were deleted rather than re-plumbed.
 * See `.docs/knowledge/domain/payroll-rules.md` rule 4.
 */
export const money = (n: number) => Math.round(n * 100) / 100;

/**
 * `TeachRate` rows → the nested lookup `computePayslip` reads, as a **`Map` of `Map`s** (task 034).
 *
 * 🔴 **The `Map` is the fix, not a style choice.** `r.activity` is whatever an admin typed into
 * "เพิ่มกิจกรรมใหม่" — data, not a closed set (§2 rule 7) — so it arrives here unfiltered and there
 * is nothing to classify it against. Built into an object literal, the one name that is also a key
 * of `Object.prototype` broke both ends at once:
 *
 *   - **the write** — `(rates[activity] ??= {})[rank] = rate` finds the *inherited* object, which is
 *     not nullish, so `??=` assigned nothing and the rate landed on `Object.prototype` itself. That
 *     pollutes every object in the server process, outlives the request, and comes back on the next
 *     boot because the `TeachRate` rows are still there;
 *   - **the read** — every *other* activity then inherited that rate, so `rate == null` in
 *     `computePayslip` was false and the §2 rule 4 warning never fired. The line that used to say
 *     `ไม่มีเรทค่าสอน …` became a 0 ฿ line with `warnings: []` — a silent zero on a payslip, which
 *     the rulebook calls the most expensive failure this system has.
 *
 * A `Map` has no prototype chain to inherit through, so `__proto__` is **inert as a key of this
 * map** — that is the whole class of bug this removes, and it is why the name is not *also* filtered
 * in `addActivity`, which would be a second home for one decision (§4). ⚠️ **It does not make the
 * name validated.** The activity name is still unchecked at the write, and task 035 records a
 * *different* road to the same silent zero: a name containing `|` collides with the bulk-save field
 * encoding `rate|<activity>|<rank>` and overwrites another activity's rate with 0.
 *
 * Lives here rather than in `payroll-run.ts` so the engine's own test suite can build a real rate
 * map without importing `lib/db.ts` — §2 rule 2's "no DB" applies to what tests the money too.
 * Pure: no DB, no env, no clock, and the argument is not mutated.
 */
export function buildTeachRates(
  rates: readonly { activity: string; rank: string; rate: number }[],
): Map<string, Map<string, number>> {
  const byActivity = new Map<string, Map<string, number>>();
  for (const r of rates) {
    let byRank = byActivity.get(r.activity);
    if (!byRank) byActivity.set(r.activity, (byRank = new Map()));
    byRank.set(r.rank, r.rate);
  }
  return byActivity;
}

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
  /**
   * `teachRates.get(activity)?.get(rank)` — built by `buildTeachRates` above, and a **`Map`, never an
   * object literal**: the activity name is admin-typed data (§2 rule 7), and an object literal let
   * `__proto__` inherit a rate here, turning the rule 4 warning below into a silent 0 ฿ (task 034).
   */
  teachRates: ReadonlyMap<string, ReadonlyMap<string, number>>;
}): PayslipResult {
  const { staff, sessions, classSessions, sales, otEntries, config, teachRates } = input;
  const lines: Line[] = [];
  const warnings: string[] = [];

  // 0 ── A deactivated staff member still has this period owed to them — `runPayroll` selects them
  // when a slip exists or when they did payable work in it (task 013 item 3). Emitted first because
  // it qualifies the whole slip rather than one line of it, and worded to cover both routes in.
  //
  // 🔴 It changes **no amount**, and that is exactly why it has to name the risk. `base` below is a
  // full period of `baseSalary` — this engine has no pro-rating for anybody — so a leaver's slip
  // carries a whole month of base whether they worked one day of it or twenty. Whether that is
  // right is the owner's call, not the engine's: §2 rule 4 says the undecidable reaches the screen,
  // and both silent alternatives are worse than saying it (paying 0 "because they are inactive" is
  // the silent zero the rule forbids; inventing a daily rate is a literal in a formula, §2 rule 3).
  if (!staff.active)
    warnings.push(
      "พนักงานถูกปิดการใช้งานแล้ว แต่ยังมีงวดนี้ค้างอยู่ — ฐานเงินเดือนคิดเต็มงวด ไม่ได้หารตามสัดส่วนวันที่ทำงานจริง ⇒ ตรวจยอดก่อนอนุมัติ",
    );

  // 1 ── ฐานเงินเดือน
  const base = staff.baseSalary;
  if (base) lines.push({ group: "base", label: "ฐานเงินเดือน", qty: 1, rate: base, amount: base });

  // 🔴 **A base of 0 emits no line at all, and an absent line is the weakest signal a payslip has.**
  // Measured on real data (task 063): ประพัฒน์ พันธุ์โยศรี taught 5 คาบ in 1–21 Sep, every one with 0
  // attendees ⇒ `net 0.00` with `warnings: []` — a zero-baht slip for a man who taught five classes,
  // and nothing on it saying a number was never configured. That is the §2 rule 4 shape exactly: the
  // engine cannot know whether 0 is a choice, so it says so instead of rendering an empty slip.
  //
  // **Only for a `trainer`**, and the predicate is the point: the `owner` row is seeded at 0 on
  // purpose (`prisma/seed.ts`) and warning about it would train people to ignore this line. A
  // `counter` is left out for the same reason — nobody has said a counter must carry a base.
  //
  // ⚠️ It does **not** also warn about `classCredit` on a 0 base, though that pair is the more
  // expensive one (a credit deducts class value that a base never contained — card 062 §5 is that
  // question, open with linus). `/admin/config` renders both fields in one row, so the human who
  // follows this warning sees both; a second warning that pre-judges an undecided rule would be the
  // engine taking the owner's decision.
  if (staff.role === "trainer" && !base)
    warnings.push(
      "ยังไม่ได้ตั้งฐานเงินเดือนของเทรนเนอร์คนนี้ (0 บาท) — สลิปใบนี้จึงไม่มีบรรทัดฐานเงินเดือน ⇒ ตั้งฐานเงินเดือน (และเครดิตสอนคลาส) ที่หน้า /admin/config ก่อนอนุมัติ",
    );

  // 2 ── ค่าสอน 1-on-1 (Σ คาบ × เรทตามกิจกรรม/ระดับ)
  let teachPay = 0;
  const byActivity = new Map<string, number>();
  for (const s of sessions) byActivity.set(s.activity, (byActivity.get(s.activity) ?? 0) + 1);

  for (const [activity, qty] of [...byActivity].sort()) {
    const rate = staff.rank ? teachRates.get(activity)?.get(staff.rank) : undefined;
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
    // 🔴 `attended < 0` is **not** "nobody came" — it is a row that cannot be read at all
    // (`noShow` larger than `booked`, which stored before `/classes` refused the pair). It used to
    // fold into the `<= 0` branch and pay 0 ฿ with `warnings: []` — the silent zero §2 rule 4
    // forbids, ~800 ฿ off one slip for four such rows (task 025).
    //
    // It still pays **nothing**, and the reason is that the input is *unreadable*, not that a rule
    // is undecided: paying anything means guessing **which of the two counts is wrong**, and the
    // guesses pay differently. For `{price 400, booked 2, noShow 5}` — if the two fields were
    // transposed (`booked 5 / noShow 2`) that is 3 attended ⇒ **400 ฿**; if only `noShow` is wrong
    // and `booked 2` stands, it is at most 2 attended ⇒ **200 ฿**. The engine cannot pick between
    // them, so §2 rule 4 sends the คาบ to `warnings` — class, both counts, the negative result,
    // the price — and the human picks.
    if (attended < 0)
      warnings.push(
        `คลาส ${c.className}: no-show (${c.noShow}) มากกว่าคนจอง (${c.booked}) ⇒ คนเข้าจริงติดลบ (${attended}) — §1.4 ไม่ได้ครอบคลุมกรณีนี้ จึงยังไม่คิดเงินคาบนี้ (ราคา ${c.price}) ⇒ ลบคาบนี้แล้วคีย์ใหม่ที่หน้าคาบสอนคลาส Group`,
      );
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
          addComm(
            `คอม PT ${isSelfClosed(sale) ? "ปิดเอง" : "ปิดจากลีด"} — ${sale.productName}`,
            sale.netPrice,
            rate,
          );
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

      warnings.push(
        `บิล ${sale.productName}: ไม่รู้จักประเภทการขาย "${sale.kind}" — ยังไม่จ่ายคอม`,
      );
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
