#!/usr/bin/env bash
# §5 zero placeholders — the A.1 grep, as a script so it can run in `npm run gate`.
set -uo pipefail
if [ ! -d src ]; then echo "✓ placeholders passed (no src/)"; exit 0; fi
hits=$(grep -rnE "TODO|FIXME" src/ || true)
if [ -n "$hits" ]; then
  echo "✗ placeholder markers found:"
  echo "$hits"
  exit 1
fi
echo "✓ placeholders passed (no TODO/FIXME in src/)"
