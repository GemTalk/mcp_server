"
The arbitrary-code tool: execute_code. Deliberately its own toolset, so a deployment can expose the
rest of the server without handing out an escape hatch that can do anything the session's user can.

NOT read-only-safe (readOnlySafeToolNames is inherited, i.e. empty), so a read-only session drops
this toolset whole.

The handler caps its result at the shared 50k output limit (McpToolset>>capResult:); everything else
about an evaluation -- errors included -- is the dispatcher's business.
"
Class {
	#name : 'McpExecutionToolset',
	#superclass : 'McpToolset',
	#category : 'Mcp-Core'
}

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
