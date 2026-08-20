import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { activateBuildingAbility } from "./building";
import {
  creatureCanAttack,
  declareAdvance,
  declareCreatureAttack,
  declareDuelMark,
  declareHeroAttack,
  getEffectiveCreatureAttack,
  getEffectiveCreatureMaxHp,
  getHeroAttack,
  heroCanAttack,
} from "./combat";
import { CARD_DEFINITIONS } from "../data/cards";
import { drawCard } from "./deck";
import { damageCard, damagePlayer, gainCap, healCard, resolveEffect } from "./effects";
import { assignEquipment } from "./equipment";
import { createCardInstance, createInitialGameState } from "./factory";
import { activateSlotCard, playCardFromHand, startTurn } from "./game";
import { activateHeroPower, activateHeroSignature } from "./hero";
import { applyStatus } from "./status";
import {
  BUILDING_SLOTS,
  MAX_POOL,
  SPELL_ABILITY_SLOTS,
  STARTING_GUARD,
  STARTING_POOL,
  SUPPORT_SIZE,
  VANGUARD_SIZE,
  type GameState,
} from "./types";

function makeState(): GameState {
  return createInitialGameState("fighter", [], "mage", []);
}

describe("resource pools", () => {
  it("caps at MAX_POOL and current tracks alongside cap", () => {
    const state = makeState();
    const player = state.players.player;
    expect(player.resources.cap).toBe(5);
    for (let i = 0; i < 10; i++) gainCap(state, "player", "resource", 1);
    expect(player.resources.cap).toBe(MAX_POOL);
    expect(player.resources.current).toBe(MAX_POOL);
  });
});

describe("resources are spent from the pool matching the card's archetype", () => {
  it("pays a Creature's cost from Energy, not Resources", () => {
    const state = makeState();
    const player = state.players.player;
    player.resources.current = 0;
    const footman = createCardInstance("footman", "player");
    player.hand.push(footman);

    const result = playCardFromHand(state, "player", footman.instanceId);
    expect(result.ok).toBe(true);
    expect(player.energy.current).toBe(3); // started at 5, footman costs 2
    expect(player.resources.current).toBe(0);
  });

  it("pays a Spell's cost from Mana, not Resources", () => {
    const state = makeState();
    const player = state.players.player;
    player.resources.current = 0;
    const bolt = createCardInstance("lightning-bolt", "player");
    player.hand.push(bolt);

    const result = playCardFromHand(state, "player", bolt.instanceId);
    expect(result.ok).toBe(true);
    expect(player.mana.current).toBe(3); // started at 5, Lightning Bolt costs 2
    expect(player.resources.current).toBe(0);
  });

  it("pays a Building's cost from Resources", () => {
    const state = makeState();
    const player = state.players.player;
    const mine = createCardInstance("gold-mine", "player");
    player.hand.push(mine);

    const result = playCardFromHand(state, "player", mine.instanceId);
    expect(result.ok).toBe(true);
    // Started at 5, Gold Mine costs 4 (-> 1), then its own When Built grants +1 max/current Resources (-> 2).
    // The other When Built trigger (+2 income) only shows up on the next startTurn, not here.
    expect(player.resources.current).toBe(2);
  });
});

describe("creature row placement", () => {
  it("plays into Vanguard by default", () => {
    const state = makeState();
    const footman = createCardInstance("footman", "player");
    state.players.player.hand.push(footman);

    const result = playCardFromHand(state, "player", footman.instanceId);
    expect(result.ok).toBe(true);
    expect(state.players.player.board.vanguard[0]?.instanceId).toBe(footman.instanceId);
  });

  it("plays into Support when explicitly requested", () => {
    const state = makeState();
    const archer = createCardInstance("arrow-archer", "player");
    state.players.player.hand.push(archer);

    const result = playCardFromHand(state, "player", archer.instanceId, { row: "support" });
    expect(result.ok).toBe(true);
    expect(state.players.player.board.support[0]?.instanceId).toBe(archer.instanceId);
  });
});

describe("reach tiers: attacking from Support", () => {
  it("a non-Ranged creature in Support cannot attack at all", () => {
    const state = makeState();
    const footman = createCardInstance("footman", "player");
    footman.summonedTurn = 0;
    state.players.player.board.support[0] = footman;

    const result = declareCreatureAttack(state, "player", footman.instanceId, { type: "player" });
    expect(result.ok).toBe(false);
  });

  it("a Ranged creature in Support can attack from there", () => {
    const state = makeState();
    const archer = createCardInstance("arrow-archer", "player");
    archer.summonedTurn = 0;
    state.players.player.board.support[0] = archer;

    const result = declareCreatureAttack(state, "player", archer.instanceId, { type: "player" });
    expect(result.ok).toBe(true);
  });
});

describe("reach tiers: targeting enemy Support", () => {
  it("a Base (no reach keyword) attacker CANNOT target an enemy Support creature while enemy Vanguard is still populated", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    state.players.opponent.board.vanguard[0] = createCardInstance("footman", "opponent");
    const hiding = createCardInstance("footman", "opponent");
    state.players.opponent.board.support[0] = hiding;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "creature",
      instanceId: hiding.instanceId,
    });
    expect(result.ok).toBe(false);
  });

  it("a Base (no reach keyword) attacker CAN target an enemy Support creature once enemy Vanguard is empty (the basic combat ladder)", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    const archer = createCardInstance("arrow-archer", "opponent");
    state.players.opponent.board.support[0] = archer;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "creature",
      instanceId: archer.instanceId,
    });
    expect(result.ok).toBe(true);
  });

  it("a Reach attacker can target an enemy Support creature directly, even through a full enemy Vanguard", () => {
    const state = makeState();
    const pikeman = createCardInstance("long-pikeman", "player");
    pikeman.summonedTurn = 0;
    state.players.player.board.vanguard[0] = pikeman;
    state.players.opponent.board.vanguard[0] = createCardInstance("footman", "opponent");
    const hiding = createCardInstance("footman", "opponent");
    state.players.opponent.board.support[0] = hiding;

    const result = declareCreatureAttack(state, "player", pikeman.instanceId, {
      type: "creature",
      instanceId: hiding.instanceId,
    });
    expect(result.ok).toBe(true);
  });

  it("a Ranged attacker can also target an enemy Support creature directly", () => {
    const state = makeState();
    const archer = createCardInstance("arrow-archer", "player");
    archer.summonedTurn = 0;
    state.players.player.board.vanguard[0] = archer;
    const hiding = createCardInstance("footman", "opponent");
    state.players.opponent.board.support[0] = hiding;

    const result = declareCreatureAttack(state, "player", archer.instanceId, {
      type: "creature",
      instanceId: hiding.instanceId,
    });
    expect(result.ok).toBe(true);
  });
});

describe("Building targeting: column protection", () => {
  it("a Building is attackable once its own column is clear, even if other columns still have creatures", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    state.players.opponent.board.vanguard[1] = createCardInstance("footman", "opponent"); // column 1, not 0
    const building = createCardInstance("gold-mine", "opponent");
    state.players.opponent.board.buildings[0] = building;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "building",
      instanceId: building.instanceId,
    });
    expect(result.ok).toBe(true);
  });

  it("blocks a Building attack while its own column's Support slot is still occupied", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    state.players.opponent.board.support[0] = createCardInstance("footman", "opponent");
    const building = createCardInstance("gold-mine", "opponent");
    state.players.opponent.board.buildings[0] = building;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "building",
      instanceId: building.instanceId,
    });
    expect(result.ok).toBe(false);
  });
});

describe("Infiltrate", () => {
  it("hits the player even with both enemy rows fully populated", () => {
    const state = makeState();
    const infiltrator = createCardInstance("shadow-infiltrator", "player");
    infiltrator.summonedTurn = 0;
    state.players.player.board.vanguard[0] = infiltrator;
    state.players.opponent.board.vanguard[0] = createCardInstance("footman", "opponent");
    state.players.opponent.board.support[0] = createCardInstance("footman", "opponent");

    const result = declareCreatureAttack(state, "player", infiltrator.instanceId, { type: "player" });
    expect(result.ok).toBe(true);
  });

  it("hits a Building even while its own column is still populated", () => {
    const state = makeState();
    const infiltrator = createCardInstance("shadow-infiltrator", "player");
    infiltrator.summonedTurn = 0;
    state.players.player.board.vanguard[0] = infiltrator;
    state.players.opponent.board.vanguard[0] = createCardInstance("footman", "opponent");
    const building = createCardInstance("gold-mine", "opponent");
    state.players.opponent.board.buildings[0] = building;

    const result = declareCreatureAttack(state, "player", infiltrator.instanceId, {
      type: "building",
      instanceId: building.instanceId,
    });
    expect(result.ok).toBe(true);
  });
});

describe("targeting chain", () => {
  it("lets a Vanguard creature attack any enemy Vanguard creature", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    const defender = createCardInstance("footman", "opponent");
    state.players.opponent.board.vanguard[2] = defender;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "creature",
      instanceId: defender.instanceId,
    });
    expect(result.ok).toBe(true);
  });

  it("blocks a non-Ranged attacker from reaching a Building while Vanguard isn't empty", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    state.players.opponent.board.vanguard[0] = createCardInstance("footman", "opponent");
    const building = createCardInstance("gold-mine", "opponent");
    state.players.opponent.board.buildings[0] = building;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "building",
      instanceId: building.instanceId,
    });
    expect(result.ok).toBe(false);
  });

  it("lets any attacker hit the player directly even with a populated enemy Vanguard (Hero has no board-state gate)", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player"); // plain melee, no reach keywords at all
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    state.players.opponent.board.vanguard[0] = createCardInstance("footman", "opponent");

    const result = declareCreatureAttack(state, "player", attacker.instanceId, { type: "player" });
    expect(result.ok).toBe(true);
  });

  it("lets any attacker hit the player directly even with a populated enemy Support", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    state.players.opponent.board.support[0] = createCardInstance("footman", "opponent");

    const result = declareCreatureAttack(state, "player", attacker.instanceId, { type: "player" });
    expect(result.ok).toBe(true);
  });

  it("lets any attacker hit the player even with both enemy rows fully populated", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    state.players.opponent.board.vanguard[0] = createCardInstance("footman", "opponent");
    state.players.opponent.board.support[0] = createCardInstance("footman", "opponent");

    const result = declareCreatureAttack(state, "player", attacker.instanceId, { type: "player" });
    expect(result.ok).toBe(true);
  });
});

describe("Taunt blocks Hero-targeting", () => {
  it("blocks a base attacker from hitting the player while a Vanguard Taunt creature is up", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    state.players.opponent.board.vanguard[0] = createCardInstance("stonewall-guardian", "opponent"); // taunt

    const result = declareCreatureAttack(state, "player", attacker.instanceId, { type: "player" });
    expect(result.ok).toBe(false);
  });

  it("blocks a Reach attacker from hitting the player while a Support Taunt creature is up", () => {
    const state = makeState();
    const pikeman = createCardInstance("long-pikeman", "player"); // reach
    pikeman.summonedTurn = 0;
    state.players.player.board.vanguard[0] = pikeman;
    const supportTaunt = createCardInstance("stonewall-guardian", "opponent");
    state.players.opponent.board.support[0] = supportTaunt;

    const result = declareCreatureAttack(state, "player", pikeman.instanceId, { type: "player" });
    expect(result.ok).toBe(false);
  });

  it("blocks a base attacker from hitting the player over a Support-only Taunt once enemy Vanguard is empty (it can now reach that rung)", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player"); // no reach keywords
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    state.players.opponent.board.support[0] = createCardInstance("stonewall-guardian", "opponent");

    const result = declareCreatureAttack(state, "player", attacker.instanceId, { type: "player" });
    expect(result.ok).toBe(false);
  });

  it("does NOT block a base attacker from hitting the player over a Support-only Taunt while enemy Vanguard is still populated by a non-Taunt creature (can't reach that far, and mere population isn't a gate)", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player"); // no reach keywords
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    state.players.opponent.board.vanguard[0] = createCardInstance("footman", "opponent"); // populated, but no Taunt
    state.players.opponent.board.support[0] = createCardInstance("stonewall-guardian", "opponent");

    const result = declareCreatureAttack(state, "player", attacker.instanceId, { type: "player" });
    expect(result.ok).toBe(true);
  });

  it("Infiltrate bypasses a Vanguard Taunt creature for Hero-targeting", () => {
    const state = makeState();
    const infiltrator = createCardInstance("shadow-infiltrator", "player");
    infiltrator.summonedTurn = 0;
    state.players.player.board.vanguard[0] = infiltrator;
    state.players.opponent.board.vanguard[0] = createCardInstance("stonewall-guardian", "opponent");

    const result = declareCreatureAttack(state, "player", infiltrator.instanceId, { type: "player" });
    expect(result.ok).toBe(true);
  });
});

describe("guard -> hero HP overflow", () => {
  it("drains Guard before touching Hero HP", () => {
    const state = makeState();
    damagePlayer(state, "opponent", 40);
    expect(state.players.opponent.guard.current).toBe(STARTING_GUARD - 40);
    expect(state.players.opponent.hero.currentHp).toBe(10);
  });

  it("overflows into Hero HP once Guard is exhausted", () => {
    const state = makeState();
    damagePlayer(state, "opponent", STARTING_GUARD + 4);
    expect(state.players.opponent.guard.current).toBe(0);
    expect(state.players.opponent.hero.currentHp).toBe(10 - 4);
  });

  it("declares a winner once Hero HP reaches 0", () => {
    const state = makeState();
    damagePlayer(state, "opponent", STARTING_GUARD + 10);
    expect(state.winner).toBe("player");
  });
});

describe("deck reshuffle", () => {
  it("reshuffles the discard pile (never the graveyard) once the deck is empty", () => {
    const state = makeState();
    const player = state.players.player;
    const discarded = createCardInstance("footman", "player");
    player.discard.push(discarded);
    const buried = createCardInstance("footman", "player");
    player.graveyard.push(buried);

    expect(player.deck.length).toBe(0);
    const drawn = drawCard(state, "player");
    expect(drawn?.instanceId).toBe(discarded.instanceId);
    expect(player.discard.length).toBe(0);
    expect(player.graveyard).toEqual([buried]);
  });

  it("is a no-op when both deck and discard are empty", () => {
    const state = makeState();
    expect(drawCard(state, "player")).toBeNull();
  });
});

describe("spell/ability charges", () => {
  it("discards a limited-charge card once its last charge is spent", () => {
    const state = makeState();
    const card = createCardInstance("lightning-bolt", "player"); // 2 charges
    state.players.player.board.spellAbilitySlots[0] = card;
    const enemy1 = createCardInstance("footman", "opponent");
    state.players.opponent.board.vanguard[0] = enemy1;
    const enemy2 = createCardInstance("footman", "opponent");
    state.players.opponent.board.vanguard[1] = enemy2;

    activateSlotCard(state, "player", 0, { kind: "card", owner: "opponent", instanceId: enemy1.instanceId });
    expect(state.players.player.board.spellAbilitySlots[0]).not.toBeNull();

    activateSlotCard(state, "player", 0, { kind: "card", owner: "opponent", instanceId: enemy2.instanceId });
    expect(state.players.player.board.spellAbilitySlots[0]).toBeNull();
    expect(state.players.player.discard.some((c) => c.defId === "lightning-bolt")).toBe(true);
  });

  it("keeps an unlimited-charge card in its slot after activation", () => {
    const state = makeState();
    const card = createCardInstance("arcane-missiles", "player"); // unlimited
    state.players.player.board.spellAbilitySlots[0] = card;
    const enemy = createCardInstance("footman", "opponent");
    state.players.opponent.board.vanguard[0] = enemy;

    activateSlotCard(state, "player", 0, { kind: "card", owner: "opponent", instanceId: enemy.instanceId });
    expect(state.players.player.board.spellAbilitySlots[0]?.instanceId).toBe(card.instanceId);
  });
});

describe("turn flow", () => {
  it("refills Energy/Mana to cap, trickles Resources by +1, and resets attack flags", () => {
    const state = makeState();
    state.players.player.energy.current = 0;
    state.players.player.mana.current = 0;
    state.players.player.resources.current = 0;
    const creature = createCardInstance("footman", "player");
    creature.hasAttackedThisTurn = true;
    state.players.player.board.vanguard[0] = creature;
    state.turnNumber = 2;

    startTurn(state);
    expect(state.players.player.energy.current).toBe(state.players.player.energy.cap);
    expect(state.players.player.mana.current).toBe(state.players.player.mana.cap);
    expect(state.players.player.resources.current).toBe(1);
    expect(creature.hasAttackedThisTurn).toBe(false);
  });

  it("caps the Resources trickle at the current max instead of overflowing", () => {
    const state = makeState();
    state.players.player.resources.current = state.players.player.resources.cap;
    state.turnNumber = 2;
    startTurn(state);
    expect(state.players.player.resources.current).toBe(state.players.player.resources.cap);
  });

  it("does not draw on the very first turn of the game", () => {
    const state = makeState();
    state.players.player.deck.push(createCardInstance("footman", "player"));
    startTurn(state);
    expect(state.players.player.hand.length).toBe(0);
  });
});

describe("Taunt", () => {
  it("blocks attacking a non-Taunt creature while a Taunt creature is present", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    const taunt = createCardInstance("stonewall-guardian", "opponent");
    const other = createCardInstance("footman", "opponent");
    state.players.opponent.board.vanguard[0] = taunt;
    state.players.opponent.board.vanguard[1] = other;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "creature",
      instanceId: other.instanceId,
    });
    expect(result.ok).toBe(false);
  });

  it("allows attacking the Taunt creature itself", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    const taunt = createCardInstance("stonewall-guardian", "opponent");
    state.players.opponent.board.vanguard[0] = taunt;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "creature",
      instanceId: taunt.instanceId,
    });
    expect(result.ok).toBe(true);
  });
});

// makeState()'s player Hero is Fighter, whose Passive gives friendly
// creatures +1 Attack (DESIGN.md §9) — every expected value below already
// includes that +1 on top of Enrage itself.
describe("Enrage (DESIGN.md §17)", () => {
  it("gains live Attack equal to current missing HP, reduced again by healing", () => {
    const state = makeState();
    const ogre = createCardInstance("berserking-ogre", "player"); // base 3 attack, +1 Fighter aura
    state.players.player.board.vanguard[0] = ogre;

    damageCard(state, "player", ogre.instanceId, 2);
    expect(ogre.attackDelta).toBe(0); // never permanently stored
    expect(getEffectiveCreatureAttack(state, "player", ogre)).toBe(6); // 3 base + 1 aura + 2 missing HP

    healCard(state, "player", ogre.instanceId, 1);
    expect(getEffectiveCreatureAttack(state, "player", ogre)).toBe(5); // healing brings the bonus back down
  });

  it("has no bonus left once fully healed, and no bonus on the killing blow (dead creatures aren't queried)", () => {
    const state = makeState();
    const ogre = createCardInstance("berserking-ogre", "player");
    state.players.player.board.vanguard[0] = ogre;

    expect(getEffectiveCreatureAttack(state, "player", ogre)).toBe(4); // 3 base + 1 aura, no missing HP
    damageCard(state, "player", ogre.instanceId, 5);
    expect(ogre.currentHp).toBeLessThanOrEqual(0);
  });
});

describe("Frenzy (DESIGN.md §17)", () => {
  it("permanently gains Attack every time it attacks, regardless of whether the hit lands", () => {
    const state = makeState();
    const berserker = createCardInstance("berserker", "player");
    berserker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = berserker;

    declareCreatureAttack(state, "player", berserker.instanceId, { type: "player" });
    expect(berserker.attackDelta).toBe(2);

    declareCreatureAttack(state, "player", berserker.instanceId, { type: "player" });
    // still exhausted (hasAttackedThisTurn) — a second attack this turn is rejected, no further gain
    expect(berserker.attackDelta).toBe(2);
  });
});

describe("Immune", () => {
  it("blocks a spell's damage", () => {
    const state = makeState();
    const golem = createCardInstance("arcane-golem", "opponent");
    state.players.opponent.board.vanguard[0] = golem;
    const spell = createCardInstance("lightning-bolt", "player");
    state.players.player.board.spellAbilitySlots[0] = spell;

    activateSlotCard(state, "player", 0, { kind: "card", owner: "opponent", instanceId: golem.instanceId });
    expect(golem.currentHp).toBe(4);
  });

  it("does not block an ability's damage", () => {
    // Executioner's Strike is Instant now (resolves on play, never reaches
    // a slot) — none of the built-in "activated" Abilities deal damage, so
    // a synthetic one exercises this specifically.
    const testAbilityId = "test-damage-ability";
    CARD_DEFINITIONS[testAbilityId] = {
      id: testAbilityId,
      name: "Test Damage Ability",
      archetype: "ability",
      abilityForm: "activated",
      cost: 1,
      rarity: "common",
      activateCost: 1,
      charges: "unlimited",
      effect: { kind: "damage", amount: 2, target: "targetCreature" },
    };
    try {
      const state = makeState();
      const golem = createCardInstance("arcane-golem", "opponent");
      state.players.opponent.board.vanguard[0] = golem;
      const ability = createCardInstance(testAbilityId, "player");
      state.players.player.board.spellAbilitySlots[0] = ability;

      activateSlotCard(state, "player", 0, { kind: "card", owner: "opponent", instanceId: golem.instanceId });
      expect(golem.currentHp).toBeLessThan(4);
    } finally {
      delete CARD_DEFINITIONS[testAbilityId];
    }
  });

  it("does not block a direct creature attack", () => {
    const state = makeState();
    const golem = createCardInstance("arcane-golem", "opponent");
    state.players.opponent.board.vanguard[0] = golem;
    const attacker = createCardInstance("berserking-ogre", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;

    declareCreatureAttack(state, "player", attacker.instanceId, { type: "creature", instanceId: golem.instanceId });
    expect(golem.currentHp).toBeLessThan(4);
  });
});

describe("Counter", () => {
  it("deals damage back to the attacker when the Counter creature is attacked", () => {
    const state = makeState();
    const turtle = createCardInstance("spiked-turtle", "opponent");
    state.players.opponent.board.vanguard[0] = turtle;
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;

    declareCreatureAttack(state, "player", attacker.instanceId, { type: "creature", instanceId: turtle.instanceId });
    // Footman has 3 HP; takes 2 from Counter plus 1 from the Turtle's own Attack.
    expect(attacker.currentHp).toBe(0);
  });
});

describe("Ranged retaliation", () => {
  it("a Ranged attacker takes no damage back even if the defender survives and could hit back", () => {
    const state = makeState();
    const archer = createCardInstance("arrow-archer", "player"); // 2 attack / 1 HP, ranged
    archer.summonedTurn = 0;
    state.players.player.board.vanguard[0] = archer;
    const defender = createCardInstance("footman", "opponent"); // 2 attack / 3 HP
    defender.currentHp = 5; // padded so it survives the archer's 3 (2 base + Fighter's +1 aura from makeState()'s player hero)
    state.players.opponent.board.vanguard[0] = defender;

    declareCreatureAttack(state, "player", archer.instanceId, { type: "creature", instanceId: defender.instanceId });
    expect(defender.currentHp).toBe(2); // took the archer's 3 damage, survived
    expect(archer.currentHp).toBe(1); // took no retaliation despite the defender surviving with Attack
  });

  it("a Ranged creature on defense still trades damage back normally against a melee attacker", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player"); // melee, 2 attack / 3 HP
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    const archer = createCardInstance("arrow-archer", "opponent"); // 2 attack / 1 HP, ranged
    state.players.opponent.board.vanguard[0] = archer;

    declareCreatureAttack(state, "player", attacker.instanceId, { type: "creature", instanceId: archer.instanceId });
    expect(archer.currentHp).toBeLessThanOrEqual(0); // died to the melee attacker's 2 damage
    expect(attacker.currentHp).toBe(1); // still took the archer's 2 retaliation damage on the way out
  });

  it("two Ranged creatures trade damage back and forth normally — Ranged-vs-Ranged is not immune", () => {
    const state = makeState();
    const archer = createCardInstance("arrow-archer", "player"); // 2 attack / 1 HP, ranged
    archer.summonedTurn = 0;
    state.players.player.board.vanguard[0] = archer;
    const sniper = createCardInstance("longbow-sniper", "opponent"); // 3 attack / 3 HP, ranged
    sniper.currentHp = 5; // padded so it survives the archer's 3 (2 base + Fighter's +1 aura from makeState()'s player hero)
    state.players.opponent.board.vanguard[0] = sniper;

    declareCreatureAttack(state, "player", archer.instanceId, { type: "creature", instanceId: sniper.instanceId });
    expect(sniper.currentHp).toBe(2); // took the archer's 3 damage, survived
    expect(archer.currentHp).toBeLessThanOrEqual(0); // took the sniper's 3 retaliation damage and died — Ranged didn't save it
  });
});

describe("Massive", () => {
  it("occupies spaceCost contiguous slots when played", () => {
    const state = makeState();
    state.players.player.energy.current = 10; // Hill Giant costs 6, above the default starting pool
    const giant = createCardInstance("hill-giant", "player"); // spaceCost 2
    state.players.player.hand.push(giant);

    const result = playCardFromHand(state, "player", giant.instanceId);
    expect(result.ok).toBe(true);
    expect(state.players.player.board.vanguard[0]?.instanceId).toBe(giant.instanceId);
    expect(state.players.player.board.vanguard[1]?.instanceId).toBe(giant.instanceId);
  });

  it("fails to play without enough contiguous open space", () => {
    const state = makeState();
    state.players.player.energy.current = 10; // rule out "not enough Energy" as the failure reason
    state.players.player.board.vanguard[0] = createCardInstance("footman", "player");
    state.players.player.board.vanguard[2] = createCardInstance("footman", "player");
    state.players.player.board.vanguard[4] = createCardInstance("footman", "player");
    // Only single isolated gaps remain (slots 1 and 3) — no 2 contiguous slots.
    const giant = createCardInstance("hill-giant", "player");
    state.players.player.hand.push(giant);

    const result = playCardFromHand(state, "player", giant.instanceId);
    expect(result.ok).toBe(false);
  });

  it("clears every occupied slot on death", () => {
    const state = makeState();
    const giant = createCardInstance("hill-giant", "player");
    state.players.player.board.vanguard[0] = giant;
    state.players.player.board.vanguard[1] = giant;

    giant.currentHp = 1;
    damageCard(state, "player", giant.instanceId, 99);
    expect(state.players.player.board.vanguard[0]).toBeNull();
    expect(state.players.player.board.vanguard[1]).toBeNull();
    expect(state.players.player.graveyard).toContain(giant);
  });

  it("is hit exactly once by an AOE effect, not once per occupied slot", () => {
    const state = makeState();
    const giant = createCardInstance("hill-giant", "opponent");
    giant.currentHp = 9;
    state.players.opponent.board.vanguard[0] = giant;
    state.players.opponent.board.vanguard[1] = giant;

    resolveEffect(state, "player", { kind: "damage", amount: 2, target: "allEnemyCreatures" }, null);
    expect(giant.currentHp).toBe(7); // 9 - 2, not 9 - 4
  });

  it("protects both of its columns' Buildings, not just one", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    const giant = createCardInstance("hill-giant", "opponent");
    state.players.opponent.board.vanguard[0] = giant;
    state.players.opponent.board.vanguard[1] = giant;
    const building = createCardInstance("gold-mine", "opponent");
    state.players.opponent.board.buildings[1] = building;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "building",
      instanceId: building.instanceId,
    });
    expect(result.ok).toBe(false);
  });
});

// makeState()'s player Hero is Fighter, whose Passive gives friendly
// creatures +1 Attack (DESIGN.md §9) — every expected value below already
// includes that +1 on top of the mechanic actually under test.
describe("Flank", () => {
  it("grants its bonus while in column 1 (index 0)", () => {
    const state = makeState();
    const scout = createCardInstance("flankguard-outrider", "player"); // base 2 attack, +2 flankBonus, +1 Fighter aura
    state.players.player.board.vanguard[0] = scout;
    expect(getEffectiveCreatureAttack(state, "player", scout)).toBe(5);
  });

  it("grants its bonus while in column 5 (index 4)", () => {
    const state = makeState();
    const scout = createCardInstance("flankguard-outrider", "player");
    state.players.player.board.vanguard[4] = scout;
    expect(getEffectiveCreatureAttack(state, "player", scout)).toBe(5);
  });

  it("does not grant its bonus in a middle column", () => {
    const state = makeState();
    const scout = createCardInstance("flankguard-outrider", "player");
    state.players.player.board.vanguard[2] = scout;
    expect(getEffectiveCreatureAttack(state, "player", scout)).toBe(3);
  });
});

describe("Formation", () => {
  it("grants its bonus while an ally occupies an adjacent column", () => {
    const state = makeState();
    const veteran = createCardInstance("shieldwall-veteran", "player"); // base 2 attack, +2 formationBonus, +1 Fighter aura
    state.players.player.board.vanguard[1] = veteran;
    // Formation is type-conditional now (DESIGN.md §17) — needs another Defender neighbor, not just any ally.
    state.players.player.board.vanguard[2] = createCardInstance("shield-bearer", "player");
    expect(getEffectiveCreatureAttack(state, "player", veteran)).toBe(5);
  });

  it("does not grant its bonus with no adjacent ally", () => {
    const state = makeState();
    const veteran = createCardInstance("shieldwall-veteran", "player");
    state.players.player.board.vanguard[1] = veteran;
    expect(getEffectiveCreatureAttack(state, "player", veteran)).toBe(3);
  });

  it("does not crash when sitting in the leftmost column (no left neighbor to read)", () => {
    const state = makeState();
    const veteran = createCardInstance("shieldwall-veteran", "player");
    state.players.player.board.vanguard[0] = veteran;
    expect(getEffectiveCreatureAttack(state, "player", veteran)).toBe(3);
  });

  it("does not crash when sitting in the rightmost column (no right neighbor to read)", () => {
    const state = makeState();
    const veteran = createCardInstance("shieldwall-veteran", "player");
    const lastColumn = state.players.player.board.vanguard.length - 1;
    state.players.player.board.vanguard[lastColumn] = veteran;
    expect(getEffectiveCreatureAttack(state, "player", veteran)).toBe(3);
  });

  it("still grants its bonus from a same-row ally when sitting in the leftmost column", () => {
    const state = makeState();
    const veteran = createCardInstance("shieldwall-veteran", "player");
    state.players.player.board.vanguard[0] = veteran;
    state.players.player.board.vanguard[1] = createCardInstance("shield-bearer", "player");
    expect(getEffectiveCreatureAttack(state, "player", veteran)).toBe(5);
  });
});

describe("Push", () => {
  it("shoves a surviving enemy Vanguard defender back into Support when that slot is empty", () => {
    const state = makeState();
    const brute = createCardInstance("shieldbreaker-brute", "player"); // push, 4 attack
    brute.summonedTurn = 0;
    state.players.player.board.vanguard[0] = brute;
    const defender = createCardInstance("stone-golem", "opponent"); // 4 attack / 7 HP — survives 4 damage
    state.players.opponent.board.vanguard[0] = defender;

    declareCreatureAttack(state, "player", brute.instanceId, { type: "creature", instanceId: defender.instanceId });
    expect(state.players.opponent.board.vanguard[0]).toBeNull();
    expect(state.players.opponent.board.support[0]?.instanceId).toBe(defender.instanceId);
  });

  it("does not push if the column's Support slot is already occupied", () => {
    const state = makeState();
    const brute = createCardInstance("shieldbreaker-brute", "player");
    brute.summonedTurn = 0;
    state.players.player.board.vanguard[0] = brute;
    const defender = createCardInstance("stone-golem", "opponent");
    state.players.opponent.board.vanguard[0] = defender;
    state.players.opponent.board.support[0] = createCardInstance("footman", "opponent");

    declareCreatureAttack(state, "player", brute.instanceId, { type: "creature", instanceId: defender.instanceId });
    expect(state.players.opponent.board.vanguard[0]?.instanceId).toBe(defender.instanceId);
  });

  it("does not push a defender that died to the hit", () => {
    const state = makeState();
    const brute = createCardInstance("shieldbreaker-brute", "player");
    brute.summonedTurn = 0;
    state.players.player.board.vanguard[0] = brute;
    const defender = createCardInstance("footman", "opponent"); // 3 HP, dies to 4 damage
    state.players.opponent.board.vanguard[0] = defender;

    declareCreatureAttack(state, "player", brute.instanceId, { type: "creature", instanceId: defender.instanceId });
    expect(state.players.opponent.board.vanguard[0]).toBeNull();
    expect(state.players.opponent.board.support[0]).toBeNull();
    expect(state.players.opponent.graveyard).toContain(defender);
  });
});

describe("Advance", () => {
  // No shipped card currently carries the "advance" keyword (Vanguard Scout,
  // the sole exemplar, was removed from the card pool) — the mechanism
  // itself is still fully built and tested here via a test-only definition,
  // the same pattern used elsewhere for a keyword/effect with no live card.
  const testScoutId = "test-advance-scout";
  beforeEach(() => {
    CARD_DEFINITIONS[testScoutId] = {
      id: testScoutId,
      name: "Test Advance Scout",
      archetype: "creature",
      cost: 2,
      rarity: "common",
      attack: 2,
      hp: 3,
      keywords: ["advance"],
      triggers: [],
    };
  });
  afterEach(() => {
    delete CARD_DEFINITIONS[testScoutId];
  });

  it("moves an Advance-keyword Support creature into the same-column empty Vanguard slot", () => {
    const state = makeState();
    const scout = createCardInstance(testScoutId, "player");
    scout.summonedTurn = 0;
    state.players.player.board.support[2] = scout;
    const energyBefore = state.players.player.energy.current;

    const result = declareAdvance(state, "player", scout.instanceId);
    expect(result.ok).toBe(true);
    expect(state.players.player.board.support[2]).toBeNull();
    expect(state.players.player.board.vanguard[2]?.instanceId).toBe(scout.instanceId);
    expect(state.players.player.energy.current).toBe(energyBefore - 1);
    expect(scout.hasAttackedThisTurn).toBe(true);
  });

  it("fails for a creature without the Advance keyword", () => {
    const state = makeState();
    const footman = createCardInstance("footman", "player");
    footman.summonedTurn = 0;
    state.players.player.board.support[0] = footman;

    const result = declareAdvance(state, "player", footman.instanceId);
    expect(result.ok).toBe(false);
  });

  it("fails when the same-column Vanguard slot is occupied", () => {
    const state = makeState();
    const scout = createCardInstance(testScoutId, "player");
    scout.summonedTurn = 0;
    state.players.player.board.support[0] = scout;
    state.players.player.board.vanguard[0] = createCardInstance("footman", "player");

    const result = declareAdvance(state, "player", scout.instanceId);
    expect(result.ok).toBe(false);
  });

  it("fails for a creature that already acted this turn", () => {
    const state = makeState();
    const scout = createCardInstance(testScoutId, "player");
    scout.summonedTurn = 0;
    scout.hasAttackedThisTurn = true;
    state.players.player.board.support[0] = scout;

    const result = declareAdvance(state, "player", scout.instanceId);
    expect(result.ok).toBe(false);
  });
});

describe("Protector", () => {
  it("redirects a lethal attack onto a same-row Protector instead of the original target", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player"); // 2 attack
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    const weakling = createCardInstance("apprentice-mage", "opponent"); // 1/3 — dies to 2 damage? no, 3 HP survives 2. Use lower HP.
    weakling.currentHp = 1; // force it to die to a 2-damage hit
    const protector = createCardInstance("shield-sister", "opponent"); // protector, 6 HP
    state.players.opponent.board.vanguard[1] = weakling;
    state.players.opponent.board.vanguard[2] = protector;

    declareCreatureAttack(state, "player", attacker.instanceId, { type: "creature", instanceId: weakling.instanceId });
    expect(weakling.currentHp).toBe(1); // untouched — the hit was redirected
    expect(protector.currentHp).toBeLessThan(6); // took the damage instead
  });

  it("does not redirect when the original target would survive the hit anyway", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player"); // 2 attack
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    const sturdy = createCardInstance("stone-golem", "opponent"); // 7 HP, survives 2 damage easily
    const protector = createCardInstance("shield-sister", "opponent");
    state.players.opponent.board.vanguard[1] = sturdy;
    state.players.opponent.board.vanguard[2] = protector;

    declareCreatureAttack(state, "player", attacker.instanceId, { type: "creature", instanceId: sturdy.instanceId });
    expect(sturdy.currentHp).toBeLessThan(7); // took the damage itself
    expect(protector.currentHp).toBe(6); // untouched
  });

  it("does not redirect when there is no Protector in the row", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    const weakling = createCardInstance("apprentice-mage", "opponent");
    weakling.currentHp = 1;
    state.players.opponent.board.vanguard[1] = weakling;

    declareCreatureAttack(state, "player", attacker.instanceId, { type: "creature", instanceId: weakling.instanceId });
    expect(weakling.currentHp).toBeLessThanOrEqual(0);
  });
});

describe("Spell forms (DESIGN.md §1a)", () => {
  it("an Instant Spell casts straight from hand, resolves immediately, and goes to discard — never a slot, never the graveyard", () => {
    // Fireball is Charged now (DESIGN.md §17) — none of the built-in Instant
    // Spells deal damage, so a synthetic one exercises the Instant path itself.
    const testSpellId = "test-instant-fireball";
    CARD_DEFINITIONS[testSpellId] = {
      id: testSpellId,
      name: "Test Instant Fireball",
      archetype: "spell",
      spellForm: "instant",
      cost: 4,
      rarity: "rare",
      effect: { kind: "damage", amount: 4, target: "targetAny" },
    };
    try {
      const state = makeState(); // player = Fighter, no spell discount
      const fireball = createCardInstance(testSpellId, "player");
      state.players.player.hand.push(fireball);
      const target = createCardInstance("hill-giant", "opponent"); // 9 HP
      state.players.opponent.board.vanguard[0] = target;

      const result = playCardFromHand(state, "player", fireball.instanceId, {
        target: { kind: "card", owner: "opponent", instanceId: target.instanceId },
      });
      expect(result.ok).toBe(true);
      expect(state.players.player.mana.current).toBe(1); // 5 - 4 cost
      expect(state.players.player.board.spellAbilitySlots.every((c) => c === null)).toBe(true);
      expect(state.players.player.discard).toContain(fireball);
      expect(state.players.player.graveyard).not.toContain(fireball);
      expect(target.currentHp).toBe(5); // 9 - 4
    } finally {
      delete CARD_DEFINITIONS[testSpellId];
    }
  });

  it("a Ritual/Charged Spell still goes into a slot and is activated separately, unaffected by the Instant path", () => {
    const state = makeState();
    const bolt = createCardInstance("lightning-bolt", "player"); // charged, cost 2, activateCost 2, 2 charges
    state.players.player.hand.push(bolt);

    const playResult = playCardFromHand(state, "player", bolt.instanceId);
    expect(playResult.ok).toBe(true);
    expect(state.players.player.board.spellAbilitySlots[0]?.instanceId).toBe(bolt.instanceId);
    expect(state.players.player.mana.current).toBe(3); // 5 - 2 cost

    const target = createCardInstance("hill-giant", "opponent");
    state.players.opponent.board.vanguard[0] = target;
    const activateResult = activateSlotCard(state, "player", 0, { kind: "card", owner: "opponent", instanceId: target.instanceId });
    expect(activateResult.ok).toBe(true);
    expect(state.players.player.mana.current).toBe(1); // 3 - 2 activateCost
    expect(bolt.chargesRemaining).toBe(1);
    expect(target.currentHp).toBe(6); // 9 - 3
  });
});

describe("Hero Passive/Power/Signature (DESIGN.md §9)", () => {
  it("Fighter's auraBuff Passive gives friendly creatures +1 Attack live, without touching HP", () => {
    const state = makeState(); // player = Fighter
    const footman = createCardInstance("footman", "player"); // base 2 attack
    state.players.player.board.vanguard[0] = footman;
    expect(getEffectiveCreatureAttack(state, "player", footman)).toBe(3);
    expect(footman.currentHp).toBe(3); // footman's base HP, untouched by an Attack-only aura
  });

  it("Mage's firstSpellDiscount Passive discounts only the first Spell activation each turn, then resets next turn", () => {
    const state = createInitialGameState("mage", [], "fighter", []);
    const bolt1 = createCardInstance("lightning-bolt", "player");
    const bolt2 = createCardInstance("lightning-bolt", "player");
    state.players.player.board.spellAbilitySlots[0] = bolt1;
    state.players.player.board.spellAbilitySlots[1] = bolt2;

    const first = activateSlotCard(state, "player", 0, null);
    expect(first.ok).toBe(true);
    expect(state.players.player.mana.current).toBe(4); // 5 - (2 activateCost - 1 discount)

    const second = activateSlotCard(state, "player", 1, null);
    expect(second.ok).toBe(true);
    expect(state.players.player.mana.current).toBe(2); // 4 - 2 — discount already used this turn

    state.turnNumber = 2;
    startTurn(state);
    expect(state.players.player.hero.firstSpellDiscountUsedThisTurn).toBe(false);
  });

  it("Hero Power costs Energy, resolves its effect, and is usable only once per turn — resetting on the next startTurn", () => {
    const state = makeState(); // Fighter's Hero Power: gain 2 Guard for 2 Energy
    const startingGuard = state.players.player.guard.current;

    const first = activateHeroPower(state, "player");
    expect(first.ok).toBe(true);
    expect(state.players.player.energy.current).toBe(3); // 5 - 2
    expect(state.players.player.guard.current).toBe(startingGuard + 2);

    const second = activateHeroPower(state, "player");
    expect(second.ok).toBe(false);

    state.turnNumber = 2;
    startTurn(state);
    const third = activateHeroPower(state, "player");
    expect(third.ok).toBe(true);
  });

  it("Signature Ability is gated to a limited number of uses for the whole match, and does NOT reset on startTurn", () => {
    const state = makeState(); // Fighter's Signature: 3 Energy, 2 uses/match
    expect(state.players.player.hero.signatureUsesRemaining).toBe(2);

    const first = activateHeroSignature(state, "player");
    expect(first.ok).toBe(true);
    expect(state.players.player.hero.signatureUsesRemaining).toBe(1);

    state.turnNumber = 2;
    startTurn(state);
    expect(state.players.player.hero.signatureUsesRemaining).toBe(1); // unaffected by the turn reset

    const second = activateHeroSignature(state, "player");
    expect(second.ok).toBe(true);
    expect(state.players.player.hero.signatureUsesRemaining).toBe(0);

    const third = activateHeroSignature(state, "player");
    expect(third.ok).toBe(false);
  });
});

describe("Vanish (DESIGN.md §7/§17)", () => {
  it("cannot be chosen as the target of an enemy attack", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    const stalker = createCardInstance("shadow-stalker", "opponent");
    state.players.opponent.board.vanguard[0] = stalker;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "creature",
      instanceId: stalker.instanceId,
    });
    expect(result.ok).toBe(false);
  });

  it("is NOT lost once the Vanished creature attacks — unlike the old Stealth, there's no break-on-attack condition", () => {
    const state = makeState();
    const stalker = createCardInstance("shadow-stalker", "player");
    stalker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = stalker;
    const bystander = createCardInstance("footman", "opponent");
    state.players.opponent.board.vanguard[1] = bystander;

    declareCreatureAttack(state, "player", stalker.instanceId, { type: "player" });

    // Still untargetable, from the opponent's side.
    const counterAttacker = createCardInstance("footman", "opponent");
    counterAttacker.summonedTurn = 0;
    state.players.opponent.board.vanguard[2] = counterAttacker;
    const result = declareCreatureAttack(state, "opponent", counterAttacker.instanceId, {
      type: "creature",
      instanceId: stalker.instanceId,
    });
    expect(result.ok).toBe(false);
  });

  it("blocks a targeted Spell effect but not an AOE effect", () => {
    const state = makeState();
    const stalker = createCardInstance("shadow-stalker", "opponent");
    state.players.opponent.board.vanguard[0] = stalker;

    resolveEffect(
      state,
      "player",
      { kind: "damage", amount: 5, target: "targetCreature" },
      { kind: "card", owner: "opponent", instanceId: stalker.instanceId },
      "spell",
    );
    expect(stalker.currentHp).toBe(2); // untouched — base HP, the hit was blocked

    resolveEffect(state, "player", { kind: "damage", amount: 1, target: "allEnemyCreatures" }, null, "spell");
    expect(stalker.currentHp).toBe(1); // AOE still lands
  });

  it("Cloak of Shadows grants the Hero Vanish, blocking a targeted attack against them", () => {
    const state = makeState();
    const cloak = createCardInstance("cloak-of-shadows", "opponent");
    cloak.equipmentBearer = { kind: "hero" };
    state.players.opponent.board.equipment[0] = cloak;

    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, { type: "player" });
    expect(result.ok).toBe(false);
  });
});

describe("Ward (DESIGN.md §7)", () => {
  it("negates the next hostile targeted Spell/Ability hit, then is consumed", () => {
    const state = makeState();
    const acolyte = createCardInstance("warded-acolyte", "opponent");
    state.players.opponent.board.vanguard[0] = acolyte;

    resolveEffect(
      state,
      "player",
      { kind: "damage", amount: 2, target: "targetCreature" },
      { kind: "card", owner: "opponent", instanceId: acolyte.instanceId },
      "spell",
    );
    expect(acolyte.currentHp).toBe(3); // untouched — Ward ate the hit
    expect(acolyte.wardConsumed).toBe(true);

    resolveEffect(
      state,
      "player",
      { kind: "damage", amount: 2, target: "targetCreature" },
      { kind: "card", owner: "opponent", instanceId: acolyte.instanceId },
      "spell",
    );
    expect(acolyte.currentHp).toBe(1); // Ward already spent — this one lands
  });
});

describe("Cleave (DESIGN.md §7)", () => {
  it("also damages enemy creatures in adjacent columns, same row as the primary target", () => {
    const state = makeState();
    const brawler = createCardInstance("warhammer-brawler", "player"); // 3 attack, cleave
    brawler.summonedTurn = 0;
    state.players.player.board.vanguard[0] = brawler;

    const primary = createCardInstance("stone-golem", "opponent"); // 7 HP, survives 4 (3 base + 1 Fighter aura)
    const leftFlank = createCardInstance("stone-golem", "opponent");
    const rightFlank = createCardInstance("stone-golem", "opponent");
    const untouched = createCardInstance("stone-golem", "opponent");
    state.players.opponent.board.vanguard[0] = leftFlank;
    state.players.opponent.board.vanguard[1] = primary;
    state.players.opponent.board.vanguard[2] = rightFlank;
    state.players.opponent.board.vanguard[4] = untouched; // column 3 is empty — not adjacent to anything

    declareCreatureAttack(state, "player", brawler.instanceId, { type: "creature", instanceId: primary.instanceId });
    // 7 - (3 base + 1 Fighter aura - 1 Resistant) = 4 — Stone Golem's own Resistant (DESIGN.md §17) applies to the splash hit too.
    expect(leftFlank.currentHp).toBe(4);
    expect(rightFlank.currentHp).toBe(4);
    expect(untouched.currentHp).toBe(7); // out of splash range, untouched
  });
});

describe("Drain (DESIGN.md §7)", () => {
  it("restores the attacker's controller's Guard, capped at max, on combat damage dealt", () => {
    const state = makeState();
    const leech = createCardInstance("blood-leech", "player"); // 2 attack, drain
    leech.summonedTurn = 0;
    state.players.player.board.vanguard[0] = leech;
    state.players.player.guard.current = 50; // damaged below max (100) so restoration is visible

    declareCreatureAttack(state, "player", leech.instanceId, { type: "player" });
    // Fighter's +1 aura makes this 3 Attack, not 2 — restored Guard should match the actual damage dealt.
    expect(state.players.player.guard.current).toBe(53);
  });

  it("does not overflow past the current Guard max", () => {
    const state = makeState();
    const leech = createCardInstance("blood-leech", "player");
    leech.summonedTurn = 0;
    state.players.player.board.vanguard[0] = leech;
    state.players.player.guard.current = state.players.player.guard.max; // already full

    declareCreatureAttack(state, "player", leech.instanceId, { type: "player" });
    expect(state.players.player.guard.current).toBe(state.players.player.guard.max);
  });
});

describe("Summon (DESIGN.md §7 — summonCreature effect)", () => {
  it("creates a copy of the named creature in an open Vanguard slot", () => {
    const state = makeState();
    resolveEffect(state, "player", { kind: "summonCreature", creatureId: "militia-recruit" }, null);
    const summoned = state.players.player.board.vanguard[0];
    expect(summoned?.defId).toBe("militia-recruit");
    expect(summoned?.summonedTurn).toBe(state.turnNumber); // has summoning sickness like any other freshly-played creature
  });

  it("falls back to Support when Vanguard is full", () => {
    const state = makeState();
    for (let i = 0; i < state.players.player.board.vanguard.length; i++) {
      state.players.player.board.vanguard[i] = createCardInstance("footman", "player");
    }
    resolveEffect(state, "player", { kind: "summonCreature", creatureId: "militia-recruit" }, null);
    expect(state.players.player.board.support[0]?.defId).toBe("militia-recruit");
  });

  it("fizzles without crashing when neither row has room", () => {
    const state = makeState();
    for (const row of [state.players.player.board.vanguard, state.players.player.board.support]) {
      for (let i = 0; i < row.length; i++) row[i] = createCardInstance("footman", "player");
    }
    expect(() => resolveEffect(state, "player", { kind: "summonCreature", creatureId: "militia-recruit" }, null)).not.toThrow();
  });

  it("fires via Spider Matriarch's onDeath trigger", () => {
    const state = makeState();
    const matriarch = createCardInstance("spider-matriarch", "player");
    matriarch.currentHp = 1;
    state.players.player.board.vanguard[0] = matriarch;

    damageCard(state, "player", matriarch.instanceId, 99);
    expect(state.players.player.graveyard).toContain(matriarch);
    // Matriarch's own slot clears before onDeath fires, so the Summon lands
    // right back in the now-open column 0 rather than needing a new one.
    expect(state.players.player.board.vanguard[0]?.defId).toBe("militia-recruit");
  });
});

describe("Buildings as objects (Phase E, DESIGN.md §11)", () => {
  it("a Building's auraBuff passive raises the attack of matching friendly creatures", () => {
    const state = makeState();
    const matriarch = createCardInstance("spider-matriarch", "player"); // race: beast
    state.players.player.board.vanguard[0] = matriarch;
    const before = getEffectiveCreatureAttack(state, "player", matriarch);

    const den = createCardInstance("beast-den", "player"); // Passive: Beast creatures +2 Attack
    state.players.player.board.buildings[0] = den;
    const after = getEffectiveCreatureAttack(state, "player", matriarch);

    expect(after).toBe(before + 2);
  });

  it("does not buff a friendly creature that doesn't match the passive's race filter", () => {
    const state = makeState();
    const footman = createCardInstance("footman", "player"); // no race
    state.players.player.board.vanguard[0] = footman;
    const before = getEffectiveCreatureAttack(state, "player", footman);

    const den = createCardInstance("beast-den", "player");
    state.players.player.board.buildings[0] = den;
    const after = getEffectiveCreatureAttack(state, "player", footman);

    expect(after).toBe(before);
  });

  it("activateBuildingAbility spends the ability's configured pool (Mana for Demon Gate) and resolves its effect", () => {
    const state = makeState();
    const gate = createCardInstance("demon-gate", "player"); // Activate (3 Mana): summon a Flame Imp
    state.players.player.board.buildings[0] = gate;
    state.players.player.mana.current = 5;

    const result = activateBuildingAbility(state, "player", 0);
    expect(result.ok).toBe(true);
    expect(state.players.player.mana.current).toBe(2); // 5 - 3
    const board = state.players.player.board;
    const summoned = [...board.vanguard, ...board.support].filter((c) => c?.defId === "flame-imp");
    expect(summoned).toHaveLength(1);
  });

  it("has no usage cap — stays activatable every time it's affordable, unlike Hero Power's once-per-turn limit", () => {
    const state = makeState();
    const gate = createCardInstance("demon-gate", "player");
    state.players.player.board.buildings[0] = gate;
    state.players.player.mana.current = 10;

    const first = activateBuildingAbility(state, "player", 0);
    expect(first.ok).toBe(true);
    expect(state.players.player.mana.current).toBe(7);

    const second = activateBuildingAbility(state, "player", 0);
    expect(second.ok).toBe(true);
    expect(state.players.player.mana.current).toBe(4);

    const board = state.players.player.board;
    const summoned = [...board.vanguard, ...board.support].filter((c) => c?.defId === "flame-imp");
    expect(summoned).toHaveLength(2);
  });

  it("defaults to the Resources pool for a Building whose ability omits `pool`", () => {
    const state = makeState();
    const testDefId = "test-resource-building";
    CARD_DEFINITIONS[testDefId] = {
      id: testDefId,
      name: "Test Resource Building",
      archetype: "building",
      cost: 1,
      rarity: "common",
      hp: 3,
      triggers: [],
      ability: { effect: { kind: "gainGuard", amount: 1 }, activateCost: 2 },
    };
    try {
      const building = createCardInstance(testDefId, "player");
      state.players.player.board.buildings[0] = building;
      state.players.player.resources.current = 5;
      const startingGuard = state.players.player.guard.current;

      const result = activateBuildingAbility(state, "player", 0);
      expect(result.ok).toBe(true);
      expect(state.players.player.resources.current).toBe(3); // 5 - 2, defaulted to Resources
      expect(state.players.player.guard.current).toBe(startingGuard + 1);
    } finally {
      delete CARD_DEFINITIONS[testDefId];
    }
  });

  it("rejects activation when the configured pool can't afford the cost", () => {
    const state = makeState();
    const gate = createCardInstance("demon-gate", "player");
    state.players.player.board.buildings[0] = gate;
    state.players.player.mana.current = 2; // needs 3

    const result = activateBuildingAbility(state, "player", 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Mana/);
    expect(state.players.player.mana.current).toBe(2); // unchanged
  });

  it("rejects activation on a Building with no activated ability", () => {
    const state = makeState();
    const den = createCardInstance("beast-den", "player"); // passive only, no ability
    state.players.player.board.buildings[0] = den;

    const result = activateBuildingAbility(state, "player", 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no activated ability/i);
  });

  it("rejects activation when the targeted slot has no Building", () => {
    const state = makeState();
    const result = activateBuildingAbility(state, "player", 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/No Building/i);
  });
});

describe("Equipment (DESIGN.md §12)", () => {
  it("the Hero is always an eligible bearer — assigning a Weapon costs 1 Energy and lets it attack", () => {
    const state = makeState();
    const sword = createCardInstance("iron-sword", "player");
    state.players.player.board.equipment[0] = sword;
    expect(heroCanAttack(state, "player")).toBe(false);

    const result = assignEquipment(state, "player", 0, { kind: "hero" });
    expect(result.ok).toBe(true);
    expect(state.players.player.energy.current).toBe(4); // 5 - 1
    expect(heroCanAttack(state, "player")).toBe(true);
  });

  it("Armor alone does not unlock the Hero's attack — only a Weapon-category item does", () => {
    const state = makeState();
    const shield = createCardInstance("battle-shield", "player"); // armor, damageReduction only
    state.players.player.board.equipment[0] = shield;

    const result = assignEquipment(state, "player", 0, { kind: "hero" });
    expect(result.ok).toBe(true);
    expect(heroCanAttack(state, "player")).toBe(false);
  });

  it("rejects a creature bearer that doesn't have the Armiger keyword", () => {
    const state = makeState();
    const footman = createCardInstance("footman", "player"); // no Armiger
    state.players.player.board.vanguard[0] = footman;
    const sword = createCardInstance("iron-sword", "player");
    state.players.player.board.equipment[0] = sword;

    const result = assignEquipment(state, "player", 0, { kind: "creature", instanceId: footman.instanceId });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Armiger/);
  });

  it("accepts an Armiger creature as a bearer", () => {
    const state = makeState();
    const squire = createCardInstance("royal-squire", "player"); // has Armiger
    state.players.player.board.vanguard[0] = squire;
    const barding = createCardInstance("steel-barding", "player");
    state.players.player.board.equipment[0] = barding;

    const result = assignEquipment(state, "player", 0, { kind: "creature", instanceId: squire.instanceId });
    expect(result.ok).toBe(true);
  });

  it("rejects assignment when Energy can't afford the 1-Energy cost", () => {
    const state = makeState();
    state.players.player.energy.current = 0;
    const sword = createCardInstance("iron-sword", "player");
    state.players.player.board.equipment[0] = sword;

    const result = assignEquipment(state, "player", 0, { kind: "hero" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Energy/);
  });

  it("auto-bumps whatever a bearer already held back to Unassigned when a different item is assigned to them", () => {
    const state = makeState();
    const sword = createCardInstance("iron-sword", "player");
    const cloak = createCardInstance("cloak-of-shadows", "player");
    state.players.player.board.equipment[0] = sword;
    state.players.player.board.equipment[1] = cloak;

    assignEquipment(state, "player", 0, { kind: "hero" });
    expect(sword.equipmentBearer).toEqual({ kind: "hero" });

    assignEquipment(state, "player", 1, { kind: "hero" });
    expect(cloak.equipmentBearer).toEqual({ kind: "hero" });
    expect(sword.equipmentBearer).toBeNull(); // bumped, not destroyed — still sitting in the zone
    expect(state.players.player.board.equipment[0]).toBe(sword);
  });

  it("an Armiger creature's equipped Weapon raises its effective Attack", () => {
    const state = makeState();
    const squire = createCardInstance("royal-squire", "player");
    state.players.player.board.vanguard[0] = squire;
    const before = getEffectiveCreatureAttack(state, "player", squire);

    const sword = createCardInstance("iron-sword", "player"); // +2 Attack
    state.players.player.board.equipment[0] = sword;
    assignEquipment(state, "player", 0, { kind: "creature", instanceId: squire.instanceId });

    expect(getEffectiveCreatureAttack(state, "player", squire)).toBe(before + 2);
  });

  it("an Armiger creature's equipped Armor reduces damage it takes", () => {
    const state = makeState();
    const squire = createCardInstance("royal-squire", "player");
    state.players.player.board.vanguard[0] = squire;
    const barding = createCardInstance("steel-barding", "player"); // damageReduction 2
    state.players.player.board.equipment[0] = barding;
    assignEquipment(state, "player", 0, { kind: "creature", instanceId: squire.instanceId });

    const startingHp = squire.currentHp ?? 0;
    const dealt = damageCard(state, "player", squire.instanceId, 5);
    expect(dealt).toBe(3); // 5 - 2
    expect(squire.currentHp).toBe(startingHp - 3);
  });

  it("equipment survives its bearer's death, returning to Unassigned rather than being destroyed", () => {
    const state = makeState();
    const squire = createCardInstance("royal-squire", "player");
    squire.currentHp = 1;
    state.players.player.board.vanguard[0] = squire;
    const barding = createCardInstance("steel-barding", "player");
    state.players.player.board.equipment[0] = barding;
    assignEquipment(state, "player", 0, { kind: "creature", instanceId: squire.instanceId });

    damageCard(state, "player", squire.instanceId, 99);
    expect(state.players.player.graveyard).toContain(squire);
    expect(state.players.player.board.equipment[0]).toBe(barding); // still in the zone
    expect(barding.equipmentBearer).toBeNull(); // Unassigned, not gone
  });

  it("Drain restores Guard matching the actual post-Armor damage dealt, not the raw attack", () => {
    const state = makeState();
    const leech = createCardInstance("blood-leech", "player"); // 2 attack, drain
    leech.summonedTurn = 0;
    state.players.player.board.vanguard[0] = leech;
    state.players.player.guard.current = 50; // below max so restoration is visible

    const barding = createCardInstance("steel-barding", "opponent"); // damageReduction 2, on the target's Hero
    state.players.opponent.board.equipment[0] = barding;
    assignEquipment(state, "opponent", 0, { kind: "hero" });

    const attack = getEffectiveCreatureAttack(state, "player", leech); // 3 with Fighter's +1 aura
    declareCreatureAttack(state, "player", leech.instanceId, { type: "player" });
    expect(state.players.player.guard.current).toBe(50 + (attack - 2)); // matches the reduced damage, not the raw attack
  });

  it("getHeroAttack folds in the Hero's equipped Weapon's attackBonus", () => {
    const state = makeState();
    const sword = createCardInstance("iron-sword", "player"); // +2 Attack
    state.players.player.board.equipment[0] = sword;
    assignEquipment(state, "player", 0, { kind: "hero" });

    expect(getHeroAttack(state, "player")).toBe(state.players.player.hero.baseAttack + 2);
  });
});

describe("Swarm (DESIGN.md §16 — summonCreature's count field)", () => {
  it("creates several copies at once", () => {
    const state = makeState();
    resolveEffect(state, "player", { kind: "summonCreature", creatureId: "militia-recruit", count: 3 }, null);
    const summoned = state.players.player.board.vanguard.filter((c) => c?.defId === "militia-recruit");
    expect(summoned).toHaveLength(3);
  });

  it("summons as many as fit, then stops, when the board runs out of room partway through", () => {
    const state = makeState();
    const board = state.players.player.board;
    for (let i = 0; i < board.vanguard.length; i++) board.vanguard[i] = createCardInstance("footman", "player");
    for (let i = 0; i < board.support.length - 1; i++) board.support[i] = createCardInstance("footman", "player");
    // Exactly one open slot left on the whole board (the last Support slot).

    resolveEffect(state, "player", { kind: "summonCreature", creatureId: "militia-recruit", count: 3 }, null);
    const summoned = [...board.vanguard, ...board.support].filter((c) => c?.defId === "militia-recruit");
    expect(summoned).toHaveLength(1);
  });
});

describe("Consume (DESIGN.md §16)", () => {
  it("destroys the targeted ally — bypassing its Armor entirely, since it's a self-inflicted sacrifice — and buffs every other friendly creature", () => {
    const state = makeState();
    const squire = createCardInstance("royal-squire", "player"); // Armiger
    state.players.player.board.vanguard[0] = squire;
    const barding = createCardInstance("steel-barding", "player"); // damageReduction 2
    state.players.player.board.equipment[0] = barding;
    assignEquipment(state, "player", 0, { kind: "creature", instanceId: squire.instanceId });

    const other = createCardInstance("footman", "player");
    state.players.player.board.vanguard[1] = other;

    resolveEffect(
      state,
      "player",
      { kind: "consume", target: "targetCreature", attackDelta: 1, hpDelta: 1 },
      { kind: "card", owner: "player", instanceId: squire.instanceId },
    );

    expect(state.players.player.graveyard).toContain(squire); // destroyed outright, Armor didn't save it
    expect(other.attackDelta).toBe(1);
    expect(other.hpDelta).toBe(1);
  });

  it("fizzles without crashing when there's no target", () => {
    const state = makeState();
    const footman = createCardInstance("footman", "player");
    state.players.player.board.vanguard[0] = footman;
    expect(() =>
      resolveEffect(state, "player", { kind: "consume", target: "targetCreature", attackDelta: 1, hpDelta: 1 }, null),
    ).not.toThrow();
    expect(footman.attackDelta).toBe(0);
  });
});

describe("Transformation (DESIGN.md §16)", () => {
  it("replaces the creature in place, preserving its exhaustion state and statuses", () => {
    const state = makeState();
    const footman = createCardInstance("footman", "player");
    footman.hasAttackedThisTurn = true;
    footman.statuses = [{ type: "poison", amount: 3 }];
    state.players.player.board.vanguard[2] = footman;

    resolveEffect(
      state,
      "player",
      { kind: "transform", target: "targetCreature", creatureId: "flame-imp" },
      { kind: "card", owner: "player", instanceId: footman.instanceId },
    );

    const transformed = state.players.player.board.vanguard[2];
    expect(transformed?.defId).toBe("flame-imp");
    expect(transformed?.instanceId).not.toBe(footman.instanceId);
    expect(transformed?.hasAttackedThisTurn).toBe(true);
    expect(transformed?.statuses).toEqual([{ type: "poison", amount: 3 }]);
  });

  it("fires the new form's onPlay trigger", () => {
    const state = makeState();
    const footman = createCardInstance("footman", "player");
    state.players.player.board.vanguard[0] = footman;
    const startingHeroHp = state.players.player.hero.currentHp;

    resolveEffect(
      state,
      "player",
      { kind: "transform", target: "targetCreature", creatureId: "flame-imp" }, // flame-imp: On Play, deal 2 to own Hero
      { kind: "card", owner: "player", instanceId: footman.instanceId },
    );

    expect(state.players.player.hero.currentHp).toBe(startingHeroHp - 2);
  });

  it("fizzles when the new (Massive) form has no contiguous room, leaving the original creature untouched", () => {
    const state = makeState();
    const board = state.players.player.board;
    const footman = createCardInstance("footman", "player");
    board.vanguard[0] = footman;
    for (let i = 1; i < board.vanguard.length; i++) board.vanguard[i] = createCardInstance("footman", "player");

    resolveEffect(
      state,
      "player",
      { kind: "transform", target: "targetCreature", creatureId: "alpha-wolf" }, // spaceCost 2
      { kind: "card", owner: "player", instanceId: footman.instanceId },
    );

    expect(board.vanguard[0]).toBe(footman); // unchanged — no room for a 2-slot form
  });
});

describe("Hero Rule-Breaks (DESIGN.md §9)", () => {
  it("resizes board arrays, pool caps, and starting Guard at match start", () => {
    const testHeroId = "test-rule-break-hero";
    CARD_DEFINITIONS[testHeroId] = {
      id: testHeroId,
      name: "Test Rule-Break Hero",
      archetype: "hero",
      cost: 0,
      rarity: "legendary",
      attack: 0,
      hp: 20,
      ruleBreaks: {
        vanguardSlotDelta: 1,
        supportSlotDelta: -1,
        extraBuildingSlots: 1,
        extraSpellAbilitySlots: 1,
        startingGuardDelta: 10,
        resourceCapDelta: 2,
        manaCapDelta: -1,
        energyCapDelta: 3,
      },
    };
    try {
      const state = createInitialGameState(testHeroId, [], "fighter", []);
      const player = state.players.player;
      expect(player.board.vanguard).toHaveLength(VANGUARD_SIZE + 1);
      expect(player.board.support).toHaveLength(SUPPORT_SIZE - 1);
      expect(player.board.buildings).toHaveLength(BUILDING_SLOTS + 1);
      expect(player.board.spellAbilitySlots).toHaveLength(SPELL_ABILITY_SLOTS + 1);
      expect(player.guard.current).toBe(STARTING_GUARD + 10);
      expect(player.guard.max).toBe(STARTING_GUARD + 10);
      expect(player.resources.cap).toBe(STARTING_POOL + 2);
      expect(player.mana.cap).toBe(STARTING_POOL - 1);
      expect(player.energy.cap).toBe(STARTING_POOL + 3);
    } finally {
      delete CARD_DEFINITIONS[testHeroId];
    }
  });

  it("a Hero with no ruleBreaks gets the standard shape", () => {
    const state = makeState();
    const player = state.players.player;
    expect(player.board.vanguard).toHaveLength(VANGUARD_SIZE);
    expect(player.board.support).toHaveLength(SUPPORT_SIZE);
    expect(player.board.buildings).toHaveLength(BUILDING_SLOTS);
    expect(player.board.spellAbilitySlots).toHaveLength(SPELL_ABILITY_SLOTS);
    expect(player.guard.current).toBe(STARTING_GUARD);
    expect(player.resources.cap).toBe(STARTING_POOL);
  });

  it("the shipped Grand Marshal Hero widens Vanguard and Support by 1 each", () => {
    const state = createInitialGameState("grand-marshal", [], "fighter", []);
    const player = state.players.player;
    expect(player.board.vanguard).toHaveLength(VANGUARD_SIZE + 1);
    expect(player.board.support).toHaveLength(SUPPORT_SIZE + 1);
    expect(player.board.buildings).toHaveLength(BUILDING_SLOTS);
    expect(player.board.spellAbilitySlots).toHaveLength(SPELL_ABILITY_SLOTS);
  });
});

describe("Bloodied (DESIGN.md §7)", () => {
  it("does not grant its bonus at full Health", () => {
    const state = makeState();
    const berserker = createCardInstance("wounded-berserker", "player"); // base 2 attack, +4 bloodiedBonus, +1 Fighter aura
    state.players.player.board.vanguard[0] = berserker;
    expect(getEffectiveCreatureAttack(state, "player", berserker)).toBe(3);
  });

  it("does not grant its bonus above half Health", () => {
    const state = makeState();
    const berserker = createCardInstance("wounded-berserker", "player");
    berserker.currentHp = 4; // 4/6 — above half
    state.players.player.board.vanguard[0] = berserker;
    expect(getEffectiveCreatureAttack(state, "player", berserker)).toBe(3);
  });

  it("grants its bonus at exactly half Health", () => {
    const state = makeState();
    const berserker = createCardInstance("wounded-berserker", "player");
    berserker.currentHp = 3; // 3/6 — exactly half
    state.players.player.board.vanguard[0] = berserker;
    expect(getEffectiveCreatureAttack(state, "player", berserker)).toBe(7);
  });

  it("grants its bonus below half Health, and still applies off-board", () => {
    const state = makeState();
    const berserker = createCardInstance("wounded-berserker", "player");
    berserker.currentHp = 1;
    expect(getEffectiveCreatureAttack(state, "player", berserker)).toBe(7);
  });
});

describe("Garrison (DESIGN.md §16)", () => {
  it("moves the targeted creature off the battlefield into the first friendly Building with room", () => {
    const state = makeState();
    const mine = createCardInstance("gold-mine", "player");
    state.players.player.board.buildings[0] = mine;
    const footman = createCardInstance("footman", "player");
    state.players.player.board.vanguard[0] = footman;

    resolveEffect(
      state,
      "player",
      { kind: "garrison", target: "targetCreature" },
      { kind: "card", owner: "player", instanceId: footman.instanceId },
    );

    expect(state.players.player.board.vanguard).not.toContain(footman);
    expect(state.players.player.board.support).not.toContain(footman);
    expect(mine.garrisonedCreature).toBe(footman);
  });

  it("fizzles without crashing when there's no target", () => {
    const state = makeState();
    const mine = createCardInstance("gold-mine", "player");
    state.players.player.board.buildings[0] = mine;
    expect(() => resolveEffect(state, "player", { kind: "garrison", target: "targetCreature" }, null)).not.toThrow();
    expect(mine.garrisonedCreature).toBeUndefined();
  });

  it("fizzles when no friendly Building has an open housing slot", () => {
    const state = makeState();
    const mine = createCardInstance("gold-mine", "player");
    mine.garrisonedCreature = createCardInstance("footman", "player"); // already housing someone
    state.players.player.board.buildings[0] = mine;
    const footman = createCardInstance("footman", "player");
    state.players.player.board.vanguard[0] = footman;

    resolveEffect(
      state,
      "player",
      { kind: "garrison", target: "targetCreature" },
      { kind: "card", owner: "player", instanceId: footman.instanceId },
    );

    expect(state.players.player.board.vanguard[0]).toBe(footman); // untouched — no room to garrison into
  });

  it("ejects the garrisoned creature back onto the battlefield when its Building is destroyed and there's room", () => {
    const state = makeState();
    const mine = createCardInstance("gold-mine", "player");
    state.players.player.board.buildings[0] = mine;
    const footman = createCardInstance("footman", "player");
    state.players.player.board.vanguard[0] = footman;
    resolveEffect(
      state,
      "player",
      { kind: "garrison", target: "targetCreature" },
      { kind: "card", owner: "player", instanceId: footman.instanceId },
    );
    expect(mine.garrisonedCreature).toBe(footman);

    damageCard(state, "player", mine.instanceId, 5); // gold-mine has 5 hp — this destroys it

    expect(state.players.player.graveyard).toContain(mine);
    const onBoard = [...state.players.player.board.vanguard, ...state.players.player.board.support];
    expect(onBoard).toContain(footman);
    expect(state.players.player.graveyard).not.toContain(footman);
  });

  it("destroys the garrisoned creature alongside its Building when there's no room to eject it", () => {
    const state = makeState();
    const mine = createCardInstance("gold-mine", "player");
    state.players.player.board.buildings[0] = mine;
    const footman = createCardInstance("footman", "player");
    state.players.player.board.vanguard[0] = footman;
    resolveEffect(
      state,
      "player",
      { kind: "garrison", target: "targetCreature" },
      { kind: "card", owner: "player", instanceId: footman.instanceId },
    );
    expect(mine.garrisonedCreature).toBe(footman);

    // Fill every other Vanguard/Support slot so there's nowhere to eject to.
    for (let i = 0; i < VANGUARD_SIZE; i++) {
      if (!state.players.player.board.vanguard[i]) state.players.player.board.vanguard[i] = createCardInstance("footman", "player");
    }
    for (let i = 0; i < SUPPORT_SIZE; i++) {
      state.players.player.board.support[i] = createCardInstance("footman", "player");
    }

    damageCard(state, "player", mine.instanceId, 5);

    expect(state.players.player.graveyard).toContain(footman);
    const onBoard = [...state.players.player.board.vanguard, ...state.players.player.board.support];
    expect(onBoard).not.toContain(footman);
  });
});

describe("Resistant (DESIGN.md §17)", () => {
  it("reduces every incoming hit by the printed amount, floored at 0", () => {
    const state = makeState();
    const golem = createCardInstance("stone-golem", "opponent"); // Resistant 1, 7 HP
    state.players.opponent.board.vanguard[0] = golem;

    expect(damageCard(state, "opponent", golem.instanceId, 3)).toBe(2);
    expect(damageCard(state, "opponent", golem.instanceId, 1)).toBe(0); // floored, not negative
  });
});

describe("Deadeye (DESIGN.md §17)", () => {
  it("adds its bonus only when attacking a Backline (Support) target", () => {
    const state = makeState();
    const sniper = createCardInstance("longbow-sniper", "player"); // 3 base attack, Ranged + Deadeye +2
    sniper.summonedTurn = 0;
    state.players.player.board.support[0] = sniper;
    const vanguardTarget = createCardInstance("hill-giant", "opponent");
    state.players.opponent.board.vanguard[0] = vanguardTarget;
    const backlineTarget = createCardInstance("footman", "opponent");
    state.players.opponent.board.support[1] = backlineTarget;

    const vanguardHpBefore = vanguardTarget.currentHp!;
    declareCreatureAttack(state, "player", sniper.instanceId, { type: "creature", instanceId: vanguardTarget.instanceId });
    expect(vanguardHpBefore - vanguardTarget.currentHp!).toBe(4); // 3 base + 1 Fighter aura, no Deadeye vs Vanguard

    sniper.hasAttackedThisTurn = false;
    const backlineHpBefore = backlineTarget.currentHp!;
    declareCreatureAttack(state, "player", sniper.instanceId, { type: "creature", instanceId: backlineTarget.instanceId });
    expect(backlineHpBefore - backlineTarget.currentHp!).toBe(6); // 3 base + 1 aura + 2 Deadeye vs Backline
  });
});

describe("Double Strike (DESIGN.md §17)", () => {
  it("can attack twice in the same turn, then is exhausted", () => {
    const state = makeState();
    const captain = createCardInstance("golden-company-captain", "player"); // Charge + Double Strike
    captain.summonedTurn = state.turnNumber; // Charge lets it act despite just entering play
    state.players.player.board.vanguard[0] = captain;

    expect(creatureCanAttack(state, captain)).toBe(true);
    declareCreatureAttack(state, "player", captain.instanceId, { type: "player" });
    expect(captain.hasAttackedThisTurn).toBe(false); // one swing left
    expect(creatureCanAttack(state, captain)).toBe(true);

    declareCreatureAttack(state, "player", captain.instanceId, { type: "player" });
    expect(captain.hasAttackedThisTurn).toBe(true); // both swings used
    expect(creatureCanAttack(state, captain)).toBe(false);
  });
});

describe("Bleed (DESIGN.md §17)", () => {
  it("applies on a landed hit, via the previously-dead onAttack trigger wiring", () => {
    const state = makeState();
    const wolf = createCardInstance("grey-wolf", "player");
    wolf.summonedTurn = 0;
    state.players.player.board.vanguard[0] = wolf;
    const target = createCardInstance("hill-giant", "opponent"); // tough enough to survive the hit
    state.players.opponent.board.vanguard[0] = target;

    declareCreatureAttack(state, "player", wolf.instanceId, { type: "creature", instanceId: target.instanceId });
    expect(target.statuses).toContainEqual({ type: "bleed", amount: 2, turnsRemaining: 2 });
  });
});

describe("Freeze (DESIGN.md §17)", () => {
  it("Frost Armor freezes an attacker, who then can't attack until it expires", () => {
    const state = makeState();
    const golem = createCardInstance("frost-golem", "opponent"); // Frost Armor
    state.players.opponent.board.vanguard[0] = golem;
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;

    declareCreatureAttack(state, "player", attacker.instanceId, { type: "creature", instanceId: golem.instanceId });
    expect(attacker.statuses).toContainEqual({ type: "freeze", amount: 0, turnsRemaining: 1 });

    const secondAttacker = createCardInstance("footman", "player");
    secondAttacker.summonedTurn = 0;
    state.players.player.board.vanguard[1] = secondAttacker;
    expect(creatureCanAttack(state, attacker)).toBe(false);
    expect(creatureCanAttack(state, secondAttacker)).toBe(true); // unaffected
  });

  it("blocks the Hero from attacking too", () => {
    const state = makeState();
    applyStatus(state.players.player.hero, "freeze", 0, 1);
    const sword = createCardInstance("iron-sword", "player");
    state.players.player.board.equipment[0] = sword;
    assignEquipment(state, "player", 0, { kind: "hero" });
    expect(heroCanAttack(state, "player")).toBe(false);
  });
});

describe("Crowd Pleaser (DESIGN.md §17)", () => {
  it("scales Attack and HP with other creatures on the board, capped", () => {
    const state = makeState();
    const performer = createCardInstance("pit-fighter-of-klamet", "opponent"); // base 3/4, +1/+1 per other creature, cap +7/+6
    state.players.opponent.board.vanguard[0] = performer;
    expect(getEffectiveCreatureAttack(state, "opponent", performer)).toBe(3);
    expect(getEffectiveCreatureMaxHp(state, "opponent", performer)).toBe(4);

    for (let i = 1; i < 5; i++) {
      state.players.opponent.board.vanguard[i] = createCardInstance("footman", "opponent");
    }
    for (let i = 0; i < 5; i++) {
      state.players.player.board.vanguard[i] = createCardInstance("footman", "player");
    }
    // 9 other creatures on the board — Attack capped at +7, HP capped at +6.
    expect(getEffectiveCreatureAttack(state, "opponent", performer)).toBe(10);
    expect(getEffectiveCreatureMaxHp(state, "opponent", performer)).toBe(10);
  });
});

describe("Duel (DESIGN.md §17)", () => {
  it("marks a target, grants a live bonus, and bypasses Vanguard/Taunt while the mark holds", () => {
    const state = makeState();
    const veteran = createCardInstance("lorthaine-elite-veteran", "player"); // base 3/5, Duel +2/+2, activateCost 2
    state.players.player.board.vanguard[0] = veteran;
    const taunt = createCardInstance("stonewall-guardian", "opponent"); // Taunt
    state.players.opponent.board.vanguard[0] = taunt;
    const target = createCardInstance("apprentice-mage", "opponent");
    state.players.opponent.board.support[0] = target;

    const markResult = declareDuelMark(state, "player", veteran.instanceId, target.instanceId);
    expect(markResult.ok).toBe(true);
    expect(state.players.player.energy.current).toBe(3); // 5 - 2

    expect(getEffectiveCreatureAttack(state, "player", veteran)).toBe(6); // 3 base + 1 aura + 2 Duel
    expect(getEffectiveCreatureMaxHp(state, "player", veteran)).toBe(7); // 5 base + 2 Duel

    // Bypasses the enemy Taunt and the Vanguard-first ladder to reach the marked Support target directly.
    veteran.summonedTurn = 0;
    const result = declareCreatureAttack(state, "player", veteran.instanceId, { type: "creature", instanceId: target.instanceId });
    expect(result.ok).toBe(true);
  });

  it("stops applying once the marked creature dies, with no explicit cleanup", () => {
    const state = makeState();
    const veteran = createCardInstance("lorthaine-elite-veteran", "player");
    state.players.player.board.vanguard[0] = veteran;
    const target = createCardInstance("footman", "opponent");
    state.players.opponent.board.vanguard[0] = target;
    declareDuelMark(state, "player", veteran.instanceId, target.instanceId);
    expect(getEffectiveCreatureAttack(state, "player", veteran)).toBe(6);

    target.currentHp = 0;
    // No board cleanup needed — killCardIfDead already removes it from the row, so the live lookup just stops finding it.
    state.players.opponent.board.vanguard[0] = null;
    expect(getEffectiveCreatureAttack(state, "player", veteran)).toBe(4); // back to 3 base + 1 aura
  });
});

describe("Resource income (Farm/Gold Mine, DESIGN.md §17)", () => {
  it("Farm permanently raises the controller's per-turn Resources trickle, reflected on the next startTurn", () => {
    const state = makeState();
    const player = state.players.player;
    expect(player.resources.income).toBe(1);
    const farm = createCardInstance("farm", "player");
    player.hand.push(farm);
    playCardFromHand(state, "player", farm.instanceId);
    expect(player.resources.income).toBe(2);

    player.resources.cap = 10;
    player.resources.current = 3;
    startTurn(state); // re-applies the regen formula for the current active player
    expect(player.resources.current).toBe(5); // 3 + income of 2
  });
});

describe("Recruitment Station drawCreature (DESIGN.md §17)", () => {
  it("draws the first creature in the deck, skipping non-creatures ahead of it, and is capped at 2 activations", () => {
    const state = makeState();
    const player = state.players.player;
    const spell = createCardInstance("lightning-bolt", "player");
    const creature = createCardInstance("footman", "player");
    player.deck = [spell, creature];
    const station = createCardInstance("recruitment-station", "player");
    player.board.buildings[0] = station;

    const result = activateBuildingAbility(state, "player", 0);
    expect(result.ok).toBe(true);
    expect(player.hand).toContain(creature);
    expect(player.deck).toContain(spell);
    expect(player.deck).not.toContain(creature);

    activateBuildingAbility(state, "player", 0); // 2nd of 2 activations — deck now empty, fizzles harmlessly
    const third = activateBuildingAbility(state, "player", 0);
    expect(third.ok).toBe(false); // out of charges
  });
});

describe("Devour (DESIGN.md §17 — Elder Flame Imp)", () => {
  it("destroys the target and gains half its printed Attack/HP, rounded down", () => {
    const state = makeState();
    state.players.player.energy.cap = 10;
    state.players.player.energy.current = 10; // Elder Flame Imp costs 7, above the default 5 max
    const imp = createCardInstance("elder-flame-imp", "player");
    state.players.player.hand.push(imp);
    const target = createCardInstance("hill-giant", "opponent"); // 7 attack, 9 hp -> +3/+4
    state.players.opponent.board.vanguard[0] = target;

    const result = playCardFromHand(state, "player", imp.instanceId, {
      target: { kind: "card", owner: "opponent", instanceId: target.instanceId },
    });
    expect(result.ok).toBe(true);
    expect(state.players.opponent.graveyard).toContain(target);
    const placed = state.players.player.board.vanguard.find((c) => c?.instanceId === imp.instanceId);
    expect(placed?.attackDelta).toBe(3);
    expect(placed?.hpDelta).toBe(4);
  });
});

describe("Multi effect (DESIGN.md §17 — Frost Nova)", () => {
  it("resolves every listed sub-effect against the same target", () => {
    const state = makeState();
    const nova = createCardInstance("frost-nova", "player");
    state.players.player.board.spellAbilitySlots[0] = nova;
    const enemy = createCardInstance("footman", "opponent");
    state.players.opponent.board.vanguard[0] = enemy;

    const result = activateSlotCard(state, "player", 0);
    expect(result.ok).toBe(true);
    expect(enemy.currentHp).toBe(1); // 3 - 2
    expect(enemy.statuses).toContainEqual({ type: "freeze", amount: 0, turnsRemaining: 1 });
  });
});

describe("Cloak of Shadows charges (DESIGN.md §17)", () => {
  it("discards itself after the Hero's 3rd attack while equipped", () => {
    const state = makeState();
    const cloak = createCardInstance("cloak-of-shadows", "player");
    state.players.player.board.equipment[0] = cloak;
    assignEquipment(state, "player", 0, { kind: "hero" });

    for (let i = 0; i < 2; i++) {
      declareHeroAttack(state, "player", { type: "player" }); // hits own Hero's opponent portrait target shape; only charge-ticking matters here
      state.players.player.hero.hasAttackedThisTurn = false; // reset between swings for this test's purposes
    }
    expect(cloak.chargesRemaining).toBe(1);
    declareHeroAttack(state, "player", { type: "player" });
    expect(state.players.player.board.equipment[0]).toBeNull();
    expect(state.players.player.discard).toContain(cloak);
  });
});
