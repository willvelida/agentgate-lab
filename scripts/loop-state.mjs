import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { assertValidGoalContract } from './goal-contract.mjs';

const actors = new Set(['maker', 'checker']);
const outcomes = new Set([
  'completed',
  'pass',
  'fail',
  'blocked',
  'ambiguous',
  'no-progress',
  'interrupted',
  'stale',
  'stalled',
  'limit-exhausted',
]);
const nextActions = new Set(['maker', 'checker', 'stop']);
const verificationStatuses = new Set([
  'passed',
  'failed',
  'interrupted',
  'error',
  'skipped',
]);

function assertNonemptyString(value, path) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }
}

function assertTimestamp(value, path) {
  assertNonemptyString(value, path);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${path} must be an ISO timestamp.`);
  }
}

function assertHumanIntervention(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  if (typeof value.required !== 'boolean') {
    throw new Error(`${path}.required must be a boolean.`);
  }
  if (value.reason !== null) {
    assertNonemptyString(value.reason, `${path}.reason`);
  }
  if (value.required && value.reason === null) {
    throw new Error(`${path}.reason is required when human intervention is required.`);
  }
}

function assertVerification(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  assertNonemptyString(value.command, `${path}.command`);
  if (!verificationStatuses.has(value.status)) {
    throw new Error(`${path}.status is not supported.`);
  }
  if (value.runId !== null) {
    assertNonemptyString(value.runId, `${path}.runId`);
  }
  if (value.reportPath !== null) {
    assertNonemptyString(value.reportPath, `${path}.reportPath`);
  }
  if (value.exitCode !== null && !Number.isInteger(value.exitCode)) {
    throw new Error(`${path}.exitCode must be an integer or null.`);
  }
  if (value.status === 'passed' && value.runId === null) {
    throw new Error(`${path}.runId is required when verification passed.`);
  }
}

function assertRound(round, index) {
  const path = `$.rounds[${index}]`;
  if (!round || typeof round !== 'object' || Array.isArray(round)) {
    throw new Error(`${path} must be an object.`);
  }
  if (round.number !== index + 1) {
    throw new Error(`${path}.number must be ${index + 1}.`);
  }
  if (!actors.has(round.actor)) {
    throw new Error(`${path}.actor must be maker or checker.`);
  }
  assertTimestamp(round.startedAt, `${path}.startedAt`);
  assertTimestamp(round.finishedAt, `${path}.finishedAt`);
  if (Date.parse(round.finishedAt) < Date.parse(round.startedAt)) {
    throw new Error(`${path}.finishedAt must not precede startedAt.`);
  }
  if (!round.reviewedRevision || typeof round.reviewedRevision !== 'object') {
    throw new Error(`${path}.reviewedRevision must be an object.`);
  }
  assertNonemptyString(round.reviewedRevision.commit, `${path}.reviewedRevision.commit`);
  if (typeof round.reviewedRevision.dirty !== 'boolean') {
    throw new Error(`${path}.reviewedRevision.dirty must be a boolean.`);
  }
  if (round.reviewedRevision.fingerprint !== undefined) {
    assertNonemptyString(
      round.reviewedRevision.fingerprint,
      `${path}.reviewedRevision.fingerprint`,
    );
  }
  if (!outcomes.has(round.outcome)) {
    throw new Error(`${path}.outcome is not supported.`);
  }
  if (round.feedback !== null) {
    assertNonemptyString(round.feedback, `${path}.feedback`);
  }
  if (!nextActions.has(round.nextAction)) {
    throw new Error(`${path}.nextAction is not supported.`);
  }
  if (round.verification !== undefined && round.verification !== null) {
    assertVerification(round.verification, `${path}.verification`);
  }
  assertHumanIntervention(round.humanIntervention, `${path}.humanIntervention`);
}

export function assertValidLoopState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('Loop state must be an object.');
  }
  if (state.schemaVersion !== 1) {
    throw new Error('$.schemaVersion must be 1.');
  }
  assertValidGoalContract(state.goal);
  assertTimestamp(state.startedAt, '$.startedAt');
  assertTimestamp(state.updatedAt, '$.updatedAt');
  if (!Array.isArray(state.rounds)) {
    throw new Error('$.rounds must be an array.');
  }
  state.rounds.forEach(assertRound);
  return state;
}

export function createLoopState(goal, now = new Date()) {
  assertValidGoalContract(goal);
  const timestamp = now.toISOString();
  return {
    schemaVersion: 1,
    goal,
    startedAt: timestamp,
    updatedAt: timestamp,
    rounds: [],
  };
}

export function recordRound(state, round, now = new Date()) {
  assertValidLoopState(state);
  const nextState = {
    ...state,
    updatedAt: now.toISOString(),
    rounds: [
      ...state.rounds,
      {
        number: state.rounds.length + 1,
        ...round,
      },
    ],
  };
  return assertValidLoopState(nextState);
}

export function saveLoopState(path, state) {
  assertValidLoopState(state);
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  renameSync(temporaryPath, path);
}

export function loadLoopState(path) {
  let state;
  try {
    state = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read loop state at ${path}: ${error.message}`, {
      cause: error,
    });
  }
  return assertValidLoopState(state);
}

export function getResumeDecision(state) {
  assertValidLoopState(state);
  const latest = state.rounds.at(-1);
  if (!latest) {
    return { action: 'continue', actor: 'maker' };
  }
  if (latest.humanIntervention.required) {
    return { action: 'stop', reason: 'human-intervention' };
  }
  if (latest.outcome === 'blocked') {
    return { action: 'stop', reason: 'blocked' };
  }
  if (latest.actor === 'checker' && latest.outcome === 'pass') {
    return { action: 'stop', reason: 'passed' };
  }
  if (latest.nextAction === 'stop') {
    return { action: 'stop', reason: latest.outcome };
  }
  return { action: 'continue', actor: latest.nextAction };
}
