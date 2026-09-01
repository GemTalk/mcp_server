set compile_env: 0
! ------------------- Class definition for McpToolTest
expectvalue /Class
doit
GsTestCase subclass: 'McpToolTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpToolTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpToolTest
removeallmethods McpToolTest
removeallclassmethods McpToolTest
! ------------------- Class methods for McpToolTest
category: 'session view'
classmethod: McpToolTest
movesTheSessionView
  "Why this suite cannot be run from a session that has uncommitted work. See
   McpTestingToolset class>>sessionViewRefusalFor:, which is what asks."
  ^'it commits throwaway fixture classes, and a commit takes the whole session with it'
%
! ------------------- Instance methods for McpToolTest
category: 'helpers'
method: McpToolTest
browsingTools
  ^self toolsetOfClass: McpBrowsingToolset
%
category: 'helpers'
method: McpToolTest
createFixtureClass
  "Create the throwaway fixture class in UserGlobals (committed), with one instance-side and one
   class-side method so the browsing/search tools have something to report. tearDown removes it."
  | c |
  c := Object subclass: 'McpTestFixture'
    instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #()
    inDictionary: UserGlobals options: #().
  c comment: 'Throwaway fixture created by McpToolTest. Safe to remove.'.
  c compileMethod: 'probeAnswer ^''probeAnswerBody''' dictionaries: System myUserProfile symbolList category: 'probing'.
  c class compileMethod: 'probeClassSide ^''probeClassBody''' dictionaries: System myUserProfile symbolList category: 'probing'.
  System commitTransaction.
  ^c
%
category: 'helpers'
method: McpToolTest
createTestSuiteFixture
  "Create a throwaway GsTestCase subclass with a passing test, a failing test, and two erroring
   tests: testErrors (a ZeroDivide) and testDnu (a doesNotUnderstand, whose missing selector the
   describe tool should surface). Committed; tearDown removes it."
  | c |
  c := GsTestCase subclass: 'McpTestSuiteFixture'
    instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #()
    inDictionary: UserGlobals options: #().
  c compileMethod: 'testPasses self assert: true' dictionaries: System myUserProfile symbolList category: 'tests'.
  c compileMethod: 'testFails self assert: false' dictionaries: System myUserProfile symbolList category: 'tests'.
  c compileMethod: 'testErrors 1/0' dictionaries: System myUserProfile symbolList category: 'tests'.
  c compileMethod: 'testDnu ^self zzzNoSuchSelector' dictionaries: System myUserProfile symbolList category: 'tests'.
  System commitTransaction.
  ^c
%
category: 'helpers'
method: McpToolTest
executionTools
  ^self toolsetOfClass: McpExecutionToolset
%
category: 'helpers'
method: McpToolTest
includesCS: aSubstring in: aString
  "Case-sensitive substring test. GemStone's String>>includesString: is case-INsensitive
   (e.g. 'FAIL' matches the 'fail' in 'failed'), so use findString:startingAt: (which is
   case-sensitive) for assert:/deny: substring checks."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'helpers'
method: McpToolTest
listingTools
  ^self toolsetOfClass: McpListingToolset
%
category: 'helpers'
method: McpToolTest
mutationTools
  ^self toolsetOfClass: McpMutationToolset
%
category: 'helpers'
method: McpToolTest
oneArg: key value: value
  | d |
  d := Dictionary new.
  d at: key put: value.
  ^d
%
category: 'helpers'
method: McpToolTest
searchTools
  ^self toolsetOfClass: McpSearchToolset
%
category: 'helpers'
method: McpToolTest
sessionTools
  ^self toolsetOfClass: McpSessionToolset
%
category: 'running'
method: McpToolTest
tearDown
  "Force-remove any throwaway fixtures a test created, then commit, so nothing leaks.
   Aborts FIRST: since the mutation tools stopped committing (McpMutationToolset), a test can end
   with uncommitted changes, and without this the commit below would persist them instead of the
   removals alone. It also clears a deliberately-provoked commit conflict, which would otherwise
   make that commit fail and leak the fixture."
  | up dict |
  System abortTransaction.
  up := System myUserProfile.
  #(McpTestSub McpTestFixture McpTestSuiteFixture) do: [:sym |
    (up objectNamed: sym) ifNotNil: [:cls |
      (up dictionaryAndSymbolOf: cls) ifNotNil: [:arr | (arr at: 1) removeKey: (arr at: 2) ifAbsent: [nil]]]].
  dict := up symbolList detect: [:d | d name asString = 'McpTestDict'] ifNone: [nil].
  dict ifNotNil: [up removeDictionaryAt: (up symbolList indexOf: dict)].
  UserGlobals removeKey: #McpTestDict ifAbsent: [nil].
  UserGlobals removeKey: #McpTestSub ifAbsent: [nil].
  UserGlobals removeKey: #McpTestFixture ifAbsent: [nil].
  UserGlobals removeKey: #McpTestSuiteFixture ifAbsent: [nil].
  System commitTransaction
%
category: 'tools - session'
method: McpToolTest
testAbort
  "tool_abort must discard uncommitted work. Commit a fixture as a baseline, change its comment
   without committing, abort, then confirm both the 'aborted' report and that the change reverted.
   (tearDown removes McpTestFixture.)"
  | cls out baseline |
  cls := self createFixtureClass.
  baseline := cls comment.
  cls comment: 'uncommitted - should be discarded by abort'.
  self assert: (cls comment = 'uncommitted - should be discarded by abort').
  out := self sessionTools tool_abort: Dictionary new.
  self assert: (self includesCS: 'aborted' in: out).
  self assert: (cls comment = baseline)
%
category: 'tools - mutation'
method: McpToolTest
testAddDictionary
  | out |
  out := self mutationTools tool_add_dictionary: (self oneArg: 'dictionaryName' value: 'McpTestDict').
  self assert: (self includesCS: 'Created dictionary' in: out).
  self assert: (self includesCS: 'McpTestDict' in: (self listingTools tool_list_dictionaries: Dictionary new))
%
category: 'tools - session'
method: McpToolTest
testCommit
  "tool_commit must persist changes. Change the fixture's comment, commit via the tool, then
   abort with the primitive (not tool_abort, so this test doesn't depend on that tool); the
   change must survive the abort, proving it was committed. (tearDown removes McpTestFixture.)"
  | cls out changed |
  cls := self createFixtureClass.
  changed := 'committed change - should survive abort'.
  cls comment: changed.
  out := self sessionTools tool_commit: Dictionary new.
  self assert: (self includesCS: 'committed' in: out).
  System abortTransaction.
  self assert: (cls comment = changed)
%
category: 'tools - mutation'
method: McpToolTest
testCompileClassDefinition
  | out |
  out := self mutationTools tool_compile_class_definition: (self oneArg: 'source' value:
    'Object subclass: ''McpTestFixture'' instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #()').
  self assert: (self includesCS: 'Compiled class: McpTestFixture' in: out).
  self assert: (System myUserProfile objectNamed: #McpTestFixture) notNil
%
category: 'tools - mutation'
method: McpToolTest
testCompileClassDefinitionPreservesMethods
  "Default recompileMethods=true: a shape change keeps the class's methods."
  | cls out |
  cls := Object subclass: 'McpTestFixture' instVarNames: #(a) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #().
  cls compileMethod: 'getA ^a' dictionaries: System myUserProfile symbolList category: 'acc'.
  System commitTransaction.
  out := self mutationTools tool_compile_class_definition: (self oneArg: 'source' value:
    'Object subclass: ''McpTestFixture'' instVarNames: #(a b) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #()').
  self assert: (self includesCS: 'recompiled 1/1' in: out).
  self assert: ((System myUserProfile objectNamed: #McpTestFixture) canUnderstand: #getA).
  self assert: ((System myUserProfile objectNamed: #McpTestFixture) instVarNames includes: #b)
%
category: 'tools - mutation'
method: McpToolTest
testCompileClassDefinitionRawWhenFlagFalse
  "recompileMethods=false reproduces the raw redefine: methods are dropped."
  | cls out |
  cls := Object subclass: 'McpTestFixture' instVarNames: #(a) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #().
  cls compileMethod: 'getA ^a' dictionaries: System myUserProfile symbolList category: 'acc'.
  System commitTransaction.
  out := self mutationTools tool_compile_class_definition: (Dictionary new
    at: 'source' put: 'Object subclass: ''McpTestFixture'' instVarNames: #(a b) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #()';
    at: 'recompileMethods' put: false; yourself).
  self deny: ((System myUserProfile objectNamed: #McpTestFixture) canUnderstand: #getA)
%
category: 'tools - mutation'
method: McpToolTest
testCompileClassDefinitionRefusesWithSubclasses
  "With recompile on (default), a class that has subclasses is refused rather than redefined."
  | cls out |
  cls := Object subclass: 'McpTestFixture' instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #().
  cls subclass: 'McpTestSub' instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #().
  System commitTransaction.
  out := self mutationTools tool_compile_class_definition: (self oneArg: 'source' value:
    'Object subclass: ''McpTestFixture'' instVarNames: #(a) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #()').
  self assert: (self includesCS: 'Refused' in: out).
  self assert: (self includesCS: 'McpTestSub' in: out)
%
category: 'tools - mutation'
method: McpToolTest
testCompileClassDefinitionRejectsNonClass
  "A source that evaluates to something other than a class is rejected and directed to
   execute_code, and nothing is committed."
  | out |
  out := self mutationTools tool_compile_class_definition: (self oneArg: 'source' value: '3 + 4').
  self assert: (self includesCS: 'did not evaluate to a class' in: out).
  self assert: (self includesCS: 'execute_code' in: out).
  self deny: (self includesCS: 'committed' in: out)
%
category: 'tools - mutation'
method: McpToolTest
testCompileClassDefinitionReportsRecompileFailure
  "A method that no longer compiles under the new shape is reported, but the redefinition
   (and the methods that did recompile) still applies."
  | cls out |
  cls := Object subclass: 'McpTestFixture' instVarNames: #(a) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #().
  cls compileMethod: 'getA ^a' dictionaries: System myUserProfile symbolList category: 'acc'.
  cls compileMethod: 'withLocal | tmp | tmp := 5. ^tmp' dictionaries: System myUserProfile symbolList category: 'acc'.
  System commitTransaction.
  "adding ivar 'tmp' collides with withLocal's temporary -> that one fails to recompile"
  out := self mutationTools tool_compile_class_definition: (self oneArg: 'source' value:
    'Object subclass: ''McpTestFixture'' instVarNames: #(a tmp) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #()').
  self assert: (self includesCS: 'recompiled 1/2' in: out).
  self assert: (self includesCS: 'failed' in: out).
  self assert: (self includesCS: 'withLocal' in: out).
  self deny: ((System myUserProfile objectNamed: #McpTestFixture) canUnderstand: #withLocal).
  self assert: ((System myUserProfile objectNamed: #McpTestFixture) canUnderstand: #getA)
%
category: 'tools - mutation'
method: McpToolTest
testCompileMethod
  | out |
  self createFixtureClass.
  out := self mutationTools tool_compile_method:
    (Dictionary new at: 'className' put: 'McpTestFixture'; at: 'source' put: 'answer ^42'; at: 'category' put: 'tmp'; yourself).
  self assert: (self includesCS: 'Compiled McpTestFixture' in: out).
  self assert: ((System myUserProfile objectNamed: #McpTestFixture) canUnderstand: #answer)
%
category: 'tools - mutation'
method: McpToolTest
testCompileMethodMeta
  "meta=true compiles onto the class side, not the instance side."
  | out cls |
  cls := self createFixtureClass.
  out := self mutationTools tool_compile_method:
    (Dictionary new at: 'className' put: 'McpTestFixture'; at: 'source' put: 'classAnswer ^42'; at: 'category' put: 'tmp'; at: 'meta' put: true; yourself).
  self assert: (self includesCS: 'Compiled McpTestFixture' in: out).
  self assert: (cls class canUnderstand: #classAnswer).
  self deny: (cls canUnderstand: #classAnswer)
%
category: 'tools - mutation'
method: McpToolTest
testDeleteClass
  | out |
  self createFixtureClass.
  out := self mutationTools tool_delete_class: (self oneArg: 'className' value: 'McpTestFixture').
  self assert: (self includesCS: 'Deleted class' in: out).
  self assert: (System myUserProfile objectNamed: #McpTestFixture) isNil
%
category: 'tools - mutation'
method: McpToolTest
testDeleteMethod
  | out |
  self createFixtureClass.
  (System myUserProfile objectNamed: #McpTestFixture)
    compileMethod: 'answer ^42' dictionaries: System myUserProfile symbolList category: 'tmp'.
  System commitTransaction.
  out := self mutationTools tool_delete_method:
    (Dictionary new at: 'className' put: 'McpTestFixture'; at: 'selector' put: 'answer'; yourself).
  self assert: (self includesCS: 'Deleted method' in: out).
  self deny: ((System myUserProfile objectNamed: #McpTestFixture) canUnderstand: #answer)
%
category: 'tools - mutation'
method: McpToolTest
testDeleteMethodMeta
  "meta=true deletes a class-side method."
  | out cls |
  cls := self createFixtureClass.
  cls class compileMethod: 'classAnswer ^42' dictionaries: System myUserProfile symbolList category: 'tmp'.
  System commitTransaction.
  out := self mutationTools tool_delete_method:
    (Dictionary new at: 'className' put: 'McpTestFixture'; at: 'selector' put: 'classAnswer'; at: 'meta' put: true; yourself).
  self assert: (self includesCS: 'Deleted method' in: out).
  self deny: (cls class canUnderstand: #classAnswer)
%
category: 'tools - browsing'
method: McpToolTest
testDescribeClass
  | out |
  self createFixtureClass.
  out := self browsingTools tool_describe_class: (self oneArg: 'className' value: 'McpTestFixture').
  self assert: (self includesCS: 'name=McpTestFixture' in: out).
  self assert: (self includesCS: 'superclass=Object' in: out)
%
category: 'tools - testing'
method: McpToolTest
testDescribeTestFailureNamesMissingSelector
  "For a doesNotUnderstand, describe_test_failure surfaces the missing selector -- which lives in
   the exception's description, not its class name and not its (nil) messageText. This exercises
   the description path the old handler lacked, without depending on our SUnit version: a DNU's
   description always names the selector, whether or not messageText is populated."
  | out |
  self createTestSuiteFixture.
  out := self testingTools tool_describe_test_failure:
    (Dictionary new at: 'className' put: 'McpTestSuiteFixture'; at: 'selector' put: 'testDnu'; yourself).
  self assert: (self includesCS: 'zzzNoSuchSelector' in: out)
%
category: 'tools - testing'
method: McpToolTest
testDescribeTestFailureOnError
  "An erroring test reports the error class and message."
  | out |
  self createTestSuiteFixture.
  out := self testingTools tool_describe_test_failure:
    (Dictionary new at: 'className' put: 'McpTestSuiteFixture'; at: 'selector' put: 'testErrors'; yourself).
  self assert: (self includesCS: 'testErrors' in: out).
  self assert: (self includesCS: 'ZeroDivide' in: out)
%
category: 'tools - testing'
method: McpToolTest
testDescribeTestFailureOnFailingTest
  "A failing test reports the failure detail, not 'passed'."
  | out |
  self createTestSuiteFixture.
  out := self testingTools tool_describe_test_failure:
    (Dictionary new at: 'className' put: 'McpTestSuiteFixture'; at: 'selector' put: 'testFails'; yourself).
  self assert: (self includesCS: 'testFails' in: out).
  self assert: (self includesCS: 'TestFailure' in: out).
  self deny: (self includesCS: 'passed' in: out)
%
category: 'tools - testing'
method: McpToolTest
testDescribeTestFailureOnPassingTest
  | out |
  out := self testingTools tool_describe_test_failure:
    (Dictionary new at: 'className' put: 'SUnitTest'; at: 'selector' put: 'testAssert'; yourself).
  self assert: out = 'SUnitTest>>testAssert passed (no failure).'
%
category: 'tools - execution'
method: McpToolTest
testExecuteCode
  self assert: (self executionTools tool_execute_code: (self oneArg: 'code' value: '3 + 4')) equals: '7'
%
category: 'tools - execution'
method: McpToolTest
testExecuteCodeMultiStatement
  self assert: (self executionTools tool_execute_code: (self oneArg: 'code' value: '| x | x := 6. x * 7')) equals: '42'
%
category: 'tools - execution'
method: McpToolTest
testExecuteCodeTruncates
  "Oversized results are capped by McpToolset>>capResult: at 50000 chars plus a marker.
   capResult: is shared by execute_code and the python tools, so this guards all three."
  | out |
  out := self executionTools tool_execute_code: (self oneArg: 'code' value: '(String new: 60000)').
  self assert: (self includesCS: '...[truncated]' in: out).
  self assert: out size equals: 50000 + ' ...[truncated]' size
%
category: 'tools - browsing'
method: McpToolTest
testExportClassSource
  | src |
  self createFixtureClass.
  src := self browsingTools tool_export_class_source: (self oneArg: 'className' value: 'McpTestFixture').
  self assert: (self includesCS: 'Object subclass: ''McpTestFixture''' in: src).
  "export_class_source is a full file-in (definition + methods): assert the method source is
   present. (Marker is 'probeAnswer', not 'removeallmethods' -- GS 3.6.2's fileOutClass omits
   the removeallmethods line that 3.7.x emits, but both include the method bodies.)"
  self assert: (self includesCS: 'probeAnswer' in: src)
%
category: 'tools - search'
method: McpToolTest
testFindImplementors
  "add: has many implementors; confirm more than one distinct result comes back."
  | impls |
  impls := (self searchTools tool_find_implementors: (self oneArg: 'selector' value: 'add:'))
    subStrings: (String with: Character lf).
  self assert: (impls includes: 'Array>>add:  [Adding]').
  self assert: (impls includes: 'Set>>add:  [Adding]')
%
category: 'tools - search'
method: McpToolTest
testFindImplementorsNone
  "No implementors: formatMethodList: returns '(none)'. 'foo-bar:' is not a legal Smalltalk
   selector, so nothing will ever implement it."
  self assert: (self searchTools tool_find_implementors: (self oneArg: 'selector' value: 'foo-bar:')) = '(none)'
%
category: 'tools - search'
method: McpToolTest
testFindReferencesTo
  "Boolean is referenced by many kernel methods (the tool does not truncate); confirm more
   than one result via two of Boolean's own, very stable logical-operation methods."
  | refs |
  refs := (self searchTools tool_find_references_to: (self oneArg: 'name' value: 'Boolean'))
    subStrings: (String with: Character lf).
  self assert: (refs includes: 'Boolean>>&  [Logical Operations]').
  self assert: (refs includes: 'Boolean>>|  [Logical Operations]')
%
category: 'tools - search'
method: McpToolTest
testFindReferencesToNone
  "An undefined global: the handler reports 'Global not found:' and never reaches
   formatMethodList:. 'Foo-Bar' is not a legal identifier, so it will never be defined."
  self assert: (self searchTools tool_find_references_to: (self oneArg: 'name' value: 'Foo-Bar')) = 'Global not found: Foo-Bar'
%
category: 'tests'
method: McpToolTest
testFindSenders
  "serveGetStream:forSession: is sent from serveGet:on: (the GET route dispatch in McpRouter). Few
   senders -> not capped."
  | out |
  out := self searchTools tool_find_senders: (self oneArg: 'selector' value: 'serveGetStream:forSession:').
  self assert: (self includesCS: 'serveGet:on:' in: out).
  self deny: (self includesCS: 'showing first' in: out)
%
category: 'tools - search'
method: McpToolTest
testFindSendersTruncated
  "= has well over 200 senders, so the output is capped at 200 method lines and prefixed with
   a count note. Assert the note is present and exactly 200 method lines come back (the note
   line and any trailing blank have no '>>', so counting '>>' lines is robust)."
  | out lines methodLines |
  out := self searchTools tool_find_senders: (self oneArg: 'selector' value: '=').
  self assert: (self includesCS: '(showing first 200 of ' in: out).
  lines := out subStrings: (String with: Character lf).
  methodLines := lines select: [:l | self includesCS: '>>' in: l].
  self assert: methodLines size = 200
%
category: 'tools - browsing'
method: McpToolTest
testGetClassDefinition
  | def |
  self createFixtureClass.
  def := self browsingTools tool_get_class_definition: (self oneArg: 'className' value: 'McpTestFixture').
  self assert: (self includesCS: 'Object subclass: ''McpTestFixture''' in: def).
  self deny: (self includesCS: 'removeallmethods McpTestFixture' in: def)
%
category: 'tools - browsing'
method: McpToolTest
testGetClassHierarchy
  "Integer has a fixed hierarchy (its special subclasses can't be extended), so we can
   assert the tool's full output exactly: superclass chain (2-space indent per level) then
   sorted direct subclasses."
  | out lf expected |
  lf := String with: Character lf.
  expected := 'Object' , lf ,
    '  Magnitude' , lf ,
    '    Number' , lf ,
    '      Integer' , lf ,
    'Direct subclasses:' , lf ,
    '  LargeInteger' , lf ,
    '  SmallInteger' , lf.
  out := self browsingTools tool_get_class_hierarchy: (self oneArg: 'className' value: 'Integer').
  self assert: out = expected
%
category: 'tools - browsing'
method: McpToolTest
testGetMethodSource
  | out |
  self createFixtureClass.
  out := self browsingTools tool_get_method_source:
    (Dictionary new at: 'className' put: 'McpTestFixture'; at: 'selector' put: 'probeAnswer'; yourself).
  self assert: (self includesCS: 'probeAnswerBody' in: out)
%
category: 'tools - browsing'
method: McpToolTest
testGetMethodSourceMeta
  "meta=true returns the class-side method (probeClassSide is class-side only)."
  | out |
  self createFixtureClass.
  out := self browsingTools tool_get_method_source:
    (Dictionary new at: 'className' put: 'McpTestFixture'; at: 'selector' put: 'probeClassSide'; at: 'meta' put: true; yourself).
  self assert: (self includesCS: 'probeClassBody' in: out)
%
category: 'tools - browsing'
method: McpToolTest
testGetMethodSourceMissing
  "A nonexistent selector reports 'No such method' rather than raising (sourceCodeAt: raises a
   LookupError for an absent selector, so the handler wraps it)."
  | out |
  self createFixtureClass.
  out := self browsingTools tool_get_method_source:
    (Dictionary new at: 'className' put: 'McpTestFixture'; at: 'selector' put: 'noSuchSelectorXyz'; yourself).
  self assert: (self includesCS: 'No such method' in: out)
%
category: 'helpers'
method: McpToolTest
testingTools
  ^self toolsetOfClass: McpTestingToolset
%
category: 'tools - session'
method: McpToolTest
testLifetimeNoteCountsDownFromAnInstantAndOrdersByWhatComesFirst
  "The worker renders the countdown when it ANSWERS, from an instant the front end sent, so a long
   tool call cannot leave it promising time that has already gone. And it puts the nearer bound
   first -- which is not a fixed order, because it inverts: a 33-minute credential outlasts a
   30-minute idle rule when a request arrives and undercuts it six minutes later. Both are always
   reported, since only one of them fires whatever the client does next."
  | srv now note |
  srv := McpServer new.
  now := System timeGmt.
  srv handleJsonString: '{"jsonrpc":"2.0","method":"notifications/initialized"}'
    lifetimeBounds: (Array with: now + 1980 with: 'your access credential'
      with: 1800 with: 'of inactivity').
  note := srv lifetimeNote.
  self assert: (self includesCS: '30 minutes of inactivity, or 33 minutes left' in: note).
  "the same session six minutes into a call: the credential is now the nearer of the two"
  srv handleJsonString: '{"jsonrpc":"2.0","method":"notifications/initialized"}'
    lifetimeBounds: (Array with: now + 1620 with: 'your access credential'
      with: 1800 with: 'of inactivity').
  note := srv lifetimeNote.
  self assert: (self includesCS: '27 minutes left on your access credential, or 30 minutes of inactivity' in: note)
%
category: 'tools - session'
method: McpToolTest
testLifetimeNoteIsNilWithoutBounds
  "No bounds means no clause, and the warning keeps its unqualified form. Also the state a direct
   in-image send leaves: handleJsonString: routes through the bounds variant with nil, so bounds
   from an earlier request can never outlive the deadline that produced them."
  | srv |
  srv := McpServer new.
  srv handleJsonString: '{"jsonrpc":"2.0","method":"notifications/initialized"}'
    lifetimeBounds: (Array with: System timeGmt + 60 with: 'your access credential' with: nil with: nil).
  self assert: srv lifetimeNote notNil.
  srv handleJsonString: '{"jsonrpc":"2.0","method":"notifications/initialized"}'.
  self assert: srv lifetimeNote isNil
%
category: 'tools - listing'
method: McpToolTest
testListAllClasses
  | out |
  self createFixtureClass.
  out := self listingTools tool_list_all_classes: Dictionary new.
  self assert: (self includesCS: 'McpTestFixture  (UserGlobals)' in: out).
  self assert: (self includesCS: 'Boolean  (Globals)' in: out)
%
category: 'tools - listing'
method: McpToolTest
testListClasses
  | classes |
  self createFixtureClass.
  classes := (self listingTools tool_list_classes: (self oneArg: 'dictionaryName' value: 'UserGlobals'))
    subStrings: (String with: Character lf).
  self assert: (classes includes: 'McpTestFixture').
  self deny: (classes includes: 'Boolean')
%
category: 'tools - listing'
method: McpToolTest
testListDictionaries
  self assert: (self includesCS: 'UserGlobals' in: (self listingTools tool_list_dictionaries: Dictionary new))
%
category: 'tools - listing'
method: McpToolTest
testListDictionaryEntries
  | entries |
  self createFixtureClass.
  entries := (self listingTools tool_list_dictionary_entries: (self oneArg: 'dictionaryName' value: 'UserGlobals'))
    subStrings: (String with: Character lf).
  self assert: (entries includes: 'McpTestFixture  (class)').
  self deny: (entries includes: 'Boolean  (class)')
%
category: 'tools - testing'
method: McpToolTest
testListFailingTests
  "Scoped to the fixture, the report lists its failing and erroring tests."
  | out |
  self createTestSuiteFixture.
  out := self testingTools tool_list_failing_tests:
    (self oneArg: 'classNames' value: (Array with: 'McpTestSuiteFixture')).
  self assert: (self includesCS: 'FAIL' in: out).
  self assert: (self includesCS: '#testFails' in: out).
  self assert: (self includesCS: 'ERROR' in: out).
  self assert: (self includesCS: '#testErrors' in: out)
%
category: 'tools - testing'
method: McpToolTest
testListFailingTestsNone
  "A suite with no failures yields the empty-result sentinel."
  self assert: (self includesCS: 'no failing tests' in: (self testingTools tool_list_failing_tests:
    (self oneArg: 'classNames' value: (Array with: 'SUnitTest'))))
%
category: 'tools - browsing'
method: McpToolTest
testListMethods
  "list_methods shows both instance-side and class-side selectors."
  | methods |
  self createFixtureClass.
  methods := self browsingTools tool_list_methods: (self oneArg: 'className' value: 'McpTestFixture').
  self assert: (self includesCS: 'probeAnswer' in: methods).
  self assert: (self includesCS: 'probeClassSide' in: methods)
%
category: 'tools - testing'
method: McpToolTest
testListTestClasses
  self assert: (self includesCS: 'SUnitTest' in: (self testingTools tool_list_test_classes: Dictionary new))
%
category: 'tools - mutation'
method: McpToolTest
testMutationToolsDoNotCommit
  "Since 2026-08-28 no mutation tool commits: commit is the only tool that does. Compile a method
   through the tool, abort with the primitive, and the method must be GONE -- the mirror of
   testCommit, which proves the same abort cannot touch what commit persisted.

   This is what makes compile -> run the tests -> commit possible: the method is live in this
   session (asserted before the abort) without being published to anyone else."
  | cls out |
  cls := self createFixtureClass.
  out := self mutationTools tool_compile_method:
    (Dictionary new at: 'className' put: 'McpTestFixture'; at: 'source' put: 'uncommittedAnswer ^42'; yourself).
  self assert: (self includesCS: 'Compiled McpTestFixture' in: out).
  self deny: (self includesCS: 'committed' in: out).
  self assert: (cls canUnderstand: #uncommittedAnswer).
  self assert: System needsCommit.
  System abortTransaction.
  self deny: ((System myUserProfile objectNamed: #McpTestFixture) canUnderstand: #uncommittedAnswer)
%
category: 'tools - session'
method: McpToolTest
testRefresh
  "tool_refresh must KEEP uncommitted work while taking a current view (System
   continueTransaction). Until 2026-08-28 it was abortTransaction under a friendlier name, so this
   test asserted the opposite: that refresh discarded the caller's change. Commit a fixture
   baseline, change its comment without committing, refresh, and confirm the change SURVIVES and
   the transaction is still dirty. A true cross-session refresh (another gem commits, we see it)
   is an integration concern, not a unit test. (tearDown removes McpTestFixture.)"
  | cls out changed |
  cls := self createFixtureClass.
  changed := 'uncommitted - must SURVIVE refresh'.
  cls comment: changed.
  out := self sessionTools tool_refresh: Dictionary new.
  self assert: (self includesCS: 'refreshed' in: out).
  self assert: (cls comment = changed).
  self assert: System needsCommit
%
category: 'tools - session'
method: McpToolTest
testRefreshRefusesWhenNestedTransaction
  "continueTransaction is illegal inside a nested transaction (ImproperOperation 2717), so
   tool_refresh refuses with a message naming the state rather than letting the raw error out --
   the recovery move differs from the other illegal state's, and the caller has to know which."
  | raised |
  System beginNestedTransaction.
  raised := [self sessionTools tool_refresh: Dictionary new. nil]
    on: McpError do: [:ex | ex].
  System abortTransaction.
  self assert: raised notNil.
  self assert: raised kind equals: #refused.
  self assert: (self includesCS: 'nested transaction' in: raised description)
%
category: 'tools - mutation'
method: McpToolTest
testRemoveDictionary
  | out |
  self mutationTools tool_add_dictionary: (self oneArg: 'dictionaryName' value: 'McpTestDict').
  out := self mutationTools tool_remove_dictionary: (self oneArg: 'dictionaryName' value: 'McpTestDict').
  self assert: (self includesCS: 'Removed dictionary' in: out).
  self deny: (self includesCS: 'McpTestDict' in: (self listingTools tool_list_dictionaries: Dictionary new))
%
category: 'tools - testing'
method: McpToolTest
testRunTestClass
  "Run a suite with a passing, a failing, and erroring tests; the report names each non-passing
   test on its own line and summarizes the counts. Assert '1 passed' (only testPasses passes on
   every version) and that both the failing (#testFails) and erroring (#testErrors) tests are
   listed. We assert the FAIL marker but NOT ERROR: GS 3.6.2's TestResult can't distinguish
   errors from failures, so formatTestResult: labels every non-passing test FAIL there (3.7.x
   still shows ERROR for the real errors). includesCS: is case-sensitive, so 'FAIL' matches the
   line marker, not the word 'failed'."
  | out |
  self createTestSuiteFixture.
  out := self testingTools tool_run_test_class: (self oneArg: 'className' value: 'McpTestSuiteFixture').
  self assert: (self includesCS: '1 passed' in: out).
  self assert: (self includesCS: 'FAIL' in: out).
  self assert: (self includesCS: '#testFails' in: out).
  self assert: (self includesCS: '#testErrors' in: out)
%
category: 'tools - testing'
method: McpToolTest
testRunTestMethod
  "A passing method reports a pass with no FAIL line; a failing method reports a FAIL line.
   includesCS: is case-sensitive, so the deny of 'FAIL' on the passing run is correct: it does
   NOT match the word 'failed' in the count summary."
  | pass fail |
  self createTestSuiteFixture.
  pass := self testingTools tool_run_test_method:
    (Dictionary new at: 'className' put: 'McpTestSuiteFixture'; at: 'selector' put: 'testPasses'; yourself).
  self assert: (self includesCS: '1 passed' in: pass).
  self deny: (self includesCS: 'FAIL' in: pass).
  fail := self testingTools tool_run_test_method:
    (Dictionary new at: 'className' put: 'McpTestSuiteFixture'; at: 'selector' put: 'testFails'; yourself).
  self assert: (self includesCS: '1 failed' in: fail).
  self assert: (self includesCS: 'FAIL' in: fail).
  self assert: (self includesCS: '#testFails' in: fail)
%
category: 'tools - testing'
method: McpToolTest
testRunTestToolsRefuseAViewMovingSuiteWhenWorkIsPending
  "The guard, through the tools a client actually calls. Both run tools refuse a suite that declares
   it moves the session's transaction, while this session has work that move would take with it.
   McpTransactionTest is the subject because it is always installed and its #movesTheSessionView is
   the irreducible case -- if the guard ever stopped firing, THAT suite running here would abort
   this very test's transaction, which is the loss the guard exists to prevent."
  | onClass onMethod |
  System abortTransaction.
  UserGlobals at: #McpGuardProbe put: 'planted'.
  onClass := [self testingTools tool_run_test_class:
    (self oneArg: 'className' value: 'McpTransactionTest'). nil] on: McpError do: [:ex | ex].
  onMethod := [self testingTools tool_run_test_method: (Dictionary new
    at: 'className' put: 'McpTransactionTest';
    at: 'selector' put: 'testAbortIsTheWayOutAndSaysNothingElse'; yourself). nil]
      on: McpError do: [:ex | ex].
  self assert: onClass notNil.
  self assert: onClass kind equals: #refused.
  self assert: (self includesCS: 'McpTransactionTest' in: onClass description).
  self assert: (self includesCS: 'uncommitted changes' in: onClass description).
  self assert: onMethod notNil.
  self assert: onMethod kind equals: #refused.
  "and the work it protected is still here"
  self assert: (UserGlobals at: #McpGuardProbe ifAbsent: [nil]) equals: 'planted'
%
category: 'tools - search'
method: McpToolTest
testSearchMethodSource
  | out |
  self createFixtureClass.
  out := self searchTools tool_search_method_source:
    (Dictionary new at: 'pattern' put: 'probeAnswerBody'; at: 'dictionaryName' put: 'UserGlobals'; yourself).
  self assert: (self includesCS: 'McpTestFixture>>probeAnswer' in: out)
%
category: 'tools - search'
method: McpToolTest
testSearchMethodSourceTruncated
  "'self' appears in far more than 200 kernel methods, so scoping to Globals overflows the cap:
   the output is prefixed with the truncation note and holds exactly 200 hit lines (the note
   line has no '>>', so counting '>>' lines is robust)."
  | out lines hitLines |
  out := self searchTools tool_search_method_source:
    (Dictionary new at: 'pattern' put: 'self'; at: 'dictionaryName' put: 'Globals'; yourself).
  self assert: (self includesCS: '(truncated at 200 hits)' in: out).
  lines := out subStrings: (String with: Character lf).
  hitLines := lines select: [:l | self includesCS: '>>' in: l].
  self assert: hitLines size = 200
%
category: 'tools - testing'
method: McpToolTest
testSessionViewGuardFiresOnTheSessionAndNotOnTheSuite
  "Which suite it is does not decide this -- the session does. The same suite refused above is
   allowed the moment there is nothing to lose, and a suite that declares nothing is never gated
   either way. Asserting on the policy directly rather than through a tool keeps this test from
   having to run a real view-moving suite to find out."
  System abortTransaction.
  self assert: (McpTestingToolset sessionViewRefusalFor: McpTransactionTest) isNil.
  self assert: (McpTestingToolset sessionViewRefusalFor: McpOutboxTest) isNil.
  UserGlobals at: #McpGuardProbe put: 'planted'.
  self assert: (McpTestingToolset sessionViewRefusalFor: McpTransactionTest) notNil.
  self assert: (McpTestingToolset sessionViewRefusalFor: McpOutboxTest) isNil
%
category: 'tools - mutation'
method: McpToolTest
testSetClassComment
  | out |
  self createFixtureClass.
  out := self mutationTools tool_set_class_comment:
    (Dictionary new at: 'className' put: 'McpTestFixture'; at: 'comment' put: 'hello there'; yourself).
  self assert: (self includesCS: 'Comment set on McpTestFixture' in: out).
  self assert: (System myUserProfile objectNamed: #McpTestFixture) comment equals: 'hello there'
%
category: 'tools - session'
method: McpToolTest
testStatus
  self assert: (self includesCS: 'user=' in: (self sessionTools tool_status: Dictionary new))
%
category: 'tools - testing'
method: McpToolTest
testTestingToolsClassNotFound
  "The testing tools that resolve a class name report 'Class not found:' for an unknown class
   rather than erroring. 'Foo-Bar' is not a legal identifier, so it can never resolve."
  | badClass badMethod |
  badClass := self oneArg: 'className' value: 'Foo-Bar'.
  badMethod := Dictionary new at: 'className' put: 'Foo-Bar'; at: 'selector' put: 'testAnything'; yourself.
  self assert: (self testingTools tool_run_test_class: badClass) = 'Class not found: Foo-Bar'.
  self assert: (self testingTools tool_run_test_method: badMethod) = 'Class not found: Foo-Bar'.
  self assert: (self testingTools tool_describe_test_failure: badMethod) = 'Class not found: Foo-Bar'
%
category: 'helpers'
method: McpToolTest
toolsetOfClass: aToolsetClass
  "The toolset of aToolsetClass belonging to a fresh full-surface server -- the receiver its
   registered blocks send the tool_* handler to, so a handler test drives it exactly as a real
   tools/call does. Built through McpServer so the toolset has its server: a mutation handler asks
   the server for the kernel guard (see McpMutationToolset)."
  ^McpServer new toolsets detect: [:ts | ts class == aToolsetClass]
%
