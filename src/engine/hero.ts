import { CARD_DEFINITIONS } from "../data/cards";
import { resolveEffect, type EffectTargetRef } from "./effects";
import type { CardInstance, CreatureDefinition, GameState, HeroCardDefinition, PlayerId } from "./types";

export interface ActionResult {
  ok: boolean;
  reason?: string;
}

function heroDefOf(state: GameState, owner: PlayerId): HeroCardDefinition {
  return CARD_DEFINITIONS[state.players[owner].hero.defId] as HeroCardDefinition;
}

/**
 * Live Attack bonus from the controller's Hero Passive (DESIGN.md §9), if
 * it's an auraBuff matching this creature. Same "recomputed on demand,
 * never stored on the CardInstance" approach as Flank/Formation
 * (getEffectiveCreatureAttack in combat.ts calls this too) — and the same
 * Attack-only simplification, for the same reason (see PassiveEffect's
 * doc comment in types.ts).
 */
export function getAuraAttackBonus(state: GameState, owner: PlayerId, card: CardInstance): number {
  const passive = heroDefOf(state, owner).passive;
  if (!passive || passive.kind !== "auraBuff") return 0;
  const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition;
  const filter = passive.filter;
  const matches = filter === "all" || ("race" in filter ? (def.races?.includes(filter.race) ?? false) : def.faction === filter.faction);
  return matches ? passive.attackDelta : 0;
}

/**
 * Non-mutating look at what firstSpellDiscount (DESIGN.md §9) would bring a
 * Spell's Mana cost down to, without marking it used. Callers use this for
 * affordability checks, so a cast that turns out to be unaffordable doesn't
 * consume the turn's discount — only applySpellDiscount, called once the
 * action is confirmed to proceed, actually spends it.
 */
export function peekSpellDiscount(state: GameState, owner: PlayerId, baseCost: number): number {
  const player = state.players[owner];
  const passive = heroDefOf(state, owner).passive;
  if (!passive || passive.kind !== "firstSpellDiscount" || player.hero.firstSpellDiscountUsedThisTurn) {
    return baseCost;
  }
  return Math.max(0, baseCost - passive.amount);
}

/**
 * Applies the controller's firstSpellDiscount Passive (DESIGN.md §9), if
 * they have one and haven't already used it this turn, to a Spell's Mana
 * cost — marking it used for the turn as a side effect. Called from both
 * the Instant cast-from-hand path and activateSlotCard (Ritual/Charged),
 * the two places a Spell's Mana cost is actually paid — always after an
 * affordability check already done via peekSpellDiscount, so this only
 * runs once the action is committed.
 */
export function applySpellDiscount(state: GameState, owner: PlayerId, baseCost: number): number {
  const discounted = peekSpellDiscount(state, owner, baseCost);
  if (discounted !== baseCost) {
    state.players[owner].hero.firstSpellDiscountUsedThisTurn = true;
  }
  return discounted;
}

/** Hero Power (DESIGN.md §9): Energy-costed, usable once per turn — resets every startTurn. */
export function activateHeroPower(state: GameState, owner: PlayerId, target: EffectTargetRef = null): ActionResult {
  const player = state.players[owner];
  const power = heroDefOf(state, owner).heroPower;
  if (!power) return { ok: false, reason: "This Hero has no Hero Power." };
  if (player.hero.heroPowerUsedThisTurn) return { ok: false, reason: "Hero Power already used this turn." };
  if (player.energy.current < power.activateCost) return { ok: false, reason: "Not enough Energy." };

  player.energy.current -= power.activateCost;
  player.hero.heroPowerUsedThisTurn = true;
  resolveEffect(state, owner, power.effect, target);
  state.log.push(`${owner} uses their Hero Power.`);
  return { ok: true };
}

/** Signature Ability (DESIGN.md §9): same shape as Hero Power, but a limited number of uses for the whole match — never resets. */
export function activateHeroSignature(state: GameState, owner: PlayerId, target: EffectTargetRef = null): ActionResult {
  const player = state.players[owner];
  const signature = heroDefOf(state, owner).signature;
  if (!signature) return { ok: false, reason: "This Hero has no Signature Ability." };
  if (!player.hero.signatureUsesRemaining || player.hero.signatureUsesRemaining <= 0) {
    return { ok: false, reason: "No Signature Ability uses remaining this match." };
  }
  if (player.energy.current < signature.activateCost) return { ok: false, reason: "Not enough Energy." };

  player.energy.current -= signature.activateCost;
  player.hero.signatureUsesRemaining -= 1;
  resolveEffect(state, owner, signature.effect, target);
  state.log.push(`${owner} uses their Signature Ability.`);
  return { ok: true };
}
