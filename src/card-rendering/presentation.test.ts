import { describe, expect, it } from "vitest";
import { CARD_DEFINITIONS } from "../data/cards";
import {
  MAX_PRINTED_CATEGORIES,
  PROJECT_DEFAULT_LAYOUT,
  PROJECT_DEFAULT_TYPOGRAPHY,
  createDefaultCardPresentation,
  defaultBaseForArchetype,
  defaultPrintedCategories,
  defaultResourceKindForArchetype,
  getRuntimeCardPresentation,
  hydrateCardPresentation,
} from "./presentation";

describe("card presentation defaults", () => {
  it("keeps the approved centered project layout and typography in one shared source", () => {
    const presentation = createDefaultCardPresentation("creature", ["Common", "Neutral", "Fighter"]);

    expect(presentation.layout).toEqual(PROJECT_DEFAULT_LAYOUT);
    expect(presentation.titleFont).toBe(PROJECT_DEFAULT_TYPOGRAPHY.titleFont);
    expect(presentation.bodyFont).toBe(PROJECT_DEFAULT_TYPOGRAPHY.bodyFont);
    expect(presentation.nameSize).toBe(21);
    expect(presentation.rulesSize).toBe(12);
  });

  it("maps existing archetypes to their current default card bases and resource pools", () => {
    expect(defaultBaseForArchetype("creature")).toBe("CreatureBase");
    expect(defaultBaseForArchetype("spell")).toBe("SpellBase");
    expect(defaultBaseForArchetype("equipment")).toBe("BaseAbility");
    expect(defaultResourceKindForArchetype("creature")).toBe("energy");
    expect(defaultResourceKindForArchetype("spell")).toBe("mana");
    expect(defaultResourceKindForArchetype("building")).toBe("resource");
  });

  it("derives the legacy three-label strip without changing engine taxonomy", () => {
    const footman = CARD_DEFINITIONS.footman;
    expect(defaultPrintedCategories(footman)).toEqual(["Common", "Neutral", "Fighter"]);
  });

  it("caps authored printed categories at five", () => {
    const presentation = createDefaultCardPresentation("creature", ["1", "2", "3", "4", "5", "6"]);
    expect(presentation.categories).toHaveLength(MAX_PRINTED_CATEGORIES);
    expect(presentation.categories).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("hydrates older drafts while retaining defaults for missing fields", () => {
    const fallback = createDefaultCardPresentation("creature", ["Common", "Neutral", "Fighter"]);
    const hydrated = hydrateCardPresentation(
      {
        artScale: 1.25,
        categories: ["Rare", "Skaldjborn", "Human", "Fighter"],
        layout: { ...PROJECT_DEFAULT_LAYOUT, nameY: 30 },
      },
      fallback,
    );

    expect(hydrated.artScale).toBe(1.25);
    expect(hydrated.layout.nameY).toBe(30);
    expect(hydrated.layout.costX).toBe(PROJECT_DEFAULT_LAYOUT.costX);
    expect(hydrated.statSize).toBe(PROJECT_DEFAULT_TYPOGRAPHY.statSize);
  });

  it("loads saved Builder presentation without replacing authoritative gameplay values", () => {
    const storage = {
      getItem: () => JSON.stringify({
        art: "/cards/custom-footman.png",
        playPool: "mana",
        baseKey: "SpellBase",
        artScale: 1.3,
        categories: ["Rare", "Lorthaine", "Human", "Fighter"],
        cost: 99,
        attack: 99,
      }),
    };

    const runtime = getRuntimeCardPresentation(CARD_DEFINITIONS.footman, storage);
    expect(runtime.art).toBe("/cards/custom-footman.png");
    expect(runtime.playPool).toBe("mana");
    expect(runtime.presentation.baseKey).toBe("SpellBase");
    expect(runtime.presentation.artScale).toBe(1.3);
    expect(runtime.presentation.categories).toEqual(["Rare", "Lorthaine", "Human", "Fighter"]);
    expect("cost" in runtime.presentation).toBe(false);
    expect("attack" in runtime.presentation).toBe(false);
  });
});
