set compile_env: 0
! ------------------- Class definition for GsMcpBase
expectvalue /Class
doit
Object subclass: 'GsMcpBase'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
GsMcpBase comment:
'Abstract superclass for the native MCP server pair: the front end GsMcpRouter (HTTP transport +
per-client session routing) and the per-client worker GsMcpServer (JSON-RPC dispatch + tools).
Holds only the two helpers both roles share -- JSON-RPC request-body parsing and best-effort
logging. Not instantiated directly.'
%
expectvalue /Class
doit
GsMcpBase category: 'GsMcp'
%
! ------------------- Remove existing behavior from GsMcpBase
removeallmethods GsMcpBase
removeallclassmethods GsMcpBase
! ------------------- Instance methods for GsMcpBase
category: 'private'
method: GsMcpBase
log: aString
  "Best-effort logging to the gem's log file; never fails the caller."
  [GsFile gciLogServer: aString] on: Error do: [:ex | nil]
%
category: 'private'
method: GsMcpBase
parseBody: aString
  "Parse a JSON-RPC request body to its Dictionary, or nil if empty/malformed.
   Cross-version: GS 3.7.x's JsonParser raises on bad input, but 3.6.2's (PetitParser-based)
   returns a PPFailure instead of raising -- so reject any non-Dictionary result, not just
   exceptions. A valid JSON-RPC request is always an object, so nil here -> a -32700 Parse error."
  (aString isNil or: [aString isEmpty]) ifTrue: [^nil].
  ^[ | parsed |
     parsed := JsonParser parse: aString.
     (parsed isKindOf: Dictionary) ifTrue: [parsed] ifFalse: [nil] ]
   on: Error do: [:ex | nil]
%
