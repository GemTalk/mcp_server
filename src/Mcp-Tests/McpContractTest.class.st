"
Contract / property tests over the MCP tool surface, driven through McpDispatcher>>handle: (the
real JSON-RPC envelope). Covers the schema-strictness, argument-validation, structured-error, and
kernel-guard behaviors: every tool schema is closed; a raised error carries a structured kind; and
mutating a kernel class is refused. Also pins the MCP 2025-11-25 split between the two tools/call
failure envelopes -- arguments that violate a tool's own inputSchema are TOOL EXECUTION errors
(isError:true, so the model can self-correct), while a malformed request (no tool name) and an
unknown tool stay PROTOCOL errors (-32602). Read-only properties are added as those phases land.
"
Class {
	#name : 'McpContractTest',
	#superclass : 'GsTestCase',
	#category : 'Mcp-Tests'
}

{ #category : 'helpers' }
McpContractTest >> dispatch: requestDict [
  "Route requestDict through a fresh dispatcher wired to its owning server, so read-only gating is
   exercised through the real path."
  | s |
  s := McpServer new.
  ^(McpDispatcher withToolRegistry: s toolRegistry server: s) handle: requestDict

]

{ #category : 'helpers' }
McpContractTest >> includesCS: aSubstring in: aString [
  "Case-sensitive substring test (String>>includesString: is case-INsensitive in GemStone)."
  ^(aString findString: aSubstring startingAt: 1) > 0

]

{ #category : 'helpers' }
McpContractTest >> listedToolNames [
  "The tool names returned by tools/list through the (read-only-aware) dispatcher."
  ^(((self dispatch: (self request: 'tools/list' params: nil)) at: 'result') at: 'tools')
    collect: [:d | d at: 'name']

]

{ #category : 'helpers' }
McpContractTest >> request: methodName params: paramsDict [
  | d |
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'id' put: 1.
  d at: 'method' put: methodName.
  paramsDict ifNotNil: [d at: 'params' put: paramsDict].
  ^d

]

{ #category : 'helpers' }
McpContractTest >> savingReadOnlyDo: aBlock [
  "Run aBlock with the per-session read-only flag cleared BEFORE and after, so a read-only test
   starts clean and cannot leak the flag into other tests. Read-only is purely the per-session
   #McpReadOnly flag now -- there is no global switch to save/restore."
  SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil].
  ^[aBlock value] ensure: [SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil]]

]

{ #category : 'tests - guard' }
McpContractTest >> testAssertMutableClassRaisesRefused [
  "#2: the guard signals an McpError kinded #refused (and mutates nothing)."
  | kind |
  kind := [McpServer new assertMutableClass: Object. #noRaise]
    on: McpError do: [:e | e kind].
  self assert: kind equals: #refused

]

{ #category : 'tests - read-only' }
McpContractTest >> testCoreReadOnlyAllowListIsPinned [
  "The read-only allow-list is now distributed -- each toolset declares its own safe names and the
   server answers their union -- so pin that union against the audit list
   (McpServer class>>coreReadOnlySafeToolNames). Without this, a new core tool could quietly become
   'safe', or drop out of the gate, with no single place showing it."
  | union pinned |
  union := McpServer new readOnlySafeToolNames asSortedCollection asArray.
  pinned := McpServer coreReadOnlySafeToolNames asSortedCollection asArray.
  self assert: union equals: pinned

]

{ #category : 'tests - registry' }
McpContractTest >> testEveryDescriptorIsWellFormed [
  "Every tools/list descriptor has a non-empty name + description and an inputSchema."
  | descriptors |
  descriptors := McpServer new toolRegistry descriptors.
  self assert: descriptors notEmpty.
  descriptors do: [:d |
    self assert: (d includesKey: 'name').      self deny: (d at: 'name') isEmpty.
    self assert: (d includesKey: 'description'). self deny: (d at: 'description') isEmpty.
    self assert: (d includesKey: 'inputSchema')]

]

{ #category : 'tests - registry' }
McpContractTest >> testEverySchemaIsClosed [
  "#4: every tool's inputSchema is an object with additionalProperties:false, so unknown arguments
   are detectable rather than silently dropped."
  McpServer new toolRegistry descriptors do: [:d | | schema |
    schema := d at: 'inputSchema'.
    self assert: (schema at: 'type') equals: 'object'.
    self assert: (schema at: 'additionalProperties' ifAbsent: [true]) == false]

]

{ #category : 'tests - toolsets' }
McpContractTest >> testInstalledDefaultToolsetNamesIsCorePlusGrailWhenPresent [
  "The front end resolves the default surface with this (McpRouter>>effectiveToolsetNames). It is the
   core seven, plus McpGrailToolset only when that optional file is loaded -- so assert
   image-agnostically: the core names are always there, and any extra is the Grail toolset."
  | installed |
  installed := McpServer installedDefaultToolsetNames.
  McpServer defaultToolsetNames do: [:n | self assert: (installed includes: n)].
  (installed reject: [:n | McpServer defaultToolsetNames includes: n]) do: [:extra |
    self assert: extra equals: 'McpGrailToolset']

]

{ #category : 'tests - guard' }
McpContractTest >> testKernelGuardIgnoresShadowingDictionary [
  "#2: the guard must not be fooled by symbol-list ORDER. A dictionary earlier in the symbol list that
   also binds a kernel name (exactly what Grail's Python dictionary does with Object) once made
   dictionaryAndSymbolOf: answer that dictionary, so Object read as unprotected and the mutation tools
   would have modified kernel classes. Simulates the shadow, so this holds in any image.
   No commit and no dispatcher here -- a tools/call would abort the transaction and undo the fixture."
  | up shadow |
  up := System myUserProfile.
  shadow := SymbolDictionary new.
  shadow at: #Object put: Object.
  shadow at: #McpShadowProbe put: 42.
  up insertDictionary: shadow at: 1.
  [self assert: (up dictionaryAndSymbolOf: Object) first == shadow.  "the shadow really does win"
   self assert: (McpServer new isProtectedClass: Object)]            "...and the guard still refuses"
    ensure: [up removeDictionaryAt: (up symbolList indexOf: shadow)]

]

{ #category : 'tests - guard' }
McpContractTest >> testKernelMutationRefusedThroughEnvelope [
  "#2 end-to-end: compile_method on a kernel class is refused as an isError result with kind
   #refused, and adds no method to the kernel class."
  | result |
  result := (self dispatch: (self toolCall: 'compile_method' args:
    (Dictionary new
      at: 'className' put: 'Object';
      at: 'source' put: 'mcpKernelGuardProbe ^1';
      yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'structuredContent') at: 'error') at: 'kind') equals: 'refused'.
  self deny: (Object canUnderstand: #mcpKernelGuardProbe)

]

{ #category : 'tests - validation' }
McpContractTest >> testMissingRequiredArgumentRejected [
  "#4: a missing required argument fails the tool's inputSchema, so per MCP 2025-11-25 it is a TOOL
   EXECUTION error (isError:true) carrying actionable text, not a JSON-RPC protocol error."
  | result |
  result := (self dispatch: (self toolCall: 'describe_class' args: Dictionary new)) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (self includesCS: 'className'
    in: ((result at: 'content') first at: 'text'))

]

{ #category : 'tests - validation' }
McpContractTest >> testMissingToolNameIsProtocolError [
  "The boundary: a call with no `name` is a malformed CallToolRequest -- the REQUEST is wrong, not
   the arguments -- so it stays a protocol error (-32602), unlike an inputSchema violation."
  | resp |
  resp := self dispatch: (self request: 'tools/call' params: Dictionary new).
  self assert: ((resp at: 'error') at: 'code') equals: -32602.
  self assert: (((resp at: 'error') at: 'data') at: 'kind') equals: 'invalidParams'

]

{ #category : 'tests - validation' }
McpContractTest >> testNoArgumentToolReportsNoArguments [
  "A tool with an empty (closed) schema must not render an empty 'Allowed: ' list when it rejects
   an unknown argument -- it says so in words instead."
  | text |
  text := (((self dispatch: (self toolCall: 'status' args:
    (Dictionary new at: 'bogus' put: 1; yourself))) at: 'result') at: 'content') first at: 'text'.
  self assert: (self includesCS: 'takes no arguments' in: text).
  self deny: (self includesCS: 'Allowed:' in: text)

]

{ #category : 'tests - read-only' }
McpContractTest >> testNotReadOnlyByDefault [
  "Sanity: with the switch off, tools/list shows all 31 tools including the mutating ones."
  | names |
  names := self listedToolNames.
  self assert: names size equals: 31.
  self assert: (names includes: 'compile_method')

]

{ #category : 'tests - lifecycle' }
McpContractTest >> testPingReturnsEmptyResult [
  "MCP basic/utilities/ping is a MUST: the receiver MUST respond promptly with an EMPTY result.
   Not an error, not a tool -- so it is answered even though `ping` is in no tool registry."
  | resp |
  resp := self dispatch: (self request: 'ping' params: nil).
  self deny: (resp includesKey: 'error').
  self assert: (resp at: 'result') isEmpty

]

{ #category : 'tests - worker' }
McpContractTest >> testPrepareWorkerAppliesReadOnlyBeforeBuilding [
  "Read-only must be set before the build, or the gated tools would already be registered."
  self withFreshWorkerCacheDo: [
    self savingReadOnlyDo: [ | out |
      McpServer prepareWorkerWithToolsets: McpServer defaultToolsetNames
        readOnly: true serverName: nil version: nil.
      out := McpServer handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'.
      self deny: (self includesCS: 'execute_code' in: out).
      self deny: (self includesCS: 'compile_method' in: out).
      self assert: (self includesCS: 'describe_class' in: out)]]

]

{ #category : 'tests - worker' }
McpContractTest >> testPrepareWorkerBuildsNamedSurfaceAndCaches [
  "The bootstrap the front end sends at session open: it sets read-only, builds the named surface, and
   caches the instance where handleJsonString: finds it -- so the client's first request has no build to
   do and dispatches through what was prepared."
  self withFreshWorkerCacheDo: [
    self savingReadOnlyDo: [ | note listed |
      note := McpServer
        prepareWorkerWithToolsets: #('McpBrowsingToolset')
        readOnly: false serverName: 'acme-db-mcp' version: '2.5.0'.
      self assert: (self includesCS: 'McpServer ready' in: note).
      listed := (((McpServer handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')
        indexOfSubCollection: 'describe_class') > 0).
      self assert: listed.
      "the prepared instance is what answers -- not a freshly built default surface"
      self deny: ((McpServer handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')
        indexOfSubCollection: 'execute_code') > 0.
      "and the configured identity is what initialize reports"
      self assert: (self includesCS: 'acme-db-mcp'
        in: (McpServer handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'))]]

]

{ #category : 'tests - guard' }
McpContractTest >> testProtectedClassPredicate [
  "#2: a class whose home dictionary is Globals (the base classes) is protected; a class in a user
   dictionary is not. Uses a throwaway class created in UserGlobals (per the McpToolTest fixture
   convention)."
  | s probe |
  s := McpServer new.
  self assert: (s isProtectedClass: Object).
  probe := Object subclass: 'McpProtectedProbe'
    instVarNames: #() classVars: #() classInstVars: #()
    poolDictionaries: #() inDictionary: UserGlobals options: #().
  [self deny: (s isProtectedClass: probe)]
    ensure: [UserGlobals removeKey: #McpProtectedProbe ifAbsent: [nil]]

]

{ #category : 'tests - errors' }
McpContractTest >> testRaisedErrorCarriesStructuredKind [
  "#10: a tool that raises yields an isError result whose content keeps the real message AND whose
   structuredContent.error carries a machine-readable kind."
  | result struct |
  result := (self dispatch: (self toolCall: 'execute_code' args:
    (Dictionary new at: 'code' put: '1/0'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (self includesCS: 'ZeroDivide' in: ((result at: 'content') first at: 'text')).
  struct := result at: 'structuredContent'.
  self assert: ((struct at: 'error') includesKey: 'kind').
  self deny: ((struct at: 'error') at: 'message') isEmpty

]

{ #category : 'tests - read-only' }
McpContractTest >> testReadOnlyAllowsSafeToolCall [
  "#7: a safe (read) tool still works while read-only."
  self savingReadOnlyDo: [ | result |
    McpServer sessionReadOnly: true.
    result := (self dispatch: (self toolCall: 'describe_class' args:
      (Dictionary new at: 'className' put: 'Object'; yourself))) at: 'result'.
    self deny: (result at: 'isError')]

]

{ #category : 'tests - toolsets' }
McpContractTest >> testReadOnlyBuildDropsUnsafeToolsetWhole [
  "Build-time gating (McpServer>>registerToolsets): when the worker is already read-only as the server
   is built -- the production path -- an all-unsafe toolset contributes NOTHING to the registry, and a
   mixed one keeps only its safe tools. Stronger than refusing on call: the tool is not there at all."
  self savingReadOnlyDo: [ | names |
    McpServer sessionReadOnly: true.
    names := (McpServer newWithToolsetNames: #('McpMutationToolset' 'McpSessionToolset'))
      toolRegistry descriptors collect: [:d | d at: 'name'].
    self deny: (names includes: 'compile_method').   "all-unsafe toolset: dropped whole"
    self deny: (names includes: 'delete_class').
    self deny: (names includes: 'commit').           "mixed toolset: unsafe tool pruned"
    self assert: (names includes: 'abort').          "mixed toolset: safe tools kept"
    self assert: (names includes: 'status')]

]

{ #category : 'tests - read-only' }
McpContractTest >> testReadOnlyDistinguishesGatedFromUnknownTool [
  "The boundary the read-only build introduces: a gated tool is pruned from the registry, so both it
   and a nonexistent tool are registry misses -- but they must NOT answer the same. The gated one is
   -32601/readOnly ('exists, forbidden here'), a typo stays -32602/notFound."
  self savingReadOnlyDo: [ | gated unknown |
    McpServer sessionReadOnly: true.
    gated := (self dispatch: (self toolCall: 'commit' args: Dictionary new)) at: 'error'.
    unknown := (self dispatch: (self toolCall: 'no_such_tool' args: Dictionary new)) at: 'error'.
    self assert: (gated at: 'code') equals: -32601.
    self assert: ((gated at: 'data') at: 'kind') equals: 'readOnly'.
    self assert: (unknown at: 'code') equals: -32602.
    self assert: ((unknown at: 'data') at: 'kind') equals: 'notFound']

]

{ #category : 'tests - read-only' }
McpContractTest >> testReadOnlyGatesDangerousToolCall [
  "#7: a direct call to a gated tool is refused -32601 kind readOnly, before any validation or side
   effect. Targets a kernel class so a regression can't mutate anything even if the gate failed."
  self savingReadOnlyDo: [ | err |
    McpServer sessionReadOnly: true.
    err := (self dispatch: (self toolCall: 'compile_method' args:
      (Dictionary new at: 'className' put: 'Object'; at: 'source' put: 'x ^1'; yourself))) at: 'error'.
    self assert: (err at: 'code') equals: -32601.
    self assert: ((err at: 'data') at: 'kind') equals: 'readOnly']

]

{ #category : 'tests - read-only' }
McpContractTest >> testReadOnlyGatesExecuteCode [
  "#7: execute_code (arbitrary code -- the tool that most needs gating) is refused -32601 readOnly
   when the session is read-only."
  self savingReadOnlyDo: [ | err |
    McpServer sessionReadOnly: true.
    err := (self dispatch: (self toolCall: 'execute_code' args:
      (Dictionary new at: 'code' put: '1'; yourself))) at: 'error'.
    self assert: (err at: 'code') equals: -32601.
    self assert: ((err at: 'data') at: 'kind') equals: 'readOnly']

]

{ #category : 'tests - read-only' }
McpContractTest >> testReadOnlyHidesDangerousToolsFromList [
  "#7: read-only hides the gated (dangerous) tools from tools/list; safe tools remain."
  self savingReadOnlyDo: [ | names |
    McpServer sessionReadOnly: true.
    names := self listedToolNames.
    self deny: (names includes: 'compile_method').
    self deny: (names includes: 'execute_code').
    self deny: (names includes: 'commit').
    self assert: (names includes: 'describe_class').
    self assert: (names includes: 'status')]

]

{ #category : 'tests - toolsets' }
McpContractTest >> testServerBuiltWithOneToolsetExposesOnlyItsTools [
  "The vendor requirement: a server assembled from chosen toolsets exposes ONLY their tools, with none
   of the development surface. This is what subclassing could never express."
  | names |
  names := (McpServer newWithToolsetNames: #('McpBrowsingToolset')) toolRegistry descriptors
    collect: [:d | d at: 'name'].
  self assert: names asSortedCollection asArray
    equals: McpBrowsingToolset new toolNames asSortedCollection asArray.
  self deny: (names includes: 'execute_code').
  self deny: (names includes: 'compile_method').
  self deny: (names includes: 'commit')

]

{ #category : 'tests - identity' }
McpContractTest >> testServerInfoDefaultsToStockIdentity [
  "An unconfigured server reports the stock identity, from the single home for those literals."
  | info |
  info := ((self dispatch: (self request: 'initialize' params: Dictionary new)) at: 'result')
    at: 'serverInfo'.
  self assert: (info at: 'name') equals: McpServer defaultServerName.
  self assert: (info at: 'version') equals: McpServer defaultServerVersion

]

{ #category : 'tests - identity' }
McpContractTest >> testServerInfoFollowsDeploymentConfig [
  "A deployment assembled from toolsets may never subclass McpServer, so it sets its identity in
   router config, which the worker bootstrap passes to serverName:/serverVersion:. That must reach the
   initialize result -- note the dispatcher is built with the server, BEFORE these are set, so this
   also pins that it asks rather than caching."
  | s info |
  s := McpServer new serverName: 'acme-db-mcp'; serverVersion: '2.5.0'; yourself.
  info := (((McpDispatcher withToolRegistry: s toolRegistry server: s)
    handle: (self request: 'initialize' params: Dictionary new)) at: 'result') at: 'serverInfo'.
  self assert: (info at: 'name') equals: 'acme-db-mcp'.
  self assert: (info at: 'version') equals: '2.5.0'.
  "and nil restores the default rather than reporting an empty name"
  s serverName: nil.
  self assert: s serverName equals: McpServer defaultServerName

]

{ #category : 'tests - errors' }
McpContractTest >> testSyntaxErrorClassifiedAsCompileError [
  "#10: a transpile-time (syntax / undefined-name) error is classified 'compileError' -- distinct
   from a runtime error, which is 'other' -- so an agent can tell repair-worthy from retry-worthy."
  | result |
  result := (self dispatch: (self toolCall: 'execute_code' args:
    (Dictionary new at: 'code' put: '1 +'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'structuredContent') at: 'error') at: 'kind') equals: 'compileError'

]

{ #category : 'tests - guard' }
McpContractTest >> testToolsetGuardFailsClosedWithNoServer [
  "FAIL-CLOSED: a toolset built with no server cannot ask which classes are protected, so it refuses
   to mutate rather than assuming it may -- and says so as an ordinary #refused, the same kind the
   server's own guard raises, so a client sees no new error shape."
  | ts classKind dictKind |
  ts := McpMutationToolset new.
  classKind := [ts assertMutableClass: Object. #noRaise] on: McpError do: [:e | e kind].
  dictKind := [ts assertRemovableDictionaryNamed: 'UserGlobals'. #noRaise]
    on: McpError do: [:e | e kind].
  self assert: classKind equals: #refused.
  self assert: dictKind equals: #refused

]

{ #category : 'tests - guard' }
McpContractTest >> testToolsetGuardForwardsToTheServer [
  "A toolset's guard is a forward, not a second opinion: with a server attached it answers exactly
   what that server's policy says -- refusing a kernel class, passing a user class through."
  | ts probe |
  ts := McpMutationToolset on: McpServer new.
  self assert: ([ts assertMutableClass: Object. #noRaise] on: McpError do: [:e | e kind])
    equals: #refused.
  probe := Object subclass: 'McpGuardForwardProbe'
    instVarNames: #() classVars: #() classInstVars: #()
    poolDictionaries: #() inDictionary: UserGlobals options: #().
  [self assert: (ts assertMutableClass: probe) == probe]
    ensure: [UserGlobals removeKey: #McpGuardForwardProbe ifAbsent: [nil]]

]

{ #category : 'tests - read-only' }
McpContractTest >> testToolsetSafeNamesAreItsOwnTools [
  "A toolset may only vouch for tools it actually provides: every name in its readOnlySafeToolNames
   must be one of its toolNames. Catches a copy-paste that would whitelist another toolset's tool."
  McpServer new toolsets do: [:ts |
    ts readOnlySafeToolNames do: [:name |
      self assert: (ts toolNames includes: name)]]

]

{ #category : 'tests - registry' }
McpContractTest >> testToolsetsCoverEveryRegisteredTool [
  "toolNames is what config diagnostics and the pinned test above rely on, so it must not drift from
   what registerOn: actually registers: the union of the toolsets' toolNames is exactly the set of
   registered tools."
  | server declared registered |
  server := McpServer new.
  declared := OrderedCollection new.
  server toolsets do: [:ts | declared addAll: ts toolNames].
  registered := server toolRegistry descriptors collect: [:d | d at: 'name'].
  self assert: declared asSortedCollection asArray
    equals: registered asSortedCollection asArray

]

{ #category : 'tests - validation' }
McpContractTest >> testUnknownArgumentRejected [
  "#4: an argument not in the closed schema is refused BEFORE any side effect. Per MCP 2025-11-25
   the envelope is a tool execution error -- isError:true plus structuredContent.error.kind so an
   agent can still branch on the kind without parsing the prose."
  | result |
  result := (self dispatch: (self toolCall: 'describe_class' args:
    (Dictionary new at: 'className' put: 'Object'; at: 'bogus' put: 'x'; yourself))) at: 'result'.
  self assert: (result at: 'isError').
  self assert: (((result at: 'structuredContent') at: 'error') at: 'kind') equals: 'invalidParams'.
  self assert: (self includesCS: 'bogus' in: ((result at: 'content') first at: 'text'))

]

{ #category : 'tests - validation' }
McpContractTest >> testUnknownToolIsProtocolError [
  "The other side of the boundary: an unknown tool stays a protocol error (-32602 / kind notFound).
   The spec keeps it there because the model cannot self-correct a tool that does not exist."
  | resp |
  resp := self dispatch: (self toolCall: 'no_such_tool' args: Dictionary new).
  self assert: ((resp at: 'error') at: 'code') equals: -32602.
  self assert: (((resp at: 'error') at: 'data') at: 'kind') equals: 'notFound'

]

{ #category : 'tests - toolsets' }
McpContractTest >> testUnknownToolsetNameIsRefusedByName [
  "A misnamed toolset must fail loudly at build time, naming the toolset (the front end validates at
   startup and the worker bootstrap re-checks, but this is the message both surface)."
  | msg |
  msg := [McpServer newWithToolsetNames: #('McpNoSuchToolset'). nil]
    on: Error do: [:e | [e description] on: Error do: [:x | e messageText]].
  self deny: msg isNil.
  self assert: (self includesCS: 'McpNoSuchToolset' in: msg)

]

{ #category : 'tests - validation' }
McpContractTest >> testValidArgumentsAccepted [
  "A well-formed call is not rejected by validation (describe_class is read-only -> not isError)."
  | result |
  result := (self dispatch: (self toolCall: 'describe_class' args:
    (Dictionary new at: 'className' put: 'Object'; yourself))) at: 'result'.
  self deny: (result at: 'isError')

]

{ #category : 'helpers' }
McpContractTest >> toolCall: toolName args: argsDict [
  ^self request: 'tools/call' params:
    (Dictionary new at: 'name' put: toolName; at: 'arguments' put: argsDict; yourself)

]

{ #category : 'helpers' }
McpContractTest >> withFreshWorkerCacheDo: aBlock [
  "Clear the per-session worker-instance cache BEFORE and after, so a test driving the class-side
   handleJsonString: neither inherits a cached server nor leaks one into later tests. SessionTemps
   outlives each test -- the whole suite runs in one gem session."
  SessionTemps current removeKey: #McpServer ifAbsent: [nil].
  ^[aBlock value] ensure: [SessionTemps current removeKey: #McpServer ifAbsent: [nil]]

]
