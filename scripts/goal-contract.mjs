import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('./goal-contract.schema.json', import.meta.url));
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

function invalid(path, message) {
  return `${path}: ${message}`;
}

function validateInteger(value, path, minimum) {
  if (!Number.isInteger(value) || value < minimum) {
    return invalid(path, `must be an integer greater than or equal to ${minimum}`);
  }
  return null;
}

export function validateGoalContract(contract) {
  const errors = [];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return { valid: false, errors: [invalid('$', 'must be an object')] };
  }

  const allowed = new Set(schema.required);
  for (const key of Object.keys(contract)) {
    if (!allowed.has(key)) errors.push(invalid(`$.${key}`, 'is not allowed'));
  }

  if (contract.schemaVersion !== 1) errors.push(invalid('$.schemaVersion', 'must be 1'));
  const issueError = validateInteger(contract.issue, '$.issue', 1);
  if (issueError) errors.push(issueError);

  for (const key of ['featureSlug', 'featureId', 'goal', 'verificationCommand']) {
    if (typeof contract[key] !== 'string' || contract[key].length === 0) {
      errors.push(invalid(`$.${key}`, 'must be a non-empty string'));
    }
  }
  if (typeof contract.featureSlug === 'string'
      && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(contract.featureSlug)) {
    errors.push(invalid('$.featureSlug', 'must be lowercase hyphenated text'));
  }
  if (typeof contract.featureId === 'string' && !/^F[0-9]{3}$/.test(contract.featureId)) {
    errors.push(invalid('$.featureId', 'must match F###'));
  }

  if (!Array.isArray(contract.constraints) || contract.constraints.length === 0) {
    errors.push(invalid('$.constraints', 'must contain at least one constraint'));
  } else {
    contract.constraints.forEach((constraint, index) => {
      if (typeof constraint !== 'string' || constraint.length === 0) {
        errors.push(invalid(`$.constraints[${index}]`, 'must be a non-empty string'));
      }
    });
  }

  if (!contract.limits || typeof contract.limits !== 'object' || Array.isArray(contract.limits)) {
    errors.push(invalid('$.limits', 'must be an object'));
  } else {
    const limitKeys = new Set(['maxRounds', 'maxElapsedTimeMs', 'noProgressLimit']);
    for (const key of Object.keys(contract.limits)) {
      if (!limitKeys.has(key)) errors.push(invalid(`$.limits.${key}`, 'is not allowed'));
    }
    for (const [key, minimum] of Object.entries({
      maxRounds: 1,
      maxElapsedTimeMs: 1,
      noProgressLimit: 1,
    })) {
      const error = validateInteger(contract.limits[key], `$.limits.${key}`, minimum);
      if (error) errors.push(error);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidGoalContract(contract) {
  const result = validateGoalContract(contract);
  if (!result.valid) {
    throw new Error(`Invalid goal contract:\n${result.errors.join('\n')}`);
  }
  return contract;
}
