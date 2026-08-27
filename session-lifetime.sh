# Session-lifetime configuration, shared by run-server.sh and run-auth-server.sh.
#
# Sourced, not executed. Reads the GS_MCP_* duration variables below and leaves Smalltalk setter
# sends for them in $LIFETIME_LINES, ready to drop into either launcher's topaz heredoc. Every one
# is optional: an unset variable emits no line at all, so the router keeps the default it seeds in
# McpRouter>>initialize. That distinction matters for the idle timeout, where "unset" (30 minutes)
# and "none" (no deadline) are different instructions.
#
# Durations accept a unit suffix -- 90s, 30m, 4h -- or a bare number of seconds.
#
#   GS_MCP_IDLE_TIMEOUT     How long a client may be quiet before its worker gem is released.
#                           Default 30m. `none` removes the deadline entirely: the session then
#                           lives as long as its client keeps answering liveness pings on the SSE
#                           stream it opened, which is what a developer who comes back to a
#                           localhost server hours later wants, and what a shared or authenticated
#                           deployment usually does not. Before choosing it, know the cost: each
#                           session is a gem sitting in a transaction, so it pins a repository view
#                           and holds back page reclamation -- a forgotten session is extent growth.
#                           An authenticated router caps every session at its access token's exp
#                           regardless, so `none` there means "until the token expires".
#   GS_MCP_MAX_LIFETIME     Absolute cap on any session's life, however busy it is. Unset = none.
#                           Never forgiven, unlike idleness -- including across a host suspend.
#   GS_MCP_PROBE_INTERVAL   How often a quiet session is asked whether its client is still there.
#                           Default 2m. This is also the unit idleness is MEASURED in: a session is
#                           released once it has answered GS_MCP_IDLE_TIMEOUT worth of these pings
#                           with no work in between (fifteen of them, at the defaults) -- and a
#                           client that holds its stream open but stops answering is released after
#                           three, so this interval sets that deadline too.
#   GS_MCP_STREAM_LOSS_GRACE
#                           How long a session survives its client CLOSING the event stream, before
#                           the worker gem is released. Default 10s. This is the path a shut editor
#                           tab takes, and the grace exists only to cover a client that closes one
#                           stream and immediately opens another. `0` and `none` are OPPOSITES here:
#                           0 releases the gem the moment the socket closes, with no pause for a
#                           reconnect, while `none` turns the fast release off altogether and leaves
#                           such a client to GS_MCP_STREAMLESS_TIMEOUT, as it was before.
#   GS_MCP_STREAMLESS_TIMEOUT
#                           The floor for a client that never opened an SSE stream AT ALL.
#                           Default 60s. Such a client can never be pinged, so there is no evidence
#                           to count and this is the only thing that can free its gem. It bounds the
#                           gap between such a client's requests, not the life of its session, so
#                           raise it where streamless clients POST in sequence rather than once.
#   GS_MCP_REAPER_INTERVAL  How often the maintenance pass runs. Default 60s. The pass is the
#                           server's clock -- it ticks only while the front end is running -- so
#                           every count below is measured in passes, not in elapsed time.
#   GS_MCP_EXPIRY_WARNING_LEAD
#                           How long before an ABSOLUTE deadline -- a lifetime cap, or an access
#                           token's exp -- a client is warned. Default 5m, and in seconds because
#                           that deadline is itself a wall-clock fact. There is no equivalent knob
#                           for the idle warning: it goes out when exactly one answered ping remains.
#   GS_MCP_REAP_ON_FAILED_PROBE
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

# `none` is an instruction, not an absence: it has to reach the router as an explicit nil.
case "$(printf '%s' "${GS_MCP_IDLE_TIMEOUT:-}" | tr 'A-Z' 'a-z')" in
  '')          ;;
  none|off|0)  LIFETIME_LINES="$LIFETIME_LINES
r sessionIdleTimeoutSeconds: nil." ;;
  *)           mcp_lifetime_line "$GS_MCP_IDLE_TIMEOUT" sessionIdleTimeoutSeconds GS_MCP_IDLE_TIMEOUT ;;
esac

case "$(printf '%s' "${GS_MCP_STREAM_LOSS_GRACE:-}" | tr 'A-Z' 'a-z')" in
  '')          ;;
  none|off|0)  LIFETIME_LINES="$LIFETIME_LINES
r streamLossGraceSeconds: nil." ;;
  *)           mcp_lifetime_line "$GS_MCP_STREAM_LOSS_GRACE" streamLossGraceSeconds GS_MCP_STREAM_LOSS_GRACE ;;
esac

mcp_lifetime_line "${GS_MCP_MAX_LIFETIME:-}"        maxSessionLifetimeSeconds     GS_MCP_MAX_LIFETIME
mcp_lifetime_line "${GS_MCP_EXPIRY_WARNING_LEAD:-}" expiryWarningLeadSeconds      GS_MCP_EXPIRY_WARNING_LEAD
mcp_lifetime_line "${GS_MCP_PROBE_INTERVAL:-}"      livenessProbeIntervalSeconds  GS_MCP_PROBE_INTERVAL
mcp_lifetime_line "${GS_MCP_STREAMLESS_TIMEOUT:-}"  streamlessIdleTimeoutSeconds  GS_MCP_STREAMLESS_TIMEOUT
mcp_lifetime_line "${GS_MCP_REAPER_INTERVAL:-}"     reaperIntervalSeconds         GS_MCP_REAPER_INTERVAL

if [ "${GS_MCP_REAP_ON_FAILED_PROBE:-1}" = "0" ]; then
  LIFETIME_LINES="$LIFETIME_LINES
r reapOnFailedProbe: false."
fi
