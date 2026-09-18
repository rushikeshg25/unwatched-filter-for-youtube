/**
 * Bundle the TypeScript sources into what Chrome loads.
 *
 * Content scripts cannot use ES module imports, so the sources are bundled
 * into a single IIFE. Nothing is minified: an extension that reads the page
 * you are signed into should stay readable to whoever wants to check it.
 *
 *   node scripts/build.mjs [--watch]
 */

import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const context = await esbuild.context({
  entryPoints: ['src/content.ts', 'src/content.css'],
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
});

if (watch) {
  await context.watch();
  console.log('watching src/ ...');
} else {
  await context.rebuild();
  await context.dispose();
}
