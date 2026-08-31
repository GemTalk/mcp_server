set compile_env: 0
! ------------------- Class definition for McpMockSession
expectvalue /Class
doit
McpSession subclass: 'McpMockSession'
  instVarNames: #( mockWorker fakeIdleSeconds mockCorrupts
                    fakeQuietProbes)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpMockSession comment: 
'A real McpSession whose worker gem is a McpMockWorker. It overrides nothing but the factory hook
McpSession>>newWorkerSession, so startWithId:, prepareWorker, forward:, runWorker: and isBusy are
the SHIPPING implementations under test -- unlike McpStubSession, which stubs prepareWorker out to
test the router''s session bookkeeping without a login.

fakeIdleSeconds: makes a session look idle without waiting. fakeQuietProbes: does the same for the
measure the reaper actually uses -- liveness pings answered with no work in between -- which cannot
simply be recorded before a call, because #runWorker: stamps the activity clock when the call ENDS
as well as when it starts, and that legitimately resets the count. Together they let a test drive
McpRouter>>reapIdleSessions and check that it leaves a session with a call in flight alone.

startWithId:corrupting: builds a worker that returns large results the way GemStone before 3.7.4.1
does, so the whole of McpSession>>verifyWorkerResultFidelity -- probe, workaround, re-probe -- runs
against it on any image (GemStone kernel bug #51438, fixed in 3.7.4.1).'
%
expectvalue /Class
doit
McpMockSession category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpMockSession
removeallmethods McpMockSession
removeallclassmethods McpMockSession
! ------------------- Class methods for McpMockSession
category: 'instance creation'
classmethod: McpMockSession
startWithId: anId corrupting: aBoolean
  "A started mock session whose worker corrupts large results when aBoolean -- an image with kernel
   bug #51438. The flag has to be set before startWithId:, because that is what builds the worker and
   then probes it."
  ^self new
    simulateResultCorruption: aBoolean;
    startWithId: anId
%
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
   GsTsExternalSession. Everything else -- the login sends, the fidelity probe, prepareWorker,
   forward: -- runs the shipping code against it."
  ^mockWorker := McpMockWorker new
    simulateResultCorruption: mockCorrupts == true;
    yourself
%
category: 'testing support'
method: McpMockSession
quietProbes
  ^fakeQuietProbes ifNil: [super quietProbes]
%
category: 'testing support'
method: McpMockSession
simulateResultCorruption: aBoolean
  "Whether the worker this session is about to build corrupts large results (kernel bug #51438).
   Send it before startWithId:; see McpMockSession class>>startWithId:corrupting:."
  mockCorrupts := aBoolean
%
