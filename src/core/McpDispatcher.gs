set compile_env: 0
! ------------------- Class definition for McpDispatcher
expectvalue /Class
doit
Object subclass: 'McpDispatcher'
  instVarNames: #( toolRegistry server)
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
category: 'transaction'
method: McpDispatcher
commitConflictPending
  "Whether a failed commit has left this session in the must-abort state; see
   McpToolset class>>commitConflictPending, which is the single implementation."
  ^McpToolset commitConflictPending
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

   THE VIEW. NO TOOL REFRESHES IT. A session sees one consistent snapshot of the repository until
   the client itself asks for another, by committing, aborting, or calling `refresh`. That is not
   an omission, it is the guardrail: GemStone's conflict check is write-write AGAINST THE VIEW and
   does not track what a client read, so the view is the only record the stone has of what this
   client saw. Refreshing under it -- which this method did before 2026-08-28, first with
   abortTransaction and then briefly with continueTransaction -- tells the stone the client has
   seen changes it has not, and a commit that should have been refused as stale is accepted
   instead, silently discarding another session's work. Measured both ways; see
   docs/server-to-client-messaging.md 15.

   What the call left behind is reported afterwards by annotateContent:. No tool commits either:
   see McpMutationToolset."
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
category: 'transaction'
method: McpDispatcher
staleReadNote
  "One line naming the reads the last view move invalidated, or nil when it invalidated none (or
   there is no server to ask). Appended by transactionNote.

   CONSUMED AS IT IS REPORTED: the keys come from McpServer>>takeStaleReadKeys, so the line lands on
   the result of the very call that moved the view -- abort, or a refresh that answered false -- and
   never again. That is the point of naming them at all: the client can redo exactly those reads in
   one pass, instead of meeting each as a blindWrite refusal later. The count puts the names in
   proportion ('2 of 7 earlier reads'), which is what tells the client the other five still stand.
   Ten names at most; a bigger list says how many more, and the refusals name the rest if it
   comes to that."
  | keys total shown |
  server isNil ifTrue: [^nil].
  keys := server takeStaleReadKeys.
  keys isEmpty ifTrue: [^nil].
  total := keys size + server readLedger size.
  shown := keys copyFrom: 1 to: (keys size min: 10).
  ^'[session] The view moved: ' , keys size printString , ' of ' , total printString
    , ' earlier read' , (total = 1 ifTrue: [''] ifFalse: ['s'])
    , (keys size = 1 ifTrue: [' is'] ifFalse: [' are'])
    , ' stale and must be re-read before writing to them: '
    , (shown inject: '' into: [:acc :k | acc isEmpty ifTrue: [k asString] ifFalse: [acc , ', ' , k asString]])
    , (keys size > 10 ifTrue: [', and ' , (keys size - 10) printString , ' more'] ifFalse: [''])
    , '.'
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

   Ordered most-blocking first. A failed commit subsumes everything else -- no further commit can
   succeed and the view cannot move until the transaction is aborted -- and a nested transaction
   subsumes pending changes, since nothing can be committed out of one either.

   One addition since 2026-09-02, kept as a SECOND line rather than a fourth state: on the result of
   a call that moved the view without the stone vouching for the reads (abort, a refresh answering
   false), the reads the move invalidated are named once (staleReadNote). It is a different subject
   from the transaction's state -- what to RE-READ, not what to commit or abort -- it can coincide
   with any of the three states above, and it appears exactly once, so it is appended rather than
   ranked."
  | state stale |
  state := self transactionStateNote.
  stale := self staleReadNote.
  stale isNil ifTrue: [^state].
  state isNil ifTrue: [^stale].
  ^state , (String with: Character lf) , stale
%
category: 'transaction'
method: McpDispatcher
transactionStateNote
  "The transaction-state line of transactionNote, or nil: failed commit, nested transaction, or
   uncommitted changes, most-blocking first. See transactionNote for why."
  self commitConflictPending ifTrue: [
    ^'[session] Your last commit FAILED: another session changed the same objects since your view '
      , 'was taken (' , McpToolset commitConflictReport , '). Nothing was written. Your changes are '
      , 'still here but cannot be committed and your view cannot move until you call abort, which '
      , 'discards them -- save anything you need first, then abort, re-read, and redo it.'].
  System transactionLevel > 1 ifTrue: [
    ^'[session] This session is inside a nested transaction; commit and abort cannot act on the '
      , 'outer one until it is closed.'].
  System needsCommit ifTrue: [ | note |
    note := self sessionLifetimeNote.
    ^'[session] You have uncommitted changes. No tool commits for you: call commit to persist '
      , 'them or abort to discard them. '
      , (note isNil
          ifTrue: ['They are lost if this session ends first.']
          ifFalse: ['They are lost when this session ends: ' , note , '.'])].
  ^nil
%
