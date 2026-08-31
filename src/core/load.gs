! Load the core GemStone MCP server classes, in dependency order.
! Paths are relative to the REPOSITORY ROOT (install.sh cds there before running topaz).
! Loaded by ../../load.gs -- see that file, or install.sh, for the whole story.

run
"Pre-declare these class names in Published BEFORE filing in any of them. The classes reference
 each other in both directions (McpDispatcher asks McpServer for its name; McpServer builds a
 McpDispatcher), so no file order can put every class ahead of its first mention -- without a
 declaration the compiler reports `undefined symbol` and the file-in stops. A nil-valued binding
 is enough: the compiler binds a global by its ASSOCIATION, and each class definition below fills
 that same association in, so methods compiled before their referent still see the real class.
 Existing keys are left alone, so re-installing over a loaded image changes nothing."
| d names |
d := System myUserProfile objectNamed: #Published.
names := #( #McpError #McpTool #McpToolRegistry #McpToolset #McpBrowsingToolset
  #McpExecutionToolset #McpListingToolset #McpMutationToolset #McpSearchToolset
  #McpSessionToolset #McpTestingToolset #McpHttpConnection #McpDispatcher #McpBase
  #McpServer #McpOutbox #McpSession #McpRouter ).
names do: [:s | (d includesKey: s) ifFalse: [ d at: s put: nil ] ].
names size
%

! The tool protocol: an error kind, a tool, the registry that holds them.
input src/core/McpError.gs
input src/core/McpTool.gs
input src/core/McpToolRegistry.gs

! Toolsets: the abstract superclass first, then the concrete core surface.
input src/core/McpToolset.gs
input src/core/McpBrowsingToolset.gs
input src/core/McpExecutionToolset.gs
input src/core/McpListingToolset.gs
input src/core/McpMutationToolset.gs
input src/core/McpSearchToolset.gs
input src/core/McpSessionToolset.gs
input src/core/McpTestingToolset.gs

! Transport and dispatch, then the servers themselves (McpServer and McpRouter are McpBase
! subclasses, so McpBase must precede them).
input src/core/McpHttpConnection.gs
input src/core/McpDispatcher.gs
input src/core/McpBase.gs
input src/core/McpServer.gs
! The server-to-client pathway: a per-session outbox the front end drains onto that client's SSE
! stream. Ahead of McpSession, which builds one for every session.
input src/core/McpOutbox.gs
input src/core/McpSession.gs
input src/core/McpRouter.gs
