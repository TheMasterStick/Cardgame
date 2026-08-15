import { beforeEach, describe, expect, it } from "vitest";
import { PACK_COST, PACK_SIZE, STARTING_COINS } from "../data/packs";
import {
  awardMatchCoins,
  canAffordPack,
  defaultCollection,
  loadCollection,
  openPack,
  ownedCount,
  saveCollection,
} from "./collection";

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("collection defaults", () => {
  it("starts with STARTING_COINS and no owned cards", () => {
    const collection = defaultCollection();
    expect(collection.coins).toBe(STARTING_COINS);
    expect(Object.keys(collection.owned)).toHaveLength(0);
  });
});

describe("pack opening", () => {
  it("deducts PACK_COST and adds PACK_SIZE cards to the collection", () => {
    const collection = defaultCollection();
    const { collection: after, cardsWon } = openPack(collection);
    expect(after.coins).toBe(STARTING_COINS - PACK_COST);
    expect(cardsWon).toHaveLength(PACK_SIZE);
    const totalOwned = Object.values(after.owned).reduce((a, b) => a + b, 0);
    expect(totalOwned).toBe(PACK_SIZE);
  });

  it("is a no-op when coins are short", () => {
    const poor = { owned: {}, coins: PACK_COST - 1 };
    expect(canAffordPack(poor)).toBe(false);
    const { collection: after, cardsWon } = openPack(poor);
    expect(after).toEqual(poor);
    expect(cardsWon).toHaveLength(0);
  });

  it("stacks duplicate pulls onto existing owned counts", () => {
    let collection = defaultCollection();
    collection = openPack(collection).collection;
    collection = openPack(collection).collection;
    for (const count of Object.values(collection.owned)) {
      expect(count).toBeGreaterThan(0);
    }
    expect(ownedCount(collection, "definitely-not-a-real-card")).toBe(0);
  });
});

describe("match coin rewards", () => {
  it("awards more coins for a win than a loss", () => {
    const base = defaultCollection();
    const win = awardMatchCoins(base, true);
    const loss = awardMatchCoins(base, false);
    expect(win.coins).toBeGreaterThan(loss.coins);
    expect(win.coins).toBeGreaterThan(base.coins);
  });
});

describe("persistence", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = makeMemoryStorage();
  });

  it("round-trips through localStorage", () => {
    const collection = openPack(defaultCollection()).collection;
    saveCollection(collection);
    expect(loadCollection()).toEqual(collection);
  });

  it("falls back to defaults on missing/corrupt storage", () => {
    localStorage.setItem("cardgame:collection:v1", "not json");
    expect(loadCollection()).toEqual(defaultCollection());
  });
});
