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
expectvalue /Class
doit
McpTransportTest category: 'Mcp-Tests'
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
postRequest: body protocolVersion: versionOrNil
  "A raw HTTP POST /mcp request as application/json, with an optional MCP-Protocol-Version header."
  | crlf verLine |
  crlf := self crlf.
  verLine := versionOrNil isNil ifTrue: [''] ifFalse: ['MCP-Protocol-Version: ' , versionOrNil , crlf].
  ^'POST /mcp HTTP/1.1' , crlf , 'Host: localhost' , crlf , verLine ,
   'Content-Type: application/json' , crlf ,
   'Content-Length: ' , body size printString , crlf , crlf , body
%
category: 'helpers'
method: McpTransportTest
postRequest: body sessionId: anIdOrNil
  "A raw HTTP POST /mcp carrying body as application/json, with an optional MCP-Session-Id header --
   what a client sends for every request after initialize."
  | crlf idLine |
  crlf := self crlf.
  idLine := anIdOrNil isNil ifTrue: [''] ifFalse: ['MCP-Session-Id: ' , anIdOrNil , crlf].
  ^'POST /mcp HTTP/1.1' , crlf , 'Host: localhost' , crlf , idLine ,
   'Content-Type: application/json' , crlf ,
   'Content-Length: ' , body size printString , crlf , crlf , body
%
category: 'helpers'
method: McpTransportTest
postRequest: body sessionId: anIdOrNil accepting: acceptOrNil
  "A raw HTTP POST /mcp with a session id and an explicit Accept header -- what decides whether this
   server may answer with a stream. nil means the header is absent, which is what curl sends and what
   every other check here relies on."
  | crlf idLine acceptLine |
  crlf := self crlf.
  idLine := anIdOrNil isNil ifTrue: [''] ifFalse: ['MCP-Session-Id: ' , anIdOrNil , crlf].
  acceptLine := acceptOrNil isNil ifTrue: [''] ifFalse: ['Accept: ' , acceptOrNil , crlf].
  ^'POST /mcp HTTP/1.1' , crlf , 'Host: localhost' , crlf , idLine , acceptLine ,
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
category: 'helpers'
method: McpTransportTest
runRequest: rawRequest onRouter: aRouter
  "As runRequest:, but on a router the test configured -- and, for a McpFixtureRouter, one whose
   #loggedLines can be read back afterwards."
  | mock |
  mock := McpMockSocket on: rawRequest chunkSize: 1000000.
  aRouter handleConnection: (McpHttpConnection on: mock).
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
category: 'helpers'
method: McpTransportTest
simpleRequest: httpMethod sessionId: aSessionId
  "A raw HTTP request with the given verb and an MCP-Session-Id header, no body."
  | crlf |
  crlf := self crlf.
  ^httpMethod , ' /mcp HTTP/1.1' , crlf , 'Host: localhost' , crlf ,
   'MCP-Session-Id: ' , aSessionId , crlf , crlf
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
category: 'tests - cancellation'
method: McpTransportTest
testACancellationIsHandledByTheRouterAndNeverReachesTheWorker
  "The regression that matters, and the reason this interception exists at all. Routing a
   notifications/cancelled to the worker would queue it on that session's mutex BEHIND the very call
   it asks to stop, and it would be answered only once that call had finished on its own -- measured
   at 17 seconds on a 20-second call against a live server. So the assertion is not just that the
   right answer comes back, it is that the WORKER WAS NEVER ASKED: nothing was sent to the gem."
  | r sess out |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess mockWorker expressions size.
  out := (self runRequest: (self postRequest:
    '{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":4,"reason":"user"}}'
    sessionId: sess id) onRouter: r) output.
  self assert: (self includesCS: 'HTTP/1.1 202' in: out).
  "no JSON-RPC body: a notification gets 202 and nothing else"
  self deny: (self includesCS: 'jsonrpc' in: out).
  "and the worker saw nothing -- only the bootstrap expression prepareWorker sent at session open"
  self assert: (sess mockWorker expressions
    detect: [:e | (e findString: 'cancelled' startingAt: 1) > 0] ifNone: [nil]) isNil
%
category: 'tests - cancellation'
method: McpTransportTest
testACancellationWithoutASessionIsRefusedLikeEveryOtherVerb
  "Same 400/404 gates as every other verb, so a client gets one consistent signal about its session
   whatever it happens to be sending."
  | r out |
  r := McpFixtureRouter new.
  out := (self runRequest: (self postRequest:
    '{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":1}}'
    sessionId: nil) onRouter: r) output.
  self assert: (self includesCS: '400' in: out).
  out := (self runRequest: (self postRequest:
    '{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":1}}'
    sessionId: 'NOSUCHSESSION') onRouter: r) output.
  self assert: (self includesCS: '404' in: out)
%
category: 'tests - cancellation'
method: McpTransportTest
testACancelledCallIsAnsweredWithNoJsonRpcResponse
  "What the client gets back on the cancelled request's OWN connection: 202 and no body. The spec
   asks a receiver of a cancellation both to stop processing the request and not to send a response
   for it, and the client would discard one anyway. 202 keeps it valid HTTP rather than an abrupt
   close, and carries no JSON-RPC response."
  | r sess out |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess mockWorker waitsBeforeDone: 1000000.
  [(Delay forMilliseconds: 100) wait. sess requestCancel: 11] fork.
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":11,"method":"tools/list"}'
    sessionId: sess id) onRouter: r) output.
  self assert: (self includesCS: 'HTTP/1.1 202' in: out).
  self deny: (self includesCS: 'jsonrpc' in: out).
  self deny: (self includesCS: '-32001' in: out).
  "the session survives: the client cancelled a request, not its work"
  self assert: (r sessionAt: sess id) notNil
%
category: 'tests - cancellation'
method: McpTransportTest
testACancelledStreamedCallJustEndsItsStream
  "On a streamed call the answer is simply absent: the SSE headers already went out, so saying
   nothing IS ending the stream -- which is exactly what the draft revision requires of a cancelled
   request, and what the current one gets by the same silence."
  | r sess out |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess mockWorker waitsBeforeDone: 1000000.
  [(Delay forMilliseconds: 100) wait. sess requestCancel: 9] fork.
  out := (self runRequest: (self postRequest: (self toolsCallWithProgressToken: 9)
    sessionId: sess id accepting: 'text/event-stream') onRouter: r) output.
  self assert: (self includesCS: 'Content-Type: text/event-stream' in: out).
  "headers, and then nothing at all -- no frame for a request the client stopped waiting for"
  self deny: (self includesCS: 'event: message' in: out).
  self deny: (self includesCS: '-32001' in: out)
%
category: 'tests - progress'
method: McpTransportTest
testAnAcceptHeaderWithoutAProgressTokenStaysPlainJson
  "Offering to take a stream is not asking for one. The client opts in per request by sending a
   token; a client that sends the header on every request -- which is every client -- must not
   therefore get a stream for every call."
  | r sess out body |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  body := '{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"status","arguments":{}}}'.
  out := (self runRequest: (self postRequest: body
    sessionId: sess id accepting: 'application/json, text/event-stream') onRouter: r) output.
  self assert: (self includesCS: 'Content-Type: application/json' in: out).
  self deny: (self includesCS: 'text/event-stream' in: out)
%
category: 'tests - progress'
method: McpTransportTest
testAProgressTokenAndAnAcceptHeaderGetAnEventStream
  "A tools/call that asks to be kept informed is answered as a request-scoped SSE stream: the headers,
   then the response as one SSE frame. Both halves matter. The Content-Type is what lets anything be
   sent before the answer at all; and the answer arriving as `data:` rather than as a body is what a
   client has to accept for progress to be possible, which the spec requires of it and which no
   client had ever been observed doing against this server."
  | r sess out |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess mockWorker nextResult: '{"jsonrpc":"2.0","id":9,"result":{"content":[]}}'.
  out := (self runRequest: (self postRequest: (self toolsCallWithProgressToken: 9)
    sessionId: sess id accepting: 'application/json, text/event-stream') onRouter: r) output.
  self assert: (self includesCS: 'Content-Type: text/event-stream' in: out).
  self deny: (self includesCS: 'Content-Type: application/json' in: out).
  "no Content-Length: the stream stays open, and a length would end it at the first frame"
  self deny: (self includesCS: 'Content-Length' in: out).
  "and the anti-buffering header, or a proxy may hold every frame until the answer arrives"
  self assert: (self includesCS: 'X-Accel-Buffering: no' in: out).
  self assert: (self includesCS: 'event: message' in: out).
  self assert: (self includesCS: 'data: {"jsonrpc":"2.0","id":9' in: out)
%
category: 'tests - progress'
method: McpTransportTest
testAProgressTokenOnSomethingOtherThanAToolsCallIsIgnored
  "Only a tools/call is streamed. A progressToken on a tools/list has nothing to report against --
   there is no long operation and no denominator -- so it is left alone rather than honoured into an
   empty stream."
  | r sess out body |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  body := '{"jsonrpc":"2.0","id":3,"method":"tools/list","params":{"_meta":{"progressToken":3}}}'.
  out := (self runRequest: (self postRequest: body
    sessionId: sess id accepting: 'application/json, text/event-stream') onRouter: r) output.
  self assert: (self includesCS: 'Content-Type: application/json' in: out).
  self deny: (self includesCS: 'text/event-stream' in: out)
%
category: 'tests - progress'
method: McpTransportTest
testAProgressTokenWithoutTheAcceptHeaderStaysPlainJson
  "The spec REQUIRES a client to accept text/event-stream, and both real clients send the header --
   so this is not a capability check but a guard for the hand-rolled caller: curl, and every other
   check in this suite and in test.sh, asked for JSON and gets JSON."
  | r sess out |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  out := (self runRequest: (self postRequest: (self toolsCallWithProgressToken: 9)
    sessionId: sess id accepting: nil) onRouter: r) output.
  self assert: (self includesCS: 'Content-Type: application/json' in: out).
  self deny: (self includesCS: 'text/event-stream' in: out)
%
category: 'tests'
method: McpTransportTest
testARequestEndedOnTheDeadlineIsAnsweredWithItsOwnId
  "The answer a client gets for a call the server ended on its deadline. The id is the part that
   matters: without it the client cannot match the error to the request it is waiting on, and would
   wait out its OWN timeout instead -- which is the thing a server-side deadline exists to prevent.
   HTTP 200 rather than an error status, because the request was accepted, routed and served: it is
   the call inside it that failed, and -32001 with data.kind 'timeout' is how that is said."
  | r sess out |
  r := McpFixtureRouter new.
  r requestTimeoutSeconds: 1.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess mockWorker waitsBeforeDone: 1000000.
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":42,"method":"tools/list"}' sessionId: sess id)
    onRouter: r) output.
  self assert: (self includesCS: '200 OK' in: out).
  self assert: (self includesCS: '"id":42' in: out).
  self assert: (self includesCS: '-32001' in: out).
  self assert: (self includesCS: '"kind":"timeout"' in: out).
  "the worker took the break, so the client keeps its session for the next request"
  self assert: (r sessionAt: sess id) notNil
%
category: 'tests'
method: McpTransportTest
testASessionWhoseWorkerCannotBeInterruptedIsUnmapped
  "A session whose gem had to be stopped can serve nothing further, so it is unmapped as the failing
   request is answered rather than left for the reaper: the sooner it is gone, the sooner the
   client's next request gets the 404 that tells it to initialize again -- the transport's own way of
   saying a session has ended."
  | r sess out |
  r := McpFixtureRouter new.
  r requestTimeoutSeconds: 1.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess mockWorker waitsBeforeDone: 1000000; resistSoftBreak: true; resistHardBreak: true.
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":7,"method":"tools/list"}' sessionId: sess id)
    onRouter: r) output.
  self assert: (self includesCS: '"id":7' in: out).
  self assert: (self includesCS: '"kind":"timeout"' in: out).
  self assert: sess workerGemStopped.
  self assert: (r sessionAt: sess id) isNil.
  "and the next request on that id is refused the way the spec says"
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":8,"method":"tools/list"}' sessionId: sess id)
    onRouter: r) output.
  self assert: (self includesCS: '404' in: out)
%
category: 'tests - progress'
method: McpTransportTest
testAStreamedCallEndedOnTheDeadlineIsTerminatedByAFrame
  "A call ended on the deadline AFTER its stream was opened cannot be answered with a second HTTP
   response -- the headers already went out -- so the error travels as a frame on the stream that is
   open. The frame is what stops the client waiting: a stream that simply goes quiet leaves it on a
   socket that will never say anything again, which is worse than the timeout it was told about.
   Same -32001 and same id as the plain-JSON path, because it is the same news."
  | r sess out |
  r := McpFixtureRouter new.
  r requestTimeoutSeconds: 1.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess mockWorker waitsBeforeDone: 1000000.
  out := (self runRequest: (self postRequest: (self toolsCallWithProgressToken: 9)
    sessionId: sess id accepting: 'text/event-stream') onRouter: r) output.
  self assert: (self includesCS: 'Content-Type: text/event-stream' in: out).
  self assert: (self includesCS: 'event: message' in: out).
  self assert: (self includesCS: '-32001' in: out).
  self assert: (self includesCS: '"kind":"timeout"' in: out).
  self assert: (self includesCS: '"id":9' in: out).
  "the worker took the break, so the client keeps its session"
  self assert: (r sessionAt: sess id) notNil
%
category: 'tests - worker config'
method: McpTransportTest
testBadWorkerOrToolsetNameIsRefusedAtConfigTime
  "A class name from config is interpolated into an executeString: in the worker gem, so anything that
   is not a plain identifier must be refused when the router is configured -- not carried to the
   worker. A typo should stop the server starting rather than break every request."
  #('' 'has space' 'has-dash' '9leading' 'quote''s' 'Semi;colon') do: [:bad |
    self should: [McpRouter new workerClassName: bad] raise: Error.
    self should: [McpRouter new toolsetNames: (Array with: bad)] raise: Error].
  "a legal identifier is accepted, and a Symbol is stored as a String (JSON-safe for the fork string)"
  self assert: (McpRouter new workerClassName: #McpServer; workerClassName) equals: 'McpServer'
%
category: 'tests'
method: McpTransportTest
testBaseRouterIsLoopbackOnly
  "A base McpRouter performs NO authentication, so it must not be bindable to a reachable address:
   bindAddress answers loopback, there is deliberately no setter, and 'bindAddress' is not a config
   key (so it cannot arrive via a fork string either)."
  | r |
  r := McpRouter new.
  self assert: r bindAddress equals: '127.0.0.1'.
  self deny: (McpRouter canUnderstand: #bindAddress:).
  self deny: (r configDict includesKey: 'bindAddress').
  "and a fork string cannot smuggle one in"
  r applyConfig: (Dictionary new at: 'bindAddress' put: '0.0.0.0'; yourself).
  self assert: r bindAddress equals: '127.0.0.1'
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
testConfigJsonRoundTrips
  "The fork-string mechanism: a base router's config survives configJson -> applyConfigJson: exactly.
   Every set field on the fixed key allow-list is carried; an unset field keeps its safe
   initialize-seeded default. (McpAuthRouter's RS-layer keys are covered in McpAuthTest.)"
  | src dst |
  src := McpRouter new.
  src readOnly: true;
    requestTimeoutSeconds: 5;
    allowedOriginHosts: #('example.com');
    workerClassName: 'McpServer';
    toolsetNames: #('McpBrowsingToolset');
    serverName: 'acme-db-mcp';
    serverTitle: 'Acme Labels - production';
    serverVersion: '2.5.0';
    messageTrace: true;
    messageTraceLimit: 512.
  dst := McpRouter new applyConfigJson: src configJson.
  self assert: dst readOnly.
  self assert: dst allowedOriginHosts equals: #('example.com').
  self assert: dst workerClassName equals: 'McpServer'.
  self assert: dst toolsetNames equals: #('McpBrowsingToolset').
  self assert: dst serverName equals: 'acme-db-mcp'.
  self assert: dst serverTitle equals: 'Acme Labels - production'.
  self assert: dst serverVersion equals: '2.5.0'.
  self assert: dst requestTimeoutSeconds equals: 5.
  self assert: dst tlsCertificateFile isNil.     "unset optional stays nil through the round-trip"
  self assert: dst tlsPrivateKeyFile isNil.
  "the message trace has to survive this or it is unreachable: forkOnPort: is how the server starts"
  self assert: dst messageTrace.
  self assert: dst messageTraceLimit equals: 512.
  "an unconfigured router round-trips to its safe defaults -- read-write on, loopback origins,
   trace off"
  self deny: (McpRouter new applyConfigJson: McpRouter new configJson) readOnly.
  self deny: (McpRouter new applyConfigJson: McpRouter new configJson) messageTrace
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
testDeleteUnknownSessionReturns404
  "Streamable HTTP session management: once a session is gone the server MUST answer a request
   carrying that id with 404, which is the client's cue to re-initialize. Same rule for DELETE as
   for POST. (The 200 path needs a live worker gem, so it is covered by test.sh.)"
  | out |
  out := (self runRequest: (self simpleRequest: 'DELETE' sessionId: 'DEADBEEF')) output.
  self assert: (self includesCS: 'HTTP/1.1 404 Not Found' in: out).
  self assert: (self includesCS: 'DEADBEEF' in: out)
%
category: 'tests'
method: McpTransportTest
testDeleteWithoutSessionReturns400
  "A server that requires a session id SHOULD answer a request without the header with 400 -- the
   same answer the POST path gives (testPostWithoutSessionReturnsError)."
  | out |
  out := (self runRequest: (self simpleRequest: 'DELETE')) output.
  self assert: (self includesCS: 'HTTP/1.1 400 Bad Request' in: out).
  self assert: (self includesCS: 'MCP-Session-Id' in: out)
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
testGetWithoutASessionIdIsRefused
  "The GET stream is SESSION-SCOPED, like every other verb: no MCP-Session-Id header -> 400. This
   test used to assert the opposite -- that a bare GET opened a stream -- which was the defect. A
   stream the server cannot name a session for can be attached to no outbox, and it also outlived
   its session: once the reaper dropped a session and logged out its gem, nothing touched that
   client's GET socket, so the keepalives went on advertising a healthy stream over a worker that
   was gone. What the stream then DOES is McpStreamTest's subject; this is the verb-level gate,
   alongside the POST and DELETE ones."
  | out |
  out := (self runRequest: (self simpleRequest: 'GET')) output.
  self assert: (self includesCS: 'HTTP/1.1 400 Bad Request' in: out).
  self deny: (self includesCS: 'text/event-stream' in: out)
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
category: 'tests - message trace'
method: McpTransportTest
testMessageTraceCapsLongBodies
  "A traced body is capped (defaultMessageTraceLimit) and the trace says how much it dropped, so a
   reader can tell a long message from a lost one. nil removes the cap."
  | big ws r line uncapped |
  ws := WriteStream on: String new.
  ws nextPutAll: '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"code":"'.
  1 to: 5000 do: [:i | ws nextPut: $x].
  ws nextPutAll: '"}}'.
  big := ws contents.
  r := McpFixtureRouter new.
  r messageTrace: true.
  self assert: r messageTraceLimit equals: McpRouter defaultMessageTraceLimit.
  self runRequest: (self postRequest: big) onRouter: r.
  line := (self traceLinesOf: r) first.
  self assert: (self includesCS: big size printString , ' chars' in: line).  "the FULL size is stated"
  self assert: (self includesCS: '...(+' in: line).
  self deny: (self includesCS: big in: line).
  "with the cap off, the whole body is written"
  uncapped := McpFixtureRouter new.
  uncapped messageTrace: true.
  uncapped messageTraceLimit: nil.
  self runRequest: (self postRequest: big) onRouter: uncapped.
  self assert: (self includesCS: big in: (self traceLinesOf: uncapped) first)
%
category: 'tests - message trace'
method: McpTransportTest
testMessageTraceIsOffByDefault
  "Off unless an operator asks for it: a traced log holds every argument every client sent."
  | r |
  r := McpFixtureRouter new.
  self deny: r messageTrace.
  self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}') onRouter: r.
  self assert: (self traceLinesOf: r) isEmpty
%
category: 'tests - message trace'
method: McpTransportTest
testMessageTraceKeepsOneMessageOnOneLine
  "One message is one log line. A tools/call argument routinely carries Smalltalk source with real
   newlines in it; left alone a single call would break into dozens of lines and take the timestamp,
   the session id and grep with it."
  | body r line |
  body := '{"code":"| x |' , (String with: Character lf) , 'x := 1.' , (String with: Character lf) , 'x"}'.
  r := McpFixtureRouter new.
  r messageTrace: true.
  self runRequest: (self postRequest: body) onRouter: r.
  self assert: (self traceLinesOf: r) size equals: 1.
  line := (self traceLinesOf: r) first.
  self deny: (line includes: Character lf).
  self deny: (line includes: Character cr).
  self assert: (self includesCS: 'x := 1.' in: line)
%
category: 'tests - message trace'
method: McpTransportTest
testMessageTraceLimitRejectsNonPositive
  "A zero or negative cap would silently trace nothing; nil is how you ask for no cap."
  self should: [McpRouter new messageTraceLimit: 0] raise: Error.
  self should: [McpRouter new messageTraceLimit: -1] raise: Error.
  self assert: (McpRouter new messageTraceLimit: nil; messageTraceLimit) isNil.
  self assert: (McpRouter new messageTraceLimit: 10; messageTraceLimit) equals: 10
%
category: 'tests - message trace'
method: McpTransportTest
testMessageTraceLogsARefusedRequest
  "The reason the tap is in handleConnection: and not in servePost:on:. A request the Origin gate
   turns away never reaches a verb handler, and it is exactly the one an operator is trying to see."
  | r out |
  r := McpFixtureRouter new.
  r messageTrace: true.
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
                              origin: 'http://evil.example.com')
           onRouter: r) output.
  self assert: (self includesCS: 'HTTP/1.1 403 Forbidden' in: out).
  self assert: (self traceLinesOf: r) size equals: 1
%
category: 'tests - message trace'
method: McpTransportTest
testMessageTraceLogsTheRequestBody
  "The whole point: the text of the message the client sent, which its own UI does not show."
  | body r line |
  body := '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"execute_code"}}'.
  r := McpFixtureRouter new.
  r messageTrace: true.
  self runRequest: (self postRequest: body) onRouter: r.
  self assert: (self traceLinesOf: r) size equals: 1.
  line := (self traceLinesOf: r) first.
  self assert: (self includesCS: body in: line).
  self assert: (self includesCS: 'POST /mcp' in: line).
  self assert: (self includesCS: body size printString , ' chars' in: line)
%
category: 'tests - message trace'
method: McpTransportTest
testMessageTraceOmitsHeaders
  "Headers are never traced. One of them is the Authorization bearer token on McpAuthRouter, and a
   trace an operator turns on to read a tool argument must not become a way to collect credentials.
   The session id IS reported -- it is the only thing that tells two concurrent clients apart, and
   the reaper already writes it in the clear."
  | body raw r line crlf |
  crlf := self crlf.
  body := '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'.
  raw := 'POST /mcp HTTP/1.1' , crlf , 'Host: localhost' , crlf ,
    'Authorization: Bearer sekrit-token-value' , crlf ,
    'MCP-Session-Id: abc123' , crlf ,
    'Content-Type: application/json' , crlf ,
    'Content-Length: ' , body size printString , crlf , crlf , body.
  r := McpFixtureRouter new.
  r messageTrace: true.
  self runRequest: raw onRouter: r.
  line := (self traceLinesOf: r) first.
  self deny: (self includesCS: 'sekrit-token-value' in: line).
  self deny: (self includesCS: 'Authorization' in: line).
  self assert: (self includesCS: 'session abc123' in: line)
%
category: 'tests - message trace'
method: McpTransportTest
testMessageTraceRecordsAnUnreadableRequest
  "A connection that yields no request at all -- EOF, a read timeout, an over-long head -- is itself
   worth a line: 'my message never arrived' is one of the things this trace is turned on to answer."
  | r |
  r := McpFixtureRouter new.
  r messageTrace: true.
  self runRequest: '' onRouter: r.
  self assert: (self traceLinesOf: r) size equals: 1.
  self assert: (self includesCS: 'unreadable request' in: (self traceLinesOf: r) first)
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
testSupportedProtocolVersionServed
  "A supported (negotiated) version passes the version gate; the request reaches routing (a
   session-less tools/list -> -32600), NOT a version 400."
  | out |
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' protocolVersion: '2025-11-25')) output.
  self deny: (self includesCS: 'Unsupported MCP-Protocol-Version' in: out).
  self assert: (self includesCS: '-32600' in: out)
%
category: 'tests - progress'
method: McpTransportTest
testTheSessionGatesRunBeforeAnyStreamIsOpened
  "400 and 404 are decided before the answer is committed to being a stream, and they are the same
   refusals a plain call gets. They have to run first: a refusal written into a response already
   promised as text/event-stream would have to be a frame, so a client with a stale session id would
   learn of it inside a stream instead of from the status line the transport spec tells it to read."
  | r out |
  r := McpFixtureRouter new.
  out := (self runRequest: (self postRequest: (self toolsCallWithProgressToken: 9)
    sessionId: nil accepting: 'text/event-stream') onRouter: r) output.
  self assert: (self includesCS: '400' in: out).
  self deny: (self includesCS: 'text/event-stream' in: out).
  out := (self runRequest: (self postRequest: (self toolsCallWithProgressToken: 9)
    sessionId: 'NOSUCHSESSION' accepting: 'text/event-stream') onRouter: r) output.
  self assert: (self includesCS: '404' in: out).
  self deny: (self includesCS: 'text/event-stream' in: out)
%
category: 'tests'
method: McpTransportTest
testTlsDisabledByDefault
  "A fresh router serves plaintext HTTP: no certificate configured, so tlsEnabled is false. (The TLS
   handshake itself is verified by a live curl check, not here -- McpMockSocket is not a real TLS
   socket.)"
  self deny: McpRouter new tlsEnabled
%
category: 'tests'
method: McpTransportTest
testTlsEnabledWhenConfigured
  "Configuring a certificate + key on a router instance flips tlsEnabled to true (so runOnPort: would
   bind a GsSecureSocket); disableTls flips it back. tlsEnabled only checks that both paths are set,
   so throwaway paths suffice. Config is instance-side, so this touches no shared state."
  | r |
  r := McpRouter new.
  self deny: r tlsEnabled.
  r useTlsCertificateFile: '/tmp/nonexistent.crt' privateKeyFile: '/tmp/nonexistent.key'.
  self assert: r tlsEnabled.
  r disableTls.
  self deny: r tlsEnabled
%
category: 'tests'
method: McpTransportTest
testUnknownVerbReturns405
  self assert: (self includesCS: '405 Method Not Allowed' in: (self runRequest: (self simpleRequest: 'PUT')) output)
%
category: 'tests'
method: McpTransportTest
testUnsupportedProtocolVersionReturns400
  "A request with an unknown MCP-Protocol-Version is rejected with 400 (spec MUST), before routing."
  | out |
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' protocolVersion: '1999-01-01')) output.
  self assert: (self includesCS: 'HTTP/1.1 400 Bad Request' in: out).
  self assert: (self includesCS: 'Unsupported MCP-Protocol-Version' in: out)
%
category: 'tests - worker config'
method: McpTransportTest
testValidateWorkerConfigRefusesUnusableNames
  "runOnPort: validates before binding: a well-formed name that does not resolve to a usable class
   must fail at startup, naming it. Covers both the worker class and a toolset."
  | msg |
  msg := [(McpRouter new workerClassName: 'McpNoSuchServerClass') validateWorkerConfig. nil]
    on: Error do: [:e | [e description] on: Error do: [:x | e messageText]].
  self deny: msg isNil.
  self assert: (self includesCS: 'McpNoSuchServerClass' in: msg).
  "a class that exists but is not an McpServer is refused too"
  msg := [(McpRouter new workerClassName: 'Object') validateWorkerConfig. nil]
    on: Error do: [:e | [e description] on: Error do: [:x | e messageText]].
  self deny: msg isNil.
  msg := [(McpRouter new toolsetNames: #('McpNoSuchToolset')) validateWorkerConfig. nil]
    on: Error do: [:e | [e description] on: Error do: [:x | e messageText]].
  self deny: msg isNil.
  self assert: (self includesCS: 'McpNoSuchToolset' in: msg).
  "and a default router validates clean"
  self assert: McpRouter new validateWorkerConfig notNil
%
category: 'tests - worker config'
method: McpTransportTest
testWorkerConfigDefaultsAreResolvedByTheFrontEnd
  "Unconfigured: the worker class is McpServer and the tool surface is the installed default. Both are
   resolved HERE (front end) and pushed to the worker, which never chooses for itself."
  | r |
  r := McpRouter new.
  self assert: r workerClassName isNil.
  self assert: r toolsetNames isNil.
  self assert: r serverName isNil.
  self assert: r serverTitle isNil.   "no instance label until an operator sets one"
  self assert: r effectiveWorkerClassName equals: 'McpServer'.
  self assert: r effectiveToolsetNames equals: McpServer installedDefaultToolsetNames.
  "configured values win, and an EMPTY toolset list is legal -- a server with no tools"
  r workerClassName: 'McpFixtureServerProbe'; toolsetNames: #().
  self assert: r effectiveWorkerClassName equals: 'McpFixtureServerProbe'.
  self assert: r effectiveToolsetNames isEmpty
%
category: 'helpers'
method: McpTransportTest
toolsCallWithProgressToken: aToken
  "A tools/call body carrying a progressToken in params._meta -- what Claude Code sends on every
   single tools/call, measured, and what this server used to throw away."
  ^'{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"status","arguments":{},'
    , '"_meta":{"progressToken":' , aToken printString , '}}}'
%
category: 'helpers'
method: McpTransportTest
traceLinesOf: aRouter
  "The message-trace lines aRouter logged, in order. A trace line is the only kind that starts with
   the inbound marker, so this ignores the router's lifecycle and error lines."
  ^aRouter loggedLines select: [:each | (each findString: '-->' startingAt: 1) = 1]
%
