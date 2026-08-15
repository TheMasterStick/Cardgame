-- Distinguishes a wallet row that was auto-created by the on-signup trigger
-- (default 300 coins, empty collection, never actually synced from a
-- client) from one that's genuinely been initialized with a player's data.
-- See src/lib/remoteCollection.ts: the client imports localStorage data
-- into the account exactly once, the first time it finds initialized = false.
alter table public.wallets
  add column if not exists initialized boolean not null default false;
