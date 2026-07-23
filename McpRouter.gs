set compile_env: 0
! ------------------- Class definition for McpRouter
expectvalue /Class
doit
McpBase subclass: 'McpRouter'
  instVarNames: #( isRunning mutex routesTable serverSocket sessions sessionCounter )
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpRouter comment:
'Native GemStone MCP front end. Runs a blocking HTTP/1.1 accept loop on localhost that speaks the
MCP Streamable HTTP transport (single /mcp endpoint), and gives EACH client its own worker gem
(an isolated GemStone session) so clients never share uncommitted changes. It routes by the
Mcp-Session-Id header: `initialize` opens a worker (a McpSession) and returns its id; every
other request is forwarded to that client''s worker. The worker runs the actual tools
(McpServer, per gem). This class owns only the socket, the id -> McpSession map (mutex-guarded)
and the idle-session reaper -- it never parses a tool call itself.

IMPORTANT: runOnPort: is BLOCKING and is meant to be the main activity of a dedicated gem. Forked
GsProcesses only run while the gem is actively executing Smalltalk, so a background fork in an idle
GCI session would never serve requests.

Start (from a dedicated gem / topaz session):
    McpRouter runOnPort: 8000
or, in a separate detached gem that survives logout:
    McpRouter forkOnPort: 8000

Test it:
    curl -s localhost:8000/mcp -d ''{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}''
'
%
expectvalue /Class
doit
McpRouter category: 'MCPServer'
%
! ------------------- Remove existing behavior from McpRouter
removeallmethods McpRouter
removeallclassmethods McpRouter
! ------------------- Class methods for McpRouter
category: 'forking'
classmethod: McpRouter
forkOnPort: aPort
  "Start the front end in a SEPARATE, INDEPENDENT gem instead of blocking this session. A plain
   GsProcess fork would freeze whenever this session goes idle (a forked GsProcess only runs
   while its gem is executing Smalltalk), so spawn a real gem via GsTsExternalSession and run the
   blocking accept loop there. The child logs in as the current user via a one-time password (no
   embedded credential). Grail-ness is NOT a property of this boot: the front end is always
   McpRouter, and each per-client worker gem independently loads the most capable installed
   worker class (the Grail subclass if present).
   Uses forkAndDetachString:, which runs the loop DETACHED -- the child keeps serving after this
   session logs out, so it is an independent server, NOT tied to the launcher (hence we log our
   own handle out immediately). Stop it with `McpRouter stopForked` (this session), or from
   anywhere via `System stopSession: <id>` or `kill <pid>` (both printed below); logout will NOT
   stop it. Answers a status string. Requires GsTsExternalSession (standard in GS 3.x)."
  | extClass es sid pid s |
  extClass := System myUserProfile objectNamed: #GsTsExternalSession.
  extClass isNil ifTrue: [^'GsTsExternalSession is not available in this image; use runOnPort: or run-server.sh.'].
  es := extClass newDefaultForGemHost: 'localhost'.
  es useOnetimePassword.
  es login.
  "Capture the child's id/pid BEFORE launching the loop -- once the non-blocking call is running
   the external session rejects further queries (GciError 'operation in progress')."
  sid := es stoneSessionId.
  pid := [(System descriptionOfSession: sid) at: 2] on: Error do: [:e | nil].
  es forkAndDetachString: 'McpRouter runOnPort: ' , aPort printString.
  [es logout] on: Error do: [:e | nil].  "release our handle; the detached front end keeps running on its own"
  SessionTemps current at: #McpForkedServerSession put: sid.  "child session id, for stopForked"
  s := WriteStream on: String new.
  s nextPutAll: 'MCP front end forked into gem session '; nextPutAll: sid printString.
  pid ifNotNil: [:p | s nextPutAll: ' (host pid '; nextPutAll: p printString; nextPutAll: ')'].
  s nextPutAll: ', listening on port '; nextPutAll: aPort printString; nextPutAll: ' (independent; survives logout).'.
  s nextPut: Character lf; nextPutAll: 'To stop:  McpRouter stopForked   (from this session)'.
  s nextPut: Character lf; nextPutAll: '     or:  System stopSession: '; nextPutAll: sid printString; nextPutAll: '   (from any session)'.
  pid ifNotNil: [:p | s nextPut: Character lf; nextPutAll: '     or:  kill '; nextPutAll: p printString; nextPutAll: '   (shell)'].
  ^s contents
%
category: 'instance creation'
classmethod: McpRouter
new
  ^super new initialize
%
category: 'instance creation'
classmethod: McpRouter
runOnPort: aPort
  "Convenience: create a front end and run its (blocking) accept loop. Intended as
   the main activity of a dedicated gem."
  ^self new runOnPort: aPort
%
category: 'forking'
classmethod: McpRouter
stopForked
  "Stop the front end this session started with forkOnPort:. It is detached/independent, so a
   logout would NOT stop it -- we terminate its session directly with System stopSession:. For a
   server forked by another session, use `System stopSession: <id>` with the id printed at fork."
  | sid |
  sid := SessionTemps current at: #McpForkedServerSession otherwise: nil.
  sid isNil ifTrue: [^'No forked server recorded in this session; use System stopSession: <id>.'].
  [System stopSession: sid] on: Error do: [:e |
    ^'System stopSession: ' , sid printString , ' failed: ' , ([e description] on: Error do: [:x | e class name asString])].
  SessionTemps current removeKey: #McpForkedServerSession otherwise: nil.
  ^'Stopped the forked MCP front end (System stopSession: ' , sid printString , ').'
%
! ------------------- Instance methods for McpRouter
category: 'initialization'
method: McpRouter
initialize
  mutex := Semaphore forMutualExclusion.
  routesTable := self buildRoutes.
  isRunning := false.
  sessions := Dictionary new.
  sessionCounter := 0.
  ^self
%
category: 'running'
method: McpRouter
buildRoutes
  "HTTP method -> [:req :conn | ...] handler table for the Streamable HTTP transport.
   Built once in initialize and cached in `routesTable`. Unknown methods get a 405 in
   handleConnection: (the at:ifAbsent: branch)."
  | d |
  d := Dictionary new.
  d at: 'POST'   put: [:req :conn | self servePost: req on: conn].
  d at: 'GET'    put: [:req :conn | self serveGetStream: conn].
  d at: 'DELETE' put: [:req :conn | self serveDelete: req on: conn].
  ^d
%
category: 'running'
method: McpRouter
handleConnection: aConnection
  "Streamable HTTP routing for one connection: POST = JSON-RPC, GET = standalone SSE
   stream, DELETE = session end. The verb is looked up in the cached `routesTable` dictionary;
   unknown verbs fall through to 405. Runs in its own GsProcess; errors are contained."
  [ | req httpMethod handler |
    req := aConnection readRequest.
    req isNil ifFalse: [
      httpMethod := (req at: 'method' ifAbsent: ['']) asUppercase.
      handler := routesTable
        at: httpMethod
        ifAbsent: [[:rq :conn | conn writeStatus: 405 reason: 'Method Not Allowed' body: '']].
      handler value: req value: aConnection]
  ] on: Error do: [:ex |
    self log: 'McpRouter handleConnection: error: ' , (ex messageText ifNil: [ex description]).
    [aConnection writeStatus: 500 reason: 'Internal Server Error'
       body: '{"jsonrpc":"2.0","id":null,"error":{"code":-32603,"message":"Internal error"}}']
      on: Error do: [:e | nil]].
  aConnection close
%
category: 'running'
method: McpRouter
runOnPort: aPort
  "Bind a localhost-only listener and run the accept loop until #stop.
   BLOCKING: this is meant to be the gem's main activity (forked GsProcesses
   only run while the gem is actively executing Smalltalk)."
  serverSocket := GsSocket new.
  (serverSocket makeServer: 16 atPort: aPort atAddress: '127.0.0.1')
    ifNil: [^self error: 'makeServer failed on port ' , aPort printString , ': ' , serverSocket lastErrorString].
  isRunning := true.
  self forkReaper.
  self log: 'McpRouter listening on 127.0.0.1:' , aPort printString.
  [isRunning] whileTrue: [
    | client |
    client := serverSocket acceptTimeoutMs: 500.
    client ifNotNil: [self serve: client]].
  serverSocket close.
  self log: 'McpRouter stopped.'.
  ^self
%
category: 'running'
method: McpRouter
serve: aClientSocket
  "Handle each connection in its own GsProcess so a slow or stalled client cannot
   block the accept loop. The forked process runs during the loop's accept waits."
  [self handleConnection: (McpHttpConnection on: aClientSocket)] fork
%
category: 'running'
method: McpRouter
serveGetStream: conn
  "Open the standalone MCP SSE stream (server -> client). This server currently emits no
   server-initiated messages, so the stream stays open with periodic keepalive comments
   until the client disconnects (write fails) or the server stops."
  (conn writeSseStreamHeaders) ifNil: [^self].
  (conn writeSseComment: 'connected') ifNil: [^self].
  [isRunning] whileTrue: [
    (Delay forSeconds: 15) wait.
    (conn writeSseComment: 'keepalive') ifNil: [^self]]
%
category: 'running'
method: McpRouter
servePost: req on: conn
  "Front-end router (per-client sessions). `initialize` opens a per-client worker gem and returns
   its id in the Mcp-Session-Id header; every other request is routed by that id to the client's
   worker (an isolated session). A valid id is required for non-initialize requests. Forwarding is
   a blocking executeString: to the worker -- reliable and serialized (concurrency is a deferred
   follow-up); the id -> session map is guarded by the mutex. Only enough of the body is parsed
   here to route it (is it initialize? is it well-formed?); full request handling is the worker's."
  | body parsed method |
  body := req at: 'body' ifAbsent: [''].
  parsed := self parseBody: body.
  parsed isNil ifTrue: [^self writeParseError: conn].
  method := parsed at: 'method' ifAbsent: [nil].
  method = 'initialize' ifTrue: [^self serveInitialize: body on: conn].
  ^self serveRouted: body sessionId: (self sessionIdOf: req) on: conn
%
category: 'routing'
method: McpRouter
writeParseError: conn
  "Malformed or empty JSON body: answer a JSON-RPC -32700 Parse error (HTTP 200), matching the
   reply a worker's dispatcher would give. The front end validates only enough to route."
  | err |
  err := Dictionary new.
  err at: 'jsonrpc' put: '2.0'; at: 'id' put: nil.
  err at: 'error' put: (Dictionary new at: 'code' put: -32700; at: 'message' put: 'Parse error'; yourself).
  conn writeJson: err asJson
%
category: 'routing'
method: McpRouter
sessionIdOf: req
  "The Mcp-Session-Id request header (header keys are lower-cased by parseHead:), or nil."
  ^(req at: 'headers' ifAbsent: [Dictionary new]) at: 'mcp-session-id' ifAbsent: [nil]
%
category: 'routing'
method: McpRouter
serveInitialize: body on: conn
  "Open a new client session (worker gem), forward the initialize request to it, and answer with
   the worker's response plus the Mcp-Session-Id header the client echoes on later requests."
  | sess |
  sess := self openSession.
  conn writeJson: (sess forward: body) sessionId: sess id
%
category: 'routing'
method: McpRouter
serveRouted: body sessionId: sid on: conn
  "Route a non-initialize request to the client's worker by session id (required). Relay the
   worker's JSON response, or 202 for a notification (empty response)."
  | sess resp |
  sid isNil ifTrue: [^self writeSessionError: 'Missing Mcp-Session-Id header (call initialize first)' code: 400 reason: 'Bad Request' on: conn].
  sess := mutex critical: [sessions at: sid ifAbsent: [nil]].
  sess isNil ifTrue: [^self writeSessionError: 'Unknown or expired session: ' , sid code: 404 reason: 'Not Found' on: conn].
  resp := sess forward: body.
  resp isEmpty
    ifTrue: [conn writeStatus: 202 reason: 'Accepted' body: '']
    ifFalse: [conn writeJson: resp]
%
category: 'routing'
method: McpRouter
serveDelete: req on: conn
  "MCP session end: close and unmap the worker for the Mcp-Session-Id header, if present."
  | sid sess |
  sid := self sessionIdOf: req.
  sess := sid isNil ifTrue: [nil] ifFalse: [mutex critical: [sessions removeKey: sid ifAbsent: [nil]]].
  sess ifNotNil: [:s | s close].
  conn writeStatus: 200 reason: 'OK' body: ''
%
category: 'routing'
method: McpRouter
writeSessionError: aMessage code: httpCode reason: reasonString on: conn
  "A routing error the MCP client can act on: 400 when the Mcp-Session-Id header is missing, 404
   when the session is unknown/expired (per the Streamable HTTP spec, a 404 tells the client to
   re-initialize). The body carries a JSON-RPC -32600 error for humans."
  | err |
  err := Dictionary new.
  err at: 'jsonrpc' put: '2.0'; at: 'id' put: nil.
  err at: 'error' put: (Dictionary new at: 'code' put: -32600; at: 'message' put: aMessage; yourself).
  conn writeStatus: httpCode reason: reasonString body: err asJson
%
category: 'sessions'
method: McpRouter
openSession
  "Create + register a new client session (a worker gem) with a fresh id."
  | newId sess |
  newId := mutex critical: [self nextSessionId].
  sess := McpSession startWithId: newId.
  mutex critical: [sessions at: newId put: sess].
  ^sess
%
category: 'sessions'
method: McpRouter
nextSessionId
  "A unique-per-server session id (caller holds the mutex)."
  sessionCounter := sessionCounter + 1.
  ^'s' , sessionCounter printString
%
category: 'sessions'
method: McpRouter
sessionIdleTimeoutSeconds
  "Idle time (seconds) before a client session's worker gem is reaped. 5 minutes."
  ^300
%
category: 'sessions'
method: McpRouter
reaperIntervalSeconds
  "How often (seconds) the reaper checks for idle sessions."
  ^60
%
category: 'sessions'
method: McpRouter
reapIdleSessions
  "Close and unmap client sessions idle longer than sessionIdleTimeoutSeconds. Collect + unmap
   under the mutex; close (a blocking logout) outside it. Answers the number reaped."
  | expired timeout |
  timeout := self sessionIdleTimeoutSeconds.
  expired := mutex critical: [
    | old |
    old := sessions values select: [:s | s idleSeconds > timeout].
    old do: [:s | sessions removeKey: s id ifAbsent: [nil]].
    old].
  expired do: [:s | [s close] on: Error do: [:e | nil]].
  expired isEmpty ifFalse: [self log: 'Reaped ' , expired size printString , ' idle MCP session(s).'].
  ^expired size
%
category: 'sessions'
method: McpRouter
forkReaper
  "Fork the background reaper GsProcess: every reaperIntervalSeconds, reap idle sessions. Runs
   during the accept loop's waits (like the per-connection handlers) and exits when the server
   stops."
  [[isRunning] whileTrue: [
     (Delay forSeconds: self reaperIntervalSeconds) wait.
     [self reapIdleSessions] on: Error do: [:e |
       self log: 'reapIdleSessions error: ' , ([e description] on: Error do: [:x | e class name asString])]]] fork
%
category: 'controlling'
method: McpRouter
stop
  "Request a graceful shutdown; the accept loop exits within one accept timeout."
  isRunning := false
%
