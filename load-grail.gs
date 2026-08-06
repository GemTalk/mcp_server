! Load the optional GemStone-Python (Grail) MCP tools on top of the Rowan-loaded base.
! The base Mcp* classes now load via the Rowan project (see install.sh / rowan/); this file
! only adds the Grail subclass + its test suite. Only valid on a Grail/ModuleAst image.
! Run from a topaz session that already has the base classes loaded:  topaz> input load-grail.gs
! (or use `GS_MCP_WITH_GRAIL=1 ./install.sh`, or `./install.sh --grail`, which load the base
!  via Rowan first, then this file).

! Optional Grail subclass + its test suite (must load after McpServer / the base tests).
input McpServerWithGrail.gs
input McpServerWithGrailTest.gs

commit
