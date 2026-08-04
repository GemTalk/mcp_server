#!/usr/bin/env bash
# Launch the OAuth/OIDC network-facing MCP server (McpAuthRouter) in a DEDICATED, DETACHED gem.
#
# Like run-server.sh, but forks an McpAuthRouter configured for an OpenID Connect provider: it
# REQUIRES an `Authorization: Bearer <jwt>` on initialize, validates the token (exp / issuer /
# audience / scope), and logs each worker gem in as the token's OWN GemStone user. The realm config
# lives HERE (built on the router instance, carried in the fork string) -- nothing is committed.
#
# Prereqs: the IdP is up and the GemStone side is provisioned (trusted signing key + per-user JWT
# UserProfiles) -- see ~/idp/README.md and ./setup-oidc-users.sh. Defaults match the local Keycloak.
#
# Configure (or export before running):
#   GEMSTONE            - GemStone product directory (required)
#   GS_STONE/GS_USER/GS_PASS - stone + admin login (defaults: gs64stone/DataCurator/swordfish)
#   GS_MCP_PORT         - listen port (default: 8443)
#   MCP_ISSUER          - OIDC issuer URL (default: http://localhost:8080/realms/gs-mcp)
#   MCP_AUDIENCE        - resource identifier the tokens are minted for (default: https://localhost:8443/mcp)
#   MCP_USERID_CLAIM    - JWT claim carrying the GemStone userId (default: preferred_username)
#   MCP_REQUIRED_SCOPES - space-separated scopes a token MUST carry (default: mcp:use)
#   MCP_WRITE_SCOPE     - scope granting write; a token lacking it gets a READ-ONLY worker (default: none)
#   GS_MCP_READONLY     - 1 to force EVERY session read-only regardless of scope (default: 0)
#   MCP_BIND_ADDRESS    - local address to bind (default: loopback only). Set to an interface address
#                         (e.g. 172.16.73.10) or 0.0.0.0 to accept connections from other hosts.
#                         Safe here precisely because this router requires a bearer token; never do
#                         it with the unauthenticated run-server.sh.
#   MCP_TLS_CERT        - REQUIRED. Path to a PEM certificate (chain) file.
#   MCP_TLS_KEY         - REQUIRED. Path to the matching UNENCRYPTED PEM private key (GsSecureSocket
#                         is given a nil passphrase). Both paths are read by the GEM, so they must
#                         exist on the Stone's machine. McpAuthRouter refuses to run without them.
#                         The certificate's SAN must cover the hostname or IP the client connects
#                         to, or the client will reject the connection.
set -euo pipefail
cd "$(dirname "$0")"

: "${GEMSTONE:?Set GEMSTONE to your GemStone product directory}"
GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"
GS_MCP_PORT="${GS_MCP_PORT:-8443}"
MCP_ISSUER="${MCP_ISSUER:-http://localhost:8080/realms/gs-mcp}"
MCP_AUDIENCE="${MCP_AUDIENCE:-https://localhost:8443/mcp}"
MCP_USERID_CLAIM="${MCP_USERID_CLAIM:-preferred_username}"
MCP_REQUIRED_SCOPES="${MCP_REQUIRED_SCOPES:-mcp:use}"
MCP_WRITE_SCOPE="${MCP_WRITE_SCOPE:-}"
GS_MCP_READONLY="${GS_MCP_READONLY:-0}"
MCP_BIND_ADDRESS="${MCP_BIND_ADDRESS:-}"
MCP_TLS_CERT="${MCP_TLS_CERT:-}"
MCP_TLS_KEY="${MCP_TLS_KEY:-}"
TOPAZ="$GEMSTONE/bin/topaz"

# McpAuthRouter refuses to run without TLS (McpAuthRouter>>requireTls), so fail here with a clear
# message rather than launching topaz only for the router to signal. The code is the real gate; this
# is just a faster, friendlier version of the same rule.
if [ -z "$MCP_TLS_CERT" ] || [ -z "$MCP_TLS_KEY" ]; then
  echo "ERROR: McpAuthRouter requires TLS. Set both MCP_TLS_CERT and MCP_TLS_KEY (the key must be" >&2
  echo "       an UNENCRYPTED PEM, and both paths are read by the GEM, so they must exist on the" >&2
  echo "       Stone's machine). A bearer token is a password and travels in a header on every" >&2
  echo "       request; cleartext is never appropriate. For an unauthenticated cleartext loopback" >&2
  echo "       server, use ./run-server.sh instead." >&2
  exit 1
fi

# Smalltalk array literal of the required scopes: "mcp:use extra" -> 'mcp:use' 'extra'
SCOPES_ST=""
for s in $MCP_REQUIRED_SCOPES; do SCOPES_ST="$SCOPES_ST '$s'"; done

# Optional config statements (blank when unset -- a blank line is fine inside a Smalltalk run block)
WRITE_LINE=""
[ -n "$MCP_WRITE_SCOPE" ] && WRITE_LINE="r writeScope: '$MCP_WRITE_SCOPE'."
RO_LINE=""
[ "$GS_MCP_READONLY" = "1" ] && RO_LINE="r readOnly: true."
BIND_LINE=""
[ -n "$MCP_BIND_ADDRESS" ] && BIND_LINE="r bindAddress: '$MCP_BIND_ADDRESS'."
TLS_LINE=""
[ -n "$MCP_TLS_CERT" ] && [ -n "$MCP_TLS_KEY" ] && \
  TLS_LINE="r useTlsCertificateFile: '$MCP_TLS_CERT' privateKeyFile: '$MCP_TLS_KEY'."

echo "Forking McpAuthRouter onto ${MCP_BIND_ADDRESS:-127.0.0.1}:$GS_MCP_PORT (issuer=$MCP_ISSUER; detached; this script returns)..."
"$TOPAZ" -l <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 stk
run
| r |
r := McpAuthRouter new.
r userIdClaim: '$MCP_USERID_CLAIM';
  expectedIssuer: '$MCP_ISSUER';
  expectedAudience: '$MCP_AUDIENCE';
  requiredScopes: #($SCOPES_ST );
  authorizationServers: #( '$MCP_ISSUER' ).
$WRITE_LINE
$RO_LINE
$BIND_LINE
$TLS_LINE
r forkOnPort: $GS_MCP_PORT
%
logout
exit
TPZ
