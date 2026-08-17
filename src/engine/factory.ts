import { CARD_DEFINITIONS } from "../data/cards";
import {
  BUILDING_SLOTS,
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
  };

  if (def.archetype === "creature" || def.archetype === "building") {
    instance.currentHp = def.hp;
    instance.hasAttackedThisTurn = false;
  }
  if (def.archetype === "spell" || def.archetype === "ability") {
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
  };
}

function emptyBoard(): BoardState {
  return {
    vanguard: Array(VANGUARD_SIZE).fill(null),
    support: Array(SUPPORT_SIZE).fill(null),
    buildings: Array(BUILDING_SLOTS).fill(null),
    spellAbilitySlots: Array(SPELL_ABILITY_SLOTS).fill(null),
    equipment: null,
  };
}

export function createInitialPlayerState(
  id: PlayerId,
  heroDefId: string,
  deckDefIds: string[],
): PlayerState {
  const deck = shuffle(deckDefIds.map((defId) => createCardInstance(defId, id)));
  return {
    id,
    hero: createHeroInstance(heroDefId),
    guard: { current: STARTING_GUARD, max: STARTING_GUARD },
    resources: { current: STARTING_POOL, cap: STARTING_POOL },
    mana: { current: STARTING_POOL, cap: STARTING_POOL },
    energy: { current: STARTING_POOL, cap: STARTING_POOL },
    deck,
    hand: [],
    discard: [],
    graveyard: [],
    board: emptyBoard(),
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
