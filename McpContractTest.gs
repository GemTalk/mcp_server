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
  "Route requestDict through a fresh dispatcher wired to its owning server, so read-only gating is
   exercised through the real path."
  | s |
  s := McpServer new.
  ^(McpDispatcher withToolRegistry: s toolRegistry server: s) handle: requestDict
%
category: 'helpers'
method: McpContractTest
includesCS: aSubstring in: aString
  "Case-sensitive substring test (String>>includesString: is case-INsensitive in GemStone)."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'helpers'
method: McpContractTest
listedToolNames
  "The tool names returned by tools/list through the (read-only-aware) dispatcher."
  ^(((self dispatch: (self request: 'tools/list' params: nil)) at: 'result') at: 'tools')
    collect: [:d | d at: 'name']
%
category: 'helpers'
method: McpContractTest
promptGet: promptName args: argsDict
  ^self request: 'prompts/get' params:
    (Dictionary new at: 'name' put: promptName; at: 'arguments' put: argsDict; yourself)
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
category: 'helpers'
method: McpContractTest
savingReadOnlyDo: aBlock
  "Run aBlock with the per-session read-only flag cleared BEFORE and after, so a read-only test
   starts clean and cannot leak the flag into other tests. Read-only is purely the per-session
   #McpReadOnly flag now -- there is no global switch to save/restore."
  SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil].
  ^[aBlock value] ensure: [SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil]]
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
category: 'tests - prompts'
method: McpContractTest
testInitializeAdvertisesPromptsCapability
  "#9: initialize advertises the prompts capability alongside tools."
  | caps |
  caps := ((self dispatch: (self request: 'initialize' params: Dictionary new)) at: 'result') at: 'capabilities'.
  self assert: (caps includesKey: 'tools').
  self assert: (caps includesKey: 'prompts')
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
category: 'tests - read-only'
method: McpContractTest
testNotReadOnlyByDefault
  "Sanity: with the switch off, tools/list shows all 31 tools including the mutating ones."
  | names |
  names := self listedToolNames.
  self assert: names size equals: 31.
  self assert: (names includes: 'compile_method')
%
category: 'tests - prompts'
method: McpContractTest
testPromptsGetInterpolatesArgument
  "#9: an optional argument is woven into the prompt text."
  | content |
  content := (((self dispatch: (self promptGet: 'gemstone-tdd' args:
    (Dictionary new at: 'subject' put: 'a Foo widget'; yourself))) at: 'result')
      at: 'messages') first at: 'content'.
  self assert: (self includesCS: 'Foo widget' in: (content at: 'text'))
%
category: 'tests - prompts'
method: McpContractTest
testPromptsGetReturnsUserMessage
  "#9: prompts/get answers a description plus a user-role text message."
  | result msg |
  result := (self dispatch: (self promptGet: 'gemstone-transaction-hygiene' args: Dictionary new)) at: 'result'.
  self deny: (result at: 'description') isEmpty.
  msg := (result at: 'messages') first.
  self assert: (msg at: 'role') equals: 'user'.
  self deny: ((msg at: 'content') at: 'text') isEmpty
%
category: 'tests - prompts'
method: McpContractTest
testPromptsListReturnsWorkflows
  "#9: prompts/list returns the GemStone workflow prompts, each with a non-empty description."
  | prompts names |
  prompts := ((self dispatch: (self request: 'prompts/list' params: nil)) at: 'result') at: 'prompts'.
  names := prompts collect: [:p | p at: 'name'].
  self assert: (names includes: 'gemstone-transaction-hygiene').
  self assert: (names includes: 'gemstone-tdd').
  self assert: (names includes: 'gemstone-safe-change').
  prompts do: [:p | self deny: (p at: 'description') isEmpty]
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
category: 'tests - read-only'
method: McpContractTest
testReadOnlyAllowsSafeToolCall
  "#7: a safe (read) tool still works while read-only."
  self savingReadOnlyDo: [ | result |
    McpServer sessionReadOnly: true.
    result := (self dispatch: (self toolCall: 'describe_class' args:
      (Dictionary new at: 'className' put: 'Object'; yourself))) at: 'result'.
    self deny: (result at: 'isError')]
%
category: 'tests - read-only'
method: McpContractTest
testReadOnlyGatesDangerousToolCall
  "#7: a direct call to a gated tool is refused -32601 kind readOnly, before any validation or side
   effect. Targets a kernel class so a regression can't mutate anything even if the gate failed."
  self savingReadOnlyDo: [ | err |
    McpServer sessionReadOnly: true.
    err := (self dispatch: (self toolCall: 'compile_method' args:
      (Dictionary new at: 'className' put: 'Object'; at: 'source' put: 'x ^1'; yourself))) at: 'error'.
    self assert: (err at: 'code') equals: -32601.
    self assert: ((err at: 'data') at: 'kind') equals: 'readOnly']
%
category: 'tests - read-only'
method: McpContractTest
testReadOnlyGatesExecuteCode
  "#7: execute_code (arbitrary code -- the tool that most needs gating) is refused -32601 readOnly
   when the session is read-only."
  self savingReadOnlyDo: [ | err |
    McpServer sessionReadOnly: true.
    err := (self dispatch: (self toolCall: 'execute_code' args:
      (Dictionary new at: 'code' put: '1'; yourself))) at: 'error'.
    self assert: (err at: 'code') equals: -32601.
    self assert: ((err at: 'data') at: 'kind') equals: 'readOnly']
%
category: 'tests - read-only'
method: McpContractTest
testReadOnlyHidesDangerousToolsFromList
  "#7: read-only hides the gated (dangerous) tools from tools/list; safe tools remain."
  self savingReadOnlyDo: [ | names |
    McpServer sessionReadOnly: true.
    names := self listedToolNames.
    self deny: (names includes: 'compile_method').
    self deny: (names includes: 'execute_code').
    self deny: (names includes: 'commit').
    self assert: (names includes: 'describe_class').
    self assert: (names includes: 'status')]
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
category: 'tests - prompts'
method: McpContractTest
testUnknownPromptRejected
  "#9: prompts/get for an unknown name -> -32602."
  | resp |
  resp := self dispatch: (self promptGet: 'no-such-prompt' args: Dictionary new).
  self assert: ((resp at: 'error') at: 'code') equals: -32602
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
