// ── The world tour ───────────────────────────────────────────────────────────
// The piece as one built place, without the Midjourney plates: it opens on the
// map of the whole walk (EntryMap), and choosing a room flies down into it and
// stays there — standing, looking, walking on (see `worldRooms` in EntryMap.jsx
// and src/world). The plate tour is set aside behind ?plates (main.jsx).
import { useState } from 'react';
import EntryMap from './EntryMap';
import { canDraw } from './Failure';
import { LIBRARY_NODES } from './catalogue';
import StaticTour from './StaticTour';

const LIBRARY_MAX = LIBRARY_NODES.length - 1;

export default function WorldTour() {
  const [drawable] = useState(canDraw);
  if (!drawable) return <StaticTour reason="This device cannot draw the 3D Library. You can still read every room below." />;
  return <EntryMap worldRooms libraryMax={LIBRARY_MAX} resumeAt={null} shared={false} />;
}
