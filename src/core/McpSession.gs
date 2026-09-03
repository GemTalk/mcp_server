set compile_env: 0
! ------------------- Class definition for McpSession
expectvalue /Class
doit
Object subclass: 'McpSession'
  instVarNames: #( id worker workerMutex
                    lastActivitySeconds userId readOnly workerClassName
                    toolsetNames toolsetOptions serverName serverTitle
                    serverVersion workerPid workerStoneSession outbox
                    startedAtSeconds expiresAtSeconds quietProbes unansweredProbes
                    streamlessPasses passesSinceProbe streamClosedByClient requestTimeoutSeconds
                    workerAbandoned inFlightRequestId cancelRequested waitAction)
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
reaped after a timeout, but never while a call is in flight (#isBusy). A single call is bounded
too, where the router configured a deadline: one that outruns it is BROKEN rather than waited out
(#endCallBecause:), which costs the client that request and, almost always, nothing else -- an
interrupted worker is usable again immediately. Workers log in as the
current user for now; userId is reserved for later per-user auth. The worker''s stone session id
and OS process id are captured at login (#cacheWorkerIds): they are what correlate a session with
a gem in ps, and fetching them there also makes the kernel''s printOn: -- which sends those same
two remote accessors -- harmless afterwards.

A session also carries the state the SERVER-INITIATED side of the transport needs, all of it held
by the front end and none of it in the worker: an McpOutbox of messages waiting for this client''s
SSE stream, and what the last liveness probe found. That second one is why reaping is no longer a
single clock. #touch -- real MCP traffic -- is the only thing that resets the idle cycle. A ping the
client ANSWERS proves it is still there (#noteAlive) and spares its gem an early reap; a ping it
never answers proves it is gone (#noteProbeUnanswered) and frees the gem early, without waiting out
the full timeout. What an answered ping deliberately does NOT do is stamp the activity clock: if it
did, every well-behaved client would hold its worker gem and its transaction view forever.

None of that is needed for the commonest ending of all, which is a client simply hanging up -- a
shut editor tab. There the front end has something better than any inference: the drain loop watches
the read side, so it SEES the connection end (#noteStreamClosedByClient). That fact is paired with
the present state of the outbox rather than trusted alone, and #noteStreamSeen or #touch retracts it,
so a client that reopened a stream, or that is simply working without one, is never taken for a
client that left.
'
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
category: 'private'
method: McpSession
abandonWorker
  "Give up on a worker gem that has taken neither break: stop it from the STONE side and mark this
   session finished. Stopping from the stone is the only lever left -- a logout is itself a GCI call,
   and this session already has one in flight that will not end, so anything sent through the gem
   would queue behind it forever.
   Marking rather than unregistering is deliberate. The id -> session map belongs to the router, and
   a session that removed itself from it would have to reach around the mutex that guards it; the
   router unmaps it as it answers the client (McpRouter>>releaseSessionIfAbandoned:), and the
   client's next request then gets the 404 that tells it to initialize again."
  workerAbandoned := true.
  self stopWorkerGem.
  ^self
%
category: 'activity'
method: McpSession
ageSeconds
  "How long this session has existed, whatever it has been doing. What an absolute lifetime cap is
   measured against, unlike #idleSeconds."
  ^System timeGmt - startedAtSeconds
%
category: 'private'
method: McpSession
awaitWorkerResult
  "Wait for the in-flight call to finish. Answers when it has; RAISES when it was ENDED instead
   (#endCallBecause:), so no caller can mistake an ended call for a completed one and go on to read
   #lastResult -- which would answer the previous request's response.
   Two things end a call, and this is the only place either is noticed. It can outrun this session's
   deadline, where there is one. Or the CLIENT can say it no longer wants it, by a
   notifications/cancelled the front end has turned into #requestCancel: -- which runs in a different
   GsProcess and deliberately only sets a flag, because the worker mutex is held by THIS call and
   sending GCI from two processes is what it exists to prevent. So the cancel is acted on here,
   inside the process that owns the mutex, and never by the one that asked for it.
   Cancellation is checked FIRST: a call that has been both cancelled and has outrun its deadline is
   more usefully reported as the thing the client asked for.
   Each wait sleeps at most #workerWaitSeconds, which bounds how often both are re-checked and not how
   long a call may take: the wait answers the moment the worker does, because it is waiting on the
   session's socket. So a call ends within one wait of the deadline or the cancel rather than exactly
   at it -- and the price of that second is keeping both checks somewhere a reader can find them."
  | deadline |
  deadline := self callDeadline.
  [worker isCallInProgress] whileTrue: [
    worker waitForResultForSeconds: self workerWaitSeconds otherwise: [nil].
    self runWaitAction.
    (worker isCallInProgress and: [cancelRequested == true])
      ifTrue: [^self endCallBecause: #cancelled].
    (worker isCallInProgress and: [deadline notNil and: [System timeGmt >= deadline]])
      ifTrue: [^self endCallBecause: #timeout]].
  ^self
%
category: 'private'
method: McpSession
breakGraceSeconds
  "How long a break is given to take effect before the next, harder measure. Two seconds: a break
   that is going to land lands at the worker's next send or on the wait it is blocked in -- verified
   on 3.7.5 to arrive within one wait for both a spinning loop and a blocked #wait -- so this is not
   a wait for the common case but a margin for a worker that is briefly busy elsewhere. Long enough
   not to escalate on a hiccup; short enough that the whole escalation cannot add more than a few
   seconds to a deadline the client has already been told about."
  ^2
%
category: 'private'
method: McpSession
breakWorker: aBlock
  "Send one break (aBlock) to the worker and answer whether the call actually ended. A failure of the
   send itself is swallowed: a call that finished in the same instant leaves nothing to break, which
   is not an error and not this method's answer either. What it answers is the only thing that
   matters afterwards -- whether a call is still in flight."
  [aBlock value] on: Error do: [:ex | ex return: nil].
  ^self workerSettlesWithin: self breakGraceSeconds
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
category: 'private'
method: McpSession
callDeadline
  "The wall-clock second by which the call now starting must be over, or nil where this session has
   no request deadline. Read once when a call starts rather than on every wait, so a call is measured
   from where it began even if the session is reconfigured underneath it."
  requestTimeoutSeconds isNil ifTrue: [^nil].
  ^System timeGmt + requestTimeoutSeconds
%
category: 'lifecycle'
method: McpSession
close
  "Terminate the worker gem. It is attached (the front end drives it via executeString:), so a
   logout stops it.
   The outbox is only marked CLOSING, not closed: whatever is already queued is still owed to the
   client, and the drain loop closes the outbox itself once it has written it. Closing outright here
   would kill the stream in the same instant as the gem and drop what was in flight."
  outbox ifNotNil: [:o | o beginClosing].
  "An abandoned worker's gem is already stopped, and the logout would be a GCI call queued behind
   the very call that could not be ended -- see #abandonWorker."
  workerAbandoned ifTrue: [^self].
  [worker logout] on: Error do: [:e | nil].
  ^self
%
category: 'private'
method: McpSession
endCallBecause: aReasonSymbol
  "End the in-flight call and raise so the client is told, for the reason named: #timeout where it
   outran this session's deadline, #cancelled where the client said it no longer wants it. The
   escalation is IDENTICAL for both, and that is the point -- what differs is only who decided, so a
   cancellation needed no new mechanism, only a new trigger.
   Escalates, because the measures differ in what they cost. A SOFT break ends an ordinary runaway:
   it is taken by a Smalltalk loop between sends and by a blocked #wait alike (both verified on
   3.7.5), and the worker is fully usable straight afterwards -- so the client loses its request and
   not its gem, nor the uncommitted work in it. A HARD break follows if the soft one is not taken.
   If neither is, the call is not endable from this side at all, and the gem is stopped
   (#abandonWorker): a GsTsExternalSession whose call never ends can never be used again -- GCI
   allows one in flight -- so every later request would fail on this call rather than on its own.
   Code that handles ControlInterrupt and resumes is what survives both breaks. It is rare, and it is
   also the only reason the third step exists.
   A break reaches the pending wait as an error (`a Break occurred`, error 6003), as does a worker
   that failed in the same instant. Neither is worth telling apart: both mean the call is over, and
   the client is owed the same answer either way."
  (self breakWorker: [worker softBreak]) ifTrue: [^self signalCallEnded: aReasonSymbol].
  (self breakWorker: [worker hardBreak]) ifTrue: [^self signalCallEnded: aReasonSymbol].
  self abandonWorker.
  ^self signalCallEnded: aReasonSymbol
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
category: 'routing'
method: McpSession
forward: aRawJsonString
  "Forward with no lifetime bounds -- the direct form, kept for callers with no router policy to
   report (the tests, and any embedder driving a session itself)."
  ^self forward: aRawJsonString lifetimeBounds: nil
%
category: 'requests'
method: McpSession
forward: aRawJsonString lifetimeBounds: anArrayOrNil
  "Forward without naming the request -- the direct form, for callers with no id to match a
   cancellation against (the tests, and any embedder driving a session itself)."
  ^self forward: aRawJsonString lifetimeBounds: anArrayOrNil requestId: nil
%
category: 'routing'
method: McpSession
forward: aRawJsonString lifetimeBounds: anArrayOrNil requestId: anIdOrNil
  "Forward without progress -- the shape every non-streamed call takes."
  ^self forward: aRawJsonString lifetimeBounds: anArrayOrNil requestId: anIdOrNil
      progressCallId: nil whileWaiting: nil
%
category: 'routing'
method: McpSession
forward: aRawJsonString lifetimeBounds: anArrayOrNil requestId: anIdOrNil progressCallId: aCallIdOrNil whileWaiting: aBlockOrNil
  "Run a JSON-RPC request in this client's worker gem (an isolated session) and answer the JSON
   response string ('' for a notification). Runs WITHOUT stalling the front-end gem -- see
   #runWorker:, which is what keeps one client's long tool call from freezing every other GsProcess
   in the front end. The request is embedded via printString for safe quoting.

   anArrayOrNil is what the ROUTER says bounds this session (McpRouter>>lifetimeBoundsFor:),
   carried in on the request rather than asked for by the worker, which cannot see the front end's
   configuration and must not hold a stale copy of it. Values rather than a sentence, because the
   deadline in it is an instant the worker counts down from when it ANSWERS -- see that method. The
   worker uses them only when it has uncommitted work to warn about.

   anIdOrNil is the JSON-RPC id this request arrived with, remembered for exactly as long as the call
   runs so that a notifications/cancelled naming it can be matched to it (#requestCancel:). Cleared
   in an ensure: along with any cancellation that arrived: a flag outliving its call would end the
   NEXT one, which is the whole hazard in letting another GsProcess set it. Cleared on the way IN as
   well, since a cancel can arrive in the instant between a call finishing and this clearing it.

   aCallIdOrNil names this call to the WORKER, so a tool's progress ticks can say which call they
   belong to. It is the front end's own opaque id, never the client's progressToken -- see
   McpProgressChannel.

   aBlockOrNil runs after every wait for the worker, in this GsProcess (#awaitWorkerResult). It is how
   a progress tick reaches the client's socket: the front end passes a block that drains the channel
   onto the connection it is answering on. A BLOCK rather than the channel and the connection
   themselves, deliberately -- a session's business is driving one worker gem, and it has no reason to
   learn what an SSE frame is."
  self touch.
  ^[inFlightRequestId := anIdOrNil.
    cancelRequested := false.
    waitAction := aBlockOrNil.
    self runWorker: (self workerExpressionFor: aRawJsonString lifetimeBounds: anArrayOrNil
      progressCallId: aCallIdOrNil)]
      ensure: [inFlightRequestId := nil. cancelRequested := false. waitAction := nil]
%
category: 'accessing'
method: McpSession
id
  ^id
%
category: 'activity'
method: McpSession
idleSeconds
  "Wall-clock seconds since the last client REQUEST. DIAGNOSTIC ONLY -- nothing in the reaping
   policy reads this, and nothing should. Wall clock cannot tell time this server spent serving
   from time it spent suspended, and inferring one from the other is what #quietProbes replaced."
  ^System timeGmt - lastActivitySeconds
%
category: 'initialization'
method: McpSession
initialize
  "Seed the front-end-side state. The outbox is built HERE rather than on demand: nothing prepares
   it the way #prepareWorker prepares the worker before the session is registered, so two
   GsProcesses -- an arriving GET stream and the reaper -- really could race to create it."
  outbox := McpOutbox new.
  startedAtSeconds := System timeGmt.
  expiresAtSeconds := nil.   "nil = no absolute deadline; McpAuthRouter sets one from the token exp"
  "Everything the reaper measures is a COUNT of things this front end observed, never an elapsed
   time it inferred. A suspended host runs no maintenance passes, so none of these can advance
   while the server is not serving -- which is why there is no suspend detector to get wrong."
  quietProbes := 0.        "consecutive liveness pings answered with no work in between"
  unansweredProbes := 0.   "consecutive pings sent on the current stream with no answer"
  streamlessPasses := 0.   "consecutive passes on which there was no stream to ask down"
  passesSinceProbe := 0.   "passes since the last ping, for the probe cadence"
  "The one fact here that is not a count, because it is not an inference either: the client's own
   connection ended, and the drain loop watched it happen. See #noteStreamClosedByClient."
  streamClosedByClient := false.
  "No request deadline unless one is pushed in. The router owns that policy (McpRouter>>
   requestTimeoutSeconds:), as it owns every other interval, so a session built by hand -- a test,
   a script -- waits for its worker as long as it takes."
  requestTimeoutSeconds := nil.
  workerAbandoned := false.
  ^self
%
category: 'activity'
method: McpSession
isBusy
  "Whether a call into this session's worker gem is in flight. Asked by the idle reaper: #forward:
   stamps the activity clock when a call STARTS, so a request that runs longer than the idle timeout
   would otherwise be reaped -- and its worker logged out -- while it was still running. That could
   not happen while forwarding blocked the whole front-end gem, because the reaper could not run
   either. Cheap: it reads the external session's own state and makes no GCI call.
   An ABANDONED worker is excluded, and has to be: its call is in flight and always will be (see
   #abandonWorker), so without this a session nothing can serve would read as the one thing the
   reaper never touches."
  ^workerAbandoned not and: [worker notNil and: [worker isCallInProgress]]
%
category: 'liveness'
method: McpSession
isExpired
  "Whether this session has passed the absolute deadline it was opened with (see #expiresAtSeconds).
   Unlike idleness this is never forgiven and never probed around: the reaper frees such a session
   whatever its client is doing."
  ^expiresAtSeconds notNil and: [System timeGmt >= expiresAtSeconds]
%
category: 'accessing'
method: McpSession
lastActivitySeconds
  ^lastActivitySeconds
%
category: 'initialization'
method: McpSession
newWorkerSession
  "A fresh, not-yet-logged-in GsTsExternalSession worker gem on localhost.
   Built as #newDefault plus an explicit gem NRS rather than #newDefaultForGemHost:, which does not
   exist in 3.7.2. The two are equivalent: the kernel's #newDefaultForGemHost: IS #newDefault
   with the NRS node replaced, and #newDefault takes its node from #currentGemHostName. Pinning the
   node to 'localhost' keeps the worker on this machine even where the host name does not resolve,
   and uses only selectors present in every 3.7.x image, so one code path serves all of them."
  ^GsTsExternalSession newDefault
    gemNRS: (GsNetworkResourceString defaultGemNRSFromCurrent node: 'localhost'; yourself);
    yourself
  "^GsTsExternalSession newDefaultForGemHost: 'localhost'"
%
category: 'activity'
method: McpSession
noteAlive
  "The client answered a liveness ping: it is there, and it did no work between the previous
   confirmation and this one. That pair of facts is the whole idleness measure -- see
   McpRouter>>confirmationsBeforeRelease -- and it is why nothing here reads a clock. A session
   accrues idleness only from evidence it asked for and received.
   Deliberately NOT #touch -- see the class comment. Answering a ping is not work."
  unansweredProbes := 0.
  quietProbes := quietProbes + 1
%
category: 'liveness'
method: McpSession
notePassWithStream: aBoolean
  "One maintenance pass observed this session. This is the server's entire clock: it advances only
   when the front end is actually running, which is what makes every count below immune to a host
   suspend without anyone having to detect one."
  passesSinceProbe := passesSinceProbe + 1.
  aBoolean
    ifTrue: [self noteStreamSeen]
    ifFalse: [streamlessPasses := streamlessPasses + 1].
  ^self
%
category: 'activity'
method: McpSession
noteProbeDiscarded
  "This ping proved nothing -- it went down a stream the client had already replaced, so no answer
   could ever have arrived (McpRouter>>verdictAdmissible:forSession:). Undo the count it was given
   when it was sent, rather than letting the transport speak for the client."
  unansweredProbes := (unansweredProbes - 1) max: 0
%
category: 'activity'
method: McpSession
noteProbeSent
  "A liveness ping is on its way. It counts as unanswered from the moment it is sent, and stops
   counting the instant an answer arrives (#noteAlive) or the ping is shown to have proved nothing
   (#noteProbeDiscarded). Counting at SEND rather than at some later deadline is what removes the
   last clock from this path: there is no moment at which a ping is declared late, only a number of
   pings outstanding on a stream the client is still holding."
  unansweredProbes := unansweredProbes + 1.
  passesSinceProbe := 0
%
category: 'activity'
method: McpSession
noteProbeUnanswered
  "Kept for symmetry with #noteProbeDiscarded and to name the outcome at the call site: a ping that
   was admissible and went unanswered simply keeps the count it was given when it was sent, so there
   is nothing to do here."
  ^self
%
category: 'liveness'
method: McpSession
noteStreamClosedByClient
  "The client's own end of the SSE stream closed -- an EOF the drain loop read, or a write that
   failed -- rather than the stream being superseded by a newer GET or ended by this server.
   This is the strongest evidence of departure anywhere in the transport, and unlike everything else
   the reaper reads it is not a count: it is one observed fact, so a suspended host cannot
   manufacture it either. It does not by itself condemn the session -- the reaper also requires that
   no stream be open when it looks (McpRouter>>reapReasonFor:), which is what lets a client that
   closes one stream and immediately opens another keep its worker gem."
  streamClosedByClient := true
%
category: 'liveness'
method: McpSession
noteStreamSeen
  "A stream is attached right now. That is the only thing that can be observed about reachability
   without asking the client, so it resets the count of passes on which nothing could be asked --
   and it retracts #noteStreamClosedByClient, because a client that has just opened a stream is
   plainly not the one that went away.
   Sent both by the maintenance pass (#notePassWithStream:) and by the arriving GET itself
   (McpRouter>>serveGetStream:forSession:), which is what lets a reconnect land inside the grace
   rather than a whole pass later."
  streamlessPasses := 0.
  streamClosedByClient := false
%
category: 'accessing'
method: McpSession
outbox
  "This session's queue of server-initiated messages, waiting for its SSE stream. Front-end state:
   the worker gem neither has one nor could write to it."
  ^outbox
%
category: 'liveness'
method: McpSession
passesSinceProbe
  ^passesSinceProbe
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
category: 'liveness'
method: McpSession
quietProbes
  "How many consecutive liveness pings this client has answered with no request in between. The
   idleness measure: each one is a fact this server asked for and was told, not an interval it
   inferred from a clock it cannot trust across a suspend."
  ^quietProbes
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
category: 'routing'
method: McpSession
requestCancel: anId
  "The client has asked, by a notifications/cancelled, that the request numbered anId be stopped.
   Answers whether it named the call actually in flight.
   Sets a flag and NOTHING else, deliberately. This runs in the GsProcess serving the cancellation's
   own POST, while a different GsProcess is inside #runWorker: holding the worker mutex with a GCI
   call in progress; sending a break from here would be a second process driving one session, which
   is exactly what that mutex exists to prevent. #awaitWorkerResult picks the flag up on its next
   wait -- within #workerWaitSeconds -- and does the ending from the process that owns the mutex.
   A cancel naming some other id is ignored rather than refused: the spec asks receivers to ignore a
   cancellation whose request is unknown or already finished, and by the time one arrives the call it
   names has very often just ended. Ignoring is also what makes the id check load-bearing -- without
   it, a late cancel for a finished request would end whatever call happened to be running instead."
  anId isNil ifTrue: [^false].
  inFlightRequestId isNil ifTrue: [^false].
  anId = inFlightRequestId ifFalse: [^false].
  cancelRequested := true.
  ^true
%
category: 'session lifetime'
method: McpSession
requestTimeoutSeconds
  "How long one call into this session's worker gem may run before it is ended, or nil for no limit.
   Pushed in by the router, which owns the policy -- see McpRouter>>requestTimeoutSeconds."
  ^requestTimeoutSeconds
%
category: 'session lifetime'
method: McpSession
requestTimeoutSeconds: anIntegerOrNil
  "Set the deadline for a single call into this worker (nil = none). Applies from the NEXT call: a
   call already in flight keeps the deadline it started under (#callDeadline)."
  requestTimeoutSeconds := anIntegerOrNil
%
category: 'private'
method: McpSession
runWaitAction
  "Run whatever the caller asked to have done between waits for the worker -- draining a progress
   tick onto the client's socket, in the only case that passes one (#forward:...whileWaiting:).
   Runs in THIS GsProcess, which is the one answering the request, and that is the point: the socket
   belongs to this connection and exactly one process may write to it. A forked writer would have to
   be joined before the final response could go out, for no gain.
   Cannot fail the call. A progress tick is a courtesy; a tool's answer is not, and an error while
   reporting on work must not destroy the work. The failure is logged nowhere here because there is
   nothing to log it to -- a session has no log of its own -- and the front end already notices a dead
   socket by other means."
  waitAction isNil ifTrue: [^self].
  [waitAction value] on: Error do: [:ex | ex return: nil].
  ^self
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
   timed out #lastResult still holds the PREVIOUS call's value.
   A call that outruns this session's deadline is ENDED rather than waited out (#awaitWorkerResult,
   #endCallBecause:), where one is configured; with none, a worker still gets as long as it takes.
   A call the CLIENT cancels ends by the same path, from a different trigger (#requestCancel:).
   The mutex is what keeps two requests from colliding in one worker -- GCI allows one call in flight
   per session, which the blocking call used to guarantee by freezing the gem. A worker-side error
   arrives as the same GciError as before, and leaves the worker usable; so does an ended call, which
   raises out of the critical block and so releases the mutex on its way past.
   An ENDED call never returns a result at all: #awaitWorkerResult raises, so a response the break
   left behind is not examined, and the client is told its call was ended."
  ^self workerMutex critical: [
    worker nbExecute: anExpressionString.
    self awaitWorkerResult.
    self touch.
    worker lastResult]
%
category: 'session lifetime'
method: McpSession
secondsUntilExpiry
  "Seconds remaining before this session's absolute deadline, or nil if it has none. Negative once
   the deadline has passed and the reaper has not yet come round."
  ^expiresAtSeconds isNil ifTrue: [nil] ifFalse: [expiresAtSeconds - System timeGmt]
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
category: 'private'
method: McpSession
signalCallEnded: aReasonSymbol
  "Raise the error a client is answered with for a call this session ended. The kind is the reason
   itself -- #timeout or #cancelled -- and it is the same machine-readable classification a
   worker-raised error carries (McpError), so a client branches on the kind wherever the error was
   produced.
   The message says which of the two ENDINGS happened, because they are not the same news: an
   interrupted call leaves the session and its uncommitted work intact, while a stopped gem takes
   both with it. It also says what an interrupted call does NOT guarantee -- it was cut partway, so
   whatever it had already done in that gem's view is still there, uncommitted. That last sentence
   matters more for a cancellation than for a deadline: a user who pressed a key to stop something
   may well assume it did not happen, and it half did."
  ^McpError signalKind: aReasonSymbol message: (aReasonSymbol == #cancelled
      ifTrue: ['The client cancelled this request, and it was ended. ']
      ifFalse: ['The request exceeded this server''s ' , requestTimeoutSeconds printString
        , '-second request limit and was ended. '])
    , (workerAbandoned
        ifTrue: ['Its worker gem could not be interrupted and has been stopped, so this session is '
          , 'finished and its uncommitted work is gone: call initialize again to continue.']
        ifFalse: ['The session is still usable and its uncommitted work is intact, but the call was '
          , 'interrupted partway: anything it had already done is still there, uncommitted.'])
%
category: 'accessing'
method: McpSession
startedAtSeconds
  "When this session was opened, as a wall-clock second. Exposed so a router can tell WHICH bound is
   about to end a session -- an absolute lifetime cap is startedAtSeconds + the cap, and comparing
   that against #expiresAtSeconds says whether the cap or a credential is the binding one, without
   either storing that fact or reading a clock twice to infer it."
  ^startedAtSeconds
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
  "The next line is for compatibility with 3.7.2. In 3.7.5 it could be replaced with
   worker useOnetimePassword."
  worker onetimePassword: (GsCurrentSession currentSession createOnetimePasswordValidForSeconds: 300).
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
category: 'private'
method: McpSession
stopWorkerGem
  "Stop this session's worker gem from the stone side, by the session id captured at login
   (#cacheWorkerIds). Sent only from #abandonWorker, and separate from it for one reason: it is the
   single line of this class a test cannot let run, since the id a mock holds is not a real
   session's, and a test that stopped whatever session happened to hold that number would be a
   memorable way to find out."
  workerStoneSession isNil ifTrue: [^self].
  [System stopSession: workerStoneSession] on: Error do: [:ex | ex return: nil].
  ^self
%
category: 'liveness'
method: McpSession
streamClosedByClient
  "Whether this client has been seen to close its event stream and has done nothing since to suggest
   it is still there. Set by #noteStreamClosedByClient; retracted by #noteStreamSeen and by #touch."
  ^streamClosedByClient == true
%
category: 'liveness'
method: McpSession
streamlessPasses
  "Consecutive maintenance passes on which this session had no stream, so nothing could be asked of
   its client at all. The only ground for releasing a session that can never be confirmed."
  ^streamlessPasses
%
category: 'accessing'
method: McpSession
toolsetNames: aCollectionOfNamesOrNil
  "The toolsets this worker should register, as resolved by the front end
   (McpRouter>>effectiveToolsetNames)."
  toolsetNames := aCollectionOfNamesOrNil
%
category: 'accessing'
method: McpSession
toolsetOptions: aDictOrNil
  "The deployment's options for those toolsets, keyed by toolset name, as resolved and VALIDATED by
   the front end (McpRouter>>effectiveToolsetOptions). nil when nothing is configured, which is the
   ordinary case."
  toolsetOptions := aDictOrNil
%
category: 'activity'
method: McpSession
touch
  "A client request arrived: the session is not idle, and everything counted about its quietness
   starts again. Resets the confirmation count (it is no longer idle), the unanswered-ping count (a
   request is far better evidence of life than a ping answer), and the probe cadence.
   It also retracts everything the transport had concluded from silence: a client making tool calls
   is alive whether or not it holds a stream, so neither the streamless count nor a stream it was
   seen to close may go on counting against it. Without that, an actively working client whose
   stream had dropped was released mid-conversation -- survivable while the streamless floor was
   half an hour, fatal beside a ten-second grace."
  lastActivitySeconds := System timeGmt.
  quietProbes := 0.
  unansweredProbes := 0.
  passesSinceProbe := 0.
  streamlessPasses := 0.
  streamClosedByClient := false
%
category: 'liveness'
method: McpSession
unansweredProbes
  "How many pings are outstanding on the stream the client is still holding. Evidence of death only
   in numbers -- see McpRouter>>unansweredProbesBeforeGone."
  ^unansweredProbes
%
category: 'accessing'
method: McpSession
userId
  ^userId
%
category: 'session lifetime'
method: McpSession
workerAbandoned
  "Whether this session's worker gem was stopped because a call could not be ended any other way
   (#abandonWorker). Such a session can serve nothing further, and the router unmaps it as it
   answers the request that ended this way."
  ^workerAbandoned
%
category: 'private'
method: McpSession
workerBootstrapExpression
  "The one expression prepareWorker runs in the worker gem. Sent to the worker CLASS the front end
   named, so the worker instantiates what it is told rather than choosing for itself. Names are plain
   identifiers (McpRouter validated them when the router was configured) and the strings are embedded
   via printString, so this cannot smuggle anything into the worker's compiler. That printString is
   load-bearing for the title in particular: unlike a name or a version it is free-form operator prose,
   so quotes in it must be doubled rather than closing the literal.

   The toolset options travel as ONE printString-quoted JSON string, which the worker parses
   (McpServer class>>prepareWorkerWithToolsets:options:...). They are the only argument here whose
   shape the core does not know -- a nested map a vendor defines -- so encoding them as JSON rather
   than building a Smalltalk literal keeps this method free of that shape entirely, and gives them
   the same one-quoted-literal safety property every other argument has."
  ^self workerClassName
    , ' prepareWorkerWithToolsets: ' , (self quotedNameArrayFor: toolsetNames)
    , ' options: ' , ((toolsetOptions isNil or: [toolsetOptions isEmpty])
        ifTrue: ['nil']
        ifFalse: [(McpJson write: toolsetOptions) printString])
    , ' readOnly: ' , self readOnly printString
    , ' serverName: ' , (serverName isNil ifTrue: ['nil'] ifFalse: [serverName printString])
    , ' title: ' , (serverTitle isNil ifTrue: ['nil'] ifFalse: [serverTitle printString])
    , ' version: ' , (serverVersion isNil ifTrue: ['nil'] ifFalse: [serverVersion printString])
    , ' frontEnd: ' , System session printString
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
  ^self workerExpressionFor: aRawJsonString lifetimeBounds: nil
%
category: 'private'
method: McpSession
workerExpressionFor: aRawJsonString lifetimeBounds: anArrayOrNil
  "The expression forward: runs in the worker gem: the NAMED worker class handles the request, so the
   worker never decides which server class to build. The request body is embedded via printString for
   safe quoting, and so is every element of the bounds -- which is what makes an apostrophe in a
   phrase, or a nil in any slot, safe to send.

   The lifetimeBounds: keyword is appended ONLY when there are bounds, so a deployment that bounds
   nothing sends the expression it always sent, and the one-argument entry point stays the form
   documented for a direct call. The worker's one-argument handleJsonString: clears bounds left by a
   previous request, so an omitted keyword means 'nothing bounds this session' rather than 'no news'."
  | base s |
  base := self workerClassName , ' handleJsonString: ' , aRawJsonString printString.
  anArrayOrNil isNil ifTrue: [^base].
  s := WriteStream on: String new.
  s nextPutAll: base , ' lifetimeBounds: (Array'.
  anArrayOrNil do: [:e | s nextPutAll: ' with: ' , e printString].
  s nextPutAll: ')'.
  ^s contents
%
category: 'private'
method: McpSession
workerExpressionFor: aRawJsonString lifetimeBounds: anArrayOrNil progressCallId: aCallIdOrNil
  "As #workerExpressionFor:lifetimeBounds:, with a progress reporter installed FIRST where this call
   is being reported on.
   Two statements in one expression, not another keyword on handleJsonString:. executeString: runs a
   sequence and answers the last value, so the cost is a '. ' and the gain is not having four entry
   points on the worker for two independent facts -- bounds and progress have nothing to do with each
   other, and a client can ask for either, both or neither. The teardown is handleJsonString:'s
   ensure:, so the reporter cannot outlive the call it was made for."
  | base |
  base := self workerExpressionFor: aRawJsonString lifetimeBounds: anArrayOrNil.
  aCallIdOrNil isNil ifTrue: [^base].
  ^self workerClassName , ' progressCallId: ' , aCallIdOrNil printString , '. ' , base
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
category: 'private'
method: McpSession
workerSettlesWithin: aSecondCount
  "Wait up to aSecondCount for the in-flight call to end, and answer whether it did. Errors from the
   wait are swallowed on purpose: the break being waited on surfaces here as one, and so would a
   worker-side error arriving in the same moment. #isCallInProgress, never the absence of an error,
   is what says whether the call is over."
  | limit |
  limit := System timeGmt + aSecondCount.
  [worker isCallInProgress and: [System timeGmt <= limit]] whileTrue: [
    [worker waitForResultForSeconds: self workerWaitSeconds otherwise: [nil]]
      on: Error do: [:ex | ex return: nil]].
  ^worker isCallInProgress not
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
