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
ELEVEN VERTICAL SLICES. Sections 0-12 are cut, and THIS FILE IS IN RUNNING ORDER THROUGHOUT.
Section 13 is the only one left. Sections 0 and 1 (two slides), then sections 1 to 3 (eight), then
section 4 (ten), then section 5 (seven), then section 6 (six), then section 7 (fourteen), then
section 8 (ten), then section 9 (six), then section 10 (five), then section 11 (three), then
section 12 (five). In the order they were CUT that is slice 3, slice 4, slice 5, slice 6, slice 7,
slice 1, slice 2, slice 8, slice 9, slice 10, slice 11 -- the two centrepieces were cut first on
purpose, because they are what the budget has to fit around.

Each slice's own header comment sits beside its first slide.

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
invisible on a projector -- which nothing revealed until demo C's curl became the first demo
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
went with it, to sit immediately before demo B. So this slice is the title and
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

**For the GemStone developers** — a report on the state of the project

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

## What is different

* This exists to replace the **GCI-based Jasper MCP server** with something **any** MCP client can reach over plain HTTP
* It runs **inside the image**. No Node process, no GCI bridge, no FFI
* The socket runs in a **gem**. The tools execute in a session in a **gem** — with a **login**, a **transaction view**, and a **commit record**
* This server conforms to MCP specifications [2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18) and [2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) but not yet to [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
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
waiting for the caveat and asks in section 4 what section 7 answers properly.

Deliberately not a diagram. The picture comes next, in the gem-contents sequence, and the request
picture belongs to section 4 where it is walked line by line.
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

Every box is **one object**. The front-end gem owns the socket and knows who the sessions are; the worker gem runs the tools. Nothing is shared between them &#8212; not a variable, not a view, not a transaction. **One string crosses the gap in each direction**.

</div>

<!--
The establishing shot. Do not explain anything yet -- name the two gems, say that the boxes are
objects rather than classes-in-general, and move. Everything on this slide gets its own slide.
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

Reads **one** HTTP/1.1 request and writes **one** JSON response, `MCP-Session-Id` header included. It also writes the SSE stream, every frame gated on the socket being writable, plus a non-blocking read-side disconnect check &#8212; which is how a **closed editor tab** is noticed.

</div>

<!--
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
other two are section 6's and section 8's -- the front end must own the client's STREAM, and the
front end must own VIEW HYGIENE, because only the front end has a heartbeat. Promise both rather
than spending them here; section 5's nbExecute: slide meets the same fact from the other
direction and says so.
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
now explicit -- one call in flight per session, and no interleaving. Section 5.
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

## Mcp*Toolset &#8212; the unit you add tools in

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
VERTICAL SLICE 4 -- installing, and starting a server. Eight slides -- a lead,
the file-out table that is all that is left of section 1, two for section 2, two
for section 3, then demo A and demo B back to back at the end. Cut 2026-09-11:
second in running order, fourth to be cut. It took the install slide and demo A
on 2026-09-13, when section 1 stopped being a section of its own, and lost four
slides over the two days after -- this slice is now half slides and half demo,
which is deliberate. It is the first place in the hour the room can see the thing
running, and nothing here is worth arriving at it tired.

Running order and plans, in seconds -- lead 10; nothing to install 35 (section 1);
config on an instance 30, what initialize seeds 35 (65s, section 2); forkOnPort:
45, in the child 40 (85s, section 3); demo A 60, demo B 90. 195s of slides plus
150s of demo -- 5:45.

THE TWO DEMOS ARE ADJACENT ON PURPOSE and they are provisional: demo A installs
from nothing and demo B starts a server from a here-doc, which is one story told
twice on the same machine. Dropping A, or folding its --check into the head of B,
is the cheapest 60 seconds in the deck and is expected rather than feared.

THE THESIS OF THE PAIR is one sentence and the lead says it: a server is a gem,
started by evaluating an expression, configured entirely on an instance, and
detached. Nothing about it is committed and nothing about it is a fact about the
image -- which is what lets several differently-configured routers serve one
stone at once, and is also why there is no file on disk to read afterwards --
which is what makes the gem log worth tailing on stage, and is demo B's step 2.

Section 2 is the cheap half and should be run fast. Section 3 is where this
audience is, and it now opens on forkOnPort: rather than on the kernel fact --
"a gem executes no Smalltalk while it is idle" came down on 2026-09-13 because
the gem-contents sequence already puts that fact in front of the room, in the
McpRouter box, fourteen slides earlier. Say it there, not here. What it earned
survives in two places: its three conclusions are in that box's notes (the front
end owns the stream, and owns view hygiene, because only the front end has a
heartbeat -- sections 6 and 8 each come back for one), and its deployment half is
in forkOnPort:'s notes, where the seven steps ARE the picture it used to draw.

SECTION 3 IS TWO SLIDES NOW, and both are code. The banner and transactionless
came down on 2026-09-13 for the same reason, one slide apart: each was being
described immediately before the room could see it. The banner is demo B's step 2
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
the request picture is section 4's. If this run ever feels too verbal, the
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
    Section 12.3 still owns whatever the old floor left behind.

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

<br>

**§1–3** · nothing here is committed, and nothing here is a fact about the image

<!--
Where we are: the gem-contents sequence has just shown what is in a front end
and what is in a worker. This run is the first of them being born -- installed on
the next slide, forked four slides later. Sections 4 and 5 are the second.

The title took "Installing" on 2026-09-13, when section 1 came down to a single
slide -- the file-out table -- and it made no sense to lead a one-slide section of
its own. That slide now opens this run, and the two demos close it.

Say the thesis before the first slide, because it makes the rest of the pair
coherent and it is the part this audience will test: a server is an EXPRESSION
someone evaluated. There is no server object in the repository, no configuration
file, no installed service. Kill the gem and there is nothing left to clean up.

Seven minutes for the pair including the demo. Section 2 is the half to run fast;
section 3 is the half this room came for.

If we are behind: this lead slide is the first thing to cut in the whole deck.
-->

---

## There is nothing to install but topaz file-outs

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
Spend no time defending the absence of a package manager; state it and move on. The audience this
matters to is the one that has to file it into an image on a customer machine.

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

Two suites fail ON PURPOSE and both belong to later sections: McpExternalSessionTest fails on an
unsupported image because that is how it reports the image (section 12), and McpConcurrentEdit
Test>>testTheStoneAloneWouldAllowThatClobber is written to fail on GOOD news (section 7). Seven
suites need a netldi because they spawn real worker gems -- McpAuthTest, McpAuthConformanceTest,
McpExternalSessionTest, McpTransactionTest, McpWorkerDeadlineTest, McpConcurrentEditTest and, since
2026-09-10, McpGrailToolsetTest -- and they need spare LOGIN SLOTS, which is the likeliest cause of
a failure that has nothing to do with the code.
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
* So **several differently-configured routers can serve one stone at once** — a browsing-only one on 8001, an authenticated one on 8443 — and none of them is a fact about the image
* What travels in that string is **paths and identifiers only, never key material**

<!--
Run this slide fast. It exists so that nobody spends the rest of the hour looking
for the config file, and it is worth exactly that much.

The claim to make explicitly, because it is unusual enough to be worth saying out
loud: there is no server object in the repository. Nothing was committed when this
started. If you want to know what a running server was told, you read its gem log
-- which is why demo B tails the gem log, and why its banner is seven
deliberate lines rather than a debug dump.

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
| session lifetime | `sessionIdleTimeoutSeconds` 1800 · `livenessProbeIntervalSeconds` 120 · `reaperIntervalSeconds` 60 · two stream deadlines, 60 and 10 · `requestTimeoutSeconds` `nil` · `maxSessionLifetimeSeconds` `nil` |
| view hygiene | `maxCommitsBehind` 20 · `stuckViewGraceSeconds` 60 · `pinnedViewGraceSeconds` 300 |
| this gem | `frontEndTransactionMode` `transactionless` |
| security | `allowedOriginHosts` loopback · `messageTrace` **false** |

Where `nil` becomes a default: `workerClassName` → `McpServer`; `toolsetNames` → `defaultToolsetNames`; `workerUserId` → the front end gem's own user.

<!--
Do not read the table. Say the rule, let them scan, and move on -- the numbers
are all on later slides where they matter, and this one is here so that section 8
does not have to stop and explain where 20 came from. maintenanceCallTimeoutSeconds
(5), streamlessIdleTimeoutSeconds (60) and streamLossGraceSeconds (10) are the
three seeded values not spelled out, for room; section 8 introduces all three
where they are used.

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

## `McpRouter>>forkOnPort:`, in order

1. `validateWorkerConfig` + `validateTimerConfig` — **in the launching session, not just the child**
2. Build a `GsTsExternalSession` with a one-time password**
3. `login`
4. **Capture `stoneSessionId` and the host pid _before_ launching the loop** — once the non-blocking call is running, the external session refuses further queries (`GciError`, *operation in progress*)
5. `forkAndDetachString: 'McpRouter runOnPort: 8000 configJson: ''{…}'''`
6. `logout` the handle — **the child is independent**
7. Answer a status string carrying **three ways to stop it**: `./stop-server.sh` (by port), `System stopSession: <id>` (from any session), `kill <pid>` (shell)

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
This demo moved on 2026-09-13 to sit immediately before demo B, and the two are now one stretch of
terminal: install from nothing, then start a server from a here-doc. It costs nothing to stage --
no server, no second gem, no timing -- so it is still the one to stretch if the room is settling,
and it is the FIRST thing to cut if we are behind. Cutting it to a single `--check`, or folding
that `--check` into the head of demo B, loses nothing but the scroll.

What to point at while it scrolls: the line where it decides about auth. That is the whole version
story in one line of output, and section 12 will come back to it.

Do NOT get drawn into GEMSTONE_GLOBAL_DIR here beyond the one sentence. The full version is in the
README and it is a ten-minute conversation: netldi and stone each bind an ephemeral port and record
it under that directory, /etc/services is a trap rather than a fix, and install.sh logs in linked
(-l) specifically so it needs no netldi at all.
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
the record), then the toolsets line in the banner -- which is the one line
section 2 spends on toolsetNames, live, and the moment to say "seven toolsets,
thirty-one tools, and Grail is not among them because I did not name it". If the demo machine has a Grail
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

THE BANNER, absorbed 2026-09-13 from the slide that used to sit just before this
run. It came down because step 2 puts the real thing on the projector, and a
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
serverInfo in demo C). And the worker login is the plain 3.7.5
useOnetimePassword spelling, which is why slide 5's bullet says "one-time
password" and explains nothing.
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

`McpSession startWithId: newId workerUser:` — `GsTsExternalSession`, **one-time password**, `login`, then `cacheWorkerIds`: the worker's stone session id and host pid, **fetched once, at login**.

Then the front end **pushes what the worker is to be** — its class, its toolsets and their options, the identity it advertises, and its two deadlines — and `prepareWorker` sends **one expression**:

```smalltalk
McpServer prepareWorkerWithToolsets: #('McpBrowsingToolset' 'McpExecutionToolset' …)
  options: nil serverName: nil title: nil version: nil
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
SessionTemps current at: #McpFrontEndSession put: aFrontEndSessionOrNil.
srv := self newWithToolsetNames: … toolsetOptions: … .
SessionTemps current at: #McpServer put: srv.
```

* **`nameThisGem:` first**, before anything in this method that can fail
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

"31 tool(s)" is the core seven's count, and this is the first place in the deck
the surface gets COUNTED -- section 2 spends one line saying only that toolsetNames
nil resolves to defaultToolsetNames. Section 10 counts it again at 40, with Grail
named. Point forward if the room caught it.
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
GsProcess in the front end stops. That is the SAME fact as section 1's McpRouter
box -- a forked GsProcess runs only while the gem is executing Smalltalk --
arriving from the other direction, and it is worth saying so out loud. The front end has three kinds of work in flight
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

tools/list is unfiltered: every tool a session's toolsets registered is offered,
and none is refused for being unsafe. What bounds a session is the GemStone user
its worker gem logs in as -- section 11.
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
VERTICAL SLICE 7 -- section 6, progress notifications. Five slides and demo D.
Cut 2026-09-12: fifth in running order, seventh to be cut.

Running order and plans, in seconds -- a worker cannot write to its own client 50,
the client opts in 50, the reporter's three judgements 40, two end-to-end bugs 50,
the other stream 40 (230s of slides); demo D 90. About 5 1/2 minutes.

THE OUTLINE SAYS 2-3 SLIDES AND THIS IS FIVE. The outline's own bullet list under
section 6 runs to a page and a half and includes a picture, a demo, and the whole
of the standalone GET stream, which section 8 then rides. Two or three slides was
a budget guess made before that list existed, not a judgement about the material.
Five is what it takes; the two to cut under pressure are named below.

NO LEAD SLIDE, again, and for a better reason than section 5's. Section 6 IS a new
subject -- it is the first time anything travels from a worker BACK to a client --
but the premise and the picture are the same slide, and a lead in front of them
would announce what slide 1 then proves. Slide 1 is the lead.

WHAT TO CUT IF THE HOUR IS GOING, in order:
  1. "the other stream" (40s) -- section 8 needs the outbox, but it can introduce
     it in one sentence where it uses it. This slide is a convenience, not a
     dependency;
  2. demo D (90s) -- it is the most timing-dependent demo in the deck and the
     least load-bearing, and slide 4 already tells its story.
Do NOT cut slide 4. It is the best material in the section: two bugs that cannot
exist in a unit test, both found end to end, and this audience knows exactly how
expensive that class of bug is.

THE PICTURE IS NEW rather than the one the outline asked for. The outline says
"draw it as the section 5 diagram plus one arrow each way" -- but there is no
section 5 diagram (see slice 6's header for why the summary diagram is gone), and
a tick's path is a different shape from a request's anyway: it leaves a gem that
is not answering anything, goes through a queue owned by the STONE, and arrives
at a process that has to work out which call it belongs to. Drawn on its own it
is four boxes; grafted onto a request diagram it would have been an annotation.
Seventh inline svg.

THE HONEST BIT, and it must stay honest: the Claude Code transport is configured
timeoutMs 60000, and SOME MCP clients reset that timer on each progress
notification. If this one does, progress is not a nicety, it is the fix for long
GemStone jobs being cut off client-side. NOT TESTED. Slide 2 says "not measured"
in those words, and the notes say to say it out loud. Do not let this one drift
into a claim between now and the talk -- measure it or keep saying so.

DEPARTURES from docs/Presentation.md:
  * the outline's step-by-step path (its six numbered steps) is the diagram plus
    slide 3, not a slide of its own. Numbered call chains do not survive being
    read off a screen, and every step in that list is either on the picture or is
    a consequence the later slides spend properly;
  * McpProgressChannel existing BESIDE McpOutbox rather than reusing it -- the
    outline gives it a bullet under "where progress may travel" -- is the closing
    line of slide 5, where both queues are on screen together and the shared
    protocol can be pointed at.
================================================================================
-->

## A worker cannot write to its own client

<div style="text-align:center">
<svg viewBox="0 0 960 234" role="img" aria-label="A progress tick's path: the worker gem's reporter sends an inter-session signal to the Stone's 50-message queue, the front end's signal poller drains it every 100ms and routes it by call id to that call's progress channel, and the front end writes it to the client as a notifications/progress SSE frame.">
  <defs>
    <marker id="m6" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="currentColor"/>
    </marker>
  </defs>
  <!-- arrow labels, above the row -->
  <text x="243" y="58" font-size="12" text-anchor="middle" fill="currentColor" opacity=".8">System sendSignal:</text>
  <text x="243" y="76" font-size="12" text-anchor="middle" fill="currentColor" opacity=".8">to:withMessage:</text>
  <text x="511" y="58" font-size="12" text-anchor="middle" fill="currentColor" opacity=".8">InterSessionSignal poll</text>
  <text x="511" y="76" font-size="12" text-anchor="middle" fill="currentColor" opacity=".8">every 100ms</text>
  <text x="779" y="58" font-size="12" text-anchor="middle" fill="currentColor" opacity=".8">notifications/</text>
  <text x="779" y="76" font-size="12" text-anchor="middle" fill="currentColor" opacity=".8">progress</text>
  <!-- boxes -->
  <rect x="14" y="92" width="190" height="70" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <text x="109" y="118" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">worker gem</text>
  <text x="109" y="140" font-size="12" text-anchor="middle" fill="currentColor" opacity=".7">McpProgressReporter</text>
  <rect x="282" y="92" width="190" height="70" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <text x="377" y="118" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">the Stone&#8217;s queue</text>
  <text x="377" y="140" font-size="12" text-anchor="middle" fill="currentColor" opacity=".7">50 messages, per session</text>
  <rect x="550" y="92" width="190" height="70" rx="4" fill="none" stroke="currentColor" stroke-width="1.9"/>
  <text x="645" y="118" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">front-end gem</text>
  <text x="645" y="140" font-size="12" text-anchor="middle" fill="currentColor" opacity=".7">poller &#183; channelAt: callId</text>
  <rect x="818" y="92" width="128" height="70" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <text x="882" y="118" font-size="15" text-anchor="middle" font-weight="600" fill="currentColor">client</text>
  <text x="882" y="140" font-size="12" text-anchor="middle" fill="currentColor" opacity=".7">SSE frame</text>
  <!-- arrows -->
  <line x1="206" y1="127" x2="278" y2="127" stroke="currentColor" stroke-width="1.5" marker-end="url(#m6)"/>
  <line x1="474" y1="127" x2="546" y2="127" stroke="currentColor" stroke-width="1.5" marker-end="url(#m6)"/>
  <line x1="742" y1="127" x2="814" y2="127" stroke="currentColor" stroke-width="1.5" marker-end="url(#m6)"/>
  <!-- notes -->
  <text x="377" y="186" font-size="13" text-anchor="middle" fill="#b4451f" font-weight="600">SignalBufferFull in the SENDER on the 51st</text>
  <text x="480" y="216" font-size="14" text-anchor="middle" fill="currentColor">The socket belongs to the front end&#8217;s process. That is the whole reason this path exists.</text>
</svg>
</div>

A worker gem is a **separate OS process**, and the client's socket was accepted by the front end's. **A file descriptor means nothing outside the process that owns it, and GemStone exposes no way to pass one.** So a tool rings a doorbell instead.

<!--
The premise first, and it is one sentence: a tool cannot write to its own client,
and no amount of design gets around that. Everything in this section follows.

Walk the picture once. The part worth pausing on is the middle box -- the queue
belongs to the STONE, not to either gem, and it is shared by every worker
signalling this front end. That is where the rate limit on slide 3 comes from,
and the red line is the reason it cannot be politeness.

The payload is deliberately tiny: JSON with one-letter keys, because the signal
message caps at 1023 bytes. c for callId, p for progress, t for total, m for a
message truncated at 700 characters. The FRONT END turns that into the JSON-RPC
notification, which is what keeps the client's progressToken out of the worker
gem entirely -- the worker knows an opaque call id and nothing about the client.

If asked why polling rather than an interrupt: InterSessionSignal CAN be made to
raise in the receiving gem (enableSignalling), which would interrupt whatever the
router happened to be doing at the time. Polling costs a wakeup ten times a second
and can interrupt nothing. 100ms is the latency floor for every notification this
server sends.
-->

---

## The client opts in — and for a while this server threw it away

A `progressToken` in `params._meta` on a `tools/call`. **No capability, no `initialize` field, no per-tool annotation** in either revision — so a client *cannot* lose it by failing to notice a declaration.

> **Claude Code has sent a token on every single `tools/call` since it first connected** (measured 2026-08-27). For a while this server read none of it: **it was handed an explicit opt-in on every call and threw it away.**

* That is the exact mirror of the retired idle warning (§8), where the server **sent** what no client would read. **One feature failed by not listening, the other by not being listened to** — and both were settled by measurement rather than by reading the spec harder
* **An open measurement, not a claim.** The Claude Code transport is configured `timeoutMs: 60000`, and *some* clients reset that timer on each progress notification. If this one does, progress is **the fix for long GemStone jobs being cut off client-side**. **Not yet tested; I am saying so**
* In the draft, **closing a request's response stream MUST be treated as cancellation** — a normative, per-request stop signal, better than any deadline this server could invent (§8)

<!--
The blockquote is the slide and it is a confession, so deliver it as one. The
server was being handed an explicit, unambiguous opt-in on every single call and
was discarding it. Nobody had to guess; nobody had to negotiate; the information
was just there.

Then the mirror, because together they are a lesson rather than two anecdotes.
The idle warning (section 8) was the server SENDING something no client would
ever render. Progress was the server IGNORING something every client was already
sending. Same root: the spec was read instead of the wire being watched. Both
were settled in an afternoon once somebody turned on MCP_TRACE and looked.

SAY "NOT MEASURED" OUT LOUD on the timeout payoff. It is the most attractive
claim in this section and it is the one I cannot yet support: some clients reset
their request timer on a progress notification, and if Claude Code does, this
stops being a nicety. The honest version is worth more to this room than the
attractive one, and somebody may well know the answer.

The stream-close-as-cancellation point is a forward reference worth planting,
because section 8 spends a slide on the fact that this server has no request
deadline by default. The draft gives a NORMATIVE per-request stop signal, which
is strictly better than a timeout invented here.

Two things trimmed off this slide for room, both worth saying if the clock is
kind. What a full Grail suite run does to a 60-second client timeout: blows
straight through it. And the era point -- this is THE ONE SCENARIO where the
draft revision and 2025-11-25 agree, so unlike everything else on this subject,
building it was not a bet: notifications/progress is a BASIC utility, carries no
deprecation notice, and is request-scoped in both.
-->

---

## Three pieces of judgement the reporter carries, so tools need not

* **Rate limit — `minIntervalMilliseconds`, 250ms.** The Stone-side queue holds **50** messages per session and raises `SignalBufferFull` **in the sender** on the 51st, shared across every worker signalling one router. A per-test tick from a **5372-test suite** would blow through that in the first second. **The limit is not politeness**, it is what keeps the channel working
* **Strictly increasing** — required by the spec, and refused **twice**: at the reporter, and again at the channel. The reporter runs **arbitrary tool code** and can be wrong; the channel is the end that owes the client a conforming stream
* **Unfailable.** Every send is wrapped, and `SignalBufferFull` is an **expected outcome, not a defect**: a full buffer means the front end has not drained yet, and the right response is to drop the tick. **A progress notification that failed a five-minute test run would make this server strictly worse than one that said nothing**

<span class="fine">A tool reaches all of this through `McpToolset>>progress:of:message:`, which **does nothing at all when there is no reporter** — so a tool called from topaz, or by a client that asked for no progress, behaves exactly as it always did. `nowMilliseconds` is `System millisecondsSinceLogin`, **not** `millisecondClockValue`: that one is a Squeak/Pharo selector GemStone does not implement, and because every send here is wrapped, the `doesNotUnderstand` became **a tick that silently never went**.</span>

<!--
Three rules, one sentence each, and the third is the one with a principle in it.

The rate limit's number is the argument: 50 messages, shared, and SignalBufferFull
raises IN THE SENDER -- which means an over-chatty tool does not degrade its own
reporting, it breaks. 250ms was chosen to sit well inside that while still looking
live to a human.

Refusing non-monotonic ticks twice is worth defending if anyone calls it belt and
braces, because it is not: the two ends are answerable for different things. The
reporter is defending a tool from itself and can be wrong, since it runs code it
did not write. The channel is defending the CLIENT, and owes it a stream that
conforms whatever the tool did.

The fine line's second half is the best small story here and it is a GemStone
story, so this room will enjoy it: an unfailable component swallows its own
bugs. Every send is wrapped, so a doesNotUnderstand on a Pharo selector became a
tick that never went, silently, with nothing in any log. The fix is one selector;
the lesson is that "cannot raise" and "cannot be wrong" are different properties
and the first one hides the second.
-->

---

## Two bugs that only exist end to end

**The last tick.** The worker sends its final tick and returns **in the same breath** — so that tick is still sitting in the Stone's queue when the call's `ensure:` forgets the channel, and the poller, up to 100ms later, finds **nowhere to put it**.

> **Every reported call lost its last step that way** — the one saying the work is *finished*. Hence the explicit `drainWorkerSignals` before the unregister, and a second `drain:` after it.

**Nesting.** `handleJsonString:` nests: a tool that runs a test suite can run tests that themselves send `handleJsonString:`, and this project's own suites do exactly that.

* The first version **cleared the reporter on the way out**, so the first nested call wiped the reporter its **caller** was still reporting through
* Fixing that revealed the other half: the nested call then reported **its** progress on the **outer call's** stream — observed as a client told `1/1 test classes` by a call working through **six**
* So a **depth counter**. At depth 1 the reporter is the front end's and is left alone; deeper, it is taken away for the duration and given back in an `ensure:`. **A nested tool call reports nothing, which is right — nobody asked to be told about it**

<!--
The best slide in the section, and the one to protect. Both bugs are invisible to
a unit test of one call, both were found by watching a real client, and this room
knows what that costs.

The last tick is the more elegant of the two. Nothing is wrong with any component:
the worker is right to send and return together, the ensure: is right to forget
the channel, the poller is right to run on its own schedule. The bug lives in the
gap between three correct things, and it eats exactly the tick that matters most
-- 100% of reported calls lost the one saying "done".

The nesting story is worth telling as two acts, because the first fix is what
revealed the second bug, and that is the part people recognise. Act one: a nested
call cleared its caller's reporter and every later tick vanished. Act two: with
save-and-restore in place, the nested call was now reporting ITS numbers on the
OUTER call's stream -- so a client watching six test classes was told 1/1, and
the outer call's own ticks were then refused for not increasing. Two bugs, one
symptom, and the second only visible once the first was gone.

What the depth counter does NOT catch, since somebody will ask: code that calls a
toolset method DIRECTLY rather than sending a request. No request, no depth to
count, so such a call reports on its caller's stream with its own numbers.
mcp_server's own McpToolTest does this, which is how it was found; a deployment's
tools would have to go out of their way to.
-->

---

## The other stream, in one slide — because §8 rides it

`GET /mcp` opens the **standalone** server→client SSE stream for a session. `McpOutbox` is its per-session FIFO.

* **Bounded at 256**, dropping the **oldest** and recording the gap **in the gem log** — the operator, not the client: an overflow is a server-side fault and there was never anything a client could do about it
* **Keepalive comment every 15s**, comfortably under the usual 30–60s proxy and NAT idle timeouts — the only thing that interval has to beat
* **Both directions are guarded.** Every frame waits on `writeWillNotBlockWithin:` first, because `GsSocket>>write:` suspends with **no timeout at all**; and each 100ms tick polls the read side without blocking, so a client that vanished is noticed in **~100ms**
* **Exactly one drainer.** A newer `GET` **supersedes** the previous stream — `attachStream` hands out a *generation*, and a loop runs only while it is still the current one. Two `GsProcess`es draining onto one socket would interleave SSE frames and corrupt the stream

<span class="fine">`McpProgressChannel` exists **beside** this rather than reusing it, because progress is **request-scoped** in every revision and the draft bars it from the long-lived stream outright. The two present the **same** queueing protocol on purpose, so `drain:to:` writes either onto a socket without knowing which it has.</span>

<!--
A facts slide, run briskly, and the first thing to cut if the hour is going --
section 8 can introduce the outbox in one sentence where it uses it.

The one line worth slowing for is GsSocket>>write: suspending with no timeout.
That is a kernel fact with teeth: a client that stops reading but does not close
will otherwise park a GsProcess forever, and on the front end that is a process
that was serving somebody. Every write in the SSE path is gated on writability
for that reason, with a five-second patience -- a full TCP window for five
seconds on a connection carrying a keepalive means the peer has stopped reading,
not that it is slow.

Generations are the answer to a real client behaviour rather than a hypothetical:
a client that reconnects its GET stream without closing the old one leaves two
sockets both entitled to the same queue. The newest wins, the older ends on its
next tick, and nothing interleaves.

No event ids and no Last-Event-ID replay, deliberately, if asked: ids are only
useful with a replay buffer behind them, and offering them without one invites a
client to ask for a resume this server cannot honour.
-->

---

<!-- _class: demo -->

# DEMO D — watching a long call report

```bash
curl -N -X POST localhost:8000/mcp -H 'MCP-Session-Id: …' \
  -d '{… "method":"tools/call","params":{"name":"run_test_class",
       "arguments":{"className":"McpRouterTest"},"_meta":{"progressToken":"p1"}}}'
```

1. `notifications/progress` frames **arriving while the call runs** — `p`, `t`, and the message
2. The result as the **final frame** on the same stream
3. The same call **without** the token: **one JSON object**, and nothing until it is done

<span class="fine">Pick the test class by **wall clock**, not by size — 20–30 seconds of ticks, not 262. Rehearse the contrast last; it is what makes the point.</span>

<span class="fine">**90 seconds.**</span>

<!--
The most timing-dependent demo in the deck and the second to cut, because slide 4
already tells its story. If it runs, the contrast at the end is the whole point:
same call, one token's difference, and the difference between a client that can
see a job moving and one staring at a closed fist for half a minute.

Choose the suite by WALL CLOCK. A 262-test class that finishes in four seconds
shows nothing; a 30-second class with steady ticks shows everything. Have the
class name written down -- this is the demo most likely to be improvised badly.

-N is not optional on that curl: without it, curl buffers and the frames all
arrive at once, which shows the opposite of what the demo is for.

Fallback: a screenshot of the frame sequence, and say so plainly. The frames are
identical every run, so a screenshot loses only the liveness -- and slide 4's two
bugs are the material anyway.
-->

---

<!--
================================================================================
VERTICAL SLICE 1 -- section 7, the transaction model and the blind-write
guardrail. Twelve slides. Re-cut 2026-09-10 to the running order below, then cut
again on 2026-09-14; it diverged from the outline on purpose:

  * the measured seven-line trace is now speaker notes on the agent diagram, not
    a slide;
  * "why this never needed to exist before" is dissolved into the agent diagram,
    whose closing blockquote it now is;
  * one new slide: the human-in-a-browser diagram, the guard working. It is the
    setup for the agent diagram and the two are read as a pair.

WHAT CAME OFF ON 2026-09-14, and where it went. "One pass" -- the design that
makes every tool succeed by making commit meaningless -- is now speaker notes on
the agent diagram, told as four beats, because it is that picture's consequence
rather than a claim of its own; the four-way refresh measurement went with it, as
did the canary story. "Why the repository does not catch it" is speaker notes on
the human-in-a-browser diagram, which already shows the mechanism working: this
room knows the bitmap intersection, and what was left worth saying is one sentence
about reads having no date, plus the StrongReadSet caveat.

THE TWO PICTURES ARE NOW ADJACENT, and the [session] examples follow them rather
than preceding them -- the examples read as consequences once the room has seen
what goes wrong, and as a wall of prose before it. The accent colours on the two
pictures are deliberately the wrong way round: the REFUSED commit is red and the
SUCCESSFUL one is green, and saying why is the point of the pair.

Budget: 11:10 at the plans in docs/Presentation.md's demo inventory -- 490s of
slides plus a 180s demo, and the two cut slides give about 110s of that back.
The agent diagram, fourth in the slice, carries 90 seconds and is the one to
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

## The model is told about transaction views

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
    only now acting, RE-READ IT FIRST." That exists because the failure two slides from now is
    real.
  * NOTHING COMMITS FOR YOU: says out loud that the mutation tools leave work uncommitted. Six
    weeks ago every one of them committed inside its own call, which is slide 6.
  * THE SECOND ELISION is the [session] line -- four paragraphs of it. Since 2026-09-14 the slide
    showing the line itself comes three slides later, AFTER the two pictures, so promise it rather
    than pointing at it: say that it is there and that it is unintelligible without its paragraph,
    which is most of why these instructions exist at all. The last thing cut with it is worth
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

> `readLedger ⊇ writeLedger` was an invariant enforced by the **user interface**, for free, in
> every Smalltalk browser — so the repository never had to check it.

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

The second is the sentence the design turns on, and it is row four of the four-way measurement in
the agent diagram's notes: if you have already written the object, refreshing does not save you. It is the READ
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
McpExecutionToolset, which is resolved per session like any other — though the boundary that
actually holds is the worker gem's GemStone user, which is section 11.

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
<svg viewBox="0 0 960 330" width="900" role="img" aria-label="The maintenance pass as it runs by default: refresh the front end's own view, then measure each worker's view hygiene, then probe quiet sessions, then reap. Step one comes first so everything after it reasons about the repository as it is now; reaping comes last so a session found gone while probing is freed in the same pass.">
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

The per-session line at the bottom is the whole clock, and it is worth saying slowly.
notePassWithStream: runs first and unconditionally, before any reason to return early -- before the
busy test, before the no-stream test. So the counts advance for every session on every pass this
front end runs, and for no other reason. A busy session still gets counted; it just gets nothing
sent to it.

If asked why a worker gem cannot do its own housekeeping: a forked GsProcess only runs while the gem
is actively executing Smalltalk. A worker sitting between calls is executing nothing, so a timer
inside it does not fire. This is the third design that fact decides, after the detached front end
and the front end owning the client stream.

Four sends, and the diagram is all four -- if somebody reads #maintainSessions along with you, the
count matches. An arm that ended sessions holding write locks was built and taken back out; section
11 says why, and it is that section's argument rather than this one's.
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

---

<!--
================================================================================
VERTICAL SLICE 8 -- section 9, McpAuthRouter: a reachable port. Five slides and
demo G. Cut 2026-09-12: eighth in running order, eighth to be cut.

Running order and plans, in seconds -- three invariants 45, every request carries
the token 45, the login 45, the token is the real bound 55, the offline_access
deviation 60 (250s of slides); demo G 120. About 6 minutes.

THE OUTLINE SAYS 3 SLIDES AND THIS IS FIVE, which is the same arithmetic as
section 6: the budget line was written before the bullet list under it, and that
list contains three things that are each a slide on their own -- the invariants,
the renewal bug, and the deviation the outline itself says deserves "a slide of
its own".

WHAT TO CUT, in order: slide 3 (the login) folds into slide 2 as one sentence if
it has to, and demo G is already the riskiest demo in the deck. Do NOT cut slide
4 or slide 5. Slide 4 is a silent-data-loss bug with a fix that reads as obvious
only afterwards; slide 5 is the one place in the talk where this project
knowingly departs from a normative SHOULD NOT, and saying so out loud in front of
the people who will read the conformance suite is the whole point of having it.

THE SECTION'S THESIS is not "we added OAuth". It is that authorization here is
not a gate in front of the server, it is the thing that decides WHOSE GEM RUNS
THE CODE. Every slide is a consequence of that: the token is checked on every
request because the session id is not a credential; the session is bound to the
token's exp because the gem is logged in as that token's user; and the deviation
exists because without it a real client cannot log in at all.

NO DIAGRAM, deliberately. The shape here is the base router's shape with one hook
filled in (requestAuthorized:on:, section 4's slide 22), and drawing it again
with a padlock on it would say less than the sentence already on slide 2.

THE VERSION DEPENDENCY is one fine line on slide 1 and nothing more, because
section 12 owns versions and spends 12.1 on the obstacle that moved the floor.
The outline calls 3.7.6 "the one thing in this talk that is a straight ask of the
room" -- that framing belongs to section 13, which collects the asks; here it is
a fact about what runs where.

TWO REPOSITORY PROBLEMS FOUND WHILE CUTTING THIS, both now in "What to fix in the
repository before the talk" (items 7 and 8) and both affecting THIS section:
  * docs/MCP_Client_Notes.md says the offline_access SHOULD NOT is "draft-only,
    and so not a gap in either supported revision". McpAuthConformanceTest says
    SEP-2207 is "status Final, so it binds independently of which revision we
    claim". Those are opposite claims about whether slide 5's deviation is a
    deviation at all. THE SLIDE FOLLOWS THE CONFORMANCE SUITE, because that is
    the reading the code actually enforces -- but somebody in that room may have
    MCP_Client_Notes.md open, so resolve it before the talk rather than on stage;
  * ./run-conformance.sh does not exist. It is cited from McpAuthRouter's class
    comment ("scored by ./run-conformance.sh") and from McpAuthConformanceTest.
    No slide mentions it and none should until it is back, but the class comment
    is the first thing a curious attendee will read about conformance.
================================================================================
-->

## A reachable port, and the three invariants that pay for it

`McpAuthRouter` is the class you instantiate to get a port reachable beyond loopback. All three invariants are **enforced in code, not by a launch script** — because `runOnPort:` and `forkOnPort:` can be called directly.

1. **`bindAddress` is configurable here**, where the base class answers loopback and offers no setter — because every request must present a valid bearer token. Still **seeded to loopback**: reachability is something the caller *asks for*
2. **TLS is mandatory** — both start methods **signal** unless a certificate and an unencrypted key are set. A bearer token is a password travelling in a header on **every** request, so cleartext is never appropriate — **not even on loopback**: a router that is safe today becomes unsafe the moment its bind address is widened
3. **The resource-server config is mandatory** — an `expectedAudience` and at least one **https** authorization server, or it refuses to start. Both are **MUSTs**: an unconfigured router would accept a token minted for **any** resource and publish a metadata document naming **nowhere** to get one

<span class="fine">`src/auth` needs `JsonWebToken`, `JwtSecurityData`, `jwtPassword:` — **3.7.5**. An **external** OIDC IdP — **3.7.6**. §12.</span>

<!--
Open the section with its thesis, because none of the five slides makes sense
without it: authorization here is not a gate in front of the server. It is the
thing that decides WHOSE GEM RUNS THE CODE. Everything else follows.

Then the three invariants, and the phrase to land is "enforced in code rather
than by a launch script". A launch script is advice. These signal, from the two
methods that start a server, so there is no way to get a reachable port without
TLS and a resource config -- not by calling runOnPort: in topaz, not by writing
your own script, not by copying the example and deleting a line.

Invariant 2 is the one worth defending, because somebody will say "it is only
loopback". The answer is on the slide: a router that is safe today becomes unsafe
the moment its bind address is widened, and the bind address is a one-line change
in somebody else's script six months from now. The property has to hold for the
class, not for the deployment.

Invariant 3 is the subtle one. An unconfigured router is not merely useless, it
is actively wrong in two directions at once: it accepts tokens minted for any
resource, and it publishes a discovery document that names nowhere to get one.
Neither failure is loud.

The version line: state it and move on, section 12 owns it. The fuller version,
if asked -- on an image older than 3.7.5 those three methods CANNOT COMPILE AT
ALL, which is why install.sh probes the image rather than asking, and leaves the
group out. The 3.7.6 line is unrelated to compilation: earlier releases have a
bug connecting to an external OIDC IdP.
-->

---

## Every request carries the token — the session id is **not** a credential

`requestAuthorized:on:` is the base-class hook from §4, and this is the class that fills it in. Verify the **signature** against the stone's trusted JWT keys, then the resource-server claim checks: **`exp`** (required), and where configured **issuer**, **audience** (RFC 8707) and **required scopes**.

* A request naming an existing session must also present a token belonging to **that session's user**
* **One exception, by design:** the Protected Resource Metadata endpoint is unauthenticated — it is what a client reads *in order to learn how to authenticate*

> **It once was a credential.** `initialize` alone was authenticated and the `MCP-Session-Id` admitted every later request — so an **expired or revoked token kept working** for as long as the session was kept alive, and the **GET stream and DELETE needed no credential at all**.

<span class="fine">The spec is explicit: authorization *"MUST be included in every HTTP request from client to server, even if they are part of the same logical session"*, and the server MUST validate on each protected-resource request. RFC 9728 metadata is served at **both** the root and the path-scoped form, because a conforming client probes the path-scoped one **first**.</span>

<!--
The blockquote is a confession and lands better delivered as one. The session id
was doing a job it was never designed for: it is a routing key, it is 128 bits of
randomness, and it looked exactly like a credential -- which is how this kind of
mistake survives review. The failure mode is the one that matters: revocation did
nothing. Revoke a user's access and their session kept working until the idle
reaper happened to get to it.

And the two endpoints nobody thought about, which is the usual shape of this bug:
the GET stream and DELETE were not "initialize", so they took no credential
whatsoever. Anyone holding a session id could read that session's stream.

The metadata exception is the one thing that MUST stay open, and it is worth one
sentence because it sounds like a hole and is not: it is a discovery document
whose entire purpose is to tell an unauthenticated client where to go and get
authenticated. Refusing it without a token would be a bootstrap that cannot
start.

If asked what changed in practice: every request now pays a signature
verification. It is cheap against the stone's trusted keys, and nobody has
measured it as a problem -- but it is an honest cost to name rather than deny.
-->

---

## The login: the worker gem is **the user's**, not the server's

On `initialize` the router derives the GemStone userId from a configurable claim — **`userIdClaim`, default `sub`**, typically `preferred_username` on Keycloak — then opens the worker:

```smalltalk
McpSession startWithId: newId user: aUserId jwt: aJwtString
  → worker username: … ; jwtPassword: … ; login
```

* **GemStone re-validates the JWT at login** — signature against its trusted keys, plus that user's `JwtSecurityData` — so a bad or expired token **fails the login**, not merely the gate
* Missing · malformed · forged · expired · wrong-audience → **401 `invalid_token`**. Missing a required scope → **403 `insufficient_scope`**
* Both carry `WWW-Authenticate: Bearer` with `error`, `error_description`, `scope` and `resource_metadata` — everything a client needs to fix itself

<span class="fine">**`supportedScopes` is derived, never configured** — the union of `requiredScopes` and `extraScopes` — so a required scope is *always* advertised. The way to get it wrong is made **unrepresentable** rather than checked for.</span>

<!--
The headline is the payoff of the whole section and it is what demo G shows: the
gem is Alice's. Her code runs as her GemStone user, her privileges apply, her
name is in the session list. The server is not impersonating anybody.

Two validations, and it is worth being clear they are not redundant. The router
checks the token because it is the resource server and that is its job. GemStone
checks it again at login because it is not going to take this server's word for
who a user is -- and that second check is against the USER's JwtSecurityData,
which is a fact about the account rather than about the request.

The derived scope set is a small design point that generalises, and it is the
same move as section 2's named tool surface: the wrong state is not
detected, it is made impossible to express. A required scope that no client is
ever told to request is unrepresentable, so requireResourceServerConfig has no
subset rule to check and no caller has one to maintain.

If asked about userIdClaim: sub is the default because it is the one claim OIDC
guarantees, but it is usually a UUID. preferred_username is what a Keycloak
deployment actually wants, and that is why profile is advertised -- it is the
scope that emits it. That thread continues on the next slide.
-->

---

## The token is the real bound — and the cap is on the **grant**

Every session is capped at its access token's own `exp`, **whatever the idle policy says** — the worker gem *is* logged in as that token's user, so a session outliving its token would leave the authorization it was opened with in force after the grant expired. **An expiry is never probed around and never forgiven.**

> **And then the bug.** A client working steadily had its worker gem torn down and **its uncommitted transaction lost** one access-token lifetime after opening — however recently it had called. Activity feeds the *idle* clock, and the idle clock is not what ends an authenticated session. **That is silent data loss**: the client gets a new token, opens a new session, and nothing looks broken.

* The fix is to read the credential in front of you: a request bearing a **refreshed** token for the same user extends the session to the **new** token's `exp` (`renewSessionExpiry:from:`). Refreshing sooner would not have helped — **the renewed token was never consulted about lifetime**
* **Two boundaries kept**, which is why it is a separate selector and not a relaxed ratchet: a **nil `exp` moves nothing**, and a session with **no** deadline is left alone — renewal extends a deadline, it never introduces one

<!--
Spend the time here. The first paragraph is policy and the rest is a bug worth
telling properly.

Say the failure as the user experienced it, not as the code did: you are working,
you are calling every few seconds, and one hour after you started -- an access
token lifetime -- your gem is gone and your uncommitted work with it. Nothing
errored. Your client got a fresh token, opened a fresh session, and carried on.
You would find out when you went looking for the changes you had made.

Then the diagnosis, which is the interesting half: activity was feeding the idle
clock, and the idle clock was never what was going to end this session. The
absolute deadline was, and nothing was moving it. The client had been presenting
a renewed grant on every single request and the server was not reading its exp.

What bounds what an authenticated session may DO is not a scope -- it is the
GemStone user the bearer token names, whose UserProfile an administrator
restricts. Section 11. A scope decides whether a client gets in at all.

One of only two wall-clock grounds in the whole reaper -- section 8 -- which is
worth saying if that section has already run.

A nil exp moves nothing because a token whose expiry cannot be read must not be
able to turn a bounded session unbounded; and a session with no deadline is left
alone because renewal extends a deadline rather than introducing one.

The renewable-past-deadline case, if anyone spots it: a session past its deadline
but not yet reaped IS renewable, on purpose. The reaper runs on an interval, so
that window is scheduling, not policy, and a client presenting a valid token
inside it is exactly the client that should keep its gem.
-->

---

## The `offline_access` deviation — said out loud, on purpose

**The rule.** MCP **SEP-2207** (status *Final*, so the conformance suite treats it as binding whichever revision we claim): **SHOULD NOT** advertise `offline_access` in `WWW-Authenticate` or `scopes_supported`.

**What forces it is a pair of conditions, neither of them ours:** a client that **appends `offline_access` to its authorization request on its own**, plus an authorization server that **rejects a request naming a scope that client was never assigned**. Keycloak and Authelia reject **before any login page**.

* **Keycloak compounds it.** An RFC 7591 dynamic registration carrying a `scope` field **replaces** the realm's defaults — so the resource *advertising* the scope is the only way such a client ever holds it. Omitting it **breaks the browser login outright**, not merely shortens sessions
* **Two exits tried, neither available.** Pinning the scopes **client-side** failed (2026-08-20) — the client kept appending it. Nothing **server-side** substitutes: policies only *validate*, mappers only *emit claims*; neither can **assign** a scope. **CIMD** remains, untested

> **How it is kept honest.** The conformance suite asserts the rule against a **`conformantRouter` fixture** — so a router is spec-clean *unless an operator opts out* — and the test deployment opts out via `MCP_EXTRA_SCOPES`, **knowingly**.

<!--
This is the slide this section exists to be able to give. A deliberate departure
from a normative SHOULD NOT, stated in front of the people most likely to check,
with the reasoning rather than an apology.

Authorization servers that gate scopes per client behave this way; others
silently narrow the grant and need none of this, which is why the deviation looks
unnecessary until you meet one that does not.

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

ONE THING TO SETTLE BEFORE THE TALK: docs/MCP_Client_Notes.md says this SHOULD NOT
is draft-only and therefore not a gap in either supported revision, which is the
opposite of what the conformance suite says. The slide follows the suite. Item 7
of "What to fix in the repository before the talk".
-->

---

<!-- _class: demo -->

# DEMO G — Alice runs code as Alice

```bash
./run-auth-server.sh          # TLS, an IdP, and a reachable port
```

1. **The browser login** through the IdP
2. `execute_code` — and `status` showing **Alice's own GemStone userId**
3. `System cacheStatisticsForAllSlotsShort` — the `McpServer:…` row **is hers**

<span class="fine">**The point to land: the worker gem is her session, not the server's.** Needs the 3.7.6 stone. If the browser flow looks risky on the day, `verify-oidc-login.sh` plus a curl with a **pre-fetched token** is the safe version — have one ready either way.</span>

<span class="fine">**Not built, and an invitation:** mapping **scopes to privileges**, and **loading toolsets by scope**. The router already resolves the tool surface **per session, on the side that can see the token** (§2, §4) — the mechanism is in place and unused. What is missing is the policy. §13.</span>

<span class="fine">**2 minutes.**</span>

<!--
The riskiest demo in the deck: a browser, an IdP, a different stone, and a
redirect that has to come back. Decide by the morning which version is running
and rehearse THAT one -- switching to the fallback live is how this becomes four
minutes.

Have a pre-fetched token in scrollback regardless. Even in the good case it turns
a failed redirect into a five-second recovery.

What to point at, in order: her userId in the status output, then her row in the
cache statistics. Those two together are the whole section -- the authorization
did not just let her in, it decided which GemStone user is executing her code.

The invitation at the end is deliberate and section 13 picks it up. Say it as an
open question rather than a roadmap: the surface is already resolved per session
on the side that holds the token, so the mechanism exists; what nobody has
decided is the policy, and whether GemStone's own privileges should carry any of
it. That is a question for this room specifically, and it is worth leaving in the
air rather than answering.
-->

---

<!--
================================================================================
VERTICAL SLICE 9 -- section 10, extending it: a server for YOUR software. Five
slides, no demo. Cut 2026-09-12: ninth in running order, ninth to be cut.

Running order and plans, in seconds -- write a toolset 45, pick a surface 45,
the worked example 40, the collision 55, the upstream ask 40. About 3 3/4
minutes.

THE OUTLINE SAYS 2 SLIDES. It is the third section where that number predates
the bullet list under it, and this one is the most lopsided: the list runs to
nine bullets and two of them are measurements with a story attached. Five.

THIS IS THE SECTION THE ROOM CAN ACT ON SECOND-MOST, after section 5's defect
table. Everything before it has been "here is what this server does"; this is
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

SLIDE 4 IS THE ONE THAT LANDS, and it is not really about Grail. It is the
general shape: your domain has a model, this server has a session model, and
where they disagree the disagreement is yours to resolve -- with a number
attached that nobody can argue with (132 defects against 386/386 clean). Every
vendor in that room who writes a toolset will meet some version of it.

WHAT TO CUT: slide 5 (40s), which is a lovely result and an upstream ask but is
Grail-specific and section 13 can carry the asks alone. Then slide 3, whose
argument survives as one sentence on slide 2. Do NOT cut slide 4.

NO DEMO, matching the outline and the demo inventory. Demo C already showed a
tool surface being chosen; a sixth demo to show a different one would be the
same screen with different words in it.

DEPARTURES from docs/Presentation.md:
  * the outline's Grail bullet names grailDirectory as the options example.
    There are TWO declared options -- grailDirectory and testGemConfig -- and
    slide 3 says two, because "a toolset declares its options" is the point and
    one option makes it look like a special case;
  * McpGrailToolset's OTHER collision with the model is speaker notes on slide 4,
    not a bullet: Grail models Python exceptions outside the Smalltalk Error
    hierarchy, so McpDispatcher's `on: Error do:` cannot see them and an uncaught
    one would take the whole worker gem down rather than answer the client. It is
    excellent material and there is no room for it; it is the first thing to say
    if a hand goes up on slide 4.
================================================================================
-->

## To add tools, write a **toolset**

Subclass `McpToolset` and implement two things:

* **`registerOn:`** — one `name:description:inputSchema:do:` per tool, with schemas from the inherited builders (`objectSchema:required:`, `propString:`, `boolProperty:`)
* **`toolNames`** — what this toolset offers

> **`tools/list` is unfiltered: every tool a session's toolsets registered is offered, and none is refused for being “unsafe”.** What a session may *do* is decided by the GemStone user its worker gem logs in as (§11).

Handlers are instance methods taking the parsed arguments and answering a `String`; `resolveClass:`, `dictNamed:`, `linesFrom:` and `capResult:` cover the usual lookups and output capping.

**A handler that mutates passes through `self assertMutableClass: cls` first** — which forwards to the **server**, because what counts as protected is **one policy per deployment** rather than each toolset's to invent, and a subclass can tighten it for every toolset at once. **A toolset built with no server refuses to mutate at all.**

<!--
Open the section by saying what kind of section it is: everything so far has been
"here is what this server does". This is "here is the seam". Two extension
points, and the first is the one you almost always want.

Nobody hand-writes JSON Schema -- the builders are there so a tool's schema is
Smalltalk, and so that the closed-by-default additionalProperties rule of section
5's slide 33 is applied for you rather than remembered.

There is no per-tool safety classification to write, and the blockquote says why
in the positive: a toolset declares what it offers, and the boundary is somewhere
else entirely. Section 11 is where "somewhere else" gets its slide, so do not
open it here beyond the pointer.

assertMutableClass: forwarding to the SERVER is the bit that is easy to get
wrong and it generalises: policy belongs to the deployment, not to the component.
Two toolsets must not disagree about what a protected class is, and a vendor
should not have to know. The fail-closed-with-no-server case is not theoretical
-- it is exactly what a toolset built standalone in a test gets.

If asked how a handler reports failure: raise. The dispatcher classifies Errors
into the isError envelope with a kind (section 5's slide 33). A handler does not
build error envelopes itself.
-->

---

## How a deployment picks a surface — three shapes, all live today

* **`MCP_TOOLSETS="AcmeDbToolset"`** → a server with **only your tools** and none of the Smalltalk-development surface. **An empty list is legal**, and means a server offering no tools at all
* **`serverName:` / `serverVersion:` say which *software* this is** — the product's to set. **`serverTitle:` labels *this instance*** — the operator's — and is **omitted entirely rather than sent as null**, so a title being present means a human deliberately labelled that box
* **`MCP_WORKER_CLASS=AcmeDbServer`** → subclass `McpServer` to change **behaviour**: the kernel guards (`isProtectedClass:`, `protectedDictionaryNames`), the identity hooks, the server instructions. **Usually toolsets are the right answer** — nothing auto-detects a subclass, and the router names it per session (§4)

> **Brain Freeze Insurance is the example to say out loud:** a database whose useful tool surface is **its own domain operations**, not developer coding tools. Same transport, same session model, same guardrail — and **none of `McpBrowsingToolset`**.

<!--
Three shapes and they are genuinely different decisions, which is why they are
three bullets rather than a paragraph. What tools; what this thing calls itself;
and how it behaves.

The empty-list case is worth half a sentence because it sounds like a mistake and
is not: a router that offers no tools is a legal, running MCP server. It answers
initialize, it answers tools/list with nothing, and it is what you get while you
are building your first toolset.

The name/title split is a small thing that operators feel immediately. Two
instances of one product need to be told apart by a human, and that is the
operator's word, not the vendor's. Omitting rather than nulling is the same rule
section 4 met on serverInfo: an absent key means "none given", and null means the
word null rendered somewhere.

Brain Freeze Insurance is the one to name because it makes the whole section
concrete in one breath. Nobody there wants list_classes. They want their domain
operations, over the same transport, with the same guardrail underneath. That is
the shape of every deployment this section is for.
-->

---

## `McpGrailToolset` is the worked example — and it is not a privileged one

**Nine tools** — eval, transpile, source, class and method browsing, module state, tests, and two search tools — in **its own source group**, and it **needs nothing from the server**.

> **That is what makes it a genuine third-party example rather than an insider.** Since 2026-09-11 it is turned on exactly as yours would be: **named in `MCP_TOOLSETS`**, and nothing joins a surface by being loaded (§2).

* It is also the example of **toolset options**. `McpGrailToolset class>>declaredOptionNames` declares **two** — `grailDirectory` and `testGemConfig` — and they travel as **JSON in the fork string**, then again as one `printString`-quoted JSON string in the worker bootstrap, parsed there (§4)
* **JSON rather than a Smalltalk literal**, because the options are a nested map **whose shape the core does not know**. Encoding them as JSON keeps that shape out of the core entirely, and gives them the same one-quoted-literal safety every other bootstrap argument has
* Options are **narrowed to the toolsets actually in the surface**, so a worker is never handed configuration for a toolset it does not have — and a router holding options for a toolset it does not serve **refuses to start**

<!--
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
-->

---

## When a domain toolset collides with the session model

**`run_python_tests` forks a fresh gem. That is the design, not a precaution.**

> **Measured 2026-09-01:** the same three test classes gave **132 defects** run in a long-lived worker session, and **386 run / 386 passed / 0 failed / 0 errors** run fresh. **Every one of those defects was an artifact of the session.**

* A real disagreement between two models. Grail's rule: **a module is a compiled artifact in the database, bound — never rebuilt — by every import afterwards.** Its SUnit isolates tests by **evicting framework modules from `sys.modules`** — and where those modules are *committed*, re-importing **raises**. **A long-lived MCP worker is exactly the session that accumulates that state**
* Forking settles three more things at once: the caller's transaction is **untouched**, where an in-session run dirties it *silently* — **a cold Grail import is a database write**, measured at **31 modified objects for a 7-test class**; and the child's writes are **never committed**, so a run leaves the repository exactly as it found it
* **The cost is honest and stated in the tool.** Every run is fully cold — `FlaskScaffoldingTestCase` alone is **262 seconds**. Hence the `classNames` argument, and why this is the flagship consumer of progress (§6): **an unbounded wait with no word is worse than a slow one that says so**

<!--
The slide that lands, and it is not really about Grail. The general shape is:
your domain has a model, this server has a session model, and where they disagree
the disagreement is yours to resolve. Every vendor in that room who writes a
toolset will meet some version of it.

Lead with the number. 132 against 386/386 is not a tuning difference, it is the
session inventing every single defect -- and it is the kind of result that would
have been reported as a Grail bug by anybody who did not know where to look.

Then the mechanism, slowly, because it is a genuine standoff rather than a bug in
either party. Grail is right that a committed module is canonical. Its SUnit is
right to isolate by eviction. Put them in a session with history and they
contradict each other, and the MCP worker is the session with the most history
anybody has.

THE OTHER COLLISION, which is the first thing to say if a hand goes up, and which
there was no room for on the slide: Grail models Python exceptions OUTSIDE the
Smalltalk Error hierarchy -- NameError inheritsFrom: Error is FALSE -- so
McpDispatcher's on: Error do: cannot see one. Uncaught, a python-tool error would
escape the dispatcher and take the whole worker gem down instead of answering the
client. The toolset catches them itself and converts them to an McpError kinded
#pythonError. That is the same lesson in a different register: a domain's error
model is part of the collision surface too.

If asked about the forked gem's memory: it is driven ONE CLASS PER SEND and
forked with Grail's own budget, because a netldi's default 50MB is not enough for
a single Grail test class -- and the run bounds memory as well as raising it,
stopping near the ceiling, because a Grail run that ends full does not crash, it
reports AlmostOutOfMemory against an innocent test.
-->

---

## A GemStone result, and three asks already filed

**The stock sender search answers *nothing* for Python, confidently.** It scans **environment 0**; Grail compiles into **environment 1**.

> Measured on 3.7.5 with `_grail_session` imported: `ClassOrganizer new sendersOf: #'_dict'` answers **an empty pair of arrays** where **12** senders exist. Not under-reporting — **reporting nothing, with no indication that it could not look.**

* `find_python_senders` searches **all three shapes** a Python reference compiles into: resolvable calls in compiled methods, first-class references and unresolved attribute calls, and the `.py` text on disk
* **Every answer ends with a `searched:` and a `not searched:` block** — because *“no senders”* is only worth reading if it can be told from *“I could not look there”*
* Three interfaces that would let it stop reading Grail's internals are **filed upstream**: **Grail #883, #884, #885**

<!--
Thirty seconds, and it is here for this audience specifically: it is a GemStone
result, it is measured, and the asks are already filed rather than being made
from a stage.

The phrasing to get right is "confidently". A search that says it could not look
is useful. A search that answers an empty array is indistinguishable from a
search that looked everywhere and found nothing, and a model reading that answer
will conclude the name is unused and delete something.

The searched:/not searched: block is the design response and it generalises past
Python: any tool whose coverage is partial owes the caller its own boundaries.
That is worth ten seconds on its own, because every vendor writing a search tool
over their own domain has the same obligation.

The three issue numbers are on the slide so that nobody has to write them down
from speech. Section 13 collects the asks; this one is already lodged, which is
the point -- it is not a request made from a stage, it is a request made in the
tracker with a talk mentioning it.
-->

---

<!--
================================================================================
VERTICAL SLICE 11 -- section 11, the worker gem's GemStone user. Three slides,
no demo. Cut 2026-09-13, and it closes the running-order gap: this file is now in
running order for every cut section, 0-12. Section 13 is the only one left.

Running order and plans, in seconds -- the boundary 55, what it costs 50, the
lock and the ask 55. About 2 1/2 minutes.

THE OUTLINE SAYS 1 SLIDE, and that entry describes a feature this server does not
have. Rewrite it. What section 11 is now is a real boundary with a real open
question attached, and the question is one of the two things this talk is
actually asking the room for -- the other being section 5's defect table.

THE SECTION'S THESIS: the only boundary that holds is the GemStone user the
worker gem logs in as, because it is enforced in the stone, by the VM, on every
operation, and cannot be talked around from inside the session. Everything else a
server could do -- narrowing the tool surface, refusing a tool by name -- states
an intention. Say the positive version and do not spend time on what it replaces:
this audience is meeting the project for the first time and has no stake in an
earlier design.

SLIDE 3 IS THE ASK, and it is the slide this section exists for. System writeLock:
is gated by no privilege, so a browsing-only session has it, and a lock blocks
OTHER sessions from committing -- including a privileged developer committing
code, measured. What bounds it today is session lifetime and an operator
noticing. A reaper that ended lock holders WAS built here and taken back out,
because it can only act once per heartbeat and the holder picks when the window
falls -- chasing a lock holder is not the same as not being able to take the
lock. A privilege that withheld writeLock: would bound it at zero. That is a
GemStone question, not an mcp_server one, and it goes to the room.

WHAT TO CUT: slide 2 (50s), whose privilege detail is in docs/ReadOnly_User.md and
whose symbol-list consequence is an operational footnote. Do NOT cut slide 3.

NO DEMO. The convincing demonstration here is a negative -- a commit that raises
2249 -- and demo E already puts a failing commit on screen for a better reason.
The lock result is a two-session setup that reads as a non-event on a projector.
Both are measured in docs/ReadOnly_User.md if anyone asks for evidence.

THE SLIDES DO NOT MENTION WHAT THIS REPLACED, deliberately and by instruction.
The notes reference it once, on slide 1, only because "why is the tool surface not
the boundary" is a question a toolset author may ask after section 10 -- and the
answer is about execute_code, not about history. Slide 3's reverted lock reaper
is NOT an exception to that rule and should not be tidied away as one: it is a
different history, it is on the slide on purpose, and it is what earns the ask.
================================================================================
-->

## The boundary is the GemStone user the worker logs in as

```bash
MCP_WORKER_USER=McpReadOnly ./run-server.sh
```

`McpRouter>>workerUserId` names it — **one user per router, not per session**: every worker gem this router opens logs in as that user. `startWithId:workerUser:` does the login. **Default `nil` — the front end's own user.** Enforced **in the stone, by the VM, on every operation**.

* **No credential is configured.** The front end mints a **one-time password per session**, needing **one committed grant** — `addOnetimePasswordUserId:` on the front-end user. So `configDict` carries **only an identifier** (§3)
* **`McpAuthRouter` refuses `workerUserId:`** — a fourth class invariant (§9): there each worker is **the user its bearer token names**, and **silently ignoring a configured one would be the dangerous reading**
* **The commit lock.** `UserProfile>>disableCommits` → `sessionCanCommit` is false **from login**; `commit` raises **`TransactionError` 2249**. Reads and compiling still work — the session accumulates pending work it cannot keep, so the **`[session]` line points it at `abort`**
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

If a toolset author asks after section 10 why narrowing the tool surface is not
the boundary, the answer is about execute_code and not about history:
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

## What it costs, and what it does not close

**One privilege is granted on purpose:** `CodeModification`. Without it `execute_code` raises **2151** on so much as a helper class, and `run_test_class` cannot run a suite that compiles anything. **Nothing compiled can be committed**, so it dies with the gem.

* Four **inverse** privileges are withheld, and they are cached in the VM **at login** — they must be on the profile *before* the worker gem logs in: `NoPerformOnServer`, `NoUserAction`, `NoGsFileOnServer`, `NoGsFileOnClient`
* **Which one closes the second-gem route** — can a commit-locked session log in a *second* gem that is not locked? Measured, one privilege at a time: **the commit lock alone does not close it.** `GsTsExternalSession>>login` is an **FFI callout**, and **`NoUserAction` or `NoGsFileOnServer` each refuse it** with 2151. The default set has both
* **A different user resolves names differently.** A symbol list is name *resolution*, not authorization — but `Mcp` is not in a new profile's default list, and a worker that cannot see it **fails its first session**. `setup-read-only-user.sh` copies the front-end user's list, **a point-in-time snapshot**

<span class="fine">**What stays open:** reads (object security policies are the answer to *that*, not this), resources (§8's lifetimes), and **locks**.</span>

<!--
Run this one briskly; the full table is in docs/ReadOnly_User.md and this slide
is the shape of it. Three facts and a hand-off.

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

The symbol list is the operational trap. It is not a security property at all --
adding a dictionary changes nothing about what may be written -- but get it wrong
and the very first session fails with Toolset not found, which reads like a
broken install. And re-provision a dictionary later and the snapshot is stale.

Then hand off: reads, resources, locks. Reads are broad -- anything world-readable
comes back through a tool result, including other UserProfiles, and the answer to
that is object security policies rather than anything here. Resources -- a loop, a
full scan, temp object space, a pinned view -- are bounded by section 8's
lifetimes, not by privileges. The third is the next slide and the reason this
section is three slides.
-->

---

## `System writeLock:` is gated by **no** privilege — and that is my question

A browsing-only session has it. A lock **stops other sessions committing** the locked object — and **not only application data**.

> **Measured.** The restricted gem locked *only* `McpServer`'s method dictionary; a `DataCurator` compile-and-commit then failed — **conflict `#'Write-WriteLock'` n=1.** One `execute_code` walking `Globals` took **2,291 locks in a single statement**.

* **The reassuring half:** `McpRouter` and `McpServer` are **transient** — never committed, so locking one excludes nobody
* **All that bounds it today is session lifetime.** Locks die with the gem — measured, all 2,291 went when §8's reaper took the holder. On demand, `stopSession:`: a person noticing
* **A reaper is the wrong layer, and I built one to find that out.** It acts only **once per maintenance pass**: the lock is held for up to an interval, **the holder picks when that window falls**, and a session taking fresh locks is **chased, not stopped.** Reverted

> **So: should there be a privilege that withholds `writeLock:`?** At the source the bound is **zero**, not one heartbeat — and that is the layer to fix it at, not a maintenance cycle.

<!--
THE SLIDE THIS SECTION EXISTS FOR. Everything before it earns the right to ask.

Build it in three beats. One: a lock needs no privilege, so the most confined
session you can provision still has it. Two: a lock does not change anything --
it stops OTHER people changing things, and that is measured rather than reasoned.
SAY THE LINE THAT IS NOT ON THE SLIDE, because it is the one that lands: locking
a class's method dictionary stops a PRIVILEGED DEVELOPER committing code to that
class. Three: everything available today is either a gem eventually going away or
a person noticing.

Then ask, and STOP TALKING. This is the second of the talk's two asks and it is a
GemStone question rather than an mcp_server one: writeLock: is ungated, the
confined user has it by construction, and no arrangement of UserProfile
privileges takes it away.

LEAD WITH THE REVERT RATHER THAN BEING CAUGHT BY IT -- it is the strongest part of
the argument, which is why bullet 3 says "I built one to find that out". Commit
b0a5180 added an MCP_REAP_LOCK_HOLDERS setting: an idle holder reaped, a busy one
answered mid-call so the client was told. It worked, measured, and it was taken
back out. The reason is a design argument and not a bug: policing a lock once per
heartbeat works around a gap in the privilege model instead of closing it, the
holder chooses when the unguarded interval falls, and a session that keeps taking
fresh locks is chased forever. docs/ReadOnly_User.md records the whole thing,
revert included, because the exposure is real and should be arguable from.

The session-lifetime bound is worth saying plainly so the room does not hear
"unbounded": locks are released when the holding gem logs out, and section 8's
reaper logs idle workers out on a schedule. That is exactly why the idle and
lifetime settings are worth configuring deliberately on a deployment that hands
execute_code to anyone less than trusted.

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
VERTICAL SLICE 10 -- section 12, versions: the floor moved, and why. Five slides,
no demo. Cut 2026-09-12: tenth to be cut.

Running order and plans, in seconds -- the floor moved 40, the obstacle (1) 55,
the obstacle (2) 50, #51438 50, what it deleted 35. About 4 minutes.

THE OUTLINE SAYS 3 SLIDES and structures them as 12.1 / 12.2 / 12.3. This is five,
and the split that matters is 12.1 into TWO: it carries two independent measured
differences, each with its own table, plus the argument that 3.7.2 is not the
safer image for having the first one. One slide would be two tables and a
paragraph, which is a slide nobody reads.

WHY THIS SECTION IS NOT A FOOTNOTE, and the sentence to open with: the whole of
section 8 rests on one stone primitive, and the floor moved because that
primitive is weaker below the image on 3.7.2 in two ways NOTHING IN src/ CAN
DETECT. That is what makes it a design conclusion rather than a support matrix.

SLIDE 3 CARRIES THE ARGUMENT. The consequence is one sentence and it is the
reason to drop rather than work around: on 3.7.2 the server cannot see a session
that its own maintenance refresh has doomed, so the worst state the session layer
knows how to explain is exactly the one it goes silent for. Land that and the
section is done.

WHAT TO CUT: slide 5 (35s), then slide 4 (#51438, 50s) -- which hurts, because it
is the best kernel story in the talk and this is the audience for it, but it no
longer bounds support and section 13 does not depend on it. Do NOT cut slides 2
and 3.

12.3 IS REWRITTEN, because the outline describes code that no longer exists. It
says two expansions are "still written the 3.7.2 way" in forkOnPort: and the
worker login. They were removed on 2026-09-11 (e3ce652): both now send
newDefaultForGemHost: and useOnetimePassword directly. So the slide
is no longer "what the code still carries" -- it is the better slide, "what the
floor moving actually deleted", four days ago, in the tree. THE OUTLINE'S 12.3
SHOULD BE BROUGHT INTO LINE; it is the one place in it that now describes the
wrong code.

One expansion survives and the slide says why, because a reader will find it and
assume it was missed: McpGrailToolset>>newGrailTestSession keeps newDefault +
gemNRS:, because it sets an NRS BODY ('gemnetobject -C ...') to pin the test
gem's memory budget and newDefaultForGemHost: gives no way to pass one. That was
never the 3.7.2 reason, and the commit removed only the clause that claimed it
was.
================================================================================
-->

## The floor moved — four days ago, and for one primitive

| image | base server | OAuth/OIDC | |
|---|---|---|---|
| 3.6.2 | **no** | no | no usable `GsTsExternalSession` on macOS — **no worker gems at all** |
| 3.7.2 | **no** | no | **dropped 2026-09-10** — `continueTransaction`, and it carries #51438 |
| 3.7.5 | yes | yes, local IdP | |
| 3.7.6+ | yes | yes, **external IdP** | |
| 4.0.0 | untested | untested | |

**3.7.2 was dropped, not deferred**, and the reason is `System continueTransaction` — **which is why this is the closing section rather than a footnote: the whole of §8 rests on that one primitive.**

* **Whether the floor settles at 3.7.5 or 3.7.6 is not yet decided.** Somebody will ask
* Anything present in **3.7.5** may now be referenced directly, with no existence guard; the live concern is only what is *newer*
* **GemStone has no notion of an optional method.** Absence shows up only as a `doesNotUnderstand` at runtime — so there is **no list to check against**, and the live suite on the loaded extent is the only test

<!--
Open with the sentence that makes this a section rather than an appendix: the
whole of section 8 rests on one stone primitive, and the floor moved because that
primitive is weaker below the image on 3.7.2 -- in two ways nothing in src/ can
detect. That is a design conclusion, not a support matrix.

Say "not yet decided" about 3.7.5 versus 3.7.6 plainly and early, because
somebody is going to ask and an honest "not decided" is a better answer than a
number invented on stage. What decides it is whether the external-IdP line
matters to a deployment; sections 9 and 13.

The no-optional-methods point is the one this room will nod at, and it is worth
naming as a consequence rather than a complaint: there is nothing to feature-test
against, so the support matrix cannot be derived, only measured. That is why
McpExternalSessionTest exists at all -- slide 4.

3.6.2 is one line and gets one clause. Nobody is running it and the reason it
fails is uninteresting compared with what follows.
-->

---

## `continueTransaction`: identical source, different primitive

`(System class compiledMethodAt: #continueTransaction) sourceString` is **byte-identical on 3.7.2, 3.7.5 and 3.7.6.** The whole difference lives in the `_zeroArgPrim: 9` stone primitive — **below the image, where no `respondsTo:` or any other feature test can reach.**

**(1) A successful refresh does not rebase the conflict baseline.** S1 reads X · S2 commits a change to X · S1 sends `continueTransaction` · S1 writes X · S1 commits:

| | 3.7.2 | 3.7.5 / 3.7.6 |
|---|---|---|
| `continueTransaction` answers | `true` | `true` |
| S1's view of X afterwards | S2's value | S2's value |
| S1's following commit | **`false`**, `#'Write-Write'` naming X | **`true`** |

The view moves on both. But on 3.7.2 the write-write intersection is still taken **against the commit record the transaction *started* at**, so a write S1 has already adopted **still counts as concurrent**.

<span class="fine">Measured with **two real gems** — topaz plus a `GsTsExternalSession` — reducing to a **one-slot `Array`**. **Substituting `abortTransaction` makes 3.7.2 behave exactly like 3.7.5**, which isolates it to the primitive.</span>

<!--
"Identical source, different primitive" is the whole slide and it is the fact
that makes the decision unavoidable. There is nothing to test for: the selector
exists on every version, it answers a plausible Boolean, and it differs only in
what it leaves behind.

Read the table row by row. The first two rows agreeing is what makes the third
surprising -- the refresh worked, the view moved, the session is looking at S2's
value, and the commit is still refused as concurrent with a change it has already
adopted.

The fine line is the methodology and it matters for this audience: two real gems,
a one-slot Array, and the abortTransaction substitution as the control. That last
one is what rules out everything except the primitive.

Do NOT let this become a discussion of whether 3.7.2's behaviour is defensible.
The next slide is the one that decides it, and this is only half the evidence.
-->

---

## And 3.7.2 is **not** the safer image for having it

That table looks like read protection. **It is not.**

* Writing an object the other session did **not** touch commits **just as cleanly** on 3.7.2 — so **the laundering §7 exists to prevent still happens there**, which is the shape the guardrail was written for
* 3.7.2 refuses only the **same-object** case, and refuses it **spuriously**: the session had legitimately adopted the newer version before writing

**(2) A failed refresh does not record its failure** — 3.7.2 never writes `#commitResult` **at all**:

| `#commitResult` after… | 3.7.2 | 3.7.5 / 3.7.6 |
|---|---|---|
| a **successful** `continueTransaction` | `#success` | `#readOnly` |
| a **failed** one (S1 wrote X, S2 committed over it) | **`#success`** | **`#failure`** |

> The `false` answer still arrives, so the tool layer sees the refusal **in the moment**; what 3.7.2 loses is the **durable trace**. `commitConflictPending` then answers **false for a session that is genuinely stuck**, and everything gated on it **goes quiet**. *The worst state the session layer knows how to explain is exactly the one it goes silent for.*

<!--
This is the slide the section exists for. Two moves, and the second is the
decision.

First, dismantle the reading everyone takes from the previous table. 3.7.2
refusing that commit looks like it is protecting you. It is not: the laundering
still happens in every case where the write lands somewhere other than the read.
It refuses only when the write lands on the SAME object as the read, and the guardrail of section
7 was written for exactly the case where it does NOT -- read a method, write a
different one, and 3.7.2 launders it as happily as anything else. So the
guardrail keeps its full scope there, and gains a spurious refusal on top.

What goes quiet, concretely: no [session] line, no named collision, no "abort is
the only way out". Section 7's whole reporting channel, silent.

Then the consequence, and say the last sentence slowly because it is the whole
argument: on 3.7.2 the server cannot see a session that its OWN maintenance
refresh has doomed. No [session] line, no named collision, nothing. The one state
this project spent a section learning how to explain is the one it cannot detect.

Contrast with #51438 explicitly if there is time, because it is what makes the
decision principled rather than a shrug: the buffer corruption could at least be
DETECTED from inside the image, and was covered on a branch of its own for
months. Here there is nothing to test for.

Two housekeeping facts to have ready. 3.7.2 additionally fails
testTheStoneAloneWouldAllowThatClobber -- the test written to fail on good news,
here reporting something that is NOT good news -- and
testRefreshAdoptsTheOtherVersionAsTheStartingPoint, plus three more from the
second difference. And main372 is archived as the annotated tag archive/main372
rather than kept as a branch: the tag holds every commit and the reason the line
existed, without implying it is still maintained. NO .gs FILE CHANGED for any of
this -- it is a documentation and support decision, and an older image may well
still load.
-->

---

## #51438: right length, wrong content

No longer a support boundary — **and still the best kernel story in the talk.** A **Smalltalk** bug, so it hits **gem-to-gem** sessions and not C clients: `resolveResult:` fetches the first 1024 bytes into a **shared, per-session buffer that never shrinks**, then **nests the refetch of the full object inside the “is the buffer big enough?” test** — conflating *big enough* with *already full*:

| result size | what you get |
|---|---|
| ≤ 1024 | always correct |
| 1024 < n ≤ grown buffer | **exactly 1024 correct bytes**, the rest **stale** from an earlier result |
| > grown buffer | correct again — and it **re-grows the buffer, raising the ceiling** |

* **The length is freshly fetched, so it is always right** — so JSON fails as *“Unterminated string”*, never as a short read. **Sticky for the session's life**; fixed in **3.7.4.1**

<span class="fine">**mcp_server would meet this on its main path** — every MCP response is a String of JSON pulled out of a worker gem, and `McpExternalSessionTest` pins it: **three controls that pass on every version, two that fail on an affected one.** **And the lesson: a green `test.sh` on an older commit was not evidence of absence** — it passed because a smaller class happened to put the method being checked inside the good first kilobyte.</span>

<!--
Keep this one even though it no longer bounds support, because it is the best
kernel story in the talk and this is the only room that will enjoy it properly.
Fifty seconds.

The shape to land: the bug is not "sometimes you get less data". It is "you
always get the right LENGTH and sometimes the wrong BYTES". That is the worst
possible failure mode, because every length check downstream passes and the
damage surfaces as a parse error in the middle of a document, which reads like a
bug in whatever built the document.

A fresh login clears the poisoned buffer; a small result in between does not.
Sticky for the session's life is the part that makes it vicious. One large result
poisons that session's buffer, logout does not clear it, and a small result in
between does not either. So a worker gem that has once returned a big tools/list
is compromised for every medium-sized response afterwards.

The same shared-buffer aliasing breaks resolveResult:toLevel: for Arrays
(#51563), so returning an Array of small chunks is NOT a workaround -- repeated
calls each returning at most 1024 bytes is. Worth having ready, because it is the
first workaround anybody proposes.

The closing lesson is the one worth carrying out of the section: test.sh was
green on an older commit, and that was not evidence of absence. It passed because
a smaller class happened to put the method being checked inside the good first
kilobyte. A test that passes for a reason you did not choose is not a test.

If asked why the suite is written to FAIL rather than to skip: because the suite
is how the image reports itself. A skip says nothing; two red against three green
says #51438, precisely, and any other split says the netldi or the harness.
-->

---

## What the floor moving actually deleted

**2026-09-11, in the tree.** Every `GsTsExternalSession` here was built through hand-expanded equivalents of two kernel selectors 3.7.2 lacks. **They are gone** — `forkOnPort:` and `McpSession>>newWorkerSession` now send `newDefaultForGemHost:` and `useOnetimePassword` directly.

> **The expansions bought nothing and cost a reader two comments explaining an image nobody runs.** Moving a floor is not an abstraction: it is permission to delete.

* **One `newDefault` + `gemNRS:` survives, and not for compatibility.** `McpGrailToolset>>newGrailTestSession` sets an **NRS body** — `gemnetobject -C …` — to pin the forked test gem's memory budget (§10), and `newDefaultForGemHost:` gives no way to pass one. The commit removed only the clause that had *claimed* 3.7.2 as the reason
* `jwtPassword:` **never had an expansion at all** — which was the second reason auth could not run before 3.7.5 (§9)

<span class="fine">`docs/GemStone_Notes.md` keeps the 3.7.2 selector table — the expansions are still the substitution to make if anyone *has* to run there — but no longer tells you to use them unconditionally.</span>

<!--
Thirty-five seconds, and the first thing to cut. It is here because a decision
that changes no code is easy to disbelieve, and this one changed code four days
after it was taken.

The blockquote is the line to say: moving a floor is permission to delete.
Everything else in this section has been about why the floor moved; this is what
it bought.

The surviving newDefault + gemNRS: is on the slide for one reason -- a reader
will find it in the file-outs and assume it was missed. It was not: an NRS body
is the only way to pass a gem configuration parameter, gemnetobject -C is how the
test gem gets Grail's memory budget, and newDefaultForGemHost: has nowhere to put
one. That was always the real reason; the 3.7.2 clause beside it was the thing
that was wrong, and it went.

If anyone asks whether an older image can still load the tree: probably, and
nothing stops them trying. No .gs file changed for the support decision itself --
this deletion came after, and separately. It is a documentation and support
decision, not a compilation barrier, right up until src/auth, which genuinely
cannot compile before 3.7.5.
-->
