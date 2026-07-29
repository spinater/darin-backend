#!/usr/bin/env bun
/**
 * check-file-length — enforce the 500-line ceiling per source file.
 *
 * A file over the limit is a signal to extract sub-modules, not to raise the limit.
 * See .github/copilot-instructions.md §4a for the rule and the split patterns.
 *
 *   bun scripts/check-file-length.ts          # report + exit 1 on any violation
 *   bun scripts/check-file-length.ts --quiet  # only print violations, no warn tier
 *
 * Exits 0 when every checked file is at or under the limit.
 */

import { existsSync } from "node:fs";

const LIMIT = 500;
const WARN = 450;

/** Hand-written source we own. Tests are included on purpose — they are code. */
const INCLUDE = [
  "lib/**/*.ts",
  "app/**/*.ts",
  "app/**/*.tsx",
  "prisma/**/*.ts",
  "scripts/**/*.ts",
  "*.ts",
];

/**
 * Exempt because the files are not ours to shape. `generated/**` needs no entry:
 * it is gitignored, and the candidate list comes from `git ls-files --exclude-standard`,
 * so the Prisma client never reaches this check in the first place.
 */
const EXEMPT = ["**/*.d.ts"];

function sh(cmd: string[]): string {
  const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed: ${p.stderr.toString().trim()}`);
  }
  return p.stdout.toString();
}

/** Lines as an editor counts them: a final line without a trailing newline still counts. */
function countLines(text: string): number {
  if (text === "") return 0;
  const n = text.split("\n").length;
  return text.endsWith("\n") ? n - 1 : n;
}

function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((p) => new Bun.Glob(p).match(path));
}

const root = sh(["git", "rev-parse", "--show-toplevel"]).trim();

// -co --exclude-standard = tracked + untracked-but-not-ignored, so a brand-new
// 900-line file fails before it is ever `git add`ed.
const candidates = sh(["git", "-C", root, "ls-files", "-z", "-co", "--exclude-standard"])
  .split("\0")
  .filter((p) => p !== "");

// `ls-files -c` reads the index, which still lists a file deleted from the working
// tree but not yet staged — reading it would throw ENOENT. A split that removes the
// original file hits this every time, so drop paths that are no longer on disk.
const files = candidates
  .filter((p) => matchesAny(p, INCLUDE))
  .filter((p) => !matchesAny(p, EXEMPT))
  .filter((p) => existsSync(`${root}/${p}`))
  .sort();

const over: { path: string; lines: number }[] = [];
const near: { path: string; lines: number }[] = [];

for (const path of files) {
  const text = await Bun.file(`${root}/${path}`).text();
  const lines = countLines(text);
  if (lines > LIMIT) over.push({ path, lines });
  else if (lines >= WARN) near.push({ path, lines });
}

const quiet = process.argv.includes("--quiet");
const pad = (s: string, n: number) => s.padEnd(n, " ");
const width = Math.max(0, ...[...over, ...near].map((f) => f.path.length));

if (over.length > 0) {
  over.sort((a, b) => b.lines - a.lines);
  console.error(`file-length: ${over.length} file(s) over the ${LIMIT}-line limit\n`);
  console.error("Split each into sub-modules — see .github/copilot-instructions.md §4a:\n");
  for (const f of over) {
    console.error(`  ${pad(f.path, width)}  ${String(f.lines).padStart(5)}  (+${f.lines - LIMIT})`);
  }
  console.error("");
}

if (near.length > 0 && !quiet) {
  near.sort((a, b) => b.lines - a.lines);
  console.error(`approaching the limit (>=${WARN}, not failing):\n`);
  for (const f of near) {
    console.error(`  ${pad(f.path, width)}  ${String(f.lines).padStart(5)}`);
  }
  console.error("");
}

if (over.length === 0 && !quiet) {
  console.log(`file-length: ok — ${files.length} file(s) checked, none over ${LIMIT} lines`);
}

process.exit(over.length > 0 ? 1 : 0);
