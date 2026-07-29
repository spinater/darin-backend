import { db } from "./db";
import { fetchGrids, fetchPublicGrids, loadXlsxGrids, type RawGrid } from "./sheets";
import { parseGrid, type ColMap } from "./parser";

export type SyncResult = {
  sheetName: string;
  created: number;
  updated: number;
  skippedReviewed: number;
  ok: number;
  needsReview: number;
  ignored: number;
};

/**
 * ความคืบหน้าระหว่าง sync — ส่งให้หน้าเว็บแสดงผลตามจริง
 *
 * งานมี 2 ช่วงที่คอขวดคนละอย่าง จึงต้องแยกให้ผู้ใช้เห็น:
 *   fetch   = ดาวน์โหลดจาก Google (รอเน็ต ไม่รู้ล่วงหน้าว่านานแค่ไหน)
 *   process = เขียนลง DB (รู้จำนวนงานทั้งหมดแล้ว ประมาณเวลาที่เหลือได้)
 */
export type SyncProgress = {
  phase: "fetch" | "process";
  /** ชีตที่กำลังทำ (เฉพาะ process) */
  sheetName?: string;
  sheetIndex?: number;
  sheetCount?: number;
  /** หน่วยงานที่เขียนเสร็จแล้ว / ทั้งหมด (เฉพาะ process) */
  done: number;
  total: number;
};

/**
 * เหตุการณ์ที่ /api/sync ส่งกลับหน้าเว็บ บรรทัดละ 1 JSON (NDJSON)
 * อยู่ที่นี่เพื่อให้ทั้ง route และ component ฝั่ง client อ้างชนิดเดียวกัน
 */
export type SyncEvent =
  | (SyncProgress & { elapsedMs: number })
  | { phase: "done"; results: SyncResult[]; elapsedMs: number; fetchMs: number; processMs: number }
  | { phase: "error"; message: string; elapsedMs: number };

/** ส่ง progress ทุกกี่หน่วย — ถี่กว่านี้ก็ไม่ได้ช่วยให้คนอ่านทัน แต่ทำให้ stream หนักขึ้น */
const PROGRESS_EVERY = 50;

/**
 * ดึงข้อมูลจากชีต → เก็บดิบ → parse → upsert คาบสอน
 *
 * idempotent: key = (sourceId,rowIndex,colIndex) กดซ้ำกี่ครั้งก็ได้ผลเดิม
 * แถวที่คนตรวจแก้แล้ว (reviewed=true) จะไม่ถูกทับ
 */
export async function syncSources(
  opts: { xlsxPath?: string } = {},
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncResult[]> {
  const sources = await db.sheetSource.findMany({ where: { active: true } });
  if (!sources.length) return [];

  const aliases = new Map(
    (await db.trainerAlias.findMany()).map((a) => [a.alias, a.staffId] as const),
  );
  const colorRules = new Map(
    (await db.colorRule.findMany()).map((c) => [c.hex.toLowerCase(), c.meaning] as const),
  );

  onProgress?.({ phase: "fetch", done: 0, total: 0 });

  const names = sources.map((s) => s.sheetName);
  let grids: RawGrid[];
  if (opts.xlsxPath) {
    grids = await loadXlsxGrids(opts.xlsxPath, names);
  } else {
    const byId = new Map<string, string[]>();
    for (const s of sources) byId.set(s.spreadsheetId, [...(byId.get(s.spreadsheetId) ?? []), s.sheetName]);
    // มี service account → ใช้ API (ได้ note ด้วย) · ไม่มี → export endpoint สาธารณะ (ได้ serial + สี)
    const hasSA = !!(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY);
    grids = (
      await Promise.all(
        [...byId].map(([id, ns]) => (hasSA ? fetchGrids(id, ns) : fetchPublicGrids(id, ns))),
      )
    ).flat();
  }

  // parse ทุกชีตให้จบก่อนเริ่มเขียน DB — เป็นงานในหน่วยความจำล้วน เร็วมาก
  // แต่ทำให้รู้ "จำนวนงานทั้งหมด" ตั้งแต่ต้น ถ้า parse ไปเขียนไปจะบอก total ไม่ได้
  // จนกว่าจะทำไปแล้วครึ่งทาง → progress bar กระโดดและประมาณเวลาไม่ได้
  const plan = sources.flatMap((source) => {
    const grid = grids.find((g) => g.sheetName === source.sheetName);
    if (!grid) return [];
    const parsed = parseGrid(grid, source.colMap as unknown as ColMap, source.headerRows, aliases);
    return [{ source, grid, parsed }];
  });

  const total = plan.reduce((n, p) => n + p.grid.rows.length + p.parsed.length, 0);
  let done = 0;
  let lastEmit = 0;
  const tick = (sheetName: string, sheetIndex: number) => {
    if (done - lastEmit < PROGRESS_EVERY && done !== total) return;
    lastEmit = done;
    onProgress?.({
      phase: "process",
      sheetName,
      sheetIndex,
      sheetCount: plan.length,
      done,
      total,
    });
  };

  const results: SyncResult[] = [];

  for (const [sheetIndex, { source, grid, parsed }] of plan.entries()) {
    lastEmit = -PROGRESS_EVERY; // บังคับให้ส่ง 1 ครั้งตอนขึ้นชีตใหม่ ชื่อชีตจะได้อัปเดตทันที
    tick(source.sheetName, sheetIndex);

    await db.$transaction(
      grid.rows.map((cells, rowIndex) =>
        db.sheetRowRaw.upsert({
          where: { sourceId_rowIndex: { sourceId: source.id, rowIndex } },
          update: { cells: cells as any, syncedAt: new Date() },
          create: { sourceId: source.id, rowIndex, cells: cells as any },
        }),
      ),
    );
    // ทั้งก้อนเป็น transaction เดียว รายงานได้ทีเดียวตอนจบ (จะแบ่งย่อยเพื่อให้แถบเดินสวย
    // ไม่ได้ — เท่ากับยอมให้ข้อมูลดิบเขียนค้างครึ่งๆ กลางๆ ตอนพัง)
    done += grid.rows.length;
    tick(source.sheetName, sheetIndex);

    const res: SyncResult = {
      sheetName: source.sheetName,
      created: 0,
      updated: 0,
      skippedReviewed: 0,
      ok: 0,
      needsReview: 0,
      ignored: 0,
    };

    const existing = new Map(
      (
        await db.teachSession.findMany({
          where: { sourceId: source.id },
          select: { rowIndex: true, colIndex: true, reviewed: true, rawValue: true },
        })
      ).map((s) => [`${s.rowIndex}:${s.colIndex}`, s]),
    );

    for (const p of parsed) {
      // สีที่ admin ตั้งกฎว่า "ไม่ต้องจ่าย" (§1.6)
      let status = p.status;
      let reviewNote = p.reviewNote;
      const rule = p.bgColor ? colorRules.get(p.bgColor.toLowerCase()) : undefined;
      if (rule === "skip") {
        status = "ignored";
        reviewNote = `สีในชีตระบุว่าไม่ต้องจ่าย (${p.bgColor})`;
      } else if (rule === "review" && status === "ok") {
        status = "needs_review";
        reviewNote = `สีในชีตต้องให้คนตรวจ (${p.bgColor})`;
      }

      const key = `${p.rowIndex}:${p.colIndex}`;
      const prev = existing.get(key);

      if (prev?.reviewed) {
        // คนแก้แล้ว — ทับไม่ได้ แต่ถ้าค่าดิบในชีตเปลี่ยน ต้องบอกให้รู้
        if (prev.rawValue !== p.rawValue)
          await db.teachSession.update({
            where: { sourceId_rowIndex_colIndex: { sourceId: source.id, rowIndex: p.rowIndex, colIndex: p.colIndex } },
            data: {
              status: "needs_review",
              reviewed: false,
              reviewNote: `ค่าในชีตเปลี่ยนหลังตรวจแล้ว: "${prev.rawValue}" → "${p.rawValue}"`,
            },
          });
        res.skippedReviewed++;
        done++;
        tick(source.sheetName, sheetIndex);
        continue;
      }

      const data = {
        date: p.date,
        activity: source.activity,
        staffId: p.staffId,
        customerName: p.customerName,
        customerPhone: p.customerPhone,
        rawValue: p.rawValue,
        bgColor: p.bgColor ?? null,
        status,
        reviewNote: reviewNote ?? null,
      };
      await db.teachSession.upsert({
        where: { sourceId_rowIndex_colIndex: { sourceId: source.id, rowIndex: p.rowIndex, colIndex: p.colIndex } },
        update: data,
        create: { sourceId: source.id, rowIndex: p.rowIndex, colIndex: p.colIndex, ...data },
      });
      prev ? res.updated++ : res.created++;
      if (status === "ok") res.ok++;
      else if (status === "ignored") res.ignored++;
      else res.needsReview++;
      done++;
      tick(source.sheetName, sheetIndex);
    }

    await db.sheetSource.update({ where: { id: source.id }, data: { lastSyncAt: new Date() } });
    results.push(res);
  }
  return results;
}
