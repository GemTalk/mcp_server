#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate the "which gem holds which instance" build sequence in deck.md.

Seventeen slides that step through one diagram, highlighting a different box or
arrow on each -- plus one interleaf, the tool inventory, which carries no diagram
at all (see AFTER, below). Every copy of the SVG is byte-identical except that ONE group
carries an extra `hl` class; the front matter's stylesheet is what paints that
group in the accent. So the geometry lives in exactly one place -- SVG, below --
and a change to it is one edit here, never seventeen.

    python3 docs/slides/gen.py            # print the block to stdout
    python3 docs/slides/gen.py --apply    # rewrite the block inside deck.md
    python3 docs/slides/gen.py --check    # exit 1 if deck.md is out of date

DO NOT HAND-EDIT THE GENERATED SLIDES. They sit between the two marker comments
below and --apply replaces everything between them, so an edit made in deck.md
is lost the next time anyone regenerates. Edit SLIDES or SVG here instead.

Adding a slide: append a tuple to SLIDES -- (highlight, title, prose, notes).
The highlight is a class from the SVG (`c-session`, `a-request`, ...) or None
for no highlight. Order in SLIDES is running order.

ONE SLIDE IN THE RUN IS NOT A DIAGRAM. The tool inventory interrupts the sequence
after the McpTool slide -- it followed McpToolset until 2026-09-13 -- so that the
room has been told what a toolset is AND what one tool is before it is shown the
forty of them. The list then reads as the thing the last two boxes make. It is not
a SLIDES entry -- it carries no diagram -- so it lives in AFTER, a map from a
highlight class to raw slide text emitted immediately after that slide. Keying on
the class rather than an index means reordering SLIDES carries it along. It still
has to be generated rather than hand-written into deck.md, because --apply
replaces everything between the markers and the interleaf is inside them.

THE INVENTORY SLIDE NEEDS FOUR MORE FRONT-MATTER RULES, or it renders as one
long single-column list that runs off the bottom:

    .tools { display: flex; gap: 26px; margin-top: 10px; font-size: 17px; line-height: 1.5; }
    .tools > div { flex: 1 1 0; }
    .tools p { margin: 0; font-family: ui-monospace, monospace; }
    .tools .tset { font-family: inherit; font-weight: 600; color: #b4451f; font-size: 15px; }

plus `.tools p + .tset { }` spacing and the `.tools .grail` dashed rule that sets
the Grail column apart. The dashed border is the whole point of laying
this out in flex rather than `column-count`: a CSS column break lands where the
text happens to run out, and the Grail group has to be a column of its own.

Keep the tool names in REGISTRATION order -- the order each toolset's registerOn:
sends `name:`, which is the order tools/list answers in. It is alphabetical in the
seven core toolsets by accident and thematic in McpGrailToolset on purpose; either
way the slide is checkable against the source, which is why it is worth keeping.

THE FRONT MATTER MUST CARRY THESE FIVE RULES or nothing highlights and the prose
renders at body size:

    svg .hl rect { fill: #f6e1d6; stroke: #b4451f; stroke-width: 2.6; }
    svg .hl text { fill: #b4451f; }
    svg .hl path { stroke: #b4451f; stroke-width: 3; }
    svg .hl { color: #b4451f; }
    .boxnote { font-size: 21px; line-height: 1.5; max-width: 1010px; margin: 16px auto 0; text-align: left; }

The last `svg .hl` rule is the non-obvious one, and it now earns its place for
the loop glyph alone, which names `currentColor` in an inline style. Arrowheads
used to need it and no longer do. A marker's contents inherit from where the
MARKER sits in the document -- inside `<defs>` -- not from the element that
references it, so a head filled with `currentColor` came out black on a red
shaft no matter how the arrow was styled. The marker fills with `context-stroke`
instead: it resolves to whatever paint stroked the line, so every head follows
its own shaft, highlighted or not, and no rule has to reach into the marker.
Chromium has supported it since 97 and Marp renders in Chromium.

The loop glyph in the McpRouter box -- the circular arrow marking the accept
loop -- states its fill and stroke in an inline `style=` rather than as SVG
presentation attributes, deliberately: an inline style outranks a stylesheet
rule, so `svg .hl path` cannot fatten the arc to stroke-width 3 or put a stroke
round the arrowhead when that box is the highlighted one. Both still name
`currentColor`, so the `svg .hl { color }` rule recolours them with the box.
Convert them to plain attributes and the glyph deforms on exactly one slide.

WHAT AN ARROW MEANS: a hand-off, drawn in the direction the work travels --
never ownership, and never a bare method return. The one return arrow in the
picture is McpRouter back up to McpHttpConnection, because that is where bytes
reach the socket, and the router is what writes every one of them: a plain JSON
body, a progress frame off a channel, an outbox frame off the GET stream. Both
`drain:to:` senders are McpRouter methods.

Two arrows here are easy to get wrong, so they are called out. McpSession owns
its `outbox` and nothing else below it, so it feeds McpOutbox ALONE; the
McpProgressChannel is the ROUTER's -- `callChannels`, keyed by call id, one per
in-flight streamed call -- and a tick reaches it from the signal poller, not
down the request path. Drawing one arrow into the gap between those two boxes
says McpSession owns both, which is what the picture used to say and the c-channel
prose has always contradicted.

LEAVE 20 UNITS BETWEEN STACKED BOXES. `markerUnits` defaults to `strokeWidth`,
so the head of a connector drawn at stroke-width 1.5 is 7 x 1.5 = 10.5 units
long -- and a 14-unit gap, which is what this diagram had, is very nearly all
arrowhead. 20 leaves an 18-unit line, three fifths of it shaft. That is the
constraint the row positions are solved against, and it is why the boxes are
36 units tall rather than 38: the two gems have to fit the same 316-unit frame
they always did, because the slide beneath the diagram has no vertical room to
give (the c-router slide's prose already runs to the bottom margin).

NEVER PUT A BLANK LINE INSIDE THE <svg> STRING. deck.md's own header comment
explains why; the failure is silent and only shows up in the render.
"""

import os
import sys

BEGIN = "<!-- MCP-GEM-SEQUENCE:BEGIN -- generated by docs/slides/gen.py; do not hand-edit -->"
END = "<!-- MCP-GEM-SEQUENCE:END -->"
DECK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deck.md")

SVG = '''<svg viewBox="0 0 1140 352" width="1130" role="img" aria-label="{ARIA}">
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
</svg>'''

ARIA = ("Two gems. The front-end gem holds McpHttpConnection, the McpRouter -- whose box carries a "
        "circular-arrow glyph marking the accept loop, the gem's blocking main activity -- McpSession, "
        "McpOutbox, McpProgressChannel and two background GsProcesses -- the reaper and the "
        "signal poller. The worker gem holds SessionTemps, and beneath it McpServer, "
        "McpDispatcher, McpToolRegistry, the toolsets and the tools. An arrow is a hand-off, in "
        "the direction the work travels: a request runs down from McpHttpConnection through the "
        "router to McpSession and across to SessionTemps, the router writes every response back up "
        "on the connection, McpSession feeds its McpOutbox, and a progress tick comes back from the "
        "worker to the signal poller, which routes it by call id to that call's McpProgressChannel. A "
        "tick starts at a toolset, which reaches the McpProgressReporter held in SessionTemps under "
        "#McpProgress.")

SLIDES = [
 (None, "Two gems, and what is in each",
  "Every box is **one object**. The front-end gem owns the socket and knows who the sessions are; "
  "the worker gem runs the tools. Nothing is shared between them. **One string crosses the gap in "
  "each direction**.",
  "The establishing shot. Do not explain anything yet -- name the two gems, say that the boxes are\n"
  "objects rather than classes-in-general, and move. Everything on this slide gets its own slide.\n"
  "\n"
  "WHAT \"NOTHING IS SHARED\" MEANS CAME OFF THE BOX 2026-09-15. It read \"Nothing is\n"
  "shared between them -- not a variable, not a view, not a transaction.\" The three\n"
  "are worth saying even though the box no longer lists them, because each one is a\n"
  "section: not a view is section 7, not a transaction is section 8, and not a\n"
  "variable is why the fork string exists at all (slide 23). Unqualified, \"nothing\n"
  "is shared\" sounds like ordinary good manners between objects; the list is what\n"
  "makes it a claim about GEMS."),

 ("c-client", "MCP client &#8212; one per editor",
  "Claude Code, a VS Code extension, `curl`. It speaks **HTTP/1.1 and JSON-RPC 2.0**: it POSTs each "
  "request, and may hold open a `text/event-stream` GET to listen to the server.",
  "Worth saying out loud that the client is not ours and we do not get to change it -- the protocol\n"
  "era split is section 3's material.\n"
  "\n"
  "This slide said \"one client is one session, and one session is one GemStone login -- which is the\n"
  "whole reason there is a cap\" until 2026-09-13. The login half is now the third bullet of \"What is\n"
  "different\", two slides earlier, so saying it here is repetition; the cap is left to section 8's\n"
  "maxSessions slide, which is where it is actually configured. Still the point to land IF it is\n"
  "asked: a reconnect loop in a client opens a NEW session each time, and the login that exhausts a\n"
  "stone fails for topaz too."),

 ("c-http", "McpHttpConnection &#8212; one per request",
  "Reads **one** HTTP/1.1 request and writes **one** JSON response, `MCP-Session-Id` header included. "
  "It also writes the SSE stream, every frame gated on the socket being writable, plus a "
  "non-blocking read-side disconnect check &#8212; which is how a **closed editor tab** is noticed.",
  "Off the slide since 2026-09-13, and worth a sentence if the question comes: the gem is released\n"
  "about ten seconds later. The ten seconds is a grace for a client that might reattach to the\n"
  "same session. A reopened\n"
  "editor tab does not; it re-initializes. Do not spend time here -- the reaper slide is where\n"
  "session lifetime actually gets argued."),

 ("c-router", "McpRouter &#8212; the accept loop, and the gem&#8217;s blocking main activity",
  "The socket, the routes, the `MCP-Session-Id`&#8594;`McpSession` map behind a mutex, the pending-request "
  "table. The gem **loops** in `runOnPort:` until `stop`, "
  "and that loop is the gem&#8217;s only activity &#8212; a forked GsProcess runs only while the gem is executing "
  "Smalltalk, so the reaper and the poller live off it. The front end runs "
  "**transactionless**. `McpAuthRouter` adds the bearer token, TLS and RFC 9728 metadata, and logs "
  "each worker in as **the token&#8217;s own GemStone user**.",
  "Two things this slide used to print and now only says: the front end NEVER RUNS A TOOL, and\n"
  "transactionless is what stops it pinning the stone's oldest commit record. Section 3's slide\n"
  "arguing the cost came down on 2026-09-13, so both halves of it belong here now, a breath each.\n"
  "THE PRICE: front-end code must not read persistent object graphs. No walking a committed\n"
  "collection, no caching a persistent object across statements. Stone primitives and lookups by\n"
  "name are fine, and the class comment says so in capitals.\n"
  "THE PAYOFF is the same property from the other side, and it is the half worth saying out loud\n"
  "because somebody here has lost an afternoon to it: a COMMITTED recompile of front-end code takes\n"
  "effect in a RUNNING server, within two maintenance passes. That is the answer to \'my transport\n"
  "fix did not take\' -- wait one pass, then check the gem's start time. A gem that cannot hold a\n"
  "view across statements is a gem that re-reads its code from the repository constantly.\n"
  "The measurement that made the mode non-negotiable is section 8's, and one number carries it: a\n"
  "front end left IN transaction sat on the stone's oldest commit record for fifteen hours. Leave\n"
  "the rest of that argument to section 8's maintenance-pass slide.\n"
  "If someone asks why the router decides the worker's class and toolsets rather than the worker --\n"
  "because only this side can see the token.\n"
  "THE KERNEL FACT IN THE PROSE IS THE ONE THIS ROOM KNOWS, and section 3's slide for it came down\n"
  "on 2026-09-13, so this is where it gets said. A forked GsProcess runs only while its gem is\n"
  "ACTIVELY EXECUTING Smalltalk; a GCI-driven session is parked in the C client between commands, so\n"
  "an accept loop forked THERE is frozen and never serves a request. Therefore the accept loop has\n"
  "to be a dedicated gem's blocking main activity. It is worth slowing down for: they know the fact\n"
  "is true, what they have not necessarily done is follow it to three separate conclusions. The\n"
  "other two: the front end must own the client's STREAM, and the front end must own VIEW HYGIENE,\n"
  "because only the front end has a heartbeat. View hygiene is section 8 and is paid in full. The\n"
  "stream is section 6, which is archived as of 2026-09-14, so that promise is now redeemed only by\n"
  "demo C and by four boxes of the gem-contents sequence -- promise it smaller, or not at all.\n"
  "Have the third argument ready anyway, because somebody always jumps ahead. On every OTHER count\n"
  "the worker is the better-informed party: it can read its own commits-behind, the stone's backlog,\n"
  "whether it holds the oldest commit record, and needsCommit, none of which the front end can see.\n"
  "The action still belongs to the front end because the problem case is precisely the IDLE worker\n"
  "holding a stale view -- the one moment that worker cannot run a line of code."),

 ("c-session", "McpSession &#8212; one per client, and the only thing that drives a worker",
  "The `GsTsExternalSession` handle, the session id, last activity, the worker class and toolset list "
  "the front end resolved, plus this session&#8217;s outbox and liveness state. `prepareWorker` sets the gem "
  "up in **one** call at session open; `forward:` runs a request in it. A **mutex** around the handle "
  "makes GCI&#8217;s one-call-at-a-time rule explicit rather than accidental.",
  "Two guarantees used to hold by accident when forwarding was a blocking executeString:, and are\n"
  "now explicit -- one call in flight per session, and no interleaving. The slide that showed the\n"
  "nbExecute: doing it is archived; this line is where the fact enters the talk now.\n"
  "The worker class and toolsets are resolved PER SESSION, so a Grail install that lands after\n"
  "startup reaches the next client without a restart."),

 ("a-request", "The hop &#8212; one string, non-blocking",
  "`worker nbExecute: 'McpServer handleJsonString: ', body printString`. **Non-blocking**, so one "
  "client&#8217;s long request will not stall anyone else. Every embedded string is "
  "`printString`-quoted, so a request body cannot smuggle anything into the worker&#8217;s compiler. The "
  "answer comes back as that same call&#8217;s **`lastResult`**, read once the call is finished &#8212; so "
  "nothing may send GCI to this worker in between.",
  "The body does not arrive as the bytes the socket read: the worker COMPILES that literal, so its\n"
  "class comes from the worker session's StringConfiguration. That is why parseBody: has a leading\n"
  "asString. Section 7 if anyone pulls on it.\n"
  "printString-quoting is load-bearing for the server TITLE in particular, which unlike a name or a\n"
  "version is free-form operator prose, so quotes in it must be doubled rather than closing the\n"
  "literal.\n"
  "WHY lastResult is on the slide. It is read AFTER the call, so anything that sends GCI to this\n"
  "worker in between overwrites it and the client silently gets the wrong answer. The live trap is\n"
  "printing the worker: GsTsExternalSession>>printOn: sends stoneSessionId and gemProcessId, each a\n"
  "memoizing REMOTE accessor, so logging a worker nothing had queried would answer a client with the\n"
  "gem's pid where its JSON-RPC response belongs. McpSession>>cacheWorkerIds fetches both at login,\n"
  "once, while nothing is in flight; memoized, every later print is inert. Log those cached ids,\n"
  "never the worker itself.\n"
  "IF ASKED whether that arrow is only client requests: no, and the label still holds -- all of it\n"
  "is nbExecute:. Three kinds of traffic take it. The bootstrap at session open (prepareWorker, one\n"
  "round trip, before any request can arrive). Every client request (runWorker:). And the reaper's\n"
  "view refresh, runMaintenanceExpression: 'McpServer refreshViewForFrontEnd', which differs in two\n"
  "ways worth saying: it takes the worker mutex with tryLock and gives up at once rather than\n"
  "parking the reaper behind somebody's five-minute test run, and it does NOT touch the session --\n"
  "a maintenance send that counted as activity would make a dead client's session immortal.\n"
  "NOT on that arrow: cacheWorkerIds and logout, which are GCI calls on the handle, not expressions."),

 ("c-temps", "SessionTemps &#8212; where the instance actually lives",
  "The worker gem&#8217;s own scratch dictionary: **per gem, per login, never committed**. The front end "
  "names a **class**, and `McpServer class>>currentServer` is the single place that turns that into "
  "the instance. That single place matters: **two** entries reach a worker &#8212; a client request and the "
  "front end&#8217;s own maintenance call.",
  "This is the slide the whole diagram was built around. A second McpServer instance would be a\n"
  "second set of ledgers, licensing writes on the strength of reads it never saw. Say that sentence\n"
  "slowly.\n"
  "#McpFrontEndSession is pushed down once at session open -- it is where to ring the doorbell when\n"
  "a tool reports progress, and it is constant for the worker's life.\n"
  "If asked what it points AT: a session NUMBER, not an object. System session as the ROUTER's gem\n"
  "answers it, embedded in the bootstrap string the worker compiles. It could not be a reference --\n"
  "two processes, two object memories, and the only thing they share is the repository, which an\n"
  "McpSession never reaches because nothing about a socket survives a commit. It is also NOT the\n"
  "worker's cached stoneSessionId: different number, different namespace. sendSignal:to: and a\n"
  "polled signal's sendingSession both speak the System session one."),

 ("c-server", "McpServer &#8212; the per-client worker, built before the first request",
  "Registry, dispatcher, toolsets, identity, the kernel guards and the blind-write read/write "
  "ledgers. **No socket.** It is built at session open by `prepareWorkerWithToolsets:…`, not on the "
  "client&#8217;s first request &#8212; so an unresolvable worker class or toolset fails **there**, where the "
  "error can say what to fix, instead of inside a `tools/call`.",
  "Order inside prepareWorker is the point: nameThisGem: FIRST, before anything that can fail,\n"
  "because a bootstrap that dies on a bad toolset is exactly when an operator is reading the\n"
  "session list. Then the front-end session, then registration, then the instance into SessionTemps."),

 ("c-dispatcher", "McpDispatcher &#8212; JSON-RPC 2.0, and two kinds of failure",
  "Routes `initialize`, `tools/list`, `tools/call` and `ping`; appends the post-call `[session]` line; "
  "turns an `McpError`&#8217;s machine-readable `kind` into a structured error envelope, and splits a "
  "failure two ways per MCP 2025-11-25: a **protocol** error for a malformed or unknown call, a "
  "**tool execution** error for arguments that violate the tool&#8217;s own schema &#8212; the second kind "
  "carries feedback a model can act on, so the spec wants it in the result.",
  "Deliberately says nothing about the view: NO TOOL REFRESHES IT, and why that is a guardrail rather\n"
  "than an omission belongs to the later transaction section.\n"
  "If someone asks whether the worker aborts before a call -- it did until 2026-08-28, first with\n"
  "abortTransaction and then briefly with continueTransaction. Stopping was the FIX: refreshing under\n"
  "the client tells the stone it has seen changes it has not, and a commit that should have been\n"
  "refused as stale is accepted instead.\n"
  "The [session] line is appended AFTER the call, so it describes what the call left behind."),

 ("c-registry", "McpToolRegistry &#8212; name to tool",
  "A name&#8594;`McpTool` map, and the thing that produces the `tools/list` descriptors a client reads "
  "once at startup and then trusts. It is populated **at session open**, from whichever toolsets the "
  "front end named for this session &#8212; so two clients on the same stone can legitimately see two "
  "different tool surfaces.",
  "Short slide. The only thing worth pausing on is that tools/list is answered from here rather than\n"
  "assembled per call, so the surface a client sees is fixed for the life of its session."),

 ("c-toolset", "Mcp*Toolset &#8212; the unit you add tools in",
  "A tool pack: `registerOn:` contributes its tools and their schemas to the tool registry, and it "
  "owns its `tool_*` handlers and the shared schema builders.",
  "SAY THE REST, and the inventory two slides on shows it: seven core toolsets, one per tool\n"
  "family, plus the\n"
  "optional McpGrailToolset on a Grail image -- and SUBCLASS THIS TO ADD TOOLS, which is the whole\n"
  "point of the box. A deployment picks any subset of them, or none of them alongside its own.\n"
  "McpGrailToolset needs nothing from the server, which is why it doubles as the worked example for\n"
  "a third-party toolset. If someone is going to write one, this is the slide to point at."),

 ("c-tool", "McpTool &#8212; one tool, and its schema",
  "Name, description, JSON Schema, handler block. It **validates arguments against its own schema "
  "before the handler runs**.",
  "About 31 of these in a default worker, more with Grail -- and the next slide is the list, so\n"
  "this is the moment to say what one of them IS rather than what there are.\n"
  "What validating first COSTS, off the slide since 2026-09-13 and still the thing to say if a\n"
  "contributor asks: a closed schema turns one stale argument into a cascade of failures rather\n"
  "than one, which is why, when ./test.sh fails in a heap, you fix the FIRST check and re-run. A\n"
  "contributor warning dressed as a design note; it is in CLAUDE.md for the same reason."),

 ("a-progress", "Progress &#8212; a worker cannot write to its own client",
  "The socket belongs to the front end, and exactly one process may write to it. So a tick goes to "
  "the **Stone&#8217;s** inter-session queue instead: **50 messages deep per session**, and "
  "`SignalBufferFull` is raised **in the sender** on the 51st. Every send is wrapped, and a dropped "
  "tick is an **expected outcome, not a defect**.",
  "A per-test tick from a 5372-test suite would blow through 50 in the first second, which is why\n"
  "the reporter rate-limits. The limit is not politeness.\n"
  "A progress notification that failed a five-minute test run would make the server strictly worse\n"
  "than one that said nothing.\n"
  "If asked which tools actually tick: two. list_failing_tests, per test CLASS rather than per\n"
  "test, and -- on a Grail image -- run_python_tests, which ticks elapsed seconds while a forked\n"
  "gem runs. Everything else answers too fast to be worth reporting. The arrow leaves the TOOLSET\n"
  "because progress:of:message: is an McpToolset method and a handler block's self is its toolset;\n"
  "McpTool holds only a name, a description, a schema and that block."),

 ("c-poller", "signal poller GsProcess &#8212; the collector of progress ticks",
  "`InterSessionSignal poll`, in a loop until empty, every **100 ms**, in the front-end gem. It parses "
  "each payload and routes it **by call id** to that call&#8217;s channel. It has to live here: a forked "
  "`GsProcess` runs only while its gem is actively executing Smalltalk, and an idle worker is not.",
  "Same fact as section 2's deployment slide, reaching a third conclusion. The front end is the only\n"
  "party that can act while nothing is happening -- which is also the reaper's whole justification."),

 ("c-channel", "McpProgressChannel &#8212; one per streamed call",
  "Registered in the router&#8217;s `callId`&#8594; channel map for the life of one streamed `tools/call`, and "
  "drained to the socket after every wait for the worker. Ticks must be **strictly increasing**, and "
  "that is refused **twice** &#8212; once at the reporter, again here &#8212; because the reporter runs arbitrary "
  "tool code and this end owes the client a conforming stream.",
  "The bug worth telling: the worker sends its final tick and returns in the same breath, so that\n"
  "tick was still in the Stone's queue when the call's ensure: forgot the channel. Every reported\n"
  "call lost its last step -- the one saying the work is finished. Hence an explicit drain before\n"
  "the unregister. A bug that only exists end to end.\n"
  "\n"
  "SERVER-INITIATED MESSAGES, if they are said here: this is where the status slide's caveat went\n"
  "when that slide was deleted on 2026-09-13. They are built, and this server needs them -- every\n"
  "idleness count in section 8 rests on a server-initiated ping -- but the 2026-07-28 draft removes\n"
  "the direction outright: \"servers do not initiate JSON-RPC requests and clients do not send\n"
  "JSON-RPC responses\". Machinery, not a feature with a future to sell.\n"
  "\n"
  "Be precise about what that wording deletes, because this slide is on the right side of it:\n"
  "server-initiated REQUESTS go, which is ping and the pending-request table underneath section 8.\n"
  "Notifications travelling server to client -- progress ticks, this channel -- are not requests and\n"
  "read as untouched. Do not assert that harder than the quote supports; it is section 13's to\n"
  "settle. Why build it at all: it is what the clients in the room speak today. Claude Code sends a\n"
  "session id, opens the GET stream, answers pings, and hands over a progressToken on every call."),

 ("c-outbox", "McpOutbox &#8212; one session&#8217;s queue of server-initiated messages",
  "Everything the server wants to say that is not an answer to a request, waiting for this "
  "session&#8217;s SSE stream. **Front-end only, and never committed.** It owns the bound and overflow "
  "policy, the closing handshake, and the **latest-GET-wins** rule &#8212; because a client may reattach a "
  "stream, and only one of them can be the live one.",
  "Never committed is not a detail: this is queued work for a socket, and a socket does not survive\n"
  "a commit record. If the front end dies the queue should die with it.\n"
  "\n"
  "The protocol caveat on this whole direction -- built, needed here, and forbidden by the\n"
  "2026-07-28 draft -- is one slide back, on McpProgressChannel, so that it is said once."),

 ("c-reaper", "reaper GsProcess &#8212; one pass every 60 seconds",
  "Refresh the front end&#8217;s own view **first**, so everything after it reasons about the repository as "
  "it is now; then measure each worker&#8217;s view hygiene, probe the quiet sessions, and reap **last**, so "
  "a session found gone while probing is freed in the same pass. Idle 30 minutes by default &#8212; or "
  "sooner, if it fails a liveness probe on the stream it opened.",
  "The ordering is the argument, not the timeout. Section 8 spends this properly.\n"
  "On every count except one the worker is better informed -- it can read its own commits-behind,\n"
  "the stone's backlog, needsCommit. The action still belongs here because the problem case is the\n"
  "IDLE worker holding a stale view, the one moment that worker cannot run a line of code."),
]

INTERLEAF_TOOLS = """
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
"""

AFTER = {"c-tool": INTERLEAF_TOOLS}


def check_comments(text):
    """Fail loudly on a presenter note that never closes.

    An unterminated `<!--` swallows everything up to the NEXT `-->`, which is
    the following slide's own note -- so that slide vanishes from the render
    with no warning anywhere: no error, no blank page, just one fewer slide
    than the file has. It cost a hunt to find. The tool-inventory interleaf
    opened a note it never closed, and ate the McpTool slide whole.
    """
    pos, open_at = 0, -1
    while True:
        a, b = text.find("<!--", pos), text.find("-->", pos)
        if a < 0 and b < 0:
            break
        if a >= 0 and (b < 0 or a < b):
            if open_at >= 0:
                sys.exit("gen.py: the note %s is missing its -->; the next note opens inside it"
                         % where(text, open_at))
            open_at, pos = a, a + 4
        else:
            if open_at < 0:
                sys.exit("gen.py: a stray --> %s closes a note nothing opened" % where(text, b))
            open_at, pos = -1, b + 3
    if open_at >= 0:
        sys.exit("gen.py: the note %s is never closed -- it would swallow the slide after it"
                 % where(text, open_at))


def where(text, pos):
    head = text.rfind("\n## ", 0, pos)
    return "after '%s'" % text[head + 4:text.find("\n", head + 4)] if head >= 0 else "at char %d" % pos


def block():
    out = []
    for hl, title, prose, notes in SLIDES:
        svg = SVG.replace("{ARIA}", ARIA)
        if hl:
            svg = svg.replace('%s"' % hl, '%s hl"' % hl)
        out.append(("" if not out else "\n---\n")
                   + '\n## %s\n\n<div style="text-align:center">\n%s\n</div>\n\n'
                     '<div class="boxnote">\n\n%s\n\n</div>\n\n<!--\n%s\n-->\n'
                   % (title, svg, prose, notes))
        if hl in AFTER:
            out.append("\n---\n" + AFTER[hl])
    text = BEGIN + "\n" + "".join(out) + "\n" + END + "\n"
    check_comments(text)
    return text


def splice(deck, new):
    lines = deck.split("\n")
    try:
        a = next(i for i, l in enumerate(lines) if l.startswith("<!-- MCP-GEM-SEQUENCE:BEGIN"))
        b = next(i for i, l in enumerate(lines) if l.startswith("<!-- MCP-GEM-SEQUENCE:END"))
    except StopIteration:
        sys.exit("deck.md carries no MCP-GEM-SEQUENCE markers -- insert the block by hand once.")
    return "\n".join(lines[:a]) + "\n" + new + "\n".join(lines[b + 1:])


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg in ("--apply", "--check"):
        deck = open(DECK, encoding="utf-8").read()
        want = splice(deck, block())
        if arg == "--check":
            sys.exit(0 if deck == want else "deck.md is out of date; run gen.py --apply")
        open(DECK, "w", encoding="utf-8").write(want)
        print("deck.md updated: %d diagram slides + %d interleaf" % (len(SLIDES), len(AFTER)))
    else:
        sys.stdout.write(block())
