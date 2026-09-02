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

A *view window* opens whenever the view moves — at every commit, abort and refresh — and what
survives into the new window is decided by whether the repository validated the session's write set
on the way through.


## The ledgers

Two instance variables on `McpServer`. Every toolset already holds a `server` reference, so they
share one instance: no class-side state, no `SessionTemps`, and both are visible to a test that
builds a server by hand.

```
readLedger    Set of keys — what this session has seen in the current view window
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
| successful commit | yes | `:= writeLedger`, plus the widening below | cleared |
| failed commit | **no** (V) | kept | kept |
| abort | yes | cleared | cleared |
| `refresh` returning `true` | yes | `:= writeLedger`, plus the widening | kept |
| `refresh` returning `false` | yes (U) | cleared | cleared |

**`writeLedger ⊆ readLedger` holds in every row.** It is worth stating as an invariant because it
is the property the guardrail rests on: every write this session is holding was licensed by a read
that is still good.

**Successful commit and successful refresh are the same case.** Both mean the repository validated
this session's write set and found no conflict — so for everything in `writeLedger`, no other
session has committed a change to it since the view was taken, and the current view's version is
therefore the version the client read. That proof covers the write set and nothing else, so every
other read is dropped. It is the only thing either event proves, and it proves it equally.

**A failed commit does not move the view** (V). The other session's work stays invisible, so every
read in the window is still good and both ledgers are kept untouched. The transaction is doomed and
must be aborted, but that is a separate fact from whether the reads are stale — and they are not.

**A refresh that returns `false` moves the view anyway** (U), which is the one genuinely bad state
in the system: the reads are invalidated *and* the pending writes cannot commit. Both ledgers are
cleared. Clearing `writeLedger` is not a fiction — no licensed writes remain — and it keeps the
invariant unconditional. The conflicting class names are captured at that moment, while the ledger
still exists, for the message that tells the client to abort.

### The widening

On a successful validation the repository proved that no other session wrote the method
dictionaries in this session's write set. Those dictionaries are per class **and per side**, so the
proof reaches further than the write set itself: every *unwritten* method of a class this session
did write is also unchanged.

> If `writeLedger` holds any instance-side method of `Foo`, keep every instance-side method-grain
> `readLedger` entry for `Foo`. Separately and identically for `Foo class`.

So a client may read six methods of a class, change one, commit, and then change a second without
re-reading — soundly, because the commit proved the whole class untouched.

The widening stops at method grain. `Foo:shape` and `Foo:comment` live in different objects from the
method dictionary, so validating the dictionary proves nothing about them; they survive a view move
only by being in `writeLedger`.


## Where it is enforced

**One place: the top of each mutating tool.** A blind write is refused before anything happens, with
a structured `McpError` naming the exact call that would license it. There is no commit-time check —
the refresh rules above make `writeLedger ⊆ readLedger` true by construction, so a commit-time
re-check could never fire.

`writeLedger` is written **on the branch that actually performed the write**, never on entry to the
tool. This is load-bearing rather than fastidious, because `readLedger := writeLedger` turns every
ledger entry into a licence at the next commit: an entry recorded for something that was never
written would manufacture a licence the repository never validated. Re-compiling byte-identical
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
   session progressively unable to commit. That trade was declined; this is the cost.
2. **`execute_code` bypasses everything**, including by committing on its own.
3. **The grains differ.** The guardrail is per method; the repository's conflicts are per class. A
   commit can still be refused over a method the client never touched.


## Keeping the measurements honest

Two suites, deliberately different in kind. `McpBlindWriteTest` drives the ledger protocol directly
and pins the RULES. `McpConcurrentEditTest` stages genuine conflicts from a real second gem and pins
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
