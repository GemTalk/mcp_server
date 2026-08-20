! Load the native GemStone MCP server classes into the image.
! Run from an already-logged-in topaz session whose current directory is the repository root:
!   topaz> input load.gs
! (or use install.sh, which logs in, runs this, and commits).
!
! For the optional GemStone-Python (Grail) toolset, use load-grail.gs instead -- it inputs this
! file and then adds the Grail group.

input src/core/load.gs
input src/tests/load.gs

commit
