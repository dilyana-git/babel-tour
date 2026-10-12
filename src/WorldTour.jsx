// ── The world tour ───────────────────────────────────────────────────────────
// The piece as one built place: it opens on the
// map of the whole walk (EntryMap), and choosing a room flies down into it and
// stays there — standing, looking, walking on (see `worldRooms` in EntryMap.jsx
// and src/world).
import { useState } from 'react';
import EntryMap from './EntryMap';
import { Failure, canDraw } from './Failure';
import { LIBRARY_NODES, NODES } from './catalogue';
import { sharedSlug, wasHere } from './memory';

const LIBRARY_MAX = LIBRARY_NODES.length - 1;

export default function WorldTour() {
  const [drawable] = useState(canDraw);
  // A room in the address (memory.js): the piece opens as it always does, on
  // the drawing and then the map, with that room lit and offered first — as
  // where the reader was sent, or, if this tab was standing in it when it was
  // reloaded, where they left off.
  const [opening] = useState(() => {
    const slug = sharedSlug();
    const at = NODES.findIndex((node) => node.slug === slug);
    return at < 0 ? null : { at, shared: wasHere() !== slug };
  });
  if (!drawable) return <Failure kind="webgl" />;
  return <EntryMap worldRooms libraryMax={LIBRARY_MAX} resumeAt={opening?.at ?? null} shared={opening?.shared ?? false} />;
}
