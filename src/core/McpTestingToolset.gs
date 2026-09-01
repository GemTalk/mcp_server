set compile_env: 0
! ------------------- Class definition for McpTestingToolset
expectvalue /Class
doit
McpToolset subclass: 'McpTestingToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpTestingToolset comment: 
'The SUnit tools: list TestCase subclasses, run a class or a single method, list the failing tests,
and re-run one test for its failure detail.

All read-only-safe, which is worth stating plainly: running a test executes code, but a read-only
session forbids execute_code and every mutation tool, so no NEW code can be introduced in that
session -- a test can only run already-committed (trusted) code.'
%
expectvalue /Class
doit
McpTestingToolset category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpTestingToolset
removeallmethods McpTestingToolset
removeallclassmethods McpTestingToolset
! ------------------- Class methods for McpTestingToolset
! ------------------- Instance methods for McpTestingToolset
category: 'private'
method: McpTestingToolset
formatTestResult: aTestResult label: aLabel
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
%
category: 'read-only'
method: McpTestingToolset
readOnlySafeToolNames
  "All of them -- see the class comment on why running a test is safe in a read-only session."
  ^self toolNames
%
category: 'registration'
method: McpTestingToolset
registerOn: aToolRegistry
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
%
category: 'tools - testing'
method: McpTestingToolset
tool_describe_test_failure: args
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
%
category: 'tools - testing'
method: McpTestingToolset
tool_list_failing_tests: args
  | names classes out done |
  classes := OrderedCollection new.
  names := args at: 'classNames' ifAbsent: [nil].
  names isNil
    ifTrue: [classes addAll: (ClassOrganizer new allSubclassesOf: (System myUserProfile objectNamed: #TestCase))]
    ifFalse: [names do: [:n | | c | c := self resolveClass: n. c ifNotNil: [classes add: c]]].
  out := WriteStream on: String new.
  "Progress is reported per CLASS here, not per test: this tool's unit of work is a class, and a
   client watching it wants to know how many of the suites it named are done. Running EVERY TestCase
   subclass is the slowest thing this server can be asked to do."
  done := 0.
  classes do: [:cls | | res |
    res := cls suite run.
    done := done + 1.
    self progress: done of: classes size
      message: done printString , '/' , classes size printString , ' test classes'.
    res failures do: [:t | out nextPutAll: 'FAIL  '; nextPutAll: t asString; nextPut: Character lf].
    res errors do: [:t | out nextPutAll: 'ERROR '; nextPutAll: t asString; nextPut: Character lf]].
  ^out contents isEmpty ifTrue: ['(no failing tests)'] ifFalse: [out contents]
%
category: 'tools - testing'
method: McpTestingToolset
tool_list_test_classes: args
  | tc |
  tc := System myUserProfile objectNamed: #TestCase.
  ^tc isNil
    ifTrue: ['TestCase is not available in this image.']
    ifFalse: [self linesFrom: ((ClassOrganizer new allSubclassesOf: tc) collect: [:c | c name asString])]
%
category: 'tools - testing'
method: McpTestingToolset
tool_run_test_class: args
  "Deliberately NO per-test progress, though this is the tool that would benefit most.
   Reporting per test means iterating the suite here instead of letting TestSuite>>run do it, and
   measured on 3.7.5 that CHANGES THE COUNTS: a hand-rolled loop over `suite tests`, sending the same
   #run: to each test into a fresh TestResult, scored one more test passed than the framework's own
   run of the same suite and lost the selector from the failure labels. The cause was not identified.
   Whatever it is, a tool that miscounts test results is worse than a tool that reports its progress
   silently, so this waits for the mechanism to be understood -- probably a TestResult subclass that
   only OBSERVES, which cannot change what is counted.
   #tool_list_failing_tests: does report progress, per class, and needs no such change: it already
   loops over classes and calls the framework's run on each."
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [self formatTestResult: cls suite run label: cls name asString]
%
category: 'tools - testing'
method: McpTestingToolset
tool_run_test_method: args
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [self formatTestResult: (cls selector: (args at: 'selector') asSymbol) run
      label: (args at: 'className') , '>>' , (args at: 'selector')]
%
category: 'accessing'
method: McpTestingToolset
toolNames
  ^#( 'describe_test_failure' 'list_failing_tests' 'list_test_classes' 'run_test_class'
      'run_test_method' )
%
