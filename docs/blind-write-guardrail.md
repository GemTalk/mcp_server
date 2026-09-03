# The blind-write guardrail

Why a client may not replace a method it has not read, how that is enforced, and what the
repository's own guardrail does and does not do underneath it. Companion to
[Session lifetime](session-lifetime.md), which covers how long the transaction described here lives.

Everything below was measured on GemStone 3.7.5 with two real sessions. The measurements are
collected in [Appendix: what was measured](#appendix-what-was-measured); the rules in the body cite
them by letter.


## The failure

One client holds a view and edits two methods. Another client commits changes to both. The first
client's commit is refused — correctly. It aborts, re-reads `method1:`, adjusts, commits. Then it
applies the `method2:` change it had been carrying and commits that too:

```
0 baseline: method1 ^#baseline1 | method2 ^#baseline2
3 client1 first commit = false (#'retryFailure')     <- refused, nothing written
4 after abort client1 sees: method1 ^#client2 | method2 ^#client2
5 commit of method1 = true
6 commit of method2 = true (#'success')              <- accepted
7 FINAL: method1 ^#client1_adjusted | method2 ^#client1_v1
```

The second client's `method2:` is gone, with no error and no conflict. Step 6 is not a defect in the
repository: the abort at step 4 moved the client's view *past* the other session's commit, so by the
time it writes `method2:` there is genuinely nothing left to conflict with. What is wrong is that the
client wrote `method2:` from source it had read **before** the abort, and never looked at what the
abort had brought into view.

This is the whole problem, and it generalises past the abort: **any view move followed by a write
based on a pre-move read silently discards another session's work.** Commit, abort and `refresh` all
move the view.


## Why the repository does not catch it

GemStone's check is optimistic and it is about **writes**, not reads. At commit the stone intersects
OOP bitmaps — there are no timestamps and no per-object versions anywhere in the mechanism:

```
writeWriteConflicts = writeSet * writeSetUnion
```

`writeSetUnion` is the union of the write sets of every transaction committed since **your view**.
Only your view is dated; the objects are not. So the check answers one question — *did anyone change
something I am writing, since I last looked at the repository?* — and it answers it well. It has no
opinion about what you read, and none about how long ago you read it.

Two consequences shape everything below.

**The grain is the class, not the method** (E, I, J). Compiling a method writes the class's
`GsMethodDictionary` and a per-class `SymbolSet`, so two sessions editing *different* selectors on
one class still conflict, while two sessions editing different classes never do — not even when each
introduces a brand-new symbol. The guardrail here works at method grain, but it sits on a
repository whose conflicts are per class, and a client can still be refused a commit over a method
it never touched.

**A view move launders a stale read, but never a stale write** (M, N). Once an object is in your
write set the conflict follows it through any number of refreshes and the commit is still refused.
An object you have only *read* has no such protection: the refresh absorbs the other session's
change, and afterwards nothing in the repository remembers that you never saw it.


## Why this never needed to exist before

A human editing a method opens it in a browser first. The browser renders the method from the
current view, and only then can anything be typed into it. `readLedger ⊇ writeLedger` was an
invariant enforced by the user interface, for free, in every Smalltalk browser ever written — so
the repository never had to check it.

An agent is the first client that can write a method it has never displayed. It edits from its
memory of a view that has since moved. The guardrail restores by rule what the browser used to
guarantee by construction.


## The rule

> **A mutating tool may not touch a method, class or dictionary that has not been read in the
> current view window.**

A *view window* opens whenever the view moves — at every commit, abort and refresh — and a read
survives into the new window exactly when what it read is still there ([re-validation](#re-validation)).


## The ledgers

Two instance variables on `McpServer`. Every toolset already holds a `server` reference, so they
share one instance: no class-side state, no `SessionTemps`, and both are visible to a test that
builds a server by hand.

```
readLedger    Dictionary, key → stamp — what this session has seen in the current view window,
              and a digest of what it saw
writeLedger   Set of keys — what this session has changed and not yet committed
```

Keys come at four grains:

| grain | key | example |
|---|---|---|
| method | `Class>>selector` | `McpToolset>>toolNames`, `McpToolset class>>dictNamed:` |
| class shape | `Class:shape` | `McpToolset:shape` |
| class comment | `Class:comment` | `McpToolset:comment` |
| dictionary | `#Dictionary` | `#UserGlobals` |

Nothing here touches `GsBitmap`, hidden sets, or any repository state. The stone's own guardrail is
left exactly as it ships.

### The stamp

A read is recorded together with a **stamp** of what was read: the SHA-256 of the subject's
canonical text as the current view has it (`String>>asSha256String`, in the kernel since 3.7.5), or a
fixed marker for a subject that does not exist. `McpServer>>stampFor:` dispatches on the key's shape
to one method per grain, so what counts as the content of each kind of subject is stated once:

| key | text that is hashed | method |
|---|---|---|
| `Foo>>bar:`, `Foo class>>bar:` | the installed method's source, as `sourceCodeAt:` answers it | `stampForMethodKey:` |
| `Foo:shape` | the definition message, `Foo definition` | `stampForShapeKey:` |
| `Foo:comment` | the class comment | `stampForCommentKey:` |
| `#D` | the entries as `list_dictionary_entries` shows them — each key and whether it binds a class or a global, sorted. The **values are not hashed**: that tool shows none of them, and `remove_dictionary`, the write this licenses, destroys the bindings rather than the objects | `stampForDictionaryKey:` |

`requireRead:` never looks at a stamp; membership is the whole test, exactly as before. The stamp
exists for one moment, the [re-validation](#re-validation) every view move performs, and a write
records the stamp of the content *as written* — what the session now knows.

### What registers a read

| tool | registers |
|---|---|
| `get_method_source(Foo, bar:)` | `Foo>>bar:` |
| `get_class_definition(Foo)` | `Foo:shape` |
| `describe_class(Foo)` | `Foo:shape`, `Foo:comment` |
| `export_class_source(Foo)` | `Foo:shape`, `Foo:comment`, and every selector |
| `list_dictionary_entries(D)` | `#D` |
| everything else | nothing |

The split is per tool, not per toolset: it is *does this call name one subject and show its current
contents?* `list_classes(D)` names a dictionary but shows only the classes in it — a partial view,
not enough to license destroying it. `list_methods` and `get_class_hierarchy` show names, not
sources. The search tools are exploratory and register nothing, deliberately.

`describe_class` gains the class comment in its output as part of this work; it did not show it
before. `get_class_definition` deliberately does **not** — it returns the canonical
`subclass:instVarNames:…` message, which is what a client round-trips a definition through, and
padding it would break that. That is why the class grain is split in two: `get_class_definition`
licenses a redefinition but not a comment replacement.

### What a mutation requires

| tool | requires in readLedger |
|---|---|
| `compile_method(Foo, bar:)` | `Foo>>bar:` |
| `delete_method(Foo, bar:)` | `Foo>>bar:` |
| `compile_class_definition(Foo)`, `recompileMethods` true | `Foo:shape` |
| `compile_class_definition(Foo)`, `recompileMethods` false | `Foo:shape` + every current selector |
| `delete_class(Foo)` | `Foo:shape` + every current selector |
| `set_class_comment(Foo)` | `Foo:comment` |
| `remove_dictionary(D)` | `#D` |
| `add_dictionary(D)` | nothing |

**Creation is never blind.** If the selector, class or dictionary does not exist in the current view
there was nothing to read, so the write is allowed. A concurrent creation by another session
collides on write-write in the ordinary way. `set_class_comment` counts a class with no comment yet
as creation for the same reason.

**A write implies a read.** `noteWrite:` records into both ledgers. Having just written something is
knowing its content -- better than having read it -- so it licenses a follow-up change without a
re-read: creating a dictionary licenses removing it, compiling a method licenses recompiling it.
Nothing is put at risk, because another session's change to the same thing is still caught by the
stone. It also makes `writeLedger` a subset of `readLedger` true at every instant rather than only
across a view move.

**How `compile_method` knows which method it is about to replace.** The tool takes source, not a
selector, so the guardrail has to name the method before it can decide -- and without any side
effect, since a refused call must leave the image untouched. `McpToolset>>selectorOfSource:for:`
asks the kernel's own compiler, using the `intoMethodDict:` variant against a throwaway dictionary:
it answers the real `GsNMethod`, and so the authoritative selector for unary, binary and keyword
patterns alike, while leaving the class's selectors unchanged and `needsCommit` false (X).

**Why the two `compile_class_definition` rows differ.** A shape-changing redefinition produces a new
class with no methods at all, leaving the old class object holding them (T). With `recompileMethods`
true — the default — `McpMutationToolset>>recompileMethodsFrom:into:named:` carries them over by
reading `sourceCodeAt:` from the old class **as resolved in the current view**, so what lands on the
new class is other sessions' latest work, not anything the client remembered. Nothing blind happens
and `Foo:shape` is the honest requirement. With `recompileMethods` false the methods are dropped
outright, including ones the client has never seen, so it must have seen all of them.
`delete_class` destroys the same work and carries the same requirement.


## What survives a view move

| event | view moves? | readLedger | writeLedger |
|---|---|---|---|
| successful commit | yes | re-validated by stamp (below) | cleared |
| failed commit | **no** (V) | kept | kept |
| abort | yes | re-validated by stamp (below) | cleared |
| `refresh` returning `true` | yes | re-validated by stamp (below) | kept |
| `refresh` returning `false` | yes (U) | re-validated by stamp (below) | cleared |

**`writeLedger ⊆ readLedger` holds in every row.** It is worth stating as an invariant because it
is the property the guardrail rests on: every write this session is holding was licensed by a read
that is still good.

**Every move treats the reads the same way.** Commit, abort and `refresh` in either outcome all
re-validate the whole read ledger by stamp — there is one transition for the reads, and the stone's
verdict does not enter into it. What the verdict decides is the *write* ledger: a successful commit
empties it (those changes are everyone's now), a `true` refresh keeps it (still pending, still
licensed), an abort or a `false` refresh clears it (nothing pending can ever commit). This session's
own writes survive the re-check without a special rule: their stamps were recorded as written, a
successful commit means nobody else changed them, and a `true` refresh leaves the uncommitted text
in place. So the invariant reads, precisely: **a key is licensed exactly when the current text is
what this session read or wrote.**

**A failed commit does not move the view** (V). The other session's work stays invisible, so every
read in the window is still good and both ledgers are kept untouched. The transaction is doomed and
must be aborted, but that is a separate fact from whether the reads are stale — and they are not.

**A refresh that returns `false` moves the view anyway** (U), which is the one genuinely bad state
in the system: the view has moved under the reads *and* the pending writes cannot commit.
`writeLedger` is cleared — not a fiction, no licensed writes remain, and it keeps the invariant
unconditional — and the reads are re-validated exactly as after an abort. The conflicting class
names are captured first, while the write ledger still exists, for the message that tells the client
to abort. One measured nuance: the session's *own* uncommitted writes stay in place across a false
refresh, so a read of something this session wrote still matches its stamp and survives the refresh;
the abort that is the only way out re-checks it again, finds the other session's version, and drops
it then. Nothing can be committed in between, so nothing is at risk.

### Re-validation

Until 2026-09-02 the read ledger's fate at a view move was decided by rule. A successful commit or
`true` refresh kept the write set plus *the widening* — the unwritten methods of any class this
session had written, proven unchanged because the stone validates at the grain of a method
dictionary, one per class per side — and dropped every other read unexamined. An abort or a `false`
refresh dropped everything, on the argument that nothing this session saw was *known* to survive.
That made an abort after browsing twenty methods cost twenty re-reads even when nobody else had
committed a thing, and a commit cost the re-read of every class but the ones written.

A read is a statement about content — *`Foo>>bar:` says this* — and moving the view does not make
it false; another session having committed a different `Foo>>bar:` does. So at every move,
`McpServer>>revalidateReadLedger` recomputes each key's stamp in the new view and compares. Equal,
and the read is as true now as when it was made: it keeps its licence. Different, and it is dropped
and remembered in `staleReadKeys`. The result of the call that moved the view — the commit, the
abort, or the refresh — then carries one more `[session]` line, once:

```
[session] The view moved: 2 of 7 earlier reads are stale and must be re-read before writing to them: Foo>>bar:, Baz:shape.
```

The line is `McpDispatcher>>staleReadNote`, appended after the transaction-state line and consuming
the keys as it reports them, so it appears on exactly one result. The count is the point: it tells
the client the other five reads still stand, so it re-reads two subjects instead of all seven or —
worse — discovers each stale one as a refusal. The names are summarised by class rather than listed
(`McpServer class>>staleReadSummaryFor:`), so the line stays one line whatever was browsed: up to
three methods of a class are named in full (`Foo>>bar:, Foo class>>baz:`), more are counted
(`5 methods from Foo`), the class's definition and comment appear as `Foo (definition)` and
`Foo (comment)`, a dictionary as `UserGlobals (dictionary)`; and past four classes the whole list
gives way to `changes to 7 classes; re-check what you depend on before writing`.

**The contract, from the client's side.** Anything read in this session stays licensed until a
`[session]` note says it is stale. A refused mutation (`kind = blindWrite`) is the backstop for the
subject a client never read or whose note it skimmed past, and it names the one call that licenses
the write. Clients need not know the ledger exists: read what you are about to change, act on the
notes, and the guardrail is invisible. The server promises nothing beyond those two signals — in
particular it does not forecast what a move would or would not keep.

Both old rules are subsumed. A proof that the content did not change is weaker than looking at it,
and looking treats every grain alike — the widening stopped at method grain because a class's shape
and comment live outside its method dictionary, and that boundary no longer matters.

Three consequences worth knowing:

- **A byte-identical recompile by another session leaves the read good.** The stamp is of the text,
  not the method object (P installs a new `GsNMethod` for the same source). What the client read *is*
  what is there, so nothing it writes on that basis discards anything.
- **An aborted write needs a fresh read**, even when nobody else touched the subject. The write
  recorded the stamp of the content as written; the abort restored the previous content; the stamp
  no longer matches. The client's last knowledge of that method is a version that no longer exists,
  and it is told so.
- **A `false` refresh leaves this session's own uncommitted writes in place** (measured), so a read
  of something this session wrote still matches and survives the refresh; the abort that is the only
  way out re-checks it again, finds the other session's version, and drops it then. Nothing can be
  committed in between, so nothing is at risk.

**Cost.** Re-validation is one `sourceCodeAt:` (or `definition`, `comment`, or entry list) and one
SHA-256 per ledger entry per view move — tens of microseconds each, so a ledger of a few hundred
reads costs milliseconds against a commit that costs more. If a session's ledger ever grows to where
this shows, the fallback is a lazy check in `requireRead:` — re-stamp the one key being written,
against a recorded view generation — at the price of the one-time note, which can only be produced
by checking everything.


## Where it is enforced

**One place: the top of each mutating tool.** A blind write is refused before anything happens, with
a structured `McpError` naming the exact call that would license it. There is no commit-time check —
the refresh rules above make `writeLedger ⊆ readLedger` true by construction, so a commit-time
re-check could never fire.

`writeLedger` is written **on the branch that actually performed the write**, never on entry to the
tool. This is load-bearing rather than fastidious: a write ledger entry is also a read ledger entry,
so an entry recorded for something that was never written would license a change to it on the
strength of nothing shown to the client, and `conflictingSubjects` decodes the stone's conflict
report through the write ledger, so a phantom entry could misname a conflict. Re-compiling byte-identical
method source does dirty the session and does install a new method object (P, R), so
`compile_method` always records. Re-evaluating an identical *class definition* is a true no-op —
same class object, `needsCommit` still false (S) — so that branch must not.

When a commit does fail, the conflicting objects are named rather than counted:
`System transactionConflicts` returns the objects themselves, and matching them by identity against
`persistentMethodDictForEnv:` for the classes in `writeLedger` turns a `GsMethodDictionary` back
into a class name the client can act on.


## execute_code, and the tool that was secretly the same thing

`execute_code` is outside the guardrail and its description says so. This is not an oversight that
can be closed: it evaluates arbitrary Smalltalk, so any check on what it compiles is walked around
with `perform:`, and it can call `System commitTransaction` itself, bypassing the `commit` tool
entirely. There is also no way to observe what it wrote. `System needsCommit` only flips on the
first write of a transaction, so it reports the case that does not matter and misses the case that
does; `PomWriteSet` is empty until the commit flush; and `_enableTraceNewPomObjs` traces objects
only after they are committed. The commit result reports how many `execute_code` calls happened in
the window, which is the most that can be said without inventing precision.

A deployment that needs a hard guarantee **composes the toolset out** — `McpExecutionToolset` is
resolved per session like any other, the same mechanism read-only mode uses.

That guarantee was until now hollow, because `compile_class_definition` took a source string and
did `source evaluate`, checking only afterwards that the result was a `Behavior` — by which point
any side effect had already happened. It was `execute_code` with a return-type assertion. It now
takes **structured arguments** (`className`, `superclassName`, `instVarNames`, `classVars`,
`classInstVars`, `poolDictionaries`, `dictionary`, `options`, `recompileMethods`) and builds the
definition itself, so it cannot evaluate anything. The string parser that recovered the class name
from the source goes with it.


## Known limits

1. **Cross-class staleness is not caught.** Read `Foo>>a`, write `Bar>>b` on the strength of it,
   and another session's change to `Foo>>a` will not stop the commit. The repository validates
   `Bar` only, and the guardrail only asks whether `Bar>>b` was read. GemStone does have a
   mechanism that would close this — the `StrongReadSet`, an ordinary-user-writable hidden set
   whose members fail a commit when another session has changed them — but using it means arming
   the repository's conflict check with every class a session browses, which makes a long-browsing
   session progressively unable to commit. That trade was declined; this is the cost. Re-validation
   softens it: the commit's own result names `Foo>>a` as stale, so the client learns of it — but
   after the write, not instead of it.
2. **`execute_code` bypasses everything**, including by committing on its own.
3. **The grains differ.** The guardrail is per method; the repository's conflicts are per class. A
   commit can still be refused over a method the client never touched.


## Keeping the measurements honest

Two suites, deliberately different in kind. `McpBlindWriteTest` drives the ledger protocol directly
and pins the RULES — for re-validation, with the kernel standing in for the other session by
recompiling the fixture in the same gem, since the rule is *the content moved* and not where the new
content came from. `McpConcurrentEditTest` stages genuine conflicts from a real second gem and pins
that the rules still match the DATABASE -- because every rule here was derived from something
measured below, and a suite that never touches the stone cannot notice if a measurement stops
holding. A kernel change that made a failed commit move the view, or made a refresh stop laundering
a stale read, would leave the first suite green and the guardrail wrong.

One of those tests is written to fail on good news: `testTheStoneAloneWouldAllowThatClobber` asserts
that with the guardrail bypassed, GemStone still accepts the commit that discards the other
session's work. If it ever starts failing, the stone has grown protection of its own and this
design's scope should be revisited.

Both suites commit, so both declare `movesTheSessionView` and the `run_test_class` tool refuses them
from a session holding uncommitted work.

## Appendix: what was measured

GemStone 3.7.5, `gs64stoneNoGrail`, two live sessions (a linked `topaz -l` driving a
`GsTsExternalSession` as the second client).

| | what was tested | result |
|---|---|---|
| E | two sessions compile *different* selectors on one class | conflict; the objects are the class's `GsMethodDictionary` and a per-class `SymbolSet` |
| I, J | two sessions compile methods on *different* classes, incl. each introducing a new symbol | no conflict |
| M | read → write → other session commits → refresh → commit | `continueTransaction` `false`, commit `false`; a write already in the write set cannot be laundered |
| N | read → other session commits → refresh → write → commit | commit **succeeds**, other session's work gone; a stale *read* is laundered |
| P | recompile byte-identical method source | `needsCommit` false → true, and a **new** `GsNMethod` is installed |
| R | identical recompile vs. another session's edit to a sibling method | still conflicts — the identical compile really is in the write set |
| S | re-evaluate an identical class definition | **same** class object, `needsCommit` stays false, selectors intact — a true no-op |
| T | shape-changing redefinition | **new** class object with **no** selectors; old class object keeps its methods |
| U | `continueTransaction` returning `false` | the view **advances anyway**; the following commit still fails |
| V | commit failing on conflict | the view does **not** advance; `needsCommit` stays true; `commitResult` `#retryFailure` |
| W | `commitResult` after a `false` `continueTransaction` | `#failure`, **not** `#retryFailure` — so `McpToolset class>>commitConflictPending` does not currently detect this state; widened as part of this work |
