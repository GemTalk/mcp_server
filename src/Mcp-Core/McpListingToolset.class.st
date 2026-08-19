"
The dictionary/class listing tools: what classes exist, in which symbol dictionaries, and what else
those dictionaries hold. All read-only-safe.

Handlers still live on McpServer (category 'tools - listing'); see McpToolset's class comment on that
transitional seam.
"
Class {
	#name : 'McpListingToolset',
	#superclass : 'McpToolset',
	#category : 'Mcp-Core'
}

{ #category : 'read-only' }
McpListingToolset >> readOnlySafeToolNames [
  "Every listing tool only reads."
  ^self toolNames

]

{ #category : 'registration' }
McpListingToolset >> registerOn: aToolRegistry [
  | noArgs dictArg |
  noArgs := self objectSchema: Dictionary new required: #().
  dictArg := self objectSchema:
    (Dictionary new at: 'dictionaryName' put: (self propString: 'Name of the symbol dictionary'); yourself)
    required: (Array with: 'dictionaryName').
  aToolRegistry name: 'list_all_classes'
    description: 'List every class across all dictionaries in the symbol list, tagged with its dictionary.'
    inputSchema: noArgs do: [:args | server tool_list_all_classes: args].
  aToolRegistry name: 'list_classes'
    description: 'List the classes defined in a given symbol dictionary.'
    inputSchema: dictArg do: [:args | server tool_list_classes: args].
  aToolRegistry name: 'list_dictionaries'
    description: 'List the symbol dictionaries in the current symbol list, in lookup order.'
    inputSchema: noArgs do: [:args | server tool_list_dictionaries: args].
  aToolRegistry name: 'list_dictionary_entries'
    description: 'List every entry in a symbol dictionary, tagged as (class) or (global).'
    inputSchema: dictArg do: [:args | server tool_list_dictionary_entries: args].
  ^self

]

{ #category : 'accessing' }
McpListingToolset >> toolNames [
  ^#( 'list_all_classes' 'list_classes' 'list_dictionaries' 'list_dictionary_entries' )

]
