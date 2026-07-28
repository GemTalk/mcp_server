set compile_env: 0
! ------------------- Class definition for McpAuthRouter
expectvalue /Class
doit
McpRouter subclass: 'McpAuthRouter'
  instVarNames: #()
  classVars: #()
  classInstVars: #( userIdClaim authorizationServers resourceMetadataUrl)
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpAuthRouter comment: 
'A network-facing McpRouter that REQUIRES OAuth/OIDC bearer-token authentication and gives each
client a worker gem logged in as its own GemStone user (via JWT). Use this instead of the base
McpRouter for a port reachable beyond localhost.

On `initialize` the client MUST present `Authorization: Bearer <jwt>`. The router derives the
GemStone userId from a configurable JWT claim (userIdClaim, default ''sub'') and opens the worker
via McpSession>>startWithId:user:jwt:. GemStone validates the token at login (signature against
trusted keys + the user''s JwtSecurityData); a missing/failed token yields HTTP 401. Once
initialize succeeds, the (unguessable) MCP-Session-Id carries authorization on later requests,
exactly as in the base class.

Serves a `WWW-Authenticate: Bearer` challenge on 401 and RFC 9728 Protected Resource Metadata at
`/.well-known/oauth-protected-resource`. Deferred (see
~/.claude/plans/step4-authorization-evaluation.md): TLS transport (add before real network
exposure), RS-layer token pre-validation / scopes, and a real OIDC IdP (authorizationServers stays
empty until then). Relies on GemStone''s own login-time validation, which is enough to prevent
impersonation -- a tampered claim just fails the login.'
%
expectvalue /Class
doit
McpAuthRouter category: 'MCPServer'
%
! ------------------- Remove existing behavior from McpAuthRouter
removeallmethods McpAuthRouter
removeallclassmethods McpAuthRouter
! ------------------- Class methods for McpAuthRouter
category: 'metadata'
classmethod: McpAuthRouter
authorizationServers
  "Array of OAuth Authorization Server issuer URLs advertised in Protected Resource Metadata.
   Empty until a real IdP is configured (Step 4e); set via authorizationServers: (commit to persist)."
  ^authorizationServers ifNil: [authorizationServers := #()]
%
category: 'metadata'
classmethod: McpAuthRouter
authorizationServers: anArrayOfUrls
  authorizationServers := anArrayOfUrls
%
category: 'metadata'
classmethod: McpAuthRouter
resourceMetadataUrl
  "Absolute URL of this server's Protected Resource Metadata document, advertised in the
   `WWW-Authenticate: Bearer resource_metadata=...` challenge. nil (default) omits it. Set once a
   real external URL exists."
  ^resourceMetadataUrl
%
category: 'metadata'
classmethod: McpAuthRouter
resourceMetadataUrl: aStringOrNil
  resourceMetadataUrl := aStringOrNil
%
category: 'userId claim'
classmethod: McpAuthRouter
userIdClaim
  "The JWT payload claim whose value is the GemStone userId to log in as. Must match the userIdKey
   configured in each user's JwtSecurityData on the GemStone side. Defaults to the OIDC subject
   claim; set via userIdClaim: (commit to persist)."
  ^userIdClaim ifNil: [userIdClaim := 'sub']
%
category: 'userId claim'
classmethod: McpAuthRouter
userIdClaim: aString
  "Set the JWT claim read for the GemStone userId."
  userIdClaim := aString
%
! ------------------- Instance methods for McpAuthRouter
category: 'auth'
method: McpAuthRouter
bearerTokenOf: req
  "The <jwt> from an `Authorization: Bearer <jwt>` request header (header keys are lower-cased by
   parseHead:), or nil if absent or not a non-empty Bearer credential."
  | auth prefix |
  auth := (req at: 'headers' ifAbsent: [Dictionary new]) at: 'authorization' ifAbsent: [nil].
  auth isNil ifTrue: [^nil].
  prefix := 'Bearer '.
  (auth size > prefix size and: [(auth copyFrom: 1 to: prefix size) asLowercase = prefix asLowercase])
    ifFalse: [^nil].
  ^(auth copyFrom: prefix size + 1 to: auth size) trimSeparators
%
category: 'sessions'
method: McpAuthRouter
openSessionForUser: aUserId jwt: aJwtString
  "Open + register a worker session logged in as aUserId, authenticated by the JWT."
  ^self openSessionCreating: [:newId | McpSession startWithId: newId user: aUserId jwt: aJwtString]
%
category: 'routing'
method: McpAuthRouter
serveGet: req on: conn
  "GET /.well-known/oauth-protected-resource -> Protected Resource Metadata (unauthenticated; it's
   a discovery endpoint). Any other GET falls through to the inherited SSE stream."
  (req at: 'path' ifAbsent: ['']) = '/.well-known/oauth-protected-resource'
    ifTrue: [^self serveProtectedResourceMetadata: req on: conn].
  ^super serveGet: req on: conn
%
category: 'routing'
method: McpAuthRouter
serveInitialize: req on: conn
  "Authenticate the initialize request via its bearer JWT, then open a per-user worker session.
   Missing token, missing userId claim, or a login GemStone rejects -> HTTP 401. On success the
   worker runs as the JWT's GemStone user and the MCP-Session-Id is returned as usual."
  | token userId sess |
  token := self bearerTokenOf: req.
  token isNil ifTrue: [^self writeUnauthorized: 'Missing or malformed Authorization: Bearer token' on: conn].
  userId := self userIdFromToken: token.
  userId isNil ifTrue: [^self writeUnauthorized: 'Token has no ' , self class userIdClaim , ' claim' on: conn].
  sess := [self openSessionForUser: userId jwt: token]
    on: Error
    do: [:e |
      self log: 'McpAuthRouter login failed for ' , userId printString , ': '
        , ([e description] on: Error do: [:x | e class name asString]).
      nil].
  sess isNil ifTrue: [^self writeUnauthorized: 'Authentication failed' on: conn].
  conn writeJson: (sess forward: (req at: 'body' ifAbsent: [''])) sessionId: sess id
%
category: 'routing'
method: McpAuthRouter
serveProtectedResourceMetadata: req on: conn
  "RFC 9728 Protected Resource Metadata: advertise this resource + its authorization server(s) so a
   compliant MCP client can discover where to obtain a token. authorization_servers is empty until
   an IdP is configured (Step 4e); `resource` is derived from the Host header until a fixed
   identifier / TLS scheme is set."
  | host meta |
  host := (req at: 'headers' ifAbsent: [Dictionary new]) at: 'host' ifAbsent: ['127.0.0.1'].
  meta := Dictionary new.
  meta at: 'resource' put: 'http://' , host , '/mcp'.
  meta at: 'authorization_servers' put: self class authorizationServers asArray.
  meta at: 'bearer_methods_supported' put: (Array with: 'header').
  conn writeStatus: 200 reason: 'OK' body: meta asJson
%
category: 'auth'
method: McpAuthRouter
userIdFromToken: aJwtString
  "The GemStone userId claimed by the token: the userIdClaim value from the JWT payload, or nil if
   the token can't be parsed or lacks the claim. This is an UNVERIFIED parse used only to choose
   which user to log in as -- GemStone re-validates the token's signature + claims at login, so a
   tampered claim simply fails authentication."
  ^[ | payload |
     payload := (JsonWebToken fromJwtString: aJwtString) instVarNamed: #payload.
     payload at: self class userIdClaim asSymbol ifAbsent: [nil] ]
   on: Error do: [:e | nil]
%
category: 'auth'
method: McpAuthRouter
writeUnauthorized: aMessage on: conn
  "HTTP 401 with a `WWW-Authenticate: Bearer` challenge (adding resource_metadata=... when a
   resourceMetadataUrl is configured, per RFC 9728) and a JSON-RPC -32600 error body for humans."
  | err crlf challenge |
  crlf := String with: Character cr with: Character lf.
  challenge := 'WWW-Authenticate: Bearer'.
  self class resourceMetadataUrl ifNotNil: [:u | challenge := challenge , ' resource_metadata="' , u , '"'].
  err := Dictionary new.
  err at: 'jsonrpc' put: '2.0'; at: 'id' put: nil.
  err at: 'error' put: (Dictionary new at: 'code' put: -32600; at: 'message' put: aMessage; yourself).
  conn writeStatus: 401 reason: 'Unauthorized' headers: challenge , crlf body: err asJson
%
