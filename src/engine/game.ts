import { CARD_DEFINITIONS } from "../data/cards";
import { drawCard, drawStartingHand } from "./deck";
import { killCardIfDead, resolveEffect, type EffectTargetRef } from "./effects";
import { tickStatuses } from "./status";
import {
  STARTING_HAND_SIZE,
  otherPlayer,
  type BuildingDefinition,
  type CardArchetype,
  type CardInstance,
  type CreatureDefinition,
  type GameState,
  type PlayerId,
  type PlayerState,
  type ResourcePool,
} from "./types";

export interface ActionResult {
  ok: boolean;
  reason?: string;
}

function findOpenSlot(row: (CardInstance | null)[], preferred?: number): number {
  if (preferred !== undefined && row[preferred] === null) return preferred;
  return row.findIndex((c) => c === null);
}

function processEndOfTurnStatuses(state: GameState, owner: PlayerId): void {
  const player = state.players[owner];
  for (const row of ["vanguard", "support", "buildings"] as const) {
    for (const card of player.board[row]) {
      if (!card) continue;
      const dmg = tickStatuses(card);
      if (dmg > 0 && card.currentHp !== undefined) {
        card.currentHp -= dmg;
        state.log.push(`${card.defId} (${owner}) took ${dmg} status damage.`);
        killCardIfDead(state, owner, card.instanceId);
      }
    }
  }
  const heroDmg = tickStatuses(player.hero);
  if (heroDmg > 0) {
    player.hero.currentHp -= heroDmg;
    state.log.push(`${owner}'s Hero took ${heroDmg} status damage.`);
    if (player.hero.currentHp <= 0 && !state.winner) {
      state.winner = otherPlayer(owner);
      state.log.push(`${state.winner} wins! ${owner}'s Hero fell to status damage.`);
    }
  }
}

/** Draw phase: reset attack flags, refill pools, draw, fire startOfTurn triggers. */
export function startTurn(state: GameState): void {
  state.phase = "draw";
  const player = state.players[state.activePlayer];

  for (const card of [...player.board.vanguard, ...player.board.support]) {
    if (card) card.hasAttackedThisTurn = false;
  }
  player.hero.hasAttackedThisTurn = false;

  // Energy/Mana are tempo pools and fully refill each turn. Resources is a
  // persistent stockpile (Buildings/Equipment) and does NOT refill to cap —
  // instead it trickles up by a flat +1/turn (capped at its current max), on
  // top of whatever's left from spending or a gainCap effect. Without this,
  // a player who ever spent Resources down to 0 had no way back in without
  // already owning a Resources-generating Building (DESIGN.md §2).
  player.mana.current = player.mana.cap;
  player.energy.current = player.energy.cap;
  player.resources.current = Math.min(player.resources.cap, player.resources.current + 1);

  // The player who goes first skips their turn-1 draw (standard alternating-turn balancing).
  if (state.turnNumber > 1) {
    drawCard(state, state.activePlayer);
  }

  for (const row of ["vanguard", "support", "buildings"] as const) {
    for (const card of player.board[row]) {
      if (!card) continue;
      const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition | BuildingDefinition;
      for (const trigger of def.triggers) {
        if (trigger.on === "startOfTurn") {
          resolveEffect(state, state.activePlayer, trigger.effect, null);
        }
      }
    }
  }

  state.phase = "main";
}

export function startGame(state: GameState): void {
  drawStartingHand(state, "player", STARTING_HAND_SIZE);
  drawStartingHand(state, "opponent", STARTING_HAND_SIZE);
  startTurn(state);
}

export function endTurn(state: GameState): void {
  processEndOfTurnStatuses(state, state.activePlayer);
  state.phase = "end";
  if (state.winner) return;

  state.activePlayer = otherPlayer(state.activePlayer);
  state.turnNumber += 1;
  startTurn(state);
}

export interface PlayCardOptions {
  slotIndex?: number;
  target?: EffectTargetRef;
}

/**
 * Which pool pays to play a card of this archetype, and its display name for
 * error messages. Each archetype's pool covers both playing it from hand and
 * (for Spells/Abilities) activating it on the field — see DESIGN.md §2.
 */
export function costPoolFor(player: PlayerState, archetype: CardArchetype): { pool: ResourcePool; label: string } {
  if (archetype === "creature" || archetype === "ability") return { pool: player.energy, label: "Energy" };
  if (archetype === "spell") return { pool: player.mana, label: "Mana" };
  return { pool: player.resources, label: "Resources" };
}

/** Plays a card from hand: pays its cost from the pool its archetype uses, and places it on the board. */
export function playCardFromHand(
  state: GameState,
  owner: PlayerId,
  handInstanceId: string,
  options: PlayCardOptions = {},
): ActionResult {
  const player = state.players[owner];
  const handIndex = player.hand.findIndex((c) => c.instanceId === handInstanceId);
  if (handIndex === -1) return { ok: false, reason: "Card not in hand." };
  const card = player.hand[handIndex];
  const def = CARD_DEFINITIONS[card.defId];
  const { pool, label } = costPoolFor(player, def.archetype);

  if (pool.current < def.cost) {
    return { ok: false, reason: `Not enough ${label}.` };
  }

  let slot = -1;
  if (def.archetype === "creature") {
    // Vanguard only for now — Support has no way to be deliberately placed into
    // until Advance/Ranged land in Phase B (DESIGN.md §5/§17).
    slot = findOpenSlot(player.board.vanguard, options.slotIndex);
    if (slot === -1) return { ok: false, reason: "Vanguard is full." };
  } else if (def.archetype === "building") {
    slot = findOpenSlot(player.board.buildings, options.slotIndex);
    if (slot === -1) return { ok: false, reason: "No open Building slot." };
  } else if (def.archetype === "spell" || def.archetype === "ability") {
    slot = findOpenSlot(player.board.spellAbilitySlots, options.slotIndex);
    if (slot === -1) return { ok: false, reason: "No open Spell/Ability slot." };
  }

  pool.current -= def.cost;
  player.hand.splice(handIndex, 1);

  if (def.archetype === "creature") {
    card.summonedTurn = state.turnNumber;
    player.board.vanguard[slot] = card;
    for (const trigger of def.triggers) {
      if (trigger.on === "onPlay") resolveEffect(state, owner, trigger.effect, options.target ?? null);
    }
  } else if (def.archetype === "building") {
    player.board.buildings[slot] = card;
    for (const trigger of def.triggers) {
      if (trigger.on === "onPlay") resolveEffect(state, owner, trigger.effect, options.target ?? null);
    }
  } else if (def.archetype === "spell" || def.archetype === "ability") {
    player.board.spellAbilitySlots[slot] = card;
  } else if (def.archetype === "equipment") {
    if (player.board.equipment) player.discard.push(player.board.equipment);
    player.board.equipment = card;
  }

  return { ok: true };
}

/** Activates a Spell (Mana) or Ability (Energy) already sitting in a field slot. */
export function activateSlotCard(
  state: GameState,
  owner: PlayerId,
  slotIndex: number,
  target: EffectTargetRef = null,
): ActionResult {
  const player = state.players[owner];
  const card = player.board.spellAbilitySlots[slotIndex];
  if (!card) return { ok: false, reason: "No card in that slot." };
  const def = CARD_DEFINITIONS[card.defId];
  if (def.archetype !== "spell" && def.archetype !== "ability") {
    return { ok: false, reason: "Not an activatable card." };
  }

  const pool = def.archetype === "spell" ? player.mana : player.energy;
  if (pool.current < def.activateCost) {
    return { ok: false, reason: `Not enough ${def.archetype === "spell" ? "Mana" : "Energy"}.` };
  }
  if (card.chargesRemaining === 0) {
    return { ok: false, reason: "This card has no charges left." };
  }

  pool.current -= def.activateCost;
  resolveEffect(state, owner, def.effect, target, def.archetype);

  if (typeof card.chargesRemaining === "number") {
    card.chargesRemaining -= 1;
    if (card.chargesRemaining <= 0) {
      player.board.spellAbilitySlots[slotIndex] = null;
      player.discard.push(card);
      state.log.push(`${card.defId} (${owner}) ran out of charges and was discarded.`);
    }
  }

  return { ok: true };
}

/** Voluntarily discards a still-charged Spell/Ability from its slot to free it up. */
export function discardSlotCard(state: GameState, owner: PlayerId, slotIndex: number): void {
  const player = state.players[owner];
  const card = player.board.spellAbilitySlots[slotIndex];
  if (!card) return;
  player.board.spellAbilitySlots[slotIndex] = null;
  player.discard.push(card);
}
