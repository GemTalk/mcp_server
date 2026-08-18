"
The SUnit tools: list TestCase subclasses, run a class or a single method, list the failing tests,
and re-run one test for its failure detail.

All read-only-safe, which is worth stating plainly: running a test executes code, but a read-only
session forbids execute_code and every mutation tool, so no NEW code can be introduced in that
session -- a test can only run already-committed (trusted) code.

Handlers still live on McpServer (category 'tools - testing'); see McpToolset's class comment on that
transitional seam.
"
Class {
	#name : 'McpTestingToolset',
	#superclass : 'McpToolset',
	#category : 'Mcp-Core'
}

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
    inputSchema: methodArg do: [:args | server tool_describe_test_failure: args].
  aToolRegistry name: 'list_failing_tests'
    description: 'Run test classes (a given list, or all TestCase subclasses) and list only the failing/erroring test methods.'
    inputSchema: (self objectSchema:
      (Dictionary new at: 'classNames' put:
        (Dictionary new at: 'type' put: 'array';
          at: 'items' put: (Dictionary new at: 'type' put: 'string'; yourself);
          at: 'description' put: 'Optional: TestCase subclass names to run (default: all)'; yourself);
        yourself)
      required: #())
    do: [:args | server tool_list_failing_tests: args].
  aToolRegistry name: 'list_test_classes'
    description: 'List all TestCase subclasses in the symbol list.'
    inputSchema: noArgs do: [:args | server tool_list_test_classes: args].
  aToolRegistry name: 'run_test_class'
    description: 'Run all test methods in a TestCase subclass and report the result.'
    inputSchema: classArg do: [:args | server tool_run_test_class: args].
  aToolRegistry name: 'run_test_method'
    description: 'Run a single test method and report the result.'
    inputSchema: methodArg do: [:args | server tool_run_test_method: args].
  ^self

]

{ #category : 'accessing' }
McpTestingToolset >> toolNames [
  ^#( 'describe_test_failure' 'list_failing_tests' 'list_test_classes' 'run_test_class'
      'run_test_method' )

]
