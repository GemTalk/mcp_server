set compile_env: 0
! ------------------- Class definition for McpWorkerDeadlineTest
expectvalue /Class
doit
GsTestCase subclass: 'McpWorkerDeadlineTest'
  instVarNames: #( session)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpWorkerDeadlineTest comment: 
'Checks the request deadline against a REAL worker gem: that a call which outruns it is actually
ended, and that the gem is usable again afterwards.

McpSessionTest covers the same policy against a mock, which is where the decisions are asserted --
how many breaks, in what order, what the client is told. What a mock cannot answer is the question
the whole design rests on: does GciTsBreak really stop a running call in THIS image, and is the
session really still usable when it does? Everything else follows from that. If a break did not
land, the deadline would be a promise the server could not keep -- it would answer the client while
the gem went on running -- and if a broken session were unusable, ending one call would silently
cost the client every later one.

So each test here drives a real McpSession over a real worker gem, through the shipping
#runWorker:. That means A NETLDI MUST BE RUNNING; run-unit-tests.sh insists on one wherever this
suite is installed, and on this branch it is the only base-install suite that needs one. Tests take a second or two each, because a
deadline measured in whole seconds cannot be exercised in less.

The two shapes of a runaway are both here, and they fail differently if a break is not delivered: a
Smalltalk loop that never ends (broken between sends) and a call blocked in a #wait (broken in the
wait). Both were verified on 3.7.5. The third case is the gem that takes NEITHER break -- code that
handles ControlInterrupt and resumes -- which is the only reason McpSession>>abandonWorker exists;
what is asserted there is deliberately what holds on any version: the client is told, the session
is never left holding a call it would try to reuse, and if the gem had to be stopped it is really
gone from the stone.'
%
expectvalue /Class
doit
McpWorkerDeadlineTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpWorkerDeadlineTest
removeallmethods McpWorkerDeadlineTest
removeallclassmethods McpWorkerDeadlineTest
! ------------------- Class methods for McpWorkerDeadlineTest
! ------------------- Instance methods for McpWorkerDeadlineTest
category: 'helpers'
method: McpWorkerDeadlineTest
freshSessionWithDeadline: aSecondCount
  "A real worker gem, deadlined, and remembered so tearDown gives it back."
  session := McpSession startWithId: 'worker-deadline'.
  session requestTimeoutSeconds: aSecondCount.
  ^session
%
category: 'helpers'
method: McpWorkerDeadlineTest
gemIsGoneFor: aSession
  "Whether the stone has stopped listing aSession's worker gem. Polled rather than read once:
   System stopSession: is a request to the stone, and the row does not disappear in the same
   instant."
  | id ticks |
  id := aSession workerStoneSession.
  id isNil ifTrue: [^true].
  ticks := 50.
  [(System currentSessions includes: id) and: [ticks > 0]] whileTrue: [
    ticks := ticks - 1.
    (Delay forMilliseconds: 100) wait].
  ^(System currentSessions includes: id) not
%
category: 'running'
method: McpWorkerDeadlineTest
setUp
  session := nil
%
category: 'running'
method: McpWorkerDeadlineTest
tearDown
  "Give the gem back. Guarded, because a test that failed partway still has to."
  session ifNotNil: [:s | [s close] on: Error do: [:e | nil]].
  session := nil
%
category: 'tests'
method: McpWorkerDeadlineTest
testABlockedCallIsEndedToo
  "The other shape a hung call takes: not spinning but waiting -- on a lock, on a socket, on a
   Delay. It is the shape a soft break might plausibly NOT reach, since the gem is not executing
   Smalltalk to be interrupted between sends. On 3.7.5 it is reached, and immediately."
  | sess err |
  sess := self freshSessionWithDeadline: 1.
  err := self timeoutRaisedBy: [sess runWorker: '(Delay forSeconds: 300) wait. ''never'''].
  self assert: err notNil.
  self assert: err kind equals: #timeout.
  self deny: sess workerAbandoned.
  self assert: (sess runWorker: '''alive-after-blocked-call''') equals: 'alive-after-blocked-call'
%
category: 'tests'
method: McpWorkerDeadlineTest
testACallThatFinishesInTimeIsUntouched
  "The ordinary case, on the real path: a deadline that is not reached changes nothing about the
   result that comes back."
  | sess |
  sess := self freshSessionWithDeadline: 60.
  self assert: (sess runWorker: '''prompt-result''') equals: 'prompt-result'.
  self deny: sess workerAbandoned.
  self deny: sess isBusy
%
category: 'tests'
method: McpWorkerDeadlineTest
testAGemThatTakesNeitherBreakIsStoppedRatherThanLeftRunning
  "The last resort, against a real gem: worker code that handles ControlInterrupt and resumes takes
   neither break (3.7.5), so the call can only be ended from the stone side.
   What is asserted is what must hold on ANY image, because which break a given version honours is
   the image's business and not this server's: the caller is told, and the session is never left
   holding a call it would try to reuse -- either the break landed and the session is usable, or the
   gem was stopped and the session says so. Where it was stopped, the gem is really gone: a
   still-running gem would hold a transaction view and a session slot for as long as the stone ran."
  | sess err |
  sess := self freshSessionWithDeadline: 1.
  err := self timeoutRaisedBy: [sess runWorker:
    '[[true] whileTrue: [nil]] on: Break do: [:e | e resume]. ''never'''].
  self assert: err notNil.
  self assert: err kind equals: #timeout.
  self deny: sess isBusy.
  sess workerAbandoned
    ifTrue: [self assert: (self gemIsGoneFor: sess)]
    ifFalse: [self assert: (sess runWorker: '''alive-after-break''') equals: 'alive-after-break']
%
category: 'tests'
method: McpWorkerDeadlineTest
testARunawayCallIsEndedAndTheGemIsUsableAgain
  "The claim the whole feature rests on. A Smalltalk loop that will never finish is ended by the
   soft break, the caller is told with a #timeout error rather than left waiting, and the SAME
   worker gem serves the next call -- so a client that hits the deadline loses its request and
   keeps its session, its gem and the uncommitted work in it."
  | sess err |
  sess := self freshSessionWithDeadline: 1.
  err := self timeoutRaisedBy: [sess runWorker: '| i | i := 0. [true] whileTrue: [i := i + 1]. ''never'''].
  self assert: err notNil.
  self assert: err kind equals: #timeout.
  self deny: sess workerAbandoned.
  self deny: sess isBusy.
  self assert: (sess runWorker: '''alive-after-break''') equals: 'alive-after-break'.
  "and the gem is not merely answering -- it is the same gem, with its own state still there"
  self assert: (sess runWorker: 'UserGlobals at: #McpDeadlineProbe put: 7. ''stored''') equals: 'stored'.
  self assert: (sess runWorker: '(UserGlobals at: #McpDeadlineProbe) printString') equals: '7'
%
category: 'helpers'
method: McpWorkerDeadlineTest
timeoutRaisedBy: aBlock
  "Run aBlock and answer the McpError it raised, or nil if it did not raise one. Anything else
   propagates: a test that fails for another reason should say so rather than read as a timeout
   that did not happen."
  ^[aBlock value. nil] on: McpError do: [:ex | ex return: ex]
%
