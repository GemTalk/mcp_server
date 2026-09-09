set compile_env: 0
! ------------------- Class definition for McpGrailToolset
expectvalue /Class
doit
McpToolset subclass: 'McpGrailToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Mcp
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
including how a toolset takes DEPLOYMENT CONFIGURATION (class>>declaredOptionNames -- grailDirectory
and testGemConfig).
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
same three classes: 132 defects in a worker session, 386/386 clean in a fresh one. That fresh gem is
forked with Grail''s own memory budget and driven ONE CLASS PER SEND, because it is a gem that can
die: a run compiles everything it imports into one session''s temporary object memory, and a netldi''s
default 50MB is not enough for a single Grail test class. See newGrailTestSession, testGemConfig and
tool_run_python_tests:.

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

   testGemConfig -- the gem configuration run_python_tests forks its test gem with. See
   McpGrailToolset>>testGemConfig for the default, and for why the one a netldi hands out is not
   enough to run a Grail test class to the end.

   Both are deployment knowledge, not something a worker can work out, which is why they are
   configured rather than probed."
  ^#( 'grailDirectory' 'testGemConfig' )
%
! ------------------- Instance methods for McpGrailToolset
category: 'private'
method: McpGrailToolset
absentSenderReport: aName searched: aSearchedString notSearched: aNotSearchedString
  "The #absent refusal, carrying the coverage evidence rather than a bare no.

   `no senders` and `I could not look there` are different answers, and a tool that renders both as
   nothing is the failure this one exists to remove -- so the message names what WAS searched. The
   kind is #absent rather than #notFound because the NAME may well exist: nothing called it in the
   places reachable from here."
  ^McpError signalKind: #absent message:
    'No reference to ''' , aName , ''' found. searched: ' , aSearchedString
      , '. not searched: ' , aNotSearchedString , '.'
%
category: 'private'
method: McpGrailToolset
callSitesIn: aSourceString forSelector: aSelector
  "Where the sends of aSelector are in aSourceString, as an OrderedCollection of
   {pythonLineOrNil. callSiteTextOrNil} -- one entry per send, in source order.

   HOW A GENERATED METHOD CARRIES ITS PYTHON POSITION. Grail's codegen writes a store before each
   statement (AbstractNode>>___emitCurPosStore___:on:) in one of two shapes: a bare line,
   `___curPos___ := 42`, or the 5-element PEP 657 literal
   `___curPos___ := #(43 15 43 47 '        return gemstone.sessionDict(self._name)')` -- beginLine,
   colno, endLine, endColno and the raw source line (AbstractLocationNode>>___pyPositionLiteralArray).
   So a send's position is whatever the nearest store ABOVE it says. That is the derivation Grail
   itself makes at run time in BaseException class>>___pythonLineForMethod___:ip:, which it reaches
   from an instruction pointer this search does not have.

   WHAT IS NOT A SEND, measured against `_grail_session.SessionDict` on 3.7.5. A naive substring
   scan for the sent selector reported 27 sites where there are 12, and every extra one came from
   one of four places:

     1. THE POSITION LITERAL'S OWN TEXT. The store embeds the Python source line, so searching for
        `_dict` inside `#(55 ... '        return key in self._dict()')` finds the very name being
        searched for and doubles every real hit.
     2. A GENERATED STRING LITERAL. The varargs entry point raises
        `TypeError: 'SessionDict._dict() takes 0 positional arguments'`, which names the method in
        prose.
     3. THE METHOD'S OWN SELECTOR PATTERN. Line one of `_dict` is the word `_dict`.
     4. A LONGER IDENTIFIER. `_dict` is a substring of `__dict:`, which is the SAME name's varargs
        selector -- so every fast path appeared to be sent from its own arity glue.

   So this walks the source once tracking string-literal and comment state, starts after the
   selector pattern, and requires an identifier boundary on each side of the match. Comments are
   skipped for consistency, not because codegen writes prose into them: the one comment it does
   write is a position store (___emitCurPosRestoreCommentFor___:on:), which is already read from the
   raw text by #positionStoresIn: before this walk begins.

   WHY IT READS TEXT AT ALL, AND WHERE THAT STOPS. Grail publishes no way to ask a method for its
   call sites: both readers that do it properly are private and ip-keyed, which is asked about in
   GemTalk/Grail#883. Two limits follow, and each reports an ABSENT position rather than a wrong
   one -- the literal layout is an assumption, and a direct-to-IR method (GRAIL_IR_CODEGEN set)
   carries the user's Python with no store in it at all. A hit whose line is nil still names the
   method it is in, which is the part a caller can get nowhere else."
  | stores key sites i size c inString inComment |
  stores := self positionStoresIn: aSourceString.
  key := self firstKeywordOf: aSelector.
  sites := OrderedCollection new.
  size := aSourceString size.
  "Start after the selector pattern: no Python call site is in it, and its own name is."
  i := (aSourceString indexOf: Character lf) + 1.
  i = 1 ifTrue: [i := size + 1].
  inString := false.
  inComment := false.
  [i <= size] whileTrue: [
    c := aSourceString at: i.
    inString
      ifTrue: [
        c = $' ifTrue: [
          "A doubled quote is one quote INSIDE the literal, not the end of it."
          (i < size and: [(aSourceString at: i + 1) = $'])
            ifTrue: [i := i + 1]
            ifFalse: [inString := false]]]
      ifFalse: [
        inComment
          ifTrue: [c = $" ifTrue: [inComment := false]]
          ifFalse: [
            c = $'
              ifTrue: [inString := true]
              ifFalse: [
                c = $"
                  ifTrue: [inComment := true]
                  ifFalse: [
                    (self source: aSourceString hasSendOf: key at: i)
                      ifTrue: [sites add: (self storeInEffectAt: i in: stores)]]]]].
    i := i + 1].
  ^sites
%
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
childResultFrom: aSession expression: anExpressionString progress: aLabel since: aStartSecond
  "Run one expression in the test gem and answer its result as a String, telling the client how long
   it has been waiting.

   Two traps in this API, each able to corrupt an answer silently, and both are the ones
   McpSession>>runWorker: documents. The result must be read with #lastResult, because
   #waitForResultForSeconds: consumes it internally; and it must be read only once #isCallInProgress
   answers false, or it still holds the PREVIOUS call's value -- which here would be another test
   class's counts, reported against this one.

   The progress NUMBER is seconds elapsed since the whole call began rather than a tick count,
   because run_python_tests sends one expression PER CLASS and the number has to increase strictly
   across all of them; a per-expression counter would restart at every class.

   Errors are not caught here. A test gem that dies takes its session with it, and only the caller
   knows what had already finished -- see tool_run_python_tests:."
  aSession nbExecute: anExpressionString.
  [aSession isCallInProgress] whileTrue: [
    aSession waitForResultForSeconds: 5 otherwise: [nil].
    aSession isCallInProgress ifTrue: [ | elapsed |
      elapsed := System timeGmt - aStartSecond.
      self progress: elapsed message: aLabel , ' -- ' , elapsed printString , 's']].
  ^aSession lastResult asString
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
firstKeywordOf: aSelector
  "aSelector's first keyword, `copyfile:` from #'copyfile:_:', or the whole selector when it is
   unary. What a text scan looks for to find the sends of a selector it already knows is sent."
  | s i |
  s := aSelector asString.
  i := s indexOf: $:.
  ^i = 0 ifTrue: [s] ifFalse: [s copyFrom: 1 to: i]
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
isIdentifierCharacter: aCharacter
  "Whether aCharacter can be part of a Smalltalk or Python identifier, which is what decides
   whether a match is a whole name or the middle of a longer one."
  ^aCharacter isLetter or: [aCharacter isDigit or: [aCharacter = $_]]
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
lastPathSegmentOf: aPath
  "The final segment of aPath -- `flask` from `/g/src/python/stdlib/flask`, and `..` from a
   directory listing's parent entry, which is the whole reason this exists (see
   #pythonSourceFilesUnder:)."
  | i |
  i := aPath size.
  [i > 0 and: [(aPath at: i) ~= $/]] whileTrue: [i := i - 1].
  ^aPath copyFrom: i + 1 to: aPath size
%
category: 'private'
method: McpGrailToolset
line: aLine endsBlockIndentedAt: anIndentIndex
  "Whether aLine ends the definition that preceded it -- i.e. it has content, and that content
   begins at or to the left of anIndentIndex, the first-content index of the definition's own first
   line. Python's own block rule: a definition continues through every blank line and every line
   indented FURTHER than its header, and stops at the next statement at its own level or outside it.

   Comparing against the definition's own indentation, rather than against the first column, is
   what makes this right for a METHOD as well as a module-level def. The first column alone -- what
   this used to ask for -- ends a module def correctly and runs a method on through every later
   method of its class, because an indented `def` does not start in the first column: asked for
   `textwrap.TextWrapper.wrap`, get_python_source answered `wrap` AND `fill`.

   Blankness and indentation are read with #firstContentIndexIn:, which uses at:/size alone rather
   than a trimming selector, because this toolset should file into as many GemStone versions as the
   rest of the server does and #withoutTrailingSeparators is not present in all of them (measured
   missing on 3.7.5)."
  | i |
  i := self firstContentIndexIn: aLine.
  ^i ~= 0 and: [i <= anIndentIndex]
%
category: 'private'
method: McpGrailToolset
line: aLine hasWholeName: aName
  "Whether aName occurs in aLine as a whole identifier rather than inside a longer one -- so
   `self._dict()` matches a search for `_dict` and `self.__dict__` does not.

   The rule is identifier boundaries on BOTH sides, and unlike #source:hasSendOf:at: a following
   colon is not a boundary violation: this reads Python, where `_dict: int` is an annotation on the
   name, not a Smalltalk keyword message."
  | at size nameSize |
  size := aLine size.
  nameSize := aName size.
  nameSize = 0 ifTrue: [^false].
  at := aLine findString: aName startingAt: 1.
  [at > 0] whileTrue: [
    | before after |
    before := at > 1 and: [self isIdentifierCharacter: (aLine at: at - 1)].
    after := (at + nameSize <= size)
      and: [self isIdentifierCharacter: (aLine at: at + nameSize)].
    (before or: [after]) ifFalse: [^true].
    at := aLine findString: aName startingAt: at + 1].
  ^false
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
  "A fresh, logged-in gem to run Grail's tests in, with the memory budget Grail's own runner gives
   one. Built exactly as McpSession builds a worker -- newDefault plus an explicit localhost NRS
   rather than newDefaultForGemHost:, which does not exist on 3.7.2 -- and logged in as the current
   user with a one-time password, so it needs no credentials and inherits this session's permissions
   and nothing else.
   The caller logs it out in an ensure:. Nothing is ever committed in it, so a run leaves the
   repository as it found it whether it ends well or badly.

   THE BUDGET IS WHY THE NRS HAS A BODY. A forked gem's temporary object memory is whatever its
   netldi hands out, and that is not a constant: the product default is GEM_TEMPOBJ_CACHE_SIZE=50MB
   (data/system.conf), while a netldi started with a larger one passes that on instead -- measured
   2026-09-09, gems forked here got 488MB and a linked topaz on the same host got 50MB. A Grail test
   class does not reliably fit in either: importing a framework compiles thousands of methods, and
   the run dies with `VM temporary object memory is full` -- a GciError raised out of a session whose
   gem no longer exists, so it arrives with no result and no partial counts.
   So this stops depending on the host at all and asks for a stated budget, the one Grail's own
   scripts/run_tests.sh gives every test session (see #testGemConfig).

   GsTsExternalSession has no configuration hook, but it does not need one: the NRS BODY *is* the
   gemnetobject command line, and gemnetobject takes `-C` for gem configuration parameters (System
   Administration Guide, Command Reference). So the budget travels with the login, and no gem.conf,
   GEMSTONE_EXE_CONF or netldi restart is involved -- which matters, because none of those are
   reachable from a gem asked to run a tool."
  | sess |
  sess := GsTsExternalSession newDefault
    gemNRS: (GsNetworkResourceString defaultGemNRSFromCurrent
      node: 'localhost';
      body: 'gemnetobject -C ' , self testGemConfig;
      yourself);
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
pagedSource: anArray args: args
  "One page of a source block -- {path . firstFileLine . lines} from
   #sourceLinesFrom:startingAt:label: -- headed by the `# <path>:<line>` line naming where THIS PAGE
   starts, and by the page header when the client paged.

   Why source does not go through McpToolset>>page:args:defaultLimit: like every list-shaped tool:
   that renderer joins its lines with newlines of its own, and these lines are the file's own bytes,
   which have to go back verbatim -- a .py answered with re-manufactured line endings is no longer
   the source. The WINDOW is still computed by the shared #pageIndicesFor:defaultLimit:of:, so
   `offset` means here exactly what it means everywhere else.

   THE LINE NUMBER IS THE POINT. A page 2 headed with the line the DEFINITION starts at would tell a
   model the wrong place in the file, and read as authoritative -- worse than not paging at all. So
   the header advances with the page.

   No default limit: a definition that fitted in one answer still comes back whole. What paging adds
   is a way past the shared 50k cap, which now says how much it dropped."
  | path start body window first last size |
  path := anArray at: 1.
  start := anArray at: 2.
  body := anArray at: 3.
  size := body size.
  window := self pageIndicesFor: args defaultLimit: nil of: size.
  first := window at: 1.
  last := window at: 2.
  ^((self pageIsNavigable: args from: first to: last of: size complete: true)
      ifTrue: [(self pageHeaderFrom: first to: last of: size complete: true noun: 'lines')
                 , (String with: Character lf)]
      ifFalse: [''])
    , (self headed: path
        line: start + first - 1
        body: (first > last ifTrue: [#()] ifFalse: [body asArray copyFrom: first to: last]))
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
positionLiteralAt: anIndex in: aSourceString
  "The {lineOrNil. sourceTextOrNil} a Grail position literal starting at anIndex denotes.

   Both emitted shapes are read: `#(117 4 117 22 ' copyfile(src, dst)')` answers the line and the
   text, a bare `117` answers the line and nil, and `#(117 4 117 22 nil)` -- which codegen writes
   when the source line holds a double quote it could not embed -- answers the line and nil too.

   The text is bounded by the literal's own quotes rather than by a character count, which is what
   keeps a source line containing a bracket or a period from running the parse into the next
   statement: everything before the first quote is the four integers, and the closing quote ends
   the text. A doubled quote inside it is one quote, as codegen wrote it."
  | i size line inLiteral text digits |
  size := aSourceString size.
  i := anIndex.
  [i <= size and: [(aSourceString at: i) isSeparator]] whileTrue: [i := i + 1].
  inLiteral := false.
  (i <= size and: [(aSourceString at: i) = $#]) ifTrue: [
    inLiteral := true.
    i := i + 1.
    [i <= size and: [(aSourceString at: i) ~= $(]] whileTrue: [i := i + 1].
    i := i + 1].
  digits := WriteStream on: String new.
  [i <= size and: [(aSourceString at: i) isDigit]] whileTrue: [
    digits nextPut: (aSourceString at: i).
    i := i + 1].
  line := digits contents isEmpty ifTrue: [nil] ifFalse: [digits contents asNumber].
  text := nil.
  inLiteral ifTrue: [
    [i <= size and: [(aSourceString at: i) ~= $' and: [(aSourceString at: i) ~= $)]]]
      whileTrue: [i := i + 1].
    (i <= size and: [(aSourceString at: i) = $'])
      ifTrue: [text := self quotedStringAt: i in: aSourceString]].
  ^Array with: line with: text
%
category: 'private'
method: McpGrailToolset
positionStoresIn: aSourceString
  "Every Grail position store in aSourceString, as an OrderedCollection of
   {sourceIndex. lineOrNil. textOrNil} in ascending index order -- the index being where the store
   begins, which is what tells a send which store is in effect at it.

   Collected in ONE pass and reused for every send, rather than re-scanning backwards from each:
   a generated module method can hold hundreds of statements, and this is the whole cost of a
   compiled-shape hit."
  | marker stores at |
  marker := '___curPos___ := '.
  stores := OrderedCollection new.
  at := aSourceString findString: marker startingAt: 1.
  [at > 0] whileTrue: [
    | parsed |
    parsed := self positionLiteralAt: at + marker size in: aSourceString.
    stores add: (Array with: at with: (parsed at: 1) with: (parsed at: 2)).
    at := aSourceString findString: marker startingAt: at + marker size].
  ^stores
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
pythonReferenceMarkers
  "The generated-code markers that carry a Python name as a Symbol literal rather than as a
   selector, and so are the only trace a NON-CALL reference leaves.

   Measured by transpiling each form (compile_python) on 3.7.5:

     `g = abs` emits
       `(builtins instance) @env1:___globalAt___: #'abs' otherwise: [BoundMethod receiver: ...
        selector: #abs]`
     `self._name` emits `self @env1:___pyAttrLoad___: #'_name'`
     a module-scope def read as a value emits `self @env1:___moduleAttrLoad___: #'helper'`

   `selector:` is deliberately NOT a marker even though the name appears after it: it only ever
   occurs inside the `otherwise:` block of a ___globalAt___: load, so keying on it would report
   every builtin reference twice.

   ___pyAttrLoad___: earns its place twice over. It is how an ATTRIBUTE CALL on a receiver Grail
   cannot resolve statically is emitted -- `os.path.isdir(dst)` becomes
   `(... ___pyAttrLoad___: #'isdir') @env1:value: {...} value: nil` -- so a call written that way
   has no selector to find and would be invisible to the compiled scan entirely."
  ^#( '___globalAt___:' '___pyAttrLoad___:' '___moduleAttrLoad___:' )
%
category: 'private'
method: McpGrailToolset
pythonReferencesOfName: aName in: aClass
  "Every reference to the Python name aName from aClass's env-1 methods that is NOT a resolvable
   call, as an OrderedCollection of {containingPythonName. marker. lineOrNil. callSiteTextOrNil}.

   A first-class reference (`g = abs`, `f = helper`) compiles to a Symbol literal after one of
   #pythonReferenceMarkers, and there is no selector anywhere to find it by -- so this shape cannot
   be answered from the selector pool the way #pythonSendersOfName:in: answers a call. It is text
   matching, and it is bounded by matching the marker first and then parsing the Symbol literal
   that follows: the name is compared as a whole Symbol, so `absolute` is not a reference to `abs`."
  | hits markers |
  hits := OrderedCollection new.
  markers := self pythonReferenceMarkers.
  (aClass selectorsForEnvironment: 1) asSortedCollection do: [:sel |
    | src ownName stores |
    src := [aClass sourceCodeAt: sel environmentId: 1] on: Error do: [:ex | nil].
    src ifNotNil: [
      ownName := self pythonNameOfSelector: sel.
      stores := self positionStoresIn: src.
      markers do: [:marker |
        | at |
        at := src findString: marker startingAt: 1.
        [at > 0] whileTrue: [
          | after sym |
          after := at + marker size.
          [after <= src size and: [(src at: after) isSeparator]] whileTrue: [after := after + 1].
          sym := self symbolLiteralAt: after in: src.
          (sym notNil and: [sym = aName asString]) ifTrue: [
            | pos |
            pos := self storeInEffectAt: at in: stores.
            hits add: (Array with: ownName with: marker with: (pos at: 1) with: (pos at: 2))].
          at := src findString: marker startingAt: after]]]].
  ^hits
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
pythonSearchScopeIncludingNative: aBoolean
  "The classes a compiled-shape search can look in, as an OrderedCollection of
   {pythonLabel. class} -- the label being the dotted name a follow-up call can use
   (`_grail_session`, `_grail_session.SessionDict`), not the Smalltalk class name, which for a
   Python class is anonymous.

   THREE SOURCES, AND NONE OF THEM IS THE IMAGE. Grail creates every Python class with
   `inDictionary: nil`, so no symbol dictionary names one and ClassOrganizer cannot find them --
   Grail says so itself in importlib class>>___subclassRegistry___ (`that is not a small gap: it is
   every user class in the system`). What can be enumerated is:

     PythonModules -- the module classes, where a module-level def lives. Its own name is a key in
       it, mapping to the dictionary rather than a class, so values are filtered by Behavior.
     GrailCanonicalClasses -- the module-scope class statements, keyed `module.Class`, which is the
       label wanted anyway. A class decorator may have bound something that is not a class, so this
       is filtered by Behavior too.
     the Python dictionary -- Grail's 47 hand-written NATIVE modules (os, sys, math, builtins ...),
       only when aBoolean. They are Smalltalk, not generated, so a Python-name search over them
       reports the implementation rather than a call site; useful sometimes, noise by default.

   WHAT THIS CANNOT REACH, and what the caller must therefore report as not searched: a nested class
   (the registry records module-scope statements only), a module with a .py that nothing has imported
   in this session (nothing is compiled to search), and a function defined in an eval scope, which
   compiles to a block with no selector pool. An enumeration that answers honestly for all of them
   is asked for in GemTalk/Grail#885; until there is one, a count from here is a floor and is
   reported as one.

   Deduplicated by class IDENTITY: a module-scope class reachable from both the registry and a
   module attribute must be searched once, or every hit in it is reported twice."
  | scope seen add pm reg |
  scope := OrderedCollection new.
  seen := IdentitySet new.
  add := [:label :value |
    ((value isKindOf: Behavior) and: [(seen includes: value) not]) ifTrue: [
      seen add: value.
      scope add: (Array with: label asString with: value)]].
  pm := self dictNamed: 'PythonModules'.
  pm ifNotNil: [
    [pm keysAndValuesDo: [:k :v | add value: k value: v]] on: Error do: [:ex | nil]].
  reg := System myUserProfile objectNamed: #GrailCanonicalClasses.
  reg ifNotNil: [
    [reg keysAndValuesDo: [:k :v | add value: k value: v]] on: Error do: [:ex | nil]].
  aBoolean ifTrue: [
    (self dictNamed: 'Python') ifNotNil: [:d |
      [d keysAndValuesDo: [:k :v |
        (self isNativeModuleNamed: k) ifTrue: [add value: k value: v]]]
        on: Error do: [:ex | nil]]].
  ^scope
%
category: 'private'
method: McpGrailToolset
pythonSendersOfName: aName in: aClass
  "Every call to the Python name aName from aClass's env-1 methods, as an OrderedCollection of
   {containingPythonName. smalltalkSelector. lineOrNil. callSiteTextOrNil} -- one entry per call
   site, so a method calling aName twice is reported twice.

   THE SELECTOR POOL DECIDES WHETHER, THE SOURCE DECIDES WHERE. A method's pool is the exact set of
   selectors it sends, so decoding each one (#selector:callsPythonName:) answers the question
   `is this a sender` without parsing anything. Only then is the source read, to say where.

   GRAIL COMPILES EACH DEF TWICE, and the difference is why the last clause is here. A def gets a
   fixed-arity fast path holding the body (`__contains__:`) and a varargs entry point that checks
   the argument count and delegates to it (`___contains__:kw:`) -- so `__dict:kw:` genuinely sends
   `_dict`, and every Python name would otherwise be reported as calling itself once. That
   delegation sits ahead of the body's first position store, so it is recognised as glue by having
   NO position while standing in a method of the very name being searched for. A real recursive
   call has a store above it and is reported. Measured on `_grail_session.SessionDict`: 12 real
   senders of `_dict`, plus exactly one glue send from `__dict:kw:`.

   Nothing here imports, resolves or compiles: it reads compiled methods and their source."
  | hits |
  hits := OrderedCollection new.
  (aClass selectorsForEnvironment: 1) asSortedCollection do: [:sel |
    | meth ownName pool |
    meth := [aClass compiledMethodAt: sel environmentId: 1] on: Error do: [:ex | nil].
    meth ifNotNil: [
      ownName := self pythonNameOfSelector: sel.
      pool := [meth _selectorPool] on: Error do: [:ex | #()].
      pool do: [:sent |
        (self selector: sent callsPythonName: aName) ifTrue: [
          | src sites |
          src := [aClass sourceCodeAt: sel environmentId: 1] on: Error do: [:ex | nil].
          sites := src isNil
            ifTrue: [OrderedCollection new]
            ifFalse: [self callSitesIn: src forSelector: sent].
          "The pool proved the send; a source that cannot be read or located still reports it,
           without a position."
          sites isEmpty ifTrue: [sites := OrderedCollection with: (Array with: nil with: nil)].
          sites do: [:site |
            ((site at: 1) isNil and: [ownName = aName]) ifFalse: [
              hits add: (Array with: ownName with: sel with: (site at: 1) with: (site at: 2))]]]]]].
  ^hits
%
category: 'private'
method: McpGrailToolset
pythonSourceFilesUnder: aDirectory
  "Every .py file under aDirectory, walked breadth-unspecified, as an OrderedCollection of absolute
   paths.

   THE DOT ENTRIES ARE THE WHOLE DIFFICULTY. GsFile class>>contentsOfDirectory:onClient: answers
   `.` and `..` AS FULL PATHS -- `/g/src/python/stdlib/flask/..` is in flask's listing -- so a walk
   that pushes what it is given lists the parent again, and again, until the gem dies. Measured:
   it took the worker gem down with `VM temporary object memory is full, old space overflow` in
   about 20 seconds, which looks exactly like a corpus too large to read and is not. Skipping the
   two dot segments, the same walk over Grail's stdlib takes 75ms.

   A directory is told from a file by what its own listing says: a file's listing is the file
   itself, so an entry that lists only itself is a file. There is no isDirectory: on GsFile, and
   isServerDirectory: answered nil for both on 3.7.5."
  | stack files |
  stack := OrderedCollection with: aDirectory.
  files := OrderedCollection new.
  [stack isEmpty] whileFalse: [
    | p entries |
    p := stack removeLast.
    entries := [GsFile contentsOfDirectory: p onClient: false] on: Error do: [:ex | #()].
    (entries size = 1 and: [(entries at: 1) = p])
      ifTrue: [(self string: p endsWith: '.py') ifTrue: [files add: p]]
      ifFalse: [
        entries do: [:e |
          | seg |
          seg := self lastPathSegmentOf: e.
          (seg = '.' or: [seg = '..' or: [e = p]]) ifFalse: [stack add: e]]]].
  ^files
%
category: 'private'
method: McpGrailToolset
pythonSourceRootsIncludingTests: aBoolean
  "The .py trees a text search reads, as an OrderedCollection of {label. absolutePath}, or empty
   when no grailDirectory is configured or the tree is not where it is expected.

   The stdlib is always searched; Grail's test fixtures only on request. That is a RELEVANCE
   decision rather than a cost one, and the measurement says so: the stdlib is 1,412 files and
   426,131 lines and reads in 248ms, and tests/python would add 644 files and 99,115 lines -- about
   75ms. What it would also add is test code among the answers to `who calls this`, which is
   usually not what the question meant."
  | dir roots add |
  dir := self grailDirectory.
  roots := OrderedCollection new.
  dir isNil ifTrue: [^roots].
  add := [:label :path |
    (GsFile existsOnServer: path) == true ifTrue: [
      roots add: (Array with: label with: path)]].
  add value: 'src/python/stdlib' value: dir , '/src/python/stdlib'.
  aBoolean ifTrue: [add value: 'tests/python' value: dir , '/tests/python'].
  ^roots
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
category: 'private'
method: McpGrailToolset
quotedStringAt: anIndex in: aSourceString
  "The contents of the Smalltalk string literal whose opening quote is at anIndex, with each
   doubled quote read back as one. Answers what is there when the literal is unterminated, which a
   truncated source read can produce and which must not loop."
  | i size out c |
  size := aSourceString size.
  i := anIndex + 1.
  out := WriteStream on: String new.
  [i <= size] whileTrue: [
    c := aSourceString at: i.
    c = $'
      ifTrue: [
        (i < size and: [(aSourceString at: i + 1) = $'])
          ifTrue: [out nextPut: $'. i := i + 2]
          ifFalse: [^out contents]]
      ifFalse: [out nextPut: c. i := i + 1]].
  ^out contents
%
category: 'read-only'
method: McpGrailToolset
readOnlySafeToolNames
  "Four, for three different reasons.

   python_module_state only READS -- registries, a session dictionary, and the .py on disk to hash.
   It deliberately does not import the module it describes, which is what lets it answer questions
   about a module you have not yet decided to import.

   run_python_tests writes plenty, but not HERE: it runs in a fresh gem that is thrown away and never
   committed in, so a read-only session running it can persist nothing, and the tests it runs are
   already-committed code -- the same argument McpTestingToolset makes for the Smalltalk SUnit tools.

   find_python_senders and search_python_source read compiled methods, two registries and the .py
   files on disk, and that is all -- which is the direct consequence of matching a name
   SYNTACTICALLY rather than resolving it. Resolving would buy exact arities and would make a search
   a database write, since a cold import in Grail compiles and commits nothing but writes plenty;
   it would also put both tools in this comment's second paragraph instead of this one. Read-only
   safety was a design input here, not a discovery about the finished tools.

   Everything else stays gated, deliberately. eval_python runs arbitrary Python. compile_python looks
   pure but shares that path. get_python_source, describe_python_class and list_python_methods all
   RESOLVE their subject, which imports the module it lives in, and in Grail a cold import is a
   database write."
  ^#( 'find_python_senders' 'python_module_state' 'run_python_tests' 'search_python_source' )
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
    description: 'List a Python class''s methods with real signatures (parameter names and defaults) and the .py file and line each was defined at, in source order. Pages with limit/offset.'
    inputSchema: (self pagedSchema:
      (Dictionary new at: 'name' put:
        (self propString: 'Dotted class name, e.g. "json.JSONDecoder"');
        yourself)
      required: (Array with: 'name')
      defaultLimit: nil
      noun: 'methods')
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
    description: 'Source of a Python module, class or function in the image, named dotted (e.g. "gemdb.transaction"). Reads the .py the object was loaded from, so it answers the docstring and body even where the image itself has lost them. Pages with limit/offset over LINES, and the `# path:line` header names where the page starts.'
    inputSchema: (self pagedSchema:
      (Dictionary new at: 'name' put:
        (self propString: 'Dotted name, e.g. "gemdb", "gemdb.transaction" or "json.JSONDecoder"');
        yourself)
      required: (Array with: 'name')
      defaultLimit: nil
      noun: 'lines')
    do: [:args | self tool_get_python_source: args].
  aToolRegistry name: 'find_python_senders'
    description: 'Who calls or refers to a Python name, across every shape Grail compiles a reference into -- resolvable calls in compiled methods, first-class references and unresolved attribute calls, and the .py text on disk. The stock find_senders cannot see any of them: it scans environment 0 and Grail compiles Python into environment 1, so it answers (none) where senders exist. Every answer ends with what was and was not searched. Pages with limit/offset.'
    inputSchema: (self pagedSchema:
      (Dictionary new
        at: 'name' put: (self propString:
          'Python name, bare or dotted: "copyfile", "shutil.copyfile", "SessionDict._dict". The LAST segment is matched; earlier segments narrow and label, so a bare name answers hits in every module that has one.');
        at: 'shapes' put: (self stringArrayProperty:
          'Optional: any of "compiled", "references", "source" (default: all three). A shape left out is reported as not searched rather than silently missing.');
        at: 'scope' put: (self propString:
          'Optional: restrict to a module or dotted prefix, e.g. "flask" or "flask.json". Matches at a dot boundary, so "flask" does not select "flask_login".');
        at: 'includeNative' put: (self boolProperty:
          'Optional: also search Grail''s native, Smalltalk-implemented modules (os, sys, math, ...). Default false: they answer with an implementation rather than a call site.');
        at: 'includeTests' put: (self boolProperty:
          'Optional: also search tests/python for the source shape (default false).');
        yourself)
      required: (Array with: 'name')
      defaultLimit: 50
      noun: 'hits')
    do: [:args | self tool_find_python_senders: args].
  aToolRegistry name: 'search_python_source'
    description: 'Case-sensitive substring search over the .py files of the configured Grail checkout -- the Python analogue of search_method_source, and the only tool here that answers for a module nothing has imported in this session. Answers path:line and the line. Pages with limit/offset.'
    inputSchema: (self pagedSchema:
      (Dictionary new
        at: 'pattern' put: (self propString: 'Substring to look for. Case-sensitive.');
        at: 'scope' put: (self propString:
          'Optional: restrict to a module or dotted prefix, e.g. "flask" or "flask.json", which is read as a path under the source tree.');
        at: 'includeTests' put: (self boolProperty:
          'Optional: also search tests/python (default false).');
        yourself)
      required: (Array with: 'pattern')
      defaultLimit: 50
      noun: 'hits')
    do: [:args | self tool_search_python_source: args].
  ^self
%
category: 'private'
method: McpGrailToolset
relativePathOf: aPath under: aRoot
  "aPath as written relative to aRoot, so a hit reads `flask/app.py:117` rather than repeating an
   absolute path nobody typed."
  ^(aPath size > aRoot size and: [(aPath copyFrom: 1 to: aRoot size) = aRoot])
    ifTrue: [aPath copyFrom: aRoot size + 2 to: aPath size]
    ifFalse: [aPath]
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
scope: aScopeOrNil matchesLabel: aLabel
  "Whether a dotted scope selects aLabel: itself, or anything under it. `flask` selects `flask` and
   `flask.app`, and not `flask_login` -- the boundary is a dot, not a prefix, or a scope would
   quietly widen to every module whose name starts the same way."
  aScopeOrNil isNil ifTrue: [^true].
  aLabel = aScopeOrNil ifTrue: [^true].
  ^(aLabel size > aScopeOrNil size)
    and: [(aLabel copyFrom: 1 to: aScopeOrNil size) = aScopeOrNil
      and: [(aLabel at: aScopeOrNil size + 1) = $.]]
%
category: 'private'
method: McpGrailToolset
scope: aScopeOrNil matchesRelativePath: aRelativePath
  "Whether a dotted scope selects a .py path. The scope is written in PYTHON (`flask.json`) and the
   path in the filesystem (`flask/json/__init__.py`), so the dots become slashes and the match is
   against a path prefix at a segment boundary -- plus the single-module case, where `flask.app`
   selects the file `flask/app.py`."
  | asPath |
  aScopeOrNil isNil ifTrue: [^true].
  asPath := aScopeOrNil collect: [:c | c = $. ifTrue: [$/] ifFalse: [c]].
  aRelativePath = (asPath , '.py') ifTrue: [^true].
  ^(aRelativePath size > asPath size)
    and: [(aRelativePath copyFrom: 1 to: asPath size) = asPath
      and: [(aRelativePath at: asPath size + 1) = $/]]
%
category: 'private'
method: McpGrailToolset
selector: aSelector callsPythonName: aName
  "Whether the env-1 selector aSelector is a call to the Python name aName.

   DECODING, NOT ENCODING. The obvious way to find the senders of `copyfile` is to build the
   selectors a call to it could have compiled to -- `copyfile:`, `copyfile:_:`, `copyfile:_:_:`,
   ... , `_copyfile:kw:` -- and look for those in each method's selector pool. That needs an arity
   nobody has: a Python name has as many fixed-arity selectors as it has call sites with differing
   argument counts, so the candidate list has no upper bound, and a search that stops at some arity
   misses every call above it SILENTLY -- the failure this tool exists to remove. Decoding each
   selector a method actually sends is exact, needs no arity, and reuses the single rule this class
   already states (#pythonNameOfSelector:) instead of maintaining its inverse. Grail publishes
   neither direction; see GemTalk/Grail#884.

   A SYMBOL IS NOT A STRING HERE: GemStone answers false for #abs = 'abs' (measured), so both sides
   are compared as Strings. String>>= is case-SENSITIVE, which is what Python names need -- several
   of its neighbours, includesString: among them, are not -- so `Copyfile` must not answer a search
   for `copyfile`."
  ^(self pythonNameOfSelector: aSelector) = aName asString
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
senderCoverageFor: aShapeSet classCount: aCount roots: aRootCollection includeNative: nativeBool includeTests: testsBool
  "The two lines every answer ends with: what was searched, and what was not.

   THIS IS THE POINT OF THE TOOL, not decoration on it. The failure being replaced is a confident
   `(none)` from a search that could not see environment 1 at all, and an answer of `no senders`
   is only worth anything if the reader can tell it from `I could not look there`. So the coverage
   is stated whether or not anything was found, the counts say what they are, and every gap names
   the argument that closes it where one exists.

   The class count is a FLOOR and is not dressed up as a total: Grail registers module-scope class
   statements only, so a nested class is not in it, and there is no enumeration of Python classes to
   compare against (GemTalk/Grail#885)."
  | searched not |
  searched := OrderedCollection new.
  not := OrderedCollection new.
  (aShapeSet includes: 'compiled') | (aShapeSet includes: 'references') ifTrue: [
    searched add: aCount printString , ' compiled '
      , (aCount = 1 ifTrue: ['class'] ifFalse: ['classes'])
      , ' (module classes and Python classes) in this session'].
  aRootCollection do: [:r | searched add: (r at: 1)].
  searched isEmpty ifTrue: [searched add: 'nothing'].
  nativeBool ifFalse: [
    not add: 'Grail''s native (Smalltalk-implemented) modules -- pass includeNative: true'].
  (aShapeSet includes: 'source') ifTrue: [
    testsBool ifFalse: [not add: 'tests/python -- pass includeTests: true'].
    aRootCollection isEmpty ifTrue: [
      not add: 'the .py files on disk: no grailDirectory is configured for this server']].
  (aShapeSet includes: 'source') ifFalse: [not add: 'the .py files on disk -- not among the shapes asked for'].
  (aShapeSet includes: 'compiled') ifFalse: [not add: 'compiled call sites -- not among the shapes asked for'].
  not add: 'modules whose .py nothing has imported in this session, which have nothing compiled to search'.
  not add: 'nested classes, and functions defined in an eval scope, which compile to blocks with no selector pool (GemTalk/Grail#885)'.
  "One gap per line. As a comma list this ran to four clauses on one line and stopped being read,
   which defeats the only thing it is for."
  ^'searched: ' , (self commaListOf: searched) , Character lf asString
    , 'not searched:' , Character lf asString
    , (not inject: '' into: [:acc :e | acc , '  ' , e , Character lf asString])
%
category: 'private'
method: McpGrailToolset
senderLineFor: aHit shape: aShapeLabel label: aLabel class: aClass
  "One hit, one line, machine-splittable and addressable.

   Every line carries the DOTTED PYTHON name a follow-up call can use (`get_python_source
   _grail_session.SessionDict`), because that is the address the reader thinks in, and then the
   Smalltalk identity in parentheses so get_method_source remains a way in when the Python answer
   is not enough. An absent line number is printed as `line ?` rather than omitted: the column
   staying put is what lets a reader scan the answer, and the reason it is absent is in the tool's
   own comment."
  | line text |
  line := aHit at: 3.
  text := aHit at: 4.
  ^(self shapeTag: aShapeLabel) , aLabel , '.' , (aHit at: 1)
    , '  line ' , (line isNil ifTrue: ['?'] ifFalse: [line printString])
    , (text isNil ifTrue: [''] ifFalse: ['  ' , (self trimmedLine: text)])
    , '  (' , aClass name asString , '>>' , (aHit at: 2) asString , ' env 1)'
%
category: 'private'
method: McpGrailToolset
shapeSetFrom: args
  "The shapes to search, defaulting to all three. An unknown shape is refused rather than ignored:
   a client that asks for `compile` and is silently given nothing would read the empty answer as
   `no senders`, which is the one mistake this tool must not make."
  | given known set |
  known := #( 'compiled' 'references' 'source' ).
  given := args at: 'shapes' ifAbsent: [nil].
  (given isNil or: [given isEmpty]) ifTrue: [^known asSet].
  "An equality Set, NOT an IdentitySet: each occurrence of a String literal in compiled code is its
   own object, so `#includes: 'compiled'` in another method would answer false for an identity set
   however right the contents looked in an inspector."
  set := Set new.
  given do: [:raw |
    | v |
    v := raw asString.
    (known detect: [:k | k = v] ifNone: [nil])
      ifNil: [
        ^McpError signalKind: #invalidParams message:
          '''' , v , ''' is not a shape. The shapes are: ' , (self commaListOf: known) , '.']
      ifNotNil: [:k | set add: k]].
  ^set
%
category: 'private'
method: McpGrailToolset
shapeTag: aShapeLabel
  "aShapeLabel padded to a fixed width, so the columns of an answer line up whichever shape found
   the hit and a reader can scan down one of them.

   Padded with a stream and timesRepeat: rather than `String new: n withAll: $ `, which does not
   exist on 3.7.5 -- and, GemStone having no notion of an optional method, showed up as a
   doesNotUnderstand from inside a finished tool rather than as anything a compile could catch."
  | s |
  s := WriteStream on: String new.
  s nextPutAll: aShapeLabel.
  ((10 - aShapeLabel size) max: 1) timesRepeat: [s nextPut: $ ].
  ^s contents
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
source: aSourceString hasSendOf: aKey at: anIndex
  "Whether aKey occurs at anIndex as a whole name rather than inside a longer one.

   The leading boundary is what separates the fast path `_dict` from the varargs selector `__dict:`
   of the SAME Python name -- without it every method appeared to be sent from its own arity glue.
   The trailing boundary is only needed for a unary key: a keyword key already ends in the colon
   that terminates it, and what follows is the argument."
  | size keySize endIndex |
  size := aSourceString size.
  keySize := aKey size.
  endIndex := anIndex + keySize - 1.
  endIndex > size ifTrue: [^false].
  (aSourceString copyFrom: anIndex to: endIndex) = aKey ifFalse: [^false].
  (anIndex > 1 and: [self isIdentifierCharacter: (aSourceString at: anIndex - 1)])
    ifTrue: [^false].
  aKey last = $: ifTrue: [^true].
  ^(endIndex < size and: [
      | next |
      next := aSourceString at: endIndex + 1.
      (self isIdentifierCharacter: next) or: [next = $:]]) not
%
category: 'private'
method: McpGrailToolset
sourceHitsForPattern: aPattern under: aRootPair scope: aScopeOrNil wholeName: aBoolean
  "Every line under one .py root holding aPattern, as an OrderedCollection of
   {relativePath. lineNumber. trimmedLine}, in path order.

   Read a LINE AT A TIME and only the matches kept, because the whole point is to answer over a
   corpus far larger than a gem's temporary object memory: 426,131 lines here, and holding even the
   file contents would not fit. The line number comes free from the read, which is what makes a hit
   addressable.

   The search is a case-SENSITIVE substring: Python names are case-sensitive, and String>>
   includesString: is not.

   aBoolean asks for whole-NAME matching, which is what separates the two callers. A sender search
   for `_dict` must not answer every line holding `__dict__`: measured over the stdlib, plain
   substring gave 1,153 hits and whole-name 15, and the difference is entirely noise a reader would
   have to filter by hand. search_python_source keeps the substring behaviour, because a pattern
   there is arbitrary text -- a decorator fragment, half a comment -- and boundaries would refuse
   the searches it exists for."
  | hits root |
  root := aRootPair at: 2.
  hits := OrderedCollection new.
  (self pythonSourceFilesUnder: root) asSortedCollection do: [:p |
    | rel |
    rel := self relativePathOf: p under: root.
    (self scope: aScopeOrNil matchesRelativePath: rel) ifTrue: [
      | f line n |
      f := [GsFile openReadOnServer: p] on: Error do: [:ex | nil].
      f ifNotNil: [
        n := 0.
        [[(line := f nextLine) isNil] whileFalse: [
          n := n + 1.
          (aBoolean
            ifTrue: [self line: line hasWholeName: aPattern]
            ifFalse: [(line findString: aPattern startingAt: 1) > 0]) ifTrue: [
            hits add: (Array with: (aRootPair at: 1) , '/' , rel with: n
                         with: (self trimmedLine: line))]]]
          ensure: [[f close] on: Error do: [:ex | nil]]]]].
  ^hits
%
category: 'private'
method: McpGrailToolset
sourceLinesFrom: aPath startingAt: aLineNumber label: aName
  "Read aPath and answer the definition beginning at aLineNumber, as an Array
   {path . firstFileLine . lines}. aLineNumber 0 means the whole file (a module), which begins at
   file line 1.

   The definition ends at the first line after it whose content begins at or to the left of the
   definition's OWN indentation -- Python's own block rule, which needs no parser and no knowledge
   of decorators, nesting or continuation lines. Blank lines are kept rather than ending the block,
   and trailing ones are dropped (by #headed:line:body:) so a definition does not come back padded
   to the next one.

   THE LINES, NOT THE TEXT, and the file line they start at: #pagedSource:args: needs both to head a
   page with the line the PAGE starts at rather than the line the definition does. This answered the
   rendered String before it could page."
  | f all keep base done |
  f := GsFile openReadOnServer: aPath.
  f isNil ifTrue: [
    ^McpError signalKind: #notFound message:
      'Cannot read ' , aPath , ' for ' , aName , '. The file the image recorded is not readable from '
        , 'this gem -- if this deployment names a Grail checkout (the grailDirectory option), check '
        , 'it is the one this image was installed from.'].
  all := OrderedCollection new.
  [ | line | [(line := f nextLine) isNil] whileFalse: [all add: line] ] ensure: [f close].
  aLineNumber = 0 ifTrue: [^Array with: aPath with: 1 with: all].
  aLineNumber > all size ifTrue: [
    ^Array with: aPath with: aLineNumber with: OrderedCollection new].
  "The definition's own indentation sets where the block ends. A blank first line means the line
   number the image recorded no longer matches the file, so fall back to column one -- the whole
   file after it is a worse answer than the old rule's."
  base := (self firstContentIndexIn: (all at: aLineNumber)) max: 1.
  keep := OrderedCollection new.
  done := false.
  aLineNumber to: all size do: [:i | | l |
    done ifFalse: [
      l := all at: i.
      (i > aLineNumber and: [self line: l endsBlockIndentedAt: base])
        ifTrue: [done := true]
        ifFalse: [keep add: l]]].
  ^Array with: aPath with: aLineNumber with: keep
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
storeInEffectAt: anIndex in: aStoreCollection
  "The {lineOrNil. textOrNil} of the last position store before anIndex, or two nils when there is
   none. The stores arrive in ascending source order (#positionStoresIn:), so the last one that
   starts before the send is the one in effect at it."
  | found |
  found := Array with: nil with: nil.
  aStoreCollection do: [:st |
    (st at: 1) < anIndex ifTrue: [found := Array with: (st at: 2) with: (st at: 3)]].
  ^found
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
symbolLiteralAt: anIndex in: aSourceString
  "The text of the Symbol literal at anIndex -- `abs` from either `#abs` or `#'abs'` -- or nil when
   there is no literal there. Both forms occur in generated code, sometimes for the same name in
   the same statement."
  | i size out |
  size := aSourceString size.
  i := anIndex.
  (i <= size and: [(aSourceString at: i) = $#]) ifFalse: [^nil].
  i := i + 1.
  i > size ifTrue: [^nil].
  (aSourceString at: i) = $' ifTrue: [^self quotedStringAt: i in: aSourceString].
  out := WriteStream on: String new.
  [i <= size and: [self isIdentifierCharacter: (aSourceString at: i)]] whileTrue: [
    out nextPut: (aSourceString at: i).
    i := i + 1].
  ^out contents isEmpty ifTrue: [nil] ifFalse: [out contents]
%
category: 'options'
method: McpGrailToolset
testGemConfig
  "The gem configuration run_python_tests forks its test gem with: a gemnetobject -C parameter
   string, NAME=value pairs separated by semicolons and no spaces.

   THE DEFAULT IS GRAIL'S OWN, verbatim: scripts/run_tests.sh runs every one of its test sessions
   with GEM_TEMPOBJ_CODE_SIZE=300000 and GEM_TEMPOBJ_CACHE_SIZE=900000, because a suite that imports
   a framework overflows both a stock temporary object cache and the code space carved out of it.
   BOTH are needed, and the second is the one easily missed: GEM_TEMPOBJ_CODE_SIZE defaults to 0,
   which means 20% of the cache capped at 150MB (data/system.conf), so raising only the cache still
   leaves the code space short of what a cold framework import compiles -- and `code space overflow'
   is how the failure actually reads. Both are CEILINGS the gem grows into rather than reservations,
   so asking for them costs nothing until a run needs the room; that is why the default is generous
   rather than measured against the classes asked for.

   NAMING A PARAMETER A GIVEN VERSION DOES NOT HAVE IS SAFE, which is what lets one literal serve
   the whole version matrix: for a gem, unlike for startstone, a configuration syntax error is not
   fatal -- the parameter is ignored and its default applies (System Administration Guide,
   Configuration File Syntax). An out-of-range one warns and clamps, which matters for
   GEM_TEMPOBJ_CODE_SIZE: its maximum is 600MB, but only 40MB on Linux ARM.

   A deployment lowers it on a host too small for that, or raises it for a whole-suite run, by
   setting the option (class>>declaredOptionNames). The string goes into the NRS verbatim, so it
   must carry no whitespace and none of the NRS metacharacters -- refused here rather than passed
   on to be truncated into a half-applied budget, which would look exactly like the bug this exists
   to prevent."
  | cfg |
  cfg := (self optionNamed: 'testGemConfig'
    ifAbsent: ['GEM_TEMPOBJ_CACHE_SIZE=900000;GEM_TEMPOBJ_CODE_SIZE=300000;']) asString.
  (cfg select: [:c | c isSeparator or: ['!#@^' includes: c]]) isEmpty ifFalse: [
    ^McpError signalKind: #refused message:
      'The McpGrailToolset option testGemConfig is passed to gemnetobject as one -C argument inside '
        , 'a network resource string, so it must be NAME=value pairs separated by semicolons, with '
        , 'no whitespace and none of ! # @ ^. It was ' , cfg printString , '.'].
  ^cfg
%
category: 'private'
method: McpGrailToolset
testGemDeathCauseFor: anError
  "The sentence naming what killed the test gem, from the GCI error number its dead session raised.

   THE NUMBER IS THE TEST, NOT THE MESSAGE TEXT -- the same rule, and the same reason, as
   McpRouter>>isSessionGoneError:. A GciError carries the number the C layer reported as
   #originalNumber; anything that is not one carries no number to quote.

   Split from #testGemDeathCauseForGciNumber: because a GciError cannot be built: it answers
   instVarAt:put: with `structural updates disallowed`, and #_error:in: reaches the fatal band only
   by sending #_describe to an external session -- which this project may not do at all
   (docs/GemStone_Notes.md). So the only genuine 4067 comes from a gem that really died, and the
   policy has to be reachable without one."
  ^self testGemDeathCauseForGciNumber:
    ((anError isKindOf: GciError)
      ifTrue: [[anError originalNumber] on: Error do: [:ex | nil]]
      ifFalse: [nil])
%
category: 'private'
method: McpGrailToolset
testGemDeathCauseForGciNumber: aNumberOrNil
  "What a GCI error number means for a test gem that stopped answering, as a sentence.

   4067 IS THE ONE WORTH NAMING: the kernel's own code for a gem out of temporary object memory,
   which is the single cause here an operator can act on. Measured 2026-09-09 on 3.7.5, forking with
   GEM_TEMPOBJ_CACHE_SIZE=40000 and running ArgparseTestCase: the gem died inside the first Grail
   import and the session raised 4067. At the default budget the same class runs clean.

   THE GciError'S TEXT NEVER REACHES THE CLIENT, which is why this takes a number and not the error.
   Measured on the same run, GciError>>_error:in: appends `for session ' , externalSession _describe`
   to any error in the 4000-4999 band, and _describe yields the stone NRS, the GemStone user and the
   gem NRS -- host, netldi and the whole gemnetobject command line. Not a thing to hand an MCP
   client. The number goes instead, and the operator reads the failure in full from the test gem's
   own log, where the kernel already wrote it. That is exactly the split
   McpRouter>>sessionGoneErrorFor:id: makes, for this same error out of this same band.

   The budget IS named, because it is ours rather than the kernel's: it is the setting that was in
   force, it is the thing to change, and it discloses nothing the caller did not configure."
  aNumberOrNil = 4067 ifTrue: [
    ^'the test gem ran out of temporary object memory (GCI error 4067). It was forked with '
      , self testGemConfig , ', so either raise that (the McpGrailToolset option testGemConfig) or '
      , 'ask for fewer classes in one call.'].
  ^'the test gem stopped answering'
    , (aNumberOrNil isNil ifTrue: [''] ifFalse: [' (GCI error ' , aNumberOrNil printString , ')'])
    , '. Its own gem log says what happened to it.'
%
category: 'private'
method: McpGrailToolset
testRunnerClassListExpressionFor: aNamesCollectionOrNil directory: aDirectory
  "The first expression run in the test gem: configure Grail, and answer the names of the
   PythonTestCase classes this run will drive, space separated and sorted. The caller then runs them
   one at a time (tool_run_python_tests:).

   $GRAIL_DIR rather than `importlib grailDir:` because PythonTestCase class>>suite -- which is what
   `c suite` sends -- calls initGrail, and initGrail ASSIGNS grailDir from $GRAIL_DIR or the gem's
   working directory. So a grailDir set here would be overwritten by the very next send, and the
   directory would come out as the stone's. That is a Grail defect (reported; a patch is proposed),
   not a shape to design around: the env var is what Grail's own runner scripts export and what its
   Python-side importlib reads directly, so it is the right thing to set either way, and it also
   happens to survive. Setting it ONCE here is enough for every later send: it is process
   environment, and the process is the same gem.

   Names are embedded via printString and resolved in the CHILD by objectNamed:, so nothing a client
   sends is ever compiled as code -- the same rule the worker bootstrap follows. A name that does
   not resolve is simply absent from the answer, and the caller reports it as NOT FOUND against the
   name it asked for: 'ran 0 classes' and 'you misspelled it' must not look alike."
  | s |
  s := WriteStream on: String new.
  s nextPutAll: '| classes ws |'; nextPut: Character lf.
  s nextPutAll: 'System gemEnvironmentVariable: ''GRAIL_DIR'' put: ';
    nextPutAll: aDirectory printString; nextPutAll: '.'; nextPut: Character lf.
  aNamesCollectionOrNil isNil
    ifTrue: [s nextPutAll: 'classes := (PythonTestCase allSubclasses reject: [:c | c isAbstract]) asArray.']
    ifFalse: [
      s nextPutAll: 'classes := OrderedCollection new. #('.
      aNamesCollectionOrNil do: [:n |
        s nextPutAll: n asString printString; nextPut: Character space].
      s nextPutAll: ') do: [:n | | c | c := System myUserProfile objectNamed: n asSymbol.'.
      s nextPutAll: ' ((c isKindOf: Behavior) and: [c inheritsFrom: PythonTestCase])'.
      s nextPutAll: ' ifTrue: [classes add: c]].'].
  s nextPut: Character lf.
  s nextPutAll: 'classes := (classes asSortedCollection: [:a :b | a name <= b name]) asArray.';
    nextPut: Character lf.
  s nextPutAll: 'ws := WriteStream on: String new.'; nextPut: Character lf.
  s nextPutAll: 'classes do: [:c | ws nextPutAll: c name asString]';
    nextPutAll: ' separatedBy: [ws nextPut: Character space].'; nextPut: Character lf.
  s nextPutAll: 'ws contents'.
  ^s contents
%
category: 'private'
method: McpGrailToolset
testRunnerExpressionForClassNamed: aName
  "One class's run, in the gem the class list came from: its four counts on the first line, then its
   defect report when it has one.

   ONE CLASS PER SEND IS WHAT MAKES A DEAD GEM REPORTABLE. A single send that ran every class
   answered nothing at all when the gem died on memory -- the caller got a GciError from a session
   with no gem behind it, and every class that had already PASSED went with it, so the one fact
   worth having (which class is the expensive one) was the one fact destroyed. Driving the classes
   one at a time costs a round trip each, which is nothing beside a cold import, and leaves each
   finished class's counts in the caller, the only place that outlives the child.

   `c suite run: result` rather than a hand-rolled loop over `suite tests`, which measured
   differently on 3.7.5 (see McpTestingToolset>>tool_run_test_class:). A result per class rather
   than one shared across them: the counts add up the same, and a shared one could not have survived
   the send it was built in anyway.

   GrailTestResult, not the stock TestResult, because stock SUnit keeps only the failing TestCase --
   its message and stack are discarded in the handler -- so a report could say no more than
   `Cls debug: #sel`. Looked up rather than named directly, so this still runs on a Grail old enough
   not to have it. aName is a class name the gem itself answered, not client text, and it still
   travels as a string literal resolved there."
  | s |
  s := WriteStream on: String new.
  s nextPutAll: '| c result ws |'; nextPut: Character lf.
  s nextPutAll: 'c := System myUserProfile objectNamed: ';
    nextPutAll: aName asString printString; nextPutAll: ' asSymbol.'; nextPut: Character lf.
  s nextPutAll: 'result := ((System myUserProfile objectNamed: #GrailTestResult)';
    nextPutAll: ' ifNil: [TestResult]) new.'; nextPut: Character lf.
  s nextPutAll: 'c suite run: result.'; nextPut: Character lf.
  s nextPutAll: 'ws := WriteStream on: String new.'; nextPut: Character lf.
  s nextPutAll: 'ws nextPutAll: result runCount printString, '' '', result passedCount printString,';
    nextPut: Character lf.
  s nextPutAll: '  '' '', result failureCount printString, '' '', result errorCount printString.';
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
tool_find_python_senders: args
  "Who calls, or refers to, a Python name -- across every shape Grail compiles a reference into,
   saying which shapes it searched.

   WHY THIS EXISTS. The stock Smalltalk sender search scans environment 0, and Grail compiles Python
   into environment 1, so it does not under-report -- it reports NOTHING, confidently. Measured on
   3.7.5 with `_grail_session` imported: `ClassOrganizer new sendersOf: #'_dict'` answers an empty
   pair of arrays where 12 senders exist, and `find_senders` through MCP answers `(none)`. A false
   negative about code is worse than a slow answer about it.

   THREE SHAPES, because a Python reference compiles to three unrelated things and no one of them is
   the answer:

     compiled   -- a resolvable call, found in the selector pool of a generated method and positioned
                   from the source (#pythonSendersOfName:in:). Exact: the pool is what the method
                   really sends.
     references -- a first-class reference (`g = abs`) or a call on a receiver Grail could not
                   resolve (`os.path.isdir(x)`), which leave a Symbol literal and NO selector
                   (#pythonReferencesOfName:in:).
     source     -- the .py text on disk, which is the only shape that can answer for a module
                   nothing has imported in this session.

   MATCHING IS SYNTACTIC AND NEVER IMPORTS. The last segment of the name is what is matched; leading
   segments narrow and label. Resolving the name instead would give exact arities, and would make a
   SEARCH a database write -- a cold import in Grail compiles and writes -- which is both surprising
   and the reason it could not be read-only safe. Over-matching is reported instead: a bare name
   answers hits in every module, each labelled with the module it is in, and `scope` narrows.

   Nothing here imports, resolves or compiles."
  | name shapes scope includeNative includeTests classes lines total roots compiledCount refCount sourceCount |
  self ensureGrailConfigured.
  name := (args at: 'name') asString.
  shapes := self shapeSetFrom: args.
  scope := args at: 'scope' ifAbsent: [nil].
  scope ifNotNil: [scope := scope asString].
  includeNative := (args at: 'includeNative' ifAbsent: [false]) == true.
  includeTests := (args at: 'includeTests' ifAbsent: [false]) == true.
  lines := OrderedCollection new.
  compiledCount := 0.
  refCount := 0.
  sourceCount := 0.
  classes := (self pythonSearchScopeIncludingNative: includeNative)
    select: [:e | self scope: scope matchesLabel: (e at: 1)].
  classes do: [:entry |
    | label cls |
    label := entry at: 1.
    cls := entry at: 2.
    (shapes includes: 'compiled') ifTrue: [
      (self pythonSendersOfName: (self lastDotSegmentOf: name) in: cls) do: [:h |
        compiledCount := compiledCount + 1.
        lines add: (self senderLineFor: h shape: 'compiled' label: label class: cls)]].
    (shapes includes: 'references') ifTrue: [
      (self pythonReferencesOfName: (self lastDotSegmentOf: name) in: cls) do: [:h |
        refCount := refCount + 1.
        lines add: (self senderLineFor: h shape: 'reference' label: label class: cls)]]].
  roots := (shapes includes: 'source')
    ifTrue: [self pythonSourceRootsIncludingTests: includeTests]
    ifFalse: [OrderedCollection new].
  roots do: [:r |
    (self sourceHitsForPattern: (self lastDotSegmentOf: name) under: r scope: scope
       wholeName: true) do: [:h |
      sourceCount := sourceCount + 1.
      lines add: (self shapeTag: 'source') , (h at: 1) , ':' , (h at: 2) printString
                    , '  ' , (h at: 3)]].
  total := lines size.
  total = 0 ifTrue: [
    ^self absentSenderReport: name
      searched: (self commaListOf: (Array with: classes size printString , ' compiled classes'
                   with: roots size printString , ' .py trees'))
      notSearched: 'see the shapes and flags on this tool'].
  ^self capResult: (self page: lines args: args defaultLimit: 50)
    , 'compiled ' , compiledCount printString , ', references ' , refCount printString
    , ', .py text ' , sourceCount printString , Character lf asString
    , (self senderCoverageFor: shapes classCount: classes size roots: roots
         includeNative: includeNative includeTests: includeTests)
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

   The end of a definition is found by INDENTATION -- the first later line that is not blank and is
   indented no further than the definition's own first line -- which is how Python delimits a block
   and needs no parser, for a method inside a class as much as for a module-level def. A module
   answers its whole file. Both are capped by capResult:, and both page -- limit/offset count LINES
   here, and the `# <path>:<line>` header names where the page starts, not where the definition
   does. See #pagedSource:args:."
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
    self capResult: (self pagedSource: (self sourceLinesFrom: path asString startingAt: firstLine label: name)
      args: args)]
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
  | name cls out sigs codes order lines common |
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
  "The method lines are collected rather than streamed so they can be paged. The class name, the
   file and the signature-table NOTE stay OUTSIDE the page: they describe the whole class, not the
   window, and a page 2 that had lost the class it belongs to would be unreadable.
   Nothing is sorted -- the order is the class body's own (___classBodyOrder___), which is what an
   offset needs and what the file reads in."
  lines := order collect: [:m | | sig loc line |
    sig := self signatureFor: m from: sigs on: cls.
    loc := self sourceLocationFor: m from: codes.
    line := '  ', sig.
    loc isNil
      ifTrue: [line]
      ifFalse: [line , '  -- ' , (common isNil ifTrue: [loc] ifFalse: ['line ' , (self lineOfLocation: loc)])]].
  lines isEmpty
    ifTrue: [out nextPutAll: '  (no python methods)'; nextPut: Character lf]
    ifFalse: [out nextPutAll: (self page: lines args: args defaultLimit: nil)].
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
   reporting -- an unbounded wait with no word is worse than a slow one that says so.

   ONE CLASS PER SEND, AND WHY. A fresh gem is also a gem that can die, and the way it dies is on
   memory: everything the run compiles stays in one session's temporary object memory, and a gem
   forked with a netldi's defaults ran out of it partway through a single class (measured: 11.6s,
   `VM temporary object memory is full, native code space full`). #newGrailTestSession now asks for
   Grail's own budget, which is the fix; driving the classes one at a time is what makes the
   remaining failure legible. The counts and defect reports accumulate HERE rather than in the
   child, so a gem that dies at class nine still leaves eight classes' results behind, and the
   answer names the class it died on instead of a GciError from a session with no gem in it."
  | dir names sess startedAt listed runs passed failed errors defects died atClass i out reply |
  dir := self grailDirectory.
  dir isNil ifTrue: [
    ^McpError signalKind: #refused message:
      'run_python_tests needs to know where the Grail checkout is: its tests import .py modules and '
        , 'load fixtures from disk. Configure the toolset option grailDirectory on the router '
        , '(McpRouter>>toolsetOptions:). Without it Grail falls back to this gem''s working directory, '
        , 'which is the stone''s and holds no src/python/stdlib -- every test would report an error '
        , 'that says more about the session than about Grail.'].
  names := args at: 'classNames' ifAbsent: [nil].
  startedAt := System timeGmt.
  sess := self newGrailTestSession.
  ^[runs := 0. passed := 0. failed := 0. errors := 0.
    defects := WriteStream on: String new.
    listed := (self childResultFrom: sess
      expression: (self testRunnerClassListExpressionFor: names directory: dir)
      progress: 'starting a fresh gem for Grail''s tests'
      since: startedAt) subStrings: ' '.
    i := 1.
    [died isNil and: [i <= listed size]] whileTrue: [
      atClass := listed at: i.
      "Only the SEND is guarded. A gem that dies raises here and nowhere else, so a failure to read
       an answer we built ourselves must not be reported as one."
      reply := [self childResultFrom: sess
        expression: (self testRunnerExpressionForClassNamed: atClass)
        progress: 'running ' , atClass , ' (' , i printString , ' of '
          , listed size printString , ')'
        since: startedAt]
          on: Error do: [:ex | died := ex. nil].
      reply ifNotNil: [ | counts brk |
        "first line: run passed failed errors. Anything after it is this class's defect report."
        brk := reply indexOf: Character lf.
        counts := (brk = 0 ifTrue: [reply] ifFalse: [reply copyFrom: 1 to: brk - 1]) subStrings: ' '.
        runs := runs + (counts at: 1) asNumber.
        passed := passed + (counts at: 2) asNumber.
        failed := failed + (counts at: 3) asNumber.
        errors := errors + (counts at: 4) asNumber.
        brk = 0 ifFalse: [
          defects nextPut: Character lf;
            nextPutAll: (reply copyFrom: brk + 1 to: reply size)].
        i := i + 1]].
    died ifNotNil: [
      ^McpError signalKind: #testGemDied message: (self capResult:
        'run_python_tests did not finish: ' , (self testGemDeathCauseFor: died)
          , (String with: Character lf)
          , 'It died on ' , atClass , ', class ' , i printString , ' of '
          , listed size printString , '. '
          , (i = 1
              ifTrue: ['No class had completed.']
              ifFalse: ['Completed first: ' , (self commaListOf: (listed copyFrom: 1 to: i - 1))
                , ' -- ' , runs printString , ' run, ' , passed printString , ' passed, '
                , failed printString , ' failed, ' , errors printString , ' errors.'])
          , defects contents)].
    out := WriteStream on: String new.
    out nextPutAll: listed size printString , ' class(es), ' , runs printString , ' run, '
      , passed printString , ' passed, ' , failed printString , ' failed, '
      , errors printString , ' errors'.
    names ifNotNil: [ | missing |
      missing := names reject: [:n | listed includes: n asString].
      missing isEmpty ifFalse: [
        out nextPut: Character lf; nextPutAll: 'NOT FOUND: '.
        missing do: [:n | out nextPutAll: n asString; nextPut: Character space]]].
    out nextPutAll: defects contents.
    self capResult: out contents]
      ensure: [[sess logout] on: Error do: [:ex | nil]]
%
category: 'tools - python'
method: McpGrailToolset
tool_search_python_source: args
  "Substring search over the .py files of the configured Grail checkout -- the Python analogue of
   search_method_source, and the only tool here that can answer about a module nothing has imported.

   Separate from find_python_senders rather than folded into it because the questions differ. A
   sender search is about ONE name and wants every shape it compiles to; this is about arbitrary
   text -- a decorator, a comment, a TODO, an import line -- and wants nothing but the file and the
   line. Measured cost of the whole stdlib: 1,412 files, 426,131 lines, 248ms, so it runs
   synchronously and reports a true total.

   Case-SENSITIVE, like every other search here: Python names are, and GemStone's
   String>>includesString: is not."
  | pattern scope includeTests roots hits lines |
  self ensureGrailConfigured.
  pattern := (args at: 'pattern') asString.
  scope := args at: 'scope' ifAbsent: [nil].
  scope ifNotNil: [scope := scope asString].
  includeTests := (args at: 'includeTests' ifAbsent: [false]) == true.
  roots := self pythonSourceRootsIncludingTests: includeTests.
  roots isEmpty ifTrue: [
    ^McpError signalKind: #unknown message:
      'No Python source tree to search: this server has no grailDirectory configured, so the .py '
        , 'files are not reachable from here. The compiled shapes are still searchable with '
        , 'find_python_senders.'].
  hits := OrderedCollection new.
  roots do: [:r |
    hits addAll: (self sourceHitsForPattern: pattern under: r scope: scope wholeName: false)].
  hits isEmpty ifTrue: [
    ^self absentSenderReport: pattern
      searched: (self commaListOf: (roots collect: [:r | r at: 1]))
      notSearched: (includeTests
        ifTrue: ['nothing else under the checkout']
        ifFalse: ['tests/python -- pass includeTests: true'])].
  lines := hits collect: [:h | (h at: 1) , ':' , (h at: 2) printString , '  ' , (h at: 3)].
  ^self capResult: (self page: lines args: args defaultLimit: 50)
    , 'searched: ' , (self commaListOf: (roots collect: [:r | r at: 1]))
    , (includeTests ifTrue: [''] ifFalse: ['. not searched: tests/python -- pass includeTests: true'])
%
category: 'accessing'
method: McpGrailToolset
toolNames
  ^#( 'compile_python' 'describe_python_class' 'eval_python' 'find_python_senders'
      'get_python_source' 'list_python_methods' 'python_module_state' 'run_python_tests'
      'search_python_source' )
%
category: 'private'
method: McpGrailToolset
trimmedLine: aString
  "aString without leading or trailing whitespace, its line terminator included. Written out rather
   than sent #trimSeparators, which this project cannot rely on across the GemStone versions it
   supports."
  | first last |
  first := 1.
  last := aString size.
  [first <= last and: [(aString at: first) isSeparator]] whileTrue: [first := first + 1].
  [last >= first and: [(aString at: last) isSeparator]] whileTrue: [last := last - 1].
  ^aString copyFrom: first to: last
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
