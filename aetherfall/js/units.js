export const ELEMENTS = ["fire", "water", "wind", "earth", "light", "dark"];
export const ROLES = ["attacker", "tank", "healer", "support"];

export const ELEMENT_NAME = {
  fire: "Fire",
  water: "Water",
  wind: "Wind",
  earth: "Earth",
  light: "Light",
  dark: "Dark",
};

export const ROLE_NAME = {
  attacker: "Attacker",
  tank: "Tank",
  healer: "Healer",
  support: "Support",
};

function u(partial) {
  return partial;
}

export const UNITS = [
  u({
    id: "veyra",
    name: "Veyra Solenne",
    rarity: 5,
    element: "fire",
    role: "attacker",
    hp: 1020, atk: 228, def: 90, spd: 112, mag: 168,
    flavor: "She bowed to the wildfire, and it bowed back.",
    skills: [
      { kind: "Art", name: "Crownfall Cleave", text: "Twin sunblades cut a burning arc that grows hotter the longer the clash has lasted." },
      { kind: "Skill", name: "Ember Step", text: "Slips through her own smoke and leaves a scorching trail behind the step." },
    ],
  }),
  u({
    id: "calder",
    name: "Calder Brine",
    rarity: 5,
    element: "water",
    role: "tank",
    hp: 1540, atk: 118, def: 204, spd: 74, mag: 68,
    flavor: "The sea lent him its door, and he will not open it.",
    skills: [
      { kind: "Art", name: "Anchor of the Drowned Gate", text: "Plants an iron anchor that drags charging foes to a halt and braces the line." },
      { kind: "Skill", name: "Barnacle Wall", text: "The shield crusts over, soaking a heavy blow for the whole party." },
    ],
  }),
  u({
    id: "siff",
    name: "Siff Gale",
    rarity: 5,
    element: "wind",
    role: "support",
    hp: 1080, atk: 126, def: 92, spd: 128, mag: 188,
    flavor: "Her spear is hollow. The song is the blade.",
    skills: [
      { kind: "Art", name: "Four-Wind Measure", text: "A bright phrase that hastens allies and knocks enemy timing off the beat." },
      { kind: "Skill", name: "Ribbon Gale", text: "Streamers of wind lift the party’s next step and dull incoming arrows." },
    ],
  }),
  u({
    id: "thistle",
    name: "Thistle Bram",
    rarity: 5,
    element: "earth",
    role: "healer",
    hp: 1240, atk: 84, def: 118, spd: 90, mag: 214,
    flavor: "Where he kneels, the island remembers it is still alive.",
    skills: [
      { kind: "Art", name: "Rootwake Hymn", text: "Roots drink the hurt out of allies and stitch the worst wound shut." },
      { kind: "Skill", name: "Mossbind", text: "A green wrap that keeps regenerating whoever stands in the terrace soil." },
    ],
  }),
  u({
    id: "iri",
    name: "Halcyon Iri",
    rarity: 5,
    element: "light",
    role: "healer",
    hp: 1160, atk: 78, def: 108, spd: 102, mag: 226,
    flavor: "She writes the wounded back into the morning.",
    skills: [
      { kind: "Art", name: "Prism Mercy", text: "A page of light that mends the party and briefly blinds anything cruel." },
      { kind: "Skill", name: "Dawn Ledger", text: "Marks an ally; the next blow they would have suffered is written off." },
    ],
  }),
  u({
    id: "morr",
    name: "Morr Vesper",
    rarity: 5,
    element: "dark",
    role: "attacker",
    hp: 960, atk: 142, def: 86, spd: 118, mag: 232,
    flavor: "Night is not an enemy. It is the hour she keeps.",
    skills: [
      { kind: "Art", name: "Quiet Reaping", text: "The scythe takes a thin slice of spirit from every foe in reach." },
      { kind: "Skill", name: "Mothstep Veil", text: "She folds into dark cloth, and the next spell she casts lands unseen." },
    ],
  }),
  u({
    id: "joss",
    name: "Emberlin Joss",
    rarity: 4,
    element: "fire",
    role: "support",
    hp: 820, atk: 102, def: 80, spd: 116, mag: 148,
    flavor: "A fan, a grin, and a room full of polite embers.",
    skills: [
      { kind: "Art", name: "Cinder Fanfare", text: "Snaps a war fan that showers sparks and lifts ally attack for a short refrain." },
      { kind: "Skill", name: "Spark Conduct", text: "Points the heat of the battle at one ally’s weapon." },
    ],
  }),
  u({
    id: "pella",
    name: "Pella Moor",
    rarity: 4,
    element: "water",
    role: "healer",
    hp: 900, atk: 66, def: 88, spd: 94, mag: 164,
    flavor: "When the bell rings, the water decides to stay.",
    skills: [
      { kind: "Art", name: "Bell of Low Tide", text: "A low note that washes a heal across the party and slows the rush." },
      { kind: "Skill", name: "Brine Psalm", text: "Salt-light settles on the weakest ally and mends them twice." },
    ],
  }),
  u({
    id: "arun",
    name: "Arun Kite",
    rarity: 4,
    element: "wind",
    role: "attacker",
    hp: 740, atk: 176, def: 68, spd: 122, mag: 84,
    flavor: "He aims where the wind will be, not where it is.",
    skills: [
      { kind: "Art", name: "Kite-String Volley", text: "Three arrows ride the same gust and prefer whoever is already off balance." },
      { kind: "Skill", name: "Updraft", text: "A sudden lift that raises his speed and dodges the next grounded strike." },
    ],
  }),
  u({
    id: "osa",
    name: "Osa Gravel",
    rarity: 4,
    element: "earth",
    role: "tank",
    hp: 1180, atk: 108, def: 156, spd: 70, mag: 48,
    flavor: "The hammer falls once. The ground agrees.",
    skills: [
      { kind: "Art", name: "Gravel Verdict", text: "A single overhead blow that cracks armor and stuns if it lands clean." },
      { kind: "Skill", name: "Plateau", text: "Sets her stance. Damage taken drops until she moves." },
    ],
  }),
  u({
    id: "mae",
    name: "Lantern Mae",
    rarity: 4,
    element: "light",
    role: "support",
    hp: 840, atk: 88, def: 82, spd: 108, mag: 150,
    flavor: "She carries a light that refuses to gossip.",
    skills: [
      { kind: "Art", name: "Lantern Procession", text: "Walks a ring of lamplight that raises ally magic and shows hidden foes." },
      { kind: "Skill", name: "Kindled Path", text: "Leaves a bright step. Allies who cross it resist a dark hex." },
    ],
  }),
  u({
    id: "cole",
    name: "Umbryn Cole",
    rarity: 4,
    element: "dark",
    role: "tank",
    hp: 1120, atk: 92, def: 162, spd: 76, mag: 70,
    flavor: "His shield shows you the blow you meant to land.",
    skills: [
      { kind: "Art", name: "Mirror Guard", text: "The dark shield copies part of a hit back at the striker." },
      { kind: "Skill", name: "Umber Hold", text: "Pins one foe in place with a band of dusk." },
    ],
  }),
  u({
    id: "rin",
    name: "Rin Wisp",
    rarity: 4,
    element: "fire",
    role: "attacker",
    hp: 780, atk: 184, def: 64, spd: 124, mag: 96,
    flavor: "A laugh, a spark, and someone else’s plan in pieces.",
    skills: [
      { kind: "Art", name: "Wisp Rend", text: "Claws of cinder strike twice and leave a burn that ticks with her speed." },
      { kind: "Skill", name: "Cinder Pounce", text: "Leaps to the back line and rakes the softest target she can find." },
    ],
  }),
  u({
    id: "marin",
    name: "Marin Brook",
    rarity: 4,
    element: "water",
    role: "attacker",
    hp: 800, atk: 170, def: 78, spd: 100, mag: 110,
    flavor: "The harpoon is a promise the river keeps.",
    skills: [
      { kind: "Art", name: "Brookpiercer", text: "A trident thrust that hits harder against anyone already slowed." },
      { kind: "Skill", name: "Current Lock", text: "Hooks a foe and pulls them into the front of the fight." },
    ],
  }),
  u({
    id: "pip",
    name: "Ashen Pip",
    rarity: 3,
    element: "fire",
    role: "attacker",
    hp: 560, atk: 132, def: 54, spd: 104, mag: 60,
    flavor: "Small sword. Loud oath.",
    skills: [
      { kind: "Art", name: "First Spark", text: "A straightforward slash with a chance to kindle a small burn." },
      { kind: "Skill", name: "Scrappy Guard", text: "Raises his own attack after he weathers a hit." },
    ],
  }),
  u({
    id: "nia",
    name: "Nia Puddle",
    rarity: 3,
    element: "water",
    role: "support",
    hp: 620, atk: 70, def: 60, spd: 108, mag: 112,
    flavor: "She keeps a storm in a bucket and shares it kindly.",
    skills: [
      { kind: "Art", name: "Puddle Mirror", text: "Splashes a reflective pool that slightly raises ally magic." },
      { kind: "Skill", name: "Splash Hex", text: "A comic drench that lowers a foe’s accuracy for a moment." },
    ],
  }),
  u({
    id: "tam",
    name: "Tam Breeze",
    rarity: 3,
    element: "wind",
    role: "healer",
    hp: 640, atk: 52, def: 66, spd: 100, mag: 124,
    flavor: "The fan smells like rain on warm stone.",
    skills: [
      { kind: "Art", name: "Breeze Mend", text: "A cool sweep that heals the most hurt ally a modest amount." },
      { kind: "Skill", name: "Leaf Turn", text: "Flicks a leaf that cleans one poison or burn." },
    ],
  }),
  u({
    id: "puck",
    name: "Puck Clay",
    rarity: 3,
    element: "earth",
    role: "tank",
    hp: 860, atk: 64, def: 118, spd: 62, mag: 36,
    flavor: "Rolled up from the terrace and decided to stay.",
    skills: [
      { kind: "Art", name: "Clay Bulwark", text: "Puffs into a round shield-wall and soaks the next blow aimed at an ally." },
      { kind: "Skill", name: "Pebble Knock", text: "A stubby bash that taunts the target." },
    ],
  }),
  u({
    id: "tess",
    name: "Tess Glow",
    rarity: 3,
    element: "light",
    role: "support",
    hp: 580, atk: 58, def: 54, spd: 110, mag: 116,
    flavor: "Do not open the jar unless you mean to be brave.",
    skills: [
      { kind: "Art", name: "Jar of Dawn", text: "Cracks the lid. Allies gain a little magic and a little courage." },
      { kind: "Skill", name: "Glow Mote", text: "A drifting spark that reveals the foe with the lowest guard." },
    ],
  }),
  u({
    id: "rathe",
    name: "Rathe Dusk",
    rarity: 3,
    element: "dark",
    role: "attacker",
    hp: 540, atk: 138, def: 48, spd: 116, mag: 72,
    flavor: "Two knives, no speeches, gone before the echo.",
    skills: [
      { kind: "Art", name: "Dusk Nick", text: "A paired cut that prefers foes who have not acted yet." },
      { kind: "Skill", name: "Alley Fade", text: "Steps into a shadow and raises his own speed." },
    ],
  }),
  u({
    id: "hobb",
    name: "Hobb Flint",
    rarity: 3,
    element: "fire",
    role: "tank",
    hp: 800, atk: 86, def: 112, spd: 66, mag: 40,
    flavor: "The helm whistles when the soup of battle boils.",
    skills: [
      { kind: "Art", name: "Kettle Charge", text: "Lowers the helm and slams the front line, guarding allies behind him." },
      { kind: "Skill", name: "Flint Hide", text: "Sparks off his armor, slightly raising defense." },
    ],
  }),
  u({
    id: "sallow",
    name: "Sallow Reed",
    rarity: 3,
    element: "wind",
    role: "attacker",
    hp: 590, atk: 128, def: 58, spd: 112, mag: 64,
    flavor: "Tall as the marsh grass and twice as stubborn.",
    skills: [
      { kind: "Art", name: "Reed Thrust", text: "A long spear reach that hits the back as easily as the front." },
      { kind: "Skill", name: "Bank to Bank", text: "Shifts with the wind and gains a little speed." },
    ],
  }),
  u({
    id: "quinn",
    name: "Quinn Pebble",
    rarity: 3,
    element: "earth",
    role: "healer",
    hp: 680, atk: 50, def: 78, spd: 84, mag: 118,
    flavor: "Each stone is a name the earth agreed to keep.",
    skills: [
      { kind: "Art", name: "Pebble Rosary", text: "Counts the stones and mends the party a little with each bead." },
      { kind: "Skill", name: "Steady Hand", text: "Calms one ally, cleansing a slow and adding a small shield." },
    ],
  }),
  u({
    id: "lir",
    name: "Lir Shade",
    rarity: 3,
    element: "dark",
    role: "support",
    hp: 600, atk: 74, def: 62, spd: 102, mag: 120,
    flavor: "Wings like old velvet. Light like a secret.",
    skills: [
      { kind: "Art", name: "Shade Lamp", text: "A dim lantern that raises ally magic and softens dark damage." },
      { kind: "Skill", name: "Moth Dust", text: "Dust on the enemy line that lowers their magic for a short while." },
    ],
  }),
];

export const BANNERS = [
  {
    id: "wanderer",
    name: "Wanderer's Gate",
    blurb: "A quiet arch on the terrace. Anyone the Vein remembers may answer.",
    art: "wanderer",
    featured: null,
    rateUp: 0,
  },
  {
    id: "cinders",
    name: "Crown of Cinders",
    blurb: "Veyra Solenne burns closer to the gate. Rin Wisp follows the heat.",
    art: "cinders",
    featured: { 5: "veyra", 4: "rin" },
    rateUp: 0.5,
  },
];

export const STARTER_IDS = ["pip", "nia", "tam", "puck"];

const BY_ID = new Map(UNITS.map((unit) => [unit.id, unit]));

export function unitById(id) {
  return BY_ID.get(id) || null;
}
