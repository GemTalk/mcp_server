set compile_env: 0
! ------------------- Class definition for McpMutationToolset
expectvalue /Class
doit
McpToolset subclass: 'McpMutationToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpMutationToolset comment: 
'The tools that change the image: define/redefine a class, compile or delete a method, set a class
comment, add or remove a symbol dictionary.

THESE TOOLS DO NOT COMMIT (changed 2026-08-28; docs/server-to-client-messaging.md 10.11). Each one
committed at the end until then, which was the only way a change could outlive the call -- the
dispatcher aborted before every tool, so nothing else survived. Now that the pre-call refresh keeps
uncommitted work (System continueTransaction), autocommitting is a liability rather than a feature:
it publishes a half-finished class redefinition whose method recompiles failed, it makes it
impossible to run the tests BEFORE deciding to keep a change, and it puts a commit -- the one
operation that can fail on conflict and jam the session -- inside seven tools that have no
business reporting one. `commit` is now the only tool that commits, and everything measured here
is undone by `abort`: a method, a class binding, a shape-changing redefinition with its recompiled
methods (the class history shrinks back too) and, contrary to the obvious guess, a symbol
dictionary added to or removed from the user''s symbol list.

NONE are read-only-safe (readOnlySafeToolNames is inherited, i.e. empty), so a read-only session
drops this toolset whole. Every handler additionally passes through the inherited kernel guard
(self assertMutableClass: / self assertRemovableDictionaryNamed:, see McpToolset) before it changes
anything, so even a read-write session cannot modify a protected class. That guard FORWARDS to the
server, which is where the policy lives and where a subclass overrides it: what counts as protected
is one answer per deployment, not one per tool pack.'
%
expectvalue /Class
doit
McpMutationToolset category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpMutationToolset
removeallmethods McpMutationToolset
removeallclassmethods McpMutationToolset
! ------------------- Class methods for McpMutationToolset
! ------------------- Instance methods for McpMutationToolset
category: 'private'
method: McpMutationToolset
dictionaryForClassNamed: aName requested: aDictionaryNameOrNil
  "Where to define the class: the dictionary the client named, else the one the class already lives
   in (so a redefinition does not silently move it), else UserGlobals."
  | existing arr |
  aDictionaryNameOrNil ifNotNil: [:n | ^self dictNamed: n asString].
  existing := self resolveClass: aName.
  existing ifNotNil: [:c |
    arr := System myUserProfile dictionaryAndSymbolOf: c.
    arr ifNotNil: [^arr at: 1]].
  ^self dictNamed: 'UserGlobals'
%
category: 'private'
method: McpMutationToolset
recompileMethodsFrom: oldClass into: newClass named: classNameSymbol
  "Recompile every instance- and class-side method of oldClass onto newClass, preserving
   category and environmentId. Commit (apply-and-report) and return a report listing any
   methods that failed to recompile under the new shape (each with its CompileError details,
   the same descriptor a failed compile_method returns)."
  | sides failures total classNameString s |
  failures := OrderedCollection new.
  total := 0.
  sides := Array
    with: (Array with: 'instance' with: oldClass with: newClass)
    with: (Array with: 'class' with: oldClass class with: newClass class).
  sides do: [:triple | | side src tgt |
    side := triple at: 1. src := triple at: 2. tgt := triple at: 3.
    src selectors do: [:sel | | errs |
      total := total + 1.
      errs := [tgt
        compileMethod: (src sourceCodeAt: sel)
        dictionaries: System myUserProfile symbolList
        category: ((src categoryOfSelector: sel) ifNil: ['other']) asString
        environmentId: (src compiledMethodAt: sel) environmentId.
        nil] on: CompileError do: [:ex | ex errorDetails].
      errs ifNotNil: [failures add: (Array with: side with: sel with: errs)]]].
  classNameString := classNameSymbol asString.
  s := WriteStream on: String new.
  s nextPutAll: 'Redefined ' , classNameString , '; recompiled ' , (total - failures size) printString
    , '/' , total printString , ' methods'.
  failures isEmpty
    ifTrue: [s nextPutAll: '; all recompiled.']
    ifFalse: [s nextPutAll: '; ' , failures size printString , ' failed:'; nextPut: Character lf.
      failures do: [:f |
        s nextPutAll: '  ' , (f at: 1) , ' ' , classNameString , '>>' , (f at: 2) asString , ' - ' , (f at: 3) printString;
          nextPut: Character lf]].
  ^s contents
%
category: 'registration'
method: McpMutationToolset
registerOn: aToolRegistry
  | classArg dictArg |
  classArg := self objectSchema:
    (Dictionary new at: 'className' put: (self propString: 'Name of the class'); yourself)
    required: (Array with: 'className').
  dictArg := self objectSchema:
    (Dictionary new at: 'dictionaryName' put: (self propString: 'Name of the symbol dictionary'); yourself)
    required: (Array with: 'dictionaryName').
  aToolRegistry name: 'add_dictionary'
    description: 'Create a new symbol dictionary and append it to the user symbol list. Not committed: call commit to persist, abort to discard.'
    inputSchema: dictArg do: [:args | self tool_add_dictionary: args].
  aToolRegistry name: 'compile_class_definition'
    description: 'Define or redefine a class from named parts (superclass, instance variables, class variables, ...). Not committed: call commit to persist, abort to discard (which restores the previous class and its methods intact). On a shape-changing redefinition of an existing class, by default recompiles its existing methods onto the new version and reports any that fail; refused if the class has subclasses. Redefining a class this session has not read is refused: call get_class_definition first, or export_class_source when recompileMethods is false, which drops every method.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'className' put: (self propString: 'Name of the class to define or redefine');
        at: 'superclassName' put: (self propString: 'Name of the superclass (default Object)');
        at: 'instVarNames' put: (self stringArrayProperty: 'Instance variable names');
        at: 'classVars' put: (self stringArrayProperty: 'Class variable names');
        at: 'classInstVars' put: (self stringArrayProperty: 'Class-side instance variable names');
        at: 'poolDictionaries' put: (self stringArrayProperty: 'Names of pool dictionaries in the symbol list');
        at: 'dictionary' put: (self propString: 'Dictionary to define the class in (default: where it already lives, else UserGlobals)');
        at: 'options' put: (self stringArrayProperty: 'Class options, e.g. subclassesDisallowed');
        at: 'recompileMethods' put: (self boolProperty: 'Default true: after a shape change, recompile the class existing methods onto the new version and report failures (refused if the class has subclasses). False: redefine raw, dropping all methods.');
        yourself)
      required: (Array with: 'className'))
    do: [:args | self tool_compile_class_definition: args].
  aToolRegistry name: 'compile_method'
    description: 'Compile (add or update) a method on a class. Not committed: call commit to persist, abort to discard. The method is usable in this session immediately, so tests can be run against it before deciding to commit. Set meta=true for class-side. Category defaults to "mcp".'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'className' put: (self propString: 'Name of the class');
        at: 'source' put: (self propString: 'Full method source including the selector line');
        at: 'category' put: (self propString: 'Method category (optional, default mcp)');
        at: 'meta' put: (self boolProperty: 'true for the class-side method (default false)');
        yourself)
      required: (Array with: 'className' with: 'source'))
    do: [:args | self tool_compile_method: args].
  aToolRegistry name: 'delete_class'
    description: 'Remove a class from its dictionary. Destructive. Not committed: call commit to persist, abort to discard.'
    inputSchema: classArg do: [:args | self tool_delete_class: args].
  aToolRegistry name: 'delete_method'
    description: 'Remove a method from a class. Destructive. Not committed: call commit to persist, abort to discard. Set meta=true for the class-side method.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'className' put: (self propString: 'Name of the class');
        at: 'selector' put: (self propString: 'Selector of the method to remove');
        at: 'meta' put: (self boolProperty: 'true for the class-side method (default false)');
        yourself)
      required: (Array with: 'className' with: 'selector'))
    do: [:args | self tool_delete_method: args].
  aToolRegistry name: 'remove_dictionary'
    description: 'Remove a symbol dictionary from the user symbol list. Destructive. Not committed: call commit to persist, abort to discard.'
    inputSchema: dictArg do: [:args | self tool_remove_dictionary: args].
  aToolRegistry name: 'set_class_comment'
    description: 'Set (replace) the class comment. Not committed: call commit to persist, abort to discard.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'className' put: (self propString: 'Name of the class');
        at: 'comment' put: (self propString: 'New comment text');
        yourself)
      required: (Array with: 'className' with: 'comment'))
    do: [:args | self tool_set_class_comment: args].
  ^self
%
category: 'private'
method: McpMutationToolset
resolvePoolDictionaryNames: aCollectionOfNames
  "The SymbolDictionaries those names bind, or nil if any of them does not resolve -- the caller
   reports that rather than defining a class with a silently short pool list."
  | out d |
  out := OrderedCollection new.
  aCollectionOfNames do: [:n |
    d := self dictNamed: n asString.
    d isNil ifTrue: [^nil].
    out add: d].
  ^out asArray
%
category: 'private'
method: McpMutationToolset
symbolNamesFrom: aCollectionOfNames
  "Names as Symbols, which is what the subclass: family expects for variables and options."
  ^(aCollectionOfNames collect: [:n | n asString asSymbol]) asArray
%
category: 'tools - mutation'
method: McpMutationToolset
tool_add_dictionary: args
  | name up d |
  name := args at: 'dictionaryName'.
  ^(self dictNamed: name) notNil
    ifTrue: ['Dictionary already exists: ' , name]
    ifFalse: [up := System myUserProfile.
      d := up createDictionary: name asSymbol.
      up insertDictionary: d at: up symbolList size + 1.
      "Creation is never blind -- there was nothing to read. Still recorded, so that a commit leaves
       the new dictionary licensed for a follow-up change."
      self noteWrite: (self dictionaryKeyFor: name).
      'Created dictionary: ' , name]
%
category: 'tools - mutation'
method: McpMutationToolset
tool_compile_class_definition: args
  "Define or redefine a class from STRUCTURED arguments. Does NOT commit (see the class comment).

   WHY NOT A SOURCE STRING. Until now this took the definition as Smalltalk and ran `source
   evaluate`, checking only afterwards that the result was a Behavior -- by which point any side
   effect had already happened. A source of 'System commitTransaction. Object' passed that check
   with the commit already done, so this was execute_code with a return-type assertion, and a
   deployment that left McpExecutionToolset out to close the escape hatch had not actually closed
   it. Building the definition here from named arguments cannot evaluate anything, and the string
   parser that used to recover the class name goes with it.

   The superclass may be any class that resolves, kernel classes included: subclassing Object is
   the normal case, and nothing about it modifies the superclass. The kernel guard applies to the
   class being REDEFINED, which is where the damage would be.

   On a shape-changing redefinition of an existing class -- which drops every method -- the prior
   version's methods are recompiled onto the new one by default, read from the old class AS RESOLVED
   IN THE CURRENT VIEW, so what lands is other sessions' latest work rather than anything this
   client remembered. That is why the guardrail asks only for the shape to have been read on this
   path, while a raw redefinition, which discards those methods for good, asks for the whole class."
  | name recompile existing superclass dict opts poolDicts newClass beforeDef |
  name := (args at: 'className') asString.
  recompile := (args at: 'recompileMethods' ifAbsent: [true]) ~~ false.
  existing := self resolveClass: name.
  existing ifNotNil: [:c | self assertMutableClass: c].
  superclass := self resolveClass: (args at: 'superclassName' ifAbsent: ['Object']).
  superclass isNil ifTrue: [
    ^'Superclass not found: ' , (args at: 'superclassName' ifAbsent: ['Object']) asString].
  "Creation is never blind. Redefining is: on the default path the shape is what is being replaced,
   and on a raw redefine every method goes too, seen or not."
  existing ifNotNil: [:c |
    recompile
      ifTrue: [self requireRead: (self shapeKeyFor: c name)
        subject: 'the definition of ' , c name asString
        tool: 'compile_class_definition'
        hint: 'Call get_class_definition(' , c name asString , ') first.']
      ifFalse: [self requireWholeClassRead: c tool: 'compile_class_definition'
        because: 'redefining with recompileMethods=false drops every method the class has.']].
  (recompile and: [existing notNil and: [existing subclasses isEmpty not]]) ifTrue: [
    ^'Refused: ' , name , ' has subclasses '
      , (existing subclasses collect: [:c | c name asString]) asArray printString
      , '. Recompiling methods across a subclass hierarchy is unsupported; pass recompileMethods=false to redefine without preserving methods, or update the hierarchy manually.'].
  dict := self dictionaryForClassNamed: name requested: (args at: 'dictionary' ifAbsent: [nil]).
  dict isNil ifTrue: [^'Dictionary not found: ' , (args at: 'dictionary' ifAbsent: ['']) asString].
  poolDicts := self resolvePoolDictionaryNames: (args at: 'poolDictionaries' ifAbsent: [Array new]).
  poolDicts isNil ifTrue: [^'One or more pool dictionaries not found: '
    , (args at: 'poolDictionaries' ifAbsent: [Array new]) printString].
  opts := self symbolNamesFrom: (args at: 'options' ifAbsent: [Array new]).
  beforeDef := existing ifNotNil: [:c | c definition].
  newClass := superclass
    subclass: name
    instVarNames: (self symbolNamesFrom: (args at: 'instVarNames' ifAbsent: [Array new]))
    classVars: (self symbolNamesFrom: (args at: 'classVars' ifAbsent: [Array new]))
    classInstVars: (self symbolNamesFrom: (args at: 'classInstVars' ifAbsent: [Array new]))
    poolDictionaries: poolDicts
    inDictionary: dict
    options: opts.
  "Recorded only where something actually changed. Re-sending an identical definition answers the
   SAME class object and does not dirty the transaction at all (measured; see
   docs/blind-write-guardrail.md, S), and a write ledger entry for a write that never happened would
   manufacture a licence the stone never validated -- see McpServer>>noteWrite:."
  (existing == newClass and: [beforeDef = newClass definition])
    ifTrue: [^'Class definition unchanged: ' , newClass name asString].
  self noteWrite: (self shapeKeyFor: newClass name).
  (recompile not or: [existing isNil or: [existing == newClass]]) ifTrue: [
    ^'Compiled class: ' , newClass name asString].
  ^self recompileMethodsFrom: existing into: newClass named: name asSymbol
%
category: 'tools - mutation'
method: McpMutationToolset
tool_compile_method: args
  | cls target errs meta sel key |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      self assertMutableClass: cls.
      meta := (args at: 'meta' ifAbsent: [false]) == true.
      target := meta ifTrue: [cls class] ifFalse: [cls].
      "Which method is this? The source carries the selector, and only the compiler knows for sure,
       so ask it -- selectorOfSource:for: compiles into a throwaway dictionary, which answers the
       real selector without touching the class or dirtying the transaction. That has to happen
       BEFORE the guardrail check, because the check needs the name, and before any real compile,
       because a refused call must have no side effect."
      sel := self selectorOfSource: (args at: 'source') for: target.
      sel isNil ifTrue: [^'Compile errors: could not parse a method pattern from the source'].
      key := self methodKeyFor: cls name selector: sel meta: meta.
      "CREATION IS NEVER BLIND: a selector this class does not implement in the current view has no
       existing source to discard, so there was nothing to read. If another session created it
       concurrently, the stone's write-write check catches the collision in the ordinary way."
      (target selectors includes: sel) ifTrue: [
        self requireRead: key
          subject: (meta ifTrue: [cls name asString , ' class>>'] ifFalse: [cls name asString , '>>']) , sel asString
          tool: 'compile_method'
          hint: 'Call get_method_source(' , cls name asString , ', ' , sel asString
            , (meta ifTrue: [', meta=true'] ifFalse: ['']) , ') first.'].
      errs := target
        compileMethod: (args at: 'source')
        dictionaries: System myUserProfile symbolList
        category: (args at: 'category' ifAbsent: ['mcp']).
      "A failed compileMethod: installs nothing, so there is nothing to undo -- and an abort here
       would discard the caller's unrelated uncommitted work along with it."
      errs isNil
        ifTrue: [
          "Written -- recorded here, on the branch that actually installed a method. A failed
           compile installs nothing and must not be recorded (McpServer>>noteWrite:)."
          self noteWrite: key.
          'Compiled ' , (args at: 'className')]
        ifFalse: ['Compile errors: ' , errs printString]]
%
category: 'tools - mutation'
method: McpMutationToolset
tool_delete_class: args
  | cls arr dict |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      self assertMutableClass: cls.
      arr := System myUserProfile dictionaryAndSymbolOf: cls.
      arr isNil
        ifTrue: ['Class is not resident in a dictionary: ' , (args at: 'className')]
        ifFalse: [dict := arr at: 1.
          "Destroys the class AND every method on it, including any this session has never seen, so
           the licence required is the whole class rather than its definition."
          self requireWholeClassRead: cls tool: 'delete_class'
            because: 'deleting a class discards every one of its methods.'.
          dict removeKey: (arr at: 2).
          self noteWrite: (self shapeKeyFor: cls name).
          'Deleted class ' , (args at: 'className') , ' from ' , dict name asString]]
%
category: 'tools - mutation'
method: McpMutationToolset
tool_delete_method: args
  | cls target sel |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      self assertMutableClass: cls.
      target := ((args at: 'meta' ifAbsent: [false]) == true) ifTrue: [cls class] ifFalse: [cls].
      sel := (args at: 'selector') asSymbol.
      (target selectors includes: sel)
        ifFalse: ['Method not found: ' , (args at: 'className') , '>>' , (args at: 'selector')]
        ifTrue: [ | key meta |
          meta := ((args at: 'meta' ifAbsent: [false]) == true).
          key := self methodKeyFor: cls name selector: sel meta: meta.
          self requireRead: key
            subject: (meta ifTrue: [cls name asString , ' class>>'] ifFalse: [cls name asString , '>>']) , sel asString
            tool: 'delete_method'
            hint: 'Call get_method_source(' , cls name asString , ', ' , sel asString
              , (meta ifTrue: [', meta=true'] ifFalse: ['']) , ') first -- deleting a method you have '
              , 'not read can discard another session''s work.'.
          target removeSelector: sel.
          self noteWrite: key.
          'Deleted method ' , (args at: 'className') , '>>' , (args at: 'selector')]]
%
category: 'tools - mutation'
method: McpMutationToolset
tool_remove_dictionary: args
  | name dict up |
  name := args at: 'dictionaryName'.
  dict := self dictNamed: name.
  ^dict isNil
    ifTrue: ['Dictionary not found: ' , name]
    ifFalse: [self assertRemovableDictionaryNamed: name.
      self requireRead: (self dictionaryKeyFor: name)
        subject: 'the contents of dictionary ' , name asString
        tool: 'remove_dictionary'
        hint: 'Call list_dictionary_entries(' , name asString , ') first.'.
      up := System myUserProfile.
      up removeDictionaryAt: (up symbolList indexOf: dict).
      up symbolList do: [:d | (d at: name asSymbol ifAbsent: [nil]) == dict ifTrue: [d removeKey: name asSymbol ifAbsent: [nil]]].
      self noteWrite: (self dictionaryKeyFor: name).
      'Removed dictionary: ' , name]
%
category: 'tools - mutation'
method: McpMutationToolset
tool_set_class_comment: args
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil ifTrue: ['Class not found: ' , (args at: 'className')] ifFalse: [
    self assertMutableClass: cls.
    "Creation is never blind: a class with no comment yet has nothing to discard."
    ((cls comment ifNil: ['']) isEmpty) ifFalse: [
      self requireRead: (self commentKeyFor: cls name)
        subject: 'the class comment of ' , cls name asString
        tool: 'set_class_comment'
        hint: 'Call describe_class(' , cls name asString , ') first, which shows the current comment.'].
    cls comment: (args at: 'comment').
    self noteWrite: (self commentKeyFor: cls name).
    'Comment set on ' , cls name asString]
%
category: 'accessing'
method: McpMutationToolset
toolNames
  ^#( 'add_dictionary' 'compile_class_definition' 'compile_method' 'delete_class' 'delete_method'
      'remove_dictionary' 'set_class_comment' )
%
