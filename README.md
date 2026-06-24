# Native GemStone MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server written natively in
GemStone Smalltalk. It runs **inside** the image and executes tool calls directly — no
Node.js process, no GCI/FFI bridge. The goal is to replace the GCI-based Jasper MCP
server with one that any MCP client can reach over plain HTTP.

## Transport

A single endpoint: `POST /mcp`. The body is a JSON-RPC 2.0 request; the response is an
`application/json` JSON-RPC reply. This is the simple (non-streaming) subset of the MCP
Streamable HTTP transport — no SSE, no GET, no session id, stateless per request.

```
curl -s localhost:8000/mcp \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

## Tools (v1 core set)

| Tool | Arguments | Result |
|------|-----------|--------|
| `execute_code` | `code` | `printString` of evaluating the Smalltalk source |
| `status` | – | session user, id, stone, uncommitted-changes flag |
| `describe_class` | `className` | superclass, instance vars, selectors |
| `get_method_source` | `className`, `selector`, `meta?` | method source |
| `compile_method` | `className`, `source`, `category?`, `meta?` | compiles and commits |

## Architecture

| Class | Role |
|-------|------|
| `GsMcpServer` | lifecycle + blocking accept loop; registers the core tools |
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

./install.sh                 # file in the 5 classes and commit
GS_MCP_PORT=8000 ./run-server.sh   # start the server gem (blocks)
```

`install.sh` and `run-server.sh` use topaz; set `GEMSTONE`, `GS_STONE`, `GS_USER`,
`GS_PASS` to match your environment.

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

## Status

v1: simple JSON-RPC-over-POST transport, 5 core tools, verified end-to-end with curl
(initialize / tools/list / tools/call / notifications). Future work: full ~31-tool
parity with Jasper, optional per-connection concurrency, optional SSE/streaming, auth.
