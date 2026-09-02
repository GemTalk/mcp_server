set compile_env: 0
! ------------------- Class definition for McpConcurrentEditTest
expectvalue /Class
doit
GsTestCase subclass: 'McpConcurrentEditTest'
  instVarNames: #( sharedServer other)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpConcurrentEditTest comment: 
'The blind-write guardrail against a REAL second session. Companion to McpBlindWriteTest, which
pins the rules; this suite pins that the rules still match the database.

WHY BOTH. McpBlindWriteTest drives McpServer''s ledger protocol directly, so it proves the rules are
implemented -- but every one of those rules was derived from something measured about GemStone
(docs/blind-write-guardrail.md), and a suite that never touches the stone cannot notice if the
measurement stops holding. A kernel change that made a failed commit move the view, or made a
refresh stop laundering a stale read, would leave McpBlindWriteTest green and the guardrail wrong.
These tests stage genuine conflicts from a genuine second gem, so they fail if the database changes
under the design.

The letters in the test comments are the measurement rows in the doc''s appendix.

The re-validation tests (2026-09-02) are the same shape: one session reads, the second gem commits
over some of what it read, the first aborts, and what it may then write is exactly what the second
gem left alone. McpBlindWriteTest pins the same rule with the kernel standing in for the other gem;
this suite pins it with the real thing, view move included.

The second gem is REAL rather than mocked because what is under test is the stone''s behaviour, not
this image''s: nothing short of another session committing a conflicting change produces any of
these states, and a mock of them would be testing the mock. So this suite needs a NETLDI, and
run-unit-tests.sh insists on one wherever it is installed.'
%
expectvalue /Class
doit
McpConcurrentEditTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpConcurrentEditTest
removeallmethods McpConcurrentEditTest
removeallclassmethods McpConcurrentEditTest
! ------------------- Class methods for McpConcurrentEditTest
category: 'testing'
classmethod: McpConcurrentEditTest
movesTheSessionView
  "Why this suite cannot run from a session holding uncommitted work. See
   McpTestingToolset class>>sessionViewRefusalFor:, which is what asks.
   Irreducible: staging a conflict means committing a baseline both sessions can see, and clearing
   the jam a conflict leaves means aborting."
  ^'it commits a baseline for a second gem to conflict with, provokes real commit conflicts and refreshes, and aborts to clear them'
%
! ------------------- Instance methods for McpConcurrentEditTest
category: 'helpers'
method: McpConcurrentEditTest
browsingTools
  ^self toolsetOfClass: McpBrowsingToolset
%
category: 'helpers'
method: McpConcurrentEditTest
compileAlpha: aBodyString
  ^self mutationTools tool_compile_method: (Dictionary new
    at: 'className' put: 'McpCeFixture';
    at: 'source' put: 'alpha ' , aBodyString;
    at: 'category' put: 'probe'; yourself)
%
category: 'helpers'
method: McpConcurrentEditTest
compileBeta: aBodyString
  ^self mutationTools tool_compile_method: (Dictionary new
    at: 'className' put: 'McpCeFixture';
    at: 'source' put: 'beta ' , aBodyString;
    at: 'category' put: 'probe'; yourself)
%
category: 'helpers'
method: McpConcurrentEditTest
dispatchTool: aName
  "The text a client would see for a no-argument tool call on THIS server -- the tool's answer plus
   the note the dispatcher appends -- so the tests of that note see it the way a client does."
  | response |
  response := (McpDispatcher withToolRegistry: self server toolRegistry server: self server) handle:
    (Dictionary new
      at: 'jsonrpc' put: '2.0';
      at: 'id' put: 1;
      at: 'method' put: 'tools/call';
      at: 'params' put: (Dictionary new at: 'name' put: aName; at: 'arguments' put: Dictionary new; yourself);
      yourself).
  ^(((response at: 'result') at: 'content') at: 1) at: 'text'
%
category: 'helpers'
method: McpConcurrentEditTest
fixtureClass
  "Two instance-side methods with known bodies, committed so the second gem can see them."
  | c |
  c := Object subclass: 'McpCeFixture'
    instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #()
    inDictionary: UserGlobals options: #().
  c compileMethod: 'alpha ^#baseline' dictionaries: System myUserProfile symbolList category: 'probe'.
  c compileMethod: 'beta ^#baseline' dictionaries: System myUserProfile symbolList category: 'probe'.
  System commitTransaction.
  ^c
%
category: 'helpers'
method: McpConcurrentEditTest
includes: aSubstring in: aString
  ^aString notNil and: [(aString indexOfSubCollection: aSubstring) > 0]
%
category: 'helpers'
method: McpConcurrentEditTest
mutationTools
  ^self toolsetOfClass: McpMutationToolset
%
category: 'helpers'
method: McpConcurrentEditTest
otherSessionCompiles: aSelectorString body: aBodyString
  "Have a genuine second gem replace one of the fixture's methods and COMMIT it, so this session's
   view is now behind. Reuses the one worker for the whole test."
  other isNil ifTrue: [other := McpSession startWithId: 'blind-write-conflict-fixture'].
  ^other runWorker: '(UserGlobals at: #McpCeFixture) compileMethod: ''' , aSelectorString , ' '
    , aBodyString , ''' dictionaries: System myUserProfile symbolList category: ''probe''. '
    , 'System commitTransaction'
%
category: 'helpers'
method: McpConcurrentEditTest
readAlpha
  ^self browsingTools tool_get_method_source:
    (Dictionary new at: 'className' put: 'McpCeFixture'; at: 'selector' put: 'alpha'; yourself)
%
category: 'helpers'
method: McpConcurrentEditTest
readBeta
  ^self browsingTools tool_get_method_source:
    (Dictionary new at: 'className' put: 'McpCeFixture'; at: 'selector' put: 'beta'; yourself)
%
category: 'helpers'
method: McpConcurrentEditTest
refusalFrom: aBlock
  "The McpError aBlock raises, or nil if it did not raise."
  ^[aBlock value. nil] on: McpError do: [:ex | ex]
%
category: 'helpers'
method: McpConcurrentEditTest
server
  sharedServer isNil ifTrue: [sharedServer := McpServer new].
  ^sharedServer
%
category: 'helpers'
method: McpConcurrentEditTest
sessionTools
  ^self toolsetOfClass: McpSessionToolset
%
category: 'running'
method: McpConcurrentEditTest
setUp
  other := nil.
  sharedServer := nil.
  System abortTransaction
%
category: 'running'
method: McpConcurrentEditTest
tearDown
  "Abort FIRST: a test that ended jammed cannot commit until it does, so the cleanup would fail and
   leak the fixture. Then give the worker gem back, guarded, because a test that failed mid-way
   still has to log it out."
  | up |
  System abortTransaction.
  up := System myUserProfile.
  (up objectNamed: #McpCeFixture) ifNotNil: [:cls |
    (up dictionaryAndSymbolOf: cls) ifNotNil: [:arr | (arr at: 1) removeKey: (arr at: 2) ifAbsent: [nil]]].
  UserGlobals removeKey: #McpCeFixture ifAbsent: [nil].
  System commitTransaction.
  other ifNotNil: [:s | [s close] on: Error do: [:e | nil]].
  other := nil
%
category: 'tests'
method: McpConcurrentEditTest
testAFailedCommitLeavesTheViewAndTheLedgersAlone
  "Measurement V: a commit refused on conflict does NOT move the view. So the other session's work
   is still invisible, every read in this window is still current, and both ledgers are kept.
   If this ever fails, McpServer>>noteCommitFailed is unsound and must clear the read ledger."
  self fixtureClass.
  self readAlpha. self readBeta.
  self compileAlpha: '^#mine'.
  self otherSessionCompiles: 'alpha' body: '^#theirs'.
  self otherSessionCompiles: 'beta' body: '^#theirsToo'.
  self assert: (self refusalFrom: [self sessionTools tool_commit: Dictionary new]) notNil.
  self assert: (self includes: 'baseline' in: self readBeta)
    description: 'the failed commit moved the view -- the other session''s beta is now visible'.
  self assert: (self server hasRead: (McpServer methodKeyFor: 'McpCeFixture' selector: 'beta' meta: false))
%
category: 'tests'
method: McpConcurrentEditTest
testAFailedRefreshClearsTheWritesAndReChecksTheReads
  "The state a refresh answering false leaves: the view moved anyway and the pending writes are
   doomed, so no write is licensed any more. The reads are re-checked against the moved view like an
   abort's -- and here BOTH still hold, which is a measurement worth having: a false
   continueTransaction advances the view for everything this session did not write (U), but its own
   uncommitted alpha stays in place, so alpha reads as this session left it and beta as nobody
   touched it. Nothing is stale yet, and nothing can be committed either. The abort that is the only
   way out then brings the other session's alpha into view, and THAT re-check drops it and names it.
   Also pins that the session is visibly stuck in between -- commitConflictPending detects the
   #failure a false refresh leaves, which it did not before."
  | alpha beta |
  self fixtureClass.
  self readAlpha. self readBeta.
  self compileAlpha: '^#mine'.
  self otherSessionCompiles: 'alpha' body: '^#theirs'.
  self refusalFrom: [self sessionTools tool_refresh: Dictionary new].
  alpha := McpServer methodKeyFor: 'McpCeFixture' selector: 'alpha' meta: false.
  beta := McpServer methodKeyFor: 'McpCeFixture' selector: 'beta' meta: false.
  self assert: self server writeLedger isEmpty.
  self assert: (self server hasRead: alpha).
  self assert: (self server hasRead: beta).
  self assert: self server staleReadKeys isEmpty.
  self assert: McpToolset commitConflictPending
    description: 'a session stuck by a false refresh is not being detected'.
  self sessionTools tool_abort: Dictionary new.
  self deny: (self server hasRead: alpha).
  self assert: (self server hasRead: beta).
  self assert: self server staleReadKeys equals: (Array with: alpha)
%
category: 'tests - re-validation'
method: McpConcurrentEditTest
testAnAbortDropsAReadTheOtherSessionOverwrote
  "Read alpha; the other session commits a different alpha; abort. The abort brought their version
   into view, this session has never seen it, and the read that would have licensed writing over it
   is gone: compile_method is refused."
  | err |
  self fixtureClass.
  self readAlpha.
  self otherSessionCompiles: 'alpha' body: '^#theirs'.
  self sessionTools tool_abort: Dictionary new.
  err := self refusalFrom: [self compileAlpha: '^#mine'].
  self assert: err notNil description: 'a write over the other session''s alpha was allowed'.
  self assert: err kind equals: #blindWrite
%
category: 'tests - re-validation'
method: McpConcurrentEditTest
testAnAbortKeepsTheReadsThatStillHold
  "Read alpha and beta; the other session changes only beta; abort. Alpha is exactly what this
   session read and may be written; beta is not and may not; and the ledger says which."
  | err |
  self fixtureClass.
  self readAlpha. self readBeta.
  self otherSessionCompiles: 'beta' body: '^#theirs'.
  self sessionTools tool_abort: Dictionary new.
  self assert: (self includes: 'Compiled' in: (self compileAlpha: '^#mine'))
    description: 'alpha was unchanged by anyone, yet its read was dropped'.
  err := self refusalFrom: [self compileBeta: '^#mine'].
  self assert: err notNil description: 'a write over the other session''s beta was allowed'.
  self assert: err kind equals: #blindWrite.
  self assert: self server staleReadKeys
    equals: (Array with: (McpServer methodKeyFor: 'McpCeFixture' selector: 'beta' meta: false))
%
category: 'tests - re-validation'
method: McpConcurrentEditTest
testAnAbortWithNothingChangedKeepsEveryRead
  "An abort nobody else committed across costs no re-reads: both reads still hold, both writes are
   allowed, nothing is reported stale."
  self fixtureClass.
  self readAlpha. self readBeta.
  self sessionTools tool_abort: Dictionary new.
  self assert: self server staleReadKeys isEmpty.
  self assert: (self includes: 'Compiled' in: (self compileAlpha: '^#mine')).
  self assert: (self includes: 'Compiled' in: (self compileBeta: '^#mine')).
  self deny: (self includes: 'The view moved' in: (self dispatchTool: 'status'))
%
category: 'tests'
method: McpConcurrentEditTest
testARefreshLaundersAStaleReadAndTheGuardrailCatchesIt
  "Measurement N: this session reads alpha, the other session commits over it, and a refresh
   absorbs that change without a word -- after which the stone has nothing left to object to. The
   guardrail is the only thing standing between the client and a silent overwrite, and it refuses,
   because the refresh emptied the read ledger."
  | err |
  self fixtureClass.
  self readAlpha.
  self otherSessionCompiles: 'alpha' body: '^#theirs'.
  self sessionTools tool_refresh: Dictionary new.
  err := self refusalFrom: [self compileAlpha: '^#mine'].
  self assert: err notNil description: 'the guardrail allowed a write on a laundered read'.
  self assert: err kind equals: #blindWrite
%
category: 'tests'
method: McpConcurrentEditTest
testAWriteAlreadyMadeCannotBeLaundered
  "Measurement M, the boundary of the one above: once an object is in this session's WRITE set, a
   refresh cannot absorb the conflict -- continueTransaction itself answers false and the commit is
   still refused. This is why the guardrail only has to cover reads, and why a refresh keeps the
   write ledger while emptying the read ledger."
  | result |
  self fixtureClass.
  self readAlpha.
  self compileAlpha: '^#mine'.
  self otherSessionCompiles: 'alpha' body: '^#theirs'.
  result := McpToolset refreshViewResult.
  self assert: (result at: 2) isNil description: 'the refresh itself errored'.
  self deny: (result at: 1)
    description: 'continueTransaction answered true -- a pending write was laundered'.
  self deny: System commitTransaction
%
category: 'tests - re-validation'
method: McpConcurrentEditTest
testTheStaleNoteArrivesWithTheAbortAndThenStops
  "Seen from the client: the abort's own result names the read the move invalidated, in proportion
   to the reads that survived, and the next result says nothing more about it."
  | abortText next |
  self fixtureClass.
  self readAlpha. self readBeta.
  self otherSessionCompiles: 'alpha' body: '^#theirs'.
  abortText := self dispatchTool: 'abort'.
  self assert: (self includes: 'Transaction aborted' in: abortText).
  self assert: (self includes: '[session] The view moved: 1 of 2 earlier reads is stale' in: abortText)
    description: abortText.
  self assert: (self includes: 'McpCeFixture>>alpha' in: abortText).
  self deny: (self includes: 'McpCeFixture>>beta' in: abortText).
  next := self dispatchTool: 'status'.
  self deny: (self includes: 'The view moved' in: next) description: next
%
category: 'tests'
method: McpConcurrentEditTest
testTheScenarioIsRefusedWhereItUsedToClobber
  "THE CASE THE GUARDRAIL EXISTS FOR, end to end and against a real second session.

   Both sessions edit alpha and beta. This one's commit is correctly refused; it aborts, re-reads
   alpha, adjusts, and commits that. Its view is now PAST the other session's commit, so nothing is
   left to conflict with -- and the next step, applying the beta change it has been carrying since
   before the abort, used to be accepted and silently discard the other session's beta.

   It is now refused: the abort re-checked the read of beta against the view it brought in, found
   the other session's beta there instead, and dropped it -- and beta was never re-read."
  | err |
  self fixtureClass.
  self readAlpha. self readBeta.
  self compileAlpha: '^#mine'. self compileBeta: '^#mine'.
  self otherSessionCompiles: 'alpha' body: '^#theirs'.
  self otherSessionCompiles: 'beta' body: '^#theirs'.
  self assert: (self refusalFrom: [self sessionTools tool_commit: Dictionary new]) notNil
    description: 'the stone should have refused this commit'.
  self sessionTools tool_abort: Dictionary new.
  self readAlpha.
  self compileAlpha: '^#adjusted'.
  self sessionTools tool_commit: Dictionary new.
  err := self refusalFrom: [self compileBeta: '^#mine'].
  self assert: err notNil description: 'the beta change was accepted -- this is the clobber'.
  self assert: err kind equals: #blindWrite
%
category: 'tests'
method: McpConcurrentEditTest
testTheStoneAloneWouldAllowThatClobber
  "The premise the whole design rests on, asserted rather than assumed: in exactly the situation
   above, with the guardrail bypassed, GemStone accepts the commit and the other session's work is
   gone. If this ever starts failing, the stone has grown protection of its own and the guardrail's
   scope should be revisited -- so it is deliberately written to fail LOUDLY on good news."
  self fixtureClass.
  self readAlpha.
  self otherSessionCompiles: 'alpha' body: '^#theirs'.
  System continueTransaction.
  "Straight to the kernel, past every tool and every ledger."
  (System myUserProfile objectNamed: #McpCeFixture)
    compileMethod: 'alpha ^#mine' dictionaries: System myUserProfile symbolList category: 'probe'.
  self assert: System commitTransaction
    description: 'the stone refused -- it now protects a stale read on its own'.
  self assert: (self includes: '#mine' in:
    ((System myUserProfile objectNamed: #McpCeFixture) sourceCodeAt: #alpha))
%
category: 'helpers'
method: McpConcurrentEditTest
toolsetOfClass: aToolsetClass
  ^self server toolsets detect: [:ts | ts class == aToolsetClass]
%
