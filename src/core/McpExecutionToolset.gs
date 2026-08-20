set compile_env: 0
! ------------------- Class definition for McpExecutionToolset
expectvalue /Class
doit
McpToolset subclass: 'McpExecutionToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpExecutionToolset comment: 
'The arbitrary-code tool: execute_code. Deliberately its own toolset, so a deployment can expose the
rest of the server without handing out an escape hatch that can do anything the session''s user can.

NOT read-only-safe (readOnlySafeToolNames is inherited, i.e. empty), so a read-only session drops
this toolset whole.

The handler caps its result at the shared 50k output limit (McpToolset>>capResult:); everything else
about an evaluation -- errors included -- is the dispatcher''s business.'
%
expectvalue /Class
doit
McpExecutionToolset category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpExecutionToolset
removeallmethods McpExecutionToolset
removeallclassmethods McpExecutionToolset
! ------------------- Class methods for McpExecutionToolset
! ------------------- Instance methods for McpExecutionToolset
category: 'registration'
method: McpExecutionToolset
registerOn: aToolRegistry
  aToolRegistry
    name: 'execute_code'
    description: 'Execute GemStone Smalltalk code and return the printString of the result. Accepts a single expression or a sequence of statements.'
    inputSchema: (self objectSchema:
        (Dictionary new at: 'code' put: (self propString: 'Smalltalk source to evaluate'); yourself)
        required: (Array with: 'code'))
    do: [:args | self tool_execute_code: args].
  ^self
%
category: 'tools - execution'
method: McpExecutionToolset
tool_execute_code: args
  "Code is wrapped by McpDispatcher>>handleToolsCall:id: to catch errors"
  ^self capResult: (args at: 'code') evaluate printString
%
category: 'accessing'
method: McpExecutionToolset
toolNames
  ^#( 'execute_code' )
%
