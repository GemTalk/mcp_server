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
'The optional GemStone-Python (Grail) tools: eval_python, compile_python, get_python_source,
describe_python_class, list_python_methods, python_module_state and run_python_tests. Its
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
Read-only-safe: python_module_state (which only reads) and run_python_tests (which writes, but in a
fresh gem that is thrown away and never committed in). Every other tool is dropped in a read-only
session: running arbitrary Python can persist anything, and the browsing tools RESOLVE their subject,
which imports the module it lives in -- and in Grail a cold import is a database write.

BROWSING A PYTHON CLASS IS NOT BROWSING A SMALLTALK ONE. Grail creates every user Python class
anonymously (inDictionary: nil), so no symbol dictionary names it and list_classes cannot see it at
all; it is reachable only by its PYTHON name. Hence describe_python_class and list_python_methods,
which resolve THROUGH PYTHON rather than through GrailCanonicalClasses -- the registry records
module-scope class statements only (never a nested class) and is emptied wholesale by the generation
guard after a Grail install, so it is a useful first look and a poor sole source.

RUNNING GRAIL''S TESTS NEEDS A SESSION WITH NO HISTORY, which is why run_python_tests forks a gem
rather than running where it was called. Grail''s suite isolates tests by evicting framework modules
from sys.modules, and re-importing a COMMITTED module raises -- so a long-lived worker, which is
exactly the session that accumulates that state, cannot report the truth about it. Measured on the
same three classes: 132 defects in a worker session, 386/386 clean in a fresh one.

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
canonicalClassNamed: aName
  "The Smalltalk class behind the Python class aName, or refuse (#notFound) saying what to try.

   RESOLVED THROUGH PYTHON, not through the GrailCanonicalClasses registry, with the registry only as
   a cheap first look. Two reasons, and the second is the one that decides it:

   - the registry is a SUBSET of what exists. It records module-scope class statements only, so a
     nested class (Outer.Inner) is never in it, and a class whose name the body later rebinds is in
     it under a name the module no longer uses.
   - it is routinely EMPTY. The generation guard drops the whole registry the first time a session
     touches Grail after an install (departure D7 -- see deploymentGenerationNote), so on a normal
     working image `at: key` answers nothing for classes that plainly exist.

   Importing to resolve is not a side effect worth avoiding here: a class can only be described if it
   has been built, and building it is what import means in this image."
  | reg key obj |
  key := self canonicalKeyFor: aName.
  reg := System myUserProfile objectNamed: #GrailCanonicalClasses.
  reg ifNotNil: [
    (reg at: key ifAbsent: [nil]) ifNotNil: [:c | (c isKindOf: Behavior) ifTrue: [^c]]].
  obj := self resolvePythonObjectNamed: key.
  obj isNil ifTrue: [
    ^McpError signalKind: #notFound message:
      'No Python class ' , aName printString , ' could be resolved. ' , (self classLookupHintFor: aName)].
  (obj isKindOf: Behavior) ifFalse: [
    ^McpError signalKind: #notFound message:
      aName , ' resolved, but to a ' , obj class name asString , ' rather than a class. '
        , 'For a function or a module use get_python_source.'].
  ^obj
%
category: 'private'
method: McpGrailToolset
canonicalKeyFor: aName
  "The GrailCanonicalClasses key for aName: itself when it is already dotted, otherwise the single
   'module.aName' key that ends in it. Answers aName unchanged when nothing matches, so the caller
   reports a miss on the name the user actually gave."
  | reg suffix hits |
  ((aName findString: '.' startingAt: 1) > 0) ifTrue: [^aName].
  reg := System myUserProfile objectNamed: #GrailCanonicalClasses.
  reg isNil ifTrue: [^aName].
  suffix := '.' , aName.
  hits := OrderedCollection new.
  reg keysDo: [:k | (self string: k asString endsWith: suffix) ifTrue: [hits add: k asString]].
  ^hits size = 1 ifTrue: [hits first] ifFalse: [aName]
%
category: 'private'
method: McpGrailToolset
classAttributeNamesOf: aClass
  "The Python class attributes aClass declares: the class-side instVars its body created, minus the
   ones every GemStone class object has. Reported because a class attribute in Grail is a class-side
   slot rather than a dictionary entry, so nothing in the Smalltalk browsing tools presents it as an
   attribute at all."
  | mine kernel |
  mine := [aClass class allInstVarNames] on: Error do: [:ex | #()].
  kernel := [Object class allInstVarNames] on: Error do: [:ex | #()].
  ^((mine collect: [:n | n asString]) reject: [:n |
      (kernel anySatisfy: [:k | k asString = n]) or: [self isGrailInternalName: n]]) asArray
%
category: 'private'
method: McpGrailToolset
classLookupHintFor: aName
  "What to try after a class lookup missed -- the registered names that end in the same thing, or a
   word about why the registry may be thinner than expected. A miss is far more often a module
   that has not been imported in a committing session than a typo."
  | reg suffix hits |
  reg := System myUserProfile objectNamed: #GrailCanonicalClasses.
  reg isNil ifTrue: [^''].
  suffix := '.' , ((aName findString: '.' startingAt: 1) > 0
    ifTrue: [self lastDotSegmentOf: aName]
    ifFalse: [aName]).
  hits := OrderedCollection new.
  reg keysDo: [:k |
    (hits size < 8 and: [self string: k asString endsWith: suffix]) ifTrue: [hits add: k asString]].
  hits isEmpty ifFalse: [
    ^'Registered under: ' , (self commaListOf: hits) , '.'].
  ^'Only classes from a module imported in a session that COMMITTED are registered, and a Grail '
    , 'install invalidates the lot (see python_module_state, which reports that). Import the module '
    , 'first, or check the name.'
%
category: 'private'
method: McpGrailToolset
colonCountIn: aString
  | n |
  n := 0.
  1 to: aString size do: [:i | (aString at: i) = $: ifTrue: [n := n + 1]].
  ^n
%
category: 'private'
method: McpGrailToolset
commaListOf: aCollection
  "aCollection as 'a, b, c', or '(none)'. Tolerates a Python tuple/list as readily as a Smalltalk one
   -- both answer do:."
  | s any |
  aCollection isNil ifTrue: [^'(none)'].
  s := WriteStream on: String new.
  any := false.
  [aCollection do: [:e |
    any ifTrue: [s nextPutAll: ', '].
    s nextPutAll: ([e isString ifTrue: [e asString] ifFalse: [e printString]]
      on: Error do: [:ex | '?']).
    any := true]] on: Error, BaseException do: [:ex | nil].
  ^any ifTrue: [s contents] ifFalse: ['(none)']
%
category: 'private'
method: McpGrailToolset
commonSourceFileFor: aMethodNameCollection from: aCodeTableOrNil
  "The one .py file every method of aMethodNameCollection came from, or nil when they disagree or
   none is known. They disagree legitimately -- an inherited method reports the file it was DEFINED
   in -- so this answers nil rather than picking, and the caller then prints a full path per method."
  | file |
  aCodeTableOrNil isNil ifTrue: [^nil].
  file := nil.
  aMethodNameCollection do: [:m | | loc f |
    loc := self sourceLocationFor: m from: aCodeTableOrNil.
    loc ifNotNil: [
      f := self fileOfLocation: loc.
      file isNil
        ifTrue: [file := f]
        ifFalse: [file = f ifFalse: [^nil]]]].
  ^file
%
category: 'private'
method: McpGrailToolset
deploymentGenerationNote
  "A warning when this image's DEPLOYMENTS have been invalidated wholesale, or nil when they have not.

   Grail's departure D7: installing Grail bumps GrailRuntimeGeneration, and every canonical module
   deployed before that bump is stale by definition -- the generation guard drops the whole registry
   the first time a session touches Grail. So a module can be committed and still report `canonical:
   no`, which is true and, on its own, baffling: the entry is there in a virgin view and gone the
   moment anything runs.

   Worth a line of its own rather than folding into the per-module answer, because it is a property
   of the IMAGE and the remedy is one command for all of them at once."
  | runtime deployed |
  runtime := System myUserProfile objectNamed: #GrailRuntimeGeneration.
  deployed := System myUserProfile objectNamed: #GrailCanonicalDeployGeneration.
  (runtime isNil or: [deployed isNil]) ifTrue: [^nil].
  runtime = deployed ifTrue: [^nil].
  ^'NOTE: this image''s deployments are invalidated. Grail has been installed since anything was '
    , 'deployed (runtime generation ' , runtime printString , ', deployed at ' , deployed printString
    , '), so the generation guard drops every canonical module the first time a session touches '
    , 'Grail -- which is why a committed module can still read "canonical: no" here. Imports are '
    , 'cold until the frameworks are deployed again (scripts/deployFrameworks.gs in the checkout). '
    , 'Nothing is broken by this; it is only slower.'
%
category: 'private'
method: McpGrailToolset
dottedSegmentsOf: aName
  "'a.b.c' as ('a' 'b' 'c'). Empty segments are dropped, so a stray dot cannot make a nameless step."
  | out s start |
  s := aName asString.
  out := OrderedCollection new.
  start := 1.
  1 to: s size do: [:i |
    (s at: i) = $. ifTrue: [
      i > start ifTrue: [out add: (s copyFrom: start to: i - 1)].
      start := i + 1]].
  s size >= start ifTrue: [out add: (s copyFrom: start to: s size)].
  ^out asArray
%
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
fileOfLocation: aLocation
  "'/a/b.py' from '/a/b.py:12'. Cut at the LAST colon: a path may contain one, a line number may not."
  | idx |
  idx := self lastColonIn: aLocation.
  ^idx = 0 ifTrue: [aLocation] ifFalse: [aLocation copyFrom: 1 to: idx - 1]
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
importPythonModuleNamed: aName
  "The module object for aName, importing it if need be, or nil when it cannot be imported.
   One straight-line Python expression; the name travels through the session scope rather than being
   spliced into source, so a name with a quote in it cannot close the literal."
  ^[self pythonScope at: #_mcp_mod_name put: aName asString.
    self evaluatePython: 'import importlib as _mcp_il
_mcp_il.import_module(_mcp_mod_name)']
    on: Error, BaseException do: [:ex | nil]
%
category: 'private'
method: McpGrailToolset
isGrailInternalName: aName
  "Whether aName is one of Grail's own ___like_this___ slots rather than something the Python
   programmer wrote. Three underscores each end is the convention, and it matters that the test is
   THREE: a Python dunder is two (__init__), and treating those as internal would hide most of a
   class."
  | s |
  s := aName asString.
  s size < 7 ifTrue: [^false].
  ^((s copyFrom: 1 to: 3) = '___') and: [(s copyFrom: s size - 2 to: s size) = '___']
%
category: 'private'
method: McpGrailToolset
isNativeModuleNamed: aName
  "Whether aName is one of Grail's NATIVE modules -- os, sys, math, gemstone, ... -- hand-written
   Smalltalk `module` subclasses in the Python dictionary, installed and committed by install.sh.
   They never go through loadModuleFromPath:, are never canonically bound, and have no .py, so most
   of what the state tool reports does not apply to them and saying so is better than reporting a
   string of noes."
  | d cls |
  d := self dictNamed: 'Python'.
  d isNil ifTrue: [^false].
  cls := d at: aName asSymbol otherwise: nil.
  ^(cls isKindOf: Behavior) and: [
    [cls == module or: [cls inheritsFrom: module]] on: Error do: [:ex | false]]
%
category: 'private'
method: McpGrailToolset
joinSegments: anArray upTo: aCount
  | s |
  s := WriteStream on: String new.
  1 to: aCount do: [:i |
    i > 1 ifTrue: [s nextPut: $.].
    s nextPutAll: (anArray at: i)].
  ^s contents
%
category: 'private'
method: McpGrailToolset
lastColonIn: aString
  | last |
  last := 0.
  1 to: aString size do: [:i | (aString at: i) = $: ifTrue: [last := i]].
  ^last
%
category: 'private'
method: McpGrailToolset
lastDotSegmentOf: aName
  "The part of a dotted name after its last dot."
  | s idx last |
  s := aName asString.
  last := 0.
  idx := 1.
  [idx := s findString: '.' startingAt: idx. idx = 0] whileFalse: [last := idx. idx := idx + 1].
  ^last = 0 ifTrue: [s] ifFalse: [s copyFrom: last + 1 to: s size]
%
category: 'private'
method: McpGrailToolset
lineOfLocation: aLocation
  "'12' from '/a/b.py:12', or '?' when the location carries no line."
  | idx |
  idx := self lastColonIn: aLocation.
  ^idx = 0 ifTrue: ['?'] ifFalse: [aLocation copyFrom: idx + 1 to: aLocation size]
%
category: 'private'
method: McpGrailToolset
newGrailTestSession
  "A fresh, logged-in gem to run Grail's tests in. Built exactly as McpSession builds a worker --
   newDefault plus an explicit localhost NRS rather than newDefaultForGemHost:, which does not exist
   on 3.7.2 -- and logged in as the current user with a one-time password, so it needs no credentials
   and inherits this session's permissions and nothing else.
   The caller logs it out in an ensure:. Nothing is ever committed in it, so a run leaves the
   repository as it found it whether it ends well or badly."
  | sess |
  sess := GsTsExternalSession newDefault
    gemNRS: (GsNetworkResourceString defaultGemNRSFromCurrent node: 'localhost'; yourself);
    yourself.
  sess onetimePassword: (GsCurrentSession currentSession createOnetimePasswordValidForSeconds: 300).
  sess login.
  ^sess
%
category: 'private'
method: McpGrailToolset
nextImportFor: aName inSys: inSys committed: committed hashCurrent: hashCurrent importedEarlier: importedEarlier native: native path: pathOrNil
  "One sentence saying what `import <aName>` would do from here -- the line the other facts exist to
   support, and the one an agent can act on.

   The RAISES case is Grail's departure D6 and is reproduced from the condition importlib itself
   tests (loadModuleFromPath:name:): a committed instance whose source still matches, which THIS
   session imported and then removed from sys.modules. It is the state a test suite reaches by
   isolating itself, and the one that makes a healthy image look broken."
  inSys ifTrue: [^'nothing -- it is already in this session''s sys.modules.'].
  native ifTrue: [^'binds the native Smalltalk module; nothing is compiled and nothing persists.'].
  (committed and: [hashCurrent and: [importedEarlier]]) ifTrue: [
    ^'RAISES. It is deployed, and this session imported it and then removed it from sys.modules -- '
      , 'Grail treats that as a deliberate request to re-execute and refuses to silently re-bind. '
      , 'Use importlib.reload(), or start a fresh session.'].
  (committed and: [hashCurrent]) ifTrue: [
    ^'BINDS the committed instance -- no compiling, and the module body does not run.'].
  (committed and: [hashCurrent not]) ifTrue: [
    ^'REBUILDS it: the committed compile is stale against the .py, so the body runs again. That is a '
      , 'database write, and it is uncommitted until you commit it.'].
  pathOrNil isNil ifTrue: [
    ^'FAILS -- no .py for it was found on this session''s search path. If that is a surprise, check '
      , 'the grailDirectory this server was configured with.'].
  ^'compiles it COLD: the body runs and its module class is written to the database, uncommitted '
    , 'until you commit it.'
%
category: 'private'
method: McpGrailToolset
placeholderArgs: aCount
  "'a1, a2, a3' -- names a selector cannot supply, made obviously positional."
  | s |
  aCount = 0 ifTrue: [^''].
  s := WriteStream on: String new.
  1 to: aCount do: [:i |
    i > 1 ifTrue: [s nextPutAll: ', '].
    s nextPutAll: 'a' , i printString].
  ^s contents
%
category: 'private'
method: McpGrailToolset
pyAttr: aSelector of: aClass default: aDefault
  "An env-1 class attribute of aClass (__module__, __bases__, __doc__, ...), or aDefault. Guarded
   because each is a Python-side read that a class may simply not carry."
  ^[aClass perform: aSelector env: 1] on: Error, BaseException do: [:ex | aDefault]
%
category: 'private'
method: McpGrailToolset
pyClassNamesOf: aTupleOrNil
  "The Python names in a __bases__ / __mro__ tuple. Each element is a CLASS, whose Python name is its
   Smalltalk class name -- Grail bridges cls.__name__ to Behavior>>name -- so this reads them
   directly rather than sending __name__ to each and risking a raise per element."
  | s any |
  aTupleOrNil isNil ifTrue: [^'(unknown)'].
  s := WriteStream on: String new.
  any := false.
  [aTupleOrNil do: [:c |
    any ifTrue: [s nextPutAll: ', '].
    s nextPutAll: ([c name asString] on: Error do: [:ex | '?']).
    any := true]] on: Error, BaseException do: [:ex | nil].
  ^any ifTrue: [s contents] ifFalse: ['(none)']
%
category: 'private'
method: McpGrailToolset
pythonAttribute: anAttrName of: anObject
  "getattr(anObject, anAttrName), or nil when it is absent or raises."
  ^[self pythonScope at: #_mcp_attr_owner put: anObject.
    self pythonScope at: #_mcp_attr_name put: anAttrName asString.
    self evaluatePython: 'getattr(_mcp_attr_owner, _mcp_attr_name)']
    on: Error, BaseException do: [:ex | nil]
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
pythonMethodNamesOf: aClass
  "aClass's Python method names, in the order its class body bound them where that is recorded
   (___classBodyOrder___) and alphabetically otherwise. Grail's own ___internal___ slots and the
   non-callable class attributes are left out: what is wanted is the methods the Python programmer
   wrote."
  | order names sigs |
  sigs := [aClass @env1:___methodSignatureTable___] on: Error, BaseException do: [:ex | nil].
  order := [aClass @env1:___classBodyOrder___] on: Error, BaseException do: [:ex | nil].
  names := OrderedCollection new.
  order ifNotNil: [
    [order do: [:n | | s |
      s := n asString.
      ((self isGrailInternalName: s) not
        and: [sigs isNil or: [sigs includesKey: s]]) ifTrue: [names add: s]]]
      on: Error, BaseException do: [:ex | nil]].
  names isEmpty ifFalse: [^names asArray].
  "No usable body order: fall back to whatever declares methods."
  sigs ifNotNil: [^sigs keys asSortedCollection asArray collect: [:k | k asString]].
  ^((aClass selectorsForEnvironment: 1) collect: [:s | self pythonNameOfSelector: s])
    asSortedCollection asArray reject: [:n | self isGrailInternalName: n]
%
category: 'private'
method: McpGrailToolset
pythonNameOfSelector: aSelector
  "The Python name a Smalltalk env-1 selector was generated from.

   The encoding: a fixed-arity call is `name:` then `_:` per further argument (`__setitem__:_:` is
   two arguments); a call with *args/**kwargs is `_name:kw:`, with one underscore ADDED, so a Python
   name already starting with _ gains another. Recognise the whole thing -- never truncate at the
   first colon, which is a documented way to manufacture attributes that do not exist."
  | s firstColon head |
  s := aSelector asString.
  firstColon := s indexOf: $:.
  firstColon = 0 ifTrue: [^s].
  head := s copyFrom: 1 to: firstColon - 1.
  "The varargs form is exactly `head:kw:` -- a fixed 2-argument selector would read `head:_:`."
  (s = (head , ':kw:') and: [head size > 1])
    ifTrue: [^head copyFrom: 2 to: head size].
  ^head
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
category: 'read-only'
method: McpGrailToolset
readOnlySafeToolNames
  "Two, for different reasons.

   python_module_state only READS -- registries, a session dictionary, and the .py on disk to hash.
   It deliberately does not import the module it describes, which is what lets it answer questions
   about a module you have not yet decided to import.

   run_python_tests writes plenty, but not HERE: it runs in a fresh gem that is thrown away and never
   committed in, so a read-only session running it can persist nothing, and the tests it runs are
   already-committed code -- the same argument McpTestingToolset makes for the Smalltalk SUnit tools.

   Everything else stays gated, deliberately. eval_python runs arbitrary Python. compile_python looks
   pure but shares that path. get_python_source, describe_python_class and list_python_methods all
   RESOLVE their subject, which imports the module it lives in, and in Grail a cold import is a
   database write."
  ^#( 'python_module_state' 'run_python_tests' )
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
  aToolRegistry name: 'describe_python_class'
    description: 'Describe a Python class in the image: its backing Smalltalk class and storage base, __bases__/__mro__, __slots__, class attributes, and its method names. Named dotted, e.g. "json.JSONDecoder".'
    inputSchema: (self objectSchema:
      (Dictionary new at: 'name' put:
        (self propString: 'Dotted class name, e.g. "json.JSONDecoder"; a bare class name is accepted when it is unambiguous');
        yourself)
      required: (Array with: 'name'))
    do: [:args | self tool_describe_python_class: args].
  aToolRegistry name: 'list_python_methods'
    description: 'List a Python class''s methods with real signatures (parameter names and defaults) and the .py file and line each was defined at, in source order.'
    inputSchema: (self objectSchema:
      (Dictionary new at: 'name' put:
        (self propString: 'Dotted class name, e.g. "json.JSONDecoder"');
        yourself)
      required: (Array with: 'name'))
    do: [:args | self tool_list_python_methods: args].
  aToolRegistry name: 'python_module_state'
    description: 'What a Python module IS in this image right now -- native or .py, canonical, committed, source current or stale, in this session''s sys.modules -- and what the next import of it would do.'
    inputSchema: (self objectSchema:
      (Dictionary new at: 'name' put: (self propString: 'Module name, e.g. "typing" or "flask.app"');
        yourself)
      required: (Array with: 'name'))
    do: [:args | self tool_python_module_state: args].
  aToolRegistry name: 'run_python_tests'
    description: 'Run Grail''s Python SUnit classes (PythonTestCase subclasses) in a FRESH gem and report the result structurally. Give classNames to run a subset; omit it to run them all (slow).'
    inputSchema: (self objectSchema:
      (Dictionary new at: 'classNames' put:
        (self stringArrayProperty:
          'Optional: PythonTestCase subclass names to run (default: all of them)');
        yourself)
      required: #())
    do: [:args | self tool_run_python_tests: args].
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
resolvePythonObjectNamed: aDottedName
  "The object a dotted Python name denotes, importing whatever module is needed, or nil. Tries
   progressively shorter leading segments as the module and walks the rest with getattr, so
   'json.JSONDecoder.decode' and 'json.JSONDecoder' both resolve.

   THE WALKING IS DONE IN SMALLTALK and Python is asked only for the two primitives (import_module,
   getattr). Written the obvious way -- one Python function with a loop and try/except -- this
   reliably killed the call: Grail's eval path does not support everything its import path does
   (its own docs say class statements are broken there), and a def wrapping control flow is enough
   to find that edge. The primitives are each a single straight-line expression, which is the part
   of the eval path that is solid; a failure raises a Python exception that Smalltalk catches here."
  | parts obj |
  parts := self dottedSegmentsOf: aDottedName.
  parts isEmpty ifTrue: [^nil].
  parts size to: 1 by: -1 do: [:i | | modName mod ok |
    modName := self joinSegments: parts upTo: i.
    mod := self importPythonModuleNamed: modName.
    mod ifNotNil: [
      obj := mod.
      ok := true.
      i + 1 to: parts size do: [:j |
        ok ifTrue: [
          obj := self pythonAttribute: (parts at: j) of: obj.
          obj isNil ifTrue: [ok := false]]].
      ok ifTrue: [^obj]]].
  ^nil
%
category: 'private'
method: McpGrailToolset
selectorDerivedSignatureFor: aMethodName on: aClass
  "A signature worked out from the generated selectors alone, for a class with no signature table.
   Answers `name(*args, **kwargs)` when only the varargs form exists, and otherwise `name(a1, ...)`
   with one placeholder per argument -- arity is all a selector carries."
  | sels fixed varargs n |
  sels := [(aClass selectorsForEnvironment: 1) asArray] on: Error do: [:ex | #()].
  fixed := nil.
  varargs := false.
  sels do: [:sel | | s |
    s := sel asString.
    (self pythonNameOfSelector: sel) = aMethodName ifTrue: [
      (self string: s endsWith: ':kw:')
        ifTrue: [varargs := true]
        ifFalse: [ | c | c := self colonCountIn: s. (fixed isNil or: [c > fixed]) ifTrue: [fixed := c]]]].
  fixed notNil ifTrue: [
    n := fixed.
    ^aMethodName , '(' , (self placeholderArgs: n) , ')'].
  varargs ifTrue: [^aMethodName , '(*args, **kwargs)'].
  ^aMethodName , '()'
%
category: 'private'
method: McpGrailToolset
signatureFor: aMethodName from: aSigTableOrNil on: aClass
  "`name(param, other='default')` for a Python method.

   From the signature table where there is one: each entry is a parameter as
   { name . kind . default }, the default being present only when it has one. Without a table, fall
   back to the arity the SELECTOR encodes -- honest but nameless, which is why the caller says so."
  | entry s any |
  entry := aSigTableOrNil isNil
    ifTrue: [nil]
    ifFalse: [[aSigTableOrNil at: aMethodName ifAbsent: [nil]] on: Error do: [:ex | nil]].
  entry isNil ifTrue: [^self selectorDerivedSignatureFor: aMethodName on: aClass].
  s := WriteStream on: String new.
  s nextPutAll: aMethodName; nextPut: $(.
  any := false.
  [entry do: [:p |
    any ifTrue: [s nextPutAll: ', '].
    s nextPutAll: ([(p at: 1) asString] on: Error do: [:ex | '?']).
    ([p size >= 3] on: Error do: [:ex | false]) ifTrue: [
      s nextPut: $=; nextPutAll: ([(p at: 3) asString] on: Error do: [:ex | '?'])].
    any := true]] on: Error, BaseException do: [:ex | nil].
  s nextPut: $).
  ^s contents
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
sourceLocationFor: aMethodName from: aCodeTableOrNil
  "'file.py:123' for a Python method, or nil.

   From the class's ___methodCodeTable___, whose values are PyCode objects. co_filename and
   co_firstlineno are DYNAMIC instVars on those, not accessors -- there is no co_filename method to
   send, which is worth knowing before concluding the code object is empty."
  | code file line |
  aCodeTableOrNil isNil ifTrue: [^nil].
  code := [aCodeTableOrNil at: aMethodName ifAbsent: [nil]] on: Error do: [:ex | nil].
  code isNil ifTrue: [^nil].
  file := [code dynamicInstVarAt: #co_filename] on: Error do: [:ex | nil].
  line := [code dynamicInstVarAt: #co_firstlineno] on: Error do: [:ex | nil].
  file isNil ifTrue: [^nil].
  ^file asString , (line isNil ifTrue: [''] ifFalse: [':' , line printString])
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
category: 'private'
method: McpGrailToolset
storageBaseOf: aClass
  "The GemStone class a Python class's instances actually ARE -- Unicode32 for a str subclass,
   OrderedCollection for a list subclass, PythonInstance for a plain one.
   Found by walking up to the first superclass that is not itself a registered Python class, since
   what makes a class 'the storage base' is that Grail chose it rather than generated it."
  | reg registered c |
  reg := System myUserProfile objectNamed: #GrailCanonicalClasses.
  registered := IdentitySet new.
  reg ifNotNil: [[reg valuesDo: [:v | registered add: v]] on: Error do: [:ex | nil]].
  c := aClass superclass.
  [c notNil and: [registered includes: c]] whileTrue: [c := c superclass].
  ^c ifNil: [aClass]
%
category: 'private'
method: McpGrailToolset
string: aString endsWith: aSuffix
  "Case-sensitive suffix test. String>>includesString: is case-INsensitive in GemStone, and endsWith:
   is not present in every version this server files into."
  aString size < aSuffix size ifTrue: [^false].
  ^(aString copyFrom: aString size - aSuffix size + 1 to: aString size) = aSuffix
%
category: 'private'
method: McpGrailToolset
testRunnerExpressionFor: aNamesCollectionOrNil directory: aDirectory
  "The one expression run_python_tests runs in the child gem: configure Grail, run the classes, and
   answer a formatted report as a String.

   $GRAIL_DIR rather than `importlib grailDir:` because PythonTestCase class>>suite -- which is what
   `c suite` sends -- calls initGrail, and initGrail ASSIGNS grailDir from $GRAIL_DIR or the gem's
   working directory. So a grailDir set here would be overwritten by the very next send, and the
   directory would come out as the stone's. That is a Grail defect (reported; a patch is proposed),
   not a shape to design around: the env var is what Grail's own runner scripts export and what its
   Python-side importlib reads, so it is the right thing to set either way, and it also happens to
   survive.

   Names are embedded via printString and resolved in the CHILD by objectNamed:, so nothing a client
   sends is ever compiled as code -- the same rule the worker bootstrap follows. A name that does not
   resolve is reported rather than skipped: 'ran 0 classes' and 'you misspelled it' must not look
   alike.

   GrailTestResult, not the stock TestResult, because stock SUnit keeps only the failing TestCase --
   its message and stack are discarded in the handler -- so a report could say no more than
   `Cls debug: #sel`. Looked up rather than named directly, so this still runs on a Grail old enough
   not to have it."
  | s |
  s := WriteStream on: String new.
  s nextPutAll: '| classes result ws missing resultClass |'; nextPut: Character lf.
  s nextPutAll: 'System gemEnvironmentVariable: ''GRAIL_DIR'' put: ';
    nextPutAll: aDirectory printString; nextPutAll: '.'; nextPut: Character lf.
  s nextPutAll: 'missing := OrderedCollection new.'; nextPut: Character lf.
  aNamesCollectionOrNil isNil
    ifTrue: [s nextPutAll: 'classes := (PythonTestCase allSubclasses reject: [:c | c isAbstract]) asArray.']
    ifFalse: [
      s nextPutAll: 'classes := OrderedCollection new. #('.
      aNamesCollectionOrNil do: [:n |
        s nextPutAll: n asString printString; nextPut: Character space].
      s nextPutAll: ') do: [:n | | c | c := System myUserProfile objectNamed: n asSymbol.'.
      s nextPutAll: ' ((c isKindOf: Behavior) and: [c inheritsFrom: PythonTestCase])'.
      s nextPutAll: ' ifTrue: [classes add: c] ifFalse: [missing add: n]].'].
  s nextPut: Character lf.
  s nextPutAll: 'classes := (classes asSortedCollection: [:a :b | a name <= b name]) asArray.';
    nextPut: Character lf.
  s nextPutAll: 'resultClass := (System myUserProfile objectNamed: #GrailTestResult) ifNil: [TestResult].';
    nextPut: Character lf.
  s nextPutAll: 'result := resultClass new.'; nextPut: Character lf.
  "One shared result across per-class suites, exactly as Grail's own runTestsShard.gs does -- NOT a
   hand-rolled loop over `suite tests`, which measured differently on 3.7.5 (see
   McpTestingToolset>>tool_run_test_class:)."
  s nextPutAll: 'classes do: [:c | c suite run: result].'; nextPut: Character lf.
  s nextPutAll: 'ws := WriteStream on: String new.'; nextPut: Character lf.
  s nextPutAll: 'ws nextPutAll: classes size printString, '' class(es), '',';
    nextPut: Character lf.
  s nextPutAll: '  result runCount printString, '' run, '', result passedCount printString,';
    nextPut: Character lf.
  s nextPutAll: '  '' passed, '', result failureCount printString, '' failed, '',';
    nextPut: Character lf.
  s nextPutAll: '  result errorCount printString, '' errors''.'; nextPut: Character lf.
  s nextPutAll: 'missing isEmpty ifFalse: [ws nextPut: Character lf; nextPutAll: ''NOT FOUND: ''.';
    nextPut: Character lf.
  s nextPutAll: '  missing do: [:n | ws nextPutAll: n; nextPut: Character space]].';
    nextPut: Character lf.
  s nextPutAll: '(result respondsTo: #reportOn:prefix:) ifTrue: [';
    nextPut: Character lf.
  s nextPutAll: '  result details isEmpty ifFalse: [ws nextPut: Character lf.';
    nextPut: Character lf.
  s nextPutAll: '    result reportOn: ws prefix: '''']].'; nextPut: Character lf.
  s nextPutAll: 'ws contents'.
  ^s contents
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
tool_describe_python_class: args
  "Describe a Python class as it exists in the image.

   The Smalltalk browsing tools cannot do this. A Grail Python class is created ANONYMOUSLY --
   inDictionary: nil -- so nothing in any symbol dictionary names it and list_classes cannot see it;
   its only handles are the module global the class statement bound and the GrailCanonicalClasses
   registry, keyed 'module.ClassName'. So the name to ask by is the PYTHON name, and the answer has
   to say which Smalltalk class is underneath, because that is the one every other tool here takes.

   Storage base is worth reading closely: a Python class does not wrap its data, it IS a GemStone
   object, so `class X(str)` is backed by Unicode32 and `class Y(list)` by OrderedCollection. That is
   what decides which env-0 protocol its instances already answer."
  | name cls out entryName slots attrs |
  self ensureGrailConfigured.
  entryName := (args at: 'name') asString.
  cls := self canonicalClassNamed: entryName.
  out := WriteStream on: String new.
  out nextPutAll: (self canonicalKeyFor: entryName); nextPut: Character lf.
  out nextPutAll: '  smalltalk class: ', cls name asString,
    ' (anonymous -- in no symbol dictionary)'; nextPut: Character lf.
  out nextPutAll: '  storage base:    ', (self storageBaseOf: cls) name asString,
    ' -- what its instances already are'; nextPut: Character lf.
  out nextPutAll: '  __module__:      ',
    (self pyAttr: #__module__ of: cls default: '(unknown)') printString; nextPut: Character lf.
  out nextPutAll: '  __bases__:       ', (self pyClassNamesOf: (self pyAttr: #__bases__ of: cls default: nil));
    nextPut: Character lf.
  out nextPutAll: '  __mro__:         ', (self pyClassNamesOf: (self pyAttr: #__mro__ of: cls default: nil));
    nextPut: Character lf.
  slots := self pyAttr: #__slots__ of: cls default: nil.
  slots ifNotNil: [
    out nextPutAll: '  __slots__:       ', (self commaListOf: slots),
      '  (stored as ___slot_<name>___)'; nextPut: Character lf].
  out nextPutAll: '  committed:       ', cls isCommitted printString,
    (cls isCommitted ifTrue: [''] ifFalse: [' -- session-built, dies with this session']);
    nextPut: Character lf.
  attrs := self classAttributeNamesOf: cls.
  out nextPutAll: '  class attributes: ',
    (attrs isEmpty ifTrue: ['(none)'] ifFalse: [self commaListOf: attrs]); nextPut: Character lf.
  out nextPutAll: '  methods:         ',
    (self commaListOf: (self pythonMethodNamesOf: cls)); nextPut: Character lf.
  (self pyAttr: #__doc__ of: cls default: nil) ifNotNil: [:d |
    out nextPut: Character lf; nextPutAll: d asString; nextPut: Character lf].
  out nextPut: Character lf;
    nextPutAll: 'For signatures and source lines: list_python_methods. For the SMALLTALK protocol '
      , 'its instances answer, point list_methods at ' , (self storageBaseOf: cls) name asString , '.'.
  ^self capResult: out contents
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
  | name obj code path firstLine |
  self ensureGrailConfigured.
  ^self withPythonErrorsAsMcpError: [
    name := (args at: 'name') asString.
    obj := self resolvePythonObjectNamed: name.
    obj isNil ifTrue: [
      ^McpError signalKind: #notFound message:
        'Nothing in this image answers to ' , name printString , '. Check the name, or import the '
          , 'module first -- resolution imports what it can, but only what it can find.'].
    "A function carries __code__, which gives the file AND the line. A module carries only __file__
     and answers its whole file. A class has neither, and is named as its own case rather than left
     to read as a missing file."
    code := self pythonAttribute: '__code__' of: obj.
    code isNil
      ifTrue: [
        path := self pythonAttribute: '__file__' of: obj.
        firstLine := 0]
      ifFalse: [
        path := [code dynamicInstVarAt: #co_filename] on: Error do: [:ex | nil].
        firstLine := ([code dynamicInstVarAt: #co_firstlineno] on: Error do: [:ex | nil]) ifNil: [0]].
    (path isNil or: [path isString not]) ifTrue: [
      ^McpError signalKind: #notFound message:
        name , ' resolved to a ' , obj class name asString , ', which records no source file. A '
          , 'native (Smalltalk-implemented) module has no .py at all; for a CLASS use '
          , 'describe_python_class and list_python_methods, which report the file and line of every '
          , 'method instead.'].
    self capResult: (self sourceFrom: path asString startingAt: firstLine label: name)]
%
category: 'tools - python'
method: McpGrailToolset
tool_list_python_methods: args
  "A Python class's methods, with real signatures and the .py line each was defined at.

   Signatures come from the class's own ___methodSignatureTable___ -- parameter names AND defaults,
   which the Smalltalk selector cannot carry: `pop(key, default=None)` compiles to `_pop:kw:`, and
   `__setitem__(key, value)` to `__setitem__:_:`. Reading them off the selector would give arity at
   best; there is also a documented trap in doing so badly (truncating a selector at its first colon
   once manufactured `perform`, `value` and `with` as Python attributes on 40 of 42 subjects), which
   is why the selector is only a FALLBACK here, for a class with no table.

   Order is the class body's own (___classBodyOrder___), not alphabetical: a class reads in the order
   it was written, and that is also the order the .py lines run in."
  | name cls out sigs codes order shown common |
  self ensureGrailConfigured.
  name := (args at: 'name') asString.
  cls := self canonicalClassNamed: name.
  sigs := [cls @env1:___methodSignatureTable___] on: Error, BaseException do: [:ex | nil].
  codes := [cls @env1:___methodCodeTable___] on: Error, BaseException do: [:ex | nil].
  order := self pythonMethodNamesOf: cls.
  out := WriteStream on: String new.
  out nextPutAll: (self canonicalKeyFor: name), '  (', cls name asString, ')'; nextPut: Character lf.
  "One file for the whole class in every ordinary case, so name it once and give each method its
   line. Repeating a 70-character path per method is most of the output and none of the information
   -- and this result shares a 50k cap with everything else."
  common := self commonSourceFileFor: order from: codes.
  common ifNotNil: [out nextPutAll: '  ', common; nextPut: Character lf].
  shown := 0.
  order do: [:m | | sig loc |
    sig := self signatureFor: m from: sigs on: cls.
    loc := self sourceLocationFor: m from: codes.
    shown := shown + 1.
    out nextPutAll: '  ', sig.
    loc ifNotNil: [:l |
      out nextPutAll: '  -- ';
        nextPutAll: (common isNil
          ifTrue: [l]
          ifFalse: ['line ' , (self lineOfLocation: l)])].
    out nextPut: Character lf].
  shown = 0 ifTrue: [out nextPutAll: '  (no python methods)'; nextPut: Character lf].
  sigs isNil ifTrue: [
    out nextPut: Character lf;
      nextPutAll: 'NOTE: this class carries no signature table, so the parameter lists above are '
        , 'derived from the Smalltalk selectors -- arity only, with no parameter names or defaults.';
      nextPut: Character lf].
  ^self capResult: out contents
%
category: 'tools - python'
method: McpGrailToolset
tool_python_module_state: args
  "What a Python module IS here, and what importing it next would do.

   There is no CPython question this answers. A Grail module is a compiled artifact in the DATABASE:
   it can be committed (deployed) or merely session-built, its committed compile can be current or
   stale against the .py on disk, and it can be absent from this session's sys.modules having once
   been in it -- a state in which the next import RAISES rather than rebuilding. An agent with no way
   to see that misreads its own situation in exactly the cases where it is most likely to be wrong:
   this tool exists because working out why Grail's whole test suite appeared broken took five hand
   probes, and every one of them is a line below.

   Everything is READ. Nothing here imports, compiles or writes."
  | name out mods hashes inst committed inSys stateEntry recorded path srcHash native |
  self ensureGrailConfigured.
  name := (args at: 'name') asString.
  mods := System myUserProfile objectNamed: #GrailCanonicalModules.
  hashes := System myUserProfile objectNamed: #GrailCanonicalModuleHashes.
  inst := mods isNil ifTrue: [nil] ifFalse: [mods at: name otherwise: nil].
  committed := inst notNil and: [inst isCommitted].
  inSys := [(importlib @env1:modules) includesKey: name]
    on: Error, BaseException do: [:ex | false].
  stateEntry := (SessionTemps current at: #GrailModuleHashState otherwise: nil)
    ifNil: [nil] ifNotNil: [:m | m at: name asSymbol otherwise: nil].
  recorded := hashes isNil ifTrue: [nil] ifFalse: [hashes at: name otherwise: nil].
  path := [importlib @env1:___moduleNameToPath___: name]
    on: Error, BaseException do: [:ex | nil].
  srcHash := path isNil ifTrue: [nil] ifFalse: [
    [(importlib ___sourceStringForPath___: path) sha1Sum]
      on: Error, BaseException do: [:ex | nil]].
  native := self isNativeModuleNamed: name.
  out := WriteStream on: String new.
  out nextPutAll: name; nextPut: Character lf.
  out nextPutAll: '  kind:        ';
    nextPutAll: (native
      ifTrue: ['native -- implemented in Smalltalk, no .py to read']
      ifFalse: [path isNil
        ifTrue: ['unknown -- no .py found on the search path']
        ifFalse: ['.py module']]); nextPut: Character lf.
  path ifNotNil: [:p | out nextPutAll: '  file:        '; nextPutAll: p; nextPut: Character lf].
  native ifFalse: [
    out nextPutAll: '  canonical:   ';
      nextPutAll: (inst isNil
        ifTrue: ['no -- nothing compiled for it is registered']
        ifFalse: [committed
          ifTrue: ['yes, COMMITTED (deployed) -- shared with every session']
          ifFalse: ['yes, session-built -- not committed, so it dies with this session']]);
      nextPut: Character lf].
  (native not and: [recorded notNil or: [srcHash notNil]]) ifTrue: [
    out nextPutAll: '  source:      ';
      nextPutAll: (recorded isNil
        ifTrue: ['no compile recorded']
        ifFalse: [srcHash isNil
          ifTrue: ['a compile is recorded; the .py could not be read to compare']
          ifFalse: [recorded = srcHash
            ifTrue: ['CURRENT -- the .py matches what was compiled']
            ifFalse: ['STALE -- the .py has changed since it was compiled']]]);
      nextPut: Character lf].
  out nextPutAll: '  sys.modules: ';
    nextPutAll: (inSys
      ifTrue: ['present -- already imported in this session']
      ifFalse: [stateEntry isNil
        ifTrue: ['absent -- not imported in this session']
        ifFalse: ['ABSENT, but this session imported it earlier (it was removed)']]);
    nextPut: Character lf.
  out nextPutAll: '  next import: '; nextPutAll: (self
    nextImportFor: name inSys: inSys committed: committed
    hashCurrent: (recorded notNil and: [recorded = srcHash])
    importedEarlier: stateEntry notNil native: native path: path);
    nextPut: Character lf.
  self deploymentGenerationNote ifNotNil: [:note |
    out nextPut: Character lf; nextPutAll: note; nextPut: Character lf].
  ^self capResult: out contents
%
category: 'tools - python'
method: McpGrailToolset
tool_run_python_tests: args
  "Run Grail's Python SUnit classes and report what happened.

   IN A FRESH GEM, which is the whole design and not a precaution. Measured 2026-09-01: the same
   three test classes produced 132 defects run in a long-lived worker session and 386 run / 386
   passed / 0 failed / 0 errors run fresh -- so every one of those defects was an artifact of the
   session. Grail's suite isolates tests by evicting framework modules from sys.modules, and against
   a stone where those modules are committed, re-importing raises (the canonical-module rule in
   docs/Persistent_Modules_and_Classes.md). A long-lived MCP worker is exactly the session that
   accumulates the state this collides with, so running the suite in the CALLER's session cannot be
   made to report the truth -- it has to be a session with no history.

   Running it elsewhere settles three other things at once. The caller's transaction is untouched,
   where running in-session dirties it silently (a cold Grail import IS a database write: measured 31
   modified objects for a 7-test class). The child's writes are never committed, so a run leaves the
   repository exactly as it found it. And that is what makes this tool read-only-safe.

   The cost is that every run is fully cold, so the framework-heavy classes recompile each time
   (FlaskScaffoldingTestCase alone: 262s). Hence the classNames argument, and hence progress
   reporting -- an unbounded wait with no word is worse than a slow one that says so."
  | dir names sess expr ticks |
  dir := self grailDirectory.
  dir isNil ifTrue: [
    ^McpError signalKind: #refused message:
      'run_python_tests needs to know where the Grail checkout is: its tests import .py modules and '
        , 'load fixtures from disk. Configure the toolset option grailDirectory on the router '
        , '(McpRouter>>toolsetOptions:). Without it Grail falls back to this gem''s working directory, '
        , 'which is the stone''s and holds no src/python/stdlib -- every test would report an error '
        , 'that says more about the session than about Grail.'].
  names := args at: 'classNames' ifAbsent: [nil].
  expr := self testRunnerExpressionFor: names directory: dir.
  sess := self newGrailTestSession.
  ticks := 0.
  ^[sess nbExecute: expr.
    [sess isCallInProgress] whileTrue: [
      sess waitForResultForSeconds: 5 otherwise: [nil].
      sess isCallInProgress ifTrue: [
        ticks := ticks + 1.
        self progress: ticks message:
          'running Grail tests in a fresh gem (' , (ticks * 5) printString , 's)']].
    "lastResult, not nbResult: waitForResultForSeconds: consumes the result internally. And only once
     isCallInProgress is false, or it still holds the PREVIOUS call's value -- both traps are the
     ones McpSession>>runWorker: documents."
    self capResult: sess lastResult asString]
      ensure: [[sess logout] on: Error do: [:ex | nil]]
%
category: 'accessing'
method: McpGrailToolset
toolNames
  ^#( 'compile_python' 'describe_python_class' 'eval_python' 'get_python_source'
      'list_python_methods' 'python_module_state' 'run_python_tests' )
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
