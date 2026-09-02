set compile_env: 0
! ------------------- Class definition for McpBlindWriteTest
expectvalue /Class
doit
GsTestCase subclass: 'McpBlindWriteTest'
  instVarNames: #( sharedServer)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpBlindWriteTest comment: 
'The blind-write guardrail: a mutating tool may not touch something this session has not read since
its view last moved. See docs/blind-write-guardrail.md, which this suite is the executable half of.

WHAT IT IS PROTECTING AGAINST. A client reads a method, its view moves, and it then writes that
method from what it read BEFORE the move -- silently discarding whatever the move brought into view.
The stone cannot catch it: its check is write-write against the view, so once the view has moved past
another session''s commit there is genuinely nothing left to conflict with. Every Smalltalk browser
ever written made this impossible by construction, because rendering a method precedes typing into
it; an agent is the first client that can write a method it never displayed.

HOW THESE TESTS ARE BUILT. Each drives the real tool handlers through toolsets belonging to ONE
McpServer, exactly as a worker gem does -- the ledgers live on the server, so a read through
browsingTools is what licenses a write through mutationTools. A test that needs another session to
have committed something uses a real GsTsExternalSession, because a conflict cannot be faked: the
whole question is what the stone does.

The transition tests drive McpServer''s ledger protocol directly rather than through commit/abort,
because what they are pinning is the RULE -- what survives a view move and why -- and driving it
directly says so in one line instead of staging a transaction to imply it.'
%
expectvalue /Class
doit
McpBlindWriteTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpBlindWriteTest
removeallmethods McpBlindWriteTest
removeallclassmethods McpBlindWriteTest
! ------------------- Class methods for McpBlindWriteTest
! ------------------- Instance methods for McpBlindWriteTest
category: 'helpers'
method: McpBlindWriteTest
assertBlindWrite: aBlock about: aSubjectString
  "Require aBlock to be refused as a blind write, and to say what it was refused about. Checks the
   KIND rather than the message text, so the wording can be improved without breaking the suite --
   but does check the subject appears, because a refusal that does not name what to read is not
   actionable."
  | raised |
  raised := false.
  [aBlock value] on: McpError do: [:ex | | text |
    raised := true.
    text := ex messageText ifNil: [[ex description] on: Error do: [:e | '']].
    self assert: ex kind equals: #blindWrite.
    self assert: (self includes: aSubjectString in: text)
      description: 'the refusal did not name ' , aSubjectString , ': ' , text printString].
  self assert: raised description: 'expected a blindWrite refusal, but the call was allowed'
%
category: 'helpers'
method: McpBlindWriteTest
browsingTools
  ^self toolsetOfClass: McpBrowsingToolset
%
category: 'helpers'
method: McpBlindWriteTest
fixtureClass
  "A throwaway class with two instance-side methods, one class-side method and a comment, committed
   so another session can see it. tearDown removes it."
  | c |
  c := Object subclass: 'McpBwFixture'
    instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #()
    inDictionary: UserGlobals options: #().
  c comment: 'Throwaway fixture created by McpBlindWriteTest. Safe to remove.'.
  c compileMethod: 'alpha ^1' dictionaries: System myUserProfile symbolList category: 'probe'.
  c compileMethod: 'beta ^2' dictionaries: System myUserProfile symbolList category: 'probe'.
  c class compileMethod: 'gamma ^3' dictionaries: System myUserProfile symbolList category: 'probe'.
  System commitTransaction.
  ^c
%
category: 'helpers'
method: McpBlindWriteTest
includes: aSubstring in: aString
  ^aString notNil and: [(aString indexOfSubCollection: aSubstring) > 0]
%
category: 'helpers'
method: McpBlindWriteTest
mutationTools
  ^self toolsetOfClass: McpMutationToolset
%
category: 'helpers'
method: McpBlindWriteTest
readMethod: aSelectorString
  ^self browsingTools tool_get_method_source:
    (Dictionary new at: 'className' put: 'McpBwFixture'; at: 'selector' put: aSelectorString; yourself)
%
category: 'helpers'
method: McpBlindWriteTest
server
  "ONE server for the whole test, as a worker gem has one -- the ledgers live on it, so this is what
   makes a read through one toolset license a write through another."
  sharedServer isNil ifTrue: [sharedServer := McpServer new].
  ^sharedServer
%
category: 'running'
method: McpBlindWriteTest
tearDown
  | up |
  System abortTransaction.
  up := System myUserProfile.
  (up objectNamed: #McpBwFixture) ifNotNil: [:cls |
    (up dictionaryAndSymbolOf: cls) ifNotNil: [:arr | (arr at: 1) removeKey: (arr at: 2) ifAbsent: [nil]]].
  UserGlobals removeKey: #McpBwFixture ifAbsent: [nil].
  System commitTransaction
%
category: 'tests - view moves'
method: McpBlindWriteTest
testAbortClearsBoth
  "An abort takes a new view AND discards the work, so nothing survives it."
  self server noteRead: 'A>>x'; noteWrite: 'A>>y'.
  self server noteAborted.
  self assert: self server readLedger isEmpty.
  self assert: self server writeLedger isEmpty
%
category: 'tests - view moves'
method: McpBlindWriteTest
testAFailedCommitKeepsBoth
  "A failed commit does NOT move the view (measured; docs/blind-write-guardrail.md, V), so every
   read in the window is still current and every pending write is still licensed. The transaction
   is doomed and must be aborted, but that is a different fact from whether the reads are stale."
  self server noteRead: 'A>>x'; noteWrite: 'A>>y'.
  self server noteCommitFailed.
  self assert: (self server readLedger includes: 'A>>x').
  self assert: (self server writeLedger includes: 'A>>y')
%
category: 'tests - view moves'
method: McpBlindWriteTest
testARefreshThatFailsClearsBoth
  "A continueTransaction answering false moved the view anyway and left the writes doomed. Nothing
   is licensed any more, which is also what keeps writeLedger subseteq readLedger unconditional."
  self server noteRead: 'A>>x'; noteWrite: 'A>>y'.
  self server noteRefreshed: false.
  self assert: self server readLedger isEmpty.
  self assert: self server writeLedger isEmpty
%
category: 'tests - view moves'
method: McpBlindWriteTest
testASuccessfulCommitKeepsWhatItValidated
  "A successful commit proves the write set was unconflicted, and that is ALL it proves: what was
   written survives, and an unrelated read does not."
  self server noteRead: 'Unrelated>>x'; noteWrite: 'A>>y'.
  self server noteCommitted.
  self assert: (self server readLedger includes: 'A>>y').
  self deny: (self server readLedger includes: 'Unrelated>>x').
  self assert: self server writeLedger isEmpty
%
category: 'tests - view moves'
method: McpBlindWriteTest
testASuccessfulRefreshKeepsTheWritesPending
  "Same proof as a commit, and so the same read transition -- but the writes are still uncommitted,
   so they stay in the write ledger."
  self server noteRead: 'Unrelated>>x'; noteWrite: 'A>>y'.
  self server noteRefreshed: true.
  self assert: (self server readLedger includes: 'A>>y').
  self deny: (self server readLedger includes: 'Unrelated>>x').
  self assert: (self server writeLedger includes: 'A>>y')
%
category: 'tests - class grain'
method: McpBlindWriteTest
testClassDefinitionDoesNotLicenseTheComment
  "get_class_definition answers the subclass: message, which carries no comment -- so it must not
   license replacing one. This is why the class grain is split into shape and comment."
  self fixtureClass.
  self browsingTools tool_get_class_definition:
    (Dictionary new at: 'className' put: 'McpBwFixture'; yourself).
  self assertBlindWrite: [
    self mutationTools tool_set_class_comment:
      (Dictionary new at: 'className' put: 'McpBwFixture'; at: 'comment' put: 'new'; yourself)]
    about: 'class comment'
%
category: 'tests - method grain'
method: McpBlindWriteTest
testCompilingAnUnreadMethodIsRefused
  "The whole point of the guardrail, in its smallest form."
  self fixtureClass.
  self assertBlindWrite: [self writeMethod: 'alpha' body: '^99'] about: 'McpBwFixture>>alpha'
%
category: 'tests - method grain'
method: McpBlindWriteTest
testCreatingANewMethodNeedsNoRead
  "Creation is never blind: a selector the class does not implement has no source to discard. A
   concurrent creation by another session is still caught, by the stone's write-write check."
  self fixtureClass.
  self assert: (self includes: 'Compiled' in: (self writeMethod: 'brandNew' body: '^0'))
%
category: 'tests - class grain'
method: McpBlindWriteTest
testDeletingAClassNeedsTheWholeClass
  "delete_class discards every method, including ones never named, so seeing the definition is not
   nearly enough -- the licence is the whole class."
  self fixtureClass.
  self browsingTools tool_describe_class:
    (Dictionary new at: 'className' put: 'McpBwFixture'; yourself).
  self assertBlindWrite: [
    self mutationTools tool_delete_class:
      (Dictionary new at: 'className' put: 'McpBwFixture'; yourself)]
    about: 'McpBwFixture>>alpha'
%
category: 'tests - method grain'
method: McpBlindWriteTest
testDeletingAnUnreadMethodIsRefused
  self fixtureClass.
  self assertBlindWrite: [
    self mutationTools tool_delete_method:
      (Dictionary new at: 'className' put: 'McpBwFixture'; at: 'selector' put: 'alpha'; yourself)]
    about: 'McpBwFixture>>alpha'
%
category: 'tests - class grain'
method: McpBlindWriteTest
testDescribeClassLicensesTheComment
  "describe_class shows the comment, so it is the cheap read that licenses replacing it."
  self fixtureClass.
  self browsingTools tool_describe_class:
    (Dictionary new at: 'className' put: 'McpBwFixture'; yourself).
  self assert: (self includes: 'Comment set' in:
    (self mutationTools tool_set_class_comment:
      (Dictionary new at: 'className' put: 'McpBwFixture'; at: 'comment' put: 'new'; yourself)))
%
category: 'tests - class grain'
method: McpBlindWriteTest
testDescribeClassShowsTheComment
  "The licence above is only honest if the answer really carries the comment."
  self fixtureClass.
  self assert: (self includes: 'Throwaway fixture' in:
    (self browsingTools tool_describe_class:
      (Dictionary new at: 'className' put: 'McpBwFixture'; yourself)))
%
category: 'tests - class grain'
method: McpBlindWriteTest
testExportLicensesDeletingTheClass
  self fixtureClass.
  self browsingTools tool_export_class_source:
    (Dictionary new at: 'className' put: 'McpBwFixture'; yourself).
  self assert: (self includes: 'Deleted class' in:
    (self mutationTools tool_delete_class:
      (Dictionary new at: 'className' put: 'McpBwFixture'; yourself)))
%
category: 'tests - class grain'
method: McpBlindWriteTest
testExportLicensesEveryMethod
  "A file-out shows every method's source, so it licenses a per-method write to any of them."
  self fixtureClass.
  self browsingTools tool_export_class_source:
    (Dictionary new at: 'className' put: 'McpBwFixture'; yourself).
  self assert: (self includes: 'Compiled' in: (self writeMethod: 'beta' body: '^99'))
%
category: 'tests - method grain'
method: McpBlindWriteTest
testReadingLicensesTheWrite
  self fixtureClass.
  self readMethod: 'alpha'.
  self assert: (self includes: 'Compiled' in: (self writeMethod: 'alpha' body: '^99'))
%
category: 'tests - method grain'
method: McpBlindWriteTest
testReadingOneMethodDoesNotLicenseAnother
  "Method grain means method grain: seeing alpha says nothing about beta."
  self fixtureClass.
  self readMethod: 'alpha'.
  self assertBlindWrite: [self writeMethod: 'beta' body: '^99'] about: 'McpBwFixture>>beta'
%
category: 'tests - method grain'
method: McpBlindWriteTest
testTheTwoSidesAreSeparate
  "An instance-side read must not license a class-side write. The two live in different method
   dictionaries and the stone validates them separately, so the ledger keys them separately too."
  self fixtureClass.
  self readMethod: 'alpha'.
  self assertBlindWrite: [
    self mutationTools tool_compile_method:
      (Dictionary new
        at: 'className' put: 'McpBwFixture';
        at: 'source' put: 'gamma ^99';
        at: 'meta' put: true;
        yourself)]
    about: 'McpBwFixture class>>gamma'
%
category: 'tests - widening'
method: McpBlindWriteTest
testTheWideningDoesNotCrossSides
  "Instance and class side have separate method dictionaries, so validating one proves nothing
   about the other."
  self server noteRead: 'A class>>other'; noteWrite: 'A>>y'.
  self server noteCommitted.
  self deny: (self server readLedger includes: 'A class>>other')
%
category: 'tests - widening'
method: McpBlindWriteTest
testTheWideningDoesNotReachShapeOrComment
  "A class's shape and comment live in different objects from its method dictionary, so validating
   the dictionary says nothing about them."
  self server noteRead: 'A:shape'; noteRead: 'A:comment'; noteWrite: 'A>>y'.
  self server noteCommitted.
  self deny: (self server readLedger includes: 'A:shape').
  self deny: (self server readLedger includes: 'A:comment')
%
category: 'tests - widening'
method: McpBlindWriteTest
testTheWideningKeepsUnwrittenMethodsOfAWrittenClass
  "The stone validates at the grain of a method dictionary -- one per class per side -- so a
   successful commit proves an UNWRITTEN method of a class this session did write is also unchanged.
   That is what lets a client read several methods of a class, change one, commit, and then change
   another without re-reading."
  self server noteRead: 'A>>x'; noteWrite: 'A>>y'.
  self server noteCommitted.
  self assert: (self server readLedger includes: 'A>>x')
%
category: 'tests - widening'
method: McpBlindWriteTest
testTheWideningSurvivesIntoARealWrite
  "The widening through the real tools, not just the ledger protocol: read two methods, change one,
   commit, and the other is still licensed."
  self fixtureClass.
  self readMethod: 'alpha'.
  self readMethod: 'beta'.
  self writeMethod: 'alpha' body: '^99'.
  self server noteCommitted.
  self assert: (self includes: 'Compiled' in: (self writeMethod: 'beta' body: '^98'))
%
category: 'tests - method grain'
method: McpBlindWriteTest
testWritingImpliesReading
  "Having just written something is knowing its content, so a second change needs no re-read."
  self fixtureClass.
  self readMethod: 'alpha'.
  self writeMethod: 'alpha' body: '^99'.
  self assert: (self includes: 'Compiled' in: (self writeMethod: 'alpha' body: '^100'))
%
category: 'helpers'
method: McpBlindWriteTest
toolsetOfClass: aToolsetClass
  ^self server toolsets detect: [:ts | ts class == aToolsetClass]
%
category: 'helpers'
method: McpBlindWriteTest
writeMethod: aSelectorString body: aBodyString
  ^self mutationTools tool_compile_method:
    (Dictionary new
      at: 'className' put: 'McpBwFixture';
      at: 'source' put: aSelectorString , ' ' , aBodyString;
      at: 'category' put: 'probe';
      yourself)
%
