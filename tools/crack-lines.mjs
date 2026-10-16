// Writes src/world/doorCrackLines.js: the Door's floor cracks as lines in the
// arch's frame, for what grows in them (doorFlora.js). They come out of the
// same painting as the floor's crack map (cracks.js, crackFields), which takes
// a second and a half; the lines alone are all the flora needs, and they only
// change when the cracks' settings do (DOOR_CRACKS, build/common.js). The file
// carries a hash of those settings: when it no longer matches, doorFlora.js
// says so and works them out itself. Run after changing the cracks:
//   node tools/crack-lines.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({ root, server: { middlewareMode: true, hmr: false }, logLevel: 'error' });
try {
  const { DOOR_CRACKS } = await server.ssrLoadModule('/src/world/build/common.js');
  const { crackLines, crackKey } = await server.ssrLoadModule('/src/world/doorFlora.js');
  const t0 = performance.now();
  const lines = crackLines(DOOR_CRACKS, { fresh: true });
  // (every point at least 0.3 of a unit from the last — the runners keep one in
  // 0.55 and the tufts stand 1.5–4 apart; the painter's steps are a fortieth)
  const thin = lines.map(({ gen, pts }) => {
    const out = [];
    let last = null;
    pts.forEach((p, i) => {
      if (last && i < pts.length - 1 && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.3) return;
      out.push(+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(3));
      last = p;
    });
    return [gen, out];
  });
  const body = `// Written by tools/crack-lines.mjs — do not edit. The Door's floor cracks as
// lines in the arch's frame, [generation, [x, z, half width, ...]], for
// doorFlora.js; \`key\` is the hash of the settings they were drawn from.
export const CRACK_LINES = { key: '${crackKey(DOOR_CRACKS)}', lines: ${JSON.stringify(thin)} };
`;
  writeFileSync(join(root, 'src/world/doorCrackLines.js'), body);
  console.log(`${lines.length} lines, ${thin.reduce((n, [, p]) => n + p.length / 3, 0)} points, ${(body.length / 1024).toFixed(1)} KB, painted in ${Math.round(performance.now() - t0)} ms`);
} finally {
  await server.close();
}
