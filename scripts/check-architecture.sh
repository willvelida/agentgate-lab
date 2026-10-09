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

strip_xml_comments() {
  awk '
    function strip_comments(line, result, start, closing_index) {
      while (length(line) > 0) {
        if (in_comment) {
          closing_index = index(line, "-->")
          if (closing_index == 0) return result
          line = substr(line, closing_index + 3)
          in_comment = 0
        } else {
          start = index(line, "<!--")
          if (start == 0) return result line " "
          result = result substr(line, 1, start - 1)
          line = substr(line, start + 4)
          in_comment = 1
        }
      }
      return result
    }

    { normalized = normalized strip_comments($0) }
    END { print normalized }
  ' "$1"
}

check_service_references() {
  local svc other csproj pattern project_content
  for svc in "${services[@]}"; do
    csproj="src/${svc}/${svc}.csproj"
    [[ -f "${csproj}" ]] || continue
    project_content="$(strip_xml_comments "${csproj}")"
    for other in "${services[@]}"; do
      [[ "${other}" == "${svc}" ]] && continue
      pattern="<ProjectReference[^>]*Include[[:space:]]*=[[:space:]]*[\"'][^\"']*[/\\\\]${other}[.]csproj[\"']"
      if grep -Eiq "${pattern}" <<< "${project_content}"; then
        report "${csproj} references ${other}. Services must not reference each other."
      fi
    done
  done
}

check_client_imports() {
  local client_root file dir spec resolved imports import_match import_status
  [[ -d src/Client ]] || return 0
  client_root="$(realpath -m src/Client)"

  while IFS= read -r file; do
    dir="$(dirname "${file}")"
    if imports="$(
      tr '\n' ' ' < "${file}" \
        | grep -Eo "(from|import)[[:space:]]*\(?[[:space:]]*['\"]\.{1,2}/[^'\"]*['\"]"
    )"; then
      :
    else
      import_status=$?
      if (( import_status != 1 )); then
        report "Unable to scan imports in ${file} (exit ${import_status})."
        return 1
      fi
    fi

    while IFS= read -r import_match; do
      spec="$(sed -E "s/.*['\"](\.{1,2}\/[^'\"]*)['\"].*/\1/" <<< "${import_match}")"
      [[ -z "${spec}" ]] && continue
      resolved="$(realpath -m "${dir}/${spec}")"
      if [[ "${resolved}" != "${client_root}" && "${resolved}" != "${client_root}/"* ]]; then
        report "${file} imports '${spec}', which is outside src/Client."
      fi
    done <<< "${imports}"
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
