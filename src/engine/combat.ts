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

/** Where a creature currently sits on its owner's board — its row and every column it occupies (>1 for Massive). Null if it's not on a board row at all. */
function locateOnBoard(
  state: GameState,
  owner: PlayerId,
  instanceId: string,
): { row: (CardInstance | null)[]; columns: number[] } | null {
  const board = state.players[owner].board;
  for (const row of [board.vanguard, board.support]) {
    const columns: number[] = [];
    row.forEach((c, i) => {
      if (c?.instanceId === instanceId) columns.push(i);
    });
    if (columns.length > 0) return { row, columns };
  }
  return null;
}

function isFlanking(row: (CardInstance | null)[], columns: number[]): boolean {
  return columns.some((i) => i === 0 || i === row.length - 1);
}

function hasFormationAlly(row: (CardInstance | null)[], columns: number[], instanceId: string): boolean {
  const left = row[Math.min(...columns) - 1];
  const right = row[Math.max(...columns) + 1];
  return (left !== null && left.instanceId !== instanceId) || (right !== null && right.instanceId !== instanceId);
}

/**
 * Live Attack including Flank/Formation bonuses (DESIGN.md §5). Those
 * bonuses are continuously re-evaluated from current board position, never
 * stored on the CardInstance — this is the function anything actually
 * dealing or previewing combat damage should call instead of the bare
 * getCreatureAttack. Falls back to the base value if the creature isn't
 * currently on a board row at all.
 */
export function getEffectiveCreatureAttack(state: GameState, owner: PlayerId, card: CardInstance): number {
  const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition;
  let attack = def.attack + card.attackDelta;
  const located = locateOnBoard(state, owner, card.instanceId);
  if (!located) return attack;
  if (def.flankBonus && def.keywords.includes("flank") && isFlanking(located.row, located.columns)) {
    attack += def.flankBonus.attackDelta;
  }
  if (def.formationBonus && def.keywords.includes("formation") && hasFormationAlly(located.row, located.columns, card.instanceId)) {
    attack += def.formationBonus.attackDelta;
  }
  return attack;
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
 * Reach-tier targeting (DESIGN.md §5) — the basic combat ladder is
 * Vanguard, then Support, then Buildings/Hero:
 * - Base (no reach keyword) can hit enemy Vanguard freely (subject to
 *   Taunt); once enemy Vanguard is completely empty, Support becomes the
 *   next rung of the ladder and is fair game too (subject to Support's own
 *   Taunt) — so a board of nothing-but-Support creatures is never
 *   untouchable just because the attacker lacks a keyword.
 * - Reach/Ranged skip straight to the Support rung: they can hit enemy
 *   Support directly even while Vanguard is still populated, on top of
 *   everything Base can already do.
 * - Infiltrate bypasses straight to enemy Buildings regardless of row
 *   state. Buildings are gated per-column (both rows in that column must
 *   be empty) rather than needing the whole board cleared.
 *
 * The enemy Guard/Hero has no *board-population* gate — a full enemy
 * Vanguard/Support no longer walls it off by itself, every attacker can
 * still reach past ordinary creatures straight to the Hero. Taunt is the
 * one thing that still stops it: a Taunt creature in a row this attacker
 * can actually reach (Vanguard always; Support too with Reach/Ranged, or
 * with Base once Vanguard is empty) must be dealt with first, exactly like
 * it gates ordinary creature-targeting. Infiltrate bypasses Taunt for
 * Hero-targeting the same way it bypasses everything else about enemy row
 * state. Spells/Abilities aren't part of this ladder at all — they can
 * always target any creature in either row directly and ignore Taunt
 * entirely (see targeting.ts).
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
      const vanguardEmpty = defenderBoard.vanguard.every((c) => c === null);
      if (!reach.reach && !reach.ranged && !vanguardEmpty) {
        return {
          ok: false,
          reason: "Enemy Vanguard must be cleared first to reach Support, or the attacker needs Reach/Ranged.",
        };
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
    // Support Taunt only matters for an attacker that can actually reach
    // Support — Reach/Ranged always can; a Base attacker only once
    // Vanguard is empty (the same ladder rule as creature-targeting above).
    const canReachSupport = reach.reach || reach.ranged || defenderBoard.vanguard.every((c) => c === null);
    if (canReachSupport && rowHasTaunt(defenderBoard.support)) {
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
 * Protector (DESIGN.md §5): when a creature-target attack is declared
 * against an allied creature, the defending player may redirect it onto a
 * same-row Protector before damage resolves. DESIGN.md frames this as a
 * live, manual, reactive choice for the defender; this engine applies it
 * automatically as a heuristic instead of a real-time prompt (see the
 * implementation-status note) — it only fires when the original target
 * would otherwise die to this hit, redirecting to whichever eligible
 * Protector survives the hit (or, failing that, the healthiest one).
 */
function pickProtectorRedirect(
  state: GameState,
  defenderOwner: PlayerId,
  originalTargetInstanceId: string,
  incomingDamage: number,
): CardInstance | null {
  const board = state.players[defenderOwner].board;
  const row = board.vanguard.some((c) => c?.instanceId === originalTargetInstanceId) ? board.vanguard : board.support;
  const originalTarget = row.find((c) => c?.instanceId === originalTargetInstanceId);
  if (!originalTarget || (originalTarget.currentHp ?? 0) > incomingDamage) return null;

  const protectors = row.filter(
    (c): c is CardInstance => c !== null && c.instanceId !== originalTargetInstanceId && hasKeyword(c, "protector"),
  );
  if (protectors.length === 0) return null;
  const survivors = protectors.filter((p) => (p.currentHp ?? 0) > incomingDamage);
  const pool = survivors.length > 0 ? survivors : protectors;
  return pool.reduce((a, b) => ((a.currentHp ?? 0) >= (b.currentHp ?? 0) ? a : b));
}

/**
 * Attacker deals damage to a creature target; the defending creature trades
 * damage back — unless the attacker is Ranged *and* the defender isn't. A
 * Ranged attacker fires from outside melee range, so a melee defender can't
 * hit back at all — but a Ranged defender just shoots back the same way,
 * so two Ranged creatures trade normally. Ranged has no effect on defense
 * by itself: a Ranged creature being attacked by a melee attacker still
 * trades damage back exactly like melee vs melee.
 */
function resolveCreatureTrade(
  state: GameState,
  attackerOwner: PlayerId,
  attackerInstanceId: string | "hero",
  attackerAttack: number,
  attackerIsRanged: boolean,
  attackerHasPush: boolean,
  defenderOwner: PlayerId,
  defenderInstanceId: string,
): void {
  const defenderBoard = state.players[defenderOwner].board;

  const redirect = pickProtectorRedirect(state, defenderOwner, defenderInstanceId, attackerAttack);
  if (redirect) state.log.push(`${redirect.defId} (${defenderOwner}) steps in as Protector.`);
  const actualDefenderId = redirect ? redirect.instanceId : defenderInstanceId;

  const vanguardColumn = defenderBoard.vanguard.findIndex((c) => c?.instanceId === actualDefenderId);
  const defender =
    (vanguardColumn !== -1 ? defenderBoard.vanguard[vanguardColumn] : null) ??
    defenderBoard.support.find((c) => c?.instanceId === actualDefenderId) ??
    null;
  if (!defender) return;
  const defenderAttack = getEffectiveCreatureAttack(state, defenderOwner, defender);

  const attackerTarget: EffectTargetRef =
    attackerInstanceId === "hero"
      ? { kind: "player", owner: attackerOwner }
      : { kind: "card", owner: attackerOwner, instanceId: attackerInstanceId };
  fireOnDefendTrigger(state, defenderOwner, defender, attackerTarget);

  damageCard(state, defenderOwner, actualDefenderId, attackerAttack);

  // Push (DESIGN.md §5): if the defender was in Vanguard and survives, and
  // its column's Support slot is open, it gets shoved back there. Only
  // applies to single-slot defenders — a Massive creature doesn't fit into
  // one Support slot.
  if (attackerHasPush && vanguardColumn !== -1 && (defender.currentHp ?? 0) > 0 && defenderBoard.support[vanguardColumn] === null) {
    const defenderDef = CARD_DEFINITIONS[defender.defId] as CreatureDefinition;
    if ((defenderDef.spaceCost ?? 1) === 1) {
      defenderBoard.vanguard[vanguardColumn] = null;
      defenderBoard.support[vanguardColumn] = defender;
      state.log.push(`${defender.defId} (${defenderOwner}) is pushed back into Support.`);
    }
  }

  const attackerEscapesRetaliation = attackerIsRanged && !hasKeyword(defender, "ranged");
  if (attackerEscapesRetaliation || defenderAttack <= 0) return;

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

  const attackerAttack = getEffectiveCreatureAttack(state, attackerOwner, attacker);
  const defenderOwner = otherPlayer(attackerOwner);

  if (target.type === "creature") {
    resolveCreatureTrade(
      state,
      attackerOwner,
      attackerInstanceId,
      attackerAttack,
      reach.ranged,
      def.keywords.includes("push"),
      defenderOwner,
      target.instanceId,
    );
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
    // Heroes have no Ranged/Push weapon flags yet (Equipment has no such fields) — always a plain melee trade for now.
    resolveCreatureTrade(state, attackerOwner, "hero", attackerAttack, false, false, defenderOwner, target.instanceId);
  } else if (target.type === "building") {
    damageCard(state, defenderOwner, target.instanceId, attackerAttack);
  } else {
    damagePlayer(state, defenderOwner, attackerAttack);
  }

  state.players[attackerOwner].hero.hasAttackedThisTurn = true;
  return { ok: true };
}

/**
 * Advance (DESIGN.md §5): a Support creature with this keyword may spend 1
 * Energy to move into the same-column Vanguard slot(s) instead of
 * attacking this turn. Uses the same Ready/summoning-sickness gate as
 * attacking (creatureCanAttack) since it's an alternative to attacking, and
 * exhausts the creature the same way.
 */
export function declareAdvance(state: GameState, owner: PlayerId, instanceId: string): ValidationResult {
  const player = state.players[owner];
  const board = player.board;
  const columns: number[] = [];
  board.support.forEach((c, i) => {
    if (c?.instanceId === instanceId) columns.push(i);
  });
  if (columns.length === 0) return { ok: false, reason: "This creature isn't in Support." };
  const card = board.support[columns[0]]!;
  const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition;
  if (!def.keywords.includes("advance")) return { ok: false, reason: "This creature can't Advance." };
  if (!creatureCanAttack(state, card)) return { ok: false, reason: "This creature can't act right now." };
  if (player.energy.current < 1) return { ok: false, reason: "Not enough Energy." };
  if (columns.some((i) => board.vanguard[i] !== null)) {
    return { ok: false, reason: "The Vanguard slot in its column isn't empty." };
  }

  player.energy.current -= 1;
  for (const i of columns) {
    board.support[i] = null;
    board.vanguard[i] = card;
  }
  card.hasAttackedThisTurn = true;
  state.log.push(`${card.defId} (${owner}) advances into Vanguard.`);
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
