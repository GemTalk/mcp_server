set compile_env: 0
! ------------------- Class definition for McpContractTest
expectvalue /Class
doit
GsTestCase subclass: 'McpContractTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpContractTest comment: 
'Contract / property tests over the MCP tool surface, driven through McpDispatcher>>handle: (the
real JSON-RPC envelope). Covers the schema-strictness, argument-validation, structured-error, and
kernel-guard behaviors: every tool schema is closed; unknown/missing args are -32602; a raised
error carries a structured kind; and mutating a kernel class is refused. Read-only and prompt
properties are added as those phases land.'
%
expectvalue /Class
doit
McpContractTest category: 'MCPServer'
%
! ------------------- Remove existing behavior from McpContractTest
removeallmethods McpContractTest
removeallclassmethods McpContractTest
! ------------------- Class methods for McpContractTest
! ------------------- Instance methods for McpContractTest
category: 'helpers'
method: McpContractTest
dispatch: requestDict
  "Route requestDict through a fresh dispatcher over a fresh server's registry."
  ^(McpDispatcher withToolRegistry: McpServer new toolRegistry) handle: requestDict
%
category: 'helpers'
method: McpContractTest
includesCS: aSubstring in: aString
  "Case-sensitive substring test (String>>includesString: is case-INsensitive in GemStone)."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'helpers'
method: McpContractTest
request: methodName params: paramsDict
  | d |
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'id' put: 1.
  d at: 'method' put: methodName.
  paramsDict ifNotNil: [d at: 'params' put: paramsDict].
  ^d
%
category: 'tests - guard'
method: McpContractTest
testAssertMutableClassRaisesRefused
  "#2: the guard signals an McpError kinded #refused (and mutates nothing)."
  | kind |
  kind := [McpServer new assertMutableClass: Object. #noRaise]
    on: McpError do: [:e | e kind].
  self assert: kind equals: #refused
%
category: 'tests - registry'
method: McpContractTest
testEveryDescriptorIsWellFormed
  "Every tools/list descriptor has a non-empty name + description and an inputSchema."
  | descriptors |
  descriptors := McpServer new toolRegistry descriptors.
  self assert: descriptors notEmpty.
  descriptors do: [:d |
    self assert: (d includesKey: 'name').      self deny: (d at: 'name') isEmpty.
    self assert: (d includesKey: 'description'). self deny: (d at: 'description') isEmpty.
    self assert: (d includesKey: 'inputSchema')]
%
category: 'tests - registry'
method: McpContractTest
testEverySchemaIsClosed
  "#4: every tool's inputSchema is an object with additionalProperties:false, so unknown arguments
   are detectable rather than silently dropped."
  McpServer new toolRegistry descriptors do: [:d | | schema |
    schema := d at: 'inputSchema'.
    self assert: (schema at: 'type') equals: 'object'.
    self assert: (schema at: 'additionalProperties' ifAbsent: [true]) == false]
%
category: 'tests - guard'
method: McpContractTest
testKernelMutationRefusedThroughEnvelope
  "#2 end-to-end: compile_method on a kernel class is refused as an isError result with kind
   #refused, and adds no method to the kernel class."
  | result |
  result := (self dispatch: (self toolCall: 'compile_method' args:
    (Dictionary new
      at: 'className' put: 'Object';
      at: 'source' put: 'mcpKernelGuardProbe ^1';
      yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'structuredContent') at: 'error') at: 'kind') equals: 'refused'.
  self deny: (Object canUnderstand: #mcpKernelGuardProbe)
%
category: 'tests - validation'
method: McpContractTest
testMissingRequiredArgumentRejected
  "#4: a missing required argument -> -32602."
  | resp |
  resp := self dispatch: (self toolCall: 'describe_class' args: Dictionary new).
  self assert: ((resp at: 'error') at: 'code') equals: -32602
%
category: 'tests - guard'
method: McpContractTest
testProtectedClassPredicate
  "#2: a class whose home dictionary is Globals (the base classes) is protected; a class in a user
   dictionary is not. Uses a throwaway class created in UserGlobals (per the McpToolTest fixture
   convention)."
  | s probe |
  s := McpServer new.
  self assert: (s isProtectedClass: Object).
  probe := Object subclass: 'McpProtectedProbe'
    instVarNames: #() classVars: #() classInstVars: #()
    poolDictionaries: #() inDictionary: UserGlobals options: #().
  [self deny: (s isProtectedClass: probe)]
    ensure: [UserGlobals removeKey: #McpProtectedProbe ifAbsent: [nil]]
%
category: 'tests - errors'
method: McpContractTest
testRaisedErrorCarriesStructuredKind
  "#10: a tool that raises yields an isError result whose content keeps the real message AND whose
   structuredContent.error carries a machine-readable kind."
  | result struct |
  result := (self dispatch: (self toolCall: 'execute_code' args:
    (Dictionary new at: 'code' put: '1/0'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (self includesCS: 'ZeroDivide' in: ((result at: 'content') first at: 'text')).
  struct := result at: 'structuredContent'.
  self assert: ((struct at: 'error') includesKey: 'kind').
  self deny: ((struct at: 'error') at: 'message') isEmpty
%
category: 'tests - errors'
method: McpContractTest
testSyntaxErrorClassifiedAsCompileError
  "#10: a transpile-time (syntax / undefined-name) error is classified 'compileError' -- distinct
   from a runtime error, which is 'other' -- so an agent can tell repair-worthy from retry-worthy."
  | result |
  result := (self dispatch: (self toolCall: 'execute_code' args:
    (Dictionary new at: 'code' put: '1 +'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'structuredContent') at: 'error') at: 'kind') equals: 'compileError'
%
category: 'tests - validation'
method: McpContractTest
testUnknownArgumentRejected
  "#4: an argument not in the schema -> -32602 with data.kind invalidParams (before any side effect)."
  | resp err |
  resp := self dispatch: (self toolCall: 'describe_class' args:
    (Dictionary new at: 'className' put: 'Object'; at: 'bogus' put: 'x'; yourself)).
  err := resp at: 'error'.
  self assert: (err at: 'code') equals: -32602.
  self assert: ((err at: 'data') at: 'kind') equals: 'invalidParams'
%
category: 'tests - validation'
method: McpContractTest
testValidArgumentsAccepted
  "A well-formed call is not rejected by validation (describe_class is read-only -> not isError)."
  | result |
  result := (self dispatch: (self toolCall: 'describe_class' args:
    (Dictionary new at: 'className' put: 'Object'; yourself))) at: 'result'.
  self deny: (result at: 'isError')
%
category: 'helpers'
method: McpContractTest
toolCall: toolName args: argsDict
  ^self request: 'tools/call' params:
    (Dictionary new at: 'name' put: toolName; at: 'arguments' put: argsDict; yourself)
%
