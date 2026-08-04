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
//   I → II    ECHO   the room says itself again, quieter, as it leaves: an
//                    afterimage a beat behind the melt, three ember waves
//                    instead of one, and the whole gallery superimposed on
//                    itself one size smaller. ("To speak is to fall into
//                    tautology.")
//   II → III  HUSH   the light goes out of the room before the room goes: the
//                    illumination collapses inward to the last lamp, the ember
//                    rim is refused, the dust stills, the air ducks. You arrive
//                    in the Silence in the dark, and its lamp kindles.
//   III → IV  WIND   the floor is lost: a whirling front spirals in toward the
//                    plate's own light, draining the room down its throat,
//                    and the camera rolls with it and rights itself on arrival.
//   IV → V    PLUNGE the vortex dive — camera work rather than a threshold, so
//                    the plate keeps the plain melt (which the ghost suppresses
//                    anyway). See the DIVE_* constants in DioramaScene.
//   V → VI    SPLIT  the room takes both paths: it parts into two copies that
//                    diverge, one keeping the library's lamplight and one
//                    cooled toward the moon, and late in the crossing one of
//                    them turns out to be the one you took.
//   VI → VII  FLOOD  black water rises up the plate; under the line the picture
//                    continues as its own rippling reflection and sinks. The
//                    Pavilion stands over water, so you enter it by drowning
//                    the path behind you.
//   VII → VIII WEAVE the picture comes apart into threads that slide out of
//                    true and let go one at a time. ("This web of time — the
//                    strands of which approach one another, bifurcate…")
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
