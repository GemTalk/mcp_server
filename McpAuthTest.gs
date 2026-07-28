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
crlf
  ^String with: Character cr with: Character lf
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
testGarbageBearerReturns401
  | out |
  out := self runRequest: (self post: self initBody headers: 'Authorization: Bearer not.a.jwt' , self crlf) on: McpAuthRouter new.
  self assert: (self includesCS: 'HTTP/1.1 401 Unauthorized' in: out)
%
category: 'tests'
method: McpAuthTest
testMissingTokenReturns401
  | out |
  out := self runRequest: (self post: self initBody headers: '') on: McpAuthRouter new.
  self assert: (self includesCS: 'HTTP/1.1 401 Unauthorized' in: out)
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
testValidTokenOpensPerUserSession
  "A valid Bearer JWT authenticates initialize (200 + MCP-Session-Id) and opens a worker running as
   the token's GemStone user -- proven by a routed status call reporting that user."
  self withJwtUser: 'McpAuthTestUser' do: [:jwt | | router initOut sid statusOut |
    router := McpAuthRouter new.
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
  "Provision a JWT-enabled UserProfile for aUserId (identity from the 'sub' claim, wildcard
   issuer/audience) + register a signing key, mint a matching JWT, evaluate aOneArgBlock with the
   JWT string, and ALWAYS clean up the key + user afterward. Answers the block's value."
  | keyId jwtSec up now jwt |
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
  jwt := (JsonWebToken newForRsa256
    subject: aUserId; issuer: 'https://test'; audience: 'gs-mcp'; keyId: keyId;
    issuedAtTime: now; expirationTime: now + 3600;
    signWithPrivateKey: JsonWebToken example_privateKey; yourself) asJwtString.
  ^[aOneArgBlock value: jwt] ensure: [
    [System removeJwtKeyWithId: keyId] on: Error do: [:e | nil].
    [AllUsers removeAndCleanupUserWithId: aUserId ifAbsent: [nil]. System commitTransaction] on: Error do: [:e | nil]]
%
