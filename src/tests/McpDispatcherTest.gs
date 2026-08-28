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
category: 'helpers'
method: McpDispatcherTest
resultTextOf: aResponse
  "The text of a tools/call response's first content item."
  ^(((aResponse at: 'result') at: 'content') at: 1) at: 'text'
%
category: 'running'
method: McpDispatcherTest
tearDown
  "The transaction tests below deliberately leave the session dirty. Nothing they plant is ever
   committed, so one abort undoes all of it -- and leaving a dirty session behind would change what
   the NEXT suite's tools/call sees, now that a call no longer aborts on the way in."
  System abortTransaction
%
category: 'tests'
method: McpDispatcherTest
testCleanSessionGetsNoTransactionNote
  "The note is for state the model must act on, so a clean session gets none: a warning on every
   single call would be noise the model learns to skip past."
  | text |
  System abortTransaction.
  text := self resultTextOf: (self dispatch: (self toolCall: 'status')).
  self deny: (text includesString: '[session]')
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
  "no title unless a deployment set one: the key is absent, not null, so a client displays the name"
  self deny: ((result at: 'serverInfo') includesKey: 'title').
  self assert: ((result at: 'capabilities') includesKey: 'tools')
%
category: 'tests'
method: McpDispatcherTest
testInitializeDeclaresToolsAndNothingElse
  "A server may send only what it has declared, and must not declare what it cannot do. Tools are
   the whole of it. 'logging' was declared until 2026-08-27 to license notifications/message for the
   front end's idle and session-ending warnings; those are gone, so the promise goes with them.
   The absences are as deliberate as the presence: no listChanged (a session's tool surface is fixed
   at initialize), no resources, prompts or completions -- and nothing for progress, which is a
   base-protocol utility the CLIENT opts into per request."
  | caps |
  caps := ((self dispatch: (self request: 'initialize' params: Dictionary new)) at: 'result')
    at: 'capabilities'.
  self assert: (caps includesKey: 'tools').
  self deny: (caps includesKey: 'logging').
  self deny: ((caps at: 'tools') includesKey: 'listChanged').
  self deny: (caps includesKey: 'resources').
  self deny: (caps includesKey: 'prompts').
  self deny: (caps includesKey: 'completions')
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
testToolCallKeepsUncommittedWork
  "The 10.11 regression test, at the seam where it went wrong. handleToolsCall:id: sent
   System abortTransaction before every tool until 2026-08-28, so a value planted by one call was
   gone by the next -- which is why `commit` committed a transaction emptied a microsecond earlier
   and reported success. The pre-call refresh must take a current view WITHOUT destroying work."
  System abortTransaction.
  UserGlobals at: #McpDispatcherTxnProbe put: 'planted'.
  self dispatch: (self toolCall: 'status').
  self assert: (UserGlobals at: #McpDispatcherTxnProbe ifAbsent: [nil]) equals: 'planted'.
  self assert: System needsCommit
%
category: 'tests'
method: McpDispatcherTest
testToolErrorIsAnnotatedToo
  "A tool that RAISED is exactly when pending work most needs reporting -- the call the model just
   made did not do what it asked, and it has to decide what to do with what it already had. The
   error envelope's structuredContent is left alone, so a client branching on the kind is
   unaffected by prose meant for the model."
  | response text |
  System abortTransaction.
  UserGlobals at: #McpDispatcherTxnProbe put: 'planted'.
  response := self dispatch: (self request: 'tools/call' params:
    (Dictionary new
      at: 'name' put: 'compile_method';
      at: 'arguments' put: (Dictionary new
        at: 'className' put: 'Object';
        at: 'source' put: 'mcpProbeSelector ^1';
        yourself);
      yourself)).
  self assert: ((response at: 'result') at: 'isError').
  text := self resultTextOf: response.
  self assert: (text includesString: 'Refused').
  self assert: (text includesString: '[session] You have uncommitted changes').
  self assert: ((((response at: 'result') at: 'structuredContent') at: 'error') at: 'kind')
    equals: 'refused'
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
testUncommittedWorkIsReportedInTheResult
  "A dirty session is reported on every result until it is resolved, because the two moves that
   resolve it (commit, abort) are the model's to make and nothing else will make them."
  | text |
  System abortTransaction.
  UserGlobals at: #McpDispatcherTxnProbe put: 'planted'.
  text := self resultTextOf: (self dispatch: (self toolCall: 'status')).
  self assert: (text includesString: '[session] You have uncommitted changes').
  self assert: (text includesString: 'commit')
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
toolCall: aToolName
  "A tools/call request for a no-argument tool."
  | params |
  params := Dictionary new.
  params at: 'name' put: aToolName.
  params at: 'arguments' put: Dictionary new.
  ^self request: 'tools/call' params: params
%
category: 'helpers'
method: McpDispatcherTest
toolCall: toolName args: argsDict
  ^self request: 'tools/call' params:
    (Dictionary new at: 'name' put: toolName; at: 'arguments' put: argsDict; yourself)
%
