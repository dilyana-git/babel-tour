// One painter: paints what it is sent (paintJobs.js) on OffscreenCanvases and
// sends back the pixels. Started by paint.js; several run at once. `took` is
// how long the painting and the reading back each took, in milliseconds.
import { PAINTERS, readMaps } from './paintJobs';

self.onmessage = ({ data: { id, name, args } }) => {
  try {
    if (typeof OffscreenCanvas === 'undefined') throw new Error('no OffscreenCanvas in this worker');
    const t0 = performance.now();
    const set = PAINTERS[name].paint(args);
    const t1 = performance.now();
    const { maps, transfer } = readMaps(set);
    self.postMessage({ id, maps, took: [Math.round(t1 - t0), Math.round(performance.now() - t1)] }, transfer);
  } catch (error) {
    self.postMessage({ id, error: String(error?.message ?? error) });
  }
};
