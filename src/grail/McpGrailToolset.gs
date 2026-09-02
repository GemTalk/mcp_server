set compile_env: 0
! ------------------- Class definition for McpGrailToolset
expectvalue /Class
doit
McpToolset subclass: 'McpGrailToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpGrailToolset comment: 
'The optional GemStone-Python (Grail) tools: eval_python, compile_python and get_python_source. Its
own source group (src/grail/) because it loads ONLY into a Grail-equipped image -- a method
referencing ModuleAst cannot be compiled without Grail present -- so it is an opt-in group
(src/grail/load.gs, filed in by install.sh --grail) rather than part of the base load.

WHY THESE TOOLS EXIST RATHER THAN JUST eval_python. Grail''s Python is not CPython on a filesystem:
modules are objects in the database, a Python class is an anonymous Smalltalk class, and the same
class carries a Smalltalk protocol (env 0) and a Python one (env 1). A generic tool pointed at that
does not merely under-serve it -- it can report confidently WRONG answers. Measured 2026-09-01:
run_test_class over Grail''s SUnit classes reported ~3,410 errors, and every one of them was an
artifact of the session rather than a defect in Grail. So a domain toolset here is not sugar; it is
how the domain avoids being misreported.

THE SESSION NAMESPACE. eval_python evaluates into ONE module scope per worker gem, held in
SessionTemps, so a binding made by one call is visible to the next -- `counter = 41` then `counter`.
Without it every call was a blank slate while imports (sys.modules is session-local) persisted, so the
surface LOOKED stateful and was not, which is the worst of both. Each client has its own worker gem,
so one client''s namespace is invisible to every other.

A toolset rather than a server subclass, which is the point: python tools can now be combined with
anyone else''s tools, whereas the old McpServerWithGrail was a rung in the hierarchy that a developer
wanting python tools AND their own had to inherit from. It is picked up automatically by
McpServer class>>installedDefaultToolsetNames once this group is loaded, or named explicitly in a
router''s toolsetNames.

Like every toolset it owns its handlers (see McpToolset), and needing no server-level policy it never
touches `server` at all -- so it also serves as the worked example for a third-party toolset, now
including how a toolset takes DEPLOYMENT CONFIGURATION (class>>declaredOptionNames -- grailDirectory).
NOT read-only-safe: readOnlySafeToolNames is inherited (empty), so a read-only session drops every one
of these tools. Running arbitrary Python can persist anything, and even get_python_source imports the
module it is asked about, which in Grail is a database write.

The handlers DO catch Python exceptions, unlike every core tool, and they have to: Grail models them
outside the Smalltalk Error hierarchy (NameError is Exception < BaseException < Exception <
AbstractException, and `NameError inheritsFrom: Error` is false), so McpDispatcher''s `on: Error do:`
cannot see them. Uncaught, a python-tool error would escape the dispatcher and take the whole worker
gem down instead of answering the client. withPythonErrorsAsMcpError: converts them into an McpError
kinded #pythonError, which the dispatcher then reports as an ordinary isError result. Smalltalk Errors
are deliberately left to the dispatcher, which already classifies them.

No ModuleAst capability check is performed: this group only loads into an image that has Grail.'
%
expectvalue /Class
doit
McpGrailToolset category: 'Mcp-Grail'
%
! ------------------- Remove existing behavior from McpGrailToolset
removeallmethods McpGrailToolset
removeallclassmethods McpGrailToolset
! ------------------- Class methods for McpGrailToolset
category: 'options'
classmethod: McpGrailToolset
declaredOptionNames
  "grailDirectory -- the Grail CHECKOUT this deployment runs against, e.g. '/opt/Grail'.

   Grail''s Python lives in the image, but its .py stdlib and its test fixtures live on DISK under
   that checkout, and a session finds them through importlib grailDir. A session that sets nothing
   gets a lazy guess (importlib class>>___resolveGrailDir___): $GRAIL_DIR, else the gem''s working
   directory. For a worker gem that guess is the STONE''s directory, which holds no src/python/stdlib
   -- so every .py-backed import fails, and a tool that runs Grail''s tests reports thousands of
   failures that do not exist.

   It is deployment knowledge, not something a worker can work out, which is why it is configured
   rather than probed."
  ^#( 'grailDirectory' )
%
! ------------------- Instance methods for McpGrailToolset
category: 'private'
method: McpGrailToolset
ensureGrailConfigured
  "Point this session at the configured Grail checkout, if a deployment named one
   (declaredOptionNames). Cheap and idempotent; every handler sends it first.

   Sets BOTH the session value and the gem environment variable, because they are read by different
   consumers rather than one being a fallback for the other: importlib grailDir is what the Smalltalk
   module resolver uses, while $GRAIL_DIR is what Grail's PYTHON-side importlib reads directly
   (src/python/stdlib/importlib/__init__.py find_spec) and what its runner scripts export. Setting
   only the first leaves the Python side pointed somewhere else.

   Without a configured directory this does nothing, and Grail falls back to resolving one itself
   (importlib class>>___resolveGrailDir___: $GRAIL_DIR, else the gem's working directory). For a
   worker gem that fallback lands on the STONE's directory, which holds no src/python/stdlib -- so
   every .py-backed import fails. That is worth configuring rather than guessing at."
  | dir |
  dir := self grailDirectory.
  dir isNil ifTrue: [^self].
  [importlib grailDir: dir.
   System gemEnvironmentVariable: 'GRAIL_DIR' put: dir] on: Error do: [:ex | nil].
  ^self
%
category: 'private'
method: McpGrailToolset
evaluatePython: aSourceString
  "Evaluate aSourceString in THIS session's persistent Python namespace and answer the value.
   Python exceptions propagate -- callers wrap them (withPythonErrorsAsMcpError: or the traceback
   path in tool_eval_python:).

   Mirrors what Grail's own PythonTestCase>>eval: does, with one change that is the whole point: the
   module scope is fetched from the session rather than made fresh, so bindings persist between
   calls. The scope is inserted at position 1 of a FRESH copy of the compile symbol list each time
   (___grailCompileSymbolList___ answers a new list), so nothing accumulates in the symbol list
   itself."
  | list module scope |
  scope := self pythonScope.
  list := importlib ___grailCompileSymbolList___.
  list insertObject: scope at: 1.
  module := ModuleAst parseSource: aSourceString.
  module useTempsForBlock: false.
  module ensureModuleScope: scope.
  ^module evaluateWithScope: list
%
category: 'private'
method: McpGrailToolset
firstContentIndexIn: aLine
  "The index of the first character of aLine that is not a space, tab, cr or lf, or 0 when there is
   none (a blank line). The one place this toolset decides what 'blank' and 'indented' mean."
  1 to: aLine size do: [:i | | c |
    c := aLine at: i.
    ((c = Character space) or: [(c = Character tab)
      or: [(c = Character cr) or: [c = Character lf]]]) ifFalse: [^i]].
  ^0
%
category: 'private'
method: McpGrailToolset
grailDirectory
  "The Grail checkout this deployment configured, or nil. See class>>declaredOptionNames."
  ^self optionNamed: 'grailDirectory' ifAbsent: [nil]
%
category: 'private'
method: McpGrailToolset
headed: aPath line: aLineNumber body: lineCollection
  "A source block with its `# <path>:<line>` header, trailing blank lines removed."
  | body |
  body := lineCollection asOrderedCollection.
  [body notEmpty and: [(self firstContentIndexIn: body last) = 0]] whileTrue: [body removeLast].
  ^'# ' , aPath , ':' , aLineNumber printString , Character lf asString
    , (body inject: '' into: [:acc :l | acc , l])
%
category: 'private'
method: McpGrailToolset
pythonMessageFor: anException
  "The one-line 'Class: detail' for a Python exception -- the fallback when no traceback could be
   built, and what withPythonErrorsAsMcpError: reports.
   The class name is prepended only when the detail does not ALREADY begin with it: Grail's
   #description does (measured, `ValueError` / 'ValueError: boom'), so prefixing unconditionally read
   'ValueError: ValueError: boom'. The test is on the detail rather than a rule about Grail, because
   the no-detail path below produces a string with no class name at all. Compared with copyFrom:/=
   rather than includesString:, which is case-INsensitive in GemStone."
  | name detail |
  name := anException class name asString.
  detail := [anException description] on: Error do: [:x | nil].
  detail := detail isNil ifTrue: ['(no detail available)'] ifFalse: [detail asString].
  ^(detail size >= name size and: [(detail copyFrom: 1 to: name size) = name])
    ifTrue: [detail]
    ifFalse: [name , ': ' , detail]
%
category: 'private'
method: McpGrailToolset
pythonScope
  "This session's persistent Python namespace: one SymbolDictionary, created on first use and kept in
   SessionTemps for the life of the worker gem. Per gem means per CLIENT (each MCP session gets its
   own worker), so no client can see or disturb another's bindings.

   NB the explicit nil test rather than at:otherwise:, whose second argument is a VALUE and not a
   block: written that way this minted a fresh dictionary on every send and stored it, so the
   namespace was destroyed by the very method that was supposed to keep it -- twice per evaluation,
   since evaluatePython: asks for it more than once."
  | scope |
  scope := SessionTemps current at: #McpGrailScope otherwise: nil.
  scope isNil ifTrue: [
    scope := SymbolDictionary new.
    SessionTemps current at: #McpGrailScope put: scope].
  ^scope
%
category: 'private'
method: McpGrailToolset
pythonTracebackFor: anException
  "The formatted Python traceback for anException, or nil if one cannot be produced.

   Worth the trouble because Grail already computes this well -- multi-frame, with real line numbers
   -- and reporting only `KeyError: 'missing'` throws away the part that says WHERE.

   Two steps. An exception that reaches a Smalltalk on:do: has no __traceback__ yet: Grail attaches
   frames on the Python catch path (TryAst -> ___pushCatchingFrame___:pos:), which we are not on. But
   the VM stack capture it needs is already on the exception (_gsStack), so asking it to build from
   that produces the same frames. Then Python's own traceback module formats it, reached by binding
   the exception into the session namespace -- which is simply the mechanism this toolset already has.

   ___buildFramesFromCapturedStack___:pos:freshRaise: is a Grail INTERNAL (the ___ naming says so),
   and using it couples this to Grail's internals. There is no public equivalent for 'materialize the
   traceback of an exception caught outside Python', which is worth asking Grail for. Until then the
   whole thing is guarded and answers nil on any failure, so a Grail change costs the traceback and
   never the tool.

   NB this needs Grail's `traceback` module, which is a .py under the CHECKOUT -- so a session with
   no grailDirectory configured cannot format one and answers nil here. That is why the caller falls
   back to pythonMessageFor: rather than treating nil as impossible: an unconfigured deployment still
   gets a usable error, just without the frames."
  ^[anException ___buildFramesFromCapturedStack___: nil pos: nil freshRaise: true.
    self pythonScope at: #_mcp_exc put: anException.
    self evaluatePython: 'import traceback
"".join(traceback.format_exception(_mcp_exc))']
    on: Error, BaseException do: [:ex | nil]
%
category: 'registration'
method: McpGrailToolset
registerOn: aToolRegistry
  "Register the python tools. These require an image with GemStone-Python (Grail/ModuleAst);
   no capability check is performed, since this package cannot load without it."
  | codeArg |
  codeArg := self objectSchema:
    (Dictionary new at: 'code' put: (self propString: 'Python source code'); yourself)
    required: (Array with: 'code').
  aToolRegistry name: 'compile_python'
    description: 'Transpile Python source to Smalltalk via Grail (ModuleAst) and return the generated Smalltalk source. Requires GemStone-Python in the image.'
    inputSchema: codeArg do: [:args | self tool_compile_python: args].
  aToolRegistry name: 'eval_python'
    description: 'Evaluate Python source via Grail. Names bound here persist for the rest of this session, as in a REPL. Returns anything printed, then the repr of the value; on failure, the Python traceback.'
    inputSchema: codeArg do: [:args | self tool_eval_python: args].
  aToolRegistry name: 'get_python_source'
    description: 'Source of a Python module, class or function in the image, named dotted (e.g. "gemdb.transaction"). Reads the .py the object was loaded from, so it answers the docstring and body even where the image itself has lost them.'
    inputSchema: (self objectSchema:
      (Dictionary new at: 'name' put:
        (self propString: 'Dotted name, e.g. "gemdb", "gemdb.transaction" or "json.JSONDecoder"');
        yourself)
      required: (Array with: 'name'))
    do: [:args | self tool_get_python_source: args].
  ^self
%
category: 'private'
method: McpGrailToolset
renderValue: aValue printed: aStringOrNil
  "What eval_python answers: anything the code printed, then its value.
   With no output this is just the repr on one line, so the ordinary case reads exactly as it always
   did and nothing has to be stripped. With output, the `=> ` marker separates the two channels --
   which matters because printed text is arbitrary and could otherwise be mistaken for the value."
  | repr |
  repr := self reprOf: aValue.
  (aStringOrNil isNil or: [aStringOrNil isEmpty]) ifTrue: [^repr].
  ^aStringOrNil asString
    , ((aStringOrNil last = Character lf) ifTrue: [''] ifFalse: [String with: Character lf])
    , '=> ' , repr
%
category: 'private'
method: McpGrailToolset
reprOf: aValue
  "Python's repr of aValue, falling back to the Smalltalk printString if repr cannot be taken.
   A Python surface should answer Python's rendering: printString shows an OrderedCollection where
   the caller asked for a list, and truncates by Smalltalk's rules rather than Python's."
  ^[(builtins ___instance___) @env1:repr: aValue]
    on: Error, BaseException
    do: [:ex | [aValue printString] on: Error do: [:e | '(unprintable)']]
%
category: 'private'
method: McpGrailToolset
sourceFrom: aPath startingAt: aLineNumber label: aName
  "Read aPath and answer the definition beginning at aLineNumber, headed by a `# <path>:<line>` line
   so the caller can go and look. aLineNumber 0 means the whole file (a module).

   The definition ends at the first line after it that is neither blank nor indented -- Python's own
   block rule, which needs no parser and no knowledge of decorators, nesting or continuation lines.
   Blank lines are kept rather than ending the block, and trailing ones are dropped so a definition
   does not come back padded to the next one."
  | f all keep done |
  f := GsFile openReadOnServer: aPath.
  f isNil ifTrue: [
    ^McpError signalKind: #notFound message:
      'Cannot read ' , aPath , ' for ' , aName , '. The file the image recorded is not readable from '
        , 'this gem -- if this deployment names a Grail checkout (the grailDirectory option), check '
        , 'it is the one this image was installed from.'].
  all := OrderedCollection new.
  [ | line | [(line := f nextLine) isNil] whileFalse: [all add: line] ] ensure: [f close].
  aLineNumber = 0 ifTrue: [^self headed: aPath line: 1 body: all].
  keep := OrderedCollection new.
  done := false.
  aLineNumber to: all size do: [:i | | l |
    done ifFalse: [
      l := all at: i.
      (i > aLineNumber and: [self startsABlockAfter: l])
        ifTrue: [done := true]
        ifFalse: [keep add: l]]].
  ^self headed: aPath line: aLineNumber body: keep
%
category: 'private'
method: McpGrailToolset
startsABlockAfter: aLine
  "Whether aLine ends the definition that preceded it -- i.e. it has content and begins at column
   zero. Python's own block rule: a definition continues through every indented and blank line and
   stops at the next unindented statement.
   Written with at:/size alone rather than a trimming selector, because this toolset should file into
   as many GemStone versions as the rest of the server does and #withoutTrailingSeparators is not
   present in all of them (measured missing on 3.7.5)."
  ^(self firstContentIndexIn: aLine) = 1
%
category: 'tools - python'
method: McpGrailToolset
tool_compile_python: args
  "Transpile Python source to Smalltalk via Grail and answer the generated source. capResult: is the
   shared 50k output cap (McpToolset); Python errors become #pythonError (withPythonErrorsAsMcpError:)."
  self ensureGrailConfigured.
  ^self withPythonErrorsAsMcpError: [
    self capResult: (ModuleAst parseSource: (args at: 'code')) smalltalkSource]
%
category: 'tools - python'
method: McpGrailToolset
tool_eval_python: args
  "Evaluate Python source in this session's persistent namespace and report what happened.

   Three channels rather than one value, because they answer different questions and merging them
   loses two of the three:
     - anything the code PRINTED. Discarding it meant `print(x)` answered `None` and the thing the
       caller asked to see was gone -- and most real Python prints.
     - the VALUE, as Python's repr.
     - on failure, the TRACEBACK, which says where.
   Printed output is shown first and the value after a `=>` marker, so the common case (no output)
   is still just the value on one line and nothing has to be parsed off.

   stdout is captured by redirecting sys.stdout around the evaluation, restored in an ensure: so a
   raise cannot leave this session's stdout pointing at a dead buffer.

   Python errors become #pythonError (withPythonErrorsAsMcpError:) carrying the traceback where one
   could be built and the one-line message otherwise -- so this degrades to the old behavior rather
   than failing if Grail's internals move."
  | src value printed failure redirected |
  self ensureGrailConfigured.
  src := args at: 'code'.
  failure := nil.
  printed := nil.
  redirected := [self evaluatePython: 'import sys as _mcp_sys, io as _mcp_io
_mcp_prev_stdout = _mcp_sys.stdout
_mcp_sys.stdout = _mcp_io.StringIO()
True'] on: Error, BaseException do: [:ex | nil].
  [value := [self evaluatePython: src] on: BaseException do: [:ex | failure := ex. nil]]
    ensure: [
      redirected == true ifTrue: [
        printed := [self evaluatePython: '_mcp_captured = _mcp_sys.stdout.getvalue()
_mcp_sys.stdout = _mcp_prev_stdout
_mcp_captured'] on: Error, BaseException do: [:ex | nil]]].
  failure ifNotNil: [:ex | | detail |
    detail := (self pythonTracebackFor: ex) ifNil: [self pythonMessageFor: ex].
    ^McpError signalKind: #pythonError message: (self capResult: detail)].
  ^self capResult: (self renderValue: value printed: printed)
%
category: 'tools - python'
method: McpGrailToolset
tool_get_python_source: args
  "Answer the source of a Python module, class or function named dotted.

   Why this is a tool rather than `eval_python(''inspect.getsource(x)'')`: in the image that call
   answers an EMPTY STRING -- not an error, not the source -- and a compiled def''s __doc__ reads as
   None, so neither the body nor the docstring is reachable the obvious way. What IS reliable is
   __code__: co_filename and co_firstlineno are correct, the .py they name is on disk under the
   Grail checkout, and the worker gem can read it. So this asks Python where the thing came from and
   then reads the file, recovering exactly what the image has lost.

   The end of a definition is found by INDENTATION -- the first later line that is neither blank nor
   indented -- which is how Python delimits a block and needs no parser. A module answers its whole
   file. Both are capped by capResult:."
  | name located path firstLine |
  self ensureGrailConfigured.
  ^self withPythonErrorsAsMcpError: [
    name := (args at: 'name') asString.
    self pythonScope at: #_mcp_name put: name.
    located := self evaluatePython: 'import importlib as _mcp_il, sys as _mcp_sys
def _mcp_locate(dotted):
    parts = dotted.split(".")
    obj = None
    for i in range(len(parts), 0, -1):
        head = ".".join(parts[:i])
        try:
            obj = _mcp_il.import_module(head)
        except BaseException:
            continue
        for p in parts[i:]:
            obj = getattr(obj, p)
        break
    if obj is None:
        return []
    code = getattr(obj, "__code__", None)
    if code is not None:
        return [code.co_filename, code.co_firstlineno]
    f = getattr(obj, "__file__", None)
    if f is not None:
        return [f, 0]
    return []
_mcp_locate(_mcp_name)'.
    "Both failure paths answer an empty LIST rather than None, and this tests emptiness rather than
     nil, because Python's None is a NoneType INSTANCE and not Smalltalk nil -- an isNil test here
     silently never fires, and the miss then surfaced as a TypeError from subscripting None."
    (located isNil or: [(located isKindOf: Collection) not or: [located isEmpty]]) ifTrue: [
      ^McpError signalKind: #notFound message:
        'No source location for ' , name , '. It may be a Smalltalk-implemented (native) module, a '
          , 'class rather than a function, or simply unbound -- native modules have no .py to read.'].
    path := (located @env1:__getitem__: 0) asString.
    firstLine := (located @env1:__getitem__: 1).
    self capResult: (self sourceFrom: path startingAt: firstLine label: name)]
%
category: 'accessing'
method: McpGrailToolset
toolNames
  ^#( 'compile_python' 'eval_python' 'get_python_source' )
%
category: 'private'
method: McpGrailToolset
withPythonErrorsAsMcpError: aBlock
  "Run aBlock, converting a PYTHON exception into an McpError kinded #pythonError so the dispatcher
   answers the client an ordinary tool error. Required because Grail's Python exceptions are not
   Error subclasses (see the class comment), so McpDispatcher's `on: Error do:` cannot catch them and
   an uncaught one would take the worker gem down. Catches BaseException, the root of Python's own
   hierarchy -- deliberately NOT AbstractException, which would also swallow halts and interrupts,
   and deliberately not Smalltalk Errors, which the dispatcher already classifies.

   The class name is prepended only when the detail does not ALREADY begin with it. Grail's
   #description does begin with it -- measured, `ValueError` / 'ValueError: boom' -- so prefixing
   unconditionally reported every Python error twice over ('ValueError: ValueError: boom'). The test
   is on the detail rather than a fixed rule about Grail, because #description belongs to Grail and
   the fallback path below produces a string with no class name at all; both must read correctly.
   Compared with copyFrom:/= rather than includesString:, which is case-INsensitive in GemStone."
  ^[aBlock value]
    on: BaseException
    do: [:ex | | name detail |
      name := ex class name asString.
      detail := [ex description] on: Error do: [:x | nil].
      detail := detail isNil
        ifTrue: ['(no detail available)']
        ifFalse: [detail asString].
      McpError signalKind: #pythonError message:
        ((detail size >= name size and: [(detail copyFrom: 1 to: name size) = name])
          ifTrue: [detail]
          ifFalse: [name , ': ' , detail])]
%
