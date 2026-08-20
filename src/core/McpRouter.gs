set compile_env: 0
! ------------------- Class definition for McpRouter
expectvalue /Class
doit
McpBase subclass: 'McpRouter'
  instVarNames: #( isRunning mutex routesTable
                    serverSocket sessions allowedOriginHosts tlsCertificateFile
                    tlsPrivateKeyFile readOnly workerClassName toolsetNames
                    serverName serverVersion)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpRouter comment: 
'Native GemStone MCP front end. Runs a blocking HTTP/1.1 accept loop on LOOPBACK ONLY that speaks the
MCP Streamable HTTP transport (single /mcp endpoint), and gives EACH client its own worker gem
(an isolated GemStone session) so clients never share uncommitted changes. It routes by the
MCP-Session-Id header: `initialize` opens a worker (a McpSession) and returns its id; every
other request is forwarded to that client''s worker. The worker runs the actual tools
(McpServer, per gem). This class owns only the socket, the id -> McpSession map (mutex-guarded)
and the idle-session reaper -- it never parses a tool call itself.

It also decides WHAT each worker is: per session it resolves the worker class (workerClassName) and
the tool surface (toolsetNames, defaulting to the installed toolsets) and pushes them into the worker
gem in one call, so a worker never chooses for itself. Resolving here rather than at boot is also what
will let an authenticated router narrow the surface per token, since the token is only visible on this
side.

IMPORTANT: runOnPort: is BLOCKING and is meant to be the main activity of a dedicated gem. Forked
GsProcesses only run while the gem is actively executing Smalltalk, so a background fork in an idle
GCI session would never serve requests.

Configure a router INSTANCE and run or fork it. Config lives on the instance (no class/committed
state); forkOnPort: carries it to the detached child gem as JSON embedded in the fork string (paths
+ identifiers only, never key material -- see configDict), so nothing is committed and multiple
differently-configured routers can run at once.

Foreground (blocks this session):
    McpRouter new runOnPort: 8000
Detached, independent (survives logout); stop it by port with ./stop-server.sh:
    McpRouter new forkOnPort: 8000
Read-only (a localhost convenience so a single user cannot accidentally mutate the image):
    (McpRouter new readOnly: true) forkOnPort: 8000
Choose the tool surface -- e.g. a vendor''s own tools with none of the Smalltalk-development ones.
An empty list is legal and means a server offering no tools at all:
    (McpRouter new toolsetNames: #(''AcmeDbToolset''); serverName: ''acme-db-mcp''; serverVersion: ''2.5.0'')
      forkOnPort: 8000
Name an McpServer subclass for the workers (nothing auto-detects one -- subclass to change BEHAVIOR;
to add tools write an McpToolset instead):
    (McpRouter new workerClassName: ''AcmeDbServer'') forkOnPort: 8000
TLS (serve HTTPS): give the instance a PEM cert + UNENCRYPTED private key, then run/fork:
    (McpRouter new useTlsCertificateFile: ''/path/server.crt'' privateKeyFile: ''/path/server.key'')
      forkOnPort: 8443
This class CANNOT be made reachable from another host: bindAddress answers loopback and has no
setter, because a base McpRouter performs no authentication and a reachable port would be an open
door into the repository. For a reachable port use McpAuthRouter, which requires a bearer token,
takes a configurable bindAddress, and refuses to run without TLS.

Test it:
    curl -s localhost:8000/mcp -d ''{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}''
'
%
expectvalue /Class
doit
McpRouter category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpRouter
removeallmethods McpRouter
removeallclassmethods McpRouter
! ------------------- Class methods for McpRouter
category: 'origin allowlist'
classmethod: McpRouter
defaultAllowedOriginHosts
  "Loopback hosts only -- a page served from any other origin is a DNS-rebinding attempt."
  ^#('localhost' '127.0.0.1' '[::1]')
%
category: 'network'
classmethod: McpRouter
loopbackAddress
  "The only address a base McpRouter will ever bind. Kept here as the single place the literal
   lives; McpAuthRouter seeds its configurable bindAddress from it too."
  ^'127.0.0.1'
%
category: 'instance creation'
classmethod: McpRouter
new
  ^super new initialize
%
category: 'instance creation'
classmethod: McpRouter
runOnPort: aPort
  "Convenience: create a default-config front end and run its (blocking) accept loop. Intended as
   the main activity of a dedicated gem (foreground)."
  ^self new runOnPort: aPort
%
category: 'forking'
classmethod: McpRouter
runOnPort: aPort configJson: aJsonString
  "Child-gem entry the detached fork runs (see the instance forkOnPort:): build a router of THIS
   class, apply the serialized config, and run its blocking accept loop."
  ^(self new applyConfigJson: aJsonString) runOnPort: aPort
%
! ------------------- Instance methods for McpRouter
category: 'origin allowlist'
method: McpRouter
allowedOriginHosts
  "This router's Origin-host allowlist for DNS-rebinding protection. Seeded to loopback in
   #initialize; override with allowedOriginHosts:."
  ^allowedOriginHosts
%
category: 'origin allowlist'
method: McpRouter
allowedOriginHosts: aCollectionOfHostStrings
  "Replace this router's Origin-host allowlist (hosts compared lower-cased; include loopback if you
   still want local browsers to connect)."
  allowedOriginHosts := aCollectionOfHostStrings
%
category: 'config'
method: McpRouter
applyConfig: aConfigDict
  "Set this router's config from a parsed config Dictionary (see configDict). A key that is absent
   leaves the initialize-seeded default; a present key (including a JSON null -> nil) is applied.
   Subclasses extend via super."
  allowedOriginHosts := aConfigDict at: 'allowedOriginHosts' ifAbsent: [allowedOriginHosts].
  tlsCertificateFile := aConfigDict at: 'tlsCertificateFile' ifAbsent: [tlsCertificateFile].
  tlsPrivateKeyFile := aConfigDict at: 'tlsPrivateKeyFile' ifAbsent: [tlsPrivateKeyFile].
  readOnly := aConfigDict at: 'readOnly' ifAbsent: [readOnly].
  workerClassName := aConfigDict at: 'workerClassName' ifAbsent: [workerClassName].
  toolsetNames := aConfigDict at: 'toolsetNames' ifAbsent: [toolsetNames].
  serverName := aConfigDict at: 'serverName' ifAbsent: [serverName].
  serverVersion := aConfigDict at: 'serverVersion' ifAbsent: [serverVersion].
  ^self
%
category: 'config'
method: McpRouter
applyConfigJson: aJsonString
  "Apply a JSON config string (see applyConfig: / configJson)."
  ^self applyConfig: (self parseBody: aJsonString)
%
category: 'network'
method: McpRouter
bindAddress
  "The local address this router's listener binds. For a base McpRouter this is ALWAYS loopback and
   there is deliberately no setter: this class performs no authentication, so a reachable port would
   be an open door into the repository. McpAuthRouter overrides this with a configurable address,
   because it requires a bearer token and enforces TLS."
  ^self class loopbackAddress
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
  d at: 'GET'    put: [:req :conn | self serveGet: req on: conn].
  d at: 'DELETE' put: [:req :conn | self serveDelete: req on: conn].
  ^d
%
category: 'running'
method: McpRouter
completeHandshake: aClientSocket
  "Perform the TLS server handshake on a freshly accepted connection when TLS is enabled; answer
   whether the connection is ready to speak HTTP. Plaintext (the default) needs nothing. Runs inside
   the per-connection GsProcess (see serve:) so it never stalls the accept loop. The handshake is
   bounded (tlsHandshakeTimeoutMs) so a stalled or non-TLS client cannot wedge the connection; on
   timeout or error the socket is closed and false is answered."
  self tlsEnabled ifFalse: [^true].
  ^[ | ok |
     ok := aClientSocket secureAcceptTimeoutMs: self tlsHandshakeTimeoutMs errorOnTimeout: false.
     ok ifFalse: [
       self log: 'TLS handshake timed out'.
       [aClientSocket close] on: Error do: [:e | nil]].
     ok ]
    on: Error
    do: [:ex |
      self log: 'TLS handshake failed: ' , ([ex description] on: Error do: [:x | ex class name asString]).
      [aClientSocket close] on: Error do: [:e | nil].
      false]
%
category: 'config'
method: McpRouter
configDict
  "This router's deployment config as a Dictionary of JSON-safe values, for serialization into the
   fork string (forkOnPort:). FIXED KEY ALLOW-LIST: only these keys travel, so a future ivar cannot
   silently start carrying a secret. Values are host lists, file PATHS, and booleans -- never key
   material. Subclasses add their keys via super."
  | d |
  d := Dictionary new.
  d at: 'allowedOriginHosts' put: allowedOriginHosts.
  d at: 'tlsCertificateFile' put: tlsCertificateFile.
  d at: 'tlsPrivateKeyFile' put: tlsPrivateKeyFile.
  d at: 'readOnly' put: readOnly.
  d at: 'workerClassName' put: workerClassName.
  d at: 'toolsetNames' put: toolsetNames.
  d at: 'serverName' put: serverName.
  d at: 'serverVersion' put: serverVersion.
  ^d
%
category: 'config'
method: McpRouter
configJson
  "This router's config (configDict) as a JSON string."
  ^self configDict asJson
%
category: 'running'
method: McpRouter
configureServerTls
  "Install this gem's TLS server credentials on GsSecureSocket. This state is global to the gem and
   only affects sockets created AFTER it runs, so it is called just before newServer (in
   makeListenerOnPort:). The private key must be unencrypted (nil passphrase). We do NOT request a
   client certificate (disableCertificateVerificationOnServer): clients authenticate with a JWT
   bearer token, not mTLS. NULL and anonymous-DH ciphers are excluded, sorted by strength."
  GsSecureSocket
    useServerCertificateFile: self tlsCertificateFile
    withPrivateKeyFile: self tlsPrivateKeyFile
    privateKeyPassphrase: nil.  "unencrypted key -> nil passphrase (the API rejects '')"
  GsSecureSocket disableCertificateVerificationOnServer.
  GsSecureSocket setServerCipherListFromString: 'ALL:!ADH:@STRENGTH'
%
category: 'tls'
method: McpRouter
disableTls
  "Return THIS router to plaintext HTTP (clear its cert + key)."
  tlsCertificateFile := nil.
  tlsPrivateKeyFile := nil
%
category: 'toolsets'
method: McpRouter
effectiveToolsetNames
  "The toolsets this router's NEXT worker will register: the configured list, or the installed default
   surface. Resolved HERE, in the front end, and pushed into the worker at session open -- a worker
   never chooses its own tool surface. Probed per session rather than cached, so a Grail install that
   lands after this router started is picked up by the next client.
   This is where scope-driven selection will hook in: an authenticated router can narrow the list per
   principal, which is only possible on this side, because this is where the token is."
  ^toolsetNames ifNil: [McpServer installedDefaultToolsetNames]
%
category: 'worker class'
method: McpRouter
effectiveWorkerClassName
  "The class this router's workers instantiate: the configured name, or McpServer. Named on every
   forwarded request (McpSession>>workerExpressionFor:), so the worker gem is told rather than
   deciding."
  ^workerClassName ifNil: ['McpServer']
%
category: 'forking'
method: McpRouter
forkOnPort: aPort
  "Start THIS router (with its current config) in a SEPARATE, INDEPENDENT gem, detached, so it keeps
   serving after this session logs out. A plain GsProcess fork would freeze whenever this session
   goes idle, so spawn a real gem via GsTsExternalSession and run the blocking accept loop there.
   This router's config travels to the child IN the fork string as JSON (configDict -- paths +
   identifiers only, never key material), so nothing is committed and multiple differently-configured
   routers can run at once. The child logs in as the current user via a one-time password.
   Stop it by port with ./stop-server.sh, or via `System stopSession: <id>` / `kill <pid>` (both
   printed below). Answers a status string. Requires GsTsExternalSession."
  | es sid pid s |
  es := GsTsExternalSession newDefaultForGemHost: 'localhost'.
  es useOnetimePassword.
  es login.
  "Capture the child's id/pid BEFORE launching the loop -- once the non-blocking call is running the
   external session rejects further queries (GciError 'operation in progress')."
  sid := es stoneSessionId.
  pid := [(System descriptionOfSession: sid) at: 2] on: Error do: [:e | nil].
  es forkAndDetachString: self class name asString , ' runOnPort: ' , aPort printString
    , ' configJson: ' , (self quoteForFork: self configJson).
  [es logout] on: Error do: [:e | nil].  "release our handle; the detached front end keeps running"
  s := WriteStream on: String new.
  s nextPutAll: self class name asString.
  readOnly ifTrue: [s nextPutAll: ' (read-only)'].
  s nextPutAll: ' forked into gem session '; nextPutAll: sid printString.
  pid ifNotNil: [:p | s nextPutAll: ' (host pid '; nextPutAll: p printString; nextPutAll: ')'].
  s nextPutAll: ', listening on port '; nextPutAll: aPort printString; nextPutAll: ' (independent; survives logout).'.
  s nextPut: Character lf; nextPutAll: 'To stop:  ./stop-server.sh   (by port)'.
  s nextPut: Character lf; nextPutAll: '     or:  System stopSession: '; nextPutAll: sid printString; nextPutAll: '   (from any session)'.
  pid ifNotNil: [:p | s nextPut: Character lf; nextPutAll: '     or:  kill '; nextPutAll: p printString; nextPutAll: '   (shell)'].
  ^s contents
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
  "Seed this router's config with safe instance-side defaults. There is NO class-side config state:
   a caller (a launch script, a test) reconfigures the instance via the setters, and forkOnPort:
   serializes the config into the child gem's fork string. Genuinely-optional fields stay nil (= off);
   only fields where nil would be unsafe or crash get a seed here."
  mutex := Semaphore forMutualExclusion.
  routesTable := self buildRoutes.
  isRunning := false.
  sessions := Dictionary new.
  allowedOriginHosts := self class defaultAllowedOriginHosts.  "loopback -- a security default"
  tlsCertificateFile := nil.
  tlsPrivateKeyFile := nil.
  readOnly := false.
  workerClassName := nil.  "nil = McpServer"
  toolsetNames := nil.     "nil = the installed default surface, resolved per session"
  serverName := nil.       "nil = the worker's own default (McpServer class>>defaultServerName)"
  serverVersion := nil.
  ^self
%
category: 'running'
method: McpRouter
makeListenerOnPort: aPort
  "Create and bind the listening socket (backlog 16) on self bindAddress -- always loopback for this
   class; McpAuthRouter overrides it. When TLS is configured (self tlsEnabled) install this gem's
   server credentials (configureServerTls) and bind a GsSecureSocket, so accepted connections can
   complete a TLS handshake (completeHandshake:); otherwise bind a plain GsSocket serving cleartext
   HTTP. Signals an error if the bind fails."
  | sock |
  self tlsEnabled
    ifTrue: [self configureServerTls. sock := GsSecureSocket newServer]
    ifFalse: [sock := GsSocket new].
  (sock makeServer: 16 atPort: aPort atAddress: self bindAddress)
    ifNil: [^self error: 'makeServer failed on port ' , aPort printString , ': ' , sock lastErrorString].
  ^sock
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
  "Create + register a new client session (a worker gem for the current/server user). The worker is
   opened read-only when THIS router is read-only."
  ^self openSessionCreating: [:newId | McpSession startWithId: newId readOnly: self readOnly]
%
category: 'sessions'
method: McpRouter
openSessionCreating: aOneArgBlock
  "Mint a fresh session id, create the session via aOneArgBlock (given the id, answers a started
   McpSession), and register it in the id -> session map. The block runs OUTSIDE the mutex (login is
   slow); the id mint and map insert are guarded. Subclasses (McpAuthRouter) pass a block that
   starts a per-user JWT session. A block that raises (e.g. a failed login) propagates and leaves
   nothing registered."
  | newId sess |
  newId := mutex critical: [self nextSessionId].
  sess := aOneArgBlock value: newId.
  "Push this router's worker config, then prepare the worker gem -- both BEFORE the session is
   registered, so no request can reach an unprepared worker. Resolving here (rather than in the
   worker) is what lets an authenticated router later narrow the tool surface per principal."
  sess workerClassName: self effectiveWorkerClassName;
    toolsetNames: self effectiveToolsetNames;
    serverName: self serverName;
    serverVersion: self serverVersion;
    prepareWorker.
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
  ^self allowedOriginHosts includes: (self hostOfOrigin: origin) asLowercase
%
category: 'routing'
method: McpRouter
protocolVersionAllowed: req
  "MCP spec: a request carrying an invalid or unsupported MCP-Protocol-Version MUST be rejected
   (400). An absent header is allowed: initialize legitimately carries no version yet, and for
   later requests the spec's 'assume 2025-03-26' fallback applies only to a server with 'no other
   way to identify the version'. We have one -- a request without the header still arrives on a
   session that was opened by an initialize we negotiated (McpDispatcher>>initializeResultFor:) --
   so we treat an absent header as that negotiated version rather than as 2025-03-26, which we
   deliberately do not support (see supportedProtocolVersions on batching). Recording the
   negotiated version per McpSession and enforcing it here would be strictly tighter; today the
   header check is the only enforcement point. Header keys are lower-cased by parseHead:."
  | version |
  version := (req at: 'headers' ifAbsent: [Dictionary new]) at: 'mcp-protocol-version' ifAbsent: [nil].
  ^version isNil or: [McpDispatcher supportedProtocolVersions includes: version]
%
category: 'config'
method: McpRouter
quoteForFork: aString
  "aString as a Smalltalk single-quoted string literal, doubling any interior single quote, so a
   config JSON embeds safely in the fork's execute-string. Our config values (paths, URLs,
   identifiers) contain no single quotes, so this is usually a plain wrap."
  | s |
  s := WriteStream on: String new.
  s nextPut: $'.
  aString do: [:c | c = $' ifTrue: [s nextPut: $']. s nextPut: c].
  s nextPut: $'.
  ^s contents
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
category: 'read-only'
method: McpRouter
readOnly
  "Whether this router opens its worker sessions read-only (mutating tools hidden + refused). A
   localhost convenience so a single user cannot accidentally mutate the image -- NOT an access
   boundary. Default false."
  ^readOnly
%
category: 'read-only'
method: McpRouter
readOnly: aBoolean
  "Open this router's workers read-only (see #readOnly)."
  readOnly := aBoolean
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
category: 'routing'
method: McpRouter
requestAuthorized: req on: conn
  "Whether req may proceed to a verb handler. A hook for subclasses: this class performs NO
   authentication (it is loopback-only for exactly that reason), so it always answers true. An
   override answers false to refuse the request, and is responsible for having written the error
   response itself -- see McpAuthRouter>>requestAuthorized:on:."
  ^true
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
  "Credential gate, AFTER the transport gates (they concern the connection, not the principal, and
   are cheaper). The base class authenticates nothing and always passes; McpAuthRouter overrides this
   to require a valid bearer token on every request. A false answer means the hook has already written
   the error response."
  (self requestAuthorized: req on: conn) ifFalse: [^self].
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
  self validateWorkerConfig.
  serverSocket := self makeListenerOnPort: aPort.
  isRunning := true.
  self forkReaper.
  self log: self class name asString , ' listening on ' ,
    (self tlsEnabled ifTrue: ['https'] ifFalse: ['http']) , '://' , self bindAddress , ':' , aPort printString.
  self log: 'workers: ' , self effectiveWorkerClassName , ', toolsets: ' ,
    (self effectiveToolsetNames isEmpty
      ifTrue: ['(none -- this router offers no tools)']
      ifFalse: [self effectiveToolsetNames inject: '' into: [:a :b | a isEmpty ifTrue: [b] ifFalse: [a , ' ' , b]]]).
  [isRunning] whileTrue: [
    "Gate the accept on readiness rather than acceptTimeoutMs:: for a GsSecureSocket listener
     acceptTimeoutMs: RAISES on an idle timeout (it treats the nil from a plain-socket timeout as a
     failure), which would kill the loop every 500ms. readWillNotBlockWithin: yields false on an
     idle tick (loop continues) and true when a connection is pending; the subsequent accept then
     returns immediately. Works identically for a plain GsSocket."
    (serverSocket readWillNotBlockWithin: 500) == true ifTrue: [
      | client |
      client := [serverSocket accept]
        on: Error
        do: [:e | self log: 'accept failed: ' , ([e description] on: Error do: [:x | e class name asString]). nil].
      client ifNotNil: [self serve: client]]].
  serverSocket close.
  self log: 'McpRouter stopped.'.
  ^self
%
category: 'running'
method: McpRouter
serve: aClientSocket
  "Handle each connection in its own GsProcess so a slow or stalled client cannot block the accept
   loop (the forked process runs during the loop's accept waits). When TLS is enabled, complete the
   server-side handshake first; a failed handshake closes the socket and serves nothing."
  [(self completeHandshake: aClientSocket)
     ifTrue: [self handleConnection: (McpHttpConnection on: aClientSocket)]] fork
%
category: 'routing'
method: McpRouter
serveDelete: req on: conn
  "MCP session end: close and unmap the worker named by the MCP-Session-Id header. Answers the same
   status codes as the POST path (serveRouted:sessionId:on:) so a client gets one consistent signal
   from either verb -- required by the Streamable HTTP spec's session-management rules: a server
   that requires a session id SHOULD answer a request without the header with 400, and once a
   session is gone it MUST answer a request carrying that id with 404 (the client's cue to
   re-initialize). Only a live session is closed and answered 200."
  | sid sess |
  sid := self sessionIdOf: req.
  sid isNil ifTrue: [
    ^self writeSessionError: 'Missing MCP-Session-Id header' code: 400 reason: 'Bad Request' on: conn].
  sess := mutex critical: [sessions removeKey: sid ifAbsent: [nil]].
  sess isNil ifTrue: [
    ^self writeSessionError: 'Unknown or expired session: ' , sid code: 404 reason: 'Not Found' on: conn].
  sess close.
  conn writeStatus: 200 reason: 'OK' body: ''
%
category: 'running'
method: McpRouter
serveGet: req on: conn
  "Dispatch a GET. Base: open the standalone SSE stream. Subclasses may branch on the request path
   (McpAuthRouter serves Protected Resource Metadata at a well-known path)."
  ^self serveGetStream: conn
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
serveInitialize: req on: conn
  "Open a new client session (worker gem), forward the initialize request to it, and answer with
   the worker's response plus the MCP-Session-Id header the client echoes on later requests.
   McpAuthRouter overrides this to authenticate the request and open a per-user (JWT) session."
  | sess |
  sess := self openSession.
  conn writeJson: (sess forward: (req at: 'body' ifAbsent: [''])) sessionId: sess id
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
  method = 'initialize' ifTrue: [^self serveInitialize: req on: conn].
  ^self serveRouted: body sessionId: (self sessionIdOf: req) on: conn
%
category: 'worker identity'
method: McpRouter
serverName
  "The serverInfo name this router's workers advertise, or nil to let the worker answer its own
   default. A deployment assembled from third-party toolsets sets this, since it may never subclass
   McpServer -- see McpServer>>serverName."
  ^serverName
%
category: 'worker identity'
method: McpRouter
serverName: aStringOrNil
  serverName := aStringOrNil
%
category: 'routing'
method: McpRouter
serveRouted: body sessionId: sid on: conn
  "Route a non-initialize request to the client's worker by session id (required). Relay the
   worker's JSON response, or 202 for a notification (empty response)."
  | sess resp |
  sid isNil ifTrue: [^self writeSessionError: 'Missing MCP-Session-Id header (call initialize first)' code: 400 reason: 'Bad Request' on: conn].
  sess := self sessionAt: sid.
  sess isNil ifTrue: [^self writeSessionError: 'Unknown or expired session: ' , sid code: 404 reason: 'Not Found' on: conn].
  resp := sess forward: body.
  resp isEmpty
    ifTrue: [conn writeStatus: 202 reason: 'Accepted' body: '']
    ifFalse: [conn writeJson: resp]
%
category: 'worker identity'
method: McpRouter
serverVersion
  "The serverInfo version this router's workers advertise, or nil for the worker's own default."
  ^serverVersion
%
category: 'worker identity'
method: McpRouter
serverVersion: aStringOrNil
  serverVersion := aStringOrNil
%
category: 'sessions'
method: McpRouter
sessionAt: aSessionId
  "The client session registered under aSessionId, or nil if there is none (unknown or already
   reaped). Mutex-guarded, since it reads the shared `sessions` map."
  aSessionId isNil ifTrue: [^nil].
  ^mutex critical: [sessions at: aSessionId ifAbsent: [nil]]
%
category: 'sessions'
method: McpRouter
sessionIdleTimeoutSeconds
  "Idle time (seconds) before a client session's worker gem is reaped. 30 minutes."
  ^1800
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
category: 'tls'
method: McpRouter
tlsCertificateFile
  "This router's PEM certificate path, or nil for plaintext HTTP."
  ^tlsCertificateFile
%
category: 'tls'
method: McpRouter
tlsCertificateFile: aPathOrNil
  tlsCertificateFile := aPathOrNil
%
category: 'tls'
method: McpRouter
tlsEnabled
  "True when this router has both a certificate and a private key, so runOnPort: binds a
   GsSecureSocket and serves HTTPS rather than cleartext HTTP."
  ^tlsCertificateFile notNil and: [tlsPrivateKeyFile notNil]
%
category: 'tls'
method: McpRouter
tlsHandshakeTimeoutMs
  "Maximum time (ms) to wait for a client to complete its TLS handshake before abandoning the
   connection, so a stalled or non-TLS client cannot tie up a handler. 10 seconds."
  ^10000
%
category: 'tls'
method: McpRouter
tlsPrivateKeyFile
  "This router's PEM private-key path (may be the same file as the certificate), or nil. The key must
   be UNENCRYPTED -- configureServerTls passes a nil passphrase."
  ^tlsPrivateKeyFile
%
category: 'tls'
method: McpRouter
tlsPrivateKeyFile: aPathOrNil
  tlsPrivateKeyFile := aPathOrNil
%
category: 'toolsets'
method: McpRouter
toolsetNames
  "The toolsets this router asks its workers to register, or nil for the installed default surface
   (see effectiveToolsetNames). Names, not classes: they cross a gem boundary."
  ^toolsetNames
%
category: 'toolsets'
method: McpRouter
toolsetNames: aCollectionOfNamesOrNil
  "Choose this router's tool surface by naming toolsets -- e.g. only a vendor's own, with none of the
   Smalltalk-development tools. Each name is validated as an identifier (validatedClassName:) because
   it is interpolated into an executeString: in the worker gem. An EMPTY collection is legal and means
   a server with no tools at all."
  toolsetNames := aCollectionOfNamesOrNil isNil
    ifTrue: [nil]
    ifFalse: [(aCollectionOfNamesOrNil collect: [:n | self validatedClassName: n]) asArray]
%
category: 'tls'
method: McpRouter
useTlsCertificateFile: certPath privateKeyFile: keyPath
  "Enable TLS on THIS router only. Both files must be readable by the gem when the listener binds.
   Pass the same path twice for a combined cert+key PEM."
  tlsCertificateFile := certPath.
  tlsPrivateKeyFile := keyPath
%
category: 'config'
method: McpRouter
validatedClassName: aName
  "aName as a String, or raise: it must be a plain Smalltalk identifier (a letter, then letters,
   digits or underscores). Class and toolset names from config are interpolated into an executeString:
   in the worker gem, so anything else must fail HERE, when the router is configured, rather than on
   every request. Not a privilege boundary -- whoever sets router config can already run code in this
   image -- but a typo should stop a server from starting, not half-break it."
  | s |
  s := aName asString.
  (s notEmpty
    and: [s first isLetter
    and: [(s detect: [:c | (c isLetter or: [c isDigit or: [c == $_]]) not] ifNone: [nil]) isNil]])
      ifFalse: [^self error: 'Not a valid class name: ' , s printString
        , '. Expected a Smalltalk identifier (a letter, then letters, digits or underscores).'].
  ^s
%
category: 'config'
method: McpRouter
validateWorkerConfig
  "Resolve what this router will ask its workers to build, BEFORE binding a port (runOnPort:), so a
   name that cannot be used fails at startup with a clear message instead of at a client's first
   request. Checked in the FRONT END's symbol list; the worker bootstrap checks again in the worker's,
   which can differ under McpAuthRouter (see McpServer class>>toolsetClassNamed:)."
  | cls |
  cls := System myUserProfile objectNamed: self effectiveWorkerClassName asSymbol.
  ((cls isKindOf: Behavior) and: [cls == McpServer or: [cls inheritsFrom: McpServer]]) ifFalse: [
    ^self error: 'Worker class not usable: ' , self effectiveWorkerClassName
      , ' must be McpServer or a subclass, installed in a symbol dictionary in the worker''s symbol '
      , 'list (e.g. Published).'].
  self effectiveToolsetNames do: [:n | McpServer toolsetClassNamed: n].
  ^self
%
category: 'worker class'
method: McpRouter
workerClassName
  "The McpServer subclass this router's workers instantiate, or nil for McpServer itself. Subclassing
   is for changing BEHAVIOR (kernel guards, the worker entry, dispatcher wiring); to add tools, write
   a toolset instead (see McpToolset) -- but a subclass is only ever used if it is NAMED here."
  ^workerClassName
%
category: 'worker class'
method: McpRouter
workerClassName: aNameOrNil
  "Name the worker class (nil restores McpServer). Validated as an identifier -- see
   validatedClassName:. The class must be visible in the WORKER gem's symbol list, which under
   McpAuthRouter belongs to the authenticated user, so Published rather than UserGlobals."
  workerClassName := aNameOrNil isNil ifTrue: [nil] ifFalse: [self validatedClassName: aNameOrNil]
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
