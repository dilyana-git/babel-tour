// ── The ending ───────────────────────────────────────────────────────────────
// What the map says when the film at the heart of the maze has come down on it
// (EntryMap; world/finaleLook.js). It used to say what it said before the
// walk: the last room's card, with "Enter The Web of Time" under it. The piece
// did not end; it stopped.
//
// Now, in the card's place and in three beats, each coming in where it will
// stay so that nothing moves:
//   the line      the walk's last sentence, alone under the title, over the
//                 walk drawn in light — where the story's first sentence was
//                 found while the Library was put together (Assembly.jsx)
//   the colophon  the two stories, whose English this is, when it was made
//   the ways on   to walk it again, from the Vestibule; or to the map as it
//                 was, a room to choose
// `stage`: 1, 2, 3. A hand on anything brings all three.
// `look`: how the line comes in (world/endingIn.js): 'a' whole, 'b' found a
// letter at a time, 'c' a word at a time, 'd' whole; null, as it was.
import { useEffect, useRef } from 'react';
import { STORY } from './voices';
import { stream } from './ink';
import { FOUND } from './world/endingIn';

// The walk's last sentence: the Web of Time's first, and what is cut round
// the armillary's stand.
const LINE = 'Time forks perpetually toward innumerable futures.';
const WORDS = LINE.split(' ');
// Who made the walk, for its maker to sign; unsigned, the colophon gives the year alone.
const MADE = { by: '', year: 2026 };
// The Library's alphabet (Assembly.jsx): what a letter not yet found stands in.
const SYMBOLS = 'abcdefghilmnopqrstuvxyz';

// The line, found (b). Every letter has its own place from the first moment —
// the true letter holds it, unseen, and what is turned over in the search is
// laid over it — so the line is set as it will stand and nothing reflows.
function FoundLine() {
  const ref = useRef(null);
  useEffect(() => {
    const cells = [...ref.current.querySelectorAll('.map-ending-ch')];
    const rnd = stream(733);
    const n = cells.length;
    const t0 = performance.now();
    // roughly in reading order, as the first sentence was
    const lockAt = cells.map((_, i) => FOUND.from + FOUND.over * (0.7 * (i / n) + 0.3 * rnd()));
    const next = new Float64Array(n);
    const found = new Float64Array(n);
    let timer = 0;
    const tick = () => {
      const now = performance.now(), t = now - t0;
      let busy = 0;
      cells.forEach((cell, i) => {
        if (found[i] < 0) return;
        busy += 1;
        if (found[i]) {
          if (now - found[i] > FOUND.glow) {
            cell.classList.remove('is-new');
            found[i] = -1;
          }
        } else if (t >= lockAt[i]) {
          found[i] = now;
          cell.classList.add('is-found', 'is-new');
        } else if (now >= next[i]) {
          cell.lastChild.textContent = SYMBOLS[Math.floor(rnd() * SYMBOLS.length)];
          next[i] = now + 140 + rnd() * 420;
        }
      });
      if (busy) timer = setTimeout(tick, FOUND.tick);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <p className="map-ending-said">{LINE}</p>
      <p ref={ref} aria-hidden="true">
        {WORDS.map((word, w) => (
          <span key={w}>
            {w > 0 && ' '}
            <span className="map-ending-word">
              {[...word].map((ch, i) => (
                <span key={i} className={`map-ending-ch${/[a-z]/i.test(ch) ? '' : ' is-found'}`}>
                  <span>{ch}</span>
                  <span />
                </span>
              ))}
            </span>
          </span>
        ))}
      </p>
    </>
  );
}

export default function Ending({ stage, look = null, reducedMotion = false, againRef, onAgain, onMap }) {
  return (
    <section className={`map-ending is-stage-${stage}`} aria-label="The end of the walk">
      <blockquote className="map-ending-line">
        {look === 'b' && !reducedMotion ? <FoundLine />
          : look === 'c' ? (
            <p>
              {WORDS.map((word, w) => (
                <span key={w}>
                  {w > 0 && ' '}
                  <span className="map-ending-w" style={{ '--i': w }}>{word}</span>
                </span>
              ))}
            </p>
          ) : <p>{LINE}</p>}
        <cite>{STORY.garden}</cite>
      </blockquote>
      <div className="map-ending-colophon" aria-hidden={stage < 2 || undefined}>
        <span className="map-ending-rule" aria-hidden="true" />
        <p>
          A walk through two stories by Jorge Luis Borges,{' '}
          <span lang="es">“La biblioteca de Babel”</span> and{' '}
          <span lang="es">“El jardín de senderos que se bifurcan”</span>, both first printed in Buenos Aires in 1941.
        </p>
        <p>
          Their words are given in the English of <cite>Labyrinths</cite> (New Directions, 1962): the Library
          in James E. Irby’s translation, the garden in Donald A. Yates’s.
        </p>
      </div>
      <div className="map-ending-ways" inert={stage < 3} aria-hidden={stage < 3 || undefined}>
        <button ref={againRef} type="button" className="map-enter" onClick={onAgain}>
          Walk it again
          <svg viewBox="0 0 16 10" aria-hidden="true"><path d="M1 5 H14 M10 1 L14 5 L10 9" /></svg>
        </button>
        <button type="button" className="map-ending-map" onClick={onMap}>or choose a room</button>
      </div>
    </section>
  );
}
