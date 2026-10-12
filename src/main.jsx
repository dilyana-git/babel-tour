import ReactDOM from 'react-dom/client';
import WorldTour from './WorldTour';
import './index.css';

// The piece is the world (WorldTour): one built place, opened on its map.
ReactDOM.createRoot(document.getElementById('root')).render(<WorldTour />);

// The faces nothing on the first frame is set in (the kickers' small capitals,
// the numerals' semibold): asked for now, so they are there by the time the
// map is, instead of being found — and swapped in — as it comes up.
for (const face of ['600 1em "Cormorant SC"', '600 1em "Cormorant Garamond"', 'italic 600 1em "Cormorant Garamond"']) {
  document.fonts?.load(face).catch(() => { /* the fallback stands */ });
}
