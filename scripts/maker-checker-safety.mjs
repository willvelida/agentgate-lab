import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
} from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const shellExclusion = '--excluded-tools=shell';
const urlDenial = '--deny-tool=url';

function stableJson(value) {
  return JSON.stringify(value);
}

function fileDigest(path) {
  if (!existsSync(path)) return null;
  const hash = createHash('sha256');
  const updatePath = (currentPath) => {
    const stat = lstatSync(currentPath);
    if (stat.isSymbolicLink()) {
      hash.update('symlink\0').update(readlinkSync(currentPath));
      return;
    }
    if (stat.isDirectory()) {
      hash.update('directory\0');
      for (const entry of readdirSync(currentPath, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name))) {
        hash.update(entry.name).update('\0');
        updatePath(resolve(currentPath, entry.name));
      }
      return;
    }
    hash.update('file\0').update(readFileSync(currentPath));
  };
  updatePath(path);
  return hash.digest('hex');
}

function controllerProtectedPaths(repositoryRoot) {
  return [
    'AGENTS.md',
    '.github/agents',
    '.github/skills',
    '.github/instructions',
    '.github/prompts',
    '.github/copilot-instructions.md',
    'scripts/run-verification.mjs',
    'scripts/verification-sandbox.mjs',
  ].map((path) => resolve(repositoryRoot, path));
}

function shellUsesCommandMode(shell, argument) {
  const normalized = argument.toLowerCase();
  const option = normalized.split(/[:=]/, 1)[0];
  if ([
    '-c',
    '/c',
    '/k',
    '/command',
    '-encodedcommand',
    '/encodedcommand',
  ].includes(option)) {
    return true;
  }
  if (shell === 'bash' || shell === 'sh' || shell === 'dash' || shell === 'zsh') {
    return option === '--command' || /^-[a-z]*c[a-z]*$/.test(option);
  }
  if (shell === 'powershell' || shell === 'pwsh') {
    const name = option.replace(/^--?/, '');
    return name.length > 0
      && ('command'.startsWith(name) || 'encodedcommand'.startsWith(name));
  }
  return false;
}

function verificationPaths(repositoryRoot, verificationCommand) {
  const tokens = (verificationCommand.match(/"[^"]+"|'[^']+'|\S+/g) ?? [])
    .map((token) => token.replace(/^(['"])(.*)\1$/, '$2'));
  const shells = new Set(['bash', 'sh', 'dash', 'zsh', 'cmd', 'powershell', 'pwsh']);
  for (let index = 0; index < tokens.length; index += 1) {
    const executable = tokens[index].split(/[\\/]/).at(-1)
      .replace(/\.exe$/i, '')
      .toLowerCase();
    if (shells.has(executable)
        && tokens.slice(index + 1).some((argument) => shellUsesCommandMode(
          executable,
          argument,
        ))) {
      throw new Error(
        'Shell command verification forms are not supported because their inputs cannot be protected.',
      );
    }
  }

  const paths = [];
  for (const unquoted of tokens) {
    if (unquoted.startsWith('-')) continue;
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

function duplicateFeatureId(features) {
  const seen = new Set();
  return features.find((feature) => {
    if (seen.has(feature.id)) return true;
    seen.add(feature.id);
    return false;
  })?.id ?? null;
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

function gitMetadataWriteDenials(repositoryRoot) {
  const gitDirectory = resolve(repositoryRoot, '.git').replaceAll('\\', '/');
  return [
    `--deny-tool=write(${gitDirectory})`,
    `--deny-tool=write(${gitDirectory}/**)`,
  ];
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
    ...gitMetadataWriteDenials(repositoryRoot),
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
    ...gitMetadataWriteDenials(repositoryRoot),
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
      ...controllerProtectedPaths(this.repositoryRoot),
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

  violations(before, after, goal, actor, {
    checkerOutcome = null,
    reviewedRevisionValid = false,
  } = {}) {
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
    const beforeDuplicate = duplicateFeatureId(before.checklist.features);
    const afterDuplicate = duplicateFeatureId(after.checklist.features);
    if (beforeDuplicate || afterDuplicate) {
      violations.push(
        `Duplicate feature ID ${afterDuplicate ?? beforeDuplicate} is not allowed in the checklist.`,
      );
      return violations;
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
        && afterTarget.status === 'pass'
        && checkerOutcome === 'pass'
        && reviewedRevisionValid;
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

  assertTransition(before, after, goal, actor, context) {
    const violations = this.violations(before, after, goal, actor, context);
    if (violations.length > 0) {
      throw new Error(
        `Safety boundary requires explicit human approval:\n${violations.join('\n')}`,
      );
    }
  }
}
