# The formatter stage of `scripts/check-code.sh` (task 003) — the TypeScript answer to
# groove-clinic's `cargo fmt --check`.
#
# ## What this stage is for
# Without a pinned formatter the tree drifts one hand-formatted line at a time, and the day
# somebody finally types the format command, every file in the repo lands in the commit of
# whoever happened to type it. That happened at groove-clinic: 333 files in one commit, 204 of
# them recovered by hand afterwards. The gate is cheap; that clean-up is not.
#
# ## Why it is **--check**, never --write
# A gate that rewrites the tree it is judging is not a gate: it can never be red, so it never
# tells you anything, and it silently mixes its own edits into whatever you were about to commit.
#
# ## Why it runs FIRST inside check-code
# It is the fastest stage here and the only one that needs neither a generated Prisma client nor a
# database. A red that costs two seconds should never sit behind a stage that costs a minute.
#
# ## Why it lives in check-code and not in its own `scripts/check-*.sh`
# It needs the same toolchain (bun, native or in docker) as the other code stages, so it must obey
# the same `SKIP_CODE_CHECKS=1` escape hatch. A formatter stage outside check-code would keep
# running on a machine that has no toolchain at all, and would then have to invent its own answer
# for a question check-code already answers.
#
# ## The pin, and the second home that nearly opened up here
# The version is pinned **exactly** (no `^`, no `~`) in `package.json`, and the real pin is
# `bun.lock`. Different formatter versions format differently, so an unpinned formatter is a gate
# that goes red on its own one morning with nobody having changed a line.
#
# 🔴 **Which is why this stage runs `./node_modules/.bin/prettier`, never `bunx prettier`.**
# `bunx` is not pin-aware: measured in a sandbox where `package.json` and `bun.lock` both pinned
# 3.8.0 and `node_modules` existed but held no prettier, `bunx prettier --version` printed **3.9.7**
# — it fetched the registry's `latest` and ran it, silently. And `$deps` in `scripts/check-code.sh`
# is `[ -d node_modules ] || bun install --frozen-lockfile`, i.e. it installs **only when
# `node_modules` is absent** ⇒ any checkout with a stale `node_modules` (another lane in this tree,
# the deploy host, cached CI) short-circuits the install, finds no local prettier, and gets
# whatever shipped that morning. The day that differs from the pin, the gate reddens a tree nobody
# touched — and a human obeying the red would reformat the whole TS surface with an unpinned
# formatter, which is the 333-file groove-clinic incident re-entering through the gate's own
# instructions. The binary path has no such fallback: a missing install fails loudly with
# "No such file", which is the direction an error is allowed to point (§4).
#
# 🔑 With that closed, the pin needs **no watcher of its own**: the gate installs from `bun.lock`
# and `Dockerfile`'s deps stage installs from the same `bun.lock`. The "a Dockerfile cannot source
# a shell file" problem that forces `scripts/check-bun-pin.sh` to exist does not arise — one home,
# nothing to keep equal. (Prettier is a devDependency, so it lands in the builder image only; the
# runner stage copies the Next.js standalone output and never sees it.)
#
# ## Shape
# **sourced with `.`, not run with `bash`** — same shell as the caller, exactly like
# `scripts/lib/check-code-junit.sh`: it reads `$deps`, `$RUN_ID`, `$GATE_ENGINE`, `$BUN_IMAGE` and
# the `bun_run` function from `scripts/check-code.sh`, and sets `fail=1` back into it.

# The single home of "what the formatter's scope is". The stage and the fix command it prints read
# this same string — if they drift, the gate tells you to run a command that fixes a different set
# of files than the one it just judged you on.
#
# **Quoted when handed to `sh -c`**, and that quoting is load-bearing on exactly the machines this
# repo does not control: where `/bin/sh` is bash, this glob brace-expands and then
# globs with `globstar` off, so `**` collapses to one directory level and every nested file stops
# being judged — silently, with the gate still printing OK. (Under dash, which is `sh` here and in
# `oven/bun:1.3-slim`, there is no brace expansion and the pattern survives by luck. Luck is not the
# reason it is quoted.) Case B2 of `scripts/tests/check-format-selftest.sh` runs it through bash on
# purpose, so the guard exists on the shell that can actually break it.
#
# The extension list is an *inclusion* list, which §4 warns is the direction that fails silently —
# a file type nobody adds here is judged by nobody, with nothing going red. It is kept honest by
# naming every source extension the repo has a compiler or bundler for, not just the TS ones.
CHECK_FORMAT_GLOB='**/*.{ts,tsx,mjs,cjs,js,jsx}'

# 🔴 The requirement from the task card: when this goes red, the fix must be **copy-pasteable from
# the machine you are standing on**. That command is not the same on both engines — native has a
# matching bun on the host, docker does not — so print the one that actually applies, never a
# generic one. A gate that goes red without a usable fix is a gate people learn to step over.
check_format_fix_cmd() {
  local root
  root="$(pwd -P)"
  case "${GATE_ENGINE:-}" in
    native)
      printf '  ./node_modules/.bin/prettier --write "%s"\n' "$CHECK_FORMAT_GLOB"
      ;;
    docker)
      printf "  docker run --rm -v '%s':/app -w /app %s \\\\\n" "$root" "${BUN_IMAGE:-oven/bun:1.3-slim}"
      printf "    sh -c '[ -d node_modules ] || bun install --frozen-lockfile; ./node_modules/.bin/prettier --write \"%s\"'\n" \
        "$CHECK_FORMAT_GLOB"
      ;;
    *)
      # ⚠️ **Defensive only, and unreachable today** — `scripts/check-code.sh` exits before any
      # stage runs when the engine does not resolve (`GATE_ENGINE = none`). Keep it as a branch that
      # refuses to guess; do not "fix" it into something load-bearing, and do not delete it on the
      # grounds that it never fires: it is what makes a future caller that forgot to resolve the
      # engine loud instead of confidently wrong. Selftest case H covers it.
      echo "  (engine not resolved — run 'bash scripts/check-code.sh' from the repo root, read the"
      echo "   engine banner it prints, then re-run the command this stage names for that engine)"
      ;;
  esac
}

# The install command, which is NOT the fix command: `$deps` only installs when `node_modules` is
# missing entirely, so the one case that needs this — directory present, formatter absent — is
# exactly the case `$deps` walks past.
check_format_install_cmd() {
  local root
  root="$(pwd -P)"
  case "${GATE_ENGINE:-}" in
    docker)
      printf "  docker run --rm -v '%s':/app -w /app %s sh -c 'bun install --frozen-lockfile'\n" \
        "$root" "${BUN_IMAGE:-oven/bun:1.3-slim}"
      ;;
    *)
      echo "  bun install --frozen-lockfile"
      ;;
  esac
}

echo "check-code: format (prettier --check)"
if ! declare -f bun_run >/dev/null 2>&1; then
  # Input we cannot read = red, never green. A stage that quietly does nothing is a stage nobody
  # knows did not run (the same lesson as the junit stage's missing-report branch).
  echo "check-code: FAIL — no bun_run function in scope, so the format stage could not run at all"
  echo "             (this file is meant to be sourced by scripts/check-code.sh, not run alone)"
  fail=1
else
  CHECK_FORMAT_LOG=".scratch/check-code-format-${RUN_ID:-$$}.log"
  # 🔴 **Read the exit code, do not just test it.** prettier says three different things with it,
  # and collapsing them into "unformatted files" produces the very thing this file argues against
  # at the top: a red with no [warn] lines above it and a fix command that cannot help, which is
  # how a reader learns the message is noise.
  #   1   some files differ            → the fix command is the answer
  #   127 no such binary               → nothing is installed; the *install* command is the answer
  #   2   prettier itself errored      → bad config / pattern matched nothing; neither command helps
  if bun_run "${deps:-:}
    ./node_modules/.bin/prettier --check '$CHECK_FORMAT_GLOB'" 2>&1 | tee "$CHECK_FORMAT_LOG"; then
    CHECK_FORMAT_RC=0
  else
    CHECK_FORMAT_RC=$?
  fi
  case "$CHECK_FORMAT_RC" in
    0) ;;
    1)
      echo "check-code: FAIL — prettier --check found unformatted files (the [warn] lines above)"
      echo "             fix them, from this machine, with:"
      check_format_fix_cmd
      fail=1
      ;;
    127)
      # ⚠️ 127 has **two** causes, and naming only the first sends the reader in a circle: the
      # binary is a `#!/usr/bin/env node` shim, so a missing *interpreter* exits 127 exactly like a
      # missing file (`env: 'node': No such file or directory`, printed directly above). Moving off
      # `bunx` is what added that host requirement — the native engine now needs `node` on PATH,
      # while `scripts/lib/bun-image.sh` still defines "native" as nothing more than bun matching
      # the pin. Without this clause the reader installs as told, the install succeeds, and the gate
      # stays red with the same sentence.
      echo "check-code: FAIL — no ./node_modules/.bin/prettier this machine can execute ⇒ nothing"
      echo "             was checked (not installed, or no 'node' on PATH for its shebang — the"
      echo "             line above says which)"
      echo "             (the gate refuses to fall back to an unpinned formatter — see the header)"
      echo "             if it is not installed, install the pinned one, from this machine, with:"
      check_format_install_cmd
      fail=1
      ;;
    *)
      # No parenthetical list of causes here on purpose: this branch also catches 126 (a binary
      # present but not executable), which is neither a config error nor an empty match. The verdict
      # — "nothing was judged" — is true for all of them, and prettier's own output above is what
      # names the cause. A guess printed next to the truth is what makes a reader stop trusting both.
      echo "check-code: FAIL — prettier exited $CHECK_FORMAT_RC, which is not a verdict on the tree"
      echo "             (the output above says why). Nothing was judged this round; do not read"
      echo "             this as 'tree is fine'."
      fail=1
      ;;
  esac
fi
