#!/usr/bin/env bash
# Get a real Chromium into a sandbox where Playwright's own download is blocked.
#
# `@sparticuz/chromium` ships a full static Chromium as a brotli file on npm — and npm is
# reachable almost everywhere a Playwright CDN is not. `al2023.tar.br` carries the NSS/NSRP
# shared objects this build links against but does not bundle.
#
# Everything lands in /tmp: a 200MB browser is not a repository artifact.
set -euo pipefail

DEST=${DEST:-/tmp/chromium-bin}
mkdir -p "$DEST"

if [ ! -f "$DEST/chromium" ]; then
  npm install --no-save @sparticuz/chromium >/dev/null 2>&1
  node - "$DEST" <<'JS'
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')
const dest = process.argv[2]
const bin = path.dirname(require.resolve('@sparticuz/chromium/package.json')) + '/bin'
fs.writeFileSync(path.join(dest, 'chromium'), zlib.brotliDecompressSync(fs.readFileSync(path.join(bin, 'chromium.br'))))
fs.chmodSync(path.join(dest, 'chromium'), 0o755)
fs.writeFileSync(path.join(dest, 'libs.tar'), zlib.brotliDecompressSync(fs.readFileSync(path.join(bin, 'al2023.tar.br'))))
JS
  mkdir -p "$DEST/lib"
  tar -xf "$DEST/libs.tar" -C "$DEST/lib" --strip-components=1 2>/dev/null || tar -xf "$DEST/libs.tar" -C "$DEST/lib"
  rm -f "$DEST/libs.tar"
fi

echo "chromium: $DEST/chromium"
echo "export PLAYWRIGHT_CHROMIUM_PATH=$DEST/chromium"
echo "export CHROMIUM_LD_LIBRARY_PATH=$DEST/lib"
