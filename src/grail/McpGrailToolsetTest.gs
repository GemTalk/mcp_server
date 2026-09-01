set compile_env: 0
! ------------------- Class definition for McpGrailToolsetTest
expectvalue /Class
doit
GsTestCase subclass: 'McpGrailToolsetTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpGrailToolsetTest comment: 
'Tests for the optional Grail-powered python tools, which live in McpGrailToolset (eval_python /
compile_python). Its own source group (src/grail/), loaded only into a Grail-equipped image
(src/grail/load.gs, filed in by install.sh --grail); the core suites (McpToolTest, McpDispatcherTest,
McpTransportTest, McpContractTest, McpExtensionTest) cover the Grail-free server.

Covers all three Python failure paths for real: an undefined name, a runtime error and a syntax error.
The last two were once switched-off tripwires -- Grail used to take the gem down on them -- but as of
2026-08-18 each raises a catchable Python exception, so McpGrailToolset converts them into an McpError
kinded #pythonError and the dispatcher reports an ordinary isError result.

Also the coverage for a toolset that owns its handlers and is combined with others: the tools are
exercised both directly on the toolset and through a server built with it alongside the core seven.'
%
expectvalue /Class
doit
McpGrailToolsetTest category: 'Mcp-Grail-Tests'
%
! ------------------- Remove existing behavior from McpGrailToolsetTest
removeallmethods McpGrailToolsetTest
removeallclassmethods McpGrailToolsetTest
! ------------------- Class methods for McpGrailToolsetTest
! ------------------- Instance methods for McpGrailToolsetTest
category: 'helpers'
method: McpGrailToolsetTest
dispatch: requestDict
  "Route requestDict through a dispatcher over a server carrying the core toolsets PLUS the Grail
   one -- the combination the old server subclass could not express."
  | s |
  s := self grailServer.
  ^(McpDispatcher withToolRegistry: s toolRegistry server: s) handle: requestDict
%
category: 'helpers'
method: McpGrailToolsetTest
grailServer
  "A server whose surface is the core toolsets plus McpGrailToolset -- i.e. what
   installedDefaultToolsetNames answers on a Grail-equipped image."
  ^McpServer newWithToolsetNames:
    (McpServer defaultToolsetNames , (Array with: 'McpGrailToolset'))
%
category: 'helpers'
method: McpGrailToolsetTest
includesCS: aSubstring in: aString
  "Case-sensitive substring test (String>>includesString: is case-INsensitive)."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'helpers'
method: McpGrailToolsetTest
mcp
  "A fresh Grail TOOLSET whose tool_* handlers we exercise directly (no socket, no dispatcher).
   Built with no server at all, which is the point of a self-contained toolset: its handlers need
   nothing from McpServer, not even the shared output cap (McpToolset>>capResult:)."
  ^McpGrailToolset new
%
category: 'helpers'
method: McpGrailToolsetTest
oneArg: key value: value
  | d |
  d := Dictionary new.
  d at: key put: value.
  ^d
%
category: 'helpers'
method: McpGrailToolsetTest
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
method: McpGrailToolsetTest
testCompilePython
  "Transpile a Python assignment to Smalltalk. Pins Grail's CURRENT codegen for a multiplication,
   which as of 2026-08-18 is ___binOpMul___: (it was __mul__ when this test was written) -- so a
   failure here means Grail changed its emitted selectors, not that transpiling broke."
  | src |
  src := self mcp tool_compile_python: (self oneArg: 'code' value: 'x = 6 * 7').
  self assert: (self includesCS: '___binOpMul___:' in: src).
  self assert: (self includesCS: 'x :=' in: src)
%
category: 'tests'
method: McpGrailToolsetTest
testEvalPython
  "Evaluate a Python expression and get the printString of the result."
  self assert: (self mcp tool_eval_python: (self oneArg: 'code' value: '6 * 7')) equals: '42'
%
category: 'tests'
method: McpGrailToolsetTest
testGrailToolsetIsGatedInReadOnlySession
  "Running arbitrary Python can persist anything, so the toolset declares nothing read-only-safe and
   a read-only worker drops it whole -- while still reporting the tools as forbidden rather than
   unknown."
  | ts |
  ts := McpGrailToolset on: McpServer new.
  self assert: ts readOnlySafeToolNames isEmpty.
  SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil].
  [ | names err |
    McpServer sessionReadOnly: true.
    names := (McpServer newWithToolsetNames: (Array with: 'McpGrailToolset'))
      toolRegistry descriptors collect: [:d | d at: 'name'].
    self assert: names isEmpty.
    err := (self dispatch: (self toolCall: 'eval_python'
      args: (Dictionary new at: 'code' put: '1'; yourself))) at: 'error'.
    self assert: (err at: 'code') equals: -32601.
    self assert: ((err at: 'data') at: 'kind') equals: 'readOnly']
      ensure: [SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil]]
%
category: 'tests'
method: McpGrailToolsetTest
testGrailToolsetJoinsTheInstalledDefaultSurface
  "On a Grail-equipped image the optional toolset is picked up automatically: the front end resolves
   the default surface with installedDefaultToolsetNames, which must include it once this file is
   loaded (this suite only exists in such an image). That is what replaces the old
   'build the most capable installed server class' probe."
  self assert: (McpServer installedDefaultToolsetNames includes: 'McpGrailToolset').
  self deny: (McpServer defaultToolsetNames includes: 'McpGrailToolset')
%
category: 'tests'
method: McpGrailToolsetTest
testToolsCallPythonPrintReturnsNone
  "Pins current Grail behavior: Python print() succeeds and yields None. It no longer raises
   the dead-stdout ImproperOperation (2364) it once did after the dispatcher's abort. A
   tripwire: if print reverts to raising (or starts crashing), this flags the change.

   What is asserted is the TOOL's text alone, with #withoutSessionNote: taking off anything the
   dispatcher appended about the session. Without that this test was really two tests at once: it
   failed whenever it ran in a dirty session, which made it a report on what the suite before it
   left behind rather than on what print() answers."
  | result |
  result := (self dispatch: (self toolCall: 'eval_python' args: (Dictionary new at: 'code' put: 'print(6 * 7)'; yourself))) at: 'result'.
  self deny: (result at: 'isError').
  self assert: (self withoutSessionNote: ((result at: 'content') first at: 'text')) equals: 'None'
%
category: 'tests'
method: McpGrailToolsetTest
testToolsCallWrapsPythonErrorAsIsError
  "An undefined Python name raises a Python NameError -- NOT a Smalltalk Error, so the dispatcher
   cannot catch it; McpGrailToolset converts it, and the client gets isError with kind 'pythonError'
   rather than a dead worker gem. (This used to arrive as a catchable CompileError from the
   transpiler; Grail now defers it to run time.)"
  | result text |
  result := (self dispatch: (self toolCall: 'eval_python' args: (Dictionary new at: 'code' put: 'undefined_xyz'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'structuredContent') at: 'error') at: 'kind') equals: 'pythonError'.
  text := (result at: 'content') first at: 'text'.
  self assert: (self includesCS: 'NameError' in: text).
  self assert: (self includesCS: 'undefined_xyz' in: text)
%
category: 'tests'
method: McpGrailToolsetTest
testToolsCallWrapsPythonRuntimeErrorAsIsError
  "A Python RUNTIME error (1/0 -> ZeroDivisionError) surfaces as isError kind 'pythonError'. This was
   a switched-off tripwire while Grail crashed the gem on runtime errors; verified catchable
   2026-08-18, so it now runs for real."
  | result text |
  result := (self dispatch: (self toolCall: 'eval_python' args: (Dictionary new at: 'code' put: '1 / 0'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'structuredContent') at: 'error') at: 'kind') equals: 'pythonError'.
  text := (result at: 'content') first at: 'text'.
  self assert: (self includesCS: 'ZeroDivisionError' in: text)
%
category: 'tests'
method: McpGrailToolsetTest
testToolsCallWrapsPythonSyntaxErrorAsIsError
  "Malformed Python (`def (:`) surfaces as isError kind 'pythonError'. The most dangerous of the three
   historically -- a syntax error used to crash the gem below the Smalltalk exception layer, so this
   test was switched off and never sent through a live suite. Verified catchable 2026-08-18."
  | result text |
  result := (self dispatch: (self toolCall: 'eval_python' args: (Dictionary new at: 'code' put: 'def (:'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'structuredContent') at: 'error') at: 'kind') equals: 'pythonError'.
  text := (result at: 'content') first at: 'text'.
  self assert: (self includesCS: 'SyntaxError' in: text)
%
category: 'tests'
method: McpGrailToolsetTest
testToolsListHasPythonToolsAnd33
  "Composition end to end: core toolsets plus McpGrailToolset registers 33 tools -- the core 31
   plus eval_python and compile_python -- listed alphabetically."
  | tools names |
  tools := ((self dispatch: (self request: 'tools/list' params: nil)) at: 'result') at: 'tools'.
  names := (tools collect: [:d | d at: 'name']) asArray.
  self assert: names size equals: 33.
  self assert: names equals: names asSortedCollection asArray.
  self assert: (names includes: 'eval_python').
  self assert: (names includes: 'compile_python')
%
category: 'helpers'
method: McpGrailToolsetTest
toolCall: toolName args: argsDict
  ^self request: 'tools/call' params:
    (Dictionary new at: 'name' put: toolName; at: 'arguments' put: argsDict; yourself)
%
category: 'helpers'
method: McpGrailToolsetTest
withoutSessionNote: aString
  "aString up to the dispatcher's [session] note, or unchanged when it carries none.
   McpDispatcher>>annotateContent: appends that note to the first content item's text -- a newline
   and a line opening '[session] ' -- to report session state the model must act on.

   A test about what a TOOL answered has to take the note off rather than assert around it. The two
   cheaper-looking alternatives are both worse. Aborting in setUp (what McpContractTest and
   McpExtensionTest did until 2026-09-01) makes the suite move the CALLER's transaction, which is a
   large price for a text comparison. Relaxing the assertion to a substring match stops testing
   anything the day the note's own wording happens to contain the expected text -- and 'None' is a
   word a note about session state could very plausibly use.

   Cuts at the FIRST newline-plus-'[session] ' and drops everything after it. That is the durable
   rule rather than a nicety about today's one-note format: the note is not promised to stay a
   single line, nor to appear only in a dirty session -- a future one might report a pinned view to
   a session with nothing pending at all -- and a cut at the LAST occurrence would leave every note
   but the final one sitting in the text the test is comparing."
  | marker idx |
  marker := (String with: Character lf) , '[session] '.
  idx := aString findString: marker startingAt: 1.
  idx = 0 ifTrue: [^aString].
  ^aString copyFrom: 1 to: idx - 1
%
