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
| `expiryWarningLeadSeconds` | 300 | how long before an *absolute* deadline a client is warned |
| `maxSessionLifetimeSeconds` | `nil` | absolute cap, however busy the session is |
| `reapOnFailedProbe` | `true` | whether an unanswered ping frees a gem early. Forced on with no deadline |

**What actually ends a session**, in one place: a **deadline counts calls**; **`none` counts pings**;
a client that **closed its stream** is released after `streamLossGraceSeconds`, whatever the idle
policy says; and a client that opens **no stream at all** gets `streamlessIdleTimeoutSeconds`, because
a ping can only be sent down a stream the client itself opened. So `GS_MCP_IDLE_TIMEOUT=none` does not
mean "no limit" — it means the client's own answers are the limit, and a client that stops answering,
that hangs up, or that never opened a stream, is still released.

**A client that hangs up is released in seconds, not minutes.** Shutting an editor tab closes the
client process, which closes its SSE socket, and the drain loop sees the EOF within one 100 ms poll —
so the front end knows the client is gone long before any count could say so. It waits
`streamLossGraceSeconds` for the client to open another stream, and if none arrives, frees the worker
gem immediately rather than at the next maintenance pass. Measured end to end against a real router:
**10 seconds** from closing the tab to the gem being logged out. It used to be half an hour, because
a departure that had actually been observed was being handled by the floor written for a client that
was never reachable in the first place.

The grace is the one interval here that is a **wait** rather than a measurement, and that is what
keeps it consistent with the rest: nothing is inferred from how long it lasted. The verdict at the
end is drawn afresh from present state — is a stream open *now* — so a host that suspended mid-wait
reaches the same conclusion as one that did not. Three things retract a departure, and a client needs
only one of them: it opened another stream, it has a call in flight, or it made any request at all
while the grace ran. That last one matters more than it looks: a client is not obliged to hold a
stream, and one that is calling tools is alive on far better evidence than the transport can offer.

Before either deadline the client is warned on its stream, once, with advice that fits which deadline
is approaching: an idle timeout says to make any call (`status` is enough), while an absolute one —
`maxSessionLifetimeSeconds`, or an access token's `exp` — says whether it can be extended at all. A
refreshed deadline earns a fresh warning.

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
