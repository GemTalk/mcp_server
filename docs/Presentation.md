# Presentation

A technical talk to the GemStone developers on the present state of mcp_server: slides, interrupted
occasionally for short demos. This file is the working outline — the argument, the detail under each
slide, and the code the detail comes from. Selectors rather than line numbers throughout, so it does
not rot; every claim traces to a class comment or a method comment in `src/`.

**Shape.** Healthy path first, in full, before any pressure case. The audience knows GemStone; it
does not know MCP, and it does not know why a server that looks like a web server is built out of
gems. So: what the repository *is*, how a server starts, one request end to end, a second request
end to end — and only then progress, the transaction model, the maintenance cycle, auth, extension,
and the version story.

**Budget: about an hour, nothing cut.** Everything here gets rehearsed — not because it all has to
be said, but because the parts that end up unsaid are where the questions come from, and a section
rehearsed is a question answered in one sentence instead of three. A working split, with the demo
time counted separately so it is visible what the demos actually cost:

| § | | talk | demo | total |
|---|---|---|---|---|
| 0 | Framing | 1.5 | | 1.5 |
| 1 | The repository, and how it is verified | 2.5 | 1 (A) | 3.5 |
| 2–3 | Starting a server; fork, detach, transactionless | 4 | 1.5 (B) | 5.5 |
| 4 | **Trace 1 — `initialize`** | 6 | 2 (C) | 8 |
| 5 | **Trace 2 — `tools/call`**, and `McpJson` | 5 | 1.5 (D) | 6.5 |
| 6 | Progress notifications | 1.5 | | 1.5 |
| 7 | **The transaction model and the guardrail** | 8.2 | 3 (E) | 11.2 |
| 8 | **The maintenance cycle** | 5.7 | 1.5 (F) | 7.2 |
| 9 | `McpAuthRouter` | 2.5 | 2 (G) | 4.5 |
| 10–11 | Extending it; read-only mode | 1.5 | | 1.5 |
| 12–13 | Versions; future work and the asks | 2.5 | | 2.5 |
| | | **40.9** | **12.5** | **53.4** |

**53.4 minutes leaves under 7 for questions in a 60-minute slot, which is tight** — and this audience
will have questions, so treat 53.4 as the ceiling rather than the plan. **It is also 0.7 over the
52.7 this table carried before §8 was cut**, and that is a decision rather than a rounding: §8 came
out at 5.7 talk minutes against the 5 allowed, *after* moving request deadlines and cancellation
into speaker notes entirely. The cheapest place to pay for it is the second half of **§12**, which
is already first in the shed list below; the alternative is to accept ~6.6 minutes of questions. Two honest observations about those
numbers. The demos are **a quarter of the running time** and are the first thing that will overrun,
so each one wants a hard stop rehearsed into it. And §§4, 5, 7 and 8 are **24.9 of the 40.9 talk
minutes — with their demos, 32.9 of the 53.4** — which is the right shape: they are the four
sections whose content does not survive being read in the README afterwards.

If the slot turns out to be 45 minutes, shed in this order: **§6**, then **§10–11**, then the second
half of **§12** (keep 12.1, the `continueTransaction` measurement; #51438 and the compatibility
leftovers can go). **Do not shed a demo to save a section** — the demos are what make the gem model
concrete, and a section summarised in two sentences beside a live worker gem lands better than the
same section in full with nothing on screen. If it turns out to be 90 minutes, the material to
*add* is already listed: the `sessionGone` demo in the demo inventory, and the three measurements
§7 now carries as speaker notes rather than slides — the seven-line clobber trace, the four-way
refresh table, and the commit-probe discovery story — and **§8's request deadlines and cancellation**,
which are a slide's worth of material sitting in slide 8's notes and are the single largest thing
either cut section gave up.

**Standing rule for the healthy-path half:** no commit-record pressure, no timeouts, no pending
ledger, no progress notifications, no auth. Every one of those is a later section that comes back to
the same trace and adds one arm to it. Say so early, so the audience stops waiting for the caveat.

---

## 0. Framing (4 slides)

**This section is cut, and `docs/slides/deck.md` is the authority for it** — the running order
below is a summary of that file rather than a plan for it, and where the two disagree the deck is
right. Four slides: the title, *MCP in one slide*, *What is different here*, *Status, honestly*.
**1:45 against the 1.5 minutes this outline's table allows**, and §1 gives the 15 seconds back, so
the table does not move.

**Deliberately no diagram**, here or in §1. The orienting picture of the deployment belongs to §3,
where the fork and the detach are the subject; the request picture belongs to §4, where it is walked
line by line. Either one drawn here would spend 45 seconds saying worse what a later section says
properly.

* **What MCP is, in one slide.** JSON-RPC 2.0 over HTTP, one endpoint. A client (an editor, an
  agent) asks a server what tools it has (`tools/list`) and calls them (`tools/call`). That is
  nearly the whole protocol surface this server implements: `initialize`, `ping`, `tools/list`,
  `tools/call`. Everything else in the spec — resources, prompts, sampling, elicitation — is
  undeclared and answered `-32601`.
* **What is different here.** It runs *inside* the image. No Node process, no GCI bridge, no FFI.
  The thing that executes `execute_code` is a gem, and the thing that owns the socket is a gem.
  That single decision is where every interesting consequence in this talk comes from: a session is
  a login, a session is a transaction view, and a view is a commit record the stone cannot dispose
  of.
* One line on what it replaces: the GCI-based Jasper MCP server, and the goal of being reachable by
  *any* MCP client over plain HTTP.
* **Status, honestly — and the slide is called that because the honesty is the point of it.** Built
  and verified end to end, by curl, by a TLS run and by the in-image suites: the Streamable HTTP
  transport, per-client worker gems, 31 base tools (+9 optional Python), OAuth 2.1/JWT + TLS. Then
  **two things on that list which are not being sold**, both settled on 2026-09-11:
  * **read-only mode is a tool gate, not an access-control boundary** — a localhost convenience so
    one user cannot mutate by accident, and a read-only session still costs a login and still holds
    a view. It is a placeholder, and §11 is where the ideas for making it a boundary live. Do not
    let the slide imply more than §11 will deliver;
  * **server-initiated messages are machinery, not a feature.** They are built, and this server
    needs them — every count in §8 rests on server-initiated `ping` — but the `2026-07-28` draft
    forbids the direction outright ("servers do not initiate JSON-RPC requests"), so it is not a
    capability with a future to sell. §13 carries the consequence, including which half of §8
    survives it.
  Point at [Future work](../README.md#future-work) for what is not built, rather than reading a
  second list aloud.

---

## 1. The repository, and how it is verified (5 slides, one of them demo A)

**This section is cut, and `docs/slides/deck.md` is the authority for it** — the running order below
is a summary of that file rather than a plan for it, and where the two disagree the deck is right.
Four slides plus demo A: *nothing to install but topaz file-outs*, *each `load.gs` pre-declares its
class names*, *which gem runs your code*, *how it is verified*. **3:20 against the 3.5 this
outline's table allows**, which pays for §0's overrun.

The point of this section is that there is no build system to explain and nothing to install but
topaz file-outs. It has no thesis and does not want one: it is the tour that makes the later
sections cheap, so that "the front end" and "a worker" are things the room can picture and "why did
my fix not take" has an answer on a slide.

**Layout** (from [Source layout](../README.md#source-layout)):

| group | classes | what | when |
|---|---|---|---|
| `src/core/` | 21 | the server: protocol, transport, dispatch, the seven toolsets | always |
| `src/tests/` | 26 | the SUnit suites and their fixtures | always |
| `src/auth/` | 3 | `McpAuthRouter` + its two suites | 3.7.5+ |
| `src/grail/` | 2 | the optional Python toolset + its suite | `--grail` |

* **One `.gs` file per class, canonical `fileOutClass` output.** No Rowan, no Tonel, no package
  manager: a file-out files into any image topaz can log into, on any version. The tree
  round-trips byte-exact, so a regenerated-vs-repo diff is a trustworthy signal.
* **Each group has a `load.gs`** naming its files in dependency order, and each one **pre-declares
  its class names bound to `nil` first**. Worth a slide of its own for this audience: the classes
  reference each other in both directions (`McpDispatcher` asks `McpServer` for its name;
  `McpServer` builds an `McpDispatcher`), so no file order puts every class ahead of its first
  mention. Binding the names first works because the compiler binds a global by its *association*
  and the class definition fills that same association in.
* **`Mcp` is the home dictionary**, not `Published`. A user provisioned for MCP needs it in their
  symbol list.
* **Where the classes go, and what runs them** — this is the table to leave on screen, because it
  answers "why did my fix not take":

| | class | gem | picks up a recompile |
|---|---|---|---|
| front end | `McpRouter` / `McpAuthRouter`, `McpHttpConnection` | one detached gem owning the listen socket | within **two** maintenance passes (60s each) |
| worker | `McpServer`, `McpDispatcher`, the `Mcp*Toolset`s | one per client session | next request |
| driver | the suites | whatever topaz or MCP session you are in | immediately |

* **The scripts.** `gs-env.sh` (sourced by all of them; resolves and refuses a misconfigured
  environment), `install.sh` (`--check`, `--auth`, `--no-auth`, `--grail`), `run-server.sh`,
  `run-auth-server.sh`, `stop-server.sh` (by port), `run-unit-tests.sh`, `test.sh` (the wire),
  `test-tls.sh`, `session-lifetime.sh` (the documentation of the timing knobs, not a test),
  `sleep-test.sh`, `setup-oidc-users.sh`, `verify-oidc-login.sh`.
* Worth one sentence, because this audience will hit it: **`GEMSTONE_GLOBAL_DIR` is the variable
  that decides whether anything works**, and getting it wrong produces a `getaddrinfo` error that
  reads like DNS and is not. `./install.sh --check` is the first thing to run on a new machine.

**How it is verified**, since the repository tour is the place this belongs and it is short:

* **`./run-unit-tests.sh`** — the in-image `GsTestCase` suites, each in **its own topaz session**, so
  a suite that blows up is reported `ABORTED` under `COULD NOT RUN` rather than silencing the whole
  report; failures are reported **by name**, and the output is coloured for CI. **466 tests** on a base install, **522** with the auth group, **573 with the 51 in
  `McpGrailToolsetTest`** on a Grail image. Exit 0 means every test passed. **Seven** of the suites
  are not purely in-image and need a **netldi** — `McpGrailToolsetTest` joined them in the merge of
  2026-09-10, because `run_python_tests` now forks the gem it runs Grail's classes in.
* **`./test.sh`** — the only check that drives the tools **over the wire** with curl: `initialize`,
  the captured session id on every later request, every core tool, a compile/commit round trip, the
  error paths, the SSE GET stream, DELETE. Nothing in the unit suites covers the transport, so a
  break there is otherwise silent.
* **`./test-tls.sh`** — the same transport over HTTPS, generating a throwaway self-signed cert and
  setting it **only in the forked gem's session, never committed**.
* **`./sleep-test.sh`** — brackets a real host suspend (§8).
* **GitHub Actions (`.github/workflows/health-check.yml`)** — on ubuntu-latest it downloads and
  installs GemStone **3.7.5**, creates a fresh extent, starts a stone and a netldi, installs
  mcp_server (in a matrix **with and without Grail**), and runs all three of the above. Plus a lint
  job over the workflows themselves (`actionlint`, `zizmor`). Worth one line on the slide because it
  answers the question this audience will ask about a project with no package manager: *what proves
  it still files in?*
* **Two expected failures that are signal rather than noise.** They are **speaker notes rather than
  a slide**, because both belong to sections that spend them properly: `McpExternalSessionTest`
  fails on an unsupported image **on purpose** — the failure is the suite reporting the image
  (§12) — and `McpConcurrentEditTest>>testTheStoneAloneWouldAllowThatClobber` is **written to fail
  on good news** (§7, which already gives it a slide). *Corrected 2026-09-11: this outline
  attributed that test to `McpBlindWriteTest`, which does not contain it.*

`[DEMO A — 60s]` `./install.sh --check` on the demo stone, then `./install.sh`. Shows the
environment report and the group selection deciding itself (auth in or out by probing for
`JsonWebToken`).

---

## 2. Starting a server: what `run-server.sh` actually does (2 slides)

The claim: **all config lives on a router *instance*. Nothing is committed. Several
differently-configured routers can run at once.**

* The script is a here-doc into `topaz -l`. Stripped of the environment handling it is:

  ```smalltalk
  | r |
  r := McpRouter new.
  r readOnly: false.
  "…any MCP_* setters the environment asked for…"
  r forkOnPort: 8000
  ```

* **What `McpRouter>>initialize` seeds** — the slide is the *why*, not the list. Fields where `nil`
  would be unsafe or is itself a real setting get a seed; genuinely optional fields stay `nil`
  meaning off. The seeded ones and their defaults:

| | default | |
|---|---|---|
| `maxSessions` | 3 | how many workers this router holds at once. `nil` = no cap |
| `sessionIdleTimeoutSeconds` | 1800 | how long a client may be quiet. `nil` = no deadline |
| `streamlessIdleTimeoutSeconds` | 60 | the floor for a client that opens no stream |
| `streamLossGraceSeconds` | 10 | grace for a client that closed its stream |
| `livenessProbeIntervalSeconds` | 120 | how often a quiet session is re-asked |
| `reaperIntervalSeconds` | 60 | how often the maintenance pass runs |
| `maxCommitsBehind` | 20 | how far behind a worker's view may fall before a refresh |
| `maintenanceCallTimeoutSeconds` | 5 | how long the front end waits on its *own* send into a worker |
| `stuckViewGraceSeconds` | 60 | how long an immovable view is tolerated under pressure |
| `pinnedViewGraceSeconds` | 300 | how long a running call may pin the oldest commit record |
| `requestTimeoutSeconds` | `nil` | **no request deadline by default** — see §8 for why it was removed |
| `frontEndTransactionMode` | `transactionless` | see §3 |
| `allowedOriginHosts` | loopback | DNS-rebinding defence |
| `messageTrace` | false | a traced log holds every argument every client sent |

* **The worker surface, also decided here — and it is *named*, never discovered.**
  `workerClassName` `nil` → `McpServer`; `toolsetNames` `nil` →
  `McpServer class>>defaultToolsetNames`: **the core seven and nothing else.** Until 2026-09-11 the
  default probed the symbol list and appended `McpGrailToolset` whenever `src/grail/` had been filed
  in — so *installing* the group configured every server in the image, including ones whose operator
  had never heard of Grail. `installedDefaultToolsetNames` is gone. Two reasons: an optional toolset
  can carry a dependency the image knows nothing about (Grail's tools read the `.py` checkout that
  `grailDirectory` names, so such a server was answering for a directory nobody chose, and on an
  image where `MCP_GRAIL_DIR` was never set it advertised nine tools that could not work); and
  turning a toolset on should look the same whoever wrote it, which makes `McpGrailToolset` the
  worked example §10 can tell a developer to copy rather than a special case that reads as built in.
  `MCP_TOOLSETS` names the surface — the core seven **plus** yours; `MCP_GRAIL_DIR` only *configures*
  it. **31 tools by default, 40 when Grail is named.** Breaking and pre-release, so it is called out
  rather than shimmed, and nothing silently degrades: the tools are absent from `tools/list` rather
  than present and failing. Resolved **per session**, not at boot — so a toolset filed in after
  startup reaches the next client, and (§9) an authenticated router will later be able to narrow the
  surface per token, since the token is only visible on the front-end side.
* **Two validations run in the launching session as well as in the child**
  (`validateWorkerConfig`, `validateTimerConfig`). Deliberate: without it the operator sees a
  cheerful "forked into gem session N" and a port that never opens, with the reason buried in a
  detached gem's log. `validateTimerConfig` refuses a combination whose *counts* would round to
  something other than what was written — a probe interval shorter than a pass, an idle timeout
  shorter than a probe interval. `validateWorkerConfig` also refuses to start a router holding
  **options for a toolset it does not serve**, which is what catches an `MCP_GRAIL_DIR` set without
  `McpGrailToolset` in the surface.

---

## 3. Forking and detaching the front end (2–3 slides)

**Why a dedicated gem at all.** Forked `GsProcess`es only run while the gem is actively executing
Smalltalk. A GCI-driven session is parked in the C client between commands, so a background accept
loop forked there is frozen and never serves a request. Therefore the accept loop is the **blocking
main activity of a dedicated gem**. This is the slide that lands with this audience; it is the
reason the architecture is shaped the way it is and not a preference.

> **THE ONE FACT THAT DECIDES THREE DESIGNS.** *A gem executes no Smalltalk while it is idle.* Make
> this a callback slide and bring it back twice, because the audience will otherwise meet the same
> constraint three times as three unrelated rules:
> 1. **the front end must be its own detached gem** (here) — a forked accept loop in a GCI-driven
>    session would be frozen between commands;
> 2. **the front end must own the client's stream** (§6) — a worker cannot write to a socket it does
>    not have, *and* could not run a drain loop between calls even if it did;
> 3. **the front end must own view hygiene** (§8) — and this is the interesting one, because on
>    every *other* count the worker is the better-informed party. It can read its own commits-behind,
>    the stone's backlog, whether it holds the oldest record, the stone's thresholds, and
>    `needsCommit` — which the front end cannot see at all. The reason the *action* still belongs to
>    the front end is that the problem case is precisely the **idle** worker holding a stale view,
>    which is the one moment that worker cannot run a line of code. **Only the front end has a
>    heartbeat.**

**`McpRouter>>forkOnPort:`**, in order:

1. `validateWorkerConfig` + `validateTimerConfig` (above).
2. Build a `GsTsExternalSession`. Written the long way for an image floor that has since moved, and
   the comment still says so — see §12.3, which is worth a forward reference here if anyone asks:
   `newDefault` + `gemNRS: (GsNetworkResourceString defaultGemNRSFromCurrent node: 'localhost')`
   rather than `newDefaultForGemHost:`, and
   `onetimePassword: (GsCurrentSession currentSession createOnetimePasswordValidForSeconds: 300)`
   rather than `useOnetimePassword`. **Same user, one-time password.**
3. `login`.
4. **Capture `stoneSessionId` and the host pid *before* launching the loop** — once the
   non-blocking call is running the external session refuses further queries (`GciError`,
   "operation in progress"). This is the kind of ordering constraint worth showing; it is not
   obvious and it cost time.
5. `forkAndDetachString: 'McpRouter runOnPort: 8000 configJson: ''{…}'''` — **the config travels in
   the fork string as JSON** (`configDict` → `configJson`), quoted through `quoteForFork:`.
   Host lists, file paths and identifiers only, **never key material**. So nothing is committed,
   and two routers with different config coexist.
6. `logout` the handle. **The child is independent** and keeps serving after the launching session
   goes away.
7. Answer a status string carrying the three ways to stop it: `./stop-server.sh` (by port),
   `System stopSession: <id>` (from any session), `kill <pid>` (shell).

**Then, in the child, `McpRouter class>>runOnPort:configJson:` → `applyConfigJson:` →
`applyFrontEndTransactionMode` → the instance-side `runOnPort:`:**

* `makeListenerOnPort:` — **loopback only**. `bindAddress` answers loopback and has *no setter* on
  the base class, because a base `McpRouter` authenticates nothing and a reachable port would be an
  open door into the repository. `McpAuthRouter` is the class that adds a setter (§9).
* `nameThisGem: (self cacheNameForPort: aPort)` → `McpRouter:8000`. **After** the bind, not before:
  a gem that failed to take the port is not this server.
* `forkReaper` — the maintenance `GsProcess`, every `reaperIntervalSeconds` (§8).
* `forkSignalPoller` — the progress drain, every `signalPollMilliseconds` (§6).
* The startup banner. Worth a slide as a screenshot, because it is the whole configuration in the
  log and there is nothing else on disk that records what *this* router was told: listening address,
  workers + toolsets, session lifetime, concurrent-session cap, **shared cache name read back from
  the cache** (so the log and `System cacheStatisticsForAllSlots` cannot disagree), **transaction
  mode as the gem reports it** (not as configured), view-hygiene summary, and the trace line if
  tracing is on.
* The accept loop:

  ```smalltalk
  [isRunning] whileTrue: [
    (serverSocket readWillNotBlockWithin: 500) == true ifTrue: [
      client := serverSocket accept.
      client ifNotNil: [self serve: client]]]
  ```

  Gated on **readiness** rather than `acceptTimeoutMs:`, because for a `GsSecureSocket` listener
  `acceptTimeoutMs:` *raises* on an idle timeout and would kill the loop every 500ms.

**The transactionless front end** — put this here rather than in the view-hygiene section, because
it is a property of how the gem starts and it constrains every line of front-end code:

* The front end runs `#transactionless` and **aborts at the top of every maintenance pass**
  (`refreshFrontEndView`), so it holds no commit record for longer than one interval.
* Measured, and the reason this exists: a front-end gem left in transaction sat on the stone's
  **oldest commit record for 15 hours**, its last transaction boundary its own login, and *nothing
  stone-side could ever have moved it* — an in-transaction gem is immune to `sigAbort` unless it
  asked not to be.
* The price: **front-end code must not read persistent object graphs.** No walking a committed
  collection, no caching a persistent object across statements. Stone primitives and lookups by
  name are fine. The `McpRouter` class comment says so in capitals.
* The same fact from the other side: **a committed recompile of front-end code takes effect in a
  running server**, within two passes. That is the answer to "my transport fix didn't take" — wait
  one pass, then check the gem's start time. (`./stop-server.sh && ./run-server.sh` is the only way
  to be *certain*.)
* `refreshFrontEndView` also carries a **bug detector**: out of transaction, a write to a committed
  object is allowed, sets `needsCommit`, and is then discarded by the abort with no error anywhere.
  The front end writes nothing today; if that ever stops being true, that log line is the only
  thing that will say so.

**What `initialize` adds to a live router** (the objects, one slide): the session-map mutex, the
routes table, the `MCP-Session-Id → McpSession` dictionary, the pending-request table **with its own
mutex** (the map mutex is held across reaping, and correlating a client's ping reply must not queue
behind another client's login), the `callId → McpProgressChannel` map with its mutex, and three
counters.

`[DEMO B — 90s]` `./run-server.sh`, then `tail` the front end's gem log to show the banner; then
`System cacheStatisticsForAllSlotsShort` in topaz showing `McpRouter:8000` alongside the workers
that DEMO C is about to create.

---

## 4. Trace 1: a brand-new client's first request (the centrepiece — 5–7 slides)

Take one request off the socket and follow it to the answer. Kernel-level parsing is assumed known;
this is the mcp_server path only.

**The bytes.**

```
POST /mcp HTTP/1.1
Host: localhost:8000
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25",
 "capabilities":{},"clientInfo":{"name":"claude-code","version":"…"}}}
```

**The path, in call order.** One slide per group of two or three; the whole chain on a summary slide
at the end of the section.

1. `McpRouter>>serve:` — **each connection gets its own `GsProcess`**, so a slow client cannot block
   the accept loop; the forked handlers run during the loop's accept waits. TLS handshake first
   where enabled (`completeHandshake:`); a failed handshake closes the socket and serves nothing.
2. `McpHttpConnection on: aClientSocket` — reads one HTTP/1.1 request, writes one response. Its
   `readRequest` **bails after an 8s read timeout**, so a client that connects and never sends a
   complete request is dropped rather than wedging a process.
3. `McpRouter>>handleConnection:` — `readRequest`, then `traceRequest:`, then `route:on:`; any error
   is contained and answered `500`, and the connection is always closed. **The trace tap is here on
   purpose**: this is the only point that sees *every* client message, before the Origin, protocol
   and credential gates, and a refused request is exactly the one an operator is trying to see.
   Headers are never traced — one of them is a bearer token.
4. `McpRouter>>route:on:` — the three gates, in this order and for a stated reason:
   * `originAllowed:` — a present `Origin` whose host is not loopback → **403** (DNS-rebinding
     defence, per the MCP spec). An *absent* Origin is allowed: curl, and every non-browser client.
   * `protocolVersionAllowed:` — an unsupported `MCP-Protocol-Version` → **400**. Absent is allowed,
     because `initialize` legitimately carries no negotiated version yet.
   * `requestAuthorized:on:` — the hook. The base class authenticates nothing and always passes;
     `McpAuthRouter` overrides it (§9). Transport gates first because they concern the *connection*
     rather than the principal, and are cheaper.
   * then `routesTable at: 'POST'`; an unknown verb → **405**.
5. `McpRouter>>servePost:` — **parses only enough of the body to route it.** `parseBody:` (the
   UTF-8 story, §5), then four questions in order:
   * an `id` and **no** `method` → a JSON-RPC *response*: the client answering something this server
     sent on its stream. Not routable — the worker's dispatcher would answer it `-32600` — so it is
     correlated here and acknowledged `202`.
   * `notifications/cancelled` → handled **here**, never routed. Routing it would queue it on the
     session's worker mutex *behind the very call it asks to stop*: **measured at 17 seconds on a
     20-second call** before this existed.
   * `initialize` → `serveInitialize:on:`.
   * anything else → `serveRouted:…` (that is Trace 2).
6. `McpRouter>>serveInitialize:on:` — wrapped in `refusingOverSessionLimit:on:do:`, which asks no
   question of its own; it only answers the one `openSessionCreating:` settles.
7. **`McpRouter>>openSessionCreating:` — the slide with the most in it.**
   * `mutex critical: [` take the slot **and** mint the id `]`. One critical section, because the
     slow part of this method is the *login* and the front end goes on running other `GsProcess`es
     across it — so the window between deciding there is room and filling it is the widest window in
     the class. A cap of three cannot be talked past by three clients that all looked before any of
     them logged in.
   * The reservation is a **count** (`sessionsOpening`), not a placeholder in the map: nothing may
     find a half-built session by id, and the count still has to include it. Released in an
     `ensure:` whether the session registers or the login fails.
   * Past the cap: an `McpError` kinded `#sessionLimit` → JSON-RPC **`-32001`** in an HTTP 200
     bearing the request's own id, no `MCP-Session-Id`, and **no login attempted**. Why a cap at all
     is §8's material, but the number belongs here: **3 by default**.
   * The id is `nextSessionId` — a cryptographically-random **128-bit** token as hex.
   * `McpSession startWithId: newId readOnly:` — a `GsTsExternalSession`, one-time password, `login`,
     `cacheWorkerIds` (stone session id + host pid, captured at login).
   * Then the front end **pushes what the worker is**: `workerClassName:`, `toolsetNames:`,
     `toolsetOptions:`, `serverName:`, `serverTitle:`, `serverVersion:`, `requestTimeoutSeconds:`,
     `maintenanceCallTimeoutSeconds:` — and `prepareWorker`.
   * `expiresAtSeconds:` where an absolute cap is configured.
   * `mutex critical: [sessions at: newId put: sess]` — **registered last**, so no request can reach
     an unprepared worker.
8. **`McpSession>>prepareWorker` — one round trip into the new gem.** The expression is built by
   `workerBootstrapExpression`:

   ```smalltalk
   McpServer prepareWorkerWithToolsets: #('McpBrowsingToolset' 'McpExecutionToolset' …)
     options: nil readOnly: false serverName: nil title: nil version: nil
     frontEnd: 5 cacheName: 'McpServer:5:978EC559'
   ```

   Every string embedded via `printString`, so this cannot smuggle anything into the worker's
   compiler; names are plain identifiers the router already validated. The `printString` is
   load-bearing for the **title** in particular — unlike a name or a version it is free-form
   operator prose, so a quote in it must be doubled rather than closing the literal.
9. **In the worker: `McpServer class>>prepareWorkerWithToolsets:…` — and the order is the point.**
   * `nameThisGem:` **first**, before anything that can fail: a bootstrap that dies on an
     unresolvable toolset is exactly when an operator is looking at the session list.
   * `sessionReadOnly:` **before the build**, so the build can leave gated tools out of the registry
     entirely (§12) — a stronger gate than refusing them on call.
   * `SessionTemps current at: #McpFrontEndSession put:` — where to ring the doorbell when a tool
     reports progress (§6). Constant for this worker's life, so pushed once here rather than per
     request.
   * `newWithToolsetNames:toolsetOptions:` — **tool registration happens now**, at session open, not
     on the client's first request. An unresolvable worker class or toolset therefore fails *here*,
     where the error can say what to fix.
   * `SessionTemps current at: #McpServer put: srv` — **the worker instance lives in `SessionTemps`
     for the life of the gem.** Worth dwelling on: `McpServer class>>currentServer` is the single
     place that answers it, because there are two entries into a worker — a client's request and the
     front end's own maintenance call — and the blind-write ledgers live on the instance, so a
     second instance would be a second set of ledgers licensing writes on the strength of reads it
     never saw.
   * Answers a one-line log string: `McpServer ready: 31 tool(s)`.
10. **Back in the front end: `sess forward: body lifetimeBounds: (self lifetimeBoundsFor: sess)`.**
    → `McpSession>>runWorker:`, which is the one place that drives a worker:

    ```smalltalk
    ^self workerMutex critical: [
      worker nbExecute: anExpressionString.
      self awaitWorkerResult.
      self touch.
      worker lastResult]
    ```

    Three things in four lines, each worth a sentence:
    * **`nbExecute:`, not `executeString:`.** A blocking GCI call blocks in C, so while it ran the
      front-end gem executed *no* Smalltalk and **no `GsProcess` in it ran**: not another client's
      request, not the accept loop, not the reaper, not an open SSE stream's keepalives. Waiting on
      the session's socket suspends only *this* process. Measured: a second client served in ~1s
      while an 8-second call is in flight, where it used to wait the full 8.
    * **The mutex.** GCI allows one call in flight per session; the blocking call used to guarantee
      that by freezing the gem. Now it is explicit, and a client with two requests outstanding
      queues rather than colliding.
    * **Two traps in that API**, both able to corrupt a response silently, both in the method
      comment: the result must be read with `lastResult` (because `waitForResultForSeconds:`
      consumes it internally and a later `nbResult` then fails), and only once `isCallInProgress`
      answers false (because after a wait that timed out, `lastResult` still holds the *previous*
      call's value).
11. The expression sent is `workerExpressionFor:lifetimeBounds:`:

    ```smalltalk
    McpServer handleJsonString: '{"jsonrpc":"2.0","id":1,…}' lifetimeBounds: (Array with: … with: …)
    ```

    Body embedded via `printString`. `lifetimeBounds:` is appended **only when there are bounds**,
    and the one-argument entry point *clears* bounds a previous request left — so an omitted keyword
    means "nothing bounds this session" rather than "no news". The bounds are **values, not a
    sentence**, because the deadline in them is an instant the worker counts down from when it
    answers; and they are carried **on the request** rather than asked for, because the worker
    cannot see the front end's configuration and must not hold a stale copy of it.
12. **In the worker:** class-side `handleJsonString:lifetimeBounds:` → `currentServer` →
    instance-side `handleJsonString:lifetimeBounds:` → `parseBody:` → `dispatcher handle:` →
    `McpJson write:`.
13. `McpDispatcher>>handle:` — the whole protocol router, and small enough to put on one slide:
    `initialize`, `ping`, `tools/list`, `tools/call`, anything starting `notifications/` → `nil`
    (no response), an id-less unknown → `nil`, otherwise `-32601`.
14. `initializeResultFor:` — **version negotiation**: echo the client's `protocolVersion` when
    supported, else answer our latest. `McpDispatcher class>>supportedProtocolVersions` is the
    single source of truth for *both* this and the header check in `protocolVersionAllowed:`, so the
    two cannot drift. Supported: **`2025-06-18`** and **`2025-11-25`**. `2025-03-26` deliberately
    not, because a server on that revision must accept JSON-RPC *batches* and the single-object body
    parser does not. Capabilities: **`tools`, and nothing else.** `serverInfo` name/title/version.
    Plus `instructions` — §7's material, mentioned here so the audience knows where it enters.
15. **The answer comes back over GCI as a `String`, and the front end writes it:**
    `conn writeJson: resp sessionId: sess id` → `MCP-Session-Id: 978EC559…` on the response.
    Every later request must echo it: missing → **400**, unknown/expired → **404** (a compliant
    client then re-initializes).

**Three session ids, and they are not the same thing** — a slide, because the naming section
depends on it:

* the **`MCP-Session-Id`** (128-bit random hex) — the protocol's id, minted by the router,
* the **front-end gem's stone session id** (e.g. 5),
* the **worker gem's stone session id** (e.g. 4, 6) and its host pid.

**Naming the gems.** Every gem here is a `GsTsExternalSession`'s, so without help the front end,
every worker, and any unrelated external session on the stone all arrive called `GciTs` —
indistinguishable in the one column of `System cacheStatisticsForAllSlots` that is supposed to say
who a session is. So each gem names itself:

```
name                     pid     sessionId
McpServer:5:978EC559     43793   4
McpRouter:8000           42435   5
McpServer:5:5ADC62A4     43797   6
```

* front end: `<router class>:<port>`; worker: `<worker class>:<front-end session>:<first 8 of the
  MCP session id>`.
* **The class comes first** in both — the router's own class, and for a worker the class the router
  *told* it to be — so a deployment running a subclass sees that subclass rather than a fixed role
  name that would then be a lie. The two roles stay distinguishable by *shape* too: a front end has
  one `:` field after its class, a worker two.
* The table then answers on its own: the middle field is the front end's session id (so a stone
  running several routers still sorts into servers), and the last is a **prefix** of the id the
  router logs in full, so grepping the gem log for it finds that client's traffic.
* The cache accepts 1–31 characters and raises `OutOfRange` outside that, so a name is **truncated
  rather than allowed to fail a login** — and where the class name and the identifying fields cannot
  both fit, **the identifying fields are kept whole and the class name is cut**. A router shortened
  to `McpRouter:80` would name a port nothing is listening on.
* `System cacheName:` names only the session that *sends* it (there is no `cacheName:forSession:`),
  which is why a worker's name travels *into* the worker with the rest of its bootstrap.

`[DEMO C — 2 min]` The two curls from the README: `initialize` with `-i` to show the
`MCP-Session-Id` header coming back, then `tools/list` echoing it. Then in topaz,
`System cacheStatisticsForAllSlotsShort` showing the new `McpServer:5:…` row that did not exist ten
seconds ago. This is the demo that makes "a session is a gem" concrete, and it is the one to keep if
only one survives.

---

## 5. Trace 2: a follow-up request with a session id (3–4 slides)

Same client, second call. Everything transport-side is the same up to `servePost:`; the interesting
part is what is *different*.

```
POST /mcp   MCP-Session-Id: 978EC559…
{"jsonrpc":"2.0","id":2,"method":"tools/call",
 "params":{"name":"get_method_source","arguments":{"className":"McpServer","selector":"toolsets"}}}
```

1. `servePost:` → not a response, not a cancellation, not `initialize` → `serveRouted:id:
   progressToken:sessionId:on:`.
2. **The session gates live in `serveRouted:`**, not in either of the two methods below it, and they
   have to: a stream cannot be opened before it is known there is a session to serve, or the refusal
   would have to be written into a response already committed to being a stream. Missing id →
   **400**; unknown → **404**.
3. `progressTokenFor:accepting:` decides the **framing** — `nil` → one JSON object
   (`serveCall:`), non-nil → an SSE stream (`serveStreamedCall:`, §6). Trace 2 takes the `nil`
   branch; say the other exists and move on.
4. `serveCall:` → `sess forward: body lifetimeBounds: … requestId: anIdOrNil`. The `requestId` is
   remembered **for exactly as long as the call runs**, so a `notifications/cancelled` naming it can
   be matched to it — and cleared in an `ensure:` **at both ends**, because a flag outliving its call
   would end the *next* one, and a cancel can arrive in the instant between a call finishing and the
   clearing.
5. `runWorker:` as in Trace 1 — **non-blocking**, so this is the slide where "clients really do run
   concurrently" is a fact rather than a claim. Two guarantees that the blocking call had been
   providing *by accident* are now explicit: the per-session mutex, and the reaper skipping any
   session with a call in flight (`McpSession>>isBusy`) instead of logging a worker out mid-request.
6. **In the worker: `McpDispatcher>>handleToolsCall:id:`** — this is the slide to spend time on.
   * `params.name` missing → **`-32602`** `invalidParams`. Unknown tool → **`-32602`** `notFound`.
   * A **read-only gated** tool → `-32601` with `data.kind = "readOnly"` — deliberately *not*
     `notFound`, so a client can tell "exists but forbidden here" from "no such tool".
   * **Schema enforcement:** `tool validationErrorFor: args` → `McpTool>>validationErrorFor:`.
     Structural, and honestly so: with `additionalProperties: false` it rejects unknown top-level
     keys naming the allowed ones, and it requires every `required` key. **No deep type checks.**
     Schemas are JSON Schema 2020-12, closed with `additionalProperties: false`, and no `$schema` is
     needed.
   * **Two different failure envelopes**, and this is a protocol point worth making to an audience
     that will write tools: per MCP 2025-11-25, a malformed *request* (missing name, unknown tool)
     is a **protocol** error `-32602` — the model is unlikely to recover — while arguments that
     violate the **tool's own** `inputSchema` come back as a **tool execution error**
     (`isError: true` in the *result*), because they carry actionable feedback the model can use to
     self-correct and retry. Before 2025-11-25 both were `-32602`; only the envelope changed, and
     the check still runs **before** the tool is invoked, so a rejected call still has no side
     effect.
   * **`THE VIEW. NO TOOL REFRESHES IT.`** — the method comment's own capitals, and the hinge for
     §7. A session sees one consistent snapshot until the client itself asks for another. This is
     not an omission; it is the guardrail. Two earlier designs did refresh — first with
     `abortTransaction` before every tool, then briefly with `continueTransaction` — and both were
     wrong for the same reason.
   * `tool callWith: args` → the handler block → `contentText:isError:` → **`annotateContent:`**,
     which appends the `[session]` line (§7). Applied to **both** the success and the error
     envelope, because a tool that raised is exactly when dirty state most needs reporting; and
     computed from the state left **after** the tool ran, not the state the call arrived in.
7. `McpJson write: response` → the JSON string → GCI → `conn writeJson:`. A notification's empty
   answer becomes **`202 Accepted`** with no body.

**`McpJson`, and the kernel bugs it works around** (1–2 slides; this audience will care most about
this section and may want to fix the underlying defects):

* **Out.** `McpJson class>>write:` replaces `Object>>asJson` and answers a **byte `String` of
  UTF-8**. Why it had to be owned rather than patched: `CharacterCollection>>printJsonOn:` keeps
  only bits 12–15 of a codepoint above U+FFFF instead of emitting a surrogate pair, so `asJson`
  renders U+1F600 as the escape `\uF600` — silently the wrong character — and for some codepoints emits a
  **lone surrogate**, which is not well-formed JSON. By the time `asJson` has answered, the
  codepoint is gone, so no post-pass can repair it. The choices were to patch a kernel method (lost
  on an extent reload, and it changes behaviour for every other consumer in the image) or to write
  JSON directly.
* Writing **UTF-8** does not fix that arithmetic so much as never reach it: a surrogate pair is an
  artefact of `\u` escapes and of UTF-16, and UTF-8 spells an astral codepoint directly in four
  bytes. Only what RFC 8259 §7 requires is escaped — quote, backslash, C0 controls.
* **Bytes rather than characters is load-bearing**, and three unrelated mechanisms downstream depend
  on it: `Content-Length` is written as `body size`; the worker → front-end hop is measured in bytes
  by the kernel's result fetch, whose **buffer is sized in bytes**; and `MCP_TRACE` writes bodies
  through `GsFile`, where a 16-bit string comes out garbled. A byte `String`'s `#size` *is* its byte
  count whatever the bytes are, so all three hold by construction.
* **In.** `McpBase class>>parseBody:` is
  `JsonParser parse: (self combineSurrogateEscapesIn: aString asString decodeFromUTF8 asString)`.
  Both `asString`s earn their place and the comment says how: the **leading** one because the body
  does not reach the worker as the bytes the socket read — the front end forwards it embedded in an
  expression and the worker **compiles** that literal, so its class comes from the worker's
  `#StringConfiguration`, and a `Unicode16` (what an accented body compiles to on any Grail image)
  does not understand `decodeFromUTF8` at all; the **trailing** one to narrow the
  `Unicode7`/`16`/`32` back into the byte-string family, since a `Unicode7` compared to a `String`
  raises on a stock image rather than answering false.
* **`combineSurrogateEscapesIn:`** is the one repair made before the parser sees the text. Kernel
  `JsonParser` sends `Character codePoint:` to each `\uXXXX` escape separately and 3.7.x refuses to
  build a surrogate, so an emoji written as the surrogate **pair** RFC 8259 prescribes failed the
  whole request with `-32700`. That is a real client, not a hypothetical: Python's `json.dumps`
  escapes by default. Forty lines at the edge, where the outbound defect needed a whole writer —
  because inbound the information is still there in the escapes.
* A malformed sequence — truncated, overlong, an encoded surrogate — **refuses the whole body** with
  a `-32700` naming the byte offset, rather than being repaired into stored text.
* **What is deliberately left broken, and it is a filed report rather than a grumble.** The
  measurements live in `kernel-json-unicode-bugs-3.7.6.md` — checked against **3.7.6** (build
  38a5ad8f, stock `extent0.dbf`, linked topaz, Linux x86_64), every result a live measurement, with
  a copy-pasteable reproduction block and a suggested fix per defect. **Put this table on the slide
  and offer the document**; it is the concrete ask of the talk (§13):

| # | Defect | Where | Effect |
|---|---|---|---|
| 1 | no surrogate-pair **decoding** — every `\uXXXX` becomes one `Character` | `JsonParser>>string` | a surrogate escape reaches `Character codePoint:` and raises `OutOfRange` (2723); **no astral character can be sent escaped** |
| 2 | no surrogate-pair **encoding** — a code point above U+FFFF is written as one escape of its low 16 bits | `CharacterCollection>>printJsonOn:` | U+1F600 → `\uF600`; U+10000 → `\u0000` (NUL); U+1D800 → a **lone surrogate**, which is ill-formed JSON. No error |
| 3 | an unrecognized escape is silently dropped | `JsonParser>>string` | `{"a":"\x"}` parses to `'a' -> ''`; RFC 8259 §7 admits exactly eight escapes |
| 4 | the four characters after `\u` are not checked to be hex | `JsonParser>>string` | `\uZZZZ` becomes U+0000, because `'16rZZZZ' asNumber` is 0; a truncated `\u12"}` ends in `ArgumentTypeError` (2094) |
| 5 | lesser leniencies and error quality | `parse:`, `string`, `_value` | trailing content after the value ignored; raw control characters accepted inside strings; empty input fails `MessageNotUnderstood`, unterminated input `ArgumentTypeError` — neither a JSON error |

* **Two of the five are silent data corruption on a public API** (2 and 4), one is refused with an
  exception far from the cause (1), and two accept what is invalid (3, 5). Defect 1 is the one with
  a named real client behind it: **Python's `json.dumps` escapes by default**, so an emoji from any
  such client failed the whole request until `combineSurrogateEscapesIn:` existed.
* **The one API note that is not a JSON defect**, and worth mentioning because it is the reason for
  that leading `asString` above: `decodeFromUTF8` is implemented on `String`, `ByteArray` and
  `Unicode7` **only**. `Unicode16`/`DoubleByteString`/`Unicode32`/`QuadByteString` answer
  `MessageNotUnderstood` (2010) *even when every code point in the receiver is below 256 and the
  receiver therefore holds exactly the bytes the method is for*. Such a receiver arises whenever
  source containing bytes ≥ `16r80` is compiled in a session whose `#StringConfiguration` is
  `Unicode16` — which is exactly what happens to the request body on any Grail image. `asString`
  narrows it losslessly, but nothing in the API says so.
* `McpJson writeUtf8CodePoint:on:` is checked against an **oracle**: `McpJsonTest` requires it to
  agree with the kernel primitive `String>>encodeAsUTF8` for **every** codepoint, including both
  sides of all three sequence-length boundaries. Nothing in the kernel emits a *correct* JSON escape
  for an astral codepoint, so an escaping writer's surrogate arithmetic would have had no second
  opinion available to it.

**Summary slide for §4–5:** the whole chain on one page, front end above the line and worker below,
with the GCI hop drawn as the only thing crossing it. Reuse this diagram in §6 and §8 with one arm
added each time.

---

## 6. Progress notifications (2–3 slides)

Not exciting in itself; here because it is the only mechanism that reaches from a **worker** back to
a client mid-call, and it shares the stream machinery that timeouts and idle probes use.

* **Why a worker cannot write to its own client.** A worker gem is a separate OS process, and the
  client's socket was accepted by the **front end's** process. A file descriptor means nothing
  outside the process that owns it, and GemStone exposes no way to pass one. So a tool rings a
  doorbell the front end is listening at: `System sendSignal:to:withMessage:`.
* **The client opts in unilaterally.** `progressToken` in `params._meta` on a `tools/call`. No
  capability, no `initialize` field, no per-tool annotation in either revision — so a client cannot
  lose the ability by failing to notice something this server declares. *Claude Code has sent a
  token on every single `tools/call` since it first connected* (measured 2026-08-27), and for a
  while the server read none of it: **it was handed an explicit opt-in on every call and threw it
  away.** Worth saying, because it is the exact mirror of the retired idle warning (§8), where the
  server *sent* what no client would read. One feature failed by not listening and the other by not
  being listened to, and both were settled by measurement rather than by reading the spec harder.
* **It is the one scenario where the draft revision and `2025-11-25` agree**, so unlike everything
  else on this subject, building it was not a bet on an era: `notifications/progress` is a *basic*
  utility, carries no deprecation notice, and is request-scoped in both — and the response-stream
  shape it needs is the shape the draft is converging on everywhere else.
* **Two payoffs worth naming as open measurements rather than claims.** The Claude Code transport is
  configured `timeoutMs: 60000`, and *some* MCP clients reset that timer on each progress
  notification — if this one does, progress is not a nicety but the fix for long GemStone jobs being
  cut off client-side, which a full Grail suite run blows straight through. **Not yet tested; say
  so.** And in the draft, closing a request's response stream **MUST** be treated as cancellation of
  that request — a per-request, normatively defined signal, which is a better answer to the runaway
  tool than any deadline this server could invent (§8).
* **The framing must be chosen before the worker is called**, which is why
  `progressTokenFor:accepting:` lives in the front end and is the one place `McpRouter`
  deliberately parses more of a body than routing needs: the `Content-Type` of the answer is
  decided before there is an answer. Three conditions: it is a `tools/call`, it carries the token,
  and the `Accept` header offers to take a stream.
* **The path** (draw it as the §5 diagram plus one arrow each way):
  1. `serveStreamedCall:` writes SSE headers, then `registerChannelForToken:session:` → an
     `McpProgressChannel` in the router's `callId → channel` map.
  2. `forward:…progressCallId: callId whileWaiting: [self drain: channel to: conn]`. The
     `whileWaiting:` block runs after every wait for the worker, **in the process answering the
     request** — because the socket belongs to this connection and exactly one process may write to
     it.
  3. The expression sent becomes two statements: `McpServer progressCallId: 17. McpServer
     handleJsonString: '…' lifetimeBounds: (…)`. Two statements rather than a fourth keyword,
     because bounds and progress are independent facts and a client can ask for either, both or
     neither.
  4. In the worker, `progressCallId:` installs an `McpProgressReporter` in `SessionTemps` under
     `#McpProgress`, addressed to the front-end session pushed down at session open. Tools reach it
     through `McpToolset>>progress:of:message:`, which **does nothing at all when there is none** —
     so a tool called from topaz, or by a client that asked for no progress, behaves exactly as it
     always did.
  5. `forkSignalPoller` drains: `InterSessionSignal poll` in a loop until empty →
     `acceptWorkerSignal:` → parse the payload → `channelAt:` by **callId** → `noteProgress:` →
     queue a `notifications/progress`.
  6. The wait loop drains the channel to the socket; then one last `drainWorkerSignals` before the
     channel is unregistered, then the answer.
* **Three pieces of judgement the reporter carries so tools need not**, and each has a measured
  reason:
  * **Rate limit** (`minIntervalMilliseconds`). The Stone-side queue holds **50** messages per
    session and raises `SignalBufferFull` **in the sender** on the 51st, shared across every worker
    signalling one router. A per-test tick from a 5372-test suite would blow through that in the
    first second. The limit is not politeness.
  * **Strictly increasing**, required by the spec, refused **twice** — at the reporter and again at
    the channel — because the reporter runs arbitrary tool code and the channel is the end that owes
    the client a conforming stream.
  * **Unfailable.** Every send is wrapped and `SignalBufferFull` is an *expected* outcome, not a
    defect: the buffer being full means the front end has not drained yet, and the right response is
    to drop the tick. A progress notification that failed a five-minute test run would make the
    server strictly worse than one that said nothing.
* **The last tick.** The worker sends its final tick and returns in the same breath, so that tick is
  still in the Stone's queue when the call's `ensure:` forgets the channel — and the poller, up to
  `signalPollMilliseconds` later, then finds nowhere to put it. **Every reported call lost its last
  step that way**, which is the one saying the work is finished. Hence the explicit
  `drainWorkerSignals` before the unregister. Good slide: a bug that only exists end to end.
* **Nesting, and the depth counter.** `handleJsonString:` nests — a tool that runs a test suite can
  run tests that themselves send `handleJsonString:`, and mcp_server's own suites do exactly that.
  The first version cleared the reporter on the way out, so the first nested call wiped the reporter
  its *caller* was still reporting through. Fixing that revealed the other half: the nested call
  then reported *its* progress on the outer call's stream — observed as a client told
  `1/1 test classes` by a call working through six. So: at depth 1 the reporter is the front end's
  and is left alone; deeper, it is taken away for the duration and given back on the way out. A
  nested tool call reports nothing, which is right — nobody asked to be told about it.
* **Where progress may travel, and the spec tightening to mention:** `notifications/progress` is
  **request-scoped** in every revision, and the draft bars it from the long-lived stream outright.
  So the standalone `GET` stream is the wrong connection for it, however convenient its drain loop
  looks — which is why `McpProgressChannel` exists beside `McpOutbox` rather than reusing it. The
  two present the *same* queueing protocol on purpose (`add:`, `drain`, `takeDroppedCount`, `size`,
  `isEmpty`), so `McpRouter>>drain:to:` writes either onto a socket without knowing which it has.
* **The other stream, in one slide, since timeouts and reaping ride it (§8):** `GET /mcp` opens the
  standalone server→client SSE stream for a session; `McpOutbox` is its per-session FIFO, bounded at
  256, dropping oldest and recording the gap in the gem log; keepalive comment every 15s; **both
  directions guarded** — every frame waits on `writeWillNotBlockWithin:` first because
  `GsSocket>>write:` suspends with **no timeout**, and each 100ms tick polls the read side without
  blocking, so a client that vanishes is noticed in ~100ms. A newer GET **supersedes** the previous
  stream (stream *generations*), and the older one ends on its next tick.

`[DEMO D — 90s]` A `tools/call` carrying a `progressToken` against a long tool (`run_test_class`
on a big suite), with `curl -N` showing the `notifications/progress` frames arriving on the response
stream and the result as the final frame. Contrast with the same call without the token: one JSON
object.

---

## 7. The transaction model and the blind-write guardrail (14 slides; the second centrepiece)

**This section is cut, and `docs/slides/deck.md` is the authority for it** — the running order
below is a summary of that file rather than a plan for it, and where the two disagree the deck is
right. It was rebudgeted to **11:10 (490s of slides + a 180s demo)** against the 9:30 this outline
first guessed; §6 and §10–11 gave up a minute between them.

Three things moved out of the slides and into the speaker notes while it was being cut, and all
three are better there — they are evidence for a claim rather than the claim:

* **the measured seven-line trace** of the silent clobber → notes on slide 5, where the picture
  makes the claim and the trace backs it;
* **the four-way refresh measurement** → notes on slide 6, for the same reason;
* **"why this never needed to exist before"** stopped being a slide at all: its blockquote is now
  the closing line of slide 5, and its argument is that slide's notes.

### The running order

| | slide | s |
|---|---|---|
| 1 | section opener — *A browser invariant, restored by rule* | 10 |
| 2 | **the instructions, verbatim** — all 551 words of `defaultServerInstructions` | 50 |
| 3 | **what the `[session]` line actually looks like** — four real examples | 35 |
| 4 | **a human at a browser** — the stone's guard works (diagram) | 40 |
| 5 | **an agent** — the same guard, walked past (diagram) + the browser invariant | 90 |
| 6 | **"so make every tool self-contained: abort, write, commit — in one pass"** | 45 |
| 7 | why the repository does not catch it — and is right not to | 30 |
| 8 | two consequences: the class grain, and laundering a read but not a write | 25 |
| 9 | the rule, the ledgers, the stamp | 40 |
| 10 | what licenses what | 35 |
| 11 | re-validation, and what the client is told when the view moves | 40 |
| 12 | full disclosure: `execute_code`, and three limits | 30 |
| 13 | keeping the measurements honest | 20 |
| 14 | `[DEMO E]` two clients, six calls | 180 |

### What each one is for

**2 — the instructions, verbatim.** All 551 words on one slide, in two columns, with the five
ALL-CAPS headings in the accent colour. The body is a **prop**: the back row reads the headings and
nothing else, which is the intent — the headings are the argument and the point is that the whole
thing *fits on one slide*. Walk them in order; the one to dwell on is `THE DATABASE PROTECTS YOU`,
because its closing instruction to the model — *"If you read something, thought about it, and are
only now acting, re-read it first"* — exists because of the failure two slides later. Extract the
text programmatically rather than transcribing it (`McpServer class>>defaultServerInstructions`);
a read-only session is sent none of it.

**3 — the `[session]` line.** Four of the five shapes, verbatim: uncommitted work; the client's own
commit refused; the server's refresh having doomed the pending work; and reads gone stale. Read the
middle two back to back — same jam, two causes, and *the client must not be told the wrong one*.
Keep the one structural note: **computed from the state left after the tool ran**, which is what
lets `abort` answer with no contradicting warning stapled to it.

**4 and 5 — the matched pair, and the heart of the section.** Same lane geometry, same x-positions
for S2's commit and S1's final commit, one difference: **where the view move falls relative to S2's
commit.**

* On **4**, S1 aborts *first*, S2 then commits, S1 edits X, S1's commit is **refused**. Drawn in
  green, because the guard working is a good outcome and not a warning. `edit X` is one mark like
  every other event on the line — for a human at a browser, editing a method *is* one event, and
  **the split is the next slide's reveal, so do not decompose it here.**
* On **5**, S1 reads X, S2 commits, *then* S1 aborts — so S2's commit is behind the view move, and
  S1's write commits cleanly over it. The stone is right: as far as it can tell, S1 saw the change
  and chose to overwrite it. It closes on the blockquote that used to be its own slide, and gets 90
  seconds because it is the one idea in the talk that is about this audience's history rather than
  about this code.

**6 — "one pass", and the laugh.** Frame it as the sensible thing to build: if every tool takes a
fresh view in and commits on the way out, no tool can ever fail on a stale view. Tools that always
work. *Then* say it was the first design here — `handleToolsCall:` ran `System abortTransaction`
before **every** tool, and each mutation tool committed inside its own call — and land on
**"including the `commit` tool."** Pause before the punchline: `commitTransaction` answers **true**
because committing nothing succeeds, so the tool reported *"Transaction committed."* while the
probe it was supposed to save was already gone. A commit that can never fail, achieved by never
committing anything. `refresh` had it in miniature, being the same two lines as `abort`.
The serious half is in the notes: **a blanket pre-call refresh makes every write a blind write by
construction**, which is what the four-way measurement shows.

**7 and 8 — the mechanism the stone actually has.** `writeWriteConflicts = writeSet *
writeSetUnion`; no timestamps, no per-object versions, only the view is dated; so it has no opinion
about what you read. Then the two consequences that shape the rest: **class grain** (so a client can
be refused over a method it never touched) and **a view move launders a stale read, never a stale
write**. Be explicit that the `StrongReadSet` would close the read side and was declined, and why.

**9 to 12 — the solution, and its limits.** The rule and the four key grains; the SHA-256 stamp per
grain; the read/write licence table; re-validation at every view move and the one-time `[session]`
line whose **count** is the point; then `execute_code` outside the guardrail, why that cannot be
closed, the three observability failures behind "how many `execute_code` calls happened in the
window", and the three known limits.

**13 — how it is kept honest.** Two suites, deliberately different in kind, and the test written to
**fail on good news** — which, as of 2026-09-10, is doing exactly its job on an unsupported image
(§12).

`[DEMO E — 3 min, the one to rehearse]` Two clients, staged live:
1. Client A: `get_method_source` on a fixture method, then `compile_method` a change — uncommitted.
2. Client B (topaz, second gem): commit a different change to the same class.
3. Client A: `commit` → **refused**, `[session]` names the conflicting **class**.
4. Client A: `abort` → the `[session]` line names **which reads went stale**.
5. Client A: `compile_method` again without re-reading → **refused, `kind: blindWrite`**, with the
   call that licenses it named.
6. Re-read, recompile, commit → accepted.

Steps 1–3 are slide 4's refusal reached the agent's way; steps 4–6 are slide 5, except that step 5
is where this server stops and the bare stone would not. Six calls, and step 5 is the moment the
audience sees why the browser invariant had to be restored by rule.

## 8. The router maintenance cycle (11 slides, two of them diagrams)

**This section is cut, and `docs/slides/deck.md` is the authority for it** — the running order below
is a summary of that file rather than a plan for it, and where the two disagree the deck is right.
It was rebudgeted to **7:10 (340s of slides + a 90s demo)** against the 6:30 this outline's table
first allowed; see the preamble for where the extra 0.7 talk minutes have to come from, because it
is a decision and not a rounding.

**The thesis, and every slide serves it:** the front end is the only part of this server with a
heartbeat, so every judgement about *time* is made there — and it is made by **counting evidence
this front end observed** rather than by measuring elapsed time. Two mechanisms were *deleted* by
adopting that rule. That is the strongest thing the section has to say and the reason slide 3 is the
one to protect.

Six things moved out of the slides and into the speaker notes while it was being cut, on the
principle §7 settled — a **measurement is evidence for a claim, not the claim**:

* **the 96%-over-one-night suspend-detector result** → notes on slide 3, where the rule makes the
  claim and the result backs it;
* **the four-way commits-behind measurement** (9 → 18 under a live call, then 161 → 202 after one
  `install.sh` and one test run, and the front-end gem 489 behind) → notes on slide 7;
* **`StnCrBacklogThreshold` comes back already resolved** — 80 against a `StnMaxSessions` of 10,
  where resolving `-1` ourselves would have computed 20 → notes on slide 6;
* **the zero-filled `descriptionOfSession:` of a dead gem** → notes on slide 6, which is where a
  Q&A magnet belongs rather than on a slide nobody asked the question about yet;
* **the `endedCall*` / `isEndedCallKind:` defect story** → notes on slide 8;
* **request deadlines and cancellation, in full** → notes on slide 8. The outline put them in this
  section because they share the escalation; at this budget they are the first thing that cannot be
  slides. **If §8 is ever given another minute, this is what to spend it on.**

### The running order

| | slide | s |
|---|---|---|
| 1 | section opener — *One gem with a heartbeat, counting what it saw* | 10 |
| 2 | **the pass** — four steps, and the order is the point (diagram) | 35 |
| 3 | **almost nothing here is measured in elapsed time** | 45 |
| 4 | `reapReasonFor:` — the whole policy, ordered by **kind of evidence** (table) | 40 |
| 5 | an answered ping proves the client is there — **and still counts against it** | 35 |
| 6 | how the front end can see any of this — `descriptionOfSession:` 7 / 8 / 16 | 30 |
| 7 | **view hygiene: one ground**, and the `kept` / `doomed` / `stuck` verdict | 45 |
| 8 | the two disruptive arms take pressure as a **conjunct**, never an alternative | 35 |
| 9 | the ending *not* in the ladder: a worker gem that has **died** (diagram) | 35 |
| 10 | `maxSessions` — the one bound here that **refuses** rather than releases | 30 |
| 11 | `[DEMO F]` view hygiene, live | 90 |

### What each one is for

**2 — the pass, and the only diagram that had to be a diagram.** Four boxes in order, the loop back
labelled `reaperIntervalSeconds (60)`, and two brackets carrying the two claims the ordering makes:
**step 1 first**, so everything after it reasons about the repository as it is *now* rather than as
it was when this gem logged in (and, the same act from the other side, so a committed recompile of
front-end code takes effect here); **step 4 last**, so a session found gone while probing is freed in
the *same* pass rather than a minute later. Underneath, the per-session line that is the whole
clock: `notePassWithStream:` **first and unconditionally**, before the busy test and before the
no-stream test — the pass *is* the observation. Then busy → skip, no stream → skip the ping but keep
counting, probe due → ping.

**3 — the thesis, and the slide to spend time on.** Idleness is a count of **pings answered with no
work in between** (fifteen at the defaults); unreachability is a count of **passes with no stream**;
and a ping is **never declared late by a clock** — it is superseded by the next one and judged at
that moment. Every count advances only while the front end runs, so a suspended host **stops the
count where it was**: no suspend to detect, nothing to forgive, no threshold to get wrong. Land the
closing blockquote as the point: two mechanisms were **removed** by this rule rather than fixed —
the suspend detector, and the pass that timed out server-initiated requests. Not *"we fixed the
suspend detector"* but *"there is no suspend left to forgive."* The 96% night is in the notes, and
the reason it could never have been tuned out is the part worth giving: the error term was set by
somebody else's power management.

**4 — the ladder.** Seven rungs, and what to point at is the **third column** — what kind of claim
each rung makes — not the individual numbers. Rung 0 first, because somebody is already composing
the objection: a call in flight is **never reaped on any ground, however long it has run.** Then the
two deliberate exceptions to the counting rule, for opposite reasons: an **expiry** is wall-clock
because a credential is, and a **closed stream** is one observed fact that needs no repetition. The
detail worth having for this audience is rung 5's **strictly-greater** comparison where the others
use `>=`, and that it has two independent reasons — it makes a configured grace a *floor*, and it
makes a grace of **zero** mean what it says with no separate evidence test.

**5 — the ping that proves life and still counts against you.** Three bullets that are one decision,
and the audience may push on it, so lead with the reason rather than the mechanism: **the ping is how
idleness is measured, so an answer cannot also reset what it is measuring.** Otherwise the idle
deadline is unreachable for every conformant client — and they all answer `ping`. The bottom half is
the subtlest thing in the section: an unanswered ping is evidence of death **only if it went down
the stream the client is still on**, a write into the superseded stream *succeeds* into a buffer
nobody will read, and a handover is likeliest on exactly the quiet sessions the reaper probes — so
the population being judged is enriched for the thing that breaks the judgement. **6 of 14 pings**,
measured, is the answer to "is this theoretical".

**6 — the instrument, which no other audience would want.** `System descriptionOfSession:`,
primitive 334: a **stone query** made from the front-end gem about *another* session. The structural
point is the first bullet, because it is what makes the busy case tractable at all — the
**measurement** is a stone query and cares nothing for what the worker is doing, while the **action**
would have to travel the worker's GCI channel, which allows one call at a time. So a session with a
call in flight is measured every pass and acted on never. That asymmetry is not a workaround; it is
the reason the arm can exist.

**7 — one ground, and the route that was wrong twice over.** Two things to land, and the second is
the one they will argue with. First **`doomed`**, which is what makes the whole arm defensible and
connects straight back to §7: the kernel carries the write set forward across `continueTransaction`
and answers whether it *now* conflicts, so refreshing a worker's view **cannot launder a write that
was going to be refused**. Without that, this arm would be the blind write §7 was about, performed by
the server on the client's behalf. Then the deleted second route, both halves measured: a high
backlog is **not evidence that anybody is behind** (the stone defers disposing records nobody
references — which is the deferral `StnCrBacklogThreshold` exists to override), and right after a
restart **every** session reports holding the oldest record. Together they made that route fire
hardest in exactly the state where refreshing achieves nothing.

**8 — the two disruptive arms.** Open with the last line, not the mechanism, because it is the
objection the slide exists to answer: **on a quiet repository a long call is never ended, however
long it runs.** Then the conjunctions — four for reaping a stuck view, five for ending a pinned call —
and the point that pressure is always a **conjunct**, never an alternative. The two mechanism details
are load-bearing and easy to get wrong: the reaper only ever **sets a flag** (the ending is done by
the process that owns the worker mutex, on its next wait), and it uses **`tryLock` not `critical:`**
and **no `touch`** — `touch` would be an immortality potion. The live firings, the `viewRelease`
defect story, and the whole of request deadlines and cancellation are in the notes.

**9 — the ending that is not in the ladder, and the second diagram.** The drawing exists to make one
thing visible that prose has to assemble: a **live client answering every ping** in front of a **dead
worker gem**, so every ground in `reapReasonFor:` says *keep* — and **the ladder is not wrong, it is
answering a different question correctly.** Only the front end knows the state of its own workers,
which is why both halves of the fix are in `McpRouter`. Say what the old behaviour cost: a generic
`-32603` inside a healthy HTTP 200 meant *"something went wrong at our end"*, so a **well-behaved**
client retried forever and never re-initialized — being well behaved was the thing that trapped it.
Recognition is the GCI **fatal band**, 4000–4999: the kernel's own verdict, and matching the band
rather than either number is what keeps it from being a list to maintain.

**10 — `maxSessions`, and end the section here.** It is the failure most likely to bite somebody in
this room and the one slide whose answer is *"we refuse"* rather than *"we measure"*. The lockout is
the part to land, and it is not that the tenth MCP client fails — it is that the tenth login **of any
kind** fails, so the person who owns the extent cannot get in with topaz to find out why. Then: it
takes no carelessness, because **reconnecting counts as a new client**; three is deliberately low;
and the two halves work together — the idle rules mean a stranded gem goes away on its own, and the
cap means the stranding cannot pile up faster than they go.

`[DEMO F — 90s, hard stop]` `MCP_MAX_COMMITS_BEHIND=2 MCP_REAPER_INTERVAL=10s ./run-server.sh`
1. One client **reads a method** — nothing committed, view taken.
2. A second gem **commits three times**.
3. Wait one pass — the gem log writes `view hygiene: session ... is 3 commits behind`.
4. Any tool call: the **`[session]`** line says the server refreshed the view, and **names what went
   stale**.

The point is step 4, not the log line: the client is **told**, on its next result, in the same
`[session]` channel §7 introduced, and the stale reads are named. Everything before it is staging.
Rehearse the fallback — this depends on a second gem committing on cue *and* on a pass landing where
you want it, which is two timing dependencies on stage, and a gem-log screenshot plus the `[session]`
line is all the evidence anyone needs.

## 9. `McpAuthRouter`: a reachable port (3 slides)

* **Why 3.7.6.** `src/auth` needs `JsonWebToken` and `JwtSecurityData`, and — to log a worker in —
  `GsTsExternalSession>>jwtPassword:`; none exist before 3.7.5, and on an earlier image those methods **cannot
  compile at all**, which is why `install.sh` probes the image and leaves the group out. **3.7.6 is
  a separate matter: earlier releases have a bug connecting to an *external* OIDC IdP** — i.e.
  loading an external IdP's OIDC configuration so the stone can start at all. That is the dependency
  to state plainly, and it is the one thing in this talk that is a straight ask of the room.
* **Three invariants that distinguish the subclass**, all enforced in code rather than by a launch
  script, because `runOnPort:`/`forkOnPort:` can be called directly:
  1. **`bindAddress` is configurable here** (the base class answers loopback with no setter) —
     because every request must present a valid bearer token. Still *seeded* to loopback:
     reachability is something the caller asks for.
  2. **TLS is mandatory.** A bearer token is a password that travels in a header on **every**
     request, so cleartext is never appropriate — not even on loopback, since a router that is safe
     today becomes unsafe the moment its bind address is widened.
  3. **The resource-server config is mandatory**: `expectedAudience` and at least one https
     authorization server, or it refuses to run. The MCP authorization spec makes audience
     validation and naming an authorization server **MUSTs**, so they cannot be optional settings
     that default to off — an unconfigured router would accept a token minted for any resource and
     publish a metadata document naming nowhere to get one.
* **Every request carries the token, not just `initialize`.** The gate is `requestAuthorized:on:`
  (the base-class hook from §4): verify the **signature** against the stone's trusted JWT keys, then
  the RS-layer claim checks — `exp` (required), and where configured issuer, audience (RFC 8707) and
  required scopes. A request naming an existing session must also present a token belonging to
  **that session's user**. One exception: the Protected Resource Metadata endpoint is
  unauthenticated **by design** — it is what a client reads in order to learn how to authenticate.
  * Say why it changed: **the `MCP-Session-Id` is not a credential.** It once was — `initialize`
    alone was authenticated and the id admitted every later request — which meant an expired or
    revoked token kept working for as long as the session was kept alive, and the GET stream and
    DELETE needed no credential at all.
* **The login.** On `initialize` the router derives the GemStone userId from a configurable claim
  (`userIdClaim`, default `sub`; typically `preferred_username` on Keycloak) and opens the worker via
  `McpSession>>startWithId:user:jwt:` → `worker username:`, `worker jwtPassword:`, `login`. **GemStone
  re-validates the JWT at login** — signature against its trusted keys, plus the user's
  `JwtSecurityData` — so a bad or expired token fails the login. Missing/malformed/forged/expired/
  wrong-audience → **401 `invalid_token`**; missing a required scope → **403
  `insufficient_scope`**; `WWW-Authenticate: Bearer` with `error`/`error_description`/`scope`/
  `resource_metadata` on both.
* **What the maintenance loop adds: the token is the real bound.** Every session is capped at its
  access token's own `exp`, whatever the idle policy says — the worker gem *is* logged in as that
  token's user, so a session outliving its token would leave the authorization it was opened with in
  force after the grant expired. **An expiry is never probed around and never forgiven**, and it is
  one of only two wall-clock grounds in the reaper.
* **And the cap is on the grant, not the session:** a request bearing a **refreshed** token for the
  same user extends the session to the new token's `exp` (`renewSessionExpiry:from:` →
  `McpSession>>renewExpiryTo:`). Without this, a client working steadily had its worker gem torn
  down and its uncommitted transaction lost **one access-token lifetime after opening**, however
  recently it had called — because activity feeds the *idle* clock and the idle clock is not what
  ends an authenticated session. Refreshing sooner would not have helped: the renewed token was
  never consulted about lifetime. **That is silent data loss, not an inconvenience** — the client
  obtains a new token, opens a new session, and nothing looks broken.
  * Two boundaries kept, and worth stating because they are why it is a separate selector rather
    than a relaxed ratchet: a **nil** `exp` moves nothing (a token with no readable expiry cannot
    turn a bounded session unbounded), and a session with **no** deadline is left alone (renewal
    extends a deadline, it never introduces one). A read-write session is **not** extended by a
    token that has lost the write scope: that token keeps working, buys no time, and the next session
    opens read-only.
* **The `offline_access` deviation** — a slide of its own, because it is a deliberate, documented
  departure from a `SHOULD NOT` and this audience should hear the reasoning rather than find it in a
  test comment.
  * **The rule:** MCP SEP-2207 (status **Final**, so it binds independently of which revision we
    claim) says servers **SHOULD NOT** include `offline_access` in the `WWW-Authenticate` scope or
    in `scopes_supported`, since refresh tokens are not a resource requirement.
  * **What forces the deviation is a pair of conditions**, neither of them ours: a client that
    **appends `offline_access` to its authorization request on its own**, plus an authorization
    server that **rejects a request naming a scope that client was never assigned**. Keycloak and
    Authelia reject *before any login page*; others silently narrow the grant and need none of this.
  * **Keycloak compounds it:** an RFC 7591 dynamic registration carrying a `scope` field
    **replaces** the realm's default client scopes. So the resource **advertising** the scope is the
    only mechanism by which a dynamically-registered client ever comes to hold it — and omitting it
    **breaks the browser login outright** rather than merely shortening sessions. (Same mechanism is
    why `profile` is advertised: `userIdClaim` is `preferred_username` and `profile` is the scope
    that emits it.)
  * **Two exits tried, neither available.** Pinning the requested scopes **client-side** was tried
    and **failed** (2026-08-20): the client kept appending `offline_access` regardless, so a fresh
    authorization still produced an offline session. Nothing **server-side** substitutes either —
    client registration policies only validate a registration, protocol mappers only emit claims;
    neither can *assign* a client scope. The remaining candidate is **CIMD** (Client ID Metadata
    Documents), where the client is identified by a URL serving its own metadata and there is no
    registration record to have its scopes replaced — untested, and dependent on both the client and
    the AS supporting it, so it cannot be the documented answer yet.
  * **How the deviation is kept honest:** `McpAuthConformanceTest` asserts the rule against a
    `conformantRouter` **fixture** — a router is spec-clean unless an operator opts out — and the
    geode test deployment opts out via `MCP_EXTRA_SCOPES`, **knowingly**. The conformance suite is
    one test per normative requirement, and the untested known gap is named too: the draft's *scope
    hierarchies* MUST, which exact-string comparison satisfies only while all configured scopes are
    flat and unrelated (true of `mcp:use` / `mcp:write` today).
* **`supportedScopes` is derived, not configured** — the union of `requiredScopes`, `writeScope` and
  `extraScopes` — so a required scope is always advertised and the write scope is always requestable,
  and no configuration slip can leave one out.

`[DEMO G — 2 min]` `./run-auth-server.sh`, then Alice: browser login through the IdP, and
`execute_code` running as **Alice's own GemStone user** — `status` showing her userId, and the
`McpServer:…` row in the cache statistics belonging to her. The point to land: **the worker gem is
her session, not the server's.** If the browser flow is risky on stage, `verify-oidc-login.sh` plus a
curl with a pre-fetched token is the safe version.

**Future work for this section** (and an invitation to the room): **mapping scopes to privileges,
and loading toolsets by scope.** The router already resolves the tool surface **per session** on the
side that can see the token (§2/§4), so the mechanism is in place and unused; what is missing is the
policy — and whether GemStone's own privileges should carry any of it (§13).

---

## 10. Extending it: a server for *your* software (2 slides)

Two extension points, and the first is the one you usually want.

* **To add tools, write a toolset.** Subclass `McpToolset`; implement `registerOn:` (one
  `name:description:inputSchema:do:` per tool, schemas built with the inherited `objectSchema:
  required:` / `propString:` / `boolProperty:`), `toolNames`, and **`readOnlySafeToolNames`** for
  whichever of your tools cannot persist a change. Handlers are instance methods taking the parsed
  argument dictionary and answering a `String`; `resolveClass:`, `dictNamed:`, `linesFrom:`,
  `capResult:` cover the usual image lookups and output capping.
* **The default is *no* tool is read-only safe** — fail closed, so a newly added tool is gated until
  its toolset explicitly vouches for it.
* **A handler that mutates should pass through the inherited kernel guard**
  (`self assertMutableClass: cls`) **before** it changes anything. That forwards to the *server*,
  because what counts as protected is one answer per deployment rather than each toolset's to
  invent — and a subclass can tighten it for every toolset at once. A toolset built with **no**
  server refuses to mutate at all.
* **`McpGrailToolset` is the worked example** — 9 tools (eval, transpile, source, class and method
  browsing, module state, tests, and now `find_python_senders` / `search_python_source`), in its own
  source group, and it **needs nothing from the server**, which is what makes it a genuine
  third-party example rather than a privileged insider. It is also the example of **toolset
  options**: `grailDirectory` travels as JSON in the fork string and again as one
  `printString`-quoted JSON string in the worker bootstrap, parsed there — because the options are a
  nested map whose shape the core does not know, and encoding them as JSON keeps that shape out of
  the core entirely while giving them the same one-quoted-literal safety every other bootstrap
  argument has.
* **The best example of a domain toolset colliding with the session model**, and worth a slide
  because it is the kind of thing every vendor writing a toolset will meet. `run_python_tests`
  **forks a fresh gem** — that is the design, not a precaution. Measured 2026-09-01: the same three
  test classes produced **132 defects run in a long-lived worker session** and **386 run / 386
  passed / 0 failed / 0 errors run fresh.** Every one of those defects was an artifact of the
  session. The mechanism is a genuine disagreement between two models: Grail's rule is that **a
  module is a compiled artifact in the database, bound — never rebuilt — by every import
  afterwards** (`Persistent_Modules_and_Classes.md`, in the Grail repository), while its SUnit
  framework isolates tests by **evicting framework modules from `sys.modules`** — and against a
  stone where those modules are committed, re-importing raises. **A long-lived MCP worker is exactly
  the session that accumulates the state this collides with**, so running the suite in the caller's
  session cannot be made to report the truth; it has to be a session with no history.
  * Forking settles three other things at once: the caller's transaction is untouched, where an
    in-session run dirties it **silently** — *a cold Grail import is a database write*, measured at
    **31 modified objects for a 7-test class**; the child's writes are never committed, so a run
    leaves the repository exactly as it found it; and that is what makes the tool **read-only safe**.
  * The cost is honest and stated in the tool: every run is fully cold, so framework-heavy classes
    recompile each time (`FlaskScaffoldingTestCase` alone: **262 seconds**) — which is why the tool
    takes a `classNames` argument, and why it is the flagship consumer of progress reporting (§6).
    *An unbounded wait with no word is worse than a slow one that says so.*
* Worth 30 seconds for this audience, because it is a nice GemStone result and an upstream ask: the
  **stock sender search answers *nothing* for Python, confidently** — it scans environment 0 and
  Grail compiles into environment 1. Measured on 3.7.5, `ClassOrganizer new sendersOf: #'_dict'`
  answers an empty pair of arrays where **12** senders exist. `find_python_senders` searches all
  three shapes a Python reference compiles into, and **every answer ends with a `searched:` and a
  `not searched:` block**, because "no senders" is only worth reading if it can be told from "I could
  not look there". Three interfaces that would let it stop reading Grail's internals are filed
  upstream: [Grail#883](https://github.com/GemTalk/Grail/issues/883),
  [#884](https://github.com/GemTalk/Grail/issues/884),
  [#885](https://github.com/GemTalk/Grail/issues/885).
* **How a deployment picks a surface** — the three shapes, all live today:
  * `MCP_TOOLSETS="AcmeDbToolset"` → a server with **only** your tools and none of the
    Smalltalk-development surface. **An empty list is legal** and means a server offering no tools
    at all.
  * `serverName:` / `serverVersion:` say **which software** this is (the product's to set);
    `serverTitle:` labels **this instance** (the operator's), and is omitted entirely rather than
    sent as null, so a title being present means a human deliberately labelled that box.
  * `MCP_WORKER_CLASS=AcmeDbServer` → **subclass `McpServer` to change *behaviour*** — the kernel
    guards (`isProtectedClass:`, `protectedDictionaryNames`), the identity hooks, the server
    instructions. **Usually toolsets are the right answer**; nothing auto-detects a subclass, and
    the router names it per session.
* Brain Freeze Insurance is the example to name out loud: a database whose useful tool set is its
  own domain operations, not developer coding tools — same transport, same session model, same
  guardrail, none of `McpBrowsingToolset`.

---

## 11. Read-only mode (1 slide)

* **What it is**: a router can refuse every state-changing tool. Primarily a **localhost
  convenience** so a single user cannot *accidentally* mutate or commit — a **tool gate, not an
  access-control boundary**. Say that plainly; it is the honest framing and it is what the README
  says.
* **Per-router, two ways in**: `(McpRouter new readOnly: true)` / `MCP_READONLY=1`, or — on
  `McpAuthRouter` — **by OAuth scope**: give the router a `writeScope`, and a token carrying it gets
  a read-write worker while a token lacking it gets a read-only one **for that session**. Advertising
  without requiring is the point: an entitled user is granted the scope and gets read-write, an
  unentitled one still connects, read-only.
* **Gated**: everything that can persist a change or run arbitrary code — `execute_code`, `commit`,
  and all the mutation tools. Everything else stays, including `abort`/`refresh`/`status` and the
  test runners.
* **Screening at two levels**, which matters because one family is mixed: `McpSessionToolset` holds
  `abort`/`refresh`/`status` (safe) *and* `commit` (not), so a toolset declaring nothing safe is
  dropped **whole** while a mixed one keeps only its safe tools.
* **Two moments**: a read-only worker **never registers** its gated tools (the flag is set before
  the build — §4), which is stronger than refusing on call; the dispatcher's check still runs for a
  server whose flag was set afterwards. Either way the tool is **hidden from `tools/list`** and, if
  called, answers `-32601` with `data.kind = "readOnly"` — *not* `notFound`, so a client can tell
  "exists but forbidden here" from "no such tool".
* `McpServer class>>coreReadOnlySafeToolNames` remains as the **audit list** — one place to read the
  whole core answer — and `McpContractTest` pins the union of the seven core toolsets against it, so
  a tool cannot quietly become "safe".
* **One consistency worth a sentence, because it shows the mode is a mode and not a filter**: a
  read-only session is sent **no `instructions`** at all (`McpServer>>serverInstructions` answers
  nil). Telling a session that cannot write how to commit its changes, or how to recover a commit
  that failed, would be a page about tools it does not have — and such a session never has
  uncommitted changes, so it never sees a `[session]` line either, which is the thing the
  instructions exist to explain.
* **Ideas for improving it**, which is where this slide should end rather than on the caveat:
  * a **read-only GemStone login** (or a user whose privileges cannot write) underneath the tool
    gate, so it stops being only a gate — this is the natural place to ask the room what the image
    offers;
  * **scope → toolset** selection (§9's future work), which subsumes the boolean;
  * the honest limit today: a read-only router still holds a **transaction view**, so it still costs
    a login and still pins a commit record between refreshes.

---

## 12. Versions: the floor moved, and why (3 slides)

**The headline changed on 2026-09-10, four days ago: the supported images are now 3.7.5 and
3.7.6+.** 3.7.2 was **dropped**, not deferred, and the reason is `System continueTransaction` —
which makes this the natural closing section rather than a footnote, because the whole of §8 rests
on that one primitive.

| image | base server | OAuth/OIDC front end | notes |
|---|---|---|---|
| 3.6.2 | **no** | no | no usable `GsTsExternalSession` on macOS, so **no worker gems at all** |
| 3.7.2 | **no** | no — no kernel JWT classes | **dropped 2026-09-10**: `continueTransaction` differs below the image in two ways nothing in `src/` can detect or cover, and it carries #51438 |
| 3.7.5 | yes | yes, against a local IdP | |
| 3.7.6+ | yes | yes, **including an external OIDC IdP** | |
| 4.0.0 | untested | untested | |

Whether the floor settles at 3.7.5 or 3.7.6 **is not yet decided** — say so, since somebody will
ask. Anything present in 3.7.5 may now be referenced directly with no existence guard; the live
concern is only what is newer. And **GemStone has no notion of an optional method** — absence shows
up only as a `doesNotUnderstand` at runtime, so there is no list to check against and the live suite
on the loaded extent is the only test.

### 12.1 The `continueTransaction` obstacle — the slide this section exists for

`(System class compiledMethodAt: #continueTransaction) sourceString` is **byte-identical on 3.7.2,
3.7.5 and 3.7.6.** The whole difference lives in the `_zeroArgPrim: 9` stone primitive — **below the
image, where no `respondsTo:` or any other feature test can reach it.** Both differences were
measured with two **real** gems (topaz plus a `GsTsExternalSession`) and reduce to a one-slot
`Array`: no method dictionaries, no toolset, nothing of this project's own involved.

**(1) A successful refresh does not rebase the conflict baseline.** S1 reads X; S2 commits a change
to X; S1 sends `continueTransaction`; S1 writes X; S1 commits:

| | 3.7.2 | 3.7.5 / 3.7.6 |
|---|---|---|
| `continueTransaction` answers | `true` | `true` |
| S1's view of X afterwards | S2's value | S2's value |
| S1's following commit | **`false`**, `#'Write-Write'` naming X | **`true`** |

The view moves on both. But on 3.7.2 the write-write intersection is still taken **against the
commit record the transaction *started* at**, so a write S1 has already adopted still counts as
concurrent. **Substituting `abortTransaction` makes 3.7.2 behave exactly like 3.7.5** — which is
what isolates this to the primitive rather than to anything about the objects written.

**And 3.7.2 is not the safer image for having it.** This is the point to make carefully, because the
table above looks like read protection and is not: writing an object the other session did not touch
commits just as cleanly on 3.7.2 as on 3.7.5, so **the laundering §7 exists to prevent still happens
there in every case where the write lands somewhere other than the read** — which is the shape the
guardrail was written for. 3.7.2 refuses only the same-object case, and **refuses it spuriously**:
the session had legitimately adopted the newer version before writing. So the guardrail keeps its
full scope there, and 3.7.2 additionally fails
`testTheStoneAloneWouldAllowThatClobber` — the test written to fail on good news, here reporting
something that is **not** good news — and `testRefreshAdoptsTheOtherVersionAsTheStartingPoint`.

**(2) A failed refresh does not record its failure.** More precisely, 3.7.2's `continueTransaction`
**never writes `System transactionConflicts at: #commitResult` at all**, in either direction:

| `#commitResult` after… | 3.7.2 | 3.7.5 / 3.7.6 |
|---|---|---|
| a fresh login | `#success` | `#success` |
| a **successful** `continueTransaction` | `#success` | `#readOnly` |
| a **failed** `continueTransaction` (S1 wrote X, S2 committed over it) | **`#success`** | **`#failure`** |

The `false` answer itself arrives on both, so the tool layer still sees the refusal *in the moment*;
what 3.7.2 loses is the **durable trace** of it. `McpToolset class>>commitConflictPending` tests for
`#retryFailure or: #failure`, so on 3.7.2 it answers **false for a session that is genuinely
stuck** — view moved, pending writes doomed, no commit possible — and everything gated on it goes
quiet: `transactionStateNote` emits **no `[session]` line**, and `stuckViewReason` finds no reason to
report. Three more suite failures.

**The consequence, and it is the reason to drop rather than work around:** *on 3.7.2 the server
cannot see a session that its own front-end maintenance refresh has doomed. That client is told
nothing — no `[session]` line, no named collision, no "abort is the only way out" — so **the worst
state the session layer knows how to explain is exactly the one it goes silent for.***

**Contrast it with #51438 explicitly**, because that is what makes the decision principled rather
than a shrug: the buffer corruption could at least be **detected from inside the image** and was
covered on a branch of its own for months. Here there is **nothing to test for** — the selector
exists on every version, answers a plausible Boolean, and differs only in the state it leaves
behind. (One footnote worth having ready: the reverse hazard `commitConflictPending`'s comment warns
about — reading `not #success` and so calling a session jammed from its first *successful* refresh
onward — **cannot occur on 3.7.2 either**, because the `#readOnly` that causes it is never set
there.)

**Two housekeeping facts to have to hand.** `main372` is archived as the annotated tag
**`archive/main372`** rather than kept as a branch — the tag holds every commit and the reason the
line existed, without implying it is still maintained. And **no `.gs` file changed** for any of
this: it is a documentation and support decision, and an older image may well still load.

### 12.2 #51438, the buffer corruption — still worth the slide

It no longer bounds support, but it is the best kernel story in the talk and **this is the audience
for it**. It is a **Smalltalk** bug, not a C GCI bug, so it hits gem-to-gem sessions and not C
clients. `GsTsExternalSession>>resolveResult:` fetches an object's first 1024 bytes into a shared,
preallocated, per-session buffer that never shrinks, and then **nests the refetch of the full object
inside the "is the buffer big enough?" test** — conflating *big enough* with *already full*:

| result size | what you get |
|---|---|
| ≤ 1024 | always correct |
| 1024 < n ≤ grown buffer | **exactly 1024 correct bytes**, the rest stale from a previous result |
| > grown buffer | correct again, and it re-grows the buffer, **raising the corruption ceiling** |

* **Right length, wrong content** — so JSON fails as "Unterminated string", never as a short read.
  **Sticky for the session's life**; a small result in between does not clear it; a fresh login does.
  Fixed in **3.7.4.1** by splitting the two conditions.
* The same shared-buffer aliasing breaks `resolveResult:toLevel:` for Arrays (**#51563**), so
  returning an Array of small chunks is **not** a workaround — repeated calls each returning ≤1024
  bytes is.
* Why it matters here specifically: **mcp_server would meet this on its main path**, since every MCP
  response is a String of JSON pulled out of a worker gem (§4, step 12). Which is why
  `McpExternalSessionTest` pins it: all five pass on a supported image, two fail on an older one **to
  say why it is not supported**, and the other three are controls that localise the failure.
* And the general lesson, which is the reason to keep the slide: **a green `test.sh` on an older
  commit was not evidence of absence.** It passed once only because a smaller class happened to put
  the method being checked inside the good first kilobyte.

### 12.3 What the code still carries from the old floor

Worth 20 seconds so nobody reads it as dead code in the file-outs. Two expansions in `forkOnPort:`
and `McpSession>>startWithId:readOnly:` are still written the 3.7.2 way, and their comments still
say so:

* `newDefault` + `gemNRS: (GsNetworkResourceString defaultGemNRSFromCurrent node: 'localhost')`
  instead of `newDefaultForGemHost:` — kept because the expansions are **proven byte-identical on
  3.7.5** (the NRS strings compare equal), and because plain `newDefault` **silently moves the gem
  to the machine's host name**, which is a trap independent of version;
* `onetimePassword: (GsCurrentSession currentSession createOnetimePasswordValidForSeconds: 300)`
  instead of `useOnetimePassword`.

They stay because they are correct and identical, not because 3.7.2 is supported — and they are now
candidates for simplification rather than compatibility requirements. `jwtPassword:` never had an
expansion, which was the second reason auth could not run before 3.7.5.

## 13. Future work, and what to ask the room (4–5 slides)

### The new protocol era — 3 slides, and it has a worked answer rather than an open question

The draft **`2026-07-28`** is not a revision, it is a different era. Its own binding page states it
as a change notice: **"Removal of the GET stream endpoint. Removal of protocol-level sessions."** A
modern-only server answers `405` to GET and DELETE, mints and echoes no session id, and ignores
`Last-Event-ID` because streams are no longer resumable. And the permitted directions narrow to the
point where one sentence does most of the damage:

> A binding **MUST** deliver client-sent *requests* and *notifications* to the server, and
> server-sent *responses* and *notifications* to the client. No other message direction exists:
> servers do not initiate JSON-RPC requests and clients do not send JSON-RPC responses.

That removes **server-initiated `ping`** — which is what every count in §8 rests on — and removes
the reason the pending-request table and `serveClientResponse:` exist at all. What survives of
server push is exactly one thing, `subscriptions/listen`: a POST whose response stream stays open,
with a client-supplied filter the server **MUST NOT** exceed, and a vocabulary of four fields — the
three `listChanged` notifications and `resources/updated`. **So the draft's whole notion of push is
"something in your cached view of the server went stale"** — and progress and logging are explicitly
barred from it, flowing "only on the response stream of the request they relate to."

**MRTR is not the continuity mechanism, and this is the misreading to head off.** Multi Round-Trip
Requests look like the draft's replacement for sessions and are neither a conversation nor a
transcript: a server **MUST NOT** send an `InputRequiredResult` on anything but `prompts/get`,
`resources/read` and `tools/call`; its only purpose is gathering input the client can supply; and
what the client re-sends is the original request plus `inputResponses` plus **`requestState`** — "an
opaque string meaningful only to the server", which the spec is explicit the server writes to
itself and hands *through* the client, integrity-protected because it round-trips through a possibly
hostile party. The spec's own framing is that the server keeps nothing. **Which is exactly why MRTR
can never be this server's continuity mechanism: a gem's transaction view does not serialize into an
opaque blob.**

**The rule that does apply is Statelessness, and read precisely it is permissive:**

> State that needs to span multiple requests (e.g., long-running tasks, **application-level
> handles**) **MUST** be referenced by an explicit identifier the client passes on each request.

The identifier must be explicit; **the state need not disappear.** What is forbidden is *inferring*
state from the connection — "a server **MUST NOT** treat connection or process identity as a proxy
for conversation or session continuity" — and in the same breath "application-level handles" are
named as something servers legitimately keep. **A worker gem is exactly that: a long-lived,
server-side, explicitly-addressable handle. The protocol session dies; the worker gem does not.**

What has to change is only **where its name comes from.** Today the router mints an
`MCP-Session-Id`, returns it in a header, and thereafter infers the gem from a header it issued —
which is precisely the inference the draft forbids. Two legal shapes, and this is the decision to
put to the room:

* **a client-supplied workspace id**, as a tool argument or a vendor-prefixed `_meta` key — explicit,
  and it keeps the ability to hold more than one independent transaction view per user;
* **collapse to per-principal** — on `McpAuthRouter` the authenticated principal is already carried
  on every request, so one gem per user requires nothing of the client at all. Simpler, and it costs
  exactly the thing the first option keeps.

Either is a change to how `McpRouter` **resolves** a session, not to what a session **is** — and
nothing else depends on which way it goes. It can also be built **now**, alongside the header, since
the two coexist: the header keeps working for current clients while the explicit identifier becomes
the primary key. **That is the only era-proofing available that breaks no client today.**

**What has a long life and what has a short one**, which is the slide that says what is worth
investing in:

* **Long life — the reaping policy itself.** Deciding when to release a gem that pins pages, holds
  back reclamation and occupies one of ten session slots is a **GemStone** question, not a protocol
  one, and it gets *more* important in a handle-based world, not less: **with no connection to
  close, nothing signals that a handle was abandoned, and an unreaped gem is simply lost.** `isBusy`
  and `isExpired` survive untouched — an expiry especially, since a credential's `exp` is a
  wall-clock fact no era changes.
* **Short life — the evidence underneath it.** Failed pings die with server-initiated requests;
  `streamlessPasses` dies with the GET stream; and **idleness-by-answered-pings loses its measure and
  reverts to elapsed time — which resurrects exactly the host-suspend problem that counting evidence
  was invented to solve** (§8). *That is the piece with no obvious successor, and the one to think
  hardest about.* Good question for the room.
* **Replaced by something better** — the hang-up detection of §8 keeps its purpose with a *stronger*
  signal: in the draft, closing a request's response stream **MUST** be treated as cancellation.
  Per-request, normatively defined, unambiguous — rather than inferred from a keepalive write failing
  into a dead socket.
* **And none of it is urgent, which is a finding rather than a hope.** Claude Code speaks
  `2025-11-25` today, sends a session id, opens the GET stream, answers pings, and hands the server a
  progressToken on every call. The draft's own compatibility section **explicitly contemplates
  dual-era servers on a single endpoint.** What was already deleted from this server is only what is
  dead in **both** eras.
* **Scopes → privileges → toolsets** (§9, §11). The per-session resolution is already in the right
  place; the policy is not written.
* **The read-ledger cost curve.** Re-validation is O(ledger) per view move today. Two options
  already identified: **wipe** on move, or **lazy** re-stamping in `requireRead:` against a recorded
  view generation — at the price of the one-time stale-read note, which can only be produced by
  checking everything. Worth stating as a known trade rather than a worry.
* **Retiring `McpJson`, and this is the concrete upstream ask of the talk.** Fix defects 1 and 2 of
  §5's table — `printJsonOn:`'s astral-codepoint arithmetic and `JsonParser`'s refusal of a
  surrogate escape — and this server can delete a writer it owns only because the kernel's is not
  Unicode-correct. The report is written, measured on **3.7.6**, one suggested fix per defect, and
  is a document to hand over rather than a request to file: for defect 1, look ahead for the low
  surrogate and combine (`16r10000 + ((hi - 16rD800) bitShift: 10) + (lo - 16rDC00)`), signalling
  the parser's own error on a lone one instead of letting it reach `Character codePoint:`; for
  defect 2, emit the pair for `codePoint > 16rFFFF`. Defects 3–5 are cheap too (a final `ifFalse:`,
  four hex-digit checks, an end-of-input check after `_value`) but they are **conformance rather
  than corruption**, and closing them properly is the real-parser conversation. Worth adding: the
  `decodeFromUTF8` API note, which is the one item on the list that would simplify *every* GemStone
  application handling a UTF-8 body, not just this one.
* **Worker → front-end messaging beyond progress.** Log lines from tool internals ride the same
  channel; **elicitation and sampling need more** — a *bidirectional* worker channel, since their
  answers must be delivered back into a gem whose GCI call is already in flight.
* Smaller, already listed in the README: class/method source as MCP **resources** (so a client is
  notified when another gem recompiles a method and its cached source goes stale), SSE resumability
  (`Last-Event-ID`), and tracing the **outbound** half.
* **The closing question, as posed in the outline:** *is a kernel guard needed, or can privileges
  handle it?* Frame it precisely so the room can answer it: the guardrail restores the browser's
  `readLedger ⊇ writeLedger` invariant **in the server**, per session, at method grain, using
  nothing but SHA-256 over source text. The repository's own check is write-write at class grain and
  has no read side. So the question is really three:
  1. Should the *stone* know what a session read? (`StrongReadSet` exists and is user-writable, but
     arming it with every class a session browses makes a long-browsing session progressively unable
     to commit — measured, and declined here.)
  2. Could **privileges** express "this session may not write what it has not read"? (Privileges
     gate *what* a user may touch, not *what they have looked at*, so probably not — but this room
     knows.)
  3. If neither, is the right long-term home a **kernel** guard, so that every client — topaz,
     Jasper, a future MCP server, an agent nobody has written yet — gets it, rather than each
     server reimplementing it?

  Frame the stakes with the version story, because it is the same argument seen from the other end:
  §12 shows that this server's correctness under concurrency already depends on a **stone primitive**
  whose behaviour changed between releases and which **nothing in the image can feature-test**. If
  the answer to question 3 is yes, the guardrail joins that layer and every client inherits it. If
  the answer is no, then every future agent-facing server on this database has to rediscover §7 —
  including the part that took a two-session test to find.

---

## Demo inventory

Nothing is cut, so this is a rehearsal order rather than a triage list. Run them in this sequence
when practising — B–C–E–F share one server and one second gem, so rehearsing them together is also
how the stage setup gets shaken out.

| | demo | needs | length | rehearsal note |
|---|---|---|---|---|
| A | `install.sh --check` + install | a stone | 60s | the only demo that can be replaced by a screenshot without loss; run it once to be sure `--check` is clean on the demo machine |
| B | `run-server.sh` + banner + cache statistics | a netldi | 90s | have the gem log path already resolved (`lsof -nP -iTCP:8000 -sTCP:LISTEN`); leave the `tail -f` running for F |
| C | `initialize` / `tools/list` by curl + the new worker row | server up | 2 min | **the load-bearing demo.** Practise the `cacheStatisticsForAllSlotsShort` line until the three rows are readable on a projector |
| D | a `tools/call` with a `progressToken`, `curl -N` | a long tool | 90s | pick the test class by *wall clock*, not by size — 20–30 seconds of ticks, not 262 |
| E | the two-client blind-write sequence | a second gem, a fixture class | 3 min | **rehearse this most.** Six calls in order; the whole point lands on step 5. Write the calls down — improvising the fixture name mid-demo is how this one dies |
| F | view hygiene with tightened knobs | a second gem committing | 90s | timing-dependent; keep the gem-log screenshot as the fallback and do not apologise for using it |
| G | Alice's OAuth login running code as herself | IdP + TLS + 3.7.6 | 2 min | needs the 3.7.6 stone (§12). Have a pre-fetched token and a curl ready in case the browser flow stalls |

Fixtures to prepare in advance: a throwaway class with two methods for demo E (do **not** use a
production class), a second topaz session already logged in, a long-running test class for D, and a
pre-fetched token for G.

**One demo that does not exist yet and might be worth building**, since nothing is being cut for
time: the **`sessionGone`** path from §8 — an `execute_code` that exhausts the worker's temporary
object memory, the call answered `sessionGone`, the next request 404ing, and a fresh `initialize`
succeeding on a router capped at one session. It runs in about fifteen seconds, it is already
scripted in `test.sh`, and it is the most visceral illustration in the talk of "a session is a gem":
the gem dies on stage and the server keeps serving.

---

## What to fix in the repository before the talk

Not blockers, but each one is a slide's claim contradicted by a document in the room, and this
audience will have the README open.

1. **The README's conformance list is stale in four places, all about things that now exist.**
   * `## Protocol conformance`, the "Not implemented, all optional at these revisions" sentence,
     lists **`progress notifications`** — implemented (§6) — and **server `instructions`** —
     implemented, sent by `initializeResultFor:`, and omitted only for a read-only session (§11).
   * `## Server-initiated messages`, "Not yet built: anything originating in a **worker** gem —
     progress during a long tool call…" — built; that is `McpProgressReporter` +
     `InterSessionSignal` + `forkSignalPoller`. What is genuinely not built is the *rest* of that
     sentence: log lines from tool internals, and elicitation/sampling needing a bidirectional
     channel.
   * `## Future work`, "Carrying messages that originate in a **worker** gem — progress during a
     long tool call…" — same sentence, same correction.
2. **Four documents are cited by path but are not in the tree**, which I can now account for
   exactly:
   * `docs/server-to-client-messaging.md` — exists as a working document (2,553 lines) outside the
     repository. Cited from `McpDispatcher>>handleToolsCall:id:` ("see docs/server-to-client-messaging.md 15"),
     `initializeResultFor:` (2.2) and `docs/session-lifetime.md` (§2.1, §2.2).
   * `docs/kernel-json-unicode.md` — exists, and so do three later variants including the filed
     3.7.6 report §5 now quotes. Cited from the README's UTF-8 section.
   * `docs/mcp-front-end-view-hygiene.md` — exists (829 lines, status COMPLETE). Cited from
     `.claude/CLAUDE.md`.
   * `Persistent_Modules_and_Classes.md` — lives in the **Grail** repository, at
     `docs/Persistent_Modules_and_Classes.md`, and `McpGrailToolset` cites it by that path. That one
     is arguably fine as a cross-repository reference, but it reads like a local path.
   **Recommendation:** commit the three mcp_server ones under `docs/` — they are the evidence behind
   §7, §8 and §13, they are already written, and the citations are load-bearing (a reader who wants
   to know why the dispatcher does not refresh is sent to a file that is not there). For the Grail
   one, qualify the path in the comment. If they stay out, the alternative is to reword each citation
   to point at the class comment that carries the conclusion.
3. **Test counts to re-take on the morning.** The README now says **466** base / **522** with auth /
   **573** with Grail (51 in `McpGrailToolsetTest`). The Grail figure moved **twice on 2026-09-10
   alone** — 39 → 44 → 51 across two merges from `main` — while the base and auth numbers did not
   budge. So quote the Grail number from a run and nothing else: run `./run-unit-tests.sh` on the
   demo stone that morning and read **only** what it prints. Better still, say "about 570" on the
   slide and let the live run be the precise answer if anyone asks.
4. **Three comments in `McpRouter` contradict the code, all found while cutting §8, and all three
   are cheap.** None of them changes a slide, but this audience reads source:
   * **`maintainSessions`** — the numbered list in its comment has **three** steps and the method
     sends **four**. `maintainViewHygiene` is missing from the list, which is awkward given that the
     comment's whole point is that *the order is the point*.
   * **`reaperIntervalSeconds`** — its comment still says it is *"the unit the suspend detector
     measures its own lateness in (#maintainSessions)"*. `maintainSessions` says, correctly, that
     **there is no suspend detector**. It is a footprint left by the mechanism §8's slide 3 is about
     having removed.
   * **`commitsBehindFor:`** — its comment says *"two failures both answer nil: the session has
     logged out, and this server's user lacks the `SessionAccess` privilege."* The first is wrong,
     and `docs/session-lifetime.md` has the measurement: `descriptionOfSession:` does **not** refuse
     an id nobody holds, it answers a zero-filled description, so field 16 reads **`0`** and a dead
     gem measures as perfectly current. That is load-bearing — it is why the arm sends a dead worker
     nothing — so the comment contradicts the behaviour the design depends on.

5. **The README's status line oversells the same two things §0's status slide now refuses to
   oversell**, and it is the first paragraph anybody in the room will read. It lists "per-router
   read-only mode and server-initiated messages" among what is "built and verified end-to-end",
   which is true of both and misleading about both: read-only mode is a **tool gate rather than an
   access-control boundary** (the README says so itself 700 lines later, under *Read-only mode*),
   and server-initiated messages are a direction the **`2026-07-28` draft removes outright**, so
   they are machinery this server needs rather than a capability to advertise. Two clauses of
   qualification, in the sentence that currently reads as a feature list.

6. **`McpJson`'s class comment and the §5 defect table number the same defects differently**, which
   is not a stale comment but reads exactly like one — and one cross-reference is already wrong
   because of it. Found while cutting §5.
   * **The counts differ legitimately.** The class comment says *"Three Unicode defects were
     measured in the kernel's JSON"*; the slide's table has **five**. Both are right: the comment
     enumerates only the three that bear on the question it is answering (*WHY ONLY THE WRITER* —
     which half of the codec to own), while the table is the filed 3.7.6 report, which is a superset
     adding the unchecked hex digits after `\u` and the leniency/error-quality family. Nothing to
     fix in the count itself; the comment is answering its own question and still needs exactly its
     three.
   * **The ORDER differs too, and that is the actual defect.** The class comment's list is
     1 = `printJsonOn:` cannot *encode* a pair, 2 = `JsonParser` cannot *decode* one, 3 = an
     unrecognized escape is dropped. The report and the slide run 1 = no decoding, 2 = no encoding,
     3 = escape dropped, 4 = `\u` not hex-checked, 5 = leniencies. So the two schemes **transpose 1
     and 2** — the encoding defect is *defect 1* in the class comment and *defect 2* in the report.
   * **`McpJsonTest`'s class comment cites the report's numbering while sitting next to `McpJson`'s
     own.** It says the writer defect is *"docs/kernel-json-unicode.md, defect 2 and section 7"*,
     which is correct **for the report** and lands on the *decoding* defect for anyone who followed
     `McpJson`'s list to get there. The README cites the report without a number and is fine.
   **Recommendation:** leave the enumeration alone and add one clause to `McpJson`'s comment saying
   its three are the write-path-relevant subset **and are numbered locally**, with the report's own
   numbering authoritative — or, cheaper and better, stop numbering in the class comment and name
   each defect instead (`printJsonOn:`, `JsonParser>>string` decode, `JsonParser>>string` escape),
   so no citation anywhere can drift against a list. This matters more once item 2 is done: the
   moment `docs/kernel-json-unicode.md` is in the tree, a reader can follow *defect 2* from
   `McpJsonTest` to a document that means something else by it.
   One thing that is **not** a discrepancy, so that nobody "fixes" it: the comment's *"identically
   on 3.6.2, 3.7.2, 3.7.5 and 3.7.6"* and the slide's *"measured against 3.7.6"* agree — the report
   is the 3.7.6 filing of defects that reproduce on all four.

7. **Two documents disagree about whether the `offline_access` SHOULD NOT applies to a supported
   revision**, and §9's deviation slide rests on the answer. Found while cutting §9.
   * `src/auth/McpAuthConformanceTest.gs` (class comment): SEP-2207 is *"status Final, so it binds
     independently of which revision we claim"* — and the suite asserts the rule against
     `conformantRouter` accordingly.
   * `docs/MCP_Client_Notes.md` (line 38): *"the `offline_access` 'SHOULD NOT' and the
     scope-hierarchy MUST are **draft-only**, and so are not gaps in either supported revision."*
   Those are opposite claims. If the rule is draft-only, §9's deviation is not a deviation from
   anything this server claims to implement, and the slide overstates it; if it binds, the Client
   Notes tell a reader the opposite of what the suite enforces. **The slide follows the conformance
   suite**, because that is the reading the code actually enforces — but this room may have either
   document open. **Recommendation:** decide which is right and make the other say so. The most
   likely reconciliation is that the SEP is Final *as a SEP* while its requirement text lands in the
   draft revision, in which case both sentences are half-true and both should say which half.
8. **`./run-conformance.sh` does not exist.** It is cited from `McpAuthRouter`'s class comment
   (*"Conformance status: see `McpAuthConformanceTest`, one test per normative requirement, scored
   by ./run-conformance.sh"*) and from `McpAuthConformanceTest` itself (*"./run-conformance.sh still
   exists to score it test-by-test"*). No slide mentions it and none should until it is back — but
   the class comment is the first thing a curious attendee will read about conformance, and it names
   a script that is not in the tree. Same family as item 2, and cheaper: either restore it or reword
   both comments to point at `./run-unit-tests.sh`, which does run the suite.

---

## Open items

1. ~~The `continueTransaction` obstacle on 3.7.2.~~ **Resolved** by the `main` merge: measured, in
   `docs/GemStone_Notes.md`, and now the spine of §12.
2. ~~Where the four missing documents are.~~ **Resolved** — located and read; what remains is the
   decision in *What to fix* above, which is yours.
3. **Version to run the demos on.** §9 and demo G need **3.7.6**; everything else runs on 3.7.5. If
   the demo stone is 3.7.5, demo G is a recording. Worth deciding early, because §12 also says the
   floor between 3.7.5 and 3.7.6 is undecided, and it would be odd to demo on an image the talk
   describes as possibly-the-floor without saying which.
4. **Login-slot budget on the demo stone.** The talk itself spends sessions: the server (1 front end
   + up to 3 workers), demo E's second gem, demo F's committer, and `run-unit-tests.sh` if anything
   is run live. On a Community Edition extent that is most of ten. Check `SessionsCurrent` against
   `StnMaxSessions` before the talk, and be ready to explain the 4039 lockout **as a slide** if it
   happens live — §8 already has the material, and it would be the best unplanned demo of the day.
5. **The Grail toolset is about to stop being auto-detected** — flagged 2026-09-11, and the change
   will be merged into this branch when it is ready. Today
   `McpServer class>>installedDefaultToolsetNames` appends `McpGrailToolset` to the default surface
   whenever that class is loaded in the image; it is to become something a deployment **names
   explicitly in the router configuration**. What that touches, in order of how wrong it goes:
   * **§2** asserts the auto-detection directly — *"the seven core toolsets plus `McpGrailToolset`
     if that file is loaded in the worker's image … resolved per session, not at boot"* — and the
     "resolved per session" half survives while the "if loaded" half does not;
   * **§10** is the extension section, so the *"name your toolsets"* story gets **better** under the
     change, not worse: Grail stops being a special case and becomes the worked example of the
     ordinary mechanism. Worth cutting §10 after the merge rather than before;
   * **§0/§1 are safe as cut** — the group table is about `install.sh`'s file-in, which does not
     change, the "+9 optional Python" count is unaffected, and the test counts are unaffected
     because the suite runs either way. Nothing in that slice needs re-cutting.
   * `MCP_TOOLSETS` already exists and already does this, so the demo story does not change either.

6. **Two things in the talk are marked "not measured"** and should either be measured or stay
   labelled: whether Claude Code resets its `timeoutMs: 60000` on a progress notification (§6), and
   the overnight soak of the view-hygiene arms, which wants a teststone and a night rather than the
   development stone (§8).
