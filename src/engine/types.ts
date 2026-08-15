// Core types for the card game engine. See DESIGN.md for the full ruleset
// these types encode.

export type PlayerId = "player" | "opponent";

export function otherPlayer(id: PlayerId): PlayerId {
  return id === "player" ? "opponent" : "player";
}

export type HeroClass = "fighter" | "mage" | "rogue";

export type CardArchetype =
  | "creature"
  | "building"
  | "spell"
  | "ability"
  | "equipment";

export type Keyword = "ranged" | "charge";

export type StatusType = "burn" | "poison";

export interface StatusEffectInstance {
  type: StatusType;
  amount: number;
  /** Burn expires after N end-of-turn ticks. Poison has no expiry (undefined). */
  turnsRemaining?: number;
}

/**
 * Where an effect's damage/heal/status/buff lands. Resolved against the
 * *acting* player's perspective (the player whose card produced the effect).
 */
export type EffectTarget =
  | "targetCreature"
  | "targetBuilding"
  | "targetCreatureOrBuilding"
  | "targetPlayer"
  | "targetAny"
  | "allEnemyCreatures"
  | "allFriendlyCreatures"
  | "self"
  | "selfHero"
  | "none";

export interface DamageEffect {
  kind: "damage";
  amount: number;
  target: EffectTarget;
}

export interface HealEffect {
  kind: "heal";
  amount: number;
  target: EffectTarget;
}

export interface ApplyStatusEffect {
  kind: "applyStatus";
  status: StatusType;
  amount: number;
  /** Omit for poison (persists until cured/death). */
  duration?: number;
  target: EffectTarget;
}

export interface BuffEffect {
  kind: "buff";
  attackDelta?: number;
  hpDelta?: number;
  target: EffectTarget;
}

export interface DrawCardEffect {
  kind: "drawCard";
  amount: number;
}

export interface GainMilitiaEffect {
  kind: "gainMilitia";
  amount: number;
}

export interface GainCapEffect {
  kind: "gainCap";
  pool: "resource" | "mana" | "energy";
  amount: number;
}

export type CardEffect =
  | DamageEffect
  | HealEffect
  | ApplyStatusEffect
  | BuffEffect
  | DrawCardEffect
  | GainMilitiaEffect
  | GainCapEffect;

export type TriggerName =
  | "onPlay"
  | "onAttack"
  | "onDeath"
  | "startOfTurn"
  | "endOfTurn";

export interface Trigger {
  on: TriggerName;
  effect: CardEffect;
}

export type Rarity = "common" | "rare" | "epic" | "legendary";

interface CardDefinitionBase {
  id: string;
  name: string;
  archetype: CardArchetype;
  /** Resources cost to play the card from hand. */
  cost: number;
  text?: string;
  rarity: Rarity;
  /**
   * Image URL or path shown on the card (e.g. "/cards/footman.png" for a
   * file dropped in public/cards/, or any external https:// URL). Omit to
   * fall back to the plain text card layout.
   */
  art?: string;
}

export interface CreatureDefinition extends CardDefinitionBase {
  archetype: "creature";
  attack: number;
  hp: number;
  keywords: Keyword[];
  triggers: Trigger[];
}

export interface BuildingDefinition extends CardDefinitionBase {
  archetype: "building";
  hp: number;
  triggers: Trigger[];
}

export interface SpellDefinition extends CardDefinitionBase {
  archetype: "spell";
  /** Mana cost to activate once on the field. */
  activateCost: number;
  charges: number | "unlimited";
  effect: CardEffect;
}

export interface AbilityDefinition extends CardDefinitionBase {
  archetype: "ability";
  /** Energy cost to activate once on the field. */
  activateCost: number;
  charges: number | "unlimited";
  effect: CardEffect;
}

export interface EquipmentDefinition extends CardDefinitionBase {
  archetype: "equipment";
  attackBonus: number;
  damageReduction: number;
}

export type CardDefinition =
  | CreatureDefinition
  | BuildingDefinition
  | SpellDefinition
  | AbilityDefinition
  | EquipmentDefinition;

export interface HeroDefinition {
  id: string;
  name: string;
  class: HeroClass;
  baseHp: number;
  baseAttack: number;
  /** Portrait image URL or path, e.g. "/heroes/fighter.png". Omit for the plain text portrait. */
  art?: string;
}

/** Runtime instance of a card, wrapping its static definition with live state. */
export interface CardInstance {
  instanceId: string;
  defId: string;
  archetype: CardArchetype;
  owner: PlayerId;
  // Creature / building runtime state
  currentHp?: number;
  attackDelta: number;
  hpDelta: number;
  summonedTurn?: number;
  hasAttackedThisTurn?: boolean;
  statuses: StatusEffectInstance[];
  // Spell / ability runtime state
  chargesRemaining?: number | "unlimited";
}

export interface ResourcePool {
  current: number;
  cap: number;
}

export interface HeroInstance {
  defId: string;
  name: string;
  class: HeroClass;
  maxHp: number;
  currentHp: number;
  baseAttack: number;
  statuses: StatusEffectInstance[];
  hasAttackedThisTurn: boolean;
}

export interface BoardState {
  frontRow: (CardInstance | null)[]; // length 5, creatures
  backRow: (CardInstance | null)[]; // length 5, buildings
  spellAbilitySlots: (CardInstance | null)[]; // length 4
  equipment: CardInstance | null;
}

export interface PlayerState {
  id: PlayerId;
  hero: HeroInstance;
  militia: { current: number; max: number };
  resources: ResourcePool;
  mana: ResourcePool;
  energy: ResourcePool;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  graveyard: CardInstance[];
  board: BoardState;
}

export type GamePhase = "draw" | "main" | "combat" | "end";

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  activePlayer: PlayerId;
  turnNumber: number;
  phase: GamePhase;
  log: string[];
  winner: PlayerId | null;
}

export const FRONT_ROW_SIZE = 5;
export const BACK_ROW_SIZE = 5;
export const SPELL_ABILITY_SLOTS = 4;
export const STARTING_HAND_SIZE = 4;
export const MAX_HAND_SIZE = 10;
export const STARTING_POOL = 5;
export const MAX_POOL = 10;
export const STARTING_MILITIA = 100;
export const DECK_SIZE = 30;
