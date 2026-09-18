#!/usr/bin/env bash
#
# Build the zip published on the releases page. It contains exactly what
# Chrome needs to load the extension -- no scripts, docs or git metadata.
#
#   ./scripts/package.sh  ->  unwatched-filter-for-youtube-v1.1.0.zip

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

node scripts/build.mjs

version="$(node -p "require('./manifest.json').version")"
out="unwatched-filter-for-youtube-v${version}.zip"

rm -f "$out"
zip -qr "$out" manifest.json dist icons -x '*.DS_Store'

echo "$out"
