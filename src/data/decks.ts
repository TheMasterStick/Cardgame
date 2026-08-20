export type DeckList = [defId: string, count: number][];

function expand(list: DeckList): string[] {
  return list.flatMap(([defId, count]) => Array(count).fill(defId) as string[]);
}

// Three 30-card starter decks, one per Hero class, per DESIGN.md §8/§9.
// No copy-count restrictions were specified, so counts are chosen freely.

const FIGHTER_DECK: DeckList = [
  ["militia-recruit", 1],
  ["footman", 1],
  ["shield-bearer", 1],
  ["royal-squire", 1],
  ["berserker", 1],
  ["young-wolf", 1],
  ["stone-golem", 1],
  ["assassin", 1],
  ["cleric", 1],
  ["flame-imp", 1],
  ["shield-sister", 1],
  ["flankguard-outrider", 1],
  ["shieldwall-veteran", 1],
  ["vanguard-scout", 1],
  ["shieldbreaker-brute", 1],
  ["hill-giant", 1],
  ["warhammer-brawler", 1],
  ["demon-gate", 1],
  ["recruitment-station", 1],
  ["call-to-arms", 1],
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

// Keyed by Hero card id (see data/cards.ts's `heroes` array). Quick Play
// only offers heroes that have an entry here — a Hero card without a
// starter deck is only playable via the Deck Builder.
export const STARTER_DECKS: Record<string, string[]> = {
  fighter: expand(FIGHTER_DECK),
  mage: expand(MAGE_DECK),
  rogue: expand(ROGUE_DECK),
};
