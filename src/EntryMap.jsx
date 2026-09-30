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
//               and the arrows look around; W walks on, S back, M is the map,
//               and E climbs to the room's vantage where it has one (the Echo's
//               crossing — buildWorld's VANTAGES) and back down again.
//   the plates  Tour.jsx (?plates). The flight ends at the room's Midjourney
//               plate and the reader is handed on to it (onChoose); with
//               reduced motion, or before the world has drawn, `enterAt` in
//               Tour.jsx stands the camera in the room and the map dissolves.
//               Until the world draws, the overlay waits alone over the dark
//               in its old 1440 × 900 frame.
import { Component, useCallback, useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { NODES } from './catalogue';
import { canDraw } from './Failure';
import { COARSE } from './capability';
import World from './world/World';
import { VANTAGES } from './world/buildWorld';
import RoomVoice from './RoomVoice';
import { PASSAGES, STORY, VOICES } from './voices';
import './map.css';

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

// Inside the tour the garden restarts its count (PATH I–IV), but on one sheet
// holding both worlds "I The Door" beside "I The Vestibule" reads as an error,
// so the map counts the whole walk.
const MAP_NUMERAL = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
// How long a reader stands with their hands off everything before the key caps
// come back.
const HINT_IDLE_MS = 15000;
// One cell of the honeycomb, for the walk's progress in the room HUD.
const HEX = '7,1 13,4.5 13,11.5 7,15 1,11.5 1,4.5';
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

  // Which room the card describes: the one being opened, else the one under
  // the pointer or the focus, else the one a touch picked, else where the
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
  const [layout, setLayout] = useState(null);
  const [flying, setFlying] = useState(null);
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const liveWorld = worldOn && worldReady && !worldFailed;
  const liveOverlay = liveWorld && layout !== null;

  // The world tour: where the reader stands (null on the map), and where the
  // camera is headed. The two differ while it flies, walks or falls.
  const sectionRef = useRef(null);
  const [place, setPlace] = useState(null);
  const [target, setTarget] = useState(null);
  // And, inside a room that has a second place to stand (buildWorld's VANTAGES),
  // whether the reader is up at it and whether they are headed there. The pair
  // is the room's own small walk, and it moves the same way the big one does.
  const [up, setUp] = useState(false);
  const [toUp, setToUp] = useState(false);
  // The walking foot. `hold` is the key the reader has down (+1 on, -1 back);
  // `demand` hands the walk over to the piece — +1 finish it, -1 bring me back,
  // 0 give it back to my hand — and World clears it once it has taken it.
  const walkRef = useRef({ hold: 0, demand: null });
  // Whose feet the walk is on, as World reports it: null when the piece is
  // carrying the reader, 'walking' when they are walking a leg themselves, and
  // 'stopped' when they have let go halfway — which is a place to be, so the
  // HUD says where it is and hands the buttons back.
  const [pace, setPace] = useState(null);
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
  const onTheWay = pace === 'stopped' && target !== null && target !== place;
  const moving = finale !== null || ((target !== place || up !== toUp) && !onTheWay);
  const onMap = place === null && target === null;
  const lookRef = useRef({ yaw: 0, pitch: 0, keys: { left: false, right: false, up: false, down: false } });
  const fadeRef = useRef(null);
  const dragRef = useRef(null);
  const settle = useCallback((p, atVantage = false) => {
    setFinale(null);
    setPlace(p);
    setTarget(p);
    setUp(atVantage);
    setToUp(atVantage);
    setPace(null);
    setOpening(null);
    setHot(null);
    setLegs((n) => n + 1);
  }, []);
  // Setting off, on foot. Holding the key IS the walking: let go and the reader
  // stops wherever they are and can look about; the piece only walks a leg by
  // itself when asked from the buttons (`send`).
  const foot = useCallback((dir, down) => {
    if (place === null) return;
    walkRef.current.hold = down ? dir : (walkRef.current.hold === dir ? 0 : walkRef.current.hold);
    if (!down) return;
    walkRef.current.demand = 0;   // whatever the piece was doing, the hand has it now
    if (onTheWay || moving) return;
    // On from the last room is into the heart of the maze, and the piece
    // does the walking there.
    if (place === last && dir === 1) {
      walkRef.current.hold = 0;
      setFinale('play');
      return;
    }
    const next = place + dir;
    if (next < 0 || next >= NODES.length) {
      walkRef.current.hold = 0;
      return;
    }
    // From a vantage the walk on sets off from up there, as one walk (World,
    // startMove's `off`): asked for together, down and on are the same move.
    if (up) setToUp(false);
    setTarget(next);
  }, [place, moving, onTheWay, up, last]);
  // The buttons: the piece does the walking. In a room that is the whole leg;
  // stopped along one it is either the rest of the way (+1) or back the way
  // they came (-1).
  const send = useCallback((step) => {
    if (place === null) return;
    if (onTheWay) {
      walkRef.current.demand = step === Math.sign(target - place) ? 1 : -1;
      setPace('walking');
      return;
    }
    if (moving) return;
    walkRef.current.hold = 0;
    if (place === last && step === 1) {
      setFinale('play');
      return;
    }
    const next = place + step;
    if (next < 0 || next >= NODES.length) return;
    if (up) setToUp(false);
    setTarget(next);
  }, [place, target, moving, onTheWay, up, last]);
  // What World says the heart is doing, and that it is over.
  const onFinale = useCallback((phase) => {
    if (phase === 'done') {
      setEnded(true);
      setFinalePhase(null);
    } else setFinalePhase(phase);
  }, []);
  // Up to the room's vantage, or back down from it.
  const climb = useCallback(() => {
    if (place === null || moving || onTheWay || !VANTAGES[place]) return;
    setToUp((u) => !u);
  }, [place, moving, onTheWay]);

  // The key caps. They used to be one long line of grey capitals across the
  // top of every room, on for good, barely lighter than the stone. Now they are
  // there when the reader first stands in a room, go once they have walked
  // (they know the keys by then), and come back only if the reader stands
  // with their hands off everything for a while — someone who has stopped
  // may be someone who is stuck.
  const [walked, setWalked] = useState(false);
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (place !== null && (moving || onTheWay)) setWalked(true);
  }, [place, moving, onTheWay]);
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

  const choose = useCallback((i) => {
    if (opening !== null) return;
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
  }, [opening, onChoose, liveWorld, reducedMotion, worldRooms]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' || !onMap) return;
      if (e.target !== document.body && e.target !== document.documentElement) return;
      choose(suggested);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, suggested, onMap]);

  // Standing in a room, or anywhere along a walk: the arrows and A/D look
  // around, W and S are the walking itself — held, not tapped, so the reader
  // goes at their own pace and stops where they like — E goes up to the room's
  // vantage (and back down), M (or Escape) rises to the map.
  useEffect(() => {
    if (!worldRooms || place === null) return undefined;
    const keys = lookRef.current.keys;
    const HELD = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const STEP = { w: 1, W: 1, s: -1, S: -1 };
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
        if (!e.repeat) foot(STEP[e.key], true);
        e.preventDefault();
      } else if (e.key === 'e' || e.key === 'E') climb();
      else if ((e.key === 'm' || e.key === 'M' || e.key === 'Escape') && !moving) setTarget(null);
    };
    const onUp = (e) => {
      if (HELD[e.key]) keys[HELD[e.key]] = false;
      else if (STEP[e.key]) foot(STEP[e.key], false);
    };
    // Leaving the window drops everything the reader was holding.
    const release = () => {
      Object.keys(keys).forEach((k) => { keys[k] = false; });
      walkRef.current.hold = 0;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', release);
      // NOT the walking foot: this effect is torn down and rebuilt every time
      // the walk's own state changes, which is to say on the very frame the
      // reader presses W — and dropping the key there stopped the walk dead on
      // the step it started. Only a hand that has actually let go clears it.
      Object.keys(keys).forEach((k) => { keys[k] = false; });
    };
  }, [worldRooms, place, moving, foot, climb, finale]);

  // Dragging in a room looks around, camera-style: the view follows the hand.
  const lookHandlers = {
    onPointerDown: (e) => {
      // Looking about WHILE walking is most of what walking is for, so the drag
      // is refused only while the piece is doing the carrying.
      if (e.button !== 0 || (moving && pace === null)) return;
      dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
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
    onPointerUp: (e) => { if (dragRef.current?.id === e.pointerId) dragRef.current = null; },
    onPointerCancel: (e) => { if (dragRef.current?.id === e.pointerId) dragRef.current = null; },
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
      ? 'Assembling the Library…'
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
        { id: `between${to}`, text: `Between ${NODES[Math.min(place, to)].title} and ${NODES[Math.max(place, to)].title}. Hold W to walk on, S to turn back.` },
      );
    });
    // Into the heart of the maze, the room's own quotations say what is
    // happening, in step with it (finale.js): the others ("infinitely
    // saturated with invisible persons"), the one in the reader's own gate
    // ("in some you exist, and not I"), the rise over the net of light.
    if (place === last) lines.push({ id: 'fin-walk', text: 'Into the heart of the maze…' });
    const quote = (k) => quotes[k]?.id ?? 'summary';
    const heart = { walk: 'fin-walk', others: quote(3), you: quote(2), rise: quote(1), leave: quote(1) }[finalePhase];
    const lead = heart ? [heart]
      : finale !== null ? ['fin-walk']
        : onTheWay ? [`between${target}`]
          : !moving ? [up ? 'standing' : 'summary']
            : target === null ? ['rising']
              : up !== toUp && target === place ? [toUp ? 'climbing' : 'descending']
                : [`to${target}`, `road${target}`];
    const said = lines.find((l) => l.id === lead[0])?.text ?? '';
    return { lines, lead, quotes: moving || onTheWay ? [] : quotes.map((q) => q.id), said };
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
      onPointerEnter: (e) => { if (e.pointerType === 'mouse') setHot(i); },
      onPointerLeave: () => setHot((h) => (h === i ? null : h)),
      onFocus: () => setHot(i),
      onBlur: () => setHot((h) => (h === i ? null : h)),
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

  // The overlay projected through the live world's camera, in screen pixels.
  const worldOverlay = layout && (
    <svg
      className="map-svg is-live"
      viewBox={`0 0 ${layout.w} ${layout.h}`}
      preserveAspectRatio="none"
      role="group"
      aria-label="Map of the rooms, seen from above"
    >
      <defs>
        <path id="map-chevron-live" d="M-4 -6 L3 0 L-4 6" />
      </defs>
      <g className="map-route" aria-hidden="true">
        <g className="map-glow">
          <polyline className="is-library" points={toAttr(layout.walk)} />
          <polyline className="is-garden" points={toAttr(layout.gardenWalk)} />
          <polyline className="is-garden" points={toAttr(layout.mazeLeg)} />
        </g>
        <polyline className="is-library" points={toAttr(layout.walk)} />
        <polyline className="map-fall" points={toAttr(layout.fall)} />
        <polyline className="is-garden" points={toAttr(layout.gardenWalk)} />
        <polyline className="is-garden" points={toAttr(layout.mazeLeg)} />
        <polyline className="map-not-taken" points={toAttr(layout.notTaken)} />
        <g className="map-chevrons is-library">
          {layout.chevronsLibrary.map((c, k) => (
            <use key={k} href="#map-chevron-live" transform={`translate(${c.x} ${c.y}) rotate(${c.angle})`} />
          ))}
        </g>
        <g className="map-chevrons is-garden">
          {layout.chevronsGarden.map((c, k) => (
            <use key={k} href="#map-chevron-live" transform={`translate(${c.x} ${c.y}) rotate(${c.angle})`} />
          ))}
        </g>
        <g transform={`translate(${layout.pit[0]} ${layout.pit[1]})`}>
          <circle className="map-pit-rim" r="18" />
          <path className="map-pit-spiral" d={SPIRAL} transform="translate(-2.4 0) scale(1.08)" />
        </g>
        <rect
          className="map-entrance"
          x="-2.5"
          y="-18"
          width="5"
          height="36"
          rx="1.2"
          transform={`translate(${layout.entrance.x} ${layout.entrance.y}) rotate(${layout.entrance.angle})`}
        />
      </g>
      {layout.rooms.map((poly, i) => (
        <g key={NODES[i].slug} {...roomProps(i)}>
          <polygon className="map-hit" points={toAttr(poly)} />
          <polygon className="map-outline-glow" points={toAttr(poly)} />
          <polygon className="map-outline" points={toAttr(poly)} />
        </g>
      ))}
      <g className="map-labels" aria-hidden="true">
        {layout.labels.map(([x, y], i) => {
          // Keep a label on the stage: mono 10.5px + 0.18em tracking is ~8.2px a letter.
          const half = (NODES[i].title.length * 8.2 + MAP_NUMERAL[i].length * 9 + 9) / 2 + 8;
          return label(Math.min(layout.w - half, Math.max(half, x)), y, i);
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
      aria-labelledby="map-title"
      style={{ '--zoom-origin': origin }}
    >
      <div className="map-stage" ref={stageRef} {...(worldRooms && place !== null ? lookHandlers : {})}>
        {worldOn && !worldFailed && (worldRooms || scenes) && (
          <WorldBoundary onError={() => setWorldFailed(true)}>
            <World
              rooms={worldRooms}
              scenes={scenes}
              reserveLeft={!tall}
              target={worldRooms ? target : flying}
              vantage={worldRooms && toUp}
              reducedMotion={worldRooms && reducedMotion}
              lookRef={lookRef}
              walkRef={walkRef}
              fadeRef={fadeRef}
              onReady={() => setWorldReady(true)}
              onArrive={worldRooms ? undefined : (i) => onChoose(i)}
              onSettle={worldRooms ? settle : undefined}
              onPace={worldRooms ? setPace : undefined}
              finale={worldRooms ? finale : null}
              onFinale={worldRooms ? onFinale : undefined}
              onLayout={setLayout}
            />
          </WorldBoundary>
        )}
        {liveOverlay ? worldOverlay : worldRooms ? null : stillOverlay}
      </div>
      <div className="world-fade" ref={fadeRef} aria-hidden="true" />

      <div className="map-frame" aria-hidden="true" />
      <div className="map-scrim" aria-hidden="true" />

      <header className="map-title">
        <div className="map-title-eyebrow">J. L. Borges — 1941</div>
        <h1 className="map-title-name" id="map-title">La Biblioteca de Babel</h1>
        <div className="map-status" role="status">{status}</div>
      </header>

      <div className="map-key" aria-hidden="true">
        <div className="map-key-tab">Key</div>
        <ul>
          <li>
            <svg viewBox="0 0 18 18"><rect x="7" y="1" width="4" height="16" rx="1" className="map-entrance" /></svg>
            Entrance
          </li>
          <li>
            <svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.5" className="map-key-lamp-halo" /><circle cx="9" cy="9" r="3" className="map-key-lamp" /></svg>
            Lamp
          </li>
          <li>
            <svg viewBox="-9 -9 18 18"><circle r="8" className="map-pit-rim" /><path d="M0 0 a2 2 0 0 1 4 0 a4 4 0 0 1 -8 0 a6 6 0 0 1 12 0" transform="translate(-1.2 0) scale(0.62)" className="map-pit-spiral" /></svg>
            The fall to the garden
          </li>
          <li>
            <svg viewBox="0 0 18 18"><path d="M2 3 L8 9 L2 15" className="map-key-walk is-library" /><path d="M10 3 L16 9 L10 15" className="map-key-walk is-garden" /></svg>
            The walk
          </li>
          <li>
            <svg viewBox="0 0 18 18"><path d="M1 9 H17" className="map-key-not-taken" /></svg>
            The road not taken
          </li>
          <li className="map-key-scale">
            <svg viewBox="0 0 18 18"><polygon points="17,9 13,15.9 5,15.9 1,9 5,2.1 13,2.1" className="map-key-hex" /></svg>
            One gallery · 20 shelves of 35 books
          </li>
        </ul>
      </div>

      <aside className={`map-card${isGarden(shown) ? ' is-garden' : ''}`}>
        <div className="map-card-tab">{`${kindOf(shown)} ${MAP_NUMERAL[shown]}`}</div>
        <h2 className="map-card-title">{node.title}</h2>
        <p className="map-card-sub">{node.subtitle}</p>
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

      {worldRooms && place !== null && (
        <div className={`room-hud${isGarden(place) ? ' is-garden' : ''}${moving ? ' is-moving' : ''}${finale !== null ? ` is-finale is-finale-${finalePhase ?? 'walk'}` : ''}`}>
          <section className="room-plate" aria-live="polite" aria-labelledby="room-title">
            <div className="room-kicker">{`${kindOf(place)} ${MAP_NUMERAL[place]} of ${MAP_NUMERAL[NODES.length - 1]}`}</div>
            <h2 className="room-title" id="room-title">{NODES[place].title}</h2>
            <p className="room-sub">{NODES[place].subtitle}</p>
            <span className="room-plate-rule" aria-hidden="true" />
            <p className="sr-only">{voice.said}</p>
            <RoomVoice room={NODES[place].slug} lines={voice.lines} lead={voice.lead} quotes={voice.quotes} />
          </section>
          <nav className="room-nav" aria-label="The walk">
            {/* The walk as one line: the room behind, where you are among the
                eight, the room ahead. They used to be three equal outlined
                pills with the map weighing as much as the rooms and nothing to
                say how far along the walk the reader was. Stopped along a walk,
                the two ends are that walk's two ends: back the way you came, or
                on the way you were going. */}
            {(() => {
              const backTo = onTheWay ? place : place - 1;
              const onTo = onTheWay ? target : place + 1;
              const backText = onTheWay ? `Back to ${NODES[place].title}` : place > 0 ? stepLabel(place, place - 1) : 'The way in';
              const onText = onTheWay
                ? `On to ${NODES[target].title}`
                : place < last ? stepLabel(place, place + 1) : 'Into the heart';
              return (
                <div className="room-walk">
                  <button
                    type="button"
                    className="room-step is-back"
                    disabled={moving || (!onTheWay && place === 0)}
                    aria-label={backText}
                    onClick={() => send(-1)}
                  >
                    <svg viewBox="0 0 16 10" aria-hidden="true"><path d="M15 5 H2 M6 1 L2 5 L6 9" /></svg>
                    {backTo >= 0 && <span className={`room-step-num${isGarden(backTo) ? ' is-garden' : ''}`}>{MAP_NUMERAL[backTo]}</span>}
                    <span className="room-step-name">{backText}</span>
                  </button>
                  <div
                    className="room-progress"
                    role="img"
                    aria-label={`${kindOf(place)} ${place + 1} of ${NODES.length}`}
                  >
                    {NODES.map((_, i) => (
                      <svg
                        key={i}
                        viewBox="0 0 14 16"
                        aria-hidden="true"
                        className={[
                          'room-cell',
                          isGarden(i) ? 'is-garden' : 'is-library',
                          i === place ? 'is-here' : i < place ? 'is-past' : 'is-ahead',
                          onTheWay && i === target ? 'is-next' : '',
                        ].join(' ')}
                      >
                        <polygon points={HEX} />
                      </svg>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="room-step is-on"
                    disabled={moving}
                    aria-label={!onTheWay && place === last ? 'Into the heart of the maze' : onText}
                    onClick={() => send(1)}
                  >
                    <span className="room-step-name">{onText}</span>
                    {onTo < NODES.length && <span className={`room-step-num${isGarden(onTo) ? ' is-garden' : ''}`}>{MAP_NUMERAL[onTo]}</span>}
                    <svg viewBox="0 0 16 10" aria-hidden="true"><path d="M1 5 H14 M10 1 L14 5 L10 9" /></svg>
                  </button>
                </div>
              );
            })()}
            {/* Where the room has somewhere else to stand: up to it, and back
                down. Labelled with the place it goes, like the walk's own
                buttons, and said in full to a screen reader. */}
            {vantage && !onTheWay && (
              <button
                type="button"
                className="room-step is-climb"
                disabled={moving}
                aria-label={up ? `Come back down to ${NODES[place].title}'s floor` : `Climb up to ${vantage.name}`}
                onClick={climb}
              >
                <svg viewBox="0 0 10 10" aria-hidden="true">
                  {up
                    ? <path d="M5 1 V8 M2 5 L5 8 L8 5" />
                    : <path d="M5 9 V2 M2 5 L5 2 L8 5" />}
                </svg>
                {up ? vantage.down : vantage.up}
              </button>
            )}
            <span className="room-rule" aria-hidden="true" />
            {/* The map is a way out of the walk, not a step along it: an icon,
                apart from the rooms. */}
            <button
              type="button"
              className="room-map"
              disabled={moving}
              aria-label="Map"
              title="Map (M)"
              onClick={() => setTarget(null)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <polygon points="1.5 6 1.5 21.5 8 18 16 21.5 22.5 18 22.5 2.5 16 6 8 2.5 1.5 6" />
                <line x1="8" y1="2.5" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="21.5" />
              </svg>
            </button>
          </nav>
        </div>
      )}
      {worldRooms && place !== null && (
        <p
          className={`room-hint${(!moving || onTheWay) && (!walked || idle) ? ' is-shown' : ''}`}
          aria-hidden="true"
        >
          {COARSE
            ? <span>Drag to look around</span>
            : (
              <>
                <span className="room-key"><kbd>W</kbd> walk on</span>
                <span className="room-key"><kbd>S</kbd> back</span>
                <span className="room-key"><kbd>A</kbd><kbd>D</kbd> or drag to look</span>
                {vantage && !onTheWay && <span className="room-key"><kbd>E</kbd> {up ? 'back down' : `up to ${vantage.name}`}</span>}
                <span className="room-key"><kbd>M</kbd> map</span>
              </>
            )}
        </p>
      )}
    </section>
  );
}
