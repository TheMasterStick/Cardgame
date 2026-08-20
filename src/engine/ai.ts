import { CARD_DEFINITIONS } from "../data/cards";
import {
  creatureCanAttack,
  declareAdvance,
  declareCreatureAttack,
  declareHeroAttack,
  getEffectiveCreatureAttack,
  getHeroAttack,
  heroCanAttack,
  reachProfileOf,
  type AttackTarget,
  type ReachProfile,
} from "./combat";
import { hasKeyword, type EffectTargetRef } from "./effects";
import { activateSlotCard, costPoolFor, endTurn, playCardFromHand } from "./game";
import { activateHeroPower, activateHeroSignature, peekSpellDiscount } from "./hero";
import {
  otherPlayer,
  type BoardState,
  type CardEffect,
  type CardInstance,
  type CreatureDefinition,
  type EquipmentDefinition,
  type GameState,
  type HeroCardDefinition,
  type PlayerId,
} from "./types";

const AI: PlayerId = "opponent";

/** Non-null cards in a row, deduped by instanceId — a Massive creature (DESIGN.md §5) occupies more than one slot with the same instance. */
function alive(cards: (CardInstance | null)[]): CardInstance[] {
  const seen = new Set<string>();
  const result: CardInstance[] = [];
  for (const c of cards) {
    if (c && !seen.has(c.instanceId)) {
      seen.add(c.instanceId);
      result.push(c);
    }
  }
  return result;
}

function creatureMaxHp(card: CardInstance): number {
  const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition;
  return def.hp + card.hpDelta;
}

/** Every creature on a board, Vanguard and Support alike — Spells/Abilities bypass the reach ladder and can hit either row (DESIGN.md §5), unlike a creature's own attack. */
function boardCreatures(board: BoardState): CardInstance[] {
  return alive([...board.vanguard, ...board.support]);
}

function hasStealth(card: CardInstance): boolean {
  return hasKeyword(card, "stealth") && !card.stealthBroken;
}

/**
 * Same as boardCreatures, minus Stealthed ones — used for picking a Spell/
 * Ability/Hero Power/Signature target (DESIGN.md §7: Stealth can't be
 * chosen). Not used for Warcry (onPlay trigger) targeting, which Stealth
 * doesn't scope to.
 */
function targetableBoardCreatures(board: BoardState): CardInstance[] {
  return boardCreatures(board).filter((c) => !hasStealth(c));
}

/** How much a targetPlayer/targetAny hit against this player would be reduced by their equipped weapon, if any. */
function equipmentDamageReduction(state: GameState, owner: PlayerId): number {
  const equipment = state.players[owner].board.equipment;
  if (!equipment) return 0;
  return (CARD_DEFINITIONS[equipment.defId] as EquipmentDefinition).damageReduction;
}

/** Picks a reasonable target for an onPlay Warcry-style effect: the weakest enemy creature, from either row. */
function pickOnPlayTarget(state: GameState, owner: PlayerId): EffectTargetRef {
  const enemy = otherPlayer(owner);
  const enemyCreatures = boardCreatures(state.players[enemy].board);
  if (enemyCreatures.length === 0) return null;
  const weakest = enemyCreatures.reduce((a, b) => ((a.currentHp ?? Infinity) <= (b.currentHp ?? Infinity) ? a : b));
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
        // The Hero is always a legal target (DESIGN.md §5), but not worth
        // burning the activation on if their weapon reduces it to nothing.
        return effect.amount > equipmentDamageReduction(state, enemy) ? { kind: "player", owner: enemy } : "skip";
      }
      const enemyCreatures = targetableBoardCreatures(state.players[enemy].board);
      if (enemyCreatures.length > 0) {
        const weakest = enemyCreatures.reduce((a, b) => ((a.currentHp ?? Infinity) <= (b.currentHp ?? Infinity) ? a : b));
        return { kind: "card", owner: enemy, instanceId: weakest.instanceId };
      }
      if (effect.target === "targetBuilding" || effect.target === "targetCreatureOrBuilding" || effect.target === "targetAny") {
        const enemyBuildings = alive(state.players[enemy].board.buildings);
        if (enemyBuildings.length > 0) return { kind: "card", owner: enemy, instanceId: enemyBuildings[0].instanceId };
      }
      if (effect.target === "targetAny" && effect.amount > equipmentDamageReduction(state, enemy)) {
        return { kind: "player", owner: enemy }; // nothing else to hit — go face, but only if it'd actually land
      }
      return "skip"; // Creature-only with no enemy creature out (or a face hit their weapon would fully absorb) — not worth burning the activation on a no-op
    }
    case "applyStatus": {
      const enemyCreatures = targetableBoardCreatures(state.players[enemy].board);
      if (enemyCreatures.length === 0) return "skip";
      return { kind: "card", owner: enemy, instanceId: enemyCreatures[0].instanceId };
    }
    case "heal": {
      if (effect.target === "selfHero") {
        const hero = state.players[AI].hero;
        return hero.currentHp >= hero.maxHp ? "skip" : null;
      }
      const damaged = boardCreatures(state.players[AI].board).find((c) => (c.currentHp ?? 0) < creatureMaxHp(c));
      return damaged ? { kind: "card", owner: AI, instanceId: damaged.instanceId } : "skip";
    }
    case "buff": {
      if (effect.target === "allFriendlyCreatures") return null;
      const ownCreatures = boardCreatures(state.players[AI].board);
      return ownCreatures.length > 0 ? { kind: "card", owner: AI, instanceId: ownCreatures[0].instanceId } : "skip";
    }
    case "drawCard":
    case "gainGuard":
    case "gainCap":
    case "summonCreature":
      return null;
  }
}

/** Plays one affordable card from hand, or returns null if nothing more can be played right now. */
function playOneCard(state: GameState): string | null {
  const player = state.players[AI];
  for (const card of [...player.hand]) {
    const def = CARD_DEFINITIONS[card.defId];
    // Instant Spells (DESIGN.md §1a) never occupy a slot and pay a
    // possibly-discounted Mana cost — everything else pays its flat cost.
    const isInstantSpell = def.archetype === "spell" && def.spellForm === "instant";
    const cost = isInstantSpell ? peekSpellDiscount(state, AI, def.cost) : def.cost;
    if (costPoolFor(player, def.archetype).pool.current < cost) continue;

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
      !isInstantSpell &&
      (def.archetype === "spell" || def.archetype === "ability") &&
      player.board.spellAbilitySlots.every((c) => c !== null)
    ) {
      continue;
    }

    let target: EffectTargetRef | null = null;
    if (def.archetype === "creature") {
      target = pickOnPlayTarget(state, AI);
    } else if (isInstantSpell) {
      const picked = pickActivationTarget(state, def.effect);
      if (picked === "skip") continue;
      target = picked;
    }
    const result = playCardFromHand(state, AI, card.instanceId, { target, row });
    if (result.ok) return card.instanceId;
  }
  return null;
}

/** Activates one affordable Spell/Ability already on the field, or returns null if nothing more to activate. */
function activateOneSlotCard(state: GameState): string | null {
  const player = state.players[AI];
  for (let i = 0; i < player.board.spellAbilitySlots.length; i++) {
    const card = player.board.spellAbilitySlots[i];
    if (!card) continue;
    const def = CARD_DEFINITIONS[card.defId];
    if (def.archetype !== "spell" && def.archetype !== "ability") continue;
    if (def.activateCost === undefined) continue; // Instant spells never reach a slot
    const pool = def.archetype === "spell" ? player.mana : player.energy;
    const cost = def.archetype === "spell" ? peekSpellDiscount(state, AI, def.activateCost) : def.activateCost;
    if (pool.current < cost) continue;

    const target = pickActivationTarget(state, def.effect);
    if (target === "skip") continue;
    const result = activateSlotCard(state, AI, i, target);
    if (result.ok) return card.instanceId;
  }
  return null;
}

/** Uses the AI's Hero Power once, if affordable and there's a worthwhile target. */
function tryHeroPower(state: GameState): boolean {
  const player = state.players[AI];
  const heroDef = CARD_DEFINITIONS[player.hero.defId] as HeroCardDefinition;
  const power = heroDef.heroPower;
  if (!power || player.hero.heroPowerUsedThisTurn) return false;
  if (player.energy.current < power.activateCost) return false;
  const target = pickActivationTarget(state, power.effect);
  if (target === "skip") return false;
  return activateHeroPower(state, AI, target).ok;
}

/** Uses the AI's Signature Ability, if affordable, uses remain, and there's a worthwhile target. */
function trySignature(state: GameState): boolean {
  const player = state.players[AI];
  const heroDef = CARD_DEFINITIONS[player.hero.defId] as HeroCardDefinition;
  const signature = heroDef.signature;
  if (!signature) return false;
  if (!player.hero.signatureUsesRemaining || player.hero.signatureUsesRemaining <= 0) return false;
  if (player.energy.current < signature.activateCost) return false;
  const target = pickActivationTarget(state, signature.effect);
  if (target === "skip") return false;
  return activateHeroSignature(state, AI, target).ok;
}

const NO_REACH: ReachProfile = { reach: false, ranged: false, infiltrate: false };

/**
 * Enemy creatures this reach tier can actually target, gated by Taunt per
 * row (DESIGN.md §5). Base attackers reach Support too once enemy Vanguard
 * is completely empty (the basic combat ladder — Vanguard, then Support);
 * Reach/Ranged can already reach Support even while Vanguard is populated.
 */
function reachableCreatures(enemyBoard: BoardState, reach: ReachProfile): CardInstance[] {
  // Stealth (DESIGN.md §7) can't be chosen as an attack target at all — same
  // treatment as it simply not being on the board for targeting/gating
  // purposes. Filtered before the Taunt gate so a (currently hypothetical)
  // Stealthed Taunt creature can't gate out every other target.
  const notStealthed = (row: CardInstance[]) => row.filter((c) => !hasStealth(c));
  const gateByTaunt = (row: CardInstance[]): CardInstance[] => {
    const taunts = row.filter((c) => hasKeyword(c, "taunt"));
    return taunts.length > 0 ? taunts : row;
  };
  // Whether Vanguard blocks Support-reach is about the *actual* board state
  // (matches combat.ts's validateTarget), not which creatures the AI is
  // still allowed to pick — an all-Stealthed Vanguard still isn't "empty".
  const rawVanguard = alive(enemyBoard.vanguard);
  const vanguard = gateByTaunt(notStealthed(rawVanguard));
  const canReachSupport = reach.reach || reach.ranged || rawVanguard.length === 0;
  if (!canReachSupport) return vanguard;
  return [...vanguard, ...gateByTaunt(notStealthed(alive(enemyBoard.support)))];
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
        : reachable.reduce((a, b) =>
            getEffectiveCreatureAttack(state, enemy, a) <= getEffectiveCreatureAttack(state, enemy, b) ? a : b,
          );
    // A Ranged attacker escapes retaliation only against a non-Ranged target — two Ranged creatures trade normally.
    const attackerEscapesRetaliation = reach.ranged && !hasKeyword(target, "ranged");
    const willSurvive = attackerEscapesRetaliation || attackerHp > getEffectiveCreatureAttack(state, enemy, target);
    if (killable.length > 0 || willSurvive) {
      return { type: "creature", instanceId: target.instanceId };
    }
    const canReachSupportForTaunt = reach.reach || reach.ranged || alive(enemyBoard.vanguard).length === 0;
    const tauntForcesIt = !reach.infiltrate && (rowHasTaunt(enemyBoard.vanguard) || (canReachSupportForTaunt && rowHasTaunt(enemyBoard.support)));
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

/** One atomic action the AI took, for step-by-step replay/animation in the UI. */
export type AiTurnStep =
  | { kind: "playCard"; instanceId: string }
  | { kind: "activateCard"; instanceId: string }
  | { kind: "advance"; instanceId: string }
  | { kind: "attack"; attackerId: string; target: AttackTarget }
  | { kind: "heroAttack"; target: AttackTarget }
  | { kind: "heroPower" }
  | { kind: "heroSignature" }
  | { kind: "endTurn" };

/**
 * Plays a full turn for the "opponent" seat — main phase, combat phase, end
 * turn — yielding one {@link AiTurnStep} after each atomic action so the UI
 * can replay the turn at a human-followable pace instead of resolving it
 * instantly (see App.tsx's `runAiIfNeeded`).
 */
export function* runAiTurnSteps(state: GameState): Generator<AiTurnStep, void, void> {
  if (state.activePlayer !== AI || state.winner) return;

  for (;;) {
    const instanceId = playOneCard(state);
    if (!instanceId) break;
    yield { kind: "playCard", instanceId };
    if (state.winner) return;
  }
  for (;;) {
    const instanceId = activateOneSlotCard(state);
    if (!instanceId) break;
    yield { kind: "activateCard", instanceId };
    if (state.winner) return;
  }

  if (tryHeroPower(state)) {
    yield { kind: "heroPower" };
    if (state.winner) return;
  }
  if (trySignature(state)) {
    yield { kind: "heroSignature" };
    if (state.winner) return;
  }

  state.phase = "combat";
  const player = state.players[AI];

  // Advance (DESIGN.md §5): a non-Ranged Support creature that has Advance
  // just sits idle otherwise (it can't attack from Support without Ranged),
  // so move it into an open same-column Vanguard slot instead.
  for (const card of alive(player.board.support)) {
    const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition;
    if (!def.keywords.includes("advance") || def.keywords.includes("ranged")) continue;
    if (!creatureCanAttack(state, card)) continue;
    declareAdvance(state, AI, card.instanceId);
    yield { kind: "advance", instanceId: card.instanceId };
    if (state.winner) return;
  }

  const vanguardAttackers = alive(player.board.vanguard);
  const supportAttackers = alive(player.board.support).filter((c) =>
    (CARD_DEFINITIONS[c.defId] as CreatureDefinition).keywords.includes("ranged"),
  );

  for (const card of [...vanguardAttackers, ...supportAttackers]) {
    if (!creatureCanAttack(state, card)) continue;
    const def = CARD_DEFINITIONS[card.defId] as CreatureDefinition;
    const reach = reachProfileOf(def);
    const target = chooseAttackTarget(state, reach, getEffectiveCreatureAttack(state, AI, card), card.currentHp ?? 0);
    declareCreatureAttack(state, AI, card.instanceId, target);
    yield { kind: "attack", attackerId: card.instanceId, target };
    if (state.winner) return;
  }

  if (heroCanAttack(state, AI)) {
    const hero = player.hero;
    const target = chooseAttackTarget(state, NO_REACH, getHeroAttack(state, AI), hero.currentHp);
    declareHeroAttack(state, AI, target);
    yield { kind: "heroAttack", target };
    if (state.winner) return;
  }

  endTurn(state);
  yield { kind: "endTurn" };
}

/** Synchronous full-turn wrapper for callers that don't animate — drains {@link runAiTurnSteps} immediately. */
export function runAiTurn(state: GameState): void {
  const steps = runAiTurnSteps(state);
  let step = steps.next();
  while (!step.done) step = steps.next();
}
