// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const bash = process.platform === 'win32'
  ? join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe')
  : 'bash';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agentgate-architecture-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  cpSync(
    join(scriptDirectory, 'check-architecture.sh'),
    join(root, 'scripts', 'check-architecture.sh'),
  );
  mkdirSync(join(root, 'src', 'Portal'), { recursive: true });
  mkdirSync(join(root, 'src', 'Client'), { recursive: true });
  writeFileSync(join(root, 'src', 'Portal', 'Portal.csproj'), '<Project />');
  return root;
}

function run(root) {
  return spawnSync(bash, [join(root, 'scripts', 'check-architecture.sh')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
  });
}

test('passes when no service boundary is crossed', (t) => {
  const root = fixture(t);
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Architecture check passed/);
});

test('detects a multiline service project reference', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'src', 'Portal', 'Portal.csproj'), [
    '<Project>',
    '  <ItemGroup>',
    '    <ProjectReference',
    '      Include="../Gateway/Gateway.csproj" />',
    '  </ItemGroup>',
    '</Project>',
  ].join('\n'));

  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Portal\.csproj references Gateway/);
});

test('ignores service references inside XML comments', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'src', 'Portal', 'Portal.csproj'), [
    '<Project>',
    '  <!--',
    '  <ProjectReference',
    '    Include="../Gateway/Gateway.csproj" />',
    '  -->',
    '</Project>',
  ].join('\n'));

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});

test('detects multiline dynamic imports outside the client', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'src', 'Client', 'main.ts'), [
    'const module = await import(',
    "  '../../Gateway/handler.js'",
    ');',
  ].join('\n'));

  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /imports '\.\.\/\.\.\/Gateway\/handler\.js'/);
});

test('allows multiline dynamic imports within the client', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'src', 'Client', 'features'));
  writeFileSync(join(root, 'src', 'Client', 'main.ts'), [
    'const module = await import(',
    "  './features/handler.js'",
    ');',
  ].join('\n'));

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});
