import { assert, waitUntil, viewport } from './browser.mjs';

const ROOMS = ['The Vestibule', 'The Echo', 'The Silence', 'The Vertigo',
  'The Door', 'The Fork', 'The Pavilion', 'The Web of Time'];
const SPEED = 12;
const TIMEOUT = 120000;
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

// Hooks below only observe state or alter the dev clock. No jump/scrub/stroll
// hook is used to complete an input journey. Geometry sweeps are a separate test.
export function createNavigationDriver(driver, baseUrl, { mutation, onStep = async () => {} } = {}) {
  const read = () => driver.executeScript(() => ({
    walk: window.__worldWalk?.(),
    title: document.querySelector('#room-title')?.textContent.trim() ?? null,
    hud: !!document.querySelector('.room-hud'),
    moving: !!document.querySelector('.room-hud.is-moving'),
    finale: !!document.querySelector('.room-hud.is-finale'),
    map: !!document.querySelector('.entry-map.is-world:not(.is-in-room)'),
    status: document.querySelector('.map-status')?.textContent ?? '',
  }));
  const speed = (value) => driver.executeScript('window.__worldSpeed = arguments[0]', value);
  const key = (key, type = 'rawKeyDown') => driver.sendDevToolsCommand('Input.dispatchKeyEvent', {
    type, key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0)
      : { Tab: 9, Enter: 13, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 }[key],
  });
  const tapKey = async (value) => { await key(value); await key(value, 'keyUp'); };
  const room = async (index, up = false) => {
    await waitUntil(driver, async () => {
      const s = await read();
      const visibleHud = await driver.executeScript(() => {
        const hud = document.querySelector('.room-hud');
        if (!hud) return false;
        return Number(getComputedStyle(hud).opacity) > 0.99;
      });
      return s.title === ROOMS[index] && s.walk?.place === index && s.walk?.target === index
        && s.walk?.up === up && !s.walk?.move && !s.moving && visibleHud;
    }, `Did not arrive and settle in ${ROOMS[index]}${up ? ' at its vantage' : ''}`, TIMEOUT);
    return read();
  };
  const map = async (timeout = TIMEOUT) => {
    await waitUntil(driver, () => driver.executeScript(() => {
      const w = window.__worldWalk?.();
      const card = document.querySelector('.map-card');
      return !!document.querySelector('.entry-map.is-world:not(.is-in-room)')
        && !document.querySelector('.room-hud') && w?.place === null && w?.target === null && !w?.move
        && card && Number(getComputedStyle(card).opacity) > 0.99;
    }), 'Map did not return to a settled, usable state', timeout);
  };
  const enabled = (selector) => driver.executeScript((selector) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Missing ${selector}`);
    return !el.disabled;
  }, selector);
  const click = async (selector) => {
    await waitUntil(driver, () => enabled(selector), `${selector} stayed disabled`, TIMEOUT);
    const p = await point(selector);
    await driver.sendDevToolsCommand('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount: 1 });
    await driver.sendDevToolsCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p, button: 'left', clickCount: 1 });
  };
  const backToMap = async () => { await click('.room-map'); await map(); };
  const choose = async (index) => {
    await map();
    assert.equal(await driver.executeScript('return document.querySelectorAll(".map-room").length'), ROOMS.length,
      'All eight map room controls must exist');
    // Navigate focus through the actual Tab order, without retaining handles
    // to React elements that can be replaced during the map's assembly.
    let focused = false;
    for (let n = 0; n < 20; n++) {
      focused = await driver.executeScript((name) => document.activeElement?.classList.contains('map-room')
        && document.activeElement.getAttribute('aria-label')?.includes(`: ${name} —`), ROOMS[index]);
      if (focused) break;
      await tapKey('Tab');
    }
    assert(focused, `Cannot reach ${ROOMS[index]} through the map's Tab order`);
    await tapKey('Enter');
    await room(index);
  };
  const point = (selector) => driver.executeScript((selector) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Missing ${selector}`);
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector);
  const touch = (type, p) => driver.sendDevToolsCommand('Input.dispatchTouchEvent', {
    type, touchPoints: p ? [{ ...p, id: 0, radiusX: 2, radiusY: 2 }] : [],
  });
  const tap = async (selector) => {
    const p = await point(selector);
    await touch('touchStart', p); await touch('touchEnd');
  };
  const stopped = async () => {
    await waitUntil(driver, async () => {
      const w = (await read()).walk;
      return w?.hand === 0 && w.body && Math.abs(w.body.speed) < 0.05;
    }, 'Releasing the movement key did not stop the feet', TIMEOUT);
    const before = (await read()).walk;
    await waitUntil(driver, async () => (await read()).walk.frame >= before.frame + 6,
      'No frames rendered after stopping', TIMEOUT);
    const after = (await read()).walk;
    assert(distance(before.body.feet, after.body.feet) < 0.4,
      `Feet kept moving after release: ${JSON.stringify({ before, after })}`);
    return after;
  };
  const heldWalk = async (value, dir) => {
    await speed(1);
    const before = await read();
    const origin = before.walk.body?.feet ?? [before.walk.camera[0], 0, before.walk.camera[2]];
    await key(value);
    try {
      await waitUntil(driver, async () => {
        const w = (await read()).walk;
        return w?.hand === dir && w.body && Math.hypot(w.body.feet[0] - origin[0], w.body.feet[2] - origin[2]) > 1;
      }, `Holding ${value} did not move the feet`, TIMEOUT);
    } finally { await key(value, 'keyUp'); }
    await onStep(`released ${value}`);
    await speed(SPEED);
    return stopped();
  };
  const load = async ({ mobile = false, reduced = false } = {}) => {
    // An initial about:blank page has no mobile viewport meta tag and can
    // report a 980px layout viewport. Verify the actual app after loading it.
    await viewport(driver, mobile ? 390 : 960, mobile ? 844 : 640, { verify: false });
    await driver.sendDevToolsCommand('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });
    await driver.sendDevToolsCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }],
    });
    // Reduce raster cost only; retain all rooms, floors, walls and navigation.
    await driver.get(`${baseUrl}/?dpr=0.5`);
    await driver.sendDevToolsCommand('Page.bringToFront');
    await waitUntil(driver, () => driver.executeScript(() =>
      !!document.querySelector('.entry-map.is-world') && typeof window.__worldWalk === 'function'),
    'The live map/navigation diagnostics never became ready', 180000);
    const actual = await driver.executeScript('return [innerWidth, innerHeight]');
    assert.deepEqual(actual, mobile ? [390, 844] : [960, 640], 'The application viewport did not match the test profile');
    await speed(SPEED);
    if (mutation === 'drop-forward') {
      await driver.executeScript(() => document.addEventListener('click', (event) => {
        if (event.target.closest('.room-step.is-on')) {
          event.preventDefault(); event.stopImmediatePropagation();
        }
      }, true));
    }
    await map();
  };

  // Establish each scenario's own starting point through the real map controls.
  // A stuck preceding scenario is recovered by a new page, never a teleport.
  const prepare = async (index = null) => {
    const state = await read().catch(() => null);
    if (!state?.walk || state.moving || state.finale
      || await driver.executeScript('return matchMedia("(pointer: coarse)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches')) {
      await load();
    } else {
      for (const value of ['w', 's', 'a', 'd', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) await key(value, 'keyUp');
      await speed(SPEED);
      if (state.walk.place !== null) await backToMap();
      else await map();
    }
    if (index !== null) await choose(index);
  };

  return { read, speed, key, tapKey, room, map, enabled, click, backToMap, choose, point, touch, tap, stopped, heldWalk, load, prepare, onStep };
}

export function navigationScenarios(driver, baseUrl, options = {}) {
  const { read, speed, key, tapKey, room, map, enabled, click, backToMap, choose, point, touch, tap, stopped, heldWalk, load, prepare, onStep } = createNavigationDriver(driver, baseUrl, options);

  return [
    ['normal entry and first-room boundary', async () => {
      await load();
      assert.equal(await driver.executeScript('return matchMedia("(prefers-reduced-motion: reduce)").matches'), false);
      await click('.map-enter');
      await room(0);
      assert.equal(await enabled('.room-step.is-back'), false,
        'Back must be disabled in the first room');
    }],
    ['held W/S, key release, and blur recovery', async () => {
      await prepare(0);
      await speed(1);
      const forward = await heldWalk('w', 1);
      const backward = await heldWalk('s', -1);
      assert(distance(forward.body.feet, backward.body.feet) > 0.8, 'S did not move back');
      await onStep('starting blur recovery');
      await speed(1);
      await key('w');
      await waitUntil(driver, async () => (await read()).walk.hand === 1, 'W never became held');
      // Use a real tab focus change, as when a reader leaves the application.
      const original = await driver.getWindowHandle();
      try {
        await driver.switchTo().newWindow('tab');
        await driver.get('about:blank');
        await driver.sendDevToolsCommand('Page.bringToFront');
        assert.equal(await driver.executeScript('return document.hasFocus()'), true, 'The other tab never received focus');
        await driver.executeAsyncScript(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      } finally {
        await driver.switchTo().window(original);
        await driver.sendDevToolsCommand('Page.bringToFront');
      }
      await onStep('returned from other tab');
      try {
        await waitUntil(driver, async () => (await read()).walk?.hand === 0,
          'Leaving the tab did not release the held movement key', TIMEOUT);
      } finally { await key('w', 'keyUp'); }
      await speed(SPEED);
      await stopped();
      await speed(SPEED);
      await backToMap();
      await choose(0);
    }],
    ['turn, tilt, drag, and key release', async () => {
      await prepare(0);
      const heldLook = async (value, field, sign, held) => {
        const before = (await read()).walk.look[field];
        await key(value);
        try {
          await waitUntil(driver, async () => sign * ((await read()).walk.look[field] - before) > 0.04,
            `${value} did not change ${field}`, TIMEOUT);
        } finally { await key(value, 'keyUp'); }
        await waitUntil(driver, async () => !(await read()).walk.look.keys[held], `${value} stayed held`);
        const released = (await read()).walk;
        await waitUntil(driver, async () => (await read()).walk.frame >= released.frame + 4, 'View stopped rendering', TIMEOUT);
        assert(Math.abs((await read()).walk.look[field] - released.look[field]) < 0.002, `${value} kept turning after release`);
      };
      await heldLook('a', 'yaw', 1, 'left');
      await heldLook('d', 'yaw', -1, 'right');
      await heldLook('ArrowUp', 'pitch', 1, 'up');
      await heldLook('ArrowDown', 'pitch', -1, 'down');
      const before = (await read()).walk.look.yaw;
      const p = await point('.map-stage');
      await driver.sendDevToolsCommand('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount: 1 });
      try {
        for (let n = 1; n <= 6; n++) await driver.sendDevToolsCommand('Input.dispatchMouseEvent', {
          type: 'mouseMoved', x: p.x + n * 10, y: p.y, button: 'left', buttons: 1,
        });
      } finally {
        await driver.sendDevToolsCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x + 60, y: p.y, button: 'left', clickCount: 1 });
      }
      assert(Math.abs((await read()).walk.look.yaw - before) > 0.1, 'Dragging did not turn the view');
      await backToMap(); await choose(0);
    }],
    ['rapid repeated input does not skip rooms', async () => {
      await prepare(0);
      await speed(1);
      const p = await point('.room-step.is-on');
      for (let n = 0; n < 4; n++) {
        await driver.sendDevToolsCommand('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount: 1 });
        await driver.sendDevToolsCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p, button: 'left', clickCount: 1 });
      }
      // CDP acknowledges input before React's destination reaches the live
      // scene. Observe the committed frame before asserting the destination.
      const frame = (await read()).walk.frame;
      await waitUntil(driver, async () => (await read()).walk.frame >= frame + 2,
        'No rendered frames after the repeated clicks', TIMEOUT);
      assert.equal((await read()).walk.target, 1, 'Repeated clicks changed the destination more than once');
      assert.equal(await enabled('.room-map'), false, 'Map stayed enabled during travel');
      assert.equal(await enabled('.room-step.is-back'), false, 'Back stayed enabled during travel');
      await speed(SPEED);
      await room(1);
    }],
    ['combined walking and looking releases both inputs safely', async () => {
      await prepare(0); await speed(1);
      await key('w');
      try {
        await waitUntil(driver, async () => (await read()).walk.body?.speed > 2, 'Forward movement did not start', TIMEOUT);
        const before = (await read()).walk;
        await key('ArrowLeft');
        try {
          await waitUntil(driver, async () => (await read()).walk.look.yaw - before.look.yaw > 0.2,
            'Could not look while walking', TIMEOUT);
        } finally { await key('ArrowLeft', 'keyUp'); }
        const together = (await read()).walk;
        assert.equal(together.hand, 1);
        assert(together.body.feet.every(Number.isFinite));
        assert(distance(before.body.feet, together.body.feet) > 0.3, 'Looking interrupted all movement');
      } finally { await key('w', 'keyUp'); }
      await speed(SPEED); await stopped();
      assert.equal((await read()).walk.look.keys.left, false, 'Looking stayed held after key release');
    }],
    ['held W reaches every library room along the default route', async () => {
      await prepare(0); await speed(SPEED);
      await key('w');
      try {
        for (const index of [1, 2, 3]) {
          await waitUntil(driver, async () => (await read()).walk.place === index,
            `Held W did not reach ${ROOMS[index]}`, 180000);
          await onStep(`held W entered ${ROOMS[index]}`);
        }
      } finally { await key('w', 'keyUp'); }
      await stopped();
    }],
    ['held W reaches every garden room along the default route', async () => {
      await prepare(4); await speed(SPEED);
      await key('w');
      try {
        for (const index of [5, 6, 7]) {
          await waitUntil(driver, async () => (await read()).walk.place === index,
            `Held W did not reach ${ROOMS[index]}`, 180000);
          await onStep(`held W entered ${ROOMS[index]}`);
        }
      } finally { await key('w', 'keyUp'); }
      const after = await read();
      if (after.finale || after.walk.move?.kind === 'finale' || after.walk.place === null) {
        // Entering the court is the intentional endpoint of this input
        // journey. It has no walking body once the ending takes over.
        assert.equal(after.walk.hand, 0, 'W remained held during the ending');
        await map(300000);
        assert.match((await read()).status, /Time forks perpetually/);
      } else await stopped();
    }],
    ['Echo vantage by E, and walking on from the vantage', async () => {
      await prepare(1);
      await tapKey('e'); await room(1, true);
      await tapKey('e'); await room(1, false);
      await click('.room-step.is-climb'); await room(1, true);
      await click('.room-step.is-on'); await room(2, false);
      await prepare(1);
      await tapKey('e'); await room(1, true);
      await key('w');
      try {
        await waitUntil(driver, async () => {
          const w = (await read()).walk;
          return w.place === 2 && w.body && w.follow?.dir === 1;
        }, 'Held W from the Echo crossing did not follow the route into Silence', 180000);
      } finally { await key('w', 'keyUp'); }
      await stopped();
      await onStep('held W walked from the Echo crossing into Silence');
    }],
    ['complete forward and reverse route including fall and climb', async () => {
      await prepare(2);
      for (let i = 3; i < ROOMS.length; i++) { await click('.room-step.is-on'); await room(i); }
      for (let i = ROOMS.length - 2; i >= 0; i--) { await click('.room-step.is-back'); await room(i); }
      assert.equal(await enabled('.room-step.is-back'), false);
    }],
    ['keyboard map return and all eight room choices', async () => {
      await prepare(0);
      await tapKey('m'); await map();
      for (let i = 0; i < ROOMS.length; i++) {
        await choose(i);
        await tapKey(i % 2 ? 'Escape' : 'm'); await map();
      }
      await choose(0);
    }],
    ['walk interrupt, stop, and recovery to the destination', async () => {
      await prepare(0);
      await speed(1);
      await click('.room-step.is-on');
      await waitUntil(driver, async () => (await read()).walk.move?.kind === 'walk', 'Walk never began');
      await key('w');
      try {
        await waitUntil(driver, async () => {
          const w = (await read()).walk;
          return w.hand === 1 && w.body && !w.move;
        }, 'Held W did not interrupt the assisted walk', TIMEOUT);
      } finally { await key('w', 'keyUp'); }
      await stopped();
      assert.equal((await read()).moving, false, 'Stopping left the HUD locked in travel');
      await speed(SPEED);
      await click('.room-step.is-on'); await room(1);
      await backToMap();
    }],
    ['finale completes and permits re-entry', async () => {
      await prepare();
      await choose(7); await click('.room-step.is-on'); await map(300000);
      assert.match((await read()).status, /Time forks perpetually/);
      await choose(7);
    }],
    ['finale can be skipped with Escape', async () => {
      await prepare(7);
      await speed(1); await click('.room-step.is-on');
      await waitUntil(driver, async () => (await read()).finale, 'Finale never started');
      await onStep('ending requested; Escape may arrive before its first animation frame');
      await tapKey('Escape'); await map(); await speed(SPEED);
      await choose(0); await room(0);
    }],
    ['finale can be skipped with M immediately after requesting it', async () => {
      await prepare(7);
      await speed(1); await click('.room-step.is-on');
      await tapKey('m');
      await onStep('M pressed immediately after requesting the ending');
      await map(); await speed(SPEED);
      await choose(7); await room(7);
    }],
    ['actual touch selection, drag, navigation, and map return', async () => {
      await load({ mobile: true });
      assert.equal(await driver.executeScript('return matchMedia("(pointer: coarse)").matches'), true,
        'This run must emulate a touch pointer, not just a narrow viewport');
      for (const i of [0, 3, 4, 7]) {
        const selector = `.map-room[aria-label*="${ROOMS[i]} —"]`;
        await tap(selector);
        await waitUntil(driver, async () => (await driver.executeScript('return document.querySelector(".map-card-title")?.textContent.trim()')) === ROOMS[i],
          `First touch did not preview ${ROOMS[i]}`);
        assert.equal((await read()).walk.place, null, 'A first touch should preview rather than enter');
        await tap(selector); await room(i);
        const before = (await read()).walk.look.yaw;
        const p = await point('.map-stage');
        await touch('touchStart', p);
        try {
          for (let n = 1; n <= 6; n++) await touch('touchMove', { x: p.x + n * 8, y: p.y });
        } finally { await touch('touchEnd'); }
        assert(Math.abs((await read()).walk.look.yaw - before) > 0.1, 'Touch drag did not turn the view');
        if (i === 0) {
          await tap('.room-step.is-on'); await room(1);
          await tap('.room-step.is-back'); await room(0);
        }
        await tap('.room-map'); await map();
      }
    }],
    ['reduced-motion navigation and refresh recovery', async () => {
      await load({ reduced: true }); await click('.map-enter'); await room(0);
      for (let i = 1; i < ROOMS.length; i++) { await click('.room-step.is-on'); await room(i); }
      await backToMap();
      await driver.navigate().refresh();
      await waitUntil(driver, () => driver.executeScript(() => !!document.querySelector('.entry-map.is-world')),
        'Refresh did not rebuild the map', 180000);
      await speed(SPEED); await map(); await choose(1);
      await click('.room-step.is-climb'); await room(1, true);
      await click('.room-step.is-climb'); await room(1, false);
    }],
    ['built-world clearance on every route in both directions', async () => {
      await prepare();
      const runs = await driver.executeScript(() => {
        if (typeof window.__worldSweep !== 'function') throw new Error('Geometry sweep hook is unavailable');
        const count = document.querySelectorAll('.map-room').length;
        if (count !== 8) throw new Error('All eight map rooms are required for the geometry sweep');
        const runs = [];
        for (let i = 0; i < count - 1; i++) runs.push([i, i + 1, {}], [i + 1, i, {}]);
        for (const raw of Object.keys(window.__worldVantages)) {
          const i = Number(raw);
          runs.push([i, i, {}], [i, i, { down: true }]);
          for (const to of [i - 1, i + 1].filter(n => n >= 0 && n < count)) runs.push([i, to, { off: true }]);
        }
        return runs;
      });
      await onStep({ kind: 'planned geometry routes', routes: runs });
      const result = [];
      // Keep the same 41 samples and clearance assertions on all 18 routes,
      // but avoid one synchronous page script exceeding WebDriver's timeout.
      for (const [from, to, opts] of runs) {
        const measured = await driver.executeScript((from, to, opts) => {
          const swept = window.__worldSweep(from, to, 40, undefined, opts);
          return { from, to, opts, kind: swept.kind, samples: swept.samples.length,
            bad: swept.samples.filter(s => (s.nearest && s.nearest.d < 4) || s.inside > 0.2) };
        }, from, to, opts);
        result.push(measured);
        await onStep({ ...measured, kind: 'geometry route completed', movement: measured.kind });
      }
      assert.equal(result.length, 18, 'Expected fourteen room legs and four vantage routes');
      assert(result.every(r => r.samples === 41), 'A route was not sampled completely');
      assert.deepEqual(result.filter(r => r.bad.length), [], 'Navigation passes through or too close to solid geometry');
    }],
  ];
}
