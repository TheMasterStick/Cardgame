export type DeckList = [defId: string, count: number][];

function expand(list: DeckList): string[] {
  return list.flatMap(([defId, count]) => Array(count).fill(defId) as string[]);
}

// Three 30-card starter decks, one per Hero class, per DESIGN.md §8/§9.
// No copy-count restrictions were specified, so counts are chosen freely.

const FIGHTER_DECK: DeckList = [
  ["militia-recruit", 1],
  ["footman", 2],
  ["shield-bearer", 2],
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
  ["recruitment-station", 1],
  ["call-to-arms", 1],
  ["bulletin-board", 1],
  ["gold-mine", 1],
  ["training-field", 2],
  ["exercise", 2],
  ["war-cry", 2],
  ["second-wind", 1],
  ["executioners-strike", 1],
  ["iron-sword", 1],
  ["battle-shield", 1],
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
  ["arcane-missiles", 2],
  ["renewal", 2],
  ["toxic-cloud", 2],
  ["focus", 1],
  ["iron-sword", 1],
];

const ROGUE_DECK: DeckList = [
  ["assassin", 2],
  ["berserker", 1],
  ["arrow-archer", 2],
  ["footman", 3],
  ["plague-rat", 3],
  ["apprentice-mage", 1],
  ["young-wolf", 2],
  ["gold-mine", 1],
  ["farm", 1],
  ["mana-pool", 1],
  ["exercise", 1],
  ["recruitment-station", 1],
  ["bulletin-board", 1],
  ["lightning-bolt", 3],
  ["arcane-missiles", 1],
  ["toxic-cloud", 1],
  ["war-cry", 1],
  ["focus", 1],
  ["executioners-strike", 1],
  ["cloak-of-shadows", 1],
  ["iron-sword", 1],
];

// Keyed by Hero card id (see data/cards.ts's `heroes` array). Quick Play
// only offers heroes that have an entry here — a Hero card without a
// starter deck is only playable via the Deck Builder.
export const STARTER_DECKS: Record<string, string[]> = {
  fighter: expand(FIGHTER_DECK),
  mage: expand(MAGE_DECK),
  rogue: expand(ROGUE_DECK),
};
