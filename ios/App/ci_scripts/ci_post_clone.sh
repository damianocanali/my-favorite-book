#!/bin/sh

set -e

# Install Homebrew if missing
if ! command -v brew &>/dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install Node.js
brew install node

cd "$CI_PRIMARY_REPOSITORY_PATH"

# Install npm dependencies (Capacitor pods use local node_modules paths)
npm install

# Build web assets (generates dist/)
npm run build

# Copy web assets + generate capacitor.config.json and public/ into ios/App/App
npx cap sync ios

# Install CocoaPods dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"
pod install
