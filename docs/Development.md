# Development

How to set up, change, test and release this project. [README.md](../README.md) covers what the
server is and how to run it; this covers working on it. Agents should also read
[.claude/CLAUDE.md](../.claude/CLAUDE.md), which is the same process condensed with the traps
attached.

## Setting up

You need a GemStone/S 64 Bit product tree, a running stone, and — for anything that forks a gem — a
netldi. Everything else the scripts discover.

```bash
cp .setenv.example .setenv     # edit for your machine; .setenv is gitignored
source .setenv
./install.sh --check           # resolve and report the environment without installing
./install.sh                   # file the classes in and commit
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

1. **Make the change** — edit the `.gs` file directly, or `compile_method` through the MCP tools.
   Note that an MCP compile **commits immediately** in the live image.
2. **File each changed class out canonically** to its `.gs` file — see below. Do this *after*
   compiling into the image; the file-out reflects what is committed there.
3. **Verify the methods landed.** `errorcount` is not sufficient: a `"` inside a method comment
   silently drops the method, and topaz still reports success. Compare the file's `^test` count
   against the suite's reported test count, or the file's selectors against the class's.
4. **Run the unit suite** — `./install.sh && ./run-unit-tests.sh`. Exit 0 means all green.
5. **Run `./test.sh`** if you touched a tool schema, a guardrail, or `McpMutationToolset`. It is the
   only check that exercises the tools over the wire; a break there is otherwise silent until
   somebody runs it. It forks its own server on port 8011, so it does not disturb a live one.
6. **Commit.** Keep the increments small and verifiable.

Do not bump the server version as part of an ordinary change — see [Releases](#releases).

### Canonical file-outs

The source tree is plain topaz `.gs` file-outs — `Class>>fileOutClass` output, the same string the
`export_class_source` tool returns. Every file in `src/` is a verified fixed point: install from the
tree, file the image back out, byte-identical. That makes a regenerated-vs-repo diff a trustworthy
signal, and it is worth keeping.

Have topaz write the file-out **straight to the file**. Do not transcribe tool output by hand — a
real file-out emits things an editor normalises away (a trailing space after `Foo comment: `), so
transcription drifts.

```
"$GEMSTONE/bin/topaz" -l <<'TPZ'
set gemstone <stone>
set username <user>
set password <pass>
login
run
| s f |
s := McpAuthTest fileOutClass.
f := GsFile openWriteOnServer: '/abs/path/src/auth/McpAuthTest.gs'.   "NB: no mode: argument"
f isNil ifTrue: [^'CANNOT OPEN'].
f nextPutAll: s.
f close.
'wrote ' , s size printString , ' bytes'
%
logout
exit
TPZ
```

* Log into the stone where the change is **committed**.
* `openWriteOnServer:mode:` does not exist — `openWriteOnServer:` alone truncates and creates.
* Filing several classes in one `run` block: do all the writes and return **one** summary value as
  the block's last expression. Do not `displayNl` between them — an error there aborts the whole
  doit, and the first file gets written while the second silently does not.
* `fileOutClass` sorts selectors **case-insensitively**.
* Verify no whitespace drift: `git diff --shortstat` should equal
  `git diff --ignore-all-space --shortstat`.
* **Never judge a regenerated file by reading its diff.** Method-block reordering produces hundreds
  of lines that can hide a real change. Compare method blocks as a *set* — parse both files into
  `{(method: line, selector) -> body}` and assert nothing was lost, gained or altered.

### The loaders

`src/{core,tests,auth,grail}/` each have a `load.gs`; `load.gs` at the root composes them, and
`install.sh` files that in, then gates on a sentinel block that asks the image which classes it
actually got — a topaz file-in reports compile errors and carries on, so exit status alone lets a
partial load pass for success.

**Every group loader must pre-declare its class names before filing anything in.** The classes name
each other in both directions, so no file order puts every class ahead of its first mention. Each
loader opens by binding each name to `nil` in the `Mcp` dictionary; the compiler binds a global by
its *association*, and the class definition later fills that same association in, so a method
compiled before its referent still ends up pointing at the real class. If you add a class, add its
name to that list.

## Testing

There is no CI. The suites are the whole safety net, and they are cheap:

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

* On **3.7.2**, kernel defect #51438 is *covered* rather than reported: `McpSession` probes its
  worker at session start and resets the kernel's fetch buffer before each call, so nothing fails
  for it. On `main`, which carries no cover, `McpExternalSessionTest` fails there on purpose
  instead — that is the difference between the two lines.
* One blind-write test (`testTheStoneAloneWouldAllowThatClobber`) is written to **fail on good
  news**, so a stone that grows its own read protection gets noticed instead of quietly making a
  whole layer redundant. On 3.7.2 it fires: that stone refuses the clobber on its own.
* **Five failures on 3.7.2 are not this branch's doing**, and they are the same five on `main`.
  Measured on gs372 on 2026-09-08 — `main372` 433 tests across 17 suites, `main` 428 across 18,
  the outcomes identical apart from `McpExternalSessionTest`:

  | suite | test |
  |---|---|
  | `McpConcurrentEditTest` | `testTheStoneAloneWouldAllowThatClobber` |
  | `McpConcurrentEditTest` | `testAClientWhoseWorkWasDoomedIsNotToldItsOwnCommitFailed` |
  | `McpConcurrentEditTest` | `testAFailedRefreshClearsTheWritesAndReChecksTheReads` |
  | `McpConcurrentEditTest` | `testAServerRefreshOfDoomedWorkSaysSoAndNamesWhatCollided` |
  | `McpTransactionTest` | `testRefreshAdoptsTheOtherVersionAsTheStartingPoint` |

  All five turn on what the 3.7.2 stone does with a stale read and with a doomed transaction, which
  is not what 3.7.5 does. The last errors only under `suite run` and passes when run alone, so it
  also depends on state an earlier test in the suite leaves behind.

## Version support

The project's standing goal is to run on as many GemStone versions and extents as possible.

| image | base server | OAuth/OIDC front end | notes |
|---|---|---|---|
| 3.6.2 | **deferred** | no | no `GsTsExternalSession` on macOS (its own header parser crashes), so no worker gems at all |
| 3.7.2 | yes | no — no kernel JWT classes | carries #51438, which this branch covers; `install.sh` leaves `src/auth` out |
| 3.7.5 | yes | yes, against a local IdP | |
| 3.7.6+ | yes | yes, including an external OIDC IdP | |
| 4.0.0 | untested here | untested here | |

The floor for *referencing* a kernel class directly is 3.6.2 — no existence guard needed. Genuinely
optional things (Grail) still use an `objectNamed:` guard. `src/auth` is detected rather than asked
about, because loading `McpAuthRouter` is inert; `src/grail` stays opt-in because loading it joins
the default tool surface. See [GemStone_Notes.md](GemStone_Notes.md) for the concrete
version-to-version behaviour differences this has surfaced.

## Branches and releases

> **This section describes a single-developer convention and is due to change as more people
> contribute.** Confirm the current policy before assuming it.

* **`dev`** — where development happens, auth included.
* **`main`** — the release line. Advanced only at milestones judged well tested, by merging `dev`
  in (`--ff-only`, so a surprise divergence surfaces instead of becoming a merge commit).

The repository is **public**. Anything pushed is world-visible immediately: no secrets, no signing
keys, no real hostnames or customer detail in commits, and assume all history is readable.

Older material describes a two-line layout in which `main` was a deliberately auth-*less* release
line and `auth` carried the auth files, with one-directional merges and shared files kept
byte-identical across branches. That was retired on 2026-08-21 and the `auth` branch is deleted. If
a note tells you to `git checkout auth`, it is stale.

### Releases

Merging to `main` is a deliberate act, not the end of the per-change loop:

1. Bump `McpServer class>>defaultServerVersion` — the single home for the literal.
   `McpContractTest` asserts `initialize`'s `serverInfo.version` equals that selector's answer, so a
   bump does not break tests. Deployments can relabel per instance, so this is the *product*
   version.
2. File out, test, commit on `dev`.
3. Merge `dev` into `main`.
4. Update [CHANGELOG.md](../CHANGELOG.md).

Never bump unilaterally: someone may be running a server against a published version.

### Resolving a `.gs` conflict

Conflicts in file-outs are usually **unions** — each side added a different method at the same
alphabetical spot — so the resolution is to keep both. That is exactly where the trap is: the `%`
that terminated the first side's method commonly sits *after* the `>>>>>>>` marker as trailing
context, so concatenating both sides drops it, and the next method's header and body get swallowed
into the previous method's source. The compiler then reports `[1034] unexpected token` under
perfectly good lines much further down, and `install.sh` fails naming a method that is not the
problem. It reads like a version incompatibility.

**After resolving any `.gs` conflict, check that every `category:` line is preceded by `%`** (or by
the `! ---` banner). Ordering inside the resolution does not matter — the canonical file-out
re-sorts everything — but a missing `%` is not recoverable that way, because the file will not file
in at all.
