// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const VERIFICATION_SANDBOX_IMAGE = 'agentgate-verification:node24';

export function cleanupSandboxContainer(
  containerIdFile,
  repositoryRoot,
  commandRunner = execFileSync,
) {
  if (!existsSync(containerIdFile)) return false;
  const containerId = readFileSync(containerIdFile, 'utf8').trim();
  if (!/^[a-f0-9]{12,64}$/i.test(containerId)) {
    throw new Error('Verification sandbox container ID file is invalid.');
  }
  commandRunner('docker', ['container', 'rm', '--force', containerId], {
    cwd: resolve(repositoryRoot),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
  return true;
}

export function sandboxInvocation(command, args, repositoryRoot, image, containerIdFile) {
  if (typeof containerIdFile !== 'string' || !containerIdFile.trim()) {
    throw new Error('A container ID file is required for sandbox execution.');
  }
  return {
    command: 'docker',
    args: [
      'run',
      '--cidfile',
      containerIdFile,
      '--pull=never',
      '--network=none',
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--pids-limit=128',
      '--memory=2g',
      '--cpus=2',
      '--mount',
      `type=bind,source=${repositoryRoot},target=/workspace,readonly`,
      '--tmpfs',
      '/tmp:rw,nosuid,nodev,size=1g,mode=1777',
      '--tmpfs',
      '/workspace/.local:rw,nosuid,nodev,size=256m,uid=1000,gid=1000,mode=700',
      '--tmpfs',
      '/home/node:rw,nosuid,nodev,size=64m,uid=1000,gid=1000,mode=700',
      '--workdir',
      '/workspace',
      '--user',
      '1000:1000',
      '--entrypoint',
      command,
      image,
      ...args,
    ],
  };
}
