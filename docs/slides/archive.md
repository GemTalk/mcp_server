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
================================================================================
ARCHIVE. THIRTY-FIVE SLIDES SET ASIDE FROM deck.md ON 2026-09-14, FOR TIME.
This file is not a talk. It is a holding pen, kept renderable so the slides can
be looked at, and kept in deck.md's own running order so any of them can be put
back where it came from.

WHY: the talk's target came down to 45 minutes. Three whole stretches came out --
section 4 (trace 1, a brand-new client's first request), the trace half of
section 5 (a follow-up request), and section 6 (progress notifications). Together
they are about 14 minutes of slides, which is most of what the new target needed.
Nothing here was cut for being wrong.

FOUR MORE CAME LATER THE SAME DAY, from section 8, in two passes, and they are a
different kind of cut -- the section was thinned slide by slide rather than set
aside whole. It went from ten slides to four. They are at the END of this file,
under two headers of their own, and their notes are SPLIT: the deck kept the
paragraphs its surviving slides depend on. Read those headers before putting any
of them back. The most worth putting back is maxSessions, and its header says
why.

THEN SECTION 12 WENT WHOLE, later still the same day: all five slides of
"versions: the floor moved, and why", about four minutes. That is a set-aside
again rather than a thinning -- the section is one argument across five slides
and half of it does not stand. It is LAST in this file, after the section 8
pairs, with slice 10's header whole. Its notes were not split but CONDENSED: one
VERSIONS block at the end of deck.md page 22's notes carries the whole argument
in shorter form, because page 22's table is where the room first sees "3.7.5".
Read that header before putting any of these back.

AND THREE FROM SECTION 9, last of all and a THIRD kind of cut: not a set-aside
and not a thinning, but a FOLD. The section's mechanism slide was rewritten from
"a reachable port, and the three invariants that pay for it" into a four-sentence
summary of the whole mechanism, and these three -- every request carries the
token; the login; the token is the real bound -- were redundant behind it. They
are at the very end of this file under a header of their own. Their notes are
transplanted WHOLE onto that one deck slide, under three banners, rather than
split across several or condensed: read that header before putting any of them
back, because putting one back means cutting its banner out of the deck slide's
notes or the same thing gets said twice.

AND ONE FROM SECTION 11, last of all, folded the same way and on the same day.
"System writeLock: is gated by no privilege -- and that is my question" was the
slide its whole section existed for, and it came out because its subject arrived
on the face of the slide before it, as a blockquote of two sentences. Its notes
are transplanted whole onto that slide under one banner, so the measurement, the
reverted lock reaper and the question itself all survive as things to say. IT IS
THE ONE SLIDE IN THIS FILE WHOSE REMOVAL TOOK AN ASK OFF THE SCREEN, though only
for a few hours: later the same day page 49 gained a heading of its own asking
whether write locks should be privilege-gated, so what the fold finally cost is
the argument under the question rather than the question. Its header is at the
very end, and it says the rest.

AND ONE FROM SECTION 10, later still, which is not a fold and not a thinning for
time: "To add tools, write a toolset" came out because the slide beside it was
rewritten to name a real toolset on its face. It is the only slide in this file
that was the SOLE face-level account of a mechanism -- after it, no slide in the
deck shows how a toolset is written. Its face as well as its notes are
transplanted onto deck.md page 51.

AND TWO MORE FROM SECTION 10, the last cut of the day and a plain set-aside for
time: the collision slide and the upstream-ask slide, which between them held
EVERY MEASUREMENT THAT SECTION HAD. Section 10 is now a lead and two slides, and
what it has left is the shape without the evidence -- it says what extending this
server looks like and no longer shows anybody having done it. Their notes, and
their faces in prose, are on deck.md page 51 under two banners anchored to the
two words that survive there: "tests" and "two search tools". (That was page 52
until the two slides left in the section were merged into one, later the same
day.) These three section
10 slides are last in this file, under two headers.

WHAT STAYED BEHIND IN THE DECK, deliberately:
  * DEMO C -- a session is a gem. Section 4's demo, kept without section 4. It is
    the load-bearing demo of the talk and it needs no walk in front of it: the
    gem appearing in the cache statistics IS the argument that section 4 spent
    eight slides making.
  * DEMO D -- watching a long call report. Section 6's demo, kept without section
    6, on the same reasoning: the contrast at the end of it (same call, one
    token's difference) is the whole of what the five slides argued.
  * The three JSON codec slides, which were section 5's second half. They moved
    to the END of deck.md instead -- after section 12, then after section 11 once
    section 12 followed them here, and now after section 10, behind a lead added
    on 2026-09-14 that calls them THE APPENDIX -- as optional material. They are
    the part the room can act on, and they stand alone.
The demos being kept is the plan the deck is now built around: A, B, C and maybe
D run together as one long stretch of terminal rather than one demo per section.

WHAT THIS COSTS, and it is worth knowing before putting anything back. The two
surviving demos now carry material no slide sets up any more, and their notes in
deck.md say what to say instead. Section 7 opens without sections 4 and 5 having
walked a request in and out; it was written to lean on that and no longer can.
And "same client, second call" -- the first slide of the trace-2 group below --
cannot come back on its own: its opening move is a comparison with a first call
the room will not have seen.

HOW TO PUT ONE BACK: copy the slide, its trailing notes comment, and whatever its
slice header below says about it, into deck.md at the position named in the map,
then re-render and re-count the slice header there. Slide numbers in the map are
the ORIGINAL deck.md numbers as of 2026-09-14, before any of this came out; this
file renumbers from 1, so they will not match the page numbers here.

THE MAP -- original deck.md page, and title:

  29  Trace 1
  30  The bytes, and the path they take
  31  The front door: a GsProcess per connection, then three gates
  32  servePost: parses only enough of the body to route it
  33  openSessionCreating: — the widest window in the class
  34  What travels into the worker, and why it travels at all
  35  Inside the worker, the order is the point
  36  runWorker: — four lines, and the whole concurrency story
  37  The worker answers, and the version is negotiated
  38  Three session ids, and why every gem names itself
  40  Same client, second call. What is *different*
  41  The request id lives exactly as long as the call
  42  handleToolsCall: — and **two** different failure envelopes
  43  THE VIEW. NO TOOL REFRESHES IT.
  47  A worker cannot write to its own client
  48  The client opts in — and for a while this server threw it away
  49  Three pieces of judgement the reporter carries, so tools need not
  50  Two bugs that only exist end to end
  51  The other stream, in one slide — because §8 rides it

AND, from the later section 8 thinning, by their page numbers on 2026-09-14
AFTER the cut above (so these two do not belong to the same numbering):

  42  An answered ping proves the client is there — and still counts against it
  43  How the front end can see any of this

and from the second section 8 pass, by their page numbers after the first:

  43  The ending that is *not* in the ladder: a worker gem that has died
  44  `maxSessions` — the one bound here that refuses rather than releases

and section 12 whole, by its page numbers in the 66-slide deck that followed
(a third distinct numbering -- these three groups do not share one):

  59  The floor moved — four days ago, and for one primitive
  60  `continueTransaction`: identical source, different primitive
  61  And 3.7.2 is **not** the safer image for having it
  62  #51438: right length, wrong content
  63  What the floor moving actually deleted

and the section 9 fold, by its page numbers in the 63-slide deck that followed
(a FOURTH distinct numbering; none of these four groups share one):

  46  Every request carries the token — the session id is **not** a credential
  47  The login: the worker gem is **the user's**, not the server's
  48  The token is the real bound — and the cap is on the **grant**

and the section 11 fold, by its page number in the 60-slide deck that followed
(a FIFTH distinct numbering; none of these five groups share one):

  50  `System writeLock:` is gated by **no** privilege — and that is my question

and section 10's mechanism slide, by its page number in the 59-slide deck that
followed (a SIXTH distinct numbering; none of these six groups share one):

  51  To add tools, write a **toolset**

and the two that followed it out of section 10, by their page numbers in the
58-slide deck after that (a SEVENTH distinct numbering; none of these seven
groups share one):

  53  When a domain toolset collides with the session model
  54  A GemStone result, and three asks already filed

THE SLICE HEADERS CAME WITH THEIR SLIDES. Slice 5 (section 4), slice 7 (section
6) and slice 10 (section 12) are reproduced whole below, including their running
orders, their "what to cut if the hour is going" lists and their departures from
docs/Presentation.md. Slice 6's header was split: the trace paragraphs are here,
the codec paragraphs went to deck.md with the codec slides. SLICE 8's DID NOT
COME: section 9 still exists in the deck, so its header stayed there and was
rewritten around the fold. SLICE 11's DID NOT COME EITHER, for the same reason:
section 11 still exists in the deck, two slides of it, and its header there was
rewritten around its own fold, and SLICE 9's did not come either, for the same
reason. The headers below those groups are the only account of them in this
file.

RENDERING is the same as the deck, and the --html flag is just as required here:
  marp --html --pdf --allow-local-files --no-stdin -o out/archive.pdf docs/slides/archive.md
This file contains no generated block -- gen.py owns nothing here -- and no
inline svg except the ones that came with these slides, which carry deck.md's own
rule about never putting a blank line inside an <svg>.
================================================================================
-->
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

<!--
================================================================================
TRACE 2, the first four slides of what was VERTICAL SLICE 6 -- section 5, a
follow-up request. ARCHIVED 2026-09-14. Its other three slides, the JSON codec,
did NOT come here: they are still in deck.md, moved to the very end as optional
material. Slice 6's original header is reproduced below with the codec paragraphs
lifted out, and those now sit beside the codec slides where they went.

Running order and plans, in seconds -- what is different 40, the request id 40,
handleToolsCall: 50, the view 45. 175s, and that is what archiving these four
gives back.

NO LEAD SLIDE, and this was the only non-centrepiece slice without one. Section 5
is not a new subject, it is the same walk with one thing changed, and announcing
it as a section would undo the thing that makes it cheap. It opened on the header
that ends section 4 -- MCP-Session-Id -- and read as the next sentence. THAT IS
WHY THESE FOUR CANNOT COME BACK ALONE: the first slide's whole rhetorical move is
"same client, second call", and there is no first call in the deck any more.
Bring section 4 back with them, or rewrite the opening.

Slides 1-4 are trace, and they get faster as they go because the room has walked
this path. Slide 4 was the pivot: "THE VIEW. NO TOOL REFRESHES IT." is the
dispatcher's own capitals and it is section 7's whole premise arriving one section
early -- so state it, do not argue it, and let section 7 do the work. Section 7
survives in the deck and now carries that premise unassisted, which it was always
able to do; this slide only got there first.

DEPARTURES from docs/Presentation.md that belong to the trace half:
  * THE SUMMARY DIAGRAM FOR SECTIONS 4-5 IS NOT HERE, deliberately, and this is
    the departure to revisit if anyone wants it back. The outline asks for "the
    whole chain on one page, front end above the line and worker below, with the
    GCI hop drawn as the only thing crossing it", to be reused in sections 6 and
    8 with an arm added each time. Three reasons it is gone: slice 5's sequence
    diagram already IS that picture, drawn before the walk rather than after it,
    and a second view of one chain eighteen slides later recaps rather than
    teaches; section 8 does not reuse it, so the "one arm each time" economy was
    never going to be collected; and section 6's own picture is a different shape
    anyway. If it comes back, it belongs HERE, as slide 5.
  * the outline's step 7 (McpJson write: -> the string -> GCI -> writeJson:, and
    a notification's empty answer becoming 202) is one line of slide 2's notes.
    It is a call chain with no decision in it, and 202 was already established
    on section 4's servePost: slide.
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

<!--
================================================================================
FROM SECTION 8 -- two slides removed from the maintenance cycle on 2026-09-14,
after the first archive cut. They were deck.md pages 42 and 43 at the time, the
fourth and fifth slides of vertical slice 2.

These are NOT part of the sections-4-to-6 cut above and did not come out for the
same reason. Section 8 survived the 45-minute target whole; it is being thinned
slide by slide. What went is the two slides that explain a MECHANISM the section
uses, leaving the slides that state the POLICY:

  * "An answered ping proves the client is there" -- the ping's two properties
    (any answer proves liveness; an answer does not stamp the activity clock)
    and the stream-generation rule that makes an unanswered ping admissible.
  * "How the front end can see any of this" -- System descriptionOfSession:,
    primitive 334, and the three fields the section reads.

WHAT WENT BACK INTO deck.md RATHER THAN COMING HERE. Both slides were load-
bearing for slides that stayed, so their notes were split rather than moved
whole. The deck now carries, in notes:
  * the ping-does-not-reset-the-clock decision and the supersession rule, on the
    maintenance-pass slide, because its bullets assert both;
  * the stream-generation failure story and the 6-of-14 measurement, on the
    reapReasonFor: slide, because row 3 is the row that needs them;
  * descriptionOfSession: and its three fields, plus the StnCrBacklogThreshold
    finding, on the view-hygiene slide, which is what spends the measurement;
  * the zero-filled description of a dead gem, on the dead-gem slide.
The copies below are the originals, unsplit. If either slide comes back, take
its notes from here and delete the transplanted copy in deck.md -- otherwise the
same paragraph is in the deck twice.

WHERE THEY GO BACK: immediately after the reapReasonFor: slide, in this order,
the ping slide first. Neither depends on the other.
================================================================================
-->

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

<!--
================================================================================
FROM SECTION 8, SECOND THINNING -- two more slides, removed 2026-09-14 after the
pair above. They were deck.md pages 43 and 44 at the time. Section 8 is now four
slides and demo F, down from ten.

What went this time is not mechanism, as it was above -- it is the section's two
ENDINGS. Both are self-contained and both can come back alone:

  * "The ending that is not in the ladder: a worker gem that has died" -- the
    case reapReasonFor: gets right and still cannot help with. Its notes carry
    the wedge the old behaviour caused, the GCI fatal-band argument, and the
    3.7.5 end-to-end verification.
  * "maxSessions -- the one bound here that refuses rather than releases" -- the
    section's closing slide, and THE ONE MOST WORTH PUTTING BACK. It is the only
    slide in the section where the answer is "we refuse", and the lockout it
    describes is the failure most likely to bite the room.

WHAT WENT BACK INTO deck.md. As with the pair above, notes were transplanted
rather than moved whole:
  * the dead gem's whole argument, onto the reapReasonFor: slide, because that
    table is what raises the question;
  * the maxSessions lockout in one paragraph, onto the SECTION LEAD's notes,
    flagged as the thing to spend a spare minute on.
The copies below are the originals. If either slide comes back, delete the
transplanted copy in deck.md so the paragraph is not in the deck twice.

ONE REFERENCE WAS EDITED rather than copied: the dead gem's Q&A magnet ended
"what it left behind is a maxSessions slot and nothing else -- which is slide 9".
Slide 9 was the maxSessions slide. The copy below still says it, and it is still
true of THIS file, where both slides sit together.

WHERE THEY GO BACK: at the end of section 8, in this order, immediately before
demo F.
================================================================================
-->

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

================================================================================
THE DEAD GEM'S OWN MEASUREMENT -- from the descriptionOfSession: slide, removed
2026-09-14. This is the Q&A magnet and it belongs on the dead-gem slide now.
================================================================================

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

<!--
================================================================================
FROM SECTION 12 -- the whole section, all five slides, removed 2026-09-14 after
the section 8 thinnings above. They were deck.md pages 59 to 63. "Versions: the
floor moved, and why", about four minutes, and it is the fourth and last stretch
set aside that day.

THIS IS A SET-ASIDE, NOT A THINNING. Section 8 was cut slide by slide because
each of its slides stood alone; this section has ONE argument running through
five slides and half of it does not stand. Slides 2 and 3 are the argument --
slide 2 is the evidence and slide 3 is the decision -- and the section's own
header said "do NOT cut slides 2 and 3". Taking them both is what makes this a
whole-section cut rather than another trim.

WHAT THE TALK KEEPS. A sentence when the version numbers come up, on the install
slide -- deck.md page 22, whose table already reads "3.7.5+" against src/auth and
is therefore where the room's hand goes up. ALL FIVE SLIDES' NOTES WERE
CONDENSED INTO ONE BLOCK THERE, under a VERSIONS banner at the end of that
slide's notes: the matrix, the two continueTransaction differences with the
sentence that decided it, the "3.7.2 is not the safer image" correction, the
no-optional-methods consequence, #51438 whole, what the floor moving deleted, and
the housekeeping. Nothing of the argument was lost; what was lost is the tables
that made it visible at the back of a room.

So this is the one set-aside where the deck's copy is a CONDENSATION rather than
a transplant of whole paragraphs. If any of these slides comes back, take its
notes from here -- they are the originals, unabridged -- and cut the matching
part out of slide 22's VERSIONS block, or the same argument is in the deck twice
in two different lengths.

WHAT ELSE POINTED HERE, all of it repointed in deck.md the same day rather than
left dangling: the auth invariants slide carried a visible "§12." at the end of
its version fine line (removed -- it was the only section pointer on any slide
face); its notes, the section 9 lead's notes, the slice 4 header's forkOnPort:
departure, and demo A's "section 12 will come back to it" all said section 12
owned versions. They now say slide 22's notes do.

WHICH ONE TO PUT BACK FIRST, if a minute appears: slides 2 and 3 together, as a
pair, or neither. Slide 3 is the decision and slide 2 is the only evidence for
it. Slide 4 (#51438) is the one this audience would enjoy most and the one it
costs least to leave out, because it has not bounded support since 3.7.4.1 --
it is a hallway story now, and slide 22's notes carry it in full for exactly
that.

WHERE THEY GO BACK: as section 12, in this order, at the end of the talk proper --
which since the 2026-09-14 reorder means after SECTION 10, not after section 11.
(This paragraph said section 11 until the appendix lead went in; section 11 moved
ahead of section 10 the same day and this line was not caught then.) The seam to
put them at is the appendix lead: they go before it, so the codec slides stay the
last thing in the file and the appendix stays the thing that can be dropped
whole. The slice header below is slice 10's own, whole, including its running
order and its departures from docs/Presentation.md.
================================================================================
-->

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

---

<!--
================================================================================
FROM SECTION 9, McpAuthRouter -- three slides, FOLDED AWAY 2026-09-14 rather than
cut for time. This is the only group in this file that left because a surviving
slide started saying what they said.

WHAT HAPPENED: deck.md page 45's face was rewritten -- from "a reachable port,
and the three invariants that pay for it", which was three numbered invariants
and a version line, to four sentences that state the whole mechanism at headline
level, ending "The JWT logs in the worker gem as that user, subject to that
user's privileges." Once that sentence was on the slide, the login slide had
nothing left to announce, and the other two were the consequences of it. So the
section went from a lead, five slides and a demo to a lead, two slides and a
demo; 190 seconds of slides became 90 seconds of one; and the slice's total went
from 6:20 to 4:40. It is the biggest single saving in the deck.

THEIR NOTES WENT WHOLE, NOT SPLIT AND NOT CONDENSED, which is the thing to know
before putting one back. All three slides' notes are on deck.md page 45 under
three banners -- EVERY REQUEST CARRIES THE TOKEN, THE LOGIN, THE TOKEN IS THE
REAL BOUND -- each naming the slide it came from. That slide is now SPOKEN rather
than read: it is four quiet sentences with three slides' worth of argument
underneath them. So if one of these comes back, CUT ITS BANNER OUT OF PAGE 45's
NOTES, or the same material is in the deck twice, once as a slide and once as
something to say over a summary of it.

WHICH ONE TO PUT BACK FIRST, if a minute appears: slide 3, the token as the real
bound. It carries the renewal bug, which is the best story in the section -- a
client working steadily, its gem and its uncommitted work gone one access-token
lifetime after opening, nothing errored, and the diagnosis is that activity was
feeding the idle clock while the absolute deadline was what was actually going to
end the session. It is silent data loss with a fix that reads as obvious only
afterwards. It survives as prose on page 45 and it is better as a slide.

Then slide 1, for its blockquote: the MCP-Session-Id once WAS a credential, so an
expired or revoked token kept working as long as the session was kept alive, and
the GET stream and DELETE took no credential at all. A confession lands better
with the room reading it. Slide 2 is the one that costs least to leave out --
page 45's last sentence IS its headline, and what the slide added beyond that is
the two-validations point and the error vocabulary, both of which answer a
question rather than raise one.

WHERE THEY GO BACK: after page 45 and before the offline_access deviation, in
this order, which is where they were -- but the deviation is no longer a slide.
It was merged onto the bottom of page 45 later on 2026-09-14, so restoring any of
these three means splitting that page back into two first, and page 45's notes
name the two halves and the four banners to take apart. Page 45's face would want its fine line
back too -- "src/auth needs JsonWebToken, JwtSecurityData, jwtPassword: -- 3.7.5.
An external OIDC IdP -- 3.7.6." -- because the fold took it and the version fact
is now nowhere on a face in that section except demo G's "needs the 3.7.6 stone".

Running order and plans as they were, in seconds -- every request carries the
token 45; the login 45; the token is the real bound 55.
================================================================================
-->
## Every request carries the token — the session id is **not** a credential

`requestAuthorized:on:` is the base-class hook on `McpRouter`, and this is the class that fills it in. Verify the **signature** against the stone's trusted JWT keys, then the resource-server claim checks: **`exp`** (required), and where configured **issuer**, **audience** (RFC 8707) and **required scopes**.

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

<!--
================================================================================
FROM SECTION 11, the worker gem's GemStone user -- one slide, FOLDED AWAY
2026-09-14 rather than cut for time. The second fold in this file and the last
change of the day. It is also the only slide here whose removal took an ASK off
the screen rather than an argument.

WHAT HAPPENED: deck.md page 49's face -- the privileges slide -- ended in a fine
line reading "What stays open: reads (object security policies are the answer to
that, not this), resources (§8's lifetimes), and locks." That line was replaced
by a blockquote saying the lock part outright: "No privilege allows or prevents
System writeLock:. A single statement can walk Globals and take over two thousand
locks." Once the exposure was stated on that face, this slide's first beat was
already made and the rest of it was elaboration. Section 11 went from three
slides to two, and from about 2 1/2 minutes to about 2.

WHAT THE FOLD ACTUALLY COST, and it is worth being plain about because it is not
nothing. This slide asked a question -- "So: should there be a privilege that
withholds writeLock:?" -- and the blockquote that replaced it states a fact. The
deck now contains no face that asks the room for anything except the codec's
defect table, which is in an appendix that may not run at all. Both of the talk's
two asks are therefore at risk in different ways: this one from being spoken only,
that one from being optional. If the talk is ever given to a room that matters
more than the clock does, THIS IS THE FIRST SLIDE TO PUT BACK.

ITS NOTES WENT WHOLE, NOT SPLIT AND NOT CONDENSED. They are on deck.md page 49
under a banner reading THE LOCK ASK, and they carry what the face no longer does:
the DataCurator measurement (a restricted gem locked only McpServer's method
dictionary, and a privileged developer's compile-and-commit then failed with
conflict #'Write-WriteLock', n=1), the 2,291 locks in one statement, the transient
reassurance about McpRouter and McpServer, the session-lifetime bound, the
stopSession: escape hatch, and the reverted MCP_REAP_LOCK_HOLDERS reaper of commit
b0a5180. Three of that banner's pointers were rewritten on the way across, where
they had named this slide's own bullets; nothing else was changed. SO IF THIS
SLIDE COMES BACK, CUT THAT BANNER OUT OF PAGE 49's NOTES -- otherwise every one of
those facts is in the deck twice, once as a slide and once as something to say
over the slide before it. Page 49 would also want its fine line back in place of
the blockquote, or the lock claim is made twice on two consecutive faces.

WHERE IT GOES BACK: immediately after the privileges slide, which is the last
slide of section 11, and immediately before section 10's lead. That is where it
was, and it is why section 11 ended the way it did.

Running order and plan as it was, in seconds -- the lock and the ask 55.
================================================================================
-->
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
FROM SECTION 10, extending it: a server for YOUR software -- one slide, "To add
tools, write a toolset", REMOVED 2026-09-14. The last change of the day, and the
only slide in this file that was the sole face-level account of a mechanism.

WHAT HAPPENED: the slide beside it -- "How a deployment picks a surface" -- was
rewritten to name a real customer's toolset in its bullets -- BrainFreezeToolset,
where it had said AcmeDbToolset under a blockquote naming Brain Freeze Insurance
as the example. (The server-class bullet was BrainFreezeServer for part of that
day and went back to AcmeDbServer, so the face now names the real customer for
the toolset and a fictional one for the subclass.)
With a named toolset on the face of that slide, this one's job -- introducing the
idea of a toolset at all -- was being done a slide later and more concretely.
Section 10 went from a lead and five slides to a lead and four, and from about 4
minutes to about 3 1/4. By the end of that day it was a lead and one merged
slide, about 90 seconds; see the header below this one.

WHAT THE DECK NO LONGER SAYS ANYWHERE ON A FACE, and this is the part worth
weighing before this one stays gone. How a toolset is WRITTEN: subclass
McpToolset, implement registerOn: and toolNames, build schemas with the inherited
builders, write handlers that answer a String, and pass mutations through
assertMutableClass:. The deck is a talk to GemStone developers about extending
this server, and after this cut no slide in it shows a line of that. It is all on
deck.md page 51 under a banner -- the FACE as well as the notes, which no other
entry in this file needed, and page 51 is now the merged slide that is the whole
of section 10 -- so a speaker reading their notes still has it. A room
that only watches does not.

AND ONE POINTER WENT WITH IT: the blockquote reading "tools/list is unfiltered:
every tool a session's toolsets registered is offered, and none is refused for
being 'unsafe'. What a session may DO is decided by the GemStone user its worker
gem logs in as (§11)." That was section 10's ONLY face-level link back to section
11, which since the 2026-09-14 reorder runs immediately before it. Three places
in deck.md were repointed to say the link is made in speech now: section 11's
slice header, the notes of section 11's first slide, and this section's lead. If
this slide comes back, all three want their (§11) back.

ITS NOTES ARE ON PAGE 51, WHOLE, under a TO ADD TOOLS, WRITE A TOOLSET banner,
with two additions rather than the usual none -- a WHAT THE SLIDE SAID paragraph
reconstructing the face in prose, and a THE POINTER THAT WENT WITH IT paragraph.
So if this slide is put back, CUT THAT WHOLE BANNER out of page 51's notes,
including both additions, or the mechanism is in the deck twice.

WHERE IT GOES BACK: immediately after section 10's lead and before the surface
slide, which is where it was. That slide's own notes would want trimming too --
four paragraphs there begin by saying something came off a face, and two of them
are only true while this slide is gone.

Running order and plan as it was, in seconds -- write a toolset 45. The surface
slide was 45 then and is 50 now, for having to open the seam as well.
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
into the isError envelope with a kind, which the archived section 5 showed. A handler does not
build error envelopes itself.
-->

---

<!--
================================================================================
FROM SECTION 10 AGAIN -- two slides, "When a domain toolset collides with the
session model" and "A GemStone result, and three asks already filed", SET ASIDE
FOR TIME 2026-09-14. Not a fold: no surviving face says any of this. They are the
last two slides of the talk proper as it stood that morning, and they are the
LAST TWO SLIDES TO LEAVE THE DECK ON THE DAY IT WAS CUT FROM AN HOUR TO 45
MINUTES.

WHAT WENT WITH THEM, and it is worth listing because it is everything section 10
could prove: 132 defects against 386 run / 386 passed / 0 failed / 0 errors, the
same three test classes in a long-lived worker and in a fresh gem; 31 modified
objects for a 7-test class, which is what makes a cold Grail import a database
write; FlaskScaffoldingTestCase at 262 seconds, which is what makes progress
reporting the flagship case rather than a nicety; a stock sender search answering
an empty pair of arrays where 12 senders exist; and Grail #883, #884 and #885,
the three interfaces already filed upstream. Section 10 now asserts that
extending this server works and shows nobody having done it.

THE COLLISION SLIDE IS THE ONE TO PUT BACK FIRST, and it is not close. The slice
header called it the one that lands, and its argument is general where the rest
of the section is Grail-specific: your domain has a model, this server has a
session model, and where they disagree the disagreement is yours to resolve.
Every vendor in that room who writes a toolset meets some version of it. Fifty-
five seconds.

THE UPSTREAM-ASK SLIDE COSTS LESS TO LEAVE OUT, but it costs something specific:
it was the only place in the deck that showed the three Grail issue numbers, so
that nobody had to write them down from speech. Its other half -- that a tool
whose coverage is partial owes the caller its own boundaries, which is what the
searched:/not searched: block is for -- generalises past Python and is worth ten
seconds even without the slide.

THEIR NOTES ARE ON DECK.MD PAGE 52, whole, under two banners named for them, each
opening with a WHAT THE SLIDE SAID paragraph reconstructing the face in prose --
the same treatment the toolset slide got, and for the same reason: nothing else
in the deck carries any of it. SO IF EITHER COMES BACK, CUT ITS BANNER OUT OF
PAGE 52's NOTES, and trim the paragraph above them that says this slide now ends
the talk proper.

WHERE THEY GO BACK: after the worked example, in this order, which is where they
were -- but the worked example is no longer a slide of its own. It was merged
into the surface slide later on 2026-09-14, so restoring either of these means
splitting page 51 back into two first, and its notes name the three banners to
take apart. Section 10's lead and slice header would both want reverting too --
the lead's notes now promise that the section ends on its one slide, and the
slice header's WHAT TO CUT list has been rewritten around their absence.

Running order and plans as they were, in seconds -- the collision 55, the
upstream ask 40.
================================================================================
-->
## When a domain toolset collides with the session model

**`run_python_tests` forks a fresh gem. That is the design, not a precaution.**

> **Measured 2026-09-01:** the same three test classes gave **132 defects** run in a long-lived worker session, and **386 run / 386 passed / 0 failed / 0 errors** run fresh. **Every one of those defects was an artifact of the session.**

* A real disagreement between two models. Grail's rule: **a module is a compiled artifact in the database, bound — never rebuilt — by every import afterwards.** Its SUnit isolates tests by **evicting framework modules from `sys.modules`** — and where those modules are *committed*, re-importing **raises**. **A long-lived MCP worker is exactly the session that accumulates that state**
* Forking settles three more things at once: the caller's transaction is **untouched**, where an in-session run dirties it *silently* — **a cold Grail import is a database write**, measured at **31 modified objects for a 7-test class**; and the child's writes are **never committed**, so a run leaves the repository exactly as it found it
* **The cost is honest and stated in the tool.** Every run is fully cold — `FlaskScaffoldingTestCase` alone is **262 seconds**. Hence the `classNames` argument, and why this is the flagship consumer of progress: **an unbounded wait with no word is worse than a slow one that says so**

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
