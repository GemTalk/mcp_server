#!/usr/bin/env bash
# Install the native GemStone MCP server classes into the image.
#
# Loads the code as the Rowan project 'Mcp' from the load spec rowan/specs/Mcp.ston
# (into the Published symbol dictionary). REQUIRES an image with Rowan 3 loaded (e.g. the
# extent0.rowan3 seed). Logs in via topaz, ensures the Published dictionary exists,
# resolves+loads the project, and commits.
#
#   --grail   after the Rowan load, also file in the optional GemStone-Python (Grail) toolset
#             (McpGrailToolset + its test, via load-grail.gs); only valid on an image that
#             has Grail/ModuleAst. Equivalently, set GS_MCP_WITH_GRAIL=1. Once loaded, the
#             toolset joins the default tool surface automatically (see
#             McpServer class>>installedDefaultToolsetNames).
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

# Load the gs-mcp code as the Rowan project 'Mcp' from its load spec. Reaches RwSpecification
# the same way $GEMSTONE/rowan3/bin/installProject.stone does (it isn't in the default symbol list).
#
# GRAIL WORKAROUND, and it is why this block is more than four lines: each src/*/package.st holds the
# Tonel marker literal `Package { #name : '...' }`, and Rowan's reader resolves that class name
# through the loading user's symbol list. Grail defines its OWN Package class (in PythonAst, a
# ModuleAst subclass -- a Python AST node), and the Python dictionaries precede Globals, so Rowan
# gets an AST node and the load dies with "a Package does not understand #at:ifAbsent:" -- before
# any of our code loads, in BOTH plain and --grail modes. So: hide the shadowing dictionary for the
# duration of the load, then put it back. Name resolution only matters while compiling, so
# already-compiled Grail methods are unaffected, and the ensure: restores the dictionary even if the
# load fails. If a crash ever does leave it out, restore it by hand with
#   System myUserProfile insertDictionary: (AllUsers ... objectNamed: #PythonAst) at: <index>
#
# TAKE THIS OUT when Rowan resolves the Tonel marker robustly (reported to the Rowan developer
# 2026-08-18) or when Grail renames its Package class. In an image WITHOUT Grail nothing here fires:
# `objectNamed: #Package` is nil, so the block is a plain Rowan load.
LOAD_BLOCK="run
| up shadow idx specCls spec result |
up := System myUserProfile.
shadow := (up objectNamed: #Package) isNil
  ifTrue: [ nil ]
  ifFalse: [ up symbolList detect: [:d | d includesKey: #Package ] ifNone: [ nil ] ].
idx := shadow isNil ifTrue: [ 0 ] ifFalse: [ up symbolList indexOf: shadow ].
shadow ifNotNil: [ up removeDictionaryAt: idx. System commitTransaction ].
result := [
  specCls := (Rowan globalNamed: 'RwSpecification')
    ifNil: [ (AllUsers userWithId: 'SystemUser' ifAbsent: []) objectNamed: 'RwSpecification' ].
  spec := specCls fromUrl: 'file://$REPO_DIR/rowan/specs/Mcp.ston'.
  spec diskUrl: 'file://$REPO_DIR'.
  spec resolve load.
  System commitTransaction.
  'Mcp project loaded via Rowan'
] ensure: [
  shadow ifNotNil: [ up insertDictionary: shadow at: idx. System commitTransaction ] ].
result , (shadow isNil ifTrue: [ '' ] ifFalse: [ ' (hid ' , shadow name asString , ' for the load)' ])
%"

# With --grail, file in the optional Grail toolset + its test suite after the base load.
MODE="rowan"
if [ -n "$WITH_GRAIL" ]; then
  LOAD_BLOCK="$LOAD_BLOCK
input load-grail.gs"
  MODE="rowan+grail"
fi

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
echo "Mcp* classes installed and committed (mode: $MODE)."
