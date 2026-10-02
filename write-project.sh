#!/usr/bin/env bash
# Write the Mcp Rowan project out of the image into this checkout's src/ -- the step that follows
# every change made in the image. The Tonel under src/Mcp-* is what Rowan wrote, never edited by
# hand, so `git diff` after this script is the change.
#
# RUNS IN ITS OWN SESSION, SO IT SEES ONLY COMMITTED CODE. Commit in the session you edited in
# first (the MCP `commit` tool, or `commit` in topaz); uncommitted work there is invisible here.
#
# What it does, in order:
#
#   1. Adopts every new class. A method compiled into a class the project already manages joins
#      that class's package on its own, and a removed method leaves it -- but a class created with
#      the kernel's subclass:... messages (which is what define_class sends) belongs to NO package,
#      and Rowan would silently leave it out of the write. So every Mcp* class in the Mcp
#      dictionary that no package manages is adopted into the package its class category names.
#      One whose category is not a package of this project is reported and left alone. Only the
#      packages this image has LOADED are written: on an image without Grail, src/Mcp-Grail* is
#      left as it is.
#
#   2. Refuses to write unless the project audits clean. An audit failure means the image and
#      Rowan's record of it disagree -- notably a class that was UNBOUND (delete_class) while its
#      package still lists it, which a write would put back on disk. Fix the image (or remove the
#      class from its package through Rowan) and run this again.
#
#   3. Writes the packages. Only src/Mcp-* is written: the project spec, load spec and components
#      under rowan/ are left alone, because the loaded project's copy of the load spec carries the
#      diskUrl install.sh pointed it at.
#
# Commits the adoptions in step 1, which are bookkeeping only -- no code changes.
#
# Configure as for install.sh: GEMSTONE, GS_STONE, GS_USER, GS_PASS, GEMSTONE_GLOBAL_DIR.
set -euo pipefail
cd "$(dirname "$0")"

GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"

. ./gs-env.sh
gs_env_resolve
gs_env_require_stone

TMP="$(mktemp "${TMPDIR:-/tmp}/mcp-write.XXXXXX")"
set +e
"$TOPAZ" -l 2>&1 <<TPZ | tee "$TMP"
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 exit 1
run
"1. Adopt every Mcp* class no package manages into the package its category names."
| project packageNames mcp adopted ignored |
project := Rowan projectNamed: 'Mcp'.
packageNames := project packageNames.
mcp := System myUserProfile objectNamed: #Mcp.
adopted := OrderedCollection new.
ignored := OrderedCollection new.
(mcp values select: [:v | v isBehavior and: [ (v name asString beginsWith: 'Mcp')
    and: [ v rowanPackageName = Rowan unpackagedName ] ] ])
  do: [:cls | | category |
    category := cls category asString.
    (packageNames includes: category)
      ifTrue: [
        Rowan packageTools adopt adoptClassNamed: cls name asString intoPackageNamed: category.
        adopted add: cls name asString , ' -> ' , category ]
      ifFalse: [ ignored add: cls name asString , ' (' , category , ')' ] ].
System commitTransaction.
'MCP ADOPTED ' , adopted size printString , ': ' , adopted asArray printString
  , ' -- not in any package of this project, left alone: ' , ignored asArray printString
%
run
"2. Audit; 3. write the packages only if it is clean. Answer a sentinel the shell can gate on."
| project audit |
project := Rowan projectNamed: 'Mcp'.
audit := project audit.
audit isEmpty
  ifFalse: [ ^ 'MCP WRITE REFUSED, audit: ' , audit printString ].
project _loadedProject asDefinition exportPackages.
'MCP WRITE OK: ' , project packageNames size printString , ' packages to ' , project repositoryRoot pathString
%
logout
exit
TPZ
rc=${PIPESTATUS[0]}
set -e
OUT="$(cat "$TMP")"
rm -f "$TMP"

# Gate on the RESULT line topaz prints ("[oop size:N Class] <value>"), not on the block's own
# source, which topaz echoes back too.
if ! echo "$OUT" | grep -qE '^\[[0-9]+ size:[0-9]+ +[A-Za-z0-9]+\] MCP WRITE OK'; then
  echo "MCP project NOT written:" >&2
  echo "$OUT" | grep -A40 -E '^\[[0-9]+ size:[0-9]+ +[A-Za-z0-9]+\] MCP WRITE REFUSED' >&2 || true
  [ "$rc" -ne 0 ] && echo "(topaz also exited $rc)" >&2
  exit 1
fi
echo "Mcp project written to src/. Review with: git status src/ && git diff src/"
