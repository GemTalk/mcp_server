set compile_env: 0
! ------------------- Class definition for McpAuthTest
expectvalue /Class
doit
GsTestCase subclass: 'McpAuthTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpAuthTest comment: 
'Unit tests for McpAuthRouter (the JWT-authenticating, network-facing front end). The 401 tests
need no fixtures; testValidTokenOpensPerUserSession uses withJwtUser:do: to create + commit a
throwaway JWT-enabled UserProfile and a signing key, and cleans them up afterward -- so this suite
touches AllUsers and spawns a real worker gem (needs netldi), unlike the other unit suites.'
%
expectvalue /Class
doit
McpAuthTest category: 'MCPServer'
%
! ------------------- Remove existing behavior from McpAuthTest
removeallmethods McpAuthTest
removeallclassmethods McpAuthTest
! ------------------- Class methods for McpAuthTest
! ------------------- Instance methods for McpAuthTest
category: 'helpers'
method: McpAuthTest
callBody: toolName arguments: anArgsJsonString
  "A tools/call JSON-RPC body for toolName with the given raw JSON arguments object."
  ^'{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"' , toolName
    , '","arguments":' , anArgsJsonString , '}}'
%
category: 'helpers'
method: McpAuthTest
crlf
  ^String with: Character cr with: Character lf
%
category: 'helpers'
method: McpAuthTest
get: path
  "A raw HTTP GET request for path, no body."
  | crlf |
  crlf := self crlf.
  ^'GET ' , path , ' HTTP/1.1' , crlf , 'Host: localhost' , crlf , crlf
%
category: 'helpers'
method: McpAuthTest
includesCS: aSubstring in: aString
  "Case-sensitive substring test (String>>includesString: is case-INsensitive in GemStone)."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'helpers'
method: McpAuthTest
initBody
  ^'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
%
category: 'helpers'
method: McpAuthTest
post: body headers: extraHeaderLines
  "A raw HTTP POST /mcp request carrying body as application/json, plus extraHeaderLines (a String
   of complete CRLF-terminated header lines, or '' for none)."
  | crlf |
  crlf := self crlf.
  ^'POST /mcp HTTP/1.1' , crlf , 'Host: localhost' , crlf , extraHeaderLines ,
   'Content-Type: application/json' , crlf ,
   'Content-Length: ' , body size printString , crlf , crlf , body
%
category: 'helpers'
method: McpAuthTest
runRequest: rawRequest on: aRouter
  "Drive aRouter's handleConnection: with rawRequest via a mock socket; answer the captured
   response. Takes the router so a test can drive several requests against one instance (to share
   its session map)."
  | mock |
  mock := McpMockSocket on: rawRequest.
  aRouter handleConnection: (McpHttpConnection on: mock).
  ^mock output
%
category: 'helpers'
method: McpAuthTest
sessionIdFrom: aResponse
  "The MCP-Session-Id header value from a raw HTTP response, or nil if absent."
  | line |
  line := (aResponse subStrings: self crlf)
    detect: [:l | (l asLowercase indexOfSubCollection: 'mcp-session-id:') = 1] ifNone: [^nil].
  ^(line copyFrom: (line indexOf: $:) + 1 to: line size) trimSeparators
%
category: 'helpers'
method: McpAuthTest
statusBody
  ^'{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"status","arguments":{}}}'
%
category: 'tests'
method: McpAuthTest
testAudienceArrayMatchAccepted
  "aud may be an array; a match on any element passes."
  | p router |
  router := McpAuthRouter new.
  router requiredScopes: #(); expectedIssuer: nil; expectedAudience: 'https://mcp.example/mcp'.
  p := Dictionary new. p at: 'exp' put: System timeGmt + 1000.
  p at: 'aud' put: (Array with: 'x' with: 'https://mcp.example/mcp').
  self assert: (router rejectionForPayload: p) isNil
%
category: 'tests'
method: McpAuthTest
testAudienceMismatchRejected401
  "RS-layer audience check (RFC 8707): a token whose aud omits this resource is rejected 401."
  | p r router |
  router := McpAuthRouter new.
  router requiredScopes: #(); expectedIssuer: nil; expectedAudience: 'https://mcp.example/mcp'.
  p := Dictionary new. p at: 'exp' put: System timeGmt + 1000. p at: 'aud' put: 'someone-else'.
  r := router rejectionForPayload: p.
  self deny: r isNil.
  self assert: (r at: 1) equals: 401.
  self assert: (r at: 2) equals: 'invalid_token'
%
category: 'tests'
method: McpAuthTest
testExpiredTokenRejected401
  "RS-layer expiry check: a token whose exp is in the past is rejected 401 invalid_token."
  | p r router |
  router := McpAuthRouter new.
  router requiredScopes: #(); expectedAudience: nil; expectedIssuer: nil.
  p := Dictionary new. p at: 'exp' put: System timeGmt - 100.
  r := router rejectionForPayload: p.
  self deny: r isNil.
  self assert: (r at: 1) equals: 401.
  self assert: (r at: 2) equals: 'invalid_token'
%
category: 'tests'
method: McpAuthTest
testFutureExpiryAccepted
  "A token with a future exp and no other constraints passes RS-layer validation."
  | p router |
  router := McpAuthRouter new.
  router requiredScopes: #(); expectedAudience: nil; expectedIssuer: nil.
  p := Dictionary new. p at: 'exp' put: System timeGmt + 1000.
  self assert: (router rejectionForPayload: p) isNil
%
category: 'tests'
method: McpAuthTest
testGarbageBearerReturns401
  | out |
  out := self runRequest: (self post: self initBody headers: 'Authorization: Bearer not.a.jwt' , self crlf) on: McpAuthRouter new.
  self assert: (self includesCS: 'HTTP/1.1 401 Unauthorized' in: out)
%
category: 'tests'
method: McpAuthTest
testInsufficientScopeRejected403
  "RS-layer scope check: a token lacking a required scope is rejected 403 insufficient_scope."
  | p r router |
  router := McpAuthRouter new.
  router expectedAudience: nil; expectedIssuer: nil; requiredScopes: #('mcp:use').
  p := Dictionary new. p at: 'exp' put: System timeGmt + 1000.
  r := router rejectionForPayload: p.
  self deny: r isNil.
  self assert: (r at: 1) equals: 403.
  self assert: (r at: 2) equals: 'insufficient_scope'
%
category: 'tests'
method: McpAuthTest
testInsufficientScopeReturns403
  "End-to-end: a valid signed token lacking a required scope is refused 403 insufficient_scope at
   initialize, BEFORE any GemStone login (the RS-layer check)."
  | router |
  router := McpAuthRouter new.
  router expectedAudience: nil; expectedIssuer: nil; requiredScopes: #('mcp:use'); userIdClaim: 'sub'.
  self withJwtUser: 'McpScopeTestUser' do: [:jwt | | out |
    out := self runRequest: (self post: self initBody headers: 'Authorization: Bearer ' , jwt , self crlf) on: router.
    self assert: (self includesCS: 'HTTP/1.1 403 Forbidden' in: out).
    self assert: (self includesCS: 'insufficient_scope' in: out)]
%
category: 'tests'
method: McpAuthTest
testIssuerMismatchRejected401
  "RS-layer issuer check: a token from an untrusted issuer is rejected 401 invalid_token."
  | p r router |
  router := McpAuthRouter new.
  router requiredScopes: #(); expectedAudience: nil; expectedIssuer: 'https://trusted'.
  p := Dictionary new. p at: 'exp' put: System timeGmt + 1000. p at: 'iss' put: 'https://evil'.
  r := router rejectionForPayload: p.
  self deny: r isNil.
  self assert: (r at: 1) equals: 401.
  self assert: (r at: 2) equals: 'invalid_token'
%
category: 'tests'
method: McpAuthTest
testMissingTokenReturns401
  | out |
  out := self runRequest: (self post: self initBody headers: '') on: McpAuthRouter new.
  self assert: (self includesCS: 'HTTP/1.1 401 Unauthorized' in: out).
  self assert: (self includesCS: 'WWW-Authenticate: Bearer' in: out)
%
category: 'tests'
method: McpAuthTest
testNonBearerReturns401
  | out |
  out := self runRequest: (self post: self initBody headers: 'Authorization: Basic Zm9v' , self crlf) on: McpAuthRouter new.
  self assert: (self includesCS: 'HTTP/1.1 401 Unauthorized' in: out)
%
category: 'tests'
method: McpAuthTest
testProtectedResourceMetadataSchemeFollowsTls
  "The RFC 9728 `resource` identifier's scheme must follow the transport: plaintext -> http, and
   TLS-enabled -> https (not a hard-coded http). tlsEnabled only checks that both cert+key paths are
   set, so throwaway paths suffice. Each router carries its own TLS config, so the two cases are just
   two instances -- nothing global is touched and nothing needs restoring."
  | plain secure |
  plain := McpAuthRouter new.
  plain disableTls.
  self assert: (self includesCS: '"resource":"http://'
    in: (self runRequest: (self get: '/.well-known/oauth-protected-resource') on: plain)).
  secure := McpAuthRouter new.
  secure useTlsCertificateFile: '/tmp/mcp-x.crt' privateKeyFile: '/tmp/mcp-x.key'.
  self assert: (self includesCS: '"resource":"https://'
    in: (self runRequest: (self get: '/.well-known/oauth-protected-resource') on: secure))
%
category: 'tests'
method: McpAuthTest
testProtectedResourceMetadataServed
  "The RFC 9728 metadata endpoint is served (unauthenticated) at the well-known path."
  | out |
  out := self runRequest: (self get: '/.well-known/oauth-protected-resource') on: McpAuthRouter new.
  self assert: (self includesCS: 'HTTP/1.1 200 OK' in: out).
  self assert: (self includesCS: '"resource"' in: out).
  self assert: (self includesCS: '"authorization_servers"' in: out)
%
category: 'tests'
method: McpAuthTest
testRequiresTlsToServe
  "A bearer token is a password that rides in a header on every request, so this router refuses to
   serve cleartext. The guard lives in requireTls and BOTH entry points check it, so calling
   runOnPort:/forkOnPort: directly cannot bypass what run-auth-server.sh enforces. Enforced even for
   the default loopback bindAddress, since widening the address later must not silently downgrade
   the transport. Neither call reaches a socket: the guard signals first.
   Asserted against Error rather than the concrete UserDefinedError that `self error:` signals, so
   the test survives the guard being reimplemented with a purpose-built exception class."
  | r |
  r := McpAuthRouter new.
  self deny: r tlsEnabled.
  self should: [r requireTls] raise: Error.
  self should: [r runOnPort: 65000] raise: Error.
  self should: [r forkOnPort: 65000] raise: Error.
  "with credentials set the guard passes and answers the router (tlsEnabled only checks both paths
   are present, so throwaway paths suffice here)"
  r useTlsCertificateFile: '/tmp/nonexistent.crt' privateKeyFile: '/tmp/nonexistent.key'.
  self shouldnt: [r requireTls] raise: Error.
  self assert: r requireTls == r
%
category: 'tests'
method: McpAuthTest
testSufficientScopeAccepted
  "A token whose space-delimited scope claim contains the required scope passes."
  | p router |
  router := McpAuthRouter new.
  router expectedAudience: nil; expectedIssuer: nil; requiredScopes: #('mcp:use').
  p := Dictionary new. p at: 'exp' put: System timeGmt + 1000. p at: 'scope' put: 'openid mcp:use extra'.
  self assert: (router rejectionForPayload: p) isNil
%
category: 'tests'
method: McpAuthTest
testTokenWithoutWriteScopeGivesReadOnlySession
  "#7b: with a writeScope configured, a token lacking it opens a read-only worker -- a mutating tool
   is refused (kind readOnly) while a safe tool still works. Target a kernel class so a regression
   can't mutate anything."
  | router |
  router := McpAuthRouter new.
  router expectedAudience: nil; expectedIssuer: nil; requiredScopes: #(); writeScope: 'mcp:write';
    userIdClaim: 'sub'.
  self withJwtUser: 'McpWriteScopeUser' do: [:jwt | | sid out |
    out := self runRequest: (self post: self initBody headers: 'Authorization: Bearer ' , jwt , self crlf) on: router.
    self assert: (self includesCS: 'HTTP/1.1 200 OK' in: out).
    sid := self sessionIdFrom: out.
    self deny: sid isNil.
    out := self runRequest: (self post: (self callBody: 'compile_method' arguments: '{"className":"Object","source":"x ^1"}')
      headers: 'MCP-Session-Id: ' , sid , self crlf) on: router.
    self assert: (self includesCS: 'readOnly' in: out).
    out := self runRequest: (self post: self statusBody headers: 'MCP-Session-Id: ' , sid , self crlf) on: router.
    self assert: (self includesCS: 'user=McpWriteScopeUser' in: out)]
%
category: 'tests'
method: McpAuthTest
testTokenWithWriteScopeGivesWritableSession
  "#7b: a token that DOES carry the writeScope opens a full read-write worker -- a mutating/execution
   tool runs normally."
  | router |
  router := McpAuthRouter new.
  router expectedAudience: nil; expectedIssuer: nil; requiredScopes: #(); writeScope: 'mcp:write';
    userIdClaim: 'sub'.
  self withJwtUser: 'McpWriteScopeUser' scope: 'openid mcp:write' do: [:jwt | | sid out |
    out := self runRequest: (self post: self initBody headers: 'Authorization: Bearer ' , jwt , self crlf) on: router.
    sid := self sessionIdFrom: out.
    self deny: sid isNil.
    out := self runRequest: (self post: (self callBody: 'execute_code' arguments: '{"code":"6 * 7"}')
      headers: 'MCP-Session-Id: ' , sid , self crlf) on: router.
    self assert: (self includesCS: '42' in: out).
    self deny: (self includesCS: 'readOnly' in: out)]
%
category: 'tests'
method: McpAuthTest
testValidScopedTokenOpensSession
  "End-to-end: a valid token carrying the required scope passes the RS check and opens a per-user
   worker session (200 + MCP-Session-Id)."
  | router |
  router := McpAuthRouter new.
  router expectedAudience: nil; expectedIssuer: nil; requiredScopes: #('mcp:use'); userIdClaim: 'sub'.
  self withJwtUser: 'McpScopeTestUser' scope: 'openid mcp:use' do: [:jwt | | out |
    out := self runRequest: (self post: self initBody headers: 'Authorization: Bearer ' , jwt , self crlf) on: router.
    self assert: (self includesCS: 'HTTP/1.1 200 OK' in: out).
    self assert: (self includesCS: 'MCP-Session-Id:' in: out)]
%
category: 'tests'
method: McpAuthTest
testValidTokenOpensPerUserSession
  "A valid Bearer JWT authenticates initialize (200 + MCP-Session-Id) and opens a worker running as
   the token's GemStone user -- proven by a routed status call reporting that user.
   Pins the RS-layer config on its own router, as the other success-path tests do: this token
   carries no scope claim, so an inherited requiredScopes would turn the initialize into a 403 and
   fail this test for a reason unrelated to what it checks."
  | router |
  router := McpAuthRouter new.
  router requiredScopes: #(); expectedAudience: nil; expectedIssuer: nil; userIdClaim: 'sub'.
  self withJwtUser: 'McpAuthTestUser' do: [:jwt | | initOut sid statusOut |
    initOut := self runRequest: (self post: self initBody headers: 'Authorization: Bearer ' , jwt , self crlf) on: router.
    self assert: (self includesCS: 'HTTP/1.1 200 OK' in: initOut).
    self assert: (self includesCS: 'MCP-Session-Id:' in: initOut).
    sid := self sessionIdFrom: initOut.
    self deny: sid isNil.
    statusOut := self runRequest: (self post: self statusBody headers: 'MCP-Session-Id: ' , sid , self crlf) on: router.
    self assert: (self includesCS: 'user=McpAuthTestUser' in: statusOut)]
%
category: 'helpers'
method: McpAuthTest
withJwtUser: aUserId do: aOneArgBlock
  "withJwtUser:scope:do: with no scope claim on the token."
  ^self withJwtUser: aUserId scope: nil do: aOneArgBlock
%
category: 'helpers'
method: McpAuthTest
withJwtUser: aUserId scope: aScopeStringOrNil do: aOneArgBlock
  "Provision a JWT-enabled UserProfile for aUserId (identity from the 'sub' claim, wildcard
   issuer/audience) + register a signing key, mint a matching JWT (carrying aScopeStringOrNil as its
   space-delimited `scope` claim when non-nil), evaluate aOneArgBlock with the JWT string, and
   ALWAYS clean up the key + user afterward. Answers the block's value."
  | keyId jwtSec up now tok |
  keyId := 'mcp-authtest-key'.
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
  tok subject: aUserId; issuer: 'https://test'; audience: 'gs-mcp'; keyId: keyId;
    issuedAtTime: now; expirationTime: now + 3600.
  aScopeStringOrNil ifNotNil: [:sc | tok payloadClaimAt: 'scope' put: sc].
  tok signWithPrivateKey: JsonWebToken example_privateKey.
  ^[aOneArgBlock value: tok asJwtString] ensure: [
    [System removeJwtKeyWithId: keyId] on: Error do: [:e | nil].
    [AllUsers removeAndCleanupUserWithId: aUserId ifAbsent: [nil]. System commitTransaction] on: Error do: [:e | nil]]
%
