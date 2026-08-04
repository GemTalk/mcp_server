#!/usr/bin/env bash
# Score McpAuthConformanceTest: the MCP authorization-spec conformance checklist for McpAuthRouter.
#
# Unlike run-unit-tests.sh this is a BURN-DOWN REPORT, not a gate. Several tests assert requirements
# the router does not implement yet and fail on purpose, so this script prints a PASS/FAIL line per
# test and exits 0 regardless. Pass --strict to exit non-zero on any failure -- do that once the
# suite is green (at which point move the class into run-unit-tests.sh and drop this script).
#
# Each test is run individually rather than as one suite, so the output names exactly which
# requirements are unmet, and one erroring test cannot hide the rest.
#
# Some tests (the per-request authorization ones) provision a throwaway JWT UserProfile and spawn a
# worker gem, so a NETLDI must be running -- same prerequisite as McpAuthTest in run-unit-tests.sh.
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
STRICT=0
[ "${1:-}" = "--strict" ] && STRICT=1

# NOTE (macOS bash 3.2): this heredoc runs inside $( ... ), whose command-substitution scanner treats
# '#' in the body as a comment, so a body line STARTING with '(' whose matching ')' sits after a
# '#...symbol' is miscounted -> "bad substitution: no closing )". Keep such expressions off the start
# of a line (assign to a temp first, as with cls below).
OUT="$("$TOPAZ" -l <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
run
| s cls sels passed failed |
cls := System myUserProfile objectNamed: #McpAuthConformanceTest.
cls isNil ifTrue: [^'MISSING: McpAuthConformanceTest is not installed -- run ./install.sh'].
s := WriteStream on: String new.
"Topaz prefixes the first line of a returned String with an object header, which would hide the
 first result line from a line-anchored grep, so start the report on its own line."
s nextPut: Character lf.
passed := 0.
failed := 0.
sels := cls testSelectors asSortedCollection.
sels do: [:sel | | res ok |
  res := [(cls selector: sel) run] on: Error do: [:e | nil].
  ok := res notNil and: [res passedCount = 1].
  ok ifTrue: [passed := passed + 1] ifFalse: [failed := failed + 1].
  s nextPutAll: (ok ifTrue: ['PASS  '] ifFalse: ['FAIL  ']); nextPutAll: sel; nextPut: Character lf].
s nextPutAll: 'SCORE '; nextPutAll: passed printString; nextPutAll: ' of ';
  nextPutAll: (passed + failed) printString; nextPutAll: ' conformance tests passing';
  nextPut: Character lf.
s contents
%
logout
exit
TPZ
)"

echo "$OUT"

if echo "$OUT" | grep -q '^MISSING:'; then
  exit 1
fi
if [ "$STRICT" = "1" ] && echo "$OUT" | grep -q '^FAIL  '; then
  echo "CONFORMANCE FAILURES (--strict)"
  exit 1
fi
exit 0
