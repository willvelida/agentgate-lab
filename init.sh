#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# SPDX-License-Identifier: MIT
#
# init.sh
# Restore dependencies and run the repository CI checks locally.

set -euo pipefail

run_step() {
  local description="$1"
  shift

  printf '\n==> %s\n' "${description}"
  "$@"
}

main() {
  local repo_root
  repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  cd "${repo_root}"

  run_step "Check project boundaries" \
    bash scripts/check-architecture.sh
  run_step "Restore locked .NET dependencies" \
    dotnet restore AgentGateLab.sln --locked-mode
  run_step "Install locked frontend dependencies" \
    npm ci --prefix src/Client
  run_step "Type-check the frontend" \
    npm run typecheck --prefix src/Client
  run_step "Test the frontend" \
    npm test --prefix src/Client
  run_step "Build the frontend" \
    npm run build --prefix src/Client
  run_step "Build the .NET solution" \
    dotnet build AgentGateLab.sln --no-restore \
      --property:SkipClientBuild=true
  run_step "Test the .NET solution" \
    dotnet test AgentGateLab.sln --no-build --no-restore \
      --property:SkipClientBuild=true
  run_step "Publish the Portal" \
    dotnet publish src/Portal/Portal.csproj --configuration Release \
      --no-restore --property:SkipClientBuild=true

  printf '\nAll repository checks passed.\n'
}

main "$@"
