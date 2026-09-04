set compile_env: 0
! ------------------- Class definition for McpUtf8Test
expectvalue /Class
doit
GsTestCase subclass: 'McpUtf8Test'
  instVarNames: #( session)
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
needs, and the surrogate-escape repair it needs alongside it, in McpBase class>>parseBody: --
`JsonParser parse: (self combineSurrogateEscapesIn: aString asString decodeFromUTF8 asString)`.
The outbound half -- the writer -- is McpJsonTest.

JSON is UTF-8 on the wire and kernel JsonParser takes a CHARACTER string, so a body handed straight
from the socket to the parser was read one Latin-1 character per byte. That is the defect these
tests are a regression for, and the one every real client hits -- a pound sign or a degree sign in a
compile_method source arrived as two characters and was stored that way.

Every send but #combineSurrogateEscapesIn: is stock kernel, so these tests pin a POLICY, not an
algorithm: that the decode happens at all, and that a malformed sequence refuses the whole body
rather than being repaired in.
The second is a deliberate choice -- an earlier gs-mcp decoder substituted one U+FFFD per bad
sequence and kept the call. Refusing tells a client with a broken encoder that it is broken,
instead of storing text nobody meant.

WHAT THE KERNEL PARSER STILL GETS WRONG, and is deliberately not covered here, because gs-mcp does
not work around it: an escape the parser does not recognize is silently dropped rather than refused,
and trailing content, duplicate keys and raw control characters are all accepted. Those need a real
parser to fix, they are measured in the kernel JSON Unicode report, and testing them here would only
pin defects this code does not own.
Note the two that are NO LONGER on that list, because both halves of the emoji problem are answered
now. Outbound, an astral codepoint went out as one wrong escape -- the defect an application could
not route around -- and gs-mcp answers it by writing UTF-8 instead of escapes (McpJson). Inbound, an
escaped surrogate pair failed the whole request, which is what Python''s json.dumps sends by
default, and #combineSurrogateEscapesIn: repairs it before the parser can refuse it. So both client
styles now round-trip an emoji, and testEscapedSurrogatePairIsCombined is the regression for the
second.

ONE test crosses a real worker gem, and it is the important one. Everything else hands parseBody: a
byte String, because that is what a socket delivers -- and that shared assumption is exactly how the
leading #asString came to be missing for a day. The body does not reach the worker as the bytes the
socket read: it reaches it as a COMPILED STRING LITERAL, whose class comes from the WORKER
session''s #StringConfiguration. A mock worker cannot show that, so
#testWorkerDecodesABodyItRecompiled logs a real one in. It costs one session slot and a few seconds;
the alternative is not covering the only place this has actually broken.

Nothing here commits or moves the driving session''s view, so this suite still needs no
movesTheSessionView opt-in -- logging a worker gem in and out is not a view change in this gem.

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
category: 'running'
method: McpUtf8Test
setUp
  "No worker gem yet -- only the one test that needs one asks for it."
  session := nil
%
category: 'running'
method: McpUtf8Test
tearDown
  "Give the worker gem back. Guarded, because a test that failed mid-call still has to log out, and
   a test that never logged one in has nothing to close."
  session ifNotNil: [:s | [s close] on: Error do: [:e | nil]].
  session := nil
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
category: 'tests-worker-hop'
method: McpUtf8Test
testWorkerDecodesABodyItRecompiled
  "REGRESSION, and the only test in gs-mcp that crosses a real GCI hop with a non-ASCII body.
   McpSession>>forward: embeds the raw body in a Smalltalk expression via printString and the worker
   gem COMPILES that literal, so the string parseBody: sees there is not the byte String the socket
   read -- its class comes from the WORKER session''s #StringConfiguration. Configured for Unicode16
   (every Grail image, including the live server''s), an all-ASCII body compiles as Unicode7 and one
   carrying a byte above 16r7F compiles as Unicode16. Unicode7 understands #decodeFromUTF8;
   Unicode16 does not. So the class that understands it is exactly the one that never needs it, and
   for a day every body with one accented character came back a -32700 with nothing to say why: the
   MessageNotUnderstood was caught by the catch-all whose job is to report malformed JSON.
   The leading #asString in parseBody: is what fixes it, and this is the test that holds it there.
   Asserted through #forward: rather than a hand-built expression so the real expression builder is
   in the path -- the bug lived in the gap between what that builds and what parseBody: assumed.
   describe_class, following McpContractTest>>testWorkerDecodesUtf8AndAnswersUtf8, because it
   echoes the name it was given straight back and changes nothing. That test makes the same two
   assertions in-process; this one makes them across the boundary that broke.
   The outbound assertion is spelled in BYTES, because the wire is UTF-8 in both directions now
   (McpJson): the e-acute leaves as the same two bytes it arrived as, not as a \u escape. Missing
   the decode does not merely lose the character -- the two bytes are read as two Latin-1
   characters and re-encoded as FOUR, which is the mojibake the second assertion denies."
  | eAcute body out compiledAs |
  eAcute := self bodyOfBytes: #(16rC3 16rA9).
  session := McpSession startWithId: 'utf8-worker-recompile'.
  compiledAs := session runWorker: '(''caf' , eAcute , ''') class name asString'.
  body := '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"describe_class",'
    , '"arguments":{"className":"Caf' , eAcute , '"}}}'.
  out := session forward: body.
  self deny: (self includesCS: '-32700' in: out)
    description: 'the worker refused a body with one accented character as malformed JSON. It'
      , ' compiled that body as ' , compiledAs printString , ', and parseBody: has to decode'
      , ' whatever class the worker made of it: ' , out.
  self assert: (self includesCS: 'Caf' , eAcute in: out)
    description: 'the worker answered without the e-acute''s two UTF-8 bytes behind ''Caf'': ' , out.
  self deny: (self includesCS: (self bodyOfBytes: #(16rC3 16r82 16rC2 16rA9)) in: out)
    description: 'the two bytes were read as two Latin-1 characters and written back as four --'
      , ' the mojibake that compile_method would store to stay: ' , out
%
