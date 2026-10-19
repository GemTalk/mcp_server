"
A third-party toolset, in miniature: one tool (fixture_echo) that the extension tests use to prove a
developer can add tools without touching McpServer and combine them with the core toolsets.

Written the way a real third-party toolset should be: it owns its handler and needs nothing from the
server (echoing a string consults no server-level policy -- see McpToolset).

It also declares one DEPLOYMENT OPTION, echoPrefix, which is how the extension tests exercise the
whole options chain end to end -- declared here, set on the router, validated against this
declaration, serialized into the fork string, parsed in the worker, and read by the handler. A real
vendor toolset's option would name a directory or a host; a prefix is the smallest thing that makes
the same journey and is observable in a tool result.
"
Class {
	#name : 'McpFixtureToolset',
	#superclass : 'McpToolset',
	#category : 'Mcp-Tests'
}

{ #category : 'options' }
McpFixtureToolset class >> declaredOptionNames [
  "echoPrefix -- what tool_fixture_echo: puts in front of the text. See the class comment."
  ^#( 'echoPrefix' )

]

{ #category : 'registration' }
McpFixtureToolset >> registerOn: aToolRegistry [
  aToolRegistry name: 'fixture_echo'
    description: 'Test fixture: answer the supplied text, prefixed. Proves a third-party toolset can register a tool.'
    inputSchema: (self objectSchema:
      (Dictionary new at: 'text' put: (self propString: 'Text to echo back'); yourself)
      required: (Array with: 'text'))
    do: [:args | self tool_fixture_echo: args].
  ^self

]

{ #category : 'tools - fixture' }
McpFixtureToolset >> tool_fixture_echo: args [
  "The prefix comes from this deployment's echoPrefix option, defaulting to what this tool always
   answered -- so an unconfigured toolset behaves exactly as it did before options existed, which is
   the property every existing test here is still asserting."
  ^(self optionNamed: 'echoPrefix' ifAbsent: ['echo: ']) , (args at: 'text')

]

{ #category : 'accessing' }
McpFixtureToolset >> toolNames [
  ^#( 'fixture_echo' )

]
