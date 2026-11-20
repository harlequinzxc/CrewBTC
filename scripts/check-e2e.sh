#!/usr/bin/env bash
# Run the real-browser suite, or say plainly that it could not run.
#
# This box has no Playwright-managed browser and cannot reach its download CDN, so a bare
# `playwright test` fails with "Executable doesn't exist" — an error that says nothing about
# the code. `scripts/fetch-chromium.sh` gets a real Chromium from npm instead; if neither is
# available, this reports NOT RUN with the test count and exits 0. It never claims a pass.
set -uo pipefail

if ! node -e "require.resolve('@playwright/test')" >/dev/null 2>&1; then
  echo "✗ e2e: @playwright/test is not installed"
  exit 1
fi

if ! npx playwright test --list >/tmp/e2e-list.txt 2>&1; then
  echo "✗ e2e: specs do not parse or do not type-check"
  cat /tmp/e2e-list.txt
  exit 1
fi
COUNT=$(grep -c '›' /tmp/e2e-list.txt || true)

if [ -z "${PLAYWRIGHT_CHROMIUM_PATH:-}" ]; then
  if node -e "
const { chromium } = require('@playwright/test');
process.exit(require('fs').existsSync(chromium.executablePath()) ? 0 : 1);
" 2>/dev/null; then
    :
  elif [ -x /tmp/chromium-bin/chromium ]; then
    export PLAYWRIGHT_CHROMIUM_PATH=/tmp/chromium-bin/chromium
    export CHROMIUM_LD_LIBRARY_PATH=/tmp/chromium-bin/lib
  else
    echo "! e2e: NOT RUN — no browser binary on this machine and the download CDN is unreachable."
    echo "  $COUNT tests are defined, parse, and type-check."
    echo "  To run them:  bash scripts/fetch-chromium.sh   then   npm run test:e2e"
    exit 0
  fi
fi

if npx playwright test; then
  echo "✓ e2e: $COUNT tests passed in a real browser"
else
  echo "✗ e2e: the real-browser suite failed"
  exit 1
fi
