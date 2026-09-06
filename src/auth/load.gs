! Load the OAuth/OIDC-authenticating front end (McpAuthRouter) and its two suites.
! Paths are relative to the REPOSITORY ROOT (install.sh cds there before running topaz).
! Requires src/core/load.gs (McpAuthRouter is an McpRouter subclass) and src/tests/load.gs
! (the suites reuse the core test fixtures).

run
"Pre-declare these class names in the Mcp dictionary BEFORE filing in any of them, as the other
 group loaders do: the group's classes may name each other in either direction (a suite names the
 router it exercises), so no file order can put every class ahead of its first mention -- without
 a declaration the compiler reports `undefined symbol` and the file-in stops. A nil-valued binding
 is enough: the compiler binds a global by its ASSOCIATION, and each class definition below fills
 that same association in, so methods compiled before their referent still see the real class.
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
names := #( #McpAuthRouter #McpAuthTest #McpAuthConformanceTest ).
names do: [:s | (d includesKey: s) ifFalse: [ d at: s put: nil ] ].
names size
%

input src/auth/McpAuthRouter.gs
input src/auth/McpAuthTest.gs
input src/auth/McpAuthConformanceTest.gs
