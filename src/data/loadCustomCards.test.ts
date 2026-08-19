import { describe, expect, it } from "vitest";
import { validateCard } from "./loadCustomCards";

describe("custom card validation", () => {
  it("accepts a well-formed creature with an onPlay trigger", () => {
    const card = validateCard({
      id: "test-creature",
      name: "Test Creature",
      archetype: "creature",
      cost: 3,
      rarity: "rare",
      attack: 3,
      hp: 4,
      keywords: ["ranged"],
      text: "Ranged. On Play: deal 1 damage to an enemy creature.",
      triggers: [{ on: "onPlay", effect: { kind: "damage", amount: 1, target: "targetCreature" } }],
    });
    expect(card).not.toBeNull();
    expect(card?.archetype).toBe("creature");
  });

  it("accepts a well-formed ritual/charged spell", () => {
    const card = validateCard({
      id: "test-spell",
      name: "Test Spell",
      archetype: "spell",
      spellForm: "ritual",
      cost: 2,
      rarity: "common",
      activateCost: 2,
      charges: "unlimited",
      effect: { kind: "damage", amount: 2, target: "targetCreature" },
    });
    expect(card).not.toBeNull();
  });

  it("accepts a well-formed instant spell with no activateCost/charges", () => {
    const card = validateCard({
      id: "test-instant-spell",
      name: "Test Instant Spell",
      archetype: "spell",
      spellForm: "instant",
      cost: 3,
      rarity: "common",
      effect: { kind: "damage", amount: 4, target: "targetAny" },
    });
    expect(card).not.toBeNull();
    expect(card?.archetype).toBe("spell");
  });

  it("rejects a spell missing spellForm", () => {
    const card = validateCard({
      id: "test-spell-no-form",
      name: "Test Spell",
      archetype: "spell",
      cost: 2,
      rarity: "common",
      activateCost: 2,
      charges: "unlimited",
      effect: { kind: "damage", amount: 2, target: "targetCreature" },
    });
    expect(card).toBeNull();
  });

  it("accepts a well-formed equipment card", () => {
    const card = validateCard({
      id: "test-equipment",
      name: "Test Blade",
      archetype: "equipment",
      cost: 2,
      rarity: "common",
      attackBonus: 1,
      damageReduction: 0,
    });
    expect(card).not.toBeNull();
  });

  it("rejects a non-object", () => {
    expect(validateCard("not a card")).toBeNull();
    expect(validateCard(null)).toBeNull();
  });

  it("rejects an unknown archetype", () => {
    expect(validateCard({ id: "x", name: "X", archetype: "monster", cost: 1, rarity: "common" })).toBeNull();
  });

  it("rejects a creature missing attack/hp", () => {
    expect(
      validateCard({ id: "x", name: "X", archetype: "creature", cost: 1, rarity: "common", attack: 1 }),
    ).toBeNull();
  });

  it("rejects a spell with a malformed effect", () => {
    const card = validateCard({
      id: "x",
      name: "X",
      archetype: "spell",
      spellForm: "charged",
      cost: 1,
      rarity: "common",
      activateCost: 1,
      charges: 1,
      effect: { kind: "damage" }, // missing amount/target
    });
    expect(card).toBeNull();
  });

  it("drops an invalid trigger but keeps the rest of a valid creature", () => {
    const card = validateCard({
      id: "x",
      name: "X",
      archetype: "creature",
      cost: 1,
      rarity: "common",
      attack: 1,
      hp: 1,
      triggers: [{ on: "notARealTrigger", effect: { kind: "damage", amount: 1, target: "targetCreature" } }],
    });
    expect(card).not.toBeNull();
    if (card?.archetype === "creature") {
      expect(card.triggers).toHaveLength(0);
    }
  });
});
