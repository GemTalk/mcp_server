set compile_env: 0
! ------------------- Class definition for GsMcpSession
expectvalue /Class
doit
Object subclass: 'GsMcpSession'
  instVarNames: #( id worker lastActivitySeconds userId)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()
%
expectvalue /Class
doit
GsMcpSession comment:
'One MCP client''s isolated worker: a GsTsExternalSession gem (its own transaction view) plus the
client''s session id, last-activity time, and (future) userId. The front end (GsMcpRouter) keeps
an id -> GsMcpSession map and routes each request through #forward:, which runs it in this worker
via a BLOCKING executeString: -- reliable; forwarding is serialized (true cross-client concurrency
is a deferred follow-up). Idle sessions are reaped after a timeout. Workers log in as the current
user for now; userId is reserved for later per-user auth.'
%
expectvalue /Class
doit
GsMcpSession category: 'GsMcp'
%
! ------------------- Remove existing behavior from GsMcpSession
removeallmethods GsMcpSession
removeallclassmethods GsMcpSession
! ------------------- Class methods for GsMcpSession
category: 'instance creation'
classmethod: GsMcpSession
startWithId: anId
  "Spawn a worker gem (current user, one-time password) and answer a started session with the
   given client id."
  ^self new startWithId: anId
%
! ------------------- Instance methods for GsMcpSession
category: 'lifecycle'
method: GsMcpSession
close
  "Terminate the worker gem. It is attached (the front end drives it via executeString:), so a
   logout stops it."
  [worker logout] on: Error do: [:e | nil].
  ^self
%
category: 'accessing'
method: GsMcpSession
id
  ^id
%
category: 'activity'
method: GsMcpSession
idleSeconds
  ^System timeGmt - lastActivitySeconds
%
category: 'routing'
method: GsMcpSession
forward: aRawJsonString
  "Run a JSON-RPC request in this client's worker gem (an isolated session) and answer the JSON
   response string ('' for a notification). BLOCKING executeString: -- reliable; forwarding is
   serialized (concurrency deferred). The request is embedded via printString for safe quoting."
  self touch.
  ^worker executeString: 'GsMcpServer handleJsonString: ' , aRawJsonString printString
%
category: 'accessing'
method: GsMcpSession
lastActivitySeconds
  ^lastActivitySeconds
%
category: 'initialization'
method: GsMcpSession
startWithId: anId
  "Log in a fresh worker gem for this client. Uses GsTsExternalSession (looked up dynamically so
   this class compiles on images without it); same user as the server, one-time password."
  | extClass |
  extClass := System myUserProfile objectNamed: #GsTsExternalSession.
  extClass isNil ifTrue: [^self error: 'GsTsExternalSession is not available in this image'].
  id := anId.
  userId := System myUserProfile userId.
  worker := extClass newDefaultForGemHost: 'localhost'.
  worker useOnetimePassword.
  worker login.
  self touch.
  ^self
%
category: 'activity'
method: GsMcpSession
touch
  "Record now (GMT seconds) as the last activity, for idle-timeout reaping."
  lastActivitySeconds := System timeGmt.
  ^self
%
category: 'accessing'
method: GsMcpSession
userId
  ^userId
%
