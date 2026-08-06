Class {
	#name : 'McpMockSocket',
	#superclass : 'Object',
	#instVars : [
		'input',
		'pos',
		'chunkSize',
		'outStream',
		'closed'
	],
	#category : 'Mcp-Tests'
}

{ #category : 'instance creation' }
McpMockSocket class >> on: aRequestString [
  "A mock socket pre-loaded with a raw HTTP request, delivering it in one chunk."
  ^self on: aRequestString chunkSize: 1000000

]

{ #category : 'instance creation' }
McpMockSocket class >> on: aRequestString chunkSize: anInteger [
  "chunkSize caps each readString: result, to exercise multi-read / partial-read paths."
  ^self new setInput: aRequestString chunkSize: anInteger

]

{ #category : 'socket protocol' }
McpMockSocket >> close [
  closed := true

]

{ #category : 'accessing' }
McpMockSocket >> isClosed [
  ^closed

]

{ #category : 'accessing' }
McpMockSocket >> output [
  "The raw bytes the server wrote back (the HTTP response)."
  ^outStream contents

]

{ #category : 'socket protocol' }
McpMockSocket >> readString: maxBytes [
  "Return up to (maxBytes min: chunkSize) bytes from the remaining input, or '' at EOF."
  | avail take s |
  avail := input size - pos + 1.
  avail <= 0 ifTrue: [^''].
  take := (maxBytes min: chunkSize) min: avail.
  s := input copyFrom: pos to: pos + take - 1.
  pos := pos + take.
  ^s

]

{ #category : 'socket protocol' }
McpMockSocket >> readWillNotBlockWithin: ms [
  "Data is always 'ready' in the mock (or we are at EOF, where readString: returns empty)."
  ^true

]

{ #category : 'initialization' }
McpMockSocket >> setInput: aRequestString chunkSize: anInteger [
  input := aRequestString.
  pos := 1.
  chunkSize := anInteger.
  outStream := WriteStream on: String new.
  closed := false.
  ^self

]

{ #category : 'socket protocol' }
McpMockSocket >> write: aString [
  outStream nextPutAll: aString.
  ^aString size

]
