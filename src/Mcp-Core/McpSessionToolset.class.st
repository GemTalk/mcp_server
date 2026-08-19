"
The transaction/session tools of the WORKER GEM: abort, commit, refresh, status. (Not to be confused
with McpSession, the front end's handle on a client's worker gem -- these tools act on the GemStone
transaction the worker is in.)

The one MIXED toolset: abort, refresh and status only read (aborting discards uncommitted work
rather than persisting any), while commit persists and so is NOT read-only-safe. That is why
read-only screens individual tools and not just whole toolsets -- see McpToolset.

Handlers still live on McpServer (category 'tools - session'); see McpToolset's class comment on that
transitional seam.
"
Class {
	#name : 'McpSessionToolset',
	#superclass : 'McpToolset',
	#category : 'Mcp-Core'
}

{ #category : 'read-only' }
McpSessionToolset >> readOnlySafeToolNames [
  "Everything except commit: abort and refresh discard uncommitted work rather than persisting it,
   and status only reports. commit is the one tool here that can persist a change."
  ^#( 'abort' 'refresh' 'status' )

]

{ #category : 'registration' }
McpSessionToolset >> registerOn: aToolRegistry [
  | noArgs |
  noArgs := self objectSchema: Dictionary new required: #().
  aToolRegistry name: 'abort'
    description: 'Abort the current transaction, discarding uncommitted changes and refreshing the session view.'
    inputSchema: noArgs do: [:args | server tool_abort: args].
  aToolRegistry name: 'commit'
    description: 'Commit the current transaction, persisting all changes.'
    inputSchema: noArgs do: [:args | server tool_commit: args].
  aToolRegistry name: 'refresh'
    description: 'Refresh the session view to see changes committed by other sessions (aborts any uncommitted work).'
    inputSchema: noArgs do: [:args | server tool_refresh: args].
  aToolRegistry name: 'status'
    description: 'Report the GemStone session: user, session id, stone, and whether there are uncommitted changes.'
    inputSchema: noArgs do: [:args | server tool_status: args].
  ^self

]

{ #category : 'accessing' }
McpSessionToolset >> toolNames [
  ^#( 'abort' 'commit' 'refresh' 'status' )

]
