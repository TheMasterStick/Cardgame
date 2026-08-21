# Documentation / Design Roadmap — Post-Review

This tracks the ten recommendations from the August documentation review and separates documentation work from engine implementation.

| # | Recommendation | Status after this pass | Next action |
|---|---|---|---|
| 1 | Reconcile DESIGN.md to Phase K | **Documentation done** | Replace canonical copy after review; engine audit optional. |
| 2 | Fix CARDS.md LLM prompt | **Documentation done** | Use revised prompt for future Claude/card generation. |
| 3 | Recast FACTIONS.md as archetype/content bible | **Documentation done** | Convert one mini-set at a time instead of bulk-porting legacy mechanics. |
| 4 | Separate Allegiance/Race/Class/CreatureType/world identity | **Documentation done** | Keep WORLD.md as lore authority; avoid making every culture an engine Faction. |
| 5 | Multi-race support | **Done (Phase L)** | `races: Race[]` live in TypeScript, validators, Supabase (`0004_multi_race.sql`), and the Admin form's checkbox multi-select. |
| 6 | Explicit Hero Class + Rogue CreatureType | **Done (Phase L)** | `class: HeroClass` required on every Hero; `rogue` CreatureType added and retagged onto `assassin`/`shadow-infiltrator`. Purely descriptive — no mechanic keys off Class yet. |
| 7 | Temporary modifier/duration primitive | **Done (Phase M)** | `buff`'s new `duration` field (`CardInstance.temporaryModifiers`), ticking symmetrically for both players at every turn end so "this turn" behaves the same for a self-buff and a hostile debuff. `battle-fury` demonstrates it. Covers straight temporary Attack/HP changes only — "until your next turn" phrasing not tied to a stat change, and look/choose/reorder or Mark/Grudge/Trap-style cards, still need their own work (see #2/#4 in the sequence below). |
| 8 | Harden baked-card/Admin workflow | **Docs flagged; implementation pending** | Safe aspect-ratio upload, full schema form coverage, mechanics-vs-art warning. |
| 9 | Create WORLD.md | **Done** | Expand only as cards establish cultures/places/races. |
| 10 | Begin non-Human/archetype mini-sets | **Done (Phase N)** | Roseguard Kingdom (FACTIONS.md §1, Human) and Wildheart Tribes (FACTIONS.md §7, Orc) converted — 10 cards each (Hero + 9 supporting), starter decks in `decks.ts`. |

## Suggested immediate sequence

1. ~~Review/approve these revised docs.~~ **Done.**
2. ~~Make the small taxonomy engine changes (#5-6).~~ **Done (Phase L).**
3. ~~Add temporary modifiers (#7).~~ **Done (Phase M).**
4. ~~Pick one Human and one non-Human archetype mini-set and convert 8-12 cards each against the current Neutral Core.~~ **Done (Phase N)** — Roseguard Kingdom + Wildheart Tribes.
5. Let those first real sets reveal which bespoke mechanics (Mark, Grudge, Trap, etc.) are actually worth implementing next — Phase N's Revenge-only Wildheart kit already surfaced one concrete gap: a Revenge/onDeath effect can't target one specific "another" creature since the trigger always resolves with a null target, only AOE or untargeted effects reach from there.
