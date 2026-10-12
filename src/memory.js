// ── A room as an address ─────────────────────────────────────────────────────
// What a reader can send someone is a ROOM: while they stand in one, the
// address bar carries its slug (`#pavilion`) and the tab its name. A link
// opened with a room in it opens where the piece always opens — the drawing,
// then the map — with that room lit and offered first ("where you were sent");
// nobody is dropped into a room past the opening. On the map the address is
// the piece's own again, so a link copied there sends the piece, not the last
// room stood in.
//
// A reload inside a room is offered the same room back, as "where you left
// off": the tab remembers the last room it stood in (sessionStorage — this
// tab, this visit). Nothing is kept BETWEEN visits. That was switched off on
// 2026-08-07 at the user's request — every visit begins at the beginning — and
// it stays off: no localStorage, no identifiers, nothing to forget.
//
// history.replaceState, never assignment: walking the rooms must not fill the
// back button with eight entries of the same page. Back leaves the Library.
//
// Storage and history do not merely fail quietly where they are unavailable —
// they THROW (Safari's private mode, a sandboxed iframe, cookies switched
// off). Every touch is guarded: a piece that dies at its own front door
// because it could not write a bookmark is worse than one that forgets.

const HERE = 'babel.here';

// What the plate tour used to keep between visits. Nothing reads it now; a
// walk left in storage from before is taken out rather than left to lie there.
try { window.localStorage?.removeItem('babel.walk.v1'); } catch { /* nothing to be done */ }

// The room the address names, if it names one: its slug, else null.
export const sharedSlug = () => {
  if (typeof window === 'undefined') return null;
  try {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, '').trim());
    return hash || null;
  } catch {
    return null;
  }
};

// Standing in a room (its slug), or back on the map (null).
export const writeSlug = (slug) => {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const { pathname, search, hash } = window.location;
  const next = slug ? `#${slug}` : '';
  if (hash === next) return;
  try {
    window.history.replaceState(null, '', `${pathname}${search}${next}`);
  } catch {
    // Some embeddings refuse history writes. The walk is unaffected; only the
    // link in the bar goes stale.
  }
};

// The last room this tab stood in, for telling a reload from a link.
export const noteHere = (slug) => {
  try {
    if (slug) window.sessionStorage.setItem(HERE, slug);
    else window.sessionStorage.removeItem(HERE);
  } catch { /* this visit simply will not know a reload from a link */ }
};

export const wasHere = () => {
  try {
    return window.sessionStorage.getItem(HERE);
  } catch {
    return null;
  }
};
