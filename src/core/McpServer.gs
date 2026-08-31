set compile_env: 0
! ------------------- Class definition for McpServer
expectvalue /Class
doit
McpBase subclass: 'McpServer'
  instVarNames: #( dispatcher toolRegistry toolsets
                    serverName serverTitle serverVersion)
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
into the worker gem in one call (prepareWorkerWithToolsets:readOnly:serverName:title:version:), so a
worker
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
  ^'0.6.0'
%
category: 'toolsets'
classmethod: McpServer
defaultToolsetNames
  "The core tool surface: the seven toolsets a plain McpServer registers, in registration order.
   A deployment that wants a different surface names its own (see McpToolset)."
  ^#( 'McpBrowsingToolset' 'McpExecutionToolset' 'McpListingToolset' 'McpMutationToolset'
      'McpSearchToolset' 'McpSessionToolset' 'McpTestingToolset' )
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
   base tool surface; ask for a different one by name, or via McpServer installedDefaultToolsetNames."
  | srv |
  srv := SessionTemps current at: #McpServer otherwise: nil.
  srv isNil ifTrue: [
    srv := self new.
    SessionTemps current at: #McpServer put: srv].
  ^srv handleJsonString: aRawJsonString
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
category: 'worker'
classmethod: McpServer
prepareWorkerWithToolsets: anArrayOfNames readOnly: aBoolean serverName: aNameOrNil title: aTitleOrNil version: aVersionOrNil
  "Prepare THIS worker gem for one client, in the single call the front end makes at session open
   (McpSession>>prepareWorker). Sent to the class the front end NAMED, so `self` is the server class to
   build -- a worker never chooses.
   Order matters: the read-only flag is set FIRST, so the build can leave gated tools out of the
   registry entirely (McpServer>>registerToolsets). Then the instance is built with the given toolsets
   and identity and cached where handleJsonString: looks for it, which moves tool registration off the
   client's first request and makes an unresolvable toolset fail here, at session open, rather than
   mid-conversation. Answers a short line for the log."
  | srv |
  self sessionReadOnly: aBoolean.
  srv := self newWithToolsetNames: anArrayOfNames.
  srv serverName: aNameOrNil; serverTitle: aTitleOrNil; serverVersion: aVersionOrNil.
  SessionTemps current at: #McpServer put: srv.
  ^self name asString , ' ready: ' , srv toolRegistry descriptors size printString , ' tool(s)'
    , (aBoolean ifTrue: [' (read-only)'] ifFalse: [''])
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
  | parsed response |
  parsed := self parseBody: aRawJsonString.
  response := dispatcher handle: parsed.
  ^response isNil ifTrue: [''] ifFalse: [response asJson]
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
  "As initialize, but with an explicit tool surface: resolve each named toolset (raising if one is
   missing -- see McpServer class>>toolsetClassNamed:) and register it, in the order given."
  toolRegistry := McpToolRegistry new.
  dispatcher := McpDispatcher withToolRegistry: toolRegistry server: self.
  toolsets := anArrayOfNames collect: [:n | (self class toolsetClassNamed: n) on: self].
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
category: 'guards'
method: McpServer
protectedDictionaryNames
  "Names of the kernel/system symbol dictionaries that mutation tools must not touch: only Globals,
   which holds the base classes. Everything else is freely mutable -- UserGlobals (the DEFAULT home
   for new user-created classes) and any application dictionary such as Published."
  ^#('Globals')
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
