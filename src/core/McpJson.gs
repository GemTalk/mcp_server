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
'The JSON codec gs-mcp owns, replacing kernel JsonParser and Object>>asJson on every production
path. Class-side only; never instantiated. Recursive descent over a ReadStream, so no parse state
lives on the class.

WHY WE DO NOT USE THE KERNEL''S. Measured identically on 3.6.2, 3.7.2, 3.7.5 and 3.7.6:
 1. CharacterCollection>>printJsonOn: keeps only bits 12-15 of a codepoint above U+FFFF instead of
    emitting a surrogate pair, so U+1F600 goes out as "\uF600". Unfixable downstream -- by the time
    asJson answers, the information is gone. This is what forces us to own the WRITER, not just the
    parser.
 2. JsonParser has no surrogate-pair decoding: it sends Character codePoint: to each \u escape, and
    3.7.x refuses a surrogate (OutOfRange 2723), so an emoji became a -32700 Parse error. On 3.6.2
    surrogate Characters are legal, so the same input silently yielded two broken characters.
 3. Nothing decoded the request body from UTF-8, so a raw-UTF-8 client (which is every real MCP
    client) got Latin-1 mojibake: ''cafe'' with an e-acute measured 5 characters, not 4.

THE WIRE CONTRACT: #write: answers a String containing only bytes 0x20-0x7E. Everything else is
\u-escaped. Three things depend on that and would break quietly if the policy changed:
 - McpHttpConnection Content-Length is `body size`, which equals the byte count only for ASCII;
 - the worker->front-end hop is measured in BYTES by the kernel''s result fetch, whose buffer is
   sized in bytes (see McpExternalSessionTest), and ASCII keeps `size` and the byte count equal;
 - GS_MCP_TRACE writes bodies to the gem log through GsFile, where 16-bit strings come out garbled.

THE Unicode7 TRAP, which shapes the parser. `''code'' decodeFromUTF8` answers a Unicode7, and on a
stock image comparing a Unicode7 to a String RAISES (ArgumentError: non-Unicode argument disallowed
in Unicode comparison) rather than answering false -- so a Dictionary keyed by decoded strings would
raise on every `args at: ''code''` in every toolset. Worse, whether it raises depends on what else is
loaded: measured raising on stock 3.6.2, 3.7.2, 3.7.5 and 3.7.6, but a Grail image answers true,
because Grail replaces Unicode7>>= with an unguarded _unicodeEqual:. Neither behaviour can be relied
on in a customer image.
So this parser never produces a Unicode7 or Unicode16: it decodes UTF-8 itself into a WriteStream on
String new, which stays a byte String while the content is ASCII and widens to DoubleByteString only
when it must. DoubleByteString compares with String correctly, so both are safe as keys and values.'
%
expectvalue /Class
doit
McpJson category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpJson
removeallmethods McpJson
removeallclassmethods McpJson
! ------------------- Class methods for McpJson
category: 'private-decoding'
classmethod: McpJson
decodeUtf8: aByteString
  "Answer aByteString's bytes decoded from UTF-8 as characters. Answers the receiver untouched when
   it is already all-ASCII, which is the overwhelmingly common case and the whole reason for the
   scan in #isAllAscii:.
   THE ONE PLACE THE MALFORMED-INPUT POLICY LIVES. A byte that cannot start a well-formed sequence,
   a truncated sequence, a bad continuation byte, an overlong encoding and an encoded surrogate all
   become U+FFFD, and the scan resumes at the NEXT byte. The alternative -- failing the whole
   request -- was rejected because one mis-encoded byte in a 50KB compile_method source would lose
   the entire call with a message that cannot say where. U+FFFD is corruption too, but it is visible
   at the exact spot, unlike the Latin-1 mojibake this class exists to end.
   Builds into a WriteStream on String new on purpose -- see the Unicode7 trap in the class
   comment."
  | out i size lead continuations codePoint wellFormed |
  (self isAllAscii: aByteString) ifTrue: [^aByteString].
  out := WriteStream on: String new.
  i := 1.
  size := aByteString size.
  [i <= size] whileTrue: [
    lead := (aByteString at: i) codePoint.
    lead < 128 ifTrue: [
      out nextPut: (Character codePoint: lead).
      i := i + 1]
    ifFalse: [
      continuations := nil.
      (lead bitAnd: 16rE0) = 16rC0 ifTrue: [continuations := 1. codePoint := lead bitAnd: 16r1F].
      (lead bitAnd: 16rF0) = 16rE0 ifTrue: [continuations := 2. codePoint := lead bitAnd: 16r0F].
      (lead bitAnd: 16rF8) = 16rF0 ifTrue: [continuations := 3. codePoint := lead bitAnd: 16r07].
      continuations isNil ifTrue: [
        out nextPut: self replacementCharacter.
        i := i + 1]
      ifFalse: [
        wellFormed := i + continuations <= size.
        wellFormed ifTrue: [
          1 to: continuations do: [:k | | byte |
            byte := (aByteString at: i + k) codePoint.
            (byte bitAnd: 16rC0) = 16r80
              ifTrue: [codePoint := (codePoint bitShift: 6) bitOr: (byte bitAnd: 16r3F)]
              ifFalse: [wellFormed := false]]].
        (wellFormed and: [self isScalar: codePoint forContinuationCount: continuations])
          ifTrue: [
            out nextPut: (Character codePoint: codePoint).
            i := i + continuations + 1]
          ifFalse: [
            out nextPut: self replacementCharacter.
            i := i + 1]]]].
  ^out contents
%
category: 'private-parsing'
classmethod: McpJson
digitRunIn: aString from: anIndex
  "The index just past the run of ASCII digits starting at anIndex -- anIndex itself when there is
   no digit there."
  | i |
  i := anIndex.
  [i <= aString size and: [self isDigitCharacter: (aString at: i)]] whileTrue: [i := i + 1].
  ^i
%
category: 'private-parsing'
classmethod: McpJson
hexValueOf: aCharacter
  "The value 0-15 of aCharacter as a hex digit, or nil if it is not one."
  | codePoint |
  codePoint := aCharacter codePoint.
  (codePoint >= 48 and: [codePoint <= 57]) ifTrue: [^codePoint - 48].
  (codePoint >= 97 and: [codePoint <= 102]) ifTrue: [^codePoint - 87].
  (codePoint >= 65 and: [codePoint <= 70]) ifTrue: [^codePoint - 55].
  ^nil
%
category: 'private-decoding'
classmethod: McpJson
isAllAscii: aString
  "Whether every character of aString is 0x00-0x7F, so decoding and re-escaping have nothing to do."
  1 to: aString size do: [:i |
    (aString at: i) codePoint > 127 ifTrue: [^false]].
  ^true
%
category: 'private-parsing'
classmethod: McpJson
isDigitCharacter: aCharacter
  "Whether aCharacter is one of the ten ASCII digits."
  | codePoint |
  codePoint := aCharacter codePoint.
  ^codePoint >= 48 and: [codePoint <= 57]
%
category: 'private-parsing'
classmethod: McpJson
isNumberCharacter: aCharacter
  "Whether aCharacter can appear in a JSON number token. Deliberately loose -- the token is gathered
   by this test and then VALIDATED by the conversion in #readNumber:, so '1-2' is caught there
   rather than being silently truncated to 1 here."
  | codePoint |
  codePoint := aCharacter codePoint.
  (codePoint >= 48 and: [codePoint <= 57]) ifTrue: [^true].
  ^'-+.eE' includes: aCharacter
%
category: 'private-parsing'
classmethod: McpJson
isNumberToken: aString
  "Whether aString is a JSON number: an optional minus, an integer part with no leading zero, then
   an optional fraction and an optional exponent, each needing at least one digit.
   THE CONVERSION CANNOT BE TRUSTED TO JUDGE THIS. `'1-2' asInteger` answers 1 -- it stops at the
   first thing it does not like and reports success, so a malformed number would reach a tool as a
   plausible wrong value rather than as an error."
  | size i next |
  size := aString size.
  i := 1.
  (i <= size and: [(aString at: i) = $-]) ifTrue: [i := i + 1].
  next := self digitRunIn: aString from: i.
  next = i ifTrue: [^false].
  (next - i > 1 and: [(aString at: i) = $0]) ifTrue: [^false].
  i := next.
  (i <= size and: [(aString at: i) = $.]) ifTrue: [
    i := i + 1.
    next := self digitRunIn: aString from: i.
    next = i ifTrue: [^false].
    i := next].
  (i <= size and: [(aString at: i) = $e or: [(aString at: i) = $E]]) ifTrue: [
    i := i + 1.
    (i <= size and: [(aString at: i) = $+ or: [(aString at: i) = $-]]) ifTrue: [i := i + 1].
    next := self digitRunIn: aString from: i.
    next = i ifTrue: [^false].
    i := next].
  ^i > size
%
category: 'private-decoding'
classmethod: McpJson
isScalar: aCodePoint forContinuationCount: aCount
  "Whether aCodePoint is a Unicode scalar value that was legitimately encoded in aCount+1 bytes.
   Rejects overlong encodings (the classic UTF-8 smuggling trick: 16rC0 16rAF is a '/' that a naive
   decoder would not see as one), encoded surrogates, and anything past U+10FFFF."
  | minimum |
  minimum := aCount = 1 ifTrue: [16r80] ifFalse: [aCount = 2 ifTrue: [16r800] ifFalse: [16r10000]].
  aCodePoint < minimum ifTrue: [^false].
  aCodePoint > 16r10FFFF ifTrue: [^false].
  ^aCodePoint < 16rD800 or: [aCodePoint > 16rDFFF]
%
category: 'private-writing'
classmethod: McpJson
keyStringFor: aKey
  "The JSON object key for aKey. A CharacterCollection (String or Symbol) is its own key; anything
   else is printed, which is how a Dictionary keyed by the integer 7 renders with the key 7 as a
   JSON string."
  ^(aKey isKindOf: CharacterCollection) ifTrue: [aKey] ifFalse: [aKey printString]
%
category: 'constants'
classmethod: McpJson
maxDepth
  "How many containers may enclose a value, parsing or writing. A recursive-descent parser has no
   other defence against a body crafted to exhaust the Smalltalk stack, and the writer has none
   against a cyclic structure -- the kernel writer carries an AlmostOutOfStack handler for exactly
   that, which is a fault to catch rather than a limit to state. 64 is far past anything JSON-RPC or
   an MCP tool schema needs."
  ^64
%
category: 'parsing'
classmethod: McpJson
parse: aString
  "Parse aString -- ALREADY CHARACTERS, not wire bytes -- and answer the object. For a string
   gs-mcp itself produced (McpRouter>>applyConfig: parses its own config) and for tests. Anything
   arriving from a socket wants #parseWire:.
   Answers the same shapes kernel JsonParser did, so no caller downstream changes: object ->
   Dictionary with String keys, array -> Array, string -> String (DoubleByteString when it holds
   non-ASCII), integer -> Integer, real -> Float, true/false -> Boolean, null -> nil."
  | stream value |
  stream := ReadStream on: aString.
  value := self readValue: stream depth: 0.
  self skipWhitespace: stream.
  stream atEnd ifFalse: [
    self parseError: 'trailing content after the top-level JSON value'].
  ^value
%
category: 'private-parsing'
classmethod: McpJson
parseError: aString
  "Refuse the input. McpBase>>parseBody: turns any error into nil, which McpDispatcher renders as a
   -32700 Parse error, so the client-visible behaviour for bad input is what it always was."
  ^McpError signalKind: #parseError message: 'Malformed JSON: ' , aString
%
category: 'parsing'
classmethod: McpJson
parseWire: aByteString
  "Parse a request body straight off the socket: decode UTF-8 first, then parse. This is the entry
   McpBase>>parseBody: uses, and the decode is the fix for real clients -- they send raw UTF-8, not
   \u escapes, and without this every non-ASCII character became one Latin-1 character per byte.
   Decoding happens HERE, on a complete body, and never on a partial read: splitting a multi-byte
   sequence across two socket reads would corrupt it. McpHttpConnection assembles the whole body
   against Content-Length (in bytes, correctly, because nothing has decoded yet) before we see it."
  ^self parse: (self decodeUtf8: aByteString)
%
category: 'private-parsing'
classmethod: McpJson
peekOf: aStream is: aCharacter
  "Whether aStream is positioned at aCharacter, without consuming anything."
  ^aStream atEnd not and: [aStream peek = aCharacter]
%
category: 'private-parsing'
classmethod: McpJson
readArray: aStream depth: aDepth
  "Read a JSON array, positioned at its opening bracket."
  | elements |
  elements := OrderedCollection new.
  aStream next.
  self skipWhitespace: aStream.
  (self peekOf: aStream is: $]) ifTrue: [
    aStream next.
    ^Array new].
  [true] whileTrue: [
    elements add: (self readValue: aStream depth: aDepth + 1).
    self skipWhitespace: aStream.
    (self peekOf: aStream is: $,)
      ifTrue: [aStream next]
      ifFalse: [
        (self peekOf: aStream is: $]) ifFalse: [
          self parseError: 'expected , or ] in a JSON array'].
        aStream next.
        ^elements asArray]]
%
category: 'private-parsing'
classmethod: McpJson
readEscapeFrom: aStream onto: aWriteStream
  "Read one backslash escape, the backslash already consumed, and write what it denotes.
   The \u branch is the one kernel got wrong. A high surrogate followed by a low one is ONE
   character; an unpaired surrogate of either half is U+FFFD, never Character codePoint: -- which is
   what raised OutOfRange 2723 and turned every emoji into a 400."
  | escape codePoint low |
  aStream atEnd ifTrue: [self parseError: 'a JSON string ends inside an escape'].
  escape := aStream next.
  escape = $" ifTrue: [^aWriteStream nextPut: $"].
  escape = $\ ifTrue: [^aWriteStream nextPut: $\].
  escape = $/ ifTrue: [^aWriteStream nextPut: $/].
  escape = $b ifTrue: [^aWriteStream nextPut: (Character codePoint: 8)].
  escape = $f ifTrue: [^aWriteStream nextPut: (Character codePoint: 12)].
  escape = $n ifTrue: [^aWriteStream nextPut: (Character codePoint: 10)].
  escape = $r ifTrue: [^aWriteStream nextPut: (Character codePoint: 13)].
  escape = $t ifTrue: [^aWriteStream nextPut: (Character codePoint: 9)].
  escape = $u ifFalse: [
    self parseError: 'unknown escape in a JSON string: ' , (String with: escape)].
  codePoint := self readFourHexFrom: aStream.
  (codePoint >= 16rD800 and: [codePoint <= 16rDBFF]) ifTrue: [
    low := self readTrailingSurrogateFrom: aStream.
    low isNil ifTrue: [^aWriteStream nextPut: self replacementCharacter].
    ^aWriteStream nextPut: (Character codePoint:
      16r10000 + ((codePoint - 16rD800) bitShift: 10) + (low - 16rDC00))].
  (codePoint >= 16rDC00 and: [codePoint <= 16rDFFF]) ifTrue: [
    ^aWriteStream nextPut: self replacementCharacter].
  ^aWriteStream nextPut: (Character codePoint: codePoint)
%
category: 'private-parsing'
classmethod: McpJson
readFourHexFrom: aStream
  "The value of the four hex digits of a \u escape, the u already consumed."
  | value digit |
  value := 0.
  4 timesRepeat: [
    aStream atEnd ifTrue: [
      self parseError: 'a JSON \u escape needs four hex digits'].
    digit := self hexValueOf: aStream next.
    digit isNil ifTrue: [
      self parseError: 'a JSON \u escape needs four hex digits'].
    value := value * 16 + digit].
  ^value
%
category: 'private-parsing'
classmethod: McpJson
readLiteral: aTokenString value: anObject from: aStream
  "Read one of the three bare words and answer what it denotes."
  1 to: aTokenString size do: [:i |
    (aStream atEnd not and: [aStream next = (aTokenString at: i)]) ifFalse: [
      self parseError: 'expected ' , aTokenString]].
  ^anObject
%
category: 'private-parsing'
classmethod: McpJson
readNumber: aStream
  "Read a JSON number. The token is gathered loosely by #isNumberCharacter: and then checked against
   the JSON grammar by #isNumberToken: -- which is where the refusal happens, because the conversion
   truncates instead of complaining."
  | token character isReal |
  token := WriteStream on: String new.
  isReal := false.
  [aStream atEnd not and: [self isNumberCharacter: aStream peek]] whileTrue: [
    character := aStream next.
    (character = $. or: [character = $e or: [character = $E]]) ifTrue: [isReal := true].
    token nextPut: character].
  token contents isEmpty ifTrue: [self parseError: 'expected a JSON value'].
  (self isNumberToken: token contents) ifFalse: [
    self parseError: 'not a number: ' , token contents].
  ^[isReal
      ifTrue: [token contents asNumber asFloat]
      ifFalse: [token contents asInteger]]
    on: Error
    do: [:ex | self parseError: 'not a number: ' , token contents]
%
category: 'private-parsing'
classmethod: McpJson
readObject: aStream depth: aDepth
  "Read a JSON object, positioned at its opening brace. Duplicate keys: last one wins, which is what
   kernel did and what JSON-RPC never exercises."
  | result key |
  result := Dictionary new.
  aStream next.
  self skipWhitespace: aStream.
  (self peekOf: aStream is: $}) ifTrue: [
    aStream next.
    ^result].
  [true] whileTrue: [
    self skipWhitespace: aStream.
    (self peekOf: aStream is: $") ifFalse: [
      self parseError: 'expected a quoted key in a JSON object'].
    key := self readString: aStream.
    self skipWhitespace: aStream.
    (self peekOf: aStream is: $:) ifFalse: [
      self parseError: 'expected : after a JSON object key'].
    aStream next.
    result at: key put: (self readValue: aStream depth: aDepth + 1).
    self skipWhitespace: aStream.
    (self peekOf: aStream is: $,)
      ifTrue: [aStream next]
      ifFalse: [
        (self peekOf: aStream is: $}) ifFalse: [
          self parseError: 'expected , or } in a JSON object'].
        aStream next.
        ^result]]
%
category: 'private-parsing'
classmethod: McpJson
readString: aStream
  "Read a JSON string, positioned at its opening quote. Answers a byte String while the content is
   ASCII and a DoubleByteString once it is not -- see the Unicode7 trap in the class comment.
   A raw control character is REFUSED. Kernel accepted one; RFC 8259 requires it escaped, and
   accepting it hides a client that is corrupting its own payload."
  | out character |
  aStream next.
  out := WriteStream on: String new.
  [aStream atEnd ifTrue: [self parseError: 'unterminated JSON string'].
   character := aStream next.
   character = $"] whileFalse: [
    character = $\
      ifTrue: [self readEscapeFrom: aStream onto: out]
      ifFalse: [
        character codePoint < 32 ifTrue: [
          self parseError: 'unescaped control character in a JSON string'].
        out nextPut: character]].
  ^out contents
%
category: 'private-parsing'
classmethod: McpJson
readTrailingSurrogateFrom: aStream
  "The value of a \uDC00-\uDFFF escape immediately following a high surrogate, or nil -- leaving the
   stream exactly where it was -- when what follows is anything else. Answering nil rather than
   raising is what makes an unpaired high surrogate a U+FFFD instead of a failed request."
  | start value |
  start := aStream position.
  (aStream atEnd not and: [aStream next = $\]) ifFalse: [
    aStream position: start.
    ^nil].
  (aStream atEnd not and: [aStream next = $u]) ifFalse: [
    aStream position: start.
    ^nil].
  value := [self readFourHexFrom: aStream] on: McpError do: [:ex | ex return: nil].
  (value notNil and: [value >= 16rDC00 and: [value <= 16rDFFF]]) ifTrue: [^value].
  aStream position: start.
  ^nil
%
category: 'private-parsing'
classmethod: McpJson
readValue: aStream depth: aDepth
  "Read one JSON value. aDepth counts the containers enclosing it."
  | character |
  aDepth > self maxDepth ifTrue: [
    self parseError: 'nested deeper than ' , self maxDepth printString , ' levels'].
  self skipWhitespace: aStream.
  aStream atEnd ifTrue: [self parseError: 'unexpected end of input'].
  character := aStream peek.
  character = ${ ifTrue: [^self readObject: aStream depth: aDepth].
  character = $[ ifTrue: [^self readArray: aStream depth: aDepth].
  character = $" ifTrue: [^self readString: aStream].
  character = $t ifTrue: [^self readLiteral: 'true' value: true from: aStream].
  character = $f ifTrue: [^self readLiteral: 'false' value: false from: aStream].
  character = $n ifTrue: [^self readLiteral: 'null' value: nil from: aStream].
  ^self readNumber: aStream
%
category: 'constants'
classmethod: McpJson
replacementCharacter
  "U+FFFD, what a byte sequence we cannot honestly decode becomes."
  ^Character codePoint: 16rFFFD
%
category: 'private-parsing'
classmethod: McpJson
skipWhitespace: aStream
  "Consume the four characters JSON allows between tokens."
  | codePoint |
  [aStream atEnd] whileFalse: [
    codePoint := aStream peek codePoint.
    (codePoint = 32 or: [codePoint = 9 or: [codePoint = 10 or: [codePoint = 13]]])
      ifTrue: [aStream next]
      ifFalse: [^self]].
  ^self
%
category: 'writing'
classmethod: McpJson
write: anObject
  "Answer anObject rendered as JSON in a String holding ONLY bytes 0x20-0x7E. That is the wire
   contract -- see the class comment for the three things that depend on it."
  | out |
  out := WriteStream on: String new.
  self write: anObject on: out depth: 0.
  ^out contents
%
category: 'private-writing'
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
category: 'private-writing'
classmethod: McpJson
writeCharacter: aCharacter on: aStream
  "Render one character of a JSON string. 0x7F is escaped even though RFC 8259 permits it raw --
   the wire contract is 0x20-0x7E and nothing else, so Content-Length arithmetic stays honest."
  | codePoint |
  codePoint := aCharacter codePoint.
  codePoint = 34 ifTrue: [^aStream nextPutAll: '\"'].
  codePoint = 92 ifTrue: [^aStream nextPutAll: '\\'].
  codePoint = 8 ifTrue: [^aStream nextPutAll: '\b'].
  codePoint = 9 ifTrue: [^aStream nextPutAll: '\t'].
  codePoint = 10 ifTrue: [^aStream nextPutAll: '\n'].
  codePoint = 12 ifTrue: [^aStream nextPutAll: '\f'].
  codePoint = 13 ifTrue: [^aStream nextPutAll: '\r'].
  (codePoint >= 32 and: [codePoint <= 126]) ifTrue: [^aStream nextPut: aCharacter].
  ^self writeEscapedCodePoint: codePoint on: aStream
%
category: 'private-writing'
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
category: 'private-writing'
classmethod: McpJson
writeDictionary: aDictionary on: aStream depth: aDepth
  "Render a dictionary as a JSON object. KEY ORDER IS UNSPECIFIED -- a GemStone dictionary has no
   insertion order, and kernel's was arbitrary too. Nothing may depend on it; tests parse."
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
category: 'private-writing'
classmethod: McpJson
writeEscapedCodePoint: aCodePoint on: aStream
  "Write aCodePoint as one \uXXXX escape, or as a SURROGATE PAIR above U+FFFF -- the kernel defect
   this class exists for: it kept bits 12-15 and wrote U+1F600 as \uF600, and for some codepoints
   emitted a lone surrogate, which is not even well-formed JSON.
   A surrogate reaching us as a character (constructible on 3.6.2, where surrogates are legal
   Characters) becomes U+FFFD rather than an unpaired escape."
  | codePoint offset |
  codePoint := aCodePoint.
  (codePoint >= 16rD800 and: [codePoint <= 16rDFFF]) ifTrue: [codePoint := 16rFFFD].
  codePoint <= 16rFFFF ifTrue: [^self writeUnitEscape: codePoint on: aStream].
  offset := codePoint - 16r10000.
  self writeUnitEscape: 16rD800 + (offset bitShift: -10) on: aStream.
  ^self writeUnitEscape: 16rDC00 + (offset bitAnd: 16r3FF) on: aStream
%
category: 'private-writing'
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
category: 'private-writing'
classmethod: McpJson
writeString: aCharacterCollection on: aStream
  "Render a String, Symbol or DoubleByteString as a JSON string."
  aStream nextPut: $".
  1 to: aCharacterCollection size do: [:i |
    self writeCharacter: (aCharacterCollection at: i) on: aStream].
  ^aStream nextPut: $"
%
category: 'private-writing'
classmethod: McpJson
writeUnitEscape: aCodeUnit on: aStream
  "Write one \uXXXX escape, uppercase hex."
  | digits |
  digits := '0123456789ABCDEF'.
  aStream nextPutAll: '\u'.
  aStream nextPut: (digits at: 1 + ((aCodeUnit bitShift: -12) bitAnd: 16rF)).
  aStream nextPut: (digits at: 1 + ((aCodeUnit bitShift: -8) bitAnd: 16rF)).
  aStream nextPut: (digits at: 1 + ((aCodeUnit bitShift: -4) bitAnd: 16rF)).
  ^aStream nextPut: (digits at: 1 + (aCodeUnit bitAnd: 16rF))
%
! ------------------- Instance methods for McpJson
