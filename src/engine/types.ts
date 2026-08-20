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
  | "vanish"
  | "ward"
  | "cleave"
  | "drain"
  | "bloodied"
  | "summon"
  | "armiger"
  | "enrage"
  | "doubleStrike"
  | "resistant"
  | "deadeye"
  | "duel"
  | "crowdPleaser"
  | "bleed"
  | "burn"
  | "frostArmor"
  | "massive";

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

/**
 * Combat-role tag from the Neutral Core Set spec's "Type" column (e.g.
 * Fighter, Ranger, Defender) — distinct from `Race` (which drives
 * Faction/Allegiance rules and predates this field). A creature can carry
 * more than one, printed as "Defender • Elemental" etc. — Formation checks
 * whether an adjacent creature shares any of these with the formation
 * holder.
 */
export type CreatureType =
  | "fighter"
  | "ranger"
  | "defender"
  | "beast"
  | "elemental"
  | "mage"
  | "ogre"
  | "giant"
  | "dragon"
  | "support"
  | "creature";

export type StatusType = "burn" | "poison" | "bleed" | "freeze";

export interface StatusEffectInstance {
  type: StatusType;
  amount: number;
  /** Ticks down once per affected-player turn-start; expires at 0. Omitted = persists indefinitely (no current status uses this, but it stays supported). */
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
  /** Creature or Hero, never a Building (Lightning Bolt, Renewal, Toxic Cloud). */
  | "targetCreatureOrPlayer"
  | "allEnemyCreatures"
  | "allFriendlyCreatures"
  | "self"
  | "selfHero"
  /** Black Dragon: the caster picks an enemy row (Vanguard or Backline) at play-time; the effect hits every creature in it. */
  | "targetRow"
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
  /** Omit for a status that persists until cured/death. Poison/Bleed/Burn/Freeze all normally carry an explicit duration now. */
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

/** Permanently raises the controller's per-turn Resources regeneration (Farm/Gold Mine) — distinct from GainCapEffect, which raises the ceiling, not the trickle rate. */
export interface GainIncomeEffect {
  kind: "gainIncome";
  amount: number;
}

/** Recruitment Station: draws the first creature card found in the controller's deck instead of the top card. Fizzles (no-op) if the deck has no creature left. */
export interface DrawCreatureEffect {
  kind: "drawCreature";
  amount: number;
}

/**
 * Elder Flame Imp: destroys the target creature (bypassing Armor/Resistant,
 * like Consume — a removal effect, not a hostile hit), then buffs *the
 * creature whose onPlay trigger produced this effect* by half the
 * destroyed creature's own printed Attack/Health, rounded down. Needs
 * `resolveEffect`'s `selfInstanceId` (the trigger's own card) to know which
 * creature to buff — a bespoke single-card mechanic, same precedent as
 * Duel (see CreatureDefinition.duel's doc comment).
 */
export interface DevourEffect {
  kind: "devour";
  target: EffectTarget;
}

/**
 * Resolves each listed effect in order against the same target/source —
 * for a card whose printed text is more than one clause (Frost Nova: damage
 * + Freeze). **Scope note:** every sub-effect here must be one that doesn't
 * need its own explicit UI target (an AOE/self/selfHero shape) — this
 * doesn't extend the targeting system to let a single pending-target
 * selection feed multiple different explicit-target sub-effects; only
 * Frost Nova (both sub-effects "allEnemyCreatures") exercises this today.
 */
export interface MultiEffect {
  kind: "multi";
  effects: CardEffect[];
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

/**
 * Garrison (DESIGN.md §16): a targeted allied creature is moved off the
 * battlefield into the first friendly Building with an open "housed
 * creature" slot (`CardInstance.garrisonedCreature`), freeing its board
 * slot. A garrisoned creature can't attack, be attacked, or be targeted —
 * it isn't in any board row array, so all existing targeting/combat code
 * simply can't see it, no extra exclusion checks needed. It's ejected back
 * onto the battlefield (or destroyed, if there's no room) if its Building
 * is destroyed — see `killCardIfDead`. Fizzles if no friendly Building has
 * room. **Open default:** every Building can house at most 1 creature, no
 * per-Building restriction (matches Equipment's 1-item-per-bearer cap);
 * there's no manual un-garrison action in this pass, only ejection on the
 * Building's death.
 */
export interface GarrisonEffect {
  kind: "garrison";
  target: EffectTarget;
}

export type CardEffect =
  | DamageEffect
  | HealEffect
  | ApplyStatusEffect
  | BuffEffect
  | DrawCardEffect
  | GainGuardEffect
  | GainCapEffect
  | GainIncomeEffect
  | DrawCreatureEffect
  | DevourEffect
  | MultiEffect
  | SummonCreatureEffect
  | ConsumeEffect
  | TransformEffect
  | GarrisonEffect;

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

/**
 * A conditional stat bump from a live-recomputed keyword (DESIGN.md §5) —
 * Attack always; `hpDelta` is an optional display-only companion (Formation's
 * "+2 Health" clause, Duel's "+2 Health"). Live HP bonuses are an "Open
 * default": they show up in the creature's effective-max-HP display
 * (`getEffectiveCreatureMaxHp` in combat.ts) but never mutate `currentHp`,
 * never affect death checks, and never raise the heal cap — the same
 * simplification already used for Flank/Formation's Attack-only bonus,
 * extended rather than replaced now that Formation/Duel/Crowd Pleaser need
 * an HP component too. Re-evaluated live, never stored on the CardInstance.
 */
export interface PositionalBonus {
  attackDelta: number;
  hpDelta?: number;
}

export interface CreatureDefinition extends CardDefinitionBase {
  archetype: "creature";
  attack: number;
  hp: number;
  keywords: Keyword[];
  triggers: Trigger[];
  /** Combat-role tag(s) from the spec's Type column — see CreatureType. Drives type-conditional Formation. */
  creatureType?: CreatureType[];
  /** Massive: how many contiguous same-row slots this creature occupies. Omit for the default of 1. */
  spaceCost?: number;
  /** Requires the `flank` keyword. Active only while occupying column 1 or 5 of its row (DESIGN.md §5). */
  flankBonus?: PositionalBonus;
  /** Requires the `formation` keyword. Active only while an adjacent, same-row creature shares one of this creature's `creatureType` tags (DESIGN.md §5/§17). */
  formationBonus?: PositionalBonus;
  /** Requires the `bloodied` keyword. Active only while currentHp is at or below half of maxHp (DESIGN.md §7) — live, re-evaluated the same way as flank/formation, never stored on the CardInstance. */
  bloodiedBonus?: PositionalBonus;
  /** Requires the `frenzy` keyword (DESIGN.md §17). Permanent Attack gained every time this creature attacks — stored on `attackDelta`, applied once per attack in declareCreatureAttack. */
  frenzyBonus?: PositionalBonus;
  /** Requires the `enrage` keyword (DESIGN.md §17). Live Attack bonus scaling with current missing HP (maxHp - currentHp) — heals reduce it back down, never stored on the CardInstance. */
  enrageBonus?: { attackPerMissingHp: number };
  /** Requires the `resistant` keyword (DESIGN.md §17). Flat reduction applied to every incoming hit, alongside any bearer Armor reduction, floored at 0. */
  resistantAmount?: number;
  /** Requires the `deadeye` keyword (DESIGN.md §17). Attack-instance-scoped bonus (not live-recomputed, not permanently stored) added only while resolving an attack against a Backline target. */
  deadeyeBonus?: PositionalBonus;
  /** Requires the `crowdPleaser` keyword (DESIGN.md §17). Live Attack/HP bonus scaling with the number of *other* creatures currently on the board (both sides — an "Open default", since the spec just says "on the board"), each capped independently. */
  crowdPleaserBonus?: { attackPerCreature: number; hpPerCreature: number; attackCap: number; hpCap: number };
  /** Requires the `duel` keyword (DESIGN.md §17). An Energy-costed activation that marks one enemy creature (see `CardInstance.markedTargetId`); while the mark holds, this creature gets `bonus` live and may attack the marked creature bypassing Vanguard/Taunt. Bespoke, single-card mechanic — matches the project's existing "one-off rule isn't a general system" precedent (see HeroRuleBreaks). */
  duel?: { activateCost: number; bonus: PositionalBonus };
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
  /** Total lifetime activations (Recruitment Station: 2) before the ability stops working — the Building itself stays on the board, unlike a Spell/Ability card's charges running out. Omit for the existing unlimited-while-affordable default. */
  charges?: number;
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
  /**
   * Ancient Mage Tower: while standing, adds this many points to every
   * damage/heal/status-amount instance produced by the controller's Spell
   * cards. **Open default:** applied once, at the moment the Spell's effect
   * resolves (baked into a Poison/Bleed/Burn status's stored amount too,
   * so its remaining ticks keep the bonus even if the Tower is later
   * destroyed) rather than re-checked live on every future status tick —
   * the simpler of the two readings the spec's own worked example leaves
   * ambiguous.
   */
  spellAmplify?: number;
}

/**
 * Spells come in three forms (DESIGN.md §1a):
 * - "instant": no slot at all — cast straight from hand for `cost` Mana,
 *   the effect resolves immediately, then it goes to the discard pile.
 *   `activateCost`/`charges` don't apply and are omitted.
 * - "ritual": occupies a Spell/Ability slot, unlimited charges (`charges: "unlimited"`).
 * - "charged": occupies a slot with a fixed charge count (`charges: number`); Fizzles (discards) at 0.
 * Abilities now mirror this with their own two-form split — see AbilityDefinition.
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

/**
 * Abilities come in two forms, mirroring Spells (DESIGN.md §1a):
 * - "instant": no slot at all — resolves immediately from hand for `cost`
 *   Energy (Exercise, Executioner's Strike), then discards. `activateCost`/
 *   `charges` don't apply and are omitted.
 * - "activated": occupies a Spell/Ability slot, then is manually activated
 *   for `activateCost` Energy, `charges` times ("unlimited" for ∞).
 */
export interface AbilityDefinition extends CardDefinitionBase {
  archetype: "ability";
  abilityForm: "instant" | "activated";
  /** Energy cost to activate once on the field. Omitted for "instant" — there's no separate activation step. */
  activateCost?: number;
  /** Omitted for "instant". */
  charges?: number | "unlimited";
  effect: CardEffect;
}

/** Tags on an Equipment card (DESIGN.md §12) — purely descriptive today; a bearer restricting which categories it can hold is a possible future refinement, not built (moot while every bearer can only hold 1 item total anyway). */
export type EquipmentCategory = "weapon" | "armor" | "accessory" | "mount";

export interface EquipmentDefinition extends CardDefinitionBase {
  archetype: "equipment";
  category: EquipmentCategory;
  attackBonus: number;
  damageReduction: number;
  /** Grants this keyword to the Hero while equipped (Cloak of Shadows: Vanish) — checked via `heroHasVanish`-style lookups, not `hasKeyword` (that only reads Creature/Building definitions). */
  keywords?: Keyword[];
  /** Total charges before this item auto-discards — decrements once per Hero attack while equipped (Cloak of Shadows: 3 charges / 3 attacks). Omit for the existing no-expiry default. */
  charges?: number;
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
  /** Double Strike bookkeeping (DESIGN.md §17): attacks already made this turn. `hasAttackedThisTurn` still means "exhausted, cannot attack again" for every existing caller — only creatureCanAttack/declareCreatureAttack look at this field directly. */
  attacksUsedThisTurn?: number;
  statuses: StatusEffectInstance[];
  /** Ward (DESIGN.md §7) is a one-time negation — set true once it's been consumed by a hostile targeted Spell/Ability. */
  wardConsumed?: boolean;
  /** Duel (DESIGN.md §17): the enemy creature instance this creature has marked, if any. Live-checked every time (still on the board?) rather than explicitly cleared when the mark's target dies — it just silently stops mattering. */
  markedTargetId?: string;
  // Spell / ability runtime state
  chargesRemaining?: number | "unlimited";
  /** Equipment only: who this item is currently equipped to. null = sitting Unassigned in the zone (DESIGN.md §12). */
  equipmentBearer?: EquipmentBearer | null;
  /** Building only: a creature housed inside via Garrison (DESIGN.md §16) — off the battlefield entirely, not in any board row array. null/undefined = not garrisoning anyone. */
  garrisonedCreature?: CardInstance | null;
}

export interface ResourcePool {
  current: number;
  cap: number;
  /** Per-turn regeneration rate. Omitted = the existing default of 1/turn. Farm/Gold Mine raise this permanently (GainIncomeEffect) — only the `resources` pool uses this today; Mana/Energy fully refill to cap every turn instead. */
  income?: number;
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
