# GemStone notes

Image and kernel behaviour that has cost this project real time. Everything here was measured on a
live image, not inferred from documentation, and most of it is invisible in the source — which is
what makes it worth writing down. Versions are named where behaviour differs.

Not a GemStone tutorial. For that, see [Where to look things up](#where-to-look-things-up).

## The silent failures

Read this section before your first file-in. Each of these loses work while reporting success.

**A `"` inside a method comment can drop the method.** Smalltalk comments are delimited by `"`, so a
literal double-quote inside a method comment ends the comment there and everything after is parsed
as code. The method ends up in the file, absent from the image, and topaz's `errorcount` still
answers **0** — so `install.sh` reports success. Escape by doubling (`""`), or rewrite the sentence
without the quotes. Class comments have the same trap for `'` (they are string literals), and that
one *does* fail loudly, with a cascade of `[1034] unexpected token` a long way from the real line.
**Do not trust `errorcount` alone after adding methods**; compare what the file defines against what
the image has.

**A merged `.gs` file can lose a method to a missing `%`.** See
[Development.md](Development.md#resolving-a-gs-conflict).

**Re-sending a class definition drops every method on the class.** `Object subclass: ...` /
`compile_class_definition` on an *existing* class — to add an instVar, say — dropped all previously
compiled methods, and the broken state got committed. When you must change a class's shape, plan to
re-file the whole class immediately afterwards and verify (`cls selectors`, `cls class selectors`,
instantiate it) before committing. Keeping each class's definition and methods in one `.gs` file and
re-`input`ing the whole file is the reliable route.

**A stale binding in an earlier dictionary silently wins at compile time.** The symbol list is
searched in order, so an old `Published.McpServer` shadows the new `Mcp.McpServer`: every method
filed in afterwards binds to the old class, and the install looks clean while being wrong. This is
why `install.sh` sweeps the names it is about to define out of every other dictionary first.

**A view refresh before a write launders a stale-write conflict.** GemStone's optimistic check is
write-write *against the view* and does not track what a session read. So if S1 reads X, S2 commits
a change to X, and S1 then refreshes (`continueTransaction` or `abortTransaction`) before writing X,
S1's commit **succeeds and silently erases S2's work** — where without the refresh it correctly
fails. Once X is in S1's write set a later refresh cannot launder it, so the dangerous shape is
exactly read → refresh → write. Never refresh a long-lived session's view on its behalf. This is
what [blind-write-guardrail.md](blind-write-guardrail.md) exists to cover.

## Transactions and conflicts

Conflict detection is **OOP-bitmap set intersection, not timestamps**. Objects carry no version or
commit time; only your view does. At commit the stone computes

```
readWriteConflicts  = (strongReadSet * writeSetUnion) - RcReadSet    "always fails the commit"
writeWriteConflicts = (writeSet * writeSetUnion)
```

where `writeSetUnion` is the union of the write sets of every transaction committed since your view.

**Compiling a method conflicts at CLASS granularity.** Two sessions compiling *different* selectors
on the *same* class conflict (`#retryFailure`); the conflicting objects are the class's
`GsMethodDictionary` and a per-class `SymbolSet`. Different classes never conflict. A recompile
installs a *new* `GsNMethod` and leaves the old one alone, so the `GsNMethod` is useless as a
conflict handle.

**`System continueTransaction`** gives a current view of others' commits while keeping this
session's uncommitted work. Measured on 3.7.5 and 3.7.6:

* normal dirty session: works, `needsCommit` stays true, the work survives
* not in a transaction: legal, plain refresh
* nested transaction (level 2): `ImproperOperation` **2717**
* after a commit failed on conflict: `TransactionError` **2409**, and **sticky** — it keeps raising
  on every later call until an `abortTransaction`

Do not predict those states from `System transactionConflicts at: #commitResult`:
`continueTransaction` itself sets it to `#readOnly`, so a session looks jammed from its first
successful refresh onward. Attempt the operation inside `on: Error do:` and report what the image
said. `System sessionCanCommit` is not the predicate either — it stayed true in every state,
including the jammed one.

**The StrongReadSet is real, and reachable from ordinary user code** — hidden set #38, deliberately
user-mutable:

```smalltalk
(GsBitmap newForHiddenSet: #StrongReadSet) add: anObject
```

If another session then commits a change to that object, your commit fails with `#retryFailure` and
a `#'Read-Write'` entry even though you never wrote it. It is cleared by `commitTransaction`
(success or failure) and by `abortTransaction`, but **not** by `continueTransaction` — clear it
yourself. A transaction with an empty write set still commits, so strong reads only bite when you
actually write something. The Programmer's Guide names `StrongReadSet` once, in a table, and never
mentions `GsBitmap` or hidden sets: treat as undocumented-but-real and re-verify per version.

Staging a conflict to test any of this needs two **real** sessions — topaz RPC `login` twice plus
`set session N`. A linked `topaz -l` refuses a second login (ERROR 2147).

## Gems, forks and external sessions

**A forked `GsProcess` only runs while its gem is actively executing Smalltalk.** A GCI-driven
session is parked in the C client between commands, so a background fork freezes the instant the
triggering call returns — measured: 0 increments over 3s of idle, 40 over 2s of active execution.
This is why the server cannot be a background fork in an interactive session: it must be the main,
blocking activity of a dedicated gem, where the accept loop itself keeps the scheduler alive.
Per-connection `fork` inside that gem is then fine.

**A blocking `executeString:` on an external session freezes *every* `GsProcess` in the calling
gem**, not just the caller — it blocks in C. Measured on 3.7.5: a 100ms ticker showed one
5.3-second gap across a 5-second remote call. The correct sequence is

```smalltalk
worker nbExecute: expr.
[worker isCallInProgress] whileTrue: [worker waitForResultForSeconds: 1 otherwise: [nil]].
^worker lastResult
```

and each part of it matters:

* `waitForResultForSeconds:otherwise:` already yields (it waits via `readWillNotBlockWithin:`,
  suspending only the calling `GsProcess`), so no `Delay` poll loop is needed, and it wakes as soon
  as the result arrives. It answers `self` on success, the block's value on timeout.
* **Read `lastResult`, not `nbResult`.** `isResultAvailable` and `waitForResultForSeconds:` *consume*
  the result internally; a later `nbResult` raises `GciError: no Nb call in progress`.
* **After a wait that times out, `lastResult` still holds the previous call's value** — in a request
  router, that means answering one request with another's response. Gate every read on
  `isCallInProgress`. A timed-out wait is resumable; the correct result still arrives.
* A second call while one is in flight raises loudly and does *not* corrupt the session. But a
  blocking call used to prevent overlap **by accident**, so going non-blocking needs an explicit
  per-session mutex, and anything that ran only because the gem was frozen can now run
  concurrently — an idle reaper can reap a session mid-call unless it checks.

**Never print or log a `GsTsExternalSession`.** `printOn:` sends `gemProcessId`/`stoneSessionId`,
each of which is `ivar ifNil: [ivar := self executeString: '...']` — a real blocking call into the
remote gem. What it does depends on invisible cache state:

| state of the session | `printString` does |
|---|---|
| idle, ids not yet fetched | **silently overwrites `lastResult`** with the gem's pid |
| call in flight, ids not fetched | **raises `GciError`** (nested call) |
| ids already cached | harmless |

Verified: `lastResult` was `111`; one `printString` made it `82692`. A debug line between the wait
and the read returns a pid where a response belongs. The mitigation this project ships is
`McpSession>>cacheWorkerIds` — send both accessors once right after `login`, while nothing is in
flight, which populates the ivars for the session's whole life and puts every later print in the
harmless row. It costs two round trips and they cannot be folded into one `executeString:`, because
it is the accessor *sends* that populate the ivars. The error path is safe (`GciError>>_describe`
reads the ivars directly rather than via `self`). Related: `stoneSessionSerial` raises
`ArgumentTypeError` (2094) on a fresh session, because it passes the bare, still-nil
`stoneSessionId`.

**To run something long-lived in a separate gem, use `forkAndDetachString:`, not `nbExecute:`.**
`nbExecute:` is the *attached* form whose contract is "must be followed by `nbResult`", which an
infinite loop can never satisfy. A detached child keeps running after the launcher logs out, and its
default wrapper logs child errors to the gem log. Capture the child's ids **before** launching
(`es stoneSessionId`, then `(System descriptionOfSession: sid) at: 2` for the host pid) — once the
non-blocking call is running the session rejects further queries. Stop it with `System stopSession:
sid` from any session, or `kill <pid>`; a `logout` does not, which is the point of detaching.

A `GsTsExternalSession` worker dies with the process owning its GCI connection — verified with both
SIGTERM and SIGKILL on the parent. So a leaked worker is bounded by the lifetime of the gem that
created it: a script that exits takes its gems with it, while repeated runs inside one long-lived
gem compound until the login ceiling.

**A gem forked by a NetLDI is configured through the NRS body, not through the session object.**
`GsTsExternalSession` has no configuration hook, and a forked gem gets whatever
`GEM_TEMPOBJ_CACHE_SIZE` and friends *its NetLDI's* environment hands out. That is not a constant to
rely on: the product default is **50MB** (`data/system.conf`), but a NetLDI started with a larger one
passes that on — measured 3.7.5, gems forked on one host got 488MB while a linked topaz on the same
host got 50MB. Starved, anything that compiles heavily dies with `VM temporary object memory is
full`, raised as a `GciError` out of a session whose gem has already gone, so it carries no result
and does not name memory. The lever is the NRS **body**, which *is* the `gemnetobject` command line:

```smalltalk
GsNetworkResourceString defaultGemNRSFromCurrent
  node: 'localhost';
  body: 'gemnetobject -C GEM_TEMPOBJ_CACHE_SIZE=900000;GEM_TEMPOBJ_CODE_SIZE=300000;';
  yourself
```

`gemnetobject` takes `-T <cacheKB>`, `-N <0|1|2>` (native code), `-e`/`-E` (a configuration file)
and `-C <params>`, where params are `NAME=value` separated by `;` **with no spaces** — a space ends
the argument and the rest is silently ignored, which applies half a budget and looks exactly like
applying none. So the budget travels with the login and needs no `gem.conf`, no
`GEMSTONE_EXE_CONF` and no NetLDI restart, none of which a gem answering a request can reach anyway.
**Naming a parameter this version does not have is safe**: for a gem (unlike `startstone`) a
configuration syntax error is not fatal — the parameter is ignored and its default applies; an
out-of-range value warns and clamps. Verified 3.7.5 by reading the value back in the child
(`System configurationAt: #GemTempObjCacheSize`): 50MB → 900MB, and a second `;`-separated parameter
arrives intact. Not every parameter has a runtime symbol to read back — `GEM_TEMPOBJ_CODE_SIZE` has
none, so `configurationAt:` answers nil for it whether or not it was set. `data/system.conf` in the
product tree is the authority on which exist, and it carries several the online appendix omits.
See also the System Administration Guide, *Command Reference → gemnetobject* and appendices A and C.

**Running *out* of temporary object memory is the benign failure. Running *nearly* out is the one
that lies.** A gem that exhausts its cache dies with `VM temporary object memory is full` and a
number to report. A gem that merely gets *close* keeps going and raises **`AlmostOutOfMemory`
(notification 6013)**, and because it is a notification it surfaces wherever the session happened to
be — under SUnit, against whichever test was running at the time. So a run that ends near its
ceiling reports red tests that are memory artifacts: a different, innocent test each run, only under
load, each one passing when run alone. There is no error to catch and nothing in the result that
says memory. Grail hit exactly this in its own CI and its `scripts/run_tests.sh` records both the
diagnosis and the numbers — a shard ending at **96%** of its cap failed intermittently, one ending
at **75%** passed — along with the lesson worth copying: *"that took a while to recognise precisely
because nothing reported the number."*

So report the number. Three private `System` selectors give it, all present on 3.7.5 and 3.7.6:

```smalltalk
System _tempObjSpaceUsed          "bytes in use"
System _tempObjSpaceMax           "bytes available"
System _tempObjSpacePercentUsed   "the kernel's own percentage"
```

Use the kernel's percentage rather than dividing `used` by `max`: it is the figure 6013 is raised
against, and the two need not agree. Note that `_tempObjSpaceMax` is **not** the configured
`GEM_TEMPOBJ_CACHE_SIZE` — it is the part left for objects after the code space and overhead come
out of it, so it reads a good deal smaller. Measured 3.7.5 on one host: a gem forked with
`GEM_TEMPOBJ_CACHE_SIZE=900000;GEM_TEMPOBJ_CODE_SIZE=300000;` reported `_tempObjSpaceMax` of 659MB,
the same host's default fork 366MB, and a linked topaz 36MB. Judge headroom as a percentage, never
against the number you asked for.

The corollary for anything that drives a lot of compilation in one forked gem: a bigger ceiling
raises what a session *may* hold and does nothing about what it *has* to hold. Both are needed —
Grail keeps the ceiling *and* partitions its corpus across eight sessions, and says so in as many
words. Bound the work per session as well as raising the ceiling.

**A `GciError` in the fatal band carries the gem's whole NRS in its message text — never show one to
a client.** `GciError>>_error:in:` (kernel source, `Filein3A/GciError.class.st`) ends with

```smalltalk
(originalNumber between: 4000 and: 4999) ifTrue: [
  messageText add: ' original number: ' , originalNumber asString,
    ' for session ' , externalSession _describe ]
```

and `_describe` yields the stone NRS, the GemStone **user name**, and the gem NRS — host, netldi and
the entire `gemnetobject` command line. Report `originalNumber` instead and leave the text in the gem
log. **4067** is a gem out of temporary object memory, **4100** an invalid session (what
`_error:in:` answers when there is no error buffer left to read a number from, i.e. the connection is
already closed). A `GciError` also **cannot be fabricated** for a test — it answers `instVarAt:put:`
with `structural updates disallowed`, and the only other route into the band sends `_describe` to a
real external session, which is itself forbidden here.

**`InterSessionSignal`**, if you reach for it: the Stone-to-session buffer holds exactly **50** and
the 51st raises `SignalBufferFull` (2254) — so nothing is lost silently, the *sender* is told, and
the 50 slots are shared by everyone signalling one target. Never send `#signal` to a polled
instance: it is `Exception>>signal` and *raises* rather than answering the integer (`gsArgs` raises
too; `sendingSession` is safe). `messageText` is prose with the payload after the literal
`'message: '`. And `System session` is a different number from `stoneSessionId` — `sendSignal:to:`
and `sendingSession` both live in the `System session` namespace.

**Naming a session is `System cacheName:`, and it is the only lever.** Every gem a
`GsTsExternalSession` creates is called **`GciTs`** — the front end, every worker, and any unrelated
external session on the stone, identical in the one column of `System cacheStatisticsForAllSlots`
that says who a session is. (An unnamed linked topaz is `TopazL`, an unnamed RPC gem `TopazR`.)
What is measured about it, identically on 3.7.2, 3.7.5 and 3.7.6:

* **The limit is 1 to 31 characters.** 31 is accepted; **32 raises `OutOfRange` (2061)** naming the
  range, and so does the **empty string** — 0 is not a legal length. So a name wants truncating, and
  an empty one dropping, rather than being allowed to fail a login.
* **It names only the current session.** There is no `cacheName:forSession:`, so a gem cannot be
  named by whoever started it — a name for a worker has to travel *into* the worker and be applied
  there.
* **`descriptionOfSession:` is not this and has no setter.** It carries the host pid, the view age
  and the client pid, but *not* the name. The name reads back through
  `cacheStatisticsForAllSlots` / `cacheStatisticsForSessionId:` (first field of the row) or
  `cacheStatisticsForProcessWithCacheName:`, which also means a **name is a lookup key**: a
  supervising process can find a gem by name instead of recording its pid somewhere.
* It is **not transactional** — no commit, and a suite that only renames its own session needs no
  `movesTheSessionView`. `System currentSessionNames` does *not* show it (session number and userId
  only).

What this project does with it: [README, Naming the gems](../README.md#naming-the-gems).

**A class-side method cannot declare a temp called `name`** — `| name |` there is `[1030] variable
has already been declared`, because `name` is an instance variable of `Class` and so already in
scope when `self` is a class. Loud, not silent, but the message does not say where the collision
comes from. The same goes for the other `Class` ivars.

## Sockets and TLS

`GsSocket>>acceptTimeoutMs:` returns **nil** on an idle timeout, but **`GsSecureSocket` overrides it
and raises** (`SecureSocketError: acceptTimeoutMs: failed`). So a poll loop written as
`client := listener acceptTimeoutMs: 500. client ifNotNil: [...]` works in plaintext and, the moment
TLS is enabled, dies on the first idle tick — the detached gem simply vanishes, because bind
succeeded and then the loop raised. Gate on readiness instead, which works identically for both:

```smalltalk
(listener readWillNotBlockWithin: 500) == true ifTrue: [client := listener accept ...]
```

Also confirmed:

* `accept` / `acceptTimeoutMs:` do the TCP accept and SSL init only, **not** the handshake. The
  handshake is a separate `secureAccept` / `secureAcceptTimeoutMs:errorOnTimeout:`, so accepting in
  the loop and handshaking in the per-connection process is the correct shape.
* `secureAcceptTimeoutMs: ms errorOnTimeout: false` answers `true`/`false` and raises only on a real
  error — good for bounding a handshake so a stalled or non-TLS client cannot wedge a handler.
* An **unencrypted** PEM key needs passphrase `nil`. Passing `''` raises
  `ArgumentError: expected a non-empty String`.

## Strings, JSON and Unicode

**Exception detail lives in `ex description`, not `messageText`.** `messageText` is frequently
**nil** (`ZeroDivide`, `MessageNotUnderstood`), and the error number, receiver class and missing
selector are in `description`. `'text' , ex messageText` *raises* when it is nil — especially
dangerous inside an error handler. Use
`([ex description] on: Error do: [:e | ex messageText ifNil: ['(error)']])`.

**`String>>includesString:` is case-insensitive.** Verified: `'abcDEF' includesString: 'cdef'` is
true. String `=` and collection `includes:` are case-sensitive. A `deny: (out includesString:
'FAIL')` therefore fails against the text `0 failed`, and a bare `'FAIL'` assertion passes only
weakly. For case-sensitive or negative substring checks, split on the line separator and use
`includes:`, or compare with `=` — and prefer asserting on a distinctive token.

**`asSha256String` is on `CharacterCollection`, not `String`**, and it works on 3.7.2.
`String includesSelector: #asSha256String` answers false because String only inherits it — that is
the trap. Use `canUnderstand:`, or just call it.

**`'1-2' asInteger` answers `1`.** GemStone's number conversions truncate at the first bad character
and report success, so they cannot be used to validate a token.

### String literals and Unicode

Topaz reads `Globals at: #StringConfiguration` **at login** and reconfigures itself, announcing it in
the banner (`sourcestringclass is now Unicode16`). On such an image every string literal in every
method filed in compiles as a **`Unicode7`**, not a byte `String`. This is **not** a version
difference — it is per-image, and in practice it is Grail that sets it. `install.sh` pins literals
with `set sourcestringclass String` after login, so the tree compiles the same way everywhere.

`#StringConfiguration` also drives the *other* half: set to `Unicode16` it has
`GsCurrentSession>>initialize` install unicode-aware `#=`/`#<`/`#>` for `String`, `MultiByteString`
and the `Unicode` classes alike. So the hostile pairing — Unicode strings plus a comparison that
raises — cannot arise within a session. On a **String**-configured image, comparing a `Unicode7` to
a `String` *raises* `ArgumentError: non-Unicode argument disallowed in Unicode comparison` rather
than answering false, in both directions. **`asString` is the stock answer**: it narrows the Unicode
family by content, and it answers the receiver itself for a `String`, so send it unconditionally —
no all-ASCII guard needed.

**The kernel JSON classes are Unicode-broken the same way on 3.6.2 through 3.7.6.** None of this is
this project's code, which is what makes it easy to misdiagnose as a transport bug:

1. `CharacterCollection>>printJsonOn:` escapes non-ASCII to `\uXXXX` — which is *why*
   `Content-Length: body size` is correct here — but for codepoints above U+FFFF it keeps only bits
   12–15 instead of emitting a surrogate pair. U+1F600 comes out mangled and the information is gone;
   it cannot be fixed downstream.
2. `JsonParser` has no surrogate-pair decoding, so a `😀` pair raises `OutOfRange` (2723)
   on 3.7.x — which surfaces as HTTP 400 / `-32700`. On 3.6.2 surrogate `Character`s are legal, so it
   silently yields two broken characters that round-trip *back out* correctly, which is worse: a
   round-trip test passes.
3. Kernel `JsonParser` leniencies: trailing junk ignored, duplicate keys last-wins, unknown escape
   silently swallowed (`{"a":"\x"}` → `''`), raw control characters accepted, `''` raises an MNU.

The decision here was to **inherit all of that and report it for a kernel fix** rather than carry a
codec: all three defects are about astral characters, and no user has hit one live. What the code
does keep is the UTF-8 decode, `JsonParser parse: aString decodeFromUTF8 asString`, because a
raw-UTF-8 body is the one defect a real client *does* hit — `£` arriving as two Latin-1 characters
and being written into the image that way. `decodeFromUTF8` **raises** on malformed input, naming the
byte offset, so a bad body is refused whole rather than silently corrupted; and it is a primitive,
~30× faster than a Smalltalk character loop. A full hand-written codec was built and then reverted;
it survives in this repository's history — `git show fb2559b:src/core/McpJson.gs` — so adopting it
again is a checkout, not a rewrite. See [utf8-wire.md](utf8-wire.md).

Two related surface facts: writing a `DoubleByteString` with `GsFile nextPutAll:` writes UTF-16, so
`encodeAsUTF8` first; and error text returned raw over GCI can render as spaced-out gibberish
(`E r r o r : …`) because it is a 16-bit string shown one byte per character. That is cosmetic.

## SUnit

**`GsTestCase` provides `should:raise:` and `shouldnt:raise:`** — check the framework before
concluding the codebase "doesn't use that pattern". Verified to have teeth: a non-raising block
signals `ResumableTestFailure`. `UserDefinedError` (what `self error:` signals) does inherit from
`Error`, so `raise: Error` is the right level to assert at.

**A helper whose selector collides with a framework selector silently breaks `suite run`.** A helper
named `run:` shadows `TestCase>>run: aResult`; `TestSuite>>run:` does `each run: result`, which then
calls the *helper* with the `TestResult` as its argument — so `runCase`/`setUp` never run, ivars are
nil, and the suite reports `0 run` as a false silent pass, or raises nil-DNUs. Meanwhile
`result runCase: each` works, because it sidesteps the shadowed selector, which makes it look
intermittent. Symptoms: `suite run` reports `0 run` while `suite tests size` is nonzero, or an ivar
set in `setUp` is nil only on the full-suite path. Diagnose with `find_implementors run:` — if your
test class is an implementor, that is the collision.

**A `test`-prefixed fixture accessor is silently run as a test.** `testSelectors` collects every
zero-argument selector beginning with `test`, so `testIssuer` "passes" while asserting nothing,
inflating both the pass count and the denominator. Audit with `cls testSelectors size` against the
tests you actually wrote.

**An end-to-end test that asserts only an HTTP status can pass for the wrong reason.** One
no-expiry-token test asserted 401 and passed — not because the resource-server layer rejected the
token, but because a *later* GemStone login failed for an unprovisioned fixture user. Assert the
specific layer's own verdict when a downstream failure could produce the same status.

**SUnit never moves your view on its own.** Across `GsTestCase`, `TestCase`, `TestSuite`,
`TestResult` and `TestAsserter`, exactly one framework method touches a transaction
(`GsTestCase>>abort`), and nothing calls it automatically — so every view movement in a run is the
repository's own code. Programming Guide ch. 21 (SUnit) says nothing about transactions and ch. 9
(Transactions) nothing about testing; there is no vendor guidance here.

**`TestResult` varies by SUnit version — do not call `printString` on one.** Its count methods send
`#shouldPass` to the result entries, and `failures`/`errors` return **Strings**, so it raises
`MessageNotUnderstood: a String does not understand #shouldPass`. Build summaries from
`runCount` / `passedCount` / `failureCount` / `errorCount`, none of which do that. On 3.6.2,
`failures` and `errors` return the *same* set (every non-passing test appears in both) and `runCount`
is inflated; `passedCount` is accurate.

**A pristine extent ships no vendor suite** — only SUnit's own 8 test classes / 38 tests. Any suite
worth thousands of tests comes from loaded code. So there is no "normal GemStone suite" to compare a
fresh stone against.

## JWT and OIDC

Only relevant to `src/auth`, which needs 3.7.5 or later for `JsonWebToken`, `JwtSecurityData` and
`GsTsExternalSession>>jwtPassword:`.

**`aud` must be a single string.** `UserProfile>>validateJwtPassword:` fails with
`Invalid or missing aud` when the token's `aud` claim is a JSON **array**, even when every element is
listed in the profile's `validAudiences`. That is narrower than RFC 7519, which permits an array, so
any IdP can trigger it. The check is `<primitive: 295>`, so it cannot be worked around from
Smalltalk — the IdP has to serialise `aud` as a plain string. On Keycloak it comes from the stock
`audience resolve` mapper on the `roles` client scope, which appends `account` alongside your own
audience mapper; delete that mapper so exactly one audience remains.

A 3.7.5 bug produces the **same message from a different cause**:
`JwtSecurityData>>validateAudiences` inspects `validIssuers` instead of `validAudiences`, so
`enableJwtAuthenticationWith:` accepts an empty audience set and every login then fails with
`Invalid or missing aud`. Rule out both.

Note also that the reason only surfaces via `ex description` — see
[Strings, JSON and Unicode](#strings-json-and-unicode).

**A failed discovery refresh is fatal to stone startup.** With `STN_OPENID_DISCOVERY_URLS` set, the
stone refreshes the IdP's discovery document and JWKS at boot and will not start if that fails. So a
stone that suddenly refuses to start is worth checking against the IdP before anything else. Two
related traps, both seen on 3.7.5 and 4.0.0: a JWKS containing a non-signature key is reported as
`Invalid JSON`, and a bare JWKS URL is rejected despite the documentation. A separate defect — a
SEGV on any discovery document over 4096 bytes, which is most real ones — has since been fixed
upstream.

## Selectors that do not exist here

Plausible-reading Pharo/Squeak selectors are the recurring trap, because they read as ordinary
Smalltalk. **Check `implementorsOf:` first.**

| you might reach for | GemStone has |
|---|---|
| `instVarNamed:` | a public accessor, or `instVarAt: <index>` (1-based, `allInstVarNames` order) |
| `includesBehavior:` | `inheritsFrom:` — strict, so test `cls == Super or: [cls inheritsFrom: Super]` |
| `openWriteOnServer:mode:` | `openWriteOnServer:` alone (truncate/create) |
| `String class>>new:withAll:` | `String new: n` (the former is absent from some extents) |

Both of the first two bit hard. `instVarNamed: #payload` sat at three live call sites in the auth
router, each wrapped in a broad `on: Error do:` that swallowed the DNU and degraded in a *different*
direction each time — a 401 "malformed token", a nil userId, and write scope denied. The lesson
beyond the selector: a broad `on: Error do: [:e | nil]` around a parse turns a programming error into
a misleading client-facing message. `includesBehavior:` in one type check turned every `McpServer
new` into a DNU and took 84 of 103 tests down at once.

## Dictionaries

Symbol-list order in a stock extent is `UserGlobals`, `Globals`, `Published`:

* **`Globals`** holds all the base/kernel classes. It is the only dictionary a "don't mutate kernel
  classes" guard should protect.
* **`UserGlobals`** is the default home for new user classes and the *most mutable* dictionary.
  Never protect it — that blocks exactly the classes a user most wants to edit.
* **`Published`** is the convention for developer-provided packages shipped as an addition to the
  core. It is not where typical users put work, and it may not be present in every image.

Only `Globals` and `UserGlobals` are guaranteed present. That is fine for a guard list — a name that
resolves to nil is skipped by the scan.

**`dictionaryAndSymbolOf:` matches by VALUE, so it is the wrong basis for a kernel-class check.**
`System myUserProfile dictionaryAndSymbolOf: aClass` answers the first symbol-list dictionary that
binds that object under **any** key — an alias in an earlier dictionary wins. This produced a real
security hole here: in a Grail image the `Python` dictionary binds kernel `Object` under an alias and
precedes `Globals`, so `Object` read as unprotected and the mutation tools would modify kernel
classes. Not theoretical — a suite run in that image compiled a probe method onto `Object` and
committed it. Ask the protected dictionary directly, by name *and* identity:

```smalltalk
(Globals at: aClass name asSymbol ifAbsent: [nil]) == aClass
```

**A `SymbolDictionary`'s name is the key inside it whose value is itself** —
`name` is literally `^self keyAtValue: self ifAbsent: [nil]`; there is no `name` instance variable.
So a dictionary **cannot share a name with a class it holds**: installing class `Foo` into a
dictionary named `Foo` overwrites the self-reference, the name goes to nil, and `inDictionary: Foo`
then resolves to the class. This is why the dictionary here is `Mcp` and not `McpServer`.

**Removing a class's binding *is* deleting it.** `ClassOrganizer new` is built from the current
session's symbol list, so an unbound class disappears from `allSubclassesOf:` and from
`TestCase subclasses` — no orphan suites linger after a dictionary move.

## Version-to-version differences

**3.6.2 vs 3.7.x**, each of which broke a test until handled:

* `JsonParser` is PetitParser-based and **returns a `PPFailure` instead of raising** on malformed
  input. `on: Error` alone is not enough — require the result to be a `Dictionary`.
* `TestResult` `failures`/`errors` overlap and `runCount` is inflated (see [SUnit](#sunit)).
* `fileOutClass` **omits the `removeallmethods` line** that 3.7.x emits. A test proving a full
  file-in should check for a method's source, not for that line.
* **No usable `GsTsExternalSession` on the macOS 3.6.2 install.** Creating any external session
  fails inside `GciTsLibrary class>>newForVersion:product:`, where `CHeader path:
  '$GEMSTONE/include/gcits.hf'` makes the Smalltalk `CPreprocessor` crash with `nil doesNotUnderstand:
  #key`. Not a missing file — both the header and the library are present; it is 3.6.2's own header
  parser choking on macOS. That blocks the detached front end **and** every per-client worker, so the
  wall is *creating a separate gem at all*, not fork/detach specifically. It is environmental, below
  our code: do not add a `respondsTo:` shim, since `GciTsLibrary` fails before the API choice matters.

**3.7.2** is missing three `GsTsExternalSession` selectors, each with an expansion that is
byte-identical on 3.7.5 (proven — the NRS strings compare equal):

* `newDefaultForGemHost: h` →
  `GsTsExternalSession newDefault gemNRS: (GsNetworkResourceString defaultGemNRSFromCurrent node: h; yourself); yourself`
  (`defaultGemNRSFromCurrentForHost:` is also missing, so the one class method cannot just be
  backported). Plain `newDefault` works but silently moves the gem to the machine's host name, so
  keep the explicit `node: 'localhost'`.
* `useOnetimePassword` →
  `onetimePassword: (GsCurrentSession currentSession createOnetimePasswordValidForSeconds: 300)`
* `jwtPassword:` — no equivalent, which is a second reason auth cannot run before 3.7.5.

**3.7.2 also silently corrupts external-session results** (kernel defect **#51438**, fixed in
3.7.4.1). It is a *Smalltalk* bug, not a C GCI bug, so it hits gem-to-gem sessions and not C
clients. `GsTsExternalSession>>resolveResult:` fetches an object's first 1024 bytes into a shared,
preallocated, per-session buffer that never shrinks, and then nests the *refetch of the full object*
inside the "is the buffer big enough?" test — conflating "big enough" with "already full". So:

| result size | what you get |
|---|---|
| ≤ 1024 | always correct |
| 1024 < n ≤ grown buffer | **exactly 1024 correct bytes**, the rest stale from a previous result |
| > grown buffer | correct again, and it re-grows the buffer, raising the corruption ceiling |

Right length, wrong content — so JSON fails as "Unterminated string", never as a short read. Sticky
for the session's life; a small result in between does not clear it; a fresh login does. 3.7.5 splits
the two conditions, which is the whole fix. The same shared-buffer aliasing breaks
`resolveResult:toLevel:` for Arrays on 3.7.2 (fixed separately as #51563), so returning an Array of
small chunks is **not** a workaround — repeated calls each returning ≤1024 bytes is.

Consequence for reading old results: a green 3.7.2 `test.sh` on an older commit is **not** evidence
of absence. It passed once only because a smaller class put the method being checked inside the good
first kilobyte.

**3.7.2's `System continueTransaction` is a weaker operation than 3.7.5's**, in two ways that
together are why this project stopped developing for 3.7.2. `(System class compiledMethodAt:
#continueTransaction) sourceString` is byte-identical on 3.7.2, 3.7.5 and 3.7.6, so the whole
difference lives in the `_zeroArgPrim: 9` stone primitive — below the image, where no `respondsTo:`
or other feature test can reach it. Both were measured with two **real** gems (topaz plus a
`GsTsExternalSession`) and reduce to a one-slot `Array`: no method dictionaries, no toolset, nothing
of this project's own involved.

**(1) A successful refresh does not rebase the conflict baseline.** S1 reads X; S2 commits a change
to X; S1 sends `continueTransaction`; S1 writes X; S1 commits:

| | 3.7.2 | 3.7.5 / 3.7.6 |
|---|---|---|
| `continueTransaction` answers | `true` | `true` |
| S1's view of X afterwards | S2's value | S2's value |
| S1's following commit | **`false`**, `#'Write-Write'` naming X | **`true`** |

The view moves on both. But on 3.7.2 the write-write intersection is still taken against the commit
record the transaction *started* at, so a write S1 has already adopted still counts as concurrent.
Substituting `abortTransaction` for the `continueTransaction` makes 3.7.2 behave exactly like 3.7.5,
which is what isolates this to the primitive rather than to anything about the objects written.

This is **not** read protection, and 3.7.2 is not the safer image for having it. Writing an object
the other session did not touch commits just as cleanly on 3.7.2 as on 3.7.5, so the laundering
described under [Transactions and conflicts](#transactions-and-conflicts) still happens there in
every case where the write lands somewhere other than the read — which is the shape
[blind-write-guardrail.md](blind-write-guardrail.md) exists to cover. 3.7.2 refuses only the
same-object case, and refuses it spuriously: the session had legitimately adopted the newer version
before writing. Fails `testTheStoneAloneWouldAllowThatClobber` — which is written to fail on good
news, and on 3.7.2 is reporting something that is not good news — and
`testRefreshAdoptsTheOtherVersionAsTheStartingPoint`.

**(2) A failed refresh does not record its failure.** More precisely, 3.7.2's `continueTransaction`
never writes `System transactionConflicts at: #commitResult` at all, in either direction:

| `#commitResult` after… | 3.7.2 | 3.7.5 / 3.7.6 |
|---|---|---|
| a fresh login | `#success` | `#success` |
| a **successful** `continueTransaction` | `#success` | `#readOnly` |
| a **failed** `continueTransaction` (S1 wrote X, S2 committed over it) | **`#success`** | **`#failure`** |

The `false` answer itself does arrive on both, so the tool layer still sees the refusal in the
moment; what 3.7.2 loses is the durable trace of it. `McpToolset class>>commitConflictPending` tests
for `#retryFailure or: [#failure]`, so on 3.7.2 it answers `false` for a session that is genuinely
stuck — view moved, pending writes doomed, no commit possible — and everything gated on it goes
quiet: `McpDispatcher>>transactionStateNote` emits no `[session]` line, and
`McpServer>>stuckViewReason` finds no reason to report. Fails
`testAFailedRefreshClearsTheWritesAndReChecksTheReads`,
`testAServerRefreshOfDoomedWorkSaysSoAndNamesWhatCollided` and
`testAClientWhoseWorkWasDoomedIsNotToldItsOwnCommitFailed`. Note that the reverse hazard the
`commitConflictPending` comment warns about — reading `not #success` and so calling a session jammed
from its first successful refresh onward — cannot occur on 3.7.2, because the `#readOnly` that
causes it is never set there either.

Consequence, and the reason to drop 3.7.2 rather than work around it: on 3.7.2 the server cannot see
a session that its own front-end maintenance refresh has doomed. That client is told nothing — no
`[session]` line, no named collision, no "abort is the only way out" — so the worst state the
session layer knows how to explain is exactly the one it goes silent for. Unlike #51438, which the
image can at least detect and cover from inside, there is nothing here to test for: the selector
exists on every version, answers a plausible Boolean, and differs only in the state it leaves
behind.

## Where to look things up

**The product tree ships the kernel in readable form** — grepping it beats a live-image round trip,
works with no stone up, and does not touch a session:

* `projects/gemstoneBaseImage/rowan/src/Filein*/<Class>.{class,extension}.st` — kernel class source
  *and* method comments (`System.extension.st` is the big one). `upgrade/bootstrap/Filein1A.gs` is
  the same content as a topaz file-in.
* `data/system.conf` — the fully annotated config template: every `STN_*`/`SHR_*`/`GEM_*` parameter
  with its default, min/max, runtime-equivalent symbol and prose. This is not in the image.
* `doc/errormessages.txt` (numbers, `#symbolicName`, text), `doc/hierarchy.txt`, `doc/man5/`, and
  `include/gcierr.ht` (the C-side error constants, with prose the Smalltalk docs omit).

**The manuals are online and fetchable, no login.** The narrative guides are *not* in the product
tree.

* Programming Guide: `https://downloads.gemtalksystems.com/docs/GemStone64/3.7.x/GS64-ProgGuide-3.7/MAIN.htm`
* Version index: `https://downloads.gemtalksystems.com/docs/GemStone64/3.7.x/` (swap in `3.6.x`,
  `4.0.x`, …)

Each guide is published as an HTML directory (`<name>/MAIN.htm`) and a sibling `<name>.pdf`. Under
3.7.x: `GS64-ProgGuide-3.7`, `GS64-SysAdminGuide-3.7`, `GS64-Topaz-3.7`, `GS64-GemBuilderC-3.7`,
plus version-stamped install guides and `GS64-ReleaseNotes-3.7.N`.

## Shell and tooling

**Topaz flags:** the script flag is `-S file` (or `-P file`) — `-i` means *ignore* `.topazini`, not
"input". And `-q` suppresses `printit` results, not just the banner, so never use it when you need
the output.

**Gem log timestamps are in the repository's `TimeZone`, in DD/MM/YYYY**, while GemStone's own banner
in the same file is UTC in MM/DD/YYYY and everything else on the host is ISO/UTC. So a
`grep "$(date +%m/%d/%Y)"` over a gem log **can never match** — wrong field order — and it fails
*silently*, reporting reassuring quiet during a storm. Use `%d/%m/%Y`, and grep both local dates when
a run crosses the UTC-offset boundary.

**macOS bash 3.2 and topaz heredocs.** The scripts feed Smalltalk to topaz via
`OUT="$("$TOPAZ" -l <<TPZ … TPZ)"`. On bash 3.2 the `$( … )` scanner treats `#` in the heredoc body
as a comment, so a body line that **starts with `(`** whose matching `)` sits after a `#symbol` gets
its `)` swallowed → unbalanced `(` → runtime error `bad substitution: no closing ')'`. It is a
runtime error, not a syntax error, so `bash -n` and a newer bash on PATH both pass and it only shows
when the script runs on 3.2. Keep `(` off the start of a body line — assign to a temp first. Mid-line
`(…)` with no `#` between the parens is fine. `run-unit-tests.sh` carries a note about this. Verify
script edits with the *system* `/bin/bash`.
