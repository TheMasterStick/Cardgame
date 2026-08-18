import { describe, expect, it } from "vitest";
import { declareAdvance, declareCreatureAttack, getEffectiveCreatureAttack } from "./combat";
import { drawCard } from "./deck";
import { damageCard, damagePlayer, gainCap, resolveEffect } from "./effects";
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

describe("Ranged retaliation", () => {
  it("a Ranged attacker takes no damage back even if the defender survives and could hit back", () => {
    const state = makeState();
    const archer = createCardInstance("arrow-archer", "player"); // 2 attack / 1 HP, ranged
    archer.summonedTurn = 0;
    state.players.player.board.vanguard[0] = archer;
    const defender = createCardInstance("footman", "opponent"); // 2 attack / 3 HP
    state.players.opponent.board.vanguard[0] = defender;

    declareCreatureAttack(state, "player", archer.instanceId, { type: "creature", instanceId: defender.instanceId });
    expect(defender.currentHp).toBe(1); // took the archer's 2 damage, survived
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
    state.players.opponent.board.vanguard[0] = sniper;

    declareCreatureAttack(state, "player", archer.instanceId, { type: "creature", instanceId: sniper.instanceId });
    expect(sniper.currentHp).toBe(1); // took the archer's 2 damage, survived
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

describe("Flank", () => {
  it("grants its bonus while in column 1 (index 0)", () => {
    const state = makeState();
    const scout = createCardInstance("flankguard-outrider", "player"); // base 2 attack, +2 flankBonus
    state.players.player.board.vanguard[0] = scout;
    expect(getEffectiveCreatureAttack(state, "player", scout)).toBe(4);
  });

  it("grants its bonus while in column 5 (index 4)", () => {
    const state = makeState();
    const scout = createCardInstance("flankguard-outrider", "player");
    state.players.player.board.vanguard[4] = scout;
    expect(getEffectiveCreatureAttack(state, "player", scout)).toBe(4);
  });

  it("does not grant its bonus in a middle column", () => {
    const state = makeState();
    const scout = createCardInstance("flankguard-outrider", "player");
    state.players.player.board.vanguard[2] = scout;
    expect(getEffectiveCreatureAttack(state, "player", scout)).toBe(2);
  });
});

describe("Formation", () => {
  it("grants its bonus while an ally occupies an adjacent column", () => {
    const state = makeState();
    const veteran = createCardInstance("shieldwall-veteran", "player"); // base 2 attack, +2 formationBonus
    state.players.player.board.vanguard[1] = veteran;
    state.players.player.board.vanguard[2] = createCardInstance("footman", "player");
    expect(getEffectiveCreatureAttack(state, "player", veteran)).toBe(4);
  });

  it("does not grant its bonus with no adjacent ally", () => {
    const state = makeState();
    const veteran = createCardInstance("shieldwall-veteran", "player");
    state.players.player.board.vanguard[1] = veteran;
    expect(getEffectiveCreatureAttack(state, "player", veteran)).toBe(2);
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
  it("moves an Advance-keyword Support creature into the same-column empty Vanguard slot", () => {
    const state = makeState();
    const scout = createCardInstance("vanguard-scout", "player");
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
    const scout = createCardInstance("vanguard-scout", "player");
    scout.summonedTurn = 0;
    state.players.player.board.support[0] = scout;
    state.players.player.board.vanguard[0] = createCardInstance("footman", "player");

    const result = declareAdvance(state, "player", scout.instanceId);
    expect(result.ok).toBe(false);
  });

  it("fails for a creature that already acted this turn", () => {
    const state = makeState();
    const scout = createCardInstance("vanguard-scout", "player");
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
