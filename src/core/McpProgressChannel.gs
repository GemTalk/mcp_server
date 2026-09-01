set compile_env: 0
! ------------------- Class definition for McpProgressChannel
expectvalue /Class
doit
Object subclass: 'McpProgressChannel'
  instVarNames: #( callId progressToken sessionId
                    queue mutex droppedCount lastProgress)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpProgressChannel comment: 
'One in-flight tool call''s queue of progress notifications, waiting for the SSE stream that is
answering that very call.

REQUEST-SCOPED, which is the whole difference between this and McpOutbox. An outbox belongs to a
SESSION and drains onto the standalone GET stream; this belongs to ONE CALL and drains onto the
response stream of the POST that started it. notifications/progress may travel nowhere else -- it is
request-scoped in every revision of the spec, and the draft bars it from a long-lived stream
outright -- so the two queues are not the same thing wearing different names, and an outbox''s stream
generations and closing states mean nothing here: this queue''s stream ends when the call is
answered.

Held by McpRouter in its callId -> channel map, under that map''s own mutex; created before the
worker is called and unregistered in an ensure: as the call returns, so a raising tool cannot leak
one.

What it holds is what the ROUTER needs and the worker must not have:
  callId          opaque, minted by the front end, the only name the worker knows
  progressToken   the CLIENT''s token, which never crosses into the worker gem
  sessionId       whose worker may write here
  lastProgress    the last value passed on, so a non-increasing tick is refused
The split matters: a worker that never learns the client''s token cannot address a notification to
the wrong client''s stream, however wrong it gets its own bookkeeping.

Its queueing protocol -- #add:, #drain, #takeDroppedCount, #size, #isEmpty -- is deliberately the
same as McpOutbox''s, so McpRouter>>drain:to: writes either one onto a socket without knowing which
it has.

Bounded at #maxQueueSize, dropping the OLDEST on overflow: for a long-running operation the newest
state is the interesting one, and a client that has fallen behind wants where the job is now, not
where it was.'
%
expectvalue /Class
doit
McpProgressChannel category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpProgressChannel
removeallmethods McpProgressChannel
removeallclassmethods McpProgressChannel
! ------------------- Class methods for McpProgressChannel
category: 'instance creation'
classmethod: McpProgressChannel
callId: aCallId progressToken: aToken sessionId: aSessionId
  "A channel for one call: the front end's own name for it, the token the CLIENT asked to be
   addressed by, and the session whose worker is entitled to write here."
  ^self new setCallId: aCallId progressToken: aToken sessionId: aSessionId
%
category: 'instance creation'
classmethod: McpProgressChannel
new
  ^super new initialize
%
! ------------------- Instance methods for McpProgressChannel
category: 'queueing'
method: McpProgressChannel
add: aJsonString
  "Queue one already-serialized notification for the client. Answers whether it was queued.
   On overflow the OLDEST goes, not this one -- see the class comment -- and the loss is admitted
   through #droppedCount rather than hidden."
  ^mutex critical: [
    [queue size >= self maxQueueSize] whileTrue: [
      queue removeFirst.
      droppedCount := droppedCount + 1].
    queue addLast: aJsonString.
    true]
%
category: 'accessing'
method: McpProgressChannel
callId
  ^callId
%
category: 'queueing'
method: McpProgressChannel
drain
  "Answer everything queued, oldest first, and clear the queue -- one atomic step, so a tick that
   arrives while the answer is being written is carried to the next pass rather than lost."
  ^mutex critical: [
    | taken |
    taken := queue.
    queue := OrderedCollection new.
    taken]
%
category: 'accessing'
method: McpProgressChannel
droppedCount
  "How many notifications the overflow policy has discarded and not yet reported."
  ^mutex critical: [droppedCount]
%
category: 'initialization'
method: McpProgressChannel
initialize
  queue := OrderedCollection new.
  mutex := Semaphore forMutualExclusion.
  droppedCount := 0.
  ^self
%
category: 'testing'
method: McpProgressChannel
isEmpty
  ^mutex critical: [queue isEmpty]
%
category: 'accessing'
method: McpProgressChannel
maxQueueSize
  "How many notifications may wait for the writer to get a turn. 64: the writer is the GsProcess
   answering this very call and it drains on every wait, so a backlog this deep means the client has
   stopped reading -- at which point the newest tick is the only one with any value left."
  ^64
%
category: 'queueing'
method: McpProgressChannel
noteProgress: aNumberOrNil
  "Answer whether aNumberOrNil may be passed on as this call's next progress value, recording it if
   so. Both revisions of the spec require progress to increase STRICTLY, so a tick that repeats or
   goes backwards is refused here.
   Checked at this end as well as at the source. The reporter in the worker rate-limits and enforces
   the same rule, but it is on the far side of a Stone-mediated queue that can drop messages under
   load, and it is the worker -- the thing running arbitrary tool code -- that would be wrong. This
   is the end that owes the client a conforming stream, so this is where the guarantee belongs.
   A nil is refused rather than treated as zero: a payload with no progress in it is malformed, and
   passing it on would put a notification with no `progress` field on the wire."
  aNumberOrNil isNil ifTrue: [^false].
  (aNumberOrNil isKindOf: Number) ifFalse: [^false].
  ^mutex critical: [
    (lastProgress notNil and: [aNumberOrNil <= lastProgress])
      ifTrue: [false]
      ifFalse: [lastProgress := aNumberOrNil. true]]
%
category: 'accessing'
method: McpProgressChannel
progressToken
  "The token the CLIENT put in params._meta, which every notification on this channel is addressed
   by. Kept here and never sent to the worker."
  ^progressToken
%
category: 'accessing'
method: McpProgressChannel
sessionId
  ^sessionId
%
category: 'initialization'
method: McpProgressChannel
setCallId: aCallId progressToken: aToken sessionId: aSessionId
  callId := aCallId.
  progressToken := aToken.
  sessionId := aSessionId.
  ^self
%
category: 'accessing'
method: McpProgressChannel
size
  ^mutex critical: [queue size]
%
category: 'accessing'
method: McpProgressChannel
takeDroppedCount
  "Answer how many have been dropped since this was last asked, and reset -- so a gap is logged
   exactly once."
  ^mutex critical: [
    | n |
    n := droppedCount.
    droppedCount := 0.
    n]
%
