// TODO(beauty) — REMAINING PLAN (delete each item when done):
//  16. README: describe the actual project + how to add per-chapter artwork
//      (nodes/<slug>/ color+depth pairs — needs new art, stays documented).
//
// 13 (postprocessing) is done — see src/Finish.jsx.
// 14 (device tier) is done — powerPreference, the dpr cap, and the plane-segment
// reduction on coarse-pointer devices all read from src/capability.js.
import { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import * as THREE from 'three';
import { useProgress, useTexture } from '@react-three/drei';
import DioramaScene, { BAY_ANGLE, TURN_BAYS } from './DioramaScene';
import { platesOf } from './backdrops';
import AmbientSound from './ambientSound';
import { RITE_NAME } from './rites';
import { Failure, SceneBoundary, canDraw } from './Failure';
import {
  recallWalk, rememberWalk, forgetPosition, markSeen, unseenFirst,
  sharedSlug, writeSlug,
} from './memory';
import { COARSE } from './capability';
import {
  NODES, POOLS, PINNED, LIBRARY_NODES, LIBRARY_SLUGS,
  sceneOf, livingFirst, redrawScene,
} from './catalogue';
import { SCATTER, SCATTER_GONE_MS } from './scatter';



// ── The Fork ────────────────────────────────────────────────────────────────
// The garden is forking paths; the corridor was a line. Every gallery drew its
// variant at random on load, so WHICH of the Fork's gardens the reader walked
// into was settled before they arrived and by nothing they did — the one room
// in the piece whose whole subject is that a choice was made.
//
// So the crossing into it is a choice now. Two of its gardens are drawn as
// candidates, and which becomes real is decided by where the reader is LOOKING
// as they cross: yaw at the commit point, nothing else. The other never
// existed — or rather, it existed on the path not taken, which is what the
// whisper on the far side says.
const FORK_INDEX = LIBRARY_SLUGS.length + 1;  // VI, the second room of the garden
// How far into the V → VI crossing the choice is committed. Late enough that
// the reader has had the whole approach to turn, early enough that the arriving
// gallery is still buried in fog when it is swapped, so nothing pops.
const FORK_COMMIT = 0.42;
// How far the gaze must be off the corridor's axis to count as a turn, in BAYS
// (the unit the turn is carried in — see the turn refs). The gaze eases back
// toward centre on its own, so a turn has to be HELD through the commit rather
// than flicked. Under this the reader chose nothing, and the world draws for
// them — silently, because the whisper would be claiming they turned when they
// did not. Read off the turn rather than off the camera's yaw, because past a
// fifth of a bay the yaw stops growing and eventually swings back through zero:
// a reader standing with their back to the corridor has a yaw of nothing at all.
const FORK_TURN = 0.056;
// The widest the card can be eyed before its own edge starts to swing into
// frame — so the most of a turn the body itself can ever carry (~19deg either
// side). Everything past it is spent on the panorama instead; see the turn refs.
const YAW_SWING = 0.34;
const PITCH_MAX = 0.24; // ~14deg up or down
// Bays of turn per full-width drag, and per arrow-key press. Both were once
// angles (0.748 rad and 0.08); near home a bay of turn is worth YAW_SWING·π of
// yaw, so these are those same two movements carried over unchanged.
const TURN_DRAG = 0.748 / (YAW_SWING * Math.PI);
const TURN_STEP = 0.08 / (YAW_SWING * Math.PI);
// A HELD arrow is not a stream of presses. The OS repeats a held key about
// thirty times a second, and each repeat used to add a whole TURN_STEP — with a
// full circle only TURN_BAYS (2) wide, that spun the room round better than
// once a second, which is not looking around, it is a fairground ride. So a tap
// is one step and a HOLD is paced by the clock instead: the head turns at a
// steady rate for as long as the key is down, however fast the keyboard repeats.
// A full circle in about seven seconds — the pace of someone taking a room in.
const TURN_HOLD = 0.28;   // bays per second held
// Shift is the fine adjustment: a quarter of the step and a quarter of the
// speed, for lining a detail up rather than looking around. It had no meaning
// at all on this axis before (Shift+←/→ was plain ←/→), while Shift+↑/↓ tilted
// the gaze — so a reader who found the one reasonably expected the other.
const TURN_FINE = 0.25;
// How far a touch has to travel before the gesture decides what it IS. Below
// this the drag is still ambiguous and only turns the world; past it the larger
// axis wins and holds for the rest of the gesture — see handlePointerMove.
const AXIS_LOCK = 10;
const FORK_WHISPER_MS = 6600;
const forkWhisper = (missed) => `in another garden, you turned ${missed}.`;
// …and the invitation that has to come BEFORE it. The choice is read off the
// gaze at FORK_COMMIT, which the crossing's spring reaches about two seconds in
// — far too little to notice a hint, understand it and turn. So it is spoken in
// the room ahead of the Fork instead, where the reader has a whole dwell to look
// around in, and it names the gesture rather than a key: looking IS the choice
// here, and a reader who never learns that has the road drawn for them by a coin
// toss. Unlike the echo this is a condition, not an answer — it stands for
// exactly as long as the choice is still open (see .door-whisper.is-call).
const FORK_CALL_WHISPER = 'the path divides ahead. look the way you would go.';
// The room itself running late. The entry veil covers the FIRST load and says so
// ("the library is assembling"); nothing covered any load after it, so a gallery
// reached before its plates had landed presented as a fully dressed HUD — title,
// quote, lit lantern — wrapped around an empty black box, which reads as a piece
// that has broken rather than one still arriving. Held back by a grace period:
// on a warm cache the wait is a few frames, and a pill flashing at every crossing
// would be worse than the silence it replaces.
const ARRIVING_GRACE_MS = 1400;
const ARRIVING_WHISPER = 'the room is still arriving…';

// Two DIFFERENT gardens to hang either side of the path. Null where the node
// cannot offer two, in which case there is no fork and the crossing behaves as
// it always did. Drawn once per visit rather than per crossing: walking back up
// and down again must not re-roll a road already taken.
const forkCandidates = () => {
  const { map, slug } = POOLS[FORK_INDEX];
  const node = map[slug];
  const living = livingFirst(node.variants);
  if (living.length < 2) return null;
  // Both roads unseen where the node can still field two of them — a fork whose
  // other side is a garden this reader already walked is only half a choice.
  const fresh = unseenFirst(living);
  const pool = fresh.length >= 2 ? fresh : living;
  const a = Math.floor(Math.random() * pool.length);
  // Draw the second from the remaining ones by index, so the two can never be
  // the same garden and neither is favoured.
  let b = Math.floor(Math.random() * (pool.length - 1));
  if (b >= a) b += 1;
  const hang = (variant) => {
    const clips = variant.videos ?? [];
    return sceneOf(node, variant,
      clips.length ? clips[Math.floor(Math.random() * clips.length)] : undefined);
  };
  return { left: hang(pool[a]), right: hang(pool[b]) };
};

// A gallery may only be re-hung while nobody can see it. Behind the camera
// DioramaScene's depth-ordered melt has swept clear of the whole plate by about
// half a chapter past it (`th` drops under the depth range at uFade ~0.71) and
// it stops being drawn at 0.96; ahead, it stays culled until 1.4 chapters out.
//
// Two thresholds, because arming a gallery and hanging it happen a moment apart.
// A gallery is only ARMED from a whole-number rest point — standing in a room,
// the one at your back qualifies, and that is exactly what lets the room you
// just left be a different room when you turn around. It is still HUNG if the
// reader has started walking since, as long as the plate is safely inside its
// dissolve: that slack is worth about a second and a half of the crossing's
// ease, so turning straight back does not cost you the fresh painting. Ahead
// there is no such slack — the melt runs behind the camera only — so the commit
// edge sits just past the cull.
const ARMED = { behind: 0.99, ahead: 1.6 };
const COMMIT = { behind: 0.72, ahead: 1.45 };
const outOfSight = (descent, index, edge) => {
  const behind = descent - index;
  return behind > edge.behind || behind < -edge.ahead;
};

// Decode a scene's plates before hanging them, so the swap itself costs nothing.
const decodePlates = (scene) => Promise.all(platesOf(scene).map(
  (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
    if (img.decode) img.decode().then(resolve, resolve);
  }),
));

const LIBRARY_MAX = LIBRARY_NODES.length - 1;
const MAX = NODES.length - 1;
const clamp = (v, max) => Math.min(Math.max(v, 0), max);
const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
// The opening withdrawal's curve: smootherstep, which is smoothstep with a
// second derivative of zero at both ends as well as a first. Over seven seconds
// that difference is the whole character of the move — the shot has to LEAVE
// from rest and ARRIVE at rest, with no moment where the eye can catch the
// camera starting or stopping, or the establishing shot reads as a dolly being
// pushed by hand. Slow off the mark also means the first second of it plays
// under the dissolving title card, so the card lifts off a frame already moving.
const smootherstep = (x) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

// ── Where the walk begins, and whether it is remembered ─────────────────────
// A session driven by the query pins (?variant, ?clip, ?dev, ?ch, ?node) is a
// workshop session: it exists to hold one thing still and look at it, and it
// must not leave marks on the reader's own walk — neither the position it ends
// at nor the plates it hangs count as having been shown.
const DEV_PINNED = typeof window !== 'undefined' && import.meta.env.DEV
  && ['dev', 'ch', 'node'].some(
    (k) => new URLSearchParams(window.location.search).has(k));
const REMEMBERS = !PINNED && !DEV_PINNED;

// Three things can say where the reader starts, in this order:
//
//   the query pins   — handled elsewhere (the dev hook below); this stands off
//   a #hash          — someone was SENT here. ?variant/?clip name files and are
//                      tools; what a reader can pass on is a room, so the hash
//                      carries the gallery's slug and outranks the bookmark
//   the last walk    — where they left off, if they have been here before
//
// Nothing is entered automatically: this only decides what is behind the
// overture, and the veil offers the reader the Vestibule either way.
const openingPosition = () => {
  if (!REMEMBERS) return null;
  const slug = sharedSlug();
  const shared = slug ? NODES.findIndex((n) => n.slug === slug) : -1;
  if (slug && shared < 0) {
    console.warn('[link] no gallery named %o — known: %s', slug,
      NODES.map((n) => n.slug).join(', '));
  }
  const saved = recallWalk();
  // A shared link is an explicit intention and a bookmark is only a habit, so
  // the link wins — but the door the reader earned on an earlier visit stays
  // earned either way, and any landing in the garden implies it.
  const at = shared >= 0 ? shared : clamp(Math.round(saved.chapter), MAX);
  const door = saved.door || at > LIBRARY_MAX;
  if (at === 0 && !door) return null;
  return { at, door, shared: shared > 0 };
};

// Pre-parse accent colors once for continuous interpolation between chapters.
const ACCENTS = NODES.map((n) => new THREE.Color(n.accent));

// The marginal hand names where you are in words rather than in a panel:
// "THE SILENCE — GALLERY III", "THE FORK — PATH II". A reader of the Library
// would number its rooms, not read a progress meter. The same numeral marks
// the node on the plumb line.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const NUMERAL = NODES.map((_, i) =>
  ROMAN[(i > LIBRARY_MAX ? i - LIBRARY_MAX : i + 1) - 1]);
const MARKS = NODES.map((node, i) =>
  `${node.title.toUpperCase()} — ${i > LIBRARY_MAX ? 'PATH' : 'GALLERY'} ${NUMERAL[i]}`);

// What the world says when it refuses a step. At the sealed vertigo the refusal
// is temporary and the whisper says so — the wait IS the key, so this is the
// same instruction the help panel gives, spoken at the moment it applies. At the
// far end of the garden nothing further opens, so it names the end instead.
// Timings are matched to .door-whisper.is-refusal's appear-hold-fade run.
const REFUSAL_WHISPER_MS = 5200;
const REFUSE_MS = 900; // one answer per bump; a scroll burst is still one bump
// At the path's end "turn back" is not only spoken — after it has hung long
// enough to be read, the world carries it out and walks the reader back itself.
const TURN_BACK_MS = 2600;
const SEALED_WHISPER = 'the stair ends in dark. wait.';
const PATH_END_WHISPER = 'the web closes here. turn back.';


// The drift's floor and ceiling. Between them it waits on the room itself: the
// quote's full cycle, and the surface's first pass.
//   MIN — even a room that says nothing gets long enough to be looked at, and
//         it covers the ~7 s crossing that precedes the dwell.
//   MAX — nothing may stall the drift forever. A gallery with no clip, one
//         whose clip fails to decode, or a tab throttled in the background all
//         land here, and the drift moves on rather than parking.
// --- How fast the body moves --------------------------------------------
// Mutable and dialled live by window.__walk, for the same reason FILL and GAIT
// are: pace is judged by feel, and a compile-time constant cannot be compared
// against itself inside one session.
//
//   imm  immersion units per second for the walk-in. x APPROACH (10) gives
//        world units/s, so 0.15 = 1.5 u/s. It MUST be read together with
//        STRIDE_LENGTH in DioramaScene.jsx: speed / stride is the step cadence,
//        and cadence is what separates walking from gliding. At 1.5 u/s over a
//        1.6-unit stride that is 1.88 footfalls/s, a human walking rate.
//   k    stiffness of the corridor crossing's critically damped spring. Peak
//        speed is sqrt(k)/e x SCENE_SPACING, so k=0.30 crests at ~2.8 u/s over
//        a ~9.5 s crossing; the old 0.55 crested at ~3.8 u/s in ~7 s, which was
//        faster mid-corridor than the walk-in ever went — a room you cross at a
//        run and then step into slowly reads as two different bodies.
//
//   window.__walk()               → read the current values
//   window.__walk({ imm: 0.11 })  → set one, live, no reload
const WALK = { imm: 0.15, k: 0.30 };

const DRIFT_MIN_DWELL = 9000;
const DRIFT_MAX_DWELL = 38000;

const NARROW_QUERY = '(max-width: 720px)';

// Renders `render(id)` and, when `id` changes, keeps the outgoing copy mounted
// briefly so it can drift up and out while the new one surfaces from below
// (the camera sinks, so the world moves upward). Layers carry their own id —
// tour.css owns the motion.
function FadeSwap({ id, render }) {
  const [layers, setLayers] = useState(() => [{ id, leaving: false }]);
  useEffect(() => {
    setLayers((prev) => {
      const current = prev.find((l) => !l.leaving);
      if (current && current.id === id) {
        return prev;
      }
      return [{ id, leaving: false }, ...(current ? [{ ...current, leaving: true }] : [])];
    });
    const timer = setTimeout(
      () => setLayers((prev) => prev.filter((l) => !l.leaving)),
      1200,
    );
    return () => clearTimeout(timer);
  }, [id]);
  return (
    <div className="swap-stage">
      {layers.map((l) => (
        <div key={l.id} className={l.leaving ? 'swap-leave' : 'swap-enter'}>
          {render(l.id)}
        </div>
      ))}
    </div>
  );
}

// The overture's backdrop: /overture.mp4, cut from the Echo's var17 clip1 (the
// great arch, the procession crossing it, two lit lanterns) — the one library
// clip whose push-in leaves a dark, quiet centre under the arch for the title to
// sit in. Built PING-PONG, forward then reversed with both seam frames dropped,
// so a reader who sits here watches the camera breathe in and out of the arch
// rather than hit a cut every five seconds. Baked with the same gamma the live
// surfaces get (VIDEO_GAMMA in DioramaScene) because the i2v renders are pale
// against the stills, and played at half rate so the overture moves at the
// tour's pace and not the clip's. Regenerate with:
//   ffmpeg -i public/video-x4/05-impossible-prison-staircases-var17-clip1.mp4 \
//     -filter_complex "[0:v]eq=gamma=0.763,split[a][b];[b]reverse,\
//       trim=start_frame=1:end_frame=120,setpts=PTS-STARTPTS[r];\
//       [a][r]concat=n=2:v=1:a=0[v]" -map "[v]" -an -c:v libx264 -preset slow \
//     -crf 23 -pix_fmt yuv420p -movflags +faststart public/overture.mp4
const OVERTURE_CLIP = '/overture.mp4';
const OVERTURE_POSTER = '/overture-poster.jpg';
// The clip's own tempo is a five-second dolly. The tour walks slower than that
// (VIDEO_RATE runs the surfaces at 0.42), so the overture is halved to land in
// the same register — 20 s a round trip through the arch.
const OVERTURE_RATE = 0.5;

// The overture: a title card over the arch while textures stream in, then an
// invitation. The dismissing click doubles as the user gesture that unlocks audio.
//
// `resume` is where this reader was left standing — their own last position, or
// the gallery a link sent them to (see openingPosition). It never takes the
// choice away: the invitation names the room the click will open on, and the
// Vestibule is one line below it. Absent, this is the title card it always was.
function EntryVeil({ leaving, onEnter, onBegin, resume, reduced, first }) {
  const { active, progress } = useProgress();
  const [timedOut, setTimedOut] = useState(false);
  const [plated, setPlated] = useState(false);
  const [filmed, setFilmed] = useState(false);
  const videoRef = useRef(null);
  useEffect(() => {
    // The last resort, not the plan: if the opening plates never decode at all
    // the reader still gets in, onto whatever the corridor manages to draw.
    const timer = setTimeout(() => setTimedOut(true), 15000);
    return () => clearTimeout(timer);
  }, []);
  // What the door actually waits on: the ONE gallery this click opens into.
  //
  // It used to wait on drei's global progress, which is every plate in the
  // corridor — eight images for four rooms, of which the reader can see one.
  // On a cold cache that is thirteen seconds of a title card that cannot be
  // dismissed, and the piece's whole first impression is a wait. The rooms
  // behind this one have a whole gallery's dwell to arrive in, and if one is
  // still missing when it is reached the corridor already says so in its own
  // voice (ARRIVING_WHISPER) rather than presenting an empty black box.
  //
  // Decoded off the same URLs the loader is fetching, so this rides the
  // browser's cache rather than doubling the download.
  const firstColor = first?.color;
  const firstDepth = first?.depth;
  useEffect(() => {
    if (!firstColor) return undefined;
    let alive = true;
    decodePlates({ color: firstColor, depth: firstDepth })
      .then(() => { if (alive) setPlated(true); });
    return () => { alive = false; };
  }, [firstColor, firstDepth]);
  const ready = plated || timedOut || (!active && progress === 100);

  const enter = (event) => {
    event.stopPropagation();
    if (ready) {
      onEnter();
    }
  };
  return (
    <div
      className={`entry-veil${leaving ? ' is-leaving' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Enter the Library"
      onClick={enter}
      onKeyDown={(event) => {
        // The card is one big button, and now has a small one inside it. A
        // keyboard activation of "begin again" would otherwise be answered
        // twice — the button's own click AND the card's, which is the walk the
        // reader just declined. Same guard the corridor's keydown uses.
        if (event.target instanceof Element && event.target.closest('button')) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          enter(event);
        }
      }}
    >
      {/* The poster carries the frame until the clip can play, and stays as the
          whole backdrop under prefers-reduced-motion — the overture is a title
          card either way, so there is nothing to lose by holding it still. The
          film only fades in on `playing`, so a stalled or blocked autoplay
          (a data-saver, a battery-saver, an old iOS) degrades to the poster
          rather than to black. Neither one gates `ready`: this is scenery, and
          the reader waits on the textures, never on it. */}
      <div className="entry-film" aria-hidden="true">
        <img className="entry-film-still" src={OVERTURE_POSTER} alt="" />
        {!reduced && (
          <video
            ref={videoRef}
            className={`entry-film-reel${filmed ? ' is-playing' : ''}`}
            src={OVERTURE_CLIP}
            poster={OVERTURE_POSTER}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onPlaying={() => {
              // playbackRate resets whenever the element re-loads a source, so
              // set it here rather than once on mount.
              if (videoRef.current) {
                videoRef.current.playbackRate = OVERTURE_RATE;
              }
              setFilmed(true);
            }}
            // The poster carries the card if this never arrives, so the reader
            // loses nothing — but "the overture is a still today" is otherwise
            // silent, and it is the same missing-file trap the gallery clips
            // have (see mediaFault in DioramaScene).
            onError={() => console.warn(
              '[overture] %s did not load (%s) — the title card holds its poster',
              OVERTURE_CLIP, videoRef.current?.error?.code ?? '?')}
          />
        )}
        <div className="entry-film-scrim" />
      </div>
      <div className="entry-eyebrow">J. L. Borges — 1941</div>
      <h1 className="entry-title">La Biblioteca de Babel</h1>
      <div className="entry-rule" />
      <div className="entry-status">
        {ready
          ? (resume
            ? `Click to ${resume.shared ? 'enter' : 'return to'} ${resume.title}`
            : 'Click to descend')
          : `The Library is assembling… ${Math.min(99, Math.round(progress))}%`}
      </div>
      {ready && resume && (
        <button
          type="button"
          className="entry-restart"
          onClick={(event) => {
            event.stopPropagation(); // not the veil's own "enter where you were"
            onBegin();
          }}
        >
          or begin again at the Vestibule
        </button>
      )}
    </div>
  );
}

// After a MOUSE click on a HUD control, hand focus back to the page so Space
// keeps walking the corridor (a focused control claims Space for itself —
// see the keydown guard). Keyboard activation arrives with detail 0 and keeps
// its focus ring, so Tab users are untouched.
function releaseFocus(event) {
  if (event.detail > 0) {
    event.currentTarget.blur();
  }
}

export default function Tour() {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Where this visit opens: a shared link, a remembered walk, or nothing at all
  // (see openingPosition). Drawn once and never again — everything below simply
  // starts there rather than gliding to it after the fact, so the camera is
  // already standing in the right room while the veil is still up and the
  // galleries around it are the ones streaming in.
  // The governor's last word on this machine: { median, dpr, acted, floor }.
  // A ref, not state — nothing on screen may change because the frame rate did,
  // and a re-render is the one thing a walk that is already late cannot afford.
  const qualityRef = useRef(null);
  const onQuality = useCallback((report) => { qualityRef.current = report; }, []);

  const [opening] = useState(openingPosition);
  const startAt = opening?.at ?? 0;
  // The invitation on the veil, and what it says. Cleared by `beginAgain`.
  const [resume, setResume] = useState(() => (startAt > 0
    ? { title: NODES[startAt].title, shared: opening.shared }
    : null));

  // Live, render-free state driving the persistent canvas.
  const descentRef = useRef(startAt);   // current camera depth (float)
  const targetRef = useRef(startAt);    // where we're easing toward
  const velRef = useRef(0);       // descent velocity (spring integration)
  // Immersion: how far the camera has walked INTO the gallery it dwells before
  // (0 = at the mouth, 1 = pressed deep among its cards). Separate from descent,
  // so stepping in parallaxes the slab stack without dissolving the veil. The
  // forward gesture fills this first and only rolls on to the next chapter once
  // it tops out.
  const immersionRef = useRef(0);
  const immersionTargetRef = useRef(0);
  const accentRef = useRef(ACCENTS[0].clone());
  const bobRef = useRef(null);    // plumb bob, slid down its cord directly
  const settledRef = useRef(startAt); // last chapter the camera settled on
  // The vortex dive: 0 while in the library, ramping 0→1 across the single
  // crossing from the vortex (deepest gallery) into the garden. It drives the
  // camera's spin + core-aim in DioramaScene and the warm whiteout that covers
  // the hand-off. flashRef is that overlay, opacity written straight to the DOM.
  const diveRef = useRef(0);
  const flashRef = useRef(null);
  const vignetteRef = useRef(null); // tunnel-vision framing during the fall
  // The dive is paced by its own clock, not the depth spring — a long, deliberate
  // fall you can watch, rather than a ~2s whoosh. Holds { start } while a plunge
  // is underway, then hands the camera back to the spring, settled in the garden.
  const diveAnimRef = useRef(null);
  // Wall-clock length of the plunge down the spiral. Long on purpose: the fall
  // is the only stretch of the tour the reader does not steer, and at five
  // seconds it was over before the body had agreed it was happening. Nearly
  // nine gives the acceleration room to be felt as acceleration, the corkscrew
  // room to turn once rather than snap, and the throat time to arrive.
  const DIVE_MS = 8800;
  // The climb: the same plunge run backwards, when the reader walks out of the
  // garden and back into the library. It was the one asymmetry left in the
  // tour — you FELL into the garden over five seconds and stepped back out
  // through an ordinary seven-second melt, as if the spiral only existed
  // downwards. Same machinery (diveAnimRef carries `up`), its own ref so
  // nothing that reads the fall has to learn about signs, and shorter: a way
  // you have already been is a shorter way.
  // Still shorter than the fall, and now for a second reason as well as the
  // first: the climb gives back the same single revolution the dive took, and
  // a whole turn inside four seconds is a spin rather than a shaft.
  const climbRef = useRef(0);
  const CLIMB_MS = 5600;

  // ── The opening withdrawal ────────────────────────────────────────────────
  // The establishing shot. The tour used to simply BE there when the title card
  // dissolved — standing at the dwell, square on, at rest — which tells a
  // reader nothing about the room they are in or that they are free to move
  // through it. Now the card lifts off a camera already inside the gallery, on
  // a long lens, its gaze on the lamp; over seven seconds it draws back out,
  // widens, and squares up, and where it comes to rest is the mouth of the
  // room — the widest vantage the corridor has, with the whole walk-in still
  // ahead of the reader. The shot spends the playground so it can hand it over.
  //
  // `introRef` is how much of that opening framing is still in force: 1 as the
  // card lets go, 0 once the room has been handed over, and 0 for the rest of
  // the tour. DioramaScene reads it for all three motions (INTRO_PUSH there).
  // It starts at 1 rather than 0 so the camera is ALREADY standing in the tight
  // framing on the first frame it draws — the veil is translucent for its last
  // second, and a shot that only assumed its opening position once the clock
  // started would be seen jumping into it.
  const introRef = useRef(reduced ? 0 : 1);
  // Holds { start, ms, from, cut } while the withdrawal is running, null once
  // it is spent. Its own wall clock, like the dive's — a shot this slow cannot
  // be paced by the depth spring, which is busy standing still.
  const introAnimRef = useRef(null);
  // Interruptible throughout — the first steer cuts it (see cutIntro).
  //
  // This was 7000, and the length was the second half of why the shot could not
  // be SEEN. smootherstep is deliberately flat at both ends, and over seven
  // seconds that flat start lasts about 1.6 s — the veil clears at 1.2 s, so the
  // reader's first half-second of looking was spent on a frame that had covered
  // 5% of its travel, which is to say a still one. Measured, on the real entry
  // path: z −7.00 → −6.99 in the first 1.6 s.
  //
  // At 5800 the flat start compresses to under a second and falls entirely
  // beneath the dissolving card, so the frame the title lifts off is already
  // gathering pace: from 1.2 s to 4.5 s the shot now carries 80% of its travel.
  // Short enough to be a move, long enough to still be a crane and not a jump.
  const INTRO_MS = 5800;
  // …and how long the remainder takes to fold away once the reader does steer.
  // Not zero: snapping the framing out from under a reader's first gesture
  // answers them with a jump cut. Short enough that the gesture still lands as
  // theirs.
  const INTRO_CUT_MS = 900;

  // The reader steered. Whatever is left of the establishing shot folds away
  // now, from wherever it had got to — the point of the withdrawal is to hand
  // the room over, so the moment a reader takes it there is nothing left for
  // the shot to say. It is re-based rather than zeroed (`from` carries the
  // current amount) so the fold-out starts from the framing on screen, and it
  // is marked `cut` so the tick eases it the other way round: a curve that
  // leaves slowly is right for a shot beginning and wrong for one answering a
  // gesture, where the first tenth of a second is the whole of the reply.
  const cutIntro = useCallback(() => {
    const shot = introAnimRef.current;
    if (!shot || shot.cut) {
      return;
    }
    introAnimRef.current = {
      start: performance.now(), ms: INTRO_CUT_MS, from: introRef.current, cut: true,
    };
  }, []);

  // The refusal: a forward step the corridor cannot take — the vertigo before
  // the door has kindled, or the last node of the garden. Walking into a sealed
  // way used to be SILENT (immersion tops out, the crossing clamps back to the
  // same chapter, nothing happens at all), which reads as a dead input rather
  // than as a locked door. The world answers instead: the body leans into it,
  // a dull thud, and a whisper naming the wait. This ref holds the timestamp of
  // the last refusal — DioramaScene reads it for the lean.
  const refuseRef = useRef(0);

  // React state only for the HUD chrome — updates rarely (on chapter change).
  const [chapter, setChapter] = useState(startAt);
  // The paintings currently hung in the corridor. Held in state rather than read
  // straight off NODES because a gallery re-draws itself while you are not
  // looking — see the restock below. The node's own half (title, folio, accent,
  // fog) never changes with it, so everything keyed off NODES stays valid.
  const [scenes, setScenes] = useState(() => NODES.map((n) => n.scene));
  const scenesRef = useRef(scenes);
  useEffect(() => { scenesRef.current = scenes; }, [scenes]);
  // Which tongue the gallery is speaking, set by the direction of the last
  // crossing: 'en' descending, 'es' climbing back.
  const [lang, setLang] = useState('en');
  const [autoplay, setAutoplay] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // The dialog and the word that opens it — see the focus effect below.
  const helpPanelRef = useRef(null);
  const helpBtnRef = useRef(null);
  // Set by whichever gesture closes the panel: true when it was a key, false
  // when it was a click. Only the first gets the focus handed back.
  const helpReturnRef = useRef(false);
  const [veil, setVeil] = useState('shown'); // 'shown' | 'leaving' | 'gone'
  const [muted, setMuted] = useState(false);
  // True for the length of the vortex plunge: the beckon unmounts and the whole
  // HUD fades out, so nothing man-made rides along on the fall.
  const [isDiving, setIsDiving] = useState(false);
  // The whisper that answers a refused step: null when none, else the stamp of
  // the last refusal (a fresh key restarts its appear/fade run) and WHY the way
  // was shut. The reason is captured at the moment of refusal rather than read
  // off `chapter` at render — the step is refused on the TARGET chapter, which
  // mid-crossing is not the chapter the eased camera is showing yet.
  const [refusal, setRefusal] = useState(null);
  // The two gardens the Fork could be, drawn once for the whole visit; null
  // where the node has only one, and on a pinned session, which exists to hold
  // one pairing still and must not have a road chosen under it.
  // Held in a ref rather than a memo so the render-free tick can read it
  // without taking it as a dependency — the tick's effect must not re-run, and
  // the two candidates are drawn once and never change anyway.
  const forkRef = useRef(undefined);
  if (forkRef.current === undefined) {
    forkRef.current = PINNED ? null : forkCandidates();
  }
  const forkTakenRef = useRef(false);   // has the road been chosen yet
  const forkMissedRef = useRef(null);   // …and which garden it cost, or null
  // The echo of the road not taken, shown once on arriving in the Fork. Only
  // ever set when the reader actually turned — see FORK_TURN.
  const [forkEcho, setForkEcho] = useState(null);
  const forkEchoTimer = useRef(0);
  // The invitation, held in the room before the Fork while the road is still
  // open. Mirrored in a ref so the tick — which runs every frame — only touches
  // React state on the two frames where the answer actually changes.
  const [forkCall, setForkCall] = useState(false);
  const forkCallRef = useRef(false);
  // Which galleries are still loading, reported by DioramaScene's Suspense
  // fallbacks. A Set rather than a count because only the room actually being
  // stood in is worth saying anything about — the restock warms plates for rooms
  // the reader cannot see, and those must stay silent.
  const arrivingRef = useRef(new Set());
  const arrivingSinceRef = useRef(0);
  const [arriving, setArriving] = useState(false);
  const arrivingShownRef = useRef(false);
  const noteArriving = useCallback((i, yes) => {
    if (yes) arrivingRef.current.add(i);
    else arrivingRef.current.delete(i);
  }, []);
  // Which scatter layout the frame can hold. Unlike `reduced`, this has to
  // keep listening: rotating a phone changes the answer mid-tour.
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches,
  );
  // Mirrors of the two above, for the drift's tick. It has to know which scatter
  // layout is running to know when the quote is finished, but reading the state
  // would put them in its dependency list — and re-running the effect restarts
  // the dwell, so a rotation or a turn back up the corridor would silently
  // reset the clock on the room the reader is standing in.
  const langRef = useRef('en');
  const narrowRef = useRef(false);
  langRef.current = lang;
  narrowRef.current = narrow;
  // Where each plate reports its awakening (see Painting's `passRef`), so the
  // drift can wait for the surface to have said itself once.
  const passRef = useRef({});
  // ── When the reader last STEERED ───────────────────────────────────────────
  // A woken painting runs its clip for as long as the reader stands still and
  // lets go of it the moment they don't (see LIVE_SETTLE in DioramaScene). This
  // is the one stamp that says "they did something": walking (advance, in all
  // its forms — keys, wheel, click, swipe), panning the gaze, the plumb ring, a
  // chapter chosen by name.
  //
  // What is deliberately NOT here: a bare mouse move, which is looking, not
  // steering — the pointer is half of what wakes a plate at all — and the
  // drift, which is the world carrying a reader who has stopped steering. If
  // autoplay stirred, every gallery it carried you into would freeze the
  // instant it arrived.
  const stirRef = useRef(0);
  // …and the same stamp ends the opening shot. Steering is precisely the thing
  // the withdrawal exists to make room for, so the two can never be in the
  // frame at once: a reader walking against a camera that is still drawing back
  // is being argued with by their own first gesture.
  const stir = useCallback(() => {
    stirRef.current = performance.now();
    cutIntro();
  }, [cutIntro]);
  // The door to the garden. Sealed until the reader has dwelled in The
  // Silence for a few breaths; once open it stays open — and now stays open
  // ACROSS visits, because it was earned, and a reader resuming in the garden
  // must not arrive in a world the tour still believes is locked.
  const [doorOpen, setDoorOpen] = useState(() => opening?.door === true);
  const doorOpenRef = useRef(opening?.door === true);
  const enteredRef = useRef(false);
  const audioRef = useRef(null);

  // ── When the Library cannot be drawn ───────────────────────────────────────
  // Null while all is well; otherwise which way it went wrong (see Failure).
  // The WebGL2 question is asked HERE, before anything mounts, because it is
  // the one failure that is knowable in advance — and because the alternative
  // was the veil counting down its fifteen seconds and then handing the reader
  // a black rectangle with a working HUD over it.
  const [fault, setFault] = useState(() => (canDraw() ? null : 'webgl'));
  // True between the context being lost and either getting it back or giving
  // up. The canvas holds its last frame through this and then goes still, which
  // on its own is indistinguishable from a piece that has quietly died.
  const [glLost, setGlLost] = useState(false);
  const glTimer = useRef(0);
  // How long to wait for a context to come back before saying it is not coming.
  // A real restore is usually inside a second or two; this is generous because
  // the cost of being wrong is telling a reader to reload a page that was about
  // to recover on its own.
  const GL_PATIENCE = 9000;

  const onContextLost = useCallback(() => {
    setGlLost(true);
    window.clearTimeout(glTimer.current);
    glTimer.current = window.setTimeout(() => setFault('lost'), GL_PATIENCE);
  }, []);

  const onContextRestored = useCallback(() => {
    window.clearTimeout(glTimer.current);
    setGlLost(false);
  }, []);

  useEffect(() => () => window.clearTimeout(glTimer.current), []);

  // Whatever went wrong, the drones must not go on playing over the wreck of
  // it: the tour is replaced by a still page with no mute button on it.
  useEffect(() => {
    if (fault && audioRef.current) {
      audioRef.current.dispose();
      audioRef.current = null;
    }
  }, [fault]);

  // If this component ever unmounts (dev HMR remounts, mostly), take the
  // ambience down with it. Without this, an orphaned AudioContext keeps the
  // drones running with no button left anywhere that can silence it — which
  // reads, from the outside, as "the mute button does not work".
  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.dispose();
      audioRef.current = null;
    }
  }, []);

  const pointerStart = useRef(null); // { x, y, turn, pitch, swiped }

  // Free look-around. Pitch tilts the gaze up/down within a bounded range; the
  // turn goes all the way round.
  //
  // `turnTarget` is where the reader has pointed themselves, measured in BAYS —
  // one bay being one artwork's width of the panorama (see TURN_BAYS in
  // DioramaScene) — and it is UNBOUNDED: they can keep turning in one direction
  // for as long as they like, and after TURN_BAYS of it they are looking at the
  // room they set out from again. `turnRef` is that eased into the present.
  //
  // The turn is then SPLIT between two things (see applyTurn), because neither
  // can carry it alone. `yawRef` is the body's own turn — a real camera
  // rotation, which is what makes the near cards slide across the far ones and
  // the vault lean; but a flat card can only be looked at so obliquely before
  // its edge swings into frame, so the yaw can only ever be worth about a fifth
  // of a bay. `panRef` is the rest, spent instead on running the painting's
  // mirrored continuation through the cards (DioramaScene's uPan). Near home the
  // yaw carries all of it, with all the parallax that implies, and the panorama
  // takes over only as the yaw saturates. Both are periodic in TURN_BAYS, so the
  // circle closes on itself with nothing left over.
  const turnRef = useRef(0);
  const turnTarget = useRef(0);
  // Which way a held arrow is turning the head, and how strongly: 0 when no
  // arrow is down, ±1 held, ±TURN_FINE with Shift. The tick advances the turn
  // by this each frame — see TURN_HOLD.
  const turnHeldRef = useRef(0);
  const yawRef = useRef(0);
  const panRef = useRef(0);
  const pitchRef = useRef(0);
  const pitchTarget = useRef(0);

  // ── The handset's tilt, standing in for the mouse ──────────────────────────
  // DioramaScene slides the depth cards past each other by `pointer`, and a
  // touch device never moves one: nothing hovers, so it sits at the origin and
  // the single strongest depth cue in the piece is missing on every phone. The
  // device's own orientation is the natural substitute, and the one the first
  // prototype used before the rebuild dropped it.
  //
  // Held RELATIVE to however the reader happens to be holding the thing rather
  // than to the horizon — nobody reads a phone at 0 degrees, and an absolute
  // mapping would peg the parallax at its rail the moment they lay back on a
  // sofa. The first reading becomes the rest position and the rest leaks slowly
  // toward wherever they have drifted to since, so a change of posture
  // re-centres itself over a few seconds instead of stranding the camera.
  const tiltRef = useRef({ x: 0, y: 0 });
  const tiltStop = useRef(null);

  // Spend the turn on the two things that carry it. The body's share is a sine,
  // so it is zero facing every bay square-on, largest between them, and exactly
  // periodic in TURN_BAYS. The panorama takes whatever the body could not carry,
  // which leaves the apparent motion linear in the turn throughout — the reader
  // never feels the hand-off, only that the world keeps coming round.
  const applyTurn = useCallback(() => {
    const swing = Math.sin((2 * Math.PI / TURN_BAYS) * turnRef.current);
    yawRef.current = YAW_SWING * swing;
    panRef.current = turnRef.current - (YAW_SWING / BAY_ANGLE) * swing;
  }, []);

  const panGaze = useCallback((dTurn, dPitch = 0) => {
    stir(); // turning your head is steering, even standing still
    turnTarget.current += dTurn;
    pitchTarget.current = Math.min(Math.max(pitchTarget.current + dPitch, -PITCH_MAX), PITCH_MAX);
  }, [stir]);

  // Commit the vortex dive: a slow, watchable plunge down the spiral toward the
  // core light, then a warm flood and out into the garden. Paced by its own clock
  // in the tick (diveAnimRef); the plunge/spin/aim + flash ride on top there.
  // `dest` is where the fall ultimately lands — the first garden node by default;
  // a deeper hex-jump lands there first, then springs on to its chosen node.
  const dive = useCallback((dest = LIBRARY_MAX + 1) => {
    if (diveAnimRef.current) return; // already falling
    // The walk-in target is emptied so nothing re-drives it, but the immersion
    // ITSELF is left exactly where the reader's last step put it — the fall
    // inherits the stand and releases it at the far end (see the tick).
    immersionTargetRef.current = 0;
    velRef.current = 0;
    targetRef.current = LIBRARY_MAX + 1;
    diveAnimRef.current = { start: performance.now(), then: dest, imm: immersionRef.current };
    setIsDiving(true);
    if (!reduced && audioRef.current) {
      // The dive's rush: builds for most of the fall and crests with the plunge
      // itself (~el 0.78 of DIVE_MS), then releases into the garden's air.
      audioRef.current.swell(6.8, 0.1, 1.6);
    }
  }, [reduced]);

  // …and the way back: the shaft hauls you up itself. Mirrors `dive` exactly —
  // same clock, same ghost hand-off, the camera work reversed in DioramaScene.
  // As with a deep dive from a shallow gallery, a jump that starts several
  // chapters into the garden is taken to the threshold first and climbs from
  // there; the spring carries it the rest of the way once the shaft lets go.
  const climb = useCallback((dest = LIBRARY_MAX) => {
    if (diveAnimRef.current) return; // already being carried
    immersionTargetRef.current = 0;
    velRef.current = 0;
    targetRef.current = LIBRARY_MAX;
    diveAnimRef.current = {
      start: performance.now(), then: dest, up: true, imm: immersionRef.current,
    };
    setIsDiving(true);
    if (!reduced && audioRef.current) {
      audioRef.current.swell(4.3, 0.075, 1.6);
    }
  }, [reduced]);

  const setTarget = useCallback((next) => {
    const to = clamp(next, doorOpenRef.current ? MAX : LIBRARY_MAX);
    const from = targetRef.current;
    // Any downward crossing of the library→garden threshold is ALWAYS the
    // cinematic dive — whether it comes from the beckon, a scroll, an arrow, or
    // a hex-dot jump straight to a deep garden node — so you never merely slide
    // across that threshold.
    if (to > LIBRARY_MAX && Math.round(from) <= LIBRARY_MAX && !diveAnimRef.current) {
      dive(to);
      return;
    }
    // And any upward crossing of it is the climb, for the same reason: the two
    // worlds are joined by a shaft, not by a corridor, in both directions.
    if (to <= LIBRARY_MAX && Math.round(from) > LIBRARY_MAX && !diveAnimRef.current) {
      climb(to);
      return;
    }
    targetRef.current = to;
    // A new destination chapter: swell the ambience across the crossing and
    // reset immersion so you arrive at the mouth of the next room, not already
    // buried in it. Each threshold has its own rite and its own voice — the
    // reverberation, the hush, the whirl — so the crossing being entered names
    // the sound. Only single steps get one: a jump across several chapters is
    // not a passage through any one of them, so it keeps the plain swell.
    if (Math.round(to) !== Math.round(from)) {
      immersionTargetRef.current = 0;
      if (!reduced && audioRef.current) {
        const step = Math.round(to) - Math.round(from);
        const crossing = Math.min(Math.round(to), Math.round(from));
        audioRef.current.rite(Math.abs(step) === 1 ? RITE_NAME[crossing] : null);
      }
    }
  }, [reduced, dive, climb]);

  // Answer a step the world will not take: lean, thud, whisper. Rate-limited to
  // one answer per REFUSE_MS so a wheel burst is a single bump against the door
  // rather than a stutter of them.
  const refuseTimer = useRef(0);
  const turnBackTimer = useRef(0);
  const refuse = useCallback(() => {
    const now = performance.now();
    if (now - refuseRef.current < REFUSE_MS) {
      return;
    }
    refuseRef.current = now;
    if (audioRef.current) {
      audioRef.current.thud();
    }
    // Sealed vs. ended: the only way to be refused with the door still shut is
    // the vertigo, and the only way with it open is the last node of the path.
    setRefusal({ at: now, sealed: !doorOpenRef.current });
    window.clearTimeout(refuseTimer.current);
    refuseTimer.current = window.setTimeout(() => setRefusal(null), REFUSAL_WHISPER_MS);
    // The web has closed: the whisper's "turn back" is an instruction the world
    // itself carries out. Once it has hung long enough to be read, the walk
    // reverses on its own — out of the room and back into the previous gallery
    // (an ascent, so the tongue turns Spanish). Guarded at fire time so a
    // reader who has already moved on isn't wrestled with.
    if (doorOpenRef.current) {
      window.clearTimeout(turnBackTimer.current);
      turnBackTimer.current = window.setTimeout(() => {
        if (diveAnimRef.current) return;
        if (Math.round(targetRef.current) !== MAX) return;
        setTarget(MAX - 1);
      }, TURN_BACK_MS);
    }
  }, [setTarget]);

  useEffect(() => () => {
    window.clearTimeout(refuseTimer.current);
    window.clearTimeout(turnBackTimer.current);
  }, []);

  // The single forward/back axis. A positive step walks deeper INTO the current
  // gallery; once immersion tops out the next step crosses to the following
  // chapter. Backing out empties immersion first, then retreats a chapter.
  const advance = useCallback((step) => {
    if (diveAnimRef.current) return; // mid-fall: the plunge cannot be steered
    stir();
    // Taking the walk back stops the drift. It used to keep its own clock
    // running underneath a reader who had started steering, so the world would
    // pull them on mid-room a few seconds after they chose to stay — the two
    // were simply fighting. Panning the gaze deliberately does NOT stop it:
    // looking around while being carried is the whole appeal of the drift.
    setAutoplay(false);
    const next = immersionTargetRef.current + step;
    if (next > 1) {
      // Nowhere left to walk: the sealed vertigo (the door has not kindled yet)
      // or the last node of the garden. setTarget would clamp straight back to
      // this same chapter and the step would vanish — so refuse it out loud
      // instead, and hold immersion pinned at the far wall of the room.
      if (Math.round(targetRef.current) >= (doorOpenRef.current ? MAX : LIBRARY_MAX)) {
        immersionTargetRef.current = 1;
        refuse();
        return;
      }
      setTarget(Math.round(targetRef.current) + 1); // resets immersion to 0
    } else if (next < 0) {
      if (immersionTargetRef.current <= 0.001) {
        setTarget(Math.round(targetRef.current) - 1);
      } else {
        immersionTargetRef.current = 0;
      }
    } else {
      immersionTargetRef.current = next;
    }
  }, [setTarget, refuse, stir]);

  const go = useCallback((dir) => {
    if (diveAnimRef.current) return; // mid-fall: the plunge cannot be steered
    // One chapter, in order (the ∧ / ∨ buttons and autoplay): clear immersion so
    // the crossing reads cleanly, then step the target chapter.
    immersionTargetRef.current = 0;
    setTarget(Math.round(targetRef.current) + dir);
  }, [setTarget]);

  // Land on a given chapter. This is NOT a shortcut any more: its one caller is
  // the ring's release, which snaps to the station the hand let go over — and
  // the hand dragged the camera there through every gallery on the way. The
  // station buttons that used to call it directly are gone (see the marker note
  // in the plumb markup); nothing in the piece arrives anywhere unwalked.
  const jumpTo = useCallback((index) => {
    if (diveAnimRef.current) return; // mid-fall: the plunge cannot be steered
    setAutoplay(false); // choosing a gallery is steering — see `advance`
    stir();
    setTarget(index);
  }, [setTarget, stir]);

  // ── The descent: the plumb ring is a grip, not a read-out ───────────────────
  // (design 1d.) The chain hanging down the right of the frame is the same brass
  // the galleries hang their lamps from, and its ring can be taken hold of: drag
  // it and the archive descends WITH you, station tags surfacing as they pass
  // under it. While a hand is on it the ring is written straight from the
  // pointer — the tick yields the bob for the length of the drag (see `dragRef`
  // in the tick) — so it tracks the finger exactly rather than chasing it.
  const spanRef = useRef(null);
  const dragRef = useRef(null);       // fraction of the cord under the hand, or null
  const [grip, setGrip] = useState(null); // station the ring would land on

  // Where on the cord a pointer is, 0 (top) → 1 (the reachable end).
  const cordFrac = useCallback((e) => {
    const el = spanRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  }, []);

  // Which station a point on the cord names. Scoped to the realm the cord is
  // showing: its full drop is the four rooms of the world you are in, so the
  // top of the garden's string is The Door and not the Vestibule. This was
  // always the truth of the thing — `seek` below has never let a drag cross the
  // threshold in either direction — the cord simply used to draw stations the
  // hand could not reach.
  const stationAt = useCallback((frac) => {
    const [lo, hi] = Math.round(targetRef.current) > LIBRARY_MAX
      ? [LIBRARY_MAX + 1, MAX]
      : [0, LIBRARY_MAX];
    return lo + clamp(Math.round(frac * (hi - lo)), hi - lo);
  }, []);

  // Follow the ring with the camera as it travels, so the drag reads as the
  // archive moving rather than a marker sliding over a still picture. The one
  // crossing it will NOT make on its own is the threshold between the two
  // worlds — in EITHER direction: the fall and the climb are both committed
  // acts, so a drag across that band only arms it and the release lets it go.
  const seek = useCallback((station) => {
    const here = Math.round(targetRef.current);
    if (station > LIBRARY_MAX && here <= LIBRARY_MAX) return;
    if (station <= LIBRARY_MAX && here > LIBRARY_MAX) return;
    setTarget(station);
  }, [setTarget]);

  const ridePoint = useCallback((e) => {
    stir(); // a hand on the ring is the archive being driven by hand
    const frac = cordFrac(e);
    dragRef.current = frac;
    if (bobRef.current) {
      bobRef.current.style.top = `${frac * 100}%`;
    }
    const station = stationAt(frac);
    setGrip((g) => (g === station ? g : station));
    return station;
  }, [cordFrac, stationAt, stir]);

  const chainDown = useCallback((e) => {
    if (diveAnimRef.current) return; // mid-fall: the plunge cannot be steered
    // THE CORD IS GRABBABLE ALONG ITS WHOLE LENGTH, stations included. There
    // used to be a guard here that let go of any press landing on a
    // `.plumb-mark`, so that the station's own click could run instead. That
    // reason died when the stations stopped being controls (see the marker note
    // in the markup below) and left the rail nearly inert: a station's hit box
    // is 2.75rem square and there are up to eight of them on a cord about 230px
    // long, so the marks covered ~94% of it — measured, not estimated. A press
    // anywhere on that 94% did nothing whatsoever. It did not jump (that was
    // removed on purpose) and it did not take hold of the chain (this guard),
    // and the only part of the rail that answered a hand at all was the few
    // pixels of gap between one station and the next.
    //
    // The stations are markers, so nothing is lost by pressing straight
    // through them; they keep their hover, which is CSS and does not care.
    e.stopPropagation(); // not a look-around drag on the room behind it
    // …AND THE BROWSER MUST BE TOLD THIS IS NOT A DRAG OF ITS OWN. Without
    // this the rail still failed everywhere a station sits, one layer further
    // down and much harder to see: a station carries text (its title and its
    // numeral), so pressing one and moving starts a native HTML5 drag of that
    // content, and `dragstart` takes the pointer capture away with a
    // `pointercancel` on the very first move. The press had already seeked, so
    // the ring would jump once to where the hand landed and then go dead under
    // it — which looks like a drag that "sticks" rather than like a cancelled
    // gesture, and reads as the whole rail being broken. Measured in the
    // pointer log: pointerdown, pointermove, dragstart, pointercancel.
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    seek(ridePoint(e));
  }, [ridePoint, seek]);

  const chainMove = useCallback((e) => {
    if (dragRef.current === null) return;
    e.stopPropagation();
    seek(ridePoint(e));
  }, [ridePoint, seek]);

  const chainUp = useCallback((e) => {
    if (dragRef.current === null) return;
    e.stopPropagation();
    const station = stationAt(dragRef.current);
    dragRef.current = null; // the tick has the bob back
    setGrip(null);
    jumpTo(station); // snap home — and, past the door, let the fall go
  }, [stationAt, jumpTo]);

  // ── The corridor restocks behind you ───────────────────────────────────────
  // Every gallery holds several Midjourney versions of its painting (and of the
  // clip that wakes it); one is drawn on arrival. A gallery you have stood in is
  // SPENT, and the moment it drops out of sight it quietly re-hangs itself with
  // a version you have not seen. So walking back up the corridor is not a rewind
  // of the descent — the same rooms, in the same order, under different pictures
  // — and revisiting is how the rest of the art gets seen at all. It is also the
  // honest behaviour for this world: it rearranges only what nobody is watching.
  //
  // `spent` holds the chapters owed a fresh painting. A chapter is marked on
  // arrival and cleared when it has been re-drawn (or when the node turns out to
  // have nothing else to offer, e.g. the Vestibule's single plate).
  const spentRef = useRef(new Set([startAt]));
  // At most one gallery re-draws at a time — two plate decodes at once is the
  // same load the video streamer already refuses to run concurrently.
  const restockingRef = useRef(false);

  const restock = useCallback((descent) => {
    if (PINNED || restockingRef.current) return;
    const spent = spentRef.current;
    // Nearest first: whichever spent gallery the reader could reach soonest is
    // the one worth re-hanging soonest.
    const queue = [...spent].sort(
      (a, b) => Math.abs(descent - a) - Math.abs(descent - b));
    for (const i of queue) {
      // A chosen road stays chosen. Every other gallery re-hangs itself with a
      // different version of the same room once it is out of sight, which is
      // exactly the wrong thing to do to the one gallery the reader picked:
      // the choice would be quietly undone the first time they looked away.
      if (i === FORK_INDEX && forkTakenRef.current) {
        spent.delete(i);
        continue;
      }
      if (!outOfSight(descent, i, ARMED)) continue;
      spent.delete(i);
      const pool = POOLS[i];
      const next = redrawScene(pool.map, pool.slug, scenesRef.current[i]);
      if (!next) continue; // a room with only one version of itself
      restockingRef.current = true;
      // Warm the loader's cache under the same key useTexture will ask for, so
      // the re-render finds the plates already decoded and never suspends.
      useTexture.preload(platesOf(next));
      decodePlates(next).then(() => {
        restockingRef.current = false;
        // The reader may have turned around while it loaded. Never re-hang a
        // wall someone is looking at: put the gallery back in the queue and let
        // a later pass catch it out of sight again.
        if (!outOfSight(descentRef.current, i, COMMIT)) {
          spent.add(i);
          return;
        }
        // In a transition, so React holds the gallery that is up until the new
        // one is ready to replace it rather than blanking to a Suspense fallback.
        startTransition(() => {
          setScenes((prev) => {
            const out = prev.slice();
            out[i] = next;
            return out;
          });
        });
      });
      return;
    }
  }, []);

  // One arrival, written down. Three separate things, all of them cheap, all of
  // them called from the same two places (entering, and every settled arrival
  // in the tick) so that they can never drift apart:
  //   the link in the address bar — what a reader can send to someone
  //   the bookmark               — where to take the walk up next time
  //   the plate                  — this reader has now been shown this version
  //                                of this room, so the pools can prefer others
  const remember = useCallback((at) => {
    if (!REMEMBERS) return;
    writeSlug(NODES[at].slug);
    rememberWalk(at, doorOpenRef.current);
    markSeen(scenesRef.current[at]?.color);
  }, []);

  // Start listening to the handset's tilt. Called from `enter` because iOS 13+
  // will only grant DeviceOrientationEvent from inside a user gesture, and the
  // veil's tap is the one gesture the piece is guaranteed to get. Every failure
  // here is silent and total: no sensor, permission refused, a browser that
  // never fires the event — the walk carries on with tilt left at zero, which
  // is exactly how it behaved before this existed.
  const startTilt = useCallback(() => {
    if (tiltStop.current || reduced) return; // reduced motion asked for stillness
    // Only where there is no pointer to stand in for. A machine with a mouse
    // already has the parallax this exists to replace, and a laptop that also
    // happens to carry an accelerometer would get both at once — the scene
    // drifting with the desk it sits on, which is not a depth cue, just noise.
    if (!COARSE) return;
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return;
    const listen = () => {
      // The rest position, in the sensor's own frame, leaked toward the
      // reader's current posture. LEAK is per event at ~60 Hz, so this is a
      // time constant of about eight seconds: far slower than a deliberate
      // lean (which therefore reads at full strength) and far faster than
      // sitting up and losing the parallax for the rest of the visit.
      const LEAK = 0.002;
      const RANGE = 18;   // degrees of lean for the full -1..1 deflection
      const base = { beta: null, gamma: null };
      const onTilt = (e) => {
        const { beta, gamma } = e;
        if (beta == null || gamma == null) return;
        if (base.beta === null) {
          base.beta = beta;
          base.gamma = gamma;
        }
        base.beta += (beta - base.beta) * LEAK;
        base.gamma += (gamma - base.gamma) * LEAK;
        // beta/gamma are in the DEVICE's frame, which stops matching the screen
        // the moment the reader turns the phone sideways — and a 21:9 piece
        // invites exactly that. Rotating the lean by the screen's own angle
        // keeps "tip it left" meaning left in both orientations.
        const a = ((window.screen?.orientation?.angle ?? 0) * Math.PI) / 180;
        const dB = beta - base.beta;
        const dG = gamma - base.gamma;
        const sx = dG * Math.cos(a) + dB * Math.sin(a);
        const sy = -dG * Math.sin(a) + dB * Math.cos(a);
        const clamp = (v) => Math.min(Math.max(v, -1), 1);
        // Signs are the hand-held-window reading: tip the right edge away and
        // the eye moves right, lay the top away and it rises to look down over
        // the scene. Untested on real hardware — if it feels inverted on a
        // phone, these two lines are the whole of it.
        tiltRef.current.x = clamp(sx / RANGE);
        tiltRef.current.y = clamp(-sy / RANGE);
      };
      window.addEventListener('deviceorientation', onTilt);
      tiltStop.current = () => {
        window.removeEventListener('deviceorientation', onTilt);
        tiltStop.current = null;
        tiltRef.current.x = 0;
        tiltRef.current.y = 0;
      };
    };
    if (typeof DOE.requestPermission === 'function') {
      DOE.requestPermission()
        .then((r) => { if (r === 'granted') listen(); })
        .catch(() => { /* refused, or not from a gesture — no tilt, no harm */ });
    } else {
      listen();
    }
  }, [reduced]);
  useEffect(() => () => tiltStop.current?.(), []);

  const enter = useCallback(() => {
    enteredRef.current = true;
    if (!audioRef.current) {
      audioRef.current = new AmbientSound();
    }
    audioRef.current.setMuted(muted);
    audioRef.current.start();
    startTilt();
    // The establishing shot starts with the card's dissolve, not after it. The
    // veil takes 1100 ms to clear (see .entry-veil's transition) and the
    // withdrawal's curve is at its slowest there — so the shot spends its flat
    // opening BEHIND the title and the frame the card lifts off is one already
    // gathering speed. That balance is what INTRO_MS is set against; lengthen
    // the shot and the dead start grows past the card and back into view.
    if (!reduced) {
      introRef.current = 1;
      introAnimRef.current = { start: performance.now(), ms: INTRO_MS, from: 1 };
    }
    setVeil('leaving');
    setTimeout(() => setVeil('gone'), 1200);
    // The room the veil opens onto counts as arrived in — the tick's arrival
    // never fires for it, since the camera was already standing there.
    remember(Math.round(targetRef.current));
  }, [muted, reduced, remember, startTilt]);

  // "or begin again at the Vestibule": the reader had a walk to resume and did
  // not want it. Only the POSITION is given up — the door they earned and the
  // paintings they have been shown are theirs, and making them dwell for the
  // door a second time would be the piece punishing them for starting over.
  const beginAgain = useCallback(() => {
    descentRef.current = 0;
    targetRef.current = 0;
    settledRef.current = 0;
    velRef.current = 0;
    immersionRef.current = 0;
    immersionTargetRef.current = 0;
    spentRef.current.add(0);
    setChapter(0);
    setResume(null);
    forgetPosition();
    enter();
  }, [enter]);

  // One footfall from the walking gait (DescentRig calls this mid-stride):
  // lay a soft step sound under it, scaled by how strongly the gait is swinging.
  const handleStep = useCallback((intensity) => {
    if (!reduced && audioRef.current) {
      audioRef.current.step(intensity);
    }
  }, [reduced]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (audioRef.current) {
        audioRef.current.setMuted(next);
      }
      return next;
    });
  }, []);

  // The single, persistent animation loop. Runs for the component's lifetime —
  // eases descent + accent, updates the progress bar, video flash, and ambience,
  // and only pokes React state when the settled chapter actually changes.
  useEffect(() => {
    let frame;
    let last = performance.now();
    let lastRestock = performance.now();
    const tick = (now) => {
      // Wall-clock easing so the glide keeps the same meditative pace on any
      // refresh rate (clamped so a background tab doesn't lurch on return).
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      // ── The opening withdrawal ─────────────────────────────────────────────
      // Its own wall clock, read straight off `now` rather than integrated: a
      // seven-second shot accumulated a frame at a time drifts with every
      // hitch, and this one has to land EXACTLY on zero or the tour spends the
      // rest of its life a few tenths of a unit inside the room it opened in.
      // Runs alongside everything below rather than before it — the shot is a
      // camera move over a corridor that is otherwise standing still, and a
      // reader who steers through it is steering a world that never paused.
      const shot = introAnimRef.current;
      if (shot) {
        const el = Math.min((now - shot.start) / shot.ms, 1);
        // The shot proper eases in AND out (smootherstep — it must not be seen
        // to start or stop). The fold-out after a steer is a plain cubic
        // ease-out instead: it has to leave at once, because its whole job is
        // to be the answer to a gesture, and only the arrival has to be soft.
        const spent = shot.cut
          ? 1 - Math.pow(1 - el, 3)
          : smootherstep(el);
        introRef.current = shot.from * (1 - spent);
        if (el >= 1) {
          introRef.current = 0;
          introAnimRef.current = null;
        }
      }

      const diving = diveAnimRef.current !== null;
      if (diving) {
        // The vortex plunge runs on its own clock — a slow, watchable fall. Its
        // two motions are DECOUPLED: `el` drives how far the camera dives into
        // the vortex core (diveRef → the plunge/spin/aim in DioramaScene), which
        // stays deep late into the fall — so you actually travel THROUGH the
        // spiral, on screen the whole way. The descent crossover is held to the
        // very end and rides the GHOST window (DioramaScene fades the vortex
        // stack as a whole over el 0.8→0.96, both worlds lit): the crossing
        // depth-melt must never run — its shards read as abstract garbage at
        // the point-blank range the plunge reaches.
        //
        // The CLIMB is this same clock read the other way up: progress still
        // runs 0→1, but the crossover walks the descent back from the garden to
        // the vortex and it is the garden's plate that ghosts. Everything
        // between — the camera being hauled up the shaft, the counter-roll, the
        // lift of the gaze — is DioramaScene reading climbRef instead.
        const a = diveAnimRef.current;
        const up = a.up === true;
        // `frozen` holds the fall at a fixed progress — dev-capture only (the
        // ?dev hook below); a real dive never sets it.
        const el = a.frozen != null
          ? a.frozen
          : Math.min((now - a.start) / (up ? CLIMB_MS : DIVE_MS), 1);
        diveRef.current = up ? 0 : el;
        climbRef.current = up ? el : 0;
        // The walk-in is not handed back at the top of the fall. Whatever
        // ground the reader covered stepping into the mouth is ground the
        // plunge starts FROM — DioramaScene subtracts it from DIVE_PLUNGE, so
        // the crest lands in the same place either way — and it is released
        // only across the crossover window, where the descent's own forward
        // travel absorbs it. Zeroing it on commit (which is what this used to
        // do) opened every dive with the body being hauled a full APPROACH
        // backwards out of the mouth it had just walked into, at better than
        // the plunge's own top speed: the fall began by going the wrong way.
        immersionRef.current = (a.imm ?? 0) * (1 - smoothstep(0.78, 1, el));
        descentRef.current = up
          ? LIBRARY_MAX + 1 - smoothstep(0.78, 0.97, el)
          : LIBRARY_MAX + smoothstep(0.78, 0.97, el);
        velRef.current = 0;
        if (a.frozen == null && el >= 1) {
          // Landed. Hand the camera back to the spring — aimed at the fall's
          // true destination, so a deep hex-jump glides on through the garden —
          // and let the HUD chrome fade back in.
          diveAnimRef.current = null;
          descentRef.current = up ? LIBRARY_MAX : LIBRARY_MAX + 1;
          immersionRef.current = 0;
          diveRef.current = up ? 0 : 1;
          climbRef.current = up ? 1 : 0;
          targetRef.current = a.then ?? (up ? LIBRARY_MAX : LIBRARY_MAX + 1);
          setIsDiving(false);
        }
      } else {
        const d = descentRef.current;
        const t = targetRef.current;
        // Critically damped spring toward the target depth: the camera gathers
        // itself out of one gallery, crests mid-corridor, and brakes softly into
        // the next — one continuous breath instead of a lurch-and-crawl. A full
        // chapter crossing unfolds over roughly nine and a half seconds.
        const K = WALK.k;               // stiffness — sets the crossing's tempo
        const C = 2 * Math.sqrt(K);     // critical damping — no overshoot
        let v = velRef.current;
        v += (K * (t - d) - C * v) * dt;
        let next = d + v * dt;
        if (Math.abs(t - next) < 0.0006 && Math.abs(v) < 0.002) {
          next = t;
          v = 0;
        }
        velRef.current = v;
        descentRef.current = Math.min(Math.max(next, 0), MAX);
      }
      const cur = descentRef.current;

      // Immersion moves toward its target, but only while the camera is settled
      // on a chapter — mid-crossing it is pulled to 0 so the walk-in doesn't
      // fight the crossing. Mid-FALL it is neither driven nor drained here: the
      // plunge owns it above, and this drain would otherwise empty it in the
      // first half-second and undo the hand-over.
      const settled = Math.abs(cur - Math.round(cur)) < 0.02;
      if (settled && !diving) {
        // Walk-in: a clamped exponential. A pure exponential front-loads the
        // move — fastest the instant you scroll, then a seconds-long drifting
        // tail, which is exactly the velocity profile of floating, not walking.
        // Clamping the rate caps forward speed at a steady stride (~2.2 world
        // units/s over the 10-unit APPROACH) so a step-in moves at constant
        // walking tempo; near arrival the exponential takes over for the stop.
        // NB this is in IMMERSION units, so it has to track APPROACH: shortening
        // the walk-in without raising it would slow the stride to a crawl.
        const IMMERSION_WALK = WALK.imm; // see WALK — dialled by __walk
        const imm = immersionRef.current;
        const v = Math.max(
          -IMMERSION_WALK,
          Math.min(IMMERSION_WALK, (immersionTargetRef.current - imm) * 2.4)
        );
        immersionRef.current = imm + v * dt;
      } else if (!diving) {
        // Uncapped drain: the crossing's forward travel must absorb the
        // emptied immersion quickly or the two would fight.
        immersionRef.current *= Math.exp(-dt * 2.4);
      }

      // Look-around: gaze eases toward its target on both axes. The target
      // barely drifts back toward center — slow enough that the view stays
      // where the reader pointed it, yet over a long dwell it settles back to
      // facing down the corridor.
      //
      // For the turn, "center" is the NEAREST way round: a reader who has gone
      // three quarters of the way about does not get wound back the way they
      // came, they are carried on to the far side, which is the same room. The
      // fall aims itself at the vortex core, so a turned reader is brought
      // round hard rather than plunging sideways down the shaft.
      // A held arrow turns the head at a steady rate, paced here rather than by
      // the keyboard's repeat rate (see TURN_HOLD). Applied before the drift
      // home below, so holding against the drift simply wins.
      if (turnHeldRef.current !== 0 && !diving) {
        turnTarget.current += turnHeldRef.current * TURN_HOLD * dt;
        // Turning your head is steering, for as long as it lasts. The stamp is
        // written straight rather than through `stir` so the tick keeps its
        // empty dependency list — the first press already went through panGaze,
        // which raised the stamp and cut the opening shot properly.
        stirRef.current = performance.now();
      }
      const home = Math.round(turnTarget.current / TURN_BAYS) * TURN_BAYS;
      turnTarget.current += (home - turnTarget.current)
        * (1 - Math.exp(-dt * (diving ? 1.6 : 0.05)));
      turnRef.current += (turnTarget.current - turnRef.current) * (1 - Math.exp(-dt * 2.4));
      applyTurn();
      pitchTarget.current += (0 - pitchTarget.current) * (1 - Math.exp(-dt * 0.05));
      pitchRef.current += (pitchTarget.current - pitchRef.current) * (1 - Math.exp(-dt * 2.4));

      // Interpolate accent between the two bracketing chapters.
      const lo = Math.floor(cur);
      const hi = Math.min(lo + 1, MAX);
      accentRef.current.copy(ACCENTS[lo]).lerp(ACCENTS[hi], cur - lo);

      // The plumb bob, slid down its cord by direct DOM write (no React
      // render). Measured against the realm the cord is currently showing, not
      // against the whole journey: the instrument only ever hangs one world's
      // stations at a time, so its full drop IS that world (see REALM below).
      // Because this tracks the eased descent rather than the settled chapter,
      // the bob travels continuously through a crossing — and across the
      // threshold it simply runs off one instrument's end and on at the other's
      // start, under cover of the fall, which takes the whole HUD with it.
      if (bobRef.current && dragRef.current === null) {
        const [lo, hi] = cur > LIBRARY_MAX + 0.5
          ? [LIBRARY_MAX + 1, MAX]
          : [0, LIBRARY_MAX];
        const frac = Math.min(Math.max((cur - lo) / (hi - lo), 0), 1);
        bobRef.current.style.top = `${frac * 100}%`;
      }

      // The soundscape darkens through the library, then the garden opens the
      // air back up: leaf-hiss in, drone weight out, across the crossing. Those
      // two are BLENDS — how dark, how open. setStation is the third thing and a
      // different kind: it is the reader's absolute place on the corridor, and
      // it gives each gallery its own note to rest on, so the descent is heard
      // as a fall in pitch and not only as a loss of light. Passed as the raw
      // continuous float so the note glides across a crossing exactly as the
      // picture does.
      if (audioRef.current) {
        audioRef.current.setDescent(Math.min(cur, LIBRARY_MAX) / (LIBRARY_MAX || 1));
        audioRef.current.setGarden(Math.min(Math.max(cur - LIBRARY_MAX, 0), 1));
        audioRef.current.setStation(cur);
      }

      // Update HUD chapter when we cross a rounded boundary — right at the
      // bridge's peak, so the card swap happens under the video's cover.
      const nearest = Math.round(cur);
      // ── The room running late ────────────────────────────────────────────
      // Only ever about the gallery being stood in, and never during the fall
      // (the plunge hides the corridor anyway) or behind the entry veil, which
      // does this job properly for the first load. The clock starts when the
      // wait does, so a plate that lands inside the grace period says nothing.
      const lateRoom = enteredRef.current && !diving && arrivingRef.current.has(nearest);
      if (!lateRoom) arrivingSinceRef.current = 0;
      else if (!arrivingSinceRef.current) arrivingSinceRef.current = now;
      const sayLate = lateRoom
        && now - arrivingSinceRef.current > ARRIVING_GRACE_MS;
      if (sayLate !== arrivingShownRef.current) {
        arrivingShownRef.current = sayLate;
        setArriving(sayLate);
      }

      // ── The road offered ─────────────────────────────────────────────────
      // The invitation stands from arriving in the room before the Fork until
      // the road is committed — bounded ABOVE by the same FORK_COMMIT the choice
      // is read at, so the offer and the taking of it can never overlap. Not
      // during the fall: the plunge owns the screen, and a pill riding down it
      // would be read as part of the falling rather than as something to answer.
      const forkOpen = !!forkRef.current && !forkTakenRef.current && !diving
        && cur > (FORK_INDEX - 1) - 0.02
        && cur < (FORK_INDEX - 1) + FORK_COMMIT;
      if (forkOpen !== forkCallRef.current) {
        forkCallRef.current = forkOpen;
        setForkCall(forkOpen);
      }

      // ── The road chosen by looking ───────────────────────────────────────
      // ABOVE the arrival block on purpose: both can land in the same tick if a
      // single frame carries the camera across the commit point and into the
      // room (a long dt — a background tab coming back, one slow frame), and
      // the arrival is what says what the choice cost. Announced before it was
      // made, it has nothing to say and the road not taken goes unnamed.
      // Committed partway through the V → VI crossing, from the yaw alone. The
      // gallery ahead is still deep enough in fog here that swapping it is
      // invisible; a chapter later it would be a plate changing in front of the
      // reader's eyes. Descending only: climbing back up into the Fork walks
      // into the garden already chosen, because it is the one that exists now.
      if (forkRef.current && !forkTakenRef.current
          && cur > (FORK_INDEX - 1) + FORK_COMMIT && cur < FORK_INDEX) {
        forkTakenRef.current = true;
        // Which way they are facing, taken the nearest way round — half a circle
        // of turn either way is the same direction to be looking in.
        const t = turnRef.current - TURN_BAYS * Math.round(turnRef.current / TURN_BAYS);
        const turned = t > FORK_TURN ? 'right' : t < -FORK_TURN ? 'left' : null;
        const side = turned ?? (Math.random() < 0.5 ? 'left' : 'right');
        forkMissedRef.current = turned ? (side === 'left' ? 'right' : 'left') : null;
        const chosen = forkRef.current[side];
        // The Fork is now settled for the rest of the visit: the restock is
        // told to leave it alone below, so walking away and back returns to the
        // garden that was chosen rather than re-rolling it.
        startTransition(() => {
          setScenes((prev) => {
            const out = prev.slice();
            out[FORK_INDEX] = chosen;
            return out;
          });
        });
      }

      if (nearest !== settledRef.current) {
        // The direction of the crossing decides the tongue the arriving gallery
        // speaks: down through the Library in translation, back up in the
        // original. Read here rather than in the render because this is the only
        // place both the old and the new chapter are known — and it makes the
        // ascent a second reading rather than a rewind of the first.
        const tongue = nearest < settledRef.current ? 'es' : 'en';
        settledRef.current = nearest;
        setLang(tongue);
        setChapter(nearest);
        // You have now been in this gallery: its painting is spent, and gets
        // re-drawn as soon as the room is out of sight behind you.
        spentRef.current.add(nearest);
        // …and the walk leaves a mark outside itself — the hash, the bookmark,
        // the plate. See `remember`.
        remember(nearest);
        // Arriving in the Fork having actually turned on the way: say what the
        // turn cost. Only when the reader chose — the world drawing for someone
        // who walked straight through is not a road not taken, and claiming it
        // was would be the piece lying to them.
        if (nearest === FORK_INDEX && forkMissedRef.current) {
          setForkEcho({ at: now, missed: forkMissedRef.current });
          window.clearTimeout(forkEchoTimer.current);
          forkEchoTimer.current = window.setTimeout(
            () => setForkEcho(null), FORK_WHISPER_MS);
        }
      }

      // Re-hang one spent gallery, twice a second at most, and never mid-fall —
      // the plunge is the one stretch where the corridor's depths are all on
      // screen at once.
      if (!diving && now - lastRestock > 500) {
        lastRestock = now;
        restock(cur);
      }

      // The vortex dive drives a warm radial flash. While falling, `diveRef` is
      // the plunge clock (el); otherwise it just tracks the depth so idle/garden
      // states stay dark. The flash keeps the whole plunge into the vortex in the
      // clear (p up to ~0.5), then swells to cover the late crossover and the
      // camera righting, and clears onto the garden. Reduced motion softens it.
      // Off the dive, the plunge is fully at rest — so a normal crossing (or
      // ascending back out of the garden) never spuriously spins the camera.
      if (!diving) {
        diveRef.current = 0;
        climbRef.current = 0;
      }
      // Both directions of the shaft drive the same two overlays: whichever way
      // the body is being carried, the periphery closes in and the deep instant
      // takes a breath of dark.
      const p = Math.max(diveRef.current, climbRef.current);
      if (flashRef.current) {
        // No fade to black and no gold flood: the hand-off is a lit GHOST
        // crossfade (the vortex stack thins away via uGhost while the garden
        // materializes). This veil is only a faint dimming breath at the
        // deepest instant — atmosphere, never darkness. Reduced motion keeps
        // a fuller veil, having no plunge to carry the crossing.
        const bell = reduced
          ? 0.8 * smoothstep(0.45, 0.7, p) * (1 - smoothstep(0.92, 1.0, p))
          : 0.38 * smoothstep(0.79, 0.93, p) * (1 - smoothstep(0.95, 1.0, p));
        flashRef.current.style.opacity = `${bell}`;
      }
      if (vignetteRef.current) {
        // Tunnel vision: the frame's periphery closes in with the fall's
        // thrust — deliberate, symmetric framing (it reads as speed), whose
        // clear center stays on the spiral and its light. It also owns
        // whatever the ROLLED corners reveal past the cards, uniformly, and
        // that job got bigger when the bank became a whole revolution — hence
        // both the deeper close and the later crest (3.2 puts it at p≈0.81,
        // past the plunge's own, so the periphery is still shut through the
        // hand-off and the last quarter-turn).
        const tv = reduced ? 0 : Math.sin(Math.pow(p, 3.2) * Math.PI);
        vignetteRef.current.style.opacity = `${0.72 * tv}`;
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Dev-only capture rig (stripped from production builds by Vite): ?dev=1
  // jumps straight to the woken vortex — or to ?ch=<n> / ?node=<slug> when
  // given — and exposes window.__setDive(el) to freeze the dive at any
  // progress, so headless screenshots can inspect any instant of the fall.
  // See the capture recipe in the project memory.
  //
  // ?node= and ?ch= imply the jump on their own, so a pinned pairing
  // (?variant=/?clip=, see selectRandomVariant) can be landed on with one URL:
  //   ?node=fork&variant=01-moonlit-labyrinth-var0&clip=01-moonlit-labyrinth-var0-clip1
  // What actually got drawn is logged to the console — the pools are random,
  // so this is the only way to be sure you are looking at what you asked for.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('dev') && !params.has('ch') && !params.has('node')) return;
    setVeil('gone');
    enteredRef.current = true;
    // …and the capture rig gets no establishing shot. It never calls `enter`,
    // so nothing would ever run the withdrawal's clock — and since the camera
    // stands in the opening framing from its first frame, every ?dev capture
    // ever taken would have been shot from inside the room, on the long lens,
    // with its gaze off the axis. Put the shot where it lands. `__intro()`
    // runs it deliberately when it is the thing being looked at.
    introRef.current = 0;
    doorOpenRef.current = true;
    setDoorOpen(true);
    const slug = params.get('node');
    const bySlug = slug ? NODES.findIndex((n) => n.slug === slug) : -1;
    if (slug && bySlug < 0) {
      console.warn('[pin] no node named %o — known slugs: %s', slug,
        NODES.map((n) => n.slug).join(', '));
    }
    const ch = Number(params.get('ch'));
    const at = bySlug >= 0
      ? bySlug
      : params.has('ch') && Number.isFinite(ch) ? clamp(Math.round(ch), MAX) : LIBRARY_MAX;
    descentRef.current = at;
    targetRef.current = at;
    settledRef.current = at;
    setChapter(at);
    // Landing here counts as having been here: without this the pinned chapter
    // is the one gallery that never restocks, since the tick's arrival never
    // fires for it.
    spentRef.current.add(at);
    const landed = NODES[at];
    console.info('[pin] %s — still %o, clip %o', landed.slug,
      landed.scene.color.split('/').pop(),
      landed.scene.video ? landed.scene.video.split('/').pop() : '(none)');
    window.__setDive = (el) => {
      diveAnimRef.current = { frozen: Math.max(0, Math.min(1, el)) };
      setIsDiving(true);
    };
    window.__nav = () => ({
      target: targetRef.current,
      descent: descentRef.current,
      immT: immersionTargetRef.current,
      diving: diveAnimRef.current !== null,
      // How much of the establishing shot is still standing in the room, and
      // whether its clock is still running. Reported because a withdrawal that
      // never gets to zero and one that was never started look identical from
      // a still frame — and the first would leave the tour permanently inside
      // the gallery it opened in, on a lens it never gave back.
      intro: introRef.current,
      opening: introAnimRef.current !== null,
      // Where the gaze is pointed. `turn` is the whole of it, in bays, and is
      // what the Fork reads at the commit point, so a fork that lands the wrong
      // way can be told apart from a turn that never got far enough off the axis
      // to count (FORK_TURN). `yaw` and `pan` are the two halves it is spent on.
      turn: turnRef.current,
      yaw: yawRef.current,
      pan: panRef.current,
      fork: {
        taken: forkTakenRef.current,
        missed: forkMissedRef.current,
        // The two gardens on offer. Null means the node could not field two and
        // there is no fork at all — which is otherwise indistinguishable from a
        // fork that simply never fired.
        pair: forkRef.current
          ? [forkRef.current.left, forkRef.current.right]
            .map((s) => s.color.split('/').pop())
          : null,
      },
      // Which version of each gallery is hanging right now, and which are still
      // owed a fresh one — the restock happens by definition where it cannot be
      // seen, so this is the only way to watch it work.
      art: scenesRef.current.map((s) => s.color.split('/').pop()),
      spent: [...spentRef.current],
      // Which galleries have woken and finished a pass, which is one of the two
      // things the drift waits on. Reported because a gate that never fires is
      // indistinguishable from one that always passes: if this stays empty on a
      // gallery whose clip is plainly running, the drift is being paced by the
      // quote and DRIFT_MAX_DWELL alone.
      pass: Object.fromEntries(Object.entries(passRef.current)
        .map(([i, p]) => [i, `${p.done ? 'said' : 'waking'}/${p.by}`])),
    });
    // Walk the camera without the input layer, for scripted capture. Crossing
    // into the garden still dives, as it does for a reader.
    window.__to = (i) => {
      immersionTargetRef.current = 0;
      setTarget(clamp(Math.round(i), MAX));
    };
    // Teleport: put the camera at a depth outright, no ease. A crossing takes
    // about seven seconds, and headless GL gives out well before a round trip of
    // them finishes — so anything that has to be observed several chapters apart
    // is stepped with this instead. The tick still sees the chapter change, so
    // arrivals register (and galleries are marked spent) exactly as if walked.
    window.__at = (d) => {
      const to = clamp(d, MAX);
      descentRef.current = to;
      targetRef.current = to;
      velRef.current = 0;
      immersionRef.current = 0;
      immersionTargetRef.current = 0;
    };
    // Hold a gallery in the state it has while its plates are still in flight,
    // which is otherwise unreachable on purpose: the restock preloads every
    // plate before committing it, so off a local server nothing ever suspends
    // long enough to see. Throttling the network cannot isolate it either — slow
    // it far enough to delay a plate and the JS bundle stops arriving too, and
    // the page never boots at all. So the report is faked at its own seam, which
    // is exactly what DioramaScene's Suspense fallback would have said.
    //   __arriving(2, true)  → gallery III is still coming; after
    //                          ARRIVING_GRACE_MS the whisper appears
    //   __arriving(2, false) → its plates landed; the whisper goes
    window.__arriving = (i, yes = true) => {
      noteArriving(Math.round(i), !!yes);
      return [...arrivingRef.current];
    };
    // Stand the reader at a given point of the WALK-IN, with no ease. The
    // immersion axis is normally filled a wheel-notch at a time and eased over
    // seconds; headless GL rarely survives that, and the framing questions this
    // answers (how much ground is left underfoot at full walk-in) are static.
    //   __imm(0)    → at the dwell, the gallery hung at its full width
    //   __imm(1)    → all the way in, the camera pressed into the stack
    window.__imm = (v) => {
      const to = Math.min(Math.max(v, 0), 1);
      immersionRef.current = to;
      immersionTargetRef.current = to;
      return to;
    };
    // Hold the opening withdrawal at a point of its travel, or run it again.
    // The shot happens ONCE, at the one moment of the tour a headless capture
    // cannot reach — the veil is up, nothing is loaded, and by the time a
    // script has clicked through and the GL has warmed the seven seconds are
    // spent. And it cannot be scrubbed by wall clock either: swiftshader
    // starves rAF, so the tick that owns this curve runs at whatever pace it
    // likes (see the headless notes in the walk-in work).
    //   __intro(1)    → the framing the card lifts off: pressed in, long lens,
    //                   turned on the lamp
    //   __intro(0.5)  → mid-withdrawal
    //   __intro(0)    → where it lands, which is the tour's resting vantage
    //   __intro()     → run the whole shot again, from the top, at full length
    // A held value cancels the clock, so nothing eases it out from under a shot.
    // Pace, live. See WALK. Both numbers are read every frame, so a change
    // takes effect on the next step without a reload — which is the only way
    // to judge "is this a walk or a glide", since the answer is a feeling and
    // a reload resets the body to the start of the corridor.
    //   __walk()                → { imm, k } as they stand
    //   __walk({ imm: 0.11 })   → slower walk-in
    //   __walk({ k: 0.22 })     → slower corridor crossing
    // Cadence check, because imm alone does not tell you. A STRIDE is two
    // footfalls, so the step rate is 2 * speed / STRIDE_LENGTH — forgetting
    // the 2 halves the number and makes a correct walk look far too slow.
    // speed = imm * APPROACH (10); STRIDE_LENGTH is 1.6. Human walking is ~1.9.
    window.__walk = (next) => {
      Object.assign(WALK, next ?? {});
      const speed = WALK.imm * 10;
      return {
        ...WALK,
        unitsPerSec: +speed.toFixed(2),
        footfallsPerSec: +((2 * speed) / 1.6).toFixed(2),
      };
    };
    // What the frame clock has actually been doing, and what the governor did
    // about it. `median` is the middle frame of the last 2.5 s window in ms,
    // `dpr` the rung it is standing on. The point of reading it by hand is the
    // question the numbers alone cannot answer — whether the machine is slow,
    // or whether the governor is what made the painting soft. Pin the ratio
    // with ?dpr=1.5 to take the governor out of the picture, or ?governor=0 to
    // leave it measuring and mute.
    window.__quality = () => qualityRef.current;
    window.__intro = (v) => {
      if (v == null) {
        introRef.current = 1;
        introAnimRef.current = { start: performance.now(), ms: INTRO_MS, from: 1 };
        return 1;
      }
      introAnimRef.current = null;
      introRef.current = Math.min(Math.max(v, 0), 1);
      return introRef.current;
    };
    // Park the camera INSIDE a crossing and hold it there, which is the only
    // way to actually look at a rite: walked, each one is over in the ~1.5 s
    // its plate spends dissolving, and under headless GL it may never be
    // sampled at all. `p` is the crossing's own progress — 0 at the room you
    // are leaving, 1 at the one you are arriving in.
    //   __rite(1)        → halfway through the hush (II → III)
    //   __rite(5, 0.3)   → the flood, just as the water reaches the picture
    //   __rites(0)       → the same instant on the plain melt, to compare
    // Nothing eases: the teleport freezes the crossing rather than crossing it.
    window.__rite = (c, p = 0.5) => {
      const at = clamp(c + Math.min(Math.max(p, 0), 0.999), MAX);
      window.__at(at);
      console.info('[rite] crossing %d (%s) at %s', c,
        RITE_NAME[c] ?? 'plain', (at - c).toFixed(2));
      return at;
    };
    window.__climb = (el) => {
      diveAnimRef.current = { frozen: Math.max(0, Math.min(1, el)), up: true };
      setIsDiving(true);
    };
    // Stand the reader at a given point of the turn outright, in bays — the
    // teleport the drag would take three sweeps and a settle to reach.
    //   __spin(0.5)  → between this room and the bay beside it
    //   __spin(1)    → facing the mirrored bay, the far side of the circle
    //   __spin(2)    → all the way round, back where you started
    // Set with no ease and split on the spot, so the uniforms are right without
    // waiting on a frame — under headless GL the tick can be seconds behind, and
    // a shot taken on the strength of a stale split says nothing.
    window.__spin = (bays) => {
      turnTarget.current = bays;
      turnRef.current = bays;
      applyTurn();
      return { turn: bays, yaw: yawRef.current, pan: panRef.current };
    };
  }, [setTarget, applyTurn]);

  // The door: once the reader has settled in The Silence and dwelled for a
  // few breaths, a green light kindles between the shelves and the garden
  // unlocks. Leaving before the dwell completes keeps it sealed.
  useEffect(() => {
    if (doorOpen || chapter !== LIBRARY_MAX) {
      return undefined;
    }
    const timer = setTimeout(() => {
      doorOpenRef.current = true;
      setDoorOpen(true);
      // Written down the moment it kindles rather than at the next arrival: the
      // dwell that earns the door is four and a half seconds of standing still,
      // and a reader who closes the tab from there has still earned it.
      remember(chapter);
      // Whatever the wall was still whispering is answered now — drop it so the
      // refusal never overlaps the invitation that replaces it.
      setRefusal(null);
      if (audioRef.current) {
        audioRef.current.announce();
      }
    }, 4500);
    return () => clearTimeout(timer);
  }, [chapter, doorOpen, remember]);

  // Both gardens are decoded while the reader stands at The Door, one chapter
  // short of the fork. The choice is committed mid-crossing and has to land on
  // an already-decoded plate: a Suspense fallback there would blank the gallery
  // being walked into, which is the one moment in the piece where the reader is
  // certain to be looking at it.
  useEffect(() => {
    const fork = forkRef.current;
    if (!fork || chapter !== FORK_INDEX - 1 || forkTakenRef.current) {
      return;
    }
    for (const side of [fork.left, fork.right]) {
      useTexture.preload(platesOf(side));
      decodePlates(side);
    }
  }, [chapter]);

  // Autoplay: drift forward, loop back to the top at the reachable end.
  //
  // Paced by what the gallery is DOING, not by a stopwatch. On a 9 s interval
  // the drift saw neither of the two things a gallery says: a crossing alone
  // takes about seven seconds, leaving a ~2 s dwell, while the quote needs its
  // whole gather-hold-dissolve cycle (12 s for a twelve-word line) and the
  // surface needs to wake and run one pass. A drift that skips both is a slide
  // show of rooms nobody is inside. So: arrive, let the room finish speaking,
  // then move — which comes out around 25-30 s a gallery, the pace of a reading
  // rather than a carousel.
  useEffect(() => {
    if (!autoplay || NODES.length <= 1) {
      return undefined;
    }
    let arrivedAt = performance.now();
    let standingIn = Math.round(targetRef.current);
    const step = () => {
      const end = doorOpenRef.current ? MAX : LIBRARY_MAX;
      const atEnd = Math.round(targetRef.current) >= end;
      immersionTargetRef.current = 0;
      setTarget(atEnd ? 0 : Math.round(targetRef.current) + 1);
      arrivedAt = performance.now();
    };
    const tick = () => {
      const now = performance.now();
      const chapter = Math.round(targetRef.current);
      // A crossing is in flight (or the reader was carried somewhere): restart
      // the dwell against the room actually being stood in.
      if (chapter !== standingIn) {
        standingIn = chapter;
        arrivedAt = now;
        return;
      }
      if (diveAnimRef.current) {          // mid-fall: nothing is being read
        arrivedAt = now;
        return;
      }
      const waited = now - arrivedAt;
      if (waited > DRIFT_MAX_DWELL) {     // below, the reasons it may not fire
        step();
        return;
      }
      if (waited < DRIFT_MIN_DWELL) return;
      // The quote has to have finished dissolving. Its cycle is laid out per
      // chapter and per tongue at load, and the last word's dissolve is the
      // attribution's `attrOutD` plus the 2200 ms `scatter-gone` runs for.
      const layout = SCATTER[narrowRef.current ? 'narrow' : 'wide'][langRef.current];
      const quoteMs = (layout[chapter]?.attrOutD ?? 0) + SCATTER_GONE_MS;
      if (waited < quoteMs) return;
      // …and the surface has to have woken and said itself once. A gallery
      // with no clip, or one whose clip never reaches the DOM, has no record
      // here and is carried by DRIFT_MAX_DWELL instead of stalling the drift.
      const pass = passRef.current[chapter];
      if (pass && !pass.done) return;
      step();
    };
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [autoplay, setTarget]);

  // The help panel is a modal dialog and now behaves like one: focus goes into
  // it when it opens, Tab cannot leave it while it is up, and closing hands
  // focus back to the word that opened it. Everything else about it — the
  // scrim, H to open, Esc to close — was already there; what was missing is
  // that a reader driving by keyboard was left standing on the body, with the
  // panel announced as nothing and the corridor's controls still in their Tab
  // order underneath it.
  useEffect(() => {
    if (!showHelp) {
      return undefined;
    }
    const panel = helpPanelRef.current;
    if (!panel) {
      return undefined;
    }
    // Held now rather than read at cleanup: `help` is in the margin for the
    // whole life of the tour, so this is the same node either way, and reading
    // a ref from a cleanup is the shape that goes stale everywhere else.
    const opener = helpBtnRef.current;
    // The close button rather than the panel: it is the one thing in here to
    // DO, and landing on it means Space or Enter shuts the panel again.
    const focusables = () => panel.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])');
    const first = focusables()[0];
    // The close button, or — if this panel ever loses it — the panel itself,
    // which carries tabindex="-1" for exactly that.
    (first ?? panel.querySelector('.help-panel') ?? panel).focus();
    const onKey = (event) => {
      if (event.key !== 'Tab') {
        return;
      }
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const edge = event.shiftKey ? items[0] : items[items.length - 1];
      // Wrap at whichever end the reader is walking off — and catch the case
      // where focus is on the panel itself, which is not in `items`.
      if (document.activeElement === edge || !panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? items[items.length - 1] : items[0]).focus();
      }
    };
    panel.addEventListener('keydown', onKey);
    return () => {
      panel.removeEventListener('keydown', onKey);
      // Back to the word that opened it — for the reader who is DRIVING by
      // keyboard, who would otherwise be dropped on the body with their place
      // in the page lost. A mouse reader is deliberately left alone: focus on
      // `help` is focus claiming Space, and Space is how this piece walks (see
      // releaseFocus and the keydown guard), so handing the ring back after a
      // click would quietly break the corridor. Which of the two it was is not
      // guessed here — every path that shuts the panel says so on the way out.
      if (helpReturnRef.current) {
        opener?.focus();
      }
    };
  }, [showHelp]);

  // Keyboard: Up/Down + Space move deeper/shallower; Left/Right pan the gaze;
  // Shift+Up/Down tilt the gaze up and down instead of walking; Shift+Left/Right
  // turn finely. A held ←/→ is paced by the tick, not by the keyboard's repeat
  // rate — see TURN_HOLD.
  useEffect(() => {
    const onKey = (event) => {
      if (!enteredRef.current) {
        return;
      }
      if (event.key.toLowerCase() === 'h' || event.key === '?') {
        event.preventDefault();
        helpReturnRef.current = true; // a key opened it; a key will be given it back
        setShowHelp((v) => !v);
        return;
      }
      if (event.key === 'Escape') {
        helpReturnRef.current = true;
        setShowHelp(false);
        return;
      }
      // A focused HUD control owns Space and Enter — let the browser's native
      // activation run instead of stealing the keys for navigation. (Stealing
      // Space here made a Tab-focused mute button walk the camera deeper
      // instead of toggling.) Mouse clicks release their focus on activation,
      // so reaching this path means the reader is driving by keyboard.
      if (event.target instanceof Element && event.target.closest('button, [role="button"]')) {
        return;
      }
      if (['ArrowDown', ' '].includes(event.key)) {
        event.preventDefault();
        if (event.shiftKey && event.key === 'ArrowDown') {
          panGaze(0, -0.06); // tilt the gaze down
        } else {
          advance(0.5); // step deeper into the room, then on to the next chapter
        }
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (event.shiftKey) {
          panGaze(0, 0.06); // tilt the gaze up
        } else {
          advance(-0.5); // step back out toward the mouth, then to the previous
        }
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const dir = event.key === 'ArrowRight' ? 1 : -1;
        // Shift turns the head finely — a quarter of everything.
        const fine = event.shiftKey ? TURN_FINE : 1;
        turnHeldRef.current = dir * fine;
        // The FIRST press is a step, so a tap answers crisply and lands
        // somewhere definite. Every press after it is the OS repeating a key
        // the reader is simply holding down, and those are ignored — the tick
        // is turning the head at TURN_HOLD for as long as it stays down, so
        // acting on them too would be counting the same gesture twice, at
        // whatever rate this particular keyboard happens to repeat at.
        if (!event.repeat) {
          panGaze(dir * TURN_STEP * fine);
        }
      }
    };
    // Letting go stops the turn. So does the window losing focus: a key held
    // through an alt-tab never sends its keyup, and the room would go on
    // turning behind an unfocused tab until the reader came back to it.
    const onKeyUp = (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        turnHeldRef.current = 0;
      }
    };
    const onBlur = () => { turnHeldRef.current = 0; };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [advance, panGaze]);

  // Scroll wheel walks the camera in and out in small, calm increments — deeper
  // into the current gallery first, rolling on to the next once fully immersed.
  useEffect(() => {
    const onWheel = (event) => {
      event.preventDefault();
      if (!enteredRef.current) {
        return;
      }
      advance(Math.sign(event.deltaY) * 0.14);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [advance]);

  // Pointer: a mouse/pen drag pans the gaze freely on both axes (grab the
  // world and pull it). Touch has to share ONE finger between looking and
  // walking, so a touch gesture picks an axis and keeps it — see below.
  // A plain click drifts deeper.
  const dragMoved = useRef(false);
  const handlePointerDown = (event) => {
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      turn: turnTarget.current,
      pitch: pitchTarget.current,
      swiped: false,
      // null until the gesture has moved far enough to say what it is:
      // 'walk' (a vertical swipe in or out) or 'look' (turn and tilt).
      axis: null,
    };
    dragMoved.current = false;
  };
  const handlePointerMove = (event) => {
    const start = pointerStart.current;
    if (!start) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragMoved.current = true;
      // The drag writes yaw/pitch straight below rather than going through
      // panGaze, so it has to raise the stamp itself. Past the 4 px threshold
      // only: a click that trembles is not a reader looking around.
      stir();
    }
    const isTouch = event.pointerType === 'touch';
    // The axis lock. A mouse has a scroll wheel for walking, so its drag is free
    // to do both axes at once; a finger has only itself, and vertical drag was
    // spent entirely on the walk. That left the gaze unable to TILT on a phone —
    // and since these plates are painted from above head height, the eye line is
    // exactly what a reader needs to be able to pull down. (Sliding the artwork
    // up its card fixed where the eye RESTS; it did not give the reader a way to
    // look about from there.)
    //
    // So the gesture commits once, at AXIS_LOCK, to whichever axis is winning,
    // and holds it until the finger lifts. A drag that sets off sideways is a
    // LOOK for its whole life — curve it upward and it tilts, and it can never
    // trip the walk by accident. One that sets off downward is a WALK and stays
    // one. Deciding once, early, is what makes it predictable: the alternative
    // (judging every move event afresh) lets a single curved drag flip roles
    // halfway through, which feels like the piece wrestling the reader.
    if (isTouch && !start.axis
        && (Math.abs(dx) > AXIS_LOCK || Math.abs(dy) > AXIS_LOCK)) {
      start.axis = Math.abs(dy) > Math.abs(dx) ? 'walk' : 'look';
    }
    if (isTouch && start.axis === 'walk' && !start.swiped
        && Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) {
      start.swiped = true;
      advance(dy < 0 ? 0.5 : -0.5); // swipe up = press deeper into the room
      return;
    }
    // Grab-the-world: pulling the scene right swings the gaze left, pulling it
    // down tips the gaze up. Pitch maps a full-height drag to its full range;
    // the turn has no range to map to, so it takes a rate instead — a bit over
    // two thirds of a bay per full-width drag, which is the same wrist movement
    // the old bounded pan asked for and puts a complete circle at three drags.
    // Nothing clamps it: keep dragging and the world keeps coming round.
    turnTarget.current = start.turn - (dx / window.innerWidth) * TURN_DRAG;
    // A mouse always tilts; a finger tilts only once it has committed to
    // looking, so a swipe meant as a walk never drags the eye line with it.
    if (!isTouch || start.axis === 'look') {
      const pitch = start.pitch + (dy / window.innerHeight) * PITCH_MAX * 2.2;
      pitchTarget.current = Math.min(Math.max(pitch, -PITCH_MAX), PITCH_MAX);
    }
  };
  const handlePointerUp = () => {
    pointerStart.current = null;
  };
  const handleClick = () => {
    // Only act if this was a click, not the end of a look-around drag.
    if (!enteredRef.current || dragMoved.current) {
      return;
    }
    advance(0.5); // a click steps you further into the room
  };

  const node = NODES[chapter];
  // ── What the world says back, in order of who wins the one spot ──────────
  // The room running late comes first and silences the rest: the other three
  // are all things to say about a gallery that is standing there, and this one
  // is not standing there yet.
  const arrivingShown = arriving && !isDiving && !showHelp;
  // The open door says nothing — the reader is meant to walk into the vortex
  // without having been offered it. Only the world's REFUSALS still speak.
  const refusalShown = refusal !== null && !isDiving && !arrivingShown;
  // The road not taken. Yields to a refusal: that is the world answering
  // something the reader just did, and it outranks an echo of what never was.
  const forkShown = forkEcho !== null && !refusalShown && !isDiving && !arrivingShown;
  // The invitation. Yields to both of the above for the same reason the echo
  // yields to a refusal — and to the help panel, which is the reader having
  // stopped to be told things properly. The three can never coincide anyway
  // (the offer is spent before the echo exists), but they share one spot on
  // screen, and a stack of pills there would read as a notification tray.
  const forkCallShown = forkCall && !refusalShown && !forkShown
    && !isDiving && !showHelp && !arrivingShown;
  // ── Which instrument is hanging ─────────────────────────────────────────
  // One at a time, never both. The chain and the lantern string are not two
  // halves of one scale, they are two ways of knowing where you are: the
  // archive is MEASURED, by a plumb line against brass; the garden is not
  // measured at all, it is lit, one lantern per stone. Hanging them end to end
  // made a single eight-station ruler out of them and quietly turned the
  // lanterns into more of the same gradations — and it drew four stations the
  // hand could never reach, since a drag has never been allowed across the
  // threshold. So the cord carries the world you are IN, at full drop.
  //
  // The swap rides the fall. Crossing either way is a dive or a climb, and the
  // whole HUD is already faded out for the length of it, so the instrument is
  // never seen changing — you fall on a chain and land holding a lantern
  // string.
  const inGarden = chapter > LIBRARY_MAX;
  const realmLo = inGarden ? LIBRARY_MAX + 1 : 0;
  const realmHi = inGarden ? MAX : LIBRARY_MAX;

  // The whole page, not just the canvas: with no scene there is nothing for the
  // chain, the quote or the drift to act on, and leaving the HUD up over a dead
  // rectangle is exactly the lie this is here to stop telling. Every hook above
  // has already run — this is a render branch, not an early exit.
  if (fault) {
    return <Failure kind={fault} />;
  }

  // Everything the veil covers is SHUT while it covers it. The card is one big
  // button over a corridor whose chain, drift, mute and help were all still
  // standing there behind it — reachable by Tab, read out in full by a screen
  // reader, and answering clicks the reader meant for the door. `inert` shuts
  // the whole shell (pointer, focus, AT) for exactly as long as the overture
  // is up, and the veil now hangs OUTSIDE it so it does not shut itself.
  const sealed = veil !== 'gone';

  return (
    <>
    <main
      className={`tour-root${isDiving ? ' is-diving' : ''}`
        + (veil === 'shown' ? ' is-sealed' : '')}
      style={{ '--accent': node.accent }}
      /* The landmark the whole piece lives in. Everything a reader comes here
         for is inside this one element, so it is worth being able to jump
         straight to it — the interface used to expose nothing but the controls
         `nav`, which is the margin, not the room. */
      aria-label="The descent"
      inert={sealed}
      aria-hidden={sealed || undefined}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* A throw anywhere in the scene tree — a plate that will not decode, a
          shader a driver will not take — used to unmount the entire page up to
          the React root, leaving nothing but a stack trace in a console nobody
          has open. Caught here it becomes the same still page the other two
          failures land on. */}
      <SceneBoundary onError={() => setFault('crash')}>
        <DioramaScene
          scenes={scenes}
          onQuality={onQuality}
          descentRef={descentRef}
          immersionRef={immersionRef}
          introRef={introRef}
          accentRef={accentRef}
          yawRef={yawRef}
          panRef={panRef}
          pitchRef={pitchRef}
          tiltRef={tiltRef}
          diveRef={diveRef}
          climbRef={climbRef}
          refuseRef={refuseRef}
          portalRef={doorOpenRef}
          libraryMax={LIBRARY_MAX}
          reduced={reduced}
          onStep={handleStep}
          passRef={passRef}
          stirRef={stirRef}
          enteredRef={enteredRef}
          onContextLost={onContextLost}
          onContextRestored={onContextRestored}
          onArriving={noteArriving}
        />
      </SceneBoundary>

      {/* What the canvas is showing, in one sentence — the node's own summary,
          which is written to describe the plate that hangs there. The canvas
          points at this with aria-describedby (see DioramaScene's onCreated),
          so the description follows the reader down the corridor.

          It is also the ARRIVAL, spoken: the chapter mark and the quote both
          change silently, being ordinary text that is simply replaced, so a
          reader who cannot see the room walk past was told nothing at all
          about having moved. `polite` — it is where you now are, not something
          to interrupt for. */}
      <p className="sr-only" id="gallery-caption" role="status" aria-live="polite">
        {`${node.title} — ${node.subtitle}. ${node.summary}`}
      </p>

      {/* Frames the diorama and darkens the four margins the chrome is
          written into (see .frame-vignette). */}
      <div className="frame-vignette" aria-hidden="true" />

      {/* Where you are, written in the top margin — no card, no glass, no
          rectangle over the artwork. The gallery's number is spoken rather
          than metered. */}
      <div className="chapter-mark">
        <FadeSwap
          id={chapter}
          render={(i) => (
            <>
              <div className="chapter-eyebrow">{MARKS[i]}</div>
              <div className="chapter-title">{NODES[i].subtitle}</div>
            </>
          )}
        />
      </div>

      {/* The quote hangs in the air of the gallery (design: 3b). Words sit at
          three depths and drift on their own cycles; the attribution settles
          into the bottom margin once the last word has surfaced. */}
      {/* The quote hangs in the air of the gallery (design: 3b) and takes ONE
          breath per painting: words gather out of nowhere in scattered order,
          the sentence holds, then it dissolves in a different scattered order
          and the air stays empty for as long as you stand there. The words are
          an arrival, not a loop — this used to re-breathe on a per-chapter
          interval, which read as a caption nagging for attention rather than
          something the room said once.

          Nothing schedules that breath: it IS the mount. The field is keyed by
          arrival and gated on the veil, so it mounts once per arrival (a
          chapter you come back to gets a fresh one), every word's delay is
          baked into its own CSS animation, and `scatter-gone` is `forwards` so
          the dissolve leaves them gone with no timer and no state to keep. */}
      <div className="scatter">
        {/* Keyed by chapter AND tongue, not by chapter alone: on an ascent both
            change together, and a bare chapter key would re-render the leaving
            copy in the language it is being replaced BY — the outgoing quote
            would switch to Spanish halfway through its own dissolve. Carrying
            the tongue in the id lets each layer keep the reading it arrived
            with all the way out. */}
        <FadeSwap
          id={`${chapter}:${lang}`}
          render={(sid) => {
            const [ci, tongue] = sid.split(':');
            const i = Number(ci);
            const es = tongue === 'es';
            const { words, attrD, attrOutD } = SCATTER[narrow ? 'narrow' : 'wide'][tongue][i];
            return (
              <>
                {/* Outside the cycle: the sentence is always here for a
                    screen reader, however the visible words come and go. */}
                <span className="sr-only" lang={es ? 'es' : 'en'}>
                  {es ? NODES[i].folio.lineEs : NODES[i].folio.line}
                </span>
                {veil === 'gone' && (
                <div className="scatter-cycle" key={sid} lang={es ? 'es' : 'en'} aria-hidden="true">
                  {words.map((w, k) => (
                    <span
                      key={k}
                      className="scatter-word"
                      style={{
                        left: `${w.x}%`,
                        top: `${w.y}%`,
                        opacity: w.opacity,
                        filter: w.blur ? `blur(${w.blur}px)` : undefined,
                        animationDuration: `${w.fdur}s`,
                        animationDelay: `${w.fd}s`,
                      }}
                    >
                      <span
                        className="scatter-ink"
                        style={{
                          fontSize: `${w.size}vw`,
                          // Two animations, two delays: the gather, then the
                          // dissolve that takes over from it.
                          animationDelay: `${w.d}ms, ${w.od}ms`,
                        }}
                      >
                        {w.t}
                      </span>
                    </span>
                  ))}
                  <div
                    className="scatter-attr"
                    style={{ animationDelay: `${attrD}ms, ${attrOutD}ms` }}
                  >
                    {es ? NODES[i].folio.attrEs : NODES[i].folio.attr}
                  </div>
                </div>
                )}
              </>
            );
          }}
        />
      </div>

      {/* Ascend and descend now live on the plumb line, so only the stateful
          actions remain — set in the bottom margin (design: 3b). */}
      <nav className="air-acts" aria-label="Tour controls">
        <button
          type="button"
          className={`air-act${autoplay ? ' is-on' : ''}`}
          aria-label={autoplay ? 'Pause the drift' : 'Drift downward on its own'}
          aria-pressed={autoplay}
          onClick={(e) => { e.stopPropagation(); releaseFocus(e); setAutoplay((v) => !v); }}
        >
          {autoplay ? 'drifting…' : 'drift'}
        </button>
        <button
          type="button"
          className={`air-act${muted ? ' is-on' : ''}`}
          aria-label={muted ? 'Unmute the ambience' : 'Mute the ambience'}
          aria-pressed={muted}
          onClick={(e) => { e.stopPropagation(); releaseFocus(e); toggleMute(); }}
        >
          {muted ? 'unmute' : 'mute'}
        </button>
        <button
          type="button"
          className={`air-act is-manual${showHelp ? ' is-on' : ''}`}
          ref={helpBtnRef}
          aria-label={showHelp ? 'Hide the navigation help' : 'Show the navigation help'}
          aria-pressed={showHelp}
          aria-haspopup="dialog"
          aria-expanded={showHelp}
          title="Navigation help (H)"
          onClick={(e) => {
            e.stopPropagation();
            // detail 0 is a keyboard activation — the same test releaseFocus
            // makes, and the one that decides whether the ring comes back.
            helpReturnRef.current = e.detail === 0;
            releaseFocus(e);
            setShowHelp((v) => !v);
          }}
        >
          help
        </button>
      </nav>

      {/* The plumb line — one cord, two instruments, because the two halves of
          the journey are not the same kind of travel.

          Down the LIBRARY it is a chain (design: 1d): the same brass the
          galleries hang their lamps from, with a plumb ring riding it. The ring
          shows the *live* eased descent rather than snapping between chapters,
          and it can be grabbed — drag it and the archive descends with you,
          station tags surfacing as they pass under it.

          Past the door the chain gives out and the cord becomes a LANTERN
          STRING (design: 2a): one paper lantern per stepping stone, kindling
          in turn as the path opens, lit behind you, burning where you stand.
          The garden is walked by lantern-light, not measured by plumb.

          ∧ and ∨ still step the depths one at a time. */}
      <div className="plumb">
        <button
          type="button"
          className="plumb-step"
          aria-label="Ascend one gallery"
          title="Ascend one gallery (↑)"
          onClick={(e) => { e.stopPropagation(); releaseFocus(e); go(-1); }}
          disabled={chapter === 0}
        >
          ∧
        </button>
        <div
          className={`plumb-span${grip !== null ? ' is-gripped' : ''}`
            + (inGarden ? ' is-lantern-string' : ' is-chain')}
          ref={spanRef}
          onPointerDown={chainDown}
          onPointerMove={chainMove}
          onPointerUp={chainUp}
          onPointerCancel={chainUp}
          /* The room behind reads a click as a step into it — the chain's does
             not travel that far. */
          onClick={(e) => e.stopPropagation()}
          /* The stations inside are listitems now that none of them is a
             control, so the cord reads to a screen reader as what it is: the
             list of galleries, with the current one marked. */
          role="list"
        >
          {/* Whichever cord this world is hung on, at its full drop. Keyed by
              realm so the swap remounts and each one gets its own arrival —
              the chain drops out of the dark, the twine unrolls. */}
          {inGarden
            ? <div className="plumb-wire" aria-hidden="true" key="wire" />
            : <div className="plumb-chain" aria-hidden="true" key="chain" />}
          {NODES.map((n, index) => {
            if (index < realmLo || index > realmHi) {
              return null;
            }
            const isGarden = index > LIBRARY_MAX;
            const at = ((index - realmLo) / (realmHi - realmLo)) * 100;
            const cls = ['plumb-mark'];
            if (index === chapter) cls.push('is-active');
            if (isGarden) cls.push('is-garden');
            // Lanterns you have already walked past keep burning, low.
            if (isGarden && index < chapter) cls.push('is-passed');
            // The station the ring would land on if the hand let go now.
            if (grip === index) cls.push('is-grip');
            return (
              /* A MARKER with no handler of its own — but NOT an inert one, and
                 the difference cost a bug. The mark carries no click; the CORD
                 underneath it does, and a press anywhere along the cord travels
                 to the station under the hand (see chainDown on .plumb-span).
                 That has always been true of the cord; what was wrong is that
                 these marks are 2.75rem square and covered ~94% of its length
                 while a guard in chainDown threw away every press that landed
                 on one — so almost the whole rail did nothing whatsoever.
                 Station clicks were once removed for skipping galleries — a
                 press spanning several rooms eases through them without their
                 crossings (see setTarget: a multi-chapter step "is not a
                 passage through any one of them"). That was reinstated
                 deliberately on 2026-08-07: the rail is the one place in the
                 piece that looks like navigation, and a reader who presses it
                 is asking to go somewhere, not to be taught the corridor.
                 Dragging is still the better way through — the ring carries the
                 camera down the cord and every room between is crossed
                 properly — but pressing is no longer punished with silence. */
              <div
                key={n.slug}
                className={cls.join(' ')}
                style={{ top: `${at}%` }}
                role="listitem"
                aria-label={isGarden ? `The path reaches ${n.title}` : `Gallery: ${n.title}`}
                aria-current={index === chapter ? 'true' : undefined}
              >
                {/* The tag hangs off the cord to the left, ending in a small
                    rule that points back at the station it names. */}
                <span className="plumb-tag">
                  <span className="plumb-title">{n.title}</span>
                  <span className="plumb-numeral">{NUMERAL[index]}</span>
                  <span className="plumb-tick" aria-hidden="true" />
                </span>
                {/* The halo is a SIBLING of the lantern, and first, so it
                    paints behind it. Nested inside it could not: the lantern
                    animates `transform` to sway, which makes it a stacking
                    context of its own that no descendant can get behind. */}
                {isGarden ? (
                  <>
                    <span className="plumb-halo" aria-hidden="true" />
                    <span className="plumb-lantern">
                      <span className="plumb-flame" aria-hidden="true" />
                    </span>
                  </>
                ) : (
                  <span className="plumb-node" />
                )}
              </div>
            );
          })}
          {/* The ring itself, swaying on its chain. Position is written
              straight to the DOM by the tick — or by the hand holding it —
              never through React. */}
          <div className="plumb-bob" ref={bobRef} aria-hidden="true">
            <span className="plumb-ring" />
          </div>
        </div>
        <button
          type="button"
          className="plumb-step"
          aria-label="Descend one gallery"
          title="Descend one gallery (↓)"
          onClick={(e) => { e.stopPropagation(); releaseFocus(e); go(1); }}
          disabled={chapter === (doorOpen ? MAX : LIBRARY_MAX)}
        >
          ∨
        </button>
      </div>

      {/* Nothing marks the threshold — no button, no whisper. The walk itself
          is the trigger (any forward step past the vortex becomes the dive, see
          setTarget), and the reader should fall without being told they can. */}

      {/* The wall answering a step it will not take. Same pill, cooled off the
          garden's green — this one is a refusal, not an invitation. Keyed by
          the refusal's stamp so a later bump re-runs the appear rather than
          leaving a stale pill sitting there. */}
      {refusalShown && (
        <div className="door-whisper is-refusal" role="status" key={refusal.at}>
          {refusal.sealed ? SEALED_WHISPER : PATH_END_WHISPER}
        </div>
      )}

      {/* The garden the reader turned away from, named once on arriving in the
          one they turned toward. Same pill again, and deliberately NOT a
          refusal — nothing was denied here, something was chosen. */}
      {forkShown && (
        <div className="door-whisper is-fork" role="status" key={forkEcho.at}>
          {forkWhisper(forkEcho.missed)}
        </div>
      )}

      {/* The same choice, offered instead of remembered. It stands in the room
          before the Fork for as long as the road is open and goes as the step is
          taken, so the piece asks the question while it can still be answered —
          the one room whose subject is that a choice was made used to make it in
          silence. */}
      {forkCallShown && (
        <div className="door-whisper is-call" role="status">
          {FORK_CALL_WHISPER}
        </div>
      )}

      {/* The gallery itself still on its way. Not an answer and not an offer —
          the world admitting it is not ready, so that an empty frame reads as a
          room arriving rather than as a piece that has died. `polite` because it
          is a status about the furniture, not something the reader must act on. */}
      {arrivingShown && (
        <div className="door-whisper is-arriving" role="status" aria-live="polite">
          {ARRIVING_WHISPER}
        </div>
      )}

      {showHelp && (
        <div
          className="help-overlay"
          /* The dialog is the whole covering — scrim and panel together — and
             not the drawn panel alone: what is modal here is the layer that
             takes the screen, and the blurred wash over the corridor is part
             of it rather than a window onto it. So a click on the scrim
             dismisses the panel, and neither it nor a drag across it reaches
             the room behind — which until now took both, walking the camera
             deeper underneath the open panel. */
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-title"
          ref={helpPanelRef}
          onClick={(e) => {
            e.stopPropagation();
            if (e.target !== e.currentTarget) return;
            helpReturnRef.current = false; // dismissed by hand, so leave the hand alone
            setShowHelp(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {/* It always LOOKED like a dialog — a panel on a blurred scrim, with
              the world shut off behind it — and was none of one: no role, no
              title, and focus left standing on the body, so a reader who opened
              it by keyboard was told nothing had happened and could Tab
              straight past it into the corridor underneath. The effect above
              moves focus in, keeps Tab inside, and hands it back to `help`. */}
          <div className="help-panel" tabIndex={-1}>
            <div className="help-title" id="help-title">Navigation help</div>
            <div className="help-body">
              • Scroll, ↑ / ↓, or space walk into a gallery, then on to the next<br />
              • Drag with the mouse to look anywhere — left, right, up, below<br />
              • ← / → also look around; Shift + ↑ / ↓ tilt the gaze up and down<br />
              • Hold an arrow to keep turning; add Shift for a finer, slower turn<br />
              • Swipe up or down to walk in and move between galleries on touch<br />
              • Click to step further into the room<br />
              • Descend and the galleries speak in translation; climb back and
              they speak in Borges' own Spanish<br />
              • Press H or ? to open this guide, Esc to close it<br />
              • Take hold of the brass ring on the chain and drag: the archive
              descends with you, and lets go where you do — every gallery
              between is travelled through, never skipped
            </div>
            <button
              type="button"
              className="help-close"
              onClick={(e) => {
                e.stopPropagation();
                helpReturnRef.current = e.detail === 0; // as on `help` above
                releaseFocus(e);
                setShowHelp(false);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Dive overlays, opacity driven straight from the tick: the faint dark
          breath over the ghost hand-off, and the tunnel-vision vignette that
          closes the periphery in with the fall's thrust. */}
      <div className="dive-vignette" ref={vignetteRef} aria-hidden="true" />
      <div className="vortex-flash" ref={flashRef} aria-hidden="true" />

      {/* The context has gone and may yet come back. Same pill as the world's
          other asides, because that is what this is: the piece saying what is
          happening to it, rather than freezing and letting the reader decide
          whether it is broken or merely slow. If it does not return inside
          GL_PATIENCE the whole page gives way to Failure instead. */}
      {glLost && (
        <div className="door-whisper is-fault" role="status">
          the light guttered. waiting for it back…
        </div>
      )}

    </main>

    {/* Outside the shell above, and after it: the one thing on the page that is
        NOT inert while the overture is up. */}
    {sealed && (
      <EntryVeil
        leaving={veil === 'leaving'}
        onEnter={enter}
        onBegin={beginAgain}
        resume={resume}
        reduced={reduced}
        /* The room behind the card — the only one the door has to wait for. */
        first={scenes[startAt]}
      />
    )}
    </>
  );
}
