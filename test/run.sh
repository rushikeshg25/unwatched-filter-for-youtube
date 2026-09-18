#!/usr/bin/env bash
#
# Smoke test: builds the bundle, loads it against fixture pages in headless
# Chrome and checks the filter behaves. Verifies this extension's logic, not
# that YouTube still ships the markup the fixtures imitate.
#
#   ./test/run.sh

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

port="${PORT:-8787}"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

if [ ! -x "$chrome" ]; then
  chrome="$(command -v google-chrome || command -v chromium || true)"
fi

if [ -z "$chrome" ] || [ ! -x "$chrome" ]; then
  echo "Chrome not found. Set CHROME=/path/to/chrome" >&2
  exit 2
fi

node scripts/build.mjs

python3 test/serve.py "$port" &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
sleep 1

failed=0

for fixture in grid.html no-chips.html; do
  echo "── $fixture"

  dom="$("$chrome" --headless=new --disable-gpu --no-sandbox \
    --virtual-time-budget=8000 \
    --dump-dom "http://127.0.0.1:$port/@example/videos?f=$fixture" 2>/dev/null)"

  output="$(printf '%s' "$dom" | python3 -c '
import re, sys
match = re.search(r"<pre id=\"result\">(.*?)</pre>", sys.stdin.read(), re.S)
print(match.group(1).strip() if match else "FAIL  fixture produced no result")
')"

  echo "$output"

  if printf '%s' "$output" | grep -q '^FAIL'; then
    failed=1
  fi

  # A fixture that never ran is a failure, not an absence of failures.
  if ! printf '%s' "$output" | grep -q '^PASS'; then
    echo "FAIL  $fixture produced no passing checks"
    failed=1
  fi
done

echo
if [ "$failed" -eq 0 ]; then
  echo "all checks passed"
else
  echo "checks failed" >&2
fi

exit "$failed"
