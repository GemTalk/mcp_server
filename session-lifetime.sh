# Router configuration shared by run-server.sh and run-auth-server.sh: SESSION LIFETIME (including
# the cap on how many sessions there may be AT ONCE), and the VIEW HYGIENE knobs at the foot of this
# file. Two subjects, one file, because they share the duration vocabulary and both launchers need
# both -- and because a knob documented in only one of two near-identical launchers is a knob nobody
# finds.
#
# Sourced, not executed. Reads the MCP_* variables below and leaves Smalltalk setter sends for
# them in $LIFETIME_LINES and $VIEW_HYGIENE_LINES, ready to drop into either launcher's topaz
# heredoc. Every one is optional: an unset variable emits no line at all, so the router keeps the
# default it seeds in McpRouter>>initialize. That distinction matters for the idle timeout, where
# "unset" (30 minutes) and "none" (no deadline) are different instructions.
#
# Durations accept a unit suffix -- 90s, 30m, 4h -- or a bare number of seconds.
#
#   MCP_MAX_SESSIONS        How many client sessions this server will hold AT ONCE. Default 3;
#                           `none` removes the cap. The only knob here that is a count of sessions
#                           rather than a span of time, and the only one that makes a failure
#                           impossible rather than short-lived. Past the cap an initialize is
#                           refused, with a JSON-RPC error saying so, instead of being answered with
#                           a login attempt that may fail.
#                           Why so low by default: a session IS a GemStone login, a repository has a
#                           finite number of them (ten, on a Community Edition database), and the
#                           login that exceeds that fails for EVERY gem on the stone -- topaz
#                           included -- not just for the client that asked. Nor does it take a
#                           careless client to get there: reconnecting opens a NEW session, so
#                           reloading an editor window or restarting an agent leaves the old worker
#                           gem behind until the idle rules catch up, and a few of those inside one
#                           idle period is nobody being reckless. Raise it once you know what your
#                           stone allows (`SessionsCurrent` against `StnMaxSessions`), and remember
#                           that the unit suite and any other server on the same stone are spending
#                           from the same budget.
#   MCP_IDLE_TIMEOUT        How long a client may be quiet before its worker gem is released.
#                           Default 30m. `none` removes the deadline entirely: the session then
#                           lives as long as its client keeps answering liveness pings on the SSE
#                           stream it opened, which is what a developer who comes back to a
#                           localhost server hours later wants, and what a shared or authenticated
#                           deployment usually does not. Before choosing it, know the cost: each
#                           session is a gem sitting in a transaction, so it pins a repository view
#                           and holds back page reclamation -- a forgotten session is extent growth.
#                           An authenticated router caps every session at its access token's exp
#                           regardless, so `none` there means "until the token expires".
#   MCP_REQUEST_TIMEOUT     How long ONE request may run in a worker gem before the server ends it
#                           and answers the client an error. Unset = NO LIMIT. It used to default to
#                           45s, chosen to sit under what an MCP client will wait -- but that number
#                           was a guess at when nobody is waiting any more, and two things now tell
#                           the server instead: a progressToken-carrying call pushes its own deadline
#                           out as it reports, and a client that stops waiting says so, by a
#                           notifications/cancelled or by closing the response stream. A deadline
#                           approximates that; a cancel signal knows it. The guess also cut off
#                           legitimate slow work -- a large fileIn, a broad search, a test suite --
#                           far more often than a runaway -- and it was not even fitted to real
#                           client patience: measured 2026-08-31, Claude Code ran a 150-second call
#                           to completion and took the answer. Set a number of seconds where the
#                           clients are unknown or cannot be trusted to cancel; what no limit gives up is the
#                           guarantee that a runaway ever ends on its own. Ending a request costs the
#                           client that request only: the worker is interrupted and stays usable, so
#                           the session and its uncommitted work survive.
#   MCP_MAX_LIFETIME        Absolute cap on any session's life, however busy it is. Unset = none.
#                           Never forgiven, unlike idleness -- including across a host suspend.
#   MCP_PROBE_INTERVAL      How often a quiet session is asked whether its client is still there.
#                           Default 2m. This is also the unit idleness is MEASURED in: a session is
#                           released once it has answered MCP_IDLE_TIMEOUT worth of these pings
#                           with no work in between (fifteen of them, at the defaults) -- and a
#                           client that holds its stream open but stops answering is released after
#                           three, so this interval sets that deadline too.
#   MCP_STREAM_LOSS_GRACE
#                           How long a session survives its client CLOSING the event stream, before
#                           the worker gem is released. Default 10s. This is the path a shut editor
#                           tab takes, and the grace exists only to cover a client that closes one
#                           stream and opens another ON THE SAME SESSION. Measured, a reopened VS
#                           Code tab does NOT do that -- it initializes a new session -- so for that
#                           client the grace is pure delay and 0 is the honest setting. It is kept
#                           as insurance for the clients and proxies that do reattach, where the
#                           cost of guessing wrong is a live gem and its uncommitted work.
#                           `0` and `none` are OPPOSITES here: 0 releases the gem the moment the
#                           socket closes, with no pause for a reconnect, while `none` turns the
#                           fast release off altogether and leaves such a client to
#                           MCP_STREAMLESS_TIMEOUT, as it was before.
#   MCP_STREAMLESS_TIMEOUT
#                           The floor for a client that never opened an SSE stream AT ALL.
#                           Default 60s. Such a client can never be pinged, so there is no evidence
#                           to count and this is the only thing that can free its gem. It bounds the
#                           gap between such a client's requests, not the life of its session, so
#                           raise it where streamless clients POST in sequence rather than once.
#   MCP_REAPER_INTERVAL     How often the maintenance pass runs. Default 60s. The pass is the
#                           server's clock -- it ticks only while the front end is running -- so
#                           every count below is measured in passes, not in elapsed time.
#   MCP_REAP_ON_FAILED_PROBE
#                           0 to stop treating an unanswered liveness ping as grounds for releasing
#                           a gem early. Default 1. Ignored (forced on) with no idle deadline, where
#                           it is the only thing that would ever end a session.
#
# The router validates these against each other at startup (McpRouter>>validateTimerConfig) and
# refuses to bind a port on a combination that cannot work, so a bad number fails loudly here rather
# than by never warning anyone six months from now.

# Seconds from a duration string. Prints the number and answers 0, or complains and answers 1 --
# it must not `exit`, because every caller runs it inside a command substitution, where an exit would
# end only the substitution's own subshell and let the launcher carry on with an empty value.
mcp_duration_seconds() {
  local raw="$1" name="$2" num unit
  num="${raw%[smhSMH]}"
  unit="${raw#$num}"
  case "$num" in
    ''|*[!0-9]*)
      echo "ERROR: $name must be a duration like 90s, 30m, 4h or a bare number of seconds (got '$raw')." >&2
      return 1 ;;
  esac
  case "$(printf '%s' "$unit" | tr 'SMH' 'smh')" in
    ''|s) echo "$num" ;;
    m)    echo "$((num * 60))" ;;
    h)    echo "$((num * 3600))" ;;
  esac
}

# Append "r <selector>: <value>." for a duration variable, or nothing when it is unset.
mcp_lifetime_line() {
  local value="$1" selector="$2" name="$3" secs
  [ -z "$value" ] && return 0
  secs=$(mcp_duration_seconds "$value" "$name") || exit 1
  LIFETIME_LINES="$LIFETIME_LINES
r $selector: $secs."
}

LIFETIME_LINES=""

# A count of sessions, not a duration: no unit suffix, and `none` is an instruction (never refuse an
# initialize) that has to reach the router as an explicit nil rather than as an absence. 0 is refused
# rather than folded in with `none`, as it is for MCP_MAX_COMMITS_BEHIND and for the same reason:
# taken literally it is a server that refuses every client, and it reads like the opposite.
case "$(printf '%s' "${MCP_MAX_SESSIONS:-}" | tr 'A-Z' 'a-z')" in
  '')          ;;
  none|off)    LIFETIME_LINES="$LIFETIME_LINES
r maxSessions: nil." ;;
  0)           echo "ERROR: MCP_MAX_SESSIONS must be at least 1, or 'none' for no cap (got '0')." >&2
               exit 1 ;;
  *[!0-9]*)    echo "ERROR: MCP_MAX_SESSIONS must be a whole number of sessions, or 'none' (got '$MCP_MAX_SESSIONS')." >&2
               exit 1 ;;
  *)           LIFETIME_LINES="$LIFETIME_LINES
r maxSessions: $MCP_MAX_SESSIONS." ;;
esac

# `none` is an instruction, not an absence: it has to reach the router as an explicit nil.
case "$(printf '%s' "${MCP_IDLE_TIMEOUT:-}" | tr 'A-Z' 'a-z')" in
  '')          ;;
  none|off|0)  LIFETIME_LINES="$LIFETIME_LINES
r sessionIdleTimeoutSeconds: nil." ;;
  *)           mcp_lifetime_line "$MCP_IDLE_TIMEOUT" sessionIdleTimeoutSeconds MCP_IDLE_TIMEOUT ;;
esac

case "$(printf '%s' "${MCP_REQUEST_TIMEOUT:-}" | tr 'A-Z' 'a-z')" in
  '')          ;;
  none|off|0)  LIFETIME_LINES="$LIFETIME_LINES
r requestTimeoutSeconds: nil." ;;
  *)           mcp_lifetime_line "$MCP_REQUEST_TIMEOUT" requestTimeoutSeconds MCP_REQUEST_TIMEOUT ;;
esac

# `0` is NOT folded in with `none` here, unlike every other knob in this file: for this one they are
# opposites (see the note above), and folding them made 0 mean the exact thing it documents itself as
# ruling out -- leave the gem to the streamless floor -- rather than releasing it at once.
case "$(printf '%s' "${MCP_STREAM_LOSS_GRACE:-}" | tr 'A-Z' 'a-z')" in
  '')          ;;
  none|off)    LIFETIME_LINES="$LIFETIME_LINES
r streamLossGraceSeconds: nil." ;;
  *)           mcp_lifetime_line "$MCP_STREAM_LOSS_GRACE" streamLossGraceSeconds MCP_STREAM_LOSS_GRACE ;;
esac

mcp_lifetime_line "${MCP_MAX_LIFETIME:-}"        maxSessionLifetimeSeconds     MCP_MAX_LIFETIME
mcp_lifetime_line "${MCP_PROBE_INTERVAL:-}"      livenessProbeIntervalSeconds  MCP_PROBE_INTERVAL
mcp_lifetime_line "${MCP_STREAMLESS_TIMEOUT:-}"  streamlessIdleTimeoutSeconds  MCP_STREAMLESS_TIMEOUT
mcp_lifetime_line "${MCP_REAPER_INTERVAL:-}"     reaperIntervalSeconds         MCP_REAPER_INTERVAL

if [ "${MCP_REAP_ON_FAILED_PROBE:-1}" = "0" ]; then
  LIFETIME_LINES="$LIFETIME_LINES
r reapOnFailedProbe: false."
fi

# ---------------------------------------------------------------------------------------------
# VIEW HYGIENE -> $VIEW_HYGIENE_LINES
#
# Not about the client at all, unlike everything above: these govern what the server does about the
# REPOSITORY's commit records. A GemStone session's view pins the commit record it was taken from, so
# a gem that sits at an old view holds every record behind it and the stone cannot dispose of any of
# them. Nothing in the session-lifetime family can see that -- a session can be perfectly well
# behaved, answering every ping, and still be the reason the extent is growing.
#
#   MCP_FRONT_END_TX_MODE   GemStone transaction mode for the forked FRONT-END gem:
#                           transactionless (default) or autoBegin. The front end makes no
#                           repository changes, so transactionless costs it nothing and saves the
#                           stone a commit record it could otherwise never dispose of -- measured, a
#                           front end left in transaction held the OLDEST commit record in the
#                           repository, its last transaction boundary being its own login 15 hours
#                           earlier. autoBegin restores that older behaviour, and is worth asking for
#                           only if front-end code of your own needs a stable view (see the McpRouter
#                           class comment). Workers are unaffected: each client's gem holds a
#                           transaction because that is what the session IS.
#   MCP_MAX_COMMITS_BEHIND
#                           How far behind the repository a worker gem's view may fall, in COMMITS,
#                           before the server refreshes it (default 20 -- the same number the stone
#                           uses for STN_SIGNAL_ABORT_CR_BACKLOG; the effective limit is the lower of
#                           the two). `none` turns it off and leaves every worker's view alone.
#                           Counted in commits rather than seconds because that is what the stone
#                           charges for: what hurts is the number of records piled up behind a view,
#                           not how old it is, so an idle session on a quiet stone costs nothing and
#                           is left alone however long it sits. The refresh KEEPS the session's
#                           uncommitted work, and the client is told on its next result.
#   MCP_STUCK_VIEW_GRACE    How long a session whose view CANNOT be moved is tolerated, while the
#                           stone is over its own backlog threshold, before its gem is released.
#                           Default 60s. A view is stuck when GemStone refuses to move it at all --
#                           after a commit that failed on conflict, or inside a nested transaction --
#                           so nothing this server sends will free the record that session is
#                           holding, and the work it holds is already un-committable. `none` never
#                           reaps on this ground; `0` reaps on the pass that finds it. Floored at one
#                           MCP_REAPER_INTERVAL: a positive value shorter than a pass refuses to
#                           start rather than being silently rounded up.
#   MCP_PINNED_VIEW_GRACE
#                           How long a RUNNING call may hold the repository's oldest commit record
#                           open, while the repository is over its own backlog threshold, before the
#                           server ends that call. Default 300s; `none` never ends one. This is the
#                           ONLY rule here that ends work a client is waiting on, and it is not a
#                           request deadline in disguise: a long call on a quiet repository is never
#                           ended, however long it runs. It exists because a call in flight cannot be
#                           asked to refresh its view -- one GCI call per session -- so while it runs
#                           nothing else can free the record it is holding. `none` is a legitimate
#                           choice; its cost is that one long call can pin the backlog for as long as
#                           it lasts. Ending a call costs the client that call only: its gem and its
#                           uncommitted work survive.

VIEW_HYGIENE_LINES=""

mcp_hygiene_line() {
  VIEW_HYGIENE_LINES="$VIEW_HYGIENE_LINES
r $1: $2."
}

# Checked here as well as in the setter (which raises), because a launcher that fails in the shell
# says so in one line instead of from inside a topaz stack.
case "${MCP_FRONT_END_TX_MODE:-transactionless}" in
  transactionless|autoBegin)
      mcp_hygiene_line frontEndTransactionMode "'${MCP_FRONT_END_TX_MODE:-transactionless}'" ;;
  *)  echo "ERROR: MCP_FRONT_END_TX_MODE must be transactionless or autoBegin (got '$MCP_FRONT_END_TX_MODE')." >&2
      exit 1 ;;
esac

# A count, not a duration: no unit suffix, and `none` is an instruction (leave every worker's view
# alone) that has to reach the router as an explicit nil rather than as an absence.
case "$(printf '%s' "${MCP_MAX_COMMITS_BEHIND:-}" | tr 'A-Z' 'a-z')" in
  '')          ;;
  none|off)    mcp_hygiene_line maxCommitsBehind nil ;;
  *[!0-9]*)    echo "ERROR: MCP_MAX_COMMITS_BEHIND must be a whole number of commits, or 'none' (got '$MCP_MAX_COMMITS_BEHIND')." >&2
               exit 1 ;;
  *)           mcp_hygiene_line maxCommitsBehind "$MCP_MAX_COMMITS_BEHIND" ;;
esac

# `none` and `0` are both instructions here and are not the same one, so each reaches the router as
# itself. 0 is spelled out rather than passed through mcp_duration_seconds only because `0m` and `0h`
# would be silly ways to write it.
case "$(printf '%s' "${MCP_STUCK_VIEW_GRACE:-}" | tr 'A-Z' 'a-z')" in
  '')          ;;
  none|off)    mcp_hygiene_line stuckViewGraceSeconds nil ;;
  0)           mcp_hygiene_line stuckViewGraceSeconds 0 ;;
  *)           SECS=$(mcp_duration_seconds "$MCP_STUCK_VIEW_GRACE" MCP_STUCK_VIEW_GRACE) || exit 1
               mcp_hygiene_line stuckViewGraceSeconds "$SECS" ;;
esac

# Zero is NOT meaningful for this one -- it would end every call the moment the stone went over its
# threshold, which is a request deadline and not this rule -- so the router refuses it and so does
# this. `none` is how you turn it off.
case "$(printf '%s' "${MCP_PINNED_VIEW_GRACE:-}" | tr 'A-Z' 'a-z')" in
  '')          ;;
  none|off)    mcp_hygiene_line pinnedViewGraceSeconds nil ;;
  0)           echo "ERROR: MCP_PINNED_VIEW_GRACE must be a positive duration, or 'none' to never end a running call (got '0')." >&2
               exit 1 ;;
  *)           SECS=$(mcp_duration_seconds "$MCP_PINNED_VIEW_GRACE" MCP_PINNED_VIEW_GRACE) || exit 1
               mcp_hygiene_line pinnedViewGraceSeconds "$SECS" ;;
esac
