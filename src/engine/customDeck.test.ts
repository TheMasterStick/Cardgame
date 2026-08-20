import { describe, expect, it } from "vitest";
import { CARD_DEFINITIONS } from "../data/cards";
import { STARTER_DECKS } from "../data/decks";
import { deckAllegianceViolations, isCardAllowedForHero, type DeckDraft } from "./customDeck";
import type { CardDefinition, CreatureDefinition, HeroCardDefinition } from "./types";

function hero(overrides: Partial<HeroCardDefinition> = {}): HeroCardDefinition {
  return {
    id: "test-hero",
    name: "Test Hero",
    archetype: "hero",
    cost: 0,
    rarity: "common",
    hp: 10,
    attack: 0,
    ...overrides,
  };
}

function creature(overrides: Partial<CreatureDefinition> = {}): CreatureDefinition {
  return {
    id: "test-creature",
    name: "Test Creature",
    archetype: "creature",
    cost: 1,
    rarity: "common",
    attack: 1,
    hp: 1,
    keywords: [],
    triggers: [],
    ...overrides,
  };
}

describe("Allegiance (DESIGN.md §10)", () => {
  it("a Neutral card (no faction) is always allowed, regardless of Hero", () => {
    const h = hero({ faction: "roseguard-kingdom" });
    const card = creature();
    expect(isCardAllowedForHero(h, card)).toBe(true);
  });

  it("a Faction-less Hero has no restriction at all", () => {
    const h = hero(); // no faction
    const card = creature({ faction: "moonveil-coven" });
    expect(isCardAllowedForHero(h, card)).toBe(true);
  });

  it("a card matching the Hero's own Faction is allowed", () => {
    const h = hero({ faction: "wildheart-tribes" });
    const card = creature({ faction: "wildheart-tribes" });
    expect(isCardAllowedForHero(h, card)).toBe(true);
  });

  it("a card from a different Faction is disallowed by default", () => {
    const h = hero({ faction: "wildheart-tribes" });
    const card = creature({ faction: "necropolitan" });
    expect(isCardAllowedForHero(h, card)).toBe(false);
  });

  it("unrestricted allegiance lets in every Faction despite the Hero having one", () => {
    const h = hero({ faction: "wildheart-tribes", allegiance: { unrestricted: true } });
    const card = creature({ faction: "necropolitan" });
    expect(isCardAllowedForHero(h, card)).toBe(true);
  });

  it("extraFactions lets in specific additional Factions only", () => {
    const h = hero({ faction: "wildheart-tribes", allegiance: { extraFactions: ["necropolitan"] } });
    expect(isCardAllowedForHero(h, creature({ faction: "necropolitan" }))).toBe(true);
    expect(isCardAllowedForHero(h, creature({ faction: "moonveil-coven" }))).toBe(false);
  });

  it("neutralRaces lets in an off-Faction creature of a listed Race", () => {
    const h = hero({ faction: "wildheart-tribes", allegiance: { neutralRaces: ["beast"] } });
    expect(isCardAllowedForHero(h, creature({ faction: "necropolitan", race: "beast" }))).toBe(true);
    expect(isCardAllowedForHero(h, creature({ faction: "necropolitan", race: "undead" }))).toBe(false);
  });

  it("deckAllegianceViolations reports only the cards that break Allegiance", () => {
    // deckAllegianceViolations resolves defIds against the shared
    // CARD_DEFINITIONS registry, so fixtures are registered there directly
    // rather than passed in — matching how the real Deck Builder looks up
    // whatever the player has actually added.
    const allowed: CardDefinition = creature({ id: "test-allowed-card", faction: "wildheart-tribes" });
    const neutral: CardDefinition = creature({ id: "test-neutral-card" });
    const disallowed: CardDefinition = creature({ id: "test-disallowed-card", faction: "necropolitan" });
    CARD_DEFINITIONS[allowed.id] = allowed;
    CARD_DEFINITIONS[neutral.id] = neutral;
    CARD_DEFINITIONS[disallowed.id] = disallowed;

    const h = hero({ faction: "wildheart-tribes" });
    const violations = deckAllegianceViolations(
      { [allowed.id]: 2, [neutral.id]: 2, [disallowed.id]: 1 },
      h,
    );
    expect(violations.map((c) => c.id)).toEqual([disallowed.id]);

    delete CARD_DEFINITIONS[allowed.id];
    delete CARD_DEFINITIONS[neutral.id];
    delete CARD_DEFINITIONS[disallowed.id];
  });

  it("the shipped Archivist Hero (arcane-industries) is a real, live Allegiance restriction", () => {
    const archivistDef = CARD_DEFINITIONS["archivist"] as HeroCardDefinition;
    expect(archivistDef.faction).toBe("arcane-industries");

    const arcaneGolem = CARD_DEFINITIONS["arcane-golem"];
    expect(isCardAllowedForHero(archivistDef, arcaneGolem)).toBe(true);

    const footman = CARD_DEFINITIONS["footman"]; // Neutral — no faction, always allowed
    expect(isCardAllowedForHero(archivistDef, footman)).toBe(true);

    const offFaction: CardDefinition = { ...arcaneGolem, id: "test-off-faction", faction: "necropolitan" };
    expect(isCardAllowedForHero(archivistDef, offFaction)).toBe(false);
  });

  it("the Archivist starter deck is exactly 30 cards and entirely Allegiance-legal", () => {
    const archivistDef = CARD_DEFINITIONS["archivist"] as HeroCardDefinition;
    const deckIds = STARTER_DECKS["archivist"];
    expect(deckIds).toHaveLength(30);

    const draft: DeckDraft = {};
    for (const id of deckIds) draft[id] = (draft[id] ?? 0) + 1;
    expect(deckAllegianceViolations(draft, archivistDef)).toEqual([]);
  });
});
