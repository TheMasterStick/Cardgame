import { CARD_DEFINITIONS } from "../data/cards";
import { damageCard, damagePlayer, resolveEffect, type EffectTargetRef } from "./effects";
import {
  otherPlayer,
  type CardInstance,
  type CreatureDefinition,
  type EquipmentDefinition,
  type GameState,
  type PlayerId,
} from "./types";

export type AttackTarget =
  | { type: "creature"; instanceId: string }
  | { type: "building"; instanceId: string }
  | { type: "player" };

export function getCreatureAttack(card: CardInstance): number {
  const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition;
  return def.attack + card.attackDelta;
}

export function creatureCanAttack(state: GameState, card: CardInstance): boolean {
  const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition;
  if (card.hasAttackedThisTurn) return false;
  if (card.summonedTurn === state.turnNumber && !def.keywords.includes("charge")) return false;
  return true;
}

export function heroCanAttack(state: GameState, owner: PlayerId): boolean {
  const player = state.players[owner];
  if (player.hero.hasAttackedThisTurn) return false;
  return player.board.equipment !== null;
}

export function getHeroAttack(state: GameState, owner: PlayerId): number {
  const player = state.players[owner];
  if (!player.board.equipment) return 0;
  const def = CARD_DEFINITIONS[player.board.equipment.defId] as EquipmentDefinition;
  return player.hero.baseAttack + def.attackBonus;
}

interface ValidationResult {
  ok: boolean;
  reason?: string;
}

function validateTarget(
  state: GameState,
  attackerOwner: PlayerId,
  isRanged: boolean,
  target: AttackTarget,
): ValidationResult {
  const defenderOwner = otherPlayer(attackerOwner);
  const defenderBoard = state.players[defenderOwner].board;
  const frontRowEmpty = defenderBoard.frontRow.every((c) => c === null);

  if (target.type === "creature") {
    const onFront = defenderBoard.frontRow.some((c) => c?.instanceId === target.instanceId);
    if (!onFront) return { ok: false, reason: "Can only attack enemy Front Row creatures directly." };
    return { ok: true };
  }
  if (!frontRowEmpty && !isRanged) {
    return {
      ok: false,
      reason: "Enemy Front Row must be cleared first, or the attacker needs Ranged.",
    };
  }
  return { ok: true };
}

/** Attacker deals damage to a creature target; the defending creature trades damage back. */
function resolveCreatureTrade(
  state: GameState,
  attackerOwner: PlayerId,
  attackerInstanceId: string | "hero",
  attackerAttack: number,
  defenderOwner: PlayerId,
  defenderInstanceId: string,
): void {
  const defenderBoard = state.players[defenderOwner].board;
  const defender = defenderBoard.frontRow.find((c) => c?.instanceId === defenderInstanceId) ?? null;
  if (!defender) return;
  const defenderAttack = getCreatureAttack(defender);

  damageCard(state, defenderOwner, defenderInstanceId, attackerAttack);

  if (attackerInstanceId === "hero") {
    if (defenderAttack > 0) damagePlayer(state, attackerOwner, defenderAttack);
  } else if (defenderAttack > 0) {
    damageCard(state, attackerOwner, attackerInstanceId, defenderAttack);
  }
}

export function declareCreatureAttack(
  state: GameState,
  attackerOwner: PlayerId,
  attackerInstanceId: string,
  target: AttackTarget,
): ValidationResult {
  const board = state.players[attackerOwner].board;
  const attacker = board.frontRow.find((c) => c?.instanceId === attackerInstanceId) ?? null;
  if (!attacker) return { ok: false, reason: "Attacker not found on Front Row." };
  if (!creatureCanAttack(state, attacker)) {
    return { ok: false, reason: "This creature can't attack right now." };
  }
  const def = CARD_DEFINITIONS[attacker.defId] as CreatureDefinition;
  const validation = validateTarget(state, attackerOwner, def.keywords.includes("ranged"), target);
  if (!validation.ok) return validation;

  const attackerAttack = getCreatureAttack(attacker);
  const defenderOwner = otherPlayer(attackerOwner);

  if (target.type === "creature") {
    resolveCreatureTrade(state, attackerOwner, attackerInstanceId, attackerAttack, defenderOwner, target.instanceId);
  } else if (target.type === "building") {
    damageCard(state, defenderOwner, target.instanceId, attackerAttack);
  } else {
    damagePlayer(state, defenderOwner, attackerAttack);
  }

  attacker.hasAttackedThisTurn = true;
  return { ok: true };
}

export function declareHeroAttack(
  state: GameState,
  attackerOwner: PlayerId,
  target: AttackTarget,
): ValidationResult {
  if (!heroCanAttack(state, attackerOwner)) {
    return { ok: false, reason: "Hero can't attack right now (needs Equipment, once per turn)." };
  }
  const validation = validateTarget(state, attackerOwner, false, target);
  if (!validation.ok) return validation;

  const attackerAttack = getHeroAttack(state, attackerOwner);
  const defenderOwner = otherPlayer(attackerOwner);

  if (target.type === "creature") {
    resolveCreatureTrade(state, attackerOwner, "hero", attackerAttack, defenderOwner, target.instanceId);
  } else if (target.type === "building") {
    damageCard(state, defenderOwner, target.instanceId, attackerAttack);
  } else {
    damagePlayer(state, defenderOwner, attackerAttack);
  }

  state.players[attackerOwner].hero.hasAttackedThisTurn = true;
  return { ok: true };
}

/** Fires a creature's onAttack trigger, if it has one, after an attack resolves. */
export function fireOnAttackTrigger(
  state: GameState,
  attackerOwner: PlayerId,
  attacker: CardInstance,
  target: EffectTargetRef,
): void {
  const def = CARD_DEFINITIONS[attacker.defId] as CreatureDefinition;
  for (const trigger of def.triggers) {
    if (trigger.on === "onAttack") {
      resolveEffect(state, attackerOwner, trigger.effect, target);
    }
  }
}
