set compile_env: 0
! ------------------- Class definition for McpToolset
expectvalue /Class
doit
Object subclass: 'McpToolset'
  instVarNames: #( server options)
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

DEPLOYMENT OPTIONS. A toolset may also need configuration the core cannot know -- where a vendor''s
data directory is, which host a subsystem talks to. Declare the names you accept in
class>>declaredOptionNames and read them with optionNamed:ifAbsent:; an operator sets them on the
ROUTER (McpRouter>>toolsetOptions:), keyed by toolset name, and they are carried into the worker with
the rest of the session config. This completes what a toolset declares about itself -- its tools
(toolNames), which of them are safe read-only (readOnlySafeToolNames), and now how it may be
configured -- rather than growing the core a new ivar per vendor.

declaredOptionNames is an ALLOW-LIST, checked by the router when the option is set: an undeclared
name is refused at configuration time, naming what this toolset does declare. That is the same
choice objectSchema:required: makes for tool arguments (additionalProperties: false) and for the
same reason -- a mistyped setting that is silently ignored is far more expensive to find than one
that refuses to start. Values must be JSON-safe: they travel to the worker as JSON.

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
   #readOnly after a SUCCESSFUL System continueTransaction, which the `refresh` tool sends. An
   earlier version of this read 'not #success' and so reported a jammed session from the first
   successful refresh onward. Reading it does not clear it.

   #failure is also tested, and was added later: a continueTransaction that answers FALSE leaves
   #failure rather than #retryFailure (measured; see docs/blind-write-guardrail.md, W), and that
   session is just as stuck -- its view has moved and its pending writes still cannot commit -- so
   before this it was a must-abort state the server could not see."
  ^[ | r |
     r := System transactionConflicts at: #commitResult ifAbsent: [#success].
     r == #retryFailure or: [r == #failure]]
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
category: 'options'
classmethod: McpToolset
declaredOptionNames
  "The deployment-option names I accept, as Strings. Empty by default, so a toolset that needs no
   configuration says nothing and an operator who configures one anyway is told so.
   The router checks a configured name against this list when it is SET (McpRouter>>toolsetOptions:)
   and refuses an undeclared one -- see the class comment on why refusing beats ignoring."
  ^#()
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
   -- the kernel guards -- its handlers consult; see the class comment). No deployment options; see
   on:options:."
  ^self on: aServer options: nil
%
category: 'instance creation'
classmethod: McpToolset
on: aServer options: aDictOrNil
  "As on:, plus this deployment's options for me -- the entry the server builds a configured toolset
   through (McpServer>>initializeWithToolsetNames:toolsetOptions:). aDictOrNil is keyed by option
   name; nil and empty mean the same thing, which is what a toolset that declares none always gets."
  ^self new setServer: aServer; setOptions: aDictOrNil; yourself
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
refreshViewResult
  "Take a current view of the work other sessions have committed while KEEPING this session's
   uncommitted changes (System continueTransaction). Answers a two-element Array
   { validatedBoolean . errorOrNil } and never raises, so a caller decides what a failure means.

   THE BOOLEAN IS NOT DECORATION. It is what continueTransaction answered, and it is the whole
   evidence the blind-write guardrail has at a refresh: true means the stone validated this
   session's write set and found no conflict, which is the same proof a successful commit gives and
   licenses the same ledger transition; false means the view moved ANYWAY while the pending writes
   stay doomed, which is the one state where nothing survives. An earlier version of this discarded
   the Boolean and answered nil-or-Error, which could not tell those apart.

   ATTEMPTING IT IS THE TEST. continueTransaction is illegal in two states, and an earlier version
   of this predicted them by reading `System transactionConflicts at: #commitResult`, which was
   wrong in a way worth recording: continueTransaction itself sets that to #readOnly, so a session
   was reported as jammed from its first successful refresh onward. Asking the image to do the
   thing and reporting what it said cannot drift from what is actually true, and needs no list of
   this version's result symbols. The two known failures, measured on 3.7.5 and 3.7.6:
     ImproperOperation 2717   inside a nested transaction
     TransactionError  2409   after a commit failed on conflict -- STICKY, and cleared only by an
                              abort, so it will keep answering here until one happens."
  ^[Array with: System continueTransaction with: nil]
    on: Error do: [:ex | Array with: false with: ex]
%
category: 'private'
classmethod: McpToolset
resolveClass: aName
  "Resolve a class by name in the current symbol list, or nil if the name is unbound or not a class."
  | obj |
  obj := System myUserProfile objectNamed: aName asSymbol.
  ^(obj isKindOf: Behavior) ifTrue: [obj] ifFalse: [nil]
%
category: 'schema building'
classmethod: McpToolset
stringArrayProperty: aDescription
  | d items |
  items := Dictionary new.
  items at: 'type' put: 'string'.
  d := Dictionary new.
  d at: 'type' put: 'array'.
  d at: 'items' put: items.
  d at: 'description' put: aDescription.
  ^d
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
category: 'blind-write guardrail'
method: McpToolset
commentKeyFor: aClassName
  ^McpServer commentKeyFor: aClassName
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
category: 'blind-write guardrail'
method: McpToolset
conflictingSubjects
  "The class scopes named in this session's last conflict report -- see
   McpServer>>conflictingSubjects. Empty without a server, which only costs a less specific message."
  server isNil ifTrue: [^Array new].
  ^server conflictingSubjects
%
category: 'blind-write guardrail'
method: McpToolset
dictionaryKeyFor: aDictionaryName
  ^McpServer dictionaryKeyFor: aDictionaryName
%
category: 'private'
method: McpToolset
dictNamed: aName
  ^self class dictNamed: aName
%
category: 'blind-write guardrail'
method: McpToolset
hasReadKey: aKey
  "Whether aKey is in this session's read ledger. FAIL-CLOSED without a server: an unanswerable
   question is answered 'no', so the caller refuses rather than proceeds."
  server isNil ifTrue: [^false].
  ^server hasRead: aKey
%
category: 'private'
method: McpToolset
linesFrom: aCollectionOfStrings
  ^self class linesFrom: aCollectionOfStrings
%
category: 'blind-write guardrail'
method: McpToolset
listPhraseFor: aCollectionOfStrings
  "'Foo', 'Foo and Bar', 'Foo, Bar and Baz' -- for a message a person or a model reads."
  | items |
  items := aCollectionOfStrings asArray.
  items isEmpty ifTrue: [^''].
  items size = 1 ifTrue: [^(items at: 1) asString].
  ^((items copyFrom: 1 to: items size - 1) inject: '' into: [:acc :m |
      acc isEmpty ifTrue: [m asString] ifFalse: [acc , ', ' , m asString]])
    , ' and ' , (items at: items size) asString
%
category: 'blind-write guardrail'
method: McpToolset
methodKeyFor: aClassName selector: aSelector meta: aBoolean
  ^McpServer methodKeyFor: aClassName selector: aSelector meta: aBoolean
%
category: 'blind-write guardrail'
method: McpToolset
noteAborted
  server ifNotNil: [:s | s noteAborted].
  ^self
%
category: 'blind-write guardrail'
method: McpToolset
noteCommitFailed
  server ifNotNil: [:s | s noteCommitFailed].
  ^self
%
category: 'blind-write guardrail'
method: McpToolset
noteCommitted
  server ifNotNil: [:s | s noteCommitted].
  ^self
%
category: 'blind-write guardrail'
method: McpToolset
noteRead: aKey
  "Record that this session has seen aKey. A no-op without a server: there is no ledger to write to,
   and a toolset with no server has no guardrail either way -- what must NOT fail open is the check,
   which is requireRead:subject:tool:hint:."
  server ifNotNil: [:s | s noteRead: aKey].
  ^aKey
%
category: 'blind-write guardrail'
method: McpToolset
noteReads: aCollectionOfKeys
  server ifNotNil: [:s | s noteReads: aCollectionOfKeys].
  ^aCollectionOfKeys
%
category: 'blind-write guardrail'
method: McpToolset
noteReadsForWholeClass: aClass
  "Record that every part of aClass has been seen: its shape, its comment, and the source of every
   method on BOTH sides. What export_class_source earns, and the only read that licenses an
   operation which destroys methods the client never named (a raw redefinition, delete_class)."
  | keys name |
  name := aClass name.
  keys := OrderedCollection new.
  keys add: (self shapeKeyFor: name); add: (self commentKeyFor: name).
  aClass selectors do: [:sel | keys add: (self methodKeyFor: name selector: sel meta: false)].
  aClass class selectors do: [:sel | keys add: (self methodKeyFor: name selector: sel meta: true)].
  ^self noteReads: keys
%
category: 'blind-write guardrail'
method: McpToolset
noteRefreshed: aBoolean
  server ifNotNil: [:s | s noteRefreshed: aBoolean].
  ^self
%
category: 'blind-write guardrail'
method: McpToolset
noteWrite: aKey
  "Record that this session has changed aKey. Send this on the branch that actually wrote, never on
   entry to the tool -- see McpServer>>noteWrite:."
  server ifNotNil: [:s | s noteWrite: aKey].
  ^aKey
%
category: 'schema building'
method: McpToolset
objectSchema: propsDict required: requiredArray
  ^self class objectSchema: propsDict required: requiredArray
%
category: 'options'
method: McpToolset
optionNamed: aName ifAbsent: aBlock
  "This deployment's value for option aName, or aBlock's value when it was not configured.
   ifAbsent: is mandatory rather than there being a bare optionNamed:, because every option is
   optional by construction -- an operator need not set one -- so a handler that reads one has to say
   what it does without it, at the point it reads it."
  options isNil ifTrue: [^aBlock value].
  ^options at: aName asString ifAbsent: aBlock
%
category: 'options'
method: McpToolset
options
  "This deployment's options for me, keyed by option name. Never nil -- an unconfigured toolset
   answers an empty Dictionary -- so a caller may enumerate without a guard. Read-only in practice:
   the answer when nothing was configured is a fresh empty Dictionary, so mutating it changes
   nothing."
  ^options ifNil: [Dictionary new]
%
category: 'progress'
method: McpToolset
progress: aNumber message: aStringOrNil
  "Report progress with no denominator -- for work whose total is genuinely unknown. Better than a
   made-up total, which the client renders as a fraction."
  ^self progress: aNumber of: nil message: aStringOrNil
%
category: 'progress'
method: McpToolset
progress: aNumber of: aTotalOrNil message: aStringOrNil
  "Tell the client how far along this call is: aNumber of aTotalOrNil, with a short human line.
   The ONE place a tool reaches the reporter, and the one place the absence of one is handled -- so a
   tool needs no conditional, and a tool run from topaz, or by a client that asked for no progress,
   behaves exactly as it always did. Answers whether a tick actually went out, which nothing has any
   reason to check: progress is best-effort by design.
   Costs one SessionTemps lookup when nobody is listening, which is why a tool may call it inside a
   loop without thinking about it. aNumber must increase strictly -- refused otherwise, here and
   again at the front end -- and ticks are rate-limited at the source; see McpProgressReporter."
  | reporter |
  reporter := SessionTemps current at: #McpProgress otherwise: nil.
  reporter isNil ifTrue: [^false].
  ^reporter progress: aNumber of: aTotalOrNil message: aStringOrNil
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
refreshViewResult
  ^self class refreshViewResult
%
category: 'registration'
method: McpToolset
registerOn: aToolRegistry
  "Register each of my tools on aToolRegistry (one name:description:inputSchema:do: send per tool).
   Subclasses implement this; it is the whole point of a toolset."
  ^self subclassResponsibility
%
category: 'blind-write guardrail'
method: McpToolset
requireRead: aKey subject: aSubjectString tool: aToolName hint: aHintString
  "Refuse a blind write -- a change to something this session has not read since its view last moved.
   FAIL-CLOSED when there is no server, for the same reason assertMutableClass: is: a toolset that
   cannot consult the ledger refuses to mutate rather than assuming it may."
  server isNil ifTrue: [
    ^McpError signalKind: #blindWrite message:
      aToolName , ' refused: this toolset has no server, so it cannot tell whether ' , aSubjectString
        , ' has been read in this view window. Build it with McpToolset class>>on:.'].
  ^server requireRead: aKey subject: aSubjectString tool: aToolName hint: aHintString
%
category: 'blind-write guardrail'
method: McpToolset
requireWholeClassRead: aClass tool: aToolName because: aReasonString
  "Refuse unless this session has seen ALL of aClass -- shape plus every current method on both
   sides. For the operations that discard methods the client never named, where seeing the class
   definition is not nearly enough.
   Reports the missing methods TOGETHER rather than one per call, because the answer to any of them
   is the same single call, and a client told about one missing method at a time would need as many
   round trips as the class has methods."
  | name missing |
  name := aClass name.
  missing := OrderedCollection new.
  (self hasReadKey: (self shapeKeyFor: name)) ifFalse: [missing add: name asString , ' (definition)'].
  aClass selectors do: [:sel |
    (self hasReadKey: (self methodKeyFor: name selector: sel meta: false))
      ifFalse: [missing add: name asString , '>>' , sel asString]].
  aClass class selectors do: [:sel |
    (self hasReadKey: (self methodKeyFor: name selector: sel meta: true))
      ifFalse: [missing add: name asString , ' class>>' , sel asString]].
  missing isEmpty ifTrue: [^self].
  ^McpError signalKind: #blindWrite message:
    aToolName , ' refused: ' , aReasonString , ' This session has not read '
      , missing size printString , ' of them since its view last moved ('
      , ((missing copyFrom: 1 to: (missing size min: 5)) inject: '' into: [:acc :m |
          acc isEmpty ifTrue: [m] ifFalse: [acc , ', ' , m]])
      , (missing size > 5 ifTrue: [', and ' , (missing size - 5) printString , ' more'] ifFalse: [''])
      , '). Call export_class_source(' , name asString , ') to see the whole class first.'
%
category: 'private'
method: McpToolset
resolveClass: aName
  ^self class resolveClass: aName
%
category: 'blind-write guardrail'
method: McpToolset
selectorOfSource: aSourceString for: aBehavior
  "The selector aSourceString would compile to on aBehavior, WITHOUT compiling it onto aBehavior.
   Answers nil if the source will not compile at all.

   compile_method takes source, not a selector, so the guardrail has to work out which method is
   about to be replaced before it can decide whether it may be -- and it must do that without any
   side effect, because a refused call has to leave the image untouched.

   This asks the kernel's own compiler rather than parsing a message pattern here: the
   intoMethodDict: variant installs its result in the dictionary it is GIVEN instead of the class's,
   so a throwaway dictionary yields the real GsNMethod, and its selector is authoritative for unary,
   binary and keyword patterns alike. Measured: the class's selectors are unchanged afterwards and
   System needsCommit stays false. The category argument must be a Symbol for this variant."
  ^[(aBehavior
      compileMethod: aSourceString
      dictionaries: System myUserProfile symbolList
      category: #mcpSelectorProbe
      intoMethodDict: GsMethodDictionary new
      intoCategories: nil
      environmentId: 0) selector] on: Error do: [:ex | nil]
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
setOptions: aDictOrNil
  "Install this deployment's options for me. Kept as given (nil included -- see #options), so nothing
   here has to decide what an unconfigured toolset's options 'are'."
  options := aDictOrNil.
  ^self
%
category: 'initialization'
method: McpToolset
setServer: aServer
  server := aServer.
  ^self
%
category: 'blind-write guardrail'
method: McpToolset
shapeKeyFor: aClassName
  ^McpServer shapeKeyFor: aClassName
%
category: 'schema building'
method: McpToolset
stringArrayProperty: aDescription
  ^self class stringArrayProperty: aDescription
%
category: 'accessing'
method: McpToolset
toolNames
  "The names of the tools I register, for config diagnostics and for the contract test that pins the
   read-only allow-list. Subclasses implement this."
  ^self subclassResponsibility
%
