// ── A volume, open ───────────────────────────────────────────────────────────
// What a reader sees when one of the Library's books is taken down (audit III,
// 8·2; the user's picks of 2026-10-12: taken by hand, and shown as the book
// itself, open at two pages). It is the book the story describes — "each book
// is of four hundred and ten pages; each page, of forty lines, each line, of
// some eighty letters which are black in color" — in the Library's twenty-five
// symbols (twenty-two letters, the comma, the period and the space): two
// facing pages of forty lines each, and in one of them a line that reads.
//
// That line is set as the book would set it, in the same letters at the same
// size, only inked; under the book it is said again as the room's caption says
// things, with the shelf it came from, because forty lines to a page is small
// print on a laptop and the sentence is the point.
//
// The pages are the same every time for the same room (a seeded stream), so a
// volume is a thing with contents, not a new roll of the dice; the seed is
// the place to hang "any book can be taken down" on, later.
//
// Not yet wired to a hand in the world: EntryMap opens it for a look with
// ?wread (the volume of the room stood in).
import { useEffect, useMemo, useRef, useState } from 'react';
import { STORY, VOICES } from './voices';
import './book.css';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const READ_PREVIEW = Q.has('wread');

const SYMBOLS = 'abcdefghilmnopqrstuvxyz,.';
const LINES = 40;
// The measure: how wide a line is set, in ems of its own type. It follows
// from the leaf's shape (book.css: the text is 82% of the leaf's width, its
// type 1.779% of the leaf's height, the leaf 0.732 wide to 1 tall), less a
// hair for the justifying to take up.
const MEASURE = 33.3;
// What each symbol takes of that, in the book face (Cormorant Garamond 500,
// measured; the semibold of the found line is within a hundredth). The
// letters are random, so a line cannot be justified by its spaces the way
// prose is — a row short of the measure by three letters opened rivers
// between its "words". Each row is set letter by letter until the measure is
// full, and what is left over is less than one letter: "some eighty", as the
// story has it, and never the same count twice.
const WIDE = {
  a: 0.42, b: 0.512, c: 0.415, d: 0.512, e: 0.411, f: 0.305, g: 0.447, h: 0.502, i: 0.27, l: 0.261, m: 0.768, n: 0.52,
  o: 0.482, p: 0.511, q: 0.492, r: 0.369, s: 0.338, t: 0.338, u: 0.497, v: 0.436, x: 0.439, y: 0.432, z: 0.405,
  ',': 0.222, '.': 0.2, ' ': 0.234,
};
const widthOf = (text) => [...text].reduce((w, c) => w + (WIDE[c] ?? 0.45), 0);
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

// Which of a room's lines (voices.js) its volume holds, and where: the wall
// and shelf it stands on, its number on that shelf, the page it falls open
// at, and how far down that page the line is.
const VOLUMES = {
  vestibule: { line: 3, wall: 3, shelf: 2, volume: 17, page: 205, at: 15 },
  echo: { line: 2, wall: 5, shelf: 4, volume: 9, page: 121, at: 22 },
  silence: { line: 3, wall: 2, shelf: 3, volume: 31, page: 409, at: 30 },
  vertigo: { line: 3, wall: 6, shelf: 1, volume: 24, page: 77, at: 11 },
  door: { line: 3, wall: 1, shelf: 5, volume: 3, page: 263, at: 19 },
  fork: { line: 3, wall: 4, shelf: 2, volume: 12, page: 39, at: 26 },
  pavilion: { line: 1, wall: 2, shelf: 1, volume: 28, page: 311, at: 8 },
  web: { line: 0, wall: 6, shelf: 5, volume: 35, page: 187, at: 17 },
};

const stream = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
const seedOf = (text) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

// Letters as the Library has them, as many as fill `room` ems: no word longer
// than a breath, never two spaces together, never a space at either end.
const noise = (rnd, room) => {
  let out = '', left = room;
  for (;;) {
    const gap = out.length > 0 && out[out.length - 1] !== ' ' && left > 1.2 && rnd() < 0.17;
    const c = gap ? ' ' : SYMBOLS[Math.floor(rnd() * SYMBOLS.length)];
    if (WIDE[c] > left) break;
    out += c;
    left -= WIDE[c];
  }
  return out.replace(/ $/, '');
};

// The sentence in the book's own orthography: its twenty-two letters, the
// comma and the period, and nothing else.
const inSymbols = (text) => text
  .toLowerCase()
  .replace(/[?!;:]/g, '.')
  .replace(/[^a-z,. ]/g, '')
  .replace(/\s+/g, ' ')
  .replace(/^[ ,.]+/, '')
  .trim();

function pagesOf(slug) {
  const v = VOLUMES[slug] ?? VOLUMES.vestibule;
  const said = (VOICES[slug] ?? VOICES.vestibule)[v.line];
  const rnd = stream(seedOf(slug) + v.volume * 1000 + v.page);
  const verso = Array.from({ length: LINES }, () => [{ t: noise(rnd, MEASURE) }]);
  // The line, where it falls: after the noise before it on its row, and run
  // on to the next row where the row ends first.
  const words = inSymbols(said).split(' ');
  const recto = [];
  while (recto.length < LINES) {
    if (recto.length !== v.at) { recto.push([{ t: noise(rnd, MEASURE) }]); continue; }
    const lead = `${noise(rnd, 4 + rnd() * 6)} `;
    let row = [{ t: lead }], found = '', room = MEASURE - widthOf(lead);
    for (const w of words) {
      const add = (found ? ' ' : '') + w;
      if (widthOf(add) > room) {
        row.push({ t: found, found: true });
        recto.push(row);
        row = [];
        found = w;
        room = MEASURE - widthOf(w);
      } else {
        found += add;
        room -= widthOf(add);
      }
    }
    row.push({ t: found, found: true });
    if (room > 2.4) row.push({ t: ` ${noise(rnd, room - WIDE[' '])}` });
    recto.push(row);
  }
  return { v, said, verso, recto: recto.slice(0, LINES), letters: inSymbols(said).length };
}

export default function OpenBook({ slug, index, garden = false, onClose }) {
  const book = useMemo(() => pagesOf(slug), [slug]);
  const backRef = useRef(null);
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // The line is found as the opening finds its sentence: its letters stand in
  // the Library's noise at first and come right from the left, a few at a time.
  const [clear, setClear] = useState(reduced ? Infinity : 0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduced || clear >= book.letters) return undefined;
    const id = setTimeout(() => { setClear((n) => n + 2); setTick((n) => n + 1); }, clear === 0 ? 900 : 55);
    return () => clearTimeout(id);
  }, [clear, reduced, book.letters]);

  // It is a dialog: it takes the focus, gives it back, and Escape puts the
  // book back. (Keys are stopped here so that W does not walk the reader off
  // from under it.)
  useEffect(() => {
    const was = document.activeElement;
    backRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key !== 'Tab') e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      was?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  const scramble = useMemo(() => stream(seedOf(slug) * 3 + tick), [slug, tick]);
  let done = 0;
  const row = (segments, k) => (
    <p key={k} className="book-line">
      {segments.map((s, i) => {
        if (!s.found) return <span key={i}>{s.t}</span>;
        const from = done;
        done += s.t.length + 1;
        const text = [...s.t].map((c, j) => (c === ' ' || from + j < clear ? c : SYMBOLS[Math.floor(scramble() * SYMBOLS.length)])).join('');
        return <span key={i} className={`book-found${from < clear ? ' is-clear' : ''}`}>{text}</span>;
      })}
    </p>
  );

  const { v } = book;
  // (the garden has paths, not hexagons, and no shelves: what its volumes are
  // — the board showed loose leaves of the novel — is still to be settled)
  const place = garden
    ? `Path ${ROMAN[index] ?? 'V'} · the novel`
    : `Hexagon ${ROMAN[index] ?? 'I'} · wall ${v.wall} · shelf ${v.shelf}`;
  return (
    <div
      className={`open-book${garden ? ' is-garden' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-said"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="book" aria-hidden="true">
        <div className="book-block">
          <div className="book-page is-verso">
            <div className="book-leaf">
              <div className="book-head">
                <span>{v.page - 1}</span>
                <span>{place}</span>
              </div>
              <div className="book-lines">{book.verso.map(row)}</div>
            </div>
          </div>
          <div className="book-page is-recto">
            <div className="book-leaf">
              <div className="book-head">
                <span>{`Volume ${v.volume}`}</span>
                <span>{v.page}</span>
              </div>
              <div className="book-lines">{book.recto.map(row)}</div>
            </div>
          </div>
          {/* the marker: silk, so it does not lie straight */}
          <svg className="book-ribbon" viewBox="0 0 40 600" preserveAspectRatio="none">
            <path className="book-ribbon-shade" d="M9 0 C 13 140, 25 300, 19 470 S 24 585, 21 600" />
            <path className="book-ribbon-silk" d="M7 0 C 11 140, 23 300, 17 470 S 22 585, 19 600" />
            <path className="book-ribbon-light" d="M6 0 C 10 140, 22 300, 16 470 S 21 585, 18 600" />
          </svg>
        </div>
      </div>
      <div className="book-label">
        <div className="book-label-words">
          <p className="book-mark">{`${place} · volume ${v.volume} · page ${v.page}`}</p>
          <p className="book-said" id="book-said">
            {`“${book.said}”`}
            <span className="book-from">{garden ? STORY.garden : STORY.library}</span>
          </p>
        </div>
        <button ref={backRef} type="button" className="book-back" onClick={() => onClose?.()}>
          Put it back
          <svg viewBox="0 0 16 10" aria-hidden="true"><path d="M15 5 H2 M6 1 L2 5 L6 9" /></svg>
        </button>
      </div>
    </div>
  );
}
