"
How a gem this server forks addresses the stone: McpBase class>>localStoneNRS and
#newLocalExternalSession, which the front end, every worker and a Grail test gem all start from.

THE RULE. A login that named no host for its stone -- topaz `set gemstone gemdb`, as run-server.sh
logs in -- means a stone on this machine, so a forked gem reaches it by 'localhost'. Left to the
kernel it would get #currentGemHostName instead, the OS's name for the machine, which need not
resolve or may resolve to an address the stone drops (issue #56). A host the login DID name is kept.

HOW THEY ARE BUILT. Most tests drive McpBase class>>localStoneNRSFrom:stoneName: with stone names
and hosts this session never logged in with, since the interesting cases -- a host that does not
resolve, a remote stone -- cannot be staged on the machine running the suite. One test forks a real
worker gem through McpSession and asks it which host its own login named, so A NETLDI MUST BE
RUNNING (run-unit-tests.sh insists on one whenever this suite is installed). That test is only as
strong as the login running it: from run-unit-tests.sh's host-less topaz it fails on the code before
#56; from a session that named its host, the old and new code agree.

Nothing here commits or aborts, and a forked gem does not move this session's view, so this suite
needs no #movesTheSessionView.
"
Class {
	#name : 'McpWorkerLoginTest',
	#superclass : 'GsTestCase',
	#instVars : [
		'session'
	],
	#category : 'Mcp-Tests'
}

{ #category : 'helpers' }
McpWorkerLoginTest >> kernelNRSFor: aBody onHost: aHost [
  "A stone NRS as GsNetworkResourceString class>>defaultStoneNRSFromCurrent builds one: a node, the
   resource 'server' and a body naming the stone. Built by hand so the rule can be driven with a host
   that is not this machine's and a stone name this session did not log in with."
  ^GsNetworkResourceString new
    node: aHost;
    resource: 'server';
    body: aBody;
    yourself

]

{ #category : 'helpers' }
McpWorkerLoginTest >> nodeFor: aStoneName filledWith: aHost [
  "The node McpBase answers for a login to aStoneName, when the kernel's default NRS for it carries
   aHost."
  ^(McpBase localStoneNRSFrom: (self kernelNRSFor: 'gemdb' onHost: aHost) stoneName: aStoneName) node

]

{ #category : 'running' }
McpWorkerLoginTest >> setUp [
  "No worker yet: only the test that forks one asks for it."
  session := nil

]

{ #category : 'running' }
McpWorkerLoginTest >> tearDown [
  "Log the worker gem out, if a test forked one. Guarded, because a test that failed mid-call still
   has to give the gem back."
  session ifNotNil: [:s | [s close] on: Error do: [:e | nil]].
  session := nil

]

{ #category : 'tests' }
McpWorkerLoginTest >> testABareStoneNameIsReachedByLocalhost [
  "topaz `set gemstone gemdb`, and run-server.sh's own login: the kernel fills in this machine's
   name -- here one with no forward record, like a Mac named from its ISP's reverse DNS -- and the
   worker must get loopback instead (issue #56)."
  self assert: (self nodeFor: 'gemdb' filledWith: 'host-198-51-100-7.isp.example.net') = 'localhost'

]

{ #category : 'tests' }
McpWorkerLoginTest >> testAHostlessNrsIsReachedByLocalhost [
  "The NRS form with no host -- the one defaultStoneNRSFromCurrent's own comment calls the default
   stone name -- is the same case as a bare name."
  self assert: (self nodeFor: '!#server!gemdb' filledWith: 'machine.local') = 'localhost'

]

{ #category : 'tests' }
McpWorkerLoginTest >> testANamedHostAmongModifiersIsKept [
  "The shape a forked gem's own System stoneName takes -- the host followed by #netldi:, #dir: and
   #log: modifiers -- so a worker or front end that forks again keeps the host it was given."
  self assert: (self nodeFor: '!@stonehost#netldi:ldi#dir:/var/gs#log:/var/gs/%N_%P.log#server!gemdb'
      filledWith: 'stonehost')
    = 'stonehost'

]

{ #category : 'tests' }
McpWorkerLoginTest >> testANamedHostIsKept [
  "A login that named the stone's host keeps it, so a front end pointed at a stone on another machine
   still reaches it. The kernel's NRS carries that host, and it is answered unchanged."
  self assert: (self nodeFor: '!@stonehost#server!gemdb' filledWith: 'stonehost') = 'stonehost'

]

{ #category : 'tests' }
McpWorkerLoginTest >> testANamedHostWithAProtocolIsKept [
  "The workaround the issue describes, `!tcp@localhost#server!gemdb`, and its remote form: a
   protocol before the @ still names a host."
  self assert: (self nodeFor: '!tcp@stonehost#server!gemdb' filledWith: 'stonehost') = 'stonehost'

]

{ #category : 'tests' }
McpWorkerLoginTest >> testANewSessionPinsBothGemAndStone [
  "The session every forked gem starts from carries the loopback stone NRS and forks its gem on
   localhost -- the gem host by NRS, the stone by #localStoneNRS. Not logged in, so no gem."
  | params |
  params := McpBase newLocalExternalSession parameters.
  self assert: params gemStoneName = McpBase localStoneNRS asString.
  self assert: (params gemService includesString: '@localhost#')

]

{ #category : 'tests' }
McpWorkerLoginTest >> testAWorkerReachesTheStoneByTheAddressItWasGiven [
  "A real worker gem, asked which host its own login named. It must be the one #localStoneNRS
   chose: 'localhost' when this suite runs from a login with no host (run-unit-tests.sh's topaz),
   the named host otherwise. Before issue #56 a hostless login handed the worker the machine's name,
   and on a machine where that name does not reach the stone the worker never logged in at all --
   which is this test failing in McpSession class>>startWithId:."
  | answer |
  session := McpSession startWithId: 'worker-login'.
  answer := session runWorker: 'GsNetworkResourceString defaultStoneNRSFromCurrent node'.
  self assert: answer = McpBase localStoneNRS node

]

{ #category : 'tests' }
McpWorkerLoginTest >> testOnlyTheNodeChanges [
  "The stone and the resource are the kernel's; loopback replaces the host and nothing else. The NRS
   passed in is left as it was."
  | given answered |
  given := self kernelNRSFor: 'gemdb' onHost: 'machine.local'.
  answered := McpBase localStoneNRSFrom: given stoneName: 'gemdb'.
  self assert: answered asString = '!@localhost#server!gemdb'.
  self assert: given node = 'machine.local'

]

{ #category : 'tests' }
McpWorkerLoginTest >> testThisLoginsStoneIsTheOneAddressed [
  "For the login running this suite: the same stone the kernel would name, reached by loopback or by
   the host this login named -- never by any third address."
  | kernel ours |
  kernel := GsNetworkResourceString defaultStoneNRSFromCurrent.
  ours := McpBase localStoneNRS.
  self assert: ours body = kernel body.
  self assert: ours resource = kernel resource.
  self assert: (ours node = 'localhost' or: [ours node = kernel node])

]
