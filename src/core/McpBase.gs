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

Deliberately no log-level machinery any more. The RFC 5424 severities lived here to serve
notifications/message, which carried the front end''s idle and session-ending warnings; those are
gone (McpRouter), the logging capability that licensed them is undeclared (McpDispatcher), and the
draft revision prohibits an unsolicited notifications/message outright.
#log: is unrelated despite the name: it writes to the gem''s own log file, never to a client.'
%
expectvalue /Class
doit
McpBase category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpBase
removeallmethods McpBase
removeallclassmethods McpBase
! ------------------- Class methods for McpBase
category: 'private'
classmethod: McpBase
parseBody: aString
  "Parse a JSON-RPC request body to its Dictionary, or nil if empty/malformed. A valid JSON-RPC
   request is always an object, so nil here -> a -32700 Parse error.
   aString is WIRE BYTES, straight off the socket, which is why this goes through McpJson's
   #parseWire: and not its #parse: -- it decodes UTF-8 before parsing. Without that a client
   sending raw UTF-8 (which is every real one; only an escaping encoder like Python's json.dumps
   avoids it) had each byte read as one Latin-1 character, so text arrived corrupted and was stored
   corrupted. ASCII decodes to itself, so the callers that hand us a string gs-mcp produced -- the
   router's own config, the worker's toolset options -- are unaffected by the decode.
   This is the ONLY parse on the request path, and it serves both sides of the worker boundary: the
   front end parses the body to classify it (McpRouter>>servePost:) and then forwards the SAME RAW
   BYTES to the worker gem, which parses them again here. Nothing re-encodes in between, so the two
   decodes cannot disagree.
   McpJson replaces kernel JsonParser, which mishandled Unicode three ways and differed by version
   while doing it -- see the McpJson class comment. The result-shape check and the catch-all stay:
   the check because a JSON-RPC request that parses to anything but an object is still not a
   request, and the catch-all because turning every rejection into one -32700 is this method's job.

   BOTH class- and instance-side, with the class-side as the single implementation, because the
   worker bootstrap that parses the deployment's toolset options
   (McpServer class>>prepareWorkerWithToolsets:options:...) runs before any server instance exists.
   Same arrangement, and same reason, as the shared helpers on McpToolset."
  (aString isNil or: [aString isEmpty]) ifTrue: [^nil].
  ^[ | parsed |
     parsed := McpJson parseWire: aString.
     (parsed isKindOf: Dictionary) ifTrue: [parsed] ifFalse: [nil] ]
   on: Error do: [:ex | nil]
%
! ------------------- Instance methods for McpBase
category: 'private'
method: McpBase
log: aString
  "Best-effort logging to the gem's log file; never fails the caller.
   Every line is stamped. A log without times cannot be lined up against anything else that
   happened on the host -- a suspend, a wake, a client reconnect -- which is most of what these
   lines are for: the interesting events here are ones this gem did not cause and cannot see.
   The stamp falls back to the GMT epoch if DateTime is unavailable, since this server is meant to
   run on as many GemStone versions as will have it, and a timeless line still beats no line."
  | stamp |
  stamp := [DateTime now printString] on: Error do: [:ex | System timeGmt printString].
  [GsFile gciLogServer: stamp , '  ' , aString] on: Error do: [:ex | nil]
%
category: 'json-rpc'
method: McpBase
notification: aMethodString params: aDictOrNil
  "A JSON-RPC notification (no id, so no answer is expected) as a Dictionary, ready for
   McpJson>>write:.
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
  ^self class parseBody: aString
%
category: 'formatting'
method: McpBase
phraseForSeconds: aSeconds
  "An interval as a phrase -- '30 minutes', '1 minute', '90 seconds'. Minutes only where the
   interval is whole minutes and there is more than one of them, because 'over 1 minutes' and
   'over 1 minutes' rounded down from 90 seconds are both worse than saying the seconds. Where this
   names a CONFIGURED interval (the notice a reaped client is sent) it is often the only account of
   a reap an operator ever sees, so it should say a number they can find in their own configuration.

   Shared rather than the router's alone: the router phrases a bound it has configured, and the
   worker phrases the time left against one (McpServer>>lifetimeNote), and the two must not drift
   into describing the same interval differently."
  | minutes |
  minutes := aSeconds // 60.
  ((minutes > 1) and: [minutes * 60 = aSeconds]) ifTrue: [^minutes printString , ' minutes'].
  aSeconds = 60 ifTrue: [^'1 minute'].
  ^aSeconds printString , ' seconds'
%
category: 'json-rpc'
method: McpBase
request: aMethodString params: aDictOrNil id: anId
  "A JSON-RPC request (it carries an id, so the receiver MUST answer) as a Dictionary, ready for
   McpJson>>write:. The answer does NOT come back on the stream: a client replies by POSTing a JSON-RPC
   response to /mcp, which is why McpRouter keeps a pending-request table and why servePost: has
   to recognize a body with an id and no method."
  | d |
  d := self notification: aMethodString params: aDictOrNil.
  d at: 'id' put: anId.
  ^d
%
