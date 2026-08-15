import { CARD_DEFINITIONS } from "../data/cards";
import { COINS_PER_LOSS, COINS_PER_WIN, PACK_COST, PACK_SIZE, RARITY_WEIGHTS, STARTING_COINS } from "../data/packs";
import type { Rarity } from "./types";

export interface Collection {
  /** defId -> number of copies owned. */
  owned: Record<string, number>;
  coins: number;
}

const STORAGE_KEY = "cardgame:collection:v1";

export function defaultCollection(): Collection {
  return { owned: {}, coins: STARTING_COINS };
}

export function loadCollection(): Collection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCollection();
    const parsed = JSON.parse(raw) as Partial<Collection>;
    if (typeof parsed.coins !== "number" || typeof parsed.owned !== "object" || !parsed.owned) {
      return defaultCollection();
    }
    return { owned: parsed.owned, coins: parsed.coins };
  } catch {
    return defaultCollection();
  }
}

export function saveCollection(collection: Collection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
  } catch {
    // localStorage unavailable (private browsing, sandboxed preview, etc.) — collection just won't persist.
  }
}

export function ownedCount(collection: Collection, defId: string): number {
  return collection.owned[defId] ?? 0;
}

export function canAffordPack(collection: Collection): boolean {
  return collection.coins >= PACK_COST;
}

function cardPoolByRarity(): Record<Rarity, string[]> {
  const pool: Record<Rarity, string[]> = { common: [], rare: [], epic: [], legendary: [] };
  for (const def of Object.values(CARD_DEFINITIONS)) {
    pool[def.rarity].push(def.id);
  }
  return pool;
}

function pickRarityWeighted(): Rarity {
  const entries = Object.entries(RARITY_WEIGHTS) as [Rarity, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of entries) {
    if (roll < weight) return rarity;
    roll -= weight;
  }
  return entries[entries.length - 1][0];
}

function pickCardId(pool: Record<Rarity, string[]>): string {
  const rarity = pickRarityWeighted();
  let options = pool[rarity];

  if (options.length === 0) {
    const fallbackOrder: Rarity[] = ["common", "rare", "epic", "legendary"];
    options = fallbackOrder.map((r) => pool[r]).find((cards) => cards.length > 0) ?? [];
  }
  if (options.length === 0) {
    options = Object.values(pool).flat();
  }
  return options[Math.floor(Math.random() * options.length)];
}

/** Opens one pack: deducts PACK_COST coins and draws PACK_SIZE cards by rarity odds. No-op (empty win list) if coins are short. */
export function openPack(collection: Collection): { collection: Collection; cardsWon: string[] } {
  if (!canAffordPack(collection)) return { collection, cardsWon: [] };

  const pool = cardPoolByRarity();
  const cardsWon = Array.from({ length: PACK_SIZE }, () => pickCardId(pool));

  const owned = { ...collection.owned };
  for (const defId of cardsWon) {
    owned[defId] = (owned[defId] ?? 0) + 1;
  }

  return { collection: { coins: collection.coins - PACK_COST, owned }, cardsWon };
}

export function awardMatchCoins(collection: Collection, won: boolean): Collection {
  return { ...collection, coins: collection.coins + (won ? COINS_PER_WIN : COINS_PER_LOSS) };
}
