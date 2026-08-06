"
One MCP client's isolated worker: a GsTsExternalSession gem (its own transaction view) plus the
client's session id, last-activity time, and (future) userId. The front end (McpRouter) keeps
an id -> McpSession map and routes each request through #forward:, which runs it in this worker
via a BLOCKING executeString: -- reliable; forwarding is serialized (true cross-client concurrency
is a deferred follow-up). Idle sessions are reaped after a timeout. Workers log in as the current
user for now; userId is reserved for later per-user auth.
"
Class {
	#name : 'McpSession',
	#superclass : 'Object',
	#instVars : [
		'id',
		'worker',
		'lastActivitySeconds',
		'userId'
	],
	#category : 'Mcp-Core'
}

{ #category : 'instance creation' }
McpSession class >> startWithId: anId [
  "Spawn a worker gem (current user, one-time password) and answer a started session with the
   given client id."
  ^self new startWithId: anId

]

{ #category : 'instance creation' }
McpSession class >> startWithId: anId readOnly: aBoolean [
  "As startWithId:, but marks the local worker read-only when aBoolean (a read-only McpRouter -- a
   localhost convenience so a single user cannot accidentally mutate)."
  ^self new startWithId: anId readOnly: aBoolean

]

{ #category : 'instance creation' }
McpSession class >> startWithId: anId user: aUserId jwt: aJwtString [
  "Spawn a JWT-authenticated worker gem for aUserId and answer a started session with the given
   client id. See the instance-side method."
  ^self new startWithId: anId user: aUserId jwt: aJwtString

]

{ #category : 'instance creation' }
McpSession class >> startWithId: anId user: aUserId jwt: aJwtString readOnly: aBoolean [
  "As startWithId:user:jwt:, but marks the worker read-only when aBoolean is true (the token lacked
   the configured write scope -- see McpAuthRouter writeScope)."
  ^self new startWithId: anId user: aUserId jwt: aJwtString readOnly: aBoolean

]

{ #category : 'lifecycle' }
McpSession >> close [
  "Terminate the worker gem. It is attached (the front end drives it via executeString:), so a
   logout stops it."
  [worker logout] on: Error do: [:e | nil].
  ^self

]

{ #category : 'routing' }
McpSession >> forward: aRawJsonString [
  "Run a JSON-RPC request in this client's worker gem (an isolated session) and answer the JSON
   response string ('' for a notification). BLOCKING executeString: -- reliable; forwarding is
   serialized (concurrency deferred). The request is embedded via printString for safe quoting."
  self touch.
  ^worker executeString: 'McpServer handleJsonString: ' , aRawJsonString printString

]

{ #category : 'accessing' }
McpSession >> id [
  ^id

]

{ #category : 'activity' }
McpSession >> idleSeconds [
  ^System timeGmt - lastActivitySeconds

]

{ #category : 'accessing' }
McpSession >> lastActivitySeconds [
  ^lastActivitySeconds

]

{ #category : 'initialization' }
McpSession >> newWorkerSession [
  "A fresh, not-yet-logged-in GsTsExternalSession worker gem on localhost. GsTsExternalSession is
   assumed present -- it exists in every supported image (GemStone 3.6.2+)."
  ^GsTsExternalSession newDefaultForGemHost: 'localhost'

]

{ #category : 'initialization' }
McpSession >> startWithId: anId [
  "Local worker login with full read-write access (see the readOnly: variant)."
  ^self startWithId: anId readOnly: false

]

{ #category : 'initialization' }
McpSession >> startWithId: anId readOnly: aBoolean [
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

]

{ #category : 'initialization' }
McpSession >> startWithId: anId user: aUserId jwt: aJwtString [
  "JWT worker login with full read-write access (see the readOnly: variant)."
  ^self startWithId: anId user: aUserId jwt: aJwtString readOnly: false

]

{ #category : 'initialization' }
McpSession >> startWithId: anId user: aUserId jwt: aJwtString readOnly: aBoolean [
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

]

{ #category : 'activity' }
McpSession >> touch [
  "Record now (GMT seconds) as the last activity, for idle-timeout reaping."
  lastActivitySeconds := System timeGmt.
  ^self

]

{ #category : 'accessing' }
McpSession >> userId [
  ^userId

]
