-- Cardgame initial schema: accounts, the shared card catalog, per-user
-- collections/wallets/decks, and the card-art storage bucket. See CARDS.md
-- for the card data model this mirrors, and DESIGN.md for the ruleset.

-- ---------------------------------------------------------------------
-- profiles: one row per auth.users row, tracks the admin flag.
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- cards: the shared card catalog. `data` holds archetype-specific fields
-- (attack/hp/keywords/triggers, or activateCost/charges/effect, or
-- attackBonus/damageReduction) as JSON — see CARDS.md for the schema.
-- Readable by everyone; writable only by admins.
-- ---------------------------------------------------------------------
create table public.cards (
  id text primary key,
  name text not null,
  archetype text not null check (archetype in ('creature', 'building', 'spell', 'ability', 'equipment')),
  cost integer not null check (cost >= 0),
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  text text,
  art text,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.cards enable row level security;

create policy "Anyone can read cards"
  on public.cards for select
  using (true);

create policy "Admins can insert cards"
  on public.cards for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Admins can update cards"
  on public.cards for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Admins can delete cards"
  on public.cards for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ---------------------------------------------------------------------
-- collection_entries: which cards a user owns, and how many copies.
-- ---------------------------------------------------------------------
create table public.collection_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null references public.cards (id) on delete cascade,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, card_id)
);

alter table public.collection_entries enable row level security;

create policy "Users manage their own collection"
  on public.collection_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- wallets: per-user coin balance (see DESIGN.md §10 for pack economy).
-- ---------------------------------------------------------------------
create table public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  coins integer not null default 300 check (coins >= 0)
);

alter table public.wallets enable row level security;

create policy "Users manage their own wallet"
  on public.wallets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create function public.handle_new_wallet()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.wallets (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_wallet
  after insert on auth.users
  for each row execute function public.handle_new_wallet();

-- ---------------------------------------------------------------------
-- decks: saved custom decks. `cards` is { defId: count }.
-- ---------------------------------------------------------------------
create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My Deck',
  hero_class text not null check (hero_class in ('fighter', 'mage', 'rogue')),
  cards jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.decks enable row level security;

create policy "Users manage their own decks"
  on public.decks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Storage: card art. Publicly readable, admin-only upload.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('card-art', 'card-art', true)
on conflict (id) do nothing;

create policy "Anyone can view card art"
  on storage.objects for select
  using (bucket_id = 'card-art');

create policy "Admins can upload card art"
  on storage.objects for insert
  with check (
    bucket_id = 'card-art'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admins can replace card art"
  on storage.objects for update
  using (
    bucket_id = 'card-art'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
