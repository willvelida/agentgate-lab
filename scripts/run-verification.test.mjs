// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-verification-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  for (const file of ['run-verification.mjs', 'run-verification.sh', 'Invoke-Verification.ps1']) {
    cpSync(join(scriptDirectory, file), join(root, 'scripts', file));
  }
  execFileSync('git', ['init', '--quiet', root]);
  execFileSync('git', [
    '-c', 'user.name=Verification Test',
    '-c', 'user.email=verification@example.invalid',
    'commit', '--quiet', '--allow-empty', '-m', 'test(scripts): initialize verification fixture',
  ], { cwd: root });
  return root;
}

function run(root, args) {
  return spawnSync(process.execPath, [join(root, 'scripts', 'run-verification.mjs'), ...args], {
    cwd: tmpdir(),
    encoding: 'utf8',
    timeout: 30000,
  });
}

function evidence(result) {
  assert.ifError(result.error);
  const match = result.stderr.match(/Verification report: (.+)/);
  assert.ok(match, result.stderr);
  const reportPath = match[1].trim();
  return { reportPath, report: JSON.parse(readFileSync(reportPath, 'utf8')) };
}

test('captures output, argument boundaries, timing, and repository state', (t) => {
  const root = fixture(t);
  const args = ['space value', '', "single'quote", 'double"quote', '$HOME; echo injected', '%PATH%', '&|<>'];
  const code = 'console.log(JSON.stringify(process.argv.slice(1))); console.error("diagnostic");';
  const result = run(root, ['--label', 'Argument check', '--', process.execPath, '-e', code, ...args]);
  assert.equal(result.status, 0, result.stderr);
  const { report, reportPath } = evidence(result);
  assert.equal(report.status, 'passed');
  assert.equal(report.exitCode, 0);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.label, 'Argument check');
  assert.equal(report.command, process.execPath);
  assert.deepEqual(report.arguments, ['-e', code, ...args]);
  assert.equal(resolve(report.cwd), resolve(root));
  assert.match(report.before.commit, /^[a-f0-9]{40}$/);
  assert.ok(report.before.workingTree.includes('scripts'));
  assert.equal(report.before.diffIncludesUncommittedChanges, true);
  assert.ok(report.after);
  assert.ok(Number.isInteger(report.durationMs) && report.durationMs >= 0);
  assert.ok(Date.parse(report.finishedAt) >= Date.parse(report.startedAt));
  assert.deepEqual(JSON.parse(readFileSync(join(dirname(reportPath), report.stdout), 'utf8')), args);
  assert.equal(readFileSync(join(dirname(reportPath), report.stderr), 'utf8').trim(), 'diagnostic');
  assert.ok(result.stdout.includes('space value'));
});

test('preserves a failed command exit code and stderr', (t) => {
  const root = fixture(t);
  const result = run(root, ['--', process.execPath, '-e', 'console.error("expected failure"); process.exit(7);']);
  assert.equal(result.status, 7, result.stderr);
  const { report } = evidence(result);
  assert.equal(report.status, 'failed');
  assert.equal(report.exitCode, 7);
  assert.ok(result.stderr.includes('expected failure'));
});

test('a missing command never produces a passed report', (t) => {
  const root = fixture(t);
  const result = run(root, ['--', 'agentgate-nonexistent-verification-command']);
  assert.notEqual(result.status, 0);
  const { report } = evidence(result);
  assert.ok(['failed', 'error'].includes(report.status));
  assert.ok(report.finishedAt);
});

test('rejects malformed invocations explicitly', (t) => {
  const root = fixture(t);
  for (const args of [[], ['--'], ['--label', '', '--', 'node'], ['node', '-e', '1']]) {
    const result = run(root, args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Verification runner error:/);
  }
});

test('creates distinct run folders rather than overwriting evidence', (t) => {
  const root = fixture(t);
  const first = evidence(run(root, ['--', process.execPath, '-e', 'console.log("first")']));
  const second = evidence(run(root, ['--', process.execPath, '-e', 'console.log("second")']));
  assert.notEqual(first.report.runId, second.report.runId);
  assert.notEqual(first.reportPath, second.reportPath);
});

test('the Bash wrapper preserves arguments and failure status', (t) => {
  const root = fixture(t);
  const bash = process.platform === 'win32'
    ? join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe')
    : 'bash';
  const result = spawnSync(bash, [
    join(root, 'scripts', 'run-verification.sh'),
    '--label', 'Bash check', '--', process.execPath,
    '-e', 'console.log(process.argv[1]); process.exit(8);', 'space value',
  ], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 8, result.stderr);
  assert.equal(result.stdout.trim(), 'space value');
  assert.equal(evidence(result).report.label, 'Bash check');
});

test('the PowerShell wrapper preserves arguments and failure status', (t) => {
  const root = fixture(t);
  const literal = (value) => `'${value.replaceAll("'", "''")}'`;
  const script = [
    `& ${literal(join(root, 'scripts', 'Invoke-Verification.ps1'))}`,
    `-Command ${literal(process.execPath)}`,
    `-CommandArguments @('-e', 'console.log(process.argv[1]); process.exit(9);', 'space value')`,
    "-Label 'PowerShell check'; exit $LASTEXITCODE",
  ].join(' ');
  const result = spawnSync('pwsh', [
    '-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64'),
  ], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 9, result.stderr);
  assert.equal(result.stdout.trim(), 'space value');
  assert.equal(evidence(result).report.label, 'PowerShell check');
});

test('Windows command shims preserve a nonzero exit code', {
  skip: process.platform !== 'win32',
}, (t) => {
  const root = fixture(t);
  const shim = join(root, 'fixture-command.cmd');
  writeFileSync(shim, '@echo off\r\nexit /b 11\r\n');
  const result = run(root, ['--', shim]);
  assert.equal(result.status, 11, result.stderr);
  assert.equal(evidence(result).report.exitCode, 11);
});

test('a terminated command is never reported as passed', (t) => {
  const root = fixture(t);
  const result = run(root, [
    '--', process.execPath, '-e', 'process.kill(process.pid, "SIGTERM");',
  ]);
  assert.notEqual(result.status, 0);
  assert.ok(['failed', 'interrupted'].includes(evidence(result).report.status));
});
