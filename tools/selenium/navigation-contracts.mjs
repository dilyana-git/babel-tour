import { assert, waitUntil } from './browser.mjs';
import { createNavigationDriver } from './navigation.mjs';
import { flatDistance, nearestRoute, startRecording, stopRecording, wrapAngle, headYaw } from '../navigation-observations.mjs';
import { PAVILION, PAVILION_BRIDGE } from '../../src/world/pavilionBridge.js';

// Executable acceptance tests for the agreed design, written BEFORE changing
// the controls. The major gate now includes these contracts.
// Input journeys use real key events; diagnostics only observe the outcome.
const ROOMS = ['Vestibule', 'Echo', 'Silence', 'Vertigo', 'Door', 'Fork', 'Pavilion', 'Web of Time'];
const TIMEOUT = 120000;
const eye = body => [body.feet[0], body.eyeY, body.feet[2]];

export function navigationContracts(driver, baseUrl, options = {}) {
  const nav = createNavigationDriver(driver, baseUrl, options);
  const { read, speed, key, prepare, onStep } = nav;
  const walkUntil = async predicate => {
    await key('w');
    try { await waitUntil(driver, async () => predicate((await read()).walk), 'Walking did not reach the expected condition', TIMEOUT); }
    finally { await key('w', 'keyUp'); }
  };
  const settleFeet = async () => { await speed(12); await nav.stopped(); await speed(1); };
  const turnBy = async amount => {
    const before = (await read()).walk.look.yaw, value = amount > 0 ? 'ArrowLeft' : 'ArrowRight';
    await key(value);
    try {
      const reached = await driver.executeAsyncScript((before, amount, done) => {
        let id, finished = false;
        const finish = ok => { if (!finished) { finished = true; clearTimeout(timer); cancelAnimationFrame(id); done(ok); } };
        const timer = setTimeout(() => finish(false), 120000);
        const sample = () => {
          const yaw = window.__worldWalk?.().look.yaw;
          if (Math.sign(amount) * (yaw - before) >= Math.abs(amount)) finish(true);
          else id = requestAnimationFrame(sample);
        };
        sample();
      }, before, amount);
      assert(reached, 'Arrow input did not turn the gaze');
    } finally { await key(value, 'keyUp'); }
  };
  const face = async direction => {
    for (let attempt = 0; attempt < 16; attempt++) {
      const w = (await read()).walk;
      assert(w.body, 'No walking body exists for this detour');
      const base = w.body.base;
      const target = Math.atan2(base[1], base[0]) - Math.atan2(direction[1], direction[0]);
      const error = wrapAngle(target - w.look.yaw);
      if (Math.abs(error) < 0.15) return;
      await turnBy(Math.sign(error) * Math.min(Math.abs(error), 0.3));
    }
    throw new Error('Could not align the gaze using arrow input');
  };
  const recording = async work => {
    await startRecording(driver);
    let failed = false;
    try { await work(); }
    catch (error) { failed = true; throw error; }
    finally {
      const captured = await stopRecording(driver);
      await onStep({ kind: 'per-frame observation', ...captured });
      if (!failed) assert.equal(captured.truncated, false, 'The movement recording exceeded its retained evidence');
    }
  };
  const walkToRail = async () => {
    const w = (await read()).walk;
    assert(w.pit, 'The spiral landmark observations are missing');
    await face([w.pit.x - w.body.feet[0], w.pit.z - w.body.feet[2]]);
    await walkUntil(w => w.target !== 3 || (w.body && !!w.body.dbg?.stop));
    assert.equal((await read()).walk.target, 3, 'Approaching the rail fell before looking over it');
    await settleFeet();
  };
  const approachRail = async () => {
    await prepare(3); await speed(1);
    await walkUntil(w => w.body && w.body.speed > 2); await settleFeet();
    await walkToRail();
  };
  const dragLook = async dy => {
    const p = await nav.point('.map-stage');
    await driver.sendDevToolsCommand('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount: 1 });
    try {
      await driver.sendDevToolsCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y + dy, button: 'left', buttons: 1 });
    } finally {
      await driver.sendDevToolsCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y + dy, button: 'left', clickCount: 1 });
    }
  };
  const observeGaze = (threshold, above) => driver.executeAsyncScript((threshold, above, done) => {
    let id, finished = false;
    const finish = value => { if (!finished) { finished = true; clearTimeout(timer); cancelAnimationFrame(id); done(value); } };
    const timer = setTimeout(() => finish({ timeout: true, walk: window.__worldWalk?.() }), 20000);
    const observe = () => {
      const w = window.__worldWalk?.();
      if (w && (w.target !== 3 || (above ? w.gaze[1] > threshold : w.gaze[1] < threshold))) finish({ walk: w });
      else id = requestAnimationFrame(observe);
    };
    observe();
  }, threshold, above);

  const lookCases = [0, 1, 2, 4, 5, 6, 7].map(index => [
    `contract held W permits independent looking in ${ROOMS[index]}`,
    async () => {
      await prepare(index); await speed(1);
      if (index === 7) {
        // Leave room for the look, the continued-walking observations, and
        // the stopping stride before the intentional ending threshold.
        // A 15-unit retreat left only about 34 units: the recorded walk and
        // braking crossed that boundary before the stopped-body assertion.
        await key('s');
        const before = (await read()).walk.camera;
        try {
          await waitUntil(driver, async () => {
            const w = (await read()).walk; return w.body && flatDistance(before, w.body.feet) > 35;
          }, 'Could not step back along the maze approach', TIMEOUT);
        } finally { await key('s', 'keyUp'); }
        await settleFeet();
      }
      const routes = await driver.executeScript('return window.__worldRoute()');
      await recording(async () => {
        await key('w');
        try {
          await waitUntil(driver, async () => {
            const w = (await read()).walk; return w.body && w.follow && w.body.speed > 2;
          }, 'The default walk did not start on the route', TIMEOUT);
          const before = (await read()).walk;
          await key('ArrowLeft');
          try {
            await waitUntil(driver, async () => (await read()).walk.look.yaw - before.look.yaw > 0.9,
              'Could not look sideways while W was held', TIMEOUT);
          } finally { await key('ArrowLeft', 'keyUp'); }
          const after = (await read()).walk;
          assert.equal(after.hand, 1, 'Looking unexpectedly released forward movement');
          assert(after.body && flatDistance(before.body.feet, after.body.feet) > 1,
            'The visitor stopped moving while looking');
          const near = nearestRoute(eye(after.body), routes);
          assert(near && near.distance < 1.5, `Looking changed the walking course (distance from path: ${near?.distance.toFixed(2) ?? 'no matching level'}; route following: ${!!after.follow})`);
          assert(after.follow, 'Looking alone released route following');
          await waitUntil(driver, async () => (await read()).walk.frame >= after.frame + 2, 'No frames after releasing look input', TIMEOUT);
          const settled = (await read()).walk;
          assert(Array.isArray(settled.gaze), 'Rendered gaze diagnostics are missing');
          await waitUntil(driver, async () => (await read()).walk.frame >= settled.frame + 5, 'No continued walking frames', TIMEOUT);
          const continued = (await read()).walk;
          assert(Math.abs(wrapAngle(headYaw(continued.body.base, continued.gaze) - headYaw(settled.body.base, settled.gaze))) < 0.03,
            'The route turned the visitor\'s gaze after arrow release');
        } finally { await key('w', 'keyUp'); }
      });
      await settleFeet();
    },
  ]);

  return [...lookCases,
    ...[5, 6].map(start => [start === 5
      ? 'contract held W crosses the Pavilion bridge zigzags onto its landing'
      : 'contract held W crosses the Pavilion bridge from its room stand', async () => {
      await prepare(start); await speed(12);
      await onStep(start === 5 ? 'starting at the Fork before the zigzag crossing' : 'starting at the Pavilion room stand');
      await recording(async () => {
        // One uninterrupted forward press, with no look/steering input.
        await key('w');
        let crossed;
        try {
          crossed = await driver.executeAsyncScript((center, corners, done) => {
            let id, finished = false;
            let stuckSince = null;
            const bends = corners.map(() => false);
            const finish = value => { if (!finished) { finished = true; clearTimeout(timer); cancelAnimationFrame(id); done(value); } };
            const timer = setTimeout(() => finish(null), 120000);
            const sample = () => {
              const w = window.__worldWalk?.();
              if (w?.body?.dbg?.stop) {
                stuckSince ??= performance.now();
                if (performance.now() - stuckSince > 1500) {
                  finish({ failure: `Crossing stalled: ${w.body.dbg.stop}`, walk: w });
                  return;
                }
              } else stuckSince = null;
              if (w?.body) corners.forEach((p, i) => {
                if (Math.hypot(w.body.feet[0] - p[0], w.body.feet[2] - p[1]) < 4) bends[i] = true;
              });
              if (w?.body && w.body.feet[1] >= 11.8
                && Math.hypot(w.body.feet[0] - center[0], w.body.feet[2] - center[1]) < 25) finish({ walk: w, bends });
              else id = requestAnimationFrame(sample);
            };
            sample();
          }, PAVILION, PAVILION_BRIDGE.slice(start === 5 ? 1 : 2, -1));
        } finally { await key('w', 'keyUp'); }
        assert(crossed, 'One held W did not cross onto the Pavilion landing');
        assert(!crossed.failure, crossed.failure);
        assert(crossed.bends.every(Boolean), 'The crossing skipped a zigzag bend');
        assert.equal(crossed.walk.hand, 1, 'Crossing required releasing the forward key');
        assert.equal(crossed.walk.place, 6, 'Crossing the bridge unexpectedly left the Pavilion');
        assert(crossed.walk.follow, 'The bridge crossing lost its guided walking route');
        await onStep('one held W followed all three zigzag bends and reached the Pavilion landing');
      });
      await settleFeet();
    }]),
    ['contract held W can return from Silence to Echo', async () => {
      await prepare(2); await speed(1);
      await walkUntil(w => w.body && w.follow && w.body.speed > 2); await settleFeet();
      const initial = (await read()).walk, routes = await driver.executeScript('return window.__worldRoute()');
      const anchor = nearestRoute(eye(initial.body), routes);
      assert(anchor, 'The Silence route was not found');
      await face(anchor.direction.map(v => -v));
      await speed(12);
      await walkUntil(w => w.place === 1 && w.body && w.follow?.dir === -1);
      await settleFeet();
      await onStep('held W walked back from Silence into Echo');
    }],
    ['contract a new W press chooses the direction of the gaze', async () => {
      await prepare(5); await speed(1);
      await walkUntil(w => w.body && w.body.speed > 4); await settleFeet();
      await turnBy(Math.PI / 2);
      const before = (await read()).walk, length = Math.hypot(before.gaze[0], before.gaze[2]);
      const wanted = [before.gaze[0] / length, before.gaze[2] / length];
      await walkUntil(w => w.body && flatDistance(before.body.feet, w.body.feet) > 5);
      const after = (await read()).walk, dx = after.body.feet[0] - before.body.feet[0], dz = after.body.feet[2] - before.body.feet[2];
      assert((dx * wanted[0] + dz * wanted[1]) / Math.hypot(dx, dz) > Math.cos(Math.PI / 9),
        'A new W press did not walk toward the chosen gaze');
      assert.equal(after.follow, null, 'A deliberate sideways departure remained captured by the route');
      await settleFeet();
    }],
    ...[1, -1].map(direction => [`contract detour crossing and automatic ${direction > 0 ? 'forward' : 'backward'} rejoin`, async () => {
      await prepare(5); await speed(1);
      await walkUntil(w => w.body && w.follow && w.body.speed > 4); await settleFeet();
      const initial = (await read()).walk, routes = await driver.executeScript('return window.__worldRoute()');
      const anchor = nearestRoute(eye(initial.body), routes);
      assert(anchor, 'The starting path was not found');
      const tangent = anchor.direction.map(v => v * direction), side = [-tangent[1], tangent[0]];
      await face(side);
      await walkUntil(w => w.body && flatDistance(initial.body.feet, w.body.feet) > 9); await settleFeet();
      const away = (await read()).walk;
      assert.equal(away.follow, null, 'Independent exploration was captured by the route');
      await face(side.map(v => -v));
      await walkUntil(w => w.body && nearestRoute(eye(w.body), routes)?.distance < 2);
      assert.equal((await read()).walk.follow, null, 'Crossing the path sideways captured the visitor');
      await settleFeet(); await face(tangent);
      await recording(async () => {
        await walkUntil(w => w.body && w.follow && w.follow.dir === direction && w.body.speed > 4);
        const joined = (await read()).walk;
        assert.equal(joined.follow.dir, direction, 'Rejoining chose the wrong route direction');
        assert(nearestRoute(eye(joined.body), routes).distance < 2, 'Rejoining did not settle onto the path');
      });
      await settleFeet();
    }]),
    ['contract looking over the spiral rail commits the descent', async () => {
      await approachRail();
      assert.equal((await read()).walk.place, 3, 'Approaching the rail fell before looking over it');
      await key('ArrowDown');
      try {
        await waitUntil(driver, async () => (await read()).walk.look.pitch < -0.65,
          'Could not look down over the rail', TIMEOUT);
      } finally { await key('ArrowDown', 'keyUp'); }
      await waitUntil(driver, async () => (await read()).walk.target === 4,
        'Sustained looking over the rail did not begin the spiral descent', TIMEOUT);
      await speed(12); await nav.room(4);
    }],
    ['contract a brief look over the rail can be cancelled by looking away', async () => {
      await approachRail();
      await recording(async () => {
        await dragLook(200);
        const down = await observeGaze(-0.55, false);
        assert.equal(down.timeout, undefined, 'The brief glance never reached the shaft');
        assert.equal(down.walk.target, 3, 'A brief initial glance immediately committed the fall');
        await dragLook(-200);
        const away = await observeGaze(-0.45, true);
        assert.equal(away.timeout, undefined, 'Looking away did not restore the gaze');
        assert.equal(away.walk.target, 3, 'Looking away failed to cancel the initial lean');
        await speed(12);
        const frame = away.walk.frame;
        await waitUntil(driver, async () => (await read()).walk.frame >= frame + 20, 'No frames after cancelling the lean', TIMEOUT);
        const settled = (await read()).walk;
        assert.equal(settled.place, 3); assert.equal(settled.target, 3);
        assert.equal(settled.move, null, 'A cancelled glance began a delayed fall');
      });
    }],
    ['contract looking over the rail while standing needs no walking key', async () => {
      await prepare(3); await speed(1);
      const w = (await read()).walk;
      const x = w.pit.x - w.camera[0], z = w.pit.z - w.camera[2];
      await turnBy(Math.atan2(w.gaze[2] * x - w.gaze[0] * z, w.gaze[0] * x + w.gaze[2] * z));
      await key('ArrowDown');
      try { await waitUntil(driver, async () => (await read()).walk.look.pitch < -0.65, 'Could not look over the rail while standing', TIMEOUT); }
      finally { await key('ArrowDown', 'keyUp'); }
      await waitUntil(driver, async () => (await read()).walk.target === 4, 'Standing rail gaze did not commit the descent', TIMEOUT);
      await speed(12); await nav.room(4);
    }],
    ['contract looking over the rail after repeated turns reaches the next room', async () => {
      await prepare(3); await speed(12);
      await walkUntil(w => w.body && w.body.feet[1] < -700); await settleFeet();
      await walkToRail();
      await key('ArrowDown');
      try { await waitUntil(driver, async () => (await read()).walk.look.pitch < -0.65, 'Could not look over the lower rail', TIMEOUT); }
      finally { await key('ArrowDown', 'keyUp'); }
      await waitUntil(driver, async () => (await read()).walk.target === 4, 'Lower rail gaze did not commit the descent', TIMEOUT);
      await speed(12); await nav.room(4);
    }],
    ['contract the staircase keeps descending beyond its initially generated extent', async () => {
      await prepare(3); await speed(12);
      const initial = (await read()).walk, routes = await driver.executeScript('return window.__worldRoute()');
      assert(initial.pit && initial.origin, 'Spiral geometry observations are missing');
      const points = routes.flat().filter(p => Math.hypot(p[0] - initial.pit.x, p[2] - initial.pit.z) < initial.pit.r + 40 && p[1] <= initial.camera[1] + 3);
      assert(points.length > 20, 'The initial stair extent could not be measured');
      const length = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1], p[2] - points[i][2]), 0);
      const drop = Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1]));
      const goal = { walked: Math.max(600, length * 2), descended: Math.max(450, drop * 1.5) };
      await recording(async () => {
        await key('w');
        try {
          const observed = await driver.executeAsyncScript((goal, done) => {
            import('/tools/navigation-observations.mjs').then(({ progressDelta }) => {
            let previous = null, walked = 0, descended = 0, stationary = 0, checkpoint = null, id, finished = false;
            const finish = value => { if (!finished) { finished = true; clearTimeout(timer); cancelAnimationFrame(id); done(value); } };
            const timer = setTimeout(() => finish({ failure: 'Timed out measuring repeated stair walking', walked, descended, goal }), 840000);
            const sample = () => {
              const w = window.__worldWalk?.();
              if (!w || w.place !== 3 || w.target !== 3) { finish({ failure: 'Forward stair walking unexpectedly left the chamber', walk: w }); return; }
              if (w.body && previous?.body && w.frame !== previous.frame) {
                const progress = progressDelta(previous.body, w.body, previous.origin, w.origin);
                walked += progress.walked;
                descended += progress.descended;
                stationary = progress.walked < 0.001 ? stationary + 1 : 0;
                if (stationary > 45) { finish({ failure: 'Stair walking stopped before the repeatability horizon', walked, descended, goal, walk: w }); return; }
                if (!checkpoint) checkpoint = { frame: w.frame, walked, descended };
                if (w.frame - checkpoint.frame >= 120) {
                  if (walked - checkpoint.walked < 2 || descended - checkpoint.descended < 1) {
                    finish({ failure: 'Forward stair input made no useful downward progress', walked, descended, goal, walk: w }); return;
                  }
                  checkpoint = { frame: w.frame, walked, descended };
                }
                if (walked >= goal.walked && descended >= goal.descended) { finish({ walked, descended, goal }); return; }
              }
              previous = w;
              id = requestAnimationFrame(sample);
            };
            sample();
            }).catch(error => done({ failure: `Could not read stair progress: ${error.message}` }));
          }, goal);
          await onStep({ kind: 'repeatable stair progress', ...observed });
          assert.equal(observed.failure, undefined, JSON.stringify(observed));
        } finally { await key('w', 'keyUp'); }
      });
    }],
  ];
}
