#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# SPDX-License-Identifier: MIT
#
# Checks project boundaries:
#   1. Service projects under src/ must not reference each other.
#   2. Files in src/Client must not import from outside src/Client.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(dirname "${script_dir}")"

services=(Portal Gateway AgentWorker)
violations=0

report() {
  echo "VIOLATION: $*" >&2
  violations=$((violations + 1))
}

check_service_references() {
  local svc other csproj
  for svc in "${services[@]}"; do
    csproj="src/${svc}/${svc}.csproj"
    [[ -f "${csproj}" ]] || continue
    for other in "${services[@]}"; do
      [[ "${other}" == "${svc}" ]] && continue
      if grep -Eiq "<ProjectReference[^>]*${other}\.csproj" "${csproj}"; then
        report "${csproj} references ${other}. Services must not reference each other."
      fi
    done
  done
}

check_client_imports() {
  local client_root file dir spec resolved
  [[ -d src/Client ]] || return 0
  client_root="$(realpath -m src/Client)"

  while IFS= read -r file; do
    dir="$(dirname "${file}")"
    while IFS= read -r spec; do
      [[ -z "${spec}" ]] && continue
      resolved="$(realpath -m "${dir}/${spec}")"
      if [[ "${resolved}" != "${client_root}" && "${resolved}" != "${client_root}/"* ]]; then
        report "${file} imports '${spec}', which is outside src/Client."
      fi
    done < <(grep -Eo "(from|import)[[:space:]]*\(?[[:space:]]*['\"]\.{1,2}/[^'\"]*['\"]" "${file}" \
      | sed -E "s/.*['\"](\.{1,2}\/[^'\"]*)['\"].*/\1/" || true)
  done < <(find src/Client \( -name node_modules -o -name dist \) -prune -o \
    -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -print)
}

main() {
  cd "${repo_root}"
  check_service_references
  check_client_imports

  if (( violations > 0 )); then
    echo "Architecture check failed with ${violations} violation(s)." >&2
    exit 1
  fi
  echo "Architecture check passed."
}

main "$@"
