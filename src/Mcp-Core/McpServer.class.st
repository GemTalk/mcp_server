"
Per-client MCP worker: the single-client GemStone MCP server. Owns a tool registry and a
JSON-RPC dispatcher and implements every tool_* handler; parses a JSON-RPC request and answers
the JSON response string via handleJsonString:.

One instance runs in each per-client worker gem -- built lazily and cached in SessionTemps by the
class-side handleJsonString:, and driven by the front end McpRouter over a GsTsExternalSession.
This class has NO socket and knows nothing about HTTP or sessions: the transport and the per-client
session routing live in McpRouter. The Grail subclass McpServerWithGrail adds the Python tools;
the class-side handleJsonString: builds the most capable installed class.

To start the server, see McpRouter (runOnPort: / forkOnPort:).
"
Class {
	#name : 'McpServer',
	#superclass : 'McpBase',
	#instVars : [
		'dispatcher',
		'toolRegistry',
		'toolsets'
	],
	#category : 'Mcp-Core'
}

{ #category : 'read-only' }
McpServer class >> coreReadOnlySafeToolNames [
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

]

{ #category : 'toolsets' }
McpServer class >> defaultToolsetNames [
  "The core tool surface: the seven toolsets a plain McpServer registers, in registration order.
   A deployment that wants a different surface names its own (see McpToolset)."
  ^#( 'McpBrowsingToolset' 'McpExecutionToolset' 'McpListingToolset' 'McpMutationToolset'
      'McpSearchToolset' 'McpSessionToolset' 'McpTestingToolset' )

]

{ #category : 'worker' }
McpServer class >> handleJsonString: aRawJsonString [
  "Worker-gem entry the front end drives (via McpSession>>forward:, a blocking executeString:).
   Lazily builds ONE worker instance per worker gem, cached in SessionTemps, to own the tool
   registry + dispatcher, then handles the request in this session. Builds the most capable
   installed class (the Grail subclass if present, else base). Answers the JSON response string
   ('' for a notification)."
  | srv |
  srv := SessionTemps current at: #McpServer otherwise: nil.
  srv isNil ifTrue: [
    srv := ((System myUserProfile objectNamed: #McpServerWithGrail) ifNil: [McpServer] ifNotNil: [:c | c]) new.
    SessionTemps current at: #McpServer put: srv].
  ^srv handleJsonString: aRawJsonString

]

{ #category : 'instance creation' }
McpServer class >> new [
  ^super new initialize

]

{ #category : 'read-only' }
McpServer class >> sessionReadOnly: aBoolean [
  "Mark (or clear) read-only for the CURRENT worker session. The opening router sets this in the
   worker gem when the session should be read-only -- a router configured read-only (a localhost
   convenience so a single user cannot accidentally mutate), or an McpAuthRouter session whose bearer
   token lacked the write scope. Stored in SessionTemps, so it lives and dies with the worker gem,
   needs no commit, and is private to that gem -- which is why two routers (one read-only, one not)
   can run at once with no shared state."
  SessionTemps current at: #McpReadOnly put: aBoolean

]

{ #category : 'toolsets' }
McpServer class >> toolsetClassNamed: aName [
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

]

{ #category : 'guards' }
McpServer >> assertMutableClass: aClass [
  "Refuse (signal McpError kind:#refused, naming the class, reason, and remedy) if aClass is a
   protected/kernel class. Called by every mutation tool before it changes anything. NB: this
   guards the structured mutation tools only -- execute_code is the deliberate escape hatch (and is
   itself gated in read-only mode)."
  | arr where |
  (self isProtectedClass: aClass) ifFalse: [^aClass].
  arr := System myUserProfile dictionaryAndSymbolOf: aClass.
  where := arr isNil ifTrue: ['no user dictionary'] ifFalse: [(arr at: 1) name asString].
  ^McpError signalKind: #refused message:
    'Refused: ' , aClass name asString , ' is a protected class (home dictionary ' , where
      , '); MCP mutation tools do not modify kernel/system classes. Remedy: target one of your own '
      , 'classes in a user dictionary (e.g. UserGlobals), or use execute_code if you truly intend a '
      , 'system change.'

]

{ #category : 'guards' }
McpServer >> assertRemovableDictionaryNamed: aName [
  "Refuse (signal McpError kind:#refused) if aName is a protected system dictionary."
  (self protectedDictionaryNames includes: aName asString) ifTrue: [
    ^McpError signalKind: #refused message:
      'Refused: ' , aName asString , ' is a protected system dictionary and cannot be removed.'].
  ^aName

]

{ #category : 'schema building' }
McpServer >> boolProperty: aDescription [
  "See McpToolset class>>boolProperty:, the single implementation both roles share."
  ^McpToolset boolProperty: aDescription

]

{ #category : 'private' }
McpServer >> capResult: aString [
  "Cap an arbitrary tool result at 50000 characters so a huge value can't swamp the
   client. Shared by execute_code (and by eval_python/compile_python in McpServerWithGrail)."
  ^aString size > 50000
    ifTrue: [(aString copyFrom: 1 to: 50000) , ' ...[truncated]']
    ifFalse: [aString]

]

{ #category : 'private' }
McpServer >> classNameFromDefinition: source [
  "The class name in a 'Super subclass: ''Name'' ...' definition: the substring between the
   first two single quotes, as a Symbol. Returns nil if the source has no quoted literal
   (e.g. a symbol-form name) -- callers then treat it as a plain redefine."
  | q1 q2 |
  q1 := source indexOf: $' ifAbsent: [^nil].
  q2 := source indexOf: $' startingAt: q1 + 1 ifAbsent: [^nil].
  ^(source copyFrom: q1 + 1 to: q2 - 1) asSymbol

]

{ #category : 'private' }
McpServer >> dictNamed: aName [
  "Find a symbol dictionary by name in the current symbol list, or nil."
  System myUserProfile symbolList do: [:d | d name asString = aName ifTrue: [^d]].
  ^nil

]

{ #category : 'private' }
McpServer >> flattenMethods: aCollection [
  "Flatten into a flat OrderedCollection of GsNMethod. Accepts a flat collection of GsNMethod
   (implementorsOf:/referencesToObject:) or a nested collection of collections (sendersOf:)."
  | methods |
  methods := OrderedCollection new.
  aCollection do: [:e |
    (e isKindOf: GsNMethod)
      ifTrue: [methods add: e]
      ifFalse: [(e isKindOf: Collection) ifTrue: [
        e do: [:m | (m isKindOf: GsNMethod) ifTrue: [methods add: m]]]]].
  ^methods

]

{ #category : 'private' }
McpServer >> formatMethodList: aCollection [
  "Format GsNMethods as readable lines: Class>>selector  [category]. Accepts flat or nested
   collections of GsNMethod (see flattenMethods:)."
  | methods s |
  methods := self flattenMethods: aCollection.
  methods isEmpty ifTrue: [^'(none)'].
  s := WriteStream on: String new.
  methods do: [:m | | cat |
    cat := [m inClass categoryOfSelector: m selector] on: Error do: [:e | nil].
    s nextPutAll: m inClass name asString; nextPutAll: '>>'; nextPutAll: m selector asString.
    cat ifNotNil: [s nextPutAll: '  ['; nextPutAll: cat asString; nextPutAll: ']'].
    s nextPut: Character lf].
  ^s contents

]

{ #category : 'private' }
McpServer >> formatTestResult: aTestResult label: aLabel [
  "Summary line plus one line per non-passing test. GemStone's TestResult reports each failure/
   error as a descriptive String (e.g. 'SomeTest debug: #testFoo'); emit those.
   Cross-version: GS 3.6.2's TestResult returns the SAME set from #failures and #errors (and an
   inflated #runCount), so label #failures FAIL and only the #errors NOT already in #failures as
   ERROR, and derive run = passed + failed + errorOnly. (Neither collection repeats a test
   internally, so the reject: is the only de-duplication needed.) On 3.7.x the two sets are
   disjoint, so output is unchanged there; on 3.6.2 (where everything lands in #failures) all
   non-passing tests read as FAIL. Never use aTestResult printString: its printOn: varies by
   SUnit version and can send #shouldPass to the String entries, raising an MNU."
  | failed errorOnly passed s |
  failed := aTestResult failures collect: [:t | t asString].
  errorOnly := (aTestResult errors collect: [:t | t asString])
    reject: [:k | failed includes: k].
  passed := aTestResult passedCount.
  s := WriteStream on: String new.
  s nextPutAll: aLabel; nextPutAll: ': '.
  s nextPutAll: (passed + failed size + errorOnly size) printString; nextPutAll: ' run, '.
  s nextPutAll: passed printString; nextPutAll: ' passed, '.
  s nextPutAll: failed size printString; nextPutAll: ' failed, '.
  s nextPutAll: errorOnly size printString; nextPutAll: ' errors'.
  (failed isEmpty and: [errorOnly isEmpty]) ifFalse: [
    s nextPut: Character lf.
    failed asSortedCollection do: [:k | s nextPutAll: '  FAIL  '; nextPutAll: k; nextPut: Character lf].
    errorOnly asSortedCollection do: [:k | s nextPutAll: '  ERROR '; nextPutAll: k; nextPut: Character lf]].
  ^s contents

]

{ #category : 'protocol' }
McpServer >> handleJsonString: aRawJsonString [
  "Worker-gem entry (see the per-client-sessions design): parse a JSON-RPC request body, dispatch
   it in THIS session, and answer the JSON response string -- or '' for a notification (no
   response). No mutex: a worker gem serves one client, whose requests the front end already
   serializes onto it. The class-side handleJsonString: (invoked by McpRouter via
   McpSession>>forward:) relays this answer to the client."
  | parsed response |
  parsed := self parseBody: aRawJsonString.
  response := dispatcher handle: parsed.
  ^response isNil ifTrue: [''] ifFalse: [response asJson]

]

{ #category : 'initialization' }
McpServer >> initialize [
  "Build the registry + dispatcher, then let each of my toolsets register its tools. Which toolsets
   those are is the whole tool surface of this server (self class defaultToolsetNames here)."
  ^self initializeWithToolsetNames: self class defaultToolsetNames

]

{ #category : 'initialization' }
McpServer >> initializeWithToolsetNames: anArrayOfNames [
  "As initialize, but with an explicit tool surface: resolve each named toolset (raising if one is
   missing -- see McpServer class>>toolsetClassNamed:) and register it, in the order given."
  toolRegistry := McpToolRegistry new.
  dispatcher := McpDispatcher withToolRegistry: toolRegistry server: self.
  toolsets := anArrayOfNames collect: [:n | (self class toolsetClassNamed: n) on: self].
  toolsets do: [:ts | ts registerOn: toolRegistry].
  ^self

]

{ #category : 'guards' }
McpServer >> isProtectedClass: aClass [
  "True if aClass is a kernel/system class that mutation tools must not modify -- judged by its home
   symbol dictionary being one of protectedDictionaryNames. A class resident in no dictionary is
   treated as protected (conservative)."
  | arr |
  arr := System myUserProfile dictionaryAndSymbolOf: aClass.
  arr isNil ifTrue: [^true].
  ^self protectedDictionaryNames includes: (arr at: 1) name asString

]

{ #category : 'read-only' }
McpServer >> isReadOnly [
  "Whether THIS worker session is read-only: the per-session #McpReadOnly flag its opening router set
   (see sessionReadOnly:). Read-only is entirely per-worker now -- there is no global switch."
  ^(SessionTemps current at: #McpReadOnly otherwise: false) == true

]

{ #category : 'read-only' }
McpServer >> isToolAllowed: aToolName [
  "Whether aToolName may run right now: always when not read-only; only the read-only-safe tools
   when read-only. Asks THIS server's toolsets (readOnlySafeToolNames), so a third-party toolset's
   own declaration is honored."
  ^self isReadOnly not or: [self readOnlySafeToolNames includes: aToolName]

]

{ #category : 'private' }
McpServer >> linesFrom: aCollectionOfStrings [
  "Sort the strings and join them one per line; '(none)' if empty."
  | s |
  aCollectionOfStrings isEmpty ifTrue: [^'(none)'].
  s := WriteStream on: String new.
  (aCollectionOfStrings asSortedCollection asArray) do: [:n |
    s nextPutAll: n asString; nextPut: Character lf].
  ^s contents

]

{ #category : 'private' }
McpServer >> methodsReportFor: aBehavior label: aLabel [
  "Group aBehavior's selectors by category into a readable report."
  | byCat s |
  byCat := Dictionary new.
  aBehavior selectors do: [:sel | | cat |
    cat := (aBehavior categoryOfSelector: sel) ifNil: [#'(uncategorized)'].
    (byCat at: cat asString ifAbsentPut: [OrderedCollection new]) add: sel asString].
  s := WriteStream on: String new.
  s nextPutAll: aLabel; nextPutAll: ' methods:'; nextPut: Character lf.
  byCat keys asSortedCollection do: [:cat |
    s nextPutAll: '  '; nextPutAll: cat; nextPut: Character lf.
    (byCat at: cat) asSortedCollection do: [:sel | s nextPutAll: '    '; nextPutAll: sel; nextPut: Character lf]].
  ^s contents

]

{ #category : 'schema building' }
McpServer >> objectSchema: propsDict required: requiredArray [
  "See McpToolset class>>objectSchema:required:, the single implementation both roles share (it is
   what closes every tool schema)."
  ^McpToolset objectSchema: propsDict required: requiredArray

]

{ #category : 'schema building' }
McpServer >> propString: aDescription [
  "See McpToolset class>>propString:, the single implementation both roles share."
  ^McpToolset propString: aDescription

]

{ #category : 'guards' }
McpServer >> protectedDictionaryNames [
  "Names of the kernel/system symbol dictionaries that mutation tools must not touch: only Globals,
   which holds the base classes. Everything else is freely mutable -- UserGlobals (the DEFAULT home
   for new user-created classes) and any application dictionary such as Published."
  ^#('Globals')

]

{ #category : 'read-only' }
McpServer >> readOnlySafeToolNames [
  "The tools THIS server may run in a read-only session: the union of what its toolsets declare
   (McpToolset>>readOnlySafeToolNames, empty by default -- fail closed). For the default surface this
   equals the audit list, McpServer class>>coreReadOnlySafeToolNames, which McpContractTest pins."
  | names |
  names := OrderedCollection new.
  toolsets do: [:ts | names addAll: ts readOnlySafeToolNames].
  ^names asArray

]

{ #category : 'private' }
McpServer >> recompileMethodsFrom: oldClass into: newClass named: classNameSymbol [
  "Recompile every instance- and class-side method of oldClass onto newClass, preserving
   category and environmentId. Commit (apply-and-report) and return a report listing any
   methods that failed to recompile under the new shape (each with its CompileError details,
   the same descriptor a failed compile_method returns)."
  | sides failures total classNameString s |
  failures := OrderedCollection new.
  total := 0.
  sides := Array
    with: (Array with: 'instance' with: oldClass with: newClass)
    with: (Array with: 'class' with: oldClass class with: newClass class).
  sides do: [:triple | | side src tgt |
    side := triple at: 1. src := triple at: 2. tgt := triple at: 3.
    src selectors do: [:sel | | errs |
      total := total + 1.
      errs := [tgt
        compileMethod: (src sourceCodeAt: sel)
        dictionaries: System myUserProfile symbolList
        category: ((src categoryOfSelector: sel) ifNil: ['other']) asString
        environmentId: (src compiledMethodAt: sel) environmentId.
        nil] on: CompileError do: [:ex | ex errorDetails].
      errs ifNotNil: [failures add: (Array with: side with: sel with: errs)]]].
  System commitTransaction.
  classNameString := classNameSymbol asString.
  s := WriteStream on: String new.
  s nextPutAll: 'Redefined ' , classNameString , '; recompiled ' , (total - failures size) printString
    , '/' , total printString , ' methods'.
  failures isEmpty
    ifTrue: [s nextPutAll: '; all recompiled. Committed.']
    ifFalse: [s nextPutAll: '; ' , failures size printString , ' failed (committed anyway):'; nextPut: Character lf.
      failures do: [:f |
        s nextPutAll: '  ' , (f at: 1) , ' ' , classNameString , '>>' , (f at: 2) asString , ' - ' , (f at: 3) printString;
          nextPut: Character lf]].
  ^s contents

]

{ #category : 'private' }
McpServer >> resolveClass: aName [
  "Resolve a class by name in the current symbol list, or nil if not a class."
  | obj |
  obj := System myUserProfile objectNamed: aName asSymbol.
  ^(obj isKindOf: Behavior) ifTrue: [obj] ifFalse: [nil]

]

{ #category : 'tools - session' }
McpServer >> tool_abort: args [
  System abortTransaction.
  ^'Transaction aborted; view refreshed.'

]

{ #category : 'tools - mutation' }
McpServer >> tool_add_dictionary: args [
  | name up d |
  name := args at: 'dictionaryName'.
  ^(self dictNamed: name) notNil
    ifTrue: ['Dictionary already exists: ' , name]
    ifFalse: [up := System myUserProfile.
      d := up createDictionary: name asSymbol.
      up insertDictionary: d at: up symbolList size + 1.
      System commitTransaction.
      'Created dictionary: ' , name]

]

{ #category : 'tools - session' }
McpServer >> tool_commit: args [
  ^System commitTransaction
    ifTrue: ['Transaction committed.']
    ifFalse: ['Commit failed due to conflicts; the transaction is still open.']

]

{ #category : 'tools - mutation' }
McpServer >> tool_compile_class_definition: args [
  "Evaluate a class-definition expression and commit. If recompileMethods is true (default)
   and this is a shape-changing redefinition of an existing class (which would otherwise drop
   all its methods), recompile the prior version's methods onto the new version and report any
   that fail. Refused when the class has subclasses (handle the hierarchy manually, or pass
   recompileMethods=false to redefine raw)."
  | source recompile name existing oldClass newClass |
  source := args at: 'source'.
  recompile := (args at: 'recompileMethods' ifAbsent: [true]) ~~ false.
  name := self classNameFromDefinition: source.
  existing := name notNil ifTrue: [self resolveClass: name] ifFalse: [nil].
  existing ifNotNil: [:c | self assertMutableClass: c].  "refuse redefining a kernel class (any recompile setting)"
  oldClass := recompile ifTrue: [existing] ifFalse: [nil].
  (recompile and: [oldClass notNil and: [oldClass subclasses isEmpty not]]) ifTrue: [
    ^'Refused: ' , name asString , ' has subclasses '
      , (oldClass subclasses collect: [:c | c name asString]) asArray printString
      , '. Recompiling methods across a subclass hierarchy is unsupported; pass recompileMethods=false to redefine without preserving methods, or update the hierarchy manually.'].
  newClass := source evaluate.
  (newClass isKindOf: Behavior) ifFalse: [
    System abortTransaction.
    ^'Source did not evaluate to a class (got ' , newClass class name asString
      , '). Use execute_code to evaluate arbitrary expressions.'].
  (recompile not or: [oldClass isNil or: [oldClass == newClass]]) ifTrue: [
    System commitTransaction.
    ^'Compiled and committed class: ' , newClass name asString].
  ^self recompileMethodsFrom: oldClass into: newClass named: name

]

{ #category : 'tools - mutation' }
McpServer >> tool_compile_method: args [
  | cls target errs |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      self assertMutableClass: cls.
      target := ((args at: 'meta' ifAbsent: [false]) == true) ifTrue: [cls class] ifFalse: [cls].
      errs := target
        compileMethod: (args at: 'source')
        dictionaries: System myUserProfile symbolList
        category: (args at: 'category' ifAbsent: ['mcp']).
      errs isNil
        ifTrue: [System commitTransaction. 'Compiled ' , (args at: 'className') , ' and committed.']
        ifFalse: [System abortTransaction. 'Compile errors: ' , errs printString]]

]

{ #category : 'tools - mutation' }
McpServer >> tool_delete_class: args [
  | cls arr dict |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      self assertMutableClass: cls.
      arr := System myUserProfile dictionaryAndSymbolOf: cls.
      arr isNil
        ifTrue: ['Class is not resident in a dictionary: ' , (args at: 'className')]
        ifFalse: [dict := arr at: 1.
          dict removeKey: (arr at: 2).
          System commitTransaction.
          'Deleted class ' , (args at: 'className') , ' from ' , dict name asString , ' and committed.']]

]

{ #category : 'tools - mutation' }
McpServer >> tool_delete_method: args [
  | cls target sel |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      self assertMutableClass: cls.
      target := ((args at: 'meta' ifAbsent: [false]) == true) ifTrue: [cls class] ifFalse: [cls].
      sel := (args at: 'selector') asSymbol.
      (target selectors includes: sel)
        ifFalse: ['Method not found: ' , (args at: 'className') , '>>' , (args at: 'selector')]
        ifTrue: [target removeSelector: sel.
          System commitTransaction.
          'Deleted method ' , (args at: 'className') , '>>' , (args at: 'selector') , ' and committed.']]

]

{ #category : 'tools - browsing' }
McpServer >> tool_describe_class: args [
  | cls nl |
  cls := self resolveClass: (args at: 'className').
  nl := String with: Character lf.
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      'name=' , cls name , nl ,
      'superclass=' , (cls superclass isNil ifTrue: ['nil'] ifFalse: [cls superclass name]) , nl ,
      'instVarNames=' , cls instVarNames printString , nl ,
      'selectors=' , (cls selectors asSortedCollection asArray) printString]

]

{ #category : 'tools - testing' }
McpServer >> tool_describe_test_failure: args [
  "Re-run one test in isolation (runCase lets the exception propagate instead of being swallowed
   by TestCase>>run) and report the failure detail. Uses ex description -- which for a
   MessageNotUnderstood spells out the error number, the receiver's class, and the missing
   selector -- rather than ex messageText, which is nil for a DNU."
  | cls sel label |
  cls := self resolveClass: (args at: 'className').
  cls isNil ifTrue: [^'Class not found: ' , (args at: 'className')].
  sel := (args at: 'selector') asSymbol.
  label := (args at: 'className') , '>>' , (args at: 'selector').
  ^[(cls selector: sel) runCase. label , ' passed (no failure).']
    on: Error, TestFailure
    do: [:ex | | detail |
      detail := [ex description] on: Error do: [:e | ex messageText ifNil: ['(no detail available)']].
      label , ' - ' , ex class name asString , ': ' , detail asString]

]

{ #category : 'tools - execution' }
McpServer >> tool_execute_code: args [
  "Code is wrapped by McpDispatcher>>handleToolsCall:id: to catch errors"
  ^self capResult: (args at: 'code') evaluate printString

]

{ #category : 'tools - browsing' }
McpServer >> tool_export_class_source: args [
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil ifTrue: ['Class not found: ' , (args at: 'className')] ifFalse: [cls fileOutClass]

]

{ #category : 'tools - search' }
McpServer >> tool_find_implementors: args [
  ^self formatMethodList: (ClassOrganizer new implementorsOf: (args at: 'selector') asSymbol)

]

{ #category : 'tools - search' }
McpServer >> tool_find_references_to: args [
  | obj |
  obj := System myUserProfile objectNamed: (args at: 'name') asSymbol.
  ^obj isNil
    ifTrue: ['Global not found: ' , (args at: 'name')]
    ifFalse: [self formatMethodList: (ClassOrganizer new referencesToObject: obj)]

]

{ #category : 'tools - search' }
McpServer >> tool_find_senders: args [
  "Senders of a common selector can number in the thousands, so cap the output. Unlike
   search_method_source (which stops scanning at the cap and can't know the total), sendersOf:
   returns the full set first, so we can report the true total in the truncation note."
  | cap flat total |
  cap := 200.
  flat := self flattenMethods: (ClassOrganizer new sendersOf: (args at: 'selector') asSymbol).
  total := flat size.
  total > cap ifTrue: [flat := flat copyFrom: 1 to: cap].
  ^(total > cap
      ifTrue: ['(showing first ' , cap printString , ' of ' , total printString , ')' , (String with: Character lf)]
      ifFalse: [''])
    , (self formatMethodList: flat)

]

{ #category : 'tools - browsing' }
McpServer >> tool_get_class_definition: args [
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil ifTrue: ['Class not found: ' , (args at: 'className')] ifFalse: [cls definition]

]

{ #category : 'tools - browsing' }
McpServer >> tool_get_class_hierarchy: args [
  | cls s chain c subs |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil ifTrue: ['Class not found: ' , (args at: 'className')] ifFalse: [
    s := WriteStream on: String new.
    chain := OrderedCollection new. c := cls.
    [c notNil] whileTrue: [chain addFirst: c. c := c superclass].
    1 to: chain size do: [:i |
      ((i - 1) * 2) timesRepeat: [s nextPut: Character space].
      s nextPutAll: (chain at: i) name asString; nextPut: Character lf].
    s nextPutAll: 'Direct subclasses:'; nextPut: Character lf.
    subs := (cls subclasses collect: [:x | x name asString]).
    subs isEmpty
      ifTrue: [s nextPutAll: '  (none)']
      ifFalse: [subs asSortedCollection do: [:n | s nextPutAll: '  '; nextPutAll: n; nextPut: Character lf]].
    s contents]

]

{ #category : 'tools - browsing' }
McpServer >> tool_get_method_source: args [
  | cls target src |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      target := ((args at: 'meta' ifAbsent: [false]) == true) ifTrue: [cls class] ifFalse: [cls].
      src := [target sourceCodeAt: (args at: 'selector') asSymbol] on: Error do: [:ex | nil].
      src isNil
        ifTrue: ['No such method: ' , (args at: 'className') , '>>' , (args at: 'selector')]
        ifFalse: [src]]

]

{ #category : 'tools - listing' }
McpServer >> tool_list_all_classes: args [
  | names |
  names := OrderedCollection new.
  System myUserProfile symbolList do: [:d |
    d values do: [:v | (v isKindOf: Behavior) ifTrue: [names add: v name asString , '  (' , d name asString , ')']]].
  ^self linesFrom: names

]

{ #category : 'tools - listing' }
McpServer >> tool_list_classes: args [
  | dict |
  dict := self dictNamed: (args at: 'dictionaryName').
  ^dict isNil
    ifTrue: ['Dictionary not found: ' , (args at: 'dictionaryName')]
    ifFalse: [self linesFrom: ((dict values select: [:v | v isKindOf: Behavior]) collect: [:c | c name asString])]

]

{ #category : 'tools - listing' }
McpServer >> tool_list_dictionaries: args [
  | s |
  s := WriteStream on: String new.
  System myUserProfile symbolList do: [:d | s nextPutAll: d name asString; nextPut: Character lf].
  ^s contents

]

{ #category : 'tools - listing' }
McpServer >> tool_list_dictionary_entries: args [
  | dict lines |
  dict := self dictNamed: (args at: 'dictionaryName').
  ^dict isNil
    ifTrue: ['Dictionary not found: ' , (args at: 'dictionaryName')]
    ifFalse: [lines := OrderedCollection new.
      dict keysAndValuesDo: [:k :v |
        lines add: k asString , ((v isKindOf: Behavior) ifTrue: ['  (class)'] ifFalse: ['  (global)'])].
      self linesFrom: lines]

]

{ #category : 'tools - testing' }
McpServer >> tool_list_failing_tests: args [
  | names classes out |
  classes := OrderedCollection new.
  names := args at: 'classNames' ifAbsent: [nil].
  names isNil
    ifTrue: [classes addAll: (ClassOrganizer new allSubclassesOf: (System myUserProfile objectNamed: #TestCase))]
    ifFalse: [names do: [:n | | c | c := self resolveClass: n. c ifNotNil: [classes add: c]]].
  out := WriteStream on: String new.
  classes do: [:cls | | res |
    res := cls suite run.
    res failures do: [:t | out nextPutAll: 'FAIL  '; nextPutAll: t asString; nextPut: Character lf].
    res errors do: [:t | out nextPutAll: 'ERROR '; nextPutAll: t asString; nextPut: Character lf]].
  ^out contents isEmpty ifTrue: ['(no failing tests)'] ifFalse: [out contents]

]

{ #category : 'tools - browsing' }
McpServer >> tool_list_methods: args [
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil ifTrue: ['Class not found: ' , (args at: 'className')] ifFalse: [
    (self methodsReportFor: cls label: 'Instance') , (String with: Character lf)
      , (self methodsReportFor: cls class label: 'Class')]

]

{ #category : 'tools - testing' }
McpServer >> tool_list_test_classes: args [
  | tc |
  tc := System myUserProfile objectNamed: #TestCase.
  ^tc isNil
    ifTrue: ['TestCase is not available in this image.']
    ifFalse: [self linesFrom: ((ClassOrganizer new allSubclassesOf: tc) collect: [:c | c name asString])]

]

{ #category : 'tools - session' }
McpServer >> tool_refresh: args [
  System abortTransaction.
  ^'View refreshed.'

]

{ #category : 'tools - mutation' }
McpServer >> tool_remove_dictionary: args [
  | name dict up |
  name := args at: 'dictionaryName'.
  dict := self dictNamed: name.
  ^dict isNil
    ifTrue: ['Dictionary not found: ' , name]
    ifFalse: [self assertRemovableDictionaryNamed: name.
      up := System myUserProfile.
      up removeDictionaryAt: (up symbolList indexOf: dict).
      up symbolList do: [:d | (d at: name asSymbol ifAbsent: [nil]) == dict ifTrue: [d removeKey: name asSymbol ifAbsent: [nil]]].
      System commitTransaction.
      'Removed dictionary: ' , name]

]

{ #category : 'tools - testing' }
McpServer >> tool_run_test_class: args [
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [self formatTestResult: cls suite run label: cls name asString]

]

{ #category : 'tools - testing' }
McpServer >> tool_run_test_method: args [
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [self formatTestResult: (cls selector: (args at: 'selector') asSymbol) run
      label: (args at: 'className') , '>>' , (args at: 'selector')]

]

{ #category : 'tools - search' }
McpServer >> tool_search_method_source: args [
  | pattern cap hits dicts |
  pattern := args at: 'pattern'.
  cap := 200.
  hits := OrderedCollection new.
  dicts := (args at: 'dictionaryName' ifAbsent: [nil])
    ifNil: [System myUserProfile symbolList asArray]
    ifNotNil: [:dname | | d | d := self dictNamed: dname. d isNil ifTrue: [#()] ifFalse: [Array with: d]].
  dicts do: [:dict | dict values do: [:v | (v isKindOf: Behavior) ifTrue: [
    (Array with: v with: v class) do: [:beh | beh selectors do: [:sel |
      hits size < cap ifTrue: [ | src |
        src := [beh sourceCodeAt: sel] on: Error do: [:e | nil].
        (src notNil and: [src includesString: pattern]) ifTrue: [
          hits add: beh name asString , '>>' , sel asString]]]]]]].
  ^(hits size >= cap ifTrue: ['(truncated at ' , cap printString , ' hits)' , (String with: Character lf)] ifFalse: [''])
    , (self linesFrom: hits)

]

{ #category : 'tools - mutation' }
McpServer >> tool_set_class_comment: args [
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil ifTrue: ['Class not found: ' , (args at: 'className')] ifFalse: [
    self assertMutableClass: cls.
    cls comment: (args at: 'comment').
    System commitTransaction.
    'Comment set on ' , cls name asString , ' and committed.']

]

{ #category : 'tools - session' }
McpServer >> tool_status: args [
  ^'user=' , System myUserProfile userId ,
   ' session=' , System session printString ,
   ' stone=' , System stoneName ,
   ' uncommittedChanges=' , System needsCommit printString

]

{ #category : 'accessing' }
McpServer >> toolRegistry [
  ^toolRegistry

]

{ #category : 'accessing' }
McpServer >> toolsets [
  "My toolsets, in registration order -- this server's tool surface (see McpToolset)."
  ^toolsets

]
