// A skip is a request to finish the ending even when it arrives before the
// render loop creates its film, or during the walk back to the ending's gate.
export function pendingFinale(request, { place, target, last, up, moveKind }) {
  if ((request !== 'play' && request !== 'skip') || last === undefined || last === null
    || place !== last || target !== last || up || moveKind === 'finale') return null;
  if (request === 'skip') return 'skip';
  return moveKind ? null : 'play';
}
