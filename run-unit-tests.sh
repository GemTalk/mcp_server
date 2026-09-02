#!/usr/bin/env bash
# Run the native MCP server's in-image unit tests (no listening server required).
# Logs in via topaz and runs each GsTestCase suite, printing the TestResult for each.
# Exits non-zero if any test failed or errored.
#
# Assumes the classes are already installed (run ./install.sh first).
#
# WHICH SUITES RUN depends on what is installed, not on a list kept here: the auth suites and the
# Grail suite are added only if their classes resolve, because install.sh files in src/auth only on
# an image with kernel JWT support and src/grail only on --grail. A base install runs the twelve
# core suites.
#
# NB: four suites are NOT purely in-image, and all four need a NETLDI.
#   McpExternalSessionTest  drives a real worker gem to check that a result comes back with the
#                           bytes the worker sent. It fails on any image before 3.7.4.1, which
#                           carries kernel defect #51438 -- that failure is the suite working, not
#                           a regression in gs-mcp. See its class comment.
#   McpTransactionTest      spawns a worker gem to commit a CONFLICTING change, which is the only
#                           way to reach the state a failed commit leaves a session in. Nothing
#                           short of a real second session can produce it.
#   McpWorkerDeadlineTest   drives a real worker gem to check that a call which outruns the request
#                           deadline is actually broken, and that the gem is usable afterwards --
#                           the one claim the deadline rests on and the one a mock cannot make.
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
#   --check    verify the environment and report, without running any tests.
set -euo pipefail
cd "$(dirname "$0")"

GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"

# Four suites fork a real worker gem and so need a NETLDI: McpExternalSessionTest,
# McpTransactionTest and McpWorkerDeadlineTest (all always installed, see below) and McpAuthTest
# (only where the auth group could be). Ask the image which are present
# rather than asserting a netldi unconditionally -- the check still has to survive an image where
# none is installed, and discovering the lack up front beats hitting it as a GciError partway
# through a suite run.
#
# In practice the first three are always there, so a netldi is in practice always required.
# That is not a new burden: gs-mcp gives every client its own worker gem, so it cannot serve a
# single request without a netldi. What changed is that the test run now says so plainly instead of
# passing on an image the server could not actually run on.
gs_mcp_require_netldi_if_forking_suite_installed() {
  local nm have
  for nm in McpExternalSessionTest McpTransactionTest McpWorkerDeadlineTest McpAuthTest; do
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
  gs_mcp_require_netldi_if_forking_suite_installed || exit 1
  exit 0
fi
gs_env_require_stone
gs_mcp_require_netldi_if_forking_suite_installed

# Stream topaz output live AND keep a copy to gate on. Do NOT wrap the heredoc in $( ... ):
# under `set -e`, a command substitution that exits non-zero aborts the script BEFORE anything
# is printed, so ALL output was silently discarded whenever topaz's session status was tainted
# (e.g. a handled error inside a worker-gem test that `iferr 1 stk` escalated -- the test still
# passed, but topaz exited non-zero and you saw a blank terminal). Instead tee to a temp file,
# capture topaz's OWN exit code via PIPESTATUS, and always show the output.
# (Keep a line-leading '(' out of the Smalltalk -- assign to a temp first, as the optional-suite
# loop below does with `cls`.)
TMP="$(mktemp "${TMPDIR:-/tmp}/mcp-unit.XXXXXX")"
set +e
"$TOPAZ" -l 2>&1 <<TPZ | tee "$TMP"
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
run
| s classes up optional |
up := System myUserProfile.
classes := #( 'McpBlindWriteTest' 'McpToolTest' 'McpDispatcherTest' 'McpSessionTest' 'McpOutboxTest' 'McpProgressTest'
  'McpStreamTest' 'McpLifetimeTest' 'McpTransportTest' 'McpContractTest'
  'McpExtensionTest' 'McpExternalSessionTest' 'McpTransactionTest'
  'McpWorkerDeadlineTest' ) asOrderedCollection.
"Suites from the optional groups, run only where their group was installed. Named as a list so
 adding one is a one-word change, and so a missing suite is a skip rather than a doesNotUnderstand."
optional := #( 'McpAuthTest' 'McpAuthConformanceTest' 'McpGrailToolsetTest' ).
optional do: [:nm | | cls |
  cls := up objectNamed: nm asSymbol.
  cls ifNotNil: [classes add: nm]].
s := WriteStream on: String new.
classes do: [:nm | | res |
  res := (up objectNamed: nm asSymbol) suite run.
  s nextPutAll: nm; nextPutAll: ': ';
    nextPutAll: res runCount printString; nextPutAll: ' run, ';
    nextPutAll: res passedCount printString; nextPutAll: ' passed, ';
    nextPutAll: res failureCount printString; nextPutAll: ' failed, ';
    nextPutAll: res errorCount printString; nextPutAll: ' errors';
    nextPut: Character lf].
s contents
%
logout
exit
TPZ
rc=${PIPESTATUS[0]}
set -e
OUT="$(cat "$TMP")"
rm -f "$TMP"

# A non-zero topaz exit no longer hides the run; the test counts below are authoritative.
[ "$rc" -ne 0 ] && echo "WARNING: topaz exited $rc -- session status was tainted (see any stack trace above)."
# Each result line reads "N run, N passed, N failed, N errors".
# Fail if any non-zero failed/errors count appears.
if echo "$OUT" | grep -qE '[1-9][0-9]* (failed|errors)'; then
  echo "UNIT TESTS FAILED"
  exit 1
fi
# Sanity: make sure tests actually ran (guard against a "0 run" false pass).
if ! echo "$OUT" | grep -qE '[1-9][0-9]* run'; then
  echo "UNIT TESTS DID NOT RUN"
  exit 1
fi
echo "ALL UNIT TESTS PASSED"
