set compile_env: 0
! ------------------- Class definition for McpStubSession
expectvalue /Class
doit
McpSession subclass: 'McpStubSession'
  instVarNames: #( wasPrepared fakeWorkerStoneSession fakeRefreshVerdict
                    fakeRefreshVerdictSet refreshRequests fakeIsBusy viewReleaseRequests)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Mcp
  options: #()

%
expectvalue /Class
doit
McpStubSession comment: 
'A McpSession that spawns no gem: prepareWorker records the call instead of driving a worker over
executeString:. Lets a test exercise McpRouter>>openSessionCreating: -- the one choke point where a
router configures a session AND prepares its worker -- without a login, and lets it assert that the
preparation actually happened rather than only that the values were set.

Because nothing logged in, #workerStoneSession is nil -- which is a real state worth testing against
(a session that cannot be measured or matched to a row in System currentSessions) and a nuisance
everywhere else. #fakeWorkerStoneSession: supplies one, including this session''s own id, which is the
one id whose description a test can read without the SessionAccess privilege.

#refreshWorkerView is stubbed for the same reason #prepareWorker is: there is no gem to send
McpServer refreshViewForFrontEnd to. It records the ask (#refreshRequests) and answers a verdict a
test can choose (#fakeRefreshVerdict:, ''kept'' by default), which is what lets the router''s
decision -- WHICH sessions get refreshed, and what it does with each answer -- be tested without a
login. The worker-side act itself is McpServer''s, and is tested where it lives.'
%
expectvalue /Class
doit
McpStubSession category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpStubSession
removeallmethods McpStubSession
removeallclassmethods McpStubSession
! ------------------- Class methods for McpStubSession
! ------------------- Instance methods for McpStubSession
category: 'testing support'
method: McpStubSession
fakeIsBusy: aBoolean
  "Report this instead of asking the (absent) worker whether a call is in flight. The busy case is
   the one arm of view hygiene that acts on a RUNNING call, and a stub has no call to run."
  fakeIsBusy := aBoolean
%
category: 'testing support'
method: McpStubSession
fakeRefreshVerdict: aStringOrNil
  "What #refreshWorkerView should answer: 'kept', 'doomed', a 'stuck: ...' phrase, or nil for the
   session that could not be asked at all. nil is a real answer here and not 'use the default',
   which is why #refreshWorkerView tests the instance variable rather than the value."
  fakeRefreshVerdict := aStringOrNil.
  fakeRefreshVerdictSet := true
%
category: 'testing support'
method: McpStubSession
fakeWorkerStoneSession: anIntegerOrNil
  "Report this as the worker gem's stone session id (nil restores the real one, which for a stub
   that never logged in is also nil)."
  fakeWorkerStoneSession := anIntegerOrNil
%
category: 'testing support'
method: McpStubSession
isBusy
  ^fakeIsBusy ifNil: [super isBusy]
%
category: 'initialization'
method: McpStubSession
prepareWorker
  "Record the call; a stub has no worker gem to prepare."
  wasPrepared := true.
  ^self
%
category: 'testing support'
method: McpStubSession
refreshRequests
  "How many times the front end has asked this session to refresh its worker's view. What proves the
   arm actually asked, rather than only that it counted."
  ^refreshRequests ifNil: [0]
%
category: 'testing support'
method: McpStubSession
refreshWorkerView
  "Record the ask and answer the chosen verdict (see #fakeRefreshVerdict:). No gem, so nothing is
   sent."
  refreshRequests := self refreshRequests + 1.
  ^fakeRefreshVerdictSet == true ifTrue: [fakeRefreshVerdict] ifFalse: ['kept']
%
category: 'testing support'
method: McpStubSession
requestViewRelease
  "Record the ask and answer what the shipping implementation would. Counted rather than merely
   flagged, so a test can tell 'asked once' from 'asked on every pass since'."
  viewReleaseRequests := self viewReleaseRequests + 1.
  ^super requestViewRelease
%
category: 'initialization'
method: McpStubSession
startWithId: anId
  "Record the id and stamp the activity clock -- everything McpSession>>startWithId: does EXCEPT
   spawn and log in a gem. That is what lets a router test register a real, findable, reapable
   session (and drain its outbox) without a NETLDI."
  id := anId.
  ^self touch
%
category: 'testing support'
method: McpStubSession
viewReleaseRequests
  "How many times the front end has asked this session to give up the view its call is holding."
  ^viewReleaseRequests ifNil: [0]
%
category: 'accessing'
method: McpStubSession
wasPrepared
  ^wasPrepared == true
%
category: 'testing support'
method: McpStubSession
workerStoneSession
  ^fakeWorkerStoneSession ifNil: [super workerStoneSession]
%
