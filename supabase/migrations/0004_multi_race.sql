-- Multi-race support (Phase L / ROADMAP.md #5): the engine's `race?: Race`
-- field on cards became `races?: Race[]`. The dedicated `race` column
-- existed only so the row could carry it alongside the other common
-- fields (element/faction) — every array-valued field (keywords,
-- creatureType, etc.) already lives in `data` jsonb, so `races` moves
-- there too instead of getting its own array column.

-- Fold any existing single race value into data.races as a one-element
-- array, unless a card somehow already has one (defensive; none should).
update public.cards
set data = data || jsonb_build_object('races', jsonb_build_array(race))
where race is not null and not (data ? 'races');

alter table public.cards drop constraint if exists cards_race_check;
alter table public.cards drop column if exists race;
