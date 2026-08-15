import type { Collection } from "../engine/collection";
import { supabase } from "./supabaseClient";

interface RemoteCollection {
  collection: Collection;
  initialized: boolean;
}

export async function loadRemoteCollection(userId: string): Promise<RemoteCollection | null> {
  if (!supabase) return null;

  const [{ data: wallet, error: walletError }, { data: entries, error: entriesError }] = await Promise.all([
    supabase.from("wallets").select("coins, initialized").eq("user_id", userId).single(),
    supabase.from("collection_entries").select("card_id, count").eq("user_id", userId),
  ]);

  if (walletError || !wallet) {
    console.warn("Failed to load remote wallet:", walletError?.message);
    return null;
  }
  if (entriesError) {
    console.warn("Failed to load remote collection entries:", entriesError.message);
  }

  const owned: Record<string, number> = {};
  for (const entry of entries ?? []) owned[entry.card_id as string] = entry.count as number;

  return { collection: { coins: wallet.coins as number, owned }, initialized: wallet.initialized as boolean };
}

export async function saveRemoteCollection(userId: string, collection: Collection): Promise<void> {
  if (!supabase) return;

  const { error: walletError } = await supabase
    .from("wallets")
    .upsert({ user_id: userId, coins: collection.coins, initialized: true });
  if (walletError) console.warn("Failed to save remote wallet:", walletError.message);

  const rows = Object.entries(collection.owned).map(([card_id, count]) => ({ user_id: userId, card_id, count }));
  if (rows.length > 0) {
    const { error: entriesError } = await supabase.from("collection_entries").upsert(rows);
    if (entriesError) console.warn("Failed to save remote collection entries:", entriesError.message);
  }
}

/**
 * Loads a signed-in account's saved collection — or, the first time this
 * account is ever seen (wallets.initialized still false), imports
 * `localFallback` into it once and returns that instead. After that first
 * import, the account's own saved data always wins over whatever's sitting
 * in this browser's localStorage.
 */
export async function loadOrInitializeRemoteCollection(userId: string, localFallback: Collection): Promise<Collection> {
  const remote = await loadRemoteCollection(userId);
  if (remote?.initialized) {
    return remote.collection;
  }
  await saveRemoteCollection(userId, localFallback);
  return localFallback;
}
