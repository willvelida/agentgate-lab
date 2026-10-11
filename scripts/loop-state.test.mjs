import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createLoopState,
  getResumeDecision,
  loadLoopState,
  recordRound,
  saveLoopState,
} from './loop-state.mjs';

const goal = {
  schemaVersion: 1,
  issue: 30,
  featureSlug: 'willvelida-agentgate-lab-30-maker-checker-loop',
  featureId: 'F002',
  goal: 'Persist maker-checker loop state.',
  verificationCommand: 'node --test scripts/loop-state.test.mjs',
  constraints: ['Do not dispatch agents in F002.'],
  limits: {
    maxRounds: 3,
    maxElapsedTimeMs: 600000,
    noProgressLimit: 2,
  },
};

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-loop-state-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return join(root, 'nested', 'state.json');
}

function round(overrides = {}) {
  return {
    actor: 'maker',
    startedAt: '2026-10-10T09:00:00.000Z',
    finishedAt: '2026-10-10T09:01:00.000Z',
    reviewedRevision: {
      commit: 'e84a6023f950fe5d0c4aa6b4e6bebd4dbe425249',
      dirty: true,
    },
    outcome: 'completed',
    feedback: 'Implementation and focused verification completed.',
    nextAction: 'checker',
    humanIntervention: {
      required: false,
      reason: null,
    },
    ...overrides,
  };
}

test('persists and reloads complete round evidence', (t) => {
  const path = fixture(t);
  const initial = createLoopState(goal, new Date('2026-10-10T08:59:00.000Z'));
  const state = recordRound(
    initial,
    round(),
    new Date('2026-10-10T09:01:01.000Z'),
  );

  saveLoopState(path, state);

  assert.deepEqual(loadLoopState(path), state);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), state);
  assert.equal(state.rounds[0].reviewedRevision.dirty, true);
  assert.deepEqual(state.rounds[0].humanIntervention, {
    required: false,
    reason: null,
  });
});

test('resumes with the checker without repeating a completed maker round', () => {
  const initial = createLoopState(goal, new Date('2026-10-10T08:59:00.000Z'));
  const state = recordRound(initial, round());

  assert.deepEqual(getResumeDecision(state), {
    action: 'continue',
    actor: 'checker',
  });
  assert.equal(state.rounds.length, 1);
});

test('stops after a completed successful checker round', () => {
  const initial = createLoopState(goal, new Date('2026-10-10T08:59:00.000Z'));
  const makerState = recordRound(initial, round());
  const passedState = recordRound(makerState, round({
    actor: 'checker',
    outcome: 'pass',
    feedback: 'All rubric dimensions passed.',
    nextAction: 'stop',
  }));

  assert.deepEqual(getResumeDecision(passedState), {
    action: 'stop',
    reason: 'passed',
  });
  assert.equal(passedState.rounds.length, 2);
});

test('persists human intervention and rejects corrupt state', (t) => {
  const path = fixture(t);
  const initial = createLoopState(goal, new Date('2026-10-10T08:59:00.000Z'));
  const state = recordRound(initial, round({
    outcome: 'blocked',
    feedback: 'The acceptance criterion is ambiguous.',
    nextAction: 'stop',
    humanIntervention: {
      required: true,
      reason: 'Clarify the acceptance criterion.',
    },
  }));
  saveLoopState(path, state);

  assert.deepEqual(getResumeDecision(loadLoopState(path)), {
    action: 'stop',
    reason: 'human-intervention',
  });

  writeFileSync(path, '{"schemaVersion":1,"rounds":"invalid"}\n');
  assert.throws(
    () => loadLoopState(path),
    /Invalid goal contract|\$\.goal/,
  );
});

test('validates optional controller verification evidence on a round', (t) => {
  const statePath = fixture(t);
  const verification = {
    command: 'node --test scripts/loop-state.test.mjs',
    status: 'passed',
    runId: '2026-10-10T09-20-23-268Z-ba4e7aa7',
    exitCode: 0,
    reportPath: '.local/verification/2026-10-10T09-20-23-268Z-ba4e7aa7/report.json',
  };
  const state = recordRound(createLoopState(goal, new Date('2026-10-10T08:59:00.000Z')), round({
    verification,
  }));
  saveLoopState(statePath, state);

  assert.deepEqual(loadLoopState(statePath).rounds[0].verification, verification);
  assert.doesNotThrow(() => recordRound(
    createLoopState(goal, new Date('2026-10-10T08:59:00.000Z')),
    round({ verification: null }),
  ));

  assert.throws(
    () => recordRound(
      createLoopState(goal, new Date('2026-10-10T08:59:00.000Z')),
      round({ verification: { ...verification, status: 'probably-fine' } }),
    ),
    /rounds\[0\]\.verification\.status/,
  );
  assert.throws(
    () => recordRound(
      createLoopState(goal, new Date('2026-10-10T08:59:00.000Z')),
      round({ verification: { ...verification, runId: null } }),
    ),
    /rounds\[0\]\.verification\.runId is required when verification passed/,
  );
  assert.throws(
    () => recordRound(
      createLoopState(goal, new Date('2026-10-10T08:59:00.000Z')),
      round({ verification: { ...verification, exitCode: '0' } }),
    ),
    /rounds\[0\]\.verification\.exitCode/,
  );
});