// Core types for the card game engine. See DESIGN.md for the full ruleset
// these types encode.

export type PlayerId = "player" | "opponent";

export function otherPlayer(id: PlayerId): PlayerId {
  return id === "player" ? "opponent" : "player";
}

export type CardArchetype =
  | "hero"
  | "creature"
  | "building"
  | "spell"
  | "ability"
  | "equipment";

export type Keyword =
  | "ranged"
  | "reach"
  | "infiltrate"
  | "charge"
  | "battlecry"
  | "counter"
  | "revenge"
  | "frenzy"
  | "immune"
  | "poison"
  | "taunt"
  | "protector"
  | "flank"
  | "formation"
  | "advance"
  | "push";

export type Element =
  | "frost"
  | "fire"
  | "nature"
  | "light"
  | "darkness"
  | "arcane"
  | "martial"
  | "blood"
  | "infernal"
  | "chaos";

export type Faction =
  | "infernal-court"
  | "roseguard-kingdom"
  | "moonveil-coven"
  | "velvet-syndicate"
  | "wildheart-tribes"
  | "celestial-academy"
  | "necropolitan"
  | "arcane-industries";

export type Race =
  | "beast"
  | "demon"
  | "dragon"
  | "elemental"
  | "mech"
  | "human"
  | "undead"
  | "goblin"
  | "dwarf"
  | "elf"
  | "pixie"
  | "ogre"
  | "giant"
  | "dark-elf"
  | "angel"
  | "orc"
  | "gnome"
  | "troll"
  | "dryad"
  | "fairy"
  | "harpy"
  | "fiend"
  | "vampire";

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

export interface GainGuardEffect {
  kind: "gainGuard";
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
  | GainGuardEffect
  | GainCapEffect;

export type TriggerName =
  | "onPlay"
  | "onAttack"
  | "onDeath"
  | "startOfTurn"
  | "endOfTurn"
  /** Fires on a creature when it's targeted by an attack (Counter keyword). */
  | "onDefend";

export interface Trigger {
  on: TriggerName;
  effect: CardEffect;
}

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

interface CardDefinitionBase {
  id: string;
  name: string;
  archetype: CardArchetype;
  /** Resources cost to play the card from hand. Unused (0) for Hero cards. */
  cost: number;
  text?: string;
  rarity: Rarity;
  /**
   * Image URL or path shown on the card (e.g. "/cards/footman.png" for a
   * file dropped in public/cards/, or any external https:// URL). Omit to
   * fall back to the plain text card layout.
   */
  art?: string;
  /** Magic school/affinity. Optional — not every card needs one. */
  element?: Element;
  /** Faction allegiance. Optional. */
  faction?: Faction;
  /** Character race/type. Only meaningful for Creature and Hero cards. */
  race?: Race;
}

/**
 * A Hero Passive (DESIGN.md §9): an always-on effect, built from a small
 * curated set of templates rather than free-form scripting — matches how
 * CardEffect is already a fixed set of `kind`s. Grows as new Heroes need
 * new patterns.
 */
export type PassiveEffect =
  /**
   * A live, continuously-recalculated Attack bonus to the controller's own
   * matching creatures — same "recomputed on demand, never stored on the
   * CardInstance" approach as Flank/Formation (DESIGN.md §5), and for the
   * same reason: an HP-inclusive version would need a parallel "effective
   * max HP" overlay threaded through every HP display/comparison, so this
   * stays Attack-only as a documented simplification, same as Flank/Formation.
   */
  | { kind: "auraBuff"; filter: "all" | { race: Race } | { faction: Faction }; attackDelta: number }
  /** Reduces the Mana cost of the controller's first Spell activation each turn by `amount` (floored at 0). Resets at the start of that player's turn. */
  | { kind: "firstSpellDiscount"; amount: number };

/** An activated Hero ability — Hero Power or Signature (DESIGN.md §9) — reusing the same CardEffect shape as a Spell/Ability, Energy-costed. */
export interface HeroActivatedAbility {
  effect: CardEffect;
  activateCost: number;
  text?: string;
}

export interface HeroCardDefinition extends CardDefinitionBase {
  archetype: "hero";
  attack: number;
  hp: number;
  passive?: PassiveEffect;
  /** Usable once per turn (not charge-based) — resets every startTurn. */
  heroPower?: HeroActivatedAbility;
  /** A stronger effect gated to a small number of uses per *match* instead of per turn. */
  signature?: HeroActivatedAbility & { usesPerMatch: number };
  /**
   * Allegiance grant (DESIGN.md §10) — bends the default deckbuilding rule
   * ("your Faction's cards, plus Neutral") for this specific Hero. Omit
   * entirely for a Hero that just follows the default rule.
   */
  allegiance?: {
    /** Additional Factions allowed alongside this Hero's own (a Diplomat/Cultist-style Hero). */
    extraFactions?: Faction[];
    /** Creatures of a listed Race count as in-Faction regardless of their own Faction tag. */
    neutralRaces?: Race[];
    /** No Faction restriction at all despite having a Faction (a Mercenary Captain). */
    unrestricted?: boolean;
  };
}

/** A conditional stat bump from a positional keyword — Attack only (DESIGN.md §5). Re-evaluated live, never stored on the CardInstance. */
export interface PositionalBonus {
  attackDelta: number;
}

export interface CreatureDefinition extends CardDefinitionBase {
  archetype: "creature";
  attack: number;
  hp: number;
  keywords: Keyword[];
  triggers: Trigger[];
  /** Massive: how many contiguous same-row slots this creature occupies. Omit for the default of 1. */
  spaceCost?: number;
  /** Requires the `flank` keyword. Active only while occupying column 1 or 5 of its row (DESIGN.md §5). */
  flankBonus?: PositionalBonus;
  /** Requires the `formation` keyword. Active only while an allied creature occupies an adjacent column, same row (DESIGN.md §5). */
  formationBonus?: PositionalBonus;
}

export interface BuildingDefinition extends CardDefinitionBase {
  archetype: "building";
  hp: number;
  triggers: Trigger[];
}

/**
 * Spells come in three forms (DESIGN.md §1a):
 * - "instant": no slot at all — cast straight from hand for `cost` Mana,
 *   the effect resolves immediately, then it goes to the discard pile.
 *   `activateCost`/`charges` don't apply and are omitted.
 * - "ritual": occupies a Spell/Ability slot, unlimited charges (`charges: "unlimited"`).
 * - "charged": occupies a slot with a fixed charge count (`charges: number`); Fizzles (discards) at 0.
 * Abilities only ever come in the ritual/charged shape (no Instant form) — see AbilityDefinition.
 */
export interface SpellDefinition extends CardDefinitionBase {
  archetype: "spell";
  spellForm: "instant" | "ritual" | "charged";
  /** Mana cost to activate once already on the field. Omitted for "instant" — there's no separate activation step. */
  activateCost?: number;
  /** "unlimited" for Ritual, a fixed number for Charged. Omitted for "instant". */
  charges?: number | "unlimited";
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
  | HeroCardDefinition
  | CreatureDefinition
  | BuildingDefinition
  | SpellDefinition
  | AbilityDefinition
  | EquipmentDefinition;

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
  /** References a CardDefinition with archetype "hero" in CARD_DEFINITIONS. */
  defId: string;
  name: string;
  maxHp: number;
  currentHp: number;
  baseAttack: number;
  statuses: StatusEffectInstance[];
  hasAttackedThisTurn: boolean;
  /** Hero Power is usable once per turn (not charge-based) — resets every startTurn. */
  heroPowerUsedThisTurn: boolean;
  /** Signature Ability's remaining uses for the whole match — never resets. Undefined if this Hero has no Signature. */
  signatureUsesRemaining?: number;
  /** Whether this player's firstSpellDiscount Passive (if they have one) has already applied this turn. Resets every startTurn; harmless/unused for Heroes without that Passive. */
  firstSpellDiscountUsedThisTurn: boolean;
}

export interface BoardState {
  /** Melee-forward creature row, columns 0-4. Always eligible to attack. */
  vanguard: (CardInstance | null)[]; // length 5
  /**
   * Backline creature row, columns 0-4. Cannot attack and cannot be
   * targeted by an attack yet — that unlocks with Ranged/Reach/Infiltrate
   * in Phase B (DESIGN.md §5). It exists structurally now so Phase B has
   * somewhere to put creatures.
   */
  support: (CardInstance | null)[]; // length 5
  buildings: (CardInstance | null)[]; // length 5, one per column
  spellAbilitySlots: (CardInstance | null)[]; // length 4
  equipment: CardInstance | null;
}

export interface PlayerState {
  id: PlayerId;
  hero: HeroInstance;
  guard: { current: number; max: number };
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

export const VANGUARD_SIZE = 5;
export const SUPPORT_SIZE = 5;
export const BUILDING_SLOTS = 5;
export const SPELL_ABILITY_SLOTS = 4;
export const STARTING_HAND_SIZE = 4;
export const MAX_HAND_SIZE = 10;
export const STARTING_POOL = 5;
export const MAX_POOL = 10;
export const STARTING_GUARD = 100;
export const DECK_SIZE = 30;
