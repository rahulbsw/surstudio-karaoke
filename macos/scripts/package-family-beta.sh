#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APP_ROOT="${PROJECT_ROOT}/build/SurStudio.app"
DMG_PATH="${PROJECT_ROOT}/build/SurStudio-Family-Beta-arm64.dmg"
ZIP_PATH="${PROJECT_ROOT}/build/SurStudio-Family-Beta-arm64.zip"
CHECKSUM_PATH="${PROJECT_ROOT}/build/SurStudio-Family-Beta-arm64.sha256"
STAGE_ROOT="$(mktemp -d /private/tmp/surstudio-family-beta.XXXXXX)"

cleanup() {
  rm -rf "${STAGE_ROOT}"
}
trap cleanup EXIT

"${SCRIPT_DIR}/build-app.sh"

ditto "${APP_ROOT}" "${STAGE_ROOT}/SurStudio.app"
ditto "${PROJECT_ROOT}/macos/Family-Beta-README.txt" "${STAGE_ROOT}/README-FIRST.txt"
ln -s /Applications "${STAGE_ROOT}/Applications"

rm -f "${DMG_PATH}" "${ZIP_PATH}" "${CHECKSUM_PATH}"
hdiutil create -volname "SurStudio Family Beta" -srcfolder "${STAGE_ROOT}" -ov -format UDZO "${DMG_PATH}"
ditto -c -k --sequesterRsrc --keepParent "${APP_ROOT}" "${ZIP_PATH}"

if [[ -n "${SURSTUDIO_NOTARY_PROFILE:-}" && "${SURSTUDIO_SIGN_IDENTITY:--}" != "-" ]]; then
  xcrun notarytool submit "${DMG_PATH}" --keychain-profile "${SURSTUDIO_NOTARY_PROFILE}" --wait
  xcrun stapler staple "${DMG_PATH}"
fi

(
  cd "${PROJECT_ROOT}/build"
  shasum -a 256 "$(basename "${DMG_PATH}")" "$(basename "${ZIP_PATH}")" > "$(basename "${CHECKSUM_PATH}")"
)

echo "Family beta ready:"
echo "  ${DMG_PATH}"
echo "  ${ZIP_PATH}"
echo "  ${CHECKSUM_PATH}"
