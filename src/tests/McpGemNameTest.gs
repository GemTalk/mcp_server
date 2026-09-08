set compile_env: 0
! ------------------- Class definition for McpGemNameTest
expectvalue /Class
doit
GsTestCase subclass: 'McpGemNameTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Mcp
  options: #()

%
expectvalue /Class
doit
McpGemNameTest comment: 
'What this server calls its gems in the shared cache, and the 31-character hole it has to fit in.

Every gem here is a GsTsExternalSession''s, so they all arrive named ''GciTs'': the front end, every
worker, and any unrelated external session on the stone, indistinguishable in the one column of
System cacheStatisticsForAllSlots that is supposed to say who a session is. Three collaborators
answer that, in different hierarchies, which is why they are tested together rather than in the
suites of their own classes: McpBase class holds the setting and the limit, McpRouter names the
front end after its own class and its port, and McpSession builds the worker''s name -- after the
class the front end told it to be, then the front end and the client -- in the FRONT END, because a
worker knows none of the three, and because System cacheName: names only the session that sends it,
so the name has to travel into the worker with the rest of the bootstrap. Both names lead with the
class that is actually running, so neither hard-codes a role name that a vendor subclass would make
a lie.

The limits are MEASURED, and identical on 3.7.2, 3.7.5 and 3.7.6: 31 characters is accepted, 32
raises OutOfRange (error 2061), and so does the empty string. So the interesting cases here are the
two ends of that range and, above all, WHICH END OF A NAME SURVIVES being cut -- a router name
truncated to McpRouter:80 would name a port nothing is listening on.

No gem and no socket: the front-end name is asked of a router that never opened a port, and the
worker name of a McpMockSession, which runs the shipping McpSession code against a mock worker.
The one test that drives the worker END of the bootstrap runs it in THIS session, which is why
every test that can rename this gem goes through #savingGemCacheNameDo:.'
%
expectvalue /Class
doit
McpGemNameTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpGemNameTest
removeallmethods McpGemNameTest
removeallclassmethods McpGemNameTest
! ------------------- Class methods for McpGemNameTest
! ------------------- Instance methods for McpGemNameTest
category: 'helpers'
method: McpGemNameTest
savingGemCacheNameDo: aBlock
  "Run aBlock and put this gem''s shared-cache name back afterwards, whatever it did to it.
   Needed because the thing under test is a property of the RUNNING SESSION, not of an object: a
   test that names this gem renames the topaz or MCP session driving the suite, and leaving it
   renamed would mislabel it in exactly the table this feature exists to make readable. Not a view
   move -- System cacheName: is not transactional and commits nothing -- so this suite needs no
   #movesTheSessionView."
  | prior |
  prior := McpBase gemCacheName.
  ^[aBlock value] ensure: [McpBase nameThisGem: prior]
%
category: 'helpers'
method: McpGemNameTest
sessionWithId: anId
  "A McpSession with anId as its client id and a mock for its worker gem -- so the shipping
   #workerCacheName and #workerBootstrapExpression run with no login and no gem."
  ^McpMockSession startWithId: anId
%
category: 'helpers'
method: McpGemNameTest
stringOfSize: anInteger
  "A filler String of anInteger characters.
   Written out rather than String class>>new:withAll:, which this image does not have -- see
   docs/Development.md on preferring the most basic long-stable selector."
  | s |
  s := String new: anInteger.
  1 to: anInteger do: [:i | s at: i put: $x].
  ^s
%
category: 'tests - the cache limit'
method: McpGemNameTest
testAcceptsTheLongestNameTheCacheTakes
  "31 is legal, and the whole of it lands. The boundary is measured rather than documented, so it is
   pinned from BOTH sides -- see #testTruncatesANameTooLongForTheCache for the other."
  self savingGemCacheNameDo: [ | wanted |
    wanted := self stringOfSize: McpBase maxGemCacheNameSize.
    self assert: (McpBase nameThisGem: wanted) equals: wanted.
    self assert: McpBase gemCacheName equals: wanted]
%
category: 'tests - fitting a name'
method: McpGemNameTest
testFittingAnswersTheSuffixAloneWhenItFillsTheLimit
  "A suffix with no room left for a base answers alone rather than raising on a negative copy length.
   Unreachable from either caller here -- a port is five digits at most -- and pinned because the
   arithmetic is what makes that true, not the callers."
  | suffix |
  suffix := ':' , (self stringOfSize: McpBase maxGemCacheNameSize - 1).
  self assert: (McpBase gemCacheNameFrom: 'McpRouter' keeping: suffix) equals: suffix
%
category: 'tests - fitting a name'
method: McpGemNameTest
testFittingCutsTheBaseAndKeepsTheSuffix
  "THE POINT OF THE WHOLE HELPER. When the two do not fit, the base loses characters and the suffix
   keeps all of them -- because the suffix is what identifies the gem, and a router name cut to
   McpRouter:80 would name a port nothing is listening on. A tail-cut would be the other way round,
   which is what #nameThisGem: does as a last resort, when nothing is left to say which end mattered."
  | base fitted |
  base := self stringOfSize: 40.
  fitted := McpBase gemCacheNameFrom: base keeping: ':8000'.
  self assert: fitted size equals: McpBase maxGemCacheNameSize.
  self assert: (fitted copyFrom: fitted size - 4 to: fitted size) equals: ':8000'.
  self assert: (fitted copyFrom: 1 to: fitted size - 5)
    equals: (base copyFrom: 1 to: McpBase maxGemCacheNameSize - 5)
%
category: 'tests - fitting a name'
method: McpGemNameTest
testFittingLeavesANameThatAlreadyFitsAlone
  "The ordinary case: nothing is cut, and the result is a plain concatenation. Worth pinning because
   an off-by-one in the sizing would show up here as a name silently one character short."
  self assert: (McpBase gemCacheNameFrom: 'McpRouter' keeping: ':8000') equals: 'McpRouter:8000'.
  self assert: (McpBase gemCacheNameFrom: 'McpAuthRouter' keeping: ':8443')
    equals: 'McpAuthRouter:8443'
%
category: 'tests - the cache limit'
method: McpGemNameTest
testNameThisGemAnswersWhatLanded
  "The ordinary round trip: a name the cache accepts is answered back and is what the cache then
   holds. #gemCacheName reads the first field of the session''s cacheStatistics row, which is where
   the name lives -- descriptionOfSession: does not carry it, and that is worth a test because the
   name reads like a session description and is not one."
  self savingGemCacheNameDo: [
    self assert: (McpBase nameThisGem: 'McpRouter:8000') equals: 'McpRouter:8000'.
    self assert: McpBase gemCacheName equals: 'McpRouter:8000']
%
category: 'tests - the cache limit'
method: McpGemNameTest
testNilAndEmptyLeaveTheGemAsItWas
  "Both answer nil and change nothing. nil is what a worker prepared with no name gets (every
   direct-drive test in McpContractTest and McpExtensionTest passes it, and must not rename the
   session running them); the empty string matters because the cache refuses it -- 0 raises
   OutOfRange just as 32 does -- so it has to be dropped here rather than passed on."
  self savingGemCacheNameDo: [
    McpBase nameThisGem: 'McpRouter:9999'.
    self assert: (McpBase nameThisGem: nil) equals: nil.
    self assert: McpBase gemCacheName equals: 'McpRouter:9999'.
    self assert: (McpBase nameThisGem: '') equals: nil.
    self assert: McpBase gemCacheName equals: 'McpRouter:9999']
%
category: 'tests - the front end'
method: McpGemNameTest
testRouterNameFitsTheCache
  "Whatever the class and the port, the front end''s name is something the cache will take -- this is
   the guarantee that lets #runOnPort: apply it without checking."
  self assert: (McpRouter new cacheNameForPort: 8000) size <= McpBase maxGemCacheNameSize.
  self assert: (McpRouter new cacheNameForPort: 65535) size <= McpBase maxGemCacheNameSize.
  self assert: (McpFixtureRouter new cacheNameForPort: 8001) size <= McpBase maxGemCacheNameSize
%
category: 'tests - the front end'
method: McpGemNameTest
testRouterNameReportsTheSubclassThatIsRunning
  "The class name is read off the instance, not written in, because the router class is an extension
   point (McpAuthRouter, McpFixtureRouter). A front end that reported McpRouter while a subclass was
   serving would be the wrong answer to what is this gem, which is the only question the name has to
   answer."
  self assert: (McpFixtureRouter new cacheNameForPort: 8001) equals: 'McpFixtureRouter:8001'
%
category: 'tests - the front end'
method: McpGemNameTest
testRouterNamesItselfByClassAndPort
  "The format an operator reads in the session list, and the one a supervising process can look up
   with System cacheStatisticsForProcessWithCacheName:. The port is in it because that is how a
   running server is identified here -- ./stop-server.sh takes one, and several routers can serve one
   stone at once."
  self assert: (McpRouter new cacheNameForPort: 8000) equals: 'McpRouter:8000'
%
category: 'tests - the cache limit'
method: McpGemNameTest
testTruncatesANameTooLongForTheCache
  "One character over the limit is the case that would otherwise raise, and the reason this truncates
   at all: a label that does not fit is not a reason to fail a login or refuse to start a server. The
   answer is the name that LANDED, not the name that was asked for."
  self savingGemCacheNameDo: [ | applied |
    applied := McpBase nameThisGem: (self stringOfSize: McpBase maxGemCacheNameSize + 1).
    self assert: applied size equals: McpBase maxGemCacheNameSize.
    self assert: McpBase gemCacheName equals: applied.
    applied := McpBase nameThisGem: (self stringOfSize: 200).
    self assert: applied size equals: McpBase maxGemCacheNameSize.
    self assert: McpBase gemCacheName equals: applied]
%
category: 'tests - the worker'
method: McpGemNameTest
testWorkerAppliesTheNameTheFrontEndSent
  "The worker END of the bootstrap: the name the front end built is applied to the gem that runs the
   tools. Driven in THIS session, since that is what a worker gem is here -- hence the restore.
   Also pins the nil case, which is not an edge: every direct-drive bootstrap test in the other
   suites passes cacheName: nil, and would rename the session running it if nil did anything."
  self savingGemCacheNameDo: [
    SessionTemps current removeKey: #McpServer ifAbsent: [nil].
    SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil].
    [McpServer prepareWorkerWithToolsets: #() options: nil readOnly: false
       serverName: nil title: nil version: nil frontEnd: nil cacheName: 'McpServer:9:feedface'.
     self assert: McpBase gemCacheName equals: 'McpServer:9:feedface'.
     McpServer prepareWorkerWithToolsets: #() options: nil readOnly: false
       serverName: nil title: nil version: nil frontEnd: nil cacheName: nil.
     self assert: McpBase gemCacheName equals: 'McpServer:9:feedface']
      ensure: [
        SessionTemps current removeKey: #McpServer ifAbsent: [nil].
        SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil]]]
%
category: 'tests - the worker'
method: McpGemNameTest
testWorkerNameKeepsTheClientWhenTheClassNameIsLong
  "The worker''s class name is a deployment''s to choose, so unlike the front end''s it can genuinely
   crowd out the rest -- and when it does, the two identifying fields survive whole and the CLASS is
   what loses characters. A name cut the other way would identify neither the server nor the client,
   which is everything the second and third fields are for."
  | sess suffix |
  sess := self sessionWithId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'.
  sess workerClassName: 'AcmeExtremelyLongVendorWorkerServer'.
  suffix := ':' , System session printString , ':a1b2c3d4'.
  self assert: sess workerCacheName size equals: McpBase maxGemCacheNameSize.
  self assert: (sess workerCacheName endsWith: suffix).
  self assert: (sess workerCacheName copyFrom: 1 to: sess workerCacheName size - suffix size)
    equals: ('AcmeExtremelyLongVendorWorkerServer'
      copyFrom: 1 to: McpBase maxGemCacheNameSize - suffix size)
%
category: 'tests - the worker'
method: McpGemNameTest
testWorkerNameReportsTheWorkerClassThatIsRunning
  "Read off #workerClassName -- the class the FRONT END named and the worker therefore instantiated --
   not written in, for the same reason the front end reads its own class: a vendor running
   McpFixtureServer should see that, not the word this project would otherwise have made up. The
   router''s twin is #testRouterNameReportsTheSubclassThatIsRunning."
  | sess |
  sess := self sessionWithId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'.
  sess workerClassName: 'McpFixtureServer'.
  self assert: sess workerCacheName
    equals: 'McpFixtureServer:' , System session printString , ':a1b2c3d4'
%
category: 'tests - the worker'
method: McpGemNameTest
testWorkerNameShortensTheClientIdToEightCharacters
  "A session id is 32 hex characters (McpRouter>>nextSessionId), which would not fit the cache even
   alone, so the name carries its head. Eight is a PREFIX of what the router logs, which is what
   makes the log greppable from the row, and it keeps the name unique -- so
   cacheStatisticsForProcessWithCacheName: answers one gem rather than an arbitrary one of several.
   An id shorter than eight is left whole rather than padded or refused."
  | sess |
  sess := self sessionWithId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'.
  self assert: sess workerCacheName size <= McpBase maxGemCacheNameSize.
  self assert: (sess workerCacheName endsWith: ':a1b2c3d4').
  sess := self sessionWithId: 'abc'.
  self assert: (sess workerCacheName endsWith: ':abc')
%
category: 'tests - the worker'
method: McpGemNameTest
testWorkerNamesItselfByClassFrontEndAndClient
  "All three fields, in the shape the front end uses for itself: the class it is running, then the
   two that make the row answer on its own -- the FRONT END''s stone session id (the sessionId column
   of the router''s own row, so a stone running several routers still sorts into servers) and the head
   of the MCP session id, which is what the router logs in full. McpServer is the default worker
   class, so that is what an unconfigured session reports."
  | sess |
  sess := self sessionWithId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'.
  self assert: sess workerCacheName
    equals: 'McpServer:' , System session printString , ':a1b2c3d4'
%
category: 'tests - the worker'
method: McpGemNameTest
testWorkerNameTravelsInTheBootstrapExpression
  "The name has to REACH the worker, and this is how: printString-quoted in the one expression
   prepareWorker runs, because System cacheName: names only the session that sends it, so the front
   end cannot apply this from outside."
  | sess expr |
  sess := self sessionWithId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'.
  expr := sess workerBootstrapExpression.
  self assert: (expr indexOfSubCollection:
    'cacheName: ' , sess workerCacheName printString) > 0
%
