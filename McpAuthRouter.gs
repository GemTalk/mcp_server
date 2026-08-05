set compile_env: 0
! ------------------- Class definition for McpAuthRouter
expectvalue /Class
doit
McpRouter subclass: 'McpAuthRouter'
  instVarNames: #( userIdClaim authorizationServers resourceMetadataUrl
                    requiredScopes expectedAudience expectedIssuer writeScope
                    bindAddress)
  classVars: #()
  classInstVars: #()
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

EVERY request MUST present `Authorization: Bearer <jwt>` -- not just `initialize`. The gate is
requestAuthorized:on- (the McpRouter hook), which verifies the token''s SIGNATURE against the Stone''s
trusted JWT keys, then applies the RS-layer (Resource Server) claim checks: expiry (`exp`, required),
and, when configured, issuer, audience (RFC 8707) and required OAuth scopes. A request naming an
existing session must also present a token belonging to that session''s user. The single exception is
the Protected Resource Metadata endpoint, which is unauthenticated by design -- it is what a client
reads in order to learn how to authenticate.
On `initialize` the router additionally derives the GemStone userId from a configurable JWT claim
(userIdClaim, default ''sub'') and opens the worker via McpSession>>startWithId:user:jwt:; GemStone
validates the token once more at login (signature + the user''s JwtSecurityData). A
missing/malformed/forged/expired/untrusted/wrong-audience token yields HTTP 401 (`invalid_token`); a
token lacking a required scope yields HTTP 403 (`insufficient_scope`).
The MCP-Session-Id is NOT a credential. It once was -- initialize alone was authenticated and the id
admitted every later request -- which meant an expired or revoked token kept working for as long as
the session was kept alive, and the GET stream and DELETE needed no credential at all.

Serves a `WWW-Authenticate: Bearer` challenge (with `error`/`error_description`/`scope`/
`resource_metadata`) on 401/403, and RFC 9728 Protected Resource Metadata at BOTH
`/.well-known/oauth-protected-resource` and the path-scoped form implied by the resource identifier
(a client probes the latter first). Config is per-instance (set on the router via the setters, no
committed class state; forkOnPort: serializes it into the child gem''s fork string): expectedAudience
(REQUIRED -- the canonical resource identifier, also published as `resource` and used to derive the
metadata URL), authorizationServers (REQUIRED, https), userIdClaim (default ''sub''), requiredScopes
(default empty -> no scope check, also published as `scopes_supported`), expectedIssuer (default nil
-> skip that check), resourceMetadataUrl (derived unless overridden), writeScope, bindAddress, and the
inherited readOnly. Configure a router and fork it, e.g. via run-auth-server.sh.

THREE INVARIANTS distinguish this class from its superclass, and all are enforced in code rather
than by a launch script, because runOnPort:/forkOnPort: can be called directly:
 * bindAddress IS configurable here (McpRouter answers loopback with no setter), because every
   request must present a valid bearer token. Seeded to loopback all the same -- reachability is
   something the caller asks for.
 * TLS is MANDATORY: runOnPort: and forkOnPort: signal unless a certificate and UNENCRYPTED private
   key are set (see requireTls). A bearer token is a password that travels in a header on every
   request, so cleartext is never appropriate -- not even on loopback, since a router that is safe
   today becomes unsafe the moment its bind address is widened.
 * THE RESOURCE-SERVER CONFIG IS MANDATORY: runOnPort:/forkOnPort: also signal unless an
   expectedAudience and at least one https authorization server are set (see
   requireResourceServerConfig). The MCP authorization spec makes audience validation and naming an
   authorization server MUSTs, so they cannot be optional settings that happen to default to off --
   an unconfigured router would accept a token minted for any resource and publish a metadata
   document naming nowhere to get one.

    (McpAuthRouter new
        useTlsCertificateFile: ''/path/server.crt'' privateKeyFile: ''/path/server.key'';
        expectedAudience: ''https://mcp.example.com:8443/mcp'';
        authorizationServers: #( ''https://idp.example.com/realms/gs-mcp'' );
        bindAddress: ''172.16.73.10'';
        yourself) forkOnPort: 8443

Conformance status: see McpAuthConformanceTest, one test per normative requirement, scored by
./run-conformance.sh.'
%
expectvalue /Class
doit
McpAuthRouter category: 'MCPServer'
%
! ------------------- Remove existing behavior from McpAuthRouter
removeallmethods McpAuthRouter
removeallclassmethods McpAuthRouter
! ------------------- Class methods for McpAuthRouter
! ------------------- Instance methods for McpAuthRouter
category: 'config'
method: McpAuthRouter
applyConfig: aConfigDict
  "Apply the base + RS-layer config from a parsed config Dictionary (absent key -> keep the seeded
   default)."
  super applyConfig: aConfigDict.
  userIdClaim := aConfigDict at: 'userIdClaim' ifAbsent: [userIdClaim].
  authorizationServers := aConfigDict at: 'authorizationServers' ifAbsent: [authorizationServers].
  resourceMetadataUrl := aConfigDict at: 'resourceMetadataUrl' ifAbsent: [resourceMetadataUrl].
  requiredScopes := aConfigDict at: 'requiredScopes' ifAbsent: [requiredScopes].
  expectedAudience := aConfigDict at: 'expectedAudience' ifAbsent: [expectedAudience].
  expectedIssuer := aConfigDict at: 'expectedIssuer' ifAbsent: [expectedIssuer].
  writeScope := aConfigDict at: 'writeScope' ifAbsent: [writeScope].
  bindAddress := aConfigDict at: 'bindAddress' ifAbsent: [bindAddress].
  ^self
%
category: 'metadata'
method: McpAuthRouter
authorizationServers
  "This router's advertised OAuth Authorization Server issuer URLs."
  ^authorizationServers
%
category: 'metadata'
method: McpAuthRouter
authorizationServers: anArrayOfUrls
  authorizationServers := anArrayOfUrls
%
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
category: 'network'
method: McpAuthRouter
bindAddress
  "The local address this router's listener binds. Seeded to loopback; set bindAddress: to an
   interface address (e.g. '172.16.73.10') or '0.0.0.0' to accept connections from other hosts.
   Unlike the base McpRouter this IS configurable, because every request here must carry a valid
   bearer token and the transport must be TLS (see requireTls)."
  ^bindAddress
%
category: 'network'
method: McpAuthRouter
bindAddress: aHostAddressString
  "Bind this router's listener to aHostAddressString instead of loopback. Prefer a specific interface
   address over '0.0.0.0', which accepts connections on every interface the host has."
  bindAddress := aHostAddressString
%
category: 'config'
method: McpAuthRouter
configDict
  "Extend the base router config (McpRouter>>configDict) with the RS-layer / OIDC settings. Still
   identifiers + booleans only -- the JWT signing key is trusted Stone-side (addJwtKey), never here."
  | d |
  d := super configDict.
  d at: 'userIdClaim' put: userIdClaim.
  d at: 'authorizationServers' put: authorizationServers.
  d at: 'resourceMetadataUrl' put: resourceMetadataUrl.
  d at: 'requiredScopes' put: requiredScopes.
  d at: 'expectedAudience' put: expectedAudience.
  d at: 'expectedIssuer' put: expectedIssuer.
  d at: 'writeScope' put: writeScope.
  d at: 'bindAddress' put: bindAddress.
  ^d
%
category: 'metadata'
method: McpAuthRouter
derivedResourceMetadataUrl
  "The metadata document URL implied by the canonical resource identifier: the path-scoped form when
   the identifier has a path (resource https://host:8443/mcp ->
   https://host:8443/.well-known/oauth-protected-resource/mcp), else the root form. nil when no
   identifier is configured, so a router that cannot name itself omits the parameter rather than
   publishing a nonsense URL."
  | origin |
  self expectedAudience isNil ifTrue: [^nil].
  origin := self resourceOrigin.
  origin isEmpty ifTrue: [^nil].
  ^origin , '/.well-known/oauth-protected-resource' , self resourcePath
%
category: 'validation'
method: McpAuthRouter
expectedAudience
  "The resource identifier this router requires in a token's `aud` claim, or nil to skip the check."
  ^expectedAudience
%
category: 'validation'
method: McpAuthRouter
expectedAudience: aStringOrNil
  expectedAudience := aStringOrNil
%
category: 'validation'
method: McpAuthRouter
expectedIssuer
  "The issuer this router trusts to mint tokens, or nil to skip the RS-layer issuer check."
  ^expectedIssuer
%
category: 'validation'
method: McpAuthRouter
expectedIssuer: aStringOrNil
  expectedIssuer := aStringOrNil
%
category: 'forking'
method: McpAuthRouter
forkOnPort: aPort
  "Refuse to fork without TLS or a conformant resource-server config. Checked HERE as well as in
   runOnPort: so the failure surfaces in the launching session rather than only in the detached child
   gem's log."
  self requireTls.
  self requireResourceServerConfig.
  ^super forkOnPort: aPort
%
category: 'initialization'
method: McpAuthRouter
initialize
  "Seed the RS-layer config with safe instance-side defaults, on top of McpRouter>>initialize. There
   is NO class-side config state: a launch script / test configures the instance and forkOnPort:
   serializes it. Optional checks stay nil (= skip); userIdClaim defaults to the OIDC subject claim;
   requiredScopes / authorizationServers default empty."
  super initialize.
  userIdClaim := 'sub'.
  authorizationServers := #().
  resourceMetadataUrl := nil.
  requiredScopes := #().
  expectedAudience := nil.
  expectedIssuer := nil.
  writeScope := nil.
  bindAddress := self class loopbackAddress.  "reachable only if the caller asks for it"
  ^self
%
category: 'network'
method: McpAuthRouter
isHttpsUrl: aString
  "Whether aString is an absolute https URL. Case-insensitive on the scheme, since RFC 3986 defines
   the scheme as case-insensitive and the MCP spec asks implementations to accept an uppercase
   scheme for robustness."
  | prefix |
  prefix := 'https://'.
  aString isNil ifTrue: [^false].
  aString size <= prefix size ifTrue: [^false].
  ^(aString copyFrom: 1 to: prefix size) asLowercase = prefix
%
category: 'metadata'
method: McpAuthRouter
isMetadataPath: aPath
  "Whether aPath (query already stripped) addresses this router's metadata document. A trailing slash
   is tolerated: it names the same resource and a client that adds one should still get the document."
  | candidate |
  candidate := (aPath notEmpty and: [aPath last = $/])
    ifTrue: [aPath copyFrom: 1 to: aPath size - 1]
    ifFalse: [aPath].
  ^self metadataPaths includes: candidate
%
category: 'metadata'
method: McpAuthRouter
metadataPaths
  "Every local path at which this router serves its Protected Resource Metadata (RFC 9728 section 3).
   Both forms the spec allows, because a conforming client probes the path-scoped one FIRST and only
   then falls back to the root:
    * path-inserted, for a resource identifier that has a path component -- resource
      https://host:8443/mcp is published at /.well-known/oauth-protected-resource/mcp
    * the root, /.well-known/oauth-protected-resource"
  | root paths resourcePath |
  root := '/.well-known/oauth-protected-resource'.
  paths := OrderedCollection with: root.
  resourcePath := self resourcePath.
  (resourcePath notNil and: [resourcePath notEmpty and: [resourcePath ~= '/']])
    ifTrue: [paths add: root , resourcePath].
  ^paths
%
category: 'sessions'
method: McpAuthRouter
openSessionForUser: aUserId jwt: aJwtString
  "Open + register a worker session logged in as aUserId, authenticated by the JWT."
  ^self openSessionForUser: aUserId jwt: aJwtString readOnly: false
%
category: 'sessions'
method: McpAuthRouter
openSessionForUser: aUserId jwt: aJwtString readOnly: aBoolean
  "Open + register a worker session for aUserId. When aBoolean, the worker is read-only for its
   whole life (its token lacked the write scope)."
  ^self openSessionCreating: [:newId |
    McpSession startWithId: newId user: aUserId jwt: aJwtString readOnly: aBoolean]
%
category: 'metadata'
method: McpAuthRouter
pathOf: req
  "The request path with any query string removed. parseHead: stores the raw request target, so
   without this a discovery probe such as `/.well-known/oauth-protected-resource?x=1` would not match
   the metadata path and would fall through to the SSE stream -- answering an event-stream that never
   completes instead of a metadata document."
  | path q |
  path := req at: 'path' ifAbsent: [''].
  q := path indexOf: $?.
  ^q = 0 ifTrue: [path] ifFalse: [path copyFrom: 1 to: q - 1]
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
  "An absent exp is a REJECTION, not a pass. A self-contained access token with no expiry can never
   be shown to be currently valid, and a check written as (exp notNil and: [expired]) would fail
   OPEN -- accepting a token that never expires, which is the opposite of the intent."
  exp isNil
    ifTrue: [^Array with: 401 with: 'invalid_token' with: 'Token has no exp claim'].
  exp < System timeGmt
    ifTrue: [^Array with: 401 with: 'invalid_token' with: 'Token expired'].
  self expectedIssuer ifNotNil: [:iss |
    (payload at: 'iss' ifAbsent: [nil]) = iss
      ifFalse: [^Array with: 401 with: 'invalid_token' with: 'Untrusted token issuer']].
  self expectedAudience ifNotNil: [:aud |
    (self payload: payload hasAudience: aud)
      ifFalse: [^Array with: 401 with: 'invalid_token' with: 'Token audience does not include this resource']].
  self requiredScopes isEmpty ifFalse: [ | granted missing |
    granted := self scopesOf: payload.
    missing := self requiredScopes reject: [:s | granted includes: s].
    missing isEmpty ifFalse: [
      ^Array with: 403 with: 'insufficient_scope'
        with: 'Token missing required scope(s): ' , (self spaceSeparated: missing)]].
  ^nil
%
category: 'routing'
method: McpAuthRouter
requestAuthorized: req on: conn
  "Require a valid bearer token on EVERY request: 'authorization MUST be included in every HTTP
   request from client to server, even if they are part of the same logical session', and the server
   MUST validate the token on each protected resource request. One exception -- the Protected Resource
   Metadata endpoint is the unauthenticated discovery document a client reads in order to learn how to
   authenticate at all.
   This replaces authenticating `initialize` alone and letting the MCP-Session-Id carry authorization
   afterwards, which made the session id the real credential: an expired or revoked token kept working
   for as long as the session was kept alive (the idle reaper was the only limit), and the GET stream
   and DELETE took no credential whatsoever.
   Answers false having already written the response, per the McpRouter hook contract."
  | token rejection |
  (self isMetadataPath: (self pathOf: req)) ifTrue: [^true].
  token := self bearerTokenOf: req.
  token isNil ifTrue: [
    self writeAuthError: 401 oauthError: nil
      description: 'Missing or malformed Authorization: Bearer token' on: conn.
    ^false].
  rejection := self tokenRejectionFor: token.
  rejection ifNotNil: [
    self writeAuthError: (rejection at: 1) oauthError: (rejection at: 2)
      description: (rejection at: 3) on: conn.
    ^false].
  ^self tokenOwnsNamedSession: req on: conn
%
category: 'validation'
method: McpAuthRouter
requiredScopes
  "Scopes a token MUST carry for this router to initialize a session; empty requires none."
  ^requiredScopes
%
category: 'validation'
method: McpAuthRouter
requiredScopes: anArrayOfScopeStrings
  requiredScopes := anArrayOfScopeStrings
%
category: 'network'
method: McpAuthRouter
requireResourceServerConfig
  "Signal unless this router is configured to act as a conformant OAuth 2.1 Resource Server. Checked
   at start-up rather than per request so a misconfiguration fails loudly at launch instead of
   quietly accepting tokens it should refuse.
   Each check backs a MUST in the MCP authorization spec:
    * expectedAudience -- 'MCP servers MUST only accept tokens specifically intended for themselves
      and MUST reject tokens that do not include them in the audience claim'. nil means 'skip the
      check' in rejectionForPayload:, so without this guard an unconfigured router accepts a token
      minted for any resource at all.
    * authorizationServers -- 'The Protected Resource Metadata document returned by the MCP server
      MUST include the authorization_servers field containing at least one authorization server'.
      An empty list publishes a document that satisfies the letter of serving metadata while telling
      the client nothing it needs to get a token.
    * https on every authorization server -- 'All authorization server endpoints MUST be served over
      HTTPS'. The spec's localhost exemption covers redirect URIs, NOT authorization server
      endpoints, so there is deliberately no loopback escape here. expectedIssuer is held to the same
      rule when set: it names the same authorization server."
  | insecure |
  self expectedAudience isNil ifTrue: [
    ^self error: 'McpAuthRouter requires expectedAudience: the canonical resource identifier ' ,
      'clients use for this server (e.g. ''https://host:8443/mcp''). Token audience validation is ' ,
      'not optional -- a router without it accepts tokens minted for any resource.'].
  self authorizationServers isEmpty ifTrue: [
    ^self error: 'McpAuthRouter requires authorizationServers: at least one OAuth/OIDC issuer URL. ' ,
      'The Protected Resource Metadata document MUST name an authorization server, or a client has ' ,
      'no way to discover where to obtain a token.'].
  insecure := self authorizationServers reject: [:u | self isHttpsUrl: u].
  self expectedIssuer ifNotNil: [:iss |
    (self isHttpsUrl: iss) ifFalse: [insecure := insecure asArray , (Array with: iss)]].
  insecure isEmpty ifFalse: [
    ^self error: 'McpAuthRouter requires https authorization server URLs; these are cleartext: ' ,
      (self spaceSeparated: insecure) ,
      '. All authorization server endpoints MUST be served over HTTPS (the spec''s localhost ' ,
      'exemption applies to redirect URIs, not to authorization server endpoints).'].
  ^self
%
category: 'network'
method: McpAuthRouter
requireTls
  "Signal unless this router has TLS credentials. A bearer token IS a password: it grants the
   holder a GemStone session as its user, and it travels in a request header on every call. Serving
   this router over cleartext would put that password on the wire, so TLS is not optional here --
   this is enforced in code rather than left to a launch script, because runOnPort:/forkOnPort: can
   be called directly.
   Enforced unconditionally, not only for a non-loopback bindAddress: a router that is safe today
   becomes unsafe the moment someone widens its bind address, and the check should not depend on
   remembering that."
  self tlsEnabled ifTrue: [^self].
  ^self error: 'McpAuthRouter requires TLS: set useTlsCertificateFile:privateKeyFile: (an ' ,
    'UNENCRYPTED PEM key) before runOnPort:/forkOnPort:. For a cleartext loopback server with no ' ,
    'authentication at all, use McpRouter instead.'
%
category: 'metadata'
method: McpAuthRouter
resourceMetadataUrl
  "Absolute URL of this router's Protected Resource Metadata document, for the RFC 9728
   `resource_metadata` challenge parameter. DERIVED from the canonical resource identifier unless
   explicitly overridden, so a 401 always carries it: 2025-06-18 states flatly that 'MCP servers MUST
   use the HTTP header WWW-Authenticate when returning a 401 Unauthorized to indicate the location of
   the resource server metadata URL', and leaving it to a separately-set field meant every deployment
   that forgot to set it (including run-auth-server.sh) emitted 401s without it."
  ^resourceMetadataUrl ifNil: [self derivedResourceMetadataUrl]
%
category: 'metadata'
method: McpAuthRouter
resourceMetadataUrl: aStringOrNil
  resourceMetadataUrl := aStringOrNil
%
category: 'metadata'
method: McpAuthRouter
resourceOrigin
  "The scheme + authority of this router's canonical resource identifier, with no trailing path --
   'https://host:8443' for 'https://host:8443/mcp'. Used to build absolute metadata URLs."
  | id path |
  id := self expectedAudience.
  id isNil ifTrue: [^''].
  path := self resourcePath.
  path isEmpty ifTrue: [^id].
  ^id copyFrom: 1 to: id size - path size
%
category: 'metadata'
method: McpAuthRouter
resourcePath
  "The path component of this router's canonical resource identifier (expectedAudience), or '' when
   it has none. For 'https://host:8443/mcp' this is '/mcp'; for 'https://host:8443' it is ''."
  | id afterScheme slash |
  id := self expectedAudience.
  id isNil ifTrue: [^''].
  afterScheme := id indexOfSubCollection: '://'.
  afterScheme = 0 ifTrue: [^''].
  slash := id indexOf: $/ startingAt: afterScheme + 3.
  ^slash = 0 ifTrue: [''] ifFalse: [id copyFrom: slash to: id size]
%
category: 'running'
method: McpAuthRouter
runOnPort: aPort
  "Refuse to serve without TLS or a conformant resource-server config, then run the inherited
   blocking accept loop."
  self requireTls.
  self requireResourceServerConfig.
  ^super runOnPort: aPort
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
  "A GET for this resource's Protected Resource Metadata -> serve it (unauthenticated; it is the
   discovery endpoint an unauthenticated client reads to find out how to authenticate). Any other GET
   falls through to the inherited SSE stream."
  (self isMetadataPath: (self pathOf: req))
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
    description: 'Token has no ' , self userIdClaim , ' claim' on: conn].
  sess := [self openSessionForUser: userId jwt: token
    readOnly: (self readOnly or: [(self tokenGrantsWrite: token) not])]
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
   compliant MCP client can discover where to obtain a token.
   `resource` is expectedAudience -- the SAME identifier this router validates in a token's aud claim,
   deliberately not a separate setting and deliberately NOT derived from the request. A client obeys
   this document when it sets RFC 8707 resource= on its token request, so if what we publish and what
   we enforce could differ, every token the client is able to obtain would fail our audience check
   and the client would see an unexplainable 401 loop. Reading it from the request Host header (as
   this method used to) also let the CALLER choose the identifier we publish: a request carrying
   `Host: evil.example.com` was told the resource was https://evil.example.com/mcp.
   `scopes_supported` publishes requiredScopes: it is the client's documented fallback for scope
   selection when a challenge carries no scope parameter."
  | meta |
  meta := Dictionary new.
  meta at: 'resource' put: self expectedAudience.
  meta at: 'authorization_servers' put: self authorizationServers asArray.
  meta at: 'scopes_supported' put: self requiredScopes asArray.
  meta at: 'bearer_methods_supported' put: (Array with: 'header').
  conn writeStatus: 200 reason: 'OK' body: meta asJson
%
category: 'validation'
method: McpAuthRouter
signatureVerified: aJsonWebToken
  "Whether aJsonWebToken's signature verifies against the Stone's trusted JWT public keys, selected
   by the token's own `kid` header. Fails closed on anything unexpected -- an unsigned token, a kid
   this Stone does not trust (or no kid at all, which raises), or a verification error.
   Only asymmetric (public-key) signatures are accepted: an HMAC-signed token has no public key to
   check it against, so it cannot be verified here and is refused. Real OIDC providers sign access
   tokens with RS256/ES256, so this costs nothing in practice and closes the alg-confusion door."
  | kid key |
  ^[ aJsonWebToken isSigned
       ifFalse: [false]
       ifTrue: [
         kid := [aJsonWebToken keyId] on: Error do: [:e | nil].  "raises when the header has no kid"
         key := self trustedKeyForKeyId: kid.
         key isNil ifTrue: [false] ifFalse: [
           (aJsonWebToken verifySignatureNoErrorWithPublicKey: key) == true]] ]
   on: Error do: [:e | false]
%
category: 'validation'
method: McpAuthRouter
spaceSeparated: aCollectionOfStrings
  "Join strings with single spaces (for the scope list in messages / the WWW-Authenticate scope=)."
  ^aCollectionOfStrings inject: '' into: [:acc :s | acc isEmpty ifTrue: [s] ifFalse: [acc , ' ' , s]]
%
category: 'validation'
method: McpAuthRouter
tokenGrantsWrite: aJwtString
  "Whether aJwtString carries the configured writeScope, granting its session read-WRITE access.
   True (write allowed) when no writeScope is configured -- per-session write-gating is off. A token
   that can't be parsed grants no write (fail-safe -> read-only). GemStone still re-validates the
   token's signature at login regardless."
  | scope |
  scope := self writeScope.
  scope isNil ifTrue: [^true].
  ^[ | payload |
     payload := (JsonWebToken fromJwtString: aJwtString) payload.
     (self scopesOf: payload) includes: scope ]
   on: Error do: [:e | false]
%
category: 'routing'
method: McpAuthRouter
tokenOwnsNamedSession: req on: conn
  "When a request names an EXISTING session, the bearer token must belong to the same GemStone user
   that session's worker gem runs as. Without this, any caller holding a valid token of their own
   could drive another user's worker -- and read that user's uncommitted view -- just by presenting
   its session id. Session ids are unguessable, so this is defence in depth rather than the only
   barrier, but a leaked or logged id must not be enough to act as someone else.
   A mismatch answers exactly what an unknown session answers, so the difference cannot be used to
   probe which session ids exist; 404 also tells the client to re-initialize, which is the correct
   recovery. Sessions are compared by userId, not by token, so a client that legitimately refreshes
   its access token mid-session keeps working."
  | sid sess |
  sid := self sessionIdOf: req.
  sid isNil ifTrue: [^true].
  sess := self sessionAt: sid.
  sess isNil ifTrue: [^true].  "unknown or reaped -- the routing handler answers 404 on its own"
  (self userIdFromToken: (self bearerTokenOf: req)) = sess userId ifTrue: [^true].
  self log: 'McpAuthRouter refused session ' , sid printString ,
    ': the presented token does not belong to its user.'.
  self writeSessionError: 'Unknown or expired session: ' , sid code: 404 reason: 'Not Found'
    on: conn.
  ^false
%
category: 'validation'
method: McpAuthRouter
tokenRejectionFor: aJwtString
  "RS-layer validation of the bearer token BEFORE attempting a GemStone login. Answers nil if the
   token passes, else an Array { httpCode. oauthErrorCode. description } naming the failure. Parses
   the token WITHOUT verifying its signature (GemStone re-verifies at login); this layer enforces
   the OAuth claims GemStone does not model (notably scopes) plus standard hygiene (exp) and, when
   configured, issuer/audience per RFC 8707.
   NB: the handler below is deliberately broad, so ANY error in the parse expression -- including a
   programming error such as sending a selector this image does not implement -- surfaces to the
   client as 'Malformed bearer token'. If every token is suddenly rejected as malformed, suspect
   the parse expression before suspecting the token. (This bit us once: #instVarNamed: does not
   exist in GemStone, so all three parse sites silently rejected every token.)"
  | tok |
  tok := [JsonWebToken fromJwtString: aJwtString] on: Error do: [:e | nil].
  tok isNil ifTrue: [^Array with: 401 with: 'invalid_token' with: 'Malformed bearer token'].
  "Signature FIRST, before any claim is believed. Two reasons this is not merely cosmetic:
    * OAuth 2.1 section 5.3 -- a token that fails validation is an invalid token, so it must answer
      401 invalid_token. Judging an unverified token on its claims meant a forged one whose payload
      simply lacked a scope came back 403 insufficient_scope, handing an unauthenticated caller the
      exact scope names this deployment requires.
    * Since every request (not just initialize) is now authenticated here, this layer is the ONLY
      place a non-initialize request's token is checked -- there is no GemStone login behind it to
      catch a forgery. Without this check a caller could mint an unsigned token carrying a victim's
      userId claim and, with that user's session id, drive their worker gem."
  (self signatureVerified: tok)
    ifFalse: [^Array with: 401 with: 'invalid_token' with: 'Token signature is not valid'].
  ^self rejectionForPayload: tok payload
%
category: 'validation'
method: McpAuthRouter
trustedKeyForKeyId: aKeyIdOrNil
  "The trusted JWT public key this Stone holds under aKeyIdOrNil (installed with
   System addJwtKey:withId:), or nil when there is none.
   NB: System jwtPublicKeys answers a FLAT Array alternating id, key, id, key -- it is NOT a
   Dictionary, so it cannot be indexed by id directly."
  | keys |
  aKeyIdOrNil isNil ifTrue: [^nil].
  keys := [System jwtPublicKeys] on: Error do: [:e | nil].
  keys isNil ifTrue: [^nil].
  1 to: keys size - 1 by: 2 do: [:i |
    (keys at: i) = aKeyIdOrNil ifTrue: [^keys at: i + 1]].
  ^nil
%
category: 'userId claim'
method: McpAuthRouter
userIdClaim
  "The JWT payload claim this router reads for the GemStone userId to log in as."
  ^userIdClaim
%
category: 'userId claim'
method: McpAuthRouter
userIdClaim: aString
  userIdClaim := aString
%
category: 'auth'
method: McpAuthRouter
userIdFromToken: aJwtString
  "The GemStone userId claimed by the token: the userIdClaim value from the JWT payload, or nil if
   the token can't be parsed or lacks the claim. This is an UNVERIFIED parse used only to choose
   which user to log in as -- GemStone re-validates the token's signature + claims at login, so a
   tampered claim simply fails authentication."
  ^[ | payload |
     payload := (JsonWebToken fromJwtString: aJwtString) payload.
     payload at: self userIdClaim asSymbol ifAbsent: [nil] ]
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
  "scope goes on EVERY challenge that has required scopes, not only insufficient_scope. The Scope
   Selection Strategy makes it a client's first choice for what to request, ahead of scopes_supported,
   and its example is a 401. Without it on the initial 401 a client requests no scope at all, is
   issued a token lacking them, and only discovers what it needed from the 403 that follows -- a
   wasted authorization round trip on every first connection."
  self requiredScopes isEmpty
    ifFalse: [params add: 'scope="' , (self spaceSeparated: self requiredScopes) , '"'].
  self resourceMetadataUrl ifNotNil: [:u | params add: 'resource_metadata="' , u , '"'].
  challenge := 'WWW-Authenticate: Bearer'.
  params isEmpty ifFalse: [challenge := challenge , ' ' , (params inject: '' into: [:acc :p |
    acc isEmpty ifTrue: [p] ifFalse: [acc , ', ' , p]])].
  reason := httpCode = 403 ifTrue: ['Forbidden'] ifFalse: ['Unauthorized'].
  err := Dictionary new.
  err at: 'jsonrpc' put: '2.0'; at: 'id' put: nil.
  err at: 'error' put: (Dictionary new at: 'code' put: -32600; at: 'message' put: aMessage; yourself).
  conn writeStatus: httpCode reason: reason headers: challenge , crlf body: err asJson
%
category: 'validation'
method: McpAuthRouter
writeScope
  "The scope a token must carry for its session to get read-WRITE access, or nil for no gating."
  ^writeScope
%
category: 'validation'
method: McpAuthRouter
writeScope: aStringOrNil
  writeScope := aStringOrNil
%
