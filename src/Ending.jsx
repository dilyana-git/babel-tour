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
import { STORY } from './voices';

// The walk's last sentence: the Web of Time's first, and what is cut round
// the armillary's stand.
const LINE = 'Time forks perpetually toward innumerable futures.';
const WORDS = LINE.split(' ');

export default function Ending({ stage, againRef, onAgain, onMap }) {
  return (
    <section className={`map-ending is-stage-${stage}`} aria-label="The end of the walk">
      <blockquote className="map-ending-line">
        <p>
          {WORDS.map((word, w) => (
            <span key={w}>
              {w > 0 && ' '}
              <span className="map-ending-w" style={{ '--i': w }}>{word}</span>
            </span>
          ))}
        </p>
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
