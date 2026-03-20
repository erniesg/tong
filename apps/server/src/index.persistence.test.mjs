import assert from 'node:assert/strict';
import { __testing } from './index.mjs';

function snapshotProgression(gameSession) {
  return {
    missionGate: structuredClone(gameSession.missionGate),
    unlocks: structuredClone(gameSession.unlocks),
    rewards: structuredClone(gameSession.rewards),
  };
}

__testing.resetState();

const start = __testing.createNewGameSession('issue-52-user');
const gameSession = __testing.state.sessions.get(start.sessionId);
const sceneSession = __testing.state.sceneSessions.get(gameSession.activeSceneSessionId);

gameSession.missionGate = {
  readiness: 0.92,
  validatedHangouts: 3,
  missionAssessmentUnlocked: true,
  masteryTier: 2,
};
gameSession.unlocks = {
  locationIds: ['food_street', 'cafe'],
  missionIds: ['ko_food_street_gate_01'],
  rewardIds: ['reward_polaroid_memory_01'],
};
gameSession.rewards = [
  {
    rewardId: 'reward_polaroid_memory_01',
    rewardType: 'polaroid_memory',
    grantedAtIso: '2026-03-19T16:30:00.000Z',
    metadata: {
      cityId: 'seoul',
      locationId: 'food_street',
    },
  },
];

const beforeCheckpoint = snapshotProgression(gameSession);
const checkpoint = __testing.persistCheckpoint(
  gameSession,
  sceneSession,
  __testing.CHECKPOINT_BOUNDARIES.reward_grant,
  '2026-03-19T16:31:00.000Z',
);

assert.deepEqual(checkpoint.missionGate, beforeCheckpoint.missionGate);
assert.deepEqual(checkpoint.unlocks, beforeCheckpoint.unlocks);
assert.deepEqual(checkpoint.rewards, beforeCheckpoint.rewards);

gameSession.missionGate = {
  readiness: 0.12,
  validatedHangouts: 0,
  missionAssessmentUnlocked: false,
  masteryTier: 1,
};
gameSession.unlocks = {
  locationIds: ['food_street'],
  missionIds: [],
  rewardIds: [],
};
gameSession.rewards = [];

const resumed = __testing.resumeGameSession(gameSession, checkpoint.checkpointId);
const afterResume = snapshotProgression(resumed.gameSession);

assert.deepEqual(afterResume.missionGate, beforeCheckpoint.missionGate);
assert.deepEqual(afterResume.unlocks, beforeCheckpoint.unlocks);
assert.deepEqual(afterResume.rewards, beforeCheckpoint.rewards);
assert.deepEqual(resumed.activeCheckpoint.missionGate, beforeCheckpoint.missionGate);
assert.deepEqual(resumed.activeCheckpoint.unlocks, beforeCheckpoint.unlocks);
assert.deepEqual(resumed.activeCheckpoint.rewards, beforeCheckpoint.rewards);

console.log('Issue #52 persistence regression test passed.');

__testing.resetState();

const seededStart = __testing.createNewGameSession('issue-99-user');
const seededCheckpoint = seededStart.activeCheckpoint;
const foundSession = __testing.findGameSessionForResume({
  userId: 'issue-99-user',
  sessionId: null,
  requestedCity: seededStart.city,
  resumeCheckpointId: String(seededCheckpoint.rng.version),
});

assert.equal(foundSession?.sessionId, seededStart.sessionId);

const resumedByVersion = __testing.resumeGameSession(
  __testing.state.sessions.get(seededStart.sessionId),
  String(seededCheckpoint.rng.version),
);

assert.equal(resumedByVersion.activeCheckpoint?.checkpointId, seededCheckpoint.checkpointId);

console.log('Issue #99 checkpoint route regression test passed.');
