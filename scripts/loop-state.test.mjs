import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  acquireLoopStateLock,
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

test('acquires an exclusive state lock and releases only its own lock', (t) => {
  const statePath = fixture(t);
  const first = acquireLoopStateLock(statePath);

  assert.ok(existsSync(join(first.path, 'owner.json')));
  assert.throws(
    () => acquireLoopStateLock(statePath),
    /state is locked.*Automatic stale-lock recovery is disabled/,
  );

  first.release();
  assert.equal(existsSync(first.path), false);
  const second = acquireLoopStateLock(statePath);
  second.release();
});

test('does not automatically recover an existing stale state lock', (t) => {
  const statePath = fixture(t);
  const staleLockPath = `${statePath}.lock`;
  mkdirSync(staleLockPath, { recursive: true });

  assert.throws(
    () => acquireLoopStateLock(statePath),
    /state is locked.*Verify the controller and all dispatched child processes have stopped/,
  );
  assert.ok(existsSync(staleLockPath));
});

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

test('retries the interrupted actor when no human intervention is required', () => {
  const initial = createLoopState(goal, new Date('2026-10-10T08:59:00.000Z'));
  const state = recordRound(initial, round({
    outcome: 'interrupted',
    feedback: 'The controller received SIGINT.',
    nextAction: 'maker',
    humanIntervention: {
      required: false,
      reason: null,
    },
  }));

  assert.deepEqual(getResumeDecision(state), {
    action: 'continue',
    actor: 'maker',
  });
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
  const entry = {
    command: 'node --test scripts/loop-state.test.mjs',
    status: 'passed',
    runId: '2026-10-10T09-20-23-268Z-ba4e7aa7',
    exitCode: 0,
    reportPath: '.local/verification/2026-10-10T09-20-23-268Z-ba4e7aa7/report.json',
  };
  const verification = [entry];
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
      round({ verification: entry }),
    ),
    /rounds\[0\]\.verification must be an array or null/,
  );
  assert.throws(
    () => recordRound(
      createLoopState(goal, new Date('2026-10-10T08:59:00.000Z')),
      round({ verification: [{ ...entry, status: 'probably-fine' }] }),
    ),
    /rounds\[0\]\.verification\[0\]\.status/,
  );
  assert.throws(
    () => recordRound(
      createLoopState(goal, new Date('2026-10-10T08:59:00.000Z')),
      round({ verification: [{ ...entry, runId: null }] }),
    ),
    /rounds\[0\]\.verification\[0\]\.runId is required when verification passed/,
  );
  assert.throws(
    () => recordRound(
      createLoopState(goal, new Date('2026-10-10T08:59:00.000Z')),
      round({ verification: [{ ...entry, exitCode: '0' }] }),
    ),
    /rounds\[0\]\.verification\[0\]\.exitCode/,
  );
});

test('migrates a schema v1 verification record to a one-entry list on load', (t) => {
  const statePath = fixture(t);
  const entry = {
    command: 'node --test scripts/loop-state.test.mjs',
    status: 'passed',
    runId: 'legacy-run',
    exitCode: 0,
    reportPath: '.local/verification/legacy-run/report.json',
  };
  const state = recordRound(
    createLoopState(goal, new Date('2026-10-10T08:59:00.000Z')),
    round({ verification: [entry] }),
  );
  state.rounds[0].verification = entry;
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

  assert.deepEqual(loadLoopState(statePath).rounds[0].verification, [entry]);
});