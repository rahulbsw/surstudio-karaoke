#!/usr/bin/env bash
set -euo pipefail

AI_ROOT="${HOME}/Library/Application Support/SurStudio/AI"
VENV_ROOT="${AI_ROOT}/venv"

if command -v python3.11 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3.11)"
elif command -v python3.12 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3.12)"
else
  echo "SurStudio local AI needs Python 3.11 or 3.12. Install one with: brew install python@3.11" >&2
  exit 1
fi

mkdir -p "${AI_ROOT}"
"${PYTHON_BIN}" -m venv "${VENV_ROOT}"
"${VENV_ROOT}/bin/python3" -m pip install --upgrade pip wheel
"${VENV_ROOT}/bin/python3" -m pip install mlx-whisper demucs

echo "Local AI workers installed in ${VENV_ROOT}"
echo "Restart SurStudio, then use Check installed workers in the Mac performance engine."
