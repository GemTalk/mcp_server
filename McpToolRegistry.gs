set compile_env: 0
! ------------------- Class definition for McpToolRegistry
expectvalue /Class
doit
Object subclass: 'McpToolRegistry'
  instVarNames: #( tools)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()
%
expectvalue /Class
doit
McpToolRegistry comment:
'Holds the set of McpTool instances keyed by tool name. Produces the descriptor
list for MCP tools/list and looks up tools for tools/call.'
%
expectvalue /Class
doit
McpToolRegistry category: 'MCPServer'
%
! ------------------- Remove existing behavior from McpToolRegistry
removeallmethods McpToolRegistry
removeallclassmethods McpToolRegistry
! ------------------- Class methods for McpToolRegistry
category: 'instance creation'
classmethod: McpToolRegistry
new
  ^super new initialize
%
! ------------------- Instance methods for McpToolRegistry
category: 'initialization'
method: McpToolRegistry
initialize
  tools := Dictionary new
%
category: 'registration'
method: McpToolRegistry
register: aTool
  tools at: aTool name put: aTool.
  ^aTool
%
category: 'registration'
method: McpToolRegistry
name: aName description: aDescription inputSchema: aSchema do: aBlock
  "Convenience: build and register a tool in one line."
  ^self register:
    (McpTool name: aName description: aDescription inputSchema: aSchema handler: aBlock)
%
category: 'accessing'
method: McpToolRegistry
at: aName
  "Return the tool registered under aName, or nil."
  ^tools at: aName ifAbsent: [nil]
%
category: 'accessing'
method: McpToolRegistry
descriptors
  "An Array of MCP tool descriptors for tools/list, sorted alphabetically by tool name."
  ^(tools keys asSortedCollection asArray) collect: [:toolName | (tools at: toolName) descriptor]
%
