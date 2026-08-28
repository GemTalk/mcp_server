set compile_env: 0
! ------------------- Class definition for McpDispatcher
expectvalue /Class
doit
Object subclass: 'McpDispatcher'
  instVarNames: #( toolRegistry server viewRefreshError)
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
initialize / ping / tools/list / tools/call and notifications, invokes tools via the
registry, and returns a response Dictionary (or nil for notifications). Aborts the
transaction before each tools/call so the view reflects commits from other sessions.'
%
expectvalue /Class
doit
McpDispatcher category: 'Mcp-Core'
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
  ^self withToolRegistry: aRegistry server: nil
%
category: 'instance creation'
classmethod: McpDispatcher
withToolRegistry: aRegistry server: aServerOrNil
  "aServerOrNil is the owning McpServer, consulted for read-only gating; nil (e.g. in isolated
   dispatcher tests) means never read-only."
  ^self new setRegistry: aRegistry server: aServerOrNil
%
! ------------------- Instance methods for McpDispatcher
category: 'transaction'
method: McpDispatcher
annotateContent: aResultDict
  "Append the session-state note (transactionNote) to an already-built tools/call envelope's text,
   or answer it unchanged when there is nothing to say. Applied to BOTH the success and the error
   envelope, because a tool that raised is exactly when dirty state most needs reporting.

   WHY AFTER THE TOOL AND NOT BEFORE. The note describes the state the client is actually left in,
   not the state the call arrived in. That is what lets `abort` clear a pending commit conflict and
   answer 'Transaction aborted' with no contradicting warning stapled to it, while abort itself
   stays two lines that know nothing about any of this -- the alternative, annotating from the
   pre-call state, would need every transaction tool to suppress a note the dispatcher had already
   decided to add.

   structuredContent is deliberately NOT touched: its error kind and message stay exactly what the
   tool raised, so a client branching on the kind is unaffected by prose meant for the model."
  | note content item |
  note := self transactionNote.
  note isNil ifTrue: [^aResultDict].
  content := aResultDict at: 'content' ifAbsent: [nil].
  (content isNil or: [content isEmpty]) ifTrue: [^aResultDict].
  item := content at: 1.
  item at: 'text' put: (item at: 'text' ifAbsent: ['']) , (String with: Character lf) , note.
  ^aResultDict
%
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
  ^self errorFor: id code: aCode message: aMessage kind: nil
%
category: 'responses'
method: McpDispatcher
errorFor: id code: aCode message: aMessage kind: aKindOrNil
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
  method = 'ping' ifTrue: [^self resultFor: id with: self pingResult].
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
       a rejected call still has no side effect.)

   THE VIEW, AND WHAT SURVIVES A CALL. The pre-call refresh keeps this session's uncommitted work
   (refreshViewForCall); the post-call annotation reports what state the call left behind
   (annotateContent:). Together they are what makes a multi-call workflow -- compile, run the
   tests, then commit -- possible at all. No tool commits: see McpMutationToolset."
  | name tool args argErr |
  name := params at: 'name' ifAbsent: [nil].
  name isNil ifTrue: [^self errorFor: id code: -32602 message: 'Missing tool name' kind: 'invalidParams'].
  tool := toolRegistry at: name.
  (tool isNil and: [(self readOnlyGated: name) not]) ifTrue: [
    ^self errorFor: id code: -32602 message: 'Unknown tool: ' , name kind: 'notFound'].
  "Read-only refusal, for a gated tool whether or not it is still in the registry: a read-only worker
   built by the front end never registers its unsafe tools (McpServer>>registerToolsets), but the
   client must still learn that the tool EXISTS and is forbidden -- not that it is unknown."
  (tool isNil or: [(self toolAllowed: name) not]) ifTrue: [
    ^self errorFor: id code: -32601
      message: '''' , name , ''' is not available: the server is read-only' kind: 'readOnly'].
  args := params at: 'arguments' ifAbsent: [Dictionary new].
  argErr := tool validationErrorFor: args.
  argErr ifNotNil: [
    ^self resultFor: id with: (self structuredErrorContent: argErr kind: 'invalidParams')].
  self refreshViewForCall.
  ^[ self resultFor: id
       with: (self annotateContent: (self contentText: (tool callWith: args) isError: false)) ]
   on: Error
   do: [:ex | self resultFor: id with: (self annotateContent: (self toolErrorContentFrom: ex)) ]
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
  "A server may send only what it has declared, and this server declares only its tools.
   'logging' was declared until 2026-08-27, solely to license notifications/message as the generic
   carrier for the front end's idle warning and session-ending notice. Both warnings are gone, the
   draft revision prohibits an unsolicited notifications/message anyway, and declaring the
   capability would go on promising a logging/setLevel that nothing in this server would read.
   Deliberately NOT declared: tools listChanged (no session's tool surface changes after
   initialize), resources, prompts, and completions -- none of which this server has.
   Note what needs no declaration: progress. notifications/progress is a base-protocol utility a
   client opts into per REQUEST, by putting a progressToken in the request's _meta, so there has
   never been anything for a server to advertise -- see docs/server-to-client-messaging.md 2.2."
  info := Dictionary new.
  info at: 'name' put: self serverName.
  "title is OMITTED when nil rather than sent as null: an absent title is what tells a client to
   display the name instead, so a present title always means a human labeled this instance."
  self serverTitle ifNotNil: [:t | info at: 'title' put: t].
  info at: 'version' put: self serverVersion.
  d := Dictionary new.
  d at: 'protocolVersion' put: negotiated.
  d at: 'capabilities' put: caps.
  d at: 'serverInfo' put: info.
  "instructions: OMITTED when nil, on the same rule as title -- an absent key is what a client
   treats as 'none given', and sending null would have it render or forward the word. The spec
   calls this a hint to the model, so what goes in it is what a model cannot get from tool
   descriptions read one at a time: see McpServer class>>defaultServerInstructions."
  self serverInstructions ifNotNil: [:i | d at: 'instructions' put: i].
  ^d
%
category: 'responses'
method: McpDispatcher
kindForError: ex
  "Classify a caught error into a short machine-readable kind for the tools/call error envelope.
   An McpError carries its own kind; a CompileError is 'compileError'; everything else is 'other'."
  (ex isKindOf: McpError) ifTrue: [^ex kind asString].
  (ex isKindOf: CompileError) ifTrue: [^'compileError'].
  ^'other'
%
category: 'responses'
method: McpDispatcher
pingResult
  "The MCP ping result: an EMPTY object. The spec (basic/utilities/ping) is a MUST -- 'the receiver
   MUST respond promptly with an empty response' -- and either party may ping at any time, so this
   is routed ahead of everything except initialize, is never read-only gated (it is not a tool),
   and deliberately does no repository work (no abort, no transaction touch) so it stays cheap and
   answers even when the image is busy."
  ^Dictionary new
%
category: 'read-only'
method: McpDispatcher
readOnlyGated: aToolName
  "Whether aToolName is one of the server's own tools that this read-only session may not run --
   i.e. absent from the registry (or refused) because of read-only, not because it does not exist.
   False when there is no server (isolated dispatcher tests), so an unknown tool stays 'notFound'."
  ^server notNil
    and: [(server allToolNames includes: aToolName) and: [(server isToolAllowed: aToolName) not]]
%
category: 'transaction'
method: McpDispatcher
refreshViewForCall
  "Give the tool that is about to run a current view of other sessions' committed work WITHOUT
   destroying this session's uncommitted changes.

   This sent `System abortTransaction` until 2026-08-28. The freshness was right and is still
   wanted -- a gem that never refreshes reads stale source and pins pages -- but the abort bought
   it by emptying the transaction, which meant `commit` committed a transaction emptied a
   microsecond earlier, and no work could survive from one call to the next at all
   (docs/server-to-client-messaging.md 10.11). continueTransaction buys the same freshness and
   destroys nothing.

   NEVER RAISES, and decides nothing. continueTransaction is illegal in exactly two states, both
   measured on 3.7.5/3.7.6:
     nested transaction               ImproperOperation 2717
     commit failed on conflict        TransactionError 2409 -- and STICKY, raising on every later
                                      call until someone aborts
   Raising here would be worst precisely in the second case: it would poison every subsequent call
   INCLUDING the `abort` that is the only way out. So a failure is RECORDED rather than raised --
   the tool runs on the view it has, and transactionNote reports afterwards what could not be done
   and why. Always assigns, so what is reported is always this call's answer."
  viewRefreshError := McpToolset refreshView.
  ^self
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
category: 'accessing'
method: McpDispatcher
serverInstructions
  "The initialize result's `instructions`, or nil for none -- see serverName for why this asks the
   server rather than caching. nil means the key is omitted entirely, which is also what a
   read-only session gets (McpServer>>serverInstructions)."
  ^server isNil ifTrue: [McpServer defaultServerInstructions] ifFalse: [server serverInstructions]
%
category: 'accessing'
method: McpDispatcher
serverName
  "The serverInfo name to report: ASK the server rather than caching a copy, because the worker
   bootstrap may set its name (from router config) AFTER this dispatcher was built -- the server is
   constructed with its dispatcher, so a value cached at construction time would always be the
   default. Falls back to the class default when there is no server (isolated dispatcher tests)."
  ^server isNil ifTrue: [McpServer defaultServerName] ifFalse: [server serverName]
%
category: 'accessing'
method: McpDispatcher
serverTitle
  "The serverInfo title to report, or nil for none -- see serverName for why this asks the server
   rather than caching. A nil answer means initializeResultFor: leaves the title key out entirely."
  ^server isNil ifTrue: [McpServer defaultServerTitle] ifFalse: [server serverTitle]
%
category: 'accessing'
method: McpDispatcher
serverVersion
  "See serverName."
  ^server isNil ifTrue: [McpServer defaultServerVersion] ifFalse: [server serverVersion]
%
category: 'transaction'
method: McpDispatcher
sessionLifetimeNote
  "What the front end said would end this session, or nil -- the clause transactionNote appends to
   the uncommitted-changes warning, so it names WHICH deadline is coming rather than only that one
   is. nil whenever there is no server (isolated dispatcher tests) or no front end said anything,
   in which case the warning falls back to its unqualified form."
  ^server isNil ifTrue: [nil] ifFalse: [server lifetimeNote]
%
category: 'initialization'
method: McpDispatcher
setRegistry: aRegistry server: aServerOrNil
  toolRegistry := aRegistry.
  server := aServerOrNil.
  ^self
%
category: 'responses'
method: McpDispatcher
structuredErrorContent: aMessage kind: aKind
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
%
category: 'read-only'
method: McpDispatcher
toolAllowed: aToolName
  "Whether aToolName may be listed/called now. Always yes when there's no server or it isn't
   read-only; otherwise only the read-only-safe tools (server decides)."
  ^server isNil or: [server isToolAllowed: aToolName]
%
category: 'responses'
method: McpDispatcher
toolErrorContentFrom: ex
  "The tools/call error envelope for a raised error (see structuredErrorContent:kind:). Uses
   `ex description` for the message text -- `ex messageText` is often nil in GemStone."
  | msg |
  msg := [ex description] on: Error do: [:e | ex messageText ifNil: ['(error)']].
  ^self structuredErrorContent: msg kind: (self kindForError: ex)
%
category: 'responses'
method: McpDispatcher
toolsListResult
  "tools/list. When the session is read-only, hide the gated (dangerous) tools so an agent only
   sees what it may actually call (they still error clearly on a direct call -- see handleToolsCall:)."
  | d |
  d := Dictionary new.
  d at: 'tools' put: (toolRegistry descriptors select: [:desc | self toolAllowed: (desc at: 'name')]).
  ^d
%
category: 'transaction'
method: McpDispatcher
transactionNote
  "One line of session state the model must act on, or nil when there is nothing to say. Appended
   to every tool result by annotateContent:, and computed from the state left AFTER the tool ran.

   Kept to one line and one subject on purpose: the tool's own text says what the tool did, this
   says what the SESSION now needs, and the transaction model that makes both intelligible is
   stated once in the initialize instructions rather than repeated per call.

   Ordered most-blocking first. A view that could not be refreshed subsumes everything else: the
   session is reading stale data and cannot commit until it is aborted, and GemStone's own text for
   the error says which of the two causes it was, so it is quoted rather than re-worded."
  viewRefreshError ifNotNil: [:ex | | why |
    why := [ex description] on: Error do: [:e | 'reason unavailable'].
    ^'[session] This session''s view could NOT be refreshed and is stale: ' , why
      , ' Call abort to recover -- it is the only operation that clears this state, and it '
      , 'discards any uncommitted changes.'].
  System needsCommit ifTrue: [ | note |
    note := self sessionLifetimeNote.
    ^'[session] You have uncommitted changes. No tool commits for you: call commit to persist '
      , 'them or abort to discard them. '
      , (note isNil
          ifTrue: ['They are lost if this session ends first.']
          ifFalse: ['They are lost when this session ends: ' , note , '.'])].
  ^nil
%
