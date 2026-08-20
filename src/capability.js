// ── What this machine can be asked for ───────────────────────────────────────
// Three device facts, decided ONCE at module load and shared by Tour and
// DioramaScene so the two can never disagree about what kind of machine they
// are drawing on. They are deliberately constants rather than hooks: none of
// them can change without a reload (a phone does not grow a mouse), and a
// re-render that re-tessellated every slab stack would cost far more than the
// case it was covering.
//
// Every one of them is overridable from the query string, because the whole
// point of a device tier is that it is guessed — and a guess needs a way to be
// checked by hand on the machine it was guessed for:
//
//   ?coarse=1 / ?coarse=0   force the touch/low-power mesh on or off
//   ?thrift=1 / ?thrift=0   force the whole data-saver walk on or off
//   ?stills=1 / ?stills=0   force the video off (or on) and NOTHING else
//
// Read them with `?coarse=1` on a desktop to see exactly what a phone is
// getting, which is the only honest way to judge whether the reduction shows.

const flag = (name) => {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get(name);
  if (v === null) return null;
  return v !== '0' && v !== 'off' && v !== 'false';
};

// A pointer that cannot hover. This is the honest test for "phone or tablet" —
// far better than a user-agent sniff, and better than a width query, which a
// narrow desktop window would trip. It is used for two unrelated things: the
// mesh reduction below, and Tour's touch gestures.
export const COARSE = flag('coarse') ?? (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(pointer: coarse)').matches
);

// The reader has asked their browser to spend less data ("Data Saver" in
// Chrome/Android), or is on a connection the browser itself calls slow. A
// default walk pulls ~590 MB of clips, and a clip is 9-25 MB EACH — on a
// metered connection that is not an enhancement, it is a bill. Under thrift the
// paintings still hang, still have their full depth relief, and can still be
// walked into; they simply never wake into motion. The piece stays whole.
//
// navigator.connection is Chromium-only, so this is false on Safari and Firefox
// unless asked for by hand. That is the right way round: guessing WRONG here
// silently removes the video from a reader who could have had it, so the flag
// only fires where the browser states the fact outright.
export const THRIFT = flag('thrift') ?? (() => {
  if (typeof navigator === 'undefined') return false;
  const c = navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection;
  if (!c) return false;
  return c.saveData === true || /^(slow-2g|2g|3g)$/.test(c.effectiveType ?? '');
})();

// Whether to draw the slab stacks at half tessellation on each axis (a QUARTER
// of the vertices). The macro depth of this scene comes from where each slab is
// placed in Z, not from vertex displacement — the mesh only has to carry the
// gentle in-slab relief — so this is the cheapest large saving available, and
// on the art it is very hard to see. It was the last open item of TODO
// beauty-14, and the largest remaining per-frame cost after the dpr cap.
//
// Six slab stacks are in flight at once, so at the full 240x120 that is roughly
// 1.4 M quads per frame, each fragment also doing relief + unsharp work. A
// phone GPU does not have that to give.
export const LIGHT_MESH = COARSE || THRIFT;

// Whether the paintings may wake into their clips at all.
//
// Split out of THRIFT so the question "does the piece read better as stills?"
// can actually be ASKED. ?thrift=1 answers a different question: it drops the
// video AND halves the tessellation (via LIGHT_MESH above), so a walk under it
// is both still and softer, and any judgement about the clips is confounded by
// a mesh change made for an unrelated reason. ?stills=1 takes the video and
// leaves the geometry at full quality, which is the only honest A/B.
//
// THRIFT still implies it — a reader on a metered connection gets no clips
// however this is set — so the data-saver behaviour is unchanged. Passing
// ?stills=0 does NOT put the clips back for such a reader; the thrift default
// is about their bill, not about taste.
export const STILLS_ONLY = THRIFT || (flag('stills') ?? false);

// The device-pixel ceiling, for the same reason the cap exists at all: this
// scene is fill-rate bound, so every extra pixel is paid for twice over in
// fragment work. A phone's 3x screen is exactly where that hurts most.
//
// FIRST-PASS NUMBERS — they have not been tuned against real hardware, only
// reasoned about. If the phone render looks soft rather than slow, raise the
// COARSE figure toward 1.5; that is the dial.
export const DPR_MAX = THRIFT ? 1 : COARSE ? 1.25 : 1.5;
