---
marp: true
theme: default
paginate: true
header: 'mcp_server — GemStone developers'
style: |
  section { font-size: 24px; }
  section.lead { display: flex; flex-direction: column; justify-content: center; }
  section.lead h1 { font-size: 46px; margin-bottom: .2em; }
  section.demo { background: #16211f; color: #eef3f1; }
  section.demo h1 { color: #fff; }
  section.demo strong { color: #f4b199; }
  section.demo code { background: rgba(255,255,255,.09); }
  section.demo pre { background: rgba(255,255,255,.06); color: #eef3f1; }
  section.demo pre code { background: none; color: inherit; }
  h1 { font-size: 34px; line-height: 1.15; }
  table { font-size: 19px; }
  pre, code { font-size: 19px; }
  blockquote { border-left: 5px solid #b4451f; padding-left: .7em; font-style: normal; }
  .fine { font-size: 18px; color: #4a5560; }
  .verbatim { column-count: 2; column-gap: 30px; font-size: 15px; line-height: 1.45; }
  .verbatim p { margin: 0 0 .75em; }
  .cap { color: #b4451f; font-weight: 600; }
  .ex { font-family: ui-monospace, monospace; font-size: 15px; line-height: 1.45;
        border-left: 3px solid #ccd6da; padding-left: .7em; margin: 0 0 .55em; }
  .exlbl { font-size: 13px; letter-spacing: .06em; text-transform: uppercase;
           color: #4a5560; margin: 0 0 .12em; }
---

<!--
TWO VERTICAL SLICES so far, in running order: section 7 (fourteen slides) then section 8 (ten).
Sections 0-6 and 9-13 are not cut yet. Slice 2's own header comment is beside its first slide.

Source of truth for the argument and the notes is docs/Presentation.md; each slice is derived from
the matching section of it. Where the two disagree THIS FILE IS RIGHT and the outline should be
brought into line with it, which is how both slices were reconciled.

SLICE 1 — section 7. Re-cut 2026-09-10 to the running order below; it diverged from the outline on
purpose:

  * the measured seven-line trace is now speaker notes on the agent diagram, not a slide;
  * "why this never needed to exist before" is dissolved into the agent diagram, whose closing
    blockquote it now is;
  * the four-way refresh measurement is now speaker notes on "one pass", not a slide;
  * two new slides: the human-in-a-browser diagram (the guard working), and "one pass" — the
    design that makes every tool succeed by making commit meaningless.

Rendering, either way from this one file. --html IS REQUIRED, not optional: Marp Core defaults
html:false and STRIPS raw HTML, which would silently drop all four inline <svg> diagrams and every
<span class="fine"> / .verbatim / .ex block. Front matter cannot turn it on (it is a CLI/config-level
setting); use the flag, or html:true in a .marprc.yml beside the file.
  marp --html --pdf --allow-local-files docs/slides/deck.md
  marp --html --pdf --pdf-notes --allow-local-files docs/slides/deck.md   # notes as PDF annotations
  marp --html -s docs/slides/                                             # watch + serve while editing
Add --no-stdin if you ever run these from a script or a non-interactive shell: without a TTY on
stdin, marp waits on the stream instead of converting the file it was given, and simply hangs.

NEVER PUT A BLANK LINE INSIDE AN <svg> BLOCK. A blank line ends the HTML block as far as the
markdown parser is concerned, so everything after it in the same element is re-parsed as markdown:
the <path> elements vanish, and every <text> after the blank line is emitted as ordinary flow text,
centred and stacked, spilling off the bottom of the slide. It looks like a broken stylesheet rather
than a parse error, and nothing warns. All four diagrams had this and all four were silently wrong
until rendered (found 2026-09-10). Group the elements with comments or indentation, never blanks.

The deck renders to PPTX (marp --pptx) but WITHOUT the speaker notes -- the notesSlide parts
contain only the slide number. PDF via --pdf-notes is the only export that carries them.
Beamer note: pandoc discards HTML comments on the way to LaTeX. Notes are plain paragraph text
with no Marp-specific syntax inside, so a comment -> \note{} conversion is mechanical.

The `style:` block is deliberately minimal and is the thing to replace when the visuals get
dressed up. Nothing in the content depends on it.

Budget: 11:10 at the plans in docs/Presentation.md's demo inventory — 490s of slides plus a
180s demo. Slide 5 carries 90 of those seconds and is the one to protect.
-->

<!-- _class: lead -->

# The transaction model, and the blind-write guardrail

### A browser invariant, restored by rule

<br>

**§7** · the second of the two sections that do not survive being read afterwards

<!--
Where we are: sections 4 and 5 followed one request in and one request out. This section and the
next are the two that are actually about GemStone rather than about HTTP.

The shape of this section, said up front so nobody waits for it: two pictures, then the design
that looked like the obvious fix and was not, then the mechanism. The mechanism is the least
interesting part. The reason it has to exist is the interesting part.

Eleven minutes including the demo. If we run long, the demo is the part to protect.
-->

---

## Everything the model is told, in full

<div class="verbatim">

<p>This server is one GemStone session, in one long-running database transaction, for as long as the connection lasts.</p>

<p><span class="cap">YOUR VIEW IS A SNAPSHOT.</span> You see the repository as it was at one instant. It moves when YOU move it -- `commit`, `abort` and `refresh` each take a current view -- and in one other case: if it falls far behind, so that it is holding the repository's commit records open, the server refreshes it for you. That happens only BETWEEN your calls, it keeps your uncommitted changes, and it tells you on your next result. Either way, anything you read before the last view move may since have been changed by somebody else.</p>

<p><span class="cap">THE DATABASE PROTECTS YOU FROM ACTING ON A STALE SNAPSHOT.</span> If you change something that another session has committed a change to since your view was taken, your `commit` FAILS and writes nothing -- it will not silently overwrite their work. This is why the snapshot is worth having, and it is also why a `refresh` in the middle of a plan is not free: refreshing adopts their version as your starting point, so a change you then make on the strength of what you read EARLIER will commit cleanly and erase what they did. If you read something, thought about it, and are only now acting, re-read it first.</p>

<p><span class="cap">WHAT SURVIVES A CALL.</span> Every change you make stays in your session until you commit or abort it -- so you can compile a method, run its tests against what you just compiled, and only then decide to keep it. Nobody else can see any of it until you commit.</p>

<p><span class="cap">NOTHING COMMITS FOR YOU.</span> Only the `commit` tool commits. The tools that change the image (compile_method, compile_class_definition, delete_class, delete_method, set_class_comment, add_dictionary, remove_dictionary) leave their work uncommitted. `abort` discards everything uncommitted; `refresh` takes a current view and keeps your uncommitted changes.</p>

<p><span class="cap">THE [session] LINE.</span> A result may end with one line starting "[session]". It describes your session, not the tool you just called, and it appears only when there is something to do:<br>
&nbsp;&nbsp;- uncommitted changes pending -> commit them or abort them. The line names what would end this session first and how long that is; if it ends, they are lost. Commit anything you want to keep rather than leaving it staged.<br>
&nbsp;&nbsp;- your last commit FAILED, or the server refreshed your view and your pending changes now CONFLICT -> either way another session has changed the same objects, nothing of yours was written, and your changes are still here but no commit can succeed until you call `abort`, which discards them. Save anything you need, abort, re-read the current state, and redo the change against it. The line says which of the two happened.<br>
&nbsp;&nbsp;- the server refreshed your view -> your snapshot moved, and your uncommitted changes were kept. Re-read anything you are about to act on: only what you read through a tool is tracked, so the line can name what it knows went stale and no more.</p>

<p>A failed commit is the one failure here you cannot retry your way out of, and the conflict is reported per CLASS rather than per method -- two sessions compiling different methods on one class still collide. If the work matters, save the source before aborting.</p>

</div>

<!--
This is the whole of `McpServer class>>defaultServerInstructions`, sent in the initialize result.
551 words. It is on one slide because the fact that it FITS on one slide is part of the point —
and because I want to walk the five capitalised headings rather than paraphrase them.

Be honest about the slide: the body is a prop. The back row can read the orange headings and
nothing else, and that is fine, because the headings are the argument.

Point at, in order:
  * "one long-running database transaction, for as long as the connection lasts" — this is the
    sentence that makes a session a gem rather than a request handler.
  * SNAPSHOT: "and in one other case" — that clause is section 8, view hygiene, and it was added
    the day the server started moving a client's view for it.
  * PROTECTS YOU: this is the paragraph the rest of the section is the argument for. Note what it
    tells the model to do: "If you read something, thought about it, and are only now acting,
    RE-READ IT FIRST." That instruction exists because the failure two slides from now is real.
  * NOTHING COMMITS FOR YOU: says out loud that the mutation tools leave work uncommitted. Six
    weeks ago every one of them committed inside its own call, which is slide 6.
  * THE [session] LINE: the terse line the next slide shows. Unintelligible without this paragraph,
    which is most of why the instructions exist at all.

MCP calls `instructions` a hint to the model rather than documentation for a person, so what goes
in it is what a model cannot get from tool descriptions read one at a time: what a session IS
here, and which of its properties outlive a call. Kept short because it is prepended to the
model's context for the whole conversation, so every sentence competes with the client's own
prompt for attention.

If asked: a read-only session is sent none of this. Telling a session that cannot write how to
commit would be a page about tools it does not have.
-->

---

## What that line actually looks like

<p class="exlbl">uncommitted work pending</p>
<p class="ex">[session] You have uncommitted changes. No tool commits for you: call commit to persist them or abort to discard them. They are lost if this session ends first.</p>

<p class="exlbl">the client's own commit was refused</p>
<p class="ex">[session] Your last commit FAILED: another session changed the same objects since your view was taken (Write-Write(2)). Nothing was written. Your changes are still here but cannot be committed and your view cannot move until you call abort, which discards them -- save anything you need first, then abort, re-read, and redo it.</p>

<p class="exlbl">the server moved the view, and the pending work is now doomed</p>
<p class="ex">[session] The server refreshed your view -- it had fallen far enough behind to be holding the repository's commit records open -- and your uncommitted changes now CONFLICT with work another session has committed: it changed McpFixtureA. They cannot be committed, and abort is the only way out [...]</p>

<p class="exlbl">the view moved, and some reads no longer hold</p>
<p class="ex">[session] The view moved: 2 of 7 earlier reads are stale and must be re-read before writing to them: Foo>>bar:, Baz:shape.</p>

**Computed from the state left *after* the tool ran** — not the state the call arrived in.

<!--
Four of the five shapes; the fifth is a nested transaction, which just says commit and abort
cannot reach the outer one.

Read the second and third aloud one after the other, because the difference between them is the
detail I would defend hardest. Same jam — view moved, pending work un-committable, abort the only
way out — but two different causes, and the client must not be told the wrong one. "Your last
commit FAILED" is right only when a commit is what failed. Where the SERVER's own refresh doomed
the work, the client made no commit at all and would go looking for one it never made.

Why "after the tool ran": the note describes the state the client is actually left in. That is
what lets `abort` clear a pending conflict and answer "Transaction aborted." with no contradicting
warning stapled to it — while abort itself stays two lines that know nothing about any of this.
Annotating from the pre-call state would need every transaction tool to suppress a note the
dispatcher had already decided to add.

Appended by `annotateContent:` to BOTH the success and the error envelope, because a tool that
raised is exactly when dirty state most needs reporting. `structuredContent` is deliberately not
touched: the error kind and message stay what the tool raised, so a client branching on the kind
is unaffected by prose meant for the model.

`Write-Write(2)` is the stone's own conflict category and a count — deliberately not the conflict
dictionary's printString, which holds the conflicting OBJECTS and can be enormous.
-->

---

## A human at a browser. The stone's guard works

<div style="text-align:center">
<svg viewBox="0 0 940 300" width="880" role="img" aria-label="Timeline. Session one aborts, taking a view. Session two then commits a change to X. Session one then edits X and commits, and the commit is refused, because session one's view was taken before session two committed.">
  <defs>
    <marker id="a1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="currentColor"/>
    </marker>
  </defs>
  <text x="8" y="72" font-size="17" font-weight="600" fill="currentColor">S1</text>
  <text x="8" y="212" font-size="17" font-weight="600" fill="currentColor">S2</text>
  <line x1="46" y1="66" x2="900" y2="66" stroke="currentColor" stroke-width="1.5" marker-end="url(#a1)"/>
  <line x1="46" y1="206" x2="900" y2="206" stroke="currentColor" stroke-width="1.5" marker-end="url(#a1)"/>
  <line x1="140" y1="30" x2="140" y2="250" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 5" opacity=".5"/>
  <circle cx="140" cy="66" r="6" fill="currentColor"/>
  <text x="140" y="46" font-size="16" text-anchor="middle" fill="currentColor">abort</text>
  <text x="140" y="276" font-size="14" text-anchor="middle" fill="currentColor" opacity=".62">S1&#8217;s view moves here</text>
  <circle cx="330" cy="206" r="6" fill="currentColor"/>
  <text x="330" y="240" font-size="16" text-anchor="middle" fill="currentColor">commit X&#8242;</text>
  <circle cx="560" cy="66" r="6" fill="currentColor"/>
  <text x="560" y="46" font-size="16" text-anchor="middle" fill="currentColor">edit X</text>
  <circle cx="810" cy="66" r="6" fill="#2e6a4f"/>
  <text x="810" y="46" font-size="16" text-anchor="middle" font-weight="600" fill="#2e6a4f">commit &#10007;</text>
  <text x="810" y="94" font-size="14" text-anchor="middle" fill="#2e6a4f">refused, nothing written</text>
</svg>
</div>

**S2 commits *after* S1's view — so it is still in `writeSetUnion`.** X is in both write sets, and
the stone refuses. Nothing is lost, and S1 is told.

<!--
This is the case the repository was designed for, and it works perfectly. Spend a moment on it,
because the next slide is the same picture with one thing changed and the contrast is the whole
argument.

One mark for "edit X", and it is the same mark as every other event on the line. That is the
whole picture: for a human at a browser, editing a method IS one event. The browser renders the
method from the current view, you type into what it rendered, and you accept. There is no gap.
Say that in those words and do not decompose it — the audience has not yet been shown that an edit
can come apart, and the next slide is where it does. Coming at it from the other direction spoils
the reveal and makes this slide look like a setup rather than the case that works.

So when S1 commits, its write set holds X, the union of everything committed since S1's view holds
X because S2 got there first, the bitmaps intersect, and the commit is refused — retryFailure. S1
gets an error, aborts, sees S2's version, redoes the work against it. Exactly what an optimistic
scheme promises.

Note where the dashed line is: S1 took its view BEFORE S2 committed. Everything S2 did is invisible
to S1 and still counts as concurrent. That position is the only thing that changes on the next
slide.

If asked about the grain: the object in the write set is the class's GsMethodDictionary and a
per-class SymbolSet, so this refusal also fires when S1 and S2 edit DIFFERENT selectors on the same
class. Coarse, and coarse in the safe direction.
-->

---

## An agent. The same guard, walked past

<div style="text-align:center">
<svg viewBox="0 0 940 300" width="880" role="img" aria-label="Timeline. Session one reads X. Session two commits a change to X. Session one aborts, so its view jumps past that commit. Session one then writes X from the pre-abort read and commits successfully, silently discarding session two's work.">
  <defs>
    <marker id="a2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="currentColor"/>
    </marker>
  </defs>
  <text x="8" y="72" font-size="17" font-weight="600" fill="currentColor">S1</text>
  <text x="8" y="212" font-size="17" font-weight="600" fill="currentColor">S2</text>
  <line x1="46" y1="66" x2="900" y2="66" stroke="currentColor" stroke-width="1.5" marker-end="url(#a2)"/>
  <line x1="46" y1="206" x2="900" y2="206" stroke="currentColor" stroke-width="1.5" marker-end="url(#a2)"/>
  <circle cx="140" cy="66" r="6" fill="currentColor"/>
  <text x="140" y="46" font-size="16" text-anchor="middle" fill="currentColor">read X</text>
  <circle cx="330" cy="206" r="6" fill="currentColor"/>
  <text x="330" y="240" font-size="16" text-anchor="middle" fill="currentColor">commit X&#8242;</text>
  <line x1="470" y1="30" x2="470" y2="250" stroke="#b4451f" stroke-width="1.6" stroke-dasharray="6 5"/>
  <circle cx="470" cy="66" r="6" fill="#b4451f"/>
  <text x="470" y="46" font-size="16" text-anchor="middle" font-weight="600" fill="#b4451f">abort</text>
  <text x="470" y="276" font-size="14" text-anchor="middle" fill="#b4451f">S1&#8217;s view moves here</text>
  <circle cx="640" cy="66" r="6" fill="currentColor"/>
  <text x="640" y="46" font-size="16" text-anchor="middle" fill="currentColor">write X</text>
  <text x="640" y="94" font-size="13.5" text-anchor="middle" fill="currentColor" opacity=".62">from the pre-abort read</text>
  <circle cx="810" cy="66" r="6" fill="#b4451f"/>
  <text x="810" y="46" font-size="16" text-anchor="middle" font-weight="600" fill="#b4451f">commit &#10003;</text>
  <text x="810" y="94" font-size="14" text-anchor="middle" fill="#b4451f">X&#8242; gone, silently</text>
</svg>
</div>

> `readLedger ⊇ writeLedger` was an invariant enforced by the **user interface**, for free, in
> every Smalltalk browser ever written — so the repository never had to check it.

<!--
One thing changed: `edit X` split into `read X` and `write X`, and something moved the view in
between. Now S2's commit is BEHIND the dashed line — S1's view already contains it — so at commit
time the bitmaps do not intersect. The stone accepts, and it is right to: as far as it can tell,
S1 saw S2's change and chose to overwrite it. S1 saw nothing of the kind.

Slow down here. This is the frame that makes everything after it obvious, and it is the one idea
in the talk that is about this audience's history rather than about my code.

Forty years of Smalltalk tooling maintained that invariant without anyone having to name it,
because reads and writes went through the same window. You could not compile a method you had not
rendered. The optimistic write-write check was sufficient PRECISELY BECAUSE the UI had already
guaranteed the read side. Nobody had to write it down, and nobody had to check it, because the
architecture of every browser made it true.

An MCP client breaks that coupling for the first time. It reads with one tool call, thinks for
thirty seconds or three minutes — possibly while asking a human — and writes with another. There
is no window, and nothing in the protocol says the two calls saw the same view. An agent is the
first client that can write a method it has never displayed.

So the guardrail later in this section is not new protection. It restores by rule what the browser
used to guarantee by construction. If anyone thinks the right home for it is lower down — in the
kernel, so that every client gets it — that is the closing question of the talk and I would rather
hear it now than at the end.

THE MEASUREMENT BEHIND THE PICTURE. GemStone 3.7.5, two real sessions (a linked topaz driving a
GsTsExternalSession), two methods on one class:

  0 baseline: method1 ^#baseline1 | method2 ^#baseline2
  3 client1 first commit = false (#'retryFailure')     <- refused, nothing written
  4 after abort client1 sees: method1 ^#client2 | method2 ^#client2
  5 commit of method1 = true
  6 commit of method2 = true (#'success')              <- accepted
  7 FINAL: method1 ^#client1_adjusted | method2 ^#client1_v1

Client 2's method2 is gone, with no error and no conflict. Note that client 1 did everything a
careful client should: its first commit was refused, it aborted, it re-read, it adjusted. Then it
applied the OTHER change it had been carrying — the one whose read predated the abort — and that is
the one that clobbered. Every measurement in this section is from that rig, collected by letter as
an appendix in docs/blind-write-guardrail.md.

And say the generalisation, because both pictures make it look like a story about abort: commit,
abort and refresh all move the view. All three open this hole.

If asked why the final commit is not refused: by then S1's write set and the union of everything
committed since S1's view no longer intersect, because S1's view is newer than S2's commit. The
check is exactly right about the question it is asked.
-->

---

## So make every tool self-contained: abort, write, commit — in one pass

If each tool takes a **fresh view** on the way in and **commits** on the way out, no tool can ever
fail on a stale view. Tools that always work. It is the obvious thing to build, and I built it.

`McpDispatcher>>handleToolsCall:id:` ran `System abortTransaction` before invoking **every** tool —
and each mutation tool committed inside its own call.

**Including the `commit` tool.**

```
execute_code   UserGlobals at: #McpCommitProbe put: 'probe-...'   -> written
commit                                                           -> "Transaction committed."
execute_code   read it back                                       -> GONE
```

<!--
Pause after "including the commit tool" and let them get there first.

The pre-call abort applied to every tool with no exemption — including the three whose whole job is
to manage the transaction. So `tool_commit` aborted the transaction and then committed the empty
one it was left with. And `commitTransaction` answers TRUE, because committing nothing succeeds. So
the tool reported "Transaction committed." A client was told its work was safe when nothing had
been written.

A commit that can never fail. Which is achieved by never committing anything.

`refresh` had the same bug in miniature: it and `abort` were literally the same two lines, so
`refresh` discarded the caller's work while reporting "View refreshed."

Why it went unnoticed for so long, and this is the interesting part: the mutation tools each
committed INSIDE their own call, so the tools everybody actually used never depended on the
transaction outliving the call. compile_method worked. delete_class worked. The two-step workflow —
make changes, look at them, then commit — did not exist at all, and nothing in the tool surface
made that visible.

How it was found: while trying to demonstrate something else entirely. A canary value planted in a
worker gem to test session lifetime vanished — and so did a control planted and read back three
seconds later in a live session with no reap in between. Two lessons I would keep. A canary meant
to prove something about lifetime must first be shown to survive a null interval. And when an
experiment produces a clean expected result, THAT is the moment to check the instrument: the first
canary vanished exactly on schedule, which is what made it convincing and wrong.

Then the deeper problem, which is the link back to the last slide: a blanket pre-call refresh makes
every write a blind write BY CONSTRUCTION. Measured four ways, one shared object, two sessions,
S1 reading before S2 commits over it:
  * no refresh at all               -> commit false, retryFailure. S2's value survives.
  * continueTransaction first       -> commit true. S2's work silently gone.
  * abortTransaction first          -> commit true. Identical.
  * S1 writes first, refresh after  -> commit false. S2's value survives.
Rows two and three say the hole was as old as the blanket refresh, not introduced when I replaced
abort with continueTransaction in August. Row four says the protection is not lost wholesale: once
you have written the object, a later refresh does not launder it. It is the READ that goes
unprotected — the dangerous half, because the read is what the plan was built on.

Both designs were checked carefully — does it destroy work, does it raise, does it pin pages — and
both were checked against the wrong question. Never "what does this tell the STONE about this
session?" A two-session test that nobody had written would have answered it in a minute.

What shipped 2026-08-28: handleToolsCall: no longer refreshes at all. A session sees one snapshot
until the client itself asks for another, and `refresh` is documented as not free.
-->

---

## Why the repository does not catch it — and is right not to

At commit the stone intersects OOP bitmaps:

```smalltalk
writeWriteConflicts = writeSet * writeSetUnion
```

**No timestamps. No per-object versions. Only your *view* is dated; the objects are not.**

So it answers one question, and answers it well: *did anyone change something I am **writing**,
since I last looked at the repository?* It has no opinion about what you **read**, and none about
how long ago you read it.

<!--
This is the slide where I am telling this room something it already knows, so the point of it is
the last sentence rather than the formula.

`writeSetUnion` is the union of the write sets of every transaction committed since your view.
Because only the view carries a date, the mechanism cannot express a question about reads even in
principle — there is nothing on a read to compare.

I want to be explicit that this is not a defect I am working around. It is an optimistic check
doing what an optimistic check does. And the alternative is available: the StrongReadSet, hidden
set 38, deliberately ordinary-user-writable. Add a browsed object to it and your commit fails when
another session changes it, with a Read-Write entry, even though you never wrote it. Try that on a
long-browsing session and the session becomes progressively unable to commit anything at all. I
declined that trade; it is in the known limits two slides on.

Worth knowing if it comes up: the Programmer's Guide names StrongReadSet once, in a table, and
never mentions GsBitmap or hidden sets. Treat it as undocumented-but-real, and re-verify per
version.
-->

---

## Two consequences that shape everything after

**The grain is the class, not the method.** Compiling a method writes the class's
`GsMethodDictionary` and a per-class `SymbolSet` — so two sessions editing *different* selectors
on one class conflict, and two sessions editing different classes never do, not even when each
introduces a brand-new symbol.

**A view move launders a stale *read*, but never a stale *write*.** Once an object is in your
write set the conflict follows it through any number of refreshes. An object you have only *read*
has no such protection.

<!--
Measurements E, I and J for the first; M and N for the second.

The consequence of the first that I have to own: the guardrail I built works at METHOD grain, and
it sits on a repository whose conflicts are per class. So a client can still be refused a commit
over a method it never touched. That is coarse in the safe direction, which is the right way
round, but it means the recovery path has to be good, because clients will meet it.

The second is the sentence the design turns on, and it is row four of the four-way measurement two
slides back: if you have already written the object, refreshing does not save you. It is the READ
that goes unprotected.
-->

---

## The rule, the ledgers, the stamp

> A mutating tool may not touch a method, class or dictionary that has not been read in the
> **current view window** — and a window opens whenever the view moves.

Two instance variables on `McpServer`. **Nothing touches `GsBitmap`, hidden sets, or any
repository state; the stone's own guardrail ships untouched.**

| grain | key | stamped over |
|---|---|---|
| method | `Foo>>bar:`, `Foo class>>bar:` | the installed source, as `sourceCodeAt:` answers it |
| class shape | `Foo:shape` | `Foo definition` |
| class comment | `Foo:comment` | the comment |
| dictionary | `#UserGlobals` | entry **names and kinds**, sorted — never the values |

Stamp = **SHA-256 of the canonical text in the current view** (`asSha256String`).

<!--
readLedger is a Dictionary of key to stamp: what this session has seen in the current window, and
a digest of what it saw. writeLedger is a Set of keys: what it has changed and not yet committed.

They are instance variables, which ties back to section 4: the worker instance lives in
SessionTemps for the life of the gem, and `currentServer` is the single place that answers it —
because a second instance would be a second set of ledgers, licensing writes on the strength of
reads it never saw. That is why there are two entries into a worker, a client request and the front
end's own maintenance call, and both go through the same accessor.

The dictionary row, if anyone asks: the values are deliberately not hashed, because
list_dictionary_entries shows none of them, and remove_dictionary — the write this licenses —
destroys the bindings rather than the objects. Hashing what the tool does not show would make the
licence stricter than the harm.

requireRead: never looks at a stamp. Membership is the whole test. The stamp exists for exactly one
moment, which is the slide after next.
-->

---

## What licenses what

| a read of… | registers | a write of… | requires |
|---|---|---|---|
| `get_method_source(Foo, bar:)` | `Foo>>bar:` | `compile_method`, `delete_method` | `Foo>>bar:` |
| `get_class_definition(Foo)` | `Foo:shape` | `compile_class_definition` (recompiling) | `Foo:shape` |
| `describe_class(Foo)` | `+ Foo:comment` | `set_class_comment` | `Foo:comment` |
| `export_class_source(Foo)` | shape, comment, **every selector** | `delete_class` | shape **+ every selector** |
| `list_dictionary_entries(D)` | `#D` | `remove_dictionary` | `#D` |
| the search tools | **nothing** | `add_dictionary` | **nothing** |

**Creation is never blind.** **A write implies a read.** So `writeLedger ⊆ readLedger` at every
instant — which is the property the whole thing rests on.

<!--
The split is per TOOL, not per toolset, and the test is: does this call name one subject and show
its current contents? list_classes(D) names a dictionary but shows only the classes in it — a
partial view, not enough to license destroying it. list_methods and get_class_hierarchy show names,
not sources. The search tools are exploratory and register nothing, deliberately.

Creation is never blind because if the selector, class or dictionary does not exist in the current
view there was nothing to read, so nothing can be discarded; a concurrent creation by another
session collides write-write in the ordinary way.

A write implies a read because having just written something is knowing its content — better than
having read it. So compiling licenses recompiling, and creating a dictionary licenses removing it.

Two details that are load-bearing rather than fastidious. writeLedger is written on the branch that
ACTUALLY performed the write, never on entry to the tool — a phantom entry would license a change
on the strength of nothing shown to the client, and conflictingSubjects decodes the stone's
conflict report through that ledger, so a phantom could misname a conflict. And compile_method
takes source rather than a selector, so the guardrail has to name the method before it can decide:
it asks the kernel's own compiler with the intoMethodDict: variant against a throwaway dictionary,
which answers the real selector for unary, binary and keyword patterns alike while leaving the
class's selectors unchanged and needsCommit false.
-->

---

## Re-validation: what the client is told when the view moves

At **every** move — commit, abort, `refresh` either way — `revalidateReadLedger` re-stamps each key
in the new view. Equal, and the read keeps its licence. Different, and it is dropped and named:

```
[session] The view moved: 2 of 7 earlier reads are stale and must be re-read
before writing to them: Foo>>bar:, Baz:shape.
```

**The count is the point.** It says the other five still stand — so the client re-reads two
subjects instead of all seven, or worse, discovers each stale one as a refusal.

<span class="fine">A byte-identical recompile by another session leaves the read good. An aborted
write needs a fresh read. One `sourceCodeAt:` + one SHA-256 per entry per move.</span>

<!--
Until 2026-09-02 this was decided by rule instead of by looking: a successful commit kept the write
set plus "the widening", an abort dropped everything unexamined. So an abort after browsing twenty
methods cost twenty re-reads even when nobody else had committed a thing.

A read is a statement about content — "Foo>>bar: says this" — and moving the view does not make it
false; another session having committed a different Foo>>bar: does. So now every move looks. Both
old rules are subsumed, because a proof that the content did not change is weaker than looking at
it.

The names are summarised BY CLASS so the line stays one line whatever was browsed: up to three
methods of a class in full, more counted as "5 methods from Foo", a definition or comment as
"Foo (definition)", and past four classes the whole list gives way to "changes to 7 classes;
re-check what you depend on before writing".

Three consequences, if asked. Byte-identical recompile: the stamp is of the TEXT, not the method
object, and a recompile does install a new GsNMethod — so the client's read is still true and
nothing it writes discards anything. An aborted write needs a fresh read even if nobody else
touched it, because the write recorded the stamp as written and the abort restored the previous
content: the client's last knowledge is a version that no longer exists, and it is told so. And a
false refresh leaves this session's own uncommitted writes in place, so such a read survives the
refresh and is dropped by the abort that is the only way out.

Cost: tens of microseconds per entry, so a few hundred reads cost milliseconds against a commit
that costs more. If it ever shows, the fallback is a lazy check in requireRead: against a recorded
view generation — at the price of this one-time note, which can only come from checking everything.
-->

---

## Full disclosure: `execute_code`, and three limits

**`execute_code` is outside the guardrail, and its own description says so.** This cannot be
closed: it evaluates arbitrary Smalltalk, so any check is walked around with `perform:`, and it can
send `System commitTransaction` itself.

**And there is no way to observe what it wrote.** `System needsCommit` only flips on the *first*
write of a transaction; `PomWriteSet` is empty until the commit flush; `_enableTraceNewPomObjs`
traces objects only *after* they are committed. So the commit result reports **how many
`execute_code` calls happened in the window** — the most that can be said without inventing
precision.

A deployment needing a hard guarantee **composes the toolset out.** Limits: cross-class staleness
is not caught · `execute_code` · the grains differ.

<!--
Say this plainly rather than burying it. The guardrail covers the tools that name their subject,
and the tool that names nothing is exempt. A deployment that needs the guarantee removes
McpExecutionToolset, which is resolved per session like any other — the same mechanism read-only
mode uses.

The three observability failures are worth naming because each is a thing I tried. needsCommit
reports the case that does not matter and misses the case that does. PomWriteSet is empty until
flush. And the trace primitive traces after commit, which is too late by definition.

Cross-class staleness: read Foo>>a, write Bar>>b on the strength of it, and another session's
change to Foo>>a will not stop the commit — the repository validates Bar only, and the guardrail
only asks whether Bar>>b was read. StrongReadSet would close it and costs too much. Re-validation
softens it: the commit's own result names Foo>>a as stale, so the client learns of it — after the
write rather than instead of it.

One story if there is time, and it belongs with slide 6: compile_class_definition used to take a
source string and evaluate it, checking only afterwards that the result was a Behavior — by which
point any side effect had already happened. It was execute_code with a return-type assertion. It
now takes structured arguments and builds the definition itself, so it cannot evaluate anything.
-->

---

## Keeping the measurements honest

Two suites, **deliberately different in kind**:

- **`McpBlindWriteTest`** (41) drives the ledger protocol directly and pins the **rules**.
- **`McpConcurrentEditTest`** (18) stages genuine conflicts from a **real second gem** and pins
  that the rules still match the **database**.

One test is written to **fail on good news**:

> `testTheStoneAloneWouldAllowThatClobber` asserts that with the guardrail bypassed, GemStone
> **still accepts** the commit that discards the other session's work. If it ever starts failing,
> the stone has grown protection of its own and this design's scope should be revisited.

<!--
The reason for two suites is the reason for this whole section: every rule here was derived from
something measured against a live stone, and a suite that never touches the stone cannot notice if
a measurement stops holding. A kernel change that made a failed commit move the view, or made a
refresh stop laundering a stale read, would leave the rules suite green and the guardrail wrong.

The fail-on-good-news test is the one I would point at if asked how this is maintained rather than
just built. It is also, as of four days ago, doing exactly its job on an unsupported image: on
3.7.2 it FAILS, and what it is reporting there is not good news — that image refuses the
same-object case spuriously while still laundering every case where the write lands somewhere other
than the read. That is section 12.

Both suites commit, so both declare movesTheSessionView, and the run_test_class tool refuses them
from a session holding uncommitted work. That opt-in is worth a mention: nothing reminds you, and a
suite that commits without declaring it eats the caller's changes.
-->

---

<!-- _class: demo -->

# DEMO — two clients, six calls

1. **A:** `get_method_source` on the fixture, then `compile_method` a change — uncommitted
2. **B** (topaz, second gem): commit a *different* change to the same class
3. **A:** `commit` → **refused**; `[session]` names the conflicting **class**
4. **A:** `abort` → `[session]` names **which reads went stale**
5. **A:** `compile_method` again without re-reading → **refused, `kind: blindWrite`**
6. **A:** re-read, recompile, `commit` → **accepted**

<!--
Three minutes, hard stop. Step 5 is the point of the whole demo — that is where the room sees the
browser invariant being restored by rule.

Setup, all of it before the talk: the fixture class with two methods (NOT a production class), the
second topaz session already logged in with its commit line ready to paste, and both curl commands
written down. Do not improvise the fixture name on stage.

Steps 1 to 3 are the human-browser slide's refusal, reached the agent's way. Steps 4 to 6 are the
agent slide — except that step 5 is where this server stops and the bare stone would not.

If step 3 does not refuse, B committed nothing — check it committed rather than only compiled. If
step 5 does not refuse, the abort's re-validation kept the read, which means B changed a different
method than the one A read: say so and move on, it is still the right behaviour.

Then straight into section 8, which is the other half of the same story: what the SERVER does to a
view when the client will not move it.
-->

---

<!--
================================================================================
VERTICAL SLICE 2 — section 8, the router maintenance cycle. Ten slides, cut
2026-09-10 against docs/Presentation.md section 8.

The thesis, and every slide serves it: the front end is the only part of this
server with a heartbeat, so every judgement about time is made there -- and it is
made by COUNTING EVIDENCE THIS FRONT END OBSERVED rather than by measuring
elapsed time. Two mechanisms were deleted by adopting that rule, which is the
strongest thing the section has to say and why slide 3 is the one to protect.

What the outline had as slides and this does not, all now speaker notes, on the
same principle slice 1 settled -- a MEASUREMENT is evidence for a claim, not the
claim, and notes are where evidence belongs:

  * the 96%-over-one-night suspend-detector result -> notes on slide 3;
  * the four-way commits-behind measurement (9 -> 18 -> 161 -> 202, and the
    489-behind front-end gem) -> notes on slide 7;
  * the StnCrBacklogThreshold "-1 comes back resolved as 80" finding -> notes on
    slide 6;
  * the zero-filled descriptionOfSession: of a dead gem -> notes on slide 6,
    which is where a Q&A magnet belongs;
  * the endedCall*/isEndedCallKind: defect story -> notes on slide 8;
  * request deadlines and cancellation IN FULL -> notes on slide 8. The outline
    put them in this section because they share the escalation; at this budget
    they are the first thing that cannot be slides. If section 8 is ever given
    another minute, this is what to spend it on.

Budget: 7:10 -- 340s of slides plus the 90s demo F, against the 6.5 minutes the
outline's table allowed. Slide 3 carries 45s and slide 7 another 45; those two
are the section. See the note in docs/Presentation.md on where the extra 0.7
talk minutes come from.
================================================================================
-->

<!-- _class: lead -->

# The maintenance cycle

### One gem with a heartbeat, counting what it saw

<!--
Frame the section in one sentence before the first slide: everything in here is
done by ONE forked GsProcess in the front-end gem, and it is the only clock this
server has. Worker gems cannot help -- a forked GsProcess only runs while its gem
is executing Smalltalk, and a worker between calls is executing nothing. That is
the same fact that decided the detached front end in section 3; this is the third
design it decides.

Then say what the section is going to argue, because it makes the rest coherent:
almost nothing here is measured in elapsed time. It is all counts of things this
front end observed. Promise that and they will spend the section checking it.
-->

---

## One `GsProcess`, one pass every 60 seconds

<div style="text-align:center">
<svg viewBox="0 0 960 330" width="900" role="img" aria-label="The maintenance pass: refresh the front end's own view, then measure each worker's view hygiene, then probe quiet sessions, then reap. Step one comes first so everything after it reasons about the repository as it is now; reaping comes last so a session found gone while probing is freed in the same pass.">
  <defs>
    <marker id="m8" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="26" y="70" width="188" height="62" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <text x="120" y="95" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">refreshFrontEnd-</text>
  <text x="120" y="115" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">View</text>
  <rect x="256" y="70" width="188" height="62" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <text x="350" y="95" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">maintainView-</text>
  <text x="350" y="115" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">Hygiene</text>
  <rect x="486" y="70" width="188" height="62" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <text x="580" y="107" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">probeIdleSessions</text>
  <rect x="716" y="70" width="188" height="62" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <text x="810" y="107" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">reapIdleSessions</text>
  <line x1="214" y1="101" x2="252" y2="101" stroke="currentColor" stroke-width="1.5" marker-end="url(#m8)"/>
  <line x1="444" y1="101" x2="482" y2="101" stroke="currentColor" stroke-width="1.5" marker-end="url(#m8)"/>
  <line x1="674" y1="101" x2="712" y2="101" stroke="currentColor" stroke-width="1.5" marker-end="url(#m8)"/>
  <text x="120" y="153" font-size="14" text-anchor="middle" fill="currentColor" opacity=".62">this gem&#8217;s own view</text>
  <text x="580" y="153" font-size="14" text-anchor="middle" fill="currentColor" opacity=".62">each worker gem</text>
  <path d="M810 132 L810 190 L14 190 L14 101 L20 101" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 5" opacity=".55" marker-end="url(#m8)"/>
  <text x="465" y="212" font-size="15" text-anchor="middle" fill="currentColor" opacity=".7">every reaperIntervalSeconds (60)</text>
  <path d="M34 62 L34 44 L206 44 L206 62" fill="none" stroke="#b4451f" stroke-width="1.6"/>
  <text x="120" y="34" font-size="14" text-anchor="middle" fill="#b4451f" font-weight="600">first: so all of the above sees <tspan font-style="italic">now</tspan></text>
  <path d="M724 62 L724 44 L896 44 L896 62" fill="none" stroke="#b4451f" stroke-width="1.6"/>
  <text x="810" y="34" font-size="14" text-anchor="middle" fill="#b4451f" font-weight="600">last: found gone, freed this pass</text>
  <text x="26" y="250" font-size="15" fill="currentColor" font-weight="600">Per session, inside the pass:</text>
  <text x="26" y="275" font-size="15" fill="currentColor">notePassWithStream: &#8212; <tspan font-style="italic">first and unconditionally.</tspan> The pass <tspan font-style="italic">is</tspan> the observation.</text>
  <text x="26" y="300" font-size="15" fill="currentColor">Then: busy &#8594; skip &#183; no stream &#8594; skip the ping, keep counting &#183; probe due &#8594; ping</text>
</svg>
</div>

<!--
The order is the point, and the class comment says so. Take the two brackets in turn.

Step 1 first: the front end moves its OWN view, which is two things at once -- it stops holding a
commit record open for the rest of the stone, and it is the front end's code-refresh point (a
committed recompile of McpRouter takes effect within two passes). Everything after it therefore
reasons about the repository as it is NOW rather than as it was when this gem logged in.

Reaping last: a session found gone while probing is freed in the SAME pass rather than the next one.
At a 60-second interval that is a minute of a login slot, every time.

The per-session line at the bottom is the whole clock, and it is worth saying slowly.
notePassWithStream: runs first and unconditionally, before any reason to return early -- before the
busy test, before the no-stream test. So the counts advance for every session on every pass this
front end runs, and for no other reason. A busy session still gets counted; it just gets nothing
sent to it.

If asked why a worker gem cannot do its own housekeeping: a forked GsProcess only runs while the gem
is actively executing Smalltalk. A worker sitting between calls is executing nothing, so a timer
inside it does not fire. This is the third design that fact decides, after the detached front end
and the front end owning the client stream.

One honest footnote if somebody is reading the source along with you: the numbered list in
#maintainSessions's comment has three steps, and the method sends four -- maintainViewHygiene is
missing from the list. The code is right and the comment is stale.
-->

---

## Almost nothing here is measured in elapsed time

* **Idleness** is a count of **pings the client answered with no work in between** — `sessionIdleTimeoutSeconds` &#247; the *realized* ping cadence, **fifteen** at the defaults
* **Unreachability** is a count of **passes with no stream**
* **A ping is never declared late by a clock.** It is superseded by the next one and judged then — admissible, or discarded because the transport moved under it

Every count advances only while the front end runs, so **a suspended host simply stops the count where it was**: no suspend to detect, nothing to forgive, no threshold to get wrong.

> Two mechanisms were **removed** by this rule, not fixed: the suspend detector, and the pass that timed out server-initiated requests.

<!--
This is the slide to spend time on. It is the section's thesis and the only idea here that transfers
to anything else in the room.

The prehistory, because it is a result rather than an anecdote. An earlier design DID measure elapsed
time, and to cope with laptops it tried to DETECT suspends -- forgiving a pass that came back late.
It worked to about 96% over a real night. The missing few percent still released sessions whose
clients had never left, and the reason it could not be tuned out is the interesting part: the error
term was set by somebody else's power management, not by anything this server could observe. So the
number was never going to converge.

Counting evidence instead removed the failure AND the mechanism together. That is the sentence to
land: not "we fixed the suspend detector", but "there is no suspend detector, because there is no
suspend left to forgive". Same for pending-request timeouts -- retirePendingProbesFor: judges a ping
by supersession rather than by a clock, so nothing is waiting on a timer to be declared unanswered.

sleep-test.sh brackets a real sleep and asserts the outcome that now matters: the session is still
there, the gem still works, and the front end logged nothing about the sleep at all.

Every division rounds up, through one helper, #countCovering:every:. Rounding down would make a
configured timeout the MOST a deployment could get rather than the least. So the guarantee is
legible: a session is released no sooner than its configured timeout, and no later than one
maintenance pass after it. And the idle count is taken against the REALIZED cadence, because a
90-second probe interval on a 60-second pass really fires every 120 -- dividing by 90 would count
fifteen pings where twenty minutes of them had gone by.

Expect the question "what if the front end itself is wedged?" Answer: then nothing is reaped, which
is the safe direction -- no client loses a gem because the server stopped watching.
-->

---

## `reapReasonFor:` — the whole policy, ordered by *kind of evidence*

| | ground | what kind of thing it is |
|---|---|---|
| — | **a call is in flight** | **never reaped, on any ground, however long it has run** |
| 1 | `isExpired` | **wall clock** — a credential is, and no amount of sleeping makes an expired token valid |
| 2 | stream closed by client **and** none open now | one **observed fact**; needs no repetition to be believed |
| 3 | `unansweredProbes >= 3` | **evidence**, not absent traffic — it went down a stream the client itself opened |
| 4 | `quietProbes >=` confirmations | **counted confirmations**; only where a deadline is configured |
| 5 | stuck view — **four** conjuncts | the only ground about the **repository** rather than the client |
| 6 | `streamlessPasses >=` limit | the **give-up** rule: liveness cannot speak for a client it cannot reach |

<span class="fine">Reaped &#8594; unmapped silently. The client meets the **404** the transport already defines on its next call; the reason goes to the gem log.</span>

<!--
One place, one method, and the ordering is by what KIND of claim each rung makes -- that is what to
point at, not the individual numbers.

Rung 0 is the one to say out loud, because somebody will be composing the objection already: a
session with a call in flight is never reaped on any ground, however long that call has run.
McpSession>>forward: stamps the activity clock when the call STARTS, so a request that outlives its
own session would otherwise have its worker logged out from under it.

Two rungs are deliberate exceptions to the counting rule, for opposite reasons, and it is worth
naming both. Expiry is wall-clock because a CREDENTIAL is wall-clock -- being asleep does not make an
expired token valid. A closed stream is a single observed fact rather than a count, because the drain
loop watched it happen; it does not need repeating to be believed. Note the "and no stream open now"
conjunct: a client that reopened in the meantime is never taken on the strength of a connection it
has already replaced.

Rung 5 is the only one with a strictly-greater comparison where the others use >=, and there are two
reasons, both good. It makes a configured grace a FLOOR rather than a ceiling -- the pass that
discovers a stuck view is the same pass that would reap it, so `>= 1` would spend a one-pass grace
before a single interval had elapsed. And it makes a grace of ZERO mean what it says with no separate
evidence test: `> 0` is false for a session nobody has ever found stuck, and true on the first pass
that does.

If asked what "stuck" means, it is one sentence and slide 7 has the rest: System continueTransaction
is illegal in exactly two states -- after a commit that failed on conflict, and inside a nested
transaction -- and in both the view stays exactly where it was.

What the client is told: nothing, before or at either deadline. It was told, until 2026-08-27, in a
notifications/message -- which the draft revision deprecates and, for anything unsolicited,
prohibits, and which measurement said no client surfaced to its model anyway. What it gets instead is
the 404. The ping stays because what it buys is the EVIDENCE, not the message.
-->

---

## An answered ping proves the client is there — and still counts against it

* **Any** answer proves liveness — result *or* error (`noteAlive`)
* It deliberately **does not stamp the activity clock**. Only real MCP traffic (`touch`) restarts the idle cycle
* Otherwise every well-behaved client — and they all answer `ping` — would hold a gem **and a transaction view** for as long as it stayed open

**An unanswered ping is evidence of death only if it went down the stream the client is still on.** Both shipping clients reopen a dropped GET on their own, and a write into the superseded stream *succeeds* — into a buffer nobody will read. So every probe records its **stream generation**.

<span class="fine">Measured against real clients, 2026-08-23: **6 of 14 pings** were retired as inadmissible rather than counted unanswered.</span>

<!--
The first three bullets are one deliberate decision and the audience may well push on it, so have the
reason ready rather than the mechanism: the ping is how idleness is MEASURED, so an answer cannot
also reset what it is measuring. If it did, the idle deadline would be unreachable for every
conformant client, and "idle" would come to mean "disconnected" -- which the streamless rung already
covers. Unanswered is the other direction and is a gain, not a cost: proven gone, released early
rather than waited out for the full thirty minutes.

The bottom half is the subtlest thing in the section and worth the words. The failure it prevents is
specific: a handover is likeliest on exactly the quiet sessions the reaper probes, so the population
being judged is enriched for the thing that breaks the judgement. And a write to the superseded
socket does not fail -- it succeeds into a buffer nobody will read -- so there is no error to notice.
Three pings like that and a perfectly healthy client loses its gem.

6 of 14 is the number to give if anyone asks whether this is theoretical. It is not a rare
correction; it is nearly half.

Also note what replaced the timeout here, because it is the same idea as slide 3: probeSession:
retires the previous ping BEFORE sending the next one. A ping is not declared late by a clock, it is
superseded and judged at that moment -- unanswered if its generation is still current, discarded if
the transport had moved on under it.

If asked about the ping cadence: one cadence for every session, every probePassInterval passes from
the last touch -- 120 seconds at the defaults -- whether or not that session has an idle deadline,
because the ping is how idleness gets measured either way. A client making calls is never pinged at
all, since touch resets the count.
-->

---

## How the front end can see any of this

**`System descriptionOfSession:`** — primitive 334. A **stone query**, made from the front-end gem, *about another session*.

| field | meaning |
|---|---|
| 7 | `-1` / `0` / `1` — transactionless / out of transaction / in transaction |
| 8 | whether this session references the **oldest** commit record |
| 16 | commits that have occurred **since the session obtained its view** |

* It never touches the worker's GCI channel, so **a busy worker can be measured perfectly well** — even though it must not be *acted* on
* Reading **another** session needs the `SessionAccess` privilege; a worker reading its **own** field 16 needs none, which is what makes the every-result `[session]` note self-measured

<!--
This is the slide this audience will want and no other audience would, so let them look at it.

The important structural point is the first bullet, because it is what makes the busy case tractable
at all: the MEASUREMENT is a stone query and cares nothing for what the worker is doing; the ACTION
would have to travel the worker's GCI channel, which allows one call at a time. So a session with a
call in flight is measured every pass and acted on never. That asymmetry is not a workaround, it is
the reason the arm can exist. It was checked explicitly because it was the obvious thing to worry
about.

#workerStoneSession is cached at the worker's login (McpSession>>cacheWorkerIds) precisely so nothing
on this path has to ask the worker anything.

THE Q&A MAGNET, and it is worth having ready because somebody here will ask what happens to a dead
gem's measurement. descriptionOfSession: does not refuse a session id nobody holds -- measured on
3.7.5 it answers a ZERO-FILLED description, 29 fields, the first nil and the rest 0. So field 16 is
0, the session reads as perfectly current, the arm sends it nothing and writes nothing. And that is
the TRUTHFUL answer rather than a lucky one: a gem that has exited pins no commit record, because its
view went with the process. What it left behind is a maxSessions slot and nothing else -- which is
slide 9.

The one exception, if pressed, is id recycling: the cached number can be handed to another gem, and
then the figure read belongs to a stranger. Worst case is one confusing log line per pass -- it names
the right session, quotes a different gem's number, and reports an error about a gem that is gone,
and none of the three is wrong on its own terms. Nothing is corrupted and nothing reaches the
stranger, because the refresh only ever travels the dead worker's own closed channel.

STnCrBacklogThreshold, if the stone settings come up: it comes back from the runtime ALREADY
RESOLVED, and that mattered. system.conf documents -1 as twice STN_MAX_SESSIONS; on the development
stone, which sets neither, the runtime read answers 80 against a StnMaxSessions of 10. Resolving -1
ourselves would have computed 20 and been wrong about the number the stone actually uses. Trust the
stone's number; map only 0 (disabled) and negative (unknown).
-->

---

## View hygiene: **one** ground, and it is this session's own distance from *now*

A worker at least `maxCommitsBehind` (20) behind is sent one `System continueTransaction` — a current view with its uncommitted work **kept**. Three answers come back:

| `kept` | the ordinary success |
|---|---|
| `doomed` | the pending work now **conflicts** — and the *worker* tells its client so on every later call |
| `stuck` | the view did not move at all; `continueTransaction` was illegal there |

**Nothing about the state of the stone can put a worker over the line.** An earlier version had a second route — stone over `StnCrBacklogThreshold` **and** this session holding the oldest record — and it was wrong twice over.

<span class="fine">It happens **between** calls, never with one in flight. A pending write is **validated, not laundered** — the kernel carries the write set forward, so a refusal that was owed is still owed. And the client is **told**, with the stale reads named.</span>

<!--
Two things to get across, and the second is the one they will argue with.

First, `doomed`. This is what makes the whole arm defensible and it connects straight back to section
7: the kernel carries the write set forward across continueTransaction and answers whether it NOW
conflicts. So refreshing a worker's view cannot launder a write that was going to be refused -- a
refusal that was owed is still owed. If that were not true, this arm would be the blind write the
previous section was about, performed by the server on the client's behalf, which is precisely the
design this project twice rejected.

Second, the deleted route, and both halves are measured. (a) The inequality only runs ONE WAY: the
backlog is at least the largest commits-behind figure among the sessions, never the reverse, because
the stone DEFERS disposing records nobody references -- which is exactly the deferral
StnCrBacklogThreshold exists to override. So a high backlog is not evidence that anybody is behind.
(b) Measured right after a restart, EVERY session reports holding the oldest record; they are all
sitting on the same current one. So that flag is no discriminator at all until somebody has fallen
behind.

Put together, the second route fired hardest in exactly the state where refreshing achieves nothing:
a burst of commits has ended, every view is current, and the backlog number has not caught up yet. It
would have refreshed every worker in the server at once, for a backlog none of their views was
pinning. The stone figures are still read every pass -- but only for the log line, which is what the
next slide's thresholds were tuned against.

THE NUMBERS THE DEFAULT WAS SET AGAINST, and give these if anyone thinks 20 is paranoid. One client
on the development stone went 9 -> 18 commits behind while a 50-second call was in flight (correctly
untouchable). Then 161 -> 202 behind after one ./install.sh and one ./run-unit-tests.sh. An ordinary
edit-install-test loop puts every connected client HUNDREDS of commits behind within minutes. So
maxCommitsBehind = 20 is not a conservative default on a development stone; it is the normal state of
one. And the front-end gem that started this whole investigation was 489 commits behind with the
stone's backlog at 490, and was the sole entry in sessionsReferencingOldestCr.

commitsBehindLimit is the LOWER of what the router tolerates and StnSignalAbortCrBacklog, so either
one firing is enough; when the stone cannot be read the configured number stands alone, because an
unreadable setting must not silently raise the bar.
-->

---

## The two disruptive arms take pressure as a **conjunct**, never an alternative

**On a quiet repository a long call is never ended, however long it runs.** This is not a request deadline in disguise.

**3(a) — a stuck view is reaped.** All **four** of: configured at all; stuck on *more* passes than the grace; far enough behind to matter; **and** the stone over its own threshold.

**3(b) — a *running* call pinning the oldest record is ended.** Those three **plus** holding the oldest record, sustained for the whole grace.

* The reaper only ever **sets a flag** — the ending is done by the process that owns the worker mutex, on its next wait
* `tryLock`, not `critical:`. And **no `touch`**: `touch` would be an immortality potion

<!--
Lead with the last line, not the mechanism -- it is the objection this slide exists to answer. Say it
before anyone raises it.

Why a stuck view is reaped rather than aborted, if asked: an abort behind the client's back would
destroy the same work SILENTLY and leave a live session working from a view it never chose. A reap is
LOUD -- logged, plus the 404 the transport already defines.

The two mechanism details are the user's own note and both are easy to get wrong. No touch: touch
resets everything the reaping policy counts, so a maintenance send that touched would refresh forever
a session whose client had gone for good. tryLock rather than critical:: critical: would park the
REAPER's process behind a client's tool call for the length of that call, stalling probes and reaps
for every other session in the server. And testing isBusy alone would not do -- a call can start
between the test and the send, which is what the mutex is for.

BOTH ARMS WERE VERIFIED LIVE, and these are the numbers a reviewer will ask for. The pinned-call arm
fired after three consecutive pinning passes: backlog 195/80, the session 194 commits behind; the
client got -32001 with data.kind viewRelease bearing its own request id; and the NEXT pass refreshed
the now-idle session to 'kept', which is the arm's whole purpose. It also correctly DECLINED to fire
while every other condition held but the session did not hold the oldest record. The stuck-view arm
was found stuck at :54 and :14 and reaped at :34 -- exactly the 40 seconds configured.

ONE DEFECT THE LIVE RUN CAUGHT AND NO UNIT TEST WOULD HAVE -- tell this if there is time, it is the
best small story in the section. Both catch sites on the response path ENUMERATED the endings they
knew, #cancelled and #timeout, and passed everything else along. So the first call ever ended for
#viewRelease reached its client as a bare -32603 Internal error with id null, with the reason the
server had just written to its own log nowhere in it. The list had already grown three times and
would have gone on swallowing the fourth. Fixed by asking McpSession what an ended call IS
(isEndedCallKind:) instead of naming reasons at each catch -- which is why the writers are called
endedCall* and answer for four endings now. Two more endings have been added since and neither needed
either catch site touched.

REQUEST DEADLINES AND CANCELLATION, which share this escalation and are notes rather than a slide.
requestTimeoutSeconds is nil by default, and that is a change with a story. It was 45 seconds, chosen
against the CLIENT's patience rather than the server's -- but what that number really was is a guess
at the moment nobody is waiting any more, made by a server with no way to find out. Two things now
tell it instead: a call carrying a progressToken is answered as a stream and pushes its own deadline
out as it reports, and a client that stops waiting SAYS SO (notifications/cancelled, or by closing
the response stream). A deadline approximates that; a cancel signal knows it. The cost also fell in
the wrong place -- 45 seconds cut off a full suite run, a large fileIn, a broad search far more often
than a runaway -- and it was not even conservative in the direction intended: measured 2026-08-31,
Claude Code ran a 150-second tool call to completion, with no progress notifications on it, and took
delivery of the answer. What ending a call costs: a soft break reaches both shapes a runaway takes --
a Smalltalk loop and a call blocked in a wait -- and leaves the worker immediately usable, so the
session, its view and its uncommitted work all survive. What it does NOT promise is that the call did
nothing. A gem that takes neither break -- code that handles ControlInterrupt and resumes -- cannot
be ended from the front end at all, so it is stopped from the stone side and the session finishes;
that is the one case where a timeout costs the client its session, and the error says so.

Logging, if asked why the gem log is not full of this: what gets a line is NEWS. A view that moved,
always. A view that has just BECOME stuck, once -- the transition is news, the standing state is not.
Any pass on which the number changed. Both silences were measured rather than guessed: before the arm
acted at all, an idle session over the line wrote three identical lines in a row -- 1440 a day at a
one-minute pass -- and a stuck session writes one per pass for the whole of its grace.
-->

---

## The ending that is *not* in the ladder: a worker gem that has **died**

<div style="text-align:center">
<svg viewBox="0 0 900 250" width="850" role="img" aria-label="A live client answers every liveness ping from the front end, so no reaping ground trips, while the worker gem behind it is dead. Only the front end can see that its own worker is gone.">
  <defs>
    <marker id="m9" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="20" y="58" width="176" height="70" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <text x="108" y="90" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">client</text>
  <text x="108" y="112" font-size="14" text-anchor="middle" fill="#2e6a4f">alive, retrying</text>
  <rect x="352" y="58" width="176" height="70" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <text x="440" y="90" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">front end</text>
  <text x="440" y="112" font-size="14" text-anchor="middle" fill="currentColor" opacity=".62">the reaper</text>
  <rect x="684" y="58" width="176" height="70" rx="4" fill="none" stroke="#b4451f" stroke-width="1.6" stroke-dasharray="6 4"/>
  <text x="772" y="90" font-size="16" text-anchor="middle" font-weight="600" fill="#b4451f">worker gem</text>
  <text x="772" y="112" font-size="14" text-anchor="middle" fill="#b4451f">dead</text>
  <line x1="348" y1="80" x2="204" y2="80" stroke="#2e6a4f" stroke-width="1.6" marker-end="url(#m9)"/>
  <text x="276" y="70" font-size="14" text-anchor="middle" fill="#2e6a4f">ping</text>
  <line x1="204" y1="106" x2="348" y2="106" stroke="#2e6a4f" stroke-width="1.6" marker-end="url(#m9)"/>
  <text x="276" y="126" font-size="14" text-anchor="middle" fill="#2e6a4f">answered &#10003;</text>
  <line x1="532" y1="93" x2="676" y2="93" stroke="#b4451f" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#m9)"/>
  <text x="604" y="83" font-size="14" text-anchor="middle" fill="#b4451f">GCI 4067</text>
  <text x="276" y="172" font-size="15" text-anchor="middle" fill="currentColor" font-weight="600">every ground in reapReasonFor: says &#8220;keep&#8221;</text>
  <text x="276" y="194" font-size="14" text-anchor="middle" fill="currentColor" opacity=".62">and it is right: the client really is there</text>
  <text x="604" y="172" font-size="15" text-anchor="middle" fill="currentColor" font-weight="600">only this gem knows</text>
</svg>
</div>

**Recognized by the GCI *fatal* band, `originalNumber` 4000–4999** — the kernel's own verdict, not a guess about which failures are serious. Answered **`-32001` / `data.kind: sessionGone`**, *and* the session is unmapped as part of answering, so the next request gets the **404**.

<!--
Why this could not be a rung, which is the instructive part and what the drawing is for: the reaper's
probe asks whether the CLIENT is still there, down a stream that client keeps answering. A dead gem
behind a live client answers every ping and trips no ground at all -- and the ladder is not wrong, it
is answering a different question correctly. Only the front end knows the state of its own workers,
which is why both halves of the fix are in McpRouter.

The old behaviour was a WEDGE, and say what it cost: a dead worker left its session registered, and
every later call answered a generic -32603 "Internal error" with no data.kind, inside a healthy HTTP
200 -- which means "something went wrong at our end", not "your session is finished". So a
WELL-BEHAVED client retried, got the same answer forever, never re-initialized, and the session held
its maxSessions slot for as long as the front end ran. Being well behaved was the thing that trapped
it.

Why the BAND rather than either number: GsTsExternalSession>>_signalError: CLOSES the external
session's connection when it sees one, which is why the SECOND such request fails with 4100 "invalid
session" however the first one failed. Matching the band also keeps it from being a list to maintain
-- out of memory, killed from the stone side, netldi gone, the process segfaulting, all arrive as
some number in it, and none leaves a worker that can serve another request.

Both halves are for two different clients: -32001 with data.kind sessionGone, bearing its own id
(as a FRAME where the call was already being streamed), lets a client recover on THIS request; the
unmapping lets a client that branches on nothing recover anyway, via the 404.

What the client is told and what it is not: the GCI NUMBER, never the GciError's text. Measured on
3.7.5, the kernel appends the gem's whole NRS to a fatal error -- host, stone, GemStone user, extent
and log paths -- which is not a thing to hand an MCP client, least of all on the network-facing front
end. The failure in full goes to the gem log beside the session id: the same split a reap makes.

Verified end to end on 3.7.5 with the reported reproduction, an execute_code that exhausts the
worker's temporary object memory. The gem dies in about three seconds, the call is answered
sessionGone with GCI 4067, the next request 404s, and a fresh initialize succeeds on a router capped
at ONE session -- so the slot really came back. 4 new tests in McpTransportTest and 9 wire checks in
test.sh, which is the only place the first failure's number can be pinned: a mock can raise 4100, but
it cannot die.
-->

---

## `maxSessions` — the one bound here that **refuses** rather than releases

* A session **is** a GemStone login, and a repository has a finite number — **ten** on Community Edition
* **The login that exhausts them fails for every gem on the stone, not just the client that asked**

<span class="fine">Measured on 3.7.5: nine one-shot clients took nine worker gems; the tenth login *of any kind* failed with **4039**; and the **owner of the database was locked out of their own extent, including from plain topaz**, until the router was killed.</span>

* And it takes no carelessness — **reconnecting counts as a new client.** Reloading a tab, restarting an agent, a client that crashes and retries
* **Three** is deliberately low: one agent, one editor, one spare for a reconnect not yet reaped

The idle rules make that self-correcting. **The cap makes it impossible.**

<!--
End the section here because this is the failure most likely to bite somebody in this room, and it is
the one slide where the answer is "we refuse" rather than "we measure".

The lockout is the part to land. It is not that the tenth MCP client fails -- it is that the tenth
login of ANY kind fails, so the person who owns the extent cannot get in with topaz to find out why.
That is why the cap is in the server rather than left to the stone: the stone's limit is shared, and
exhausting it is not a local failure.

If asked about recovery: killing the router released all nine in about four seconds, each worker
being an RPC gem whose client process is the router. But that is a recovery for somebody who already
knows what happened, which is exactly the person who cannot log in.

Eight reconnects inside one idle period is nobody being reckless -- it is a morning of reloading a
tab. Both halves are needed: the idle rules mean a stranded gem goes away on its own, and the cap
means the stranding cannot pile up faster than they go.

How to raise it: SessionsCurrent against StnMaxSessions -- remembering that the unit suite, test.sh
and every other server on the stone spend from the same budget. The number to be safe against is not
what a busy server wants but what the smallest plausible stone allows.

Enforcement, if anyone asks where: openSessionCreating:, inside one critical section, so two
simultaneous initializes cannot both see a free slot.
-->

---

<!-- _class: demo -->

# DEMO F — view hygiene, live

```bash
MCP_MAX_COMMITS_BEHIND=2 MCP_REAPER_INTERVAL=10s ./run-server.sh
```

1. One client **reads a method** — nothing committed, view taken
2. A second gem **commits three times**
3. Wait one pass — the gem log writes `view hygiene: session ... is 3 commits behind`
4. Any tool call: the **`[session]`** line says the server refreshed the view, and **names what went stale**

<span class="fine">**90 seconds, hard stop.** Fall back to a gem-log screenshot if the timing is awkward on stage.</span>

<!--
The point of the demo is the LAST step, not the log line: the client is told, on its next result, in
the same [session] channel section 7 introduced -- and the stale reads are named. Everything before
it is staging.

Rehearse the fallback. This demo depends on a second gem committing on cue and on a pass landing
where you want it, which is two timing dependencies on stage. The screenshot is not a defeat; the
log line plus the [session] line is all the evidence anyone needs, and it saves a minute.

Do not raise MCP_REAPER_INTERVAL questions here -- 10s is for the stage, 60 is the default, and
saying so takes ten seconds you will want back.
-->
