"
The SUnit tools: list TestCase subclasses, run a class or a single method, list the failing tests,
and re-run one test for its failure detail.

All read-only-safe, which is worth stating plainly: running a test executes code, but a read-only
session forbids execute_code and every mutation tool, so no NEW code can be introduced in that
session -- a test can only run already-committed (trusted) code.
"
Class {
	#name : 'McpTestingToolset',
	#superclass : 'McpToolset',
	#category : 'Mcp-Core'
}

{ #category : 'private' }
McpTestingToolset >> formatTestResult: aTestResult label: aLabel [
  "Summary line plus one line per non-passing test. GemStone's TestResult reports each failure/
   error as a descriptive String (e.g. 'SomeTest debug: #testFoo'); emit those.
   Cross-version: GS 3.6.2's TestResult returns the SAME set from #failures and #errors (and an
   inflated #runCount), so label #failures FAIL and only the #errors NOT already in #failures as
   ERROR, and derive run = passed + failed + errorOnly. (Neither collection repeats a test
   internally, so the reject: is the only de-duplication needed.) On 3.7.x the two sets are
   disjoint, so output is unchanged there; on 3.6.2 (where everything lands in #failures) all
   non-passing tests read as FAIL. Never use aTestResult printString: its printOn: varies by
   SUnit version and can send #shouldPass to the String entries, raising an MNU."
  | failed errorOnly passed s |
  failed := aTestResult failures collect: [:t | t asString].
  errorOnly := (aTestResult errors collect: [:t | t asString])
    reject: [:k | failed includes: k].
  passed := aTestResult passedCount.
  s := WriteStream on: String new.
  s nextPutAll: aLabel; nextPutAll: ': '.
  s nextPutAll: (passed + failed size + errorOnly size) printString; nextPutAll: ' run, '.
  s nextPutAll: passed printString; nextPutAll: ' passed, '.
  s nextPutAll: failed size printString; nextPutAll: ' failed, '.
  s nextPutAll: errorOnly size printString; nextPutAll: ' errors'.
  (failed isEmpty and: [errorOnly isEmpty]) ifFalse: [
    s nextPut: Character lf.
    failed asSortedCollection do: [:k | s nextPutAll: '  FAIL  '; nextPutAll: k; nextPut: Character lf].
    errorOnly asSortedCollection do: [:k | s nextPutAll: '  ERROR '; nextPutAll: k; nextPut: Character lf]].
  ^s contents

]

{ #category : 'read-only' }
McpTestingToolset >> readOnlySafeToolNames [
  "All of them -- see the class comment on why running a test is safe in a read-only session."
  ^self toolNames

]

{ #category : 'registration' }
McpTestingToolset >> registerOn: aToolRegistry [
  | noArgs classArg methodArg |
  noArgs := self objectSchema: Dictionary new required: #().
  classArg := self objectSchema:
    (Dictionary new at: 'className' put: (self propString: 'Name of the TestCase subclass'); yourself)
    required: (Array with: 'className').
  methodArg := self objectSchema:
    (Dictionary new
      at: 'className' put: (self propString: 'Name of the TestCase subclass');
      at: 'selector' put: (self propString: 'Test method selector, e.g. testFoo');
      yourself)
    required: (Array with: 'className' with: 'selector').
  aToolRegistry name: 'describe_test_failure'
    description: 'Re-run a single test method and return the failure or error detail.'
    inputSchema: methodArg do: [:args | self tool_describe_test_failure: args].
  aToolRegistry name: 'list_failing_tests'
    description: 'Run test classes (a given list, or all TestCase subclasses) and list only the failing/erroring test methods.'
    inputSchema: (self objectSchema:
      (Dictionary new at: 'classNames' put:
        (Dictionary new at: 'type' put: 'array';
          at: 'items' put: (Dictionary new at: 'type' put: 'string'; yourself);
          at: 'description' put: 'Optional: TestCase subclass names to run (default: all)'; yourself);
        yourself)
      required: #())
    do: [:args | self tool_list_failing_tests: args].
  aToolRegistry name: 'list_test_classes'
    description: 'List all TestCase subclasses in the symbol list.'
    inputSchema: noArgs do: [:args | self tool_list_test_classes: args].
  aToolRegistry name: 'run_test_class'
    description: 'Run all test methods in a TestCase subclass and report the result.'
    inputSchema: classArg do: [:args | self tool_run_test_class: args].
  aToolRegistry name: 'run_test_method'
    description: 'Run a single test method and report the result.'
    inputSchema: methodArg do: [:args | self tool_run_test_method: args].
  ^self

]

{ #category : 'tools - testing' }
McpTestingToolset >> tool_describe_test_failure: args [
  "Re-run one test in isolation (runCase lets the exception propagate instead of being swallowed
   by TestCase>>run) and report the failure detail. Uses ex description -- which for a
   MessageNotUnderstood spells out the error number, the receiver's class, and the missing
   selector -- rather than ex messageText, which is nil for a DNU."
  | cls sel label |
  cls := self resolveClass: (args at: 'className').
  cls isNil ifTrue: [^'Class not found: ' , (args at: 'className')].
  sel := (args at: 'selector') asSymbol.
  label := (args at: 'className') , '>>' , (args at: 'selector').
  ^[(cls selector: sel) runCase. label , ' passed (no failure).']
    on: Error, TestFailure
    do: [:ex | | detail |
      detail := [ex description] on: Error do: [:e | ex messageText ifNil: ['(no detail available)']].
      label , ' - ' , ex class name asString , ': ' , detail asString]

]

{ #category : 'tools - testing' }
McpTestingToolset >> tool_list_failing_tests: args [
  | names classes out |
  classes := OrderedCollection new.
  names := args at: 'classNames' ifAbsent: [nil].
  names isNil
    ifTrue: [classes addAll: (ClassOrganizer new allSubclassesOf: (System myUserProfile objectNamed: #TestCase))]
    ifFalse: [names do: [:n | | c | c := self resolveClass: n. c ifNotNil: [classes add: c]]].
  out := WriteStream on: String new.
  classes do: [:cls | | res |
    res := cls suite run.
    res failures do: [:t | out nextPutAll: 'FAIL  '; nextPutAll: t asString; nextPut: Character lf].
    res errors do: [:t | out nextPutAll: 'ERROR '; nextPutAll: t asString; nextPut: Character lf]].
  ^out contents isEmpty ifTrue: ['(no failing tests)'] ifFalse: [out contents]

]

{ #category : 'tools - testing' }
McpTestingToolset >> tool_list_test_classes: args [
  | tc |
  tc := System myUserProfile objectNamed: #TestCase.
  ^tc isNil
    ifTrue: ['TestCase is not available in this image.']
    ifFalse: [self linesFrom: ((ClassOrganizer new allSubclassesOf: tc) collect: [:c | c name asString])]

]

{ #category : 'tools - testing' }
McpTestingToolset >> tool_run_test_class: args [
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [self formatTestResult: cls suite run label: cls name asString]

]

{ #category : 'tools - testing' }
McpTestingToolset >> tool_run_test_method: args [
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [self formatTestResult: (cls selector: (args at: 'selector') asSymbol) run
      label: (args at: 'className') , '>>' , (args at: 'selector')]

]

{ #category : 'accessing' }
McpTestingToolset >> toolNames [
  ^#( 'describe_test_failure' 'list_failing_tests' 'list_test_classes' 'run_test_class'
      'run_test_method' )

]
