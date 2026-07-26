set compile_env: 0
! ------------------- Class definition for McpDispatcher
expectvalue /Class
doit
Object subclass: 'McpDispatcher'
  instVarNames: #( toolRegistry serverName serverVersion)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpDispatcher comment: 
'The JSON-RPC 2.0 / MCP routing layer. Given a parsed request Dictionary it routes
initialize / tools/list / tools/call and notifications, invokes tools via the
registry, and returns a response Dictionary (or nil for notifications). Aborts the
transaction before each tools/call so the view reflects commits from other sessions.'
%
expectvalue /Class
doit
McpDispatcher category: 'MCPServer'
%
! ------------------- Remove existing behavior from McpDispatcher
removeallmethods McpDispatcher
removeallclassmethods McpDispatcher
! ------------------- Class methods for McpDispatcher
category: 'protocol versions'
classmethod: McpDispatcher
preferredProtocolVersion
  "The version answered at initialize when the client's requested version is not one we support.
   Our latest supported revision; must be a member of supportedProtocolVersions."
  ^'2025-11-25'
%
category: 'protocol versions'
classmethod: McpDispatcher
supportedProtocolVersions
  "The single source of truth for the MCP protocol versions this server speaks: the
   Streamable-HTTP transport revisions we actually implement. Used for BOTH initialize
   negotiation (here) and the MCP-Protocol-Version header check (McpRouter delegates to this),
   so the two can never drift. 2025-03-26 is deliberately excluded: a 2025-03-26 server MUST
   support receiving JSON-RPC batches (a client MAY send them), which our single-object parseBody:
   does not -- 2025-06-18 removed batching, so 2025-06-18 and later are safe."
  ^#('2025-06-18' '2025-11-25')
%
category: 'instance creation'
classmethod: McpDispatcher
withToolRegistry: aRegistry
  ^self new setRegistry: aRegistry
%
! ------------------- Instance methods for McpDispatcher
category: 'responses'
method: McpDispatcher
contentText: aString isError: aBool
  "Build the MCP tools/call result envelope: {content:[{type:text,text:...}], isError:bool}."
  | item content d |
  item := Dictionary new.
  item at: 'type' put: 'text'.
  item at: 'text' put: (aString ifNil: ['']).
  content := Array with: item.
  d := Dictionary new.
  d at: 'content' put: content.
  d at: 'isError' put: aBool.
  ^d
%
category: 'responses'
method: McpDispatcher
errorFor: id code: aCode message: aMessage
  | d err |
  err := Dictionary new.
  err at: 'code' put: aCode.
  err at: 'message' put: aMessage.
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'id' put: id.
  d at: 'error' put: err.
  ^d
%
category: 'dispatch'
method: McpDispatcher
handle: requestDict
  "Route a parsed JSON-RPC request Dictionary. Returns a response Dictionary,
   or nil when no response should be sent (notifications)."
  | method id |
  requestDict isNil ifTrue: [^self errorFor: nil code: -32700 message: 'Parse error'].
  method := requestDict at: 'method' ifAbsent: [nil].
  id := requestDict at: 'id' ifAbsent: [nil].
  method isNil ifTrue: [^self errorFor: id code: -32600 message: 'Invalid Request'].
  method = 'initialize' ifTrue: [^self resultFor: id with: (self initializeResultFor: (requestDict at: 'params' ifAbsent: [Dictionary new]))].
  method = 'tools/list' ifTrue: [^self resultFor: id with: self toolsListResult].
  method = 'tools/call' ifTrue: [
    ^self handleToolsCall: (requestDict at: 'params' ifAbsent: [Dictionary new]) id: id].
  (method beginsWith: 'notifications/') ifTrue: [^nil].
  id isNil ifTrue: [^nil].
  ^self errorFor: id code: -32601 message: 'Method not found: ' , method
%
category: 'dispatch'
method: McpDispatcher
handleToolsCall: params id: id
  "Refresh the view, look up and invoke the named tool, wrap the result."
  | name tool |
  name := params at: 'name' ifAbsent: [nil].
  name isNil ifTrue: [^self errorFor: id code: -32602 message: 'Missing tool name'].
  tool := toolRegistry at: name.
  tool isNil ifTrue: [^self errorFor: id code: -32602 message: 'Unknown tool: ' , name].
  System abortTransaction.
  ^[ | text |
     text := tool callWith: (params at: 'arguments' ifAbsent: [Dictionary new]).
     self resultFor: id with: (self contentText: text isError: false) ]
   on: Error
   do: [:ex | self resultFor: id with:
       (self contentText: ([ex description] on: Error do: [:e | ex messageText ifNil: ['(error)']]) isError: true) ]
%
category: 'responses'
method: McpDispatcher
initializeResultFor: params
  "Build the initialize result, negotiating the protocol version per the MCP lifecycle: echo the
   client's requested protocolVersion if we support it, else answer our preferred (latest) version.
   The client then sends the negotiated version in the MCP-Protocol-Version header on later
   requests, which McpRouter validates against the SAME supportedProtocolVersions -- so whatever we
   negotiate here is always a value the header check accepts."
  | requested negotiated caps tools info d |
  requested := params at: 'protocolVersion' ifAbsent: [nil].
  negotiated := (self class supportedProtocolVersions includes: requested)
    ifTrue: [requested]
    ifFalse: [self class preferredProtocolVersion].
  tools := Dictionary new.
  caps := Dictionary new.
  caps at: 'tools' put: tools.
  info := Dictionary new.
  info at: 'name' put: serverName.
  info at: 'version' put: serverVersion.
  d := Dictionary new.
  d at: 'protocolVersion' put: negotiated.
  d at: 'capabilities' put: caps.
  d at: 'serverInfo' put: info.
  ^d
%
category: 'responses'
method: McpDispatcher
resultFor: id with: resultObj
  | d |
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'id' put: id.
  d at: 'result' put: resultObj.
  ^d
%
category: 'initialization'
method: McpDispatcher
setRegistry: aRegistry
  toolRegistry := aRegistry.
  serverName := 'gemstone-mcp'.
  serverVersion := '0.1.0'.
  ^self
%
category: 'responses'
method: McpDispatcher
toolsListResult
  | d |
  d := Dictionary new.
  d at: 'tools' put: toolRegistry descriptors.
  ^d
%
