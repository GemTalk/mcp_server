! Load the GemStone MCP server unit-test classes (GsTestCase subclasses) and their fixtures.
! Paths are relative to the REPOSITORY ROOT (install.sh cds there before running topaz).
! Requires src/core/load.gs to have run first: the fixtures subclass McpServer / McpSession /
! McpToolset.

run
"Pre-declare these class names in Published BEFORE filing in any of them. The classes reference
 each other in both directions (McpDispatcher asks McpServer for its name; McpServer builds a
 McpDispatcher), so no file order can put every class ahead of its first mention -- without a
 declaration the compiler reports `undefined symbol` and the file-in stops. A nil-valued binding
 is enough: the compiler binds a global by its ASSOCIATION, and each class definition below fills
 that same association in, so methods compiled before their referent still see the real class.
 Existing keys are left alone, so re-installing over a loaded image changes nothing."
| d names |
d := System myUserProfile objectNamed: #Published.
names := #( #McpMockSocket #McpMockWorker #McpMockSession #McpStubSession #McpFixtureToolset
  #McpFixtureServer #McpFixtureRouter #McpToolTest #McpDispatcherTest #McpTransportTest
  #McpContractTest #McpExtensionTest #McpSessionTest #McpOutboxTest #McpStreamTest
  #McpLifetimeTest #McpExternalSessionTest #McpWorkerDeadlineTest ).
names do: [:s | (d includesKey: s) ifFalse: [ d at: s put: nil ] ].
names size
%

! Fixtures: a mock socket, a mock worker gem + the session that drives it, a stub session, and the
! extension-point fixtures the tests drive.
input src/tests/McpMockSocket.gs
input src/tests/McpMockWorker.gs
input src/tests/McpMockSession.gs
input src/tests/McpStubSession.gs
input src/tests/McpFixtureToolset.gs
input src/tests/McpFixtureServer.gs
input src/tests/McpFixtureRouter.gs

! The suites themselves.
input src/tests/McpToolTest.gs
input src/tests/McpDispatcherTest.gs
input src/tests/McpTransportTest.gs
input src/tests/McpContractTest.gs
input src/tests/McpExtensionTest.gs
input src/tests/McpSessionTest.gs
input src/tests/McpOutboxTest.gs
input src/tests/McpStreamTest.gs
input src/tests/McpLifetimeTest.gs

! Needs a real worker gem, so it needs a NETLDI -- see the class comment and
! run-unit-tests.sh. It is the only suite here that is not purely in-image.
input src/tests/McpExternalSessionTest.gs
input src/tests/McpWorkerDeadlineTest.gs
