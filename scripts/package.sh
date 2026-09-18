#!/usr/bin/env bash
#
# Build the zip published on the releases page. It contains exactly what
# Chrome needs to load the extension -- no scripts, docs or git metadata.
#
#   ./scripts/package.sh  ->  yt-unwatched-v1.0.0.zip

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

version="$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")"
out="yt-unwatched-v${version}.zip"

rm -f "$out"
zip -qr "$out" manifest.json src icons -x '*.DS_Store'

echo "$out"
