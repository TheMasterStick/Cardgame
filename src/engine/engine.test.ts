import { describe, expect, it } from "vitest";
import { declareCreatureAttack } from "./combat";
import { drawCard } from "./deck";
import { damagePlayer, gainCap } from "./effects";
import { createCardInstance, createInitialGameState } from "./factory";
import { activateSlotCard, startTurn } from "./game";
import { MAX_POOL, STARTING_MILITIA, type GameState } from "./types";

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

describe("targeting chain", () => {
  it("lets a Front Row creature attack any enemy Front Row creature", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.frontRow[0] = attacker;
    const defender = createCardInstance("footman", "opponent");
    state.players.opponent.board.frontRow[2] = defender;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "creature",
      instanceId: defender.instanceId,
    });
    expect(result.ok).toBe(true);
  });

  it("blocks a non-Ranged attacker from reaching the Back Row while the Front Row isn't empty", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.frontRow[0] = attacker;
    state.players.opponent.board.frontRow[0] = createCardInstance("footman", "opponent");
    const building = createCardInstance("gold-mine", "opponent");
    state.players.opponent.board.backRow[0] = building;

    const result = declareCreatureAttack(state, "player", attacker.instanceId, {
      type: "building",
      instanceId: building.instanceId,
    });
    expect(result.ok).toBe(false);
  });

  it("lets a Ranged attacker bypass a full enemy Front Row to hit the player", () => {
    const state = makeState();
    const attacker = createCardInstance("arrow-archer", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.frontRow[0] = attacker;
    state.players.opponent.board.frontRow[0] = createCardInstance("footman", "opponent");

    const result = declareCreatureAttack(state, "player", attacker.instanceId, { type: "player" });
    expect(result.ok).toBe(true);
  });

  it("blocks hitting Militia/Hero while the enemy Front Row still has creatures and the attacker isn't Ranged", () => {
    const state = makeState();
    const attacker = createCardInstance("footman", "player");
    attacker.summonedTurn = 0;
    state.players.player.board.frontRow[0] = attacker;
    state.players.opponent.board.frontRow[0] = createCardInstance("footman", "opponent");

    const result = declareCreatureAttack(state, "player", attacker.instanceId, { type: "player" });
    expect(result.ok).toBe(false);
  });
});

describe("militia -> hero HP overflow", () => {
  it("drains Militia before touching Hero HP", () => {
    const state = makeState();
    damagePlayer(state, "opponent", 40);
    expect(state.players.opponent.militia.current).toBe(STARTING_MILITIA - 40);
    expect(state.players.opponent.hero.currentHp).toBe(10);
  });

  it("overflows into Hero HP once Militia is exhausted", () => {
    const state = makeState();
    damagePlayer(state, "opponent", STARTING_MILITIA + 4);
    expect(state.players.opponent.militia.current).toBe(0);
    expect(state.players.opponent.hero.currentHp).toBe(10 - 4);
  });

  it("declares a winner once Hero HP reaches 0", () => {
    const state = makeState();
    damagePlayer(state, "opponent", STARTING_MILITIA + 10);
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
    state.players.opponent.board.frontRow[0] = enemy1;
    const enemy2 = createCardInstance("footman", "opponent");
    state.players.opponent.board.frontRow[1] = enemy2;

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
    state.players.opponent.board.frontRow[0] = enemy;

    activateSlotCard(state, "player", 0, { kind: "card", owner: "opponent", instanceId: enemy.instanceId });
    expect(state.players.player.board.spellAbilitySlots[0]?.instanceId).toBe(card.instanceId);
  });
});

describe("turn flow", () => {
  it("resets attack flags and refills pools on startTurn", () => {
    const state = makeState();
    state.players.player.resources.current = 0;
    const creature = createCardInstance("footman", "player");
    creature.hasAttackedThisTurn = true;
    state.players.player.board.frontRow[0] = creature;
    state.turnNumber = 2;

    startTurn(state);
    expect(state.players.player.resources.current).toBe(state.players.player.resources.cap);
    expect(creature.hasAttackedThisTurn).toBe(false);
  });

  it("does not draw on the very first turn of the game", () => {
    const state = makeState();
    state.players.player.deck.push(createCardInstance("footman", "player"));
    startTurn(state);
    expect(state.players.player.hand.length).toBe(0);
  });
});
