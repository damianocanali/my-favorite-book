#!/usr/bin/env bash
# scripts/ios-clean-rebuild.sh
#
# Full clean rebuild of the iOS Capacitor app. Use when you hit the
# "resource fork, Finder information, or similar detritus not allowed"
# codesign error, or any other state-corrupted iOS build failure.
#
# Run from repo root:
#   bash scripts/ios-clean-rebuild.sh
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
echo "→ Root: ${ROOT}"

echo "→ Removing dot-underscore companion files (macOS Finder metadata)"
find ios/App -name '._*' -type f -delete 2>/dev/null || true

echo "→ Making Pods tree writable (CocoaPods sets sources read-only)"
sudo chmod -R u+w ios/App/Pods 2>/dev/null || true

echo "→ Stripping ALL extended attributes from ios tree"
sudo xattr -rc ios 2>/dev/null || true

echo "→ Verifying Pods are xattr-free (should be empty below):"
xattr -lr ios/App/Pods 2>/dev/null | head -5 || true

echo "→ Wiping DerivedData (project-local + global Xcode)"
sudo rm -rf ios/DerivedData
rm -rf "${HOME}/Library/Developer/Xcode/DerivedData/App-"* 2>/dev/null || true

echo "→ Rebuilding web bundle"
npm run build

echo "→ Resyncing Capacitor"
npx cap sync ios

echo "→ Done. Now run: npx cap run ios"
