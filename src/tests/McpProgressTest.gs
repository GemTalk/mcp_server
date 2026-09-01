set compile_env: 0
! ------------------- Class definition for McpProgressTest
expectvalue /Class
doit
GsTestCase subclass: 'McpProgressTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpProgressTest comment: 
'The progress pathway, both ends of it, without a client and without a second gem.

The WORKER end (McpProgressReporter) is testable in one gem because a session may signal itself:
System sendSignal:to:withMessage: to System session queues a message this same gem can poll back.
That is not a mock of the real thing, it is the real thing with both ends in one process -- the
router''s poller does exactly this poll.

The FRONT-END end (McpProgressChannel, and McpRouter''s handling of a signal) has no gem in it at
all, which is the point of splitting it out.

Every test that signals DRAINS afterwards. The Stone-side queue is per session and holds 50; a test
that left messages in it would hand them to the next test, and the one test here that deliberately
fills it would otherwise poison everything after it.'
%
expectvalue /Class
doit
McpProgressTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpProgressTest
removeallmethods McpProgressTest
removeallclassmethods McpProgressTest
! ------------------- Class methods for McpProgressTest
! ------------------- Instance methods for McpProgressTest
category: 'helpers'
method: McpProgressTest
drainSignals
  "Empty this gem's signal queue and answer what was in it, oldest first, as payload Strings.
   Uses the shipping extractor (McpRouter>>payloadOfSignal:), so a test asserting on a payload is
   asserting on the same cut the router makes -- messageText is prose with the payload after a
   literal 'message: ', not the payload itself."
  | r out sig |
  r := McpRouter new.
  out := OrderedCollection new.
  [(sig := InterSessionSignal poll) notNil] whileTrue: [
    out add: (r payloadOfSignal: sig)].
  ^out
%
category: 'helpers'
method: McpProgressTest
reporter
  "A reporter aimed at THIS gem, so what it sends can be polled back here."
  ^McpProgressReporter frontEndSession: System session callId: 'call-1'
%
category: 'running'
method: McpProgressTest
setUp
  "Start every test with an empty signal queue: a previous test's leftovers would be read as this
   test's ticks."
  self drainSignals.
  ^self
%
category: 'running'
method: McpProgressTest
tearDown
  self drainSignals.
  ^self
%
category: 'tests - front end'
method: McpProgressTest
testAForgottenChannelStopsReceiving
  "Unregistered as the call returns, so a later tick has nowhere to go. That is the mechanism, not a
   leak: the alternative is a map that grows for the life of the gem."
  | r sess ch |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  ch := r registerChannelForToken: 9 session: sess.
  self assert: (r channelAt: ch callId) == ch.
  r forgetChannel: ch.
  self assert: (r channelAt: ch callId) isNil.
  System sendSignal: 1 to: System session withMessage: '{"c":"' , ch callId , '","p":1}'.
  r drainWorkerSignals.
  self assert: ch isEmpty
%
category: 'tests - reporter'
method: McpProgressTest
testANestedCallDoesNotDestroyTheOuterReporter
  "The bug this pathway actually had, and the one only an end-to-end run found. A tool that runs a
   test suite can run tests which themselves send handleJsonString: -- gs-mcp's own suites do -- and
   while that call CLEARED the progress reporter on its way out, the first nested one wiped the
   reporter its caller was still reporting through. Every later tick vanished, silently, because a
   tick with nowhere to go is indistinguishable from a tool that reports nothing.
   Saved and restored, the nesting is harmless. Asserted on SessionTemps rather than on a stream,
   because the reporter's presence is the whole of what was lost."
  | srv outer |
  SessionTemps current removeKey: #McpProgress otherwise: nil.
  SessionTemps current at: #McpFrontEndSession put: System session.
  McpServer progressCallId: 'call-outer'.
  outer := SessionTemps current at: #McpProgress otherwise: nil.
  self assert: outer notNil.
  "a nested request, exactly as a test running inside a tool would make it"
  srv := McpServer new.
  srv handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"ping"}' lifetimeBounds: nil.
  self assert: (SessionTemps current at: #McpProgress otherwise: nil) == outer.
  "and with no reporter to begin with, a nested call still leaves none behind"
  SessionTemps current removeKey: #McpProgress otherwise: nil.
  srv handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"ping"}' lifetimeBounds: nil.
  self assert: (SessionTemps current at: #McpProgress otherwise: nil) isNil
%
category: 'tests - front end'
method: McpProgressTest
testAnUnknownCallIdIsDroppedSilently
  "The normal end of every reported call: a tick already in flight when the call returned. The
   channel map is the authority on what is still live, and a tick for a call that has gone is not
   worth a log line -- it would be one per finished call."
  | r |
  r := McpFixtureRouter new.
  System sendSignal: 1 to: System session
    withMessage: '{"c":"call-999","p":1,"t":10,"m":"orphan"}'.
  r drainWorkerSignals.
  self assert: (r loggedLines
    detect: [:l | (l findString: 'progress' startingAt: 1) > 0] ifNone: [nil]) isNil
%
category: 'tests - front end'
method: McpProgressTest
testAnUnparseablePayloadIsDroppedAndLogged
  "A worker that builds a payload wrong is a defect and should be visible; a worker signalling
   something that is not a tick at all is not this server's business. Both are drops, neither raises
   -- the poller serves every session, so one bad payload must not stop the rest being delivered."
  | r |
  r := McpFixtureRouter new.
  System sendSignal: 1 to: System session withMessage: 'this is not json'.
  r drainWorkerSignals.
  self assert: (r loggedLines
    detect: [:l | (l findString: 'unparseable progress payload' startingAt: 1) > 0]
    ifNone: [nil]) notNil
%
category: 'tests - front end'
method: McpProgressTest
testASignalBecomesANotificationOnItsOwnChannel
  "The front-end half end to end: a payload naming a live call is turned into a
   notifications/progress addressed by THAT call's client token and queued on THAT call's channel."
  | r sess ch queued |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  ch := r registerChannelForToken: 77 session: sess.
  System sendSignal: 1 to: System session
    withMessage: '{"c":"' , ch callId , '","p":1400,"t":5372,"m":"1400/5372 tests"}'.
  r drainWorkerSignals.
  self assert: ch size equals: 1.
  queued := ch drain first.
  self assert: (queued findString: '"method":"notifications/progress"' startingAt: 1) > 0.
  self assert: (queued findString: '"progressToken":77' startingAt: 1) > 0.
  self assert: (queued findString: '"progress":1400' startingAt: 1) > 0.
  self assert: (queued findString: '"total":5372' startingAt: 1) > 0.
  self assert: (queued findString: '1400/5372 tests' startingAt: 1) > 0.
  "the callId is the front end's own name for the call and is not sent to the client"
  self assert: (queued findString: 'call-' startingAt: 1) = 0
%
category: 'tests - front end'
method: McpProgressTest
testATickSentAsTheCallReturnsIsNotLost
  "The last step is the one that says the work is finished, and it was the one systematically thrown
   away. A worker sends its final tick and returns in the same breath, so that tick is still in the
   Stone's queue when the call's ensure: unregisters the channel; the poller, up to a tenth of a
   second later, then had nowhere to put it. Measured against a real client: nine test classes, eight
   frames, every time.
   So a streamed call drains once itself before letting the channel go. Simulated here by signalling
   AFTER the worker would have returned and draining in the same order the router does."
  | r sess ch |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  ch := r registerChannelForToken: 9 session: sess.
  "the worker's parting tick, still queued in the Stone"
  System sendSignal: 1 to: System session
    withMessage: '{"c":"' , ch callId , '","p":9,"t":9,"m":"9/9 test classes"}'.
  "what the call now does on its way out, in order"
  r drainWorkerSignals.
  self assert: ch size equals: 1.
  self assert: ((ch drain first) findString: '9/9 test classes' startingAt: 1) > 0.
  r forgetChannel: ch
%
category: 'tests - reporter'
method: McpProgressTest
testAToolWithNoReporterReportsNothingAndCarriesOn
  "The state every tool is in unless a client asked to be told: #progress:of:message: answers false
   and does nothing at all. This is what lets a tool report unconditionally, and what makes a tool
   called from topaz behave exactly as it always did."
  | toolset |
  SessionTemps current removeKey: #McpProgress otherwise: nil.
  toolset := McpTestingToolset on: McpServer new.
  self deny: (toolset progress: 1 of: 10 message: 'nobody is listening').
  self assert: self drainSignals isEmpty
%
category: 'tests - front end'
method: McpProgressTest
testCallIdsAreTheirOwnNamespace
  "So a callId can never be mistaken for a session id, a server-originated request id, or the
   client's progressToken."
  | r |
  r := McpFixtureRouter new.
  self assert: ((r nextCallId findString: 'call-' startingAt: 1) = 1).
  self deny: r nextCallId equals: r nextCallId
%
category: 'tests - channel'
method: McpProgressTest
testChannelDrainIsFifoAndClears
  | ch drained |
  ch := McpProgressChannel callId: 'call-1' progressToken: 9 sessionId: 'S'.
  ch add: 'one'; add: 'two'.
  drained := ch drain.
  self assert: drained asArray equals: #('one' 'two').
  self assert: ch isEmpty
%
category: 'tests - channel'
method: McpProgressTest
testChannelKeepsTheClientsTokenAndNotTheCallId
  "The split the whole design rests on: the worker knows only the callId, and the token the client
   asked to be addressed by lives here, on the front-end side of the process boundary."
  | ch |
  ch := McpProgressChannel callId: 'call-7' progressToken: 77 sessionId: 'S'.
  self assert: ch callId equals: 'call-7'.
  self assert: ch progressToken equals: 77.
  self assert: ch sessionId equals: 'S'
%
category: 'tests - channel'
method: McpProgressTest
testChannelOverflowDropsOldestAndCountsIt
  "A client that has stopped reading must not grow a channel without bound, and for a long-running
   operation it is the NEWEST state that is worth keeping."
  | ch |
  ch := McpProgressChannel callId: 'call-1' progressToken: 9 sessionId: 'S'.
  1 to: ch maxQueueSize + 3 do: [:i | ch add: 'tick-' , i printString].
  self assert: ch size equals: ch maxQueueSize.
  self assert: ch droppedCount equals: 3.
  "the oldest went, so the first survivor is the fourth thing queued"
  self assert: ch drain first equals: 'tick-4'.
  "and the gap is reported once, then forgotten"
  self assert: ch takeDroppedCount equals: 3.
  self assert: ch takeDroppedCount equals: 0
%
category: 'tests - channel'
method: McpProgressTest
testChannelRefusesProgressThatDoesNotIncrease
  "Both revisions require progress to increase STRICTLY. Enforced here as well as at the source,
   because the source runs arbitrary tool code and this is the end that owes the client a conforming
   stream."
  | ch |
  ch := McpProgressChannel callId: 'call-1' progressToken: 9 sessionId: 'S'.
  self assert: (ch noteProgress: 5).
  self deny: (ch noteProgress: 5).
  self deny: (ch noteProgress: 4).
  self assert: (ch noteProgress: 6).
  "a payload with no progress in it is malformed, not zero"
  self deny: (ch noteProgress: nil).
  self deny: (ch noteProgress: 'seven')
%
category: 'tests - reporter'
method: McpProgressTest
testReporterCannotFailATool
  "A progress tick is a courtesy; the tool's answer is not. The Stone's signal buffer holds 50 and
   raises SignalBufferFull (error 2254) in the SENDER on the 51st -- an expected outcome here, not a
   defect -- and it must never reach the tool that was only reporting on its work.
   This is also the test that documents the buffer depth, which is why the reporter rate-limits and
   why the router's poller runs ten times a second."
  | rep filled |
  rep := self reporter.
  filled := 0.
  1 to: 70 do: [:i |
    "step the clock past the rate limit each time by using a fresh reporter -- the point here is the
     SEND failing, not the interval"
    ((McpProgressReporter frontEndSession: System session callId: 'call-1')
      progress: i of: 70 message: 'x') ifTrue: [filled := filled + 1]].
  "some sends succeeded and the rest were refused by the Stone, and nothing raised"
  self assert: filled > 0.
  self assert: filled < 70.
  self assert: self drainSignals size equals: filled
%
category: 'tests - reporter'
method: McpProgressTest
testReporterRateLimitsAndCountsWhatItDropped
  "250ms between ticks that actually go. A tool reporting per test over a large suite would fill the
   Stone's 50-message buffer in the first second otherwise."
  | rep |
  rep := self reporter.
  self assert: (rep progress: 1 of: 100 message: 'first').
  "immediately after, so inside the interval"
  self deny: (rep progress: 2 of: 100 message: 'too soon').
  self deny: (rep progress: 3 of: 100 message: 'also too soon').
  self assert: rep sent equals: 1.
  self assert: rep suppressed equals: 2.
  self assert: self drainSignals size equals: 1
%
category: 'tests - reporter'
method: McpProgressTest
testReporterRefusesProgressThatDoesNotIncrease
  | rep |
  rep := self reporter.
  self assert: (rep progress: 5 of: 10 message: 'five').
  self deny: (rep progress: 5 of: 10 message: 'again').
  self deny: (rep progress: 4 of: 10 message: 'backwards').
  self deny: (rep progress: 'six' of: 10 message: 'not a number').
  self assert: rep sent equals: 1
%
category: 'tests - reporter'
method: McpProgressTest
testReporterSendsACompactPayloadTheRouterCanRead
  "One-letter keys and JSON, both for the 1023-byte cap: JSON so a free-form message needs no
   hand-rolled quoting, short keys so the room goes to the message. The router is what turns this
   into the JSON-RPC notification, which is how the client's token stays out of this gem."
  | rep payload |
  rep := self reporter.
  self assert: (rep progress: 12 of: 40 message: 'it''s going').
  payload := self drainSignals first.
  self assert: (payload findString: '"c":"call-1"' startingAt: 1) > 0.
  self assert: (payload findString: '"p":12' startingAt: 1) > 0.
  self assert: (payload findString: '"t":40' startingAt: 1) > 0.
  "an apostrophe in the message survives, which is the reason the payload is JSON"
  self assert: (payload findString: 'it''s going' startingAt: 1) > 0
%
category: 'tests - reporter'
method: McpProgressTest
testReporterTruncatesALongMessage
  "A payload over the 1023-byte cap is a tick that never arrives, so a long label is cut rather than
   risked. Cosmetic loss; the numbers are what matter."
  | rep payload long |
  rep := self reporter.
  "Built with a stream rather than String new:withAll:, which is absent from at least one extent this
   server is meant to load into -- see the cross-version note in McpToolset."
  long := WriteStream on: String new.
  5000 timesRepeat: [long nextPut: $x].
  self assert: (rep progress: 1 of: 2 message: long contents).
  payload := self drainSignals first.
  self assert: payload size < 1023.
  self assert: (payload findString: '"p":1' startingAt: 1) > 0
%
category: 'tests - reporter'
method: McpProgressTest
testReporterWithoutADenominatorOmitsTheTotal
  "For work whose total is genuinely unknown. Better than a made-up one, which the client renders as
   a fraction."
  | rep payload |
  rep := self reporter.
  self assert: (rep progress: 3 message: 'transpiling').
  payload := self drainSignals first.
  self assert: (payload findString: '"p":3' startingAt: 1) > 0.
  self assert: (payload findString: '"t"' startingAt: 1) = 0
%
category: 'tests - front end'
method: McpProgressTest
testTotalAndMessageAreOmittedWhenTheToolGaveNone
  "A client renders a fraction from `total`, so a null would be worse than its absence."
  | r ch queued |
  r := McpFixtureRouter new.
  ch := McpProgressChannel callId: 'call-1' progressToken: 4 sessionId: 'S'.
  queued := r progressNotificationFor: ch
    from: (Dictionary new at: 'c' put: 'call-1'; at: 'p' put: 3; yourself).
  self assert: (queued findString: '"progress":3' startingAt: 1) > 0.
  self assert: (queued findString: 'total' startingAt: 1) = 0.
  self assert: (queued findString: 'message' startingAt: 1) = 0
%
