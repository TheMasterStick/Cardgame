import { CARD_DEFINITIONS } from "../data/cards";
import type { CardInstance, CreatureDefinition, EquipmentBearer, EquipmentDefinition, GameState, PlayerId } from "./types";

export interface ActionResult {
  ok: boolean;
  reason?: string;
}

function sameBearer(a: EquipmentBearer | null | undefined, b: EquipmentBearer): boolean {
  if (!a) return false;
  if (a.kind === "hero" && b.kind === "hero") return true;
  return a.kind === "creature" && b.kind === "creature" && a.instanceId === b.instanceId;
}

/** The zone item (if any) currently equipped to this bearer — DESIGN.md §12: at most 1 item per bearer. */
export function findBearerEquipment(state: GameState, owner: PlayerId, bearer: EquipmentBearer): CardInstance | null {
  const zone = state.players[owner].board.equipment;
  return zone.find((item) => item && sameBearer(item.equipmentBearer, bearer)) ?? null;
}

export function getBearerAttackBonus(state: GameState, owner: PlayerId, bearer: EquipmentBearer): number {
  const item = findBearerEquipment(state, owner, bearer);
  if (!item) return 0;
  return (CARD_DEFINITIONS[item.defId] as EquipmentDefinition).attackBonus;
}

export function getBearerDamageReduction(state: GameState, owner: PlayerId, bearer: EquipmentBearer): number {
  const item = findBearerEquipment(state, owner, bearer);
  if (!item) return 0;
  return (CARD_DEFINITIONS[item.defId] as EquipmentDefinition).damageReduction;
}

function findOwnCreature(state: GameState, owner: PlayerId, instanceId: string): CardInstance | null {
  const board = state.players[owner].board;
  for (const row of [board.vanguard, board.support]) {
    const found = row.find((c) => c?.instanceId === instanceId);
    if (found) return found;
  }
  return null;
}

/**
 * Assigns or reassigns a zone item to a bearer — 1 Energy, as an action
 * (DESIGN.md §12). The Hero is always eligible; a Creature bearer must be
 * alive on the owner's own board and have the Armiger keyword. Each bearer
 * can hold at most 1 item (the "Open default" cap): if the target bearer
 * already holds a different item, that item is bumped back to Unassigned
 * rather than the action being refused.
 */
export function assignEquipment(
  state: GameState,
  owner: PlayerId,
  slotIndex: number,
  bearer: EquipmentBearer,
): ActionResult {
  const player = state.players[owner];
  const item = player.board.equipment[slotIndex];
  if (!item) return { ok: false, reason: "No Equipment in that slot." };

  if (bearer.kind === "creature") {
    const creature = findOwnCreature(state, owner, bearer.instanceId);
    if (!creature) return { ok: false, reason: "That creature isn't on your board." };
    const def = CARD_DEFINITIONS[creature.defId] as CreatureDefinition;
    if (!def.keywords.includes("armiger")) return { ok: false, reason: "Only an Armiger creature can hold Equipment." };
  }

  if (player.energy.current < 1) return { ok: false, reason: "Not enough Energy." };

  if (sameBearer(item.equipmentBearer, bearer)) return { ok: true }; // already equipped there — no-op, no charge

  player.energy.current -= 1;
  for (const other of player.board.equipment) {
    if (other && other !== item && sameBearer(other.equipmentBearer, bearer)) other.equipmentBearer = null;
  }
  item.equipmentBearer = bearer;
  state.log.push(
    `${item.defId} (${owner}) is equipped to ${bearer.kind === "hero" ? "the Hero" : bearer.instanceId}.`,
  );
  return { ok: true };
}

/** Called when a creature dies — its Equipment survives, returning to Unassigned in the zone (DESIGN.md §12) rather than vanishing. */
export function unassignEquipmentFrom(state: GameState, owner: PlayerId, bearerInstanceId: string): void {
  for (const item of state.players[owner].board.equipment) {
    if (item && item.equipmentBearer?.kind === "creature" && item.equipmentBearer.instanceId === bearerInstanceId) {
      item.equipmentBearer = null;
    }
  }
}
