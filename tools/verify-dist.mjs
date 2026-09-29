#!/usr/bin/env node
// Verify the folder that will actually be uploaded, after Vite's video filter.
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const pub = join(root, 'public');
const failures = [];

const files = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
};

if (!existsSync(join(dist, 'index.html'))) failures.push('dist/index.html is missing');
for (const name of ['favicon.svg', 'og-card.jpg', 'overture-poster.jpg']) {
  if (!existsSync(join(dist, name))) failures.push(`dist/${name} is missing`);
}

const built = files(dist);
const builtNames = new Set(built.map((path) => relative(dist, path).replaceAll('\\', '/')));
for (const path of files(join(pub, 'nodes'))) {
  const name = relative(pub, path).replaceAll('\\', '/');
  if (!builtNames.has(name)) failures.push(`dist/${name} is missing`);
}
for (const name of builtNames) {
  if (name.split('/').some((part) => part.startsWith('video'))
      || /\.(mp4|webm|mov|m4v)$/i.test(name)) {
    failures.push(`archived video shipped: dist/${name}`);
  }
}

if (builtNames.has('index.html')) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  for (const [, url] of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
    const name = url.slice(1);
    if (!builtNames.has(name)) failures.push(`index.html references missing ${name}`);
  }
}

const bytes = built.reduce((sum, path) => sum + statSync(path).size, 0);
console.log(`dist: ${built.length} files, ${(bytes / 1_000_000).toFixed(1)} MB, no video`);
if (failures.length) {
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
} else console.log('deployment artifact verified');
