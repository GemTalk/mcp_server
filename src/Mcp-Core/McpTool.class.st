"
A single MCP tool: a name, human description, JSON-Schema (a Dictionary) for its
arguments, and a one-argument handler block [:argsDict | aString] that performs the
work and returns a String. Part of the native GemStone MCP server (see McpServer).
"
Class {
	#name : 'McpTool',
	#superclass : 'Object',
	#instVars : [
		'name',
		'description',
		'schema',
		'handler'
	],
	#category : 'Mcp-Core'
}

{ #category : 'instance creation' }
McpTool class >> name: aName description: aDescription inputSchema: aSchema handler: aBlock [
  "aSchema is a Dictionary describing the JSON Schema of the tool's arguments.
   aBlock is a one-argument block [:argsDict | ...] returning a String result."
  ^self new
    setName: aName description: aDescription inputSchema: aSchema handler: aBlock

]

{ #category : 'evaluating' }
McpTool >> callWith: argsDict [
  "Invoke the handler with the supplied arguments Dictionary (may be nil).
   Returns a String. Any error raised propagates to the dispatcher."
  ^handler value: (argsDict ifNil: [Dictionary new])

]

{ #category : 'private' }
McpTool >> commaList: aCollection [
  "The collection's elements, sorted, as a comma-separated String."
  ^aCollection asSortedCollection asArray
    inject: '' into: [:acc :s | acc isEmpty ifTrue: [s asString] ifFalse: [acc , ', ' , s asString]]

]

{ #category : 'converting' }
McpTool >> descriptor [
  "The MCP tools/list entry for this tool."
  | d |
  d := Dictionary new.
  d at: 'name' put: name.
  d at: 'description' put: description.
  d at: 'inputSchema' put: schema.
  ^d

]

{ #category : 'accessing' }
McpTool >> name [
  ^name

]

{ #category : 'initialization' }
McpTool >> setName: aName description: aDescription inputSchema: aSchema handler: aBlock [
  name := aName.
  description := aDescription.
  schema := aSchema.
  handler := aBlock.
  ^self

]

{ #category : 'validating' }
McpTool >> validationErrorFor: argsDict [
  "nil if argsDict satisfies this tool's input schema, else a human message naming the problem.
   Structural only: rejects unknown top-level keys when the schema sets additionalProperties:false,
   and requires every `required` key. Not a full JSON-Schema validator (no deep type checks)."
  | args props extra missing |
  args := argsDict ifNil: [Dictionary new].
  props := schema at: 'properties' ifAbsent: [Dictionary new].
  ((schema at: 'additionalProperties' ifAbsent: [true]) == false) ifTrue: [
    extra := args keys reject: [:k | props includesKey: k].
    extra isEmpty ifFalse: [
      ^'Unknown argument(s): ' , (self commaList: extra) , '. '
        , (props isEmpty
            ifTrue: ['This tool takes no arguments.']
            ifFalse: ['Allowed: ' , (self commaList: props keys)])]].
  missing := (schema at: 'required' ifAbsent: [#()]) reject: [:k | args includesKey: k].
  missing isEmpty ifFalse: [^'Missing required argument(s): ' , (self commaList: missing)].
  ^nil

]
