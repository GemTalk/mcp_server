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
read-only screens individual tools and not just whole toolsets -- see McpToolset.'
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
  "Everything except commit: abort and refresh discard uncommitted work rather than persisting it,
   and status only reports. commit is the one tool here that can persist a change."
  ^#( 'abort' 'refresh' 'status' )
%
category: 'registration'
method: McpSessionToolset
registerOn: aToolRegistry
  | noArgs |
  noArgs := self objectSchema: Dictionary new required: #().
  aToolRegistry name: 'abort'
    description: 'Abort the current transaction, discarding uncommitted changes and refreshing the session view.'
    inputSchema: noArgs do: [:args | self tool_abort: args].
  aToolRegistry name: 'commit'
    description: 'Commit the current transaction, persisting all changes.'
    inputSchema: noArgs do: [:args | self tool_commit: args].
  aToolRegistry name: 'refresh'
    description: 'Refresh the session view to see changes committed by other sessions (aborts any uncommitted work).'
    inputSchema: noArgs do: [:args | self tool_refresh: args].
  aToolRegistry name: 'status'
    description: 'Report the GemStone session: user, session id, stone, and whether there are uncommitted changes.'
    inputSchema: noArgs do: [:args | self tool_status: args].
  ^self
%
category: 'tools - session'
method: McpSessionToolset
tool_abort: args
  System abortTransaction.
  ^'Transaction aborted; view refreshed.'
%
category: 'tools - session'
method: McpSessionToolset
tool_commit: args
  ^System commitTransaction
    ifTrue: ['Transaction committed.']
    ifFalse: ['Commit failed due to conflicts; the transaction is still open.']
%
category: 'tools - session'
method: McpSessionToolset
tool_refresh: args
  System abortTransaction.
  ^'View refreshed.'
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
