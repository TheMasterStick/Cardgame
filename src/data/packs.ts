import type { Rarity } from "../engine/types";

export const PACK_SIZE = 5;
export const PACK_COST = 100;
export const STARTING_COINS = 300;
export const COINS_PER_WIN = 60;
export const COINS_PER_LOSS = 25;

/** Relative odds per rarity tier for a single card slot in a pack. Must sum to any positive total — they're normalized at draw time. */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  rare: 25,
  epic: 12,
  legendary: 3,
};
