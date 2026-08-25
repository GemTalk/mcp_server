# Native GemStone MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server written natively in
GemStone Smalltalk. It runs **inside** the image and executes tool calls directly — no
Node.js process, no GCI/FFI bridge. The goal is to replace the GCI-based Jasper MCP
server with one that any MCP client can reach over plain HTTP.

**Status:** the Streamable HTTP transport, per-client worker gems, 31 base tools (+2 optional
Python), OAuth 2.1 / JWT + TLS, per-router read-only mode and server-initiated messages are built
and verified end-to-end — by curl, by a TLS run, and by the in-image suites. What is *not* built is
listed under [Future work](#future-work).

A note about versions: `run-server.sh` is safe to use on a 3.7.5 stone, but `run-auth-server.sh`
needs 3.7.6 due to a bug in connecting to an external OIDC IdP.

## Install & run

```bash
export GEMSTONE=/path/to/GemStone64Bit3.7.x   # product dir

./install.sh --check                # verify the environment first -- do this on a new machine
./install.sh                        # file in the classes (core + tests + auth) and commit
./install.sh --grail                # ...and the optional Grail/Python toolset (Grail image only)
GS_MCP_PORT=8000 ./run-server.sh    # fork a detached, independent localhost server gem and return
GS_MCP_READONLY=1 ./run-server.sh   # ...read-only (browse/search only; no accidental mutation)
GS_MCP_TOOLSETS="McpBrowsingToolset McpSearchToolset" ./run-server.sh   # ...only these tools
GS_MCP_WORKER_CLASS=MyMcpServer ./run-server.sh                        # ...a subclass as the worker
./run-auth-server.sh                # ...the OAuth/OIDC network-facing server (McpAuthRouter)
```

`install.sh` and the `run-*.sh` scripts use topaz; set `GEMSTONE`, `GS_STONE`, `GS_USER`,
`GS_PASS` to match your environment — and read **Environment** below before assuming those four are
enough, because on many machines they are not. `install.sh` files the code in with topaz from `load.gs` —
which on this branch includes `src/auth/`, since the OAuth front end is the point of it; `--grail`
(or `GS_MCP_WITH_GRAIL=1`) files in `load-grail.gs` instead, which adds the `src/grail/` group on
top. `run-server.sh` builds a base `McpRouter` instance and calls
its `forkOnPort:` (`run-auth-server.sh` builds an OIDC-configured `McpAuthRouter` — resource-server
config as code, no commit), which launches a detached, independent front-end gem and returns; stop it
with `./stop-server.sh` (by port), or the `System stopSession: <id>` / `kill <pid>` line it prints.
A loaded Grail toolset is picked up automatically, per session, by the front end.

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
netldi is what forks those gems. `run-unit-tests.sh` needs one too, because `McpAuthTest` spawns a
real worker. Each script checks for what it actually needs, and says which is missing.

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
- **DELETE `/mcp`** — ends the session named by `MCP-Session-Id` (closes its worker). Answers the
  same codes as the POST path: missing header → **`400`**, unknown/already-ended id → **`404`**,
  live session → **`200`**.
- Any other method → `405`.

`ping` is answered with an empty result on every session, as the spec requires — and is also **sent**
by the server, as a liveness probe on idle sessions.

Declared capabilities: `tools` and `logging`. `logging/setLevel` is honoured (RFC 5424 levels,
default `info`); the level is recorded by the front end, which is what generates log notifications.

**Security (per the MCP spec):** the server binds only to `127.0.0.1`, session ids are
cryptographically-random 128-bit tokens, and every request's `Origin` header is validated to
prevent DNS-rebinding — a present `Origin` whose host is not loopback (`localhost`/`127.0.0.1`/`[::1]`)
gets **`403`**; an absent `Origin` (non-browser clients like curl) is allowed. Add a browser app's
origin host by configuring the router instance — `(McpRouter new allowedOriginHosts: #(...)) forkOnPort: 8000`.
For network-facing use,
the `McpAuthRouter` subclass adds OAuth 2.1 / JWT bearer-token authentication (per-user worker gems),
a `WWW-Authenticate` challenge + RFC 9728 Protected Resource Metadata, TLS (`GsSecureSocket`), and
scope-based [read-only sessions](#read-only-mode); the base `McpRouter` is the localhost,
unauthenticated front end.

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
| `resources/*`, `prompts/*`, `logging/*`, `completion/*` | undeclared and answered `-32601` |
| Notification POST | `202 Accepted`, no body |
| Invalid `Origin` | `403` |
| Invalid/unsupported `MCP-Protocol-Version` | `400` |
| Missing session id / unknown-expired session id | `400` / `404`, on both POST and DELETE |
| Malformed body | `400` + `-32700` |
| Tool input schemas | JSON Schema 2020-12 (no `$schema` needed), closed with `additionalProperties: false` |

`serverInfo.title` is sent when a deployment configures one (see *Writing your own MCP server*) and
omitted otherwise, so a client falls back to displaying `name`. That is the **server**'s title; a
**tool** `title` is not implemented.

Not implemented, all optional at these revisions: pagination (`tools/list` returns every tool and
no `nextCursor`), `listChanged` notifications, SSE resumability (`Last-Event-ID` — no event `id:` is
emitted at all, deliberately: ids without a replay buffer behind them invite a resume the server
cannot honour), progress notifications, elicitation, sampling, resources, prompts, tool `title` /
`annotations` / `icons` / `outputSchema`, server `instructions`, and `tasks`.

The **draft `2026-07-28`** revision is a different protocol era — no `initialize`, no sessions, no
GET stream, per-request `_meta`, and a mandatory `server/discover`. It is not implemented, and
supporting it will need a decision about how per-client worker-gem isolation survives a protocol
with no session id to key it on.

## Tools (31 base + 2 optional Grail)

**Execution**

| Tool | Arguments | Result |
|------|-----------|--------|
| `execute_code` | `code` | `printString` of evaluating the Smalltalk source |

**Session / transaction**

| Tool | Arguments | Result |
|------|-----------|--------|
| `abort` | – | abort the transaction, refresh the view |
| `commit` | – | commit the transaction |
| `refresh` | – | refresh the view to see other sessions' commits |
| `status` | – | session user, id, stone, uncommitted-changes flag |

**Listing**

| Tool | Arguments | Result |
|------|-----------|--------|
| `list_all_classes` | – | every class across all dictionaries |
| `list_classes` | `dictionaryName` | classes in a dictionary |
| `list_dictionaries` | – | symbol dictionaries in lookup order |
| `list_dictionary_entries` | `dictionaryName` | every entry, tagged (class)/(global) |

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
| `find_implementors` | `selector` | methods implementing the selector |
| `find_references_to` | `name` | methods referencing a named global/class |
| `find_senders` | `selector` | methods sending the selector (capped at 200; note shows the true total) |
| `search_method_source` | `pattern`, `dictionaryName?` | methods whose source contains the substring (capped at 200) |

**Mutation**

| Tool | Arguments | Result |
|------|-----------|--------|
| `add_dictionary` | `dictionaryName` | create + append a dictionary, commit |
| `compile_class_definition` | `source`, `recompileMethods?` | evaluate a class-definition expression, commit; the source must evaluate to a class (other expressions are rejected — use `execute_code`); on a shape change, by default recompiles the class's methods onto the new version and reports any that fail (refused if it has subclasses) |
| `compile_method` | `className`, `source`, `category?`, `meta?` | compile a method, commit |
| `delete_class` | `className` | remove a class, commit *(destructive)* |
| `delete_method` | `className`, `selector`, `meta?` | remove a method, commit *(destructive)* |
| `remove_dictionary` | `dictionaryName` | remove a dictionary, commit *(destructive)* |
| `set_class_comment` | `className`, `comment` | set the class comment, commit |

**Testing (SUnit)**

| Tool | Arguments | Result |
|------|-----------|--------|
| `describe_test_failure` | `className`, `selector` | re-run one test in isolation, return the failure/error detail (exception class + `description`) |
| `list_failing_tests` | `classNames?` | failing/erroring methods (given classes, or all) |
| `list_test_classes` | – | all `TestCase` subclasses |
| `run_test_class` | `className` | run a test class, summary + failures |
| `run_test_method` | `className`, `selector` | run one test method |

**Python (optional — the `McpGrailToolset`)**

These live in the optional `McpGrailToolset`, in its own source group (`src/grail/`) which only
`install.sh --grail` loads — they reference `ModuleAst` and `BaseException`, so they cannot compile in
an image without Grail. Once loaded the toolset joins the default tool surface automatically
(`McpServer class>>installedDefaultToolsetNames`), or can be named explicitly in a router's
`toolsetNames`.

| Tool | Arguments | Result |
|------|-----------|--------|
| `compile_python` | `code` | transpile Python source to Smalltalk via Grail (`ModuleAst`), return the generated source |
| `eval_python` | `code` | evaluate Python source via Grail (`ModuleAst`), return the `printString` of the result |

> **Requirement:** these tools call Grail's `ModuleAst` directly with no capability check, so they
> need an image with GemStone-Python installed.
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
  `execute_code` is the deliberate escape hatch (and is itself gated in read-only mode).
- **Structured error kinds** — when a tool raises, the `isError` result keeps the human-readable
  message in `content` **and** carries `structuredContent.error.kind`, a short machine-readable
  classifier (`compileError`, `refused`, `readOnly`, `notFound`, `invalidParams`, `other`), so a
  client can branch on the kind instead of parsing prose.

## Read-only mode

A router can refuse every state-changing tool, so a client can browse and search but not modify the
image — primarily a **localhost convenience** so a single user cannot *accidentally* mutate or commit
(it is a tool-gate, **not** an access-control boundary). Read-only is **per-router**: the router marks
each worker read-only at session open, so two routers (one read-only, one not) can run at once with
no shared state. A worker is read-only if **either** applies:

- **The router is read-only** — `(McpRouter new readOnly: true) forkOnPort: 8000`, or the shortcut
  `GS_MCP_READONLY=1 ./run-server.sh`. Every session that router opens is read-only.
- **By OAuth scope (`McpAuthRouter`)** — give the router a `writeScope` (e.g. `./run-auth-server.sh`
  with `MCP_WRITE_SCOPE=mcp:write`): a token carrying that scope gets a read-write worker; a token
  lacking it gets a read-only worker for that session. For a client to actually *request* that scope,
  the router must also **advertise** it — and it does so automatically, so there is nothing to keep
  in sync. Advertising without requiring is the point: an entitled user is granted the scope and gets
  read-write, while an unentitled user (the authorization server withholds it) still connects
  read-only.

`supportedScopes` is the set published as `scopes_supported` (RFC 9728 metadata) and offered in the
`WWW-Authenticate` challenge — what clients are told to request, as distinct from `requiredScopes`,
what every token *must* carry. It is **derived, not configured**: the union of `requiredScopes`, the
`writeScope`, and `extraScopes`. Because it is a union, a required scope is always advertised and the
write scope is always requestable — neither can be left out by a configuration slip, and there is no
subset rule to observe. Set `extraScopes` only for scopes the router itself does not gate on but the
client still needs to ask for, such as an authorization server's own `profile`.

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

**What's gated:** everything that can persist a change or run arbitrary code — `execute_code`,
`commit`, and all the mutation tools. Everything else (browsing, listing, search,
`status`/`refresh`/`abort`, and the test-runner tools) stays available.

**Each toolset declares its own safe tools** (`McpToolset>>readOnlySafeToolNames`), and the server
answers their union, so a third-party toolset decides for its own tools without editing anything
central. It is **fail-closed**: the default declaration is *empty*, so a newly added tool is gated
until its toolset explicitly vouches for it. `McpServer class>>coreReadOnlySafeToolNames` remains as
the **audit list** — the one place to read the whole core answer — and `McpContractTest` pins the
union of the seven core toolsets against it, so a tool cannot quietly become "safe".

Screening happens at both levels, which matters because one family is mixed: `McpSessionToolset`
holds `abort`/`refresh`/`status` (safe) *and* `commit` (not). A toolset that declares nothing safe —
mutation, execution — is dropped whole; a mixed one keeps only its safe tools.

Two moments, too. When the router opens a read-only worker the gated tools are **never registered**
(the flag is set before the server is built), which is a stronger gate than refusing them on call;
the dispatcher's check still runs for a server whose flag was set afterwards. Either way a gated tool
is **hidden from `tools/list`** and, if called by name, returns `-32601` with
`error.data.kind = "readOnly"` — deliberately *not* `notFound`, so a client can tell "exists but
forbidden here" from "no such tool". A tool absent because its toolset was never loaded genuinely
*is* `notFound`.

## Architecture

| Class | Role |
|-------|------|
| `McpBase` | abstract superclass of the router + worker; holds only what both share — `parseBody:`, `log:`, the JSON-RPC envelope builders for server-initiated messages, and the RFC 5424 log-level table |
| `McpRouter` | front end: accept loop, HTTP, routing, the `MCP-Session-Id → McpSession` map, the SSE drain loop, the pending-request table, and the session reaper. Owns the socket; never runs a tool |
| `McpAuthRouter` | network-facing `McpRouter` subclass: requires an OAuth/JWT bearer token, logs each worker in as its own GemStone user, serves the `WWW-Authenticate` challenge + RFC 9728 metadata, validates token claims/scopes, adds TLS, and (via `writeScope`) can open a session read-only |
| `McpServer` | per-client worker: the single-client MCP server that runs inside each worker gem — registry, dispatcher, the kernel guards, read-only gating, identity. The tools themselves belong to its toolsets, and which of those it registers is not fixed by the class. No socket |
| `McpToolset` | abstract tool pack: `registerOn:` (its tools + schemas), its `tool_*` handlers, `toolNames`, `readOnlySafeToolNames` (empty by default — fail closed), plus the shared schema builders, image-lookup helpers, and the kernel guards (which forward to the server's policy). **Subclass this to add tools**; a deployment picks the list |
| `McpBrowsingToolset`, `McpExecutionToolset`, `McpListingToolset`, `McpMutationToolset`, `McpSearchToolset`, `McpSessionToolset`, `McpTestingToolset` | the seven core toolsets, one per tool family. A deployment can expose any subset — or none of them, alongside its own |
| `McpGrailToolset` | optional Python toolset (`eval_python`, `compile_python`), filed in only on a Grail image. Needs nothing from the server, so it doubles as the worked example for a third-party toolset |
| `McpSession` | one client's isolated worker handle: a `GsTsExternalSession` gem + session id + last-activity + the worker class/toolsets/identity the front end resolved, plus the front-end-side outbox, log level and liveness state. `prepareWorker` sets the gem up in one call; `forward:` runs a request in it (`<workerClass> handleJsonString: …`) without blocking the front end (`runWorker:`); `close` stops it |
| `McpOutbox` | one session's queue of server-initiated messages waiting for its SSE stream. Front-end-only and never committed; owns the bound/overflow policy, the closing handshake, and the latest-GET-wins rule |
| `McpHttpConnection` | reads one HTTP/1.1 request, writes one JSON response (incl. `MCP-Session-Id`), and writes the SSE stream — every frame gated on the socket being writable, plus a non-blocking read-side disconnect check |
| `McpDispatcher` | JSON-RPC 2.0 / MCP routing (`initialize`, `tools/list`, `tools/call`, `ping`, `logging/setLevel`); read-only tool gating; structured error kinds |
| `McpToolRegistry` | name → `McpTool` map; produces `tools/list` descriptors |
| `McpTool` | one tool: name, description, JSON Schema, handler block; validates arguments against the schema |
| `McpError` | an error carrying a machine-readable `kind` (e.g. `refused`, `readOnly`) that the dispatcher surfaces in the tool-call error envelope |

Built on existing image facilities: `GsSocket` (TCP), `JsonParser parse:` and
`Object>>asJson` (JSON), and `String>>evaluate` (the `execute_code` engine).

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
  logged in as the current user via a one-time password), **prepares** it with a single
  `prepareWorkerWithToolsets:readOnly:serverName:title:version:` call — which sets read-only, resolves the
  named toolsets, applies the advertised identity, and pre-builds the server so the client's first
  request has no registration to do — assigns a server-side id, and returns it in the
  **`MCP-Session-Id`** response header. A worker class or toolset the worker gem cannot resolve fails
  here, at session open, where the error can say what to fix.
- **Every other request** must carry that header. The front end looks up the worker (map guarded
  by a mutex) and **forwards the raw JSON-RPC body** to it — `worker nbExecute: '<workerClass>
  handleJsonString: ' , body printString`, naming the class the router resolved — the worker runs
  the tool in its own session and returns the response, which the front end relays. Missing id →
  `400`; unknown/expired → `404` (a compliant client re-initializes).
- **DELETE** closes the worker; and a **background maintenance `GsProcess`** (every 60s) probes,
  warns and reaps idle sessions, so abandoned test gems don't pile up. A session is reaped after
  **30 minutes** idle by default (`sessionIdleTimeoutSeconds`, configurable and optional) — or
  sooner, if it fails a liveness probe on the stream it opened. See
  [Server-initiated messages](#server-initiated-messages).

Isolation comes from each worker being a separate gem = a separate transaction view, and clients
really do run **concurrently**: forwarding is non-blocking (`McpSession>>runWorker:`), so one
client's long tool call no longer stalls anyone else — see
[Concurrency & robustness](#concurrency--robustness) below.
The base `McpRouter` logs every worker in as the current (server) user; the network-facing
`McpAuthRouter` instead logs each worker in as the **token's own GemStone user** via JWT.

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
out mid-request. A forwarded request still has **no deadline**: a runaway tool ties up its own
session for as long as it runs, though no longer anyone else's.

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
transaction view** — reaping one throws away uncommitted work. Previously a client discovered that
by meeting a cold `404` on its next call. Now, for a session drifting toward the idle deadline and
holding an open stream:

| When | What happens |
|---|---|
| idle > 25 min | the server sends a `ping` on the stream (`ping` is bidirectional; the receiver MUST answer) |
| the client answers | it is **proven live** — and gets a `warning`-level `notifications/message` saying how long is left and that uncommitted changes will be lost |
| the client does not answer | it is **proven gone** — its worker gem is released early rather than waited out |
| the session is reaped | a last notice goes out on the stream first, explaining why the gem went |

**An answered `ping` deliberately does *not* reset the activity clock.** It proves someone is
listening; only real MCP traffic keeps a session alive. Refreshing the clock instead would mean any
well-behaved client — they all answer `ping` — held a gem and a transaction view for as long as it
stayed open, and the warning would only ever reach clients unable to act on it.

A client that never opens a GET stream is left exactly as it was: never probed, never warned, reaped
on the plain 30-minute timeout. Pinging it would only mark it unanswered and cost it its gem early.

**An unanswered ping is evidence of death only if it went down the stream the client is still on.**
A message is written to exactly one stream, and both shipping clients reconnect a dropped standalone
`GET` on their own — a handover being likeliest on exactly the quiet sessions the reaper probes. The
write into a superseded stream *succeeds*, into a socket buffer nobody will ever read, so the silence
that follows says nothing about the client. Every probe therefore records the stream generation it
was written to, and a verdict is drawn only if that generation is still current; otherwise the probe
is discarded and re-sent down the new stream on the next pass. (Measured against real clients on
2026-08-23, this accounted for 6 of 14 pings.)

**A session that reaches the deadline unwarned gets one bounded grace period.** The warning is the
promise this makes — commit or lose the uncommitted work in your gem — and a session can arrive at
the deadline never having heard it. That grace is not a liveness reprieve: answering the ping does
not save the session, it only means the notice reaches someone listening.

### The pieces

| | |
|---|---|
| `McpOutbox` | per-session FIFO queue, bounded at 256 (drops oldest, then admits the gap on the stream). Its own mutex — the router's is held across reaping. Hands out a **stream generation** so the newest `GET` wins and two drainers can never interleave frames on one socket |
| `McpRouter>>serveGetStream:forSession:` | the drain loop. Yields every tick, so holding a stream open costs the gem nothing |
| `McpBase>>notification:params:` / `request:params:id:` | envelope builders on the front-end side. `McpDispatcher` lives in the worker and cannot be asked to build one mid-tool-call |
| pending-request table | `srv-N` ids in their own namespace, timed out at 30s — an unanswered ping must decide something, never hang a session |

### Session lifetime

How long a session lives is deployment policy, not a constant: the idle deadline, the liveness-probe
interval, the absolute cap, and what an authenticated router does with a token's own `exp`. Because
a session here **is a gem holding a transaction view**, those choices decide when uncommitted work
is thrown away — so they have their own document: **[docs/session-lifetime.md](docs/session-lifetime.md)**.
It covers every knob and its default, what actually ends a session, why nothing is measured in
elapsed time, and why a host suspend needs no handling at all.

From the shell, `GS_MCP_IDLE_TIMEOUT` and friends set all of it on either launcher — see
[session-lifetime.sh](session-lifetime.sh), which documents each.

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

## Writing your own MCP server

You can ship an MCP server for **your** software on this transport — including one that exposes only
your tools, with none of the Smalltalk-development surface. There are two extension points, and the
first is the one you usually want.

**To add tools, write a toolset.** Subclass `McpToolset`, implement `registerOn:` (one
`name:description:inputSchema:do:` send per tool, building schemas with the inherited
`objectSchema:required:` / `propString:` / `boolProperty:` helpers), implement `toolNames`, and
declare `readOnlySafeToolNames` for whichever of your tools cannot persist a change — the default is
*none*, so an undeclared tool is gated in a read-only session. Write the handlers as instance methods
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
browsing, and two unrelated vendors' toolsets can be combined. This is the reason tools live in
toolsets rather than in `McpServer` subclasses: single inheritance could never express it.

**To change behavior, subclass `McpServer`** — the kernel guards, the worker entry, dispatcher
wiring, or the advertised identity. Name your subclass in `workerClassName` (nothing auto-detects
it):

```smalltalk
(McpRouter new workerClassName: 'AcmeDbServer'; toolsetNames: #('AcmeDbToolset')) forkOnPort: 8000
```

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
(McpRouter new readOnly: true; serverTitle: 'GemStone (read-only)') forkOnPort: 8001
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
> must be in a symbol dictionary in the **worker's** symbol list — `Published`, not the operator's
> `UserGlobals`.

## Source layout

The classes live on disk as plain **topaz file-outs** — canonical `Class>>fileOutClass` output,
grouped by area, with one loader per group:

```
src/core/    18 classes  the server itself: protocol, transport, dispatch, toolsets
src/tests/   15 classes  the SUnit suites and their fixtures
src/auth/     3 classes  the OAuth/OIDC front end McpAuthRouter + its two suites
src/grail/    2 classes  the optional GemStone-Python toolset + its suite
load.gs                  files in core + tests + auth, then commits
load-grail.gs            files in core + tests + auth + grail, then commits
```

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
> in `Published`. That is enough, because the compiler binds a global by its **association**, and
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
> file-outs. Install into an image that never loaded the Rowan `Mcp` project, or remove the `Mcp*`
> keys from `Published` and commit before running `install.sh`.

To regenerate a file-out after changing a class in the image, have topaz write `fileOutClass`
straight to its file — do not transcribe an `export_class_source` result, which drifts on trailing
whitespace:

```smalltalk
| s f |
s := McpServer fileOutClass.
f := GsFile openWriteOnServer: '/path/to/gs-mcp/src/core/McpServer.gs'.  "no mode: argument"
f nextPutAll: s; close.
```

## Test

Two complementary suites:

**Unit tests (in-image, no socket)** — `./run-unit-tests.sh` logs in via topaz and runs the base
`GsTestCase` suites against the server's logic directly (milliseconds, no network), plus the Grail
suite when `McpGrailToolset` is installed:
- `McpToolTest` — every `tool_*` handler called directly on its owning toolset (grouped by the
  `tools - *` categories). Tests operate on throwaway fixtures rather than on the production classes: a
  plain `McpTestFixture` and a `McpTestSuiteFixture` (a `GsTestCase` subclass with passing/
  failing/erroring tests, for the test-runner tools), both classes in `UserGlobals`, plus a
  `McpTestDict` symbol dictionary of its own. All are cleaned up in `tearDown`.
- `McpDispatcherTest` — JSON-RPC routing/envelope: initialize, tools/list (31, alphabetical),
  success + error wrapping, `-32601`/`-32602`/`-32700`, notifications → nil, the per-worker
  entry `handleJsonString:`, and the declared capabilities — `logging` present, `listChanged` /
  `resources` / `prompts` / `completions` deliberately absent — plus `logging/setLevel` and its
  `-32602` on an unknown level.
- `McpSessionTest` — how a session drives its worker gem: the non-blocking `runWorker:` that
  `forward:` and `prepareWorker` both use, that it reads the result only once the call is over (a
  premature read would answer one request with another's response), that two concurrent requests on
  one session serialize instead of colliding, that a worker error leaves the session usable, and that
  the idle reaper leaves a session with a call in flight alone. Driven through `McpMockWorker` /
  `McpMockSession`, which stand in for the `GsTsExternalSession` with no gem.
- `McpTransportTest` — `handleConnection:` driven over a **`McpMockSocket`** wrapped in a
  real `McpHttpConnection`, so the genuine HTTP parsing/writing runs with no TCP. Covers the
  paths that spawn **no** worker gem: a session-less GET→`400`, DELETE→`400`/`404`, unknown verb→405,
  malformed→`-32700`, a session-less POST→`400`, chunked delivery, EOF, Content-Length. (initialize
  and a routed tool call spawn a real worker, so they're exercised by the integration test instead.)
- `McpOutboxTest` — `McpOutbox` on its own: FIFO, the bound and the drop-oldest policy with its
  admitted gap, the `beginClosing`/`close` handshake, and latest-GET-wins — including that detaching
  a superseded stream must *not* roll the generation back, or the stream that replaced it would look
  stale and end too.
- `McpStreamTest` — the whole server-to-client pathway with no sockets: the session-scoped GET
  (`400`/`404`/stream), the drain onto the stream, a closing outbox getting its last flush, a POSTed
  JSON-RPC response → `202` and its correlation back to the ping that caused it, the probe-then-warn
  sequence over an idle session, that a session with no stream is never probed, that an answered
  ping does **not** move the activity clock, that an unanswered one frees the gem early, and that a
  reaped session is told on its stream first. Uses `McpFixtureRouter`, a real router that reports
  itself running without binding a socket, so the drain loop can be driven at all.
- `McpLifetimeTest` — the *policy* riding on that pathway, which is a separate thing: that the
  intervals are config and survive the fork (including the JSON `null` that means "no deadline"),
  that the warning lead derives from the timeout and an unworkable combination is refused at startup,
  that a probe lost to a stream handover is **discarded rather than condemned** while one lost on the
  current stream still condemns, that an unwarned session at the deadline gets one bounded grace
  period, that an indefinite session lives while it answers and goes when it stops — with a floor for
  the client that opens no stream — that an expiry is absolute, and that a wildly late maintenance
  pass is read as a host suspend and forgiven instead of reaping every live client at once.
- `McpContractTest` — contract / property tests over the tool surface, all driven through the real
  `McpDispatcher>>handle:` envelope: every tool schema is closed (`additionalProperties:false`),
  unknown/missing arguments → an `isError` tool execution error while a missing tool name / unknown
  tool stay `-32602`, `ping` → an empty result, a raised error carries a structured `kind`, kernel-class
  mutation is refused, and read-only hides + refuses the gated tools. Also the toolset invariants: the
  union of the core toolsets' read-only declarations equals the audit list, no toolset vouches for a
  tool it does not provide, `toolNames` matches what `registerOn:` registers, a server built from one
  toolset exposes only its tools, a read-only build drops an all-unsafe toolset whole, and the kernel
  guard survives a dictionary that shadows a kernel name. Socket-less and worker-less, so it runs in
  `run-unit-tests.sh` with the others above.
- `McpExtensionTest` — the extension story through two fixtures: `McpFixtureToolset` (a third-party
  toolset that owns its handler and vouches for its own read-only safety) and `McpFixtureServer` (a
  named worker subclass that names itself). Covers a vendor server exposing **only** its own tools,
  two independent toolsets composed on one server, a third-party tool surviving a read-only build,
  the worker entry answering as the named subclass, and the identity precedence — router config
  relabels a subclass's own default. `McpStubSession` lets it drive
  `McpRouter>>openSessionCreating:` (configure **and** prepare) with no login.
- `McpAuthTest` — the authenticated front end (`McpAuthRouter`): missing / non-bearer / garbage /
  valid tokens, RS-layer `exp` / issuer / audience / scope validation, and the write-scope read-only
  sessions. It commits a throwaway JWT user and spawns real worker gems (needs netldi), so — like
  `test-tls.sh` — it runs via the `run_test_class` tool or the scripts rather than the socket-less
  `run-unit-tests.sh`.
- `McpGrailToolsetTest` *(Grail images only)* — the optional Python toolset: `eval_python`→`42`,
  `compile_python`→`___binOpMul___:`, `print`→`None`, all three Python failure paths (undefined name,
  runtime, syntax) surfacing as `isError` with `kind = "pythonError"`, a 33-tool `tools/list` check on
  core-plus-Grail, auto-detection into the default surface, and the toolset being dropped whole in a
  read-only session. The last two failure paths were switched-off tripwires while Grail crashed the
  gem on them; both run for real as of 2026-08-18.

Run a single suite while a server is up via the `run_test_class` tool (e.g. `run_test_class
McpToolTest`). `./run-unit-tests.sh` runs them all and exits 0 when every test passes: the
socket-less suites `McpToolTest` (52), `McpDispatcherTest` (14), `McpSessionTest` (9),
`McpOutboxTest` (9), `McpStreamTest` (17), `McpLifetimeTest` (36), `McpTransportTest` (22),
`McpContractTest` (34) and `McpExtensionTest` (9), plus `McpAuthTest` (34) and
`McpAuthConformanceTest` (25) — **261 tests**, **270 with the 9 in `McpGrailToolsetTest`** on a
Grail image. The two auth suites are not purely in-image (they commit a throwaway JWT user and spawn
real worker gems, so a netldi must be running); they are in the runner anyway, because they are the
only cover for the token → session path.

Those two also need **spare login slots**, which is the likeliest reason for a failure that is
nothing to do with the code: each spawns worker gems of its own, so a stone whose `StnMaxSessions`
is already consumed by running servers fails them with *"the maximum number of users are already
logged in."* Stop the servers, or raise the limit, before reading such a failure as a regression.

> Note: a test helper must never reuse a SUnit framework selector (`run:`, `setUp`, …) — doing
> so shadows the framework method and silently breaks `suite run`. The transport helper is named
> `runRequest:` for this reason.

**Integration test (real socket)** — `./test.sh` starts the server in its own gem and drives the
full Streamable HTTP transport with `curl`: it `initialize`s, captures the `MCP-Session-Id`, and
sends it on every subsequent request (tools/list of the 31 base tools, every core tool, a
compile_method/commit round-trip, error paths, the SSE GET stream, DELETE), then shuts the server
down. It targets the **base** server — run it against a base install. Uses port `8011` by default
(set `GS_MCP_PORT`). Exit status 0 = all passed.

**TLS test (real HTTPS socket)** — `./test-tls.sh` forks a TLS-enabled server and drives the same
transport over HTTPS with `curl -k`: TLS handshake, the self-signed cert, the SSE GET stream,
`initialize`, a routed tool call, the unknown-session 404, and a check that plaintext HTTP is
refused on the TLS port. It generates a throwaway self-signed `certs/` cert if none exists, and
sets the cert/key **only in the forked gem's session (never committed)**, so the repository's
default stays plaintext — nothing to restore even if interrupted. Uses port `8443` by default
(set `GS_MCP_PORT`). Exit status 0 = all passed.

## Future work

- Exposing class and method source as MCP **resources**, so a client is notified when another gem
  recompiles a method and its cached source goes stale.
- Carrying messages that originate in a **worker** gem — progress during a long tool call, log lines
  from tool internals — which needs a worker→router channel.
- SSE resumability (`Last-Event-ID`).
- Mapping **OAuth scopes to toolsets**, so a token's scopes select what it may *see* rather than only
  whether it may write.
- Reaping a session as soon as its client **closes the event stream**, rather than waiting out
  `streamlessIdleTimeoutSeconds`. A closed socket is evidence the client is gone, so an abandoned
  worker gem need not hold a login slot for 30 minutes.
- A deadline for a forwarded request, now that a non-blocking forward makes one possible.
- The draft `2026-07-28` protocol revision, which first needs a decision about how per-client
  worker-gem isolation survives a protocol with no session id — see
  [Protocol conformance](#protocol-conformance).
