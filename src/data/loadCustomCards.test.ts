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
      category: "weapon",
      attackBonus: 1,
      damageReduction: 0,
    });
    expect(card).not.toBeNull();
    if (card?.archetype === "equipment") {
      expect(card.category).toBe("weapon");
    }
  });

  it("rejects an equipment card missing category", () => {
    const card = validateCard({
      id: "test-equipment-no-category",
      name: "Test Blade",
      archetype: "equipment",
      cost: 2,
      rarity: "common",
      attackBonus: 1,
      damageReduction: 0,
    });
    expect(card).toBeNull();
  });

  it("rejects an equipment card with an invalid category", () => {
    const card = validateCard({
      id: "test-equipment-bad-category",
      name: "Test Blade",
      archetype: "equipment",
      cost: 2,
      rarity: "common",
      category: "shield",
      attackBonus: 1,
      damageReduction: 0,
    });
    expect(card).toBeNull();
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

  it("accepts every currently-defined keyword, not just ranged/charge", () => {
    const card = validateCard({
      id: "x",
      name: "X",
      archetype: "creature",
      cost: 1,
      rarity: "common",
      attack: 1,
      hp: 1,
      keywords: ["stealth", "ward", "cleave", "drain", "bloodied", "summon", "warcry", "taunt", "armiger"],
    });
    expect(card).not.toBeNull();
    if (card?.archetype === "creature") {
      expect(card.keywords).toEqual(["stealth", "ward", "cleave", "drain", "bloodied", "summon", "warcry", "taunt", "armiger"]);
    }
  });

  it("accepts a creature with an onDeath summonCreature trigger", () => {
    const card = validateCard({
      id: "x",
      name: "X",
      archetype: "creature",
      cost: 1,
      rarity: "common",
      attack: 1,
      hp: 1,
      keywords: ["summon", "revenge"],
      triggers: [{ on: "onDeath", effect: { kind: "summonCreature", creatureId: "militia-recruit" } }],
    });
    expect(card).not.toBeNull();
    if (card?.archetype === "creature") {
      expect(card.triggers).toHaveLength(1);
    }
  });

  it("drops a summonCreature trigger missing creatureId but keeps the rest of a valid creature", () => {
    const card = validateCard({
      id: "x",
      name: "X",
      archetype: "creature",
      cost: 1,
      rarity: "common",
      attack: 1,
      hp: 1,
      triggers: [{ on: "onDeath", effect: { kind: "summonCreature" } }],
    });
    expect(card).not.toBeNull();
    if (card?.archetype === "creature") {
      expect(card.triggers).toHaveLength(0);
    }
  });

  it("accepts a Building with an auraBuff passive and a Mana-costed activated ability", () => {
    const card = validateCard({
      id: "x",
      name: "X",
      archetype: "building",
      cost: 3,
      rarity: "rare",
      hp: 5,
      passive: { kind: "auraBuff", filter: { race: "beast" }, attackDelta: 2 },
      ability: { effect: { kind: "summonCreature", creatureId: "militia-recruit" }, activateCost: 3, pool: "mana" },
    });
    expect(card).not.toBeNull();
    if (card?.archetype === "building") {
      expect(card.passive).toEqual({ kind: "auraBuff", filter: { race: "beast" }, attackDelta: 2 });
      expect(card.ability?.pool).toBe("mana");
      expect(card.ability?.activateCost).toBe(3);
    }
  });

  it("defaults a Building ability's pool to undefined (Resources) when omitted, and drops a malformed passive", () => {
    const card = validateCard({
      id: "x",
      name: "X",
      archetype: "building",
      cost: 2,
      rarity: "common",
      hp: 3,
      passive: { kind: "auraBuff", attackDelta: 1 }, // missing filter — invalid
      ability: { effect: { kind: "gainGuard", amount: 2 }, activateCost: 1 },
    });
    expect(card).not.toBeNull();
    if (card?.archetype === "building") {
      expect(card.passive).toBeUndefined();
      expect(card.ability?.pool).toBeUndefined();
      expect(card.ability?.activateCost).toBe(1);
    }
  });

  it("drops an ability with an invalid pool but keeps the rest of a valid Building", () => {
    const card = validateCard({
      id: "x",
      name: "X",
      archetype: "building",
      cost: 2,
      rarity: "common",
      hp: 3,
      ability: { effect: { kind: "gainGuard", amount: 2 }, activateCost: 1, pool: "gold" },
    });
    expect(card).not.toBeNull();
    if (card?.archetype === "building") {
      expect(card.ability).toBeUndefined();
    }
  });

  it("accepts a Swarm summonCreature effect with a count", () => {
    const card = validateCard({
      id: "x",
      name: "X",
      archetype: "spell",
      spellForm: "instant",
      cost: 4,
      rarity: "rare",
      effect: { kind: "summonCreature", creatureId: "young-wolf", count: 3 },
    });
    expect(card).not.toBeNull();
    if (card?.archetype === "spell" && card.spellForm === "instant") {
      expect(card.effect).toEqual({ kind: "summonCreature", creatureId: "young-wolf", count: 3 });
    }
  });

  it("accepts a Consume effect targeting an allied creature", () => {
    const card = validateCard({
      id: "x",
      name: "X",
      archetype: "ability",
      cost: 2,
      rarity: "rare",
      activateCost: 2,
      charges: "unlimited",
      effect: { kind: "consume", target: "targetCreature", attackDelta: 1, hpDelta: 1 },
    });
    expect(card).not.toBeNull();
  });

  it("accepts a Transform effect naming the new creature", () => {
    const card = validateCard({
      id: "x",
      name: "X",
      archetype: "spell",
      spellForm: "instant",
      cost: 3,
      rarity: "epic",
      effect: { kind: "transform", target: "targetCreature", creatureId: "alpha-wolf" },
    });
    expect(card).not.toBeNull();
  });

  it("rejects a Transform effect missing creatureId", () => {
    const card = validateCard({
      id: "x",
      name: "X",
      archetype: "spell",
      spellForm: "instant",
      cost: 3,
      rarity: "epic",
      effect: { kind: "transform", target: "targetCreature" },
    });
    expect(card).toBeNull();
  });
});
