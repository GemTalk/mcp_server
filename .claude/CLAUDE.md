# Working on mcp_server

A Model Context Protocol server written natively in GemStone Smalltalk. Read
[README.md](../README.md) first — it is the reference for what the server *is*: install, transport,
the tool surface, architecture, and the test suites. This file is the operational layer on top of
it: how to make a change here without breaking something, and the image-level traps that cost time
if you meet them for the first time in a failing test.

Nothing here is machine-specific. Facts about *your* stones, netldis, IdP and hosts belong in a
`.claude/CLAUDE.local.md` (gitignored — copy `.claude/CLAUDE.local.md.example`).

## Reference documents

* [docs/Development.md](../docs/Development.md) — the contributor process: environment, the
  per-change loop, canonical file-outs, branches, releases, what to run before a PR.
* [docs/GemStone_Notes.md](../docs/GemStone_Notes.md) — image and kernel behaviour that has bitten
  this project. **Read the "silent" section before your first file-in.**
* [docs/MCP_Client_Notes.md](../docs/MCP_Client_Notes.md) — measured client behaviour and the
  protocol-era split; read before changing the transport or the dispatcher.
* [docs/blind-write-guardrail.md](../docs/blind-write-guardrail.md),
  [docs/session-lifetime.md](../docs/session-lifetime.md),
  [docs/utf8-wire.md](../docs/utf8-wire.md) — deep dives on three subsystems.
* [docs/ReadOnly_User.md](../docs/ReadOnly_User.md) — what bounds a session, now that nothing in
  this image does: the worker gem's GemStone user, privilege by privilege, and what is still open.
  Read it before adding anything that claims to restrict what a client can do.
* [CHANGELOG.md](../CHANGELOG.md) — what changed per release.

GemStone's own manuals are online and fetchable, and the product tree ships the kernel source; both
beat guessing at an API. See [docs/GemStone_Notes.md](../docs/GemStone_Notes.md#where-to-look-things-up).

## The shape of the thing

Three kinds of gem, and which one runs your code decides how it gets refreshed:

| | class | gem | picks up a recompile |
|---|---|---|---|
| front end | `McpRouter` / `McpAuthRouter`, `McpHttpConnection` | one detached gem owning the listen socket | within **two** maintenance passes (`reaperIntervalSeconds`, default 60s) |
| worker | `McpServer`, `McpDispatcher`, the `Mcp*Toolset`s | one per client session | next request (a worker is built per session, so a new session gets the new code) |
| driver | the suites | whatever topaz or MCP session you are in | immediately |

`./stop-server.sh && ./run-server.sh` is the only way to be *certain* which code a running server
is on. A transport fix that "doesn't take" while tool-layer fixes are live is usually just the front
end not having reached its next pass — wait one, then check the gem's start time.

The front end runs **transactionless** so it stops pinning the stone's oldest commit record. The
constraint that buys: front-end code must not read persistent object graphs — no walking a
committed collection, no caching a persistent object across statements. Stone primitives and
lookups by name are fine. `McpRouter`'s class comment says so too.

## Before you commit

1. **File the class out canonically.** Never hand-edit method blocks into a `.gs` file and never
   transcribe `export_class_source`. See
   [docs/Development.md](../docs/Development.md#canonical-file-outs) for the topaz recipe. The tree
   round-trips byte-exact, so a regenerated-vs-repo diff is a trustworthy signal — keep it that way.
2. **Verify the methods actually landed.** A `"` inside a method comment, or a lost `%` after a
   merge, drops a method with `errorcount` still reading 0. Compare the file's selectors against the
   image's, or the suite's test count against `grep -c '^test' <file>`.
3. **Run the unit suite** — `./install.sh && ./run-unit-tests.sh`. Exit 0 means every test passed.
   Each suite runs in its own topaz session, so a suite that blows up is reported `ABORTED` and
   listed under `COULD NOT RUN` rather than silencing the whole report. On a stone carrying the
   Grail toolset suite, pass `MCP_GRAIL_DIR=<Grail checkout>` or that suite cannot resolve its
   Python.
4. **Run `./test.sh` if you touched a tool schema, a guardrail, or `McpMutationToolset`.** It is the
   only check that drives the tools over the wire, and nothing in the unit suites covers it, so a
   break there is silent. When many of its checks fail at once, fix the **first** and re-run — a
   closed schema turns one stale argument into a cascade.

## Writing tests

The project is biased toward full SUnit coverage: add tests for new behaviour and new branches even
when the fixtures are heavy (a committed throwaway JWT user, a second gem staging a real conflict).
Confidence outweighs the setup cost.

Four traps specific to this suite:

* **Never name a helper after a framework selector** — `run:`, `run`, `runCase`, `setUp`,
  `tearDown`, `resources`, `assert*`, `debug`. A helper named `run:` shadows `TestCase>>run:`, and
  `suite run` then reports `0 run` as a silent pass. Prefix helpers distinctly: `runRequest:`,
  `callTool:arguments:`.
* **Never prefix a fixture accessor with `test`.** `testSelectors` collects every zero-argument
  selector starting with `test`, so `testIssuer` is silently run as a test that asserts nothing.
  Name it `conformanceIssuer`. Audit with `cls testSelectors size` against the tests you wrote.
* **A suite that commits or aborts must declare `movesTheSessionView`** (class side, answering a
  reason string). Otherwise `run_test_class` will run it from a session with pending work and eat
  the caller's changes. This is opt-in via `respondsTo:` — nothing reminds you. Ask: does the test,
  its fixture helper, or its `tearDown` send `commitTransaction` or `abortTransaction`? If it forks
  a gem, also add it to `mcp_require_netldi_if_forking_suite_installed` in `run-unit-tests.sh`.
* **Strip the `[session]` footer, don't loosen the assertion.** Every tool result gains a
  `[session]` line while the driving session is dirty, so an exact-text assertion passes alone and
  fails in its suite. Use `#withoutSessionNote:` (three copies exist; the canonical comment is on
  `McpGrailToolsetTest`). Do not relax to a prefix/substring match, and do not abort in `setUp` —
  that moves the caller's transaction. Diagnose by running the test alone, then after
  `<Suite> suite run`: if only the second fails, dump the response body.

Pair the two kinds of test deliberately. Direct-drive suites prove the rules; only a suite that
stages a **real** second session reaches the code that runs when a commit genuinely fails.

## Conventions

* **Match the codebase; don't invent structural patterns.** No deprecation aliases, no instantiation
  guards, no defensive ceremony that nothing else here does. Document intent in a class comment
  instead. But check whether the *framework* already provides the idiom first — `should:raise:`
  lives on `GsTestCase` itself, so it was the house API all along even though no suite used it.
* **Prefer a clean break to a compatibility shim.** The project is pre-release; say plainly what
  breaks, in the commit message and the README, rather than absorbing it in code. A specific
  instruction to preserve compatibility overrides this.
* **Write for the supported versions, 3.7.5 and 3.7.6+.** Anything present in 3.7.5 may be
  referenced directly; the live concern is only what is newer than that. Prefer the most basic,
  long-stable selector that works. GemStone has no notion of an "optional"
  method — absence shows up only as a `doesNotUnderstand` at runtime, so there is no list to check
  against; the live suite on the loaded extent is the test. See
  [docs/Development.md](../docs/Development.md#version-support) for the current matrix.
* **`Mcp` is the home dictionary**, not `Published`. Any new code that provisions a GemStone user
  for MCP must add it to that user's symbol list:
  `up insertDictionary: (System myUserProfile objectNamed: #Mcp) at: up symbolList size + 1.`
* **Check the running version rather than trusting a stated one** — `System gemVersionReport`
  (`gsVersion` / `gsRelease`), `System stoneName`. Stones get switched without announcement.
* The single home for the server version literal is `McpServer class>>defaultServerVersion`.
  Bumping it is a release act, not part of an ordinary change.
