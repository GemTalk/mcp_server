set compile_env: 0
! ------------------- Class definition for McpStreamTest
expectvalue /Class
doit
GsTestCase subclass: 'McpStreamTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpStreamTest comment: 
'The server-to-client pathway end to end, minus the sockets: the standalone SSE stream, the outbox
drain onto it, the return path for a client''s answer, and the idle story that is the whole reason
the pathway exists.

Sockets are McpMockSocket, sessions are McpStubSession or McpMockSession (no gem, no NETLDI), and
the router is McpFixtureRouter -- which is a shipping McpRouter apart from reporting itself running
without a listener, so the drain loop can be driven at all. Everything under test is the real
implementation.

What each group is for:
  - stream: the GET is session-scoped now (400/404 like every other verb). A stream that belongs to
    no session can be attached to no outbox, and used to outlive the session it was opened for --
    keepalives went on advertising a healthy stream over a worker gem the reaper had already logged
    out.
  - return path: a client answers a server request by POSTing a JSON-RPC response, which has an id
    and no method. That used to fall through to the worker and come back as -32600 Invalid Request.
  - idle: a session IS a gem with its own transaction view, so reaping one discards uncommitted
    work. A ping decides whether anyone is still listening: a client that answers keeps its gem, one
    that does not has it freed early. An answered ping deliberately does NOT restart the idle clock
    -- see McpSession''s class comment.'
%
expectvalue /Class
doit
McpStreamTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpStreamTest
removeallmethods McpStreamTest
removeallclassmethods McpStreamTest
! ------------------- Class methods for McpStreamTest
! ------------------- Instance methods for McpStreamTest
category: 'helpers'
method: McpStreamTest
crlf
  ^String with: Character cr with: Character lf
%
category: 'helpers'
method: McpStreamTest
firstQueuedIn: sess
  "Drain sess's outbox and answer its first message parsed back from JSON, or nil if empty."
  | drained |
  drained := sess outbox drain asArray.
  ^drained isEmpty ifTrue: [nil] ifFalse: [JsonParser parse: drained first]
%
category: 'helpers'
method: McpStreamTest
getRequestWithSessionId: anIdOrNil
  "A raw HTTP GET /mcp opening the SSE stream, with an optional MCP-Session-Id header."
  | crlf idLine |
  crlf := self crlf.
  idLine := anIdOrNil isNil ifTrue: [''] ifFalse: ['MCP-Session-Id: ' , anIdOrNil , crlf].
  ^'GET /mcp HTTP/1.1' , crlf , 'Host: localhost' , crlf , idLine , crlf
%
category: 'helpers'
method: McpStreamTest
includesCS: aSubstring in: aString
  "Case-sensitive substring test. GemStone's String>>includesString: is case-INsensitive, so use
   findString:startingAt: for assert:/deny: substring checks."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'helpers'
method: McpStreamTest
postRequest: body sessionId: anIdOrNil
  "A raw HTTP POST /mcp carrying body as application/json, with an optional MCP-Session-Id header."
  | crlf idLine |
  crlf := self crlf.
  idLine := anIdOrNil isNil ifTrue: [''] ifFalse: ['MCP-Session-Id: ' , anIdOrNil , crlf].
  ^'POST /mcp HTTP/1.1' , crlf , 'Host: localhost' , crlf , idLine ,
   'Content-Type: application/json' , crlf ,
   'Content-Length: ' , body size printString , crlf , crlf , body
%
category: 'helpers'
method: McpStreamTest
runRequest: rawRequest on: aRouter
  "Drive one HTTP request through aRouter and answer the mock socket, whose #output holds the
   response bytes."
  | mock |
  mock := McpMockSocket on: rawRequest chunkSize: 1000000.
  aRouter handleConnection: (McpHttpConnection on: mock).
  ^mock
%
category: 'running'
method: McpStreamTest
setUp
  "No per-test state: each test builds its router and session as stack locals, so the framework's
   between-test instance-variable nilling cannot disturb them."
  ^self
%
category: 'helpers'
method: McpStreamTest
streamOn: aRouter forSession: sess
  "Run the SSE drain loop against a mock socket that is already at EOF, so it makes exactly one full
   pass and then detects the disconnect (McpHttpConnection>>clientHasClosed) rather than looping
   forever. Answers the mock, whose #output holds the raw stream bytes."
  | mock |
  mock := McpMockSocket on: '' chunkSize: 1000000.
  aRouter serveGetStream: (McpHttpConnection on: mock) forSession: sess.
  ^mock
%
category: 'tests - stream'
method: McpStreamTest
testAnArrivingStreamRetractsADepartureAtOnce
  "#serveGetStream:forSession: sends #noteStreamSeen on the way IN. Without it a client that closed
   one stream and opened another would keep the flag until a maintenance pass noticed the new
   stream -- and the pass is a minute wide, where the grace is ten seconds."
  | r sess |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  sess noteStreamClosedByClient.
  1 to: 20 do: [:i | sess notePassWithStream: false].
  self streamOn: r forSession: sess.
  self deny: sess streamClosedByClient.
  self assert: sess streamlessPasses equals: 0.
  self assert: (r sessionAt: sess id) notNil
%
category: 'tests - idle probe'
method: McpStreamTest
testAnsweredPingDoesNotRestartTheIdleClock
  "The decision this design turns on. If an answered ping counted as work, every well-behaved client
   would hold its worker gem -- and its transaction view -- for as long as it stayed open. So an
   answer spares the gem an early reap and ADVANCES the idleness count; only real MCP traffic
   resets it."
  | r sess before |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess outbox attachStream.
  before := sess lastActivitySeconds.
  self assert: (r probeSession: sess).
  self assert: (r resolvePendingRequest: ((self firstQueuedIn: sess) at: 'id') forSession: sess) notNil.
  self assert: sess quietProbes equals: 1.
  self assert: sess lastActivitySeconds equals: before
%
category: 'tests - stream'
method: McpStreamTest
testAStreamEndedByThisServerIsNotAVanishedClient
  "The distinction #runStreamLoop:forSession:generation: exists to make, and the one that would be
   expensive to get wrong: a newer GET superseding this stream is the latest-GET-wins rule doing its
   job, not a client leaving. Reading it as a departure would free the gem of the client that had
   just reconnected."
  | r sess stale |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  stale := sess outbox attachStream.
  sess outbox attachStream.        "a newer GET arrives and supersedes it"
  self deny: (r runStreamLoop: (McpHttpConnection on: (McpMockSocket on: '' chunkSize: 1000000))
    forSession: sess generation: stale).
  "whereas the current stream's loop, meeting EOF, does answer that the client went away"
  self assert: (r runStreamLoop: (McpHttpConnection on: (McpMockSocket on: '' chunkSize: 1000000))
    forSession: sess generation: sess outbox currentStreamGeneration)
%
category: 'tests - stream'
method: McpStreamTest
testAVanishedClientHasItsGemReleasedByTheLoopItself
  "End to end through the real drain loop: a mock socket is at EOF, so this is precisely the shut
   tab -- and with the grace set to zero the release happens in the stream's own GsProcess rather
   than waiting for a maintenance pass. The session is unmapped and its worker logged out."
  | r sess |
  r := McpFixtureRouter new.
  r streamLossGraceSeconds: 0.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  self streamOn: r forSession: sess.
  self assert: sess streamClosedByClient.
  self assert: (r sessionAt: sess id) isNil
%
category: 'tests - stream'
method: McpStreamTest
testDroppedMessagesAreCountedOffTheStreamNotAnnouncedOnIt
  "The gap used to be announced to the client in a notifications/message. It is recorded in the gem
   log now, and this pins the part that is observable from here: the stream carries the SURVIVORS
   and nothing else. The oldest go, so the count is taken and the newest maxQueueSize arrive."
  | r sess out |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  1 to: sess outbox maxQueueSize + 2 do: [:i | sess outbox add: '{"n":' , i printString , '}'].
  self assert: sess outbox size equals: sess outbox maxQueueSize.
  out := (self streamOn: r forSession: sess) output.
  self deny: (self includesCS: 'notifications/message' in: out).
  self deny: (self includesCS: 'overflowed' in: out).
  self deny: (self includesCS: '{"n":1}' in: out).      "oldest, discarded"
  self assert: (self includesCS: '{"n":3}' in: out).    "oldest survivor"
  self assert: sess outbox droppedCount equals: 0       "taken by the drain loop"
%
category: 'tests - stream'
method: McpStreamTest
testGetStreamFlushesAClosingOutboxThenEnds
  "Reaping marks the outbox closing rather than closing it, so the drain loop gets one more turn and
   whatever was already queued still reaches the client. Nothing is enqueued AT reap time any more,
   but a message in flight when the reaper runs must not die with the gem."
  | r sess out |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  sess outbox add: '{"jsonrpc":"2.0","method":"notifications/progress","params":{"value":"goodbye"}}'.
  sess outbox beginClosing.
  out := (self streamOn: r forSession: sess) output.
  self assert: (self includesCS: 'goodbye' in: out).
  self deny: sess outbox isOpen      "the loop closed it once it had flushed"
%
category: 'tests - stream'
method: McpStreamTest
testGetStreamForALiveSessionOpensAnEventStream
  | r sess out |
  r := McpRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  out := (self runRequest: (self getRequestWithSessionId: sess id) on: r) output.
  self assert: (self includesCS: 'HTTP/1.1 200 OK' in: out).
  self assert: (self includesCS: 'Content-Type: text/event-stream' in: out).
  self assert: (self includesCS: ': connected' in: out)
%
category: 'tests - stream'
method: McpStreamTest
testGetStreamWithoutSessionIdReturns400
  "Same rule as POST and DELETE: this server requires a session id, so a request without one is a
   400. A stream the server cannot name a session for can be attached to no outbox."
  | out |
  out := (self runRequest: (self getRequestWithSessionId: nil) on: McpRouter new) output.
  self assert: (self includesCS: 'HTTP/1.1 400 Bad Request' in: out).
  self assert: (self includesCS: 'Missing MCP-Session-Id' in: out)
%
category: 'tests - stream'
method: McpStreamTest
testGetStreamWithUnknownSessionReturns404
  "Per the Streamable HTTP spec a request carrying a dead session id gets 404 -- the client's cue to
   re-initialize. Before the GET was session-scoped, a stream over a reaped session kept sending
   keepalives, so a client saw a healthy connection to a worker gem that no longer existed."
  | out |
  out := (self runRequest: (self getRequestWithSessionId: 'no-such-session') on: McpRouter new) output.
  self assert: (self includesCS: 'HTTP/1.1 404 Not Found' in: out).
  self assert: (self includesCS: 'Unknown or expired session' in: out)
%
category: 'tests - stream'
method: McpStreamTest
testGetStreamWritesWhatIsQueued
  "The pathway itself: what a router puts in a session's outbox reaches that session's stream, as
   SSE message frames."
  | r sess out |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  sess outbox add: '{"jsonrpc":"2.0","id":"srv-1","method":"ping"}'.
  out := (self streamOn: r forSession: sess) output.
  self assert: (self includesCS: 'event: message' in: out).
  self assert: (self includesCS: 'data: {"jsonrpc":"2.0","id":"srv-1","method":"ping"}' in: out).
  self assert: sess outbox isEmpty
%
category: 'tests - idle probe'
method: McpStreamTest
testIdleSessionWithAStreamIsProbedAndItsAnswerCounted
  "What is left of the idle window now that the warning is gone: the ping, and the accounting its
   answer feeds. An answered ping is evidence for #reapReasonFor: and nothing else -- it no longer
   earns the client a message. Sized at 600s of quiet, one ping per 300s: two confirmations."
  | r sess ping |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: 600; livenessProbeIntervalSeconds: 300; reaperIntervalSeconds: 60.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess outbox attachStream.
  1 to: r probePassInterval do: [:i | sess notePassWithStream: true].
  self assert: r probeIdleSessions equals: 1.
  ping := self firstQueuedIn: sess.
  self assert: (ping at: 'method') equals: 'ping'.
  self assert: (self includesCS: 'srv-' in: (ping at: 'id')).
  self assert: sess unansweredProbes equals: 1.
  "the client answers, which is what turns an outstanding probe into a quiet one"
  r resolvePendingRequest: (ping at: 'id') forSession: sess.
  self assert: sess quietProbes equals: 1.
  self assert: sess unansweredProbes equals: 0.
  "the next pass sends nothing: there is no warning left to send, and no probe is due yet"
  self assert: r probeIdleSessions equals: 0.
  self assert: sess outbox size equals: 0
%
category: 'tests - return path'
method: McpStreamTest
testPostedResponseIsAcknowledgedWith202
  "A JSON-RPC response has an id and no method. The spec: a POST carrying only responses or
   notifications MUST be answered 202 with no body. It used to fall through to the worker, whose
   dispatcher saw no method and answered -32600 Invalid Request with a 200 -- so a client's reply to
   a server ping came back to it as an error."
  | r sess out |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":"srv-1","result":{}}'
    sessionId: sess id) on: r) output.
  self assert: (self includesCS: 'HTTP/1.1 202 Accepted' in: out).
  self deny: (self includesCS: '-32600' in: out)
%
category: 'tests - return path'
method: McpStreamTest
testPostedResponseResolvesTheLivenessProbe
  "The whole round trip: the ping goes out on the stream, the answer comes back as a POST, and the
   session records one confirmation."
  | r sess ping |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  self assert: (r probeSession: sess).
  ping := self firstQueuedIn: sess.
  self assert: sess unansweredProbes equals: 1.
  self runRequest: (self postRequest:
    '{"jsonrpc":"2.0","id":"' , (ping at: 'id') , '","result":{}}' sessionId: sess id) on: r.
  self assert: sess quietProbes equals: 1.
  self assert: sess unansweredProbes equals: 0.
  "a duplicate or late answer is ignored, not refused: the server must not make a client fail"
  self assert: (r resolvePendingRequest: (ping at: 'id') forSession: sess) isNil
%
category: 'tests - return path'
method: McpStreamTest
testPostedResponseWithoutSessionIdReturns400
  "The session gates are the same on every verb, so a client gets one consistent signal."
  | out |
  out := (self runRequest: (self postRequest: '{"jsonrpc":"2.0","id":"srv-1","result":{}}'
    sessionId: nil) on: McpRouter new) output.
  self assert: (self includesCS: 'HTTP/1.1 400 Bad Request' in: out)
%
category: 'tests - idle probe'
method: McpStreamTest
testProbeIsNotSentToASessionWithNoStream
  "Not an oversight. A ping the client cannot receive would be counted as unanswered and could reap
   its gem for the sole offence of never opening a stream. Such a client is bounded instead by
   #streamlessPassesBeforeRelease, which counts the passes on which nothing could be asked."
  | r sess |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  self deny: sess outbox hasStream.
  1 to: 10 do: [:i | r probeIdleSessions].
  self assert: sess unansweredProbes equals: 0.
  self assert: sess outbox isEmpty.
  self assert: sess streamlessPasses equals: 10
%
category: 'tests - idle probe'
method: McpStreamTest
testReapedSessionIsUnmappedAndClosedWithoutTellingItsClient
  "A reaped session used to be told on its stream, in a notifications/message; that carrier is gone.
   What the reaper still does is unmap it, mark the outbox CLOSING (not closed) so the drain loop can
   finish what it holds, and log the worker out. The client learns from the 404 on its next call,
   which is what the transport defines for exactly this -- so the stream must end SILENT here, not
   carry a farewell."
  | r sess out |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: 600; livenessProbeIntervalSeconds: 300.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess outbox attachStream.
  1 to: r confirmationsBeforeRelease do: [:i | sess noteProbeSent; noteAlive].
  "the ground is still stated -- it goes to the gem log now rather than to the client"
  self assert: (self includesCS: 'idle for 10 minutes' in: (r reapReasonFor: sess)).
  self assert: r reapIdleSessions equals: 1.
  self assert: (r sessionAt: sess id) isNil.
  self assert: sess outbox isClosing.
  self assert: sess outbox size equals: 0.
  out := (self streamOn: r forSession: sess) output.
  self deny: (self includesCS: 'This MCP session has ended' in: out).
  self deny: (self includesCS: 'notifications/message' in: out).
  self deny: sess outbox isOpen      "the drain loop closed it, having nothing to flush"
%
category: 'tests - stream'
method: McpStreamTest
testStreamDetachesHoweverItEnds
  "Load-bearing, and easy to lose: every exit from the drain loop is a NON-LOCAL return out of a
   protected block, so the detach only happens because the ensure: runs on one. If it ever did not,
   the attach count would leak, hasStream would answer true for a session that has no stream, and the
   reaper would go on pinging a client that cannot answer -- reaping its gem early for it."
  | r sess |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  sess outbox add: '{"probe":1}'.
  self streamOn: r forSession: sess.       "exits via clientHasClosed -- a ^self inside the block"
  self deny: sess outbox hasStream
%
category: 'tests - idle probe'
method: McpStreamTest
testUnansweredProbeFreesTheGemEarly
  "The other half of the ping: silence on a stream the client itself opened is evidence, not merely
   absent traffic, so that gem need not wait out the full idle count. Three consecutive misses,
   because one can be a client that is merely not scheduled and will answer late."
  | r sess |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess outbox attachStream.
  1 to: r unansweredProbesBeforeGone do: [:i |
    1 to: r probePassInterval do: [:j | sess notePassWithStream: true].
    self assert: r probeIdleSessions equals: 1].
  self assert: sess unansweredProbes equals: r unansweredProbesBeforeGone.
  self assert: r reapIdleSessions equals: 1.
  self assert: (r sessionAt: sess id) isNil
%
