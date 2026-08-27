set compile_env: 0
! ------------------- Class definition for McpMockWorker
expectvalue /Class
doit
Object subclass: 'McpMockWorker'
  instVarNames: #( expressions currentExpression inProgress
                    waitsRemaining waitsBeforeDone waitMs nextResult
                    lastResult errorOnComplete waitCount blockingExecuteCount
                    overlapDetected staleReadAttempted loginCount stoneSessionId
                    gemProcessId idFetchCount objInfoBuffers bufferContents
                    refetchOnlyWhenGrowing probeExpressions currentIsProbe dropResultNonce)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpMockWorker comment: 
'A stand-in for the GsTsExternalSession worker gem McpSession drives, implementing just the
protocol McpSession>>runWorker: uses -- nbExecute:, isCallInProgress,
waitForResultForSeconds:otherwise:, lastResult -- plus the login/logout sends startWithId: makes.
It spawns no gem, so a test can assert HOW the worker was driven rather than only what came back.

It reproduces the three behaviours of the real class that the non-blocking forward depends on,
each verified against GemStone 3.7.5:
  - waitForResultForSeconds:otherwise: CONSUMES the result (the real one sends nbResult itself and
    caches it), so the value is read afterwards with lastResult;
  - a wait that times out leaves lastResult holding the PREVIOUS call''s value -- set staleResult:
    to make a test fail loudly if that value ever escapes;
  - a second call while one is in flight fails (real GCI: `operation in progress`), which is what
    the per-session mutex exists to prevent. That overlap is recorded as well as raised, so a
    violation inside a forked GsProcess cannot be swallowed;
  - the two identity accessors, stoneSessionId and gemProcessId, memoize a REMOTE call, so the
    first send of each overwrites lastResult -- the clobber McpSession>>cacheWorkerIds defuses by
    fetching them at login, before any request can be in flight.
Its waits really do wait a few milliseconds, so a forked GsProcess gets to run during one.
The blocking executeString: is implemented too, and counted: a test asserts it is never used.

It also models the kernel''s RESULT FETCH, including the pre-3.7.4.1 defect in it -- an
objInfoBuffers instance variable of the same name and shape, and a fetch that refetches a large
result either whenever the initial 1024-byte fetch was too small (a fixed image) or only when the
buffer has to grow (#simulateResultCorruption:, an image with bug #51438). That is what lets
McpSession''s workaround be tested on any version, since the shipping code finds the buffer here the
same way it finds it in a real session.

Fidelity probes are answered like a real gem would answer them, but they are kept OUT of the
instrumentation a test reads -- #expressions, #waitCount and the rest count requests only, with the
probes recorded separately as #probeExpressions.

A real gem also appends the per-call nonce McpSession>>runWorker: asked for, since that is part of
the expression it was handed; this mock does the same, and #dropResultNonce: makes it stop -- which
is how a response that lost its tail is tested without having to corrupt one.'
%
expectvalue /Class
doit
McpMockWorker category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpMockWorker
removeallmethods McpMockWorker
removeallclassmethods McpMockWorker
! ------------------- Class methods for McpMockWorker
category: 'instance creation'
classmethod: McpMockWorker
new
  ^super new initialize
%
! ------------------- Instance methods for McpMockWorker
category: 'instrumentation'
method: McpMockWorker
blockingExecuteCount
  "How many times the BLOCKING executeString: was used. The whole point of the non-blocking
   forward is that this stays zero."
  ^blockingExecuteCount
%
category: 'configuring'
method: McpMockWorker
dropResultNonce: aBoolean
  "Stop appending the nonce the expression asked for, so the next response arrives looking complete
   but missing its tail -- what a truncated or stale response looks like to McpSession. The failure
   it produces is McpSession>>resultOf:withoutNonce: refusing the response."
  dropResultNonce := aBoolean
%
category: 'configuring'
method: McpMockWorker
errorOnComplete: aMessageString
  "Raise an Error with this text when the in-flight call completes, standing in for a worker-side
   error (which the real class relays as a GciError). The call is marked finished first, as the real
   one is: an errored call leaves the session usable for the next request."
  errorOnComplete := aMessageString
%
category: 'session protocol'
method: McpMockWorker
executeString: aString
  "The blocking path McpSession no longer uses. Implemented so a test that exercises it gets a
   result rather than a doesNotUnderstand, and counted so a test can prove it was not taken."
  blockingExecuteCount := blockingExecuteCount + 1.
  expressions add: aString.
  lastResult := nextResult.
  ^nextResult
%
category: 'instrumentation'
method: McpMockWorker
expressions
  "Every expression handed to this worker, in order."
  ^expressions
%
category: 'result fetch'
method: McpMockWorker
fetchThroughBuffer: aResult
  "Answer aResult as the kernel's result fetch would deliver it, buffer and all.
   GsTsExternalSession copies a byte-format result into a per-session buffer that starts at 1024
   bytes and only ever grows. The first fetch brings back at most 1024 bytes; anything longer needs a
   second one. A fixed image performs that second fetch whenever the first was too small. Before
   3.7.4.1 it performed it only when the buffer had to GROW, so a result that fitted in an
   already-grown buffer kept its first 1024 bytes and inherited the previous result's tail --
   #simulateResultCorruption: chooses which of the two this mock is.
   Restoring the buffer to 1024 bytes, which is what McpSession>>resetWorkerResultBuffer does before
   every call, makes the two behave identically. That is the whole point of the workaround, and this
   is where a test can watch it work."
  | n bufSize |
  aResult isString ifFalse: [^aResult].
  n := aResult size.
  self writeIntoResultBuffer: (aResult copyFrom: 1 to: (n min: McpSession resultBufferBytes)).
  n > McpSession resultBufferBytes ifTrue: [
    bufSize := (objInfoBuffers at: 2) size.
    n > bufSize
      ifTrue: [
        objInfoBuffers at: 2 put: (CByteArray gcMalloc: n).
        self writeIntoResultBuffer: aResult]
      ifFalse: [
        refetchOnlyWhenGrowing ifFalse: [self writeIntoResultBuffer: aResult]]].
  ^self resultBufferPrefix: n
%
category: 'session protocol'
method: McpMockWorker
gemProcessId
  "A memoizing REMOTE accessor in the real class: the first send performs a GCI call and so
   overwrites lastResult, later sends are inert. Modelled because that clobber is the whole reason
   McpSession>>cacheWorkerIds fetches these once at login. It is not counted as a blocking forward
   (blockingExecuteCount) -- it is a deliberate blocking call at session open, counted as
   #idFetchCount instead."
  gemProcessId ifNil: [
    idFetchCount := idFetchCount + 1.
    lastResult := gemProcessId := 4242].
  ^gemProcessId
%
category: 'instrumentation'
method: McpMockWorker
idFetchCount
  "How many of the two identity accessors actually called out. Two after one #cacheWorkerIds, and it
   must stay at two however often they are sent again."
  ^idFetchCount
%
category: 'initialization'
method: McpMockWorker
initialize
  expressions := OrderedCollection new.
  inProgress := false.
  waitsBeforeDone := 1.
  waitsRemaining := 0.
  waitMs := 20.
  waitCount := 0.
  blockingExecuteCount := 0.
  loginCount := 0.
  overlapDetected := false.
  staleReadAttempted := false.
  idFetchCount := 0.
  probeExpressions := OrderedCollection new.
  currentIsProbe := false.
  refetchOnlyWhenGrowing := false.
  dropResultNonce := false.
  bufferContents := String new.
  objInfoBuffers := Array
    with: (CByteArray gcMalloc: 40)
    with: (CByteArray gcMalloc: McpSession resultBufferBytes)
    with: Array new.
  ^self
%
category: 'session protocol'
method: McpMockWorker
isCallInProgress
  ^inProgress
%
category: 'session protocol'
method: McpMockWorker
jwtPassword: aString
  ^self
%
category: 'session protocol'
method: McpMockWorker
lastResult
  "The result the last completed call left behind. Reading this while a call is in flight is the
   mistake the design has to avoid -- the real class would answer the PREVIOUS call's value -- so
   record the attempt instead of hiding it."
  inProgress ifTrue: [staleReadAttempted := true].
  ^lastResult
%
category: 'session protocol'
method: McpMockWorker
login
  loginCount := loginCount + 1.
  ^self
%
category: 'instrumentation'
method: McpMockWorker
loginCount
  ^loginCount
%
category: 'session protocol'
method: McpMockWorker
logout
  inProgress := false.
  ^self
%
category: 'session protocol'
method: McpMockWorker
nbExecute: aString
  "Start a call. A second one while another is in flight is what the real GCI refuses with
   `session has a GciTsNb operation in progress`; record it as well as raise, so the failure
   survives being raised inside a forked GsProcess."
  inProgress ifTrue: [
    overlapDetected := true.
    ^self error: 'session has a GciTsNb operation in progress'].
  currentIsProbe := (McpSession resultFidelityProbeRequestFrom: aString) notNil.
  currentIsProbe
    ifTrue: [probeExpressions add: aString]
    ifFalse: [expressions add: aString].
  currentExpression := aString.
  waitsRemaining := waitsBeforeDone.
  inProgress := true.
  ^self
%
category: 'configuring'
method: McpMockWorker
nextResult: anObject
  "What the next call answers on completion. Left unset, a call answers 'echo: ' followed by its own
   expression, so a test with two calls in flight can tell their results apart."
  nextResult := anObject
%
category: 'session protocol'
method: McpMockWorker
onetimePassword: aString
  "This is for compatibility with 3.7.2. In 3.7.5, #useOnetimePassword could be used instead."
  ^self
%
category: 'instrumentation'
method: McpMockWorker
overlapDetected
  "Whether two calls were ever in flight at once -- the thing McpSession's worker mutex prevents."
  ^overlapDetected
%
category: 'instrumentation'
method: McpMockWorker
probeExpressions
  "The fidelity probes handed to this worker, in order. They are kept out of #expressions so that a
   test counting the requests a session made is not counting the two probes McpSession runs at
   login -- or the two more it runs to confirm a workaround took."
  ^probeExpressions
%
category: 'result fetch'
method: McpMockWorker
resultBufferPrefix: anInteger
  "The first anInteger bytes of what is currently in the buffer -- what resolveResult: answers, since
   it trusts the object's reported size rather than what was actually fetched. This is why a corrupt
   result has the RIGHT length and the wrong bytes."
  ^bufferContents size > anInteger
    ifTrue: [bufferContents copyFrom: 1 to: anInteger]
    ifFalse: [bufferContents]
%
category: 'result fetch'
method: McpMockWorker
resultForCurrentExpression
  "What the in-flight call computes, before it is fetched back through the buffer. A fidelity probe
   is answered the way a real gem would answer it -- the string it asked for -- so that McpSession's
   probe exercises the same path here as it does against a gem.
   The per-call nonce is appended for the same reason: a gem evaluating the wrapped expression would
   append it, and McpSession requires it back. #dropResultNonce: is the seam that withholds it."
  | req base nonce |
  req := McpSession resultFidelityProbeRequestFrom: currentExpression.
  base := req notNil
    ifTrue: [(String new: (req at: 1)) atAllPut: (req at: 2); yourself]
    ifFalse: [nextResult ifNil: ['echo: ' , currentExpression]].
  base isString ifFalse: [^base].
  dropResultNonce == true ifTrue: [^base].
  nonce := McpSession resultNonceIn: currentExpression.
  ^nonce isNil ifTrue: [base] ifFalse: [base , nonce]
%
category: 'configuring'
method: McpMockWorker
simulateResultCorruption: aBoolean
  "Make this worker behave like a pre-3.7.4.1 image (true) or a fixed one (false, the default): see
   #fetchThroughBuffer:. It is the ONE line of difference between the two versions of
   GsTsExternalSession>>resolveResult:."
  refetchOnlyWhenGrowing := aBoolean
%
category: 'instrumentation'
method: McpMockWorker
staleReadAttempted
  "Whether lastResult was read while a call was still in flight, which in the real class would
   answer the previous request's response."
  ^staleReadAttempted
%
category: 'configuring'
method: McpMockWorker
staleResult: anObject
  "Seed lastResult as a completed earlier call would have left it, so a premature read answers
   this recognisably wrong value rather than nil."
  lastResult := anObject
%
category: 'session protocol'
method: McpMockWorker
stoneSessionId
  "The other memoizing REMOTE accessor printOn: sends -- see #gemProcessId."
  stoneSessionId ifNil: [
    idFetchCount := idFetchCount + 1.
    lastResult := stoneSessionId := 77].
  ^stoneSessionId
%
category: 'session protocol'
method: McpMockWorker
useOnetimePassword
  "This is not called in 3.7.2-compatible code, but it could be used in 3.7.5."
  ^self
%
category: 'session protocol'
method: McpMockWorker
username: aString
  ^self
%
category: 'instrumentation'
method: McpMockWorker
waitCount
  "How many waits it took to collect the results so far. Zero would mean the caller never waited."
  ^waitCount
%
category: 'session protocol'
method: McpMockWorker
waitForResultForSeconds: anInteger otherwise: aBlock
  "Wait for the in-flight call. Answers aBlock's value while the call is unfinished (the real class
   answers it on a socket timeout) and self once it is done, having consumed the result into
   lastResult -- which is why the caller reads lastResult and not nbResult. The wait genuinely
   waits, so another GsProcess runs during it, as it does in the real class."
  | msg |
  currentIsProbe ifFalse: [waitCount := waitCount + 1].
  (Delay forMilliseconds: waitMs) wait.
  waitsRemaining := waitsRemaining - 1.
  waitsRemaining > 0 ifTrue: [^aBlock value].
  inProgress := false.
  errorOnComplete ifNotNil: [
    msg := errorOnComplete.
    errorOnComplete := nil.
    ^self error: msg].
  lastResult := self fetchThroughBuffer: self resultForCurrentExpression.
  ^self
%
category: 'configuring'
method: McpMockWorker
waitMs: anInteger
  "How long one wait really sleeps. It has to be a real wait, not zero: that is what lets a forked
   GsProcess run while a call is in flight."
  waitMs := anInteger
%
category: 'configuring'
method: McpMockWorker
waitsBeforeDone: anInteger
  "How many waits a call takes to finish, standing in for a slow worker. 1 (the default) completes
   on the first wait."
  waitsBeforeDone := anInteger
%
category: 'result fetch'
method: McpMockWorker
writeIntoResultBuffer: aString
  "Copy aString into the front of the buffer, leaving any bytes beyond it untouched -- which is what
   a fetch of fewer bytes than the buffer holds does, and why the leftovers are the PREVIOUS result."
  bufferContents := aString size >= bufferContents size
    ifTrue: [aString copy]
    ifFalse: [aString , (bufferContents copyFrom: aString size + 1 to: bufferContents size)]
%
