"
The extension story, tested through the fixtures: a third-party toolset (McpFixtureToolset) and a
named worker subclass (McpFixtureServer).

What this pins that the other suites do not: a vendor server exposing ONLY its own tools; two
independent toolsets composed on one server (which single inheritance could never do); a toolset's own
read-only declaration being honored; and a worker instantiating the class the FRONT END named, with the
identity precedence that follows -- a subclass override beats router config, config beats the default.
"
Class {
	#name : 'McpExtensionTest',
	#superclass : 'GsTestCase',
	#category : 'Mcp-Tests'
}

{ #category : 'helpers' }
McpExtensionTest >> dispatchOn: aServer request: requestDict [
  "Route requestDict through a dispatcher wired to aServer, so read-only gating and identity are
   exercised through the real path."
  ^(McpDispatcher withToolRegistry: aServer toolRegistry server: aServer) handle: requestDict

]

{ #category : 'helpers' }
McpExtensionTest >> includesCS: aSubstring in: aString [
  "Case-sensitive substring test (String>>includesString: is case-INsensitive in GemStone)."
  ^(aString findString: aSubstring startingAt: 1) > 0

]

{ #category : 'helpers' }
McpExtensionTest >> request: methodName params: paramsDict [
  | d |
  d := Dictionary new.
  d at: 'jsonrpc' put: '2.0'.
  d at: 'id' put: 1.
  d at: 'method' put: methodName.
  paramsDict ifNotNil: [d at: 'params' put: paramsDict].
  ^d

]

{ #category : 'helpers' }
McpExtensionTest >> toolCall: toolName args: argsDict [
  ^self request: 'tools/call' params:
    (Dictionary new at: 'name' put: toolName; at: 'arguments' put: argsDict; yourself)

]

{ #category : 'helpers' }
McpExtensionTest >> toolNamesOf: aServer [
  ^(aServer toolRegistry descriptors collect: [:d | d at: 'name']) asSortedCollection asArray

]

{ #category : 'helpers' }
McpExtensionTest >> withFreshWorkerCacheDo: aBlock [
  "Clear the per-session worker-instance cache before and after: SessionTemps outlives a test, so a
   server cached by one test would answer for another -- with a different class and surface."
  SessionTemps current removeKey: #McpServer ifAbsent: [nil].
  ^[aBlock value] ensure: [SessionTemps current removeKey: #McpServer ifAbsent: [nil]]

]

{ #category : 'helpers' }
McpExtensionTest >> withReadOnlyDo: aBlock [
  "Run aBlock in a read-only session, clearing the flag before and after (see McpContractTest)."
  SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil].
  ^[McpServer sessionReadOnly: true. aBlock value]
    ensure: [SessionTemps current removeKey: #McpReadOnly ifAbsent: [nil]]

]

{ #category : 'tests - composition' }
McpExtensionTest >> testFixtureToolsetComposesWithTheCoreSurface [
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

]

{ #category : 'tests - composition' }
McpExtensionTest >> testFixtureToolsetRunsThroughTheRealEnvelope [
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

]

{ #category : 'tests - composition' }
McpExtensionTest >> testVendorServerExposesOnlyItsOwnTools [
  "THE requirement behind toolsets: a vendor ships a server with their tools and NONE of the
   Smalltalk-development surface -- no execute_code, no mutation tools, no session control."
  | names |
  names := self toolNamesOf: (McpServer newWithToolsetNames: #('McpFixtureToolset')).
  self assert: names equals: #('fixture_echo').
  #('execute_code' 'compile_method' 'compile_class_definition' 'delete_class' 'commit'
    'describe_class' 'run_test_class') do: [:absent |
      self deny: (names includes: absent)]

]

{ #category : 'tests - read-only' }
McpExtensionTest >> testToolsetDecidesItsOwnReadOnlySafety [
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

]

{ #category : 'tests - worker class' }
McpExtensionTest >> testNamedSubclassAnswersTheWorkerEntry [
  "A worker dispatches through the class the front end NAMED: sending the class-side entry to the
   subclass builds the subclass, and its identity reaches the initialize result."
  self withFreshWorkerCacheDo: [ | out |
    out := McpFixtureServer handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'.
    self assert: (self includesCS: 'fixture-mcp' in: out).
    self assert: (self includesCS: '9.9.9' in: out)]

]

{ #category : 'tests - worker class' }
McpExtensionTest >> testSubclassIdentityBeatsRouterConfig [
  "Identity precedence: a subclass that overrides serverName cannot be renamed by a deployment (config
   only fills the ivar the default implementation reads), while a plain server takes the config value.
   Both directions pinned, since only the pair documents the rule."
  | fixture plain |
  fixture := McpFixtureServer new serverName: 'from-config'; serverVersion: '1.1.1'; yourself.
  self assert: fixture serverName equals: 'fixture-mcp'.
  self assert: fixture serverVersion equals: '9.9.9'.
  plain := McpServer new serverName: 'from-config'; yourself.
  self assert: plain serverName equals: 'from-config'

]

{ #category : 'tests - worker class' }
McpExtensionTest >> testBootstrapBuildsTheNamedSubclassWithItsNamedToolsets [
  "The whole per-session handshake in one call, as the front end makes it: the named CLASS is what gets
   built, with the named TOOLSETS and nothing else, cached for the first request."
  self withFreshWorkerCacheDo: [ | note out |
    note := McpFixtureServer
      prepareWorkerWithToolsets: #('McpFixtureToolset')
      readOnly: false serverName: nil version: nil.
    self assert: (self includesCS: 'McpFixtureServer ready' in: note).
    out := McpFixtureServer handleJsonString: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'.
    self assert: (self includesCS: 'fixture_echo' in: out).
    self deny: (self includesCS: 'execute_code' in: out).
    self deny: (self includesCS: 'describe_class' in: out)]

]

{ #category : 'tests - worker class' }
McpExtensionTest >> testRouterCarriesTheNamedClassAndToolsetsToTheSession [
  "The front end resolves both and hands them to the session, which names the class in the expression
   it runs in the worker gem. No login needed -- the wiring is what is under test."
  | r sess |
  r := McpRouter new.
  r workerClassName: 'McpFixtureServer'; toolsetNames: #('McpFixtureToolset');
    serverName: 'acme'; serverVersion: '3.0'.
  self assert: r validateWorkerConfig notNil.   "both names resolve in this image"
  sess := r openSessionCreating: [:id | McpStubSession new].
  self assert: sess workerClassName equals: 'McpFixtureServer'.
  self assert: sess wasPrepared.   "configured AND prepared, before the session is registered"
  self assert: (self includesCS: 'McpFixtureServer handleJsonString:'
    in: (sess workerExpressionFor: '{"jsonrpc":"2.0"}')).
  self assert: (self includesCS: 'McpFixtureServer prepareWorkerWithToolsets:'
    in: sess workerBootstrapExpression).
  self assert: (self includesCS: '''McpFixtureToolset''' in: sess workerBootstrapExpression)

]
