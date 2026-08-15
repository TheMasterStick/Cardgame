import { CARD_DEFINITIONS } from "../data/cards";
import { HEROES } from "../data/heroes";
import {
  BACK_ROW_SIZE,
  FRONT_ROW_SIZE,
  SPELL_ABILITY_SLOTS,
  STARTING_MILITIA,
  STARTING_POOL,
  type BoardState,
  type CardInstance,
  type GameState,
  type HeroClass,
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

export function createHeroInstance(heroClass: HeroClass): HeroInstance {
  const def = HEROES[heroClass];
  return {
    defId: def.id,
    name: def.name,
    class: def.class,
    maxHp: def.baseHp,
    currentHp: def.baseHp,
    baseAttack: def.baseAttack,
    statuses: [],
    hasAttackedThisTurn: false,
  };
}

function emptyBoard(): BoardState {
  return {
    frontRow: Array(FRONT_ROW_SIZE).fill(null),
    backRow: Array(BACK_ROW_SIZE).fill(null),
    spellAbilitySlots: Array(SPELL_ABILITY_SLOTS).fill(null),
    equipment: null,
  };
}

export function createInitialPlayerState(
  id: PlayerId,
  heroClass: HeroClass,
  deckDefIds: string[],
): PlayerState {
  const deck = shuffle(deckDefIds.map((defId) => createCardInstance(defId, id)));
  return {
    id,
    hero: createHeroInstance(heroClass),
    militia: { current: STARTING_MILITIA, max: STARTING_MILITIA },
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
  playerHeroClass: HeroClass,
  playerDeck: string[],
  opponentHeroClass: HeroClass,
  opponentDeck: string[],
  firstPlayer: PlayerId = "player",
): GameState {
  return {
    players: {
      player: createInitialPlayerState("player", playerHeroClass, playerDeck),
      opponent: createInitialPlayerState("opponent", opponentHeroClass, opponentDeck),
    },
    activePlayer: firstPlayer,
    turnNumber: 1,
    phase: "draw",
    log: [],
    winner: null,
  };
}
