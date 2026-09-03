set compile_env: 0
! ------------------- Class definition for McpHttpConnection
expectvalue /Class
doit
Object subclass: 'McpHttpConnection'
  instVarNames: #( socket)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpHttpConnection comment: 
'Wraps a single accepted client GsSocket and speaks just enough HTTP/1.1 to serve
the MCP transport: read one request (request line + headers + Content-Length body)
and write a single application/json response with Connection: close. No keep-alive.

It also writes the standalone SSE stream (text/event-stream) McpRouter holds open for
server-to-client messages. Every write on that stream goes through #writeSse:, which waits for the
socket to be WRITABLE first: GsSocket>>write: suspends the calling GsProcess until the socket can
take the bytes and has no timeout of its own, so a client that stops reading would otherwise park
a stream''s GsProcess forever. Disconnection is reported the same way throughout -- a nil from a
write -- and #clientHasClosed spots it a poll earlier, on the read side.'
%
expectvalue /Class
doit
McpHttpConnection category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpHttpConnection
removeallmethods McpHttpConnection
removeallclassmethods McpHttpConnection
! ------------------- Class methods for McpHttpConnection
category: 'instance creation'
classmethod: McpHttpConnection
on: aSocket
  ^self new setSocket: aSocket
%
! ------------------- Instance methods for McpHttpConnection
category: 'reading'
method: McpHttpConnection
clientHasClosed
  "Whether the peer has gone away, detected on the READ side and without ever blocking.
   Needed because a write to a peer that closed normally SUCCEEDS into the socket buffer and only
   the next write sees the reset: on a stream whose only traffic is a keepalive every 15 seconds
   that leaves a dead client's socket and its GsProcess alive for up to two intervals. An
   established SSE stream is write-only -- the client sends nothing more on it -- so readable data
   means EOF, and anything else means junk we can ignore rather than a live request.
   readWillNotBlockWithin: 0 reports current readiness only, so this never suspends. An error from
   either send is itself a disconnect."
  | ready chunk |
  ready := [socket readWillNotBlockWithin: 0] on: Error do: [:ex | true].
  ready == true ifFalse: [^false].
  chunk := [socket readString: 4096] on: Error do: [:ex | nil].
  ^chunk isNil or: [chunk isEmpty]
%
category: 'closing'
method: McpHttpConnection
close
  socket ifNotNil: [socket close]
%
category: 'reading'
method: McpHttpConnection
parseHead: headString
  "Parse the request line + header lines (no trailing blank line) into a Dictionary."
  | lines reqLine parts headers req sep |
  sep := String with: Character cr with: Character lf.
  lines := headString subStrings: sep.
  req := Dictionary new.
  headers := Dictionary new.
  lines isEmpty
    ifTrue: [reqLine := '']
    ifFalse: [reqLine := lines at: 1].
  parts := reqLine subStrings: ' '.
  req at: 'method' put: (parts size >= 1 ifTrue: [parts at: 1] ifFalse: ['']).
  req at: 'path' put: (parts size >= 2 ifTrue: [parts at: 2] ifFalse: ['']).
  lines from: 2 to: lines size do: [:line |
    | colon key val |
    colon := line indexOf: $:.
    colon > 0 ifTrue: [
      key := (line copyFrom: 1 to: colon - 1) asLowercase trimSeparators.
      val := (line copyFrom: colon + 1 to: line size) trimSeparators.
      headers at: key put: val]].
  req at: 'headers' put: headers.
  ^req
%
category: 'reading'
method: McpHttpConnection
readRequest
  "Read one HTTP/1.1 request. Returns a Dictionary with keys
   'method' 'path' 'headers' (lowercased keys) and 'body', or nil on EOF/error/timeout.
   Bails (nil) if the client sends no data within the read timeout, so a stalled
   connection cannot wedge the single-threaded accept loop."
  | crlfcrlf buffer headEnd req contentLength body chunk timeout |
  crlfcrlf := String with: Character cr with: Character lf with: Character cr with: Character lf.
  timeout := 8000.
  buffer := String new.
  [(buffer indexOfSubCollection: crlfcrlf) = 0] whileTrue: [
    (socket readWillNotBlockWithin: timeout) == true ifFalse: [^nil].
    chunk := socket readString: 4096.
    (chunk isNil or: [chunk isEmpty]) ifTrue: [^nil].
    buffer := buffer , chunk.
    buffer size > 1048576 ifTrue: [^nil]].
  headEnd := buffer indexOfSubCollection: crlfcrlf.
  req := self parseHead: (buffer copyFrom: 1 to: headEnd - 1).
  body := buffer copyFrom: headEnd + 4 to: buffer size.
  contentLength := ((req at: 'headers') at: 'content-length' ifAbsent: ['0']) asNumber.
  [body size < contentLength] whileTrue: [
    (socket readWillNotBlockWithin: timeout) == true ifFalse: [^nil].
    chunk := socket readString: 4096.
    (chunk isNil or: [chunk isEmpty]) ifTrue: [^nil].
    body := body , chunk].
  req at: 'body' put: (body copyFrom: 1 to: (contentLength min: body size)).
  ^req
%
category: 'initialization'
method: McpHttpConnection
setSocket: aSocket
  socket := aSocket.
  ^self
%
category: 'writing-sse'
method: McpHttpConnection
sseWriteTimeoutMs
  "How long #writeSse: waits for a stalled stream to become writable before treating the client as
   gone. A full TCP window for five seconds on a connection carrying a keepalive and the odd
   notification means the peer has stopped reading, not that it is merely slow."
  ^5000
%
category: 'writing'
method: McpHttpConnection
writeJson: aJsonString
  "Write a 200 response carrying aJsonString as application/json."
  ^self writeJson: aJsonString sessionId: nil
%
category: 'writing'
method: McpHttpConnection
writeJson: aJsonString sessionId: anIdOrNil
  "Write a 200 JSON response, adding the MCP-Session-Id header when anIdOrNil is non-nil (the
   initialize response, so the client echoes the id on later requests)."
  ^self writeStatus: 200 reason: 'OK' body: aJsonString sessionId: anIdOrNil
%
category: 'writing-sse'
method: McpHttpConnection
writeSse: aFrameString
  "Write one complete SSE frame, but only once the socket can take it. GsSocket>>write: suspends
   the calling GsProcess until the socket is ready to write and has NO TIMEOUT, so a client that
   stops reading would park this stream's GsProcess indefinitely, holding a socket -- the write-side
   twin of the readWillNotBlockWithin: guard the accept loop already uses. A socket still not
   writable after #sseWriteTimeoutMs answers nil, which every caller already reads as a disconnect."
  (socket writeWillNotBlockWithin: self sseWriteTimeoutMs) == true ifFalse: [^nil].
  ^socket write: aFrameString
%
category: 'writing-sse'
method: McpHttpConnection
writeSseComment: aString
  "Write an SSE comment line -- ignored by the client, and what keeps a proxy or NAT table from
   dropping an idle stream. Returns nil if the write fails (e.g. the client disconnected)."
  | lf |
  lf := String with: Character lf.
  ^self writeSse: ': ' , aString , lf , lf
%
category: 'writing-sse'
method: McpHttpConnection
writeSseData: aJsonString
  "Write one SSE 'message' event carrying aJsonString. Returns nil on write failure.
   aJsonString is a byte String of UTF-8 from McpJson, which is what an event stream carries:
   text/event-stream is defined as UTF-8 and has no charset parameter to say otherwise. There is no
   Content-Length here to get wrong, but a wide string would still be written to the socket as
   whatever its raw storage happens to be, so the same invariant holds as for a framed response --
   the body reaching a socket is bytes."
  | lf |
  lf := String with: Character lf.
  ^self writeSse: 'event: message' , lf , 'data: ' , aJsonString , lf , lf
%
category: 'writing-sse'
method: McpHttpConnection
writeSseStreamHeaders
  "Begin a text/event-stream response (no Content-Length; the stream stays open).
   X-Accel-Buffering tells a reverse proxy -- nginx reads this one by name -- not to buffer the
   response. Without it a proxy may hold frames until it has accumulated some, which turns a
   progress tick into a progress tick that arrives with the answer and defeats the whole point. The
   draft revision SHOULDs it on any SSE response; where no proxy is in front, it is one ignored
   header.
   No MCP-Session-Id: the header exists so a client LEARNS its id from the initialize response, and
   a client opening a stream already has one."
  | crlf resp |
  crlf := String with: Character cr with: Character lf.
  resp := 'HTTP/1.1 200 OK' , crlf ,
    'Content-Type: text/event-stream' , crlf ,
    'Cache-Control: no-cache' , crlf ,
    'X-Accel-Buffering: no' , crlf ,
    'Connection: keep-alive' , crlf , crlf.
  ^socket write: resp
%
category: 'writing'
method: McpHttpConnection
writeStatus: code reason: reasonString body: aBodyString
  "Write a complete HTTP/1.1 response with no MCP-Session-Id header."
  ^self writeStatus: code reason: reasonString body: aBodyString sessionId: nil
%
category: 'writing'
method: McpHttpConnection
writeStatus: code reason: reasonString body: aBodyString sessionId: anIdOrNil
  "Write a JSON response, adding the MCP-Session-Id header when anIdOrNil is non-nil (the
   initialize response, so the client echoes the id on later requests)."
  | crlf hdr |
  crlf := String with: Character cr with: Character lf.
  hdr := anIdOrNil isNil ifTrue: [''] ifFalse: ['MCP-Session-Id: ' , anIdOrNil , crlf].
  ^self writeStatus: code reason: reasonString headers: hdr body: aBodyString
%
category: 'writing'
method: McpHttpConnection
writeStatus: code reason: reasonString headers: extraHeaders body: aBodyString
  "The single place a complete HTTP/1.1 JSON response is assembled. extraHeaders is a String of
   complete CRLF-terminated header lines (e.g. an MCP-Session-Id or WWW-Authenticate line), or ''
   for none.
   Content-Length is written as `aBodyString size`, and THAT REQUIRES aBodyString TO BE A byte
   String: a byte String's #size is its byte count, but a DoubleByteString of n characters is 2n
   bytes on the wire and a QuadByteString 4n, so a wide body here would announce a length a
   fraction of what followed it and every client would hang waiting for the rest. Every body
   reaching this method is rendered by McpJson, which encodes to UTF-8 BYTES rather than leaving
   characters for the transport (see its class comment), so the requirement is met by construction
   -- not by the body happening to be ASCII, which is what it used to rest on.
   No charset parameter on the Content-Type: RFC 8259 8.1 makes JSON UTF-8 by definition and the
   application/json media type defines no charset parameter, so `; charset=utf-8` would be noise a
   strict client is entitled to ignore."
  | crlf resp |
  crlf := String with: Character cr with: Character lf.
  resp := 'HTTP/1.1 ' , code printString , ' ' , reasonString , crlf ,
    'Content-Type: application/json' , crlf , extraHeaders ,
    'Content-Length: ' , aBodyString size printString , crlf ,
    'Connection: close' , crlf , crlf , aBodyString.
  ^socket write: resp
%
