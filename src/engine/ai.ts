import { CARD_DEFINITIONS } from "../data/cards";
import {
  creatureCanAttack,
  declareCreatureAttack,
  declareHeroAttack,
  getCreatureAttack,
  heroCanAttack,
} from "./combat";
import type { EffectTargetRef } from "./effects";
import { activateSlotCard, endTurn, playCardFromHand } from "./game";
import {
  otherPlayer,
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
  const enemyFront = alive(state.players[enemy].board.frontRow);
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
        const frontEmpty = state.players[enemy].board.frontRow.every((c) => c === null);
        return frontEmpty ? { kind: "player", owner: enemy } : "skip";
      }
      const enemyFront = alive(state.players[enemy].board.frontRow);
      if (enemyFront.length > 0) {
        const weakest = enemyFront.reduce((a, b) => ((a.currentHp ?? Infinity) <= (b.currentHp ?? Infinity) ? a : b));
        return { kind: "card", owner: enemy, instanceId: weakest.instanceId };
      }
      if (effect.target === "targetBuilding" || effect.target === "targetCreatureOrBuilding") {
        const enemyBack = alive(state.players[enemy].board.backRow);
        if (enemyBack.length > 0) return { kind: "card", owner: enemy, instanceId: enemyBack[0].instanceId };
      }
      return "skip";
    }
    case "applyStatus": {
      const enemyFront = alive(state.players[enemy].board.frontRow);
      if (enemyFront.length === 0) return "skip";
      return { kind: "card", owner: enemy, instanceId: enemyFront[0].instanceId };
    }
    case "heal": {
      if (effect.target === "selfHero") {
        const hero = state.players[AI].hero;
        return hero.currentHp >= hero.maxHp ? "skip" : null;
      }
      const damaged = alive(state.players[AI].board.frontRow).find(
        (c) => (c.currentHp ?? 0) < creatureMaxHp(c),
      );
      return damaged ? { kind: "card", owner: AI, instanceId: damaged.instanceId } : "skip";
    }
    case "buff": {
      if (effect.target === "allFriendlyCreatures") return null;
      const ownFront = alive(state.players[AI].board.frontRow);
      return ownFront.length > 0 ? { kind: "card", owner: AI, instanceId: ownFront[0].instanceId } : "skip";
    }
    case "drawCard":
    case "gainMilitia":
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
      if (player.resources.current < def.cost) continue;
      if (def.archetype === "creature" && player.board.frontRow.every((c) => c !== null)) continue;
      if (def.archetype === "building" && player.board.backRow.every((c) => c !== null)) continue;
      if (
        (def.archetype === "spell" || def.archetype === "ability") &&
        player.board.spellAbilitySlots.every((c) => c !== null)
      ) {
        continue;
      }

      const target = def.archetype === "creature" ? pickOnPlayTarget(state, AI) : null;
      const result = playCardFromHand(state, AI, card.instanceId, { target });
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

function playCombatPhase(state: GameState): void {
  const player = state.players[AI];
  const enemy = otherPlayer(AI);

  for (const card of [...player.board.frontRow]) {
    if (!card || !creatureCanAttack(state, card)) continue;
    const attack = getCreatureAttack(card);
    const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition;
    const isRanged = def.keywords.includes("ranged");
    const enemyFront = alive(state.players[enemy].board.frontRow);

    if (enemyFront.length === 0 || isRanged) {
      declareCreatureAttack(state, AI, card.instanceId, { type: "player" });
      continue;
    }

    const killable = enemyFront.filter((d) => attack >= (d.currentHp ?? 0));
    const target =
      killable.length > 0
        ? killable.reduce((a, b) => ((a.currentHp ?? 0) >= (b.currentHp ?? 0) ? a : b))
        : enemyFront.reduce((a, b) => (getCreatureAttack(a) <= getCreatureAttack(b) ? a : b));

    const myHp = card.currentHp ?? 0;
    const willSurvive = myHp > getCreatureAttack(target);
    if (killable.length > 0 || willSurvive) {
      declareCreatureAttack(state, AI, card.instanceId, { type: "creature", instanceId: target.instanceId });
    }
  }

  if (heroCanAttack(state, AI)) {
    const enemyFrontEmpty = state.players[enemy].board.frontRow.every((c) => c === null);
    if (enemyFrontEmpty) declareHeroAttack(state, AI, { type: "player" });
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
