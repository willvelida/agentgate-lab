import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const shellExclusion = '--excluded-tools=shell';
const urlDenial = '--deny-tool=url';

function stableJson(value) {
  return JSON.stringify(value);
}

function fileDigest(path) {
  if (!existsSync(path)) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function verificationPaths(repositoryRoot, verificationCommand) {
  const paths = [];
  for (const token of verificationCommand.match(/"[^"]+"|'[^']+'|\S+/g) ?? []) {
    const unquoted = token.replace(/^(['"])(.*)\1$/, '$2');
    if (unquoted.startsWith('-') || isAbsolute(unquoted)) continue;
    const path = resolve(repositoryRoot, unquoted);
    const repositoryRelative = relative(repositoryRoot, path);
    if (repositoryRelative.startsWith('..') || isAbsolute(repositoryRelative)) continue;
    if (existsSync(path)) paths.push(path);
  }
  return paths;
}

function featureById(features, featureId) {
  return features.find((feature) => feature.id === featureId);
}

function assertSafeStartingChecklist(checklist, goal) {
  const target = featureById(checklist.features, goal.featureId);
  if (!target) {
    throw new Error(`Feature ${goal.featureId} is missing from its checklist.`);
  }
  if (target.status !== 'active') {
    throw new Error(`Feature ${goal.featureId} must be active before the loop starts.`);
  }
  if (target.verification !== goal.verificationCommand) {
    throw new Error('Goal verification does not match the active feature checklist.');
  }
  const otherActive = checklist.features.find(
    (feature) => feature.id !== goal.featureId && feature.status === 'active',
  );
  if (otherActive) {
    throw new Error(`Feature ${otherActive.id} is already active.`);
  }
}

function isGitMetadataPath(repositoryRoot, path) {
  const gitDirectory = resolve(repositoryRoot, '.git');
  const candidate = resolve(path);
  const repositoryRelative = relative(gitDirectory, candidate);
  return repositoryRelative === ''
    || (!repositoryRelative.startsWith('..') && !isAbsolute(repositoryRelative));
}

function gitMetadataWriteDenial(repositoryRoot) {
  return `--deny-tool=write(${resolve(repositoryRoot, '.git')})`;
}

function mcpServerDisableArgument(serverName) {
  if (!/^[A-Za-z0-9._-]+$/.test(serverName)) {
    throw new Error(`Unsupported MCP server name: ${serverName}`);
  }
  return `--disable-mcp-server=${serverName}`;
}

function hasOnlyApprovedCopilotArguments(args, repositoryRoot) {
  const approvedFlags = new Set([
    '--silent',
    '--allow-all-tools',
    '--disable-builtin-mcps',
    shellExclusion,
    urlDenial,
    gitMetadataWriteDenial(repositoryRoot),
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (approvedFlags.has(argument)) continue;
    if (argument.startsWith('--disable-mcp-server=')
        && argument.length > '--disable-mcp-server='.length) {
      continue;
    }
    if (argument === '-C') {
      index += 1;
      if (resolve(args[index]) !== repositoryRoot) return false;
      continue;
    }
    if (argument === '--stream') {
      index += 1;
      if (args[index] !== 'off') return false;
      continue;
    }
    if (argument === '--output-format') {
      index += 1;
      if (args[index] !== 'text') return false;
      continue;
    }
    if (argument === '--agent') {
      index += 1;
      if (args[index] !== 'Harness Implementer') return false;
      continue;
    }
    if (argument === '--prompt') {
      index += 1;
      if (typeof args[index] !== 'string' || args[index].length === 0) return false;
      continue;
    }
    return false;
  }
  return true;
}

export function parseConfiguredMcpServers(output) {
  const serverNames = [];
  for (const line of output.split(/\r?\n/)) {
    if (line.trim().length === 0 || /^[^:\r\n]+:\s*$/.test(line)) continue;
    const match = line.match(/^\s{2}(.+?)\s+\((?:local|remote|http)\)\s*$/);
    if (!match) {
      throw new Error(`Unrecognized Copilot MCP inventory entry: ${line}`);
    }
    serverNames.push(match[1]);
  }
  return [...new Set(serverNames)].sort();
}

export function listConfiguredMcpServers(
  executable = 'copilot',
  repositoryRoot = process.cwd(),
  commandRunner = (command, args, options) => execFileSync(command, args, options),
) {
  const output = commandRunner(executable, ['mcp', 'list'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 30000,
  });
  return parseConfiguredMcpServers(output);
}

export function copilotCapabilityArguments(repositoryRoot, mcpServerNames = []) {
  return [
    '--allow-all-tools',
    shellExclusion,
    urlDenial,
    gitMetadataWriteDenial(repositoryRoot),
    '--disable-builtin-mcps',
    ...mcpServerNames.map(mcpServerDisableArgument),
  ];
}

export class CopilotCapabilityBoundary {
  constructor({
    executable = 'copilot',
    repositoryRoot = process.cwd(),
    mcpServerProvider,
  } = {}) {
    this.executable = executable;
    this.repositoryRoot = resolve(repositoryRoot);
    this.mcpServerProvider = mcpServerProvider
      ?? (() => listConfiguredMcpServers(this.executable, this.repositoryRoot));
  }

  async copilotArguments() {
    const serverNames = await this.mcpServerProvider();
    return copilotCapabilityArguments(this.repositoryRoot, serverNames);
  }

  assertToolInvocationAllowed(invocation) {
    if (invocation.kind === 'shell') {
      throw new Error('Shell capability is unavailable without explicit human approval.');
    }
    if (invocation.kind === 'url') {
      throw new Error('URL capability is unavailable without explicit human approval.');
    }
    if (invocation.kind === 'mcp') {
      throw new Error(`MCP server ${invocation.server} is disabled without explicit human approval.`);
    }
    if (invocation.kind === 'write'
        && isGitMetadataPath(this.repositoryRoot, invocation.path)) {
      throw new Error('Writes to Git metadata require explicit human approval.');
    }
  }
}

export class DenyByDefaultCommandPolicy {
  constructor({ executable, repositoryRoot }) {
    this.executable = executable;
    this.repositoryRoot = resolve(repositoryRoot);
  }

  assertAllowed(executable, args, options) {
    const requiredArguments = copilotCapabilityArguments(this.repositoryRoot);
    const allowed = executable === this.executable
      && resolve(options.cwd) === this.repositoryRoot
      && args.includes('--prompt')
      && args.includes('--silent')
      && hasOnlyApprovedCopilotArguments(args, this.repositoryRoot)
      && requiredArguments.every((argument) => args.includes(argument));
    if (!allowed) {
      throw new Error(`Command policy denied ${executable}. Explicit human approval is required.`);
    }
  }
}

export class RepositorySafetyBoundary {
  constructor({
    repositoryRoot = process.cwd(),
    protectedPaths = [],
    commandRunner = (args) => execFileSync('git', args, {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }),
  } = {}) {
    this.repositoryRoot = resolve(repositoryRoot);
    this.protectedPaths = protectedPaths.map((path) => resolve(path));
    this.commandRunner = commandRunner;
  }

  capture(goal, { requireActive = true } = {}) {
    const checklistPath = resolve(
      this.repositoryRoot,
      'docs',
      'features',
      goal.featureSlug,
      'features_list.json',
    );
    const checklist = JSON.parse(readFileSync(checklistPath, 'utf8'));
    if (requireActive) {
      assertSafeStartingChecklist(checklist, goal);
    }
    const protectedPaths = new Set([
      ...this.protectedPaths,
      ...verificationPaths(this.repositoryRoot, goal.verificationCommand),
    ]);
    return {
      branch: this.commandRunner(['branch', '--show-current']).trim(),
      commit: this.commandRunner(['rev-parse', 'HEAD']).trim(),
      checklist,
      protectedFiles: Object.fromEntries(
        [...protectedPaths].sort().map((path) => [path, fileDigest(path)]),
      ),
    };
  }

  violations(before, after, goal, actor) {
    const violations = [];
    if (before.commit !== after.commit) {
      violations.push('Repository HEAD changed; commit and merge actions require approval.');
    }
    if (before.branch !== after.branch) {
      violations.push('The active branch changed; branch-changing actions require approval.');
    }

    if (stableJson(before.checklist.issue) !== stableJson(after.checklist.issue)) {
      violations.push('Issue acceptance metadata changed.');
    }
    for (const beforeFeature of before.checklist.features) {
      const afterFeature = featureById(after.checklist.features, beforeFeature.id);
      if (!afterFeature) {
        violations.push(`Feature ${beforeFeature.id} was removed from the checklist.`);
        continue;
      }
      for (const field of ['description', 'verification', 'dependsOn']) {
        if (stableJson(beforeFeature[field]) !== stableJson(afterFeature[field])) {
          violations.push(`Feature ${beforeFeature.id} ${field} changed.`);
        }
      }
      if (beforeFeature.id !== goal.featureId
          && stableJson(beforeFeature) !== stableJson(afterFeature)) {
        violations.push(`Feature ${beforeFeature.id} changed while ${goal.featureId} was active.`);
      }
    }
    const addedFeature = after.checklist.features.find(
      (feature) => !featureById(before.checklist.features, feature.id),
    );
    if (addedFeature) {
      violations.push(`Feature ${addedFeature.id} was added while ${goal.featureId} was active.`);
    }
    const otherActive = after.checklist.features.find(
      (feature) => feature.id !== goal.featureId && feature.status === 'active',
    );
    if (otherActive) {
      violations.push(`Feature ${otherActive.id} was started without approval.`);
    }
    const beforeTarget = featureById(before.checklist.features, goal.featureId);
    const afterTarget = featureById(after.checklist.features, goal.featureId);
    if (beforeTarget && afterTarget && beforeTarget.status !== afterTarget.status) {
      const checkerPassed = actor === 'checker'
        && beforeTarget.status === 'active'
        && afterTarget.status === 'pass';
      if (!checkerPassed) {
        violations.push(`Feature ${goal.featureId} status changed outside checker PASS.`);
      }
    }

    for (const [path, digest] of Object.entries(before.protectedFiles)) {
      if (after.protectedFiles[path] !== digest) {
        violations.push(`Protected file ${relative(this.repositoryRoot, path)} changed.`);
      }
    }
    return [...new Set(violations)];
  }

  assertTransition(before, after, goal, actor) {
    const violations = this.violations(before, after, goal, actor);
    if (violations.length > 0) {
      throw new Error(
        `Safety boundary requires explicit human approval:\n${violations.join('\n')}`,
      );
    }
  }
}
