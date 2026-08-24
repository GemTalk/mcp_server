set compile_env: 0
! ------------------- Class definition for McpAuthConformanceTest
expectvalue /Class
doit
GsTestCase subclass: 'McpAuthConformanceTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpAuthConformanceTest comment: 
'Conformance tests for McpAuthRouter against the MCP authorization specification, in its role as an
OAuth 2.1 Resource Server. One test per normative requirement, named after the requirement and
carrying the spec clause in its comment.

STATUS: 25 of 25 passing, identically on 3.7.5 and 4.0.0. It started at 10 of 25 and was written
deliberately red, as a burn-down checklist; it is now a regression gate and is included in
run-unit-tests.sh. ./run-conformance.sh still exists to score it test-by-test, which is the more
useful output while changing authorization behavior.

WHAT CLOSING IT CHANGED, in the order the gaps were closed -- worth knowing, because two of these
alter behavior a client can observe:
 1. Start-up guards (requireResourceServerConfig): a router now REFUSES to run or fork without an
    expectedAudience and at least one https authorization server. Audience validation and naming an
    authorization server are MUSTs, so they cannot be settings that default to off.
 2. The metadata document is built from configuration, not from the request. `resource` is now
    expectedAudience -- the same identifier the router validates -- where it used to be assembled
    from the request Host header and the TLS setting, which let the caller choose the identifier we
    published. scopes_supported is published, and resource_metadata is DERIVED, so a 401 always
    carries it instead of only when someone remembered to set it.
 3. Every request is authenticated (requestAuthorized:on:), not just initialize, and a request that
    names a session must present a token belonging to that session''s user. The MCP-Session-Id is no
    longer a credential.
 4. Token signatures are verified at this layer (signatureVerified:) before any claim is believed.
    This became REQUIRED by (3), not merely tidier: with no GemStone login behind a non-initialize
    request, this is the only place a forgery can be caught -- otherwise an unsigned token carrying a
    victim''s userId claim plus their session id would have been accepted.
 5. A token with no exp claim is refused (it was accepted: the guard read `exp notNil and: [expired]`,
    which fails open).

A DISCARDED ASSERTION, recorded so it is not reintroduced: an early version of
testForgedSignatureRejectedAsInvalidTokenNotInsufficientScope also asserted that the challenge
withheld the required scope names from an unauthenticated caller. That is not a leak this protocol
recognises -- RFC 9728 publishes scopes_supported in an unauthenticated metadata document by design,
and the Scope Selection Strategy has the challenge repeat them so a client knows what to request.
Scope names are public here; only the status code was ever wrong.

VERSIONS. McpDispatcher>>supportedProtocolVersions claims 2025-06-18 and 2025-11-25. Each test
comment names the revisions its requirement appears in. The three revisions differ in ways that
matter here, and NOT monotonically -- 2025-06-18 is stricter on one point than its successors:
 * 2025-06-18 -- "MCP servers MUST use the HTTP header WWW-Authenticate when returning a 401
   Unauthorized to indicate the location of the resource server metadata URL". An unconditional
   MUST: a 401 without resource_metadata is non-conformant, full stop.
 * 2025-11-25 -- relaxes the above to "MUST implement one of" (WWW-Authenticate header OR a
   well-known URI), and ADDS the Scope Selection Strategy: servers SHOULD put scope in the
   WWW-Authenticate challenge, and scopes_supported in the metadata document is the client''s
   documented fallback.
 * draft -- adds RFC 9207 iss handling and Client ID Metadata Documents (CIMD; client/AS-side, not
   ours today, though it is a candidate route away from the deviation below), plus two server-side
   items: scope hierarchies (see KNOWN GAPS) and, from SEP-2207 (status Final, so it binds
   independently of which revision we claim), "MCP Servers SHOULD NOT include offline_access in
   WWW-Authenticate scope or scopes_supported".
Where revisions disagree, these tests assert the STRICTEST reading, on the assumption that each
revision tightens rather than loosens.

KNOWN GAPS NOT TESTED HERE. The draft adds "Servers MUST account for scope hierarchies, where a
broader scope implies narrower ones, when deciding whether a token is sufficient". McpAuthRouter
compares scopes by exact string match (rejectionForPayload:), which satisfies this only while all
configured scopes are flat and unrelated -- true of mcp:use / mcp:write today. There is no test
because there is no hierarchy API to test yet; introducing one (e.g. mcp:admin implying mcp:use)
needs a design decision first, and the exact-match check must change at the same time.

A KNOWN DEPLOYMENT DEVIATION, likewise untested here: the SEP-2207 rule "SHOULD NOT include
offline_access" is asserted below against conformantRouter, but the geode test deployment DOES
advertise offline_access (via MCP_EXTRA_SCOPES) and therefore deviates. Not an oversight. It is what
this pair of conditions forces: a client that appends offline_access to its authorization request on
its own, plus an authorization server that rejects a request naming a scope that client was never
assigned. Authorization servers gating scopes per client behave that way (Keycloak and Authelia
reject before any login page; others silently narrow the grant and need none of this). Keycloak
compounds it -- an RFC 7591 registration carrying a scope field REPLACES the realm defaults -- so the
resource advertising the scope is the only way it ever reaches the client, and omitting it breaks the
browser login outright rather than merely shortening sessions. These tests deliberately constrain the
FIXTURE and not every deployment: a router is spec-clean unless an operator opts out, and this
operator has, knowingly.

Two candidate exits, neither taken. Pinning the requested scopes CLIENT-side was tried and FAILED
(2026-08-20): the client kept appending offline_access regardless, so a fresh authorization still
produced an offline session. Nothing on the SERVER side can substitute either -- client registration
policies only validate a registration and protocol mappers only emit claims; neither can assign a
client scope. The remaining candidate is CIMD, where the client is identified by a URL serving its
own metadata and no registration record exists to have its scopes replaced; untested, and it depends
on both the client and the authorization server supporting it, so it cannot be the documented answer
yet. Until one lands, advertising is the remedy and this test constrains the fixture only.

FIXTURES. Most tests drive McpAuthRouter>>handleConnection: through McpMockSocket, so they need no
listening socket, no TLS, no IdP and no login -- run them anywhere. The per-request authorization
tests (testRoutedRequestRequiresBearerToken and friends) need a real session, so they use
withJwtUser:scope:do: to create and commit a throwaway JWT-enabled UserProfile and spawn a worker
gem, exactly as McpAuthTest does. Those need a running NETLDI and they touch AllUsers.'
%
expectvalue /Class
doit
McpAuthConformanceTest category: 'Mcp-Auth-Tests'
%
! ------------------- Remove existing behavior from McpAuthConformanceTest
removeallmethods McpAuthConformanceTest
removeallclassmethods McpAuthConformanceTest
! ------------------- Class methods for McpAuthConformanceTest
! ------------------- Instance methods for McpAuthConformanceTest
category: 'helpers'
method: McpAuthConformanceTest
bodyOf: aResponse
  "Everything after the blank line that ends the response head."
  | marker idx |
  marker := self crlf , self crlf.
  idx := aResponse indexOfSubCollection: marker.
  idx = 0 ifTrue: [^''].
  ^aResponse copyFrom: idx + marker size to: aResponse size
%
category: 'fixture values'
method: McpAuthConformanceTest
canonicalResource
  "The canonical resource identifier a conformant deployment publishes and validates: the exact
   absolute URI a client dials, no fragment and no trailing slash (RFC 8707 section 2 / RFC 9728).
   It must be a name the server's TLS certificate actually covers, since the client has to complete
   a TLS handshake before it can present a token."
  ^'https://localhost:8443/mcp'
%
category: 'fixture values'
method: McpAuthConformanceTest
conformanceIssuer
  "An https issuer URL, as Communication Security requires of every authorization server endpoint."
  ^'https://idp.example:8443/realms/gs-mcp'
%
category: 'helpers'
method: McpAuthConformanceTest
conformanceKeyId
  "The kid the fixture tokens are signed under."
  ^'mcp-conformance-key'
%
category: 'fixture values'
method: McpAuthConformanceTest
conformanceResourceMetadataUrl
  "The RFC 9728 metadata document URL for canonicalResource."
  ^'https://localhost:8443/.well-known/oauth-protected-resource'
%
category: 'fixture routers'
method: McpAuthConformanceTest
conformantRouter
  "A router configured the way a conformant deployment must be: https issuer, canonical audience,
   an advertised authorization server, a metadata URL, required scopes, and TLS credentials (paths
   only -- tlsEnabled just checks both are set, so the metadata scheme comes out https without a
   real certificate)."
  | r |
  r := McpAuthRouter new.
  r useTlsCertificateFile: '/tmp/mcp-conformance.crt' privateKeyFile: '/tmp/mcp-conformance.key';
    expectedIssuer: self conformanceIssuer;
    expectedAudience: self canonicalResource;
    authorizationServers: (Array with: self conformanceIssuer);
    resourceMetadataUrl: self conformanceResourceMetadataUrl;
    requiredScopes: #('mcp:use');
    userIdClaim: 'sub'.
  ^r
%
category: 'helpers'
method: McpAuthConformanceTest
crlf
  ^String with: Character cr with: Character lf
%
category: 'helpers'
method: McpAuthConformanceTest
driveRequest: rawRequest on: aRouter
  "Run one raw HTTP request through aRouter via a mock socket; answer the captured raw response.
   Takes the router so several requests can share one instance (and its session map)."
  | mock |
  mock := McpMockSocket on: rawRequest.
  aRouter handleConnection: (McpHttpConnection on: mock).
  ^mock output
%
category: 'token fixtures'
method: McpAuthConformanceTest
forgedToken
  "A syntactically valid JWT whose signature is garbage: header {alg:HS256}, payload with sub/exp/
   iss/aud, and a bogus signature segment. It PARSES (so the RS-layer claim checks run on it) but
   could never survive signature verification."
  ^'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdHRhY2tlciIsImV4cCI6OTk5OTk5OTk5OSwiaXNzIjoiaHR0cHM6Ly9pZHAu'
    , 'ZXhhbXBsZTo4NDQzL3JlYWxtcy9ncy1tY3AiLCJhdWQiOiJodHRwczovL2xvY2FsaG9zdDo4NDQzL21jcCJ9.AAAA'
%
category: 'helpers'
method: McpAuthConformanceTest
getPath: aPath
  "A raw HTTP GET for aPath with a loopback Host."
  ^self getPath: aPath host: 'localhost:8443' headers: ''
%
category: 'helpers'
method: McpAuthConformanceTest
getPath: aPath host: aHost headers: extraHeaderLines
  "A raw HTTP GET for aPath, with an explicit Host and extra CRLF-terminated header lines."
  ^'GET ' , aPath , ' HTTP/1.1' , self crlf , 'Host: ' , aHost , self crlf ,
    extraHeaderLines , self crlf
%
category: 'helpers'
method: McpAuthConformanceTest
headerNamed: aName in: aResponse
  "The value of response header aName (case-insensitive name match), or nil if absent."
  | lines prefix |
  prefix := aName asLowercase , ':'.
  lines := aResponse subStrings: self crlf.
  lines do: [:line |
    (line asLowercase indexOfSubCollection: prefix) = 1
      ifTrue: [^(line copyFrom: prefix size + 1 to: line size) trimSeparators]].
  ^nil
%
category: 'helpers'
method: McpAuthConformanceTest
includesCS: aSubstring in: aString
  "Case-SENSITIVE substring test. String>>includesString: is case-insensitive in GemStone, which
   would quietly make assertions about lower-case OAuth error codes pass on any casing."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'helpers'
method: McpAuthConformanceTest
initBody
  ^'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
%
category: 'helpers'
method: McpAuthConformanceTest
jsonOf: aResponse
  "The response body parsed as JSON, or nil if it is not a JSON object."
  | body |
  body := self bodyOf: aResponse.
  ^[ | p | p := JsonParser parse: body.
     (p isKindOf: Dictionary) ifTrue: [p] ifFalse: [nil] ]
   on: Error do: [:e | nil]
%
category: 'helpers'
method: McpAuthConformanceTest
postBody: aBody headers: extraHeaderLines
  "A raw HTTP POST /mcp carrying aBody as JSON, with a correct Content-Length."
  ^'POST /mcp HTTP/1.1' , self crlf , 'Host: localhost:8443' , self crlf , extraHeaderLines ,
    'Content-Type: application/json' , self crlf ,
    'Content-Length: ' , aBody size printString , self crlf , self crlf , aBody
%
category: 'helpers'
method: McpAuthConformanceTest
postInitWithToken: aJwtStringOrNil
  "An initialize POST, carrying a Bearer token when one is given."
  | hdrs |
  hdrs := aJwtStringOrNil isNil
    ifTrue: ['']
    ifFalse: ['Authorization: Bearer ' , aJwtStringOrNil , self crlf].
  ^self postBody: self initBody headers: hdrs
%
category: 'helpers'
method: McpAuthConformanceTest
rsVerdictFor: aClaimsDict
  "The router's RESOURCE-SERVER verdict on a token carrying aClaimsDict: nil to accept, else
   { httpCode. oauthErrorCode. description }. Runs with the fixture signing key trusted, so the
   verdict reflects the CLAIM under test rather than an untrusted signature.
   The claim-level tests below assert this rather than an HTTP status ON PURPOSE. Driving a whole
   initialize would reach the GemStone login, and these fixture tokens name users that were never
   provisioned, so the login fails and the response is 401 no matter what the RS layer decided --
   an HTTP-level assertion would pass even for a claim the router never checked. (That is not
   hypothetical: the no-expiry test passed that way before being rewritten to assert the verdict.)"
  ^self withConformanceKeyDo: [
    self conformantRouter tokenRejectionFor: (self tokenWithClaims: aClaimsDict)]
%
category: 'helpers'
method: McpAuthConformanceTest
sessionIdFrom: aResponse
  ^self headerNamed: 'MCP-Session-Id' in: aResponse
%
category: 'helpers'
method: McpAuthConformanceTest
statusBody
  ^'{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"status","arguments":{}}}'
%
category: 'helpers'
method: McpAuthConformanceTest
statusOf: aResponse
  "The numeric HTTP status from the status line, or nil if it cannot be read."
  | line parts |
  line := (aResponse subStrings: self crlf) at: 1 ifAbsent: [^nil].
  parts := line subStrings: ' '.
  parts size < 2 ifTrue: [^nil].
  ^(parts at: 2) asNumber
%
category: 'tests - token validation'
method: McpAuthConformanceTest
testAudienceArrayContainingThisResourceAccepted
  "RFC 7519: aud may be a single string or an array of strings, and a match on any element counts.
   Asserted through a real JsonWebToken rather than a hand-built Dictionary, because the payload of
   a parsed token is a SymbolDictionary while JsonParser yields a plain Dictionary -- a claim-shape
   test that builds its own Dictionary is not exercising the type the router actually sees. Keycloak
   issues aud as an array, so this is the shape a real deployment presents."
  | claims |
  claims := self validClaims.
  claims at: 'aud' put: (Array with: 'account' with: self canonicalResource).
  self assert: (self rsVerdictFor: claims) isNil
%
category: 'tests - www-authenticate challenge'
method: McpAuthConformanceTest
testChallengeCarriesRequiredScopeOn401
  "Scope Selection Strategy (2025-11-25, draft): 'MCP servers SHOULD include a scope parameter in
   the WWW-Authenticate header ... to indicate the scopes required for accessing the resource',
   illustrated with a 401 example. Clients are told to prefer this over scopes_supported. Without
   it a client requests no scope, is issued a token lacking mcp:use, and only then learns from a
   403 what it needed -- a wasted authorization round trip on every first connection."
  | out challenge |
  out := self driveRequest: (self postInitWithToken: nil) on: self conformantRouter.
  challenge := self headerNamed: 'WWW-Authenticate' in: out.
  self deny: challenge isNil.
  self assert: (self includesCS: 'scope="mcp:use"' in: challenge)
%
category: 'tests - www-authenticate challenge'
method: McpAuthConformanceTest
testChallengeCarriesResourceMetadataWithoutExtraConfiguration
  "2025-06-18, Authorization Server Location: 'MCP servers MUST use the HTTP header
   WWW-Authenticate when returning a 401 Unauthorized to indicate the location of the resource
   server metadata URL'. Unconditional in the OLDEST revision we claim, so the challenge must carry
   resource_metadata whenever the router knows its own identity -- it must not depend on separately
   remembering to set resourceMetadataUrl. run-auth-server.sh never sets it, so every 401 the
   shipped deployment emits today omits it. Derive it from the canonical resource identifier."
  | router out challenge |
  router := self conformantRouter.
  router resourceMetadataUrl: nil.  "the one thing a deployment forgets"
  out := self driveRequest: (self postInitWithToken: nil) on: router.
  challenge := self headerNamed: 'WWW-Authenticate' in: out.
  self deny: challenge isNil.
  self assert: (self includesCS: 'resource_metadata=' in: challenge)
%
category: 'tests - per-request authorization'
method: McpAuthConformanceTest
testDeleteRequiresBearerToken
  "Same requirement as testGetStreamRequiresBearerToken: DELETE ends a session and is a protected
   resource request, so an unauthenticated DELETE must be refused rather than answered 200."
  | out |
  out := self driveRequest: 'DELETE /mcp HTTP/1.1' , self crlf , 'Host: localhost:8443' , self crlf
    , self crlf
    on: self conformantRouter.
  self assert: (self statusOf: out) equals: 401
%
category: 'tests - token validation'
method: McpAuthConformanceTest
testExpiredTokenRejectedWith401
  "Token Handling, all revisions: 'Invalid or expired tokens MUST receive a HTTP 401 response.'
   Asserted end to end AND at the RS layer, since this is the one claim check where an unprovisioned
   fixture user cannot mask the result: both paths must give 401."
  | claims out verdict |
  claims := self validClaims.
  claims at: 'exp' put: System timeGmt - 60.
  verdict := self rsVerdictFor: claims.
  self deny: verdict isNil.
  self assert: (verdict at: 1) equals: 401.
  self assert: (verdict at: 2) equals: 'invalid_token'.
  out := self driveRequest: (self postInitWithToken: (self tokenWithClaims: claims))
    on: self conformantRouter.
  self assert: (self statusOf: out) equals: 401
%
category: 'tests - token validation'
method: McpAuthConformanceTest
testForgedSignatureRejectedAsInvalidTokenNotInsufficientScope
  "OAuth 2.1 section 5.3: a token that fails validation is an INVALID token -- 401 invalid_token, not
   403. A token whose signature does not verify must be refused on that ground alone, before any of its
   claims is believed. Judging an unverified token on its claims (as this router once did, leaving the
   signature to the later GemStone login) meant a forged token whose payload merely lacked a scope came
   back 403 insufficient_scope, describing a forgery as an authorization shortfall.
   This test deliberately does NOT assert that the challenge withholds the scope names. An earlier
   version did, on the theory that naming them to an unauthenticated caller leaked configuration -- but
   that is not a leak this protocol recognises: RFC 9728 has the server publish scopes_supported in a
   metadata document served unauthenticated on purpose, and the Scope Selection Strategy has it repeat
   them in the challenge so a client knows what to ask for. Scope names are public here; only the
   status code was ever wrong.
   Asserted with the fixture key TRUSTED, so the refusal is genuinely about THIS token's signature
   failing to verify, and not merely about the Stone holding no trusted keys at all."
  ^self withConformanceKeyDo: [ | verdict out challenge |
    verdict := self conformantRouter tokenRejectionFor: self forgedToken.
    self deny: verdict isNil.
    self assert: (verdict at: 1) equals: 401.
    self assert: (verdict at: 2) equals: 'invalid_token'.
    out := self driveRequest: (self postInitWithToken: self forgedToken) on: self conformantRouter.
    self assert: (self statusOf: out) equals: 401.
    challenge := self headerNamed: 'WWW-Authenticate' in: out.
    self assert: (self includesCS: 'error="invalid_token"' in: challenge).
    self deny: (self includesCS: 'insufficient_scope' in: challenge)]
%
category: 'tests - per-request authorization'
method: McpAuthConformanceTest
testGetStreamRequiresBearerToken
  "Token Requirements, all revisions: 'authorization MUST be included in every HTTP request from
   client to server, even if they are part of the same logical session', and the server MUST
   validate the token on every protected resource request. The GET SSE stream is a protected
   resource request. Closed by requestAuthorized:on:, which route:on: applies to EVERY verb before
   dispatching it, so a GET is refused here and never reaches serveGet:. It was written red against
   the behavior that preceded that gate: an anonymous GET /mcp answered 200 text/event-stream -- an
   unauthenticated read channel on a network-reachable port, and a way to pin connections and
   worker processes open indefinitely without ever presenting a credential."
  | out |
  out := self driveRequest: (self getPath: '/mcp') on: self conformantRouter.
  self assert: (self statusOf: out) equals: 401
%
category: 'tests - www-authenticate challenge'
method: McpAuthConformanceTest
testInsufficientScopeReturns403WithScopeAndResourceMetadata
  "Scope Challenge Handling (2025-11-25, draft): a token with insufficient scope SHOULD get 403
   with error=insufficient_scope, scope naming the required scopes, and resource_metadata 'for
   consistency with 401 responses'. All required scopes go in ONE challenge.
   Runs with the fixture key trusted: the subject here is a genuinely VALID token that is merely
   under-scoped, so its signature has to verify or it would be refused as invalid_token first."
  ^self withConformanceKeyDo: [ | claims out challenge |
    claims := self validClaims.
    claims at: 'scope' put: 'openid'.  "authenticated, but not authorized for this resource"
    out := self driveRequest: (self postInitWithToken: (self tokenWithClaims: claims))
      on: self conformantRouter.
    self assert: (self statusOf: out) equals: 403.
    challenge := self headerNamed: 'WWW-Authenticate' in: out.
    self deny: challenge isNil.
    self assert: (self includesCS: 'error="insufficient_scope"' in: challenge).
    self assert: (self includesCS: 'scope="mcp:use"' in: challenge).
    self assert: (self includesCS: 'resource_metadata=' in: challenge)]
%
category: 'tests - protected resource metadata'
method: McpAuthConformanceTest
testMetadataAdvertisesAuthorizationServer
  "Authorization Server Location, all revisions: 'The Protected Resource Metadata document returned
   by the MCP server MUST include the authorization_servers field containing at least one
   authorization server.'"
  | meta servers |
  meta := self jsonOf: (self driveRequest: (self getPath: '/.well-known/oauth-protected-resource')
    on: self conformantRouter).
  servers := meta at: 'authorization_servers' ifAbsent: [nil].
  self deny: servers isNil.
  self deny: servers isEmpty.
  self assert: (servers includes: self conformanceIssuer)
%
category: 'tests - protected resource metadata'
method: McpAuthConformanceTest
testMetadataDeclaresScopesSupported
  "Scope Selection Strategy (2025-11-25, draft): scopes_supported in the metadata document is the
   client's documented fallback when the challenge carries no scope -- 'use all scopes defined in
   scopes_supported from the Protected Resource Metadata document'. requiredScopes is exactly the
   value to publish. RFC 9728 lists the field as RECOMMENDED."
  | meta scopes |
  meta := self jsonOf: (self driveRequest: (self getPath: '/.well-known/oauth-protected-resource')
    on: self conformantRouter).
  scopes := meta at: 'scopes_supported' ifAbsent: [nil].
  self deny: scopes isNil.
  self assert: (scopes includes: 'mcp:use')
%
category: 'tests - protected resource metadata'
method: McpAuthConformanceTest
testMetadataOmitsOfflineAccessFromScopesSupported
  "SEP-2207 (status Final), Refresh Tokens: 'MCP Servers (Protected Resources) SHOULD NOT include
   offline_access in WWW-Authenticate scope or Protected Resource Metadata scopes_supported, as
   refresh tokens are not a resource requirement' -- token lifetime is between the client and the
   authorization server. Being Final, it binds independently of which protocol revision
   McpDispatcher claims. It no longer holds vacuously (it once did, before scopes_supported was
   published): conformantRouter advertises mcp:use, so this asserts something real about the
   fixture. It does NOT constrain every deployment, and the geode test deployment knowingly
   deviates -- see the class comment's KNOWN GAPS."
  | meta scopes |
  meta := self jsonOf: (self driveRequest: (self getPath: '/.well-known/oauth-protected-resource')
    on: self conformantRouter).
  scopes := meta at: 'scopes_supported' ifAbsent: [#()].
  self deny: (scopes includes: 'offline_access')
%
category: 'tests - protected resource metadata'
method: McpAuthConformanceTest
testMetadataPathToleratesQueryString
  "A discovery probe carrying a query string must still get metadata. The path is matched by exact
   string equality and parseHead: never splits off the query, so today
   '/.well-known/oauth-protected-resource?x=1' falls through to the inherited SSE handler and the
   client gets an event-stream that never answers instead of a metadata document."
  | out |
  out := self driveRequest: (self getPath: '/.well-known/oauth-protected-resource?x=1')
    on: self conformantRouter.
  self assert: (self statusOf: out) equals: 200.
  self assert: (self headerNamed: 'Content-Type' in: out) equals: 'application/json'
%
category: 'tests - protected resource metadata'
method: McpAuthConformanceTest
testMetadataResourceIgnoresHostHeader
  "RFC 9728: the resource value is the resource's OWN canonical identifier. It must not be derived
   from the request, which the client controls -- two requests differing only in Host must publish
   the same identifier. Today the Host header is echoed into it, so a request carrying
   'Host: evil.example.com' is told the resource is https://evil.example.com/mcp."
  | router fromLocalhost fromElsewhere |
  router := self conformantRouter.
  fromLocalhost := self jsonOf: (self driveRequest:
    (self getPath: '/.well-known/oauth-protected-resource' host: 'localhost:8443' headers: '')
    on: router).
  fromElsewhere := self jsonOf: (self driveRequest:
    (self getPath: '/.well-known/oauth-protected-resource' host: 'evil.example.com' headers: '')
    on: router).
  self assert: (fromElsewhere at: 'resource' ifAbsent: [nil])
    equals: (fromLocalhost at: 'resource' ifAbsent: ['<missing>'])
%
category: 'tests - protected resource metadata'
method: McpAuthConformanceTest
testMetadataResourceMatchesValidatedAudience
  "The identifier the server PUBLISHES must be the one it ENFORCES. A client obeys the metadata
   document when it sets RFC 8707 resource= on its token request, so if the published resource and
   expectedAudience disagree, every token the client can obtain fails the audience check and the
   client sees an unexplainable 401 loop."
  | meta |
  meta := self jsonOf: (self driveRequest: (self getPath: '/.well-known/oauth-protected-resource')
    on: self conformantRouter).
  self assert: (meta at: 'resource' ifAbsent: [nil]) equals: self canonicalResource
%
category: 'tests - protected resource metadata'
method: McpAuthConformanceTest
testMetadataServedAsJsonAtWellKnownRoot
  "RFC 9728 / all revisions: 'MCP servers MUST implement OAuth 2.0 Protected Resource Metadata'.
   The document is served unauthenticated (it is what an unauthenticated client reads to find out
   how to authenticate) as application/json."
  | out |
  out := self driveRequest: (self getPath: '/.well-known/oauth-protected-resource')
    on: self conformantRouter.
  self assert: (self statusOf: out) equals: 200.
  self assert: (self headerNamed: 'Content-Type' in: out) equals: 'application/json'.
  self deny: (self jsonOf: out) isNil
%
category: 'tests - protected resource metadata'
method: McpAuthConformanceTest
testMetadataServedAtPathScopedWellKnownUri
  "Protected Resource Metadata Discovery Requirements, all revisions: for a resource identifier with
   a path component, the well-known URI inserts that path -- 'https://example.com/public/mcp could
   host metadata at https://example.com/.well-known/oauth-protected-resource/public/mcp'. Our
   resource identifier ends in /mcp, and the discovery sequence diagram shows a client probing
   /.well-known/oauth-protected-resource/mcp FIRST, before falling back to the root."
  | out |
  out := self driveRequest: (self getPath: '/.well-known/oauth-protected-resource/mcp')
    on: self conformantRouter.
  self assert: (self statusOf: out) equals: 200.
  self assert: (self headerNamed: 'Content-Type' in: out) equals: 'application/json'
%
category: 'tests - deployment guards'
method: McpAuthConformanceTest
testRefusesNonHttpsAuthorizationServer
  "Communication Security, all revisions: 'All authorization server endpoints MUST be served over
   HTTPS.' The spec's localhost exemption covers redirect URIs, not authorization server endpoints.
   run-auth-server.sh defaults MCP_ISSUER to http://localhost:8080/realms/gs-mcp and puts it
   straight into authorization_servers, so the shipped default advertises a cleartext AS."
  | r |
  r := self tlsOnlyRouter.
  r expectedAudience: self canonicalResource;
    expectedIssuer: 'http://localhost:8080/realms/gs-mcp';
    authorizationServers: #('http://localhost:8080/realms/gs-mcp').
  self should: [r runOnPort: 65001] raise: Error.
  self should: [r forkOnPort: 65001] raise: Error
%
category: 'tests - deployment guards'
method: McpAuthConformanceTest
testRefusesToRunWithoutAuthorizationServer
  "Authorization Server Location, all revisions: the metadata document MUST name at least one
   authorization server. authorizationServers defaults to empty, and nothing checks it, so a
   default router happily publishes 'authorization_servers':[] -- a document that satisfies the
   letter of 'we serve metadata' while telling the client nothing it needs."
  | r |
  r := self tlsOnlyRouter.
  r expectedAudience: self canonicalResource.
  self assert: r authorizationServers isEmpty.
  self should: [r runOnPort: 65001] raise: Error.
  self should: [r forkOnPort: 65001] raise: Error
%
category: 'tests - deployment guards'
method: McpAuthConformanceTest
testRefusesToRunWithoutExpectedAudience
  "Access Token Privilege Restriction, all revisions: audience validation is a MUST, so it cannot
   be optional. expectedAudience defaults to nil meaning 'skip the check', so a router that is
   merely constructed and started accepts a token minted for any resource. Make it a start-up
   invariant, the way requireTls already makes TLS one -- enforced in code because runOnPort: and
   forkOnPort: can be called directly, without the launch script.
   TLS is configured here so requireTls passes and this assertion is about the audience guard."
  | r |
  r := self tlsOnlyRouter.
  r authorizationServers: (Array with: self conformanceIssuer).
  self assert: r expectedAudience isNil.
  self should: [r runOnPort: 65001] raise: Error.
  self should: [r forkOnPort: 65001] raise: Error
%
category: 'tests - per-request authorization'
method: McpAuthConformanceTest
testRoutedRequestRequiresBearerToken
  "The core per-request requirement: 'authorization MUST be included in every HTTP request from
   client to server, even if they are part of the same logical session.' A valid initialize returns
   an MCP-Session-Id; a follow-up carrying ONLY that id and no Authorization header must be refused.
   Today servePost: routes every non-initialize request by session id alone and never looks at a
   token, so the session id is itself the credential -- which is what the transport spec means when
   it says servers MUST NOT use sessions for authentication.
   Needs NETLDI + AllUsers (see the class comment)."
  | router |
  router := self conformantRouter.
  self withJwtUser: 'McpConformanceUser' scope: 'openid mcp:use' do: [:jwt | | initOut sid out |
    initOut := self driveRequest: (self postInitWithToken: jwt) on: router.
    self assert: (self statusOf: initOut) equals: 200.
    sid := self sessionIdFrom: initOut.
    self deny: sid isNil.
    out := self driveRequest: (self postBody: self statusBody
      headers: 'MCP-Session-Id: ' , sid , self crlf) on: router.
    self assert: (self statusOf: out) equals: 401]
%
category: 'tests - per-request authorization'
method: McpAuthConformanceTest
testRoutedRequestWithExpiredTokenRejected
  "'Invalid or expired tokens MUST receive a HTTP 401 response' applies for as long as the session
   lives, not only at initialize. This is the security consequence of authenticating initialize
   alone: nothing re-checks exp afterwards, so access outlives the token. A session stays alive as
   long as it is used more often than the idle reaper's timeout, so a client that keeps working
   keeps its access indefinitely on a token that expired long ago -- and a revoked token is never
   noticed at all.
   Needs NETLDI + AllUsers (see the class comment)."
  | router expiredClaims expired |
  router := self conformantRouter.
  expiredClaims := self validClaims.
  expiredClaims at: 'exp' put: System timeGmt - 60.
  expired := self tokenWithClaims: expiredClaims.
  self withJwtUser: 'McpConformanceUser' scope: 'openid mcp:use' do: [:jwt | | initOut sid out |
    initOut := self driveRequest: (self postInitWithToken: jwt) on: router.
    sid := self sessionIdFrom: initOut.
    self deny: sid isNil.
    out := self driveRequest: (self postBody: self statusBody
      headers: 'MCP-Session-Id: ' , sid , self crlf , 'Authorization: Bearer ' , expired , self crlf)
      on: router.
    self assert: (self statusOf: out) equals: 401]
%
category: 'tests - token validation'
method: McpAuthConformanceTest
testTokenForAnotherAudienceRejectedWith401
  "Access Token Privilege Restriction, all revisions: 'MCP servers MUST only accept tokens
   specifically intended for themselves and MUST reject tokens that do not include them in the
   audience claim.'"
  | claims verdict |
  claims := self validClaims.
  claims at: 'aud' put: 'https://some-other-service.example/api'.
  verdict := self rsVerdictFor: claims.
  self deny: verdict isNil.
  self assert: (verdict at: 1) equals: 401.
  self assert: (verdict at: 2) equals: 'invalid_token'
%
category: 'tests - token validation'
method: McpAuthConformanceTest
testTokenFromUntrustedIssuerRejectedWith401
  "OAuth 2.1 section 5.2: the resource server validates the issuer of a self-contained token."
  | claims verdict |
  claims := self validClaims.
  claims at: 'iss' put: 'https://attacker.example/realms/evil'.
  verdict := self rsVerdictFor: claims.
  self deny: verdict isNil.
  self assert: (verdict at: 1) equals: 401.
  self assert: (verdict at: 2) equals: 'invalid_token'
%
category: 'tests - token validation'
method: McpAuthConformanceTest
testTokenWithoutExpiryRejected
  "OAuth 2.1 section 5.2 token validation: a self-contained access token with no expiry can never be
   shown to be currently valid, so it must be refused. rejectionForPayload: guards its comparison
   with (exp notNil and: [...]), which fails OPEN -- a token carrying no exp claim at all passes
   every RS check and is handed to the login."
  | claims verdict |
  claims := self validClaims.
  claims removeKey: 'exp' ifAbsent: [nil].
  verdict := self rsVerdictFor: claims.
  self deny: verdict isNil.
  self assert: (verdict at: 1) equals: 401
%
category: 'tests - www-authenticate challenge'
method: McpAuthConformanceTest
testUnauthenticatedRequestReturns401WithBearerChallenge
  "Error Handling, all revisions: 401 means 'Authorization required or token invalid', and RFC 6750
   requires a WWW-Authenticate challenge naming the Bearer scheme."
  | out challenge |
  out := self driveRequest: (self postInitWithToken: nil) on: self conformantRouter.
  self assert: (self statusOf: out) equals: 401.
  challenge := self headerNamed: 'WWW-Authenticate' in: out.
  self deny: challenge isNil.
  self assert: (self includesCS: 'Bearer' in: challenge)
%
category: 'fixture routers'
method: McpAuthConformanceTest
tlsOnlyRouter
  "A router with TLS credentials and NOTHING else configured. Used by the start-up guard tests: TLS
   is set so requireTls passes and the assertion is about the guard under test, not about TLS."
  | r |
  r := McpAuthRouter new.
  r useTlsCertificateFile: '/tmp/mcp-conformance.crt' privateKeyFile: '/tmp/mcp-conformance.key'.
  ^r
%
category: 'token fixtures'
method: McpAuthConformanceTest
tokenWithClaims: aClaimsDict
  "An RSA-256 JWT carrying exactly aClaimsDict as extra payload claims (on top of nothing else).
   Signed with JsonWebToken's example private key so it parses; no GemStone user is provisioned, so
   it is only useful for RS-layer (pre-login) assertions."
  | tok |
  tok := JsonWebToken newForRsa256.
  tok keyId: 'mcp-conformance-key'.
  aClaimsDict keysAndValuesDo: [:k :v | tok payloadClaimAt: k put: v].
  tok signWithPrivateKey: JsonWebToken example_privateKey.
  ^tok asJwtString
%
category: 'token fixtures'
method: McpAuthConformanceTest
validClaims
  "Payload claims that should pass every RS-layer check of conformantRouter."
  | d |
  d := Dictionary new.
  d at: 'sub' put: 'conformanceUser'.
  d at: 'iss' put: self conformanceIssuer.
  d at: 'aud' put: self canonicalResource.
  d at: 'scope' put: 'openid mcp:use'.
  d at: 'exp' put: System timeGmt + 3600.
  ^d
%
category: 'helpers'
method: McpAuthConformanceTest
withConformanceKeyDo: aBlock
  "Register the example public key as a TRUSTED Stone key under conformanceKeyId for the duration of
   aBlock, then remove it. Needed because tokenRejectionFor: verifies a token's signature against the
   Stone's trusted keys before believing any claim, so a fixture token is only meaningful while its
   key is trusted.
   Removes any leftover of the same id before adding: System addJwtKey:withId: RAISES when the id
   already exists, so a previous test that died before its cleanup would otherwise break every test
   after it."
  [System removeJwtKeyWithId: self conformanceKeyId] on: Error do: [:e | nil].
  System addJwtKey: JsonWebToken example_publicKey withId: self conformanceKeyId.
  ^[aBlock value] ensure: [
    [System removeJwtKeyWithId: self conformanceKeyId] on: Error do: [:e | nil]]
%
category: 'token fixtures'
method: McpAuthConformanceTest
withJwtUser: aUserId scope: aScopeStringOrNil do: aOneArgBlock
  "Provision a JWT-enabled UserProfile for aUserId plus a trusted signing key, mint a matching JWT
   whose claims satisfy conformantRouter, evaluate aOneArgBlock with the JWT string, and ALWAYS
   clean up. Mirrors McpAuthTest>>withJwtUser:scope:do: -- it commits, so it touches AllUsers, and
   the caller will spawn a worker gem (needs NETLDI)."
  | keyId jwtSec up now tok |
  keyId := 'mcp-conformance-key'.
  (AllUsers userWithId: aUserId ifAbsent: [nil]) ifNotNil: [:u |
    AllUsers removeAndCleanupUserWithId: aUserId ifAbsent: [nil]. System commitTransaction].
  jwtSec := JwtSecurityData new.
  jwtSec userIdKey: #sub; addUserId: aUserId; addIssuer: #*; addAudience: #*.
  up := AllUsers addNewUserWithId: aUserId password: 'swordfishXYZ'.
  up enableJwtAuthenticationWith: jwtSec.
  System commitTransaction.
  System addJwtKey: JsonWebToken example_publicKey withId: keyId.
  now := System timeGmt.
  tok := JsonWebToken newForRsa256.
  tok subject: aUserId; issuer: self conformanceIssuer; audience: self canonicalResource; keyId: keyId;
    issuedAtTime: now; expirationTime: now + 3600.
  aScopeStringOrNil ifNotNil: [:sc | tok payloadClaimAt: 'scope' put: sc].
  tok signWithPrivateKey: JsonWebToken example_privateKey.
  ^[aOneArgBlock value: tok asJwtString] ensure: [
    [System removeJwtKeyWithId: keyId] on: Error do: [:e | nil].
    [AllUsers removeAndCleanupUserWithId: aUserId ifAbsent: [nil]. System commitTransaction]
      on: Error do: [:e | nil]]
%
