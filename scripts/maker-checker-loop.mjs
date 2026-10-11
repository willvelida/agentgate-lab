import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createLoopState,
  getResumeDecision,
  loadLoopState,
  recordRound,
  saveLoopState,
} from './loop-state.mjs';
import {
  CopilotCapabilityBoundary,
  DenyByDefaultCommandPolicy,
  RepositorySafetyBoundary,
} from './maker-checker-safety.mjs';

const resultMarker = 'MAKER_CHECKER_RESULT:';
const makerOutcomes = new Set([
  'completed',
  'blocked',
  'ambiguous',
  'no-progress',
]);
const checkerOutcomes = new Set([
  'pass',
  'fail',
  'blocked',
  'ambiguous',
  'stale',
]);

function sameRevision(left, right) {
  if (left.commit !== right.commit) {
    return false;
  }
  if (left.fingerprint && right.fingerprint) {
    return left.fingerprint === right.fingerprint;
  }
  if (left.dirty || right.dirty) {
    return false;
  }
  return true;
}

function humanStop(reason) {
  return {
    required: true,
    reason,
  };
}

function parseDispatchResult(actor, output) {
  const markerIndex = output.lastIndexOf(resultMarker);
  if (markerIndex === -1) {
    throw new Error(`Copilot ${actor} response did not include ${resultMarker}.`);
  }

  const text = output.slice(markerIndex + resultMarker.length).trim().split(/\r?\n/, 1)[0];
  let result;
  try {
    result = JSON.parse(text);
  } catch (error) {
    throw new Error(`Copilot ${actor} returned invalid result JSON: ${error.message}`, {
      cause: error,
    });
  }

  const allowed = actor === 'maker' ? makerOutcomes : checkerOutcomes;
  if (!result || !allowed.has(result.outcome)) {
    throw new Error(`Copilot ${actor} returned an unsupported outcome.`);
  }
  if (typeof result.feedback !== 'string' || result.feedback.length === 0) {
    throw new Error(`Copilot ${actor} result must include non-empty feedback.`);
  }
  return result;
}

function signalProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') {
      throw error;
    }
  }
}

async function terminateProcessTree(child) {
  if (!child.pid) {
    return;
  }

  if (process.platform === 'win32') {
    await new Promise((resolveTermination, rejectTermination) => {
      const terminator = spawn(
        'taskkill.exe',
        ['/PID', String(child.pid), '/T', '/F'],
        { stdio: 'ignore', windowsHide: true },
      );
      terminator.once('error', rejectTermination);
      terminator.once('close', (code) => {
        if (code === 0) {
          resolveTermination();
        } else {
          rejectTermination(new Error(`taskkill.exe exited with code ${code}.`));
        }
      });
    });
    return;
  }

  signalProcessGroup(child.pid, 'SIGTERM');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  signalProcessGroup(child.pid, 'SIGKILL');
}

export function runProcess(executable, args, options) {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled || child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      timedOut = true;
      terminateProcessTree(child).then(
        () => {
          settled = true;
          reject(new Error(`Child process exceeded its ${options.timeoutMs} ms dispatch limit.`));
        },
        (error) => {
          settled = true;
          reject(new Error(
            `Child process exceeded its ${options.timeoutMs} ms dispatch limit,`
              + ` and process-tree termination failed: ${error.message}`,
            { cause: error },
          ));
        },
      );
    }, options.timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(new Error(`Unable to start ${executable}: ${error.message}`, { cause: error }));
      }
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (settled || timedOut) {
        return;
      }
      settled = true;
      if (code !== 0 && !options.allowNonZeroExit) {
        reject(new Error(
          `Copilot session failed with exit code ${code}`
            + `${signal ? ` and signal ${signal}` : ''}: ${stderr.trim()}`,
        ));
      } else {
        resolveProcess({ stdout, stderr, exitCode: code, signal });
      }
    });
  });
}

export class CopilotCliDispatcher {
  constructor({
    repositoryRoot = process.cwd(),
    executable = 'copilot',
    processRunner = runProcess,
    commandPolicy,
    capabilityBoundary,
  } = {}) {
    this.repositoryRoot = resolve(repositoryRoot);
    this.executable = executable;
    this.processRunner = processRunner;
    this.commandPolicy = commandPolicy ?? new DenyByDefaultCommandPolicy({
      executable,
      repositoryRoot: this.repositoryRoot,
    });
    this.capabilityBoundary = capabilityBoundary ?? new CopilotCapabilityBoundary({
      executable,
      repositoryRoot: this.repositoryRoot,
    });
  }

  async dispatch({ actor, goal, feedback, timeoutMs }) {
    const contract = [
      `Goal: ${goal.goal}`,
      `Constraints: ${goal.constraints.map((entry, index) => `(${index + 1}) ${entry}`).join(' ')}`,
      `Verification command: ${goal.verificationCommand}`,
      'Shell access is disabled for this session, so you cannot run that command yourself.',
      'The loop controller runs it, and the repository architecture check, from outside',
      'the session after your turn and records the structured results. Never claim to',
      'have run verification or architecture checks.',
    ].join(' ');
    const prompt = actor === 'maker'
      ? [
          `Work on issue #${goal.issue}, existing slug ${goal.featureSlug},`,
          `${goal.featureId} only. The feature design is already approved.`,
          'Follow the Harness Implementer workflow and do not commit or publish.',
          contract,
          feedback ? `Feedback to address: ${feedback}` : '',
          `End your response with exactly one line starting ${resultMarker}`,
          'followed by JSON with outcome completed, blocked, ambiguous, or no-progress',
          'and a non-empty feedback string.',
        ].filter(Boolean).join(' ')
      : [
          `/feature-evaluator Evaluate ${goal.featureId} in slug ${goal.featureSlug}.`,
          'Run this as a fresh independent evaluation session.',
          contract,
          'Judge the recorded controller verification evidence instead of rerunning it.',
          `End your response with exactly one line starting ${resultMarker}`,
          'followed by JSON with outcome pass, fail, blocked, ambiguous, or stale',
          'and a non-empty feedback string.',
        ].join(' ');

    const capabilityArguments = await this.capabilityBoundary.copilotArguments();
    const args = [
      '-C',
      this.repositoryRoot,
      '--silent',
      '--stream',
      'off',
      '--output-format',
      'text',
      ...capabilityArguments,
    ];
    if (actor === 'maker') {
      args.push('--agent', 'Harness Implementer');
    }
    args.push('--prompt', prompt);

    this.commandPolicy.assertAllowed(this.executable, args, {
      cwd: this.repositoryRoot,
    });
    const { stdout } = await this.processRunner(this.executable, args, {
      cwd: this.repositoryRoot,
      timeoutMs,
    });
    return parseDispatchResult(actor, stdout);
  }
}

export function tokenizeCommand(command) {
  if (typeof command !== 'string') {
    throw new Error('Verification command must be a string.');
  }
  const tokens = [];
  let current = '';
  let started = false;
  let quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote === "'") {
      if (character === "'") {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }
    if (quote === '"') {
      const next = command[index + 1];
      if (character === '\\' && (next === '"' || next === '\\')) {
        current += next;
        index += 1;
      } else if (character === '"') {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      started = true;
      continue;
    }
    if (/\s/.test(character)) {
      if (started) {
        tokens.push(current);
        current = '';
        started = false;
      }
      continue;
    }
    current += character;
    started = true;
  }
  if (quote !== null) {
    throw new Error('Verification command has an unterminated quote.');
  }
  if (started) {
    tokens.push(current);
  }
  if (tokens.length === 0) {
    throw new Error('Verification command must not be empty.');
  }
  return tokens;
}

export class VerificationRunner {
  constructor({
    repositoryRoot = process.cwd(),
    processRunner = runProcess,
    nodeExecutable = process.execPath,
    readReport = (path) => JSON.parse(readFileSync(path, 'utf8')),
  } = {}) {
    this.repositoryRoot = resolve(repositoryRoot);
    this.processRunner = processRunner;
    this.nodeExecutable = nodeExecutable;
    this.readReport = readReport;
  }

  async run(command, { timeoutMs }) {
    const tokens = tokenizeCommand(command);
    const runner = resolve(this.repositoryRoot, 'scripts', 'run-verification.mjs');
    const { stderr } = await this.processRunner(
      this.nodeExecutable,
      [runner, '--', ...tokens],
      {
        cwd: this.repositoryRoot,
        timeoutMs,
        allowNonZeroExit: true,
      },
    );
    const reportPath = /^Verification report: (.+)$/m.exec(stderr)?.[1]?.trim();
    if (!reportPath) {
      throw new Error('Verification runner did not report an evidence path.');
    }
    const report = this.readReport(reportPath);
    return {
      command,
      status: report.status,
      runId: report.runId ?? null,
      exitCode: Number.isInteger(report.exitCode) ? report.exitCode : null,
      reportPath: relative(this.repositoryRoot, reportPath).split('\\').join('/'),
    };
  }
}

export class ScriptedDispatcher {
  constructor(results) {
    this.results = [...results];
    this.calls = [];
  }

  async dispatch(request) {
    this.calls.push(request);
    if (this.results.length === 0) {
      throw new Error('Dry-run dispatcher has no result for the next round.');
    }
    return this.results.shift();
  }
}

export function getGitRevision(
  repositoryRoot = process.cwd(),
  commandRunner = (args) => execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }),
  excludedPaths = [],
) {
  const commit = commandRunner(['rev-parse', 'HEAD']).trim();
  const status = commandRunner(['status', '--porcelain=v1']).trim();
  const pathspec = [
    '--',
    '.',
    ...excludedPaths.map((path) => `:(exclude)${path}`),
  ];
  const trackedDiff = commandRunner(['diff', '--binary', 'HEAD', ...pathspec]);
  const untracked = commandRunner([
    'ls-files',
    '--others',
    '--exclude-standard',
    ...pathspec,
  ]).trim().split(/\r?\n/).filter(Boolean);
  const fingerprint = createHash('sha256')
    .update(`${commit}\n${trackedDiff}`);
  for (const path of untracked) {
    fingerprint.update(`\n${path}\n`);
    fingerprint.update(readFileSync(resolve(repositoryRoot, path)));
  }
  return {
    commit,
    dirty: status.length > 0,
    fingerprint: fingerprint.digest('hex'),
  };
}

function countNoProgressMakerRounds(state) {
  let count = 0;
  for (let index = state.rounds.length - 1; index >= 0; index -= 1) {
    const round = state.rounds[index];
    if (round.actor !== 'maker') continue;
    if (round.outcome !== 'no-progress') break;
    count += 1;
  }
  return count;
}

function latestMakerRound(state) {
  return [...state.rounds].reverse().find((round) => round.actor === 'maker') ?? null;
}

function hasPassedVerification(round) {
  return Array.isArray(round?.verification)
    && round.verification.length > 0
    && round.verification.every((entry) => entry.status === 'passed');
}

function latestMakerRevision(state) {
  return latestMakerRound(state)?.reviewedRevision;
}

function pendingMakerFeedback(state) {
  const pending = [...state.rounds].reverse().find((round) => round.nextAction === 'maker');
  return pending?.feedback ?? null;
}

function remainingTime(state, now) {
  return state.goal.limits.maxElapsedTimeMs
    - (now.getTime() - Date.parse(state.startedAt));
}

function persistRound(statePath, state, round, now) {
  const nextState = recordRound(state, round, now);
  saveLoopState(statePath, nextState);
  return nextState;
}

function terminalRound(actor, revision, now, outcome, feedback, reason) {
  const timestamp = now.toISOString();
  return {
    actor,
    startedAt: timestamp,
    finishedAt: timestamp,
    reviewedRevision: revision,
    outcome,
    feedback,
    nextAction: 'stop',
    verification: null,
    humanIntervention: humanStop(reason),
  };
}

function canonicalGoal(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalGoal(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalGoal(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export async function runMakerCheckerLoop({
  goal,
  statePath,
  dispatcher = new CopilotCliDispatcher(),
  getRevision,
  safetyBoundary = new RepositorySafetyBoundary(),
  verificationRunner = new VerificationRunner(),
  architectureCommand = 'bash scripts/check-architecture.sh',
  now = () => new Date(),
}) {
  if (typeof getRevision !== 'function') {
    throw new Error('runMakerCheckerLoop requires a getRevision function.');
  }

  let state = existsSync(statePath)
    ? loadLoopState(statePath)
    : createLoopState(goal, now());
  if (canonicalGoal(state.goal) !== canonicalGoal(goal)) {
    throw new Error(
      'The supplied goal contract does not match the contract recorded in the loop state.'
        + ' Resume with the original contract or start a new state file.',
    );
  }
  const activeGoal = state.goal;
  saveLoopState(statePath, state);

  const verificationCommands = [
    ...new Set([activeGoal.verificationCommand, architectureCommand]
      .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)),
  ];

  async function runControllerVerification() {
    const results = [];
    for (const command of verificationCommands) {
      const timeoutMs = remainingTime(state, now());
      if (timeoutMs <= 0) {
        return { results, limitExhausted: true };
      }
      results.push(await verificationRunner.run(command, { timeoutMs }));
    }
    return { results, limitExhausted: false };
  }

  while (true) {
    const decision = getResumeDecision(state);
    if (decision.action === 'stop') {
      return { status: decision.reason, state };
    }

    const actor = decision.actor;
    const before = getRevision();
    const startedAt = now();
    let gateVerification = null;
    const timeLeft = remainingTime(state, startedAt);
    if (state.rounds.length >= activeGoal.limits.maxRounds || timeLeft <= 0) {
      state = persistRound(
        statePath,
        state,
        terminalRound(
          actor,
          before,
          startedAt,
          'limit-exhausted',
          'Configured round or elapsed-time limit was exhausted.',
          'Increase the goal limits or revise the work before resuming.',
        ),
        startedAt,
      );
      return { status: 'limit-exhausted', state };
    }

    if (actor === 'checker') {
      const makerRevision = latestMakerRevision(state);
      if (!makerRevision || !sameRevision(before, makerRevision)) {
        state = persistRound(
          statePath,
          state,
          terminalRound(
            actor,
            before,
            startedAt,
            'stale',
            'Work changed after the maker round and before independent evaluation.',
            'Review the changed work before starting another maker round.',
          ),
          startedAt,
        );
        return { status: 'stale', state };
      }
      if (!hasPassedVerification(latestMakerRound(state))) {
        let gateRun;
        try {
          gateRun = await runControllerVerification();
        } catch (error) {
          state = persistRound(
            statePath,
            state,
            terminalRound(
              actor,
              before,
              startedAt,
              'blocked',
              `Controller verification could not run: ${error.message}`,
              'Repair the verification runner before resuming.',
            ),
            startedAt,
          );
          return { status: 'blocked', state };
        }
        const gateResults = gateRun.results;
        if (gateRun.limitExhausted) {
          const finishedAt = now();
          state = persistRound(statePath, state, {
            actor,
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            reviewedRevision: before,
            outcome: 'limit-exhausted',
            feedback: 'Configured elapsed-time limit was exhausted during controller verification.',
            nextAction: 'stop',
            verification: gateResults,
            humanIntervention: humanStop(
              'Increase the goal limits or revise the work before resuming.',
            ),
          }, finishedAt);
          return { status: 'limit-exhausted', state };
        }
        const failure = gateResults.find((entry) => entry.status !== 'passed');
        if (failure) {
          const finishedAt = now();
          state = persistRound(
            statePath,
            state,
            {
              actor,
              startedAt: startedAt.toISOString(),
              finishedAt: finishedAt.toISOString(),
              reviewedRevision: before,
              outcome: 'fail',
              feedback: `Controller verification ${failure.status} for`
                + ` \`${failure.command}\` (run ${failure.runId ?? 'unknown'}).`
                + ' Fix the failure before independent evaluation.',
              nextAction: 'maker',
              verification: gateResults,
              humanIntervention: { required: false, reason: null },
            },
            finishedAt,
          );
          continue;
        }
        gateVerification = gateResults;
      }
    }

    const dispatchTimeLeft = remainingTime(state, now());
    if (dispatchTimeLeft <= 0) {
      const finishedAt = now();
      state = persistRound(statePath, state, {
        actor,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        reviewedRevision: before,
        outcome: 'limit-exhausted',
        feedback: 'Configured elapsed-time limit was exhausted before agent dispatch.',
        nextAction: 'stop',
        verification: gateVerification,
        humanIntervention: humanStop(
          'Increase the goal limits or revise the work before resuming.',
        ),
      }, finishedAt);
      return { status: 'limit-exhausted', state };
    }

    let safetyBefore;
    try {
      safetyBefore = safetyBoundary.capture(activeGoal);
    } catch (error) {
      state = persistRound(
        statePath,
        state,
        terminalRound(
          actor,
          before,
          startedAt,
          'blocked',
          error.message,
          'Restore the approved feature scope before resuming.',
        ),
        startedAt,
      );
      return { status: 'approval-required', state };
    }

    let result;
    try {
      result = await dispatcher.dispatch({
        actor,
        goal: activeGoal,
        feedback: pendingMakerFeedback(state),
        timeoutMs: dispatchTimeLeft,
      });
    } catch (error) {
      const finishedAt = now();
      const after = getRevision();
      try {
        safetyBoundary.assertTransition(
          safetyBefore,
          safetyBoundary.capture(activeGoal, { requireActive: false }),
          activeGoal,
          actor,
        );
      } catch (transitionError) {
        state = persistRound(
          statePath,
          state,
          terminalRound(
            actor,
            after,
            finishedAt,
            'blocked',
            transitionError.message,
            'Review and explicitly approve or revert the prohibited change before resuming.',
          ),
          finishedAt,
        );
        return { status: 'approval-required', state };
      }
      state = persistRound(
        statePath,
        state,
        terminalRound(
          actor,
          after,
          finishedAt,
          'blocked',
          error.message,
          'Resolve the Copilot dispatch failure before resuming.',
        ),
        finishedAt,
      );
      return { status: 'blocked', state };
    }

    let finishedAt = now();
    const after = getRevision();
    try {
      safetyBoundary.assertTransition(
        safetyBefore,
        safetyBoundary.capture(activeGoal, { requireActive: false }),
        activeGoal,
        actor,
      );
    } catch (error) {
      state = persistRound(
        statePath,
        state,
        terminalRound(
          actor,
          after,
          finishedAt,
          'blocked',
          error.message,
          'Review and explicitly approve or revert the prohibited change before resuming.',
        ),
        finishedAt,
      );
      return { status: 'approval-required', state };
    }
    if (actor === 'checker' && !sameRevision(before, after)) {
      state = persistRound(
        statePath,
        state,
        terminalRound(
          actor,
          after,
          finishedAt,
          'stale',
          'Work changed while the checker was evaluating it.',
          'Review the changed work before starting another maker round.',
        ),
        finishedAt,
      );
      return { status: 'stale', state };
    }

    let outcome = result.outcome;
    let nextAction = actor === 'maker' ? 'checker' : 'maker';
    let intervention = { required: false, reason: null };
    let feedback = result.feedback;

    if (outcome === 'blocked' || outcome === 'ambiguous') {
      nextAction = 'stop';
      intervention = humanStop(
        outcome === 'ambiguous'
          ? 'Clarify the acceptance criteria or verification command.'
          : 'Resolve the blocked work before resuming.',
      );
    } else if (outcome === 'stale') {
      nextAction = 'stop';
      intervention = humanStop('Review the stale checker result before resuming.');
    } else if (actor === 'maker') {
      const previousMaker = latestMakerRevision(state);
      if (outcome === 'no-progress'
          || (previousMaker && sameRevision(previousMaker, after))) {
        outcome = 'no-progress';
      }
      if (outcome === 'no-progress'
          && countNoProgressMakerRounds(state) + 1 >= activeGoal.limits.noProgressLimit) {
        outcome = 'stalled';
        nextAction = 'stop';
        feedback = `${feedback} The configured no-progress limit was reached.`;
        intervention = humanStop('Revise the goal or provide guidance before resuming.');
      }
    } else if (outcome === 'pass') {
      nextAction = 'stop';
    }

    let verification = gateVerification;
    if (actor === 'maker' && outcome === 'completed' && nextAction === 'checker') {
      let verificationRun = null;
      try {
        verificationRun = await runControllerVerification();
        verification = verificationRun.results;
      } catch (error) {
        outcome = 'blocked';
        nextAction = 'stop';
        feedback = `${feedback} Controller verification could not run: ${error.message}`;
        intervention = humanStop('Repair the verification runner before resuming.');
      }
      finishedAt = now();
      if (verificationRun?.limitExhausted) {
        outcome = 'limit-exhausted';
        nextAction = 'stop';
        feedback = `${feedback} Configured elapsed-time limit was exhausted`
          + ' during controller verification.';
        intervention = humanStop('Increase the goal limits or revise the work before resuming.');
      }
      const failure = outcome !== 'limit-exhausted' && Array.isArray(verification)
        ? verification.find((entry) => entry.status !== 'passed')
        : null;
      if (failure) {
        outcome = 'fail';
        nextAction = 'maker';
        feedback = `${feedback} Controller verification ${failure.status} for`
          + ` \`${failure.command}\` (run ${failure.runId ?? 'unknown'}).`;
      }
    }

    const wouldContinue = nextAction !== 'stop';
    const elapsedExhausted = remainingTime(state, finishedAt) <= 0;
    const roundsExhausted = state.rounds.length + 1 >= activeGoal.limits.maxRounds;
    if (wouldContinue && (elapsedExhausted || roundsExhausted)) {
      outcome = 'limit-exhausted';
      nextAction = 'stop';
      feedback = `${feedback} Configured round or elapsed-time limit was exhausted.`;
      intervention = humanStop('Increase the goal limits or revise the work before resuming.');
    }

    state = persistRound(statePath, state, {
      actor,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      reviewedRevision: after,
      outcome,
      feedback,
      nextAction,
      verification,
      humanIntervention: intervention,
    }, finishedAt);

    if (nextAction === 'stop') {
      return { status: outcome, state };
    }
  }
}

function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!['--goal', '--state', '--dry-run'].includes(name) || !value) {
      throw new Error('Usage: node scripts/maker-checker-loop.mjs --goal <path> --state <path> [--dry-run <path>]');
    }
    values[name.slice(2)] = value;
  }
  if (!values.goal || !values.state) {
    throw new Error('Both --goal and --state are required.');
  }
  return values;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const goal = JSON.parse(readFileSync(resolve(args.goal), 'utf8'));
  const dispatcher = args['dry-run']
    ? new ScriptedDispatcher(JSON.parse(readFileSync(resolve(args['dry-run']), 'utf8')))
    : new CopilotCliDispatcher({ repositoryRoot: process.cwd() });
  const result = await runMakerCheckerLoop({
    goal,
    statePath: resolve(args.state),
    dispatcher,
    verificationRunner: new VerificationRunner({ repositoryRoot: process.cwd() }),
    safetyBoundary: new RepositorySafetyBoundary({
      repositoryRoot: process.cwd(),
      protectedPaths: [
        resolve(args.goal),
        resolve('scripts/check-architecture.sh'),
      ],
    }),
    getRevision: () => getGitRevision(
      process.cwd(),
      (gitArgs) => execFileSync('git', gitArgs, { encoding: 'utf8' }),
      [
        `docs/features/${goal.featureSlug}/agent-progress.md`,
        `docs/features/${goal.featureSlug}/evaluator-rubric.md`,
      ],
    ),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
