"
The class-browsing tools: describe a class, export its source, read its definition, walk its
hierarchy, read one method's source, list its selectors by category. All read-only-safe -- nothing
here can persist a change.

Handlers still live on McpServer (category 'tools - browsing'); see McpToolset's class comment on
that transitional seam.
"
Class {
	#name : 'McpBrowsingToolset',
	#superclass : 'McpToolset',
	#category : 'Mcp-Core'
}

{ #category : 'read-only' }
McpBrowsingToolset >> readOnlySafeToolNames [
  "Every browsing tool only reads."
  ^self toolNames

]

{ #category : 'registration' }
McpBrowsingToolset >> registerOn: aToolRegistry [
  | classArg |
  classArg := self objectSchema:
    (Dictionary new at: 'className' put: (self propString: 'Name of the class'); yourself)
    required: (Array with: 'className').
  aToolRegistry name: 'describe_class'
    description: 'Describe a class: superclass, instance variables, and selectors.'
    inputSchema: classArg do: [:args | server tool_describe_class: args].
  aToolRegistry name: 'export_class_source'
    description: 'Export a class as a Topaz file-in (class definition plus all methods).'
    inputSchema: classArg do: [:args | server tool_export_class_source: args].
  aToolRegistry name: 'get_class_definition'
    description: 'Return the class definition (superclass, instance/class variables, pools) as a source expression.'
    inputSchema: classArg do: [:args | server tool_get_class_definition: args].
  aToolRegistry name: 'get_class_hierarchy'
    description: 'Show the superclass chain (top-down, indented) and the direct subclasses of a class.'
    inputSchema: classArg do: [:args | server tool_get_class_hierarchy: args].
  aToolRegistry name: 'get_method_source'
    description: 'Return the source code of a method. Set meta=true for the class-side method.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'className' put: (self propString: 'Name of the class');
        at: 'selector' put: (self propString: 'Method selector, e.g. printOn:');
        at: 'meta' put: (self boolProperty: 'true for the class-side method (default false)');
        yourself)
      required: (Array with: 'className' with: 'selector'))
    do: [:args | server tool_get_method_source: args].
  aToolRegistry name: 'list_methods'
    description: 'List a class instance-side and class-side method selectors, grouped by category.'
    inputSchema: classArg do: [:args | server tool_list_methods: args].
  ^self

]

{ #category : 'accessing' }
McpBrowsingToolset >> toolNames [
  ^#( 'describe_class' 'export_class_source' 'get_class_definition' 'get_class_hierarchy'
      'get_method_source' 'list_methods' )

]
