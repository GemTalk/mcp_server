"
The optional GemStone-Python (Grail) tools: eval_python and compile_python. Its own package because
it loads ONLY into a Grail-equipped image -- a method referencing ModuleAst cannot be compiled
without Grail present -- so it is reached through a separate load spec (rowan/specs/McpGrail.ston,
i.e. install.sh --grail) rather than the default one.

A toolset rather than a server subclass, which is the point: python tools can now be combined with
anyone else's tools, whereas the old McpServerWithGrail was a rung in the hierarchy that a developer
wanting python tools AND their own had to inherit from. It is picked up automatically by
McpServer class>>installedDefaultToolsetNames once this package is loaded, or named explicitly in a
router's toolsetNames.

Like every toolset it owns its handlers (see McpToolset), and needing no server-level policy it never
touches `server` at all -- so it also serves as the worked example for a third-party toolset. NOT
read-only-safe: readOnlySafeToolNames is inherited (empty), so
a read-only session drops both tools -- running arbitrary Python can persist anything.

The handlers DO catch Python exceptions, unlike every core tool, and they have to: Grail models them
outside the Smalltalk Error hierarchy (NameError is Exception < BaseException < Exception <
AbstractException, and `NameError inheritsFrom: Error` is false), so McpDispatcher's `on: Error do:`
cannot see them. Uncaught, a python-tool error would escape the dispatcher and take the whole worker
gem down instead of answering the client. withPythonErrorsAsMcpError: converts them into an McpError
kinded #pythonError, which the dispatcher then reports as an ordinary isError result. Smalltalk Errors
are deliberately left to the dispatcher, which already classifies them.

No ModuleAst capability check is performed: this package only loads into an image that has Grail.
"
Class {
	#name : 'McpGrailToolset',
	#superclass : 'McpToolset',
	#category : 'Mcp-Grail'
}

{ #category : 'registration' }
McpGrailToolset >> registerOn: aToolRegistry [
  "Register the two python tools. These require an image with GemStone-Python (Grail/ModuleAst);
   no capability check is performed, since this package cannot load without it."
  | codeArg |
  codeArg := self objectSchema:
    (Dictionary new at: 'code' put: (self propString: 'Python source code'); yourself)
    required: (Array with: 'code').
  aToolRegistry name: 'compile_python'
    description: 'Transpile Python source to Smalltalk via Grail (ModuleAst) and return the generated Smalltalk source. Requires GemStone-Python in the image.'
    inputSchema: codeArg do: [:args | self tool_compile_python: args].
  aToolRegistry name: 'eval_python'
    description: 'Evaluate Python source via Grail (ModuleAst) and return the printString of the result. Requires GemStone-Python in the image.'
    inputSchema: codeArg do: [:args | self tool_eval_python: args].
  ^self

]

{ #category : 'tools - python' }
McpGrailToolset >> tool_compile_python: args [
  "Transpile Python source to Smalltalk via Grail and answer the generated source. capResult: is the
   shared 50k output cap (McpToolset); Python errors become #pythonError (withPythonErrorsAsMcpError:)."
  ^self withPythonErrorsAsMcpError: [
    self capResult: (ModuleAst parseSource: (args at: 'code')) smalltalkSource]

]

{ #category : 'tools - python' }
McpGrailToolset >> tool_eval_python: args [
  "Evaluate Python source via Grail and answer the printString of the result. capResult: is the
   shared 50k output cap (McpToolset); Python errors become #pythonError (withPythonErrorsAsMcpError:)."
  ^self withPythonErrorsAsMcpError: [
    self capResult: (ModuleAst evaluateSource: (args at: 'code')) printString]

]

{ #category : 'accessing' }
McpGrailToolset >> toolNames [
  ^#( 'compile_python' 'eval_python' )

]

{ #category : 'private' }
McpGrailToolset >> withPythonErrorsAsMcpError: aBlock [
  "Run aBlock, converting a PYTHON exception into an McpError kinded #pythonError so the dispatcher
   answers the client an ordinary tool error. Required because Grail's Python exceptions are not
   Error subclasses (see the class comment), so McpDispatcher's `on: Error do:` cannot catch them and
   an uncaught one would take the worker gem down. Catches BaseException, the root of Python's own
   hierarchy -- deliberately NOT AbstractException, which would also swallow halts and interrupts,
   and deliberately not Smalltalk Errors, which the dispatcher already classifies."
  ^[aBlock value]
    on: BaseException
    do: [:ex | McpError signalKind: #pythonError message:
      ex class name asString , ': ' , ([ex description] on: Error do: [:x | '(no detail available)'])]

]

