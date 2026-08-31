set compile_env: 0
! ------------------- Class definition for McpMockSession
expectvalue /Class
doit
McpSession subclass: 'McpMockSession'
  instVarNames: #( mockWorker fakeIdleSeconds fakeQuietProbes
                    workerGemStopped)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpMockSession comment: 
'A real McpSession whose worker gem is a McpMockWorker. It overrides two things only -- the factory
hook McpSession>>newWorkerSession and McpSession>>stopWorkerGem -- so startWithId:, prepareWorker,
forward:, runWorker: and isBusy are the SHIPPING implementations under test, unlike McpStubSession,
which stubs prepareWorker out to test the router''s session bookkeeping without a login.

stopWorkerGem is overridden because it is the one line of McpSession a test must not run: it is
`System stopSession:` on the id captured at login, and the id a mock holds is not a real session''s.
It records the call instead (#workerGemStopped), which is also what a test asserts on to prove a
worker that took neither break was stopped rather than left running.

fakeIdleSeconds: makes a session look idle without waiting. fakeQuietProbes: does the same for the
measure the reaper actually uses -- liveness pings answered with no work in between -- which cannot
simply be recorded before a call, because #runWorker: stamps the activity clock when the call ENDS
as well as when it starts, and that legitimately resets the count. Together they let a test drive
McpRouter>>reapIdleSessions and check that it leaves a session with a call in flight alone.'
%
expectvalue /Class
doit
McpMockSession category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpMockSession
removeallmethods McpMockSession
removeallclassmethods McpMockSession
! ------------------- Class methods for McpMockSession
! ------------------- Instance methods for McpMockSession
category: 'testing support'
method: McpMockSession
fakeIdleSeconds: anIntegerOrNil
  "Report this instead of the real idle time (nil restores the clock)."
  fakeIdleSeconds := anIntegerOrNil
%
category: 'testing support'
method: McpMockSession
fakeQuietProbes: anIntegerOrNil
  "Report this instead of the real confirmation count (nil restores the real one)."
  fakeQuietProbes := anIntegerOrNil
%
category: 'activity'
method: McpMockSession
idleSeconds
  ^fakeIdleSeconds ifNil: [super idleSeconds]
%
category: 'testing support'
method: McpMockSession
mockWorker
  "The mock this session drives, once startWithId: has built it."
  ^mockWorker
%
category: 'initialization'
method: McpMockSession
newWorkerSession
  "The one seam a mock session needs: answer a mock worker where McpSession would answer a
   GsTsExternalSession. Everything else -- the login sends, prepareWorker, forward: -- runs the
   shipping code against it."
  ^mockWorker := McpMockWorker new
%
category: 'testing support'
method: McpMockSession
quietProbes
  ^fakeQuietProbes ifNil: [super quietProbes]
%
category: 'initialization'
method: McpMockSession
stopWorkerGem
  "Record instead of stopping: the shipping method would send `System stopSession:` with the mock's
   invented id, and stop whichever real session happened to be holding that number."
  workerGemStopped := true.
  ^self
%
category: 'testing support'
method: McpMockSession
workerGemStopped
  "Whether this session gave up on its worker and stopped its gem (McpSession>>abandonWorker)."
  ^workerGemStopped == true
%
