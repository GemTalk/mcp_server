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
combineSurrogateEscapesIn: aString
  "Answer aString with each SURROGATE PAIR ESCAPE replaced by the one character it denotes, and the
   RECEIVER ITSELF when there is none -- which is every request from every client that sends
   non-ASCII raw rather than escaped, and so very nearly all of them.
   THE DEFECT THIS ANSWERS is inbound, and the one kernel JSON defect gs-mcp still meets in the
   wild. RFC 8259 7 gives JSON exactly one way to escape a character above U+FFFF: the UTF-16
   surrogate pair. JsonParser>>string sends `Character codePoint:` to each \uXXXX escape
   separately, with no test for the surrogate range and no lookahead for the second half, and
   3.7.x refuses to construct a surrogate -- so an escaped emoji fails the WHOLE request with a
   -32700, and a BMP escape from the same client works, which makes the failure look arbitrary from
   outside. On 3.6.2 it is worse than a refusal: surrogates are legal Characters there, so the
   parser silently builds two of them.
   WHO SENDS THIS. Any encoder that escapes rather than emitting raw UTF-8 -- notably Python's
   json.dumps, where ensure_ascii=True is the DEFAULT. Such a client cannot put an emoji anywhere
   in a request.
   FORTY LINES, NOT A PARSER. This is the whole reason gs-mcp can own a writer and still keep
   kernel JsonParser: the inbound defect is repairable BEFORE the parse, because the information is
   still there in the escapes. The outbound one is not (McpJson's class comment, and section 7 of
   the kernel JSON Unicode report) -- by the time asJson has answered, the codepoint is gone. So
   this is a transcode at the edge, not a second grammar to maintain.
   AN UNPAIRED HALF BECOMES U+FFFD, high or low, rather than reaching `Character codePoint:` and
   surfacing as an OutOfRange from three layers down. That is what a decoder is required to
   substitute anyway, and it is the same policy McpJson applies on the way out. It is deliberately
   NOT the refusal policy #parseBody: applies to malformed UTF-8: a bad byte sequence means the
   client's ENCODER is broken and nothing it sent can be trusted, whereas a lone surrogate escape
   is one bad character in an otherwise well-formed document.
   BACKSLASH PARITY IS TRACKED, and it has to be: a body may legitimately CONTAIN the six
   characters of an escape as text -- a compile_method source describing this very defect would --
   and it arrives doubled, as \ \ u D 8 3 D. A scanner that just looked for `\u` would rewrite
   that and corrupt the source. Stepping two characters past every backslash-escape handles it
   without a special case: the pair is consumed together, so the `u` after it is reached as an
   ordinary character.
   No in-string tracking, and none is needed: in valid JSON a backslash appears only inside a
   string, and a document with one anywhere else is rejected by the parser whatever this does to it.
   THE FAST PATH IS ONE PRIMITIVE. #findString:startingAt: over the body is measured at 0.05ms for
   63KB, against 3.6ms for a Smalltalk character loop over the same bytes -- 70x, and the reason the
   scan below is only entered when there is something to find. (#findString: is case-sensitive,
   unlike #includesString:, which is what is wanted: \U is not a legal JSON escape.)
   Answers through #asString so the result comes back in the byte/DoubleByteString/QuadByteString
   family: `WriteStream on: String new` widens to Unicode32 where #StringConfiguration is Unicode16
   (Grail sets this), and nothing downstream should have to hold a Unicode-family string."
  | out i size backslash |
  backslash := Character codePoint: 92.
  (aString findString: (String with: backslash) , 'u' startingAt: 1) = 0 ifTrue: [^aString].
  out := nil.
  i := 1.
  size := aString size.
  [i <= size] whileTrue: [
    | hi lo |
    hi := ((aString at: i) == backslash and: [i < size and: [(aString at: i + 1) == $u]])
      ifTrue: [self hexUnitIn: aString at: i + 2]
      ifFalse: [nil].
    (hi notNil and: [hi >= 16rD800 and: [hi <= 16rDFFF]])
      ifTrue: [
        lo := (hi <= 16rDBFF and: [i + 11 <= size
              and: [(aString at: i + 6) == backslash and: [(aString at: i + 7) == $u]]])
          ifTrue: [self hexUnitIn: aString at: i + 8]
          ifFalse: [nil].
        out isNil ifTrue: [
          out := WriteStream on: String new.
          out nextPutAll: (aString copyFrom: 1 to: i - 1)].
        (lo notNil and: [lo >= 16rDC00 and: [lo <= 16rDFFF]])
          ifTrue: [
            out nextPut: (Character codePoint:
              16r10000 + ((hi - 16rD800) bitShift: 10) + (lo - 16rDC00)).
            i := i + 12]
          ifFalse: [
            out nextPut: (Character codePoint: 16rFFFD).
            i := i + 6]]
      ifFalse: [ | step |
        step := ((aString at: i) == backslash and: [i < size]) ifTrue: [2] ifFalse: [1].
        out isNil ifFalse: [out nextPutAll: (aString copyFrom: i to: i + step - 1)].
        i := i + step]].
  ^out isNil ifTrue: [aString] ifFalse: [out contents asString]
%
category: 'private'
classmethod: McpBase
hexUnitIn: aString at: anIndex
  "The value of the four hex digits at anIndex, or nil when there are not four hex digits there.
   nil means 'not an escape this understands', and #combineSurrogateEscapesIn: then copies the
   escape through untouched for the parser to make of what it will -- this method's job is to
   recognize a surrogate pair, not to validate JSON."
  | value |
  anIndex + 3 > aString size ifTrue: [^nil].
  value := 0.
  anIndex to: anIndex + 3 do: [:j |
    | codePoint digit |
    codePoint := (aString at: j) codePoint.
    digit := (codePoint >= 48 and: [codePoint <= 57])
      ifTrue: [codePoint - 48]
      ifFalse: [(codePoint >= 65 and: [codePoint <= 70])
        ifTrue: [codePoint - 55]
        ifFalse: [(codePoint >= 97 and: [codePoint <= 102])
          ifTrue: [codePoint - 87]
          ifFalse: [^nil]]].
    value := value * 16 + digit].
  ^value
%
category: 'private'
classmethod: McpBase
parseBody: aString
  "Parse a JSON-RPC request body to its Dictionary, or nil if empty/malformed. A valid JSON-RPC
   request is always an object, so nil here -> a -32700 Parse error.
   aString is WIRE BYTES, straight off the socket, and the three sends before the parse are the
   whole of gs-mcp''s INBOUND Unicode handling. The outbound half is McpJson.
   #decodeFromUTF8, because JSON is UTF-8 on the wire (RFC 8259 8.1) while JsonParser takes a
   CHARACTER string, with nothing in its API to say which of the two it wants. Without the decode
   every byte was read as one Latin-1 character: a pound sign or a degree sign arrived as two
   characters, echoed back as mojibake, and compile_method wrote that into the image to stay. Every
   client that emits raw UTF-8 rather than escapes is affected, which is JSON.stringify and
   therefore most of them. It also decodes an emoji correctly, since a raw-UTF-8 body needs no
   surrogate pair at all.
   #asString, because #decodeFromUTF8 answers the UNICODE family (Unicode7/16/32), and on an image
   whose #StringConfiguration is String -- the default, and every stock image -- comparing one of
   those to a String RAISES rather than answering false. A Dictionary keyed by them would raise on
   every `args at: ''code''` in every toolset. #asString narrows by content to String,
   DoubleByteString or QuadByteString, all of which compare with a String literal correctly, and it
   answers the RECEIVER ITSELF when given a String, so it costs nothing on an ASCII body. Measured
   identical on 3.6.2, 3.7.2, 3.7.5 and 3.7.6.
   It is load-bearing here rather than belt-and-braces, and this is measured: JsonParser does NOT
   launder the family by itself. Handed a Unicode32 source on a #StringConfiguration of Unicode16 it
   accumulates values as Unicode32 -- so what comes out is whatever went in, and narrowing has to
   happen BEFORE the parse, which is where it is. Nothing downstream should have to reason about a
   kernel parser''s accumulator to know what family it is holding.
   (An earlier version of this comment claimed the parser always answered legacy strings. It does
   for a byte source, which is every ASCII body, and that is why the claim survived so long.)
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
   #combineSurrogateEscapesIn:, because JsonParser sends `Character codePoint:` to each \uXXXX
   escape on its own and 3.7.x refuses a surrogate, so an emoji ESCAPED as a surrogate pair failed
   the whole request with a -32700. Python''s json.dumps escapes by default, so that is a real
   client, not a hypothetical one. See that method for why forty lines at the edge can answer an
   inbound defect where the outbound one needed a writer. Its fast path is one primitive search, so
   a body with no escape in it pays 0.05ms per 63KB.
   WHAT THE KERNEL PARSER STILL GETS WRONG, left alone on purpose: an escape it does not recognize
   is silently dropped rather than refused, and trailing content, duplicate keys and raw control
   characters are all accepted. Those need a real parser to fix, they are measured in the kernel
   JSON Unicode report and awaiting a kernel fix, and none of them corrupts text -- the worst a
   client gets is one wrong value from a request its own encoder built wrong. The codec that did
   answer them all is preserved on the emoji-safe branch.
   Cross-version: 3.7.x''s JsonParser raises on bad input, but 3.6.2''s (PetitParser-based) returns a
   PPFailure instead of raising -- so reject any non-Dictionary result, not just exceptions. The
   catch-all stays because turning every rejection into one -32700 is this method''s job.

   BOTH class- and instance-side, with the class-side as the single implementation, because the
   worker bootstrap that parses the deployment''s toolset options
   (McpServer class>>prepareWorkerWithToolsets:options:...) runs before any server instance exists.
   Same arrangement, and same reason, as the shared helpers on McpToolset."
  (aString isNil or: [aString isEmpty]) ifTrue: [^nil].
  ^[ | parsed |
     parsed := JsonParser parse: (self combineSurrogateEscapesIn: aString decodeFromUTF8 asString).
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
