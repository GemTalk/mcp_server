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
'Unit tests for McpJson, the JSON WRITER gs-mcp owns. The inbound half of the wire contract -- the
UTF-8 decode kernel JsonParser needs and the policy on a malformed sequence -- is McpUtf8Test.

THE HEADLINE TEST is #testAstralCharacterSurvivesWhereTheKernelWriterCorruptsIt, which asserts
against the kernel side by side: Object>>asJson answers "\uF600" for U+1F600, and for U+1D800 a
LONE SURROGATE that is not well-formed JSON at all. That defect is the entire reason this class
exists, and it is the one an application cannot route around -- by the time asJson has answered,
the codepoint is gone (docs/kernel-json-unicode.md, defect 2 and section 7).

THE ENCODER IS CHECKED AGAINST AN ORACLE, which is the cleanest thing about writing UTF-8 rather
than \u escapes: #testEncoderAgreesWithTheKernelPrimitive requires
McpJson writeUtf8CodePoint:on: to produce exactly what String>>encodeAsUTF8 produces, for every
codepoint it is given, including both sides of all three sequence-length boundaries. Nothing in the
kernel emits a correct JSON escape for an astral codepoint, so an ASCII-escaping writer''s
surrogate arithmetic can only ever be checked against expectations written by the same hand that
wrote the code -- there is no second opinion available.

ASSERTIONS ARE ON CODEPOINTS, never on round-tripped text. Text comparison would pass on 3.6.2 for
the wrong reason: surrogates are legal Characters there, so the kernel''s two defects CANCEL over a
round trip and an emoji appears to survive as two characters no 3.7.x image would construct.

Everything here is pure -- no commits, no view movement, no gems -- so this suite needs no
movesTheSessionView opt-in.

NOTE ON SOURCE ENCODING: this file stays pure ASCII. Every non-ASCII character is built with
Character codePoint: through #stringWith:, and every wire expectation is spelled as byte values.'
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
bytesOf: aString
  "aString's bytes as an Array of integers, so a wire assertion can name numbers rather than
   compare text. The receiver is always a byte String here -- that is one of the things under test
   (#testOutputIsAlwaysAByteString) -- so one character is one byte."
  ^(1 to: aString size) collect: [:i | (aString at: i) codePoint]
%
category: 'helpers'
method: McpJsonTest
codePointsOf: aString
  "aString's characters as an Array of codepoints. Unlike #bytesOf: this is meant for a DECODED
   string, which may be any width, and it is how every round-trip assertion in this suite is
   phrased -- see the class comment on why not text."
  ^(1 to: aString size) collect: [:i | (aString at: i) codePoint]
%
category: 'helpers'
method: McpJsonTest
nest: aCount
  "aCount nested Arrays around a 1, for the depth-limit test."
  | out |
  out := 1.
  aCount timesRepeat: [out := Array with: out].
  ^out
%
category: 'helpers'
method: McpJsonTest
refuses: aBlock
  "Whether aBlock raises an McpError -- how every rejection test asks its question."
  ^[aBlock value. false] on: McpError do: [:ex | ex return: true]
%
category: 'helpers'
method: McpJsonTest
reread: aWireString
  "Parse aWireString back the way gs-mcp's own request path would, so a round-trip assertion
   exercises the real inbound pair rather than a convenience. This is also the claim that the wire
   is legal: whatever McpJson writes, McpBase class>>parseBody: -- kernel JsonParser behind a
   #decodeFromUTF8 -- must be able to read."
  ^McpBase parseBody: aWireString
%
category: 'helpers'
method: McpJsonTest
stringWith: aCodePoint
  "A one-character string holding aCodePoint, whatever width the image needs for it. Measured: a
   stock image widens to QuadByteString and a #StringConfiguration of Unicode16 (Grail sets this)
   to Unicode32, which is exactly why nothing here asserts on a string's class except the wire."
  ^String new add: (Character codePoint: aCodePoint); yourself
%
category: 'tests - the kernel defect'
method: McpJsonTest
testAstralCharacterSurvivesWhereTheKernelWriterCorruptsIt
  "THE DEFECT THIS CLASS EXISTS FOR, asserted against the kernel side by side so the comparison
   cannot rot. CharacterCollection>>printJsonOn: keeps only bits 12-15 of a codepoint above U+FFFF
   instead of emitting a surrogate pair:
     U+1F600 (grinning face) -> ""\uF600"", U+F600, a Private Use Area character. Silently wrong.
     U+1D800                 -> ""\uD800"", a LONE SURROGATE. Not well-formed JSON at all: a strict
                                client may reject the document, and a lenient one holds a string it
                                cannot encode back to UTF-8.
   Writing UTF-8 does not fix that arithmetic so much as never reach it -- a surrogate pair is a
   thing only \u escapes and UTF-16 need, so there is nothing left to get wrong. Both codepoints
   come out as their four UTF-8 bytes and read back as themselves."
  | grin astralNonChar |
  grin := self stringWith: 16r1F600.
  astralNonChar := self stringWith: 16r1D800.
  "What the kernel does, so this test fails the day it is fixed and can then be retired."
  self assert: grin asJson equals: '"' , (String with: (Character codePoint: 92)) , 'uF600"'.
  self assert: astralNonChar asJson equals: '"' , (String with: (Character codePoint: 92)) , 'uD800"'.
  "What McpJson does: F0 9F 98 80 and F0 9D A0 80, the correct UTF-8 for each."
  self assert: (self bytesOf: (McpJson write: grin))
    equals: #(34 16rF0 16r9F 16r98 16r80 34).
  self assert: (self bytesOf: (McpJson write: astralNonChar))
    equals: #(34 16rF0 16r9D 16rA0 16r80 34).
  "And it survives a full round trip through gs-mcp's own inbound path."
  self assert: (self codePointsOf:
    ((self reread: (McpJson write: (Dictionary new at: 'k' put: grin; yourself))) at: 'k'))
    equals: (Array with: 16r1F600)
%
category: 'tests - encoding'
method: McpJsonTest
testEncoderAgreesWithTheKernelPrimitive
  "THE ORACLE. #writeUtf8CodePoint:on: must answer exactly what String>>encodeAsUTF8 answers, for
   every codepoint. Both sides of all three sequence-length boundaries, plus a spread through the
   whole range at a stride that is not a power of two, so no boundary is hit by accident.
   Surrogates are excluded because they are not encodable and McpJson deliberately substitutes
   U+FFFD for them -- #testSurrogateAndOutOfRangeBecomeReplacementCharacter covers that."
  | disagreed check |
  disagreed := OrderedCollection new.
  check := [:cp | | ours theirs |
    ours := WriteStream on: String new.
    McpJson writeUtf8CodePoint: cp on: ours.
    theirs := (self stringWith: cp) encodeAsUTF8.
    (self bytesOf: ours contents) = theirs asArray
      ifFalse: [disagreed add: cp]].
  #(16r80 16r7FF 16r800 16rD7FF 16rE000 16rFFFF 16r10000 16r10FFFF) do: [:cp | check value: cp].
  128 to: 16r10FFFF by: 977 do: [:cp |
    (cp >= 16rD800 and: [cp <= 16rDFFF]) ifFalse: [check value: cp]].
  self assert: disagreed isEmpty
    description: 'these codepoints were encoded differently from the kernel primitive: '
      , disagreed asArray printString
%
category: 'tests - encoding'
method: McpJsonTest
testEscapesOnlyWhatJsonRequires
  "RFC 8259 7 requires an escape for the quote, the backslash and the C0 controls, and NOTHING else.
   Every other character MAY be sent raw and a conforming client MUST accept it, which is the whole
   licence for this writer: the escape forms exist for transports that cannot carry 8-bit data, and
   HTTP is not one.
   So: the two mandatory escapes; the five C0 controls with a short form; a \u00XX escape for a C0
   control without one; and 0x7F raw, which is a control character in Unicode but not in C0 and
   which RFC 8259 does not ask anyone to escape."
  | bs |
  bs := String with: (Character codePoint: 92).
  self assert: (McpJson write: (String with: $")) equals: '"' , bs , '""'.
  self assert: (McpJson write: bs) equals: '"' , bs , bs , '"'.
  self assert: (McpJson write: (self stringWith: 8)) equals: '"' , bs , 'b"'.
  self assert: (McpJson write: (self stringWith: 9)) equals: '"' , bs , 't"'.
  self assert: (McpJson write: (self stringWith: 10)) equals: '"' , bs , 'n"'.
  self assert: (McpJson write: (self stringWith: 12)) equals: '"' , bs , 'f"'.
  self assert: (McpJson write: (self stringWith: 13)) equals: '"' , bs , 'r"'.
  self assert: (McpJson write: (self stringWith: 1)) equals: '"' , bs , 'u0001"'.
  self assert: (McpJson write: (self stringWith: 16r1F)) equals: '"' , bs , 'u001F"'.
  self assert: (self bytesOf: (McpJson write: (self stringWith: 16r7F))) equals: #(34 16r7F 34)
%
category: 'tests - encoding'
method: McpJsonTest
testMultiByteSequencesAreWritten
  "Two-, three- and four-byte sequences, spelled as the bytes a client will actually receive:
   U+00E9 -> C3 A9, U+2603 -> E2 98 83, U+1F600 -> F0 9F 98 80. Under the escaping policy these
   were 6, 6 and 12 bytes of \u respectively, and the last of the three was wrong."
  self assert: (self bytesOf: (McpJson write: (self stringWith: 16rE9)))
    equals: #(34 16rC3 16rA9 34).
  self assert: (self bytesOf: (McpJson write: (self stringWith: 16r2603)))
    equals: #(34 16rE2 16r98 16r83 34).
  self assert: (self bytesOf: (McpJson write: (self stringWith: 16r1F600)))
    equals: #(34 16rF0 16r9F 16r98 16r80 34)
%
category: 'tests - the byte-String invariant'
method: McpJsonTest
testOutputIsAlwaysAByteString
  "THE INVARIANT THE TRANSPORT RESTS ON, and the reason this writer encodes rather than leaving
   characters for the socket. Three unrelated mechanisms read the answer as bytes:
   McpHttpConnection writes Content-Length as `body size`; the worker->front-end hop is measured in
   bytes by the kernel's result fetch, whose buffer is sized in bytes; and GS_MCP_TRACE writes
   bodies to the gem log through GsFile, where a 16-bit string comes out garbled.
   A DoubleByteString of n characters is 2n bytes on the wire and a QuadByteString 4n, so a wide
   answer would break all three -- and `WriteStream on: String new` DOES widen the moment a
   character above 0xFF is put on it (measured: to QuadByteString on a stock image, to Unicode32
   where #StringConfiguration is Unicode16). The writer keeps the stream narrow by converting to
   bytes before the stream sees them, which is what makes #size the byte count by construction
   rather than by the body happening to be ASCII.
   Asserted for ASCII, Latin-1, BMP and astral content, and for a deliberately WIDE input string --
   the input's width must not leak into the output's."
  | wide |
  self assert: (McpJson write: 'plain') class equals: String.
  self assert: (McpJson write: (self stringWith: 16rE9)) class equals: String.
  self assert: (McpJson write: (self stringWith: 16r2603)) class equals: String.
  self assert: (McpJson write: (self stringWith: 16r1F600)) class equals: String.
  wide := self stringWith: 16r1F600.
  self deny: wide class == String description: 'this test needs a genuinely wide input'.
  self assert: (McpJson write: (Dictionary new at: 'k' put: wide; yourself)) class equals: String.
  "And #size really is the byte count: one astral character is four bytes, not one."
  self assert: (McpJson write: wide) size equals: 6
%
category: 'tests - structure'
method: McpJsonTest
testRefusesAnObjectItCannotRender
  "Object>>printJsonOn: renders an object as its #jsonKeys instance variables, so anything with none
   -- a Character, most notably -- renders as {} and ships a silently empty value to the client.
   Refusing surfaces the omission where it was introduced instead. Same policy the escaping writer
   had; kept because it is orthogonal to the encoding and is worth having either way."
  self assert: $a asJson equals: '{}'.
  self assert: (self refuses: [McpJson write: $a]).
  self assert: (self refuses: [McpJson write: (Dictionary new at: 'k' put: $a; yourself)])
%
category: 'tests - structure'
method: McpJsonTest
testRefusesExcessiveNesting
  "The writer's only defence against a cyclic structure. The kernel writer carried an
   AlmostOutOfStack handler for exactly that, which is a fault to catch rather than a limit to
   state."
  self assert: (McpJson write: (self nest: McpJson maxDepth)) notNil.
  self assert: (self refuses: [McpJson write: (self nest: McpJson maxDepth + 2)])
%
category: 'tests - structure'
method: McpJsonTest
testRendersEveryShapeAResponseCanHold
  "Every value type gs-mcp puts in a response, plus the ones a client can put in a JSON-RPC id.
   A SymbolDictionary is here on purpose: it is NOT a kind of Dictionary (it descends from
   AbstractDictionary by way of IdentityDictionary), so a dictionary test naming the concrete class
   would render it as an array of Associations."
  | sd |
  self assert: (McpJson write: nil) equals: 'null'.
  self assert: (McpJson write: true) equals: 'true'.
  self assert: (McpJson write: false) equals: 'false'.
  self assert: (McpJson write: 42) equals: '42'.
  self assert: (McpJson write: -7) equals: '-7'.
  self assert: (McpJson write: 123456789012345678901234567890) equals: '123456789012345678901234567890'.
  self assert: (McpJson write: 1.5) equals: '1.5'.
  self assert: (McpJson write: #aSymbol) equals: '"aSymbol"'.
  self assert: (McpJson write: #(1 2 3)) equals: '[1,2,3]'.
  self assert: (McpJson write: (OrderedCollection new add: 1; add: 2; yourself)) equals: '[1,2]'.
  self assert: (McpJson write: (Array new)) equals: '[]'.
  self assert: (McpJson write: (Dictionary new)) equals: '{}'.
  self assert: (McpJson write: (Dictionary new at: 'a' put: 1; yourself)) equals: '{"a":1}'.
  "A non-string key is stringified, the way the kernel writer's `key asString` did."
  self assert: (McpJson write: (Dictionary new at: 7 put: 1; yourself)) equals: '{"7":1}'.
  sd := SymbolDictionary new.
  sd at: #k put: 1.
  self assert: (McpJson write: sd) equals: '{"k":1}'
%
category: 'tests - structure'
method: McpJsonTest
testRendersInfinityAndNaNAsNull
  "Neither has a JSON spelling, and GemStone prints them as PlusInfinity and the like, which no
   client can parse. A Float reaches this writer only when a client puts one in a JSON-RPC id and
   the dispatcher echoes it back; nothing gs-mcp builds produces one."
  self assert: (McpJson write: (1.0 / 0.0)) equals: 'null'.
  self assert: (McpJson write: (-1.0 / 0.0)) equals: 'null'.
  self assert: (McpJson write: (0.0 / 0.0)) equals: 'null'
%
category: 'tests - round trip'
method: McpJsonTest
testRoundTripsThroughTheRealInboundPath
  "What this writer emits, gs-mcp's own request path must be able to read -- which is both a
   round-trip property and the claim that the wire is legal JSON, since the reader is kernel
   JsonParser behind a #decodeFromUTF8 and not a codec written to match.
   A full JSON-RPC envelope with text at all four sequence lengths in it, asserted on CODEPOINTS
   (see the class comment)."
  | text response back |
  text := WriteStream on: String new.
  text nextPutAll: 'ok '.
  text nextPut: (Character codePoint: 16rE9).
  text nextPut: (Character codePoint: 16r2603).
  text nextPut: (Character codePoint: 16r1F600).
  response := Dictionary new.
  response at: 'jsonrpc' put: '2.0'.
  response at: 'id' put: 1.
  response at: 'result' put: (Dictionary new
    at: 'content' put: (Array with: (Dictionary new at: 'text' put: text contents; yourself));
    at: 'isError' put: false;
    yourself).
  back := self reread: (McpJson write: response).
  self assert: (back at: 'jsonrpc') equals: '2.0'.
  self assert: (back at: 'id') equals: 1.
  self deny: ((back at: 'result') at: 'isError').
  self assert: (self codePointsOf: ((((back at: 'result') at: 'content') at: 1) at: 'text'))
    equals: #(111 107 32 16rE9 16r2603 16r1F600)
%
category: 'tests - encoding'
method: McpJsonTest
testSurrogateAndOutOfRangeBecomeReplacementCharacter
  "Two codepoints have no UTF-8 spelling and must not be allowed to produce an ill-formed sequence.
   A surrogate can genuinely arrive as a Character: 3.7.x refuses to construct one, but 3.6.2
   permits it, so a string built there and stored can reach a writer here.
   Anything above U+10FFFF is not Unicode. Both become U+FFFD -- EF BF BD -- which is what a
   decoder is required to substitute anyway, so the client sees the standard 'something was lost
   here' rather than bytes it cannot decode.
   Guarded, because on 3.7.x #stringWith: cannot build the surrogate case at all; where it cannot,
   the codepoint is passed to the writer directly, which is the path that matters."
  | ws |
  ws := WriteStream on: String new.
  McpJson writeUtf8CodePoint: 16rD83D on: ws.
  self assert: (self bytesOf: ws contents) equals: #(16rEF 16rBF 16rBD).
  ws := WriteStream on: String new.
  McpJson writeUtf8CodePoint: 16rDFFF on: ws.
  self assert: (self bytesOf: ws contents) equals: #(16rEF 16rBF 16rBD).
  ws := WriteStream on: String new.
  McpJson writeUtf8CodePoint: 16r110000 on: ws.
  self assert: (self bytesOf: ws contents) equals: #(16rEF 16rBF 16rBD)
%
category: 'tests - encoding'
method: McpJsonTest
testUtf8IsSmallerOnTheWireThanEscaping
  "Not a correctness property, but a real one and cheap to pin: a \u escape costs 6 bytes for every
   non-ASCII character, where UTF-8 costs 2 for Latin-1, 3 for the rest of the BMP and 4 for astral.
   That is a third to a half of the bytes for prose in a non-Latin script, and gs-mcp's largest
   responses are method source and error text.
   It also means the wire is readable in a packet capture or a log, which the escaped form is not."
  | text |
  text := WriteStream on: String new.
  1 to: 20 do: [:i | text nextPut: (Character codePoint: 16r2603)].
  self assert: text contents asJson size equals: 20 * 6 + 2.
  self assert: (McpJson write: text contents) size equals: 20 * 3 + 2
%
