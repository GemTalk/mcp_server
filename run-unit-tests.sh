#!/usr/bin/env bash
# Run the native MCP server's in-image unit tests (no listening server required).
# Logs in via topaz and runs each GsTestCase suite, printing the TestResult for each.
# Exits non-zero if any test failed or errored.
#
# Assumes the classes are already installed (run ./install.sh first).
#
# NB: McpAuthTest is not purely in-image -- its fixtures create and commit a throwaway
# JWT-enabled UserProfile (touching AllUsers) and it spawns a real worker gem, so a NETLDI
# must be running. It is included anyway: it is the only suite covering the token->session
# path, and leaving it out of this list once let a broken parse in McpAuthRouter (every
# token rejected as malformed) go unnoticed.
#
# Configure (or export before running):
#   GEMSTONE   - GemStone product directory (required)
#   GS_STONE   - stone name        (default: gs64stone)
#   GS_USER    - GemStone user     (default: DataCurator)
#   GS_PASS    - GemStone password (default: swordfish)
set -euo pipefail
cd "$(dirname "$0")"

: "${GEMSTONE:?Set GEMSTONE to your GemStone product directory}"
GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"
TOPAZ="$GEMSTONE/bin/topaz"

# Stream topaz output live AND keep a copy to gate on. Do NOT wrap the heredoc in $( ... ):
# under `set -e`, a command substitution that exits non-zero aborts the script BEFORE anything
# is printed, so ALL output was silently discarded whenever topaz's session status was tainted
# (e.g. a handled error inside a worker-gem test that `iferr 1 stk` escalated -- the test still
# passed, but topaz exited non-zero and you saw a blank terminal). Instead tee to a temp file,
# capture topaz's OWN exit code via PIPESTATUS, and always show the output.
# (Keep a line-leading '(' out of the Smalltalk -- assign to a temp first, as with grailTest.)
TMP="$(mktemp "${TMPDIR:-/tmp}/mcp-unit.XXXXXX")"
set +e
"$TOPAZ" -l 2>&1 <<TPZ | tee "$TMP"
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
run
| s classes grailTest |
classes := #( 'McpToolTest' 'McpDispatcherTest' 'McpSessionTest' 'McpTransportTest'
  'McpContractTest' 'McpExtensionTest' 'McpAuthTest' 'McpAuthConformanceTest' ) asOrderedCollection.
grailTest := System myUserProfile objectNamed: #McpGrailToolsetTest.
grailTest ifNotNil: [classes add: 'McpGrailToolsetTest'].
s := WriteStream on: String new.
classes do: [:nm | | res |
  res := (System myUserProfile objectNamed: nm asSymbol) suite run.
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
