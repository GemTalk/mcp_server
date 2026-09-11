set compile_env: 0
! ------------------- Class definition for McpListingToolset
expectvalue /Class
doit
McpToolset subclass: 'McpListingToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Mcp
  options: #()

%
expectvalue /Class
doit
McpListingToolset comment: 
'The dictionary/class listing tools: what classes exist, in which symbol dictionaries, and what else
those dictionaries hold. Nothing here persists a change.

Every tool here but list_dictionaries takes limit/offset and answers sorted, so a client that finds
an answer too long has a way to walk it -- see McpToolset>>page:args:defaultLimit:. None of them
defaults to a limit; registerOn: says why.'
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
category: 'registration'
method: McpListingToolset
registerOn: aToolRegistry
  "Three of the four page (limit/offset), and none of them defaults to a limit: a listing an agent
   reads to FIND a name is worse truncated than long, because the name it wants is as likely to be
   in the tail as the head and a first page gives no way to tell. So the default is every result,
   as before, and limit/offset are there for the client that decides the answer was too big --
   which is the client that knows.

   list_dictionaries is deliberately unpaged: it answers the symbol list, which is a handful of
   entries by construction, and a schema that advertises paging a handler ignores is worse than no
   paging at all."
  | dictProps entryProps |
  dictProps := Dictionary new at: 'dictionaryName' put: (self propString: 'Name of the symbol dictionary'); yourself.
  entryProps := Dictionary new at: 'dictionaryName' put: (self propString: 'Name of the symbol dictionary'); yourself.
  aToolRegistry name: 'list_all_classes'
    description: 'List every class across all dictionaries in the symbol list, tagged with its dictionary. Sorted; pages with limit/offset.'
    inputSchema: (self pagedSchema: Dictionary new required: #() defaultLimit: nil)
    do: [:args | self tool_list_all_classes: args].
  aToolRegistry name: 'list_classes'
    description: 'List the classes defined in a given symbol dictionary. Sorted; pages with limit/offset.'
    inputSchema: (self pagedSchema: dictProps required: (Array with: 'dictionaryName') defaultLimit: nil)
    do: [:args | self tool_list_classes: args].
  aToolRegistry name: 'list_dictionaries'
    description: 'List the symbol dictionaries in the current symbol list, in lookup order.'
    inputSchema: (self objectSchema: Dictionary new required: #())
    do: [:args | self tool_list_dictionaries: args].
  aToolRegistry name: 'list_dictionary_entries'
    description: 'List every entry in a symbol dictionary, tagged as (class) or (global). Sorted; pages with limit/offset.'
    inputSchema: (self pagedSchema: entryProps required: (Array with: 'dictionaryName') defaultLimit: nil)
    do: [:args | self tool_list_dictionary_entries: args].
  ^self
%
category: 'tools - listing'
method: McpListingToolset
tool_list_all_classes: args
  | names |
  names := OrderedCollection new.
  System myUserProfile symbolList do: [:d |
    d values do: [:v | (v isKindOf: Behavior) ifTrue: [names add: v name asString , '  (' , d name asString , ')']]].
  "Sorted BEFORE paging, not by the renderer afterwards: an offset into an order that is recomputed
   per call is not a position in anything. The sort is what makes page 2 the page after page 1."
  ^self page: names asSortedCollection asArray args: args defaultLimit: nil
%
category: 'tools - listing'
method: McpListingToolset
tool_list_classes: args
  | dict |
  dict := self dictNamed: (args at: 'dictionaryName').
  ^dict isNil
    ifTrue: ['Dictionary not found: ' , (args at: 'dictionaryName')]
    ifFalse: [self
      page: ((dict values select: [:v | v isKindOf: Behavior]) collect: [:c | c name asString])
        asSortedCollection asArray
      args: args
      defaultLimit: nil]
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
      self page: lines asSortedCollection asArray args: args defaultLimit: nil]
%
category: 'accessing'
method: McpListingToolset
toolNames
  ^#( 'list_all_classes' 'list_classes' 'list_dictionaries' 'list_dictionary_entries' )
%
