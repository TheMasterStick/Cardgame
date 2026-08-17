import { CARD_DEFINITIONS } from "../data/cards";
import {
  creatureCanAttack,
  declareCreatureAttack,
  declareHeroAttack,
  getCreatureAttack,
  getHeroAttack,
  heroCanAttack,
  reachProfileOf,
  type AttackTarget,
  type ReachProfile,
} from "./combat";
import { hasKeyword, type EffectTargetRef } from "./effects";
import { activateSlotCard, costPoolFor, endTurn, playCardFromHand } from "./game";
import {
  otherPlayer,
  type BoardState,
  type CardEffect,
  type CardInstance,
  type CreatureDefinition,
  type GameState,
  type PlayerId,
} from "./types";

const AI: PlayerId = "opponent";

function alive(cards: (CardInstance | null)[]): CardInstance[] {
  return cards.filter((c): c is CardInstance => c !== null);
}

function creatureMaxHp(card: CardInstance): number {
  const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition;
  return def.hp + card.hpDelta;
}

/** Picks a reasonable target for an onPlay battlecry-style effect: the weakest enemy creature. */
function pickOnPlayTarget(state: GameState, owner: PlayerId): EffectTargetRef {
  const enemy = otherPlayer(owner);
  const enemyFront = alive(state.players[enemy].board.vanguard);
  if (enemyFront.length === 0) return null;
  const weakest = enemyFront.reduce((a, b) => ((a.currentHp ?? Infinity) <= (b.currentHp ?? Infinity) ? a : b));
  return { kind: "card", owner: enemy, instanceId: weakest.instanceId };
}

/** Picks a target for an activated Spell/Ability effect, or "skip" if there's nothing worth doing. */
function pickActivationTarget(state: GameState, effect: CardEffect): EffectTargetRef | "skip" {
  const enemy = otherPlayer(AI);

  switch (effect.kind) {
    case "damage": {
      if (effect.target === "allEnemyCreatures" || effect.target === "allFriendlyCreatures" || effect.target === "selfHero") {
        return null;
      }
      if (effect.target === "targetPlayer") {
        return { kind: "player", owner: enemy }; // the Hero is always a legal target (DESIGN.md §5)
      }
      const enemyFront = alive(state.players[enemy].board.vanguard);
      if (enemyFront.length > 0) {
        const weakest = enemyFront.reduce((a, b) => ((a.currentHp ?? Infinity) <= (b.currentHp ?? Infinity) ? a : b));
        return { kind: "card", owner: enemy, instanceId: weakest.instanceId };
      }
      if (effect.target === "targetBuilding" || effect.target === "targetCreatureOrBuilding") {
        const enemyBuildings = alive(state.players[enemy].board.buildings);
        if (enemyBuildings.length > 0) return { kind: "card", owner: enemy, instanceId: enemyBuildings[0].instanceId };
      }
      if (effect.target === "targetAny") {
        return { kind: "player", owner: enemy }; // nothing else to hit — go face
      }
      return "skip"; // Creature-only with no enemy creature out — not worth burning the activation on a no-op
    }
    case "applyStatus": {
      const enemyFront = alive(state.players[enemy].board.vanguard);
      if (enemyFront.length === 0) return "skip";
      return { kind: "card", owner: enemy, instanceId: enemyFront[0].instanceId };
    }
    case "heal": {
      if (effect.target === "selfHero") {
        const hero = state.players[AI].hero;
        return hero.currentHp >= hero.maxHp ? "skip" : null;
      }
      const damaged = alive(state.players[AI].board.vanguard).find(
        (c) => (c.currentHp ?? 0) < creatureMaxHp(c),
      );
      return damaged ? { kind: "card", owner: AI, instanceId: damaged.instanceId } : "skip";
    }
    case "buff": {
      if (effect.target === "allFriendlyCreatures") return null;
      const ownFront = alive(state.players[AI].board.vanguard);
      return ownFront.length > 0 ? { kind: "card", owner: AI, instanceId: ownFront[0].instanceId } : "skip";
    }
    case "drawCard":
    case "gainGuard":
    case "gainCap":
      return null;
  }
}

function playMainPhase(state: GameState): void {
  const player = state.players[AI];

  let playedSomething = true;
  while (playedSomething) {
    playedSomething = false;
    for (const card of [...player.hand]) {
      const def = CARD_DEFINITIONS[card.defId];
      if (costPoolFor(player, def.archetype).pool.current < def.cost) continue;

      // Ranged creatures prefer Support (safe from base-tier attacks, still
      // able to fight); everything else wants Vanguard. Fall back to
      // whichever row still has room (DESIGN.md §4 — any Creature may
      // occupy either row structurally).
      let row: "vanguard" | "support" = "vanguard";
      if (def.archetype === "creature") {
        const isRanged = (def as CreatureDefinition).keywords.includes("ranged");
        const preferred = isRanged ? "support" : "vanguard";
        const fallback = preferred === "vanguard" ? "support" : "vanguard";
        if (!player.board[preferred].every((c) => c !== null)) row = preferred;
        else if (!player.board[fallback].every((c) => c !== null)) row = fallback;
        else continue;
      }
      if (def.archetype === "building" && player.board.buildings.every((c) => c !== null)) continue;
      if (
        (def.archetype === "spell" || def.archetype === "ability") &&
        player.board.spellAbilitySlots.every((c) => c !== null)
      ) {
        continue;
      }

      const target = def.archetype === "creature" ? pickOnPlayTarget(state, AI) : null;
      const result = playCardFromHand(state, AI, card.instanceId, { target, row });
      if (result.ok) {
        playedSomething = true;
        break;
      }
    }
  }

  let activatedSomething = true;
  while (activatedSomething) {
    activatedSomething = false;
    for (let i = 0; i < player.board.spellAbilitySlots.length; i++) {
      const card = player.board.spellAbilitySlots[i];
      if (!card) continue;
      const def = CARD_DEFINITIONS[card.defId];
      if (def.archetype !== "spell" && def.archetype !== "ability") continue;
      const pool = def.archetype === "spell" ? player.mana : player.energy;
      if (pool.current < def.activateCost) continue;

      const target = pickActivationTarget(state, def.effect);
      if (target === "skip") continue;
      const result = activateSlotCard(state, AI, i, target);
      if (result.ok) {
        activatedSomething = true;
        break;
      }
    }
  }
}

const NO_REACH: ReachProfile = { reach: false, ranged: false, infiltrate: false };

/** Enemy creatures this reach tier can actually target, gated by Taunt per row (DESIGN.md §5). */
function reachableCreatures(enemyBoard: BoardState, reach: ReachProfile): CardInstance[] {
  const gateByTaunt = (row: CardInstance[]): CardInstance[] => {
    const taunts = row.filter((c) => hasKeyword(c, "taunt"));
    return taunts.length > 0 ? taunts : row;
  };
  const vanguard = gateByTaunt(alive(enemyBoard.vanguard));
  if (!reach.reach && !reach.ranged) return vanguard;
  return [...vanguard, ...gateByTaunt(alive(enemyBoard.support))];
}

/** Buildings whose own column is clear on both rows — attackable without Infiltrate (DESIGN.md §11). */
function openBuildingColumns(enemyBoard: BoardState): CardInstance[] {
  return enemyBoard.buildings.filter(
    (c, i): c is CardInstance => c !== null && enemyBoard.vanguard[i] === null && enemyBoard.support[i] === null,
  );
}

function rowHasTaunt(row: (CardInstance | null)[]): boolean {
  return row.some((c) => c !== null && hasKeyword(c, "taunt"));
}

/**
 * Picks the best legal target for an attacker with the given reach tier.
 * The enemy Hero has no board-*population* gate (DESIGN.md §5) — a full
 * enemy Vanguard/Support doesn't wall it off — so a bad creature trade
 * just goes to the face instead of sitting idle. Taunt is the one thing
 * that still blocks Hero-targeting, and it's non-optional: if a reachable
 * Taunt creature is what's forcing a bad trade, there's no legal way
 * around it (short of Infiltrate), so the trade is taken anyway rather
 * than the attacker doing nothing.
 */
function chooseAttackTarget(state: GameState, reach: ReachProfile, attackerAttack: number, attackerHp: number): AttackTarget {
  const enemy = otherPlayer(AI);
  const enemyBoard = state.players[enemy].board;

  const reachable = reachableCreatures(enemyBoard, reach);
  if (reachable.length > 0) {
    const killable = reachable.filter((d) => attackerAttack >= (d.currentHp ?? 0));
    const target =
      killable.length > 0
        ? killable.reduce((a, b) => ((a.currentHp ?? 0) >= (b.currentHp ?? 0) ? a : b))
        : reachable.reduce((a, b) => (getCreatureAttack(a) <= getCreatureAttack(b) ? a : b));
    // A Ranged attacker never takes retaliation damage, so it always trades.
    const willSurvive = reach.ranged || attackerHp > getCreatureAttack(target);
    if (killable.length > 0 || willSurvive) {
      return { type: "creature", instanceId: target.instanceId };
    }
    const tauntForcesIt = !reach.infiltrate && (rowHasTaunt(enemyBoard.vanguard) || ((reach.reach || reach.ranged) && rowHasTaunt(enemyBoard.support)));
    if (tauntForcesIt) {
      return { type: "creature", instanceId: target.instanceId };
    }
  }

  if (reach.infiltrate) {
    const anyBuilding = alive(enemyBoard.buildings)[0];
    if (anyBuilding) return { type: "building", instanceId: anyBuilding.instanceId };
  } else {
    const openBuildings = openBuildingColumns(enemyBoard);
    if (openBuildings.length > 0) return { type: "building", instanceId: openBuildings[0].instanceId };
  }

  return { type: "player" };
}

function playCombatPhase(state: GameState): void {
  const player = state.players[AI];

  const vanguardAttackers = alive(player.board.vanguard);
  const supportAttackers = alive(player.board.support).filter((c) =>
    (CARD_DEFINITIONS[c.defId] as CreatureDefinition).keywords.includes("ranged"),
  );

  for (const card of [...vanguardAttackers, ...supportAttackers]) {
    if (!creatureCanAttack(state, card)) continue;
    const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition;
    const reach = reachProfileOf(def);
    const target = chooseAttackTarget(state, reach, getCreatureAttack(card), card.currentHp ?? 0);
    declareCreatureAttack(state, AI, card.instanceId, target);
  }

  if (heroCanAttack(state, AI)) {
    const hero = player.hero;
    const target = chooseAttackTarget(state, NO_REACH, getHeroAttack(state, AI), hero.currentHp);
    declareHeroAttack(state, AI, target);
  }
}

/** Plays a full turn for the "opponent" seat: main phase, combat phase, end turn. */
export function runAiTurn(state: GameState): void {
  if (state.activePlayer !== AI || state.winner) return;
  playMainPhase(state);
  state.phase = "combat";
  playCombatPhase(state);
  endTurn(state);
}
