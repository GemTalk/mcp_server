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
  section.demo pre code, section.demo pre code span { background: none; color: inherit; }
  section.demo .fine { color: #a9b6bd; }
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
SIX VERTICAL SLICES so far. In RUNNING order: sections 0 and 1 (nine slides), then sections 2 and
3 (nine), then section 4 (ten), then section 5 (seven), then section 7 (fourteen), then section 8
(ten). In the order they were CUT that is slice 3, slice 4, slice 5, slice 6, slice 1, slice 2 --
the two centrepieces were cut first on purpose, because they are what the budget has to fit
around. Section 6 and sections 9-13 are not cut yet. Each slice's own header comment sits beside
its first slide.

Source of truth for the argument and the notes is docs/Presentation.md; each slice is derived from
the matching section of it. Where the two disagree THIS FILE IS RIGHT and the outline should be
brought into line with it, which is how both slices were reconciled.

Rendering, either way from this one file. --html IS REQUIRED, not optional: Marp Core defaults
html:false and STRIPS raw HTML, which would silently drop all six inline <svg> diagrams and every
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
than a parse error, and nothing warns. The first four diagrams all had this and all four were
silently wrong until rendered (found 2026-09-10). Group the elements with comments or indentation,
never blanks.

The deck renders to PPTX (marp --pptx) but WITHOUT the speaker notes -- the notesSlide parts
contain only the slide number. PDF via --pdf-notes is the only export that carries them.
Beamer note: pandoc discards HTML comments on the way to LaTeX. Notes are plain paragraph text
with no Marp-specific syntax inside, so a comment -> \note{} conversion is mechanical.

The `style:` block is deliberately minimal and is the thing to replace when the visuals get
dressed up. Nothing in the content depends on it. One rule in it is load-bearing rather than
cosmetic: `section.demo pre code span` forces the syntax highlighter's own colours back to
inherit. Without it a shell string literal renders dark blue on the dark demo ground and is
invisible on a projector -- which nothing revealed until demo C's curl became the first demo
command with a quoted argument in it (found 2026-09-12).
-->

<!--
================================================================================
VERTICAL SLICE 3 -- sections 0 and 1: framing, and the repository. Nine slides --
four for section 0, five for section 1, the last of them demo A. Cut 2026-09-11:
first in running order, third to be cut.

Running order and plans, in seconds -- title 10, MCP in one slide 30, what is
different 30, status honestly 35 (105s, section 0); nothing to install 35,
load.gs 35, which gem runs your code 30, how it is verified 40 (140s, section 1);
demo A 60.

Section 0's thesis is one sentence and slide 3 is the whole of it: it runs inside
the image, so a session is a login, a session is a transaction view, and a view is
a commit record the stone cannot dispose of. Everything the rest of the hour finds
difficult follows from those three, and not one of them is an MCP problem.

Section 1 has no thesis and does not want one. It is the tour that makes the later
sections cheap: after it, "the front end" and "a worker" are things the room can
picture, and "why did my fix not take" has an answer on a slide.

TWO DELIBERATE DEPARTURES from docs/Presentation.md:

  * NO DIAGRAM in either section, on purpose -- the only slice with none. The
    orienting picture of the deployment belongs to section 3, where the fork and
    the detach are the subject; the request picture belongs to section 4, where it
    is walked line by line. Drawn here, either would spend 45s saying worse what a
    later section says properly. This is the one slice where a diagram would be
    decoration.
  * the outline's "two expected failures that are signal rather than noise" is not
    a slide. Both belong to sections that spend them properly -- McpExternalSession
    Test to 12, testTheStoneAloneWouldAllowThatClobber to 7, where it already has a
    slide -- so they are one sentence of notes on the verification slide. The
    outline also attributed that test to McpBlindWriteTest; it lives in
    McpConcurrentEditTest, and the outline has been corrected.

WHAT WAS ASKED FOR ON 2026-09-11, and where it landed -- both on the status slide,
which is the slide those two notes turned into:
  * server-initiated messages are NOT a feature and will not become one, because
    the 2026-07-28 draft forbids the direction outright. Slide 4 says "machinery,
    not a feature" and hands the consequence to section 13;
  * read-only mode is a placeholder and must not be oversold. Slide 4 says "a tool
    gate, not an access-control boundary" and names what such a session still
    costs -- a login, and a view.
  The README's own status line still reads both as features; that is now item 5 in
  docs/Presentation.md's fix list.

WATCH -- the Grail toolset is about to stop being auto-detected. McpServer class>>
installedDefaultToolsetNames appends McpGrailToolset whenever that class is loaded
in the image; it is to be replaced by naming the toolset explicitly in the router
configuration. Nothing in THIS slice asserts the auto-detection -- the group table
is about install.sh's file-in, which does not change, and the test counts are
unaffected because the suite runs either way -- but section 2 does assert it
(docs/Presentation.md, "Resolved per session, not at boot") and section 10 will.
Re-read both when that merge lands.

Budget: 5:05 -- 245s of slides plus the 60s demo, against the 5.0 minutes the
outline's table allows for 0 and 1 together. Section 0 runs 15s over its 1.5 and
section 1 comes in 10s under its 3.5, so the pair is within rounding and the table
does not move.
================================================================================
-->

<!-- _class: lead -->
<!-- _header: '' -->
<!-- _paginate: false -->

# mcp_server

### A Model Context Protocol server that *is* a gem

<br>

**For the GemStone developers** — the present state, end to end

<!--
Say the shape of the hour before the first slide, because it is the thing that stops people
waiting for the caveat. Healthy path first, in full: what the repository IS, how a server starts,
one request end to end, a second request end to end. Only THEN progress, the transaction model,
the maintenance cycle, auth, extension, and the version story. Every pressure case is a later
section that comes back to the same trace and adds one arm to it.

You know GemStone. You do not necessarily know MCP, and -- more to the point -- you do not yet
know why a thing that looks like a web server is built out of gems. That second question is the
whole talk.

Six demos, each with a hard stop rehearsed into it. If we run long the demos are what I will
protect, because a section summarised in two sentences beside a live worker gem lands better than
the same section in full with nothing on screen.
-->

---

## MCP, in one slide

* **JSON-RPC 2.0 over HTTP**, one endpoint. A client — an editor, an agent — asks a server what tools it has, and calls them
* **Four methods are the whole of what this server answers**: `initialize`, `ping`, `tools/list`, `tools/call`
* Resources, prompts, sampling, elicitation — **undeclared**, and answered `-32601`

<p class="exlbl">the entire declared capability surface</p>
<p class="ex">"capabilities": { "tools": {} }</p>

> A server may send only what it has declared. **This one declares its tools and nothing else** — so everything in the next hour is either a tool call, or the machinery that keeps one alive.

<!--
Deliberately not a diagram. The orienting picture of the deployment belongs to section 3, where
the fork and the detach are the subject, and the request picture belongs to section 4, where it is
walked line by line. Drawing either here would spend 45 seconds to say worse what a later section
says properly.

The four-method surface is smaller than people expect and that is worth landing early: it is why
the interesting parts of this project are all GemStone parts. There is very little protocol to get
wrong.

`notifications/*` is the fifth thing that arrives and the reason it is not in the list: a
notification has no id, so it gets no response at all -- the dispatcher answers nil and the
transport sends 202. That is JSON-RPC, not an MCP rule.

On what is NOT declared, if asked: tools/listChanged (no session's tool surface changes after
initialize), resources, prompts, completions -- none of which exist here. `logging` was declared
until 2026-08-27 and was removed rather than left as a promise nothing would keep. Progress needs
no declaration at all: it is a base-protocol utility a client opts into per REQUEST by putting a
progressToken in _meta, so there has never been anything for a server to advertise.
-->

---

## What is different here

* It runs **inside the image**. No Node process, no GCI bridge, no FFI
* The thing that executes `execute_code` is **a gem**. The thing that owns the socket is **a gem**

That single decision is where every interesting consequence in this talk comes from:

> a session is a **login** · a session is a **transaction view** · a view is a **commit record the stone cannot dispose of**

* It exists to replace the **GCI-based Jasper MCP server**, with something **any** MCP client can reach over plain HTTP

<span class="fine">**Standing rule for the first half:** the healthy path only — no commit-record pressure, no timeouts, no pending ledger, no progress notifications, no auth. Every one of those is a later section.</span>

<!--
The three consequences in the blockquote are the spine of sections 7, 8 and 9. Read them slowly;
they are the only thing on this slide anyone needs to carry forward.

"A view is a commit record the stone cannot dispose of" is the one that turns a convenience into a
design constraint, and it is why section 8 exists at all. An idle MCP client is not free here the
way an idle HTTP connection is free in a web server.

Say the standing rule out loud rather than leaving it on the slide. This audience will otherwise
spend the healthy-path half waiting for the caveat, and ask about failure modes in section 4 that
section 7 answers properly.
-->

---

## Status, honestly

**Built, and verified end to end** — by curl, by a TLS run, and by the in-image suites:

* Streamable HTTP transport · **per-client worker gems** · **31 base tools** (+9 optional Python)
* OAuth 2.1 / JWT bearer tokens, and TLS

**Two things on that list I am not going to sell you:**

* **Read-only mode** is a **tool gate, not an access-control boundary** — a localhost convenience so one user cannot mutate by accident. A read-only session still costs a login and still holds a view (§11)
* **Server-initiated messages** are built, and this server needs them — every count in §8 rests on them — but the `2026-07-28` draft removes that direction outright. **Machinery, not a feature** (§13)

<!--
The honesty on this slide is the point of the slide, and it is worth the seconds. The README's own
status line currently reads both of these as features and is the thing to correct.

Read-only mode: the honest framing is the one section 11 gives -- gated tools are never registered
for a read-only worker, so they are hidden from tools/list rather than refused on call, which is
stronger than it sounds. But underneath it is still an ordinary read-write GemStone login. A
read-only DATABASE login, or a user whose privileges cannot write, is what would make it a
boundary, and that is a question for this room.

Server-initiated messages: the draft says it plainly -- "servers do not initiate JSON-RPC requests
and clients do not send JSON-RPC responses". That deletes server-initiated ping, which is what
section 8's idleness counting is made of, and deletes the reason the pending-request table exists.
It is not built wrong; it is built for the era that is ending. Section 13 has the worked answer,
including which half of section 8 survives (the reaping policy, which is a GemStone question) and
which half does not (the evidence underneath it, which is a protocol question).

If asked "so why build it": because it is what the clients in the room actually speak today.
Claude Code sends a session id, opens the GET stream, answers pings, and hands over a progressToken
on every call.

Point at README's Future work for what is not built, rather than reading a second list here.
-->

---

## There is nothing to install but topaz file-outs

| group | classes | what | when |
|---|---|---|---|
| `src/core/` | 21 | protocol, transport, dispatch, the seven toolsets | always |
| `src/tests/` | 26 | the SUnit suites and their fixtures | always |
| `src/auth/` | 3 | `McpAuthRouter` + its two suites | 3.7.5+ |
| `src/grail/` | 2 | the optional Python toolset + its suite | `--grail` |

* **One `.gs` file per class, canonical `fileOutClass` output.** No Rowan, no Tonel, no package manager
* It files into any image topaz can log into — and the tree **round-trips byte-exact**, so a regenerated-vs-repo diff is a trustworthy signal
* **`Mcp` is the home dictionary**, not `Published`. A user provisioned for MCP needs it in their symbol list

<span class="fine">`install.sh` picks the groups by **probing the image rather than asking**: `src/auth` needs `JsonWebToken` and `JwtSecurityData`, neither of which exists before 3.7.5.</span>

<!--
Spend no time defending the absence of a package manager; state it and move on. The audience this
matters to is the one that has to file it into an image on a customer machine.

The byte-exact round trip is the part worth one extra sentence, because it is what makes the
rule enforceable: file the class out canonically, diff against the repo, and a difference means a
real difference. Hand-editing a method block into a .gs file is how that property gets lost, and
it is the first thing in the contributor guide.

The counts are classes, not files -- each group also carries its own load.gs, which is the next
slide.
-->

---

## Each `load.gs` pre-declares its class names, bound to `nil`

The classes reference each other **in both directions** — `McpDispatcher` asks `McpServer` for its name, `McpServer` builds an `McpDispatcher` — so **no file order puts every class ahead of its first mention**.

```smalltalk
names := #( #McpError #McpTool #McpToolRegistry ... #McpSession #McpRouter ).
names do: [:s | (d includesKey: s) ifFalse: [ d at: s put: nil ] ].
```

**Why a nil binding is enough:** the compiler binds a global by its **association**, and each class definition fills *that same association* in. A method compiled before its referent exists still ends up pointing at the real class.

<span class="fine">Existing keys are left alone, so re-installing over a loaded image changes nothing.</span>

<!--
A slide of its own for this audience, and only for this audience. It is four lines of loader code,
but it is the one place where the file-in depends on something about the compiler rather than
about the project -- and the people in this room are the ones who would otherwise ask why the
loader does not simply topologically sort the files. It cannot: the graph has cycles.

Without the pre-declaration the compiler reports `undefined symbol` and the file-in STOPS, which is
at least loud. The quiet version of this failure is the one in the contributor guide: a lost `%`
after a merge drops a method with errorcount still reading 0.

The dictionary itself is created self-referenced if absent -- a SymbolDictionary's name IS the key
inside it whose value is itself -- and appended to the symbol list. install.sh does that too; the
loader repeats it so a run by hand on a fresh image still works.
-->

---

## Which gem runs your code decides how it gets refreshed

| | class | gem | picks up a recompile |
|---|---|---|---|
| **front end** | `McpRouter` / `McpAuthRouter`, `McpHttpConnection` | one **detached** gem owning the listen socket | within **two** maintenance passes (60s each) |
| **worker** | `McpServer`, `McpDispatcher`, the `Mcp*Toolset` classes | **one per client session** | **next request** |
| **driver** | the suites | whatever topaz or MCP session you are in | **immediately** |

**This is the table that answers "why did my fix not take".** A transport fix that will not take while tool-layer fixes go live is usually just the front end not having reached its next pass.

`./stop-server.sh && ./run-server.sh` is the only way to be *certain* which code a running server is on.

<!--
Leave this one on screen a beat longer than it needs. It is the table I would put on the wall of
anyone working on this, and every row of it is a section: the front end is 3 and 8, the worker is
4 and 5, the driver is 1.

The worker picks up a recompile on the next request because the dispatcher ABORTS before each tool
call -- so it is not that anything reloads, it is that the worker's view moves and the new method
is simply what is there. Section 5.

Two passes rather than one for the front end, because the pass that notices is not necessarily the
pass that acts -- worth saying only if someone asks why it is not "within 60 seconds".

If a fix seems not to have taken: check the gem's start time before checking the code. That is the
cheaper test and it is right more often.
-->

---

## How it is verified

* **`./run-unit-tests.sh`** — the in-image suites, **each in its own topaz session**, so one that blows up is reported by name rather than silencing the run. **466** base · **522** with auth · **about 570** with Grail
* **`./test.sh`** — the only check that drives the tools **over the wire**. Nothing in the unit suites covers the transport, so a break there is otherwise silent
* **`./test-tls.sh`** — the same transport over HTTPS, with a throwaway cert set **only in the forked gem's session, never committed**
* **GitHub Actions** installs **3.7.5 from scratch** on `ubuntu-latest` — fresh extent, stone, netldi, **with and without Grail** — and runs all three

> For a project with no package manager the question is *what proves it still files in.* That is the workflow's job, not mine.

<span class="fine">**Seven suites need a netldi**, because they spawn real worker gems — no new burden, since this server cannot serve one request without one.</span>

<!--
Give the exact numbers from the morning's run, not these. The Grail figure moved TWICE on
2026-09-10 alone -- 39 to 44 to 51 tests -- while the base and auth numbers did not budge, so
"about 570" is the honest thing to have on a slide and the live run is the precise answer if
anyone asks.

Per-suite topaz sessions are worth the extra sentence if there is time: it is the difference
between a broken suite being reported by name and a broken suite taking the report down with it.
Failures are named individually and the output is coloured for CI.

Two suites are written to fail on purpose, and both belong to later sections rather than here:
McpExternalSessionTest fails on an unsupported image BECAUSE that is how the suite reports the
image (section 12), and McpConcurrentEditTest>>testTheStoneAloneWouldAllowThatClobber is written
to fail on GOOD news (section 7). Mention that they exist; do not spend them here.

The netldi seven: McpAuthTest, McpAuthConformanceTest, McpExternalSessionTest, McpTransactionTest,
McpWorkerDeadlineTest, McpConcurrentEditTest, and -- since the merge of 2026-09-10 -- McpGrail
ToolsetTest, because run_python_tests now forks the gem it runs Grail's classes in. They also need
spare LOGIN SLOTS, which is the likeliest cause of a failure that has nothing to do with the code.

The lint job over the workflows themselves (actionlint, zizmor) is not worth a sentence unless
somebody asks what else CI does.
-->

---

<!-- _class: demo -->

# DEMO A — install, from nothing

```bash
./install.sh --check
./install.sh
```

1. The **environment report** — `GEMSTONE`, the stone, the netldi, and `GEMSTONE_GLOBAL_DIR`
2. The **group selection deciding itself**: auth in or out by probing the image for `JsonWebToken`
3. File-in, group by group, and one commit

<span class="fine">**`GEMSTONE_GLOBAL_DIR` is the variable that decides whether anything works.** Get it wrong and you get `getaddrinfo failed, EAI error 8 ... Number: 4065`, which reads like DNS and is not. `--check` is the first thing to run on a new machine.</span>

<span class="fine">**60 seconds, hard stop.**</span>

<!--
The demo is here rather than after section 2 because it is the only one that costs nothing to
stage: no server, no second gem, no timing. If the room is still settling, this is the demo to
stretch; if we are already behind, it is the one to cut to a single `--check`.

What to point at while it scrolls: the line where it decides about auth. That is the whole version
story in one line of output, and section 12 will come back to it.

Do NOT get drawn into GEMSTONE_GLOBAL_DIR here beyond the one sentence. The full version is in the
README and it is a ten-minute conversation: netldi and stone each bind an ephemeral port and record
it under that directory, /etc/services is a trap rather than a fix, and install.sh logs in linked
(-l) specifically so it needs no netldi at all.
-->

---

<!--
================================================================================
VERTICAL SLICE 4 -- sections 2 and 3: starting a server, and the fork. Nine
slides -- a lead, three for section 2, four for section 3, the last of them demo
B. Cut 2026-09-11: second in running order, fourth to be cut.

Running order and plans, in seconds -- lead 10; config on an instance 30, what
initialize seeds 35, the tool surface 45 (110s, section 2); the one fact + the
deployment picture 50, forkOnPort: 45, in the child 40, the banner 30,
transactionless 50 (215s, section 3); demo B 90. About 7 minutes.

THE THESIS OF THE PAIR is one sentence and the lead says it: a server is a gem,
started by evaluating an expression, configured entirely on an instance, and
detached. Nothing about it is committed and nothing about it is a fact about the
image -- which is what lets several differently-configured routers serve one
stone at once, and is also why there is no file on disk to read afterwards (hence
the banner slide).

Section 2 is the cheap half and should be run fast. Section 3 is where this
audience is, and the slide that lands is "a gem executes no Smalltalk while it is
idle" -- it is the reason the architecture is shaped this way rather than a
preference, and the room knows it is true before you say it. It is a CALLBACK
slide: section 6 and section 8 each come back to it, and section 8's own notes
already point here.

THE DEPLOYMENT DIAGRAM LIVES HERE, on purpose, and it is the first picture in the
deck. Slice 3 deliberately drew nothing so this one would land: sections 0 and 1
described three kinds of gem in a table, and this is that table as a picture, at
the moment the reader first needs to hold all three at once. The request picture
is section 4's and stays there.

DEPARTURES from docs/Presentation.md:
  * the outline gives section 2 two slides; it gets three. The extra one is the
    tool surface, which the merge of 2026-09-11 (33974ec) turned from a bullet
    into an argument -- see the next paragraph.
  * the outline gives section 3 "2-3 slides"; it gets four plus the demo. The
    banner is a slide of its own because it is the only artefact that records
    what a running router was told, and because DEMO B is nothing but that banner
    on a projector.
  * the outline's forkOnPort: step 2 carries a 3.7.2-compatibility aside -- the
    long-way spelling of newDefaultForGemHost: and useOnetimePassword. The slide
    does not mention it at all, because the code is being changed to the 3.7.5
    spelling and there will be nothing left to explain. Step 2 reads as what it
    does: same user, one-time password, valid 300s, which is true either way.
    Section 12.3 still owns whatever the old floor left behind.

WHAT CHANGED ON 2026-09-11 and what the deck now says. McpServer class>>installed
DefaultToolsetNames is GONE: the default surface no longer probes the symbol list
for McpGrailToolset, so nothing joins a server's tool surface by being loaded.
The outline still describes the probe in section 2 and MUST be corrected. Two
consequences the slides take:
  * section 2 gains slide 3, whose argument is that configuring a toolset now
    looks the same whoever wrote it;
  * section 10 ("a server for YOUR software") gets a worked example it did not
    have -- McpGrailToolset is now wired exactly as a third party's would be, so
    section 10 can say "copy this" and mean it literally. Slide 3's last line is
    the forward reference; do not spend section 10's argument here.
Breaking, pre-release, and called out rather than shimmed: a Grail server's
run-server.sh line needs MCP_TOOLSETS or it comes up with 31 tools instead of 40.
================================================================================
-->

<!-- _class: lead -->

# Starting a server

### A gem, forked and detached, whose main activity is the accept loop

<br>

**§2–3** · nothing here is committed, and nothing here is a fact about the image

<!--
Where we are: section 1 said there are three kinds of gem and showed the table.
This pair is the first of them being born. Sections 4 and 5 are the second.

Say the thesis before the first slide, because it makes the rest of the pair
coherent and it is the part this audience will test: a server is an EXPRESSION
someone evaluated. There is no server object in the repository, no configuration
file, no installed service. Kill the gem and there is nothing left to clean up.

Seven minutes for the pair including the demo. Section 2 is the half to run fast;
section 3 is the half this room came for.

If we are behind: this lead slide is the first thing to cut in the whole deck.
-->

---

## All the config is on an instance. None of it is committed

`run-server.sh` is a here-doc into `topaz -l`. Stripped of the environment handling, the whole of it:

```smalltalk
| r |
r := McpRouter new.
r readOnly: false.
"…any MCP_* setters the environment asked for…"
r forkOnPort: 8000
```

* **There is no class-side config state.** A launch script or a test reconfigures the *instance*; `forkOnPort:` serializes it into the child gem's fork string as JSON
* So **several differently-configured routers can serve one stone at once** — a read-only one on 8001, an authenticated one on 8443 — and none of them is a fact about the image
* What travels in that string is **paths and identifiers only, never key material**

<span class="fine">The other ~200 lines of the script are environment handling, a port-in-use check, and turning `MCP_*` into setter lines. The five above are the program.</span>

<!--
Run this slide fast. It exists so that nobody spends the rest of the hour looking
for the config file, and it is worth exactly that much.

The claim to make explicitly, because it is unusual enough to be worth saying out
loud: there is no server object in the repository. Nothing was committed when this
started. If you want to know what a running server was told, you read its gem log
-- which is why the banner gets a slide of its own in a moment.

`readOnly:` is on the slide only because the script always writes it. Section 11
is the one-slide answer to what it does; do not take the question here beyond "it
hides and refuses the mutating tools, and it is a convenience rather than a
boundary".

If someone asks why not a config file: the fork string IS the config file, and it
has the property a file does not -- it cannot drift from the process that is
running. Two routers on one stone would need two files and a way to say which.
-->

---

## What `initialize` seeds, and why the rest stays `nil`

**The rule:** seed a field when `nil` would be unsafe, **or when `nil` is itself a setting**.

| what it bounds | seeded defaults |
|---|---|
| concurrency | `maxSessions` **3** — `nil` would mean *no cap*, which is a setting in itself |
| session lifetime | `sessionIdleTimeoutSeconds` 1800 · `livenessProbeIntervalSeconds` 120 · `reaperIntervalSeconds` 60 · two stream deadlines, 60 and 10 (§8) |
| view hygiene (§8) | `maxCommitsBehind` 20 · `stuckViewGraceSeconds` 60 · `pinnedViewGraceSeconds` 300 |
| this gem (§3) | `frontEndTransactionMode` `transactionless` |
| security | `allowedOriginHosts` loopback · `messageTrace` **false** |
| **left `nil`** = off | `requestTimeoutSeconds` — **no request deadline by default**, and §8 is why · `maxSessionLifetimeSeconds` · `toolsetOptions` · the TLS files |

<span class="fine">`validateTimerConfig` refuses any interval whose *count* would round to something other than what was written. §8: why all of this is counted rather than timed.</span>

<!--
Do not read the table. Say the rule, let them scan, and move on -- the numbers
are all on later slides where they matter, and this one is here so that section 8
does not have to stop and explain where 20 came from. maintenanceCallTimeoutSeconds
(5), streamlessIdleTimeoutSeconds (60) and streamLossGraceSeconds (10) are the
three seeded values not spelled out, for room; section 8 introduces all three
where they are used.

The awkward cases are the ones where nil is MEANINGFUL, and they are worth the
extra sentence if there is time. maxSessions nil is "no cap at all". maxCommits
Behind nil is "view hygiene off". Neither could double as "use the default", so
both are seeded, and the class comment says so at each one.

The rule is the slide, and it is worth one extra sentence if there is time: the
awkward cases are the ones where nil is MEANINGFUL. maxSessions nil is "no cap at
all". maxCommitsBehind nil is "view hygiene off". Neither could double as "use the
default", so both are seeded, and the class comment says so at each one.

messageTrace false is a security default, not a performance one: a traced log
records every tool argument every client sent -- a compile_method body, an
execute_code body -- and an operator has to CHOOSE that rather than discover it.
The cap on each traced body is not optional for the same reason.

requestTimeoutSeconds nil is the one that draws a question. The honest answer is
section 8's and it is one sentence: a deadline on the front end cannot stop the
work, it can only stop waiting for it, which left the gem running and the client
told it had failed. Promise section 8 and move on.
-->

---

## The tool surface is **named**, never discovered

`workerClassName` `nil` → `McpServer`; `toolsetNames` `nil` → `defaultToolsetNames` — **the core seven, and nothing else.**

> **Changed this week.** The default used to probe the symbol list and append `McpGrailToolset` whenever `src/grail/` had been filed in. So *installing* the group configured every server in the image.

* An optional toolset can carry a dependency the image knows nothing about — Grail's tools read the `.py` checkout that `grailDirectory` names, so such a server was **answering for a directory nobody chose**
* And **turning a toolset on should look the same whoever wrote it.** With the probe gone, `McpGrailToolset` is wired exactly as a third party's would be — which makes it the worked example §10 can tell you to copy

`MCP_TOOLSETS` names the surface — the core seven **plus** yours. `MCP_GRAIL_DIR` only *configures* it; `validateWorkerConfig` refuses to start a router holding options for a toolset it does not serve.

<span class="fine">Resolved **per session, in the front end**: a toolset filed in after startup reaches the next client, and (§9) an authenticated router can narrow the list per principal — only possible on the side that holds the token. **31 tools by default, 40 when Grail is named.**</span>

<!--
This slide is four days old and it replaced a bullet. Say the change out loud --
this room may have read the README before the probe came out -- and say which way
it broke: a Grail server's launch line now needs MCP_TOOLSETS or it comes up with
31 tools instead of 40. Pre-release, so it is called out rather than shimmed.

Nothing silently degrades, which is the part that makes it a safe break: the
tools are ABSENT from tools/list rather than present and failing. A client cannot
call what it was never offered. The sharpest version of the old behaviour, if you
want it: on an image where MCP_GRAIL_DIR had never been set, every server in the
image advertised nine tools that could not work.

The second bullet is the one that matters for the rest of the hour, and it is why
this is a slide rather than a footnote. Before the merge, the only optional
toolset in the tree was wired by a mechanism nobody else could use -- so section
10 had to describe how you WOULD add a toolset. Now McpGrailToolset is the worked
example: nine tools, its own options, its own suite, and not one line of special
handling anywhere in core. Section 10 can say "copy this". Do NOT spend that
argument here; one sentence and the forward reference.

If asked why the probe existed at all: convenience, and it was wrong for a
reason worth naming -- installing something and running it are different
decisions, and conflating them meant an operator who had never heard of Grail was
serving its tools.

McpContractTest pins this in the CORE suite rather than the Grail one, which is
the right place for it: the property is that an unconfigured router's surface
does not depend on which optional groups the image happens to carry, so it has to
be asserted on an image that carries them.
-->

---

## A gem executes no Smalltalk while it is idle

<div style="text-align:center">
<svg viewBox="0 0 960 212" width="900" role="img" aria-label="Deployment: a launching topaz session forks and detaches a front-end gem, which owns the listen socket, the reaper and the signal poller, and runs transactionless; that gem logs in one worker gem per client session over GCI. The launching session then logs out and the child keeps serving.">
  <defs>
    <marker id="m2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="currentColor"/>
    </marker>
  </defs>
  <!-- the launching session -->
  <rect x="10" y="65" width="160" height="64" rx="4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="6 4" opacity=".75"/>
  <text x="90" y="92" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">topaz -l</text>
  <text x="90" y="113" font-size="13" text-anchor="middle" fill="currentColor" opacity=".7">run-server.sh</text>
  <text x="90" y="152" font-size="13" text-anchor="middle" fill="currentColor" opacity=".62">logs out, and the</text>
  <text x="90" y="170" font-size="13" text-anchor="middle" fill="currentColor" opacity=".62">child keeps serving</text>
  <!-- fork arrow -->
  <line x1="172" y1="97" x2="294" y2="97" stroke="currentColor" stroke-width="1.5" marker-end="url(#m2)"/>
  <text x="233" y="76" font-size="13" text-anchor="middle" fill="currentColor" opacity=".8">fork + detach</text>
  <text x="233" y="118" font-size="13" text-anchor="middle" fill="currentColor" opacity=".8">config as JSON</text>
  <!-- the front end -->
  <rect x="298" y="42" width="322" height="110" rx="4" fill="none" stroke="currentColor" stroke-width="1.9"/>
  <text x="459" y="66" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">detached gem &#8212; McpRouter:8000</text>
  <text x="459" y="92" font-size="14" text-anchor="middle" fill="currentColor">accept loop &#8212; the gem&#8217;s <tspan font-style="italic">blocking main activity</tspan></text>
  <text x="459" y="114" font-size="14" text-anchor="middle" fill="currentColor">reaper (&#167;8) &#183; signal poller (&#167;6)</text>
  <text x="459" y="136" font-size="14" text-anchor="middle" fill="#b4451f" font-weight="600">transactionless</text>
  <!-- workers -->
  <line x1="622" y1="97" x2="694" y2="66" stroke="currentColor" stroke-width="1.4" marker-end="url(#m2)"/>
  <line x1="622" y1="97" x2="694" y2="97" stroke="currentColor" stroke-width="1.4" marker-end="url(#m2)"/>
  <line x1="622" y1="97" x2="694" y2="128" stroke="currentColor" stroke-width="1.4" marker-end="url(#m2)"/>
  <rect x="698" y="50" width="248" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="1.4"/>
  <rect x="698" y="82" width="248" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="1.4"/>
  <rect x="698" y="114" width="248" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="1.4"/>
  <text x="822" y="71" font-size="14" text-anchor="middle" fill="currentColor">worker gem &#8212; McpServer</text>
  <text x="822" y="103" font-size="14" text-anchor="middle" fill="currentColor">worker gem &#8212; McpServer</text>
  <text x="822" y="135" font-size="14" text-anchor="middle" fill="currentColor">worker gem &#8212; McpServer</text>
  <text x="822" y="166" font-size="13" text-anchor="middle" fill="currentColor" opacity=".7">one per client session: a login, a view,</text>
  <text x="822" y="184" font-size="13" text-anchor="middle" fill="currentColor" opacity=".7">a commit record the stone cannot dispose of</text>
  <text x="659" y="90" font-size="12" text-anchor="middle" fill="currentColor" opacity=".6">GCI</text>
</svg>
</div>

> A forked `GsProcess` runs only while its gem is **actively executing Smalltalk**. A GCI-driven session is parked in the C client between commands, so an accept loop forked there is frozen and never serves a request.

**Therefore the accept loop must be a dedicated gem's blocking main activity.** The same fact decides two more things later: the front end must own the client's stream (§6), and the front end must own view hygiene (§8) — because **only the front end has a heartbeat.**

<!--
This is the slide that lands with this audience, and the only one in the pair
worth slowing down for. They know the fact is true; what they have not
necessarily done is follow it to three separate conclusions. Say it once, put the
picture up, and promise the other two.

The third conclusion is the interesting one and section 8 spends it properly, so
do not do it here -- but have the sentence ready if somebody jumps ahead, because
somebody will. On every OTHER count the worker is the better-informed party: it
can read its own commits-behind, the stone's backlog, whether it holds the oldest
commit record, and needsCommit, none of which the front end can see. The action
still belongs to the front end because the problem case is precisely the IDLE
worker holding a stale view -- the one moment that worker cannot run a line of
code.

The picture is the section 1 table with the boxes drawn. Point at the three parts
in order: one gem owning the socket, three GsProcesses inside it, one worker gem
per client. Then point at "transactionless" and say it is the last slide of this
section.

The dashed box is the launching session and the dash is the point -- it is gone
by the time anything is served. If someone asks what happens to the workers when
the front end dies: every attached worker dies with the process owning its GCI
connection, which is also why ./stop-server.sh leaks nothing. That is section 8's
material; one sentence here at most.
-->

---

## `McpRouter>>forkOnPort:`, in order

1. `validateWorkerConfig` + `validateTimerConfig` — **in the launching session, not just the child**
2. Build a `GsTsExternalSession`: **same user, one-time password**, valid 300s
3. `login`
4. **Capture `stoneSessionId` and the host pid _before_ launching the loop** — once the non-blocking call is running, the external session refuses further queries (`GciError`, *operation in progress*)
5. `forkAndDetachString: 'McpRouter runOnPort: 8000 configJson: ''{…}'''`
6. `logout` the handle — **the child is independent**
7. Answer a status string carrying **three ways to stop it**: `./stop-server.sh` (by port), `System stopSession: <id>` (from any session), `kill <pid>` (shell)

Step 1 is the one that earns its keep: without it the operator sees a cheerful *“forked into gem session 42”* and **a port that never opens**, with the reason buried in a detached gem's log.

<!--
Two things on this slide are worth the room's time and the rest is narration.

Step 4 is the ordering constraint: it is not obvious, it cost time, and it is
exactly the kind of thing this audience will have hit. Once forkAndDetachString:
is running, the external session will not answer stoneSessionId -- so the id and
the pid have to be taken while the child is still idle. Get it backwards and the
operator gets a server with no way to name it.

Step 1 is the argument for validating twice. Say the failure mode rather than the
principle: a validation that only runs in the child produces a successful-looking
launch and a dead port.

Step 7 matters more than it looks. There is no pid file and no service manager, so
the status string IS the record -- and it is printed once, to the terminal that
launched it. stop-server.sh finds the gem by port with lsof, which is the only one
of the three that still works an hour later when the terminal is gone.

If asked about the one-time password: the child logs in as the same GemStone user
as the launching session, with a credential valid for 300 seconds and usable once.
No password is written into the fork string, which is the whole point -- the fork
string is visible to anything that can read the session's arguments.
-->

---

## Then, in the child: bind, name, fork, loop

`McpRouter class>>runOnPort:configJson:` → `applyConfigJson:` → `applyFrontEndTransactionMode` → the instance-side `runOnPort:`

* `makeListenerOnPort:` — **loopback only**, and `bindAddress` has **no setter on the base class**: a base `McpRouter` authenticates nothing, so a reachable port would be an open door into the repository. `McpAuthRouter` is the class that adds one (§9)
* `nameThisGem: 'McpRouter:8000'` — **after the bind.** A gem that failed to take the port is not this server
* `forkReaper` (§8) + `forkSignalPoller` (§6) — two `GsProcess`es, running *during the loop's waits*

```smalltalk
[isRunning] whileTrue: [
  (serverSocket readWillNotBlockWithin: 500) == true ifTrue: [
    client := serverSocket accept.
    client ifNotNil: [self serve: client]]]
```

Gated on **readiness**, not `acceptTimeoutMs:` — for a `GsSecureSocket` listener `acceptTimeoutMs:` *raises* on an idle timeout, and would kill the loop every 500ms.

<!--
Three practical facts, in descending order of how likely they are to be asked
about.

The listener is loopback and cannot be told otherwise. That is a class-shaped
decision rather than a configuration one, and it is deliberate: to get a reachable
port you must instantiate a different class, one that requires a bearer token and
enforces TLS. Section 9. If the answer stops there, good.

The 500ms readiness gate is a GsSecureSocket bug story in one line, and it is
worth telling only if the room looks interested: acceptTimeoutMs: treats the nil a
plain socket returns on an idle timeout as a failure and raises, so the obvious
spelling of this loop dies twice a second on TLS and works fine on plain HTTP.
readWillNotBlockWithin: behaves identically for both.

Naming after the bind is thirty seconds of DBA goodwill: the name is what makes
the gem findable in System cacheStatisticsForAllSlots, and it would be actively
misleading on a gem that never got the port.

Have this ready if anyone is reading along in the source and asks why the
transaction mode is applied in the CLASS-side runOnPort:configJson: and nowhere
else. That is the only way in that owns its session outright -- the gem was forked
to evaluate this expression and does nothing afterwards. The instance-side
runOnPort: runs in an interactive topaz, in YOUR session, and applying the mode
there would abort and silently discard your uncommitted work. It is the difference
between a method that owns its gem and one that is a guest in yours.
-->

---

## The banner is the only record of what this router was told

Nothing is committed and nothing is on disk, so the gem log **is** the configuration. Seven lines, written after the bind:

* listening address and scheme · **workers and toolsets** — the surface §2 resolved
* session lifetime · concurrent-session cap (its own line: *how many at once* is a different question from *how long each lasts*)
* **shared cache name, read back from the cache** — so the log and `System cacheStatisticsForAllSlots` cannot disagree; a name too long arrives truncated
* **transaction mode as the gem reports it**, not as it was configured
* view hygiene, in full (§8) · and the trace line **only when tracing is on**

> A reader has to be able to tell a **quiet** server from an **untraced** one. Otherwise an absence of message lines reads as an absence of traffic, which is the wrong conclusion and the expensive one.

<span class="fine">Find the log with `lsof -nP -iTCP:8000 -sTCP:LISTEN`.</span>

<!--
This slide is here because the demo is about to be this slide, and because it is
the answer to the question section 2 raised and left open: if nothing is
committed, how do you find out what a running server is doing?

The two "read it back rather than report it" lines are the ones worth pointing
at, and they are the same idea twice. The banner must say what IS, not what was
intended -- because the two diverge in exactly the cases an operator is reading
the log to understand. A cache name over 31 characters is truncated; a
transactionless mode that could not be set leaves the gem in whatever mode it
logged in with, logged at the time with the reason.

The transaction-mode line is also the one that tells you whether the once-a-pass
abort is releasing a commit record or re-pinning a fresh one. That is the next
slide.

The blockquote is a small thing that generalises well, and if the room is warm it
is worth ten seconds: silence is ambiguous, so a log has to say when it is not
recording. It applies to more of this server than the trace line.
-->

---

## The front end runs `transactionless` — and what that costs

**Why:** a front-end gem left in transaction sat on the stone's **oldest commit record for 15 hours**, its last transaction boundary its own login — and *nothing stone-side could ever have moved it*. An in-transaction gem is immune to `sigAbort` unless it asked not to be.

**So:** the mode at startup, and an abort at the top of **every maintenance pass** (`refreshFrontEndView`). It holds no commit record longer than one interval.

* **The price: front-end code must not read persistent object graphs.** No walking a committed collection, no caching a persistent object across statements. Stone primitives and lookups by name are fine — the class comment says so in capitals
* **The payoff, the same fact from the other side:** a committed recompile of front-end code **takes effect in a running server**, within two passes. That is the answer to *“my transport fix didn't take”* — wait one pass, then check the gem's start time

`refreshFrontEndView` also carries a **bug detector**. Out of transaction, a write to a committed object is allowed, sets `needsCommit`, and is then discarded by the abort with **no error raised anywhere**. The front end writes nothing today; if that ever stops being true, that log line is the only thing that will say so.

<!--
The measurement is the slide. Fifteen hours, one gem, and the stone with no way
to move it -- that number is why the mode is not a preference, and this audience
will recognise the shape of the problem immediately.

Say the asymmetry plainly, because it is the part that surprises: the stone's
sigAbort mechanism, which exists precisely for this, fires only when the backlog
is over StnSignalAbortCrBacklog AND the session is on the oldest record AND the
session is not in a transaction. The gem that is hurting you most is the one
least reachable.

The price and the payoff are the same property and it is worth saying so. A gem
that cannot hold a view across statements is a gem whose code is re-read from the
repository constantly -- which is why a recompile lands in a running server, and
also why front-end code that cached a persistent object would be reading
something that no longer exists.

The bug detector is the best small thing in this section and takes fifteen
seconds. Out of transaction, the mistake that would raise 2030 at commit time in
an ordinary gem raises NOTHING -- the write is simply discarded. A one-line check
at the top of each pass is the whole defence, and it has never fired.

If asked "so what if the mode cannot be set": it is logged and swallowed. A front
end that could not get the mode is still a working front end, just one that pins
a commit record; refusing to serve for that reason would be the worse trade. The
failure that actually happens is transactionless in a SOLO session -- the
repository open by this gem alone -- which is no way to run a server but is
exactly how someone tries one out.
-->

---

<!-- _class: demo -->

# DEMO B — a server, from a here-doc

```bash
./run-server.sh
lsof -nP -iTCP:8000 -sTCP:LISTEN     # find the gem, and its log
```

1. The script returns immediately — and prints **the session id, the host pid, and three ways to stop it**
2. `tail` the gem log: **the banner**, the whole configuration of a server that has nothing on disk
3. `System cacheStatisticsForAllSlotsShort` — **`McpRouter:8000`**, alone, with no workers yet

<span class="fine">Leave the `tail -f` running. DEMO C adds the worker rows to the same cache statistics, and DEMO F reads view hygiene out of this same log.</span>

<span class="fine">**90 seconds.**</span>

<!--
Have the log path resolved BEFORE the talk and the lsof line in scrollback -- the
one-liner is the demo's only fragile part, and hunting for a gem log on a
projector is dead air.

What to point at, in order: the three stop lines (there is no pid file, this is
the record), then the toolsets line in the banner -- which is section 2's slide
three, live, and the moment to say "seven toolsets, thirty-one tools, and Grail
is not among them because I did not name it". If the demo machine has a Grail
checkout, having a SECOND server on 8001 with MCP_TOOLSETS set is a thirty-second
addition that makes the point better than any slide: same image, two servers,
different surfaces.

Then the single cache row. It is worth a beat on its own precisely because it is
lonely -- one gem, no workers, nothing else in the repository knows this server
exists. DEMO C is the payoff.

Fallback if the fork fails on stage: the banner is a screenshot, and say so
without apologising. The thing that actually fails here is a netldi that is not
running, which --check would have caught; run install.sh --check in demo A and
this one is already de-risked.
-->

---

<!--
================================================================================
VERTICAL SLICE 5 -- section 4, trace 1: a brand-new client's first request. Ten
slides -- a lead, eight walking the path, and demo C. Cut 2026-09-12: third in
running order, fifth to be cut.

Running order and plans, in seconds -- lead 10; the bytes and the picture 40;
the front door 45; servePost: 40; openSessionCreating: 60; what travels into the
worker 45; the order inside the worker 45; runWorker: 60; the dispatcher answers
40; three ids and the gem names 45 (430s of slides); demo C 120. About 9 minutes,
which is the longest slice in the deck and is meant to be.

THE OUTLINE SAYS 5-7 SLIDES AND THIS IS TEN. Deliberate, and the reason is worth
writing down: section 4 is the only section that earns the right to be slow,
because everything after it is a variation on a path the room has already walked.
Sections 5 and 6 are "the same path, but --", section 8 is the same worker seen
from the front end's clock, and section 7 is what happens inside one tool call.
Walked properly once, all of those get cheaper. Walked in five slides, none of
them do.

WHAT TO CUT IF THE HOUR IS GOING. In order, and none of them takes a later
section with it:
  1. the lead (10s), as everywhere;
  2. "three ids and the gem names" (45s) -- it is the most beautiful slide in the
     section and the least load-bearing. Demo C shows the same table live;
  3. "the dispatcher answers" (40s) -- version negotiation is a fact, not an
     argument, and section 13 re-opens it anyway.
Do NOT cut openSessionCreating: or runWorker:. Those two are the section.

THE REQUEST PICTURE LIVES HERE, which is what slice 3 reserved it for, and it is
a SEQUENCE diagram rather than a deployment one -- slide 14 already drew the
boxes, so this one draws the order. Every later slide in the slice is one band of
it, and the notes name which.

DEPARTURES from docs/Presentation.md:
  * the outline's step 15 (the MCP-Session-Id going back, and what a later
    request must echo) is the last band of the picture and one line of the
    naming slide. Section 5 opens on exactly that header, so spending a slide on
    it here would be paying twice;
  * the outline's step 12 (the four-hop path from class-side handleJsonString:
    to McpJson write:) is speaker notes, not a slide. It is a call chain with no
    decision in it;
  * no slide shows the forward: send, and that is worth knowing when slice 6 is
    cut, because the two sections legitimately send DIFFERENT selectors.
    serveInitialize:on: sends forward:lifetimeBounds: -- an initialize cannot be
    cancelled by a client that has no session id yet, so there is no request id
    to carry. serveCall: sends forward:lifetimeBounds:requestId:, which is
    section 5's. The outline has both right; do not "fix" either into the other.

THE MERGE OF 2026-09-11/12 touches two numbers in this slice. defaultServerVersion
is 0.8.0 now, which nothing on a slide states (it reaches the room only through
serverInfo in demo C). And McpSession>>startWithId:readOnly: sends
useOnetimePassword directly, so the worker login is the plain 3.7.5 spelling --
which is why slide 5's bullet says "one-time password" and explains nothing.
================================================================================
-->

<!-- _class: lead -->

# Trace 1

### One request, from the socket to the `MCP-Session-Id`

<br>

**§4** · a brand-new client, saying `initialize` for the first time

<!--
Where we are: section 3 forked the gem and left it in its accept loop with
nothing to do. This is the first thing that happens to it.

Say what kind of section this is, because it is different from the two before it
and the room should know how to listen. Sections 2 and 3 were configuration.
This is a trace -- one request, in call order, nothing skipped -- and the reason
to spend nine minutes on it is that every later section is this path with one
thing changed. Promise that explicitly.

Kernel-level HTTP and JSON parsing are assumed known and are not on any slide.
This is the mcp_server path only.
-->

---

## The bytes, and the path they take

```
POST /mcp HTTP/1.1
Accept: application/json, text/event-stream
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25",
 "capabilities":{},"clientInfo":{"name":"claude-code","version":"…"}}}
```

<div style="text-align:center">
<svg viewBox="0 0 960 330" width="880" role="img" aria-label="Sequence diagram: the client POSTs initialize to the front-end gem, which forks a GsProcess, reads and traces the request, applies the transport and credential gates, parses only enough to route it, mints a session id and takes a slot, then logs in a new worker gem with a one-time password, prepares it in one round trip, forwards the request with a non-blocking call, and answers the client with the worker's JSON and the MCP-Session-Id header.">
  <defs>
    <marker id="m4" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="currentColor"/>
    </marker>
  </defs>
  <!-- lifeline heads -->
  <rect x="62" y="8" width="156" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="140" y="28" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">client</text>
  <rect x="368" y="8" width="224" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="1.9"/>
  <text x="480" y="28" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem</text>
  <rect x="730" y="8" width="200" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="830" y="28" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">worker gem (new)</text>
  <!-- lifelines -->
  <line x1="140" y1="38" x2="140" y2="322" stroke="currentColor" stroke-width="1" opacity=".45" stroke-dasharray="4 4"/>
  <line x1="480" y1="38" x2="480" y2="322" stroke="currentColor" stroke-width="1.3" opacity=".65"/>
  <line x1="830" y1="38" x2="830" y2="196" stroke="currentColor" stroke-width="1" opacity=".3" stroke-dasharray="3 6"/>
  <line x1="830" y1="196" x2="830" y2="322" stroke="currentColor" stroke-width="1.3" opacity=".65"/>
  <!-- 1: the POST -->
  <line x1="142" y1="64" x2="476" y2="64" stroke="currentColor" stroke-width="1.5" marker-end="url(#m4)"/>
  <text x="309" y="58" font-size="13" text-anchor="middle" fill="currentColor">POST /mcp &#183; initialize</text>
  <!-- 2-5: front-end self calls -->
  <circle cx="480" cy="92" r="3.5" fill="currentColor"/>
  <text x="466" y="97" font-size="13" text-anchor="end" fill="currentColor">serve: forks a GsProcess &#183; readRequest &#183; trace</text>
  <circle cx="480" cy="118" r="3.5" fill="currentColor"/>
  <text x="466" y="123" font-size="13" text-anchor="end" fill="currentColor">route:on: &#8212; Origin &#183; protocol &#183; credential &#183; verb</text>
  <circle cx="480" cy="144" r="3.5" fill="currentColor"/>
  <text x="466" y="149" font-size="13" text-anchor="end" fill="currentColor">servePost: &#8212; only enough of the body to route it</text>
  <circle cx="480" cy="170" r="3.5" fill="#b4451f"/>
  <text x="466" y="175" font-size="13" text-anchor="end" fill="#b4451f" font-weight="600">openSessionCreating: &#8212; mint the id, take the slot</text>
  <!-- 6-8: into the worker -->
  <line x1="482" y1="196" x2="826" y2="196" stroke="currentColor" stroke-width="1.5" marker-end="url(#m4)"/>
  <text x="654" y="190" font-size="13" text-anchor="middle" fill="currentColor">login &#8212; one-time password</text>
  <line x1="482" y1="230" x2="826" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#m4)"/>
  <text x="654" y="224" font-size="13" text-anchor="middle" fill="currentColor">prepareWorker &#8212; one round trip</text>
  <line x1="482" y1="264" x2="826" y2="264" stroke="currentColor" stroke-width="1.5" marker-end="url(#m4)"/>
  <text x="654" y="258" font-size="13" text-anchor="middle" fill="#b4451f" font-weight="600">handleJsonString: &#8212; nbExecute:</text>
  <!-- 9: the return -->
  <line x1="826" y1="292" x2="484" y2="292" stroke="currentColor" stroke-width="1.3" stroke-dasharray="6 4" marker-end="url(#m4)"/>
  <text x="654" y="286" font-size="13" text-anchor="middle" fill="currentColor">the JSON-RPC response, as a String</text>
  <!-- 10: to the client -->
  <line x1="478" y1="318" x2="144" y2="318" stroke="currentColor" stroke-width="1.5" marker-end="url(#m4)"/>
  <text x="309" y="312" font-size="13" text-anchor="middle" fill="currentColor">200 &#183; MCP-Session-Id: 978EC559&#8230;</text>
</svg>
</div>

<!--
Put this up, walk it once in about twenty seconds, and say that the next seven
slides are the bands of it in order. Then leave it: every following slide names
which band it is, so nobody has to hold the whole thing in their head.

Two things to point at now rather than later. The worker lifeline does not exist
at the top of the picture -- this client's gem is created by this request, which
is the fact the whole section is about. And the two red bands are the two slides
that matter: openSessionCreating:, which is where the concurrency lives, and
nbExecute:, which is where the front end's ability to serve anybody else lives.

The Accept header is not decoration. The spec REQUIRES a client to offer both
application/json and text/event-stream, and both real clients do; it is what
keeps a hand-rolled caller that asked for JSON from being handed a stream it
cannot read. curl with no Accept header stays on the plain-JSON path, and so does
every check in test.sh.

protocolVersion 2025-11-25 in the body is the one the room may not have seen. Do
not explain it here -- slide 9 negotiates it.
-->

---

## The front door: a `GsProcess` per connection, then three gates

**`serve:`** — each connection is handled in **its own `GsProcess`**, so a slow client cannot block the accept loop; the forked handler runs during the loop's accept waits.

**`McpHttpConnection>>readRequest`** — one request in, one response out. **Bails after an 8-second read timeout**, so a client that connects and never finishes a request cannot wedge a process.

**`handleConnection:`** — `readRequest` → `traceRequest:` → `route:on:`. Any error is contained and answered **500**; the connection is *always* closed.

> **The trace tap is here on purpose.** This is the only point that sees *every* client message — before the Origin, protocol and credential gates — and a **refused** request is exactly the one an operator is trying to see. **Headers are never traced: one of them is a bearer token.**

**`route:on:`**, in this order: `originAllowed:` → **403** · `protocolVersionAllowed:` → **400** · `requestAuthorized:on:` (the hook; §9) · then the verb table → **405**.

<span class="fine">Transport gates first: they concern the **connection** rather than the principal, and are cheaper. An *absent* `Origin` is allowed — curl, and every non-browser client.</span>

<!--
Bands 2 and 3 of the picture.

The GsProcess per connection is the first half of the concurrency story and
nbExecute: on slide 8 is the other half. Say that now so the room knows a second
shoe is coming: a process per connection is worth nothing if the gem freezes
inside the process, which is exactly what the blocking GCI call used to do.

The blockquote is the one to slow down for, and it generalises: a log that only
records what was ACCEPTED cannot answer the question an operator actually has.
Headers never being traced is the other half of the same decision and needs no
defending -- say it and move on.

If asked why an absent Origin is allowed: Origin is a BROWSER fact. A browser
always sends it, so the DNS-rebinding defence works where the attack exists; a
non-browser client never sends it, and refusing those would refuse curl, Claude
Code, and every check in test.sh while stopping no attack at all.

The 8-second timeout is worth one sentence if anyone asks what happens to a
half-open connection: nil from readRequest, no route, connection closed, process
exits. It costs one GsProcess for at most eight seconds.

Where TLS fits, if asked: serve: completes the server-side handshake BEFORE
building the connection, and a failed handshake closes the socket and serves
nothing -- there is no plaintext fallback. Section 9 is where TLS stops being
optional.
-->

---

## `servePost:` parses only enough of the body to route it

Four questions, in order, and **two of them never reach the worker at all**:

1. an `id` and **no `method`** → a JSON-RPC *response*: the client answering something **this server** sent on its stream. Not routable — the worker's dispatcher would answer it `-32600` — so it is correlated here and acknowledged **202**
2. **`notifications/cancelled` → handled here, never routed.** Routing it would queue it on the session's worker mutex **behind the very call it asks to stop** — measured at **17 seconds on a 20-second call** before this existed
3. `initialize` → `serveInitialize:on:` — the rest of this section
4. anything else → `serveRouted:…` — that is §5

<span class="fine">The **one** exception to "only enough to route it": a `tools/call` carrying a `progressToken` in `params._meta` is answered as an SSE stream rather than one JSON object, and the `Content-Type` has to be chosen **before the worker is called** — so the front end has to look. The worker cannot be what decides how its own answer is framed (§6).</span>

<!--
Band 4. The slide is really one idea -- the front end reads the body to decide
WHERE it goes, not WHAT it means -- plus the two things that turn out not to have
a where.

Question 2 is the one to spend time on, and the number is the argument. Before
this existed a cancellation was routed like everything else, which meant it
queued on the worker mutex behind the call it was asking to stop, and got acted
on -- if the word applies -- once that call had finished on its own. Seventeen
seconds on a twenty-second call. It is handled at the front end because that is
where the session is reachable WITHOUT the worker, which is the whole trick.

Measured 2026-08-31, and worth saying because it is how cancellation actually
arrives today: Claude Code sends notifications/cancelled within seconds of the
user pressing Esc, with the right requestId, and does NOT close the response
stream. So this notification, not a dropped connection, is the real signal.

Question 1 exists because this server sends requests of its own -- the liveness
ping in section 8. The client's ANSWER comes back as a POST like any other, and
it is the one body shape that is a response rather than a request.

The fine line is a forward reference and should be read as one. Do not open
section 6 here.
-->

---

## `openSessionCreating:` — the widest window in the class

```smalltalk
newId := mutex critical: [
  (maxSessions notNil and: [self sessionCount >= maxSessions])
    ifTrue: [nil]
    ifFalse: [sessionsOpening := sessionsOpening + 1. self nextSessionId]].
```

* **Taking the slot and minting the id are one critical section.** The slow part is the **login**, and the front end goes on running other `GsProcess`es across it. **A cap of three cannot be talked past by three clients that all looked before any of them logged in**
* The reservation is a **count**, not a placeholder in the map: nothing may find a half-built session by id, and the count still has to include it. Released in an `ensure:`, whether the session registers or the login fails
* Past the cap: `McpError` kinded `#sessionLimit` → JSON-RPC **`-32001`** in an HTTP 200, bearing the request's own id, **no `MCP-Session-Id`, and no login attempted**
* `nextSessionId` — a cryptographically-random **128-bit** token as hex
* **Registered last** (`sessions at: newId put: sess`), so no request can reach an unprepared worker

<span class="fine">**The only place `maxSessions` is enforced** — `serveInitialize:on:` asks no question of its own. Why there is a cap at all is §8.</span>

<!--
Band 5, the first red one, and the first slide in the section this audience will
want to argue with. Give it the time.

The argument is not "locking is hard". It is that the expensive thing here --
a GemStone login -- is exactly the thing you cannot hold a lock across, because
the front end must keep serving other clients while it happens. So the lock
covers the DECISION and the reservation, and the login happens outside it with
the count standing in for the session that does not exist yet.

Say why a count and not a placeholder, because it is the question a Smalltalker
asks: a placeholder in the map is findable by id, and a half-built session that
can be found is worse than a cap that is briefly approximate. The count is not
approximate -- it is exact and it is inside the same mutex.

The -32001 shape is worth reading out once: HTTP 200, JSON-RPC error, the
request's own id, no session header. It is a protocol-level refusal, not a
transport one, because the transport worked perfectly. And no login was
attempted, which is the part that matters on a stone with a login-slot limit.

If asked why 3: it is a default chosen so that a laptop demo cannot accidentally
open twenty gems, not a tuned number. Section 8 says what it is protecting.
-->

---

## What travels into the worker, and why it travels at all

`McpSession startWithId: newId readOnly:` — `GsTsExternalSession`, **one-time password**, `login`, then `cacheWorkerIds`: the worker's stone session id and host pid, **fetched once, at login**.

Then the front end **pushes what the worker is to be** — its class, its toolsets and their options, the identity it advertises, and its two deadlines — and `prepareWorker` sends **one expression**:

```smalltalk
McpServer prepareWorkerWithToolsets: #('McpBrowsingToolset' 'McpExecutionToolset' …)
  options: nil readOnly: false serverName: nil title: nil version: nil
  frontEnd: 5 cacheName: 'McpServer:5:978EC559'
```

* Every string embedded via **`printString`**, so this cannot smuggle anything into the worker's compiler. Load-bearing for **`title:`** in particular — unlike a name or a version it is free-form operator prose
* Toolset **options travel as one `printString`-quoted JSON string** — the only argument whose shape the core does not know

<span class="fine">`cacheWorkerIds` is also a **safety** measure: `printOn:` sends those same two accessors, and each is a *memoizing remote call*, so printing a worker nothing has queried **overwrites its `lastResult`** — answering a client the gem's pid where its response belongs.</span>

<!--
Bands 6 and 7, from the front end's side. The next slide is the same two bands
from the worker's.

The eight setters, if anyone wants them: workerClassName:, toolsetNames:,
toolsetOptions:, serverName:, serverTitle:, serverVersion:,
requestTimeoutSeconds:, maintenanceCallTimeoutSeconds:.

The through-line: a worker never chooses anything. Its class, its tools, its
identity, its deadlines and its name all arrive from the front end, because the
front end is the only party that knows the deployment -- and, once section 9
lands, the only party that has seen the token. Say that sentence; it is what
makes the authenticated router possible later.

printString is worth ten seconds and no more. It is not a clever defence, it is
the ordinary one, and the reason to mention it at all is the title: names and
versions are identifiers the router already validated, but a title is whatever
an operator typed into MCP_TITLE.

The fine line is the best bug story in the section and it is completely
non-obvious. printOn: -- the innocent thing a debugger or a log line does -- is
a REMOTE CALL against a session that has not memoized its ids yet, and it lands
in the same slot the response is read from. The fix is to make the accessors
memoize at login, when nothing is in flight. Tell it if the room is enjoying
itself; skip it if the clock is bad.

If asked why the two fetches cannot be folded into one executeString:, it is
because it is the ACCESSOR sends that populate the kernel's instance variables,
so a single expression would leave printOn: still calling out.
-->

---

## Inside the worker, the order is the point

```smalltalk
self nameThisGem: aCacheNameOrNil.
self sessionReadOnly: aBoolean.
SessionTemps current at: #McpFrontEndSession put: aFrontEndSessionOrNil.
srv := self newWithToolsetNames: … toolsetOptions: … .
SessionTemps current at: #McpServer put: srv.
```

* **`nameThisGem:` first**, before anything in this method that can fail
* **`sessionReadOnly:` before the build**, so the build can leave gated tools **out of the registry entirely** (§11) — a stronger gate than refusing them on call
* `#McpFrontEndSession` — the doorbell for a tool's progress (§6), pushed **once**, not per request
* **Tool registration happens now, at session open** — not on the client's first request. An unresolvable worker class or toolset fails **here**, where the message can say what to fix
* **`#McpServer` in `SessionTemps` for the gem's life**, answered only by `currentServer`: there are **two** entries into a worker, and **the blind-write ledgers live on the instance** — a second would licence writes on reads it never saw

<span class="fine">Answers one line for the log: `McpServer ready: 31 tool(s)`.</span>

<!--
The same two bands from the inside. Five statements, and every one of them is in
that position for a reason -- which is why this is a slide rather than a
paragraph.

The full version of the first one, since the slide is terse: a bootstrap that
dies on an unresolvable toolset is precisely the moment an operator is looking at
the session list, and it costs nothing to have the gem already named by then. A
name the cache refuses leaves the gem as it was rather than failing the login.

The front-end session pushed into SessionTemps is constant for this worker's
whole life, which is why it is pushed once here rather than repeated on every
request -- only the per-call id travels with the request. Section 6.

The two entries into a worker are a client's request and the front end's own
maintenance call (refreshViewForFrontEnd, section 8) -- worth naming, because
"two entries" is the part that makes the single instance necessary rather than
tidy.

The last bullet is the one that reaches forward, and it is section 7's
foundation. Say it slowly: the guardrail's ledgers are instance state on the
McpServer, so "which instance" is not a style question. Two instances would be
two ledgers, and the second one would licence a write on the strength of a read
it never saw. That is why currentServer exists and why nothing else builds one.

The read-only ordering is the small one people like: a gated tool is not refused
at call time, it is never REGISTERED, so it is absent from tools/list. A
read-only session does not advertise what it cannot do. The one subtlety, if
asked: tools/call still distinguishes "forbidden" from "unknown", because a model
that is told a tool does not exist will go looking for another way to do it.

"31 tool(s)" is the core seven's count, and it is the same 31 that was on section
2's toolset slide. Point at that if the room caught it.
-->

---

## `runWorker:` — four lines, and the whole concurrency story

```smalltalk
^self workerMutex critical: [
  worker nbExecute: anExpressionString.
  self awaitWorkerResult.
  self touch.
  worker lastResult]
```

* **`nbExecute:`, not `executeString:`.** A blocking GCI call blocks **in C** — so while it ran, the front-end gem executed **no Smalltalk and no `GsProcess` in it ran**: not another client's request, not the accept loop, not the reaper
* **Measured: a second client served in ~1s while an 8-second call is in flight**, where it used to wait the full 8
* **The mutex.** GCI allows one call in flight per session; the blocking call guaranteed that by *freezing the gem*. Now it is explicit, and two outstanding requests **queue** rather than collide

> **Two traps, each able to corrupt a response silently.** Read the result with **`lastResult`** — `waitForResultForSeconds:` consumes it internally. And only once **`isCallInProgress`** answers false: after a timed-out wait it still holds the **previous** call's value.

<!--
Band 8, the second red one, and the slide the GemStone developers in the room
came for. This is the one place where the right answer is a kernel fact rather
than a design preference.

Lead with the failure, not the fix: a blocking executeString: blocks in the C
client, and a gem parked in the C client executes no Smalltalk -- so every
GsProcess in the front end stops. That is the SAME fact as section 3's "a gem
executes no Smalltalk while it is idle", arriving from the other direction, and
it is worth saying so out loud. The front end has three kinds of work in flight
at any moment (connections, the reaper, open streams) and all three used to stop
for the length of the longest tool call.

The measurement is the proof and it is small enough to remember: one second
instead of eight.

An open SSE stream's keepalives froze too, which is the fourth thing on the list
and did not fit on the slide -- mention it if section 6 is still ahead.

The blockquote is pure hard-won API detail and this audience is exactly the
audience for it. A later nbResult after waitForResultForSeconds: has consumed the
result simply fails, which is the loud half of the first trap. Both traps corrupt a response SILENTLY -- no error, just the
wrong bytes going back to a client -- and both are one line apart in the method
comment. If anyone asks how they were found: the second one, by a response
arriving that belonged to the previous call.

If asked what happens when the deadline passes: the call is ENDED rather than
waited out, awaitWorkerResult raises, and whatever the break left behind is never
examined. Section 8 owns that; do not open it here.
-->

---

## The worker answers, and the version is negotiated

`McpDispatcher>>handle:` is the whole protocol router, and it fits on a line: **`initialize`** · **`ping`** · **`tools/list`** · **`tools/call`** · anything starting `notifications/` → **`nil`**, no response · an id-less unknown → **`nil`** · otherwise **`-32601`**.

**`initializeResultFor:`** — echo the client's `protocolVersion` when we support it, else answer our latest.

* `McpDispatcher class>>supportedProtocolVersions` is the single source of truth for **both** this and the header check in `protocolVersionAllowed:`, **so the two cannot drift**
* Supported: **`2025-06-18`** and **`2025-11-25`**. `2025-03-26` deliberately **not** — a server on that revision must accept JSON-RPC **batches**, and the single-object body parser does not
* Capabilities: **`tools`, and nothing else.** Not `listChanged` (no session's surface changes after `initialize`), not resources, prompts or completions — this server has none. **`progress` needs no declaration**: a client opts in per *request*, with a `progressToken` in `_meta`
* `serverInfo`: name, version, and `title` **omitted when nil rather than sent as null** — an absent title is what tells a client to display the name
* Plus **`instructions`** — §7's material, and it enters here

<!--
Band 9. A facts slide, not an argument slide -- run it briskly.

The one thing to actually make sure lands: two places in this codebase decide
what a protocol version is, and they read the same class method. Version
negotiation in the worker and the MCP-Protocol-Version header check in the front
end cannot disagree, by construction. That is the kind of thing that is invisible
when it works and a two-day bug when it does not.

The 2025-03-26 exclusion is an honest limitation stated as one: that revision
requires batch support, batching was removed again in 2025-06-18, and writing a
batch parser to support one deprecated revision would be the wrong trade. Say it
that way rather than apologising.

'logging' was declared until 2026-08-27, purely to licence notifications/message
as a carrier for two warnings that no longer exist -- and the draft revision
prohibits an unsolicited notifications/message anyway. Worth mentioning only if
someone asks why a server with a gem log declares no logging capability.

instructions is a hint to the MODEL, not documentation for a person, which is why
it says what a session IS here rather than what the tools do. Section 7 reads it
in full -- do not read it here.
-->

---

## Three session ids, and why every gem names itself

Every gem here is a `GsTsExternalSession`'s, so without help the front end, every worker, **and any unrelated external session on the stone** all arrive called `GciTs`.

```
name                     pid     sessionId
McpServer:5:978EC559     43793   4
McpRouter:8000           42435   5
McpServer:5:5ADC62A4     43797   6
```

* **The class comes first** in both — for a worker, the class the router *told* it to be — so a deployment running a subclass sees that subclass. The two stay distinguishable by **shape**: a front end has one `:` field after its class, a worker two
* The middle field is the **front end's** session id, so a stone running several routers still sorts into servers; the last is the **first 8 hex of the `MCP-Session-Id`**, so grepping the gem log finds that client's traffic
* A name is **truncated rather than allowed to fail a login** — and the **identifying fields are kept whole while the class name is cut.** `McpRouter:80` would name a port nothing is listening on

<span class="fine">Three ids, not one: the **`MCP-Session-Id`** (128-bit hex, the protocol's), the **front end's** stone session id, and the **worker's** stone session id and pid. `System cacheName:` names only the session that *sends* it, which is why a worker's name travels **into** the worker.</span>

<!--
The last band, and the prettiest slide in the section. It is also the first one
to cut if the hour is going -- demo C shows this exact table live.

Read the three rows out. The point lands without explanation: a DBA looking at
cacheStatisticsForAllSlots can see which server, which client, and which gem,
with no log to cross-check. Before this, all three rows said GciTs.

The truncation rule is the detail worth keeping if you cut everything else on
this slide, because it is a design principle in four words: keep the part that
identifies. A name is 'what this is' followed by 'which one it is', and it is
the second part a reader needs.

The cache takes 1-31 characters and raises OutOfRange outside that, which is why
a name is truncated rather than allowed to fail a login -- say it only if someone
asks why truncation is the behaviour rather than an error.

Three ids and they get confused constantly, which is why the fine line ends on
them. The MCP-Session-Id is the protocol's and the client echoes it; the other
two are the stone's and the client never sees them. Section 5 opens on the first
of the three.
-->

---

<!-- _class: demo -->

# DEMO C — a session is a gem

```bash
curl -i -X POST localhost:8000/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{…}}'
```

1. **`MCP-Session-Id:` comes back in the header** — and `serverInfo` names the version
2. `tools/list`, echoing that id — **31 tools**
3. In topaz: `System cacheStatisticsForAllSlotsShort` — **the `McpServer:5:…` row that did not exist ten seconds ago**, beside the `McpRouter:8000` from DEMO B

<span class="fine">**This is the demo that makes “a session is a gem” concrete, and the one to keep if only one survives.** Practise the cache-statistics line until the three rows are readable on a projector.</span>

<span class="fine">**2 minutes.**</span>

<!--
The load-bearing demo of the talk. Rehearse it more than any other except E.

Order matters here as much as it does in the code. Do the initialize FIRST with
the topaz window already showing one row -- McpRouter:8000 and nothing else --
then run the curl, then re-run the statistics line. The gem appearing is the
whole demo, and it is ruined by a topaz window that was already showing three
rows.

Have both curls written down. Improvising a JSON body on a projector is how this
one dies, and the params object is long enough to fumble.

What to say while the tools/list output scrolls: 31, the same number section 2
promised and the same number the worker logged when it booted. If a Grail server
is also running on 8001 from demo B, this is the moment to show 40 beside it.

If the room asks to see the session end: DELETE /mcp with the same id, then the
statistics line again, and the row is gone. It is fifteen extra seconds and it
closes the loop -- but only if we are on time.
-->

---

<!--
================================================================================
VERTICAL SLICE 6 -- section 5, trace 2: a follow-up request, and the JSON codec.
Seven slides, no demo. Cut 2026-09-12: fourth in running order, sixth to be cut.

Running order and plans, in seconds -- what is different 40, the request id 40,
handleToolsCall: 50, the view 45 (175s, trace 2); why the writer is owned 50,
inbound 45, the five defects 60 (155s, the codec). About 5 1/2 minutes.

NO LEAD SLIDE, and this is the only non-centrepiece slice without one. Section 5
is not a new subject, it is the same walk with one thing changed, and announcing
it as a section would undo the thing that makes it cheap. It opens on the header
that ends section 4 -- MCP-Session-Id -- and reads as the next sentence. Section
6 will need its own lead; this one would have cost 10s to say "still trace".

THE SECTION HAS TWO HALVES and they are not the same kind of material. Slides
1-4 are trace, and they get faster as they go because the room has walked this
path. Slides 5-7 are the codec, and they are the part THIS ROOM can act on:
these are their defects, in their kernel, measured. Slide 7 is the concrete ask
of the talk and section 13 collects it.

Slide 4 is the pivot. "THE VIEW. NO TOOL REFRESHES IT." is the dispatcher's own
capitals and it is section 7's whole premise arriving one section early -- so
state it, do not argue it, and let section 7 do the work. If a hand goes up
there, the answer is "that is the next section but one" and nothing more.

DEPARTURES from docs/Presentation.md:
  * THE SUMMARY DIAGRAM FOR SECTIONS 4-5 IS NOT HERE, deliberately, and this is
    the departure to revisit if anyone wants it back. The outline asks for "the
    whole chain on one page, front end above the line and worker below, with the
    GCI hop drawn as the only thing crossing it", to be reused in sections 6 and
    8 with an arm added each time. Three reasons it is gone: slice 5's sequence
    diagram already IS that picture, drawn before the walk rather than after it,
    and a second view of one chain eighteen slides later recaps rather than
    teaches; section 8 is already cut and does not reuse it, so the "one arm
    each time" economy was never going to be collected; and section 6's own
    picture is a different shape anyway (a tick's path out of a worker, which
    crosses the line in the other direction). If it comes back, it belongs HERE,
    as slide 5, and the two codec slides move after it.
  * the outline's step 7 (McpJson write: -> the string -> GCI -> writeJson:, and
    a notification's empty answer becoming 202) is one line of slide 2's notes.
    It is a call chain with no decision in it, and 202 was already established
    on section 4's servePost: slide.
  * the outline gives the codec "1-2 slides". It gets three, because the defect
    table cannot share a slide with the argument for owning the writer and stay
    readable at the back of a room.

THE DEFECT TABLE SAYS FIVE; McpJson's class comment says three. Both are right
and NEITHER SHOULD BE "FIXED" INTO THE OTHER. The class comment enumerates the
three defects that bear on ONE design decision -- which half of the codec to own
-- and says so in its own words. The table is the filed 3.7.6 report, which is a
superset: it adds the unchecked hex digits after \u and the leniency/error-quality
family. If the class comment is ever edited, it is still answering its own
question and still needs exactly its three.

THE DOCUMENT THE SLIDE OFFERS IS NOT IN THE TREE. docs/kernel-json-unicode.md is
cited from README.md, McpJson's class comment, McpJsonTest and docs/utf8-wire.md,
and it lives outside the repository along with three later variants including the
filed 3.7.6 report this table quotes. The outline already knows (its "What to fix
before the talk", item 2) and recommends committing it. THAT HAS TO HAPPEN BEFORE
THE TALK or slide 7's last line is an offer of something nobody can take: this
room will ask for the file by name, and the README they have open cites a path
that 404s.
================================================================================
-->

## Same client, second call. What is *different*

```
POST /mcp   MCP-Session-Id: 978EC559…
{"jsonrpc":"2.0","id":2,"method":"tools/call",
 "params":{"name":"get_method_source","arguments":{"className":"McpServer",…}}}
```

Everything transport-side is the same **up to `servePost:`**. Not a response, not a cancellation, not `initialize` → **`serveRouted:id:progressToken:sessionId:on:`**.

* **The session gates live in `serveRouted:`** — missing id → **400**, unknown or expired → **404** — and they *have* to live there, above both answer shapes: **a stream cannot be opened before it is known there is a session to serve**, or the refusal would have to be written into a response already committed to being a stream
* `progressTokenFor:accepting:` then decides the **framing**, not the content: `nil` → one JSON object (`serveCall:`) · non-nil → an SSE stream (`serveStreamedCall:`, §6)

<span class="fine">A 404 is the one a client is expected to recover from: a compliant client re-`initialize`s and gets a new session. Three conditions for a token, all in one method: it is a `tools/call`, it carries `params._meta.progressToken`, **and** its `Accept` offers a stream.</span>

<!--
Open by saying what this section is: the same walk, with the differences called
out, and it gets faster as it goes. Nobody needs the front door again.

The gate placement is the one piece of design on this slide and it is worth the
sentence. It is an ordering constraint of the same family as section 3's
"capture the ids before launching the loop": once the headers of a stream have
gone out there is no second HTTP response to be had, so anything that might
refuse has to refuse BEFORE the shape is chosen. That is why the gates are in
the method above the fork rather than duplicated in the two below it.

If someone asks why an expired session is 404 rather than 401 or 410: 404 is
what the spec names, and the client behaviour it produces is the one wanted --
re-initialize, get a new gem, carry on. Section 8 is where sessions end.

Claude Code puts a progressToken on every single tools/call it has ever sent, so
in practice the live server takes the stream branch almost always. Trace 2 takes
the nil branch because it is the simpler one and because section 6 is the other.
-->

---

## The request id lives exactly as long as the call

`serveCall:` → `sess forward: body lifetimeBounds: … requestId: anIdOrNil`

* The id is remembered **only while the call runs**, so a `notifications/cancelled` naming it can be matched to it — and cleared in an `ensure:` **at both ends**. A flag outliving its call would end **the next one**; and a cancel can arrive in the instant between a call finishing and the clearing
* `runWorker:` as in trace 1 — **non-blocking**, which is where "clients really do run concurrently" stops being a claim

> **Two guarantees the blocking call used to provide by accident, now explicit.** The per-session **mutex** — GCI allows one call in flight per session. And the reaper **skipping any session with a call in flight** (`McpSession>>isBusy`), instead of logging a worker out mid-request.

<span class="fine">Neither could have been needed before: while forwarding froze the whole front-end gem, no second request could collide and the reaper could not run either. Making the gem keep working is what made both necessary. `isBusy` reads the external session's own state and makes **no GCI call** — and deliberately excludes an *abandoned* worker, whose call is in flight and always will be.</span>

<!--
The blockquote is the slide, and it is a general lesson worth naming as one:
when you remove an accidental serialization, you inherit every invariant it was
quietly providing. Two here, and both were found by reasoning rather than by a
failure -- which is the good outcome and worth saying, because it is the case
FOR spending the time.

The ensure:-at-both-ends detail is small and real. Cleared on the way OUT for
the obvious reason. Cleared on the way IN because another GsProcess sets this
flag, and it can set it in the instant between a call finishing and the ensure:
running -- at which point the flag is sitting there waiting to end a call that
has not started yet.

The same method clears the view-release flag and its pass count, for the same
reason and set by the reaper rather than a client. Section 8.

If asked what happens after: McpJson write: turns the response Dictionary into
the JSON string, it crosses GCI as the value of the expression, and the front
end writes it with conn writeJson:. A notification's answer is empty, which
becomes a 202 with no body -- the same 202 as section 4's slide.
-->

---

## `handleToolsCall:` — and **two** different failure envelopes

* `params.name` missing → **`-32602`** `invalidParams` · unknown tool → **`-32602`** `notFound`
* A **read-only gated** tool → **`-32601`**, `data.kind = "readOnly"` — deliberately *not* `notFound`, so a client can tell **“exists but forbidden here”** from “no such tool” (§11)
* **Schema enforcement is structural, and says so.** `validationErrorFor:` rejects unknown top-level keys under `additionalProperties: false` *naming the allowed ones*, and requires every `required` key. **No deep type checks.** Schemas are JSON Schema 2020-12; no `$schema` needed

> **Per MCP 2025-11-25, the two are split by what the model can act on.** A malformed **request** — missing name, unknown tool — is a **protocol** error `-32602`: the model is unlikely to recover. Arguments that violate the **tool's own `inputSchema`** come back as a **tool execution error**, `isError: true` *in the result*, because they carry actionable feedback a model can use to self-correct and retry.

<span class="fine">Before 2025-11-25 both were `-32602`. **Only the envelope changed** — the check still runs *before* the tool is invoked, so a rejected call still has **no side effect**.</span>

<!--
This is the slide for anyone in the room who will write a toolset, and the two
envelopes are the part that is not obvious. The split is not about severity, it
is about who can do something with the answer: a model cannot invent a tool that
does not exist, but it can absolutely fix an argument if you tell it which one
and what was allowed. That is why the schema failure goes in the RESULT.

Be honest about the validator, because someone will read McpTool and find out
anyway. It is structural: unknown keys and missing required keys, nothing
deeper. In practice that has been enough, because the failure mode it catches is
a model guessing an argument name, and the errors name the allowed ones -- which
is the actionable feedback the spec is asking for.

The read-only kind is a small thing that matters more than it looks, and section
11 has the rest: a model told a tool does not exist will go and find another way
to do the same thing, which on a read-only server is exactly what you do not
want it doing.
-->

---

## `THE VIEW. NO TOOL REFRESHES IT.`

The dispatcher's own capitals — and the premise of §7, arriving one section early.

**A session sees one consistent snapshot of the repository until the client itself asks for another:** by committing, by aborting, or by calling `refresh`.

> This is **not an omission. It is the guardrail.** GemStone's conflict check is write-write **against the view**, and does not track what a client *read* — so the view is the only record the stone has of what this client saw.

* Two earlier designs *did* refresh under the tool: first `abortTransaction` before every call, then briefly `continueTransaction`. **Both were wrong for the same reason** — they tell the stone the client has seen changes it has not, and a commit that should have been refused as stale is accepted instead, **silently discarding another session's work**
* Then `tool callWith: args` → the handler → `contentText:isError:` → **`annotateContent:`**, which appends the `[session]` line (§7) — to **both** envelopes, because a tool that raised is exactly when dirty state most needs reporting, and computed from the state left **after** the tool ran

<!--
State this, do not argue it. Section 7 is eleven minutes of arguing it, with two
diagrams and a live demo, and every second spent here is a second stolen from
there. If a hand goes up: "that is the section after next".

What to say, and stop: the stone cannot help us here, because it does not track
reads. The view is the only record of what the client saw. So refreshing the
view under a client that has not asked is not a courtesy, it is destroying
evidence -- and the damage does not show up as an error, it shows up as somebody
else's work missing.

Measured both ways before it was believed, and the measurement is in
docs/server-to-client-messaging.md 15 -- which is one of the documents not in
the tree (see the slice header).

annotateContent: applying to the ERROR envelope too is the detail worth keeping
if the clock is bad: a tool that raised is precisely when a client most needs to
be told what state it is now in. Section 7 slide 9 is the whole of it.
-->

---

## Why this server owns its JSON **writer** — and only the writer

`McpJson class>>write:` replaces `Object>>asJson` on every production path, and answers **a byte `String` of UTF-8**.

> **The one defect an application cannot route around.** `printJsonOn:` keeps only **bits 12–15** of a codepoint above U+FFFF instead of emitting a surrogate pair: U+1F600 goes out as `"\uF600"`, and some codepoints as a **lone surrogate**, which is not well-formed JSON. **By the time `asJson` has answered, the codepoint is gone** — no post-pass can recover it.

* Writing UTF-8 **does not fix that arithmetic so much as never reach it**: a surrogate pair is an artefact of `\u` escapes and UTF-16, and UTF-8 spells an astral codepoint directly in four bytes. Only RFC 8259 §7's mandatory escapes are emitted
* **Bytes rather than characters is load-bearing**, and three unrelated things downstream depend on it: `Content-Length` is written as `body size` · the worker→front-end hop is measured in bytes by the kernel's result fetch, **whose buffer is sized in bytes** · `MCP_TRACE` writes bodies through `GsFile`, where a 16-bit string comes out garbled

<span class="fine">A byte `String`'s `#size` **is** its byte count whatever the bytes are, so all three hold **by construction**.</span>

<!--
The shape of the argument, said once: exactly one of the kernel's JSON defects is
on the WRITE path, and it is the only one that cannot be repaired from outside.
That asymmetry is the whole design. Own the writer, keep the parser, and fix the
inbound defect in forty lines at the edge -- which is the next slide.

"By the time asJson has answered, the codepoint is gone" is the sentence to land.
It is why this could not be a post-pass, a wrapper, or a sanitizer. The
information has already been destroyed.

The three downstream dependencies are worth reading out slowly, because they are
three unrelated mechanisms that all happen to need the same property, and they
all held under the OLD ASCII-only policy for an incidental reason -- nothing was
ever above 0x7E. Under this one they hold structurally. That is the difference
between a thing that works and a thing that is true.

The alternative to owning a writer, if anyone asks why not just patch it: a
kernel method patched in an image is lost on an extent reload, and it changes
behaviour for every other consumer in that image. Neither is acceptable for
something a customer installs.

The encoder has an oracle, if anyone asks how the UTF-8 arithmetic is trusted:
writeUtf8CodePoint:on: must agree with the kernel primitive encodeAsUTF8 for
every codepoint, checked across the whole range including both sides of all
three sequence-length boundaries. 1,148 codepoints, zero disagreements. The
escaping writer it replaced could only ever be checked against expectations
written by the same hand that wrote it.
-->

---

## Inbound: two `asString`s and one repair

```smalltalk
JsonParser parse: (self combineSurrogateEscapesIn: aString asString decodeFromUTF8 asString)
```

* **The leading `asString`.** The body does not reach the worker as the bytes the socket read — the front end forwards it **embedded in an expression**, and the worker **compiles that literal**, so its class comes from the worker's `#StringConfiguration`. A `Unicode16` — what an accented body compiles to on **any Grail image** — does not understand `decodeFromUTF8` **at all**
* **The trailing one** narrows `Unicode7`/`16`/`32` back into the byte-string family: a `Unicode7` compared to a `String` **raises** on a stock image rather than answering false
* **`combineSurrogateEscapesIn:`** — the one repair made *before* the parser sees the text. Kernel `JsonParser` sends `Character codePoint:` to each `\uXXXX` separately and 3.7.x refuses to build a surrogate, so an emoji written as the **pair RFC 8259 prescribes** failed the whole request with `-32700`. **Python's `json.dumps` escapes by default** — that is a real client, not a hypothetical

<span class="fine">**Forty lines at the edge, where the outbound defect needed a whole writer** — because inbound the information is still there in the escapes. An unpaired half becomes U+FFFD; a malformed *byte* sequence refuses the whole body with a `-32700` naming the offset, because a bad encoder means nothing it sent can be trusted.</span>

<!--
The leading asString is the best bug in this section for this audience, because
nothing about it is a JSON problem. The body is wire bytes by origin and
something else entirely by class, and the thing that changed its class is that
the front end sent it to the worker as a compiled literal. So the receiver's
StringConfiguration decides what parseBody: is handed -- and on every Grail
image, which is what the live server runs on, that is Unicode16.

And decodeFromUTF8 is implemented on String, ByteArray and Unicode7 ONLY.
Unicode16 answers MessageNotUnderstood EVEN WHEN every codepoint in it is below
256 and it therefore holds exactly the bytes the method is for. That is the API
note in the report that is not itself a JSON defect, and it is the one this room
is most likely to agree should just be fixed.

How it was found and confirmed, if asked: read out of the worker's gem log with
parseBody: instrumented, then confirmed causally -- revert the single asString
in the image, restart the front end, and a non-ASCII initialize is a -32700
while an ASCII one succeeds. Restore it and both succeed.

Performance footnote for anyone who worries about a scan per request: the repair
gates its scan behind one primitive findString: and answers the receiver itself
when there is no escape to find. 0.05ms against 3.6ms for a character loop over
a 63KB body.
-->

---

## Five defects, measured — and this is **the ask**

| # | defect | effect |
|---|---|---|
| 1 | `JsonParser>>string` — no surrogate-pair **decoding** | an escaped astral character raises `OutOfRange` (2723): **nothing above U+FFFF can be sent escaped** |
| 2 | `printJsonOn:` — no surrogate-pair **encoding** | U+1F600 → `\uF600`; U+10000 → NUL; U+1D800 → a **lone surrogate**, ill-formed JSON. **No error** |
| 3 | `JsonParser>>string` — an unrecognized escape is **dropped** | `{"a":"\x"}` parses to `'a' -> ''`; RFC 8259 §7 admits exactly eight escapes |
| 4 | `JsonParser>>string` — the four characters after `\u` are **not hex-checked** | `\uZZZZ` becomes U+0000, because `'16rZZZZ' asNumber` is 0 |
| 5 | `parse:` — leniencies, and error quality | trailing content ignored · raw control characters accepted · empty input is a `MessageNotUnderstood`, not a JSON error |

**Two of the five are silent data corruption on a public API** (2, 4). One raises three layers from its cause (1). Two accept what is invalid (3, 5).

<span class="fine">Measured against **3.7.6**, stock `extent0.dbf`, every result a live measurement, with a copy-pasteable reproduction and a suggested fix per defect. **I would like to hand this to someone.**</span>

<!--
THE CONCRETE ASK OF THE TALK, and the slide section 13 collects. Everything
before it in this section exists to earn the right to put it up.

Say the ask plainly and then STOP TALKING. The room fixes these. Do not soften
it, do not apologise for it, and do not fill the silence -- a pause here is the
whole point, and somebody in that room will say a name.

Rank them out loud, because five defects read as a list and two of them are not
in the same league: 2 and 4 are SILENT. No exception, no log line, a wrong
character written into the image and stored. 1 is at least loud, and it has a
named client behind it -- Python's json.dumps escapes by default, so an emoji
from any such client failed the whole request until forty lines of repair
existed. 3 and 5 are leniency, which is a smaller thing.

Have the reproduction for defect 2 in scrollback and ready to paste. It is one
line -- (String with: (Character codePoint: 16r1F600)) asJson -- and it answers
"\uF600" in front of them. If the room wants ONE thing to look at, that is it,
and it is more persuasive than the table.

BEFORE THE TALK: docs/kernel-json-unicode.md has to be in the tree. It is cited
from README.md, from McpJson's class comment, from McpJsonTest and from
docs/utf8-wire.md, and it is not committed -- see the slice header. This room
will ask for it by name and will have the README open.
-->

---

<!--
================================================================================
VERTICAL SLICE 1 -- section 7, the transaction model and the blind-write
guardrail. Fourteen slides. Re-cut 2026-09-10 to the running order below; it
diverged from the outline on purpose:

  * the measured seven-line trace is now speaker notes on the agent diagram, not
    a slide;
  * "why this never needed to exist before" is dissolved into the agent diagram,
    whose closing blockquote it now is;
  * the four-way refresh measurement is now speaker notes on "one pass", not a
    slide;
  * two new slides: the human-in-a-browser diagram (the guard working), and "one
    pass" -- the design that makes every tool succeed by making commit meaningless.

Budget: 11:10 at the plans in docs/Presentation.md's demo inventory -- 490s of
slides plus a 180s demo. Slide 5 carries 90 of those seconds and is the one to
protect.
================================================================================
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
