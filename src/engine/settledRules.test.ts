import { describe, expect, it } from "vitest";
import { creatureCanAttack, declareCreatureAttack } from "./combat";
import { drawCard } from "./deck";
import { createCardInstance, createInitialGameState } from "./factory";
import { endTurn, startTurn } from "./game";
import { applyStatus } from "./status";
import { MAX_HAND_SIZE, STARTING_GUARD } from "./types";

function makeState() {
  return createInitialGameState("fighter", [], "mage", []);
}

describe("settled hand burn rule", () => {
  it("permanently destroys an overdrawn card instead of sending it to discard", () => {
    const state = makeState();
    const player = state.players.player;

    for (let i = 0; i < MAX_HAND_SIZE; i += 1) {
      player.hand.push(createCardInstance("footman", "player"));
    }
    const burned = createCardInstance("arrow-archer", "player");
    player.deck.push(burned);

    expect(drawCard(state, "player")).toBeNull();
    expect(player.hand).toHaveLength(MAX_HAND_SIZE);
    expect(player.deck).toHaveLength(0);
    expect(player.discard.some((card) => card.instanceId === burned.instanceId)).toBe(false);
    expect(player.graveyard.some((card) => card.instanceId === burned.instanceId)).toBe(false);
    expect(state.log.at(-1)).toContain("burned and destroyed for this match");
  });
});

describe("settled Double Strike rule", () => {
  it("allows two attacks again after the creature starts a new turn", () => {
    const state = makeState();
    const captain = createCardInstance("golden-company-captain", "player");
    captain.summonedTurn = 0;
    state.players.player.board.vanguard[0] = captain;

    expect(creatureCanAttack(state, captain)).toBe(true);
    expect(declareCreatureAttack(state, "player", captain.instanceId, { type: "player" }).ok).toBe(true);
    expect(creatureCanAttack(state, captain)).toBe(true);
    expect(declareCreatureAttack(state, "player", captain.instanceId, { type: "player" }).ok).toBe(true);
    expect(creatureCanAttack(state, captain)).toBe(false);

    startTurn(state);

    expect(captain.attacksUsedThisTurn).toBe(0);
    expect(creatureCanAttack(state, captain)).toBe(true);
    expect(declareCreatureAttack(state, "player", captain.instanceId, { type: "player" }).ok).toBe(true);
    expect(creatureCanAttack(state, captain)).toBe(true);
    expect(declareCreatureAttack(state, "player", captain.instanceId, { type: "player" }).ok).toBe(true);
    expect(creatureCanAttack(state, captain)).toBe(false);
  });
});

describe("settled Guard rule for damage-over-time", () => {
  it("routes Hero status damage through Guard before Hero HP", () => {
    const state = makeState();
    const player = state.players.player;
    const startingHp = player.hero.currentHp;

    applyStatus(player.hero, "poison", 2, 3);
    endTurn(state);

    expect(player.guard.current).toBe(STARTING_GUARD - 2);
    expect(player.hero.currentHp).toBe(startingHp);
  });
});
