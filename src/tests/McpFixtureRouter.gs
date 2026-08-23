set compile_env: 0
! ------------------- Class definition for McpFixtureRouter
expectvalue /Class
doit
McpRouter subclass: 'McpFixtureRouter'
  instVarNames: #( pendingTimeoutOrNil)
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

It also lets a test shorten the pending-request timeout, so the unanswered-ping path can be reached
without waiting out the real 30 seconds.'
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
pendingRequestTimeoutSeconds
  "The configured timeout, or the shipping one when nothing overrode it."
  ^pendingTimeoutOrNil ifNil: [super pendingRequestTimeoutSeconds]
%
category: 'testing support'
method: McpFixtureRouter
pendingRequestTimeoutSeconds: anIntegerOrNil
  "Shorten (or restore, with nil) how long a server-initiated request may go unanswered. -1 expires
   a request the instant it is sent, which is how a test reaches the liveness-failed path."
  pendingTimeoutOrNil := anIntegerOrNil
%
