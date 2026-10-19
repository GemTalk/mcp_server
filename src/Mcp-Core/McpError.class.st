"
An error raised by the MCP server that carries a short, machine-readable `kind` Symbol (e.g.
#refused, #notFound) in addition to a human message. McpDispatcher classifies caught errors into a
kind and surfaces it in the tools/call error envelope (structuredContent), so an agent can branch on
the kind rather than parsing prose. Raise via `McpError signalKind: #someKind message: '...'`.
"
Class {
	#name : 'McpError',
	#superclass : 'Error',
	#instVars : [
		'kind'
	],
	#category : 'Mcp-Core'
}

{ #category : 'signaling' }
McpError class >> signalKind: aKindSymbol message: aString [
  "Raise an McpError tagged with aKindSymbol (the machine-readable class of the error) and the
   human-readable aString as its message."
  ^(self new setKind: aKindSymbol) signal: aString

]

{ #category : 'accessing' }
McpError >> description [
  "Prefer the human message we were signalled with (McpDispatcher reads `description`)."
  ^self messageText ifNil: ['MCP error']

]

{ #category : 'accessing' }
McpError >> kind [
  "A short Symbol classifying this error for programmatic branching (defaults to #other)."
  ^kind ifNil: [#other]

]

{ #category : 'private' }
McpError >> setKind: aKindSymbol [
  kind := aKindSymbol.
  ^self

]
