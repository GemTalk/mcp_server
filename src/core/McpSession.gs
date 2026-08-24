set compile_env: 0
! ------------------- Class definition for McpSession
expectvalue /Class
doit
Object subclass: 'McpSession'
  instVarNames: #( id worker workerMutex
                    lastActivitySeconds userId readOnly workerClassName
                    toolsetNames serverName serverTitle serverVersion
                    workerPid workerStoneSession outbox logLevel
                    probeState idleWarned startedAtSeconds expiresAtSeconds
                    lastProbeAtSeconds lastStreamSeenAtSeconds)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpSession comment: 
'One MCP client''s isolated worker: a GsTsExternalSession gem (its own transaction view) plus the
client''s session id, last-activity time, and (future) userId. The front end (McpRouter) keeps
an id -> McpSession map and routes each request through #forward:, which runs it in this worker
WITHOUT blocking the front-end gem (see #runWorker:), so one client''s long tool call no longer
freezes every other GsProcess in the front end -- including other clients'' requests, which is what
makes McpRouter''s per-connection GsProcesses actually concurrent. Access to the worker is
serialized by a mutex, since GCI allows only one call in flight per session. Idle sessions are
reaped after a timeout, but never while a call is in flight (#isBusy). Workers log in as the
current user for now; userId is reserved for later per-user auth. The worker''s stone session id
and OS process id are captured at login (#cacheWorkerIds): they are what correlate a session with
a gem in ps, and fetching them there also makes the kernel''s printOn: -- which sends those same
two remote accessors -- harmless afterwards.

A session also carries the state the SERVER-INITIATED side of the transport needs, all of it held
by the front end and none of it in the worker: an McpOutbox of messages waiting for this client''s
SSE stream, the log level the client asked for (logging/setLevel), and what the last liveness probe
found. That last one is why reaping is no longer a single clock. #touch -- real MCP traffic -- is
the only thing that resets the idle cycle. A ping the client ANSWERS proves it is still there
(#noteAlive) and earns a genuine warning before the deadline; a ping it never answers proves it is
gone (#noteProbeUnanswered) and frees the gem early, without waiting out the full timeout. What an
answered ping deliberately does NOT do is stamp the activity clock: if it did, every well-behaved
client would hold its worker gem and its transaction view forever, and the warning would only ever
reach clients unable to act on it.'
%
expectvalue /Class
doit
McpSession category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpSession
removeallmethods McpSession
removeallclassmethods McpSession
! ------------------- Class methods for McpSession
category: 'instance creation'
classmethod: McpSession
new
  ^super new initialize
%
category: 'instance creation'
classmethod: McpSession
startWithId: anId
  "Spawn a worker gem (current user, one-time password) and answer a started session with the
   given client id."
  ^self new startWithId: anId
%
category: 'instance creation'
classmethod: McpSession
startWithId: anId readOnly: aBoolean
  "As startWithId:, but marks the local worker read-only when aBoolean (a read-only McpRouter -- a
   localhost convenience so a single user cannot accidentally mutate)."
  ^self new startWithId: anId readOnly: aBoolean
%
category: 'instance creation'
classmethod: McpSession
startWithId: anId user: aUserId jwt: aJwtString
  "Spawn a JWT-authenticated worker gem for aUserId and answer a started session with the given
   client id. See the instance-side method."
  ^self new startWithId: anId user: aUserId jwt: aJwtString
%
category: 'instance creation'
classmethod: McpSession
startWithId: anId user: aUserId jwt: aJwtString readOnly: aBoolean
  "As startWithId:user:jwt:, but marks the worker read-only when aBoolean is true (the token lacked
   the configured write scope -- see McpAuthRouter writeScope)."
  ^self new startWithId: anId user: aUserId jwt: aJwtString readOnly: aBoolean
%
! ------------------- Instance methods for McpSession
category: 'activity'
method: McpSession
ageSeconds
  "How long this session has existed, whatever it has been doing. What an absolute lifetime cap is
   measured against, unlike #idleSeconds."
  ^System timeGmt - startedAtSeconds
%
category: 'logging'
method: McpSession
allowsLogLevel: aLevelString
  "Whether a notifications/message at aLevelString is at or above the severity this client asked
   for with logging/setLevel. An unknown level is let through rather than swallowed: dropping a
   message because the SERVER mislabelled it would hide exactly the events worth seeing."
  | wanted sending |
  wanted := McpBase logLevelRank: self logLevel.
  sending := McpBase logLevelRank: aLevelString.
  (wanted isNil or: [sending isNil]) ifTrue: [^true].
  ^sending >= wanted
%
category: 'initialization'
method: McpSession
cacheWorkerIds
  "Fetch the worker gem's stone session id and OS process id once, immediately after login, and hold
   them here. Two independent reasons, either of which would justify the two calls.
   Diagnostics: these are what tie an Mcp-Session-Id to a gem in ps and to a row in
   System currentSessions. Log THESE, never the worker itself.
   Safety: GsTsExternalSession>>printOn: sends these same two accessors, and each is a memoizing
   REMOTE call -- so printing a worker that nothing has queried performs a GCI call, which overwrites
   that worker's lastResult. A print between the nbExecute: and the lastResult read in #runWorker:
   would then answer a client with the gem's pid where its JSON-RPC response belongs. Fetching them
   here leaves the kernel's own instance variables set for the worker's whole life (only logout
   clears them), so any later print is inert.
   Both sends are BLOCKING GCI calls, deliberately: they run at login, where the gem already blocks
   on #login for far longer, and this is the one moment when nothing is in flight. Never send them
   from the forwarding path.
   The two round trips cannot be folded into one. It is the ACCESSOR sends that populate those
   instance variables, so fetching both values in a single executeString: would leave printOn: still
   calling out. Do not add #stoneSessionSerial either: a third memoizing remote accessor, another
   round trip, and printOn: does not reach it."
  workerStoneSession := worker stoneSessionId.
  workerPid := worker gemProcessId
%
category: 'lifecycle'
method: McpSession
close
  "Terminate the worker gem. It is attached (the front end drives it via executeString:), so a
   logout stops it.
   The outbox is only marked CLOSING, not closed: whatever is queued -- a session-ending notice
   above all -- is still owed to the client, and the drain loop closes the outbox itself once it has
   written it. Closing outright here would kill the stream in the same instant as the gem and drop
   the one message explaining why."
  outbox ifNotNil: [:o | o beginClosing].
  [worker logout] on: Error do: [:e | nil].
  ^self
%
category: 'liveness'
method: McpSession
expiresAtSeconds
  "The absolute wall-clock second at which this session must end regardless of activity, or nil when
   nothing bounds it. Set by an authenticated front end from the access token's exp (see
   McpAuthRouter>>openSessionForUser:jwt:readOnly:): the worker gem is logged in as that token's
   user, so letting the session outlive the token would leave the authorization it was granted in
   force after the grant expired."
  ^expiresAtSeconds
%
category: 'liveness'
method: McpSession
expiresAtSeconds: aSecondOrNil
  "Bind this session to an absolute deadline (nil removes it). Only ever moved EARLIER: a caller may
   tighten a deadline, never extend one that is already in force, so a later, laxer policy cannot
   hand a session more life than the credential it was opened with allowed."
  aSecondOrNil isNil ifTrue: [^self].
  (expiresAtSeconds isNil or: [aSecondOrNil < expiresAtSeconds])
    ifTrue: [expiresAtSeconds := aSecondOrNil].
  ^self
%
category: 'session lifetime'
method: McpSession
renewExpiryTo: aSecondOrNil
  "Move this session's existing deadline LATER, to aSecondOrNil, because its client has just proved
   a fresh credential that runs that long. Answers whether the deadline actually moved.
   The counterpart to #expiresAtSeconds:, and deliberately a separate selector rather than a relaxed
   ratchet. That ratchet conflates two invariants: a session must not outlive its CURRENT grant,
   which has to hold, and a session must not outlive its FIRST grant, which nothing requires. Access
   tokens are short by design -- thirty minutes is a common default -- so under the ratchet alone a
   client working steadily still loses its worker gem, and the uncommitted transaction inside it, on
   the first maintenance pass after its opening token's exp. Refreshing cannot save it, because the
   renewed token was never consulted about lifetime. That is silent data loss, not an inconvenience:
   the client obtains a new token, opens a new session, and nothing looks broken.
   Two boundaries are kept. A nil argument moves nothing, so a token with no readable exp cannot
   turn a bounded session unbounded. And a session with no deadline at all is left alone: renewal
   extends a deadline, it never introduces one -- that is #expiresAtSeconds:'s job. So the pair is
   strictly complementary, one tightening and one extending, and neither can do the other's work.
   Only the authenticated request path may send this, and only after the token's signature, subject
   and write scope have been checked -- see McpAuthRouter>>renewSessionExpiry:from:."
  aSecondOrNil isNil ifTrue: [^false].
  expiresAtSeconds isNil ifTrue: [^false].
  aSecondOrNil <= expiresAtSeconds ifTrue: [^false].
  expiresAtSeconds := aSecondOrNil.
  ^true
%
category: 'liveness'
method: McpSession
forgiveSuspendedSeconds: anInteger
  "The host was suspended (or the front-end gem was otherwise not running) for anInteger seconds, so
   move this session's idle clock forward by that much: no service was offered during it, and idleness
   is a measure of service time, not of wall time. See McpRouter>>forgiveSuspendedSeconds:.
   Deliberately NOT applied to #expiresAtSeconds or to #ageSeconds: an expiry is an absolute
   commitment (a token's exp does not pause because a laptop slept), and forgiving it would be a
   security regression rather than a courtesy. Also drops whatever the last probe concluded -- a
   verdict reached across a suspend is about the suspend, not about the client."
  anInteger > 0 ifFalse: [^self].
  lastActivitySeconds := lastActivitySeconds + anInteger.
  probeState := nil.
  lastProbeAtSeconds := nil.
  idleWarned := false.
  ^self
%
category: 'routing'
method: McpSession
forward: aRawJsonString
  "Run a JSON-RPC request in this client's worker gem (an isolated session) and answer the JSON
   response string ('' for a notification). Runs WITHOUT stalling the front-end gem -- see
   #runWorker:, which is what keeps one client's long tool call from freezing every other GsProcess
   in the front end. The request is embedded via printString for safe quoting."
  self touch.
  ^self runWorker: (self workerExpressionFor: aRawJsonString)
%
category: 'accessing'
method: McpSession
id
  ^id
%
category: 'activity'
method: McpSession
idleSeconds
  ^System timeGmt - lastActivitySeconds
%
category: 'activity'
method: McpSession
idleWarned
  "Whether this client has already been told its session is nearing the idle deadline. Cleared by
   #touch, so the warning is sent once per idle period rather than on every reaper cycle."
  ^idleWarned == true
%
category: 'initialization'
method: McpSession
initialize
  "Seed the front-end-side state. The outbox is built HERE rather than on demand: nothing prepares
   it the way #prepareWorker prepares the worker before the session is registered, so two
   GsProcesses -- an arriving GET stream and the reaper -- really could race to create it."
  outbox := McpOutbox new.
  logLevel := nil.
  probeState := nil.
  idleWarned := false.
  startedAtSeconds := System timeGmt.
  expiresAtSeconds := nil.   "nil = no absolute deadline; McpAuthRouter sets one from the token exp"
  lastProbeAtSeconds := nil.
  ^self
%
category: 'activity'
method: McpSession
isBusy
  "Whether a call into this session's worker gem is in flight. Asked by the idle reaper: #forward:
   stamps the activity clock when a call STARTS, so a request that runs longer than the idle timeout
   would otherwise be reaped -- and its worker logged out -- while it was still running. That could
   not happen while forwarding blocked the whole front-end gem, because the reaper could not run
   either. Cheap: it reads the external session's own state and makes no GCI call."
  ^worker notNil and: [worker isCallInProgress]
%
category: 'liveness'
method: McpSession
isExpired
  "Whether this session has passed the absolute deadline it was opened with (see #expiresAtSeconds).
   Unlike idleness this is never forgiven and never probed around: the reaper frees such a session
   whatever its client is doing."
  ^expiresAtSeconds notNil and: [System timeGmt >= expiresAtSeconds]
%
category: 'liveness'
method: McpSession
isKnownAlive
  "Whether this client answered its liveness ping. Only such a session is worth warning: it has an
   open stream and something at the other end of it."
  ^probeState == #alive
%
category: 'liveness'
method: McpSession
isKnownGone
  "Whether a liveness ping this client was sent went unanswered. The reaper frees such a session's
   worker gem immediately: the ping went down a stream the client itself opened, so silence is
   evidence, not merely absent traffic."
  ^probeState == #gone
%
category: 'liveness'
method: McpSession
isProbeOutstanding
  "Whether a liveness ping is waiting for its answer, so the reaper neither sends another nor
   decides anything yet."
  ^probeState == #sent
%
category: 'accessing'
method: McpSession
lastActivitySeconds
  ^lastActivitySeconds
%
category: 'logging'
method: McpSession
logLevel
  "The minimum severity this client wants in notifications/message. 'info' until it says otherwise
   with logging/setLevel -- quiet enough to keep debug chatter off the stream, low enough that the
   idle warning (a 'warning') is never filtered out by default."
  ^logLevel ifNil: ['info']
%
category: 'logging'
method: McpSession
logLevel: aLevelString
  "Record the level from logging/setLevel. The front end enforces it, because the front end is what
   generates these notifications and owns the stream they go down -- see
   McpRouter>>noteLogLevelFrom:sessionId:."
  logLevel := aLevelString
%
category: 'initialization'
method: McpSession
newWorkerSession
  "A fresh, not-yet-logged-in GsTsExternalSession worker gem on localhost. GsTsExternalSession is
   assumed present -- it exists in every supported image (GemStone 3.6.2+)."
  ^GsTsExternalSession newDefaultForGemHost: 'localhost'
%
category: 'activity'
method: McpSession
noteAlive
  "The client answered a liveness ping. It is there; its worker gem is spared the early reap and
   earns a real warning before the idle deadline. Deliberately NOT #touch -- see the class comment."
  probeState := #alive.
  ^self
%
category: 'activity'
method: McpSession
noteIdleWarned
  "Remember that the near-the-deadline warning has been sent for this idle period."
  idleWarned := true.
  ^self
%
category: 'activity'
method: McpSession
noteProbeDiscarded
  "Throw away an outstanding liveness probe WITHOUT concluding anything from it. For a ping that
   was written to a stream the client has since replaced, the write succeeded -- into a socket
   buffer nobody will ever read -- so the silence that follows is evidence about the transport and
   not about the client. Treating it as proof of death frees a worker gem whose client is alive,
   connected, and holding a perfectly good stream (measured: 6 of 14 pings, 2026-08-23).
   Clearing the probe stamp too, so the next pass sends a fresh ping down the CURRENT stream rather
   than waiting out the cadence on a verdict that never arrived."
  probeState == #sent ifTrue: [probeState := nil].
  lastProbeAtSeconds := nil.
  ^self
%
category: 'activity'
method: McpSession
noteProbeSent
  "A liveness ping is on its way; the reaper waits for the answer rather than sending another.
   The time is stamped as well, because a session with no wall-clock deadline is re-probed on a
   cadence (McpRouter>>livenessProbeIntervalSeconds) rather than once per idle period."
  probeState := #sent.
  lastProbeAtSeconds := System timeGmt.
  ^self
%
category: 'activity'
method: McpSession
noteProbeUnanswered
  "The liveness ping timed out. Only a ping actually in flight can fail this way -- a session the
   client has since spoken to has already been reset by #touch, and must not be marked gone by a
   verdict on a probe that no longer applies."
  probeState == #sent ifTrue: [probeState := #gone].
  ^self
%
category: 'liveness'
method: McpSession
noteStreamSeen
  "Record that this client had an SSE stream open just now. Stamped by the front end's maintenance
   pass, the only regular observer of the fact (McpRouter>>maintainIdleSession:), and read by
   #unreachableSeconds -- so its resolution is one maintenance interval, which is ample for the
   half-hour scale the streamless fallback works at."
  lastStreamSeenAtSeconds := System timeGmt.
  ^self
%
category: 'accessing'
method: McpSession
outbox
  "This session's queue of server-initiated messages, waiting for its SSE stream. Front-end state:
   the worker gem neither has one nor could write to it."
  ^outbox
%
category: 'initialization'
method: McpSession
prepareWorker
  "Prepare this client's worker gem in ONE call, before any request reaches it: set read-only, resolve
   the named toolsets, apply the advertised identity, and pre-build the server instance. The front end
   calls this after configuring the session (McpRouter>>openSessionCreating:) and BEFORE the session is
   registered, so there is no window in which a request could run unprepared.
   One round trip replaces the conditional 'sessionReadOnly:' send this used to make, and it moves tool
   registration off the client's first request. A worker class or toolset the worker cannot resolve
   fails HERE, where the message can say what to fix -- see McpServer class>>toolsetClassNamed:."
  ^[self runWorker: self workerBootstrapExpression]
    on: Error
    do: [:ex | self error: 'Could not prepare the MCP worker gem for session ' , id printString
      , ' (worker class ' , self workerClassName , '): '
      , ([ex description] on: Error do: [:x | ex class name asString])]
%
category: 'private'
method: McpSession
quotedNameArrayFor: aCollectionOfNames
  "aCollectionOfNames as a Smalltalk literal array of strings, e.g. #('McpBrowsingToolset' ) -- for
   embedding in the worker bootstrap expression. Empty answers #(), which legitimately means a worker
   with no tools at all."
  | s |
  s := WriteStream on: String new.
  s nextPutAll: '#('.
  (aCollectionOfNames ifNil: [#()]) do: [:n |
    s nextPutAll: n asString printString; nextPut: Character space].
  s nextPut: $).
  ^s contents
%
category: 'accessing'
method: McpSession
readOnly
  "Whether this client's worker is read-only. Recorded when the session starts and applied to the
   worker gem by prepareWorker."
  ^readOnly == true
%
category: 'private'
method: McpSession
runWorker: anExpressionString
  "Run anExpressionString in this session's worker gem and answer its result -- the one place that
   drives the worker, and non-blocking on purpose. A blocking executeString: blocks in C, so while
   one ran the front-end gem executed no Smalltalk and NO GsProcess in it ran: other clients'
   requests, the accept loop, the reaper, every open SSE stream. A wait on the session's socket
   suspends only THIS GsProcess.
   Two traps in that API, each able to corrupt a response silently. The result must be read with
   #lastResult, because #waitForResultForSeconds: consumes it internally and a later #nbResult then
   fails. And it must be read only once #isCallInProgress answers false, because after a wait that
   timed out #lastResult still holds the PREVIOUS call's value. No deadline is imposed, so a worker
   still gets as long as it takes.
   The mutex is what keeps two requests from colliding in one worker -- GCI allows one call in flight
   per session, which the blocking call used to guarantee by freezing the gem. A worker-side error
   arrives as the same GciError as before, and leaves the worker usable."
  ^self workerMutex critical: [
    worker nbExecute: anExpressionString.
    [worker isCallInProgress]
      whileTrue: [worker waitForResultForSeconds: self workerWaitSeconds otherwise: [nil]].
    self touch.
    worker lastResult]
%
category: 'liveness'
method: McpSession
secondsSinceProbe
  "How long since a liveness ping was last sent to this client, or nil if none has been sent since
   the idle cycle last restarted. What the re-probe cadence for a session with no wall-clock
   deadline is measured against."
  ^lastProbeAtSeconds isNil ifTrue: [nil] ifFalse: [System timeGmt - lastProbeAtSeconds]
%
category: 'accessing'
method: McpSession
serverName: aStringOrNil
  "The serverInfo name this worker should advertise (nil = the worker's own default)."
  serverName := aStringOrNil
%
category: 'accessing'
method: McpSession
serverTitle: aStringOrNil
  "The serverInfo title this worker should advertise (nil = no instance label, so no title key)."
  serverTitle := aStringOrNil
%
category: 'accessing'
method: McpSession
serverVersion: aStringOrNil
  serverVersion := aStringOrNil
%
category: 'initialization'
method: McpSession
startWithId: anId
  "Local worker login with full read-write access (see the readOnly: variant)."
  ^self startWithId: anId readOnly: false
%
category: 'initialization'
method: McpSession
startWithId: anId readOnly: aBoolean
  "Log in a fresh worker gem as the current (server) user via a one-time password (the local,
   unauthenticated front end, McpRouter). When aBoolean, mark the worker read-only for its whole
   life -- set inside the worker gem itself, so it needs no commit and is private to that gem."
  id := anId.
  userId := System myUserProfile userId.
  worker := self newWorkerSession.
  worker useOnetimePassword.
  worker login.
  self cacheWorkerIds.
  readOnly := aBoolean.
  self touch.
  ^self
%
category: 'initialization'
method: McpSession
startWithId: anId user: aUserId jwt: aJwtString
  "JWT worker login with full read-write access (see the readOnly: variant)."
  ^self startWithId: anId user: aUserId jwt: aJwtString readOnly: false
%
category: 'initialization'
method: McpSession
startWithId: anId user: aUserId jwt: aJwtString readOnly: aBoolean
  "Log in a fresh worker gem authenticated by a JWT (an OAuth/OIDC access token), for the
   network-facing authenticated front end (McpAuthRouter). The caller has already validated the
   token and derived aUserId from its claims; GemStone re-validates the JWT's signature (against its
   trusted keys) and claims when the worker logs in -- a bad/expired token fails the login. When
   aBoolean is true the worker is marked read-only for its whole life (its token lacked the write
   scope) -- set inside the worker gem itself, so it needs no commit and cannot affect other sessions."
  id := anId.
  userId := aUserId.
  worker := self newWorkerSession.
  worker username: aUserId.
  worker jwtPassword: aJwtString.
  worker login.
  self cacheWorkerIds.
  readOnly := aBoolean.
  self touch.
  ^self
%
category: 'accessing'
method: McpSession
toolsetNames: aCollectionOfNamesOrNil
  "The toolsets this worker should register, as resolved by the front end
   (McpRouter>>effectiveToolsetNames)."
  toolsetNames := aCollectionOfNamesOrNil
%
category: 'activity'
method: McpSession
touch
  "Record now (GMT seconds) as the last activity, for idle-timeout reaping, and start the idle cycle
   over: a client that has just made a real MCP call needs no warning and no liveness probe, and
   whatever the last probe concluded is now out of date."
  lastActivitySeconds := System timeGmt.
  probeState := nil.
  lastProbeAtSeconds := nil.
  idleWarned := false.
  ^self
%
category: 'liveness'
method: McpSession
unreachableSeconds
  "How long this client has been impossible to speak to: 0 while a stream is attached, otherwise the
   time since one last was -- or, for a client that never opened one at all, simply how long it has
   been idle.
   This is what a router with NO idle deadline reaps on, and it deliberately is not the same as
   idleness. A quiet client holding an open stream is answering pings and can be told anything; a
   client with no stream can be told nothing and asked nothing, so it is the only kind that liveness
   cannot speak for."
  outbox hasStream ifTrue: [^0].
  lastStreamSeenAtSeconds isNil ifTrue: [^self idleSeconds].
  ^System timeGmt - lastStreamSeenAtSeconds
%
category: 'accessing'
method: McpSession
userId
  ^userId
%
category: 'private'
method: McpSession
workerBootstrapExpression
  "The one expression prepareWorker runs in the worker gem. Sent to the worker CLASS the front end
   named, so the worker instantiates what it is told rather than choosing for itself. Names are plain
   identifiers (McpRouter validated them when the router was configured) and the strings are embedded
   via printString, so this cannot smuggle anything into the worker's compiler. That printString is
   load-bearing for the title in particular: unlike a name or a version it is free-form operator prose,
   so quotes in it must be doubled rather than closing the literal."
  ^self workerClassName
    , ' prepareWorkerWithToolsets: ' , (self quotedNameArrayFor: toolsetNames)
    , ' readOnly: ' , self readOnly printString
    , ' serverName: ' , (serverName isNil ifTrue: ['nil'] ifFalse: [serverName printString])
    , ' title: ' , (serverTitle isNil ifTrue: ['nil'] ifFalse: [serverTitle printString])
    , ' version: ' , (serverVersion isNil ifTrue: ['nil'] ifFalse: [serverVersion printString])
%
category: 'accessing'
method: McpSession
workerClassName
  "The class this session's worker instantiates and dispatches through. Set by the front end
   (McpRouter>>effectiveWorkerClassName); McpServer when nothing is configured, which also keeps a
   directly-created session usable."
  ^workerClassName ifNil: ['McpServer']
%
category: 'accessing'
method: McpSession
workerClassName: aNameOrNil
  workerClassName := aNameOrNil
%
category: 'routing'
method: McpSession
workerExpressionFor: aRawJsonString
  "The expression forward: runs in the worker gem: the NAMED worker class handles the request, so the
   worker never decides which server class to build. The request body is embedded via printString for
   safe quoting."
  ^self workerClassName , ' handleJsonString: ' , aRawJsonString printString
%
category: 'private'
method: McpSession
workerMutex
  "The lock #runWorker: holds while a call is in flight in this session's worker gem. Created on
   demand rather than at login, which is safe because the front end configures AND prepares a
   session (McpRouter>>openSessionCreating:, which sends #prepareWorker) before it registers the
   session in the id -> session map: the first send always happens before any request can reach
   this session, so no two GsProcesses can race to create it."
  ^workerMutex ifNil: [workerMutex := Semaphore forMutualExclusion]
%
category: 'accessing'
method: McpSession
workerPid
  "The worker gem's OS process id, captured at login by #cacheWorkerIds -- what matches this session
   to a gem in ps or to its gem log. Log this instead of the worker, which cannot be printed without
   side effects."
  ^workerPid
%
category: 'accessing'
method: McpSession
workerStoneSession
  "The worker gem's stone session id, captured at login by #cacheWorkerIds -- what matches this
   session to a row in System currentSessions. Log this instead of the worker, which cannot be
   printed without side effects."
  ^workerStoneSession
%
category: 'private'
method: McpSession
workerWaitSeconds
  "How long one wait for a worker result may sleep before #runWorker: re-checks whether the call is
   done. It bounds the re-check interval only, not latency: the wait answers as soon as the worker
   does, because it is waiting on the session's socket."
  ^1
%
