#!/usr/bin/env bash
# Run the native MCP server's in-image unit tests (no listening server required).
# Logs in via topaz and runs each GsTestCase suite, printing the TestResult for each.
# Exits non-zero if any test failed or errored.
#
# Assumes the classes are already installed (run ./install.sh first).
#
# WHICH SUITES RUN depends on what is installed, not on a list kept here: the auth suites and the
# Grail suite are added only if their classes resolve, because install.sh files in src/auth only on
# an image with kernel JWT support and src/grail only on --grail. A base install runs the ten core
# suites.
#
# NB: one suite is NOT purely in-image, and it needs a NETLDI.
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

# One suite forks a real worker gem and so needs a NETLDI: McpAuthTest, present only where the auth
# group could be installed. Ask the image whether it is there rather than asserting a netldi
# unconditionally -- the check has to survive a base install (and every 3.7.2 install, where the auth
# group cannot be filed in at all), and discovering the lack up front beats hitting it as a GciError
# partway through a suite run.
#
# Everything else runs with no netldi, including the cover for kernel defect #51438: McpMockWorker
# models the corrupting fetch in-image, so both sides of that defect are exercised without a gem.
gs_mcp_require_netldi_if_forking_suite_installed() {
  local nm have
  for nm in McpAuthTest; do
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
classes := #( 'McpToolTest' 'McpDispatcherTest' 'McpSessionTest' 'McpOutboxTest'
  'McpStreamTest' 'McpLifetimeTest' 'McpTransportTest' 'McpContractTest'
  'McpExtensionTest' ) asOrderedCollection.
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
