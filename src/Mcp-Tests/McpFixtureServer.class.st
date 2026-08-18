"
A worker-server subclass, in miniature: it exists to prove that a router configured with
workerClassName: 'McpFixtureServer' really does get THIS class instantiated in the worker gem, and
that a subclass can change what the server calls itself.

Subclassing is for changing BEHAVIOR -- identity here, but equally the kernel guards, the worker
entry, or dispatcher wiring. To ADD TOOLS write a toolset instead (McpFixtureToolset is the
counterpart example). A subclass is only ever used when it is NAMED in router config; nothing
auto-detects it.
"
Class {
	#name : 'McpFixtureServer',
	#superclass : 'McpServer',
	#category : 'Mcp-Tests'
}

{ #category : 'identity' }
McpFixtureServer >> serverName [
  "Overriding the method wins over router config, which only fills the ivar -- a subclass that
   deliberately names itself should not be renamable by a deployment. Pinned by McpExtensionTest."
  ^'fixture-mcp'

]

{ #category : 'identity' }
McpFixtureServer >> serverVersion [
  ^'9.9.9'

]
