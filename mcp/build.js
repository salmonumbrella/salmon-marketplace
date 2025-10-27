import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

async function build() {
  // Build Google Calendar MCP server
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: 'dist/index.js',
    banner: {
      // Polyfill require for ESM - needed for dynamic requires in dependencies
      js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);"
    },
    external: ['util'], // Don't bundle Node built-ins
  });

  console.log('✓ Build complete: dist/index.js (Google Calendar)');

  // Build Notion MCP server
  await esbuild.build({
    entryPoints: ['src/index-sdk.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: 'dist/index-sdk.js',
    banner: {
      // Polyfill require for ESM - needed for dynamic requires in dependencies
      js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);"
    },
    external: ['util'], // Don't bundle Node built-ins
  });

  console.log('✓ Build complete: dist/index-sdk.js (Notion)');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
