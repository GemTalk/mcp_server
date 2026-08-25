#!/usr/bin/env bash
# Resolve and verify the GemStone client environment. SOURCED by install.sh, run-server.sh,
# run-auth-server.sh, run-unit-tests.sh and test.sh -- not run on its own.
#
# WHY THIS EXISTS. Every script here shells out to topaz, and topaz needs more of the environment
# than the four GS_* variables the README used to name. The one that decides it is
# GEMSTONE_GLOBAL_DIR, and getting it wrong produces an error that points somewhere else entirely:
#
#   could not find server 'gs64stone' on host 'somehost' because service not found,
#   getaddrinfo failed, EAI error 8   ... Number: 4065
#
# That names getaddrinfo, so it reads like a DNS or /etc/services problem, and the obvious next move
# -- registering the stone or the netldi in /etc/services -- is both unnecessary and a dead end.
# What actually happened: with no /etc/services entries, a stone and a netldi each bind an EPHEMERAL
# port and record it in $GEMSTONE_GLOBAL_DIR/locks/<name>..LCK. Clients read those lock files, so a
# client pointed at a different GLOBAL_DIR than the stone was started with finds no lock file and
# falls back to a hostname/service lookup, which fails. The product's built-in default is
# /opt/gemstone (then /usr/gemstone); any installation that keeps its locks elsewhere MUST tell its
# clients where, and this file is what finds that out and says so in those terms.
#
# Registering a service entry is worse than unnecessary, it is a trap: netldi binds the port named in
# /etc/services only if it is RESTARTED after the entry exists, so an entry added to a running system
# is stale by construction and points at a port nothing is listening on.
#
# WHAT A CALLER GETS. Source this file, then call the functions it needs:
#
#   gs_env_resolve            GEMSTONE + TOPAZ + GEMSTONE_GLOBAL_DIR (discovered if unset/wrong)
#   gs_env_require_stone      $GS_STONE is running and reachable, with a real listing if not
#   gs_env_require_netldi     a netldi is running (needed to FORK gems -- see below)
#   gs_env_summary            one line naming what was resolved
#   gs_env_check              all of the above as a report, for --check
#
# NETLDI IS NOT NEEDED BY EVERY SCRIPT. install.sh and run-unit-tests.sh only ever talk to the
# stone, so they call gs_env_require_stone alone and run fine on a host with no netldi at all. The
# run-*.sh scripts need one, and not because of how topaz logs in: McpRouter>>forkOnPort: and every
# per-client worker create a GsTsExternalSession, which is a gem that netldi forks. That dependency
# is in the server's design, so it survives any change to how these scripts log in.
#
# LINKED vs RPC. These scripts use `topaz -l` (linked). That is deliberate and it is NOT the reason
# for the error above: a linked login resolves the stone through the same lock files, so it needs
# GEMSTONE_GLOBAL_DIR and nothing else -- no netldi, no NRS, no service entries. Dropping -l would
# route the login through netldi instead, which works equally well once GLOBAL_DIR is right, but it
# would make install.sh depend on a netldi it otherwise has no use for.

# ---------------------------------------------------------------------------------------------
# Internal helpers.

# Candidate GEMSTONE_GLOBAL_DIR values, most likely first. The product defaults come first so a
# conventional installation is confirmed rather than "discovered"; the rest are where a per-user
# installation tends to put its locks.
_gs_env_globaldir_candidates() {
  [ -n "${GEMSTONE_GLOBAL_DIR:-}" ] && echo "$GEMSTONE_GLOBAL_DIR"
  echo "/opt/gemstone"
  echo "/usr/gemstone"
  [ -n "${GEMSTONE:-}" ] && echo "$(cd "$(dirname "$GEMSTONE")" 2>/dev/null && pwd)"
  # Any directory with a populated locks/ under the product's parent or the user's home. Depth is
  # capped so this cannot walk a whole home directory, and errors are dropped so an unreadable
  # branch does not abort the search.
  local root
  for root in "$(dirname "${GEMSTONE:-/nonexistent}")" "$HOME"; do
    [ -d "$root" ] || continue
    find "$root" -maxdepth 3 -type d -name locks 2>/dev/null | while read -r d; do
      # A locks dir is only evidence if it actually holds a lock file.
      if ls "$d"/*..LCK >/dev/null 2>&1; then dirname "$d"; fi
    done
  done
}

# Does gslist see any running server with this GEMSTONE_GLOBAL_DIR? gslist is the authority: it
# reads the same lock files the GCI client does, so if it lists servers, a login can find them.
_gs_env_gslist_finds_servers() {
  GEMSTONE_GLOBAL_DIR="$1" "$GEMSTONE/bin/gslist" -l 2>/dev/null | grep -E '^(OK|exists|startup|recovery)' > /dev/null
}

# Locate lsof, which is NOT reliably on PATH. On macOS it lives in /usr/sbin, and /usr/sbin is
# absent from the minimal PATH a cron job, a systemd unit, a container, or a `env -i` invocation
# tends to get. That matters more than it sounds: every caller here reads "no lsof output" as "no
# server is listening", so a missing lsof does not fail, it LIES -- stop-server.sh reports "nothing
# to stop" and leaves the gem running, and test.sh's teardown then leaves a front end holding the
# port. The next test run finds that port occupied and tests against the OLD front end, which is
# especially misleading because a router gem does not pick up recompiled code the way worker gems
# do. Sets GS_LSOF to an absolute path.
gs_env_locate_lsof() {
  if command -v lsof >/dev/null 2>&1; then GS_LSOF="$(command -v lsof)"; return 0; fi
  local c
  for c in /usr/sbin/lsof /sbin/lsof /usr/bin/lsof /bin/lsof /usr/local/bin/lsof /opt/homebrew/bin/lsof; do
    [ -x "$c" ] && { GS_LSOF="$c"; return 0; }
  done
  GS_LSOF=""
  return 1
}

# Same, but refuses to continue. Use wherever "nothing is listening" would otherwise be inferred
# from silence.
gs_env_require_lsof() {
  gs_env_locate_lsof && return 0
  echo "error: lsof not found on PATH or in the usual locations." >&2
  echo "       This script uses it to find (and stop) the gem listening on a port, and without it" >&2
  echo "       an empty result is indistinguishable from 'no server is running' -- so it would" >&2
  echo "       silently report success while leaving a front end holding the port." >&2
  echo "       On macOS lsof is /usr/sbin/lsof; add /usr/sbin to PATH, or set GS_LSOF to its path." >&2
  return 1
}

# ---------------------------------------------------------------------------------------------
# Public functions.

gs_env_resolve() {
  if [ -z "${GEMSTONE:-}" ]; then
    echo "error: GEMSTONE is not set. Point it at your GemStone product directory, e.g." >&2
    echo "         export GEMSTONE=/path/to/GemStone64Bit3.7.5-i386.Darwin" >&2
    return 1
  fi
  if [ ! -x "$GEMSTONE/bin/topaz" ]; then
    echo "error: no topaz at \$GEMSTONE/bin/topaz -- GEMSTONE=$GEMSTONE does not look like a" >&2
    echo "       GemStone product directory." >&2
    return 1
  fi
  TOPAZ="$GEMSTONE/bin/topaz"

  # Accept the caller's GEMSTONE_GLOBAL_DIR only if it actually resolves servers; otherwise search.
  # A value that is set but wrong is the case worth catching, because it fails exactly like unset.
  if [ -n "${GEMSTONE_GLOBAL_DIR:-}" ] && _gs_env_gslist_finds_servers "$GEMSTONE_GLOBAL_DIR"; then
    export GEMSTONE_GLOBAL_DIR
    return 0
  fi
  local was_set="${GEMSTONE_GLOBAL_DIR:-}" cand
  for cand in $(_gs_env_globaldir_candidates | awk '!seen[$0]++'); do
    [ -d "$cand" ] || continue
    if _gs_env_gslist_finds_servers "$cand"; then
      if [ -n "$was_set" ] && [ "$cand" != "$was_set" ]; then
        echo "note: GEMSTONE_GLOBAL_DIR was set to $was_set, where no running server is registered." >&2
        echo "      Using $cand instead, which is where this host's stones recorded themselves." >&2
      elif [ -z "$was_set" ]; then
        echo "note: GEMSTONE_GLOBAL_DIR was unset; discovered $cand." >&2
        echo "      Export it to make this explicit:  export GEMSTONE_GLOBAL_DIR=$cand" >&2
      fi
      export GEMSTONE_GLOBAL_DIR="$cand"
      return 0
    fi
  done

  echo "error: no running GemStone server is visible to this client." >&2
  echo "       gslist finds nothing under any GEMSTONE_GLOBAL_DIR tried, so a login would fail with" >&2
  echo "       'could not find server ... getaddrinfo failed, EAI error 8' (error 4065)." >&2
  echo "       That error names getaddrinfo, but it is NOT a DNS or /etc/services problem." >&2
  echo "       Either no stone is running, or its locks are somewhere this did not look. Check with:" >&2
  echo "         GEMSTONE_GLOBAL_DIR=<dir> $GEMSTONE/bin/gslist -l" >&2
  echo "       and export the GEMSTONE_GLOBAL_DIR the stone was STARTED with." >&2
  return 1
}

gs_env_require_stone() {
  local stone="${1:-$GS_STONE}"
  if "$GEMSTONE/bin/gslist" -l 2>/dev/null | awk -v stone="$stone" '$NF == stone && $(NF-1) == "Stone"' | grep -q .; then
    return 0
  fi
  echo "error: stone '$stone' is not running (or not registered under GEMSTONE_GLOBAL_DIR=$GEMSTONE_GLOBAL_DIR)." >&2
  local running
  running="$("$GEMSTONE/bin/gslist" -l 2>/dev/null | awk '$(NF-1) == "Stone" { print "         " $NF }')"
  if [ -n "$running" ]; then
    echo "       Stones that ARE running here:" >&2
    echo "$running" >&2
    echo "       Set GS_STONE to one of them, or start '$stone' with startstone." >&2
  else
    echo "       No stone is running at all. Start one with startstone." >&2
  fi
  return 1
}

gs_env_require_netldi() {
  # Needed to FORK a gem, which is what McpRouter>>forkOnPort: and every per-client worker session
  # do (GsTsExternalSession). Not needed merely to log in -- see the header.
  if "$GEMSTONE/bin/gslist" -l 2>/dev/null | awk '$(NF-1) == "Netldi"' | grep -q .; then
    return 0
  fi
  echo "error: no netldi is running." >&2
  echo "       The MCP server forks a gem for the front end and one per client (GsTsExternalSession)," >&2
  echo "       and netldi is what forks them -- so the server cannot start without one, however the" >&2
  echo "       launching topaz logged in. Without this check the failure surfaces as a 20-line" >&2
  echo "       GciError stack from GsTsExternalSession>>login." >&2
  echo "       Start one, e.g.:  startnetldi -g -a \$USER gs64ldi" >&2
  return 1
}

gs_env_summary() {
  echo "GEMSTONE=$GEMSTONE"
  echo "GEMSTONE_GLOBAL_DIR=$GEMSTONE_GLOBAL_DIR"
  echo "stone=${GS_STONE:-<unset>}  user=${GS_USER:-<unset>}"
}

# Full preflight report, for --check. Answers non-zero if anything required is missing.
# GS_NEEDS_NETLDI=1 makes a missing netldi an error rather than a note.
gs_env_check() {
  local rc=0
  gs_env_resolve || return 1
  echo "product      $GEMSTONE"
  echo "global dir   $GEMSTONE_GLOBAL_DIR"
  echo
  echo "servers visible to this client:"
  "$GEMSTONE/bin/gslist" -l 2>/dev/null | sed 's/^/  /'
  echo
  gs_env_require_stone || rc=1
  if [ "${GS_NEEDS_NETLDI:-0}" = "1" ]; then
    gs_env_require_netldi || rc=1
  fi
  [ "$rc" -eq 0 ] && echo "OK: environment looks usable for ${GS_STONE:-<unset>}."
  return $rc
}
