set compile_env: 0
! ------------------- Class definition for McpSession
expectvalue /Class
doit
Object subclass: 'McpSession'
  instVarNames: #( id worker lastActivitySeconds
                    userId readOnly workerClassName toolsetNames
                    serverName serverVersion)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpSession comment: 
'One MCP client''s isolated worker: a GsTsExternalSession gem (its own transaction view) plus the
client''s session id, last-activity time, and (future) userId. The front end (McpRouter) keeps
an id -> McpSession map and routes each request through #forward:, which runs it in this worker
via a BLOCKING executeString: -- reliable; forwarding is serialized (true cross-client concurrency
is a deferred follow-up). Idle sessions are reaped after a timeout. Workers log in as the current
user for now; userId is reserved for later per-user auth.'
%
expectvalue /Class
doit
McpSession category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpSession
removeallmethods McpSession
removeallclassmethods McpSession
! ------------------- Class methods for McpSession
category: 'instance creation'
classmethod: McpSession
startWithId: anId
  "Spawn a worker gem (current user, one-time password) and answer a started session with the
   given client id."
  ^self new startWithId: anId
%
category: 'instance creation'
classmethod: McpSession
startWithId: anId readOnly: aBoolean
  "As startWithId:, but marks the local worker read-only when aBoolean (a read-only McpRouter -- a
   localhost convenience so a single user cannot accidentally mutate)."
  ^self new startWithId: anId readOnly: aBoolean
%
category: 'instance creation'
classmethod: McpSession
startWithId: anId user: aUserId jwt: aJwtString
  "Spawn a JWT-authenticated worker gem for aUserId and answer a started session with the given
   client id. See the instance-side method."
  ^self new startWithId: anId user: aUserId jwt: aJwtString
%
category: 'instance creation'
classmethod: McpSession
startWithId: anId user: aUserId jwt: aJwtString readOnly: aBoolean
  "As startWithId:user:jwt:, but marks the worker read-only when aBoolean is true (the token lacked
   the configured write scope -- see McpAuthRouter writeScope)."
  ^self new startWithId: anId user: aUserId jwt: aJwtString readOnly: aBoolean
%
! ------------------- Instance methods for McpSession
category: 'lifecycle'
method: McpSession
close
  "Terminate the worker gem. It is attached (the front end drives it via executeString:), so a
   logout stops it."
  [worker logout] on: Error do: [:e | nil].
  ^self
%
category: 'routing'
method: McpSession
forward: aRawJsonString
  "Run a JSON-RPC request in this client's worker gem (an isolated session) and answer the JSON
   response string ('' for a notification). BLOCKING executeString: -- reliable; forwarding is
   serialized (concurrency deferred). The request is embedded via printString for safe quoting."
  self touch.
  ^worker executeString: (self workerExpressionFor: aRawJsonString)
%
category: 'accessing'
method: McpSession
id
  ^id
%
category: 'activity'
method: McpSession
idleSeconds
  ^System timeGmt - lastActivitySeconds
%
category: 'accessing'
method: McpSession
lastActivitySeconds
  ^lastActivitySeconds
%
category: 'initialization'
method: McpSession
newWorkerSession
  "A fresh, not-yet-logged-in GsTsExternalSession worker gem on localhost. GsTsExternalSession is
   assumed present -- it exists in every supported image (GemStone 3.6.2+)."
  ^GsTsExternalSession newDefaultForGemHost: 'localhost'
%
category: 'initialization'
method: McpSession
prepareWorker
  "Prepare this client's worker gem in ONE call, before any request reaches it: set read-only, resolve
   the named toolsets, apply the advertised identity, and pre-build the server instance. The front end
   calls this after configuring the session (McpRouter>>openSessionCreating:) and BEFORE the session is
   registered, so there is no window in which a request could run unprepared.
   One round trip replaces the conditional 'sessionReadOnly:' send this used to make, and it moves tool
   registration off the client's first request. A worker class or toolset the worker cannot resolve
   fails HERE, where the message can say what to fix -- see McpServer class>>toolsetClassNamed:."
  ^[worker executeString: self workerBootstrapExpression]
    on: Error
    do: [:ex | self error: 'Could not prepare the MCP worker gem for session ' , id printString
      , ' (worker class ' , self workerClassName , '): '
      , ([ex description] on: Error do: [:x | ex class name asString])]
%
category: 'private'
method: McpSession
quotedNameArrayFor: aCollectionOfNames
  "aCollectionOfNames as a Smalltalk literal array of strings, e.g. #('McpBrowsingToolset' ) -- for
   embedding in the worker bootstrap expression. Empty answers #(), which legitimately means a worker
   with no tools at all."
  | s |
  s := WriteStream on: String new.
  s nextPutAll: '#('.
  (aCollectionOfNames ifNil: [#()]) do: [:n |
    s nextPutAll: n asString printString; nextPut: Character space].
  s nextPut: $).
  ^s contents
%
category: 'accessing'
method: McpSession
readOnly
  "Whether this client's worker is read-only. Recorded when the session starts and applied to the
   worker gem by prepareWorker."
  ^readOnly == true
%
category: 'accessing'
method: McpSession
serverName: aStringOrNil
  "The serverInfo name this worker should advertise (nil = the worker's own default)."
  serverName := aStringOrNil
%
category: 'accessing'
method: McpSession
serverVersion: aStringOrNil
  serverVersion := aStringOrNil
%
category: 'initialization'
method: McpSession
startWithId: anId
  "Local worker login with full read-write access (see the readOnly: variant)."
  ^self startWithId: anId readOnly: false
%
category: 'initialization'
method: McpSession
startWithId: anId readOnly: aBoolean
  "Log in a fresh worker gem as the current (server) user via a one-time password (the local,
   unauthenticated front end, McpRouter). When aBoolean, mark the worker read-only for its whole
   life -- set inside the worker gem itself, so it needs no commit and is private to that gem."
  id := anId.
  userId := System myUserProfile userId.
  worker := self newWorkerSession.
  worker useOnetimePassword.
  worker login.
  readOnly := aBoolean.
  self touch.
  ^self
%
category: 'initialization'
method: McpSession
startWithId: anId user: aUserId jwt: aJwtString
  "JWT worker login with full read-write access (see the readOnly: variant)."
  ^self startWithId: anId user: aUserId jwt: aJwtString readOnly: false
%
category: 'initialization'
method: McpSession
startWithId: anId user: aUserId jwt: aJwtString readOnly: aBoolean
  "Log in a fresh worker gem authenticated by a JWT (an OAuth/OIDC access token), for the
   network-facing authenticated front end (McpAuthRouter). The caller has already validated the
   token and derived aUserId from its claims; GemStone re-validates the JWT's signature (against its
   trusted keys) and claims when the worker logs in -- a bad/expired token fails the login. When
   aBoolean is true the worker is marked read-only for its whole life (its token lacked the write
   scope) -- set inside the worker gem itself, so it needs no commit and cannot affect other sessions."
  id := anId.
  userId := aUserId.
  worker := self newWorkerSession.
  worker username: aUserId.
  worker jwtPassword: aJwtString.
  worker login.
  readOnly := aBoolean.
  self touch.
  ^self
%
category: 'accessing'
method: McpSession
toolsetNames: aCollectionOfNamesOrNil
  "The toolsets this worker should register, as resolved by the front end
   (McpRouter>>effectiveToolsetNames)."
  toolsetNames := aCollectionOfNamesOrNil
%
category: 'activity'
method: McpSession
touch
  "Record now (GMT seconds) as the last activity, for idle-timeout reaping."
  lastActivitySeconds := System timeGmt.
  ^self
%
category: 'accessing'
method: McpSession
userId
  ^userId
%
category: 'private'
method: McpSession
workerBootstrapExpression
  "The one expression prepareWorker runs in the worker gem. Sent to the worker CLASS the front end
   named, so the worker instantiates what it is told rather than choosing for itself. Names are plain
   identifiers (McpRouter validated them when the router was configured) and the strings are embedded
   via printString, so this cannot smuggle anything into the worker's compiler."
  ^self workerClassName
    , ' prepareWorkerWithToolsets: ' , (self quotedNameArrayFor: toolsetNames)
    , ' readOnly: ' , self readOnly printString
    , ' serverName: ' , (serverName isNil ifTrue: ['nil'] ifFalse: [serverName printString])
    , ' version: ' , (serverVersion isNil ifTrue: ['nil'] ifFalse: [serverVersion printString])
%
category: 'accessing'
method: McpSession
workerClassName
  "The class this session's worker instantiates and dispatches through. Set by the front end
   (McpRouter>>effectiveWorkerClassName); McpServer when nothing is configured, which also keeps a
   directly-created session usable."
  ^workerClassName ifNil: ['McpServer']
%
category: 'accessing'
method: McpSession
workerClassName: aNameOrNil
  workerClassName := aNameOrNil
%
category: 'routing'
method: McpSession
workerExpressionFor: aRawJsonString
  "The expression forward: runs in the worker gem: the NAMED worker class handles the request, so the
   worker never decides which server class to build. The request body is embedded via printString for
   safe quoting."
  ^self workerClassName , ' handleJsonString: ' , aRawJsonString printString
%
