set compile_env: 0
! ------------------- Class definition for McpTransactionTest
expectvalue /Class
doit
GsTestCase subclass: 'McpTransactionTest'
  instVarNames: #( other)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpTransactionTest comment: 
'The transaction model across tool calls, and the one state it can get stuck in.

A worker gem sits in one long-lived GemStone transaction, and since 2026-08-28 every tools/call is
preceded by System continueTransaction rather than System abortTransaction: a current view of other
sessions'' commits that KEEPS this session''s uncommitted work (docs/server-to-client-messaging.md
10.11). The tests that this did not break the ordinary cases live in McpToolTest and
McpDispatcherTest, purely in-image.

THIS suite covers the case neither of them can reach alone: a commit that FAILS on conflict, which
needs a second gem to conflict with. That state matters out of all proportion to how often it
happens, because it is sticky -- continueTransaction answers TransactionError 2409 on every later
call until the transaction is aborted -- so it is the one state in which the server''s per-call
refresh cannot do its job, and the only way out is a tool call the client has to be told to make.

NOT PURELY IN-IMAGE. It spawns one real worker gem (McpSession startWithId:) to commit the
conflicting change, so it needs a NETLDI, like McpExternalSessionTest. The gem is short-lived: it
runs one expression and tearDown logs it out.'
%
expectvalue /Class
doit
McpTransactionTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpTransactionTest
removeallmethods McpTransactionTest
removeallclassmethods McpTransactionTest
! ------------------- Class methods for McpTransactionTest
! ------------------- Instance methods for McpTransactionTest
category: 'helpers'
method: McpTransactionTest
dispatchStatus
  "The text of a real tools/call for `status`. `status` is used because it is the tool least likely
   to change what it is reporting on."
  ^self dispatchTool: 'status' args: Dictionary new
%
category: 'helpers'
method: McpTransactionTest
dispatchTool: aName args: anArgsDict
  "Drive a tool exactly as a client's request would, through McpDispatcher, so that everything the
   dispatcher does on the way in and out is in the path: the post-call session note is attached the
   way a client sees it, and -- the point of several tests here -- nothing refreshes the view."
  | params response |
  params := Dictionary new.
  params at: 'name' put: aName.
  params at: 'arguments' put: anArgsDict.
  response := (McpDispatcher withToolRegistry: McpServer new toolRegistry) handle:
    (Dictionary new
      at: 'jsonrpc' put: '2.0';
      at: 'id' put: 1;
      at: 'method' put: 'tools/call';
      at: 'params' put: params;
      yourself).
  ^(((response at: 'result') at: 'content') at: 1) at: 'text'
%
category: 'helpers'
method: McpTransactionTest
jamTheSession
  "Leave this session in the state a failed commit leaves behind: an uncommitted change to an
   object another session has committed over since this session last took a view.
   Answers the McpError the commit tool raised, which every test here goes on to assert about.

   The other gem is REAL rather than mocked because the state under test is the stone's, not this
   image's: nothing short of a genuine second session committing a genuine conflicting change puts
   a session into the must-abort state, and a mock that faked it would be testing the mock."
  | probe |
  probe := self probeKey.
  UserGlobals at: probe put: 'baseline'.
  System commitTransaction.
  other := McpSession startWithId: 'transaction-conflict-fixture'.
  other runWorker: 'UserGlobals at: #' , probe asString
    , ' put: ''committed by the other session''. System commitTransaction'.
  "No refresh here on purpose: writing on a view taken before their commit is the whole setup."
  UserGlobals at: probe put: 'mine, uncommitted'.
  ^[self sessionTools tool_commit: Dictionary new. nil] on: McpError do: [:ex | ex]
%
category: 'helpers'
method: McpTransactionTest
probeKey
  ^#McpTxnConflictProbe
%
category: 'helpers'
method: McpTransactionTest
sessionTools
  ^McpServer new toolsets detect: [:ts | ts class == McpSessionToolset]
%
category: 'running'
method: McpTransactionTest
setUp
  other := nil.
  System abortTransaction
%
category: 'running'
method: McpTransactionTest
tearDown
  "Abort FIRST: a test that ended jammed cannot commit anything until it does, so the cleanup
   commit below would fail and leak the fixture. Then give the worker gem back, guarded, because a
   test that failed mid-way still has to log it out."
  System abortTransaction.
  UserGlobals removeKey: self probeKey ifAbsent: [nil].
  System commitTransaction.
  other ifNotNil: [:s | [s close] on: Error do: [:e | nil]].
  other := nil
%
category: 'tests'
method: McpTransactionTest
testAbortIsTheWayOutAndSaysNothingElse
  "abort clears the jam, and the result it answers is not contradicted by a note about the state it
   just cleared. That is the whole reason the note is computed AFTER the tool runs rather than
   before: annotating on the way in would staple 'your view is stale, call abort' onto the answer
   from the abort that fixed it, and the alternative -- teaching abort to suppress a note the
   dispatcher had already decided to add -- makes abort the one tool that knows about annotation."
  | text |
  self jamTheSession.
  self sessionTools tool_abort: Dictionary new.
  self assert: McpToolset refreshView isNil.
  text := self dispatchStatus.
  self deny: (text includesString: '[session]')
%
category: 'tests'
method: McpTransactionTest
testAStaleWriteIsRefusedRatherThanSilentlyOverwriting
  "The guardrail, in the shape it is actually needed. A client reads something, thinks (or asks a
   human) across several calls, and only then acts on what it read. In between, another session
   commits a change to the same thing. Its commit must FAIL rather than quietly erase that work.

   This holds only because no tool refreshes the view: GemStone's check is write-write against the
   view and does not track reads, so the view is the whole of the stone's record of what this client
   saw. A refresh anywhere between the read and the write -- which the dispatcher did before
   2026-08-28, first via abortTransaction and then via continueTransaction -- makes this commit
   succeed and the other session's work vanish with nothing raised."
  | probe err |
  probe := self probeKey.
  UserGlobals at: probe put: 'baseline'.
  System commitTransaction.
  self assert: (UserGlobals at: probe) equals: 'baseline'.
  other := McpSession startWithId: 'transaction-stale-write-fixture'.
  other runWorker: 'UserGlobals at: #' , probe asString
    , ' put: ''committed by the other session''. System commitTransaction'.
  "Several tool calls pass between the read and the write, as they would in a real conversation."
  self dispatchStatus.
  self dispatchTool: 'execute_code'
    args: (Dictionary new at: 'code' put: 'UserGlobals at: #' , probe asString , ' put: ''mine'''; yourself).
  err := [self sessionTools tool_commit: Dictionary new. nil] on: McpError do: [:ex | ex].
  self assert: err notNil description: 'a stale write was COMMITTED instead of being refused'.
  self assert: err kind equals: #commitConflict.
  System abortTransaction.
  self assert: (UserGlobals at: probe) equals: 'committed by the other session'
%
category: 'tests'
method: McpTransactionTest
testCommitConflictIsRaisedNotReported
  "A failed commit reaches the client as an isError result with kind #commitConflict, naming what
   conflicted. It answered a success-shaped string until 2026-08-28 -- and, before that, a plain
   'Transaction committed.' for a commit of an empty transaction, which is what 10.11 was about."
  | err |
  err := self jamTheSession.
  self assert: err notNil description: 'tool_commit answered instead of raising on a conflict'.
  self assert: err kind equals: #commitConflict.
  self assert: (err description includesString: 'Write-Write')
%
category: 'tests'
method: McpTransactionTest
testJammedSessionKeepsItsUncommittedWork
  "The failed commit wrote nothing, but it did not throw the caller's work away either: the change
   is still here, which is why abort is described as costing something rather than as free."
  self jamTheSession.
  self assert: System needsCommit.
  self assert: (UserGlobals at: self probeKey) equals: 'mine, uncommitted'
%
category: 'tests'
method: McpTransactionTest
testJammedSessionReportsTheFailedCommit
  "The state is sticky -- no commit can succeed and the view cannot move until an abort -- so every
   result says so until the client acts, and says what the recovery costs."
  | text |
  self jamTheSession.
  self assert: McpToolset commitConflictPending.
  text := self dispatchStatus.
  self assert: (text includesString: 'last commit FAILED').
  self assert: (text includesString: 'abort')
%
category: 'tests'
method: McpTransactionTest
testNoToolMovesTheView
  "A session sees one snapshot until it asks for another. Every tool call in between leaves it
   exactly where it was -- which is what makes the check in
   testAStaleWriteIsRefusedRatherThanSilentlyOverwriting possible -- and `refresh` is what moves it."
  | probe |
  probe := self probeKey.
  UserGlobals at: probe put: 'baseline'.
  System commitTransaction.
  other := McpSession startWithId: 'transaction-view-fixture'.
  other runWorker: 'UserGlobals at: #' , probe asString
    , ' put: ''committed by the other session''. System commitTransaction'.
  self dispatchStatus.
  self dispatchTool: 'list_dictionaries' args: Dictionary new.
  self dispatchTool: 'execute_code' args: (Dictionary new at: 'code' put: '1 + 1'; yourself).
  self assert: (UserGlobals at: probe) equals: 'baseline'.
  self sessionTools tool_refresh: Dictionary new.
  self assert: (UserGlobals at: probe) equals: 'committed by the other session'
%
category: 'tests'
method: McpTransactionTest
testRefreshAdoptsTheOtherVersionAsTheStartingPoint
  "The cost of `refresh`, pinned so that it stays a decision rather than becoming a surprise. Once
   the view has moved, a change made afterwards is no longer stale by the stone's reckoning, so it
   commits cleanly OVER the other session's work. That is correct for a client that refreshed and
   then looked again; it is a trap for one acting on what it read before refreshing, which is why
   the refresh tool's description and the server instructions both say to re-read first."
  | probe |
  probe := self probeKey.
  UserGlobals at: probe put: 'baseline'.
  System commitTransaction.
  other := McpSession startWithId: 'transaction-adopt-fixture'.
  other runWorker: 'UserGlobals at: #' , probe asString
    , ' put: ''committed by the other session''. System commitTransaction'.
  self sessionTools tool_refresh: Dictionary new.
  UserGlobals at: probe put: 'mine'.
  self assert: (self sessionTools tool_commit: Dictionary new) equals: 'Transaction committed.'.
  System abortTransaction.
  self assert: (UserGlobals at: probe) equals: 'mine'
%
category: 'tests'
method: McpTransactionTest
testRefreshRefusesOnAJammedSession
  "refresh cannot be the way out -- continueTransaction is exactly what 2409 forbids -- so it
   refuses and names abort, rather than letting a bare TransactionError reach the client."
  | err |
  self jamTheSession.
  err := [self sessionTools tool_refresh: Dictionary new. nil] on: McpError do: [:ex | ex].
  self assert: err notNil.
  self assert: (err description includesString: 'abort')
%
