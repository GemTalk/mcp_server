#!/usr/bin/env bash
# End-to-end TLS test for the native GemStone MCP server.
#
# Proves the server speaks the MCP Streamable HTTP transport over TLS (HTTPS): it forks an
# McpRouter with TLS enabled, then acts as an HTTPS client (curl -k, self-signed cert) driving
# the transport end to end -- TLS handshake, the SSE GET stream, initialize, the initialized
# notification, a routed tool call, the unknown-session 404 -- and confirms plaintext HTTP is
# NOT served on the TLS port.
#
# Self-contained: generates a throwaway self-signed localhost cert under certs/ if one is absent.
#
# No lasting side effects: the router's TLS config is per-instance and travels in the fork string;
# nothing is committed, so no shared/class state is touched and there is nothing to restore even if
# this script is interrupted.
#
# Configure (or export before running):
#   GEMSTONE    - GemStone product directory (required)
#   GS_STONE    - stone name        (default: gs64stone)
#   GS_USER     - GemStone user     (default: DataCurator)
#   GS_PASS     - GemStone password (default: swordfish)
#   GS_MCP_PORT - test port         (default: 8443, kept off the usual 8000)
#
# Exit status 0 = all checks passed.
set -uo pipefail
cd "$(dirname "$0")"

: "${GEMSTONE:?Set GEMSTONE to your GemStone product directory}"
export GS_STONE="${GS_STONE:-gs64stone}"
export GS_USER="${GS_USER:-DataCurator}"
export GS_PASS="${GS_PASS:-swordfish}"
PORT="${GS_MCP_PORT:-8443}"
HOST=127.0.0.1
URL="https://$HOST:$PORT/mcp"
CERT="$(pwd)/certs/server.crt"
KEY="$(pwd)/certs/server.key"
TOPAZ="$GEMSTONE/bin/topaz"
SERVER_LOG="$(mktemp -t gsmcp-tls-server.XXXXXX)"

PASS=0; FAIL=0; SID=""

cleanup() {
  echo
  echo "Tearing down TLS server on port $PORT ..."
  local pid
  pid="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null || true)"
  [ -n "$pid" ] && kill $pid 2>/dev/null
  rm -f "$SERVER_LOG"
}
trap cleanup EXIT

# check NAME EXPECTED-SUBSTRING ACTUAL
check() {
  if printf '%s' "$3" | grep -qF -- "$2"; then
    printf '  \033[32m✓\033[0m %s\n' "$1"; PASS=$((PASS+1))
  else
    printf '  \033[31m✗\033[0m %s\n' "$1"
    printf '      expected to contain: %s\n' "$2"
    printf '      got: %s\n' "$3"
    FAIL=$((FAIL+1))
  fi
}

# post -- reads a JSON-RPC body from stdin, returns the response body over TLS (carries the session)
post() { curl -sk -m 10 "$URL" -H "MCP-Session-Id: $SID" --data-binary @-; }

echo "=== GemStone MCP server TLS end-to-end test ==="
echo "Stone=$GS_STONE  User=$GS_USER  Port=$PORT (https)"
echo

# ---------------------------------------------------------------------------
echo "[1/4] Ensuring a self-signed localhost certificate exists ..."
if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "  generating certs/server.crt + certs/server.key (self-signed, CN=localhost) ..."
  mkdir -p certs
  openssl req -x509 -newkey rsa:2048 -nodes -keyout "$KEY" -out "$CERT" \
    -days 825 -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1
  chmod 600 "$KEY"
else
  echo "  using existing certs/server.crt + certs/server.key"
fi
echo

# ---------------------------------------------------------------------------
echo "[2/4] Forking a TLS McpRouter on $HOST:$PORT (instance TLS config; nothing committed) ..."
"$TOPAZ" -l >"$SERVER_LOG" 2>&1 <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
run
(McpRouter new useTlsCertificateFile: '$CERT' privateKeyFile: '$KEY') forkOnPort: $PORT
%
logout
exit
TPZ

for i in $(seq 1 60); do nc -z $HOST "$PORT" 2>/dev/null && break; sleep 0.5; done
if ! nc -z $HOST "$PORT" 2>/dev/null; then
  echo "  ERROR: TLS server did not start listening on $PORT. topaz log:"
  sed 's/^/      /' "$SERVER_LOG"
  exit 1
fi
echo "  server is listening on $HOST:$PORT"
echo

# ---------------------------------------------------------------------------
echo "[3/4] Driving HTTPS requests from the client ..."

# --- TLS handshake + server certificate (verbose; a GET spawns no worker gem) ---
tls=$(curl -kv -N -m 3 "$URL" 2>&1 | head -40)
check "TLS handshake negotiates TLS"           'SSL connection using TL'  "$tls"
check "server presents the localhost cert"     'CN=localhost'             "$tls"

# --- SSE GET stream over TLS (headers + body, without the verbose handshake noise) ---
sse=$(curl -sk -i -N -m 3 "$URL" 2>&1 | head -12)
check "GET /mcp over TLS => text/event-stream" 'text/event-stream'        "$sse"
check "GET /mcp over TLS sends 'connected'"    ': connected'              "$sse"

# --- initialize establishes this client's session id (MCP-Session-Id) ---
r=$(curl -sk -i -m 10 "$URL" --data-binary @- <<'JSON'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"tls-test-client","version":"1.0"}}}
JSON
)
SID=$(printf '%s' "$r" | grep -i '^mcp-session-id:' | tr -d '\r' | awk '{print $2}')
check "initialize over TLS => 200 OK"          'HTTP/1.1 200 OK'          "$r"
check "initialize returns protocolVersion"     '"protocolVersion"'        "$r"
check "initialize returns serverInfo name"     '"name":"gemstone-mcp"'    "$r"
check "initialize assigns MCP-Session-Id"      'MCP-Session-Id'           "$r"
echo "  session id: $SID"

# --- initialized notification ---
code=$(curl -sk -m 10 -o /dev/null -w '%{http_code}' "$URL" -H "MCP-Session-Id: $SID" --data-binary @- <<'JSON'
{"jsonrpc":"2.0","method":"notifications/initialized"}
JSON
)
check "initialized notification => 202"        '202'                      "$code"

# --- routed tools/list (forwarded to this client's worker gem over TLS) ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
JSON
)
check "routed tools/list over TLS returns tools" '"tools"'                "$r"
check "tools/list includes execute_code"       '"name":"execute_code"'    "$r"

# --- routed execute_code ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"execute_code","arguments":{"code":"6 * 7"}}}
JSON
)
check "execute_code over TLS 6*7 => 42"        '"text":"42"'              "$r"

# --- unknown session id => 404 (routing intact under TLS) ---
code=$(curl -sk -m 10 -o /dev/null -w '%{http_code}' "$URL" -H "MCP-Session-Id: deadbeef" --data-binary @- <<'JSON'
{"jsonrpc":"2.0","id":4,"method":"tools/list"}
JSON
)
check "unknown session over TLS => 404"        '404'                      "$code"

# --- negative: plaintext HTTP to the TLS port is not served (handshake fails, no HTTP) ---
plain=$(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://$HOST:$PORT/mcp" -d '{}' 2>/dev/null || true)
check "cleartext HTTP to the TLS port gets no HTTP response" '000'        "$plain"

# ---------------------------------------------------------------------------
echo
echo "[4/4] Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
