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
'Unit tests for the INBOUND half of gs-mcp''s wire contract: the UTF-8 decode kernel JsonParser
needs, in McpBase class>>parseBody:, which is `JsonParser parse: aString decodeFromUTF8 asString`.
The outbound half -- the writer -- is McpJsonTest.

JSON is UTF-8 on the wire and kernel JsonParser takes a CHARACTER string, so a body handed straight
from the socket to the parser was read one Latin-1 character per byte. That is the defect these
tests are a regression for, and the one every real client hits -- a pound sign or a degree sign in a
compile_method source arrived as two characters and was stored that way.

Both sends are stock kernel, so these tests pin a POLICY, not an algorithm: that the decode happens
at all, and that a malformed sequence refuses the whole body rather than being repaired into it.
The second is a deliberate choice -- an earlier gs-mcp decoder substituted one U+FFFD per bad
sequence and kept the call. Refusing tells a client with a broken encoder that it is broken,
instead of storing text nobody meant.

WHAT THE KERNEL PARSER STILL GETS WRONG, and is deliberately not covered here, because gs-mcp does
not work around it: an escaped surrogate pair fails the whole request (Python''s json.dumps escapes
by default, so that client cannot send an emoji), and an escape the parser does not recognize is
silently dropped. Both are inbound and both need a real parser to fix. They are measured in the
kernel JSON Unicode report; testing them here would only pin defects this code does not own.
Note which one is NO LONGER on that list. The write-path defect -- an astral codepoint going out as
one wrong escape -- was the one an application could not route around, and gs-mcp answered it by
writing UTF-8 instead of escapes (McpJson). So a client that sends an emoji RAW, which is
JSON.stringify and therefore most of them, now round-trips it correctly; only an escaping client
still cannot.

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
bodyOfBytes: anArrayOfByteValues
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
category: 'helpers'
method: McpUtf8Test
includesCS: aSubstring in: aString
  "Case-sensitive substring test (String>>includesString: is case-INsensitive in GemStone)."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'tests-utf8'
method: McpUtf8Test
testAsciiBodyCostsNothingToDecode
  "There is no all-ASCII fast path and none is needed: #decodeFromUTF8 is a primitive (measured ~30x
   faster over a 60KB body than the character loop gs-mcp used to run), and #asString answers the
   RECEIVER ITSELF for a String, so an ASCII body is not copied a second time. That identity is the
   property, because it is what licenses sending both unconditionally."
  | body parsed |
  body := '{"a":[1,"x",true,null],"b":{"c":2}}'.
  self assert: body decodeFromUTF8 asString equals: body.
  self assert: body asString == body.
  parsed := McpBase parseBody: body.
  self assert: ((parsed at: 'a') size) equals: 4.
  self assert: ((parsed at: 'b') at: 'c') equals: 2
%
category: 'tests-utf8'
method: McpUtf8Test
testEscapedSurrogatePairIsCombined
  "THE OTHER inbound defect, and the reason McpBase class>>combineSurrogateEscapesIn: exists. RFC
   8259 7 gives JSON one way to write a character above U+FFFF as an escape -- the UTF-16 surrogate
   pair -- and JsonParser sends `Character codePoint:` to each half separately, which 3.7.x refuses
   (OutOfRange 2723). So an escaped emoji used to fail the WHOLE request with a -32700, while a BMP
   escape from the same client worked. Python's json.dumps escapes by default, so this is a real
   client rather than a hypothetical one.
   Asserted on the CODEPOINT: on 3.6.2 surrogates are legal Characters, so the unrepaired parser
   answers two of them there instead of raising, and only a codepoint tells the two apart.
   The BMP escape is here too, to show the repair did not disturb the case that already worked."
  | parsed |
  parsed := McpBase parseBody: '{"k":"a\uD83D\uDE00b"}'.
  self assert: parsed notNil description: 'an escaped surrogate pair failed the whole request'.
  self assert: (parsed at: 'k') size equals: 3.
  self assert: (self charAt: 2 of: (parsed at: 'k')) equals: 16r1F600.
  parsed := McpBase parseBody: '{"k":"a\u2603b"}'.
  self assert: (parsed at: 'k') size equals: 3.
  self assert: (self charAt: 2 of: (parsed at: 'k')) equals: 16r2603
%
category: 'tests-utf8'
method: McpUtf8Test
testLiteralBackslashUIsNotRewritten
  "BACKSLASH PARITY, the one way a surrogate-combining scan can do harm. A body may legitimately
   carry the six characters of an escape AS TEXT -- a compile_method source describing this very
   defect does -- and it arrives with the backslash doubled. A scan that just looked for a
   backslash followed by 'u' would rewrite it and silently corrupt the source.
   So: a JSON string whose CONTENT is the eleven characters `\uD83D\uDE00`... spelled here as a
   doubled backslash in the body, which JSON says means one literal backslash. What must come back
   is text, twelve characters of it, with backslashes still in it -- and no emoji anywhere.
   Also the case just past the end: a truncated escape at the tail must not be read off the end."
  | parsed value |
  parsed := McpBase parseBody: '{"k":"\\uD83D\\uDE00"}'.
  self assert: parsed notNil.
  value := parsed at: 'k'.
  self assert: value size equals: 12.
  self assert: (self charAt: 1 of: value) equals: 92.
  self assert: (self charAt: 2 of: value) equals: 117.
  self assert: ((1 to: value size) detect: [:i | (value at: i) codePoint > 16rFFFF] ifNone: [nil]) isNil
    description: 'a literal backslash-u was rewritten into an astral character'.
  "A high-surrogate escape with nothing after it must not run off the end, and must not raise."
  self assert: (McpBase parseBody: '{"k":"\uD83D"}') notNil.
  self assert: (self charAt: 1 of: ((McpBase parseBody: '{"k":"\uD83D"}') at: 'k'))
    equals: 16rFFFD.
  "An unpaired LOW half is the same policy."
  self assert: (self charAt: 1 of: ((McpBase parseBody: '{"k":"\uDE00"}') at: 'k'))
    equals: 16rFFFD
%
category: 'tests-utf8'
method: McpUtf8Test
testMalformedUtf8RefusesTheWholeBody
  "THE POLICY, and the one behaviour here that is a choice rather than a fact about the kernel.
   #decodeFromUTF8 raises on a truncated sequence, a bad continuation byte, an overlong encoding
   (16rC0 16rAF is the classic smuggled '/', which must not become one) and an encoded surrogate,
   naming the byte offset. parseBody: catches it like any other parse failure, so the client gets
   one -32700 and nothing is stored.
   The predecessor substituted one U+FFFD per bad sequence and kept the call. If that judgement is
   ever revisited, this is the test that says so out loud."
  | truncated bareContinuation overlong encodedSurrogate |
  truncated := self bodyOfBytes: #(123 34 107 34 58 34 16rE2 16r98 34 125).
  bareContinuation := self bodyOfBytes: #(123 34 107 34 58 34 16r80 34 125).
  overlong := self bodyOfBytes: #(123 34 107 34 58 34 16rC0 16rAF 34 125).
  encodedSurrogate := self bodyOfBytes: #(123 34 107 34 58 34 16rED 16rA0 16rBD 34 125).
  self assert: (McpBase parseBody: truncated) isNil.
  self assert: (McpBase parseBody: bareContinuation) isNil.
  self assert: (McpBase parseBody: overlong) isNil.
  self assert: (McpBase parseBody: encodedSurrogate) isNil.
  "And the raise names where it went wrong, which is the whole reason refusing beats repairing."
  self assert: (self includesCS: 'offset'
    in: ([(self bodyOfBytes: #(16rE2 16r98 120)) decodeFromUTF8. 'NO RAISE']
      on: Error do: [:ex | ex description]))
%
category: 'tests-utf8'
method: McpUtf8Test
testMultiByteSequencesAreDecoded
  "REGRESSION. Nothing decoded the body, so a raw-UTF-8 client -- which is every real MCP client --
   had each byte read as one Latin-1 character: 'cafe' with an e-acute measured 5, not 4.
   Two-, three- and four-byte sequences: U+00E9, U+2603 and U+1F600. The four-byte case is the one
   that used to arrive correctly and then be written back out wrong; McpJsonTest owns the other end
   of it now, so between the two suites the emoji is covered in both directions."
  | parsed |
  parsed := McpBase parseBody:
    (self bodyOfBytes: #(123 34 107 34 58 34 99 97 102 16rC3 16rA9 34 125)).
  self assert: (parsed at: 'k') size equals: 4.
  self assert: (self charAt: 4 of: (parsed at: 'k')) equals: 16rE9.
  parsed := McpBase parseBody: (self bodyOfBytes: #(123 34 107 34 58 34 16rE2 16r98 16r83 34 125)).
  self assert: (parsed at: 'k') size equals: 1.
  self assert: (self charAt: 1 of: (parsed at: 'k')) equals: 16r2603.
  parsed := McpBase parseBody:
    (self bodyOfBytes: #(123 34 107 34 58 34 16rF0 16r9F 16r98 16r80 34 125)).
  self assert: (parsed at: 'k') size equals: 1.
  self assert: (self charAt: 1 of: (parsed at: 'k')) equals: 16r1F600
%
category: 'tests-utf8'
method: McpUtf8Test
testParsedKeysCompareWithStringLiterals
  "THE Unicode TRAP, and why #asString follows #decodeFromUTF8. `'code' decodeFromUTF8` answers a
   Unicode7, and on a stock image comparing one to a String RAISES rather than answering false --
   so a body decoded but not narrowed could make every `args at: 'code'` in every toolset raise.
   A parsed body must come back with keys a byte-String literal can find, on every image."
  | parsed |
  parsed := McpBase parseBody: (self bodyOfBytes:
    #(123 34 99 111 100 101 34 58 34 120 16rC3 16rA9 34 44 34 110 34 58 49 125)).
  self assert: (parsed at: 'code' ifAbsent: ['MISSING']) size equals: 2.
  self assert: (parsed at: 'n' ifAbsent: [0]) equals: 1.
  self assert: (parsed keys detect: [:k | k = 'code'] ifNone: [nil]) notNil.
  parsed keysAndValuesDo: [:k :v | self assert: k class equals: String]
%
