set compile_env: 0
! ------------------- Class definition for McpSearchToolset
expectvalue /Class
doit
McpToolset subclass: 'McpSearchToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpSearchToolset comment: 
'The code-search tools: implementors of a selector, senders of a selector, references to a global,
and a substring search over method source. All read-only-safe.'
%
expectvalue /Class
doit
McpSearchToolset category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpSearchToolset
removeallmethods McpSearchToolset
removeallclassmethods McpSearchToolset
! ------------------- Class methods for McpSearchToolset
! ------------------- Instance methods for McpSearchToolset
category: 'private'
method: McpSearchToolset
flattenMethods: aCollection
  "Flatten into a flat OrderedCollection of GsNMethod. Accepts a flat collection of GsNMethod
   (implementorsOf:/referencesToObject:) or a nested collection of collections (sendersOf:)."
  | methods |
  methods := OrderedCollection new.
  aCollection do: [:e |
    (e isKindOf: GsNMethod)
      ifTrue: [methods add: e]
      ifFalse: [(e isKindOf: Collection) ifTrue: [
        e do: [:m | (m isKindOf: GsNMethod) ifTrue: [methods add: m]]]]].
  ^methods
%
category: 'private'
method: McpSearchToolset
formatMethodList: aCollection
  "Format GsNMethods as readable lines: Class>>selector  [category]. Accepts flat or nested
   collections of GsNMethod (see flattenMethods:)."
  | methods s |
  methods := self flattenMethods: aCollection.
  methods isEmpty ifTrue: [^'(none)'].
  s := WriteStream on: String new.
  methods do: [:m | | cat |
    cat := [m inClass categoryOfSelector: m selector] on: Error do: [:e | nil].
    s nextPutAll: m inClass name asString; nextPutAll: '>>'; nextPutAll: m selector asString.
    cat ifNotNil: [s nextPutAll: '  ['; nextPutAll: cat asString; nextPutAll: ']'].
    s nextPut: Character lf].
  ^s contents
%
category: 'read-only'
method: McpSearchToolset
readOnlySafeToolNames
  "Every search tool only reads."
  ^self toolNames
%
category: 'registration'
method: McpSearchToolset
registerOn: aToolRegistry
  | selectorArg |
  selectorArg := self objectSchema:
    (Dictionary new at: 'selector' put: (self propString: 'Method selector to search for'); yourself)
    required: (Array with: 'selector').
  aToolRegistry name: 'find_implementors'
    description: 'Find all methods that implement a given selector.'
    inputSchema: selectorArg do: [:args | self tool_find_implementors: args].
  aToolRegistry name: 'find_references_to'
    description: 'Find all methods that reference a named global (e.g. a class or shared variable).'
    inputSchema: (self objectSchema:
      (Dictionary new at: 'name' put: (self propString: 'Name of the global / class to find references to'); yourself)
      required: (Array with: 'name'))
    do: [:args | self tool_find_references_to: args].
  aToolRegistry name: 'find_senders'
    description: 'Find all methods that send a given selector. Capped at 200 results (senders of a common selector can number in the thousands).'
    inputSchema: selectorArg do: [:args | self tool_find_senders: args].
  aToolRegistry name: 'search_method_source'
    description: 'Search method source code for a substring. Optionally scope to one dictionary (recommended; searching all dictionaries scans the kernel and can be slow). Capped at 200 hits.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'pattern' put: (self propString: 'Substring to search for in method source (case-sensitive)');
        at: 'dictionaryName' put: (self propString: 'Optional: limit the search to this dictionary');
        yourself)
      required: (Array with: 'pattern'))
    do: [:args | self tool_search_method_source: args].
  ^self
%
category: 'tools - search'
method: McpSearchToolset
tool_find_implementors: args
  ^self formatMethodList: (ClassOrganizer new implementorsOf: (args at: 'selector') asSymbol)
%
category: 'tools - search'
method: McpSearchToolset
tool_find_references_to: args
  | obj |
  obj := System myUserProfile objectNamed: (args at: 'name') asSymbol.
  ^obj isNil
    ifTrue: ['Global not found: ' , (args at: 'name')]
    ifFalse: [self formatMethodList: (ClassOrganizer new referencesToObject: obj)]
%
category: 'tools - search'
method: McpSearchToolset
tool_find_senders: args
  "Senders of a common selector can number in the thousands, so cap the output. Unlike
   search_method_source (which stops scanning at the cap and can't know the total), sendersOf:
   returns the full set first, so we can report the true total in the truncation note."
  | cap flat total |
  cap := 200.
  flat := self flattenMethods: (ClassOrganizer new sendersOf: (args at: 'selector') asSymbol).
  total := flat size.
  total > cap ifTrue: [flat := flat copyFrom: 1 to: cap].
  ^(total > cap
      ifTrue: ['(showing first ' , cap printString , ' of ' , total printString , ')' , (String with: Character lf)]
      ifFalse: [''])
    , (self formatMethodList: flat)
%
category: 'tools - search'
method: McpSearchToolset
tool_search_method_source: args
  | pattern cap hits dicts |
  pattern := args at: 'pattern'.
  cap := 200.
  hits := OrderedCollection new.
  dicts := (args at: 'dictionaryName' ifAbsent: [nil])
    ifNil: [System myUserProfile symbolList asArray]
    ifNotNil: [:dname | | d | d := self dictNamed: dname. d isNil ifTrue: [#()] ifFalse: [Array with: d]].
  dicts do: [:dict | dict values do: [:v | (v isKindOf: Behavior) ifTrue: [
    (Array with: v with: v class) do: [:beh | beh selectors do: [:sel |
      hits size < cap ifTrue: [ | src |
        src := [beh sourceCodeAt: sel] on: Error do: [:e | nil].
        (src notNil and: [src includesString: pattern]) ifTrue: [
          hits add: beh name asString , '>>' , sel asString]]]]]]].
  ^(hits size >= cap ifTrue: ['(truncated at ' , cap printString , ' hits)' , (String with: Character lf)] ifFalse: [''])
    , (self linesFrom: hits)
%
category: 'accessing'
method: McpSearchToolset
toolNames
  ^#( 'find_implementors' 'find_references_to' 'find_senders' 'search_method_source' )
%
