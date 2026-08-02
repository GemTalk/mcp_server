#!/usr/bin/env bash
# Launch the native GemStone MCP server in a DEDICATED, DETACHED gem, then return.
#
# McpRouter forkOnPort: spawns a separate gem (via GsTsExternalSession) whose blocking main
# activity is the accept loop, and detaches it -- so the server keeps running after this script's
# topaz session logs out. (A background GsProcess fork inside a GCI session would freeze when the
# session goes idle; a dedicated gem's own activity does not.) The front end is always McpRouter;
# each per-client worker gem independently loads the most capable installed worker class (the Grail
# subclass if its file was loaded, otherwise the base McpServer).
#
# This script does NOT block -- it returns once the server is forked. To stop the server, run
# ./stop-server.sh (by port), or use the `System stopSession: <id>` / `kill <pid>` line it prints.
#
# Config lives on the router INSTANCE (no committed class state); forkOnPort: carries it to the
# child gem in the fork string. This launches the base, unauthenticated, localhost router -- for the
# OAuth/OIDC network-facing router, see run-auth-server.sh.
#
# Configure (or export before running):
#   GEMSTONE   - GemStone product directory (required)
#   GS_STONE   - stone name      (default: gs64stone)
#   GS_USER    - GemStone user   (default: DataCurator)
#   GS_PASS    - GemStone password (default: swordfish)
#   GS_MCP_PORT- listen port      (default: 8000)
#   GS_MCP_READONLY - 1 to open a read-only server (mutating tools hidden + refused; a localhost
#                     convenience so a single user cannot accidentally mutate the image). Default 0.
set -euo pipefail
cd "$(dirname "$0")"

: "${GEMSTONE:?Set GEMSTONE to your GemStone product directory}"
GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"
GS_MCP_PORT="${GS_MCP_PORT:-8000}"
GS_MCP_READONLY="${GS_MCP_READONLY:-0}"
TOPAZ="$GEMSTONE/bin/topaz"

[ "$GS_MCP_READONLY" = "1" ] && RO="true" || RO="false"
echo "Forking McpRouter (readOnly=$RO) onto 127.0.0.1:$GS_MCP_PORT (detached; this script returns)..."
"$TOPAZ" -l <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
run
(McpRouter new readOnly: $RO) forkOnPort: $GS_MCP_PORT
%
logout
exit
TPZ
