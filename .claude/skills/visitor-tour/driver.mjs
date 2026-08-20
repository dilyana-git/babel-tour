// Zero-dep CDP driver for babel-tour. Node 24+ (global WebSocket, global fetch).
//
//   SHOT_DIR=/abs/path VW=640 VH=360 node driver.mjs "$(cat steps.json)"
//
// `steps` is a JSON array run in order. Recognised keys per step:
//   open/nav <url>   open a new target / navigate the current one (wait: ms, default 13000)
//   wait <ms>        sleep before the step's other keys run
//   key <name>       dispatch a key (times, gap, mod: 8 = Shift) — see KEYS below
//   click [x,y]      press+release at a point
//   move  [x,y]      hover
//   drag  [x0,y0,x1,y1]  press -> N moves -> release (steps, gap)
//   size  [w,h]      resize the viewport
//   eval  <js>       Runtime.evaluate, awaits promises, logged as EVAL
//   settle <ms>      sleep AFTER the step's actions, before the shot
//   shot  <name>     screenshot to SHOT_DIR/<name>.png
//
// Console output and uncaught exceptions from the page are collected and printed
// at the end, which is how a stalled clip or a plate that failed to hang shows up.
import fs from 'node:fs';
import path from 'node:path';

const SHOT_DIR = process.env.SHOT_DIR || process.cwd();
const PORT = +(process.env.CDP_PORT || 9333);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(p) {
  const r = await fetch(`http://127.0.0.1:${PORT}${p}`);
  return r.json();
}

class Conn {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.sessionId = null;
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) rej(new Error(JSON.stringify(m.error)));
        else res(m.result);
      }
    });
  }

  send(method, params = {}, useSession = true) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (useSession && this.sessionId) msg.sessionId = this.sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          rej(new Error('timeout ' + method));
        }
      }, 60000);
    });
  }
}

function openWs(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => res(ws));
    ws.addEventListener('error', rej);
  });
}

const KEYS = {
  ArrowUp: { windowsVirtualKeyCode: 38, code: 'ArrowUp', key: 'ArrowUp' },
  ArrowDown: { windowsVirtualKeyCode: 40, code: 'ArrowDown', key: 'ArrowDown' },
  ArrowLeft: { windowsVirtualKeyCode: 37, code: 'ArrowLeft', key: 'ArrowLeft' },
  ArrowRight: { windowsVirtualKeyCode: 39, code: 'ArrowRight', key: 'ArrowRight' },
  Space: { windowsVirtualKeyCode: 32, code: 'Space', key: ' ', text: ' ' },
  Enter: { windowsVirtualKeyCode: 13, code: 'Enter', key: 'Enter', text: '\r' },
  Escape: { windowsVirtualKeyCode: 27, code: 'Escape', key: 'Escape' },
  Tab: { windowsVirtualKeyCode: 9, code: 'Tab', key: 'Tab' },
  KeyH: { windowsVirtualKeyCode: 72, code: 'KeyH', key: 'h', text: 'h' },
  KeyM: { windowsVirtualKeyCode: 77, code: 'KeyM', key: 'm', text: 'm' },
  KeyQ: { windowsVirtualKeyCode: 81, code: 'KeyQ', key: 'q', text: 'q' },
  Slash: { windowsVirtualKeyCode: 191, code: 'Slash', key: '/', text: '/' },
};

async function main() {
  const steps = JSON.parse(process.argv[2]);
  const ver = await getJson('/json/version');
  const bws = await openWs(ver.webSocketDebuggerUrl);
  const browser = new Conn(bws);

  const targets = (await browser.send('Target.getTargets', {}, false))
    .targetInfos.filter((t) => t.type === 'page' && !t.url.startsWith('devtools'));
  const wanted = steps.find((s) => s.open);
  let targetId;
  if (wanted) {
    targetId = (await browser.send('Target.createTarget', { url: wanted.open }, false)).targetId;
  } else if (targets.length) {
    targetId = targets.find((t) => t.url.includes('localhost'))?.targetId || targets[0].targetId;
  } else {
    targetId = (await browser.send('Target.createTarget', { url: 'about:blank' }, false)).targetId;
  }
  const att = await browser.send('Target.attachToTarget', { targetId, flatten: true }, false);
  browser.sessionId = att.sessionId;
  const c = browser;

  await c.send('Page.enable');
  await c.send('Runtime.enable');
  const logs = [];
  bws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push(m.params.args
        .map((a) => a.value ?? a.description ?? JSON.stringify(a.preview?.properties))
        .join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description
        || m.params.exceptionDetails.text));
    }
  });

  // Small on purpose — see SKILL.md. A large viewport starves rAF under
  // swiftshader and the page renders blank no matter how long you wait.
  const W = +(process.env.VW || 640);
  const H = +(process.env.VH || 360);
  await c.send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  for (const s of steps) {
    // Applied before any navigation in the same step, so a throttled load is
    // throttled from its first byte. `{down, up}` are BYTES/sec, latency is ms;
    // `{"throttle":{}}` is a slow-3G-ish default. This is the only way to see
    // states that only exist while the piece is still loading — the arriving
    // whisper, the entry veil's progress — since on localhost everything lands
    // too fast to observe. Pass `{"throttle":null}` to lift it again.
    if ('throttle' in s) {
      await c.send('Network.enable');
      // Without this the second run of a throttled test serves everything from
      // the disk cache and loads instantly — the throttle appears to do nothing
      // and the loading state you came to see never happens.
      await c.send('Network.setCacheDisabled', { cacheDisabled: s.throttle !== null });
      await c.send('Network.emulateNetworkConditions', s.throttle === null
        ? { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }
        : {
          offline: false,
          latency: s.throttle.latency ?? 400,
          downloadThroughput: s.throttle.down ?? 50 * 1024,
          uploadThroughput: s.throttle.up ?? 20 * 1024,
        });
    }
    // open/nav consume `wait` as their load pause and then fall THROUGH to the
    // rest of the step — an `open` step carrying a `shot` must still take it.
    if (s.open) {
      await sleep(s.wait ?? 13000);
    } else if (s.nav) {
      await c.send('Page.navigate', { url: s.nav });
      await sleep(s.wait ?? 13000);
    } else if (s.wait) {
      await sleep(s.wait);
    }
    if (s.key) {
      const k = KEYS[s.key];
      if (!k) throw new Error('unknown key: ' + s.key);
      for (let i = 0; i < (s.times ?? 1); i++) {
        await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: s.mod ?? 0, ...k });
        if (k.text) await c.send('Input.dispatchKeyEvent', { type: 'char', modifiers: s.mod ?? 0, ...k });
        await c.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: s.mod ?? 0, ...k });
        await sleep(s.gap ?? 250);
      }
    }
    if (s.click) {
      const [x, y] = s.click;
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', clickCount: 0 });
      await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await sleep(60);
      await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
    if (s.move) {
      const [x, y] = s.move;
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
    }
    if (s.drag) {
      const [x0, y0, x1, y1] = s.drag;
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0, button: 'none' });
      await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
      const N = s.steps ?? 14;
      for (let i = 1; i <= N; i++) {
        await c.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: x0 + (x1 - x0) * i / N,
          y: y0 + (y1 - y0) * i / N,
          button: 'left',
        });
        await sleep(s.gap ?? 30);
      }
      await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 });
    }
    if (s.size) {
      await c.send('Emulation.setDeviceMetricsOverride',
        { width: s.size[0], height: s.size[1], deviceScaleFactor: 1, mobile: false });
    }
    if (s.eval) {
      try {
        const r = await c.send('Runtime.evaluate',
          { expression: s.eval, returnByValue: true, awaitPromise: true });
        console.log('EVAL ' + s.eval.slice(0, 60) + ' => ' + JSON.stringify(r.result?.value ?? r.result?.description));
      } catch (e) {
        console.log('EVAL ERR ' + e.message);
      }
    }
    if (s.settle) await sleep(s.settle);
    if (s.shot) {
      const r = await c.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(SHOT_DIR, s.shot + '.png'), Buffer.from(r.data, 'base64'));
      console.log('SHOT ' + s.shot);
    }
  }
  if (logs.length) console.log('--- console ---\n' + logs.slice(-40).join('\n'));
  bws.close();
  process.exit(0);
}

main().catch((e) => { console.error('FAIL', e); process.exit(1); });
