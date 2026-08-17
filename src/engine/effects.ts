import { CARD_DEFINITIONS } from "../data/cards";
import { drawCard } from "./deck";
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
    player.board[found.row][found.index] = null;
    player.graveyard.push(found.card);
    state.log.push(`${found.card.defId} (${owner}) was destroyed.`);
    const def = CARD_DEFINITIONS[found.card.defId] as CreatureDefinition | BuildingDefinition;
    for (const trigger of def.triggers) {
      if (trigger.on === "onDeath") resolveEffect(state, owner, trigger.effect, null);
    }
  }
}

/** Damages a specific creature/building instance, then cleans it up if it died. */
export function damageCard(state: GameState, owner: PlayerId, instanceId: string, amount: number): void {
  const found = findCard(state, owner, instanceId);
  if (!found || found.card.currentHp === undefined) return;
  found.card.currentHp -= amount;
  if (found.card.currentHp > 0 && hasKeyword(found.card, "frenzy")) {
    found.card.attackDelta += amount;
    state.log.push(`${found.card.defId} (${owner}) Frenzies, gaining +${amount} Attack.`);
  }
  state.log.push(`${found.card.defId} (${owner}) took ${amount} damage.`);
  killCardIfDead(state, owner, instanceId);
}

export function healCard(state: GameState, owner: PlayerId, instanceId: string, amount: number): void {
  const found = findCard(state, owner, instanceId);
  if (!found || found.card.currentHp === undefined) return;
  const max = baseHp(found.card) + found.card.hpDelta;
  found.card.currentHp = Math.min(max, found.card.currentHp + amount);
}

/**
 * Deals damage to a player through the full Guard -> Hero HP chain
 * (DESIGN.md §6). Equipment damage reduction applies to the total.
 */
export function damagePlayer(state: GameState, target: PlayerId, amount: number): void {
  const player = state.players[target];
  const equipment = player.board.equipment;
  const def = equipment ? (CARD_DEFINITIONS[equipment.defId] as { damageReduction: number }) : null;
  const reduced = Math.max(0, amount - (def?.damageReduction ?? 0));

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
}

/** Damages the Hero's HP directly, bypassing Guard entirely. */
export function damageHeroDirect(state: GameState, target: PlayerId, amount: number): void {
  const player = state.players[target];
  const equipment = player.board.equipment;
  const def = equipment ? (CARD_DEFINITIONS[equipment.defId] as { damageReduction: number }) : null;
  const reduced = Math.max(0, amount - (def?.damageReduction ?? 0));
  player.hero.currentHp -= reduced;
  state.log.push(`${target}'s Hero took ${reduced} direct damage.`);
  checkWinner(state);
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
        const board = state.players[owner].board;
        for (const c of [...board.vanguard, ...board.support]) {
          if (c && !isImmuneToSpell(c, sourceArchetype)) damageCard(state, owner, c.instanceId, effect.amount);
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
        if (found && isImmuneToSpell(found.card, sourceArchetype)) return;
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
      if (!found || isImmuneToSpell(found.card, sourceArchetype)) return;
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
        const board = state.players[owner].board;
        for (const c of [...board.vanguard, ...board.support]) {
          if (c && !isImmuneToSpell(c, sourceArchetype)) applyBuff(c);
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
  }
}
