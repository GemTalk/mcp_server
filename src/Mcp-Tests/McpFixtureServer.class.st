"
A worker-server subclass, in miniature: it exists to prove that a router configured with
workerClassName: 'McpFixtureServer' really does get THIS class instantiated in the worker gem, and
that a subclass can name itself.

Subclassing is for changing BEHAVIOR -- identity here, but equally the kernel guards, the worker
entry, or dispatcher wiring. To ADD TOOLS write a toolset instead (McpFixtureToolset is the
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
