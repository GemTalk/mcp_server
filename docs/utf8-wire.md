# The wire is UTF-8

Why gs-mcp writes UTF-8 rather than \u-escaped ASCII, what that cost in code owned, and what the
change turned up about the front end that had nothing to do with escapes. Companion to
[the kernel JSON Unicode report](../../docs/kernel-json-unicode.md), which measures the kernel
defects this design routes around and the two it does not.

Everything below was measured on GemStone 3.7.5 (gs64stone, Grail loaded, so
`#StringConfiguration` is `Unicode16`), with a real socket and a real worker gem wherever the claim
needs one. The measurements are collected in
[Appendix: what was measured](#appendix-what-was-measured); the body cites them by letter.


## The verdict

**UTF-8, but not for the reason it looks like.** The writer is not the saving: 79 code lines against
the escaping writer's 69. Escape arithmetic and UTF-8 arithmetic cost about the same [A].

The saving is that a UTF-8 design gets to **keep the kernel parser**. Escaping creates the
surrogate-pair problem in *both* directions, so an ASCII design has to replace a parser that is
otherwise fine. UTF-8 creates it in *neither*, so the inbound gap shrinks from a 230-line parser to
a 48-line escape transcode. That asymmetry is structural rather than stylistic, and it is the whole
argument.


## One emoji, three writers

U+1F600, grinning face, as it leaves the server:

| Writer | Wire bytes | Length | Result |
|---|---|---|---|
| kernel `Object>>asJson` | `5C 75 46 36 30 30` | 6 | **U+F600** — silently the wrong character |
| `McpJson`, ASCII escaping (`emoji-safe`) | `5C 75 44 38 33 44 5C 75 44 45 30 30` | 12 | correct |
| `McpJson`, UTF-8 (`utf8-wire`) | `F0 9F 98 80` | 4 | correct |

`CharacterCollection>>printJsonOn:` keeps only bits 12-15 of a codepoint above U+FFFF instead of
emitting a surrogate pair, so U+1F600 goes out as `"\uF600"` — U+F600, a Private Use Area
character, with no error raised anywhere. For U+1D800 it emits `"\uD800"`, a lone surrogate, which
is not well-formed JSON at all [B].

By the time `asJson` has answered, the codepoint is gone; no post-pass can recover it, which is why
this is the one kernel JSON defect an application cannot route around (report §7). Writing UTF-8
does not fix that arithmetic so much as never reach it: a surrogate pair is an artefact of `\u`
escapes and of UTF-16, and UTF-8 spells an astral codepoint directly in four bytes.


## What changed

Three commits on `utf8-wire`, each standing on its own.

1. **`Put UTF-8 on the wire instead of \u-escaped ASCII`** — new `McpJson class>>write:` replaces
   `Object>>asJson` at all thirteen production render sites and answers a byte `String` of UTF-8.
   Kernel `JsonParser` is kept inbound. Only what RFC 8259 §7 actually requires is escaped: the
   quote, the backslash, and the C0 controls.
2. **`Repair a surrogate-pair escape on the way in, too`** — `McpBase class>>combineSurrogateEscapesIn:`,
   so a client that escapes non-ASCII works as well as one that sends it raw. Its own commit
   because it is droppable: the defect it answers is the kernel's, and reporting rather than
   working around it remains a defensible choice.
3. **`Decode a forwarded body whatever class the worker compiled it as`** — a pre-existing bug, its
   own section below.


## The round trip, both client styles

Measured through a real socket, storing the character in a method comment with `compile_method` and
reading it back with `get_method_source` [C]:

| How the client encodes it | `dev` | `utf8-wire` |
|---|---|---|
| raw UTF-8 — `JSON.stringify`, and so most clients | corrupted to U+F600 | U+1F600 |
| escaped `\uD83D\uDE00` — Python's `json.dumps` default | `-32700` parse error | U+1F600 |
| U+1D800, the ill-formed case | lone surrogate on the wire | correct four bytes |

Every assertion in these suites is on **codepoints, never round-tripped text**. On 3.6.2 surrogates
are legal `Character`s, so the kernel's write and parse defects cancel and an emoji appears to
survive — as two characters no 3.7.x image will construct (report §6).


## The bug found on the way

The most consequential thing in this exploration, and it is not about escapes.

**On `dev`, any request body carrying a single non-ASCII byte is refused with `-32700`** — not just
an emoji, a `café` in a `compile_method` source — on any image whose `#StringConfiguration` is
`Unicode16`. That is every Grail image, including the one the live server runs on.

The front end parses a body only to classify it, then forwards the raw bytes to the worker gem
embedded in a Smalltalk expression via `printString`
(`McpSession>>workerExpressionFor:lifetimeBounds:`). So the worker never receives a byte string off
a socket — it receives a **compiled string literal**, and which class that is comes from the
*worker session's* `#StringConfiguration`, not from what the front end sent. Configured for
`Unicode16`, an all-ASCII literal compiles as a `Unicode7` and a literal carrying a byte above
`0x7F` compiles as a `Unicode16`.

`Unicode7` understands `decodeFromUTF8`. **`Unicode16` does not**, nor does `DoubleByteString` [D].
So the class that understands it is exactly the one that can never hold a byte needing decoding.
The `MessageNotUnderstood` was then caught by the catch-all whose job is to turn any parse failure
into one `-32700`, and reported to the client as malformed JSON:

```
PARSEDIAG entry class=Unicode16 size=151
PARSEDIAG raised MessageNotUnderstood: a Unicode16 does not understand #'decodeFromUTF8'
```

The fix is one send — `bytes := aString asString` before the decode. `asString` answers the
receiver for a byte `String`, so the common path costs nothing, and it narrows a `Unicode16` whose
codepoints are all below 256 — exactly what a `printString`'d byte string compiles to — back to the
byte `String` those bytes came from, codepoints intact. A genuinely wide string still cannot be
decoded and still becomes a `-32700`, which is correct: a wide string is not wire bytes.

### Why no test caught it

Every in-image test hands `parseBody:` a byte `String`, because that is what a socket delivers — so
they all exercised the one class that works. Only a real GCI hop re-compiles the body into whatever
the worker's configuration says a literal is, and the transport suite drives a mock socket.

The method's own comment stated the assumption that hid the bug — *"it follows that aString must be
a byte String … and a wide string would not understand #decodeFromUTF8 at all"* — correctly, as it
turns out, and without noticing that a wide string is exactly what arrives.

Two things cover it now. `McpUtf8Test>>testForwardedBodyDecodesWhateverClassTheWorkerCompiledItAs`
hands `parseBody:` the body in each class a literal can be — byte `String`, `Unicode16` with the
bytes as codepoints, and `Unicode7` for the all-ASCII case that always worked — and requires the
same answer from all three. And `test.sh` grew a Unicode section, over a real socket through a real
GCI hop, which is the only place either half of this can be seen.


## The accounting

Code gs-mcp owns forever, excluding comments and excluding test suites [A]:

| Component | Code | With comments |
|---|---:|---:|
| `McpJson` — UTF-8 writer | 79 | 250 |
| `combineSurrogateEscapesIn:` + `hexUnitIn:at:` | 48 | 92 |
| **UTF-8 design, total owned** | **127** | **342** |
| `McpJson` — ASCII parser + writer (`emoji-safe`) | 299 | 588 |
| — of which the writer half alone | 69 | — |
| **ASCII design, total owned** | **299** | **588** |
| **`dev` today — kernel only** | **0** | **0** |

Suites track the code rather than the design, so they are left out of both columns: `McpJsonTest`
is 336 lines against the ASCII codec's 390.

The `dev` row is the honest baseline. Adopting either design means owning JSON code that does not
exist there now, and no line count settles whether a defect nobody has reported is worth a
permanent maintenance surface.


## Weighing it

**Four things UTF-8 buys.**

- **It is the only design that can be right.** Astral output cannot be repaired downstream, so the
  choice is between owning a writer and shipping wrong characters.
- **The encoder has an oracle.** `McpJson class>>writeUtf8CodePoint:on:` must agree with the kernel
  primitive `String>>encodeAsUTF8`, checked over 1,148 codepoints including both sides of all three
  sequence-length boundaries [E]. Nothing in the kernel emits a *correct* astral escape, so an
  escaping writer's surrogate arithmetic has no second opinion available to it — it can only be
  checked against expectations written by the same hand that wrote the code.
- **One concept instead of two.** "The wire is UTF-8, the image is characters" describes both
  directions. The ASCII design needed a second, non-standard invariant — nothing above `0x7E` on
  the wire — that three unrelated mechanisms silently leaned on.
- **A smaller, readable wire.** An escape costs six bytes per non-ASCII character against UTF-8's
  two to four: twenty U+2603 go out as 62 bytes rather than 122 [F]. And the wire is legible in a
  packet capture or a log, which the escaped form is not.

**Three things it costs.**

- **127 lines not owned yesterday.** See the `dev` row above. This is the real trade.
- **The weaker invariant takes more words.** "Every byte below `0x80`" is one loop to assert. "A
  byte `String` whose `#size` is its byte count" is weaker and easier to satisfy, but harder to
  state and easier to let rot.
- **It makes *where you encode* load-bearing.** ASCII output is immune to byte/character confusion.
  UTF-8 output is not, and getting the placement wrong produces exactly the class of bug found on
  the inbound side.


## Why the writer encodes, and does not leave it to the socket

The most GemStone-idiomatic reading of "use UTF-8" — work in characters, send `encodeAsUTF8` at the
socket — would break gs-mcp.

`WriteStream on: String new` **widens** the moment a character above `0xFF` lands on it: to a
`QuadByteString` on a stock image, and to a `Unicode32` where `#StringConfiguration` is `Unicode16`
[G]. And a response leaves the worker gem across a byte-sized GCI result buffer long before it sees
a socket.

So `McpJson class>>writeCharacter:on:` converts to bytes before the stream sees them, and no
character above `0xFF` ever reaches it. Three unrelated mechanisms downstream read a response as
bytes:

- `McpHttpConnection` writes `Content-Length` as `body size`;
- the worker → front-end hop is measured in bytes by the kernel's result fetch, whose buffer is
  sized in bytes (see `McpExternalSessionTest`);
- `GS_MCP_TRACE` writes bodies to the gem log through `GsFile`, where a 16-bit string garbles.

A byte `String`'s `#size` *is* its byte count whatever the bytes are, so all three now hold by
construction — where under the ASCII policy they held only because nothing above `0x7E` was ever on
the wire. That is the difference between an invariant and a coincidence.


## Still live, still reported

Two kernel defects remain, both inbound, both needing a real parser rather than a writer: an escape
`JsonParser` does not recognize is **silently dropped** rather than refused, and trailing content,
duplicate keys and raw control characters are all accepted (report §3 and §4). Neither corrupts
stored text — the worst a client gets is one wrong value from a request its own encoder built
wrong.

The report gains one entry from this work, in the same family as its §5 trap:
`Unicode16>>decodeFromUTF8` should narrow and delegate, or signal something that names the problem,
rather than being a bare `MessageNotUnderstood` from a class that can perfectly well hold the bytes
in question.


## Appendix: what was measured

Everything on gs64stone (3.7.5, Darwin, Grail loaded) unless stated. 435 unit tests green;
`test.sh` 100/100 over the wire; all twelve touched classes byte-exact canonical file-out fixed
points.

**[A] Code owned.** Counted from the file-outs with method comments and topaz directives stripped:
`McpJson` on this branch, 79 code lines of 250; the `emoji-safe` codec, 299 of 588, its writer half
69; `combineSurrogateEscapesIn:` 33 and `hexUnitIn:at:` 15.

**[B] The kernel writer.** `(String with: (Character codePoint: 16r1F600)) asJson` answers
`"\uF600"`; codepoint 16r1D800 answers `"\uD800"`, a lone surrogate. Both asserted against, side
by side with `McpJson`, in `McpJsonTest>>testAstralCharacterSurvivesWhereTheKernelWriterCorruptsIt`,
so the comparison fails the day the kernel is fixed and can then be retired.

**[C] The round trip over a socket.** `test.sh`, Unicode section: raw UTF-8 in a `compile_method`
source, read back through `get_method_source`, asserting the emoji's four bytes are present and
that no `\uD83D` or `\u00E9` escape is; then an escaped surrogate pair through `describe_class`.

**[D] `decodeFromUTF8` coverage.** `Unicode7 canUnderstand: #decodeFromUTF8` → true;
`Unicode16` → false; `String` → true; `DoubleByteString` → false. The live failure was read out of
the worker's gem log with `parseBody:` temporarily instrumented, then confirmed causally: reverting
the single `asString` send in the image and restarting the front end makes a non-ASCII `initialize`
a `-32700` while an ASCII one succeeds; restoring it makes both succeed.

**[E] The encoder oracle.** `writeUtf8CodePoint:on:` compared against `encodeAsUTF8` for
`16r80`, `16r7FF`, `16r800`, `16rD7FF`, `16rE000`, `16rFFFF`, `16r10000`, `16r10FFFF` and a stride
of 977 across the whole range, surrogates excluded: 1,148 codepoints, zero disagreements.
`McpJsonTest>>testEncoderAgreesWithTheKernelPrimitive`.

**[F] Wire size.** Twenty U+2603: `asJson` 122 bytes, `McpJson write:` 62.
`McpJsonTest>>testUtf8IsSmallerOnTheWireThanEscaping`.

**[G] Stream widening.** `(WriteStream on: String new) nextPut: (Character codePoint: 16r1F600)`
answers a `QuadByteString` on a stock 3.7.6 image and a `Unicode32` on this one. `McpJson write:`
answers a byte `String` for ASCII, Latin-1, BMP and astral content alike, and for a wide input
string — `McpJsonTest>>testOutputIsAlwaysAByteString`.

**[H] The escape scan's fast path.** Over a 63KB body, `findString:startingAt:` is 0.05ms against
3.6ms for a Smalltalk character loop, and `decodeFromUTF8 asString` 0.6ms. That 70x is why
`combineSurrogateEscapesIn:` gates its scan behind one primitive search and answers the receiver
itself when there is no escape to find.
