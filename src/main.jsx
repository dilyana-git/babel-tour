import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import WorldTour from './WorldTour';
import './index.css';
import './tour.css';

// The piece is the world now (WorldTour). The Midjourney plate tour is kept,
// set aside, behind ?plates.
const Tour = lazy(() => import('./Tour'));
const plates = new URLSearchParams(window.location.search).has('plates');

ReactDOM.createRoot(document.getElementById('root')).render(
  plates ? <Suspense fallback={null}><Tour /></Suspense> : <WorldTour />,
);
