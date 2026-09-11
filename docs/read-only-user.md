# The worker gem's GemStone user

Every measurement here was taken on **GemStone/S 64 3.7.5**, against the users `setup-read-only-user.sh`
provisions. Nothing is read off a manual alone.

## Why this is the only boundary

`mcp_server` has no read-only mode. It had one until the release after 0.8.0 — a per-router flag, and a
`readOnlySafeToolNames` allow-list each toolset declared — and it was removed rather than extended,
because it could never have been more than advisory:

* `execute_code` evaluates arbitrary Smalltalk. Anything the gem's user can do, it can do.
* `run_test_class` runs arbitrary test bodies, which are also arbitrary Smalltalk.
* A tool that compiles can be followed by a tool that runs.

So an allow-list of "safe" tool names described an *intention*, not a boundary, and the one place it
could be mistaken for a boundary was exactly where it mattered: an administrator starting a
"read-only server" with `MCP_READONLY=1`, on a privileged user, believing the image was holding the
line. It was not. The tools were hidden; the privileges were all still there.

What is left is the thing that was doing the work all along: **the GemStone user the worker gem logs
in as**. That is enforced in the stone, by the VM, on every operation, and it cannot be talked around
from inside the session.

```
MCP_WORKER_USER=McpReadOnly ./run-server.sh        # McpRouter: one user for every session
```

`McpRouter>>workerUserId` names it; `McpSession>>startWithId:workerUser:` logs the gem in. No
credential is configured — the front end mints a one-time password per session, which needs one
committed grant (below). `McpAuthRouter` **refuses** `workerUserId:`: there, each worker is the user
its bearer token names, so restricting an analyst means giving *that* GemStone user a restricted
profile.

Choosing a shorter `toolsetNames` list is still worth doing — it narrows what a model is *offered*,
and a smaller surface is a clearer one. It is not a security control, and this document is the
reason.

## The commit lock

The load-bearing line of `setup-read-only-user.sh`:

```smalltalk
up disableCommits.        "UserProfile>>disableCommits"
```

Measured, from a gem logged in as that user:

| probe | result |
|---|---|
| `System commitsDisabled` / `sessionCanCommit` | `true` / `false`, **from login** |
| `UserProfile>>isReadOnly` | `true` (this is the query selector; there is no `UserProfile>>commitsDisabled`) |
| reads, `AllUsers size`, compiling a class | all still work |
| write a committed object this user owns | allowed, `needsCommit` → `true` |
| `System commitTransaction` | `TransactionError` **2249**: *"Further commits have been disabled for this session because: 'This UserProfile is read-only and may not commit.'. This session must logout."* |
| after `System beginTransaction` / `transactionMode: #autoBegin` / `abortTransaction` | commit still **2249** |
| `System myUserProfile enableCommits` | needs `OtherPassword`, needs a commit to persist, applies at the *next* login — unreachable from inside |

**`System disableCommitsWithReason:` is deliberately not used.** It produces the *same* error —
`TransactionError` 2249, differing only in the reason string — so it buys no better diagnostics, and
it is strictly weaker: it locks one session, where `disableCommits` on the profile locks **every**
session of that user, including a gem that session forks. It is also a runtime act by the server
rather than a fact an administrator can see in the user's profile. The one thing it is good for is
*staging* the state in a test, where the lock has to die with the gem
(`McpTransactionTest>>testACommitLockedSessionIsNotToldToCommit`).

A session in this state still accumulates pending work — compiling, and writing what it owns, are
allowed; only *keeping* them is not — so the `[session]` line says exactly that, and points at
`abort` rather than telling it to commit.

**Object authorization does better than the commit lock, where it applies.** A user that owns none of
the application's objects has no write authorization on the security policies holding them, so a write
to one is refused **2116 at the write itself** — measured against a shared object in `Mcp`:
*"An attempt was made to modify the object … in objectSecurityPolicyId 2 with insufficient
authorization."* `needsCommit` stays `false`. Unlike the commit lock, that leaves no dirty state and
no phantom value for the session's own later reads to trip over, which is a better read-only
experience and not merely a stronger one. The commit lock is what catches everything else: the
user's own `UserGlobals`, and anything it *is* authorized to write.

## The privileges, one at a time

GemStone 3.7.5 has 24 privilege names (`UserProfile privilegeNames`). Most are **positive** — a new
`UserProfile` has none of them, so withholding one costs nothing but a line in this table. Four are
**inverse** (`No…`): they must be granted to take something *away*, and they are cached in the VM
**at login**, so they have to be on the profile before the worker gem logs in.

Legend: **default** = in `setup-read-only-user.sh`'s `DEFAULT_PRIVS`.

### Granted by default

| privilege | what it does | risk of granting | cost of withholding |
|---|---|---|---|
| `CodeModification` | compile methods, define classes | None that survives the commit lock: nothing compiled can be committed, so it dies with the gem. Measured: `answer ^42` compiled and returned `42`, uncommittable. | **High, and it is why this is granted.** Without it `execute_code` raises **2151** on so much as a helper class, `compile_method` fails, and `run_test_class` cannot run a suite that compiles anything. The tool stops being worth having. |
| `NoPerformOnServer` *(inverse)* | **withholds** `System performOnServer:` | — | Losing shell access. Nothing in the tool surface uses it. |
| `NoUserAction` *(inverse)* | **withholds** user-action / FFI callouts | — | C extensions and anything that reaches libraries through a user action. Nothing in the core surface does. **Also closes the second-gem route** (below). |
| `NoGsFileOnServer` *(inverse)* | **withholds** server-side file I/O (`GsFile openReadOnServer:` &c.) | — | No file reading or writing from tools. Note `McpRouter` reads `/dev/urandom` for session ids — but that is the *front end's* user, not this one. **Also closes the second-gem route.** |
| `NoGsFileOnClient` *(inverse)* | **withholds** client-side file I/O | — | Same, on the client side. Included for symmetry; on its own it does **not** close the second-gem route (measured: a user with only this privilege still logged a gem in). |

### Withheld by default

| privilege | what it does | risk of granting | cost of withholding |
|---|---|---|---|
| `SystemControl` | stop the stone, change stone configuration | **Total.** `System stoneConfigurationAt:put:`, shutdown. | None for browsing. |
| `SessionAccess` | `System stopSession:`, inspect and terminate other sessions | Denial of service against every other user. | Cannot terminate sessions. `status` still reports this session. |
| `CreateOnetimePassword` | mint one-time passwords | **This is the escape.** A session with it mints a password for its own user and logs in a second gem that is *not* commit-locked, then commits through it. Measured end to end. | None — the *front end's* user does the minting, not the worker's. |
| `ChangeUserId` | act as another user | Becomes whoever it likes. | None. |
| `OtherPassword` | change other users' passwords — including `enableCommits` | Lifts its own commit lock at the next login. | None. |
| `FileControl` | repository file operations, backups | Reads or writes extents. | No backup tools. |
| `GarbageCollection` | reclaim, mark-for-collect | Can be made expensive or destructive. | None. |
| `ObjectSecurityPolicyCreation`, `ObjectSecurityPolicyProtection`, `DefaultObjectSecurityPolicy` | create and re-authorize security policies | Grants itself write authorization. | Cannot re-file objects between policies. |
| `MigrateObjects` | migrate instances across class versions | Bulk change. | No schema-migration tools. |
| `ReadOtherUserProfile` | read other `UserProfile`s | Discloses user configuration. Note **reads are broad anyway** — see the residue. | Slightly less visible user list. |
| `UserPassword` | change its own password | Low. Withheld because nothing needs it. | Cannot self-service the password, which nothing uses (login is by one-time password). |
| `CompilePrimitives`, `DisableObjectReadLogging`, `DynamicDisableObjectReadLogging`, `SessionPriority`, `ObsoleteStatistics`, `PrivUnused5` | specialist / obsolete | Varies; none needed. | None for this purpose. |

### Which privilege closes the second-gem route

The sharpest question: from a commit-locked session, can you log in a *second* gem that is not
locked, and commit through it? Attributed by running
`GsTsExternalSession newDefault username: 'DataCurator'; password: 'swordfish'; login` from six users
differing in one privilege each:

| that user's profile | result |
|---|---|
| `privileges = ()`, not read-only | **logged in** |
| `privileges = ()`, `disableCommits` | **logged in** — the commit lock alone does *not* close it |
| `NoUserAction` | refused **2151** |
| `NoGsFileOnServer` | refused **2151** |
| `NoGsFileOnClient` | logged in |
| `NoPerformOnServer` | logged in |

`GsTsExternalSession>>login` is an FFI callout into `libgcits`, and `NoUserAction` and
`NoGsFileOnServer` each block getting there. **Either one is enough; the default set has both.**
Read-only-ness does nothing here, and neither does `NoPerformOnServer`.

Verified against the provisioned `McpReadOnly` user over the wire, through `execute_code`:

| attempt | result |
|---|---|
| `System myUserProfile userId` | `'McpReadOnly'` |
| read `Object`, `AllUsers size` | fine |
| define a class, write its OWN `UserGlobals` | allowed, uncommittable |
| write a SHARED object (one in `Mcp`, owned by another user) | `SecurityError` **2116** *at the write* — and `needsCommit` stays false |
| `commit` | `TransactionError` **2249** |
| `System performOnServer: 'echo hello'` | `SecurityError` — *unauthorized server command* |
| `GsFile openReadOnServer: '/etc/hosts'` | **2151** |
| `GsTsExternalSession` login as `DataCurator`/`swordfish` | **2151** |
| `createOnetimePasswordValidForSeconds:` | **2151** |
| `System stopSession: 1` | **2151** |

## What is still open

This bounds what a session can **change**. It does not make a sandbox, and three things stay open.

1. **Reads are broad.** Anything world-readable comes back through a tool result, including other
   `UserProfile`s. A user with no privileges at all could still read another profile's `privileges`
   (measured: 19 of them). If some of the data in the repository is more sensitive than the rest,
   the answer is object security policies, not this document.

2. **Locks — the sharpest residue, and measured end to end.** From a worker gem running as the
   provisioned `McpReadOnly` (commit-locked, five privileges, *unable to write the object at all*),
   `System writeLock:` on a shared object in `Mcp` **succeeded**. While that lock was held, a
   `DataCurator` MCP session changed the same object and its commit **failed**:

   ```
   Commit failed on conflict: Write-WriteLock(1). Nothing was written.
   ```

   So a browsing-only session cannot change the repository but *can stop other sessions changing it*,
   for as long as the worker gem lives. Stopping the server released it.

   This is worth stating plainly because the obvious reassurances do not apply. It is not answered by
   every session being the same user, and it is not answered by those sessions being unable to
   commit — the victim is a **different, privileged** session elsewhere on the stone, and what it
   loses is its own ability to commit. Nothing in the privilege system gates locking. What bounds it
   is session lifetime, which the router already controls (the reaper,
   `McpSession>>stopWorkerGem`, `docs/session-lifetime.md`), and the fact that only `execute_code`
   can reach it — no tool in the surface takes a lock.

3. **Resources.** A loop, a full-repository scan, temp object space, cache churn, and a pinned view.
   Bounded by the router's call and session lifetimes (`docs/session-lifetime.md`), not by privileges.

And one environmental assumption: that this user is the only way in. A guessable password on any
read-write user is an escape if `NoUserAction`/`NoGsFileOnServer` are ever dropped —
`GsTsExternalSession class>>newDefault`'s own comment says it defaults the password to `'swordfish'`.

## Two consequences to plan for

**The symbol list.** A different GemStone user has a different symbol list, so a browsing-only worker
resolves names differently from a read-write one, and `list_dictionaries` answers differently.
`setup-read-only-user.sh` therefore copies the front-end user's symbol list by default
(`MCP_COPY_SYMBOL_LIST=1`). A symbol list is name *resolution*, not authorization: adding a dictionary
lets the user see those names and changes nothing about what it may write or commit. `Mcp` in
particular is not in a new profile's default list, and a worker that cannot see it fails its first
session with `Toolset not found`. **This copy is a point-in-time snapshot** — provision a dictionary
for the read-write user later and you must re-run the script.

**The one-time password grant.** The router mints a password for a user that is not its own, which the
stone permits only for a user on the minting user's allowlist:

```smalltalk
(AllUsers userWithId: 'DataCurator') addOnetimePasswordUserId: 'McpReadOnly'.
System commitTransaction.
```

One committed grant, made by `setup-read-only-user.sh`, requiring `OtherPassword` on the *front end's*
user. This is what lets `McpRouter>>configDict` carry only the worker user's **name** — it is an
identifier, and the fork string stays free of key material. Without the grant the mint raises and the
failure surfaces at session open, not mid-conversation.

## Provisioning

```
./install.sh                       # first -- the user needs Mcp in its symbol list
./setup-read-only-user.sh          # creates McpReadOnly; re-run to change the privilege set
MCP_WORKER_USER=McpReadOnly ./run-server.sh
```

Check it took: `status` should report `user=McpReadOnly`, and `commit` should fail with 2249.

Set `MCP_RO_PRIVS` to override the default privilege list, having read the table above. Re-running the
script drops and recreates the user, which destroys anything it owns — nothing, if it is only ever
used for this.
