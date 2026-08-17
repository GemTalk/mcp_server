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
#   MCP_ISSUER          - OIDC issuer URL. MUST be https: McpAuthRouter refuses to advertise a
#                         cleartext authorization server, because "All authorization server endpoints
#                         MUST be served over HTTPS" (the spec's localhost exemption covers redirect
#                         URIs, not AS endpoints). Point this at Keycloak's https listener -- in dev
#                         mode that is https://<host>:8443/realms/gs-mcp, with a self-signed cert.
#                         (default: https://localhost:8443/realms/gs-mcp)
#   MCP_AUDIENCE        - the CANONICAL RESOURCE IDENTIFIER of this server: the exact absolute URL
#                         clients dial, no trailing slash. Required -- the router refuses to start
#                         without it, since token audience validation is not optional. It is also
#                         published as `resource` in the Protected Resource Metadata document and
#                         used to derive the resource_metadata URL, so it must MATCH what clients
#                         actually connect to, INCLUDING a hostname the TLS certificate covers.
#                         (default: https://localhost:8443/mcp)
#   MCP_USERID_CLAIM    - JWT claim carrying the GemStone userId (default: preferred_username)
#   MCP_REQUIRED_SCOPES - space-separated scopes a token MUST carry (default: mcp:use)
#   MCP_EXTRA_SCOPES    - space-separated ADDITIONAL scopes to advertise (default: none). What the
#                         router advertises -- published as scopes_supported and offered in the
#                         WWW-Authenticate scope= -- is DERIVED: MCP_REQUIRED_SCOPES plus
#                         MCP_WRITE_SCOPE plus these, deduplicated. Required and write scopes are
#                         therefore advertised automatically; do not repeat them here. Use this only
#                         for scopes the router does not gate on but the client must still request
#                         from the authorization server -- e.g. "profile" so the userIdClaim is
#                         present in the token.
#   MCP_WRITE_SCOPE     - scope granting write; a token lacking it gets a READ-ONLY worker (default: none).
#                         Advertised automatically so clients can request it -- an unrequestable write
#                         scope would leave every session read-only.
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
MCP_ISSUER="${MCP_ISSUER:-https://localhost:8443/realms/gs-mcp}"
MCP_AUDIENCE="${MCP_AUDIENCE:-https://localhost:8443/mcp}"
MCP_USERID_CLAIM="${MCP_USERID_CLAIM:-preferred_username}"
MCP_REQUIRED_SCOPES="${MCP_REQUIRED_SCOPES:-mcp:use}"
MCP_EXTRA_SCOPES="${MCP_EXTRA_SCOPES:-}"
MCP_WRITE_SCOPE="${MCP_WRITE_SCOPE:-}"
GS_MCP_READONLY="${GS_MCP_READONLY:-0}"
MCP_BIND_ADDRESS="${MCP_BIND_ADDRESS:-}"
MCP_TLS_CERT="${MCP_TLS_CERT:-}"
MCP_TLS_KEY="${MCP_TLS_KEY:-}"
TOPAZ="$GEMSTONE/bin/topaz"

# McpAuthRouter refuses to run without TLS (McpAuthRouter>>requireTls), so fail here with a clear
# message rather than launching topaz only for the router to signal. The code is the real gate; this
# is just a faster, friendlier version of the same rule.
# McpAuthRouter also refuses a cleartext authorization server (requireResourceServerConfig). Fail here
# with a clear message rather than launching topaz only for the router to signal. The code is the real
# gate; this is just a faster, friendlier version of the same rule.
case "$MCP_ISSUER" in
  https://*) ;;
  *)
    echo "ERROR: MCP_ISSUER must be an https URL (got '$MCP_ISSUER'). All authorization server" >&2
    echo "       endpoints MUST be served over HTTPS; the spec's localhost exemption applies to" >&2
    echo "       redirect URIs, not to authorization server endpoints. Point MCP_ISSUER at your" >&2
    echo "       IdP's https listener (Keycloak dev mode: https://<host>:8443/realms/<realm>)." >&2
    exit 1 ;;
esac

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

# Smalltalk array literal of the ADDITIONAL advertised scopes; blank when unset -> the router
# advertises just the union of requiredScopes and writeScope, which it derives on its own.
EXTRA_ST=""
for s in $MCP_EXTRA_SCOPES; do EXTRA_ST="$EXTRA_ST '$s'"; done

# Optional config statements, each its OWN statement rather than a leg of the cascade below, because
# an unset one expands to nothing and a cascade cannot carry an empty leg. None of these can be sent
# unconditionally: writeScope: '' would be a scope no token carries (every session read-only, not
# ungated) and bindAddress: '' is not loopback, so "unset" has to mean "never sent" and let
# McpAuthRouter>>initialize supply the default. TLS is NOT here -- it is required, so it joins the
# cascade; a guard on it would be unreachable after the check above.
EXTRA_LINE=""
[ -n "$MCP_EXTRA_SCOPES" ] && EXTRA_LINE="r extraScopes: #($EXTRA_ST )."
WRITE_LINE=""
[ -n "$MCP_WRITE_SCOPE" ] && WRITE_LINE="r writeScope: '$MCP_WRITE_SCOPE'."
RO_LINE=""
[ "$GS_MCP_READONLY" = "1" ] && RO_LINE="r readOnly: true."
BIND_LINE=""
[ -n "$MCP_BIND_ADDRESS" ] && BIND_LINE="r bindAddress: '$MCP_BIND_ADDRESS'."

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
  authorizationServers: #( '$MCP_ISSUER' );
  useTlsCertificateFile: '$MCP_TLS_CERT' privateKeyFile: '$MCP_TLS_KEY'.
$EXTRA_LINE
$WRITE_LINE
$RO_LINE
$BIND_LINE
r forkOnPort: $GS_MCP_PORT
%
logout
exit
TPZ
