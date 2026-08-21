export type DeckList = [defId: string, count: number][];

function expand(list: DeckList): string[] {
  return list.flatMap(([defId, count]) => Array(count).fill(defId) as string[]);
}

// Three 30-card starter decks, one per Hero class, per DESIGN.md §8/§9.
// No copy-count restrictions were specified, so counts are chosen freely.

const FIGHTER_DECK: DeckList = [
  ["militia-recruit", 1],
  ["footman", 2],
  ["shield-bearer", 1],
  ["royal-squire", 1],
  ["berserker", 1],
  ["stone-golem", 1],
  ["assassin", 1],
  ["cleric", 1],
  ["flame-imp", 1],
  ["shield-sister", 1],
  ["flankguard-outrider", 1],
  ["shieldwall-veteran", 1],
  ["shieldbreaker-brute", 1],
  ["hill-giant", 1],
  ["warhammer-brawler", 1],
  ["demon-gate", 1],
  ["recruitment-station", 1],
  ["warhorn-of-gestmane", 1],
  ["bulletin-board", 1],
  ["gold-mine", 1],
  ["training-field", 1],
  ["exercise", 1],
  ["war-cry", 1],
  ["second-wind", 1],
  ["executioners-strike", 1],
  ["iron-sword", 1],
  ["battle-shield", 1],
  ["steel-barding", 1],
  ["garrison-post", 1],
];

const MAGE_DECK: DeckList = [
  ["apprentice-mage", 2],
  ["arrow-archer", 2],
  ["longbow-sniper", 1],
  ["footman", 2],
  ["plague-rat", 2],
  ["shield-bearer", 1],
  ["gold-mine", 1],
  ["lumbermill", 1],
  ["arcane-sanctum", 2],
  ["mana-pool", 2],
  ["bulletin-board", 1],
  ["fireball", 2],
  ["lightning-bolt", 2],
  ["frost-nova", 1],
  ["arcane-missiles", 1],
  ["renewal", 1],
  ["toxic-cloud", 1],
  ["warded-acolyte", 1],
  ["spider-matriarch", 1],
  ["beast-den", 1],
  ["focus", 1],
  ["iron-sword", 1],
];

const ROGUE_DECK: DeckList = [
  ["assassin", 1],
  ["berserker", 1],
  ["arrow-archer", 1],
  ["footman", 2],
  ["plague-rat", 2],
  ["shadow-stalker", 1],
  ["blood-leech", 1],
  ["apprentice-mage", 1],
  ["young-wolf", 2],
  ["gold-mine", 1],
  ["farm", 1],
  ["mana-pool", 1],
  ["exercise", 1],
  ["recruitment-station", 1],
  ["bulletin-board", 1],
  ["lightning-bolt", 2],
  ["arcane-missiles", 1],
  ["toxic-cloud", 1],
  ["war-cry", 1],
  ["focus", 1],
  ["executioners-strike", 1],
  ["cloak-of-shadows", 1],
  ["iron-sword", 1],
  ["wolf-pack", 1],
  ["alphas-call", 1],
  ["blood-sacrifice", 1],
];

// Arcane Industries (DESIGN.md §10 Allegiance) — the Archivist is the
// first Hero to actually carry a Faction, so this is also the first deck
// where Allegiance is a real, live restriction rather than just built and
// tested: arcane-golem/arcane-sanctum/arcane-missiles/arcane-turret are
// all faction: "arcane-industries", everything else here is Neutral.
const ARCHIVIST_DECK: DeckList = [
  ["arcane-golem", 1],
  ["arcane-turret", 2],
  ["arcane-sanctum", 2],
  ["arcane-missiles", 2],
  ["apprentice-mage", 2],
  ["arrow-archer", 2],
  ["footman", 2],
  ["plague-rat", 2],
  ["shield-bearer", 1],
  ["gold-mine", 1],
  ["lumbermill", 1],
  ["mana-pool", 2],
  ["bulletin-board", 1],
  ["fireball", 1],
  ["lightning-bolt", 2],
  ["frost-nova", 1],
  ["renewal", 1],
  ["focus", 1],
  ["iron-sword", 1],
  ["toxic-cloud", 1],
  ["warded-acolyte", 1],
];

// Roseguard Kingdom (ROADMAP.md #10 / FACTIONS.md §1, converted in Phase N)
// — Queen Maerwyn is Fighter-classed, so the Neutral fill leans the same way
// FIGHTER_DECK does.
const QUEEN_MAERWYN_DECK: DeckList = [
  ["lioness-of-the-royal-guard", 2],
  ["court-enchantress", 2],
  ["sky-lion-archer", 2],
  ["gilded-knight-errant", 1],
  ["sky-lion-lancer", 1],
  ["raise-the-lion-banner", 2],
  ["reinforcements", 1],
  ["roseguard-barracks", 1],
  ["lionguard-cuirass", 1],
  ["militia-recruit", 1],
  ["footman", 2],
  ["shield-bearer", 1],
  ["cleric", 1],
  ["shield-sister", 1],
  ["hill-giant", 1],
  ["gold-mine", 1],
  ["bulletin-board", 1],
  ["training-field", 1],
  ["exercise", 1],
  ["war-cry", 1],
  ["iron-sword", 1],
  ["battle-shield", 1],
  ["garrison-post", 1],
  ["shieldwall-veteran", 1],
  ["steel-barding", 1],
];

// Wildheart Tribes (ROADMAP.md #10 / FACTIONS.md §7, converted in Phase N)
// — Matron Shara is Mage-classed, so the Neutral fill leans the same way
// MAGE_DECK does.
const MATRON_SHARA_DECK: DeckList = [
  ["totem-bound-spearwoman", 2],
  ["painted-spirit-mother", 2],
  ["barehide-beast-stalker", 2],
  ["war-painted-charger", 2],
  ["ancestor-bound-huntress", 1],
  ["totem-flesh-colossus", 1],
  ["blood-calls-to-blood", 2],
  ["grove-of-painted-bones", 1],
  ["spiritbone-spear", 1],
  ["apprentice-mage", 2],
  ["arrow-archer", 2],
  ["footman", 1],
  ["gold-mine", 1],
  ["lumbermill", 1],
  ["mana-pool", 1],
  ["bulletin-board", 1],
  ["fireball", 1],
  ["lightning-bolt", 2],
  ["frost-nova", 1],
  ["focus", 1],
  ["plague-rat", 1],
  ["renewal", 1],
];

// Keyed by Hero card id (see data/cards.ts's `heroes` array). Quick Play
// only offers heroes that have an entry here — a Hero card without a
// starter deck is only playable via the Deck Builder.
export const STARTER_DECKS: Record<string, string[]> = {
  fighter: expand(FIGHTER_DECK),
  mage: expand(MAGE_DECK),
  rogue: expand(ROGUE_DECK),
  archivist: expand(ARCHIVIST_DECK),
  "queen-maerwyn": expand(QUEEN_MAERWYN_DECK),
  "matron-shara-earthsong": expand(MATRON_SHARA_DECK),
};
