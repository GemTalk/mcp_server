set compile_env: 0
! ------------------- Class definition for McpOutboxTest
expectvalue /Class
doit
GsTestCase subclass: 'McpOutboxTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpOutboxTest comment: 
'McpOutbox on its own: the queue, the overflow policy, the closing handshake, and the
latest-GET-wins rule that keeps two drain loops off one socket.

There is no gem and no socket in an outbox, which is the point of having one -- the whole
server-to-client pathway reduces to something testable in milliseconds. What it hands to a stream is
covered by McpStreamTest.'
%
expectvalue /Class
doit
McpOutboxTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpOutboxTest
removeallmethods McpOutboxTest
removeallclassmethods McpOutboxTest
! ------------------- Class methods for McpOutboxTest
! ------------------- Instance methods for McpOutboxTest
category: 'tests - queueing'
method: McpOutboxTest
testAddAnswersWhetherItQueued
  "The answer is load-bearing: McpRouter>>sendRequest:params:toSession: records a pending request
   only if the message was actually queued, so it never waits for an answer to something the client
   will not receive."
  | o |
  o := McpOutbox new.
  self assert: (o add: 'a').
  o beginClosing.
  self deny: (o add: 'b').
  self assert: o size equals: 1
%
category: 'tests - lifecycle'
method: McpOutboxTest
testBeginClosingRefusesNewButKeepsWhatIsQueued
  "The closing handshake. A reaped session enqueues its last notice and is then marked closing; the
   queue must survive that, or the notice dies with the gem and the client meets a bare 404 instead."
  | o |
  o := McpOutbox new.
  o add: 'notice'.
  o beginClosing.
  self assert: o isClosing.
  self assert: o isOpen.          "still drainable -- that is the difference from #close"
  self deny: (o add: 'later').
  self assert: o drain asArray equals: #('notice')
%
category: 'tests - lifecycle'
method: McpOutboxTest
testCloseStopsEverything
  | o |
  o := McpOutbox new.
  o add: 'a'.
  o close.
  self deny: o isOpen.
  self assert: o isClosing.
  self deny: (o add: 'b')
%
category: 'tests - streams'
method: McpOutboxTest
testDetachDoesNotRollBackTheGeneration
  "A superseded stream detaches AFTER the one that replaced it attached. If detaching rolled the
   generation back, that exit would make the live stream look stale and it would end too -- leaving
   the client with an open socket and nothing draining it."
  | o first second |
  o := McpOutbox new.
  first := o attachStream.
  second := o attachStream.
  o detachStream: first.
  self assert: (o isCurrentStream: second).
  self assert: o hasStream
%
category: 'tests - queueing'
method: McpOutboxTest
testDrainIsFifoAndClears
  | o |
  o := McpOutbox new.
  self assert: o isEmpty.
  o add: 'one'; add: 'two'; add: 'three'.
  self assert: o size equals: 3.
  self assert: o drain asArray equals: #('one' 'two' 'three').
  self assert: o isEmpty.
  self assert: o drain asArray equals: #()
%
category: 'tests - streams'
method: McpOutboxTest
testHasStreamTracksAttachedStreams
  "What the reaper asks before probing: a client with no stream cannot receive a ping."
  | o g |
  o := McpOutbox new.
  self deny: o hasStream.
  g := o attachStream.
  self assert: o hasStream.
  o detachStream: g.
  self deny: o hasStream
%
category: 'tests - streams'
method: McpOutboxTest
testLatestGetWinsSupersedesTheEarlierStream
  "A client may open several GET streams, but a given message must be written to exactly one. Two
   live drainers would interleave SSE frames on one socket, so the newest generation wins and the
   older loop ends on its next tick."
  | o first second |
  o := McpOutbox new.
  first := o attachStream.
  self assert: (o isCurrentStream: first).
  second := o attachStream.
  self deny: (o isCurrentStream: first).
  self assert: (o isCurrentStream: second)
%
category: 'tests - queueing'
method: McpOutboxTest
testOverflowDropsOldestAndCountsIt
  "Bounded, so a client that never opens a stream cannot grow a session without bound. The OLDEST
   goes: for a long-running operation the newest state is the interesting one. And the loss is
   admitted -- silent truncation reads as full delivery."
  | o cap |
  o := McpOutbox new.
  cap := o maxQueueSize.
  1 to: cap + 3 do: [:i | o add: 'm' , i printString].
  self assert: o size equals: cap.
  self assert: o droppedCount equals: 3.
  self assert: o drain first equals: 'm4'    "m1..m3 went; nothing newer was refused"
%
category: 'tests - queueing'
method: McpOutboxTest
testTakeDroppedCountReportsOnceThenResets
  "The drain loop reports a gap exactly once, so a client is not told about the same three lost
   messages on every tick."
  | o |
  o := McpOutbox new.
  1 to: o maxQueueSize + 2 do: [:i | o add: 'm' , i printString].
  self assert: o takeDroppedCount equals: 2.
  self assert: o takeDroppedCount equals: 0
%
