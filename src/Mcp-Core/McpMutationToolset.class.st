"
The tools that change the image and commit: define/redefine a class, compile or delete a method,
set a class comment, add or remove a symbol dictionary.

NONE are read-only-safe (readOnlySafeToolNames is inherited, i.e. empty), so a read-only session
drops this toolset whole. Every handler additionally passes through McpServer's kernel guard
(assertMutableClass:), so even a read-write session cannot modify a protected class.

Handlers still live on McpServer (category 'tools - mutation'); see McpToolset's class comment on
that transitional seam.
"
Class {
	#name : 'McpMutationToolset',
	#superclass : 'McpToolset',
	#category : 'Mcp-Core'
}

{ #category : 'registration' }
McpMutationToolset >> registerOn: aToolRegistry [
  | classArg dictArg |
  classArg := self objectSchema:
    (Dictionary new at: 'className' put: (self propString: 'Name of the class'); yourself)
    required: (Array with: 'className').
  dictArg := self objectSchema:
    (Dictionary new at: 'dictionaryName' put: (self propString: 'Name of the symbol dictionary'); yourself)
    required: (Array with: 'dictionaryName').
  aToolRegistry name: 'add_dictionary'
    description: 'Create a new symbol dictionary, append it to the user symbol list, and commit.'
    inputSchema: dictArg do: [:args | server tool_add_dictionary: args].
  aToolRegistry name: 'compile_class_definition'
    description: 'Evaluate a class-definition expression (e.g. Object subclass: ... inDictionary: ...), then commit. The source must evaluate to a class; other expressions are rejected (use execute_code for those). On a shape-changing redefinition of an existing class, by default recompiles its existing methods onto the new version (a raw redefine drops them) and reports any that fail; refused if the class has subclasses.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'source' put: (self propString: 'Full class-definition Smalltalk expression including the subclass: send and inDictionary:');
        at: 'recompileMethods' put: (self boolProperty: 'Default true: after a shape change, recompile the class existing methods onto the new version and report failures (refused if the class has subclasses). False: redefine raw, dropping all methods.');
        yourself)
      required: (Array with: 'source'))
    do: [:args | server tool_compile_class_definition: args].
  aToolRegistry name: 'compile_method'
    description: 'Compile (add or update) a method on a class, then commit. Set meta=true for class-side. Category defaults to "mcp".'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'className' put: (self propString: 'Name of the class');
        at: 'source' put: (self propString: 'Full method source including the selector line');
        at: 'category' put: (self propString: 'Method category (optional, default mcp)');
        at: 'meta' put: (self boolProperty: 'true for the class-side method (default false)');
        yourself)
      required: (Array with: 'className' with: 'source'))
    do: [:args | server tool_compile_method: args].
  aToolRegistry name: 'delete_class'
    description: 'Remove a class from its dictionary and commit. Destructive.'
    inputSchema: classArg do: [:args | server tool_delete_class: args].
  aToolRegistry name: 'delete_method'
    description: 'Remove a method from a class and commit. Set meta=true for the class-side method. Destructive.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'className' put: (self propString: 'Name of the class');
        at: 'selector' put: (self propString: 'Selector of the method to remove');
        at: 'meta' put: (self boolProperty: 'true for the class-side method (default false)');
        yourself)
      required: (Array with: 'className' with: 'selector'))
    do: [:args | server tool_delete_method: args].
  aToolRegistry name: 'remove_dictionary'
    description: 'Remove a symbol dictionary from the user symbol list and commit. Destructive.'
    inputSchema: dictArg do: [:args | server tool_remove_dictionary: args].
  aToolRegistry name: 'set_class_comment'
    description: 'Set (replace) the class comment and commit.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'className' put: (self propString: 'Name of the class');
        at: 'comment' put: (self propString: 'New comment text');
        yourself)
      required: (Array with: 'className' with: 'comment'))
    do: [:args | server tool_set_class_comment: args].
  ^self

]

{ #category : 'accessing' }
McpMutationToolset >> toolNames [
  ^#( 'add_dictionary' 'compile_class_definition' 'compile_method' 'delete_class' 'delete_method'
      'remove_dictionary' 'set_class_comment' )

]
