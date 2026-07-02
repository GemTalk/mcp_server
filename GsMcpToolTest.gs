set compile_env: 0
! ------------------- Class definition for GsMcpToolTest
expectvalue /Class
doit
GsTestCase subclass: 'GsMcpToolTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: UserGlobals
  options: #()

%
! ------------------- Remove existing behavior from GsMcpToolTest
removeallmethods GsMcpToolTest
removeallclassmethods GsMcpToolTest
! ------------------- Class methods for GsMcpToolTest
! ------------------- Instance methods for GsMcpToolTest
category: 'helpers'
method: GsMcpToolTest
createFixtureClass
  "Create the throwaway fixture class (committed). tearDown removes it."
  | c |
  c := Object subclass: 'GsMcpTestFixture'
    instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #()
    inDictionary: UserGlobals options: #().
  c comment: 'Throwaway fixture created by GsMcpToolTest. Safe to remove.'.
  System commitTransaction.
  ^c
%
category: 'helpers'
method: GsMcpToolTest
mcp
  "A fresh server whose tool_* handlers we exercise directly (no socket)."
  ^GsMcpServer new
%
category: 'helpers'
method: GsMcpToolTest
oneArg: key value: value
  | d |
  d := Dictionary new.
  d at: key put: value.
  ^d
%
category: 'running'
method: GsMcpToolTest
tearDown
  "Force-remove any throwaway fixtures a test created, then commit, so nothing leaks."
  | up dict |
  up := System myUserProfile.
  #(GsMcpTestSub GsMcpTestFixture) do: [:sym |
    (up objectNamed: sym) ifNotNil: [:cls |
      (up dictionaryAndSymbolOf: cls) ifNotNil: [:arr | (arr at: 1) removeKey: (arr at: 2) ifAbsent: [nil]]]].
  dict := up symbolList detect: [:d | d name asString = 'GsMcpTestDict'] ifNone: [nil].
  dict ifNotNil: [up removeDictionaryAt: (up symbolList indexOf: dict)].
  UserGlobals removeKey: #GsMcpTestDict ifAbsent: [nil].
  UserGlobals removeKey: #GsMcpTestSub ifAbsent: [nil].
  UserGlobals removeKey: #GsMcpTestFixture ifAbsent: [nil].
  System commitTransaction
%
category: 'tools - session'
method: GsMcpToolTest
testAbort
  self assert: ((self mcp tool_abort: Dictionary new) includesString: 'aborted')
%
category: 'tools - listing'
method: GsMcpToolTest
testAddDictionary
  | out |
  out := self mcp tool_add_dictionary: (self oneArg: 'dictionaryName' value: 'GsMcpTestDict').
  self assert: (out includesString: 'Created dictionary').
  self assert: ((self mcp tool_list_dictionaries: Dictionary new) includesString: 'GsMcpTestDict')
%
category: 'tools - session'
method: GsMcpToolTest
testCommit
  self assert: ((self mcp tool_commit: Dictionary new) includesString: 'committed')
%
category: 'tools - mutation'
method: GsMcpToolTest
testCompileClassDefinition
  | out |
  out := self mcp tool_compile_class_definition: (self oneArg: 'source' value:
    'Object subclass: ''GsMcpTestFixture'' instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #()').
  self assert: (out includesString: 'committed class: GsMcpTestFixture').
  self assert: (System myUserProfile objectNamed: #GsMcpTestFixture) notNil
%
category: 'tools - mutation'
method: GsMcpToolTest
testCompileClassDefinitionPreservesMethods
  "Default recompileMethods=true: a shape change keeps the class's methods."
  | cls out |
  cls := Object subclass: 'GsMcpTestFixture' instVarNames: #(a) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #().
  cls compileMethod: 'getA ^a' dictionaries: System myUserProfile symbolList category: 'acc'.
  System commitTransaction.
  out := self mcp tool_compile_class_definition: (self oneArg: 'source' value:
    'Object subclass: ''GsMcpTestFixture'' instVarNames: #(a b) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #()').
  self assert: (out includesString: 'recompiled 1/1').
  self assert: ((System myUserProfile objectNamed: #GsMcpTestFixture) canUnderstand: #getA).
  self assert: ((System myUserProfile objectNamed: #GsMcpTestFixture) instVarNames includes: #b)
%
category: 'tools - mutation'
method: GsMcpToolTest
testCompileClassDefinitionRawWhenFlagFalse
  "recompileMethods=false reproduces the raw redefine: methods are dropped."
  | cls out |
  cls := Object subclass: 'GsMcpTestFixture' instVarNames: #(a) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #().
  cls compileMethod: 'getA ^a' dictionaries: System myUserProfile symbolList category: 'acc'.
  System commitTransaction.
  out := self mcp tool_compile_class_definition: (Dictionary new
    at: 'source' put: 'Object subclass: ''GsMcpTestFixture'' instVarNames: #(a b) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #()';
    at: 'recompileMethods' put: false; yourself).
  self deny: ((System myUserProfile objectNamed: #GsMcpTestFixture) canUnderstand: #getA)
%
category: 'tools - mutation'
method: GsMcpToolTest
testCompileClassDefinitionRefusesWithSubclasses
  "With recompile on (default), a class that has subclasses is refused rather than redefined."
  | cls out |
  cls := Object subclass: 'GsMcpTestFixture' instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #().
  cls subclass: 'GsMcpTestSub' instVarNames: #() classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #().
  System commitTransaction.
  out := self mcp tool_compile_class_definition: (self oneArg: 'source' value:
    'Object subclass: ''GsMcpTestFixture'' instVarNames: #(a) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #()').
  self assert: (out includesString: 'Refused').
  self assert: (out includesString: 'GsMcpTestSub')
%
category: 'tools - mutation'
method: GsMcpToolTest
testCompileClassDefinitionReportsRecompileFailure
  "A method that no longer compiles under the new shape is reported, but the redefinition
   (and the methods that did recompile) still applies."
  | cls out |
  cls := Object subclass: 'GsMcpTestFixture' instVarNames: #(a) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #().
  cls compileMethod: 'getA ^a' dictionaries: System myUserProfile symbolList category: 'acc'.
  cls compileMethod: 'withLocal | tmp | tmp := 5. ^tmp' dictionaries: System myUserProfile symbolList category: 'acc'.
  System commitTransaction.
  "adding ivar 'tmp' collides with withLocal's temporary -> that one fails to recompile"
  out := self mcp tool_compile_class_definition: (self oneArg: 'source' value:
    'Object subclass: ''GsMcpTestFixture'' instVarNames: #(a tmp) classVars: #() classInstVars: #() poolDictionaries: #() inDictionary: UserGlobals options: #()').
  self assert: (out includesString: 'failed').
  self assert: (out includesString: 'withLocal').
  self deny: ((System myUserProfile objectNamed: #GsMcpTestFixture) canUnderstand: #withLocal).
  self assert: ((System myUserProfile objectNamed: #GsMcpTestFixture) canUnderstand: #getA)
%
category: 'tools - mutation'
method: GsMcpToolTest
testCompileMethod
  | out |
  self createFixtureClass.
  out := self mcp tool_compile_method:
    (Dictionary new at: 'className' put: 'GsMcpTestFixture'; at: 'source' put: 'answer ^42'; at: 'category' put: 'tmp'; yourself).
  self assert: (out includesString: 'and committed').
  self assert: ((System myUserProfile objectNamed: #GsMcpTestFixture) canUnderstand: #answer)
%
category: 'tools - python'
method: GsMcpToolTest
testCompilePython
  self assert: ((self mcp tool_compile_python: (self oneArg: 'code' value: 'x = 1')) includesString: 'Grail')
%
category: 'tools - mutation'
method: GsMcpToolTest
testDeleteClass
  | out |
  self createFixtureClass.
  out := self mcp tool_delete_class: (self oneArg: 'className' value: 'GsMcpTestFixture').
  self assert: (out includesString: 'Deleted class').
  self assert: (System myUserProfile objectNamed: #GsMcpTestFixture) isNil
%
category: 'tools - mutation'
method: GsMcpToolTest
testDeleteMethod
  | out |
  self createFixtureClass.
  (System myUserProfile objectNamed: #GsMcpTestFixture)
    compileMethod: 'answer ^42' dictionaries: System myUserProfile symbolList category: 'tmp'.
  System commitTransaction.
  out := self mcp tool_delete_method:
    (Dictionary new at: 'className' put: 'GsMcpTestFixture'; at: 'selector' put: 'answer'; yourself).
  self assert: (out includesString: 'Deleted method').
  self deny: ((System myUserProfile objectNamed: #GsMcpTestFixture) canUnderstand: #answer)
%
category: 'tools - browsing'
method: GsMcpToolTest
testDescribeClass
  | out |
  out := self mcp tool_describe_class: (self oneArg: 'className' value: 'GsMcpTool').
  self assert: (out includesString: 'name=GsMcpTool').
  self assert: (out includesString: 'superclass=Object')
%
category: 'tools - testing'
method: GsMcpToolTest
testDescribeTestFailureOnPassingTest
  self assert: ((self mcp tool_describe_test_failure:
    (Dictionary new at: 'className' put: 'SUnitTest'; at: 'selector' put: 'testAssert'; yourself)) includesString: 'passed')
%
category: 'tools - python'
method: GsMcpToolTest
testEvalPython
  self assert: ((self mcp tool_eval_python: (self oneArg: 'code' value: 'print(1)')) includesString: 'Grail')
%
category: 'tools - execution'
method: GsMcpToolTest
testExecuteCode
  self assert: (self mcp tool_execute_code: (self oneArg: 'code' value: '3 + 4')) equals: '7'
%
category: 'tools - execution'
method: GsMcpToolTest
testExecuteCodeMultiStatement
  self assert: (self mcp tool_execute_code: (self oneArg: 'code' value: '| x | x := 6. x * 7')) equals: '42'
%
category: 'tools - browsing'
method: GsMcpToolTest
testExportClassSource
  | src |
  src := self mcp tool_export_class_source: (self oneArg: 'className' value: 'GsMcpTool').
  self assert: (src includesString: 'Object subclass: ''GsMcpTool''').
  self assert: (src includesString: 'removeallmethods GsMcpTool')
%
category: 'tools - search'
method: GsMcpToolTest
testFindImplementors
  self assert: ((self mcp tool_find_implementors: (self oneArg: 'selector' value: 'runOnPort:')) includesString: 'GsMcpServer>>runOnPort:')
%
category: 'tools - search'
method: GsMcpToolTest
testFindReferencesTo
  self assert: ((self mcp tool_find_references_to: (self oneArg: 'name' value: 'GsMcpTool')) includesString: 'GsMcpToolRegistry')
%
category: 'tools - search'
method: GsMcpToolTest
testFindSenders
  "serveGetStream: is sent from the GET route block in buildRoutes."
  self assert: ((self mcp tool_find_senders: (self oneArg: 'selector' value: 'serveGetStream:')) includesString: 'buildRoutes')
%
category: 'tools - browsing'
method: GsMcpToolTest
testGetClassDefinition
  | def |
  def := self mcp tool_get_class_definition: (self oneArg: 'className' value: 'GsMcpServer').
  self assert: (def includesString: 'Object subclass: ''GsMcpServer''').
  self deny: (def includesString: 'removeallmethods GsMcpServer')
%
category: 'tools - browsing'
method: GsMcpToolTest
testGetClassHierarchy
  | out |
  out := self mcp tool_get_class_hierarchy: (self oneArg: 'className' value: 'Boolean').
  self assert: (out includesString: 'Object').
  self assert: (out includesString: 'FalseClass')
%
category: 'tools - browsing'
method: GsMcpToolTest
testGetMethodSource
  | out |
  out := self mcp tool_get_method_source:
    (Dictionary new at: 'className' put: 'GsMcpTool'; at: 'selector' put: 'name'; yourself).
  self assert: (out includesString: '^name')
%
category: 'tools - listing'
method: GsMcpToolTest
testListAllClasses
  self assert: ((self mcp tool_list_all_classes: Dictionary new) includesString: 'GsMcpServer  (UserGlobals)')
%
category: 'tools - listing'
method: GsMcpToolTest
testListClasses
  self assert: ((self mcp tool_list_classes: (self oneArg: 'dictionaryName' value: 'UserGlobals')) includesString: 'GsMcpServer')
%
category: 'tools - listing'
method: GsMcpToolTest
testListDictionaries
  self assert: ((self mcp tool_list_dictionaries: Dictionary new) includesString: 'UserGlobals')
%
category: 'tools - listing'
method: GsMcpToolTest
testListDictionaryEntries
  self assert: ((self mcp tool_list_dictionary_entries: (self oneArg: 'dictionaryName' value: 'UserGlobals')) includesString: '(class)')
%
category: 'tools - testing'
method: GsMcpToolTest
testListFailingTests
  self assert: ((self mcp tool_list_failing_tests:
    (self oneArg: 'classNames' value: (Array with: 'SUnitTest'))) includesString: 'no failing tests')
%
category: 'tools - browsing'
method: GsMcpToolTest
testListMethods
  self assert: ((self mcp tool_list_methods: (self oneArg: 'className' value: 'GsMcpServer')) includesString: 'runOnPort:')
%
category: 'tools - testing'
method: GsMcpToolTest
testListTestClasses
  self assert: ((self mcp tool_list_test_classes: Dictionary new) includesString: 'SUnitTest')
%
category: 'tools - session'
method: GsMcpToolTest
testRefresh
  self assert: ((self mcp tool_refresh: Dictionary new) includesString: 'refreshed')
%
category: 'tools - listing'
method: GsMcpToolTest
testRemoveDictionary
  | out |
  self mcp tool_add_dictionary: (self oneArg: 'dictionaryName' value: 'GsMcpTestDict').
  out := self mcp tool_remove_dictionary: (self oneArg: 'dictionaryName' value: 'GsMcpTestDict').
  self assert: (out includesString: 'Removed dictionary').
  self deny: ((self mcp tool_list_dictionaries: Dictionary new) includesString: 'GsMcpTestDict')
%
category: 'tools - testing'
method: GsMcpToolTest
testRunTestClass
  self assert: ((self mcp tool_run_test_class: (self oneArg: 'className' value: 'SUnitTest')) includesString: 'passed')
%
category: 'tools - testing'
method: GsMcpToolTest
testRunTestMethod
  self assert: ((self mcp tool_run_test_method:
    (Dictionary new at: 'className' put: 'SUnitTest'; at: 'selector' put: 'testAssert'; yourself)) includesString: '1 run')
%
category: 'tools - search'
method: GsMcpToolTest
testSearchMethodSource
  | out |
  out := self mcp tool_search_method_source:
    (Dictionary new at: 'pattern' put: 'writeSseStreamHeaders'; at: 'dictionaryName' put: 'UserGlobals'; yourself).
  self assert: (out includesString: 'serveGetStream:')
%
category: 'tools - browsing'
method: GsMcpToolTest
testSetClassComment
  | out |
  self createFixtureClass.
  out := self mcp tool_set_class_comment:
    (Dictionary new at: 'className' put: 'GsMcpTestFixture'; at: 'comment' put: 'hello there'; yourself).
  self assert: (out includesString: 'committed').
  self assert: (System myUserProfile objectNamed: #GsMcpTestFixture) comment equals: 'hello there'
%
category: 'tools - session'
method: GsMcpToolTest
testStatus
  self assert: ((self mcp tool_status: Dictionary new) includesString: 'user=')
%
