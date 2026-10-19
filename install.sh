#!/usr/bin/env bash
# Install the native GemStone MCP server into the image -- as the Rowan project 'Mcp' by default, or
# from a topaz file-out with --from-gs.
#
# Logs in via topaz, ensures the Mcp dictionary exists and is in every user's symbol list, clears
# any stale binding of these classes left by an older install, loads the code, and commits. Two ways
# to load it, for two audiences:
#
#   * THE ROWAN PROJECT (default) -- from this checkout, through rowan/specs/Mcp.ston. REQUIRES AN
#     IMAGE WITH ROWAN 3 -- start the stone on $GEMSTONE/bin/extent0.rowan3.dbf -- and fails up
#     front, saying so, on one without. This is how the project is developed, and the only way to
#     get the Grail component.
#   * A TOPAZ FILE-OUT (--from-gs FILE) -- the single .gs that export-gs.sh writes from the same
#     Tonel, and that each release publishes. Needs no Rowan: it is for the stock extent0.dbf that a
#     3.7.x installation runs on.
#
# THE CLASSES LIVE IN THEIR OWN DICTIONARY, `Mcp` -- the load spec's default symbol dictionary, and
# the `inDictionary: Mcp` of every class in the file-out. Rowan creates it for the loading user; the
# first `run` block below creates it too and puts it in every other user's symbol list, which Rowan
# does not -- and which a file-out needs before its first class definition can even compile.
#
# The project has three load components (rowan/components): Core -- the server and its unit tests,
# always loaded -- Auth, the OAuth/OIDC front end, and Grail, the optional GemStone-Python toolset,
# both selected below. The load spec's own default is Core + Auth; Grail is added only on --grail.
# A file-out carries exactly that default, Core + Auth.
#
# MIGRATING BETWEEN THE TWO. A Rowan load unbinds every class of these names that Rowan does not
# manage -- a file-out install, in Mcp or anywhere else -- so the load defines them afresh. A
# file-out install goes the other way only as far as it safely can: it unbinds stale bindings
# OUTSIDE Mcp, files in over its own earlier install (each class's methods are removed first, so a
# method dropped since is dropped here too), and REFUSES an image where Rowan manages these classes,
# because topaz cannot file in over a Rowan-managed class ("Duplicate definition", error 2318).
#
#   --from-gs FILE
#             install from the topaz file-out FILE instead of the Rowan project. Takes none of
#             the component flags below: the file is Core + Auth, and Auth needs the kernel JWT
#             classes every supported version has (3.7.5 and later).
#
#   --grail   ALSO load the optional GemStone-Python toolset (the Grail component). Only valid on an image
#             that has Grail/ModuleAst -- those methods reference ModuleAst and BaseException and
#             cannot compile without it. Equivalently, set MCP_WITH_GRAIL=1. Opt-in rather than
#             detected because it cannot be detected safely: unlike the JWT classes the auth group
#             needs, ModuleAst present does not mean the Grail this toolset was written against.
#             Loading it is inert -- McpGrailToolset is NOT in the default tool surface (see
#             McpServer class>>defaultToolsetNames), and no server gets these tools until its router
#             names the toolset. Having it in the image and running it are separate decisions.
#
#   --auth    require the OAuth/OIDC front end (the Auth component); fail if this image cannot
#             compile it.
#   --no-auth skip it.
#             Neither flag is normally needed. By DEFAULT the Auth component is loaded when the image
#             can take it and skipped when it cannot, because McpAuthRouter needs kernel JWT classes
#             (JsonWebToken, JwtSecurityData) and GsTsExternalSession>>jwtPassword:, which arrived
#             after 3.7.2 -- on 3.7.2 those methods cannot compile at all. Detecting rather than
#             asking is safe here precisely because loading McpAuthRouter IS inert: it is a class
#             nothing instantiates until you fork one with run-auth-server.sh. Use --auth when you
#             would rather fail loudly than quietly get a server with no authentication available,
#             and --no-auth to leave it out of an image that could take it.
#
#   --check   verify the environment (product, GEMSTONE_GLOBAL_DIR, the stone), report what would be
#             loaded, and install nothing. Run this first on a new machine.
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

# Resolved before the cd below, so a relative --from-gs path means what the caller meant by it.
usage() {
  echo "usage: $0 [--auth|--no-auth] [--grail] [--check]" >&2
  echo "       $0 --from-gs FILE [--check]" >&2
  exit 2
}
GS_FILE=""
WANT_AUTH="auto"      # auto | yes | no
WANT_GRAIL=0
CHECK_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --from-gs) [ $# -ge 2 ] || usage; GS_FILE="$2"; shift ;;
    --grail)   WANT_GRAIL=1 ;;
    --auth)    WANT_AUTH="yes" ;;
    --no-auth) WANT_AUTH="no" ;;
    --check)   CHECK_ONLY=1 ;;
    *) usage ;;
  esac
  shift
done
[ -n "${MCP_WITH_GRAIL:-}" ] && WANT_GRAIL=1
if [ -n "$GS_FILE" ]; then
  if [ "$WANT_GRAIL" = "1" ] || [ "$WANT_AUTH" != "auto" ]; then
    echo "error: --from-gs takes none of --grail, --auth or --no-auth. The file-out is Core + Auth;" >&2
    echo "       the Grail component is loaded only through Rowan." >&2
    exit 2
  fi
  if [ ! -r "$GS_FILE" ]; then
    echo "error: cannot read the file-out '$GS_FILE'." >&2
    exit 1
  fi
  GS_FILE="$(cd "$(dirname "$GS_FILE")" && pwd -P)/$(basename "$GS_FILE")"
fi

cd "$(dirname "$0")"

GS_STONE="${GS_STONE:-gs64stone}"
GS_USER="${GS_USER:-DataCurator}"
GS_PASS="${GS_PASS:-swordfish}"

# Resolve GEMSTONE/TOPAZ/GEMSTONE_GLOBAL_DIR and confirm the stone is actually running, so a
# misconfigured environment is reported in its own terms instead of as a topaz login failure.
. ./gs-env.sh
gs_env_resolve

# Settle what will be loaded before anything is, so an image that cannot take it is reported here
# rather than as a wall of compile errors in load.out. Rowan first: without it there is no load at
# all. Then JsonWebToken, which stands in for the whole Auth component: it is the one McpAuthRouter
# itself names (in tokenRejectionFor:, userIdFromToken: and payloadOf:), and an image with it has
# JwtSecurityData and jwtPassword: too.
mcp_select_components() {
  local have
  if [ -z "$GS_FILE" ]; then
    gs_env_image_has Rowan && have=0 || have=$?
    case "$have" in
      0) ;;
      1) echo "error: this image has no Rowan, so the Mcp project cannot be loaded into it. Start the" >&2
         echo "       stone on a Rowan 3 extent -- copydbf \$GEMSTONE/bin/extent0.rowan3.dbf -- and" >&2
         echo "       install into that, or install a release's topaz file-out with --from-gs." >&2
         echo "       (stone: $GS_STONE)" >&2
         return 1 ;;
      *) return 1 ;;   # gs_env_image_has has already said why
    esac
  fi

  if [ "$WANT_AUTH" = "no" ]; then
    AUTH_NOTE="skipped (--no-auth)"
  else
    gs_env_image_has JsonWebToken && have=0 || have=$?
    case "$have" in
      0) AUTH_NOTE="yes" ;;
      1) if [ -n "$GS_FILE" ]; then
           echo "error: this image has no JsonWebToken, and the file-out carries the Auth component," >&2
           echo "       which cannot compile without it. Every supported version (3.7.5 and later)" >&2
           echo "       has it. (stone: $GS_STONE)" >&2
           return 1
         fi
         if [ "$WANT_AUTH" = "yes" ]; then
           echo "error: --auth was given, but this image has no JsonWebToken, so the Auth component" >&2
           echo "       cannot compile here. Kernel JWT support arrived after 3.7.2; McpAuthRouter" >&2
           echo "       needs JsonWebToken and JwtSecurityData, and a JWT worker login additionally" >&2
           echo "       needs GsTsExternalSession>>jwtPassword:. Install on 3.7.5 or later for the" >&2
           echo "       authenticating front end, or drop --auth to install the rest without it." >&2
           echo "       (stone: $GS_STONE)" >&2
           return 1
         fi
         AUTH_NOTE="skipped (no kernel JWT support in this image)" ;;
      *) return 1 ;;
    esac
  fi

  # The class names the migration and the post-load check look for, derived from the source rather
  # than from a list kept in step by hand. One `add:` per line: a generated `#( ... )` literal would
  # put a '(' at the start of a heredoc line, which bash 3.2 (macOS) mis-parses inside a command
  # substitution.
  local c p f b
  CLASS_ADDS=""
  if [ -n "$GS_FILE" ]; then
    # From the file-out itself, so it describes what it will actually define rather than what this
    # checkout happens to hold. Rowan's exporter writes every class declaration as a `doit` whose
    # first two lines are `(Superclass` and a tab-indented `subclass: 'Name'`; matching the pair
    # keeps a `subclass:` quoted inside a method body (the tests have several) out of the list.
    MCP_COMPONENTS="Core Auth (from $(basename "$GS_FILE"))"
    for b in $(awk 'prev ~ /^\([A-Za-z0-9_]+$/ && /^\tsubclass: \047[A-Za-z0-9_]+\047$/ {
                      s = $0; sub(/^\tsubclass: \047/, "", s); sub(/\047$/, "", s); print s }
                    { prev = $0 }' "$GS_FILE"); do
      CLASS_ADDS="${CLASS_ADDS}names add: '$b'.
"
    done
    if [ -z "$CLASS_ADDS" ]; then
      echo "error: '$GS_FILE' declares no classes -- it is not a file-out written by export-gs.sh." >&2
      return 1
    fi
    return 0
  fi

  MCP_COMPONENTS="Core"
  MCP_PACKAGES="Mcp-Core Mcp-Tests"
  if [ "$AUTH_NOTE" = "yes" ]; then
    MCP_COMPONENTS="$MCP_COMPONENTS Auth"
    MCP_PACKAGES="$MCP_PACKAGES Mcp-Auth Mcp-Auth-Tests"
  fi
  if [ "$WANT_GRAIL" = "1" ]; then
    MCP_COMPONENTS="$MCP_COMPONENTS Grail"
    MCP_PACKAGES="$MCP_PACKAGES Mcp-Grail Mcp-Grail-Tests"
  fi

  # The component names the load asks for, and -- since every Tonel package holds exactly one
  # .class.st file per class, so the file names ARE the manifest -- the class names. Adding a class
  # to a package needs no edit here.
  COMPONENT_ADDS=""
  for c in $MCP_COMPONENTS; do
    COMPONENT_ADDS="${COMPONENT_ADDS}components add: '$c'.
"
  done
  for p in $MCP_PACKAGES; do
    for f in src/$p/*.class.st; do
      b="$(basename "$f" .class.st)"
      CLASS_ADDS="${CLASS_ADDS}names add: '$b'.
"
    done
  done
}

if [ "$CHECK_ONLY" = "1" ]; then
  gs_env_check || exit $?
  mcp_select_components || exit 1
  echo
  echo "auth         $AUTH_NOTE"
  echo "components   $MCP_COMPONENTS"
  exit 0
fi
gs_env_require_stone
mcp_select_components
echo "Loading Mcp: components $MCP_COMPONENTS  (auth: $AUTH_NOTE)"

# Rowan reads the project from this checkout, so it is named by absolute path.
REPO="$(pwd -P)"

# The topaz script, in sections: login and the Mcp dictionary, then the migration and the load --
# which differ between a Rowan load and a file-out -- then the check both end with.
#
# WHY `set sourcestringclass String` BELOW. Topaz reads `Globals at: #StringConfiguration` at login
# and reconfigures itself to match, announcing it in the banner:
#
#   successful login
#    fileformat is now utf8
#   sourcestringclass is now Unicode16
#
# On such an image EVERY string literal in every method filed in by topaz compiles as a Unicode7
# rather than a byte String. In practice it is Grail that sets it: installing Grail leaves
# #StringConfiguration = Unicode16, so a Grail image and a stock image compile the same source into
# different literal classes. We pin it so that the installed code is identical on every image. It
# governs what TOPAZ compiles -- the doits here, and the whole of a file-out. Whether Rowan's own
# compile of the Tonel honours it is unverified: the only images that set Unicode16 are Grail images.
#
# NOT because comparison would otherwise raise. #StringConfiguration drives BOTH halves: set to
# Unicode16 it makes literals compile as Unicode7 AND has GsCurrentSession>>initialize install
# unicode-aware #= for String and the Unicode classes alike (Unicode16 class>>_unicodeCompareMapping),
# so a Unicode7 literal compares correctly with a decoded String on exactly the images where such
# literals arise. What DOES raise is a Unicode string reaching a stock (String-configured) image,
# which is why McpBase class>>parseBody: narrows with #asString after #decodeFromUTF8 -- see the
# Unicode trap in section 5 of the kernel JSON Unicode report.
#
# Safe to pin because every source file is pure ASCII, and this leaves `fileformat utf8` alone, so a
# non-ASCII byte in a future source file would still be read correctly.
mcp_topaz_prelude() {
  cat <<TPZ
set gemstone $GS_STONE
set username $GS_USER
set password $GS_PASS
login
iferr 1 exit 1
! Byte-String literals on every image, whatever #StringConfiguration says -- see above.
set sourcestringclass String
run
"Ensure the Mcp dictionary exists, and that every user who might run a gem can see it.

 WHY EVERY USER. A worker gem may log in as a DIFFERENT user than the front end -- under
 McpAuthRouter it logs in as the token's own GemStone user -- and a worker resolves its worker class
 and its toolsets BY NAME at runtime (McpServer class>>toolsetClassNamed:). A user without Mcp in
 their symbol list would get 'Toolset not found' on every session. Rowan adds the dictionary to the
 LOADING user's symbol list only, so this has to happen here either way.

 The dictionary is created SELF-REFERENCED under #Mcp because that is what names it:
 SymbolDictionary>>name answers 'self keyAtValue: self'. That is also why the dictionary cannot be
 called McpServer -- installing the class of that name into it would overwrite the self-reference
 and leave the dictionary nameless. Rowan loads into this same dictionary: the load spec names it
 as the default, and Rowan uses a dictionary of that name already in the symbol list. A file-out
 names it too: every class it defines is \`inDictionary: Mcp\`.

 Adding Mcp to other users is best effort. GemStone's own system users (SystemUser, SymbolUser,
 HostAgentUser) refuse with a SecurityError, which is expected and not fatal: none of them ever
 runs a worker gem. They are listed so a refusal for a user that DOES matter is visible."
| up d created touched refused |
up := System myUserProfile.
d := up objectNamed: #Mcp.
created := d isNil.
created ifTrue: [
  d := SymbolDictionary new.
  d at: #Mcp put: d.
  up insertDictionary: d at: up symbolList size + 1 ].
touched := OrderedCollection new.
refused := OrderedCollection new.
AllUsers do: [:profile | | seen |
  seen := profile symbolList detect: [:e | e == d] ifNone: [nil].
  seen isNil ifTrue: [
    [ profile insertDictionary: d at: profile symbolList size + 1.
      touched add: profile userId ]
      on: Error
      do: [:ex | refused add: profile userId ] ] ].
System commitTransaction.
'Mcp ' , (created ifTrue: [ 'created' ] ifFalse: [ 'already exists' ])
  , '; symbol list added for ' , touched asArray printString
  , (refused isEmpty
      ifTrue: [ '' ]
      ifFalse: [ '; not permitted for ' , refused asArray printString
        , ' -- expected: those are GemStone system users, and none of them runs a worker gem' ])
%
display oops
errorcount
TPZ
}

mcp_topaz_rowan_load() {
  cat <<TPZ
run
"MIGRATION: drop every binding of a class this install defines that Rowan does not manage.
 Two kinds of leftover, both from installs that predate the Rowan project:
   * a binding in a dictionary OTHER than Mcp -- these classes lived in Published until 2026-09-06.
     Published precedes Mcp in the symbol list, so a leftover there would WIN at compile time and
     every method loaded below would bind to the old class.
   * a binding IN Mcp of a class that belongs to no Rowan package -- a file-out install.
     Loading the project over it would leave Rowan-managed and unmanaged classes mixed.
 A class the Mcp project already manages is left alone: Rowan updates it in place.

 Unbinding is the whole of deleting a class here: GemStone's ClassOrganizer is built from the
 symbol list, so an unbound class stops being a subclass of its superclass for every purpose that
 matters (this is also all that delete_class does).

 Only the exact names this install defines are removed. Anything else beginning with 'Mcp' is
 REPORTED and left alone: it may be a third party's toolset, which is not ours to delete."
| up mcp names removed shadows |
up := System myUserProfile.
mcp := up objectNamed: #Mcp.
names := OrderedCollection new.
${CLASS_ADDS}removed := OrderedCollection new.
shadows := OrderedCollection new.
up symbolList do: [:d | | where |
  where := d name asString.
  names do: [:nm | | sym cls |
    sym := nm asSymbol.
    cls := d at: sym ifAbsent: [ nil ].
    (cls notNil and: [ d ~~ mcp or: [ cls isBehavior and: [ cls rowanPackageName = Rowan unpackagedName ] ] ])
      ifTrue: [
        [ d removeKey: sym. removed add: where , '.' , nm ]
          on: Error
          do: [:ex | removed add: where , '.' , nm , ' FAILED: ' , ex description ] ] ].
  d == mcp ifFalse: [
    d keys do: [:k | | ks isOurs isShadow |
      ks := k asString.
      isOurs := names includes: ks.
      isShadow := isOurs not and: [ ks size > 2 and: [ (ks copyFrom: 1 to: 3) = 'Mcp' ] ].
      isShadow ifTrue: [ shadows add: where , '.' , ks ] ] ] ].
System commitTransaction.
'MCP MIGRATION removed ' , removed size printString , ': ' , removed asArray printString
  , ' -- other Mcp* keys left alone: ' , shadows asArray printString
%
display oops
errorcount
output push load.out only
run
"Load the project from this checkout. The load spec's gitUrl is for loading straight from GitHub;
 diskUrl points this load at the working tree instead, so what loads is exactly what is checked out.
 RwSpecification is not in an ordinary user's symbol list -- only Rowan is -- so it is found the way
 the product's own rowan3/bin/installProject.stone finds it.

 GRAIL WORKAROUND. Each src/Mcp-*/package.st holds the Tonel marker literal
 \`Package { #name : '...' }\`, and Rowan's reader resolves that class name through the loading user's
 symbol list. Grail defines its OWN Package (in PythonAst, a ModuleAst subclass -- a Python AST
 node), and the Python dictionaries precede Globals, so on a Grail image Rowan gets an AST node and
 the load dies with 'a Package does not understand #at:ifAbsent:' before any of our code loads.
 So the #Package BINDING is moved out of the way for the load and put back afterwards -- the one
 key, NOT the whole dictionary: hiding all of PythonAst also hides ModuleAst, which the Grail
 component needs to compile. Name resolution matters only while compiling, so compiled Grail methods are unaffected.
 The load runs under on:do: rather than ensure: ON PURPOSE: topaz's \`iferr 1 exit 1\` ends the
 session AT the error, so an ensure: never runs, and a failed load would leave the image with no
 Package. If a crash ever does leave it out, restore it by hand with
   (that dictionary) at: #Package put: <the class>   'PythonAst, a ModuleAst subclass'
 On an image without Grail, objectNamed: #Package is nil and this is a plain load. Take it out when
 Rowan resolves the marker robustly or Grail renames its class."
| up shadow shadowed specClass spec components result |
up := System myUserProfile.
shadow := (up objectNamed: #Package) isNil
  ifTrue: [ nil ]
  ifFalse: [ up symbolList detect: [:d | d includesKey: #Package ] ifNone: [ nil ] ].
shadowed := shadow isNil ifTrue: [ nil ] ifFalse: [ shadow at: #Package ].
shadow ifNotNil: [ shadow removeKey: #Package. System commitTransaction ].
components := OrderedCollection new.
${COMPONENT_ADDS}result := [
  specClass := (Rowan globalNamed: 'RwSpecification')
    ifNil: [ (AllUsers userWithId: 'SystemUser') objectNamed: 'RwSpecification' ].
  spec := specClass fromUrl: 'file:$REPO/rowan/specs/Mcp.ston'.
  spec diskUrl: 'file:$REPO'.
  spec componentNames: components asArray.
  spec resolve load.
  System commitTransaction.
  'MCP ROWAN LOAD: ' , components asArray printString
] on: Error do: [:ex |
  System abortTransaction.
  'MCP ROWAN LOAD FAILED: ' , ([ ex description ] on: Error do: [:x | ex class name asString ]) ].
shadow ifNotNil: [ shadow at: #Package put: shadowed. System commitTransaction ].
result , (shadow isNil
  ifTrue: [ '' ]
  ifFalse: [ ' (moved ' , shadow name asString , ' #Package aside; restored)' ])
%
errorcount
output pop
errorcount
commit
TPZ
}

mcp_topaz_gs_load() {
  cat <<TPZ
run
"MIGRATION, for a file-out: refuse an image where Rowan manages these classes, then drop every
 binding of them OUTSIDE Mcp.

 Rowan-managed classes cannot be filed in over: topaz stops at the first method with 'Duplicate
 definition' (error 2318). Such an image was installed from the Rowan project and should be updated
 the same way -- install.sh without --from-gs. Rowan is reached by perform: so this compiles on an
 image that has no Rowan at all, which is the image a file-out is for.

 A binding outside Mcp is a leftover from before 2026-09-06, when these classes lived in Published.
 Published precedes Mcp in the symbol list, so a leftover there would WIN at compile time and every
 method filed in below would bind to the old class. A binding IN Mcp is an earlier install of this
 same file-out, and is filed in over: the file removes each class's methods before compiling them,
 so a method dropped since does not survive.

 Only the exact names this install defines are removed. Anything else beginning with 'Mcp' is
 REPORTED and left alone: it may be a third party's toolset, which is not ours to delete."
| up mcp rowan names managed removed shadows |
up := System myUserProfile.
mcp := up objectNamed: #Mcp.
rowan := up objectNamed: #Rowan.
names := OrderedCollection new.
${CLASS_ADDS}managed := rowan isNil
  ifTrue: [ #() ]
  ifFalse: [ names select: [:nm | | cls |
    cls := mcp at: nm asSymbol ifAbsent: [ nil ].
    cls notNil and: [ (cls perform: #rowanPackageName) ~= (rowan perform: #unpackagedName) ] ] ].
managed isEmpty ifFalse: [
  ^ Error signal: 'MCP LOAD REFUSED: Rowan manages ' , managed size printString
    , ' of these classes, and a file-out cannot be filed in over them. Install without --from-gs.' ].
removed := OrderedCollection new.
shadows := OrderedCollection new.
up symbolList do: [:d | | where |
  where := d name asString.
  d == mcp ifFalse: [
    names do: [:nm | | sym |
      sym := nm asSymbol.
      (d includesKey: sym) ifTrue: [
        [ d removeKey: sym. removed add: where , '.' , nm ]
          on: Error
          do: [:ex | removed add: where , '.' , nm , ' FAILED: ' , ex description ] ] ].
    d keys do: [:k | | ks isOurs isShadow |
      ks := k asString.
      isOurs := names includes: ks.
      isShadow := isOurs not and: [ ks size > 2 and: [ (ks copyFrom: 1 to: 3) = 'Mcp' ] ].
      isShadow ifTrue: [ shadows add: where , '.' , ks ] ] ] ].
System commitTransaction.
'MCP MIGRATION removed ' , removed size printString , ': ' , removed asArray printString
  , ' -- other Mcp* keys left alone: ' , shadows asArray printString
%
display oops
errorcount
output push load.out only
input $GS_FILE
errorcount
output pop
errorcount
commit
TPZ
}

# AUDIT is the project's own consistency check after a Rowan load; a file-out has no project.
mcp_topaz_verify() {
  local audit="#()"
  [ -z "$GS_FILE" ] && audit="(Rowan projectNamed: 'Mcp') audit"
  cat <<TPZ
run
"Confirm every class that was supposed to load is really there, that the project audits clean, and
 answer a sentinel the shell can gate on. A load can report errors and carry on, so topaz's own exit
 status is not enough -- ask the image what it actually has."
| up names missing audit |
names := OrderedCollection new.
${CLASS_ADDS}up := System myUserProfile.
missing := names select: [:nm | (up objectNamed: nm asSymbol) isNil ].
audit := $audit.
(missing isEmpty and: [ audit isEmpty ])
  ifTrue: [ 'MCP LOAD OK: ' , names size printString , ' classes' ]
  ifFalse: [ 'MCP LOAD FAILED, missing: ' , missing printString , '; audit: ' , audit size printString ]
%
logout
exit
TPZ
}

# Stream topaz's output live AND keep a copy to gate on. Do NOT wrap this in $( ... ): under
# `set -e` a command substitution that exits non-zero aborts the script before anything is printed,
# hiding the very output you need to diagnose the load. Tee to a temp file instead.
TMP="$(mktemp "${TMPDIR:-/tmp}/mcp-install.XXXXXX")"
set +e
{
  mcp_topaz_prelude
  if [ -n "$GS_FILE" ]; then mcp_topaz_gs_load; else mcp_topaz_rowan_load; fi
  mcp_topaz_verify
} | "$TOPAZ" -l 2>&1 | tee "$TMP"
rc=${PIPESTATUS[1]}
set -e
OUT="$(cat "$TMP")"
rm -f "$TMP"

# Gate on the sentinel the verification block returned, not on topaz's exit status: a load reports
# its errors and carries on, so topaz can exit 0 over a partial load. Match the RESULT line topaz
# prints ("[oop size:N Class] <value>") so the grep cannot match the block's own source, which topaz
# echoes back too.
if ! echo "$OUT" | grep -qE '^\[[0-9]+ size:[0-9]+ +[A-Za-z0-9]+\] MCP LOAD OK'; then
  echo "MCP load FAILED (components: $MCP_COMPONENTS) -- see load.out for the errors:" >&2
  echo "$OUT" | grep -E '^\[[0-9]+ size:[0-9]+ +[A-Za-z0-9]+\] MCP LOAD FAILED' >&2 || true
  echo "$OUT" | grep -E 'MCP LOAD REFUSED: Rowan manages' | grep -v "signal:" >&2 || true
  [ "$rc" -ne 0 ] && echo "(topaz also exited $rc)" >&2
  exit 1
fi
[ "$rc" -ne 0 ] && echo "WARNING: topaz exited $rc -- session status was tainted (see above)." >&2
echo "Mcp project loaded and committed (components: $MCP_COMPONENTS)."
