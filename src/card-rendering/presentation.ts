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

export interface CardBaseAsset {
  label: string;
  url: string;
}

function drivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
}

/** The exact frame assets used by the Card Builder preview. */
export const CARD_BASE_ASSETS: Record<Exclude<CardBaseKey, "">, CardBaseAsset> = {
  CreatureBase: {
    label: "Creature Base",
    url: drivePreviewUrl("1VZidSY9g2urE6LzIW2szt4zVCoMB-Yhh"),
  },
  BuildingBase: {
    label: "Building Base",
    url: drivePreviewUrl("1AyqAd-q1GakrrEyuB4gTykWMEZOAgrkV"),
  },
  SpellBase: {
    label: "Spell Base",
    url: drivePreviewUrl("1dj16J2n5GUcQAgRXK0Tj8ZyznAvAde91"),
  },
  AbilityBase: {
    label: "Ability Base",
    url: drivePreviewUrl("1iPfx9VvZo9LgHnNuselSuwtt6cIbO0St"),
  },
  BaseAbility: {
    label: "BaseAbility (alternate / equipment candidate)",
    url: drivePreviewUrl("1mkUEIyk1XV4C6_XJFeHWENj1P1g5aZ7x"),
  },
};

export const LOCAL_CARD_BASE_FALLBACK = "/cardframes/NeutralCardDefault.png";

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

export interface RuntimeCardPresentation {
  art: string;
  playPool: ResourceKind;
  presentation: CardPresentation;
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
    baseKey: raw.baseKey ?? fallback.baseKey,
    resourceIcon: raw.resourceIcon ?? fallback.resourceIcon,
    categories: raw.categories?.slice(0, MAX_PRINTED_CATEGORIES) ?? [...fallback.categories],
    artScale: raw.artScale ?? fallback.artScale,
    artX: raw.artX ?? fallback.artX,
    artY: raw.artY ?? fallback.artY,
    titleFont: raw.titleFont ?? fallback.titleFont,
    bodyFont: raw.bodyFont ?? fallback.bodyFont,
    nameSize: raw.nameSize ?? fallback.nameSize,
    costSize: raw.costSize ?? fallback.costSize,
    resourceSize: raw.resourceSize ?? fallback.resourceSize,
    categorySize: raw.categorySize ?? fallback.categorySize,
    rulesSize: raw.rulesSize ?? fallback.rulesSize,
    statSize: raw.statSize ?? fallback.statSize,
    layout: { ...fallback.layout, ...raw.layout },
  };
}

function isResourceKind(value: unknown): value is ResourceKind {
  return typeof value === "string" && (RESOURCE_KINDS as readonly string[]).includes(value);
}

/**
 * Loads the presentation last saved by the Card Builder for this card.
 * Gameplay values still come from the authoritative CardDefinition; the
 * local draft only supplies artwork/frame/typography/layout presentation.
 */
export function getRuntimeCardPresentation(
  def: CardDefinition,
  storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): RuntimeCardPresentation {
  const fallback = createDefaultCardPresentation(def.archetype, defaultPrintedCategories(def));
  let raw: (Partial<CardPresentation> & { art?: unknown; playPool?: unknown }) | undefined;

  if (storage) {
    try {
      const stored = storage.getItem(`card-builder:draft:${def.id}`);
      if (stored) raw = JSON.parse(stored) as typeof raw;
    } catch {
      // Invalid or unavailable local data falls back to the canonical card.
    }
  }

  return {
    art: typeof raw?.art === "string" && raw.art ? raw.art : def.art ?? "",
    playPool: isResourceKind(raw?.playPool) ? raw.playPool : defaultResourceKindForArchetype(def.archetype),
    presentation: hydrateCardPresentation(raw, fallback),
  };
}

export function cardBaseAssetUrl(baseKey: CardBaseKey): string {
  return baseKey ? CARD_BASE_ASSETS[baseKey].url : LOCAL_CARD_BASE_FALLBACK;
}

export function resourceIconUrl(kind: ResourceKind, customIcon = ""): string {
  if (customIcon) return customIcon;
  if (kind === "energy") return "/icons/resource-energy.svg";
  if (kind === "mana") return "/icons/resource-mana.svg";
  return "/icons/resource-resources.svg";
}
