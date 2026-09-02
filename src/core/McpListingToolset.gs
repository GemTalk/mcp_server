set compile_env: 0
! ------------------- Class definition for McpListingToolset
expectvalue /Class
doit
McpToolset subclass: 'McpListingToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpListingToolset comment: 
'The dictionary/class listing tools: what classes exist, in which symbol dictionaries, and what else
those dictionaries hold. All read-only-safe.'
%
expectvalue /Class
doit
McpListingToolset category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpListingToolset
removeallmethods McpListingToolset
removeallclassmethods McpListingToolset
! ------------------- Class methods for McpListingToolset
! ------------------- Instance methods for McpListingToolset
category: 'read-only'
method: McpListingToolset
readOnlySafeToolNames
  "Every listing tool only reads."
  ^self toolNames
%
category: 'registration'
method: McpListingToolset
registerOn: aToolRegistry
  | noArgs dictArg |
  noArgs := self objectSchema: Dictionary new required: #().
  dictArg := self objectSchema:
    (Dictionary new at: 'dictionaryName' put: (self propString: 'Name of the symbol dictionary'); yourself)
    required: (Array with: 'dictionaryName').
  aToolRegistry name: 'list_all_classes'
    description: 'List every class across all dictionaries in the symbol list, tagged with its dictionary.'
    inputSchema: noArgs do: [:args | self tool_list_all_classes: args].
  aToolRegistry name: 'list_classes'
    description: 'List the classes defined in a given symbol dictionary.'
    inputSchema: dictArg do: [:args | self tool_list_classes: args].
  aToolRegistry name: 'list_dictionaries'
    description: 'List the symbol dictionaries in the current symbol list, in lookup order.'
    inputSchema: noArgs do: [:args | self tool_list_dictionaries: args].
  aToolRegistry name: 'list_dictionary_entries'
    description: 'List every entry in a symbol dictionary, tagged as (class) or (global).'
    inputSchema: dictArg do: [:args | self tool_list_dictionary_entries: args].
  ^self
%
category: 'tools - listing'
method: McpListingToolset
tool_list_all_classes: args
  | names |
  names := OrderedCollection new.
  System myUserProfile symbolList do: [:d |
    d values do: [:v | (v isKindOf: Behavior) ifTrue: [names add: v name asString , '  (' , d name asString , ')']]].
  ^self linesFrom: names
%
category: 'tools - listing'
method: McpListingToolset
tool_list_classes: args
  | dict |
  dict := self dictNamed: (args at: 'dictionaryName').
  ^dict isNil
    ifTrue: ['Dictionary not found: ' , (args at: 'dictionaryName')]
    ifFalse: [self linesFrom: ((dict values select: [:v | v isKindOf: Behavior]) collect: [:c | c name asString])]
%
category: 'tools - listing'
method: McpListingToolset
tool_list_dictionaries: args
  | s |
  s := WriteStream on: String new.
  System myUserProfile symbolList do: [:d | s nextPutAll: d name asString; nextPut: Character lf].
  ^s contents
%
category: 'tools - listing'
method: McpListingToolset
tool_list_dictionary_entries: args
  | dict lines |
  dict := self dictNamed: (args at: 'dictionaryName').
  ^dict isNil
    ifTrue: ['Dictionary not found: ' , (args at: 'dictionaryName')]
    ifFalse: [
      "The ONE listing tool that registers a read. The split is per tool, not per toolset: this call
       names one dictionary and shows what is in it, which is what remove_dictionary destroys.
       list_classes names a dictionary too but shows only the classes in it -- a partial view, and
       not enough to license destroying the whole thing."
      self noteRead: (self dictionaryKeyFor: (args at: 'dictionaryName')).
      lines := OrderedCollection new.
      dict keysAndValuesDo: [:k :v |
        lines add: k asString , ((v isKindOf: Behavior) ifTrue: ['  (class)'] ifFalse: ['  (global)'])].
      self linesFrom: lines]
%
category: 'accessing'
method: McpListingToolset
toolNames
  ^#( 'list_all_classes' 'list_classes' 'list_dictionaries' 'list_dictionary_entries' )
%
