"
Wraps a single accepted client GsSocket and speaks just enough HTTP/1.1 to serve
the MCP transport: read one request (request line + headers + Content-Length body)
and write a single application/json response with Connection: close. No keep-alive.
"
Class {
	#name : 'McpHttpConnection',
	#superclass : 'Object',
	#instVars : [
		'socket'
	],
	#category : 'Mcp-Core'
}

{ #category : 'instance creation' }
McpHttpConnection class >> on: aSocket [
  ^self new setSocket: aSocket

]

{ #category : 'closing' }
McpHttpConnection >> close [
  socket ifNotNil: [socket close]

]

{ #category : 'reading' }
McpHttpConnection >> parseHead: headString [
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

]

{ #category : 'reading' }
McpHttpConnection >> readRequest [
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

]

{ #category : 'initialization' }
McpHttpConnection >> setSocket: aSocket [
  socket := aSocket.
  ^self

]

{ #category : 'writing' }
McpHttpConnection >> writeJson: aJsonString [
  "Write a 200 response carrying aJsonString as application/json."
  ^self writeJson: aJsonString sessionId: nil

]

{ #category : 'writing' }
McpHttpConnection >> writeJson: aJsonString sessionId: anIdOrNil [
  "Write a 200 JSON response, adding the MCP-Session-Id header when anIdOrNil is non-nil (the
   initialize response, so the client echoes the id on later requests)."
  ^self writeStatus: 200 reason: 'OK' body: aJsonString sessionId: anIdOrNil

]

{ #category : 'writing-sse' }
McpHttpConnection >> writeSseComment: aString [
  "Write an SSE comment line (used for keepalives). Returns nil if the write fails
   (e.g. the client disconnected)."
  | lf |
  lf := String with: Character lf.
  ^socket write: ': ' , aString , lf , lf

]

{ #category : 'writing-sse' }
McpHttpConnection >> writeSseData: aJsonString [
  "Write one SSE 'message' event carrying aJsonString. Returns nil on write failure."
  | lf |
  lf := String with: Character lf.
  ^socket write: 'event: message' , lf , 'data: ' , aJsonString , lf , lf

]

{ #category : 'writing-sse' }
McpHttpConnection >> writeSseStreamHeaders [
  "Begin a text/event-stream response (no Content-Length; the stream stays open)."
  | crlf resp |
  crlf := String with: Character cr with: Character lf.
  resp := 'HTTP/1.1 200 OK' , crlf ,
    'Content-Type: text/event-stream' , crlf ,
    'Cache-Control: no-cache' , crlf ,
    'Connection: keep-alive' , crlf , crlf.
  ^socket write: resp

]

{ #category : 'writing' }
McpHttpConnection >> writeStatus: code reason: reasonString body: aBodyString [
  "Write a complete HTTP/1.1 response with no MCP-Session-Id header."
  ^self writeStatus: code reason: reasonString body: aBodyString sessionId: nil

]

{ #category : 'writing' }
McpHttpConnection >> writeStatus: code reason: reasonString body: aBodyString sessionId: anIdOrNil [
  "Write a JSON response, adding the MCP-Session-Id header when anIdOrNil is non-nil (the
   initialize response, so the client echoes the id on later requests)."
  | crlf hdr |
  crlf := String with: Character cr with: Character lf.
  hdr := anIdOrNil isNil ifTrue: [''] ifFalse: ['MCP-Session-Id: ' , anIdOrNil , crlf].
  ^self writeStatus: code reason: reasonString headers: hdr body: aBodyString

]

{ #category : 'writing' }
McpHttpConnection >> writeStatus: code reason: reasonString headers: extraHeaders body: aBodyString [
  "The single place a complete HTTP/1.1 JSON response is assembled. extraHeaders is a String of
   complete CRLF-terminated header lines (e.g. an MCP-Session-Id or WWW-Authenticate line), or ''
   for none. Content-Length is the byte size of the body; GemStone Strings are byte-oriented, so
   for ASCII/UTF-8 JSON size = byte count."
  | crlf resp |
  crlf := String with: Character cr with: Character lf.
  resp := 'HTTP/1.1 ' , code printString , ' ' , reasonString , crlf ,
    'Content-Type: application/json' , crlf , extraHeaders ,
    'Content-Length: ' , aBodyString size printString , crlf ,
    'Connection: close' , crlf , crlf , aBodyString.
  ^socket write: resp

]
