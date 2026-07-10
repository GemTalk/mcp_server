# Native GemStone MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server written natively in
GemStone Smalltalk. It runs **inside** the image and executes tool calls directly — no
Node.js process, no GCI/FFI bridge. The goal is to replace the GCI-based Jasper MCP
server with one that any MCP client can reach over plain HTTP.

## Transport

A single endpoint, `/mcp`, implementing the MCP **Streamable HTTP** transport (stateless,
no session id):

- **POST `/mcp`** — body is a JSON-RPC 2.0 request; reply is an `application/json` JSON-RPC
  response (notifications get `202 Accepted`, no body).
- **GET `/mcp`** — opens the standalone server→client SSE stream (`text/event-stream`),
  held open with keepalive comments. This server emits no server-initiated messages yet,
  so the stream currently carries only keepalives.
- **DELETE `/mcp`** — session end; returns `200`.
- Any other method → `405`.

```
# tool call over POST
curl -s localhost:8000/mcp \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# observe the SSE stream
curl -N localhost:8000/mcp
```

Works with the **MCP Inspector** / any MCP SDK client using the *Streamable HTTP* transport
pointed at `http://localhost:8000/mcp`.

## Tools (33)

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

**Python (stubs — require the Grail transpiler)**

| Tool | Arguments | Result |
|------|-----------|--------|
| `compile_python` | `code` | stub: reports native Python delegation not yet implemented (or that Grail is absent) |
| `eval_python` | `code` | stub: reports native Python delegation not yet implemented (or that Grail is absent) |

## Architecture

| Class | Role |
|-------|------|
| `GsMcpServer` | lifecycle + blocking accept loop; registers all tools (grouped by category) |
| `GsMcpHttpConnection` | reads one HTTP/1.1 request, writes one JSON response |
| `GsMcpDispatcher` | JSON-RPC 2.0 / MCP routing (`initialize`, `tools/list`, `tools/call`) |
| `GsMcpToolRegistry` | name → `GsMcpTool` map; produces `tools/list` descriptors |
| `GsMcpTool` | one tool: name, description, JSON Schema, handler block |

Built on existing image facilities: `GsSocket` (TCP), `JsonParser parse:` and
`Object>>asJson` (JSON), and `String>>evaluate` (the `execute_code` engine).

## Why a dedicated gem (important)

Forked `GsProcess`es **only run while the gem is actively executing Smalltalk**. A
GCI-driven session (like the Jasper VS Code session) is parked in the C client between
commands, so a background accept loop forked there would be frozen and never serve
requests. Therefore the server runs as the **blocking main activity of a dedicated gem**:
`GsMcpServer runOnPort:` does not return until `stop`. `run-server.sh` launches such a gem.

## Install & run

```bash
export GEMSTONE=/path/to/GemStone64Bit3.7.x   # product dir
export GS_USER=DataCurator GS_PASS=...         # GemStone credentials

./install.sh                 # file in the classes and commit
GS_MCP_PORT=8000 ./run-server.sh   # start the server gem (blocks)
```

`install.sh` and `run-server.sh` use topaz; set `GEMSTONE`, `GS_STONE`, `GS_USER`,
`GS_PASS` to match your environment.

## Test

Two complementary suites:

**Unit tests (in-image, no socket)** — `./run-unit-tests.sh` logs in via topaz and runs three
`GsTestCase` suites against the server's logic directly (milliseconds, no network):
- `GsMcpToolTest` — every `tool_*` handler called directly (grouped by the `tools - *`
  categories). Tests operate on throwaway fixtures rather than on the production classes: a
  plain `GsMcpTestFixture` and a `GsMcpTestSuiteFixture` (a `GsTestCase` subclass with passing/
  failing/erroring tests, for the test-runner tools), both classes in `UserGlobals`, plus a
  `GsMcpTestDict` symbol dictionary of its own. All are cleaned up in `tearDown`.
- `GsMcpDispatcherTest` — JSON-RPC routing/envelope: initialize, tools/list (33, alphabetical),
  success + error wrapping, `-32601`/`-32602`/`-32700`, notifications → nil.
- `GsMcpTransportTest` — `handleConnection:` driven over a **`GsMcpMockSocket`** wrapped in a
  real `GsMcpHttpConnection`, so the genuine HTTP parsing/writing runs with no TCP: POST→JSON,
  GET→SSE, DELETE→200, unknown verb→405, malformed body, chunked delivery, EOF.

Run a single suite while a server is up via the `run_test_class` tool (e.g. `run_test_class
GsMcpToolTest`), or all three via `./run-unit-tests.sh` (exit 0 = all passed). 69 tests total.

> Note: a test helper must never reuse a SUnit framework selector (`run:`, `setUp`, …) — doing
> so shadows the framework method and silently breaks `suite run`. The transport helper is named
> `runRequest:` for this reason.

**Integration test (real socket)** — `./test.sh` starts the server in its own gem and drives the
full Streamable HTTP transport with `curl` (initialize, notification, tools/list, every core
tool, a compile_method/commit round-trip, error paths, the SSE GET stream, DELETE), then shuts
the server down. Uses port `8011` by default (set `GS_MCP_PORT`). Exit status 0 = all passed.

## Adding a tool

There are two steps to adding a tool, both of which happen in the `GsMcpServer` class. First,
write the tool as an instance method whose argument is a dictionary that has been parsed from
JSON. This method must return a `String` that will be sent to the client. Second, modify one of
the tool registration methods so that it adds the tool to the registry with a handler block that
calls its method.

Errors raised inside a handler are caught by the dispatcher and returned as an MCP error result 
(`isError: true`).

## Concurrency & robustness

Each accepted connection is handled in its own forked `GsProcess`, so a slow or stalled
client cannot block the accept loop (the forked handlers run during the loop's accept
waits). `GsMcpHttpConnection>>readRequest` also bails after an 8s read timeout, so a client
that connects but never sends a complete request is dropped rather than wedging the server.
Tool dispatch is serialized with a `Semaphore` (mutex) so the shared session transaction
stays consistent across concurrent handlers.

## Status

Streamable HTTP transport (POST→JSON, GET→SSE stream, DELETE), 33 tools across eight
categories (execution, session, listing, browsing, search, mutation, testing, python),
per-connection forking + read timeout, mutex-serialized dispatch. Verified end-to-end with
curl (initialize / tools/list / tools/call / notifications, the SSE GET stream, DELETE, and
concurrent + stalled-connection load) and by 69 in-image unit tests. Future work:
server-initiated messages pushed over the SSE stream, session ids, auth, and real Python
(Grail) delegation.
