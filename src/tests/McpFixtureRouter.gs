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
cadence -- is now ordinary router config (McpRouter>>sessionIdleTimeoutSeconds: and friends), so this
fixture no longer overrides any of them.'
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
category: 'testing support'
method: McpFixtureRouter
pretendLastMaintenanceWasSecondsAgo: anInteger
  "Backdate the maintenance clock so #noteMaintenanceTick sees a pass that came back late. The seam
   the suspend detector needs: the real thing measures a gap no test can produce without sleeping
   through it, and the alternative -- a setter on the shipping class -- would exist for nobody else."
  lastMaintenanceAtSeconds := System timeGmt - anInteger
%
