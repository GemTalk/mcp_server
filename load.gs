! Load the native GemStone MCP server classes into the image, including the OAuth/OIDC-
! authenticating front end (McpAuthRouter). On this branch auth is part of the base load, not an
! option -- see the README.
! Run from an already-logged-in topaz session whose current directory is the repository root:
!   topaz> input load.gs
! (or use install.sh, which logs in, runs this, and commits).
!
! For the optional GemStone-Python (Grail) toolset, use load-grail.gs instead: it inputs the same
! groups and then the Grail one (it does NOT input this file, so the commit happens once).

input src/core/load.gs
input src/tests/load.gs
input src/auth/load.gs

commit
