#!/usr/bin/env bun
/**
 * check-knowledge — keep the OKF context cards in `.claude/knowledge/` honest.
 *
 * The cards exist so an agent can read ~100 lines instead of grepping all of `lib/` and
 * `app/`. That only works if a card can never quietly describe code that has since moved
 * on, so this script fails the verify gate when a covered source file is newer than its card.
 *
 * Staleness is decided by git commit time, not by a stored hash or timestamp:
 *
 *     mtime(p) = isDirty(p) ? +Infinity : epochOfLastCommitTouching(p)
 *     STALE   <=>  max(mtime(s) for s in sources)  >  mtime(card)
 *
 * Card and source committed together get an identical committer time, so the check
 * passes with zero bookkeeping — that is workflow rule 3 expressed as an equation. A
 * source dirty in the working tree is +Infinity, so drift is caught before you commit
 * (and a card edited in the same dirty tree is +Infinity too, which is why editing both
 * together is always green). A stored hash cannot do this: the commit that will contain
 * both does not exist yet at the moment you edit the card, so any hand-written value is
 * stale the instant it lands.
 *
 *   bun scripts/check-knowledge.ts           # full report
 *   bun scripts/check-knowledge.ts --quiet   # errors + stale only, no coverage section
 *
 * See .github/instructions/knowledge.instructions.md for the card contract.
 */

import { existsSync } from "node:fs";

const BUNDLE = ".claude/knowledge";
const MAX_CARD_LINES = 200;
const MAX_DESCRIPTION = 200;
const RESERVED = new Set(["index.md"]);

/**
 * Source files that must each be covered by exactly one card. An uncovered file is a
 * hole an agent will fall into by grepping instead of reading, so a new source file has
 * to be claimed by some card before it can ship.
 *
 * `generated/**` is absent by construction — it is gitignored and the file list below
 * comes from `git ls-files --exclude-standard`.
 */
const COVERAGE = [
  "lib/**/*.ts",
  "app/**/*.ts",
  "app/**/*.tsx",
  "prisma/**/*.ts",
  "scripts/**/*.ts",
  "*.ts",
];
const COVERAGE_EXEMPT = ["**/*.d.ts"];
const COVERAGE_FAILS = true;

type Commit = { epoch: number; sha: string; subject: string };

function sh(cmd: string[]): string {
  const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed: ${p.stderr.toString().trim()}`);
  }
  return p.stdout.toString();
}

function countLines(text: string): number {
  if (text === "") return 0;
  const n = text.split("\n").length;
  return text.endsWith("\n") ? n - 1 : n;
}

function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((p) => new Bun.Glob(p).match(path));
}

const root = sh(["git", "rev-parse", "--show-toplevel"]).trim();
const git = (...args: string[]) => sh(["git", "-C", root, ...args]);

// ---------------------------------------------------------------------------
// Shallow-clone guard. In a shallow clone every file reports the single grafted
// commit's timestamp, so `max(sources) > card` is never true and this check would
// pass vacuously while appearing green. Any CI that checks out with depth 1 would
// silently kill this gate — the exact failure mode the cards exist to prevent.
// ---------------------------------------------------------------------------
if (git("rev-parse", "--is-shallow-repository").trim() === "true") {
  console.error(
    "check-knowledge: refusing to run in a shallow clone.\n\n" +
      "  Card freshness is decided by per-file git commit times. A shallow clone reports\n" +
      "  the same timestamp for every file, so this check would pass without checking\n" +
      "  anything. Fetch full history (`git fetch --unshallow`, or actions/checkout with\n" +
      "  `fetch-depth: 0`).",
  );
  process.exit(1);
}

// ---- one pass over history: path -> the last commit that touched it ----------
const lastCommit = new Map<string, Commit>();
for (const block of git("log", "--format=%x01%ct %h %s", "--name-only", "--no-renames", "HEAD")
  .split("\x01")
  .slice(1)) {
  const [header, ...rest] = block.split("\n");
  const [epoch, sha, ...subject] = header!.split(" ");
  for (const path of rest) {
    // `git log` is newest-first, so the first sighting of a path is its latest commit.
    if (path !== "" && !lastCommit.has(path)) {
      lastCommit.set(path, { epoch: Number(epoch), sha: sha!, subject: subject.join(" ") });
    }
  }
}

// ---- working-tree changes count as "newer than any commit" -------------------
const dirty = new Set<string>();
{
  // `--untracked-files=all` is required, not cosmetic: without it git collapses a wholly
  // untracked directory into one entry (`?? app/api/`) instead of listing the files inside.
  // A card claiming `app/api/sync/route.ts` would then miss the dirty set, fall through to
  // the committed-source branch, and crash on a file that has no commit yet.
  const tokens = git("status", "--porcelain=v1", "-z", "--untracked-files=all").split("\0");
  for (let i = 0; i < tokens.length; i++) {
    const entry = tokens[i];
    if (!entry) continue;
    dirty.add(entry.slice(3));
    // Renames/copies emit the origin path as a second NUL-separated token.
    if (entry[0] === "R" || entry[0] === "C") {
      const origin = tokens[++i];
      if (origin) dirty.add(origin);
    }
  }
}

const mtime = (p: string): number =>
  dirty.has(p) ? Number.POSITIVE_INFINITY : (lastCommit.get(p)?.epoch ?? Number.POSITIVE_INFINITY);

// `ls-files -c` reads the index, which still lists a file deleted from the working
// tree but not yet staged. Such a path is not a source file — drop it, or a split
// that removes the original reports it as uncovered forever.
const allFiles = git("ls-files", "-z", "-co", "--exclude-standard")
  .split("\0")
  .filter((p) => p !== "")
  .filter((p) => existsSync(`${root}/${p}`));

const cards = allFiles
  .filter((p) => p.startsWith(`${BUNDLE}/`) && p.endsWith(".md"))
  .filter((p) => !RESERVED.has(p.split("/").pop()!))
  .sort();

type Problem = { card: string; message: string };
const errors: Problem[] = [];
const stale: string[] = [];
/** source path -> the cards claiming it, so "covered by exactly one card" is checkable */
const covered = new Map<string, string[]>();

function parseFrontmatter(text: string): Record<string, unknown> | null {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end === -1) return null;
  const parsed = Bun.YAML.parse(text.slice(4, end));
  return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
}

/** OKF allows `sources` entries to be objects; we use plain strings. Accept both. */
function normalizeSources(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => {
      if (typeof e === "string") return e;
      if (e && typeof e === "object") {
        const o = e as Record<string, unknown>;
        return typeof o.path === "string" ? o.path : typeof o.id === "string" ? o.id : "";
      }
      return "";
    })
    .filter((s) => s !== "");
}

/** OKF v0.2 closed set — see .github/instructions/knowledge.instructions.md */
const TYPES = new Set(["module", "feature", "route-group", "page", "contract", "concern", "runbook"]);

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const today = new Date().toISOString().slice(0, 10);

for (const card of cards) {
  const text = await Bun.file(`${root}/${card}`).text();
  const fm = parseFrontmatter(text);

  if (fm === null) {
    errors.push({ card, message: "no parseable YAML frontmatter (OKF requires it)" });
    continue;
  }
  if (!nonEmpty(fm.type)) {
    errors.push({ card, message: "frontmatter `type` missing or empty (OKF conformance)" });
  } else if (!TYPES.has(fm.type as string)) {
    errors.push({ card, message: `\`type: ${fm.type}\` is not one of ${[...TYPES].join(" | ")}` });
  }
  if (!nonEmpty(fm.title)) errors.push({ card, message: "`title` missing" });
  if (!nonEmpty(fm.description)) {
    errors.push({ card, message: "`description` missing — it must be usable without reading the body" });
  } else if ((fm.description as string).length > MAX_DESCRIPTION) {
    errors.push({
      card,
      message: `\`description\` is ${(fm.description as string).length} chars — keep it under ${MAX_DESCRIPTION}`,
    });
  }

  const lines = countLines(text);
  if (lines > MAX_CARD_LINES) {
    errors.push({
      card,
      message: `card is ${lines} lines — split it or move detail into the spec (cap ${MAX_CARD_LINES})`,
    });
  }

  const entries = normalizeSources(fm.sources);
  if (entries.length === 0) {
    const staleAfter = fm.stale_after;
    if (!nonEmpty(staleAfter)) {
      errors.push({ card, message: "no `sources:` — a card with no code behind it must set `stale_after:`" });
    } else if (today > (staleAfter as string)) {
      stale.push(`STALE  ${card}\n       stale_after ${staleAfter} has passed — re-read it and extend the date`);
    }
    continue;
  }

  const expanded: string[] = [];
  for (const entry of entries) {
    if (entry.endsWith("/")) {
      const hits = allFiles.filter((p) => p.startsWith(entry));
      if (hits.length === 0) errors.push({ card, message: `sources entry "${entry}" matches no tracked file` });
      expanded.push(...hits);
    } else if (entry.includes("*")) {
      const hits = allFiles.filter((p) => new Bun.Glob(entry).match(p));
      if (hits.length === 0) errors.push({ card, message: `sources entry "${entry}" matches no tracked file` });
      expanded.push(...hits);
    } else if (!allFiles.includes(entry)) {
      // The load-bearing rule: after a split, the old path is gone and the card
      // cannot be committed without being updated to match.
      errors.push({ card, message: `sources entry "${entry}" does not exist — was it split or renamed?` });
    } else {
      expanded.push(entry);
    }
  }
  for (const p of expanded) covered.set(p, [...(covered.get(p) ?? []), card]);

  const cardTime = mtime(card);
  let worst: string | null = null;
  for (const p of expanded) if (worst === null || mtime(p) > mtime(worst)) worst = p;

  if (worst !== null && mtime(worst) > cardTime) {
    if (dirty.has(worst)) {
      stale.push(
        `STALE  ${card}\n` +
          `       source has uncommitted changes:  ${worst}\n` +
          `       workflow rule 3 — the card must be updated in the SAME commit`,
      );
    } else {
      const cardSha = lastCommit.get(card)?.sha;
      // Defensive: a source with no commit record can only reach here if it escaped the
      // dirty set. That should be impossible now, but reporting must never be the thing
      // that crashes the gate.
      const srcCommit = lastCommit.get(worst) ?? { epoch: mtime(worst), sha: "uncommitted", subject: "" };
      const missed = cardSha
        ? git("log", "--format=%h %s", `${cardSha}..HEAD`, "--", ...expanded).trim().split("\n").filter(Boolean)
        : [];
      stale.push(
        `STALE  ${card}\n` +
          `       card last touched   ${new Date(cardTime * 1000).toISOString().slice(0, 10)}  (${cardSha ?? "?"})\n` +
          `       source is newer     ${worst}  ${new Date(srcCommit.epoch * 1000).toISOString().slice(0, 10)}  (${srcCommit.sha})\n` +
          (missed.length ? `       commits not reflected in this card:\n${missed.map((m) => `         ${m}`).join("\n")}\n` : "") +
          `       fix:  update the card, bump \`verified[0].at\`, commit BOTH together`,
      );
    }
  }
}

// ---- index.md has no sources, so it cannot go stale by the rule above --------
// yet it rots faster than anything. Check it structurally instead.
const indexPath = `${BUNDLE}/index.md`;
if (!allFiles.includes(indexPath)) {
  errors.push({ card: indexPath, message: "bundle index is missing" });
} else {
  const index = await Bun.file(`${root}/${indexPath}`).text();
  for (const card of cards) {
    const rel = card.slice(BUNDLE.length + 1);
    if (!index.includes(rel)) errors.push({ card: indexPath, message: `no link to ${rel}` });
  }
  for (const [, target] of index.matchAll(/\]\(([^)]+\.md)\)/g)) {
    if (target!.startsWith("http")) continue;
    const resolved = target!.startsWith("../") ? null : `${BUNDLE}/${target}`;
    if (resolved && !allFiles.includes(resolved)) {
      errors.push({ card: indexPath, message: `dead link ${target}` });
    }
  }
}

const inCoverage = allFiles
  .filter((p) => matchesAny(p, COVERAGE))
  .filter((p) => !matchesAny(p, COVERAGE_EXEMPT));

const uncovered = inCoverage.filter((p) => !covered.has(p)).sort();

// Two cards claiming the same file means two places to update and a coin-flip about
// which one an agent reads. Always an error — a file has exactly one home.
for (const p of inCoverage) {
  const claims = covered.get(p);
  if (claims && claims.length > 1) {
    errors.push({
      card: claims.join(" + "),
      message: `both claim ${p} in \`sources:\` — a file belongs to exactly one card`,
    });
  }
}

// ---- report ------------------------------------------------------------------
const quiet = process.argv.includes("--quiet");

if (errors.length > 0) {
  console.error(`knowledge: ${errors.length} error(s)\n`);
  for (const e of errors) console.error(`ERROR  ${e.card}\n       ${e.message}`);
  console.error("");
}
if (stale.length > 0) {
  console.error(`knowledge: ${stale.length} card(s) out of date\n`);
  for (const s of stale) console.error(`${s}\n`);
}
if (uncovered.length > 0 && !quiet) {
  const label = COVERAGE_FAILS ? "uncovered" : "coverage (warning, not yet enforced)";
  console.error(`${label} — ${uncovered.length} source file(s) covered by no card:`);
  for (const p of uncovered) console.error(`       ${p}`);
  console.error(
    "       add each to an existing card's `sources:`, or see\n" +
      "       .github/instructions/knowledge.instructions.md for when a new card is warranted\n",
  );
}

const failed = errors.length > 0 || stale.length > 0 || (COVERAGE_FAILS && uncovered.length > 0);
if (!failed && !quiet) {
  console.log(
    `knowledge: ok — ${cards.length} card(s), ${inCoverage.length - uncovered.length} source file(s) covered` +
      (uncovered.length > 0 ? `, ${uncovered.length} not yet covered` : ""),
  );
}
process.exit(failed ? 1 : 0);
