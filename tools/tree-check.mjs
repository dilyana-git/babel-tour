import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Wood, growTree } from '../src/world/trees.js';
import { makeRng } from '../src/world/textures.js';

// Growth and leaf-colour draws are shared by established plantings. A wood
// refinement must leave those draws and the existing foliage untouched.
const planting = JSON.parse(readFileSync(new URL('./fixtures/tree-planting.json', import.meta.url)));
for (const fixture of planting) {
  const { species, detail, seed, weepingSeed } = fixture;
  test(`${species}, ${weepingSeed ? 'weeping' : fixture.spire ? 'spire' : detail ? 'near' : 'distant'}: wood keeps the established planting stream and foliage`, () => {
    const source = makeRng(seed);
    let draws = 0;
    const grown = growTree(species, () => { draws++; return source(); }, { tube() {} }, {
      ...fixture, weeping: weepingSeed ? makeRng(weepingSeed) : null,
    });
    assert.equal(draws, fixture.draws);
    assert.equal(source(), fixture.next);
    assert.equal(createHash('sha256').update(JSON.stringify(grown)).digest('hex'), fixture.foliage);
  });
}

const distanceTo = (nodes, p) => {
  let distance = Infinity;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1].p, edge = nodes[i].p.clone().sub(a);
    const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(edge) / Math.max(1e-8, edge.lengthSq())));
    distance = Math.min(distance, a.clone().addScaledVector(edge, t).distanceTo(p));
  }
  return distance;
};

for (const species of ['broad', 'pine', 'maple', 'cherry', 'willow', 'cedar']) {
  test(`${species}: curved limbs stay joined and long spreading boughs have no straight centre line`, () => {
    let spreading = 0;
    for (const seed of [17, 503, 12031, 94400]) {
      const paths = [];
      growTree(species, makeRng(seed), { tube: (nodes) => paths.push(nodes) }, { H: 60, S: 30, detail: true });
      for (let i = 1; i < paths.length; i++) {
        const nodes = paths[i], a = nodes[0].p, b = nodes.at(-1).p;
        const gap = Math.min(...paths.slice(0, i).map((path) => distanceTo(path, a)));
        assert(gap < 0.15, `seed ${seed}, limb ${i} detached by ${gap}`);
        const length = a.distanceTo(b);
        if (length <= 8 || Math.hypot(b.x - a.x, b.z - a.z) <= length * 0.5) continue;
        spreading++;
        const bend = Math.max(...nodes.map(({ p }) => distanceTo([{ p: a }, { p: b }], p)));
        assert(bend > length * 0.009, `seed ${seed}, limb ${i} is still a straight spoke`);
      }
    }
    assert(spreading > 0, 'the specimens must exercise spreading boughs');
  });

  test(`${species}: small and tall specimens have finite, repeatable bark geometry and unit normals`, () => {
    for (const H of [26, 60, 160]) {
      const options = { H, S: H * 0.5, detail: H < 100 };
      const wood = new Wood(), again = new Wood();
      growTree(species, makeRng(1701), wood, options);
      growTree(species, makeRng(1701), again, options);
      assert.deepEqual(wood.pos, again.pos);
      assert(wood.pos.length > 0);
      for (const data of [wood.pos, wood.nor, wood.uv, wood.col]) assert(data.every(Number.isFinite));
      assert.equal(wood.nor.length, wood.pos.length);
      for (let i = 0; i < wood.nor.length; i += 3) {
        assert(Math.abs(Math.hypot(...wood.nor.slice(i, i + 3)) - 1) < 1e-5);
      }
      for (const index of wood.idx) assert(index >= 0 && index < wood.pos.length / 3);
    }
  });
}
