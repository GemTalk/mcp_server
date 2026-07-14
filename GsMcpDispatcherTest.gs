set compile_env: 0
! ------------------- Class definition for GsMcpDispatcherTest
expectvalue /Class
doit
GsTestCase subclass: 'GsMcpDispatcherTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: GsnativeMcpServer
  options: #()

%
! ------------------- Remove existing behavior from GsMcpDispatcherTest
removeallmethods GsMcpDispatcherTest
removeallclassmethods GsMcpDispatcherTest
! ------------------- Class methods for GsMcpDispatcherTest
category: 'enablement'
classmethod: GsMcpDispatcherTest
pythonRuntimeErrorsThrow
  "Whether Grail raises a catchable exception on a Python *runtime* error (e.g. 1/0) instead
   of crashing the gem. Currently false: a runtime exception crashes the session below the
   Smalltalk exception layer, just as a syntax error does (a Grail bug; a fix is in progress).
   Flip to true once Grail is fixed to activate testToolsCallWrapsPythonRuntimeErrorAsIsError.
   WARNING: returning true while the bug remains will crash the server gem when that test runs."
  ^false
%
category: 'enablement'
classmethod: GsMcpDispatcherTest
pythonSyntaxErrorsThrow
  "Whether Grail raises a catchable exception on a Python *syntax* error instead of crashing
   the gem. Currently false: `def (:` and similar malformed input crash the session below the
   Smalltalk exception layer (a Grail parser bug; a fix is in progress). Flip to true once
   Grail is fixed to activate testToolsCallWrapsPythonSyntaxErrorAsIsError.
   WARNING: returning true while the bug remains will crash the server gem when that test runs."
  ^false
%
! ------------------- Instance methods for GsMcpDispatcherTest
category: 'helpers'
method: GsMcpDispatcherTest
dispatch: requestDict
  "Route requestDict through a fresh dispatcher; answer the response Dictionary (or nil)."
  ^(GsMcpDispatcher withToolRegistry: GsMcpServer new toolRegistry) handle: requestDict
%
category: 'helpers'
method: GsMcpDispatcherTest
notification: methodName
  "A JSON-RPC notification (no id)."
  | d |
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'method' put: methodName.
  ^d
%
category: 'helpers'
method: GsMcpDispatcherTest
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
method: GsMcpDispatcherTest
testInitialize
  | result |
  result := (self dispatch: (self request: 'initialize' params: Dictionary new)) at: 'result'.
  self assert: (result at: 'protocolVersion') equals: '2024-11-05'.
  self assert: ((result at: 'serverInfo') at: 'name') equals: 'gemstone-mcp'.
  self assert: ((result at: 'capabilities') includesKey: 'tools')
%
category: 'tests'
method: GsMcpDispatcherTest
testNilRequestReturnsParseError
  self assert: (((self dispatch: nil) at: 'error') at: 'code') equals: -32700
%
category: 'tests'
method: GsMcpDispatcherTest
testNotificationReturnsNil
  self assert: (self dispatch: (self notification: 'notifications/initialized')) isNil
%
category: 'tests'
method: GsMcpDispatcherTest
testToolsCallPythonPrintReturnsNone
  "Pins current Grail behavior: Python print() succeeds and yields None. It no longer raises
   the dead-stdout ImproperOperation (2364) it once did after the dispatcher's abort. A
   tripwire: if print reverts to raising (or starts crashing), this flags the change.
   Requires GemStone-Python (ModuleAst) in the image."
  | result |
  result := (self dispatch: (self toolCall: 'eval_python' args: (Dictionary new at: 'code' put: 'print(6 * 7)'; yourself))) at: 'result'.
  self deny: (result at: 'isError').
  self assert: ((result at: 'content') first at: 'text') equals: 'None'
%
category: 'tests'
method: GsMcpDispatcherTest
testToolsCallSuccessEnvelope
  | result |
  result := (self dispatch: (self toolCall: 'execute_code' args: (Dictionary new at: 'code' put: '3 + 4'; yourself))) at: 'result'.
  self deny: (result at: 'isError').
  self assert: ((result at: 'content') first at: 'text') equals: '7'
%
category: 'tests'
method: GsMcpDispatcherTest
testToolsCallWrapsErrorsAsIsError
  | result |
  result := (self dispatch: (self toolCall: 'execute_code' args: (Dictionary new at: 'code' put: '1/0'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'content') first at: 'text') includesString: 'ZeroDivide')
%
category: 'tests'
method: GsMcpDispatcherTest
testToolsCallWrapsPythonErrorAsIsError
  "A Python *semantic* error (undefined name) reaches Grail and raises a catchable
   CompileError, which the dispatcher wraps as isError -- confirming the python tools
   have no own error handling and rely on handleToolsCall:id:. Uses a semantic error,
   never a syntax error (which crashes the gem until Grail is fixed). Requires
   GemStone-Python (ModuleAst) in the image."
  | result text |
  result := (self dispatch: (self toolCall: 'eval_python' args: (Dictionary new at: 'code' put: 'undefined_xyz'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  text := (result at: 'content') first at: 'text'.
  self assert: (text includesString: 'CompileError').
  self assert: (text includesString: 'undefined_xyz')
%
category: 'tests'
method: GsMcpDispatcherTest
testToolsCallWrapsPythonRuntimeErrorAsIsError
  "Tripwire for the day Grail stops crashing on a Python *runtime* exception. Guarded by
   GsMcpDispatcherTest class>>pythonRuntimeErrorsThrow (currently false), so today it no-ops:
   a runtime error like `1 / 0` still crashes the gem (uncatchable, below the Smalltalk
   exception layer), just as a syntax error does. Once Grail raises instead, flip
   pythonRuntimeErrorsThrow to true and this verifies the error surfaces as isError, like the
   CompileError path. When it first runs for real, tighten the text check to whatever a fixed
   Grail actually raises."
  | result text |
  self class pythonRuntimeErrorsThrow ifFalse: [^self].
  result := (self dispatch: (self toolCall: 'eval_python' args: (Dictionary new at: 'code' put: '1 / 0'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  text := (result at: 'content') first at: 'text'.
  self assert: text isEmpty not
%
category: 'tests'
method: GsMcpDispatcherTest
testToolsCallWrapsPythonSyntaxErrorAsIsError
  "Tripwire for the day Grail stops crashing on malformed Python. Guarded by
   GsMcpDispatcherTest class>>pythonSyntaxErrorsThrow (currently false), so today it no-ops:
   a Python *syntax* error still crashes the gem and must never be sent through a live suite.
   Once Grail raises instead, flip pythonSyntaxErrorsThrow to true and this verifies a syntax
   error surfaces as isError, like the CompileError path. When it first runs for real, tighten
   the text check to whatever exception a fixed Grail actually raises."
  | result text |
  self class pythonSyntaxErrorsThrow ifFalse: [^self].
  result := (self dispatch: (self toolCall: 'eval_python' args: (Dictionary new at: 'code' put: 'def (:'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  text := (result at: 'content') first at: 'text'.
  self assert: text isEmpty not
%
category: 'tests'
method: GsMcpDispatcherTest
testToolsListIsAlphabeticalAnd33
  | tools names |
  tools := ((self dispatch: (self request: 'tools/list' params: nil)) at: 'result') at: 'tools'.
  names := (tools collect: [:d | d at: 'name']) asArray.
  self assert: names size equals: 33.
  self assert: names equals: names asSortedCollection asArray
%
category: 'tests'
method: GsMcpDispatcherTest
testUnknownMethodReturns32601
  | resp |
  resp := self dispatch: (self request: 'no/such/method' params: nil).
  self assert: ((resp at: 'error') at: 'code') equals: -32601
%
category: 'tests'
method: GsMcpDispatcherTest
testUnknownToolReturns32602
  | resp |
  resp := self dispatch: (self toolCall: 'does_not_exist' args: Dictionary new).
  self assert: ((resp at: 'error') at: 'code') equals: -32602
%
category: 'helpers'
method: GsMcpDispatcherTest
toolCall: toolName args: argsDict
  ^self request: 'tools/call' params:
    (Dictionary new at: 'name' put: toolName; at: 'arguments' put: argsDict; yourself)
%
