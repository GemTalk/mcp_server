set compile_env: 0
! ------------------- Class definition for McpServer
expectvalue /Class
doit
McpBase subclass: 'McpServer'
  instVarNames: #( dispatcher toolRegistry toolsets
                    serverName serverTitle serverVersion lifetimeBounds
                    readLedger writeLedger staleReadKeys)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpServer comment: 
'Per-client MCP worker: the single-client GemStone MCP server. Owns a tool registry and a
JSON-RPC dispatcher; parses a JSON-RPC request and answers the JSON response string via
handleJsonString:. The tools themselves -- schemas AND handlers -- belong to the toolsets it
registers (McpToolset), not to this class; what stays here is what a server decides for every tool:
read-only gating, the kernel guards, and the advertised identity.

One instance runs in each per-client worker gem -- built lazily and cached in SessionTemps by the
class-side handleJsonString:, and driven by the front end McpRouter over a GsTsExternalSession.
This class has NO socket and knows nothing about HTTP or sessions: the transport and the per-client
session routing live in McpRouter.

Which tools a server offers is NOT fixed by its class: each server registers a list of McpToolset
instances (see McpToolset), so a deployment -- or a vendor shipping only their own tools -- chooses the
surface. The front end resolves both the worker class and the toolset list per session and pushes them
into the worker gem in one call (prepareWorkerWithToolsets:options:readOnly:serverName:title:version:),
so a worker
never decides what it is. Subclass this to change BEHAVIOR (the kernel guards, the worker entry,
dispatcher wiring, the advertised identity); write a toolset to add tools. A subclass is used only when
it is NAMED in the router''s workerClassName config.

To start the server, see McpRouter (runOnPort: / forkOnPort:).'
%
expectvalue /Class
doit
McpServer category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpServer
removeallmethods McpServer
removeallclassmethods McpServer
! ------------------- Class methods for McpServer
category: 'guardrail stamps'
classmethod: McpServer
absentStamp
  "The stamp recorded for a subject that does not exist in the current view -- a method the class
   does not implement, a class or dictionary that does not resolve, a class with no comment. Distinct
   from every content stamp (those are hex digests), so 'absent, then present' and 'present, then
   absent' both read as a change in revalidateReadLedger."
  ^'absent'
%
category: 'guardrail keys'
classmethod: McpServer
commentKeyFor: aClassName
  "The readLedger key standing for 'I have seen this class's COMMENT'. Separate from the shape key
   because the two are read by different tools: get_class_definition answers the subclass: message
   and shows no comment, so it must not license set_class_comment."
  ^aClassName asString , ':comment'
%
category: 'read-only'
classmethod: McpServer
coreReadOnlySafeToolNames
  "The AUDIT list: every CORE tool that cannot persist a change, and so may run in a read-only
   session. This is no longer what the gate consults -- each toolset declares its own safe names and
   the server answers their union (see the instance-side readOnlySafeToolNames) -- because a
   third-party toolset must be able to declare its own. It is kept as the one place a reviewer can
   read the whole core answer at once, and McpContractTest pins the union of the seven core toolsets
   against it, so a tool cannot silently become 'safe'.
   FAIL-CLOSED throughout: a toolset lists nothing by default. Note run_test_* / list_failing_tests
   ARE safe: read-only forbids execute_code and the mutation tools, so no NEW code can be introduced
   this session, and a test can only run already-committed (trusted) code."
  ^#( 'describe_class' 'export_class_source' 'get_class_definition' 'get_class_hierarchy'
      'get_method_source' 'list_methods'
      'list_all_classes' 'list_classes' 'list_dictionaries' 'list_dictionary_entries'
      'find_implementors' 'find_references_to' 'find_senders' 'search_method_source'
      'status' 'refresh' 'abort'
      'list_test_classes' 'list_failing_tests' 'describe_test_failure'
      'run_test_class' 'run_test_method' )
%
category: 'identity'
classmethod: McpServer
defaultServerInstructions
  "The `instructions` a stock GemStone MCP server sends in its initialize result, and the hook A
   PRODUCT OVERRIDES to describe its own surface. MCP calls this a hint to the model rather than
   documentation for a person, so it says the things a model cannot work out by reading tool
   descriptions one at a time: what a session IS here, and which of its properties outlive a call.

   It is deliberately about the transaction and nothing else. A per-tool fact belongs in that
   tool's description, where it is read at the moment it matters; what does not fit there is the
   part that spans calls, because no single tool's description is the right place to explain that a
   change made by one call is still there for the next -- and the terse '[session]' line the server
   appends to results (McpDispatcher>>transactionNote) is unintelligible without it.

   Kept short on purpose: it is prepended to the model's context for the whole conversation, so
   every sentence competes with the client's own prompt for attention."
  | lf |
  lf := String with: Character lf.
  ^'This server is one GemStone session, in one long-running database transaction, for as long as '
    , 'the connection lasts.' , lf , lf
    , 'YOUR VIEW IS A SNAPSHOT. You see the repository as it was at one instant, and it does not '
    , 'change under you while you work. It moves only when YOU move it: `commit`, `abort` and '
    , '`refresh` each take a current view, and nothing else does. So anything you read before your '
    , 'last one of those may since have been changed by somebody else.' , lf , lf
    , 'THE DATABASE PROTECTS YOU FROM ACTING ON A STALE SNAPSHOT. If you change something that '
    , 'another session has committed a change to since your view was taken, your `commit` FAILS and '
    , 'writes nothing -- it will not silently overwrite their work. This is why the snapshot is '
    , 'worth having, and it is also why a `refresh` in the middle of a plan is not free: refreshing '
    , 'adopts their version as your starting point, so a change you then make on the strength of '
    , 'what you read EARLIER will commit cleanly and erase what they did. If you read something, '
    , 'thought about it, and are only now acting, re-read it first.' , lf , lf
    , 'WHAT SURVIVES A CALL. Every change you make stays in your session until you commit or abort '
    , 'it -- so you can compile a method, run its tests against what you just compiled, and only '
    , 'then decide to keep it. Nobody else can see any of it until you commit.' , lf , lf
    , 'NOTHING COMMITS FOR YOU. Only the `commit` tool commits. The tools that change the image '
    , '(compile_method, compile_class_definition, delete_class, delete_method, set_class_comment, '
    , 'add_dictionary, remove_dictionary) leave their work uncommitted. `abort` discards everything '
    , 'uncommitted; `refresh` takes a current view and keeps your uncommitted changes.' , lf , lf
    , 'THE [session] LINE. A result may end with one line starting "[session]". It describes your '
    , 'session, not the tool you just called, and it appears only when there is something to do:'
    , lf
    , '  - uncommitted changes pending -> commit them or abort them. The line names what would end '
    , 'this session first and how long that is; if it ends, they are lost. Commit anything you want '
    , 'to keep rather than leaving it staged.' , lf
    , '  - your last commit FAILED -> another session changed the same objects since your view was '
    , 'taken. Nothing was written and your changes are still here, but no commit can succeed and '
    , 'your view cannot move until you call `abort`, which discards them. Save anything you need, '
    , 'abort, re-read the current state, and redo the change against it.' , lf , lf
    , 'A failed commit is the one failure here you cannot retry your way out of, and the conflict is '
    , 'reported per CLASS rather than per method -- two sessions compiling different methods on one '
    , 'class still collide. If the work matters, save the source before aborting.'
%
category: 'identity'
classmethod: McpServer
defaultServerName
  "The name a stock GemStone MCP server reports in the initialize result's serverInfo, and THE HOOK A
   SUBCLASS SHOULD OVERRIDE to name itself (see McpFixtureServer). serverInfo.name says WHICH SOFTWARE
   this is, so it is the product's to set, not the operator's: an operator running two instances of one
   product wants defaultServerTitle / router config serverTitle: instead, which labels the INSTANCE and
   leaves every instance reporting the same truthful name. Router config can still relabel the name --
   that path is for a server assembled from toolsets with no McpServer subclass to override, i.e. a
   different product. The single home for this literal -- the instance-side serverName answers it
   unless a deployment set one, and McpDispatcher falls back to it when it has no server at all."
  ^'gemstone-mcp'
%
category: 'identity'
classmethod: McpServer
defaultServerTitle
  "The display title a stock GemStone MCP server reports -- deliberately nil, and the hook A PRODUCT
   OVERRIDES to give itself a human-readable display name. serverInfo.title says WHICH INSTANCE this
   is (MCP BaseMetadata: name is programmatic, title is for UI), so it is normally the operator's to
   set through router config serverTitle:.
   nil means 'no instance label': McpDispatcher OMITS the title key entirely rather than sending null,
   and a client falls back to displaying the name, exactly as before titles existed. A title being
   present therefore means a human deliberately labeled that instance."
  ^nil
%
category: 'identity'
classmethod: McpServer
defaultServerVersion
  "See defaultServerName."
  ^'0.7.0'
%
category: 'toolsets'
classmethod: McpServer
defaultToolsetNames
  "The core tool surface: the seven toolsets a plain McpServer registers, in registration order.
   A deployment that wants a different surface names its own (see McpToolset)."
  ^#( 'McpBrowsingToolset' 'McpExecutionToolset' 'McpListingToolset' 'McpMutationToolset'
      'McpSearchToolset' 'McpSessionToolset' 'McpTestingToolset' )
%
category: 'guardrail keys'
classmethod: McpServer
dictionaryKeyFor: aDictionaryName
  ^'#' , aDictionaryName asString
%
category: 'worker'
classmethod: McpServer
handleJsonString: aRawJsonString
  "Worker-gem entry the front end drives (via McpSession>>forward:, over GCI).
   Answers the JSON response string ('' for a notification).
   Normally the instance is already built and cached by prepareWorkerWithToolsets:... at session open;
   the lazy build here covers a direct in-image send (topaz, a test) and instantiates THIS class -- the
   class the sender named. It no longer looks for the Grail subclass: which server class and which
   toolsets a worker uses is the front end's decision, pushed down per session, and Grail is a toolset
   now rather than a rung in the hierarchy. A direct `McpServer handleJsonString:` therefore gets the
   base tool surface; ask for a different one by name, or via McpServer installedDefaultToolsetNames.

   Answers as if nothing bounds this session's lifetime -- see the lifetimeBounds: variant, which
   the front end uses. Routing through it rather than duplicating the lookup is what CLEARS bounds
   left by an earlier request, so a stale one is never reported after the deadline that set it."
  ^self handleJsonString: aRawJsonString lifetimeBounds: nil
%
category: 'worker'
classmethod: McpServer
handleJsonString: aRawJsonString lifetimeBounds: anArrayOrNil
  "As handleJsonString:, plus what the FRONT END says bounds this session
   (McpRouter>>lifetimeBoundsFor:). The worker cannot work this out: reaping policy is the router's
   configuration, and a worker holding its own copy would go stale the moment a credential was
   refreshed. It is passed per request for the same reason, and used only when there is uncommitted
   work to warn about (McpDispatcher>>transactionNote)."
  | srv |
  srv := SessionTemps current at: #McpServer otherwise: nil.
  srv isNil ifTrue: [
    srv := self new.
    SessionTemps current at: #McpServer put: srv].
  ^srv handleJsonString: aRawJsonString lifetimeBounds: anArrayOrNil
%
category: 'toolsets'
classmethod: McpServer
installedDefaultToolsetNames
  "The default surface for a deployment that names none: the core toolsets, plus the optional Grail
   (Python) toolset when its file has been loaded into this image. Resolved in THIS gem's symbol
   list, and by the FRONT END once per session -- a worker never chooses its own tool surface (see
   McpRouter>>effectiveToolsetNames)."
  | names |
  names := self defaultToolsetNames.
  ^(System myUserProfile objectNamed: #McpGrailToolset) isNil
    ifTrue: [names]
    ifFalse: [names , (Array with: 'McpGrailToolset')]
%
category: 'guardrail keys'
classmethod: McpServer
methodKeyFor: aClassName selector: aSelector meta: aBoolean
  "The readLedger key for one method. The class-side form embeds ' class' before the '>>', so the key
   also names the SIDE -- which scopeOfMethodKey: reads back for conflictingSubjects, because
   instance and class side have separate method dictionaries and so conflict separately in the
   stone."
  ^aClassName asString , (aBoolean == true ifTrue: [' class>>'] ifFalse: ['>>']) , aSelector asString
%
category: 'instance creation'
classmethod: McpServer
new
  "A server with the core tool surface (defaultToolsetNames). Kept as the plain constructor because
   it is what the tests and any in-image user expect; a deployment choosing its own surface uses
   newWithToolsetNames:."
  ^super new initialize
%
category: 'instance creation'
classmethod: McpServer
newWithToolsetNames: anArrayOfNames
  "A server exposing ONLY the named toolsets -- how a vendor ships a server with their tools and none
   of the Smalltalk-development surface. Raises if a name does not resolve (toolsetClassNamed:)."
  ^super new initializeWithToolsetNames: anArrayOfNames
%
category: 'instance creation'
classmethod: McpServer
newWithToolsetNames: anArrayOfNames toolsetOptions: aDictOrNil
  "As newWithToolsetNames:, with this deployment's options for those toolsets (keyed by toolset name;
   see McpToolset's class comment). What the front end builds a worker through."
  ^super new initializeWithToolsetNames: anArrayOfNames toolsetOptions: aDictOrNil
%
category: 'worker'
classmethod: McpServer
prepareWorkerWithToolsets: anArrayOfNames options: anOptionsJsonOrNil readOnly: aBoolean serverName: aNameOrNil title: aTitleOrNil version: aVersionOrNil frontEnd: aFrontEndSessionOrNil
  "Prepare THIS worker gem for one client, in the single call the front end makes at session open
   (McpSession>>prepareWorker). Sent to the class the front end NAMED, so `self` is the server class to
   build -- a worker never chooses.
   Order matters: the read-only flag is set FIRST, so the build can leave gated tools out of the
   registry entirely (McpServer>>registerToolsets). Then the instance is built with the given toolsets
   and identity and cached where handleJsonString: looks for it, which moves tool registration off the
   client's first request and makes an unresolvable toolset fail here, at session open, rather than
   mid-conversation. Answers a short line for the log.
   aFrontEndSessionOrNil is the value System session answers IN THE ROUTER'S GEM -- where to ring the
   doorbell when a tool reports progress. It is constant for this worker's whole life, so it is pushed
   once here rather than repeated on every request; only the per-call id travels with the request
   (class>>progressCallId:). nil means no front end is listening, which is what a worker driven
   directly from topaz or a test gets.

   anOptionsJsonOrNil is the deployment's toolset options (McpToolset's class comment) as a JSON
   STRING, parsed here. JSON rather than a Smalltalk literal because the options are a nested,
   open-ended map whose shape the core does not know, and because both ends already have
   McpBase>>parseBody: -- so nothing new has to be written, and a value that cannot be represented
   as JSON cannot travel, which is exactly the constraint the fork string needs anyway. nil means no
   toolset was configured, which is the ordinary case."
  | srv |
  self sessionReadOnly: aBoolean.
  SessionTemps current at: #McpFrontEndSession put: aFrontEndSessionOrNil.
  srv := self newWithToolsetNames: anArrayOfNames
    toolsetOptions: (anOptionsJsonOrNil isNil ifTrue: [nil] ifFalse: [self parseBody: anOptionsJsonOrNil]).
  srv serverName: aNameOrNil; serverTitle: aTitleOrNil; serverVersion: aVersionOrNil.
  SessionTemps current at: #McpServer put: srv.
  ^self name asString , ' ready: ' , srv toolRegistry descriptors size printString , ' tool(s)'
    , (aBoolean ifTrue: [' (read-only)'] ifFalse: [''])
%
category: 'progress'
classmethod: McpServer
progressCallId: aCallIdOrNil
  "Install a progress reporter for the call about to run, or clear any left over when there is none.
   Sent by the front end as the FIRST statement of the expression that runs a request
   (McpSession>>workerExpressionFor:lifetimeBounds:progressCallId:), so it is set up before the tool
   it serves and torn down by the handleJsonString: that follows it.
   Two statements rather than another keyword on handleJsonString: deliberately -- bounds and progress
   are independent, and folding both in would mean four entry points to keep in step for no gain.
   The front-end session came down at session open and is read from SessionTemps rather than passed
   again, because it cannot change while this gem lives. With none there is nobody to signal, so no
   reporter is made and every tick a tool sends becomes a no-op."
  | st |
  st := SessionTemps current.
  (aCallIdOrNil isNil or: [(st at: #McpFrontEndSession otherwise: nil) isNil])
    ifTrue: [^st removeKey: #McpProgress otherwise: nil].
  ^st at: #McpProgress put: (McpProgressReporter
    frontEndSession: (st at: #McpFrontEndSession otherwise: nil)
    callId: aCallIdOrNil)
%
category: 'guardrail keys'
classmethod: McpServer
scopeOfMethodKey: aKey
  "The 'Class' or 'Class class' part of a method key, or nil if aKey is not a method key. One method
   dictionary per scope, so this is exactly the grain the stone validates at."
  | idx |
  idx := aKey indexOfSubCollection: '>>'.
  ^idx = 0 ifTrue: [nil] ifFalse: [aKey copyFrom: 1 to: idx - 1]
%
category: 'read-only'
classmethod: McpServer
sessionReadOnly: aBoolean
  "Mark (or clear) read-only for the CURRENT worker session. The opening router sets this in the
   worker gem when the session should be read-only -- a router configured read-only (a localhost
   convenience so a single user cannot accidentally mutate), or an McpAuthRouter session whose bearer
   token lacked the write scope. Stored in SessionTemps, so it lives and dies with the worker gem,
   needs no commit, and is private to that gem -- which is why two routers (one read-only, one not)
   can run at once with no shared state."
  SessionTemps current at: #McpReadOnly put: aBoolean
%
category: 'guardrail keys'
classmethod: McpServer
shapeKeyFor: aClassName
  "The readLedger key standing for 'I have seen this class's DEFINITION' -- its superclass and
   variable names. See commentKeyFor: for why the comment is a separate key."
  ^aClassName asString , ':shape'
%
category: 'guardrail keys'
classmethod: McpServer
staleReadSummaryFor: aCollectionOfKeys
  "The stale keys summarised BY CLASS, for the one-time [session] line (McpDispatcher>>staleReadNote)
   -- a shape a model can act on at a glance rather than a list it has to scan.

   Keys are grouped by the class they belong to: method keys of both sides under the class, the shape
   and comment keys as that class's definition and comment, a dictionary key as a group of its own
   named after the dictionary. Per group, up to three method keys are named in full
   ('Foo>>bar:, Foo class>>baz:'), more are counted ('5 methods from Foo'), and the definition and
   comment are mentioned alongside as 'Foo (definition)' and 'Foo (comment)'. More than four groups,
   and the whole list gives way to a count -- 'changes to 7 classes; re-check what you depend on
   before writing' -- because at that point the honest advice is to re-check everything one depends
   on, not to tick off names. Groups are sorted by name, so the same keys always render the same way."
  | groups names parts |
  groups := Dictionary new.
  aCollectionOfKeys do: [:k | | key name group |
    key := k asString.
    name := nil.
    (key size > 0 and: [(key at: 1) = $#])
      ifTrue: [name := key copyFrom: 2 to: key size]
      ifFalse: [
        (self scopeOfMethodKey: key) ifNotNil: [:scope |
          name := (scope size > 6 and: [(scope copyFrom: scope size - 5 to: scope size) = ' class'])
            ifTrue: [scope copyFrom: 1 to: scope size - 6]
            ifFalse: [scope]].
        (key endsWith: ':shape') ifTrue: [name := key copyFrom: 1 to: key size - ':shape' size].
        (key endsWith: ':comment') ifTrue: [name := key copyFrom: 1 to: key size - ':comment' size]].
    name isNil ifTrue: [name := key].
    group := groups at: name ifAbsent: [
      groups at: name put: (Dictionary new
        at: #methods put: OrderedCollection new;
        at: #definition put: false; at: #comment put: false; at: #dictionary put: false;
        yourself)].
    (key size > 0 and: [(key at: 1) = $#]) ifTrue: [group at: #dictionary put: true] ifFalse: [
      (key endsWith: ':shape') ifTrue: [group at: #definition put: true] ifFalse: [
        (key endsWith: ':comment') ifTrue: [group at: #comment put: true] ifFalse: [
          (group at: #methods) add: key]]]].
  names := groups keys asSortedCollection asArray.
  names size > 4 ifTrue: [
    ^'changes to ' , names size printString , ' classes; re-check what you depend on before writing'].
  parts := OrderedCollection new.
  names do: [:name | | group methods |
    group := groups at: name.
    methods := (group at: #methods) asSortedCollection asArray.
    methods size > 3
      ifTrue: [parts add: methods size printString , ' methods from ' , name]
      ifFalse: [methods do: [:m | parts add: m]].
    (group at: #definition) ifTrue: [parts add: name , ' (definition)'].
    (group at: #comment) ifTrue: [parts add: name , ' (comment)'].
    (group at: #dictionary) ifTrue: [parts add: name , ' (dictionary)']].
  ^parts inject: '' into: [:acc :part | acc isEmpty ifTrue: [part] ifFalse: [acc , ', ' , part]]
%
category: 'guardrail stamps'
classmethod: McpServer
stampOfContent: aStringOrNil
  "The content stamp of one subject's canonical text: its SHA-256 digest as a hex String, or
   absentStamp for nil. The stamp is what the read ledger stores against a key (McpServer>>stampFor:)
   and what a view move compares against (revalidateReadLedger), so it has to mean 'the same text'
   and nothing weaker -- String>>hash is a small integer and would let a change hide behind a
   collision. The kernel supplies the digest (CharacterCollection>>asSha256String, present at least
   since 3.7.2 -- String inherits it, so looking for implementors on String alone finds none), so
   nothing here is home-made, and the method source of an ordinary class hashes in microseconds."
  aStringOrNil isNil ifTrue: [^self absentStamp].
  ^aStringOrNil asString asSha256String
%
category: 'toolsets'
classmethod: McpServer
toolsetClassNamed: aName
  "The McpToolset subclass named aName, resolved in THIS gem's symbol list. Raises naming both the
   toolset and where it has to live if it is missing or is not a toolset: a worker gem may log in as
   a different user than the front end (McpAuthRouter), so a toolset belongs in a dictionary in the
   WORKER's symbol list -- Published, not the operator's UserGlobals."
  | cls |
  cls := System myUserProfile objectNamed: aName asSymbol.
  (cls isKindOf: Behavior) ifFalse: [
    ^self error: 'Toolset not found: ' , aName asString
      , '. It must be installed in a symbol dictionary in this gem''s symbol list (e.g. Published).'].
  (cls inheritsFrom: McpToolset) ifFalse: [
    ^self error: 'Not a toolset: ' , aName asString , ' is not a subclass of McpToolset.'].
  ^cls
%
! ------------------- Instance methods for McpServer
category: 'read-only'
method: McpServer
allToolNames
  "Every tool my toolsets provide, whether or not it is currently REGISTERED -- a read-only build
   prunes the unsafe ones from the registry (registerToolsets). Lets the dispatcher tell a gated tool
   ('exists, but this session is read-only') from a nonexistent one, which the client needs: they are
   different errors and only one of them is worth reporting to a user as a permission problem."
  | names |
  names := OrderedCollection new.
  toolsets do: [:ts | names addAll: ts toolNames].
  ^names asArray
%
category: 'guards'
method: McpServer
assertMutableClass: aClass
  "Refuse (signal McpError kind:#refused, naming the class, reason, and remedy) if aClass is a
   protected/kernel class. Called by every mutation tool before it changes anything. NB: this
   guards the structured mutation tools only -- execute_code is the deliberate escape hatch (and is
   itself gated in read-only mode)."
  | where |
  (self isProtectedClass: aClass) ifFalse: [^aClass].
  where := self protectedDictionaryNames
    detect: [:dictName | (self dictNamed: dictName)
      ifNil: [false]
      ifNotNil: [:d | (d at: aClass name asSymbol ifAbsent: [nil]) == aClass]]
    ifNone: ['no user dictionary'].
  ^McpError signalKind: #refused message:
    'Refused: ' , aClass name asString , ' is a protected class (home dictionary ' , where
      , '); MCP mutation tools do not modify kernel/system classes. Remedy: target one of your own '
      , 'classes in a user dictionary (e.g. UserGlobals), or use execute_code if you truly intend a '
      , 'system change.'
%
category: 'guards'
method: McpServer
assertRemovableDictionaryNamed: aName
  "Refuse (signal McpError kind:#refused) if aName is a protected system dictionary."
  (self protectedDictionaryNames includes: aName asString) ifTrue: [
    ^McpError signalKind: #refused message:
      'Refused: ' , aName asString , ' is a protected system dictionary and cannot be removed.'].
  ^aName
%
category: 'blind-write guardrail'
method: McpServer
behaviorForScope: aScopeString
  "The Behavior a method key's scope names: 'Foo' answers Foo, 'Foo class' answers Foo's metaclass.
   nil if the name no longer resolves."
  | meta base cls |
  meta := aScopeString size > 6
    and: [(aScopeString copyFrom: aScopeString size - 5 to: aScopeString size) = ' class'].
  base := meta ifTrue: [aScopeString copyFrom: 1 to: aScopeString size - 6] ifFalse: [aScopeString].
  cls := self resolveClass: base.
  cls isNil ifTrue: [^nil].
  ^meta ifTrue: [cls class] ifFalse: [cls]
%
category: 'blind-write guardrail'
method: McpServer
conflictingSubjects
  "The scopes ('Foo', 'Foo class') this session wrote whose method dictionary the stone named in the
   last conflict report. An empty Array when nothing matches.

   System transactionConflicts answers the conflicting OBJECTS, but for a method edit those are a
   GsMethodDictionary and a per-class SymbolSet, which mean nothing to a client. A method dictionary
   has no back-pointer to its class and none is needed: this session's own write ledger already
   names every scope it touched, so matching each candidate's dictionary against the conflict set by
   identity turns the report back into names the client can act on."
  | conflicts objs names |
  conflicts := [System transactionConflicts] on: Error do: [:e | nil].
  conflicts isNil ifTrue: [^Array new].
  objs := IdentitySet new.
  #( #'Write-Write' #'Read-Write' #'Write-Dependency' ) do: [:k |
    (conflicts at: k ifAbsent: [Array new]) do: [:o | objs add: o]].
  objs isEmpty ifTrue: [^Array new].
  names := Set new.
  self writeLedger do: [:key |
    (self class scopeOfMethodKey: key) ifNotNil: [:scope |
      (self behaviorForScope: scope) ifNotNil: [:beh |
        ([objs includes: (beh persistentMethodDictForEnv: 0)] on: Error do: [:e | false])
          ifTrue: [names add: scope]]]].
  ^names asSortedCollection asArray
%
category: 'private'
method: McpServer
dictNamed: aName
  "See McpToolset class>>dictNamed:, the single implementation both roles share. Kept here because
   the kernel guards ask the protected dictionaries by name."
  ^McpToolset dictNamed: aName
%
category: 'protocol'
method: McpServer
handleJsonString: aRawJsonString
  "Worker-gem entry (see the per-client-sessions design): parse a JSON-RPC request body, dispatch
   it in THIS session, and answer the JSON response string -- or '' for a notification (no
   response). No mutex: a worker gem serves one client, whose requests the front end already
   serializes onto it. The class-side handleJsonString: (invoked by McpRouter via
   McpSession>>forward:) relays this answer to the client."
  ^self handleJsonString: aRawJsonString lifetimeBounds: nil
%
category: 'protocol'
method: McpServer
handleJsonString: aRawJsonString lifetimeBounds: anArrayOrNil
  "As handleJsonString:, recording what the front end says bounds this session before dispatching.
   ALWAYS assigns, including nil: this instance is cached for the life of the gem, so bounds left by
   an earlier request would otherwise outlive the deadline that produced them.
   A progress reporter, where the front end installed one for this call (class>>progressCallId:),
   belongs to THIS call and to no call nested inside it. Both halves of that were learned the hard
   way, end to end, and neither shows up in a unit test of one call.
   This method NESTS: a tool that runs a test suite can run tests which themselves send
   handleJsonString:, and gs-mcp''s own suites do exactly that. The first version cleared the reporter
   on the way out, so the first nested call wiped the reporter its CALLER was still reporting
   through and every later tick vanished. Saving and restoring fixed that and revealed the other
   half: the nested call then reported ITS progress on the outer call''s stream -- observed as a
   client told `1/1 test classes` by a call working through six of them, with the outer call''s own
   ticks refused afterwards for not increasing.
   So the depth counter. At depth 1 the reporter is the front end''s and is left alone; deeper, it is
   taken away for the duration and given back on the way out. A nested tool call reports nothing,
   which is right: nobody asked to be told about it.
   What this does NOT catch, because nothing at this level can, is code that calls a TOOLSET METHOD
   directly rather than sending a request -- no request, no depth to count. Such a call reports on
   its caller''s stream, with its own numbers. gs-mcp''s own McpToolTest does this, which is how it
   was found; a deployment''s tools would have to go out of their way to.
   Restored on the way OUT, never cleared on the way in at depth 1: the front end''s expression
   installs the reporter first and calls this second, so clearing on entry would throw away the thing
   just installed. An ensure:, so a raising tool or a break cannot leave a reporter behind to report
   the next call''s work under a callId nobody is listening to."
  | parsed response outer temps depth |
  lifetimeBounds := anArrayOrNil.
  temps := SessionTemps current.
  depth := (temps at: #McpCallDepth otherwise: 0) + 1.
  temps at: #McpCallDepth put: depth.
  outer := temps at: #McpProgress otherwise: nil.
  depth > 1 ifTrue: [temps removeKey: #McpProgress otherwise: nil].
  ^[parsed := self parseBody: aRawJsonString.
    response := dispatcher handle: parsed.
    response isNil ifTrue: [''] ifFalse: [response asJson]]
      ensure: [
        temps at: #McpCallDepth put: depth - 1.
        outer isNil
          ifTrue: [temps removeKey: #McpProgress otherwise: nil]
          ifFalse: [temps at: #McpProgress put: outer]]
%
category: 'blind-write guardrail'
method: McpServer
hasRead: aKey
  "Whether aKey is in the read ledger -- the whole test requireRead:... makes. The stamp stored
   against it is not consulted here: a key is present exactly as long as its read still holds,
   because every view move re-checks or drops it (revalidateReadLedger)."
  ^self readLedger includesKey: aKey
%
category: 'initialization'
method: McpServer
initialize
  "Build the registry + dispatcher, then let each of my toolsets register its tools. Which toolsets
   those are is the whole tool surface of this server (self class defaultToolsetNames here)."
  ^self initializeWithToolsetNames: self class defaultToolsetNames
%
category: 'initialization'
method: McpServer
initializeWithToolsetNames: anArrayOfNames
  "As initialize, but with an explicit tool surface, and no deployment options for any of them."
  ^self initializeWithToolsetNames: anArrayOfNames toolsetOptions: nil
%
category: 'initialization'
method: McpServer
initializeWithToolsetNames: anArrayOfNames toolsetOptions: aDictOrNil
  "As initialize, but with an explicit tool surface: resolve each named toolset (raising if one is
   missing -- see McpServer class>>toolsetClassNamed:) and register it, in the order given.
   aDictOrNil maps a TOOLSET NAME to that toolset's own options Dictionary, so each is built knowing
   only its own configuration -- one toolset can neither read nor collide with another's. A toolset
   with no entry is built exactly as it was before options existed."
  toolRegistry := McpToolRegistry new.
  dispatcher := McpDispatcher withToolRegistry: toolRegistry server: self.
  toolsets := anArrayOfNames collect: [:n |
    (self class toolsetClassNamed: n)
      on: self
      options: (aDictOrNil isNil ifTrue: [nil] ifFalse: [aDictOrNil at: n asString ifAbsent: [nil]])].
  self registerToolsets.
  ^self
%
category: 'guards'
method: McpServer
isProtectedClass: aClass
  "True if aClass is a kernel/system class that mutation tools must not modify: a protected dictionary
   (protectedDictionaryNames) binds this very class under its own name. A class no dictionary in the
   symbol list binds at all is treated as protected (conservative).
   Deliberately NOT judged by dictionaryAndSymbolOf:, which answers the FIRST dictionary in the symbol
   list binding the name -- in a Grail image the Python dictionary also binds Object and precedes
   Globals, so that test reported Object as UNPROTECTED and the mutation tools would have modified
   kernel classes. Asking the protected dictionaries directly cannot be fooled by symbol-list order."
  | name |
  name := aClass name asSymbol.
  self protectedDictionaryNames do: [:dictName |
    (self dictNamed: dictName) ifNotNil: [:d |
      (d at: name ifAbsent: [nil]) == aClass ifTrue: [^true]]].
  ^(System myUserProfile dictionaryAndSymbolOf: aClass) isNil
%
category: 'read-only'
method: McpServer
isReadOnly
  "Whether THIS worker session is read-only: the per-session #McpReadOnly flag its opening router set
   (see sessionReadOnly:). Read-only is entirely per-worker now -- there is no global switch."
  ^(SessionTemps current at: #McpReadOnly otherwise: false) == true
%
category: 'read-only'
method: McpServer
isToolAllowed: aToolName
  "Whether aToolName may run right now: always when not read-only; only the read-only-safe tools
   when read-only. Asks THIS server's toolsets (readOnlySafeToolNames), so a third-party toolset's
   own declaration is honored."
  ^self isReadOnly not or: [self readOnlySafeToolNames includes: aToolName]
%
category: 'session lifetime'
method: McpServer
lifetimeNote
  "What would end this session before uncommitted work is committed, as the clause
   McpDispatcher>>transactionNote appends -- or nil if nothing bounds it or no front end said.

   RENDERED NOW, not when the request arrived, which is the whole reason the front end sends values
   rather than a sentence (McpRouter>>lifetimeBoundsFor:). A countdown rendered on arrival is wrong
   by the length of the call by the time the client reads it, and wrong in the dangerous direction:
   it would promise 24 minutes to a client a six-minute tool call has left 18.

   Both bounds are reported when both exist, NEARER FIRST -- 'nearer' meaning which would release
   this session first if the client stopped calling now, which is the question the client is
   actually deciding. The order is not fixed, because it inverts: a credential outlasting the idle
   rule on arrival can undercut it by the time a long call returns."
  | now deadlineAt source inactivity label deadlineClause inactivityClause |
  lifetimeBounds isNil ifTrue: [^nil].
  now := System timeGmt.
  deadlineAt := lifetimeBounds at: 1.
  source := lifetimeBounds at: 2.
  inactivity := lifetimeBounds at: 3.
  label := lifetimeBounds at: 4.
  deadlineAt ifNotNil: [:at |
    deadlineClause := (self phraseForSeconds: ((at - now) max: 0)) , ' left on ' , source].
  inactivity ifNotNil: [:secs |
    inactivityClause := (self phraseForSeconds: secs) , ' ' , label].
  deadlineClause isNil ifTrue: [^inactivityClause].
  inactivityClause isNil ifTrue: [^deadlineClause].
  ^deadlineAt <= (now + inactivity)
    ifTrue: [deadlineClause , ', or ' , inactivityClause]
    ifFalse: [inactivityClause , ', or ' , deadlineClause]
%
category: 'blind-write guardrail'
method: McpServer
noteAborted
  "An abort took a new view AND discarded every uncommitted change. No pending write is licensed any
   more, so the write ledger empties -- which also keeps writeLedger subseteq readLedger
   unconditional. The reads are re-checked against the new view rather than forgotten
   (revalidateReadLedger): a write this session had made and just discarded fails that check, since
   its stamp is of the text as written and the abort restored the old text, so it must be re-read
   before it is retried. Until 2026-09-02 both ledgers were cleared here, so an abort after browsing
   twenty methods cost twenty re-reads even when nobody else had committed anything."
  self revalidateReadLedger.
  writeLedger := Set new
%
category: 'blind-write guardrail'
method: McpServer
noteCommitFailed
  "A commit refused on conflict. BOTH ledgers are kept, because a failed commit does NOT move the
   view -- measured; see docs/blind-write-guardrail.md (V). The other session's work is still
   invisible, so every read in this window is still current and every pending write is still
   licensed. The transaction is doomed and must be aborted, but that is a different fact from
   whether the reads are stale, and they are not."
  ^self
%
category: 'blind-write guardrail'
method: McpServer
noteCommitted
  "A commit succeeded, and the view moved. The reads get the same re-check every view move gives
   them (revalidateReadLedger); the write ledger then empties, because those changes are now
   everyone's. This session's own writes need no special case to survive the re-check: their stamps
   were recorded as written, and a successful commit means nobody else changed them, so the text in
   the new view is the text this session wrote."
  self revalidateReadLedger.
  writeLedger := Set new
%
category: 'blind-write guardrail'
method: McpServer
noteRead: aKey
  "Record that this session has SEEN aKey in the current view window, together with a stamp of what
   it saw (stampFor:) -- the content of the subject as this view has it, which is what the browsing
   tool that calls this has just shown. Called by the browsing tools that show a subject's current
   contents -- never by a listing or search tool, which show where things are rather than what they
   say. The stamp is what lets a later view move tell a read that still holds from one that does
   not (revalidateReadLedger)."
  self readLedger at: aKey put: (self stampFor: aKey).
  ^aKey
%
category: 'blind-write guardrail'
method: McpServer
noteReads: aCollectionOfKeys
  aCollectionOfKeys do: [:k | self noteRead: k].
  ^aCollectionOfKeys
%
category: 'blind-write guardrail'
method: McpServer
noteRefreshed: aBoolean
  "A refresh took a new view and KEPT this session's uncommitted work. aBoolean is what
   System continueTransaction answered. Either way the view moved, so either way the reads are
   re-checked against it (revalidateReadLedger); what the Boolean decides is the write ledger.
   true means the stone validated the write set and found no conflict: the writes are still pending
   and still licensed, so the write ledger is kept -- and each of them passes the re-check too, since
   the uncommitted text is still in place and is what its stamp records.
   false is the one genuinely bad state in the system: the view moved ANYWAY (measured; see
   docs/blind-write-guardrail.md, U) and the pending writes cannot commit. No licensed writes remain,
   so the write ledger is cleared, which keeps writeLedger subseteq readLedger unconditional. The
   caller captures the conflicting classes first, for the message that tells the client to abort,
   because that message is decoded from the write ledger."
  self revalidateReadLedger.
  aBoolean ifFalse: [writeLedger := Set new]
%
category: 'blind-write guardrail'
method: McpServer
noteWrite: aKey
  "Record that this session has CHANGED aKey and not yet committed it.
   Callers must send this on the branch that actually performed the write, never on entry to the
   tool. A write ledger entry is also a read ledger entry, so an entry recorded for something that
   was never written would license a change to it on the strength of nothing shown to the client,
   and conflictingSubjects would decode the stone's conflict report through a scope this session
   never touched -- which is a live case, not a hypothetical: re-evaluating an identical class
   definition is a true no-op (measured; see docs/blind-write-guardrail.md, S).

   A WRITE IMPLIES A READ, so this records both. Having just written something is knowing its
   current content -- better than having read it -- so it licenses a follow-up change without a
   re-read: creating a dictionary licenses removing it, compiling a method licenses recompiling it.
   Nothing is put at risk, because another session's change to the same thing is still caught by the
   stone's own write-write check. It also makes writeLedger subseteq readLedger true at every
   instant rather than only across a view move.

   The read stamp recorded is of the content AS JUST WRITTEN: that is what this session now knows.
   It follows that an abort, which restores the previous content, finds the stamp moved and drops
   the entry -- so a write that was aborted needs a fresh read before it is retried, even when nobody
   else touched the subject. That is the conservative answer and the honest one: what the client
   last saw of that method is a version that no longer exists."
  self writeLedger add: aKey.
  self readLedger at: aKey put: (self stampFor: aKey).
  ^aKey
%
category: 'guards'
method: McpServer
protectedDictionaryNames
  "Names of the kernel/system symbol dictionaries that mutation tools must not touch: only Globals,
   which holds the base classes. Everything else is freely mutable -- UserGlobals (the DEFAULT home
   for new user-created classes) and any application dictionary such as Published."
  ^#('Globals')
%
category: 'blind-write guardrail'
method: McpServer
readLedger
  "What this session has SEEN in the current view window: a Dictionary from key (the subject a
   mutating tool must find before it may write -- 'Foo>>bar:', 'Foo:shape', 'Foo:comment',
   '#UserGlobals') to the stamp of its content when it was read (stampFor:). Membership is the
   guardrail's test (hasRead:); the stamps are what a view move re-checks (revalidateReadLedger).
   See docs/blind-write-guardrail.md."
  readLedger isNil ifTrue: [readLedger := Dictionary new].
  ^readLedger
%
category: 'read-only'
method: McpServer
readOnlySafeToolNames
  "The tools THIS server may run in a read-only session: the union of what its toolsets declare
   (McpToolset>>readOnlySafeToolNames, empty by default -- fail closed). For the default surface this
   equals the audit list, McpServer class>>coreReadOnlySafeToolNames, which McpContractTest pins."
  | names |
  names := OrderedCollection new.
  toolsets do: [:ts | names addAll: ts readOnlySafeToolNames].
  ^names asArray
%
category: 'initialization'
method: McpServer
registerToolsets
  "Register my toolsets' tools, honoring read-only at BUILD time: a toolset that declares nothing
   read-only-safe is skipped whole, and a mixed one (McpSessionToolset) keeps only its safe tools --
   so in a read-only worker a gated tool is never in the registry at all, which is a stronger gate
   than refusing it on call. Applies whenever read-only is known BEFORE the server is built, which is
   both the production path (the front end sets the flag as it opens the session) and what the
   read-only tests do.
   The client is still told the truth about a pruned tool: McpDispatcher answers a gated name with
   kind 'readOnly' rather than 'notFound' (see readOnlyGated:), so 'forbidden here' never masquerades
   as 'no such tool'. Its isToolAllowed: check also still runs, covering a server whose flag was set
   after it was built and a toolset whose toolNames drift from what it registers."
  self isReadOnly ifFalse: [^toolsets do: [:ts | ts registerOn: toolRegistry]].
  toolsets do: [:ts | | safe |
    safe := ts readOnlySafeToolNames.
    safe isEmpty ifFalse: [
      ts registerOn: toolRegistry.
      (ts toolNames reject: [:n | safe includes: n])
        do: [:n | toolRegistry removeToolNamed: n]]].
  ^self
%
category: 'blind-write guardrail'
method: McpServer
requireRead: aKey subject: aSubjectString tool: aToolName hint: aHintString
  "Refuse a blind write. Raises kind 'blindWrite' unless aKey is in the read ledger, naming the
   subject and the exact call that would license it -- the message is the whole point, because the
   client can always satisfy it in one cheap call."
  (self hasRead: aKey) ifTrue: [^self].
  McpError signalKind: #blindWrite message:
    aToolName , ' refused: this session has not read ' , aSubjectString
      , ' since its view last moved, so replacing it could silently discard another session''s work. '
      , aHintString
%
category: 'private'
method: McpServer
resolveClass: aName
  "See McpToolset class>>resolveClass:, the single implementation both roles share. Kept here for
   the same reason dictNamed: is: a server-level method should not have to know it lives on the
   toolset class."
  ^McpToolset resolveClass: aName
%
category: 'blind-write guardrail'
method: McpServer
revalidateReadLedger
  "Re-check every read against the CURRENT view and drop the ones that no longer hold. Called at
   EVERY view move -- abort, commit, and refresh whichever way it answered (noteAborted,
   noteCommitted, noteRefreshed:) -- and the only transition the read ledger has.

   A read is a statement about content -- 'Foo>>bar: says this' -- and moving the view does not make
   it false; another session having committed a different Foo>>bar: does. So each key's stamp is
   recomputed in the new view (stampFor:). Equal, and the read is as true now as when it was made,
   so it keeps its licence. Different, and it is dropped and remembered in staleReadKeys, for the
   one-time line the dispatcher appends to the result of the call that moved the view
   (McpDispatcher>>staleReadNote) -- so the client learns WHICH reads to redo in one pass, instead
   of discovering them one blindWrite refusal at a time. Answers the keys dropped this time, sorted.

   There is no special case for what this session wrote. A write's stamp is of the text as written;
   after a successful commit nobody else changed it, and after a true refresh the uncommitted text
   is still in place, so it matches. After an abort it does not, and that is right: the text the
   client last knew is gone. So the invariant the guardrail rests on holds by construction -- a key
   is licensed exactly when the current text is what this session read or wrote.

   Until 2026-09-02 a commit or a true refresh kept only the write set plus 'the widening' (the
   unwritten methods of a written class, proven unchanged at the stone's method-dictionary grain)
   and dropped every other read unexamined; an abort or a false refresh dropped everything. Both
   rules are subsumed: a proof that the content did not change is weaker than looking at it.

   COST. One sourceCodeAt: (or definition, comment, or entry list) and one SHA-256 per ledger entry
   per view move -- tens of microseconds each, so a ledger of a few hundred reads costs milliseconds
   against a commit that costs more. If a session's ledger ever grows to where this shows, the
   fallback is to check lazily in requireRead:, re-stamping the one key being written against a
   recorded view generation, at the price of the one-time note, which can only come from checking
   everything. What 'the same content' means per grain is stampFor:'s business."
  | kept stale |
  kept := Dictionary new.
  stale := SortedCollection new.
  self readLedger keysAndValuesDo: [:key :stamp |
    (self stampFor: key) = stamp
      ifTrue: [kept at: key put: stamp]
      ifFalse: [stale add: key]].
  readLedger := kept.
  staleReadKeys := (self staleReadKeys , stale asArray) asSortedCollection asArray.
  ^stale asArray
%
category: 'identity'
method: McpServer
serverInstructions
  "The instructions to send in the initialize result, or nil to send none. Answers the class
   default (defaultServerInstructions), which is where a product overrides them -- there is no
   router-config path for these the way there is for serverName/serverTitle, because they describe
   how the SOFTWARE behaves rather than which instance this is.

   Answers nil for a READ-ONLY session, whose whole point is that it cannot write: telling it to
   commit its changes, or how to recover a commit that failed, would be a page of instructions
   about tools it does not have. Such a session never has uncommitted changes and so never sees a
   [session] line either, which is the thing they exist to explain."
  ^self isReadOnly ifTrue: [nil] ifFalse: [self class defaultServerInstructions]
%
category: 'identity'
method: McpServer
serverName
  "What SOFTWARE this server is, in the initialize result's serverInfo (MCP lifecycle). A server
   assembled from third-party toolsets needs to be able to say so -- announcing itself as
   'gemstone-mcp' would tell a client the opposite of the truth. This is not the field that tells two
   deployments of the SAME software apart; that is serverTitle.
   Precedence: a DEPLOYMENT's router config (the ivar, set by the worker bootstrap through serverName:)
   beats the class default, and a subclass names itself by overriding that class default
   (defaultServerName) -- so a subclass stays relabelable per deployment. A subclass CAN override this
   method instead and thereby win over config, since it then never reads the ivar; that is a
   deliberate lock, not the encouraged path."
  ^serverName ifNil: [self class defaultServerName]
%
category: 'identity'
method: McpServer
serverName: aStringOrNil
  "Set the serverInfo name (nil restores the default). Sent by the worker bootstrap from router
   config; see serverName."
  serverName := aStringOrNil
%
category: 'identity'
method: McpServer
serverTitle
  "The human-readable label for THIS INSTANCE, reported as serverInfo.title -- 'GemStone - geode
   teststone 3.7.6', 'GemStone (read-only)'. nil (the stock answer) means the instance carries no
   label and the title key is omitted from serverInfo; see defaultServerTitle.
   Same precedence as serverName: a deployment's router config beats the class default, which a
   product overrides."
  ^serverTitle ifNil: [self class defaultServerTitle]
%
category: 'identity'
method: McpServer
serverTitle: aStringOrNil
  "Set the serverInfo title (nil restores the default, which is normally no title at all). Sent by
   the worker bootstrap from router config; see serverTitle."
  serverTitle := aStringOrNil
%
category: 'identity'
method: McpServer
serverVersion
  "See serverName."
  ^serverVersion ifNil: [self class defaultServerVersion]
%
category: 'identity'
method: McpServer
serverVersion: aStringOrNil
  "See serverName:."
  serverVersion := aStringOrNil
%
category: 'blind-write guardrail'
method: McpServer
staleReadKeys
  "The keys the last re-validation dropped because their content had changed under a view move --
   sorted, and held until the dispatcher reports them (takeStaleReadKeys). Empty when nothing is
   pending. See revalidateReadLedger."
  staleReadKeys isNil ifTrue: [staleReadKeys := Array new].
  ^staleReadKeys
%
category: 'blind-write guardrail'
method: McpServer
stampFor: aKey
  "The content stamp of whatever aKey names, AS IT STANDS IN THE CURRENT VIEW: what noteRead: and
   noteWrite: record, and what revalidateReadLedger recomputes to see whether a read still holds.
   Dispatches on the key's shape to one method per grain, so what counts as 'the content' of each
   kind of subject is stated in exactly one place:

     'Foo>>bar:'  'Foo class>>bar:'   the installed method's source          stampForMethodKey:
     'Foo:shape'                      the class definition message           stampForShapeKey:
     'Foo:comment'                    the class comment                      stampForCommentKey:
     '#UserGlobals'                   the entries, as list_dictionary_entries shows them
                                                                             stampForDictionaryKey:

   Each answers absentStamp when the subject does not exist in this view, so appearing and
   disappearing both count as change. A key of no known grain stamps as absent too, and so can
   never survive a view move -- the fail-closed default."
  | key |
  key := aKey asString.
  key isEmpty ifTrue: [^self class absentStamp].
  (key at: 1) = $# ifTrue: [^self stampForDictionaryKey: key].
  (self class scopeOfMethodKey: key) notNil ifTrue: [^self stampForMethodKey: key].
  (key endsWith: ':shape') ifTrue: [^self stampForShapeKey: key].
  (key endsWith: ':comment') ifTrue: [^self stampForCommentKey: key].
  ^self class absentStamp
%
category: 'blind-write guardrail'
method: McpServer
stampForCommentKey: aKey
  "'Foo:comment' -> the stamp of Foo's comment, the text describe_class and export_class_source show.
   Absent when the class does not resolve or has no comment -- set_class_comment treats the latter
   as creation, so nothing is licensed by it either way."
  | cls |
  cls := self resolveClass: (aKey copyFrom: 1 to: aKey size - ':comment' size).
  cls isNil ifTrue: [^self class absentStamp].
  ^self class stampOfContent: cls comment
%
category: 'blind-write guardrail'
method: McpServer
stampForDictionaryKey: aKey
  "'#UserGlobals' -> the stamp of the dictionary's entries as list_dictionary_entries renders them:
   each key with whether it binds a class or a global, sorted. The VALUES are deliberately not
   hashed -- that tool shows none of them, and remove_dictionary, the write this licenses, destroys
   the bindings rather than the objects. Absent when no dictionary of that name is in the symbol
   list."
  | dict lines |
  dict := self dictNamed: (aKey copyFrom: 2 to: aKey size).
  dict isNil ifTrue: [^self class absentStamp].
  lines := OrderedCollection new.
  dict keysAndValuesDo: [:k :v |
    lines add: k asString , ((v isKindOf: Behavior) ifTrue: [' (class)'] ifFalse: [' (global)'])].
  ^self class stampOfContent: (McpToolset linesFrom: lines)
%
category: 'blind-write guardrail'
method: McpServer
stampForMethodKey: aKey
  "'Foo>>bar:' or 'Foo class>>bar:' -> the stamp of that method's source as installed on that side
   -- read the way get_method_source reads it (sourceCodeAt:), so the stamp is of exactly the text
   the client was shown. Absent when the class does not resolve or the side does not implement the
   selector."
  | idx beh src |
  idx := aKey indexOfSubCollection: '>>'.
  beh := self behaviorForScope: (aKey copyFrom: 1 to: idx - 1).
  beh isNil ifTrue: [^self class absentStamp].
  src := [beh sourceCodeAt: (aKey copyFrom: idx + 2 to: aKey size) asSymbol] on: Error do: [:ex | nil].
  ^self class stampOfContent: src
%
category: 'blind-write guardrail'
method: McpServer
stampForShapeKey: aKey
  "'Foo:shape' -> the stamp of Foo's definition message, the string get_class_definition answers and
   compile_class_definition compares against (Class>>definition: superclass, variables, dictionary,
   options). Absent when the class does not resolve."
  | cls |
  cls := self resolveClass: (aKey copyFrom: 1 to: aKey size - ':shape' size).
  cls isNil ifTrue: [^self class absentStamp].
  ^self class stampOfContent: cls definition
%
category: 'blind-write guardrail'
method: McpServer
takeStaleReadKeys
  "Answer staleReadKeys and forget them: the dispatcher's note reports them on the result of the
   call that moved the view and then never again."
  | keys |
  keys := self staleReadKeys.
  staleReadKeys := Array new.
  ^keys
%
category: 'accessing'
method: McpServer
toolRegistry
  ^toolRegistry
%
category: 'accessing'
method: McpServer
toolsets
  "My toolsets, in registration order -- this server's tool surface (see McpToolset)."
  ^toolsets
%
category: 'blind-write guardrail'
method: McpServer
writeLedger
  "What this session has CHANGED and not yet committed. See docs/blind-write-guardrail.md."
  writeLedger isNil ifTrue: [writeLedger := Set new].
  ^writeLedger
%
