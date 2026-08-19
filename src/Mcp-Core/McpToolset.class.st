"
Abstract superclass of the tool packs an McpServer registers: one toolset owns a related group of
MCP tools -- their names, descriptions, JSON schemas AND their handlers -- and registers them on a
tool registry via registerOn:.

Toolsets, not subclasses, are how a deployment chooses its tool surface. A worker server is built
with a list of toolset names (McpServer class>>newWithToolsetNames:), which the front end resolves
per session and pushes into the worker gem -- so a vendor can expose ONLY their own tools, with none
of the Smalltalk-development surface, and two independent tool packs can be combined (which single
inheritance could never do).

To write your own: subclass this, implement registerOn: (one toolRegistry name:description:
inputSchema:do: send per tool, building schemas with the helpers here, each block calling one of your
own tool_* handlers), implement toolNames, and declare readOnlySafeToolNames -- which defaults to
NONE, so a tool is gated in a read-only session until it is deliberately listed as unable to persist
a change. Then name your class in the router's toolsetNames config. Your class must be visible in the
WORKER gem's symbol list (Published, not the operator's UserGlobals), because the worker may log in
as a different user.

The schema builders and the image-lookup helpers every toolset needs (resolveClass:, dictNamed:,
linesFrom:, capResult:) are BOTH class- and instance-side: the class-side methods are the single
implementation -- McpServer's kernel guards reach dictNamed: that way, so the lookup has one home --
and the instance-side ones let a registerOn: or handler body read as `self objectSchema: ...` /
`self resolveClass: ...`.

NB the `server` reference: a toolset's handlers own their own work, but the POLICY question 'may this
be modified at all?' is one answer per deployment, not per tool pack -- so it stays on McpServer
(protectedDictionaryNames / isProtectedClass:), which is what a subclass overrides to change
behavior, and the guards here forward to it. A mutating handler writes `self assertMutableClass: cls`
exactly as it writes `self resolveClass:`; see McpMutationToolset. A toolset is free to impose a
STRICTER guard of its own on top (or, knowing what it is doing, to skip these and answer to the
server's read-only gate alone) -- what it must not do is answer the deployment's question
differently. Handlers that need no policy never touch `server` at all (McpGrailToolset and
McpFixtureToolset are examples).
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

{ #category : 'private' }
McpToolset class >> capResult: aString [
  "Cap an arbitrary tool result at 50000 characters so a huge value can't swamp the client. Shared by
   execute_code and the Python tools of the optional Grail toolset."
  ^aString size > 50000
    ifTrue: [(aString copyFrom: 1 to: 50000) , ' ...[truncated]']
    ifFalse: [aString]

]

{ #category : 'private' }
McpToolset class >> dictNamed: aName [
  "Find a symbol dictionary by name in the current symbol list, or nil."
  System myUserProfile symbolList do: [:d | d name asString = aName ifTrue: [^d]].
  ^nil

]

{ #category : 'private' }
McpToolset class >> linesFrom: aCollectionOfStrings [
  "Sort the strings and join them one per line; '(none)' if empty."
  | s |
  aCollectionOfStrings isEmpty ifTrue: [^'(none)'].
  s := WriteStream on: String new.
  (aCollectionOfStrings asSortedCollection asArray) do: [:n |
    s nextPutAll: n asString; nextPut: Character lf].
  ^s contents

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
  "A toolset for aServer, the McpServer whose registry it registers on (and whose server-level policy
   -- the kernel guards -- its handlers consult; see the class comment)."
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

{ #category : 'private' }
McpToolset class >> resolveClass: aName [
  "Resolve a class by name in the current symbol list, or nil if the name is unbound or not a class."
  | obj |
  obj := System myUserProfile objectNamed: aName asSymbol.
  ^(obj isKindOf: Behavior) ifTrue: [obj] ifFalse: [nil]

]

{ #category : 'guards' }
McpToolset >> assertMutableClass: aClass [
  "Answer aClass, or refuse (signal McpError kind:#refused) if it is a protected/kernel class. Every
   handler that changes a class should pass through here FIRST -- structured mutation never modifies
   kernel/system classes; execute_code is the deliberate escape hatch, and a deployment that wants
   even that closed simply does not register McpExecutionToolset.
   The answer comes from the SERVER, because what counts as protected is one policy per deployment
   (McpServer>>isProtectedClass:, overridable in a subclass) and two toolsets must not disagree about
   it. FAIL-CLOSED when there is no server: a toolset that cannot consult the policy refuses to mutate
   rather than assuming it may."
  server isNil ifTrue: [
    ^McpError signalKind: #refused message:
      'Refused: cannot modify ' , aClass name asString , ' -- this toolset has no server to ask which '
        , 'classes are protected. Build it with McpToolset class>>on: so it can consult the '
        , 'deployment''s kernel guard.'].
  ^server assertMutableClass: aClass

]

{ #category : 'guards' }
McpToolset >> assertRemovableDictionaryNamed: aName [
  "Answer aName, or refuse (McpError kind:#refused) if it names a protected system dictionary. Same
   forward-and-fail-closed rule as assertMutableClass:, for removing a symbol dictionary."
  server isNil ifTrue: [
    ^McpError signalKind: #refused message:
      'Refused: cannot remove dictionary ' , aName asString , ' -- this toolset has no server to ask '
        , 'which dictionaries are protected. Build it with McpToolset class>>on:.'].
  ^server assertRemovableDictionaryNamed: aName

]

{ #category : 'schema building' }
McpToolset >> boolProperty: aDescription [
  ^self class boolProperty: aDescription

]

{ #category : 'private' }
McpToolset >> capResult: aString [
  ^self class capResult: aString

]

{ #category : 'private' }
McpToolset >> dictNamed: aName [
  ^self class dictNamed: aName

]

{ #category : 'private' }
McpToolset >> linesFrom: aCollectionOfStrings [
  ^self class linesFrom: aCollectionOfStrings

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

{ #category : 'private' }
McpToolset >> resolveClass: aName [
  ^self class resolveClass: aName

]

{ #category : 'accessing' }
McpToolset >> server [
  "The McpServer this toolset registers on, and the home of the server-level policy a handler must
   respect -- the kernel guards. nil for a toolset built without one (see the class comment)."
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
