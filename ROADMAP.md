# Documentation / Design Roadmap — Post-Review

This tracks the ten recommendations from the August documentation review and separates documentation work from engine implementation.

| # | Recommendation | Status after this pass | Next action |
|---|---|---|---|
| 1 | Reconcile DESIGN.md to Phase K | **Documentation done** | Replace canonical copy after review; engine audit optional. |
| 2 | Fix CARDS.md LLM prompt | **Documentation done** | Use revised prompt for future Claude/card generation. |
| 3 | Recast FACTIONS.md as archetype/content bible | **Documentation done** | Convert one mini-set at a time instead of bulk-porting legacy mechanics. |
| 4 | Separate Faction/Race/Class/CreatureType/world identity | **Documentation done; Faction's own role later revised (Phase O)** | Keep WORLD.md as lore authority; avoid making every culture an engine Faction. Faction itself stopped being a deckbuilding restriction in Phase O — it's now purely a flavor/synergy tag, same standing as Race/Element. |
| 5 | Multi-race support | **Done (Phase L)** | `races: Race[]` live in TypeScript, validators, Supabase (`0004_multi_race.sql`), and the Admin form's checkbox multi-select. |
| 6 | Explicit Hero Class + Rogue CreatureType | **Done (Phase L)** | `class: HeroClass` required on every Hero; `rogue` CreatureType added and retagged onto `assassin`/`shadow-infiltrator`. Purely descriptive — no mechanic keys off Class yet. |
| 7 | Temporary modifier/duration primitive | **Done (Phase M)** | `buff`'s new `duration` field (`CardInstance.temporaryModifiers`), ticking symmetrically for both players at every turn end so "this turn" behaves the same for a self-buff and a hostile debuff. `battle-fury` demonstrates it. Covers straight temporary Attack/HP changes only — "until your next turn" phrasing not tied to a stat change, and look/choose/reorder or Mark/Grudge/Trap-style cards, still need their own work (see #2/#4 in the sequence below). |
| 8 | Harden baked-card/Admin workflow | **Docs flagged; implementation pending** | Safe aspect-ratio upload, full schema form coverage, mechanics-vs-art warning. |
| 9 | Create WORLD.md | **Done** | Expand only as cards establish cultures/places/races. |
| 10 | Begin non-Human/archetype mini-sets | **Done (Phase N); Hero/Faction relationship later revised (Phase O)** | Roseguard Kingdom (FACTIONS.md §1, Human) and Wildheart Tribes (FACTIONS.md §7, Orc) converted — 10 cards each (Hero + 9 supporting), starter decks in `decks.ts`. Both kept as-is after Phase O — their card content didn't need to change, only the (now-removed) assumption that owning Queen Maerwyn/Matron Shara was required to play their Faction. |
| 11 | Allegiance reversed to pure Faction synergy | **Done (Phase O)** | Faction no longer restricts deckbuilding at all (DESIGN.md §10, rewritten). Heroes are meant to be collectible (pack/mission/event-pulled), not a fixed roster that also gates content — a Faction's own Hero grants a bonus for fielding that Faction, never a requirement to. |
| 12 | Hero Specializations (pick 1 of 3 per match) | **Specified, not yet built (Phase P)** | Fixed Hero Power stays as-is; the single `passive` field becomes three named, flavorful Specializations chosen simultaneously/hidden at match start (opponent's Hero known, not their deck/hand/pick) and revealed before mulligan — see DESIGN.md §19 for the full spec and open questions. |

## Suggested immediate sequence

1. ~~Review/approve these revised docs.~~ **Done.**
2. ~~Make the small taxonomy engine changes (#5-6).~~ **Done (Phase L).**
3. ~~Add temporary modifiers (#7).~~ **Done (Phase M).**
4. ~~Pick one Human and one non-Human archetype mini-set and convert 8-12 cards each against the current Neutral Core.~~ **Done (Phase N)** — Roseguard Kingdom + Wildheart Tribes.
5. ~~Reverse Allegiance from a deckbuilding gate into pure Faction synergy.~~ **Done (Phase O).**
6. **Build the Hero Specialization system (Phase P)** — next up: extend `HeroCardDefinition`, add the match-start pick-1-of-3 flow (hidden/simultaneous vs. the AI, revealed before mulligan), and author three Specializations for every shipped Hero (Fighter/Mage/Rogue/Grand Marshal/Archivist/Queen Maerwyn/Matron Shara Earthsong) — not just the Faction Heroes.
7. Do not start another archetype mini-set until #6 lands and Queen Maerwyn/Matron Shara/their starter decks have been reviewed against it (explicit user direction — avoid rework from building more content under the old Hero-locks-Faction assumption).
8. Let the real sets already in place reveal which bespoke mechanics (Mark, Grudge, Trap, etc.) are actually worth implementing next — Phase N's Revenge-only Wildheart kit already surfaced one concrete gap: a Revenge/onDeath effect can't target one specific "another" creature since the trigger always resolves with a null target, only AOE or untargeted effects reach from there.
9. Treat FACTIONS.md's remaining unconverted sections as candidate material only, not pre-approved canon or a queue to work through automatically — convert further mini-sets only on explicit direction, the same way #4/#5 above were.
