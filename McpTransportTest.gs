set compile_env: 0
! ------------------- Class definition for McpTransportTest
expectvalue /Class
doit
GsTestCase subclass: 'McpTransportTest'
  instVarNames: #( server)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
! ------------------- Remove existing behavior from McpTransportTest
removeallmethods McpTransportTest
removeallclassmethods McpTransportTest
! ------------------- Class methods for McpTransportTest
! ------------------- Instance methods for McpTransportTest
category: 'helpers'
method: McpTransportTest
bodyOf: response
  "The body bytes of an HTTP response (everything after the blank line)."
  | sep idx |
  sep := self crlf , self crlf.
  idx := response indexOfSubCollection: sep.
  ^idx = 0 ifTrue: [''] ifFalse: [response copyFrom: idx + 4 to: response size]
%
category: 'helpers'
method: McpTransportTest
crlf
  ^String with: Character cr with: Character lf
%
category: 'helpers'
method: McpTransportTest
includesCS: aSubstring in: aString
  "Case-sensitive substring test. GemStone's String>>includesString: is case-INsensitive
   (e.g. 'FAIL' matches the 'fail' in 'failed'), so use findString:startingAt: (which is
   case-sensitive) for assert:/deny: substring checks."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'helpers'
method: McpTransportTest
postRequest: body
  "A raw HTTP POST /mcp request carrying body as application/json (no Origin header)."
  ^self postRequest: body origin: nil
%
category: 'helpers'
method: McpTransportTest
postRequest: body origin: originOrNil
  "A raw HTTP POST /mcp request as application/json, with an optional Origin header (nil = none)."
  | crlf originLine |
  crlf := self crlf.
  originLine := originOrNil isNil ifTrue: [''] ifFalse: ['Origin: ' , originOrNil , crlf].
  ^'POST /mcp HTTP/1.1' , crlf , 'Host: localhost' , crlf , originLine ,
   'Content-Type: application/json' , crlf ,
   'Content-Length: ' , body size printString , crlf , crlf , body
%
category: 'helpers'
method: McpTransportTest
runRequest: rawRequest
  "Drive handleConnection: with rawRequest; answer the mock (whose #output holds the
   captured response). Named runRequest: (NOT run:) to avoid shadowing TestCase>>run:."
  ^self runRequest: rawRequest chunkSize: 1000000
%
category: 'helpers'
method: McpTransportTest
runRequest: rawRequest chunkSize: n
  "The router is a stack local so the framework's between-test instance-variable
   nilling cannot disturb it."
  | mock |
  mock := McpMockSocket on: rawRequest chunkSize: n.
  McpRouter new handleConnection: (McpHttpConnection on: mock).
  ^mock
%
category: 'running'
method: McpTransportTest
setUp
  "No per-test state: each helper builds its own server as a stack local."
  ^self
%
category: 'helpers'
method: McpTransportTest
simpleRequest: httpMethod
  "A raw HTTP request with the given verb, no body."
  | crlf |
  crlf := self crlf.
  ^httpMethod , ' /mcp HTTP/1.1' , crlf , 'Host: localhost' , crlf , crlf
%
category: 'tests'
method: McpTransportTest
testAbsentOriginServed
  "No Origin header (non-browser clients like curl / Claude Code) passes the check -- routed, not 403."
  | out |
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' origin: nil)) output.
  self deny: (self includesCS: '403' in: out).
  self assert: (self includesCS: '-32600' in: out)
%
category: 'tests'
method: McpTransportTest
testChunkedDeliveryParses
  "Even when the request arrives a few bytes at a time, readRequest must reassemble it. Uses a
   session-less tools/list so no worker gem is spawned -- the routed -32600 proves the body was
   reassembled and dispatched."
  | out |
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":3,"method":"tools/list"}') chunkSize: 7) output.
  self assert: (self includesCS: '-32600' in: out)
%
category: 'tests'
method: McpTransportTest
testContentLengthMatchesBody
  | out body lines clenLine clenValue |
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":4,"method":"tools/list"}')) output.
  body := self bodyOf: out.
  lines := out subStrings: self crlf.
  clenLine := lines detect: [:l | (l asLowercase indexOfSubCollection: 'content-length:') = 1] ifNone: [nil].
  self deny: clenLine isNil.
  clenValue := (clenLine copyFrom: (clenLine indexOf: $:) + 1 to: clenLine size) trimSeparators asNumber.
  self assert: clenValue equals: body size
%
category: 'tests'
method: McpTransportTest
testDeleteReturns200
  self assert: (self includesCS: 'HTTP/1.1 200 OK' in: (self runRequest: (self simpleRequest: 'DELETE')) output)
%
category: 'tests'
method: McpTransportTest
testEofClosesConnectionWithoutResponse
  | mock |
  mock := McpMockSocket on: ''.
  McpRouter new handleConnection: (McpHttpConnection on: mock).
  self assert: mock isClosed.
  self assert: mock output isEmpty
%
category: 'tests'
method: McpTransportTest
testForeignOriginReturns403
  "A non-loopback Origin (DNS-rebinding attempt) is refused with 403 before any routing."
  | out |
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' origin: 'http://evil.example.com')) output.
  self assert: (self includesCS: 'HTTP/1.1 403 Forbidden' in: out)
%
category: 'tests'
method: McpTransportTest
testGetOpensSseStream
  | out |
  out := (self runRequest: (self simpleRequest: 'GET')) output.
  self assert: (self includesCS: 'text/event-stream' in: out).
  self assert: (self includesCS: ': connected' in: out)
%
category: 'tests'
method: McpTransportTest
testLoopbackOriginServed
  "A loopback Origin passes the DNS-rebinding check, so the request is routed (session-less
   tools/list -> the routed -32600, NOT a 403)."
  | out |
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' origin: 'http://localhost:3000')) output.
  self deny: (self includesCS: '403' in: out).
  self assert: (self includesCS: '-32600' in: out)
%
category: 'tests'
method: McpTransportTest
testMalformedBodyReturnsParseError
  | out |
  out := (self runRequest: (self postRequest: 'this is not json')) output.
  self assert: (self includesCS: 'HTTP/1.1 400 Bad Request' in: out).
  self assert: (self includesCS: '-32700' in: out)
%
category: 'tests'
method: McpTransportTest
testPostWithoutSessionReturnsError
  "A non-initialize POST with no MCP-Session-Id is refused with a JSON-RPC error, and no worker
   gem is spawned. initialize + a routed tool call require a real worker session, so they are
   exercised end-to-end by the integration test (test.sh) rather than here."
  | out |
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')) output.
  self assert: (self includesCS: 'HTTP/1.1 400 Bad Request' in: out).
  self assert: (self includesCS: '-32600' in: out).
  self assert: (self includesCS: 'MCP-Session-Id' in: out)
%
category: 'tests'
method: McpTransportTest
testSessionIdIsRandomHex
  "Session ids are cryptographically-random 128-bit tokens (32 hex chars), not sequential.
   nextSessionId reads `sessions` (empty on a fresh router) and spawns no worker gem."
  | r a b |
  r := McpRouter new.
  a := r nextSessionId.
  b := r nextSessionId.
  self assert: a size equals: 32.
  self deny: a = b.
  self assert: ((a asUppercase reject: [:c | '0123456789ABCDEF' includes: c]) isEmpty)
%
category: 'tests'
method: McpTransportTest
testUnknownVerbReturns405
  self assert: (self includesCS: '405 Method Not Allowed' in: (self runRequest: (self simpleRequest: 'PUT')) output)
%
