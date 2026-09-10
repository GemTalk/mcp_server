Presentation

I want to start by describing MCP server behavior under "healthy" conditions, i.e. no commit-record pressure, pending timeouts, ledger issues, requests with progress notifications, etc. I want to communicate the overall structure of the project effectively before going into details to handle pressure cases.

Overview of what files there are in the repository and how they're organized, where classes install to, what the included scripts do.

The run-server script: How it configures the router with default toolsets, worker class, and timers. (Again, overview focusing on defaults. A customized router example will come later.)

How the router forks and detaches with the configuration traveling on the fork string. The login, using the same user. The transactionless mode. What objects the router adds in its initialization.

Show a basic, new request as it might be received on a socket from a client. I want to follow it through this code (No need to follow it through kernel classes as it's parsed, etc.--I'll assume the audience understands how those parts work). This will include the protocol negotiation, the session initialization, the forking and detaching of a worker, its login with the same user, and its configuration over the fork string, the session IDs, the worker instance going into SessionTemps.

Show a follow-up request from a client with a session ID. Follow it to the server, how it is a non-blocking request, how it is parsed and checked against the schema, and how the JSON result is returned to the client. (There may be something to say about how McpJson is used to work around the current kernel bugs.) Schema enforcement here somewhere?

*

Progress notifications aren't especially exciting but they do involve the client's stream, which is also used in timeouts, so they're worth a mention along with their restricted use in the latest mcp spec.

*

I'll include a section discussing the transaction model. This should start with instructions that are sent to the client explaining pinned views and what committing, aborting, and refreshing do.

I want to illustrate the write-write guardrail that is enforced by the stone and the UI. Then I want to show that an AI agent circumvents the UI's implied invariant that writes are a subset of reads in every transaction. When an agent attempts to write, I want to confirm that the agent has read in the current view. Explain the readLedger dictionary and its hash stamps, how the stamp is checked by all mutation tools, and how as the view moves the client is notified of reads that became stale. Describe why the writeLedger is also helpful for mapping the object-level conflict report back to client-visible names. For full disclosure it is important to mention that execute_code circumvents the safeguards along with the notifications triggered by the view change.

*

I need a section describing the router maintenance cycle. Flowcharts may be very helpful here. This section should cover the maintenance cycle, reaper intervals, and timeouts. Timeouts from closed streams are included. I also need to describe the commit-record backlog issues (See mcp-front-end-view-hygiene.md), grace periods, disposal lag (pressure when all gems are below the commits-behind limit), and the escalating reaping steps. It seems important that router-initiated refreshes use `tryLock`, not `critical:`, and do not `touch`. I need to describe how sessions with long-running calls are handled by 3(b), and how an idle session whose view cannot move is reaped.

*

I need a section on the McpAuthRouter, mentioning the dependence on 3.7.6 for loading an external IdP OIDC so the stone can start. This adds availability on an external port. Logins are with a JWT. The maintenance loop adds a check for the token expiry, which can be moved by refresh tokens. I should describe the state of the offline_access token and why I advertize it against a SHOULD because of Claude's misbehavior conflicting with Keycloak.

A demo of the login would be nice, to show Alice can run code on it.

Future work would be relating scopes to privileges--I haven't investigated this. I can load toolsets based on scope.

*

A Grail MCP Server is an example of how to load a custom toolset, as could be done with Brain Freeze Insurance if a database requires a set of tools that aren't developer coding tools. A McpServer subclass would change behavior; usually toolsets are better.

*

Maybe a summary of the state of support for 3.7.2 and the buffer corruption bug. And now the continueTransaction obstacle.

*

Read-only mode, if it's available. Or its current implementation, with ideas for improving it.

*

Future work should include an overview of the new protocol spec, the scopes/privileges work to be done, the potentially increasing cost of maintaining the readLedger (Wiping and lazy checking are options). Remove McpJson when the kernel bugs are fixed?

Q. Is a kernel guard needed, or can privileges handle it?
