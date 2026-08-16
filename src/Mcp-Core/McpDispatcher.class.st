"
The JSON-RPC 2.0 / MCP routing layer. Given a parsed request Dictionary it routes
initialize / ping / tools/list / tools/call and notifications, invokes tools via the
registry, and returns a response Dictionary (or nil for notifications). Aborts the
transaction before each tools/call so the view reflects commits from other sessions.
"
Class {
	#name : 'McpDispatcher',
	#superclass : 'Object',
	#instVars : [
		'toolRegistry',
		'serverName',
		'serverVersion',
		'server'
	],
	#category : 'Mcp-Core'
}

{ #category : 'protocol versions' }
McpDispatcher class >> preferredProtocolVersion [
  "The version answered at initialize when the client's requested version is not one we support.
   Our latest supported revision; must be a member of supportedProtocolVersions."
  ^'2025-11-25'

]

{ #category : 'protocol versions' }
McpDispatcher class >> supportedProtocolVersions [
  "The single source of truth for the MCP protocol versions this server speaks: the
   Streamable-HTTP transport revisions we actually implement. Used for BOTH initialize
   negotiation (here) and the MCP-Protocol-Version header check (McpRouter delegates to this),
   so the two can never drift. 2025-03-26 is deliberately excluded: a 2025-03-26 server MUST
   support receiving JSON-RPC batches (a client MAY send them), which our single-object parseBody:
   does not -- 2025-06-18 removed batching, so 2025-06-18 and later are safe."
  ^#('2025-06-18' '2025-11-25')

]

{ #category : 'instance creation' }
McpDispatcher class >> withToolRegistry: aRegistry [
  ^self withToolRegistry: aRegistry server: nil

]

{ #category : 'instance creation' }
McpDispatcher class >> withToolRegistry: aRegistry server: aServerOrNil [
  "aServerOrNil is the owning McpServer, consulted for read-only gating; nil (e.g. in isolated
   dispatcher tests) means never read-only."
  ^self new setRegistry: aRegistry server: aServerOrNil

]

{ #category : 'responses' }
McpDispatcher >> contentText: aString isError: aBool [
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

]

{ #category : 'responses' }
McpDispatcher >> errorFor: id code: aCode message: aMessage [
  ^self errorFor: id code: aCode message: aMessage kind: nil

]

{ #category : 'responses' }
McpDispatcher >> errorFor: id code: aCode message: aMessage kind: aKindOrNil [
  "A JSON-RPC error response. When aKindOrNil is non-nil it is attached as `error.data.kind`, a
   short machine-readable classifier the client can branch on (e.g. 'invalidParams', 'notFound')."
  | d err |
  err := Dictionary new.
  err at: 'code' put: aCode.
  err at: 'message' put: aMessage.
  aKindOrNil ifNotNil: [:k | err at: 'data' put: (Dictionary new at: 'kind' put: k; yourself)].
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'id' put: id.
  d at: 'error' put: err.
  ^d

]

{ #category : 'dispatch' }
McpDispatcher >> handle: requestDict [
  "Route a parsed JSON-RPC request Dictionary. Returns a response Dictionary,
   or nil when no response should be sent (notifications)."
  | method id |
  requestDict isNil ifTrue: [^self errorFor: nil code: -32700 message: 'Parse error'].
  method := requestDict at: 'method' ifAbsent: [nil].
  id := requestDict at: 'id' ifAbsent: [nil].
  method isNil ifTrue: [^self errorFor: id code: -32600 message: 'Invalid Request'].
  method = 'initialize' ifTrue: [^self resultFor: id with: (self initializeResultFor: (requestDict at: 'params' ifAbsent: [Dictionary new]))].
  method = 'ping' ifTrue: [^self resultFor: id with: self pingResult].
  method = 'tools/list' ifTrue: [^self resultFor: id with: self toolsListResult].
  method = 'tools/call' ifTrue: [
    ^self handleToolsCall: (requestDict at: 'params' ifAbsent: [Dictionary new]) id: id].
  (method beginsWith: 'notifications/') ifTrue: [^nil].
  id isNil ifTrue: [^nil].
  ^self errorFor: id code: -32601 message: 'Method not found: ' , method

]

{ #category : 'dispatch' }
McpDispatcher >> handleToolsCall: params id: id [
  "Validate arguments against the tool's schema, then refresh the view, invoke the tool, and wrap
   the result. A raised error becomes an isError result carrying a structured kind (see
   toolErrorContentFrom:).

   Two different failure envelopes, per MCP 2025-11-25 (server/tools, Error Handling), which splits
   them by what the model can act on:
     PROTOCOL error (-32602) for a malformed CallToolRequest -- a missing tool name -- and for an
       unknown tool. The request itself is wrong; the model is unlikely to recover.
     TOOL EXECUTION error (isError:true) for arguments that violate the TOOL'S OWN inputSchema.
       These carry actionable feedback the model can use to self-correct and retry, so the spec
       wants them in the result, not as a JSON-RPC error. (Before 2025-11-25 we answered -32602
       here too; only the envelope changed -- the check still runs BEFORE the tool is invoked, so
       a rejected call still has no side effect.)"
  | name tool args argErr |
  name := params at: 'name' ifAbsent: [nil].
  name isNil ifTrue: [^self errorFor: id code: -32602 message: 'Missing tool name' kind: 'invalidParams'].
  tool := toolRegistry at: name.
  tool isNil ifTrue: [^self errorFor: id code: -32602 message: 'Unknown tool: ' , name kind: 'notFound'].
  (self toolAllowed: name) ifFalse: [
    ^self errorFor: id code: -32601
      message: '''' , name , ''' is not available: the server is read-only' kind: 'readOnly'].
  args := params at: 'arguments' ifAbsent: [Dictionary new].
  argErr := tool validationErrorFor: args.
  argErr ifNotNil: [
    ^self resultFor: id with: (self structuredErrorContent: argErr kind: 'invalidParams')].
  System abortTransaction.
  ^[ self resultFor: id with: (self contentText: (tool callWith: args) isError: false) ]
   on: Error
   do: [:ex | self resultFor: id with: (self toolErrorContentFrom: ex) ]

]

{ #category : 'responses' }
McpDispatcher >> initializeResultFor: params [
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

]

{ #category : 'responses' }
McpDispatcher >> kindForError: ex [
  "Classify a caught error into a short machine-readable kind for the tools/call error envelope.
   An McpError carries its own kind; a CompileError is 'compileError'; everything else is 'other'."
  (ex isKindOf: McpError) ifTrue: [^ex kind asString].
  (ex isKindOf: CompileError) ifTrue: [^'compileError'].
  ^'other'

]

{ #category : 'responses' }
McpDispatcher >> pingResult [
  "The MCP ping result: an EMPTY object. The spec (basic/utilities/ping) is a MUST -- 'the receiver
   MUST respond promptly with an empty response' -- and either party may ping at any time, so this
   is routed ahead of everything except initialize, is never read-only gated (it is not a tool),
   and deliberately does no repository work (no abort, no transaction touch) so it stays cheap and
   answers even when the image is busy."
  ^Dictionary new

]

{ #category : 'responses' }
McpDispatcher >> resultFor: id with: resultObj [
  | d |
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'id' put: id.
  d at: 'result' put: resultObj.
  ^d

]

{ #category : 'initialization' }
McpDispatcher >> setRegistry: aRegistry server: aServerOrNil [
  toolRegistry := aRegistry.
  server := aServerOrNil.
  serverName := 'gemstone-mcp'.
  serverVersion := '0.1.0'.
  ^self

]

{ #category : 'responses' }
McpDispatcher >> structuredErrorContent: aMessage kind: aKind [
  "The shared tools/call TOOL EXECUTION error envelope: the human message in `content` text, PLUS
   `structuredContent` {error:{kind,message}} so an agent can branch on the kind instead of parsing
   prose. Used both for an error raised by a tool (toolErrorContentFrom:) and for arguments that
   fail the tool's inputSchema (handleToolsCall:)."
  | d struct |
  d := self contentText: aMessage isError: true.
  struct := Dictionary new.
  struct at: 'error' put: (Dictionary new
    at: 'kind' put: aKind;
    at: 'message' put: aMessage;
    yourself).
  d at: 'structuredContent' put: struct.
  ^d

]

{ #category : 'read-only' }
McpDispatcher >> toolAllowed: aToolName [
  "Whether aToolName may be listed/called now. Always yes when there's no server or it isn't
   read-only; otherwise only the read-only-safe tools (server decides)."
  ^server isNil or: [server isToolAllowed: aToolName]

]

{ #category : 'responses' }
McpDispatcher >> toolErrorContentFrom: ex [
  "The tools/call error envelope for a raised error (see structuredErrorContent:kind:). Uses
   `ex description` for the message text -- `ex messageText` is often nil in GemStone."
  | msg |
  msg := [ex description] on: Error do: [:e | ex messageText ifNil: ['(error)']].
  ^self structuredErrorContent: msg kind: (self kindForError: ex)

]

{ #category : 'responses' }
McpDispatcher >> toolsListResult [
  "tools/list. When the session is read-only, hide the gated (dangerous) tools so an agent only
   sees what it may actually call (they still error clearly on a direct call -- see handleToolsCall:)."
  | d |
  d := Dictionary new.
  d at: 'tools' put: (toolRegistry descriptors select: [:desc | self toolAllowed: (desc at: 'name')]).
  ^d

]
