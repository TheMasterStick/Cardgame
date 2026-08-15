-- Extends the card catalog: element/faction/race columns, a "hero"
-- archetype, and an "uncommon" rarity tier. Mirrors src/engine/types.ts.

alter table public.cards
  add column if not exists element text,
  add column if not exists faction text,
  add column if not exists race text;

alter table public.cards drop constraint if exists cards_archetype_check;
alter table public.cards add constraint cards_archetype_check
  check (archetype in ('hero', 'creature', 'building', 'spell', 'ability', 'equipment'));

alter table public.cards drop constraint if exists cards_rarity_check;
alter table public.cards add constraint cards_rarity_check
  check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary'));

alter table public.cards drop constraint if exists cards_element_check;
alter table public.cards add constraint cards_element_check
  check (
    element is null or element in (
      'frost', 'fire', 'nature', 'light', 'darkness', 'arcane', 'martial', 'blood', 'infernal', 'chaos'
    )
  );

alter table public.cards drop constraint if exists cards_faction_check;
alter table public.cards add constraint cards_faction_check
  check (
    faction is null or faction in (
      'infernal-court', 'roseguard-kingdom', 'moonveil-coven', 'velvet-syndicate',
      'wildheart-tribes', 'celestial-academy', 'necropolitan', 'arcane-industries'
    )
  );

alter table public.cards drop constraint if exists cards_race_check;
alter table public.cards add constraint cards_race_check
  check (
    race is null or race in (
      'beast', 'demon', 'dragon', 'elemental', 'mech', 'human', 'undead', 'goblin', 'dwarf', 'elf',
      'pixie', 'ogre', 'giant', 'dark-elf', 'angel', 'orc', 'gnome', 'troll', 'dryad', 'fairy', 'harpy',
      'fiend', 'vampire'
    )
  );
