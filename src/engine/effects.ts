import { CARD_DEFINITIONS } from "../data/cards";
import { findOpenContiguousSlots } from "./board";
import { drawCard } from "./deck";
import { getBearerDamageReduction, unassignEquipmentFrom } from "./equipment";
import { createCardInstance } from "./factory";
import { applyStatus } from "./status";
import {
  MAX_POOL,
  otherPlayer,
  type BuildingDefinition,
  type CardArchetype,
  type CardEffect,
  type CardInstance,
  type CreatureDefinition,
  type GameState,
  type Keyword,
  type PlayerId,
} from "./types";

export function hasKeyword(card: CardInstance, keyword: Keyword): boolean {
  const def = CARD_DEFINITIONS[card.defId];
  return def.archetype === "creature" && def.keywords.includes(keyword);
}

/** Immune blocks any spell effect from landing on the creature — not abilities or creature-native triggers. */
function isImmuneToSpell(card: CardInstance, sourceArchetype: CardArchetype | undefined): boolean {
  return sourceArchetype === "spell" && hasKeyword(card, "immune");
}

/**
 * Stealth (DESIGN.md §7) can't be chosen as the target of a hostile Spell or
 * Ability — creature/building triggers (onPlay/onAttack/etc., no
 * sourceArchetype) aren't scoped by this, matching how Immune is also only
 * a Spell-archetype concern. AOE effects never reach this check at all
 * (they don't go through a single-target CardInstance lookup), so Stealth
 * staying vulnerable to `allEnemyCreatures` falls out naturally.
 */
function isStealthedFromTargeting(card: CardInstance, sourceArchetype: CardArchetype | undefined): boolean {
  return (sourceArchetype === "spell" || sourceArchetype === "ability") && hasKeyword(card, "stealth") && !card.stealthBroken;
}

/**
 * Ward (DESIGN.md §7) negates the next hostile Spell or Ability that
 * directly targets this creature — one-time, then consumed. Only called
 * from the damage/applyStatus branches (the "hostile" CardEffect kinds);
 * heal/buff never reach here since they're friendly-targeted. Checked
 * after Immune, so a creature with both just eats the Immune block for
 * free rather than burning its Ward.
 */
function tryConsumeWard(state: GameState, owner: PlayerId, card: CardInstance, sourceArchetype: CardArchetype | undefined): boolean {
  if (sourceArchetype !== "spell" && sourceArchetype !== "ability") return false;
  if (!hasKeyword(card, "ward") || card.wardConsumed) return false;
  card.wardConsumed = true;
  state.log.push(`${card.defId} (${owner})'s Ward negates the effect.`);
  return true;
}

/**
 * All creatures across both rows, deduplicated by instanceId. A Massive
 * creature (DESIGN.md §5) occupies more than one slot with the same
 * instance — without dedup, an AOE effect would hit/buff it once per slot.
 */
function allBoardCreatures(rows: { vanguard: (CardInstance | null)[]; support: (CardInstance | null)[] }): CardInstance[] {
  const seen = new Set<string>();
  const result: CardInstance[] = [];
  for (const c of [...rows.vanguard, ...rows.support]) {
    if (c && !seen.has(c.instanceId)) {
      seen.add(c.instanceId);
      result.push(c);
    }
  }
  return result;
}

/** A target chosen by the caller (UI click or AI decision) for an effect that needs one. */
export type EffectTargetRef =
  | { kind: "card"; owner: PlayerId; instanceId: string }
  | { kind: "player"; owner: PlayerId }
  | null;

function findCard(
  state: GameState,
  owner: PlayerId,
  instanceId: string,
): { card: CardInstance; row: "vanguard" | "support" | "buildings"; index: number } | null {
  const board = state.players[owner].board;
  for (const row of ["vanguard", "support", "buildings"] as const) {
    const index = board[row].findIndex((c) => c?.instanceId === instanceId);
    if (index !== -1) {
      return { card: board[row][index]!, row, index };
    }
  }
  return null;
}

function baseHp(card: CardInstance): number {
  const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition | BuildingDefinition;
  return def.hp;
}

/** Removes a dead creature/building from its row into the graveyard, firing its onDeath trigger. */
export function killCardIfDead(state: GameState, owner: PlayerId, instanceId: string): void {
  const found = findCard(state, owner, instanceId);
  if (!found) return;
  if (found.card.currentHp !== undefined && found.card.currentHp <= 0) {
    const player = state.players[owner];
    // A Massive creature (DESIGN.md §5) occupies every slot it spans with
    // this same instance — clear all of them, not just the first found.
    const row = player.board[found.row];
    for (let i = 0; i < row.length; i++) {
      if (row[i]?.instanceId === instanceId) row[i] = null;
    }
    player.graveyard.push(found.card);
    state.log.push(`${found.card.defId} (${owner}) was destroyed.`);
    // Equipment survives its bearer's death — it returns to Unassigned in
    // the zone rather than being destroyed alongside them (DESIGN.md §12).
    unassignEquipmentFrom(state, owner, instanceId);
    const def = CARD_DEFINITIONS[found.card.defId] as CreatureDefinition | BuildingDefinition;
    for (const trigger of def.triggers) {
      if (trigger.on === "onDeath") resolveEffect(state, owner, trigger.effect, null);
    }
  }
}

/**
 * Damages a specific creature/building instance, then cleans it up if it
 * died. An Armiger creature's equipped Armor reduces the total, same as the
 * Hero's own equipped Armor does for damagePlayer/damageHeroDirect (a
 * Building is never an eligible bearer, so its reduction is always 0).
 * Returns the actual (post-reduction) damage dealt, so a Drain attacker
 * restores Guard matching what the defender really took, not the raw
 * pre-reduction attack value.
 */
export function damageCard(state: GameState, owner: PlayerId, instanceId: string, amount: number): number {
  const found = findCard(state, owner, instanceId);
  if (!found || found.card.currentHp === undefined) return 0;
  const reduction = getBearerDamageReduction(state, owner, { kind: "creature", instanceId });
  const reduced = Math.max(0, amount - reduction);
  found.card.currentHp -= reduced;
  if (found.card.currentHp > 0 && hasKeyword(found.card, "frenzy")) {
    found.card.attackDelta += reduced;
    state.log.push(`${found.card.defId} (${owner}) Frenzies, gaining +${reduced} Attack.`);
  }
  state.log.push(
    `${found.card.defId} (${owner}) took ${reduced} damage${reduction > 0 ? ` (${amount} reduced by ${reduction} Armor)` : ""}.`,
  );
  killCardIfDead(state, owner, instanceId);
  return reduced;
}

export function healCard(state: GameState, owner: PlayerId, instanceId: string, amount: number): void {
  const found = findCard(state, owner, instanceId);
  if (!found || found.card.currentHp === undefined) return;
  const max = baseHp(found.card) + found.card.hpDelta;
  found.card.currentHp = Math.min(max, found.card.currentHp + amount);
}

/**
 * Deals damage to a player through the full Guard -> Hero HP chain
 * (DESIGN.md §6). The Hero's equipped Armor reduces the total. Returns the
 * actual (post-reduction) damage dealt.
 */
export function damagePlayer(state: GameState, target: PlayerId, amount: number): number {
  const player = state.players[target];
  const reduced = Math.max(0, amount - getBearerDamageReduction(state, target, { kind: "hero" }));

  const fromGuard = Math.min(player.guard.current, reduced);
  player.guard.current -= fromGuard;
  const overflow = reduced - fromGuard;
  if (overflow > 0) {
    player.hero.currentHp -= overflow;
  }
  state.log.push(
    `${target} took ${reduced} damage (${fromGuard} to Guard${overflow > 0 ? `, ${overflow} to Hero HP` : ""}).`,
  );
  checkWinner(state);
  return reduced;
}

/** Damages the Hero's HP directly, bypassing Guard entirely. Returns the actual (post-reduction) damage dealt. */
export function damageHeroDirect(state: GameState, target: PlayerId, amount: number): number {
  const player = state.players[target];
  const reduced = Math.max(0, amount - getBearerDamageReduction(state, target, { kind: "hero" }));
  player.hero.currentHp -= reduced;
  state.log.push(`${target}'s Hero took ${reduced} direct damage.`);
  checkWinner(state);
  return reduced;
}

export function healHero(state: GameState, target: PlayerId, amount: number): void {
  const player = state.players[target];
  player.hero.currentHp = Math.min(player.hero.maxHp, player.hero.currentHp + amount);
}

export function gainGuard(state: GameState, target: PlayerId, amount: number): void {
  const player = state.players[target];
  player.guard.max += amount;
  player.guard.current += amount;
}

/** Restores lost Guard back up to its current max — no cap increase, no overflow into Hero HP (Drain keyword, DESIGN.md §7). */
export function restoreGuard(state: GameState, target: PlayerId, amount: number): void {
  const player = state.players[target];
  player.guard.current = Math.min(player.guard.max, player.guard.current + amount);
}

export function gainCap(
  state: GameState,
  target: PlayerId,
  pool: "resource" | "mana" | "energy",
  amount: number,
): void {
  const player = state.players[target];
  const key = pool === "resource" ? "resources" : pool;
  const p = player[key];
  const newCap = Math.min(MAX_POOL, p.cap + amount);
  const actualGain = newCap - p.cap;
  p.cap = newCap;
  p.current = Math.min(newCap, p.current + actualGain);
}

export function checkWinner(state: GameState): void {
  if (state.winner) return;
  for (const id of ["player", "opponent"] as const) {
    if (state.players[id].hero.currentHp <= 0) {
      state.winner = otherPlayer(id);
      state.log.push(`${state.winner} wins! ${id}'s Hero fell.`);
    }
  }
}

/**
 * Resolves any CardEffect against a chosen target (or no target, for
 * effects that don't need one). `actingPlayer` is the controller of the
 * card that produced the effect. `sourceArchetype` — pass "spell" for a
 * Spell card's own activation so Immune creatures correctly block it;
 * omit it for abilities and creature/building triggers, which Immune
 * doesn't affect.
 */
export function resolveEffect(
  state: GameState,
  actingPlayer: PlayerId,
  effect: CardEffect,
  target: EffectTargetRef,
  sourceArchetype?: CardArchetype,
): void {
  switch (effect.kind) {
    case "damage": {
      if (effect.target === "allEnemyCreatures" || effect.target === "allFriendlyCreatures") {
        const owner = effect.target === "allEnemyCreatures" ? otherPlayer(actingPlayer) : actingPlayer;
        for (const c of allBoardCreatures(state.players[owner].board)) {
          if (!isImmuneToSpell(c, sourceArchetype)) damageCard(state, owner, c.instanceId, effect.amount);
        }
        return;
      }
      if (effect.target === "selfHero") {
        damageHeroDirect(state, actingPlayer, effect.amount);
        return;
      }
      if (!target) return;
      if (target.kind === "player") {
        damagePlayer(state, target.owner, effect.amount);
      } else {
        const found = findCard(state, target.owner, target.instanceId);
        if (found && isStealthedFromTargeting(found.card, sourceArchetype)) return;
        if (found && isImmuneToSpell(found.card, sourceArchetype)) return;
        if (found && tryConsumeWard(state, target.owner, found.card, sourceArchetype)) return;
        damageCard(state, target.owner, target.instanceId, effect.amount);
      }
      return;
    }
    case "heal": {
      if (effect.target === "selfHero") {
        healHero(state, actingPlayer, effect.amount);
        return;
      }
      if (!target) return;
      if (target.kind === "player") {
        healHero(state, target.owner, effect.amount);
      } else {
        const found = findCard(state, target.owner, target.instanceId);
        if (found && isImmuneToSpell(found.card, sourceArchetype)) return;
        healCard(state, target.owner, target.instanceId, effect.amount);
      }
      return;
    }
    case "applyStatus": {
      if (effect.target === "selfHero") {
        applyStatus(state.players[actingPlayer].hero, effect.status, effect.amount, effect.duration);
        return;
      }
      if (!target) return;
      if (target.kind === "player") {
        applyStatus(state.players[target.owner].hero, effect.status, effect.amount, effect.duration);
        return;
      }
      const found = findCard(state, target.owner, target.instanceId);
      if (!found || isStealthedFromTargeting(found.card, sourceArchetype)) return;
      if (isImmuneToSpell(found.card, sourceArchetype)) return;
      if (tryConsumeWard(state, target.owner, found.card, sourceArchetype)) return;
      applyStatus(found.card, effect.status, effect.amount, effect.duration);
      return;
    }
    case "buff": {
      const applyBuff = (card: CardInstance) => {
        if (effect.attackDelta) card.attackDelta += effect.attackDelta;
        if (effect.hpDelta) {
          card.hpDelta += effect.hpDelta;
          if (card.currentHp !== undefined) card.currentHp += effect.hpDelta;
        }
      };
      if (effect.target === "allFriendlyCreatures" || effect.target === "allEnemyCreatures") {
        const owner = effect.target === "allFriendlyCreatures" ? actingPlayer : otherPlayer(actingPlayer);
        for (const c of allBoardCreatures(state.players[owner].board)) {
          if (!isImmuneToSpell(c, sourceArchetype)) applyBuff(c);
        }
        return;
      }
      if (!target || target.kind !== "card") return;
      const found = findCard(state, target.owner, target.instanceId);
      if (!found || isImmuneToSpell(found.card, sourceArchetype)) return;
      applyBuff(found.card);
      return;
    }
    case "drawCard": {
      for (let i = 0; i < effect.amount; i++) drawCard(state, actingPlayer);
      return;
    }
    case "gainGuard": {
      gainGuard(state, actingPlayer, effect.amount);
      return;
    }
    case "gainCap": {
      gainCap(state, actingPlayer, effect.pool, effect.amount);
      return;
    }
    case "summonCreature": {
      const def = CARD_DEFINITIONS[effect.creatureId];
      if (!def || def.archetype !== "creature") return;
      const player = state.players[actingPlayer];
      const spaceCost = def.spaceCost ?? 1;
      const vanguardSlots = findOpenContiguousSlots(player.board.vanguard, spaceCost);
      const row = vanguardSlots ? "vanguard" : "support";
      const slots = vanguardSlots ?? findOpenContiguousSlots(player.board.support, spaceCost);
      if (!slots) return; // no room in either row — fizzles, like a Warcry with no legal target
      const summoned = createCardInstance(effect.creatureId, actingPlayer);
      summoned.summonedTurn = state.turnNumber;
      for (const s of slots) player.board[row][s] = summoned;
      state.log.push(`${effect.creatureId} (${actingPlayer}) is summoned.`);
      for (const trigger of def.triggers) {
        if (trigger.on === "onPlay") resolveEffect(state, actingPlayer, trigger.effect, null);
      }
      return;
    }
  }
}
