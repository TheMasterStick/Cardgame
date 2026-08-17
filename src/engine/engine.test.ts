import { describe, expect, it } from "vitest";
import { declareCreatureAttack } from "./combat";
import { drawCard } from "./deck";
import { damageCard, damagePlayer, gainCap } from "./effects";
import { createCardInstance, createInitialGameState } from "./factory";
import { activateSlotCard, playCardFromHand, startTurn } from "./game";
import { MAX_POOL, STARTING_GUARD, type GameState } from "./types";

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
    // Started at 5, Gold Mine costs 2 (-> 3), then its own On Play grants +1 max/current Resources (-> 4).
    expect(player.resources.current).toBe(4);
  });
});

describe("Support row (Phase A: placeholder, not yet reachable)", () => {
  it("can't attack from Support even if otherwise eligible", () => {
    const state = makeState();
    const archer = createCardInstance("arrow-archer", "player");
    archer.summonedTurn = 0;
    state.players.player.board.support[0] = archer;

    const result = declareCreatureAttack(state, "player", archer.instanceId, { type: "player" });
    expect(result.ok).toBe(false);
  });

  it("can't be targeted by an enemy attack", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    const hiding = createCardInstance("footman", "opponent");
    state.players.opponent.board.support[0] = hiding;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "creature",
      instanceId: hiding.instanceId,
    });
    expect(result.ok).toBe(false);
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

  it("lets a Ranged attacker bypass a full enemy Vanguard to hit the player", () => {
    const state = makeState();
    const attacker = createCardInstance("arrow-archer", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    state.players.opponent.board.vanguard[0] = createCardInstance("footman", "opponent");

    const result = declareCreatureAttack(state, "player", attacker.instanceId, { type: "player" });
    expect(result.ok).toBe(true);
  });

  it("blocks hitting Guard/Hero while the enemy Vanguard still has creatures and the attacker isn't Ranged", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.vanguard[0] = attacker;
    state.players.opponent.board.vanguard[0] = createCardInstance("footman", "opponent");

    const result = declareCreatureAttack(state, "player", attacker.instanceId, { type: "player" });
    expect(result.ok).toBe(false);
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

describe("Frenzy", () => {
  it("gains Attack equal to damage taken while it survives", () => {
    const state = makeState();
    const ogre = createCardInstance("berserking-ogre", "player");
    state.players.player.board.vanguard[0] = ogre;

    damageCard(state, "player", ogre.instanceId, 2);
    expect(ogre.attackDelta).toBe(2);
    expect(ogre.currentHp).toBe(3);
  });

  it("does not buff attack on the killing blow", () => {
    const state = makeState();
    const ogre = createCardInstance("berserking-ogre", "player");
    state.players.player.board.vanguard[0] = ogre;

    damageCard(state, "player", ogre.instanceId, 5);
    expect(ogre.attackDelta).toBe(0);
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
    const state = makeState();
    const golem = createCardInstance("arcane-golem", "opponent");
    state.players.opponent.board.vanguard[0] = golem;
    const ability = createCardInstance("executioners-strike", "player");
    state.players.player.board.spellAbilitySlots[0] = ability;

    activateSlotCard(state, "player", 0, { kind: "card", owner: "opponent", instanceId: golem.instanceId });
    expect(golem.currentHp).toBeLessThan(4);
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
