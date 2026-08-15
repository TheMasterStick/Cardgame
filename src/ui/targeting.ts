import { CARD_DEFINITIONS } from "../data/cards";
import type { CardEffect, CreatureDefinition, EffectTarget, GameState, PlayerId } from "../engine/types";

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

export type PendingAction =
  | { kind: "playCard"; instanceId: string }
  | { kind: "activate"; slotIndex: number }
  | { kind: "attack"; attackerId: string | "hero" };

/**
 * All pending actions in this prototype are initiated by the human "player"
 * seat, so target-side checks can hardcode player=own, opponent=enemy.
 */
export function getPendingEffect(state: GameState, pending: PendingAction | null): CardEffect | null {
  if (!pending || pending.kind === "attack") return null;
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

/**
 * Whether an attack-pending action (always human-initiated, from "player")
 * can legally reach the Back Row / Militia-Hero of `defenderOwner` right
 * now: the defender's Front Row must be empty, unless the attacker is
 * Ranged. Mirrors the engine's own validateTarget rule so the UI doesn't
 * highlight targets it knows will be rejected.
 */
export function canBypassFrontRow(
  state: GameState,
  defenderOwner: PlayerId,
  attackerId: string | "hero",
): boolean {
  const frontRowEmpty = state.players[defenderOwner].board.frontRow.every((c) => c === null);
  if (frontRowEmpty) return true;
  if (attackerId === "hero") return false;
  const attacker = state.players.player.board.frontRow.find((c) => c?.instanceId === attackerId);
  if (!attacker) return false;
  const def = CARD_DEFINITIONS[attacker.defId] as CreatureDefinition;
  return def.keywords.includes("ranged");
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
