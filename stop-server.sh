#!/usr/bin/env bash
# Stop the native GemStone MCP server: find the gem process holding the LISTEN
# socket on the MCP port and terminate it. Counterpart to run-server.sh.
#
# Safe by construction:
#   * Only the process in the LISTEN state on the port is targeted -- never a
#     client merely connected TO port 8000.
#   * A process is killed only if it looks like a GemStone gem/topaz, so an
#     unrelated server that happens to use port 8000 is left alone.
# (The cleaner in-image alternative is `System stopSession: <id>` from any
# GemStone session; this script is the OS-level equivalent of `kill <pid>`.)
#
# Configure (or export before running):
#   GS_MCP_PORT - listen port (default: 8000)
set -euo pipefail
cd "$(dirname "$0")"

GS_MCP_PORT="${GS_MCP_PORT:-8000}"

# -t: pids only;  -sTCP:LISTEN: only the listener, not connected clients.
pids=$(lsof -nP -iTCP:"$GS_MCP_PORT" -sTCP:LISTEN -t 2>/dev/null || true)
if [ -z "$pids" ]; then
  echo "Nothing listening on 127.0.0.1:$GS_MCP_PORT -- no MCP server to stop."
  exit 0
fi

stopped=0
for pid in $pids; do
  comm=$(ps -p "$pid" -o comm= 2>/dev/null || true)
  case "$(basename "$comm")" in
    *gem*|*topaz*)
      echo "Stopping MCP server: pid $pid ($comm) on port $GS_MCP_PORT ..."
      kill "$pid" 2>/dev/null || true
      # Wait up to ~5s for a graceful exit, then force it.
      for _ in $(seq 1 10); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.5
      done
      if kill -0 "$pid" 2>/dev/null; then
        echo "  still running after SIGTERM; sending SIGKILL."
        kill -9 "$pid" 2>/dev/null || true
      fi
      stopped=$((stopped + 1))
      ;;
    *)
      echo "Refusing to kill pid $pid: '$comm' is not a GemStone gem/topaz process."
      echo "  Something else may be using port $GS_MCP_PORT; stop it manually if intended."
      ;;
  esac
done

echo "Stopped $stopped MCP server process(es) on port $GS_MCP_PORT."
