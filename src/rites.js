// ---------------------------------------------------------------------------
// THE RITES OF PASSAGE
//
// A corridor whose every threshold gives way the same way has, in effect, one
// threshold. Only the vortex ever had a crossing of its own (the plunge); the
// other six were the same depth-ordered melt, seven seconds apart, so the walk
// read as one room being swapped for another six times over.
//
// Each crossing is now a RITE, taken from the two rooms it joins and from the
// line the arriving room is about to speak. A rite is a property of the
// THRESHOLD, not of the direction of travel: the plate that dissolves is always
// the shallower of the two, whichever way the reader is walking, so every rite
// plays forwards on the way down and backwards on the way back up — the water
// drains, the threads re-weave, the two paths converge again into one.
//
// NOTHING IS DRAWN ON THE PAINTING. That is the second pass at these, and the
// only rule that matters. The first gave each crossing a gesture on the picture
// plane — the room torn down the middle and drawn aside, mirrored under a
// rippling waterline, quantised into forty sliding threads, superimposed on
// scaled copies of itself, wiped by a rotating vane, and every one of them
// trailing a glowing accent-coloured edge. Each was carefully made and each
// read as APPLIED, because laid side by side the seven of them are the
// transition menu of a video editor, and because nothing else anywhere in this
// piece ever draws on the artwork. The corridor's language is light: lamps,
// fog, focus, and the dark between galleries.
//
// So a rite is an optical event in a lit room, and the seven differ only in
// which part of the picture goes first and how long its light outlives its
// stone. Same melt underneath, bent a different way; no figure, no pattern, no
// seam:
//
//   I → II    ECHO   the light does not go with the stone. The room's own lit
//                    parts swell as the front reaches them and then hang a beat
//                    in the air after the masonry carrying them has gone — the
//                    gallery saying itself again, in lamps. ("To speak is to
//                    fall into tautology.")
//   II → III  HUSH   the light goes out of the room before the room goes: the
//                    illumination collapses inward to the last lamp, the rim is
//                    refused, the dust stills, the air ducks. You arrive in the
//                    Silence in the dark, and its lamp kindles. (Unaltered by
//                    the second pass — it was already the model for it.)
//   III → IV  WIND   the floor is lost by the room losing its DEPTH: the far
//                    architecture sinks into the corridor's dark first, so the
//                    distance walks in toward you until nothing is left but a
//                    shallow face and its lamp, and the camera rolls a few
//                    degrees off level and rights itself on arrival.
//   IV → V    PLUNGE the vortex dive — camera work rather than a threshold, so
//                    the plate keeps the plain melt (which the ghost suppresses
//                    anyway). See the DIVE_* constants in DioramaScene.
//   V → VI    SPLIT  the room takes both paths as a change of WEATHER across
//                    it: the library's lamplight drains out of the side you
//                    came from while the moon the Fork opens onto arrives on
//                    the other, and that side gives way first.
//   VI → VII  FLOOD  the Pavilion stands over water, so you enter it by letting
//                    the room behind you go under — a level climbs the plate
//                    and what falls below it loses its focus and its light
//                    together. No surface is drawn: water without a drop of
//                    water in it.
//   VII → VIII WEAVE the dark of the room goes first and steadily, thinning the
//                    picture down to a lacework of its own lit edges before
//                    letting go of those too. The strands are the ones the
//                    painting already has. ("This web of time — the strands of
//                    which approach one another, bifurcate…")
//
// Every rite is fragment work on the ONE plate a crossing is dissolving (plus,
// for two of them, a camera roll and what the air does), so nothing new is
// drawn and no geometry moves: the cheapest place to put a transition in this
// scene is the shader every card already runs. The thresholds themselves live
// in paintingFrag; this file is only the table of who gets which.
// ---------------------------------------------------------------------------
export const RITE = {
  PLAIN: 0, ECHO: 1, HUSH: 2, WIND: 3, SPLIT: 4, FLOOD: 5, WEAVE: 6, PLUNGE: 7,
};

// Indexed by the chapter the crossing DEPARTS FROM, which is also the index of
// the plate that dissolves across it. Anything past the end (or an id the
// shader does not know) falls back to the plain melt, so a tour with a
// different number of chapters still walks.
export const RITES = [
  RITE.ECHO,   // I Vestibule  → II Echo
  RITE.HUSH,   // II Echo      → III Silence
  RITE.WIND,   // III Silence  → IV Vertigo
  RITE.PLUNGE, // IV Vertigo   → V Door      (the dive; no shader rite)
  RITE.SPLIT,  // V Door       → VI Fork
  RITE.FLOOD,  // VI Fork      → VII Pavilion
  RITE.WEAVE,  // VII Pavilion → VIII Web of Time
];

// What each crossing SOUNDS like — read by Tour, handed to AmbientSound.rite().
export const RITE_NAME = ['echo', 'hush', 'wind', 'plunge', 'split', 'flood', 'weave'];

// How strongly crossing `c` is underway at a given (continuous) descent: 0 at
// either rest point, 1 at its middle. The same shape the rites' own envelope
// has in the shader, so what the camera and the air do across a crossing stays
// in step with what the plate is doing.
export const crossingWeight = (descent, c) => {
  const f = descent - c;
  return f <= 0 || f >= 1 ? 0 : Math.sin(Math.PI * f);
};
