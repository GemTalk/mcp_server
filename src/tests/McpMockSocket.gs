set compile_env: 0
! ------------------- Class definition for McpMockSocket
expectvalue /Class
doit
Object subclass: 'McpMockSocket'
  instVarNames: #( input pos chunkSize
                    outStream closed)
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpMockSocket category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpMockSocket
removeallmethods McpMockSocket
removeallclassmethods McpMockSocket
! ------------------- Class methods for McpMockSocket
category: 'instance creation'
classmethod: McpMockSocket
on: aRequestString
  "A mock socket pre-loaded with a raw HTTP request, delivering it in one chunk."
  ^self on: aRequestString chunkSize: 1000000
%
category: 'instance creation'
classmethod: McpMockSocket
on: aRequestString chunkSize: anInteger
  "chunkSize caps each readString: result, to exercise multi-read / partial-read paths."
  ^self new setInput: aRequestString chunkSize: anInteger
%
! ------------------- Instance methods for McpMockSocket
category: 'socket protocol'
method: McpMockSocket
close
  closed := true
%
category: 'accessing'
method: McpMockSocket
isClosed
  ^closed
%
category: 'accessing'
method: McpMockSocket
output
  "The raw bytes the server wrote back (the HTTP response)."
  ^outStream contents
%
category: 'socket protocol'
method: McpMockSocket
readString: maxBytes
  "Return up to (maxBytes min: chunkSize) bytes from the remaining input, or '' at EOF."
  | avail take s |
  avail := input size - pos + 1.
  avail <= 0 ifTrue: [^''].
  take := (maxBytes min: chunkSize) min: avail.
  s := input copyFrom: pos to: pos + take - 1.
  pos := pos + take.
  ^s
%
category: 'socket protocol'
method: McpMockSocket
readWillNotBlockWithin: ms
  "Data is always 'ready' in the mock (or we are at EOF, where readString: returns empty)."
  ^true
%
category: 'initialization'
method: McpMockSocket
setInput: aRequestString chunkSize: anInteger
  input := aRequestString.
  pos := 1.
  chunkSize := anInteger.
  outStream := WriteStream on: String new.
  closed := false.
  ^self
%
category: 'socket protocol'
method: McpMockSocket
write: aString
  outStream nextPutAll: aString.
  ^aString size
%
category: 'socket protocol'
method: McpMockSocket
writeWillNotBlockWithin: ms
  "A mock socket always takes output. The real guard exists because GsSocket>>write: suspends the
   calling GsProcess with no timeout when the peer has stopped reading
   (McpHttpConnection>>writeSse:); nothing here can stall."
  ^true
%
