// The opening's drawing (ink.js) in a worker, on the canvas Assembly.jsx hands
// it: the first message starts it, every other one is passed on to it.
import { startInk } from './ink';

let ink = null;
self.onmessage = ({ data: { start, ...told } }) => {
  if (start) ink = startInk(start.canvas, start, (m) => self.postMessage(m));
  else ink?.set(told);
};
