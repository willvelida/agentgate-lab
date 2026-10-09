#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# SPDX-License-Identifier: MIT
#
# verify-acs-spike.sh
# Restore dependencies, run the Linux container smoke, and test the solution.

set -euo pipefail

usage() {
  printf 'Usage: %s\n' "${0##*/}" >&2
}

main() {
  if (($# > 0)); then
    usage
    return 2
  fi

  local repo_root
  repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "${repo_root}"

  local dotnet_command
  if command -v dotnet &>/dev/null; then
    dotnet_command="dotnet"
  elif command -v dotnet.exe &>/dev/null; then
    dotnet_command="dotnet.exe"
  else
    printf 'ERROR: required command not found: dotnet or dotnet.exe\n' >&2
    return 1
  fi

  local -a npm_command
  if command -v node &>/dev/null && command -v npm &>/dev/null; then
    npm_command=("npm")
  elif command -v node.exe &>/dev/null &&
    command -v npm.cmd &>/dev/null &&
    command -v cmd.exe &>/dev/null; then
    npm_command=("cmd.exe" "/c" "npm.cmd")
  else
    printf 'ERROR: Node.js 24 and npm 11 are required\n' >&2
    return 1
  fi

  if ! command -v docker &>/dev/null; then
    printf 'ERROR: required command not found: docker\n' >&2
    return 1
  fi

  printf '\n==> Restore locked .NET dependencies\n'
  "${dotnet_command}" restore AgentGateLab.sln --locked-mode

  printf '\n==> Install locked frontend dependencies\n'
  "${npm_command[@]}" ci --prefix src/Client

  printf '\n==> Build frontend assets for the Portal tests\n'
  "${npm_command[@]}" run build --prefix src/Client

  printf '\n==> Build and run the Linux x64 ACS spike container\n'
  docker compose run --build --rm acs-spike

  printf '\n==> Run the .NET solution tests\n'
  "${dotnet_command}" test AgentGateLab.sln --no-restore \
    --property:SkipClientBuild=true
}

main "$@"
