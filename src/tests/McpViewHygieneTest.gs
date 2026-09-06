set compile_env: 0
! ------------------- Class definition for McpViewHygieneTest
expectvalue /Class
doit
GsTestCase subclass: 'McpViewHygieneTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpViewHygieneTest comment: 
'What the FRONT END does about database views -- its own, and later its workers''.

A front end is the one gem here with no use for a view. It owns the socket, the session map and the
reaper; it makes no repository changes at all; and every database thing it does is a stone primitive
or a lookup by name. A view it never moves is therefore not neutral, it is a commit record the stone
cannot dispose of -- and measured on a live stone, a front end left in transaction was the sole
holder of the OLDEST commit record, its last transaction boundary being its own login 15.4 hours
earlier, with nothing in the product or the stone that was ever going to move it.

So a detached front end runs #transactionless and moves its view once per maintenance pass. This
suite covers both halves and the seam between them:
  - config: which mode a front end asks for, that a name nobody implements is refused where the
    router is being configured rather than in the gem that serves clients, and that the setting
    survives the trip into a forked child (config reaches a detached gem only as JSON in a fork
    string, so a setting that does not round-trip is one that silently reverts).
  - the refresh: that it takes a whole new view, leaves the transaction mode alone, and is what a
    maintenance pass begins with.
  - the bug detector: the front end writing to the repository is a defect, and out of transaction it
    is a SILENT one -- the write is allowed, sets needsCommit, and is discarded by the next abort
    with no error anywhere. One log line is all that stands between that and losing it.

And the WORKERS'' views, which is the other half of the same policy: how far behind the repository
each worker gem''s view has fallen, whether that is far enough to act on, and -- the part that took a
measurement to get right -- that pressure on the stone is never on its own a reason to move a
particular client''s view. Faked through McpFixtureRouter''s seams, since a test cannot give a stone a
backlog; the stone readings themselves are asserted unfaked, against the stone running the test.

PURELY IN-IMAGE: no worker gem, so no NETLDI. But it declares #movesTheSessionView, because its
subject is this gem''s view and there is no version of these tests that leaves the caller''s alone.'
%
expectvalue /Class
doit
McpViewHygieneTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpViewHygieneTest
removeallmethods McpViewHygieneTest
removeallclassmethods McpViewHygieneTest
! ------------------- Class methods for McpViewHygieneTest
category: 'session view'
classmethod: McpViewHygieneTest
movesTheSessionView
  "Why this suite cannot be run from a session that has uncommitted work. See
   McpTestingToolset class>>sessionViewRefusalFor:, which is what asks.
   Irreducible: #refreshFrontEndView aborts the session that runs it, which is the whole point of
   it, and one test dirties this session on purpose to prove that the abort discards the write."
  ^'it aborts this session to exercise the front end''s view refresh, and dirties it first to prove the refresh discards uncommitted work'
%
! ------------------- Instance methods for McpViewHygieneTest
category: 'helpers'
method: McpViewHygieneTest
commitsBehindOfThisSession
  "How many commits have happened since THIS session took its view (descriptionOfSession: field 16).
   A session may read its own description with no SessionAccess privilege, which is what makes this
   usable from a test running as an ordinary user."
  ^(System descriptionOfSession: System session) at: 16
%
category: 'helpers'
method: McpViewHygieneTest
hygieneLinesIn: aFixtureRouter
  "The captured log lines this arm wrote. One per session it judged over the line."
  ^aFixtureRouter loggedLines select: [:l | (l findString: 'view hygiene' startingAt: 1) > 0]
%
category: 'helpers'
method: McpViewHygieneTest
identifiedSessionOn: aRouter
  "A registered session carrying a plausible worker stone session id, for the tests where the id is
   what the decision turns on (which sessions hold the oldest commit record). 4242 is not this
   stone's session -- it does not need to be, because those tests fake the reading."
  | sess |
  sess := self sessionOn: aRouter.
  sess fakeWorkerStoneSession: 4242.
  ^sess
%
category: 'helpers'
method: McpViewHygieneTest
logLineMatching: aSubstring in: aFixtureRouter
  "The first captured log line containing aSubstring, or nil. McpFixtureRouter captures #log: into
   #loggedLines instead of writing the gem log."
  ^aFixtureRouter loggedLines
    detect: [:l | (l findString: aSubstring startingAt: 1) > 0]
    ifNone: [nil]
%
category: 'helpers'
method: McpViewHygieneTest
scratchKey
  "A UserGlobals key this suite writes to make its session dirty on purpose. Never committed: every
   test that writes it aborts, and the abort is usually the thing being tested."
  ^#McpViewHygieneTestScratch
%
category: 'helpers'
method: McpViewHygieneTest
sessionOn: aRouter
  "A registered session with no login: McpStubSession stubs #prepareWorker out, so the router's own
   bookkeeping runs and no gem is forked. Its #workerStoneSession is nil, which is exactly the
   'cannot be measured' case -- a test that wants a measurable one asks for #identifiedSessionOn:."
  ^aRouter openSessionCreating: [:newId | McpStubSession startWithId: newId]
%
category: 'tests - config'
method: McpViewHygieneTest
testABadModeInAForkStringFailsInTheChildGem
  "applyConfig: routes this one key through its SETTER rather than assigning the ivar, so a name that
   is not a transaction mode fails on arrival instead of being handed to #asSymbol -- where it would
   reach System transactionMode: as a symbol nobody implements, be swallowed by
   #applyFrontEndTransactionMode's error handler, and leave the gem quietly in transaction."
  self should: [McpRouter new applyConfig:
    (Dictionary new at: 'frontEndTransactionMode' put: 'transactionles'; yourself)] raise: Error
%
category: 'tests - the bug detector'
method: McpViewHygieneTest
testACleanFrontEndSaysNothing
  "The other half of the same bargain: the line above has to mean something when it appears, so an
   ordinary refresh of a clean view is silent. A pass that logged every time would make the one that
   matters unfindable."
  | r |
  r := McpFixtureRouter new.
  System abortTransaction.
  r refreshFrontEndView.
  self assert: (self logLineMatching: 'BUG' in: r) isNil
%
category: 'tests - config'
method: McpViewHygieneTest
testAConfigThatSaysNothingAboutTheModeKeepsTheDefault
  "The absent-versus-present distinction every other router setting observes: a config with no
   opinion leaves the seeded default, and does not read as nil -- which here could only mean 'keep
   whatever STN_GEM_INITIAL_TRANSACTION_MODE gave this gem', the pinned-view behaviour the default
   exists to end."
  | r |
  r := McpRouter new.
  r applyConfig: (Dictionary new at: 'serverName' put: 'unrelated'; yourself).
  self assert: r frontEndTransactionMode equals: 'transactionless'
%
category: 'tests - the bug detector'
method: McpViewHygieneTest
testAFrontEndWithUncommittedChangesIsReportedAsABug
  "Nothing in McpRouter is supposed to write to the repository -- that is what makes #transactionless
   safe for it. The danger of the mode is what happens if that ever stops being true: out of
   transaction a write to a committed object is ALLOWED, sets needsCommit, and is discarded by the
   next abort with NO error raised anywhere, where the same mistake in an in-transaction gem would at
   least raise 2030 at a commit. This log line is the only thing that would ever say so.
   The scratch key is written on purpose and never reaches the repository: the refresh below aborts
   it, and that discarding is the second half of what is being tested."
  | r globals |
  r := McpFixtureRouter new.
  System abortTransaction.
  globals := System myUserProfile objectNamed: #UserGlobals.
  globals at: self scratchKey put: 42.
  self assert: System needsCommit.
  r refreshFrontEndView.
  self deny: System needsCommit.
  self deny: (globals includesKey: self scratchKey).
  self assert: (self logLineMatching: 'BUG: the front end gem has uncommitted changes' in: r) notNil
%
category: 'tests - the refresh'
method: McpViewHygieneTest
testAMaintenancePassMovesThisGemsView
  "The pass is where the front end's view hygiene actually happens, and it happens FIRST: everything
   after it reasons about the repository as it is now rather than as it was at login. Asserted
   through the observable consequence -- after a pass, no commits have happened since this session
   took its view, which can only be true if the pass took a new one."
  | r |
  r := McpFixtureRouter new.
  self assert: r maintainSessions equals: 0.
  self assert: self commitsBehindOfThisSession equals: 0
%
category: 'tests - worker views'
method: McpViewHygieneTest
testAMeasurementThatCannotBeTakenIsSkippedNotGuessed
  "A session with no readable stone id -- never logged in, or logged out between the snapshot and
   the query -- is passed over. It must not be recorded as 0, which would read as 'up to date' and
   is the one wrong answer here: nil and 0 are different facts and only one of them is a reason to
   leave a session alone."
  | r sess |
  r := McpFixtureRouter new.
  sess := self sessionOn: r.
  self assert: (r commitsBehindFor: sess) isNil.
  self assert: r maintainViewHygiene equals: 0.
  self assert: sess commitsBehind isNil.
  self assert: (self hygieneLinesIn: r) isEmpty
%
category: 'tests - config'
method: McpViewHygieneTest
testAModeNobodyImplementsIsRefusedAtTheSetter
  "Checked in the session doing the configuring, because the failure it prevents is invisible: a typo
   that leaves the front end in transaction costs nothing observable for hours and then shows up as a
   stone full of commit records. #manualBegin is a real GemStone mode and is still refused -- this
   class offers two, and a mode it does not reason about is not a mode it should accept."
  self should: [McpRouter new frontEndTransactionMode: 'transactionles'] raise: Error.
  self should: [McpRouter new frontEndTransactionMode: 'manualBegin'] raise: Error.
  self should: [McpRouter new frontEndTransactionMode: nil] raise: Error.
  self should: [McpRouter new frontEndTransactionMode: 42] raise: Error.
  "and both offered names are accepted"
  self assert: (McpRouter new frontEndTransactionMode: 'transactionless'; yourself)
    frontEndTransactionMode equals: 'transactionless'.
  self assert: (McpRouter new frontEndTransactionMode: 'autoBegin'; yourself)
    frontEndTransactionMode equals: 'autoBegin'.
  "A Symbol is a CharacterCollection, so it is taken and NORMALIZED rather than refused: the mode is
   sent to System transactionMode: as a symbol anyway, and a caller who wrote one meant it. What
   matters is that the ivar holds a String either way, because that is what has to survive the trip
   through JSON into a forked gem -- a Symbol would come back a String there regardless, and a getter
   whose answer depended on how it was set is a comparison waiting to fail."
  self assert: (McpRouter new frontEndTransactionMode: #autoBegin; yourself)
    frontEndTransactionMode equals: 'autoBegin'
%
category: 'tests - the refresh'
method: McpViewHygieneTest
testApplyingTheModeChangesThisGemsMode
  "#applyFrontEndTransactionMode acts on the session that runs it, which is exactly why the only
   caller is the class-side runOnPort:configJson: -- the child-gem entry, whose session was forked
   for that expression and does nothing else afterwards. Restored in an #ensure:, because leaving a
   test runner transactionless would make every later suite's commit raise."
  | r was |
  was := System transactionMode.
  r := McpFixtureRouter new.
  [r applyFrontEndTransactionMode.
   self assert: System transactionMode equals: #transactionless.
   r frontEndTransactionMode: 'autoBegin'.
   r applyFrontEndTransactionMode.
   self assert: System transactionMode equals: #autoBegin]
     ensure: [System transactionMode: was]
%
category: 'tests - the worker's side'
method: McpViewHygieneTest
testARefreshForTheFrontEndIsNewsExactlyOnce
  "The client has to be told its snapshot moved -- it was told the view moves only when IT moves the
   view, and a server-initiated refresh makes that false in this one bounded case. Once, though: the
   note is consumed as it is reported, like the stale-read keys, so it lands on the next result and
   never again."
  | srv |
  System abortTransaction.
  srv := McpServer new.
  self deny: srv takeFrontEndRefreshedView.
  self assert: srv refreshViewForFrontEnd equals: 'kept'.
  self assert: srv takeFrontEndRefreshedView.
  self deny: srv takeFrontEndRefreshedView
%
category: 'tests - the worker's side'
method: McpViewHygieneTest
testARefreshForTheFrontEndKeepsUncommittedWork
  "THE CLAIM THE WHOLE REDESIGN RESTS ON. System continueTransaction takes a current view and keeps
   this session's uncommitted changes, so the front end never has to choose between leaving a dirty
   worker to pin the repository's commit records and destroying the work in it -- which is what the
   first version of this plan would have done, warning the client and then reaping the session.
   The scratch key is written on purpose and aborted at the end; between the two, the refresh has to
   leave it exactly where it was."
  | srv globals |
  System abortTransaction.
  srv := McpServer new.
  globals := System myUserProfile objectNamed: #UserGlobals.
  [globals at: self scratchKey put: 7.
   self assert: System needsCommit.
   self assert: srv refreshViewForFrontEnd equals: 'kept'.
   "the view moved AND the work is still here -- neither half is interesting without the other"
   self assert: System needsCommit.
   self assert: (globals at: self scratchKey) equals: 7.
   self assert: self commitsBehindOfThisSession equals: 0]
     ensure: [System abortTransaction]
%
category: 'tests - worker views'
method: McpViewHygieneTest
testASessionBehindTheLimitIsRecordedAndLeftAlone
  "Under the line is the ordinary case and it must be silent -- a line per session per pass would
   bury the ones that matter -- but the number is still recorded, because that record is what the
   later notes and log phrases quote."
  | r sess |
  r := McpFixtureRouter new.
  sess := self identifiedSessionOn: r.
  r maxCommitsBehind: 20.
  r fakeCommitsBehind: 3; fakeBacklogCritical: false.
  self assert: r maintainViewHygiene equals: 0.
  self assert: sess commitsBehind equals: 3.
  self assert: (self hygieneLinesIn: r) isEmpty
%
category: 'tests - worker views'
method: McpViewHygieneTest
testASessionOverTheLimitIsRefreshedAndLogged
  "The count answered is the number of sessions actually refreshed, and each gets a line naming the
   figures the decision was made on and what the worker answered. A view move under a client is not
   something to leave unrecorded, so this line is written every time the arm acts -- unlike the
   could-not-ask line, which is suppressed while the number stands still."
  | r sess lines |
  r := McpFixtureRouter new.
  sess := self identifiedSessionOn: r.
  r maxCommitsBehind: 20.
  r fakeCommitsBehind: 25; fakeBacklogCritical: false;
    fakeOldestCrSessions: (Array with: sess workerStoneSession).
  self assert: r maintainViewHygiene equals: 1.
  self assert: sess refreshRequests equals: 1.
  self assert: sess commitsBehind equals: 25.
  lines := self hygieneLinesIn: r.
  self assert: lines size equals: 1.
  self assert: ((lines first findString: '25 commits behind' startingAt: 1) > 0).
  self assert: ((lines first findString: 'refresh: ''kept''' startingAt: 1) > 0).
  "The stone signals are no longer grounds, but they are still REPORTED -- they are what the next
   step's threshold gets tuned against, and a line that omitted them would make the tuning guesswork.
   holds-oldest-cr is read from an unconditional per-pass reading, so it tells the truth on a quiet
   stone too; it used to be computed only under pressure and so printed 'no' regardless."
  self assert: ((lines first findString: 'stone-critical no' startingAt: 1) > 0).
  self assert: ((lines first findString: 'holds-oldest-cr yes' startingAt: 1) > 0)
%
category: 'tests - worker views'
method: McpViewHygieneTest
testAStandingMeasurementOnABusySessionIsLoggedOnceNotEveryPass
  "A session that CANNOT be asked -- a call in flight -- stays over the line pass after pass, and at
   one pass a minute an unchanged number would be 1440 identical lines a day for one client. Every
   distinct observation is still recorded: what is dropped is the repeat, not the reading.
   A session that CAN be asked needs no such rule, because refreshing it puts it back under the line;
   that case is asserted in testASessionOverTheLimitIsRefreshedAndLogged."
  | r sess |
  r := McpFixtureRouter new.
  sess := self identifiedSessionOn: r.
  sess fakeRefreshVerdict: nil.   "could not be asked"
  r maxCommitsBehind: 20.
  r fakeCommitsBehind: 25; fakeBacklogCritical: false.
  self assert: r maintainViewHygiene equals: 0.
  self assert: r maintainViewHygiene equals: 0.
  self assert: r maintainViewHygiene equals: 0.
  self assert: (self hygieneLinesIn: r) size equals: 1.
  self assert: ((self hygieneLinesIn: r) first findString: 'call is in flight' startingAt: 1) > 0.
  "a number that MOVED is news again"
  r fakeCommitsBehind: 26.
  self assert: r maintainViewHygiene equals: 0.
  self assert: (self hygieneLinesIn: r) size equals: 2.
  self assert: sess commitsBehind equals: 26
%
category: 'tests - worker views'
method: McpViewHygieneTest
testEveryVerdictIsLoggedAndOnlyAnAnsweredOneCounts
  "Three answers come back from a worker and the front end acts on none of them beyond recording it:
   'kept' is the ordinary success, 'doomed' means the pending work now conflicts and the WORKER tells
   its client on every later call, 'stuck' means the view did not move at all. All three are a
   completed ask, so all three count and all three are logged -- only a session that could not be
   asked is neither."
  #( 'kept' 'doomed' 'stuck: a commit that failed on conflict' ) do: [:verdict | | r sess |
    r := McpFixtureRouter new.
    sess := self identifiedSessionOn: r.
    sess fakeRefreshVerdict: verdict.
    r maxCommitsBehind: 20.
    r fakeCommitsBehind: 25; fakeBacklogCritical: false; fakeOldestCrSessions: #().
    self assert: r maintainViewHygiene equals: 1.
    self assert: sess refreshRequests equals: 1.
    self assert: (self hygieneLinesIn: r) size equals: 1.
    self assert: ((self hygieneLinesIn: r) first findString: verdict startingAt: 1) > 0]
%
category: 'tests - worker views'
method: McpViewHygieneTest
testNoStateOfTheStoneRefreshesAWorkerThatIsNotBehind
  "The one ground is this session's own distance from the current state. A worker only three commits
   behind is left alone under every combination of stone pressure and oldest-record holding there
   is -- which is the whole point, because refreshing such a worker cannot shorten a backlog its
   view is not pinning.
   Both stone signals were rejected as grounds on evidence. The backlog is at least the largest
   commits-behind figure among the sessions and never the reverse (the stone defers disposing
   records nobody references), so a high backlog is not evidence anybody is behind; and measured on
   db-1 just after a restart, EVERY session reported holding the oldest record, because they were
   all on the same current one. A rule using them would have fired hardest in exactly the state
   where refreshing achieves nothing."
  | r sess |
  r := McpFixtureRouter new.
  sess := self identifiedSessionOn: r.
  r maxCommitsBehind: 20.
  r fakeCommitsBehind: 3.
  #(false true) do: [:pressure |
    { #() . (Array with: sess workerStoneSession) } do: [:holders |
      r fakeBacklogCritical: pressure; fakeOldestCrSessions: holders.
      self assert: r maintainViewHygiene equals: 0]].
  self assert: (self hygieneLinesIn: r) isEmpty.
  self assert: sess refreshRequests equals: 0.
  "and the ground itself still works, with the stone as quiet as it gets"
  r fakeBacklogCritical: false; fakeOldestCrSessions: #(); fakeCommitsBehind: 20.
  self assert: r maintainViewHygiene equals: 1.
  self assert: sess refreshRequests equals: 1
%
category: 'tests - the refresh'
method: McpViewHygieneTest
testRefreshingTheFrontEndViewLeavesTheTransactionModeAlone
  "#abortTransaction is legal in every mode and changes none of them, which is what lets one method
   serve both the transactionless front end (where it releases a commit record) and the autoBegin
   escape hatch (where it re-pins a fresh view). If it did change the mode, the escape hatch would
   quietly stop being one after the first pass."
  | was |
  was := System transactionMode.
  [McpFixtureRouter new refreshFrontEndView.
   self assert: System transactionMode equals: was.
   System transactionMode: #transactionless.
   McpFixtureRouter new refreshFrontEndView.
   self assert: System transactionMode equals: #transactionless]
     ensure: [System transactionMode: was]
%
category: 'tests - the refresh'
method: McpViewHygieneTest
testRefreshingTheFrontEndViewTakesAWholeNewView
  "The claim the whole change rests on: after the refresh this session is behind by nothing, so it is
   no longer holding a commit record open on the strength of a view it took at login."
  McpFixtureRouter new refreshFrontEndView.
  self assert: self commitsBehindOfThisSession equals: 0
%
category: 'tests - worker views'
method: McpViewHygieneTest
testTheArmIsOffEntirelyWithNoCeiling
  "nil is a deployment instruction, not an absence -- the same bargain #hasSessionIdleDeadline
   makes. Off means off on BOTH routes: a router told to leave worker views alone must not still act
   on them because the stone is under pressure."
  | r sess |
  r := McpFixtureRouter new.
  sess := self identifiedSessionOn: r.
  r maxCommitsBehind: nil.
  r fakeCommitsBehind: 500; fakeBacklogCritical: true;
    fakeOldestCrSessions: (Array with: sess workerStoneSession).
  self deny: r hasViewHygiene.
  self assert: r commitsBehindLimit isNil.
  self assert: r maintainViewHygiene equals: 0.
  self assert: (self hygieneLinesIn: r) isEmpty.
  self assert: ((r viewHygieneSummary findString: 'off' startingAt: 1) > 0)
%
category: 'tests - stone readings'
method: McpViewHygieneTest
testTheCeilingRefusesANumberThatCannotWork
  "The floor is 2, not 1: a ceiling of one commit would move a client's view on the heels of any
   other session's commit, which mid-plan is a view move per keystroke of somebody else's work."
  self should: [McpRouter new maxCommitsBehind: 1] raise: Error.
  self should: [McpRouter new maxCommitsBehind: 0] raise: Error.
  self should: [McpRouter new maxCommitsBehind: -5] raise: Error.
  self should: [McpRouter new maxCommitsBehind: 'lots'] raise: Error.
  self assert: (McpRouter new maxCommitsBehind: 2; yourself) maxCommitsBehind equals: 2.
  self assert: (McpRouter new maxCommitsBehind: nil; yourself) maxCommitsBehind isNil
%
category: 'tests - stone readings'
method: McpViewHygieneTest
testTheCeilingTravelsToAForkedChild
  "Including the nil, which is the only way to say 'leave every worker's view alone' and so has to
   survive as an instruction rather than be re-seeded to the default in the gem that serves clients."
  | r child |
  r := McpRouter new.
  self assert: r maxCommitsBehind equals: 20.
  r maxCommitsBehind: 40.
  self assert: (McpRouter new applyConfigJson: r configJson) maxCommitsBehind equals: 40.
  r maxCommitsBehind: nil.
  child := McpRouter new applyConfigJson: r configJson.
  self assert: child maxCommitsBehind isNil.
  self deny: child hasViewHygiene
%
category: 'tests - config'
method: McpViewHygieneTest
testTheDefaultIsTransactionless
  "The default is the fix, not an option: a front end that has to be ASKED not to hoard commit
   records is one that hoards them in every deployment nobody thought about it."
  self assert: McpRouter defaultFrontEndTransactionMode equals: 'transactionless'.
  self assert: McpRouter new frontEndTransactionMode equals: 'transactionless'.
  self assert: (McpRouter frontEndTransactionModes includes: 'transactionless').
  self assert: (McpRouter frontEndTransactionModes includes: 'autoBegin')
%
category: 'tests - worker views'
method: McpViewHygieneTest
testTheEffectiveLimitIsTheLowerOfOursAndTheStones
  "Either firing is enough, as asked, so the effective limit is the minimum. They are DIFFERENT
   quantities -- field 16 is one session's distance from the current state, StnSignalAbortCrBacklog
   is the whole repository's backlog count -- so using the stone's number as a per-session ceiling
   is a deliberate proxy and not an equivalence."
  | r stone |
  r := McpFixtureRouter new.
  stone := r stoneSignalAbortCrBacklog.
  self assert: stone notNil.
  r maxCommitsBehind: stone + 5.
  self assert: r commitsBehindLimit equals: stone.
  r maxCommitsBehind: 2.
  self assert: r commitsBehindLimit equals: 2
%
category: 'tests - worker views'
method: McpViewHygieneTest
testTheMaintenanceTimeoutIsPushedIntoEverySessionAndIsNotTheRequestDeadline
  "The two clocks are independent on purpose: a router that runs test suites for hours is supposed to
   be configurable with NO request deadline -- client-initiated interrupt is the stop button -- so
   there is no client deadline for a hygiene send to borrow. A send that inherited nil would wait for
   ever and stall the pass for every other session."
  | r sess |
  r := McpFixtureRouter new.
  r requestTimeoutSeconds: nil.
  self assert: r maintenanceCallTimeoutSeconds equals: 5.
  sess := self sessionOn: r.
  self assert: sess requestTimeoutSeconds isNil.
  self assert: sess maintenanceCallTimeoutSeconds equals: 5.
  "and it travels, and refuses the nil that is legitimate for the other one"
  r maintenanceCallTimeoutSeconds: 12.
  self assert: (McpRouter new applyConfigJson: r configJson) maintenanceCallTimeoutSeconds equals: 12.
  self should: [McpRouter new maintenanceCallTimeoutSeconds: nil] raise: Error.
  self should: [McpRouter new maintenanceCallTimeoutSeconds: 0] raise: Error
%
category: 'tests - config'
method: McpViewHygieneTest
testTheModeTravelsToAForkedChild
  "The escape hatch is only real if it reaches the gem that actually serves clients, and config gets
   there one way: serialized into the fork string (#configJson). The non-default value is the one
   worth asserting -- a key that fails to travel looks exactly like the default, so only the other
   mode can tell a round trip from a re-seed."
  | r child |
  r := McpRouter new.
  r frontEndTransactionMode: 'autoBegin'.
  child := McpRouter new applyConfigJson: r configJson.
  self assert: child frontEndTransactionMode equals: 'autoBegin'.
  "and the default travels as itself rather than as an absence"
  self assert: (McpRouter new configDict at: 'frontEndTransactionMode') equals: 'transactionless'
%
category: 'tests - the worker's side'
method: McpViewHygieneTest
testTheRefreshNoteSaysWhoDidItAndWhatItCannotPromise
  "The wording carries the client's only defence against concluding it did this to itself, so it has
   to name the actor and the reason. It also has to stop short of 'nothing you read has changed':
   only reads made through a tool are tracked (docs/blind-write-guardrail.md, known limits), so a
   flat claim about everything the client read would be a claim about a set the guardrail does not
   fully know."
  | srv note |
  System abortTransaction.
  srv := McpServer new.
  srv refreshViewForFrontEnd.
  note := (McpDispatcher withToolRegistry: srv toolRegistry server: srv) viewRefreshedNote.
  self assert: note notNil.
  self assert: ((note findString: '[session] The server refreshed your view' startingAt: 1) = 1).
  self assert: ((note findString: 'commit records open' startingAt: 1) > 0).
  self assert: ((note findString: 'uncommitted changes were kept' startingAt: 1) > 0).
  self assert: ((note findString: 'execute_code are not tracked' startingAt: 1) > 0)
%
category: 'tests - worker views'
method: McpViewHygieneTest
testTheSessionAccessWarningIsLoggedOnce
  "Without the SessionAccess privilege the whole arm is a no-op, which is worth a line naming the
   privilege -- and worth exactly one. A line per session per pass, for a fact that cannot change
   until somebody changes the user, would bury everything else in the gem log."
  | r |
  r := McpFixtureRouter new.
  r noteSessionAccessDenied: (Error new messageText: 'first'); noteSessionAccessDenied: (Error new messageText: 'second').
  self assert: (r loggedLines
    select: [:l | (l findString: 'SessionAccess' startingAt: 1) > 0]) size equals: 1
%
category: 'tests - stone readings'
method: McpViewHygieneTest
testTheStoneReadingsAnswerRealNumbers
  "Thin wrappers over stone primitives, and the only tests here that ask the real stone. Each must
   answer a usable number or a nil that means 'unknown' -- never a zero standing in for an unknown,
   which would read as 'no backlog' and 'threshold of nothing'."
  | r backlog threshold |
  r := McpFixtureRouter new.
  backlog := r stoneCommitRecordBacklog.
  self assert: (backlog isKindOf: Integer).
  self assert: backlog >= 0.
  threshold := r stoneCrBacklogThreshold.
  self assert: (threshold isNil or: [threshold > 0]).
  self assert: (r stoneSignalAbortCrBacklog isKindOf: Integer).
  "critical is exactly the comparison, and false whenever either number is unknown"
  self assert: r stoneBacklogCritical
    equals: (threshold notNil and: [backlog > threshold])
%
category: 'tests - the worker's side'
method: McpViewHygieneTest
testTheStuckReasonIsAskedOfTheImageNotDecodedFromTheError
  "Which of the two illegal states a session is in decides the prose the front end logs and, later,
   the phrase it is reaped with -- so it is asked of the image (the same two questions
   McpDispatcher already distinguishes) rather than matched against a version's error numbers.
   Only the fallback is reachable in one gem: a jam needs a real commit conflict, so a second gem,
   and #transactionLevel does not rise above 1 here -- measured, System beginTransaction in
   autoBegin mode leaves it at 1, so a nested transaction is not reachable this way either. What is
   asserted is that a session in NEITHER state says so plainly instead of guessing."
  | srv |
  System abortTransaction.
  srv := McpServer new.
  self deny: McpToolset commitConflictPending.
  self assert: System transactionLevel equals: 1.
  self assert: srv stuckViewReason equals: 'the refresh was refused'.
  self assert: srv frontEndDoomedSubjects isNil
%
category: 'tests - stone readings'
method: McpViewHygieneTest
testThisSessionsOwnCommitsBehindIsReadable
  "The unfaked reading, against the stone running this test. A session may read its OWN description
   without the SessionAccess privilege, which is what lets this be asserted with no second gem and
   no privileged user -- and after a refresh the answer must be 0, since the view was just taken."
  | r sess |
  r := McpFixtureRouter new.
  r refreshFrontEndView.
  sess := self sessionOn: r.
  sess fakeWorkerStoneSession: System session.
  self assert: (r commitsBehindFor: sess) equals: 0
%
