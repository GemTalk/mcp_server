set compile_env: 0
! ------------------- Class definition for McpFixtureRouter
expectvalue /Class
doit
McpRouter subclass: 'McpFixtureRouter'
  instVarNames: #()
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
reconnect that no mock will ever make. A test that wants the fast release asks for it by name.'
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
category: 'running'
method: McpFixtureRouter
isRunning
  "Running, with no listener behind it. The one seam a stream test needs."
  ^true
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
  ^self
%
