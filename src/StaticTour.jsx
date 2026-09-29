import { useRef, useState } from 'react';
import { NODES } from './catalogue';
import { STORY, VOICES } from './voices';
import './static-tour.css';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export default function StaticTour({ reason }) {
  const [index, setIndex] = useState(0);
  const heading = useRef(null);
  const node = NODES[index];
  const choose = (next) => {
    setIndex(next);
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <main className="static-tour">
      <div className="static-tour-art" aria-hidden="true" />
      <div className="static-tour-shell">
        <header className="static-tour-header">
          <p className="static-tour-eyebrow">J. L. Borges — 1941</p>
          <h1>La Biblioteca de Babel</h1>
          <p role="status">{reason}</p>
        </header>

        <nav className="static-tour-route" aria-label="Rooms along the walk">
          {NODES.map((room, i) => (
            <button key={room.slug} type="button" aria-current={i === index ? 'step' : undefined}
              onClick={() => choose(i)}>
              <span>{NUMERALS[i]}</span>{room.title}
            </button>
          ))}
        </nav>

        <article className="static-tour-room" aria-labelledby="static-room-title">
          <p className="static-tour-eyebrow">{index < 4 ? 'Gallery' : 'Path'} {NUMERALS[index]} · {index < 4 ? STORY.library : STORY.garden}</p>
          <h2 id="static-room-title" tabIndex="-1" ref={heading}>{node.title}</h2>
          <p className="static-tour-subtitle">{node.subtitle}</p>
          <p>{node.summary}</p>
          <div className="static-tour-voices">
            {(VOICES[node.slug] ?? []).map((line) => <p key={line}>{line}</p>)}
          </div>
          <div className="static-tour-actions">
            <button type="button" disabled={index === 0} onClick={() => choose(index - 1)}>Previous room</button>
            <button type="button" disabled={index === NODES.length - 1} onClick={() => choose(index + 1)}>Next room</button>
          </div>
        </article>
      </div>
    </main>
  );
}
