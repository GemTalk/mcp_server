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
  .verbatim { column-count: 2; column-gap: 34px; font-size: 20px; line-height: 1.45; }
  .verbatim p { margin: 0 0 .8em; }
  .verbatim .elide { color: #b4451f; opacity: .7; letter-spacing: .22em; margin: 0 0 .8em; }
  .cap { color: #b4451f; font-weight: 600; }
  .ex { font-family: ui-monospace, monospace; font-size: 16.5px; line-height: 1.5;
        border-left: 3px solid #ccd6da; padding-left: .7em; margin: 0 0 1.6em; }
  .exlbl { font-size: 13.5px; letter-spacing: .06em; text-transform: uppercase;
           color: #4a5560; margin: 0 0 .2em; }
  svg .hl rect { fill: #f6e1d6; stroke: #b4451f; stroke-width: 2.6; }
  svg .hl text { fill: #b4451f; }
  svg .hl path { stroke: #b4451f; stroke-width: 3; }
  svg .hl { color: #b4451f; }
  .boxnote { font-size: 21px; line-height: 1.5; max-width: 1010px; margin: 16px auto 0; text-align: left; }
  .tools { display: flex; gap: 24px; margin-top: 18px; font-size: 18px; line-height: 1.62; }
  .tools > div { flex: 1 1 0; }
  .tools p { margin: 0; font-family: ui-monospace, monospace; }
  .tools .tset { font-family: inherit; font-weight: 600; color: #b4451f; font-size: 16px;
                 margin: 0 0 .15em; }
  .tools p + .tset { margin-top: 1em; }
  .tools .grail { flex: 0 0 auto; border-left: 2px dashed #b4451f; padding-left: 22px; }
---

<!--
FIFTY-FOUR SLIDES, AND THIS FILE IS IN RUNNING ORDER THROUGHOUT. Sections 0-12 were all cut
once; eight stretches of them are now set aside. Section 13 is the only one never written.

THE TARGET IS 45 MINUTES as of 2026-09-14, down from an hour, and that is what the current shape is
for. The running order:

  1-2     sections 0 and 1 -- the title, and what is different
  3-20    the gem-contents sequence (GENERATED -- see below), plus its tool inventory
  21-27   sections 1 to 3 -- installing and starting a server, with demo A INSIDE the
          run rather than after it (REORDERED 2026-09-15)
  28-29   demos B and C -- a session is a gem, then a long call reporting while it runs
  30-37   section 7 -- the transaction model and the blind-write guardrail, then demo D
  38-42   section 8 -- the router maintenance cycle, then demo E
  43-45   section 9 -- McpAuthRouter, a reachable port, then demo F (FOLDED, THEN MERGED, 2026-09-14)
  46-47   section 11 -- the worker gem's GemStone user (MOVED HERE, THEN FOLDED, 2026-09-14)
  48-50   section 10 -- a lead, ONE slide, and demo G: extending it, a server for YOUR software
  51-54   THE APPENDIX -- a lead, then the JSON codec. OPTIONAL, run only if the clock allows

THE DEMOS WERE RELETTERED ON 2026-09-15, when the install demo and the start-a-server demo were
merged into one. There are SEVEN now, A to G, and every letter after A moved up one: what was C is
B, D is C, E is D, F is E, G is F, H is G. Notes written before that date, and any crib sheet that
was not rewritten with them, mean the letter AFTER the one they name.

RUNNING ORDER IS NOT SECTION-NUMBER ORDER ANY MORE. Section 11 was moved ahead of section 10 on
2026-09-14, so the deck runs 9, 11, 10. The reason is thematic rather than structural: section 9's
subject is who a request is allowed to be, section 11's is the only boundary that actually holds --
the GemStone user the worker gem logs in as -- and that argument belongs beside McpAuthRouter's
while the room is still holding it, carried back to the plain McpRouter. It also puts the seam
section last, so the talk proper ends on "here is what you build on this" rather than on a boundary.
ONE REFERENCE FLIPPED DIRECTION AND WAS BETTER FOR IT, then left the deck entirely: section 10's
toolset slide ended "(§11)", which the reorder turned from a forward pointer into a backward one --
and that slide was removed later the same day, so no face makes the link now. Its notes do, on
page 50. Section numbering still belongs to the material,
not to this cut -- the deck already read 3, 7, 8 -- and this is the same principle applied to order
rather than to numbering. AND THE LAST STRETCH CARRIES NO SECTION NUMBER AT ALL: as of 2026-09-14
the codec slides sit behind a lead that calls them THE APPENDIX, so the room is told the talk
proper has ended rather than told which section it is in. The material is still section 5's.

WHAT IS SET ASIDE, and where. docs/slides/archive.md holds twenty-three slides removed on 2026-09-14
for time: section 4 (trace 1, a brand-new client's first request, ten slides), the trace half of
section 5 (a follow-up request, four), and section 6 (progress notifications, five). About fourteen
minutes of slides. THEIR DEMOS STAYED -- demo B came out of section 4 and demo C out of section 6,
and they now run together as one continuous stretch of terminal, two slides behind the demo A that
installs the image and starts the server they both use. The archive is
renderable and carries its own map back; read its header before putting anything back, because two
of those slides cannot return alone. THE SECTION NUMBERS WERE NOT RENUMBERED: the deck goes 3, 7,
8, and the gap is the archive. Section numbering is a property of the material, not of this cut.
LATER THE SAME DAY, four more went to the archive from section 8, in two passes, taking it from ten
slides to four: the answered-ping and descriptionOfSession: slides, then the dead-gem and maxSessions
slides. That is a different kind of cut -- section 8 is being thinned slide by slide rather than set
aside -- and those slides' notes were split across the slides that stayed rather than travelling
whole. The archive's own headers are the authority on which paragraph is where. Of everything now
set aside, maxSessions is the one to put back first if the clock allows.

THEN SECTION 12 WENT WHOLE, the same day -- all five slides of "versions: the floor moved, and why",
about four minutes. That is the fourth stretch and it is a set-aside rather than a thinning: the
section had one argument and half a slide of it does not stand. What the talk keeps of it is a
sentence when the version numbers come up, and the whole of its case now sits in the notes of the
install slide (page 22), under a VERSIONS banner, because that slide's own table is what puts 3.7.5
in front of the room. That took the total to twenty-eight.

AND SECTION 9 WAS FOLDED, the same day, which is the fifth stretch and a third kind of cut again --
neither a set-aside nor a slide-by-slide thinning, but a REWRITE that made three slides redundant.
Page 45's face went from "a reachable port, and the three invariants that pay for it" to a
four-sentence summary of the whole mechanism, and the three slides behind it -- every request
carries the token; the login; the token is the real bound -- came out. 190 seconds of slides became
90 seconds of one. THE ARGUMENT DID NOT GO ANYWHERE: all three slides' notes are on page 44 under
banners naming where each came from, so that slide is now spoken rather than read, and the renewal
bug -- the best story in the section -- is a paragraph of them rather than a blockquote.

AND SECTION 11 WAS FOLDED TOO, last of all on the same day and by the same move, which is the sixth
stretch. Page 49's face took the lock exposure as a blockquote -- no privilege allows or prevents
System writeLock:, and a single statement can take over two thousand locks -- and the slide that
had been the section's whole reason for existing came out behind it. Its notes are on page 48 under
a banner, so the DataCurator measurement, the reverted lock reaper and the question itself all
survive. THE ASK ITSELF IS STILL ON A FACE: later the same day page 48 gained a heading of its own
asking whether write locks should be privilege-gated, so what the fold cost is the argument under
the question rather than the question.

AND SECTION 10 LOST ITS MECHANISM SLIDE, the seventh stretch and the last of the day. "To add
tools, write a toolset" -- registerOn:, toolNames, the schema builders, assertMutableClass:
forwarding to the server -- was the only place in the deck that said how a toolset is written, and
it came out when the surface slide beside it was rewritten to name a real customer's toolset and
server in its bullets. Its notes AND its face are on page 50 under a banner, because no surviving
face carries any of it. WHAT THIS COSTS IS A POINTER: the "tools/list is unfiltered" blockquote went
with it, and it was section 10's only face-level link back to section 11.

THEN SECTION 10 LOST ITS EVIDENCE TOO, the eighth stretch and the last cut of the day. "When a
domain toolset collides with the session model" and "A GemStone result, and three asks already
filed" both went, taking every measurement the section had: 132 defects against 386/386 clean, the
31 modified objects of a cold Grail import, the 262-second test class, the sender search that
answers an empty array where twelve senders exist, and the three filed Grail issues. All of it is
on page 50 under two banners, anchored to the two words that survive on that face -- "tests" and
"two search tools". THEN THE TWO SLIDES THAT WERE LEFT WERE MERGED, tightened until the surface
shapes and the worked example fitted one face with the Grail half as a subheading. The section is a
lead and ONE slide now, about 90 seconds, carrying three banners' worth of notes, and it is THE
SHAPE WITHOUT THE EVIDENCE: it says what extending this server looks like and no longer shows
anybody having done it. Thirty-five slides are now set aside in total.

THEN DEMO G WENT IN, the same day, and it is the answer to that last sentence. The section had been
the only one in the deck with no demo, against an outline that asked for one; what settled the
argument was that a demo could put the EVIDENCE back on a screen without putting a slide back. It
runs the Grail sender search against the stock one, on the same name in the same session: empty
arrays from the stock tool, twelve senders and an env 1 attribution from the Grail one, and a
not searched: block that prints the upstream issue number itself. 90 seconds, no second gem and no
clock, which makes it the safest demo in the deck.

THE CODEC SLIDES MOVED RATHER THAN LEFT, AND ARE NOW AN APPENDIX. Section 5's other half -- why this
server owns its JSON writer, the inbound repair, and the five measured kernel defects -- is at the
END of the file, after section 10, and is the first thing to drop if the clock has gone. On
2026-09-14 a lead slide went in front of it saying so in the title, which makes the drop a clean
seam rather than a silent stop: if the clock has gone, end on the lead. Do not start the three and
abandon them, because the ask is the last of them. It IS the concrete ask of the talk, so dropping
it is not free; section 11's notes name it as one of the two things being asked for, the other
being section 11's own lock question -- which since the fold is a heading at the foot of page 48
rather than a slide.

Each slice's own header comment sits beside its first slide. Seven of the original eleven slice
headers are still here; slice 5's, slice 7's and slice 10's went to the archive with their slides,
and slice 6's was split between the two files. (This line read "six" while there were eight -- it
was wrong before slice 10 left, and the count above is the one the file actually has.)

ONE BLOCK IN THIS FILE IS GENERATED. The gem-contents sequence that runs between the "What is
different" slide and the rest of section 0 -- seventeen slides stepping through one diagram, plus the tool inventory that
interrupts them after the McpTool slide -- sits between the MCP-GEM-SEQUENCE:BEGIN and :END marker comments, and
is produced by docs/slides/gen.py. Do not hand-edit those slides -- edit the generator and run
`python3 docs/slides/gen.py --apply`, which rewrites the block in place. `--check` exits non-zero
when the file has drifted, which is the cheap thing to run before a commit. Everything outside the
markers is hand-written as usual.

Source of truth for the argument and the notes is docs/Presentation.md; each slice is derived from
the matching section of it. Where the two disagree THIS FILE IS RIGHT and the outline should be
brought into line with it, which is how both slices were reconciled.

Rendering, either way from this one file. --html IS REQUIRED, not optional: Marp Core defaults
html:false and STRIPS raw HTML, which would silently drop every inline <svg> diagram -- six one-offs
and the seventeen copies of the gem-contents diagram -- and every
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
invisible on a projector -- which nothing revealed until demo B's curl became the first demo
command with a quoted argument in it (found 2026-09-12).
-->

<!--
================================================================================
VERTICAL SLICE 3 -- section 0: framing. Two slides -- the title and "What is
different". Cut 2026-09-11: first in running order, third to be cut.

Running order and plans, in seconds -- title 10, what is different 40 (50s).

SECTION 1 IS NO LONGER A SECTION, as of 2026-09-13. It was four slides; the
load.gs loader and "How it is verified" were deleted and are now speaker notes on
the one slide that remains, the file-out table, and that slide has moved into
slice 4's run behind a lead retitled "Installing and starting a server". Demo A
went with it, to sit immediately before what was then demo B -- and on 2026-09-15
the two were merged, so it is now one demo. So this slice is the title and
one slide, and everything after them is slice 4's until section 4 begins.

The gem-contents sequence runs between "What is different" and that run, which is
deliberate: the room gets the reason for gems before it is shown what is in
them.

Section 0's thesis is one sentence and slide 2 is the whole of it: it runs inside
the image, so a session is a login, a session is a transaction view, and a view is
a commit record the stone cannot dispose of. Everything the rest of the hour finds
difficult follows from those three, and not one of them is an MCP problem.

Section 1 has no thesis and does not want one. It is the tour that makes the later
sections cheap. The picturing work -- "the front end" and "a worker" as things
the room can see -- has moved earlier, to the gem-contents sequence right after
the title, so what is left here is the repository itself: what files in, how, and
what proves it still does.

TWO DELIBERATE DEPARTURES from docs/Presentation.md:

  * NO DIAGRAM INSIDE EITHER SECTION, on purpose. The orienting picture of the
    deployment belongs to section 3, where the fork and the detach are the
    subject; the request picture belongs to section 4, where it is walked line by
    line. Drawn here, either would spend 45s saying worse what a later section
    says properly.
    The gem-contents sequence that now runs between the title and section 0 is
    NOT a departure from this and is not part of either section's budget: it is
    an orienting block of its own, placed early on purpose so that "the front
    end" and "a worker" are pictures before any section needs them. Its
    placement is provisional. Timing it is still to do.
  * "which gem runs your code decides how it gets refreshed" is no longer a
    slide. Its table was development lore rather than a fact about how the
    server runs, and the parts worth keeping -- what lives in which gem -- are
    what the gem-contents sequence draws. The transaction and view-hygiene
    material it leaned on is spent properly in the later sections.
  * the outline's "two expected failures that are signal rather than noise" is not
    a slide. Both belong to sections that spend them properly -- McpExternalSession
    Test to 12, testTheStoneAloneWouldAllowThatClobber to 7, where it already has a
    slide -- so they are one sentence of notes on the verification slide. The
    outline also attributed that test to McpBlindWriteTest; it lives in
    McpConcurrentEditTest, and the outline has been corrected.

"STATUS, HONESTLY" IS GONE, deleted 2026-09-13, and its four claims were not
dropped so much as sent to where each is already earned:
  * the built list -- Streamable HTTP, per-client worker gems, 31 tools -- is what
    the gem-contents sequence and the inventory slide show one box at a time.
  * OAuth 2.1 / JWT and TLS belong to McpAuthRouter: the router slide names the
    class, and section 9 spends it in full.
  * the configurable worker user is section 11, which says it better -- and says
    the thing the status bullet never did, that it is configured PER ROUTER and
    not per session.
  * server-initiated messages -- NOT a feature and never becoming one, because the
    2026-07-28 draft forbids the direction outright -- are now a speaker note on
    the McpProgressChannel slide, which is where they are on screen. That is
    WHAT WAS ASKED FOR ON 2026-09-11, and it still hands the consequence to
    section 13.
  The README's own status line still reads server-initiated messages as a feature;
  that is item 5 in docs/Presentation.md's fix list, and README's Future work is
  still the thing to point at rather than reading a second list aloud.

WATCH -- the Grail toolset is about to stop being auto-detected. McpServer class>>
installedDefaultToolsetNames appends McpGrailToolset whenever that class is loaded
in the image; it is to be replaced by naming the toolset explicitly in the router
configuration. Nothing in THIS slice asserts the auto-detection -- the group table
is about install.sh's file-in, which does not change, and the test counts are
unaffected because the suite runs either way -- but section 2 does assert it
(docs/Presentation.md, "Resolved per session, not at boot") and section 10 will.
Re-read both when that merge lands.

Budget: 0:50, against the 1.5 minutes the outline's table allows section 0 -- 40s
under. The 3.5 minutes it allows section 1 now belongs to slice 4, which carries
what is left of that section; on the pair's own 5.0 minutes the two slices
together run 2:20 under, which is the first place to look when a later section
overruns rather than a reason to put a slide back. Four slides came out on
2026-09-13 -- "MCP, in one slide" folded into "What is different" (20s), "Status,
honestly" (35s), load.gs (35s) and "How it is verified" (40s).
================================================================================
-->

<!-- _class: lead -->
<!-- _header: '' -->
<!-- _paginate: false -->

# mcp_server

### A Model Context Protocol server running *in* GemStone

<br>

**A report on the state of the project**

<!--
Say the shape of the hour before the first slide, because it is the thing that stops people
waiting for the caveat. Healthy path first, in full: what the repository IS, how a server starts,
one request end to end, a second request end to end. Only THEN progress, the transaction model,
the maintenance cycle, auth, extension, and the version story. Every pressure case is a later
section that comes back to the same trace and adds one arm to it.

You know GemStone. You do not necessarily know MCP, and -- more to the point -- you do not yet
know why a thing that looks like a web server is built out of gems. That second question is the
whole talk.

Eight demos, each with a hard stop rehearsed into it. (This read six while there
were seven, and demo G made it eight.) If we run long the demos are what I will
protect, because a section summarised in two sentences beside a live worker gem lands better than
the same section in full with nothing on screen.
-->

---

## What is [mcp_server](https://github.com/GemTalk)?

* This server exists to replace the **GCI-based Jasper MCP server** with something **any** MCP client can reach over plain HTTP
* It runs **inside the image**. No Node process, no GCI bridge, no FFI
* The socket runs in a **gem**. The tools execute in another **gem** — with a **login**, a **transaction view**, and a **commit record**
* This server conforms to MCP specifications [2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18) and [2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) but not [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) (yet)
* It answers `initialize`, `ping`, `tools/list`, and `tools/call`. Everything else — `resources/*`, `prompts/*`, `completion/complete`, `logging/setLevel` — is answered `-32601`, because this server declares exactly one capability: `tools`

<!--
This slide is section 0's thesis and MCP's whole surface in one, and it was two slides until
2026-09-13 -- "MCP, in one slide" and "What is different here" -- which said the same thing twice
from opposite ends. It now runs THIRD in the file, before the gem-contents sequence, so that the
room has the reason for gems before it is shown what is in them.

Third bullet, slowly: it is the only thing on this slide anyone needs to carry forward, and it is
the spine of sections 7, 8 and 9. A session is a login (9), a session is a transaction view (7),
and a view is a commit record the stone cannot dispose of (8). That last one is what turns a
convenience into a design constraint -- an idle MCP client is not free here the way an idle HTTP
connection is free in a web server.

The four-method surface is smaller than people expect and that is worth landing early: it is why
the interesting parts of this project are all GemStone parts. There is very little protocol to get
wrong. The entire declared capability surface is "capabilities": { "tools": {} } -- a server may
send only what it has declared, so everything in the next hour is either a tool call or the
machinery that keeps one alive.

`notifications/*` is the fifth thing that arrives and the reason it is not in the list: a
notification has no id, so it gets no response at all -- the dispatcher answers nil and the
transport sends 202. That is JSON-RPC, not an MCP rule.

On what is NOT declared, if asked: tools/listChanged (no session's tool surface changes after
initialize), resources, prompts, completions, tasks (2025-11-25's task-augmented requests --
tasks/get, tasks/result, tasks/list, tasks/cancel; nothing here is long-running in the
protocol's sense, progress is the mechanism instead) -- none of which exist here. `logging` was
declared until 2026-08-27 and was removed rather than left as a promise nothing would keep.
Progress needs no declaration at all: it is a base-protocol utility a client opts into per
REQUEST by putting a progressToken in _meta, so there has never been anything for a server to
advertise.

On the version bullet, if pressed: McpDispatcher class>>supportedProtocolVersions is the authority
and names exactly the two, with 2025-11-25 the default; 2026-07-28 is the draft that forbids
server-initiated requests, which is section 13's subject and the caveat on the status slide.

STANDING RULE for the first half, which was on this slide until the consolidation and is now said
out loud instead: the healthy path only -- no commit-record pressure, no timeouts, no pending
ledger, no progress notifications, no auth. Every one of those is a later section that comes back
to the same trace and adds one arm to it. Say it, or this audience spends the healthy-path half
waiting for the caveat and asks during the demos what section 7 answers properly.

Deliberately not a diagram. The picture comes next, in the gem-contents sequence. There is no
longer a request picture after it: section 4, which drew one and then walked it line by line, went
to archive.md on 2026-09-14, so the sequence is the only picture of the shape this room gets.
-->

---
<!-- MCP-GEM-SEQUENCE:BEGIN -- generated by docs/slides/gen.py; do not hand-edit -->

## Two gems, and what is in each

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

Every box is **one object**. The front-end gem owns the socket and knows who the sessions are; the worker gem runs the tools. Nothing is shared between them. **One string crosses the gap in each direction**.

</div>

<!--
The establishing shot. Do not explain anything yet -- name the two gems, say that the boxes are
objects rather than classes-in-general, and move. Everything on this slide gets its own slide.

WHAT "NOTHING IS SHARED" MEANS CAME OFF THE BOX 2026-09-15. It read "Nothing is
shared between them -- not a variable, not a view, not a transaction." The three
are worth saying even though the box no longer lists them, because each one is a
section: not a view is section 7, not a transaction is section 8, and not a
variable is why the fork string exists at all (slide 23). Unqualified, "nothing
is shared" sounds like ordinary good manners between objects; the list is what
makes it a claim about GEMS.
-->

---

## MCP client &#8212; one per editor

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client hl">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

Claude Code, a VS Code extension, `curl`. It speaks **HTTP/1.1 and JSON-RPC 2.0**: it POSTs each request, and may hold open a `text/event-stream` GET to listen to the server.

</div>

<!--
Worth saying out loud that the client is not ours and we do not get to change it -- the protocol
era split is section 3's material.

This slide said "one client is one session, and one session is one GemStone login -- which is the
whole reason there is a cap" until 2026-09-13. The login half is now the third bullet of "What is
different", two slides earlier, so saying it here is repetition; the cap is left to section 8's
maxSessions slide, which is where it is actually configured. Still the point to land IF it is
asked: a reconnect loop in a client opens a NEW session each time, and the login that exhausts a
stone fails for topaz too.
-->

---

## McpHttpConnection &#8212; one per request

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http hl">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

Reads **one** HTTP/1.1 request and writes **one** JSON response, `MCP-Session-Id` header included. It writes the SSE stream, every frame gated on the socket being writable, plus a non-blocking read-side disconnect check.

</div>

<!--
HOW A CLOSED EDITOR TAB IS NOTICED CAME OFF THE BOX 2026-09-16, SO IT IS NOW YOURS TO SAY. The
box used to end "-- which is how a **closed editor tab** is noticed", and the mechanism is still
printed: the non-blocking read-side disconnect check is the last clause on it. What the box no
longer says is what that check is FOR. Say it, because nothing else in the deck explains how the
server learns a client is gone, and a closed tab is how most of this room will ever end a
session -- no DELETE, no logout, just a socket that stops being there.

Off the slide since 2026-09-13, and worth a sentence if the question comes: the gem is released
about ten seconds later. The ten seconds is a grace for a client that might reattach to the
same session. A reopened
editor tab does not; it re-initializes. Do not spend time here -- the reaper slide is where
session lifetime actually gets argued.
-->

---

## McpRouter &#8212; the accept loop, and the gem&#8217;s blocking main activity

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router hl">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

The socket, the routes, the `MCP-Session-Id`&#8594;`McpSession` map behind a mutex, the pending-request table. The gem **loops** in `runOnPort:` until `stop`, and that loop is the gem&#8217;s only activity &#8212; a forked GsProcess runs only while the gem is executing Smalltalk, so the reaper and the poller live off it. The front end runs **transactionless**. `McpAuthRouter` adds the bearer token, TLS and RFC 9728 metadata, and logs each worker in as **the token&#8217;s own GemStone user**.

</div>

<!--
Two things this slide used to print and now only says: the front end NEVER RUNS A TOOL, and
transactionless is what stops it pinning the stone's oldest commit record. Section 3's slide
arguing the cost came down on 2026-09-13, so both halves of it belong here now, a breath each.
THE PRICE: front-end code must not read persistent object graphs. No walking a committed
collection, no caching a persistent object across statements. Stone primitives and lookups by
name are fine, and the class comment says so in capitals.
THE PAYOFF is the same property from the other side, and it is the half worth saying out loud
because somebody here has lost an afternoon to it: a COMMITTED recompile of front-end code takes
effect in a RUNNING server, within two maintenance passes. That is the answer to 'my transport
fix did not take' -- wait one pass, then check the gem's start time. A gem that cannot hold a
view across statements is a gem that re-reads its code from the repository constantly.
The measurement that made the mode non-negotiable is section 8's, and one number carries it: a
front end left IN transaction sat on the stone's oldest commit record for fifteen hours. Leave
the rest of that argument to section 8's maintenance-pass slide.
If someone asks why the router decides the worker's class and toolsets rather than the worker --
because only this side can see the token.
THE KERNEL FACT IN THE PROSE IS THE ONE THIS ROOM KNOWS, and section 3's slide for it came down
on 2026-09-13, so this is where it gets said. A forked GsProcess runs only while its gem is
ACTIVELY EXECUTING Smalltalk; a GCI-driven session is parked in the C client between commands, so
an accept loop forked THERE is frozen and never serves a request. Therefore the accept loop has
to be a dedicated gem's blocking main activity. It is worth slowing down for: they know the fact
is true, what they have not necessarily done is follow it to three separate conclusions. The
other two: the front end must own the client's STREAM, and the front end must own VIEW HYGIENE,
because only the front end has a heartbeat. View hygiene is section 8 and is paid in full. The
stream is section 6, which is archived as of 2026-09-14, so that promise is now redeemed only by
demo C and by four boxes of the gem-contents sequence -- promise it smaller, or not at all.
Have the third argument ready anyway, because somebody always jumps ahead. On every OTHER count
the worker is the better-informed party: it can read its own commits-behind, the stone's backlog,
whether it holds the oldest commit record, and needsCommit, none of which the front end can see.
The action still belongs to the front end because the problem case is precisely the IDLE worker
holding a stale view -- the one moment that worker cannot run a line of code.
-->

---

## McpSession &#8212; one per client, and the only thing that drives a worker

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session hl">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

The `GsTsExternalSession` handle, the session id, last activity, the worker class and toolset list the front end resolved, plus this session&#8217;s outbox and liveness state. `prepareWorker` sets the gem up in **one** call at session open; `forward:` runs a request in it. A **mutex** around the handle makes GCI&#8217;s one-call-at-a-time rule explicit rather than accidental.

</div>

<!--
Two guarantees used to hold by accident when forwarding was a blocking executeString:, and are
now explicit -- one call in flight per session, and no interleaving. The slide that showed the
nbExecute: doing it is archived; this line is where the fact enters the talk now.
The worker class and toolsets are resolved PER SESSION, so a Grail install that lands after
startup reaches the next client without a restart.
-->

---

## The hop &#8212; one string, non-blocking

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request hl">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

`worker nbExecute: 'McpServer handleJsonString: ', body printString`. **Non-blocking**, so one client&#8217;s long request will not stall anyone else. Every embedded string is `printString`-quoted, so a request body cannot smuggle anything into the worker&#8217;s compiler. The answer comes back as that same call&#8217;s **`lastResult`**, read once the call is finished &#8212; so nothing may send GCI to this worker in between.

</div>

<!--
The body does not arrive as the bytes the socket read: the worker COMPILES that literal, so its
class comes from the worker session's StringConfiguration. That is why parseBody: has a leading
asString. Section 7 if anyone pulls on it.
printString-quoting is load-bearing for the server TITLE in particular, which unlike a name or a
version is free-form operator prose, so quotes in it must be doubled rather than closing the
literal.
WHY lastResult is on the slide. It is read AFTER the call, so anything that sends GCI to this
worker in between overwrites it and the client silently gets the wrong answer. The live trap is
printing the worker: GsTsExternalSession>>printOn: sends stoneSessionId and gemProcessId, each a
memoizing REMOTE accessor, so logging a worker nothing had queried would answer a client with the
gem's pid where its JSON-RPC response belongs. McpSession>>cacheWorkerIds fetches both at login,
once, while nothing is in flight; memoized, every later print is inert. Log those cached ids,
never the worker itself.
IF ASKED whether that arrow is only client requests: no, and the label still holds -- all of it
is nbExecute:. Three kinds of traffic take it. The bootstrap at session open (prepareWorker, one
round trip, before any request can arrive). Every client request (runWorker:). And the reaper's
view refresh, runMaintenanceExpression: 'McpServer refreshViewForFrontEnd', which differs in two
ways worth saying: it takes the worker mutex with tryLock and gives up at once rather than
parking the reaper behind somebody's five-minute test run, and it does NOT touch the session --
a maintenance send that counted as activity would make a dead client's session immortal.
NOT on that arrow: cacheWorkerIds and logout, which are GCI calls on the handle, not expressions.
-->

---

## SessionTemps &#8212; where the instance actually lives

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps hl">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

The worker gem&#8217;s own scratch dictionary: **per gem, per login, never committed**. The front end names a **class**, and `McpServer class>>currentServer` is the single place that turns that into the instance. That single place matters: **two** entries reach a worker &#8212; a client request and the front end&#8217;s own maintenance call.

</div>

<!--
This is the slide the whole diagram was built around. A second McpServer instance would be a
second set of ledgers, licensing writes on the strength of reads it never saw. Say that sentence
slowly.
#McpFrontEndSession is pushed down once at session open -- it is where to ring the doorbell when
a tool reports progress, and it is constant for the worker's life.
If asked what it points AT: a session NUMBER, not an object. System session as the ROUTER's gem
answers it, embedded in the bootstrap string the worker compiles. It could not be a reference --
two processes, two object memories, and the only thing they share is the repository, which an
McpSession never reaches because nothing about a socket survives a commit. It is also NOT the
worker's cached stoneSessionId: different number, different namespace. sendSignal:to: and a
polled signal's sendingSession both speak the System session one.
-->

---

## McpServer &#8212; the per-client worker, built before the first request

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server hl">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

Registry, dispatcher, toolsets, identity, the kernel guards and the blind-write read/write ledgers. **No socket.** It is built at session open by `prepareWorkerWithToolsets:…`, not on the client&#8217;s first request &#8212; so an unresolvable worker class or toolset fails **there**, where the error can say what to fix, instead of inside a `tools/call`.

</div>

<!--
Order inside prepareWorker is the point: nameThisGem: FIRST, before anything that can fail,
because a bootstrap that dies on a bad toolset is exactly when an operator is reading the
session list. Then the front-end session, then registration, then the instance into SessionTemps.
-->

---

## McpDispatcher &#8212; JSON-RPC 2.0, and two kinds of failure

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher hl">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

Routes `initialize`, `tools/list`, `tools/call` and `ping`; appends the post-call `[session]` line; turns an `McpError`&#8217;s machine-readable `kind` into a structured error envelope, and splits a failure two ways per MCP 2025-11-25: a **protocol** error for a malformed or unknown call, a **tool execution** error for arguments that violate the tool&#8217;s own schema &#8212; the second kind carries feedback a model can act on, so the spec wants it in the result.

</div>

<!--
Deliberately says nothing about the view: NO TOOL REFRESHES IT, and why that is a guardrail rather
than an omission belongs to the later transaction section.
If someone asks whether the worker aborts before a call -- it did until 2026-08-28, first with
abortTransaction and then briefly with continueTransaction. Stopping was the FIX: refreshing under
the client tells the stone it has seen changes it has not, and a commit that should have been
refused as stale is accepted instead.
The [session] line is appended AFTER the call, so it describes what the call left behind.
-->

---

## McpToolRegistry &#8212; name to tool

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry hl">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

A name&#8594;`McpTool` map, and the thing that produces the `tools/list` descriptors a client reads once at startup and then trusts. It is populated **at session open**, from whichever toolsets the front end named for this session &#8212; so two clients on the same stone can legitimately see two different tool surfaces.

</div>

<!--
Short slide. The only thing worth pausing on is that tools/list is answered from here rather than
assembled per call, so the surface a client sees is fixed for the life of its session.
-->

---

## Mcp*Toolset &#8212; a set of tools, added together

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset hl">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

A tool pack: `registerOn:` contributes its tools and their schemas to the tool registry, and it owns its `tool_*` handlers and the shared schema builders.

</div>

<!--
SAY THE REST, and the inventory two slides on shows it: seven core toolsets, one per tool
family, plus the
optional McpGrailToolset on a Grail image -- and SUBCLASS THIS TO ADD TOOLS, which is the whole
point of the box. A deployment picks any subset of them, or none of them alongside its own.
McpGrailToolset needs nothing from the server, which is why it doubles as the worked example for
a third-party toolset. If someone is going to write one, this is the slide to point at.
-->

---

## McpTool &#8212; one tool, and its schema

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool hl">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

Name, description, JSON Schema, handler block. It **validates arguments against its own schema before the handler runs**.

</div>

<!--
About 31 of these in a default worker, more with Grail -- and the next slide is the list, so
this is the moment to say what one of them IS rather than what there are.
What validating first COSTS, off the slide since 2026-09-13 and still the thing to say if a
contributor asks: a closed schema turns one stale argument into a cascade of failures rather
than one, which is why, when ./test.sh fails in a heap, you fix the FIRST check and re-run. A
contributor warning dressed as a design note; it is in CLAUDE.md for the same reason.
-->

---

## The tools themselves &#8212; 31 in seven core toolsets, and Grail&#8217;s nine

<div class="tools">
<div>
<p class="tset">McpSessionToolset</p>
<p>abort</p>
<p>commit</p>
<p>refresh</p>
<p>status</p>
<p class="tset">McpExecutionToolset</p>
<p>execute_code</p>
<p class="tset">McpListingToolset</p>
<p>list_all_classes</p>
<p>list_classes</p>
<p>list_dictionaries</p>
<p>list_dictionary_entries</p>
</div>
<div>
<p class="tset">McpBrowsingToolset</p>
<p>describe_class</p>
<p>export_class_source</p>
<p>get_class_definition</p>
<p>get_class_hierarchy</p>
<p>get_method_source</p>
<p>list_methods</p>
<p class="tset">McpSearchToolset</p>
<p>find_implementors</p>
<p>find_references_to</p>
<p>find_senders</p>
<p>search_method_source</p>
</div>
<div>
<p class="tset">McpMutationToolset</p>
<p>add_dictionary</p>
<p>compile_class_definition</p>
<p>compile_method</p>
<p>delete_class</p>
<p>delete_method</p>
<p>remove_dictionary</p>
<p>set_class_comment</p>
<p class="tset">McpTestingToolset</p>
<p>describe_test_failure</p>
<p>list_failing_tests</p>
<p>list_test_classes</p>
<p>run_test_class</p>
<p>run_test_method</p>
</div>
<div class="grail">
<p class="tset">McpGrailToolset</p>
<p>compile_python</p>
<p>eval_python</p>
<p>describe_python_class</p>
<p>list_python_methods</p>
<p>python_module_state</p>
<p>run_python_tests</p>
<p>get_python_source</p>
<p>find_python_senders</p>
<p>search_python_source</p>
</div>
</div>

<!--
Do not read the list. It is here so nobody has to take the tool surface on faith, and so the
shape is visible at a glance: the verbs are GemStone's, not a generic file-and-shell set --
there is no read_file and no bash, because there is no filesystem in the argument.

The column that matters is the first one. FOUR tools drive the transaction, and one of them is
the only thing in the image that commits. Everything else in the picture -- 36 tools -- leaves
the transaction exactly where it found it. Section 7 is built on that sentence.

The dashed column is a third party's toolset that happens to live in this tree: nine tools, its
own options, its own suite, not one line of special handling in core. Section 10 says "copy
this"; here it is only worth pointing at.

If asked why execute_code sits beside the session tools rather than with the writers -- because
it is the one tool that can do anything the other 30 can, which is section 7's full-disclosure
slide, not this one.

Three facts this slide deliberately does NOT print, for whoever asks. The order within a toolset
is registration order, which is the order tools/list answers in. The seven on the left are
defaultToolsetNames -- a deployment takes any subset, and section 2 spends that. And of these
forty, exactly two ever report progress: list_failing_tests, and run_python_tests.
-->

---

## Progress &#8212; a worker cannot write to its own client

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress hl">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

The socket belongs to the front end, and exactly one process may write to it. So a tick goes to the **Stone&#8217;s** inter-session queue instead: **50 messages deep per session**, and `SignalBufferFull` is raised **in the sender** on the 51st. Every send is wrapped, and a dropped tick is an **expected outcome, not a defect**.

</div>

<!--
A per-test tick from a 5372-test suite would blow through 50 in the first second, which is why
the reporter rate-limits. The limit is not politeness.
A progress notification that failed a five-minute test run would make the server strictly worse
than one that said nothing.
If asked which tools actually tick: two. list_failing_tests, per test CLASS rather than per
test, and -- on a Grail image -- run_python_tests, which ticks elapsed seconds while a forked
gem runs. Everything else answers too fast to be worth reporting. The arrow leaves the TOOLSET
because progress:of:message: is an McpToolset method and a handler block's self is its toolset;
McpTool holds only a name, a description, a schema and that block.
-->

---

## signal poller GsProcess &#8212; the collector of progress ticks

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller hl">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

`InterSessionSignal poll`, in a loop until empty, every **100 ms**, in the front-end gem. It parses each payload and routes it **by call id** to that call&#8217;s channel. It has to live here: a forked `GsProcess` runs only while its gem is actively executing Smalltalk, and an idle worker is not.

</div>

<!--
Same fact as section 2's deployment slide, reaching a third conclusion. The front end is the only
party that can act while nothing is happening -- which is also the reaper's whole justification.
-->

---

## McpProgressChannel &#8212; one per streamed call

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel hl">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

Registered in the router&#8217;s `callId`&#8594; channel map for the life of one streamed `tools/call`, and drained to the socket after every wait for the worker. Ticks must be **strictly increasing**, and that is refused **twice** &#8212; once at the reporter, again here &#8212; because the reporter runs arbitrary tool code and this end owes the client a conforming stream.

</div>

<!--
The bug worth telling: the worker sends its final tick and returns in the same breath, so that
tick was still in the Stone's queue when the call's ensure: forgot the channel. Every reported
call lost its last step -- the one saying the work is finished. Hence an explicit drain before
the unregister. A bug that only exists end to end.

SERVER-INITIATED MESSAGES, if they are said here: this is where the status slide's caveat went
when that slide was deleted on 2026-09-13. They are built, and this server needs them -- every
idleness count in section 8 rests on a server-initiated ping -- but the 2026-07-28 draft removes
the direction outright: "servers do not initiate JSON-RPC requests and clients do not send
JSON-RPC responses". Machinery, not a feature with a future to sell.

Be precise about what that wording deletes, because this slide is on the right side of it:
server-initiated REQUESTS go, which is ping and the pending-request table underneath section 8.
Notifications travelling server to client -- progress ticks, this channel -- are not requests and
read as untouched. Do not assert that harder than the quote supports; it is section 13's to
settle. Why build it at all: it is what the clients in the room speak today. Claude Code sends a
session id, opens the GET stream, answers pings, and hands over a progressToken on every call.
-->

---

## McpOutbox &#8212; one session&#8217;s queue of server-initiated messages

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox hl">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

Everything the server wants to say that is not an answer to a request, waiting for this session&#8217;s SSE stream. **Front-end only, and never committed.** It owns the bound and overflow policy, the closing handshake, and the **latest-GET-wins** rule &#8212; because a client may reattach a stream, and only one of them can be the live one.

</div>

<!--
Never committed is not a detail: this is queued work for a socket, and a socket does not survive
a commit record. If the front end dies the queue should die with it.

The protocol caveat on this whole direction -- built, needed here, and forbidden by the
2026-07-28 draft -- is one slide back, on McpProgressChannel, so that it is said once.
-->

---

## reaper GsProcess &#8212; one pass every 60 seconds

<div style="text-align:center">
<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the signal poller. The worker gem holds SessionTemps, and beneath it McpServer, McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in the direction the work travels: a request runs down from McpHttpConnection through the router to McpSession and across to SessionTemps, the router writes every response back up on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under #McpProgress.">
  <defs>
    <marker id="g1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <g class="bx c-client">
    <rect x="6" y="58" width="100" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4" opacity=".8"/>
    <text x="56" y="81" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">MCP client</text>
  </g>
  <line x1="110" y1="70" x2="162" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="62" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">POST</text>
  <line x1="162" y1="86" x2="110" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="126" y="100" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">SSE</text>
  <rect x="146" y="24" width="400" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="346" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem &#8212; McpRouter:8000</text>
  <g class="bx c-http">
    <rect x="166" y="58" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="81" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpHttpConnection</text>
  </g>
  <line x1="300" y1="94" x2="300" y2="112" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="292" y="108" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">request</text>
  <line x1="392" y1="114" x2="392" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="400" y="108" font-size="10.5" text-anchor="start" fill="currentColor" opacity=".7">response</text>
  <g class="bx c-router">
    <rect x="166" y="114" width="360" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M196.1,127.7 A9.5,9.5 0 1 1 186.8,126.1" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round"/>
    <path d="M189.9,124.9 L184.2,124.1 L186.1,129.2 Z" style="fill:currentColor;stroke:none"/>
    <text x="346" y="141" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpRouter &#160;/&#160; McpAuthRouter</text>
  </g>
  <line x1="346" y1="156" x2="346" y2="174" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-session">
    <rect x="166" y="176" width="360" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="346" y="199" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">McpSession</text>
  </g>
  <line x1="253" y1="212" x2="253" y2="230" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-outbox">
    <rect x="166" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="253" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpOutbox</text>
  </g>
  <g class="bx c-channel">
    <rect x="351" y="232" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="438" y="255" font-size="14" text-anchor="middle" font-weight="600" fill="currentColor">McpProgressChannel</text>
  </g>
  <g class="bx c-reaper hl">
    <rect x="166" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="253" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">reaper GsProcess</text>
  </g>
  <g class="bx c-poller">
    <rect x="351" y="288" width="175" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
    <text x="438" y="311" font-size="13.5" text-anchor="middle" font-weight="600" fill="currentColor">signal poller GsProcess</text>
  </g>
  <line x1="438" y1="288" x2="438" y2="270" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="446" y="283" font-size="11" text-anchor="start" fill="currentColor" opacity=".7">by call id</text>
  <rect x="660" y="24" width="474" height="316" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="897" y="46" font-size="17" text-anchor="middle" font-weight="600" fill="currentColor">worker gem &#8212; McpServer:5:978EC559</text>
  <g class="bx c-temps">
    <rect x="680" y="58" width="434" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="897" y="82" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">SessionTemps</text>
    <text x="897" y="100" font-size="12.5" text-anchor="middle" fill="currentColor" opacity=".78">#McpServer &#160;&#183;&#160; #McpFrontEndSession &#160;&#183;&#160; #McpProgress</text>
  </g>
  <line x1="897" y1="110" x2="897" y2="132" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <text x="906" y="125" font-size="11.5" text-anchor="start" fill="currentColor" opacity=".7">McpServer class&gt;&gt;currentServer</text>
  <g class="bx c-server">
    <rect x="680" y="136" width="434" height="42" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="897" y="163" font-size="16" text-anchor="middle" font-weight="600" fill="currentColor">McpServer</text>
  </g>
  <line x1="897" y1="178" x2="897" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="1011" y2="192" stroke="currentColor" stroke-width="1.5"/>
  <line x1="783" y1="192" x2="783" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="192" x2="1011" y2="210" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-dispatcher">
    <rect x="680" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpDispatcher</text>
  </g>
  <g class="bx c-registry">
    <rect x="908" y="214" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="237" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpToolRegistry</text>
  </g>
  <line x1="888" y1="232" x2="904" y2="232" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <line x1="1011" y1="250" x2="1011" y2="286" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx c-toolset">
    <rect x="680" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="783" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">Mcp*Toolset</text>
  </g>
  <g class="bx c-tool">
    <rect x="908" y="288" width="206" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="1011" y="311" font-size="14.5" text-anchor="middle" font-weight="600" fill="currentColor">McpTool</text>
  </g>
  <line x1="888" y1="306" x2="904" y2="306" stroke="currentColor" stroke-width="1.5" marker-end="url(#g1)"/>
  <g class="bx a-request">
    <path d="M528,194 L566,194 L566,84 L676,84" fill="none" stroke="currentColor" stroke-width="1.8" marker-end="url(#g1)"/>
    <text x="574" y="139" font-size="12" text-anchor="start" font-weight="600" fill="currentColor">nbExecute:</text>
  </g>
  <g class="bx a-progress">
    <path d="M678,306 L528,306" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#g1)"/>
    <text x="603" y="296" font-size="12" text-anchor="middle" fill="currentColor">progress ticks</text>
    <text x="603" y="320" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">via #McpProgress</text>
  </g>
</svg>
</div>

<div class="boxnote">

Refresh the front end&#8217;s own view **first**, so everything after it reasons about the repository as it is now; then measure each worker&#8217;s view hygiene, probe the quiet sessions, and reap **last**, so a session found gone while probing is freed in the same pass. Idle 30 minutes by default &#8212; or sooner, if it fails a liveness probe on the stream it opened.

</div>

<!--
The ordering is the argument, not the timeout. Section 8 spends this properly.
On every count except one the worker is better informed -- it can read its own commits-behind,
the stone's backlog, needsCommit. The action still belongs here because the problem case is the
IDLE worker holding a stale view, the one moment that worker cannot run a line of code.
-->

<!-- MCP-GEM-SEQUENCE:END -->
---

<!--
================================================================================
VERTICAL SLICE 4 -- installing, and starting a server. Seven slides -- a lead,
the file-out table that is all that is left of section 1, two for section 2, then
demo A, then two for section 3. The demo is IN THE MIDDLE of the run as of
2026-09-15, not at the end of it, and it is ONE demo as of the same day: what
were demos A and B were merged, and every later demo moved up a letter. Cut 2026-09-11:
second in running order, fourth to be cut. It took the install slide and demo A
on 2026-09-13, when section 1 stopped being a section of its own, and lost four
slides over the two days after -- this slice is now half slides and half demo,
which is deliberate. It is the first place in the hour the room can see the thing
running, and nothing here is worth arriving at it tired.

Running order and plans, in seconds -- lead 10; installation is file-outs 35
(section 1); config on an instance 30, what initialize seeds 35 (65s, section 2);
demo A 150, install then a server; forkOnPort: 45, in the child 40 (85s, section 3).
195s of slides plus 150s of demo -- 5:45. THE TOTAL DID NOT CHANGE ON 2026-09-15,
twice over: neither the reordering nor the merge took a second out of it. What
the merge took out is a page turn.

THE TWO DEMOS BECAME ONE ON 2026-09-15, which this header had been expecting.
They were adjacent on purpose and marked provisional -- install from nothing, then
start a server from a here-doc, one story told twice on the same machine -- and
the note said folding them was the cheapest 60 seconds in the deck and was
expected rather than feared. It cost nothing to do: both faces are on the merged
slide whole, the steps run 1 to 5, and the budget is the same 150 seconds.
WHAT IS STILL PROVISIONAL is the top half of it. Cutting back to a bare
`./install.sh --check` and going straight to run-server.sh is still worth 60
seconds. What is NOT cuttable any more is the slide, because steps 3 to 5 start
the server demos B and E depend on.

WHY THEY MOVED IN FRONT OF SECTION 3, 2026-09-15. They used to close this slice,
so the room met forkOnPort: and the child-gem loop as CODE FIRST and saw a server
only afterwards. Now section 2 says where the config lives, the demos start a
server on that config, and section 3 explains the two methods that just ran. The
room reads the seven steps against something it has already watched work, which
is the difference between a walkthrough and a recap. Nothing was cut and nothing
was rewritten to do it -- the slides are in a different order and that is all.

WHAT IT COSTS, so it can be undone knowingly: the six-minute block of terminal is
now TWO blocks, 2:30 here and 3:30 at demos B and C, separated by the 85 seconds
of section 3. That was a deliberate trade and the demo-run header on demo B
records the other half of it. If the reordering ever feels wrong on stage, the
old shape is demo A moved back behind "Then, in the child".

THE THESIS OF THE PAIR is one sentence and the lead used to print it -- the
section line came off on 2026-09-16, so it is now said rather than read: a server is a gem,
started by evaluating an expression, configured entirely on an instance, and
detached. Nothing about it is committed and nothing about it is a fact about the
image -- which is what lets several differently-configured routers serve one
stone at once, and is also why there is no file on disk to read afterwards --
which is what makes the gem log worth tailing on stage, and is demo A's step 4.

Section 2 is the cheap half and should be run fast. Section 3 is where this
audience is, and it now opens on forkOnPort: rather than on the kernel fact --
"a gem executes no Smalltalk while it is idle" came down on 2026-09-13 because
the gem-contents sequence already puts that fact in front of the room, in the
McpRouter box, fourteen slides earlier. Say it there, not here. What it earned
survives in two places: its three conclusions are in that box's notes (the front
end owns the stream, and owns view hygiene, because only the front end has a
heartbeat -- section 8 comes back for view hygiene, and the stream half went to the
archive with section 6), and its deployment half is
in forkOnPort:'s notes, where the seven steps ARE the picture it used to draw.

SECTION 3 IS TWO SLIDES NOW, and both are code. The banner and transactionless
came down on 2026-09-13 for the same reason, one slide apart: each was being
described immediately before the room could see it. The banner is demo A's step 4
-- a slide listing seven lines of log thirty seconds before tailing the log was
the deck saying a thing out loud and then showing it -- and its notes are on demo
B, in the order to point at them. Transactionless is a clause in section 1's
McpRouter box, fourteen slides earlier, and its argument split in two: the price
and the payoff into that box's notes, the fifteen-hour measurement and the
refreshFrontEndView bug detector into section 8's maintenance-pass slide, where
step 1 is the thing the measurement justifies.

NOTHING IN THIS SLICE DRAWS ANY MORE. The deployment diagram went with the
idle-gem slide, and the loss is smaller than it looks: the gem-contents sequence
spends seventeen slides on the same three kinds of gem, one box at a time, and
the request picture went to archive.md with section 4. If this run ever feels too verbal, the
diagram is in git -- 3441ade and earlier.

DEPARTURES from docs/Presentation.md:
  * the outline gives section 3 "2-3 slides"; it gets two plus the demo, which
    is the outline's floor rather than a departure. It was four until
    2026-09-13; what came off is accounted for above.
  * the outline's forkOnPort: step 2 carries a 3.7.2-compatibility aside -- the
    long-way spelling of newDefaultForGemHost: and useOnetimePassword. The slide
    does not mention it at all, because the code is being changed to the 3.7.5
    spelling and there will be nothing left to explain. Step 2 reads as what it
    does: same user, one-time password, valid 300s, which is true either way.
    Nothing owns whatever the old floor left behind any more: section 12 went
    whole on 2026-09-14, and what survived of it is in slide 22's notes.

WHAT CHANGED ON 2026-09-11 and what the deck now says. McpServer class>>installed
DefaultToolsetNames is GONE: the default surface no longer probes the symbol list
for McpGrailToolset, so nothing joins a server's tool surface by being loaded.
The outline still describes the probe in section 2 and MUST be corrected. Two
consequences the slides take:
  * section 10 ("a server for YOUR software") gets a worked example it did not
    have -- McpGrailToolset is now wired exactly as a third party's would be, so
    section 10 can say "copy this" and mean it literally. Slide 3's last line is
    the forward reference; do not spend section 10's argument here.
Breaking, pre-release, and called out rather than shimmed: a Grail server's
run-server.sh line needs MCP_TOOLSETS or it comes up with 31 tools instead of 40.
As of 2026-09-13 section 2 makes this claim in ONE LINE on the seeds slide and
spends nothing on it; the argument moved whole to section 10, which is the
section that needed it. The seeds slide's notes carry what to say if asked.
================================================================================
-->

<!-- _class: lead -->

# Installing and starting a server

### A gem, forked and detached, whose main activity is the accept loop

<!--
THE SECTION LINE CAME OFF THIS LEAD 2026-09-16, SO IT IS NOW YOURS TO SAY. It
read "**§1–3** · nothing here is committed, and nothing here is a fact about the
image", and it is the thesis of the whole run rather than a label on it -- the
slice header calls it that. Say it over the lead in your own words. Both halves
earn their keep later: nothing committed is why there is no file on disk and the
gem log is the only record of what a router was told (demo A's step 4), and not a
fact about the image is why several differently-configured routers can serve one
stone at once (the config slide, two on).

Where we are: the gem-contents sequence has just shown what is in a front end
and what is in a worker. This run is the first of them being born -- installed on
the next slide, forked four slides later. DEMO B is the second, and it is now the only
place a worker gem is born in front of the room.

The title took "Installing" on 2026-09-13, when section 1 came down to a single
slide -- the file-out table -- and it made no sense to lead a one-slide section of
its own. That slide now opens this run, and the demo sits in the middle of it.

Say the thesis before the first slide, because it makes the rest of the pair
coherent and it is the part this audience will test: a server is an EXPRESSION
someone evaluated. There is no server object in the repository, no configuration
file, no installed service. Kill the gem and there is nothing left to clean up.

Seven minutes for the pair including the demo. Section 2 is the half to run fast;
section 3 is the half this room came for.

If we are behind: this lead slide is the first thing to cut in the whole deck.
-->

---

## Installation is via topaz file-outs

| group | classes | what | when |
|---|---|---|---|
| `src/core/` | 21 | protocol, transport, dispatch, the seven toolsets | always |
| `src/tests/` | 26 | the SUnit suites and their fixtures | always |
| `src/auth/` | 3 | `McpAuthRouter` + its two suites | 3.7.5+ |
| `src/grail/` | 2 | the optional Python toolset + its suite | `--grail` |

* **One `.gs` file per class, canonical `fileOutClass` output**
* It files into any image topaz can log into
* **`Mcp` is the home dictionary**, not `Published`. A user provisioned for MCP needs it in their symbol list

<span class="fine">`install.sh` picks the groups by **probing the image rather than asking**: `src/auth` needs `JsonWebToken` and `JwtSecurityData`, neither of which exists before 3.7.5.</span>

<!--
THE ABSENCE OF A PACKAGE MANAGER CAME OFF THE FACE 2026-09-14. The title read
"There is nothing to install but topaz file-outs" and now reads "Installation is
via topaz file-outs", which describes the mechanism without making the claim. So
SAY IT, once, in the words the title used to use -- there is nothing to install
BUT these file-outs: no package manager, no loader to install first, no runtime
dependency. Then move on; do not defend it. The audience this matters to is the
one that has to file it into an image on a customer machine.

The byte-exact round trip is the part worth one extra sentence, because it is what makes the
rule enforceable: file the class out canonically, diff against the repo, and a difference means a
real difference. Hand-editing a method block into a .gs file is how that property gets lost, and
it is the first thing in the contributor guide.

The counts are classes, not files -- each group also carries its own load.gs. That loader had a
slide of its own until 2026-09-13 and is now this paragraph, because it is four lines of code and
one fact about the compiler: the classes reference each other in BOTH directions -- McpDispatcher
asks McpServer for its name, McpServer builds an McpDispatcher -- so no file order puts every
class ahead of its first mention, and the graph cannot be topologically sorted because it has
cycles. Each load.gs therefore pre-declares its class names bound to nil. That is enough because
the compiler binds a global by its ASSOCIATION and each class definition fills that same
association in, so a method compiled before its referent exists still points at the real class.
Existing keys are left alone, so re-installing over a loaded image changes nothing. Without the
pre-declaration the file-in stops on `undefined symbol`, which is at least loud -- the quiet
version is the lost % after a merge that drops a method with errorcount still reading 0. This is
the one place the file-in depends on the compiler rather than on the project, which is why it is
worth saying to THIS room, and why it is worth saying only if there is time.

HOW IT IS VERIFIED had a slide too, deleted the same day, and this is where its claims live now.
./run-unit-tests.sh runs the in-image suites, EACH IN ITS OWN TOPAZ SESSION, so a suite that blows
up is reported by name rather than silencing the run: 466 base, 522 with auth, about 570 with
Grail -- give the morning's numbers rather than these, since the Grail figure moved twice on
2026-09-10 alone. ./test.sh is the only check that drives the tools OVER THE WIRE, and nothing in
the unit suites covers the transport, so a break there is otherwise silent; ./test-tls.sh is the
same transport over HTTPS with a throwaway cert set only in the forked gem's session, never
committed. GitHub Actions installs 3.7.5 from scratch on ubuntu-latest -- fresh extent, stone,
netldi, with and without Grail -- and runs all three. The sentence that made it a slide, if it is
worth saying at all: for a project with no package manager the question is what proves it still
files in, and that is the workflow's job.

Two suites fail ON PURPOSE: McpExternalSessionTest fails on an unsupported image because that is
how it reports the image -- section 12 is gone and the VERSIONS block at the end of these notes is
where that now lives -- and McpConcurrentEdit
Test>>testTheStoneAloneWouldAllowThatClobber is written to fail on GOOD news (section 7). Seven
suites need a netldi because they spawn real worker gems -- McpAuthTest, McpAuthConformanceTest,
McpExternalSessionTest, McpTransactionTest, McpWorkerDeadlineTest, McpConcurrentEditTest and, since
2026-09-10, McpGrailToolsetTest -- and they need spare LOGIN SLOTS, which is the likeliest cause of
a failure that has nothing to do with the code.

================================================================================
VERSIONS -- section 12 removed whole 2026-09-14, all five slides, and this is
where its argument lives now. It is here rather than anywhere else because THIS
slide's table is what puts 3.7.5 in front of the room, so this is where the hand
goes up. None of what follows is on the slide. Say the matrix; say the rest only
if asked.
================================================================================

THE MATRIX. 3.6.2: no -- no usable GsTsExternalSession on macOS, so no worker
gems at all, and nobody is running it. 3.7.2: no, DROPPED 2026-09-10 rather than
deferred. 3.7.5: yes, including OAuth against a local IdP. 3.7.6+: yes, and an
EXTERNAL IdP. 4.0.0: untested in both directions. Whether the floor settles at
3.7.5 or 3.7.6 is NOT YET DECIDED, and somebody will ask -- an honest "not
decided" is a better answer than a number invented on stage. What decides it is
whether the external-IdP line matters to a deployment.

WHY 3.7.2 WAS DROPPED, in one sentence if the room lets you: the whole of section
8's maintenance pass rests on System continueTransaction, and that primitive is
weaker on 3.7.2 in two ways NOTHING IN src/ CAN DETECT. That is what made it a
design conclusion rather than a support matrix. The method's sourceString is
BYTE-IDENTICAL on 3.7.2, 3.7.5 and 3.7.6 -- the whole difference lives inside
_zeroArgPrim: 9, below the image, where no respondsTo: or any other feature test
reaches.
  (1) A SUCCESSFUL REFRESH DOES NOT REBASE THE CONFLICT BASELINE. S1 reads X, S2
      commits a change to X, S1 sends continueTransaction, S1 writes X, S1
      commits. The refresh answers true and the view moves on both versions --
      and then 3.7.2 REFUSES the commit, #'Write-Write' naming X, because the
      intersection is still taken against the commit record the transaction
      STARTED at. A write S1 has already adopted still counts as concurrent.
      Measured with two real gems -- topaz plus a GsTsExternalSession -- reducing
      to a one-slot Array, and substituting abortTransaction makes 3.7.2 behave
      exactly like 3.7.5, which isolates it to the primitive.
  (2) A FAILED REFRESH DOES NOT RECORD ITS FAILURE. 3.7.2 never writes
      #commitResult at all, so commitConflictPending answers FALSE for a session
      that is genuinely stuck, and everything gated on it goes quiet: no
      [session] line, no named collision, no "abort is the only way out" --
      section 7's whole reporting channel, silent. THE SENTENCE THAT DECIDED IT:
      on 3.7.2 the server cannot see a session that its OWN maintenance refresh
      has doomed. The worst state the session layer knows how to explain is
      exactly the one it goes silent for.

AND 3.7.2 IS NOT THE SAFER IMAGE FOR HAVING (1), which is the reading everyone
takes from that table and it is wrong. Writing an object the other session did
not touch commits just as cleanly there -- so the laundering section 7 exists to
prevent still happens on 3.7.2, and that is the shape the guardrail was written
for: read a method, write a different one. 3.7.2 refuses only the same-object
case, and refuses it SPURIOUSLY, after the session had legitimately adopted the
newer version. The guardrail keeps its full scope there and gains a bogus refusal
on top.

NO OPTIONAL METHODS, and this is the part the room will nod at. GemStone has no
notion of an optional method: absence shows up only as a doesNotUnderstand at
runtime, so there is no list to check against and the support matrix cannot be
DERIVED, only measured. That is why McpExternalSessionTest exists at all, and
why anything present in 3.7.5 may now be referenced directly with no existence
guard -- the live concern is only what is newer than that.

#51438, THE BEST KERNEL STORY IN THE TALK, and losing its slide is the one thing
in this cut worth regretting, because this is the only room that would enjoy it
properly. It no longer bounds support -- fixed in 3.7.4.1 -- so keep it for the
hallway. A Smalltalk bug, so it hits gem-to-gem sessions and not C clients:
resolveResult: fetches the first 1024 bytes into a shared, per-session buffer
that NEVER SHRINKS, then nests the refetch of the full object inside the "is the
buffer big enough?" test, conflating BIG ENOUGH with ALREADY FULL. The length is
freshly fetched and therefore always right, so the failure is not "sometimes you
get less data" -- it is "you always get the right LENGTH and sometimes the wrong
BYTES": exactly 1024 correct bytes and the rest stale from an earlier result, so
JSON fails as "Unterminated string", never as a short read. Sticky for the
session's life; a fresh login clears the poisoned buffer and a small result in
between does not. mcp_server would meet it on its MAIN PATH, since every response
is a String of JSON pulled out of a worker gem. The same shared-buffer aliasing
breaks resolveResult:toLevel: for Arrays (#51563), so returning an Array of small
chunks is NOT the workaround anyone first proposes it to be; repeated calls each
under 1024 bytes is. THE LESSON WORTH CARRYING: a green test.sh on an older
commit was not evidence of absence -- it passed because a smaller class happened
to put the method being checked inside the good first kilobyte. A test that
passes for a reason you did not choose is not a test.

WHAT THE FLOOR MOVING ACTUALLY DELETED, if anyone doubts a decision that changes
no code. It changed code, on 2026-09-11: forkOnPort: and McpSession>>new
WorkerSession were built through hand-expanded equivalents of two kernel
selectors 3.7.2 lacks, and they now send newDefaultForGemHost: and
useOnetimePassword directly. The expansions bought nothing and cost a reader two
comments explaining an image nobody runs. Moving a floor is not an abstraction:
it is permission to delete. ONE newDefault + gemNRS: survives and NOT for
compatibility -- McpGrailToolset>>newGrailTestSession sets an NRS body
(gemnetobject -C ...) to pin the forked test gem's memory budget, and
newDefaultForGemHost: gives nowhere to put one; the commit removed only the
clause that had claimed 3.7.2 as the reason. jwtPassword: never had an expansion
at all, which was the second reason auth cannot run before 3.7.5.
docs/GemStone_Notes.md keeps the 3.7.2 selector table for anyone who HAS to run
there, but no longer tells you to use the expansions unconditionally.

HOUSEKEEPING, for the same hallway. 3.7.2 additionally fails
testTheStoneAloneWouldAllowThatClobber -- the test written to fail on good news,
there reporting something that is not good news -- and
testRefreshAdoptsTheOtherVersionAsTheStartingPoint, plus three more from the
second difference. main372 is archived as the annotated tag archive/main372
rather than kept as a branch: the tag holds every commit and the reason the line
existed without implying it is still maintained. NO .gs FILE CHANGED for the
support decision itself, so an older image may well still load -- right up until
src/auth, which genuinely cannot compile before 3.7.5.
-->

---

## All the config is on an instance. None of it is committed

`run-server.sh` is a here-doc into `topaz -l`. Stripped of the environment handling, the whole of it:

```smalltalk
| r |
r := McpRouter new.
"…any MCP_* setters the environment asked for…"
r forkOnPort: 8000
```

* **There is no class-side config state.** A launch script or a test reconfigures the *instance*; `forkOnPort:` serializes it into the child gem's fork string as JSON
* So **several differently-configured routers can serve one stone at once** — a read-only one on 8001, an authenticated one on 8443 — and none of them is a fact about the image
* What travels in that string is **paths and identifiers only, never key material**

<!--
Run this slide fast. It exists so that nobody spends the rest of the hour looking
for the config file, and it is worth exactly that much.

The claim to make explicitly, because it is unusual enough to be worth saying out
loud: there is no server object in the repository. Nothing was committed when this
started. If you want to know what a running server was told, you read its gem log
-- which is why demo A tails the gem log, and why its banner is seven
deliberate lines rather than a debug dump.

If someone asks why not a config file: the fork string IS the config file, and it
has the property a file does not -- it cannot drift from the process that is
running. Two routers on one stone would need two files and a way to say which.

WHAT TRAVELS IN THE FORK STRING went off the face and came back the same day,
2026-09-15, and the bullet is the answer to a question this room gets to fast: a
fork string is an argv, and an argv is visible to anyone who can run ps. Now that
it is printed, do not read it -- POINT at it and say the specifics, which are not
on the face: the JSON carries a certificate PATH, an issuer, an audience, a user
id; it never carries a private key, a secret or a token. Volunteered it is a
design property; extracted under questioning it sounds like a concession.
-->

---

## What `initialize` seeds, and what stays `nil`

| subject | seeded defaults |
|---|---|
| concurrency | `maxSessions` **3** — `nil` means *no cap*, which is a setting in itself |
| session lifetime | `sessionIdleTimeoutSeconds` 1800 · `livenessProbeIntervalSeconds` 120 · `reaperIntervalSeconds` 60 · two stream deadlines, 60 and 10 · `requestTimeoutSeconds` `nil` · `maxSessionLifetimeSeconds` `nil` |
| view hygiene | `maxCommitsBehind` 20 · `stuckViewGraceSeconds` 60 · `pinnedViewGraceSeconds` 300 |
| this gem | `frontEndTransactionMode` `transactionless` |
| security | `allowedOriginHosts` loopback · `messageTrace` false |

**Where `nil` resolves to a default:**

* `workerClassName` → `McpServer`
* `toolsetNames` → `defaultToolsetNames`
* `workerUserId` → the front-end gem's own user

<!--
THE RULE CAME OFF THE FACE 2026-09-15, SO IT IS NOW YOURS TO SAY, and the slide
does not survive without it -- a bare table of defaults is a reference card, and
the rule is what makes it an argument. It is one sentence: SEED A FIELD WHEN nil
WOULD BE UNSAFE, OR WHEN nil IS ITSELF A SETTING. Say it before they start
reading, because it is the only thing that tells them what the table is FOR.

Do not read the table. Say the rule, let them scan, and move on -- the numbers
are all on later slides where they matter, and this one is here so that section 8
does not have to stop and explain where 20 came from. maintenanceCallTimeoutSeconds
(5), streamlessIdleTimeoutSeconds (60) and streamLossGraceSeconds (10) are the
three seeded values not spelled out, for room; section 8 introduces all three
where they are used.

The rule is the slide even though it is no longer printed on it, and it is worth
one extra sentence if there is time: the awkward cases are the ones where nil is
MEANINGFUL. maxSessions nil is "no cap at
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

workerUserId is the third of the three, and the only one whose default is a
SECURITY default rather than a convenience: nil means the worker gem logs in as
whoever started the front end, so an unconfigured server is exactly as privileged
as the person who launched it. It is one line here and section 9's whole argument
later. Two things to have ready if the hand goes up now: it is per ROUTER, not per
session -- every worker this router opens is the same GemStone user -- and
McpAuthRouter REFUSES it, because there the bearer token names the user. Say
"section 9" and move on.

THE TOOL SURFACE, absorbed 2026-09-13 from the slide that used to follow this
one. The last line of the slide is all that is left of it, and the argument
itself is section 10's now -- these are the things worth having ready if a hand
goes up.

Say the change out loud if this room read the README before it. Until 2026-09-11
the default PROBED the symbol list and appended McpGrailToolset whenever
src/grail/ had been filed in, so INSTALLING the group configured every server in
the image. Breaking, pre-release, and called out rather than shimmed: a Grail
server's run-server.sh line now needs MCP_TOOLSETS or it comes up with 31 tools
instead of 40.

Two reasons it had to go, and the second is the one that matters for the rest of
the hour. An optional toolset can carry a dependency the image knows nothing
about -- Grail's tools read the .py checkout MCP_GRAIL_DIR names, so such a server
was answering for a directory nobody chose. And turning a toolset on should look
the same whoever wrote it: with the probe gone, McpGrailToolset is wired exactly
as a third party's would be, which is what lets section 10 say "copy this". Do
NOT spend that argument here; it is section 10's whole opening.

Nothing silently degrades, which is what makes it a safe break: the tools are
ABSENT from tools/list rather than present and failing, and a client cannot call
what it was never offered. The sharpest version of the old behaviour, if you want
it: on an image where MCP_GRAIL_DIR had never been set, every server in the image
advertised nine tools that could not work.

MCP_TOOLSETS names the surface -- the core seven PLUS yours. MCP_GRAIL_DIR only
CONFIGURES it, and validateWorkerConfig refuses to start a router holding options
for a toolset it does not serve (section 10 again). The list is resolved per
session, in the front end, so a toolset filed in after startup reaches the next
client, and section 9's authenticated router can narrow it per principal -- only
possible on the side that holds the token. 31 tools by default, 40 when Grail is
named.

McpContractTest pins this in the CORE suite rather than the Grail one, which is
the right place for it: the property is that an unconfigured router's surface
does not depend on which optional groups the image happens to carry, so it has to
be asserted on an image that carries them.
-->

---

<!-- _class: demo -->

# DEMO A — install and run a server

```bash
./install.sh --check
./install.sh
```

1. The **environment report** — `GEMSTONE`, the stone, the netldi, and `GEMSTONE_GLOBAL_DIR`
2. File-in, group by group, and one commit

```bash
./run-server.sh
lsof -nP -iTCP:8000 -sTCP:LISTEN     # find the gem PID
```

3. The script returns immediately — and prints **the session id, the host pid, and three ways to stop it**
4. `tail` the gem log: **the banner**, the whole configuration of a server that has nothing on disk
5. `System cacheStatisticsForAllSlotsShort` — **`McpRouter:8000`**, alone, with no workers yet

<!--
TWO DEMOS RUN AS ONE, MERGED 2026-09-15. This was demo A (install from nothing,
60s) and demo B (a server from a here-doc, 90s), adjacent since 2026-09-13 and
already one continuous stretch of terminal; the slice header called folding them
"the cheapest 60 seconds in the deck" and expected it. Nothing was cut to do it
-- both faces are here whole and the steps simply run 1 to 5 -- so budget it as
the two added up, 150 seconds, rather than as one demo's worth. EVERY LATER DEMO
MOVED UP A LETTER the same day: what was C is now B, D is C, E is D, F is E, G
is F, and H is G. Anything written before 2026-09-15 that names a letter means
the one after it.

WHAT THE MERGE CHANGED THAT IS NOT COSMETIC: this used to be the FIRST thing to
cut if we were behind, because it was only the install. It is not any more.
Steps 3 to 5 start the server that demo B opens a session against and that demo
E reads view hygiene out of, so cutting this slide now cuts the live thread of
the whole talk. WHAT IS STILL CUTTABLE IS THE TOP HALF: run `./install.sh
--check` alone, say that the file-in happened, and go straight to run-server.sh.
That is the sixty seconds, and it is still the cheapest sixty in the deck.

On 2026-09-15 the pair also moved forward past section 3, so the room sees a
server exist before it is shown the two methods that make one; demo B still
picks up the same terminal two slides later.

What to point at while it scrolls: the line where it decides about auth. That is the whole version
story in one line of output. Nothing comes back to it now that section 12 is gone -- slide 22 is
where the version numbers get said, and its notes carry the argument if it is asked for.

THE AUTH LINE CAME OFF THE FACE 2026-09-15, SO IT IS NOW YOURS TO SAY. It was
step 2 and it read "The group selection deciding itself: auth in or out by
probing the image for JsonWebToken". The output still scrolls past whether or
not the step is printed, so point at it: the installer does not ask which
GemStone this is, it asks the IMAGE what it can do, and it files in the auth
group only if the image already understands JsonWebToken.

THE GEMSTONE_GLOBAL_DIR FINE LINE CAME OFF THE SAME DAY. Verbatim: "**`GEMSTONE_GLOBAL_DIR` is
the variable that decides whether anything works.** Get it wrong and you get `getaddrinfo failed,
EAI error 8 ... Number: 4065`, which reads like DNS and is not. `--check` is the first thing to run
on a new machine." The error number is the part worth carrying in your mouth rather than in a
slide: it is what turns a ten-minute confusion into a ten-second one, and this room will have seen
it.

Do NOT get drawn into GEMSTONE_GLOBAL_DIR here beyond the one sentence. The full version is in the
README and it is a ten-minute conversation: netldi and stone each bind an ephemeral port and record
it under that directory, /etc/services is a trap rather than a fix, and install.sh logs in linked
(-l) specifically so it needs no netldi at all.

================================================================================
FROM HERE DOWN, THE NOTES OF WHAT WAS DEMO B, moved whole on 2026-09-15 when the
two slides became one. They are about steps 3, 4 and 5 -- run-server.sh, the gem
log, and the single cache row.
================================================================================

Have the log path resolved BEFORE the talk and the lsof line in scrollback -- the
one-liner is the demo's only fragile part, and hunting for a gem log on a
projector is dead air.

What to point at, in order: the three stop lines (there is no pid file, this is
the record), then the toolsets line in the banner -- which is the one line
section 2 spends on toolsetNames, live, and the moment to say "seven toolsets,
thirty-one tools, and Grail is not among them because I did not name it". If the demo machine has a Grail
checkout, having a SECOND server on 8001 with MCP_TOOLSETS set is a thirty-second
addition that makes the point better than any slide: same image, two servers,
different surfaces.

Then the single cache row. It is worth a beat on its own precisely because it is
lonely -- one gem, no workers, nothing else in the repository knows this server
exists. DEMO B is the payoff.

Fallback if the fork fails on stage: the banner is a screenshot, and say so
without apologising. The thing that actually fails here is a netldi that is not
running, which --check would have caught -- and since the merge the --check is
step 1 of this same slide, so by the time the fork runs it is already de-risked.

THE BANNER, absorbed 2026-09-13 from the slide that used to sit just before this
run. It came down because step 4 puts the real thing on the projector, and a
slide describing seven lines of log immediately before the log itself was the
deck telling the room something it was thirty seconds from seeing. What that
slide argued is worth saying over the scroll, in this order.

The frame first, and it closes section 2's open question: nothing is committed
and nothing is on disk, so THE GEM LOG IS THE CONFIGURATION. It is the only
record of what this router was told, which is why it is seven deliberate lines
written immediately after the bind rather than a debug dump.

Then point at lines, not at all of them. Listening address and scheme; workers
and toolsets, which is the surface section 2 resolved and is already the second
thing to point at above; session lifetime and the concurrency cap on SEPARATE
lines, because how many
at once is a different question from how long each lasts; view hygiene in full,
which section 8 will come back and read.

The two lines that are read BACK rather than reported are the same idea twice and
are the best thing on the screen: the shared cache name comes from the cache, so
the log and System cacheStatisticsForAllSlots cannot disagree -- a name over 31
characters arrives truncated -- and the transaction mode is what the GEM REPORTS,
not what was configured. The banner must say what IS, not what was intended,
because the two diverge in exactly the cases somebody is reading the log to
understand.

Last, the trace line, which appears ONLY when tracing is on. Ten seconds if the
room is warm, because it generalises past this server: a reader has to be able to
tell a QUIET server from an UNTRACED one, or an absence of message lines reads as
an absence of traffic -- the wrong conclusion, and the expensive one. Silence is
ambiguous, so a log has to say when it is not recording.

THE TWO FINE LINES THAT CAME OFF THIS HALF OF THE FACE, 2026-09-15. Verbatim:
"Leave the `tail -f` running. DEMO B adds the worker rows to the same cache
statistics, and DEMO E reads view hygiene out of this same log." and "**90
seconds.**" The first is a STAGING instruction rather than an argument and it is
the one to keep in your head, because it is now the only place the dependency is
written down: leave the tail running and do not clear the terminal, since two
later demos read that same log and that same scrollback.
-->

---

## `McpRouter>>forkOnPort:`

1. `validateWorkerConfig` + `validateTimerConfig` — in the launching session, not just the child
2. Build a `GsTsExternalSession` with a one-time password
3. `login`
4. Capture `stoneSessionId` and the host pid _before_ launching the loop — once the non-blocking call is running, the external session refuses further queries (`GciError`, *operation in progress*)
5. `forkAndDetachString: 'McpRouter runOnPort: 8000 configJson: ''{…}'''`
6. `logout` the handle — the child is independent
7. Answer a status string carrying three ways to stop it: `./stop-server.sh` (by port), `System stopSession: <id>` (from any session), `kill <pid>` (shell)

<!--
THE BOLD CAME OFF ALL SEVEN STEPS ON 2026-09-16, and the title lost ", in order".
Nothing was cut -- every word is still there -- but the slide no longer tells the
room where to look, so the two paragraphs below are now the only thing doing it.
Steps 4 and 7 were the bolded ones and they are the two that matter.

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

THE DEPLOYMENT HALF, absorbed 2026-09-13 from the picture slide that used to sit
two slides back ("a gem executes no Smalltalk while it is idle"). The kernel fact
it argued now lives in section 1's McpRouter box, where the room meets it first;
what follows is what the picture showed, and these seven steps ARE that picture.

The launching session is gone by the time anything is served, and that is the
part worth saying out loud: topaz forks the child, hands it the config as JSON,
and logs out. Nothing is left behind -- no pid file, no service manager, no server
object in the repository. Step 6 is that moment; say "the child is independent"
and mean it literally.

If someone asks what happens to the workers when the front end dies: every
attached worker dies with the process owning its GCI connection, which is also
why ./stop-server.sh leaks nothing. That is section 8's material; one sentence
here at most.
-->

---

## Then, in the child: bind, name, fork, loop

`McpRouter class>>runOnPort:configJson:` → `applyConfigJson:` → `applyFrontEndTransactionMode` → the instance-side `runOnPort:`

* `makeListenerOnPort:` — **loopback only**, and `bindAddress` has **no setter** on the base class: a base `McpRouter` authenticates nothing, so a reachable port would be an open door into the repository. `McpAuthRouter` is the class that adds one
* `nameThisGem: 'McpRouter:8000'` — **after the bind.** A gem that failed to take the port is not this server
* `forkReaper` + `forkSignalPoller` — two `GsProcess`es, running *during the loop's waits*

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

THE TWO FORWARD POINTERS CAME OFF THE FACE 2026-09-14 -- the bullets read
"McpAuthRouter is the class that adds one (§9)" and "forkReaper (§8)". Say both
as asides rather than letting the room wonder whether either is ever explained:
the reaper forked here is what section 8's whole maintenance cycle runs in, and
the router that takes a reachable port is section 9. This is the only slide that
names either before its section arrives.

Have this ready if anyone is reading along in the source and asks why the
transaction mode is applied in the CLASS-side runOnPort:configJson: and nowhere
else. That is the only way in that owns its session outright -- the gem was forked
to evaluate this expression and does nothing afterwards. The instance-side
runOnPort: runs in an interactive topaz, in YOUR session, and applying the mode
there would abort and silently discard your uncommitted work. It is the difference
between a method that owns its gem and one that is a guest in yours.
-->

---

<!--
================================================================================
DEMOS B AND C -- what is left of sections 4, 5 and 6, and it is two demos.
Assembled 2026-09-14, when the target came down to 45 minutes and three stretches
of slides went to archive.md. The sections that walked a request in and out are
gone; their demos are not, because a demo shows in ninety seconds what those
slides argued in eight.

THIS IS TWO DEMOS, NOT FOUR, AS OF 2026-09-15, AND THE LETTERS ARE NOT THE ONES
THEY WERE. It read "four demos now run as one stretch of terminal" until the
install-and-start demo moved forward to sit between section 2 and section 3,
which is where the slice 4 header argues it belongs; later the same day the two
demos that moved were merged into a single demo A, and every letter after it came
up one. So demo A is one stretch, back there; B (a session is a gem) and C (a
long call reporting while it runs, if the clock allows) are this one. Nothing but
the deck's own page turn separates B from C -- run the two as one continuous
thing, one terminal, one scroll.

THE TERMINAL IS STILL THE SAME TERMINAL, and that is the thing to preserve
through the reordering: B opens a session against the server demo A started and
the scrollback from A is still above it, so do NOT clear between them and do not
restart the server for B. The 85 seconds of section 3 that now sit in between are
slides, not terminal; the machine does not know they happened. Said out loud once
-- "this is the server we started before those two slides" -- the break costs
nothing and the code slides gain a running example.

Running order and plans, in seconds -- demo B 120, demo C 90, so 3:30 here, with
demo A's 2:30 earlier. Six minutes of terminal in the hour, no longer six
minutes of it at once: this is now the second biggest uninterrupted block in the
talk rather than the biggest, and budget it as 3:30 rather than as part of a six.

WHAT THE DEMOS NOW CARRY ALONE, and the notes on each say it in place:
  * demo B is the only place a worker gem is born in front of the room, and the
    only sight of a session id, a tools/list, and the cache-statistics row that
    did not exist ten seconds ago. It was always the load-bearing demo; it is now
    load-bearing without a net;
  * demo C is the only surviving material on progress notifications beyond four
    boxes of the gem-contents sequence. Its own closing contrast -- same call,
    one token's difference -- has to do the work that five archived slides did,
    so do not skip the contrast even if the rest of it is rushed.
DEMO C IS STILL THE ONE TO CUT if the clock has gone, and cutting it now costs
the progress story entirely rather than costing it a demonstration. That is a
real loss and worth knowing before making it, but it is the right cut: everything
after this point in the deck is material nothing else covers.
================================================================================
-->
<!-- _class: demo -->

# DEMO B — a session is a gem

```bash
curl -i -X POST localhost:8000/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{…}}'
```

1. **`MCP-Session-Id:` comes back in the header** — and `serverInfo` names the version
2. `tools/list`, echoing that id — **31 tools**
3. In topaz: `System cacheStatisticsForAllSlotsShort` — **the `McpServer:5:…` row that did not exist ten seconds ago**, beside the `McpRouter:8000` from DEMO A

<!--
The load-bearing demo of the talk. Rehearse it more than any other except E.

Order matters here as much as it does in the code. Do the initialize FIRST with
the topaz window already showing one row -- McpRouter:8000 and nothing else --
then run the curl, then re-run the statistics line. The gem appearing is the
whole demo, and it is ruined by a topaz window that was already showing three
rows.

Have both curls written down. Improvising a JSON body on a projector is how this
one dies, and the params object is long enough to fumble.

What to say while the tools/list output scrolls: 31, the same number the tool
inventory in the gem-contents sequence showed and the same number the worker
logged when it booted. If a Grail server
is also running on 8001 from demo A, this is the moment to show 40 beside it.

If the room asks to see the session end: DELETE /mcp with the same id, then the
statistics line again, and the row is gone. It is fifteen extra seconds and it
closes the loop -- but only if we are on time.

THE TWO FINE LINES CAME OFF THIS FACE 2026-09-15, and both were instructions to
you rather than argument for the room, so nothing on screen was lost. Verbatim:
"**This is the demo that makes “a session is a gem” concrete, and the one to keep
if only one survives.** Practise the cache-statistics line until the three rows
are readable on a projector." and "**2 minutes.**" The first sentence is the
paragraph above this one, said shorter. The practice note is the part to act on
before the day rather than to read on it, and it is the only place the deck says
the cache-statistics output is the fragile thing on a projector.
-->

---

<!-- _class: demo -->

# DEMO C — watching a long call report

```bash
curl -N -X POST localhost:8010/mcp -H 'MCP-Session-Id: …' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{… "method":"tools/call","params":{"name":"run_python_tests",
       "arguments":{"classNames":["DjangoTestCase"]},"_meta":{"progressToken":"p1"}}}'
```

1. `notifications/progress` frames **arriving while the call runs** — `p` in seconds, and the class it is on
2. The result as the **final frame** on the same stream
3. The same call **without** the token: **one JSON object**, and nothing until it is done

<span class="fine">**`Accept: text/event-stream` is what turns the frames on** — without it the token is read and ignored. Measured cold: `DjangoTestCase` **25s**, `FlaskScaffoldingTestCase` **262s**.</span>

<!--
The most timing-dependent demo in the deck and still the second to cut -- but the
reason changed on 2026-09-14. It used to be cuttable because section 6's slide 4
told its story anyway; that slide is archived, so cutting this now drops progress
notifications from the talk altogether. If it runs, the contrast at the end is the whole point:
same call, one token's difference, and the difference between a client that can
see a job moving and one staring at a closed fist for half a minute.

THIS RUNS ON 8001, the Grail server from demo A, and it needs its OWN session id:
ids are per server, so the one demo B took from 8000 is not valid here. Initialize
against 8001 first. The reason it cannot stay on 8000 is demo A's own line --
"Grail is not among them because I did not name it" -- so the server that has
run_python_tests has to be the second one.

run_test_class CANNOT be substituted, and the slide said otherwise until
2026-09-15. It reports NO progress at all, deliberately: per-test progress means
iterating the suite by hand, and measured on 3.7.5 that changed the counts
(McpTestingToolset>>tool_run_test_class:). A client that opts in gets one JSON
object -- which is the "without the token" half of this demo's own contrast, with
nothing on screen to say why. The class it named, McpRouterTest, never existed
either; nothing in the Mcp suite is slow enough to be worth watching in any case,
the whole set of 22 classes runs in about a second.

Choose the suite by WALL CLOCK, and run_python_tests is the tool that reports one:
it ticks every 5 seconds with elapsed seconds and the class it is on. Measured
here 2026-09-15, each in a fresh gem: DjangoTestCase 25s (4 tests, all passing,
30% of the memory ceiling), ZipfileTestCase 4s, EnumTestCase 1s. Django is the
pick -- about five ticks, and it ends green. Have the class name written down;
this is the demo most likely to be improvised badly.

-N is not optional on that curl: without it, curl buffers and the frames all
arrive at once, which shows the opposite of what the demo is for. Neither is the
Accept header: progressTokenFor:accepting: wants THREE things before it streams --
a tools/call, a progressToken, and an Accept offering text/event-stream -- and
missing the third fails silently onto the plain-JSON path.

AN ASIDE IF IT LANDS: DjangoTestCase fails 4 of 4 in a warm session and passes 4
of 4 in a fresh gem. That gap is the whole reason the tool forks a gem to run
Grail's tests, and it is one sentence.

Fallback: a screenshot of the frame sequence, and say so plainly. The frames are
identical every run, so a screenshot loses only the liveness. The two end-to-end
bugs that used to back this up are in archive.md now; if the screenshot is all
there is, the one worth telling from memory is the client that opts in and gets
nothing back, because it is the kind of bug no unit test can hold.
-->

---

<!--
================================================================================
VERTICAL SLICE 1 -- section 7, the transaction model and the blind-write
guardrail. Eight slides. Re-cut 2026-09-10 to the running order below, then cut
hard on 2026-09-14 -- six slides came off that day; it diverged from the outline
on purpose:

  * the measured seven-line trace is now speaker notes on the agent diagram, not
    a slide;
  * "why this never needed to exist before" is dissolved into the agent diagram,
    whose closing blockquote it now is;
  * one new slide: the human-in-a-browser diagram, the guard working. It is the
    setup for the agent diagram and the two are read as a pair.

THE GUARDRAIL IS ONE SLIDE NOW, "the rule, the ledgers, and the stamp", and that was
the second cut of 2026-09-14. It absorbed the re-validation paragraph and the
granularity problem into its own prose, so "two consequences that shape
everything after" and "re-validation: what the client is told when the view
moves" were both saying what the slide already says. "What licenses what" -- the
six-row table of which read licenses which write -- came off for TIME rather than
for being wrong; it is the most detailed slide in the section and the room does
not need the table to believe the rule. All three are speaker notes on the
surviving slide, the licensing table explicitly marked as question-time material,
and the two invariants under it (creation is never blind; a write implies a read,
so writeLedger is a subset of readLedger) are worth saying aloud even without it.

WHAT CAME OFF EARLIER ON 2026-09-14, and where it went. "One pass" -- the design that
makes every tool succeed by making commit meaningless -- is now speaker notes on
the agent diagram, told as four beats, because it is that picture's consequence
rather than a claim of its own; the four-way refresh measurement went with it, as
did the canary story. "Why the repository does not catch it" is speaker notes on
the human-in-a-browser diagram, which already shows the mechanism working: this
room knows the bitmap intersection, and what was left worth saying is one sentence
about reads having no date, plus the StrongReadSet caveat.

THE TWO PICTURES ARE STILL ADJACENT, BUT THE [session] EXAMPLES CAME BACK IN
FRONT OF THEM ON 2026-09-16. They had been moved BEHIND the pictures on
2026-09-14, and the argument recorded here at the time was that "the examples
read as consequences once the room has seen what goes wrong, and as a wall of
prose before it". That is now reversed: the examples sit immediately after the
instructions slide, which is the slide that PROMISES them, so the room reads the
[session] line while the paragraph explaining it is still a page behind rather
than four.

WHAT THE REVERSAL COSTS is exactly what the 2026-09-14 note named, so it is worth
knowing rather than rediscovering on stage. The examples now arrive before the
room has seen a commit refused or a write land silently, so the second one --
"Your last commit FAILED" -- is prose here rather than a payoff. Spend less time
on it in place and point BACK at it from the agent picture, which is now two
slides further on instead of one slide earlier. If it reads as a wall on the day,
the way back is the [session] slide moved behind the agent picture again.

The accent colours on the two
pictures are deliberately the wrong way round: the REFUSED commit is red and the
SUCCESSFUL one is green, and saying why is the point of the pair.

LAST OFF, 2026-09-14: "keeping the measurements honest". Its two suites and its
fail-on-good-news blockquote were lifted onto the execute_code slide, which is
now the section's closing slide and says both things at once -- here is the hole,
and here is what keeps the rest of it honest. The rest of that slide, including
the sentence about revisiting the design's scope if the test ever starts failing,
is speaker notes there.

Budget: 11:10 at the plans in docs/Presentation.md's demo inventory -- 490s of
slides plus a 180s demo. The six slides cut on 2026-09-14 give back something
like 270s of that, which puts the slice near 6:40 and makes it the shortest of
the two GemStone sections rather than the longest. execute_code now carries two
ideas rather than one, so give it 50 rather than the 30 it had. The agent diagram, FIFTH in
the slice since the [session] slide moved in front of the pictures on 2026-09-16
-- it was fourth -- carries 90 seconds and is the one to protect; "the rule, the ledgers,
the stamp" is now the only slide standing between it and execute_code, so it can
afford 60 rather than the 40 it had.
================================================================================
-->

<!-- _class: lead -->

# Transactions and the blind-write guardrail

### A browser invariant, restored by rule

<!--
THE SECTION LINE CAME OFF THIS LEAD 2026-09-16, SO IT IS NOW YOURS TO SAY. It read
"**§7** · the second of the two sections that do not survive being read afterwards", and it is a
warning about THIS ROOM rather than about the material: sections 7 and 8 are the two where a
reader of the slides afterwards gets the facts and misses the argument, so they are the two to
spend breath on rather than to hurry. The other one is section 8, which follows immediately.

Where we are: the demos have just shown a worker gem being born and a long call reporting while
it runs. The sections that walked a request in and out line by line are archived, so this section
follows the demos directly -- which changes the pitch here: the room has SEEN a session, it has not
been walked through one. This section and the next are the two that are actually about GemStone
rather than about HTTP.

The shape of this section, said up front so nobody waits for it: two pictures, then the design
that looked like the obvious fix and was not, then the mechanism. The mechanism is the least
interesting part. The reason it has to exist is the interesting part.

Eleven minutes including the demo. If we run long, the demo is the part to protect.
-->

---

## Tell the agent about transaction views

<div class="verbatim">

<p>This server is one GemStone session, in one long-running database transaction, for as long as the connection lasts.</p>

<p><span class="cap">YOUR VIEW IS A SNAPSHOT.</span> You see the repository as it was at one instant. It moves when YOU move it -- `commit`, `abort` and `refresh` each take a current view -- and in one other case: if it falls far behind, so that it is holding the repository's commit records open, the server refreshes it for you. That happens only BETWEEN your calls, it keeps your uncommitted changes, and it tells you on your next result. Either way, anything you read before the last view move may since have been changed by somebody else.</p>

<p class="elide">[ ... ]</p>

<p><span class="cap">WHAT SURVIVES A CALL.</span> Every change you make stays in your session until you commit or abort it -- so you can compile a method, run its tests against what you just compiled, and only then decide to keep it. Nobody else can see any of it until you commit.</p>

<p><span class="cap">NOTHING COMMITS FOR YOU.</span> Only the `commit` tool commits. The tools that change the image (compile_method, compile_class_definition, delete_class, delete_method, set_class_comment, add_dictionary, remove_dictionary) leave their work uncommitted. `abort` discards everything uncommitted; `refresh` takes a current view and keeps your uncommitted changes.</p>

<p class="elide">[ ... ]</p>

</div>

<!--
This is `McpServer class>>defaultServerInstructions`, sent in the initialize result -- not all of
it. 551 words in the image, a little under half of them here. It was the whole thing on one slide
until 2026-09-14, on the theory that FITTING was part of the point; it fitted at 15px, which is
not the same as being readable from the back of a room. The two elision marks are real omissions
and both are worth naming aloud rather than skipping past.

The body is still a prop, but now it is a prop that can be read. The orange headings are the
argument.

Point at, in order:
  * "one long-running database transaction, for as long as the connection lasts" — this is the
    sentence that makes a session a gem rather than a request handler.
  * SNAPSHOT: "and in one other case" — that clause is section 8, view hygiene, and it was added
    the day the server started moving a client's view for it.
  * THE FIRST ELISION is the paragraph the rest of this section is the argument for, so restore it
    from memory in two sentences. The database refuses a commit against a view that has moved and
    writes nothing, which is what makes the snapshot worth having; and a refresh mid-plan is
    therefore not free, because it adopts the other session's version as your starting point, so a
    change made on the strength of what you read EARLIER commits cleanly over their work. Then
    quote the line it ends on, because it is the one instruction in 551 words that asks the model
    to do something it would not otherwise do: "If you read something, thought about it, and are
    only now acting, RE-READ IT FIRST." That exists because the failure three slides from now is
    real.
  * NOTHING COMMITS FOR YOU: says out loud that the mutation tools leave work uncommitted. Six
    weeks ago every one of them committed inside its own call, which is slide 6.
  * THE SECOND ELISION is the [session] line -- four paragraphs of it. The slide showing the line
    itself is THE VERY NEXT ONE as of 2026-09-16; it sat three slides later, behind the two
    pictures, from 2026-09-14 until then. So point FORWARD at it rather than promising it: say
    that four of its shapes are on the next slide, and that the line is unintelligible without
    the paragraph elided here, which is most of why these instructions exist at all. The last thing cut with it is worth
    keeping in your pocket for the questions: a failed commit is the one failure here you cannot
    retry your way out of, and the conflict is reported per CLASS rather than per method, so two
    sessions compiling different methods on one class still collide.

MCP calls `instructions` a hint to the model rather than documentation for a person, so what goes
in it is what a model cannot get from tool descriptions read one at a time: what a session IS
here, and which of its properties outlive a call. Kept short because it is prepended to the
model's context for the whole conversation, so every sentence competes with the client's own
prompt for attention.

If asked: a session whose user cannot commit is still sent this, and still needs it -- it
accumulates pending work exactly as any other does, and the [session] line points it at abort
rather than at commit. Section 11.
-->

---

## Session status is appended to tool results

<p class="exlbl">uncommitted work pending</p>
<p class="ex">[session] You have uncommitted changes. No tool commits for you: call commit to persist them or abort to discard them. They are lost if this session ends first.</p>

<p class="exlbl">the client's own commit was refused</p>
<p class="ex">[session] Your last commit FAILED: another session changed the same objects since your view was taken (Write-Write(2)). Nothing was written. Your changes are still here but cannot be committed and your view cannot move until you call abort, which discards them -- save anything you need first, then abort, re-read, and redo it.</p>

<p class="exlbl">the server moved the view, and the pending work is now doomed</p>
<p class="ex">[session] The server refreshed your view -- it had fallen far enough behind to be holding the repository's commit records open -- and your uncommitted changes now CONFLICT with work another session has committed: it changed McpFixtureA. They cannot be committed, and abort is the only way out [...]</p>

<p class="exlbl">the view moved, and some reads no longer hold</p>
<p class="ex">[session] The view moved: 2 of 7 earlier reads are stale and must be re-read before writing to them: Foo>>bar:, Baz:shape.</p>

<!--
Four of the five shapes; the fifth is a nested transaction, which just says commit and abort
cannot reach the outer one.

Read the second and third aloud one after the other, because the difference between them is the
detail I would defend hardest. Same jam — view moved, pending work un-committable, abort the only
way out — but two different causes, and the client must not be told the wrong one. "Your last
commit FAILED" is right only when a commit is what failed. Where the SERVER's own refresh doomed
the work, the client made no commit at all and would go looking for one it never made.

The claim that used to be the slide's last line, and is worth making out loud because nothing on
the screen says it any more: every one of these is computed from the state the session is left in
AFTER the tool ran, not the state the call arrived in. That
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

## A human uses a browser.

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
  <circle cx="810" cy="66" r="6" fill="#b4451f"/>
  <text x="810" y="46" font-size="16" text-anchor="middle" font-weight="600" fill="#b4451f">commit &#10007;</text>
  <text x="810" y="94" font-size="14" text-anchor="middle" fill="#b4451f">refused, nothing written</text>
</svg>
</div>

**S2 commits *after* S1's view — so it is still in `writeSetUnion`.** X is in both write sets, and the stone refuses. Nothing is lost, and S1 is told.

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

WHY THE REPOSITORY CANNOT DO BETTER, absorbed 2026-09-14 from the slide that used to sit after these
two pictures. It came down because this slide already shows the mechanism working and this room
knows the mechanism; what is left is one sentence and one caveat, and both belong here.

The mechanism in one line: at commit the stone intersects OOP bitmaps -- writeWriteConflicts =
writeSet * writeSetUnion, where writeSetUnion is the union of the write sets of every transaction
committed since your view. No timestamps, no per-object versions. Only your VIEW is dated; the
objects are not. So it cannot express a question about reads even in principle -- there is nothing
on a read to compare. It answers one question and answers it well: did anyone change something I am
WRITING, since I last looked at the repository? It has no opinion about what you read, or how long
ago you read it.

Be explicit that this is not a defect being worked around. It is an optimistic check doing what an
optimistic check does, and the next slide is where that stops being enough.

The caveat, for the hand that goes up: the alternative IS available. The StrongReadSet -- hidden set
38, deliberately ordinary-user-writable -- makes your commit fail when another session changes an
object you only READ, with a Read-Write entry. Put a long-browsing session's reads in it and the
session becomes progressively unable to commit anything at all. I declined that trade, and it is in
the known limits later in this section. Worth knowing: the Programmer's Guide names StrongReadSet
once, in a table, and never mentions GsBitmap or hidden sets -- treat it as undocumented-but-real
and re-verify per version.
-->

---

## An agent uses tools.

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
  <line x1="470" y1="30" x2="470" y2="250" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 5" opacity=".5"/>
  <circle cx="470" cy="66" r="6" fill="currentColor"/>
  <text x="470" y="46" font-size="16" text-anchor="middle" fill="currentColor">abort</text>
  <text x="470" y="276" font-size="14" text-anchor="middle" fill="currentColor" opacity=".62">S1&#8217;s view moves here</text>
  <circle cx="640" cy="66" r="6" fill="currentColor"/>
  <text x="640" y="46" font-size="16" text-anchor="middle" fill="currentColor">write X</text>
  <text x="640" y="94" font-size="13.5" text-anchor="middle" fill="currentColor" opacity=".62">from the pre-abort read</text>
  <circle cx="810" cy="66" r="6" fill="#2e6a4f"/>
  <text x="810" y="46" font-size="16" text-anchor="middle" font-weight="600" fill="#2e6a4f">commit &#10003;</text>
  <text x="810" y="94" font-size="14" text-anchor="middle" fill="#2e6a4f">X&#8242; gone, silently</text>
</svg>
</div>

> `readLedger ⊇ writeLedger` was an invariant enforced by the **user interface**, for free, in every Smalltalk browser — so the repository never had to check it.

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

THE OBVIOUS FIX, AND WHAT IT COST, absorbed 2026-09-14 from the slide that used to follow this run.
It had a slide because it is the mistake anyone in this room would make, me included, and because
admitting it buys the guardrail its credibility. Tell it as a story, in four beats, and it takes
ninety seconds.

One: the obvious thing to build. Make every tool self-contained -- fresh view on the way in, commit
on the way out -- and no tool can ever fail on a stale view. Tools that always work. I built it:
handleToolsCall: ran System abortTransaction before invoking EVERY tool, and each mutation tool
committed inside its own call.

Two: including the commit tool. Pause there and let them get to it first. The pre-call abort had no
exemption, not even for the three tools whose whole job is the transaction, so tool_commit aborted
and then committed the empty transaction it was left with -- and commitTransaction answers TRUE,
because committing nothing succeeds. The tool reported "Transaction committed." to a client whose
work had just been discarded. A commit that can never fail, achieved by never committing anything.
refresh had the same bug in miniature: it and abort were literally the same two lines, so refresh
threw the caller's work away while reporting "View refreshed." The demonstration, if they want it,
is three calls: execute_code plants a probe, commit says it committed, execute_code reads it back
and it is gone.

Three: why nobody noticed. The mutation tools each committed INSIDE their own call, so the tools
people actually used never needed the transaction to outlive the call. compile_method worked.
delete_class worked. The two-step workflow -- make changes, look at them, then commit -- did not
exist at all, and nothing in the tool surface made that visible.

Four, and this is the beat that ties back to the picture above: a blanket pre-call refresh makes
every write a blind write BY CONSTRUCTION. Same rig, one shared object, S1 reading before S2
commits over it:
  * no refresh at all               -> commit false, retryFailure. S2's value survives.
  * continueTransaction first       -> commit true. S2's work silently gone.
  * abortTransaction first          -> commit true. Identical.
  * S1 writes first, refresh after  -> commit false. S2's value survives.
Rows two and three say the hole was as old as the blanket refresh rather than introduced when I
swapped abort for continueTransaction in August. Row four is the one the rest of the section leans
on: protection is not lost wholesale -- once the object is in your write set a later refresh does
not launder it. It is the READ that goes unprotected, which is the dangerous half, because the read
is what the plan was built on.

What shipped 2026-08-28: handleToolsCall: no longer refreshes at all. A session sees one snapshot
until the client asks for another, and refresh is documented as not free.

Two lessons from how it was found, if there is time and only then -- it turned up while
demonstrating something else entirely. A canary planted in a worker gem to test session lifetime
vanished, and so did a control planted and read back three seconds later with no reap in between.
A canary meant to prove something about lifetime must first be shown to survive a null interval.
And when an experiment gives a clean expected result, THAT is the moment to check the instrument:
the first canary vanished exactly on schedule, which is what made it convincing and wrong.

Both designs were checked carefully -- does it destroy work, does it raise, does it pin pages -- and
both were checked against the wrong question. Never "what does this tell the STONE about this
session?" A two-session test nobody had written would have answered it in a minute.
-->

---

## The rule, the ledgers, and the stamp

> A mutation tool may not touch a method, class, or dictionary unless the recorded read stamp matches the **current view.**

`readLedger` is a *dictionary* storing **SHA-256** stamps of each browsing tool result. It is *revalidated* at every `commit`, `abort`, and `refresh`. The client is told of dropped entries.

`writeLedger` is a *set* of keys written by a mutation tool. It helps resolve the identity-based conflict report back into class names. It is *wiped* at every successful `commit` or `abort`.

| grain | key | stamped over |
|---|---|---|
| method | `Foo>>bar:`, `Foo class>>bar:` | the installed source, as `sourceCodeAt:` answers it |
| class shape | `Foo:shape` | `Foo definition` |
| class comment | `Foo:comment` | the comment |
| dictionary | `#UserGlobals` | entry **names and kinds**, sorted — never the values |

**Granularity:** Reading one method shouldn't allow writing to a different method of the same class.

<!--
readLedger is a Dictionary of key to stamp: what this session has seen in the current window, and
a digest of what it saw. writeLedger is a Set of keys: what it has changed and not yet committed.

They are instance variables, which ties back to the gem-contents sequence: the worker instance lives in
SessionTemps for the life of the gem, and `currentServer` is the single place that answers it —
because a second instance would be a second set of ledgers, licensing writes on the strength of
reads it never saw. That is why there are two entries into a worker, a client request and the front
end's own maintenance call, and both go through the same accessor.

The dictionary row, if anyone asks: the values are deliberately not hashed, because
list_dictionary_entries shows none of them, and remove_dictionary — the write this licenses —
destroys the bindings rather than the objects. Hashing what the tool does not show would make the
licence stricter than the harm.

requireRead: never looks at a stamp. Membership is the whole test. The stamp exists for exactly one
moment -- re-validation, which is the second paragraph of the slide and is spelled out below.

THE GRAIN, absorbed 2026-09-14 from "two consequences that shape everything after". Measurements E,
I and J. Compiling a method writes the class's GsMethodDictionary and a per-class SymbolSet, so the
REPOSITORY conflicts per class: two sessions editing different selectors of one class collide, two
sessions editing different classes never do, not even when each introduces a brand-new symbol. The
guardrail on this slide works at METHOD grain and sits on top of that, which is the mismatch the
"granularity was the challenge" line is about, and the half I have to own is that a client can still
be refused a commit over a method it never touched. Coarse in the safe direction, which is the right
way round -- but it is why the recovery path has to be good, because clients will meet it.

Measurements M and N, same slide, and it is the sentence the whole design turns on: a view move
launders a stale READ but never a stale WRITE. Once an object is in your write set the conflict
follows it through any number of refreshes; an object you have only read has no such protection.
That is row four of the four-way measurement in the agent diagram's notes.

WHAT LICENSES WHAT, absorbed 2026-09-14 from the table that used to follow this slide. It came off
for time rather than for being wrong, so this is question-time material -- but the two invariants at
the foot of it are worth saying aloud even now, because they are what the whole thing rests on:
CREATION IS NEVER BLIND, and A WRITE IMPLIES A READ. Therefore writeLedger is a subset of readLedger
at every instant.

The pairs, if they are asked for: get_method_source(Foo, bar:) registers Foo>>bar: and licenses
compile_method and delete_method on it; get_class_definition(Foo) registers Foo:shape and licenses
recompiling the definition; describe_class adds Foo:comment and licenses set_class_comment;
export_class_source registers shape, comment and EVERY selector, which is what delete_class
requires; list_dictionary_entries(D) registers #D and licenses remove_dictionary; the search tools
register nothing, deliberately, and add_dictionary requires nothing.

The split is per TOOL rather than per toolset, and the test is: does this call name one subject and
show its current contents? list_classes(D) names a dictionary but shows only the classes in it -- a
partial view, not enough to license destroying it. list_methods and get_class_hierarchy show names,
not sources. Creation is never blind because if the subject does not exist in the current view there
was nothing to read and nothing can be discarded; a concurrent creation collides write-write in the
ordinary way. A write implies a read because having just written something is knowing its content --
better than having read it -- so compiling licenses recompiling and creating a dictionary licenses
removing it.

Two details from that slide that are load-bearing rather than fastidious, and worth having if
somebody reads the implementation. writeLedger is written on the branch that ACTUALLY performed the
write, never on entry to the tool: a phantom entry would license a change on the strength of nothing
shown to the client, and conflictingSubjects decodes the stone's conflict report through that
ledger, so a phantom could misname a conflict. And compile_method takes source rather than a
selector, so the guardrail has to name the method before it can decide -- it asks the kernel's own
compiler with the intoMethodDict: variant against a throwaway dictionary, which answers the real
selector for unary, binary and keyword patterns alike while leaving the class's selectors unchanged
and needsCommit false.

RE-VALIDATION, absorbed 2026-09-14 from the slide that used to follow the licensing table. The
second paragraph of this slide is now the whole of it on screen, so this is what to say over it.
At EVERY move -- commit, abort, refresh either way -- revalidateReadLedger re-stamps each key in the
new view. Equal, and the read keeps its licence; different, and it is dropped and named, in the
session line on the slide just before this one: "2 of 7 earlier reads are stale". THE COUNT IS THE
POINT.
It says the other five still stand, so the client re-reads two subjects rather than all seven, or
worse, discovers each stale one as a refusal.

Until 2026-09-02 this was decided by rule instead of by looking: a successful commit kept the write
set plus "the widening", an abort dropped everything unexamined, so an abort after browsing twenty
methods cost twenty re-reads even when nobody else had committed a thing. A read is a statement
about CONTENT -- "Foo>>bar: says this" -- and moving the view does not make it false; another
session having committed a different Foo>>bar: does. So now every move looks, and both old rules are
subsumed, because a proof that the content did not change is weaker than looking at it.

The names are summarised BY CLASS so the line stays one line whatever was browsed: up to three
methods of a class in full, more counted as "5 methods from Foo", a definition or comment as
"Foo (definition)", and past four classes the whole list gives way to "changes to 7 classes;
re-check what you depend on before writing".

Three consequences, if asked. A byte-identical recompile by another session leaves the read GOOD --
the stamp is of the text, not the method object, and a recompile does install a new GsNMethod, so
the client's read is still true and nothing it writes discards anything. An aborted write needs a
FRESH read even if nobody else touched it, because the write recorded the stamp as written and the
abort restored the previous content: the client's last knowledge is a version that no longer exists,
and it is told so. And a false refresh leaves this session's own uncommitted writes in place, so
such a read survives the refresh and is dropped by the abort that is the only way out.

Cost: one sourceCodeAt: and one SHA-256 per entry per move, tens of microseconds each, so a few
hundred reads cost milliseconds against a commit that costs more. If it ever shows, the fallback is
a lazy check in requireRead: against a recorded view generation -- at the price of that one-time
note, which can only come from checking everything.
-->

---

## Full disclosure: Circumventing the guardrail

**`execute_code` is outside the guardrail, and its own description says so.** This cannot be closed: it can send `System commitTransaction`, and it can read, write, and abort directly.

The stone still protects against write-write conflicts. But an agent using `execute_code` can silently overwrite another session's commits.

## Relevant test suites

- **`McpBlindWriteTest`** (41) drives the ledger protocol directly and pins the **rules**.
- **`McpConcurrentEditTest`** (18) stages genuine conflicts from a **real second gem** and pins
  that the rules still match the **database**.

One test will **fail on good news:**

> `testTheStoneAloneWouldAllowThatClobber` asserts that with the guardrail bypassed, GemStone
> **still accepts** the commit that discards the other session's work.

<!--
Say this plainly rather than burying it. The guardrail covers the tools that name their subject,
and the tool that names nothing is exempt. A deployment that needs the guarantee removes
McpExecutionToolset, which is resolved per session like any other — though the boundary that
actually holds is the worker gem's GemStone user, which is section 11.

AND THERE IS NO WAY TO OBSERVE WHAT IT WROTE -- off the slide 2026-09-14 for time, and the
sentence to say if anyone asks what the server does about it. The three observability failures are
worth naming because each is a thing I tried. needsCommit reports the case that does not matter and
misses the case that does -- it flips on the FIRST write of a transaction and says nothing after.
PomWriteSet is empty until the commit flush. And the trace primitive, _enableTraceNewPomObjs, traces
objects only after they are committed, which is too late by definition. So what the commit result
actually reports is HOW MANY execute_code CALLS HAPPENED IN THE WINDOW -- a count, not a write set.
That is the most that can be said without inventing precision, and saying less would be pretending
the hole is smaller than it is.

The limits line that came off with it: cross-class staleness is not caught, execute_code is exempt,
and the grains differ. All three are below or on the previous slide.

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

<!-- _class: demo -->

# DEMO D — two clients, six calls

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
VERTICAL SLICE 2 — section 8, the router maintenance cycle. Four slides, cut
2026-09-10 against docs/Presentation.md section 8, and thinned from ten to four
on 2026-09-14 -- see THE FOLD and THE REMOVALS below.

The thesis, and every slide serves it: the front end is the only part of this
server with a heartbeat, so every judgement about time is made there -- and it is
made by COUNTING EVIDENCE THIS FRONT END OBSERVED rather than by measuring
elapsed time. Two mechanisms were deleted by adopting that rule, which is the
strongest thing the section has to say and why the counting rule is the part to
protect.

THE FOLD, 2026-09-14. The counting rule was slide 3 and is now the second half of
slide 2, under the maintenance-pass diagram: one slide that shows the pass and
then says what the pass is counting. The "Per session, inside the pass" lines
came off the diagram to make the room, and are spoken over it instead. Slide
THE REMOVALS, 2026-09-14, later the same day, in two passes. Four slides went to
docs/slides/archive.md, each under its own header there.

First the two MECHANISM slides, leaving the POLICY slides: "An answered ping
proves the client is there" and "How the front end can see any of this". Then
the section's two ENDINGS: "The ending that is not in the ladder" and
"maxSessions". A second fold went with them -- the conjunct slide is now the
bottom half of the view-hygiene slide.

None of their notes were simply dropped. Every surviving slide here carries the
paragraphs it depends on, each under a marked block naming the slide it came
from, and the archive's headers list the split both ways. Keep the two files in
step if anything comes back, or the same paragraph will be in the deck twice.

WHAT THE SECTION LOST BY IT, stated plainly so it can be reversed on purpose:
the section no longer has an ending. It used to close on maxSessions -- the one
slide whose answer is "we refuse" rather than "we measure", and the failure most
likely to bite this room. It now ends on demo E. If section 8 is ever given a
minute back, maxSessions is what to spend it on, ahead of everything in the list
below. Its whole argument is in the notes on slide 1.

Slide numbers below are POST-fold and POST-removal; the running order is 1 lead,
2 the pass and the counting rule, 3 reapReasonFor: and the dead gem, 4 view
hygiene and the conjunct, then demo E.

What the outline had as slides and this does not, all now speaker notes, on the
same principle slice 1 settled -- a MEASUREMENT is evidence for a claim, not the
claim, and notes are where evidence belongs:

  * the 96%-over-one-night suspend-detector result -> notes on slide 2;
  * the four-way commits-behind measurement (9 -> 18 -> 161 -> 202, and the
    489-behind front-end gem) -> notes on slide 4;
  * the StnCrBacklogThreshold "-1 comes back resolved as 80" finding -> notes on
    slide 4;
  * the zero-filled descriptionOfSession: of a dead gem -> notes on slide 3,
    which is where a Q&A magnet belongs;
  * the endedCall*/isEndedCallKind: defect story -> notes on slide 4;
  * request deadlines and cancellation IN FULL -> notes on slide 4. The outline
    put them in this section because they share the escalation; at this budget
    they are the first thing that cannot be slides. If section 8 is ever given
    another minute, this is what to spend it on.

Budget: about 4:00 -- roughly 150s of slides plus the 90s demo E, down from the
7:10 this slice was cut at. Slide 2 is still the long one and still the part to
protect: it carries both its own 25s and the counting rule's 45s. Slides 3 and 4
are about 40s each, having been trimmed on the slide as well as thinned in
number. Section 8 was the largest overspend against the outline's table when this
slice was cut; it is now the largest underspend, which is where the minute for
maxSessions would come from if the rest of the deck does not need it. See the note in docs/Presentation.md on where the extra 0.7
talk minutes come from.
================================================================================

================================================================================
MAXSESSIONS -- slide removed 2026-09-14, and it is the one removal in this
section worth regretting. It was the section's closing slide and the only one
where the answer is "we REFUSE" rather than "we measure". It is also the failure
most likely to bite somebody in this room, so if section 8 runs short, or if
anybody asks what happens when clients pile up, this is the material to spend it
on. The section now ends on demo E instead.

THE ONE THING TO SAY, in a sentence: a session IS a GemStone login, Community
Edition has ten, and the login that exhausts them fails for EVERY gem on the
stone -- measured on 3.7.5, nine one-shot clients took nine workers, the tenth
login of any kind failed with 4039, and the owner of the database was locked out
of their own extent, including from plain topaz, until the router was killed.
That is why the cap is in the server rather than left to the stone: the stone's
limit is shared, so exhausting it is not a local failure. maxSessions defaults to
THREE -- one agent, one editor, one spare for a reconnect not yet reaped -- and
it takes no carelessness to reach, because reconnecting counts as a new client.
Reloading a tab does it.
================================================================================

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

<!-- _class: lead -->

# The maintenance cycle

### One front-end process that monitors the sessions

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
<div style="text-align:center">
<svg viewBox="0 0 960 232" width="1130" role="img" aria-label="The maintenance pass as it runs by default: refresh the front end's own view, then measure each worker's view hygiene, then probe quiet sessions, then reap. Step one comes first so everything after it reasons about the repository as it is now; reaping comes last so a session found gone while probing is freed in the same pass.">
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
</svg>
</div>

Almost nothing here is measured in elapsed time

* **Idleness** is a count of **pings the client answered with no work in between** — `sessionIdleTimeoutSeconds` &#247; the *realized* ping cadence, **fifteen** at the defaults
* **Unreachability** is a count of **passes with no stream**
* **A ping is never declared late by a clock.** It is superseded by the next one and judged then — admissible, or discarded because the transport moved under it

The count advances only while the front end runs. **A suspended host simply stops the count where it was.**

<!--
The order is the point, and the class comment says so. Take the two brackets in turn.

Step 1 first: the front end moves its OWN view, which is two things at once -- it stops holding a
commit record open for the rest of the stone, and it is the front end's code-refresh point (a
committed recompile of McpRouter takes effect within two passes). Everything after it therefore
reasons about the repository as it is NOW rather than as it was when this gem logged in.

WHY STEP 1 IS NOT HOUSEKEEPING, absorbed 2026-09-13 from section 3's transactionless slide. The
measurement is the whole argument and it is one sentence: a front-end gem left in transaction sat on
this stone's oldest commit record for FIFTEEN HOURS, its last transaction boundary its own login,
and nothing stone-side could ever have moved it. That is why the mode is set at startup and why this
step is first rather than convenient.

Say the asymmetry plainly if the room is with you, because it is the part that surprises and this
audience will recognise it: sigAbort, which exists precisely for this, fires only when the backlog
is over StnSignalAbortCrBacklog AND the session is on the oldest record AND the session is NOT in a
transaction. The gem hurting you most is the one least reachable. Section 1's McpRouter box says the
front end runs transactionless and what it costs; this is where the number lives.

The bug detector in refreshFrontEndView is the best small thing in the section and takes fifteen
seconds. Out of transaction, a write to a committed object is ALLOWED, sets needsCommit, and is then
discarded by the abort with no error raised anywhere -- the mistake that would raise 2030 at commit
time in an ordinary gem raises nothing here. A one-line check at the top of each pass is the whole
defence. The front end writes nothing today; if that ever stops being true, that log line is the
only thing that will say so, and it has never fired.

Two answers to have ready. If asked what happens when the mode cannot be set: it is logged and
swallowed, because a front end that pins a commit record is still a working front end and refusing
to serve for that reason would be the worse trade. The failure that actually happens is
transactionless in a SOLO session -- the repository open by this gem alone -- which is no way to run
a server but is exactly how someone tries one out.

Reaping last: a session found gone while probing is freed in the SAME pass rather than the next one.
At a 60-second interval that is a minute of a login slot, every time.

PER SESSION, INSIDE THE PASS -- off the slide 2026-09-14, to make room for the counting rule that
follows it. The line is the whole clock and is now spoken over the diagram, slowly.
notePassWithStream: runs first and unconditionally, before any reason to return early -- before the
busy test, before the no-stream test. Then: busy -> skip; no stream -> skip the ping but keep
counting; probe due -> ping. So the counts advance for every session on every pass this
front end runs, and for no other reason. A busy session still gets counted; it just gets nothing
sent to it.

If asked why a worker gem cannot do its own housekeeping: a forked GsProcess only runs while the gem
is actively executing Smalltalk. A worker sitting between calls is executing nothing, so a timer
inside it does not fire. This is the third design that fact decides, after the detached front end
and the front end owning the client stream.

Four sends, and the diagram is all four -- if somebody reads #maintainSessions along with you, the
count matches. An arm that ended sessions holding write locks was built and taken back out; section
11 says why, and it is that section's argument rather than this one's.

================================================================================
ALMOST NOTHING HERE IS MEASURED IN ELAPSED TIME -- folded onto this slide
2026-09-14 from what was slide 41. Its notes follow whole; it is still the
section's thesis and still the part to protect.
================================================================================

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

================================================================================
AN ANSWERED PING PROVES THE CLIENT IS THERE -- slide removed 2026-09-14. These
two paragraphs stayed because this slide's own bullets assert what they explain:
"idleness is a count of pings the client answered with no work in between", and
"a ping is never declared late by a clock".
================================================================================

The first three bullets are one deliberate decision and the audience may well push on it, so have the
reason ready rather than the mechanism: the ping is how idleness is MEASURED, so an answer cannot
also reset what it is measuring. If it did, the idle deadline would be unreachable for every
conformant client, and "idle" would come to mean "disconnected" -- which the streamless rung already
covers. Unanswered is the other direction and is a gain, not a cost: proven gone, released early
rather than waited out for the full thirty minutes.

Also note what replaced the timeout here, because it is the same idea as the counting rule above: probeSession:
retires the previous ping BEFORE sending the next one. A ping is not declared late by a clock, it is
superseded and judged at that moment -- unanswered if its generation is still current, discarded if
the transport had moved on under it.

If asked about the ping cadence: one cadence for every session, every probePassInterval passes from
the last touch -- 120 seconds at the defaults -- whether or not that session has an idle deadline,
because the ping is how idleness gets measured either way. A client making calls is never pinged at
all, since touch resets the count.
-->

---
## `reapReasonFor:` — ordered by *kind of evidence*

| | ground | what kind of thing it is |
|---|---|---|
| — | **a call is in flight** | **never reaped, on any ground, however long it has run** |
| 1 | `isExpired` | **wall clock** — no amount of sleeping makes an expired token valid |
| 2 | stream closed by client **and** none open now | one **observed fact**; needs no repetition to be believed |
| 3 | `unansweredProbes >= 3` | **evidence**, not absent traffic |
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

================================================================================
WHY ROW 3 SAYS "EVIDENCE" -- from the answered-ping slide, removed 2026-09-14.
Row 3 is the only row whose ground is a COUNT of things that did not happen, so
it is the row that has to earn the word, and this is how it earns it.
================================================================================

The bottom half is the subtlest thing in the section and worth the words. The failure it prevents is
specific: a handover is likeliest on exactly the quiet sessions the reaper probes, so the population
being judged is enriched for the thing that breaks the judgement. And a write to the superseded
socket does not fail -- it succeeds into a buffer nobody will read -- so there is no error to notice.
Three pings like that and a perfectly healthy client loses its gem.

6 of 14 is the number to give if anyone asks whether this is theoretical. It is not a rare
correction; it is nearly half.

The measured figure, if anyone asks whether the correction is theoretical: against
real clients on 2026-08-23, SIX OF FOURTEEN pings were retired as inadmissible
rather than counted unanswered. Not a rare correction -- nearly half.

================================================================================
THE ENDING THAT IS NOT IN THE LADDER -- slide removed 2026-09-14. It belongs
against this table, because its whole point is a case the table gets RIGHT and
still cannot help with: a worker gem that has DIED behind a client that is still
answering. Every ground here says keep, and every ground here is correct -- the
probe asks whether the CLIENT is there, and it is. Only the front end can see
that its own worker is gone, which is why both halves of the fix are in
McpRouter rather than anywhere in this policy. Worth one sentence out loud if
the table draws the question "what if the gem dies?", which it often will.
================================================================================

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

================================================================================
THE DEAD GEM'S OWN MEASUREMENT -- from the descriptionOfSession: slide, removed
2026-09-14. This is the Q&A magnet and it belongs on the dead-gem slide now.
================================================================================

THE Q&A MAGNET, and it is worth having ready because somebody here will ask what happens to a dead
gem's measurement. descriptionOfSession: does not refuse a session id nobody holds -- measured on
3.7.5 it answers a ZERO-FILLED description, 29 fields, the first nil and the rest 0. So field 16 is
0, the session reads as perfectly current, the arm sends it nothing and writes nothing. And that is
the TRUTHFUL answer rather than a lucky one: a gem that has exited pins no commit record, because its
view went with the process. What it left behind is a maxSessions slot and nothing else --
and the slide that made that matter went with it on 2026-09-14, so the maxSessions
story now lives in the notes on this section's lead slide.

The one exception, if pressed, is id recycling: the cached number can be handed to another gem, and
then the figure read belongs to a stranger. Worst case is one confusing log line per pass -- it names
the right session, quotes a different gem's number, and reports an error about a gem that is gone,
and none of the three is wrong on its own terms. Nothing is corrupted and nothing reaches the
stranger, because the refresh only ever travels the dead worker's own closed channel.
-->

---
## View hygiene: the commit-record backlog

A worker at least `maxCommitsBehind` (20) behind is sent one `System continueTransaction` — a current view with its uncommitted work **kept**. Three answers come back:

| | |
|---|---|
| `kept` | the ordinary success |
| `doomed` | the pending work now **conflicts** — and the *worker* tells its client so on every later call |
| `stuck` | the view did not move at all; `continueTransaction` was illegal there |

* On a **quiet repository,** a long call is **never ended** however long it runs.

* **A stuck view is reaped.** All **four** of: configured at all; stuck on *more* passes than the grace; far enough behind to matter; **and** the stone over its own threshold.

* **A *running* call pinning the oldest record is ended.** Those three **plus** holding the oldest record.

<!--
THE TITLE STOPPED MAKING THE CLAIM ON 2026-09-16. It read "View hygiene: **one**
ground, and it is this session's own distance from *now*", and that was an
argument rather than a label: ONE ground, and the ground is maxCommitsBehind --
how far THIS worker's view has fallen behind -- not the repository's
commit-record backlog. The backlog appears on this face only as a conjunct in
the last two bullets, as PRESSURE that licenses acting on the ground. The
distinction is the slide's second half and is measured, so say it out loud now
that the heading does not: a high backlog is not evidence that anybody is behind,
which is why the route that keyed on it was deleted.

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

================================================================================
HOW THE FRONT END CAN SEE ANY OF THIS -- slide removed 2026-09-14. This slide is
the one that spends the measurement, so the measurement moved here. If the room
asks HOW the front end knows a worker is 20 commits behind, this is the answer,
and it is worth giving: System descriptionOfSession:, primitive 334, a stone
query about another session -- field 7 transactionless/out/in transaction, field
8 whether this session holds the OLDEST commit record, field 16 commits since
the session took its view. Field 16 is the number on this slide.
================================================================================

This is the slide this audience will want and no other audience would, so let them look at it.

The important structural point is the first bullet, because it is what makes the busy case tractable
at all: the MEASUREMENT is a stone query and cares nothing for what the worker is doing; the ACTION
would have to travel the worker's GCI channel, which allows one call at a time. So a session with a
call in flight is measured every pass and acted on never. That asymmetry is not a workaround, it is
the reason the arm can exist. It was checked explicitly because it was the obvious thing to worry
about.

#workerStoneSession is cached at the worker's login (McpSession>>cacheWorkerIds) precisely so nothing
on this path has to ask the worker anything.

STnCrBacklogThreshold, if the stone settings come up: it comes back from the runtime ALREADY
RESOLVED, and that mattered. system.conf documents -1 as twice STN_MAX_SESSIONS; on the development
stone, which sets neither, the runtime read answers 80 against a StnMaxSessions of 10. Resolving -1
ourselves would have computed 20 and been wrong about the number the stone actually uses. Trust the
stone's number; map only 0 (disabled) and negative (unknown).

================================================================================
THE TWO DISRUPTIVE ARMS TAKE PRESSURE AS A CONJUNCT -- folded onto this slide
2026-09-14 from what was the next slide. Its notes follow whole. The conjunct is
now the bottom half of the view-hygiene slide: one ground, then the two arms
that act on pressure, then the promise that a quiet repository never ends a long
call.
================================================================================

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

<!-- _class: demo -->

# DEMO E — view hygiene, live

```bash
MCP_MAX_COMMITS_BEHIND=2 MCP_REAPER_INTERVAL=10s ./run-server.sh
```

1. One client **reads a method** — nothing committed, view taken
2. A second gem **commits three times**
3. Wait one pass — the gem log writes `view hygiene: session ... is 3 commits behind`
4. Any tool call: the **`[session]`** line says the server refreshed the view, and **names what went stale**

<!--
THE FINE LINE CAME OFF THIS FACE 2026-09-16. It read "**90 seconds, hard stop.** Fall back to a
gem-log screenshot if the timing is awkward on stage." The hard stop is in the slice header and
the fallback is the paragraph below, so nothing is lost -- but the two were on the FACE together
for a reason, and that reason is now yours to remember: this is the demo where deciding to fall
back has to happen BEFORE you start, not thirty seconds in.

The point of the demo is the LAST step, not the log line: the client is told, on its next result, in
the same [session] channel section 7 introduced -- and the stale reads are named. Everything before
it is staging.

Rehearse the fallback. This demo depends on a second gem committing on cue and on a pass landing
where you want it, which is two timing dependencies on stage. The screenshot is not a defeat; the
log line plus the [session] line is all the evidence anyone needs, and it saves a minute.

Do not raise MCP_REAPER_INTERVAL questions here -- 10s is for the stage, 60 is the default, and
saying so takes ten seconds you will want back.
-->

---

<!--
================================================================================
VERTICAL SLICE 8 -- section 9, McpAuthRouter: a reachable port. A lead, ONE
slide and demo F. Cut 2026-09-12: eighth in running order, eighth to be cut. The
lead slide was added 2026-09-14, so every slide number below counts from it: the
single content slide is 2 and demo F is 3.

Running order and plans, in seconds -- lead 10; the one content slide 150, being
90 for the secure router and 60 for the deviation; demo F 120. About 4:40.
THE 120 PREDATES THE 2026-09-16 REBUILD, when demo F went from three beats and
one login to six beats and two. It has not been re-timed and the 4:40 is
therefore optimistic; time the demo once and correct both numbers here.

THE MERGE, 2026-09-14, after the fold below and on the same day. The secure
router and the offline_access deviation were tightened until the pair fitted one
face, and the deviation became a ### half way down it. NO TIME WAS SAVED and none
was meant to be -- the section still runs 4:40 -- so this is a change of shape and
not of budget: one slide now carries the whole of what this section asserts, and
the room sees the mechanism and the departure from the spec at the same time,
which is the honest arrangement. What it costs is that slide 2 is now a long slide
with two subjects on it, and the pacing is entirely on the speaker.

THE FOLD, 2026-09-14, and it is the biggest single saving in the deck. Slide 2's
face was rewritten from "a reachable port, and the three invariants that pay for
it" to a four-sentence summary of the WHOLE mechanism, and the three slides that
followed it -- every request carries the token; the login; the token is the real
bound -- came out behind it. 190 seconds of slides became 90 seconds of one, and
the section went from 6:20 to 4:40. NOTHING WAS DROPPED FROM THE ARGUMENT: all
three slides' notes are transplanted onto slide 2 under banners naming where each
came from, and slide 2 is now spoken rather than read. The slides themselves are
in archive.md with a header of their own. THIS CHANGES HOW THE SLIDE IS
DELIVERED, which is the thing to rehearse: it is a quiet slide with ninety
seconds of talking over it, and the temptation is to read the four sentences and
move on in twenty.

THE OUTLINE SAYS 3 SLIDES AND THIS IS NOW ONE, having been five. The outline's
number was written before the bullet list under it, and that list contains three
things that were each a slide on their own -- the invariants, the renewal bug and
the deviation -- so it was too small when this slice was cut and is too large
now. Its bullets are still the right inventory of what gets SAID; they are simply
not slides any more.

WHAT TO CUT: nothing here, and that is the point of the fold -- the cutting was
done on 2026-09-14 and what is left is a lead, ONE slide and a demo. If this
section still has to give time back, demo F is the only candidate, and it is
already the riskiest demo in the deck. Slide 2 cannot be cut at all -- it is the
section. NOR CAN ITS LOWER HALF BE DROPPED IN DELIVERY, which is the new way to
lose it now that it is not a slide of its own: the deviation is the one place in
the talk where this project knowingly departs from a normative SHOULD NOT, and
saying so out loud in front of the people who will read the conformance suite is
the whole point of having it. Sixty of slide 2's 150 seconds belong to it.

THE SECTION'S THESIS is not "we added OAuth". It is that authorization here is
not a gate in front of the server, it is the thing that decides WHOSE GEM RUNS
THE CODE. Everything in it is a consequence of that: the token is checked on
every request because the session id is not a credential; the session is bound to
the token's exp because the gem is logged in as that token's user; and the
deviation exists because without it a real client cannot log in at all. The first
two of those three are speaker notes on slide 2 since the fold; the third is the
lower half of that same slide since the merge, and none of the three is a slide
of its own any more.

NO DIAGRAM, deliberately. The shape here is the base router's shape with one hook
filled in (requestAuthorized:on:, which the archived section 4 spent a slide on), and drawing it again
with a padlock on it would say less than the sentence already on slide 2. The
lead slide says the same thing in words, which is the other reason not to draw
it.

THE VERSION DEPENDENCY IS NOWHERE ON SCREEN IN THIS SECTION. It was one
fine line on slide 2, and the fold took the fine line with the rest of that
slide's body on 2026-09-14; demo F's "needs the 3.7.6 stone" was the last of it
on a face and came off on 2026-09-16. It survives as a sentence in the lead's
notes and a paragraph in slide
2's, and that now has to be enough -- it used to be nothing more BECAUSE section 12 owned
versions, and section 12 went whole the same day, so the argument is in slide
22's notes beside the install table that first says 3.7.5, and that is where an
interested room gets taken. The outline
calls 3.7.6 "the one thing in this talk that is a straight ask of the room" --
that framing belongs to section 13, which collects the asks; here it is a fact
about what runs where.

TWO REPOSITORY PROBLEMS FOUND WHILE CUTTING THIS, both now in "What to fix in the
repository before the talk" (items 7 and 8) and both affecting THIS section:
  * docs/MCP_Client_Notes.md says the offline_access SHOULD NOT is "draft-only,
    and so not a gap in either supported revision". McpAuthConformanceTest says
    SEP-2207 is "status Final, so it binds independently of which revision we
    claim". Those are opposite claims about whether slide 2's deviation is a
    deviation at all. THE SLIDE FOLLOWS THE CONFORMANCE SUITE, because that is
    the reading the code actually enforces -- but somebody in that room may have
    MCP_Client_Notes.md open, so resolve it before the talk rather than on stage;
  * ./run-conformance.sh does not exist. It is cited from McpAuthRouter's class
    comment ("scored by ./run-conformance.sh") and from McpAuthConformanceTest.
    No slide mentions it and none should until it is back, but the class comment
    is the first thing a curious attendee will read about conformance.
================================================================================
-->
<!-- _class: lead -->

# McpAuthRouter

### A reachable port, TLS, and a bearer token on every request

<!--
THE SECTION LINE CAME OFF THIS LEAD 2026-09-16. It read "**§9** · authorization is not
a gate in *front* of the server -- it decides **whose gem runs the code**", which is
the paragraph below said in one line. Nothing is lost as long as the paragraph
below is SAID; if it is skipped, the section opens on a title and a subtitle and
the room has to wait five slides to learn what it is about.

One sentence before the first slide, and it is the sentence the whole section is
a consequence of: this is not "we added OAuth". Every request arrives with a
token, the token names a GemStone user, and the worker gem that runs the code is
LOGGED IN AS THAT USER. Authorization here does not stand in front of the server
deciding whether to let a request through; it decides whose gem runs it. Say that
and everything that follows reads as a consequence rather than a feature.

WHAT FOLLOWS IS NOW ONE SLIDE AND A DEVIATION, since 2026-09-14: the mechanism
slide was rewritten to carry the whole of it at headline level and three slides
came out behind it. So slide 2 is spoken rather than read -- its notes are three
slides' worth and are the section now. Know before you start that you are talking
for about ninety seconds over one quiet slide.

Name the class, because the shape matters to this room: McpAuthRouter is a
SUBCLASS of the router they have already seen, with one hook filled in. Nothing
in the base class changed to make authorization possible. That is why there is no
new diagram here -- it is the same picture with one method overridden.

The version line, briefly and once: src/auth needs 3.7.5; an external OIDC IdP
needs 3.7.6. NOTHING IN THIS SECTION SHOWS IT ANY MORE AT ALL -- slide 2's fine
line went when the slide was rewritten on 2026-09-14, and demo F's "needs the
3.7.6 stone" went on 2026-09-16 -- and
nothing later in the deck picks it up either, section 12 having gone whole with
the first of those. So say it here or not at all, and resist relitigating it: it is a fact
about what runs where, not the ask. If the room wants the argument, it is in
slide 22's notes and it belongs in the hallway.

Where this ends: demo F, Alice and Bob writing code on one image. It is the
riskiest demo in the deck because it needs the IdP reachable and, since
2026-09-16, needs it TWICE -- two users, two tokens -- so know before you start
whether you are going to run it, and have both tokens in hand if you are.
-->

---

## A secure router on a reachable port

`McpAuthRouter` is the class for a configurable `bindAddress`. **TLS is mandatory,** even on loopback. Requires a resource server to issue JWTs with the auth router in its audience. The worker gem runs as that user.

### The `offline_access` deviation

The server **SHOULD NOT** advertise `offline_access` in `WWW-Authenticate` or `scopes_supported`. But:
* The Claude Code client appends `offline_access` to its authorization request **on its own**
* Some (most?) authorization servers **reject a request naming any scope that the client was not assigned.** Keycloak and Authelia reject **before any login page**

**Keycloak compounds it.** An RFC 7591 dynamic registration carrying a `scope` field **replaces** the realm's defaults — so the resource *advertising* the scope is the only way such a client ever holds it.

> Our conformance suite asserts the rule against a **`conformantRouter` fixture** — so a router is spec-clean *unless an operator opts out* via `MCP_EXTRA_SCOPES`.

<!--
THIS SLIDE IS TWO SLIDES MERGED, 2026-09-14. "A secure router on a reachable
port" and "The offline_access deviation" were each tightened until the pair
fitted one face, and the deviation is the ### half way down. IT IS THE ONLY
CONTENT SLIDE SECTION 9 HAS, between the lead and demo F, and it carries about
150 seconds of talking -- 90 for the mechanism, 60 for the deviation. The
temptation is to read seven lines and move on in thirty. Do not.

THIS SLIDE WAS FOUR SLIDES UNTIL 2026-09-14. Its face was rewritten to state the
whole mechanism at headline level, and the three that followed it -- every
request carries the token, the login, and the token is the real bound -- came
out. So THESE NOTES ARE THE SECTION NOW: the slide is a summary and the argument
is spoken. Pace it accordingly, about 90 seconds rather than the 45 the old slide
had, and do not try to say all of what is below. Each transplanted block names
the slide it came from; take the first paragraph of each and keep the rest for
hands.

Open with the thesis, because nothing here makes sense without it: authorization
is not a gate in front of the server. It is the thing that decides WHOSE GEM RUNS
THE CODE. Everything else follows.

ENFORCED IN CODE RATHER THAN BY A LAUNCH SCRIPT is the phrase to land on the
middle sentence, and it is what the old slide spent a line on. A launch script is
advice. TLS and the resource config SIGNAL from the two methods that start a
server -- runOnPort: and forkOnPort: -- so there is no way to get a reachable
port without them: not by calling runOnPort: in topaz, not by writing your own
script, not by copying the example and deleting a line. bindAddress is the one
that is configurable HERE and has no setter on the base class, and it is still
seeded to loopback: reachability is something the caller asks for.

"NOT EVEN ON LOOPBACK" is the one somebody will push back on. The answer: a
bearer token is a password travelling in a header on every request, and a router
that is safe today becomes unsafe the moment its bind address is widened -- which
is a one-line change in somebody else's script six months from now. The property
has to hold for the class, not for the deployment.

THE RESOURCE-SERVER CONFIG is the subtle one -- an expectedAudience and at least
one https authorization server, or it refuses to start. An unconfigured router is
not merely useless, it is actively wrong in two directions at once: it accepts
tokens minted for ANY resource, and it publishes a discovery document naming
NOWHERE to get one. Neither failure is loud.

THE VERSION LINE IS NO LONGER ANYWHERE ON SCREEN IN THIS SECTION. The fine line
went when this slide was rewritten on 2026-09-14, and demo F's "needs the 3.7.6
stone" -- the last of it on any face -- went on 2026-09-16. Say it in a sentence,
because nothing else will: src/auth needs
JsonWebToken, JwtSecurityData and jwtPassword:, so 3.7.5; an EXTERNAL OIDC IdP
needs 3.7.6. On an image older than 3.7.5 those methods CANNOT COMPILE AT ALL,
which is why install.sh probes the image rather than asking, and leaves the group
out; the 3.7.6 line is unrelated to compilation and is a bug connecting to an
external IdP. Section 12 went whole on 2026-09-14, so nothing later picks this
up, and slide 22's notes are where the argument went.

This is the slide this section exists to be able to give. A deliberate departure
from a normative SHOULD NOT, stated in front of the people most likely to check,
with the reasoning rather than an apology.

Authorization servers that gate scopes per client behave this way; others
silently narrow the grant and need none of this, which is why the deviation looks
unnecessary until you meet one that does not.

THE ATTRIBUTION WENT WITH IT ON THE SAME DAY. The line read "MCP SHOULD NOT
advertise" and now reads "The server SHOULD NOT advertise", which is the same
requirement with nothing saying WHOSE it is. SAY WHOSE: this is the spec's rule,
not a house policy we are failing to keep. Without that, the face reads as the
server contradicting its own standard, and the blockquote's "asserts the rule"
has nothing to point at.

THE RULE'S NAME CAME OFF THE FACE 2026-09-14 and is worth having, because this
room will want to look it up: it is MCP SEP-2207, and its status is FINAL. That
matters more than it sounds -- Final is why the conformance suite treats it as
binding whichever protocol revision we claim, rather than as advice attached to
one. It is also what the last paragraph of these notes is about.

THE TWO EXITS CAME OFF THE FACE THE SAME DAY, and they are the answer to the
first question anybody asks, which is "why not just fix it?". Both were tried.
Pinning the scopes CLIENT-SIDE failed on 2026-08-20 -- the client went on
appending offline_access regardless. And nothing SERVER-SIDE substitutes: a
Keycloak policy only VALIDATES a request, a mapper only EMITS claims, and neither
of them can ASSIGN a scope to a client. CIMD is the one route left and it is
untested. Say this as two failures with dates and mechanisms rather than as "we
looked into it", because the difference between those two sentences is the whole
credibility of the deviation.

The structure to hold on to: the rule is right, and this project cannot follow it
because of two behaviours that belong to a client and an authorization server.
Neither is ours, neither is a bug we can fix, and between them they mean that a
spec-clean router cannot complete a browser login against Keycloak at all. That
is a strictly worse outcome than the deviation.

The reason behind the rule, if it is asked: refresh tokens are not a RESOURCE
requirement. Whether a client gets one is between it and the authorization
server, and a resource has no business asking for it on the client's behalf.

Say what the deviation is NOT: it is not the server handing out refresh tokens,
and it is not the server deciding sessions should be longer. It is one string in a
metadata document, and the reason it has to be there is that Keycloak replaced
the client's scopes at registration time.

The fixture point is the part to be proud of and it is a technique worth naming:
the test constrains the FIXTURE, not every deployment. A router is conformant
unless an operator deliberately opts out, the opt-out is one environment variable,
and the deviation is recorded in the suite's own class comment rather than in
somebody's memory.

The known gap in the same breath, if asked what else is untested: the draft's
scope-hierarchies MUST. The router compares scopes by exact string, which
satisfies it only while all configured scopes are flat and unrelated -- true of
mcp:use and mcp:write today. No test, because there is no hierarchy API to test
yet, and introducing one needs a design decision first.

================================================================================
EVERY REQUEST CARRIES THE TOKEN -- from the slide of that name, removed
2026-09-14. What is left of it on screen is this slide's "requires a resource
server to issue JWTs naming the auth router in its audience".
================================================================================
requestAuthorized:on: is the base-class hook on McpRouter and this is the class
that fills it in: verify the SIGNATURE against the stone's trusted JWT keys, then
the resource-server claim checks -- exp always, and where configured issuer,
audience (RFC 8707) and required scopes. A request naming an existing session
must also present a token belonging to THAT SESSION's user. The spec is explicit
that authorization "MUST be included in every HTTP request from client to server,
even if they are part of the same logical session".

THE CONFESSION, and it is worth telling as one if there is a spare thirty seconds
-- it was a blockquote on its own slide. The MCP-Session-Id once WAS a
credential: initialize alone was authenticated and the session id admitted every
later request, so an expired or revoked token kept working for as long as the
session was kept alive. The failure mode is the one that matters -- revocation
did nothing. Revoke a user's access and their session kept working until the idle
reaper happened to get to it. And the two endpoints nobody thought about, which
is the usual shape of this bug: the GET stream and DELETE were not "initialize",
so they took no credential whatsoever, and anyone holding a session id could read
that session's stream. The session id is a routing key, it is 128 bits of
randomness, and it looked exactly like a credential; that is how this kind of
mistake survives review.

ONE EXCEPTION, BY DESIGN, and it sounds like a hole until the sentence is
finished: the Protected Resource Metadata endpoint is unauthenticated, because it
is what a client reads IN ORDER TO LEARN HOW TO AUTHENTICATE. Refusing it without
a token would be a bootstrap that cannot start. RFC 9728 metadata is served at
BOTH the root and the path-scoped form, because a conforming client probes the
path-scoped one first.

If asked what it costs: every request now pays a signature verification. It is
cheap against the stone's trusted keys and nobody has measured it as a problem,
but it is an honest cost to name rather than deny.

================================================================================
THE LOGIN -- from "the worker gem is the user's, not the server's", removed
2026-09-14. This slide's last sentence IS that slide's headline, which is why the
block sits here.
================================================================================
The payoff of the whole section, and it is what demo F shows: the gem is Alice's.
Her code runs as her GemStone user, her privileges apply, her name is in the
session list. Since the demo was rebuilt on 2026-09-16 it shows this through what
Alice and Bob are each REFUSED rather than through her name in the session list,
so "her name is in the session list" is now a thing to say here rather than a
thing they will see there. The server is not impersonating anybody. Mechanically: on
initialize the router derives the GemStone userId from a configurable claim --
userIdClaim, default sub, typically preferred_username on Keycloak -- and
McpSession startWithId:user:jwt: opens the worker with username: and
jwtPassword: and logs it in.

TWO VALIDATIONS, AND THEY ARE NOT REDUNDANT. The router checks the token because
it is the resource server and that is its job. GEMSTONE RE-VALIDATES THE JWT AT
LOGIN -- signature against its trusted keys, plus that user's JwtSecurityData --
because it is not going to take this server's word for who a user is, and that
second check is against a fact about the ACCOUNT rather than about the request.
So a bad or expired token fails the LOGIN, not merely the gate.

The failure vocabulary, if it is asked for: missing, malformed, forged, expired
or wrong-audience gives 401 invalid_token; a missing required scope gives 403
insufficient_scope; both carry WWW-Authenticate: Bearer with error,
error_description, scope and resource_metadata -- everything a client needs to fix
itself.

supportedScopes IS DERIVED, NEVER CONFIGURED -- the union of requiredScopes and
extraScopes -- so a required scope is ALWAYS advertised. That is the same move as
section 2's named tool surface: the wrong state is not detected, it is made
impossible to express, so requireResourceServerConfig has no subset rule to check
and no caller has one to maintain. Small, and it generalises.

If asked about userIdClaim: sub is the default because it is the one claim OIDC
guarantees, but it is usually a UUID. preferred_username is what a Keycloak
deployment actually wants, and that is why profile is advertised -- it is the
scope that emits it. That thread comes back on the lower half of this slide.

================================================================================
THE TOKEN IS THE REAL BOUND -- from "and the cap is on the grant", removed
2026-09-14. It hangs off this slide's last sentence too: if the worker gem is
logged in as that token's user, the session cannot outlive the token.
================================================================================
The policy in one sentence: every session is capped at its access token's own
exp, WHATEVER THE IDLE POLICY SAYS, because a session outliving its token would
leave the authorization it was opened with in force after the grant expired. An
expiry is never probed around and never forgiven. It is also one of only two
wall-clock grounds in the whole reaper -- section 8 -- which is worth saying,
since that section has already run by the time this one does.

AND THEN THE BUG, which is the best story in this section and the first thing to
spend a spare minute on. A client working steadily had its worker gem torn down
and its uncommitted transaction lost one access-token lifetime after opening --
however recently it had called. Say it as the user experienced it: you are
working, you are calling every few seconds, and an hour after you started your
gem is gone and your uncommitted work with it. Nothing errored. Your client got a
fresh token, opened a fresh session and carried on. You would find out when you
went looking for the changes you had made. THAT IS SILENT DATA LOSS.

The diagnosis is the interesting half: activity was feeding the IDLE clock, and
the idle clock was never what was going to end this session. The absolute
deadline was, and nothing was moving it -- the client had been presenting a
renewed grant on every single request and the server was not reading its exp. So
the fix is to read the credential in front of you: a request bearing a refreshed
token for the same user extends the session to the NEW token's exp
(renewSessionExpiry:from:). Refreshing sooner would not have helped.

TWO BOUNDARIES KEPT, which is why it is a separate selector and not a relaxed
ratchet: a nil exp moves nothing, because a token whose expiry cannot be read
must not be able to turn a bounded session unbounded; and a session with NO
deadline is left alone, because renewal extends a deadline rather than
introducing one. The renewable-past-deadline case, if anyone spots it: a session
past its deadline but not yet reaped IS renewable, on purpose -- the reaper runs
on an interval, so that window is scheduling rather than policy, and a client
presenting a valid token inside it is exactly the client that should keep its
gem.

WHAT BOUNDS WHAT AN AUTHENTICATED SESSION MAY DO is not a scope -- it is the
GemStone user the bearer token names, whose UserProfile an administrator
restricts. That is section 11, two slides away. A scope decides whether a
client gets in at all.

================================================================================
TWO THREADS RUN FROM THE TOP OF THIS SLIDE TO THE BOTTOM OF IT. They came out of
the three slides folded away on 2026-09-14, and since the two halves were merged
onto one face later that day they no longer travel between slides at all -- they
are the mechanism half arriving at the deviation half. Both are one sentence if a
hand goes up.
================================================================================
WHY profile IS ADVERTISED AT ALL, which the mechanism half's notes hand forward: userIdClaim
is preferred_username on a Keycloak deployment, and profile is the scope that
emits it. It is in scopes_supported for THAT reason, not this one.

AND SESSION LIFETIME, which is what offline_access is about -- refresh tokens.
The banners above carry the whole of it now: a session is capped at its access
token's own exp, and a request bearing a refreshed token for the same user moves
that cap. Nothing in this deviation changes either, which is the point of saying
what it is NOT.

ONE THING TO SETTLE BEFORE THE TALK: docs/MCP_Client_Notes.md says this SHOULD NOT
is draft-only and therefore not a gap in either supported revision, which is the
opposite of what the conformance suite says. The slide follows the suite. Item 7
of "What to fix in the repository before the talk".
-->

---

<!-- _class: demo -->

# DEMO F — Alice and Bob write code on an image

```bash
./run-auth-server.sh          # TLS, an IdP, and a reachable port
```

1. **The browser login** through the IdP
2. **Alice** uses `execute_code` and tries to write to a **protected object**
3. Alice writes **her own** class
4. **Bob** uses `execute_code` and looks for Alice's class
5. Bob tries to write his own class
6. Alice removes her class

<!--
THE DEMO WAS REBUILT 2026-09-16, and it is a different demonstration rather than
a longer one. It was "Alice runs code as Alice", three beats, and the two that
went are the two that were the EVIDENCE:

  * "`execute_code` -- and `status` showing **Alice's own GemStone userId**"
  * "`System cacheStatisticsForAllSlotsShort` -- the `McpServer:...` row **is
    hers**"

Those two were what the section's argument pointed at: the gem in the cache list
is Alice's, by name, and the server is not impersonating anybody. The new six
beats show the same claim from the other side -- two users on one image, each
bounded by what their own GemStone user may do -- which is a BETTER argument and
a more expensive one. Two things follow and neither is cosmetic.

FIRST, IT IS NOW TWO LOGINS, NOT ONE. Alice and Bob each need a token, so the
riskiest demo in the deck just doubled its risky part. Have TWO pre-fetched
tokens in scrollback, not one, and know which browser profile is which before you
start; a second live redirect on stage is not worth the authenticity.

SECOND, THE CACHE-STATISTICS BEAT IS GONE, so nothing on this face shows the
worker gem by name any more. If the room is to see that at all it is demo B's
cache row, twenty minutes earlier and without a user attached to it. Run the
statistics line here anyway if there is time -- two McpServer rows, Alice's and
Bob's, side by side -- because it costs ten seconds and it is the picture the
whole section has been building.

WHAT THE NEW BEATS BUY, and it is worth knowing which is load-bearing: beat 2 is
the one to protect. A write refused at the write, on a protected object, is
SecurityError 2116 -- which is exactly what section 11's privileges slide asserts
two slides from now, and this is the only place in the talk it happens in front
of anybody. Beats 3 to 6 are the pair working: Bob can see Alice's class only
because she committed, which quietly re-runs section 7's view argument on live
users, and beat 6 leaves the image as it was found, which is good manners and
also the cue to stop.

THE BUDGET SAYS 120 SECONDS AND WAS WRITTEN FOR THREE BEATS. Six beats and two
logins are not two minutes. Time it once before trusting the section's 4:40.

THREE FINE LINES CAME OFF THIS FACE 2026-09-16, and one of them was carrying
something nothing else in the deck carries. Verbatim, in order:

  1. "**The point to land: the worker gem is her session, not the server's.**
     Needs the 3.7.6 stone. If the browser flow looks risky on the day,
     `verify-oidc-login.sh` plus a curl with a **pre-fetched token** is the safe
     version -- have one ready either way."
  2. "**Not built, and an invitation:** mapping **scopes to privileges**, and
     **loading toolsets by scope**. The router already resolves the tool surface
     **per session, on the side that can see the token** (§2) -- the mechanism is
     in place and unused. What is missing is the policy. §13."
  3. "**2 minutes.**"

THE 3.7.6 IS THE ONE THAT MATTERS. That clause was the LAST place the version
dependency appeared on any face in this section -- slide 2's fine line went on
2026-09-14 -- so as of 2026-09-16 it is nowhere on screen in the talk. Three
paragraphs elsewhere in this section's notes used to say "demo F's needs the
3.7.6 stone is all that is left on screen"; they now say it is gone. Say it here
in one sentence or the talk does not contain it: src/auth needs 3.7.5, an
EXTERNAL OIDC IdP needs 3.7.6, and that is a fact about what runs where rather
than an ask.

THE INVITATION is the second one, and it is the deck's only mention of scopes
mapping to privileges. The paragraph at the foot of these notes is how to say it.

The riskiest demo in the deck: a browser, an IdP, a different stone, and a
redirect that has to come back. Decide by the morning which version is running
and rehearse THAT one -- switching to the fallback live is how this becomes four
minutes.

Have pre-fetched tokens in scrollback regardless -- two of them since the rebuild,
one per user. Even in the good case they turn a failed redirect into a
five-second recovery.

What to point at, in order: the refusal in beat 2, then Bob finding Alice's class
in beat 4. Those two together are the whole section -- the authorization did not
just let them in, it decided which GemStone user is executing each one's code,
and the stone enforced it without the server being asked. Until 2026-09-16 the
two things pointed at here were Alice's userId in the status output and her row
in the cache statistics; say the second of those out loud even though it is no
longer a beat.

The invitation is deliberate and section 13 picks it up. It was printed at the
foot of this face until 2026-09-16 and is now spoken, so it happens only if you
do it. Say it as an open question rather than a roadmap: the surface is already resolved per session
on the side that holds the token, so the mechanism exists; what nobody has
decided is the policy, and whether GemStone's own privileges should carry any of
it. That is a question for this room specifically, and it is worth leaving in the
air rather than answering.
-->

---

<!--
================================================================================
VERTICAL SLICE 11 -- section 11, the worker gem's GemStone user. Two slides,
no demo, having been three until the fold recorded below. Cut 2026-09-13, and it closed the running-order gap at the time: every
cut section, 0-12, was then in section-number order. THAT IS NO LONGER THE SHAPE.
On 2026-09-14 this slice was MOVED AHEAD OF SECTION 10, to sit immediately after
demo F, so the deck runs 9, 11, 10. The reason is thematic: section 9 has just
spent five slides and a demo on who a request is allowed to be, and this section
is the one that says what actually bounds it -- carried back from McpAuthRouter
to the plain McpRouter, which is where most of the room's servers will be.
Section 13 is still the only section never written.

Running order and plans, in seconds -- the boundary 55, the privileges and the
lock 65. About 2 minutes.

THE FOLD, 2026-09-14. This slice was three slides. The third -- "System
writeLock: is gated by no privilege -- and that is my question" -- came out after
its subject arrived on slide 2's face as a blockquote: no privilege allows or
prevents writeLock:, and a single statement can walk Globals and take over two
thousand locks. That began as a blockquote of fact and became, later the same
day, a heading of its own -- "Should write locks be privilege-gated?" -- with two
sentences under it, so the ASK is on a face and the argument for it is not.
Fifty-five seconds of slide became four lines. NOTHING WAS DROPPED FROM THE
ARGUMENT: that slide's notes are on slide 2 under a banner, so the DataCurator
measurement, the reverted reaper and the shape of the answer are all still
here -- SPOKEN now rather than read. The archive's header
says what to cut back out of slide 2's notes if the slide is ever put back.

THE OUTLINE SAYS 1 SLIDE, and that entry describes a feature this server does not
have. Rewrite it. This is now two slides, having been three. What section 11 is now is a real boundary with a real open
question attached, and the question is one of the two things this talk is
actually asking the room for -- the other being the defect table, now the last slide of the
deck and the first thing to go if the clock has gone.

THE SECTION'S THESIS: the only boundary that holds is the GemStone user the
worker gem logs in as, because it is enforced in the stone, by the VM, on every
operation, and cannot be talked around from inside the session. Everything else a
server could do -- narrowing the tool surface, refusing a tool by name -- states
an intention. Say the positive version and do not spend time on what it replaces:
this audience is meeting the project for the first time and has no stake in an
earlier design.

SLIDE 2 CARRIES THE ASK since the fold, and it is what this section exists for.
It asks it outright, in a heading of its own at the foot of the slide, where a
whole slide used to. System writeLock:
is gated by no privilege, so a browsing-only session has it, and a lock blocks
OTHER sessions from committing -- including a privileged developer committing
code, measured. What bounds it today is session lifetime and an operator
noticing. A reaper that ended lock holders WAS built here and taken back out,
because it can only act once per heartbeat and the holder picks when the window
falls -- chasing a lock holder is not the same as not being able to take the
lock. A privilege that withheld writeLock: would bound it at zero. That is a
GemStone question, not an mcp_server one, and it goes to the room. The slide asks
it; everything that earns the question is yours to say.

WHAT TO CUT: nothing, and that is new. Slide 2 was the answer to this question
while its privilege detail was all it carried; now it carries the ask as well, so
cutting it cuts the ask. Two slides and two minutes is already the floor. If the
clock has genuinely gone, what goes is the whole section rather than half of it.

NO DEMO. The convincing demonstration here is a negative -- a commit that raises
2249 -- and demo D already puts a failing commit on screen for a better reason.
The lock result is a two-session setup that reads as a non-event on a projector.
Both are measured in docs/ReadOnly_User.md if anyone asks for evidence.

THE SLIDES DO NOT MENTION WHAT THIS REPLACED, deliberately and by instruction.
The notes reference it once, on slide 1, only because "why is the tool surface not
the boundary" is a question a toolset author may ask -- and the answer is about
execute_code, not about history. SINCE THE MOVE THAT QUESTION ARRIVES LATER, not
earlier: section 10 now follows this section, so the toolset author meets the
answer before the question. Slide 2 of section 10 pointed back here with a (§11)
until the slide carrying it was removed on 2026-09-14, and that pointer is now
made in speech from that section's notes. Keep the paragraph on slide 1 anyway --
it is what the pointer resolves to. The reverted lock reaper in slide 2's notes
is NOT an exception to that rule and should not be tidied away as one: it is a
different history, it was on a face on purpose until the fold, and it is what
earns the ask.
================================================================================
-->

## A read-only user for McpRouter

```bash
MCP_WORKER_USER=McpReadOnly ./run-server.sh
```

Configured at `McpRouter>>workerUserId` — **per router, not per session.** `startWithId:workerUser:` does the login. Default `nil` — the front end's own user.

* **No credential.** The front end mints a **one-time password per session**, needing **one committed grant** — `addOnetimePasswordUserId:` on the front-end user. So `configDict` carries **only an identifier**
* **`McpAuthRouter` refuses `workerUserId:`** — there each worker is **the user its bearer token names**
* `UserProfile>>disableCommits` → `sessionCanCommit` is false **from login**; `commit` raises **`TransactionError` 2249**. Reads and compiling still work — the session accumulates pending work it cannot keep, so the **`[session]` line points it at `abort`**
* **Object authorization does better where it applies:** a write this user is not authorized for is refused **`SecurityError` 2116 *at the write*** — `needsCommit` stays false, so **no dirty state** and no phantom value for its own later reads

<!--
Lead with the positive claim and stay on it: this is a boundary because the stone
enforces it, not because the server declines to offer something. Everything a
server can do on its own side states an intention.

Per router, not per session, is worth saying rather than leaving to be inferred:
the read-only work gave McpRouter a configured worker user, and it configures the
WHOLE router -- one identity for every session it opens, chosen by whoever forked
the gem. Two identities means two routers on two ports, which is the second
example in McpRouter's class comment. The per-session answer is McpAuthRouter, and
it is the next bullet: there the identity comes from the token, so the router
cannot be told one.

This is the answer section 10 points back at. It now comes BEFORE that section
rather than after it, so nobody has asked yet -- but "why is narrowing the tool
surface not the boundary?" is what a toolset author will ask two slices from now.
That pointer used to be a (§11) on a face; the slide carrying it was removed on
2026-09-14, so the speaker makes it now. The answer is about
execute_code and not about history:
execute_code evaluates arbitrary Smalltalk, run_test_class runs arbitrary test
bodies, and a tool that compiles can be followed by one that runs. A shorter
toolsetNames list is still worth having -- it narrows what a model is OFFERED,
and a smaller surface is a clearer one -- it is just not a control.

The one-time password grant is the part an operator has to do once and will
otherwise hit at session open: the stone lets you mint a password for another
user only if that user is on your allowlist. setup-read-only-user.sh makes the
grant. Without it the mint raises, and it raises at session open rather than
mid-conversation, which is the right end.

The two refusals are worth distinguishing carefully, because 2116 is the nicer
one and is not available everywhere. Object authorization refuses AT THE WRITE
and leaves nothing behind. The commit lock catches everything else -- the user's
own UserGlobals, and anything it is authorized to write -- and it catches it at
commit time, so the work exists until it is aborted. Both were measured on 3.7.5;
docs/ReadOnly_User.md has the probe tables.
-->

---

## What privileges are needed

> Putting a commit lock on a gem does not prevent a user from **logging in another gem** via `GsTsExternalSession>>login` through which to execute code.

* `NoUserAction` and `NoGsFileOnServer` are both assigned to disable this
* `NoPerformOnServer` and `NoGsFileOnClient` are assigned
* `CodeModification` is granted so that `execute_code` is available, and so that `run_test_class` can be used on classes that compile

## Should write locks be privilege-gated?

No privilege allows or prevents `System writeLock:`. A single statement can quickly walk `Globals` and place more than 2000 locks.

<!--
Run this one briskly; the full table is in docs/ReadOnly_User.md and this slide
is the shape of it. Three privilege facts, then the ask.

compile_method fails too, without it. CodeModification is the interesting grant
because it looks wrong and is not. The
reasoning is the same one the whole section rests on: the commit lock is
downstream of everything, so a privilege whose products cannot be kept costs
nothing. Withholding it would cost the tool surface most of its value.

The second-gem measurement is the one to say out loud, because it is the
attribution nobody would guess. Six users differing in one privilege each;
read-only-ness does nothing, NoPerformOnServer does nothing, and the two that
work do so because login is an FFI callout rather than because anyone designed
them to. Either is enough and the default set has both.

THE SYMBOL LIST CAME OFF THE FACE ON 2026-09-14 and now has to be said, because
it is the operational trap of the whole section and nothing on screen hints at it
any more. A different user resolves names differently: Mcp is not in a new
profile's default symbol list, so a worker that cannot see it FAILS ITS FIRST
SESSION, and setup-read-only-user.sh copies the front-end user's list to stop
that happening. It is not a security property at all -- adding a dictionary
changes nothing about what may be written -- but get it wrong and the very first
session fails with Toolset not found, which reads like a broken install. And the
copy is a POINT-IN-TIME SNAPSHOT: re-provision a dictionary later and it is
stale.

READS AND RESOURCES ARE SPOKEN TOO. A fine line naming reads, resources and locks
as what stays open came off the face on 2026-09-14; the lock half became the
question at the foot, and the other two are yours to say. A sentence each, and
worth the fifteen seconds: without them the slide reads as though the privilege
list were the whole boundary, which is the one thing this section must not leave
the room believing.

READS ARE BROAD, and nothing here narrows them. Anything world-readable comes
back through a tool result, including other UserProfiles. The answer to that is
object security policies rather than anything on this slide -- say it as a limit
of the approach and not as a gap, because it is the honest half of the bullets
above.

RESOURCES ARE NOT BOUNDED BY PRIVILEGES EITHER -- a loop, a full scan, temp object
space, a pinned view. What bounds them is section 8's lifetimes, which the room
has already seen, so this is a pointer backwards rather than a new claim.

THE THIRD IS LOCKS, and since 2026-09-14 it is the question at the foot of this
slide, under a heading of its own, rather than the slide that used to follow.
Everything below is what that slide said.

================================================================================
THE LOCK ASK -- from "System writeLock: is gated by no privilege -- and that is
my question", the slide that followed this one until it was folded away on
2026-09-14. Its question is the heading at the foot of this slide; these are its
notes, whole, with their pointers at its own bullets rewritten to name what those
bullets said.
================================================================================

THE SLIDE THIS SECTION EXISTED FOR. Everything before it earns the right to ask,
and what is left of it on screen is a heading and two sentences. THE QUESTION
ITSELF IS ON THE FACE -- "Should write locks be privilege-gated?" -- so you cannot
forget to ask it. What is NOT there is the shape of the answer, which was the
removed slide's closing line: "At the source the bound is zero, not one heartbeat
-- and that is the layer to fix it at, not a maintenance cycle." Say that, last,
and then STOP TALKING. It is the second of the talk's two asks, and the only one
that is not in an appendix that may never run.

Build it in three beats under that heading. One: a lock needs no privilege, so
the most confined session you can provision still has it -- that much is on the
face. Two: a lock does not change anything, it stops OTHER people changing
things, and that is measured rather than reasoned. THE MEASUREMENT IS NOT ON THE
FACE EITHER, and it is the half that lands: the restricted gem locked ONLY
McpServer's method dictionary, and a DataCurator compile-and-commit then failed --
conflict #'Write-WriteLock', n=1. Say the consequence plainly: locking a class's
method dictionary stops a PRIVILEGED DEVELOPER committing code to that class. The
other measurement survives on the face as "over two thousand": it was 2,291
locks, taken by one execute_code walking Globals, in a single statement. Three:
everything available today is either a gem eventually going away or a person
noticing.

THE REASSURING HALF, if the room looks worried about the running server:
McpRouter and McpServer are transient -- never committed, so locking one excludes
nobody.

LEAD WITH THE REVERT RATHER THAN BEING CAUGHT BY IT -- it is the strongest part of
the argument, and it was the removed slide's third bullet: "A reaper is the wrong
layer, and I built one to find that out." Commit b0a5180 added an
MCP_REAP_LOCK_HOLDERS setting: an idle holder reaped, a busy one answered mid-call
so the client was told. It worked, measured, and it was taken back out. The
reason is a design argument and not a bug: policing a lock once per heartbeat
works around a gap in the privilege model instead of closing it, the holder
chooses when the unguarded interval falls, and a session that keeps taking fresh
locks is chased forever. docs/ReadOnly_User.md records the whole thing, revert
included, because the exposure is real and should be arguable from.

The session-lifetime bound is worth saying plainly so the room does not hear
"unbounded": locks are released when the holding gem logs out, and section 8's
reaper logs idle workers out on a schedule -- measured, all 2,291 went when that
reaper took the holder. That is exactly why the idle and lifetime settings are
worth configuring deliberately on a deployment that hands execute_code to anyone
less than trusted.

Anticipate the obvious answer, which is "stop the session": that already works
and needs nothing from this project. System systemLocksDetailedReport names the
holding stone session, descriptionOfSession: gives its UserProfile and pid, and
stopSession: ends it and releases the locks -- DataCurator has SessionAccess
already. That is the escape hatch, including when the holder is not an MCP session
at all. It is still a person noticing.

install.sh would fail the same way as that DataCurator commit -- worth adding if
the room looks unconvinced that this reaches past application data.
-->

---

<!--
================================================================================
VERTICAL SLICE 9 -- section 10, extending it: a server for YOUR software, with
the Grail MCP Server as the worked example. A lead, ONE slide and a demo. Cut
2026-09-12: ninth in running order, ninth to be cut. IT IS NOW TENTH, AND LAST
BEFORE THE OPTIONAL CODEC: section 11 was moved ahead of it on 2026-09-14, so
this section closes the talk proper.

Running order and plans, in seconds -- lead 10, the one content slide 80, demo G
90. About 3 minutes.

CUT TO THE BONE 2026-09-14, in four passes on one day: the toolset slide went
first, then the collision and the upstream ask together, and finally the two that
were left were TIGHTENED UNTIL THEY FITTED ONE FACE and merged. A lead and five
slides and 4 minutes became a lead and one slide and 90 seconds.

A LEAD IN FRONT OF A SINGLE SLIDE is worth a deliberate look now. It was right
when it introduced five; ten seconds to announce one slide is a different
proposition, and the alternative is to fold the lead's sentence into the slide's
own opening and give the section a straight 80 seconds. Kept for now because the
lead is what tells the room the talk has changed register -- from "what this
server does" to "here is the seam" -- and that turn is worth announcing whatever
follows it. WHAT IS LEFT IS THE
SHAPE AND NOT THE EVIDENCE -- how a deployment picks a surface, and Grail as the
worked example of one. Everything measured that this section used to put on a
screen is now in the notes of that one slide, under three banners: the 132-against-386/386 test
result, the 31 modified objects of a cold import, the 262-second class, the
empty-array sender search, and Grail #883/#884/#885. THAT IS A LOT OF ARGUMENT
BEHIND TWO SLIDES, and it is the section most likely to want a minute back if one
appears. See the archive's headers before restoring either.

THE TOOLSET SLIDE WAS REMOVED 2026-09-14, which is why the numbers below moved
down by one. "To add tools, write a toolset" was the section's first content
slide and the only place in the deck that said how a toolset is WRITTEN --
registerOn:, toolNames, the schema builders, assertMutableClass: forwarding to
the server. Its face is reproduced in the archive and its notes are on slide 2
under a banner, so the mechanism is now SPOKEN over the MCP_TOOLSETS bullet
rather than shown. TWO THINGS WENT WITH IT THAT NOTHING REPLACES: the "tools/list
is unfiltered" blockquote, which was this section's only face-level pointer back
to section 11, and the section's opening move -- slide 2 now has to both open the
seam and pick a surface. Give it fifty seconds rather than forty-five.

THE LEAD WAS ADDED 2026-09-14 AND NAMED GRAIL, on instruction -- the outline's
section 6 is "Grail MCP Server" -- so the title gave the room a named server it
may already know and the subtitle carried the generality. ON 2026-09-16 THAT WAS
TURNED AROUND: the lead is now "Customized servers" over "How to make an MCP
server for *your* software", and GRAIL IS NOT ON IT AT ALL. The room meets the category
first and meets Grail on slide 2, which is already the slide that has to both
open the seam and pick a surface.

WHAT THAT COSTS, since the old order was chosen rather than fallen into: a named
thing is easier to hold than a category, and "nothing about it is special" lands
harder after the name than before it. With the name off the lead, the ten seconds
the lead gets are where you put it back -- say Grail out loud, then take the
specialness away. The paragraph below already tells you to do exactly that; as of
2026-09-16 it is load-bearing rather than a flourish.

THE SUBTITLE ALSO STOPPED SAYING "a worked example" and now says "HOW TO make an
MCP server for your software" -- which is not a description of the section, it is
a promise about it, and the section is one slide and one demo. Nobody leaves this
room able to write a toolset from what is on the screen; what they leave with is
where the seam is and what it costs. Say that in the ten seconds rather than
letting the subtitle stand unqualified, and have "the how-to is McpGrailToolset
itself, and it is about two hundred lines" ready for the moment somebody asks for
the steps.

Slide numbers below COUNT THE LEAD.

THE OUTLINE SAYS 2 SLIDES. It is the third section where that number predates
the bullet list under it, and this one is the most lopsided: the list runs to
nine bullets and two of them are measurements with a story attached. It ran to
five slides; since 2026-09-14 it is one, and the outline's number is now wrong in
the other direction for the first time.

THIS IS THE SECTION THE ROOM CAN ACT ON SECOND-MOST, after the codec's defect
table -- which is now at the END of the deck and may not run at all, so if it does not, this is
the first. That was easier to claim while the Grail result and its three filed issues were on a
face; since 2026-09-14 they are in slide 2's notes, so acting on this section now depends on the
speaker saying so. Since 2026-09-14 it is also the LAST thing the room hears if the codec
does not run, which is a second reason to protect it. Everything before it has been "here is what this server does"; this is
"here is the seam, and here is what happens when you use it". Pitch it that way.

WHAT THE 2026-09-11 MERGE DID FOR THIS SECTION, and why slide 3 exists at all.
Until McpServer class>>installedDefaultToolsetNames was removed, the only
optional toolset in the tree was wired by a mechanism nobody else could use --
so this section could only describe how you WOULD add one. Now McpGrailToolset
is configured exactly as a third party's is, and the section can say "copy this"
and mean it literally. Slide 3 is the payoff of the one line section 2 still
spends on this -- toolsetNames nil means the core seven, not "whatever is
loaded". Section 2's slide arguing it came down on 2026-09-13 and its notes
moved to the seeds slide, so THIS section now carries the argument outright.

THE SLIDE THAT LANDED WAS THE COLLISION, and it is not really about Grail: your
domain has a model, this server has a session model, and where they disagree the
disagreement is yours to resolve -- with a number attached that nobody can argue
with, 132 defects against 386/386 clean. Every vendor in that room who writes a
toolset will meet some version of it. IT IS NOT A SLIDE ANY MORE, as of
2026-09-14, and this paragraph stays because it is still the best thirty seconds
in the section: it is the second banner in slide 2's notes, and it is what to say
if the clock gives anything back.

WHAT TO CUT: nothing is left to cut but the section. Both of the slides this list
used to nominate have gone, and so has the one it said not to cut -- the upstream
ask first, the collision with it. What remains is a lead, one slide carrying
both the surface shapes and the worked example, and demo G. That is the minimum
that makes the section an argument rather than a mention. CUT THE DEMO LAST, not
first: without it this section is back to asserting that extending the server
works and showing nobody having done it, which is the state it was in for about
an hour and the reason the demo exists. If more time has to come out of this
talk, take the whole section and keep the appendix. There is no half of this
slide worth keeping without the other: the shapes without the worked example show
nothing a third party has done, and the worked example without the shapes is a
Grail slide in a talk that is not about Grail.

THERE IS A DEMO NOW, added 2026-09-14, and this paragraph records what settled a
disagreement that stood for days. The outline at the end of docs/Presentation.md
had always asked for one -- its section 6 is "Grail MCP Server / a. A custom
toolset / Demo" -- and the standing argument against was that demo B already
showed a tool surface being chosen, so a second one is the same screen with
different words in it. THAT ARGUMENT STILL HOLDS and demo G does not contradict
it: it shows a RESULT, not a surface. What made the demo necessary was the
cutting. By the end of 2026-09-14 this section was the shape without the
evidence, and a demo was the only way to put a measurement back on a screen
without putting a slide back.

WHY THE SENDER SEARCH AND NOT THE TEST FORK. The collision is the better
argument -- it always was, and it is why it is the first banner in slide 2's
notes -- but it cannot be shown live: one class is 262 seconds. The sender search
is the same kind of result in a few seconds, it is a GEMSTONE result rather than
a Grail one (environment 0 against environment 1), and its not searched: block
puts Grail #885 on the screen, which is the nearest thing the deck has left to
the upstream-ask slide that was set aside that morning.

DEPARTURES from docs/Presentation.md:
  * the outline's section 6 is titled "Grail MCP Server"; since 2026-09-16 the
    lead is "Customized servers" and does not name Grail at all, so the section
    is introduced as a category and the example arrives on slide 2;
  * the outline's Grail bullet names grailDirectory as the options example.
    There are TWO declared options -- grailDirectory and testGemConfig -- and
    slide 2 says two, because "a toolset declares its options" is the point and
    one option makes it look like a special case;
  * McpGrailToolset's OTHER collision with the model is speaker notes on slide 2,
    inside the collision banner rather than on a face: Grail models Python exceptions outside the Smalltalk Error
    hierarchy, so McpDispatcher's `on: Error do:` cannot see them and an uncaught
    one would take the whole worker gem down rather than answer the client. It is
    excellent material and there is no room for it; it is the first thing to say
    if a hand goes up on slide 2.
================================================================================
-->

<!-- _class: lead -->

# Customized servers

### How to make an MCP server for *your* software

<!--
THE SECTION LINE CAME OFF THIS LEAD 2026-09-16. It read "**§10** · everything so far
has been what *this* server does -- here is **the seam**, and what happens when
you use it", which is the sentence below, printed. Say the sentence.

Ten seconds, and the sentence that earns the section: everything up to here has
been an account of what this server does. From here it is the seam -- what you
attach to it, and what you run into when you do.

NAME GRAIL AND THEN IMMEDIATELY TAKE THE SPECIALNESS AWAY, because both halves
matter and the second is the point. Grail is GemStone's Python: nine tools --
eval, transpile, source, class and method browsing, module state, tests, two
search tools -- in its own source group, needing nothing from the server. And
since the 2026-09-11 merge it is turned on EXACTLY as a third party's toolset is,
named in MCP_TOOLSETS, because McpServer class>>installedDefaultToolsetNames is
gone and nothing joins a tool surface by being loaded. Before that merge this
section could only describe how you WOULD add a toolset. Now it can say "copy
this" and mean it literally, and the worked example is not an insider.

Do NOT spend the seam's argument here -- slide 2 is the whole of the section now,
and carries the surface shapes, the worked example, and in its notes how a
toolset is written. It is ten seconds away. The lead says what the section is
FOR, not how it works.

Where this ends: demo G, the sender search, which is ninety seconds and the only
evidence this section has left. Before it, slide 2, which is the only slide. It used to end three slides further on, with the collision between a
domain model and this server's session model -- 132 defects against 386/386
clean, the thing every vendor in the room who writes a toolset would have
recognised. That slide and the upstream ask were set aside on 2026-09-14 and both
are in slide 2's notes. So the section's best material is now something you say
after the last bullet rather than something the room reads, and this lead should
promise the shape rather than the number.

THIS IS NOW THE LAST SECTION OF THE TALK PROPER. The codec slides after it are
optional and go first if the clock has gone, so THE TALK PROPER NOW LANDS ON A
LIVE TERMINAL: demo G, with whatever of the collision you have time to say over
slide 2 on the way there. That argument is settled and the slice header records
how.

SECTION 11 NOW COMES BEFORE THIS, not after, which changes one thing to have
ready: "why is narrowing the tool surface not the boundary?" is the question a
toolset author asks during THESE slides, and the room has already been given the
answer. NOTHING ON A FACE POINTS BACK AT IT ANY MORE: the blockquote that carried
the (§11) was on the toolset slide, removed 2026-09-14, so this is yours to make
in speech. The full answer is in section 11's first slide's notes, and it is about execute_code: a tool that
compiles can be followed by one that runs.
-->

---

## How a deployment picks a surface — three shapes

* **`MCP_TOOLSETS="BrainFreezeToolset"`** → a server with **its own tools** to surface **its own domain operations** rather than developer coding tools
* **`MCP_WORKER_CLASS=AcmeDbServer`** → subclass `McpServer` to change **behaviour:** `isProtectedClass:`, `protectedDictionaryNames`, server instructions, the **defaults** for an unconfigured deployment
* **`serverName:` / `serverVersion:`** to identify the product. `serverTitle:` labels *the instance*

### `McpGrailToolset` is the worked example

* **Nine tools** — eval, transpile, source, class and method browsing, module state, tests, and two search tools — in **its own source group** included via `MCP_TOOLSETS`
* It uses two **toolset options** — `grailDirectory` and `testGemConfig` — for proper configuration. These travel as **JSON in the fork string**

<!--
THIS SLIDE IS TWO SLIDES MERGED, 2026-09-14. "How a deployment picks a
surface" and "McpGrailToolset is the worked example" were tightened until
they fitted one face, and the Grail half is the ### subheading half way down.
IT IS THE ONLY CONTENT SLIDE SECTION 10 HAS. Everything the section used to
show is in the three banners below -- how a toolset is written, the collision,
and the upstream ask -- so this one slide is the shape and the notes are the
whole of the evidence.

Three shapes and they are genuinely different decisions, which is why they are
three bullets rather than a paragraph. What tools; how it behaves; and what it
calls itself. SINCE 2026-09-14 THIS SLIDE OPENS THE SECTION -- the "write a
toolset" slide that used to come first was removed and its material is in the
banner below -- so the first bullet is now the room's first sight of a toolset,
and it has to be said as well as shown.

Brain Freeze Insurance is named in the bullets themselves now rather than in a
blockquote under them, which is better: the example arrives with the mechanism
instead of after it. Say why it is the right example and not just a customer --
nobody there wants list_classes, they want their own domain operations, over the
same transport, with the same guardrail underneath. That is the shape of every
deployment this section is for.

THE EMPTY-LIST CASE CAME OFF THE FACE and is worth half a sentence because it
sounds like a mistake and is not: an empty MCP_TOOLSETS is legal, and a router
that offers no tools is a legal, running MCP server. It answers initialize, it
answers tools/list with nothing, and it is what you get while you are building
your first toolset.

TWO CAUTIONS ON THE SUBCLASS BULLET, both off the face since 2026-09-14 and both
things a vendor will otherwise assume the other way. Usually toolsets are the
right answer: a subclass is for changing behaviour, not for adding tools. And
nothing auto-detects a subclass -- the router names it, per session, which is why
it is an environment variable and not something the image discovers.

The name/title split is a small thing that operators feel immediately. Two
instances of one product need to be told apart by a human, and that is the
operator's word, not the vendor's. THE RULE UNDER IT IS ALSO OFF THE FACE NOW:
serverTitle: is omitted entirely rather than sent as null, the same rule the
archived section 4 met on serverInfo -- an absent key means "none given", and null
means the word null rendered somewhere. So a title being present means a human
deliberately labelled that box.

This slide is the payoff of section 2's one line on the named tool surface, and
it is worth pointing back explicitly. Before that merge, the only optional
toolset in the tree was wired by a mechanism nobody else could use, so this
section could only describe how you WOULD add one. Now it can say copy this.
Since 2026-09-13 section 2 makes the claim and this section makes the case, so
expect the "why did the probe exist at all?" question HERE: convenience, and it
was wrong for a reason worth naming -- installing something and running it are
different decisions, and conflating them meant an operator who had never heard of
Grail was serving its tools.

"It needs nothing from the server" is the claim to make deliberately. Grail's
toolset gets no hook, no special case, no entry in core -- it resolves by name
like any other and takes its options like any other. If it needed a hook of its
own, it would not be an example of anything.

Two options rather than one matters for the same reason: one option looks like a
special case, two looks like a mechanism.

The narrowing rule at the end is the one a vendor will hit: configure options for
a toolset, then change the surface and forget, and the router tells you at
startup instead of silently dropping them. Section 2's validateWorkerConfig.

DEMO G FOLLOWS THIS SLIDE, so it is no longer the last thing before the
appendix -- that was true for part of 2026-09-14 and is not now. The two slides that followed it were set
aside on 2026-09-14 and their notes are below, so the last words before the
optional appendix are yours rather than the screen's. TWO WORDS IN THE FIRST
BULLET ARE ALL THAT IS LEFT OF THEM -- "tests" and "two search tools" -- and each
had a slide of its own with a measurement on it. If the clock is holding, spend
thirty seconds on either; if a hand goes up about Grail, it is almost certainly
about one of these two.

================================================================================
TO ADD TOOLS, WRITE A TOOLSET -- from the slide of that name, the section's first
content slide until it was removed 2026-09-14. Its FACE is nowhere else in the
deck, so this banner carries the mechanism as well as the notes: nothing on any
remaining slide says how a toolset is written.

WHAT THE SLIDE SAID, and what to say over this one's first bullet. Subclass
McpToolset and implement two things: registerOn:, which is one
name:description:inputSchema:do: per tool with schemas from the inherited
builders (objectSchema:required:, propString:, boolProperty:), and toolNames,
which is what the toolset offers. Handlers are instance methods taking the parsed
arguments and answering a String; resolveClass:, dictNamed:, linesFrom: and
capResult: cover the usual lookups and output capping. A handler that mutates
passes through self assertMutableClass: cls first, and a toolset built with no
server refuses to mutate at all.

THE POINTER THAT WENT WITH IT, and it is the one worth replacing out loud, because
it was the section's only link back to section 11: tools/list is UNFILTERED --
every tool a session's toolsets registered is offered, and none is refused for
being "unsafe". What a session may DO is decided by the GemStone user its worker
gem logs in as, which the room saw two sections ago. No face in this section
points back there any more.

Open the section by saying what kind of section it is: everything so far has been
"here is what this server does". This is "here is the seam". Two extension points,
and the first is the one you almost always want.

Nobody hand-writes JSON Schema -- the builders are there so a tool's schema is
Smalltalk, and so that the closed-by-default additionalProperties rule of section
5's slide 33 is applied for you rather than remembered.

There is no per-tool safety classification to write, and the pointer above says
why in the positive: a toolset declares what it offers, and the boundary is
somewhere else entirely. Section 11 is where "somewhere else" got its slides, and
they have already run, so this is a reminder rather than an opening.

assertMutableClass: forwarding to the SERVER is the bit that is easy to get
wrong and it generalises: policy belongs to the deployment, not to the component.
Two toolsets must not disagree about what a protected class is, and a vendor
should not have to know. The fail-closed-with-no-server case is not theoretical
-- it is exactly what a toolset built standalone in a test gets.

If asked how a handler reports failure: raise. The dispatcher classifies Errors
into the isError envelope with a kind, which the archived section 5 showed. A
handler does not build error envelopes itself.

================================================================================
WHEN A DOMAIN TOOLSET COLLIDES WITH THE SESSION MODEL -- from the slide of that
name, set aside for time 2026-09-14. This is the "tests" in the first bullet. It
was the slide the slice header called the one that lands, and it was set aside
because the section had to fit, not because it stopped being true.
================================================================================

WHAT THE SLIDE SAID: run_python_tests forks a fresh gem, and that is the design
rather than a precaution. Measured 2026-09-01, the same three test classes gave
132 DEFECTS run in a long-lived worker session and 386 run / 386 passed / 0
failed / 0 errors run fresh. Every one of those defects was an artifact of the
session.

The general shape, and it is not really about Grail: your domain has a model,
this server has a session model, and where they disagree the disagreement is
yours to resolve. Every vendor in that room who writes a toolset will meet some
version of it.

Lead with the number. 132 against 386/386 is not a tuning difference, it is the
session inventing every single defect -- and it is the kind of result that would
have been reported as a Grail bug by anybody who did not know where to look.

Then the mechanism, slowly, because it is a genuine standoff rather than a bug in
either party. Grail's rule is that a module is a compiled artifact in the
database, bound and never rebuilt by every import afterwards; its SUnit isolates
tests by evicting framework modules from sys.modules, and where those modules are
committed, re-importing raises. A long-lived MCP worker is exactly the session
that accumulates that state. Grail is right that a committed module is canonical.
Its SUnit is right to isolate by eviction. Put them in a session with history and
they contradict each other, and the MCP worker is the session with the most
history anybody has.

Forking settles three more things at once: the caller's transaction is untouched,
where an in-session run dirties it silently -- a cold Grail import is a database
write, measured at 31 modified objects for a 7-test class -- and the child's
writes are never committed, so a run leaves the repository exactly as it found
it.

The cost is honest and stated in the tool. Every run is fully cold;
FlaskScaffoldingTestCase alone is 262 seconds. Hence the classNames argument, and
why this is the flagship consumer of progress: an unbounded wait with no word is
worse than a slow one that says so.

THE OTHER COLLISION, which is the first thing to say if a hand goes up: Grail
models Python exceptions OUTSIDE the Smalltalk Error hierarchy -- NameError
inheritsFrom: Error is FALSE -- so McpDispatcher's on: Error do: cannot see one.
Uncaught, a python-tool error would escape the dispatcher and take the whole
worker gem down instead of answering the client. The toolset catches them itself
and converts them to an McpError kinded #pythonError. That is the same lesson in
a different register: a domain's error model is part of the collision surface
too.

If asked about the forked gem's memory: it is driven ONE CLASS PER SEND and
forked with Grail's own budget, because a netldi's default 50MB is not enough for
a single Grail test class -- and the run bounds memory as well as raising it,
stopping near the ceiling, because a Grail run that ends full does not crash, it
reports AlmostOutOfMemory against an innocent test.

================================================================================
A GEMSTONE RESULT, AND THREE ASKS ALREADY FILED -- from the slide of that name,
set aside for time 2026-09-14. This is the "two search tools" in the first
bullet. It was the section's closing slide and the only place the deck named the
Grail issue numbers.
================================================================================

WHAT THE SLIDE SAID: the stock sender search answers NOTHING for Python,
confidently. It scans environment 0; Grail compiles into environment 1. Measured
on 3.7.5 with _grail_session imported, ClassOrganizer new sendersOf: #'_dict'
answers an empty pair of arrays where 12 senders exist -- not under-reporting,
but reporting nothing with no indication that it could not look. find_python_
senders searches all three shapes a Python reference compiles into: resolvable
calls in compiled methods, first-class references and unresolved attribute calls,
and the .py text on disk. Every answer ends with a searched: and a not searched:
block. And three interfaces that would let it stop reading Grail's internals are
filed upstream as Grail #883, #884 and #885.

It is here for this audience specifically: it is a GemStone result, it is
measured, and the asks are already filed rather than being made from a stage.

The phrasing to get right is "confidently". A search that says it could not look
is useful. A search that answers an empty array is indistinguishable from a
search that looked everywhere and found nothing, and a model reading that answer
will conclude the name is unused and delete something.

The searched:/not searched: block is the design response and it generalises past
Python: any tool whose coverage is partial owes the caller its own boundaries.
That is worth ten seconds on its own, because every vendor writing a search tool
over their own domain has the same obligation.

THE THREE ISSUE NUMBERS ARE NOW IN SPEECH ONLY, which is the one thing this
set-aside genuinely costs: they were on the slide so that nobody had to write
them down. If they matter to the room, say them twice or offer them afterwards.
Section 13 collects the asks; this one is already lodged, which is the point --
it is not a request made from a stage, it is a request made in the tracker with a
talk mentioning it.
-->

---

<!-- _class: demo -->

# DEMO G — the sender search, and what it says it did **not** search

```bash
MCP_TOOLSETS="McpGrailToolset" ./run-server.sh        # a Grail stone, one client, fresh session
```

1. **`find_python_senders _dict`** → `compiled 0, references 0, .py text 15`, and a **`not searched:`** block saying why: nothing has imported that module **in this session**
2. **The stock search, same name, same session** — `ClassOrganizer new sendersOf: #'_dict'` → **`anArray( anArray( ), anArray( ))`**. Empty, *confidently*: **no indication that it could not look**
3. **`import _grail_session`, then run it again** → **`compiled 12`**, every hit printing **`env 1`** beside it. The stock search scans **environment 0**
4. Step 3 also raises the **`[session]`** line — because **a cold Grail import is a database write**

<!--
THE FINE LINE CAME OFF THIS FACE 2026-09-16. It read "**90 seconds.** No second gem, no IdP, no
timing window. The `not searched:` block prints **Grail #885** on screen, so the ask reads itself
out." The #885 claim is about the DEMO'S OWN OUTPUT and is still true -- the block prints the issue
number whether or not the slide says so -- and the slice header rests on it. What came off is the
reassurance, which was there for you: after demo F this is the safe one, and it is the reason this
demo rather than the test fork is where the section ends.

THIS DEMO IS THE SECTION'S EVIDENCE, put back on a screen without putting a slide
back. Section 10 was cut on 2026-09-14 from a lead and five slides to a lead and
one, and what went was everything it could prove. This is the one measurement of
those that runs in seconds rather than in 262 of them, which is why it is the
demo and the test-fork result is not.

WHAT LANDS IS BEAT 2, not beat 3. A search that says it could not look is useful.
A search that answers an empty array is indistinguishable from one that looked
everywhere and found nothing -- and a model reading that answer concludes the
name is unused and deletes something. Say that sentence over the empty arrays and
then move.

Beat 3 is the GemStone half and it is why this belongs in front of THIS room:
environment 0 against environment 1, printed on every line of the output, with 12
senders where the stock tool answered none. Nobody has to take the attribution on
trust -- env 1 is on the screen.

Beat 4 is free and worth five seconds if the room is with you: the import dirties
the session, so section 7's [session] line turns up unprompted in section 10. A
cold Grail import is a database write -- 31 modified objects for a 7-test class,
measured -- which is one of the two reasons run_python_tests forks a gem. The
other is on page 50, in the collision banner. DO NOT open the collision here
unless a hand goes up; it is fifty-five seconds and this demo is ninety.

STAGING, and beat 1 depends on it entirely: the session must be FRESH. If
anything has already imported _grail_session, beat 1 answers compiled 12 straight
away and the demo has no shape. Reconnect the client immediately before starting,
and do not rehearse beat 3 on the session you are about to present from. Abort
afterwards -- the import leaves uncommitted work, and the next demo's [session]
line will otherwise be about this one.

MEASURED 2026-09-14 on gs375c, 3.7.5, and the outputs above are verbatim from
that run rather than reconstructed. The counts are stable but not guaranteed:
.py text was 15 and compiled was 12, against the 12 that section 10's removed
upstream-ask slide quoted. If the numbers differ on the day, the argument does
not -- it is empty against not-empty, not 12 against anything.

FALLBACK: a screenshot of the two answers side by side. This is the safest demo
in the deck -- one client, one stone, no second gem and no clock -- so the
fallback is unlikely to be needed, but the screenshot is also what to use if the
projector cannot show a terminal legibly at this size.

WHAT THIS DEMO DOES NOT DO, said plainly because the slice header argued against
a Grail demo for two days: it does not show a tool surface being chosen. That was
demo B and this is not a second one. It shows a RESULT.
-->

---

<!--
================================================================================
THE JSON CODEC -- a lead and the last three slides of what was VERTICAL SLICE 6,
section 5.
MOVED TO THE END OF THE DECK 2026-09-14, after section 10 (after section 12
until that section went, and after section 11 until sections 10 and 11 swapped,
all the same day), as material to run
only if there is time. The four trace slides that used to precede them are in
archive.md; these three stayed because they are the part THIS ROOM can act on --
their defects, in their kernel, measured -- and slide 4 is the concrete ask of
the talk, which section 13 collects and section 11's notes already name as one
of the two things being asked for. (That read "section 11's slide" until the lock
slide was folded away on 2026-09-14; the other ask is a heading on page 48 now,
rather than a slide of its own.)

Running order and plans, in seconds -- lead 10, why the writer is owned 50,
inbound 45, the five defects 60. 165s, all of it optional now.

THE LEAD WAS ADDED 2026-09-14, and it calls this an APPENDIX on instruction.
That is a framing decision rather than a cosmetic one: an appendix announces
that the talk proper has ENDED, so running it is a gift and dropping it costs
the room nothing it was promised -- which is exactly the contract these slides
have had since they moved here. It also gives the drop a clean seam. If the
clock has gone, stop at the lead; do not start the section and abandon it
halfway, because the ask is the last slide and the first two are what earn it.
The lead does NOT carry a section number in its last line where every other
lead does -- the material is still section 5 and the deck does not renumber for
a cut, but "Appendix" is what the room is being told. SLIDE NUMBERS BELOW COUNT
THE LEAD.

THEY STAND ALONE, which is why they could be moved at all: nothing in them
depends on having walked a request, and the argument runs writer -> reader ->
the filed report without reference to a trace. The only repair the move needed
was the opening, which no longer arrives mid-section.

the outline gives the codec "1-2 slides". It gets three, because the defect
table cannot share a slide with the argument for owning the writer and stay
readable at the back of a room.

THE DEFECT TABLE SAYS FIVE; McpJson's class comment says three, and the COUNT is
not the problem -- neither should be "fixed" into the other. The class comment
enumerates the three defects that bear on ONE design decision (which half of the
codec to own) and says so in its own words; the table is the filed 3.7.6 report,
a superset adding the unchecked hex digits after \u and the leniency family.
WHAT IS wrong is that the two number the same defects in a different ORDER --
encoding is defect 1 in the class comment and defect 2 in the report -- and
McpJsonTest already cites "defect 2" meaning the report's. So a reader who
follows the class comment's list lands on the decoding defect instead. That is
item 6 of "What to fix in the repository before the talk" in
docs/Presentation.md, with the recommendation; it changes nothing on this slide,
and it wants doing before docs/kernel-json-unicode.md reaches the tree.

THE DOCUMENT THE SLIDE OFFERS IS NOT IN THE TREE. docs/kernel-json-unicode.md is
cited from README.md, McpJson's class comment, McpJsonTest and docs/utf8-wire.md,
and it lives outside the repository along with three later variants including the
filed 3.7.6 report this table quotes. The outline already knows (its "What to fix
before the talk", item 2) and recommends committing it. THAT HAS TO HAPPEN BEFORE
THE TALK or slide 4's last line is an offer of something nobody can take: this
room will ask for the file by name, and the README they have open cites a path
that 404s. It is still true even though the slides are now optional -- if they
run at all, they run with that offer on them.
================================================================================
-->

<!-- _class: lead -->

# Appendix: the JSON codec

### Owning the writer, repairing the reader, and five measured kernel defects

<br>

**Appendix** · the class to remove when JSON parsing is fixed

<!--
Ten seconds, and only if the clock allows -- this is the one stretch of the deck
that is PLANNED to be dropped. Say the word appendix out loud. It is not an
apology for the material; it is a promise that nothing after this point is needed
to understand anything before it. The three slides stand alone, which is why they
could be moved here at all: nothing in them depends on having walked a request.

IF THE CLOCK HAS GONE, STOP HERE rather than starting and abandoning it. Slide 4
is the ask, and slides 2 and 3 are what earn the right to put it up -- the defect
table on its own, with no account of why the writer is owned, is a list of
complaints rather than a case.

THE SECTION NUMBER IS STILL 5, and that is why this lead's last line says
"Appendix" where every other lead says a section. The trace slides that were this
section's first half are in archive.md; the deck does not renumber for a cut. Do
not say "section 5" out loud -- say the JSON codec, which is what the slide says.

WHERE IT LANDS, so the shape is in your head before you start: the last slide is
five measured defects in THEIR kernel, with a copy-pasteable reproduction and a
suggested fix for each, and a sentence asking for a name. That is the concrete
ask of the talk and section 13 collects it. Two of the five are silent data
corruption on a public API.

BEFORE THE TALK, and true whether or not these slides run:
docs/kernel-json-unicode.md is still not in the tree, and slide 4 offers it by
name to a room with the README open. The slice header has it in full.
-->

---

## Why this server owns its JSON **writer** — and only the writer

`McpJson class>>write:` replaces `Object>>asJson` and answers **a byte `String` of UTF-8**.

> **The one defect an application cannot route around.** `printJsonOn:` keeps only **bits 12–15** of a codepoint above U+FFFF instead of emitting a surrogate pair: U+1F600 goes out as `"\uF600"`, and some codepoints as a **lone surrogate**, which is not well-formed JSON. **By the time `asJson` has answered, the codepoint is gone** — no post-pass can recover it.

* Writing UTF-8 **does not fix that arithmetic so much as never reach it**: a surrogate pair is an artefact of `\u` escapes and UTF-16, and UTF-8 spells an astral codepoint directly in four bytes. Only RFC 8259 §7's mandatory escapes are emitted
* **Bytes rather than characters is load-bearing**, and three unrelated things downstream depend on it: `Content-Length` is written as `body size` · the worker→front-end hop is measured in bytes by the kernel's result fetch, **whose buffer is sized in bytes** · `MCP_TRACE` writes bodies through `GsFile`, where a 16-bit string comes out garbled

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

WHY THEY HOLD, which came off the face on 2026-09-14 and is the sentence that
closes that bullet: a byte String's #size IS its byte count whatever the bytes
are. Not "is checked to be", not "is usually" -- the two cannot disagree, so all
three dependencies hold BY CONSTRUCTION rather than by anybody maintaining them.
Say it after the third item, not before the first.

"ON EVERY PRODUCTION PATH" ALSO CAME OFF THE FACE, and the qualifier is worth
keeping in speech because a GemStone developer will wonder about it: asJson is
not removed from the image and is not forbidden -- it is that no path that
answers a client goes through it. The distinction matters if anyone asks whether
this is a patch. It is not; nothing kernel is touched.

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

THE ASYMMETRY CAME OFF THE FACE ON 2026-09-14 and it is what this slide is for,
so say it at the end rather than losing it: FORTY LINES AT THE EDGE, where the
outbound defect needed a whole writer. The reason is not that inbound was easier
to write -- it is that inbound THE INFORMATION IS STILL THERE, in the escapes,
where outbound it had already been destroyed by the time asJson answered. Repair
is possible exactly when nothing has been thrown away yet.

The two error behaviours went with it, and both are worth having ready because
they are the obvious follow-up question. An unpaired half becomes U+FFFD -- a
replacement character, because half a pair is a client's mistake and not a reason
to refuse the request. A malformed BYTE sequence refuses the whole body with a
-32700 naming the offset, because a bad encoder means nothing it sent can be
trusted. Lenient about one, strict about the other, and the line between them is
whether the damage is local.

Performance footnote for anyone who worries about a scan per request: the repair
gates its scan behind one primitive findString: and answers the receiver itself
when there is no escape to find. 0.05ms against 3.6ms for a character loop over
a 63KB body.
-->

---

## Five defects, measured

| # | defect | effect |
|---|---|---|
| 1 | `JsonParser>>string` — no surrogate-pair **decoding** | an escaped astral character raises `OutOfRange` (2723): **nothing above U+FFFF can be sent escaped** |
| 2 | `printJsonOn:` — no surrogate-pair **encoding** | U+1F600 → `\uF600`; U+10000 → NUL; U+1D800 → a **lone surrogate**, ill-formed JSON. **No error** |
| 3 | `JsonParser>>string` — an unrecognized escape is **dropped** | `{"a":"\x"}` parses to `'a' -> ''`; RFC 8259 §7 admits exactly eight escapes |
| 4 | `JsonParser>>string` — the four characters after `\u` are **not hex-checked** | `\uZZZZ` becomes U+0000, because `'16rZZZZ' asNumber` is 0 |
| 5 | `parse:` — leniencies, and error quality | trailing content ignored · raw control characters accepted · empty input is a `MessageNotUnderstood`, not a JSON error |

**Two of the five are silent data corruption on a public API** (2, 4). One raises three layers from its cause (1). Two accept what is invalid (3, 5).

<!--
THE CONCRETE ASK OF THE TALK, and the slide section 13 collects. Everything
before it in this section exists to earn the right to put it up.

SAY THE ASK, BECAUSE IT IS NO LONGER ON THE SLIDE. It was the last line of the
fine print until 2026-09-14 and it is seven words: "I WOULD LIKE TO HAND THIS TO
SOMEONE." Nothing on the face asks for anything now -- the table states five
defects and stops -- so if you do not say that sentence, the slide the whole
appendix exists for makes no request at all. Say it plainly and then STOP
TALKING. The room fixes these. Do not soften it, do not apologise for it, and do
not fill the silence -- a pause here is the whole point, and somebody in that
room will say a name.

THE PROVENANCE CAME OFF THE FACE WITH IT, and it is what makes the ask credible
rather than a complaint, so it goes in the same breath: measured against 3.7.6,
on a stock extent0.dbf, every result a live measurement rather than a reading of
the source -- with a copy-pasteable reproduction and a suggested fix per defect.
That last clause is the one that turns "here are five bugs" into "here is work
already done for you", and this room knows the difference.

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
