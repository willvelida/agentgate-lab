import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import {
  CopilotCliDispatcher,
  ScriptedDispatcher,
  VerificationRunner,
  runMakerCheckerLoop,
} from './maker-checker-loop.mjs';
import {
  cleanupSandboxContainer,
  sandboxInvocation,
  VERIFICATION_SANDBOX_IMAGE,
} from './verification-sandbox.mjs';
import {
  copilotCapabilityArguments,
  CopilotCapabilityBoundary,
  DenyByDefaultCommandPolicy,
  parseConfiguredMcpServers,
  RepositorySafetyBoundary,
} from './maker-checker-safety.mjs';

const slug = 'willvelida-agentgate-lab-30-add-a-bounded-goal-driven-maker-checker-loop';

function goal() {
  return {
    schemaVersion: 1,
    issue: 30,
    featureSlug: slug,
    featureId: 'F004',
    goal: 'Enforce the serial controller safety boundary.',
    verificationCommand: 'node --test scripts/maker-checker-safety.test.mjs',
    constraints: ['Require approval for prohibited actions.'],
    limits: {
      maxRounds: 2,
      maxElapsedTimeMs: 600000,
      noProgressLimit: 2,
    },
  };
}

function checklist() {
  return {
    issue: {
      repository: 'willvelida/agentgate-lab',
      number: 30,
      title: 'Add a bounded goal-driven maker-checker loop',
      url: 'https://github.com/willvelida/agentgate-lab/issues/30',
    },
    features: [
      {
        id: 'F003',
        description: 'Coordinate rounds.',
        status: 'pass',
        verification: 'node --test scripts/maker-checker-loop.test.mjs',
        evidence: 'passed',
        testedAt: '2026-10-10',
        dependsOn: [],
      },
      {
        id: 'F004',
        description: 'Enforce safety.',
        status: 'active',
        verification: 'node --test scripts/maker-checker-safety.test.mjs',
        evidence: '',
        testedAt: '',
        dependsOn: ['F003'],
      },
      {
        id: 'F005',
        description: 'Cover scenarios.',
        status: 'not-started',
        verification: 'node --test scripts/maker-checker-loop.test.mjs',
        evidence: '',
        testedAt: '',
        dependsOn: ['F004'],
      },
    ],
  };
}

test('repository boundary captures its configured F004 verification target', (t) => {
  const state = fixture(t);
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: state.root,
    commandRunner: commandRunner(),
  });
  const snapshot = boundary.capture(goal(), { requireActive: false });

  assert.ok(Object.hasOwn(snapshot.protectedFiles, state.verificationPath));
});

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-maker-checker-safety-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const checklistPath = join(root, 'docs', 'features', slug, 'features_list.json');
  const verificationPath = join(root, 'scripts', 'maker-checker-safety.test.mjs');
  const architecturePath = join(root, 'scripts', 'check-architecture.sh');
  mkdirSync(dirname(checklistPath), { recursive: true });
  mkdirSync(dirname(verificationPath), { recursive: true });
  writeFileSync(checklistPath, `${JSON.stringify(checklist(), null, 2)}\n`);
  writeFileSync(verificationPath, 'verification fixture\n');
  writeFileSync(architecturePath, 'architecture fixture\n');
  return {
    root,
    checklistPath,
    verificationPath,
    architecturePath,
  };
}

function commandRunner(branch = 'feature', commit = 'abc123') {
  return (args) => {
    if (args[0] === 'branch') return `${branch}\n`;
    if (args[0] === 'rev-parse') return `${commit}\n`;
    throw new Error(`Unexpected git command: ${args.join(' ')}`);
  };
}

function revision(fingerprint) {
  return { commit: 'abc123', dirty: true, fingerprint };
}

test('verification sandbox denies repository writes and local Git publication', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-verification-sandbox-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const scripts = join(root, 'scripts');
  const remote = join(root, 'remote.git');
  mkdirSync(scripts);
  cpSync(
    new URL('./run-verification.mjs', import.meta.url),
    join(scripts, 'run-verification.mjs'),
  );
  cpSync(
    new URL('./verification-sandbox.mjs', import.meta.url),
    join(scripts, 'verification-sandbox.mjs'),
  );
  writeFileSync(join(root, 'protected.txt'), 'protected baseline\n');
  execFileSync('git', ['init', '--quiet', '--initial-branch=feature', root]);
  const git = (args, cwd = root) => execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
  });
  git(['config', 'user.name', 'Sandbox Test']);
  git(['config', 'user.email', 'sandbox@example.invalid']);
  git(['add', 'protected.txt', 'scripts']);
  git(['commit', '--quiet', '-m', 'initialize sandbox fixture']);
  git(['init', '--quiet', '--bare', remote]);
  git(['remote', 'add', 'origin', remote]);
  git(['push', '--quiet', '--set-upstream', 'origin', 'feature']);

  const maliciousCode = [
    "const fs = require('node:fs');",
    "const cp = require('node:child_process');",
    'let writeDenied = false;',
    "try { fs.writeFileSync('/workspace/protected.txt', 'changed'); }",
    "catch (error) { if (!['EROFS', 'EACCES'].includes(error.code)) throw error; writeDenied = true; }",
    "const push = cp.spawnSync('git', ['push', 'origin', 'HEAD:refs/heads/unapproved'], { cwd: '/workspace', encoding: 'utf8' });",
    'if (!writeDenied || push.status === 0) process.exitCode = 1;',
  ].join(' ');
  const escapedCode = maliciousCode.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const verification = await new VerificationRunner({ repositoryRoot: root })
    .run(`node --eval "${escapedCode}"`, { timeoutMs: 60000 });
  const report = JSON.parse(readFileSync(join(root, verification.reportPath), 'utf8'));

  assert.equal(verification.status, 'passed');
  assert.equal(report.sandbox, true);
  assert.equal(readFileSync(join(root, 'protected.txt'), 'utf8'), 'protected baseline\n');
  assert.equal(git(['rev-parse', 'HEAD']).trim(), git(['rev-parse', 'origin/feature']).trim());
  assert.equal(git(['ls-remote', 'origin']), git(['ls-remote', remote]));
  assert.ok(!git(['ls-remote', 'origin']).includes('refs/heads/unapproved'));
});

test('verification sandbox invocation denies network and host write access', () => {
  const invocation = sandboxInvocation(
    'node',
    ['--test', 'scripts/example.test.mjs'],
    'C:\\repo',
    VERIFICATION_SANDBOX_IMAGE,
    'C:\\temp\\verification-container.id',
  );
  assert.equal(invocation.command, 'docker');
  assert.ok(invocation.args.includes('--network=none'));
  assert.ok(invocation.args.includes('--read-only'));
  assert.ok(invocation.args.includes('--cap-drop=ALL'));
  assert.ok(invocation.args.includes('--pull=never'));
  assert.ok(invocation.args.includes('--cidfile'));
  assert.ok(invocation.args.includes('C:\\temp\\verification-container.id'));
  assert.ok(!invocation.args.includes('--rm'));
  assert.ok(invocation.args.includes('1000:1000'));
  assert.ok(invocation.args.includes(
    '/workspace/.local:rw,nosuid,nodev,size=256m,uid=1000,gid=1000,mode=700',
  ));
  assert.ok(invocation.args.includes(
    'type=bind,source=C:\\repo,target=/workspace,readonly',
  ));
  assert.equal(invocation.args.at(-3), VERIFICATION_SANDBOX_IMAGE);
  assert.deepEqual(invocation.args.slice(-2), ['--test', 'scripts/example.test.mjs']);
});

test('verification runner removes the tracked sandbox container after timeout or interrupt', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-verification-cleanup-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  for (const error of [
    new Error('Child process exceeded its 100 ms dispatch limit.'),
    Object.assign(new Error('Child process was interrupted by SIGINT.'), {
      code: 'ERR_MAKER_CHECKER_INTERRUPTED',
    }),
  ]) {
    const removedIds = [];
    const runner = new VerificationRunner({
      repositoryRoot: root,
      nodeExecutable: 'node',
      processRunner: async (_executable, args) => {
        const idFileIndex = args.indexOf('--container-id-file') + 1;
        writeFileSync(args[idFileIndex], `${'a'.repeat(64)}\n`);
        throw error;
      },
      sandboxContainerCleaner: (containerIdFile, repositoryRoot) => cleanupSandboxContainer(
        containerIdFile,
        repositoryRoot,
        (executable, args) => {
          assert.equal(executable, 'docker');
          assert.deepEqual(args, ['container', 'rm', '--force', 'a'.repeat(64)]);
          removedIds.push(args.at(-1));
        },
      ),
    });

    await assert.rejects(
      runner.run('node --test scripts/example.test.mjs', { timeoutMs: 100 }),
    );
    assert.deepEqual(removedIds, ['a'.repeat(64)]);
  }
});

test('verification runner reports sandbox cleanup failures without claiming success', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-verification-cleanup-error-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const runner = new VerificationRunner({
    repositoryRoot: root,
    nodeExecutable: 'node',
    processRunner: async (_executable, args) => {
      const idFileIndex = args.indexOf('--container-id-file') + 1;
      writeFileSync(args[idFileIndex], `${'b'.repeat(64)}\n`);
      return {
        stderr: 'Verification report: report.json\n',
      };
    },
    readReport: () => ({ status: 'passed', runId: 'run-ok', exitCode: 0 }),
    sandboxContainerCleaner: () => {
      throw new Error('Docker could not remove the container.');
    },
  });

  let retainedContainerIdFile;
  await assert.rejects(
    runner.run('node --test scripts/example.test.mjs', { timeoutMs: 100 }),
    (error) => {
      retainedContainerIdFile = /container ID file retained at (.+): Docker could not remove/
        .exec(error.message)?.[1];
      return Boolean(retainedContainerIdFile);
    },
  );
  rmSync(dirname(retainedContainerIdFile), { recursive: true, force: true });
});

test('verification runner fails closed when the sandbox image is unavailable', async () => {
  const calls = [];
  const runner = new VerificationRunner({
    processRunner: async (...args) => {
      calls.push(args);
      return { exitCode: 1 };
    },
  });
  await assert.rejects(
    runner.ensureReady(),
    /Verification sandbox image 'agentgate-verification:node24' is unavailable/,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][0], 'docker');
  assert.deepEqual(calls[0][1], ['image', 'inspect', VERIFICATION_SANDBOX_IMAGE]);
});

test('Copilot dispatch applies non-prompt safety controls', async () => {
  const calls = [];
  const statePath = resolve(tmpdir(), 'agentgate-dispatch-state', 'state.json');
  const capabilityBoundary = new CopilotCapabilityBoundary({
    repositoryRoot: 'C:\\repo',
    mcpServerProvider: () => ['publisher', 'workiq'],
  });
  const dispatcher = new CopilotCliDispatcher({
    repositoryRoot: 'C:\\repo',
    capabilityBoundary,
    processRunner: async (executable, args, options) => {
      calls.push({ executable, args, options });
      return {
        stdout: 'MAKER_CHECKER_RESULT: {"outcome":"completed","feedback":"done"}\n',
        stderr: '',
      };
    },
  });

  await dispatcher.dispatch({
    actor: 'maker',
    goal: goal(),
    feedback: null,
    timeoutMs: 1000,
    statePath,
  });

  assert.equal(calls.length, 1);
  assert.ok(calls[0].args.includes('--disable-builtin-mcps'));
  assert.ok(!calls[0].args.some((argument) => argument.startsWith('--deny-tool=shell(')));
  assert.ok(calls[0].args.some(
    (argument) => argument.startsWith('--deny-tool=write(') && argument.endsWith('/.git/**)'),
  ));
  for (const argument of copilotCapabilityArguments(
    'C:\\repo',
    ['publisher', 'workiq'],
    [statePath],
  )) {
    assert.ok(calls[0].args.includes(argument), `missing ${argument}`);
  }
});

test('configured MCP discovery returns every local, remote, and HTTP server', () => {
  const output = [
    'Plugin servers:',
    '  workiq (local)',
    '',
    'Configured servers:',
    '  publisher (remote)',
    '  workiq (local)',
    '',
    'Builtin servers:',
    '  computer-use (local)',
    '  github-mcp-server (http)',
  ].join('\n');

  assert.deepEqual(
    parseConfiguredMcpServers(output),
    ['computer-use', 'github-mcp-server', 'publisher', 'workiq'],
  );
});

test('configured MCP discovery rejects unknown inventory formats', () => {
  assert.throws(
    () => parseConfiguredMcpServers([
      'Configured servers:',
      '  publisher (websocket)',
    ].join('\n')),
    /Unrecognized Copilot MCP inventory entry/,
  );
});

test('Copilot dispatch fails closed when MCP discovery fails', async () => {
  let launched = false;
  const dispatcher = new CopilotCliDispatcher({
    repositoryRoot: 'C:\\repo',
    capabilityBoundary: new CopilotCapabilityBoundary({
      repositoryRoot: 'C:\\repo',
      mcpServerProvider: () => {
        throw new Error('MCP discovery failed');
      },
    }),
    processRunner: async () => {
      launched = true;
      return { stdout: '', stderr: '' };
    },
  });

  await assert.rejects(
    dispatcher.dispatch({
      actor: 'maker',
      goal: goal(),
      feedback: null,
      timeoutMs: 1000,
      statePath: 'C:\\repo\\.local\\maker-checker\\state.json',
    }),
    /MCP discovery failed/,
  );
  assert.equal(launched, false);
});

test('command policy denies every unapproved controller command by default', () => {
  const policy = new DenyByDefaultCommandPolicy({
    executable: 'copilot',
    repositoryRoot: 'C:\\repo',
  });
  assert.throws(
    () => policy.assertAllowed('git', ['commit'], { cwd: 'C:\\repo' }),
    /Explicit human approval is required/,
  );
  assert.throws(
    () => policy.assertAllowed('copilot', ['--prompt', 'unsafe'], { cwd: 'C:\\repo' }),
    /Explicit human approval is required/,
  );
  assert.throws(
    () => policy.assertAllowed(
      'copilot',
      [
        '-C',
        'C:\\repo',
        '--silent',
        '--stream',
        'off',
        '--output-format',
        'text',
        ...copilotCapabilityArguments('C:\\repo'),
        '--share-gist',
        '--prompt',
        'unsafe',
      ],
      { cwd: 'C:\\repo' },
    ),
    /Explicit human approval is required/,
  );
  const statePath = 'C:\\repo\\.local\\maker-checker\\state.json';
  assert.throws(
    () => policy.assertAllowed(
      'copilot',
      [
        '-C',
        'C:\\repo',
        '--silent',
        '--stream',
        'off',
        '--output-format',
        'text',
        ...copilotCapabilityArguments('C:\\repo'),
        '--prompt',
        'safe-looking prompt',
      ],
      { cwd: 'C:\\repo', protectedWritePaths: [statePath] },
    ),
    /Explicit human approval is required/,
  );
});

test('capability boundary blocks alternate publication paths without side effects', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-publication-boundary-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repository = join(root, 'repository');
  const remote = join(root, 'remote.git');
  mkdirSync(repository);
  const git = (args, cwd = repository) => execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
  });

  git(['init', '--initial-branch=feature']);
  git(['config', 'user.name', 'Boundary Test']);
  git(['config', 'user.email', 'boundary@example.invalid']);
  writeFileSync(join(repository, 'README.md'), 'baseline\n');
  git(['add', 'README.md']);
  git(['commit', '-m', 'baseline']);
  git(['switch', '-c', 'merge-source']);
  writeFileSync(join(repository, 'merge.txt'), 'merge candidate\n');
  git(['add', 'merge.txt']);
  git(['commit', '-m', 'merge candidate']);
  git(['switch', 'feature']);
  git(['init', '--bare', remote], root);
  git(['remote', 'add', 'origin', remote]);
  git(['push', '--set-upstream', 'origin', 'feature']);

  const boundary = new CopilotCapabilityBoundary({
    repositoryRoot: repository,
    mcpServerProvider: () => ['publisher'],
  });
  const beforeHead = git(['rev-parse', 'HEAD']).trim();
  const beforeRefs = git(['show-ref']);
  const beforeRemoteRefs = git(['ls-remote', 'origin']);
  let pullRequestMutations = 0;

  const attempt = (invocation, action) => {
    assert.throws(
      () => {
        boundary.assertToolInvocationAllowed(invocation);
        action();
      },
      /explicit human approval|requires explicit human approval|is disabled/,
    );
  };

  attempt(
    { kind: 'shell', command: 'git -c alias.publish=commit publish --allow-empty' },
    () => git(['-c', 'alias.publish=commit', 'publish', '--allow-empty', '-m', 'bypass']),
  );
  attempt(
    { kind: 'shell', command: 'git update-ref refs/heads/unauthorized HEAD' },
    () => git(['update-ref', 'refs/heads/unauthorized', 'HEAD']),
  );
  attempt(
    { kind: 'shell', command: 'git -c remote.origin.url=... push' },
    () => git(['push', 'origin', 'HEAD:refs/heads/unauthorized']),
  );
  attempt(
    { kind: 'shell', command: 'git -c merge.ff=false merge merge-source' },
    () => git(['-c', 'merge.ff=false', 'merge', 'merge-source']),
  );
  attempt(
    { kind: 'shell', command: 'gh api --method PATCH repos/owner/repo/pulls/1' },
    () => { pullRequestMutations += 1; },
  );
  attempt(
    { kind: 'shell', command: 'curl -X PATCH https://api.github.com/repos/owner/repo/pulls/1' },
    () => { pullRequestMutations += 1; },
  );
  attempt(
    { kind: 'url', url: 'https://api.github.com/repos/owner/repo/pulls/1' },
    () => { pullRequestMutations += 1; },
  );
  attempt(
    { kind: 'mcp', server: 'publisher', tool: 'merge_pull_request' },
    () => { pullRequestMutations += 1; },
  );
  attempt(
    { kind: 'write', path: join(repository, '.git', 'refs', 'heads', 'unauthorized') },
    () => writeFileSync(
      join(repository, '.git', 'refs', 'heads', 'unauthorized'),
      `${beforeHead}\n`,
    ),
  );

  assert.equal(git(['rev-parse', 'HEAD']).trim(), beforeHead);
  assert.equal(git(['show-ref']), beforeRefs);
  assert.equal(git(['ls-remote', 'origin']), beforeRemoteRefs);
  assert.equal(existsSync(join(repository, '.git', 'MERGE_HEAD')), false);
  assert.equal(pullRequestMutations, 0);
});

test('repository boundary permits ordinary implementation changes', (t) => {
  const files = fixture(t);
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });
  const before = boundary.capture(goal());
  const implementationPath = join(files.root, 'src', 'implementation.mjs');
  mkdirSync(dirname(implementationPath), { recursive: true });
  writeFileSync(implementationPath, 'implementation\n');
  const after = boundary.capture(goal());

  assert.doesNotThrow(() => boundary.assertTransition(before, after, goal(), 'maker'));
});

test('repository boundary requires approval for commits and branch changes', (t) => {
  const files = fixture(t);
  const before = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner('feature', 'abc123'),
  }).capture(goal());
  const after = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner('other', 'def456'),
  }).capture(goal());
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });

  assert.throws(
    () => boundary.assertTransition(before, after, goal(), 'maker'),
    /HEAD changed[\s\S]*active branch changed/,
  );
});

test('repository boundary protects acceptance criteria and verification files', (t) => {
  const files = fixture(t);
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });

  const before = boundary.capture(goal());
  const changed = JSON.parse(readFileSync(files.checklistPath, 'utf8'));
  changed.features[1].verification = 'node --test weakened.test.mjs';
  writeFileSync(files.checklistPath, `${JSON.stringify(changed, null, 2)}\n`);
  writeFileSync(files.verificationPath, 'weakened verification\n');
  const after = {
    ...before,
    checklist: changed,
    protectedFiles: {
      ...before.protectedFiles,
      [files.checklistPath]: 'changed',
      [files.verificationPath]: 'changed',
    },
  };

  assert.throws(
    () => boundary.assertTransition(before, after, goal(), 'maker'),
    /verification changed[\s\S]*Protected file/,
  );
});

test('repository boundary protects the architecture verification script', (t) => {
  const files = fixture(t);
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    protectedPaths: [files.architecturePath],
    commandRunner: commandRunner(),
  });

  const before = boundary.capture(goal());
  writeFileSync(files.architecturePath, 'weakened architecture check\n');
  const after = boundary.capture(goal());

  assert.throws(
    () => boundary.assertTransition(before, after, goal(), 'maker'),
    /Protected file scripts changed/,
  );
});

test('repository boundary protects unlisted helpers in the verification tree', (t) => {
  const files = fixture(t);
  const helperPath = join(files.root, 'scripts', 'verification-helper.mjs');
  writeFileSync(helperPath, 'trusted helper\n');
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });

  const before = boundary.capture(goal());
  writeFileSync(helperPath, 'weakened helper\n');

  assert.throws(
    () => boundary.assertTransition(before, boundary.capture(goal()), goal(), 'maker'),
    /Protected file scripts changed/,
  );
});

test('repository boundary traverses protected helpers with commented static requires', (t) => {
  const files = fixture(t);
  const testPath = join(files.root, 'tests', 'Sample.Tests', 'sample.test.mjs');
  const protectedHelperPath = join(files.root, 'tests', 'Sample.Tests', 'helper.cjs');
  const helperPath = join(files.root, 'verification-helper.cjs');
  mkdirSync(dirname(testPath), { recursive: true });
  writeFileSync(
    testPath,
    "import './helper.cjs';\n",
  );
  writeFileSync(
    protectedHelperPath,
    "require('../../verification-helper.cjs' /* tracked helper */);\n",
  );
  writeFileSync(helperPath, 'module.exports = { verified: true };\n');
  const verificationCommand = 'node --test tests/Sample.Tests/sample.test.mjs';
  const contract = { ...goal(), verificationCommand };
  const changed = checklist();
  changed.features[1].verification = verificationCommand;
  writeFileSync(files.checklistPath, `${JSON.stringify(changed, null, 2)}\n`);
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });

  const before = boundary.capture(contract);
  writeFileSync(helperPath, 'module.exports = { verified: false };\n');

  assert.throws(
    () => boundary.assertTransition(before, boundary.capture(contract), contract, 'maker'),
    /Protected file verification-helper\.cjs changed/,
  );
});

test('default repository boundary protects controller modules for external verification', (t) => {
  const files = fixture(t);
  const verificationPath = join(
    files.root,
    'tests',
    'Sample.Tests',
    'sample.test.mjs',
  );
  mkdirSync(dirname(verificationPath), { recursive: true });
  writeFileSync(verificationPath, 'test("sample", () => {});\n');
  const verificationCommand = 'node --test tests/Sample.Tests/sample.test.mjs';
  const contract = { ...goal(), verificationCommand };
  const changed = checklist();
  changed.features[1].verification = verificationCommand;
  writeFileSync(files.checklistPath, `${JSON.stringify(changed, null, 2)}\n`);

  const controllerPaths = [
    'scripts/goal-contract.mjs',
    'scripts/goal-contract.schema.json',
    'scripts/loop-state.mjs',
    'scripts/maker-checker-loop.mjs',
    'scripts/maker-checker-safety.mjs',
    'scripts/run-verification.mjs',
    'scripts/verification-sandbox.mjs',
  ];
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });

  for (const protectedPath of controllerPaths) {
    const absolutePath = join(files.root, protectedPath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, 'trusted controller module\n');
    const before = boundary.capture(contract);
    writeFileSync(absolutePath, 'tampered controller module\n');
    const normalizedPath = protectedPath.replaceAll('\\', '/');

    assert.throws(
      () => boundary.assertTransition(
        before,
        boundary.capture(contract),
        contract,
        'maker',
      ),
      (error) => error.message
        .replaceAll('\\', '/')
        .includes(`Protected file ${normalizedPath} changed`),
      protectedPath,
    );
  }
});

test('repository boundary rejects a goal issue that differs from the checklist', (t) => {
  const files = fixture(t);
  const changed = checklist();
  changed.issue.number = 31;
  writeFileSync(files.checklistPath, `${JSON.stringify(changed, null, 2)}\n`);
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });

  assert.throws(
    () => boundary.capture(goal()),
    /Goal issue does not match its feature checklist/,
  );
});

test('repository boundary rejects symbolic links in protected paths', (t) => {
  const files = fixture(t);
  const targetDirectory = join(files.root, 'linked-target');
  const linkPath = join(files.root, 'scripts', 'linked-helper');
  mkdirSync(targetDirectory);
  writeFileSync(join(targetDirectory, 'helper.mjs'), 'helper\n');
  symlinkSync(
    targetDirectory,
    linkPath,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });

  assert.throws(
    () => boundary.capture(goal()),
    /Protected path contains a symbolic link/,
  );
});

test('repository boundary rejects verification inputs inside unhashed build output', (t) => {
  const files = fixture(t);
  const buildOutputTest = join(files.root, 'scripts', 'bin', 'feature.test.mjs');
  mkdirSync(dirname(buildOutputTest), { recursive: true });
  writeFileSync(buildOutputTest, 'build output fixture\n');
  const verificationCommand = 'node --test scripts/bin/feature.test.mjs';
  const changed = checklist();
  changed.features[1].verification = verificationCommand;
  writeFileSync(files.checklistPath, `${JSON.stringify(changed, null, 2)}\n`);
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });

  assert.throws(
    () => boundary.capture({ ...goal(), verificationCommand }),
    /test file is inside an unhashed build output directory/,
  );
});

test('repository boundary rejects verification imports inside unhashed build output', (t) => {
  const files = fixture(t);
  const buildOutputHelper = join(files.root, 'scripts', 'obj', 'helper.mjs');
  mkdirSync(dirname(buildOutputHelper), { recursive: true });
  writeFileSync(buildOutputHelper, 'export const helper = 1;\n');
  writeFileSync(files.verificationPath, "import { helper } from './obj/helper.mjs';\n");
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });

  assert.throws(
    () => boundary.capture(goal()),
    /import resolves into an unhashed build output directory/,
  );
});

test('repository boundary rejects symbolic links at the repository root', (t) => {
  const files = fixture(t);
  const targetDirectory = join(files.root, 'link-target');
  mkdirSync(targetDirectory);
  writeFileSync(join(targetDirectory, 'helper.mjs'), 'helper\n');
  symlinkSync(
    targetDirectory,
    join(files.root, 'linked-root-entry'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });

  assert.throws(
    () => boundary.capture(goal()),
    /Protected path contains a symbolic link/,
  );
});

test('verification contracts reject implicit discovery, package scripts, and unsupported tools', (t) => {
  const commands = [
    'node --test',
    'node --test scripts/*.test.mjs',
    'npm test',
    'npm run test:unit',
    'pytest tests/test_feature.py',
    'dotnet test AgentGateLab.sln',
    'docker compose run --build --rm checks',
    'dotnet test AgentGateLab.slnx',
  ];
  for (const verificationCommand of commands) {
    const files = fixture(t);
    const contract = { ...goal(), verificationCommand };
    const changed = checklist();
    changed.features[1].verification = verificationCommand;
    writeFileSync(files.checklistPath, `${JSON.stringify(changed, null, 2)}\n`);
    const boundary = new RepositorySafetyBoundary({
      repositoryRoot: files.root,
      commandRunner: commandRunner(),
    });
    assert.throws(
      () => boundary.capture(contract),
      /Node verification must use|Verification command form is not supported/,
      verificationCommand,
    );
  }
});

test('verification contracts reject dynamic and external test imports', (t) => {
  const unsupportedTestSources = [
    "import('../test-helper.mjs');\n",
    "import /* comment-separated */ ('../test-helper.mjs');\n",
    'require /* comment-separated */ (helperPath);\n',
    'const loadModule = require;\nloadModule(helperPath);\n',
    "require('test-' + 'helper.mjs');\n",
    "import { createRequire as loadHelper } from 'node:module';\nloadHelper(import.meta.url)('../test-helper.mjs');\n",
    "import { createRequire as loadHelper } from 'module';\nloadHelper(import.meta.url)('../test-helper.mjs');\n",
    "import * as Module from 'node:module';\nModule['create' + 'Require'](import.meta.url)('../test-helper.mjs');\n",
    "process.getBuiltinModule('module').createRequire(import.meta.url)('../test-helper.mjs');\n",
    "eval(\"import('../test-helper.mjs')\");\n",
    "(0, eval)(\"import('../test-helper.mjs')\");\n",
    "globalThis['eval'](\"import('../test-helper.mjs')\");\n",
    "const key = 'ev' + 'al'; globalThis[key](\"import('../test-helper.mjs')\");\n",
    "Object['getOwnPropertyDescriptor'](globalThis, 'eval').value(\"x\");\n",
    "Reflect.get(globalThis, 'eval')(\"import('../test-helper.mjs')\");\n",
    "new Function(\"return import('../test-helper.mjs')\")();\n",
    "({}).constructor.constructor(\"return import('../test-helper.mjs')\")();\n",
    "({})['constructor']['constructor'](\"return import('../test-helper.mjs')\")();\n",
    "import vm from 'node:vm';\n",
    "const vm = require('vm');\n",
    'const slashPattern = /\\/\\//; import("../test-helper.mjs");\n',
    "if (true) {} /\\/\\//.test('x'); import('../test-helper.mjs');\n",
    "{} /'/; import('../test-helper.mjs');\n",
    String.raw`if (true) {} /\\\//.test('x'); import('../test-helper.mjs');`,
    "async function run(items) { for await (const item of items) /'/; import('../test-helper.mjs'); }\n",
    "const quotient = 4 / 2; import('../test-helper.mjs');\n",
    "import helper from 'external-test-helper';\n",
  ];
  for (const source of unsupportedTestSources) {
    const files = fixture(t);
    writeFileSync(files.verificationPath, source);
    const boundary = new RepositorySafetyBoundary({
      repositoryRoot: files.root,
      commandRunner: commandRunner(),
    });

    assert.throws(
      () => boundary.capture(goal()),
      /ambiguous slash after a closing brace|indirect module loader that cannot be protected|reflective dynamic code execution|dynamic code execution|imports unsupported module loader|imports unsupported package input/,
      source,
    );
  }
});

test('verification contracts reject subprocess and worker loaders outside scripts', (t) => {
  const files = fixture(t);
  const verificationPath = join(files.root, 'tests', 'verification.test.mjs');
  mkdirSync(dirname(verificationPath), { recursive: true });
  const commands = [
    ["import { spawn } from 'node:child_process';\n", 'child_process'],
    ["import { Worker } from 'node:worker_threads';\n", 'worker_threads'],
    ["const { fork } = require('node:child_process');\n", 'child_process'],
  ];

  for (const [source, moduleName] of commands) {
    writeFileSync(verificationPath, source);
    const verificationCommand = 'node --test tests/verification.test.mjs';
    const contract = { ...goal(), verificationCommand };
    const changed = checklist();
    changed.features[1].verification = verificationCommand;
    writeFileSync(files.checklistPath, `${JSON.stringify(changed, null, 2)}\n`);
    const boundary = new RepositorySafetyBoundary({
      repositoryRoot: files.root,
      commandRunner: commandRunner(),
    });

    assert.throws(
      () => boundary.capture(contract),
      new RegExp(`imports unsupported executable loader: (?:node:)?${moduleName}`),
      source,
    );
  }
});

test('repository boundary protects checker instructions and agent definitions', (t) => {
  const files = fixture(t);
  const agentDirectory = join(files.root, '.github', 'agents');
  const skillDirectory = join(files.root, '.github', 'skills', 'feature-evaluator');
  mkdirSync(agentDirectory, { recursive: true });
  mkdirSync(skillDirectory, { recursive: true });
  const agentPath = join(agentDirectory, 'harness-implementer.agent.md');
  const skillPath = join(skillDirectory, 'SKILL.md');
  writeFileSync(join(files.root, 'AGENTS.md'), 'repository instructions\n');
  writeFileSync(agentPath, 'maker instructions\n');
  writeFileSync(skillPath, 'checker instructions\n');

  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });
  const before = boundary.capture(goal());
  writeFileSync(join(files.root, 'AGENTS.md'), 'weakened repository instructions\n');
  assert.throws(
    () => boundary.assertTransition(before, boundary.capture(goal()), goal(), 'maker'),
    /Protected file AGENTS\.md changed/,
  );

  const beforeSkillChange = boundary.capture(goal());
  writeFileSync(skillPath, 'weakened checker instructions\n');
  assert.throws(
    () => boundary.assertTransition(
      beforeSkillChange,
      boundary.capture(goal()),
      goal(),
      'maker',
    ),
    /Protected file \.github[\\/]skills changed/,
  );

  const beforeAgentAddition = boundary.capture(goal());
  writeFileSync(join(agentDirectory, 'new.agent.md'), 'new agent instructions\n');
  assert.throws(
    () => boundary.assertTransition(
      beforeAgentAddition,
      boundary.capture(goal()),
      goal(),
      'maker',
    ),
    /Protected file \.github[\\/]agents changed/,
  );
});

test('repository boundary protects the host-side verification launcher', (t) => {
  const files = fixture(t);
  const runnerPath = join(files.root, 'scripts', 'run-verification.mjs');
  const sandboxPath = join(files.root, 'scripts', 'verification-sandbox.mjs');
  writeFileSync(runnerPath, 'trusted runner\n');
  writeFileSync(sandboxPath, 'trusted sandbox\n');
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });

  const before = boundary.capture(goal());
  writeFileSync(runnerPath, 'modified runner\n');
  assert.throws(
    () => boundary.assertTransition(before, boundary.capture(goal()), goal(), 'maker'),
    /Protected file scripts changed/,
  );

  const beforeSandboxChange = boundary.capture(goal());
  writeFileSync(sandboxPath, 'modified sandbox\n');
  assert.throws(
    () => boundary.assertTransition(
      beforeSandboxChange,
      boundary.capture(goal()),
      goal(),
      'maker',
    ),
    /Protected file scripts changed/,
  );
});

test('repository boundary rejects absolute verification paths', (t) => {
  const files = fixture(t);
  const relativeCommand = 'node --test scripts/maker-checker-safety.test.mjs';
  for (const verificationCommand of [
    `node --test "${files.verificationPath}"`,
    `node --test "${files.verificationPath.replaceAll('\\', '/')}"`,
    'node --test /workspace/scripts/maker-checker-safety.test.mjs',
    'node --test C:\\repo\\scripts\\maker-checker-safety.test.mjs',
    '/usr/local/bin/node --test scripts/maker-checker-safety.test.mjs',
    'bash /workspace/scripts/check-architecture.sh',
  ]) {
    const contract = { ...goal(), verificationCommand };
    const changed = checklist();
    changed.features[1].verification = verificationCommand;
    writeFileSync(files.checklistPath, `${JSON.stringify(changed, null, 2)}\n`);
    const boundary = new RepositorySafetyBoundary({
      repositoryRoot: files.root,
      commandRunner: commandRunner(),
    });

    assert.throws(
      () => boundary.capture(contract),
      /must use repository-relative paths/,
      verificationCommand,
    );
  }

  const contract = { ...goal(), verificationCommand: relativeCommand };
  const changed = checklist();
  changed.features[1].verification = relativeCommand;
  writeFileSync(files.checklistPath, `${JSON.stringify(changed, null, 2)}\n`);
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });
  assert.doesNotThrow(() => boundary.capture(contract));
});

test('repository boundary rejects shell-command verification forms with shell options', (t) => {
  const files = fixture(t);
  const commands = [
    "bash -c 'node --test scripts/a.test.mjs'",
    "bash --noprofile -c 'node --test scripts/a.test.mjs'",
    "bash -x -lc 'node --test scripts/a.test.mjs'",
    "pwsh -NoProfile -Command 'node --test scripts/a.test.mjs'",
    '"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoProfile -Command "node --test scripts/a.test.mjs"',
    "powershell -EncodedCommand 'bm9kZQ=='",
  ];
  for (const verificationCommand of commands) {
    const contract = { ...goal(), verificationCommand };
    const changed = checklist();
    changed.features[1].verification = verificationCommand;
    writeFileSync(files.checklistPath, `${JSON.stringify(changed, null, 2)}\n`);
    const boundary = new RepositorySafetyBoundary({
      repositoryRoot: files.root,
      commandRunner: commandRunner(),
    });

    assert.throws(
      () => boundary.capture(contract),
      /Shell command verification forms are not supported/,
      verificationCommand,
    );
  }
});

test('repository boundary rejects shell scripts outside the sandbox-compatible allowlist', (t) => {
  const files = fixture(t);
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });
  for (const verificationCommand of [
    'bash scripts/verify-acs-spike.sh',
    'bash scripts/run-verification.sh',
  ]) {
    const contract = { ...goal(), verificationCommand };
    const changed = checklist();
    changed.features[1].verification = verificationCommand;
    writeFileSync(files.checklistPath, `${JSON.stringify(changed, null, 2)}\n`);

    assert.throws(
      () => boundary.capture(contract),
      /explicitly allowlisted sandbox-compatible script/,
      verificationCommand,
    );
  }

  const contract = {
    ...goal(),
    verificationCommand: 'bash scripts/check-architecture.sh',
  };
  const changed = checklist();
  changed.features[1].verification = contract.verificationCommand;
  writeFileSync(files.checklistPath, `${JSON.stringify(changed, null, 2)}\n`);

  assert.doesNotThrow(() => boundary.capture(contract));
});

test('repository boundary prevents starting or changing another feature', (t) => {
  const files = fixture(t);
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });
  const before = boundary.capture(goal());
  const changed = structuredClone(before);
  changed.checklist.features[2].status = 'active';

  assert.throws(
    () => boundary.assertTransition(before, changed, goal(), 'maker'),
    /Feature F005 changed[\s\S]*Feature F005 was started/,
  );
});

test('repository boundary rejects duplicate feature IDs', (t) => {
  const files = fixture(t);
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });
  const before = boundary.capture(goal());
  const after = structuredClone(before);
  after.checklist.features.push(structuredClone(after.checklist.features[0]));

  assert.throws(
    () => boundary.assertTransition(before, after, goal(), 'maker'),
    /Duplicate feature ID F003 is not allowed/,
  );
});

test('repository boundary allows only the checker to pass the active feature', (t) => {
  const files = fixture(t);
  const boundary = new RepositorySafetyBoundary({
    repositoryRoot: files.root,
    commandRunner: commandRunner(),
  });
  const before = boundary.capture(goal());
  const after = structuredClone(before);
  after.checklist.features[1].status = 'pass';
  after.checklist.features[1].evidence = 'independent PASS';
  after.checklist.features[1].testedAt = '2026-10-10';

  assert.doesNotThrow(
    () => boundary.assertTransition(before, after, goal(), 'checker', {
      checkerOutcome: 'pass',
      reviewedRevisionValid: true,
    }),
  );
  assert.throws(
    () => boundary.assertTransition(before, after, goal(), 'checker', {
      checkerOutcome: 'fail',
      reviewedRevisionValid: true,
    }),
    /status changed outside checker PASS/,
  );
  assert.throws(
    () => boundary.assertTransition(before, after, goal(), 'checker', {
      checkerOutcome: 'pass',
      reviewedRevisionValid: false,
    }),
    /status changed outside checker PASS/,
  );
  assert.throws(
    () => boundary.assertTransition(before, after, goal(), 'maker'),
    /status changed outside checker PASS/,
  );
});

test('serial loop stops for approval after a protected change', async (t) => {
  const statePath = join(mkdtempSync(join(tmpdir(), 'agentgate-loop-state-')), 'state.json');
  t.after(() => rmSync(dirname(statePath), { recursive: true, force: true }));
  const snapshots = [
    { id: 'before' },
    { id: 'after' },
  ];
  const safetyBoundary = {
    capture: () => snapshots.shift(),
    assertTransition: () => {
      throw new Error('Safety boundary requires explicit human approval.');
    },
  };
  const revisions = [revision('before'), revision('after')];
  const result = await runMakerCheckerLoop({
    goal: goal(),
    statePath,
    dispatcher: new ScriptedDispatcher([
      { outcome: 'completed', feedback: 'attempted protected change' },
    ]),
    getRevision: () => revisions.shift() ?? revision('after'),
    safetyBoundary,
    now: (() => {
      let tick = 0;
      return () => new Date(Date.parse('2026-10-10T10:00:00Z') + (tick++ * 1000));
    })(),
  });

  assert.equal(result.status, 'approval-required');
  assert.equal(result.state.rounds.length, 1);
  assert.equal(result.state.rounds[0].humanIntervention.required, true);
  assert.match(result.state.rounds[0].feedback, /explicit human approval/);
});
