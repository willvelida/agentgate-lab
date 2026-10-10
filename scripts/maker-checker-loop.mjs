import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  if (left.fingerprint && right.fingerprint) {
    return left.commit === right.commit
      && left.fingerprint === right.fingerprint;
  }
  return left.commit === right.commit && left.dirty === right.dirty;
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

function runProcess(executable, args, options) {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
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
      reject(new Error(`Unable to start ${executable}: ${error.message}`, { cause: error }));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Copilot session exceeded its ${options.timeoutMs} ms dispatch limit.`));
      } else if (code !== 0) {
        reject(new Error(
          `Copilot session failed with exit code ${code}`
            + `${signal ? ` and signal ${signal}` : ''}: ${stderr.trim()}`,
        ));
      } else {
        resolveProcess({ stdout, stderr });
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
    const prompt = actor === 'maker'
      ? [
          `Work on issue #${goal.issue}, existing slug ${goal.featureSlug},`,
          `${goal.featureId} only. The feature design is already approved.`,
          'Follow the Harness Implementer workflow and do not commit or publish.',
          feedback ? `Checker feedback to address: ${feedback}` : '',
          `End your response with exactly one line starting ${resultMarker}`,
          'followed by JSON with outcome completed, blocked, ambiguous, or no-progress',
          'and a non-empty feedback string.',
        ].filter(Boolean).join(' ')
      : [
          `/feature-evaluator Evaluate ${goal.featureId} in slug ${goal.featureSlug}.`,
          'Run this as a fresh independent evaluation session.',
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

function latestMakerRevision(state) {
  return [...state.rounds].reverse().find((round) => round.actor === 'maker')
    ?.reviewedRevision;
}

function latestCheckerFeedback(state) {
  const checker = [...state.rounds].reverse().find((round) => round.actor === 'checker');
  return checker?.outcome === 'fail' ? checker.feedback : null;
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
    humanIntervention: humanStop(reason),
  };
}

export async function runMakerCheckerLoop({
  goal,
  statePath,
  dispatcher = new CopilotCliDispatcher(),
  getRevision,
  safetyBoundary = new RepositorySafetyBoundary(),
  now = () => new Date(),
}) {
  if (typeof getRevision !== 'function') {
    throw new Error('runMakerCheckerLoop requires a getRevision function.');
  }

  let state = existsSync(statePath)
    ? loadLoopState(statePath)
    : createLoopState(goal, now());
  saveLoopState(statePath, state);

  while (true) {
    const decision = getResumeDecision(state);
    if (decision.action === 'stop') {
      return { status: decision.reason, state };
    }

    const actor = decision.actor;
    const before = getRevision();
    const startedAt = now();
    const timeLeft = remainingTime(state, startedAt);
    if (state.rounds.length >= goal.limits.maxRounds || timeLeft <= 0) {
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
    }

    let safetyBefore;
    try {
      safetyBefore = safetyBoundary.capture(goal);
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
        goal,
        feedback: latestCheckerFeedback(state),
        timeoutMs: timeLeft,
      });
    } catch (error) {
      const finishedAt = now();
      state = persistRound(
        statePath,
        state,
        terminalRound(
          actor,
          getRevision(),
          finishedAt,
          'blocked',
          error.message,
          'Resolve the Copilot dispatch failure before resuming.',
        ),
        finishedAt,
      );
      return { status: 'blocked', state };
    }

    const finishedAt = now();
    const after = getRevision();
    try {
      safetyBoundary.assertTransition(
        safetyBefore,
        safetyBoundary.capture(goal, { requireActive: false }),
        goal,
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
          && countNoProgressMakerRounds(state) + 1 >= goal.limits.noProgressLimit) {
        outcome = 'stalled';
        nextAction = 'stop';
        feedback = `${feedback} The configured no-progress limit was reached.`;
        intervention = humanStop('Revise the goal or provide guidance before resuming.');
      }
    } else if (outcome === 'pass') {
      nextAction = 'stop';
    }

    const wouldContinue = nextAction !== 'stop';
    const elapsedExhausted = remainingTime(state, finishedAt) <= 0;
    const roundsExhausted = state.rounds.length + 1 >= goal.limits.maxRounds;
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
    safetyBoundary: new RepositorySafetyBoundary({
      repositoryRoot: process.cwd(),
      protectedPaths: [resolve(args.goal)],
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
