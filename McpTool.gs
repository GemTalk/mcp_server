set compile_env: 0
! ------------------- Class definition for McpTool
expectvalue /Class
doit
Object subclass: 'McpTool'
  instVarNames: #( name description schema handler)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()
%
expectvalue /Class
doit
McpTool comment:
'A single MCP tool: a name, human description, JSON-Schema (a Dictionary) for its
arguments, and a one-argument handler block [:argsDict | aString] that performs the
work and returns a String. Part of the native GemStone MCP server (see McpServer).'
%
expectvalue /Class
doit
McpTool category: 'MCPServer'
%
! ------------------- Remove existing behavior from McpTool
removeallmethods McpTool
removeallclassmethods McpTool
! ------------------- Class methods for McpTool
category: 'instance creation'
classmethod: McpTool
name: aName description: aDescription inputSchema: aSchema handler: aBlock
  "aSchema is a Dictionary describing the JSON Schema of the tool's arguments.
   aBlock is a one-argument block [:argsDict | ...] returning a String result."
  ^self new
    setName: aName description: aDescription inputSchema: aSchema handler: aBlock
%
! ------------------- Instance methods for McpTool
category: 'initialization'
method: McpTool
setName: aName description: aDescription inputSchema: aSchema handler: aBlock
  name := aName.
  description := aDescription.
  schema := aSchema.
  handler := aBlock.
  ^self
%
category: 'accessing'
method: McpTool
name
  ^name
%
category: 'converting'
method: McpTool
descriptor
  "The MCP tools/list entry for this tool."
  | d |
  d := Dictionary new.
  d at: 'name' put: name.
  d at: 'description' put: description.
  d at: 'inputSchema' put: schema.
  ^d
%
category: 'evaluating'
method: McpTool
callWith: argsDict
  "Invoke the handler with the supplied arguments Dictionary (may be nil).
   Returns a String. Any error raised propagates to the dispatcher."
  ^handler value: (argsDict ifNil: [Dictionary new])
%
