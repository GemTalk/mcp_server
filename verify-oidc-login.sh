#!/usr/bin/env bash
# Prove the Keycloak -> GemStone identity bridge works, without involving the MCP server at all:
# mint a real token per user, then log a GemStone session in with `jwtPassword:`.
#
# Also checks the security property that matters: a token for one user must NOT authenticate a
# login as another user. GemStone validates the token against the *named* user's JwtSecurityData,
# so a stolen/replayed token cannot be pointed at a different account.
#
# Prereqs: Keycloak up (~/idp/keycloak-up.sh) and ./setup-oidc-users.sh already run.
#   GEMSTONE / GS_STONE / GS_USER / GS_PASS as in setup-oidc-users.sh
set -euo pipefail
cd "$(dirname "$0")"

: "${GEMSTONE:?Set GEMSTONE to your GemStone product directory}"
GS_STONE="${GS_STONE:-gs64stoneNoGrail}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"
TOPAZ="$GEMSTONE/bin/topaz"

ALICE_TOK=$(~/idp/mint-token.sh alice)
BOB_TOK=$(~/idp/mint-token.sh bob)
printf '%s' "$ALICE_TOK" > /tmp/gs-mcp-alice.jwt
printf '%s' "$BOB_TOK"   > /tmp/gs-mcp-bob.jwt
trap 'rm -f /tmp/gs-mcp-alice.jwt /tmp/gs-mcp-bob.jwt' EXIT

echo "Verifying JWT logins against $GS_STONE ..."

"$TOPAZ" -l <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
run
| readTok try checks |
readTok := [:path | | f t | f := GsFile openReadOnServer: path. t := f contents trimSeparators. f close. t].
try := [:userId :tok | | sess r |
  sess := GsTsExternalSession newDefault.
  r := [sess username: userId; jwtPassword: tok; login.
        'OK as ', (sess executeString: 'System myUserProfile userId')]
    on: Error do: [:e | 'REJECTED'].
  [sess logout] on: Error do: [:e | nil].
  r].
checks := OrderedCollection new.
checks add: 'alice token -> login as alice (expect OK)      : ',
  (try value: 'alice' value: (readTok value: '/tmp/gs-mcp-alice.jwt')).
checks add: 'bob   token -> login as bob   (expect OK)      : ',
  (try value: 'bob' value: (readTok value: '/tmp/gs-mcp-bob.jwt')).
checks add: 'bob   token -> login as alice (expect REJECTED): ',
  (try value: 'alice' value: (readTok value: '/tmp/gs-mcp-bob.jwt')).
checks add: 'alice token -> login as bob   (expect REJECTED): ',
  (try value: 'bob' value: (readTok value: '/tmp/gs-mcp-alice.jwt')).
checks do: [:line | GsFile gciLogServer: line].
%
logout
exit
TPZ
