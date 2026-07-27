#!/usr/bin/env bash
# Codeply CLI installer -macOS / Linux / WSL
#   curl -fsSL https://codeply.online/install.sh | sh
set -e

if ! command -v node >/dev/null 2>&1; then
  echo "Codeply needs Node.js 18 or newer first: https://nodejs.org"
  exit 1
fi

node_major=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$node_major" -lt 18 ]; then
  echo "Codeply needs Node.js 18 or newer (you have $(node -v)): https://nodejs.org"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm wasn't found alongside node -reinstall Node.js from https://nodejs.org"
  exit 1
fi

echo "Installing Codeply..."
npm install -g codeply-cli

echo ""
echo "Codeply installed. Run 'codeply login' to get started."
