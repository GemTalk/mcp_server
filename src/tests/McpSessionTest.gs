set compile_env: 0
! ------------------- Class definition for McpSessionTest
expectvalue /Class
doit
GsTestCase subclass: 'McpSessionTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpSessionTest comment: 
'Covers how McpSession drives its worker gem: McpSession>>runWorker:, the non-blocking call that
#forward: and #prepareWorker both go through, and the two guarantees that come with it -- one call
in flight per worker, and no reaping a session mid-call.

A blocking GCI executeString: blocks in C, so while one ran the front-end gem executed no Smalltalk
and EVERY other GsProcess stopped: other clients'' requests, the accept loop, the idle reaper, and
any open SSE stream. That is why the calls are started with nbExecute: and awaited in Smalltalk.
These tests use McpMockSession / McpMockWorker rather than a real gem, so what they check is that
the shipping code drives the worker the one way that is correct: start with nbExecute:, wait,
and read the result only once the call is over. The measurements behind the design are in
McpSession>>runWorker:; the end-to-end proof that a stream keeps flowing during a long tool call
belongs to test.sh.'
%
expectvalue /Class
doit
McpSessionTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpSessionTest
removeallmethods McpSessionTest
removeallclassmethods McpSessionTest
! ------------------- Class methods for McpSessionTest
! ------------------- Instance methods for McpSessionTest
category: 'helpers'
method: McpSessionTest
includesCS: aSubstring in: aString
  "Case-sensitive substring test. GemStone's String>>includesString: is case-INsensitive
   (e.g. 'FAIL' matches the 'fail' in 'failed'), so use findString:startingAt: (which is
   case-sensitive) for assert:/deny: substring checks."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'tests - forwarding'
method: McpSessionTest
testConcurrentForwardsOnOneSessionAreSerialized
  "GCI allows ONE call in flight per session: a second one fails with `operation in progress`. The
   blocking executeString: used to prevent that by accident (it froze the whole gem, so a second
   GsProcess could not run at all); with the non-blocking call the session's own mutex has to do it.
   A client may legitimately have two requests outstanding, and McpRouter>>serve: gives each
   connection its own GsProcess, so this is a reachable case and not a theoretical one."
  | sess w forked second |
  sess := McpMockSession startWithId: 'concurrent'.
  w := sess mockWorker.
  w waitsBeforeDone: 5; waitMs: 20.        "a call takes ~100ms, long enough to overlap"
  forked := Array new: 1.
  [forked at: 1 put: (sess forward: 'REQUEST-A')] fork.
  self assert: (self waitUpTo: 1000 for: [sess isBusy]).   "the forked call is in flight ..."
  "... so this one must queue on the mutex rather than collide with it"
  second := sess forward: 'REQUEST-B'.
  self deny: w overlapDetected.
  self assert: (self waitUpTo: 1000 for: [(forked at: 1) notNil]).
  "each request got ITS OWN response -- crossed answers are what a shared worker would produce"
  self assert: (self includesCS: 'REQUEST-B' in: second).
  self deny: (self includesCS: 'REQUEST-A' in: second).
  self assert: (self includesCS: 'REQUEST-A' in: (forked at: 1)).
  self deny: (self includesCS: 'REQUEST-B' in: (forked at: 1)).
  self assert: w expressions size equals: 2.   "both requests ran, neither was lost"
  self assert: w blockingExecuteCount equals: 0
%
category: 'tests - forwarding'
method: McpSessionTest
testForwardNeverAnswersAStaleResult
  "The trap in the non-blocking API: after a wait that timed out, lastResult still holds the
   PREVIOUS call's value, so reading it before the call is done would answer one request with
   another request's response. runWorker: reads it only once isCallInProgress answers false."
  | sess w |
  sess := McpMockSession startWithId: 'stale'.
  w := sess mockWorker.
  w staleResult: 'PREVIOUS-RESPONSE'; nextResult: 'FRESH-RESPONSE'; waitsBeforeDone: 4.
  self assert: (sess forward: '{"jsonrpc":"2.0","id":2,"method":"ping"}') equals: 'FRESH-RESPONSE'.
  self deny: w staleReadAttempted.
  self assert: w waitCount equals: 4     "one per wait, and none wasted spinning"
%
category: 'tests - forwarding'
method: McpSessionTest
testForwardRunsTheRequestWithoutBlockingTheGem
  "The request reaches the worker through nbExecute: and a Smalltalk wait -- never through the
   blocking executeString: that stopped every other GsProcess in the front end."
  | sess w out |
  sess := McpMockSession startWithId: 'basic'.
  w := sess mockWorker.
  w nextResult: '{"jsonrpc":"2.0","id":1,"result":{}}'.
  out := sess forward: '{"jsonrpc":"2.0","id":1,"method":"ping"}'.
  self assert: out equals: '{"jsonrpc":"2.0","id":1,"result":{}}'.
  self assert: w blockingExecuteCount equals: 0.
  self assert: w waitCount > 0.
  self assert: (self includesCS: 'McpServer handleJsonString:' in: w expressions last)
%
category: 'tests - forwarding'
method: McpSessionTest
testForwardTouchesTheActivityClock
  "Idle reaping is driven by this clock, and forward: stamps it at both ends of the call: on entry,
   and again in runWorker: when the result arrives -- so a long call does not leave the session
   looking idle the moment it returns."
  | sess w before |
  sess := McpMockSession startWithId: 'clock'.
  w := sess mockWorker.
  w waitsBeforeDone: 3; waitMs: 20.
  before := sess lastActivitySeconds.
  self assert: before notNil.
  sess forward: 'REQUEST'.
  self assert: sess lastActivitySeconds >= before.
  self assert: sess idleSeconds <= 1
%
category: 'tests - reaping'
method: McpSessionTest
testIsBusyReportsACallInFlight
  "What the reaper asks. False at rest, true while a call is in flight, false again afterwards --
   and it must not need a GCI call to answer, since the reaper cannot afford to block."
  | sess w |
  sess := McpMockSession startWithId: 'busy'.
  w := sess mockWorker.
  self deny: sess isBusy.
  w waitsBeforeDone: 5; waitMs: 20.
  [sess forward: 'REQUEST'] fork.
  self assert: (self waitUpTo: 1000 for: [sess isBusy]).
  self assert: (self waitUpTo: 1000 for: [sess isBusy not])
%
category: 'tests - forwarding'
method: McpSessionTest
testPrepareWorkerUsesTheSameNonBlockingPath
  "Session open runs in the front-end gem too, so the bootstrap call must not block it either."
  | sess w |
  sess := McpMockSession startWithId: 'prepare'.
  w := sess mockWorker.
  w nextResult: 'McpServer ready'.
  self assert: sess prepareWorker equals: 'McpServer ready'.
  self assert: w blockingExecuteCount equals: 0.
  self assert: (self includesCS: 'prepareWorkerWithToolsets:' in: w expressions last)
%
category: 'tests - reaping'
method: McpSessionTest
testReaperLeavesASessionWithACallInFlightAlone
  "forward: stamps the activity clock when a call STARTS, so a request that outlives the idle
   deadline would look idle while it was still running -- and the reaper would log its worker out
   from under it. That was impossible while forwarding froze the gem (the reaper could not run
   either), so the guard belongs with the non-blocking forward."
  | r sess w |
  r := McpRouter new.
  sess := r openSessionCreating: [:id | McpMockSession startWithId: id].
  w := sess mockWorker.
  "Fully idle by this server's measure -- as many answered pings as release takes. It has to be a
   fake: #runWorker: stamps the activity clock when a call ENDS as well as when it starts, and that
   legitimately resets the real count, so a genuine one could not survive the call being tested."
  sess fakeQuietProbes: r confirmationsBeforeRelease.
  w waitsBeforeDone: 10; waitMs: 20.
  [sess forward: 'SLOW-REQUEST'] fork.
  self assert: (self waitUpTo: 1000 for: [sess isBusy]).
  self assert: r reapIdleSessions equals: 0.
  "once the call is over the same idle session is reaped as before"
  self assert: (self waitUpTo: 2000 for: [sess isBusy not]).
  self assert: r reapIdleSessions equals: 1
%
category: 'tests - session open'
method: McpSessionTest
testStartCachesTheWorkerIdsSoAPrintCannotClobberAResult
  "GsTsExternalSession>>printOn: sends #stoneSessionId and #gemProcessId, and each is a memoizing
   REMOTE call -- so printing a worker that nothing has queried overwrites its lastResult, and a
   print between the nbExecute: and the lastResult read in #runWorker: would answer a client with
   the gem's pid. Session open fetches both once, while nothing is in flight, which leaves the
   kernel's instance variables set for the worker's life so any later print is inert. Assert that
   the fetch happened at open rather than through the forwarding path, that it is not repeated, and
   that the session carries the two values to log in place of the worker."
  | sess w |
  sess := McpMockSession startWithId: 'ids'.
  w := sess mockWorker.
  self assert: w idFetchCount equals: 2.
  self assert: w expressions isEmpty.
  self assert: sess workerStoneSession equals: w stoneSessionId.
  self assert: sess workerPid equals: w gemProcessId.
  self assert: w idFetchCount equals: 2
%
category: 'tests - forwarding'
method: McpSessionTest
testWorkerErrorPropagatesAndLeavesTheSessionUsable
  "A worker-side error reaches the front end as the same error the blocking call raised, so callers'
   handlers are unaffected -- and it must release the worker mutex, or one failed request would
   wedge that client for the life of its session."
  | sess w raised |
  sess := McpMockSession startWithId: 'error'.
  w := sess mockWorker.
  w errorOnComplete: 'a MessageNotUnderstood occurred (error 2010)'.
  raised := false.
  [sess forward: 'BAD-REQUEST'] on: Error do: [:ex | raised := true].
  self assert: raised.
  self deny: sess isBusy.
  w nextResult: 'AFTER-ERROR'.
  self assert: (sess forward: 'NEXT-REQUEST') equals: 'AFTER-ERROR'
%
category: 'tests - forwarding'
method: McpSessionTest
testWorkerExpressionCarriesALifetimeNoteOnlyWhenThereIsOne
  "The note rides in on the request because the worker cannot see the front end's configuration.
   The keyword is omitted when there is no note, so a deployment that bounds nothing sends exactly
   the expression it always sent -- and the one-argument entry point stays the documented direct
   call. A note is embedded via printString, like the body, so an apostrophe in it cannot break the
   expression."
  | sess |
  sess := McpMockSession startWithId: 'expr'.
  self assert: (sess workerExpressionFor: '{}')
    equals: 'McpServer handleJsonString: ''{}'''.
  self assert: (sess workerExpressionFor: '{}' lifetimeNote: nil)
    equals: 'McpServer handleJsonString: ''{}'''.
  self assert: (sess workerExpressionFor: '{}' lifetimeNote: '10 minutes, it''s ending')
    equals: 'McpServer handleJsonString: ''{}'' lifetimeNote: ''10 minutes, it''''s ending'''
%
category: 'helpers'
method: McpSessionTest
waitUpTo: aMillisecondCount for: aBlock
  "Poll aBlock until it answers true, or give up. Answers whether it came true. Bounded so a
   broken expectation fails the assertion instead of hanging the suite."
  | ticks |
  ticks := aMillisecondCount // 10.
  [aBlock value or: [ticks <= 0]] whileFalse: [
    ticks := ticks - 1.
    (Delay forMilliseconds: 10) wait].
  ^aBlock value
%
