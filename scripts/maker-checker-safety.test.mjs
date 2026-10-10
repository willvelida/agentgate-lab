import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  CopilotCliDispatcher,
  ScriptedDispatcher,
  runMakerCheckerLoop,
} from './maker-checker-loop.mjs';
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

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-maker-checker-safety-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const checklistPath = join(root, 'docs', 'features', slug, 'features_list.json');
  const verificationPath = join(root, 'scripts', 'maker-checker-safety.test.mjs');
  mkdirSync(dirname(checklistPath), { recursive: true });
  mkdirSync(dirname(verificationPath), { recursive: true });
  writeFileSync(checklistPath, `${JSON.stringify(checklist(), null, 2)}\n`);
  writeFileSync(verificationPath, 'verification fixture\n');
  return { root, checklistPath, verificationPath };
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

test('Copilot dispatch applies non-prompt safety controls', async () => {
  const calls = [];
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
  });

  assert.equal(calls.length, 1);
  assert.ok(calls[0].args.includes('--disable-builtin-mcps'));
  assert.ok(!calls[0].args.some((argument) => argument.startsWith('--deny-tool=shell(')));
  for (const argument of copilotCapabilityArguments(
    'C:\\repo',
    ['publisher', 'workiq'],
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
  const implementationPath = join(files.root, 'scripts', 'implementation.mjs');
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
    () => boundary.assertTransition(before, after, goal(), 'checker'),
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
