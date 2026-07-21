#!/usr/bin/env bash
# Launch the native GemStone MCP server in a DEDICATED, DETACHED gem, then return.
#
# GsMcpServer forkOnPort: spawns a separate gem (via GsTsExternalSession) whose blocking main
# activity is the accept loop, and detaches it -- so the server keeps running after this script's
# topaz session logs out. (A background GsProcess fork inside a GCI session would freeze when the
# session goes idle; a dedicated gem's own activity does not.) forkOnPort: boots the most capable
# installed class: the Grail subclass if its file was loaded, otherwise the base server.
#
# This script does NOT block -- it returns once the server is forked. To stop the server, use the
# `System stopSession: <id>` line it prints (from any GemStone session), or kill the printed pid.
#
# Configure (or export before running):
#   GEMSTONE   - GemStone product directory (required)
#   GS_STONE   - stone name      (default: gs64stone)
#   GS_USER    - GemStone user   (default: DataCurator)
#   GS_PASS    - GemStone password (default: swordfish)
#   GS_MCP_PORT- listen port      (default: 8000)
set -euo pipefail
cd "$(dirname "$0")"

: "${GEMSTONE:?Set GEMSTONE to your GemStone product directory}"
GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"
GS_MCP_PORT="${GS_MCP_PORT:-8000}"
TOPAZ="$GEMSTONE/bin/topaz"

echo "Forking GsMcpServer onto 127.0.0.1:$GS_MCP_PORT (detached; this script returns)..."
"$TOPAZ" -l <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
run
GsMcpServer forkOnPort: $GS_MCP_PORT
%
logout
exit
TPZ
