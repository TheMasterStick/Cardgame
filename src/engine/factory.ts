import { CARD_DEFINITIONS } from "../data/cards";
import {
  BUILDING_SLOTS,
  EQUIPMENT_ZONE_SIZE,
  MAX_POOL,
  SPELL_ABILITY_SLOTS,
  STARTING_GUARD,
  STARTING_POOL,
  SUPPORT_SIZE,
  VANGUARD_SIZE,
  type BoardState,
  type CardInstance,
  type GameState,
  type HeroCardDefinition,
  type HeroInstance,
  type HeroRuleBreaks,
  type PlayerId,
  type PlayerState,
} from "./types";
import { shuffle } from "./deck";

export function createCardInstance(defId: string, owner: PlayerId): CardInstance {
  const def = CARD_DEFINITIONS[defId];
  if (!def) throw new Error(`Unknown card definition: ${defId}`);

  const instance: CardInstance = {
    instanceId: crypto.randomUUID(),
    defId,
    archetype: def.archetype,
    owner,
    attackDelta: 0,
    hpDelta: 0,
    statuses: [],
    temporaryModifiers: [],
  };

  if (def.archetype === "creature" || def.archetype === "building") {
    instance.currentHp = def.hp;
    instance.hasAttackedThisTurn = false;
  }
  if (def.archetype === "spell" || def.archetype === "ability") {
    instance.chargesRemaining = def.charges;
  }
  // Recruitment Station-style Building abilities (`ability.charges`) and
  // Cloak of Shadows-style Equipment (`charges`) reuse the same generic
  // `chargesRemaining` field Spells/Abilities already use — undefined for
  // any card that doesn't set one, which every existing caller already
  // treats as "no charge limit."
  if (def.archetype === "building" && def.ability?.charges !== undefined) {
    instance.chargesRemaining = def.ability.charges;
  }
  if (def.archetype === "equipment" && def.charges !== undefined) {
    instance.chargesRemaining = def.charges;
  }
  return instance;
}

/** `heroDefId` must reference a CardDefinition with archetype "hero". */
export function createHeroInstance(heroDefId: string): HeroInstance {
  const def = CARD_DEFINITIONS[heroDefId];
  if (!def || def.archetype !== "hero") {
    throw new Error(`Unknown Hero card: ${heroDefId}`);
  }
  const heroDef = def as HeroCardDefinition;
  return {
    defId: heroDef.id,
    name: heroDef.name,
    maxHp: heroDef.hp,
    currentHp: heroDef.hp,
    baseAttack: heroDef.attack,
    statuses: [],
    hasAttackedThisTurn: false,
    heroPowerUsedThisTurn: false,
    signatureUsesRemaining: heroDef.signature?.usesPerMatch,
    firstSpellDiscountUsedThisTurn: false,
  };
}

/** Board array sizes, standard unless a Legendary-tier Hero's Rule-Breaks (DESIGN.md §9) say otherwise. */
function emptyBoard(ruleBreaks: HeroRuleBreaks | undefined): BoardState {
  return {
    vanguard: Array(VANGUARD_SIZE + (ruleBreaks?.vanguardSlotDelta ?? 0)).fill(null),
    support: Array(SUPPORT_SIZE + (ruleBreaks?.supportSlotDelta ?? 0)).fill(null),
    buildings: Array(BUILDING_SLOTS + (ruleBreaks?.extraBuildingSlots ?? 0)).fill(null),
    spellAbilitySlots: Array(SPELL_ABILITY_SLOTS + (ruleBreaks?.extraSpellAbilitySlots ?? 0)).fill(null),
    equipment: Array(EQUIPMENT_ZONE_SIZE).fill(null),
  };
}

export function createInitialPlayerState(
  id: PlayerId,
  heroDefId: string,
  deckDefIds: string[],
): PlayerState {
  const deck = shuffle(deckDefIds.map((defId) => createCardInstance(defId, id)));
  const heroDef = CARD_DEFINITIONS[heroDefId];
  const ruleBreaks = heroDef?.archetype === "hero" ? heroDef.ruleBreaks : undefined;
  const startingGuard = STARTING_GUARD + (ruleBreaks?.startingGuardDelta ?? 0);
  const resourceCap = Math.min(MAX_POOL, STARTING_POOL + (ruleBreaks?.resourceCapDelta ?? 0));
  const manaCap = Math.min(MAX_POOL, STARTING_POOL + (ruleBreaks?.manaCapDelta ?? 0));
  const energyCap = Math.min(MAX_POOL, STARTING_POOL + (ruleBreaks?.energyCapDelta ?? 0));
  return {
    id,
    hero: createHeroInstance(heroDefId),
    guard: { current: startingGuard, max: startingGuard },
    resources: { current: resourceCap, cap: resourceCap, income: 1 },
    mana: { current: manaCap, cap: manaCap },
    energy: { current: energyCap, cap: energyCap },
    deck,
    hand: [],
    discard: [],
    graveyard: [],
    board: emptyBoard(ruleBreaks),
  };
}

export function createInitialGameState(
  playerHeroDefId: string,
  playerDeck: string[],
  opponentHeroDefId: string,
  opponentDeck: string[],
  firstPlayer: PlayerId = "player",
): GameState {
  return {
    players: {
      player: createInitialPlayerState("player", playerHeroDefId, playerDeck),
      opponent: createInitialPlayerState("opponent", opponentHeroDefId, opponentDeck),
    },
    activePlayer: firstPlayer,
    turnNumber: 1,
    phase: "draw",
    log: [],
    winner: null,
  };
}
