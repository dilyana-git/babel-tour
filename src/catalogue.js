// ── The catalogue ────────────────────────────────────────────────────────────
// The eight rooms of the walk, in the order they are walked: the Library's four
// galleries, then the garden's four paths beyond the Door. What each is called
// and the one line the map and the room's caption say of it. (The catalogue of
// Midjourney plates this file used to hold — every variant of every gallery,
// and the rules for drawing one — went with the plate tour.)
export const LIBRARY_NODES = [
  {
    slug: 'vestibule',
    title: 'The Vestibule',
    subtitle: 'Threshold of the archive',
    summary: 'A bridge of stone carries a file of readers across the dark on its own arch, and two lamps keep the gap they cross.',
  },
  {
    slug: 'echo',
    title: 'The Echo',
    subtitle: 'A corridor of repeated forms',
    summary: 'Stairs cross stairs and arcades answer arcades — every passage insists it has been walked before.',
  },
  {
    slug: 'silence',
    title: 'The Silence',
    subtitle: 'Where the lamps grow faint',
    summary: 'Where the stairways stop crossing, a single lamp keeps the dark honest.',
  },
  {
    slug: 'vertigo',
    title: 'The Vertigo',
    subtitle: 'The stairwell that has no floor',
    summary: 'The galleries curl into a spiral pit that winds down toward a single warm light, and the count of the books refuses to close.',
  },
];

// The garden — Borges' other 1941 labyrinth, "The Garden of Forking Paths".
const GARDEN_NODES = [
  {
    slug: 'door',
    title: 'The Door',
    subtitle: 'One volume was a gate',
    summary: 'Between two shelves the stone gives way; beyond the jamb, wisteria and a lantern in the dark.',
  },
  {
    slug: 'fork',
    title: 'The Fork',
    subtitle: 'Every path taken at once',
    summary: 'The pale gravel divides and divides again, and each branch insists it is the one you chose.',
  },
  {
    slug: 'pavilion',
    title: 'The Pavilion',
    subtitle: 'Where the lamp keeps every future',
    summary: 'Over black water a single pavilion burns warm, and on its table a qin waits for whichever of your lives sits down to play.',
  },
  {
    slug: 'web',
    title: 'The Web of Time',
    subtitle: 'Strands that bifurcate and ignore each other',
    summary: 'The paths stop pretending to be paths: in every direction you are already walking, choosing otherwise.',
  },
];

export const NODES = [...LIBRARY_NODES, ...GARDEN_NODES];
