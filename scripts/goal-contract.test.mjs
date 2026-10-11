import assert from 'node:assert/strict';
import test from 'node:test';
import { assertValidGoalContract, validateGoalContract } from './goal-contract.mjs';

const validContract = {
  schemaVersion: 1,
  issue: 30,
  featureSlug: 'willvelida-agentgate-lab-30-maker-checker-loop',
  featureId: 'F001',
  goal: 'Define a bounded maker-checker goal.',
  verificationCommand: 'node --test scripts/goal-contract.test.mjs',
  constraints: [
    'Do not commit, push, or publish changes.',
    'Do not weaken the verification command.',
  ],
  limits: {
    maxRounds: 3,
    maxElapsedTimeMs: 600000,
    noProgressLimit: 2,
  },
};

test('accepts a complete versioned goal contract', () => {
  assert.deepEqual(validateGoalContract(validContract), { valid: true, errors: [] });
  assert.doesNotThrow(() => assertValidGoalContract(validContract));
});

test('rejects missing declarations and invalid limits', () => {
  const result = validateGoalContract({
    ...validContract,
    verificationCommand: '',
    constraints: [],
    limits: { maxRounds: 0, maxElapsedTimeMs: 0, noProgressLimit: 0 },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('$.verificationCommand')));
  assert.ok(result.errors.some((error) => error.includes('$.constraints')));
  assert.ok(result.errors.some((error) => error.includes('$.limits.maxRounds')));
});

test('rejects unknown fields and unsupported schema versions', () => {
  const result = validateGoalContract({
    ...validContract,
    schemaVersion: 2,
    unexpected: true,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('$.unexpected: is not allowed'));
  assert.ok(result.errors.includes('$.schemaVersion: must be 1'));
});

test('rejects elapsed-time limits beyond the Node.js timer maximum', () => {
  const maximum = 2_147_483_647;
  const atMaximum = validateGoalContract({
    ...validContract,
    limits: { ...validContract.limits, maxElapsedTimeMs: maximum },
  });
  const aboveMaximum = validateGoalContract({
    ...validContract,
    limits: { ...validContract.limits, maxElapsedTimeMs: maximum + 1 },
  });

  assert.equal(atMaximum.valid, true);
  assert.equal(aboveMaximum.valid, false);
  assert.ok(aboveMaximum.errors.some((error) => (
    error.includes('$.limits.maxElapsedTimeMs')
  )));
});
