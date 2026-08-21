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
