# Native GemStone MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server written natively in
GemStone Smalltalk. It runs **inside** the image and executes tool calls directly — no
Node.js process, no GCI/FFI bridge. The goal is to replace the GCI-based Jasper MCP
server with one that any MCP client can reach over plain HTTP.

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
- **DELETE `/mcp`** — ends the session named by `MCP-Session-Id` (closes its worker); returns `200`.
- Any other method → `405`.

**Security (per the MCP spec):** the server binds only to `127.0.0.1`, session ids are
cryptographically-random 128-bit tokens, and every request's `Origin` header is validated to
prevent DNS-rebinding — a present `Origin` whose host is not loopback (`localhost`/`127.0.0.1`/`[::1]`)
gets **`403`**; an absent `Origin` (non-browser clients like curl) is allowed. Add a browser app's
origin host with `McpRouter allowedOriginHosts: #(...)` (commit to persist). For network-facing use,
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

**Python (optional — only on the `McpServerWithGrail` subclass)**

These live on the optional `McpServerWithGrail` subclass, loaded only via `load-grail.gs` /
`install.sh --grail` into a Grail-equipped image. The base server does not register them.

| Tool | Arguments | Result |
|------|-----------|--------|
| `compile_python` | `code` | transpile Python source to Smalltalk via Grail (`ModuleAst`), return the generated source |
| `eval_python` | `code` | evaluate Python source via Grail (`ModuleAst`), return the `printString` of the result |

> **Requirement:** these tools call Grail's `ModuleAst` directly with no capability check. They
> only work in an image that has GemStone-Python installed **and** where Grail raises an exception
> on a Python *syntax* or *runtime* error rather than crashing the gem (current Grail crashes the
> session on both; a fix is in progress). Valid Python and transpile-time *semantic* errors (e.g.
> an undefined name → `CompileError`) are handled cleanly — the latter surface as a normal
> `isError` result.

## Tool-call safety

- **Closed argument schemas** — every tool's input schema sets `additionalProperties: false` plus
  its `required` list, so an unknown or missing argument is rejected up front with a JSON-RPC
  `-32602` (`error.data.kind = "invalidParams"`) rather than being silently dropped.
- **Kernel-class guard** — the mutation tools refuse to modify a base/kernel class (one whose home
  dictionary is `Globals`); the refusal names the class and a remedy and carries `kind = "refused"`.
  Your own classes (in `UserGlobals`, or an application dictionary) stay freely mutable.
  `execute_code` is the deliberate escape hatch (and is itself gated in read-only mode).
- **Structured error kinds** — when a tool raises, the `isError` result keeps the human-readable
  message in `content` **and** carries `structuredContent.error.kind`, a short machine-readable
  classifier (`compileError`, `refused`, `readOnly`, `notFound`, `invalidParams`, `other`), so a
  client can branch on the kind instead of parsing prose.

## Prompts

The server advertises the MCP `prompts` capability and serves `prompts/list` / `prompts/get` with a
few GemStone-specific workflow guides — static text that references the real tools:

| Prompt | Optional argument | Guides you through |
|--------|-------------------|--------------------|
| `gemstone-transaction-hygiene` | – | `status → refresh → work → commit`/`abort` |
| `gemstone-tdd` | `subject` | locate → write a failing test → implement → re-run → commit |
| `gemstone-safe-change` | `change` | green baseline → impact map → change → re-test → confirm |

A supplied optional argument is woven into the returned guidance.

## Architecture

| Class | Role |
|-------|------|
| `McpBase` | abstract superclass of the router + worker; holds only the two shared helpers (`parseBody:`, `log:`) |
| `McpRouter` | front end: accept loop, HTTP, routing, the `MCP-Session-Id → McpSession` map, and the idle reaper. Owns the socket; never runs a tool |
| `McpAuthRouter` | network-facing `McpRouter` subclass: requires an OAuth/JWT bearer token, logs each worker in as its own GemStone user, serves the `WWW-Authenticate` challenge + RFC 9728 metadata, validates token claims/scopes, adds TLS, and (via `writeScope`) can open a session read-only |
| `McpServer` | per-client worker: the single-client MCP server (JSON-RPC dispatch + the 31 base tool definitions) that runs inside each worker gem. No socket |
| `McpServerWithGrail` | optional worker subclass: `super initialize` then registers the 2 Grail/Python tools; each worker gem loads it (in `handleJsonString:`) when its file is installed |
| `McpSession` | one client's isolated worker handle: a `GsTsExternalSession` gem + session id + last-activity; `forward:` runs a request in it (`McpServer handleJsonString: …`), `close` stops it |
| `McpHttpConnection` | reads one HTTP/1.1 request, writes one JSON response (incl. `MCP-Session-Id`) |
| `McpDispatcher` | JSON-RPC 2.0 / MCP routing (`initialize`, `tools/list`, `tools/call`, `prompts/list`, `prompts/get`); read-only tool gating; structured error kinds |
| `McpToolRegistry` | name → `McpTool` map; produces `tools/list` descriptors |
| `McpTool` | one tool: name, description, JSON Schema, handler block; validates arguments against the schema |
| `McpError` | an error carrying a machine-readable `kind` (e.g. `refused`, `readOnly`) that the dispatcher surfaces in the tool-call error envelope |

Built on existing image facilities: `GsSocket` (TCP), `JsonParser parse:` and
`Object>>asJson` (JSON), and `String>>evaluate` (the `execute_code` engine).

## Why a dedicated gem (important)

Forked `GsProcess`es **only run while the gem is actively executing Smalltalk**. A
GCI-driven session (like the Jasper VS Code session) is parked in the C client between
commands, so a background accept loop forked there would be frozen and never serve
requests. Therefore the server runs as the **blocking main activity of a dedicated gem**.

Two class-side entry points on the front end start that gem:
- **`McpRouter runOnPort: aPort`** — runs the accept loop as the *calling* session's blocking
  activity; never returns until `stop`. Use it to run the server in a foreground topaz.
- **`McpRouter forkOnPort: aPort`** — spawns a *separate* gem via `GsTsExternalSession` and runs
  the loop there **detached** (`forkAndDetachString:`), returning immediately. The forked server
  is **independent** — it keeps serving after the launching session logs out. Stop it with
  `McpRouter stopForked` (from the launching session) or, from anywhere, `System stopSession:
  <id>` / `kill <pid>` (both printed at fork). `run-server.sh` uses this.

The front end is always `McpRouter`; Grail is not a boot-time choice. Each **per-client worker
gem** independently loads the most capable installed worker class (the Grail subclass if its file
was installed, otherwise the base `McpServer`) in its own `handleJsonString:`.

## Per-client sessions

Each MCP client gets its **own worker gem** so clients don't share uncommitted changes or
transaction views. The port-owning gem runs `McpRouter`, a **front end / router**; it never runs
tools itself (those run in the per-client `McpServer` workers):

- **`initialize`** → the front end opens a `McpSession` (a `GsTsExternalSession` worker gem,
  logged in as the current user via a one-time password), assigns a server-side id, and returns it
  in the **`MCP-Session-Id`** response header.
- **Every other request** must carry that header. The front end looks up the worker (map guarded
  by a mutex) and **forwards the raw JSON-RPC body** to it — `worker executeString: 'McpServer
  handleJsonString: ' , body printString` — the worker runs the tool in its own session and
  returns the response, which the front end relays. Missing id → `400`; unknown/expired → `404`
  (a compliant client re-initializes).
- **DELETE** closes the worker; and an **idle reaper** (a background `GsProcess`) closes any
  session idle beyond **5 minutes** (`sessionIdleTimeoutSeconds`), so abandoned test gems don't
  pile up.

Isolation comes from each worker being a separate gem = a separate transaction view. Forwarding is
**blocking / serialized** for now (a single front-end gem can't overlap blocking GCI calls, and the
non-blocking poll path corrupts results); true cross-client concurrency is a deferred follow-up.
The base `McpRouter` logs every worker in as the current (server) user; the network-facing
`McpAuthRouter` instead logs each worker in as the **token's own GemStone user** via JWT.

## Read-only mode

The server can refuse every state-changing tool, so a client can browse and search but not modify
the image. A worker is read-only if **either** of these applies:

- **Globally** — `McpServer readOnly: true` (commit to persist). Every worker gem then refuses the
  dangerous tools. Off by default. (Backed by a class variable, so it also covers the
  `McpServerWithGrail` workers.)
- **Per session, by OAuth scope** — on the authenticated front end, set
  `McpAuthRouter writeScope: 'mcp:write'` (commit). A client whose bearer token carries that scope
  gets a full read-write worker; a client whose token lacks it gets a read-only worker for that
  session only.

**What's gated:** everything that can persist a change or run arbitrary code — `execute_code`,
`commit`, and all the mutation tools. Everything else (browsing, listing, search,
`status`/`refresh`/`abort`, and the test-runner tools) stays available. The allow-list is
**fail-closed** — a newly added tool is gated until it's explicitly listed as read-only-safe
(`McpServer class>>readOnlySafeToolNames`).

A gated tool is **hidden from `tools/list`** and, if called directly by name, returns a JSON-RPC
error (`-32601`) with `error.data.kind = "readOnly"`.

## Install & run

```bash
export GEMSTONE=/path/to/GemStone64Bit3.7.x   # product dir
export GS_USER=DataCurator GS_PASS=...         # GemStone credentials

./install.sh                 # file in the base classes and commit
./install.sh --grail         # ...and the optional Grail/Python tools (Grail image only)
GS_MCP_PORT=8000 ./run-server.sh   # fork a detached, independent server gem and return
```

`install.sh` and `run-server.sh` use topaz; set `GEMSTONE`, `GS_STONE`, `GS_USER`,
`GS_PASS` to match your environment. `install.sh --grail` (or `GS_MCP_WITH_GRAIL=1 ./install.sh`)
loads `load-grail.gs` — the base classes plus `McpServerWithGrail`; plain `install.sh` loads
only the base `load.gs`. `run-server.sh` calls `McpRouter forkOnPort:`, which launches a
detached, independent front-end gem and returns; it prints a `System stopSession: <id>` /
`kill <pid>` line for stopping it later. (Grail, if installed, is picked up per worker gem.)

## Test

Two complementary suites:

**Unit tests (in-image, no socket)** — `./run-unit-tests.sh` logs in via topaz and runs the base
`GsTestCase` suites against the server's logic directly (milliseconds, no network), plus the Grail
suite when `McpServerWithGrail` is installed:
- `McpToolTest` — every `tool_*` handler called directly (grouped by the `tools - *`
  categories). Tests operate on throwaway fixtures rather than on the production classes: a
  plain `McpTestFixture` and a `McpTestSuiteFixture` (a `GsTestCase` subclass with passing/
  failing/erroring tests, for the test-runner tools), both classes in `UserGlobals`, plus a
  `McpTestDict` symbol dictionary of its own. All are cleaned up in `tearDown`.
- `McpDispatcherTest` — JSON-RPC routing/envelope: initialize, tools/list (31, alphabetical),
  success + error wrapping, `-32601`/`-32602`/`-32700`, notifications → nil, and the per-worker
  entry `handleJsonString:`.
- `McpTransportTest` — `handleConnection:` driven over a **`McpMockSocket`** wrapped in a
  real `McpHttpConnection`, so the genuine HTTP parsing/writing runs with no TCP. Covers the
  paths that spawn **no** worker gem: GET→SSE, DELETE→200, unknown verb→405, malformed→`-32700`,
  a session-less POST→`400`, chunked delivery, EOF, Content-Length. (initialize and a routed tool
  call spawn a real worker, so they're exercised by the integration test instead.)
- `McpContractTest` — contract / property tests over the tool surface, all driven through the real
  `McpDispatcher>>handle:` envelope: every tool schema is closed (`additionalProperties:false`),
  unknown/missing arguments → `-32602`, a raised error carries a structured `kind`, kernel-class
  mutation is refused, read-only hides + refuses the gated tools, and `prompts/list` / `prompts/get`
  behave. Socket-less and worker-less, so it runs in `run-unit-tests.sh` with the others above.
- `McpAuthTest` — the authenticated front end (`McpAuthRouter`): missing / non-bearer / garbage /
  valid tokens, RS-layer `exp` / issuer / audience / scope validation, and the write-scope read-only
  sessions. It commits a throwaway JWT user and spawns real worker gems (needs netldi), so — like
  `test-tls.sh` — it runs via the `run_test_class` tool or the scripts rather than the socket-less
  `run-unit-tests.sh`.
- `McpServerWithGrailTest` *(Grail images only)* — the optional Grail/Python tools:
  `eval_python`→`42`, `compile_python`→`__mul__`, `print`→`None`, a semantic error →
  `CompileError`→`isError`, a 33-tool `tools/list` check, and two guarded tripwires
  (`testToolsCallWrapsPython{Syntax,Runtime}ErrorAsIsError`, gated by class-side
  `pythonSyntaxErrorsThrow`/`pythonRuntimeErrorsThrow`) that no-op until Grail stops crashing on
  syntax/runtime errors.

Run a single suite while a server is up via the `run_test_class` tool (e.g. `run_test_class
McpToolTest`). `./run-unit-tests.sh` runs the socket-less suites — `McpToolTest`, `McpDispatcherTest`,
`McpTransportTest`, `McpContractTest` (**98 tests**, **+7 in `McpServerWithGrailTest`** on a Grail
image, two of them guarded tripwires that no-op until Grail is fixed) — and exits 0 when all pass.
`McpAuthTest` (16) needs netldi, so run it with `run_test_class` or the scripts.

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

## Adding a tool

There are two steps to adding a tool, both of which happen in the `McpServer` class. First,
write the tool as an instance method whose argument is a dictionary that has been parsed from
JSON. This method must return a `String` that will be sent to the client. Second, modify one of
the tool registration methods so that it adds the tool to the registry with a handler block that
calls its method.

Errors raised inside a handler are caught by the dispatcher and returned as an MCP error result 
(`isError: true`).

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
reaped after 5 min idle. **31 base tools** across seven categories (execution, session, listing,
browsing, search, mutation, testing) — **plus 2 Python tools** on the optional `McpServerWithGrail`
subclass (loaded via `install.sh --grail`); per-connection forking + read timeout. Verified
end-to-end with curl (initialize / `MCP-Session-Id` routing / tools/call / two-client isolation /
400 / 404 / SSE GET / DELETE, and stalled-connection load) and by the in-image unit tests. Since the
first release it has also gained: OAuth 2.1 / JWT authentication + TLS (the `McpAuthRouter` subclass),
read-only mode (a global switch plus per-token write-scope sessions), closed argument schemas + a
kernel-class guard + structured error kinds, and MCP workflow prompts. The Python tools delegate to
Grail's `ModuleAst` and require a Grail-equipped image (see the Python note above). Future work: true
concurrent cross-client forwarding, server-initiated SSE messages, and an external OIDC identity
provider.
