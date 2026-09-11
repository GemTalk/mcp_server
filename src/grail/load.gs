! Load the optional GemStone-Python (Grail) MCP toolset and its test suite.
! Paths are relative to the REPOSITORY ROOT (install.sh cds there before running topaz).
! Only valid on a Grail/ModuleAst image: these methods reference ModuleAst and BaseException and
! cannot compile without them. Requires src/core/load.gs (McpToolset) and src/tests/load.gs.
! Loading this group EXPOSES NOTHING on its own: McpGrailToolset is not in the default tool surface
! (McpServer class>>defaultToolsetNames), so a server has these tools only when its router names the
! toolset -- see run-server.sh's MCP_TOOLSETS.

run
"Pre-declare these class names in the Mcp dictionary BEFORE filing in any of them. The classes
 reference each other in both directions (McpDispatcher asks McpServer for its name; McpServer
 builds a McpDispatcher), so no file order can put every class ahead of its first mention --
 without a declaration the compiler reports `undefined symbol` and the file-in stops. A nil-valued
 binding is enough: the compiler binds a global by its ASSOCIATION, and each class definition below
 fills that same association in, so methods compiled before their referent still see the real class.
 Existing keys are left alone, so re-installing over a loaded image changes nothing."
| up d names |
up := System myUserProfile.
d := up objectNamed: #Mcp.
d isNil ifTrue: [
  "Mcp is this project's own dictionary, so -- unlike Published -- it is not standard in any image.
   Create it self-referenced, because a SymbolDictionary's name IS the key inside it whose value is
   itself (SymbolDictionary>>name is `self keyAtValue: self`), and append it to the symbol list.
   install.sh does this too; repeated here so a loader run by hand on a fresh image still works."
  d := SymbolDictionary new.
  d at: #Mcp put: d.
  up insertDictionary: d at: up symbolList size + 1 ].
names := #( #McpGrailToolset #McpGrailToolsetTest ).
names do: [:s | (d includesKey: s) ifFalse: [ d at: s put: nil ] ].
names size
%

input src/grail/McpGrailToolset.gs
input src/grail/McpGrailToolsetTest.gs
