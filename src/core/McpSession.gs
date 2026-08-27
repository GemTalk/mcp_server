set compile_env: 0
! ------------------- Class definition for McpSession
expectvalue /Class
doit
Object subclass: 'McpSession'
  instVarNames: #( id worker workerMutex
                    lastActivitySeconds userId readOnly workerClassName
                    toolsetNames serverName serverTitle serverVersion
                    workerPid workerStoneSession resultBufferSlot resultBuffer
                    nonceCounter)
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

Before it serves anything, a new session PROBES its worker to confirm that results larger than 1024
bytes survive the trip back (#verifyWorkerResultFidelity). GemStone before 3.7.4.1 corrupts them,
and every MCP response is fetched the way that bug corrupts, so the probe is what decides whether
this image needs the workaround -- a fixed image carries none of it. The defect is GemStone kernel
bug #51438, fixed in 3.7.4.1.

Independently of that, EVERY response is checked on arrival. #runWorker: has the worker append a
per-call nonce and refuses any response that does not end with it (#resultOf:withoutNonce:), which
catches a truncated or stale response whatever caused it, on any version. That check is not a
version workaround and is never switched off.'
%
expectvalue /Class
doit
McpSession category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpSession
removeallmethods McpSession
removeallclassmethods McpSession
! ------------------- Class methods for McpSession
category: 'response integrity'
classmethod: McpSession
expressionWith: anExpressionString nonce: aNonceString
  "anExpressionString wrapped so the worker appends aNonceString to whatever it answers.
   The block is what lets an expression that declares its own temporaries be wrapped at all, and the
   nonce is the LAST thing in the source -- inside a string literal at a fixed offset from the end --
   so #resultNonceIn: can recover it without parsing Smalltalk and without being confused by a client
   request body that happens to contain quotes or brackets.
   Every expression sent through #runWorker: must answer a String. All of them do: a JSON-RPC
   response, the worker bootstrap's ready line, or a fidelity probe's marker string."
  ^'[' , anExpressionString , '] value , ''' , aNonceString , ''''
%
category: 'result fidelity'
classmethod: McpSession
probeLargeBytes
  "The size of the first result a fidelity probe fetches. Its job is to grow the kernel's fetch
   buffer past its original size, so anything over #resultBufferBytes would do."
  ^2048
%
category: 'result fidelity'
classmethod: McpSession
probeSmallBytes
  "The size of the second result a fidelity probe fetches: larger than #resultBufferBytes, so the
   kernel's initial fetch cannot hold it, and smaller than #probeLargeBytes, so it fits inside the
   buffer the first probe just grew. That is the band GemStone before 3.7.4.1 returns stale bytes in."
  ^1536
%
category: 'result fidelity'
classmethod: McpSession
resultBufferBytes
  "The size GsTsExternalSession>>_allocateBuffers gives a session's result-fetch buffer, and the size
   McpSession>>resetWorkerResultBuffer restores. Not a tunable: resolveResult: asks for exactly this
   many bytes in its first fetch, so a smaller buffer would be written past its end."
  ^1024
%
category: 'result fidelity'
classmethod: McpSession
resultFidelityProbeExpressionBytes: anInteger marker: aCharacter
  "The expression a fidelity probe runs in the worker gem: answer anInteger copies of aCharacter.
   Deliberately trivial -- it names no Mcp class, so it runs in a worker that has not been prepared
   yet, and uses only selectors present in every image the server supports."
  ^'| s | s := String new: ' , anInteger printString , '. s atAllPut: $' , aCharacter asString , '. s'
%
category: 'result fidelity'
classmethod: McpSession
resultFidelityProbeRequestFrom: anExpressionString
  "The size and marker character a probe expression asks for, as { size . marker }, or nil if this is
   not a probe expression -- the inverse of #resultFidelityProbeExpressionBytes:marker:.
   It exists so a stand-in worker can answer a probe the way a real gem would, which is what lets
   McpMockSession run the SHIPPING startWithId: rather than one with the probe stubbed out.
   Found ANYWHERE in the argument rather than at its start, because by the time a worker sees an
   expression #expressionWith:nonce: has wrapped it. Only a stand-in worker reads this, so a request
   body contriving to look like a probe would mislead nothing that runs in production."
  | head tail i j |
  head := '| s | s := String new: '.
  tail := '. s atAllPut: $'.
  i := anExpressionString indexOfSubCollection: head.
  i = 0 ifTrue: [^nil].
  j := anExpressionString indexOfSubCollection: tail.
  (j = 0 or: [j < i]) ifTrue: [^nil].
  ^Array
    with: (anExpressionString copyFrom: i + head size to: j - 1) asInteger
    with: (anExpressionString at: j + tail size)
%
category: 'response integrity'
classmethod: McpSession
resultNonceDigits
  "How many digits of counter a nonce carries. Twelve is far more than a session can consume, and
   fixing the width is what lets #resultNonceIn: read the nonce at a known offset."
  ^12
%
category: 'response integrity'
classmethod: McpSession
resultNonceIn: anExpressionString
  "The nonce #expressionWith:nonce: put at the end of anExpressionString, or nil if it has none.
   Read at a fixed offset from the end rather than searched for, so a request body containing
   something that looks like a nonce cannot be mistaken for one."
  | n nonce |
  n := self resultNonceSize.
  anExpressionString size < (n + 1) ifTrue: [^nil].
  anExpressionString last = $' ifFalse: [^nil].
  nonce := anExpressionString
    copyFrom: anExpressionString size - n to: anExpressionString size - 1.
  ^(nonce beginsWith: self resultNonceMarker) ifTrue: [nonce] ifFalse: [nil]
%
category: 'response integrity'
classmethod: McpSession
resultNonceMarker
  "What every nonce starts with: a short, printable tag that makes one recognisable in a log or a
   gem trace, and keeps #resultNonceIn: from mistaking arbitrary trailing text for a nonce."
  ^'~mcp~'
%
category: 'response integrity'
classmethod: McpSession
resultNonceSize
  "The length of a nonce -- fixed, so it can be read at a known offset from the end of both an
   expression and a response."
  ^self resultNonceMarker size + self resultNonceDigits
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
   logout stops it."
  [worker logout] on: Error do: [:e | nil].
  ^self
%
category: 'result fidelity'
method: McpSession
enableResultBufferReset
  "Arrange for #resetWorkerResultBuffer to put this worker's result-fetch buffer back to its original
   size before every call, and answer whether that is possible in this image.
   The buffer is the second slot of GsTsExternalSession's objInfoBuffers -- an ordinary Array, so the
   slot can simply be stored into. The instance variable is located by NAME at runtime rather than
   assumed to be at a fixed offset: an image that renamed it answers false here, and
   #verifyWorkerResultFidelity then refuses to start the session rather than serving results it
   cannot trust.
   One CByteArray is allocated here and stored back for the session's whole life, so the per-request
   cost is a single instance-variable store and no allocation at all."
  | slot buffers |
  slot := worker class allInstVarNames indexOf: #objInfoBuffers.
  slot = 0 ifTrue: [^false].
  buffers := worker instVarAt: slot.
  ((buffers isKindOf: Array) and: [buffers size >= 2]) ifFalse: [^false].
  resultBuffer := CByteArray gcMalloc: self class resultBufferBytes.
  resultBufferSlot := slot.
  ^true
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
isBusy
  "Whether a call into this session's worker gem is in flight. Asked by the idle reaper: #forward:
   stamps the activity clock when a call STARTS, so a request that runs longer than the idle timeout
   would otherwise be reaped -- and its worker logged out -- while it was still running. That could
   not happen while forwarding blocked the whole front-end gem, because the reaper could not run
   either. Cheap: it reads the external session's own state and makes no GCI call."
  ^worker notNil and: [worker isCallInProgress]
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
category: 'response integrity'
method: McpSession
nextResultNonce
  "A nonce -- a value used once -- that no other call on this session has used or will use: the
   marker followed by a zero-padded count. Answered inside #runWorker:'s mutex, so two GsProcesses
   serving one client cannot be given the same one.
   A counter is enough here, and making it unguessable would add nothing. What the check needs is
   that a nonce cannot arrive by ACCIDENT, and the only bytes that could carry an old one are an
   earlier response of this same session -- which necessarily carries an earlier, smaller count.
   In particular a stale tail cannot satisfy the check even when the two responses are the same
   length, which is exactly the case a fixed sentinel would let through."
  | digits |
  nonceCounter := (nonceCounter ifNil: [0]) + 1.
  digits := nonceCounter printString.
  [digits size < self class resultNonceDigits] whileTrue: [digits := '0' , digits].
  ^self class resultNonceMarker , digits
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
category: 'result fidelity'
method: McpSession
probeWorkerFor: anInteger marker: aCharacter
  "Fetch a string of anInteger copies of aCharacter from the worker gem, and answer whether every
   byte of it arrived. Deliberately routed through #runWorker:, so a probe travels exactly the path
   a real response does -- including the buffer reset, once one is in place."
  | s |
  s := self runWorker: (self class resultFidelityProbeExpressionBytes: anInteger marker: aCharacter).
  ^s isString
    and: [s size = anInteger and: [(s occurrencesOf: aCharacter) = anInteger]]
%
category: 'result fidelity'
method: McpSession
probeWorkerResultsAreIntact
  "Answer whether results larger than 1024 bytes survive the trip out of this worker gem.
   Fetch a large marker string, which grows the kernel's fetch buffer, and then a smaller one that
   fits inside it. That is the exact shape GemStone before 3.7.4.1 corrupts: the second result comes
   back the right LENGTH, with its first 1024 bytes right and the rest left over from the first. The
   two probes use DIFFERENT marker characters, so a stale tail can never be mistaken for the answer.
   An error from the worker counts as not intact. The workaround is harmless on a healthy image, so
   the pessimistic verdict is the safe one, and a worker that cannot answer this could not serve a
   request either -- which #verifyWorkerResultFidelity reports."
  ^[(self probeWorkerFor: self class probeLargeBytes marker: $A)
    and: [self probeWorkerFor: self class probeSmallBytes marker: $B]]
      on: Error do: [:ex | false]
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
category: 'result fidelity'
method: McpSession
resetWorkerResultBuffer
  "Put this worker's result-fetch buffer back to its original size before a call, on an image that
   needs it. Does nothing anywhere else: resultBufferSlot is set only where a probe caught this image
   corrupting results (#verifyWorkerResultFidelity), so a fixed image pays nothing.
   Restoring the ORIGINAL size is the whole trick. GsTsExternalSession>>resolveResult: refetches a
   large result only when its buffer has to GROW, having already conflated 'big enough' with 'already
   full'; a buffer left at its original size makes that test true for everything the initial
   1024-byte fetch could not hold, which is precisely when the refetch is needed.
   Never store a smaller buffer here -- see McpSession class>>resultBufferBytes."
  resultBufferSlot ifNotNil: [:slot |
    (worker instVarAt: slot) at: 2 put: resultBuffer]
%
category: 'response integrity'
method: McpSession
resultOf: aResult withoutNonce: aNonceString
  "Answer the worker's response with its nonce removed, having first confirmed the nonce is there.
   The nonce is the last thing the worker appends, so it is the first thing a truncated or
   overwritten response loses. A response that does not carry it is not the response this call asked
   for, whatever went wrong -- so REJECT it rather than try to repair it: nothing here can tell how
   much of what arrived is real, and a plausible-looking answer is the failure worth refusing.
   This check is not tied to any version or to kernel bug #51438. It stays on everywhere, and is the
   only part of this class that would notice a corruption nobody has characterised yet."
  ((aResult isString and: [aResult size >= aNonceString size])
    and: [(aResult copyFrom: aResult size - aNonceString size + 1 to: aResult size) = aNonceString])
      ifFalse: [
        ^self error: 'The worker gem for session ' , id printString , ' returned a response that '
          , 'failed its integrity check: it does not end with this call''s nonce (' , aNonceString
          , '), so it is not this call''s response. Nothing was returned to the client. On GemStone '
          , 'before 3.7.4.1 the likely cause is kernel bug #51438 -- external-session results larger '
          , 'than ' , self class resultBufferBytes printString , ' bytes coming back with a stale '
          , 'tail.'].
  ^aResult copyFrom: 1 to: aResult size - aNonceString size
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
   arrives as the same GciError as before, and leaves the worker usable.
   The buffer reset is inert on any image from 3.7.4.1 on; where it is not, it is what keeps a
   response from arriving with a stale tail -- see #resetWorkerResultBuffer. The nonce is the
   belt to that pair of braces: the worker appends it, this method requires it, and a response
   without it is refused instead of returned -- on every image, whatever the cause."
  ^self workerMutex critical: [ | nonce |
    nonce := self nextResultNonce.
    self resetWorkerResultBuffer.
    worker nbExecute: (self class expressionWith: anExpressionString nonce: nonce).
    [worker isCallInProgress]
      whileTrue: [worker waitForResultForSeconds: self workerWaitSeconds otherwise: [nil]].
    self touch.
    self resultOf: worker lastResult withoutNonce: nonce]
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
  "The next line is for compatibility with 3.7.2. In 3.7.5 it could be replaced with
   worker useOnetimePassword."
  worker onetimePassword: (GsCurrentSession currentSession createOnetimePasswordValidForSeconds: 300).
  worker login.
  self cacheWorkerIds.
  self verifyWorkerResultFidelity.
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
  self verifyWorkerResultFidelity.
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
  "Record now (GMT seconds) as the last activity, for idle-timeout reaping."
  lastActivitySeconds := System timeGmt.
  ^self
%
category: 'accessing'
method: McpSession
userId
  ^userId
%
category: 'result fidelity'
method: McpSession
usesResultBufferReset
  "Whether this session is working around the pre-3.7.4.1 result corruption -- false on any image
   whose probe came back intact, which is every supported image from 3.7.4.1 on."
  ^resultBufferSlot notNil
%
category: 'result fidelity'
method: McpSession
verifyWorkerResultFidelity
  "Establish that what this worker returns is what it computed, before the session serves anything.
   GemStone before 3.7.4.1 (bug #51438) refetches a large result only when the session's fetch buffer
   must grow, so once one big result has grown it, every later result that fits comes back the right
   LENGTH with everything past byte 1024 left over from the previous one. Every MCP response is a
   String fetched exactly that way, so for this server that is the main path, not an edge case.
   The image is PROBED rather than version-checked. That way the workaround switches itself off the
   moment the server runs on a fixed image, applies itself on a version nobody has examined, and
   cannot be wrong about a patched or unusual build -- with no version table to maintain. It costs
   two round trips against a gem that was just forked, and on a fixed image that is all that happens.
   A corrupting image that cannot be repaired fails the session HERE, loudly, rather than answering
   clients with JSON of the right size and the wrong bytes."
  self probeWorkerResultsAreIntact ifTrue: [^self].
  self enableResultBufferReset ifFalse: [
    ^self error: 'This GemStone image corrupts external-session results larger than '
      , self class resultBufferBytes printString , ' bytes (kernel bug #51438, fixed in 3.7.4.1), '
      , 'and the workaround cannot be applied here: ' , worker class name asString
      , ' has no objInfoBuffers instance variable to reset. Run the server on GemStone 3.7.4.1 or '
      , 'later.'].
  self probeWorkerResultsAreIntact ifTrue: [^self].
  ^self error: 'The worker gem for session ' , id printString , ' cannot return large results '
    , 'intact. This GemStone image corrupts external-session results (kernel bug #51438, fixed in '
    , '3.7.4.1) and resetting the fetch buffer did not repair it. Run the server on GemStone 3.7.4.1 '
    , 'or later.'
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
