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
  | "warcry"
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
  | "push"
  | "stealth"
  | "ward"
  | "cleave"
  | "drain"
  | "bloodied"
  | "summon"
  | "armiger";

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

/**
 * Creates a copy of the named Creature card on the controller's own board
 * (Summon keyword, DESIGN.md §7) — into the first row with room for its
 * `spaceCost`, Vanguard preferred over Support. No explicit target: like a
 * Warcry with no legal target, it just fizzles (does nothing) if neither
 * row has room.
 */
export interface SummonCreatureEffect {
  kind: "summonCreature";
  creatureId: string;
  /** Swarm (DESIGN.md §16) — create this many copies instead of one. Omit or 1 for a plain single summon. Stops early (partial fizzle) if the board runs out of room partway through. */
  count?: number;
}

/**
 * Consume (DESIGN.md §16): destroy a targeted allied creature — bypassing
 * its own Armor/damage-reduction entirely, since this is a self-inflicted
 * sacrifice by its own controller, not a hostile attack — then permanently
 * buff every other creature the controller still has on board.
 */
export interface ConsumeEffect {
  kind: "consume";
  target: EffectTarget;
  attackDelta?: number;
  hpDelta?: number;
}

/**
 * Transformation (DESIGN.md §16): a targeted allied creature becomes a
 * different (typically larger) named creature in place, preserving its
 * summoning-sickness/exhaustion state and statuses but resetting its
 * stat deltas to the new form's own base stats. Fizzles (no-op) if the
 * new form is Massive and there's no contiguous room for it in the same
 * row, per §5.
 */
export interface TransformEffect {
  kind: "transform";
  target: EffectTarget;
  creatureId: string;
}

export type CardEffect =
  | DamageEffect
  | HealEffect
  | ApplyStatusEffect
  | BuffEffect
  | DrawCardEffect
  | GainGuardEffect
  | GainCapEffect
  | SummonCreatureEffect
  | ConsumeEffect
  | TransformEffect;

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
  /** Rule-Breaks (DESIGN.md §9) — a curated menu of numeric deltas a Legendary-tier Hero can carry. Applied once at match start. Omit entirely for a Hero that plays by the standard board/pool shape. */
  ruleBreaks?: HeroRuleBreaks;
}

/**
 * Only numeric-delta modifiers are supported (DESIGN.md §9's own "Open
 * default") — a fully bespoke rule-break is one-off card-specific code,
 * built when that specific card exists, not a general system. All fields
 * are deltas applied once at match start, on top of the standard shape.
 */
export interface HeroRuleBreaks {
  extraSpellAbilitySlots?: number;
  extraBuildingSlots?: number;
  vanguardSlotDelta?: number;
  supportSlotDelta?: number;
  startingGuardDelta?: number;
  resourceCapDelta?: number;
  manaCapDelta?: number;
  energyCapDelta?: number;
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
  /** Requires the `bloodied` keyword. Active only while currentHp is at or below half of maxHp (DESIGN.md §7) — live, re-evaluated the same way as flank/formation, never stored on the CardInstance. */
  bloodiedBonus?: PositionalBonus;
}

/**
 * A Building's activated ability (DESIGN.md §11) — Resources-costed by
 * default, since that's the archetype's own cost pool, but a specific card
 * can spend a different one instead (e.g. a Demon Gate spending Mana).
 * Unlike a Spell/Ability card, there's no charge count: a Building is a
 * persistent battlefield object, not consumed on use, so its ability is
 * repeatable every turn — gated only by whether its cost is affordable,
 * same as a Ritual Spell with unlimited charges.
 */
export interface BuildingActivatedAbility {
  effect: CardEffect;
  activateCost: number;
  /** Defaults to "resource" (the archetype's own pool) when omitted. */
  pool?: "resource" | "mana" | "energy";
  text?: string;
}

export interface BuildingDefinition extends CardDefinitionBase {
  archetype: "building";
  hp: number;
  triggers: Trigger[];
  /**
   * Only the auraBuff template is supported for Buildings so far (a
   * banner/totem effect) — firstSpellDiscount is a Hero-only concept for
   * now, not yet given a stacking/interaction model for a second source,
   * so it's deliberately excluded from this field's type rather than
   * silently accepted and ignored.
   */
  passive?: Extract<PassiveEffect, { kind: "auraBuff" }>;
  ability?: BuildingActivatedAbility;
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

/** Tags on an Equipment card (DESIGN.md §12) — purely descriptive today; a bearer restricting which categories it can hold is a possible future refinement, not built (moot while every bearer can only hold 1 item total anyway). */
export type EquipmentCategory = "weapon" | "armor" | "accessory" | "mount";

export interface EquipmentDefinition extends CardDefinitionBase {
  archetype: "equipment";
  category: EquipmentCategory;
  attackBonus: number;
  damageReduction: number;
}

/** Who an Equipment card in the zone is currently equipped to — the Hero, or an Armiger creature (DESIGN.md §12). */
export type EquipmentBearer = { kind: "hero" } | { kind: "creature"; instanceId: string };

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
  /** Stealth (DESIGN.md §7) is permanently lost once this creature attacks — tracked per-instance since the keyword itself is static on the definition. */
  stealthBroken?: boolean;
  /** Ward (DESIGN.md §7) is a one-time negation — set true once it's been consumed by a hostile targeted Spell/Ability. */
  wardConsumed?: boolean;
  // Spell / ability runtime state
  chargesRemaining?: number | "unlimited";
  /** Equipment only: who this item is currently equipped to. null = sitting Unassigned in the zone (DESIGN.md §12). */
  equipmentBearer?: EquipmentBearer | null;
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
  /** The Equipment zone (DESIGN.md §12) — a player-owned inventory, not a board column. Each slot holds one Equipment card, assigned to a bearer or sitting Unassigned. */
  equipment: (CardInstance | null)[]; // length 4
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
export const EQUIPMENT_ZONE_SIZE = 4;
export const STARTING_HAND_SIZE = 4;
export const MAX_HAND_SIZE = 10;
export const STARTING_POOL = 5;
export const MAX_POOL = 10;
export const STARTING_GUARD = 100;
export const DECK_SIZE = 30;
