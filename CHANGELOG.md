# Changelog

Notable changes to the native GemStone MCP server. The version is
`McpServer class>>defaultServerVersion`, which is what a client sees as `serverInfo.version` at
`initialize`.

Entries before 0.7.0 were reconstructed from git history when this file was started, so they group
work by theme rather than recording every commit, and the dates are the version bump on the line
that made it. Development ran on several lines at once during that period (`dev`, `dev2`, `dev372`),
each carrying its own bumps, so attribution to a release is approximate before 0.7.0. The project is
pre-release: breaking changes are expected and are called out rather than shimmed.

## Unreleased

* **The list-shaped tools page**: `limit` and `offset` on `list_all_classes`, `list_classes`,
  `list_dictionary_entries`, `list_test_classes`, `find_implementors`, `find_references_to`,
  `find_senders` and `search_method_source`, with a header naming the window, the total and the
  offset that fetches the next page. Defaults preserve what each tool answered before: the two that
  capped at 200 make 200 their default limit, and the rest still return everything unless a limit
  is passed. `limit: 0` answers the count alone. Not a breaking change to any existing call, but
  the truncation notes on `find_senders` and `search_method_source` are new text, and
  `search_method_source` now answers in scan order rather than sorted — sorting a collected prefix
  would let a name belonging on page 1 turn up on page 2.
* **`search_method_source` says when it does not know the total** (`of at least 201 … the total is
  not known`) instead of reporting the size of what it happened to collect. Its scan is the cost,
  so it stops one hit past the page rather than reading every method in the image to print a number.
* **The 50,000-character result cap names what it dropped**:
  `...[truncated: showing 50000 of 60002 characters]`, where it used to say only `...[truncated]`.
  Shared by `execute_code` and the Python tools.
* **The two long-output Grail tools page**: `list_python_methods` (the method lines page; the class
  name, its `.py` and the signature-table note stay outside the page) and `get_python_source`,
  which pages over **lines** and heads each page with the file line that page actually starts at —
  a page 2 still headed with the definition's first line would point at the wrong place in the file.
  `McpGrailToolset>>sourceFrom:startingAt:label:` split into `sourceLinesFrom:startingAt:label:`
  (finds the block, answers its lines and their first file line) and `pagedSource:args:` (renders
  one page); source lines are re-emitted verbatim rather than re-joined, so a `.py` comes back with
  its own line endings.
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
  plus a UTF-8 decode. The codec is preserved on the `emoji-safe` branch; adopting it again is a
  merge, not a rewrite. Rationale: all the defects it covered are about astral characters, and no
  user has hit one live.
* **No request deadline by default.** The old 45-second default was the only thing killing long
  calls — measured, no client-side deadline bites. See
  [docs/MCP_Client_Notes.md](docs/MCP_Client_Notes.md).
* String literals compile as byte `String`s whatever the image's `#StringConfiguration` says.
* Grail toolset: browses Python the way Grail actually stores it, runs Grail's tests in a gem with
  no history, and the launchers can name the Grail checkout.

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
* **The `auth` and `main` branches were consolidated onto `dev`.** The auth-less release line no
  longer exists; every `load.gs` now pulls the auth classes in on an image that can compile them.

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
