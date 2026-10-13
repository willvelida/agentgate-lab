import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  CopilotCliDispatcher,
  MAX_PROCESS_OUTPUT_BYTES,
  ScriptedDispatcher,
  getGitRevision,
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
    safetyBoundary: {
      capture: () => ({}),
      assertTransition: () => {},
    },
    ...options,
  });
}

test('documents inline threads and review summaries as required PR feedback sources', () => {
  const instructions = readFileSync(resolve('AGENTS.md'), 'utf8');
  const guide = readFileSync(resolve('docs/harness-agent.md'), 'utf8');

  assert.match(instructions, /unresolved inline review threads/);
  assert.match(instructions, /latest submitted review summary\s+bodies/);
  assert.match(instructions, /including collapsed sections/);
  assert.match(guide, /query `reviewThreads` through `gh api graphql`/);
  assert.match(guide, /pulls\/\{number\}\/reviews` for submitted review bodies/);
  assert.match(guide, /re-fetch both inline threads and review summary bodies/);
  assert.match(guide, /If either source cannot be read, record the review check as unavailable/);
});

test('caps pull request follow-up review rounds behind user approval', () => {
  const instructions = readFileSync(resolve('AGENTS.md'), 'utf8');
  const guide = readFileSync(resolve('docs/harness-agent.md'), 'utf8');
  const decisions = readFileSync(resolve('docs/decisions.md'), 'utf8');

  assert.match(instructions, /at most two follow-up\s+review rounds per pull request/);
  assert.match(instructions, /explicit user approval before\s+starting a third/);
  assert.match(guide, /Process at most two follow-up rounds per pull request/);
  assert.match(guide, /Record the commit each finding\s+was raised against/);
  assert.match(guide, /Route findings that arrive after the cap to follow-up GitHub issues/);
  assert.match(decisions, /## D037: cap pull request follow-up review rounds at two/);
  assert.match(decisions, /process limit on review churn, not a security\s+control/);
});

test('requires evaluators to review one unchanged clean commit', () => {
  const instructions = readFileSync(resolve('AGENTS.md'), 'utf8');
  const evaluator = readFileSync(
    resolve('.github/skills/feature-evaluator/SKILL.md'),
    'utf8',
  );
  const implementer = readFileSync(
    resolve('.github/agents/harness-implementer.agent.md'),
    'utf8',
  );
  const guide = readFileSync(resolve('docs/harness-agent.md'), 'utf8');

  assert.match(instructions, /named, clean commit/i);
  assert.match(instructions, /same commit.*clean tree/is);
  assert.match(evaluator, /Do not evaluate an\s+uncommitted diff/i);
  assert.match(evaluator, /starting commit is still\s+checked out/i);
  assert.match(evaluator, /report `STALE`/);
  assert.match(evaluator, /stop without evaluating if it reports any\s+entry/i);
  assert.match(evaluator, /Untracked files change module resolution/i);
  assert.match(evaluator, /`git status --short` reports any entry/);
  assert.match(implementer, /authorized parent or user\s+must commit/i);
  assert.match(guide, /record the full commit SHA/i);
  assert.match(guide, /`git status --short`\s+reports any entry/);
  assert.match(guide, /records neither PASS nor FAIL/i);
});

test('exempts bounded-loop dispatch from the evaluator clean-commit gate', () => {
  const evaluator = readFileSync(
    resolve('.github/skills/feature-evaluator/SKILL.md'),
    'utf8',
  );
  const guide = readFileSync(resolve('docs/harness-agent.md'), 'utf8');

  assert.match(evaluator, /Exception for bounded-loop dispatch/i);
  assert.match(evaluator, /clean-commit gate does not apply to that dispatch/i);
  assert.match(evaluator, /controller-recorded round fingerprint/i);
  assert.match(evaluator, /clean-commit gate\s+governs every fresh session/i);
  assert.match(guide, /its checker\s+dispatch is exempt/i);
});

test('keeps bounded-loop PASS verdicts provisional until a clean-commit evaluation', () => {
  const instructions = readFileSync(resolve('AGENTS.md'), 'utf8');
  const evaluator = readFileSync(
    resolve('.github/skills/feature-evaluator/SKILL.md'),
    'utf8',
  );
  const guide = readFileSync(resolve('docs/harness-agent.md'), 'utf8');
  const decisions = readFileSync(resolve('docs/decisions.md'), 'utf8');

  assert.match(instructions, /bounded-loop checker PASS is provisional and does not satisfy this rule/);
  assert.match(evaluator, /A PASS from bounded-loop dispatch\s+is provisional and never does/);
  assert.match(evaluator, /A loop-dispatched PASS is provisional/);
  assert.match(evaluator, /must not be used to move\s+the feature to `pass`/);
  assert.match(evaluator, /provisional loop verdict PASS .* at round fingerprint <fingerprint>\. Not a clean-commit verdict\./);
  assert.match(guide, /A PASS from that dispatch is provisional/);
  assert.match(guide, /A `pass` result is a provisional loop verdict, not a feature `pass`/);
  assert.match(decisions, /## D038: bounded-loop PASS verdicts are provisional/);
});

test('requires the evaluator prompt to name the reviewed commit', () => {
  const guide = readFileSync(resolve('docs/harness-agent.md'), 'utf8');
  const evaluator = readFileSync(
    resolve('.github/skills/feature-evaluator/SKILL.md'),
    'utf8',
  );

  assert.match(guide, /Evaluate F001 in slug <generated-slug> at commit <full-sha>/);
  assert.match(guide, /Always pass the full commit SHA/i);
  assert.match(evaluator, /The full commit SHA named for evaluation/i);

  // The Harness Implementer hands this prompt to the user directly, so its
  // template must carry the SHA the evaluator now requires.
  const implementer = readFileSync(
    resolve('.github/agents/harness-implementer.agent.md'),
    'utf8',
  );
  assert.match(
    implementer,
    /Evaluate <feature-id> in slug <slug> at commit <full-sha>/,
  );
  assert.match(implementer, /The SHA is required/i);
});

test('keeps D036 and the rubric template consistent with both evaluation paths', () => {
  const decisions = readFileSync(resolve('docs/decisions.md'), 'utf8');
  const evaluator = readFileSync(
    resolve('.github/skills/feature-evaluator/SKILL.md'),
    'utf8',
  );

  assert.match(decisions, /Evaluators dispatched by the bounded loop review\s+the controller-recorded round fingerprint/i);
  assert.match(decisions, /clean-commit evaluator gate for human-dispatched evaluations/i);
  assert.match(evaluator, /Reviewed revision and working tree/);
  assert.match(evaluator, /or, under bounded-loop dispatch, the controller-recorded round\s+fingerprint/i);
  assert.match(evaluator, /Under bounded-loop\s+dispatch the tree is necessarily dirty/i);
  assert.match(decisions, /Cleanup is\s+deliberately not bounded/i);
});

test('revision fingerprints distinguish rearranged untracked names and contents', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-fingerprint-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'src'), { recursive: true });

  const runner = (untracked) => (args) => {
    if (args[0] === 'rev-parse') return 'abc123\n';
    if (args[0] === 'status') return ' M src/a\n';
    if (args[0] === 'diff') return '';
    return `${untracked.join('\n')}\n`;
  };

  // Under an un-delimited encoding these two states hash identically.
  writeFileSync(join(root, 'src/a'), '\nsrc/b\nx');
  const collapsed = getGitRevision(root, runner(['src/a']));

  writeFileSync(join(root, 'src/a'), '');
  writeFileSync(join(root, 'src/b'), 'x');
  const expanded = getGitRevision(root, runner(['src/a', 'src/b']));

  assert.notEqual(collapsed.fingerprint, expanded.fingerprint);
});

test('dispatches Harness Implementer maker and fresh evaluator checker sessions', async () => {
  const calls = [];
  const statePath = resolve(tmpdir(), 'agentgate-dispatch-state', 'state.json');
  const deniedState = statePath.replaceAll('\\', '/');
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
    statePath,
  });
  await dispatcher.dispatch({
    actor: 'checker',
    goal: goal(),
    feedback: null,
    verificationRecords: [{
      command: 'node --test scripts/maker-checker-loop.test.mjs',
      status: 'passed',
      runId: 'run-checker-evidence',
      exitCode: 0,
      reportPath: '.local/verification/run-checker-evidence/report.json',
    }],
    timeoutMs: 1000,
    statePath,
    revisionFingerprint: 'round-fingerprint-abc123',
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
  assert.match(calls[1].args.at(-1), /bounded maker-checker loop dispatch/);
  assert.match(calls[1].args.at(-1), /clean-commit\s+gate does not apply/);
  assert.match(
    calls[1].args.at(-1),
    /Controller round fingerprint: round-fingerprint-abc123\./,
  );
  assert.match(calls[1].args.at(-1), /Record that fingerprint as the reviewed revision/);
  assert.match(calls[1].args.at(-1), /A PASS from this dispatch is provisional/);
  assert.match(calls[1].args.at(-1), /provisional loop verdict/);
  assert.match(
    calls[1].args.at(-1),
    /Recorded verification results: \[\{"command":"node --test scripts\/maker-checker-loop\.test\.mjs","status":"passed","runId":"run-checker-evidence","exitCode":0,"reportPath":"\.local\/verification\/run-checker-evidence\/report\.json"\}\]/,
  );
  assert.ok(!calls[1].args.includes('--agent'));
  assert.ok(!calls.flatMap((call) => call.args).includes('--resume'));
  assert.ok(!calls.flatMap((call) => call.args).includes('--continue'));
  for (const argument of [
    `--deny-tool=write(${deniedState})`,
    `--deny-tool=write(${deniedState}.*)`,
    `--deny-tool=write(${deniedState}.lock)`,
    `--deny-tool=write(${deniedState}.lock/**)`,
  ]) {
    assert.ok(calls.every((call) => call.args.includes(argument)), `missing ${argument}`);
  }
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

test('terminates a process that exceeds the combined output byte limit', async () => {
  let childProcess;
  let childClosed;
  const dispatch = runProcess(
    process.execPath,
    [
      '-e',
      'process.stdout.write(Buffer.alloc(800 * 1024));'
        + 'process.stderr.write(Buffer.alloc(300 * 1024));'
        + 'setInterval(() => {}, 1000);',
    ],
    {
      cwd: process.cwd(),
      timeoutMs: 10000,
      terminateProcessTree: async (child) => {
        childProcess = child;
        childClosed = once(child, 'close');
        child.kill();
      },
    },
  );

  await assert.rejects(
    dispatch,
    new RegExp(`Child process exceeded its ${MAX_PROCESS_OUTPUT_BYTES} byte combined output limit`),
  );
  assert.ok(childProcess, 'output overflow should terminate the child process');
  await childClosed;
  assert.ok(
    childProcess.exitCode !== null || childProcess.signalCode !== null,
    'the process should be closed after output overflow',
  );
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
        console.error(JSON.stringify({ code: error.code, message: error.message }));
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
      assert.match(stderr, new RegExp(`ERR_MAKER_CHECKER_INTERRUPTED.*interrupted by ${signal}`));
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

test('validates the safety boundary before resumed checker verification', async (t) => {
  const statePath = fixture(t);
  const contract = goal();
  const makerRevision = revision('maker-without-verification');
  saveLoopState(statePath, recordRound(
    createLoopState(contract, new Date('2026-10-10T09:59:00.000Z')),
    {
      actor: 'maker',
      startedAt: '2026-10-10T10:00:00.000Z',
      finishedAt: '2026-10-10T10:00:01.000Z',
      reviewedRevision: makerRevision,
      outcome: 'completed',
      feedback: 'Legacy maker round without controller evidence.',
      nextAction: 'checker',
      verification: null,
      humanIntervention: { required: false, reason: null },
    },
  ));
  let verificationCalls = 0;
  const runner = {
    async ensureReady() {},
    async run() {
      verificationCalls += 1;
      return { status: 'passed', runId: 'must-not-run', exitCode: 0 };
    },
  };
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'pass', feedback: 'must not run' },
  ]);

  const result = await runLoop({
    goal: contract,
    statePath,
    dispatcher,
    getRevision: () => makerRevision,
    safetyBoundary: {
      capture() {
        throw new Error('Verification input contains an unsupported loader.');
      },
      assertTransition() {},
    },
    verificationRunner: runner,
    now: clock(),
  });

  assert.equal(result.status, 'approval-required');
  assert.equal(verificationCalls, 0);
  assert.equal(dispatcher.calls.length, 0);
});

test('records an interrupted dispatch and resumes the same actor', async (t) => {
  const statePath = fixture(t);
  const contract = goal();
  const makerRevision = revision('maker-before-interruption');
  const initial = createLoopState(
    contract,
    new Date('2026-10-10T09:59:00.000Z'),
  );
  saveLoopState(statePath, recordRound(initial, {
    actor: 'maker',
    startedAt: '2026-10-10T10:00:00.000Z',
    finishedAt: '2026-10-10T10:00:01.000Z',
    reviewedRevision: makerRevision,
    outcome: 'completed',
    feedback: 'Maker completed before the checker was interrupted.',
    nextAction: 'checker',
    humanIntervention: { required: false, reason: null },
  }));

  const interrupted = await runLoop({
    goal: contract,
    statePath,
    dispatcher: {
      async dispatch() {
        const error = new Error('Child process was interrupted by SIGINT.');
        error.code = 'ERR_MAKER_CHECKER_INTERRUPTED';
        error.signal = 'SIGINT';
        throw error;
      },
    },
    getRevision: () => makerRevision,
    now: clock(),
  });

  assert.equal(interrupted.status, 'interrupted');
  assert.deepEqual(
    interrupted.state.rounds.slice(-1).map((round) => ({
      actor: round.actor,
      outcome: round.outcome,
      nextAction: round.nextAction,
      humanIntervention: round.humanIntervention,
    })),
    [{
      actor: 'checker',
      outcome: 'interrupted',
      nextAction: 'checker',
      humanIntervention: { required: false, reason: null },
    }],
  );

  const dispatcher = new ScriptedDispatcher([
    { outcome: 'pass', feedback: 'checker passed after resume' },
  ]);
  const resumed = await runLoop({
    goal: contract,
    statePath,
    dispatcher,
    getRevision: () => makerRevision,
    now: clock(),
  });

  assert.equal(resumed.status, 'pass');
  assert.deepEqual(dispatcher.calls.map((call) => call.actor), ['checker']);
  assert.deepEqual(
    resumed.state.rounds.map((round) => `${round.actor}:${round.outcome}`),
    ['maker:completed', 'checker:interrupted', 'checker:pass'],
  );
});

test('allows only one controller to use a state path at a time', async (t) => {
  const statePath = fixture(t);
  let signalDispatchStarted;
  let releaseDispatch;
  const dispatchStarted = new Promise((resolveStarted) => {
    signalDispatchStarted = resolveStarted;
  });
  const dispatchGate = new Promise((resolveDispatch) => {
    releaseDispatch = resolveDispatch;
  });
  const dispatcher = {
    calls: [],
    async dispatch({ actor }) {
      dispatcher.calls.push(actor);
      signalDispatchStarted();
      await dispatchGate;
      return { outcome: 'blocked', feedback: 'Stop after lock assertion.' };
    },
  };
  const options = {
    goal: goal(),
    statePath,
    dispatcher,
    getRevision: () => revision('initial'),
    now: clock(),
  };
  const first = runLoop(options);
  await dispatchStarted;
  try {
    await assert.rejects(
      runLoop({
        ...options,
        dispatcher: new ScriptedDispatcher([]),
      }),
      /state is locked.*Automatic stale-lock recovery is disabled/,
    );
    assert.deepEqual(dispatcher.calls, ['maker']);
  } finally {
    releaseDispatch();
  }

  const result = await first;
  assert.equal(result.status, 'blocked');
  assert.equal(existsSync(`${statePath}.lock`), false);
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

test('reruns verification when a migrated round lacks the architecture check', async (t) => {
  const statePath = fixture(t);
  const contract = goal();
  const makerRevision = revision('maker-feature-only');
  saveLoopState(statePath, recordRound(
    createLoopState(contract, new Date('2026-10-10T09:59:00.000Z')),
    {
      actor: 'maker',
      startedAt: '2026-10-10T10:00:00.000Z',
      finishedAt: '2026-10-10T10:00:01.000Z',
      reviewedRevision: makerRevision,
      outcome: 'completed',
      feedback: 'Schema v1 round with only the feature command recorded.',
      nextAction: 'checker',
      verification: [{
        command: contract.verificationCommand,
        status: 'passed',
        runId: 'feature-only-run',
        exitCode: 0,
        reportPath: '.local/verification/feature-only-run/report.json',
      }],
      humanIntervention: { required: false, reason: null },
    },
  ));
  const runner = verificationRunner();
  const dispatcher = new ScriptedDispatcher([{ outcome: 'pass', feedback: 'checker passed' }]);

  const result = await runLoop({
    goal: contract,
    statePath,
    dispatcher,
    verificationRunner: runner,
    getRevision: () => makerRevision,
    now: clock(),
  });

  assert.equal(result.status, 'pass');
  assert.deepEqual(
    runner.calls.map((call) => call.command),
    [contract.verificationCommand, 'bash scripts/check-architecture.sh'],
  );
  assert.deepEqual(
    dispatcher.calls[0].verificationRecords.map((entry) => entry.command),
    [contract.verificationCommand, 'bash scripts/check-architecture.sh'],
  );
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

test('rolls back a stale checker verdict written during evaluation', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-stale-verdict-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const progressPath = join(root, 'agent-progress.md');
  const rubricPath = join(root, 'evaluator-rubric.md');
  writeFileSync(progressPath, '# Progress\n');

  const scripted = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'maker finished' },
    { outcome: 'pass', feedback: 'checker passed' },
  ]);
  const dispatcher = {
    calls: scripted.calls,
    async dispatch(request) {
      if (request.actor === 'checker') {
        writeFileSync(progressPath, '# Progress\n\nF003 PASS\n');
        writeFileSync(rubricPath, 'stale rubric\n');
      }
      return scripted.dispatch(request);
    },
  };

  const result = await runLoop({
    goal: goal(),
    statePath: fixture(t),
    dispatcher,
    evaluatorArtifactPaths: [progressPath, rubricPath],
    getRevision: revisions(
      revision('initial'),
      revision('maker'),
      revision('maker'),
      revision('drifted'),
    ),
    now: clock(),
  });

  assert.equal(result.status, 'stale');
  assert.equal(readFileSync(progressPath, 'utf8'), '# Progress\n');
  assert.equal(existsSync(rubricPath), false);
  assert.match(result.state.rounds.at(-1).feedback, /Rolled back the stale evaluator verdict/);
});

test('revision fingerprints distinguish untracked symlinks from their targets', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-fingerprint-link-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'target-a'), 'x');
  writeFileSync(join(root, 'target-b'), 'x');
  try {
    symlinkSync(join(root, 'target-a'), join(root, 'link'));
  } catch {
    t.skip('symbolic links are unavailable without elevation on this host');
    return;
  }

  const runner = (args) => {
    if (args[0] === 'rev-parse') return 'abc123\n';
    if (args[0] === 'status') return ' M link\n';
    if (args[0] === 'diff') return '';
    return 'link\n';
  };

  const first = getGitRevision(root, runner);
  rmSync(join(root, 'link'));
  symlinkSync(join(root, 'target-b'), join(root, 'link'));
  const second = getGitRevision(root, runner);

  assert.notEqual(first.fingerprint, second.fingerprint);
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

test('counts an unchanged first maker round toward the no-progress limit', async (t) => {
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'completed', feedback: 'no files changed' },
  ]);
  const same = revision('unchanged');
  const result = await runLoop({
    goal: goal({ noProgressLimit: 1 }),
    statePath: fixture(t),
    dispatcher,
    getRevision: revisions(same, same),
    now: clock(),
  });

  assert.equal(result.status, 'stalled');
  assert.deepEqual(dispatcher.calls.map((call) => call.actor), ['maker']);
  assert.equal(result.state.rounds.at(-1).outcome, 'stalled');
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
  assert.deepEqual(dispatcher.calls[0].verificationRecords, [
    {
      command: contract.verificationCommand,
      status: 'passed',
      runId: 'run-resume-1',
      exitCode: 0,
      reportPath: '.local/verification/run-resume-1/report.json',
    },
    {
      command: 'bash scripts/check-architecture.sh',
      status: 'passed',
      runId: 'run-resume-arch',
      exitCode: 0,
      reportPath: '.local/verification/run-resume-arch/report.json',
    },
  ]);
});

test('resumes checker after controller verification is interrupted', async (t) => {
  const statePath = fixture(t);
  const contract = goal();
  const makerRevision = revision('maker-without-verification');
  saveLoopState(statePath, recordRound(
    createLoopState(contract, new Date('2026-10-10T09:59:00.000Z')),
    {
      actor: 'maker',
      startedAt: '2026-10-10T10:00:00.000Z',
      finishedAt: '2026-10-10T10:00:01.000Z',
      reviewedRevision: makerRevision,
      outcome: 'completed',
      feedback: 'Legacy maker round without controller evidence.',
      nextAction: 'checker',
      verification: null,
      humanIntervention: { required: false, reason: null },
    },
  ));

  const interruption = new Error('Verification process was interrupted by SIGINT.');
  interruption.code = 'ERR_MAKER_CHECKER_INTERRUPTED';
  interruption.signal = 'SIGINT';
  const interrupted = await runLoop({
    goal: contract,
    statePath,
    dispatcher: new ScriptedDispatcher([]),
    verificationRunner: {
      async run() {
        throw interruption;
      },
    },
    getRevision: () => makerRevision,
    now: clock(),
  });

  assert.equal(interrupted.status, 'interrupted');
  assert.deepEqual(
    interrupted.state.rounds.at(-1),
    {
      number: 2,
      actor: 'checker',
      startedAt: '2026-10-10T10:00:00.000Z',
      finishedAt: '2026-10-10T10:00:02.000Z',
      reviewedRevision: makerRevision,
      outcome: 'interrupted',
      feedback: interruption.message,
      nextAction: 'checker',
      verification: null,
      humanIntervention: { required: false, reason: null },
    },
  );

  const runner = verificationRunner([
    { status: 'passed', runId: 'run-resume-1', exitCode: 0 },
    { status: 'passed', runId: 'run-resume-arch', exitCode: 0 },
  ]);
  const dispatcher = new ScriptedDispatcher([
    { outcome: 'pass', feedback: 'checker passed after verification resumed' },
  ]);
  const resumed = await runLoop({
    goal: contract,
    statePath,
    dispatcher,
    verificationRunner: runner,
    getRevision: () => makerRevision,
    now: clock(),
  });

  assert.equal(resumed.status, 'pass');
  assert.deepEqual(dispatcher.calls.map((call) => call.actor), ['checker']);
  assert.deepEqual(
    resumed.state.rounds.map((round) => `${round.actor}:${round.outcome}`),
    ['maker:completed', 'checker:interrupted', 'checker:pass'],
  );
  assert.deepEqual(dispatcher.calls[0].verificationRecords, [
    {
      command: contract.verificationCommand,
      status: 'passed',
      runId: 'run-resume-1',
      exitCode: 0,
      reportPath: '.local/verification/run-resume-1/report.json',
    },
    {
      command: 'bash scripts/check-architecture.sh',
      status: 'passed',
      runId: 'run-resume-arch',
      exitCode: 0,
      reportPath: '.local/verification/run-resume-arch/report.json',
    },
  ]);
});

test('resumes at the checker gate after maker-round verification is interrupted', async (t) => {
  const statePath = fixture(t);
  const contract = goal();
  const interruption = new Error('Verification process was interrupted by SIGINT.');
  interruption.code = 'ERR_MAKER_CHECKER_INTERRUPTED';
  const interrupted = await runLoop({
    goal: contract,
    statePath,
    dispatcher: new ScriptedDispatcher([{ outcome: 'completed', feedback: 'maker finished' }]),
    verificationRunner: {
      async run() {
        throw interruption;
      },
    },
    getRevision: revisions(revision('initial'), revision('maker')),
    now: clock(),
  });

  assert.equal(interrupted.status, 'interrupted');
  const round = interrupted.state.rounds.at(-1);
  assert.equal(round.actor, 'maker');
  assert.equal(round.outcome, 'interrupted');
  assert.equal(round.nextAction, 'checker');
  assert.equal(round.verification, null);
  assert.deepEqual(round.humanIntervention, { required: false, reason: null });

  const runner = verificationRunner();
  const dispatcher = new ScriptedDispatcher([{ outcome: 'pass', feedback: 'checker passed' }]);
  const resumed = await runLoop({
    goal: contract,
    statePath,
    dispatcher,
    verificationRunner: runner,
    getRevision: () => revision('maker'),
    now: clock(),
  });

  assert.equal(resumed.status, 'pass');
  assert.deepEqual(dispatcher.calls.map((call) => call.actor), ['checker']);
  assert.equal(runner.calls.length, 2);
  assert.deepEqual(
    resumed.state.rounds.map((entry) => `${entry.actor}:${entry.outcome}`),
    ['maker:interrupted', 'checker:pass'],
  );
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