// ── The map ──────────────────────────────────────────────────────────────────
// The first thing the piece shows: the whole walk as one place — the Library a
// honeycomb of galleries carved in stone that runs on past every edge, four of
// them lit and joined by the walk, the Vertigo at the centre, the fifth
// gallery broken open onto the garden of forking paths.
//
// The map is the live three.js place (src/world), tilted to show its bookshelf
// walls. It fades in once it has drawn, and its camera reports the overlay —
// hit areas, route, names — back in screen pixels (onLayout).
//
// Two tours can stand behind it:
//   the world   `worldRooms` (WorldTour.jsx, the piece now). Choosing a room
//               flies down into it and the reader stays in the world: a card
//               for the room, the walk on and back, the map again. Drag, A/D
//               and the arrows look around; W walks wherever the reader is
//               looking when W is pressed, and S steps back. M is the map,
//               and E climbs to the room's vantage where it has one (the Echo's
//               crossing — vantages.js) and back down again. The buttons have
//               the piece walk them on or back from wherever they stand.
//   the plates  Tour.jsx (?plates). The flight ends at the room's Midjourney
//               plate and the reader is handed on to it (onChoose); with
//               reduced motion, or before the world has drawn, `enterAt` in
//               Tour.jsx stands the camera in the room and the map dissolves.
//               Until the world draws, the overlay waits alone over the dark
//               in its old 1440 × 900 frame.
import { Component, Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { NODES } from './catalogue';
import { canDraw } from './Failure';
import { COARSE } from './capability';
import { VANTAGES } from './world/vantages';
import { actionHandlers } from './actionHandlers';
import RoomVoice from './RoomVoice';
import { AssemblyEpigraph, AssemblyInk } from './Assembly';
import { INK_OFF, INK_PATIENCE_MS } from './ink';
import { PASSAGES, STORY, VOICES } from './voices';
import './map.css';

// Fetched as soon as the map is, not once the map has rendered and asked for
// it: the world is the long part of the wait, and it cannot start until it is
// here. (Never fetched where it could not be drawn.)
const worldModule = canDraw() ? import('./world/World') : null;
worldModule?.catch(() => { /* WorldBoundary hears about it when it renders */ });
const World = lazy(() => worldModule ?? import('./world/World'));

// If the live world throws, the still stays the map and nothing else changes.
class WorldBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.warn('[world] the live map could not be drawn; keeping the still:', error);
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const [FW, FH] = [1440, 900];

const hexPoints = ([cx, cy], r) => Array.from({ length: 6 }, (_, k) =>
  [cx + r * Math.cos((k * Math.PI) / 3), cy + r * Math.sin((k * Math.PI) / 3)]);
const toAttr = (pts) => pts.map(([x, y]) => `${(+x).toFixed(1)},${(+y).toFixed(1)}`).join(' ');
const grownFrom = (pts, by) => {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => {
    const d = Math.hypot(x - cx, y - cy) || 1;
    return [x + ((x - cx) / d) * by, y + ((y - cy) / d) * by];
  });
};

// Where each room is in the still's frame. Room order is NODES order.
const ROOMS = [
  { hex: [232, 785], label: [352, 856] },
  { hex: [425.3, 673.4], label: [484, 776] },
  { hex: [618.6, 561.8], label: [678, 664] },
  { circle: [811.9, 450.2, 101], label: [871, 552] },
  { hex: [1005.2, 338.6], label: [946, 236] },
  { poly: [[1085, 255], [1150, 180], [1240, 185], [1255, 275], [1175, 330], [1100, 335]], label: [1160, 164] },
  { ellipse: [1300, 118, 118, 90], label: [1350, 36] },
  { rect: [1170, 305, 260, 230], label: [1300, 556] },
];

function RoomShape({ room, grow = 0, className }) {
  if (room.hex) return <polygon className={className} points={toAttr(hexPoints(room.hex, 100 + grow))} />;
  if (room.circle) {
    const [cx, cy, r] = room.circle;
    return <circle className={className} cx={cx} cy={cy} r={r + grow} />;
  }
  if (room.ellipse) {
    const [cx, cy, rx, ry] = room.ellipse;
    return <ellipse className={className} cx={cx} cy={cy} rx={rx + grow} ry={ry + grow} />;
  }
  if (room.rect) {
    const [x, y, w, h] = room.rect;
    return <rect className={className} x={x - grow} y={y - grow} width={w + 2 * grow} height={h + 2 * grow} rx={6 + grow} />;
  }
  return <polygon className={className} points={toAttr(grow ? grownFrom(room.poly, grow) : room.poly)} />;
}

const SPIRAL = 'M0 0 a2 2 0 0 1 4 0 a4 4 0 0 1 -8 0 a6 6 0 0 1 12 0 a8 8 0 0 1 -16 0 a10 10 0 0 1 20 0';

const boundsOf = (pts) => pts.reduce((b, [x, y]) => ({
  x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y),
}), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });

// Where a room's numeral stands: over the middle of the room, a fixed height
// above the room's top edge as it is drawn on the screen — the edge itself,
// where the middle crosses it, not the top of the room's bounding box (with
// the map turned off north that is a corner off to one side, and a numeral
// set over it floated clear of some rooms and sat on the rims of others:
// board 2 · 6).
const NUMERAL_LIFT = 12;
function numeralAt(poly) {
  const b = boundsOf(poly);
  const x = (b.x0 + b.x1) / 2;
  let top = Infinity;
  poly.forEach(([ax, ay], k) => {
    const [bx, by] = poly[(k + 1) % poly.length];
    if ((ax - x) * (bx - x) > 0 || ax === bx) return;
    top = Math.min(top, ay + ((x - ax) / (bx - ax)) * (by - ay));
  });
  return [x, (Number.isFinite(top) ? top : b.y0) - NUMERAL_LIFT];
}

// The lantern: the walk's rooms, and the way between them through the
// Library, are left lit and the rest of the honeycomb is dimmed, so the walk
// is told by light — there is no line drawn over the stone. In screen pixels,
// scaled by one gallery's width on this screen (207 px at 1891 wide).
function lanternFor(rooms, doorAt) {
  const boxes = rooms.map(boundsOf);
  const scale = (boxes[0].x1 - boxes[0].x0) / 207;
  const garden = boxes.slice(doorAt + 1).reduce((a, b) => ({
    x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
  }));
  return {
    scale,
    library: rooms.slice(0, doorAt + 1),
    way: boxes.slice(0, doorAt + 1).map((b) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]),
    garden: {
      cx: (garden.x0 + garden.x1) / 2,
      cy: (garden.y0 + garden.y1) / 2,
      rx: (garden.x1 - garden.x0) / 2 + 40 * scale,
      ry: (garden.y1 - garden.y0) / 2 + 40 * scale,
    },
  };
}

// Under the garden, the honeycomb goes on to the bottom right corner as cell
// after empty cell — the largest part of the frame, and nothing in it. It
// fades into the dark there (board 2 · 5): an ellipse of fog from the corner,
// reaching up no further than the bottom of the garden's light.
function fogFor(lantern, w, h) {
  const top = lantern.garden.cy + lantern.garden.ry;
  const cy = h + Math.max(0, h - top) * 0.3;
  return { cx: w, cy, rx: w * 0.55, ry: Math.max(1, cy - top) };
}

// Inside the tour the garden restarts its count (PATH I–IV), but on one sheet
// holding both worlds "I The Door" beside "I The Vestibule" reads as an error,
// so the map counts the whole walk.
const MAP_NUMERAL = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
// How long a reader stands with their hands off everything before the key caps
// come back.
const HINT_IDLE_MS = 15000;
// How long the one word on steering stays up after the reader's first walk.
const HINT_TIP_MS = 9000;
// The seal of the eight rooms beside the walk, which is the map's button: the
// Library's four up their diagonal, as on the map, and the garden's four
// stepping on from where the fall lands (pointy cells, 17.3 apart).
const SEAL = [[12, 60], [20.66, 45], [29.32, 30], [37.98, 15], [72, 45], [80.66, 30], [89.32, 45], [97.98, 30]];
const SEAL_FALL = 'M46.5 15 Q62 14 66 35';
const hexAt = ([x, y], r) => [-90, -30, 30, 90, 150, 210]
  .map((a) => `${(x + r * Math.cos((a * Math.PI) / 180)).toFixed(2)},${(y + r * Math.sin((a * Math.PI) / 180)).toFixed(2)}`)
  .join(' ');
// The keys held down in a room: turning and tilting the head, and the feet.
const HELD_KEYS = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', ArrowDown: 'down' };
const STEP_KEYS = { w: 1, W: 1, s: -1, S: -1 };
const TALL_QUERY = '(max-aspect-ratio: 1/1)';

export default function EntryMap({ leaving, scenes, libraryMax, resumeAt, shared, onChoose, worldRooms = false }) {
  const { active, progress } = useProgress();
  const [tall, setTall] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(TALL_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(TALL_QUERY);
    const onChange = (e) => setTall(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Which room the card describes: the one being opened, else the one last
  // pointed at or focused, else the one a touch picked, else where the
  // reader left off, else the Vestibule.
  const suggested = resumeAt ?? 0;
  const [hot, setHot] = useState(null);
  const [picked, setPicked] = useState(null);
  const [opening, setOpening] = useState(null);
  const shown = opening ?? hot ?? picked ?? suggested;
  const resting = opening === null && hot === null && picked === null;

  const stageRef = useRef(null);
  const roomRefs = useRef([]);
  const pointerRef = useRef('mouse');
  const [origin, setOrigin] = useState('50% 50%');

  const [worldOn] = useState(() => canDraw());
  const [worldReady, setWorldReady] = useState(false);
  const [worldFailed, setWorldFailed] = useState(false);
  // How far the world's assembly has got, 0 to 1 (World.jsx, `onProgress`).
  const [assembled, setAssembled] = useState(0);
  const [layout, setLayout] = useState(null);
  const [flying, setFlying] = useState(null);
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  // The opening (Assembly.jsx): in the world tour the Library draws itself in
  // ink while the world is put together, and the world is shown only once the
  // drawing has come to rest where the map's camera rests (`inked`), so the
  // stone takes the ink's place line for line. World reports the map's frame
  // as soon as it is built (`plan`); the drawing is gone once it has let go.
  const opens = !!worldRooms && worldOn && !INK_OFF;
  const inkRef = useRef({ u: 0 });
  const [plan, setPlan] = useState(null);
  const [inked, setInked] = useState(!opens);
  const [inkGone, setInkGone] = useState(!opens);
  const liveWorld = worldOn && worldReady && inked && !worldFailed;
  // (should the drawing never come to rest, the world is shown anyway)
  useEffect(() => {
    if (!worldReady || inked) return undefined;
    const id = setTimeout(() => setInked(true), INK_PATIENCE_MS);
    return () => clearTimeout(id);
  }, [worldReady, inked]);
  const liveOverlay = liveWorld && layout !== null;

  // The world tour: where the reader stands (null on the map), and where the
  // camera is headed. The two differ while it flies, walks or falls.
  const sectionRef = useRef(null);
  const roomTitleRef = useRef(null);
  const lastRoomRef = useRef(suggested);
  const focusOnMapRef = useRef(true);
  const [place, setPlace] = useState(null);
  const [target, setTarget] = useState(null);
  // And, inside a room that has a second place to stand (vantages.js),
  // whether the reader is up at it and whether they are headed there. The pair
  // is the room's own small walk, and it moves the same way the big one does.
  const [up, setUp] = useState(false);
  const [toUp, setToUp] = useState(false);
  // The walking foot: the key the reader has down (+1 forward, -1 back). World
  // walks them wherever they are looking for as long as it is held.
  const walkRef = useRef({ hold: 0, press: 0 });
  // Out of every room on their own walk (a hallway, a garden path): the two
  // rooms the way they are on runs between, as World reports it, else null.
  const [between, setBetween] = useState(null);
  // Whether the reader has walked anywhere yet, this visit (the key caps).
  const [walked, setWalked] = useState(false);
  // The one thing the arrival caps leave out — that turning while walking
  // leaves the way — said once, as the reader first walks, and not again.
  const [tip, setTip] = useState(false);
  const tipSaid = useRef(false);
  // A finger on the touch walk button (it is the held W of a touch screen).
  const [holding, setHolding] = useState(false);
  // How tall the room's HUD stands, so the hint can sit above it on a phone.
  const hudRef = useRef(null);
  const [hudHeight, setHudHeight] = useState(0);
  // The hint on the walk's bottom line, between the caption and the walk, when
  // there is room for it there (`hintAt`: its centre and its bottom, from the
  // map's bottom left); else, null, it keeps to bottom centre above the walk.
  const navRef = useRef(null);
  const plateRef = useRef(null);
  const assistRef = useRef(null);
  const [hintAt, setHintAt] = useState(null);
  // How many times the reader has arrived anywhere: it turns the line the
  // caption gives the road (voices.js, PASSAGES), so two walks running do not
  // say the same thing.
  const [legs, setLegs] = useState(0);
  // The heart of the maze (world/finale.js): the last room's way on. `finale`
  // is what is asked of World — null, 'play', or 'skip' (M or Escape while it
  // plays) — and `finalePhase` what it says it is doing, for the caption:
  // 'walk', 'others', 'you', 'rise', 'leave'. `ended`: seen, this visit.
  const [finale, setFinale] = useState(null);
  const [finalePhase, setFinalePhase] = useState(null);
  const [ended, setEnded] = useState(false);
  const last = NODES.length - 1;
  const vantage = place === null ? null : VANTAGES[place] ?? null;
  const moving = finale !== null || target !== place || up !== toUp;
  // the room the hallway the reader is standing in runs on to
  const beyond = between?.find((r) => r !== place);
  const onMap = place === null && target === null;
  const mapHidden = worldRooms && !onMap;
  const lookRef = useRef({ yaw: 0, pitch: 0, keys: { left: false, right: false, up: false, down: false } });
  const fadeRef = useRef(null);
  const dragRef = useRef(null);
  const settle = useCallback((p, atVantage = false) => {
    setFinale(null);
    setPlace(p);
    setTarget(p);
    setUp(atVantage);
    setToUp(atVantage);
    setBetween(null);
    setOpening(null);
    setHot(null);
    setLegs((n) => n + 1);
  }, []);
  // Where the reader's own walk has taken them (World's onRoam): into a room
  // (`entered`), or out of all of them onto the way between two.
  const roam = useCallback((p, way, entered) => {
    setPlace(p);
    setTarget(p);
    setUp(false);
    setToUp(false);
    setBetween(way);
    setWalked(true);
    if (entered) setLegs((n) => n + 1);
  }, []);
  // What the reader's own walk has set going (World's onGo): held into the
  // Vertigo's broken rail, the fall to the Door; into the court at the heart
  // of the maze, the end of the walk.
  const go = useCallback((to) => {
    if (to === 'heart') setFinale('play');
    else setTarget(to);
  }, []);
  // On foot. Holding the key IS the walking — wherever the reader is looking,
  // for as long as it is held. A new press commits a new course; releasing
  // stands them where they are.
  const foot = useCallback((dir) => {
    if (place !== null) {
      walkRef.current.hold = dir;
      walkRef.current.press += 1;
      setWalked(true);
      if (!tipSaid.current) {
        tipSaid.current = true;
        setTip(true);
      }
    }
  }, [place]);
  // The buttons: the piece does the walking, the whole way to the next room
  // or back to the last, from wherever the reader is standing.
  const send = useCallback((step) => {
    if (place === null || moving) return;
    walkRef.current.hold = 0;
    if (place === last && step === 1) {
      setFinale('play');
      return;
    }
    const next = place + step;
    if (next < 0 || next >= NODES.length) return;
    // From a vantage the walk on sets off from up there, as one walk (World,
    // startMove's `off`): asked for together, down and on are the same move.
    if (up) setToUp(false);
    setTarget(next);
  }, [place, moving, up, last]);
  // What World says the heart is doing, and that it is over.
  const onFinale = useCallback((phase) => {
    if (phase === 'done') {
      setEnded(true);
      setFinalePhase(null);
    } else setFinalePhase(phase);
  }, []);
  // Up to the room's vantage, or back down from it.
  const climb = useCallback(() => {
    if (place === null || moving || !VANTAGES[place]) return;
    setToUp((u) => !u);
  }, [place, moving]);

  // The faded map stays mounted for the flight, but its controls belong only
  // to the map. Hand focus over once the new view has finished arriving.
  useLayoutEffect(() => {
    if (!worldRooms) return;
    if (place !== null) lastRoomRef.current = place;
    if (moving || onMap === focusOnMapRef.current) return;
    if (onMap) {
      if (!liveOverlay) return;
      setHot(lastRoomRef.current);
      roomRefs.current[lastRoomRef.current]?.focus({ preventScroll: true });
    } else {
      roomTitleRef.current?.focus({ preventScroll: true });
    }
    focusOnMapRef.current = onMap;
  }, [worldRooms, place, moving, onMap, liveOverlay]);

  // The key caps (`walked`, above, and `idle`). They used to be a strip of five
  // instructions across the top of every room. Now there are three, there when
  // the reader first stands in a room, gone once they have walked (`tip` says
  // the rest, once), and back only if the reader stands with their hands off
  // everything for a while — someone who has stopped may be someone who is
  // stuck.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (place !== null && moving) setWalked(true);
  }, [place, moving]);
  useEffect(() => {
    if (!tip) return undefined;
    const id = setTimeout(() => setTip(false), HINT_TIP_MS);
    return () => clearTimeout(id);
  }, [tip]);
  useLayoutEffect(() => {
    const hud = hudRef.current;
    if (!hud || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setHudHeight(hud.offsetHeight));
    ro.observe(hud);
    setHudHeight(hud.offsetHeight);
    return () => ro.disconnect();
  }, [worldRooms, place === null]);
  useLayoutEffect(() => {
    const hud = hudRef.current, nav = navRef.current, plate = plateRef.current, assist = assistRef.current;
    if (!hud || !nav || !plate || !assist || typeof ResizeObserver === 'undefined') return undefined;
    const seat = () => {
      if (COARSE || tall) { setHintAt(null); return; }
      // (measured from what the hint is placed in — the map, not the HUD: the
      // HUD is a sibling of it, and the two need not share a bottom edge)
      const box = (assist.offsetParent ?? hud).getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      const p = assist.firstElementChild;
      if (!p) return;
      const GAP = 32;
      // Where a box's last line of words ends (its words' boxes, not the
      // element's: the walk's buttons stand 44 px tall round their words).
      const words = document.createRange();
      const textFoot = (el) => {
        let foot = -Infinity;
        const texts = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let t = texts.nextNode(); t; t = texts.nextNode()) {
          words.selectNodeContents(t);
          for (const r of words.getClientRects()) if (r.width) foot = Math.max(foot, r.bottom);
        }
        return foot;
      };
      // The hint as it is on one line, unhindered — measured the same way
      // whatever its seat now, so seating it cannot rock between two seats.
      const held = assist.style.maxWidth;
      assist.style.maxWidth = 'none';
      const hint = p.getBoundingClientRect();
      const lift = hint.bottom - textFoot(p);
      const lh = parseFloat(getComputedStyle(p).lineHeight) || 24;
      assist.style.maxWidth = held;
      // Its words end on the line the walk's last words end on (the caption's
      // last line is on it too: the HUD lines up their baselines). The HUD
      // rises 10 px into place as a room is arrived in; it is measured where
      // it will stand.
      const rise = new DOMMatrixReadOnly(getComputedStyle(hud).transform === 'none' ? undefined : getComputedStyle(hud).transform).m42;
      const ways = nav.querySelector('.room-ways');
      const last = ways?.lastElementChild ? textFoot(ways.lastElementChild) : -Infinity;
      const base = (Number.isFinite(last) ? last : n.bottom - 4) - rise + (Number.isFinite(lift) ? lift : 0);
      const top = base - Math.max(hint.height, 2 * lh) - 6, bottom = base + 6;
      // In the way is only the caption's TEXT on the hint's rows, not the
      // caption's box: that is 27rem wide whatever it says, and its last lines
      // rarely reach across it. Only the words showing: the caption's other
      // lines stand stacked in the same place at opacity 0, and a range over
      // the whole caption also returns each line's full-width box.
      const texts = document.createTreeWalker(plate, NodeFilter.SHOW_TEXT);
      let reach = box.left;
      for (let t = texts.nextNode(); t; t = texts.nextNode()) {
        const line = t.parentElement?.closest('.room-voice-line');
        if ((line && !line.classList.contains('is-on')) || t.parentElement?.closest('.sr-only')) continue;
        words.selectNodeContents(t);
        for (const r of words.getClientRects()) if (r.width && r.bottom - rise > top && r.top - rise < bottom) reach = Math.max(reach, r.right);
      }
      // Centred on the screen when it clears the caption and the walk, else
      // centred in the gap between them, else there on two lines, else (no
      // room at all) above the walk.
      const from = reach + GAP, to = n.left - GAP, mid = box.left + box.width / 2;
      const room = to - from;
      let next = null;
      if (2 * Math.min(mid - from, to - mid) >= hint.width) next = { x: mid, width: null };
      else if (room >= hint.width) next = { x: (from + to) / 2, width: null };
      else if (room >= 200) next = { x: (from + to) / 2, width: Math.floor(room) };
      if (next) next = { left: Math.round(next.x - box.left), bottom: Math.round(box.bottom - base), width: next.width };
      setHintAt((was) => (was?.left === next?.left && was?.bottom === next?.bottom && was?.width === next?.width ? was : next));
    };
    // The walk's line moves without changing size — its words change on
    // arriving, the HUD's other pieces come and go — and a seat measured once
    // left the hint hanging over the line, 170 px short of it (2026-10-08).
    // So it is measured again whenever anything in the HUD changes, at most
    // once a frame.
    let frame = 0;
    const later = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; seat(); }); };
    const ro = new ResizeObserver(later);
    [hud, nav, plate, assist.firstElementChild].forEach((el) => el && ro.observe(el));
    const mo = new MutationObserver(later);
    mo.observe(hud, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', later);
    document.fonts?.ready.then(later);
    seat();
    return () => { ro.disconnect(); mo.disconnect(); window.removeEventListener('resize', later); cancelAnimationFrame(frame); };
  }, [worldRooms, place === null, finale === null, tall]);
  useEffect(() => {
    if (!worldRooms || place === null) return undefined;
    let timer = null;
    const arm = () => {
      clearTimeout(timer);
      setIdle(false);
      timer = setTimeout(() => setIdle(true), HINT_IDLE_MS);
    };
    arm();
    window.addEventListener('keydown', arm);
    window.addEventListener('pointerdown', arm);
    window.addEventListener('wheel', arm, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', arm);
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('wheel', arm);
    };
  }, [worldRooms, place]);

  // The room's caption stays where it is — under the title — whichever room
  // it describes; a caption that followed the pointer about the map was
  // clutter. Only its words change,
  // and the new ones come in softly, started before they are painted. (By
  // filter, not opacity: opacity belongs to the states — flying, in a room,
  // leaving.)
  const cardRef = useRef(null);
  const cardShows = useRef(shown);
  useLayoutEffect(() => {
    if (cardShows.current === shown) return;
    cardShows.current = shown;
    if (!reducedMotion) {
      cardRef.current?.animate?.([{ filter: 'opacity(0)' }, { filter: 'opacity(1)' }], { duration: 260, easing: 'ease-out' });
    }
  }, [shown, reducedMotion]);

  const choose = useCallback((i) => {
    if (opening !== null || mapHidden) return;
    const stage = stageRef.current?.getBoundingClientRect();
    const room = roomRefs.current[i]?.getBoundingClientRect();
    if (stage && room && stage.width && stage.height) {
      const ox = ((room.left + room.width / 2 - stage.left) / stage.width) * 100;
      const oy = ((room.top + room.height / 2 - stage.top) / stage.height) * 100;
      setOrigin(`${ox.toFixed(1)}% ${oy.toFixed(1)}%`);
    }
    if (worldRooms) {
      if (!liveWorld) return;
      // On a phone the card sits below the map; the flight is up at the top.
      sectionRef.current?.scrollTo?.({ top: 0 });
      setOpening(i);
      setTarget(i);
      return;
    }
    setOpening(i);
    if (liveWorld && !reducedMotion) {
      setFlying(i);
      return;
    }
    onChoose(i);
  }, [opening, onChoose, liveWorld, reducedMotion, worldRooms, mapHidden]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' || !onMap) return;
      if (e.target !== document.body && e.target !== document.documentElement) return;
      // the room the caption is showing, as its own Enter button would
      choose(shown);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, shown, onMap]);

  // Standing in a room, or anywhere along a walk: the arrows and A/D look
  // around, W and S are the walking itself — held, not tapped, so the reader
  // keeps a course while looking freely, and stops where they like
  // — E goes up to the room's vantage (and back down), M (or Escape) rises to
  // the map.
  //
  // Letting go of a key is heard always, apart from the effect that hears the
  // pressing: that one is torn down and rebuilt whenever the walk's state
  // changes — on the very frame W is pressed, and every time the reader's own
  // walk takes them into another room — and a key let go of while it was
  // down, or cleared by its cleanup, stuck or stopped a walk or a turn dead.
  useEffect(() => {
    if (!worldRooms) return undefined;
    const keys = lookRef.current.keys;
    const onUp = (e) => {
      if (HELD_KEYS[e.key]) keys[HELD_KEYS[e.key]] = false;
      else if (STEP_KEYS[e.key]) walkRef.current.hold = walkRef.current.hold === STEP_KEYS[e.key] ? 0 : walkRef.current.hold;
    };
    // Leaving the window drops everything the reader was holding.
    const release = () => {
      Object.keys(keys).forEach((k) => { keys[k] = false; });
      walkRef.current.hold = 0;
    };
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', release);
      release();
    };
  }, [worldRooms]);
  useEffect(() => {
    if (!worldRooms || place === null) return undefined;
    const keys = lookRef.current.keys;
    const HELD = HELD_KEYS, STEP = STEP_KEYS;
    const onDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // While the heart plays, the map key is the only one: it ends it there.
      if (finale !== null) {
        if (e.key === 'm' || e.key === 'M' || e.key === 'Escape') setFinale('skip');
        if (HELD[e.key] || STEP[e.key]) e.preventDefault();
        return;
      }
      if (HELD[e.key]) {
        keys[HELD[e.key]] = true;
        e.preventDefault();
        return;
      }
      if (STEP[e.key]) {
        if (!e.repeat) foot(STEP[e.key]);
        e.preventDefault();
      } else if (e.key === 'e' || e.key === 'E') climb();
      else if ((e.key === 'm' || e.key === 'M' || e.key === 'Escape') && !moving) setTarget(null);
    };
    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, [worldRooms, place, moving, foot, climb, finale]);

  // The touch walk button let go of: stand where they are, as letting go of W.
  const standStill = () => {
    if (walkRef.current.hold === 1) walkRef.current.hold = 0;
    setHolding(false);
  };

  // Dragging in a room looks around, camera-style: the view follows the hand.
  const letGo = () => {
    dragRef.current = null;
    lookRef.current.dragging = false;
  };
  const lookHandlers = {
    onPointerDown: (e) => {
      // Looking about while walking leaves the walking course alone.
      // The drag is refused only
      // while the piece is doing the carrying.
      if (e.button !== 0 || moving) return;
      dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      // (the guiding hand keeps off the head while the reader's own is on it)
      lookRef.current.dragging = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    onPointerMove: (e) => {
      const d = dragRef.current;
      if (!d || d.id !== e.pointerId) return;
      lookRef.current.yaw -= (e.clientX - d.x) * 0.0045;
      lookRef.current.pitch -= (e.clientY - d.y) * 0.0035;
      d.x = e.clientX;
      d.y = e.clientY;
    },
    onPointerUp: (e) => { if (dragRef.current?.id === e.pointerId) letGo(); },
    onPointerCancel: (e) => { if (dragRef.current?.id === e.pointerId) letGo(); },
  };

  const node = NODES[shown];
  const isGarden = (i) => i > libraryMax;
  const kindOf = (i) => (isGarden(i) ? 'Path' : 'Gallery');
  const here = (i) => (i === resumeAt ? (shared ? 'where you were sent' : 'where you left off') : null);
  const invitation = resumeAt !== null
    ? `${shared ? 'Enter' : 'Return to'} ${NODES[resumeAt].title}, or choose a room`
    : 'Choose a room to begin';
  const status = worldRooms && worldFailed
    ? 'The Library could not be drawn on this device'
    : worldRooms && !liveWorld
      ? `Assembling the Library…${assembled > 0 ? ` ${Math.min(99, Math.round(assembled * 100))}%` : ''}`
      : opening !== null
        ? `Opening ${NODES[opening].title}…`
        : active && progress < 100
          ? `${invitation} · assembling ${Math.min(99, Math.round(progress))}%`
          // back on the map from the heart of the maze, the walk drawn in light
          : ended ? 'Time forks perpetually toward innumerable futures' : invitation;
  // Between the Vertigo and the Door the way is not a walk.
  const crossing = (from, to) => (from === libraryMax && to === libraryMax + 1
    ? 'fall'
    : from === libraryMax + 1 && to === libraryMax ? 'climb' : 'walk');
  const stepLabel = (from, to) => ({ fall: 'Fall · ', climb: 'Climb · ', walk: '' })[crossing(from, to)] + NODES[to].title;
  const underway = (from, to) => ({ fall: 'Falling into', climb: 'Climbing back to', walk: 'Walking on to' })[crossing(from, to)];

  // What the room's caption says (RoomVoice): everything it could say in this
  // room — the room's line, the story's lines, and for each way out the plain
  // "where to", the line for the road and the halfway stop — and which of them
  // it is saying now. The plain line is kept apart for a screen reader.
  const voice = (() => {
    if (place === null) return null;
    const room = NODES[place];
    const story = isGarden(place) ? STORY.garden : STORY.library;
    const quotes = (VOICES[room.slug] ?? []).map((text, k) => ({ id: `q${k}`, text, from: story }));
    const lines = [{ id: 'summary', text: room.summary }, ...quotes, { id: 'rising', text: 'Rising to the map…' }];
    if (vantage) {
      lines.push(
        { id: 'standing', text: vantage.standing },
        { id: 'climbing', text: vantage.climbing },
        { id: 'descending', text: vantage.descending },
      );
    }
    const ways = new Set([place - 1, place + 1, target]);
    ways.forEach((to) => {
      if (to === null || to === place || to < 0 || to >= NODES.length) return;
      const kind = crossing(place, to);
      const road = kind === 'walk' ? PASSAGES[isGarden(place) ? 'garden' : 'library'] : PASSAGES[kind];
      lines.push(
        { id: `to${to}`, text: `${underway(place, to)} ${NODES[to].title}…`, hold: 2200 },
        { id: `road${to}`, text: road[legs % road.length], from: kind === 'walk' ? story : STORY.library },
      );
    });
    // Out of every room on their own walk: where they are, and then the road's
    // own line, as it is given on the piece's walks.
    if (between) lines.push({ id: 'between', text: `Between ${NODES[between[0]].title} and ${NODES[between[1]].title}` });
    const wandering = between && !moving
      ? ['between', ...(lines.some((l) => l.id === `road${beyond}`) ? [`road${beyond}`] : [])]
      : null;
    // Into the heart of the maze, the room's own quotations say what is
    // happening, in step with it (finale.js): the others ("infinitely
    // saturated with invisible persons"), the one in the reader's own gate
    // ("in some you exist, and not I"), the rise over the net of light.
    if (place === last) lines.push({ id: 'fin-walk', text: 'Into the heart of the maze…' });
    const quote = (k) => quotes[k]?.id ?? 'summary';
    const heart = { walk: 'fin-walk', others: quote(3), you: quote(2), rise: quote(1), leave: quote(1) }[finalePhase];
    const lead = heart ? [heart]
      : finale !== null ? ['fin-walk']
        : wandering ?? (!moving ? [up ? 'standing' : 'summary']
          : target === null ? ['rising']
            : up !== toUp && target === place ? [toUp ? 'climbing' : 'descending']
              : [`to${target}`, `road${target}`]);
    const said = lines.find((l) => l.id === lead[0])?.text ?? '';
    return { lines, lead, quotes: moving || wandering ? [] : quotes.map((q) => q.id), said };
  })();

  // Everything a room needs to be a control, whichever overlay draws it.
  const roomProps = (i) => {
    const n = NODES[i];
    const cls = ['map-room', isGarden(i) ? 'is-garden' : 'is-library'];
    if (i === shown) cls.push('is-shown');
    if (i === shown && resting) cls.push('is-resting');
    if (i === opening) cls.push('is-opening');
    return {
      ref: (el) => { roomRefs.current[i] = el; },
      className: cls.join(' '),
      role: 'button',
      tabIndex: 0,
      'aria-label': `${kindOf(i)} ${MAP_NUMERAL[i]}: ${n.title} — ${n.subtitle}${here(i) ? `. ${here(i)}` : ''}`,
      onPointerDown: (e) => { pointerRef.current = e.pointerType; },
      // The caption stays with the last room pointed at (or focused) when the
      // pointer or the focus moves on, rather than flicking back to the
      // Vestibule across every gap between two rooms.
      onPointerEnter: (e) => { if (e.pointerType === 'mouse') setHot(i); },
      onFocus: () => setHot(i),
      onClick: () => {
        // A finger has no hover: its first tap puts the room on the card, the second goes in.
        if (pointerRef.current !== 'mouse' && picked !== i) {
          setPicked(i);
          return;
        }
        choose(i);
      },
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          choose(i);
        }
      },
    };
  };

  const label = (x, y, i) => (
    <text
      key={i}
      x={x}
      y={y}
      textAnchor="middle"
      className={`map-label${i === shown ? ' is-shown' : ''}${isGarden(i) ? ' is-garden' : ''}`}
    >
      <tspan className="map-label-numeral">{MAP_NUMERAL[i]}</tspan>
      <tspan dx="9">{NODES[i].title.toUpperCase()}</tspan>
    </text>
  );

  // The overlay in the still's frame.
  const stillOverlay = (
    <svg
      className="map-svg"
      viewBox={`0 0 ${FW} ${FH}`}
      preserveAspectRatio={tall ? 'xMidYMid meet' : 'xMidYMid slice'}
      role="group"
      aria-label="Map of the rooms, seen from above"
    >
      <defs>
        <path id="map-chevron" d="M-4 -6 L3 0 L-4 6" />
      </defs>
      <g className="map-route" aria-hidden="true">
        <g className="map-glow">
          <line className="is-library" x1="135.4" y1="840.8" x2="811.9" y2="450.2" />
          <polyline className="is-garden" points="1005.2,338.6 1080.2,295.3 1186,236 1216,218 1238,196 1262,186 1252,166 1276,156 1285,137 1305,110" />
          <polyline className="is-garden" points="1315,212 1311,266 1315,318 1315,423" />
        </g>
        <line className="is-library" x1="135.4" y1="840.8" x2="811.9" y2="450.2" />
        <g className="map-chevrons is-library">
          <use href="#map-chevron" transform="translate(183.7 812.9) rotate(-30)" />
          <use href="#map-chevron" transform="translate(328.7 729.2) rotate(-30)" />
          <use href="#map-chevron" transform="translate(522 617.6) rotate(-30)" />
          <use href="#map-chevron" transform="translate(715.3 506) rotate(-30)" />
        </g>
        <path className="map-fall" d="M811.9 450.2 Q 925 318 1005.2 338.6" />
        <polyline className="is-garden" points="1005.2,338.6 1080.2,295.3 1186,236 1216,218 1238,196 1262,186 1252,166 1276,156 1285,137 1305,110" />
        <polyline className="is-garden" points="1315,212 1311,266 1315,318 1315,423" />
        <g className="map-chevrons is-garden">
          <use href="#map-chevron" transform="translate(1133.1 265.7) rotate(-29.3)" />
          <use href="#map-chevron" transform="translate(1313 239) rotate(94.2)" />
          <use href="#map-chevron" transform="translate(1315 370.5) rotate(90)" />
        </g>
        <polyline className="map-not-taken" points="1186,236 1120,160 1000,88 890,30 840,-40" />
        <g transform="translate(811.9 450.2)">
          <circle className="map-pit-rim" r="18" />
          <path className="map-pit-spiral" d={SPIRAL} transform="translate(-2.4 0) scale(1.08)" />
        </g>
        <rect className="map-entrance" x="-2.5" y="-18" width="5" height="36" rx="1.2" transform="translate(135.4 840.8) rotate(-30)" />
      </g>
      {ROOMS.map((room, i) => (
        <g key={NODES[i].slug} {...roomProps(i)}>
          <RoomShape room={room} className="map-hit" />
          <RoomShape room={room} grow={6} className="map-outline-glow" />
          <RoomShape room={room} grow={6} className="map-outline" />
        </g>
      ))}
      <g className="map-labels" aria-hidden="true">
        {ROOMS.map((room, i) => label(room.label[0], room.label[1], i))}
      </g>
    </svg>
  );

  // The overlay projected through the live world's camera, in screen pixels:
  // the lantern (lanternFor) under everything, painted once per layout in an
  // svg of its own so that nothing hovered ever repaints its blur; then the
  // rooms, each with its numeral over its rim. The names are in the caption
  // alone.
  const lantern = layout && lanternFor(layout.rooms, libraryMax + 1);
  const fog = lantern && fogFor(lantern, layout.w, layout.h);
  const lanternOverlay = lantern && (
    <svg
      className="map-svg map-dim is-live"
      viewBox={`0 0 ${layout.w} ${layout.h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id="map-lantern-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={18 * lantern.scale} />
        </filter>
        <mask id="map-lantern">
          <rect width={layout.w} height={layout.h} fill="#fff" />
          <g filter="url(#map-lantern-soft)" fill="#000" stroke="#000" strokeLinejoin="round" strokeLinecap="round">
            {lantern.library.map((poly, k) => (
              <polygon key={k} points={toAttr(poly)} strokeWidth={28 * lantern.scale} />
            ))}
            <polyline points={toAttr(lantern.way)} fill="none" strokeWidth={64 * lantern.scale} />
            <ellipse {...lantern.garden} strokeWidth="0" />
          </g>
        </mask>
        <radialGradient
          id="map-fog"
          gradientUnits="userSpaceOnUse"
          cx={fog.cx}
          cy={fog.cy}
          r={fog.rx}
          gradientTransform={`translate(${fog.cx} ${fog.cy}) scale(1 ${(fog.ry / fog.rx).toFixed(4)}) translate(${-fog.cx} ${-fog.cy})`}
        >
          <stop offset="0" stopColor="#050403" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#050403" stopOpacity="0.55" />
          <stop offset="1" stopColor="#050403" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect className="map-dim-veil" width={layout.w} height={layout.h} mask="url(#map-lantern)" />
      <rect className="map-fog" width={layout.w} height={layout.h} fill="url(#map-fog)" mask="url(#map-lantern)" />
    </svg>
  );
  const worldOverlay = layout && (
    <svg
      className="map-svg is-live"
      viewBox={`0 0 ${layout.w} ${layout.h}`}
      preserveAspectRatio="none"
      role="group"
      aria-label="Map of the rooms, seen from above"
    >
      {layout.rooms.map((poly, i) => (
        <g key={NODES[i].slug} {...roomProps(i)}>
          <polygon className="map-hit" points={toAttr(poly)} />
          <polygon className="map-outline-glow" points={toAttr(poly)} />
          <polygon className="map-outline" points={toAttr(poly)} />
        </g>
      ))}
      <g className="map-numerals" aria-hidden="true">
        {layout.rooms.map((poly, i) => {
          const [x, y] = numeralAt(poly);
          return (
            <text
              key={i}
              x={x}
              y={y}
              className={`map-numeral${i === shown ? ' is-shown' : ''}${isGarden(i) ? ' is-garden' : ''}`}
            >
              {MAP_NUMERAL[i]}
            </text>
          );
        })}
      </g>
    </svg>
  );

  return (
    <section
      ref={sectionRef}
      className={`entry-map${tall ? ' is-tall' : ''}${leaving ? ' is-leaving' : ''}`
        + `${liveWorld ? ' is-world' : ''}${flying !== null ? ' is-flying' : ''}`
        + `${worldRooms ? ' is-world-tour' : ''}${worldRooms && !onMap ? ' is-in-room' : ''}`
        + `${worldRooms && !liveWorld ? ' is-assembling' : ''}`}
      aria-labelledby={worldRooms && place !== null ? 'room-title' : 'map-title'}
      style={{ '--zoom-origin': origin, '--hud-h': `${hudHeight}px` }}
    >
      <div className="map-stage" ref={stageRef} {...(worldRooms && place !== null ? lookHandlers : {})}>
        {worldOn && !worldFailed && (worldRooms || scenes) && (
          <WorldBoundary onError={() => setWorldFailed(true)}>
            <Suspense fallback={null}>
              <World
                rooms={worldRooms}
                scenes={scenes}
                target={worldRooms ? target : flying}
                vantage={worldRooms && toUp}
                reducedMotion={worldRooms && reducedMotion}
                lookRef={lookRef}
                walkRef={walkRef}
                fadeRef={fadeRef}
                onReady={() => setWorldReady(true)}
                onProgress={setAssembled}
                onPlan={worldRooms ? setPlan : undefined}
                onArrive={worldRooms ? undefined : (i) => onChoose(i)}
                onSettle={worldRooms ? settle : undefined}
                onRoam={worldRooms ? roam : undefined}
                onGo={worldRooms ? go : undefined}
                finale={worldRooms ? finale : null}
                onFinale={worldRooms ? onFinale : undefined}
                onLayout={setLayout}
              />
            </Suspense>
          </WorldBoundary>
        )}
        {!inkGone && !worldFailed && (
          <AssemblyInk
            driver={inkRef}
            progress={assembled}
            ready={worldReady}
            shown={liveWorld}
            plan={plan}
            reducedMotion={reducedMotion}
            onInked={() => setInked(true)}
            onGone={() => setInkGone(true)}
          />
        )}
        {liveOverlay && lanternOverlay}
        {worldRooms ? (
          <div inert={mapHidden} aria-hidden={mapHidden || undefined}>
            {liveOverlay && worldOverlay}
          </div>
        ) : liveOverlay ? worldOverlay : stillOverlay}
      </div>
      <div className="world-fade" ref={fadeRef} aria-hidden="true" />

      <div className="map-scrim" aria-hidden="true" />

      {/* One column, top left, read downward: the book, then the room. The
          title is set like an inscription over a door — Roman capitals between
          two hairlines, the one upright, capital voice on the sheet, so that
          no room's name (italic, in the caption under it) can outrank it.
          While the world is put together, the story's first sentence is found
          in the caption's place (Assembly.jsx), and the caption comes in where
          it goes out. On a phone the column comes apart (display: contents)
          and its pieces take their places above and below the map. */}
      <div className="map-head" inert={mapHidden} aria-hidden={mapHidden || undefined}>
        <header className="map-title">
          <span className="map-title-rule" aria-hidden="true" />
          <h1 className="map-title-name" id="map-title" lang="es">La Biblioteca de Babel</h1>
          <span className="map-title-rule" aria-hidden="true" />
          <div className="map-title-line">
            <span className="map-title-eyebrow">Jorge Luis Borges · 1941</span>
            <span className="map-status" role="status">{status}</span>
          </div>
        </header>

        {!inkGone && !worldFailed && <AssemblyEpigraph driver={inkRef} reducedMotion={reducedMotion} />}

        <aside ref={cardRef} className={`map-card${isGarden(shown) ? ' is-garden' : ''}`}>
          <div className="map-card-kicker">{`${kindOf(shown)} ${MAP_NUMERAL[shown]} of ${MAP_NUMERAL[NODES.length - 1]}`}</div>
          <h2 className="map-card-title">{node.title}</h2>
          <p className="map-card-sub">{node.subtitle}</p>
          <span className="map-card-rule" aria-hidden="true" />
          <p className="map-card-summary">{node.summary}</p>
          {here(shown) && <p className="map-card-here">{here(shown)}</p>}
          <button
            type="button"
            className="map-enter"
            disabled={opening !== null}
            onClick={() => choose(shown)}
          >
            {opening !== null ? 'Opening…' : `Enter ${node.title}`}
            <svg viewBox="0 0 16 10" aria-hidden="true"><path d="M1 5 H14 M10 1 L14 5 L10 9" /></svg>
          </button>
        </aside>
      </div>

      {worldRooms && place !== null && (
        <div ref={hudRef} data-room={NODES[place].slug} className={`room-hud${isGarden(place) ? ' is-garden' : ''}${moving ? ' is-moving' : ''}${finale !== null ? ` is-finale is-finale-${finalePhase ?? 'walk'}` : ''}`}>
          <section ref={plateRef} className="room-plate" aria-live="polite" aria-labelledby="room-title">
            <div className="room-kicker">{`${kindOf(place)} ${MAP_NUMERAL[place]} of ${MAP_NUMERAL[NODES.length - 1]}`}</div>
            <h2 ref={roomTitleRef} className="room-title" id="room-title" tabIndex={-1}>{NODES[place].title}</h2>
            <p className="room-sub">{NODES[place].subtitle}</p>
            <p className="sr-only">{voice.said}</p>
            <RoomVoice room={NODES[place].slug} lines={voice.lines} lead={voice.lead} quotes={voice.quotes} />
          </section>
          <nav ref={navRef} className="room-nav" aria-label="The walk">
            {/* The walk, in the corner across from the caption and in its
                voice: the way on large, the way back small under it, and
                beside them a seal of the eight rooms with this one lit, which
                is the map. It was a mono line of three equal pieces — back,
                eight dots that read as a carousel and said again what the
                caption's kicker says, on — with a generic map icon in a ring
                (the options canvas of 2026-10-09, C). Out in a hallway on
                their own walk, "where you are" is the last room walked into,
                and the room the hallway runs on to is marked. */}
            {(() => {
              const backTo = place - 1;
              const onTo = place + 1;
              const backText = place > 0
                ? `${crossing(place, backTo) === 'climb' ? 'climb back to' : 'back to'} ${NODES[backTo].title.replace(/^The /, 'the ')}`
                : 'the way in';
              const onText = place < last ? stepLabel(place, onTo) : 'Into the heart';
              return (
                <div className="room-ways">
                  <button
                    type="button"
                    className="room-step is-on"
                    disabled={moving}
                    aria-label={place === last ? 'Into the heart of the maze: the ending, a film of half a minute' : onText}
                    {...actionHandlers(() => send(1))}
                  >
                    {place < last && crossing(place, onTo) === 'fall' && <span className="room-step-verb">fall into</span>}
                    <span className="room-step-name">{place < last ? NODES[onTo].title : onText}</span>
                    {/* The last way on is not a walk to another room: it plays
                        the ending, and says so (webFix.js, 6). */}
                    {place === last && <span className="room-step-verb is-after">· the ending</span>}
                    {onTo < NODES.length && <span className={`room-step-num${isGarden(onTo) ? ' is-garden' : ''}`}>{MAP_NUMERAL[onTo]}</span>}
                    <svg viewBox="0 0 38 14" aria-hidden="true"><path d="M1 7 H36 M29 1.5 Q32.5 6 36 7 Q32.5 8 29 12.5" /></svg>
                  </button>
                  <button
                    type="button"
                    className="room-step is-back"
                    disabled={moving || place === 0}
                    aria-label={backText.charAt(0).toUpperCase() + backText.slice(1)}
                    {...actionHandlers(() => send(-1))}
                  >
                    <svg viewBox="0 0 24 10" aria-hidden="true"><path d="M23 5 H2 M6.5 1 Q4 4.2 2 5 Q4 5.8 6.5 9" /></svg>
                    {backTo >= 0 && <span className={`room-step-num${isGarden(backTo) ? ' is-garden' : ''}`}>{MAP_NUMERAL[backTo]}</span>}
                    <span className="room-step-name">{backText}</span>
                  </button>
                  {/* Where the room has somewhere else to stand: up to it, and
                      back down. Labelled with the place it goes, like the
                      walk's own buttons, and said in full to a screen reader. */}
                  {vantage && (
                    <button
                      type="button"
                      className="room-step is-climb"
                      disabled={moving}
                      aria-label={up ? `Come back down to ${NODES[place].title}'s floor` : `Climb up to ${vantage.name}`}
                      {...actionHandlers(climb)}
                    >
                      <svg viewBox="0 0 10 10" aria-hidden="true">
                        {up
                          ? <path d="M5 1 V8 M2 5 L5 8 L8 5" />
                          : <path d="M5 9 V2 M2 5 L5 2 L8 5" />}
                      </svg>
                      {up ? vantage.down : vantage.up}
                    </button>
                  )}
                </div>
              );
            })()}
            {/* The map is a way out of the walk, not a step along it: the
                seal of the eight rooms, the Library's up its diagonal in gold,
                the fall, and the garden's in jade. */}
            <button
              type="button"
              className="room-map"
              disabled={moving}
              aria-label="Map"
              title="Map (M)"
              {...actionHandlers(() => setTarget(null))}
            >
              <svg className="room-seal" viewBox="0 0 110 72" aria-hidden="true">
                <defs>
                  <filter id="room-seal-glow" x="-1" y="-1" width="3" height="3">
                    <feGaussianBlur stdDeviation="3" />
                  </filter>
                </defs>
                <path className="room-seal-fall" d={SEAL_FALL} />
                {NODES.map((_, i) => SEAL[i] && (
                  <g
                    key={i}
                    className={[
                      'room-cell',
                      isGarden(i) ? 'is-garden' : 'is-library',
                      i === place ? 'is-here' : i < place ? 'is-past' : 'is-ahead',
                      i === beyond ? 'is-next' : '',
                    ].join(' ')}
                  >
                    {i === place && <polygon className="room-cell-glow" points={hexAt(SEAL[i], 11)} filter="url(#room-seal-glow)" />}
                    <polygon points={hexAt(SEAL[i], 9)} />
                  </g>
                ))}
              </svg>
              <span className="room-map-name">The map</span>
            </button>
          </nav>
          {/* While the ending plays, the one thing left to do is to stop
              watching it: on screen for its whole length, on every device
              (M and Escape do the same). It ends where the film does, on
              the map. */}
          {finale !== null && (
            <button
              type="button"
              className="room-skip"
              disabled={finale === 'skip'}
              {...actionHandlers(() => setFinale((f) => (f === null ? f : 'skip')))}
            >
              Skip to the map
              <svg viewBox="0 0 38 14" aria-hidden="true"><path d="M1 7 H36 M29 1.5 Q32.5 6 36 7 Q32.5 8 29 12.5" /></svg>
            </button>
          )}
        </div>
      )}
      {/* The hint, bottom centre above the walk's buttons, in three stages: on
          arriving, the three things to do (walk, look, the map); once, as the
          reader first walks, the one rule the walk has (turning leaves the
          way) and the keys that only now apply; and on a touch screen, the
          walking itself, as a button held down like W. */}
      {worldRooms && place !== null && finale === null && (() => {
        const stage = tip ? 'tip' : !moving && (!walked || idle) ? 'arrive' : null;
        return (
          <div
            ref={assistRef}
            className={`room-assist${COARSE ? ' is-touch' : ''}${hintAt ? ' is-inline' : ''}${hintAt?.width ? ' is-tight' : ''}`}
            style={hintAt ? { left: `${hintAt.left}px`, bottom: `${hintAt.bottom}px`, maxWidth: hintAt.width ? `${hintAt.width}px` : undefined } : undefined}
          >
            <p
              className={`room-hint${stage ? ' is-shown' : ''}${stage === 'tip' ? ' is-tip' : ''}`}
              aria-hidden={stage ? undefined : 'true'}
            >
              {COARSE
                ? (stage === 'tip'
                  ? <span className="room-tip">Drag while walking to leave the path</span>
                  : <span className="room-tip">Drag to look · Hold to walk</span>)
                : stage === 'tip'
                  ? (
                    <>
                      <span className="room-tip">Turn while walking to leave the path</span>
                      <span className="room-key"><kbd>S</kbd>to step back</span>
                      {vantage && <span className="room-key"><kbd>E</kbd>{up ? 'back down' : `up to ${vantage.name}`}</span>}
                    </>
                  )
                  : (
                    <>
                      <span className="room-key"><kbd>W</kbd>to walk</span>
                      <span className="room-key"><kbd>drag</kbd>to look</span>
                      <span className="room-key"><kbd>M</kbd>for the map</span>
                    </>
                  )}
            </p>
            {COARSE && (
              <button
                type="button"
                className={`room-hold${holding ? ' is-held' : ''}`}
                aria-label="Hold to walk"
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  e.preventDefault();
                  foot(1);
                  setHolding(true);
                  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* no live pointer to keep */ }
                }}
                onPointerUp={standStill}
                onPointerCancel={standStill}
                onLostPointerCapture={standStill}
                onContextMenu={(e) => e.preventDefault()}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 19 V5 M6 11 L12 5 L18 11" />
                </svg>
              </button>
            )}
          </div>
        );
      })()}
    </section>
  );
}
