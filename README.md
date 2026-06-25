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

**Core / execution**

| Tool | Arguments | Result |
|------|-----------|--------|
| `execute_code` | `code` | `printString` of evaluating the Smalltalk source |
| `status` | – | session user, id, stone, uncommitted-changes flag |

**Session / transaction**

| Tool | Arguments | Result |
|------|-----------|--------|
| `abort` | – | abort the transaction, refresh the view |
| `commit` | – | commit the transaction |
| `refresh` | – | refresh the view to see other sessions' commits |

**Listing**

| Tool | Arguments | Result |
|------|-----------|--------|
| `list_dictionaries` | – | symbol dictionaries in lookup order |
| `list_classes` | `dictionaryName` | classes in a dictionary |
| `list_dictionary_entries` | `dictionaryName` | every entry, tagged (class)/(global) |
| `list_all_classes` | – | every class across all dictionaries |
| `add_dictionary` | `dictionaryName` | create + append a dictionary, commit |
| `remove_dictionary` | `dictionaryName` | remove a dictionary, commit *(destructive)* |

**Browsing**

| Tool | Arguments | Result |
|------|-----------|--------|
| `describe_class` | `className` | superclass, instance vars, selectors |
| `get_class_definition` | `className` | class-definition source expression |
| `get_class_hierarchy` | `className` | superclass chain + direct subclasses |
| `list_methods` | `className` | instance + class selectors grouped by category |
| `get_method_source` | `className`, `selector`, `meta?` | method source |
| `set_class_comment` | `className`, `comment` | set the class comment, commit |
| `export_class_source` | `className` | full Topaz file-in (definition + methods) |

**Search**

| Tool | Arguments | Result |
|------|-----------|--------|
| `find_implementors` | `selector` | methods implementing the selector |
| `find_senders` | `selector` | methods sending the selector |
| `find_references_to` | `name` | methods referencing a named global/class |
| `search_method_source` | `pattern`, `dictionaryName?` | methods whose source contains the substring (capped at 200) |

**Mutation**

| Tool | Arguments | Result |
|------|-----------|--------|
| `compile_method` | `className`, `source`, `category?`, `meta?` | compile a method, commit |
| `compile_class_definition` | `source` | evaluate a class definition, commit |
| `delete_class` | `className` | remove a class, commit *(destructive)* |
| `delete_method` | `className`, `selector`, `meta?` | remove a method, commit *(destructive)* |

**Testing (SUnit)**

| Tool | Arguments | Result |
|------|-----------|--------|
| `list_test_classes` | – | all `TestCase` subclasses |
| `run_test_class` | `className` | run a test class, summary + failures |
| `run_test_method` | `className`, `selector` | run one test method |
| `list_failing_tests` | `classNames?` | failing/erroring methods (given classes, or all) |
| `describe_test_failure` | `className`, `selector` | re-run one test, return the failure/error detail |

**Python (stubs — require the Grail transpiler)**

| Tool | Arguments | Result |
|------|-----------|--------|
| `eval_python` | `code` | reports Grail unavailable until it is installed |
| `compile_python` | `code` | reports Grail unavailable until it is installed |

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

`./test.sh` is a self-contained integration test: it starts the server in its own gem
(one session), then acts as an MCP client (a separate process) driving the full
Streamable HTTP transport — initialize, the initialized notification, tools/list, every
core tool, a compile_method/commit round-trip on a throwaway class, the error paths, the
SSE GET stream, and DELETE — asserting each result, and shuts the server down on exit.
Uses port `8011` by default (set `GS_MCP_PORT` to change). Exit status 0 = all passed.

## Adding a tool

One line in `GsMcpServer>>registerCoreTools`:

```smalltalk
registry
  name: 'find_senders'
  description: 'Find methods that send a selector.'
  inputSchema: (self objectSchema:
      (Dictionary new at: 'selector' put: (self propString: 'Selector'); yourself)
      required: (Array with: 'selector'))
  do: [:args | ... return a String ...].
```

Handler blocks must return a `String` and must not use `^` (non-local return). Errors
raised inside a handler are caught by the dispatcher and returned as an MCP error result
(`isError: true`).

## Concurrency & robustness

Each accepted connection is handled in its own forked `GsProcess`, so a slow or stalled
client cannot block the accept loop (the forked handlers run during the loop's accept
waits). `GsMcpHttpConnection>>readRequest` also bails after an 8s read timeout, so a client
that connects but never sends a complete request is dropped rather than wedging the server.
Tool dispatch is serialized with a `Semaphore` (mutex) so the shared session transaction
stays consistent across concurrent handlers.

## Status

v1: Streamable HTTP transport (POST→JSON, GET→SSE stream, DELETE), 5 core tools,
per-connection forking + read timeout. Verified end-to-end with curl: initialize /
tools/list / tools/call / notifications, the SSE GET stream, DELETE, and concurrent +
stalled-connection load. Future work: full ~31-tool parity with Jasper, server-initiated
messages pushed over the SSE stream, session ids, auth.
