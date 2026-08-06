set compile_env: 0
! ------------------- Class definition for McpSession
expectvalue /Class
doit
Object subclass: 'McpSession'
  instVarNames: #( id worker lastActivitySeconds
                    userId)
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
McpSession category: 'MCPServer'
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
  ^worker executeString: 'McpServer handleJsonString: ' , aRawJsonString printString
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
  aBoolean ifTrue: [worker executeString: 'McpServer sessionReadOnly: true'].
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
  aBoolean ifTrue: [worker executeString: 'McpServer sessionReadOnly: true'].
  self touch.
  ^self
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
