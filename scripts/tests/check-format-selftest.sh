#!/usr/bin/env bash
# Tests for **`scripts/lib/check-code-format.sh`** (task 003) — a "gate's gate" per CLAUDE.md §7.
#
# ## Why this stage needs a test of its own
# The formatter stage decides with **strings**: a glob handed to `sh -c`, and a fix command printed
# for a human to copy. Both fail silently and in both directions:
#
#   · the glob unquoted — on any host whose `/bin/sh` is bash it brace-expands and then globs with
#     `globstar` off, so `**` collapses to one directory level, everything nested is judged by
#     nobody, and the gate still prints OK;
#   · the fix command wrong — it names a command that cannot run on the machine reading it, which
#     is how people learn to step over a gate instead of fixing the tree.
#
# ## Cases
#   A. clean sandbox                         → green, nothing about fixing printed
#   B. unformatted file nested three deep    → red, names the file  (scope)
#  B2. the same command run under bash       → still red  (🔑 the glob-quoting trap, measured)
#   C. unformatted file at the repo root      → red, names the file  (the other end of the glob)
#   D. unformatted `*.md`                     → still green — markdown is excluded on purpose
#   E. the printed fix command, run verbatim  → makes the sandbox green  (🔑 "copy-pasteable")
#   F. engine=native red                      → prints the local-binary form, never `docker run`
#   G. engine=docker red                      → prints `docker run` with the image and this tree
#   H. engine unresolved                      → says so; never invents a command
#   I. no `bun_run` in scope                  → red, never silently green
#   J. the glob checked == the glob in the fix command (one home, no drift)
#   K. stage passes                           → `fail` untouched
#   L. the pinned local binary is what runs, and what the fix command names  (🔴 no `bunx`)
#   M. nothing installed                      → red, points at the install, never a silent fallback
#   N. prettier errors (exit 2)               → "nothing was judged", not "unformatted files"
#   O. present but not executable (126)       → "nothing was judged", not "go install it"
#   P. present, interpreter missing (127)     → the red names the PATH cause, not only the install
#
# A–E/M/N need a real prettier, so they run only when the host bun matches the pin; F–L are pure
# string work and O–P need only a shell, so both of those groups run everywhere.
# **A skipped case says so out loud** (§7) — a case that disappears quietly is a case nobody knows
# did not run.
set -uo pipefail
cd "$(dirname "$0")/../.."

LIB_REL="scripts/lib/check-code-format.sh"
LIB_ABS="$PWD/$LIB_REL"
# Per PID, not a fixed name — several verify lanes run concurrently on this machine (§6 rule 6).
SANDBOX="$PWD/.scratch/format-selftest-$$"
trap 'rm -rf "$SANDBOX"' EXIT
pass=0
fail=0

if [ ! -r "$LIB_ABS" ]; then
  echo "check-format-selftest: FAIL — cannot read $LIB_REL ⇒ nothing below measures anything"
  echo "check-format-selftest: passed 0 · failed 1"
  exit 1
fi

# Is there a real prettier to drive? Read the engine from the one home that owns that answer
# (`scripts/lib/bun-image.sh`) instead of asking `command -v bun`, which passes on a bun that does
# not match the pin — the exact thing pinning exists to prevent.
# shellcheck source=/dev/null
. scripts/lib/bun-image.sh
rc=$?
if [ "$rc" -ne 0 ]; then
  echo "check-format-selftest: FAIL — sourcing scripts/lib/bun-image.sh failed (exit $rc)"
  echo "check-format-selftest: passed 0 · failed 1"
  exit 1
fi
bun_engine
REAL_OK=0
[ "${GATE_ENGINE:-}" = "native" ] && REAL_OK=1

# ── sandbox: the real config files, never a fake copy of them
# The decision under test is "what does THIS repo's formatter config accept", so the scenarios read
# `.prettierrc` and `.prettierignore` from the tree. A hand-written stand-in would let the two drift
# and the test would end up guarding what it wrote itself.
new_sandbox() { # $1 = "nolink" to leave the sandbox without a prettier install
  rm -rf "$SANDBOX"
  mkdir -p "$SANDBOX/.scratch" "$SANDBOX/lib" "$SANDBOX/a/b/c"
  cp .prettierrc .prettierignore "$SANDBOX/" 2>/dev/null || true
  if [ "${1:-}" != "nolink" ] && [ -d node_modules ]; then
    ln -s "$PWD/node_modules" "$SANDBOX/node_modules"
  fi
  printf 'export const ok = 1;\n' > "$SANDBOX/lib/ok.ts"
  printf 'export const root = 1;\n' > "$SANDBOX/root.ts"
}

unformatted() { printf 'export const   bad=%s\n' "{a:1,b:2}" > "$1"; }

# A sandbox whose formatter cannot run, in the two ways the shell distinguishes. Measured, because
# "the binary is missing" is not one condition but three:
#   absent                → 127   · present, not executable → 126   · present, interpreter missing → 127
# The last one exists because `node_modules/.bin/prettier` is a `#!/usr/bin/env node` shim, so the
# 127 branch must name the PATH cause too or it sends the reader to install something already there.
fake_prettier() { # $1 = noexec | badshebang
  new_sandbox nolink
  mkdir -p "$SANDBOX/node_modules/.bin"
  case "$1" in
    noexec)
      printf 'not executable\n' > "$SANDBOX/node_modules/.bin/prettier"
      ;;
    badshebang)
      printf '#!/usr/bin/env nosuchinterp-for-selftest\n' > "$SANDBOX/node_modules/.bin/prettier"
      chmod +x "$SANDBOX/node_modules/.bin/prettier"
      ;;
  esac
}

# Run the stage exactly as `check-code.sh` runs it: sourced into a shell that already holds
# `bun_run`, `$deps`, `$RUN_ID`, `$GATE_ENGINE`, `$BUN_IMAGE` and `fail`.
#   $1 = engine ; env REAL=1 runs prettier for real, otherwise `bun_run` is a stub returning $FAKE_RC
#   env RUNNER=bash runs the real command under bash instead of sh — the shell that can actually
#   break the glob quoting (see case B2)
OUT=""
run_stage() {
  local engine="$1"
  OUT="$(
    cd "$SANDBOX" || exit 99
    set -uo pipefail
    fail=0
    GATE_ENGINE="$engine"
    BUN_IMAGE="oven/bun:pin-under-test"
    RUN_ID="selftest-$$"
    deps=':'
    if [ "${REAL:-0}" = "1" ]; then
      bun_run() { "${RUNNER:-sh}" -c "$1"; }
    else
      bun_run() { printf '%s\n' "$1" > .last-cmd; echo "[stub] bun_run"; return "${FAKE_RC:-0}"; }
    fi
    [ "${NO_BUN_RUN:-0}" = "1" ] && unset -f bun_run
    # shellcheck source=/dev/null
    . "$LIB_ABS"
    rc=$?
    [ "$rc" -eq 0 ] || echo "__SOURCE_RC=$rc"
    echo "__FAIL=$fail"
  )"
}

expect() { # $1=name $2=expected __FAIL $3=text that must appear $4=text that must not appear
  local name="$1" want_fail="$2" msg="${3:-}" deny="${4:-}" ok=1
  if ! grep -qF "__FAIL=$want_fail" <<<"$OUT"; then
    echo "  FAIL: $name — expected fail=$want_fail"; ok=0
  fi
  if [ -n "$msg" ] && ! grep -qF -- "$msg" <<<"$OUT"; then
    echo "  FAIL: $name — missing text \"$msg\""; ok=0
  fi
  if [ -n "$deny" ] && grep -qF -- "$deny" <<<"$OUT"; then
    echo "  FAIL: $name — found text that must not be there: \"$deny\""; ok=0
  fi
  if [ "$ok" -eq 1 ]; then echo "  ok: $name"; pass=$((pass + 1))
  else printf '    --- output ---\n%s\n    --------------\n' "$OUT"; fail=$((fail + 1)); fi
}

note() { echo "  skip: $1 — $2"; }

# ── A–E: the real formatter
if [ "$REAL_OK" -eq 1 ]; then
  new_sandbox
  REAL=1 run_stage native
  expect "A clean tree is green" 0 "check-code: format" "check-code: FAIL"

  new_sandbox
  unformatted "$SANDBOX/a/b/c/deep.ts"
  REAL=1 run_stage native
  # Scope, not quoting: this says a nested file is inside the glob at all. It stays green whether
  # or not the glob is quoted, because `sh` here (and in `oven/bun:1.3-slim`) is dash, which has no
  # brace expansion — measured, after the review dropped the quotes and watched B stay green.
  # The quoting guard is B2.
  expect "B unformatted file three levels deep is in scope" 1 "a/b/c/deep.ts"

  # 🔑 B2 — the real quoting guard. Under a shell **with** brace expansion, an unquoted
  # `**/*.{ts,tsx,…}` expands to `**/*.ts **/*.tsx …` and then globs with `globstar` off, so `**`
  # collapses to a single level and everything nested is judged by nobody while the gate prints OK.
  # `/bin/sh` is bash on plenty of machines this repo does not control, so the trap is one host
  # away, not hypothetical. Verified by removing the quotes in the lib: this case goes red.
  new_sandbox
  unformatted "$SANDBOX/a/b/c/deep.ts"
  REAL=1 RUNNER=bash run_stage native
  expect "B2 nested file still caught when the command runs under bash (glob quoting)" 1 "a/b/c/deep.ts"

  new_sandbox
  unformatted "$SANDBOX/rootbad.ts"
  REAL=1 run_stage native
  expect "C unformatted file at the tree root is caught" 1 "rootbad.ts"

  new_sandbox
  printf '#  ห้ามจัดรูปแบบ   ไฟล์ไทย\n\n*  a\n*  b\n' > "$SANDBOX/README.md"
  REAL=1 run_stage native
  expect "D markdown is not formatted (Thai prose, §2.5)" 0 "" "README.md"

  # E — take the fix command the stage printed and actually run it. This is the whole requirement
  # of the task card ("the red message must be typeable from the machine you are standing on"):
  # a command that is merely *printed* proves nothing.
  new_sandbox
  unformatted "$SANDBOX/a/b/c/deep.ts"
  REAL=1 run_stage native
  fixcmd="$(grep -F 'prettier --write' <<<"$OUT" | head -1)"
  if [ -z "$fixcmd" ]; then
    echo "  FAIL: E the printed fix command works — nothing was printed to copy"
    fail=$((fail + 1))
  else
    (cd "$SANDBOX" && eval "$fixcmd") >/dev/null 2>&1
    REAL=1 run_stage native
    expect "E the printed fix command really fixes the tree" 0 "check-code: format" "check-code: FAIL"
  fi

  # M — nothing installed. The stage must say so and point at the *install*, not at the fix command
  # (which would fail the same way), and it must never fall back to an unpinned formatter.
  new_sandbox nolink
  REAL=1 run_stage native
  expect "M missing formatter is red and asks for the install" 1 "bun install --frozen-lockfile" "found unformatted files"

  # N — prettier itself errors (exit 2, here a config it cannot parse). "Nothing was judged" is a
  # different sentence from "your files are unformatted", and printing the second for the first is
  # the class this stage's header argues against.
  new_sandbox
  printf ':\n  - not: valid\n   prettier: [config\n' > "$SANDBOX/.prettierrc"
  REAL=1 run_stage native
  expect "N a prettier error is not reported as unformatted files" 1 "not a verdict on the tree" "found unformatted files"
else
  note "A–E, M, N (real prettier)" "host bun is not on the pin ⇒ ${GATE_ENGINE_WHY:-no reason given}"
fi

# ── F–L: the message and the contract, no toolchain needed
# The glob is read out of the lib, never retyped here — a copy in the test drifts the day someone
# adds an extension, and then the test guards the string it wrote itself (§6 rule 1).
GLOB="$(sed -n "s/^CHECK_FORMAT_GLOB='\(.*\)'$/\1/p" "$LIB_ABS" | head -1)"
if [ -z "$GLOB" ]; then
  echo "  FAIL: could not read CHECK_FORMAT_GLOB out of $LIB_REL ⇒ F and J measure nothing"
  fail=$((fail + 1))
fi

new_sandbox
FAKE_RC=1 run_stage native
expect "F native red prints the local-binary fix command" 1 "./node_modules/.bin/prettier --write \"$GLOB\"" "docker run"

FAKE_RC=1 run_stage docker
expect "G docker red prints a docker fix command" 1 "docker run --rm -v '$SANDBOX':/app"
FAKE_RC=1 run_stage docker
expect "G2 docker fix command names the pinned image" 1 "oven/bun:pin-under-test"

FAKE_RC=1 run_stage ""
expect "H unresolved engine never invents a command" 1 "engine not resolved" "docker run"

NO_BUN_RUN=1 run_stage native
expect "I no bun_run in scope is red, not silently green" 1 "could not run at all"

# J — one home for the glob: what was checked must be what the fix command repairs. If these ever
# drift, the gate sends you off to run a command that fixes a different set of files.
FAKE_RC=1 run_stage native
checked="$(grep -o -- "--check '[^']*'" "$SANDBOX/.last-cmd" 2>/dev/null | head -1)"
checked="${checked#--check \'}"
checked="${checked%\'}"
if [ -n "$checked" ] && grep -qF -- "--write \"$checked\"" <<<"$OUT"; then
  echo "  ok: J the glob checked is the glob the fix command repairs ($checked)"
  pass=$((pass + 1))
else
  echo "  FAIL: J glob drift — checked '$checked' but the fix command does not name it"
  printf '    --- output ---\n%s\n    --------------\n' "$OUT"
  fail=$((fail + 1))
fi

FAKE_RC=0 run_stage native
expect "K a passing stage leaves fail untouched" 0 "check-code: format" "check-code: FAIL"

# 🔴 L — the pin guard. `bunx prettier` is NOT pin-aware: with `node_modules` present but holding no
# prettier, it fetches the registry's `latest` and runs it silently, and `$deps` short-circuits on
# exactly that tree. Measured: package.json and bun.lock both pinning 3.8.0, `bunx prettier
# --version` → 3.9.7. So the binary path is what makes the pin real, in the command that is run AND
# in the command the reader is told to type. Without this case the next person retypes `bunx` and
# nothing notices until a formatter release rewrites the whole TS surface into someone's commit.
FAKE_RC=1 run_stage native
last="$(cat "$SANDBOX/.last-cmd" 2>/dev/null)"
if grep -qF -- 'node_modules/.bin/prettier' <<<"$last" && ! grep -qE '(^|[^.[:alnum:]])bunx' <<<"$last$OUT"; then
  echo "  ok: L the pinned local binary is what runs, and what the fix command names"
  pass=$((pass + 1))
else
  echo "  FAIL: L pin bypass — the stage or its fix command reaches for an unpinned formatter"
  printf '    --- command ---\n%s\n    --- output ---\n%s\n    --------------\n' "$last" "$OUT"
  fail=$((fail + 1))
fi

# O and P need a shell but no formatter, so unlike M they run on every host. They are the two exit
# codes that moving off `bunx` introduced: the binary path can now fail in ways `bunx` never did.
fake_prettier noexec
REAL=1 run_stage native
expect "O a binary that cannot be executed (126) is 'nothing was judged'" 1 "not a verdict on the tree" "install the pinned one"

# 🔑 P is the case that keeps the 127 wording honest: the file IS installed, and telling the reader
# to install it would send them round a loop that ends where it started.
fake_prettier badshebang
REAL=1 run_stage native
expect "P missing interpreter (127) names the PATH cause, not only 'not installed'" 1 "no 'node' on PATH"

echo "check-format-selftest: passed $pass · failed $fail"
[ "$fail" -eq 0 ]
