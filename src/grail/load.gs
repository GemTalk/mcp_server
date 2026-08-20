! Load the optional GemStone-Python (Grail) MCP toolset and its test suite.
! Paths are relative to the REPOSITORY ROOT (install.sh cds there before running topaz).
! Only valid on a Grail/ModuleAst image: these methods reference ModuleAst and BaseException and
! cannot compile without them. Requires src/core/load.gs (McpToolset) and src/tests/load.gs.
! Once loaded the toolset joins the default tool surface -- see
! McpServer class>>installedDefaultToolsetNames.

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
names := #( #McpGrailToolset #McpGrailToolsetTest ).
names do: [:s | (d includesKey: s) ifFalse: [ d at: s put: nil ] ].
names size
%

input src/grail/McpGrailToolset.gs
input src/grail/McpGrailToolsetTest.gs
