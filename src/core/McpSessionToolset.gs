set compile_env: 0
! ------------------- Class definition for McpSessionToolset
expectvalue /Class
doit
McpToolset subclass: 'McpSessionToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpSessionToolset comment: 
'The transaction/session tools of the WORKER GEM: abort, commit, refresh, status. (Not to be confused
with McpSession, the front end''s handle on a client''s worker gem -- these tools act on the GemStone
transaction the worker is in.)

The one MIXED toolset: abort, refresh and status only read (aborting discards uncommitted work
rather than persisting any), while commit persists and so is NOT read-only-safe. That is why
read-only screens individual tools and not just whole toolsets -- see McpToolset.

THE TRANSACTION MODEL THESE TOOLS EXPOSE (changed 2026-08-28; docs/server-to-client-messaging.md
10.11 and 15). A worker gem sits in one long-lived GemStone transaction and sees one consistent
snapshot of the repository. NO TOOL REFRESHES THAT SNAPSHOT: it moves only when the client moves it,
with commit, abort or refresh. A change made by one call is still there for the next one, so
compile -> run the tests -> commit is a workflow rather than three unrelated calls.

Two things used to refresh it on every single call, first System abortTransaction and then briefly
System continueTransaction, and both were wrong for the same reason. GemStone''s conflict check is
write-write AGAINST THE VIEW and does not track what a session read, so the view is the only record
the stone holds of what this client has seen. Refreshing under the client asserts it has seen
changes it has not, and a commit that should have been refused as stale is accepted instead --
silently destroying another session''s work. Refusing to refresh is therefore not laziness about
freshness; it is what makes the conflict check mean anything.

Nothing else in the server commits. abort and commit are therefore the only two tools that end a
transaction, and they are the two moves the client is told about whenever the dispatcher''s
post-call note reports uncommitted changes.'
%
expectvalue /Class
doit
McpSessionToolset category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpSessionToolset
removeallmethods McpSessionToolset
removeallclassmethods McpSessionToolset
! ------------------- Class methods for McpSessionToolset
! ------------------- Instance methods for McpSessionToolset
category: 'read-only'
method: McpSessionToolset
readOnlySafeToolNames
  "Everything except commit. abort discards uncommitted work, refresh updates the view without
   either persisting or discarding, and status only reports -- none of the three can write to the
   repository. commit is the one tool here that can persist a change, and since 2026-08-28 it is
   the only tool in the whole server that can (see McpMutationToolset), which makes this list the
   place read-only mode is actually enforced for writes."
  ^#( 'abort' 'refresh' 'status' )
%
category: 'registration'
method: McpSessionToolset
registerOn: aToolRegistry
  | noArgs |
  noArgs := self objectSchema: Dictionary new required: #().
  aToolRegistry name: 'abort'
    description: 'Discard this session''s uncommitted changes and take a current view of the repository. DESTROYS uncommitted work. The only way out of a failed-commit state.'
    inputSchema: noArgs do: [:args | self tool_abort: args].
  aToolRegistry name: 'commit'
    description: 'Persist this session''s changes to the repository. The ONLY tool that commits; no other tool commits on your behalf. Fails (without writing) if another session changed the same objects.'
    inputSchema: noArgs do: [:args | self tool_commit: args].
  aToolRegistry name: 'refresh'
    description: 'Take a current view of work other sessions have committed, KEEPING this session''s uncommitted changes. Does not commit and does not discard. NOTE: this also adopts their version as your starting point, so a change you make afterwards on the strength of something you read BEFORE refreshing will commit cleanly over their work instead of being refused as stale. Re-read anything you are about to act on.'
    inputSchema: noArgs do: [:args | self tool_refresh: args].
  aToolRegistry name: 'status'
    description: 'Report the GemStone session: user, session id, stone, and whether there are uncommitted changes.'
    inputSchema: noArgs do: [:args | self tool_status: args].
  ^self
%
category: 'tools - session'
method: McpSessionToolset
tool_abort: args
  "Discard this session's uncommitted changes and take a current view. The one tool that destroys
   work, and the only way out of a failed-commit state -- so it is deliberately unconditional:
   abortTransaction is legal in every state continueTransaction is not."
  System abortTransaction.
  self noteAborted.
  ^'Transaction aborted; uncommitted changes discarded and the view refreshed.'
%
category: 'tools - session'
method: McpSessionToolset
tool_commit: args
  "Persist this session's changes. THE ONLY TOOL THAT COMMITS -- see McpMutationToolset.

   A failed commit is raised rather than reported as ordinary text, so it reaches the client in the
   isError envelope with kind 'commitConflict' (McpDispatcher>>toolErrorContentFrom:) instead of a
   success-shaped string a model can skim past. It also leaves the session in the must-abort state,
   which the dispatcher's post-call note then spells out -- so the message here names WHAT
   conflicted and the note supplies the recovery move, rather than both saying half of each."
  ^System commitTransaction
    ifTrue: [
      "Validated: the stone found no conflict with this session's write set, which is what licenses
       the read ledger to keep exactly what that proof covers (McpServer>>noteViewValidated)."
      self noteCommitted.
      'Transaction committed.']
    ifFalse: [ | subjects |
      "A failed commit does NOT move the view, so both ledgers stay as they are -- see
       McpServer>>noteCommitFailed."
      subjects := self conflictingSubjects.
      self noteCommitFailed.
      McpError signalKind: #commitConflict message:
        'Commit failed on conflict: ' , self commitConflictReport
          , (subjects isEmpty ifTrue: [''] ifFalse: [
              '. Another session has changed ' , (self listPhraseFor: subjects)
                , ' since your view was taken'])
          , '. Nothing was written and your changes are still here.']
%
category: 'tools - session'
method: McpSessionToolset
tool_refresh: args
  "Take a current view of other sessions' committed work, KEEPING this session's uncommitted
   changes (System continueTransaction).

   Until 2026-08-28 this was abortTransaction -- the same two lines as tool_abort with a friendlier
   string -- so it silently discarded the caller's work while reporting 'View refreshed.' The pair
   now means what the names say: abort discards, refresh updates in place.

   Refuses, rather than letting the raw TransactionError/ImproperOperation reach the client as an
   unexplained error, in the two states where continueTransaction is illegal -- a commit that
   failed on conflict, or a nested transaction. Which one it is comes from GemStone's own message
   for the error, so this does not have to predict either (McpToolset class>>refreshView)."
  | result ok err subjects |
  result := self refreshViewResult.
  ok := result at: 1.
  err := result at: 2.
  err ifNotNil: [:ex |
    ^McpError signalKind: #refused message:
      'Cannot refresh the view: ' , ([ex description] on: Error do: [:e | 'reason unavailable'])
        , ' Call abort to recover -- it clears this state, at the cost of your uncommitted changes.'].
  "The view has moved either way. What that means for the guardrail's ledgers depends entirely on
   the Boolean -- see McpServer>>noteRefreshed:. Read the conflicting classes BEFORE the transition,
   because the false branch clears the write ledger that decodes them."
  ok ifFalse: [subjects := self conflictingSubjects].
  self noteRefreshed: ok.
  ok ifTrue: [^'View refreshed; uncommitted changes kept.'].
  ^McpError signalKind: #commitConflict message:
    'The view was refreshed, but your uncommitted changes now conflict and can no longer be committed'
      , (subjects isEmpty ifTrue: [''] ifFalse: [
          ': another session has changed ' , (self listPhraseFor: subjects)])
      , '. Call abort -- it is the only way out, at the cost of those changes.'
%
category: 'tools - session'
method: McpSessionToolset
tool_status: args
  ^'user=' , System myUserProfile userId ,
   ' session=' , System session printString ,
   ' stone=' , System stoneName ,
   ' uncommittedChanges=' , System needsCommit printString
%
category: 'accessing'
method: McpSessionToolset
toolNames
  ^#( 'abort' 'commit' 'refresh' 'status' )
%
