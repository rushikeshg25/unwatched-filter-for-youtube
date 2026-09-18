/** Minimal assertion helper for the fixture pages. */
globalThis.T = {
  results: [],

  is(name, actual, expected) {
    const ok = String(actual) === String(expected);
    const detail = ok
      ? ''
      : `  (got ${JSON.stringify(String(actual))}, want ${JSON.stringify(String(expected))})`;
    this.results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail}`);
  },

  done() {
    document.getElementById('result').textContent = this.results.join('\n');
  },
};

/**
 * A fixture that throws used to leave the page at its placeholder text,
 * which the runner happily accepted as "no failures". Report the crash as a
 * failure instead -- the whole point of the suite is that it can fail.
 */
globalThis.addEventListener('error', (event) => {
  const line = `FAIL  fixture threw: ${event.message}`;
  globalThis.T.results.push(line);
  const target = document.getElementById('result');
  if (target) target.textContent = globalThis.T.results.join('\n');
});
