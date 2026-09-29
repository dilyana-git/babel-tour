// ── The room's voice ─────────────────────────────────────────────────────────
// The last line of the room's caption (EntryMap's room plate). It used to say
// one thing per room and then nothing, for as long as the reader stood there.
// Now it says the room's own line, and after it what the story says: a
// quotation at a time from voices.js, each one surfacing a word at a time and
// holding long enough to be read twice, round and round. On the way between
// rooms it says where to, then gives the road a line of its own.
//
// Every line the room could say is set at once, stacked in one grid cell, and
// all but one of them unseen: the caption is as tall as its longest line from
// the moment the reader arrives, so the room's name above it never jumps as a
// longer quotation comes in.
//
// All of it is aria-hidden. The room plate is a live region and a quotation
// every ten seconds would be read out over everything else; EntryMap keeps the
// plain line for a screen reader beside it.
import { useEffect, useState } from 'react';

// Where each room's quotations had got to, for this visit to the page: a reader
// who walks back into a room hears the next one, not the first one again.
const heard = new Map();

// Long enough to read twice at an easy pace, words surfacing included.
const holdFor = (text) => Math.min(16000, Math.max(8000, 4500 + text.length * 50));

const rotate = (list, by) => list.map((_, k) => list[(k + by) % list.length]);

// `lines` is everything the room can say ({ id, text, from?, hold? }; `from`
// makes it a quotation and names its story). `lead` is what it is saying now,
// in order, and `quotes` what follows it round and round; with no quotes the
// caption stops on the last of `lead`.
export default function RoomVoice({ room, lines, lead, quotes = [] }) {
  const key = `${room}|${lead.join('+')}`;
  const fresh = () => ({ key, k: 0, from: heard.get(room) ?? 0 });
  const [at, setAt] = useState(fresh);
  let cur = at;
  if (at.key !== key) {
    cur = fresh();
    setAt(cur);
  }
  const order = [...lead, ...rotate(quotes, cur.from)];
  const on = order[cur.k];
  const line = lines.find((l) => l.id === on);
  const hold = line?.hold ?? holdFor(line?.text ?? '');
  const loop = quotes.length > 0;
  const last = cur.k >= order.length - 1;

  useEffect(() => {
    if (order.length < 2 || (last && !loop)) return undefined;
    const t = setTimeout(() => setAt((a) => (a.key === key
      ? { ...a, k: (a.k + 1) % order.length }
      : a)), hold);
    return () => clearTimeout(t);
  }, [key, cur.k, hold, last, loop, order.length]);

  const quoteAt = quotes.indexOf(on);
  useEffect(() => {
    if (quoteAt >= 0) heard.set(room, (quoteAt + 1) % quotes.length);
  }, [room, quoteAt, quotes.length]);

  return (
    <div className="room-summary room-voice" aria-hidden="true">
      {lines.map((l) => {
        const words = l.text.split(' ');
        const quoted = Boolean(l.from);
        return (
          <p
            key={`${room}:${l.id}`}
            className={`room-voice-line${quoted ? ' is-quote' : ''}${l.id === on ? ' is-on' : ''}`}
            style={{ '--n': words.length }}
          >
            {words.map((w, i) => (
              <span key={i} className="room-voice-w" style={{ '--i': i }}>
                {quoted && i === 0 ? '“' : ''}
                {w}
                {i < words.length - 1 ? ' ' : quoted ? '”' : ''}
              </span>
            ))}
            {quoted && <span className="room-voice-from">{l.from}</span>}
          </p>
        );
      })}
    </div>
  );
}
