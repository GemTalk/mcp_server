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
directly says so in one line instead of staging a transaction to imply it.

THE STAMPS. Since 2026-09-02 a read is recorded with a digest of what was read, and EVERY view move
-- abort, commit, refresh either way -- RE-CHECKS each read against the new view instead of deciding
its fate by rule. The tests of that here stand in for the other session with the kernel
itself -- recompiling a fixture method past every tool and ledger, in this gem, uncommitted -- because
the rule under test is ''the content moved'', and where the new content came from is not part of it.
McpConcurrentEditTest stages the same thing with a genuine second gem and a genuine abort.'
%
expectvalue /Class
doit
McpBlindWriteTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpBlindWriteTest
removeallmethods McpBlindWriteTest
removeallclassmethods McpBlindWriteTest
! ------------------- Class methods for McpBlindWriteTest
category: 'testing'
classmethod: McpBlindWriteTest
movesTheSessionView
  "Why this suite cannot run from a session holding uncommitted work. See
   McpTestingToolset class>>sessionViewRefusalFor:, which is what asks.
   Irreducible: the fixture has to be committed for the guardrail's own subject -- what another
   session could have changed -- to mean anything, and tearDown commits its removal."
  ^'it commits a throwaway fixture class, and aborts in tearDown'
%
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
dispatchStatusText
  "The text a client would see for a `status` call on THIS server: the tool's answer plus whatever
   the dispatcher appends (McpDispatcher>>transactionNote)."
  | response |
  response := (McpDispatcher withToolRegistry: self server toolRegistry server: self server) handle:
    (Dictionary new
      at: 'jsonrpc' put: '2.0';
      at: 'id' put: 1;
      at: 'method' put: 'tools/call';
      at: 'params' put: (Dictionary new at: 'name' put: 'status'; at: 'arguments' put: Dictionary new; yourself);
      yourself).
  ^(((response at: 'result') at: 'content') at: 1) at: 'text'
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
recompileInKernel: aSelectorString body: aBodyString
  "Change a fixture method PAST every tool and every ledger, the way another session's commit would
   have: what re-validation sees is only that the content moved. Uncommitted; tearDown aborts it."
  (System myUserProfile objectNamed: #McpBwFixture)
    compileMethod: aSelectorString , ' ' , aBodyString
    dictionaries: System myUserProfile symbolList category: 'probe'
%
category: 'helpers'
method: McpBlindWriteTest
staleNoteForKeys: aCollectionOfKeys
  "The [session] line the dispatcher produces when exactly aCollectionOfKeys have gone stale. The
   keys name classes and dictionaries that do not exist, so they stamp as absent; a stamp planted as
   'moved' then fails the re-check -- the only part of the machinery this needs, since what is under
   test is the rendering."
  aCollectionOfKeys do: [:k | self server readLedger at: k put: 'moved'].
  self server revalidateReadLedger.
  ^self dispatchStatusText
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
  UserGlobals removeKey: #McpBwProbeGlobal ifAbsent: [nil].
  System commitTransaction
%
category: 'tests - re-validation'
method: McpBlindWriteTest
testACommitDropsAReadThatChangedUnderneath
  "Read alpha and beta; alpha's content moves (the kernel standing in for another session's commit);
   commit. Alpha's read is dropped and named, beta's stays, and a write to alpha is refused."
  | alpha |
  self fixtureClass.
  self readMethod: 'alpha'. self readMethod: 'beta'.
  self recompileInKernel: 'alpha' body: '^#changed'.
  System commitTransaction.
  self server noteCommitted.
  alpha := McpServer methodKeyFor: 'McpBwFixture' selector: 'alpha' meta: false.
  self deny: (self server hasRead: alpha).
  self assert: (self server hasRead: 'McpBwFixture>>beta').
  self assert: self server staleReadKeys equals: (Array with: alpha).
  self assertBlindWrite: [self writeMethod: 'alpha' body: '^99'] about: 'McpBwFixture>>alpha'
%
category: 'tests - re-validation'
method: McpBlindWriteTest
testACommitKeepsEveryUnchangedGrain
  "There is no per-grain rule at a commit any more (the widening stopped at method grain): shape,
   comment and methods all survive on the same terms -- the content is what it was when read or
   written."
  self fixtureClass.
  self browsingTools tool_describe_class: (Dictionary new at: 'className' put: 'McpBwFixture'; yourself).
  self readMethod: 'alpha'. self readMethod: 'beta'.
  self writeMethod: 'beta' body: '^99'.
  System commitTransaction.
  self server noteCommitted.
  #( 'McpBwFixture:shape' 'McpBwFixture:comment' 'McpBwFixture>>alpha' 'McpBwFixture>>beta' ) do: [:k |
    self assert: (self server hasRead: k) description: k , ' was dropped by a commit that changed nothing about it'].
  self assert: self server staleReadKeys isEmpty
%
category: 'tests - re-validation'
method: McpBlindWriteTest
testACommitKeepsThisSessionsOwnWrites
  "Having written something and committed it, this session knows its content better than a read
   would: the stamp was recorded as written and the commit proved nobody else changed it, so the
   next change needs no re-read."
  self fixtureClass.
  self readMethod: 'alpha'.
  self writeMethod: 'alpha' body: '^99'.
  System commitTransaction.
  self server noteCommitted.
  self assert: (self server hasRead: 'McpBwFixture>>alpha').
  self assert: self server writeLedger isEmpty.
  self assert: (self includes: 'Compiled' in: (self writeMethod: 'alpha' body: '^100'))
%
category: 'tests - view moves'
method: McpBlindWriteTest
testAbortClearsTheWritesAndReChecksTheReads
  "An abort takes a new view AND discards the work, so no pending write is licensed any more. The
   reads are not forgotten but re-checked: here nothing exists behind either key before or after, so
   neither has changed and both stay. (Until 2026-09-02 both ledgers were simply cleared.)"
  self server noteRead: 'A>>x'; noteWrite: 'A>>y'.
  self server noteAborted.
  self assert: (self server hasRead: 'A>>x').
  self assert: self server writeLedger isEmpty.
  self assert: self server staleReadKeys isEmpty
%
category: 'tests - re-validation'
method: McpBlindWriteTest
testAbortKeepsAReadNobodyChanged
  "Through the real tools: read a method, abort with nothing changed underneath, and the read still
   licenses the write -- because what was read is still exactly what is there."
  self fixtureClass.
  self readMethod: 'alpha'.
  System abortTransaction.
  self server noteAborted.
  self assert: (self server hasRead: (McpServer methodKeyFor: 'McpBwFixture' selector: 'alpha' meta: false)).
  self assert: self server staleReadKeys isEmpty.
  self assert: (self includes: 'Compiled' in: (self writeMethod: 'alpha' body: '^99'))
%
category: 'tests - view moves'
method: McpBlindWriteTest
testAFailedCommitKeepsBoth
  "A failed commit does NOT move the view (measured; docs/blind-write-guardrail.md, V), so every
   read in the window is still current and every pending write is still licensed. The transaction
   is doomed and must be aborted, but that is a different fact from whether the reads are stale."
  self server noteRead: 'A>>x'; noteWrite: 'A>>y'.
  self server noteCommitFailed.
  self assert: (self server hasRead: 'A>>x').
  self assert: (self server writeLedger includes: 'A>>y')
%
category: 'tests - class definition'
method: McpBlindWriteTest
testARawRedefineNeedsTheWholeClass
  "recompileMethods=false drops every method, including ones never named, so the shape alone is not
   enough -- this is the one place the two compile_class_definition paths differ."
  self fixtureClass.
  self browsingTools tool_get_class_definition:
    (Dictionary new at: 'className' put: 'McpBwFixture'; yourself).
  self assertBlindWrite: [
    self mutationTools tool_compile_class_definition: (Dictionary new
      at: 'className' put: 'McpBwFixture';
      at: 'instVarNames' put: (Array with: 'x');
      at: 'recompileMethods' put: false; yourself)]
    about: 'McpBwFixture>>alpha'
%
category: 'tests - view moves'
method: McpBlindWriteTest
testARefreshThatFailsClearsTheWritesAndReChecksTheReads
  "A continueTransaction answering false moved the view anyway and left the writes doomed. No write
   is licensed any more, which is also what keeps writeLedger subseteq readLedger unconditional; the
   reads get the same re-check an abort gives them."
  self server noteRead: 'A>>x'; noteWrite: 'A>>y'.
  self server noteRefreshed: false.
  self assert: (self server hasRead: 'A>>x').
  self assert: self server writeLedger isEmpty
%
category: 'tests - re-validation'
method: McpBlindWriteTest
testAnAbortedWriteNeedsAFreshRead
  "Read, write, abort: the abort restored the old content, and what this session last knew of the
   method is the version it just discarded. The read is dropped and named -- even though nobody else
   touched anything -- because the stamp a write records is of the content as written."
  | key |
  self fixtureClass.
  self readMethod: 'alpha'.
  self writeMethod: 'alpha' body: '^99'.
  System abortTransaction.
  self server noteAborted.
  key := McpServer methodKeyFor: 'McpBwFixture' selector: 'alpha' meta: false.
  self deny: (self server hasRead: key).
  self assert: self server staleReadKeys equals: (Array with: key)
%
category: 'tests - view moves'
method: McpBlindWriteTest
testASuccessfulCommitReChecksTheReads
  "A successful commit moves the view, and the reads get the same re-check every move gives them:
   what this session read and nobody changed stays, what it wrote stays -- the stamp was recorded as
   written, and a successful commit means nobody else touched it -- and the write ledger empties,
   because those changes are now everyone's."
  self fixtureClass.
  self readMethod: 'alpha'. self readMethod: 'beta'.
  self writeMethod: 'beta' body: '^99'.
  System commitTransaction.
  self server noteCommitted.
  self assert: (self server hasRead: 'McpBwFixture>>alpha').
  self assert: (self server hasRead: 'McpBwFixture>>beta').
  self assert: self server writeLedger isEmpty.
  self assert: self server staleReadKeys isEmpty
%
category: 'tests - view moves'
method: McpBlindWriteTest
testASuccessfulRefreshKeepsTheWritesPending
  "Same re-check as a commit -- but the writes are still uncommitted, so they stay in the write
   ledger, and they pass the re-check because the uncommitted text is still in place."
  self fixtureClass.
  self readMethod: 'alpha'. self readMethod: 'beta'.
  self writeMethod: 'beta' body: '^99'.
  self server noteRefreshed: true.
  self assert: (self server hasRead: 'McpBwFixture>>alpha').
  self assert: (self server hasRead: 'McpBwFixture>>beta').
  self assert: (self server writeLedger includes: 'McpBwFixture>>beta')
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
category: 'tests - class definition'
method: McpBlindWriteTest
testCompileClassDefinitionAcceptsNoSourceString
  "The tool used to take a Smalltalk string and run `source evaluate`, checking only afterwards that
   the result was a class -- so it could run anything, and leaving McpExecutionToolset out did not
   actually close the escape hatch. The schema is closed (additionalProperties false), so a client
   still sending source is told, rather than having it silently ignored."
  | tool err |
  tool := self server toolRegistry at: 'compile_class_definition'.
  err := tool validationErrorFor: (Dictionary new at: 'source' put: 'System commitTransaction. Object'; yourself).
  self assert: err notNil description: 'a source argument should no longer validate'
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
category: 'tests - class definition'
method: McpBlindWriteTest
testKernelClassesMayBeSubclassed
  "The kernel guard is about the class being REDEFINED, not what it inherits from: subclassing
   Object is the normal case and every Mcp class does it."
  self assert: (self includes: 'Compiled class' in:
    (self mutationTools tool_compile_class_definition: (Dictionary new
      at: 'className' put: 'McpBwFixture';
      at: 'superclassName' put: 'Object';
      at: 'dictionary' put: 'UserGlobals'; yourself)))
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
category: 'tests - class definition'
method: McpBlindWriteTest
testRedefiningAnUnreadClassIsRefused
  self fixtureClass.
  self assertBlindWrite: [
    self mutationTools tool_compile_class_definition: (Dictionary new
      at: 'className' put: 'McpBwFixture';
      at: 'instVarNames' put: (Array with: 'x'); yourself)]
    about: 'the definition of McpBwFixture'
%
category: 'tests - class definition'
method: McpBlindWriteTest
testRedefiningIdenticallyRecordsNoWrite
  "Re-sending the same definition is a true no-op in the image, so it must not leave a write ledger
   entry -- which a later commit would turn into a licence the stone never validated."
  self fixtureClass.
  self browsingTools tool_get_class_definition:
    (Dictionary new at: 'className' put: 'McpBwFixture'; yourself).
  self assert: (self includes: 'unchanged' in:
    (self mutationTools tool_compile_class_definition:
      (Dictionary new at: 'className' put: 'McpBwFixture'; yourself))).
  self deny: (self server writeLedger includes: (McpServer shapeKeyFor: 'McpBwFixture'))
%
category: 'tests - re-validation'
method: McpBlindWriteTest
testRevalidationDropsOnlyWhatChanged
  "The rule in one line: a read stays licensed exactly as long as what it read is still there. Two
   reads, one subject changed underneath, one re-validation -- the changed one is dropped and named,
   the other keeps its licence."
  | alpha beta |
  self fixtureClass.
  self readMethod: 'alpha'. self readMethod: 'beta'.
  self recompileInKernel: 'alpha' body: '^#changed'.
  self server revalidateReadLedger.
  alpha := McpServer methodKeyFor: 'McpBwFixture' selector: 'alpha' meta: false.
  beta := McpServer methodKeyFor: 'McpBwFixture' selector: 'beta' meta: false.
  self deny: (self server hasRead: alpha).
  self assert: (self server hasRead: beta).
  self assert: self server staleReadKeys equals: (Array with: alpha).
  self assertBlindWrite: [self writeMethod: 'alpha' body: '^99'] about: 'McpBwFixture>>alpha'.
  self assert: (self includes: 'Compiled' in: (self writeMethod: 'beta' body: '^99'))
%
category: 'tests - re-validation'
method: McpBlindWriteTest
testRevalidationKeepsAByteIdenticalRecompile
  "The stamp is of the TEXT, not the method object: a recompile that installs the same source is a
   new GsNMethod (docs/blind-write-guardrail.md, P) but not a change to anything the client read, so
   the read stays good. This is the reason for hashing content rather than remembering the oop."
  self fixtureClass.
  self readMethod: 'alpha'.
  self recompileInKernel: 'alpha' body: '^1'.
  self server revalidateReadLedger.
  self assert: (self server hasRead: (McpServer methodKeyFor: 'McpBwFixture' selector: 'alpha' meta: false)).
  self assert: self server staleReadKeys isEmpty
%
category: 'tests - re-validation'
method: McpBlindWriteTest
testRevalidationReachesEveryGrain
  "Comment and dictionary are stamped too, each from the text its read tool shows: the comment, the
   sorted entry list. Change each underneath and each read is dropped; the shape and the method read
   alongside them, which nobody touched, are not."
  | cls |
  cls := self fixtureClass.
  self browsingTools tool_describe_class: (Dictionary new at: 'className' put: 'McpBwFixture'; yourself).
  self readMethod: 'alpha'.
  self server noteRead: (McpServer dictionaryKeyFor: 'UserGlobals').
  cls comment: 'changed underneath'.
  UserGlobals at: #McpBwProbeGlobal put: 1.
  self server revalidateReadLedger.
  self assert: self server staleReadKeys equals: (Array with: '#UserGlobals' with: 'McpBwFixture:comment').
  self assert: (self server hasRead: 'McpBwFixture:shape').
  self assert: (self server hasRead: 'McpBwFixture>>alpha')
%
category: 'tests - re-validation'
method: McpBlindWriteTest
testRevalidationSeesAShapeChange
  "A shape-changing redefinition underneath a get_class_definition read: the definition message is
   different, so the read is dropped. (The methods go with it -- a redefinition installs a new class
   object with no methods, docs/blind-write-guardrail.md T -- so a method read is dropped too, as
   absent; that is the kernel's doing, and the honest answer.)"
  self fixtureClass.
  self browsingTools tool_get_class_definition: (Dictionary new at: 'className' put: 'McpBwFixture'; yourself).
  Object subclass: 'McpBwFixture' instVarNames: #( 'x' ) classVars: #() classInstVars: #()
    poolDictionaries: #() inDictionary: UserGlobals options: #().
  self server revalidateReadLedger.
  self deny: (self server hasRead: 'McpBwFixture:shape').
  self assert: self server staleReadKeys equals: (Array with: 'McpBwFixture:shape')
%
category: 'tests - re-validation'
method: McpBlindWriteTest
testStampsHashTheCurrentContent
  "What a stamp IS, pinned once: the SHA-256 of the subject's canonical text -- the method source as
   sourceCodeAt: answers it, the class definition message -- and a fixed marker for a subject that
   does not exist, so appearing and disappearing both count as change."
  | cls |
  cls := self fixtureClass.
  self assert: (self server stampFor: 'McpBwFixture>>alpha') equals: (cls sourceCodeAt: #alpha) asSha256String.
  self assert: (self server stampFor: 'McpBwFixture class>>gamma') equals: (cls class sourceCodeAt: #gamma) asSha256String.
  self assert: (self server stampFor: 'McpBwFixture:shape') equals: cls definition asSha256String.
  self assert: (self server stampFor: 'McpBwFixture:comment') equals: cls comment asSha256String.
  self assert: (self server stampFor: 'McpBwFixture>>nope') equals: McpServer absentStamp.
  self assert: (self server stampFor: 'McpBwNoSuchClass:shape') equals: McpServer absentStamp.
  self assert: (self server stampFor: '#McpBwNoSuchDictionary') equals: McpServer absentStamp.
  self assert: (self server stampFor: 'not a key') equals: McpServer absentStamp
%
category: 'tests - class definition'
method: McpBlindWriteTest
testTheClassDefinitionReadLicensesARedefinition
  "The default path recompiles the old methods from the class AS RESOLVED NOW, so what it needs
   seen is the shape it is replacing -- not every method."
  self fixtureClass.
  self browsingTools tool_get_class_definition:
    (Dictionary new at: 'className' put: 'McpBwFixture'; yourself).
  self assert: (self includes: 'recompiled' in:
    (self mutationTools tool_compile_class_definition: (Dictionary new
      at: 'className' put: 'McpBwFixture';
      at: 'instVarNames' put: (Array with: 'x'); yourself)))
%
category: 'tests - stale note'
method: McpBlindWriteTest
testTheStaleNoteIsReportedOnceAndNamesTheReads
  "What the client is told, and how often. The result of the call that moved the view carries one
   line naming the dropped reads in proportion to the whole; the next result does not carry it
   again. Driven through the dispatcher wired to THIS server, as a worker gem's is, because the note
   is the dispatcher's."
  | first second |
  self fixtureClass.
  self readMethod: 'alpha'. self readMethod: 'beta'.
  self recompileInKernel: 'alpha' body: '^#changed'.
  self server revalidateReadLedger.
  first := self dispatchStatusText.
  self assert: (self includes: '[session] The view moved: 1 of 2 earlier reads is stale' in: first)
    description: first.
  self assert: (self includes: 'McpBwFixture>>alpha' in: first).
  self assert: (self includes: '[session] You have uncommitted changes' in: first)
    description: 'the transaction-state line must still be there, before the stale line'.
  second := self dispatchStatusText.
  self deny: (self includes: 'The view moved' in: second) description: second
%
category: 'tests - stale note'
method: McpBlindWriteTest
testTheStaleNoteCollapsesManyClasses
  "More than four classes and the names give way to a count: at that point the honest advice is to
   re-check everything one depends on, not to tick off a list."
  | text |
  text := self staleNoteForKeys: #( 'McpBwGhost1>>one' 'McpBwGhost2>>one' 'McpBwGhost3>>one' 'McpBwGhost4>>one' 'McpBwGhost5:shape' ).
  self assert: (self includes: '5 of 5 earlier reads are stale and must be re-read before writing to them: changes to 5 classes; re-check what you depend on before writing.' in: text)
    description: text.
  self deny: (self includes: 'McpBwGhost1' in: text)
%
category: 'tests - stale note'
method: McpBlindWriteTest
testTheStaleNoteCountsManyMethodsOfOneClass
  "More than three methods of one class are counted, not named."
  | text |
  text := self staleNoteForKeys: #( 'McpBwGhost>>one' 'McpBwGhost>>two' 'McpBwGhost>>three' 'McpBwGhost>>four' 'McpBwGhost class>>five' ).
  self assert: (self includes: 'before writing to them: 5 methods from McpBwGhost.' in: text) description: text.
  self deny: (self includes: 'McpBwGhost>>one' in: text)
%
category: 'tests - stale note'
method: McpBlindWriteTest
testTheStaleNoteGroupsByClass
  "Up to four groups are each rendered on their own terms, in name order: a class with a few methods,
   a class with many, a dictionary."
  | text |
  text := self staleNoteForKeys: #( 'McpBwGhostB>>a' 'McpBwGhostB>>b' 'McpBwGhostB>>c' 'McpBwGhostB>>d' 'McpBwGhostA>>one' '#McpBwGhostDict' ).
  self assert: (self includes: 'before writing to them: McpBwGhostA>>one, 4 methods from McpBwGhostB, McpBwGhostDict (dictionary).' in: text)
    description: text
%
category: 'tests - stale note'
method: McpBlindWriteTest
testTheStaleNoteNamesAFewMethods
  "Three or fewer methods of a class are named in full, both sides under the one class."
  | text |
  text := self staleNoteForKeys: #( 'McpBwGhost>>one' 'McpBwGhost class>>two' ).
  self assert: (self includes: '2 of 2 earlier reads are stale and must be re-read before writing to them: McpBwGhost class>>two, McpBwGhost>>one.' in: text)
    description: text
%
category: 'tests - stale note'
method: McpBlindWriteTest
testTheStaleNoteNamesTheDefinitionAndComment
  "The shape and comment keys read as the class's definition and comment, alongside its methods."
  | text |
  text := self staleNoteForKeys: #( 'McpBwGhost:shape' 'McpBwGhost:comment' 'McpBwGhost>>one' ).
  self assert: (self includes: 'before writing to them: McpBwGhost>>one, McpBwGhost (definition), McpBwGhost (comment).' in: text)
    description: text
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
category: 'tests - re-validation'
method: McpBlindWriteTest
testTrueRefreshReChecksTheReadsLikeACommit
  "A refresh answering true is the same move for the reads as a commit: alpha's content moved
   underneath (the kernel standing in for another session), beta's did not."
  | alpha |
  self fixtureClass.
  self readMethod: 'alpha'. self readMethod: 'beta'.
  self recompileInKernel: 'alpha' body: '^#changed'.
  self server noteRefreshed: true.
  alpha := McpServer methodKeyFor: 'McpBwFixture' selector: 'alpha' meta: false.
  self deny: (self server hasRead: alpha).
  self assert: (self server hasRead: 'McpBwFixture>>beta').
  self assert: self server staleReadKeys equals: (Array with: alpha)
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
