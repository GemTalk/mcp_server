set compile_env: 0
! ------------------- Class definition for McpAuthRouter
expectvalue /Class
doit
McpRouter subclass: 'McpAuthRouter'
  instVarNames: #()
  classVars: #()
  classInstVars: #( userIdClaim authorizationServers resourceMetadataUrl requiredScopes expectedAudience expectedIssuer)
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

On `initialize` the client MUST present `Authorization: Bearer <jwt>`. The router applies
RS-layer (Resource Server) checks on the token -- expiry (`exp`), and, when configured, issuer,
audience (RFC 8707) and required OAuth scopes -- then derives the GemStone userId from a
configurable JWT claim (userIdClaim, default ''sub'') and opens the worker via
McpSession>>startWithId:user:jwt:. GemStone validates the token again at login (signature against
trusted keys + the user''s JwtSecurityData), so the RS checks are belt-and-suspenders for MCP
conformance, not the sole gate -- a tampered claim still fails the login regardless. A
missing/expired/untrusted/wrong-audience token yields HTTP 401 (`invalid_token`); a token lacking
a required scope yields HTTP 403 (`insufficient_scope`). Once initialize succeeds, the
(unguessable) MCP-Session-Id carries authorization on later requests, exactly as in the base class.

Serves a `WWW-Authenticate: Bearer` challenge (with `error`/`error_description`/`scope` and, when
set, `resource_metadata`) on 401/403, and RFC 9728 Protected Resource Metadata at
`/.well-known/oauth-protected-resource`. Config is class-side (commit to persist): userIdClaim,
requiredScopes (default empty -> no scope check), expectedAudience / expectedIssuer (default nil ->
skip that check), authorizationServers, resourceMetadataUrl. Deferred (see
~/.claude/plans/step4-authorization-evaluation.md): a real OIDC IdP (authorizationServers stays
empty and keys are ad-hoc until then).'
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
category: 'validation'
classmethod: McpAuthRouter
expectedAudience
  "The resource identifier this server's tokens must be bound to (RFC 8707): the token's `aud`
   claim must include this value. nil (default) skips the audience check -- rely on GemStone's
   JwtSecurityData audience match. Set to this server's canonical URL once fixed. Commit to persist."
  ^expectedAudience
%
category: 'validation'
classmethod: McpAuthRouter
expectedAudience: aStringOrNil
  expectedAudience := aStringOrNil
%
category: 'validation'
classmethod: McpAuthRouter
expectedIssuer
  "The issuer (`iss`) this server trusts to mint tokens. nil (default) skips the RS-layer issuer
   check -- rely on GemStone's JwtSecurityData issuer match. Set to the IdP's issuer URL in
   production. Commit to persist."
  ^expectedIssuer
%
category: 'validation'
classmethod: McpAuthRouter
expectedIssuer: aStringOrNil
  expectedIssuer := aStringOrNil
%
category: 'validation'
classmethod: McpAuthRouter
requiredScopes
  "Array of OAuth scope strings a token MUST carry (in its space-delimited `scope` claim, or `scp`
   array) to initialize. Empty (default) requires no scope. A token missing any of these yields
   HTTP 403 insufficient_scope. Set via requiredScopes: (commit to persist)."
  ^requiredScopes ifNil: [requiredScopes := #()]
%
category: 'validation'
classmethod: McpAuthRouter
requiredScopes: anArrayOfScopeStrings
  requiredScopes := anArrayOfScopeStrings
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
category: 'validation'
method: McpAuthRouter
payload: payload hasAudience: expected
  "Whether the token's `aud` claim (a String or Array of Strings, RFC 7519) includes expected."
  | aud |
  aud := payload at: 'aud' ifAbsent: [nil].
  aud isNil ifTrue: [^false].
  (aud isKindOf: Array) ifTrue: [^aud includes: expected].
  ^aud = expected
%
category: 'validation'
method: McpAuthRouter
rejectionForPayload: payload
  "The claim checks behind tokenRejectionFor:, factored out to run on a decoded payload Dictionary
   (keys are String/Symbol-interchangeable). Answers nil (accept) or { httpCode. errorCode. desc }.
   exp is always enforced; issuer/audience only when configured; scopes only when requiredScopes is
   non-empty."
  | exp |
  exp := payload at: 'exp' ifAbsent: [nil].
  (exp notNil and: [exp < System timeGmt])
    ifTrue: [^Array with: 401 with: 'invalid_token' with: 'Token expired'].
  self class expectedIssuer ifNotNil: [:iss |
    (payload at: 'iss' ifAbsent: [nil]) = iss
      ifFalse: [^Array with: 401 with: 'invalid_token' with: 'Untrusted token issuer']].
  self class expectedAudience ifNotNil: [:aud |
    (self payload: payload hasAudience: aud)
      ifFalse: [^Array with: 401 with: 'invalid_token' with: 'Token audience does not include this resource']].
  self class requiredScopes isEmpty ifFalse: [ | granted missing |
    granted := self scopesOf: payload.
    missing := self class requiredScopes reject: [:s | granted includes: s].
    missing isEmpty ifFalse: [
      ^Array with: 403 with: 'insufficient_scope'
        with: 'Token missing required scope(s): ' , (self spaceSeparated: missing)]].
  ^nil
%
category: 'validation'
method: McpAuthRouter
scopesOf: payload
  "The scopes a token grants: the space-delimited OAuth `scope` claim (RFC 8693), or an `scp`
   array (some IdPs), as an Array of Strings. Empty if neither is present."
  | s |
  s := payload at: 'scope' ifAbsent: [nil].
  (s isKindOf: String) ifTrue: [^s subStrings: ' '].
  s := payload at: 'scp' ifAbsent: [nil].
  (s isKindOf: Array) ifTrue: [^s].
  ^#()
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
   Order: (1) no token -> 401; (2) RS-layer checks (exp/issuer/audience -> 401 invalid_token,
   missing scope -> 403 insufficient_scope); (3) userId claim missing -> 401; (4) GemStone login
   (signature + JwtSecurityData) fails -> 401. On success the worker runs as the JWT's GemStone
   user and the MCP-Session-Id is returned as usual."
  | token rejection userId sess |
  token := self bearerTokenOf: req.
  token isNil ifTrue: [^self writeAuthError: 401 oauthError: nil
    description: 'Missing or malformed Authorization: Bearer token' on: conn].
  rejection := self tokenRejectionFor: token.
  rejection ifNotNil: [^self writeAuthError: (rejection at: 1) oauthError: (rejection at: 2)
    description: (rejection at: 3) on: conn].
  userId := self userIdFromToken: token.
  userId isNil ifTrue: [^self writeAuthError: 401 oauthError: 'invalid_token'
    description: 'Token has no ' , self class userIdClaim , ' claim' on: conn].
  sess := [self openSessionForUser: userId jwt: token]
    on: Error
    do: [:e |
      self log: 'McpAuthRouter login failed for ' , userId printString , ': '
        , ([e description] on: Error do: [:x | e class name asString]).
      nil].
  sess isNil ifTrue: [^self writeAuthError: 401 oauthError: 'invalid_token'
    description: 'Authentication failed' on: conn].
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
category: 'validation'
method: McpAuthRouter
spaceSeparated: aCollectionOfStrings
  "Join strings with single spaces (for the scope list in messages / the WWW-Authenticate scope=)."
  ^aCollectionOfStrings inject: '' into: [:acc :s | acc isEmpty ifTrue: [s] ifFalse: [acc , ' ' , s]]
%
category: 'validation'
method: McpAuthRouter
tokenRejectionFor: aJwtString
  "RS-layer validation of the bearer token BEFORE attempting a GemStone login. Answers nil if the
   token passes, else an Array { httpCode. oauthErrorCode. description } naming the failure. Parses
   the token WITHOUT verifying its signature (GemStone re-verifies at login); this layer enforces
   the OAuth claims GemStone does not model (notably scopes) plus standard hygiene (exp) and, when
   configured, issuer/audience per RFC 8707."
  | payload |
  payload := [(JsonWebToken fromJwtString: aJwtString) instVarNamed: #payload]
    on: Error do: [:e | nil].
  payload isNil ifTrue: [^Array with: 401 with: 'invalid_token' with: 'Malformed bearer token'].
  ^self rejectionForPayload: payload
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
writeAuthError: httpCode oauthError: errorCodeOrNil description: aMessage on: conn
  "Write an auth failure: HTTP httpCode (401 Unauthorized or 403 Forbidden) with an RFC 6750
   `WWW-Authenticate: Bearer` challenge and a JSON-RPC -32600 error body for humans. The challenge
   carries auth-params (comma-separated) when present: error (errorCodeOrNil, e.g. invalid_token /
   insufficient_scope -- nil for a plain missing-token challenge), error_description, scope (when
   refusing for insufficient scope), and resource_metadata (RFC 9728) when a resourceMetadataUrl is
   configured."
  | crlf params challenge reason err |
  crlf := String with: Character cr with: Character lf.
  params := OrderedCollection new.
  errorCodeOrNil ifNotNil: [:e |
    params add: 'error="' , e , '"'.
    "error_description is only meaningful alongside an error code (RFC 6750 3.1); a plain
     missing-token challenge carries neither and just invites the client to authenticate."
    aMessage ifNotNil: [:m | params add: 'error_description="' , m , '"']].
  (errorCodeOrNil = 'insufficient_scope' and: [self class requiredScopes isEmpty not])
    ifTrue: [params add: 'scope="' , (self spaceSeparated: self class requiredScopes) , '"'].
  self class resourceMetadataUrl ifNotNil: [:u | params add: 'resource_metadata="' , u , '"'].
  challenge := 'WWW-Authenticate: Bearer'.
  params isEmpty ifFalse: [challenge := challenge , ' ' , (params inject: '' into: [:acc :p |
    acc isEmpty ifTrue: [p] ifFalse: [acc , ', ' , p]])].
  reason := httpCode = 403 ifTrue: ['Forbidden'] ifFalse: ['Unauthorized'].
  err := Dictionary new.
  err at: 'jsonrpc' put: '2.0'; at: 'id' put: nil.
  err at: 'error' put: (Dictionary new at: 'code' put: -32600; at: 'message' put: aMessage; yourself).
  conn writeStatus: httpCode reason: reason headers: challenge , crlf body: err asJson
%
