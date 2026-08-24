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
#   --check   verify the environment (product, GEMSTONE_GLOBAL_DIR, the stone) and report, without
#             installing anything. Run this first on a machine you have not installed on before.
#
# Configure these (or export before running):
#   GEMSTONE       - GemStone product directory (REQUIRED; no default can be guessed)
#   GS_STONE       - stone name              (default: gs64stone)
#   GS_USER        - GemStone user           (default: DataCurator)
#   GS_PASS        - GemStone password       (default: swordfish)
#   GEMSTONE_GLOBAL_DIR - where the running stone recorded itself. Usually discovered; see
#                         gs-env.sh, which explains why this one variable decides whether a login
#                         works and why the failure names getaddrinfo.
# This script talks only to the STONE, so it needs no netldi and works on a host that has none.
set -euo pipefail
cd "$(dirname "$0")"

GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"

# Base classes only by default; pass --grail (or set GS_MCP_WITH_GRAIL) to also load the
# optional GemStone-Python (Grail) toolset -- only valid on an image that has Grail/ModuleAst.
LOAD_FILE="load.gs"
CHECK_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --grail) LOAD_FILE="load-grail.gs" ;;
    --check) CHECK_ONLY=1 ;;
    *) echo "usage: $0 [--grail] [--check]" >&2; exit 2 ;;
  esac
done
[ -n "${GS_MCP_WITH_GRAIL:-}" ] && LOAD_FILE="load-grail.gs"

# Resolve GEMSTONE/TOPAZ/GEMSTONE_GLOBAL_DIR and confirm the stone is actually running, so a
# misconfigured environment is reported in its own terms instead of as a topaz login failure.
. ./gs-env.sh
gs_env_resolve
if [ "$CHECK_ONLY" = "1" ]; then gs_env_check; exit $?; fi
gs_env_require_stone

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
  'McpServer' 'McpSession' 'McpRouter' 'McpMockSocket' 'McpMockWorker' 'McpMockSession'
  'McpStubSession' 'McpFixtureToolset' 'McpFixtureServer' 'McpToolTest' 'McpDispatcherTest'
  'McpTransportTest' 'McpContractTest' 'McpExtensionTest' 'McpSessionTest' 'McpAuthRouter'
  'McpAuthTest' 'McpAuthConformanceTest' ) asOrderedCollection.
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
