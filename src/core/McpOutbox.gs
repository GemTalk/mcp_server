set compile_env: 0
! ------------------- Class definition for McpOutbox
expectvalue /Class
doit
Object subclass: 'McpOutbox'
  instVarNames: #( queue mutex isOpen
                    isClosing droppedCount streamGeneration streamCount)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpOutbox comment: 
'One client session''s queue of server-initiated JSON-RPC messages, waiting for that session''s
standalone SSE stream to carry them.

MCP over Streamable HTTP gives the server no socket to call out on: it can only write on a
connection the client opened, and the only such connection that is not tied to a request is the
GET stream. That stream is accepted by the FRONT END''s process, and a socket is a file descriptor
meaningful only inside the process that owns it, so the stream can live nowhere but McpRouter --
which is also where this outbox lives, one per McpSession, gem-local and NEVER committed (the same
reasoning that keeps readOnly inside the worker gem: transient per-session state needs no
persistence and must not be visible to other sessions).

There is no gem in an outbox, which is the point: it is the whole server-to-client pathway reduced
to something directly unit-testable (McpOutboxTest), with the socket on the other side of #drain.

Its own mutex, deliberately not McpRouter''s: the router''s guards the id -> session map and is held
across reapIdleSessions, and a chatty session must not contend with another client''s session open
or close.

Policies worth knowing:
  - Bounded at #maxQueueSize. On overflow the OLDEST message is discarded and #droppedCount is
    bumped, so the client is told how many it missed rather than silently handed a gap.
  - Exactly one drainer. Two GsProcesses draining onto one socket would interleave SSE frames and
    corrupt the stream, so #attachStream hands out a generation and a loop runs only while it is
    #isCurrentStream: -- the newest GET wins and any earlier stream ends itself.
  - #beginClosing then #close, not #close alone: a session being reaped enqueues a last notice, and
    the drain loop has to get a turn before the stream ends or the notice dies with the gem.
No event ids and no Last-Event-ID replay yet -- that is deliberate. Ids are only useful with a
replay buffer behind them, and offering them without one would invite a client to ask for a resume
this server cannot honour.'
%
expectvalue /Class
doit
McpOutbox category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpOutbox
removeallmethods McpOutbox
removeallclassmethods McpOutbox
! ------------------- Class methods for McpOutbox
category: 'instance creation'
classmethod: McpOutbox
new
  ^super new initialize
%
! ------------------- Instance methods for McpOutbox
category: 'queueing'
method: McpOutbox
add: aJsonString
  "Queue one already-serialized JSON-RPC message for the client. Answers true if it was queued,
   false if this outbox is closed or closing -- a caller that is recording a pending request needs
   to know, so it does not wait for an answer to a message that will never be sent.
   On overflow the OLDEST message goes, not this one: the newest state of a long-running operation
   is the interesting one, and the loss is admitted through #droppedCount."
  ^mutex critical: [
    (isOpen and: [isClosing not])
      ifFalse: [false]
      ifTrue: [
        [queue size >= self maxQueueSize] whileTrue: [
          queue removeFirst.
          droppedCount := droppedCount + 1].
        queue addLast: aJsonString.
        true]]
%
category: 'streams'
method: McpOutbox
attachStream
  "Claim this outbox for a newly opened GET stream and answer that stream's generation, which its
   drain loop passes to #isCurrentStream: on every tick. A client is allowed to open several
   streams, but a given message must be written to exactly one, so the rule here is
   latest-GET-wins: a new generation supersedes the previous stream, whose loop sees it is no
   longer current and ends (within one poll interval), taking its socket and GsProcess with it.
   Enforced here rather than left to convention -- two live drainers would interleave frames."
  ^mutex critical: [
    streamGeneration := streamGeneration + 1.
    streamCount := streamCount + 1.
    streamGeneration]
%
category: 'lifecycle'
method: McpOutbox
beginClosing
  "Stop accepting new messages, but leave what is queued deliverable. This is the first half of
   ending a session: the reaper enqueues its session-ending notice, marks the outbox closing, and
   logs the worker gem out; the drain loop then writes what it holds and closes the outbox itself.
   Closing outright instead would drop the notice and leave the client to discover its session had
   ended by meeting a 404 on its next call."
  mutex critical: [isClosing := true]
%
category: 'lifecycle'
method: McpOutbox
close
  "End this outbox for good: no more messages in, and any drain loop exits on its next check.
   Sent by the drain loop once a closing outbox has been flushed, and directly when there is no
   stream to flush to."
  mutex critical: [isClosing := true. isOpen := false]
%
category: 'streams'
method: McpOutbox
detachStream: aGeneration
  "One drain loop has ended. Only the stream count is adjusted: the generation must NOT be rolled
   back, or a superseded stream's exit would make the stream that replaced it look stale."
  mutex critical: [streamCount := (streamCount - 1) max: 0]
%
category: 'queueing'
method: McpOutbox
drain
  "Answer everything queued, oldest first, and clear the queue -- one atomic step, so a message
   enqueued while the drain loop is writing is carried to the next tick rather than lost.
   Answers an empty collection when there is nothing waiting."
  ^mutex critical: [
    | taken |
    taken := queue.
    queue := OrderedCollection new.
    taken]
%
category: 'accessing'
method: McpOutbox
droppedCount
  "How many messages the overflow policy has discarded and not yet reported. Read without clearing;
   the drain loop uses #takeDroppedCount so the client is told once."
  ^mutex critical: [droppedCount]
%
category: 'streams'
method: McpOutbox
hasStream
  "Whether a GET stream is currently draining this outbox. What the reaper asks before probing a
   session: a client with no stream cannot receive a ping or a warning, so there is nothing to be
   gained by queueing one for it."
  ^mutex critical: [streamCount > 0]
%
category: 'initialization'
method: McpOutbox
initialize
  queue := OrderedCollection new.
  mutex := Semaphore forMutualExclusion.
  isOpen := true.
  isClosing := false.
  droppedCount := 0.
  streamGeneration := 0.
  streamCount := 0.
  ^self
%
category: 'testing'
method: McpOutbox
isClosing
  "Whether this outbox is refusing new messages but still has a flush owed to the client."
  ^mutex critical: [isClosing]
%
category: 'streams'
method: McpOutbox
isCurrentStream: aGeneration
  "Whether the stream holding aGeneration is still the one entitled to drain this outbox (see
   #attachStream). False once a newer GET has superseded it."
  ^mutex critical: [streamGeneration = aGeneration]
%
category: 'testing'
method: McpOutbox
isEmpty
  ^mutex critical: [queue isEmpty]
%
category: 'testing'
method: McpOutbox
isOpen
  "Whether a drain loop should keep running. False once the session has ended and its last
   messages have been written."
  ^mutex critical: [isOpen]
%
category: 'accessing'
method: McpOutbox
maxQueueSize
  "How many messages may wait for a stream. Generous for the traffic this carries (a ping, a
   warning, later a progress tick) and small enough that a client which never opens a stream, or
   opens one and stops reading, cannot grow a session without bound."
  ^256
%
category: 'accessing'
method: McpOutbox
size
  ^mutex critical: [queue size]
%
category: 'accessing'
method: McpOutbox
takeDroppedCount
  "Answer how many messages have been dropped since this was last asked, and reset the counter --
   so the drain loop reports a gap exactly once."
  ^mutex critical: [
    | n |
    n := droppedCount.
    droppedCount := 0.
    n]
%
