"
Contract / property tests over the MCP tool surface, driven through McpDispatcher>>handle: (the
real JSON-RPC envelope). Covers the schema-strictness, argument-validation, structured-error, and
kernel-guard behaviors: every tool schema is closed; a raised error carries a structured kind; and
mutating a kernel class is refused. Also pins the MCP 2025-11-25 split between the two tools/call
failure envelopes -- arguments that violate a tool's own inputSchema are TOOL EXECUTION errors
(isError:true, so the model can self-correct), while a malformed request (no tool name) and an
unknown tool stay PROTOCOL errors (-32602). Read-only properties are added as those phases land.
"
Class {
	#name : 'McpContractTest',
	#superclass : 'GsTestCase',
	#category : 'Mcp-Tests'
}

{ #category : 'helpers' }
McpContractTest >> dispatch: requestDict [
  "Route requestDict through a fresh dispatcher wired to its owning server, so read-only gating is
   exercised through the real path."
  | s |
  s := McpServer new.
  ^(McpDispatcher withToolRegistry: s toolRegistry server: s) handle: requestDict

]

{ #category : 'helpers' }
McpContractTest >> includesCS: aSubstring in: aString [
  "Case-sensitive substring test (String>>includesString: is case-INsensitive in GemStone)."
  ^(aString findString: aSubstring startingAt: 1) > 0

]

{ #category : 'helpers' }
McpContractTest >> listedToolNames [
  "The tool names returned by tools/list through the (read-only-aware) dispatcher."
  ^(((self dispatch: (self request: 'tools/list' params: nil)) at: 'result') at: 'tools')
    collect: [:d | d at: 'name']

]

{ #category : 'helpers' }
McpContractTest >> request: methodName params: paramsDict [
  | d |
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'id' put: 1.
  d at: 'method' put: methodName.
  paramsDict ifNotNil: [d at: 'params' put: paramsDict].
  ^d

]

{ #category : 'helpers' }
McpContractTest >> savingReadOnlyDo: aBlock [
  "Run aBlock with the per-session read-only flag cleared BEFORE and after, so a read-only test
   starts clean and cannot leak the flag into other tests. Read-only is purely the per-session
   #McpReadOnly flag now -- there is no global switch to save/restore."
  SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil].
  ^[aBlock value] ensure: [SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil]]

]

{ #category : 'tests - guard' }
McpContractTest >> testAssertMutableClassRaisesRefused [
  "#2: the guard signals an McpError kinded #refused (and mutates nothing)."
  | kind |
  kind := [McpServer new assertMutableClass: Object. #noRaise]
    on: McpError do: [:e | e kind].
  self assert: kind equals: #refused

]

{ #category : 'tests - registry' }
McpContractTest >> testEveryDescriptorIsWellFormed [
  "Every tools/list descriptor has a non-empty name + description and an inputSchema."
  | descriptors |
  descriptors := McpServer new toolRegistry descriptors.
  self assert: descriptors notEmpty.
  descriptors do: [:d |
    self assert: (d includesKey: 'name').      self deny: (d at: 'name') isEmpty.
    self assert: (d includesKey: 'description'). self deny: (d at: 'description') isEmpty.
    self assert: (d includesKey: 'inputSchema')]

]

{ #category : 'tests - registry' }
McpContractTest >> testEverySchemaIsClosed [
  "#4: every tool's inputSchema is an object with additionalProperties:false, so unknown arguments
   are detectable rather than silently dropped."
  McpServer new toolRegistry descriptors do: [:d | | schema |
    schema := d at: 'inputSchema'.
    self assert: (schema at: 'type') equals: 'object'.
    self assert: (schema at: 'additionalProperties' ifAbsent: [true]) == false]

]

{ #category : 'tests - guard' }
McpContractTest >> testKernelMutationRefusedThroughEnvelope [
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

]

{ #category : 'tests - validation' }
McpContractTest >> testMissingRequiredArgumentRejected [
  "#4: a missing required argument fails the tool's inputSchema, so per MCP 2025-11-25 it is a TOOL
   EXECUTION error (isError:true) carrying actionable text, not a JSON-RPC protocol error."
  | result |
  result := (self dispatch: (self toolCall: 'describe_class' args: Dictionary new)) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (self includesCS: 'className'
    in: ((result at: 'content') first at: 'text'))

]

{ #category : 'tests - validation' }
McpContractTest >> testMissingToolNameIsProtocolError [
  "The boundary: a call with no `name` is a malformed CallToolRequest -- the REQUEST is wrong, not
   the arguments -- so it stays a protocol error (-32602), unlike an inputSchema violation."
  | resp |
  resp := self dispatch: (self request: 'tools/call' params: Dictionary new).
  self assert: ((resp at: 'error') at: 'code') equals: -32602.
  self assert: (((resp at: 'error') at: 'data') at: 'kind') equals: 'invalidParams'

]

{ #category : 'tests - validation' }
McpContractTest >> testNoArgumentToolReportsNoArguments [
  "A tool with an empty (closed) schema must not render an empty 'Allowed: ' list when it rejects
   an unknown argument -- it says so in words instead."
  | text |
  text := (((self dispatch: (self toolCall: 'status' args:
    (Dictionary new at: 'bogus' put: 1; yourself))) at: 'result') at: 'content') first at: 'text'.
  self assert: (self includesCS: 'takes no arguments' in: text).
  self deny: (self includesCS: 'Allowed:' in: text)

]

{ #category : 'tests - read-only' }
McpContractTest >> testNotReadOnlyByDefault [
  "Sanity: with the switch off, tools/list shows all 31 tools including the mutating ones."
  | names |
  names := self listedToolNames.
  self assert: names size equals: 31.
  self assert: (names includes: 'compile_method')

]

{ #category : 'tests - lifecycle' }
McpContractTest >> testPingReturnsEmptyResult [
  "MCP basic/utilities/ping is a MUST: the receiver MUST respond promptly with an EMPTY result.
   Not an error, not a tool -- so it is answered even though `ping` is in no tool registry."
  | resp |
  resp := self dispatch: (self request: 'ping' params: nil).
  self deny: (resp includesKey: 'error').
  self assert: (resp at: 'result') isEmpty

]

{ #category : 'tests - guard' }
McpContractTest >> testProtectedClassPredicate [
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

]

{ #category : 'tests - errors' }
McpContractTest >> testRaisedErrorCarriesStructuredKind [
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

]

{ #category : 'tests - read-only' }
McpContractTest >> testReadOnlyAllowsSafeToolCall [
  "#7: a safe (read) tool still works while read-only."
  self savingReadOnlyDo: [ | result |
    McpServer sessionReadOnly: true.
    result := (self dispatch: (self toolCall: 'describe_class' args:
      (Dictionary new at: 'className' put: 'Object'; yourself))) at: 'result'.
    self deny: (result at: 'isError')]

]

{ #category : 'tests - read-only' }
McpContractTest >> testReadOnlyGatesDangerousToolCall [
  "#7: a direct call to a gated tool is refused -32601 kind readOnly, before any validation or side
   effect. Targets a kernel class so a regression can't mutate anything even if the gate failed."
  self savingReadOnlyDo: [ | err |
    McpServer sessionReadOnly: true.
    err := (self dispatch: (self toolCall: 'compile_method' args:
      (Dictionary new at: 'className' put: 'Object'; at: 'source' put: 'x ^1'; yourself))) at: 'error'.
    self assert: (err at: 'code') equals: -32601.
    self assert: ((err at: 'data') at: 'kind') equals: 'readOnly']

]

{ #category : 'tests - read-only' }
McpContractTest >> testReadOnlyGatesExecuteCode [
  "#7: execute_code (arbitrary code -- the tool that most needs gating) is refused -32601 readOnly
   when the session is read-only."
  self savingReadOnlyDo: [ | err |
    McpServer sessionReadOnly: true.
    err := (self dispatch: (self toolCall: 'execute_code' args:
      (Dictionary new at: 'code' put: '1'; yourself))) at: 'error'.
    self assert: (err at: 'code') equals: -32601.
    self assert: ((err at: 'data') at: 'kind') equals: 'readOnly']

]

{ #category : 'tests - read-only' }
McpContractTest >> testReadOnlyHidesDangerousToolsFromList [
  "#7: read-only hides the gated (dangerous) tools from tools/list; safe tools remain."
  self savingReadOnlyDo: [ | names |
    McpServer sessionReadOnly: true.
    names := self listedToolNames.
    self deny: (names includes: 'compile_method').
    self deny: (names includes: 'execute_code').
    self deny: (names includes: 'commit').
    self assert: (names includes: 'describe_class').
    self assert: (names includes: 'status')]

]

{ #category : 'tests - errors' }
McpContractTest >> testSyntaxErrorClassifiedAsCompileError [
  "#10: a transpile-time (syntax / undefined-name) error is classified 'compileError' -- distinct
   from a runtime error, which is 'other' -- so an agent can tell repair-worthy from retry-worthy."
  | result |
  result := (self dispatch: (self toolCall: 'execute_code' args:
    (Dictionary new at: 'code' put: '1 +'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'structuredContent') at: 'error') at: 'kind') equals: 'compileError'

]

{ #category : 'tests - validation' }
McpContractTest >> testUnknownArgumentRejected [
  "#4: an argument not in the closed schema is refused BEFORE any side effect. Per MCP 2025-11-25
   the envelope is a tool execution error -- isError:true plus structuredContent.error.kind so an
   agent can still branch on the kind without parsing the prose."
  | result |
  result := (self dispatch: (self toolCall: 'describe_class' args:
    (Dictionary new at: 'className' put: 'Object'; at: 'bogus' put: 'x'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'structuredContent') at: 'error') at: 'kind') equals: 'invalidParams'.
  self assert: (self includesCS: 'bogus' in: ((result at: 'content') first at: 'text'))

]

{ #category : 'tests - validation' }
McpContractTest >> testUnknownToolIsProtocolError [
  "The other side of the boundary: an unknown tool stays a protocol error (-32602 / kind notFound).
   The spec keeps it there because the model cannot self-correct a tool that does not exist."
  | resp |
  resp := self dispatch: (self toolCall: 'no_such_tool' args: Dictionary new).
  self assert: ((resp at: 'error') at: 'code') equals: -32602.
  self assert: (((resp at: 'error') at: 'data') at: 'kind') equals: 'notFound'

]

{ #category : 'tests - validation' }
McpContractTest >> testValidArgumentsAccepted [
  "A well-formed call is not rejected by validation (describe_class is read-only -> not isError)."
  | result |
  result := (self dispatch: (self toolCall: 'describe_class' args:
    (Dictionary new at: 'className' put: 'Object'; yourself))) at: 'result'.
  self deny: (result at: 'isError')

]

{ #category : 'helpers' }
McpContractTest >> toolCall: toolName args: argsDict [
  ^self request: 'tools/call' params:
    (Dictionary new at: 'name' put: toolName; at: 'arguments' put: argsDict; yourself)

]
