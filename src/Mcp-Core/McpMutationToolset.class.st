"
The tools that change the image and commit: define/redefine a class, compile or delete a method,
set a class comment, add or remove a symbol dictionary.

NONE are read-only-safe (readOnlySafeToolNames is inherited, i.e. empty), so a read-only session
drops this toolset whole. Every handler additionally asks the SERVER for its kernel guard
(server assertMutableClass: / assertRemovableDictionaryNamed:), so even a read-write session cannot
modify a protected class. That guard deliberately stays on McpServer rather than moving here with the
handlers: what counts as protected is server-level policy, and overriding it is exactly what
subclassing McpServer is for.
"
Class {
	#name : 'McpMutationToolset',
	#superclass : 'McpToolset',
	#category : 'Mcp-Core'
}

{ #category : 'private' }
McpMutationToolset >> classNameFromDefinition: source [
  "The class name in a 'Super subclass: ''Name'' ...' definition: the substring between the
   first two single quotes, as a Symbol. Returns nil if the source has no quoted literal
   (e.g. a symbol-form name) -- callers then treat it as a plain redefine."
  | q1 q2 |
  q1 := source indexOf: $' ifAbsent: [^nil].
  q2 := source indexOf: $' startingAt: q1 + 1 ifAbsent: [^nil].
  ^(source copyFrom: q1 + 1 to: q2 - 1) asSymbol

]

{ #category : 'private' }
McpMutationToolset >> recompileMethodsFrom: oldClass into: newClass named: classNameSymbol [
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
  System commitTransaction.
  classNameString := classNameSymbol asString.
  s := WriteStream on: String new.
  s nextPutAll: 'Redefined ' , classNameString , '; recompiled ' , (total - failures size) printString
    , '/' , total printString , ' methods'.
  failures isEmpty
    ifTrue: [s nextPutAll: '; all recompiled. Committed.']
    ifFalse: [s nextPutAll: '; ' , failures size printString , ' failed (committed anyway):'; nextPut: Character lf.
      failures do: [:f |
        s nextPutAll: '  ' , (f at: 1) , ' ' , classNameString , '>>' , (f at: 2) asString , ' - ' , (f at: 3) printString;
          nextPut: Character lf]].
  ^s contents

]

{ #category : 'registration' }
McpMutationToolset >> registerOn: aToolRegistry [
  | classArg dictArg |
  classArg := self objectSchema:
    (Dictionary new at: 'className' put: (self propString: 'Name of the class'); yourself)
    required: (Array with: 'className').
  dictArg := self objectSchema:
    (Dictionary new at: 'dictionaryName' put: (self propString: 'Name of the symbol dictionary'); yourself)
    required: (Array with: 'dictionaryName').
  aToolRegistry name: 'add_dictionary'
    description: 'Create a new symbol dictionary, append it to the user symbol list, and commit.'
    inputSchema: dictArg do: [:args | self tool_add_dictionary: args].
  aToolRegistry name: 'compile_class_definition'
    description: 'Evaluate a class-definition expression (e.g. Object subclass: ... inDictionary: ...), then commit. The source must evaluate to a class; other expressions are rejected (use execute_code for those). On a shape-changing redefinition of an existing class, by default recompiles its existing methods onto the new version (a raw redefine drops them) and reports any that fail; refused if the class has subclasses.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'source' put: (self propString: 'Full class-definition Smalltalk expression including the subclass: send and inDictionary:');
        at: 'recompileMethods' put: (self boolProperty: 'Default true: after a shape change, recompile the class existing methods onto the new version and report failures (refused if the class has subclasses). False: redefine raw, dropping all methods.');
        yourself)
      required: (Array with: 'source'))
    do: [:args | self tool_compile_class_definition: args].
  aToolRegistry name: 'compile_method'
    description: 'Compile (add or update) a method on a class, then commit. Set meta=true for class-side. Category defaults to "mcp".'
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
    description: 'Remove a class from its dictionary and commit. Destructive.'
    inputSchema: classArg do: [:args | self tool_delete_class: args].
  aToolRegistry name: 'delete_method'
    description: 'Remove a method from a class and commit. Set meta=true for the class-side method. Destructive.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'className' put: (self propString: 'Name of the class');
        at: 'selector' put: (self propString: 'Selector of the method to remove');
        at: 'meta' put: (self boolProperty: 'true for the class-side method (default false)');
        yourself)
      required: (Array with: 'className' with: 'selector'))
    do: [:args | self tool_delete_method: args].
  aToolRegistry name: 'remove_dictionary'
    description: 'Remove a symbol dictionary from the user symbol list and commit. Destructive.'
    inputSchema: dictArg do: [:args | self tool_remove_dictionary: args].
  aToolRegistry name: 'set_class_comment'
    description: 'Set (replace) the class comment and commit.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'className' put: (self propString: 'Name of the class');
        at: 'comment' put: (self propString: 'New comment text');
        yourself)
      required: (Array with: 'className' with: 'comment'))
    do: [:args | self tool_set_class_comment: args].
  ^self

]

{ #category : 'tools - mutation' }
McpMutationToolset >> tool_add_dictionary: args [
  | name up d |
  name := args at: 'dictionaryName'.
  ^(self dictNamed: name) notNil
    ifTrue: ['Dictionary already exists: ' , name]
    ifFalse: [up := System myUserProfile.
      d := up createDictionary: name asSymbol.
      up insertDictionary: d at: up symbolList size + 1.
      System commitTransaction.
      'Created dictionary: ' , name]

]

{ #category : 'tools - mutation' }
McpMutationToolset >> tool_compile_class_definition: args [
  "Evaluate a class-definition expression and commit. If recompileMethods is true (default)
   and this is a shape-changing redefinition of an existing class (which would otherwise drop
   all its methods), recompile the prior version's methods onto the new version and report any
   that fail. Refused when the class has subclasses (handle the hierarchy manually, or pass
   recompileMethods=false to redefine raw)."
  | source recompile name existing oldClass newClass |
  source := args at: 'source'.
  recompile := (args at: 'recompileMethods' ifAbsent: [true]) ~~ false.
  name := self classNameFromDefinition: source.
  existing := name notNil ifTrue: [self resolveClass: name] ifFalse: [nil].
  existing ifNotNil: [:c | server assertMutableClass: c].  "refuse redefining a kernel class (any recompile setting)"
  oldClass := recompile ifTrue: [existing] ifFalse: [nil].
  (recompile and: [oldClass notNil and: [oldClass subclasses isEmpty not]]) ifTrue: [
    ^'Refused: ' , name asString , ' has subclasses '
      , (oldClass subclasses collect: [:c | c name asString]) asArray printString
      , '. Recompiling methods across a subclass hierarchy is unsupported; pass recompileMethods=false to redefine without preserving methods, or update the hierarchy manually.'].
  newClass := source evaluate.
  (newClass isKindOf: Behavior) ifFalse: [
    System abortTransaction.
    ^'Source did not evaluate to a class (got ' , newClass class name asString
      , '). Use execute_code to evaluate arbitrary expressions.'].
  (recompile not or: [oldClass isNil or: [oldClass == newClass]]) ifTrue: [
    System commitTransaction.
    ^'Compiled and committed class: ' , newClass name asString].
  ^self recompileMethodsFrom: oldClass into: newClass named: name

]

{ #category : 'tools - mutation' }
McpMutationToolset >> tool_compile_method: args [
  | cls target errs |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      server assertMutableClass: cls.
      target := ((args at: 'meta' ifAbsent: [false]) == true) ifTrue: [cls class] ifFalse: [cls].
      errs := target
        compileMethod: (args at: 'source')
        dictionaries: System myUserProfile symbolList
        category: (args at: 'category' ifAbsent: ['mcp']).
      errs isNil
        ifTrue: [System commitTransaction. 'Compiled ' , (args at: 'className') , ' and committed.']
        ifFalse: [System abortTransaction. 'Compile errors: ' , errs printString]]

]

{ #category : 'tools - mutation' }
McpMutationToolset >> tool_delete_class: args [
  | cls arr dict |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      server assertMutableClass: cls.
      arr := System myUserProfile dictionaryAndSymbolOf: cls.
      arr isNil
        ifTrue: ['Class is not resident in a dictionary: ' , (args at: 'className')]
        ifFalse: [dict := arr at: 1.
          dict removeKey: (arr at: 2).
          System commitTransaction.
          'Deleted class ' , (args at: 'className') , ' from ' , dict name asString , ' and committed.']]

]

{ #category : 'tools - mutation' }
McpMutationToolset >> tool_delete_method: args [
  | cls target sel |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      server assertMutableClass: cls.
      target := ((args at: 'meta' ifAbsent: [false]) == true) ifTrue: [cls class] ifFalse: [cls].
      sel := (args at: 'selector') asSymbol.
      (target selectors includes: sel)
        ifFalse: ['Method not found: ' , (args at: 'className') , '>>' , (args at: 'selector')]
        ifTrue: [target removeSelector: sel.
          System commitTransaction.
          'Deleted method ' , (args at: 'className') , '>>' , (args at: 'selector') , ' and committed.']]

]

{ #category : 'tools - mutation' }
McpMutationToolset >> tool_remove_dictionary: args [
  | name dict up |
  name := args at: 'dictionaryName'.
  dict := self dictNamed: name.
  ^dict isNil
    ifTrue: ['Dictionary not found: ' , name]
    ifFalse: [server assertRemovableDictionaryNamed: name.
      up := System myUserProfile.
      up removeDictionaryAt: (up symbolList indexOf: dict).
      up symbolList do: [:d | (d at: name asSymbol ifAbsent: [nil]) == dict ifTrue: [d removeKey: name asSymbol ifAbsent: [nil]]].
      System commitTransaction.
      'Removed dictionary: ' , name]

]

{ #category : 'tools - mutation' }
McpMutationToolset >> tool_set_class_comment: args [
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil ifTrue: ['Class not found: ' , (args at: 'className')] ifFalse: [
    server assertMutableClass: cls.
    cls comment: (args at: 'comment').
    System commitTransaction.
    'Comment set on ' , cls name asString , ' and committed.']

]

{ #category : 'accessing' }
McpMutationToolset >> toolNames [
  ^#( 'add_dictionary' 'compile_class_definition' 'compile_method' 'delete_class' 'delete_method'
      'remove_dictionary' 'set_class_comment' )

]
