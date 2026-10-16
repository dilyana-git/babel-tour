// The galleries' ashlar (2026-10-15, audit V, board 3 point 1, "patchwork
// ashlar"). The course height was right; the tone was not. Every block had its
// own value, one whole step of 18 either way and some two, from near-black to
// pale tan, laid side by side at random: a wall read as a quilt or a test
// card, in the Vestibule, the Silence and the Echo alike. Stone from one
// quarry varies by a few percent in tone and much more in its surface. So the
// spread between blocks is a third of what it was, and what varies now is the
// surface, where a wall's years go:
//   1  the tone: each block's value and hue a third of the spread it had, and
//      the shader's slow unevenness (the `aged` patches, the Echo's `worked`
//      stone) a third of its too
//   2  the arrises weathered: every block's edges worn back and rounded,
//      unevenly, most along its top (textures.js `ashlar`, `arris`)
//   3  the beds under projecting courses darker: the dust and smoke that
//      gather in the lee of a cornice or a string course (stoneShade)
//   4  soot over the lamps: a tongue of it rising up the stone from every lamp
//      that hangs or stands against a wall (stoneShade)
import * as THREE from 'three';

const ONLY = null;
export const ashlarOld = (n) => (ONLY ? ONLY.has(String(n)) : false);

// `spread`: a block's value either way of the wall's (18 before); the hue
// goes with it (textures.js). `tone`: what is left of the shader's slow
// unevenness. `arris`: how much the arrises are worn (0: as they were).
// `bed`: the beds — how much darker at the full (`k`), the height that falls
// to a third in (`fall`), how far down it may reach at most (`reach`).
// `soot`: how dark a tongue is at the full (`k`), the height it falls to a
// third in (`rise`), how wide it begins and how much wider for each unit up
// (`width`).
export const ASHLAR = {
  spread: 6,
  tone: 1 / 3,
  arris: 1,
  bed: { k: 0.34, fall: 3.6, reach: 14 },
  soot: { k: 0.5, rise: 16, width: [1.4, 0.28] },
  // the Vestibule's string course: its lamp-rail's lamps, one every `pitch`
  rail: { k: 0.42, pitch: 9 },
};
export const ASHLAR_ON = {
  tone: true, arris: true, beds: true, soot: true,
};

// The courses that stand proud round a room's middle, and the lamps against
// the stone, filled in by the rooms as they are built and read by every
// stone's shader. A fixed number of each (a shader's arrays are), the unused
// ones left at zero strength. Keyed by where they are, so a second build of
// the world does not count them twice.
export const LEDGES_MAX = 6, SOOT_MAX = 24;
// a course: [x, z, y of its bed, strength], and the radii of the faces under it [from, to]
export const ledgeU = { value: Array.from({ length: LEDGES_MAX }, () => new THREE.Vector4()) };
export const ledgeRU = { value: Array.from({ length: LEDGES_MAX }, () => new THREE.Vector2()) };
// [x, y, z of the lamp's top, strength]
export const sootU = { value: Array.from({ length: SOOT_MAX }, () => new THREE.Vector4()) };
const ledges = new Map(), soots = new Map();
const key = (a) => a.map((v) => v.toFixed(1)).join(',');

// A course standing proud of the face all round a room's middle (the Echo's
// cornices over its arcades): the faces from radius `r0` to `r1` under the
// bed at `y` darken toward it.
export function ringLedge([x, z], y, r0, r1, k = 1) {
  if (!ASHLAR_ON.beds) return;
  const id = key([x, z, y, r0, r1]);
  if (ledges.has(id) || ledges.size >= LEDGES_MAX) return;
  const i = ledges.size;
  ledges.set(id, i);
  ledgeU.value[i].set(x, z, y, k);
  ledgeRU.value[i].set(r0, r1);
}

// A lamp burning against the stone: soot rises from `[x, y, z]`, its top.
export function sootOver([x, y, z], k = 1) {
  if (!ASHLAR_ON.soot) return;
  const id = key([x, y, z]);
  if (soots.has(id) || soots.size >= SOOT_MAX) return;
  soots.set(id, soots.size);
  sootU.value[soots.size - 1].set(x, y, z, k);
}
