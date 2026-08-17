import { CARD_DEFINITIONS } from "../data/cards";
import type { CardEffect, EffectTarget, GameState, PlayerId } from "../engine/types";

const EXPLICIT_TARGET_CATEGORIES: EffectTarget[] = [
  "targetCreature",
  "targetBuilding",
  "targetCreatureOrBuilding",
  "targetAny",
  "targetPlayer",
];

export function effectTargetCategory(effect: CardEffect): EffectTarget | null {
  return "target" in effect ? effect.target : null;
}

export function effectNeedsExplicitTarget(effect: CardEffect): boolean {
  const category = effectTargetCategory(effect);
  return category !== null && EXPLICIT_TARGET_CATEGORIES.includes(category);
}

/** Which side of the board an effect's target must come from, for UI click-restriction purposes. */
export function effectTargetSide(effect: CardEffect): "own" | "enemy" | null {
  if (effect.kind === "damage" || effect.kind === "applyStatus") return "enemy";
  if (effect.kind === "heal" || effect.kind === "buff") return "own";
  return null;
}

export function effectAllowsBuildingTarget(effect: CardEffect): boolean {
  const category = effectTargetCategory(effect);
  return category === "targetBuilding" || category === "targetCreatureOrBuilding" || category === "targetAny";
}

export function effectAllowsPortraitTarget(effect: CardEffect): boolean {
  return effectTargetCategory(effect) === "targetAny" || effectTargetCategory(effect) === "targetPlayer";
}

/**
 * Whether an effect that needs an explicit target actually has one to pick
 * right now. The enemy Hero is always targetable (DESIGN.md §5), so
 * `targetPlayer`/`targetAny` are never stuck — but a card mechanically
 * restricted to Creatures/Buildings only (e.g. "deal 1 damage to an enemy
 * creature") can still have zero legal targets on an empty board. That's not
 * a reason to make the card unplayable: it should still go off and the
 * effect just fizzles (DESIGN.md §7 "Warcry with no target").
 */
export function effectHasLegalTarget(state: GameState, effect: CardEffect): boolean {
  const category = effectTargetCategory(effect);
  if (category === null || category === "targetPlayer" || category === "targetAny") return true;

  const side = effectTargetSide(effect);
  const targetOwner: PlayerId = side === "own" ? "player" : "opponent";
  const board = state.players[targetOwner].board;
  const hasCreature = [...board.vanguard, ...board.support].some((c) => c !== null);
  const hasBuilding = board.buildings.some((c) => c !== null);

  if (category === "targetCreature") return hasCreature;
  if (category === "targetBuilding") return hasBuilding;
  if (category === "targetCreatureOrBuilding") return hasCreature || hasBuilding;
  return true;
}

export type PendingAction =
  | { kind: "playCard"; instanceId: string }
  | { kind: "placeCreature"; instanceId: string }
  | { kind: "activate"; slotIndex: number }
  | { kind: "attack"; attackerId: string | "hero" };

/**
 * All pending actions in this prototype are initiated by the human "player"
 * seat, so target-side checks can hardcode player=own, opponent=enemy.
 */
export function getPendingEffect(state: GameState, pending: PendingAction | null): CardEffect | null {
  if (!pending || pending.kind === "attack" || pending.kind === "placeCreature") return null;
  if (pending.kind === "playCard") {
    const card = state.players.player.hand.find((c) => c.instanceId === pending.instanceId);
    if (!card) return null;
    const def = CARD_DEFINITIONS[card.defId];
    if (def.archetype !== "creature" && def.archetype !== "building") return null;
    return def.triggers.find((t) => t.on === "onPlay")?.effect ?? null;
  }
  const card = state.players.player.board.spellAbilitySlots[pending.slotIndex];
  if (!card) return null;
  const def = CARD_DEFINITIONS[card.defId];
  if (def.archetype !== "spell" && def.archetype !== "ability") return null;
  return def.effect;
}

export function isEffectTargetable(
  effect: CardEffect,
  side: "creature" | "building" | "portrait",
  owner: PlayerId,
): boolean {
  const requiredSide = effectTargetSide(effect);
  if (requiredSide === null) return false;
  if (requiredSide === "own" && owner !== "player") return false;
  if (requiredSide === "enemy" && owner !== "opponent") return false;
  if (side === "building" && !effectAllowsBuildingTarget(effect)) return false;
  if (side === "portrait" && !effectAllowsPortraitTarget(effect)) return false;
  return true;
}
