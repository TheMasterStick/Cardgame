import { describe, expect, it } from "vitest";
import { createCardInstance, createInitialGameState } from "../engine/factory";
import type { GameState } from "../engine/types";
import { effectHasLegalTarget } from "./targeting";

function makeState(): GameState {
  return createInitialGameState("fighter", [], "mage", []);
}

describe("effectHasLegalTarget", () => {
  it("is always true for targetPlayer — the Hero is always a legal target", () => {
    const state = makeState();
    expect(effectHasLegalTarget(state, { kind: "damage", amount: 1, target: "targetPlayer" })).toBe(true);
  });

  it("is always true for targetAny — the Hero is always a legal target", () => {
    const state = makeState();
    expect(effectHasLegalTarget(state, { kind: "damage", amount: 1, target: "targetAny" })).toBe(true);
  });

  it("is false for targetCreature (enemy side) when the enemy has no creatures out", () => {
    const state = makeState();
    expect(effectHasLegalTarget(state, { kind: "damage", amount: 1, target: "targetCreature" })).toBe(false);
  });

  it("is true for targetCreature once the enemy has a creature out, in either row", () => {
    const state = makeState();
    state.players.opponent.board.support[0] = createCardInstance("footman", "opponent");
    expect(effectHasLegalTarget(state, { kind: "damage", amount: 1, target: "targetCreature" })).toBe(true);
  });

  it("is false for targetBuilding when the enemy has no Buildings out", () => {
    const state = makeState();
    expect(effectHasLegalTarget(state, { kind: "damage", amount: 1, target: "targetBuilding" })).toBe(false);
  });

  it("is true for targetCreatureOrBuilding when only a Building is out", () => {
    const state = makeState();
    state.players.opponent.board.buildings[0] = createCardInstance("gold-mine", "opponent");
    expect(effectHasLegalTarget(state, { kind: "damage", amount: 1, target: "targetCreatureOrBuilding" })).toBe(true);
  });

  it("respects the effect's own side for heal/buff (own creatures, not the enemy's)", () => {
    const state = makeState();
    state.players.opponent.board.vanguard[0] = createCardInstance("footman", "opponent");
    // Enemy has a creature, but heal's side is "own" — the player has none, so still false.
    expect(effectHasLegalTarget(state, { kind: "heal", amount: 1, target: "targetCreature" })).toBe(false);
    state.players.player.board.vanguard[0] = createCardInstance("footman", "player");
    expect(effectHasLegalTarget(state, { kind: "heal", amount: 1, target: "targetCreature" })).toBe(true);
  });
});
