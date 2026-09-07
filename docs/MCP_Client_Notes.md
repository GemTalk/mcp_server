# MCP client and protocol notes

What real clients actually do, and where the protocol revisions disagree with each other. Measured
against this server unless stated otherwise. The README's
[Protocol conformance](../README.md#protocol-conformance) section covers what this server implements;
this covers the ground around it, which is where the surprises are.

Every measurement names a client version, because none of this is guaranteed to stay true.

## The era split

The draft revision **`2026-07-28` is a protocol-era change, not an increment.** The spec now calls
`2025-11-25` and earlier **"legacy"** and the new model **"modern"**:

* **No `initialize` handshake.** Every request carries
  `_meta['io.modelcontextprotocol/protocolVersion']` and
  `io.modelcontextprotocol/clientCapabilities`, both required; missing → `-32602` and HTTP 400.
* **Protocol-level sessions are removed.** A modern-only server must ignore `Mcp-Session-Id`, never
  mint or echo one, and answer GET/DELETE on the MCP endpoint with 405. The standalone GET SSE
  stream is gone, replaced by `subscriptions/listen`; `Last-Event-ID` resumption is gone.
* `server/discover` is must-implement, answering `supportedVersions` / `capabilities` /
  `_meta.serverInfo` / `instructions` plus caching hints `ttlMs` and `cacheScope`.
* Every result must carry `resultType`. New reserved error codes: `-32020` HeaderMismatch, `-32021`
  MissingRequiredClientCapability, `-32022` UnsupportedProtocolVersion.
* Mandatory mirrored headers `MCP-Protocol-Version` / `Mcp-Method` / `Mcp-Name`, with server-side
  header↔body validation (including `=?base64?…?=` decode) → `-32020` and 400.
* Unknown method → HTTP **404** with `-32601`. The status is load-bearing for era detection.
* Dual-era on one endpoint is explicitly allowed: modern `_meta` present → modern; `initialize` →
  legacy.

**Why this matters here.** Statelessness is normative in the draft — "state spanning requests MUST be
referenced by an explicit identifier the client passes on each request" — and this server's
per-client worker gems are exactly connection-inferred state keyed on `Mcp-Session-Id`. Isolation
would have to become a client-supplied workspace id, or collapse to per-principal, before the modern
path could be complete. That decision gates the work, which is why the draft sits under Future work
rather than in progress.

Note that the `offline_access` "SHOULD NOT" and the scope-hierarchy MUST are **draft-only**, and so
are not gaps in either supported revision.

## The two revisions say opposite things about a closed stream

Fetched from modelcontextprotocol.io, 2026-08-31, because this is the kind of rule that gets
misremembered as one rule.

**`2025-11-25`** (Streamable HTTP → Sending Messages to the Server) — the revision this server
implements:

> Disconnection **MAY** occur at any time (e.g., due to network conditions). Therefore:
> Disconnection **SHOULD NOT** be interpreted as the client cancelling its request. To cancel, the
> client **SHOULD** explicitly send an MCP `CancelledNotification`.

**Draft `2026-07-28`** (Streamable HTTP → Cancellation) — the exact reverse:

> Closing the SSE response stream **MUST** be treated by the server as cancellation of that request.
> … The server **SHOULD** stop work on the cancelled request as soon as practical and **MUST NOT**
> send any further messages for it.

and the draft makes `notifications/cancelled` **stdio-only**. So under today's revision a
stream-close cancel is a deliberate deviation (gate it behind config, default off); under the draft
it is mandatory.

Two more draft facts from the same page: `X-Accel-Buffering: no` **should** be sent on any SSE
response, and the mirrored `Mcp-Method` / `Mcp-Name` headers are required, with `-32020` on a
mismatch.

## Claude Code (measured on 2.1.251)

**Cancellation is by notification, and it keeps the stream open.** Driving a 90-second
`execute_code` and pressing Esc, with `MCP_TRACE=1`:

* 14 seconds after the call went out:
  `{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":2,"reason":"AbortError: remote-cancel"}}`
  — `requestId` matching the request's own id.
* The stream stayed open. The streamed answer's trace at the call's natural end, 76 seconds after
  the cancel, read `client-gone=false delivered=true`: the client held the stream for the whole
  cancelled call and took delivery of an answer it had abandoned. That is exactly `2025-11-25`
  conformant, and the mirror of that revision telling servers a disconnect should not be read as
  cancellation.

So `notifications/cancelled` is the trigger worth building against; stream-close cancellation is
era-proofing, and against this client it is dead code.

**A cancel POST deadlocks behind the call it cancels, unless the front end intercepts it.** Measured:
a `notifications/cancelled` sent 3 seconds into a 20-second call was answered `202` after
**17 seconds** — it queued on the session's worker mutex in `forward:`. Any server with per-session
workers has to intercept cancellation in the *front end*, before routing, the way a client's
JSON-RPC response already is.

**It is already draft-aware.** It probes `server/discover` at protocol `2026-07-28` first, then falls
back to `initialize` at `2025-11-25`. So the fallback is a deliberate choice of mechanism, not
ignorance of the draft.

**There is no 60-second client timeout, at least not here.** The widely repeated assumption — that
clients give up on a tool call after about 60 seconds, and therefore that a server-side deadline must
sit under that, and that progress notifications are valuable partly because some clients reset the
timer on each one — did not hold. A tool call that ran **150 seconds and emitted no progress
notifications completed normally**; so did a second 150-second call that did emit progress and
returned a 1 MB result. Two consequences: defaulting `requestTimeoutSeconds` to none was right, and
for a stronger reason than the one given at the time (with no client-side deadline, the server's old
45-second default was the *only* thing killing long calls); and a deadline-refresh-on-progress design
has no problem left to solve — do not build one without re-measuring. This measures one client, one
version, one transport, on localhost; a different client, or a proxy in the path, may still impose
one.

**It sends a `progressToken` and then renders nothing.** It sends one on every `tools/call`, and this
server answers with well-formed `notifications/progress` on the request's own stream (verified on the
wire). The client shows **no UI element** and writes **nothing** about it to its own MCP debug log
(`~/Library/Caches/claude-cli-nodejs/<cwd>/mcp-logs-<server>/*.jsonl`). It parses the frames without
error and does nothing observable. Worth remembering before treating "the client asks for X" as "the
client wants X": the token is emitted by the SDK layer, not because the host has somewhere to show
it.

## MCP Inspector

**Inspector does render progress** — the same frames, unchanged, showed the tool stepping. That
settles "are our frames wrong or is the host choosing not to render them": the frames are correct
and consumable, and the blank UI elsewhere is a host choice.

Inspector also advertises considerably more than Claude Code does — `sampling`, `elicitation` (both
`form` and `url`), `roots`, and `tasks` (list, cancel, requests). It is the fuller client, and the
better one to test anything client-facing against.

Two traps when demonstrating progress with `list_failing_tests`, both self-inflicted by this
project's own suites: never include **`McpProgressTest`** (its tests remove `#McpProgress` from
`SessionTemps` and re-point `#McpFrontEndSession` at the worker, destroying the live reporter of the
call running them — measured 0 frames with it, 3 of 4 without), and never include **`McpToolTest`**
(it calls toolset methods directly, so its ticks leak onto the caller's stream with the wrong
totals).
