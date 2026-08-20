set compile_env: 0
! ------------------- Class definition for McpBrowsingToolset
expectvalue /Class
doit
McpToolset subclass: 'McpBrowsingToolset'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpBrowsingToolset comment: 
'The class-browsing tools: describe a class, export its source, read its definition, walk its
hierarchy, read one method''s source, list its selectors by category. All read-only-safe -- nothing
here can persist a change, so none of these handlers needs the server''s kernel guard.'
%
expectvalue /Class
doit
McpBrowsingToolset category: 'Mcp-Core'
%
! ------------------- Remove existing behavior from McpBrowsingToolset
removeallmethods McpBrowsingToolset
removeallclassmethods McpBrowsingToolset
! ------------------- Class methods for McpBrowsingToolset
! ------------------- Instance methods for McpBrowsingToolset
category: 'private'
method: McpBrowsingToolset
methodsReportFor: aBehavior label: aLabel
  "Group aBehavior's selectors by category into a readable report."
  | byCat s |
  byCat := Dictionary new.
  aBehavior selectors do: [:sel | | cat |
    cat := (aBehavior categoryOfSelector: sel) ifNil: [#'(uncategorized)'].
    (byCat at: cat asString ifAbsentPut: [OrderedCollection new]) add: sel asString].
  s := WriteStream on: String new.
  s nextPutAll: aLabel; nextPutAll: ' methods:'; nextPut: Character lf.
  byCat keys asSortedCollection do: [:cat |
    s nextPutAll: '  '; nextPutAll: cat; nextPut: Character lf.
    (byCat at: cat) asSortedCollection do: [:sel | s nextPutAll: '    '; nextPutAll: sel; nextPut: Character lf]].
  ^s contents
%
category: 'read-only'
method: McpBrowsingToolset
readOnlySafeToolNames
  "Every browsing tool only reads."
  ^self toolNames
%
category: 'registration'
method: McpBrowsingToolset
registerOn: aToolRegistry
  | classArg |
  classArg := self objectSchema:
    (Dictionary new at: 'className' put: (self propString: 'Name of the class'); yourself)
    required: (Array with: 'className').
  aToolRegistry name: 'describe_class'
    description: 'Describe a class: superclass, instance variables, and selectors.'
    inputSchema: classArg do: [:args | self tool_describe_class: args].
  aToolRegistry name: 'export_class_source'
    description: 'Export a class as a Topaz file-in (class definition plus all methods).'
    inputSchema: classArg do: [:args | self tool_export_class_source: args].
  aToolRegistry name: 'get_class_definition'
    description: 'Return the class definition (superclass, instance/class variables, pools) as a source expression.'
    inputSchema: classArg do: [:args | self tool_get_class_definition: args].
  aToolRegistry name: 'get_class_hierarchy'
    description: 'Show the superclass chain (top-down, indented) and the direct subclasses of a class.'
    inputSchema: classArg do: [:args | self tool_get_class_hierarchy: args].
  aToolRegistry name: 'get_method_source'
    description: 'Return the source code of a method. Set meta=true for the class-side method.'
    inputSchema: (self objectSchema:
      (Dictionary new
        at: 'className' put: (self propString: 'Name of the class');
        at: 'selector' put: (self propString: 'Method selector, e.g. printOn:');
        at: 'meta' put: (self boolProperty: 'true for the class-side method (default false)');
        yourself)
      required: (Array with: 'className' with: 'selector'))
    do: [:args | self tool_get_method_source: args].
  aToolRegistry name: 'list_methods'
    description: 'List a class instance-side and class-side method selectors, grouped by category.'
    inputSchema: classArg do: [:args | self tool_list_methods: args].
  ^self
%
category: 'tools - browsing'
method: McpBrowsingToolset
tool_describe_class: args
  | cls nl |
  cls := self resolveClass: (args at: 'className').
  nl := String with: Character lf.
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      'name=' , cls name , nl ,
      'superclass=' , (cls superclass isNil ifTrue: ['nil'] ifFalse: [cls superclass name]) , nl ,
      'instVarNames=' , cls instVarNames printString , nl ,
      'selectors=' , (cls selectors asSortedCollection asArray) printString]
%
category: 'tools - browsing'
method: McpBrowsingToolset
tool_export_class_source: args
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil ifTrue: ['Class not found: ' , (args at: 'className')] ifFalse: [cls fileOutClass]
%
category: 'tools - browsing'
method: McpBrowsingToolset
tool_get_class_definition: args
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil ifTrue: ['Class not found: ' , (args at: 'className')] ifFalse: [cls definition]
%
category: 'tools - browsing'
method: McpBrowsingToolset
tool_get_class_hierarchy: args
  | cls s chain c subs |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil ifTrue: ['Class not found: ' , (args at: 'className')] ifFalse: [
    s := WriteStream on: String new.
    chain := OrderedCollection new. c := cls.
    [c notNil] whileTrue: [chain addFirst: c. c := c superclass].
    1 to: chain size do: [:i |
      ((i - 1) * 2) timesRepeat: [s nextPut: Character space].
      s nextPutAll: (chain at: i) name asString; nextPut: Character lf].
    s nextPutAll: 'Direct subclasses:'; nextPut: Character lf.
    subs := (cls subclasses collect: [:x | x name asString]).
    subs isEmpty
      ifTrue: [s nextPutAll: '  (none)']
      ifFalse: [subs asSortedCollection do: [:n | s nextPutAll: '  '; nextPutAll: n; nextPut: Character lf]].
    s contents]
%
category: 'tools - browsing'
method: McpBrowsingToolset
tool_get_method_source: args
  | cls target src |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil
    ifTrue: ['Class not found: ' , (args at: 'className')]
    ifFalse: [
      target := ((args at: 'meta' ifAbsent: [false]) == true) ifTrue: [cls class] ifFalse: [cls].
      src := [target sourceCodeAt: (args at: 'selector') asSymbol] on: Error do: [:ex | nil].
      src isNil
        ifTrue: ['No such method: ' , (args at: 'className') , '>>' , (args at: 'selector')]
        ifFalse: [src]]
%
category: 'tools - browsing'
method: McpBrowsingToolset
tool_list_methods: args
  | cls |
  cls := self resolveClass: (args at: 'className').
  ^cls isNil ifTrue: ['Class not found: ' , (args at: 'className')] ifFalse: [
    (self methodsReportFor: cls label: 'Instance') , (String with: Character lf)
      , (self methodsReportFor: cls class label: 'Class')]
%
category: 'accessing'
method: McpBrowsingToolset
toolNames
  ^#( 'describe_class' 'export_class_source' 'get_class_definition' 'get_class_hierarchy'
      'get_method_source' 'list_methods' )
%
