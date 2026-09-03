set compile_env: 0
! ------------------- Class definition for McpJsonTest
expectvalue /Class
doit
GsTestCase subclass: 'McpJsonTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpJsonTest comment: 
'Unit tests for McpJson, the codec gs-mcp owns instead of kernel JsonParser / Object>>asJson.

Three of these tests are REGRESSIONS for defects measured in the shipped server, and each says so:
astral characters written as a single wrong \u escape, a surrogate-pair escape raising and becoming
a -32700, and a raw-UTF-8 body read one Latin-1 character per byte.

Everything here is pure -- no commits, no view movement -- so this suite needs no
movesTheSessionView opt-in.

NOTE ON SOURCE ENCODING: this file stays pure ASCII, and every non-ASCII character is built with
Character codePoint:. A literal one in the source would be stored mojibake by the very defect under
test, and the assertion would then be testing the corruption rather than the fix.'
%
expectvalue /Class
doit
McpJsonTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpJsonTest
removeallmethods McpJsonTest
removeallclassmethods McpJsonTest
! ------------------- Class methods for McpJsonTest
! ------------------- Instance methods for McpJsonTest
category: 'helpers'
method: McpJsonTest
bytesOf: anArrayOfByteValues
  "A byte String holding exactly these byte values -- how this suite spells a wire body without
   putting a non-ASCII character in the source."
  | out |
  out := String new.
  anArrayOfByteValues do: [:each | out add: (Character codePoint: each)].
  ^out
%
category: 'helpers'
method: McpJsonTest
charAt: anIndex of: aString
  "The codePoint of aString's anIndex-th character, so an assertion can name a number."
  ^(aString at: anIndex) codePoint
%
category: 'helpers'
method: McpJsonTest
nest: aCount
  "aCount nested JSON arrays around a 1, for the depth-limit tests."
  | out |
  out := WriteStream on: String new.
  aCount timesRepeat: [out nextPut: $[].
  out nextPut: $1.
  aCount timesRepeat: [out nextPut: $]].
  ^out contents
%
category: 'helpers'
method: McpJsonTest
refuses: aBlock
  "Whether aBlock raises an McpError -- how every rejection test asks its question."
  ^[aBlock value. false] on: McpError do: [:ex | ex return: true]
%
category: 'helpers'
method: McpJsonTest
stringWith: aCodePoint
  "A one-character string holding aCodePoint, whatever width that needs."
  ^String new add: (Character codePoint: aCodePoint); yourself
%
category: 'tests-parsing'
method: McpJsonTest
testParseDepthLimit
  "A recursive-descent parser's only defence against a body crafted to exhaust the stack."
  self assert: (McpJson parse: (self nest: McpJson maxDepth)) notNil.
  self assert: (self refuses: [McpJson parse: (self nest: McpJson maxDepth + 1)])
%
category: 'tests-parsing'
method: McpJsonTest
testParseKeysCompareWithStringLiterals
  "THE Unicode7 TRAP. `'code' decodeFromUTF8` answers a Unicode7, and comparing one to a String
   RAISES rather than answering false -- so a parser that left keys wide would make every
   `args at: 'code'` in every toolset raise. Parsed ASCII must come back as a byte String."
  | parsed |
  parsed := McpJson parseWire: '{"code":"x","n":1}'.
  self assert: (parsed at: 'code' ifAbsent: ['MISSING']) equals: 'x'.
  self assert: (parsed at: 'n' ifAbsent: [0]) equals: 1.
  self assert: (parsed keys detect: [:k | k = 'code'] ifNone: [nil]) notNil.
  parsed keysAndValuesDo: [:k :v | self assert: k class equals: String]
%
category: 'tests-parsing'
method: McpJsonTest
testParseRefusesMalformed
  "Deliberately stricter than kernel, which accepted every one of these. A lenient parser hides a
   client that is corrupting its own payload."
  self assert: (self refuses: [McpJson parse: '{"a":1} trailing']).
  self assert: (self refuses: [McpJson parse: '{"a":"\x"}']).
  self assert: (self refuses: [McpJson parse: '{"a":"' , (self stringWith: 9) , '"}']).
  self assert: (self refuses: [McpJson parse: '{"a"1}']).
  self assert: (self refuses: [McpJson parse: '{a:1}']).
  self assert: (self refuses: [McpJson parse: '{"a":1']).
  self assert: (self refuses: [McpJson parse: '[1,2']).
  self assert: (self refuses: [McpJson parse: '"unterminated']).
  self assert: (self refuses: [McpJson parse: '{"a":tru}']).
  self assert: (self refuses: [McpJson parse: '{"a":1-2}']).
  self assert: (self refuses: [McpJson parse: '{"a":01}']).
  self assert: (self refuses: [McpJson parse: '{"a":+1}']).
  self assert: (self refuses: [McpJson parse: '{"a":1.}']).
  self assert: (self refuses: [McpJson parse: '{"a":.5}']).
  self assert: (self refuses: [McpJson parse: '{"a":1e}']).
  self assert: (self refuses: [McpJson parse: ''])
%
category: 'tests-parsing'
method: McpJsonTest
testParseScalars
  "Shapes must match what kernel JsonParser answered, so no caller downstream changes."
  | parsed |
  parsed := McpJson parse: '{"i":42,"neg":-7,"big":123456789012345678901234567890,
    "r":1.5,"exp":1e3,"t":true,"f":false,"z":null,"s":"x"}'.
  self assert: parsed class equals: Dictionary.
  self assert: (parsed at: 'i') equals: 42.
  self assert: (parsed at: 'neg') equals: -7.
  self assert: ((parsed at: 'big') isKindOf: Integer).
  self assert: (parsed at: 'r') equals: 1.5.
  self assert: (parsed at: 'exp') equals: 1000.0.
  self assert: ((McpJson parse: '{"a":-0.5e-2}') at: 'a') equals: -0.005.
  self assert: ((McpJson parse: '{"a":0}') at: 'a') equals: 0.
  self assert: (parsed at: 't') equals: true.
  self assert: (parsed at: 'f') equals: false.
  self assert: (parsed at: 'z') isNil.
  self assert: (parsed at: 's') equals: 'x'.
  self assert: (McpJson parse: '[]') equals: Array new.
  self assert: (McpJson parse: '{}') equals: Dictionary new.
  self assert: (McpJson parse: '  {"a" : [ 1 , 2 ] }  ') notNil.
  "Duplicate keys: last wins, as kernel did."
  self assert: ((McpJson parse: '{"a":1,"a":2}') at: 'a') equals: 2
%
category: 'tests-parsing'
method: McpJsonTest
testParseStringEscapes
  "The named escapes and a plain \u."
  self assert: (McpJson parse: '"\""') equals: (String with: $").
  self assert: (McpJson parse: '"\\"') equals: (String with: $\).
  self assert: (McpJson parse: '"\/"') equals: (String with: $/).
  self assert: (McpJson parse: '"\b\t\n\f\r"' ) size equals: 5.
  self assert: (self charAt: 1 of: (McpJson parse: '"\b"')) equals: 8.
  self assert: (self charAt: 1 of: (McpJson parse: '"\t"')) equals: 9.
  self assert: (self charAt: 1 of: (McpJson parse: '"\n"')) equals: 10.
  self assert: (self charAt: 1 of: (McpJson parse: '"\f"')) equals: 12.
  self assert: (self charAt: 1 of: (McpJson parse: '"\r"')) equals: 13.
  self assert: (self charAt: 1 of: (McpJson parse: '"\u2603"')) equals: 16r2603.
  self assert: (self charAt: 1 of: (McpJson parse: '"\uFFFF"')) equals: 16rFFFF.
  self assert: (self charAt: 1 of: (McpJson parse: '"\u0000"')) equals: 0.
  self assert: (self refuses: [McpJson parse: '"\u26"']).
  self assert: (self refuses: [McpJson parse: '"\uZZZZ"'])
%
category: 'tests-parsing'
method: McpJsonTest
testParseSurrogatePair
  "REGRESSION. Kernel sent Character codePoint: to each half, and 3.7.x refuses a surrogate
   (OutOfRange 2723) -- so a client that escapes non-ASCII (Python's json.dumps does by default)
   got HTTP 400 -32700 for every emoji. The pair must combine into one character."
  | parsed |
  parsed := McpJson parse: '"\uD83D\uDE00"'.
  self assert: parsed size equals: 1.
  self assert: (self charAt: 1 of: parsed) equals: 16r1F600.
  self assert: (self charAt: 1 of: (McpJson parse: '"\uD800\uDC00"')) equals: 16r10000.
  self assert: (self charAt: 1 of: (McpJson parse: '"\uDBFF\uDFFF"')) equals: 16r10FFFF
%
category: 'tests-parsing'
method: McpJsonTest
testParseUnpairedSurrogateBecomesReplacement
  "An unpaired half is U+FFFD, not a raise -- one malformed escape must not lose the whole call.
   The high-surrogate cases also prove the lookahead PUTS BACK what it did not consume."
  self assert: (self charAt: 1 of: (McpJson parse: '"\uD83D"')) equals: 16rFFFD.
  self assert: (self charAt: 1 of: (McpJson parse: '"\uDE00"')) equals: 16rFFFD.
  self assert: (McpJson parse: '"\uD83Dx"') size equals: 2.
  self assert: (self charAt: 2 of: (McpJson parse: '"\uD83Dx"')) equals: 120.
  self assert: (McpJson parse: '"\uD83D\u2603"') size equals: 2.
  self assert: (self charAt: 2 of: (McpJson parse: '"\uD83D\u2603"')) equals: 16r2603
%
category: 'tests-utf8'
method: McpJsonTest
testParseWireDecodesUtf8
  "REGRESSION. Nothing decoded the body, so a raw-UTF-8 client -- which is every real MCP client --
   had each byte read as one Latin-1 character: 'cafe' with an e-acute measured 5, not 4."
  | body parsed |
  body := self bytesOf: #(123 34 107 34 58 34 99 97 102 16rC3 16rA9 34 125).
  self assert: body size equals: 13.
  parsed := McpJson parseWire: body.
  self assert: (parsed at: 'k') size equals: 4.
  self assert: (self charAt: 4 of: (parsed at: 'k')) equals: 16rE9.
  "Three- and four-byte sequences: U+2603 and U+1F600."
  parsed := McpJson parseWire: (self bytesOf: #(34 16rE2 16r98 16r83 34)).
  self assert: parsed size equals: 1.
  self assert: (self charAt: 1 of: parsed) equals: 16r2603.
  parsed := McpJson parseWire: (self bytesOf: #(34 16rF0 16r9F 16r98 16r80 34)).
  self assert: parsed size equals: 1.
  self assert: (self charAt: 1 of: parsed) equals: 16r1F600
%
category: 'tests-utf8'
method: McpJsonTest
testParseWireMalformedUtf8BecomesReplacement
  "A bad sequence costs a character, not the whole request -- one mis-encoded byte in a 50KB source
   argument must not lose the call. Flip this policy in McpJson class>>decodeUtf8: if that judgement
   ever changes."
  | parsed |
  "A truncated three-byte sequence, then a good character."
  parsed := McpJson parseWire: (self bytesOf: #(34 16rE2 16r98 120 34)).
  self assert: (self charAt: 1 of: parsed) equals: 16rFFFD.
  self assert: (self charAt: parsed size of: parsed) equals: 120.
  "A bare continuation byte."
  parsed := McpJson parseWire: (self bytesOf: #(34 16r80 34)).
  self assert: (self charAt: 1 of: parsed) equals: 16rFFFD.
  "An overlong encoding of '/' -- the classic smuggling trick -- must not become a '/'."
  parsed := McpJson parseWire: (self bytesOf: #(34 16rC0 16rAF 34)).
  self assert: ((parsed includes: $/) not).
  "An encoded surrogate."
  parsed := McpJson parseWire: (self bytesOf: #(34 16rED 16rA0 16rBD 34)).
  self assert: (self charAt: 1 of: parsed) equals: 16rFFFD
%
category: 'tests-utf8'
method: McpJsonTest
testParseWireMatchesParseOnAscii
  "#decodeUtf8: short-circuits an all-ASCII body. The fast path and the decoding path must agree."
  | body |
  body := '{"a":[1,"x",true,null],"b":{"c":2}}'.
  self assert: (McpJson parseWire: body) equals: (McpJson parse: body).
  self assert: (McpJson decodeUtf8: body) equals: body.
  self assert: (McpJson decodeUtf8: body) class equals: String
%
category: 'tests-roundtrip'
method: McpJsonTest
testRoundTrip
  "Write then read must be the identity, for every width of character."
  | samples |
  samples := OrderedCollection new.
  samples add: 'plain ascii'.
  samples add: (self stringWith: 16r00E9).
  samples add: (self stringWith: 16r2603).
  samples add: (self stringWith: 16r1F600).
  samples add: (self stringWith: 16r4E2D).
  samples do: [:each | | rendered |
    rendered := McpJson write: each.
    self assert: (McpJson parse: rendered) equals: each.
    "And through the wire entry, since a rendered body is ASCII and must survive the decoder."
    self assert: (McpJson parseWire: rendered) equals: each]
%
category: 'tests-roundtrip'
method: McpJsonTest
testRoundTripJsonRpcEnvelope
  "The shape gs-mcp actually moves: a tools/call result whose text carries non-ASCII."
  | content result response rendered back |
  content := Dictionary new.
  content at: 'type' put: 'text'.
  content at: 'text' put: 'caf' , (self stringWith: 16r00E9) , ' ' , (self stringWith: 16r1F600).
  result := Dictionary new.
  result at: 'content' put: (Array with: content).
  result at: 'isError' put: false.
  response := Dictionary new.
  response at: 'jsonrpc' put: '2.0'.
  response at: 'id' put: 1.
  response at: 'result' put: result.
  rendered := McpJson write: response.
  1 to: rendered size do: [:i | self assert: (self charAt: i of: rendered) < 128].
  back := McpJson parseWire: rendered.
  self assert: (back at: 'id') equals: 1.
  self assert: (((back at: 'result') at: 'content') first at: 'text')
    equals: (content at: 'text')
%
category: 'tests-writing'
method: McpJsonTest
testWriteAstralUsesSurrogatePair
  "REGRESSION. Kernel printJsonOn: kept only bits 12-15 of a codepoint above U+FFFF, so U+1F600 went
   out as the escape \uF600 -- a Private Use Area character, silently the wrong one. It must be
   a surrogate pair."
  self assert: (McpJson write: (self stringWith: 16r1F600)) equals: '"\uD83D\uDE00"'.
  "U+10000 and U+10FFFF, the ends of the astral range."
  self assert: (McpJson write: (self stringWith: 16r10000)) equals: '"\uD800\uDC00"'.
  self assert: (McpJson write: (self stringWith: 16r10FFFF)) equals: '"\uDBFF\uDFFF"'.
  "U+1D800 is the case where kernel's arithmetic emitted a LONE surrogate, which is not even
   well-formed JSON."
  self assert: (McpJson write: (self stringWith: 16r1D800)) equals: '"\uD836\uDC00"'
%
category: 'tests-writing'
method: McpJsonTest
testWriteBodyIsAlwaysAscii
  "THE WIRE CONTRACT. Content-Length is `body size`, which is the byte count only while the body is
   ASCII -- see the class comment. Every one of these carries non-ASCII content."
  | samples |
  samples := OrderedCollection new.
  samples add: (self stringWith: 16r2603).
  samples add: (self stringWith: 16r1F600).
  samples add: (self stringWith: 16r00E9).
  samples add: (Array with: (self stringWith: 16r4E2D) with: 1).
  samples do: [:each | | rendered |
    rendered := McpJson write: each.
    self assert: rendered class equals: String.
    1 to: rendered size do: [:i |
      self assert: (self charAt: i of: rendered) < 128]]
%
category: 'tests-writing'
method: McpJsonTest
testWriteControlCharacters
  "The five named escapes, \u for every other control, and 0x7F escaped even though RFC 8259 lets it
   through raw -- the contract is 0x20-0x7E and nothing else."
  self assert: (McpJson write: (self stringWith: 8)) equals: '"\b"'.
  self assert: (McpJson write: (self stringWith: 9)) equals: '"\t"'.
  self assert: (McpJson write: (self stringWith: 10)) equals: '"\n"'.
  self assert: (McpJson write: (self stringWith: 12)) equals: '"\f"'.
  self assert: (McpJson write: (self stringWith: 13)) equals: '"\r"'.
  self assert: (McpJson write: (self stringWith: 11)) equals: '"\u000B"'.
  self assert: (McpJson write: (self stringWith: 0)) equals: '"\u0000"'.
  self assert: (McpJson write: (self stringWith: 16r1F)) equals: '"\u001F"'.
  self assert: (McpJson write: (self stringWith: 16r7F)) equals: '"\u007F"'
%
category: 'tests-writing'
method: McpJsonTest
testWriteLoneSurrogateBecomesReplacement
  "A surrogate can be a Character on 3.6.2, where they are legal. Writing one as an unpaired escape
   would emit ill-formed JSON, so it becomes U+FFFD. Skipped where the image refuses to build one."
  | surrogate |
  surrogate := [self stringWith: 16rD83D] on: Error do: [:ex | ex return: nil].
  surrogate isNil ifTrue: [^self].
  self assert: (McpJson write: surrogate) equals: '"\uFFFD"'
%
category: 'tests-writing'
method: McpJsonTest
testWriteRefusesUnrenderableObject
  "Kernel answered {} for an object with no printJsonOn:, shipping a silently empty value to the
   client. This refuses instead."
  self assert: (self refuses: [McpJson write: $a]).
  self assert: (self refuses: [McpJson write: McpJson]).
  self assert: (self refuses: [McpJson write: (1 -> 2)])
%
category: 'tests-writing'
method: McpJsonTest
testWriteScalars
  "The values gs-mcp actually puts in a response."
  self assert: (McpJson write: nil) equals: 'null'.
  self assert: (McpJson write: true) equals: 'true'.
  self assert: (McpJson write: false) equals: 'false'.
  self assert: (McpJson write: 0) equals: '0'.
  self assert: (McpJson write: -42) equals: '-42'.
  self assert: (McpJson write: 123456789012345678901234567890)
    equals: '123456789012345678901234567890'.
  self assert: (McpJson write: 1.5) equals: '1.5'.
  self assert: (McpJson write: '') equals: '""'.
  self assert: (McpJson write: 'plain') equals: '"plain"'.
  self assert: (McpJson write: #symbol) equals: '"symbol"'
%
category: 'tests-writing'
method: McpJsonTest
testWriteStringEscapes
  "Quote and backslash are escaped; forward slash is NOT (permitted, and kernel did not either)."
  self assert: (McpJson write: 'say "hi"') equals: '"say \"hi\""'.
  self assert: (McpJson write: (String new add: $a; add: $\; add: $b; yourself))
    equals: '"a\\b"'.
  self assert: (McpJson write: 'a/b') equals: '"a/b"'.
  self assert: (McpJson write: (self stringWith: 16r2603)) equals: '"\u2603"'.
  self assert: (McpJson write: (self stringWith: 16r00E9)) equals: '"\u00E9"'
%
category: 'tests-writing'
method: McpJsonTest
testWriteStructures
  "Containers, including the empty ones and a SymbolDictionary -- which is NOT a kind of Dictionary
   in GemStone, so it reaches the writer down a different branch."
  | dict symbolDict |
  self assert: (McpJson write: Array new) equals: '[]'.
  self assert: (McpJson write: Dictionary new) equals: '{}'.
  self assert: (McpJson write: (Array with: 1 with: 'a' with: nil)) equals: '[1,"a",null]'.
  self assert: (McpJson write: (OrderedCollection with: true)) equals: '[true]'.
  dict := Dictionary new.
  dict at: 'k' put: (Array with: 1).
  self assert: (McpJson write: dict) equals: '{"k":[1]}'.
  symbolDict := SymbolDictionary new.
  symbolDict at: #k put: 1.
  self assert: (McpJson write: symbolDict) equals: '{"k":1}'.
  "A non-string key is printed, which is what kernel did."
  dict := Dictionary new.
  dict at: 7 put: 1.
  self assert: (McpJson write: dict) equals: '{"7":1}'
%
