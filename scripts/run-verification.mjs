// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, renameSync, writeFileSync, createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArguments(args) {
  let label = 'verification';
  if (args[0] === '--label') {
    label = args[1];
    args = args.slice(2);
    if (!label?.trim() || label === '--') {
      throw new Error('--label requires a nonempty value.');
    }
  }
  if (args[0] !== '--' || !args[1]?.trim()) {
    throw new Error(
      'Usage: node scripts/run-verification.mjs [--label name] -- command [arguments]',
    );
  }
  return { label, command: args[1], arguments: args.slice(2) };
}

function git(...args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 10000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function snapshot() {
  const workingTree = git('status', '--porcelain=v1', '--untracked-files=normal');
  return {
    commit: git('rev-parse', 'HEAD').trim(),
    branch: git('rev-parse', '--abbrev-ref', 'HEAD').trim(),
    workingTree,
    diffIncludesUncommittedChanges: workingTree.length > 0,
  };
}

function writeReport(runDirectory, report) {
  const temporaryPath = join(runDirectory, 'report.json.tmp');
  writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(temporaryPath, join(runDirectory, 'report.json'));
}

function execution(command, args) {
  if (process.platform !== 'win32') {
    return { command, args };
  }

  // PowerShell launches Windows command shims without cmd.exe interpolation.
  const literal = (value) => `'${value.replaceAll("'", "''")}'`;
  const script = [
    "$ErrorActionPreference = 'Stop'",
    '$PSNativeCommandUseErrorActionPreference = $false',
    '$LASTEXITCODE = 0',
    `$CommandArguments = @(${args.map(literal).join(',')})`,
    `& ${literal(command)} @CommandArguments`,
    'if (-not $? -and $LASTEXITCODE -eq 0) { exit 1 }',
    'exit $LASTEXITCODE',
  ].join('\n');
  return {
    command: 'pwsh.exe',
    args: [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64'),
    ],
  };
}

function tee(destination) {
  return new Transform({
    transform(chunk, encoding, callback) {
      if (destination.write(chunk)) {
        callback(null, chunk);
      } else {
        destination.once('drain', () => callback(null, chunk));
      }
    },
  });
}

async function main() {
  const invocation = parseArguments(process.argv.slice(2));
  const before = snapshot();
  const startedAt = new Date().toISOString();
  const runId = `${startedAt.replaceAll(/[:.]/g, '-')}-${randomUUID()}`;
  const runDirectory = join(repoRoot, '.local', 'verification', runId);
  mkdirSync(runDirectory, { recursive: true, mode: 0o700 });
  const report = {
    schemaVersion: 1,
    runId,
    ...invocation,
    cwd: repoRoot,
    startedAt,
    finishedAt: null,
    durationMs: null,
    status: 'running',
    exitCode: null,
    signal: null,
    before,
    after: null,
    stdout: 'stdout.log',
    stderr: 'stderr.log',
    error: null,
  };
  writeReport(runDirectory, report);
  process.stderr.write(`Verification report: ${join(runDirectory, 'report.json')}\n`);

  const start = performance.now();
  const launch = execution(invocation.command, invocation.arguments);
  const child = spawn(launch.command, launch.args, {
    cwd: repoRoot,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let launchError;
  const completion = new Promise((resolveCompletion) => {
    child.on('error', (error) => { launchError = error; });
    child.on('close', (exitCode, signal) => {
      resolveCompletion({ exitCode, signal });
    });
  });

  try {
    const [result] = await Promise.all([
      completion,
      pipeline(
        child.stdout,
        tee(process.stdout),
        createWriteStream(join(runDirectory, report.stdout), { flags: 'wx', mode: 0o600 }),
      ),
      pipeline(
        child.stderr,
        tee(process.stderr),
        createWriteStream(join(runDirectory, report.stderr), { flags: 'wx', mode: 0o600 }),
      ),
    ]);
    report.exitCode = result.exitCode;
    report.signal = result.signal;
    report.status = result.signal ? 'interrupted' : result.exitCode === 0 ? 'passed' : 'failed';
    if (launchError) throw launchError;
    report.after = snapshot();
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
    }
    await completion;
    report.status = 'error';
    report.error = error.message;
    process.stderr.write(`Verification runner error: ${error.message}\n`);
  }

  report.finishedAt = new Date().toISOString();
  report.durationMs = Math.round(performance.now() - start);
  writeReport(runDirectory, report);
  process.stderr.write(`Verification ${report.status}: ${runId}\n`);
  process.exitCode = report.status === 'passed'
    ? 0
    : report.exitCode && report.exitCode > 0 ? report.exitCode : 1;
}

main().catch((error) => {
  process.stderr.write(`Verification runner error: ${error.message}\n`);
  process.exitCode = 1;
});
