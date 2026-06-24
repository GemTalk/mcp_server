set compile_env: 0
! ------------------- Class definition for GsMcpServer
expectvalue /Class
doit
Object subclass: 'GsMcpServer'
  instVarNames: #( serverSocket port running registry dispatcher log)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: UserGlobals
  options: #()
%
expectvalue /Class
doit
GsMcpServer comment:
'Native GemStone MCP server. Runs a blocking HTTP/1.1 accept loop on localhost that
speaks JSON-RPC 2.0 / MCP (single POST /mcp endpoint), dispatching tool calls to
direct in-image Smalltalk execution. Replaces the Node.js + GCI/FFI bridge.

IMPORTANT: runOnPort: is BLOCKING and is meant to be the main activity of a
dedicated gem. Forked GsProcesses only run while the gem is actively executing
Smalltalk, so a background fork in an idle GCI session would never serve requests.

Start (from a dedicated gem / topaz session):
    GsMcpServer runOnPort: 8000

Test it:
    curl -s localhost:8000/mcp -d ''{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}''
'
%
expectvalue /Class
doit
GsMcpServer category: 'GsMcp'
%
! ------------------- Remove existing behavior from GsMcpServer
removeallmethods GsMcpServer
removeallclassmethods GsMcpServer
! ------------------- Class methods for GsMcpServer
category: 'instance creation'
classmethod: GsMcpServer
new
  ^super new initialize
%
category: 'instance creation'
classmethod: GsMcpServer
runOnPort: aPort
  "Convenience: create a server and run its (blocking) accept loop. Intended as
   the main activity of a dedicated gem."
  ^self new runOnPort: aPort
%
! ------------------- Instance methods for GsMcpServer
category: 'initialization'
method: GsMcpServer
initialize
  registry := GsMcpToolRegistry new.
  dispatcher := GsMcpDispatcher registry: registry.
  running := false.
  self registerCoreTools.
  ^self
%
category: 'accessing'
method: GsMcpServer
registry
  ^registry
%
category: 'controlling'
method: GsMcpServer
stop
  "Request a graceful shutdown; the accept loop exits within one accept timeout."
  running := false
%
category: 'private'
method: GsMcpServer
log: aString
  "Best-effort logging to the gem's log file; never fails the caller."
  [GsFile gciLogServer: aString] on: Error do: [:ex | nil]
%
category: 'running'
method: GsMcpServer
runOnPort: aPort
  "Bind a localhost-only listener and run the accept loop until #stop.
   BLOCKING: this is meant to be the gem's main activity (forked GsProcesses
   only run while the gem is actively executing Smalltalk)."
  port := aPort.
  serverSocket := GsSocket new.
  (serverSocket makeServer: 16 atPort: aPort atAddress: '127.0.0.1')
    ifNil: [^self error: 'makeServer failed on port ' , aPort printString , ': ' , serverSocket lastErrorString].
  running := true.
  self log: 'GsMcpServer listening on 127.0.0.1:' , aPort printString.
  [running] whileTrue: [
    | client |
    client := serverSocket acceptTimeoutMs: 500.
    client ifNotNil: [self serve: client]].
  serverSocket close.
  self log: 'GsMcpServer stopped.'.
  ^self
%
category: 'running'
method: GsMcpServer
serve: aClientSocket
  "Handle one connection: read request, dispatch, write response, close.
   Any error is contained so the accept loop survives."
  | conn |
  conn := GsMcpHttpConnection on: aClientSocket.
  [ | req response |
    req := conn readRequest.
    req isNil ifFalse: [
      response := dispatcher handle: (self parseBody: (req at: 'body' ifAbsent: [''])).
      response isNil
        ifTrue: [conn writeStatus: 202 reason: 'Accepted' body: '']
        ifFalse: [conn writeJson: response asJson]]
  ] on: Error do: [:ex |
    self log: 'GsMcpServer serve: error: ' , ex messageText.
    [conn writeStatus: 500 reason: 'Internal Server Error'
       body: '{"jsonrpc":"2.0","id":null,"error":{"code":-32603,"message":"Internal error"}}']
      on: Error do: [:e | nil]].
  conn close
%
category: 'private'
method: GsMcpServer
parseBody: aString
  "Parse a JSON-RPC request body, or nil if empty/malformed."
  (aString isNil or: [aString isEmpty]) ifTrue: [^nil].
  ^[JsonParser parse: aString] on: Error do: [:ex | nil]
%
category: 'schema building'
method: GsMcpServer
propString: aDescription
  | d |
  d := Dictionary new.
  d at: 'type' put: 'string'.
  d at: 'description' put: aDescription.
  ^d
%
category: 'schema building'
method: GsMcpServer
objectSchema: propsDict required: requiredArray
  | d |
  d := Dictionary new.
  d at: 'type' put: 'object'.
  d at: 'properties' put: propsDict.
  d at: 'required' put: requiredArray.
  ^d
%
category: 'tools'
method: GsMcpServer
registerCoreTools
  "Register the v1 core tool set. Each handler is a one-arg block [:args | aString].
   Adding a tool later is one more registry name:description:inputSchema:do: send."
  | nl |
  nl := String with: Character lf.

  registry
    name: 'execute_code'
    description: 'Execute GemStone Smalltalk code and return the printString of the result. Accepts a single expression or a sequence of statements.'
    inputSchema: (self objectSchema:
        (Dictionary new at: 'code' put: (self propString: 'Smalltalk source to evaluate'); yourself)
        required: (Array with: 'code'))
    do: [:args | | result |
      result := (args at: 'code') evaluate printString.
      result size > 50000 ifTrue: [result := (result copyFrom: 1 to: 50000) , ' ...[truncated]'].
      result].

  registry
    name: 'status'
    description: 'Report the GemStone session: user, session id, stone, and whether there are uncommitted changes.'
    inputSchema: (self objectSchema: Dictionary new required: #())
    do: [:args |
      'user=' , System myUserProfile userId ,
      ' session=' , System session printString ,
      ' stone=' , System stoneName ,
      ' uncommittedChanges=' , System needsCommit printString].

  registry
    name: 'describe_class'
    description: 'Describe a class: superclass, instance variables, and selectors.'
    inputSchema: (self objectSchema:
        (Dictionary new at: 'className' put: (self propString: 'Name of the class'); yourself)
        required: (Array with: 'className'))
    do: [:args | | cls |
      cls := System myUserProfile objectNamed: (args at: 'className') asSymbol.
      cls isNil
        ifTrue: ['Class not found: ' , (args at: 'className')]
        ifFalse: [
          'name=' , cls name , nl ,
          'superclass=' , (cls superclass isNil ifTrue: ['nil'] ifFalse: [cls superclass name]) , nl ,
          'instVarNames=' , cls instVarNames printString , nl ,
          'selectors=' , (cls selectors asSortedCollection asArray) printString]].

  registry
    name: 'get_method_source'
    description: 'Return the source code of a method. Set meta=true for the class-side method.'
    inputSchema: (self objectSchema:
        (Dictionary new
          at: 'className' put: (self propString: 'Name of the class');
          at: 'selector' put: (self propString: 'Method selector, e.g. printOn:');
          yourself)
        required: (Array with: 'className' with: 'selector'))
    do: [:args | | cls target src |
      cls := System myUserProfile objectNamed: (args at: 'className') asSymbol.
      cls isNil
        ifTrue: ['Class not found: ' , (args at: 'className')]
        ifFalse: [
          target := ((args at: 'meta' ifAbsent: [false]) == true) ifTrue: [cls class] ifFalse: [cls].
          src := target sourceCodeAt: (args at: 'selector') asSymbol.
          src isNil
            ifTrue: ['No such method: ' , (args at: 'className') , '>>' , (args at: 'selector')]
            ifFalse: [src]]].

  registry
    name: 'compile_method'
    description: 'Compile (add or update) a method on a class, then commit. Set meta=true for class-side. category defaults to "mcp".'
    inputSchema: (self objectSchema:
        (Dictionary new
          at: 'className' put: (self propString: 'Name of the class');
          at: 'source' put: (self propString: 'Full method source including the selector line');
          at: 'category' put: (self propString: 'Method category (optional, default mcp)');
          yourself)
        required: (Array with: 'className' with: 'source'))
    do: [:args | | cls target errs |
      cls := System myUserProfile objectNamed: (args at: 'className') asSymbol.
      cls isNil
        ifTrue: ['Class not found: ' , (args at: 'className')]
        ifFalse: [
          target := ((args at: 'meta' ifAbsent: [false]) == true) ifTrue: [cls class] ifFalse: [cls].
          errs := target
            compileMethod: (args at: 'source')
            dictionaries: System myUserProfile symbolList
            category: (args at: 'category' ifAbsent: ['mcp']).
          errs isNil
            ifTrue: [System commitTransaction. 'Compiled ' , (args at: 'className') , ' and committed.']
            ifFalse: [System abortTransaction. 'Compile errors: ' , errs printString]]].
  ^self
%
