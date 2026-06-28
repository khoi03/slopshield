import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  clean: true,
  minify: false,
  sourcemap: false,
  // Bundle everything (incl. JSON data) into a single dist/cli.js so the
  // published bin is self-contained and has zero runtime dependencies.
  banner: {
    js: '#!/usr/bin/env node',
  },
});
