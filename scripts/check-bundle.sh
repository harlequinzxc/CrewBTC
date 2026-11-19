#!/usr/bin/env bash
# §7A bundle budget — gzip byte count per built JS file against the 200 KB budget.
set -uo pipefail
if [ ! -d dist/assets ]; then echo "✗ dist/assets not found — run the build first"; exit 1; fi
BUDGET=$((200 * 1000))
fail=0
total=0
for f in dist/assets/*.js; do
  [ -e "$f" ] || continue
  bytes=$(gzip -c "$f" | wc -c)
  total=$((total + bytes))
  if [ "$bytes" -gt "$BUDGET" ]; then
    echo "✗ $(basename "$f"): ${bytes} bytes exceeds ${BUDGET}"
    fail=1
  else
    echo "· $(basename "$f"): ${bytes} bytes"
  fi
done
echo "· total JS gzip: ${total} bytes"
[ "$fail" -eq 0 ] && echo "✓ bundle budget passed" || { echo "✗ bundle budget failed"; exit 1; }
