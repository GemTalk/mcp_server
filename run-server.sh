#!/usr/bin/env bash
# Launch the native GemStone MCP server in a DEDICATED, DETACHED gem, then return.
#
# McpRouter forkOnPort: spawns a separate gem (via GsTsExternalSession) whose blocking main
# activity is the accept loop, and detaches it -- so the server keeps running after this script's
# topaz session logs out. (A background GsProcess fork inside a GCI session would freeze when the
# session goes idle; a dedicated gem's own activity does not.) The front end is always McpRouter; it
# resolves the worker class and the tool surface ONCE PER SESSION and pushes them into each per-client
# worker gem, which never chooses for itself. Unconfigured, that is McpServer with the core toolsets
# plus the Grail (python) toolset when its optional file has been loaded.
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
#   GS_MCP_WORKER_CLASS - McpServer subclass the workers should instantiate (default McpServer).
#                     Subclass to change BEHAVIOR; to add tools write a toolset instead.
#   GS_MCP_TOOLSETS - space-separated McpToolset names to expose instead of the default surface,
#                     e.g. "McpBrowsingToolset McpSearchToolset". Empty means the default.
#   Session lifetime (how long a quiet client keeps its worker gem, whether it may keep it
#                     indefinitely, and when it is warned) is configured with the GS_MCP_IDLE_TIMEOUT
#                     family -- see ./session-lifetime.sh, which documents each one. The common case
#                     for a localhost server you come back to hours later is
#                     GS_MCP_IDLE_TIMEOUT=none, which keeps a session alive for as long as its client
#                     keeps answering liveness pings.
#   GS_MCP_TITLE    - human-readable label for THIS INSTANCE, reported as serverInfo.title, e.g.
#                     "GemStone - staging (gs64stone)". Empty means no title at all: the key is
#                     omitted and clients display the server name. Use this -- not a relabeled
#                     serverName -- to tell two deployments of the same software apart.
set -euo pipefail
cd "$(dirname "$0")"

: "${GEMSTONE:?Set GEMSTONE to your GemStone product directory}"
GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"
GS_MCP_PORT="${GS_MCP_PORT:-8000}"
GS_MCP_READONLY="${GS_MCP_READONLY:-0}"
GS_MCP_WORKER_CLASS="${GS_MCP_WORKER_CLASS:-}"
GS_MCP_TOOLSETS="${GS_MCP_TOOLSETS:-}"
GS_MCP_TITLE="${GS_MCP_TITLE:-}"
TOPAZ="$GEMSTONE/bin/topaz"

# Session-lifetime setters (GS_MCP_IDLE_TIMEOUT and friends) -> $LIFETIME_LINES; empty when none are
# set, leaving McpRouter>>initialize's defaults in place.
. ./session-lifetime.sh

[ "$GS_MCP_READONLY" = "1" ] && RO="true" || RO="false"

# Optional worker-class / toolset configuration, as extra Smalltalk setter sends on the router.
CONFIG=""
[ -n "$GS_MCP_WORKER_CLASS" ] && CONFIG="$CONFIG
r workerClassName: '$GS_MCP_WORKER_CLASS'."
if [ -n "$GS_MCP_TOOLSETS" ]; then
  LITERALS=""
  for t in $GS_MCP_TOOLSETS; do LITERALS="$LITERALS '$t'"; done
  CONFIG="$CONFIG
r toolsetNames: #($LITERALS)."
fi
# Free-form operator text, so double any embedded quote rather than letting it close the literal.
if [ -n "$GS_MCP_TITLE" ]; then
  CONFIG="$CONFIG
r serverTitle: '$(printf '%s' "$GS_MCP_TITLE" | sed "s/'/''/g")'."
fi
echo "Forking McpRouter (readOnly=$RO) onto 127.0.0.1:$GS_MCP_PORT (detached; this script returns)..."
"$TOPAZ" -l <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
run
| r |
r := McpRouter new.
r readOnly: $RO.$CONFIG$LIFETIME_LINES
r forkOnPort: $GS_MCP_PORT
%
logout
exit
TPZ
