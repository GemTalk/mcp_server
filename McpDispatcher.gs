set compile_env: 0
! ------------------- Class definition for McpDispatcher
expectvalue /Class
doit
Object subclass: 'McpDispatcher'
  instVarNames: #( toolRegistry serverName serverVersion
                    server)
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
category: 'prompts'
classmethod: McpDispatcher
promptArg: aName description: aDescription
  "An OPTIONAL prompt-argument descriptor (all our prompt arguments are optional)."
  ^Dictionary new
    at: 'name' put: aName;
    at: 'description' put: aDescription;
    at: 'required' put: false;
    yourself
%
category: 'prompts'
classmethod: McpDispatcher
promptSpecFor: aName
  ^self promptSpecs detect: [:s | (s at: 'name') = aName] ifNone: [nil]
%
category: 'prompts'
classmethod: McpDispatcher
promptSpecNamed: aName description: aDescription arguments: anArgumentArray
  ^Dictionary new
    at: 'name' put: aName;
    at: 'description' put: aDescription;
    at: 'arguments' put: anArgumentArray;
    yourself
%
category: 'prompts'
classmethod: McpDispatcher
promptSpecs
  "Single source of truth for the MCP workflow prompts: the prompts/list descriptors (name,
   description, optional arguments). The message body for each is built by promptTextFor:arguments:."
  ^Array
    with: (self promptSpecNamed: 'gemstone-transaction-hygiene'
      description: 'Keep a clean GemStone transaction while working: status -> refresh -> work -> commit/abort.'
      arguments: #())
    with: (self promptSpecNamed: 'gemstone-tdd'
      description: 'A red/green TDD loop for GemStone: locate, write a failing test, implement, re-run, commit.'
      arguments: (Array with: (self promptArg: 'subject' description: 'What you are building (optional; woven into the guidance).')))
    with: (self promptSpecNamed: 'gemstone-safe-change'
      description: 'Change existing code safely: green baseline, impact map, change, re-test, confirm.'
      arguments: (Array with: (self promptArg: 'change' description: 'The change you intend to make (optional).')))
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
  method = 'tools/list' ifTrue: [^self resultFor: id with: self toolsListResult].
  method = 'tools/call' ifTrue: [
    ^self handleToolsCall: (requestDict at: 'params' ifAbsent: [Dictionary new]) id: id].
  method = 'prompts/list' ifTrue: [^self resultFor: id with: self promptsListResult].
  method = 'prompts/get' ifTrue: [
    ^self promptsGetResult: (requestDict at: 'params' ifAbsent: [Dictionary new]) id: id].
  (method beginsWith: 'notifications/') ifTrue: [^nil].
  id isNil ifTrue: [^nil].
  ^self errorFor: id code: -32601 message: 'Method not found: ' , method
%
category: 'dispatch'
method: McpDispatcher
handleToolsCall: params id: id
  "Validate arguments against the tool's schema, then refresh the view, invoke the tool, and wrap
   the result. Bad arguments (unknown key / missing required) -> -32602 invalidParams BEFORE any
   side effect. A raised error becomes an isError result carrying a structured kind (see
   toolErrorContentFrom:)."
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
  argErr ifNotNil: [^self errorFor: id code: -32602 message: argErr kind: 'invalidParams'].
  System abortTransaction.
  ^[ self resultFor: id with: (self contentText: (tool callWith: args) isError: false) ]
   on: Error
   do: [:ex | self resultFor: id with: (self toolErrorContentFrom: ex) ]
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
  caps at: 'prompts' put: Dictionary new.
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
kindForError: ex
  "Classify a caught error into a short machine-readable kind for the tools/call error envelope.
   An McpError carries its own kind; a CompileError is 'compileError'; everything else is 'other'."
  (ex isKindOf: McpError) ifTrue: [^ex kind asString].
  (ex isKindOf: CompileError) ifTrue: [^'compileError'].
  ^'other'
%
category: 'prompts'
method: McpDispatcher
promptsGetResult: params id: id
  "prompts/get: answer {description, messages:[one user text message]} for the named prompt, weaving
   in any optional argument. Missing/unknown name -> -32602."
  | name spec |
  name := params at: 'name' ifAbsent: [nil].
  name isNil ifTrue: [^self errorFor: id code: -32602 message: 'Missing prompt name' kind: 'invalidParams'].
  spec := self class promptSpecFor: name.
  spec isNil ifTrue: [^self errorFor: id code: -32602 message: 'Unknown prompt: ' , name kind: 'notFound'].
  ^self resultFor: id with: (Dictionary new
    at: 'description' put: (spec at: 'description');
    at: 'messages' put: (Array with: (self promptUserMessage:
      (self promptTextFor: name arguments: (params at: 'arguments' ifAbsent: [Dictionary new]))));
    yourself)
%
category: 'prompts'
method: McpDispatcher
promptsListResult
  "prompts/list: the workflow-prompt catalogue (name/description/arguments)."
  ^Dictionary new at: 'prompts' put: self class promptSpecs; yourself
%
category: 'prompts'
method: McpDispatcher
promptTextFor: name arguments: args
  "The guidance body for a prompt, given its (optional) arguments."
  name = 'gemstone-transaction-hygiene' ifTrue: [^self txHygieneText].
  name = 'gemstone-tdd' ifTrue: [^self tddTextFor: (args at: 'subject' ifAbsent: [nil])].
  name = 'gemstone-safe-change' ifTrue: [^self safeChangeTextFor: (args at: 'change' ifAbsent: [nil])].
  ^''
%
category: 'prompts'
method: McpDispatcher
promptUserMessage: aString
  "One MCP prompt message: a user-role text content block."
  ^Dictionary new
    at: 'role' put: 'user';
    at: 'content' put: (Dictionary new at: 'type' put: 'text'; at: 'text' put: aString; yourself);
    yourself
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
category: 'prompts'
method: McpDispatcher
safeChangeTextFor: changeOrNil
  | lf header |
  lf := String with: Character lf.
  header := changeOrNil isNil ifTrue: [''] ifFalse: ['Change: ' , changeOrNil , lf , lf].
  ^header , 'Change existing code safely:

1. Baseline - run_test_class (or list_failing_tests) so you know the starting state is green.
2. Map impact - find_senders / find_references_to / find_implementors for everything you will touch.
3. Change - compile_method or compile_class_definition. Note: compile_class_definition refuses
   kernel classes and, on a shape change, recompiles the existing methods onto the new version by
   default.
4. Re-test - run_test_class / list_failing_tests. If red, abort and reconsider.
5. Confirm - status to check the final state.'
%
category: 'initialization'
method: McpDispatcher
setRegistry: aRegistry server: aServerOrNil
  toolRegistry := aRegistry.
  server := aServerOrNil.
  serverName := 'gemstone-mcp'.
  serverVersion := '0.1.0'.
  ^self
%
category: 'prompts'
method: McpDispatcher
tddTextFor: subjectOrNil
  | lf header |
  lf := String with: Character lf.
  header := subjectOrNil isNil ifTrue: [''] ifFalse: ['Goal: ' , subjectOrNil , lf , lf].
  ^header , 'A red/green TDD loop for GemStone via the MCP tools:

1. Locate - understand the target with describe_class, list_methods, get_method_source, and
   find_senders / find_implementors.
2. Red - add a failing test: compile_method a test... method onto a TestCase subclass, then
   run_test_class (or run_test_method) and confirm it FAILS.
3. Green - implement with compile_method until run_test_class passes.
4. Guard - run list_failing_tests to confirm nothing else regressed.
5. Commit - the mutating tools already commit on success; use status to confirm, or abort to back out.

Keep each red/green step small.'
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
  "The tools/call error envelope for a raised error: the human message in `content` text (as
   before), PLUS `structuredContent` {error:{kind,message}} so an agent can branch on the kind
   instead of parsing prose. Keeps using `ex description` for the message text."
  | msg d struct |
  msg := [ex description] on: Error do: [:e | ex messageText ifNil: ['(error)']].
  d := self contentText: msg isError: true.
  struct := Dictionary new.
  struct at: 'error' put: (Dictionary new
    at: 'kind' put: (self kindForError: ex);
    at: 'message' put: msg;
    yourself).
  d at: 'structuredContent' put: struct.
  ^d
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
category: 'prompts'
method: McpDispatcher
txHygieneText
  ^'Keep a clean GemStone transaction while working through the MCP tools:

1. status - see the user, session, stone, and whether there are uncommitted changes.
2. refresh - abort uncommitted work and update your view to the latest committed state. The server
   already aborts before every tool call, so you usually get a fresh view for free; call refresh
   explicitly when you specifically depend on other sessions'' latest commits.
3. Work: browse and search freely (describe_class, get_method_source, find_senders,
   search_method_source, ...). The mutating tools (compile_method, compile_class_definition,
   delete_class, delete_method, set_class_comment) COMMIT on success, so a successful change is
   already persisted.
4. If execute_code or a partial edit left uncommitted state you do NOT want, call abort to discard
   it, then status again to confirm uncommittedChanges is false.
5. When unsure whether in-progress state should persist, prefer abort - never leave a session with
   unintended uncommitted changes.'
%
