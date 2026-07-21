#!/usr/bin/env bash
set -euo pipefail

MANAGED_PYTHON="${HOME}/Library/Application Support/SurStudio/AI/venv/bin/python3"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ ! -x "${MANAGED_PYTHON}" ]]; then
  echo "SurStudio local AI is not installed. Run npm run mac:setup-ai." >&2
  exit 1
fi

"${MANAGED_PYTHON}" "${PROJECT_ROOT}/macos/workers/surstudio_worker.py" probe --output /tmp/surstudio-ai-probe
