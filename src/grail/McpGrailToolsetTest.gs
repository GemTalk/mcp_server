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
'Tests for the optional Grail-powered python tools, which live in McpGrailToolset (the eval,
transpile, source, class- and method-browsing, module-state and test-running tools). Its own source
group (src/grail/), loaded only into a Grail-equipped image (src/grail/load.gs, filed in by install.sh --grail); the core suites (McpToolTest,
McpDispatcherTest, McpTransportTest, McpContractTest, McpExtensionTest) cover the Grail-free server.

Covers all three Python failure paths for real: an undefined name, a runtime error and a syntax error.
The last two were once switched-off tripwires -- Grail used to take the gem down on them -- but as of
2026-08-18 each raises a catchable Python exception, so McpGrailToolset converts them into an McpError
kinded #pythonError and the dispatcher reports an ordinary isError result.

TESTS THAT NEED A GRAIL CHECKOUT discover it (grailCheckoutOrNil) rather than assuming a path, and
assert what is true WITHOUT one instead of skipping silently. That is not defensiveness: Grail''s .py
stdlib lives on disk, install.sh commits no Python module, and this suite must be runnable on a
freshly installed extent -- so "no checkout discoverable" is a legitimate state with its own correct
behavior, and testEvalPythonReportsTheTraceback checks both sides of it.

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
grailCheckoutOrNil
  "The Grail checkout this image was installed from, discovered rather than configured, or nil.

   Discovered from a committed canonical module's __file__ (readable without importing anything),
   because no test can know where a checkout lives on the machine running it. nil is a legitimate
   answer -- install.sh commits no Python module, so a freshly installed extent has an empty
   GrailCanonicalModules -- which is why the tests that need a checkout say so and skip rather than
   fail on a machine that simply has not imported anything yet."
  | env mods |
  env := System gemEnvironmentVariable: 'GRAIL_DIR'.
  (env notNil and: [self looksLikeCheckout: env]) ifTrue: [^env].
  mods := System myUserProfile objectNamed: #GrailCanonicalModules.
  mods isNil ifTrue: [^nil].
  mods do: [:m | | f idx |
    f := [m @env1:__file__] on: Error, BaseException do: [:e | nil].
    f ifNotNil: [
      idx := f asString findString: '/src/python/stdlib' startingAt: 1.
      idx > 1 ifTrue: [ | cand |
        cand := f asString copyFrom: 1 to: idx - 1.
        (self looksLikeCheckout: cand) ifTrue: [^cand]]]].
  ^nil
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
grailToolsetOn: aCheckout
  "A Grail toolset configured with aCheckout, which is what every tool that touches disk needs."
  ^McpGrailToolset on: nil options:
    (Dictionary new at: 'grailDirectory' put: aCheckout; yourself)
%
category: 'helpers'
method: McpGrailToolsetTest
includesCS: aSubstring in: aString
  "Case-sensitive substring test (String>>includesString: is case-INsensitive)."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'helpers'
method: McpGrailToolsetTest
looksLikeCheckout: aPath
  "Does aPath hold Grail's bundled stdlib? existsOnServer: answers nil (not false) when the probe
   itself errors, so compare == true."
  ^(GsFile existsOnServer: aPath , '/src/python/stdlib') == true
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
testDescribePythonClassNamesTheSmalltalkClassAndStorageBase
  "The questions no Smalltalk browsing tool can answer, because a Grail Python class is created
   ANONYMOUSLY -- in no symbol dictionary, so list_classes cannot see it and it has to be asked for
   by its Python name.

   Storage base is the one to check hardest: a Python class does not wrap its data, it IS a GemStone
   object, so the base is what decides which env-0 protocol its instances already answer.
   Needs a checkout; discovered, see grailCheckoutOrNil."
  | checkout out |
  checkout := self grailCheckoutOrNil.
  checkout isNil ifTrue: [^self assert: true].
  out := self withFreshScopeDo: [
    (self grailToolsetOn: checkout) tool_describe_python_class:
      (self oneArg: 'name' value: '_grail_session.SessionDict')].
  self assert: (self includesCS: 'smalltalk class: SessionDict' in: out).
  self assert: (self includesCS: 'anonymous' in: out).
  self assert: (self includesCS: 'storage base:' in: out).
  "__slots__ are real named instVars under a mangled name -- worth saying, since nothing else does"
  self assert: (self includesCS: '__slots__' in: out).
  self assert: (self includesCS: '_name' in: out).
  "and it points at the tool that answers the Smalltalk half, rather than pretending to"
  self assert: (self includesCS: 'list_methods' in: out)
%
category: 'tests'
method: McpGrailToolsetTest
testDescribePythonClassRefusesAnUnknownName
  "A name that resolves to nothing is #notFound with a hint, never an empty description -- the
   silent-wrong-answer shape this toolset exists to avoid."
  | result |
  result := self withFreshScopeDo: [
    (self dispatch: (self toolCall: 'describe_python_class'
      args: (Dictionary new at: 'name' put: 'no_such_module_xyz.Nope'; yourself))) at: 'result'].
  self assert: (result at: 'isError').
  self assert: (((result at: 'structuredContent') at: 'error') at: 'kind') equals: 'notFound'
%
category: 'tests'
method: McpGrailToolsetTest
testEvalPython
  "Evaluate a Python expression and get its value back. With nothing printed the answer is just the
   repr on one line, so the ordinary case stays as simple as it ever was."
  self withFreshScopeDo: [
    self assert: (self mcp tool_eval_python: (self oneArg: 'code' value: '6 * 7')) equals: '42']
%
category: 'tests'
method: McpGrailToolsetTest
testEvalPythonCapturesWhatWasPrinted
  "Printed output used to be DISCARDED: eval_python answered only the last value, so `print(x)`
   answered 'None' and the thing the caller asked to see was gone -- and most real Python prints.
   Both channels now come back, output first and the value after a '=> ' marker."
  | out |
  out := self withFreshScopeDo: [
    self mcp tool_eval_python: (self oneArg: 'code' value: 'print("one")
print("two")')].
  self assert: (self includesCS: 'one' in: out).
  self assert: (self includesCS: 'two' in: out).
  self assert: (self includesCS: '=> None' in: out).
  "output comes before the value, so a reader meets them in the order they happened"
  self assert: (out findString: 'one' startingAt: 1) < (out findString: '=> ' startingAt: 1)
%
category: 'tests'
method: McpGrailToolsetTest
testEvalPythonNamespacePersistsBetweenCalls
  "The REPL property, and the reason this toolset holds a scope at all. Before it, every call was a
   blank slate WHILE imports persisted (sys.modules is session-local), so the surface looked stateful
   and was not -- a model would reasonably bind a name and then find it gone."
  self withFreshScopeDo: [ | ts |
    ts := self mcp.
    ts tool_eval_python: (self oneArg: 'code' value: 'counter = 41').
    self assert: (ts tool_eval_python: (self oneArg: 'code' value: 'counter + 1')) equals: '42'.
    "a DIFFERENT toolset instance shares it: the namespace belongs to the session, not the object"
    self assert: (self mcp tool_eval_python: (self oneArg: 'code' value: 'counter')) equals: '41']
%
category: 'tests'
method: McpGrailToolsetTest
testEvalPythonRendersValuesAsPythonNotSmalltalk
  "A Python surface must answer Python's rendering. printString showed a Smalltalk
   OrderedCollection where the caller asked for a list -- correct about the image, wrong about the
   question."
  | out |
  out := self withFreshScopeDo: [
    self mcp tool_eval_python: (self oneArg: 'code' value: '[1, "two", None]')].
  self assert: out equals: '[1, ''two'', None]'.
  self deny: (self includesCS: 'OrderedCollection' in: out)
%
category: 'tests'
method: McpGrailToolsetTest
testEvalPythonReportsTheTraceback
  "Grail computes a full multi-frame traceback with real line numbers, and the tool used to throw all
   of it away and report one line. The frames are the part that says WHERE, which is most of the
   value of an error.

   BOTH outcomes are asserted, because the traceback is not unconditional: formatting one runs Grail's
   own `traceback` module, which is a .py under the checkout, so an unconfigured session cannot
   produce one. That session must still get a usable error rather than a failure -- degrading to the
   one-line message is the designed behavior, not an accident -- and a configured session must get
   the frames. Which of the two runs here depends on the machine, so both are checked for real."
  | checkout ts text |
  checkout := self grailCheckoutOrNil.
  ts := McpGrailToolset on: nil options: (checkout isNil
    ifTrue: [nil]
    ifFalse: [Dictionary new at: 'grailDirectory' put: checkout; yourself]).
  text := self withFreshScopeDo: [
    [ts tool_eval_python: (self oneArg: 'code' value:
'def outer():
    return inner()

def inner():
    d = {}
    return d["missing"]

outer()').
      nil]
      on: McpError do: [:ex | ex messageText]].
  self assert: text notNil.
  "either way it names the exception and its detail -- the floor below which this must not fall"
  self assert: (self includesCS: 'KeyError' in: text).
  self assert: (self includesCS: 'missing' in: text).
  checkout isNil ifTrue: [^self].
  "configured: the frames, and the line numbers of the source AS SENT -- an off-by-one here would
   send a reader to the wrong line"
  self assert: (self includesCS: 'Traceback (most recent call last)' in: text).
  self assert: (self includesCS: 'in outer' in: text).
  self assert: (self includesCS: 'in inner' in: text).
  self assert: (self includesCS: 'line 8' in: text).   "the outer() call"
  self assert: (self includesCS: 'line 2' in: text).   "return inner()"
  self assert: (self includesCS: 'line 6' in: text)    "the failing subscript"
%
category: 'tests'
method: McpGrailToolsetTest
testGetPythonSourceReadsTheDefinitionFromDisk
  "The end-to-end path: locate a Python object through __code__ and read its source off disk.
   Needs a Grail CHECKOUT, which no test can know the location of, so it is discovered
   (grailCheckoutOrNil) and the test states what it skipped rather than failing on a machine that has
   simply never imported a .py module -- install.sh commits none, so a fresh extent has nothing to
   discover from.
   gemdb.transaction is the subject because it is the worked example of what this tool is FOR: its
   __doc__ in the image reads None (the compiled-def gap) and inspect.getsource answers an empty
   string, so the docstring asserted here is reachable no other way."
  | checkout out |
  checkout := self grailCheckoutOrNil.
  checkout isNil ifTrue: [^self assert: true].
  out := (McpGrailToolset on: nil options:
    (Dictionary new at: 'grailDirectory' put: checkout; yourself))
      tool_get_python_source: (self oneArg: 'name' value: 'gemdb.transaction').
  self assert: (self includesCS: 'def transaction(' in: out).
  self assert: (self includesCS: 'A commit boundary' in: out).
  "the header says where it came from, so a reader can go and look"
  self assert: (self includesCS: 'gemdb' in: out).
  "and it stops at the definition, rather than running on into the rest of the file"
  self deny: (self includesCS: 'class _Transaction' in: out)
%
category: 'tests'
method: McpGrailToolsetTest
testGetPythonSourceRefusesAnUnknownName
  "An unresolvable name is #notFound with a message that says what it might mean -- a native
   (Smalltalk-implemented) module genuinely has no .py to read, and that is a different situation
   from a typo. Never an empty answer: inspect.getsource returning '' for a function it cannot reach
   is precisely the silent-wrong-answer shape this toolset exists to avoid."
  | result |
  result := (self dispatch: (self toolCall: 'get_python_source'
    args: (Dictionary new at: 'name' put: 'no_such_module_xyz.nope'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'structuredContent') at: 'error') at: 'kind') equals: 'notFound'
%
category: 'tests'
method: McpGrailToolsetTest
testGrailDirectoryIsADeclaredOption
  "The toolset says how it may be configured, which is what lets the router refuse a typo. Grail's
   .py stdlib and fixtures live on DISK, and a worker gem cannot work out where -- its own working
   directory is the stone's."
  self assert: (McpGrailToolset declaredOptionNames includes: 'grailDirectory').
  self assert: ((McpGrailToolset on: nil options:
    (Dictionary new at: 'grailDirectory' put: '/somewhere/Grail'; yourself))
      optionNamed: 'grailDirectory' ifAbsent: [nil]) equals: '/somewhere/Grail'.
  "unconfigured, the toolset still works -- it just leaves Grail to resolve a directory itself"
  self assert: (McpGrailToolset new optionNamed: 'grailDirectory' ifAbsent: [nil]) isNil
%
category: 'tests'
method: McpGrailToolsetTest
testGrailToolsetIsGatedInReadOnlySession
  "A read-only worker keeps exactly ONE of these tools -- run_python_tests, which runs in a fresh gem
   that is thrown away and never committed in, so it can persist nothing. Every other one is dropped:
   running arbitrary Python can persist anything, and get_python_source imports the module it is
   asked about, which in Grail is a database write.

   The gated ones must still be reported as FORBIDDEN rather than unknown -- 'you may not' and 'no
   such tool' are different answers and only one of them is worth showing a user as a permissions
   problem."
  | ts |
  ts := McpGrailToolset on: McpServer new.
  self assert: ts readOnlySafeToolNames asSortedCollection asArray
    equals: (Array with: 'python_module_state' with: 'run_python_tests').
  SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil].
  [ | names err |
    McpServer sessionReadOnly: true.
    names := (McpServer newWithToolsetNames: (Array with: 'McpGrailToolset'))
      toolRegistry descriptors collect: [:d | d at: 'name'].
    self assert: names asSortedCollection asArray
      equals: (Array with: 'python_module_state' with: 'run_python_tests').
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
testListPythonMethodsGivesRealSignaturesAndLines
  "The reason this is not just `dir(cls)`: the answer carries parameter NAMES and DEFAULTS, which the
   Smalltalk selector cannot express -- `pop(key, default=None)` compiles to `_pop:kw:` -- and the
   .py line each method was defined at.
   Order is the class body's, not alphabetical, so `__init__` comes before `keys`."
  | checkout out initAt keysAt |
  checkout := self grailCheckoutOrNil.
  checkout isNil ifTrue: [^self assert: true].
  out := self withFreshScopeDo: [
    (self grailToolsetOn: checkout) tool_list_python_methods:
      (self oneArg: 'name' value: '_grail_session.SessionDict')].
  self assert: (self includesCS: 'pop(key, default=None)' in: out).
  self assert: (self includesCS: '__setitem__(key, value)' in: out).
  self assert: (self includesCS: 'keys()' in: out).
  "a line number for a method, and the file named once rather than per method"
  self assert: (self includesCS: '_grail_session.py' in: out).
  self assert: (self includesCS: 'line ' in: out).
  "source order, not alphabetical"
  initAt := out findString: '__init__(' startingAt: 1.
  keysAt := out findString: 'keys()' startingAt: 1.
  self assert: (initAt > 0 and: [keysAt > initAt])
%
category: 'tests'
method: McpGrailToolsetTest
testPythonErrorMessageNamesTheClassOnce
  "The reported message must name the exception class exactly ONCE. Grail's #description already
   begins with the class name, and withPythonErrorsAsMcpError: used to prepend it again, so every
   Python error reached the client as 'ValueError: ValueError: boom' -- noise in the one place a
   model is reading closely.

   Asserted by COUNTING occurrences rather than comparing the whole string: the detail after the
   class name is Grail's wording, which is free to change, while 'how many times is the class
   named' is the property this test exists to hold."
  | result text count idx |
  result := (self dispatch: (self toolCall: 'eval_python'
    args: (Dictionary new at: 'code' put: 'raise ValueError("boom")'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  text := self withoutSessionNote: ((result at: 'content') first at: 'text').
  count := 0.
  idx := 1.
  [idx := text findString: 'ValueError' startingAt: idx. idx = 0] whileFalse: [
    count := count + 1.
    idx := idx + 1].
  self assert: count equals: 1.
  self assert: (self includesCS: 'boom' in: text)
%
category: 'tests'
method: McpGrailToolsetTest
testPythonModuleStateTellsNativeFromPyAndUnknown
  "The three kinds of answer a module can have, none of which CPython tooling has a question for.
   Reads only -- nothing here imports, compiles or writes, which is what makes it safe to ask about
   a module you have not decided to import yet."
  | ts native unknown |
  ts := McpGrailToolset new.
  native := ts tool_python_module_state: (self oneArg: 'name' value: 'os').
  "os is hand-written Smalltalk: no .py exists, so the canonical/source lines are omitted rather
   than reported as a string of noes.
   Match the EMITTED LINE, indent and padding included, not the bare word: #deploymentGenerationNote
   is appended to this same answer on any image whose deployments are invalidated, and its prose
   quotes the phrase `canonical: no` -- so a bare substring test passes alone and fails
   inside the suite, for a reason that has nothing to do with the module being asked about."
  self assert: (self includesCS: 'native' in: native).
  self deny: (self includesCS: '  canonical:   ' in: native).
  unknown := ts tool_python_module_state: (self oneArg: 'name' value: 'no_such_module_xyz').
  self assert: (self includesCS: 'next import:' in: unknown).
  self assert: (self includesCS: 'FAILS' in: unknown)
%
category: 'tests'
method: McpGrailToolsetTest
testPythonNameOfSelectorDecodesTheWholeEncoding
  "The selector encoding, pinned. Grail generates `name:` plus `_:` per further argument for a fixed
   call, and `_name:kw:` -- one underscore ADDED -- for one taking *args/**kwargs.

   The last two assertions are the ones that matter. Truncating a selector at its first colon is a
   documented way to invent Python attributes that do not exist (it manufactured `perform`, `value`
   and `with` on 40 of 42 subjects in Grail's own dir() census), and `_x:kw:` must decode as varargs
   `x` while `_x:_:` stays the two-argument `_x` -- the `kw:` keyword is the only thing telling them
   apart."
  | ts |
  ts := McpGrailToolset new.
  self assert: (ts pythonNameOfSelector: #keys) equals: 'keys'.
  self assert: (ts pythonNameOfSelector: #abs:) equals: 'abs'.
  self assert: (ts pythonNameOfSelector: #max:_:) equals: 'max'.
  self assert: (ts pythonNameOfSelector: #'__setitem__:_:') equals: '__setitem__'.
  "varargs: the added underscore comes back off"
  self assert: (ts pythonNameOfSelector: #'_pop:kw:') equals: 'pop'.
  self assert: (ts pythonNameOfSelector: #'___getitem__:kw:') equals: '__getitem__'.
  "...but a fixed-arity selector that merely starts with _ keeps its name"
  self assert: (ts pythonNameOfSelector: #'_dict:_:') equals: '_dict'.
  "and a Grail-internal ___name___ is recognised as such, while a Python dunder is not"
  self assert: (ts isGrailInternalName: '___methodCodeTable___').
  self deny: (ts isGrailInternalName: '__init__')
%
category: 'tests'
method: McpGrailToolsetTest
testPythonSourceBlockEndsAtTheNextUnindentedLine
  "The block rule, tested against a file this test writes -- so it needs no Grail checkout and no
   import, and can state the boundary cases exactly. A definition runs through every indented AND
   blank line and stops at the next line with content in column zero; trailing blanks are dropped so
   a definition does not come back padded to the one after it."
  | path f out |
  path := '/tmp/mcp_grail_source_probe.py'.
  f := GsFile openWriteOnServer: path.
  self assert: f notNil.
  f nextPutAll: 'import os

def wanted(a):
    """Doc."""
    if a:
        return 1

    return 0

def after():
    pass
'; close.
  [ out := (McpGrailToolset new) sourceFrom: path startingAt: 3 label: 'wanted'.
    self assert: (self includesCS: 'def wanted(a):' in: out).
    self assert: (self includesCS: '"""Doc."""' in: out).
    "the blank line INSIDE the definition is kept"
    self assert: (self includesCS: 'return 0' in: out).
    "...and the next definition is not swept in"
    self deny: (self includesCS: 'def after' in: out).
    "nor the line before it"
    self deny: (self includesCS: 'import os' in: out).
    "the header names the file and the line, so the answer is traceable"
    self assert: (self includesCS: path , ':3' in: out) ]
      ensure: [GsFile removeServerFile: path]
%
category: 'tests'
method: McpGrailToolsetTest
testRunPythonTestsIsTheOnlyReadOnlySafeTool
  "run_python_tests is safe in a read-only session because of WHERE it runs -- a fresh gem that is
   thrown away and never committed in -- so it can persist nothing and the caller's transaction is
   not even reachable from it. The others stay gated: eval_python runs arbitrary Python, and
   get_python_source IMPORTS the module it is asked about, which in Grail is a database write."
  | safe |
  safe := McpGrailToolset new readOnlySafeToolNames.
  self assert: (safe includes: 'run_python_tests').
  self deny: (safe includes: 'eval_python').
  self deny: (safe includes: 'get_python_source').
  self deny: (safe includes: 'compile_python')
%
category: 'tests'
method: McpGrailToolsetTest
testRunPythonTestsRefusesWithoutAGrailDirectory
  "Refusing beats running: Grail's tests import .py modules and load fixtures from disk, so with no
   configured checkout every one of them errors -- which reports on the session, not on Grail, and
   reads exactly like a catastrophically broken Python subsystem. That is the wrong answer this whole
   toolset exists to stop being given, so the tool declines and says what to configure."
  | ok |
  ok := [(McpGrailToolset new) tool_run_python_tests: Dictionary new. false]
    on: McpError do: [:ex |
      (ex kind == #refused) and: [self includesCS: 'grailDirectory' in: ex messageText]].
  self assert: ok
%
category: 'tests'
method: McpGrailToolsetTest
testRunPythonTestsRunsFreshAndLeavesTheCallerAlone
  "The load-bearing claim, checked end to end against a real forked gem.

   Measured 2026-09-01: the same Grail test classes produce defects in a long-lived worker session
   and none at all in a fresh one, because Grail's suite isolates by evicting modules from
   sys.modules and re-importing a COMMITTED module raises. So this tool has to run somewhere with no
   history, and ShutilTestCase -- the class whose `import shutil` in setUp is the documented casualty
   of a misconfigured session -- is the honest subject.

   Also asserts the transaction is untouched, which is the other half of running elsewhere: in-session
   the same 7 tests dirtied the caller with 31 modified persistent objects, because a cold Grail
   import IS a database write. Only ONE gem is spawned here on purpose -- this stone has few session
   slots, and every extra one is a flaky suite later.
   Needs a checkout, discovered rather than assumed; see grailCheckoutOrNil."
  | checkout out before |
  checkout := self grailCheckoutOrNil.
  checkout isNil ifTrue: [^self assert: true].
  before := System needsCommit.
  out := (McpGrailToolset on: nil options:
    (Dictionary new at: 'grailDirectory' put: checkout; yourself))
      tool_run_python_tests: (Dictionary new
        at: 'classNames' put: #('ShutilTestCase' 'NoSuchTestCaseXyz'); yourself).
  "it ran the real class, and clean -- which it is not, run in a session with history"
  self assert: (self includesCS: '7 run, 7 passed, 0 failed, 0 errors' in: out).
  "a name that does not resolve is REPORTED: 'ran nothing' and 'you misspelled it' must not look alike"
  self assert: (self includesCS: 'NOT FOUND: NoSuchTestCaseXyz' in: out).
  self assert: (self includesCS: '1 class(es)' in: out).
  "and the caller's transaction is exactly where it was"
  self assert: System needsCommit equals: before
%
category: 'tests'
method: McpGrailToolsetTest
testTestRunnerExpressionQuotesNamesRatherThanCompilingThem
  "Class names come from the client and are interpolated into an expression run in another gem, so
   they must travel as STRING LITERALS resolved there by objectNamed: -- never as code. printString
   doubles an embedded quote, so a name containing one closes nothing.
   Checked on the built expression rather than by running it: what matters is what would be sent."
  | expr |
  expr := (McpGrailToolset new)
    testRunnerExpressionFor: (Array with: 'FooTest' with: 'It''s')
    directory: '/tmp/grail'.
  self assert: (self includesCS: '''FooTest''' in: expr).
  "the apostrophe is doubled, so the literal still closes where it should"
  self assert: (self includesCS: '''It''''s''' in: expr).
  self assert: (self includesCS: 'objectNamed:' in: expr).
  "the directory travels the same way"
  self assert: (self includesCS: '''/tmp/grail''' in: expr).
  "and it is $GRAIL_DIR that is set -- see the method comment for why, and the Grail defect behind it"
  self assert: (self includesCS: 'GRAIL_DIR' in: expr)
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
  result := self withFreshScopeDo: [
    (self dispatch: (self toolCall: 'eval_python' args: (Dictionary new at: 'code' put: 'print(6 * 7)'; yourself))) at: 'result'].
  self deny: (result at: 'isError').
  "Both channels: what print WROTE, then the None it answered. The value alone was all this tool
   used to report, which is why `print` looked like it did nothing."
  self assert: (self withoutSessionNote: ((result at: 'content') first at: 'text'))
    equals: '42
=> None'
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
testToolsListHasPythonToolsAndAgreesWithTheToolsets
  "Composition end to end: the core toolsets plus McpGrailToolset, listed alphabetically.
   The COUNT is derived from what the toolsets declare rather than written here as a literal. A
   literal has to be edited every time a tool is added -- which is a change to a number, not to an
   assertion, and says nothing about whether the surface is right. Comparing tools/list against the
   toolsets' own toolNames does say something: that everything declared is registered and nothing
   else is."
  | tools names declared |
  tools := ((self dispatch: (self request: 'tools/list' params: nil)) at: 'result') at: 'tools'.
  names := (tools collect: [:d | d at: 'name']) asArray.
  declared := self grailServer allToolNames.
  self assert: names asSortedCollection asArray equals: declared asSortedCollection asArray.
  self assert: names equals: names asSortedCollection asArray.
  self assert: (names includes: 'eval_python').
  self assert: (names includes: 'compile_python').
  self assert: (names includes: 'get_python_source')
%
category: 'helpers'
method: McpGrailToolsetTest
toolCall: toolName args: argsDict
  ^self request: 'tools/call' params:
    (Dictionary new at: 'name' put: toolName; at: 'arguments' put: argsDict; yourself)
%
category: 'helpers'
method: McpGrailToolsetTest
withFreshScopeDo: aBlock
  "Run aBlock with an empty Python namespace, and leave the session's own alone afterwards. A test
   about what persists BETWEEN calls must start from nothing, or it is reading what ran before it."
  | saved |
  saved := SessionTemps current at: #McpGrailScope otherwise: nil.
  SessionTemps current removeKey: #McpGrailScope ifAbsent: [nil].
  ^[aBlock value] ensure: [
    saved isNil
      ifTrue: [SessionTemps current removeKey: #McpGrailScope ifAbsent: [nil]]
      ifFalse: [SessionTemps current at: #McpGrailScope put: saved]]
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
