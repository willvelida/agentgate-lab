import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  existsSync,
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
  runProcess,
  tokenizeCommand,
} from './maker-checker-loop.mjs';
import { CopilotCapabilityBoundary } from './maker-checker-safety.mjs';
import {
  createLoopState,
  recordRound,
  saveLoopState,
} from './loop-state.mjs';

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

function verificationRunner(results = []) {
  const queue = [...results];
  const runner = {
    calls: [],
    async run(command, options) {
      runner.calls.push({ command, options });
      const next = queue.length > 0
        ? queue.shift()
        : { status: 'passed', runId: 'run-ok', exitCode: 0 };
      if (next instanceof Error) {
        throw next;
      }
      return {
        command,
        status: next.status,
        runId: next.runId ?? null,
        exitCode: next.exitCode ?? null,
        reportPath: next.reportPath ?? `.local/verification/${next.runId ?? 'unknown'}/report.json`,
      };
    },
  };
  return runner;
}

function runLoop(options) {
  return runMakerCheckerLoop({
    verificationRunner: verificationRunner(),
    ...options,
    safetyBoundary: {
      capture: () => ({}),
      assertTransition: () => {},
    },
  });
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
    capabilityBoundary: new CopilotCapabilityBoundary({
      repositoryRoot: 'C:\\repo',
      mcpServerProvider: () => [],
    }),
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
  assert.match(calls[0].args.at(-1), /Feedback to address/);
  assert.match(calls[0].args.at(-1), /Goal: Coordinate bounded maker-checker rounds\./);
  assert.match(calls[0].args.at(-1), /\(1\) Do not implement F004 publication safety\./);
  assert.match(
    calls[0].args.at(-1),
    /Verification command: node --test scripts\/maker-checker-loop\.test\.mjs/,
  );
  assert.match(calls[0].args.at(-1), /Shell access is disabled/);
  assert.match(calls[1].args.at(-1), /\/feature-evaluator Evaluate F003/);
  assert.match(calls[1].args.at(-1), /Goal: Coordinate bounded maker-checker rounds\./);
  assert.match(
    calls[1].args.at(-1),
    /Verification command: node --test scripts\/maker-checker-loop\.test\.mjs/,
  );
  assert.match(calls[1].args.at(-1), /recorded controller verification evidence/);
  assert.ok(!calls[1].args.includes('--agent'));
  assert.ok(!calls.flatMap((call) => call.args).includes('--resume'));
  assert.ok(!calls.flatMap((call) => call.args).includes('--continue'));
});

test('terminates a timed-out process tree without waiting for a cooperative child', async () => {
  const startedAt = Date.now();
  await assert.rejects(
    runProcess(
      process.execPath,
      [
        '-e',
        'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);',
      ],
      {
        cwd: process.cwd(),
        timeoutMs: 100,
      },
    ),
    /Child process exceeded its 100 ms dispatch limit/,
  );
  assert.ok(Date.now() - startedAt < 5000);
});

test('keeps dispatch pending and retries after process-tree termination failure', async () => {
  let childProcess;
  let attempts = 0;
  let resolveFirstFailure;
  let childClosed;
  const firstFailure = new Promise((resolveFailure) => {
    resolveFirstFailure = resolveFailure;
  });
  let dispatchSettled = false;
  const dispatch = runProcess(
    process.execPath,
    ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);'],
    {
      cwd: process.cwd(),
      timeoutMs: 100,
      terminateProcessTree: async (child) => {
        attempts += 1;
        childProcess = child;
        childClosed ??= once(child, 'close');
        if (attempts === 1) {
          resolveFirstFailure();
          throw new Error('simulated cleanup failure');
        }
        child.kill('SIGKILL');
      },
    },
  );
  dispatch.then(
    () => { dispatchSettled = true; },
    () => { dispatchSettled = true; },
  );

  await firstFailure;

  assert.ok(childProcess, 'the termination callback should receive the running child');
  assert.equal(childProcess.exitCode, null);
  assert.equal(childProcess.signalCode, null);
  assert.equal(dispatchSettled, false, 'dispatch must stay pending while cleanup has failed');
  await assert.rejects(dispatch, /Child process exceeded its 100 ms dispatch limit/);
  await childClosed;
  assert.ok(attempts >= 2, 'termination should be retried until it succeeds');
  assert.equal(dispatchSettled, true, 'dispatch may settle only after the child has closed');
});

test('terminates the child process tree before handling controller interrupts', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-maker-checker-interrupt-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const signals = process.platform === 'win32' ? ['SIGINT'] : ['SIGINT', 'SIGTERM'];
  const moduleUrl = new URL('./maker-checker-loop.mjs', import.meta.url).href;
  const childCode = [
    'require("node:fs").writeFileSync(process.argv[1], String(process.pid));',
    'process.on("SIGTERM", () => {});',
    'setInterval(() => {}, 1000);',
  ].join(' ');

  for (const signal of signals) {
    const pidPath = join(root, `${signal}.pid`);
    const controllerCode = `
      import { runProcess } from ${JSON.stringify(moduleUrl)};
      import { existsSync } from 'node:fs';
      const dispatch = runProcess(process.execPath, [
        '-e',
        ${JSON.stringify(childCode)},
        ${JSON.stringify(pidPath)},
      ], { cwd: process.cwd(), timeoutMs: 10000 });
      if (process.platform === 'win32') {
        while (!existsSync(${JSON.stringify(pidPath)})) {
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
        }
        process.emit(${JSON.stringify(signal)});
      }
      try {
        await dispatch;
      } catch (error) {
        console.error(error.message);
      }
    `;
    const controller = spawn(
      process.execPath,
      ['--input-type=module', '--eval', controllerCode],
      { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
    );
    let stderr = '';
    controller.stderr.setEncoding('utf8');
    controller.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const closed = new Promise((resolveClose) => {
      controller.once('close', (code, receivedSignal) => {
        resolveClose({ code, signal: receivedSignal });
      });
    });

    try {
      const deadline = Date.now() + 5000;
      while (!existsSync(pidPath) && controller.exitCode === null && Date.now() < deadline) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
      }
      assert.ok(existsSync(pidPath), 'the detached child should start before interruption');
      const childPid = Number(readFileSync(pidPath, 'utf8'));

      if (process.platform !== 'win32') {
        controller.kill(signal);
      }
      let closeTimeout;
      const closeTimedOut = new Promise((_, rejectClose) => {
        closeTimeout = setTimeout(
          () => rejectClose(new Error('Controller did not exit after interruption.')),
          5000,
        );
      });
      let result;
      try {
        result = await Promise.race([closed, closeTimedOut]);
      } finally {
        clearTimeout(closeTimeout);
      }
      assert.deepEqual(result, {
        code: signal === 'SIGINT' ? 130 : 143,
        signal: null,
      });
      assert.match(stderr, new RegExp(`interrupted by ${signal}`));
      assert.throws(() => process.kill(childPid, 0), { code: 'ESRCH' });
    } finally {
      if (controller.exitCode === null && controller.signalCode === null) {
        controller.kill('SIGKILL');
      }
    }
  }
});

test('stops successfully on checker pass for unchanged work', async (t) => {
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'maker finished' },
    { outcome: 'pass', feedback: 'checker passed' },
  ]);
  const result = await runLoop({
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

test('resumes an interrupted loop at the checker without repeating the maker', async (t) => {
  const statePath = fixture(t);
  const contract = goal();
  const makerRevision = revision('maker-before-interruption');
  const initial = createLoopState(
    contract,
    new Date('2026-10-10T09:59:00.000Z'),
  );
  const interrupted = recordRound(initial, {
    actor: 'maker',
    startedAt: '2026-10-10T10:00:00.000Z',
    finishedAt: '2026-10-10T10:00:01.000Z',
    reviewedRevision: makerRevision,
    outcome: 'completed',
    feedback: 'Maker completed before the controller stopped.',
    nextAction: 'checker',
    humanIntervention: {
      required: false,
      reason: null,
    },
  });
  saveLoopState(statePath, interrupted);
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'pass', feedback: 'checker passed after resume' },
  ]);

  const result = await runLoop({
    goal: contract,
    statePath,
    dispatcher,
    getRevision: revisions(makerRevision, makerRevision),
    now: clock(),
  });

  assert.equal(result.status, 'pass');
  assert.deepEqual(dispatcher.calls.map((call) => call.actor), ['checker']);
  assert.deepEqual(
    result.state.rounds.map((round) => `${round.actor}:${round.outcome}`),
    ['maker:completed', 'checker:pass'],
  );
});

test('treats dirty fingerprint-less legacy revisions as stale', async (t) => {
  const statePath = fixture(t);
  const contract = goal();
  const legacyRevision = {
    commit: '09b84c9ef03319536ba5a08c77d7252450be5ff6',
    dirty: true,
  };
  saveLoopState(statePath, recordRound(
    createLoopState(contract, new Date('2026-10-10T09:59:00.000Z')),
    {
      actor: 'maker',
      startedAt: '2026-10-10T10:00:00.000Z',
      finishedAt: '2026-10-10T10:00:01.000Z',
      reviewedRevision: legacyRevision,
      outcome: 'completed',
      feedback: 'Legacy maker round.',
      nextAction: 'checker',
      verification: null,
      humanIntervention: { required: false, reason: null },
    },
  ));

  const dispatcher = new ScriptedDispatcher([
    { outcome: 'pass', feedback: 'must not run' },
  ]);
  const result = await runLoop({
    goal: contract,
    statePath,
    dispatcher,
    getRevision: () => ({ ...legacyRevision }),
    now: clock(),
  });

  assert.equal(result.status, 'stale');
  assert.equal(dispatcher.calls.length, 0);
});

test('compares clean fingerprint-less legacy revisions by commit', async (t) => {
  const statePath = fixture(t);
  const contract = goal();
  const legacyRevision = {
    commit: '09b84c9ef03319536ba5a08c77d7252450be5ff6',
    dirty: false,
  };
  saveLoopState(statePath, recordRound(
    createLoopState(contract, new Date('2026-10-10T09:59:00.000Z')),
    {
      actor: 'maker',
      startedAt: '2026-10-10T10:00:00.000Z',
      finishedAt: '2026-10-10T10:00:01.000Z',
      reviewedRevision: legacyRevision,
      outcome: 'completed',
      feedback: 'Legacy clean maker round.',
      nextAction: 'checker',
      verification: [{
        command: contract.verificationCommand,
        status: 'passed',
        runId: 'legacy-run',
        exitCode: 0,
        reportPath: '.local/verification/legacy-run/report.json',
      }],
      humanIntervention: { required: false, reason: null },
    },
  ));

  const dispatcher = new ScriptedDispatcher([
    { outcome: 'pass', feedback: 'checker passed' },
  ]);
  const result = await runLoop({
    goal: contract,
    statePath,
    dispatcher,
    getRevision: () => ({ ...legacyRevision }),
    now: clock(),
  });

  assert.equal(result.status, 'pass');
  assert.deepEqual(dispatcher.calls.map((call) => call.actor), ['checker']);
});

test('returns checker fail feedback to a new maker while limits permit', async (t) => {
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'first maker' },
    { outcome: 'fail', feedback: 'add the missing stop case' },
    { outcome: 'completed', feedback: 'second maker' },
    { outcome: 'pass', feedback: 'checker passed' },
  ]);
  const result = await runLoop({
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
    const result = await runLoop({
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

test('checks protected transitions when dispatch throws', async (t) => {
  const snapshots = [{ id: 'before' }, { id: 'after' }];
  const safetyBoundary = {
    capture: () => snapshots.shift(),
    assertTransition: () => {
      throw new Error('Protected checklist changed during failed dispatch.');
    },
  };
  const dispatcher = {
    async dispatch() {
      throw new Error('Dispatcher timed out.');
    },
  };
  const result = await runMakerCheckerLoop({
    goal: goal(),
    statePath: fixture(t),
    dispatcher,
    verificationRunner: verificationRunner(),
    safetyBoundary,
    getRevision: revisions(revision('before'), revision('after')),
    now: clock(),
  });

  assert.equal(result.status, 'approval-required');
  assert.match(result.state.rounds[0].feedback, /Protected checklist changed/);
  assert.equal(result.state.rounds[0].humanIntervention.required, true);
});

test('stops when checker work is stale', async (t) => {
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'maker finished' },
  ]);
  const result = await runLoop({
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
  const result = await runLoop({
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
  const roundLimited = await runLoop({
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
  const elapsed = await runLoop({
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
  await runLoop({
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

test('records controller verification evidence on each gated maker round', async (t) => {
  const statePath = fixture(t);
  const runner = verificationRunner([
    { status: 'passed', runId: 'run-maker-1', exitCode: 0 },
    { status: 'passed', runId: 'run-arch-1', exitCode: 0 },
  ]);
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'maker finished' },
    { outcome: 'pass', feedback: 'checker passed' },
  ]);

  const result = await runLoop({
    goal: goal(),
    statePath,
    dispatcher,
    verificationRunner: runner,
    getRevision: revisions(
      revision('initial'),
      revision('maker'),
      revision('maker'),
      revision('maker', false),
    ),
    now: clock(),
  });

  assert.equal(result.status, 'pass');
  assert.deepEqual(
    runner.calls.map((call) => call.command),
    ['node --test scripts/maker-checker-loop.test.mjs', 'bash scripts/check-architecture.sh'],
  );
  assert.deepEqual(result.state.rounds[0].verification, [
    {
      command: 'node --test scripts/maker-checker-loop.test.mjs',
      status: 'passed',
      runId: 'run-maker-1',
      exitCode: 0,
      reportPath: '.local/verification/run-maker-1/report.json',
    },
    {
      command: 'bash scripts/check-architecture.sh',
      status: 'passed',
      runId: 'run-arch-1',
      exitCode: 0,
      reportPath: '.local/verification/run-arch-1/report.json',
    },
  ]);
  assert.equal(result.state.rounds[1].verification, null);

  const persisted = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(persisted.rounds[0].verification[0].runId, 'run-maker-1');
  assert.equal(persisted.rounds[0].verification[1].runId, 'run-arch-1');
});

test('failed controller verification returns work to the maker instead of the checker', async (t) => {
  const runner = verificationRunner([
    { status: 'failed', runId: 'run-maker-1', exitCode: 1 },
    { status: 'passed', runId: 'run-arch-1', exitCode: 0 },
    { status: 'passed', runId: 'run-maker-2', exitCode: 0 },
    { status: 'passed', runId: 'run-arch-2', exitCode: 0 },
  ]);
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'first maker' },
    { outcome: 'completed', feedback: 'second maker' },
    { outcome: 'pass', feedback: 'checker passed' },
  ]);

  const result = await runLoop({
    goal: goal(),
    statePath: fixture(t),
    dispatcher,
    verificationRunner: runner,
    getRevision: revisions(
      revision('initial'),
      revision('maker-1'),
      revision('maker-1'),
      revision('maker-2'),
      revision('maker-2'),
      revision('maker-2', false),
    ),
    now: clock(),
  });

  assert.equal(result.status, 'pass');
  assert.deepEqual(dispatcher.calls.map((call) => call.actor), ['maker', 'maker', 'checker']);
  assert.deepEqual(
    result.state.rounds.map((round) => `${round.actor}:${round.outcome}`),
    ['maker:fail', 'maker:completed', 'checker:pass'],
  );
  assert.equal(result.state.rounds[0].verification[0].status, 'failed');
  assert.match(result.state.rounds[0].feedback, /Controller verification failed/);
  assert.equal(dispatcher.calls[1].feedback, result.state.rounds[0].feedback);
});

test('stops for human intervention when controller verification cannot run', async (t) => {
  const runner = verificationRunner([
    new Error('Verification runner did not report an evidence path.'),
  ]);
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'maker finished' },
  ]);

  const result = await runLoop({
    goal: goal(),
    statePath: fixture(t),
    dispatcher,
    verificationRunner: runner,
    getRevision: revisions(revision('initial'), revision('maker'), revision('maker')),
    now: clock(),
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.state.rounds.at(-1).verification, null);
  assert.equal(result.state.rounds.at(-1).humanIntervention.required, true);
  assert.match(
    result.state.rounds.at(-1).feedback,
    /Controller verification could not run: Verification runner did not report an evidence path\./,
  );
});

test('tokenizes verification commands with quoted arguments', () => {
  assert.deepEqual(tokenizeCommand('node --test scripts/a.test.mjs'), [
    'node',
    '--test',
    'scripts/a.test.mjs',
  ]);
  assert.deepEqual(tokenizeCommand('node --test "scripts/a test.mjs"'), [
    'node',
    '--test',
    'scripts/a test.mjs',
  ]);
  assert.deepEqual(tokenizeCommand("bash -c 'echo hello world'"), [
    'bash',
    '-c',
    'echo hello world',
  ]);
  assert.deepEqual(tokenizeCommand('node -e "console.log(\\"hi\\")"'), [
    'node',
    '-e',
    'console.log("hi")',
  ]);
  assert.throws(() => tokenizeCommand('node --test "unterminated'), /unterminated quote/);
  assert.throws(() => tokenizeCommand('   '), /must not be empty/);
});

test('reruns controller verification when a resumed maker round has no evidence', async (t) => {
  const statePath = fixture(t);
  const contract = goal();
  const legacy = recordRound(
    createLoopState(contract, new Date('2026-10-10T09:59:00.000Z')),
    {
      actor: 'maker',
      startedAt: '2026-10-10T10:00:00.000Z',
      finishedAt: '2026-10-10T10:00:01.000Z',
      reviewedRevision: revision('maker'),
      outcome: 'completed',
      feedback: 'Legacy maker round recorded without verification evidence.',
      nextAction: 'checker',
      verification: null,
      humanIntervention: {
        required: false,
        reason: null,
      },
    },
  );
  saveLoopState(statePath, legacy);

  const runner = verificationRunner([
    { status: 'passed', runId: 'run-resume-1', exitCode: 0 },
    { status: 'passed', runId: 'run-resume-arch', exitCode: 0 },
  ]);
  const dispatcher = new ScriptedDispatcher([{ outcome: 'pass', feedback: 'checker passed' }]);

  const result = await runLoop({
    goal: contract,
    statePath,
    dispatcher,
    verificationRunner: runner,
    getRevision: revisions(revision('maker'), revision('maker'), revision('maker', false)),
    now: clock(),
  });

  assert.equal(result.status, 'pass');
  assert.deepEqual(
    runner.calls.map((call) => call.command),
    ['node --test scripts/maker-checker-loop.test.mjs', 'bash scripts/check-architecture.sh'],
  );
  assert.equal(result.state.rounds[0].verification, null);
  assert.equal(result.state.rounds.at(-1).actor, 'checker');
});

test('shares the elapsed-time budget across verification commands and dispatch', async (t) => {
  const statePath = fixture(t);
  const contract = goal({ maxElapsedTimeMs: 2500 });
  const legacy = recordRound(
    createLoopState(contract, new Date('2026-10-10T10:00:00.000Z')),
    {
      actor: 'maker',
      startedAt: '2026-10-10T10:00:00.000Z',
      finishedAt: '2026-10-10T10:00:00.000Z',
      reviewedRevision: revision('maker'),
      outcome: 'completed',
      feedback: 'Resume at the checker gate.',
      nextAction: 'checker',
      verification: null,
      humanIntervention: { required: false, reason: null },
    },
    new Date('2026-10-10T10:00:00.000Z'),
  );
  saveLoopState(statePath, legacy);
  const times = [
    '2026-10-10T10:00:00.500Z',
    '2026-10-10T10:00:01.000Z',
    '2026-10-10T10:00:02.000Z',
    '2026-10-10T10:00:02.600Z',
  ].map((value) => new Date(value));
  const runner = verificationRunner([
    { status: 'passed', runId: 'run-feature', exitCode: 0 },
  ]);
  const dispatcher = new ScriptedDispatcher([{ outcome: 'pass', feedback: 'unexpected' }]);

  const result = await runLoop({
    goal: contract,
    statePath,
    dispatcher,
    verificationRunner: runner,
    getRevision: revisions(revision('maker')),
    now: () => times.shift() ?? new Date('2026-10-10T10:00:02.600Z'),
  });

  assert.equal(result.status, 'limit-exhausted');
  assert.equal(dispatcher.calls.length, 0);
  assert.deepEqual(runner.calls.map((call) => call.options.timeoutMs), [1500, 500]);
  assert.equal(result.state.rounds.at(-1).verification.length, 2);
});

test('refuses to resume a loop with a different goal contract', async (t) => {
  const statePath = fixture(t);
  saveLoopState(statePath, createLoopState(goal(), new Date('2026-10-10T09:59:00.000Z')));

  await assert.rejects(
    runLoop({
      goal: { ...goal(), goal: 'Coordinate something else entirely.' },
      statePath,
      dispatcher: new ScriptedDispatcher([]),
      getRevision: () => revision('initial'),
      now: clock(),
    }),
    /does not match the contract recorded in the loop state/,
  );
});

test('resumes when the supplied goal contract matches apart from key ordering', async (t) => {
  const statePath = fixture(t);
  const contract = goal();
  saveLoopState(statePath, createLoopState(contract, new Date('2026-10-10T09:59:00.000Z')));
  const reordered = {
    limits: {
      noProgressLimit: contract.limits.noProgressLimit,
      maxElapsedTimeMs: contract.limits.maxElapsedTimeMs,
      maxRounds: contract.limits.maxRounds,
    },
    constraints: contract.constraints,
    verificationCommand: contract.verificationCommand,
    goal: contract.goal,
    featureId: contract.featureId,
    featureSlug: contract.featureSlug,
    issue: contract.issue,
    schemaVersion: contract.schemaVersion,
  };

  const result = await runLoop({
    goal: reordered,
    statePath,
    dispatcher: new ScriptedDispatcher([
      { outcome: 'completed', feedback: 'maker finished' },
      { outcome: 'pass', feedback: 'checker passed' },
    ]),
    getRevision: revisions(
      revision('initial'),
      revision('maker'),
      revision('maker'),
      revision('maker', false),
    ),
    now: clock(),
  });

  assert.equal(result.status, 'pass');
});