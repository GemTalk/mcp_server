! Load the native GemStone MCP server classes into the image.
! This branch targets GemStone 3.7.2, which has no kernel JWT support, so it carries no
! OAuth/OIDC front end: there is no src/auth group and no McpAuthRouter -- see the README.
! Run from an already-logged-in topaz session whose current directory is the repository root:
!   topaz> input load.gs
! (or use install.sh, which logs in, runs this, and commits).
!
! For the optional GemStone-Python (Grail) toolset, use load-grail.gs instead: it inputs the same
! groups and then the Grail one (it does NOT input this file, so the commit happens once).

input src/core/load.gs
input src/tests/load.gs

commit
