#!/usr/bin/env bash
# Provision a GemStone user for a browsing-only MCP server, and let this script's own user mint
# one-time passwords for it.
#
# WHY THIS EXISTS. mcp_server has no read-only mode of its own -- no flag, no list of "safe" tools.
# It cannot have a useful one: execute_code evaluates arbitrary Smalltalk, a test body is arbitrary
# Smalltalk, and a tool that compiles can be followed by one that runs.  So what a session may do is
# decided where it can actually be enforced: in the stone, by the GemStone user the worker gem logs
# in as.  Point a router at the user this script creates:
#
#     MCP_WORKER_USER=McpReadOnly ./run-server.sh
#
# and every worker gem of that router is that user.  docs/read-only-user.md is the
# privilege-by-privilege account -- what each one does, what it costs to withhold, and what is
# STILL open afterwards.  Read it before trusting this to an untrusted client; the short version is
# that this bounds what a session can CHANGE, not what it can READ or how much of the machine it
# can occupy.
#
# Run install.sh FIRST: the worker resolves its toolsets by name out of the Mcp dictionary, so a
# user that cannot see Mcp fails its very first session with 'Toolset not found'.
#
# Configure (or export before running):
#   GEMSTONE      - GemStone product directory (required)
#   GS_STONE      - stone name                        (default: gs64stone)
#   GS_USER       - the FRONT END's GemStone user; the one run-server.sh logs in as, and the one
#                   granted permission to mint one-time passwords for the new user
#                                                     (default: DataCurator)
#   GS_PASS       - that user's password              (default: swordfish)
#   MCP_RO_USER   - the user to create                (default: McpReadOnly)
#   MCP_RO_PRIVS  - space-separated privilege list, overriding the default below.  '' means none.
#   MCP_COPY_SYMBOL_LIST - 1 (default) to give the new user the same symbol list as GS_USER, so the
#                   browsing tools resolve the same names the read-write server resolves.  A symbol
#                   list is name RESOLUTION, not authorization: adding a dictionary lets the user
#                   SEE those names, and changes nothing about what it may write (that is object
#                   security policies) or commit (that is disableCommits, below).  Set 0 to give it
#                   only Mcp plus the profile defaults, and expect list_dictionaries to differ from
#                   what the read-write server answers.
#
# RE-RUNNING IS SAFE and is how you change the privilege set: the user is dropped and recreated.
# Any object it owns is destroyed with it -- which is nothing, if it is only ever used for this.
set -euo pipefail
cd "$(dirname "$0")"

: "${GEMSTONE:?Set GEMSTONE to your GemStone product directory}"
GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"
MCP_RO_USER="${MCP_RO_USER:-McpReadOnly}"
MCP_COPY_SYMBOL_LIST="${MCP_COPY_SYMBOL_LIST:-1}"
TOPAZ="$GEMSTONE/bin/topaz"

# The default set.  Each entry is argued in docs/read-only-user.md; briefly:
#   CodeModification  GRANTED, not withheld -- without it execute_code cannot so much as define a
#                     helper class, and the tool stops being worth having.  It is safe to grant
#                     precisely because nothing this user compiles can ever be committed.
#   NoPerformOnServer withholds System performOnServer: -- running shell commands as the gem's OS
#                     user, which owns the extent files.
#   NoUserAction      withholds user-action/FFI callouts.  Also one of the two that close the
#                     "log in a second gem and commit through it" route.
#   NoGsFileOnServer  withholds server-side file I/O -- reading .setenv and friends is how a
#                     confined session goes looking for a credential.  Closes that route too.
#   NoGsFileOnClient  withholds client-side file I/O, for the same reason.
# Deliberately ABSENT (so the user does not get them): SystemControl, SessionAccess,
# CreateOnetimePassword, ChangeUserId, OtherPassword, FileControl, GarbageCollection,
# ObjectSecurityPolicy*, MigrateObjects, ReadOtherUserProfile.  A new UserProfile has no privileges
# at all, so these are absent by not being listed.
DEFAULT_PRIVS="CodeModification NoPerformOnServer NoUserAction NoGsFileOnServer NoGsFileOnClient"
MCP_RO_PRIVS="${MCP_RO_PRIVS-$DEFAULT_PRIVS}"

# The account has a password because GemStone requires one; nothing uses it.  The front end logs the
# worker in with a ONE-TIME password it mints per session (McpSession>>startWithId:workerUser:), so
# this value is never stored, printed or needed again -- and a random one means a forgotten default
# cannot become the way in.
# (dd/cut rather than the usual `tr </dev/urandom | head -c`: head closes the pipe early, and under
# `set -o pipefail` that SIGPIPE fails the whole script.)
RO_PASS="$(dd if=/dev/urandom bs=512 count=1 2>/dev/null | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-40)"

PRIV_ST=""
for p in $MCP_RO_PRIVS; do PRIV_ST="$PRIV_ST #$p"; done

echo "Provisioning read-only MCP user in $GS_STONE ..."
echo "  user:        $MCP_RO_USER"
echo "  privileges:  ${MCP_RO_PRIVS:-(none)}"
echo "  commits:     disabled at the UserProfile (every session of this user, forked gems included)"
echo "  OTP grant:   $GS_USER may mint one-time passwords for $MCP_RO_USER"
echo "  symbol list: $([ "$MCP_COPY_SYMBOL_LIST" = "1" ] && echo "copied from $GS_USER" || echo "Mcp + profile defaults")"

"$TOPAZ" -l <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
run
| uid up me mcpDict report |
uid := '$MCP_RO_USER'.
me := System myUserProfile.

"Drop and recreate, so re-running is how the privilege set is changed."
(AllUsers userWithId: uid ifAbsent: [nil]) ifNotNil: [:u |
  AllUsers removeAndCleanupUserWithId: uid ifAbsent: [nil]].
up := AllUsers addNewUserWithId: uid password: '$RO_PASS'.

"THE COMMIT LOCK, and the load-bearing half of this script.  Set on the PROFILE rather than asked of
 the session, so it holds from login for EVERY session of this user -- including a gem this one
 forks, which a session-level lock (System disableCommitsWithReason:) would not cover.  A commit
 then raises TransactionError 2249 naming this reason, and nothing reachable from inside such a
 session lifts it: UserProfile>>enableCommits needs OtherPassword, needs a commit to persist, and
 takes effect only at the next login."
up disableCommits.

up privileges: #( $PRIV_ST ).

"The MCP classes live in Mcp, which is NOT in a new profile's default symbol list; a worker gem
 resolves its worker class and toolsets by name, so without this the first session answers
 'Toolset not found'.  Copying the REST of the front-end user's list is what keeps the browsing
 tools answering the same names the read-write server answers -- see MCP_COPY_SYMBOL_LIST."
mcpDict := me objectNamed: #Mcp.
('$MCP_COPY_SYMBOL_LIST' = '1')
  ifTrue: [
    me symbolList do: [:d |
      (up symbolList includesIdentical: d) ifFalse: [
        up insertDictionary: d at: up symbolList size + 1]]]
  ifFalse: [
    (mcpDict notNil and: [(up symbolList includesIdentical: mcpDict) not]) ifTrue: [
      up insertDictionary: mcpDict at: up symbolList size + 1]].
(up symbolList detect: [:d | d name asString = 'Mcp'] ifNone: [nil]) isNil
  ifTrue: [^self error: 'Mcp is not in ' , uid , '''s symbol list -- run ./install.sh first'].

"Let the FRONT END's user mint a one-time password for this one.  This is what lets McpRouter name
 the worker user in ordinary config and carry no credential: the router mints per session
 (GsCurrentSession>>createOnetimePasswordForUserId:validForSeconds:), which the stone allows only
 for a user on the minting user's allowlist.  One committed grant, here."
me addOnetimePasswordUserId: uid.

System commitTransaction.

report := WriteStream on: String new.
report nextPutAll: 'user='; nextPutAll: up userId;
  nextPutAll: ' isReadOnly='; nextPutAll: up isReadOnly printString;
  nextPutAll: ' privileges='; nextPutAll: up privileges asArray printString;
  nextPutAll: ' symbolListSize='; nextPutAll: up symbolList size printString.
report contents
%
logout
exit
TPZ

echo
echo "Done.  Start a browsing-only server with:"
echo "    MCP_WORKER_USER=$MCP_RO_USER ./run-server.sh"
echo "Verify from a client:  status  (reports user=$MCP_RO_USER), then try  commit  -- it must fail."
echo "What this does and does NOT bound: docs/read-only-user.md"
