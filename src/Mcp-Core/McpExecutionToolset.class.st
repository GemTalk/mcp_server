"
The arbitrary-code tool: execute_code. Deliberately its own toolset, so a deployment can expose the
rest of the server without handing out an escape hatch that can do anything the session's user can.

Leaving this toolset out of a deployment's McpRouter>>toolsetNames narrows what is OFFERED, and is
a reasonable thing to do -- but it is not a security boundary: run_test_class runs arbitrary test
bodies, and any tool that compiles can be followed by one that runs. What actually bounds this tool
is the GemStone user the worker gem logs in as, which is set outside this image: see
McpRouter>>workerUserId and docs/ReadOnly_User.md.

The handler caps its result at the shared 50k output limit (McpToolset>>capResult:); everything else
about an evaluation -- errors included -- is the dispatcher's business.
"
Class {
	#name : 'McpExecutionToolset',
	#superclass : 'McpToolset',
	#category : 'Mcp-Core'
}

{ #category : 'accessing' }
McpExecutionToolset >> instructions [
  "How to search the application's objects. It bears on every way of running code, and execute_code
   is how a model would run a loop over those objects: on a production database such a loop can run
   for hours where an indexed selection block would not."
  | lf |
  lf := String with: Character lf.
  ^'SEARCHING THE APPLICATION''S OBJECTS. Avoid repository-wide scans such as `allInstances` '
    , 'and `listInstances:` unless the user asks for one: on a large database they can take hours, '
    , 'and they can pick up disconnected (dead) objects that the application no longer references. '
    , 'Instead, find the collection the application keeps the objects in.' , lf , lf
    , 'Linear scans of a very large collection -- `do:`, `detect:` or `select:` with an ordinary '
    , '`[:each | ...]` block -- can also take many minutes, and an application built to best '
    , 'practice will have put GemStone indexes on such collections. So check the collection for '
    , 'indexes (`IndexManager current getAllNSCRoots` lists every indexed collection; '
    , '`aCollection equalityIndexedPaths` names a collection''s indexed paths). Then query with a '
    , 'selection block -- curly braces, and a path of instance variable names rather than message '
    , 'sends: `customers select: {:each | each.address.zipCode = ''97201''}`. It uses an index '
    , 'when one exists and falls back to a scan when none does. Do not create an index unless the '
    , 'user asks.'

]

{ #category : 'registration' }
McpExecutionToolset >> registerOn: aToolRegistry [
  aToolRegistry
    name: 'execute_code'
    description: 'Execute GemStone Smalltalk code and return the printString of the result. Accepts a single expression or a sequence of statements.'
    inputSchema: (self objectSchema:
        (Dictionary new at: 'code' put: (self propString: 'Smalltalk source to evaluate'); yourself)
        required: (Array with: 'code'))
    do: [:args | self tool_execute_code: args].
  ^self

]

{ #category : 'tools - execution' }
McpExecutionToolset >> tool_execute_code: args [
  "Code is wrapped by McpDispatcher>>handleToolsCall:id: to catch errors"
  ^self capResult: (args at: 'code') evaluate printString

]

{ #category : 'accessing' }
McpExecutionToolset >> toolNames [
  ^#( 'execute_code' )

]
