import type { CardArchetype, CardDefinition } from "../engine/types";

export const MAX_PRINTED_CATEGORIES = 5;
export const RESOURCE_KINDS = ["energy", "mana", "resource"] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export type CardBaseKey =
  | ""
  | "CreatureBase"
  | "BuildingBase"
  | "SpellBase"
  | "AbilityBase"
  | "BaseAbility";

export interface CardLayoutOffsets {
  nameX: number;
  nameY: number;
  costX: number;
  costY: number;
  resourceX: number;
  resourceY: number;
  categoriesX: number;
  categoriesY: number;
  rulesX: number;
  rulesY: number;
  attackX: number;
  attackY: number;
  healthX: number;
  healthY: number;
}

/**
 * Renderer-only card presentation data.
 *
 * Nothing in the rules engine should depend on these values. The Card
 * Builder edits them, while React/Phaser renderers may consume the same
 * object so a card has one visual definition everywhere it appears.
 */
export interface CardPresentation {
  baseKey: CardBaseKey;
  resourceIcon: string;
  categories: string[];
  artScale: number;
  artX: number;
  artY: number;
  titleFont: string;
  bodyFont: string;
  nameSize: number;
  costSize: number;
  resourceSize: number;
  categorySize: number;
  rulesSize: number;
  statSize: number;
  layout: CardLayoutOffsets;
}

/** The centered project-default layout approved in the Card Builder. */
export const PROJECT_DEFAULT_LAYOUT: Readonly<CardLayoutOffsets> = {
  nameX: 7,
  nameY: 18,
  costX: -27,
  costY: -8,
  resourceX: -17,
  resourceY: -7,
  categoriesX: 0,
  categoriesY: 58,
  rulesX: 0,
  rulesY: 18,
  attackX: 4,
  attackY: 22,
  healthX: -6,
  healthY: 22,
};

export const PROJECT_DEFAULT_TYPOGRAPHY = {
  titleFont: "Trajan Pro, Cinzel, Georgia, serif",
  bodyFont: "Cinzel, Georgia, serif",
  nameSize: 21,
  costSize: 31,
  resourceSize: 28,
  categorySize: 13,
  rulesSize: 12,
  statSize: 29,
} as const;

export function humanizeCardLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function defaultBaseForArchetype(archetype: CardArchetype): CardBaseKey {
  if (archetype === "creature") return "CreatureBase";
  if (archetype === "building") return "BuildingBase";
  if (archetype === "spell") return "SpellBase";
  if (archetype === "ability") return "AbilityBase";
  if (archetype === "equipment") return "BaseAbility";
  return "";
}

/**
 * Current legacy/default play-pool mapping. A future explicit per-card
 * `playPool` mechanic can override this without changing renderer code.
 */
export function defaultResourceKindForArchetype(archetype: CardArchetype): ResourceKind {
  if (archetype === "spell") return "mana";
  if (archetype === "creature" || archetype === "ability") return "energy";
  return "resource";
}

/**
 * Produces the three printed labels used by existing cards when no custom
 * presentation labels have been authored yet.
 */
export function defaultPrintedCategories(def: CardDefinition): string[] {
  const categories = [
    humanizeCardLabel(def.rarity),
    def.faction ? humanizeCardLabel(def.faction) : "Neutral",
  ];

  if (def.archetype === "creature") {
    categories.push(def.creatureType?.[0] ? humanizeCardLabel(def.creatureType[0]) : "Creature");
  } else if (def.archetype === "hero") {
    categories.push(humanizeCardLabel(def.class));
  } else {
    categories.push(humanizeCardLabel(def.archetype));
  }

  return categories.slice(0, MAX_PRINTED_CATEGORIES);
}

export function createDefaultCardPresentation(
  archetype: CardArchetype,
  categories: string[] = [],
): CardPresentation {
  return {
    baseKey: defaultBaseForArchetype(archetype),
    resourceIcon: "",
    categories: categories.slice(0, MAX_PRINTED_CATEGORIES),
    artScale: 1,
    artX: 0,
    artY: 0,
    ...PROJECT_DEFAULT_TYPOGRAPHY,
    layout: { ...PROJECT_DEFAULT_LAYOUT },
  };
}

/**
 * Safely fills presentation data loaded from an older/local draft while
 * preserving any card-specific values it already contains.
 */
export function hydrateCardPresentation(
  raw: Partial<CardPresentation> | undefined,
  fallback: CardPresentation,
): CardPresentation {
  if (!raw) return { ...fallback, layout: { ...fallback.layout }, categories: [...fallback.categories] };

  return {
    ...fallback,
    ...raw,
    categories: raw.categories?.slice(0, MAX_PRINTED_CATEGORIES) ?? [...fallback.categories],
    layout: { ...fallback.layout, ...raw.layout },
  };
}
