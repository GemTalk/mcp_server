set compile_env: 0
! ------------------- Class definition for McpRouter
expectvalue /Class
doit
McpBase subclass: 'McpRouter'
  instVarNames: #( isRunning mutex routesTable
                    serverSocket sessions allowedOriginHosts tlsCertificateFile
                    tlsPrivateKeyFile readOnly workerClassName toolsetNames
                    serverName serverTitle serverVersion pendingRequests
                    pendingMutex serverRequestCounter sessionIdleTimeoutSeconds streamlessIdleTimeoutSeconds
                    livenessProbeIntervalSeconds reaperIntervalSeconds
                    maxSessionLifetimeSeconds reapOnFailedProbe expiryWarningLeadSeconds
                    streamLossGraceSeconds)
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

It is also the only place that can SPEAK FIRST. Streamable HTTP gives a server no socket to call
out on, and the one connection it may write to unprompted is the standalone SSE stream a client
opens with GET -- accepted by THIS process, and a socket is a file descriptor meaningful only inside
the process that owns it, so the stream can live nowhere else. Each session therefore has an
McpOutbox here (never in the worker gem), the GET handler drains it, and this class keeps the
pending-request table that correlates a server-initiated request with the JSON-RPC response the
client POSTs back. What that buys today is the idle story: a session IS a gem with its own
transaction view, so reaping one discards uncommitted work -- and now a client is pinged, warned in
time to commit, and told when its session ends, instead of discovering it through a cold 404.
Owning the stream also means owning the moment it CLOSES, which is the other half of the same story:
a client that hangs up is seen to, rather than inferred from silence, and its gem is released in
seconds instead of waiting out a floor meant for a client that was never reachable
(#releaseAbandonedSession:).

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
Label THIS INSTANCE for humans -- what an operator running two instances of one product needs. The
name and version stay truthful (every box reports the same software); only the display title differs:
    (McpRouter new serverTitle: ''GemStone - geode teststone 3.7.6'') forkOnPort: 8000
    (McpRouter new readOnly: true; serverTitle: ''GemStone (read-only)'') forkOnPort: 8001
Choose the tool surface -- e.g. a vendor''s own tools with none of the Smalltalk-development ones.
An empty list is legal and means a server offering no tools at all. serverName says which SOFTWARE
this is, so it is set here (a different product), not to distinguish deployments:
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
category: 'session lifetime defaults'
classmethod: McpRouter
defaultLivenessProbeIntervalSeconds
  "How often a quiet session is asked whether its client is still there. Two minutes: with no
   deadline this ping is the only thing that will ever release the worker gem, so it has to run on a
   cadence rather than once, and it is cheap -- a client answers from a built-in handler without
   prompting anyone.
   It is also the unit two other things are measured in, which is what settled the number. Idleness
   is a count of these (#confirmationsBeforeRelease), so a coarse cadence makes a coarse deadline;
   and a client that is frozen rather than gone is released after #unansweredProbesBeforeGone of
   them, which at the former five minutes meant a quarter of an hour before anyone noticed."
  ^120
%
category: 'session lifetime defaults'
classmethod: McpRouter
defaultExpiryWarningLeadSeconds
  "How much notice a client gets before an ABSOLUTE deadline -- a credential's exp, or a configured
   lifetime cap. Five minutes, and in seconds rightly: unlike idleness, the thing being warned about
   is itself a wall-clock fact, so a count of pings would be the wrong unit for it."
  ^300
%
category: 'session lifetime defaults'
classmethod: McpRouter
defaultReaperIntervalSeconds
  "How often the maintenance pass runs. 60 seconds."
  ^60
%
category: 'session lifetime defaults'
classmethod: McpRouter
defaultSessionIdleTimeoutSeconds
  "Idle time before a client session's worker gem is released. 30 minutes -- the historical value,
   and a defensible default for a server whose sessions each hold a gem and a transaction view."
  ^1800
%
category: 'session lifetime defaults'
classmethod: McpRouter
defaultStreamLossGraceSeconds
  "How long a session outlives its client CLOSING the event stream, before the worker gem is
   released. Ten seconds, and the two bounds are close together: the whole point is to free the gem
   while the person who shut the tab is still looking at the screen, and the only thing the wait is
   for is a client that closes one stream and opens another ON THE SAME SESSION.
   Be clear about which reconnect that is, because the two look alike and only one of them lands
   here. A client whose standalone GET drops while the client itself keeps running does reattach,
   promptly, and #verdictAdmissible:forSession: exists because of it. A client whose PROCESS dies --
   a shut editor tab -- does not: measured over four closes, Claude Code in VS Code comes back as a
   fresh initialize on a new session id, a new worker gem inside 160ms of the new socket, and no GET
   ever arrives for the old session. Reconnects at 3.8 and 4.3 seconds sat well inside this grace
   and retracted nothing, because there was nothing addressed to the old session to retract.
   So for that client this wait buys nothing but delay, and zero is the honest setting. It is ten by
   default because the case it covers is real in the protocol, a proxy or a network blip can force
   it, and the cost of being wrong the other way is a live client losing its gem and whatever it had
   not committed. nil turns the fast path off, leaving such a client to
   #streamlessIdleTimeoutSeconds as before."
  ^10
%
category: 'session lifetime defaults'
classmethod: McpRouter
defaultStreamlessIdleTimeoutSeconds
  "The floor for a client that never opened an SSE stream at all. One minute: such a client can
   never be pinged, so there is no evidence to count and this is the only thing that would ever free
   its gem. It used to be half an hour, because it also had to cover the client that opened a stream
   and then vanished -- much the commoner case, and now handled far sooner and on real evidence by
   #defaultStreamLossGraceSeconds. What is left is a client that initialized and never came back,
   which is a narrower and more suspect thing, and deserves little patience.
   One minute is the shortest this can honestly be, and it is short on purpose: the commonest
   streamless client is a one-shot POST -- a curl, a probe, a script -- whose gem is pure overhead
   the moment it returns. What keeps a minute from being reckless is #streamlessPassesBeforeRelease
   paying for the pass it starts on, so the release comes no sooner than a full minute after the
   last request; a client has that whole minute to open the stream its initialize just earned it.
   Raise it where streamless clients are SEQUENCES of POSTs sharing one session id: what this
   bounds for them is the gap between calls, not the life of the session, and a gem reaped between
   two of them takes its uncommitted work with it."
  ^60
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
category: 'server-initiated'
method: McpRouter
announceSessionEnd: sess because: aReasonPhrase
  "Tell a client on its own stream that its session has just ended and why, and stop the stream
   cleanly. The phrase comes from #reapReasonFor:, so what the client is told is the actual ground
   the decision was made on rather than a guess made afterwards.
   #beginClosing -- not #close -- is what makes this land: it refuses anything further while leaving
   the queued notice deliverable, so the drain loop writes it and closes the outbox itself. Closing
   outright here would drop the notice on the floor as the gem went away.
   Best-effort by design: a client that never opened a GET stream cannot be told, and still learns
   from the 404 on its next call. That is a defensible outcome, but a chosen one."
  self enqueueLog: 'This MCP session has ended because ' , aReasonPhrase ,
      '. Its GemStone worker gem has been released, and any uncommitted changes in it are gone. ' ,
      'Send initialize to start a new session.'
    level: 'warning' toSession: sess.
  sess outbox beginClosing
%
category: 'config'
method: McpRouter
applyConfig: aConfigDict
  "Set this router's config from a parsed config Dictionary (see configDict). A key that is absent
   leaves the initialize-seeded default; a present key (including a JSON null -> nil) is applied.
   That distinction is what lets a deployment ASK for no idle deadline: 'sessionIdleTimeoutSeconds'
   present and null is an instruction, where its absence is not.
   Subclasses extend via super."
  allowedOriginHosts := aConfigDict at: 'allowedOriginHosts' ifAbsent: [allowedOriginHosts].
  tlsCertificateFile := aConfigDict at: 'tlsCertificateFile' ifAbsent: [tlsCertificateFile].
  tlsPrivateKeyFile := aConfigDict at: 'tlsPrivateKeyFile' ifAbsent: [tlsPrivateKeyFile].
  readOnly := aConfigDict at: 'readOnly' ifAbsent: [readOnly].
  workerClassName := aConfigDict at: 'workerClassName' ifAbsent: [workerClassName].
  toolsetNames := aConfigDict at: 'toolsetNames' ifAbsent: [toolsetNames].
  serverName := aConfigDict at: 'serverName' ifAbsent: [serverName].
  serverTitle := aConfigDict at: 'serverTitle' ifAbsent: [serverTitle].
  serverVersion := aConfigDict at: 'serverVersion' ifAbsent: [serverVersion].
  sessionIdleTimeoutSeconds := aConfigDict at: 'sessionIdleTimeoutSeconds' ifAbsent: [sessionIdleTimeoutSeconds].
  streamlessIdleTimeoutSeconds := aConfigDict at: 'streamlessIdleTimeoutSeconds' ifAbsent: [streamlessIdleTimeoutSeconds].
  streamLossGraceSeconds := aConfigDict at: 'streamLossGraceSeconds' ifAbsent: [streamLossGraceSeconds].
  livenessProbeIntervalSeconds := aConfigDict at: 'livenessProbeIntervalSeconds' ifAbsent: [livenessProbeIntervalSeconds].
  reaperIntervalSeconds := aConfigDict at: 'reaperIntervalSeconds' ifAbsent: [reaperIntervalSeconds].
  expiryWarningLeadSeconds := aConfigDict at: 'expiryWarningLeadSeconds' ifAbsent: [expiryWarningLeadSeconds].
  maxSessionLifetimeSeconds := aConfigDict at: 'maxSessionLifetimeSeconds' ifAbsent: [maxSessionLifetimeSeconds].
  reapOnFailedProbe := aConfigDict at: 'reapOnFailedProbe' ifAbsent: [reapOnFailedProbe].
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
   silently start carrying a secret. Values are host lists, file PATHS, booleans, numbers and display
   strings -- never key material. Subclasses add their keys via super.
   The lifetime intervals are written from the IVARS, not the accessors, so what travels is what was
   configured: a nil sessionIdleTimeoutSeconds means 'no deadline' in the child exactly as it does
   here, and every derived count is recomputed there from whatever the other intervals
   turn out to be."
  | d |
  d := Dictionary new.
  d at: 'allowedOriginHosts' put: allowedOriginHosts.
  d at: 'tlsCertificateFile' put: tlsCertificateFile.
  d at: 'tlsPrivateKeyFile' put: tlsPrivateKeyFile.
  d at: 'readOnly' put: readOnly.
  d at: 'workerClassName' put: workerClassName.
  d at: 'toolsetNames' put: toolsetNames.
  d at: 'serverName' put: serverName.
  d at: 'serverTitle' put: serverTitle.
  d at: 'serverVersion' put: serverVersion.
  d at: 'sessionIdleTimeoutSeconds' put: sessionIdleTimeoutSeconds.
  d at: 'streamlessIdleTimeoutSeconds' put: streamlessIdleTimeoutSeconds.
  d at: 'streamLossGraceSeconds' put: streamLossGraceSeconds.
  d at: 'livenessProbeIntervalSeconds' put: livenessProbeIntervalSeconds.
  d at: 'reaperIntervalSeconds' put: reaperIntervalSeconds.
  d at: 'expiryWarningLeadSeconds' put: expiryWarningLeadSeconds.
  d at: 'maxSessionLifetimeSeconds' put: maxSessionLifetimeSeconds.
  d at: 'reapOnFailedProbe' put: reapOnFailedProbe.
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
category: 'server-initiated'
method: McpRouter
drainOutbox: outbox to: conn
  "Write everything waiting in outbox to the SSE stream, oldest first. Answers false as soon as a
   write fails, which is how the drain loop learns the client is gone.
   A gap is admitted rather than hidden: if the overflow policy discarded messages, the client is
   told how many before the survivors arrive. That notice is NOT filtered by the client's log level,
   unlike the messages it reports on -- it describes a failure of delivery, not something that
   happened in the image."
  | dropped |
  dropped := outbox takeDroppedCount.
  dropped > 0 ifTrue: [
    (conn writeSseData: (self logNotification: dropped printString ,
        ' server message(s) for this session were dropped: its outbox overflowed.'
      level: 'warning') asJson) ifNil: [^false]].
  outbox drain do: [:each | (conn writeSseData: each) ifNil: [^false]].
  ^true
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
category: 'server-initiated'
method: McpRouter
enqueueLog: aString level: aLevelString toSession: sess
  "Queue a notifications/message on sess's stream, unless the client asked for a higher severity
   than this one (logging/setLevel). Answers whether it was queued."
  (sess allowsLogLevel: aLevelString) ifFalse: [^false].
  ^sess outbox add: (self logNotification: aString level: aLevelString) asJson
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
  "Check the config HERE as well as in runOnPort:, so a combination the child would refuse fails in
   the launching session. Without this the operator sees a cheerful 'forked into gem session N' and a
   port that never opens, with the reason buried in a detached gem's log."
  self validateWorkerConfig.
  self validateTimerConfig.
  "The next two statements are for compatibility with 3.7.2. In 3.7.5 they could be replaced with
   es := GsTsExternalSession newDefaultForGemHost: 'localhost'.
   es useOnetimePassword."
  es := GsTsExternalSession newDefault
          gemNRS: (GsNetworkResourceString defaultGemNRSFromCurrent node: 'localhost'; yourself);
          yourself.
  es onetimePassword: (GsCurrentSession currentSession createOnetimePasswordValidForSeconds: 300).
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
  "Fork the background maintenance GsProcess: every reaperIntervalSeconds, one pass over the
   sessions (see #maintainSessions). Runs during the accept loop's waits (like the per-connection
   handlers) and exits when the server stops."
  [[isRunning] whileTrue: [
     (Delay forSeconds: self reaperIntervalSeconds) wait.
     [self maintainSessions] on: Error do: [:e |
       self log: 'maintainSessions error: ' , ([e description] on: Error do: [:x | e class name asString])]]] fork
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
category: 'session lifetime'
method: McpRouter
hasSessionIdleDeadline
  "Whether sessions on this router have a wall-clock idle deadline at all. When they do not, liveness
   is the entire policy and several things change shape: the ping runs on a cadence rather than once
   per idle period, there is nothing to warn anybody about, and #streamlessIdleTimeoutSeconds becomes
   the only thing that can release an unreachable client's gem."
  ^sessionIdleTimeoutSeconds notNil
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
  serverTitle := nil.
  serverVersion := nil.
  "server-initiated messaging: the requests this server has sent and is waiting to be answered.
   Its OWN mutex, not the session-map one -- that is held across reapIdleSessions, and correlating
   a client's ping reply must not queue behind another client's login."
  pendingRequests := Dictionary new.
  pendingMutex := Semaphore forMutualExclusion.
  serverRequestCounter := 0.
  "Session lifetime. These are SEEDED rather than left nil-for-default, because for the first of
   them nil is a real setting -- no idle deadline at all -- and could not also mean 'use the
   default'. They are all expressed in seconds because that is how a deployment thinks about them;
   what the reaper actually counts is derived from them (#confirmationsBeforeRelease and friends)."
  sessionIdleTimeoutSeconds := self class defaultSessionIdleTimeoutSeconds.
  streamlessIdleTimeoutSeconds := self class defaultStreamlessIdleTimeoutSeconds.
  streamLossGraceSeconds := self class defaultStreamLossGraceSeconds.
  livenessProbeIntervalSeconds := self class defaultLivenessProbeIntervalSeconds.
  reaperIntervalSeconds := self class defaultReaperIntervalSeconds.
  expiryWarningLeadSeconds := self class defaultExpiryWarningLeadSeconds.
  maxSessionLifetimeSeconds := nil.  "nil = no absolute cap beyond whatever a credential imposes"
  reapOnFailedProbe := true.
  ^self
%
category: 'running'
method: McpRouter
isRunning
  "Whether this router's accept loop is up. Set by runOnPort:, cleared by #stop. Read as a SEND
   (not the instance variable) by the SSE drain loop, so a test can hold a stream open against a
   router that never bound a socket -- see McpFixtureRouter."
  ^isRunning == true
%
category: 'running'
method: McpRouter
keepaliveIntervalSeconds
  "How often an otherwise silent SSE stream gets a comment line. Comfortably under the usual 30-60
   second proxy and NAT idle timeouts, which is the only thing this interval has to beat."
  ^15
%
category: 'session lifetime'
method: McpRouter
livenessProbeIntervalSeconds
  "How often a quiet session with no wall-clock deadline is re-asked whether its client is there.
   Only meaningful when #hasSessionIdleDeadline is false: with a deadline the ping is asked once per
   idle period, as the session enters its warning window."
  ^livenessProbeIntervalSeconds
%
category: 'session lifetime'
method: McpRouter
livenessProbeIntervalSeconds: anInteger
  "Set the re-probe cadence for sessions with no idle deadline (see #livenessProbeIntervalSeconds)."
  livenessProbeIntervalSeconds := anInteger
%
category: 'sessions'
method: McpRouter
maintainIdleSession: sess
  "One session's turn in a maintenance pass. Answers whether a message was sent to it.
   The pass itself is the observation -- #notePassWithStream: is what advances every count the
   reaping policy reads -- so it happens first and unconditionally, before any reason to return
   early. That is the whole clock: it ticks when this front end runs, and not otherwise."
  | hasStream |
  hasStream := sess outbox hasStream.
  sess notePassWithStream: hasStream.
  sess isBusy ifTrue: [^false].
  "a client with no stream can be sent neither a ping nor a warning. It is not forgotten: the
   passes are being counted above, and #reapReasonFor: releases it once there have been enough."
  hasStream ifFalse: [^false].
  (self expiryWarningDue: sess) ifTrue: [^self warnExpiringSession: sess].
  (self probeDue: sess) ifTrue: [^self probeSession: sess].
  (self idleWarningDue: sess) ifTrue: [^self warnIdleSession: sess].
  ^false
%
category: 'sessions'
method: McpRouter
maintainSessions
  "One pass of session housekeeping, run on the reaper's GsProcess. The order is the point:
     0. notice whether this pass is itself wildly late -- the host was suspended -- and forgive that
        time rather than letting it be read as idleness;
     1. time out server-initiated requests nobody answered, which is what marks a probed session
        gone (or, where the silence is about the transport rather than the client, discards it);
     2. probe, then warn, sessions drifting toward their deadline;
     3. reap what should go, telling each client on its stream first.
   Step 0 comes first because every step after it reads a wall clock. Reaping comes last so that a
   session found gone in step 1 is freed in the same pass rather than the next.
   Answers the number reaped."
  self probeIdleSessions.
  ^self reapIdleSessions
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
category: 'session lifetime'
method: McpRouter
maxSessionLifetimeSeconds
  "An absolute cap on how long any session may live, however busy, or nil for none (the default).
   Applied at session open as an expiry (McpSession>>expiresAtSeconds:), so unlike idleness it is
   never probed around and never forgiven -- including across a host suspend. An authenticated front
   end tightens the same expiry with the access token's own exp, whichever is sooner."
  ^maxSessionLifetimeSeconds
%
category: 'session lifetime'
method: McpRouter
maxSessionLifetimeSeconds: anIntegerOrNil
  "Cap the absolute lifetime of every session this router opens (nil removes the cap)."
  maxSessionLifetimeSeconds := anIntegerOrNil
%
category: 'server-initiated'
method: McpRouter
nextServerRequestId
  "A fresh id for a request THIS server sends. Its own namespace ('srv-N'), so a server-originated
   id can never be confused with a client-originated one in the pending table or in a log line."
  ^pendingMutex critical: [
    serverRequestCounter := serverRequestCounter + 1.
    'srv-' , serverRequestCounter printString]
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
category: 'routing'
method: McpRouter
noteLogLevelFrom: parsed sessionId: sid
  "Record the level from a logging/setLevel request as it passes through; the request still goes on
   to the worker, which answers it. The front end has to snoop rather than merely route it, because
   the front end is what generates every notifications/message this server sends and owns the stream
   they go down -- a worker gem can do neither.
   A level naming nothing is left alone here and refused by the worker's dispatcher (-32602), so
   there is one validation rather than two answers that could disagree."
  | params level |
  params := parsed at: 'params' ifAbsent: [nil].
  (params isKindOf: Dictionary) ifFalse: [^self].
  level := params at: 'level' ifAbsent: [nil].
  (McpBase isLogLevel: level) ifFalse: [^self].
  (self sessionAt: sid) ifNotNil: [:sess | sess logLevel: level]
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
    serverTitle: self serverTitle;
    serverVersion: self serverVersion;
    prepareWorker.
  "An absolute lifetime cap, where one is configured, becomes an expiry the session carries. A
   subclass may tighten it further (McpAuthRouter, from the access token's exp) but never loosen it."
  self maxSessionLifetimeSeconds ifNotNil: [:secs |
    sess expiresAtSeconds: System timeGmt + secs].
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
category: 'sessions'
method: McpRouter
probeIdleSessions
  "Work the window between 'quiet' and 'reaped' for every session, and answer how many messages went
   out. Two steps per session, a pass apart (see #maintainIdleSession:): a liveness ping first, and
   only for a client that answered it, the warning.
   That order is what makes the warning worth sending. It costs a gem its own transaction view when
   a session is reaped, so a client that is still there deserves the chance to commit -- and a client
   that is not there should not be waited out for the full timeout.
   Iterates a snapshot: a session may be reaped, or a new one registered, while this runs."
  | sent |
  sent := 0.
  (mutex critical: [sessions values asArray]) do: [:sess |
    [(self maintainIdleSession: sess) ifTrue: [sent := sent + 1]]
      on: Error
      do: [:e | self log: 'probeIdleSessions error: ' ,
             ([e description] on: Error do: [:x | e class name asString])]].
  ^sent
%
category: 'session lifetime'
method: McpRouter
probeDue: sess
  "Whether a liveness ping is owed now. One cadence for every session, whatever its idle policy:
   the ping is how idleness is measured, so it has to run for a session with a deadline as well as
   for one without. #touch resets the count, so a client making calls is never pinged.
   Counted in passes rather than seconds -- see #probePassInterval."
  ^sess passesSinceProbe >= self probePassInterval
%
category: 'session lifetime'
method: McpRouter
idleWarningDue: sess
  "Whether to tell this client its session is one confirmation from release. There is no warning
   LEAD to configure any more: the warning goes out when exactly one answered ping remains, which is
   what the lead was always trying to approximate and could get wrong in both directions.
   Only where there is a deadline to warn about, and only once -- #noteIdleWarned, cleared by
   #touch, so a session that goes quiet again is warned again."
  self hasSessionIdleDeadline ifFalse: [^false].
  sess idleWarned ifTrue: [^false].
  ^sess quietProbes >= (self confirmationsBeforeRelease - 1)
%
category: 'server-initiated'
method: McpRouter
retirePendingProbesFor: sess
  "Judge and remove any ping still outstanding for this session, because a newer one is about to
   replace it. Answers how many were retired.
   This is what a pending-request TIMEOUT used to do, without the clock. A ping was counted as
   unanswered the moment it was sent, so an admissible one needs nothing done to it here; an
   inadmissible one -- written to a stream the client has since replaced, so no answer could ever
   have arrived however alive the client is -- has that count taken back. Measured on 2026-08-23,
   stream handover accounted for 6 of 14 pings, so this is not a rare correction."
  | mine |
  mine := pendingMutex critical: [
    | old |
    old := pendingRequests values select: [:e | (e at: 'sessionId') = sess id].
    old do: [:e | pendingRequests removeKey: (e at: 'id') ifAbsent: [nil]].
    old].
  mine do: [:e |
    (self verdictAdmissible: e forSession: sess)
      ifTrue: [sess noteProbeUnanswered]
      ifFalse: [sess noteProbeDiscarded]].
  ^mine size
%
category: 'server-initiated'
method: McpRouter
probeSession: sess
  "Send a server-initiated ping down this session's stream, and answer whether it was queued.
   Ping is bidirectional in MCP -- either party may send it, and the receiver MUST respond promptly
   -- which makes it the one sanctioned way to tell 'the human walked away but the client is alive'
   from 'the client is gone'. There is no MCP method for either question, so nothing is invented
   here that a client would not already understand.
   Retiring the previous ping first is what replaces a timeout. A ping is never declared late by a
   clock; it is simply superseded by the next one, and judged then -- unanswered if it went down the
   stream the client still holds, discarded if the transport had moved on under it."
  self retirePendingProbesFor: sess.
  (self sendRequest: 'ping' params: nil toSession: sess) isNil ifTrue: [^false].
  sess noteProbeSent.
  ^true
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
category: 'session lifetime'
method: McpRouter
reaperIntervalSeconds
  "How often (seconds) the maintenance pass runs: expire unanswered requests, probe and warn sessions
   drifting toward their deadline, reap what should go. Also the unit the suspend detector measures
   its own lateness in (#maintainSessions)."
  ^reaperIntervalSeconds
%
category: 'session lifetime'
method: McpRouter
reaperIntervalSeconds: anInteger
  "Set how often the maintenance pass runs (see the getter)."
  reaperIntervalSeconds := anInteger
%
category: 'session lifetime'
method: McpRouter
lifetimeSummary
  "One line naming every session-lifetime knob in force, for the startup banner.
   A reap is only diagnosable afterwards if the log says what the deadlines actually were. The
   defaults are class-side and the rest arrives as JSON in the fork string, so nothing else on
   disk records what THIS router was told -- and the gem that could answer the question is
   usually the one that has just been restarted to fix whatever raised it."
  | s |
  s := WriteStream on: String new.
  s nextPutAll: 'idle '.
  s nextPutAll: (self hasSessionIdleDeadline
    ifTrue: [self sessionIdleTimeoutSeconds printString , 's']
    ifFalse: ['none']).
  s nextPutAll: ', streamless '; nextPutAll: self streamlessIdleTimeoutSeconds printString.
  s nextPutAll: 's, stream-loss-grace '.
  s nextPutAll: (self streamLossGraceSeconds isNil
    ifTrue: ['none']
    ifFalse: [self streamLossGraceSeconds printString , 's']).
  s nextPutAll: ', probe '; nextPutAll: self livenessProbeIntervalSeconds printString.
  s nextPutAll: 's, expiry-warn-lead '; nextPutAll: self expiryWarningLeadSeconds printString.
  s nextPutAll: 's, reaper '; nextPutAll: self reaperIntervalSeconds printString.
  s nextPutAll: 's, max-life '.
  s nextPutAll: (self maxSessionLifetimeSeconds isNil
    ifTrue: ['none']
    ifFalse: [self maxSessionLifetimeSeconds printString , 's']).
  s nextPutAll: ', reap-on-failed-probe '.
  s nextPutAll: (self reapOnFailedProbe ifTrue: ['yes'] ifFalse: ['no']).
  ^s contents
%
category: 'sessions'
method: McpRouter
reapIdleSessions
  "Close and unmap client sessions whose worker gem should be released, and answer how many. The
   grounds themselves live in #reapReasonFor: -- one place, so the policy can be read in one sitting
   -- and the phrase it answers is what the client is told on its stream (#announceSessionEnd:because:).
   Collect + unmap under the mutex; close (a blocking logout) outside it. Each session is told before
   it goes: a session reaped for idleness is by definition one making no calls, so the stream is the
   only way to reach it."
  | doomed |
  doomed := mutex critical: [
    | found |
    found := OrderedCollection new.
    sessions values do: [:s |
      (self reapReasonFor: s) ifNotNil: [:why | found add: (Array with: s with: why)]].
    found do: [:pair | sessions removeKey: (pair at: 1) id ifAbsent: [nil]].
    found].
  doomed do: [:pair |
    [self announceSessionEnd: (pair at: 1) because: (pair at: 2)] on: Error do: [:e | nil].
    [(pair at: 1) close] on: Error do: [:e | nil]].
  doomed do: [:pair |
    self log: 'Reaped MCP session ' , (pair at: 1) id printString , ' -- ' , (pair at: 2) , '.'].
  ^doomed size
%
category: 'session lifetime'
method: McpRouter
expiryWarningLeadSeconds
  ^expiryWarningLeadSeconds
%
category: 'session lifetime'
method: McpRouter
expiryWarningLeadSeconds: anInteger
  expiryWarningLeadSeconds := anInteger
%
category: 'session lifetime'
method: McpRouter
reapOnFailedProbe
  "Whether a session whose liveness ping went unanswered has its worker gem freed at once, without
   waiting out the idle deadline. True by default, and FORCED true where there is no deadline, since
   with none this is the only thing that would ever end a session.
   Worth turning off where the deadline is already short: it then saves at most (timeout - lead) of
   gem lifetime, which is a modest prize for a verdict drawn from silence. What makes it trustworthy
   at all is that the silence is checked against the stream that carried the ping -- see
   #verdictAdmissible:forSession:."
  self hasSessionIdleDeadline ifFalse: [^true].
  ^reapOnFailedProbe ~~ false
%
category: 'session lifetime'
method: McpRouter
reapOnFailedProbe: aBoolean
  "Whether an unanswered liveness ping is grounds for reaping (see the getter). Ignored -- forced
   true -- when there is no idle deadline."
  reapOnFailedProbe := aBoolean
%
category: 'session lifetime'
method: McpRouter
phraseForSeconds: aSeconds
  "An interval as a phrase for the notice a reaped client is sent -- '30 minutes', '1 minute',
   '90 seconds'. Minutes only where the interval is whole minutes and there is more than one of
   them, because 'over 1 minutes' and 'over 1 minutes' rounded down from 90 seconds are both worse
   than saying the seconds. The notice is often the only account of a reap the operator ever sees,
   so it should say a number they can find in their own configuration."
  | minutes |
  minutes := aSeconds // 60.
  ((minutes > 1) and: [minutes * 60 = aSeconds]) ifTrue: [^minutes printString , ' minutes'].
  aSeconds = 60 ifTrue: [^'1 minute'].
  ^aSeconds printString , ' seconds'
%
category: 'session lifetime'
method: McpRouter
countCovering: aTotalSeconds every: aUnitSeconds
  "How many intervals of aUnitSeconds it takes to COVER aTotalSeconds -- the ceiling of the
   division, never less than one. Every count the reaper derives from a configured interval comes
   through here, and the direction is deliberate. Flooring would make a configured timeout the most
   a deployment could get rather than the least: 150 seconds against a 60-second pass would come out
   at two passes and fire somewhere under two and a half minutes, when the person who wrote 150
   plainly meant not before then. Rounding up costs at most one interval of extra gem lifetime,
   which is cheap; rounding down breaks the promise the number was making."
  ^((aTotalSeconds + aUnitSeconds - 1) // aUnitSeconds) max: 1
%
category: 'session lifetime'
method: McpRouter
realizedProbeIntervalSeconds
  "How far apart the liveness pings ACTUALLY go out, in seconds. #livenessProbeIntervalSeconds is
   what a deployment asked for; this is what the pass cadence can deliver, and they differ whenever
   the one does not divide evenly into #reaperIntervalSeconds. Anything measuring a deadline in
   pings has to count against this one -- see #confirmationsBeforeRelease."
  ^self probePassInterval * self reaperIntervalSeconds
%
category: 'session lifetime'
method: McpRouter
confirmationsBeforeRelease
  "How many liveness pings a client must answer, with no work in between, before its worker gem is
   released. The idle deadline, expressed in the only unit this server can actually observe.
   Derived from the two knobs a deployment sets, so configuration still reads in seconds:
   #sessionIdleTimeoutSeconds of quiet at one ping per #realizedProbeIntervalSeconds. At the
   defaults that is fifteen answered pings -- about thirty minutes of REACHABLE idleness, which is
   what the old wall-clock timeout meant on a host that never slept, and a better thing on one
   that does.
   Against the REALIZED cadence rather than the configured one, which is the difference between a
   deadline that is honoured and one that quietly halves: a 90-second probe interval on a
   60-second pass is really sent every 120 seconds, and dividing the timeout by 90 would count
   fifteen pings where twenty minutes of them had gone by."
  ^self countCovering: self sessionIdleTimeoutSeconds every: self realizedProbeIntervalSeconds
%
category: 'session lifetime'
method: McpRouter
probePassInterval
  "How many maintenance passes apart the liveness pings go out. The pass is this server's clock --
   it ticks only while the front end runs -- so a cadence counted in passes cannot drift because the
   host slept, and needs nobody to notice that it did.
   Rounded up, so a configured interval is the CLOSEST two pings will ever come rather than the
   furthest apart: a 90-second interval on a 60-second pass sends one every 120 seconds, not every
   60. See #realizedProbeIntervalSeconds for what that comes to in seconds, which is what the idle
   deadline is then counted against."
  ^self countCovering: self livenessProbeIntervalSeconds every: self reaperIntervalSeconds
%
category: 'session lifetime'
method: McpRouter
streamLossGraceSeconds
  "How long a session outlives its client closing the event stream, or nil for 'not at all -- leave
   such a client to the streamless floor'. See #defaultStreamLossGraceSeconds for the number and
   #releaseAbandonedSession: for what waits it out.
   Alone among the lifetime knobs this one is a WAIT rather than a measurement, and that is what
   keeps it consistent with everything else here: nothing is inferred from how long it lasted. The
   verdict at the end is drawn afresh from present state -- is a stream open right now -- so a host
   that suspended during the wait reaches the same conclusion as one that did not."
  ^streamLossGraceSeconds
%
category: 'session lifetime'
method: McpRouter
streamLossGraceSeconds: aSecondsOrNil
  "Set the grace a client gets to reopen a stream it closed before its worker gem goes (see the
   getter). nil turns the fast path off."
  streamLossGraceSeconds := aSecondsOrNil
%
category: 'session lifetime'
method: McpRouter
streamlessPassesBeforeRelease
  "How many consecutive passes a session may go with no stream before its gem is released. A client
   that has opened no stream can be asked nothing, so there is no evidence to count and this is the
   one place the server must give up rather than confirm.
   One MORE pass than the timeout divides into, and the extra one is not slack. This count starts at
   the session's first pass, and that pass lands somewhere in the fragment of a reaper interval left
   over from whenever the session happened to open -- so N passes prove only N-1 whole intervals of
   this server running. Without the extra pass a session created just before a pass is released on
   the next one, which at a 60-second timeout is a release after anything from a moment to a minute.
   With it the release comes between the configured timeout and one pass later, which is the reading
   a number in a configuration file invites."
  ^(self countCovering: self streamlessIdleTimeoutSeconds every: self reaperIntervalSeconds) + 1
%
category: 'session lifetime'
method: McpRouter
unansweredProbesBeforeGone
  "How many pings may stand unanswered on the stream the client is still holding before that silence
   is read as death. Three, and the reason is the one thing a count cannot express: a client can be
   frozen while this server runs -- a laptop doing brief maintenance wakes, a paused VM, a stopped
   process -- and answer every one of those pings late. Requiring three consecutive misses on the
   CURRENT stream means a single interruption cannot condemn a client that is merely not scheduled.
   Not configurable: it is the width of evidence this verdict needs, not a deployment policy."
  ^3
%
category: 'sessions'
method: McpRouter
releaseAbandonedSession: sess
  "A client has been seen to close its own event stream. Give it #streamLossGraceSeconds to open
   another, and if it does not, free its worker gem now rather than at the streamless floor.
   This exists because the front end already KNOWS, within one poll of the drain loop, something no
   count can tell it: not that a client has gone quiet, but that its connection ended. Discarding
   that and waiting out a floor meant for a client which was never reachable is what left a closed
   VS Code tab holding a gem, and a transaction view, for half an hour.
   Runs in the ending stream's own GsProcess, whose socket is dead and whose only remaining job is
   to be closed -- so the wait costs nothing and needs no second process to hold it. The grace is
   waited out BEFORE the fact is recorded, which is what keeps a clock out of #reapReasonFor: --
   by the time the flag is set it already means 'the client did not come back', not 'the client
   left just now'. A reap pass is then run off-cadence; it advances no counts (only #maintainIdleSession:
   does that), so it applies the standing policy early without disturbing any other session's."
  | grace stamp |
  grace := self streamLossGraceSeconds.
  grace isNil ifTrue: [^self].
  stamp := sess lastActivitySeconds.
  grace > 0 ifTrue: [(Delay forSeconds: grace) wait].
  ^self releaseAbandonedSession: sess unlessActiveSince: stamp
%
category: 'sessions'
method: McpRouter
releaseAbandonedSession: sess unlessActiveSince: aStamp
  "The verdict half of #releaseAbandonedSession:, reached once the grace has been waited out: free
   this session's worker gem unless the client has shown, in any of the ways it can, that it is
   still there. Separate from the wait so that 'the client called while we were waiting' is a state
   a test can put a session into, rather than one it would have to win a race to produce.
   Three ways to survive. A new stream is the one the grace was written for -- a handover that closed
   before it reopened -- though it is claimed far less often than that suggests; see
   #defaultStreamLossGraceSeconds for what a shut editor tab actually does. A call in flight is the
   second. The third is the one that is easy to leave out and
   expensive to: a client is not obliged to hold a stream AT ALL, and one that is calling tools is
   alive on far better evidence than anything the transport can offer. Without it, a client whose
   stream dropped and which did not reopen one would lose its gem ten seconds later, mid-
   conversation, where #streamlessIdleTimeoutSeconds used to give it minutes. Comparing the activity
   stamp rather than reading a clock keeps the question answerable: not how long ago the client
   called, only whether it called at all while we waited.
   Setting the flag and reaping, rather than reaping directly, closes the last window: the ground is
   evaluated inside #reapIdleSessions' mutex, and a request arriving in the meantime clears the flag
   through McpSession>>touch, so the session survives a race it would otherwise lose."
  sess outbox hasStream ifTrue: [^self].
  sess isBusy ifTrue: [^self].
  sess lastActivitySeconds = aStamp ifFalse: [^self].
  sess noteStreamClosedByClient.
  self reapIdleSessions.
  ^self
%
category: 'sessions'
method: McpRouter
reapReasonFor: sess
  "Why this session's worker gem should be released now -- as the phrase the client is told on its
   stream -- or nil to keep it. The whole reaping policy, in one place.
   A session with a call in flight is never reaped on any ground, however long it has run:
   McpSession>>forward: stamps the activity clock when the call STARTS, so a request that outlives
   its session would otherwise have its worker logged out from under it.
   Most grounds below are a COUNT of things this front end observed -- pings it sent and answers it
   did or did not get, passes on which there was no stream. None of them can advance while the server
   is not running, so a suspended host cannot manufacture any of them, and there is no suspend to
   detect. Two grounds are deliberate exceptions, for opposite reasons: an expiry is wall-clock
   because a credential is, and no amount of the server being asleep makes an expired token valid;
   a closed stream is one observed FACT rather than a count, and needs no repetition to be believed.
     - EXPIRY is absolute, and the only clock here.
     - A CLOSED STREAM is the client's own connection ending, watched by the drain loop
       (McpSession>>noteStreamClosedByClient). The flag is only set once the grace has passed with
       no reconnect, and it is paired here with 'and no stream is open now' so that a client which
       reopened in the meantime -- or reconnected after the flag was set -- is never taken on the
       strength of a connection it has already replaced.
     - FAILED PINGS are evidence rather than absent traffic: they went down a stream the client
       itself opened and is still holding.
     - IDLENESS is confirmations -- pings the client answered while doing no work. It applies only
       where a deadline is configured.
     - NO STREAM AT ALL is the give-up rule: liveness cannot speak for a client it cannot reach."
  sess isBusy ifTrue: [^nil].
  sess isExpired ifTrue: [^'its access credential expired'].
  (sess streamClosedByClient and: [sess outbox hasStream not])
    ifTrue: [^'its client closed the event stream and did not reopen one'].
  (self reapOnFailedProbe and: [sess unansweredProbes >= self unansweredProbesBeforeGone])
    ifTrue: [^'it did not answer ' , self unansweredProbesBeforeGone printString
      , ' liveness pings in a row'].
  (self hasSessionIdleDeadline and: [sess quietProbes >= self confirmationsBeforeRelease])
    ifTrue: [^'it was idle for ' , (self phraseForSeconds: self sessionIdleTimeoutSeconds)
      , ' of liveness checks'].
  sess streamlessPasses >= self streamlessPassesBeforeRelease
    ifTrue: [^'no event stream was open to ping it for over '
      , (self phraseForSeconds: self streamlessIdleTimeoutSeconds)].
  ^nil
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
category: 'server-initiated'
method: McpRouter
resolvePendingRequest: anId forSession: sess
  "Match a client's POSTed JSON-RPC response to the request this server sent it. Answers the pending
   entry, or nil for an id we are not waiting on -- a duplicate, a late answer to a request already
   timed out, or one we never issued. Those are ignored rather than refused: a client must not be
   made to fail because the server has forgotten.
   Today the only server-initiated request is the liveness ping, and ANY answer to it -- result or
   error -- proves the client is there, which is all #noteAlive claims. Note what it does not do:
   stamp the activity clock. Liveness spares the gem an early reap and earns a warning; only real
   MCP traffic (#touch) restarts the idle cycle."
  | entry |
  anId isNil ifTrue: [^nil].
  entry := pendingMutex critical: [pendingRequests removeKey: anId ifAbsent: [nil]].
  entry isNil ifTrue: [^nil].
  sess noteAlive.
  ^entry
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
  self validateTimerConfig.
  serverSocket := self makeListenerOnPort: aPort.
  isRunning := true.
  self forkReaper.
  self log: self class name asString , ' listening on ' ,
    (self tlsEnabled ifTrue: ['https'] ifFalse: ['http']) , '://' , self bindAddress , ':' , aPort printString.
  self log: 'workers: ' , self effectiveWorkerClassName , ', toolsets: ' ,
    (self effectiveToolsetNames isEmpty
      ifTrue: ['(none -- this router offers no tools)']
      ifFalse: [self effectiveToolsetNames inject: '' into: [:a :b | a isEmpty ifTrue: [b] ifFalse: [a , ' ' , b]]]).
  self log: 'session lifetime: ' , self lifetimeSummary.
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
category: 'server-initiated'
method: McpRouter
sendRequest: aMethodString params: aDictOrNil toSession: sess
  "Queue a server-initiated JSON-RPC REQUEST on sess's stream and record it as pending, so the
   client's answer can be correlated back to it. Answers the id, or nil if the outbox would not take
   the message (closed or closing), in which case nothing is left pending to time out.
   The answer does not come back on the stream: the client POSTs a JSON-RPC response to /mcp, which
   is why the pending table exists at all and why servePost: has to recognize a body with an id and
   no method."
  | rid entry |
  rid := self nextServerRequestId.
  entry := Dictionary new.
  entry at: 'id' put: rid.
  entry at: 'method' put: aMethodString.
  entry at: 'sessionId' put: sess id.
  entry at: 'sentAt' put: System timeGmt.
  "WHICH STREAM this is about to go down. A message is written to exactly one stream, and the client
   may replace that stream at any moment, so silence afterwards means 'the client is gone' only if
   this generation is still the current one when the timeout fires -- see #expirePendingRequests."
  entry at: 'streamGeneration' put: sess outbox currentStreamGeneration.
  "'origin' distinguishes a request the ROUTER asked -- resolved here, as ping is -- from one a
   worker gem asked (elicitation, sampling), whose answer would have to be delivered back INTO that
   gem while its GCI call is already in flight. Nothing originates in a worker yet: that needs a
   bidirectional worker channel, which is why those two scenarios sit last in the plan."
  entry at: 'origin' put: 'router'.
  pendingMutex critical: [pendingRequests at: rid put: entry].
  (sess outbox add: (self request: aMethodString params: aDictOrNil id: rid) asJson) ifFalse: [
    pendingMutex critical: [pendingRequests removeKey: rid ifAbsent: [nil]].
    ^nil].
  ^rid
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
serveClientResponse: parsed sessionId: sid on: conn
  "A JSON-RPC RESPONSE the client POSTed: its answer to a request THIS server sent on the SSE stream
   (today only ping). It carries an id and no method, which is what tells it from a request.
   Per the Streamable HTTP spec a POST carrying only responses or notifications MUST be answered with
   202 Accepted and no body. Before this existed, such a body fell through to the worker, whose
   dispatcher saw no method and answered -32600 Invalid Request with a 200 -- so a client's reply to
   a server ping came back to it as an error.
   Session gates are the same as on every other verb, so a client gets one consistent signal."
  | sess |
  sid isNil ifTrue: [
    ^self writeSessionError: 'Missing MCP-Session-Id header (call initialize first)' code: 400 reason: 'Bad Request' on: conn].
  sess := self sessionAt: sid.
  sess isNil ifTrue: [
    ^self writeSessionError: 'Unknown or expired session: ' , sid code: 404 reason: 'Not Found' on: conn].
  self resolvePendingRequest: (parsed at: 'id' ifAbsent: [nil]) forSession: sess.
  conn writeStatus: 202 reason: 'Accepted' body: ''
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
  "Dispatch a GET: open the standalone SSE stream for the session named by the MCP-Session-Id
   header. Subclasses may branch on the request path first (McpAuthRouter serves Protected Resource
   Metadata at a well-known path).
   The stream is SESSION-SCOPED, and the same 400/404 rules apply as on the POST and DELETE paths.
   It has to be: a stream the server cannot name a session for can be attached to no outbox, and it
   also outlived its session -- once the reaper dropped a session and logged out its gem, nothing
   touched that client's GET socket, so the keepalives went on advertising a healthy stream over a
   worker that no longer existed.
   None of that is the credential gate, which runs earlier: route:on: applies requestAuthorized:on:
   to every verb before dispatching it, so on McpAuthRouter an anonymous GET is refused 401 and
   never arrives here. Easy to misread from McpAuthRouter>>serveGet: alone, which only intercepts
   the metadata path and otherwise falls through to this method."
  | sid sess |
  sid := self sessionIdOf: req.
  sid isNil ifTrue: [
    ^self writeSessionError: 'Missing MCP-Session-Id header (call initialize first)' code: 400 reason: 'Bad Request' on: conn].
  sess := self sessionAt: sid.
  sess isNil ifTrue: [
    ^self writeSessionError: 'Unknown or expired session: ' , sid code: 404 reason: 'Not Found' on: conn].
  ^self serveGetStream: conn forSession: sess
%
category: 'running'
method: McpRouter
runStreamLoop: conn forSession: sess generation: aGeneration
  "Drain sess's outbox onto conn until this stream ends, and answer WHY -- true if the client's own
   connection went away, false if the stream ended for any reason of this server's: a newer GET
   superseded it, the session was reaped, or the router stopped.
   That distinction is the whole reason this is a method of its own rather than a block inside
   #serveGetStream:forSession:. Every exit is a non-local return, so the answer is the one thing
   that survives the unwind, and #releaseAbandonedSession: is entitled to act on it only because
   'the client left' cannot be confused here with 'we ended it'.
   Yields on every tick, so holding a stream open costs the gem nothing: the accept loop, the reaper
   and other sessions' streams all keep running. That was not true while forwarding blocked -- every
   open stream's keepalive froze for the length of the longest tool call, which is exactly when an
   intermediary is most likely to drop the connection (fixed by McpSession>>runWorker:)."
  | outbox lastKeepalive |
  outbox := sess outbox.
  lastKeepalive := System timeGmt.
  (conn writeSseComment: 'connected') ifNil: [^true].
  [self isRunning and: [outbox isOpen and: [outbox isCurrentStream: aGeneration]]] whileTrue: [
    (self drainOutbox: outbox to: conn) ifFalse: [^true].
    "A closing outbox has just had its last messages written -- the session-ending notice among
     them -- so the stream ends here, cleanly, rather than the client being cut off with the gem."
    outbox isClosing ifTrue: [outbox close. ^false].
    (System timeGmt - lastKeepalive >= self keepaliveIntervalSeconds) ifTrue: [
      (conn writeSseComment: 'keepalive') ifNil: [^true].
      lastKeepalive := System timeGmt].
    conn clientHasClosed ifTrue: [^true].
    (Delay forMilliseconds: self streamPollMilliseconds) wait].
  ^false
%
category: 'running'
method: McpRouter
serveGetStream: conn forSession: sess
  "Hold the standalone MCP SSE stream open for one session, and act on how it ends.
   The loop itself is #runStreamLoop:forSession:generation:, which answers whether the CLIENT went
   away. When it did, the session gets #releaseAbandonedSession: -- the front end knows within one
   poll that this client's connection ended, and there is no reason to make its worker gem wait out
   a floor written for a client that was never reachable.
   Sending #noteStreamSeen on the way in matters as much as anything on the way out: it is what
   makes a reconnect retract a departure that has already been noticed, without waiting for a
   maintenance pass to observe the new stream."
  | outbox generation |
  (conn writeSseStreamHeaders) ifNil: [^self].
  outbox := sess outbox.
  generation := outbox attachStream.
  sess noteStreamSeen.
  ([self runStreamLoop: conn forSession: sess generation: generation]
    ensure: [outbox detachStream: generation])
      ifTrue: [self releaseAbandonedSession: sess].
  ^self
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
   worker (an isolated session). A valid id is required for non-initialize requests. Forwarding does
   not block the front-end gem (McpSession>>runWorker:), so requests from different clients really do
   run concurrently -- serve: already gives each connection its own GsProcess; the id -> session map
   is guarded by the mutex, and one client's worker by that session's own. Only enough of the body is parsed
   here to route it (is it initialize? is it well-formed?); full request handling is the worker's."
  | body parsed method |
  body := req at: 'body' ifAbsent: [''].
  parsed := self parseBody: body.
  parsed isNil ifTrue: [^self writeParseError: conn].
  method := parsed at: 'method' ifAbsent: [nil].
  "A body with an id and NO method is a JSON-RPC response: the client answering a request this
   server sent on its stream. It is not routable -- the worker's dispatcher would answer it
   -32600 -- so it is correlated here and acknowledged with 202."
  (method isNil and: [parsed includesKey: 'id'])
    ifTrue: [^self serveClientResponse: parsed sessionId: (self sessionIdOf: req) on: conn].
  method = 'initialize' ifTrue: [^self serveInitialize: req on: conn].
  "logging/setLevel is snooped on its way past and still forwarded -- the worker answers it, but the
   front end is what generates log notifications, so the front end is where the level must land."
  method = 'logging/setLevel' ifTrue: [self noteLogLevelFrom: parsed sessionId: (self sessionIdOf: req)].
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
serverTitle
  "The serverInfo title this router's workers advertise -- the human-readable label for THIS
   deployment ('GemStone - geode teststone 3.7.6'), which is what an operator running two instances of
   one product sets rather than relabeling serverName. nil (the default) means no instance label, and
   the title key is left out of serverInfo entirely -- see McpServer>>serverTitle."
  ^serverTitle
%
category: 'worker identity'
method: McpRouter
serverTitle: aStringOrNil
  serverTitle := aStringOrNil
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
category: 'session lifetime'
method: McpRouter
sessionIdleTimeoutSeconds
  "Idle time (seconds) after which a client session's worker gem is released, or NIL for no
   wall-clock deadline at all. 30 minutes by default.
   nil is a deliberate setting, not an oversight, and it is not the same as unpoliced: with no
   deadline a session lives exactly as long as its client keeps answering liveness pings -- which is
   the client asserting, on a stream it opened itself, that it still wants that gem and the
   uncommitted work in it. What makes that safe is the pair of things that come with it: a failed
   probe always reaps (#reapOnFailedProbe), and a client that never opens a stream, and so can never
   be pinged, still falls back to #streamlessIdleTimeoutSeconds.
   Worth knowing before choosing it: on GemStone an idle session is not free. Each worker is a gem
   sitting in a transaction, so it pins a repository view and holds back page reclamation -- a
   forgotten session is extent growth, not merely an idle process. The front end cannot fix that for
   the client either: aborting the worker's transaction would discard exactly the uncommitted work
   this whole pathway exists to protect."
  ^sessionIdleTimeoutSeconds
%
category: 'session lifetime'
method: McpRouter
sessionIdleTimeoutSeconds: anIntegerOrNil
  "Set the idle deadline for this router's sessions, or nil for none (see the getter). Consistency
   with the other intervals is checked at startup, in #validateTimerConfig."
  sessionIdleTimeoutSeconds := anIntegerOrNil
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
category: 'session lifetime'
method: McpRouter
streamlessIdleTimeoutSeconds
  "The idle deadline that still applies to a client which never opened an SSE stream, when there is
   no ordinary deadline. Such a client cannot be pinged -- pinging it would record an unanswered
   probe and reap its gem early for the sole offence of not opening a stream -- so liveness can say
   nothing about it, and this is the only thing that can ever free its gem.
   Ignored while #sessionIdleTimeoutSeconds is set: that deadline already covers every session, and
   a second, quieter one for a subset would be a surprise rather than a safeguard."
  ^streamlessIdleTimeoutSeconds
%
category: 'session lifetime'
method: McpRouter
streamlessIdleTimeoutSeconds: anInteger
  "Set the fallback deadline for clients that open no stream (see the getter)."
  streamlessIdleTimeoutSeconds := anInteger
%
category: 'running'
method: McpRouter
streamPollMilliseconds
  "How long a drain loop sleeps between ticks. It is a Delay, so it YIELDS -- that is what lets the
   accept loop, the reaper and every other stream keep running while this one is held open. A
   latency/wakeup tradeoff: 100ms puts a notification on the wire promptly without spinning."
  ^100
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
validateSeconds: aValue named: aName allowingNil: aBoolean
  "Check one configured interval, raising with the offending name and value. Used by
   #validateTimerConfig so a bad number is reported once, in words, at startup."
  aValue isNil ifTrue: [
    aBoolean ifTrue: [^self].
    ^self error: aName , ' must be a positive number of seconds, and is nil.'].
  ((aValue isKindOf: Number) and: [aValue > 0]) ifFalse: [
    ^self error: aName , ' must be a positive number of seconds, and is ' , aValue printString , '.'].
  ^self
%
category: 'config'
method: McpRouter
validateTimerConfig
  "Check the session-lifetime intervals against each other BEFORE binding a port (runOnPort:), so a
   combination that cannot work fails at startup with a clear message instead of silently never
   warning anybody -- the same bargain #validateWorkerConfig makes for the worker class.
   Both invariants have the same shape, and both follow from the reaper counting rather than timing:
   each derived count is a division, and #countCovering:every: rounds it up so that a configured
   interval is a floor on what a deployment gets rather than a ceiling. That rounding is honest for
   a remainder and dishonest for a whole interval: an interval shorter than a pass rounds up to a
   pass, which is not the number that was written down. A probe interval shorter than a pass, or an
   idle timeout shorter than a probe interval, is a configuration someone got wrong and should hear
   about rather than have silently multiplied."
  self validateSeconds: sessionIdleTimeoutSeconds named: 'sessionIdleTimeoutSeconds' allowingNil: true.
  self validateSeconds: maxSessionLifetimeSeconds named: 'maxSessionLifetimeSeconds' allowingNil: true.
  self validateSeconds: self streamlessIdleTimeoutSeconds named: 'streamlessIdleTimeoutSeconds' allowingNil: false.
  "Checked here rather than through #validateSeconds:named:allowingNil:, which insists on a POSITIVE
   number. Zero is meaningful for this one alone and for nobody else: every other interval is a
   period, where zero would be a rule that fires continuously, but this is a WAIT, and a wait of no
   time is the coherent request 'release the gem the moment the socket closes, without pausing for a
   reconnect'. nil is the different instruction: do not release it this way at all."
  streamLossGraceSeconds isNil ifFalse: [
    ((streamLossGraceSeconds isKindOf: Number) and: [streamLossGraceSeconds >= 0]) ifFalse: [
      ^self error: 'streamLossGraceSeconds must be nil, or zero, or a positive number of seconds, '
        , 'and is ' , streamLossGraceSeconds printString , '.']].
  self validateSeconds: self livenessProbeIntervalSeconds named: 'livenessProbeIntervalSeconds' allowingNil: false.
  self validateSeconds: self reaperIntervalSeconds named: 'reaperIntervalSeconds' allowingNil: false.
  self validateSeconds: self expiryWarningLeadSeconds named: 'expiryWarningLeadSeconds' allowingNil: false.
  self livenessProbeIntervalSeconds >= self reaperIntervalSeconds ifFalse: [
    ^self error: 'livenessProbeIntervalSeconds (' , self livenessProbeIntervalSeconds printString
      , 's) is shorter than reaperIntervalSeconds (' , self reaperIntervalSeconds printString
      , 's), so a ping cannot be sent less than one maintenance pass apart.'].
  self streamlessIdleTimeoutSeconds >= self reaperIntervalSeconds ifFalse: [
    ^self error: 'streamlessIdleTimeoutSeconds (' , self streamlessIdleTimeoutSeconds printString
      , 's) is shorter than reaperIntervalSeconds (' , self reaperIntervalSeconds printString
      , 's), which is the shortest span the maintenance pass can measure, so the timeout would be '
      , 'rounded up to one pass and never honoured as written.'].
  self hasSessionIdleDeadline ifFalse: [^self].
  self sessionIdleTimeoutSeconds >= self livenessProbeIntervalSeconds ifFalse: [
    ^self error: 'sessionIdleTimeoutSeconds (' , self sessionIdleTimeoutSeconds printString
      , 's) is shorter than livenessProbeIntervalSeconds (' , self livenessProbeIntervalSeconds printString
      , 's), so a session would be released before its client could be asked anything. Raise the '
      , 'timeout, or lower livenessProbeIntervalSeconds to match.'].
  ^self
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
category: 'server-initiated'
method: McpRouter
verdictAdmissible: aPendingEntry forSession: sess
  "Whether the silence following aPendingEntry is evidence about the CLIENT rather than about the
   transport. It is, only if the stream that carried the request is still attached AND still the one
   entitled to drain this session's outbox: an unanswered ping means 'gone' only if it was written to
   the stream the client is still on.
   An entry with no recorded generation was queued with no stream attached at all, and can prove
   nothing either."
  | gen |
  gen := aPendingEntry at: 'streamGeneration' ifAbsent: [nil].
  gen isNil ifTrue: [^false].
  ^sess outbox hasStream and: [sess outbox isCurrentStream: gen]
%
category: 'server-initiated'
method: McpRouter
warnIdleSession: sess
  "Warn a client that its session is one liveness check away from release, and answer whether the
   warning was queued. Sent to a client that has just answered a ping, so it is known to be there.
   MCP has no 'you are idle' method, and inventing one would produce a message every client ignores.
   notifications/message (the logging utility) is the sanctioned generic carrier."
  (self enqueueLog: 'This MCP session will be released after one more liveness check with no '
      , 'activity. Its GemStone worker gem holds its own transaction view, so any uncommitted '
      , 'changes will be lost -- commit them, or make any call (status is enough), to keep it.'
    level: 'warning' toSession: sess) ifFalse: [^false].
  sess noteIdleWarned.
  ^true
%
category: 'sessions'
method: McpRouter
expiryWarningDue: sess
  "Whether it is time to tell this client its session is nearing its ABSOLUTE deadline -- the one
   that activity cannot postpone. Unlike #warningDue: this applies whatever the idle policy is,
   including none: a session with no idle deadline can still carry a credential's exp, and that is
   exactly the case where nothing else would ever warn it.
   In seconds, unlike the idle warning, and that asymmetry is the point: this deadline IS a
   wall-clock fact, so seconds are its natural unit. Idleness is not, which is why it is counted in
   answered pings and needs no lead at all -- see #idleWarningDue:."
  sess expiryWarned ifTrue: [^false].
  ^sess secondsUntilExpiry
    ifNil: [false]
    ifNotNil: [:left | left <= self expiryWarningLeadSeconds]
%
category: 'sessions'
method: McpRouter
warnExpiringSession: sess
  "Tell a client its session is about to reach its absolute deadline, and answer whether the warning
   was queued. The advice differs by what imposed the deadline, so it comes from #expiryAdviceFor:.
   Warned once per deadline, not once per session: #renewExpiryTo: clears the flag, so a session
   whose credential is refreshed is warned again before the new expiry."
  | minutes |
  minutes := (sess secondsUntilExpiry // 60) max: 0.
  (self enqueueLog: 'This MCP session reaches its time limit in about ' , minutes printString ,
      ' minute(s), whether or not it is being used. Its GemStone worker gem will be released and '
      , 'any uncommitted changes in it lost. ' , (self expiryAdviceFor: sess)
    level: 'warning' toSession: sess) ifFalse: [^false].
  sess noteExpiryWarned.
  ^true
%
category: 'sessions'
method: McpRouter
expiryAdviceFor: sess
  "What this client can usefully do about an approaching absolute deadline. Here, nothing: the only
   expiry a plain router imposes is #maxSessionLifetimeSeconds, which is a cap on the session
   itself and cannot be extended by anything the client does. Saying so is the point -- the idle
   warning tells a client to make a call, and repeating that advice here would be wrong."
  ^'This limit is a fixed cap on session length and cannot be extended; commit anything you need '
    , 'to keep, then send initialize for a fresh session.'
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
