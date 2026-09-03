set compile_env: 0
! ------------------- Class definition for McpProgressReporter
expectvalue /Class
doit
Object subclass: 'McpProgressReporter'
  instVarNames: #( frontEndSession callId lastProgress
                    lastSentMs suppressed sent)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpProgressReporter comment: 
'The worker-gem end of progress reporting: what a tool sends a progress tick to, for the length of
one call.

A worker gem is a separate OS process, and the client''s socket was accepted by the FRONT END''s
process -- a file descriptor means nothing outside the process that owns it, and GemStone exposes no
way to pass one. So a tool cannot write to its own client. What it can do is ring a doorbell the
front end is listening at: System sendSignal:to:withMessage:, whose queue the router drains
(McpRouter>>drainWorkerSignals). This class is that doorbell, with the three pieces of judgement a
tool should not have to carry.

RATE LIMIT. #minIntervalMilliseconds between ticks. Both revisions ask both parties to rate-limit,
and the Stone-side queue holds only 50 messages for a session and raises SignalBufferFull on the
51st -- shared across every worker signalling one router. A per-test tick from a 5372-test suite
would blow through that in the first second, so the limit is not politeness, it is what keeps the
channel working.

STRICTLY INCREASING. The spec requires it, and a tool that reports a count it recomputed can easily
repeat one. Refused here and again at the channel (McpProgressChannel>>noteProgress:), because this
end can be wrong -- it runs arbitrary tool code -- and that end is the one that owes the client a
conforming stream.

UNFAILABLE. Every send is wrapped, and SignalBufferFull is an EXPECTED outcome rather than a defect:
the buffer being full means the front end has not drained yet, and the right response is to drop this
tick. A progress notification that failed a five-minute test run would make this server strictly
worse than one that said nothing at all, so nothing here may raise into a tool.

Installed in SessionTemps for the duration of one call and cleared on the way out
(McpServer>>handleJsonString:); tools reach it through McpToolset>>progress:of:message:, which does
nothing at all when there is none -- so a tool called from topaz, or by a client that asked for no
progress, behaves exactly as it always did.'
%
expectvalue /Class
doit
McpProgressReporter category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpProgressReporter
removeallmethods McpProgressReporter
removeallclassmethods McpProgressReporter
! ------------------- Class methods for McpProgressReporter
category: 'instance creation'
classmethod: McpProgressReporter
frontEndSession: aSessionId callId: aCallId
  "A reporter that signals the front-end gem aSessionId about the call aCallId.
   aSessionId is the value System session answers IN THE ROUTER'S GEM, pushed down at session open.
   It is deliberately not the worker's cached stoneSessionId, which is a different number in a
   different namespace -- sendSignal:to: and a polled signal's sendingSession both speak the
   System session one."
  ^self new setFrontEndSession: aSessionId callId: aCallId
%
category: 'instance creation'
classmethod: McpProgressReporter
new
  ^super new initialize
%
! ------------------- Instance methods for McpProgressReporter
category: 'accessing'
method: McpProgressReporter
callId
  ^callId
%
category: 'initialization'
method: McpProgressReporter
initialize
  suppressed := 0.
  sent := 0.
  ^self
%
category: 'accessing'
method: McpProgressReporter
maxMessageSize
  "How much of a tick's message text is sent. System sendSignal:to:withMessage: caps the whole
   message at 1023 bytes, and the rest of the payload is small and bounded, so this leaves a wide
   margin rather than computing one exactly -- a truncated label is a cosmetic loss, and a payload
   over the cap is a tick that never arrives."
  ^700
%
category: 'accessing'
method: McpProgressReporter
minIntervalMilliseconds
  "How long between ticks that are actually sent. 250ms: fast enough that a client sees a job moving
   and slow enough to stay well inside the Stone's 50-message signal buffer, which is shared by every
   worker signalling this front end. A tool reporting per test over a 5372-test suite would otherwise
   fill it in the first second."
  ^250
%
category: 'private'
method: McpProgressReporter
nowMilliseconds
  "A millisecond clock for measuring the interval between ticks.
   System millisecondsSinceLogin, NOT millisecondClockValue -- that one is a Squeak/Pharo selector
   and GemStone's System class does not implement it, which is the kind of mistake that hides here
   perfectly: every send in this class is wrapped, so a DNU became a tick that silently never went.
   Since-login is enough because a reporter lives for one call inside one gem, so the value only ever
   has to be monotonic relative to itself.
   The fallback keeps this working on an image whose System lacks it -- second granularity, which
   makes the rate limit coarser and nothing else -- because this server aims to run on as many
   GemStone versions as will have it."
  ^[System millisecondsSinceLogin]
    on: Error
    do: [:ex | ex return: System timeGmt * 1000]
%
category: 'reporting'
method: McpProgressReporter
progress: aNumber message: aStringOrNil
  "Report progress with no denominator. For work whose total is genuinely unknown -- a transpile with
   no countable unit -- where inventing a total would be worse than omitting one, since the client
   renders a fraction from it."
  ^self progress: aNumber of: nil message: aStringOrNil
%
category: 'reporting'
method: McpProgressReporter
progress: aNumber of: aTotalOrNil message: aStringOrNil
  "Send one progress tick, or drop it. Answers whether it went.
   CANNOT RAISE, whatever happens: see the class comment. A tool is reporting on its work, not
   depending on the report."
  ^[self sendProgress: aNumber of: aTotalOrNil message: aStringOrNil]
    on: Error
    do: [:ex |
      suppressed := suppressed + 1.
      ex return: false]
%
category: 'private'
method: McpProgressReporter
sendProgress: aNumber of: aTotalOrNil message: aStringOrNil
  "The guarded body of #progress:of:message:. Rate-limits, refuses a non-increasing value, builds the
   compact payload and rings the doorbell.
   The payload is JSON with one-letter keys, and both choices are for the 1023-byte cap: JSON so a
   free-form message needs no hand-rolled quoting, one-letter keys so the room goes to the message
   rather than to field names. The FRONT END turns this into the JSON-RPC notification, which is what
   keeps the client's progressToken out of this gem entirely."
  | now d |
  (aNumber isKindOf: Number) ifFalse: [^false].
  (lastProgress notNil and: [aNumber <= lastProgress]) ifTrue: [^false].
  now := self nowMilliseconds.
  (lastSentMs notNil and: [(now - lastSentMs) abs < self minIntervalMilliseconds]) ifTrue: [
    suppressed := suppressed + 1.
    ^false].
  d := Dictionary new.
  d at: 'c' put: callId.
  d at: 'p' put: aNumber.
  aTotalOrNil ifNotNil: [:t | d at: 't' put: t].
  aStringOrNil ifNotNil: [:m |
    d at: 'm' put: (m size > self maxMessageSize
      ifTrue: [m copyFrom: 1 to: self maxMessageSize]
      ifFalse: [m])].
  System sendSignal: 1 to: frontEndSession withMessage: d asJson.
  lastProgress := aNumber.
  lastSentMs := now.
  sent := sent + 1.
  ^true
%
category: 'accessing'
method: McpProgressReporter
sent
  "How many ticks actually went out. Read by the tests; a tool has no reason to care."
  ^sent
%
category: 'initialization'
method: McpProgressReporter
setFrontEndSession: aSessionId callId: aCallId
  frontEndSession := aSessionId.
  callId := aCallId.
  ^self
%
category: 'accessing'
method: McpProgressReporter
suppressed
  "How many ticks were dropped -- by the rate limit, by the monotonic rule, or by a failed send.
   Not reported to the client: progress is best-effort by design, and a client told 'you missed 40
   ticks' can do nothing with that. It is here because a tool that reports nothing and a tool whose
   every tick was refused look identical from outside, and only one of them is a bug."
  ^suppressed
%
