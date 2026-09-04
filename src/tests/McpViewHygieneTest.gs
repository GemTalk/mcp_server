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
logLineMatching: aSubstring in: aFixtureRouter
  "The first captured log line containing aSubstring, or nil. McpFixtureRouter captures #log: into
   #loggedLines instead of writing the gem log."
  ^aFixtureRouter loggedLines
    detect: [:l | (l findString: aSubstring startingAt: 1) > 0]
    ifNone: [nil]
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
  globals at: #McpViewHygieneTestScratch put: 42.
  self assert: System needsCommit.
  r refreshFrontEndView.
  self deny: System needsCommit.
  self deny: (globals includesKey: #McpViewHygieneTestScratch).
  self assert: (self logLineMatching: 'BUG: the front end gem has uncommitted changes' in: r) notNil
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
