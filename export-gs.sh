#!/usr/bin/env bash
# Export the Mcp Rowan project from this checkout as ONE topaz file-out, for images without Rowan --
# the stock extent0.dbf a 3.7.x installation runs on. Install the result with
#   ./install.sh --from-gs <file>
#
#   usage: ./export-gs.sh [OUTPUT]       (default: mcp_server.gs, in this checkout; gitignored)
#
# NEEDS NO STONE. The export runs GemStone's own rowan3/bin/exportRowanProjectAsTopaz.solo, a solo
# session that reads the Tonel from disk through the load spec; nothing is loaded and nothing is
# committed anywhere. All it needs is GEMSTONE pointing at a product tree that ships Rowan 3 -- 3.7.5,
# 3.7.6 and 4.0 all do.
#
# WHAT IS IN IT. The load spec's default components, Core + Auth: the server, the OAuth/OIDC front
# end, and both packages of unit tests -- every class `inDictionary: Mcp`, which is why install.sh
# creates that dictionary before filing it in. Not the Grail component, which needs Rowan and 4.0
# anyway. Each class's methods are removed before its methods are compiled (the exporter's
# --includeRemoveAllMethods), so filing a newer file-out over an older install drops what was
# dropped. No class has a class-side initialize, so the file carries no initializer doits.
#
# THE SAME TONEL GIVES THE SAME FILE ON EVERY VERSION. Measured 2026-10-18: exported with 3.7.5,
# 3.7.6 and 4.0.0.a5, the three files were byte-identical. Which product exports it does not matter;
# which product it is filed into is what the tests decide.
#
# The file is generated, never edited and never committed: CI exports it fresh for every 3.7.x leg,
# and a release attaches it to the GitHub Release.
set -euo pipefail
cd "$(dirname "$0")"
REPO="$(pwd -P)"

OUT="${1:-mcp_server.gs}"
case "$OUT" in /*) ;; *) OUT="$REPO/$OUT" ;; esac

if [ -z "${GEMSTONE:-}" ]; then
  echo "error: GEMSTONE is not set. Point it at a GemStone product directory that ships Rowan 3." >&2
  exit 1
fi
EXPORTER="$GEMSTONE/rowan3/bin/exportRowanProjectAsTopaz.solo"
if [ ! -x "$EXPORTER" ] || [ ! -x "$GEMSTONE/bin/superdoit_rowan3_solo" ]; then
  echo "error: GEMSTONE=$GEMSTONE has no Rowan 3 exporter ($EXPORTER" >&2
  echo "       and bin/superdoit_rowan3_solo). Use a 3.7.5 or later product tree." >&2
  exit 1
fi

# The literal the server reports as serverInfo.version, read from the Tonel so the header cannot
# disagree with the code it describes.
VERSION="$(awk '/^McpServer class >> defaultServerVersion \[/ { f = 1; next }
                f && match($0, /\^\047[^\047]*\047/) { print substr($0, RSTART + 2, RLENGTH - 3); exit }' \
             src/Mcp-Core/McpServer.class.st)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
if [ "$COMMIT" != unknown ] && [ -n "$(git status --porcelain -- rowan src 2>/dev/null)" ]; then
  COMMIT="$COMMIT, with uncommitted changes"
fi

# The exporter's shebang names superdoit_rowan3_solo, which it finds on PATH. It is run from a
# scratch directory because a solo session may leave files in its working directory.
WORK="$(mktemp -d "${TMPDIR:-/tmp}/mcp-export.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
(
  cd "$WORK"
  PATH="$GEMSTONE/bin:$PATH" "$EXPORTER" "file:$REPO/rowan/specs/Mcp.ston" "$WORK/body.gs" \
    --projectsHome="$(dirname "$REPO")" --projectAlias="$(basename "$REPO")" \
    --includeRemoveAllMethods
)
if [ ! -s "$WORK/body.gs" ]; then
  echo "error: the exporter wrote nothing -- see its output above." >&2
  exit 1
fi

{
  echo "! mcp_server $VERSION -- topaz file-out of the Rowan project Mcp, components Core + Auth."
  echo "! Exported from commit $COMMIT by export-gs.sh. Generated: do not edit."
  echo "! Install with:  ./install.sh --from-gs $(basename "$OUT")"
  echo "! Every class is defined inDictionary: Mcp, which must exist first -- install.sh creates it."
  echo "!"
  cat "$WORK/body.gs"
} >"$OUT"
echo "Wrote $OUT ($(grep -cE '^(class)?method: ' "$OUT") methods; mcp_server $VERSION, commit $COMMIT)."
