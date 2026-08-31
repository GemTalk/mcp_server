#!/usr/bin/env bash
# Does a session survive a real sleep on a real host?
#
# MANUAL test, driven in three steps around a genuine sleep -- there is no way to fake this, which
# is why it is a script you run rather than a suite that runs itself:
#
#     ./sleep-test.sh arm      # start a server, open a session + SSE stream, answer its pings
#     <sleep the Mac, wake it> # arm prints how long to sleep and how to do it
#     ./sleep-test.sh check    # gather the evidence and report a verdict per question
#     ./sleep-test.sh clean    # tear it all down
#
# and, to check the harness and the detector WITHOUT sleeping anything:
#
#     ./sleep-test.sh simulate # freeze the gem with SIGSTOP for two minutes, then report
#
# WHAT IT IS FOR. It used to ask whether a suspend DETECTOR worked: the front end measured elapsed
# wall-clock time, so a sleeping host looked exactly like every client going idle at once, and a
# detector had to notice its own pass had come back hours late and forgive the difference. That whole
# mechanism is gone. Nothing the reaper reads is an elapsed time any more -- idleness is a count of
# liveness pings the client answered, unreachability a count of maintenance passes with no stream --
# and a front end that is not running holds no passes, so a suspend advances nothing and there is
# nothing to detect or forgive.
#
# Which leaves the question this script was always really asking, now answerable directly: after the
# host really slept, is the session still there and does it still work? The gem log is no longer
# expected to say anything at all about the sleep. Silence in it is the result.
#
# That logic is unit-tested and mutation-tested. What unit tests CANNOT answer, and this can:
#
#   1. Does the reaper's `Delay forSeconds:` fire promptly after a long host suspend, or does it
#      oversleep -- or never wake at all? If it never wakes, no maintenance runs and the detector
#      never gets its chance. Nothing in the image documents this.
#   2. Do the worker gems (and the stone) survive a suspend at all? On a local stone everything
#      freezes together, so they should. "Should" is not "do".
#   3. Does the client's SSE stream survive, and does the post-wake notice actually reach it?
#   4. Does the session still WORK afterwards -- a POST on the old id answering 200, not 404?
#   5. Does the machine really sleep? Power Nap dark-wakes could let the gem run in short bursts,
#      each gap too small to trip the 3x threshold while the clock advances anyway. That would
#      defeat the detector silently, and is the failure mode nobody would predict.
#
# HOW THE EVIDENCE IS GATHERED. The SSE stream is captured with a wall-clock timestamp on every
# line, which turns out to answer questions 1, 3 and 5 by itself: keepalives arrive every 15s, so
# the gap between the last one before the sleep and the first one after IS the outage as the gem
# experienced it, and the suspend notice is emitted BY the post-wake maintenance pass, so its
# timestamp is when that pass ran. No instrumentation in the server, and nothing to remove after.
#
# The harness also answers the server's liveness pings the way a real client does -- by POSTing a
# JSON-RPC response, not by writing to the stream. Without that the session would be reaped for a
# failed probe within about three minutes and the result would be confounded.
#
# Configure (or export before running):
#   GEMSTONE              - GemStone product directory (required; source your setenv first)
#   GS_STONE/GS_USER/GS_PASS - as for the other scripts (defaults: gs64stone/DataCurator/swordfish)
#   GS_MCP_PORT           - test port (default 8020, kept off 8000 and off test.sh's 8011)
#   GS_MCP_IDLE_TIMEOUT   - the idle deadline (default none). It used to default to 5m, because
#                           idleness was wall-clock and the sleep had to EXCEED it to prove the
#                           detector forgave the gap. Counting pings inverts that. A sleep advances
#                           no count, so exceeding a deadline proves nothing -- while a deadline
#                           SHORT enough to be interesting now reaps the subject before the Mac ever
#                           sleeps: at 5m against the 300s probe interval the release count floors to
#                           one, so the harness, which answers pings faithfully, is reaped on the
#                           first one. The suspend question is only visible with no deadline in the
#                           way; set one here to test the deadline itself, which needs no sleep.
#   GS_MCP_SLEEP_STATE    - where the run's state lives (default $TMPDIR/gs-mcp-sleep-test)
set -uo pipefail
cd "$(dirname "$0")"

STATE="${GS_MCP_SLEEP_STATE:-${TMPDIR:-/tmp}/gs-mcp-sleep-test}"
PORT="${GS_MCP_PORT:-8020}"
URL="http://127.0.0.1:$PORT/mcp"
IDLE="${GS_MCP_IDLE_TIMEOUT:-none}"
export GS_STONE="${GS_STONE:-gs64stone}"
export GS_USER="${GS_USER:-DataCurator}"
export GS_PASS="${GS_PASS:-swordfish}"

STREAM_LOG="$STATE/stream.log"
PING_LOG="$STATE/pings.log"
FRESH_LOG="$STATE/freshness.log"
SERVER_LOG="$STATE/server.log"
META="$STATE/meta.env"

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
dim()   { printf '\033[2m%s\033[0m\n' "$1"; }

# verdict SYMBOL NAME DETAIL
verdict() {
  case "$1" in
    ok)   printf '  \033[32m✓\033[0m %-46s %s\n' "$2" "$3" ;;
    bad)  printf '  \033[31m✗\033[0m %-46s %s\n' "$2" "$3" ;;
    *)    printf '  \033[33m?\033[0m %-46s %s\n' "$2" "$3" ;;
  esac
}

# The gem log directory, taken from the #log: clause of GEMSTONE_NRS_ALL (the same place the netldi
# reads it from), so this works unchanged on any host whose environment is set up at all.
gem_log_dir() {
  printf '%s' "${GEMSTONE_NRS_ALL:-}" | sed -n 's/.*#log:\(.*\)\/%N_%P\.log.*/\1/p'
}

# The forked front end's own gem log: named by its gem pid, but found by CONTENT, because the pid
# in the name is the gem's and not always the one forkOnPort: reported.
find_gem_log() {
  local dir f
  dir="$(gem_log_dir)"
  [ -d "$dir" ] || return 1
  for f in $(ls -t "$dir"/gemnetobject_*.log 2>/dev/null | head -40); do
    # Match the fork's own entry expression as well as the listening line, so the log of a child
    # that DIED before binding is still findable -- that is exactly when it is wanted.
    if grep -qE "listening on http://127\.0\.0\.1:$PORT|runOnPort: $PORT configJson" "$f" 2>/dev/null; then
      printf '%s' "$f"; return 0
    fi
  done
  return 1
}

# ---------------------------------------------------------------------------
arm() {
  : "${GEMSTONE:?Set GEMSTONE (source your setenv-* first)}"
  rm -rf "$STATE"; mkdir -p "$STATE"

  # nc, not lsof: a listener owned by another user is invisible to an unprivileged lsof, and the
  # bind then fails inside the detached child gem where nobody is watching for it. (Port 8021 on
  # this Mac is exactly that case.)
  if nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
    red "Something is already listening on 127.0.0.1:$PORT."
    red "Run ./sleep-test.sh clean if it is a previous run, or set GS_MCP_PORT to a free port."; exit 1
  fi

  echo "=== gs-mcp suspend test: arming ==="
  echo "Stone=$GS_STONE  Port=$PORT  idle timeout=$IDLE"
  echo

  # --- the two power settings that can invalidate the whole run -----------------
  # `sleep prevented by ...` means the Mac will not go to sleep at all, so the test would measure
  # nothing while looking like it passed. Power Nap is subtler and more interesting: it dark-wakes
  # periodically, which could let the gem run in short bursts -- each gap too small to trip the
  # threshold while the idle clock advances regardless. That is a real potential defect, so this
  # warns rather than refuses: running WITH Power Nap on is a legitimate second experiment.
  local prevented
  prevented="$(pmset -g 2>/dev/null | sed -n 's/.*sleep prevented by \(.*\))/\1/p')"
  if [ -n "$prevented" ]; then
    red "WARNING: this Mac currently will not sleep -- something is holding it awake:"
    red "         $prevented"
    echo "         Quit it (coreaudiod usually means audio or a video call is open) and re-check"
    echo "         with:  pmset -g | grep ' sleep '"
    echo
  fi
  if pmset -g 2>/dev/null | grep -qE '^ *powernap +1'; then
    dim "Note: Power Nap is ON. The Mac may dark-wake during sleep. That is worth testing on its"
    dim "      own, but for the cleanest first run:  sudo pmset -a powernap 0"
    dim "      (and put it back afterwards with: sudo pmset -a powernap 1)"
    echo
  fi

  # --- the server -------------------------------------------------------------
  echo "Starting front end on 127.0.0.1:$PORT ..."
  GS_MCP_PORT="$PORT" GS_MCP_IDLE_TIMEOUT="$IDLE" ./run-server.sh > "$SERVER_LOG" 2>&1
  local i
  for i in $(seq 1 60); do nc -z 127.0.0.1 "$PORT" 2>/dev/null && break; sleep 0.5; done
  if ! nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
    red "Server did not start. Launcher log:"; sed 's/^/    /' "$SERVER_LOG"
    # The interesting failure is usually in the CHILD gem, not here: forkOnPort: reports a cheerful
    # success and the child then raises on its own (a bind clash, a config it refuses).
    local gl; gl="$(find_gem_log || true)"
    [ -n "$gl" ] && { echo; red "Child gem log ($gl):"; grep -m1 -A 6 '^ERROR' "$gl" | sed 's/^/    /'; }
    exit 1
  fi
  local gempid
  gempid="$(sed -n 's/.*host pid \([0-9]*\).*/\1/p' "$SERVER_LOG" | head -1)"
  green "  front end is listening (gem pid ${gempid:-?})"

  # --- a session ---------------------------------------------------------------
  local resp sid
  resp=$(curl -s -i -m 10 "$URL" --data-binary \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"sleep-test","version":"0"}}}')
  sid=$(printf '%s' "$resp" | grep -i '^mcp-session-id:' | tr -d '\r' | awk '{print $2}')
  if [ -z "$sid" ]; then red "initialize did not return a session id:"; printf '%s\n' "$resp"; exit 1; fi
  curl -s -m 10 "$URL" -H "MCP-Session-Id: $sid" \
    --data-binary '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null
  green "  session $sid opened (its worker gem is what must survive the sleep)"

  # --- the stream, every line stamped with the wall clock ----------------------
  # perl rather than `ts` or awk's strftime: neither is on a stock macOS, and the timestamps are the
  # measurement, not decoration.
  # Every background block detaches from this shell's stdout/stderr. Without that they hold the
  # pipe open and `./sleep-test.sh arm | tee` never returns -- which is how this was first found.
  ( curl -sN -m 86400 "$URL" -H "MCP-Session-Id: $sid" -H 'Accept: text/event-stream' \
      | perl -ne 'BEGIN{$|=1} my @t=localtime; printf("%04d-%02d-%02d %02d:%02d:%02d %s",$t[5]+1900,$t[4]+1,$t[3],$t[2],$t[1],$t[0],$_)' \
      >> "$STREAM_LOG" ) >/dev/null 2>&1 </dev/null &
  echo "$!" > "$STATE/stream.pid"

  # --- answer the server's pings the way a real client does --------------------
  ( tail -f -n +1 "$STREAM_LOG" 2>/dev/null | while IFS= read -r line; do
      case "$line" in
        *'"method":"ping"'*)
          rid=$(printf '%s' "$line" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
          if [ -n "$rid" ]; then
            code=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$URL" -H "MCP-Session-Id: $sid" \
              --data-binary "{\"jsonrpc\":\"2.0\",\"id\":\"$rid\",\"result\":{}}")
            printf '%s answered %s -> HTTP %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$rid" "$code" >> "$PING_LOG"
          fi ;;
      esac
    done ) >/dev/null 2>&1 </dev/null &
  echo "$!" > "$STATE/responder.pid"

  : > "$PING_LOG"

  # --- keep the session fresh until the moment the host actually sleeps --------
  # Without this the test cannot work at all, and the reason is worth spelling out. An answered ping
  # deliberately does NOT reset the idle clock (only real MCP traffic does), so a session left quiet
  # is reaped at the deadline whether or not anything slept -- and with a 5-minute deadline, the time
  # between "arm finished" and "the user actually pressed sleep" is enough to kill it. The result
  # would read as a suspend-detector failure when it was nothing of the sort.
  #
  # So a real call goes out every 30s, exactly as a client in use would make one. The loop then
  # SELF-TERMINATES the moment it notices it was itself frozen -- it detects the suspend the same way
  # the server does, by measuring its own lateness. That matters: if it kept touching after the wake
  # it could stamp the session fresh before the maintenance pass looked at it, and mask the very
  # failure this test exists to catch. It stops, and leaves the evidence honest.
  ( last=$(date +%s)
    while :; do
      sleep 30
      now=$(date +%s)
      if [ $((now - last)) -gt 90 ]; then
        printf '%s FROZE for %ss -- stopping, so the post-wake state is not disturbed\n' \
          "$(date '+%Y-%m-%d %H:%M:%S')" "$((now - last))" >> "$FRESH_LOG"
        exit 0
      fi
      code=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$URL" -H "MCP-Session-Id: $sid" \
        --data-binary '{"jsonrpc":"2.0","id":50,"method":"tools/list"}')
      printf '%s tools/list -> HTTP %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$code" >> "$FRESH_LOG"
      [ "$code" = "200" ] || exit 0
      last=$now
    done ) >/dev/null 2>&1 </dev/null &
  echo "$!" > "$STATE/fresh.pid"

  # Every value quoted: this file is SOURCED, and an unquoted timestamp ("2026-08-23 14:28:35")
  # makes the shell try to run the time as a command and leaves the variable unset -- which then
  # trips `set -u` in check, several minutes of sleep too late to be funny.
  cat > "$META" <<EOF
SID='$sid'
PORT='$PORT'
GEMPID='${gempid:-}'
IDLE='$IDLE'
ARMED_AT='$(date +%s)'
ARMED_AT_HUMAN='$(date '+%Y-%m-%d %H:%M:%S')'
GEMLOG='$(find_gem_log || true)'
EOF

  # --- prove the capture works BEFORE anyone commits to sleeping ---------------
  # Keepalives arrive every 15s, so two of them is proof the stream is attached, the drain loop is
  # running, and the timestamped capture is recording -- which is the whole measuring apparatus.
  echo
  echo "Waiting for the stream to prove itself (two keepalives, ~30s) ..."
  local waited=0 seen=0
  while [ "$waited" -lt 90 ]; do
    seen=$(grep -c 'keepalive' "$STREAM_LOG" 2>/dev/null | tr -d ' ')
    [ "${seen:-0}" -ge 2 ] && break
    sleep 5; waited=$((waited + 5))
  done
  if [ "${seen:-0}" -ge 2 ]; then
    green "  stream is live and being timestamped (${seen} keepalives in ${waited}s)"
  else
    red "  the stream is not producing keepalives. Sleeping now would prove nothing."
    red "  Look at $STREAM_LOG before going further."
  fi
  if grep -q 'HTTP 200' "$FRESH_LOG" 2>/dev/null; then
    green "  the session answers real calls, and will be kept fresh until the host sleeps"
  else
    dim "  (the first freshness call goes out 30s in; check ./sleep-test.sh status if unsure)"
  fi

  print_sleep_instructions
}

print_sleep_instructions() {
  . "$META"
  # There is no detector floor any more, so there is no threshold a sleep has to clear to be
  # "seen". A suspend advances no count because no maintenance pass runs, and that is true of a
  # two-minute nap and an eight-hour night alike. What length still buys is exposure to the one
  # case that CAN advance a count while the lid is shut: a Power Nap dark wake runs the front end
  # for a few seconds, and a pass that runs is a pass that counts. Longer is strictly more
  # informative, which is the opposite of the old advice, where too long merely wasted a night.
  local idle_s streamless_s passes GRACE_S
  case "$(printf '%s' "$IDLE" | tr 'A-Z' 'a-z')" in
    none|off|0) idle_s=0 ;;
    *m) idle_s=$(( ${IDLE%[mM]} * 60 )) ;;
    *h) idle_s=$(( ${IDLE%[hH]} * 3600 )) ;;
    *s) idle_s=${IDLE%[sS]} ;;
    *)  idle_s=$IDLE ;;
  esac
  streamless_s="${GS_MCP_STREAMLESS_TIMEOUT:-60}"
  # ceiling of the division, plus the pass the count starts on -- see
  # McpRouter>>streamlessPassesBeforeRelease.
  passes=$(( (streamless_s + ${GS_MCP_REAPER_INTERVAL:-60} - 1) / ${GS_MCP_REAPER_INTERVAL:-60} + 1 ))
  GRACE_S="${GS_MCP_STREAM_LOSS_GRACE:-10}"

  echo
  echo "=== ready. Now sleep the Mac. ==="
  echo
  echo "  Sleep for as long as you like -- overnight is ideal. There is no minimum."
  echo
  dim "  Nothing here is measured in elapsed time, so there is no gap too short to be forgiven and"
  dim "  none too long to survive. The front end holds no maintenance passes while it is not"
  dim "  running, so a suspend of any length advances no count and needs no handling."
  dim ""
  dim "  What the length actually buys is dark wakes. Each one lets the front end run a few passes,"
  dim "  and those DO count: a pass with no stream advances toward release at ${passes} of them"
  dim "  (streamless ${streamless_s}s / reaper ${GS_MCP_REAPER_INTERVAL:-60}s), and a ping the client is too frozen"
  dim "  to answer advances toward three. That is the one way a night could still end a session,"
  dim "  and the only way to find out is to give it a whole night to try."
  dim ""
  dim "  One more outcome is possible now, and it is NOT a suspend failure: if this curl's stream"
  dim "  dies during the night and nothing reopens one, the front end treats that as the client"
  dim "  hanging up and releases the gem ${GRACE_S}s later. That is the correct answer to a client that"
  dim "  really did go away -- a real client would have reconnected. The verdicts below tell the two"
  dim "  apart by reporting whether the stream was still connected on wake."
  if [ "$idle_s" -gt 0 ]; then
    dim ""
    dim "  NOTE: you have an idle deadline set (${IDLE}), so this run also carries a second, expected"
    dim "  outcome -- the session is released after the client ANSWERS enough pings, which is correct"
    dim "  behaviour and not a suspend failure. Run with no deadline to isolate the suspend question."
  fi
  echo
  echo "  Put it to sleep with either:"
  echo "      pmset sleepnow          # no sudo needed"
  echo "      (or just close the lid)"
  echo
  echo "  Wake it in the morning, then run:"
  echo "      ./sleep-test.sh check"
  echo
  dim "  Take as long as you like getting to the sleep: a background loop makes a real MCP call"
  dim "  every 30s, so the session stays fresh until the host actually stops, and that loop shuts"
  dim "  itself off the moment it notices it was frozen -- so it cannot mask the result afterwards."
  dim "  Leave this terminal be -- two background processes are holding the stream and answering"
  dim "  pings, and they need to be frozen and thawed along with the gem."
  dim "  State: $STATE"
}

# ---------------------------------------------------------------------------
check() {
  [ -f "$META" ] || { red "Nothing armed. Run ./sleep-test.sh arm first."; exit 1; }
  . "$META"
  local now elapsed gemlog
  now=$(date +%s); elapsed=$((now - ARMED_AT))
  gemlog="${GEMLOG:-}"; [ -f "$gemlog" ] || gemlog="$(find_gem_log || true)"

  echo "=== gs-mcp suspend test: results ==="
  echo "Armed ${ARMED_AT_HUMAN:-?}, $((elapsed / 60))m$((elapsed % 60))s ago.  Session $SID, idle timeout $IDLE."
  echo

  # 5. HOW did the machine sleep? Not "did it" -- the 2026-08-23 run settled that a suspend arrives
  #    in PIECES, with macOS dark-waking between them, and that only pieces above the detector's
  #    threshold are forgiven. So the measurement that matters is the whole profile: every stretch
  #    the gem was frozen, how much of it was forgiven, and how much was charged to the client as
  #    idleness it never spent. Keepalives are 15s apart, so anything past ~20s is a freeze.
  local frozen_total frozen_n biggest
  eval "$(grep 'keepalive' "$STREAM_LOG" 2>/dev/null | awk '{print $1" "$2}' | perl -ne '
    use Time::Local; chomp;
    my ($Y,$M,$D,$h,$m,$s) = /(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/ or next;
    my $t = timelocal($s,$m,$h,$D,$M-1,$Y);
    if (defined $p) {
      my $d = $t - $p;
      if ($d > 20) { $n++; $sum += $d; $max = $d if !defined $max || $d > $max; push @g, $d }
    }
    $p = $t;
    END {
      printf("frozen_total=%d frozen_n=%d biggest=%d gaps=\x27%s\x27\n",
             $sum||0, $n||0, $max||0, join(" ", @g));
    }')"

  if [ "${frozen_n:-0}" -eq 0 ]; then
    verdict huh "the host stopped serving at all" "no freeze longer than 20s on the stream"
  else
    verdict ok "the host stopped serving" \
      "${frozen_total}s total, in ${frozen_n} piece(s), largest ${biggest}s"
    dim "      pieces (s): ${gaps}"
  fi

  # 1. the gem log should have NOTHING to say about any of this. Under the counted-evidence design a
  # suspend is not an event the front end can observe or has to handle: it simply holds no
  # maintenance passes while it is not running, so nothing advances and nothing is forgiven. A
  # forgiveness line here would mean a suspend detector had come back from the dead.
  local forgiven_n reaped_n
  forgiven_n=$(grep -c 'was not running for about' "$gemlog" 2>/dev/null | tr -d ' ')
  if [ "${forgiven_n:-0}" -eq 0 ]; then
    verdict ok "the front end had nothing to forgive" "no suspend accounting in the gem log, as designed"
  else
    verdict bad "the front end had nothing to forgive" \
      "${forgiven_n} forgiveness line(s) in $gemlog -- a suspend detector is back"
  fi

  # 2. and it should not have reaped anything. Any reap line names its own reason, so a failure here
  # says which count advanced while the host was asleep -- which is the bug this design forecloses.
  reaped_n=$(grep -c 'Reaped MCP session' "$gemlog" 2>/dev/null | tr -d ' ')
  if [ "${reaped_n:-0}" -eq 0 ]; then
    verdict ok "nothing was reaped across the sleep" "no session ended while the host was away"
  else
    verdict bad "nothing was reaped across the sleep" \
      "$(grep -m3 'Reaped MCP session' "$gemlog" 2>/dev/null | sed 's/^/        /')"
  fi

  # 3. the client should not have been told anything about a suspend either -- there is no longer
  # any such notice to send, because the session was never in danger and its gem never changed hands.
  notice_time=$(grep -m1 'was not running for about' "$STREAM_LOG" 2>/dev/null | awk '{print $1" "$2}')
  if [ -z "$notice_time" ]; then
    verdict ok "the client was told nothing about a suspend" "nothing to tell it"
  else
    verdict bad "the client was told nothing about a suspend" "a suspend notice arrived at $notice_time"
  fi
  if kill -0 "$(cat "$STATE/stream.pid" 2>/dev/null)" 2>/dev/null; then
    verdict ok "the SSE stream survived the sleep" "still connected"
  else
    verdict huh "the SSE stream survived the sleep" "curl exited (a real client would reconnect)"
    dim "    -> if the session check below says 404, THAT is why: a closed stream with no reconnect"
    dim "       is a client hanging up, and is released after streamLossGraceSeconds by design."
  fi

  # 4. the whole point: is the session still usable, or was its gem freed while we slept?
  local code
  code=$(curl -s -o "$STATE/post.out" -w '%{http_code}' -m 15 "$URL" -H "MCP-Session-Id: $SID" \
    --data-binary '{"jsonrpc":"2.0","id":99,"method":"tools/list"}')
  if [ "$code" = "200" ]; then
    verdict ok "the session survived (this is the point)" "POST tools/list -> 200"
  elif [ "$code" = "404" ]; then
    verdict bad "the session survived (this is the point)" "POST -> 404: its worker gem was reaped"
  else
    verdict huh "the session survived (this is the point)" "POST -> HTTP $code"
  fi

  # 2. and did the worker gem itself come through -- a 200 above already implies it, since the
  #    request was executed IN it, but say so explicitly.
  if [ "$code" = "200" ] && grep -q '"tools"' "$STATE/post.out" 2>/dev/null; then
    verdict ok "the worker gem came through the suspend" "it executed a tool call after the wake"
  else
    verdict huh "the worker gem came through the suspend" "not demonstrated (see above)"
  fi

  # An independent, CLIENT-side measurement of the same outage. The freshness loop measures its own
  # lateness exactly as the server's maintenance pass does, so two numbers that agree are two
  # separate witnesses; two that disagree mean one side kept running while the other did not, which
  # would itself be the finding.
  local client_gap
  client_gap=$(grep -o 'FROZE for [0-9]*s' "$FRESH_LOG" 2>/dev/null | tail -1 | grep -o '[0-9]*')
  if [ -n "${client_gap:-}" ]; then
    verdict ok "the client side was frozen too" "${client_gap}s, measured independently"
  else
    verdict huh "the client side was frozen too" "the freshness loop never noticed a freeze"
  fi
  # HOW MUCH DID THE GEM ACTUALLY RUN? This is the one question the redesign leaves genuinely open,
  # and the only one that needs a real night to answer. A suspend advances no count because no pass
  # runs -- but Power Nap dark-wakes let the front end run in short bursts, and a pass that runs is a
  # pass that counts. Each burst with no stream advances streamlessPasses toward its release count;
  # each ping the client is too frozen to answer advances unansweredProbes toward three.
  #
  # Pings are the visible proxy: one goes out every #probePassInterval passes, so the ratio of pings
  # actually sent to the number a continuously-running gem would have sent IS the fraction of the
  # night the front end was scheduled. Near 0% is a clean suspend. Near 100% means the Mac never
  # really slept. In between is the interesting case -- and if the client answered every ping that
  # was sent even so, the design held under exactly the conditions that used to defeat it.
  local sent answered expected ran_pct
  sent=$(grep -c '"method":"ping"' "$STREAM_LOG" 2>/dev/null | tr -d ' ')
  answered=$(grep -c 'answered' "$PING_LOG" 2>/dev/null | tr -d ' ')
  expected=$(( elapsed / ${GS_MCP_PROBE_SECONDS:-300} ))
  if [ "${expected:-0}" -gt 0 ]; then
    ran_pct=$(( 100 * ${sent:-0} / expected ))
    verdict ok "how much of the night the front end ran" \
      "${sent:-0} pings sent vs ${expected} if never suspended -- about ${ran_pct}% scheduled"
  fi
  # The verdict that matters: of the pings that DID go out, did the client answer them? Three
  # unanswered in a row on a live stream is the one thing that ends a session with no deadline set.
  if [ "${sent:-0}" -eq 0 ]; then
    verdict ok "every ping that went out was answered" "none went out -- the gem was not running"
  elif [ "${answered:-0}" -ge "${sent:-0}" ]; then
    verdict ok "every ping that went out was answered" "${answered}/${sent}, so nothing counted as death"
  else
    verdict bad "every ping that went out was answered" \
      "${answered}/${sent} -- $(( sent - answered )) went unanswered; 3 in a row releases the gem"
  fi

  local answered failed
  answered=$(grep -c 'HTTP 202' "$PING_LOG" 2>/dev/null | tr -d ' ')
  failed=$(grep -cv 'HTTP 202' "$PING_LOG" 2>/dev/null | tr -d ' ')
  verdict "$([ "${answered:-0}" -gt 0 ] && echo ok || echo huh)" \
    "liveness pings answered by this harness" "${answered:-0} accepted, ${failed:-0} not"

  echo
  echo "Evidence:"
  echo "  stream (timestamped) : $STREAM_LOG"
  echo "  ping answers         : $PING_LOG"
  echo "  freshness calls      : $FRESH_LOG"
  echo "  front-end gem log    : ${gemlog:-<not found>}"
  echo
  dim "The keepalive gap and the notice timestamp together answer the question no unit test can:"
  dim "whether GemStone's Delay comes back promptly after a real suspend. Compare the last keepalive"
  dim "before the gap, the first one after it, and the time on the suspend notice."
  # macOS's own account of the same window, which is the only way to see the dark wakes: the gem
  # cannot observe a wake it was not scheduled during, so a piece it never noticed looks like
  # ordinary running time from inside.
  if [ -n "${ARMED_AT_HUMAN:-}" ]; then
    local mac_total
    mac_total=$(pmset -g log 2>/dev/null | grep 'Entering Sleep state' \
      | awk -v start="$ARMED_AT_HUMAN" '$0 >= start' \
      | sed -E 's/.*[^0-9]([0-9]+) secs.*/\1/' | awk '{s+=$1} END {print s+0}')
    if [ "${mac_total:-0}" -gt 0 ]; then
      verdict ok "macOS agrees about the total" "${mac_total}s asleep by its own power log"
      dim "      pieces, from pmset:"
      pmset -g log 2>/dev/null | grep 'Entering Sleep state' \
        | awk -v start="$ARMED_AT_HUMAN" '$0 >= start' \
        | sed -E 's/^([0-9-]+ [0-9:]+).*due to .([A-Za-z ]+).*[^0-9]([0-9]+) secs.*/        \1  \2  \3s/' | head -30
    fi
  fi

  echo
  echo "Around the gap:"
  grep -n 'keepalive\|was not running\|ping\|has ended' "$STREAM_LOG" 2>/dev/null | tail -12 | sed 's/^/  /'
}

# ---------------------------------------------------------------------------
status() {
  [ -f "$META" ] || { red "Nothing armed."; exit 1; }
  . "$META"
  echo "Armed ${ARMED_AT_HUMAN:-?}.  Session $SID on port $PORT, idle timeout $IDLE."
  echo "Last 8 stream lines:"; tail -8 "$STREAM_LOG" 2>/dev/null | sed 's/^/  /'
  echo "Pings answered:  $(grep -c 'HTTP 202' "$PING_LOG" 2>/dev/null | tr -d ' ')"
  echo "Freshness calls: $(grep -c 'HTTP 200' "$FRESH_LOG" 2>/dev/null | tr -d ' ') ok, last: $(tail -1 "$FRESH_LOG" 2>/dev/null)"
  for f in stream.pid responder.pid fresh.pid; do
    p="$(cat "$STATE/$f" 2>/dev/null)"
    if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then echo "  $f alive ($p)"; else echo "  $f NOT RUNNING"; fi
  done
}

# ---------------------------------------------------------------------------
# A suspend, minus the hardware. SIGSTOP is what a host suspend looks like from inside a process --
# the gem stops being scheduled and its wall clock keeps running -- so this exercises the detector,
# the forgiveness, the notice and the whole evidence chain in about four minutes, with nothing to
# arrange and nothing to wait for.
#
# What it CANNOT stand in for, and why the real thing is still worth doing: whether macOS dark-wakes
# during a genuine sleep (Power Nap) and lets the gem run in bursts too short to trip the threshold;
# whether the stone and the worker gems survive a real suspend rather than a signal; and whether the
# kernel does anything to the sockets that a stopped process does not. Two of the results below are
# expected to come back amber here -- the client side is killed rather than frozen, and the run is
# too short for a liveness ping -- and both are artefacts of the simulation, not findings.
simulate() {
  local freeze="${2:-120}"
  # No idle deadline here either, and for the same reason as arm: with one set, the harness answers
  # pings faithfully and is reaped for perfectly correct idleness a couple of minutes in, which says
  # nothing about the freeze. A fast reaper and a fast probe just make the passes tick quickly enough
  # to see something happen inside a two-minute run. GS_MCP_PENDING_TIMEOUT is gone with the pending
  # -request timer the redesign deleted; setting it here did nothing.
  GS_MCP_IDLE_TIMEOUT="${GS_MCP_IDLE_TIMEOUT:-none}" \
  GS_MCP_REAPER_INTERVAL="${GS_MCP_REAPER_INTERVAL:-10}" \
  GS_MCP_PROBE_INTERVAL="${GS_MCP_PROBE_INTERVAL:-30}" arm || exit 1
  . "$META"
  [ -n "${GEMPID:-}" ] || { red "No gem pid recorded; cannot freeze anything."; exit 1; }

  echo
  echo "=== simulating a ${freeze}s suspend: SIGSTOP on gem $GEMPID ==="
  # The freshness loop goes first, standing in for a client that froze with the host. Left running,
  # its POSTs would pile up in the listen backlog and be answered the instant the gem thaws --
  # stamping the session fresh before the maintenance pass looks at it, and masking the result.
  kill "$(cat "$STATE/fresh.pid" 2>/dev/null)" 2>/dev/null
  kill -STOP "$GEMPID" || { red "Could not stop $GEMPID"; exit 1; }
  date '+  %H:%M:%S frozen'
  sleep "$freeze"
  kill -CONT "$GEMPID"
  date '+  %H:%M:%S thawed'
  sleep 25          # one maintenance pass, plus room for the notice to reach the stream
  echo
  check
}

clean() {
  local pid
  for f in stream.pid responder.pid fresh.pid; do
    pid="$(cat "$STATE/$f" 2>/dev/null)"
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
  done
  pkill -f "tail -f -n +1 $STREAM_LOG" 2>/dev/null
  # Delegate the front end to stop-server.sh, and let it say what it actually did. Open-coded, this
  # read a bare lsof and inferred "nothing is listening" from an empty result -- which on a minimal
  # PATH means "lsof was not found" (see gs_env_require_lsof), so the gem kept running while the
  # line below announced it had been stopped. stop-server.sh also kills only a gem and escalates
  # SIGTERM -> SIGKILL. The arm-time check above stays on nc for an unrelated reason: it has to see
  # listeners owned by OTHER users, which an unprivileged lsof hides.
  GS_MCP_PORT="$PORT" ./stop-server.sh
  echo "Stopped the background captures."
  echo "State left in $STATE (rm -rf it when you are done with the evidence)."
}

case "${1:-}" in
  arm)   arm ;;
  simulate) simulate ;;
  check) check ;;
  status) status ;;
  clean) clean ;;
  *) sed -n '2,44p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
