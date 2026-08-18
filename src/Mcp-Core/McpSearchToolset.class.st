"
The code-search tools: implementors of a selector, senders of a selector, references to a global,
and a substring search over method source. All read-only-safe.

Handlers still live on McpServer (category 'tools - search'); see McpToolset's class comment on that
transitional seam.
"
Class {
	#name : 'McpSearchToolset',
	#superclass : 'McpToolset',
	#category : 'Mcp-Core'
}

{ #category : 'read-only' }
McpSearchToolset >> readOnlySafeToolNames [
  "Every search tool only reads."
  ^self toolNames

]

{ #category : 'registration' }
McpSearchToolset >> registerOn: aToolRegistry [
  | selectorArg |
  selectorArg := self objectSchema:
    (Dictionary new at: 'selector' put: (self propString: 'Method selector to search for'); yourself)
    required: (Array with: 'selector').
  aToolRegistry name: 'find_implementors'
    description: 'Find all methods that implement a given selector.'
    inputSchema: selectorArg do: [:args | server tool_find_implementors: args].
  aToolRegistry name: 'find_references_to'
    description: 'Find all methods that reference a named global (e.g. a class or shared variable).'
    inputSchema: (self objectSchema:
      (Dictionary new at: 'name' put: (self propString: 'Name of the global / class to find references to'); yourself)
      required: (Array with: 'name'))
    do: [:args | server tool_find_references_to: args].
  aToolRegistry name: 'find_senders'
    description: 'Find all methods that send a given selector. Capped at 200 results (senders of a common selector can number in the thousands).'
    inputSchema: selectorArg do: [:args | server tool_find_senders: args].
  aToolRegistry name: 'search_method_source'
    description: 'Search method source code for a substring. Optionally scope to one dictionary (recommended; searching all dictionaries scans the kernel and can be slow). Capped at 200 hits.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'pattern' put: (self propString: 'Substring to search for in method source (case-sensitive)');
        at: 'dictionaryName' put: (self propString: 'Optional: limit the search to this dictionary');
        yourself)
      required: (Array with: 'pattern'))
    do: [:args | server tool_search_method_source: args].
  ^self

]

{ #category : 'accessing' }
McpSearchToolset >> toolNames [
  ^#( 'find_implementors' 'find_references_to' 'find_senders' 'search_method_source' )

]
