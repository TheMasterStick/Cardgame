import { CARD_DEFINITIONS } from "../data/cards";
import type { CardDefinition, HeroCardDefinition } from "./types";

const STORAGE_KEY = "cardgame:customDeck:v1";

/** defId -> number of copies included in the deck being built. */
export type DeckDraft = Record<string, number>;

export function loadCustomDeck(): DeckDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || !parsed) return {};
    return parsed as DeckDraft;
  } catch {
    return {};
  }
}

export function saveCustomDeck(deck: DeckDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
  } catch {
    // localStorage unavailable — the draft just won't persist across reloads.
  }
}

export function deckSize(deck: DeckDraft): number {
  return Object.values(deck).reduce((a, b) => a + b, 0);
}

export function deckToIds(deck: DeckDraft): string[] {
  return Object.entries(deck).flatMap(([defId, count]) => Array<string>(count).fill(defId));
}

/**
 * Whether `card` is legal in a deck led by `heroDef`, per DESIGN.md §10
 * Allegiance: Neutral cards (no faction) and a Faction-less Hero are both
 * unrestricted; otherwise the card's Faction must match the Hero's, or be
 * let in by one of the Hero's optional `allegiance` grants.
 */
export function isCardAllowedForHero(heroDef: HeroCardDefinition, card: CardDefinition): boolean {
  if (!card.faction) return true;
  if (!heroDef.faction) return true;
  if (heroDef.allegiance?.unrestricted) return true;
  if (card.faction === heroDef.faction) return true;
  if (heroDef.allegiance?.extraFactions?.includes(card.faction)) return true;
  if (card.race && heroDef.allegiance?.neutralRaces?.includes(card.race)) return true;
  return false;
}

/** Every card in `deck` that would violate `heroDef`'s Allegiance — empty if the deck is legal. */
export function deckAllegianceViolations(deck: DeckDraft, heroDef: HeroCardDefinition): CardDefinition[] {
  const violations: CardDefinition[] = [];
  for (const defId of Object.keys(deck)) {
    const card = CARD_DEFINITIONS[defId];
    if (card && !isCardAllowedForHero(heroDef, card)) violations.push(card);
  }
  return violations;
}
