#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MAC_ROOT="${PROJECT_ROOT}/macos"
APP_ROOT="${PROJECT_ROOT}/build/SurStudio.app"
CONTENTS_ROOT="${APP_ROOT}/Contents"
WEB_ROOT="${CONTENTS_ROOT}/Resources/WebApp"
RUNTIME_ROOT="${CONTENTS_ROOT}/Resources/Runtime"
NODE_BIN="${SURSTUDIO_NODE_PATH:-$(command -v node || true)}"
SIGN_IDENTITY="${SURSTUDIO_SIGN_IDENTITY:--}"

if [[ -z "${NODE_BIN}" || ! -x "${NODE_BIN}" ]]; then
  echo "A Node.js executable is required to build the self-contained Mac app." >&2
  exit 1
fi

cd "${PROJECT_ROOT}"
npm run build
swift build -c release --package-path "${MAC_ROOT}"
SWIFT_BIN_DIR="$(swift build -c release --package-path "${MAC_ROOT}" --show-bin-path)"

rm -rf "${APP_ROOT}"
mkdir -p "${CONTENTS_ROOT}/MacOS" "${WEB_ROOT}/dist" "${WEB_ROOT}/workers" "${RUNTIME_ROOT}/bin"

ditto "${SWIFT_BIN_DIR}/SurStudioMac" "${CONTENTS_ROOT}/MacOS/SurStudioMac"
ditto "${MAC_ROOT}/Info.plist" "${CONTENTS_ROOT}/Info.plist"
ditto "${PROJECT_ROOT}/dist" "${WEB_ROOT}/dist"
ditto "${PROJECT_ROOT}/macos/workers/surstudio_worker.py" "${WEB_ROOT}/workers/surstudio_worker.py"
ditto "${NODE_BIN}" "${RUNTIME_ROOT}/bin/node"
strip -x "${RUNTIME_ROOT}/bin/node" 2>/dev/null || true

"${PROJECT_ROOT}/node_modules/.bin/esbuild" "${PROJECT_ROOT}/server.mjs" \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --define:import.meta.url='"file:///SurStudio/server.mjs"' \
  --outfile="${WEB_ROOT}/server.cjs"

if [[ "${SIGN_IDENTITY}" == "-" ]]; then
  codesign --force --sign - "${RUNTIME_ROOT}/bin/node"
  codesign --force --sign - --entitlements "${MAC_ROOT}/SurStudio.entitlements" "${APP_ROOT}"
else
  codesign --force --options runtime --timestamp --sign "${SIGN_IDENTITY}" "${RUNTIME_ROOT}/bin/node"
  codesign --force --options runtime --timestamp --sign "${SIGN_IDENTITY}" --entitlements "${MAC_ROOT}/SurStudio.entitlements" "${APP_ROOT}"
fi

echo "Built ${APP_ROOT}"
echo "Bundled Node runtime: $(${RUNTIME_ROOT}/bin/node --version)"
if [[ "${SIGN_IDENTITY}" == "-" ]]; then
  echo "Signing: ad hoc (recipients must right-click Open once)"
else
  echo "Signing: ${SIGN_IDENTITY}"
fi
echo "Note: .env is intentionally not bundled. Put secrets in ~/Library/Application Support/SurStudio/.env."
