# Native GemStone MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server written natively in
GemStone Smalltalk. It runs **inside** the image and executes tool calls directly — no
Node.js process, no GCI/FFI bridge. The goal is to replace the GCI-based Jasper MCP
server with one that any MCP client can reach over plain HTTP.

**Status:** the Streamable HTTP transport, per-client worker gems, 31 base tools (+9 optional
Python), OAuth 2.1 / JWT + TLS, per-router worker identity and server-initiated messages are built
and verified end-to-end — by curl, by a TLS run, and by the in-image suites. What is *not* built is
listed under [Future work](#future-work).

**A note about versions.** The supported images are **3.7.5 and 3.7.6+**, whose implementation of
`System continueTransaction` the server's view handling relies on — see
[docs/GemStone_Notes.md](docs/GemStone_Notes.md#version-to-version-differences) for the
measurements. Within that range what you get depends on the image, and `install.sh` works it out
for you:

| image | base server (`run-server.sh`) | OAuth/OIDC front end (`run-auth-server.sh`) |
|---|---|---|
| **3.7.5** | yes | yes, against a local IdP |
| **3.7.6+** | yes | yes, including an external OIDC IdP |

`src/auth` needs `JsonWebToken` and `JwtSecurityData` (and, to log a worker in,
`GsTsExternalSession>>jwtPassword:`), none of which exist before 3.7.5, so `install.sh` detects what
the image has rather than asking. The 3.7.6 line is a separate matter: earlier releases have a bug
connecting to an *external* OIDC IdP.

## Other documentation

This README is the reference for what the server is and how to run it. Alongside it:

* [CHANGELOG.md](CHANGELOG.md) — what changed per release.
* [docs/Development.md](docs/Development.md) — **start here to contribute**: environment, the
  per-change loop, canonical file-outs, testing, branches and releases.
* [docs/GemStone_Notes.md](docs/GemStone_Notes.md) — image and kernel behaviour that has cost this
  project time, most of it invisible in the source. Its first section is the silent failures.
* [docs/MCP_Client_Notes.md](docs/MCP_Client_Notes.md) — measured client behaviour, and where the
  protocol revisions contradict each other.
* [docs/blind-write-guardrail.md](docs/blind-write-guardrail.md),
  [docs/session-lifetime.md](docs/session-lifetime.md), [docs/utf8-wire.md](docs/utf8-wire.md) —
  deep dives on three subsystems.
* [.claude/CLAUDE.md](.claude/CLAUDE.md) — the same process as `docs/Development.md`, condensed for
  a coding agent with the traps attached. Machine-specific facts go in a gitignored
  `.claude/CLAUDE.local.md` (template: `.claude/CLAUDE.local.md.example`).

## Install & run

```bash
export GEMSTONE=/path/to/GemStone64Bit3.7.x   # product dir

./install.sh --check                # verify the environment and report what would be installed
./install.sh                        # file in the classes and commit; auth included if the image can
./install.sh --auth                 # ...and fail loudly if it cannot, instead of quietly skipping
./install.sh --no-auth              # ...or leave the auth group out of an image that could take it
./install.sh --grail                # ...plus the optional Grail/Python toolset (Grail image only)
MCP_PORT=8000 ./run-server.sh       # fork a detached, independent localhost server gem and return
MCP_WORKER_USER=McpReadOnly ./run-server.sh   # ...every worker gem as a restricted GemStone user
MCP_TOOLSETS="McpBrowsingToolset McpSearchToolset" ./run-server.sh   # ...only these tools
MCP_WORKER_CLASS=MyMcpServer ./run-server.sh                         # ...a subclass as the worker

# ...the core tools PLUS the optional Python toolset. Naming it is what turns it on: installing
# src/grail puts McpGrailToolset in the image, and nothing more. Same shape for your own toolset.
MCP_TOOLSETS="McpBrowsingToolset McpExecutionToolset McpListingToolset McpMutationToolset \
  McpSearchToolset McpSessionToolset McpTestingToolset McpGrailToolset" \
  MCP_GRAIL_DIR=/path/to/Grail ./run-server.sh
MCP_TRACE=1 ./run-server.sh         # ...logging every message a client sends (see Message trace)
./run-auth-server.sh                # ...the OAuth/OIDC network-facing server (McpAuthRouter)
```

`install.sh` and the `run-*.sh` scripts use topaz; set `GEMSTONE`, `GS_STONE`, `GS_USER`,
`GS_PASS` to match your environment — and read **Environment** below before assuming those four are
enough, because on many machines they are not. `install.sh` files the code in with topaz, one
group at a time: `src/core` and `src/tests` always, `src/auth` when the image can compile it, and
`src/grail` on `--grail` (or `MCP_WITH_GRAIL=1`).

The two optional groups are selected differently on purpose. Loading `McpAuthRouter` is inert —
nothing instantiates it until you fork one with `run-auth-server.sh` — so it can be detected rather
than asked about, and `install.sh` probes the image for `JsonWebToken` to decide. Loading
`McpGrailToolset` is inert too, deliberately: it is **not** in the default tool surface
(`McpServer class>>defaultToolsetNames`), so filing it in adds a class to the image and changes no
server. It nonetheless stays **opt-in at install**, because the probe that works for auth does not
work here — `ModuleAst` being present does not mean the Grail these tools were written against, and
a group that cannot compile takes the file-in down with it. Use `--auth` to turn a skip into an
error, `--no-auth` to force one; `--check` reports the decision without installing anything.

`run-server.sh` builds a base `McpRouter` instance and calls
its `forkOnPort:` (`run-auth-server.sh` builds an OIDC-configured `McpAuthRouter` — resource-server
config as code, no commit), which launches a detached, independent front-end gem and returns; stop it
with `./stop-server.sh` (by port), or the `System stopSession: <id>` / `kill <pid>` line it prints.
The front end resolves the tool surface per session: `MCP_TOOLSETS` if it is set, otherwise the core
seven and nothing else. **No toolset joins that surface by being loaded** — an optional one, this
project's `McpGrailToolset` included, is served only by a router that names it. That keeps having a
toolset in the image and running it as two decisions, which matters when the toolset carries a
dependency of its own: Grail's tools read the checkout on disk that `MCP_GRAIL_DIR` names.

### Environment

Every script here sources `gs-env.sh`, which resolves the environment and refuses to continue on a
misconfigured one. `--check` runs that resolution and reports without doing anything else; it is the
first thing to run on a machine you have not installed on before.

```
$ ./install.sh --check
product      /opt/gemstone/GemStone64Bit3.7.5-x86_64.Linux
global dir   /opt/gemstone

servers visible to this client:
  Status     Version   Owner        Pid  Port  Started      Type    Name
  OK         3.7.5     gsadmin    96453 65166 Aug 23 12:31  Netldi  gs64ldi
  OK         3.7.5     gsadmin    60042 56820 Aug 20 08:53  Stone   gs64stone

OK: environment looks usable for gs64stone.
```

**`GEMSTONE_GLOBAL_DIR` is the variable that decides whether anything works**, and it is the one the
old four-variable advice left out. Get it wrong and every script fails at `login` with:

```
could not find server 'gs64stone' on host 'somehost' because service not found,
getaddrinfo failed, EAI error 8   ... Number: 4065
```

That message names `getaddrinfo`, so it reads like a DNS or `/etc/services` problem. It is not.
With no `/etc/services` entries a stone and a netldi each bind an **ephemeral** port and record it
in `$GEMSTONE_GLOBAL_DIR/locks/<name>..LCK`; clients read those lock files. A client pointed at a
different `GEMSTONE_GLOBAL_DIR` than the stone was *started* with finds no lock file and falls back
to a hostname/service lookup, which fails. The product's built-in default is `/opt/gemstone` (then
`/usr/gemstone`), so any installation keeping its locks elsewhere must tell its clients where.

`.setenv.example` is a starting point: copy it to `.setenv` (git-ignored) and edit it for your
machine. Most of it is optional — `gs-env.sh` discovers it rather than making you guess: it asks `gslist` under each candidate and
uses the one where the running servers actually are, saying so when it has to correct or supply a
value. `gslist` is the authority here — it reads the same lock files the GCI client does.

Do **not** reach for `/etc/services`. Registering a stone or netldi there is unnecessary once
`GEMSTONE_GLOBAL_DIR` is right, and it is a trap: netldi binds the port named in `/etc/services`
only if it is **restarted** after the entry exists, so an entry added to a running system is stale
by construction and points at a port nothing is listening on.

**Which scripts need a netldi.** `install.sh` talks only to the stone, so it runs fine on a host
with no netldi at all. The `run-*.sh` scripts need one — not because of how they log in, but
because `McpRouter>>forkOnPort:` and every per-client worker create a `GsTsExternalSession`, and
netldi is what forks those gems. `run-unit-tests.sh` needs one too: four of
its suites spawn a real worker gem (`McpExternalSessionTest`, `McpTransactionTest` and
`McpWorkerDeadlineTest` always, `McpAuthTest` where the auth group is installed). It asks the image which are present rather than
insisting unconditionally. Each script checks for what it actually needs, and says which is missing.

**Linked vs RPC.** These scripts run `topaz -l` (linked). That is deliberate, and it is not the
cause of the error above: a linked login resolves the stone through the same lock files, so it
needs `GEMSTONE_GLOBAL_DIR` and nothing else — no netldi, no NRS, no service entries. Dropping `-l`
routes the login through netldi instead, which works equally well once `GEMSTONE_GLOBAL_DIR` is
right, but it would make `install.sh` depend on a netldi it otherwise has no use for.


## Transport

A single endpoint, `/mcp`, implementing the MCP **Streamable HTTP** transport with **per-client
sessions** — each client gets its own isolated worker gem (see [Per-client sessions](#per-client-sessions)):

- **POST `/mcp`** — body is a JSON-RPC 2.0 request; reply is an `application/json` JSON-RPC
  response (notifications get `202 Accepted`, no body).
  - `initialize` opens a session and returns its id in the **`MCP-Session-Id`** response header.
  - Every other request must send that header back; a missing id → **`400`**, an unknown/expired
    id → **`404`** (a compliant client then re-initializes).
- **GET `/mcp`** — opens the standalone server→client SSE stream (`text/event-stream`) for the
  session named by `MCP-Session-Id`, and carries the messages the server sends **first** (see
  [Server-initiated messages](#server-initiated-messages)). Same session gates as the other verbs:
  missing id → **`400`**, unknown/expired → **`404`**. Held open with a keepalive comment every 15s
  between messages.
- **A POSTed JSON-RPC *response*** — a body with an `id` and no `method`, which is how a client
  answers a request the server sent it — is acknowledged with **`202 Accepted`** and no body.
- **`notifications/cancelled`** — the client saying it no longer wants a request in flight (what
  Claude Code sends when the user presses Esc). Acknowledged with **`202 Accepted`** and no body,
  and the call it names is **ended**: the same soft break → hard break → stop escalation a request
  deadline uses, so it costs the client that request and not its gem. The cancelled request's own
  connection gets `202` and no body either, since the spec asks a receiver not to answer a request
  the client has stopped waiting for. Handled in the front end rather than routed to the worker —
  routing it would queue it behind the very call it asks to stop.
- **DELETE `/mcp`** — ends the session named by `MCP-Session-Id` (closes its worker). Answers the
  same codes as the POST path: missing header → **`400`**, unknown/already-ended id → **`404`**,
  live session → **`200`**.
- Any other method → `405`.

`ping` is answered with an empty result on every session, as the spec requires — and is also **sent**
by the server, as a liveness probe on idle sessions.

Declared capabilities: `tools`, and nothing else. `logging` was declared until 2026-08-27 to license
`notifications/message` as the carrier for the front end's session warnings; those warnings are gone
(see [Session lifetime](docs/session-lifetime.md)), so `logging/setLevel` is now answered `-32601`
like any other undeclared method. Progress needs no capability either way: `notifications/progress`
is a base-protocol utility a **client** opts into per request, via a `progressToken` in `_meta`.

**Security (per the MCP spec):** the server binds only to `127.0.0.1`, session ids are
cryptographically-random 128-bit tokens, and every request's `Origin` header is validated to
prevent DNS-rebinding — a present `Origin` whose host is not loopback (`localhost`/`127.0.0.1`/`[::1]`)
gets **`403`**; an absent `Origin` (non-browser clients like curl) is allowed. Add a browser app's
origin host by configuring the router instance — `(McpRouter new allowedOriginHosts: #(...)) forkOnPort: 8000`.
For network-facing use,
the optional `McpAuthRouter` subclass (see [Install & run](#install--run)) adds OAuth 2.1 / JWT
bearer-token authentication (per-user worker gems),
a `WWW-Authenticate` challenge + RFC 9728 Protected Resource Metadata, TLS (`GsSecureSocket`), and
per-user worker identity; the base `McpRouter` is the localhost, unauthenticated front end, and the
one that can run every worker as [a restricted GemStone user](#browsing-only-deployments-the-worker-gems-gemstone-user).

```
# initialize -- the response carries an MCP-Session-Id header
curl -si localhost:8000/mcp -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# subsequent calls echo that id back
curl -s localhost:8000/mcp -H 'MCP-Session-Id: <id>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Works with the **MCP Inspector** / any MCP SDK client using the *Streamable HTTP* transport
pointed at `http://localhost:8000/mcp` (such clients manage the `MCP-Session-Id` automatically).

### Protocol conformance

The server speaks MCP revisions **`2025-06-18`** and **`2025-11-25`** (`McpDispatcher class >>
supportedProtocolVersions`, the single source of truth for both `initialize` negotiation and the
`MCP-Protocol-Version` header check, so the two cannot drift). `initialize` echoes the client's
version when supported, otherwise answers `2025-11-25`.

`2025-03-26` is deliberately **not** supported: a server on that revision must accept JSON-RPC
*batches*, which the single-object body parser does not. `2025-06-18` removed batching.

| Requirement | Behavior |
|---|---|
| `initialize` version negotiation | echo if supported, else our latest |
| `ping` | empty result (spec MUST) |
| `tools/list`, `tools/call` | implemented; `tools` is the only declared capability |
| `tools/list` pagination | one page, no `nextCursor`; a `cursor` is refused `-32602` (see [Pagination](#pagination)) |
| `resources/*`, `prompts/*`, `logging/*`, `completion/*` | undeclared and answered `-32601` |
| Notification POST | `202 Accepted`, no body |
| `notifications/cancelled` | `202 Accepted`; the named call is ended, and gets no response of its own |
| Invalid `Origin` | `403` |
| Invalid/unsupported `MCP-Protocol-Version` | `400` |
| Missing session id / unknown-expired session id | `400` / `404`, on both POST and DELETE |
| Malformed body | `400` + `-32700` |
| Tool input schemas | JSON Schema 2020-12 (no `$schema` needed), closed with `additionalProperties: false` |

`serverInfo.title` is sent when a deployment configures one (see *Writing your own MCP server*) and
omitted otherwise, so a client falls back to displaying `name`. That is the **server**'s title; a
**tool** `title` is not implemented.

Not implemented, all optional at these revisions: `listChanged` notifications, SSE resumability (`Last-Event-ID` — no event `id:` is
emitted at all, deliberately: ids without a replay buffer behind them invite a resume the server
cannot honour), progress notifications, elicitation, sampling, resources, prompts, tool `title` /
`annotations` / `icons` / `outputSchema`, server `instructions`, and `tasks`.

The **draft `2026-07-28`** revision is a different protocol era — no `initialize`, no sessions, no
GET stream, per-request `_meta`, and a mandatory `server/discover`. It is not implemented, and
supporting it will need a decision about how per-client worker-gem isolation survives a protocol
with no session id to key it on.

### Pagination

There are **two** paginations here, and they are not the same mechanism.

**The protocol's** pagination is an opaque `cursor` in and an optional `nextCursor` out, defined for
exactly four *list operations* — `resources/list`, `resources/templates/list`, `prompts/list` and
`tools/list`. The text is word-for-word identical in both revisions this server speaks. `tools/list`
is the only one of the four implemented here, and it answers the whole tool surface in **one page**:
`nextCursor` is optional and its absence is defined as the end of the results, and a few dozen
descriptors already in memory buy nothing from a second round trip. Because no cursor is ever
issued, a cursor arriving in `tools/list` cannot have come from this server, so it is refused with
`-32602` — the code the spec asks for on an invalid cursor. Returning page 1 to a client that asked
to resume elsewhere is the one wrong answer available.

**A tool result** has no cursor, no `nextCursor` and no page in the protocol at all. So the
list-shaped tools page in arguments of their own: `limit` and `offset`, with a header line that
names the window, the total and the offset that fetches the next page.

```
(showing 1-200 of 1417; pass offset: 200 for the next page)
```

Defaults preserve what each tool answered before: `find_senders` and `search_method_source`, which
capped at 200, now make 200 their default *limit* — the same first answer, with a way to ask for the
rest — and the tools that had no cap still return everything unless a limit is passed. A listing an
agent reads to *find* a name is worse truncated than long, so truncation stays the client's choice.
`limit: 0` answers the count alone. A negative or non-integer `limit`/`offset` is a tool error of
kind `invalidParams`.

`search_method_source` is the one tool that cannot report a true total: the scan *is* the cost, so
it stops one hit past the page and says so (`of at least 201 … the total is not known`) rather than
printing the size of what it happened to collect as if it were the answer. Its hits come back in
scan order for the same reason — sorting a collected prefix would let a name belonging on page 1
turn up on page 2.

The two Grail tools that answer long output page too. `list_python_methods` pages the method lines
while keeping the class name, its `.py` and the signature-table note *outside* the page — a page 2
that had lost the class it belongs to would be a list of signatures attached to nothing.
`get_python_source` pages over **lines**, and its `# <path>:<line>` header advances with the page:
page 2 of `json.py` is headed with the line page 2 actually starts at, because a header that still
named the definition's first line would point a model at the wrong place in the file and look
authoritative doing it.

Results that are one *value* rather than a list — `execute_code`, `eval_python` — are still
capped at 50,000 characters, but the marker now names what was dropped:
`...[truncated: showing 50000 of 60002 characters]`.

## Tools (31 base + 9 optional Grail)

**Execution**

| Tool | Arguments | Result |
|------|-----------|--------|
| `execute_code` | `code` | `printString` of evaluating the Smalltalk source |

**Session / transaction**

| Tool | Arguments | Result |
|------|-----------|--------|
| `abort` | – | discard uncommitted changes and refresh the view *(destructive)* |
| `commit` | – | persist this session's changes. **The only tool that commits** |
| `refresh` | – | refresh the view to see other sessions' commits, **keeping** uncommitted changes |
| `status` | – | session user, id, stone, uncommitted-changes flag |

A worker gem sits in one long-lived GemStone transaction and sees **one consistent snapshot** of the
repository. A change made by one tool call is still there for the next one, so the ordinary
Smalltalk loop — compile, run the tests against what you compiled, *then* commit — works across
calls. Nothing commits on the client's behalf; a result whose session has uncommitted changes
carries a one-line `[session]` note saying so, and naming what would end the session before the work
is committed.

**No tool refreshes the view.** The client moves it with `commit`, `abort` and `refresh`, and no tool
call does it as a side effect. That is the guardrail rather than an oversight: GemStone's conflict
check is write-write *against the view* and does not track what a session read, so the view is the
only record the stone holds of what this client has seen. A client that reads a method, deliberates
over several calls, and then rewrites it has its `commit` **refused** if someone else changed that
class in the meantime — nothing is silently overwritten. Refreshing *around a call* would assert the
client had seen changes it had not, and turn that refusal into a silent overwrite; two earlier
designs did exactly that, first with `System abortTransaction` before every tool and then briefly
with `System continueTransaction`. The same reasoning is why `refresh` is not free: it adopts the
other version as your starting point, so re-read anything you are about to act on.

**The one exception is the server's own view hygiene, and it is a different act.** A view is also a
commit record the stone cannot dispose of, so a session that never moves its view holds the whole
repository's backlog open — measured on a live stone, one front-end gem sat on the oldest record for
15 hours, and a worker left idle through an ordinary edit-install-test loop falls *hundreds* of
commits behind in minutes. So when a worker's view is at least `maxCommitsBehind` commits behind (20
by default, and the effective limit is the lower of that and the stone's own
`STN_SIGNAL_ABORT_CR_BACKLOG`), the front end sends it one `System continueTransaction`. Four things
keep that from being the rejected design over again: it happens **between** calls and never with one
in flight; it **keeps** the client's uncommitted changes; a pending write is validated rather than
laundered, because the kernel carries the write set forward and answers whether it now conflicts;
and the client is **told** on its next result, with the reads that went stale named. Nothing about
the state of the stone can trigger it — only the session's own distance from the current state, since
refreshing a worker that is not far behind cannot shorten a backlog its view was not pinning.
`MCP_MAX_COMMITS_BEHIND=none` turns it off.

Two things a view can do that no refresh reaches, and both end the session's current work rather than
its view. If GemStone refuses to move the view at all — after a commit that failed on conflict, or
inside a nested transaction — nothing this server sends will free that commit record, so under
sustained pressure the session is **reaped** (`MCP_STUCK_VIEW_GRACE`); its pending work was
already un-committable, and a reap is loud where a silent abort would not be. And while a call is in
flight the view cannot be refreshed at all — GCI allows one call per session — so a call that has
held the *oldest* record open across `MCP_PINNED_VIEW_GRACE` of real backlog pressure is **ended**,
with an error saying so. Neither is a time limit: on a quiet repository a long call runs untouched,
however long it takes.

The **front-end** gem holds no view at all: it runs `#transactionless` and takes a fresh view once
per maintenance pass, so the one gem that never needs a stable view stops being a commit-record
hoarder. `MCP_FRONT_END_TX_MODE=autoBegin` restores the older behaviour for front-end code of your
own that does need one. All four knobs are documented, and validated, in
[session-lifetime.sh](session-lifetime.sh) alongside the session-lifetime family.

**Listing**

| Tool | Arguments | Result |
|------|-----------|--------|
| `list_all_classes` | `limit?`, `offset?` | every class across all dictionaries, sorted |
| `list_classes` | `dictionaryName`, `limit?`, `offset?` | classes in a dictionary, sorted |
| `list_dictionaries` | – | symbol dictionaries in lookup order |
| `list_dictionary_entries` | `dictionaryName`, `limit?`, `offset?` | every entry, tagged (class)/(global), sorted |

**Browsing**

| Tool | Arguments | Result |
|------|-----------|--------|
| `describe_class` | `className` | superclass, instance vars, selectors |
| `export_class_source` | `className` | full Topaz file-in (definition + methods) |
| `get_class_definition` | `className` | class-definition source expression |
| `get_class_hierarchy` | `className` | superclass chain + direct subclasses |
| `get_method_source` | `className`, `selector`, `meta?` | method source |
| `list_methods` | `className` | instance + class selectors grouped by category |

**Search**

| Tool | Arguments | Result |
|------|-----------|--------|
| `find_implementors` | `selector`, `limit?`, `offset?` | methods implementing the selector |
| `find_references_to` | `name`, `limit?`, `offset?` | methods referencing a named global/class |
| `find_senders` | `selector`, `limit?`, `offset?` | methods sending the selector (200 at a time by default, with the true total) |
| `search_method_source` | `pattern`, `dictionaryName?`, `limit?`, `offset?` | methods whose source contains the substring (200 at a time by default, in scan order) |

**Mutation**

None of these commit — call `commit` when you want the change to outlive the session, or `abort` to
throw it away. Every one of them is undone by `abort`, including the two that look like they would
not be: a shape-changing class redefinition (the previous class comes back with its methods, and the
class history shrinks back with it) and a symbol dictionary added to or removed from the user's
symbol list.

| Tool | Arguments | Result |
|------|-----------|--------|
| `add_dictionary` | `dictionaryName` | create + append a dictionary |
| `compile_class_definition` | `className`, `superclassName?`, `instVarNames?`, `classVars?`, `classInstVars?`, `poolDictionaries?`, `dictionary?`, `options?`, `recompileMethods?` | define or redefine a class from named parts; the server builds the definition itself and evaluates nothing, so this tool cannot run arbitrary code (use `execute_code` for that); on a shape change, by default recompiles the class's methods onto the new version and reports any that fail (refused if it has subclasses) |
| `compile_method` | `className`, `source`, `category?`, `meta?` | compile a method |
| `delete_class` | `className` | remove a class *(destructive)* |
| `delete_method` | `className`, `selector`, `meta?` | remove a method *(destructive)* |
| `remove_dictionary` | `dictionaryName` | remove a dictionary *(destructive)* |
| `set_class_comment` | `className`, `comment` | set the class comment |

**Testing (SUnit)**

| Tool | Arguments | Result |
|------|-----------|--------|
| `describe_test_failure` | `className`, `selector` | re-run one test in isolation, return the failure/error detail (exception class + `description`) |
| `list_failing_tests` | `classNames?` | failing/erroring methods (given classes, or all) |
| `list_test_classes` | `limit?`, `offset?` | all `TestCase` subclasses, sorted |
| `run_test_class` | `className` | run a test class, summary + failures |
| `run_test_method` | `className`, `selector` | run one test method |

**Python (optional — the `McpGrailToolset`)**

These live in the optional `McpGrailToolset`, in its own source group (`src/grail/`) which only
`install.sh --grail` loads — they reference `ModuleAst` and `BaseException`, so they cannot compile in
an image without Grail. Loading it does not serve it: the toolset is **not** in the default surface,
and a server has these tools only when its router names `McpGrailToolset` in `toolsetNames`
(`MCP_TOOLSETS` from either launcher). Starting a Grail server is a toolset configuration, and the
worked example for configuring your own.

| Tool | Arguments | Result |
|------|-----------|--------|
| `compile_python` | `code` | transpile Python source to Smalltalk via Grail (`ModuleAst`), return the generated source |
| `eval_python` | `code` | evaluate Python in this session's persistent namespace; returns anything printed to stdout, anything written to stderr (each line marked `[stderr] `), then the value's `repr` — and on failure those same two channels ahead of the Python traceback |
| `get_python_source` | `name`, `limit?`, `offset?` | source of a module, class or function named dotted (`gemdb.transaction`), read from the `.py` it was loaded from; pages over **lines**, and the `# path:line` header names where the page starts |
| `run_python_tests` | `classNames` *(optional)* | run Grail's `PythonTestCase` classes **in a fresh gem** and report the result structurally |
| `describe_python_class` | `name` | a Python class: backing Smalltalk class, storage base, `__bases__`/`__mro__`, `__slots__`, class attributes, method names |
| `list_python_methods` | `name`, `limit?`, `offset?` | its methods with real signatures (parameter names *and* defaults) and the `.py` line each was defined at, in source order |
| `python_module_state` | `name` | what a module **is** here — native or `.py`, canonical, committed, current or stale, in `sys.modules` — and what the next import would do |
| `find_python_senders` | `name`, `shapes?`, `scope?`, `includeNative?`, `includeTests?`, `limit?`, `offset?` | who calls or refers to a Python name, across all three shapes Grail compiles a reference into; every answer ends with what was and was not searched |
| `search_python_source` | `pattern`, `scope?`, `includeTests?`, `limit?`, `offset?` | case-sensitive substring search over the checkout's `.py` files — the Python analogue of `search_method_source`, and the only tool here that answers for a module nothing has imported |

> **`find_python_senders` exists because the stock sender search is not merely incomplete — it is
> wrong.** `ClassOrganizer` scans environment 0 and Grail compiles Python into environment 1, so
> asking it who calls a Python name gets an empty answer rather than a partial one. Measured on
> 3.7.5 with `_grail_session` imported: `sendersOf: #'_dict'` and `sendersOf: #'__dict:kw:'` each
> answer an empty pair of arrays where **12** senders exist, and `find_senders` through MCP answers
> `(none)`. A false negative about code costs more than a slow answer about it.
>
> A Python reference compiles to three unrelated things, and no one of them is the answer, so the
> tool searches all three and *says which it searched*: **compiled** call sites, found in a
> generated method's selector pool and positioned from the source; **references**, where a
> first-class use (`g = abs`) or an unresolved attribute call (`os.path.isdir(x)`) leaves a Symbol
> literal and no selector at all; and **source**, the `.py` text, which is the only shape that can
> answer for a module nothing has imported in this session. Every answer ends with a `searched:` and
> a `not searched:` block, each gap naming the argument that closes it — because "no senders" is
> only worth reading if it can be told apart from "I could not look there".
>
> **It never imports.** Matching is syntactic: the last
> segment of the name is what is matched, and leading segments narrow and label. Resolving the name
> instead would buy exact arities and would make a *search* a database write, since a cold import in
> Grail compiles. Over-matching is reported rather than avoided — a bare name answers hits in every
> module that has one, each labelled — and `scope` narrows at a dot boundary, so `flask` does not
> select `flask_login`.
>
> **What it cannot see, it says.** Grail registers module-scope class statements only, so a nested
> class is not enumerable; a function defined in an `eval` scope compiles to a block with no
> selector pool; a module whose `.py` nothing has imported has nothing compiled to search; and under
> `GRAIL_IR_CODEGEN` a method carries the user's Python with no position store, so a hit's line
> reads `?` rather than a guess. Three public interfaces that would close these gaps are filed as
> [GemTalk/Grail#883](https://github.com/GemTalk/Grail/issues/883),
> [#884](https://github.com/GemTalk/Grail/issues/884) and
> [#885](https://github.com/GemTalk/Grail/issues/885).
>
> **`tests/python` is excluded by default** — a relevance choice, not a cost one. The stdlib is
> 1,412 files and 426,131 lines and reads in 248 ms; the fixtures would add about 75 ms. What they
> would also add is test code among the answers to "who calls this". `includeTests: true` includes
> them, and the trailer says so when they are left out.

> **Why a Python class needs its own describe tool.** Grail creates every user Python class
> **anonymously** (`inDictionary: nil`), so nothing in any symbol dictionary names it: `list_classes`
> cannot see it and `describe_class` cannot be pointed at it. It has to be asked for by its *Python*
> name, and the answer has to say which Smalltalk class is underneath — because that is the one every
> other tool here takes. The **storage base** is the line to read closely: a Python class does not
> wrap its data, it *is* a GemStone object, so `class X(str)` is backed by `Unicode32` and
> `class Y(list)` by `OrderedCollection`, and that is what decides which env-0 protocol its instances
> already answer. Names resolve through Python (importing as needed) rather than through the
> `GrailCanonicalClasses` registry, which records module-scope classes only and is emptied wholesale
> by the generation guard after a Grail install.
>
> **`list_python_methods` carries what a selector cannot.** `pop(key, default=None)` compiles to the
> Smalltalk selector `_pop:kw:` and `update(*args, **kwargs)` to `_update:kw:` — the same shape,
> because the generated glue takes a positional array and a kwargs dict whatever the Python
> signature was; `__setitem__(key, value)` becomes `__setitem__:_:`. Arity is the most a selector
> carries and often not even that. The names, the defaults, and which parameters are `*args`,
> `**kwargs`, positional-only or keyword-only all come from the class's own signature table, and
> the signature is written the way `inspect.signature` writes it, `/` and bare `*` included — so a
> signature here can be called as it reads. The selector is only a fallback (the tool says so when
> it had to use one). Reading a name *off* a selector is done by recognising the whole encoding:
> truncating at the first colon is a documented way to invent attributes that do not exist — it
> manufactured `perform`, `value` and `with` on 40 of 42 subjects in Grail's own `dir()` census.
>
> **`python_module_state` answers a question CPython has no vocabulary for.** A Grail module is a
> compiled artifact in the *database*. It can be committed (deployed) or merely session-built; its
> committed compile can be current or **stale** against the `.py`; and it can be absent from this
> session's `sys.modules` *having once been in it* — a state in which the next import **raises**
> rather than rebuilding. The tool reports each fact and then the line that matters: what
> `import <name>` would actually do from here. It only reads — it deliberately does not import the
> module it describes, which is what makes it safe to ask about one you have not decided to import,
> — not because anything in this server stops it, but because the tool is written not to.

> **`run_python_tests` runs somewhere else on purpose.** Pointing the generic `run_test_class` at
> Grail's SUnit classes reported roughly **3,410 errors**, and not one of them was a defect in Grail.
> Two causes, both about the *session* rather than the code: a worker gem's working directory is the
> stone's, so Grail could not find its `.py` stdlib; and Grail's suite isolates tests by evicting
> framework modules from `sys.modules`, which *raises* when the module is committed. Measured on the
> same three classes: **132 defects** in a long-lived worker session, **386 run / 386 passed / 0
> failed / 0 errors** in a fresh one.
>
> So this tool logs in a new gem, runs there, and throws it away. That also settles three other
> things: the caller's transaction is untouched (running in-session dirtied it with 31 modified
> objects for a *seven-test* class, because a cold Grail import **is** a database write), nothing is
> ever committed, and a run therefore leaves the repository exactly as it found it. The price is that
> every run is fully cold — `FlaskScaffoldingTestCase` alone takes ~262s — which is why `classNames`
> exists and why the tool reports progress.
>
> Defects come back with their **message and stack**, via Grail's own `GrailTestResult`; stock SUnit
> keeps only the failing `TestCase`, so a report could otherwise say no more than
> `SomeTest debug: #testThing`. A class name that does not resolve is listed as `NOT FOUND` rather
> than skipped — "ran nothing" and "you misspelled it" must not look alike.
>
> **A fresh gem is also a gem that can die, and it dies on memory.** Everything a run compiles stays
> in one session's temporary object memory, and how much of it a forked gem gets is *the host's*
> choice, not this server's: the product default is `GEM_TEMPOBJ_CACHE_SIZE` = 50MB, and a NetLDI
> started with something larger passes that on instead. Starved, a run dies partway through a single
> class with `VM temporary object memory is full` — arriving as a raw `GciError` from a session with
> no gem left in it, so there were no counts, no cause and nothing naming memory. Two changes:
>
> * The test gem is forked with a **stated budget**, Grail's own: the pair its `scripts/run_tests.sh`
>   gives every test session. `GsTsExternalSession` has no configuration hook, but the NRS *body* is
>   the `gemnetobject` command line and `gemnetobject` takes `-C`, so the budget travels with the
>   login — no `gem.conf`, no `GEMSTONE_EXE_CONF`, no NetLDI restart, and no dependence on how this
>   host's NetLDI happens to be configured. Both parameters are ceilings the gem grows into rather
>   than reservations, so a small run costs no more than it did. Change them with the `testGemConfig`
>   option below.
> * The classes are driven **one per send** rather than in one expression, so the counts and defect
>   reports accumulate in the *caller* — the only place that outlives the child. A gem that dies at
>   class nine leaves eight classes' results behind, and the answer names the class it died on, what
>   had finished, and the budget it was forked with, as an error kinded **`testGemDied`**. It reports
>   the **GCI error number**, never the `GciError`'s text: the kernel appends the dead gem's whole
>   NRS — host, stone, GemStone user, netldi, command line — to any error in the fatal band, which is
>   not a thing to hand a client. The full failure stays in the test gem's own log.
>
> **Raising the ceiling is only half of it, and the other half is the dangerous half.** Grail's own
> runner says so in the same breath it states the budget: *"THIS AND THE EIGHT-PARTITION CHANGE BELOW
> ARE TWO FIXES FOR ONE DEFECT … Partitioning lowers what a session HAS to hold; the ceiling raises
> what it MAY hold."* Grail splits its corpus — 648 concrete classes, 6582 tests — across **eight**
> sessions at that same budget, so no ceiling makes a `classNames`-less call fit in one gem. And past
> the ceiling a Grail run does not crash: the gem raises `AlmostOutOfMemory` (notification 6013)
> against whichever test it happened to be running, a different innocent one every time. The answer
> is then *plausible red tests* rather than an error — the failure mode that lies. Grail's note on why
> it took so long to find is the point: *"that took a while to recognise precisely because nothing
> reported the number."* So `run_python_tests` reports the number and bounds the run:
>
> * Every answer carries the gem's **peak memory** — `peak memory: 432MB of 659MB (65%)` — read at
>   each class boundary, the same three values Grail's own `runTestsShard.gs` emits as
>   `GRAIL_SHARD_MEM`. The percentage is the kernel's own, because that is the figure 6013 is raised
>   against.
> * A run **stops starting classes** once the gem crosses `testGemMemoryCeilingPercent` (default
>   **85** — above the 75% Grail calls comfortable, below the 96% it measured breaking). Every class
>   that completed is still reported; the answer says how many were not started and which to resume
>   from, so a stop costs a follow-up call and never any results. Set it to `0` to run everything
>   asked for and take the gem's own verdict.
> * A run whose *last* class ends over the ceiling cannot be stopped short, so it carries a
>   **warning** instead: the counts are complete, but treat any defect in them as worth reproducing
>   in a smaller call first.

> **`eval_python` is a REPL, not a series of one-shot evaluations.** Names bound by one call are
> visible to the next — `counter = 41`, then `counter + 1` → `42` — because the toolset keeps one
> module scope per worker gem, and a worker gem is one client. Before that, every call was a blank
> slate *while imports persisted* (`sys.modules` is session-local), so the surface looked stateful
> and was not.
>
> It reports four things rather than one, because they answer different questions: what the code
> printed to **stdout** (discarding it meant `print(x)` answered `None` and the output was simply
> gone), what it wrote to **stderr**, the **value** as Python's `repr` (not a Smalltalk
> `printString`, which shows an `OrderedCollection` where the caller asked for a list), and on
> failure the **traceback** — Grail computes a full multi-frame one with real line numbers, and
> reporting only `KeyError: 'missing'` threw away the part that says where. The two output channels
> are reported on the failing path too, ahead of the traceback: a script that printed its way to
> the point of failure is where that output is worth most.
>
> **stderr is labelled, not merged.** Every stderr line is marked `[stderr] `, because a
> `warnings.warn` and a `print` mean different things and a reader who cannot tell them apart has
> lost the distinction:
>
> ```
> to stdout
> [stderr] <grail>:3: UserWarning: careful
> => 'done'
> ```
>
> An empty channel prints nothing, so a call that writes to neither is still the bare `repr` on one
> line. Uncaptured, stderr went to a `PyConsoleStream` — and a worker gem is forked by the netldi
> and detached, so nothing reads that sink: the bytes were accepted, counted and gone.
>
> **What the redirect does not always reach** ([GemTalk/Grail#924](https://github.com/GemTalk/Grail/issues/924))**.** It swaps the streams on the `sys` *this session*
> imports. A `.py` module keeps the module-global `sys` it was executed with, so a module
> **warm-bound** from a committed canonical instance hands out the `sys` of whichever session
> committed it — a different object, and not the one the redirect touched.
>
> Reproduced deliberately in plain Grail (`86d29a7`), with none of this server involved. Starting
> from an empty canonical registry:
>
> | fresh session evaluates | `traceback.sys is sys` | captured `print_exc()` |
> |---|---|---|
> | `import traceback` (cold) | `True` | the traceback |
> | …after one session committed that import | `False` | `''` — **lost** |
>
> `traceback.sys.modules is sys.modules` stays `True` in both: the two module objects share their
> session-resolved state but not their `stdout`/`stderr` attributes, which is the asymmetry behind
> it. Native modules are never affected — Grail's `warnings` among them — and passing the stream
> explicitly, `traceback.print_exc(file=sys.stderr)`, is captured either way.
>
> **Diagnosing it:** `python_module_state` reading `canonical: yes, COMMITTED (deployed)` does not
> on its own predict the loss. When Grail has been installed since the last deploy, the generation
> guard drops the whole registry on first touch, so the import is really cold and the redirect works
> while the registry still reads deployed. Compare `GrailRuntimeGeneration` with
> `GrailCanonicalDeployGeneration`, not the label.
>
> This is not worked around here: reaching a warm-bound module's `sys` means assigning into globals
> that are committed state shared with every other session, and evaluating an expression must not
> write that. It belongs in Grail, and is filed there as
> [GemTalk/Grail#924](https://github.com/GemTalk/Grail/issues/924) — a warm-bound module should see
> the importing session's `sys`, as it already sees its `modules` and `path`.
>
> **`get_python_source` exists because the image loses this.** A compiled `def`'s `__doc__` reads
> `None` and `inspect.getsource` answers an *empty string* — not an error, the wrong answer quietly.
> What is reliable is `__code__`: its `co_filename` / `co_firstlineno` are correct, and the `.py`
> they name is on disk under the Grail checkout, so the tool reads it and recovers both the body and
> the docstring. It needs to know where that checkout is — see the `grailDirectory` option below.

> **Requirement:** these tools call Grail's `ModuleAst` directly with no capability check, so they
> need an image with GemStone-Python installed.
>
> **Configuration — `grailDirectory`, `testGemConfig` and `testGemMemoryCeilingPercent`.** Grail's
> Python lives in the image, but
> its `.py` stdlib and its test fixtures live on **disk** under the checkout. A worker gem cannot
> work out where: its own working directory is the *stone's*, which holds no `src/python/stdlib`, so
> every `.py`-backed import fails. So a Grail server takes two things: the toolset **named** into the
> surface, and the checkout named as its option.
>
> ```bash
> MCP_TOOLSETS="McpBrowsingToolset McpExecutionToolset McpListingToolset McpMutationToolset \
>   McpSearchToolset McpSessionToolset McpTestingToolset McpGrailToolset" \
>   MCP_GRAIL_DIR=/opt/Grail ./run-server.sh
> ```
>
> which is shorthand for
>
> ```smalltalk
> (McpRouter new
>    toolsetNames: McpServer defaultToolsetNames , #('McpGrailToolset');
>    toolsetOptions: (Dictionary new
>      at: 'McpGrailToolset' put: (Dictionary new at: 'grailDirectory' put: '/opt/Grail'; yourself);
>      yourself))
>   forkOnPort: 8000
> ```
>
> `MCP_GRAIL_DIR` **configures** the toolset; it does not add it. Set without `McpGrailToolset` in
> `MCP_TOOLSETS` it could reach nothing, so both launchers say so and leave it off — a router holding
> options for a toolset it does not serve refuses to start, and the variable is commonly exported
> once for `run-unit-tests.sh` rather than meant as a request for a Grail server.
>
> Use the **same checkout the image was installed from** — a different one resolves names against
> source the image did not compile. `run-server.sh` checks the path holds `src/python/stdlib` before
> forking anything, so a typo is one line at launch rather than a wave of import errors later, which
> is exactly how a misconfigured session comes to read as a broken Python subsystem.
> `run-auth-server.sh` takes both variables. See **Toolset options** for the general mechanism and
> `MCP_TOOLSET_OPTIONS` for other toolsets.
>
> `testGemConfig` is the gem configuration `run_python_tests` forks its test gem with, as one
> `gemnetobject -C` string — `NAME=value` pairs separated by semicolons, no whitespace and none of
> `! # @ ^`, which would end the argument early inside the NRS and apply half of it (refused rather
> than passed on). It defaults to Grail's own,
> `GEM_TEMPOBJ_CACHE_SIZE=900000;GEM_TEMPOBJ_CODE_SIZE=300000;`. Both matter: the code space
> defaults to 20% of the cache capped at 150MB, so raising the cache alone still leaves it short of
> what a cold framework import compiles. Lower them on a host too small for that, or raise them for a
> whole-suite run — naming the checkout again, because `MCP_TOOLSET_OPTIONS` *replaces*
> `MCP_GRAIL_DIR` rather than adding to it:
>
> ```bash
> MCP_TOOLSETS="McpBrowsingToolset McpExecutionToolset McpListingToolset McpMutationToolset \
>   McpSearchToolset McpSessionToolset McpTestingToolset McpGrailToolset" \
>   MCP_TOOLSET_OPTIONS='{"McpGrailToolset":
>   {"grailDirectory":"/opt/Grail","testGemConfig":"GEM_TEMPOBJ_CACHE_SIZE=300000;"}}' \
>   ./run-server.sh
> ```
>
> `testGemMemoryCeilingPercent` is the other half of the same setting: `testGemConfig` raises what
> that gem *may* hold, this bounds what one call asks it to hold. It is how full the gem may get
> before a run stops starting new classes, default **85**, or `0` to never stop. A percentage rather
> than a byte figure so it tracks whatever budget is in force; anything outside 0–100 is refused.
>
> **Python errors are converted, not propagated.** Grail models its exceptions *outside* the
> Smalltalk `Error` hierarchy (`NameError` is `Exception < BaseException < Exception <
> AbstractException`, and `NameError inheritsFrom: Error` is **false**), so the dispatcher's
> `on: Error do:` cannot see them — uncaught, a python error would take the whole worker gem down
> instead of answering the client. The toolset therefore catches `BaseException` and re-signals an
> `McpError` kinded **`pythonError`**, which comes back as an ordinary `isError` result. Verified
> 2026-08-18: an undefined name (`NameError`), a runtime error (`1/0` → `ZeroDivisionError`) and a
> syntax error (`def (:` → `SyntaxError`) are all catchable and all reported this way. Both of the
> latter used to crash the gem, which is why the tests covering them were once switched off.

## Tool-call safety

- **Closed argument schemas** — every tool's input schema sets `additionalProperties: false` plus
  its `required` list, so an unknown or missing argument is rejected up front, before the tool
  runs, rather than being silently dropped. Per MCP 2025-11-25 the rejection comes back as a
  **tool execution error** (`isError: true`, with `structuredContent.error.kind =
  "invalidParams"`), because that is the form a model can read and self-correct from. A malformed
  request — no tool name — and an unknown tool remain JSON-RPC **protocol** errors (`-32602`).
- **Kernel-class guard** — the mutation tools refuse to modify a base/kernel class (one that
  `Globals` binds under its own name); the refusal names the class and a remedy and carries
  `kind = "refused"`. The test is deliberately by name **and identity** rather than via
  `dictionaryAndSymbolOf:`, which answers the first symbol-list dictionary binding a class by *value*
  under any key — in a Grail image `Python` binds kernel `Object` under an alias, ahead of `Globals`,
  which made `Object` read as unprotected and let the mutation tools through.
  Your own classes (in `UserGlobals`, or an application dictionary) stay freely mutable.
  `execute_code` is the deliberate escape hatch, and is deliberately **not** guarded — what bounds it
  is the worker gem's GemStone user, not this server.
- **Structured error kinds** — when a tool raises, the `isError` result keeps the human-readable
  message in `content` **and** carries `structuredContent.error.kind`, a short machine-readable
  classifier (`compileError`, `refused`, `notFound`, `invalidParams`, `other`), so a
  client can branch on the kind instead of parsing prose.

## Browsing-only deployments: the worker gem's GemStone user

**There is no read-only mode.** There was one until the release after 0.8.0 — a per-router flag plus a
`readOnlySafeToolNames` allow-list — and it was removed rather than extended, because a list of
"safe" tools could never be a boundary: `execute_code` evaluates arbitrary Smalltalk, `run_test_class`
runs arbitrary test bodies, and a tool that compiles can be followed by one that runs. Worse, it
*looked* like a boundary in exactly the place that mattered — an administrator starting
`MCP_READONLY=1 ./run-server.sh` on a privileged user, believing the image was holding the line.

What holds the line is the **GemStone user the worker gem logs in as**, enforced in the stone on
every operation:

```bash
./setup-read-only-user.sh                      # provision McpReadOnly (once)
MCP_WORKER_USER=McpReadOnly ./run-server.sh    # every worker gem of this router is that user
```

`McpRouter>>workerUserId` names the user and defaults to nil, meaning the front end's own user. No
credential is configured: the front end mints a one-time password per session, which needs a single
committed grant that `setup-read-only-user.sh` makes — so the router carries only an **identifier**,
and the fork string stays free of key material.

The provisioned user has `UserProfile>>disableCommits` (so **every** session of it is commit-locked
from login, forked gems included) and the privileges `CodeModification`, `NoPerformOnServer`,
`NoUserAction`, `NoGsFileOnServer`, `NoGsFileOnClient`. Measured against it: `commit` raises
`TransactionError` 2249, writing a shared object is refused `SecurityError` 2116 *at the write*, and
`performOnServer:`, `GsFile`, one-time-password minting, `stopSession:` and logging in a second gem
all raise. Reads and compiling still work, which is what makes the browsing surface worth having.

**[docs/read-only-user.md](docs/read-only-user.md) is the reference**: every privilege, what it does,
the risk of granting it, the cost of withholding it — and, just as important, what is **still open**
afterwards (reads are broad; resource consumption is bounded only by session lifetime). Read it
before pointing an untrusted client at this.

One residue has its own switch. A session that can change nothing can still take a GemStone **write
lock**, which blocks *other* sessions from committing the objects it covers — and idleness is no bound
on that, since a client that keeps calling never goes idle.
`MCP_REAP_LOCK_HOLDERS=1` ends any session found holding one, with no grace period: an idle holder is
reaped, and a busy one has its call ended first so the client is told why (error kind `lockRelease`).
Off by default, because an application may take a lock deliberately; turn it on alongside
`MCP_WORKER_USER`, where a lock could only be an attack.

`McpAuthRouter` **refuses** `workerUserId:` — there each worker logs in as the user its bearer token
names, so restricting an analyst means giving *that* GemStone user a restricted profile. (It had a
`writeScope` that downgraded a scope-less token to a reduced tool list; that went with the rest of
the gate.)

Choosing a shorter `toolsetNames` list is still worth doing — it narrows what a model is *offered*,
and a smaller surface is a clearer one. It is not a security control.

`supportedScopes` is the set published as `scopes_supported` (RFC 9728 metadata) and offered in the
`WWW-Authenticate` challenge — what clients are told to request, as distinct from `requiredScopes`,
what every token *must* carry. It is **derived, not configured**: the union of `requiredScopes` and
`extraScopes`. Because it is a union, a required scope is always advertised — it cannot be left out by
a configuration slip, and there is no subset rule to observe. Set `extraScopes` only for scopes the
router itself does not gate on but the client still needs to ask for, such as an authorization
server's own `profile`.

**Configuring the authorization server (Keycloak).** Keycloak's own
[MCP authorization server guide](https://www.keycloak.org/securing-apps/mcp-authz-server) recommends
the shape this router already expects: define `mcp:*` client scopes, and bind an **audience mapper**
to them so a token carries the resource identifier this router checks as `expectedAudience`. It
recommends binding the audience to a *scope* rather than to an RFC 8707 `resource` indicator, because
Keycloak has not implemented resource indicators — so bind the mapper to a scope every client
requests, i.e. one of the router's `requiredScopes` (say `mcp:use`), and every token comes out with
the right audience without any per-client setup.

That choice interacts with `extraScopes` in one Keycloak-specific way worth knowing before you deploy.
A client that registers dynamically (RFC 7591) and sends a `scope` field is assigned **only** the
scopes it asked for — Keycloak drops the realm's default client scopes — so anything the token needs
must be advertised or the client is never assigned it. In practice that means
`MCP_EXTRA_SCOPES="profile offline_access"`: `profile` because `MCP_USERID_CLAIM` is typically
`preferred_username` on Keycloak (the claim defaults to `sub`) and the `profile` scope is what emits
it, and `offline_access` because clients ask for it to get a refresh token. Advertising
`offline_access` runs against MCP's SEP-2207, which says a resource SHOULD NOT list it since refresh
tokens are not a resource requirement — but on Keycloak, advertising is the only mechanism by which a
dynamically-registered client can come to hold that scope, so it is the supported configuration here
rather than a workaround.

**What a deployment chooses is its TOOLSET LIST.** `tools/list` is unfiltered — the registry is the
surface — so leaving `McpMutationToolset` and `McpExecutionToolset` out of `toolsetNames` narrows
what a model is *offered*, which is worth doing for clarity. It is not a security control: a tool
absent that way is `notFound`, and `run_test_class` still runs arbitrary test bodies. What a session
may actually **do** is its GemStone user's business — see
[the section above](#browsing-only-deployments-the-worker-gems-gemstone-user).

## Architecture

| Class | Role |
|-------|------|
| `McpBase` | abstract superclass of the router + worker; holds only what both share — `parseBody:`, `log:`, the JSON-RPC envelope builders for server-initiated messages, and the RFC 5424 log-level table |
| `McpRouter` | front end: accept loop, HTTP, routing, the `MCP-Session-Id → McpSession` map, the SSE drain loop, the pending-request table, and the session reaper. Also `workerUserId`, the GemStone user its worker gems log in as. Owns the socket; never runs a tool |
| `McpAuthRouter` | network-facing `McpRouter` subclass: requires an OAuth/JWT bearer token, logs each worker in as its own GemStone user, serves the `WWW-Authenticate` challenge + RFC 9728 metadata, validates token claims/scopes, and adds TLS. Refuses `workerUserId:` — the token names the user |
| `McpServer` | per-client worker: the single-client MCP server that runs inside each worker gem — registry, dispatcher, the kernel guards, identity. The tools themselves belong to its toolsets, and which of those it registers is not fixed by the class. No socket |
| `McpToolset` | abstract tool pack: `registerOn:` (its tools + schemas), its `tool_*` handlers, `toolNames`, plus the shared schema builders, image-lookup helpers, and the kernel guards (which forward to the server's policy). **Subclass this to add tools**; a deployment picks the list |
| `McpBrowsingToolset`, `McpExecutionToolset`, `McpListingToolset`, `McpMutationToolset`, `McpSearchToolset`, `McpSessionToolset`, `McpTestingToolset` | the seven core toolsets, one per tool family. A deployment can expose any subset — or none of them, alongside its own |
| `McpGrailToolset` | optional Python toolset (7 tools: eval, transpile, source, class + method browsing, module state, tests), filed in only on a Grail image. Needs nothing from the server, so it doubles as the worked example for a third-party toolset |
| `McpSession` | one client's isolated worker handle: a `GsTsExternalSession` gem + session id + last-activity + the worker class/toolsets/identity the front end resolved, plus the front-end-side outbox, log level and liveness state. `prepareWorker` sets the gem up in one call; `forward:` runs a request in it (`<workerClass> handleJsonString: …`) without blocking the front end (`runWorker:`); `close` stops it |
| `McpOutbox` | one session's queue of server-initiated messages waiting for its SSE stream. Front-end-only and never committed; owns the bound/overflow policy, the closing handshake, and the latest-GET-wins rule |
| `McpHttpConnection` | reads one HTTP/1.1 request, writes one JSON response (incl. `MCP-Session-Id`), and writes the SSE stream — every frame gated on the socket being writable, plus a non-blocking read-side disconnect check |
| `McpDispatcher` | JSON-RPC 2.0 / MCP routing (`initialize`, `tools/list`, `tools/call`, `ping`); the post-call `[session]` line; structured error kinds |
| `McpToolRegistry` | name → `McpTool` map; produces `tools/list` descriptors |
| `McpTool` | one tool: name, description, JSON Schema, handler block; validates arguments against the schema |
| `McpError` | an error carrying a machine-readable `kind` (e.g. `refused`, `notFound`) that the dispatcher surfaces in the tool-call error envelope |
| `McpJson` | the JSON writer: renders a response as a byte `String` of UTF-8, replacing `Object>>asJson`, whose escaping corrupts every codepoint above U+FFFF |

Built on existing image facilities: `GsSocket` (TCP), `JsonParser parse:` (JSON in) and
`String>>evaluate` (the `execute_code` engine).

### The wire is UTF-8, in both directions

That is what RFC 8259 §8.1 says JSON on a wire is, and mcp_server holds to it on both sides. It costs
the kernel parser on the way in and a writer of mcp_server's own on the way out. Why that trade was
made, what it cost in code owned, and what the change turned up about the front end have their own
document: **[docs/utf8-wire.md](docs/utf8-wire.md)**.

**In**, `McpBase class>>parseBody:` reads
`JsonParser parse: (self combineSurrogateEscapesIn: aString asString decodeFromUTF8 asString)`.
`JsonParser` wants characters and a socket delivers bytes, with nothing in its API to say which;
without the decode a `£` or a `°` arrives as two Latin-1 characters and `compile_method` stores it
that way. The *leading* `asString` is there because the body does not reach the worker gem as the
bytes the socket read: the front end forwards it embedded in an expression and the worker
**compiles** that literal, so its class comes from the worker session's `#StringConfiguration` — and
a `Unicode16`, which is what an accented body compiles to on any Grail image, does not understand
`decodeFromUTF8` at all. The *trailing* one narrows the `Unicode7`/`16`/`32` that `decodeFromUTF8`
answers back into the byte/`DoubleByteString`/`QuadByteString` family, since a `Unicode7` compared
to a `String` raises on a stock image rather than answering false. `combineSurrogateEscapesIn:` is
the one repair mcp_server makes to what the parser is handed — see below. A malformed sequence —
truncated, overlong, an encoded surrogate — refuses the whole body with a `-32700` naming the byte
offset, rather than being repaired into stored text. Everything else about the kernel parser is
kept, including the part it gets right that matters most here: a **raw** astral character decodes
correctly.

**Out**, `McpJson class>>write:` replaces `Object>>asJson`, and answers a byte `String` of UTF-8. A
character above `0x7F` is written as its 2–4 UTF-8 bytes; only what RFC 8259 §7 actually requires
is escaped — the quote, the backslash, and the C0 controls.

Owning the writer is not a preference. `CharacterCollection>>printJsonOn:` keeps only bits 12–15 of
a codepoint above U+FFFF instead of emitting a surrogate pair, so `asJson` renders U+1F600 as
`"\uF600"` — silently the wrong character — and for some codepoints emits a **lone surrogate**,
which is not well-formed JSON. By the time `asJson` has answered, the codepoint is gone, so no
post-pass can repair it: the only choices are to patch a kernel method (lost on an extent reload,
and it changes behaviour for every other consumer in the image) or to write JSON directly. Writing
UTF-8 does not fix that arithmetic so much as never reach it — a surrogate pair is an artefact of
`\u` escapes and of UTF-16, and UTF-8 spells an astral codepoint directly in four bytes.

The writer encodes to **bytes** rather than leaving characters for the transport, and that is
load-bearing. Three unrelated mechanisms downstream read a response as bytes: `Content-Length` is
written as `body size`; the worker → front-end hop is measured in bytes by the kernel's result
fetch, whose buffer is sized in bytes; and `MCP_TRACE` writes bodies to the gem log through
`GsFile`, where a 16-bit string comes out garbled. A byte `String`'s `#size` *is* its byte count
whatever the bytes are, so all three hold by construction — where under the old ASCII-escaping
policy they held only because nothing above `0x7E` was ever on the wire.

`McpJson writeUtf8CodePoint:on:` is checked against an oracle: `McpJsonTest` requires it to agree
with the kernel primitive `String>>encodeAsUTF8` for every codepoint, including both sides of all
three sequence-length boundaries. Nothing in the kernel emits a *correct* JSON escape for an astral
codepoint, so an escaping writer's surrogate arithmetic has no second opinion available to it.

The inbound half needs one repair of its own, and gets it before the parse rather than inside a
parser. Kernel `JsonParser` sends `Character codePoint:` to each `\uXXXX` escape separately and
3.7.x refuses to build a surrogate, so an emoji written as the surrogate **pair** RFC 8259 §7
prescribes failed the whole request with a `-32700`. That is a real client, not a hypothetical one:
Python's `json.dumps` escapes by default. `McpBase class>>combineSurrogateEscapesIn:` folds a pair
into the one codepoint it spells before the parser can see either half — forty lines at the edge,
where the outbound defect needed a writer, because inbound the information is still there in the
escapes. A body with no escape in it is answered as the receiver itself. So both client styles
round-trip an emoji now: raw UTF-8 (`JSON.stringify`, and therefore most of them) and escaped.

What the kernel parser still gets wrong is left in place, because working around it needs a real
parser, and it is measured in the defect report (`docs/kernel-json-unicode.md`): an escape it does
not recognize is silently dropped rather than refused, and trailing content, duplicate keys and raw
control characters are all accepted. None of those corrupts text — the worst a client gets is one
wrong value from a request its own encoder built wrong.

## Why a dedicated gem

Forked `GsProcess`es **only run while the gem is actively executing Smalltalk**. A
GCI-driven session (like the Jasper VS Code session) is parked in the C client between
commands, so a background accept loop forked there would be frozen and never serve
requests. Therefore the server runs as the **blocking main activity of a dedicated gem**.

Configure a router **instance** and start it two ways:
- **`McpRouter new runOnPort: aPort`** — runs the accept loop as the *calling* session's blocking
  activity; never returns until `stop`. Use it to run the server in a foreground topaz.
- **`(McpRouter new … ) forkOnPort: aPort`** — spawns a *separate* gem via `GsTsExternalSession` and
  runs the loop there **detached** (`forkAndDetachString:`), returning immediately. The router's
  config travels to the child gem as JSON embedded in the fork string (`configDict` — host lists,
  file paths, and identifiers only, **never key material**), so nothing is committed and several
  differently-configured routers can run at once. The forked server is **independent** — it keeps
  serving after the launching session logs out. Stop it by port with **`./stop-server.sh`**, or from
  anywhere with `System stopSession: <id>` / `kill <pid>` (both printed at fork). `run-server.sh`
  uses this.

The front end is always `McpRouter`, and **it decides what each worker is** — a worker never chooses
for itself. Per session the router resolves the worker class (`workerClassName`, default `McpServer`)
and the tool surface (`toolsetNames`, default the core toolsets plus `McpGrailToolset` when that file
is loaded), then pushes both into the worker gem in one call at session open. Resolving per session
rather than at boot means a Grail install that lands after startup reaches the next client — and it is
what will later let an authenticated router narrow the surface per token, since the token is only
visible on this side.

## Per-client sessions

Each MCP client gets its **own worker gem** so clients don't share uncommitted changes or
transaction views. The port-owning gem runs `McpRouter`, a **front end / router**; it never runs
tools itself (those run in the per-client `McpServer` workers):

- **`initialize`** → the front end opens a `McpSession` (a `GsTsExternalSession` worker gem,
  logged in via a one-time password as `workerUserId` — the front end's own user unless a
  restricted one is configured), **prepares** it with a single
  `prepareWorkerWithToolsets:options:serverName:title:version:frontEnd:cacheName:` call —
  which names the worker's gem in the shared cache, resolves the
  named toolsets, applies the advertised identity, and pre-builds the server so the client's first
  request has no registration to do — assigns a server-side id, and returns it in the
  **`MCP-Session-Id`** response header. A worker class or toolset the worker gem cannot resolve fails
  here, at session open, where the error can say what to fix.
- **Every other request** must carry that header. The front end looks up the worker (map guarded
  by a mutex) and **forwards the raw JSON-RPC body** to it — `worker nbExecute: '<workerClass>
  handleJsonString: ' , body printString`, naming the class the router resolved — the worker runs
  the tool in its own session and returns the response, which the front end relays. Missing id →
  `400`; unknown/expired → `404` (a compliant client re-initializes). A worker gem that **dies** —
  the GCI fatal error band, which is the kernel's own verdict, since it closes the connection with
  one — takes its session with it: the request that found it is answered `-32001` with `data.kind`
  `sessionGone`, the session is unmapped as part of answering so its slot goes back, and the next
  request on that id is the ordinary `404`. Leaving it registered used to mean a generic `-32603`
  forever and a slot held for the life of the front end.
- **At most `maxSessions` at once — 3 by default.** A session *is* a GemStone login, and a
  repository has a finite number of them, so past the cap `initialize` is refused with a JSON-RPC
  error (`-32001`, `data.kind` `sessionLimit`) naming the limit, and **no login is attempted**. The
  failure this prevents is not the client's: the login that exhausts a stone fails for *every* gem on
  it — `topaz` included — and a client that reconnects in a loop gets there without doing anything
  reckless, since reconnecting opens a *new* session. Set `MCP_MAX_SESSIONS` (a count, or `none` for
  no cap) once you know what your stone allows. See [Session lifetime](docs/session-lifetime.md).
- **DELETE** closes the worker; and a **background maintenance `GsProcess`** (every 60s) probes,
  warns and reaps idle sessions, so abandoned test gems don't pile up. A session is reaped after
  **30 minutes** idle by default (`sessionIdleTimeoutSeconds`, configurable and optional) — or
  sooner, if it fails a liveness probe on the stream it opened. A client that simply **hangs up**
  (a closed editor tab) does not wait for any of that: its socket closing is watched for, and its
  gem is released about **10 seconds** later — the delay being a grace for a client that might
  reattach to the same session, which a reopened editor tab does not. See
  [Server-initiated messages](#server-initiated-messages).

Isolation comes from each worker being a separate gem = a separate transaction view, and clients
really do run **concurrently**: forwarding is non-blocking (`McpSession>>runWorker:`), so one
client's long tool call no longer stalls anyone else — see
[Concurrency & robustness](#concurrency--robustness) below.
The base `McpRouter` logs every worker in as the current (server) user; the network-facing
`McpAuthRouter` instead logs each worker in as the **token's own GemStone user** via JWT.

### Naming the gems

Every gem here is created by `GsTsExternalSession`, and the stock name for one of those is `GciTs` —
so without help the front end, every worker, and any unrelated external session on the stone are
**indistinguishable** in the one column of `System cacheStatisticsForAllSlots` that is supposed to say
who a session is. Each gem therefore names itself as it starts:

| gem | name | example |
|---|---|---|
| front end | `<router class>:<port>` | `McpRouter:8000`, `McpAuthRouter:8443` |
| worker | `<worker class>:<front-end session>:<first 8 of the MCP session id>` | `McpServer:5:978EC559` |

```
$ # System cacheStatisticsForAllSlotsShort, three rows of it:
name                     pid     sessionId
McpServer:5:978EC559     43793   4
McpRouter:8000           42435   5
McpServer:5:5ADC62A4     43797   6
```

**Both names lead with the class that is actually running** — the router's own class, and for a worker
the class the router *told* it to be (`workerClassName`) — so a deployment running a subclass sees
that subclass rather than a fixed role name that would then be a lie: `AcmeDbServer:5:978EC559`
against an `McpAuthRouter:8443`. The two roles stay distinguishable by shape as well as by class: a
front end carries one `:` field after its class, a worker two.

The rest of the table then answers **on its own**, without a log to cross-check: a worker's middle
field is the front-end gem's own `sessionId`, so a stone running several routers still sorts into
servers, and the last field is the head of the `MCP-Session-Id` the router logs in full — a prefix, so
grepping the gem log for it finds that client's traffic. The worker's own session id and host pid are
not repeated, because they are already the other columns of the same row.

Two consequences worth knowing:

- **A supervising process can find these gems by name** —
  `System cacheStatisticsForProcessWithCacheName: 'McpRouter:8000'` answers the router's row —
  rather than recording its pid somewhere at fork time.
- The front end logs the name it actually got (`shared cache name: McpRouter:8000`), read back from
  the cache rather than reported from what it set, so the log and the table cannot disagree.

The cache accepts **1 to 31 characters** and raises `OutOfRange` outside that, so a name is truncated
rather than allowed to fail a login or a server start. Where the class name and the identifying
fields cannot both fit, **the identifying fields are kept whole and the class name is cut** — a
router name shortened to `McpRouter:80` would name a port nothing is listening on, and a worker's cut
the same way would identify neither its server nor its client. This is reachable in practice for a
worker, whose class name a deployment chooses. `System cacheName:` is the only lever, and
it names only the session that sends it (there is no `cacheName:forSession:`, and
`descriptionOfSession:` has no setter at all), which is why a worker's name travels *into* the worker
with the rest of its bootstrap instead of being applied from outside.

## Concurrency & robustness

Each accepted connection is handled in its own forked `GsProcess`, so a slow or stalled
client cannot block the accept loop (the forked handlers run during the loop's accept
waits). `McpHttpConnection>>readRequest` also bails after an 8s read timeout, so a client
that connects but never sends a complete request is dropped rather than wedging the server.
Each client's requests run in its own worker gem (a separate session), so there's no shared
transaction to protect; a `Semaphore` (mutex) guards the `MCP-Session-Id → session` map, and each
session has its own guarding its worker.

**Clients run concurrently.** Forwarding a request used to be a blocking GCI `executeString:`, which
blocks in C — so while it ran the front-end gem executed no Smalltalk and *no* `GsProcess` in it ran:
not another client's request, not the accept loop, not the idle reaper, not an open SSE stream's
keepalives. `McpSession>>runWorker:` now starts the call with `nbExecute:` and waits on the session's
socket, which suspends only the calling `GsProcess`. Measured: a second client is served in ~1s while
an 8-second tool call is in flight, where it used to wait the full 8 (`test.sh` checks this).

Two guarantees the blocking call had been providing by accident are now explicit. GCI allows one call
in flight per session, so each `McpSession` holds a mutex — a client with two requests outstanding
queues rather than colliding. And the idle reaper, which previously could not run during a forward at
all, now skips any session with a call in flight (`McpSession>>isBusy`) instead of logging a worker
out mid-request. And a forwarded request *can* have a **deadline** — `requestTimeoutSeconds`, off by
default, since a client that carries a progressToken pushes its own deadline out as it reports and a
client that stops waiting now says so — which only a non-blocking forward makes possible: the
front end is awake in the wait loop, so it can notice the call has outrun it and break the worker,
answering the client a `-32001` error bearing the request's own id. The break leaves the gem usable,
so the cost is that request and not the session. See
[Session lifetime](docs/session-lifetime.md).

**An open SSE stream costs the gem nothing.** Its drain loop yields on every tick (a 100ms `Delay`),
so the accept loop, the reaper and every other session's stream keep running. Both directions of that
socket are guarded, for the same reason the accept loop guards its read side: every SSE frame waits
on `writeWillNotBlockWithin:` first — `GsSocket>>write:` suspends with **no timeout**, so a client
that stops reading would otherwise park that stream's `GsProcess` and its socket forever — and each
tick polls the read side without blocking, so a client that simply vanishes is noticed in ~100ms
rather than at the next keepalive. Reopening the GET does not accumulate streams either: the newest
supersedes the previous one, which ends on its next tick.

## Server-initiated messages

MCP is request/response over HTTP, so a server has no socket to call out on: it can only write on a
connection the client opened. The one such connection not tied to a request is the **standalone SSE
stream** the client opens with `GET /mcp`, and that is where everything below travels.

It lives in the **front end**, and could live nowhere else. A worker is a separate OS process, and a
socket is a file descriptor meaningful only inside the process that accepted it — GemStone exposes
no way to hand one across. So each `McpSession` carries an **`McpOutbox`** on the front-end side
(gem-local, never committed), the GET handler drains it onto that client's stream, and the router
keeps the pending-request table that matches a server-sent request to the JSON-RPC response the
client POSTs back.

### What it is for today: idle sessions

This matters more here than for a typical MCP server, because a session **is a gem with its own
transaction view** — reaping one throws away uncommitted work, so the server's problem is telling a
client that has *gone* from one that is merely quiet. For a session drifting toward the idle deadline
and holding an open stream:

| When | What happens |
|---|---|
| idle > 25 min | the server sends a `ping` on the stream (`ping` is bidirectional; the receiver MUST answer) |
| the client answers | it is **proven live** — its gem is kept, and the answer counts toward the idleness total |
| the client does not answer | it is **proven gone** — its worker gem is released early rather than waited out |
| the session is reaped | it is unmapped silently; the client meets a `404` on its next call, and the reason is written to the gem log |

The ping earned the client a warning on its stream until 2026-08-27. It no longer does: the carrier
was `notifications/message`, which the draft revision deprecates and — unsolicited — prohibits, and
measurement said no client was surfacing it to its model anyway. The ping stays, because what it
buys is the **evidence**, not the message.

**An answered `ping` deliberately does *not* reset the activity clock.** It proves someone is
listening; only real MCP traffic keeps a session alive. Refreshing the clock instead would mean any
well-behaved client — they all answer `ping` — held a gem and a transaction view for as long as it
stayed open.

A client that never opens a GET stream is left exactly as it was: never probed, reaped
on `streamlessIdleTimeoutSeconds` (1 minute). Pinging it would only mark it unanswered and cost it
its gem early. A minute is short on purpose — the commonest streamless client is a one-shot POST
whose gem is pure overhead the moment it returns — and it is safe because the count pays for the
pass it starts on, so nothing is released sooner than a full minute after its last request. Raise it
where streamless clients are *sequences* of POSTs sharing a session id: what it bounds for them is
the gap between calls, not the life of the session.

**A client that closes its stream is a different case entirely, and a much easier one.** The drain
loop is already watching the read side, so a client that hangs up is detected within ~100ms — not
inferred from silence, observed. Such a session gets `streamLossGraceSeconds` (10s) to open another
stream, and is then released on the spot rather than at the next maintenance pass. Anything the
client does in the meantime retracts the verdict: a new stream, a call in flight, or any request at
all. Measured end to end over four tab closes: 9.7–10.2 seconds from closing a VS Code tab to the
worker gem being logged out, where it used to be half an hour.

The grace is **insurance, not a description of what editors do.** Measured on those same closes,
Claude Code in VS Code does not resume its MCP session across a tab close — it returns as a fresh
`initialize` on a new session id, so no GET ever arrives for the old one and its grace runs out
untouched. Reconnects landed 3.8s and 4.3s after the close, well inside the window, and changed
nothing. The grace is kept for the case the protocol actually allows — a client closing one stream
and opening another on the same session, which a proxy or a network blip can force — and because the
cost of guessing wrong the other way is a live client losing its gem and its uncommitted work.
`MCP_STREAM_LOSS_GRACE=0` releases immediately where no client is expected to reattach.

**An unanswered ping is evidence of death only if it went down the stream the client is still on.**
A message is written to exactly one stream, and both shipping clients reconnect a dropped standalone
`GET` on their own — a handover being likeliest on exactly the quiet sessions the reaper probes. The
write into a superseded stream *succeeds*, into a socket buffer nobody will ever read, so the silence
that follows says nothing about the client. Every probe therefore records the stream generation it
was written to, and a verdict is drawn only if that generation is still current; otherwise the probe
is discarded and re-sent down the new stream on the next pass. (Measured against real clients on
2026-08-23, this accounted for 6 of 14 pings.)

### The pieces

| | |
|---|---|
| `McpOutbox` | per-session FIFO queue, bounded at 256 (drops oldest, then records the gap in the gem log). Its own mutex — the router's is held across reaping. Hands out a **stream generation** so the newest `GET` wins and two drainers can never interleave frames on one socket |
| `McpRouter>>serveGetStream:forSession:` | the drain loop. Yields every tick, so holding a stream open costs the gem nothing |
| `McpBase>>notification:params:` / `request:params:id:` | envelope builders on the front-end side. `McpDispatcher` lives in the worker and cannot be asked to build one mid-tool-call |
| pending-request table | `srv-N` ids in their own namespace, timed out at 30s — an unanswered ping must decide something, never hang a session |

### Session lifetime

How long a session lives is deployment policy, not a constant: the idle deadline, the liveness-probe
interval, the absolute cap, how long a single request may run, and what an authenticated router does
with a token's own `exp`. How **many** live at once is policy too — `maxSessions`, 3 by default, the
one bound here that refuses rather than releases. Because
a session here **is a gem holding a transaction view**, those choices decide when uncommitted work
is thrown away — so they have their own document: **[docs/session-lifetime.md](docs/session-lifetime.md)**.
It covers every knob and its default, what actually ends a session, why running out of sessions is
the stone's problem rather than the client's, why nothing is measured in elapsed time, and why a host
suspend needs no handling at all.

From the shell, `MCP_IDLE_TIMEOUT` and friends set all of it on either launcher — see
[session-lifetime.sh](session-lifetime.sh), which documents each, along with the view-hygiene family
(`MCP_MAX_COMMITS_BEHIND` and friends) that the two launchers share with it.

Not configurable, because they are mechanism rather than policy: `keepaliveIntervalSeconds` 15
(sized to proxy and NAT idle timeouts, not to sessions), `streamPollMilliseconds` 100,
`McpOutbox>>maxQueueSize` 256, `sseWriteTimeoutMs` 5000.

Both SSE write paths are guarded: `writeWillNotBlockWithin:` before every frame (`GsSocket>>write:`
suspends with no timeout, so a client that stops reading would otherwise park a stream's `GsProcess`
forever), and a non-blocking read-side poll each tick, so a disconnect is caught in ~100ms rather
than at the next keepalive.

Not yet built: anything originating in a **worker** gem — progress during a long tool call, log
lines from tool internals — which needs a worker→router channel (`InterSessionSignal` is the
candidate). Elicitation and sampling need more than that: a *bidirectional* worker channel, since
their answers have to be delivered back into a gem whose GCI call is already in flight.

## Message trace

An MCP client's UI generally shows you the tool **name** it called and not the text of the JSON-RPC
message it sent, so when a call goes wrong the arguments are often recorded nowhere. Turn the trace
on and the front end writes each message it receives to the **gem log**:

```bash
MCP_TRACE=1 ./run-server.sh                        # bodies capped at 4096 chars (the default)
MCP_TRACE=1 MCP_TRACE_LIMIT=none ./run-server.sh   # whole bodies, no cap
MCP_TRACE=1 MCP_TRACE_LIMIT=512  ./run-server.sh   # a tighter cap
```

Both work on either launcher, and both travel to the forked front-end gem in the config
(`McpRouter>>configDict`) — which they have to, since forking is the only way the server is started.
In the image they are `messageTrace:` and `messageTraceLimit:` on the router instance.

Then find the log and follow it. It is the front end's own gem log — one file for every client:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN            # the front-end gem's pid
lsof -p <pid> | grep '\.log'                # .../<datadir>/log/gemnetobject_<pid>.log
tail -f .../log/gemnetobject_<pid>.log
```

What a line looks like — verb, path, session id, body size, body:

```
31/08/2026 10:14:42  message trace: ON -- bodies capped at 4096 chars
31/08/2026 10:14:53  --> POST /mcp session - 107 chars: {"jsonrpc":"2.0","id":1,"method":"initialize",...}
31/08/2026 10:14:53  --> POST /mcp session 71FF1F5C... 136 chars: {"jsonrpc":"2.0","id":2,"method":"tools/call",...}
31/08/2026 10:15:20  --> (unreadable request: client closed, timed out, or over-long head)
```

Four things worth knowing:

- The tap is in `McpRouter>>handleConnection:`, **before** the Origin, protocol-version and (on
  `McpAuthRouter`) credential gates — so a request refused with a `403`, `400` or `401` is traced
  too. Those are the ones you are usually looking for.
- **Headers are never traced.** One of them is the `Authorization` bearer token. The session id *is*
  traced: it is the only thing that tells two concurrent clients apart in one log, and the reaper
  already writes it in the clear.
- One message is one line: real newlines and tabs in a body become `\n` and `\t`, so a tools/call
  carrying Smalltalk source stays greppable. A body past the cap is followed by `...(+N more)`, so a
  long message cannot be mistaken for a lost one.
- The startup line says the trace is on. Without it, an absence of message lines would read as an
  absence of traffic.

Off by default, and deliberately so: a traced log holds every argument every client sent — source to
compile, code to execute. On a shared `McpAuthRouter` deployment that is other people's work.

This is **inbound only** — what the client sent. What the server sends back is not traced: neither
the JSON-RPC responses, nor the error bodies behind those `403`/`400`/`401` statuses, nor the
server-initiated frames on the SSE stream.

## Writing your own MCP server

You can ship an MCP server for **your** software on this transport — including one that exposes only
your tools, with none of the Smalltalk-development surface. There are two extension points, and the
first is the one you usually want.

**To add tools, write a toolset.** Subclass `McpToolset`, implement `registerOn:` (one
`name:description:inputSchema:do:` send per tool, building schemas with the inherited
`objectSchema:required:` / `propString:` / `boolProperty:` helpers) and implement `toolNames`.
Write the handlers as instance methods
on the same class, taking the parsed argument dictionary and returning a `String`; the inherited
`resolveClass:`, `dictNamed:`, `linesFrom:` and `capResult:` helpers cover the usual image lookups
and output capping. `McpFixtureToolset` (in `src/tests/`) and `McpGrailToolset` are small worked
examples. A handler that *mutates* the image should pass through the inherited kernel guard
(`self assertMutableClass: cls`) before it changes anything; that forwards to the server, because
what counts as protected is one answer per deployment rather than each toolset's to invent, and a
subclass can tighten it for every toolset at once. `McpMutationToolset` shows the pattern. Your
toolset may layer a *stricter* guard of its own on top; a toolset built with no server refuses to
mutate at all, fail-closed.

Errors raised inside a handler are caught by the dispatcher and returned as an MCP error result
(`isError: true`) carrying a structured `kind`. If your tools can raise exceptions **outside** the
`Error` hierarchy, catch them yourself and re-signal an `McpError` — that is what `McpGrailToolset`
does for Python exceptions, and why it has to.

Then name your toolsets when you launch a router:

```smalltalk
(McpRouter new
  toolsetNames: #('AcmeDbToolset');           "only your tools -- no execute_code, no mutation tools"
  serverName: 'acme-db-mcp'; serverVersion: '2.5.0';
  serverTitle: 'Acme Labels - sandbox')       "which INSTANCE this is, for a human"
    forkOnPort: 8000
```

Relabel the server when you configure one: `serverName` / `serverVersion` say which *product* this is,
`serverTitle` says which *instance* a human is looking at — see [Server identity](#server-identity)
below.

Toolsets **compose** — `#('AcmeDbToolset' 'McpBrowsingToolset')` gives your tools plus class
browsing, and two unrelated vendors' toolsets can be combined. To keep the development surface and
add yours, compose on the default: `McpServer defaultToolsetNames , #('AcmeDbToolset')`. This is the
reason tools live in toolsets rather than in `McpServer` subclasses: single inheritance could never
express it.

**Nothing is served that a router did not name.** Being loaded in the image is not being exposed —
which is why the surface has to be stated even for a toolset this project ships. `McpGrailToolset` is
that case end to end, and the example to copy: its own source group, its own `declaredOptionNames`,
a launcher line naming it in `MCP_TOOLSETS`, and `MCP_GRAIL_DIR` supplying the one option it cannot
work out for itself. Nothing about it is privileged — a deployment turns yours on the same way.

**To change behavior, subclass `McpServer`** — the kernel guards, the worker entry, dispatcher
wiring, or the advertised identity. Name your subclass in `workerClassName` (nothing auto-detects
it):

```smalltalk
(McpRouter new workerClassName: 'AcmeDbServer'; toolsetNames: #('AcmeDbToolset')) forkOnPort: 8000
```

### Toolset options

Sooner or later your toolset needs something the core cannot know — where your data directory is,
which host a subsystem talks to, which tenant this deployment serves. Adding an ivar to `McpRouter`
per vendor does not scale and puts your domain knowledge in the core, so a toolset **declares what it
can be configured with**, alongside what it provides:

```smalltalk
AcmeDbToolset class >> declaredOptionNames
  ^#( 'dataDirectory' 'tenant' )
```

and reads them where it needs them:

```smalltalk
^self optionNamed: 'dataDirectory' ifAbsent: ['/var/acme']
```

An operator sets them on the router, keyed by toolset name:

```smalltalk
(McpRouter new
   toolsetNames: #('AcmeDbToolset');
   toolsetOptions: (Dictionary new
     at: 'AcmeDbToolset' put: (Dictionary new
       at: 'dataDirectory' put: '/srv/acme'; at: 'tenant' put: 'eu-1'; yourself);
     yourself))
  forkOnPort: 8000
```

Three things are worth knowing about how this behaves:

* **`declaredOptionNames` is an allow-list, checked when the option is set.** An undeclared name is
  refused there and then, in a message naming what your toolset *does* accept. That is the same
  choice `additionalProperties: false` makes for tool arguments, for the same reason: a mistyped
  setting that is silently ignored costs far more to find than one that refuses to start.
  `validateWorkerConfig` catches the other half — options configured for a toolset that is not in
  the surface — before the port is bound.
* **Each toolset sees only its own options.** They are keyed by toolset name and handed out at build
  time, so two toolsets can neither read nor collide with each other's configuration.
* **Values must be JSON-safe**, because they travel to the worker gem as JSON in the fork string.
  Every option is optional by construction, which is why `optionNamed:ifAbsent:` has no bare variant
  — a handler reading one has to say what it does without it, at the point it reads it.

`ifAbsent:` and an empty `declaredOptionNames` are the defaults, so a toolset that needs no
configuration says nothing and behaves exactly as it did before options existed.

### Server identity

The `initialize` result's `serverInfo` carries three fields, and they answer different questions:

| Field | Means | Set by |
|---|---|---|
| `name` | **which software this is** | the product: override class-side `defaultServerName`, or set router config `serverName` for a toolset-composed server with no `McpServer` subclass |
| `version` | which release of that software | same |
| `title` | **which instance this is**, for a human | the operator: router config `serverTitle` |

`name` is the programmatic identifier and `title` is the display string (MCP `BaseMetadata`); when
there is no `title` a client displays the `name`. So the two shapes are:

```smalltalk
"same software, three stones -- name stays truthful, humans can tell them apart"
(McpRouter new serverTitle: 'GemStone - geode teststone 3.7.6') forkOnPort: 8000
(McpRouter new workerUserId: 'McpReadOnly'; serverTitle: 'GemStone (browse-only)') forkOnPort: 8001
"a different product assembled from toolsets, with no McpServer subclass"
(McpRouter new toolsetNames: #('AcmeDbToolset');
   serverName: 'acme-db-mcp'; serverVersion: '2.5.0';
   serverTitle: 'Acme Labels - sandbox') forkOnPort: 8002
```

To name your **product**, override the **class-side** `defaultServerName` / `defaultServerVersion`.
That keeps the name a default a deployment can still relabel through router config — the path for a
server assembled from toolsets that never subclasses `McpServer`. Overriding the instance-side
`serverName` instead wins over config, which is a deliberate lock rather than the normal path.

There is **no default title**: class-side `defaultServerTitle` answers `nil` and the `title` key is
then left out of `serverInfo` entirely (not sent as `null` or `''`). A title being present therefore
means a human deliberately labeled that instance. A product that wants its own display name overrides
`defaultServerTitle`; per-box labeling stays the operator's `serverTitle`.

> **Where your classes must live:** a worker gem may log in as a *different user* than the front end
> (under `McpAuthRouter`, as the token's own GemStone user), so your toolsets and any worker subclass
> must be in a symbol dictionary in the **worker's** symbol list — `Mcp` (or another shared
> application dictionary), not the operator's `UserGlobals`. Note that a dictionary of your own is
> not in a new user's default symbol list the way `Published` is; `install.sh` puts `Mcp` in every
> `UserProfile`'s symbol list for exactly this reason.

## The `Mcp` dictionary

Every class in this repository is installed into a symbol dictionary named **`Mcp`** — its own, not
`Published`, where these classes lived until 2026-09-06. `install.sh` creates it if it is absent and
appends it to the symbol list.

Two consequences are worth knowing about, because neither applies to `Published`:

- **It is not in anybody's symbol list by default.** `Published` is standard: every `UserProfile` in
  a stock image already has it, so classes filed into it are visible to every gem whoever it logs in
  as. `Mcp` is ours, so `install.sh` adds it to the symbol list of **every** `UserProfile` in the
  image (best effort — a profile it may not edit is reported, not fatal), and
  `setup-oidc-users.sh` adds it to each JWT user it provisions. This matters because a worker gem
  may log in as a *different user* than the front end, and it resolves its worker class and its
  toolsets **by name** at runtime (`McpServer class>>toolsetClassNamed:`); a user without `Mcp` in
  their symbol list gets `undefined symbol McpServer` from the worker bootstrap, or
  `Toolset not found`, on every session. Any user provisioned **after** the install needs the same
  one line —

  ```smalltalk
  up insertDictionary: (System myUserProfile objectNamed: #Mcp) at: up symbolList size + 1.
  ```

  which is exactly what the auth suites' own `withJwtUser:` fixtures do for the throwaway users they
  create.

- **An old binding elsewhere would silently win.** `Published` precedes `Mcp` in the symbol list, so
  a leftover `Published.McpServer` from an earlier install would shadow the new class *at compile
  time* — every method filed in afterwards would bind to the old class, and the install would look
  clean while being wrong. `install.sh` therefore removes the exact names it is about to define from
  every symbol-list dictionary other than `Mcp`, before filing anything in. Unbinding is the whole
  of deleting a class here: `ClassOrganizer` is built from the symbol list, so an unbound class
  stops being a subclass of its superclass for every purpose that matters — which is also all that
  `delete_class` does. Any *other* key beginning with `Mcp` outside the dictionary is **reported and
  left alone**: it may be a third party's toolset, which is not ours to delete.

> **Why not name the dictionary `McpServer`?** A `SymbolDictionary`'s name is the key inside it whose
> value is itself (`SymbolDictionary>>name` is `self keyAtValue: self`). Installing the class
> `McpServer` into a dictionary named `McpServer` overwrites that self-reference, leaving the
> dictionary nameless and `inDictionary: McpServer` resolving to the class. A dictionary cannot share
> a name with a class it holds.

## Source layout

The classes live on disk as plain **topaz file-outs** — canonical `Class>>fileOutClass` output,
grouped by area, with one loader per group:

```
src/core/    21 classes  the server itself: protocol, transport, dispatch, toolsets   (always)
src/tests/   26 classes  the SUnit suites and their fixtures                          (always)
src/auth/     3 classes  the OAuth/OIDC front end McpAuthRouter + its two suites      (3.7.5+)
src/grail/    2 classes  the optional GemStone-Python toolset + its suite             (--grail)
load.gs                  files in core + tests, then commits
```

`install.sh` does not use `load.gs`: it composes the `input` lines for the groups it selected, so
all four combinations of auth and Grail are reachable without a wrapper file per combination.
`load.gs` is for the case where you are already inside a topaz session — it files in the base, and
its header shows the one extra `input` line each optional group needs. Every group holds exactly one
`.gs` file per class plus its `load.gs`, so the file names are the manifest: `install.sh` derives its
post-load verification list from the directories rather than from a list kept in step by hand.

Each group's `load.gs` names its files in dependency order, and every `input` path is relative to the
**repository root** — `install.sh` `cd`s there before starting topaz, so run any loader from the root
too. There is no package manager in the loop: a `.gs` file-out files into any image topaz can log
into, on any GemStone version, with no Rowan and no Tonel.

Each class keeps a `category:` matching its group (`Mcp-Core`, `Mcp-Tests`, `Mcp-Auth`,
`Mcp-Grail`) — nothing
reads it, but it groups the classes in a browser the same way the directories group them on disk.

> **Why each group loader pre-declares its class names.** The classes reference each other in both
> directions (`McpDispatcher` asks `McpServer` for its name; `McpServer` builds an `McpDispatcher`),
> so no file order can put every class ahead of its first mention — the compiler would report
> `undefined symbol` and the file-in would stop. So each loader first binds its class names to `nil`
> in `Mcp`. That is enough, because the compiler binds a global by its **association**, and
> each class definition then fills that same association in; a method compiled before its referent
> still ends up pointing at the real class. Existing keys are left alone, so re-installing over a
> loaded image changes nothing.

> **Migrating an image that previously loaded the Rowan project.** Filing these `.gs` files over
> classes the Rowan `Mcp` project had loaded fails at the *first* method with *"Duplicate definition
> of signalKind:message: in McpError"* (error 2318) — observed 2026-08-19 on a Rowan 3.5.0 + Grail
> image, while the identical file-in into a Rowan-free image loaded every class with no compiler
> errors. The mechanism is not pinned down (topaz's own `removeallmethods` / `removeallclassmethods`
> do clear the class when run on their own, and a plain `compileMethod:dictionaries:category:`
> recompiles happily), so treat it as a property of Rowan-managed classes rather than of the
> file-outs. Install into an image that never loaded the Rowan `Mcp` project. (An ordinary,
> non-Rowan binding of these names in another dictionary is cleared by `install.sh` itself — see
> *The `Mcp` dictionary* above.)

To regenerate a file-out after changing a class in the image, have topaz write `fileOutClass`
straight to its file — do not transcribe an `export_class_source` result, which drifts on trailing
whitespace:

```smalltalk
| s f |
s := McpServer fileOutClass.
f := GsFile openWriteOnServer: '/path/to/mcp_server/src/core/McpServer.gs'.  "no mode: argument"
f nextPutAll: s; close.
```

## Test

Two complementary suites:

**Unit tests (in-image, no socket)** — `./run-unit-tests.sh` logs in via topaz and runs the base
`GsTestCase` suites against the server's logic directly (milliseconds, no network), plus each
optional group's suites where that group was installed — resolved by class name rather than by a
flag, so a missing suite is a skip and not an error:
- `McpToolTest` — every `tool_*` handler called directly on its owning toolset (grouped by the
  `tools - *` categories). Tests operate on throwaway fixtures rather than on the production classes: a
  plain `McpTestFixture` and a `McpTestSuiteFixture` (a `GsTestCase` subclass with passing/
  failing/erroring tests, for the test-runner tools), both classes in `UserGlobals`, plus a
  `McpTestDict` symbol dictionary of its own. All are cleaned up in `tearDown`.
- `McpDispatcherTest` — JSON-RPC routing/envelope: initialize, tools/list (31, alphabetical),
  success + error wrapping, `-32601`/`-32602`/`-32700`, notifications → nil, the per-worker
  entry `handleJsonString:`, and the declared capabilities — `tools` present, `logging` /
  `listChanged` / `resources` / `prompts` / `completions` deliberately absent.
- `McpSessionTest` — how a session drives its worker gem: the non-blocking `runWorker:` that
  `forward:` and `prepareWorker` both use, that it reads the result only once the call is over (a
  premature read would answer one request with another's response), that two concurrent requests on
  one session serialize instead of colliding, that a worker error leaves the session usable, that
  the idle reaper leaves a session with a call in flight alone, and the request deadline: a call that
  beats it is untouched, one that outruns it is soft-broken and the session survives, a worker that
  ignores that gets a hard break, and one that ignores both has its gem stopped and its session
  finished. Driven through `McpMockWorker` / `McpMockSession`, which stand in for the
  `GsTsExternalSession` with no gem.
- `McpWorkerDeadlineTest` — the one thing a mock cannot show: that a call which outruns the
  request deadline is really **broken** in this image, and that the worker gem is usable again
  afterwards — the claim the whole feature rests on, since a break that did not land would mean
  answering a client while the gem computed on. Both shapes of runaway (a Smalltalk loop, a blocked
  wait) plus the gem that takes neither break and has to be stopped from the stone. `McpSessionTest`
  covers the policy against a mock; this covers the mechanism against a gem. Needs a netldi.
- `McpExternalSessionTest` — the one thing a mock cannot show: that a result fetched out of a **real**
  worker gem arrives with the bytes the worker sent. It drives a real `McpSession` through the same
  `runWorker:` the forwarding path uses, so it measures the path the server runs on, and it tests the
  *image* rather than mcp_server — a failure means the running GemStone carries kernel defect #51438, not
  that `src/` is wrong. Needs a netldi; see the note below.
- `McpTransactionTest` — the transaction model across tool calls, and the one state a session can
  get stuck in. It spawns a second worker gem to commit a **conflicting** change, which is the only
  way to reach a *failed* commit — nothing short of a real second session produces one. That state
  is sticky (the per-call `continueTransaction` then raises `TransactionError` 2409 on every later
  call), so the suite pins what the client is told and how it gets out: that the conflict is raised
  rather than quietly reported as success, that the jammed session still reports the failed commit
  and keeps its uncommitted work, that `refresh` is refused while jammed, and that `abort` is the
  way out. Plus the ordinary-case guarantees the jam is measured against: no tool moves the view,
  and a stale write is refused rather than silently overwriting. Needs a netldi.
- `McpTransportTest` — `handleConnection:` driven over a **`McpMockSocket`** wrapped in a
  real `McpHttpConnection`, so the genuine HTTP parsing/writing runs with no TCP. Covers the
  paths that spawn **no** worker gem: a session-less GET→`400`, DELETE→`400`/`404`, unknown verb→405,
  malformed→`-32700`, a session-less POST→`400`, chunked delivery, EOF, Content-Length — and the one
  `initialize` that belongs here, the one **refused at `maxSessions`**, which is answerable without a
  login. (A successful initialize and a routed tool call spawn a real worker, so they're exercised by
  the integration test instead.)
  Also the **dead worker**: that a call whose gem died is answered `-32001` with `data.kind`
  `sessionGone` bearing its own id (and as a *frame* where the call was already streamed), that the
  session is unmapped as part of answering so the next request on it `404`s, that the reason in full
  goes to the log while the client gets the number rather than the gem's NRS, and — the reason the
  classifier has to be narrow — that an ordinary worker-side error leaves the session registered and
  serving. `McpMockWorker>>dieOnComplete` raises through `GciError` itself, so the number under test
  is the kernel's; the *first* failure's number needs a gem that really died, which is `test.sh`.
  Also the **message trace**: off by default, the body text on the line, one line per message however
  many newlines the body holds, the cap and its `...(+N more)`, a `403`-refused request traced anyway,
  the `Authorization` header staying out, and both settings surviving the fork-string round-trip.
  Uses `McpFixtureRouter`, whose second seam captures `log:` into `#loggedLines`.
- `McpOutboxTest` — `McpOutbox` on its own: FIFO, the bound and the drop-oldest policy with its
  admitted gap, the `beginClosing`/`close` handshake, and latest-GET-wins — including that detaching
  a superseded stream must *not* roll the generation back, or the stream that replaced it would look
  stale and end too.
- `McpGemNameTest` — what the gems call themselves in the shared cache
  ([Naming the gems](#naming-the-gems)): both ends of the cache's measured 1–31 character range, that
  an over-long name is truncated rather than raising and an empty one is dropped, that each gem leads
  with the class actually running (the front end its own, plus its port; the worker the class the
  router named it, plus the front-end session and the head of the client's id), that a long worker
  class name loses characters rather than the two identifying fields, that the name travels in the
  bootstrap expression, and that the worker end applies it. The three collaborators sit in different
  hierarchies (`McpBase` holds the limit, `McpRouter` and `McpSession` build the two names), so they
  are pinned together rather than in three suites. Every test that can rename the *driving* session
  restores it.
- `McpStreamTest` — the whole server-to-client pathway with no sockets: the session-scoped GET
  (`400`/`404`/stream), the drain onto the stream, a closing outbox getting its last flush, a POSTed
  JSON-RPC response → `202` and its correlation back to the ping that caused it, the probe over an
  idle session and the accounting its answer feeds, that a session with no stream is never probed,
  that an answered ping does **not** move the activity clock, that an unanswered one frees the gem
  early, and that a reaped session is unmapped and closed **without** a farewell on its stream. Uses `McpFixtureRouter`, a real router that reports
  itself running without binding a socket, so the drain loop can be driven at all.
- `McpLifetimeTest` — the *policy* riding on that pathway, which is a separate thing: that the
  intervals are config and survive the fork (including the JSON `null` that means "no deadline"),
  that **`maxSessions` is enforced before any login is attempted** — including from inside a
  creation block, which stages deterministically the race a client arriving mid-login would
  otherwise have to win — and that a slot comes back whether the session was released or the login
  failed,
  that an unworkable combination of them is refused at startup, that a probe lost to a stream
  handover is **discarded rather than condemned** while one lost on the
  current stream still condemns,
  that an indefinite session lives while it answers and goes when it stops — with a floor for
  the client that opens no stream — that an expiry is absolute, and that a wildly late maintenance
  pass is read as a host suspend and forgiven instead of reaping every live client at once.
- `McpViewHygieneTest` — what the front end does about database **views**. Which transaction mode a
  detached front end asks for (`transactionless`, so it stops holding a commit record the stone
  cannot dispose of), that a mode nobody implements is refused where the router is configured rather
  than in the gem serving clients, that the setting survives the trip into a forked gem, that the
  refresh takes a whole new view without disturbing the transaction mode, that a maintenance pass
  begins with it — and the bug detector, since a front end that ever writes to the repository loses
  that write *silently* out of transaction, so one log line is all that stands between the defect and
  nobody noticing. Then the **workers'** views: that a session far enough behind the repository is
  noticed and recorded, that pressure on the stone is never on its own a reason to move one
  particular client's view, that a reading which cannot be taken is skipped rather than recorded as
  zero, and that each of the three verdicts a worker can answer is recorded. Then the worker's own
  side: that a refresh **keeps** uncommitted work — the claim the whole design rests on — that the
  client is told exactly once, and what that note may and may not promise. Then the last ground a
  session can be reaped on: that a view which **cannot** be moved is released only when all four
  conditions hold, that a configured grace is a floor rather than a ceiling, that a zero grace means
  the pass that finds it, and that a pass which could not *ask* proves nothing. Last, the arm that
  ends a **running** call whose view is pinning the repository's oldest commit record: that a quiet
  repository never ends one however long it runs, that the run must be consecutive, and that every
  ending this server causes is one the client is told the reason for. Declares
  `movesTheSessionView`: its subject is this gem's view.
- `McpContractTest` — contract / property tests over the tool surface, all driven through the real
  `McpDispatcher>>handle:` envelope: every tool schema is closed (`additionalProperties:false`),
  unknown/missing arguments → an `isError` tool execution error while a missing tool name / unknown
  tool stay `-32602`, `ping` → an empty result, a raised error carries a structured `kind`, and
  kernel-class mutation is refused. Also the toolset invariants: `tools/list` offers the whole
  registry (all 31 of the default surface, mutating tools included), `toolNames` matches what
  `registerOn:` registers, a server built from one toolset exposes only its tools, and the kernel
  guard survives a dictionary that shadows a kernel name. Socket-less and worker-less, so it runs in
  `run-unit-tests.sh` with the others above.
- `McpExtensionTest` — the extension story through two fixtures: `McpFixtureToolset` (a third-party
  toolset that owns its handler) and `McpFixtureServer` (a named worker subclass that names itself).
  Covers a vendor server exposing **only** its own tools,
  two independent toolsets composed on one server,
  the worker entry answering as the named subclass, and the identity precedence — router config
  relabels a subclass's own default. `McpStubSession` lets it drive
  `McpRouter>>openSessionCreating:` (configure **and** prepare) with no login.
- `McpAuthTest` *(3.7.5+ images, where the auth group installs)* — the authenticated front end
  (`McpAuthRouter`): missing / non-bearer / garbage / valid tokens, RS-layer `exp` / issuer /
  audience / scope validation, that a worker runs as its own token's GemStone user, and that
  `workerUserId:` is refused here. Unlike every suite above it
  commits a throwaway JWT user and spawns real worker gems, so it needs a netldi running.
- `McpGrailToolsetTest` *(Grail images only)* — the optional Python toolset: `eval_python`→`42`,
  `compile_python`→`___binOpMul___:`, `print`→`None`, all three Python failure paths (undefined name,
  runtime, syntax) surfacing as `isError` with `kind = "pythonError"`, a 33-tool `tools/list` check on
  core-plus-Grail, and the toolset being served only when a router NAMES it (loaded is not exposed).
  The last two failure paths were switched-off tripwires while Grail crashed the
  gem on them; both run for real as of 2026-08-18. Also `eval_python`'s output channels: stderr
  captured and labelled per line, a `warnings.warn` reported, both channels delivered ahead of the
  traceback when the code raises, and a client's own `sys.stdout` redirect left installed across
  calls — checked between calls, which is the only moment it is the installed one.

Run a single suite while a server is up via the `run_test_class` tool (e.g. `run_test_class
McpToolTest`). `./run-unit-tests.sh` runs them all and exits 0 when every test passes: the
socket-less suites `McpJsonTest` (12), `McpUtf8Test` (7), `McpBlindWriteTest` (41),
`McpToolTest` (65), `McpDispatcherTest` (21), `McpSessionTest` (24), `McpOutboxTest` (9),
`McpProgressTest` (19), `McpStreamTest` (18), `McpLifetimeTest` (56), `McpViewHygieneTest` (46),
`McpTransportTest` (48), `McpContractTest` (35), `McpExtensionTest` (14) and `McpGemNameTest` (16),
plus `McpConcurrentEditTest` (18), `McpExternalSessionTest` (5), `McpTransactionTest` (8) and
`McpWorkerDeadlineTest` (4) — **466 tests**,
which is the whole suite on a base install. Where the optional groups are installed the runner picks
their suites up automatically: plus `McpAuthTest` (31) and `McpAuthConformanceTest` (25) — **522
tests** — and **573 with the 51 in `McpGrailToolsetTest`** on a Grail image.

Seven suites are not purely in-image and need a **netldi** running. `McpAuthTest` and
`McpAuthConformanceTest` commit a throwaway JWT user and spawn real worker gems; they are in the
runner anyway, because they are the only cover for the token → session path.
`McpExternalSessionTest` checks that a result arrives out of a real worker gem carrying the bytes
the worker sent, `McpTransactionTest` that a *second* gem committing a conflicting change leaves
this session in the state a failed commit really produces, and `McpWorkerDeadlineTest` that a call
which outruns the request deadline is really broken in a real one, and `McpConcurrentEditTest` that
the blind-write guardrail holds against a real second session — so the runner asks for a netldi on
any image where they are installed, which is every image, since all four are part of the base
install. `McpGrailToolsetTest` joins them on a Grail image, because `run_python_tests` forks the gem
it runs Grail's classes in. That is no new burden in practice: mcp_server gives every
client its own worker gem, so it cannot serve a single request without a netldi either.

Those seven also need **spare login slots**, which is the likeliest reason for a failure that is
nothing to do with the code: each spawns worker gems of its own, so a stone whose `StnMaxSessions`
is already consumed by running servers fails them with *"the maximum number of users are already
logged in."* Stop the servers, or raise the limit, before reading such a failure as a regression.

> **`McpExternalSessionTest` checks the image as much as this code.** GemStone before 3.7.4.1
> carries kernel defect #51438: `GsTsExternalSession>>resolveResult:` refetches an object only when
> its 1024-byte fetch buffer has to *grow*, so a later result can arrive as 1024 good bytes followed
> by the tail of an earlier one — right length, plausible bytes, no error raised. mcp_server would
> meet that on its main path, since every MCP response is a String of JSON pulled out of a worker
> gem, which is why the suite pins it. All five pass on a supported image; two of them fail on an
> older one to say why it is not supported, and the other three are controls that localise the
> failure. See the `McpExternalSessionTest` class comment for the mechanism.

> Note: a test helper must never reuse a SUnit framework selector (`run:`, `setUp`, …) — doing
> so shadows the framework method and silently breaks `suite run`. The transport helper is named
> `runRequest:` for this reason.

**Integration test (real socket)** — `./test.sh` starts the server in its own gem and drives the
full Streamable HTTP transport with `curl`: it `initialize`s, captures the `MCP-Session-Id`, and
sends it on every subsequent request (tools/list of the 31 base tools, every core tool, a
compile_method/commit round-trip, error paths, the SSE GET stream, DELETE), then shuts the server
down. Three further front ends are forked for the things only a differently-configured server shows:
that a session-lifetime policy survives the fork, that the concurrency cap refuses a client rather
than the stone, and — the one check that needs a gem to really die — that a worker killed by
exhausting its temporary object memory ends its session with a `sessionGone` error, a `404` on the
next request, and its slot back. It targets the **base** server — run it against a base install. Uses port `8011` by default
(set `MCP_PORT`). Exit status 0 = all passed.

**TLS test (real HTTPS socket)** — `./test-tls.sh` forks a TLS-enabled server and drives the same
transport over HTTPS with `curl -k`: TLS handshake, the self-signed cert, the SSE GET stream,
`initialize`, a routed tool call, the unknown-session 404, and a check that plaintext HTTP is
refused on the TLS port. It generates a throwaway self-signed `certs/` cert if none exists, and
sets the cert/key **only in the forked gem's session (never committed)**, so the repository's
default stays plaintext — nothing to restore even if interrupted. Uses port `8443` by default
(set `MCP_PORT`). Exit status 0 = all passed.

## Future work

- Exposing class and method source as MCP **resources**, so a client is notified when another gem
  recompiles a method and its cached source goes stale.
- Carrying messages that originate in a **worker** gem — progress during a long tool call, log lines
  from tool internals — which needs a worker→router channel.
- SSE resumability (`Last-Event-ID`).
- Mapping **OAuth scopes to toolsets**, so a token's scopes select what it may *see* rather than only
  whether it may write.
- Tracing the **outbound** half — responses, the error bodies behind a refusal, and server-initiated
  stream frames — to complete [Message trace](#message-trace), which today records only what the
  client sent.
- The draft `2026-07-28` protocol revision, which first needs a decision about how per-client
  worker-gem isolation survives a protocol with no session id — see
  [Protocol conformance](#protocol-conformance).
