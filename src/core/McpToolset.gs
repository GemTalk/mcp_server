set compile_env: 0
! ------------------- Class definition for McpToolset
expectvalue /Class
doit
Object subclass: 'McpToolset'
  instVarNames: #( server)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpToolset comment: 
'Abstract superclass of the tool packs an McpServer registers: one toolset owns a related group of
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
a change. Then name your class in the router''s toolsetNames config. Your class must be visible in the
WORKER gem''s symbol list (Published, not the operator''s UserGlobals), because the worker may log in
as a different user.

The schema builders and the image-lookup helpers every toolset needs (resolveClass:, dictNamed:,
linesFrom:, capResult:) are BOTH class- and instance-side: the class-side methods are the single
implementation -- McpServer''s kernel guards reach dictNamed: that way, so the lookup has one home --
and the instance-side ones let a registerOn: or handler body read as `self objectSchema: ...` /
`self resolveClass: ...`.

NB the `server` reference: a toolset''s handlers own their own work, but the POLICY question ''may this
be modified at all?'' is one answer per deployment, not per tool pack -- so it stays on McpServer
(protectedDictionaryNames / isProtectedClass:), which is what a subclass overrides to change
behavior, and the guards here forward to it. A mutating handler writes `self assertMutableClass: cls`
exactly as it writes `self resolveClass:`; see McpMutationToolset. A toolset is free to impose a
STRICTER guard of its own on top (or, knowing what it is doing, to skip these and answer to the
server''s read-only gate alone) -- what it must not do is answer the deployment''s question
differently. Handlers that need no policy never touch `server` at all (McpGrailToolset and
McpFixtureToolset are examples).'
%
expectvalue /Class
doit
McpToolset category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpToolset
removeallmethods McpToolset
removeallclassmethods McpToolset
! ------------------- Class methods for McpToolset
category: 'schema building'
classmethod: McpToolset
boolProperty: aDescription
  | d |
  d := Dictionary new.
  d at: 'type' put: 'boolean'.
  d at: 'description' put: aDescription.
  ^d
%
category: 'private'
classmethod: McpToolset
capResult: aString
  "Cap an arbitrary tool result at 50000 characters so a huge value can't swamp the client. Shared by
   execute_code and the Python tools of the optional Grail toolset."
  ^aString size > 50000
    ifTrue: [(aString copyFrom: 1 to: 50000) , ' ...[truncated]']
    ifFalse: [aString]
%
category: 'transaction'
classmethod: McpToolset
commitConflictPending
  "Whether this session's last commit FAILED on conflict and left the transaction in the state the
   manual calls must-abort: the view is frozen, no commit can succeed, and only an abort clears it.

   TEST #retryFailure SPECIFICALLY, never 'anything but #success'. Measured on 3.7.5 and 3.7.6,
   `System transactionConflicts at: #commitResult` answers #success on a fresh session, after a
   successful commit and after an abort; #retryFailure while a failed commit is unresolved; and
   #readOnly after a System continueTransaction, which the `refresh` tool sends. An earlier version
   of this read 'not #success' and so reported a jammed session from the first successful refresh
   onward. Reading it does not clear it."
  ^[(System transactionConflicts at: #commitResult ifAbsent: [#success]) == #retryFailure]
    on: Error do: [:e | false]
%
category: 'transaction'
classmethod: McpToolset
commitConflictReport
  "A short human-readable summary of the last commit's conflicts: each conflict category and how
   many objects it names, e.g. 'Write-Write(2)'. Deliberately NOT the conflict dictionary's
   printString -- that holds the conflicting OBJECTS themselves and can be enormous.
   #commitResult and #RcReadSet are skipped: the first is the verdict rather than a conflict, and
   the second is populated on success too. The remaining keys are read generically and sorted, so
   this reports a category a future version adds without naming any version's set here."
  | conflicts keys s any |
  conflicts := [System transactionConflicts] on: Error do: [:e | nil].
  conflicts isNil ifTrue: [^'(conflict details unavailable)'].
  keys := (conflicts keys reject: [:k | k == #commitResult or: [k == #RcReadSet]]) asSortedCollection.
  s := WriteStream on: String new.
  any := false.
  keys do: [:k | | objs |
    objs := conflicts at: k ifAbsent: [nil].
    (objs notNil and: [objs isEmpty not]) ifTrue: [
      any ifTrue: [s nextPutAll: ', '].
      s nextPutAll: k asString , '(' , objs size printString , ')'.
      any := true]].
  ^any ifTrue: [s contents] ifFalse: ['(no conflict category reported)']
%
category: 'private'
classmethod: McpToolset
dictNamed: aName
  "Find a symbol dictionary by name in the current symbol list, or nil."
  System myUserProfile symbolList do: [:d | d name asString = aName ifTrue: [^d]].
  ^nil
%
category: 'private'
classmethod: McpToolset
linesFrom: aCollectionOfStrings
  "Sort the strings and join them one per line; '(none)' if empty."
  | s |
  aCollectionOfStrings isEmpty ifTrue: [^'(none)'].
  s := WriteStream on: String new.
  (aCollectionOfStrings asSortedCollection asArray) do: [:n |
    s nextPutAll: n asString; nextPut: Character lf].
  ^s contents
%
category: 'schema building'
classmethod: McpToolset
objectSchema: propsDict required: requiredArray
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
%
category: 'instance creation'
classmethod: McpToolset
on: aServer
  "A toolset for aServer, the McpServer whose registry it registers on (and whose server-level policy
   -- the kernel guards -- its handlers consult; see the class comment)."
  ^self new setServer: aServer
%
category: 'schema building'
classmethod: McpToolset
propString: aDescription
  | d |
  d := Dictionary new.
  d at: 'type' put: 'string'.
  d at: 'description' put: aDescription.
  ^d
%
category: 'transaction'
classmethod: McpToolset
refreshView
  "Take a current view of the work other sessions have committed while KEEPING this session's
   uncommitted changes (System continueTransaction). Answers nil when the view was refreshed, or
   the Error that stopped it -- it never raises, so a caller decides what a failure means.

   ATTEMPTING IT IS THE TEST. continueTransaction is illegal in two states, and an earlier version
   of this predicted them by reading `System transactionConflicts at: #commitResult`, which was
   wrong in a way worth recording: continueTransaction itself sets that to #readOnly, so a session
   was reported as jammed from its first successful refresh onward. Asking the image to do the
   thing and reporting what it said cannot drift from what is actually true, and needs no list of
   this version's result symbols. The two known failures, measured on 3.7.5 and 3.7.6:
     ImproperOperation 2717   inside a nested transaction
     TransactionError  2409   after a commit failed on conflict -- STICKY, and cleared only by an
                              abort, so it will keep answering here until one happens."
  ^[System continueTransaction. nil] on: Error do: [:ex | ex]
%
category: 'private'
classmethod: McpToolset
resolveClass: aName
  "Resolve a class by name in the current symbol list, or nil if the name is unbound or not a class."
  | obj |
  obj := System myUserProfile objectNamed: aName asSymbol.
  ^(obj isKindOf: Behavior) ifTrue: [obj] ifFalse: [nil]
%
! ------------------- Instance methods for McpToolset
category: 'guards'
method: McpToolset
assertMutableClass: aClass
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
%
category: 'guards'
method: McpToolset
assertRemovableDictionaryNamed: aName
  "Answer aName, or refuse (McpError kind:#refused) if it names a protected system dictionary. Same
   forward-and-fail-closed rule as assertMutableClass:, for removing a symbol dictionary."
  server isNil ifTrue: [
    ^McpError signalKind: #refused message:
      'Refused: cannot remove dictionary ' , aName asString , ' -- this toolset has no server to ask '
        , 'which dictionaries are protected. Build it with McpToolset class>>on:.'].
  ^server assertRemovableDictionaryNamed: aName
%
category: 'schema building'
method: McpToolset
boolProperty: aDescription
  ^self class boolProperty: aDescription
%
category: 'private'
method: McpToolset
capResult: aString
  ^self class capResult: aString
%
category: 'transaction'
method: McpToolset
commitConflictPending
  ^self class commitConflictPending
%
category: 'transaction'
method: McpToolset
commitConflictReport
  ^self class commitConflictReport
%
category: 'private'
method: McpToolset
dictNamed: aName
  ^self class dictNamed: aName
%
category: 'private'
method: McpToolset
linesFrom: aCollectionOfStrings
  ^self class linesFrom: aCollectionOfStrings
%
category: 'schema building'
method: McpToolset
objectSchema: propsDict required: requiredArray
  ^self class objectSchema: propsDict required: requiredArray
%
category: 'schema building'
method: McpToolset
propString: aDescription
  ^self class propString: aDescription
%
category: 'read-only'
method: McpToolset
readOnlySafeToolNames
  "Which of MY tools cannot persist a change, and so may run in a read-only session. FAIL-CLOSED:
   the default is none, so a tool this toolset does not list here is gated in read-only mode --
   including a future one its author forgot to classify."
  ^#()
%
category: 'transaction'
method: McpToolset
refreshView
  ^self class refreshView
%
category: 'registration'
method: McpToolset
registerOn: aToolRegistry
  "Register each of my tools on aToolRegistry (one name:description:inputSchema:do: send per tool).
   Subclasses implement this; it is the whole point of a toolset."
  ^self subclassResponsibility
%
category: 'private'
method: McpToolset
resolveClass: aName
  ^self class resolveClass: aName
%
category: 'accessing'
method: McpToolset
server
  "The McpServer this toolset registers on, and the home of the server-level policy a handler must
   respect -- the kernel guards. nil for a toolset built without one (see the class comment)."
  ^server
%
category: 'initialization'
method: McpToolset
setServer: aServer
  server := aServer.
  ^self
%
category: 'accessing'
method: McpToolset
toolNames
  "The names of the tools I register, for config diagnostics and for the contract test that pins the
   read-only allow-list. Subclasses implement this."
  ^self subclassResponsibility
%
