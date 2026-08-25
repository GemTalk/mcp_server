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
  - suspend: everything here measures wall time, so a laptop that sleeps for two hours looks exactly
    like every client going idle at once. Without the detector the first pass after a wake frees
    every worker gem, including those of clients that are awake and one keystroke away.

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
category: 'helpers'
method: McpLifetimeTest
noticeIn: sess
  "Drain sess's outbox and answer the `data` text of the first notifications/message in it, or nil."
  | drained |
  drained := sess outbox drain asArray.
  drained do: [:each |
    | msg |
    msg := JsonParser parse: each.
    (msg at: 'method' ifAbsent: [nil]) = 'notifications/message'
      ifTrue: [^(msg at: 'params') at: 'data']].
  ^nil
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
  self assert: r reapIdleSessions equals: 1.
  self assert: (self includesCS: 'access credential expired' in: (self noticeIn: sess))
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
testAnExpiringSessionIsWarnedEvenWhenItIsNowhereNearIdle
  "The case the idle warning cannot cover. A client calling steadily is never probed, so it is never
   #isKnownAlive, so gating the expiry warning the way the idle warning is gated would mean the
   sessions most likely to reach an expiry are the only ones never told."
  | router sess |
  router := McpFixtureRouter new.
  sess := self streamedSessionOn: router.
  sess touch.
  sess expiresAtSeconds: System timeGmt + 60.
  self assert: (router expiryWarningDue: sess).
  self assert: (router maintainIdleSession: sess).
  self assert: sess expiryWarned.
  self assert: (self includesCS: 'reaches its time limit' in: (self noticeIn: sess))
%
category: 'tests - expiry'
method: McpLifetimeTest
testAnExpiryWarningIsSentOncePerDeadlineNotOncePerPass
  "The maintenance pass runs every minute; the warning must not go out on each one."
  | router sess |
  router := McpFixtureRouter new.
  sess := self streamedSessionOn: router.
  sess expiresAtSeconds: System timeGmt + 60.
  self assert: (router expiryWarningDue: sess).
  router warnExpiringSession: sess.
  self deny: (router expiryWarningDue: sess)
%
category: 'tests - expiry'
method: McpLifetimeTest
testARenewedDeadlineEarnsAFreshWarning
  "A session whose credential is refreshed gets a new deadline, so it is owed a new warning. Without
   clearing the flag a long-lived session would be warned exactly once, ever, about the first of
   many deadlines."
  | router sess |
  router := McpFixtureRouter new.
  sess := self streamedSessionOn: router.
  sess expiresAtSeconds: System timeGmt + 60.
  router warnExpiringSession: sess.
  self assert: sess expiryWarned.
  self assert: (sess renewExpiryTo: System timeGmt + 3600).
  self deny: sess expiryWarned
%
category: 'tests - expiry'
method: McpLifetimeTest
testASessionWithNoDeadlineIsNeverExpiryWarned
  "Most sessions have no absolute deadline at all, and must not be warned about one."
  | router sess |
  router := McpFixtureRouter new.
  sess := self streamedSessionOn: router.
  self assert: sess secondsUntilExpiry isNil.
  self deny: (router expiryWarningDue: sess)
%
category: 'tests - expiry'
method: McpLifetimeTest
testAPlainRouterDoesNotTellAClientToRefreshAnything
  "The base advice must not repeat the idle warning's 'make a call': maxSessionLifetimeSeconds is a
   cap on the session itself, and nothing the client does can extend it."
  | router sess advice |
  router := McpFixtureRouter new.
  sess := self streamedSessionOn: router.
  advice := router expiryAdviceFor: sess.
  self assert: (self includesCS: 'cannot be extended' in: advice).
  self deny: (self includesCS: 'refresh' in: advice)
%
category: 'tests - indefinite'
method: McpLifetimeTest
testAnIndefiniteSessionIsReprobedOnTheCadence
  "With a deadline the ping is asked once per idle period. With none it is the only thing that will
   ever release the gem, so it has to keep being asked."
  | r sess |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: nil; livenessProbeIntervalSeconds: 0.
  sess := self streamedSessionOn: r.
  sess fakeIdleSeconds: 14400.
  self assert: r probeIdleSessions equals: 1.
  r resolvePendingRequest: 'srv-1' forSession: sess.
  self assert: r probeIdleSessions equals: 1.       "asked again"
  r resolvePendingRequest: 'srv-2' forSession: sess.
  self assert: r probeIdleSessions equals: 1
%
category: 'tests - indefinite'
method: McpLifetimeTest
testAnIndefiniteSessionLivesWhileItAnswers
  "The developer who falls asleep at the keyboard. With no wall-clock deadline the session lives
   exactly as long as its client keeps answering pings on a stream it opened itself -- which is the
   client asserting it still wants that gem and the uncommitted work in it."
  | r sess |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: nil; livenessProbeIntervalSeconds: 60.
  sess := self streamedSessionOn: r.
  sess fakeIdleSeconds: 14400.                 "four hours quiet"
  self assert: r probeIdleSessions equals: 1.
  r resolvePendingRequest: 'srv-1' forSession: sess.
  self assert: sess isKnownAlive.
  self assert: r reapIdleSessions equals: 0.
  "nothing is warned about, either: there is no deadline to warn of"
  self assert: r probeIdleSessions equals: 0.
  self deny: sess idleWarned
%
category: 'tests - indefinite'
method: McpLifetimeTest
testAnIndefiniteSessionStillGoesWhenItStopsAnswering
  "What makes indefinite different from unpoliced. The failed probe is forced to reap here whatever
   reapOnFailedProbe says, because it is the only thing left that could end a session."
  | r sess |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: nil; livenessProbeIntervalSeconds: 60;
    pendingRequestTimeoutSeconds: -1; reapOnFailedProbe: false.
  sess := self streamedSessionOn: r.
  sess fakeIdleSeconds: 14400.
  self assert: r probeIdleSessions equals: 1.
  self assert: r expirePendingRequests equals: 1.
  self assert: sess isKnownGone.
  self assert: r reapIdleSessions equals: 1
%
category: 'tests - indefinite'
method: McpLifetimeTest
testAnIndefiniteSessionWithNoStreamStillHasAFloor
  "The gem leak an indefinite timeout would otherwise be: initialize, never open a GET, vanish. Such
   a client can never be pinged -- pinging it would condemn it for the sole offence of not opening a
   stream -- so liveness can say nothing about it and the floor is the only thing that can free it."
  | r sess |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: nil; streamlessIdleTimeoutSeconds: 900.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess fakeIdleSeconds: 600.
  self assert: r probeIdleSessions equals: 0.
  self assert: r reapIdleSessions equals: 0.
  sess fakeIdleSeconds: 1000.
  self assert: r reapIdleSessions equals: 1
%
category: 'tests - liveness'
method: McpLifetimeTest
testAnUnansweredProbeOnTheCurrentStreamStillCondemns
  "The counterpart, so the fix above narrows the verdict rather than removing it: where the stream
   that carried the ping is still the one the client is on, silence remains evidence and the gem is
   still freed without waiting out the full timeout."
  | r sess |
  r := McpFixtureRouter new.
  r pendingRequestTimeoutSeconds: -1.
  sess := self streamedSessionOn: r.
  sess fakeIdleSeconds: 1700.
  self assert: r probeIdleSessions equals: 1.
  self assert: r expirePendingRequests equals: 1.
  self assert: sess isKnownGone.
  self assert: r reapIdleSessions equals: 1
%
category: 'tests - liveness'
method: McpLifetimeTest
testAnUnwarnedSessionAtTheDeadlineGetsOneGracePeriod
  "The warning is the promise this pathway makes -- commit or lose the uncommitted work in your gem
   -- and a session can reach the deadline without ever hearing it, because its stream opened late or
   the whole warning window elapsed between two passes. So a reachable, unwarned client gets one
   bounded grace period in which the cycle runs, and is told before it is reaped.
   It is not a liveness reprieve: answering the ping does not save it, it only means the notice is
   delivered to someone listening."
  | r sess |
  r := McpFixtureRouter new.
  sess := self streamedSessionOn: r.
  sess fakeIdleSeconds: 1900.                 "past the 1800 deadline, never warned"
  self assert: r reapIdleSessions equals: 0.  "held, not killed"
  self assert: r probeIdleSessions equals: 1. "the cycle runs instead"
  r resolvePendingRequest: 'srv-1' forSession: sess.
  sess outbox drain.
  self assert: r probeIdleSessions equals: 1. "the warning it was owed"
  self assert: (self includesCS: 'uncommitted changes will be lost' in: (self noticeIn: sess)).
  self assert: sess idleWarned.
  "warned, so the deadline now applies"
  self assert: r reapIdleSessions equals: 1
%
category: 'tests - liveness'
method: McpLifetimeTest
testAProbeLostToAStreamHandoverIsDiscardedNotCondemned
  "The defect the 2026-08-23 client runs turned up: 6 of 14 pings never reached their client because
   they were written to a stream the client had already replaced. The write SUCCEEDS -- into a socket
   buffer nobody will ever read again -- so nothing in the router notices, and 30 seconds later the
   silence is read as proof of death and a live client's worker gem is freed.
   An unanswered ping means gone only if it went down the stream the client is still on."
  | r sess |
  r := McpFixtureRouter new.
  r pendingRequestTimeoutSeconds: -1.        "expire the moment it is sent"
  sess := self streamedSessionOn: r.
  sess fakeIdleSeconds: 1700.
  self assert: r probeIdleSessions equals: 1.
  self assert: sess isProbeOutstanding.
  "the client's stream drops and it reconnects -- latest-GET-wins supersedes the generation the
   ping was written to"
  sess outbox attachStream.
  self assert: r expirePendingRequests equals: 1.
  self deny: sess isKnownGone.
  self assert: r reapIdleSessions equals: 0.
  self assert: (r sessionAt: sess id) notNil.
  "and the probe is not merely forgiven -- it is re-asked down the stream the client is now on"
  self deny: sess isProbeOutstanding.
  self assert: r probeIdleSessions equals: 1.
  self assert: sess isProbeOutstanding
%
category: 'tests - liveness'
method: McpLifetimeTest
testAProbeWithNoStreamAtAllProvesNothing
  "The same rule at its limit. A request queued while no stream was attached carries no generation,
   so its silence is inadmissible for the same reason: nothing could have carried it."
  | r sess |
  r := McpFixtureRouter new.
  r pendingRequestTimeoutSeconds: -1.
  sess := r openSessionCreating: [:newId | McpMockSession startWithId: newId].
  sess fakeIdleSeconds: 1700.
  self assert: (r sendRequest: 'ping' params: nil toSession: sess) notNil.
  sess noteProbeSent.
  self assert: r expirePendingRequests equals: 1.
  self deny: sess isKnownGone
%
category: 'tests - suspend'
method: McpLifetimeTest
testAWakingFrontEndDoesNotReapLiveClients
  "The whole point, end to end. Two hours asleep with a client connected the entire time: before the
   detector this pass expired the in-flight probe, marked the session gone, found it idle by two
   hours and freed its gem -- while the client sat there awake, connected, and one keystroke away."
  | r sess |
  r := McpFixtureRouter new.
  r reaperIntervalSeconds: 60.
  sess := self streamedSessionOn: r.
  sess fakeIdleSeconds: 1700.
  self assert: r probeIdleSessions equals: 1.     "a ping was in flight when the host slept"
  sess fakeIdleSeconds: nil.                      "the real clock, which the forgiveness moves"
  r pretendLastMaintenanceWasSecondsAgo: 7200.
  self assert: r maintainSessions equals: 0.
  self assert: (r sessionAt: sess id) notNil.
  self deny: sess isKnownGone.
  self deny: sess isProbeOutstanding             "the probe was discarded, not condemned"
%
category: 'tests - suspend'
method: McpLifetimeTest
testAWildlyLatePassIsReadAsASuspend
  "The detector itself: the maintenance loop is this gem's own clock, so a pass that asks for a
   minute and comes back hours later is the only evidence the front end gets that the host slept."
  | r sess |
  r := McpFixtureRouter new.
  r reaperIntervalSeconds: 60.
  sess := self streamedSessionOn: r.
  self assert: r noteMaintenanceTick equals: 0.       "an ordinary pass forgives nothing"
  r pretendLastMaintenanceWasSecondsAgo: 7200.
  self assert: r noteMaintenanceTick equals: 7140.    "the gap, less the interval it asked for"
  "a pass that is merely late -- a slow login, a busy gem -- is not a suspend"
  r pretendLastMaintenanceWasSecondsAgo: 90.
  self assert: r noteMaintenanceTick equals: 0
%
category: 'tests - config'
method: McpLifetimeTest
testDefaultsAreUnchangedFromPhase0
  "The knobs are new; the behaviour out of the box is not. Anyone who configures nothing gets exactly
   the intervals that shipped, which is what makes this a refactor for them rather than an upgrade."
  | r |
  r := McpRouter new.
  self assert: r sessionIdleTimeoutSeconds equals: 1800.
  self assert: r idleWarningLeadSeconds equals: 300.
  self assert: r reaperIntervalSeconds equals: 60.
  self assert: r pendingRequestTimeoutSeconds equals: 30.
  self assert: r hasSessionIdleDeadline.
  self assert: r reapOnFailedProbe
%
category: 'tests - suspend'
method: McpLifetimeTest
testExpiryIsNotForgiven
  "The one clock a suspend does not move. A credential's exp is an absolute commitment, and a
   suspended laptop is not a reason to go on honouring an expired token."
  | r sess |
  r := McpFixtureRouter new.
  sess := self streamedSessionOn: r.
  sess expiresAtSeconds: System timeGmt - 1.
  r forgiveSuspendedSeconds: 7200.
  self assert: sess isExpired.
  self assert: r reapIdleSessions equals: 1
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
  r sessionIdleTimeoutSeconds: nil;
    streamlessIdleTimeoutSeconds: 900;
    livenessProbeIntervalSeconds: 120;
    idleWarningLeadSeconds: 240;
    reaperIntervalSeconds: 30;
    pendingRequestTimeoutSeconds: 10;
    maxSessionLifetimeSeconds: 7200;
    reapOnFailedProbe: false.
  child := McpRouter new applyConfigJson: r configJson.
  self assert: child sessionIdleTimeoutSeconds isNil.
  self deny: child hasSessionIdleDeadline.
  self assert: child streamlessIdleTimeoutSeconds equals: 900.
  self assert: child livenessProbeIntervalSeconds equals: 120.
  self assert: child idleWarningLeadSeconds equals: 240.
  self assert: child reaperIntervalSeconds equals: 30.
  self assert: child pendingRequestTimeoutSeconds equals: 10.
  self assert: child maxSessionLifetimeSeconds equals: 7200.
  "reapOnFailedProbe travelled, but is FORCED on where there is no deadline -- it is the only thing
   that could ever end a session there"
  self assert: child reapOnFailedProbe
%
category: 'tests - expiry'
method: McpLifetimeTest
testMaxSessionLifetimeBecomesAnExpiryAtOpen
  "The blunt cap, applied where every session passes through."
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
testReapOnFailedProbeCanBeTurnedOff
  "A deployment with a short deadline may not want a verdict drawn from silence at all: turning it
   off costs at most (timeout - lead) of gem lifetime and removes the whole class of false positive."
  | r sess |
  r := McpFixtureRouter new.
  r pendingRequestTimeoutSeconds: -1; reapOnFailedProbe: false.
  sess := self streamedSessionOn: r.
  sess fakeIdleSeconds: 1700.
  r probeIdleSessions.
  r expirePendingRequests.
  self assert: sess isKnownGone.
  self assert: r reapIdleSessions equals: 0.
  "the wall clock still has it"
  sess fakeIdleSeconds: 4000.
  self assert: r reapIdleSessions equals: 1
%
category: 'tests - suspend'
method: McpLifetimeTest
testSuspendedTimeIsForgivenOnEveryIdleClock
  "Idleness is a measure of SERVICE time. A host that was asleep offered no service, so the sleep is
   not something a client should be charged for -- and without this, the first pass after a wake sees
   every session idle by the whole suspend and frees every worker gem at once."
  | r sess before |
  r := McpFixtureRouter new.
  sess := self streamedSessionOn: r.
  before := sess idleSeconds.
  self assert: (r forgiveSuspendedSeconds: 7200) equals: 7200.
  self assert: sess idleSeconds <= (before - 7199).
  "and the client is told, because the one thing it cannot work out for itself is that its worker
   gem still holds the transaction view it had before the gap"
  self assert: (self includesCS: 'transaction view it had beforehand' in: (self noticeIn: sess))
%
category: 'tests - indefinite'
method: McpLifetimeTest
testTheFloorIsMeasuredFromWhenTheStreamWasLastSeen
  "Not from last activity. A client that has been quiet for hours but holding a stream the whole time
   is reachable, and must not be reaped the instant its stream blips during a reconnect."
  | r sess |
  r := McpFixtureRouter new.
  r sessionIdleTimeoutSeconds: nil; streamlessIdleTimeoutSeconds: 900.
  sess := self streamedSessionOn: r.
  sess fakeIdleSeconds: 14400.
  self assert: sess unreachableSeconds equals: 0.
  r probeIdleSessions.                       "the pass that observes the stream stamps it"
  sess outbox detachStream: sess outbox currentStreamGeneration.
  self deny: sess outbox hasStream.
  self assert: sess unreachableSeconds < 10.  "seconds, not the four idle hours"
  self assert: r reapIdleSessions equals: 0
%
category: 'tests - liveness'
method: McpLifetimeTest
testTheGracePeriodIsBounded
  "A client replacing its stream on every pass would never yield a verdict, so the grace has to end
   whether or not the warning was ever delivered -- otherwise 'one more chance' is a gem leak."
  | r sess |
  r := McpFixtureRouter new.
  sess := self streamedSessionOn: r.
  sess fakeIdleSeconds: 1800 + r reapGraceSeconds + 1.
  self deny: sess idleWarned.
  self assert: r reapIdleSessions equals: 1
%
category: 'tests - config'
method: McpLifetimeTest
testTheWarningLeadIsDerivedFromTheTimeout
  "The one interval with a hard relationship to the others. Someone who shortens the idle timeout
   should not also have to work out that the ping and the warning need two reaper passes and an
   answer window between them -- so the lead follows the timeout down, and stops at the floor that
   cycle needs rather than going below it."
  | r |
  r := McpRouter new.
  r sessionIdleTimeoutSeconds: 3600.
  self assert: r idleWarningLeadSeconds equals: 300.    "capped at the class default"
  r sessionIdleTimeoutSeconds: 1200.
  self assert: r idleWarningLeadSeconds equals: 200.    "a sixth of the timeout"
  r sessionIdleTimeoutSeconds: 600.
  self assert: r idleWarningLeadSeconds equals: r minimumWarningLeadSeconds.   "the floor wins"
  "and an explicit value is left exactly as given"
  r idleWarningLeadSeconds: 222.
  self assert: r idleWarningLeadSeconds equals: 222.
  r idleWarningLeadSeconds: nil.
  self assert: r idleWarningLeadSeconds equals: r minimumWarningLeadSeconds
%
category: 'tests - config'
method: McpLifetimeTest
testValidationRefusesACycleThatCannotComplete
  "Fail at startup, in words, rather than at a client's first idle window. A lead too short for the
   ping-then-warn cycle does not misbehave visibly -- it simply never warns anyone, which is
   precisely the failure nobody would notice until they lost uncommitted work."
  | r |
  r := McpRouter new.
  r sessionIdleTimeoutSeconds: 1800; idleWarningLeadSeconds: 20.
  self should: [r validateTimerConfig] raise: Error.
  "a timeout shorter than the lead would open every session already inside its warning window"
  r idleWarningLeadSeconds: nil; sessionIdleTimeoutSeconds: 100.
  self should: [r validateTimerConfig] raise: Error.
  "an answer window at or beyond the pass interval leaves a ping undecided on the next pass"
  r sessionIdleTimeoutSeconds: 1800; pendingRequestTimeoutSeconds: 90.
  self should: [r validateTimerConfig] raise: Error.
  "and a number that is not a positive count of seconds"
  r pendingRequestTimeoutSeconds: 30; streamlessIdleTimeoutSeconds: 0.
  self should: [r validateTimerConfig] raise: Error.
  "the shipping configuration passes, and so does a coherent short one"
  self assert: (McpRouter new validateTimerConfig) notNil.
  r := McpRouter new.
  r sessionIdleTimeoutSeconds: 300; reaperIntervalSeconds: 10; pendingRequestTimeoutSeconds: 5.
  self assert: r validateTimerConfig notNil
%
