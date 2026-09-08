set compile_env: 0
! ------------------- Class definition for McpSearchToolset
expectvalue /Class
doit
McpToolset subclass: 'McpSearchToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Mcp
  options: #()

%
expectvalue /Class
doit
McpSearchToolset comment: 
'The code-search tools: implementors of a selector, senders of a selector, references to a global,
and a substring search over method source. All read-only-safe.

All four page with limit/offset (McpToolset>>page:args:defaultLimit:). Three of them materialise
every hit before answering and so report a true total; search_method_source stops scanning at the
page it was asked for and says the total is unknown, which is the honest answer for a scan that is
itself the expensive part. Their handlers say why.'
%
expectvalue /Class
doit
McpSearchToolset category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpSearchToolset
removeallmethods McpSearchToolset
removeallclassmethods McpSearchToolset
! ------------------- Class methods for McpSearchToolset
category: 'constants'
classmethod: McpSearchToolset
defaultSearchLimit
  "How many hits find_senders and search_method_source answer when the client names no limit. 200,
   which is what both tools capped at before they paged -- so the default answer is the one they
   always gave, and the change is that there is now a way to ask for the rest.
   Read in TWO places per tool, the schema and the handler, and it must be the same number in both:
   the schema's description tells the client what it will get and the handler is what delivers it."
  ^200
%
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
methodLines: aCollection
  "GsNMethods as readable lines: Class>>selector  [category], one String each. Accepts flat or
   nested collections of GsNMethod (see flattenMethods:).
   Answers the LINES rather than the joined text, because paging happens between the two: the
   handlers hand this to McpToolset>>page:args:defaultLimit:, which slices and joins. It replaced
   #formatMethodList:, which did both and so left nothing to page.
   The order is the organizer's, deliberately unsorted: it is deterministic within a session's
   view, which is what an offset needs, and sorting a list this long costs more than it reads."
  | methods |
  methods := self flattenMethods: aCollection.
  ^methods collect: [:m | | cat line |
    cat := [m inClass categoryOfSelector: m selector] on: Error do: [:e | nil].
    line := m inClass name asString , '>>' , m selector asString.
    cat isNil ifTrue: [line] ifFalse: [line , '  [' , cat asString , ']']]
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
  "All four page. Where a tool already had a hard cap, that cap becomes its DEFAULT LIMIT rather
   than a ceiling -- so the same call answers what it always did, and a client that wants the rest
   now has an offset to pass instead of a dead end. Where there was no cap (find_implementors,
   find_references_to) there is still no default limit; see McpListingToolset>>registerOn: for why
   a search an agent reads to find something is not truncated by default."
  | selectorProps sendersProps nameProps sourceProps |
  selectorProps := Dictionary new at: 'selector' put: (self propString: 'Method selector to search for'); yourself.
  sendersProps := Dictionary new at: 'selector' put: (self propString: 'Method selector to search for'); yourself.
  nameProps := Dictionary new at: 'name' put: (self propString: 'Name of the global / class to find references to'); yourself.
  sourceProps := Dictionary new
    at: 'pattern' put: (self propString: 'Substring to search for in method source (case-sensitive)');
    at: 'dictionaryName' put: (self propString: 'Optional: limit the search to this dictionary');
    yourself.
  aToolRegistry name: 'find_implementors'
    description: 'Find all methods that implement a given selector. Pages with limit/offset.'
    inputSchema: (self pagedSchema: selectorProps required: (Array with: 'selector') defaultLimit: nil)
    do: [:args | self tool_find_implementors: args].
  aToolRegistry name: 'find_references_to'
    description: 'Find all methods that reference a named global (e.g. a class or shared variable). Pages with limit/offset.'
    inputSchema: (self pagedSchema: nameProps required: (Array with: 'name') defaultLimit: nil)
    do: [:args | self tool_find_references_to: args].
  aToolRegistry name: 'find_senders'
    description: 'Find all methods that send a given selector. Answers 200 at a time by default (senders of a common selector can number in the thousands), with the true total; pass offset for the next page, or a larger limit.'
    inputSchema: (self pagedSchema: sendersProps required: (Array with: 'selector') defaultLimit: self class defaultSearchLimit)
    do: [:args | self tool_find_senders: args].
  aToolRegistry name: 'search_method_source'
    description: 'Search method source code for a substring. Optionally scope to one dictionary (recommended; searching all dictionaries scans the kernel and can be slow). Answers 200 hits at a time in scan order; pass offset for the next page.'
    inputSchema: (self pagedSchema: sourceProps required: (Array with: 'pattern') defaultLimit: self class defaultSearchLimit)
    do: [:args | self tool_search_method_source: args].
  ^self
%
category: 'tools - search'
method: McpSearchToolset
tool_find_implementors: args
  ^self page: (self methodLines: (ClassOrganizer new implementorsOf: (args at: 'selector') asSymbol))
    args: args
    defaultLimit: nil
%
category: 'tools - search'
method: McpSearchToolset
tool_find_references_to: args
  | obj |
  obj := System myUserProfile objectNamed: (args at: 'name') asSymbol.
  ^obj isNil
    ifTrue: ['Global not found: ' , (args at: 'name')]
    ifFalse: [self page: (self methodLines: (ClassOrganizer new referencesToObject: obj))
                args: args
                defaultLimit: nil]
%
category: 'tools - search'
method: McpSearchToolset
tool_find_senders: args
  "Senders of a common selector can number in the thousands, so this is the one search that limits
   itself by default. sendersOf: answers the whole set before anything is formatted, so the total
   the header reports is the true one and the page is a real position in it -- the reason this can
   pass complete: (implicitly) where search_method_source below cannot."
  ^self page: (self methodLines: (ClassOrganizer new sendersOf: (args at: 'selector') asSymbol))
    args: args
    defaultLimit: self class defaultSearchLimit
%
category: 'tools - search'
method: McpSearchToolset
tool_search_method_source: args
  "THE SCAN IS THE COST, so it stops one hit past the page the client asked for and says the total
   is unknown, rather than scanning every method in the image to be able to print a number. Reading
   the source of every method in every dictionary of the symbol list is what makes an unscoped
   search slow, and it is exactly the work a true total would require on every call.

   Hits come back in SCAN ORDER, not sorted, and that is what makes the offset mean anything: the
   scan visits the same methods in the same order for a given view, so hit N is hit N on the next
   call. Sorting -- which this did before it paged -- sorts only what was collected, so page 2 of a
   sorted prefix could hold names that belonged on page 1. An answer whose pages overlap is worse
   than an unsorted one."
  | pattern budget hits dicts |
  pattern := args at: 'pattern'.
  budget := (self integerArg: args named: 'offset' default: 0)
    + (self integerArg: args named: 'limit' default: self class defaultSearchLimit) + 1.
  hits := OrderedCollection new.
  dicts := (args at: 'dictionaryName' ifAbsent: [nil])
    ifNil: [System myUserProfile symbolList asArray]
    ifNotNil: [:dname | | d | d := self dictNamed: dname. d isNil ifTrue: [#()] ifFalse: [Array with: d]].
  dicts do: [:dict | dict values do: [:v | (v isKindOf: Behavior) ifTrue: [
    (Array with: v with: v class) do: [:beh | beh selectors do: [:sel |
      hits size < budget ifTrue: [ | src |
        src := [beh sourceCodeAt: sel] on: Error do: [:e | nil].
        (src notNil and: [src includesString: pattern]) ifTrue: [
          hits add: beh name asString , '>>' , sel asString]]]]]]].
  ^self page: hits
    args: args
    defaultLimit: self class defaultSearchLimit
    complete: hits size < budget
%
category: 'accessing'
method: McpSearchToolset
toolNames
  ^#( 'find_implementors' 'find_references_to' 'find_senders' 'search_method_source' )
%
