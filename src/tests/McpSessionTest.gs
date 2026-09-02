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
#forward: and #prepareWorker both go through, and the three guarantees that come with it -- one call
in flight per worker, no reaping a session mid-call, and no call outrunning the deadline its router
configured.

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
category: 'tests - deadline'
method: McpSessionTest
testACallThatBeatsTheDeadlineIsNeverBroken
  "A deadline is a limit, not a schedule. An ordinary call that finishes inside it is untouched, and
   a session with one configured drives its worker exactly as a session without one does."
  | sess w |
  sess := McpMockSession startWithId: 'in-time'.
  sess requestTimeoutSeconds: 600.
  w := sess mockWorker.
  w waitsBeforeDone: 3; nextResult: 'DONE'.
  self assert: (sess forward: 'QUICK') equals: 'DONE'.
  self assert: w softBreakCount equals: 0.
  self assert: w hardBreakCount equals: 0.
  self deny: sess workerAbandoned
%
category: 'tests - cancellation'
method: McpSessionTest
testACancelForAnotherRequestIsIgnored
  "The id check is load-bearing, not a formality. A cancellation very often arrives just after the
   call it names has finished -- the spec says as much and asks receivers to ignore those -- and
   without the check a late cancel would end whatever call happened to be running instead of the one
   the client meant. Which is the same call to the client, and a different one entirely to the gem."
  | sess w raised |
  sess := McpMockSession startWithId: 'wrong-id'.
  w := sess mockWorker.
  w waitsBeforeDone: 3; nextResult: 'FINISHED-ANYWAY'.
  [(Delay forMilliseconds: 50) wait.
   self deny: (sess requestCancel: 999).
   self deny: (sess requestCancel: nil)] fork.
  raised := nil.
  self assert: ([sess forward: 'KEEP-GOING'] on: McpError do: [:ex | raised := ex. nil])
    equals: 'FINISHED-ANYWAY'.
  self assert: raised isNil.
  self assert: w softBreakCount equals: 0
%
category: 'tests - cancellation'
method: McpSessionTest
testACancelFromAnotherProcessEndsTheCallAndLeavesTheSessionUsable
  "A client asking to stop a call runs the SAME escalation a deadline does -- that is why
   cancellation needed no new mechanism -- and costs the client the same thing: that request, not its
   gem, and not the uncommitted work in it.
   The cancel is requested from a DIFFERENT GsProcess, which is how it really arrives: the front end
   serves the notifications/cancelled POST on its own connection while this call holds the worker
   mutex. #requestCancel: therefore only sets a flag; the break is sent by the process that owns the
   mutex, on its next wait."
  | sess w raised |
  sess := McpMockSession startWithId: 'cancel'.
  w := sess mockWorker.
  w waitsBeforeDone: 1000000.        "a call that never finishes on its own"
  [(Delay forMilliseconds: 50) wait. sess requestCancel: 7] fork.
  raised := nil.
  [sess forward: 'LONG-RUNNING' requestId: 7] on: McpError do: [:ex | raised := ex].
  self assert: raised notNil.
  self assert: raised kind equals: #cancelled.
  self assert: (raised description findString: 'cancelled' startingAt: 1) > 0.
  self assert: w softBreakCount equals: 1.
  self assert: w hardBreakCount equals: 0.
  self deny: sess workerAbandoned.
  self deny: sess isBusy.
  "and the client keeps its session -- it cancelled a request, not its work"
  w waitsBeforeDone: 1; nextResult: 'AFTER-CANCEL'.
  self assert: (sess forward: 'NEXT-REQUEST') equals: 'AFTER-CANCEL'
%
category: 'tests - cancellation'
method: McpSessionTest
testACancelIsForgottenWhenItsCallEnds
  "The hazard in letting another GsProcess set a flag: a cancellation that arrived too late, or that
   was never acted on, must not end the NEXT call. Both ends of #forward: clear it -- on the way in
   as well as out, because a cancel can land in the instant between one call finishing and its
   ensure: running."
  | sess w |
  sess := McpMockSession startWithId: 'stale-flag'.
  w := sess mockWorker.
  w waitsBeforeDone: 1; nextResult: 'FIRST'.
  self assert: (sess forward: 'FIRST-REQUEST' requestId: 1) equals: 'FIRST'.
  "the call is over, so this names nothing and must not be remembered"
  self deny: (sess requestCancel: 1).
  w waitsBeforeDone: 1; nextResult: 'SECOND'.
  self assert: (sess forward: 'SECOND-REQUEST' requestId: 2) equals: 'SECOND'.
  self assert: w softBreakCount equals: 0
%
category: 'tests - deadline'
method: McpSessionTest
testADeadlineEndsARunawayCallAndLeavesTheSessionUsable
  "What the deadline is for: a call that will not finish is ended, the client is told, and the client
   keeps its gem. A soft break is what ends it -- the worker is usable immediately afterwards, so the
   session and the uncommitted work in it survive -- and the worker mutex is released on the way out,
   or one runaway would wedge that client for the life of its session."
  | sess w raised |
  sess := McpMockSession startWithId: 'deadline'.
  sess requestTimeoutSeconds: 1.
  w := sess mockWorker.
  w waitsBeforeDone: 1000000.        "a call that never finishes on its own"
  raised := nil.
  [sess forward: 'RUNAWAY'] on: McpError do: [:ex | raised := ex].
  self assert: raised notNil.
  self assert: raised kind equals: #timeout.
  self assert: w softBreakCount equals: 1.
  self assert: w hardBreakCount equals: 0.
  self deny: sess workerAbandoned.
  self deny: sess workerGemStopped.
  self deny: sess isBusy.
  "the session is still the client's to use -- that is the whole difference between ending a call and
   ending a session"
  w waitsBeforeDone: 1; nextResult: 'AFTER-TIMEOUT'.
  self assert: (sess forward: 'NEXT-REQUEST') equals: 'AFTER-TIMEOUT'
%
category: 'tests - deadline'
method: McpSessionTest
testAWorkerThatIgnoresBothBreaksIsStoppedAndFinishesTheSession
  "The last resort. A gem that takes neither break can never serve again -- GCI allows one call in
   flight and this one never ends -- so it is stopped from the stone side and the session is marked
   finished. Two things follow that the reaper and the close path each have to get right: such a
   session must not read as BUSY (its call is in flight and always will be), and closing it must not
   send a logout, which is a GCI call that would queue behind the call that could not be ended."
  | sess w raised |
  sess := McpMockSession startWithId: 'unbreakable'.
  sess requestTimeoutSeconds: 1.
  w := sess mockWorker.
  w waitsBeforeDone: 1000000; resistSoftBreak: true; resistHardBreak: true.
  raised := nil.
  [sess forward: 'UNBREAKABLE'] on: McpError do: [:ex | raised := ex].
  self assert: raised notNil.
  self assert: raised kind equals: #timeout.
  self assert: w softBreakCount equals: 1.
  self assert: w hardBreakCount equals: 1.
  self assert: sess workerGemStopped.
  self assert: sess workerAbandoned.
  self deny: sess isBusy.
  sess close.
  self assert: w logoutCount equals: 0
%
category: 'tests - cancellation'
method: McpSessionTest
testAWorkerThatIgnoresBothBreaksIsStoppedOnACancelToo
  "The escalation is the same one, so its last resort is too: a gem that takes neither break is
   stopped from the stone side and the session is finished. The error says #cancelled -- the client
   asked for this -- but it also has to say the session went with it, because that is the one ending
   where cancelling a request costs more than the request."
  | sess w raised |
  sess := McpMockSession startWithId: 'unbreakable-cancel'.
  w := sess mockWorker.
  w waitsBeforeDone: 1000000; resistSoftBreak: true; resistHardBreak: true.
  [(Delay forMilliseconds: 50) wait. sess requestCancel: 3] fork.
  raised := nil.
  [sess forward: 'STUBBORN' requestId: 3] on: McpError do: [:ex | raised := ex].
  self assert: raised notNil.
  self assert: raised kind equals: #cancelled.
  self assert: w softBreakCount equals: 1.
  self assert: w hardBreakCount equals: 1.
  self assert: sess workerAbandoned.
  self assert: sess workerGemStopped.
  self assert: (raised description findString: 'initialize again' startingAt: 1) > 0
%
category: 'tests - deadline'
method: McpSessionTest
testAWorkerThatIgnoresTheSoftBreakGetsAHardOne
  "The middle step. A soft break that is not taken escalates to a hard one, and a worker that takes
   THAT is still a worker the client keeps: the session is not abandoned and its gem is not stopped."
  | sess w raised |
  sess := McpMockSession startWithId: 'stubborn'.
  sess requestTimeoutSeconds: 1.
  w := sess mockWorker.
  w waitsBeforeDone: 1000000; resistSoftBreak: true.
  raised := nil.
  [sess forward: 'STUBBORN'] on: McpError do: [:ex | raised := ex].
  self assert: raised notNil.
  self assert: raised kind equals: #timeout.
  self assert: w softBreakCount equals: 1.
  self assert: w hardBreakCount equals: 1.
  self deny: sess workerAbandoned.
  self deny: sess workerGemStopped.
  self deny: sess isBusy
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
category: 'tests - result fidelity'
method: McpSessionTest
testCorruptingWorkerIsDetectedAndRepaired
  "A session probes its worker before serving anything: fetch a large result, then a smaller one that
   fits inside the buffer the first one grew. On a pre-3.7.4.1 image the second comes back with a
   stale tail, so the session installs the buffer reset -- and then probes AGAIN, and only starts once
   that pass is clean. Four probes on a corrupting image, two on a healthy one, and none of them
   counted as requests."
  | sess |
  sess := McpMockSession startWithId: 'corrupting' corrupting: true.
  self assert: sess usesResultBufferReset.
  self assert: sess mockWorker probeExpressions size equals: 4.
  self assert: sess mockWorker expressions isEmpty
%
category: 'tests - result fidelity'
method: McpSessionTest
testCorruptingWorkerStillReturnsIntactResults
  "The point of the whole exercise. Two responses in a row on one session, the second smaller than the
   first and both over 1024 bytes -- the sequence that returns 1024 good bytes and a stale tail on
   GemStone before 3.7.4.1. Both arrive whole, because runWorker: puts the fetch buffer back to its
   original size before each call."
  | sess w first second |
  sess := McpMockSession startWithId: 'intact' corrupting: true.
  w := sess mockWorker.
  w waitMs: 1.
  w nextResult: ((String new: 5000) atAllPut: $A; yourself).
  first := sess forward: 'REQUEST-1'.
  w nextResult: ((String new: 2000) atAllPut: $B; yourself).
  second := sess forward: 'REQUEST-2'.
  self assert: first size equals: 5000.
  self assert: (first occurrencesOf: $A) equals: 5000.
  self assert: second size equals: 2000.
  self assert: (second occurrencesOf: $B) equals: 2000
%
category: 'tests - response integrity'
method: McpSessionTest
testEveryCallCarriesItsOwnNonce
  "The nonce has to be per-call. With a fixed sentinel, a stale tail inherited from a previous
   response of the SAME length would carry the sentinel at exactly the offset the check looks at, and
   sail through. Consecutive calls must therefore never repeat one."
  | sess first second |
  sess := McpMockSession startWithId: 'nonces'.
  sess mockWorker waitMs: 1.
  sess forward: 'REQUEST-1'.
  sess forward: 'REQUEST-2'.
  first := McpSession resultNonceIn: (sess mockWorker expressions at: 1).
  second := McpSession resultNonceIn: (sess mockWorker expressions at: 2).
  self assert: first notNil.
  self assert: second notNil.
  self deny: first = second
%
category: 'tests - result fidelity'
method: McpSessionTest
testFaithfulWorkerNeedsNoResultBufferReset
  "On a fixed image the probe passes first time and the session carries no workaround at all: no
   buffer to reset, nothing stored before a call, and only the two probes it took to find that out."
  | sess |
  sess := McpMockSession startWithId: 'faithful'.
  self deny: sess usesResultBufferReset.
  self assert: sess mockWorker probeExpressions size equals: 2
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
category: 'tests - deadline'
method: McpSessionTest
testNoDeadlineLetsALongCallRunToCompletion
  "nil is a real setting, and the one a deployment asks for when its tools are legitimately slow:
   with no deadline a call is waited out however long it takes. It is also what a session configures
   for ITSELF -- the policy belongs to the router, which pushes one in as it opens the session."
  | sess w |
  sess := McpMockSession startWithId: 'no-deadline'.
  self assert: sess requestTimeoutSeconds isNil.
  w := sess mockWorker.
  w waitsBeforeDone: 25; nextResult: 'SLOW-BUT-DONE'.
  self assert: (sess forward: 'SLOW') equals: 'SLOW-BUT-DONE'.
  self assert: w softBreakCount equals: 0.
  self assert: w hardBreakCount equals: 0
%
category: 'tests - response integrity'
method: McpSessionTest
testNonceIsStrippedFromTheResponse
  "The client sees its response and nothing else: the nonce goes on inside the worker and comes off
   in runWorker:, so nothing downstream has to know it exists."
  | sess out |
  sess := McpMockSession startWithId: 'strip'.
  sess mockWorker waitMs: 1; nextResult: '{"jsonrpc":"2.0","id":1,"result":{}}'.
  out := sess forward: '{"jsonrpc":"2.0","id":1,"method":"ping"}'.
  self assert: out equals: '{"jsonrpc":"2.0","id":1,"result":{}}'.
  self deny: (self includesCS: McpSession resultNonceMarker in: out)
%
category: 'tests - response integrity'
method: McpSessionTest
testNonceRoundTripsThroughTheExpression
  "The wrapper and the reader are inverses, and the reader is not fooled by a request body that
   merely contains something nonce-shaped -- it reads a fixed offset from the end, not a search."
  | nonce wrapped |
  nonce := McpSession resultNonceMarker , '000000000042'.
  wrapped := McpSession expressionWith: 'McpServer handleJsonString: ''{}''' nonce: nonce.
  self assert: (McpSession resultNonceIn: wrapped) equals: nonce.
  self assert: (McpSession resultNonceIn: 'McpServer handleJsonString: ''{}''') isNil.
  self assert: (McpSession resultNonceIn: 'a body ending in ' , nonce) isNil
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
category: 'tests - result fidelity'
method: McpSessionTest
testProbeExpressionRoundTrips
  "The probe expression and the reader that recognises it are inverses -- which is what lets
   McpMockWorker answer a probe the way a gem would. Anything else is not a probe."
  | expr req |
  expr := McpSession resultFidelityProbeExpressionBytes: 2048 marker: $A.
  req := McpSession resultFidelityProbeRequestFrom: expr.
  self assert: req notNil.
  self assert: (req at: 1) equals: 2048.
  self assert: (req at: 2) equals: $A.
  self assert: (McpSession resultFidelityProbeRequestFrom: 'McpServer handleJsonString: ''{}''') isNil
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
category: 'tests - response integrity'
method: McpSessionTest
testResponseWithoutItsNonceIsRejected
  "The whole point of the check: a response that lost its tail is REFUSED, not returned. It arrives
   looking like a perfectly good answer -- right shape, plausible content -- and the only thing that
   gives it away is the missing nonce. The error has to name the session and the nonce, because that
   is what a report of this will be traced with."
  | sess w raised recovered |
  sess := McpMockSession startWithId: 'rejected'.
  w := sess mockWorker.
  w waitMs: 1; nextResult: '{"jsonrpc":"2.0","id":1,"result":{}}'.
  w dropResultNonce: true.
  raised := [sess forward: '{"id":1}'. nil]
    on: Error
    do: [:ex | [ex description] on: Error do: [:x | ex class name asString]].
  self assert: raised notNil.
  self assert: (self includesCS: 'integrity check' in: raised).
  self assert: (self includesCS: 'rejected' in: raised).
  self assert: (self includesCS: McpSession resultNonceMarker in: raised).
  "and the session is still usable once the worker behaves again"
  w dropResultNonce: false.
  recovered := sess forward: '{"id":2}'.
  self assert: recovered equals: '{"jsonrpc":"2.0","id":1,"result":{}}'
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
category: 'tests - result fidelity'
method: McpSessionTest
testTheCorruptingMockWorkerReallyCorrupts
  "Guard the premise of the tests above: a corrupting worker driven WITHOUT the workaround really does
   reproduce kernel bug #51438. A 5000-byte result grows the fetch buffer; the 2000-byte result after
   it comes back the right LENGTH with only its first 1024 bytes its own -- the same numbers measured
   on GemStone 3.7.2. If this test ever passes trivially, the others prove nothing."
  | w big small |
  w := McpMockWorker new
    simulateResultCorruption: true;
    waitMs: 1;
    yourself.
  w nextResult: ((String new: 5000) atAllPut: $A; yourself).
  w nbExecute: 'first'.
  w waitForResultForSeconds: 1 otherwise: [nil].
  big := w lastResult.
  w nextResult: ((String new: 2000) atAllPut: $B; yourself).
  w nbExecute: 'second'.
  w waitForResultForSeconds: 1 otherwise: [nil].
  small := w lastResult.
  self assert: (big occurrencesOf: $A) equals: 5000.
  self assert: small size equals: 2000.                      "the right length ..."
  self assert: (small occurrencesOf: $B) equals: 1024.       "... and the wrong bytes"
  self assert: (small occurrencesOf: $A) equals: 976         "the tail of the previous result"
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
