#!/usr/bin/env bash
# Install the native GemStone MCP server classes into the image.
#
# By default this loads the code as the Rowan project 'Mcp' from the load spec
# rowan/specs/Mcp.ston (packages Mcp-Core + Mcp-Tests, into the Published symbol
# dictionary). This REQUIRES an image with Rowan 3 loaded (e.g. the extent0.rowan3
# seed). Logs in via topaz, ensures the Published dictionary exists, resolves+loads
# the project, and commits.
#
# Legacy / alternate load modes (file in the flat top-level Mcp*.gs files instead):
#   --flat    file in load.gs (the pre-Rowan flat file-out; works on any image)
#   --grail   file in load-grail.gs (flat + the optional GemStone-Python/Grail tools;
#             only valid on an image that has Grail/ModuleAst)
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

# Select the load mode. Default is Rowan; --flat / --grail select the flat file-in paths.
MODE="rowan"
case "${1:-}" in
  --flat)  MODE="flat"  ;;
  --grail) MODE="grail" ;;
  "")      [ -n "${GS_MCP_WITH_GRAIL:-}" ] && MODE="grail" ;;
esac

# Build the topaz load command(s) for the chosen mode.
case "$MODE" in
  rowan)
    LOAD_BLOCK="run
\"Load the gs-mcp code as the Rowan project 'Mcp' from its load spec. Reaches RwSpecification
 the same way \$GEMSTONE/rowan3/bin/installProject.stone does (it isn't in the default symbol list).\"
| specCls spec |
specCls := (Rowan globalNamed: 'RwSpecification')
  ifNil: [ (AllUsers userWithId: 'SystemUser' ifAbsent: []) objectNamed: 'RwSpecification' ].
spec := specCls fromUrl: 'file://$REPO_DIR/rowan/specs/Mcp.ston'.
spec diskUrl: 'file://$REPO_DIR'.
spec resolve load.
System commitTransaction.
'Mcp project loaded via Rowan'
%"
    ;;
  flat)  LOAD_BLOCK="input load.gs" ;;
  grail) LOAD_BLOCK="input load-grail.gs" ;;
esac

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
