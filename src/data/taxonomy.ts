import type { CardArchetype, CreatureType, Element, EquipmentCategory, Faction, Keyword, Race, Rarity, StatusType } from "../engine/types";

export const ELEMENT_LABELS: Record<Element, string> = {
  frost: "Frost",
  fire: "Fire",
  nature: "Nature",
  light: "Light",
  darkness: "Darkness",
  arcane: "Arcane",
  martial: "Martial",
  blood: "Blood",
  infernal: "Infernal",
  chaos: "Chaos",
};

export const FACTION_LABELS: Record<Faction, string> = {
  "infernal-court": "The Infernal Court",
  "roseguard-kingdom": "The Roseguard Kingdom",
  "moonveil-coven": "The Moonveil Coven",
  "velvet-syndicate": "The Velvet Syndicate",
  "wildheart-tribes": "The Wildheart Tribes",
  "celestial-academy": "The Celestial Academy",
  necropolitan: "The Necropolitan",
  "arcane-industries": "Arcane Industries Consortium",
};

export const RACE_LABELS: Record<Race, string> = {
  beast: "Beast",
  demon: "Demon",
  dragon: "Dragon",
  elemental: "Elemental",
  mech: "Mech",
  human: "Human",
  undead: "Undead",
  goblin: "Goblin",
  dwarf: "Dwarf",
  elf: "Elf",
  pixie: "Pixie",
  ogre: "Ogre",
  giant: "Giant",
  "dark-elf": "Dark Elf",
  angel: "Angel",
  orc: "Orc",
  gnome: "Gnome",
  troll: "Troll",
  dryad: "Dryad",
  fairy: "Fairy",
  harpy: "Harpy",
  fiend: "Fiend",
  vampire: "Vampire",
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export const ARCHETYPE_LABELS: Record<CardArchetype, string> = {
  hero: "Hero",
  creature: "Creature",
  building: "Building",
  spell: "Spell",
  ability: "Ability",
  equipment: "Equipment",
};

/** Which resource pool an archetype costs from (mirrors game.ts's costPoolFor) — just the icon shown on the card face, not the payment logic itself. */
export function costPoolIcon(archetype: CardArchetype): string {
  if (archetype === "spell") return "🔮"; // Mana
  if (archetype === "creature" || archetype === "ability") return "⚡"; // Energy
  return "🪙"; // Resources (building, equipment, hero)
}

export const KEYWORD_LABELS: Record<Keyword, string> = {
  ranged: "Ranged",
  reach: "Reach",
  infiltrate: "Infiltrate",
  charge: "Charge",
  warcry: "Warcry",
  counter: "Counter",
  revenge: "Revenge",
  frenzy: "Frenzy",
  immune: "Immune",
  poison: "Poison",
  taunt: "Taunt",
  protector: "Protector",
  flank: "Flank",
  formation: "Formation",
  advance: "Advance",
  push: "Push",
  vanish: "Vanish",
  ward: "Ward",
  cleave: "Cleave",
  drain: "Drain",
  bloodied: "Bloodied",
  summon: "Summon",
  armiger: "Armiger",
  enrage: "Enrage",
  doubleStrike: "Double Strike",
  resistant: "Resistant",
  deadeye: "Deadeye",
  duel: "Duel",
  crowdPleaser: "Crowd Pleaser",
  bleed: "Bleed",
  burn: "Burn",
  frostArmor: "Frost Armor",
  massive: "Massive",
};

/** Small glyphs shown on the compact card face so keyworded cards are recognizable at a glance. */
export const KEYWORD_ICONS: Record<Keyword, string> = {
  taunt: "🛡️",
  warcry: "📯",
  revenge: "⚰️",
  charge: "⚡",
  ranged: "🏹",
  reach: "🔱",
  infiltrate: "🥷",
  counter: "⚔️",
  frenzy: "💢",
  immune: "✨",
  poison: "☠️",
  protector: "🔰",
  flank: "↔️",
  formation: "🤝",
  advance: "⏩",
  push: "🫸",
  vanish: "🌫️",
  ward: "🧿",
  cleave: "🪓",
  drain: "🩸",
  bloodied: "💔",
  summon: "🌀",
  armiger: "🎒",
  enrage: "😡",
  doubleStrike: "⚔️",
  resistant: "🪨",
  deadeye: "🎯",
  duel: "🗡️",
  crowdPleaser: "🎉",
  bleed: "🩹",
  burn: "🔥",
  frostArmor: "❄️",
  massive: "🐘",
};

export const CREATURE_TYPE_LABELS: Record<CreatureType, string> = {
  fighter: "Fighter",
  ranger: "Ranger",
  defender: "Defender",
  beast: "Beast",
  elemental: "Elemental",
  mage: "Mage",
  ogre: "Ogre",
  giant: "Giant",
  dragon: "Dragon",
  support: "Support",
  creature: "Creature",
};
export const CREATURE_TYPE_OPTIONS = Object.keys(CREATURE_TYPE_LABELS) as CreatureType[];

export const STATUS_LABELS: Record<StatusType, string> = {
  poison: "Poison",
  bleed: "Bleed",
  burn: "Burn",
  freeze: "Freeze",
};

export const STATUS_ICONS: Record<StatusType, string> = {
  poison: "☠",
  bleed: "🩹",
  burn: "🔥",
  freeze: "❄️",
};
export const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as StatusType[];

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  weapon: "Weapon",
  armor: "Armor",
  accessory: "Accessory",
  mount: "Mount",
};
export const EQUIPMENT_CATEGORY_OPTIONS = Object.keys(EQUIPMENT_CATEGORY_LABELS) as EquipmentCategory[];

/**
 * Guard is one mechanic (DESIGN.md §6) skinned per Faction — a Human Kingdom
 * deck sees "Militia", a Necropolitan deck sees "Grave Wardens", etc. A
 * Hero with no Faction (most starter Heroes today) falls back to "Guard".
 */
export const GUARD_LABELS: Record<Faction, string> = {
  "infernal-court": "Infernal Legion",
  "roseguard-kingdom": "Militia",
  "moonveil-coven": "Coven Wardens",
  "velvet-syndicate": "Syndicate Enforcers",
  "wildheart-tribes": "Wildheart Warband",
  "celestial-academy": "Heavenly Host",
  necropolitan: "Grave Wardens",
  "arcane-industries": "Construct Wardens",
};

export function guardLabel(faction: Faction | undefined): string {
  return faction ? GUARD_LABELS[faction] : "Guard";
}

export const ELEMENT_OPTIONS = Object.keys(ELEMENT_LABELS) as Element[];
export const FACTION_OPTIONS = Object.keys(FACTION_LABELS) as Faction[];
export const RACE_OPTIONS = Object.keys(RACE_LABELS) as Race[];
export const RARITY_OPTIONS = Object.keys(RARITY_LABELS) as Rarity[];
export const KEYWORD_OPTIONS = Object.keys(KEYWORD_LABELS) as Keyword[];
