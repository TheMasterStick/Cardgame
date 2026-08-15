import type {
  AbilityDefinition,
  BuildingDefinition,
  CardDefinition,
  CreatureDefinition,
  EquipmentDefinition,
  HeroCardDefinition,
  SpellDefinition,
} from "../engine/types";
import { loadCustomCards } from "./loadCustomCards";

// ---------------------------------------------------------------------------
// Heroes — chosen before a match starts, not played from hand (cost is
// unused). Attack only matters once an Equipment card is in the Equipment
// slot. Fighter/Mage/Rogue are just the starting roster; more Hero cards
// with different stats can be added the same way anyone else adds a card.
// ---------------------------------------------------------------------------

const heroes: HeroCardDefinition[] = [
  { id: "fighter", name: "Fighter", archetype: "hero", cost: 0, rarity: "common", hp: 20, attack: 10 },
  { id: "mage", name: "Mage", archetype: "hero", cost: 0, rarity: "common", hp: 10, attack: 20 },
  { id: "rogue", name: "Rogue", archetype: "hero", cost: 0, rarity: "common", hp: 15, attack: 15 },
];

// ---------------------------------------------------------------------------
// Buildings — Back Row. Economy/pool buildings raise a resource cap on play;
// militia buildings grant Militia on play or each turn. See DESIGN.md §2, §5.
// ---------------------------------------------------------------------------

const buildings: BuildingDefinition[] = [
  {
    id: "gold-mine",
    name: "Gold Mine",
    archetype: "building",
    cost: 2,
    rarity: "common",
    hp: 3,
    text: "On Play: gain +1 max Resources.",
    triggers: [{ on: "onPlay", effect: { kind: "gainCap", pool: "resource", amount: 1 } }],
  },
  {
    id: "lumbermill",
    name: "Lumbermill",
    archetype: "building",
    cost: 2,
    rarity: "common",
    hp: 3,
    text: "On Play: gain +1 max Resources.",
    triggers: [{ on: "onPlay", effect: { kind: "gainCap", pool: "resource", amount: 1 } }],
  },
  {
    id: "farm",
    name: "Farm",
    archetype: "building",
    cost: 1,
    rarity: "common",
    hp: 2,
    text: "On Play: gain +1 max Resources.",
    triggers: [{ on: "onPlay", effect: { kind: "gainCap", pool: "resource", amount: 1 } }],
  },
  {
    id: "arcane-sanctum",
    name: "Arcane Sanctum",
    archetype: "building",
    cost: 3,
    rarity: "rare",
    hp: 4,
    text: "On Play: gain +1 max Mana.",
    triggers: [{ on: "onPlay", effect: { kind: "gainCap", pool: "mana", amount: 1 } }],
  },
  {
    id: "mana-pool",
    name: "Mana Pool",
    archetype: "building",
    cost: 2,
    rarity: "common",
    hp: 2,
    text: "On Play: gain +1 max Mana.",
    triggers: [{ on: "onPlay", effect: { kind: "gainCap", pool: "mana", amount: 1 } }],
  },
  {
    id: "training-field",
    name: "Training Field",
    archetype: "building",
    cost: 3,
    rarity: "rare",
    hp: 4,
    text: "On Play: gain +1 max Energy.",
    triggers: [{ on: "onPlay", effect: { kind: "gainCap", pool: "energy", amount: 1 } }],
  },
  {
    id: "exercise",
    name: "Exercise",
    archetype: "building",
    cost: 2,
    rarity: "common",
    hp: 2,
    text: "On Play: gain +1 max Energy.",
    triggers: [{ on: "onPlay", effect: { kind: "gainCap", pool: "energy", amount: 1 } }],
  },
  {
    id: "recruitment-station",
    name: "Recruitment Station",
    archetype: "building",
    cost: 2,
    rarity: "rare",
    hp: 3,
    text: "On Play: gain 15 Militia.",
    triggers: [{ on: "onPlay", effect: { kind: "gainMilitia", amount: 15 } }],
  },
  {
    id: "call-to-arms",
    name: "Call to Arms",
    archetype: "building",
    cost: 3,
    rarity: "epic",
    hp: 4,
    text: "Start of Turn: gain 5 Militia.",
    triggers: [{ on: "startOfTurn", effect: { kind: "gainMilitia", amount: 5 } }],
  },
  {
    id: "bulletin-board",
    name: "Bulletin Board",
    archetype: "building",
    cost: 1,
    rarity: "common",
    hp: 2,
    text: "On Play: gain 5 Militia.",
    triggers: [{ on: "onPlay", effect: { kind: "gainMilitia", amount: 5 } }],
  },
];

// ---------------------------------------------------------------------------
// Creatures — Front Row.
// ---------------------------------------------------------------------------

const creatures: CreatureDefinition[] = [
  {
    id: "militia-recruit",
    name: "Militia Recruit",
    archetype: "creature",
    cost: 1,
    rarity: "common",
    attack: 2,
    hp: 2,
    keywords: [],
    triggers: [],
  },
  {
    id: "footman",
    name: "Footman",
    archetype: "creature",
    cost: 2,
    rarity: "common",
    attack: 2,
    hp: 3,
    keywords: [],
    triggers: [],
  },
  {
    id: "shield-bearer",
    name: "Shield Bearer",
    archetype: "creature",
    cost: 2,
    rarity: "common",
    attack: 1,
    hp: 4,
    keywords: [],
    triggers: [],
  },
  {
    id: "arrow-archer",
    name: "Arrow Archer",
    archetype: "creature",
    cost: 2,
    rarity: "common",
    attack: 2,
    hp: 1,
    keywords: ["ranged"],
    text: "Ranged: can attack the Back Row through a full enemy Front Row.",
    triggers: [],
  },
  {
    id: "longbow-sniper",
    name: "Longbow Sniper",
    archetype: "creature",
    cost: 4,
    rarity: "rare",
    attack: 3,
    hp: 3,
    keywords: ["ranged"],
    text: "Ranged.",
    triggers: [],
  },
  {
    id: "berserker",
    name: "Berserker",
    archetype: "creature",
    cost: 3,
    rarity: "rare",
    attack: 4,
    hp: 2,
    keywords: ["charge"],
    text: "Charge: can attack the turn it's played.",
    triggers: [],
  },
  {
    id: "young-wolf",
    name: "Young Wolf",
    archetype: "creature",
    cost: 1,
    rarity: "common",
    attack: 1,
    hp: 1,
    keywords: ["charge"],
    text: "Charge.",
    triggers: [],
  },
  {
    id: "apprentice-mage",
    name: "Apprentice Mage",
    archetype: "creature",
    cost: 2,
    rarity: "common",
    attack: 1,
    hp: 3,
    keywords: [],
    text: "On Play: deal 1 damage to an enemy creature.",
    triggers: [{ on: "onPlay", effect: { kind: "damage", amount: 1, target: "targetCreature" } }],
  },
  {
    id: "plague-rat",
    name: "Plague Rat",
    archetype: "creature",
    cost: 2,
    rarity: "rare",
    attack: 2,
    hp: 2,
    keywords: [],
    text: "On Attack: poisons the creature it attacks for 1.",
    triggers: [{ on: "onAttack", effect: { kind: "applyStatus", status: "poison", amount: 1, target: "targetCreature" } }],
  },
  {
    id: "cleric",
    name: "Cleric",
    archetype: "creature",
    cost: 3,
    rarity: "rare",
    attack: 2,
    hp: 4,
    keywords: [],
    text: "On Play: restore 3 Hero HP.",
    triggers: [{ on: "onPlay", effect: { kind: "heal", amount: 3, target: "selfHero" } }],
  },
  {
    id: "flame-imp",
    name: "Flame Imp",
    archetype: "creature",
    cost: 2,
    rarity: "common",
    attack: 3,
    hp: 2,
    keywords: [],
    text: "On Play: deal 2 damage to your own Hero.",
    triggers: [{ on: "onPlay", effect: { kind: "damage", amount: 2, target: "selfHero" } }],
  },
  {
    id: "stone-golem",
    name: "Stone Golem",
    archetype: "creature",
    cost: 5,
    rarity: "rare",
    attack: 4,
    hp: 7,
    keywords: [],
    triggers: [],
  },
  {
    id: "dragon-whelp",
    name: "Dragon Whelp",
    archetype: "creature",
    cost: 6,
    rarity: "legendary",
    attack: 6,
    hp: 6,
    keywords: ["ranged"],
    text: "Ranged. On Play: deal 2 damage to all enemy Front Row creatures.",
    triggers: [{ on: "onPlay", effect: { kind: "damage", amount: 2, target: "allEnemyCreatures" } }],
  },
  {
    id: "assassin",
    name: "Assassin",
    archetype: "creature",
    cost: 3,
    rarity: "rare",
    attack: 3,
    hp: 2,
    keywords: [],
    text: "On Play: deal 2 damage to an enemy creature.",
    triggers: [{ on: "onPlay", effect: { kind: "damage", amount: 2, target: "targetCreature" } }],
  },
  {
    id: "stonewall-guardian",
    name: "Stonewall Guardian",
    archetype: "creature",
    cost: 3,
    rarity: "uncommon",
    attack: 2,
    hp: 6,
    keywords: ["taunt"],
    text: "Taunt.",
    triggers: [],
  },
  {
    id: "berserking-ogre",
    name: "Berserking Ogre",
    archetype: "creature",
    cost: 3,
    rarity: "rare",
    attack: 3,
    hp: 5,
    race: "ogre",
    keywords: ["frenzy"],
    text: "Frenzy: gains Attack equal to any damage it takes (while it survives).",
    triggers: [],
  },
  {
    id: "arcane-golem",
    name: "Arcane Golem",
    archetype: "creature",
    cost: 4,
    rarity: "rare",
    attack: 4,
    hp: 4,
    element: "arcane",
    faction: "arcane-industries",
    keywords: ["immune"],
    text: "Immune to spells.",
    triggers: [],
  },
  {
    id: "spiked-turtle",
    name: "Spiked Turtle",
    archetype: "creature",
    cost: 2,
    rarity: "uncommon",
    attack: 1,
    hp: 5,
    keywords: ["counter"],
    text: "Counter: when attacked, deal 2 damage to the attacker.",
    triggers: [{ on: "onDefend", effect: { kind: "damage", amount: 2, target: "targetCreature" } }],
  },
];

// ---------------------------------------------------------------------------
// Spells — placed into a Spell/Ability slot, activated with Mana.
// ---------------------------------------------------------------------------

const spells: SpellDefinition[] = [
  {
    id: "fireball",
    name: "Fireball",
    archetype: "spell",
    cost: 3,
    rarity: "rare",
    activateCost: 4,
    charges: 3,
    text: "Activate (4 Mana): deal 4 damage to a creature or building.",
    effect: { kind: "damage", amount: 4, target: "targetCreatureOrBuilding" },
  },
  {
    id: "lightning-bolt",
    name: "Lightning Bolt",
    archetype: "spell",
    cost: 2,
    rarity: "common",
    activateCost: 2,
    charges: 2,
    text: "Activate (2 Mana): deal 3 damage to a creature.",
    effect: { kind: "damage", amount: 3, target: "targetCreature" },
  },
  {
    id: "frost-nova",
    name: "Frost Nova",
    archetype: "spell",
    cost: 3,
    rarity: "epic",
    activateCost: 3,
    charges: 1,
    text: "Activate (3 Mana): deal 2 damage to all enemy Front Row creatures.",
    effect: { kind: "damage", amount: 2, target: "allEnemyCreatures" },
  },
  {
    id: "arcane-missiles",
    name: "Arcane Missiles",
    archetype: "spell",
    cost: 1,
    rarity: "common",
    activateCost: 1,
    charges: "unlimited",
    text: "Activate (1 Mana): deal 1 damage to a creature or building.",
    effect: { kind: "damage", amount: 1, target: "targetCreatureOrBuilding" },
  },
  {
    id: "renewal",
    name: "Renewal",
    archetype: "spell",
    cost: 2,
    rarity: "common",
    activateCost: 2,
    charges: "unlimited",
    text: "Activate (2 Mana): restore 3 HP to a creature, or your Hero.",
    effect: { kind: "heal", amount: 3, target: "targetAny" },
  },
  {
    id: "toxic-cloud",
    name: "Toxic Cloud",
    archetype: "spell",
    cost: 3,
    rarity: "rare",
    activateCost: 3,
    charges: 2,
    text: "Activate (3 Mana): poison a creature for 2.",
    effect: { kind: "applyStatus", status: "poison", amount: 2, target: "targetCreature" },
  },
];

// ---------------------------------------------------------------------------
// Abilities — placed into a Spell/Ability slot, activated with Energy.
// ---------------------------------------------------------------------------

const abilities: AbilityDefinition[] = [
  {
    id: "war-cry",
    name: "War Cry",
    archetype: "ability",
    cost: 2,
    rarity: "common",
    activateCost: 2,
    charges: "unlimited",
    text: "Activate (2 Energy): give a friendly creature +1 Attack permanently.",
    effect: { kind: "buff", attackDelta: 1, target: "targetCreature" },
  },
  {
    id: "focus",
    name: "Focus",
    archetype: "ability",
    cost: 1,
    rarity: "common",
    activateCost: 2,
    charges: "unlimited",
    text: "Activate (2 Energy): draw a card.",
    effect: { kind: "drawCard", amount: 1 },
  },
  {
    id: "second-wind",
    name: "Second Wind",
    archetype: "ability",
    cost: 2,
    rarity: "rare",
    activateCost: 3,
    charges: 2,
    text: "Activate (3 Energy): restore 5 Hero HP.",
    effect: { kind: "heal", amount: 5, target: "selfHero" },
  },
  {
    id: "rally",
    name: "Rally",
    archetype: "ability",
    cost: 3,
    rarity: "epic",
    activateCost: 4,
    charges: 1,
    text: "Activate (4 Energy): give all friendly creatures +1/+1 permanently.",
    effect: { kind: "buff", attackDelta: 1, hpDelta: 1, target: "allFriendlyCreatures" },
  },
  {
    id: "executioners-strike",
    name: "Executioner's Strike",
    archetype: "ability",
    cost: 3,
    rarity: "rare",
    activateCost: 3,
    charges: 2,
    text: "Activate (3 Energy): deal 5 damage to a creature.",
    effect: { kind: "damage", amount: 5, target: "targetCreature" },
  },
];

// ---------------------------------------------------------------------------
// Equipment — the single Equipment slot behind the Hero. Unlocks the Hero's
// printed Attack for melee combat, and may modify it further.
// ---------------------------------------------------------------------------

const equipment: EquipmentDefinition[] = [
  {
    id: "iron-sword",
    name: "Iron Sword",
    archetype: "equipment",
    cost: 2,
    rarity: "common",
    attackBonus: 0,
    damageReduction: 0,
    text: "Your Hero can attack.",
  },
  {
    id: "battle-shield",
    name: "Battle Shield",
    archetype: "equipment",
    cost: 3,
    rarity: "rare",
    attackBonus: 0,
    damageReduction: 2,
    text: "Your Hero can attack. Your Hero takes 2 less damage from all sources.",
  },
  {
    id: "cloak-of-shadows",
    name: "Cloak of Shadows",
    archetype: "equipment",
    cost: 2,
    rarity: "rare",
    attackBonus: 3,
    damageReduction: 0,
    text: "Your Hero can attack, with +3 Attack.",
  },
];

const builtInDefinitions: Record<string, CardDefinition> = Object.fromEntries(
  [...heroes, ...buildings, ...creatures, ...spells, ...abilities, ...equipment].map((c) => [c.id, c]),
);

// Cards from src/data/customCards.json are merged in on top of the built-ins,
// so adding a card is just adding a JSON entry — see CARDS.md. An id that
// collides with a built-in card is skipped (with a warning) rather than
// silently overwriting it.
for (const card of loadCustomCards()) {
  if (builtInDefinitions[card.id]) {
    console.warn(`[customCards.json] Card id "${card.id}" collides with a built-in card and was skipped.`);
    continue;
  }
  builtInDefinitions[card.id] = card;
}

export const CARD_DEFINITIONS: Record<string, CardDefinition> = builtInDefinitions;

/**
 * Merges admin-authored cards from Supabase into the live catalog, in
 * place — unlike the customCards.json merge, this deliberately overwrites
 * a built-in with the same id, since editing an existing card through the
 * admin panel is expected to replace it. Callers must trigger a re-render
 * themselves; this only mutates the shared CARD_DEFINITIONS object.
 */
export function mergeRemoteCards(cards: CardDefinition[]): void {
  for (const card of cards) {
    CARD_DEFINITIONS[card.id] = card;
  }
}

export const HEROES = heroes;
export const BUILDINGS = buildings;
export const CREATURES = creatures;
export const SPELLS = spells;
export const ABILITIES = abilities;
export const EQUIPMENT = equipment;
