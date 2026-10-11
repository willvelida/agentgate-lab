// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

export const VERIFICATION_SANDBOX_IMAGE = 'agentgate-verification:node24';

export function sandboxInvocation(command, args, repositoryRoot, image) {
  return {
    command: 'docker',
    args: [
      'run',
      '--rm',
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
