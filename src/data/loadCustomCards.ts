import type {
  CardArchetype,
  CardDefinition,
  CardEffect,
  Keyword,
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
const VALID_KEYWORDS: Keyword[] = ["ranged", "charge"];
const VALID_TRIGGER_NAMES: TriggerName[] = ["onPlay", "onAttack", "onDeath", "startOfTurn", "endOfTurn"];
const EFFECT_KINDS_NEEDING_TARGET = new Set(["damage", "heal", "applyStatus", "buff"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidEffect(effect: unknown): effect is CardEffect {
  if (!isRecord(effect) || typeof effect.kind !== "string") return false;
  const kind = effect.kind;

  if (EFFECT_KINDS_NEEDING_TARGET.has(kind) && typeof effect.target !== "string") return false;
  if ((kind === "damage" || kind === "heal") && typeof effect.amount !== "number") return false;
  if (kind === "applyStatus" && (typeof effect.status !== "string" || typeof effect.amount !== "number")) return false;
  if ((kind === "drawCard" || kind === "gainGuard") && typeof effect.amount !== "number") return false;
  if (kind === "gainCap" && (typeof effect.pool !== "string" || typeof effect.amount !== "number")) return false;

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
  const base = { id, name, cost, rarity: rarity as Rarity, text, art };

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
      };
    }
    case "building": {
      if (typeof raw.hp !== "number") return null;
      return { ...base, archetype: "building", hp: raw.hp, triggers: parseTriggers(raw.triggers) };
    }
    case "spell":
    case "ability": {
      if (typeof raw.activateCost !== "number") return null;
      if (raw.charges !== "unlimited" && typeof raw.charges !== "number") return null;
      if (!isValidEffect(raw.effect)) return null;
      return {
        ...base,
        archetype,
        activateCost: raw.activateCost,
        charges: raw.charges,
        effect: raw.effect,
      };
    }
    case "equipment": {
      if (typeof raw.attackBonus !== "number" || typeof raw.damageReduction !== "number") return null;
      return { ...base, archetype: "equipment", attackBonus: raw.attackBonus, damageReduction: raw.damageReduction };
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
