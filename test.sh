#!/usr/bin/env bash
# Integration smoke test for the native GemStone MCP server.
#
# Starts the server in its own gem (one session) via run-server.sh, then acts as an
# MCP client (a separate process) driving the Streamable HTTP transport end-to-end:
# initialize, the initialized notification, tools/list, every core tool, the error
# paths, the SSE GET stream, DELETE, and (on a second, differently-configured front end)
# that a session-lifetime policy survives the fork into its own gem. Compiles + runs a throwaway method to exercise
# compile_method/commit, then cleans it up. Shuts the server down on exit.
#
# Configure (or export before running):
#   GEMSTONE    - GemStone product directory (required)
#   GS_STONE    - stone name        (default: gs64stone)
#   GS_USER     - GemStone user     (default: DataCurator)
#   GS_PASS     - GemStone password (default: swordfish)
#   GS_MCP_PORT - test port         (default: 8011, kept off the usual 8000)
#
# Exit status 0 = all checks passed.
set -uo pipefail
cd "$(dirname "$0")"

: "${GEMSTONE:?Set GEMSTONE to your GemStone product directory}"
export GS_STONE="${GS_STONE:-gs64stone}"
export GS_USER="${GS_USER:-DataCurator}"
export GS_PASS="${GS_PASS:-swordfish}"
PORT="${GS_MCP_PORT:-8011}"
URL="http://127.0.0.1:$PORT/mcp"
SERVER_LOG="$(mktemp -t gsmcp-server.XXXXXX)"

PASS=0; FAIL=0
WRAPPER_PID=""
LIFE_WRAPPER_PID=""
LIFE_LOG=""
SID=""

cleanup() {
  echo
  echo "Tearing down server on port $PORT ..."
  local pid
  pid="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null)"
  [ -n "$pid" ] && kill $pid 2>/dev/null
  [ -n "$WRAPPER_PID" ] && kill "$WRAPPER_PID" 2>/dev/null
  # the second, differently-configured front end the lifetime section starts (see [3/4])
  pid="$(lsof -nP -iTCP:$((PORT + 1)) -sTCP:LISTEN -t 2>/dev/null)"
  [ -n "$pid" ] && kill $pid 2>/dev/null
  [ -n "$LIFE_WRAPPER_PID" ] && kill "$LIFE_WRAPPER_PID" 2>/dev/null
  rm -f "$SERVER_LOG" "${LIFE_LOG:-}"
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

# post  -- reads a JSON-RPC body from stdin, returns the response body (carries the session id)
post() { curl -s -m 10 "$URL" -H "MCP-Session-Id: $SID" --data-binary @-; }

echo "=== GemStone MCP server integration test ==="
echo "Stone=$GS_STONE  User=$GS_USER  Port=$PORT"
echo

# ---------------------------------------------------------------------------
echo "[1/4] Starting server gem (session A) ..."
GS_MCP_PORT="$PORT" ./run-server.sh > "$SERVER_LOG" 2>&1 &
WRAPPER_PID=$!
for i in $(seq 1 60); do nc -z 127.0.0.1 "$PORT" 2>/dev/null && break; sleep 0.5; done
if ! nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
  echo "  ERROR: server did not start listening on $PORT. Server log:"
  sed 's/^/      /' "$SERVER_LOG"
  exit 1
fi
echo "  server is listening on 127.0.0.1:$PORT"
echo

# ---------------------------------------------------------------------------
echo "[2/4] Driving requests from the client (session B) ..."

# --- handshake: initialize establishes this client's session id (MCP-Session-Id) ---
r=$(curl -s -i -m 10 "$URL" --data-binary @- <<'JSON'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0"}}}
JSON
)
SID=$(printf '%s' "$r" | grep -i '^mcp-session-id:' | tr -d '\r' | awk '{print $2}')
check "initialize returns protocolVersion"    '"protocolVersion"'        "$r"
check "initialize returns serverInfo name"    '"name":"gemstone-mcp"'    "$r"
check "initialize assigns MCP-Session-Id"     'MCP-Session-Id'           "$r"
echo "  session id: $SID"

code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$URL" -H "MCP-Session-Id: $SID" --data-binary @- <<'JSON'
{"jsonrpc":"2.0","method":"notifications/initialized"}
JSON
)
check "initialized notification returns 202"  '202'                      "$code"

# ping is a MUST in the MCP spec: the receiver MUST answer with an EMPTY result.
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":2,"method":"ping"}
JSON
)
check "ping => empty result"                  '"result":{}'              "$r"
check "ping is not an error"                  '"id":2'                   "$r"

# --- tools/list ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
JSON
)
for t in execute_code status describe_class get_method_source compile_method; do
  check "tools/list includes $t"              "\"name\":\"$t\""          "$r"
done

# --- execute_code ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"execute_code","arguments":{"code":"3 + 4"}}}
JSON
)
check "execute_code 3+4 => 7"                 '"text":"7"'               "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"execute_code","arguments":{"code":"| x | x := 6. x * 7"}}}
JSON
)
check "execute_code multi-statement => 42"    '"text":"42"'              "$r"

# --- status (prints the server gem's session id) ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"status","arguments":{}}}
JSON
)
check "status reports user"                   'user='                    "$r"
echo "      server session: $(printf '%s' "$r" | grep -oE 'session=[0-9]+')"

# --- describe_class / get_method_source ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"describe_class","arguments":{"className":"McpServer"}}}
JSON
)
check "describe_class McpServer"            'superclass='              "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"get_method_source","arguments":{"className":"McpRouter","selector":"stop"}}}
JSON
)
check "get_method_source McpRouter>>stop"   'isRunning := false'       "$r"

# --- compile_method round-trip on a throwaway class, then clean up ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"execute_code","arguments":{"code":"| c | c := (System myUserProfile objectNamed: #McpSmokeClass) ifNil: [Object subclass: 'McpSmokeClass' instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #()]. c comment: 'Artifact of an aborted Mcp server test (gs-mcp/test.sh). Safe to remove.'. System commitTransaction. 'ready'"}}}
JSON
)
check "create throwaway test class"           'ready'                    "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"compile_method","arguments":{"className":"McpSmokeClass","source":"answer\n  ^42","category":"smoke"}}}
JSON
)
check "compile_method commits"                'and committed'            "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"execute_code","arguments":{"code":"McpSmokeClass new answer"}}}
JSON
)
check "compiled method runs => 42"            '"text":"42"'              "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"execute_code","arguments":{"code":"UserGlobals removeKey: #McpSmokeClass ifAbsent: [nil]. System commitTransaction. 'cleaned'"}}}
JSON
)
check "cleanup throwaway test class"          'cleaned'                  "$r"

# --- error paths ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"execute_code","arguments":{"code":"1/0"}}}
JSON
)
check "execute_code 1/0 => isError true"      '"isError":true'           "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":13,"method":"no/such/method"}
JSON
)
check "unknown method => -32601"              '-32601'                   "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":14,"method":"tools/call","params":{"name":"does_not_exist","arguments":{}}}
JSON
)
check "unknown tool => -32602"                '-32602'                   "$r"

# MCP 2025-11-25 splits the two tools/call failure envelopes: arguments that violate the
# tool's own inputSchema are TOOL EXECUTION errors (isError, so the model can self-correct),
# while a malformed request (no tool name) stays a PROTOCOL error.
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":15,"method":"tools/call","params":{"name":"describe_class","arguments":{"className":"Object","bogus":"x"}}}
JSON
)
check "unknown argument => isError true"      '"isError":true'           "$r"
check "unknown argument => kind invalidParams" '"kind":"invalidParams"'  "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":16,"method":"tools/call","params":{"arguments":{}}}
JSON
)
check "missing tool name => -32602"           '-32602'                   "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":17,"method":"tools/call","params":{"name":"status","arguments":{"bogus":1}}}
JSON
)
check "no-arg tool names no allowed list"     'takes no arguments'       "$r"

# ===========================================================================
# Expanded tool set (full Jasper parity)
# ===========================================================================

# --- tools/list reports the full set ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":20,"method":"tools/list"}
JSON
)
# count name fields that are string values (tool names), not nested 'name' properties
n=$(printf '%s' "$r" | grep -o '"name":"' | wc -l | tr -d ' ')
check "tools/list reports 31 tools (got $n)"  "31"                       "$n"

# --- session/transaction ---
for t in abort commit refresh; do
  r=$(post <<JSON
{"jsonrpc":"2.0","id":21,"method":"tools/call","params":{"name":"$t","arguments":{}}}
JSON
)
  check "$t works"                            '"isError":false'          "$r"
done

# --- listing ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":22,"method":"tools/call","params":{"name":"list_dictionaries","arguments":{}}}
JSON
)
check "list_dictionaries includes UserGlobals" 'UserGlobals'             "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":23,"method":"tools/call","params":{"name":"list_classes","arguments":{"dictionaryName":"Published"}}}
JSON
)
check "list_classes(Published) has McpServer" 'McpServer'            "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":24,"method":"tools/call","params":{"name":"list_all_classes","arguments":{}}}
JSON
)
check "list_all_classes tags dictionary"      'McpServer  (Published)' "$r"

# --- browsing ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":25,"method":"tools/call","params":{"name":"get_class_definition","arguments":{"className":"McpServer"}}}
JSON
)
check "get_class_definition is a subclass: expr" 'subclass:'             "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":26,"method":"tools/call","params":{"name":"get_class_hierarchy","arguments":{"className":"McpServer"}}}
JSON
)
check "get_class_hierarchy shows Object"       'Object'                  "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":27,"method":"tools/call","params":{"name":"list_methods","arguments":{"className":"McpRouter"}}}
JSON
)
check "list_methods shows runOnPort:"          'runOnPort:'              "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":28,"method":"tools/call","params":{"name":"export_class_source","arguments":{"className":"McpTool"}}}
JSON
)
check "export_class_source is file-in format"  'set compile_env'         "$r"

# --- search ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":29,"method":"tools/call","params":{"name":"find_implementors","arguments":{"selector":"runOnPort:"}}}
JSON
)
check "find_implementors finds runOnPort:"     'McpRouter>>runOnPort:' "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":30,"method":"tools/call","params":{"name":"find_senders","arguments":{"selector":"serveGetStream:forSession:"}}}
JSON
)
check "find_senders finds the caller"          'serveGet:on:'      "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":31,"method":"tools/call","params":{"name":"find_references_to","arguments":{"name":"McpTool"}}}
JSON
)
check "find_references_to McpTool"           'McpToolRegistry'       "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":32,"method":"tools/call","params":{"name":"search_method_source","arguments":{"pattern":"writeSseStreamHeaders","dictionaryName":"Published"}}}
JSON
)
check "search_method_source finds usage"       'serveGetStream:'         "$r"

# --- testing (SUnit, read-only against a kernel test) ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":33,"method":"tools/call","params":{"name":"list_test_classes","arguments":{}}}
JSON
)
check "list_test_classes includes SUnitTest"   'SUnitTest'               "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":34,"method":"tools/call","params":{"name":"run_test_class","arguments":{"className":"SUnitTest"}}}
JSON
)
check "run_test_class SUnitTest reports passed" 'passed'                 "$r"

# --- mutation + failing-test path on a throwaway TestCase, then clean up ---
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":35,"method":"tools/call","params":{"name":"compile_class_definition","arguments":{"source":"TestCase subclass: 'McpParityTest' instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #()"}}}
JSON
)
check "compile_class_definition creates class" 'committed class: McpParityTest' "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":36,"method":"tools/call","params":{"name":"compile_method","arguments":{"className":"McpParityTest","source":"testWillFail self assert: 1 = 2","category":"tests"}}}
JSON
)
check "compile_method onto parity class"       'and committed'           "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":37,"method":"tools/call","params":{"name":"run_test_method","arguments":{"className":"McpParityTest","selector":"testWillFail"}}}
JSON
)
check "run_test_method reports the failure"    '1 failed'                "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":38,"method":"tools/call","params":{"name":"describe_test_failure","arguments":{"className":"McpParityTest","selector":"testWillFail"}}}
JSON
)
check "describe_test_failure gives detail"     'Assertion failed'        "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":39,"method":"tools/call","params":{"name":"list_failing_tests","arguments":{"classNames":["McpParityTest"]}}}
JSON
)
check "list_failing_tests lists the failure"   'McpParityTest'          "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":40,"method":"tools/call","params":{"name":"set_class_comment","arguments":{"className":"McpParityTest","comment":"throwaway parity test"}}}
JSON
)
check "set_class_comment commits"              'and committed'           "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":41,"method":"tools/call","params":{"name":"delete_method","arguments":{"className":"McpParityTest","selector":"testWillFail"}}}
JSON
)
check "delete_method removes the method"       'Deleted method'          "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":42,"method":"tools/call","params":{"name":"delete_class","arguments":{"className":"McpParityTest"}}}
JSON
)
check "delete_class removes the class"         'Deleted class'           "$r"

# --- transport: SSE GET stream ---
# The standalone stream is the ONLY way this server can speak first, and it is session-scoped: the
# same 400/404/200 gates as POST and DELETE. It used to answer any anonymous GET with a stream that
# belonged to no session -- attachable to no outbox, and still sending keepalives long after the
# reaper had logged out the gem it was opened for.
r=$(curl -s -i -N -m 3 "$URL" 2>&1 | head -12)
check "GET /mcp without a session id => 400"  'HTTP/1.1 400'             "$r"
r=$(curl -s -i -N -m 3 "$URL" -H 'MCP-Session-Id: DEADBEEF' 2>&1 | head -12)
check "GET /mcp with a dead session id => 404" 'HTTP/1.1 404'            "$r"
r=$(curl -s -i -N -m 3 "$URL" -H "MCP-Session-Id: $SID" 2>&1 | head -12)
check "GET /mcp => text/event-stream"         'text/event-stream'        "$r"
check "GET /mcp sends 'connected' comment"    ': connected'              "$r"

# --- transport: a POSTed JSON-RPC response ---
# How a client answers a request the SERVER sent it (today a liveness ping): a body with an id and
# no method. The spec wants 202 Accepted and no body. This used to be forwarded to the worker, whose
# dispatcher saw no method and answered -32600 Invalid Request with a 200 -- so a client's reply to
# a server ping came back to it as an error.
r=$(curl -s -i -m 10 "$URL" -H "MCP-Session-Id: $SID" \
  --data-binary '{"jsonrpc":"2.0","id":"srv-999","result":{}}' 2>&1)
check "a POSTed JSON-RPC response => 202"     'HTTP/1.1 202'             "$r"
echo "$r" | grep -q -- '-32600' && verdict='answered -32600' || verdict='no error body'
check "...and not routed to the worker"       'no error body'            "$verdict"

# --- transport: logging/setLevel ---
# Declaring the logging capability promises this method. The front end snoops the level as it passes
# (it generates the notifications and owns the stream); the worker answers it.
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":43,"method":"logging/setLevel","params":{"level":"debug"}}
JSON
)
check "logging/setLevel is accepted"          '"result"'                 "$r"
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":44,"method":"logging/setLevel","params":{"level":"chatty"}}
JSON
)
check "logging/setLevel rejects a bad level"  '-32602'                   "$r"

# --- transport: a slow call must not block another client ---
# The property the whole front end rests on: one client's long tool call does not stop the server.
# Forwarding used to be a blocking GCI executeString:, which blocks in C -- while it ran the
# front-end gem executed no Smalltalk at all, so NO other GsProcess ran: no other client's request,
# no accept loop, no idle reaper, no SSE keepalive. McpSession>>runWorker: now starts the call with
# nbExecute: and waits in Smalltalk instead. Only an end-to-end check can catch a regression here,
# because the unit tests use a mock worker and cannot see the gem stall.
SLOW_OUT="$(mktemp "${TMPDIR:-/tmp}/mcp-slow.XXXXXX")"
started=$SECONDS
curl -s -m 40 "$URL" -H "MCP-Session-Id: $SID" --data-binary @- >"$SLOW_OUT" <<'JSON' &
{"jsonrpc":"2.0","id":90,"method":"tools/call","params":{"name":"execute_code","arguments":{"code":"(Delay forSeconds: 8) wait. 4321"}}}
JSON
slow_pid=$!
sleep 1                       # let the slow call reach the worker gem
r=$(curl -s -i -m 20 "$URL" --data-binary @- <<'JSON'
{"jsonrpc":"2.0","id":91,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"second-client","version":"1"}}}
JSON
)
elapsed=$((SECONDS - started))
check "second client is served during a slow call" 'MCP-Session-Id'       "$r"
# If the front end were still blocking, this could not come back before the 8-second call finished.
[ "$elapsed" -lt 6 ] && verdict="concurrent" || verdict="serialized after ${elapsed}s"
check "...concurrently, not queued behind it (${elapsed}s)" 'concurrent'   "$verdict"
wait "$slow_pid" || true
check "the slow call still returned its own result" '"text":"4321"'        "$(cat "$SLOW_OUT")"
rm -f "$SLOW_OUT"

# --- transport: ending a session closes its open stream ---
# The only end-to-end exercise of the drain loop: a stream is held open, the session is ended, and
# the loop must notice and finish. Ending a session marks its outbox CLOSING rather than closed
# precisely so the loop gets one more pass -- that is what lets the reaper deliver a session-ending
# notice instead of cutting the client off with the gem. If the loop ignored it, this curl would sit
# there until its own timeout.
STREAM_OUT="$(mktemp "${TMPDIR:-/tmp}/mcp-stream.XXXXXX")"
curl -s -N -m 30 "$URL" -H "MCP-Session-Id: $SID" >"$STREAM_OUT" 2>&1 &
stream_pid=$!
sleep 1                       # let the stream attach to the session's outbox
started=$SECONDS
curl -s -m 10 -X DELETE "$URL" -H "MCP-Session-Id: $SID" >/dev/null 2>&1
wait "$stream_pid" || true
elapsed=$((SECONDS - started))
[ "$elapsed" -lt 5 ] && verdict="closed" || verdict="hung for ${elapsed}s"
check "ending a session closes its stream (${elapsed}s)" 'closed'        "$verdict"
check "...having delivered what was queued"   ': connected'              "$(cat "$STREAM_OUT")"
rm -f "$STREAM_OUT"

# --- transport: DELETE (session termination) ---
# Same status codes as the POST path: no header => 400, unknown id => 404, live id => 200.
# The live-id case ran just above (it is what closed the stream), so this id is now gone: what is
# left to check here is the two error gates and the 404 a client meets afterwards.
r=$(curl -s -i -m 10 -X DELETE "$URL" 2>&1 | head -1)
check "DELETE without session => 400"          '400'                     "$r"

r=$(curl -s -i -m 10 -X DELETE "$URL" -H 'MCP-Session-Id: DEADBEEF' 2>&1 | head -1)
check "DELETE unknown session => 404"          '404'                     "$r"

r=$(curl -s -i -m 10 -X DELETE "$URL" -H "MCP-Session-Id: $SID" 2>&1 | head -1)
check "DELETE an already-ended session => 404" '404'                     "$r"

# After termination the spec requires 404 for any request still carrying that id, which is
# the client's cue to re-initialize.
r=$(curl -s -i -m 10 "$URL" -H "MCP-Session-Id: $SID" \
  --data-binary '{"jsonrpc":"2.0","id":18,"method":"tools/list"}' 2>&1 | head -1)
check "POST after DELETE => 404"               '404'                     "$r"

# ---------------------------------------------------------------------------
# --- session lifetime: the intervals are deployment config ---
# The idle policy is no longer literals in a method, so the thing worth checking on real wires is
# that a configured lifetime SURVIVES THE FORK: config reaches a detached front end only by being
# serialized into its fork string, and a router that quietly reverted to the defaults would look
# perfectly healthy while ignoring everything the operator asked for.
# The no-deadline case is the one to check, because it is the only setting whose instruction is a
# JSON null -- absence and "none" mean different things, and only one of them is what was asked for.
echo
echo "[3/4] Session lifetime configuration ..."
LIFE_PORT=$((PORT + 1))
LIFE_URL="http://127.0.0.1:$LIFE_PORT/mcp"
LIFE_LOG="$(mktemp -t gsmcp-life.XXXXXX)"
GS_MCP_PORT="$LIFE_PORT" GS_MCP_IDLE_TIMEOUT=none GS_MCP_PROBE_INTERVAL=30s \
  GS_MCP_STREAMLESS_TIMEOUT=20m GS_MCP_MAX_LIFETIME=8h ./run-server.sh > "$LIFE_LOG" 2>&1 &
LIFE_WRAPPER_PID=$!
for i in $(seq 1 60); do nc -z 127.0.0.1 "$LIFE_PORT" 2>/dev/null && break; sleep 0.5; done
if nc -z 127.0.0.1 "$LIFE_PORT" 2>/dev/null; then
  check "a router with no idle deadline starts"  'listening'   "$(cat "$LIFE_LOG")"
  r=$(curl -s -i -m 10 "$LIFE_URL" --data-binary @- <<'"'"'JSON'"'"'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}
JSON
)
  check "...and serves a session on it"          'MCP-Session-Id'  "$r"
  LIFE_SID=$(printf '%s' "$r" | grep -i '^mcp-session-id:' | tr -d '\r' | awk '{print $2}')
  curl -s -m 10 -X DELETE "$LIFE_URL" -H "MCP-Session-Id: $LIFE_SID" >/dev/null 2>&1
else
  check "a router with no idle deadline starts"  'listening'   "did not start. log: $(cat "$LIFE_LOG")"
fi
# A deliberately incoherent combination must be refused, and refused IN THE LAUNCHING SESSION: a
# detached child gem that raises on startup leaves the operator looking at a cheerful "forked into
# gem session N" and a port that never opens. So forkOnPort: validates before it forks, and the
# message lands where whoever typed it will see it.
BAD_PORT=$((PORT + 2))
BAD_LOG="$(mktemp -t gsmcp-bad.XXXXXX)"
GS_MCP_PORT="$BAD_PORT" GS_MCP_IDLE_TIMEOUT=90s GS_MCP_WARNING_LEAD=80s \
  ./run-server.sh > "$BAD_LOG" 2>&1 || true
check "an unworkable warning lead is refused"  'too short'   "$(cat "$BAD_LOG")"
if nc -z 127.0.0.1 "$BAD_PORT" 2>/dev/null; then
  check "...and no front end is left running"  'nothing listening'  "something is listening on $BAD_PORT"
else
  check "...and no front end is left running"  'nothing listening'  "nothing listening"
fi
rm -f "$BAD_LOG"

# ---------------------------------------------------------------------------
echo
echo "[4/4] Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
