import { describe, expect, it } from "vitest";
import { CARD_DEFINITIONS } from "../data/cards";
import { STARTER_DECKS } from "../data/decks";
import { deckSize, deckToIds, type DeckDraft } from "./customDeck";

describe("deck draft helpers", () => {
  it("deckSize sums copy counts", () => {
    const draft: DeckDraft = { footman: 2, "arcane-golem": 1 };
    expect(deckSize(draft)).toBe(3);
  });

  it("deckToIds expands copy counts into a flat id list", () => {
    const draft: DeckDraft = { footman: 2, "arcane-golem": 1 };
    expect(deckToIds(draft).sort()).toEqual(["arcane-golem", "footman", "footman"].sort());
  });
});

describe("Starter decks (Phase O — Faction no longer restricts deckbuilding)", () => {
  // DESIGN.md §10 was rewritten in Phase O: Faction is a flavor/synergy tag
  // only, never a deckbuilding gate — any card is legal in any deck
  // regardless of the chosen Hero's Faction. What's still worth a
  // regression test is that every shipped starter deck stays a well-formed
  // 30-card list of real, resolvable card ids.
  it.each(Object.keys(STARTER_DECKS))("the %s starter deck is exactly 30 real card ids", (heroId) => {
    const deckIds = STARTER_DECKS[heroId];
    expect(deckIds).toHaveLength(30);
    for (const id of deckIds) {
      expect(CARD_DEFINITIONS[id], `missing card definition for "${id}"`).toBeDefined();
    }
  });
});
