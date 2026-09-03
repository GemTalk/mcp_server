set compile_env: 0
! ------------------- Class definition for McpJson
expectvalue /Class
doit
Object subclass: 'McpJson'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpJson comment: 
'The JSON WRITER gs-mcp owns, replacing Object>>asJson on every production path. Class-side only;
never instantiated. There is deliberately no parser here: kernel JsonParser is kept, and #parseBody:
hands it a decoded character string (McpBase class>>parseBody:). Owning half the codec rather than
all of it is the whole point of the UTF-8 design -- see WHY ONLY THE WRITER below.

THE WIRE IS UTF-8. #write: answers a byte String whose bytes are UTF-8, which is what RFC 8259 8.1
says JSON on a wire is, and what #parseBody: already assumes on the way in. A character above 0x7F
is emitted as its 2-4 UTF-8 bytes, not as a \u escape. Nothing in the JSON grammar is escaped that
does not have to be: the two mandatory escapes (quote, backslash), the five short forms for
C0 controls that have one, and \u00XX for the rest of C0. RFC 8259 7 permits every other character
raw, and a client MUST accept it -- the escape form exists for transports that cannot carry 8-bit
data, which HTTP is not.

WHY ONLY THE WRITER. Three Unicode defects were measured in the kernel''s JSON, identically on
3.6.2, 3.7.2, 3.7.5 and 3.7.6 (docs/kernel-json-unicode.md). Exactly one of them is on the write
path, and it is the only one an application cannot route around:
 1. CharacterCollection>>printJsonOn: keeps only bits 12-15 of a codepoint above U+FFFF instead of
    emitting a surrogate pair, so U+1F600 goes out as "\uF600" -- silently the wrong character, and
    for some codepoints a LONE SURROGATE, which is not well-formed JSON. By the time #asJson
    answers, the codepoint is gone; no post-pass can recover it. THIS IS WHY THIS CLASS EXISTS.
    Writing UTF-8 does not fix the defect so much as never reach it: there is no surrogate pair to
    get wrong, because a surrogate pair is a thing only \u escapes need.
 2. JsonParser cannot DECODE a surrogate pair (it sends Character codePoint: to each escape and
    3.7.x refuses a surrogate, OutOfRange 2723). That is an inbound defect and it is not fixed by
    owning a writer -- McpBase class>>combineSurrogateEscapesIn: handles it in 40 lines on the raw
    body, which is a great deal less than a parser.
 3. An escape JsonParser does not recognize is silently dropped. Left in place: it needs a real
    parser to fix, it is a client-side bug when it happens, and it costs the client one wrong value
    rather than corrupting anything gs-mcp stores.
Everything the kernel parser does RIGHT is therefore kept, and measured: it decodes a raw astral
character correctly (widening its accumulator to a QuadByteString), and it launders the Unicode
family, so a decoded body comes back as String/DoubleByteString/QuadByteString and never as a
Unicode7 -- which on a stock image RAISES when compared to a String rather than answering false.

WHAT DEPENDS ON THE OUTPUT BEING A byte String, which it always is. These three held under the
old ASCII-only policy for an incidental reason (nothing above 0x7E) and hold under this one for a
structural one (a byte String''s #size IS its byte count, whatever the bytes are):
 - McpHttpConnection writes Content-Length as `body size`;
 - the worker->front-end hop is measured in BYTES by the kernel''s result fetch, whose buffer is
   sized in bytes (see McpExternalSessionTest) -- a wide string crossing it is not safe, which is
   why this writer emits BYTES rather than leaving characters for the transport to encode;
 - GS_MCP_TRACE writes bodies to the gem log through GsFile, where a 16-bit string comes out
   garbled.
That is the argument for encoding here rather than at the socket: the response leaves the worker
gem long before it reaches a socket, and the only representation safe across every hop in between
is bytes.

THE ENCODER HAS AN ORACLE, which the escaping one it replaced did not: #writeUtf8CodePoint:on: must
agree with the kernel primitive #encodeAsUTF8 for every codepoint, and McpJsonTest checks exactly
that over the whole range including both sides of each boundary. Nothing in the kernel produces a
correct JSON \u escape for an astral codepoint, so the ASCII writer''s surrogate arithmetic could
only ever be checked against expectations written by the same hand that wrote the code.'
%
expectvalue /Class
doit
McpJson category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpJson
removeallmethods McpJson
removeallclassmethods McpJson
! ------------------- Class methods for McpJson
category: 'private'
classmethod: McpJson
keyStringFor: aKey
  "The JSON object key for aKey. A CharacterCollection (String or Symbol) is its own key; anything
   else is printed, which is how a Dictionary keyed by the integer 7 renders with the key 7 as a
   JSON string. Same rule the kernel writer used (`key asString`), spelled so that a Symbol does
   not have to be copied."
  ^(aKey isKindOf: CharacterCollection) ifTrue: [aKey] ifFalse: [aKey printString]
%
category: 'constants'
classmethod: McpJson
maxDepth
  "How many containers may enclose a value. The writer has no other defence against a cyclic
   structure -- the kernel writer carried an AlmostOutOfStack handler for exactly that, which is a
   fault to catch rather than a limit to state. 64 is far past anything JSON-RPC or an MCP tool
   schema needs."
  ^64
%
category: 'writing'
classmethod: McpJson
write: anObject
  "Answer anObject rendered as JSON in a byte String of UTF-8. See the class comment for the wire
   contract and for the three mechanisms that depend on the answer being bytes.
   `WriteStream on: String new` would WIDEN to a DoubleByteString or QuadByteString the moment a
   character above 0xFF were put on it, and that is exactly what must not happen here, so no
   character above 0xFF ever reaches it: #writeCharacter:on: converts to bytes first. The stream
   stays a byte String by construction rather than by luck, and there is no encode-then-narrow pass
   over the finished response."
  | out |
  out := WriteStream on: String new.
  self write: anObject on: out depth: 0.
  ^out contents
%
category: 'private'
classmethod: McpJson
write: anObject on: aStream depth: aDepth
  "Render one value. The order of these tests matters: a Symbol is a CharacterCollection, a String
   is a Collection, and a SymbolDictionary is NOT a kind of Dictionary (it descends from
   AbstractDictionary by way of IdentityDictionary), which is why the dictionary test names the
   abstract class."
  aDepth > self maxDepth ifTrue: [
    ^McpError signalKind: #internal message:
      'Cannot render JSON nested deeper than ' , self maxDepth printString
        , ' levels -- a cyclic structure?'].
  anObject isNil ifTrue: [^aStream nextPutAll: 'null'].
  anObject == true ifTrue: [^aStream nextPutAll: 'true'].
  anObject == false ifTrue: [^aStream nextPutAll: 'false'].
  (anObject isKindOf: Integer) ifTrue: [^aStream nextPutAll: anObject printString].
  (anObject isKindOf: Float) ifTrue: [^self writeFloat: anObject on: aStream].
  (anObject isKindOf: CharacterCollection) ifTrue: [^self writeString: anObject on: aStream].
  (anObject isKindOf: AbstractDictionary) ifTrue: [
    ^self writeDictionary: anObject on: aStream depth: aDepth].
  (anObject isKindOf: Collection) ifTrue: [
    ^self writeCollection: anObject on: aStream depth: aDepth].
  ^McpError signalKind: #internal message:
    'Cannot render a ' , anObject class name , ' as JSON. The kernel writer answered {} for an '
      , 'object it did not know, which ships a silently empty value to the client; this refuses '
      , 'instead, so the omission surfaces where it was introduced.'
%
category: 'private'
classmethod: McpJson
writeCharacter: aCharacter on: aStream
  "Render one character of a JSON string.
   RFC 8259 7 requires an escape for exactly two characters, the quote and the backslash, and for
   the C0 controls; everything else MAY go raw, and a conforming client MUST accept it raw. So
   everything from 0x20 up -- including 0x7F, and including every non-ASCII character, as its UTF-8
   bytes -- is written as itself. This is the one method the whole ASCII-versus-UTF-8 choice comes
   down to: under the ASCII policy the last line was a \u escape (plus, above U+FFFF, a surrogate
   pair the kernel gets wrong); here it is the character''s own bytes."
  | codePoint |
  codePoint := aCharacter codePoint.
  codePoint = 34 ifTrue: [^aStream nextPutAll: '\"'].
  codePoint = 92 ifTrue: [^aStream nextPutAll: '\\'].
  codePoint = 8 ifTrue: [^aStream nextPutAll: '\b'].
  codePoint = 9 ifTrue: [^aStream nextPutAll: '\t'].
  codePoint = 10 ifTrue: [^aStream nextPutAll: '\n'].
  codePoint = 12 ifTrue: [^aStream nextPutAll: '\f'].
  codePoint = 13 ifTrue: [^aStream nextPutAll: '\r'].
  codePoint < 32 ifTrue: [^self writeUnitEscape: codePoint on: aStream].
  codePoint < 128 ifTrue: [^aStream nextPut: aCharacter].
  ^self writeUtf8CodePoint: codePoint on: aStream
%
category: 'private'
classmethod: McpJson
writeCollection: aCollection on: aStream depth: aDepth
  "Render any non-dictionary Collection as a JSON array."
  | first |
  aStream nextPut: $[.
  first := true.
  aCollection do: [:each |
    first ifTrue: [first := false] ifFalse: [aStream nextPut: $,].
    self write: each on: aStream depth: aDepth + 1].
  ^aStream nextPut: $]
%
category: 'private'
classmethod: McpJson
writeDictionary: aDictionary on: aStream depth: aDepth
  "Render a dictionary as a JSON object. KEY ORDER IS UNSPECIFIED -- a GemStone dictionary has no
   insertion order, and the kernel writer's was arbitrary too. Nothing may depend on it; tests parse."
  | first |
  aStream nextPut: ${.
  first := true.
  aDictionary keysAndValuesDo: [:key :value |
    first ifTrue: [first := false] ifFalse: [aStream nextPut: $,].
    self writeString: (self keyStringFor: key) on: aStream.
    aStream nextPut: $:.
    self write: value on: aStream depth: aDepth + 1].
  ^aStream nextPut: $}
%
category: 'private'
classmethod: McpJson
writeFloat: aFloat on: aStream
  "Render a Float. Infinity and NaN have no JSON spelling -- GemStone prints them as PlusInfinity
   and the like, which no client can parse -- so they become null. A Float reaches this writer only
   when a client puts one in a JSON-RPC id and the dispatcher echoes it back; nothing gs-mcp builds
   produces one. Float has no #isFinite here, hence the subtraction: x - x is 0.0 for every finite
   value and NaN for both infinities and NaN itself."
  ((aFloat - aFloat) = 0.0) ifFalse: [^aStream nextPutAll: 'null'].
  ^aStream nextPutAll: aFloat printString
%
category: 'private'
classmethod: McpJson
writeString: aCharacterCollection on: aStream
  "Render a String, Symbol or wide string as a JSON string."
  aStream nextPut: $".
  1 to: aCharacterCollection size do: [:i |
    self writeCharacter: (aCharacterCollection at: i) on: aStream].
  ^aStream nextPut: $"
%
category: 'private'
classmethod: McpJson
writeUnitEscape: aCodeUnit on: aStream
  "Write one \uXXXX escape, uppercase hex. Reached only for a C0 control with no short form --
   0x00-0x07, 0x0B, 0x0E-0x1F -- which RFC 8259 7 requires be escaped and which have no UTF-8
   spelling a JSON string may carry raw. Never reached for a character above 0x7F, and that is the
   whole difference between this writer and the ASCII one: there is no codepoint here big enough to
   need the surrogate-pair arithmetic the kernel gets wrong."
  | digits |
  digits := '0123456789ABCDEF'.
  aStream nextPutAll: '\u'.
  aStream nextPut: (digits at: 1 + ((aCodeUnit bitShift: -12) bitAnd: 16rF)).
  aStream nextPut: (digits at: 1 + ((aCodeUnit bitShift: -8) bitAnd: 16rF)).
  aStream nextPut: (digits at: 1 + ((aCodeUnit bitShift: -4) bitAnd: 16rF)).
  ^aStream nextPut: (digits at: 1 + (aCodeUnit bitAnd: 16rF))
%
category: 'private'
classmethod: McpJson
writeUtf8CodePoint: aCodePoint on: aStream
  "Write one codepoint above 0x7F as its UTF-8 bytes (RFC 3629), each byte one Character of the byte
   String being built. Must agree with the kernel primitive #encodeAsUTF8 for every codepoint;
   McpJsonTest asserts that over the whole range, including both sides of all three boundaries.
   Two codepoints cannot be encoded and become U+FFFD rather than an ill-formed sequence: a
   surrogate, which is constructible as a Character on 3.6.2 and so can genuinely arrive, and
   anything above U+10FFFF, which is not Unicode. Note what is NOT here -- the surrogate-pair
   arithmetic. A surrogate pair is an artefact of \u escapes and of UTF-16; UTF-8 spells an astral
   codepoint directly in four bytes, so the kernel''s write-path defect has no analogue to get
   wrong."
  | cp |
  cp := aCodePoint.
  ((cp >= 16rD800 and: [cp <= 16rDFFF]) or: [cp > 16r10FFFF]) ifTrue: [cp := 16rFFFD].
  cp < 16r800 ifTrue: [
    aStream nextPut: (Character codePoint: 16rC0 + (cp bitShift: -6)).
    ^aStream nextPut: (Character codePoint: 16r80 + (cp bitAnd: 16r3F))].
  cp < 16r10000 ifTrue: [
    aStream nextPut: (Character codePoint: 16rE0 + (cp bitShift: -12)).
    aStream nextPut: (Character codePoint: 16r80 + ((cp bitShift: -6) bitAnd: 16r3F)).
    ^aStream nextPut: (Character codePoint: 16r80 + (cp bitAnd: 16r3F))].
  aStream nextPut: (Character codePoint: 16rF0 + (cp bitShift: -18)).
  aStream nextPut: (Character codePoint: 16r80 + ((cp bitShift: -12) bitAnd: 16r3F)).
  aStream nextPut: (Character codePoint: 16r80 + ((cp bitShift: -6) bitAnd: 16r3F)).
  ^aStream nextPut: (Character codePoint: 16r80 + (cp bitAnd: 16r3F))
%
! ------------------- Instance methods for McpJson
