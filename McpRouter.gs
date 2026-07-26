set compile_env: 0
! ------------------- Class definition for McpRouter
expectvalue /Class
doit
McpBase subclass: 'McpRouter'
  instVarNames: #( isRunning mutex routesTable
                    serverSocket sessions)
  classVars: #()
  classInstVars: #( allowedOriginHosts)
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
MCP-Session-Id header: `initialize` opens a worker (a McpSession) and returns its id; every
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
category: 'origin allowlist'
classmethod: McpRouter
allowedOriginHosts
  "Origin-host allowlist for DNS-rebinding protection (MCP Streamable HTTP security). Defaults to
   loopback hosts; set via allowedOriginHosts: (commit to persist) to permit a browser app's
   origin host."
  ^allowedOriginHosts ifNil: [allowedOriginHosts := self defaultAllowedOriginHosts]
%
category: 'origin allowlist'
classmethod: McpRouter
allowedOriginHosts: aCollectionOfHostStrings
  "Replace the Origin-host allowlist. Hosts are compared lower-cased; include loopback if you
   still want local browsers to connect. Commit to persist across sessions."
  allowedOriginHosts := aCollectionOfHostStrings
%
category: 'origin allowlist'
classmethod: McpRouter
defaultAllowedOriginHosts
  "Loopback hosts only -- a page served from any other origin is a DNS-rebinding attempt."
  ^#('localhost' '127.0.0.1' '[::1]')
%
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
category: 'running'
method: McpRouter
handleConnection: aConnection
  "Read one HTTP/1.1 request and dispatch it (see route:on:). Runs in its own GsProcess; any error
   is contained and answered with 500, and the connection is always closed."
  [ | req |
    req := aConnection readRequest.
    req isNil ifFalse: [self route: req on: aConnection]
  ] on: Error do: [:ex |
    self log: 'McpRouter handleConnection: error: ' , (ex messageText ifNil: [ex description]).
    [aConnection writeStatus: 500 reason: 'Internal Server Error'
       body: '{"jsonrpc":"2.0","id":null,"error":{"code":-32603,"message":"Internal error"}}']
      on: Error do: [:e | nil]].
  aConnection close
%
category: 'routing'
method: McpRouter
hostOfOrigin: aString
  "The host component of an Origin value (scheme://host[:port]); handles bracketed IPv6. Answers
   '' for the opaque 'null' origin (or a value with no host) so it fails the allowlist check."
  | idx rest close cut |
  aString = 'null' ifTrue: [^''].
  idx := aString indexOfSubCollection: '://'.
  rest := idx > 0 ifTrue: [aString copyFrom: idx + 3 to: aString size] ifFalse: [aString].
  (rest notEmpty and: [(rest at: 1) = $[]) ifTrue: [
    close := rest indexOf: $].
    ^close = 0 ifTrue: [rest] ifFalse: [rest copyFrom: 1 to: close]].
  cut := rest size + 1.
  (rest indexOf: $:) > 0 ifTrue: [cut := cut min: (rest indexOf: $:)].
  (rest indexOf: $/) > 0 ifTrue: [cut := cut min: (rest indexOf: $/)].
  ^rest copyFrom: 1 to: cut - 1
%
category: 'initialization'
method: McpRouter
initialize
  mutex := Semaphore forMutualExclusion.
  routesTable := self buildRoutes.
  isRunning := false.
  sessions := Dictionary new.
  ^self
%
category: 'sessions'
method: McpRouter
nextSessionId
  "A unique, cryptographically-secure session id: a 128-bit random token (32 hex chars).
   Regenerates on the astronomically-unlikely chance of colliding with a live session. Caller
   holds the mutex (this reads `sessions`)."
  | id |
  [id := self randomSessionToken. sessions includesKey: id] whileTrue: [].
  ^id
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
category: 'routing'
method: McpRouter
originAllowed: req
  "MCP Streamable HTTP security: validate the Origin header to prevent DNS-rebinding attacks. An
   absent Origin (non-browser clients -- curl, Claude Code) is allowed; a present Origin is allowed
   only if its host is in the allowlist (loopback by default). Header keys are lower-cased by
   parseHead:."
  | origin |
  origin := (req at: 'headers' ifAbsent: [Dictionary new]) at: 'origin' ifAbsent: [nil].
  origin isNil ifTrue: [^true].
  ^self class allowedOriginHosts includes: (self hostOfOrigin: origin) asLowercase
%
category: 'routing'
method: McpRouter
protocolVersionAllowed: req
  "MCP spec: a request carrying an unsupported MCP-Protocol-Version MUST be rejected (400). An
   absent header is allowed -- the spec says to assume 2025-03-26, and the initialize request
   legitimately carries no version yet. Header keys are lower-cased by parseHead:."
  | version |
  version := (req at: 'headers' ifAbsent: [Dictionary new]) at: 'mcp-protocol-version' ifAbsent: [nil].
  ^version isNil or: [McpDispatcher supportedProtocolVersions includes: version]
%
category: 'sessions'
method: McpRouter
randomSessionToken
  "128 bits from the OS CSPRNG (/dev/urandom), hex-encoded to 32 visible-ASCII chars (satisfies the
   MCP spec: session ids SHOULD be cryptographically secure). Fail closed -- raise if /dev/urandom
   is unreadable rather than fall back to a guessable source (never use Random, a PRNG). Not itself
   uniqueness-checked; nextSessionId does that."
  | f bytes |
  f := GsFile openReadOnServer: '/dev/urandom'.
  f isNil ifTrue: [^self error: 'cannot open /dev/urandom for session-id entropy'].
  bytes := [f next: 16] ensure: [f close].
  ^bytes asHexString
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
category: 'running'
method: McpRouter
route: req on: conn
  "Apply the transport gates, then dispatch by HTTP verb. Gates (MCP Streamable HTTP spec): Origin
   validation (DNS-rebinding -> 403) then MCP-Protocol-Version validation (unsupported -> 400).
   POST = JSON-RPC, GET = SSE stream, DELETE = session end; unknown verb -> 405. Early returns are
   fine -- handleConnection: still closes the connection."
  | httpMethod handler |
  (self originAllowed: req) ifFalse: [
    ^self writeSessionError: 'Origin not allowed (DNS-rebinding protection)' code: 403 reason: 'Forbidden' on: conn].
  (self protocolVersionAllowed: req) ifFalse: [
    ^self writeSessionError: 'Unsupported MCP-Protocol-Version' code: 400 reason: 'Bad Request' on: conn].
  httpMethod := (req at: 'method' ifAbsent: ['']) asUppercase.
  handler := routesTable
    at: httpMethod
    ifAbsent: [[:rq :c | c writeStatus: 405 reason: 'Method Not Allowed' body: '']].
  handler value: req value: conn
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
category: 'routing'
method: McpRouter
serveDelete: req on: conn
  "MCP session end: close and unmap the worker for the MCP-Session-Id header, if present."
  | sid sess |
  sid := self sessionIdOf: req.
  sess := sid isNil ifTrue: [nil] ifFalse: [mutex critical: [sessions removeKey: sid ifAbsent: [nil]]].
  sess ifNotNil: [:s | s close].
  conn writeStatus: 200 reason: 'OK' body: ''
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
category: 'routing'
method: McpRouter
serveInitialize: body on: conn
  "Open a new client session (worker gem), forward the initialize request to it, and answer with
   the worker's response plus the MCP-Session-Id header the client echoes on later requests."
  | sess |
  sess := self openSession.
  conn writeJson: (sess forward: body) sessionId: sess id
%
category: 'running'
method: McpRouter
servePost: req on: conn
  "Front-end router (per-client sessions). `initialize` opens a per-client worker gem and returns
   its id in the MCP-Session-Id header; every other request is routed by that id to the client's
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
serveRouted: body sessionId: sid on: conn
  "Route a non-initialize request to the client's worker by session id (required). Relay the
   worker's JSON response, or 202 for a notification (empty response)."
  | sess resp |
  sid isNil ifTrue: [^self writeSessionError: 'Missing MCP-Session-Id header (call initialize first)' code: 400 reason: 'Bad Request' on: conn].
  sess := mutex critical: [sessions at: sid ifAbsent: [nil]].
  sess isNil ifTrue: [^self writeSessionError: 'Unknown or expired session: ' , sid code: 404 reason: 'Not Found' on: conn].
  resp := sess forward: body.
  resp isEmpty
    ifTrue: [conn writeStatus: 202 reason: 'Accepted' body: '']
    ifFalse: [conn writeJson: resp]
%
category: 'sessions'
method: McpRouter
sessionIdleTimeoutSeconds
  "Idle time (seconds) before a client session's worker gem is reaped. 5 minutes."
  ^300
%
category: 'routing'
method: McpRouter
sessionIdOf: req
  "The MCP-Session-Id request header (header keys are lower-cased by parseHead:), or nil."
  ^(req at: 'headers' ifAbsent: [Dictionary new]) at: 'mcp-session-id' ifAbsent: [nil]
%
category: 'controlling'
method: McpRouter
stop
  "Request a graceful shutdown; the accept loop exits within one accept timeout."
  isRunning := false
%
category: 'routing'
method: McpRouter
writeParseError: conn
  "Malformed or empty JSON body the front end cannot accept: answer HTTP 400 with a JSON-RPC
   -32700 Parse error body (id null). Per the MCP Streamable HTTP spec, input the server cannot
   accept MUST get an HTTP error status; the body MAY carry a JSON-RPC error with no id. The
   front end validates only enough to route."
  | err |
  err := Dictionary new.
  err at: 'jsonrpc' put: '2.0'; at: 'id' put: nil.
  err at: 'error' put: (Dictionary new at: 'code' put: -32700; at: 'message' put: 'Parse error'; yourself).
  conn writeStatus: 400 reason: 'Bad Request' body: err asJson
%
category: 'routing'
method: McpRouter
writeSessionError: aMessage code: httpCode reason: reasonString on: conn
  "A routing error the MCP client can act on: 400 when the MCP-Session-Id header is missing, 404
   when the session is unknown/expired (per the Streamable HTTP spec, a 404 tells the client to
   re-initialize). The body carries a JSON-RPC -32600 error for humans."
  | err |
  err := Dictionary new.
  err at: 'jsonrpc' put: '2.0'; at: 'id' put: nil.
  err at: 'error' put: (Dictionary new at: 'code' put: -32600; at: 'message' put: aMessage; yourself).
  conn writeStatus: httpCode reason: reasonString body: err asJson
%
