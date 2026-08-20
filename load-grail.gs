! Load the native GemStone MCP server classes (including the OAuth/OIDC front end McpAuthRouter)
! PLUS the optional GemStone-Python (Grail) toolset.
! Only valid on an image that has Grail/ModuleAst -- the Grail toolset's methods reference
! ModuleAst and BaseException and cannot compile without them.
! Run from an already-logged-in topaz session whose current directory is the repository root:
!   topaz> input load-grail.gs
! (or use `GS_MCP_WITH_GRAIL=1 ./install.sh`, or `./install.sh --grail`).

input src/core/load.gs
input src/tests/load.gs
input src/auth/load.gs
input src/grail/load.gs

commit
