#!/usr/bin/env bash
# Install the native GemStone MCP server classes into the image.
#
# Loads the code as the Rowan project 'Mcp' from the load spec rowan/specs/Mcp.ston
# (into the Published symbol dictionary). REQUIRES an image with Rowan 3 loaded (e.g. the
# extent0.rowan3 seed). Logs in via topaz, ensures the Published dictionary exists,
# resolves+loads the project, and commits.
#
#   --grail   load the Grail load spec (rowan/specs/McpGrail.ston) instead of the default one:
#             Core PLUS the optional GemStone-Python toolset (packages Mcp-Grail and
#             Mcp-Grail-Tests). Only valid on an image that has Grail/ModuleAst -- those methods
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
REPO_DIR="$(pwd)"

: "${GEMSTONE:?Set GEMSTONE to your GemStone product directory}"
GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"
TOPAZ="$GEMSTONE/bin/topaz"

# --grail (or GS_MCP_WITH_GRAIL) adds the optional Grail tools on top of the Rowan load.
WITH_GRAIL=""
if [ "${1:-}" = "--grail" ] || [ -n "${GS_MCP_WITH_GRAIL:-}" ]; then
  WITH_GRAIL=1
fi

# With --grail, resolve the Grail load spec (Core + the Python toolset) instead of the default one.
# Chosen BEFORE the load block below, which interpolates $SPEC.
SPEC="Mcp.ston"
MODE="rowan"
if [ -n "$WITH_GRAIL" ]; then
  SPEC="McpGrail.ston"
  MODE="rowan+grail"
fi

# Load the gs-mcp code as the Rowan project 'Mcp' from its load spec ($SPEC: Mcp.ston, or
# McpGrail.ston with --grail). Reaches RwSpecification
# the same way $GEMSTONE/rowan3/bin/installProject.stone does (it isn't in the default symbol list).
#
# GRAIL WORKAROUND, and it is why this block is more than four lines: each src/*/package.st holds the
# Tonel marker literal `Package { #name : '...' }`, and Rowan's reader resolves that class name
# through the loading user's symbol list. Grail defines its OWN Package class (in PythonAst, a
# ModuleAst subclass -- a Python AST node), and the Python dictionaries precede Globals, so Rowan
# gets an AST node and the load dies with "a Package does not understand #at:ifAbsent:" -- before
# any of our code loads, in BOTH plain and --grail modes.
#
# So we take the #Package BINDING out of the way for the duration of the load and put it back
# afterwards. Note it removes the one key, NOT the whole dictionary: hiding all of PythonAst also
# hides ModuleAst, and then --grail cannot compile (`undefined symbol` on ModuleAst) -- the two
# workarounds collide. Name resolution only matters while compiling, so already-compiled Grail
# methods are unaffected, and the ensure: restores the binding even if the load fails. If a crash
# ever does leave it out, restore it by hand with
#   (that dictionary) at: #Package put: <the class>   "PythonAst, a ModuleAst subclass"
#
# The load is wrapped in `on: Error do:` rather than `ensure:` ON PURPOSE: topaz's `iferr 1 : exit 1`
# terminates the session AT the error, so an ensure: never runs -- which is exactly how one failed
# load left a Grail image with no PythonAst in its symbol list, and therefore no ModuleAst. Handling
# the error keeps the restore on the normal path; the load's status comes back in the result string.
#
# TAKE THIS OUT when Rowan resolves the Tonel marker robustly (reported to the Rowan developer
# 2026-08-18) or when Grail renames its Package class. In an image WITHOUT Grail nothing here fires:
# `objectNamed: #Package` is nil, so the block is a plain Rowan load.
LOAD_BLOCK="run
| up shadow shadowed specCls spec result |
up := System myUserProfile.
shadow := (up objectNamed: #Package) isNil
  ifTrue: [ nil ]
  ifFalse: [ up symbolList detect: [:d | d includesKey: #Package ] ifNone: [ nil ] ].
shadowed := shadow isNil ifTrue: [ nil ] ifFalse: [ shadow at: #Package ].
shadow ifNotNil: [ shadow removeKey: #Package. System commitTransaction ].
result := [
  specCls := (Rowan globalNamed: 'RwSpecification')
    ifNil: [ (AllUsers userWithId: 'SystemUser' ifAbsent: []) objectNamed: 'RwSpecification' ].
  spec := specCls fromUrl: 'file://$REPO_DIR/rowan/specs/$SPEC'.
  spec diskUrl: 'file://$REPO_DIR'.
  spec resolve load.
  System commitTransaction.
  'Mcp project loaded via Rowan'
] on: Error do: [:ex |
  System abortTransaction.
  'LOAD FAILED: ' , ([ex description] on: Error do: [:x | ex class name asString]) ].
shadow ifNotNil: [ shadow at: #Package put: shadowed. System commitTransaction ].
result , (shadow isNil
  ifTrue: [ '' ]
  ifFalse: [ ' (moved ' , shadow name asString , ' #Package aside; restored)' ])
%"


"$TOPAZ" -l <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 exit 1
run
"Ensure the Published dictionary exists (self-referenced + inserted into the symbol list) so
 the classes land in Published. Create it only if absent -- Published is standard in most
 images, so this is usually a no-op."
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
$LOAD_BLOCK
errorcount
output pop
errorcount
commit
logout
exit
TPZ
# The Rowan load HANDLES its own errors (so the Package binding is always restored), which means
# topaz can exit 0 on a failed load. Detect it from the status the load block returned into load.out.
# Match the RESULT line topaz prints ("[oop size:N Class] <value>"), not the block's source: topaz
# echoes the source into load.out too, so grepping for the failure text alone matches the code itself.
if ! grep -qE '^\[[0-9]+ size:[0-9]+ +[A-Za-z0-9]+\] Mcp project loaded via Rowan' load.out; then
  echo "Rowan load FAILED (mode: $MODE) -- see load.out:" >&2
  grep -E '^\[[0-9]+ size:[0-9]+ +[A-Za-z0-9]+\] LOAD FAILED' load.out >&2 || tail -5 load.out >&2
  exit 1
fi
echo "Mcp* classes installed and committed (mode: $MODE)."
