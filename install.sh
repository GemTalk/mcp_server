#!/usr/bin/env bash
# Install the native GemStone MCP server classes into the image.
#
# Logs in via topaz, ensures the Published dictionary exists, files in the Mcp* classes as plain
# topaz file-outs (src/core, src/tests, src/auth -- see load.gs), and commits. No Rowan, no Tonel: the .gs
# files are canonical `fileOutClass` output and load into any image topaz can log into.
#
# NOTE: filing these .gs files over classes a Rowan project had loaded fails at the first method
# with "Duplicate definition of ... (error 2318)". Install into an image that never loaded the Rowan
# 'Mcp' project, or remove the Mcp* keys from Published and commit first. See README, Source layout.
#
#   --grail   file in load-grail.gs instead: the base PLUS the optional GemStone-Python toolset
#             (src/grail). Only valid on an image that has Grail/ModuleAst -- those methods
#             reference ModuleAst and BaseException and cannot compile without it. Equivalently,
#             set GS_MCP_WITH_GRAIL=1. Once loaded, the toolset joins the default tool surface
#             automatically (see McpServer class>>installedDefaultToolsetNames).
#
# Configure these (or export before running):
#   GEMSTONE       - GemStone product directory (defaults to $GEMSTONE if set)
#   GS_STONE       - stone name              (default: gs64stone)
#   GS_USER        - GemStone user           (default: DataCurator)
#   GS_PASS        - GemStone password       (default: swordfish)
set -euo pipefail
cd "$(dirname "$0")"

: "${GEMSTONE:?Set GEMSTONE to your GemStone product directory}"
GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"
TOPAZ="$GEMSTONE/bin/topaz"

# Base classes only by default; pass --grail (or set GS_MCP_WITH_GRAIL) to also load the
# optional GemStone-Python (Grail) toolset -- only valid on an image that has Grail/ModuleAst.
LOAD_FILE="load.gs"
if [ "${1:-}" = "--grail" ] || [ -n "${GS_MCP_WITH_GRAIL:-}" ]; then
  LOAD_FILE="load-grail.gs"
fi

# The loaders `input` their class files by paths relative to the repository root, so topaz must run
# with this directory as its current directory -- hence the cd above, and no `cd` after it.
#
# Stream topaz's output live AND keep a copy to gate on. Do NOT wrap the heredoc in $( ... ): under
# `set -e` a command substitution that exits non-zero aborts the script before anything is printed,
# hiding the very output you need to diagnose the load. Tee to a temp file instead.
TMP="$(mktemp "${TMPDIR:-/tmp}/mcp-install.XXXXXX")"
set +e
"$TOPAZ" -l 2>&1 <<TPZ | tee "$TMP"
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 exit 1
run
"Ensure the Published dictionary exists (self-referenced + inserted into the symbol list) so
 the classes' 'inDictionary: Published' resolves during file-in. Create it only if absent --
 Published is standard in most images, so this is usually a no-op."
| up existing d |
up := System myUserProfile.
existing := up resolveSymbol: #Published.
existing isNil
  ifTrue: [
    d := SymbolDictionary new.
    d at: #Published put: d.
    up insertDictionary: d at: up symbolList size + 1.
    System commitTransaction.
    'Published created' ]
  ifFalse: [ 'Published already exists' ].
%
display oops
errorcount
output push load.out only
input $LOAD_FILE
errorcount
output pop
errorcount
commit
run
"Confirm every class the loaders were supposed to define is really there, and answer a sentinel
 the shell can gate on. A file-in reports its compile errors into load.out and then carries on, so
 topaz's own exit status is not enough -- ask the image what it actually has."
| up names missing |
names := #( 'McpError' 'McpTool' 'McpToolRegistry' 'McpToolset' 'McpBrowsingToolset'
  'McpExecutionToolset' 'McpListingToolset' 'McpMutationToolset' 'McpSearchToolset'
  'McpSessionToolset' 'McpTestingToolset' 'McpHttpConnection' 'McpDispatcher' 'McpBase'
  'McpServer' 'McpSession' 'McpRouter' 'McpMockSocket' 'McpStubSession' 'McpFixtureToolset'
  'McpFixtureServer' 'McpToolTest' 'McpDispatcherTest' 'McpTransportTest' 'McpContractTest'
  'McpExtensionTest' 'McpAuthRouter' 'McpAuthTest' 'McpAuthConformanceTest' ) asOrderedCollection.
'$LOAD_FILE' = 'load-grail.gs'
  ifTrue: [ names add: 'McpGrailToolset'; add: 'McpGrailToolsetTest' ].
up := System myUserProfile.
missing := names select: [:nm | (up objectNamed: nm asSymbol) isNil ].
missing isEmpty
  ifTrue: [ 'MCP LOAD OK: ' , names size printString , ' classes' ]
  ifFalse: [ 'MCP LOAD FAILED, missing: ' , missing printString ]
%
logout
exit
TPZ
rc=${PIPESTATUS[0]}
set -e
OUT="$(cat "$TMP")"
rm -f "$TMP"

# Gate on the sentinel the verification block returned, not on topaz's exit status: a file-in reports
# its compile errors and carries on, so topaz can exit 0 over a partial load. Match the RESULT line
# topaz prints ("[oop size:N Class] <value>") so the grep cannot match the block's own source, which
# topaz echoes back too.
if ! echo "$OUT" | grep -qE '^\[[0-9]+ size:[0-9]+ +[A-Za-z0-9]+\] MCP LOAD OK'; then
  echo "MCP file-in FAILED (loaded: $LOAD_FILE) -- see load.out for the compiler errors:" >&2
  echo "$OUT" | grep -E '^\[[0-9]+ size:[0-9]+ +[A-Za-z0-9]+\] MCP LOAD FAILED' >&2 || true
  [ "$rc" -ne 0 ] && echo "(topaz also exited $rc)" >&2
  exit 1
fi
[ "$rc" -ne 0 ] && echo "WARNING: topaz exited $rc -- session status was tainted (see above)." >&2
echo "Mcp* classes installed and committed (loaded: $LOAD_FILE)."
