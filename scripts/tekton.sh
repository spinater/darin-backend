#!/usr/bin/env bash
# Dispatch one brief to the tekton lane — `claude-tekton` on gi/coder (Qwen3 27B).
# (linus order 2026-09-18: "ให้ใช้ claude-tekton เป็นหนึ่งใน agent ใช้ในการทำงานได้เลย
#  ให้ opus แตกงานให้ละเอียดพอสำหรับ qwen3.8 27B")
#
#   bash scripts/tekton.sh .scratch/017-rename-brief.md
#   TEKTON_MODEL=gi/chat bash scripts/tekton.sh <brief>     # the cheaper lane
#   TEKTON_TOOLS='Read Grep Glob' bash scripts/tekton.sh <brief>   # read-only run
#
# The briefing standard is `.claude/skills/tekton-brief/SKILL.md`. Read it before
# writing a brief; this script only carries one there.
#
# 🔑 **The brief is a file, never an argv string.** A brief this lane can execute runs to
# dozens of lines and carries literal code, quotes and `$`; through argv, one shell layer
# rewrites it and the model then works from something nobody wrote. A path cannot be
# mangled by quoting.
set -euo pipefail
cd "$(dirname "$0")/.."

brief="${1:-}"
if [ -z "$brief" ] || [ ! -f "$brief" ]; then
  echo "tekton: usage — bash scripts/tekton.sh <path to brief.md>" >&2
  [ -n "$brief" ] && echo "tekton: ไม่มีไฟล์บรีฟ: $brief" >&2
  exit 2
fi
command -v claude-tekton >/dev/null 2>&1 || {
  echo "tekton: FAIL — ไม่มี claude-tekton บน PATH (~/.local/bin/claude-tekton)" >&2
  exit 127
}

# ── No Bash in the toolset, and that is the design, not an oversight
#
# This lane exists to type what a brief already decided. Bash is where a model that
# guessed stops being reviewable: it can run the gate and report green, `git checkout`
# over work in progress (§6 rule 8 — restores from the *index*, silently), or kill a
# sibling lane's job group. Every one of those is invisible in the diff afterwards.
# ⇒ **verification is the caller's job.** The gate is run from outside this script, by
# whoever read the diff — see the tail of this file.
tools="${TEKTON_TOOLS:-Read Grep Glob Edit Write}"

# ── Snapshot the tree first, because a dirty tree is the normal case here
#
# Several lanes work this repo at once, so "run it on a clean tree" is advice nobody can
# follow. Snapshot `git status` instead and report only the **difference** afterwards ⇒ the
# lane's footprint stays readable no matter what else was already in flight. Warn about the
# dirt, never block on it.
mkdir -p .scratch
before_status=".scratch/tekton-status-before-$$.txt"
git status --porcelain | LC_ALL=C sort > "$before_status"
trap 'rm -f "$before_status"' EXIT
dirty=$(wc -l < "$before_status" | tr -d ' ')
if [ "$dirty" -gt 0 ]; then
  echo "tekton: ⚠️  ทรีสกปรกอยู่ $dirty ไฟล์ก่อนเริ่ม — รอยเท้าของ lane นี้คำนวณจากส่วนต่าง ไม่ใช่จาก diff ทั้งก้อน"
fi
stamp=$(date +%Y%m%d-%H%M%S)
log=".scratch/tekton-$(basename "${brief%.md}")-$stamp.log"

echo "tekton: brief=$brief  model=${TEKTON_MODEL:-gi/coder}  tools=$tools"
echo "tekton: log=$log"

# ── §11 does not apply to this lane, and it needs a *deny rule*, not a request
#
# Found by the first real dispatch, not reasoned about: the lane read CLAUDE.md §11
# ("write `.scratch/agent-status.json` at the end of every turn"), saw the developer
# lane's live card-009 state in it, and stopped to ask rather than overwrite. It was
# right to stop — that file is **one file shared by the sessions the watcher tracks**,
# and this lane is not one of them ⇒ anything it writes there reports a card it is not
# working on, to a watcher that will act on it.
# ⇒ denied at the permission layer so it cannot happen on a turn that does not stop to
#   think, and said in words so the lane does not waste the turn asking.
#
# ⚠️ **`Edit(path)` only — a `Write(path)` deny rule is a no-op here.** Claude Code said so
# itself on the first run: "Write(...) is not matched by file permission checks — only
# Edit(path) rules are. Edit rules cover all file-editing tools." So the `Edit` rule is what
# denies `Write` too, and adding a `Write` row buys nothing but a warning in the log.
deny_status='{"permissions":{"deny":["Edit(.scratch/agent-status.json)"]}}'

# `--permission-mode acceptEdits` — in `-p` there is nobody to answer a prompt, so an
# unapproved tool call is a denial the model reads as a broken tool and works around.
# The narrow `--allowedTools` above is what keeps that mode honest.
# · cwd is the repo root ⇒ the project's own `.claude/settings.json` applies, so the
#   500-line PostToolUse hook (§4) judges this lane exactly as it judges the others.
set +e
claude-tekton -p \
  --permission-mode acceptEdits \
  --allowedTools $tools \
  --settings "$deny_status" \
  --append-system-prompt "You are executing a written brief inside darin-payroll-system. Do exactly what the brief says and nothing more. If the brief is ambiguous or a step cannot be done as written, STOP, change nothing further, and report the ambiguity — never choose for yourself. You have no Bash: do not claim you ran tests, the gate, or any command. CLAUDE.md §11 does NOT apply to you: never write or edit .scratch/agent-status.json — it is the developer lane's state file and you are not a session the watcher tracks. Write no status file and no report file; your report is what you print here." \
  < "$brief" 2>&1 | tee "$log"
rc=${PIPESTATUS[0]}
set -e

echo
echo "tekton: exit=$rc"

# ── What actually changed — the only part of this that is evidence
#
# ⚠️ The model writes its reasoning into the ordinary text block (no separate thinking
# block), so the log opens with it deliberating and "I have completed…" appears whether
# or not anything happened. **Read the diff, not the log.**
# 🔴 **ส่วนต่าง ไม่ใช่ `git diff --stat` ทั้งก้อน** — วัดจากรอบแรกจริง: ทรีมีงานใบ 009 ค้างอยู่
# 17 ไฟล์ แล้ว `--stat` คาย 17 ไฟล์นั้นออกมาเป็น "ผลของ lane" ⇒ หลักฐานที่กลืนของคนอื่นเข้ามา
# คือหลักฐานที่อ่านไม่ได้ · เทียบ `git status` ก่อน/หลัง แล้วรายงานเฉพาะบรรทัดที่เปลี่ยน
echo "tekton: ── รอยเท้าของ lane นี้ (นี่คือหลักฐาน ไม่ใช่ข้อความในล็อก) ──"
after_status=".scratch/tekton-status-after-$$.txt"
git status --porcelain > "$after_status"
footprint=$(LC_ALL=C comm -13 "$before_status" <(LC_ALL=C sort "$after_status") 2>/dev/null || true)
if [ -z "$footprint" ]; then
  echo "tekton:   (ไม่มีไฟล์ที่ git ถือเปลี่ยนสถานะเลย)"
  echo "tekton:   ⚠️ เป้าที่ .gitignore ซ่อนอยู่ (เช่นใน .scratch/) จะไม่โผล่ที่นี่ — เช็กไฟล์นั้นเอง"
else
  printf '%s\n' "$footprint" | sed 's/^/tekton:   /'
  printf '%s\n' "$footprint" | awk '{print $NF}' | while IFS= read -r f; do
    git diff --stat -- "$f" | sed 's/^/tekton:   /'
  done
fi
rm -f "$after_status"

cat <<'NEXT'
tekton: ── ต่อไปเป็นงานของคนเรียก ไม่ใช่ของ lane นี้ ──
tekton:   1. อ่าน diff ทุกบรรทัด (lane นี้ไม่มี Bash ⇒ มันไม่เคยรันอะไรเลย)
tekton:   2. bash scripts/verify.sh
tekton:   3. รีวิวตาม CLAUDE.md §9 — เงินขยับก็ payroll-auditor ด้วย
NEXT
exit "$rc"
