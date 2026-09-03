set compile_env: 0
! ------------------- Class definition for McpUtf8Test
expectvalue /Class
doit
GsTestCase subclass: 'McpUtf8Test'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpUtf8Test comment: 
'Unit tests for the one Unicode fix gs-mcp carries: McpBase class>>decodeUtf8:, and McpBase
class>>parseBody: on top of it.

JSON is UTF-8 on the wire and kernel JsonParser takes a CHARACTER string, so a body handed straight
from the socket to the parser was read one Latin-1 character per byte. That is the defect these
tests are a regression for, and the one every real client hits -- a pound sign or a degree sign in a
compile_method source arrived as two characters and was stored that way.

The kernel''s OTHER JSON defects are deliberately NOT covered here, because gs-mcp no longer works
around them: an escaped surrogate pair still fails a request, an astral character still goes out as
one wrong escape, and an unknown escape is still silently dropped. They are measured in the kernel
JSON Unicode report, and the codec that used to answer them is preserved on the emoji-safe branch.
Testing them here would only pin defects this code does not own.

Everything here is pure -- no commits, no view movement -- so this suite needs no
movesTheSessionView opt-in.

NOTE ON SOURCE ENCODING: this file stays pure ASCII, and every non-ASCII character is built with
Character codePoint:. A literal one in the source would be stored mojibake by the very defect under
test, and the assertion would then be testing the corruption rather than the fix.'
%
expectvalue /Class
doit
McpUtf8Test category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpUtf8Test
removeallmethods McpUtf8Test
removeallclassmethods McpUtf8Test
! ------------------- Class methods for McpUtf8Test
! ------------------- Instance methods for McpUtf8Test
category: 'helpers'
method: McpUtf8Test
bytesOf: anArrayOfByteValues
  "A byte String holding exactly these byte values -- how this suite spells a wire body without
   putting a non-ASCII character in the source."
  | out |
  out := String new.
  anArrayOfByteValues do: [:each | out add: (Character codePoint: each)].
  ^out
%
category: 'helpers'
method: McpUtf8Test
charAt: anIndex of: aString
  "The codePoint of aString's anIndex-th character, so an assertion can name a number."
  ^(aString at: anIndex) codePoint
%
category: 'tests-utf8'
method: McpUtf8Test
testAsciiBodyTakesTheFastPathUnchanged
  "#decodeUtf8: short-circuits an all-ASCII body and answers the receiver itself -- which is what
   keeps the decode free for the two callers that hand it a string gs-mcp produced (the router's own
   config, the worker's toolset options) and for every request that has no non-ASCII in it."
  | body |
  body := '{"a":[1,"x",true,null],"b":{"c":2}}'.
  self assert: (McpBase decodeUtf8: body) == body.
  self assert: ((McpBase parseBody: body) at: 'a') size equals: 4
%
category: 'tests-utf8'
method: McpUtf8Test
testDecodeUtf8DecodesMultiByteSequences
  "REGRESSION. Nothing decoded the body, so a raw-UTF-8 client -- which is every real MCP client --
   had each byte read as one Latin-1 character: 'cafe' with an e-acute measured 5, not 4.
   Two-, three- and four-byte sequences: U+00E9, U+2603 and U+1F600. The four-byte case decodes
   correctly even though the kernel writer cannot write it back out (the kernel JSON Unicode
   report, defect 2) -- what arrives is still stored correctly, which is the half that matters."
  | decoded parsed |
  decoded := McpBase decodeUtf8: (self bytesOf: #(99 97 102 16rC3 16rA9)).
  self assert: decoded size equals: 4.
  self assert: (self charAt: 4 of: decoded) equals: 16rE9.
  decoded := McpBase decodeUtf8: (self bytesOf: #(16rE2 16r98 16r83)).
  self assert: decoded size equals: 1.
  self assert: (self charAt: 1 of: decoded) equals: 16r2603.
  decoded := McpBase decodeUtf8: (self bytesOf: #(16rF0 16r9F 16r98 16r80)).
  self assert: decoded size equals: 1.
  self assert: (self charAt: 1 of: decoded) equals: 16r1F600.
  "And through the real entry point, which is where it has to hold."
  parsed := McpBase parseBody:
    (self bytesOf: #(123 34 107 34 58 34 99 97 102 16rC3 16rA9 34 125)).
  self assert: (parsed at: 'k') size equals: 4.
  self assert: (self charAt: 4 of: (parsed at: 'k')) equals: 16rE9
%
category: 'tests-utf8'
method: McpUtf8Test
testMalformedUtf8BecomesReplacement
  "A bad sequence costs a character, not the whole request -- one mis-encoded byte in a 50KB source
   argument must not lose the call. Flip this policy in McpBase class>>decodeUtf8: if that
   judgement ever changes."
  | decoded |
  "A truncated three-byte sequence, then a good character."
  decoded := McpBase decodeUtf8: (self bytesOf: #(16rE2 16r98 120)).
  self assert: (self charAt: 1 of: decoded) equals: 16rFFFD.
  self assert: (self charAt: decoded size of: decoded) equals: 120.
  "A bare continuation byte."
  decoded := McpBase decodeUtf8: (self bytesOf: #(16r80)).
  self assert: (self charAt: 1 of: decoded) equals: 16rFFFD.
  "An overlong encoding of '/' -- the classic smuggling trick -- must not become a '/'."
  decoded := McpBase decodeUtf8: (self bytesOf: #(16rC0 16rAF)).
  self assert: ((decoded includes: $/) not).
  "An encoded surrogate."
  decoded := McpBase decodeUtf8: (self bytesOf: #(16rED 16rA0 16rBD)).
  self assert: (self charAt: 1 of: decoded) equals: 16rFFFD
%
category: 'tests-utf8'
method: McpUtf8Test
testParsedKeysCompareWithStringLiterals
  "THE Unicode7 TRAP, and the reason #decodeUtf8: does not simply send #decodeFromUTF8.
   `'code' decodeFromUTF8` answers a Unicode7, and comparing one to a String RAISES rather than
   answering false -- so a decode that left an ASCII key wide would make every `args at: 'code'` in
   every toolset raise. An all-ASCII body must come back with byte-String keys."
  | parsed |
  parsed := McpBase parseBody: '{"code":"x","n":1}'.
  self assert: (parsed at: 'code' ifAbsent: ['MISSING']) equals: 'x'.
  self assert: (parsed at: 'n' ifAbsent: [0]) equals: 1.
  self assert: (parsed keys detect: [:k | k = 'code'] ifNone: [nil]) notNil.
  parsed keysAndValuesDo: [:k :v | self assert: k class equals: String]
%
