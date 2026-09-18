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
