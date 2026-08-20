set compile_env: 0
! ------------------- Class definition for McpFixtureToolset
expectvalue /Class
doit
McpToolset subclass: 'McpFixtureToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpFixtureToolset comment: 
'A third-party toolset, in miniature: one tool (fixture_echo) that the extension tests use to prove a
developer can add tools without touching McpServer, combine them with the core toolsets, and have
read-only honor their own safety declaration.

Written the way a real third-party toolset should be: it owns its handler, needs nothing from the
server (echoing a string consults no server-level policy -- see McpToolset), and declares its tool
read-only safe because echoing an argument cannot persist anything.'
%
expectvalue /Class
doit
McpFixtureToolset category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpFixtureToolset
removeallmethods McpFixtureToolset
removeallclassmethods McpFixtureToolset
! ------------------- Class methods for McpFixtureToolset
! ------------------- Instance methods for McpFixtureToolset
category: 'read-only'
method: McpFixtureToolset
readOnlySafeToolNames
  "Echoing a string cannot persist a change, so this survives a read-only session -- the point being
   that a toolset decides this for its OWN tools, rather than a central list deciding for it."
  ^self toolNames
%
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
  ^'echo: ' , (args at: 'text')
%
category: 'accessing'
method: McpFixtureToolset
toolNames
  ^#( 'fixture_echo' )
%
