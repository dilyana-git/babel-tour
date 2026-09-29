import { platesOf } from './backdrops.js';

// A failed or stalled plate must not be committed as a ready scene.
export const decodePlates = (scene) => Promise.all(platesOf(scene).map(
  (src) => new Promise((resolve) => {
    const img = new Image();
    let finished = false;
    const finish = (ready) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ready);
    };
    const timer = setTimeout(() => finish(false), 30000);
    img.onerror = () => finish(false);
    if (!img.decode) img.onload = () => finish(true);
    img.src = src;
    if (img.decode) img.decode().then(() => finish(true), () => finish(false));
  }),
)).then((results) => results.every(Boolean));
