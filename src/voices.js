// ── The voices ───────────────────────────────────────────────────────────────
// What the room's caption says once the reader has read the room's own line
// (RoomVoice, in the corner of every room of the world tour): the two stories
// the walk is made of, a sentence at a time. Each room speaks from the story it
// belongs to — the galleries from "The Library of Babel", the paths from "The
// Garden of Forking Paths" — and each line was picked for what that room is
// about: the Echo gets the mirror and the Order, the Silence the lamps and the
// old librarian's solitude, the Vertigo the sphere and the circular book.
//
// Quoted from the Labyrinths translations (James E. Irby for the Library,
// Donald A. Yates for the garden), the same ones the folio lines in
// catalogue.js come from. Written down from memory: proof them against the
// book before anyone else reads them. A leading or trailing ellipsis marks a
// sentence entered or left partway.
//
// Keep a line under about 170 characters. The caption stacks every line a
// room can say so that it is as tall as its longest one from the moment the
// reader arrives (and the room's name never jumps as a quotation comes in), so
// one long line raises that room's whole caption into the painting.

export const STORY = {
  library: 'The Library of Babel',
  garden: 'The Garden of Forking Paths',
};

// Standing in a room, after its summary, in this order — a reader who comes
// back to a room picks up where they left off (RoomVoice).
export const VOICES = {
  vestibule: [
    'The universe (which others call the Library) is composed of an indefinite and perhaps infinite number of hexagonal galleries…',
    'When it was proclaimed that the Library contained all books, the first impression was one of extravagant happiness.',
    '…each shelf contains thirty-five books of uniform format; each book is of four hundred and ten pages; each page, of forty lines…',
    'You who read me, are You sure of understanding my language?',
  ],
  echo: [
    'In the hallway there is a mirror which faithfully duplicates all appearances. … I prefer to dream that its polished surfaces represent and promise the infinite.',
    'The Library is unlimited and cyclical. … the same volumes were repeated in the same disorder (which, thus repeated, would be an order: the Order).',
    'To speak is to fall into tautology.',
    'In the vast Library there are no two identical books.',
  ],
  silence: [
    'Light is provided by some spherical fruit which bear the name of lamps. … The light they emit is insufficient, incessant.',
    '…the Library will endure: illuminated, solitary, infinite, perfectly motionless, equipped with precious volumes, useless, incorruptible, secret.',
    '…now that my eyes can hardly decipher what I write, I am preparing to die just a few leagues from the hexagon in which I was born.',
    'My solitude is gladdened by this elegant hope.',
  ],
  vertigo: [
    'From any of the hexagons one can see, interminably, the upper and lower floors.',
    'The mystics claim that their ecstasy reveals to them a circular chamber containing a great circular book, whose spine is continuous…',
    'The Library is a sphere whose exact center is any one of its hexagons and whose circumference is inaccessible.',
    'The certitude that everything has been written negates us or turns us into phantoms.',
  ],
  door: [
    'Between the iron bars I made out a poplar grove and a pavilion.',
    'Every one imagined two works; to no one did it occur that the book and the maze were one and the same thing.',
    'I thought of a labyrinth of labyrinths, of one sinuous spreading labyrinth that would encompass the past and the future and in some way involve the stars.',
    'I leave to the various futures (not to all) my garden of forking paths.',
  ],
  fork: [
    '…each time a man is confronted with several alternatives, he chooses one and eliminates the others; in the fiction of Ts’ui Pên, he chooses — simultaneously — all of them.',
    'He creates, in this way, diverse futures, diverse times which themselves also proliferate and fork.',
    'The garden of forking paths was the chaotic novel; the phrase ‘the various futures (not to all)’ suggested to me the forking in time, not in space.',
    '…to construct a labyrinth in which all men would become lost.',
  ],
  pavilion: [
    'A high-pitched, almost syllabic music approached and receded in the shifting of the wind, dimmed by leaves and distance.',
    'The afternoon was intimate, infinite.',
    'Under English trees I meditated on that lost maze: … I imagined it erased by rice fields or beneath the water…',
    'The Garden of Forking Paths is an enormous riddle, or parable, whose theme is time; this recondite cause prohibits its mention.',
  ],
  web: [
    'Time forks perpetually toward innumerable futures. In one of them I am your enemy.',
    'He believed in an infinite series of times, in a growing, dizzying net of divergent, convergent and parallel times.',
    'We do not exist in the majority of these times; in some you exist, and not I; in others I, and not you; in others, both of us.',
    'It seemed to me that the humid garden that surrounded the house was infinitely saturated with invisible persons.',
  ],
};

// On the way between two rooms, after the plain "Walking on to …": a line for
// the road, taken in turn so two walks running do not say the same thing. The
// fall into the garden and the climb back out of it are one crossing each, and
// say one thing each — both in the Library's words, since it is the Library's
// shaft the reader goes down.
export const PASSAGES = {
  library: [
    'Like all men of the Library, I have traveled in my youth; I have wandered in search of a book, perhaps the catalogue of catalogues…',
    'One of the free sides leads to a narrow hallway which opens onto another gallery, identical to the first and to all the rest.',
    'Thousands of the greedy abandoned their sweet native hexagons and rushed up the stairways, urged on by the vain intention of finding their Vindication.',
  ],
  garden: [
    '…you won’t get lost if you take this road to the left and at every crossroads turn again to your left.',
    'I felt myself to be, for an unknown period of time, an abstract perceiver of the world.',
    'Absorbed in these illusory images, I forgot my destiny of one pursued.',
  ],
  fall: [
    '…my grave will be the fathomless air; my body will sink endlessly and decay and dissolve in the wind generated by the fall, which is infinite.',
  ],
  climb: [
    '…a spiral stairway, which sinks abysmally and soars upwards to remote distances.',
  ],
};
