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

export GS_STONE="${GS_STONE:-gs64stone}"
export GS_USER="${GS_USER:-DataCurator}"
export GS_PASS="${GS_PASS:-swordfish}"

# Resolve the environment up front so a misconfiguration is one line here, rather than a server
# that never comes up and a run that fails every check for the same hidden reason. run-server.sh
# checks again in its own process; this is cheap and the export makes the resolved value inherited.
. ./gs-env.sh
GS_NEEDS_NETLDI=1
gs_env_resolve
gs_env_require_stone
gs_env_require_netldi
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
  # Delegate to stop-server.sh rather than open-coding a kill: it locates lsof properly (see
  # gs_env_require_lsof -- lsof is /usr/sbin/lsof on macOS and absent from a minimal PATH, and this
  # teardown used to infer "nothing is listening" from its silence and leave the server running),
  # only kills a process that looks like a gem, and escalates SIGTERM -> SIGKILL with a wait rather
  # than firing and letting the shell exit.
  # Leaking here is worse than it sounds: the survivor keeps the port, so the NEXT run finds
  # something already listening and tests against it -- and because a router gem does not pick up
  # recompiled code the way worker gems do, that stale front end serves the previous tree's
  # transport code and the run reports failures belonging to a version nobody is testing.
  GS_MCP_PORT="$PORT" ./stop-server.sh >/dev/null 2>&1
  [ -n "$WRAPPER_PID" ] && kill "$WRAPPER_PID" 2>/dev/null
  # the second, differently-configured front end the lifetime section starts (see [3/4])
  GS_MCP_PORT="$((PORT + 1))" ./stop-server.sh >/dev/null 2>&1
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
check "execute_code 3+4 => 7"                 '"text":"7'                "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"execute_code","arguments":{"code":"| x | x := 6. x * 7"}}}
JSON
)
check "execute_code multi-statement => 42"    '"text":"42'               "$r"

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
check "compile_method compiles"               'Compiled McpSmokeClass'   "$r"
# No tool commits any more except `commit` -- see docs/server-to-client-messaging.md 14.4 -- so the
# result says the work is PENDING rather than saved, and the method is visible in this session only.
check "...and says the work is pending"        'uncommitted changes'      "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"execute_code","arguments":{"code":"McpSmokeClass new answer"}}}
JSON
)
# The value is matched WITHOUT its closing quote here and in the two execute_code checks above,
# because a tool result may carry a trailing [session] note (McpDispatcher>>annotateContent:) and it
# appears only when that session happens to have uncommitted work -- so an assertion that closed the
# quote passed or failed by run order rather than by behaviour.
check "compiled method runs => 42"            '"text":"42'               "$r"

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
# Compare against what the SERVER's toolsets declare, not a number written here. A literal has to be
# edited every time a tool is added or a group is loaded -- it already read 31 while a --grail image
# served 33 -- and editing it says nothing about whether the surface is right. Asking the server how
# many tools its toolsets declare, and checking tools/list agrees, is a real assertion (everything
# declared is registered, and nothing else is) and it cannot go stale.
declared=$(post <<'JSON' | sed -n 's/.*"text":"\([0-9][0-9]*\)".*/\1/p'
{"jsonrpc":"2.0","id":19,"method":"tools/call","params":{"name":"execute_code","arguments":{"code":"(McpServer newWithToolsetNames: McpServer installedDefaultToolsetNames) allToolNames size"}}}
JSON
)
check "tools/list matches the toolsets' declared count (got $n, declared $declared)" \
                                              "$declared"                "$n"

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
{"jsonrpc":"2.0","id":35,"method":"tools/call","params":{"name":"compile_class_definition","arguments":{"className":"McpParityTest","superclassName":"TestCase","dictionary":"UserGlobals"}}}
JSON
)
check "compile_class_definition creates class" 'Compiled class: McpParityTest' "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":36,"method":"tools/call","params":{"name":"compile_method","arguments":{"className":"McpParityTest","source":"testWillFail self assert: 1 = 2","category":"tests"}}}
JSON
)
check "compile_method onto parity class"       'Compiled McpParityTest'  "$r"

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

# The blind-write guardrail requires the CURRENT comment to have been read in this session before
# one can be written over it, so the describe_class is part of the call sequence a real client must
# make and not a redundant check -- delete it and set_class_comment goes back to being refused with
# kind 'blindWrite'. See docs/blind-write-guardrail.md.
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":39,"method":"tools/call","params":{"name":"describe_class","arguments":{"className":"McpParityTest"}}}
JSON
)
check "describe_class reads the comment first" 'McpParityTest'          "$r"

r=$(post <<'JSON'
{"jsonrpc":"2.0","id":40,"method":"tools/call","params":{"name":"set_class_comment","arguments":{"className":"McpParityTest","comment":"throwaway parity test"}}}
JSON
)
check "set_class_comment sets the comment"     'Comment set on McpParityTest' "$r"

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

# --- transport: a tools/call answered as a request-scoped SSE stream ---
# A client that puts a progressToken in params._meta has asked to be kept informed while the call
# runs, so its answer comes back on a stream instead of as one JSON object: frames first, then the
# response as the last frame. Claude Code sends such a token on EVERY tools/call, measured, and this
# server discarded all of them until now. The regression that matters is the second check: every
# other request in this file must still get plain JSON, because none of them asks for a stream.
r=$(curl -s -i -N -m 10 "$URL" -H "MCP-Session-Id: $SID" \
  -H 'Accept: application/json, text/event-stream' \
  --data-binary '{"jsonrpc":"2.0","id":77,"method":"tools/call","params":{"name":"status","arguments":{},"_meta":{"progressToken":77}}}' 2>&1)
check "progressToken => text/event-stream"    'text/event-stream'        "$r"
check "...with proxy buffering turned off"    'X-Accel-Buffering: no'    "$r"
check "...the answer arrives as an SSE frame" 'event: message'           "$r"
check "...carrying this request's own id"     '"id":77'                  "$r"
echo "$r" | grep -qi 'content-length' && verdict='has Content-Length' || verdict='no Content-Length'
check "...and no Content-Length"              'no Content-Length'        "$verdict"
# The same call without the token: the shape every other check here relies on.
r=$(curl -s -i -m 10 "$URL" -H "MCP-Session-Id: $SID" \
  -H 'Accept: application/json, text/event-stream' \
  --data-binary '{"jsonrpc":"2.0","id":78,"method":"tools/call","params":{"name":"status","arguments":{}}}' 2>&1)
check "no progressToken => application/json"  'Content-Type: application/json' "$r"

# --- progress: a real tick from a real worker gem, over the wire ---
# The whole cross-gem pathway in one check. A tool in the WORKER gem calls #progress:of:message:,
# which rings a doorbell the front end is polling (System sendSignal:to:withMessage: ->
# InterSessionSignal poll), and the front end turns it into a notifications/progress addressed by the
# CLIENT's token and writes it onto the response stream of the very call producing the ticks.
# list_failing_tests is the emitter, reporting per test class -- the slowest thing this server can be
# asked to do, and the reason progress exists. McpToolTest is deliberately NOT in the list: it calls
# toolset methods DIRECTLY rather than sending requests, so its own progress ticks land on this
# call's stream (see McpServer>>handleJsonString:lifetimeBounds:). Only the count of frames varies
# run to run -- ticks are rate-limited at 250ms, so a fast suite contributes none.
r=$(curl -s -N -m 120 "$URL" -H "MCP-Session-Id: $SID" \
  -H 'Accept: application/json, text/event-stream' \
  --data-binary '{"jsonrpc":"2.0","id":80,"method":"tools/call","params":{"name":"list_failing_tests","arguments":{"classNames":["McpOutboxTest","McpProgressTest","McpStreamTest","McpLifetimeTest","McpContractTest","McpTransportTest"]},"_meta":{"progressToken":80}}}' 2>&1)
n=$(printf '%s' "$r" | grep -c 'notifications/progress')
[ "$n" -ge 1 ] && verdict="got $n" || verdict="got none"
check "a worker's progress reaches the client"  "got $n"                  "$verdict"
check "...as notifications/progress"            'notifications/progress'  "$r"
check "...addressed by the client's token"      '"progressToken":80'      "$r"
check "...with a real denominator"              '"total":6'               "$r"
check "...and the callId never leaves the server" 'no callId'             "$(printf '%s' "$r" | grep -q '"call-' && echo 'leaked a callId' || echo 'no callId')"
# progress MUST increase strictly, and MUST stop at completion: the response is the last frame.
first=$(printf '%s' "$r" | grep -o '"progress":[0-9]*' | head -1 | cut -d: -f2)
last=$(printf '%s' "$r" | grep -o '"progress":[0-9]*' | tail -1 | cut -d: -f2)
[ "${last:-0}" -ge "${first:-0}" ] && verdict="increases ($first..$last)" || verdict="went backwards ($first..$last)"
check "...increasing"                           'increases'               "$verdict"
printf '%s' "$r" | tail -3 | grep -q '"id":80' && verdict='response is last' || verdict='response is not last'
check "...and the answer comes after them"      'response is last'        "$verdict"

# --- transport: cancelling a call in flight ---
# Measured 2026-08-31: Claude Code sends notifications/cancelled within seconds of the user pressing
# Esc, and does NOT close the response stream -- so this notification is how a cancellation actually
# arrives. Before it was intercepted in the front end it was ROUTED, which queued it on the session's
# worker mutex behind the very call it asked to stop: measured at 17s on a 20-second call, i.e. it
# did nothing at all. Both halves are checked: the cancel is answered promptly, and the call ends
# early rather than running to completion.
CANCEL_OUT=$(mktemp)
( curl -s -o "$CANCEL_OUT" -m 60 "$URL" -H "MCP-Session-Id: $SID" \
    --data-binary '{"jsonrpc":"2.0","id":95,"method":"tools/call","params":{"name":"execute_code","arguments":{"code":"(Delay forSeconds: 30) wait. 555"}}}' ) &
SLOW_CANCEL_PID=$!
sleep 3
t0=$(date +%s)
code=$(curl -s -m 20 -o /dev/null -w '%{http_code}' "$URL" -H "MCP-Session-Id: $SID" \
  --data-binary '{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":95,"reason":"test"}}')
t1=$(date +%s)
check "notifications/cancelled => 202"        '202'                      "$code"
[ $((t1-t0)) -le 3 ] && verdict="prompt ($((t1-t0))s)" || verdict="queued behind the call ($((t1-t0))s)"
check "...answered promptly, not behind the call" "prompt"               "$verdict"
wait $SLOW_CANCEL_PID
t2=$(date +%s)
[ $((t2-t0)) -le 15 ] && verdict="ended early ($((t2-t0))s)" || verdict="ran to completion ($((t2-t0))s)"
check "...and the 30s call was ended early"   'ended early'              "$verdict"
# The spec asks a receiver not to send a response for a cancelled request.
grep -q 'jsonrpc' "$CANCEL_OUT" && verdict='sent a JSON-RPC response' || verdict='no response body'
check "...with no JSON-RPC response for it"   'no response body'         "$verdict"
rm -f "$CANCEL_OUT"
# The session survives: the client cancelled a request, not its work.
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":96,"method":"ping"}
JSON
)
check "...and the session is still usable"    '"id":96'                  "$r"

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

# --- transport: logging/setLevel is NOT served ---
# The logging capability was retired on 2026-08-27 (see McpDispatcher>>capabilities): both idle
# warnings are gone, and the draft revision prohibits an unsolicited notifications/message anyway.
# A server must not answer a method it does not declare, so the undeclared method is the assertion.
r=$(post <<'JSON'
{"jsonrpc":"2.0","id":43,"method":"logging/setLevel","params":{"level":"debug"}}
JSON
)
check "logging/setLevel is not a method"      '-32601'                   "$r"

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
check "the slow call still returned its own result" '"text":"4321'         "$(cat "$SLOW_OUT")"
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
GS_MCP_PORT="$LIFE_PORT" GS_MCP_IDLE_TIMEOUT=none GS_MCP_PROBE_INTERVAL=30s GS_MCP_REAPER_INTERVAL=15s \
  GS_MCP_STREAMLESS_TIMEOUT=20m GS_MCP_MAX_LIFETIME=8h ./run-server.sh > "$LIFE_LOG" 2>&1 &
LIFE_WRAPPER_PID=$!
for i in $(seq 1 60); do nc -z 127.0.0.1 "$LIFE_PORT" 2>/dev/null && break; sleep 0.5; done
if nc -z 127.0.0.1 "$LIFE_PORT" 2>/dev/null; then
  check "a router with no idle deadline starts"  'listening'   "$(cat "$LIFE_LOG")"
  r=$(curl -s -i -m 10 "$LIFE_URL" --data-binary @- <<'JSON'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}
JSON
)
  check "...and serves a session on it"          'MCP-Session-Id'  "$r"
  LIFE_SID=$(printf '%s' "$r" | grep -i '^mcp-session-id:' | tr -d '\r' | awk '{print $2}')
  curl -s -m 10 -X DELETE "$LIFE_URL" -H "MCP-Session-Id: $LIFE_SID" >/dev/null 2>&1
else
  check "a router with no idle deadline starts"  'listening'   "did not start. log: $(cat "$LIFE_LOG")"
fi
# A deliberately incoherent combination must be refused -- here an idle timeout shorter than the
# interval idleness is measured in, which would release a session before its client could be asked
# anything at all -- and refused IN THE LAUNCHING SESSION: a
# detached child gem that raises on startup leaves the operator looking at a cheerful "forked into
# gem session N" and a port that never opens. So forkOnPort: validates before it forks, and the
# message lands where whoever typed it will see it.
BAD_PORT=$((PORT + 2))
BAD_LOG="$(mktemp -t gsmcp-bad.XXXXXX)"
GS_MCP_PORT="$BAD_PORT" GS_MCP_IDLE_TIMEOUT=90s GS_MCP_PROBE_INTERVAL=300s \
  ./run-server.sh > "$BAD_LOG" 2>&1 || true
check "an unmeasurable idle timeout is refused"  'shorter than'   "$(cat "$BAD_LOG")"
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
