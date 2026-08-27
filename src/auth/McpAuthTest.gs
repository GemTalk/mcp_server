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
McpAuthTest category: 'Mcp-Auth-Tests'
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
category: 'helpers'
method: McpAuthTest
jwtForUser: aUserId expiringIn: seconds writeScope: aBoolean
  "A parseable JWT carrying sub, exp and (optionally) the write scope. The signature segment is
   filler: every method under test here parses the token WITHOUT verifying it, because verification
   already happened in #tokenRejectionFor: earlier in the request. alg must still name a real
   algorithm -- JsonWebToken rejects alg 'none' outright, so a token that claims to be unsigned
   cannot even be built by accident."
  | enc scopes |
  enc := [:str | (str asByteArray asBase64UrlString) select: [:c | c ~= $=]].
  scopes := aBoolean ifTrue: ['mcp:use mcp:write'] ifFalse: ['mcp:use'].
  ^(enc value: '{"alg":"RS256","typ":"JWT"}')
    , '.' , (enc value: '{"sub":"' , aUserId , '","exp":'
        , (System timeGmt + seconds) printString , ',"scope":"' , scopes , '"}')
    , '.' , (enc value: 'signature-not-checked-here')
%
category: 'helpers'
method: McpAuthTest
renewingRouter
  "An auth router with per-session write gating on, which is what makes the scope half of renewal
   meaningful: with no writeScope configured every token grants write."
  | router |
  router := McpAuthRouter new.
  router writeScope: 'mcp:write'.
  ^router
%
category: 'tests'
method: McpAuthTest
testARefreshedTokenBuysAWriteSessionMoreLife
  "The defect this exists to fix. A session's deadline is stamped once, from the token that opened
   it, so a client working steadily lost its worker gem -- and the uncommitted transaction in it --
   one access-token lifetime after opening, however recently it had called. A fresh token for the
   same user is a renewed grant, and it now moves the deadline."
  | router sess |
  router := self renewingRouter.
  sess := McpStubSession new startWithId: 'sid-renew'.
  sess expiresAtSeconds: System timeGmt + 60.
  self assert: (router renewSessionExpiry: sess
    from: (self jwtForUser: 'alice' expiringIn: 1800 writeScope: true)).
  self assert: sess expiresAtSeconds > (System timeGmt + 1000)
%
category: 'tests'
method: McpAuthTest
testATokenThatLostTheWriteScopeBuysNoMoreLife
  "A read-WRITE session must not be extended on a token that no longer carries the write scope: the
   session's mode was fixed at open, so that would keep a broader authorization alive on the strength
   of a grant the client has demonstrably lost. The token still WORKS -- it is valid and belongs to
   the session's user -- it just buys no time, so the session ends at its existing deadline and the
   next one opens read-only, which is what the current grant actually says."
  | router sess deadline |
  router := self renewingRouter.
  sess := McpStubSession new startWithId: 'sid-narrowed'.
  self deny: sess readOnly.
  deadline := System timeGmt + 60.
  sess expiresAtSeconds: deadline.
  self deny: (router renewSessionExpiry: sess
    from: (self jwtForUser: 'alice' expiringIn: 1800 writeScope: false)).
  self assert: sess expiresAtSeconds equals: deadline
%
category: 'tests'
method: McpAuthTest
testAReadOnlySessionIsRenewedByAReadOnlyToken
  "The mirror of the above: a session that never had write access is not being handed anything it
   lacks, so a token without the write scope renews it normally. Otherwise read-only sessions would
   be the only ones still capped at their opening token."
  | router sess |
  router := self renewingRouter.
  sess := McpStubSession new startWithId: 'sid-ro'; beReadOnly; yourself.
  sess expiresAtSeconds: System timeGmt + 60.
  self assert: sess readOnly.
  self assert: (router renewSessionExpiry: sess
    from: (self jwtForUser: 'alice' expiringIn: 1800 writeScope: false)).
  self assert: sess expiresAtSeconds > (System timeGmt + 1000)
%
category: 'tests'
method: McpAuthTest
testPresentingTheSameTokenAgainRenewsNothing
  "Every request carries a token, so the overwhelmingly common case is the SAME token as last time.
   That must report no movement, or the router would log a renewal on every single request."
  | router sess jwt |
  router := self renewingRouter.
  sess := McpStubSession new startWithId: 'sid-same'.
  jwt := self jwtForUser: 'alice' expiringIn: 1800 writeScope: true.
  sess expiresAtSeconds: (router tokenExpirySecondsOf: jwt).
  self deny: (router renewSessionExpiry: sess from: jwt)
%
category: 'tests'
method: McpAuthTest
testAnUnparseableTokenBuysNoTimeOnAWriteSession
  "Fail safe in the direction that matters now that this parse can EXTEND a life rather than only
   shorten one: a token that cannot be read grants no write scope, so it cannot lengthen a
   read-write session."
  | router sess deadline |
  router := self renewingRouter.
  sess := McpStubSession new startWithId: 'sid-garbage'.
  deadline := System timeGmt + 60.
  sess expiresAtSeconds: deadline.
  self deny: (router renewSessionExpiry: sess from: 'not.a.jwt').
  self assert: sess expiresAtSeconds equals: deadline
%
category: 'tests'
method: McpAuthTest
testAnAuthRouterTellsAClientToRefreshItsToken
  "The advice that fits an access token's exp: refreshing keeps the session, because a request
   carrying the refreshed token extends it."
  | router sess advice |
  router := McpAuthRouter new.
  sess := McpStubSession new startWithId: 'sid-advice'.
  sess expiresAtSeconds: System timeGmt + 60.
  advice := router expiryAdviceFor: sess.
  self assert: (self includesCS: 'refreshes its token' in: advice).
  self deny: (self includesCS: 'cannot be extended' in: advice)
%
category: 'tests'
method: McpAuthTest
testAFixedCapOutranksTheRefreshAdvice
  "When maxSessionLifetimeSeconds is the BINDING deadline rather than the token, telling the client
   to refresh would be advice that cannot work: the cap is on the session, not the credential. The
   two are told apart by arithmetic on stored integers -- the cap falls at startedAtSeconds + cap."
  | router sess advice |
  router := McpAuthRouter new.
  router maxSessionLifetimeSeconds: 600.
  sess := McpStubSession new startWithId: 'sid-capped'.
  sess expiresAtSeconds: sess startedAtSeconds + 600.
  advice := router expiryAdviceFor: sess.
  self assert: (self includesCS: 'cannot be extended' in: advice).
  self deny: (self includesCS: 'refreshes its token' in: advice)
%
category: 'tests'
method: McpAuthTest
testATokenExpiringBeforeTheCapStillGetsRefreshAdvice
  "The other half: a cap is configured but the token expires first, so the token IS the binding
   deadline and refreshing it is exactly the right advice."
  | router sess advice |
  router := McpAuthRouter new.
  router maxSessionLifetimeSeconds: 86400.
  sess := McpStubSession new startWithId: 'sid-token-first'.
  sess expiresAtSeconds: System timeGmt + 300.
  advice := router expiryAdviceFor: sess.
  self assert: (self includesCS: 'refreshes its token' in: advice)
%
category: 'tests'
method: McpAuthTest
testAnUnreadableTokenExpiryLeavesTheIdlePolicyInCharge
  "Fail soft, not open: a token whose exp cannot be parsed simply leaves the session bound by the
   idle policy alone, which is where it stood before this existed. It cannot fail OPEN, because the
   token's claims were validated before this point and are validated again by GemStone at login."
  | router |
  router := McpAuthRouter new.
  self assert: (router tokenExpirySecondsOf: 'not.a.jwt') isNil.
  self assert: (router tokenExpirySecondsOf: '') isNil
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
testAuthRouterResolvesWorkerConfigForItsSessions
  "An authenticated router resolves the worker class and tool surface exactly like the base one, and
   hands them to each session it opens -- openSessionForUser:jwt: goes through openSessionCreating:,
   so nothing here is auth-specific except who the worker logs in as. Uses a stub session, so no JWT
   user and no gem are needed.
   Worth pinning on this branch because it is the path a per-token surface will hook into: narrowing
   toolsetNames by the token's scopes can only happen where the token is, i.e. in the front end."
  | r sess |
  r := McpAuthRouter new.
  self assert: r effectiveWorkerClassName equals: 'McpServer'.
  self assert: r effectiveToolsetNames equals: McpServer installedDefaultToolsetNames.
  r workerClassName: 'McpFixtureServer'; toolsetNames: #('McpFixtureToolset'); serverName: 'acme-db-mcp'.
  sess := r openSessionCreating: [:id | McpStubSession new].
  self assert: sess workerClassName equals: 'McpFixtureServer'.
  self assert: sess wasPrepared.
  self assert: (sess workerExpressionFor: '{}') equals: 'McpFixtureServer handleJsonString: ''{}'''
%
category: 'tests'
method: McpAuthTest
testBindAddressIsConfigurableButDefaultsToLoopback
  "McpAuthRouter DOES take a bindAddress -- every request must carry a bearer token -- but it still
   starts on loopback, so reachability is something the caller asks for explicitly."
  | r |
  r := McpAuthRouter new.
  self assert: r bindAddress equals: '127.0.0.1'.
  self assert: (McpAuthRouter canUnderstand: #bindAddress:).
  r bindAddress: '172.16.73.10'.
  self assert: r bindAddress equals: '172.16.73.10'.
  self assert: (r configDict at: 'bindAddress') equals: '172.16.73.10'
%
category: 'tests'
method: McpAuthTest
testConfigJsonRoundTripsCarriesRsKeys
  "The fork-string mechanism for McpAuthRouter: config survives configJson -> applyConfigJson:
   exactly, including the Resource-Server-layer keys (the base allow-list is covered in
   McpTransportTest). Every set field is carried; an unset field keeps its safe default."
  | src dst |
  src := McpAuthRouter new.
  src readOnly: true;
    allowedOriginHosts: #('example.com');
    bindAddress: '172.16.73.10';
    userIdClaim: 'preferred_username';
    requiredScopes: #('mcp:use');
    extraScopes: #('profile');
    expectedIssuer: 'https://issuer';
    writeScope: 'mcp:write';
    workerClassName: 'McpFixtureServer';
    toolsetNames: #('McpFixtureToolset');
    serverName: 'acme-db-mcp';
    serverVersion: '2.5.0'.
  dst := McpAuthRouter new applyConfigJson: src configJson.
  self assert: dst readOnly.
  "the worker-config keys inherited from McpRouter travel too -- McpAuthRouter extends the base
   allow-list via super, so an authenticated deployment can pick its tool surface the same way"
  self assert: dst workerClassName equals: 'McpFixtureServer'.
  self assert: dst toolsetNames equals: #('McpFixtureToolset').
  self assert: dst serverName equals: 'acme-db-mcp'.
  self assert: dst serverVersion equals: '2.5.0'.
  self assert: dst allowedOriginHosts equals: #('example.com').
  self assert: dst bindAddress equals: '172.16.73.10'.
  self assert: dst userIdClaim equals: 'preferred_username'.
  self assert: dst requiredScopes equals: #('mcp:use').
  self assert: dst extraScopes equals: #('profile').
  self assert: dst expectedIssuer equals: 'https://issuer'.
  self assert: dst writeScope equals: 'mcp:write'.
  self assert: dst expectedAudience isNil.       "unset optional stays nil through the round-trip"
  self assert: dst tlsCertificateFile isNil.
  "supportedScopes is derived, not carried: the far side rebuilds the same union from the three
   configured fields, so it must come out identical without ever appearing in the config dict"
  self deny: (src configDict includesKey: 'supportedScopes').
  self assert: dst supportedScopes equals: #('mcp:use' 'mcp:write' 'profile').
  self assert: dst supportedScopes equals: src supportedScopes.
  "an unconfigured router round-trips to its defaults -- bindAddress must stay loopback, since a
   silently-widened bind would expose the server; with nothing required, no writeScope and no
   extras, the derived union is empty"
  self assert: (McpAuthRouter new applyConfigJson: McpAuthRouter new configJson) userIdClaim equals: 'sub'.
  self assert: (McpAuthRouter new applyConfigJson: McpAuthRouter new configJson) bindAddress equals: '127.0.0.1'.
  self assert: (McpAuthRouter new applyConfigJson: McpAuthRouter new configJson) supportedScopes equals: #()
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
testProtectedResourceMetadataPublishesConfiguredResource
  "The RFC 9728 `resource` identifier is the CONFIGURED canonical identifier (expectedAudience) --
   the same value the router validates in a token's aud claim -- and it does not vary with the
   transport or with the request.
   This replaces an earlier test asserting the opposite (that the scheme followed the router's own
   TLS setting, over a host taken from the request's Host header). Both derivations were wrong: what
   the router publishes must be what it enforces, or a client that obeys the document obtains a token
   this router then refuses; and taking the host from the request let the caller choose the identifier
   we publish. Each router carries its own config, so the two cases here are just two instances --
   nothing global is touched and nothing needs restoring."
  | id plain secure spoofed |
  id := 'https://mcp.example:8443/mcp'.
  plain := McpAuthRouter new.
  plain expectedAudience: id.
  plain disableTls.
  self assert: (self includesCS: '"resource":"' , id , '"'
    in: (self runRequest: (self get: '/.well-known/oauth-protected-resource') on: plain)).
  secure := McpAuthRouter new.
  secure expectedAudience: id.
  secure useTlsCertificateFile: '/tmp/mcp-x.crt' privateKeyFile: '/tmp/mcp-x.key'.
  self assert: (self includesCS: '"resource":"' , id , '"'
    in: (self runRequest: (self get: '/.well-known/oauth-protected-resource') on: secure)).
  "a spoofed Host must not change what we publish"
  spoofed := 'GET /.well-known/oauth-protected-resource HTTP/1.1' , self crlf ,
    'Host: evil.example.com' , self crlf , self crlf.
  self assert: (self includesCS: '"resource":"' , id , '"'
    in: (self runRequest: spoofed on: secure))
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
testRequiredScopeAndWriteScopeAlwaysAdvertised
  "The advertised set is derived, so the two configurations that used to need validating are now
   unrepresentable. A required scope a client is never told to request could never be obtained
   (every token refused insufficient_scope); a writeScope a client is never told to request could
   never be granted (every session read-only forever). Neither can be expressed: extraScopes cannot
   displace what the union already contains, so requireResourceServerConfig has nothing to check and
   accepts any extras at all -- there is no superset rule for a caller to get wrong."
  | r |
  r := McpAuthRouter new.
  r useTlsCertificateFile: '/tmp/x.crt' privateKeyFile: '/tmp/x.key';
    expectedAudience: 'https://mcp.example/mcp';
    authorizationServers: #('https://issuer.example');
    requiredScopes: #('mcp:use');
    writeScope: 'mcp:write';
    extraScopes: #('unrelated').   "an extras list naming NEITHER of them"
  self assert: (r supportedScopes includes: 'mcp:use').
  self assert: (r supportedScopes includes: 'mcp:write').
  self shouldnt: [r requireResourceServerConfig] raise: Error.
  "and with no extras at all, both are still advertised"
  r extraScopes: #().
  self assert: r supportedScopes equals: #('mcp:use' 'mcp:write').
  self shouldnt: [r requireResourceServerConfig] raise: Error
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
testSessionIsCappedAtTheTokenExpiry
  "The bound that matters on an authenticated router, and the one no idle policy expresses. The
   worker gem is logged in as the token's GemStone user, so a session allowed to outlive its access
   token leaves the authorization it was opened with in force after the grant expired -- indefinitely,
   on a router configured with no idle deadline. exp is required of every token this router accepts,
   so there is always one to bind to."
  | router |
  router := McpAuthRouter new.
  router expectedAudience: nil; expectedIssuer: nil; requiredScopes: #(); userIdClaim: 'sub'.
  self withJwtUser: 'McpExpiryTestUser' do: [:jwt | | sid sess exp |
    exp := router tokenExpirySecondsOf: jwt.
    self deny: exp isNil.
    sid := self sessionIdFrom: (self runRequest:
      (self post: self initBody headers: 'Authorization: Bearer ' , jwt , self crlf) on: router).
    self deny: sid isNil.
    sess := router sessionAt: sid.
    self deny: sess isNil.
    self assert: sess expiresAtSeconds equals: exp.
    self deny: sess isExpired.
    "the fixture mints an hour-long token, and that hour is what the session gets"
    self assert: ((sess expiresAtSeconds - System timeGmt) - 3600) abs < 60.
    router reapIdleSessions]
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
testSupportedScopesIsRequiredScopesWhenNothingElseSet
  "With no writeScope and no extras, the derived union collapses to exactly requiredScopes -- in the
   metadata scopes_supported AND the WWW-Authenticate scope= -- so a router configured only with
   requiredScopes advertises precisely what it requires."
  | router |
  router := McpAuthRouter new.
  router requiredScopes: #('mcp:use'); expectedAudience: nil; expectedIssuer: nil.
  self assert: router supportedScopes equals: #('mcp:use').
  self assert: (self includesCS: '"mcp:use"'
    in: (self runRequest: (self get: '/.well-known/oauth-protected-resource') on: router)).
  self assert: (self includesCS: 'scope="mcp:use"'
    in: (self runRequest: (self post: self initBody headers: '') on: router))
%
category: 'tests'
method: McpAuthTest
testSupportedScopesUnionsWriteScopeAndExtras
  "The advertised set is the union of requiredScopes, the writeScope and extraScopes, so it is WIDER
   than what is enforced. The writeScope in particular is advertised without anyone asking: clients
   must be able to request it or the role-gated grant could never happen, yet a token carrying only
   the required scope is still ACCEPTED. Advertise != require. Duplicates collapse, so naming a scope
   in two places is harmless."
  | router meta challenge p |
  router := McpAuthRouter new.
  router expectedAudience: nil; expectedIssuer: nil;
    requiredScopes: #('mcp:use');
    writeScope: 'mcp:write';
    extraScopes: #('profile' 'mcp:use').   "'mcp:use' repeated on purpose -- must not appear twice"
  self assert: router supportedScopes equals: #('mcp:use' 'mcp:write' 'profile').
  meta := self runRequest: (self get: '/.well-known/oauth-protected-resource') on: router.
  self assert: (self includesCS: '"mcp:use"' in: meta).
  self assert: (self includesCS: '"mcp:write"' in: meta).
  self assert: (self includesCS: '"profile"' in: meta).
  challenge := self runRequest: (self post: self initBody headers: '') on: router.
  self assert: (self includesCS: 'scope="mcp:use mcp:write profile"' in: challenge).
  "enforcement requires only mcp:use: a token with mcp:use but NOT mcp:write is accepted"
  p := Dictionary new. p at: 'exp' put: System timeGmt + 1000. p at: 'scope' put: 'mcp:use'.
  self assert: (router rejectionForPayload: p) isNil.
  "a token lacking the required mcp:use is still refused, even though it carries an advertised scope"
  p := Dictionary new. p at: 'exp' put: System timeGmt + 1000. p at: 'scope' put: 'mcp:write'.
  self deny: (router rejectionForPayload: p) isNil
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
      headers: 'MCP-Session-Id: ' , sid , self crlf , 'Authorization: Bearer ' , jwt , self crlf) on: router.
    self assert: (self includesCS: 'readOnly' in: out).
    out := self runRequest: (self post: self statusBody headers: 'MCP-Session-Id: ' , sid , self crlf , 'Authorization: Bearer ' , jwt , self crlf) on: router.
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
      headers: 'MCP-Session-Id: ' , sid , self crlf , 'Authorization: Bearer ' , jwt , self crlf) on: router.
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
    statusOut := self runRequest: (self post: self statusBody headers: 'MCP-Session-Id: ' , sid , self crlf , 'Authorization: Bearer ' , jwt , self crlf) on: router.
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
  "Clear the key first, exactly as the user above is cleared first and for the same reason: the key
   register is STONE-wide runtime state, so a run that was interrupted between #addJwtKey: and the
   ensure below leaves it behind, and every later run of every test that uses this fixture dies on
   'key already exists' until someone removes it by hand. The ensure is the tidy path, not the
   guarantee -- one is needed at each end."
  [System removeJwtKeyWithId: keyId] on: Error do: [:e | nil].
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
