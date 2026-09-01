set compile_env: 0
! ------------------- Class definition for McpExtensionTest
expectvalue /Class
doit
GsTestCase subclass: 'McpExtensionTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpExtensionTest comment: 
'The extension story, tested through the fixtures: a third-party toolset (McpFixtureToolset) and a
named worker subclass (McpFixtureServer).

What this pins that the other suites do not: a vendor server exposing ONLY its own tools; two
independent toolsets composed on one server (which single inheritance could never do); a toolset''s own
read-only declaration being honored; and a worker instantiating the class the FRONT END named, with the
identity precedence that follows -- a subclass override beats router config, config beats the default.'
%
expectvalue /Class
doit
McpExtensionTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpExtensionTest
removeallmethods McpExtensionTest
removeallclassmethods McpExtensionTest
! ------------------- Class methods for McpExtensionTest
! ------------------- Instance methods for McpExtensionTest
category: 'helpers'
method: McpExtensionTest
dispatchOn: aServer request: requestDict
  "Route requestDict through a dispatcher wired to aServer, so read-only gating and identity are
   exercised through the real path."
  ^(McpDispatcher withToolRegistry: aServer toolRegistry server: aServer) handle: requestDict
%
category: 'helpers'
method: McpExtensionTest
includesCS: aSubstring in: aString
  "Case-sensitive substring test (String>>includesString: is case-INsensitive in GemStone)."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'helpers'
method: McpExtensionTest
request: methodName params: paramsDict
  | d |
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'id' put: 1.
  d at: 'method' put: methodName.
  paramsDict ifNotNil: [d at: 'params' put: paramsDict].
  ^d
%
category: 'running'
method: McpExtensionTest
setUp
  "Start every test on a clean transaction. These tests assert the EXACT text of a tools/call
   result, and since 2026-08-28 a result carries a trailing session note whenever the session has
   uncommitted changes (McpDispatcher>>transactionNote) -- so ambient dirt left by whatever ran
   before would change the bytes under an equality assertion. Aborting here also makes each test
   independent of the order the suite runs in, which nothing guaranteed before."
  System abortTransaction
%
category: 'tests - worker class'
method: McpExtensionTest
testBootstrapBuildsTheNamedSubclassWithItsNamedToolsets
  "The whole per-session handshake in one call, as the front end makes it: the named CLASS is what gets
   built, with the named TOOLSETS and nothing else, cached for the first request."
  self withFreshWorkerCacheDo: [ | note out |
    note := McpFixtureServer
      prepareWorkerWithToolsets: #('McpFixtureToolset')
      readOnly: false serverName: nil title: nil version: nil frontEnd: nil.
    self assert: (self includesCS: 'McpFixtureServer ready' in: note).
    out := McpFixtureServer handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'.
    self assert: (self includesCS: 'fixture_echo' in: out).
    self deny: (self includesCS: 'execute_code' in: out).
    self deny: (self includesCS: 'describe_class' in: out).
    "with no identity in config the subclass's own default is reported"
    out := McpFixtureServer handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'.
    self assert: (self includesCS: 'fixture-mcp' in: out)].
  "...and a deployment that DOES name the server in config relabels it, through the same bootstrap"
  self withFreshWorkerCacheDo: [ | out |
    McpFixtureServer prepareWorkerWithToolsets: #('McpFixtureToolset')
      readOnly: false serverName: 'billing-mcp' title: 'Billing - staging' version: '1.1.1'
      frontEnd: nil.
    out := McpFixtureServer handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'.
    self assert: (self includesCS: 'billing-mcp' in: out).
    self assert: (self includesCS: 'Billing - staging' in: out).
    self deny: (self includesCS: 'fixture-mcp' in: out)]
%
category: 'tests - composition'
method: McpExtensionTest
testFixtureToolsetComposesWithTheCoreSurface
  "Composition, the thing subclassing could not express: a third-party toolset alongside all seven
   core ones, on one server. Both surfaces are fully present."
  | server names |
  server := McpServer newWithToolsetNames:
    (McpServer defaultToolsetNames , (Array with: 'McpFixtureToolset')).
  names := self toolNamesOf: server.
  self assert: names size equals: 32.
  self assert: (names includes: 'fixture_echo').
  self assert: (names includes: 'execute_code').
  self assert: (names includes: 'describe_class')
%
category: 'tests - composition'
method: McpExtensionTest
testFixtureToolsetRunsThroughTheRealEnvelope
  "The registered tool is callable through tools/call and its result comes back as normal content --
   a third-party toolset needs no dispatcher changes."
  | server result |
  server := McpServer newWithToolsetNames: #('McpFixtureToolset').
  result := (self dispatchOn: server request: (self toolCall: 'fixture_echo'
    args: (Dictionary new at: 'text' put: 'hello'; yourself))) at: 'result'.
  self deny: (result at: 'isError').
  self assert: ((result at: 'content') first at: 'text') equals: 'echo: hello'.
  "and its schema is closed like every other tool's, since it was built with the shared helper"
  self assert: ((((server toolRegistry at: 'fixture_echo') descriptor at: 'inputSchema')
    at: 'additionalProperties') == false)
%
category: 'tests - worker class'
method: McpExtensionTest
testNamedSubclassAnswersTheWorkerEntry
  "A worker dispatches through the class the front end NAMED: sending the class-side entry to the
   subclass builds the subclass, and its identity reaches the initialize result."
  self withFreshWorkerCacheDo: [ | out |
    out := McpFixtureServer handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'.
    self assert: (self includesCS: 'fixture-mcp' in: out).
    self assert: (self includesCS: '9.9.9' in: out)]
%
category: 'tests - worker class'
method: McpExtensionTest
testRouterCarriesTheNamedClassAndToolsetsToTheSession
  "The front end resolves both and hands them to the session, which names the class in the expression
   it runs in the worker gem. No login needed -- the wiring is what is under test."
  | r sess |
  r := McpRouter new.
  r workerClassName: 'McpFixtureServer'; toolsetNames: #('McpFixtureToolset');
    serverName: 'acme'; serverTitle: 'Acme - box 7'; serverVersion: '3.0'.
  self assert: r validateWorkerConfig notNil.   "both names resolve in this image"
  sess := r openSessionCreating: [:id | McpStubSession new].
  self assert: sess workerClassName equals: 'McpFixtureServer'.
  self assert: sess wasPrepared.   "configured AND prepared, before the session is registered"
  self assert: (self includesCS: 'McpFixtureServer handleJsonString:'
    in: (sess workerExpressionFor: '{"jsonrpc":"2.0"}')).
  self assert: (self includesCS: 'McpFixtureServer prepareWorkerWithToolsets:'
    in: sess workerBootstrapExpression).
  self assert: (self includesCS: '''McpFixtureToolset''' in: sess workerBootstrapExpression).
  "the instance label travels down the same pipeline, quoted for the worker's compiler"
  self assert: (self includesCS: 'title: ''Acme - box 7''' in: sess workerBootstrapExpression)
%
category: 'tests - worker class'
method: McpExtensionTest
testRouterConfigRelabelsASubclassThatNamesItself
  "Identity precedence, in both directions -- only the pair documents the rule. A subclass names itself
   by overriding the class-side default, so it applies when a deployment says nothing; and a deployment
   can still relabel it -- which for the NAME means 'a different product', since an operator running two
   instances of one product sets serverTitle instead. Same for a plain server, whose default is the
   stock name."
  | fixture plain |
  fixture := McpFixtureServer new.
  self assert: fixture serverName equals: 'fixture-mcp'.
  self assert: fixture serverVersion equals: '9.9.9'.
  "the fixture names itself but does NOT title itself: an instance label is the operator's to set"
  self assert: fixture serverTitle isNil.
  fixture serverName: 'billing-mcp'; serverTitle: 'Billing - staging'; serverVersion: '1.1.1'.
  self assert: fixture serverName equals: 'billing-mcp'.
  self assert: fixture serverTitle equals: 'Billing - staging'.
  self assert: fixture serverVersion equals: '1.1.1'.
  "nil restores the subclass's default rather than the stock name -- and for the title, no title"
  fixture serverName: nil.
  self assert: fixture serverName equals: 'fixture-mcp'.
  fixture serverTitle: nil.
  self assert: fixture serverTitle isNil.
  plain := McpServer new.
  self assert: plain serverName equals: 'gemstone-mcp'.
  self assert: plain serverTitle isNil.
  plain serverName: 'billing-mcp'.
  self assert: plain serverName equals: 'billing-mcp'
%
category: 'tests - guards'
method: McpExtensionTest
testSubclassGuardPolicyReachesEveryToolset
  "Where the kernel guard lives, proved rather than asserted: the POLICY is the server's, so hardening
   it in a subclass (McpFixtureServer protects the shared Published dictionary too) hardens every tool
   pack that server registers. The same toolset class, asked the same question, answers differently
   depending only on which server it was built for -- so a third-party toolset gets the deployment's
   answer without knowing the policy exists; what it must not do is hold an answer of its own.
   Uses the dictionary guard rather than the class guard because it needs no fixture and resolves no
   dictionary, so it holds in an image where Published does not exist. The class guard's forwarding is
   covered by McpContractTest."
  | plain hardened |
  plain := McpMutationToolset on: McpServer new.
  hardened := McpMutationToolset on: McpFixtureServer new.
  self assert: (plain assertRemovableDictionaryNamed: 'Published') equals: 'Published'.
  self assert: ([hardened assertRemovableDictionaryNamed: 'Published'. #noRaise]
    on: McpError do: [:e | e kind]) equals: #refused.
  "and the tightening is additive: Globals stays protected on both, so a subclass adds to the guard
   rather than replacing it"
  (Array with: plain with: hardened) do: [:ts |
    self assert: ([ts assertRemovableDictionaryNamed: 'Globals'. #noRaise]
      on: McpError do: [:e | e kind]) equals: #refused]
%
category: 'tests - read-only'
method: McpExtensionTest
testToolsetDecidesItsOwnReadOnlySafety
  "A toolset's own readOnlySafeToolNames is honored: the fixture tool survives a read-only build
   because its toolset vouches for it, while the core mutating tools are dropped. Nothing central had
   to be edited to allow a third-party tool through."
  self withReadOnlyDo: [ | names |
    names := self toolNamesOf: (McpServer newWithToolsetNames:
      (McpServer defaultToolsetNames , (Array with: 'McpFixtureToolset'))).
    self assert: (names includes: 'fixture_echo').
    self assert: (names includes: 'describe_class').
    self deny: (names includes: 'execute_code').
    self deny: (names includes: 'compile_method')]
%
category: 'tests - composition'
method: McpExtensionTest
testVendorServerExposesOnlyItsOwnTools
  "THE requirement behind toolsets: a vendor ships a server with their tools and NONE of the
   Smalltalk-development surface -- no execute_code, no mutation tools, no session control."
  | names |
  names := self toolNamesOf: (McpServer newWithToolsetNames: #('McpFixtureToolset')).
  self assert: names equals: #('fixture_echo').
  #('execute_code' 'compile_method' 'compile_class_definition' 'delete_class' 'commit'
    'describe_class' 'run_test_class') do: [:absent |
      self deny: (names includes: absent)]
%
category: 'helpers'
method: McpExtensionTest
toolCall: toolName args: argsDict
  ^self request: 'tools/call' params:
    (Dictionary new at: 'name' put: toolName; at: 'arguments' put: argsDict; yourself)
%
category: 'helpers'
method: McpExtensionTest
toolNamesOf: aServer
  ^(aServer toolRegistry descriptors collect: [:d | d at: 'name']) asSortedCollection asArray
%
category: 'helpers'
method: McpExtensionTest
withFreshWorkerCacheDo: aBlock
  "Clear the per-session worker-instance cache before and after: SessionTemps outlives a test, so a
   server cached by one test would answer for another -- with a different class and surface."
  SessionTemps current removeKey: #McpServer ifAbsent: [nil].
  ^[aBlock value] ensure: [SessionTemps current removeKey: #McpServer ifAbsent: [nil]]
%
category: 'helpers'
method: McpExtensionTest
withReadOnlyDo: aBlock
  "Run aBlock in a read-only session, clearing the flag before and after (see McpContractTest)."
  SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil].
  ^[McpServer sessionReadOnly: true. aBlock value]
    ensure: [SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil]]
%
