# Changelog

Notable changes to the native GemStone MCP server. The version is
`McpServer class>>defaultServerVersion`, which is what a client sees as `serverInfo.version` at
`initialize`.

Entries before 0.7.0 were reconstructed from git history when this file was started, so they group
work by theme rather than recording every commit, and the dates are the version bump on the line
that made it. Development ran on several long-lived lines at once during that period, each carrying
its own bumps, so attribution to a release is approximate before 0.7.0. The project is pre-release:
breaking changes are expected and are called out rather than shimmed.

Keep an entry to a few sentences: what changed, why it mattered, and the tools or options a reader
has to act on. The measurements, the alternatives weighed and the kernel behaviour behind a change
belong in its commit message and in `docs/` — an entry that has to carry all of that is a sign the
reasoning has nowhere better to live, not that the entry should grow.

## Unreleased

* **Breaking: the Grail (Python) toolset is no longer served by default.** `McpServer
  class>>installedDefaultToolsetNames` — which probed the symbol list and appended `McpGrailToolset`
  to the default surface whenever `src/grail` was loaded — is **gone**. The default surface is now
  `McpServer class>>defaultToolsetNames`, the core seven and only those, and no toolset joins it by
  being loaded. A Grail server is a deliberate toolset configuration: name `McpGrailToolset`
  alongside the core toolsets in `MCP_TOOLSETS` (both launchers) or in a router's `toolsetNames:`.
  Two reasons. An optional toolset can carry a dependency the image knows nothing about — Grail's
  tools read the `.py` checkout that `grailDirectory` names — so a server that offered them merely
  because a group was filed in was answering for a directory nobody chose; and turning one on ought
  to look the same whoever wrote it, so the Python toolset is now the worked example a developer can
  copy for their own. `MCP_GRAIL_DIR` still *configures* the toolset and no longer adds it: set
  without `McpGrailToolset` in the surface, both launchers say so and leave it off, since a router
  holding options for a toolset it does not serve refuses to start. **If you run a Grail server,
  its `run-server.sh` line needs `MCP_TOOLSETS` or it will come up with 31 tools instead of 40.**
  `run-auth-server.sh` gained `MCP_TOOLSETS` so an authenticated deployment can do the same.

* **`eval_python` now reports stderr, and no longer throws away output when the code fails.** The
  redirect swapped `sys.stdout` alone, so `warnings.warn`, `print(..., file=sys.stderr)` and the
  interpreter's own diagnostics went to a console sink that a detached worker gem nobody reads —
  the bytes were accepted, counted and gone, and a model saw a clean result. stderr is now a fourth
  channel, each line marked `[stderr] ` so a warning is not mistakable for a `print`; both output
  channels are reported ahead of the traceback on the failing path, where a script that printed its
  way to the point of failure used to have that output captured and dropped unread; and a client's
  own `sys.stdout` redirect is left installed across calls rather than silently reverted. A call
  that writes to neither channel still answers the bare `repr` on one line. One limit, and it is
  the image's rather than the tool's: a `.py` module **warm-bound** from a committed canonical
  instance keeps the `sys` of whichever session committed it, so on such an image a call like
  `traceback.print_exc()` with no `file=` still writes past the redirect. Reaching it would mean
  assigning into state shared with every session; `print_exc(file=sys.stderr)` is captured either
  way, as is anything native. Filed upstream as
  [GemTalk/Grail#924](https://github.com/GemTalk/Grail/issues/924).

* **`list_python_methods` no longer drops `*args`, `**kwargs`, `/` and `*` from a signature.** The
  renderer read each parameter's name and default out of the class's signature table and ignored its
  *kind*, so `call(a, /, b, *args, key=None, **kwargs)` was answered as
  `call(a, b, args, key=None, kwargs)` — not a signature with a piece missing but a well-formed one
  for a *different* method, which a reader cannot tell from a real one and from which every call
  written is a `TypeError`. Signatures are now written the way `inspect.signature` writes them.
  No option to set, and nothing else changed.

* **The supported images are now 3.7.5 and 3.7.6+.** The server's view handling relies on their
  implementation of `System continueTransaction`, which earlier images implement differently in
  ways nothing in `src/` can detect or work around. The measurements are in
  [docs/GemStone_Notes.md](docs/GemStone_Notes.md#version-to-version-differences). No code changed.

* **`run_python_tests` no longer dies on memory, and says so when it does.** The tool runs Grail's
  SUnit classes in a forked gem, which used to get whatever memory the host's NetLDI handed out and
  now forks with Grail's own stated budget (`scripts/run_tests.sh`). Classes are driven one per
  send, so a gem that dies reports the class it died on and what had finished, kinded
  **`testGemDied`**; every answer carries the gem's peak memory, and a run stops starting classes
  past 85% of it, because beyond that a Grail run does not crash, it blames an innocent test. New
  toolset options **`testGemConfig`** and **`testGemMemoryCeilingPercent`** set both numbers.

* **`get_python_source` no longer over-reads a method into the next one.** A definition's end is
  found by indentation, and the rule asked for the next line with content in **column zero** —
  right for a module-level `def`, wrong for anything inside a `class`, so asking for
  `textwrap.TextWrapper.wrap` answered `wrap` *and* `fill`. A block now ends at the first later line
  whose content begins at or to the left of the definition's own first line. Module answers and
  module-level defs are unchanged.

* **A session whose worker gem dies is now ended, rather than wedged for the life of the server.**
  A dead gem used to leave its session registered, answering a generic `-32603 "Internal error"` to
  every later call and holding its `maxSessions` slot until the front end stopped — so a client
  retried forever and never re-initialized. The call that meets the dead gem is now answered
  `-32001` with `data.kind` **`sessionGone`**, and the session is released as part of answering: the
  slot goes back at once and the next request on that id gets the **404** clients already recover
  from by re-initializing. The client is told the GCI error number; the failure in full goes to the
  gem log. Closes #6. See *Session lifetime* in
  [docs/session-lifetime.md](docs/session-lifetime.md).

* **Two new optional Grail tools, `find_python_senders` and `search_python_source`** — a Python
  sender search and a text search over the checkout's `.py` files, both **read-only safe**. The
  stock sender search is not merely incomplete for Python: it scans environment 0 and Grail compiles
  Python into environment 1, so it answers *nothing*, confidently. `find_python_senders` searches
  all three shapes a Python reference compiles into — compiled call sites, Symbol-literal
  references, and the `.py` source — and every answer names the gaps it did *not* search, because
  "no senders" is only worth reading if it can be told from "I could not look there". Matching is
  syntactic and **never imports**, which is what keeps both tools out of the read-only gate.
  `shapes`, `scope`, `includeNative` and `includeTests` are optional; both page with
  `limit`/`offset`, and `tests/python` is excluded by default.

* **A router now caps how many sessions it will hold at once** — `maxSessions`, **3 by default**
  (`MCP_MAX_SESSIONS`; `none` for no cap, which is the behaviour every earlier release had). Past
  the cap an `initialize` is refused with a JSON-RPC `-32001` naming the limit and `data.kind`
  `sessionLimit`, in an HTTP 200 bearing the request's own id and no `MCP-Session-Id` header, and
  **no login is attempted**. The startup banner logs `concurrent sessions:`, and each refusal is
  logged. Closes #2. See *Session lifetime* in the README and
  [docs/session-lifetime.md](docs/session-lifetime.md).
  **Behaviour change for an existing deployment**: a server that was serving more than three clients
  at once will start refusing the fourth. Set `MCP_MAX_SESSIONS` to what your stone can afford.

* **The gems name themselves in the shared cache**, so a DBA reading
  `System cacheStatisticsForAllSlots` can tell them apart: the front end is
  `<router class>:<port>` (`McpRouter:8000`, `McpAuthRouter:8443`) and each worker is
  `<worker class>:<front-end session>:<first 8 of the MCP session id>` (`McpServer:5:978EC559`).
  Every gem here is a `GsTsExternalSession`'s, so they all used to arrive called `GciTs` — the
  router, every worker and any unrelated external session on the stone, indistinguishable in the one
  column that is supposed to say who a session is. Closes #1. See *Naming the gems* in the README.
  **Breaking for a caller that drives the worker bootstrap directly**:
  `McpServer class>>prepareWorkerWithToolsets:options:readOnly:serverName:title:version:frontEnd:`
  gains a final `cacheName:` keyword.

* **The list-shaped tools page**: `limit` and `offset` on `list_all_classes`, `list_classes`,
  `list_dictionary_entries`, `list_test_classes`, `find_implementors`, `find_references_to`,
  `find_senders` and `search_method_source`, with a header naming the window, the total and the
  offset that fetches the next page. Defaults preserve what each tool answered before, and
  `limit: 0` answers the count alone. Not a breaking change to any existing call, but
  `search_method_source` now answers in **scan order rather than sorted** — sorting a collected
  prefix would let a name belonging on page 1 turn up on page 2.

* **`search_method_source` says when it does not know the total** (`of at least 201 … the total is
  not known`) instead of reporting the size of what it happened to collect. Its scan is the cost,
  so it stops one hit past the page rather than reading every method in the image to print a number.

* **The 50,000-character result cap names what it dropped**:
  `...[truncated: showing 50000 of 60002 characters]`, where it used to say only `...[truncated]`.
  Shared by `execute_code` and the Python tools.

* **The two long-output Grail tools page**: `list_python_methods` (the method lines page; the class
  name, its `.py` and the signature-table note stay outside the page) and `get_python_source`, which
  pages over **lines** and heads each page with the file line that page actually starts at — a page 2
  still headed with the definition's first line would point at the wrong place in the file. Source
  lines are re-emitted verbatim rather than re-joined, so a `.py` comes back with its own line
  endings.

* **`tools/list` refuses a cursor** with `-32602`, as the spec asks, instead of silently answering
  page 1. This server returns every tool in one page and issues no `nextCursor`, so a cursor
  arriving here came from somewhere else. See *Pagination* in the README.


## 0.7.0 — 2026-09-07

* **The classes now install into their own symbol dictionary, `Mcp`**, not `Published`. Migration is
  automatic — `install.sh` creates `Mcp` and unbinds the names it is about to define from every
  other dictionary in the symbol list. **Breaking for anything that provisions a GemStone user for
  MCP**: `Mcp` is in nobody's default symbol list, so a user without it fails with
  `undefined symbol McpServer` from the worker bootstrap. `install.sh`, `setup-oidc-users.sh` and
  the auth fixtures all add it; new provisioning code must too.
* **Renamed the `GS_MCP_*` environment variables to `MCP_*`**, and the `gs_mcp_*` shell functions to
  `mcp_*`. Breaking for existing launch scripts.
* **Blind-write guardrail**: a write tool refuses a subject this session has not read, and the reads
  are re-checked at every view move, so a stale read cannot silently clobber another session's work.
  Checked against a real second session, not only against the rules. See
  [docs/blind-write-guardrail.md](docs/blind-write-guardrail.md).
* `compile_class_definition` builds a class definition instead of evaluating one.
* **Progress notifications**: a long tool call reports progress on the request's own stream while it
  is still running, including the final tick.
* Cancellation: a call is stopped when its client says it no longer wants it.
* Two suites stopped moving the caller's transaction; the ones that must now declare
  `movesTheSessionView` and are gated.
* **View hygiene.** The front-end gem now runs `#transactionless` and refreshes its view at the
  start of every maintenance pass, so it stops holding a commit record the stone cannot dispose of.
  Worker views are measured against the repository and refreshed — keeping uncommitted work — when
  one falls too far behind; a session whose view cannot be moved at all is released once the stone
  is suffering for it; and a running call whose view pins the oldest commit record is ended, with
  the client told why. Configured by `maxCommitsBehind` (`MCP_MAX_COMMITS_BEHIND`),
  `pinnedViewGraceSeconds` and `stuckViewGraceSeconds`, all collected in one place — and `0` no
  longer means its own opposite. `frontEndTransactionMode: 'autoBegin'` restores the old frozen-view
  behaviour (`session-lifetime.sh` exposes it as `MCP_FRONT_END_TX_MODE`; `run-server.sh` does not).
  Note that `maxCommitsBehind` bounds drift *between* calls only. See `McpViewHygieneTest` and the `McpRouter` class comment.
* **The Grail toolset grew from two tools to seven.** `eval_python` and `compile_python` had been
  the whole Python surface since July. Added: `get_python_source` (the image's
  `inspect.getsource` answers an empty string, so this reads the `.py` that `co_filename` names),
  `run_python_tests` (in a gem with no history — a long-lived worker's `sys.modules` state made
  Grail's own suite report thousands of phantom errors), and `describe_python_class`,
  `list_python_methods`, `python_module_state`, which ask for a class by its Python name because a
  Grail class is created anonymously (`inDictionary: nil`) and no symbol dictionary names it.
  `eval_python` itself became a REPL: one module scope per worker, captured stdout, Grail's real
  multi-frame traceback, and Python's `repr` rather than Smalltalk's `printString`. New
  `grailDirectory` toolset option — a worker gem's working directory is the stone's, so it cannot
  infer where the checkout lives.
* **`run-unit-tests.sh` runs each suite in its own topaz session**, so one suite that blows up no
  longer takes the whole report with it. A Grail `ModuleNotFoundError` reaches `defaultAction`,
  which SUnit's `on: Error do:` does not catch, and it terminated the doit — printing a stack and no
  tally, so 484 passing tests were reported as "UNIT TESTS DID NOT RUN". Such a suite is now
  `ABORTED` and listed under `COULD NOT RUN`; the rest report, and the run still exits non-zero.
  The runner also accepts **`MCP_GRAIL_DIR`** now, with the same meaning and the same up-front check
  as `run-server.sh`, so `McpGrailToolsetTest` can find the Grail checkout its Python needs.

## 0.6.1 — 2026-09-02

* **UTF-8 on the wire in both directions**, replacing `\u`-escaped ASCII. A request body is decoded
  as UTF-8 whatever class the worker compiled it as, and a surrogate-pair escape is repaired on the
  way in. See [docs/utf8-wire.md](docs/utf8-wire.md).
* A hand-written JSON codec was added and then **reverted** in favour of the kernel's `JsonParser`
  plus a UTF-8 decode. The codec is preserved in this repository's history — added in `b57af7d`,
  removed in `f3b54c1`, last present at `fb2559b` — so adopting it again is a checkout, not a
  rewrite. Rationale: all the defects it covered are about astral characters, and no user has hit
  one live.
* **No request deadline by default.** The old 45-second default was the only thing killing long
  calls — measured, no client-side deadline bites. See
  [docs/MCP_Client_Notes.md](docs/MCP_Client_Notes.md).
* String literals compile as byte `String`s whatever the image's `#StringConfiguration` says.

## 0.6.0 — 2026-08-31

* **Client message tracing** (`MCP_TRACE=1`), including how a streamed answer ended — a closed
  stream otherwise leaves no message.
* A call can ask to be kept informed on a stream of its own.
* **Reaper accounting corrected**: derived probe/reaper counts round *up*, and a session pays for
  the pass it starts on. `streamlessIdleTimeoutSeconds` — the floor for a client that opens no
  stream — now defaults to 60 seconds, and `streamLossGraceSeconds` was documented for what it
  actually buys and for whom.
* A worker gem is **released when its client hangs up**, and when a test's `initialize` opened one.
* **Removed**: the server-initiated session warnings and the `logging` capability. No client read
  them, and the 2026-07-28 draft prohibits the pathway.
* A session keeps its work across tool calls, and the tools stopped committing it; the state a
  session can get stuck in is documented and tested.
* Stopped refreshing the view under the client, which was losing other sessions' work.

## 0.5.1 — 2026-08-26

* **Detects and works around pre-3.7.4.1 external-session result corruption** (kernel defect
  #51438), and refuses to start on an image that still fails the probe afterwards.
* Every worker response is checked against a per-call nonce.

## 0.5.0 — 2026-08-25

* **Session lifetime became configurable, and clients that are still there are no longer reaped.**
  Every interval is a router setting, serialised into the fork string: `reaperIntervalSeconds` (the
  maintenance pass, default 60s), `sessionIdleTimeoutSeconds` (`MCP_IDLE_TIMEOUT`),
  `maxSessionLifetimeSeconds` (an *absolute* expiry, nil for none), `livenessProbeIntervalSeconds`
  with `unansweredProbesBeforeGone` and `reapOnFailedProbe`, and `maintenanceCallTimeoutSeconds`. An
  unworkable combination is refused at startup rather than at reaping time. The idle timeout itself
  had been raised from 5 to 30 minutes back in 0.2.0; this replaced the fixed value with policy.
* Presence is decided by **counting evidence, not subtracting time**: a session that answers a
  liveness probe lives, one that stops answering has its gem freed early, and an answered probe does
  *not* move the activity clock. A probe lost to a stream handover is discarded rather than held
  against the session.
* A session **says when it was reaped, and why**; a warning goes out before an absolute deadline as
  well as an idle one; and a refreshed token buys its session more life.
* **A host suspend is detected** and forgiven, so a wildly late maintenance pass no longer reaps
  every live client at once. Verified over a real 3-hour sleep.
* Each session has an **outbox**, drained onto its SSE stream, so the server can speak first.
* **Runs on GemStone 3.7.2**: external sessions are built from selectors that exist before 3.7.5.
* **The OAuth/OIDC front end became an optional install group** — 3.7.2 has no kernel JWT support,
  so `install.sh` detects the image and leaves `src/auth` out. `--auth` turns a skip into an error,
  `--no-auth` forces one.
* Shell: catches a stone/gem version mismatch, documents `GEMSTONE_NRS_ALL`, and stops `grep`
  closing the `gslist` pipe early.

## 0.4.1 — 2026-08-24

* Harnesses find `lsof` before trusting its silence.

## 0.4.0 — 2026-08-24

* **The GemStone environment is resolved in one place** (`gs-env.sh`) and checked before installing;
  `install.sh --check` reports what it resolved without doing anything.
* `.setenv.example` that is not one machine's paths.
* The standalone SSE stream is gated on a live session.
* Worker forwarding is non-blocking, so one client cannot stall the front end; worker gem ids are
  cached at login so printing a worker is inert.

## 0.3.0 — 2026-08-21

* `serverInfo.title` for per-deployment display names.
* **The auth-less release line was retired**, and the auth branch folded into the development line.
  Every `load.gs` now pulls the auth classes in on an image that can compile them.

## 0.2.0 — 2026-08-20

* **Toolsets**: the seven core tool families were split into `Mcp*Toolset` classes, a deployment
  chooses its own, and read-only is gated at build time. `McpServerWithGrail` was retired — Grail
  became a toolset. A third-party toolset can own its handlers and vouch for its own read-only
  safety, and a named worker subclass can name itself.
* **Router configuration moved to the instance side** and is serialised into the fork string, so
  there is no class-side config state and no `ReadOnly` class variable. Per-router read-only, custom
  bind address; the auth router enforces TLS while the plain one is loopback-only.
* **Packaging went back to plain topaz `.gs` file-outs**; Rowan and Tonel were dropped.
* MCP conformance: `ping`, tool-execution errors for bad arguments, DELETE status codes.
* `supportedScopes` is derived (required + write + extra) and separate from `requiredScopes`.
* The workflow prompts were removed for now.
* Linguist told that `.gs` files are Smalltalk.

## 0.1.0 and earlier — 2026-07 to 2026-08

The first working server, in rough order:

* The tool surface, its unit tests, and repeated rounds of tightening them.
* **The server runs in a detached session** — it cannot be a background fork in an interactive gem.
* **Per-client sessions**: each client gets its own isolated worker gem.
* Transport conformance: cryptographically secure session ids, `Origin` validation,
  `MCP-Protocol-Version` validation, supported protocol versions, case sensitivity.
* **OAuth 2.1 / JWT**: `McpAuthRouter`, sessions started with a JWT, the `WWW-Authenticate`
  challenge, token validation, OIDC user setup, and the conformance suite.
* **TLS** (`GsSecureSocket`), with a test script.
* Hardening adopted from Jasper issue #347: closed schemas (`additionalProperties: false`), a
  kernel-class mutation guard, structured error `kind`s, and read-only mode.
* Optional Python tools for Grail images, segregated so the base server loads on any image.
* Back-compatibility work toward 3.6.2.
