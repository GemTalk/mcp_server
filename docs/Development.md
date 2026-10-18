# Development

How to set up, change, test and release this project. [README.md](../README.md) covers what the
server is and how to run it; this covers working on it. Agents should also read
[.claude/CLAUDE.md](../.claude/CLAUDE.md), which is the same process condensed with the traps
attached.

## Setting up

You need a GemStone/S 64 Bit product tree, a running stone **on a Rowan 3 extent**, and — for
anything that forks a gem — a netldi. Everything else the scripts discover. The project is the Rowan
project `Mcp`, so the stone has to be started on `$GEMSTONE/bin/extent0.rowan3.dbf` (3.7.5, 3.7.6
and 4.0.0.a5 ship it), not on the stock `extent0.dbf`; `install.sh` refuses an image without Rowan.
The stock extent is for the other audience — a 3.7.x installation without Rowan, which installs the
topaz file-out with `install.sh --from-gs` (see [Testing](#testing)) — and is not where you develop.

```bash
cp .setenv.example .setenv     # edit for your machine; .setenv is gitignored
source .setenv
./install.sh --check           # resolve and report the environment without installing
./install.sh                   # load the Rowan project and commit
./run-unit-tests.sh            # verify
```

`--check` is the first thing to run on a machine you have not installed on before. Read
**Environment** in the README before assuming `GEMSTONE`, `GS_STONE`, `GS_USER` and `GS_PASS` are
enough: `GEMSTONE_GLOBAL_DIR` is the variable that decides whether a login works at all, and a wrong
one fails as a `getaddrinfo` error that looks like DNS and is not.

Two things worth knowing about your stone before you start:

* **Login slots.** `install.sh` needs one. `run-unit-tests.sh` holds up to **seven concurrently**,
  because six suites fork real worker gems. A stone whose `StnMaxSessions` is already consumed by
  running servers fails those suites with *"the maximum number of users are already logged in"* —
  which is not a regression. Stop the servers or raise the limit before reading it as one.
* **What is loaded in it.** Grail sets `Globals at: #StringConfiguration` to `Unicode16`, which
  changes the class of every string literal you compile. `install.sh` pins literals to byte
  `String`s (`set sourcestringclass String`) so this does not vary between images, but a test that
  asserts something about its own literal's class will still tell you which stone you are on. See
  [GemStone_Notes.md](GemStone_Notes.md#string-literals-and-unicode).

Installing under a **running** server is safe. The long-running front-end gem keeps its old
transport code for up to two maintenance passes while its worker gems pick up recompiled worker code
on their next request.

## The per-change loop

1. **Make the change in the image** — `compile_method` / `define_class` through the MCP tools, or
   topaz — and **commit** it there.
2. **Write the project out** — `./write-project.sh`. Rowan writes the packages under `src/Mcp-*`
   from what is committed in the image; see below. Never edit the Tonel by hand.
3. **Review `git diff src/`.** It is the change, as Rowan sees it. A file you did not expect to
   change, or a class missing from it, means the image is not what you thought.
4. **Run the unit suite** — `./install.sh && ./run-unit-tests.sh`. Exit 0 means all green.
   Reinstalling from the checkout is what proves the written project loads on its own.
5. **Run `./test.sh`** if you touched a tool schema, a guardrail, or `McpMutationToolset`. It is the
   only check that exercises the tools over the wire; a break there is otherwise silent until
   somebody runs it. It forks its own server on port 8011, so it does not disturb a live one.
6. **Commit.** Keep the increments small and verifiable.

Do not bump the server version as part of an ordinary change — see [Releases](#releases).

### The Rowan project

The repository is the Rowan project `Mcp`:

```
rowan/project.ston          project spec: Tonel, RowanHybrid convention, packages under src/
rowan/specs/Mcp.ston        load spec: components Core + Auth, symbol dictionary Mcp
rowan/components/Core.ston  Mcp-Core, Mcp-Tests
rowan/components/Auth.ston  Mcp-Auth, Mcp-Auth-Tests
rowan/components/Grail.ston Mcp-Grail, Mcp-Grail-Tests  (optional: install.sh --grail)
src/Mcp-*/                  the Tonel packages, one .class.st per class
```

**The Tonel is written by Rowan, never by hand.** Rowan's writer puts methods in the order its
reader expects; hand-inserted methods have broken a whole load before (a 3.7.6-era Rowan refuses
Tonel whose methods are not in canonical order). Every file under `src/Mcp-*` is a verified fixed
point: load the project, write it back out, byte-identical. That makes `git diff src/` after
`./write-project.sh` a trustworthy signal, and it is worth keeping.

What `write-project.sh` relies on, measured on 3.7.6:

* **A method compiled into a class the project manages joins that class's package** on its own —
  `compile_method` and topaz alike — and a removed method leaves it.
* **A method's source ends with a newline**, as a topaz file-in and a Rowan load store it; the
  Tonel's blank line before `]` is that newline. `compile_method` adds one when the client's source
  lacks it ([#64](https://github.com/GemTalk/mcp_server/issues/64)), but a method compiled from
  Smalltalk with `compileMethod:` is stored exactly as given.
* **A new class does not.** One created with the kernel's `subclass:` messages (which `define_class`
  sends) belongs to no package, and Rowan would leave it out of the write without a word. The script
  adopts every such `Mcp*` class into the package its **class category** names — so a new class's
  category must be one of the four package names.
* **A deleted class is not dropped either.** `delete_class` unbinds the class, but its package still
  lists it, and a write would put the file back. The project's audit reports exactly this, and the
  script refuses to write until the audit is clean.
* It writes only `src/Mcp-*`. `rowan/` is the project's definition and changes only when the project
  does — a new package, a new component — which is a Rowan API change in the image, not an edit.

**The `Grail` component loads only on a 4.0 image that has both Grail and Rowan.** 4.0.0.a5 is the
first 4.0 release to ship one ready-made: start the stone on its `extent0.rowan3.dbf` (Rowan 3.6.0),
install Grail, then `./install.sh --grail`. Before a5 such an image had to be built by hand —
Rowan bootstrapped into a stock extent, and patched to parse `4.0.0.aN` (Rowan commit `c327a8d4`).
`write-project.sh` run on any other image leaves `src/Mcp-Grail*` alone, because it writes only the
packages that image has loaded.

### The topaz file-out

The 3.7.x audience runs the stock `extent0.dbf`, which has no Rowan, so it cannot load the project.
It installs a **topaz file-out** instead — one `.gs`, generated from the same Tonel and never
committed:

```bash
./export-gs.sh                          # writes mcp_server.gs (gitignored); needs GEMSTONE, no stone
./install.sh --from-gs mcp_server.gs    # files it into a stone without Rowan, and commits
```

`export-gs.sh` runs GemStone's own `rowan3/bin/exportRowanProjectAsTopaz.solo`, a solo session that
reads the Tonel through the load spec, so it needs a Rowan-3 product tree but no running stone. The
file is the load spec's default components, `Core` + `Auth`, unit tests included. Two properties it
depends on, both measured 2026-10-18:

* **The exporter's output does not depend on the product that runs it.** 3.7.5, 3.7.6 and 4.0.0.a5
  wrote byte-identical files from the same Tonel. So the version that *exports* is immaterial; the
  version it is *filed into* is what the tests decide.
* **Every class is `inDictionary: Mcp`**, so the dictionary must exist before the first class
  definition compiles. `install.sh` creates it first in both modes.

`--from-gs` refuses an image where Rowan already manages these classes: topaz cannot file in over a
Rowan-managed class ("Duplicate definition", error 2318). Going the other way is fine — a Rowan
install migrates a file-out install.

## Testing

`.github/workflows/health-check.yml` runs the suites below on every push to `main` and every pull
request, in four legs — one per audience and version:

| leg | extent | install |
|---|---|---|
| 3.7.5 file-out | stock `extent0.dbf` | `export-gs.sh`, then `install.sh --from-gs` |
| 3.7.6 file-out | stock `extent0.dbf` | ditto |
| 4.0.0.a5 Rowan | `extent0.rowan3.dbf` | `install.sh` |
| 4.0.0.a5 Rowan + Grail | `extent0.rowan3.dbf` | clones [GemTalk/Grail](https://github.com/GemTalk/Grail), installs it, then `install.sh --grail`, so `McpGrailToolsetTest` runs too |

The file-out legs are what keep 3.7 honest between releases: they file in exactly what a release
would publish from that commit, so a change that reaches for something newer than 3.7.5 fails in the
pull request that made it. Locally, the suites are the whole safety net, and they are cheap:

| | what it covers | needs |
|---|---|---|
| `./run-unit-tests.sh` | every installed in-image suite | a stone; a netldi for the forking suites |
| `./test.sh` | the tools **over the wire**, via curl | a stone, a netldi, port 8011 |
| `./test-tls.sh` | the same transport over HTTPS, with a throwaway self-signed cert | as above, port 8443 |

Optional groups are picked up by class name, so a suite that is not installed is a skip rather than
an error. The README's **Test** section lists every suite and what it pins.

**Each suite runs in its own topaz session.** That costs a login per suite and buys the one thing
that matters when something goes wrong: a suite that blows up can no longer take the whole report
down with it. A Python exception reaching `defaultAction` — a Grail `ModuleNotFoundError` is the one
seen in practice — is not caught by SUnit's `on: Error do:` and terminates the doit, so with every
suite in one session the run printed a stack and **no tally at all**: 484 passing tests reported as
"UNIT TESTS DID NOT RUN". Such a suite is now marked `ABORTED` and listed under `COULD NOT RUN`, the
others still report, and the run still exits non-zero — an aborted suite has told you nothing, so it
is a failure rather than a skip.

**On an image with the Grail toolset, set `MCP_GRAIL_DIR` to the Grail checkout.** Grail's Python
lives in the image but its `.py` stdlib lives on disk under the checkout, and a gem cannot work out
where — its working directory holds no `src/python/stdlib`, so every `.py`-backed import in
`McpGrailToolsetTest` fails. Same variable, same meaning and the same up-front check as
`run-server.sh`. Note that the suite is installed by `--grail` but resolves by class name, so it
runs on any stone where it was *ever* installed, whether or not you passed `--grail` this time.

Two long-running harnesses exist for things a suite cannot reach — `session-lifetime.sh` and
`sleep-test.sh` (host-suspend detection). They are not part of the ordinary loop.

Expected failures are real signal, not noise:

* `McpExternalSessionTest` fails on purpose on an image older than 3.7.4.1, which carries kernel
  defect #51438. Nothing in `src/` can fix it; the failure is the suite reporting the image.
* One blind-write test (`testTheStoneAloneWouldAllowThatClobber`) is written to **fail on good
  news**, so a stone that grows its own read protection gets noticed instead of quietly making a
  whole layer redundant.

## Version support

**Supported: 3.7.5, 3.7.6+ and 4.0.0.a5.** The server's view handling relies on those images'
implementation of `System continueTransaction`; earlier ones differ below the Smalltalk, in ways
nothing in `src/` can detect or work around. Whether the floor settles at 3.7.5 or 3.7.6 is not yet
decided. Both ends are held by CI rather than by assumption — 3.7.5 and 3.7.6 from the topaz
file-out on a stock extent, 4.0.0.a5 through Rowan, including the Grail toolset, which 4.0 alone can
load.

| image | base server | OAuth/OIDC front end | notes |
|---|---|---|---|
| 3.6.2 | **no** | no | no `GsTsExternalSession` on macOS (its own header parser crashes), so no worker gems at all |
| 3.7.2 | **no** | no — no kernel JWT classes | dropped 2026-09-10: `System continueTransaction` differs below the image in two ways nothing in `src/` can detect or cover, and it carries #51438 |
| 3.7.5 | yes | yes, against a local IdP | **in CI**, from the file-out. **No Grail**: Grail dropped 3.7.x on 2026-09-12 and requires 4.0 |
| 3.7.6+ | yes | yes, including an external OIDC IdP | ditto (3.7.6) |
| 4.0.0.a5 | yes | yes | **in CI**, through Rowan, and the only image that can carry Grail |

**Grail is tested on 4.0 and nowhere else, because nowhere else can run it.** Grail's own
`install_base.sh` refuses anything before 4.0, so CI has no 3.7 Grail leg and runs the Grail leg on
the 4.0 alpha instead — which is what keeps the `Grail` component and `McpGrailToolsetTest` covered.

**The 4.0 alpha is downloaded from `dl.gemdb.com`, not from the public download server**, because it
is a pre-release and is not published there. The base URL per version is matrix data in
`health-check.yml`, so a version that moves is one line. Both hosts are GemTalk's, and the 4.0 one
is the same catalog anything running this server on 4.0 installs its engine from, so the leg tests
what users actually have.

**Do not count on that catalog keeping an old alpha, so the pinned version can expire.** 4.0.0.a2
replaced 4.0.0.Alpha1 on 2026-09-16 and the Alpha1 directory now answers 404, which takes the leg
down at the download step; a3 replaced a2 the same way. (On 2026-10-18 it listed a3, a4 and a5
together, so the policy may have changed — but a leg that breaks at the download says nothing about
the code.) When that happens the fix is to read the current name off `https://dl.gemdb.com` and
bump both the `gemstone-version` entry and its `download-base` — the spelling is not predictable
(`Alpha1` became a lowercase `a2`), so it cannot be derived from the previous one.

Anything present in **3.7.5** may be referenced directly, with no existence guard; the live concern
is only what is newer than that. Genuinely optional things (Grail) still use an `objectNamed:`
guard. The `Auth` component is detected rather than asked about, because loading `McpAuthRouter` is inert;
The `Grail` component is inert too (`McpGrailToolset` is not in the default tool surface — a router has to
name it), but stays opt-in at install because it cannot be detected the same way: `ModuleAst`
present does not mean the Grail these tools were written against, and a group that cannot compile
takes the file-in down with it. See
[GemStone_Notes.md](GemStone_Notes.md#version-to-version-differences) for the concrete behaviour
differences this surfaced, and in particular why 3.7.2 was dropped rather than covered.

## Branches and releases

* **`main`** — the only long-lived line, and the release line. Nothing is committed to it directly.
* **A branch per change**, cut from an up-to-date `main` and named the way
  [GemTalk/Grail](https://github.com/GemTalk/Grail) names its branches: a `feat/`, `fix/`, `ci/` or
  `docs/` prefix followed by a short kebab-case phrase describing the change —
  `feat/python-search-tools`, `fix/metaclass-call`, `docs/utf8-wire-measurements`. A release takes
  `release/<version>` instead — `release/0.8.0` — the one prefix here that Grail does not use, since
  a version bump is neither a feature nor a fix. Push the branch as soon as it exists; there is no
  value in one only a single machine can see.
* **A pull request into `main`** ends it. Nothing is assumed to depend on a topic branch, so
  renaming it, amending its commits and force-pushing are all free right up to the merge — but
  **merge it unsquashed**. Commits are where a decision keeps its reasoning; shape the history on
  the branch, and let `main` keep what you shaped.

The repository is **public**. Anything pushed is world-visible immediately: no secrets, no signing
keys, no real hostnames or customer detail in commits, and assume all history is readable.

Two earlier layouts are described in older material, and both are gone. A two-line layout in which
`main` was a deliberately auth-*less* release line and `auth` carried the auth files was retired on
2026-08-21. A long-lived `dev` line merged into `main` at milestones, alongside the parallel `dev2`
and `dev372` lines, was retired on 2026-09-09; `dev` and `dev2` are deleted. `main372` — `main` plus
an in-image cover for #51438, kept for clients who would not upgrade — was archived on 2026-09-10
along with 3.7.2 support; it survives as the tag `archive/main372` and is not maintained. If a note
tells you to `git checkout auth` or to commit on `dev`, it is stale.

### Releases

Merging to `main` is a deliberate act, not the end of the per-change loop. The version bump and the
changelog entry go in the **same** pull request, so a reviewer sees the new number beside the claim
it makes, and `main` never carries one without the other.

1. Cut `release/<version>` from an up-to-date `main`.
2. Bump `McpServer class>>defaultServerVersion` — the source of the literal — and make the Rowan
   project's `projectVersion` (`rowan/project.ston`) match it, set through Rowan rather than by hand:
   `resolved := (Rowan projectNamed: 'Mcp') _loadedProject asDefinition.`
   `resolved projectVersion: McpServer defaultServerVersion; exportProjectSpecification.`
   `McpContractTest` asserts `initialize`'s `serverInfo.version` equals that selector's answer, so a
   bump does not break tests. Deployments can relabel per instance, so this is the *product*
   version.
3. Write that version's [CHANGELOG.md](../CHANGELOG.md) entry in the same branch — the
   `## Unreleased` section becomes `## <version> — <date>`. It becomes the GitHub Release's notes.
4. Write the project out (`./write-project.sh`), test, commit.
5. Open the pull request and merge it into `main`.
6. **Tag the merge on `main` and push the tag:**
   `git tag v<version> <merge commit> && git push origin v<version>`.

Pushing the tag runs `.github/workflows/release.yml`, which publishes the release:

* **It checks the version.** The tag must be `v` + `rowan/project.ston`'s `projectVersion`, that
  must equal `McpServer class>>defaultServerVersion`, and the tagged commit must be on `main`.
* **It exports the topaz file-out once** (`export-gs.sh`) and **tests that exact file** on a stock
  3.7.5 and 3.7.6 extent — every unit suite, `test.sh` and `test-tls.sh`.
* **Only if all of that passes, it creates the GitHub Release** `v<version>`. The notes are the
  CHANGELOG entry plus 3.7 install instructions. The release assets are `mcp_server-<version>.gs`
  and its `.sha256`, permanent public downloads at
  `https://github.com/GemTalk/mcp_server/releases/download/v<version>/mcp_server-<version>.gs`.
  GitHub attaches the tagged source as `.zip` and `.tar.gz` by itself; that archive is where a 3.7
  user gets `install.sh` and the `run-*.sh` scripts.

If the run fails, nothing is published. Fix it through an ordinary pull request, then move the tag
to the new merge — `git push --delete origin v<version>`, re-tag, push — which is safe precisely
because no release was made from the old one. A pull request that changes `release.yml` or
`export-gs.sh` runs the export and test jobs as a dry run, so the workflow does not wait for a
release to be exercised.

Never bump unilaterally: someone may be running a server against a published version.

### Resolving a conflict in `src/Mcp-*`

Do not hand-merge Tonel. Resolve by **loading and rewriting**: take either side, `./install.sh`,
re-apply the other side's change in the image (it is usually a method or two), commit, and
`./write-project.sh`. Rowan's writer then puts every method back where its reader expects it, which a
hand merge cannot promise — and a Tonel file with methods out of canonical order is refused by a
3.7.6-era Rowan for the whole load, not just that file.

