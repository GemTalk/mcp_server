! Load the native GemStone MCP server classes, in dependency order.
! Run from an already-logged-in topaz session:  topaz> input load.gs
! (or use install.sh, which logs in, runs this, and commits).

input McpError.gs
input McpTool.gs
input McpToolRegistry.gs
input McpHttpConnection.gs
input McpDispatcher.gs
input McpBase.gs
input McpServer.gs
input McpSession.gs
input McpRouter.gs
input McpAuthRouter.gs

! Unit-test classes (GsTestCase subclasses) + their mock transport.
input McpMockSocket.gs
input McpToolTest.gs
input McpDispatcherTest.gs
input McpContractTest.gs
input McpTransportTest.gs
input McpAuthTest.gs

commit
