#!/usr/bin/env bash
# Install the native GemStone MCP server classes into the image.
#
# Logs in via topaz, ensures the Published dictionary exists, files in the Mcp* classes as plain
# topaz file-outs, and commits. No Rowan, no Tonel: the .gs files are canonical `fileOutClass`
# output and load into any image topaz can log into.
#
# The code is grouped by area, one directory and one loader per group -- src/core, src/tests,
# src/auth, src/grail. core and tests are always filed in; the other two are selected below and
# this script composes the `input` lines, so all four combinations are reachable.
#
# NOTE: filing these .gs files over classes a Rowan project had loaded fails at the first method
# with "Duplicate definition of ... (error 2318)". Install into an image that never loaded the Rowan
# 'Mcp' project, or remove the Mcp* keys from Published and commit first. See README, Source layout.
#
#   --grail   ALSO file in the optional GemStone-Python toolset (src/grail). Only valid on an image
#             that has Grail/ModuleAst -- those methods reference ModuleAst and BaseException and
#             cannot compile without it. Equivalently, set GS_MCP_WITH_GRAIL=1. Opt-in rather than
#             detected, because loading it is NOT inert: the toolset joins the default tool surface
#             automatically (see McpServer class>>installedDefaultToolsetNames), so whether to have
#             it is a decision about the server you are running, not about the image.
#
#   --auth    require the OAuth/OIDC front end (src/auth); fail if this image cannot compile it.
#   --no-auth skip it.
#             Neither flag is normally needed. By DEFAULT the auth group is filed in when the image
#             can take it and skipped when it cannot, because McpAuthRouter needs kernel JWT classes
#             (JsonWebToken, JwtSecurityData) and GsTsExternalSession>>jwtPassword:, which arrived
#             after 3.7.2 -- on 3.7.2 those methods cannot compile at all. Detecting rather than
#             asking is safe here precisely because loading McpAuthRouter IS inert: it is a class
#             nothing instantiates until you fork one with run-auth-server.sh. Use --auth when you
#             would rather fail loudly than quietly get a server with no authentication available,
#             and --no-auth to leave it out of an image that could take it.
#
#   --check   verify the environment (product, GEMSTONE_GLOBAL_DIR, the stone), report which groups
#             would be filed in, and install nothing. Run this first on a new machine.
#
# Configure these (or export before running):
#   GEMSTONE       - GemStone product directory (REQUIRED; no default can be guessed)
#   GS_STONE       - stone name              (default: gs64stone)
#   GS_USER        - GemStone user           (default: DataCurator)
#   GS_PASS        - GemStone password       (default: swordfish)
#   GEMSTONE_GLOBAL_DIR - where the running stone recorded itself. Usually discovered; see
#                         gs-env.sh, which explains why this one variable decides whether a login
#                         works and why the failure names getaddrinfo.
# This script talks only to the STONE, so it needs no netldi and works on a host that has none.
set -euo pipefail
cd "$(dirname "$0")"

GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"

# core + tests always; auth detected unless pinned; grail opt-in. See the header for why the two
# optional groups are selected differently.
WANT_AUTH="auto"      # auto | yes | no
WANT_GRAIL=0
CHECK_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --grail)   WANT_GRAIL=1 ;;
    --auth)    WANT_AUTH="yes" ;;
    --no-auth) WANT_AUTH="no" ;;
    --check)   CHECK_ONLY=1 ;;
    *) echo "usage: $0 [--auth|--no-auth] [--grail] [--check]" >&2; exit 2 ;;
  esac
done
[ -n "${GS_MCP_WITH_GRAIL:-}" ] && WANT_GRAIL=1

# Resolve GEMSTONE/TOPAZ/GEMSTONE_GLOBAL_DIR and confirm the stone is actually running, so a
# misconfigured environment is reported in its own terms instead of as a topaz login failure.
. ./gs-env.sh
gs_env_resolve

# Settle the auth group before anything is filed in, so an image that cannot take it is reported
# here -- in terms of the missing kernel classes -- rather than as a wall of compile errors in
# load.out and an McpAuthRouter left half-built. JsonWebToken stands in for the whole group: it is
# the one McpAuthRouter itself names (in tokenRejectionFor:, userIdFromToken: and payloadOf:), and
# an image with it has JwtSecurityData and jwtPassword: too.
gs_mcp_select_groups() {
  local have
  if [ "$WANT_AUTH" = "no" ]; then
    AUTH_NOTE="skipped (--no-auth)"
  else
    gs_env_image_has JsonWebToken && have=0 || have=$?
    case "$have" in
      0) AUTH_NOTE="yes" ;;
      1) if [ "$WANT_AUTH" = "yes" ]; then
           echo "error: --auth was given, but this image has no JsonWebToken, so src/auth cannot" >&2
           echo "       compile here. Kernel JWT support arrived after 3.7.2; McpAuthRouter needs" >&2
           echo "       JsonWebToken and JwtSecurityData, and a JWT worker login additionally needs" >&2
           echo "       GsTsExternalSession>>jwtPassword:. Install on 3.7.5 or later for the" >&2
           echo "       authenticating front end, or drop --auth to install the rest without it." >&2
           echo "       (stone: $GS_STONE)" >&2
           return 1
         fi
         AUTH_NOTE="skipped (no kernel JWT support in this image)" ;;
      *) return 1 ;;   # gs_env_image_has has already said why
    esac
  fi

  # MCP_GROUPS, not GROUPS: bash reserves GROUPS for the current user's group list, and assigning
  # to it silently fails (returning an error status, which under `set -e` aborts this function
  # mid-way and leaves GROUP_INPUTS unset).
  MCP_GROUPS="core tests"
  [ "$AUTH_NOTE" = "yes" ] && MCP_GROUPS="$MCP_GROUPS auth"
  [ "$WANT_GRAIL" = "1" ] && MCP_GROUPS="$MCP_GROUPS grail"

  # Two things derived from the selection, both from the group directories rather than from a list
  # kept in step by hand: the `input` lines topaz runs, and the class names the post-load check
  # looks for. Every group holds exactly one .gs file per class plus its load.gs, so the file names
  # ARE the manifest -- adding a class to a group needs no edit here.
  local g f b
  GROUP_INPUTS=""
  CLASS_ADDS=""
  for g in $MCP_GROUPS; do
    GROUP_INPUTS="${GROUP_INPUTS}input src/$g/load.gs
"
    for f in src/$g/*.gs; do
      b="$(basename "$f" .gs)"
      [ "$b" = "load" ] && continue
      # One `add:` per line: a generated `#( ... )` literal would put a '(' at the start of a
      # heredoc line, which bash 3.2 (macOS) mis-parses inside a command substitution.
      CLASS_ADDS="${CLASS_ADDS}names add: '$b'.
"
    done
  done
}

if [ "$CHECK_ONLY" = "1" ]; then
  gs_env_check || exit $?
  gs_mcp_select_groups || exit 1
  echo
  echo "auth group   $AUTH_NOTE"
  echo "groups       $MCP_GROUPS"
  exit 0
fi
gs_env_require_stone
gs_mcp_select_groups
echo "Filing in: $MCP_GROUPS  (auth: $AUTH_NOTE)"

# The loaders `input` their class files by paths relative to the repository root, so topaz must run
# with this directory as its current directory -- hence the cd above, and no `cd` after it.
#
# Stream topaz's output live AND keep a copy to gate on. Do NOT wrap the heredoc in $( ... ): under
# `set -e` a command substitution that exits non-zero aborts the script before anything is printed,
# hiding the very output you need to diagnose the load. Tee to a temp file instead.
#
# WHY `set sourcestringclass String` BELOW. Topaz reads `Globals at: #StringConfiguration` at login
# and reconfigures itself to match, announcing it in the banner:
#
#   successful login
#    fileformat is now utf8
#   sourcestringclass is now Unicode16
#
# On such an image EVERY string literal in every method filed in here compiles as a Unicode7 rather
# than a byte String. That is not a version thing -- 3.7.5 with and without the setting differ, and
# 3.7.2 with it would behave the same way. In practice it is Grail that sets it: installing Grail
# leaves #StringConfiguration = Unicode16, so a Grail image and a stock image compile the same
# source into different literal classes.
#
# We pin it because the difference is not cosmetic. See the Unicode7 trap in section 5 of
# docs/kernel-json-unicode.md, and McpBase class>>decodeUtf8:, which exists because of it: on a
# stock image comparing a Unicode7 to a String RAISES (ArgumentError, non-Unicode
# argument disallowed in Unicode comparison) rather than answering false. Grail happens to patch
# Unicode7>>= so its own images survive their own setting, but nothing guarantees a customer image
# that sets Unicode16 also carries that patch -- and there every `args at: 'code'` in every toolset
# would be comparing a decoded String key against a Unicode7 literal. Pinning the literals to
# byte Strings makes the installed code identical on every image and keeps that pairing impossible.
#
# Safe to pin because every file under src/ is pure ASCII, and this leaves `fileformat utf8` alone,
# so a non-ASCII byte in a future source file would still be read correctly.
TMP="$(mktemp "${TMPDIR:-/tmp}/mcp-install.XXXXXX")"
set +e
"$TOPAZ" -l 2>&1 <<TPZ | tee "$TMP"
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 exit 1
! Byte-String literals on every image, whatever #StringConfiguration says -- see above.
set sourcestringclass String
run
"Ensure the Published dictionary exists (self-referenced + inserted into the symbol list) so
 the classes' 'inDictionary: Published' resolves during file-in. Create it only if absent --
 Published is standard in most images, so this is usually a no-op."
| up existing d |
up := System myUserProfile.
existing := up resolveSymbol: #Published.
existing isNil
  ifTrue: [
    d := SymbolDictionary new.
    d at: #Published put: d.
    up insertDictionary: d at: up symbolList size + 1.
    System commitTransaction.
    'Published created' ]
  ifFalse: [ 'Published already exists' ].
%
display oops
errorcount
output push load.out only
${GROUP_INPUTS}errorcount
output pop
errorcount
commit
run
"Confirm every class the loaders were supposed to define is really there, and answer a sentinel
 the shell can gate on. A file-in reports its compile errors into load.out and then carries on, so
 topaz's own exit status is not enough -- ask the image what it actually has."
| up names missing |
names := OrderedCollection new.
${CLASS_ADDS}up := System myUserProfile.
missing := names select: [:nm | (up objectNamed: nm asSymbol) isNil ].
missing isEmpty
  ifTrue: [ 'MCP LOAD OK: ' , names size printString , ' classes' ]
  ifFalse: [ 'MCP LOAD FAILED, missing: ' , missing printString ]
%
logout
exit
TPZ
rc=${PIPESTATUS[0]}
set -e
OUT="$(cat "$TMP")"
rm -f "$TMP"

# Gate on the sentinel the verification block returned, not on topaz's exit status: a file-in reports
# its compile errors and carries on, so topaz can exit 0 over a partial load. Match the RESULT line
# topaz prints ("[oop size:N Class] <value>") so the grep cannot match the block's own source, which
# topaz echoes back too.
if ! echo "$OUT" | grep -qE '^\[[0-9]+ size:[0-9]+ +[A-Za-z0-9]+\] MCP LOAD OK'; then
  echo "MCP file-in FAILED (groups: $MCP_GROUPS) -- see load.out for the compiler errors:" >&2
  echo "$OUT" | grep -E '^\[[0-9]+ size:[0-9]+ +[A-Za-z0-9]+\] MCP LOAD FAILED' >&2 || true
  [ "$rc" -ne 0 ] && echo "(topaz also exited $rc)" >&2
  exit 1
fi
[ "$rc" -ne 0 ] && echo "WARNING: topaz exited $rc -- session status was tainted (see above)." >&2
echo "Mcp* classes installed and committed (groups: $MCP_GROUPS)."
