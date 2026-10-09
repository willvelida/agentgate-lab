#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# SPDX-License-Identifier: MIT
#
# run-verification.sh [--label name] -- command [arguments]
# Records verification evidence under .local/verification/.

set -euo pipefail

main() {
  local script_dir
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  if ! command -v node >/dev/null; then
    printf 'ERROR: Node.js is required to record verification evidence.\n' >&2
    exit 1
  fi
  node "${script_dir}/run-verification.mjs" "$@"
}

main "$@"
