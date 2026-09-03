# Session lifetime

How long an MCP session lives — and therefore how long a worker gem, and the uncommitted work
inside it, survives. Split out of the [README](../README.md), whose
[Server-initiated messages](../README.md#server-initiated-messages) section describes the SSE
pathway that everything below rides on.


How long a session lives is deployment policy, not a constant. Each of these is ordinary router
config — settable on the instance, carried into a forked child gem in the fork string, and checked
against the others before a port is bound.

| | default | |
|---|---|---|
| `sessionIdleTimeoutSeconds` | 1800 | how long a client may be quiet. **`nil` = no deadline at all** |
| `streamLossGraceSeconds` | 10 | how long a client that **closed its stream** gets to open another. `0` = release at once; `nil` = no fast release |
| `streamlessIdleTimeoutSeconds` | 60 | the floor for a client that opens **no** stream |
| `livenessProbeIntervalSeconds` | 120 | how often a quiet session is re-asked |
| `reaperIntervalSeconds` | 60 | how often the maintenance pass runs |
| `maxSessionLifetimeSeconds` | `nil` | absolute cap, however busy the session is |
| `reapOnFailedProbe` | `true` | whether an unanswered ping frees a gem early. Forced on with no deadline |
| `requestTimeoutSeconds` | `nil` | how long **one request** may run before it is ended. `nil` = no limit |

**What actually ends a session**, in one place: a **deadline counts calls**; **`none` counts pings**;
a client that **closed its stream** is released after `streamLossGraceSeconds`, whatever the idle
policy says; and a client that opens **no stream at all** gets `streamlessIdleTimeoutSeconds`, because
a ping can only be sent down a stream the client itself opened. So `GS_MCP_IDLE_TIMEOUT=none` does not
mean "no limit" — it means the client's own answers are the limit, and a client that stops answering,
that hangs up, or that never opened a stream, is still released.

**One request is bounded too, and that is a different question.** Everything above decides when a
session is released; `requestTimeoutSeconds` decides how long a single call inside one may run.
A call that outruns it is **ended** — the front end breaks the worker and answers the client a
JSON-RPC error (`-32001`, `data.kind` `timeout`) bearing the request's own id — rather than waited
out. **There is no limit by default.**

It was 45 seconds, chosen against the CLIENT's patience rather than the server's: MCP clients seen so
far give up around a minute, and a server limit above the client's is no limit at all, because the
client abandons the request first and the gem goes on computing an answer nobody is waiting for. What
that number really was, though, is a *guess* at the moment nobody is waiting any more, made by a
server with no way to find out. Two things now tell it instead. A call that carries a `progressToken`
is answered as a stream and pushes its own deadline out as it reports, so a client watching progress
is never told its job took too long. And a client that stops waiting says so — by a
`notifications/cancelled`, or by closing the response stream — which ends the call at the moment it
stops being wanted. A deadline approximates that; a cancel signal knows it.

The cost of the guess also fell in the wrong place: a 45-second limit cut off legitimate slow work —
a full suite run, a large fileIn, a broad search — far more often than a runaway, and that is exactly
the work progress notifications exist to make watchable. The guess was not even conservative in the
direction it was meant to be: measured 2026-08-31, Claude Code ran a **150-second** tool call to
completion, with no progress notifications on it, and took delivery of the answer — so the client
patience the number was fitted to is not what it was taken to be, while the limit itself was real.
Set `GS_MCP_REQUEST_TIMEOUT=45` (or any
number of seconds) where the clients are unknown or cannot be trusted to cancel; what `none` gives up
is the guarantee that a runaway ever ends on its own.

It costs the client that request and, almost always, nothing else. A soft break reaches both shapes
a runaway takes — a Smalltalk loop, and a call blocked in a wait — and leaves the worker gem
immediately usable, so the session, its view and its uncommitted work all survive; the client can
call again at once. What it does *not* promise is that the call did nothing: it was cut partway, and
whatever it had already done is still there in that gem's view, uncommitted. A gem that takes
neither the soft break nor the hard one — code that handles `ControlInterrupt` and resumes — cannot
be ended from the front end at all, so its gem is stopped from the stone side and the session is
finished; that is the one case where the timeout costs the client its session, and the error says
so.

All of which applies equally to a call ended by a **cancellation** — a `notifications/cancelled`
naming a request in flight, which is what Claude Code sends when the user presses Esc. It runs the
same escalation from a different trigger, so it costs the same thing; what differs is only who
decided, and that the client is owed no response for a request it has stopped waiting for. The
notification is intercepted in the front end rather than routed, because routing it would queue it
on the session's worker mutex *behind the very call it asks to stop* — measured at 17 seconds on a
20-second call.

**A client that hangs up is released in seconds, not minutes.** Shutting an editor tab closes the
client process, which closes its SSE socket, and the drain loop sees the EOF within one 100 ms poll —
so the front end knows the client is gone long before any count could say so. It waits
`streamLossGraceSeconds` for the client to open another stream, and if none arrives, frees the worker
gem immediately rather than at the next maintenance pass. Measured end to end against a real router
across four tab closes: **9.7 to 10.2 seconds** from closing the tab to the gem being logged out. It
used to be half an hour, because a departure that had actually been observed was being handled by the
floor written for a client that was never reachable in the first place.

**The grace is insurance, and at least one real client never claims it.** Measured on the same four
closes, Claude Code in VS Code does *not* resume its MCP session across a tab close: what comes back
is a fresh `initialize` on a new session id — a new worker gem appeared within 160 ms of the new
socket every time — and no GET ever arrives bearing the old id. The old session's grace therefore
runs out untouched and it is released on schedule, which is the right answer, reached for the right
reason: no client returned for it. Reconnects were measured at 3.8 s and 4.3 s, well inside a
10-second grace, and made no difference. So for this client the grace buys nothing but a
ten-second delay before a release that was already certain.

It is kept because the case it covers is real in the protocol — MCP lets a client close one stream and
open another on the same session, and a proxy or a network blip can force exactly that — and because
the cost of being wrong in the other direction is a client losing a live gem and its uncommitted work
to a transport hiccup. Set `GS_MCP_STREAM_LOSS_GRACE=0` where every client is known to behave like
this one, and the release becomes immediate. Do not read the default as a claim that reconnection is
what editors do; on the evidence here, it is not.

The grace is the one interval here that is a **wait** rather than a measurement, and that is what
keeps it consistent with the rest: nothing is inferred from how long it lasted. The verdict at the
end is drawn afresh from present state — is a stream open *now* — so a host that suspended mid-wait
reaches the same conclusion as one that did not. Three things retract a departure, and a client needs
only one of them: it opened another stream, it has a call in flight, or it made any request at all
while the grace ran. That last one matters more than it looks: a client is not obliged to hold a
stream, and one that is calling tools is alive on far better evidence than the transport can offer.

**The client is not warned before either deadline, and is not told when one arrives.** It was until
2026-08-27, on its SSE stream, in a `notifications/message`. That warning is gone, and with it
`expiryWarningLeadSeconds`, `GS_MCP_EXPIRY_WARNING_LEAD`, and the `logging` capability that licensed
the carrier: `notifications/message` is the MCP *logging* utility, which the draft revision both
deprecates and — for anything unsolicited — prohibits outright. Measurement, separately, said the
warning was not being read: no client in the captured logs surfaced one to its model.

What a client gets instead is the **404** on its next call, which is what the Streamable HTTP
transport already defines for a session that no longer exists, and which tells it to re-initialize.
The reason a session was reaped is still stated in full — to the **gem log**, where an operator
diagnosing a reap can find it. See
[server-to-client-messaging.md](server-to-client-messaging.md) §2.1 for the retirement, and §2.2 for
what the stream is being kept for: progress on long-running tool calls.

From the shell, `GS_MCP_IDLE_TIMEOUT` and friends set these on either launcher — durations like
`90s`, `30m`, `4h`, or `none`. See [session-lifetime.sh](../session-lifetime.sh), which documents each.

**Almost nothing here is measured in elapsed time.** The knobs are seconds because that is how a
deployment thinks; what the reaper counts is derived from them. Idleness is a count of **liveness
pings the client answered with no work in between** — `sessionIdleTimeoutSeconds ÷
realizedProbeIntervalSeconds` of them, fifteen at the defaults. Unreachability is a count of
**maintenance passes with no stream**. Both advance only when the front end is running, so a host
that suspends simply stops the count where it was: there is no suspend to detect, nothing to forgive,
and no threshold to get wrong.

**Every one of those divisions rounds up, and one of them adds a pass.** A configured timeout is a
floor on what a deployment gets, never a ceiling: 150 seconds against a 60-second pass is three
passes, not two. The extra pass on the streamless count pays for the one it starts on — a session's
first pass lands in whatever fragment of an interval was left when it opened, so *N* passes prove
only *N−1* whole intervals of the server running. Together those two make the guarantee legible:
**a session is released no sooner than its configured timeout, and no later than one maintenance
pass after it.** The idle count is taken against the *realized* ping cadence rather than the
configured one, since a 90-second probe interval on a 60-second pass really fires every 120 seconds,
and counting against the 90 that was asked for would spend a 30-minute deadline in twenty minutes.
`validateTimerConfig` refuses a combination whose counts would round up to something other than what
was written — a probe interval shorter than a pass, or an idle timeout shorter than a probe interval
— before binding a port, and `forkOnPort:` checks too, so the message reaches whoever typed the
command rather than a detached gem's log.

**Sessions with no deadline.** `GS_MCP_IDLE_TIMEOUT=none` is the localhost case: a developer who
comes back hours later resumes rather than re-initializing. The session then lives exactly as long
as its client keeps answering liveness pings on the stream it opened — the client asserting it still
wants that gem and the uncommitted work in it. What keeps it from being a leak is the ring around
it, none of which `none` switches off: a failed probe always reaps, a client that hangs up is
released after `streamLossGraceSeconds`, and a client that opens no stream (so can never be asked)
still falls back to `streamlessIdleTimeoutSeconds`. Worth knowing before choosing it: on GemStone an idle
session is *not* free — each worker is a gem sitting in a transaction, so it pins a repository view
and holds back page reclamation. A forgotten session is extent growth, not merely an idle process.

**On an authenticated router, the token is the real bound.** `McpAuthRouter` caps every session at
its access token's own `exp`, whatever the idle policy says: the worker gem is logged in as that
token's GemStone user, so a session outliving its token would leave the authorization it was opened
with in force after the grant expired. An expiry is never probed around and never forgiven.

That cap is on the *grant*, not on the session: a request bearing a **refreshed** token for the same
user extends the session to the new token's `exp` (`renewSessionExpiry:from:`). Without this a client
working steadily had its worker gem torn down and rebuilt one access-token lifetime after opening,
however recently it had called, because activity feeds the idle clock and the idle clock is not what
ends an authenticated session. Refreshing sooner would not have helped, since
the renewed token was never consulted about lifetime. A read-write session is *not* extended by a
token that has lost the write scope: that token keeps working, but buys no time, and the next session
opens read-only.

**The log says what was in force.** The startup banner records the whole lifetime configuration, and
a reap names the session and the reason the client was given rather than a count — the defaults are
class-side and the rest arrives as JSON in the fork string, so nothing else on disk records what
*this* router was told. Every line is timestamped, since the events worth correlating (a host
suspend, a wake, a client reconnect) are ones the gem neither caused nor can see.

**Host suspend.** Not handled, because it does not need to be. The maintenance pass is what every
count is measured in, and it ticks solely while the front end runs; a suspended host holds no passes,
so no count advances and a session comes back exactly as it went away. One deliberate exception is an
absolute deadline — a lifetime cap or a credential's `exp` — which stays wall-clock and is never
forgiven, because a token does not become valid again just because a laptop slept. The other is
`streamLossGraceSeconds`, and it is exempt for the opposite reason: it measures nothing. A suspend
can only make the wait longer, and the question asked at the end of it — is a stream open now — has
the same right answer either way.

An earlier design did measure elapsed time and tried to *detect* suspends, forgiving a pass that came
back late. It worked to about 96% over a real night, and the missing few percent still released
sessions whose clients had never left — because the error term was set by someone else's power
management rather than by anything this server could reason about. Counting evidence instead of
subtracting time removed the failure and the mechanism together.

[sleep-test.sh](../sleep-test.sh) brackets a real sleep and checks the outcome that now matters: the
session is still there, the gem still works, and the front end logged nothing about the sleep at all.
