import assert from 'node:assert/strict';
import { decodePlates } from '../src/plateLoad.js';

class DecodingImage {
  set src(value) { this.url = value; }
  decode() {
    return this.url.includes('broken') ? Promise.reject(new Error('decode failed')) : Promise.resolve();
  }
}

globalThis.Image = DecodingImage;
assert.equal(await decodePlates({ color: '/healthy.webp', depth: '/healthy-depth.webp' }), true);
assert.equal(await decodePlates({ color: '/broken.webp', depth: '/healthy-depth.webp' }), false);

class LegacyImage {
  set src(value) {
    queueMicrotask(() => (value.includes('broken') ? this.onerror : this.onload)?.());
  }
}

globalThis.Image = LegacyImage;
assert.equal(await decodePlates({ color: '/healthy.webp', depth: '/healthy-depth.webp' }), true);
assert.equal(await decodePlates({ color: '/broken.webp', depth: '/healthy-depth.webp' }), false);
delete globalThis.Image;
console.log('plate decoding accepts complete scenes and rejects failed images');
