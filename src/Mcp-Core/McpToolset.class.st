"
Abstract superclass of the tool packs an McpServer registers: one toolset owns a related group of
MCP tools -- their names, descriptions, JSON schemas, and (eventually) their handlers -- and
registers them on a tool registry via registerOn:.

Toolsets, not subclasses, are how a deployment chooses its tool surface. A worker server is built
with a list of toolset names (McpServer class>>newWithToolsetNames:), which the front end resolves
per session and pushes into the worker gem -- so a vendor can expose ONLY their own tools, with none
of the Smalltalk-development surface, and two independent tool packs can be combined (which single
inheritance could never do).

To write your own: subclass this, implement registerOn: (one toolRegistry name:description:
inputSchema:do: send per tool, building schemas with the helpers here), implement toolNames, and
declare readOnlySafeToolNames -- which defaults to NONE, so a tool is gated in a read-only session
until it is deliberately listed as unable to persist a change. Then name your class in the router's
toolsetNames config. Your class must be visible in the WORKER gem's symbol list (Published, not the
operator's UserGlobals), because the worker may log in as a different user.

The schema builders are BOTH class- and instance-side: the class-side methods are the single
implementation, and the instance-side ones let a registerOn: body read as `self objectSchema: ...`.

NB the `server` reference: today a core toolset's handlers still live on McpServer, so its blocks
delegate to `server` (see McpServer). That is a transitional seam -- as handlers move onto their
toolsets the blocks become `[:args | self tool_x: args]` and the reference falls away.
"
Class {
	#name : 'McpToolset',
	#superclass : 'Object',
	#instVars : [
		'server'
	],
	#category : 'Mcp-Core'
}

{ #category : 'schema building' }
McpToolset class >> boolProperty: aDescription [
  | d |
  d := Dictionary new.
  d at: 'type' put: 'boolean'.
  d at: 'description' put: aDescription.
  ^d

]

{ #category : 'schema building' }
McpToolset class >> objectSchema: propsDict required: requiredArray [
  "Build a closed JSON-Schema object: additionalProperties is false so an unknown/hallucinated
   argument is a detectable error (McpTool>>validationErrorFor:) rather than silently dropped.
   Every tool's inputSchema is built through here, so this closes them all."
  | d |
  d := Dictionary new.
  d at: 'type' put: 'object'.
  d at: 'properties' put: propsDict.
  d at: 'required' put: requiredArray.
  d at: 'additionalProperties' put: false.
  ^d

]

{ #category : 'instance creation' }
McpToolset class >> on: aServer [
  "A toolset for aServer, the McpServer whose registry it registers on (and, for a core toolset,
   whose handlers its blocks still call -- see the class comment)."
  ^self new setServer: aServer

]

{ #category : 'schema building' }
McpToolset class >> propString: aDescription [
  | d |
  d := Dictionary new.
  d at: 'type' put: 'string'.
  d at: 'description' put: aDescription.
  ^d

]

{ #category : 'schema building' }
McpToolset >> boolProperty: aDescription [
  ^self class boolProperty: aDescription

]

{ #category : 'schema building' }
McpToolset >> objectSchema: propsDict required: requiredArray [
  ^self class objectSchema: propsDict required: requiredArray

]

{ #category : 'schema building' }
McpToolset >> propString: aDescription [
  ^self class propString: aDescription

]

{ #category : 'read-only' }
McpToolset >> readOnlySafeToolNames [
  "Which of MY tools cannot persist a change, and so may run in a read-only session. FAIL-CLOSED:
   the default is none, so a tool this toolset does not list here is gated in read-only mode --
   including a future one its author forgot to classify."
  ^#()

]

{ #category : 'registration' }
McpToolset >> registerOn: aToolRegistry [
  "Register each of my tools on aToolRegistry (one name:description:inputSchema:do: send per tool).
   Subclasses implement this; it is the whole point of a toolset."
  ^self subclassResponsibility

]

{ #category : 'accessing' }
McpToolset >> server [
  "The McpServer this toolset registers on (see the class comment on this transitional seam)."
  ^server

]

{ #category : 'initialization' }
McpToolset >> setServer: aServer [
  server := aServer.
  ^self

]

{ #category : 'accessing' }
McpToolset >> toolNames [
  "The names of the tools I register, for config diagnostics and for the contract test that pins the
   read-only allow-list. Subclasses implement this."
  ^self subclassResponsibility

]
