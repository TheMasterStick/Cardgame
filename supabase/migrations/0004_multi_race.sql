-- Multi-race support (Phase L / ROADMAP.md #5): the engine's `race?: Race`
-- field on cards became `races?: Race[]`. The dedicated `race` column
-- existed only so the row could carry it alongside the other common
-- fields (element/faction) — every array-valued field (keywords,
-- creatureType, etc.) already lives in `data` jsonb, so `races` moves
-- there too instead of getting its own array column.

-- Fold any existing single race value into data.races as a one-element
-- array, unless a card somehow already has one (defensive; none should).
-- Guarded by a column-existence check rather than assuming 0003 already
-- ran on this database — a bare `where race is not null` fails outright
-- (42703) if the race column was never added in the first place.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cards' and column_name = 'race'
  ) then
    update public.cards
    set data = data || jsonb_build_object('races', jsonb_build_array(race))
    where race is not null and not (data ? 'races');
  end if;
end $$;

alter table public.cards drop constraint if exists cards_race_check;
alter table public.cards drop column if exists race;
