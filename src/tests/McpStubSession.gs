set compile_env: 0
! ------------------- Class definition for McpStubSession
expectvalue /Class
doit
McpSession subclass: 'McpStubSession'
  instVarNames: #( wasPrepared)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpStubSession comment: 
'A McpSession that spawns no gem: prepareWorker records the call instead of driving a worker over
executeString:. Lets a test exercise McpRouter>>openSessionCreating: -- the one choke point where a
router configures a session AND prepares its worker -- without a login, and lets it assert that the
preparation actually happened rather than only that the values were set.'
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
category: 'initialization'
method: McpStubSession
prepareWorker
  "Record the call; a stub has no worker gem to prepare."
  wasPrepared := true.
  ^self
%
category: 'initialization'
method: McpStubSession
startWithId: anId
  "Record the id and stamp the activity clock -- everything McpSession>>startWithId: does EXCEPT
   spawn and log in a gem. That is what lets a router test register a real, findable, reapable
   session (and drain its outbox) without a NETLDI."
  id := anId.
  readOnly := false.
  ^self touch
%
category: 'accessing'
method: McpStubSession
beReadOnly
  "Make this stub a read-ONLY session. #startWithId: opens read-write, which is the mode most tests
   want; the expiry-renewal rules differ between the two, so both have to be reachable."
  readOnly := true.
  ^self
%
category: 'accessing'
method: McpStubSession
wasPrepared
  ^wasPrepared == true
%
