import { CARD_DEFINITIONS } from "../data/cards";
import type { AiTurnStep } from "../engine/ai";
import { hasKeyword } from "../engine/effects";
import type { BuildingDefinition, CardArchetype, CardEffect, CardInstance, EffectTarget, GameState, HeroCardDefinition, PlayerId } from "../engine/types";

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
export function effectHasLegalTarget(state: GameState, effect: CardEffect, sourceArchetype?: CardArchetype): boolean {
  const category = effectTargetCategory(effect);
  if (category === null || category === "targetPlayer" || category === "targetAny") return true;

  const side = effectTargetSide(effect);
  const targetOwner: PlayerId = side === "own" ? "player" : "opponent";
  const board = state.players[targetOwner].board;
  // A Spell/Ability can't target a Stealthed creature (DESIGN.md §7) — if
  // every candidate creature is Stealthed, treat it the same as no creature
  // being out at all, so the card still fizzles instead of entering a
  // pending-target state with nothing left to click.
  const isBlockedBySpellOrAbilityStealth = sourceArchetype === "spell" || sourceArchetype === "ability";
  const hasCreature = [...board.vanguard, ...board.support].some(
    (c) => c !== null && !(isBlockedBySpellOrAbilityStealth && hasKeyword(c, "stealth") && !c.stealthBroken),
  );
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
  | { kind: "attack"; attackerId: string | "hero" }
  | { kind: "heroPower" }
  | { kind: "signature" }
  | { kind: "buildingAbility"; slotIndex: number };

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
    if (def.archetype === "spell" && def.spellForm === "instant") return def.effect;
    if (def.archetype !== "creature" && def.archetype !== "building") return null;
    return def.triggers.find((t) => t.on === "onPlay")?.effect ?? null;
  }
  if (pending.kind === "heroPower" || pending.kind === "signature") {
    const heroDef = CARD_DEFINITIONS[state.players.player.hero.defId] as HeroCardDefinition;
    return (pending.kind === "heroPower" ? heroDef.heroPower : heroDef.signature)?.effect ?? null;
  }
  if (pending.kind === "buildingAbility") {
    const building = state.players.player.board.buildings[pending.slotIndex];
    if (!building) return null;
    const def = CARD_DEFINITIONS[building.defId] as BuildingDefinition;
    return def.ability?.effect ?? null;
  }
  const card = state.players.player.board.spellAbilitySlots[pending.slotIndex];
  if (!card) return null;
  const def = CARD_DEFINITIONS[card.defId];
  if (def.archetype !== "spell" && def.archetype !== "ability") return null;
  return def.effect;
}

/**
 * Whether `pending`'s effect actually comes from a Spell or Ability card
 * (as opposed to a creature/building Warcry, or a Hero Power/Signature,
 * neither of which are Spell/Ability archetype cards) — mirrors the
 * `sourceArchetype` engine.ts's resolveEffect is given, needed here so the
 * UI's Stealth exclusion (below) only applies where DESIGN.md §7 actually
 * scopes it: "a targeted enemy Spell or Ability", not any hostile effect.
 */
export function pendingEffectSourceArchetype(state: GameState, pending: PendingAction): CardArchetype | undefined {
  if (pending.kind === "playCard") {
    const card = state.players.player.hand.find((c) => c.instanceId === pending.instanceId);
    const def = card && CARD_DEFINITIONS[card.defId];
    return def?.archetype === "spell" ? "spell" : undefined;
  }
  if (pending.kind === "activate") {
    const card = state.players.player.board.spellAbilitySlots[pending.slotIndex];
    const def = card && CARD_DEFINITIONS[card.defId];
    return def?.archetype === "spell" || def?.archetype === "ability" ? def.archetype : undefined;
  }
  return undefined; // heroPower/signature/attack/placeCreature
}

export function isEffectTargetable(
  effect: CardEffect,
  side: "creature" | "building" | "portrait",
  owner: PlayerId,
  card?: CardInstance,
  sourceArchetype?: CardArchetype,
): boolean {
  const requiredSide = effectTargetSide(effect);
  if (requiredSide === null) return false;
  if (requiredSide === "own" && owner !== "player") return false;
  if (requiredSide === "enemy" && owner !== "opponent") return false;
  if (
    side === "creature" &&
    card &&
    (sourceArchetype === "spell" || sourceArchetype === "ability") &&
    hasKeyword(card, "stealth") &&
    !card.stealthBroken
  ) {
    return false;
  }
  if (side === "building" && !effectAllowsBuildingTarget(effect)) return false;
  if (side === "portrait" && !effectAllowsPortraitTarget(effect)) return false;
  return true;
}

/** Which card(s)/portrait(s) the currently-replaying AI step involves, for a highlight/flash effect. */
export interface AiHighlight {
  actorId: string | null;
  actorPortrait: PlayerId | null;
  targetId: string | null;
  targetPortrait: PlayerId | null;
}

export const NO_AI_HIGHLIGHT: AiHighlight = { actorId: null, actorPortrait: null, targetId: null, targetPortrait: null };

/** Maps one AI turn step to what should flash — the acting card/hero and, for attacks, the target. */
export function highlightForStep(step: AiTurnStep): AiHighlight {
  switch (step.kind) {
    case "playCard":
    case "activateCard":
    case "activateBuilding":
    case "advance":
      return { ...NO_AI_HIGHLIGHT, actorId: step.instanceId };
    case "heroPower":
    case "heroSignature":
      return { ...NO_AI_HIGHLIGHT, actorPortrait: "opponent" };
    case "attack":
      return {
        ...NO_AI_HIGHLIGHT,
        actorId: step.attackerId,
        targetId: step.target.type === "player" ? null : step.target.instanceId,
        targetPortrait: step.target.type === "player" ? "player" : null,
      };
    case "heroAttack":
      return {
        ...NO_AI_HIGHLIGHT,
        actorPortrait: "opponent",
        targetId: step.target.type === "player" ? null : step.target.instanceId,
        targetPortrait: step.target.type === "player" ? "player" : null,
      };
    case "endTurn":
      return NO_AI_HIGHLIGHT;
  }
}
