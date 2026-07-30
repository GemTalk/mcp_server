#!/usr/bin/env bash
# Link a local Keycloak realm to GemStone: trust its JWT signing key, and provision a
# JWT-authenticated UserProfile per user.
#
# Run this AFTER Keycloak is up (~/idp/keycloak-up.sh) and AGAIN after every Stone restart --
# `System addJwtKey:` is in-memory only, so the trusted key does NOT survive a restart. (The
# persistent alternative is STN_OPENID_DISCOVERY_URLS in system.conf; see ~/idp/README.md.)
#
# The realm's signing key is fetched live, so a Keycloak key rotation is handled by re-running this.
#
# Configure (or export before running):
#   GEMSTONE    - GemStone product directory (required)
#   GS_STONE    - stone name          (default: gs64stoneNoGrail)
#   GS_USER     - GemStone admin user (default: DataCurator)
#   GS_PASS     - GemStone password   (default: swordfish)
#   KC_URL      - Keycloak base URL   (default: http://localhost:8080)
#   KC_REALM    - Keycloak realm      (default: gs-mcp)
#   MCP_AUDIENCE- resource identifier the tokens are minted for
#                                     (default: https://localhost:8443/mcp)
#   MCP_USERS   - space-separated userIds to provision (default: "alice bob")
set -euo pipefail
cd "$(dirname "$0")"

: "${GEMSTONE:?Set GEMSTONE to your GemStone product directory}"
GS_STONE="${GS_STONE:-gs64stoneNoGrail}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"
KC_URL="${KC_URL:-http://localhost:8080}"
KC_REALM="${KC_REALM:-gs-mcp}"
MCP_AUDIENCE="${MCP_AUDIENCE:-https://localhost:8443/mcp}"
MCP_USERS="${MCP_USERS:-alice bob}"
TOPAZ="$GEMSTONE/bin/topaz"

ISSUER="$KC_URL/realms/$KC_REALM"
PEM_FILE="$HOME/idp/keycloak-realm-pubkey.pem"

echo "Fetching signing key from $ISSUER ..."
# The realm endpoint exposes the active RS256 signing key as base64 DER; wrap it as a PEM.
curl -sf "$ISSUER" | python3 -c '
import sys, json
pk = json.load(sys.stdin)["public_key"]
body = "\n".join(pk[i:i+64] for i in range(0, len(pk), 64))
print("-----BEGIN PUBLIC KEY-----\n" + body + "\n-----END PUBLIC KEY-----")
' > "$PEM_FILE"

# The kid must match the `kid` header Keycloak stamps on its tokens, or the Stone won't find the key.
KID=$(curl -sf "$ISSUER/protocol/openid-connect/certs" | python3 -c '
import sys, json
keys = json.load(sys.stdin)["keys"]
print(next(k["kid"] for k in keys if k.get("alg") == "RS256" and k.get("use") == "sig"))
')

echo "  issuer:   $ISSUER"
echo "  audience: $MCP_AUDIENCE"
echo "  kid:      $KID"
echo "  users:    $MCP_USERS"
echo "Provisioning in $GS_STONE ..."

USER_LIST=$(printf "'%s' " $MCP_USERS)

"$TOPAZ" -l <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
run
| key kid issuer audience provisioned |
kid := '$KID'.
issuer := '$ISSUER'.
audience := '$MCP_AUDIENCE'.

"Trust the realm's signing key (in-memory; re-run after a Stone restart)."
[System removeJwtKeyWithId: kid] on: Error do: [:e | nil].
key := GsTlsPublicKey newFromPemFile: '$PEM_FILE'.
System addJwtKey: key withId: kid.

"One JWT-authenticated UserProfile per user. userIdKey names the claim carrying the GemStone
 userId: Keycloak's 'sub' is an opaque UUID, so preferred_username is the usable one."
provisioned := OrderedCollection new.
#( $USER_LIST ) do: [:uid | | jwtSec up |
  (AllUsers userWithId: uid ifAbsent: [nil]) ifNotNil: [:u |
    AllUsers removeAndCleanupUserWithId: uid ifAbsent: [nil]].
  jwtSec := JwtSecurityData new.
  jwtSec userIdKey: #preferred_username.
  jwtSec addUserId: uid.
  jwtSec addIssuer: issuer.
  jwtSec addAudience: audience.

  "Assert the audience set ourselves. In 3.7.5 JwtSecurityData>>validateAudiences inspects
   validIssuers instead of validAudiences, so the validate: run inside
   enableJwtAuthenticationWith: cannot catch an empty audience set -- the mistake surfaces much
   later as 'Invalid or missing aud' on every login. This is the check the kernel meant to make."
  JwtSecurityData validateIdentitySetOfSymbols: jwtSec validAudiences
    name: #validAudiences allowEmpty: false.

  up := AllUsers addNewUserWithId: uid password: 'jwtOnly_', uid, '_99'.
  up enableJwtAuthenticationWith: jwtSec.
  provisioned add: uid].
System commitTransaction.
GsFile gciLogServer: 'Provisioned JWT users: ', provisioned asArray printString.
GsFile gciLogServer: 'Trusted key count: ', (System jwtPublicKeys size // 2) printString, ' kid: ', kid.
%
logout
exit
TPZ

echo "Done. Verify with: ./verify-oidc-login.sh"
