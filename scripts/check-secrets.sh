#!/usr/bin/env bash
# §5 secrets hygiene — the A.1 grep, as a script so it can run in `npm run gate`.
set -uo pipefail
hits=$(grep -rnE "(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY)" --include='*.ts' --include='*.tsx' --include='*.json' src public 2>/dev/null || true)
if [ -n "$hits" ]; then
  echo "✗ credential-shaped strings found:"
  echo "$hits"
  exit 1
fi
echo "✓ secrets passed (no credential-shaped strings in src/ or public/)"
