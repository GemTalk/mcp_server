#!/usr/bin/env bash
# Run the native MCP server's in-image unit tests (no listening server required).
# Logs in via topaz and runs each GsTestCase suite, printing the TestResult for each.
# Exits non-zero if any test failed or errored.
#
# Assumes the classes are already installed (run ./install.sh first).
#
# WHICH SUITES RUN depends on what is installed, not on a list kept here: the auth suites and the
# Grail suite are added only if their classes resolve, because install.sh files in src/auth only on
# an image with kernel JWT support and src/grail only on --grail. A base install runs the eighteen
# core suites.
#
# EACH SUITE RUNS IN ITS OWN TOPAZ SESSION, which costs a login per suite and buys the only thing
# that matters when something goes wrong: one suite can no longer take the whole report down with
# it. A Python exception that reaches `defaultAction` (a Grail ModuleNotFoundError is the one seen
# in practice) is not caught by SUnit's `on: Error do:` and terminates the doit, so with every suite
# in one session `iferr 1 stk` printed a stack and the run ended having printed NO tally at all --
# 484 passing tests reported as "UNIT TESTS DID NOT RUN". Now that suite is marked ABORTED, the
# others still report, and the exit status still says the run was not clean.
#
# NB: four suites are NOT purely in-image, and all four need a NETLDI.
#   McpExternalSessionTest  drives a real worker gem to check that a result comes back with the
#                           bytes the worker sent. It fails on any image before 3.7.4.1, which
#                           carries kernel defect #51438 -- that failure is the suite working, not
#                           a regression in mcp_server. See its class comment.
#   McpTransactionTest      spawns a worker gem to commit a CONFLICTING change, which is the only
#                           way to reach the state a failed commit leaves a session in. Nothing
#                           short of a real second session can produce it.
#   McpWorkerDeadlineTest   drives a real worker gem to check that a call which outruns the request
#                           deadline is actually broken, and that the gem is usable afterwards --
#                           the one claim the deadline rests on, and the one a mock cannot make.
#   McpAuthTest             creates and commits a throwaway JWT-enabled UserProfile (touching
#                           AllUsers) and spawns a real worker gem. It is run whenever present: it
#                           is the only coverage of the token->session path, and leaving it out once
#                           let a broken parse in McpAuthRouter (every token rejected as malformed)
#                           go unnoticed.
#
# Configure (or export before running):
#   GEMSTONE   - GemStone product directory (REQUIRED; no default can be guessed)
#   GS_STONE   - stone name        (default: gs64stone)
#   GS_USER    - GemStone user     (default: DataCurator)
#   GS_PASS    - GemStone password (default: swordfish)
#   MCP_GRAIL_DIR - path to the Grail CHECKOUT, on an image carrying the Grail toolset suite.
#                     Grail's Python lives in the image, but its .py stdlib lives on DISK under the
#                     checkout, and a gem cannot work out where: its working directory is wherever
#                     this script ran from, which holds no src/python/stdlib. Without it every
#                     .py-backed import in McpGrailToolsetTest fails. Same variable, same meaning
#                     and the same up-front check as run-server.sh; exported GRAIL_DIR also works,
#                     since that is what the suite reads.
#   --check    verify the environment and report, without running any tests.
set -euo pipefail
cd "$(dirname "$0")"

GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"
MCP_GRAIL_DIR="${MCP_GRAIL_DIR:-}"

# Five suites fork a real worker gem and so need a NETLDI: McpExternalSessionTest,
# McpTransactionTest, McpWorkerDeadlineTest and McpConcurrentEditTest (all always installed, see
# below) and McpAuthTest (only where the auth group could be). Ask the image which are present
# rather than asserting a netldi unconditionally -- the check still has to survive an image where
# none is installed, and discovering the lack up front beats hitting it as a GciError partway
# through a suite run.
#
# In practice the first four are always there, so a netldi is in practice always required.
# That is not a new burden: mcp_server gives every client its own worker gem, so it cannot serve a
# single request without a netldi. What changed is that the test run now says so plainly instead of
# passing on an image the server could not actually run on.
mcp_require_netldi_if_forking_suite_installed() {
  local nm have
  for nm in McpExternalSessionTest McpTransactionTest McpWorkerDeadlineTest McpAuthTest McpConcurrentEditTest; do
    gs_env_image_has "$nm" && have=0 || have=$?
    case "$have" in
      0) gs_env_require_netldi; return $? ;;
      1) ;;               # not installed: keep looking
      *) return 1 ;;      # gs_env_image_has has already said why
    esac
  done
  return 0                # no gem-forking suite installed: nothing here needs a netldi
}

. ./gs-env.sh
gs_env_resolve
if [ "${1:-}" = "--check" ]; then
  gs_env_check || exit $?
  mcp_require_netldi_if_forking_suite_installed || exit 1
  exit 0
fi
gs_env_require_stone
mcp_require_netldi_if_forking_suite_installed

# The Grail checkout, if this image has the Grail suite and a deployment named one. Checked HERE
# rather than in the gem, for the reason run-server.sh gives: this is the same filesystem the gem
# will read, so a wrong path is worth one line now instead of a wave of import errors that read as
# a broken Python subsystem. Two consumers, neither a fallback for the other -- importlib grailDir
# is what the Smalltalk module resolver uses, $GRAIL_DIR is what Grail's Python-side importlib and
# McpGrailToolsetTest>>grailCheckoutOrNil read -- so set both, exactly as McpGrailToolset does.
GRAIL_PREAMBLE=""
if [ -n "$MCP_GRAIL_DIR" ]; then
  if [ ! -d "$MCP_GRAIL_DIR/src/python/stdlib" ]; then
    echo "error: MCP_GRAIL_DIR=$MCP_GRAIL_DIR holds no src/python/stdlib," >&2
    echo "       so it is not a Grail checkout. Point it at the checkout this image was" >&2
    echo "       installed from (the one whose install.sh you last ran)." >&2
    exit 1
  fi
  # Guarded: on an image with no Grail this resolves nothing and must stay silent rather than
  # failing a run that was never going to touch Python.
  GRAIL_PREAMBLE="run
| d il |
d := '$(printf '%s' "$MCP_GRAIL_DIR" | sed "s/'/''/g")'.
System gemEnvironmentVariable: 'GRAIL_DIR' put: d.
il := System myUserProfile objectNamed: #importlib.
il ifNotNil: [ [il grailDir: d] on: Error do: [:ex | nil] ].
'GRAIL_DIR set'
%"
fi

# Which suites to run. The names live here, but whether each one RUNS is still the image's answer,
# not this script's assumption: a class that does not resolve reports NOT INSTALLED from inside the
# gem and is skipped. That costs a login for an absent suite and avoids asking topaz for the list --
# which cannot be done with a command substitution anyway, because `#(` inside `$( )` makes bash 3.2
# treat the rest of the line as a comment and the array's closing `)` then ends the substitution
# early. See the note above about not wrapping these heredocs in `$( )`.
SUITES="McpJsonTest McpUtf8Test McpBlindWriteTest McpConcurrentEditTest McpToolTest
McpDispatcherTest McpSessionTest McpOutboxTest McpProgressTest
McpStreamTest McpLifetimeTest McpViewHygieneTest McpTransportTest McpContractTest McpGemNameTest
McpExtensionTest McpExternalSessionTest McpTransactionTest McpWorkerDeadlineTest
McpAuthTest McpAuthConformanceTest McpGrailToolsetTest"

# Colored, curated output. Topaz itself never emits ANSI codes and echoes back every line it is
# fed (login banner, the doit source, etc.), which is most of what used to reach the terminal --
# the actual per-suite answer was always just the one line matched below. Disabled for NO_COLOR, or
# when stdout is neither a terminal nor a CI runner (e.g. redirected straight to a plain log file).
if [ -n "${NO_COLOR:-}" ] || { [ ! -t 1 ] && [ -z "${CI:-}" ]; }; then
  RED="" GREEN="" YELLOW="" BOLD="" RESET=""
else
  # YELLOW is the bright variant (93, not 33): standard yellow reads as a dim olive in most
  # terminal/log-viewer palettes, GitHub Actions' included, unlike red/green which stay vivid at
  # their standard codes.
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[93m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
fi

# Run each suite in its own topaz session. `iferr 1 stk` still prints the stack for a suite that
# blows up, and topaz's own exit code still decides the fate of ONE suite. A suite whose tally line
# never appears is ABORTED, which is a failure, not a skip: an aborted suite has told us nothing,
# and reporting it as anything else would be a false pass.
#
# The full topaz transcript goes only to $TMP, not to the terminal: on a normal pass or a test
# failure it is noise (login banner, echoed source) around the one line and the FAIL/ERROR lines
# extracted below; on an ABORT it is the only diagnostic there is, so that branch prints it in full.
FAILED=0
ABORTED=""
SKIPPED=""
RAN=0
TOTAL_RUN=0
for nm in $SUITES; do
  TMP="$(mktemp "${TMPDIR:-/tmp}/mcp-unit.XXXXXX")"
  set +e
  "$TOPAZ" -l > "$TMP" 2>&1 <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
$GRAIL_PREAMBLE
run
| cls res failed errorOnly passed report |
cls := System myUserProfile objectNamed: #$nm.
cls isNil ifTrue: [ ^'$nm: NOT INSTALLED' ].
res := cls suite run.
"Same formatting as McpTestingToolset>>formatTestResult:label: (the run_test_class MCP tool), so a
 test failure reads the same way here as it does over the wire. failures/errors already answer
 descriptive Strings -- never call printString on a TestResult itself, see GemStone_Notes.md#sunit.
 On 3.6.2 the two sets are the SAME set, so errorOnly excludes what is already in failed; on 3.7.x
 they are disjoint and this is a no-op."
failed := res failures collect: [:t | t asString].
errorOnly := (res errors collect: [:t | t asString]) reject: [:k | failed includes: k].
passed := res passedCount.
report := WriteStream on: String new.
report nextPutAll: '$nm: ' , (passed + failed size + errorOnly size) printString , ' run, '
  , passed printString , ' passed, ' , failed size printString , ' failed, '
  , errorOnly size printString , ' errors'.
(failed isEmpty and: [errorOnly isEmpty]) ifFalse: [
  report nextPut: Character lf.
  failed asSortedCollection do: [:k | report nextPutAll: '  FAIL  ' , k; nextPut: Character lf].
  errorOnly asSortedCollection do: [:k | report nextPutAll: '  ERROR ' , k; nextPut: Character lf]].
report contents
%
logout
exit
TPZ
  rc=$?
  set -e
  # Read the ANSWER, not the transcript. topaz echoes the source it is given, so grepping the
  # output for any literal in the Smalltalk above matches the echo as well -- which silently made
  # every suite look NOT INSTALLED. A printed result is the only line carrying topaz's
  # "[oop size:N Class] " prefix, so strip that and take the last one: the suite's own answer,
  # after the optional GRAIL_DIR preamble's.
  LINE="$(sed -n 's/^\[[0-9]* size:[0-9]*  *[A-Za-z0-9]*\] //p' "$TMP" | tail -1)"
  case "$LINE" in
    "$nm: NOT INSTALLED")
      echo "${YELLOW}SKIP${RESET}    $nm: not installed"
      SKIPPED="$SKIPPED $nm"
      rm -f "$TMP"
      continue ;;
  esac
  case "$LINE" in
    "$nm: "*" run, "*errors) ;;
    *) LINE="" ;;
  esac
  if [ -z "$LINE" ]; then
    echo "${RED}${BOLD}ABORTED${RESET} $nm (topaz exited $rc) -- full transcript:"
    cat "$TMP"
    rm -f "$TMP"
    ABORTED="$ABORTED $nm"
    FAILED=1
    continue
  fi
  # Counts are authoritative, so a tainted session that still produced them is not itself a failure.
  [ "$rc" -ne 0 ] && echo "note: $nm left topaz exit $rc -- session status tainted, counts below stand."
  case "$LINE" in
    *' 0 failed, 0 errors')
      echo "${GREEN}PASS${RESET}    $LINE" ;;
    *)
      FAILED=1
      echo "${RED}${BOLD}FAIL${RESET}    $LINE"
      # The FAIL/ERROR sub-lines the doit above wrote, exactly as GsTestCase names them (e.g.
      # "SomeTest debug: #testFoo"). Matched by the literal two-space + tag prefix the doit writes
      # -- ONE space after the tag, not two: '  FAIL  ' and '  ERROR ' are both 8 characters, so
      # FAIL (4 letters) gets two trailing spaces and ERROR (5) gets one. (Verified against a real
      # ERROR in CI: an earlier version of this pattern required two spaces after both tags and
      # silently matched zero ERROR lines, discarding the detail with no sign anything was wrong.)
      # Topaz's echo of the *source* that builds these strings never itself starts a line with
      # this prefix (that source reads "failed asSortedCollection do: ...", not "  FAIL  ...").
      # `|| true`: with pipefail active, grep finding nothing here (it shouldn't -- this branch
      # only runs when failed/errorOnly is nonempty -- would otherwise abort the whole run via -e.
      grep -E '^  (FAIL|ERROR) ' "$TMP" | while IFS= read -r detail; do
        echo "        ${RED}${detail#  }${RESET}"
      done || true ;;
  esac
  rm -f "$TMP"
  N="$(printf '%s' "$LINE" | sed -n 's/.*: \([0-9][0-9]*\) run,.*/\1/p')"
  TOTAL_RUN=$(( TOTAL_RUN + ${N:-0} ))
  RAN=$(( RAN + 1 ))
done

echo
echo "--- $TOTAL_RUN tests run across $RAN suites"
if [ -n "$SKIPPED" ]; then
  echo "not installed in $GS_STONE, skipped:$SKIPPED"
fi
if [ -n "$ABORTED" ]; then
  echo "${RED}COULD NOT RUN:${RESET}$ABORTED"
fi
# Guard against a "0 run" false pass: every suite reporting zero tests is not a clean run.
if [ "$TOTAL_RUN" -eq 0 ]; then
  echo "${RED}${BOLD}UNIT TESTS DID NOT RUN${RESET}"
  exit 1
fi
if [ "$FAILED" -ne 0 ]; then
  echo "${RED}${BOLD}UNIT TESTS FAILED${RESET}"
  exit 1
fi
echo "${GREEN}${BOLD}ALL UNIT TESTS PASSED${RESET}"
