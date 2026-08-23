set compile_env: 0
! ------------------- Class definition for McpBase
expectvalue /Class
doit
Object subclass: 'McpBase'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpBase comment: 
'Abstract superclass for the native MCP server pair: the front end McpRouter (HTTP transport +
per-client session routing) and the per-client worker McpServer (JSON-RPC dispatch + tools).
Holds only what both roles share, and nothing that belongs to either. Not instantiated directly.

Two groups. Reading a request: #parseBody: and best-effort #log:.

Writing a server-INITIATED message: #notification:params: and #request:params:id:, which build the
JSON-RPC envelopes for messages the server sends first -- down the standalone SSE stream rather
than as an answer to anything. They are here because McpRouter needs them and cannot borrow
McpDispatcher''s: the dispatcher lives only in the worker gem, one GCI call away, and the router
cannot ask a worker that is busy running a tool to build an envelope for it. Deliberately no
RESPONSE builder: the router never sends a JSON-RPC response on the stream (the spec forbids it,
resumption replay aside), and duplicating McpDispatcher''s would invite it to.

The RFC 5424 log levels the MCP logging utility uses (#logLevelNames and friends) live here too --
the router filters notifications/message by the level a session asked for, and the worker''s
dispatcher validates logging/setLevel against the same list.'
%
expectvalue /Class
doit
McpBase category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpBase
removeallmethods McpBase
removeallclassmethods McpBase
! ------------------- Class methods for McpBase
category: 'log levels'
classmethod: McpBase
isLogLevel: aString
  "Whether aString is one of the MCP logging utility's levels. What logging/setLevel validates
   against."
  ^self logLevelNames includes: aString
%
category: 'log levels'
classmethod: McpBase
logLevelNames
  "The eight RFC 5424 severities the MCP logging utility uses, in ASCENDING severity -- the order
   IS the data: #logLevelRank: is an index into it, and a message is sent only when its rank is at
   least the rank of the level the client asked for."
  ^#( 'debug' 'info' 'notice' 'warning' 'error' 'critical' 'alert' 'emergency' )
%
category: 'log levels'
classmethod: McpBase
logLevelRank: aString
  "aString's severity as a number, or nil if it names no level."
  | i |
  i := self logLevelNames indexOf: aString.
  ^i = 0 ifTrue: [nil] ifFalse: [i]
%
! ------------------- Instance methods for McpBase
category: 'private'
method: McpBase
log: aString
  "Best-effort logging to the gem's log file; never fails the caller."
  [GsFile gciLogServer: aString] on: Error do: [:ex | nil]
%
category: 'json-rpc'
method: McpBase
logNotification: aString level: aLevelString
  "A notifications/message envelope (the MCP logging utility) carrying aString at an RFC 5424
   level. This is the sanctioned generic carrier for anything the server wants to say
   unprompted: MCP has no dedicated method for 'your session is about to end', and inventing one
   would only produce a message every client ignores.
   'logger' names the subsystem so a client can filter without parsing the text."
  | p |
  p := Dictionary new.
  p at: 'level' put: aLevelString.
  p at: 'logger' put: 'mcp.session'.
  p at: 'data' put: aString.
  ^self notification: 'notifications/message' params: p
%
category: 'json-rpc'
method: McpBase
notification: aMethodString params: aDictOrNil
  "A JSON-RPC notification (no id, so no answer is expected) as a Dictionary, ready for #asJson.
   A nil params is left OUT rather than sent as null."
  | d |
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'method' put: aMethodString.
  aDictOrNil ifNotNil: [:p | d at: 'params' put: p].
  ^d
%
category: 'private'
method: McpBase
parseBody: aString
  "Parse a JSON-RPC request body to its Dictionary, or nil if empty/malformed.
   Cross-version: GS 3.7.x's JsonParser raises on bad input, but 3.6.2's (PetitParser-based)
   returns a PPFailure instead of raising -- so reject any non-Dictionary result, not just
   exceptions. A valid JSON-RPC request is always an object, so nil here -> a -32700 Parse error."
  (aString isNil or: [aString isEmpty]) ifTrue: [^nil].
  ^[ | parsed |
     parsed := JsonParser parse: aString.
     (parsed isKindOf: Dictionary) ifTrue: [parsed] ifFalse: [nil] ]
   on: Error do: [:ex | nil]
%
category: 'json-rpc'
method: McpBase
request: aMethodString params: aDictOrNil id: anId
  "A JSON-RPC request (it carries an id, so the receiver MUST answer) as a Dictionary, ready for
   #asJson. The answer does NOT come back on the stream: a client replies by POSTing a JSON-RPC
   response to /mcp, which is why McpRouter keeps a pending-request table and why servePost: has
   to recognize a body with an id and no method."
  | d |
  d := self notification: aMethodString params: aDictOrNil.
  d at: 'id' put: anId.
  ^d
%
