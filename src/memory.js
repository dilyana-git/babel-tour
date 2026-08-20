// ── What the walk remembers between visits ───────────────────────────────────
// The tour was amnesiac. Every reload put the reader back in the Vestibule with
// the door to the garden sealed again, and the pools were drawn with no notion
// of which paintings this reader had already stood in front of — so a second
// visit could hang the same four plates as the first, and the restock's promise
// (that the rest of the art gets seen by coming back) only ever held WITHIN one
// session. Three things are kept here and nothing else. No identifiers, no
// analytics: one small JSON object under one key.
//
//   chapter  how far the walk had got, so it can be taken up again
//   door     whether the garden had been unsealed — dwelling in The Silence
//            earns it, and without keeping it a resumed walk would land in a
//            world the tour still believed was locked
//   seen     which VERSIONS of the paintings have been hung for this reader, so
//            the draw can prefer ones they have never been shown
//
// Storage does not merely come back empty when it is unavailable — it THROWS:
// Safari's private mode, an iframe with third-party storage blocked, a browser
// with cookies switched off. A piece that dies at its own front door because it
// could not write a bookmark is worse than one that forgets, so every touch is
// guarded and the first failure turns this module into a no-op for the rest of
// the session: writes go nowhere, reads come back empty, the walk simply
// behaves the way it always used to.

const KEY = 'babel.walk.v1';

// ── The switch ───────────────────────────────────────────────────────────────
// Turned OFF 2026-08-07 at the user's request: every visit is to begin at the
// beginning — the overture, then the Vestibule — rather than resuming wherever
// the last one was abandoned. The piece opens on an establishing shot now (see
// the opening withdrawal in DioramaScene), and a walk that resumes three
// galleries down in the garden never lets anyone see the thing the tour opens
// with. It also makes every load reproducible, which is worth a great deal
// while the opening is being tuned.
//
// Everything below still WORKS — the module is gated, not gutted — so this is
// one word to put back. What survives the switch being off is the seen-set for
// the length of a single visit: within one walk the corridor still avoids
// re-hanging a painting it has already shown you (see unseenFirst), it simply
// does not carry that across visits.
const REMEMBERS_ACROSS_VISITS = false;

// null until the first touch decides; false once we know it cannot be used.
let store;

const backing = () => {
  if (store !== undefined) return store;
  try {
    const ls = window.localStorage;
    // Availability is not the same as usability — a quota of zero, or a policy
    // that blocks writes while allowing reads, both only show up on setItem.
    ls.setItem(KEY + '.probe', '1');
    ls.removeItem(KEY + '.probe');
    store = ls;
  } catch (err) {
    console.info('[walk] nothing can be remembered here (%s) — this visit will '
      + 'behave as a first one', err?.name ?? 'unknown');
    store = null;
  }
  return store;
};

// The walk as it stands, in memory. Written through to storage on every change,
// and kept here as well so that a session with no storage at all still has a
// coherent seen-set for its own length.
const walk = { chapter: 0, door: false, seen: [] };
const seen = new Set();

(() => {
  const ls = backing();
  if (!ls) return;
  // Switched off: forget what is already written, rather than merely declining
  // to read it. A walk left in storage from before the switch would otherwise
  // lie in wait — invisible, since nothing reads it — and come back the moment
  // anyone turned remembering on again, which is the confusing version of this.
  if (!REMEMBERS_ACROSS_VISITS) {
    try { ls.removeItem(KEY); } catch { /* nothing more to be done */ }
    return;
  }
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return;
    // Everything is re-checked rather than trusted: this is data from an older
    // build of the piece (chapter counts have changed before, and will again)
    // or from a reader who edited it.
    if (Number.isFinite(saved.chapter)) walk.chapter = Math.max(0, Math.trunc(saved.chapter));
    walk.door = saved.door === true;
    if (Array.isArray(saved.seen)) {
      for (const path of saved.seen) {
        if (typeof path === 'string') seen.add(path);
      }
    }
  } catch (err) {
    // A half-written or hand-edited blob: start over rather than argue with it.
    console.info('[walk] the remembered walk could not be read (%s) — starting fresh',
      err?.name ?? 'unknown');
    try { ls.removeItem(KEY); } catch { /* nothing more to be done */ }
  }
})();

const flush = () => {
  if (!REMEMBERS_ACROSS_VISITS) return;
  const ls = backing();
  if (!ls) return;
  try {
    walk.seen = [...seen];
    ls.setItem(KEY, JSON.stringify(walk));
  } catch {
    // Quota, or storage revoked mid-session. Not worth a word to the reader —
    // the walk goes on, it just will not be there next time.
  }
};

// Where the reader had got to, and whether the garden was open to them. The
// caller decides what to do with it — see Tour's `opening`, which lets a shared
// link outrank it and offers the reader the choice either way.
export const recallWalk = () => (REMEMBERS_ACROSS_VISITS
  ? { chapter: walk.chapter, door: walk.door }
  // A first visit, every visit: the Vestibule, and a garden still to be earned
  // by dwelling in The Silence. `walk` is left untouched rather than zeroed so
  // that turning the switch back on is the only change needed.
  : { chapter: 0, door: false });

// Arriving in a gallery. Called on every arrival, which is rarely enough (once
// per crossing, ~7 s at the fastest) that writing through each time costs
// nothing worth measuring.
export const rememberWalk = (chapter, door) => {
  walk.chapter = chapter;
  // The door only ever opens. A reader who walks back up into the library has
  // not re-sealed the garden, and neither does one who quits from there.
  walk.door = walk.door || door === true;
  flush();
};

// Begin again: the reader chose the Vestibule over their own bookmark. The
// door and the seen-set survive — those are things this reader has EARNED, and
// making them re-dwell for the door (or re-watch paintings they have already
// been shown) is not what "start from the top" means.
export const forgetPosition = () => {
  walk.chapter = 0;
  flush();
};

// ── Which paintings this reader has been shown ───────────────────────────────
// Keyed by the plate's own path, which is what identifies a version of a room
// (see the variant tables in Tour). Marked on ARRIVAL rather than at the draw:
// the corridor hangs eight galleries at once and restocks ones nobody is
// looking at, and "shown" ought to mean the reader actually stood in it.

export const markSeen = (colorPath) => {
  if (!colorPath || seen.has(colorPath)) return;
  seen.add(colorPath);
  flush();
};

// Narrow a pool to the versions this reader has never been shown — and give the
// whole pool back once they have seen them all, so a returning reader gets a
// random draw rather than nothing. Deliberately applied AFTER `livingFirst` in
// both draws: a gallery that can move matters more than a gallery that is new,
// and the two rarely disagree.
export const unseenFirst = (variants, keyOf = (v) => v.color) => {
  const fresh = variants.filter((v) => !seen.has(keyOf(v)));
  return fresh.length ? fresh : variants;
};

// ── The shareable link ───────────────────────────────────────────────────────
// ?variant= and ?clip= exist for looking at one painting on demand; they are
// tools, and they name files. What a reader can send someone is a ROOM: the
// hash carries the gallery's own slug, is written on every arrival, and is read
// once at load. history.replaceState rather than assignment so that walking the
// corridor does not fill the back button with eight entries of the same page —
// Back should leave the Library, not retrace it one gallery at a time.

export const sharedSlug = () => {
  if (typeof window === 'undefined' || !REMEMBERS_ACROSS_VISITS) return null;
  const hash = window.location.hash.replace(/^#/, '').trim();
  return hash ? decodeURIComponent(hash) : null;
};

// …and with the switch off, take the stale one out of the bar. It is the OTHER
// half of arriving somewhere you did not ask for: a reader whose last visit
// wrote `#endless-garden` has that hash in every bookmark, reload and restored
// tab, and while nothing reads it any more, a URL that still names the garden
// is a URL that still looks like it will open there. replaceState, so this
// costs no history entry and no navigation.
if (typeof window !== 'undefined' && !REMEMBERS_ACROSS_VISITS
    && window.location.hash && window.history?.replaceState) {
  try {
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', `${pathname}${search}`);
  } catch { /* a sandboxed iframe may refuse; the hash is inert either way */ }
}

export const writeSlug = (slug) => {
  if (typeof window === 'undefined' || !REMEMBERS_ACROSS_VISITS) return;
  if (!window.history?.replaceState) return;
  const { pathname, search, hash } = window.location;
  const next = `#${slug}`;
  if (hash === next) return;
  try {
    window.history.replaceState(null, '', `${pathname}${search}${next}`);
  } catch {
    // Some embeddings (a sandboxed iframe with no same-origin) refuse history
    // writes. The walk is unaffected; only the link in the bar goes stale.
  }
};
