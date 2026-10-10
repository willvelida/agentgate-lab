import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  CopilotCliDispatcher,
  ScriptedDispatcher,
  runMakerCheckerLoop,
} from './maker-checker-loop.mjs';

function goal(overrides = {}) {
  return {
    schemaVersion: 1,
    issue: 30,
    featureSlug: 'willvelida-agentgate-lab-30-add-a-bounded-goal-driven-maker-checker-loop',
    featureId: 'F003',
    goal: 'Coordinate bounded maker-checker rounds.',
    verificationCommand: 'node --test scripts/maker-checker-loop.test.mjs',
    constraints: ['Do not implement F004 publication safety.'],
    limits: {
      maxRounds: 6,
      maxElapsedTimeMs: 600000,
      noProgressLimit: 2,
      ...overrides,
    },
  };
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-maker-checker-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return join(root, 'state.json');
}

function clock() {
  let tick = Date.parse('2026-10-10T10:00:00.000Z');
  return () => {
    const value = new Date(tick);
    tick += 1000;
    return value;
  };
}

function revisions(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function revision(fingerprint, dirty = true) {
  return {
    commit: '09b84c9ef03319536ba5a08c77d7252450be5ff6',
    dirty,
    fingerprint,
  };
}

test('dispatches Harness Implementer maker and fresh evaluator checker sessions', async () => {
  const calls = [];
  const processRunner = async (executable, args, options) => {
    calls.push({ executable, args, options });
    const actor = args.includes('--agent') ? 'maker' : 'checker';
    return {
      stdout: `done\nMAKER_CHECKER_RESULT: {"outcome":"${actor === 'maker' ? 'completed' : 'pass'}","feedback":"ok"}\n`,
      stderr: '',
    };
  };
  const dispatcher = new CopilotCliDispatcher({
    repositoryRoot: 'C:\\repo',
    processRunner,
  });

  await dispatcher.dispatch({
    actor: 'maker',
    goal: goal(),
    feedback: 'fix the failed assertion',
    timeoutMs: 1000,
  });
  await dispatcher.dispatch({
    actor: 'checker',
    goal: goal(),
    feedback: null,
    timeoutMs: 1000,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].executable, 'copilot');
  assert.ok(calls[0].args.includes('Harness Implementer'));
  assert.match(calls[0].args.at(-1), /Checker feedback to address/);
  assert.match(calls[1].args.at(-1), /\/feature-evaluator Evaluate F003/);
  assert.ok(!calls[1].args.includes('--agent'));
  assert.ok(!calls.flatMap((call) => call.args).includes('--resume'));
  assert.ok(!calls.flatMap((call) => call.args).includes('--continue'));
});

test('stops successfully on checker pass for unchanged work', async (t) => {
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'maker finished' },
    { outcome: 'pass', feedback: 'checker passed' },
  ]);
  const result = await runMakerCheckerLoop({
    goal: goal(),
    statePath: fixture(t),
    dispatcher,
    getRevision: revisions(
      revision('initial'),
      revision('maker'),
      revision('maker'),
      revision('maker', false),
    ),
    now: clock(),
  });

  assert.equal(result.status, 'pass');
  assert.deepEqual(dispatcher.calls.map((call) => call.actor), ['maker', 'checker']);
  assert.deepEqual(result.state.rounds.map((round) => round.outcome), ['completed', 'pass']);
});

test('returns checker fail feedback to a new maker while limits permit', async (t) => {
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'first maker' },
    { outcome: 'fail', feedback: 'add the missing stop case' },
    { outcome: 'completed', feedback: 'second maker' },
    { outcome: 'pass', feedback: 'checker passed' },
  ]);
  const result = await runMakerCheckerLoop({
    goal: goal(),
    statePath: fixture(t),
    dispatcher,
    getRevision: revisions(
      revision('initial'),
      revision('maker-1'),
      revision('maker-1'),
      revision('maker-1'),
      revision('maker-1'),
      revision('maker-2'),
      revision('maker-2'),
      revision('maker-2'),
    ),
    now: clock(),
  });

  assert.equal(result.status, 'pass');
  assert.equal(dispatcher.calls[2].feedback, 'add the missing stop case');
  assert.deepEqual(
    result.state.rounds.map((round) => `${round.actor}:${round.outcome}`),
    ['maker:completed', 'checker:fail', 'maker:completed', 'checker:pass'],
  );
});

test('stops for blocked or ambiguous work', async (t) => {
  for (const outcome of ['blocked', 'ambiguous']) {
    const dispatcher = new ScriptedDispatcher([
      { outcome, feedback: `${outcome} work` },
    ]);
    const result = await runMakerCheckerLoop({
      goal: goal(),
      statePath: join(fixture(t), outcome, 'state.json'),
      dispatcher,
      getRevision: revisions(revision('initial'), revision('after')),
      now: clock(),
    });

    assert.equal(result.status, outcome);
    assert.equal(result.state.rounds[0].humanIntervention.required, true);
  }
});

test('stops when checker work is stale', async (t) => {
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'maker finished' },
  ]);
  const result = await runMakerCheckerLoop({
    goal: goal(),
    statePath: fixture(t),
    dispatcher,
    getRevision: revisions(
      revision('initial'),
      revision('maker'),
      revision('changed-after-maker'),
    ),
    now: clock(),
  });

  assert.equal(result.status, 'stale');
  assert.deepEqual(dispatcher.calls.map((call) => call.actor), ['maker']);
  assert.equal(result.state.rounds.at(-1).outcome, 'stale');
});

test('stops after repeated maker rounds make no progress', async (t) => {
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'initial work' },
    { outcome: 'fail', feedback: 'first failure' },
    { outcome: 'completed', feedback: 'unchanged retry' },
    { outcome: 'fail', feedback: 'second failure' },
    { outcome: 'no-progress', feedback: 'still unchanged' },
  ]);
  const same = revision('same');
  const result = await runMakerCheckerLoop({
    goal: goal({ maxRounds: 8, noProgressLimit: 2 }),
    statePath: fixture(t),
    dispatcher,
    getRevision: () => same,
    now: clock(),
  });

  assert.equal(result.status, 'stalled');
  assert.equal(result.state.rounds.at(-1).outcome, 'stalled');
  assert.equal(result.state.rounds.at(-1).humanIntervention.required, true);
});

test('stops when round or elapsed-time limits are exhausted', async (t) => {
  const roundLimited = await runMakerCheckerLoop({
    goal: goal({ maxRounds: 1 }),
    statePath: fixture(t),
    dispatcher: new ScriptedDispatcher([
      { outcome: 'completed', feedback: 'maker finished' },
    ]),
    getRevision: revisions(revision('initial'), revision('maker')),
    now: clock(),
  });
  assert.equal(roundLimited.status, 'limit-exhausted');

  let tick = 0;
  const elapsed = await runMakerCheckerLoop({
    goal: goal({ maxElapsedTimeMs: 1 }),
    statePath: join(fixture(t), 'elapsed', 'state.json'),
    dispatcher: new ScriptedDispatcher([]),
    getRevision: () => revision('initial'),
    now: () => new Date(Date.parse('2026-10-10T10:00:00.000Z') + (tick++ * 2)),
  });
  assert.equal(elapsed.status, 'limit-exhausted');
});

test('dry-run dispatcher leaves deterministic persisted evidence', async (t) => {
  const statePath = fixture(t);
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'fixture maker' },
    { outcome: 'pass', feedback: 'fixture checker' },
  ]);
  await runMakerCheckerLoop({
    goal: goal(),
    statePath,
    dispatcher,
    getRevision: revisions(
      revision('initial'),
      revision('fixture'),
      revision('fixture'),
      revision('fixture'),
    ),
    now: clock(),
  });

  const persisted = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(persisted.rounds.length, 2);
  assert.equal(persisted.rounds[1].outcome, 'pass');
});
