set compile_env: 0
! ------------------- Class definition for McpDispatcherTest
expectvalue /Class
doit
GsTestCase subclass: 'McpDispatcherTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpDispatcherTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpDispatcherTest
removeallmethods McpDispatcherTest
removeallclassmethods McpDispatcherTest
! ------------------- Class methods for McpDispatcherTest
! ------------------- Instance methods for McpDispatcherTest
category: 'helpers'
method: McpDispatcherTest
dispatch: requestDict
  "Route requestDict through a fresh dispatcher; answer the response Dictionary (or nil)."
  ^(McpDispatcher withToolRegistry: McpServer new toolRegistry) handle: requestDict
%
category: 'helpers'
method: McpDispatcherTest
notification: methodName
  "A JSON-RPC notification (no id)."
  | d |
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'method' put: methodName.
  ^d
%
category: 'helpers'
method: McpDispatcherTest
request: methodName params: paramsDict
  | d |
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'id' put: 1.
  d at: 'method' put: methodName.
  paramsDict ifNotNil: [d at: 'params' put: paramsDict].
  ^d
%
category: 'tests'
method: McpDispatcherTest
testHandleJsonString
  "The worker entry (McpServer class>>handleJsonString:) parses + dispatches a raw JSON-RPC
   request in a per-gem worker instance and answers the response string; a notification -> ''."
  | out |
  "Clear the cached worker instance before and after: SessionTemps outlives each test, so a server
   left here would be reused by any later test that drives this entry -- with a different surface."
  SessionTemps current removeKey: #McpServer ifAbsent: [nil].
  [out := McpServer handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'.
   self assert: (out includesString: '"tools"').
   self assert: (McpServer handleJsonString: '{"jsonrpc":"2.0","method":"notifications/initialized"}') isEmpty]
     ensure: [SessionTemps current removeKey: #McpServer ifAbsent: [nil]]
%
category: 'tests'
method: McpDispatcherTest
testInitialize
  "With no requested protocolVersion, initialize answers our preferred (latest) supported version."
  | result |
  result := (self dispatch: (self request: 'initialize' params: Dictionary new)) at: 'result'.
  self assert: (result at: 'protocolVersion') equals: '2025-11-25'.
  self assert: ((result at: 'serverInfo') at: 'name') equals: 'gemstone-mcp'.
  self assert: ((result at: 'capabilities') includesKey: 'tools')
%
category: 'tests'
method: McpDispatcherTest
testInitializeFallsBackForUnsupportedVersion
  "An unsupported requested protocolVersion falls back to our preferred (latest) version. 2025-03-26
   is unsupported on purpose: it mandates receiving JSON-RPC batches, which we don't handle."
  | result |
  result := (self dispatch: (self request: 'initialize' params:
    (Dictionary new at: 'protocolVersion' put: '2025-03-26'; yourself))) at: 'result'.
  self assert: (result at: 'protocolVersion') equals: '2025-11-25'
%
category: 'tests'
method: McpDispatcherTest
testInitializeNegotiatesRequestedVersion
  "A supported requested protocolVersion is echoed back (MCP version negotiation)."
  | result |
  result := (self dispatch: (self request: 'initialize' params:
    (Dictionary new at: 'protocolVersion' put: '2025-06-18'; yourself))) at: 'result'.
  self assert: (result at: 'protocolVersion') equals: '2025-06-18'
%
category: 'tests'
method: McpDispatcherTest
testNilRequestReturnsParseError
  self assert: (((self dispatch: nil) at: 'error') at: 'code') equals: -32700
%
category: 'tests'
method: McpDispatcherTest
testNotificationReturnsNil
  self assert: (self dispatch: (self notification: 'notifications/initialized')) isNil
%
category: 'tests'
method: McpDispatcherTest
testToolsCallSuccessEnvelope
  | result |
  result := (self dispatch: (self toolCall: 'execute_code' args: (Dictionary new at: 'code' put: '3 + 4'; yourself))) at: 'result'.
  self deny: (result at: 'isError').
  self assert: ((result at: 'content') first at: 'text') equals: '7'
%
category: 'tests'
method: McpDispatcherTest
testToolsCallWrapsErrorsAsIsError
  | result |
  result := (self dispatch: (self toolCall: 'execute_code' args: (Dictionary new at: 'code' put: '1/0'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'content') first at: 'text') includesString: 'ZeroDivide')
%
category: 'tests'
method: McpDispatcherTest
testToolsListIsAlphabeticalAnd31
  | tools names |
  tools := ((self dispatch: (self request: 'tools/list' params: nil)) at: 'result') at: 'tools'.
  names := (tools collect: [:d | d at: 'name']) asArray.
  self assert: names size equals: 31.
  self assert: names equals: names asSortedCollection asArray
%
category: 'tests'
method: McpDispatcherTest
testUnknownMethodReturns32601
  | resp |
  resp := self dispatch: (self request: 'no/such/method' params: nil).
  self assert: ((resp at: 'error') at: 'code') equals: -32601
%
category: 'tests'
method: McpDispatcherTest
testUnknownToolReturns32602
  | resp |
  resp := self dispatch: (self toolCall: 'does_not_exist' args: Dictionary new).
  self assert: ((resp at: 'error') at: 'code') equals: -32602
%
category: 'helpers'
method: McpDispatcherTest
toolCall: toolName args: argsDict
  ^self request: 'tools/call' params:
    (Dictionary new at: 'name' put: toolName; at: 'arguments' put: argsDict; yourself)
%
