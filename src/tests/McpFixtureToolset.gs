set compile_env: 0
! ------------------- Class definition for McpFixtureToolset
expectvalue /Class
doit
McpToolset subclass: 'McpFixtureToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Mcp
  options: #()

%
expectvalue /Class
doit
McpFixtureToolset comment: 
'A third-party toolset, in miniature: one tool (fixture_echo) that the extension tests use to prove a
developer can add tools without touching McpServer and combine them with the core toolsets.

Written the way a real third-party toolset should be: it owns its handler and needs nothing from the
server (echoing a string consults no server-level policy -- see McpToolset).

It also declares one DEPLOYMENT OPTION, echoPrefix, which is how the extension tests exercise the
whole options chain end to end -- declared here, set on the router, validated against this
declaration, serialized into the fork string, parsed in the worker, and read by the handler. A real
vendor toolset''s option would name a directory or a host; a prefix is the smallest thing that makes
the same journey and is observable in a tool result.'
%
expectvalue /Class
doit
McpFixtureToolset category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpFixtureToolset
removeallmethods McpFixtureToolset
removeallclassmethods McpFixtureToolset
! ------------------- Class methods for McpFixtureToolset
category: 'options'
classmethod: McpFixtureToolset
declaredOptionNames
  "echoPrefix -- what tool_fixture_echo: puts in front of the text. See the class comment."
  ^#( 'echoPrefix' )
%
! ------------------- Instance methods for McpFixtureToolset
category: 'registration'
method: McpFixtureToolset
registerOn: aToolRegistry
  aToolRegistry name: 'fixture_echo'
    description: 'Test fixture: answer the supplied text, prefixed. Proves a third-party toolset can register a tool.'
    inputSchema: (self objectSchema:
      (Dictionary new at: 'text' put: (self propString: 'Text to echo back'); yourself)
      required: (Array with: 'text'))
    do: [:args | self tool_fixture_echo: args].
  ^self
%
category: 'tools - fixture'
method: McpFixtureToolset
tool_fixture_echo: args
  "The prefix comes from this deployment's echoPrefix option, defaulting to what this tool always
   answered -- so an unconfigured toolset behaves exactly as it did before options existed, which is
   the property every existing test here is still asserting."
  ^(self optionNamed: 'echoPrefix' ifAbsent: ['echo: ']) , (args at: 'text')
%
category: 'accessing'
method: McpFixtureToolset
toolNames
  ^#( 'fixture_echo' )
%
