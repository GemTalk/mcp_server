set compile_env: 0
! ------------------- Class definition for GsJasperDisplayBug
expectvalue /Class
doit
Object subclass: 'GsJasperDisplayBug'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: UserGlobals
  options: #()

%
! ------------------- Remove existing behavior from GsJasperDisplayBug
removeallmethods GsJasperDisplayBug
removeallclassmethods GsJasperDisplayBug
! ------------------- Class methods for GsJasperDisplayBug
! ------------------- Instance methods for GsJasperDisplayBug
category: 'probe'
method: GsJasperDisplayBug
asciiMethod
  "Single-byte method"
  ^'displays fine'
%
category: 'probe'
method: GsJasperDisplayBug
nonAsciiPos18
  "—"
  ^'does not display in browser'
%
category: 'probe'
method: GsJasperDisplayBug
nonAsciiPos256
  "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx—xxx"
  ^'does not display in browser'
%
category: 'probe'
method: GsJasperDisplayBug
nonAsciiPos257
  "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx—xx"
  ^'displays fine'
%
category: 'probe'
method: GsJasperDisplayBug
report
  "Find the non-ASCII characters in each method"
  | out |
  out := OrderedCollection new.
  self class selectors do: [:sel | | str positions |
    str := self class sourceCodeAt: sel.
    positions := OrderedCollection new.
    1 to: str size do: [:i | 
      (str at: i) asInteger > 127 ifTrue: [positions add: i]].
    positions isEmpty ifTrue: [positions add: 0].
    out add: (OrderedCollection with: sel asString with: str class with: positions)].
  ^out
%
