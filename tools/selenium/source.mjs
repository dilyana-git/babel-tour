import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Hash served assets and executable/configuration inputs, excluding the video
// archive that the production build deliberately drops. Content hashes avoid
// treating metadata-only filesystem notifications as a different application.
export async function sourceFingerprint(root = process.cwd()) {
  const files = [];
  const collect = async (relative) => {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = `${relative}/${entry.name}`;
      if (relative === 'public' && entry.name.startsWith('video')) continue;
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile() && !/\.(mp4|webm|mov|m4v)$/i.test(path)) files.push(path);
    }
  };
  for (const path of ['src', 'tools', 'public']) await collect(path);
  files.push('package.json', 'package-lock.json', 'vite.config.js', 'index.html',
    'AGENTS.md', '.github/workflows/navigation.yml');
  const hashes = {};
  for (const file of files.sort()) hashes[file] = createHash('sha256').update(await readFile(join(root, file))).digest('hex');
  return { capturedAt: new Date().toISOString(),
    hash: createHash('sha256').update(JSON.stringify(hashes)).digest('hex'), files: hashes };
}
