set compile_env: 0
! ------------------- Class definition for McpExternalSessionTest
expectvalue /Class
doit
GsTestCase subclass: 'McpExternalSessionTest'
  instVarNames: #( session )
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpExternalSessionTest comment: 
'Checks that a result fetched out of a worker gem arrives with the bytes the worker actually sent.

This suite tests the IMAGE, not gs-mcp. A failure here means the running GemStone carries kernel
defect #51438 in GsTsExternalSession>>resolveResult:, fixed in 3.7.4.1. Nothing in src/ can be
edited to make it pass; the answer is to run on 3.7.4.1 or later.

WHAT THE DEFECT IS. resolveResult: fetches at most 1024 bytes into a per-session buffer, then
refetches the whole object only when the buffer has to GROW. Those are the same condition only
while the buffer is still its original 1024 bytes. Once one large result has enlarged it, every
later result between 1025 bytes and that size skips the refetch and is read out of the stale
buffer: the first 1024 bytes are this result''s, the rest is the tail of an earlier one. The
length comes from freshly fetched object info, so it is always right.

WHY IT MATTERS HERE. gs-mcp meets this on its main path, not in a corner: every MCP response is a
String of JSON pulled out of a worker gem by exactly this mechanism, and responses over 1024 bytes
are ordinary (a tools/list or a class listing is tens of KB). The damage is silent -- right length,
plausible bytes -- and surfaces as JSON that fails to parse somewhere in the middle, which reads
like a bug in whatever built the JSON and is not.

HOW THEY ARE BUILT. Each test drives a real McpSession over a real worker gem, through
McpSession>>runWorker: -- the same call the forwarding path uses -- so what is measured is the path
the server actually runs on. That means A NETLDI MUST BE RUNNING; run-unit-tests.sh insists on one
whenever this suite is installed. Each test also takes its OWN session, because the defect is a
property of one GsTsExternalSession''s buffer: the buffer only ever grows, and logout does not
clear it, so a session that has fetched one large result stays poisoned for the rest of its life.

Three of the five tests pass on EVERY version, and are here to localise a failure rather than to
find one: a result within the initial fetch, the first large result on a session, and a result too
big for the buffer it finds. The other two are the ones an affected image fails.

So three green and two red is the signature of #51438 exactly. Any other split points somewhere
else: all five red, or a control red, means a broken netldi, a dead worker or a bad harness rather
than the kernel defect.'
%
expectvalue /Class
doit
McpExternalSessionTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpExternalSessionTest
removeallmethods McpExternalSessionTest
removeallclassmethods McpExternalSessionTest
! ------------------- Class methods for McpExternalSessionTest
! ------------------- Instance methods for McpExternalSessionTest
category: 'helpers'
method: McpExternalSessionTest
assertResultOfSize: aSize marker: aCharacter isIntactOn: aSession
  "Fetch aSize bytes of aCharacter through aSession and require every one of them to survive the
   trip. Answers the result so a caller can chain another fetch on the same session."
  | res intact |
  res := self fetch: aSize marker: aCharacter on: aSession.
  self assert: res size = aSize
    description: 'the worker answered ' , res size printString , ' bytes, not ' , aSize printString
      , '. That is a different failure from #51438, which always answers the RIGHT length.'.
  intact := self intactBytesIn: res marker: aCharacter.
  self assert: intact = aSize
    description: (self corruptionReportForSize: aSize intact: intact).
  ^res
%
category: 'helpers'
method: McpExternalSessionTest
corruptionReportForSize: aSize intact: anIntactCount
  "What was observed on ONE fetch, followed by what it means. Split that way so the sequence test,
   which has several fetches to report, can give its own observations the same explanation without
   inventing a fake size for this one."
  ^'RESULT CORRUPTION: a ' , aSize printString , '-byte result came back with only its first '
    , anIntactCount printString , ' bytes intact. The rest is the tail of an EARLIER result fetched'
    , ' on this same session.' , (String with: Character lf) , self defectExplanation
%
category: 'helpers'
method: McpExternalSessionTest
defectExplanation
  "Why a failure in this suite is a fact about the image, not a bug to fix in src/. Carried in the
   failure message because that is the only part of a red test run anyone reads, and a bare
   ''expected 2000, got 1024'' reads like a broken test."
  | lf |
  lf := String with: Character lf.
  ^'This is GemStone kernel defect #51438 in GsTsExternalSession>>resolveResult:, which refetches'
    , ' the object only when its 1024-byte fetch buffer must GROW. After one large result has'
    , ' enlarged the buffer, every later result between 1025 bytes and that size is read from the'
    , ' stale buffer. The length is taken from fresh object info, so it is always right and nothing'
    , ' announces the damage.' , lf
    , 'Fixed in 3.7.4.1; this image is older. Every MCP response over 1024 bytes is at risk on it,'
    , ' so the server cannot be trusted here without a workaround. gs-mcp is not at fault and no'
    , ' change to src/ can make this pass.'
%
category: 'helpers'
method: McpExternalSessionTest
fetch: aSize marker: aCharacter on: aSession
  "Ask the worker for a String of aSize bytes, every one aCharacter, and answer what arrives.
   Filled with an explicit at:put: loop rather than String new:withAll:, which is not present in
   every extent this suite has to run in. Give each fetch on a session its OWN marker: a stale tail
   is only recognisable as stale because it carries a different one."
  | n |
  n := aSize printString.
  ^aSession runWorker:
    '| s | s := String new: ' , n , '. 1 to: ' , n , ' do: [:i | s at: i put: $'
      , aCharacter asString , ']. s'
%
category: 'helpers'
method: McpExternalSessionTest
freshSession
  "A brand-new worker gem, remembered so tearDown can log it out. Every test needs its own: the
   fetch buffer is per-session, only ever grows, and is NOT cleared by logout -- _clearConnection
   nils tsSession, socket and lastResult but leaves objInfoBuffers alone, and _allocateBuffers
   allocates only ifNil:. Only a new session object starts over."
  session := McpSession startWithId: 'external-session-result-fidelity'.
  ^session
%
category: 'helpers'
method: McpExternalSessionTest
intactBytesIn: aResult marker: aCharacter
  "How many LEADING bytes of aResult are aCharacter. A leading run rather than a total count on
   purpose: it says where the damage starts, and under #51438 that answer is always exactly 1024,
   which is the fingerprint that separates this defect from a short read or a mangled encoding."
  | i |
  i := 0.
  [i < aResult size and: [(aResult at: i + 1) == aCharacter]] whileTrue: [i := i + 1].
  ^i
%
category: 'running'
method: McpExternalSessionTest
setUp
  "No session yet: each test asks for its own with #freshSession."
  session := nil
%
category: 'running'
method: McpExternalSessionTest
tearDown
  "Log the worker gem out. Guarded, because a test that failed mid-fetch still has to give the gem
   back, and a session that never logged in has nothing to close."
  session ifNotNil: [:s | [s close] on: Error do: [:e | nil]].
  session := nil
%
category: 'tests'
method: McpExternalSessionTest
testDocumentedSizeSequenceIsIntact
  "The whole documented sequence on ONE session, reporting every size that came back wrong instead
   of stopping at the first. On an affected image this maps the corrupt band exactly:

     5000 OK (grows the buffer)  2000 CORRUPT  500 OK (fits the initial fetch)
     3000 CORRUPT  9000 OK (exceeds the buffer, so it refetches)  2000 CORRUPT

   The alternating OK/CORRUPT pattern is the point: a result is safe when it is small enough to
   arrive whole in the first fetch OR too big for the buffer it finds, and corrupt in between."
  | s sizes markers bad |
  s := self freshSession.
  sizes := #( 5000 2000 500 3000 9000 2000 ).
  markers := 'abcdef'.
  bad := WriteStream on: String new.
  1 to: sizes size do: [:i | | sz mk res intact |
    sz := sizes at: i.
    mk := markers at: i.
    res := self fetch: sz marker: mk on: s.
    intact := self intactBytesIn: res marker: mk.
    intact = sz ifFalse: [
      bad nextPutAll: '  fetch ' , i printString , ' of ' , sz printString , ' bytes: only '
        , intact printString , ' intact'; nextPut: Character lf]].
  self assert: bad contents isEmpty
    description: 'RESULT CORRUPTION across a sequence of fetches on one session:'
      , (String with: Character lf) , bad contents , self defectExplanation
%
category: 'tests'
method: McpExternalSessionTest
testFirstLargeResultIsIntact
  "A CONTROL that passes on every version. The first over-1024 result on a session is correct even
   on an affected image, because it is the one that grows the buffer and the grow path is the one
   that refetches. Corruption starts with the SECOND. This is why a test that fetches one big
   result and stops finds nothing, and why a green test.sh was never evidence of a healthy image."
  self assertResultOfSize: 5000 marker: $a isIntactOn: self freshSession
%
category: 'tests'
method: McpExternalSessionTest
testResultLargerThanTheBufferIsIntact
  "A CONTROL that passes on every version. A result too big for the buffer it finds forces the
   grow-and-refetch path, so it arrives whole. That is why the damage is a BAND -- 1025 bytes up to
   the current buffer size -- and not a threshold above which everything breaks. It also rules out
   the reading that big results are simply unsafe."
  | s |
  s := self freshSession.
  self assertResultOfSize: 5000 marker: $a isIntactOn: s.
  self assertResultOfSize: 9000 marker: $b isIntactOn: s
%
category: 'tests'
method: McpExternalSessionTest
testResultWithinTheInitialFetchIsIntact
  "A CONTROL that passes on every version, including affected ones: at 1024 bytes or fewer the
   initial fetch already holds the whole object, so there is nothing to refetch. If THIS fails the
   fault is in the harness, the netldi or the worker gem -- not in #51438."
  self assertResultOfSize: 500 marker: $a isIntactOn: self freshSession
%
category: 'tests'
method: McpExternalSessionTest
testSmallerResultAfterALargeOneIsIntact
  "THE defect, in its smallest form: fetch 5000 bytes, then 2000 on the same session. The 2000-byte
   result is over the 1024 the initial fetch reads and under the buffer the 5000-byte result grew,
   so resolveResult: skips the refetch and answers 1024 good bytes followed by the tail of the
   5000. Distinct markers are what make that visible -- the length is right either way.

   This is the test that fails on 3.7.2 and passes on 3.7.5."
  | s |
  s := self freshSession.
  self assertResultOfSize: 5000 marker: $a isIntactOn: s.
  self assertResultOfSize: 2000 marker: $b isIntactOn: s
%
