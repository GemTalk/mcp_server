set compile_env: 0
! ------------------- Class definition for McpLifetimeTest
expectvalue /Class
doit
GsTestCase subclass: 'McpLifetimeTest'
  instVarNames: #()
  classVars: #()
  classInstVars: #()
  poolDictionaries: #()
  inDictionary: Published
  options: #()

%
expectvalue /Class
doit
McpLifetimeTest comment: 
'How long a session lives, and what the front end is entitled to conclude before ending one.

McpStreamTest covers the PATHWAY -- the stream, the outbox, the return path. This covers the POLICY
that rides on it, which is a separate thing and a configurable one: how long a client may be quiet,
whether it may be quiet forever, what an unanswered ping proves, and what happens to all of it when
the host was asleep.

The four questions each group answers:
  - config: the intervals are deployment policy, not literals in a method, and they travel to a
    forked child gem with everything else. A short-timeout hosted auth server and a localhost server
    a developer comes back to after lunch are the same code with different numbers.
  - liveness: an unanswered ping is evidence of death ONLY if it went down the stream the client is
    still on. Both shipping clients reconnect a dropped stream on their own, so a ping written to a
    stream that has since been replaced is a message nobody could ever have answered -- and reaping
    on that silence frees the worker gem of a client that is awake and connected.
  - indefinite: with no wall-clock deadline the ping stops being an optimization and becomes the
    whole policy. What keeps that from being a gem leak is the pair around it: a failed probe always
    reaps, and a client that never opens a stream (so can never be pinged) still has a floor.
  - counting: idleness is a COUNT of liveness pings the client answered while doing no work, and
    unreachability a count of passes on which there was no stream to ask down. Nothing here is an
    elapsed time, which is why a suspended host cannot manufacture any of it: a front end that is
    not running holds no maintenance passes, so every count simply stops. There is no suspend to
    detect and nothing to forgive.

Sessions are McpStubSession or McpMockSession (no gem, no NETLDI) and the router is McpFixtureRouter
-- a shipping McpRouter that reports itself running without a listener. Everything under test is the
real implementation.'
%
expectvalue /Class
doit
McpLifetimeTest category: 'Mcp-Tests'
%
! ------------------- Remove existing behavior from McpLifetimeTest
removeallmethods McpLifetimeTest
removeallclassmethods McpLifetimeTest
! ------------------- Class methods for McpLifetimeTest
! ------------------- Instance methods for McpLifetimeTest
category: 'helpers'
method: McpLifetimeTest
includesCS: aSubstring in: aString
  "Case-sensitive substring test. GemStone's String>>includesString: is case-INsensitive, so use
   findString:startingAt: for assert:/deny: substring checks."
  ^(aString findString: aSubstring startingAt: 1) > 0
%
category: 'running'
method: McpLifetimeTest
setUp
  "No per-test state: each test builds its router and session as stack locals, since the framework
   nils a test's instance variables between tests."
  ^self
%
category: 'helpers'
method: McpLifetimeTest
streamedSessionOn: aRouter
  "A registered session with an SSE stream attached -- the state every liveness question is asked in."
  | sess |
  sess := aRouter openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess outbox attachStream.
  ^sess
%
category: 'tests - counting'
method: McpLifetimeTest
testAClientRequestResetsEverythingCounted
  "A request is better evidence of life than any ping answer, and it means the session is not idle."
  | r sess |
  r := McpFixtureRouter new.
  sess := self streamedSessionOn: r.
  sess noteProbeSent; noteAlive; noteProbeSent.
  self assert: sess quietProbes equals: 1.
  self assert: sess unansweredProbes equals: 1.
  sess touch.
  self assert: sess quietProbes equals: 0.
  self assert: sess unansweredProbes equals: 0.
  self assert: sess passesSinceProbe equals: 0
%
category: 'tests - departure'
method: McpLifetimeTest
testAClientThatKeepsCallingSurvivesLosingItsStream
  "A client is not obliged to hold a stream, and one making tool calls is alive on better evidence
   than the transport could ever offer. Its dropped stream must not cost it a worker gem ten seconds
   later -- which is what the activity stamp taken before the grace is for. Driven through the
   verdict half directly, since 'a request arrived while we waited' is otherwise a race to stage."
  | r sess stale |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  stale := sess lastActivitySeconds - 1.        "as if the client had called during the grace"
  r releaseAbandonedSession: sess unlessActiveSince: stale.
  self deny: sess streamClosedByClient.
  self assert: (r sessionAt: sess id) notNil.
  "and a client that did nothing at all is released by the same method"
  r releaseAbandonedSession: sess unlessActiveSince: sess lastActivitySeconds.
  self assert: sess streamClosedByClient.
  self assert: (r sessionAt: sess id) isNil
%
category: 'tests - departure'
method: McpLifetimeTest
testAClosedStreamProvesNothingWhileAStreamIsOpen
  "The pairing that makes the flag safe to act on: it is read together with the present state of the
   outbox, never alone. A client holding a stream cannot be the client that went away, whatever was
   concluded about an earlier connection of its own."
  | r sess |
  r := McpFixtureRouter new.
  sess := self streamedSessionOn: r.
  sess noteStreamClosedByClient.
  self assert: sess outbox hasStream.
  self assert: (r reapReasonFor: sess) isNil
%
category: 'tests - departure'
method: McpLifetimeTest
testAClosedStreamReleasesTheGemWithoutWaitingForTheFloor
  "The point of the whole mechanism. A client that closed its own connection is not merely quiet,
   and need not be counted at for the length of a floor written for a client that never connected."
  | r sess |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  self assert: (r reapReasonFor: sess) isNil.
  sess noteStreamClosedByClient.
  self assert: (self includesCS: 'closed the event stream' in: (r reapReasonFor: sess)).
  self assert: sess streamlessPasses equals: 0     "not one pass has had to go by"
%
category: 'tests - counting'
method: McpLifetimeTest
testAnAnsweredPingWithNoWorkInBetweenIsOneConfirmation
  | r sess |
  r := McpFixtureRouter new.
  sess := self streamedSessionOn: r.
  sess noteProbeSent.
  self assert: sess unansweredProbes equals: 1.
  sess noteAlive.
  self assert: sess quietProbes equals: 1.
  self assert: sess unansweredProbes equals: 0
%
category: 'tests - expiry'
method: McpLifetimeTest
testAnExpiredButUnreapedSessionIsStillRenewable
  "The reaper runs on an interval, so a session can sit expired for up to one pass before it goes.
   A client presenting a valid fresh token inside that window is exactly the client that should keep
   its gem: the gap is an artefact of scheduling, not a statement about the credential."
  | sess now |
  now := System timeGmt.
  sess := McpSession new.
  sess expiresAtSeconds: now - 5.
  self assert: sess isExpired.
  self assert: (sess renewExpiryTo: now + 900).
  self deny: sess isExpired
%
category: 'tests - expiry'
method: McpLifetimeTest
testAnExpiredSessionGoesWhateverElseIsTrue
  "Expiry is the one ground that is not inferred from anything: no probe, no grace, no forgiveness.
   A session opened under a credential must not outlive it."
  | r sess |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: nil.
  sess := self streamedSessionOn: r.
  sess noteAlive.
  sess expiresAtSeconds: System timeGmt - 1.
  self assert: sess isExpired.
  self assert: (self includesCS: 'access credential expired' in: (r reapReasonFor: sess)).
  self assert: r reapIdleSessions equals: 1.
  "the reason is for the gem log now; the client is not told, and meets a 404 on its next call"
  self assert: sess outbox size equals: 0
%
category: 'tests - expiry'
method: McpLifetimeTest
testAnExpiryOnlyEverMovesEarlier
  "Two things set it -- a router's maxSessionLifetimeSeconds and an authenticated router's token exp
   -- and neither may hand a session more life than the other allowed."
  | sess now |
  now := System timeGmt.
  sess := McpSession new.
  self assert: sess expiresAtSeconds isNil.
  sess expiresAtSeconds: now + 100.
  sess expiresAtSeconds: now + 500.
  self assert: sess expiresAtSeconds equals: now + 100.
  sess expiresAtSeconds: now + 50.
  self assert: sess expiresAtSeconds equals: now + 50.
  sess expiresAtSeconds: nil.
  self assert: sess expiresAtSeconds equals: now + 50
%
category: 'tests - counting'
method: McpLifetimeTest
testAnIndefiniteSessionIsNeverReapedForIdleness
  "With no deadline the confirmations still accrue; they simply mean nothing to the reaper."
  | r sess |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: nil.
  sess := self streamedSessionOn: r.
  1 to: 50 do: [:i | sess noteProbeSent; noteAlive].
  self assert: sess quietProbes equals: 50.
  self assert: (r reapReasonFor: sess) isNil
%
category: 'tests - counting'
method: McpLifetimeTest
testAnIntervalThatDoesNotDivideRoundsUp
  "A configured timeout is a floor on what the deployment gets, not a ceiling. 150 seconds against a
   60-second pass has to be three passes and not two, or the number in the configuration would be
   the most anybody ever waited rather than the least."
  | r |
  r := McpFixtureRouter new.
  self assert: (r countCovering: 150 every: 60) equals: 3.
  self assert: (r countCovering: 180 every: 60) equals: 3.
  self assert: (r countCovering: 181 every: 60) equals: 4.
  self assert: (r countCovering: 1 every: 60) equals: 1.
  r livenessProbeIntervalSeconds: 90; reaperIntervalSeconds: 60.
  self assert: r probePassInterval equals: 2
%
category: 'tests - liveness'
method: McpLifetimeTest
testAProbeLostToAStreamHandoverIsDiscardedNotCondemned
  "The defect the 2026-08-23 client runs turned up: 6 of 14 pings never reached their client because
   they were written to a stream the client had already replaced. The write SUCCEEDS -- into a socket
   buffer nobody will ever read again -- so nothing in the router notices, and the silence would be
   read as proof of death while the client is awake and connected.
   Now that a ping is counted at SEND, the correction is to take that count back."
  | r sess |
  r := McpFixtureRouter new.
  sess := self streamedSessionOn: r.
  self assert: (r probeSession: sess).
  self assert: sess unansweredProbes equals: 1.
  "the client's stream drops and it reconnects -- latest-GET-wins supersedes the generation the
   ping was written to"
  sess outbox attachStream.
  self assert: (r retirePendingProbesFor: sess) equals: 1.
  self assert: sess unansweredProbes equals: 0.
  self assert: (r reapReasonFor: sess) isNil
%
category: 'tests - liveness'
method: McpLifetimeTest
testAProbeWithNoStreamAtAllProvesNothing
  "The same rule at its limit. A request queued while no stream was attached carries no generation,
   so its silence is inadmissible for the same reason: nothing could have carried it."
  | r sess |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  self assert: (r sendRequest: 'ping' params: nil toSession: sess) notNil.
  sess noteProbeSent.
  self assert: (r retirePendingProbesFor: sess) equals: 1.
  self assert: sess unansweredProbes equals: 0
%
category: 'tests - departure'
method: McpLifetimeTest
testAReconnectRetractsADepartureAlreadyNoticed
  "Both shipping clients reopen a dropped stream on their own, and one of them does it by closing
   first. The arriving GET sends #noteStreamSeen, so the retraction does not wait for a pass."
  | r sess |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  sess noteStreamClosedByClient.
  self assert: sess streamClosedByClient.
  sess noteStreamSeen.
  self deny: sess streamClosedByClient.
  self assert: (r reapReasonFor: sess) isNil
%
category: 'tests - expiry'
method: McpLifetimeTest
testARefreshedTokenExtendsAnExistingDeadline
  "The point of the whole renewal path: a client that keeps proving its authorization keeps its
   worker gem, instead of losing it -- and the uncommitted transaction in it -- one access-token
   lifetime after the session opened."
  | sess now |
  now := System timeGmt.
  sess := McpSession new.
  sess expiresAtSeconds: now + 100.
  self assert: (sess renewExpiryTo: now + 900).
  self assert: sess expiresAtSeconds equals: now + 900
%
category: 'tests - counting'
method: McpLifetimeTest
testASessionGoesAtTheConfirmationCount
  | r sess |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: 1800; livenessProbeIntervalSeconds: 300.
  sess := self streamedSessionOn: r.
  self assert: r confirmationsBeforeRelease equals: 6.
  1 to: 5 do: [:i | sess noteProbeSent; noteAlive].
  self assert: (r reapReasonFor: sess) isNil.
  sess noteProbeSent; noteAlive.
  self assert: (self includesCS: 'idle' in: (r reapReasonFor: sess))
%
category: 'tests - unreachable'
method: McpLifetimeTest
testAStreamlessSessionIsReleasedAfterEnoughPasses
  "The give-up rule, and the only one that acts on absence rather than evidence -- because a client
   that opens no stream can be asked nothing at all."
  | r sess |
  r := McpFixtureRouter new.
  r streamlessIdleTimeoutSeconds: 300; reaperIntervalSeconds: 60.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  self assert: r streamlessPassesBeforeRelease equals: 6.
  1 to: 5 do: [:i | sess notePassWithStream: false].
  self assert: (r reapReasonFor: sess) isNil.
  sess notePassWithStream: false.
  self assert: (self includesCS: 'no event stream' in: (r reapReasonFor: sess))
%
category: 'tests - unreachable'
method: McpLifetimeTest
testAStreamSeenResetsTheStreamlessCount
  "A client that reconnects has proved reachability again, which is the whole thing being counted."
  | r sess |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  1 to: 20 do: [:i | sess notePassWithStream: false].
  self assert: sess streamlessPasses equals: 20.
  sess notePassWithStream: true.
  self assert: sess streamlessPasses equals: 0
%
category: 'tests - departure'
method: McpLifetimeTest
testAWorkingClientIsNeverReleasedForAStreamItLost
  "A request is proof of life the transport cannot argue with, and it has to clear BOTH things the
   transport concluded from silence. Before this, a client whose stream had dropped went on
   accruing streamless passes while it worked -- survivable at a thirty-minute floor, and not at all
   beside a ten-second grace."
  | r sess |
  r := McpFixtureRouter new.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  1 to: 20 do: [:i | sess notePassWithStream: false].
  sess noteStreamClosedByClient.
  self assert: (r reapReasonFor: sess) notNil.
  sess touch.
  self deny: sess streamClosedByClient.
  self assert: sess streamlessPasses equals: 0.
  self assert: (r reapReasonFor: sess) isNil
%
category: 'tests - departure'
method: McpLifetimeTest
testAZeroGraceIsAValidConfigurationAndNilIsADifferentOne
  "The two are opposites and both are meaningful, so validation has to admit zero -- which
   #validateSeconds:named:allowingNil: would not, since every other interval is a period rather than
   a wait. Worth a test because the tests here USE a zero grace, and would have gone on passing
   against a configuration no deployment could actually start."
  | r |
  r := McpRouter new.
  r streamLossGraceSeconds: 0.
  self assert: r validateTimerConfig == r.
  r streamLossGraceSeconds: nil.
  self assert: r validateTimerConfig == r.
  r streamLossGraceSeconds: -5.
  self should: [r validateTimerConfig] raise: Error
%
category: 'tests - shutdown'
method: McpLifetimeTest
testClosingAllSessionsReleasesEveryWorkerWhateverThePolicySays
  "#closeAllSessions is the shutdown counterpart to the reaper, and asks none of the reaper's
   questions. Both sessions here are ones #reapReasonFor: would SPARE -- streamed, just touched, no
   deadline -- and both go anyway, unmapped as well as closed, because the caller is finished with
   the router. It answers the count so a caller can log what it let go, and it is safe to send twice:
   the second call finds nothing and says so rather than failing.
   Worth a test of its own because the alternative was invisible. A worker gem is a real login, not
   an object, so a router that is merely dropped on the floor leaks one login slot per session it
   ever opened -- which is what the auth tests did until they were given this to call."
  | r a b |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: nil.
  a := self streamedSessionOn: r.
  b := self streamedSessionOn: r.
  a touch.
  b touch.
  self assert: (r reapReasonFor: a) isNil.
  self assert: (r reapReasonFor: b) isNil.
  self assert: r closeAllSessions equals: 2.
  self assert: (r sessionAt: a id) isNil.
  self assert: (r sessionAt: b id) isNil.
  self assert: a outbox isClosing.
  self assert: b outbox isClosing.
  self assert: r closeAllSessions equals: 0
%
category: 'tests - counting'
method: McpLifetimeTest
testIdlenessIsCountedInPingsNotSeconds
  "The whole redesign in one assertion. A session that has been quiet for hours of wall time, but
   has never been asked and answered anything, is not idle by this server's measure -- because the
   hours might have been hours this server spent suspended, and it has no way to tell."
  | r sess |
  r := McpFixtureRouter new.
  sess := self streamedSessionOn: r.
  sess fakeIdleSeconds: 36000.
  self assert: sess quietProbes equals: 0.
  self assert: (r reapReasonFor: sess) isNil
%
category: 'tests - config'
method: McpLifetimeTest
testIntervalsTravelToAForkedChild
  "Config reaches a detached front end only by being serialized into the fork string, so an interval
   that does not round-trip is one that silently reverts to the default in the gem that actually
   serves clients. The null case is the one worth having a test for: 'no idle deadline' has to
   survive as an INSTRUCTION, and a key that is present-and-null is the only way JSON says that."
  | r child |
  r := McpRouter new.
  r requestTimeoutSeconds: nil;
    sessionIdleTimeoutSeconds: nil;
    streamlessIdleTimeoutSeconds: 900;
    streamLossGraceSeconds: 25;
    livenessProbeIntervalSeconds: 120;
    reaperIntervalSeconds: 30;
    maxSessionLifetimeSeconds: 7200;
    reapOnFailedProbe: false.
  child := McpRouter new applyConfigJson: r configJson.
  "'no request deadline' is an instruction too, and travels as present-and-null like the rest"
  self assert: child requestTimeoutSeconds isNil.
  self assert: child sessionIdleTimeoutSeconds isNil.
  self deny: child hasSessionIdleDeadline.
  self assert: child streamlessIdleTimeoutSeconds equals: 900.
  self assert: child streamLossGraceSeconds equals: 25.
  self assert: child livenessProbeIntervalSeconds equals: 120.
  self assert: child reaperIntervalSeconds equals: 30.
  self assert: child maxSessionLifetimeSeconds equals: 7200.
  "reapOnFailedProbe travelled, but is FORCED on where there is no deadline"
  self assert: child reapOnFailedProbe
%
category: 'tests - expiry'
method: McpLifetimeTest
testMaxSessionLifetimeBecomesAnExpiryAtOpen
  "The blunt cap, applied where every session passes through. Still wall-clock, deliberately: it is
   a bound on how long anyone may hold a gem, which is a question about time and not about evidence."
  | r sess |
  r := McpFixtureRouter new.
  r maxSessionLifetimeSeconds: 60.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  self assert: sess expiresAtSeconds notNil.
  self deny: sess isExpired.
  self assert: (sess expiresAtSeconds - System timeGmt) <= 60
%
category: 'tests - liveness'
method: McpLifetimeTest
testOneAnswerClearsTheWholeUnansweredRun
  "A late answer is still an answer: the client proved it is there, so the run starts again."
  | r sess |
  r := McpFixtureRouter new.
  sess := self streamedSessionOn: r.
  sess noteProbeSent; noteProbeSent.
  sess noteAlive.
  self assert: sess unansweredProbes equals: 0.
  self assert: (r reapReasonFor: sess) isNil
%
category: 'tests - liveness'
method: McpLifetimeTest
testProbesGoOutOnThePassCadenceNotTheClock
  | r sess |
  r := McpFixtureRouter new.
  r livenessProbeIntervalSeconds: 300; reaperIntervalSeconds: 60.
  sess := self streamedSessionOn: r.
  self assert: r probePassInterval equals: 5.
  1 to: 4 do: [:i | sess notePassWithStream: true].
  self deny: (r probeDue: sess).
  sess notePassWithStream: true.
  self assert: (r probeDue: sess)
%
category: 'tests - liveness'
method: McpLifetimeTest
testReapOnFailedProbeCanBeTurnedOff
  "A deployment may not want a verdict drawn from silence at all. Turning it off leaves the idle
   count and the streamless count as the only grounds."
  | r sess |
  r := McpFixtureRouter new.
  r reapOnFailedProbe: false.
  sess := self streamedSessionOn: r.
  1 to: 10 do: [:i | sess noteProbeSent].
  self assert: (r reapReasonFor: sess) isNil
%
category: 'tests - liveness'
method: McpLifetimeTest
testReapOnFailedProbeIsForcedOnWithNoDeadline
  "With no deadline it is the only thing that would ever end a session, so it cannot be turned off."
  | r |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: nil; reapOnFailedProbe: false.
  self assert: r reapOnFailedProbe
%
category: 'tests - expiry'
method: McpLifetimeTest
testRenewalIgnoresATokenWithNoReadableExpiry
  "tokenExpirySecondsOf: answers nil when exp cannot be read. That must not be taken as 'no
   deadline', which would turn a bounded session unbounded on a malformed claim."
  | sess now |
  now := System timeGmt.
  sess := McpSession new.
  sess expiresAtSeconds: now + 300.
  self deny: (sess renewExpiryTo: nil).
  self assert: sess expiresAtSeconds equals: now + 300
%
category: 'tests - expiry'
method: McpLifetimeTest
testRenewalNeverIntroducesADeadline
  "An unauthenticated router leaves expiresAtSeconds nil, and a session with no deadline must not
   acquire one from this path -- bounding a session is #expiresAtSeconds:'s job. Keeping the two
   selectors strictly complementary is what makes either safe to read on its own."
  | sess |
  sess := McpSession new.
  self assert: sess expiresAtSeconds isNil.
  self deny: (sess renewExpiryTo: System timeGmt + 900).
  self assert: sess expiresAtSeconds isNil
%
category: 'tests - expiry'
method: McpLifetimeTest
testRenewalNeverShortensAndSaysSoWhenItDoesNothing
  "Renewal is not the other half of a general setter: presenting the SAME token again (the common
   case, since every request carries one) must not move anything, and must report that it did not,
   so the caller does not log a renewal on every single request."
  | sess now |
  now := System timeGmt.
  sess := McpSession new.
  sess expiresAtSeconds: now + 500.
  self deny: (sess renewExpiryTo: now + 500).
  self deny: (sess renewExpiryTo: now + 200).
  self assert: sess expiresAtSeconds equals: now + 500
%
category: 'tests - counting'
method: McpLifetimeTest
testTheCountsOnlyMoveOnAMaintenancePass
  "The pass IS the clock. A front end that is not running holds no passes, so a suspended host
   advances nothing -- which is the property that replaced the suspend detector."
  | r sess |
  r := McpFixtureRouter new.
  sess := self streamedSessionOn: r.
  self assert: sess passesSinceProbe equals: 0.
  sess notePassWithStream: true.
  sess notePassWithStream: true.
  self assert: sess passesSinceProbe equals: 2.
  self assert: sess streamlessPasses equals: 0
%
category: 'tests - config'
method: McpLifetimeTest
testTheDefaultConfigurationValidates
  | r |
  r := McpRouter new.
  r validateTimerConfig.
  r sessionIdleTimeoutSeconds: nil.
  r validateTimerConfig
%
category: 'tests - departure'
method: McpLifetimeTest
testTheGraceCanBeTurnedOffAndTheFloorStillCatchesTheClient
  "nil grace means the fast path is not wanted -- a deployment behind something that drops streams
   routinely, say. Turning it off must not turn off the release: the streamless floor is exactly
   where such a client was handled before, and still is."
  | r sess |
  r := McpFixtureRouter new.
  r streamLossGraceSeconds: nil; streamlessIdleTimeoutSeconds: 300; reaperIntervalSeconds: 60.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  r releaseAbandonedSession: sess.
  self deny: sess streamClosedByClient.
  self assert: (r sessionAt: sess id) notNil.
  1 to: r streamlessPassesBeforeRelease do: [:i | sess notePassWithStream: false].
  self assert: (self includesCS: 'no event stream' in: (r reapReasonFor: sess))
%
category: 'tests - departure'
method: McpLifetimeTest
testTheGraceIsWaitedOutBeforeTheDepartureIsRecorded
  "Which is what keeps a clock out of #reapReasonFor:. By the time the flag is set it already means
   'the client did not come back', so the reaper never has to ask how long ago the stream closed --
   and a maintenance pass landing in the gap cannot pre-empt the grace."
  | r sess |
  r := McpFixtureRouter new.
  r streamLossGraceSeconds: 0.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  "a client that came back inside the grace is not recorded as having left, and is not reaped"
  sess outbox attachStream.
  r releaseAbandonedSession: sess.
  self deny: sess streamClosedByClient.
  self assert: (r sessionAt: sess id) notNil.
  "one that did not is recorded, and released by the same pass"
  sess outbox detachStream: sess outbox currentStreamGeneration.
  r releaseAbandonedSession: sess.
  self assert: sess streamClosedByClient.
  self assert: (r sessionAt: sess id) isNil
%
category: 'tests - counting'
method: McpLifetimeTest
testTheIdleDeadlineCountsAgainstTheCadenceActuallyDelivered
  "The compounding error, and the reason #realizedProbeIntervalSeconds exists. A 90-second probe
   interval on a 60-second pass really goes out every 120 seconds; dividing a 30-minute timeout by
   the 90 that was ASKED for would release the gem after twenty minutes of pings."
  | r |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: 1800; livenessProbeIntervalSeconds: 90; reaperIntervalSeconds: 60.
  self assert: r realizedProbeIntervalSeconds equals: 120.
  self assert: r confirmationsBeforeRelease equals: 15.
  self assert: r confirmationsBeforeRelease * r realizedProbeIntervalSeconds >= 1800
%
category: 'tests - counting'
method: McpLifetimeTest
testTheReapNoticeSaysANumberTheOperatorCanRecognise
  "The notice is often the only account of a reap anybody sees, so it has to name the interval that
   was actually configured. Flooring 60 seconds to '1 minutes' does neither."
  | r |
  r := McpFixtureRouter new.
  self assert: (r phraseForSeconds: 1800) equals: '30 minutes'.
  self assert: (r phraseForSeconds: 120) equals: '2 minutes'.
  self assert: (r phraseForSeconds: 60) equals: '1 minute'.
  self assert: (r phraseForSeconds: 90) equals: '90 seconds'.
  self assert: (r phraseForSeconds: 45) equals: '45 seconds'
%
category: 'tests - config'
method: McpLifetimeTest
testTheRequestDeadlineTravelsIntoEachSessionAsItOpens
  "The deadline is ROUTER config, and a session gets it the one way a session gets anything: pushed
   in as it is opened, before its worker is prepared. So the bootstrap call is under the deadline
   too -- a worker that hangs on preparation is no better than one that hangs on a request -- and a
   session opened before the setting changed keeps the deadline it was opened with."
  | r sess later |
  r := McpFixtureRouter new.
  r requestTimeoutSeconds: 90.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  self assert: sess requestTimeoutSeconds equals: 90.
  r requestTimeoutSeconds: nil.
  self assert: sess requestTimeoutSeconds equals: 90.
  later := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  self assert: later requestTimeoutSeconds isNil
%
category: 'tests - config'
method: McpLifetimeTest
testTheShippingDefaultsAreTheDocumentedOnes
  "A lock on the numbers a deployment gets without asking, and on what each one MEANS once the
   reaper has divided it -- which is the half that is easy to change by accident."
  | r |
  r := McpRouter new.
  self assert: r requestTimeoutSeconds equals: 45.
  self assert: r sessionIdleTimeoutSeconds equals: 1800.
  self assert: r streamlessIdleTimeoutSeconds equals: 60.
  self assert: r streamLossGraceSeconds equals: 10.
  self assert: r livenessProbeIntervalSeconds equals: 120.
  self assert: r reaperIntervalSeconds equals: 60.
  self assert: r maxSessionLifetimeSeconds isNil.
  self assert: r reapOnFailedProbe.
  "and what those seconds mean to the reaper"
  self assert: r confirmationsBeforeRelease equals: 15.
  self assert: r probePassInterval equals: 2.
  self assert: r realizedProbeIntervalSeconds equals: 120.
  self assert: r streamlessPassesBeforeRelease equals: 2.
  self assert: r validateTimerConfig == r
%
category: 'tests - unreachable'
method: McpLifetimeTest
testTheStreamlessCountPaysForThePassItStartsOn
  "The pass a session opens on is a fragment of an interval, not a whole one, so N passes prove only
   N-1 intervals of this server running. The extra pass is what keeps a 60-second timeout from
   meaning 'any moment now' for a session that opened just before a pass."
  | r sess |
  r := McpFixtureRouter new.
  r streamlessIdleTimeoutSeconds: 60; reaperIntervalSeconds: 60.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  self assert: r streamlessPassesBeforeRelease equals: 2.
  sess notePassWithStream: false.
  self assert: (r reapReasonFor: sess) isNil.
  sess notePassWithStream: false.
  self assert: (self includesCS: 'no event stream' in: (r reapReasonFor: sess))
%
category: 'tests - unreachable'
method: McpLifetimeTest
testTheStreamlessFloorAppliesEvenWithADeadline
  "It used to apply only where there was no idle deadline. That left a streamless session on a
   deadline router bounded by an idle count that can never advance, since it can never be pinged."
  | r sess |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: 1800; streamlessIdleTimeoutSeconds: 120; reaperIntervalSeconds: 60.
  sess := r openSessionCreating: [:newId | McpStubSession startWithId: newId].
  1 to: r streamlessPassesBeforeRelease do: [:i | sess notePassWithStream: false].
  self assert: (self includesCS: 'no event stream' in: (r reapReasonFor: sess))
%
category: 'tests - liveness'
method: McpLifetimeTest
testThreeUnansweredPingsCondemnAndTwoDoNot
  "The width of the evidence. One miss can be a client that is merely not scheduled -- a laptop in a
   brief maintenance wake, a paused VM -- and it will answer late. Three in a row on the stream the
   client is still holding is a different claim."
  | r sess |
  r := McpFixtureRouter new.
  sess := self streamedSessionOn: r.
  sess noteProbeSent; noteProbeSent.
  self assert: (r reapReasonFor: sess) isNil.
  sess noteProbeSent.
  self assert: (self includesCS: 'did not answer' in: (r reapReasonFor: sess))
%
category: 'tests - config'
method: McpLifetimeTest
testValidationRefusesAProbeShorterThanAPass
  "The division would floor to zero: a cadence of no passes at all."
  | r |
  r := McpRouter new.
  r livenessProbeIntervalSeconds: 10; reaperIntervalSeconds: 60.
  self should: [r validateTimerConfig] raise: Error
%
category: 'tests - config'
method: McpLifetimeTest
testValidationRefusesATimeoutShorterThanAProbeInterval
  "A session would be released before its client could be asked anything."
  | r |
  r := McpRouter new.
  r sessionIdleTimeoutSeconds: 60; livenessProbeIntervalSeconds: 300.
  self should: [r validateTimerConfig] raise: Error
%
