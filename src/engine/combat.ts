import { CARD_DEFINITIONS } from "../data/cards";
import { damageCard, damagePlayer, hasKeyword, resolveEffect, type EffectTargetRef } from "./effects";
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

/** Which reach-tier keywords the attacker has (DESIGN.md §5). */
export interface ReachProfile {
  reach: boolean;
  ranged: boolean;
  infiltrate: boolean;
}

export function reachProfileOf(def: CreatureDefinition): ReachProfile {
  return {
    reach: def.keywords.includes("reach"),
    ranged: def.keywords.includes("ranged"),
    infiltrate: def.keywords.includes("infiltrate"),
  };
}

const NO_REACH: ReachProfile = { reach: false, ranged: false, infiltrate: false };

function rowHasTaunt(row: (CardInstance | null)[]): boolean {
  return row.some((c) => c !== null && hasKeyword(c, "taunt"));
}

function checkTaunt(row: (CardInstance | null)[], targetInstanceId: string, rowLabel: string): ValidationResult {
  if (rowHasTaunt(row) && !row.some((c) => c?.instanceId === targetInstanceId && hasKeyword(c, "taunt"))) {
    return { ok: false, reason: `An enemy Taunt creature in ${rowLabel} must be attacked first.` };
  }
  return { ok: true };
}

/**
 * Reach-tier targeting (DESIGN.md §5): Base can only hit enemy Vanguard
 * (subject to Taunt); Reach/Ranged can also hit enemy Support directly, even
 * while Vanguard is populated (subject to Support's own Taunt); Infiltrate
 * bypasses straight to enemy Buildings regardless of row state. Buildings
 * are gated per-column (both rows in that column must be empty) rather than
 * needing the whole board cleared.
 *
 * The enemy Guard/Hero has no *board-population* gate — a full enemy
 * Vanguard/Support no longer walls it off by itself, every attacker can
 * still reach past ordinary creatures straight to the Hero. Taunt is the
 * one thing that still stops it: a Taunt creature in a row this attacker
 * can actually reach (Vanguard always; Support too with Reach/Ranged) must
 * be dealt with first, exactly like it gates ordinary creature-targeting.
 * Infiltrate bypasses Taunt for Hero-targeting the same way it bypasses
 * everything else about enemy row state.
 */
function validateTarget(
  state: GameState,
  attackerOwner: PlayerId,
  reach: ReachProfile,
  target: AttackTarget,
): ValidationResult {
  const defenderOwner = otherPlayer(attackerOwner);
  const defenderBoard = state.players[defenderOwner].board;

  if (target.type === "creature") {
    const onVanguard = defenderBoard.vanguard.some((c) => c?.instanceId === target.instanceId);
    if (onVanguard) return checkTaunt(defenderBoard.vanguard, target.instanceId, "Vanguard");

    const onSupport = defenderBoard.support.some((c) => c?.instanceId === target.instanceId);
    if (onSupport) {
      if (!reach.reach && !reach.ranged) {
        return { ok: false, reason: "Can only reach enemy Support with Reach or Ranged." };
      }
      return checkTaunt(defenderBoard.support, target.instanceId, "Support");
    }
    return { ok: false, reason: "Target creature not found." };
  }

  if (reach.infiltrate) return { ok: true };

  if (target.type === "player") {
    if (rowHasTaunt(defenderBoard.vanguard)) {
      return { ok: false, reason: "An enemy Taunt creature in Vanguard must be attacked first." };
    }
    if ((reach.reach || reach.ranged) && rowHasTaunt(defenderBoard.support)) {
      return { ok: false, reason: "An enemy Taunt creature in Support must be attacked first." };
    }
    return { ok: true };
  }

  // target.type === "building"
  const column = defenderBoard.buildings.findIndex((c) => c?.instanceId === target.instanceId);
  if (column === -1) return { ok: false, reason: "Target Building not found." };
  const columnClear = defenderBoard.vanguard[column] === null && defenderBoard.support[column] === null;
  if (!columnClear) {
    return {
      ok: false,
      reason: "That Building's column must be cleared first, or the attacker needs Infiltrate.",
    };
  }
  return { ok: true };
}

/** Fires a creature's onDefend trigger (Counter keyword) when it's targeted by an attack. */
function fireOnDefendTrigger(
  state: GameState,
  defenderOwner: PlayerId,
  defender: CardInstance,
  attackerTarget: EffectTargetRef,
): void {
  const def = CARD_DEFINITIONS[defender.defId] as CreatureDefinition;
  for (const trigger of def.triggers) {
    if (trigger.on === "onDefend") {
      resolveEffect(state, defenderOwner, trigger.effect, attackerTarget);
    }
  }
}

/**
 * Attacker deals damage to a creature target; the defending creature trades
 * damage back — unless the attacker is Ranged. A Ranged attacker fires from
 * outside melee range, so it never takes retaliation damage regardless of
 * what it's attacking. Ranged has no effect on defense: a Ranged creature
 * that gets attacked (by anyone) trades damage back exactly like melee vs
 * melee — Ranged is an attacker-side privilege, not a defensive one.
 */
function resolveCreatureTrade(
  state: GameState,
  attackerOwner: PlayerId,
  attackerInstanceId: string | "hero",
  attackerAttack: number,
  attackerIsRanged: boolean,
  defenderOwner: PlayerId,
  defenderInstanceId: string,
): void {
  const defenderBoard = state.players[defenderOwner].board;
  const defender =
    defenderBoard.vanguard.find((c) => c?.instanceId === defenderInstanceId) ??
    defenderBoard.support.find((c) => c?.instanceId === defenderInstanceId) ??
    null;
  if (!defender) return;
  const defenderAttack = getCreatureAttack(defender);

  const attackerTarget: EffectTargetRef =
    attackerInstanceId === "hero"
      ? { kind: "player", owner: attackerOwner }
      : { kind: "card", owner: attackerOwner, instanceId: attackerInstanceId };
  fireOnDefendTrigger(state, defenderOwner, defender, attackerTarget);

  damageCard(state, defenderOwner, defenderInstanceId, attackerAttack);

  if (attackerIsRanged || defenderAttack <= 0) return;

  if (attackerInstanceId === "hero") {
    damagePlayer(state, attackerOwner, defenderAttack);
  } else {
    damageCard(state, attackerOwner, attackerInstanceId, defenderAttack);
  }
}

/**
 * Non-mutating preview of whether declareCreatureAttack/declareHeroAttack
 * would accept this target right now. The UI uses this to decide what to
 * highlight as clickable during a pending attack, so it never lights up a
 * target the engine would then reject.
 */
export function canAttack(
  state: GameState,
  attackerOwner: PlayerId,
  attackerId: string | "hero",
  target: AttackTarget,
): boolean {
  if (attackerId === "hero") {
    return heroCanAttack(state, attackerOwner) && validateTarget(state, attackerOwner, NO_REACH, target).ok;
  }
  const board = state.players[attackerOwner].board;
  const onVanguard = board.vanguard.find((c) => c?.instanceId === attackerId) ?? null;
  const onSupport = onVanguard ? null : board.support.find((c) => c?.instanceId === attackerId) ?? null;
  const attacker = onVanguard ?? onSupport;
  if (!attacker) return false;
  const def = CARD_DEFINITIONS[attacker.defId] as CreatureDefinition;
  const reach = reachProfileOf(def);
  if (onSupport && !reach.ranged) return false;
  if (!creatureCanAttack(state, attacker)) return false;
  return validateTarget(state, attackerOwner, reach, target).ok;
}

export function declareCreatureAttack(
  state: GameState,
  attackerOwner: PlayerId,
  attackerInstanceId: string,
  target: AttackTarget,
): ValidationResult {
  const board = state.players[attackerOwner].board;
  const onVanguard = board.vanguard.find((c) => c?.instanceId === attackerInstanceId) ?? null;
  const onSupport = onVanguard ? null : board.support.find((c) => c?.instanceId === attackerInstanceId) ?? null;
  const attacker = onVanguard ?? onSupport;
  if (!attacker) return { ok: false, reason: "Attacker not found on the board." };
  const def = CARD_DEFINITIONS[attacker.defId] as CreatureDefinition;
  const reach = reachProfileOf(def);
  if (onSupport && !reach.ranged) {
    return { ok: false, reason: "Only Ranged creatures can attack from Support." };
  }
  if (!creatureCanAttack(state, attacker)) {
    return { ok: false, reason: "This creature can't attack right now." };
  }
  const validation = validateTarget(state, attackerOwner, reach, target);
  if (!validation.ok) return validation;

  const attackerAttack = getCreatureAttack(attacker);
  const defenderOwner = otherPlayer(attackerOwner);

  if (target.type === "creature") {
    resolveCreatureTrade(state, attackerOwner, attackerInstanceId, attackerAttack, reach.ranged, defenderOwner, target.instanceId);
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
  const validation = validateTarget(state, attackerOwner, NO_REACH, target);
  if (!validation.ok) return validation;

  const attackerAttack = getHeroAttack(state, attackerOwner);
  const defenderOwner = otherPlayer(attackerOwner);

  if (target.type === "creature") {
    // Heroes have no Ranged weapon flag yet (Equipment has no `ranged` field) — always a melee trade for now.
    resolveCreatureTrade(state, attackerOwner, "hero", attackerAttack, false, defenderOwner, target.instanceId);
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
