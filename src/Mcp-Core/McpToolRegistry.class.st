"
Holds the set of McpTool instances keyed by tool name. Produces the descriptor
list for MCP tools/list and looks up tools for tools/call.
"
Class {
	#name : 'McpToolRegistry',
	#superclass : 'Object',
	#instVars : [
		'tools'
	],
	#category : 'Mcp-Core'
}

{ #category : 'instance creation' }
McpToolRegistry class >> new [
  ^super new initialize

]

{ #category : 'accessing' }
McpToolRegistry >> at: aName [
  "Return the tool registered under aName, or nil."
  ^tools at: aName ifAbsent: [nil]

]

{ #category : 'accessing' }
McpToolRegistry >> descriptors [
  "An Array of MCP tool descriptors for tools/list, sorted alphabetically by tool name."
  ^(tools keys asSortedCollection asArray) collect: [:toolName | (tools at: toolName) descriptor]

]

{ #category : 'initialization' }
McpToolRegistry >> initialize [
  tools := Dictionary new

]

{ #category : 'registration' }
McpToolRegistry >> name: aName description: aDescription inputSchema: aSchema do: aBlock [
  "Convenience: build and register a tool in one line."
  ^self register:
    (McpTool name: aName description: aDescription inputSchema: aSchema handler: aBlock)

]

{ #category : 'registration' }
McpToolRegistry >> register: aTool [
  tools at: aTool name put: aTool.
  ^aTool

]

{ #category : 'registration' }
McpToolRegistry >> removeToolNamed: aName [
  "Unregister aName if present (no-op if not). Used when building a read-only worker, to keep a
   toolset's unsafe tools out of the registry entirely -- see McpServer>>registerToolsets."
  ^tools removeKey: aName ifAbsent: [nil]

]
