"
A worker-server subclass, in miniature: it exists to prove that a router configured with
workerClassName: 'McpFixtureServer' really does get THIS class instantiated in the worker gem, and
that a subclass can name itself.

Subclassing is for changing BEHAVIOR -- here its identity and its kernel guard, but equally the worker
entry or dispatcher wiring. To ADD TOOLS write a toolset instead (McpFixtureToolset is the
counterpart example). A subclass is only ever used when it is NAMED in router config; nothing
auto-detects it.

It names itself the ENCOURAGED way, by overriding the class-side defaultServerName /
defaultServerVersion rather than the instance-side serverName / serverVersion. That keeps the name a
default -- a deployment can still relabel this server through router config, which is what an operator
running two instances of one product needs. Overriding the instance-side methods would win over
config; see McpServer>>serverName.
"
Class {
	#name : 'McpFixtureServer',
	#superclass : 'McpServer',
	#category : 'Mcp-Tests'
}

{ #category : 'identity' }
McpFixtureServer class >> defaultServerName [
  ^'fixture-mcp'

]

{ #category : 'identity' }
McpFixtureServer class >> defaultServerVersion [
  ^'9.9.9'

]

{ #category : 'guards' }
McpFixtureServer >> protectedDictionaryNames [
  "The other half of what subclassing is for: this one hardens the kernel guard the way a production
   deployment might, putting the SHARED application dictionary off limits as well as Globals. Every
   toolset this server registers inherits the tightened answer -- including a third party's, which
   never mentions the guard -- because a toolset FORWARDS the question here
   (McpToolset>>assertMutableClass:).
   Published is the example on purpose: it is shared between users, which is what makes protecting it
   a plausible deployment stance. NOT UserGlobals, which is the user's own sandbox and the default
   home for the classes they most want to edit. Only Globals and UserGlobals exist in every image, so
   Published may not resolve here -- harmless either way: isProtectedClass: skips a dictionary name
   that resolves to nil, and assertRemovableDictionaryNamed: compares names without resolving any."
  ^super protectedDictionaryNames , #('Published')

]
