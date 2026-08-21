import type {
  BuildingActivatedAbility,
  CardArchetype,
  CardDefinition,
  CardEffect,
  CreatureType,
  Element,
  EquipmentCategory,
  Faction,
  Keyword,
  PassiveEffect,
  Race,
  Rarity,
  Trigger,
  TriggerName,
} from "../engine/types";
import rawCustomCards from "./customCards.json";

// Loads and validates src/data/customCards.json — see CARDS.md for the schema.
// Invalid entries are skipped with a console warning rather than crashing the
// app, so a typo in a hand- or LLM-generated card doesn't break the game.

const VALID_ARCHETYPES: CardArchetype[] = ["creature", "building", "spell", "ability", "equipment"];
const VALID_RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];
const VALID_KEYWORDS: Keyword[] = [
  "ranged",
  "reach",
  "infiltrate",
  "charge",
  "warcry",
  "counter",
  "revenge",
  "frenzy",
  "immune",
  "poison",
  "taunt",
  "protector",
  "flank",
  "formation",
  "advance",
  "push",
  "vanish",
  "ward",
  "cleave",
  "drain",
  "bloodied",
  "summon",
  "armiger",
  "enrage",
  "doubleStrike",
  "resistant",
  "deadeye",
  "duel",
  "crowdPleaser",
  "bleed",
  "burn",
  "frostArmor",
  "massive",
];
const VALID_EQUIPMENT_CATEGORIES: EquipmentCategory[] = ["weapon", "armor", "accessory", "mount"];
const VALID_ELEMENTS: Element[] = [
  "frost",
  "fire",
  "nature",
  "light",
  "darkness",
  "arcane",
  "martial",
  "blood",
  "infernal",
  "chaos",
];
const VALID_FACTIONS: Faction[] = [
  "infernal-court",
  "roseguard-kingdom",
  "moonveil-coven",
  "velvet-syndicate",
  "wildheart-tribes",
  "celestial-academy",
  "necropolitan",
  "arcane-industries",
];
const VALID_RACES: Race[] = [
  "beast",
  "demon",
  "dragon",
  "elemental",
  "mech",
  "human",
  "undead",
  "goblin",
  "dwarf",
  "elf",
  "pixie",
  "ogre",
  "giant",
  "dark-elf",
  "angel",
  "orc",
  "gnome",
  "troll",
  "dryad",
  "fairy",
  "harpy",
  "fiend",
  "vampire",
];
const VALID_TRIGGER_NAMES: TriggerName[] = ["onPlay", "onAttack", "onDeath", "startOfTurn", "endOfTurn"];
const EFFECT_KINDS_NEEDING_TARGET = new Set(["damage", "heal", "applyStatus", "buff", "consume", "transform", "garrison", "devour"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidEffect(effect: unknown): effect is CardEffect {
  if (!isRecord(effect) || typeof effect.kind !== "string") return false;
  const kind = effect.kind;

  if (EFFECT_KINDS_NEEDING_TARGET.has(kind) && typeof effect.target !== "string") return false;
  if ((kind === "damage" || kind === "heal") && typeof effect.amount !== "number") return false;
  if (kind === "applyStatus" && (typeof effect.status !== "string" || typeof effect.amount !== "number")) return false;
  if ((kind === "drawCard" || kind === "gainGuard" || kind === "gainIncome" || kind === "drawCreature") && typeof effect.amount !== "number") return false;
  if (kind === "gainCap" && (typeof effect.pool !== "string" || typeof effect.amount !== "number")) return false;
  if ((kind === "summonCreature" || kind === "transform") && (typeof effect.creatureId !== "string" || !effect.creatureId)) return false;
  if (kind === "multi" && (!Array.isArray(effect.effects) || !effect.effects.every(isValidEffect))) return false;

  return true;
}

function parseTriggers(raw: unknown): Trigger[] {
  if (!Array.isArray(raw)) return [];
  const triggers: Trigger[] = [];
  for (const t of raw) {
    if (isRecord(t) && typeof t.on === "string" && VALID_TRIGGER_NAMES.includes(t.on as TriggerName) && isValidEffect(t.effect)) {
      triggers.push({ on: t.on as TriggerName, effect: t.effect });
    }
  }
  return triggers;
}

function parseKeywords(raw: unknown): Keyword[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is Keyword => typeof k === "string" && VALID_KEYWORDS.includes(k as Keyword));
}

const VALID_CREATURE_TYPES: CreatureType[] = [
  "fighter",
  "ranger",
  "defender",
  "beast",
  "elemental",
  "mage",
  "ogre",
  "giant",
  "dragon",
  "support",
  "creature",
  "rogue",
];

function parseCreatureType(raw: unknown): CreatureType[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const types = raw.filter((t): t is CreatureType => typeof t === "string" && VALID_CREATURE_TYPES.includes(t as CreatureType));
  return types.length > 0 ? types : undefined;
}

function parseRaces(raw: unknown): Race[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const races = raw.filter((r): r is Race => typeof r === "string" && VALID_RACES.includes(r as Race));
  return races.length > 0 ? races : undefined;
}

/** Only the auraBuff template is accepted for a custom Building's passive — see BuildingDefinition's doc comment in types.ts. */
function parseBuildingPassive(raw: unknown): Extract<PassiveEffect, { kind: "auraBuff" }> | undefined {
  if (!isRecord(raw) || raw.kind !== "auraBuff") return undefined;
  if (typeof raw.attackDelta !== "number") return undefined;
  const filter = raw.filter;
  if (filter === "all") return { kind: "auraBuff", filter: "all", attackDelta: raw.attackDelta };
  if (isRecord(filter) && typeof filter.race === "string") {
    return { kind: "auraBuff", filter: { race: filter.race as never }, attackDelta: raw.attackDelta };
  }
  if (isRecord(filter) && typeof filter.faction === "string") {
    return { kind: "auraBuff", filter: { faction: filter.faction as never }, attackDelta: raw.attackDelta };
  }
  return undefined;
}

function parseBuildingAbility(raw: unknown): BuildingActivatedAbility | undefined {
  if (!isRecord(raw)) return undefined;
  if (typeof raw.activateCost !== "number") return undefined;
  if (raw.pool !== undefined && raw.pool !== "resource" && raw.pool !== "mana" && raw.pool !== "energy") return undefined;
  if (!isValidEffect(raw.effect)) return undefined;
  return {
    effect: raw.effect,
    activateCost: raw.activateCost,
    pool: raw.pool,
    charges: typeof raw.charges === "number" ? raw.charges : undefined,
    text: typeof raw.text === "string" ? raw.text : undefined,
  };
}

export function validateCard(raw: unknown): CardDefinition | null {
  if (!isRecord(raw)) return null;
  const { id, name, archetype, cost, rarity } = raw;
  if (typeof id !== "string" || !id) return null;
  if (typeof name !== "string" || !name) return null;
  if (typeof archetype !== "string" || !VALID_ARCHETYPES.includes(archetype as CardArchetype)) return null;
  if (typeof cost !== "number") return null;
  if (typeof rarity !== "string" || !VALID_RARITIES.includes(rarity as Rarity)) return null;

  const text = typeof raw.text === "string" ? raw.text : undefined;
  const art = typeof raw.art === "string" ? raw.art : undefined;
  const element = typeof raw.element === "string" && VALID_ELEMENTS.includes(raw.element as Element) ? (raw.element as Element) : undefined;
  const faction = typeof raw.faction === "string" && VALID_FACTIONS.includes(raw.faction as Faction) ? (raw.faction as Faction) : undefined;
  const races = parseRaces(raw.races);
  const base = { id, name, cost, rarity: rarity as Rarity, text, art, element, faction, races };

  switch (archetype) {
    case "creature": {
      if (typeof raw.attack !== "number" || typeof raw.hp !== "number") return null;
      return {
        ...base,
        archetype: "creature",
        attack: raw.attack,
        hp: raw.hp,
        keywords: parseKeywords(raw.keywords),
        triggers: parseTriggers(raw.triggers),
        creatureType: parseCreatureType(raw.creatureType),
      };
    }
    case "building": {
      if (typeof raw.hp !== "number") return null;
      return {
        ...base,
        archetype: "building",
        hp: raw.hp,
        triggers: parseTriggers(raw.triggers),
        passive: parseBuildingPassive(raw.passive),
        ability: parseBuildingAbility(raw.ability),
      };
    }
    case "spell": {
      const spellForm = raw.spellForm;
      if (spellForm !== "instant" && spellForm !== "ritual" && spellForm !== "charged") return null;
      if (!isValidEffect(raw.effect)) return null;
      if (spellForm === "instant") {
        return { ...base, archetype: "spell", spellForm, effect: raw.effect };
      }
      if (typeof raw.activateCost !== "number") return null;
      if (raw.charges !== "unlimited" && typeof raw.charges !== "number") return null;
      return { ...base, archetype: "spell", spellForm, activateCost: raw.activateCost, charges: raw.charges, effect: raw.effect };
    }
    case "ability": {
      const abilityForm = raw.abilityForm;
      if (abilityForm !== "instant" && abilityForm !== "activated") return null;
      if (!isValidEffect(raw.effect)) return null;
      if (abilityForm === "instant") {
        return { ...base, archetype: "ability", abilityForm, effect: raw.effect };
      }
      if (typeof raw.activateCost !== "number") return null;
      if (raw.charges !== "unlimited" && typeof raw.charges !== "number") return null;
      return {
        ...base,
        archetype: "ability",
        abilityForm,
        activateCost: raw.activateCost,
        charges: raw.charges,
        effect: raw.effect,
      };
    }
    case "equipment": {
      if (typeof raw.attackBonus !== "number" || typeof raw.damageReduction !== "number") return null;
      if (typeof raw.category !== "string" || !VALID_EQUIPMENT_CATEGORIES.includes(raw.category as EquipmentCategory)) return null;
      return {
        ...base,
        archetype: "equipment",
        category: raw.category as EquipmentCategory,
        attackBonus: raw.attackBonus,
        damageReduction: raw.damageReduction,
        keywords: parseKeywords(raw.keywords),
        charges: typeof raw.charges === "number" ? raw.charges : undefined,
      };
    }
    default:
      return null;
  }
}

export function loadCustomCards(): CardDefinition[] {
  if (!Array.isArray(rawCustomCards)) return [];
  const results: CardDefinition[] = [];
  for (const raw of rawCustomCards) {
    const card = validateCard(raw);
    if (card) {
      results.push(card);
    } else {
      console.warn("[customCards.json] Skipped an invalid card entry — check it against CARDS.md.", raw);
    }
  }
  return results;
}
