/**
 * Unlockables: color themes and word packs, earned through achievements.
 * Classic is always available. Everything else unlocks once and stays unlocked.
 */
import { ACHIEVEMENT_BY_ID, type Unlocked } from "./achievements";
import { MAX_WORD_LENGTH } from "./config";
import { courtPalette, getLook, royalPalette, type Palette } from "./theme";

/** What it takes to unlock something: a number of achievements, or one specific achievement. */
export type Requirement = { free: true } | { count: number } | { achievement: string };

export function meetsRequirement(req: Requirement, unlocked: Unlocked): boolean {
  if ("free" in req) return true;
  if ("count" in req) return Object.keys(unlocked).length >= req.count;
  return !!unlocked[req.achievement];
}

export function requirementText(req: Requirement): string {
  if ("free" in req) return "Always available";
  if ("count" in req) return `Unlock ${req.count} achievements`;
  const a = ACHIEVEMENT_BY_ID[req.achievement];
  return a ? `Get “${a.name}”: ${a.desc.replace(/\.$/, "")}` : "Locked";
}

/* ---------- color themes ---------- */

export type ThemeId = "classic" | "paper" | "terminal" | "ocean" | "sakura" | "sunset" | "neon" | "royal";

export type Theme = {
  id: ThemeId;
  name: string;
  requires: Requirement;
  /** null = Classic, which follows the phone's light or dark mode. */
  palette: Palette | null;
  dark: boolean; // for the status bar
};

export const THEMES: Theme[] = [
  { id: "classic", name: "Classic", requires: { free: true }, palette: null, dark: false },
  {
    id: "paper",
    name: "Paper",
    requires: { count: 6 },
    dark: false,
    palette: {
      bg: "#F4EDE1",
      surface: "#FFFBF3",
      ink: "#2B2118",
      muted: "#75644F",
      ghost: "#BFAF97",
      line: "#E3D6C2",
      accent: "#B4532A",
      accentSoft: "rgba(180, 83, 42, 0.1)",
      onAccent: "#FFFBF3",
      good: "#3E7D3A",
      miss: "#D0142F",
      missSoft: "rgba(208, 20, 47, 0.14)",
      scrim: "rgba(244, 237, 225, 0.92)",
      gold: "#A36A00",
      ice: "#2F7F9A",
      violet: "#7B4BB0",
    },
  },
  {
    id: "terminal",
    name: "Terminal",
    requires: { count: 14 },
    dark: true,
    palette: {
      bg: "#050A06",
      surface: "#0B140D",
      ink: "#B8FFC8",
      muted: "#5FA571",
      ghost: "#2A4A32",
      line: "#16301D",
      accent: "#39FF7A",
      accentSoft: "rgba(57, 255, 122, 0.1)",
      onAccent: "#050A06",
      good: "#39FF7A",
      miss: "#FF4D4D",
      missSoft: "rgba(255, 77, 77, 0.18)",
      scrim: "rgba(5, 10, 6, 0.92)",
      gold: "#E8D44D",
      ice: "#4DD8FF",
      violet: "#B48CFF",
    },
  },
  {
    id: "ocean",
    name: "Deep Ocean",
    requires: { achievement: "boss_20" },
    dark: true,
    palette: {
      bg: "#04161F",
      surface: "#0A2230",
      ink: "#E3F6FA",
      muted: "#7FA9B7",
      ghost: "#2D5363",
      line: "#143545",
      accent: "#2FD3C6",
      accentSoft: "rgba(47, 211, 198, 0.12)",
      onAccent: "#04161F",
      good: "#6BE39A",
      miss: "#FF5C6C",
      missSoft: "rgba(255, 92, 108, 0.18)",
      scrim: "rgba(4, 22, 31, 0.92)",
      gold: "#F5C55B",
      ice: "#7FD8FF",
      violet: "#A99BFF",
    },
  },
  {
    id: "sakura",
    name: "Sakura",
    requires: { achievement: "daily_30" },
    dark: false,
    palette: {
      bg: "#FBEFF2",
      surface: "#FFFFFF",
      ink: "#3A1F2B",
      muted: "#8A6373",
      ghost: "#D3B3C0",
      line: "#F0D6DF",
      accent: "#B03E78",
      accentSoft: "rgba(176, 62, 120, 0.1)",
      onAccent: "#FFFFFF",
      good: "#2F8F6A",
      miss: "#E03A1E",
      missSoft: "rgba(224, 58, 30, 0.14)",
      scrim: "rgba(251, 239, 242, 0.92)",
      gold: "#A8730C",
      ice: "#2B88B0",
      violet: "#8A4FD6",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    requires: { count: 24 },
    dark: true,
    palette: {
      bg: "#1A0F24",
      surface: "#26162F",
      ink: "#FCEBF2",
      muted: "#B193A8",
      ghost: "#57405F",
      line: "#3A2545",
      accent: "#FF8A4C",
      accentSoft: "rgba(255, 138, 76, 0.13)",
      onAccent: "#1A0F24",
      good: "#7EE0A1",
      miss: "#FF4F7B",
      missSoft: "rgba(255, 79, 123, 0.2)",
      scrim: "rgba(26, 15, 36, 0.92)",
      gold: "#FFC94D",
      ice: "#6FD0F5",
      violet: "#C49BFF",
    },
  },
  {
    id: "neon",
    name: "Neon",
    requires: { achievement: "combo_50" },
    dark: true,
    palette: {
      bg: "#07050F",
      surface: "#120D20",
      ink: "#F4F1FF",
      muted: "#9A90BF",
      ghost: "#3D3560",
      line: "#231B3D",
      accent: "#22E6FF",
      accentSoft: "rgba(34, 230, 255, 0.12)",
      onAccent: "#07050F",
      good: "#5CFF9D",
      miss: "#FF2E88",
      missSoft: "rgba(255, 46, 136, 0.2)",
      scrim: "rgba(7, 5, 15, 0.92)",
      gold: "#FFE14D",
      ice: "#22E6FF",
      violet: "#C77DFF",
    },
  },
  {
    id: "royal",
    name: "Royal Gold",
    requires: { count: 38 },
    dark: true,
    palette: {
      bg: "#0D0B07",
      surface: "#19150D",
      ink: "#FFF6DF",
      muted: "#B3A27A",
      ghost: "#4F4430",
      line: "#2E2717",
      accent: "#F2C14E",
      accentSoft: "rgba(242, 193, 78, 0.13)",
      onAccent: "#0D0B07",
      good: "#8FD694",
      miss: "#FF5A4F",
      missSoft: "rgba(255, 90, 79, 0.2)",
      scrim: "rgba(13, 11, 7, 0.92)",
      gold: "#FFD86B",
      ice: "#7FD1E6",
      violet: "#C9A8FF",
    },
  },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map(t => [t.id, t])) as Record<ThemeId, Theme>;

/**
 * The colors to draw with. In the Royal Court look the default ("classic") theme uses the Sunset
 * colors, and the Sunset slot holds the original gold-and-stone Court colors (they swapped places).
 * In the Modern look, Classic follows the phone's light or dark mode.
 */
export function themePalette(id: ThemeId, systemDark: boolean): { c: Palette; dark: boolean } {
  const t = THEME_BY_ID[id] ?? THEME_BY_ID.classic;
  const court = getLook() === "court";
  if (court && t.id === "classic") return { c: THEME_BY_ID.sunset.palette!, dark: true };
  if (court && t.id === "sunset") return { c: courtPalette, dark: true };
  if (!t.palette) return { c: royalPalette, dark: true }; // Modern look's default: Royal Throne plum
  void systemDark; // both looks are dark by design now
  return { c: t.palette, dark: t.dark };
}

/**
 * The Retro look (the original Royal Court, NES-style design) is an unlockable in Customize.
 * It's free (no Pro needed) once you've earned a few achievements.
 */
export const RETRO_LOOK = { name: "Retro Court", requires: { count: 5 } as Requirement };

/** A theme's name as shown (Classic and Sunset swap names along with their colors in the Royal Court look). */
export function themeName(t: Theme): string {
  if (getLook() === "court" && t.id === "classic") return "Sunset";
  if (getLook() === "court" && t.id === "sunset") return "Royal Classic";
  return t.name;
}

/* ---------- word packs ---------- */

export type PackId = "classic" | "animals" | "food" | "nature" | "space" | "fantasy";

export type WordPack = {
  id: PackId;
  name: string;
  desc: string;
  requires: Requirement;
  /** null = the standard word list. */
  words: string[] | null;
};

/** Keeps only plain words the game can use (3 to MAX_WORD_LENGTH letters), without repeats. */
const pack = (raw: string) =>
  Array.from(new Set(raw.split(/\s+/).filter(w => /^[a-z]+$/.test(w) && w.length >= 3 && w.length <= MAX_WORD_LENGTH)));

export const WORD_PACKS: WordPack[] = [
  { id: "classic", name: "Classic", desc: "A bit of everything.", requires: { free: true }, words: null },
  {
    id: "animals",
    name: "Animals",
    desc: "From ant to warthog.",
    requires: { achievement: "round_10" },
    words: pack(`
      ant ape bat bee cat cow cub doe dog eel elk emu ewe fox gnu hen hog jay owl pig pup ram rat yak
      bear bird boar buck bull calf clam colt crab crow deer dove duck fawn frog gnat goat gull hare hawk ibex kiwi lamb lark lion lynx mink mole moth mule newt orca puma seal slug swan toad tuna wasp wolf worm wren
      bison camel cobra crane eagle egret finch gecko goose heron horse hyena koala lemur llama moose mouse otter panda quail raven rhino robin shark sheep skunk sloth snail snake squid stork tiger trout viper whale zebra
      alpaca baboon badger beaver bobcat condor cougar coyote donkey falcon ferret gerbil gibbon iguana impala jackal jaguar lizard magpie marmot monkey ocelot oriole osprey parrot pigeon possum puffin python rabbit salmon spider toucan turkey turtle walrus weasel wombat
      buffalo catfish cheetah chicken dolphin gazelle giraffe gorilla hamster lobster leopard mallard meerkat panther peacock pelican penguin piranha raccoon sparrow tadpole vulture warthog wildcat
    `),
  },
  {
    id: "food",
    name: "Snack Time",
    desc: "Typing on an empty stomach.",
    requires: { achievement: "score_30k" },
    words: pack(`
      bun egg fig jam nut oat pea pie rye yam tea ham
      bean beef cake chip corn curd dill feta kale leek lime meat milk mint naan okra pear plum pork rice sage salt soup taco tofu wrap bran
      apple bacon bagel basil bread candy chili cocoa cream crepe curry fudge grape gravy guava honey jelly lemon mango maple melon mocha olive onion pasta peach pecan pizza prune salad salsa scone steak sushi syrup thyme toast wafer
      almond banana barley brunch butter carrot cashew cereal cheese cherry cookie fennel garlic ginger muffin noodle nougat omelet orange papaya pepper pickle potato quiche radish raisin waffle walnut yogurt tomato turnip sorbet sesame gelato
      avocado biscuit brisket brownie cabbage caramel cupcake custard granola lasagna lettuce mustard oatmeal pancake paprika parsley peanuts pretzel pudding risotto sausage spinach truffle burrito noodles
    `),
  },
  {
    id: "nature",
    name: "Great Outdoors",
    desc: "Forests, rivers and storms.",
    requires: { achievement: "daily_7" },
    words: pack(`
      bay bog dew elm fir fog ice ivy oak sap sky sun mud
      bark bush cave clay cove dune fern glen hill lake leaf lily moss peak pine pond rain reef rock root sand seed snow soil star stem tide tree vale vine wave wind wood
      acorn birch bloom brook cliff cloud coast creek daisy delta field flora frost grass grove lotus maple marsh ocean petal plain river ridge shore slope stone storm swamp thorn trail tulip vapor woods
      autumn breeze canopy canyon cedars clover desert forest geyser harbor island jungle lagoon meadow nectar orchid pebble rapids spring spruce stream summit sunset thorns tundra valley willow winter
      blossom cascade cypress drizzle glacier harvest horizon meadows monsoon orchard prairie rainbow redwood sapling seaside sunbeam thicket thunder tornado volcano wetland
    `),
  },
  {
    id: "space",
    name: "Deep Space",
    desc: "Planets, probes and pulsars.",
    requires: { count: 18 },
    words: pack(`
      sun orb ion ray gas sky
      atom dust halo mars moon nova star void beam core dark disk flux glow mass node ring tail
      alien comet earth orbit pluto radar solar space venus laser lunar quark probe rover titan light stars flare crust dwarf giant helix
      aurora cosmos galaxy meteor nebula photon planet pulsar quasar rocket saturn sensor signal launch uranus vacuum zenith module beacon cosmic comets
      antenna capsule eclipse gravity jupiter mercury neptune orbiter outpost payload shuttle sputnik stellar sunspot voyager airlock booster horizon
    `),
  },
  {
    id: "fantasy",
    name: "Fantasy Realm",
    desc: "Dragons, wizards and old magic.",
    requires: { achievement: "hard_boss_5" },
    words: pack(`
      elf orc imp hex orb
      bard gold helm keep lord mage myth oath ogre rune sage seer tome wand ward wyrm
      armor charm crown dwarf elven fairy ghost giant golem lance magic manor nymph quest relic scale spell staff sword troll witch realm siege
      amulet castle dragon goblin knight legend oracle potion quiver scroll shield sprite throne wizard cavern elixir mystic portal tavern
      banshee chimera crystal dungeon enchant griffin kingdom phoenix pegasus sorcery unicorn warlock vampire mermaid lantern scepter goblins paladin centaur cyclops
    `),
  },
];

export const PACK_BY_ID = Object.fromEntries(WORD_PACKS.map(p => [p.id, p])) as Record<PackId, WordPack>;

/** Unlockables that `unlocked` reaches but `before` didn't. */
export function newUnlockables(before: Unlocked, after: Unlocked): { kind: "theme" | "pack" | "style"; name: string }[] {
  const fresh: { kind: "theme" | "pack" | "style"; name: string }[] = [];
  if (meetsRequirement(RETRO_LOOK.requires, after) && !meetsRequirement(RETRO_LOOK.requires, before))
    fresh.push({ kind: "style", name: RETRO_LOOK.name });
  for (const t of THEMES)
    if (meetsRequirement(t.requires, after) && !meetsRequirement(t.requires, before)) fresh.push({ kind: "theme", name: themeName(t) });
  for (const p of WORD_PACKS)
    if (meetsRequirement(p.requires, after) && !meetsRequirement(p.requires, before)) fresh.push({ kind: "pack", name: p.name });
  return fresh;
}
