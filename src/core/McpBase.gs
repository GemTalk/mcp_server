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
   aString is WIRE BYTES, straight off the socket, and the two sends before the parse are the whole
   of gs-mcp''s Unicode handling.
   #decodeFromUTF8, because JSON is UTF-8 on the wire (RFC 8259 8.1) while JsonParser takes a
   CHARACTER string, with nothing in its API to say which of the two it wants. Without the decode
   every byte was read as one Latin-1 character: a pound sign or a degree sign arrived as two
   characters, echoed back as mojibake, and compile_method wrote that into the image to stay. Every
   client that emits raw UTF-8 rather than escapes is affected, which is JSON.stringify and
   therefore most of them. It also decodes an emoji correctly, since a raw-UTF-8 body needs no
   surrogate pair -- only a \u-escaping client trips the parser defect below.
   #asString, because #decodeFromUTF8 answers the UNICODE family (Unicode7/16/32), and on an image
   whose #StringConfiguration is String -- the default, and every stock image -- comparing one of
   those to a String RAISES rather than answering false. A Dictionary keyed by them would raise on
   every `args at: ''code''` in every toolset. #asString narrows by content to String,
   DoubleByteString or QuadByteString, all of which compare with a String literal correctly, and it
   answers the RECEIVER ITSELF when given a String, so it costs nothing on an ASCII body. Measured
   identical on 3.6.2, 3.7.2, 3.7.5 and 3.7.6.
   It is belt-and-braces, and worth keeping anyway. Measured: JsonParser launders the family by
   itself -- it accumulates each string into a `String new`, so keys and values come back legacy
   whatever class it was handed -- so dropping #asString would not break anything TODAY. But that
   is an implementation detail of a kernel method gs-mcp does not own (one `species new` in
   JsonParser>>string and Unicode strings would flow straight through), and it costs one identity
   send on the common path. Nothing downstream should have to reason about the parser''s internals
   to know what family it is holding.
   The trap is also narrower than it looks, which is why this is two sends and not a decoder:
   #StringConfiguration drives BOTH halves of it. Set to Unicode16, it makes strings widen to
   Unicode16 AND has GsCurrentSession>>initialize install unicode-aware #= for String and the
   Unicode classes alike -- so the hostile pairing, Unicode strings plus a comparison that raises,
   cannot arise in a session. gs-mcp does not depend on that either way.
   A MALFORMED SEQUENCE REFUSES THE WHOLE BODY. #decodeFromUTF8 raises on a truncated sequence, a
   bad continuation byte, an overlong encoding (16rC0 16rAF is the classic smuggled ''/'') or an
   encoded surrogate, naming the byte offset, and the catch-all below turns that into the -32700.
   That is the intended policy: a client whose encoder is broken is told so, rather than having one
   U+FFFD substituted into text this server would then store.
   This is the ONLY parse on the request path, and it serves both sides of the worker boundary: the
   front end parses the body to classify it (McpRouter>>servePost:) and then forwards the SAME RAW
   BYTES to the worker gem, which parses them again here. Nothing re-encodes in between, so the two
   decodes cannot disagree. It follows that aString must be a byte String: the callers that hand us
   a string gs-mcp itself produced (the router''s own config, the worker''s toolset options) pass
   ASCII, and a wide string would not understand #decodeFromUTF8 at all.
   WHAT THE KERNEL PARSER STILL GETS WRONG, left alone on purpose. It has no surrogate-pair
   decoding, so a client that escapes an emoji instead of sending it raw -- which Python''s
   json.dumps does by default -- fails its whole request with a -32700; an escape the parser does
   not recognize is silently dropped rather than refused; and trailing content, duplicate keys and
   raw control characters are all accepted. Those are kernel defects, measured in the kernel JSON
   Unicode report and awaiting a kernel fix, rather than ones gs-mcp works around: the codec that
   did work around them is preserved on the emoji-safe branch.
   Cross-version: 3.7.x''s JsonParser raises on bad input, but 3.6.2''s (PetitParser-based) returns a
   PPFailure instead of raising -- so reject any non-Dictionary result, not just exceptions. The
   catch-all stays because turning every rejection into one -32700 is this method''s job.

   BOTH class- and instance-side, with the class-side as the single implementation, because the
   worker bootstrap that parses the deployment''s toolset options
   (McpServer class>>prepareWorkerWithToolsets:options:...) runs before any server instance exists.
   Same arrangement, and same reason, as the shared helpers on McpToolset."
  (aString isNil or: [aString isEmpty]) ifTrue: [^nil].
  ^[ | parsed |
     parsed := JsonParser parse: aString decodeFromUTF8 asString.
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
   #McpJson write:.
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
   #McpJson write:. The answer does NOT come back on the stream: a client replies by POSTing a
   JSON-RPC response to /mcp, which is why McpRouter keeps a pending-request table and why
   servePost: has to recognize a body with an id and no method."
  | d |
  d := self notification: aMethodString params: aDictOrNil.
  d at: 'id' put: anId.
  ^d
%
