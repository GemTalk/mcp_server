# Native GemStone MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server written natively in
GemStone Smalltalk. It runs **inside** the image and executes tool calls directly — no
Node.js process, no GCI/FFI bridge. The goal is to replace the GCI-based Jasper MCP
server with one that any MCP client can reach over plain HTTP.

Development is in two branches. The `main` branch includes the standard server (localhost-only, single-user,
multi-client) with scripts to install and run it on a 3.7.5 stone. The `auth` branch adds a network-facing,
secure-transport, multi-user server with JWT authentication from an external OIDC IdP (requires 3.7.6).

## Transport

A single endpoint, `/mcp`, implementing the MCP **Streamable HTTP** transport with **per-client
sessions** — each client gets its own isolated worker gem (see [Per-client sessions](#per-client-sessions)):

- **POST `/mcp`** — body is a JSON-RPC 2.0 request; reply is an `application/json` JSON-RPC
  response (notifications get `202 Accepted`, no body).
  - `initialize` opens a session and returns its id in the **`MCP-Session-Id`** response header.
  - Every other request must send that header back; a missing id → **`400`**, an unknown/expired
    id → **`404`** (a compliant client then re-initializes).
- **GET `/mcp`** — opens the standalone server→client SSE stream (`text/event-stream`),
  held open with keepalive comments. No server-initiated messages yet, so it carries only keepalives.
- **DELETE `/mcp`** — ends the session named by `MCP-Session-Id` (closes its worker). Answers the
  same codes as the POST path: missing header → **`400`**, unknown/already-ended id → **`404`**,
  live session → **`200`**.
- Any other method → `405`.

`ping` is answered with an empty result on every session, as the spec requires.

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

Not implemented, all optional at these revisions: pagination (`tools/list` returns every tool and
no `nextCursor`), `listChanged` notifications, SSE resumability (`Last-Event-ID`), tool `title` /
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

## Architecture

| Class | Role |
|-------|------|
| `McpBase` | abstract superclass of the router + worker; holds only the two shared helpers (`parseBody:`, `log:`) |
| `McpRouter` | front end: accept loop, HTTP, routing, the `MCP-Session-Id → McpSession` map, and the idle reaper. Owns the socket; never runs a tool |
| `McpAuthRouter` | network-facing `McpRouter` subclass: requires an OAuth/JWT bearer token, logs each worker in as its own GemStone user, serves the `WWW-Authenticate` challenge + RFC 9728 metadata, validates token claims/scopes, adds TLS, and (via `writeScope`) can open a session read-only |
| `McpServer` | per-client worker: the single-client MCP server that runs inside each worker gem — registry, dispatcher, the kernel guards, read-only gating, identity. The tools themselves belong to its toolsets, and which of those it registers is not fixed by the class. No socket |
| `McpToolset` | abstract tool pack: `registerOn:` (its tools + schemas), its `tool_*` handlers, `toolNames`, `readOnlySafeToolNames` (empty by default — fail closed), plus the shared schema builders, image-lookup helpers, and the kernel guards (which forward to the server's policy). **Subclass this to add tools**; a deployment picks the list |
| `McpBrowsingToolset`, `McpExecutionToolset`, `McpListingToolset`, `McpMutationToolset`, `McpSearchToolset`, `McpSessionToolset`, `McpTestingToolset` | the seven core toolsets, one per tool family. A deployment can expose any subset — or none of them, alongside its own |
| `McpGrailToolset` | optional Python toolset (`eval_python`, `compile_python`), filed in only on a Grail image. Needs nothing from the server, so it doubles as the worked example for a third-party toolset |
| `McpSession` | one client's isolated worker handle: a `GsTsExternalSession` gem + session id + last-activity + the worker class/toolsets/identity the front end resolved. `prepareWorker` sets the gem up in one call; `forward:` runs a request in it (`<workerClass> handleJsonString: …`); `close` stops it |
| `McpHttpConnection` | reads one HTTP/1.1 request, writes one JSON response (incl. `MCP-Session-Id`) |
| `McpDispatcher` | JSON-RPC 2.0 / MCP routing (`initialize`, `tools/list`, `tools/call`); read-only tool gating; structured error kinds |
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
  `prepareWorkerWithToolsets:readOnly:serverName:version:` call — which sets read-only, resolves the
  named toolsets, applies the advertised identity, and pre-builds the server so the client's first
  request has no registration to do — assigns a server-side id, and returns it in the
  **`MCP-Session-Id`** response header. A worker class or toolset the worker gem cannot resolve fails
  here, at session open, where the error can say what to fix.
- **Every other request** must carry that header. The front end looks up the worker (map guarded
  by a mutex) and **forwards the raw JSON-RPC body** to it — `worker executeString: '<workerClass>
  handleJsonString: ' , body printString`, naming the class the router resolved — the worker runs
  the tool in its own session and returns the response, which the front end relays. Missing id →
  `400`; unknown/expired → `404` (a compliant client re-initializes).
- **DELETE** closes the worker; and an **idle reaper** (a background `GsProcess`) closes any
  session idle beyond **30 minutes** (`sessionIdleTimeoutSeconds`), so abandoned test gems don't
  pile up.

Isolation comes from each worker being a separate gem = a separate transaction view. Forwarding is
**blocking / serialized** for now (a single front-end gem can't overlap blocking GCI calls, and the
non-blocking poll path corrupts results); true cross-client concurrency is a deferred follow-up.
The base `McpRouter` logs every worker in as the current (server) user; the network-facing
`McpAuthRouter` instead logs each worker in as the **token's own GemStone user** via JWT.

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

## Install & run

```bash
export GEMSTONE=/path/to/GemStone64Bit3.7.x   # product dir
export GS_USER=DataCurator GS_PASS=...         # GemStone credentials

./install.sh                        # file in the classes (core + tests + auth) and commit
./install.sh --grail                # ...and the optional Grail/Python toolset (Grail image only)
GS_MCP_PORT=8000 ./run-server.sh    # fork a detached, independent localhost server gem and return
GS_MCP_READONLY=1 ./run-server.sh   # ...read-only (browse/search only; no accidental mutation)
GS_MCP_TOOLSETS="McpBrowsingToolset McpSearchToolset" ./run-server.sh   # ...only these tools
GS_MCP_WORKER_CLASS=MyMcpServer ./run-server.sh                        # ...a subclass as the worker
./run-auth-server.sh                # ...the OAuth/OIDC network-facing server (McpAuthRouter)
```

`install.sh` and the `run-*.sh` scripts use topaz; set `GEMSTONE`, `GS_STONE`, `GS_USER`,
`GS_PASS` to match your environment. `install.sh` files the code in with topaz from `load.gs` —
which on this branch includes `src/auth/`, since the OAuth front end is the point of it; `--grail`
(or `GS_MCP_WITH_GRAIL=1`) files in `load-grail.gs` instead, which adds the `src/grail/` group on
top. `run-server.sh` builds a base `McpRouter` instance and calls
its `forkOnPort:` (`run-auth-server.sh` builds an OIDC-configured `McpAuthRouter` — resource-server
config as code, no commit), which launches a detached, independent front-end gem and returns; stop it
with `./stop-server.sh` (by port), or the `System stopSession: <id>` / `kill <pid>` line it prints.
A loaded Grail toolset is picked up automatically, per session, by the front end.

### Source layout

The classes live on disk as plain **topaz file-outs** — canonical `Class>>fileOutClass` output,
grouped by area, with one loader per group:

```
src/core/    17 classes  the server itself: protocol, transport, dispatch, toolsets
src/tests/    9 classes  the SUnit suites and their fixtures
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
  success + error wrapping, `-32601`/`-32602`/`-32700`, notifications → nil, and the per-worker
  entry `handleJsonString:`.
- `McpTransportTest` — `handleConnection:` driven over a **`McpMockSocket`** wrapped in a
  real `McpHttpConnection`, so the genuine HTTP parsing/writing runs with no TCP. Covers the
  paths that spawn **no** worker gem: GET→SSE, DELETE→`400`/`404`, unknown verb→405, malformed→`-32700`,
  a session-less POST→`400`, chunked delivery, EOF, Content-Length. (initialize and a routed tool
  call spawn a real worker, so they're exercised by the integration test instead.)
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
McpToolTest`). `./run-unit-tests.sh` runs the socket-less suites — `McpToolTest`, `McpDispatcherTest`,
`McpTransportTest`, `McpContractTest`, `McpExtensionTest` (**124 tests**, **133 with the 9 in
`McpGrailToolsetTest`** on a Grail image) — and exits 0 when all pass. `McpAuthTest` (24) and
`McpAuthConformanceTest` (25) live on the `auth` branch and need netldi, so run them there with
`run_test_class` or the scripts — 173 tests in total on that branch.

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
  serverName: 'acme-db-mcp'; serverVersion: '2.5.0')
    forkOnPort: 8000
```

Toolsets **compose** — `#('AcmeDbToolset' 'McpBrowsingToolset')` gives your tools plus class
browsing, and two unrelated vendors' toolsets can be combined. This is the reason tools live in
toolsets rather than in `McpServer` subclasses: single inheritance could never express it.

**To change behavior, subclass `McpServer`** — the kernel guards, the worker entry, dispatcher
wiring, or the advertised identity. Name your subclass in `workerClassName` (nothing auto-detects
it):

```smalltalk
(McpRouter new workerClassName: 'AcmeDbServer'; toolsetNames: #('AcmeDbToolset')) forkOnPort: 8000
```

To name your server, override the **class-side** `defaultServerName` / `defaultServerVersion`. That
keeps the name a default a deployment can still relabel through router config — an operator running
two instances of your product needs that. Overriding the instance-side `serverName` instead wins over
config, which is a deliberate lock rather than the normal path.

> **Where your classes must live:** a worker gem may log in as a *different user* than the front end
> (under `McpAuthRouter`, as the token's own GemStone user), so your toolsets and any worker subclass
> must be in a symbol dictionary in the **worker's** symbol list — `Published`, not the operator's
> `UserGlobals`.

## Concurrency & robustness

Each accepted connection is handled in its own forked `GsProcess`, so a slow or stalled
client cannot block the accept loop (the forked handlers run during the loop's accept
waits). `McpHttpConnection>>readRequest` also bails after an 8s read timeout, so a client
that connects but never sends a complete request is dropped rather than wedging the server.
Each client's requests run in its own worker gem (a separate session), so there's no shared
transaction to protect; a `Semaphore` (mutex) guards only the `MCP-Session-Id → session` map.
Forwarding to a worker is a blocking call, so forwarding across clients is serialized for now —
true concurrent cross-client execution is deferred.

## Status

Streamable HTTP transport (POST→JSON, GET→SSE stream, DELETE) with **per-client sessions** — each
client gets its own isolated worker gem, routed by `MCP-Session-Id` (missing→400, unknown→404),
reaped after 30 min idle. **31 base tools** in seven composable toolsets (execution, session, listing,
browsing, search, mutation, testing) — **plus 2 Python tools** in the optional `McpGrailToolset`
(filed in by `install.sh --grail`); per-connection forking + read timeout. Verified
end-to-end with curl (initialize / `MCP-Session-Id` routing / tools/call / two-client isolation /
400 / 404 / SSE GET / DELETE, and stalled-connection load) and by the in-image unit tests. Since the
first release it has also gained: OAuth 2.1 / JWT authentication + TLS (the `McpAuthRouter` subclass),
per-router read-only mode (a router toggle plus per-token write-scope sessions), closed argument
schemas + a kernel-class guard + structured error kinds, and a **selectable tool surface**: tools live
in `McpToolset`s, the front end resolves the worker class and toolset list per session and pushes them
into the worker gem, and a server can announce its own name/version — so a third party can ship an MCP
server for their own software, exposing only their tools. The Python tools delegate to Grail's
`ModuleAst` and require a Grail-equipped image (see the Python note above).

Future work: true concurrent cross-client forwarding; server-initiated SSE messages (which would let
`notifications/tools/list_changed` announce a surface change); an external OIDC identity provider;
mapping **OAuth scopes to toolsets**, so a token's scopes select what it may see rather than only
whether it may write; and an optional `serverInfo.title` for a per-deployment label distinct from the
product name.
