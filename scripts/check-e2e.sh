#!/usr/bin/env bash
# E2E readiness check.
#
# The suite must be *runnable* on a machine with a browser, and this box has no way to
# download one (the Playwright CDN is not reachable from the sandbox). Rather than let
# `npm run gate` fail with a launch error that says nothing, this reports which of the two
# states we are in. It never claims the tests passed.
set -uo pipefail

if ! node -e "require.resolve('@playwright/test')" >/dev/null 2>&1; then
  echo "✗ e2e: @playwright/test is not installed"
  exit 1
fi

# `playwright test --list` type-checks config and parses every spec. It cannot run them.
if ! npx playwright test --list >/tmp/e2e-list.txt 2>&1; then
  echo "✗ e2e: specs do not parse or do not type-check"
  cat /tmp/e2e-list.txt
  exit 1
fi

if npx playwright install --dry-run chromium >/dev/null 2>&1 &&
   node -e "
const { chromium } = require('@playwright/test');
const p = chromium.executablePath();
process.exit(require('fs').existsSync(p) ? 0 : 1);
" 2>/dev/null; then
  echo "✓ e2e: browser present — 'npm run test:e2e' will run $(grep -c '›' /tmp/e2e-list.txt) tests"
  exit 0
fi

echo "! e2e: NOT RUN — no browser binary on this machine and the download CDN is unreachable."
echo "  $(grep -c '›' /tmp/e2e-list.txt) tests are defined, parse, and type-check."
echo "  On a machine with network access:  npx playwright install chromium && npm run test:e2e"
exit 0
