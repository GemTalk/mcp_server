set compile_env: 0
! ------------------- Class definition for McpFixtureRouter
expectvalue /Class
doit
McpRouter subclass: 'McpFixtureRouter'
  instVarNames: #( loggedLines fakeCommitsBehind fakeBacklogCritical
                    fakeOldestCrSessions)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpFixtureRouter comment: 
'A McpRouter that reports itself running without ever binding a socket, so a test can drive the SSE
drain loop (McpRouter>>serveGetStream:forSession:) against a McpMockSocket.

That loop is the whole server-to-client pathway, and its exit conditions are the interesting part:
without this the loop could only be tested in the state where it does nothing -- a stopped router
leaves it immediately. Everything else about the router is the shipping implementation.

A mock socket is at EOF the moment its scripted input runs out, so McpHttpConnection>>clientHasClosed
answers true and the loop ends after ONE full pass. That is exactly the disconnect it is meant to
detect, and it is also what keeps a test from hanging.

Every interval a test needs to bend -- the pending-request timeout, the idle deadline, the probe
cadence -- is ordinary router config (McpRouter>>sessionIdleTimeoutSeconds: and friends), which this
fixture leaves alone. The single exception is #streamLossGraceSeconds, and it is not a policy the
fixture is bending: a mock socket is at EOF from the start, so EVERY stream test ends by the
client-went-away path, and a shipping grace would charge each of them a real ten-second wait for a
reconnect that no mock will ever make. A test that wants the fast release asks for it by name.

The third seam is the three stone readings view hygiene depends on -- how far behind a worker''s view
is, whether the repository is over its own commit-record backlog threshold, and which sessions hold
the oldest record. Faked here (#fakeCommitsBehind: and friends) because a test cannot make a stone
have a backlog, and cannot make a session it never logged in be twenty commits behind, without a
second gem and a netldi. What is left under test is the part worth testing: the DECISION those three
numbers feed. The readings themselves are thin wrappers over stone primitives and are checked
against a real stone separately, unfaked.

The second seam is the log. #log: is captured into #loggedLines instead of reaching the gem log,
which is what lets a test assert on what the ROUTER decided to record -- above all the message
trace, whose whole point is that a line appears (McpRouter>>traceRequest:). Capturing also keeps a
suite from writing its fixtures into the log of whatever gem happened to run it.'
%
expectvalue /Class
doit
McpFixtureRouter category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpFixtureRouter
removeallmethods McpFixtureRouter
removeallclassmethods McpFixtureRouter
! ------------------- Class methods for McpFixtureRouter
! ------------------- Instance methods for McpFixtureRouter
category: 'testing support'
method: McpFixtureRouter
commitsBehindFor: sess
  ^fakeCommitsBehind ifNil: [super commitsBehindFor: sess]
%
category: 'testing support'
method: McpFixtureRouter
fakeBacklogCritical: aBooleanOrNil
  "Report this instead of asking the stone whether its commit-record backlog is over threshold
   (nil restores the real reading)."
  fakeBacklogCritical := aBooleanOrNil
%
category: 'testing support'
method: McpFixtureRouter
fakeCommitsBehind: anIntegerOrNil
  "Report this as EVERY session's commits-behind instead of reading each worker's session
   description (nil restores the real reading)."
  fakeCommitsBehind := anIntegerOrNil
%
category: 'testing support'
method: McpFixtureRouter
fakeOldestCrSessions: anArrayOrNil
  "Report these as the stone session ids holding the oldest commit record open (nil restores the
   real reading). An empty Array is a real answer -- nobody does -- and is not the same as nil."
  fakeOldestCrSessions := anArrayOrNil
%
category: 'initialization'
method: McpFixtureRouter
initialize
  "The shipping router, with the stream-loss grace seeded to nil instead of ten seconds: no wait and
   no fast release, so a stream test's session is left exactly where the loop left it and can be
   asserted on. It is seeded rather than overridden so that a test which DOES want the fast release
   turns it on the ordinary way -- #streamLossGraceSeconds: 0 -- and gets it."
  super initialize.
  self streamLossGraceSeconds: nil.
  loggedLines := OrderedCollection new.
  "nil = do not fake it, use the shipping implementation. Not false/0, which would be an answer."
  fakeCommitsBehind := nil.
  fakeBacklogCritical := nil.
  fakeOldestCrSessions := nil.
  ^self
%
category: 'running'
method: McpFixtureRouter
isRunning
  "Running, with no listener behind it. The one seam a stream test needs."
  ^true
%
category: 'logging'
method: McpFixtureRouter
log: aString
  "Capture instead of writing to the gem log -- see the class comment."
  loggedLines add: aString.
  ^self
%
category: 'logging'
method: McpFixtureRouter
loggedLines
  "Every line this router has logged, oldest first."
  ^loggedLines
%
category: 'testing support'
method: McpFixtureRouter
sessionsHoldingOldestCr
  ^fakeOldestCrSessions ifNil: [super sessionsHoldingOldestCr]
%
category: 'testing support'
method: McpFixtureRouter
stoneBacklogCritical
  ^fakeBacklogCritical ifNil: [super stoneBacklogCritical]
%
