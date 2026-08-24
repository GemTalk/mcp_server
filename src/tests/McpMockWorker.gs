set compile_env: 0
! ------------------- Class definition for McpMockWorker
expectvalue /Class
doit
Object subclass: 'McpMockWorker'
  instVarNames: #( expressions currentExpression inProgress
                    waitsRemaining waitsBeforeDone waitMs nextResult
                    lastResult errorOnComplete waitCount blockingExecuteCount
                    overlapDetected staleReadAttempted loginCount stoneSessionId
                    gemProcessId idFetchCount)
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
The blocking executeString: is implemented too, and counted: a test asserts it is never used.'
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
  expressions add: aString.
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
category: 'instrumentation'
method: McpMockWorker
overlapDetected
  "Whether two calls were ever in flight at once -- the thing McpSession's worker mutex prevents."
  ^overlapDetected
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
  waitCount := waitCount + 1.
  (Delay forMilliseconds: waitMs) wait.
  waitsRemaining := waitsRemaining - 1.
  waitsRemaining > 0 ifTrue: [^aBlock value].
  inProgress := false.
  errorOnComplete ifNotNil: [
    msg := errorOnComplete.
    errorOnComplete := nil.
    ^self error: msg].
  lastResult := nextResult ifNil: ['echo: ' , currentExpression].
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
