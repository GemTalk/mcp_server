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
#   GS_MCP_PROBE_INTERVAL   How often a quiet session with NO idle deadline is re-asked whether its
#                           client is still there. Default 5m. Ignored when there is a deadline.
#   GS_MCP_STREAMLESS_TIMEOUT
#                           The deadline that still applies to a client which never opened an SSE
#                           stream, when GS_MCP_IDLE_TIMEOUT is `none`. Default 30m. Such a client
#                           can never be pinged, so this is the only thing that can free its gem.
#   GS_MCP_WARNING_LEAD     How long before the deadline a session is pinged and then warned it is
#                           about to lose its uncommitted work. Unset = derived from the timeout and
#                           the reaper cadence, which is almost always what you want: the ping and
#                           the warning need two maintenance passes and an answer window between
#                           them, and a lead too short for that silently never warns anybody.
#   GS_MCP_REAPER_INTERVAL  How often the maintenance pass runs. Default 60s.
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

mcp_lifetime_line "${GS_MCP_MAX_LIFETIME:-}"        maxSessionLifetimeSeconds     GS_MCP_MAX_LIFETIME
mcp_lifetime_line "${GS_MCP_PROBE_INTERVAL:-}"      livenessProbeIntervalSeconds  GS_MCP_PROBE_INTERVAL
mcp_lifetime_line "${GS_MCP_STREAMLESS_TIMEOUT:-}"  streamlessIdleTimeoutSeconds  GS_MCP_STREAMLESS_TIMEOUT
mcp_lifetime_line "${GS_MCP_WARNING_LEAD:-}"        idleWarningLeadSeconds        GS_MCP_WARNING_LEAD
mcp_lifetime_line "${GS_MCP_REAPER_INTERVAL:-}"     reaperIntervalSeconds         GS_MCP_REAPER_INTERVAL

if [ "${GS_MCP_REAP_ON_FAILED_PROBE:-1}" = "0" ]; then
  LIFETIME_LINES="$LIFETIME_LINES
r reapOnFailedProbe: false."
fi
