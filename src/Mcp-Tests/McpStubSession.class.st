"
A McpSession that spawns no gem: prepareWorker records the call instead of driving a worker over
executeString:. Lets a test exercise McpRouter>>openSessionCreating: -- the one choke point where a
router configures a session AND prepares its worker -- without a login, and lets it assert that the
preparation actually happened rather than only that the values were set.
"
Class {
	#name : 'McpStubSession',
	#superclass : 'McpSession',
	#instVars : [
		'wasPrepared'
	],
	#category : 'Mcp-Tests'
}

{ #category : 'initialization' }
McpStubSession >> prepareWorker [
  "Record the call; a stub has no worker gem to prepare."
  wasPrepared := true.
  ^self

]

{ #category : 'accessing' }
McpStubSession >> wasPrepared [
  ^wasPrepared == true

]
