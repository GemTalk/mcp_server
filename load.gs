! Load the core GemStone MCP server classes and their unit tests -- the base install, and all that
! any image can take.
! Run from an already-logged-in topaz session whose current directory is the repository root:
!   topaz> input load.gs
! (or use install.sh, which logs in, runs this group's loaders, and commits).
!
! THE TWO OPTIONAL GROUPS ARE NOT HERE, because neither is loadable everywhere. Each is one more
! `input` before the commit, so compose whichever you want by hand:
!
!   input src/auth/load.gs    the OAuth/OIDC front end (McpAuthRouter). Needs the kernel JWT
!                             classes JsonWebToken and JwtSecurityData, which arrived after 3.7.2;
!                             on an image without them these methods cannot compile.
!   input src/grail/load.gs   the GemStone-Python (Grail) toolset. Needs ModuleAst/BaseException.
!                             Loading it is not inert: the toolset joins the default tool surface
!                             (McpServer class>>installedDefaultToolsetNames).
!
! install.sh does this composition for you -- it detects whether the image can take src/auth and
! takes --auth / --no-auth / --grail -- so prefer it unless you are already inside a topaz session.

input src/core/load.gs
input src/tests/load.gs

commit
