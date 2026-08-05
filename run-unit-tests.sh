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

# NOTE (macOS bash 3.2): this heredoc runs inside $( ... ), whose command-substitution scanner
# treats '#' in the body as a comment. A body line that STARTS with '(' whose matching ')' sits
# after a '#...symbol' is miscounted -> "bad substitution: no closing )". Keep such expressions
# off the start of a line (assign to a temp first, as with grailTest below).
OUT="$("$TOPAZ" -l <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
run
| s classes grailTest |
classes := #( 'McpToolTest' 'McpDispatcherTest' 'McpTransportTest' 'McpContractTest' 'McpAuthTest'
  'McpAuthConformanceTest' ) asOrderedCollection.
grailTest := System myUserProfile objectNamed: #McpServerWithGrailTest.
grailTest ifNotNil: [classes add: 'McpServerWithGrailTest'].
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
)"

echo "$OUT"
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
