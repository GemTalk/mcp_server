set compile_env: 0
! ------------------- Class definition for McpRouter
expectvalue /Class
doit
McpBase subclass: 'McpRouter'
  instVarNames: #( isRunning mutex routesTable
                    serverSocket sessions allowedOriginHosts tlsCertificateFile
                    tlsPrivateKeyFile readOnly workerClassName toolsetNames
                    toolsetOptions serverName serverTitle serverVersion
                    pendingRequests pendingMutex serverRequestCounter sessionIdleTimeoutSeconds
                    streamlessIdleTimeoutSeconds livenessProbeIntervalSeconds reaperIntervalSeconds maxSessionLifetimeSeconds
                    reapOnFailedProbe streamLossGraceSeconds messageTrace messageTraceLimit
                    requestTimeoutSeconds callChannels callMutex callCounter
                    frontEndTransactionMode maxCommitsBehind sessionAccessWarned)
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
transaction view, so reaping one discards uncommitted work -- and a client is now PINGED rather
than merely waited out, so an unreachable client''s gem goes quickly and a reachable one''s is kept.
Owning the stream also means owning the moment it CLOSES, which is the other half of the same story:
a client that hangs up is seen to, rather than inferred from silence, and its gem is released in
seconds instead of waiting out a floor meant for a client that was never reachable
(#releaseAbandonedSession:).

IMPORTANT: runOnPort: is BLOCKING and is meant to be the main activity of a dedicated gem. Forked
GsProcesses only run while the gem is actively executing Smalltalk, so a background fork in an idle
GCI session would never serve requests.

IMPORTANT: FRONT-END CODE MUST NOT READ PERSISTENT OBJECT GRAPHS. A detached front-end gem runs
#transactionless (frontEndTransactionMode), so it holds no view worth the name: the view moves under
it once per maintenance pass, by design (#refreshFrontEndView). That is deliberate -- this class
makes no repository changes at all, and one left in transaction was measured holding the stone''s
oldest commit record with its last transaction boundary being its own login 15 hours earlier, which
nothing stone-side could ever have cleared. The price is the mode''s documented one: a transactionless
session "may scan database objects, but is at risk of obtaining inconsistent views". Everything here
today is safe under that rule -- stone primitives, lookups by name, and the worker gems'' own state
asked for over GCI -- and new front-end code must stay so: walk no committed collection, and cache no
persistent object across statements. Anything that needs a stable view belongs in a worker gem.
The corollary, and it cuts both ways: a COMMITTED recompile of a front-end method does take effect in
a running front end, within one maintenance pass.

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
Trace what clients SEND, to the gem log (off by default). An MCP client''s UI generally shows tool
names and not the text of the JSON-RPC message it sent, so when a call goes wrong there is often no
record of the arguments anywhere; this is that record. The tap is in handleConnection:, before the
transport and credential gates, so a refused request is traced too. Headers are never traced -- one
of them is a bearer token:
    (McpRouter new messageTrace: true) forkOnPort: 8000
    (McpRouter new messageTrace: true; messageTraceLimit: nil) forkOnPort: 8000   "no body cap"
Keep the detached front end IN TRANSACTION, the way it behaved before view hygiene existed. It will
pin a commit record for as long as it runs, and nothing on the stone can push its view along; the
reason to want it is the paragraph above, if front-end code of your own needs a stable view:
    (McpRouter new frontEndTransactionMode: ''autoBegin'') forkOnPort: 8000

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
category: 'transaction mode'
classmethod: McpRouter
defaultFrontEndTransactionMode
  "The GemStone transaction mode a DETACHED front-end gem puts itself in: 'transactionless'.
   A front end has no use for a view. It owns the socket, the session map and the reaper; it makes no
   repository changes (no committed state of any kind, and no commit/abort/begin anywhere in this
   class before this one); and every database thing it does is a stone primitive or a lookup by name.
   A view it never moves is not neutral, though -- it is a commit record the stone cannot dispose of.
   Measured on a live stone: a front end in transaction was the sole holder of the oldest commit
   record, its last transaction boundary its own login 15.4 hours earlier, and nothing was ever going
   to move it (an IN-transaction gem is immune to sigAbort unless it has called
   #enableSignaledFinishTransactionError, and the workers are in transaction by design too).
   'autoBegin' is the escape hatch; see the class comment for the constraint this default puts on
   front-end code."
  ^'transactionless'
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
category: 'view hygiene'
classmethod: McpRouter
defaultMaxCommitsBehind
  "How far behind the repository a worker gem's view may fall before this server refreshes it: 20
   commits.
   The number is borrowed rather than invented. StnSignalAbortCrBacklog, the stone's own trigger for
   sigAborting a gem that is holding the oldest commit record, defaults to 20 -- so this says 'as
   patient as the stone is, and no more'. It is a PROXY and not the same quantity: the stone counts
   the whole repository's backlog, where this counts one session's distance from the current state
   (descriptionOfSession: field 16). What licenses reading one as the other is the practical
   observation that a session 20 commits behind is plausibly the reason the backlog is 20.
   For scale, measured on db-1 the moment view hygiene was first deployed: the front end that had
   never moved its view was 489 commits behind, with a stone backlog of 490. 20 is not a
   conservative number."
  ^20
%
category: 'message trace'
classmethod: McpRouter
defaultMessageTraceLimit
  "How much of a traced message body is written, in characters. 4096: enough for every routing
   message and for the tool calls an operator is usually chasing, and short enough that one runaway
   client cannot fill the log volume. What it truncates is the tail of a large source argument --
   a compile_method body, an execute_code block -- and the trace says how much it dropped, so a
   reader can tell a long message from a lost one. nil means no cap at all; see
   McpRouter>>messageTraceLimit:."
  ^4096
%
category: 'session lifetime defaults'
classmethod: McpRouter
defaultReaperIntervalSeconds
  "How often the maintenance pass runs. 60 seconds."
  ^60
%
category: 'session lifetime defaults'
classmethod: McpRouter
defaultRequestTimeoutSeconds
  "How long one request may run in a client's worker gem before the server ends it and answers an
   error. NO LIMIT by default.
   It was 45 seconds, chosen to sit under what an MCP client will wait -- the clients seen so far
   give up around a minute, and a limit above theirs is no limit at all. What that number really
   was, though, is a GUESS at the moment nobody is waiting for the answer any more, made by a server
   with no way to find out. What replaces the guess is knowing: a call that asked to be kept informed
   is answered on a stream it can report progress down (#serveStreamedCall:id:forSession:on:), and a
   client that stops waiting can say so -- by a notifications/cancelled, or by closing that stream --
   which ends the call at the moment it stops being wanted. A deadline approximates that; a cancel
   signal knows it. Prefer the signal. (The stream is here; the progress on it and the cancel
   triggers that read it are being built on top of it.)
   And the guess was not even conservative in the direction it was meant to be. Measured 2026-08-31
   against a live server: Claude Code ran a 150-second tool call to completion, with no progress
   notifications on it, and took delivery of the answer -- so the client patience the number was
   fitted to is not what it was taken to be, while the limit itself was real.
   The cost of the guess fell in the wrong place, too. A 45-second limit does not cut off runaways so
   much as legitimate slow work -- a full suite run, a large fileIn, a broad search -- which is
   exactly the work progress notifications exist to make watchable. A server that can do a thing but
   refuses to finish it is worse than one that takes a while.
   What nil gives up is the guarantee that a runaway ever ends on its own, so set a number where the
   clients are unknown or cannot be trusted to cancel. Ending a request costs the client that request
   and nothing else: the worker is interrupted and stays usable, so the session, and the uncommitted
   work in it, survive (McpSession>>endCallBecause:)."
  ^nil
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
category: 'transaction mode'
classmethod: McpRouter
frontEndTransactionModes
  "The values #frontEndTransactionMode: accepts. Each is the NAME of a GemStone transaction mode, and
   converts to the symbol System class>>transactionMode: takes with #asSymbol.
   #manualBegin is deliberately not offered: it differs from #autoBegin only in when a transaction
   begins, which is a distinction only a session that writes can spend -- and it would give this
   class a third state to reason about for nothing."
  ^#('transactionless' 'autoBegin')
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
   class, apply the serialized config, put the gem in its configured transaction mode, and run its
   blocking accept loop.
   The transaction mode is set HERE and in no other entry point, because this is the only one that
   owns its session outright: the gem was forked to evaluate this expression and does nothing else
   afterwards. Every other way in runs in somebody's session -- #forkOnPort: in the launching one,
   the instance #runOnPort: in an interactive topaz -- and #applyFrontEndTransactionMode aborts on
   the way in, which in a caller's session would silently discard their uncommitted work."
  | router |
  router := self new applyConfigJson: aJsonString.
  router applyFrontEndTransactionMode.
  ^router runOnPort: aPort
%
! ------------------- Instance methods for McpRouter
category: 'routing'
method: McpRouter
acceptsEventStream: req
  "Whether this request's Accept header offers to take an SSE stream as the answer.
   The spec REQUIRES a client to list both application/json and text/event-stream, and both clients
   do, so this is not really a capability check -- it is what keeps a hand-rolled caller that asked
   for JSON from being handed a stream it cannot read. curl without an Accept header, and every
   check in test.sh, stay on the plain-JSON path.
   Header keys arrive lower-cased (McpHttpConnection>>parseHead:); the VALUE is lower-cased here
   because a media type is case-insensitive and #includesString: would answer this one either way --
   being explicit costs nothing and says which it meant."
  | accept |
  accept := (req at: 'headers' ifAbsent: [Dictionary new]) at: 'accept' ifAbsent: [nil].
  accept isNil ifTrue: [^false].
  ^(accept asLowercase indexOfSubCollection: 'text/event-stream') > 0
%
category: 'progress'
method: McpRouter
acceptWorkerSignal: aSignal
  "Turn one InterSessionSignal from a worker gem into a queued notifications/progress for the client
   that asked for it. Every failure here is a DROP, never a raise: this runs in the poller's
   GsProcess, which serves every session, so one malformed payload must not stop the others being
   delivered.
   Four ways a tick is dropped, and only the second is worth a log line:
     no payload -- something signalled this gem that is not a progress tick;
     unparseable payload -- a worker built one wrong, which is a defect and should be visible;
     unknown callId -- the call ended while the tick was in flight. Entirely normal, and the reason
       the channel map is the authority on what is still live rather than the worker;
     non-increasing progress -- refused by the channel, which owes the client a conforming stream."
  | payload parsed channel |
  payload := self payloadOfSignal: aSignal.
  payload isNil ifTrue: [^self].
  parsed := self parseBody: payload.
  parsed isNil ifTrue: [
    ^self log: 'Discarded an unparseable progress payload from a worker gem: ' , payload].
  channel := self channelAt: (parsed at: 'c' ifAbsent: [nil]).
  channel isNil ifTrue: [^self].
  (channel noteProgress: (parsed at: 'p' ifAbsent: [nil])) ifFalse: [^self].
  channel add: (self progressNotificationFor: channel from: parsed).
  ^self
%
category: 'routing'
method: McpRouter
acknowledgeCancelledCall: sess on: conn
  "End the HTTP request of a call the client CANCELLED, saying nothing about it.
   202 Accepted with no body: the spec asks a receiver of a cancellation both to stop processing the
   request and NOT to send a response for it, and 202 is how this transport says 'taken, nothing to
   report' -- valid HTTP, so the connection ends the way every other one does, and carrying no
   JSON-RPC response for a request the client has told us it is no longer listening for. (It would
   ignore one anyway: the spec tells the canceller to discard any response that arrives late.)
   A streamed call needs no equivalent. Its stream is already open, so saying nothing IS ending it,
   which is what the draft revision requires of a cancelled request outright.
   The session is still released where its gem had to be stopped to get the call out of it -- that is
   true however the call ended, and the client learns of it from the 404 on its next request."
  self releaseSessionIfAbandoned: sess.
  ^conn writeStatus: 202 reason: 'Accepted' body: ''
%
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
   That distinction is what lets a deployment ASK for no idle deadline: 'sessionIdleTimeoutSeconds'
   present and null is an instruction, where its absence is not.
   Subclasses extend via super."
  allowedOriginHosts := aConfigDict at: 'allowedOriginHosts' ifAbsent: [allowedOriginHosts].
  tlsCertificateFile := aConfigDict at: 'tlsCertificateFile' ifAbsent: [tlsCertificateFile].
  tlsPrivateKeyFile := aConfigDict at: 'tlsPrivateKeyFile' ifAbsent: [tlsPrivateKeyFile].
  readOnly := aConfigDict at: 'readOnly' ifAbsent: [readOnly].
  "Through the SETTER, not the ivar: it is the one thing here whose value has a fixed vocabulary, and
   a name that is not in it must fail in the child gem rather than be handed to #asSymbol."
  (aConfigDict includesKey: 'frontEndTransactionMode')
    ifTrue: [self frontEndTransactionMode: (aConfigDict at: 'frontEndTransactionMode')].
  workerClassName := aConfigDict at: 'workerClassName' ifAbsent: [workerClassName].
  toolsetNames := aConfigDict at: 'toolsetNames' ifAbsent: [toolsetNames].
  (aConfigDict includesKey: 'toolsetOptions')
    ifTrue: [self toolsetOptions: (aConfigDict at: 'toolsetOptions')].
  serverName := aConfigDict at: 'serverName' ifAbsent: [serverName].
  serverTitle := aConfigDict at: 'serverTitle' ifAbsent: [serverTitle].
  serverVersion := aConfigDict at: 'serverVersion' ifAbsent: [serverVersion].
  requestTimeoutSeconds := aConfigDict at: 'requestTimeoutSeconds' ifAbsent: [requestTimeoutSeconds].
  sessionIdleTimeoutSeconds := aConfigDict at: 'sessionIdleTimeoutSeconds' ifAbsent: [sessionIdleTimeoutSeconds].
  streamlessIdleTimeoutSeconds := aConfigDict at: 'streamlessIdleTimeoutSeconds' ifAbsent: [streamlessIdleTimeoutSeconds].
  streamLossGraceSeconds := aConfigDict at: 'streamLossGraceSeconds' ifAbsent: [streamLossGraceSeconds].
  livenessProbeIntervalSeconds := aConfigDict at: 'livenessProbeIntervalSeconds' ifAbsent: [livenessProbeIntervalSeconds].
  reaperIntervalSeconds := aConfigDict at: 'reaperIntervalSeconds' ifAbsent: [reaperIntervalSeconds].
  maxSessionLifetimeSeconds := aConfigDict at: 'maxSessionLifetimeSeconds' ifAbsent: [maxSessionLifetimeSeconds].
  reapOnFailedProbe := aConfigDict at: 'reapOnFailedProbe' ifAbsent: [reapOnFailedProbe].
  "Through the SETTER: nil is a real setting here (view hygiene off) and every other value has a
   floor, so a number that cannot work must fail on arrival in the child gem."
  (aConfigDict includesKey: 'maxCommitsBehind')
    ifTrue: [self maxCommitsBehind: (aConfigDict at: 'maxCommitsBehind')].
  messageTrace := aConfigDict at: 'messageTrace' ifAbsent: [messageTrace].
  messageTraceLimit := aConfigDict at: 'messageTraceLimit' ifAbsent: [messageTraceLimit].
  ^self
%
category: 'config'
method: McpRouter
applyConfigJson: aJsonString
  "Apply a JSON config string (see applyConfig: / configJson)."
  ^self applyConfig: (self parseBody: aJsonString)
%
category: 'transaction mode'
method: McpRouter
applyFrontEndTransactionMode
  "Put THIS GEM into the configured transaction mode (#frontEndTransactionMode), and answer self.
   Called from the class-side #runOnPort:configJson: and from nowhere else -- see that method for
   why, and the class comment for what the default mode then forbids of front-end code.
   A failure is logged and swallowed rather than raised. The mode is hygiene: a front end that could
   not get it is still a working front end, just one that pins a commit record, and refusing to serve
   for that reason would be the worse trade. The failure that will actually happen is #transactionless
   in a SOLO session (the repository open by this gem alone), which is no way to run a server but is
   exactly how someone tries one out; the log line names the mode the gem is left in, since that is
   the fact the next question will be about."
  | mode |
  mode := self frontEndTransactionMode.
  ^[System transactionMode: mode asSymbol. self]
    on: Error
    do: [:ex |
      self log: 'Could not put this gem in transaction mode ' , mode , ' -- staying in '
        , ([System transactionMode asString] on: Error do: [:x | 'an unknown mode'])
        , ': ' , ([ex description] on: Error do: [:x | ex class name asString]).
      self]
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
category: 'progress'
method: McpRouter
channelAt: aCallIdOrNil
  "The progress channel for a call still in flight, or nil. Its own mutex, deliberately not the
   session map's: that one is held across reapIdleSessions, and a chatty tool must not contend with
   another client's session opening."
  aCallIdOrNil isNil ifTrue: [^nil].
  ^callMutex critical: [callChannels at: aCallIdOrNil ifAbsent: [nil]]
%
category: 'lifecycle'
method: McpRouter
closeAllSessions
  "Close and unmap EVERY client session, releasing its worker gem, and answer how many were let go.
   Unlike #reapIdleSessions this asks no policy question: the caller is done with this router, so
   every worker goes regardless of idleness, deadline, or work in flight. Same concurrency
   discipline as the reaper -- collect and unmap under the mutex, close (a blocking logout) outside
   it -- so a session cannot be closed while another GsProcess is routing to it.
   Deliberately does NOT announce the ending on each client's stream, as the reaper does: nothing
   will drain an outbox after this, so a notice enqueued here would be written nowhere. Callers
   ending a SERVING router should say their goodbyes first if they want them heard.
   Needed because a worker gem outlives the router object -- it is a real logged-in gem, not an
   object -- so anything holding a router transiently (above all a test, which drives
   #handleConnection: without ever starting the accept loop that runs the reaper) leaks a login slot
   per session it opened."
  | doomed |
  doomed := mutex critical: [
    | found |
    found := OrderedCollection new.
    sessions values do: [:s | found add: s].
    found do: [:s | sessions removeKey: s id ifAbsent: [nil]].
    found].
  doomed do: [:s | [s close] on: Error do: [:e | nil]].
  ^doomed size
%
category: 'view hygiene'
method: McpRouter
commitsBehindFor: sess
  "How many commits the repository has taken since sess's WORKER GEM obtained its view
   (descriptionOfSession: field 16), or nil if that cannot be read.
   A stone query made from THIS gem about another session -- it never touches the worker's GCI
   channel, so it is unaffected by whether the worker has a call in flight, and unaffected by this
   gem's own view. That is what lets this arm measure a busy session it must not act on.
   #workerStoneSession was cached at login (McpSession>>cacheWorkerIds) precisely so nothing on this
   path has to ask the worker anything.
   Two failures both answer nil: the session has logged out, and this server's user lacks the
   SessionAccess privilege needed to read ANOTHER session's description. The second disables the
   whole arm, so it is logged -- once, by #noteSessionAccessDenied:, because a line per session per
   pass would bury the gem log in a fact that does not change."
  | sid |
  sid := sess workerStoneSession.
  sid isNil ifTrue: [^nil].
  ^[(System descriptionOfSession: sid) at: 16]
    on: Error
    do: [:ex | self noteSessionAccessDenied: ex. nil]
%
category: 'view hygiene'
method: McpRouter
commitsBehindLimit
  "The commits-behind figure at which this server refreshes a worker's view: the LOWER of what this
   router was configured to tolerate (#maxCommitsBehind) and what the stone itself tolerates
   (StnSignalAbortCrBacklog), so either one firing is enough.
   Answers nil when the arm is off (#maxCommitsBehind nil). When the stone cannot be read, the
   configured number stands alone -- an unreadable stone setting must not silently raise the bar."
  | stone |
  maxCommitsBehind isNil ifTrue: [^nil].
  stone := self stoneSignalAbortCrBacklog.
  stone isNil ifTrue: [^maxCommitsBehind].
  ^maxCommitsBehind min: stone
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
  d at: 'frontEndTransactionMode' put: frontEndTransactionMode.
  d at: 'workerClassName' put: workerClassName.
  d at: 'toolsetNames' put: toolsetNames.
  "Toolset options are the one value here the core does not know the shape of. They stay inside the
   fixed key allow-list all the same: a nested map under ONE key, whose contents were checked against
   the toolsets' own declaredOptionNames when they were set (toolsetOptions:), so a future toolset
   cannot start carrying something nobody declared."
  d at: 'toolsetOptions' put: toolsetOptions.
  d at: 'serverName' put: serverName.
  d at: 'serverTitle' put: serverTitle.
  d at: 'serverVersion' put: serverVersion.
  d at: 'requestTimeoutSeconds' put: requestTimeoutSeconds.
  d at: 'sessionIdleTimeoutSeconds' put: sessionIdleTimeoutSeconds.
  d at: 'streamlessIdleTimeoutSeconds' put: streamlessIdleTimeoutSeconds.
  d at: 'streamLossGraceSeconds' put: streamLossGraceSeconds.
  d at: 'livenessProbeIntervalSeconds' put: livenessProbeIntervalSeconds.
  d at: 'reaperIntervalSeconds' put: reaperIntervalSeconds.
  d at: 'maxSessionLifetimeSeconds' put: maxSessionLifetimeSeconds.
  d at: 'reapOnFailedProbe' put: reapOnFailedProbe.
  d at: 'maxCommitsBehind' put: maxCommitsBehind.
  "Message tracing has to travel, or it is unreachable: forkOnPort: is the only way this server is
   ever started, so a setting the fork string does not carry is one an operator cannot turn on."
  d at: 'messageTrace' put: messageTrace.
  d at: 'messageTraceLimit' put: messageTraceLimit.
  ^d
%
category: 'config'
method: McpRouter
configJson
  "This router's config (configDict) as a JSON string."
  ^McpJson write: self configDict
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
deadlineSourceFor: sess
  "Which bound set this session's absolute deadline, phrased for the client, because the two differ
   in what the client can DO about it: a credential can be refreshed and a server's cap cannot.
   Told apart without storing the fact: a deadline equal to the session's start plus the configured
   cap is the cap's, and anything earlier came from the credential -- which is exactly what
   McpSession>>startedAtSeconds exists for. Both may be set, in which case the earlier one is in
   force, since #expiresAtSeconds: only ever moves a deadline earlier."
  (maxSessionLifetimeSeconds notNil
    and: [sess expiresAtSeconds = (sess startedAtSeconds + maxSessionLifetimeSeconds)])
      ifTrue: [^'this server''s session lifetime cap'].
  ^'your access credential, which refreshing it extends'
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
drain: aQueue to: conn
  "Write everything waiting in aQueue to an SSE stream, oldest first. Answers false as soon as a write
   fails, which is how a caller learns the client is gone.
   Takes either kind of queue -- a session's McpOutbox, draining onto its standalone GET stream, or one
   call's McpProgressChannel, draining onto the response stream of the very call that is producing the
   ticks. The two are different things (see McpProgressChannel) but they present the same queueing
   protocol on purpose, so this method needs to know which it has no more than a socket does.
   A gap is admitted rather than hidden, but to the OPERATOR, not to the client. Announcing it took a
   notifications/message, which was legal only while this server declared the logging capability and is
   prohibited outright by the draft revision. The gem log is the better audience anyway: an overflow is
   a server-side fault, and there was never anything the client could do about it."
  | dropped |
  dropped := aQueue takeDroppedCount.
  dropped > 0 ifTrue: [
    self log: dropped printString , ' queued message(s) for an MCP session were dropped before '
      , 'they could be written: its queue overflowed.'].
  aQueue drain do: [:each | (conn writeSseData: each) ifNil: [^false]].
  ^true
%
category: 'progress'
method: McpRouter
drainWorkerSignals
  "Drain every worker signal waiting for this gem, oldest first. Answers self.
   Loops until the queue is empty rather than taking one per tick: a burst from several workers must
   not be spread over several poll intervals, and the queue is only 50 deep."
  | sig |
  [(sig := InterSessionSignal poll) notNil] whileTrue: [self acceptWorkerSignal: sig].
  ^self
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
category: 'toolsets'
method: McpRouter
effectiveToolsetOptions
  "The toolset options this router's NEXT worker is built with, narrowed to the toolsets actually in
   its surface. Narrowed rather than passed whole so that a worker is never handed configuration for
   a toolset it does not have -- which matters most where the surface is chosen PER SESSION (a
   subclass narrowing effectiveToolsetNames by principal), because there the same router legitimately
   serves different surfaces and the options must follow.
   nil when nothing survives, which is what an unconfigured deployment always answers."
  | names narrowed |
  toolsetOptions isNil ifTrue: [^nil].
  names := self effectiveToolsetNames collect: [:n | n asString].
  narrowed := Dictionary new.
  toolsetOptions keysAndValuesDo: [:k :v |
    (names includes: k asString) ifTrue: [narrowed at: k put: v]].
  ^narrowed isEmpty ifTrue: [nil] ifFalse: [narrowed]
%
category: 'worker class'
method: McpRouter
effectiveWorkerClassName
  "The class this router's workers instantiate: the configured name, or McpServer. Named on every
   forwarded request (McpSession>>workerExpressionFor:), so the worker gem is told rather than
   deciding."
  ^workerClassName ifNil: ['McpServer']
%
category: 'message trace'
method: McpRouter
escapedForTrace: aString
  "aString with its line breaks and tabs turned into the two-character escapes \n \r \t, so one
   traced message is one line in the gem log. Every other line this server writes is a single line,
   and a JSON-RPC body here routinely carries Smalltalk source with real newlines in it: left
   alone, a single tools/call would break into thirty log lines and take the timestamp, the session
   id and grep with it."
  | out |
  out := WriteStream on: String new.
  aString do: [:c |
    c = Character lf
      ifTrue: [out nextPutAll: '\n']
      ifFalse: [c = Character cr
        ifTrue: [out nextPutAll: '\r']
        ifFalse: [c = Character tab
          ifTrue: [out nextPutAll: '\t']
          ifFalse: [out nextPut: c]]]].
  ^out contents
%
category: 'progress'
method: McpRouter
forgetChannel: aChannel
  "Unregister a finished call's channel. Sent from an ensure: as the call returns, so a raising tool
   cannot leak one -- and a tick arriving afterwards is dropped by #acceptWorkerSignal: for want of a
   channel, which is the normal end of every reported call rather than an error."
  aChannel isNil ifTrue: [^self].
  callMutex critical: [callChannels removeKey: aChannel callId ifAbsent: [nil]].
  ^self
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
category: 'progress'
method: McpRouter
forkSignalPoller
  "Fork the GsProcess that drains worker-gem signals: the one thing that polls on a schedule, forked
   here beside the reaper rather than by whatever happens to want a tick.
   It is not the only thing that may drain, and that is safe: InterSessionSignal poll reads a SINGLE
   queue belonging to this gem, shared by every worker signalling it, but #acceptWorkerSignal: routes
   each payload to its own call by callId -- so whoever takes a message off the queue, it reaches the
   same channel. A streamed call drains once itself, on the way out, to collect the tick its worker
   sent as it returned (#serveStreamedCall:id:progressToken:forSession:on:).
   It cannot be the reaper's own pass: that runs once a minute, and a progress tick a minute late is
   not progress. #signalPollMilliseconds is the latency of every notification this server sends.
   The Stone's queue holds 50 messages and the 51st raises SignalBufferFull IN THE SENDER, so
   draining promptly is what keeps the senders working; the reporters rate-limit for the same reason."
  [[isRunning] whileTrue: [
     [self drainWorkerSignals] on: Error do: [:e |
       self log: 'drainWorkerSignals error: '
         , ([e description] on: Error do: [:x | e class name asString])].
     (Delay forMilliseconds: self signalPollMilliseconds) wait]] fork
%
category: 'transaction mode'
method: McpRouter
frontEndTransactionMode
  "The GemStone transaction mode this router's DETACHED gem puts itself in before it serves anything
   (class-side #runOnPort:configJson: -> #applyFrontEndTransactionMode). 'transactionless' by
   default; McpRouter class>>defaultFrontEndTransactionMode says why.
   It says nothing about a router run in the FOREGROUND from an interactive session, which never
   changes the mode of the session that called it -- so the startup banner reports the mode the gem
   is actually in rather than this one."
  ^frontEndTransactionMode
%
category: 'transaction mode'
method: McpRouter
frontEndTransactionMode: aString
  "Set the transaction mode this router's detached gem runs in -- one of
   McpRouter class>>frontEndTransactionModes -- and raise on anything else.
   Checked here, in the session that is configuring the router, because the alternative is a typo
   that leaves the front end quietly in transaction: a condition no part of a running server
   complains about, that costs nothing visible for hours, and that surfaces only as a stone full of
   commit records."
  ((aString isKindOf: CharacterCollection)
    and: [self class frontEndTransactionModes includes: aString asString]) ifFalse: [
      ^self error: 'frontEndTransactionMode must be one of '
        , (self class frontEndTransactionModes inject: '' into: [:a :b |
            a isEmpty ifTrue: [b] ifFalse: [a , ', ' , b]])
        , ', and is ' , aString printString , '.'].
  frontEndTransactionMode := aString asString
%
category: 'running'
method: McpRouter
handleConnection: aConnection
  "Read one HTTP/1.1 request and dispatch it (see route:on:). Runs in its own GsProcess; any error
   is contained and answered with 500, and the connection is always closed.
   The message trace is taken HERE, before #route:on:, because this is the only point that sees
   EVERY client message: the transport gates (Origin, MCP-Protocol-Version) and, on McpAuthRouter,
   the credential gate all refuse inside #route:on:, and a request refused there is exactly the one
   an operator is trying to see. Tracing costs nothing when it is off (see #traceRequest:)."
  [ | req |
    req := aConnection readRequest.
    self traceRequest: req.
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
   per idle period, and #streamlessIdleTimeoutSeconds becomes the only thing that can release an
   unreachable client's gem."
  ^sessionIdleTimeoutSeconds notNil
%
category: 'view hygiene'
method: McpRouter
hasViewHygiene
  "Whether this router watches its workers' views at all. Off means off entirely -- neither the
   per-session ceiling nor the stone-pressure trigger applies -- which is the same bargain
   #hasSessionIdleDeadline makes for idleness: nil is a deployment instruction, not an absence."
  ^maxCommitsBehind notNil
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
  toolsetOptions := nil.   "nil = no toolset needs configuring, which is the ordinary case"
  serverName := nil.       "nil = the worker's own default (McpServer class>>defaultServerName)"
  serverTitle := nil.
  serverVersion := nil.
  "The mode a DETACHED front-end gem puts itself in (#applyFrontEndTransactionMode). Seeded rather
   than left nil, because nil could only mean 'keep whatever STN_GEM_INITIAL_TRANSACTION_MODE gave
   this gem at login', and that is the pinned-view behaviour this default exists to end."
  frontEndTransactionMode := self class defaultFrontEndTransactionMode.
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
  requestTimeoutSeconds := self class defaultRequestTimeoutSeconds.
  sessionIdleTimeoutSeconds := self class defaultSessionIdleTimeoutSeconds.
  streamlessIdleTimeoutSeconds := self class defaultStreamlessIdleTimeoutSeconds.
  streamLossGraceSeconds := self class defaultStreamLossGraceSeconds.
  livenessProbeIntervalSeconds := self class defaultLivenessProbeIntervalSeconds.
  reaperIntervalSeconds := self class defaultReaperIntervalSeconds.
  maxSessionLifetimeSeconds := nil.  "nil = no absolute cap beyond whatever a credential imposes"
  reapOnFailedProbe := true.
  "View hygiene. Seeded rather than left nil, because nil is the OFF setting and could not also mean
   'use the default'. sessionAccessWarned is the once-only latch for the privilege this arm needs."
  maxCommitsBehind := self class defaultMaxCommitsBehind.
  sessionAccessWarned := false.
  "Message tracing: OFF, because a traced log records every tool argument a client sent, and an
   operator must choose that rather than discover it. The cap is not optional -- a compile_method or
   execute_code body runs to tens of kilobytes, and an unbounded default would let a chatty session
   fill a disk nobody is watching."
  messageTrace := false.
  messageTraceLimit := self class defaultMessageTraceLimit.
  callChannels := Dictionary new.
  callMutex := Semaphore forMutualExclusion.
  callCounter := 0.
  ^self
%
category: 'routing'
method: McpRouter
internalErrorFor: anIdOrNil
  "A JSON-RPC -32603 body bearing anIdOrNil, as a JSON String, for a failure the front end could not
   turn into anything more specific.
   It exists for exactly one caller: a streamed call whose forward raised something other than an
   ended call (#serveStreamedCall:id:forSession:on:). handleConnection: answers an escaped error with
   a complete HTTP 500 response, which on a connection already carrying SSE frames would be appended
   to the stream and read as junk -- so that path has to end itself, with a frame, and a frame needs
   a body. Everywhere else the 500 is the right answer and this is not used."
  | err |
  err := Dictionary new.
  err at: 'jsonrpc' put: '2.0'; at: 'id' put: anIdOrNil.
  err at: 'error' put: (Dictionary new
    at: 'code' put: -32603; at: 'message' put: 'Internal error'; yourself).
  ^McpJson write: err
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
lifetimeBoundsFor: sess
  "What bounds this session, as the VALUES the worker needs to describe them when it reports them:
     #( deadlineAtSeconds deadlineSource inactivitySeconds inactivityLabel )
   or nil if nothing bounds this session at all. Any element may be nil.

   DELIBERATELY NOT A RENDERED SENTENCE, and specifically not a rendered countdown. This is computed
   when the request ARRIVES; the client reads it when the call RETURNS. A duration rendered here is
   therefore wrong by the length of the call -- and wrong in the dangerous direction, telling a
   client 24 minutes remain when a six-minute tool call has left it 18. So the deadline crosses as
   an INSTANT and the worker subtracts when it answers (McpServer>>lifetimeNote). What stays here is
   every policy choice: which bounds exist, what they are called, and which of the two inactivity
   rules can actually fire.

   BOTH bounds are reported, never only the nearer one, because they run on different clocks and
   which of them binds can invert during a single call: a 33-minute credential outlasts a 30-minute
   idle rule when the request arrives and undercuts it six minutes later. The worker orders them by
   which comes first at the moment it answers.

   The inactivity bound is whichever rule can actually fire. With no stream open, liveness can be
   asked nothing -- #quietProbes cannot advance without answered pings -- so the give-up rule is
   #streamlessIdleTimeoutSeconds, typically far shorter than the idle deadline, and quoting the idle
   deadline there would be a comfortable lie.

   Two reaping grounds are deliberately absent: three unanswered pings, and a client closing its
   stream. Neither is a timer a client can plan around -- a client reading this answered the request
   that carried it, and one that has stopped answering is not reading anything."
  | deadlineAt inactivity label |
  deadlineAt := sess expiresAtSeconds.
  sess outbox hasStream
    ifTrue: [
      self hasSessionIdleDeadline ifTrue: [
        inactivity := self sessionIdleTimeoutSeconds.
        label := 'of inactivity']]
    ifFalse: [
      inactivity := self streamlessIdleTimeoutSeconds.
      label := 'with no event stream open'].
  (deadlineAt isNil and: [inactivity isNil]) ifTrue: [^nil].
  ^Array
    with: deadlineAt
    with: (deadlineAt isNil ifTrue: [nil] ifFalse: [self deadlineSourceFor: sess])
    with: inactivity
    with: label
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
  s nextPutAll: 'request-timeout '.
  s nextPutAll: (requestTimeoutSeconds isNil
    ifTrue: ['none']
    ifFalse: [requestTimeoutSeconds printString , 's']).
  s nextPutAll: ', idle '.
  s nextPutAll: (self hasSessionIdleDeadline
    ifTrue: [self sessionIdleTimeoutSeconds printString , 's']
    ifFalse: ['none']).
  s nextPutAll: ', streamless '; nextPutAll: self streamlessIdleTimeoutSeconds printString.
  s nextPutAll: 's, stream-loss-grace '.
  s nextPutAll: (self streamLossGraceSeconds isNil
    ifTrue: ['none']
    ifFalse: [self streamLossGraceSeconds printString , 's']).
  s nextPutAll: ', probe '; nextPutAll: self livenessProbeIntervalSeconds printString.
  s nextPutAll: 's, reaper '; nextPutAll: self reaperIntervalSeconds printString.
  s nextPutAll: 's, max-life '.
  s nextPutAll: (self maxSessionLifetimeSeconds isNil
    ifTrue: ['none']
    ifFalse: [self maxSessionLifetimeSeconds printString , 's']).
  s nextPutAll: ', reap-on-failed-probe '.
  s nextPutAll: (self reapOnFailedProbe ifTrue: ['yes'] ifFalse: ['no']).
  ^s contents
%
category: 'session lifetime'
method: McpRouter
livenessProbeIntervalSeconds
  "How often a quiet session with no wall-clock deadline is re-asked whether its client is there.
   Only meaningful when #hasSessionIdleDeadline is false: with a deadline the ping is asked once per
   idle period, as the session nears release."
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
  "a client with no stream cannot be sent a ping. It is not forgotten: the passes are being
   counted above, and #reapReasonFor: releases it once there have been enough."
  hasStream ifFalse: [^false].
  (self probeDue: sess) ifTrue: [^self probeSession: sess].
  ^false
%
category: 'sessions'
method: McpRouter
maintainSessions
  "One pass of session housekeeping, run on the reaper's GsProcess. Answers the number reaped.
   The order is the point:
     1. move this gem's OWN view (#refreshFrontEndView), so the front end stops holding a commit
        record open for the rest of the stone -- and, the same act seen from the other side, so that
        a committed recompile of front-end code takes effect here;
     2. probe sessions that have gone quiet, so silence can be told from absence;
     3. reap what should go.
   Step 1 comes first so that everything after it reasons about the repository as it is now rather
   than as it was when this gem logged in. Reaping comes last so that a session found gone while
   probing is freed in the same pass rather than the next.
   Two steps this comment used to promise are gone, and both were REMOVED rather than left undone:
     * there is no suspend detector, because every ground #reapReasonFor: reads is now a count of
       something this front end observed, so a suspended host cannot manufacture one and there is no
       suspend left to forgive;
     * there is no pass that times out server-initiated requests, because a probe is counted at the
       moment it is SENT (McpSession>>noteProbeSent) and an inadmissible one has its count taken back
       at stream handover (#retirePendingProbesFor:) -- so nothing is waiting on a clock to be
       declared unanswered."
  self refreshFrontEndView.
  self maintainViewHygiene.
  self probeIdleSessions.
  ^self reapIdleSessions
%
category: 'view hygiene'
method: McpRouter
maintainViewHygiene
  "Look at how far behind the repository each worker gem's view has fallen, and answer how many are
   far enough behind to act on.
   MEASUREMENT ONLY, deliberately, for this first step: it records the number on each session and
   logs the ones over the line, and it moves nobody's view. The whole point is to find out what the
   real numbers look like -- and whether this server's user can read them at all -- before anything
   acts on them.
   The two stone-wide figures are read ONCE per pass, not once per session: they are properties of
   the repository, and asking per session would multiply the cost by the client count for an answer
   that cannot differ. The session snapshot is taken under the mutex the same way
   #probeIdleSessions does it, because a session may be reaped or registered while this runs.
   A session with a call in flight is MEASURED but never acted on, here or later. The measurement is
   a stone query and cares nothing for the worker's GCI channel; the action would have to go through
   it, and moving a view out from under a running tool is the corruption the transaction model exists
   to prevent."
  | limit critical backlog oldest acted |
  self hasViewHygiene ifFalse: [^0].
  limit := self commitsBehindLimit.
  limit isNil ifTrue: [^0].
  backlog := self stoneCommitRecordBacklog.
  critical := self stoneBacklogCritical.
  "Only needed to decide the pressure case, and only when there IS pressure."
  oldest := critical ifTrue: [self sessionsHoldingOldestCr] ifFalse: [#()].
  acted := 0.
  (mutex critical: [sessions values asArray]) do: [:sess |
    [ | behind holdsOldest |
      behind := self commitsBehindFor: sess.
      behind ifNotNil: [ | changed |
        "Read BEFORE recording: whether this is news or a repeat is what decides the log line."
        changed := behind ~= sess commitsBehind.
        sess noteCommitsBehind: behind.
        holdsOldest := oldest includes: sess workerStoneSession.
        "Over the line by either route: this session is far enough behind on its own, OR the stone is
         over its own backlog threshold AND this is a session holding the oldest record open. The
         second is deliberately conjunctive. Measured on db-1, a stone can sit far above its
         threshold for hours (backlog 726 against a threshold of 80) because ONE session pinned the
         oldest record -- so treating pressure alone as a reason would act on every client every
         pass, when only one of them is the reason. The same predicate governs the busy case."
        (behind >= limit or: [critical and: [holdsOldest]]) ifTrue: [
          acted := acted + 1.
          "Log a CHANGED number, not a standing one. This step acts on nothing, so a session over
           the line stays over it, and a line per session per pass is 1440 identical lines a day for
           one idle client -- measured, three in a row before that session happened to be reaped.
           Every distinct observation is still recorded, which is what this step is for; only the
           repeats go. Once the arm acts (the next step) this becomes self-limiting anyway, since a
           refreshed view reads 0 on the following pass."
          changed ifTrue: [
            self log: 'view hygiene (measuring only): session ' , sess id printString
              , ' worker gem ' , sess workerStoneSession printString
              , ' is ' , behind printString , ' commits behind (limit ' , limit printString
              , '), stone backlog ' , backlog printString , '/'
              , self stoneCrBacklogThreshold printString
              , ', holds-oldest-cr ' , (holdsOldest ifTrue: ['yes'] ifFalse: ['no'])
              , ', busy ' , (sess isBusy ifTrue: ['yes'] ifFalse: ['no'])
              , ' -- would refresh its view.']]]]
      on: Error
      do: [:e | self log: 'maintainViewHygiene error: ' ,
             ([e description] on: Error do: [:x | e class name asString])]].
  ^acted
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
category: 'view hygiene'
method: McpRouter
maxCommitsBehind
  "How far behind the repository a worker gem's view may fall before this server refreshes it, or
   nil to leave every worker's view alone however far behind it gets.
   Counted in COMMITS (descriptionOfSession: field 16), not seconds, because that is the quantity
   the stone charges for: a session's view pins the commit record it was taken from, and what hurts
   is the number of records piled up behind it, not how long ago it was taken. A session idle for a
   day on a quiet stone costs nothing."
  ^maxCommitsBehind
%
category: 'view hygiene'
method: McpRouter
maxCommitsBehind: anIntegerOrNil
  "Set the commits-behind ceiling for worker views (nil turns view hygiene off entirely -- see
   #hasViewHygiene). Raises on anything else.
   The floor is 2 rather than 1: a ceiling of one commit would refresh a worker's view on the heels
   of any other session's commit, which for a client mid-plan is a view move per keystroke of
   somebody else's work."
  anIntegerOrNil isNil ifTrue: [^maxCommitsBehind := nil].
  ((anIntegerOrNil isKindOf: Integer) and: [anIntegerOrNil >= 2]) ifFalse: [
    ^self error: 'maxCommitsBehind must be nil, or an integer of at least 2, and is '
      , anIntegerOrNil printString , '.'].
  maxCommitsBehind := anIntegerOrNil
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
category: 'message trace'
method: McpRouter
messageTrace
  "Whether this router writes each message it receives from a client to the gem log. False by
   default. An MCP client's UI generally shows tool NAMES and not the text of the JSON-RPC message
   it sent, so when a call goes wrong there is often no record of the arguments anywhere; this is
   that record. Off by default because a traced log holds every argument every client sent -- source
   to compile, code to execute -- and that is an operator's decision to take, not a default to
   discover."
  ^messageTrace == true
%
category: 'message trace'
method: McpRouter
messageTrace: aBoolean
  "Turn the message trace on or off (see #messageTrace). Travels to a forked front end in the
   config, so ./run-server.sh GS_MCP_TRACE=1 reaches the gem that actually serves."
  messageTrace := aBoolean
%
category: 'message trace'
method: McpRouter
messageTraceLimit
  "Characters of each traced body written before the rest is summarized, or nil for no limit.
   See McpRouter class>>defaultMessageTraceLimit."
  ^messageTraceLimit
%
category: 'message trace'
method: McpRouter
messageTraceLimit: anIntegerOrNil
  "Cap each traced body at anIntegerOrNil characters; nil removes the cap. A cap is the default
   because an execute_code or compile_method argument runs to tens of kilobytes and the gem log is
   a file on a volume nobody is watching."
  (anIntegerOrNil notNil and: [anIntegerOrNil < 1])
    ifTrue: [^self error: 'messageTraceLimit must be a positive integer, or nil for no limit'].
  messageTraceLimit := anIntegerOrNil
%
category: 'message trace'
method: McpRouter
messageTraceSummary
  "One phrase describing the trace settings, for the startup log line."
  self messageTrace ifFalse: [^'off'].
  ^messageTraceLimit isNil
    ifTrue: ['whole bodies (no cap)']
    ifFalse: ['bodies capped at ' , messageTraceLimit printString , ' chars']
%
category: 'progress'
method: McpRouter
nextCallId
  "A fresh opaque name for a call whose progress is being reported. Its own namespace ('call-N'), so
   it cannot be confused with a session id, a server-originated request id, or -- the one that
   matters -- the client's progressToken, which is the client's to choose and is never sent to a
   worker."
  ^callMutex critical: [
    callCounter := callCounter + 1.
    'call-' , callCounter printString]
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
category: 'view hygiene'
method: McpRouter
noteSessionAccessDenied: anError
  "Record that a worker's session description could not be read, and say so in the gem log ONCE.
   Almost always one cause: reading ANOTHER session's description needs the SessionAccess privilege,
   and without it this whole arm is a no-op. That is worth a line naming the privilege, and worth
   exactly one -- the alternative is a line per session per pass, for a fact that will not change
   until somebody changes the user.
   The error text is included because the other reachable cause, a session that has logged out
   between the snapshot and the query, is ordinary and should be distinguishable at a glance."
  sessionAccessWarned == true ifTrue: [^self].
  sessionAccessWarned := true.
  ^self log: 'view hygiene is disabled: this server''s user cannot read another session''s '
    , 'description, which needs the SessionAccess privilege. Grant it, or set maxCommitsBehind to '
    , 'nil to stop asking. (' , ([anError description] on: Error do: [:x | anError class name asString])
    , ')'
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
    toolsetOptions: self effectiveToolsetOptions;
    serverName: self serverName;
    serverTitle: self serverTitle;
    serverVersion: self serverVersion;
    requestTimeoutSeconds: self requestTimeoutSeconds;
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
category: 'progress'
method: McpRouter
payloadOfSignal: aSignal
  "The payload a worker sent with an InterSessionSignal, or nil if there is none.
   #messageText is a PROSE DESCRIPTION with the payload appended after a literal 'message: ' -- e.g.
   'a InterSessionSignal occurred (notification 2711), fromSession=621 signal:1 message: {...}' -- so
   the text has to be cut, not read. Verified on 3.7.5 and 3.7.6.
   Do NOT send #signal to a polled signal to read the integer the sender passed: that selector is
   Exception>>signal, so it RAISES the thing. #gsArgs raises too. The number is not needed here
   anyway; the callId in the payload is what identifies a tick."
  | text marker idx |
  text := [aSignal messageText] on: Error do: [:ex | ex return: nil].
  text isNil ifTrue: [^nil].
  marker := 'message: '.
  idx := text findString: marker startingAt: 1.
  idx = 0 ifTrue: [^nil].
  ^text copyFrom: idx + marker size to: text size
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
category: 'sessions'
method: McpRouter
probeIdleSessions
  "Work the window between 'quiet' and 'reaped' for every session, and answer how many messages went
   out. One thing happens per session now (see #maintainIdleSession:): a liveness ping, where one
   is due.
   It costs a gem its own transaction view when a session is reaped, so a client that is still there
   should be kept -- and a client that is not there should not be waited out for the full timeout.
   The ping is what tells those two apart, which is the whole reason it survives the removal of the
   warnings it used to be the first half of.
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
category: 'progress'
method: McpRouter
progressNotificationFor: aChannel from: parsedPayload
  "Build the notifications/progress the client actually receives, as a JSON String.
   THE ROUTER builds this, not the worker, and that is the point of the compact payload: the envelope
   needs the client's progressToken, which the worker must never hold. A worker that got its own
   bookkeeping wrong can at worst address a tick to a callId that no longer exists; it cannot address
   one to another client's stream.
   `total` and `message` are omitted rather than sent as null when the tool gave none -- a client
   renders a fraction from total, and a null would be worse than its absence."
  | params |
  params := Dictionary new.
  params at: 'progressToken' put: aChannel progressToken.
  params at: 'progress' put: (parsedPayload at: 'p' ifAbsent: [0]).
  (parsedPayload at: 't' ifAbsent: [nil]) ifNotNil: [:t | params at: 'total' put: t].
  (parsedPayload at: 'm' ifAbsent: [nil]) ifNotNil: [:m | params at: 'message' put: m].
  ^McpJson write: (self notification: 'notifications/progress' params: params)
%
category: 'routing'
method: McpRouter
progressTokenFor: parsed accepting: req
  "The progressToken this request asked to be kept informed on, or nil where the answer must be
   ordinary JSON. Three conditions, all here because this is where a reader will come looking for
   them: the request is a tools/call, it carries params._meta.progressToken, and its Accept header
   offers to take a stream.
   Read HERE, in the front end, and not in the worker, for a reason that is not a preference: the
   Content-Type of the answer has to be chosen before the worker is called at all, so the worker
   cannot be what decides it. That is the one place this class deliberately parses more of a body
   than routing needs -- see servePost:.
   Nothing about this is advertised. Progress has no capability, no initialize field and no per-tool
   annotation in either revision, so the client opts in unilaterally and cannot lose the ability by
   failing to notice something this server declares. Claude Code has been sending a token on every
   single tools/call since it first connected."
  | params meta |
  (parsed at: 'method' ifAbsent: [nil]) = 'tools/call' ifFalse: [^nil].
  (self acceptsEventStream: req) ifFalse: [^nil].
  params := parsed at: 'params' ifAbsent: [nil].
  (params isKindOf: Dictionary) ifFalse: [^nil].
  meta := params at: '_meta' ifAbsent: [nil].
  (meta isKindOf: Dictionary) ifFalse: [^nil].
  ^meta at: 'progressToken' ifAbsent: [nil]
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
realizedProbeIntervalSeconds
  "How far apart the liveness pings ACTUALLY go out, in seconds. #livenessProbeIntervalSeconds is
   what a deployment asked for; this is what the pass cadence can deliver, and they differ whenever
   the one does not divide evenly into #reaperIntervalSeconds. Anything measuring a deadline in
   pings has to count against this one -- see #confirmationsBeforeRelease."
  ^self probePassInterval * self reaperIntervalSeconds
%
category: 'session lifetime'
method: McpRouter
reaperIntervalSeconds
  "How often (seconds) the maintenance pass runs: expire unanswered requests, probe sessions that
   have gone quiet, reap what should go. Also the unit the suspend detector measures
   its own lateness in (#maintainSessions)."
  ^reaperIntervalSeconds
%
category: 'session lifetime'
method: McpRouter
reaperIntervalSeconds: anInteger
  "Set how often the maintenance pass runs (see the getter)."
  reaperIntervalSeconds := anInteger
%
category: 'sessions'
method: McpRouter
reapIdleSessions
  "Close and unmap client sessions whose worker gem should be released, and answer how many. The
   grounds themselves live in #reapReasonFor: -- one place, so the policy can be read in one sitting
   -- and the phrase it answers is what the gem log records.
   Collect + unmap under the mutex; close (a blocking logout) outside it.
   The client is NOT told. It was, once, on its own stream; that took a notifications/message, which
   this server no longer sends. A reaped client learns the same fact from the 404 on its next call,
   which is the mechanism the transport already defines for exactly this."
  | doomed |
  doomed := mutex critical: [
    | found |
    found := OrderedCollection new.
    sessions values do: [:s |
      (self reapReasonFor: s) ifNotNil: [:why | found add: (Array with: s with: why)]].
    found do: [:pair | sessions removeKey: (pair at: 1) id ifAbsent: [nil]].
    found].
  doomed do: [:pair |
    [(pair at: 1) close] on: Error do: [:e | nil]].
  doomed do: [:pair |
    self log: 'Reaped MCP session ' , (pair at: 1) id printString , ' -- ' , (pair at: 2) , '.'].
  ^doomed size
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
category: 'transaction mode'
method: McpRouter
refreshFrontEndView
  "Move THIS GEM's database view to the current state of the repository, and answer self. Run at the
   top of every maintenance pass, which makes it two things at once: this gem's release of whatever
   commit record it was holding, and the front end's code-refresh point.
   An explicit abort rather than trusting the stone to push the view along, because measured, it will
   not: a view is STICKY (an idle transactionless session's view did not move at all over 30 seconds
   of another session committing), and the stone's sigAbort fires only when the backlog is over
   StnSignalAbortCrBacklog AND this session is on the oldest commit record. Without this the view
   would move at an unpredictable, load-dependent moment, or never. Once per reaper interval is a
   boring cadence that can be written down instead.
   #abortTransaction is legal and correct in every transaction mode, so the 'autoBegin' escape hatch
   needs no branch here -- in that mode this re-pins a fresh view rather than releasing the old one,
   which is still the right act.
   The needsCommit line is a BUG DETECTOR, not hygiene. Out of transaction, a write to a committed
   object is allowed, sets needsCommit, and is then discarded by this abort with no error raised
   anywhere -- where the same mistake in an in-transaction gem would at least raise 2030 at the
   commit. The front end writes nothing today, which is what makes the mode safe; if that ever stops
   being true, this line is the only thing that will say so."
  ([System needsCommit] on: Error do: [:ex | false]) == true ifTrue: [
    self log: 'BUG: the front end gem has uncommitted changes, which this view refresh is about to '
      , 'discard. Nothing in McpRouter is supposed to write to the repository -- see the class '
      , 'comment.'].
  ^[System abortTransaction. self]
    on: Error
    do: [:ex |
      self log: 'Could not refresh the front end''s view: '
        , ([ex description] on: Error do: [:x | ex class name asString]).
      self]
%
category: 'progress'
method: McpRouter
registerChannelForToken: aToken session: sess
  "Create and register the progress channel for a call about to start, and answer it.
   Registered BEFORE the worker is called, so a tick that arrives while the very first tool statement
   is running already has somewhere to go; unregistered in an ensure: as the call returns
   (#forgetChannel:)."
  | channel |
  channel := McpProgressChannel callId: self nextCallId progressToken: aToken sessionId: sess id.
  callMutex critical: [callChannels at: channel callId put: channel].
  ^channel
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
category: 'session lifetime'
method: McpRouter
releaseSessionIfAbandoned: sess
  "End a session whose worker gem had to be STOPPED to get a call out of it (McpSession>>
   abandonWorker), which is the third and last step of ending a call and the only one that costs the
   client its session. Unmapped here rather than left for the reaper: it can serve nothing, and the
   sooner it is gone the sooner the client's next request gets the 404 that tells it to initialize
   again. Closing it marks its outbox closing, so an open stream is drained and ended rather than
   dropped.
   Does nothing for a session whose worker took a break, which is nearly all of them: there the gem,
   its view and its uncommitted work are all intact and the client lost only the one call.
   Separate from the two methods that answer the client (#writeTimeoutError:forSession:id:on: and
   #writeTimeoutFrame:forSession:id:on:) because both owe the client this and they differ only in
   how the answer is framed."
  sess workerAbandoned ifFalse: [^self].
  mutex critical: [sessions removeKey: sess id ifAbsent: [nil]].
  [sess close] on: Error do: [:ex | ex return: nil].
  self log: 'Ended MCP session ' , sess id printString
    , ' -- a request was ended and its worker gem could not be interrupted, so the gem was stopped.'.
  ^self
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
category: 'session lifetime'
method: McpRouter
requestTimeoutSeconds
  "How long one request may run in a worker gem before it is ended and answered with an error, or nil
   for no limit. Pushed into each session as it is opened (#openSessionCreating:), so a change
   applies to sessions opened after it, not to those already running."
  ^requestTimeoutSeconds
%
category: 'session lifetime'
method: McpRouter
requestTimeoutSeconds: anIntegerOrNil
  "Set the per-request deadline for this router's sessions, or nil for none (see the getter).
   Validated at startup by #validateTimerConfig."
  requestTimeoutSeconds := anIntegerOrNil
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
   stamp the activity clock. Liveness spares the gem an early reap; only real MCP traffic (#touch)
   restarts the idle cycle."
  | entry |
  anId isNil ifTrue: [^nil].
  entry := pendingMutex critical: [pendingRequests removeKey: anId ifAbsent: [nil]].
  entry isNil ifTrue: [^nil].
  sess noteAlive.
  ^entry
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
  self forkSignalPoller.
  self log: self class name asString , ' listening on ' ,
    (self tlsEnabled ifTrue: ['https'] ifFalse: ['http']) , '://' , self bindAddress , ':' , aPort printString.
  self log: 'workers: ' , self effectiveWorkerClassName , ', toolsets: ' ,
    (self effectiveToolsetNames isEmpty
      ifTrue: ['(none -- this router offers no tools)']
      ifFalse: [self effectiveToolsetNames inject: '' into: [:a :b | a isEmpty ifTrue: [b] ifFalse: [a , ' ' , b]]]).
  self log: 'session lifetime: ' , self lifetimeSummary.
  "The mode the gem IS in, asked of the gem, not the mode this router was configured with. Only a
   detached front end applies the configured one (class-side runOnPort:configJson:); run in the
   foreground this reports the calling session's mode, which is the honest answer to 'what will this
   process do to my view'. It is also the line that says whether the once-per-pass abort in
   #refreshFrontEndView is releasing a commit record or re-pinning a fresh one."
  self log: 'transaction mode: '
    , ([System transactionMode asString] on: Error do: [:x | 'unknown']).
  self log: 'view hygiene: ' , self viewHygieneSummary.
  "Say so when tracing is on, and say nothing when it is off. A reader of this log has to be able to
   tell a quiet server from an untraced one -- otherwise an absence of message lines reads as an
   absence of traffic, which is the wrong conclusion and the expensive one."
  messageTrace == true ifTrue: [self log: 'message trace: ON -- ' , self messageTraceSummary].
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
  "Release the worker gems before returning. Almost always redundant -- a gem dedicated to this loop
   exits once it returns, and every attached worker dies with the process owning its GCI connection
   (which is also why ./stop-server.sh, a kill on that process, leaks nothing). It matters in the one
   case where the gem OUTLIVES the loop: an interactive topaz that called #runOnPort: and was then
   stopped in-image. There the workers would sit logged in, holding login slots and transaction
   views, until that session happened to end."
  self log: 'Released ' , self closeAllSessions printString , ' worker gem(s).'.
  self log: 'McpRouter stopped.'.
  ^self
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
    (self drain: outbox to: conn) ifFalse: [^true].
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
  (sess outbox add: (McpJson write: (self request: aMethodString params: aDictOrNil id: rid))) ifFalse: [
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
serveCall: body id: anIdOrNil forSession: sess on: conn
  "Answer one routed request as a single JSON object -- what this server has always done, and still
   does for everything that did not ask to be kept informed. 202 for a notification, whose worker
   answer is empty because a notification gets no response.
   The session gates already ran in #serveRouted:id:progressToken:sessionId:on:."
  | resp |
  resp := [sess forward: body lifetimeBounds: (self lifetimeBoundsFor: sess) requestId: anIdOrNil]
    on: McpError
    do: [:ex |
      ex kind = #cancelled ifTrue: [^self acknowledgeCancelledCall: sess on: conn].
      ex kind = #timeout
        ifTrue: [^self writeTimeoutError: ex forSession: sess id: anIdOrNil on: conn]
        ifFalse: [ex pass]].
  resp isEmpty
    ifTrue: [conn writeStatus: 202 reason: 'Accepted' body: '']
    ifFalse: [conn writeJson: resp]
%
category: 'routing'
method: McpRouter
serveCancellation: parsed sessionId: sid on: conn
  "A notifications/cancelled the client POSTed: it no longer wants the request named in
   params.requestId. Per the Streamable HTTP spec a notification the server accepts MUST be answered
   202 Accepted with no body, and the session gates are the same as on every other verb.
   All this does is hand the id to the session, which matches it against the call actually in flight
   and sets a flag (McpSession>>requestCancel:). The ending itself happens in the GsProcess running
   that call, which is the only one entitled to touch the worker.
   Measured 2026-08-31: Claude Code sends this within seconds of the user pressing Esc, with the
   right requestId, and does NOT close the response stream -- so this notification, not a dropped
   connection, is how a cancellation actually arrives at this server today."
  | sess params requestId |
  sid isNil ifTrue: [
    ^self writeSessionError: 'Missing MCP-Session-Id header (call initialize first)' code: 400 reason: 'Bad Request' on: conn].
  sess := self sessionAt: sid.
  sess isNil ifTrue: [
    ^self writeSessionError: 'Unknown or expired session: ' , sid code: 404 reason: 'Not Found' on: conn].
  params := parsed at: 'params' ifAbsent: [nil].
  requestId := (params isKindOf: Dictionary)
    ifTrue: [params at: 'requestId' ifAbsent: [nil]]
    ifFalse: [nil].
  (sess requestCancel: requestId) ifTrue: [
    self log: 'MCP session ' , sess id printString , ': client cancelled request '
      , requestId printString , '.'].
  conn writeStatus: 202 reason: 'Accepted' body: ''
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
   status codes as the POST path (serveRouted:id:sessionId:on:) so a client gets one consistent signal
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
  conn writeJson: (sess forward: (req at: 'body' ifAbsent: [''])
    lifetimeBounds: (self lifetimeBoundsFor: sess)) sessionId: sess id
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
   here to route it (is it initialize? is it well-formed? is it asking to be kept informed?); full
   request handling is the worker's.
   That last question is the one exception to 'only enough to route it', and it is not a slip. A
   tools/call carrying a progressToken is answered as an SSE stream rather than one JSON object, and
   the Content-Type has to be chosen BEFORE the worker is called -- so the front end has to look
   inside params._meta, because the worker cannot be what decides how its own answer is framed. See
   #progressTokenFor:accepting:."
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
  "A cancellation is likewise not routable, for a sharper reason: routing it would queue it on the
   worker mutex BEHIND the very call it is asking to stop, and it would be acted on -- if the word
   applies -- only once that call had finished on its own. Measured at 17 seconds on a 20-second
   call before this existed. It is handled here, where the session is reachable without the worker."
  method = 'notifications/cancelled'
    ifTrue: [^self serveCancellation: parsed sessionId: (self sessionIdOf: req) on: conn].
  method = 'initialize' ifTrue: [^self serveInitialize: req on: conn].
  ^self serveRouted: body
      id: (parsed at: 'id' ifAbsent: [nil])
      progressToken: (self progressTokenFor: parsed accepting: req)
      sessionId: (self sessionIdOf: req)
      on: conn
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
serveRouted: body id: anIdOrNil progressToken: aTokenOrNil sessionId: sid on: conn
  "Route a non-initialize request to the client's worker by session id (required), and answer it in
   whichever of the two shapes the request asked for.
   The session gates come FIRST and are the same for both shapes -- 400 without an id, 404 for one
   this server does not know -- which is why they live here rather than in either of the two methods
   below. They have to: a stream cannot be opened before it is known there is a session to serve, or
   the refusal would have to be written into a response already committed to being a stream.
   aTokenOrNil decides the framing (#progressTokenFor:accepting:): nil is the ordinary JSON answer
   this server has always given, non-nil an SSE stream carrying the answer as a frame.
   anIdOrNil is the JSON-RPC id the request arrived with, carried in for one case: a call this server
   ENDED (McpSession>>endCallBecause:) is answered here rather than by the worker, and the answer
   has to bear the id the client is waiting on."
  | sess |
  sid isNil ifTrue: [^self writeSessionError: 'Missing MCP-Session-Id header (call initialize first)' code: 400 reason: 'Bad Request' on: conn].
  sess := self sessionAt: sid.
  sess isNil ifTrue: [^self writeSessionError: 'Unknown or expired session: ' , sid code: 404 reason: 'Not Found' on: conn].
  ^aTokenOrNil isNil
    ifTrue: [self serveCall: body id: anIdOrNil forSession: sess on: conn]
    ifFalse: [self serveStreamedCall: body id: anIdOrNil progressToken: aTokenOrNil
                forSession: sess on: conn]
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
category: 'routing'
method: McpRouter
serveStreamedCall: body id: anIdOrNil progressToken: aToken forSession: sess on: conn
  "Answer one tools/call as an SSE stream instead of a single JSON object, because the client put a
   progressToken in the request and so asked to be kept informed while it runs.
   The stream is REQUEST-SCOPED: it belongs to this POST, it carries only messages about this call,
   and it ends with this call's response. That is not a stylistic choice -- progress is request-scoped
   in every revision of the spec, and the draft bars it from the long-lived stream outright, so the
   standalone GET stream (#serveGetStream:forSession:) is the wrong connection for it however
   convenient its drain loop looks.
   Nothing streams YET: the headers go out, the call runs, the response follows as one frame. What
   this method establishes is the SHAPE -- that a tools/call can be answered on an open stream at
   all -- which is worth having on its own, because it is the half of progress that depends on a
   client behaving the way the spec says it must, and it can be verified without a line of cross-gem
   code.
   Once the headers are written there is no second HTTP response to be had, so every ending has to be
   a frame on this stream: an ended call gets #writeTimeoutFrame:forSession:id:on:, and any other
   error is caught HERE rather than reaching handleConnection:, whose 500 would be appended to a
   stream as if it were a fresh response and read as garbage.
   A nil from a write is the client having gone; nothing more is owed to it."
  | resp gone delivered channel |
  (conn writeSseStreamHeaders) ifNil: [^self].
  channel := self registerChannelForToken: aToken session: sess.
  resp := [[[ | answer |
    answer := sess forward: body
      lifetimeBounds: (self lifetimeBoundsFor: sess)
      requestId: anIdOrNil
      progressCallId: channel callId
      whileWaiting: [self drain: channel to: conn].
    "Catch up on the worker's LAST tick before the channel is unregistered. The worker sends its
     final tick and returns in the same breath, so that tick is still sitting in the Stone's queue
     when this call's ensure: forgets the channel, and the poller -- up to #signalPollMilliseconds
     later -- then finds nowhere to put it. Every reported call lost its last step that way, which is
     the one saying the work is finished."
    self drainWorkerSignals.
    answer]
    on: McpError
    do: [:ex |
      ex kind = #cancelled ifTrue: [^self releaseSessionIfAbandoned: sess].
      ex kind = #timeout
        ifTrue: [^self writeTimeoutFrame: ex forSession: sess id: anIdOrNil on: conn]
        ifFalse: [ex pass]]]
    on: Error
    do: [:ex |
      self log: 'Streamed call failed for MCP session ' , sess id printString , ': '
        , ([ex description] on: Error do: [:x | ex class name asString]).
      ^conn writeSseData: (self internalErrorFor: anIdOrNil)]]
    ensure: [self forgetChannel: channel].
  "Any tick that arrived while the worker was answering, before the response goes out after it: the
   spec requires progress to STOP at completion, so this is the last chance to write one and it must
   come before the answer."
  self drain: channel to: conn.
  "An empty answer means a notification, which cannot reach here: only a tools/call is streamed and
   a tools/call always carries an id. Ending the stream is still the right thing to do with one."
  resp isEmpty ifTrue: [^self].
  gone := conn clientHasClosed.
  delivered := (conn writeSseData: resp) notNil.
  self traceStreamedAnswerFor: sess goneBefore: gone delivered: delivered.
  ^self
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
category: 'view hygiene'
method: McpRouter
sessionsHoldingOldestCr
  "The stone session ids holding the repository's OLDEST commit record open, as an Array; empty if
   the question cannot be answered.
   Needs no privilege, unlike reading another session's description, and answers in one call exactly
   which sessions are the reason a backlog is not draining. That makes it both the enrichment for
   the log line and the discriminator for the stone-pressure case: pressure plus THIS session is a
   reason to act, where pressure alone is not."
  ^[System sessionsReferencingOldestCr asArray] on: Error do: [:ex | #()]
%
category: 'progress'
method: McpRouter
signalPollMilliseconds
  "How long the signal poller sleeps between passes. It is a Delay, so it YIELDS -- the accept loop,
   the reaper and every open stream keep running while it waits.
   100ms is the latency floor for every progress notification this server sends, and it is a poll
   rather than an interrupt on purpose: InterSessionSignal CAN be made to raise in the receiving gem
   (enableSignalling), which would interrupt whatever the router happened to be doing at the time.
   Polling costs a wakeup ten times a second and can interrupt nothing."
  ^100
%
category: 'view hygiene'
method: McpRouter
stoneBacklogCritical
  "Whether the repository's commit-record backlog is above the stone's OWN threshold for
   aggressively disposing commit records (StnCrBacklogThreshold). False whenever either number is
   unreadable or the threshold is disabled -- an unknown is never treated as pressure.
   This is a fact about the repository and not about any session, so it is never a sufficient reason
   to move a particular client's view; see #maintainViewHygiene for the conjunction it appears in."
  | backlog threshold |
  backlog := self stoneCommitRecordBacklog.
  backlog isNil ifTrue: [^false].
  threshold := self stoneCrBacklogThreshold.
  threshold isNil ifTrue: [^false].
  ^backlog > threshold
%
category: 'view hygiene'
method: McpRouter
stoneCommitRecordBacklog
  "How many commit records the repository is holding, or nil if unreadable. The stone's own
   CommitRecordCount statistic -- the number this whole arm exists to keep down."
  ^[System commitRecordBacklog] on: Error do: [:ex | nil]
%
category: 'view hygiene'
method: McpRouter
stoneCrBacklogThreshold
  "The backlog above which the stone aggressively disposes commit records
   (STN_CR_BACKLOG_THRESHOLD), or nil if unreadable or disabled.
   The stone answers this ALREADY RESOLVED. system.conf documents -1 as meaning twice
   STN_MAX_SESSIONS, but measured on db-1 -- which sets neither -- the runtime read answers 80 with
   StnMaxSessions of 10, so resolving -1 here would compute 20 and be WRONG about the number the
   stone is actually using. The two documented special values are still mapped defensively, in case
   some version answers the raw setting: 0 means disabled, and a negative means 'the stone did not
   resolve it for us', which is an unknown rather than a threshold of nothing."
  | v |
  v := [System stoneConfigurationAt: #StnCrBacklogThreshold] on: Error do: [:ex | nil].
  (v isKindOf: Integer) ifFalse: [^nil].
  v <= 0 ifTrue: [^nil].
  ^v
%
category: 'view hygiene'
method: McpRouter
stoneSignalAbortCrBacklog
  "The backlog above which the stone sigAborts a gem that is outside a transaction and holding the
   oldest commit record (STN_SIGNAL_ABORT_CR_BACKLOG, default 20), or nil if unreadable.
   Read for its NUMBER, not for its behaviour: nothing in this server is eligible for that sigAbort
   in the first place. Worker gems are permanently in transaction (an in-transaction gem is immune
   unless it has called #enableSignaledFinishTransactionError, which nothing here does), and the
   front end keeps itself off the oldest record by refreshing every pass. What the number is good
   for is calibration -- it is the stone's own statement of how far behind is too far."
  | v |
  v := [System stoneConfigurationAt: #StnSignalAbortCrBacklog] on: Error do: [:ex | nil].
  ^(v isKindOf: Integer) ifTrue: [v] ifFalse: [nil]
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
category: 'running'
method: McpRouter
streamPollMilliseconds
  "How long a drain loop sleeps between ticks. It is a Delay, so it YIELDS -- that is what lets the
   accept loop, the reaper and every other stream keep running while this one is held open. A
   latency/wakeup tradeoff: 100ms puts a notification on the wire promptly without spinning."
  ^100
%
category: 'routing'
method: McpRouter
timeoutErrorFor: anError id: anIdOrNil
  "The JSON-RPC error body for a request this server ENDED, as a JSON String.
   The code is -32001, in JSON-RPC's implementation-defined server-error range, and `data.kind`
   carries the same machine-readable classification a worker-raised error would
   (McpDispatcher>>kindForError:), so a client branches the same way wherever the error was produced.
   It bears the request's own id, and that is the point: an answer the client cannot match to the
   request it is waiting on is no better than silence -- it would wait out its own timeout instead,
   which is the whole thing ending a call early exists to prevent.
   Built here rather than inside either writer because the two writers differ only in FRAMING: a
   plain call gets it as the HTTP response body, a streamed one as an SSE frame on the stream already
   open (#writeTimeoutFrame:forSession:id:on:)."
  | err |
  err := Dictionary new.
  err at: 'jsonrpc' put: '2.0'; at: 'id' put: anIdOrNil.
  err at: 'error' put: (Dictionary new
    at: 'code' put: -32001;
    at: 'message' put: anError description;
    at: 'data' put: (Dictionary new at: 'kind' put: anError kind asString; yourself);
    yourself).
  ^McpJson write: err
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
category: 'toolsets'
method: McpRouter
toolsetOptions
  "This deployment's options for its toolsets: a Dictionary of toolset name -> that toolset's own
   options Dictionary, or nil when none are configured. See McpToolset's class comment for what a
   toolset does with them, and toolsetOptions: for what is allowed here."
  ^toolsetOptions
%
category: 'toolsets'
method: McpRouter
toolsetOptions: aDictOrNil
  "Configure the toolsets in this router's surface -- the general answer to 'my toolset needs to know
   something the core does not', so that a vendor's setting does not become a core ivar. Keyed by
   toolset NAME, each value that toolset's own options:

     (McpRouter new
        toolsetOptions: (Dictionary new
          at: 'McpGrailToolset' put: (Dictionary new at: 'grailDirectory' put: '/opt/Grail'; yourself);
          yourself))
       forkOnPort: 8000

   VALIDATED HERE, when it is set, against each toolset's class>>declaredOptionNames -- so a mistyped
   option name is a configuration error naming what that toolset does accept, rather than a setting
   that is silently ignored and found much later. Same choice, and same reasoning, as
   additionalProperties: false on every tool's input schema.

   The toolset classes are resolved in the FRONT END's symbol list, which is where this router runs.
   A worker may log in as a different user (McpAuthRouter), so the worker checks again when it builds
   -- this catches an operator's typo, not a deployment mismatch."
  | validated |
  aDictOrNil isNil ifTrue: [toolsetOptions := nil. ^self].
  validated := Dictionary new.
  aDictOrNil keysAndValuesDo: [:toolsetName :opts | | cls declared |
    cls := McpServer toolsetClassNamed: toolsetName.
    declared := cls declaredOptionNames collect: [:n | n asString].
    (opts isKindOf: Dictionary) ifFalse: [
      ^self error: 'Toolset options for ' , toolsetName asString
        , ' must be a Dictionary of option name -> value.'].
    opts keysDo: [:optName |
      (declared includes: optName asString) ifFalse: [
        ^self error: 'Unknown option ' , optName asString printString , ' for toolset '
          , toolsetName asString , '. It declares: '
          , (declared isEmpty
              ifTrue: ['(none)']
              ifFalse: [declared inject: '' into: [:a :b |
                a isEmpty ifTrue: [b] ifFalse: [a , ', ' , b]]]) , '.']].
    validated at: toolsetName asString put: opts].
  toolsetOptions := validated
%
category: 'message trace'
method: McpRouter
traceLineFor: req
  "The one-line trace of an inbound request req -- verb, path, session id, body size, body -- or a
   line saying the request could not be read when req is nil. Answers the line; writing it is
   #traceRequest:'s job, so this stays a pure function a test can assert on without a gem log.
   Deliberately does NOT report the headers. They carry the Authorization bearer token on
   McpAuthRouter, and a trace an operator turns on to read a tool argument must not be a way to
   collect other people's credentials. The session id is reported because it is the only thing that
   tells two concurrent clients apart in one log, and it is already written in the clear by the
   reaper's lines."
  | body limit line shown |
  req isNil ifTrue: [^'--> (unreadable request: client closed, timed out, or over-long head)'].
  body := req at: 'body' ifAbsent: [''].
  limit := self messageTraceLimit.
  line := WriteStream on: String new.
  line nextPutAll: '--> '; nextPutAll: (req at: 'method' ifAbsent: ['?']).
  line nextPutAll: ' '; nextPutAll: (req at: 'path' ifAbsent: ['?']).
  line nextPutAll: ' session '; nextPutAll: ((self sessionIdOf: req) ifNil: ['-']).
  line nextPutAll: ' '; nextPutAll: body size printString; nextPutAll: ' chars'.
  body isEmpty ifTrue: [^line contents].
  line nextPutAll: ': '.
  shown := (limit notNil and: [body size > limit])
    ifTrue: [body copyFrom: 1 to: limit]
    ifFalse: [body].
  line nextPutAll: (self escapedForTrace: shown).
  "Say how much was dropped, so a reader can tell a long message from a lost one."
  shown size < body size ifTrue: [
    line nextPutAll: ' ...(+'; nextPutAll: (body size - shown size) printString; nextPutAll: ' more)'].
  ^line contents
%
category: 'message trace'
method: McpRouter
traceRequest: req
  "Write the message trace for one inbound request, if this router is tracing (see #messageTrace).
   Costs a single identity comparison when it is off, which is the common case and is why the tap
   can sit on the hot path in #handleConnection:.
   Cannot fail the caller. #log: already swallows a failed write, but BUILDING the line is real work
   on client-supplied bytes, and a trace that turned a request into a 500 would be worse than no
   trace at all."
  messageTrace == true ifFalse: [^self].
  [self log: (self traceLineFor: req)] on: Error do: [:ex | nil]
%
category: 'message trace'
method: McpRouter
traceStreamedAnswerFor: sess goneBefore: goneBoolean delivered: deliveredBoolean
  "Record how a STREAMED answer ended, if this router is tracing. Outbound, unlike everything else
   the trace covers, and here for a reason the inbound lines cannot serve.
   Two facts, and it is the PAIR that makes them evidence: whether the client's connection was
   already gone when the call finished, and whether the final frame reached it. Both false means the
   client waited for its answer and got it. Both true means it stopped listening while the call ran --
   which is the draft revision's ONLY cancellation signal, and which the current revision says a
   server SHOULD NOT read that way, precisely because it cannot tell a client that meant it from a
   network that dropped. Before this server acts on that signal in either direction it is worth
   knowing whether the clients actually in use here ever send it, and a closed stream leaves no
   inbound message to trace -- so without this line it looks exactly like nothing having happened.
   Cannot fail the caller, for the same reason #traceRequest: cannot."
  messageTrace == true ifFalse: [^self].
  [self log: '<-- streamed answer, session ' , sess id printString
    , ': client-gone=' , goneBoolean printString
    , ' delivered=' , deliveredBoolean printString]
      on: Error do: [:ex | nil]
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
   probing anybody -- the same bargain #validateWorkerConfig makes for the worker class.
   Both invariants have the same shape, and both follow from the reaper counting rather than timing:
   each derived count is a division, and #countCovering:every: rounds it up so that a configured
   interval is a floor on what a deployment gets rather than a ceiling. That rounding is honest for
   a remainder and dishonest for a whole interval: an interval shorter than a pass rounds up to a
   pass, which is not the number that was written down. A probe interval shorter than a pass, or an
   idle timeout shorter than a probe interval, is a configuration someone got wrong and should hear
   about rather than have silently multiplied."
  self validateSeconds: requestTimeoutSeconds named: 'requestTimeoutSeconds' allowingNil: true.
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
  "Options were validated against declaredOptionNames when they were SET, but the surface can have
   changed since (toolsetNames: after toolsetOptions:, or a default surface resolved only now), so a
   configured toolset may no longer be in it. Say so rather than dropping it silently: an option that
   can never reach anything is a mistake worth a startup failure, and effectiveToolsetOptions would
   otherwise narrow it away without a word."
  toolsetOptions ifNotNil: [:opts | | names |
    names := self effectiveToolsetNames collect: [:n | n asString].
    opts keysDo: [:k |
      (names includes: k asString) ifFalse: [
        ^self error: 'Toolset options configured for ' , k asString
          , ', which is not in this router''s tool surface ('
          , (names isEmpty
              ifTrue: ['no toolsets']
              ifFalse: [names inject: '' into: [:a :b |
                a isEmpty ifTrue: [b] ifFalse: [a , ', ' , b]]]) , ').']]].
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
category: 'view hygiene'
method: McpRouter
viewHygieneSummary
  "One line naming the view-hygiene policy in force, for the startup banner. Says which numbers are
   in play and, since this step acts on nothing, that it is only watching -- a reader must be able to
   tell a server that found nothing over the line from one that was never going to look."
  | s |
  self hasViewHygiene ifFalse: [^'off (maxCommitsBehind nil) -- worker views are left alone'].
  s := WriteStream on: String new.
  s nextPutAll: 'MEASURING ONLY (nothing is refreshed yet), threshold '.
  s nextPutAll: self commitsBehindLimit printString.
  s nextPutAll: ' commits behind (configured '; nextPutAll: maxCommitsBehind printString.
  s nextPutAll: ', stone StnSignalAbortCrBacklog '.
  s nextPutAll: (self stoneSignalAbortCrBacklog isNil
    ifTrue: ['unreadable']
    ifFalse: [self stoneSignalAbortCrBacklog printString]).
  s nextPutAll: '), stone backlog '.
  s nextPutAll: (self stoneCommitRecordBacklog isNil
    ifTrue: ['unreadable']
    ifFalse: [self stoneCommitRecordBacklog printString]).
  s nextPutAll: '/'.
  s nextPutAll: (self stoneCrBacklogThreshold isNil
    ifTrue: ['disabled']
    ifFalse: [self stoneCrBacklogThreshold printString]).
  ^s contents
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
  conn writeStatus: 400 reason: 'Bad Request' body: (McpJson write: err)
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
  conn writeStatus: httpCode reason: reasonString body: (McpJson write: err)
%
category: 'routing'
method: McpRouter
writeTimeoutError: anError forSession: sess id: anIdOrNil on: conn
  "Answer a request this server ended (McpSession>>endCallBecause:) on a call being answered as
   ordinary JSON.
   HTTP 200 with a JSON-RPC error, not an HTTP error status: the request was accepted, routed and
   served, and what failed is the call inside it -- a result the client should match to its request
   rather than a transport refusal it might not read as JSON-RPC at all. See #timeoutErrorFor:id: for
   the body, and #releaseSessionIfAbandoned: for the one case where ending the call also ends the
   session."
  self releaseSessionIfAbandoned: sess.
  conn writeJson: (self timeoutErrorFor: anError id: anIdOrNil)
%
category: 'routing'
method: McpRouter
writeTimeoutFrame: anError forSession: sess id: anIdOrNil on: conn
  "The same answer as #writeTimeoutError:forSession:id:on:, framed for a call already being answered
   as a stream: the SSE headers went out before the worker was ever called, so there is no second
   HTTP response available and the error has to travel as a frame on the stream that is open.
   Ending the stream afterwards is the caller's business (#serveStreamedCall:id:forSession:on:); what
   matters here is that the client gets a TERMINATING message. A stream that simply stops leaves a
   client waiting on a socket that will never say anything again, which is worse than the timeout it
   was told about -- and the id in the body is what lets it stop waiting on the right request."
  self releaseSessionIfAbandoned: sess.
  ^conn writeSseData: (self timeoutErrorFor: anError id: anIdOrNil)
%
