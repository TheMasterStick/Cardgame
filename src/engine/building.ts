import { CARD_DEFINITIONS } from "../data/cards";
import { resolveEffect, type EffectTargetRef } from "./effects";
import type { BuildingDefinition, CardInstance, CreatureDefinition, GameState, PlayerId, PlayerState, ResourcePool } from "./types";

export interface ActionResult {
  ok: boolean;
  reason?: string;
}

function ownedBuildings(state: GameState, owner: PlayerId): CardInstance[] {
  return state.players[owner].board.buildings.filter((c): c is CardInstance => c !== null);
}

/**
 * Live Attack bonus from the controller's Building passives (DESIGN.md
 * §11), summed across every Building on their board whose passive is an
 * auraBuff matching this creature — Buildings can stack with each other
 * and with the Hero's own aura, same "live, never stored" approach as
 * Flank/Formation/the Hero aura (getEffectiveCreatureAttack in combat.ts
 * calls this too).
 */
export function getBuildingAuraAttackBonus(state: GameState, owner: PlayerId, card: CardInstance): number {
  const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition;
  let bonus = 0;
  for (const building of ownedBuildings(state, owner)) {
    const passive = (CARD_DEFINITIONS[building.defId] as BuildingDefinition).passive;
    if (!passive) continue;
    const filter = passive.filter;
    const matches = filter === "all" || ("race" in filter ? def.race === filter.race : def.faction === filter.faction);
    if (matches) bonus += passive.attackDelta;
  }
  return bonus;
}

function poolFor(player: PlayerState, pool: "resource" | "mana" | "energy"): { pool: ResourcePool; label: string } {
  if (pool === "mana") return { pool: player.mana, label: "Mana" };
  if (pool === "energy") return { pool: player.energy, label: "Energy" };
  return { pool: player.resources, label: "Resources" };
}

/**
 * Activates a Building's ability (DESIGN.md §11) — Resources-costed by
 * default, or whichever pool the card specifies (e.g. a Demon Gate
 * spending Mana). No charge count: a Building is a persistent battlefield
 * object, not consumed on use, so this is gated only by affordability —
 * repeatable freely, even more than once per turn, unlike Hero Power.
 */
export function activateBuildingAbility(
  state: GameState,
  owner: PlayerId,
  slotIndex: number,
  target: EffectTargetRef = null,
): ActionResult {
  const player = state.players[owner];
  const card = player.board.buildings[slotIndex];
  if (!card) return { ok: false, reason: "No Building in that slot." };
  const def = CARD_DEFINITIONS[card.defId] as BuildingDefinition;
  const ability = def.ability;
  if (!ability) return { ok: false, reason: "This Building has no activated ability." };

  const { pool, label } = poolFor(player, ability.pool ?? "resource");
  if (pool.current < ability.activateCost) return { ok: false, reason: `Not enough ${label}.` };

  pool.current -= ability.activateCost;
  resolveEffect(state, owner, ability.effect, target);
  state.log.push(`${card.defId} (${owner})'s ability activates.`);
  return { ok: true };
}
