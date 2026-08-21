# Documentation / Design Roadmap — Post-Review

This tracks the ten recommendations from the August documentation review and separates documentation work from engine implementation.

| # | Recommendation | Status after this pass | Next action |
|---|---|---|---|
| 1 | Reconcile DESIGN.md to Phase K | **Documentation done** | Replace canonical copy after review; engine audit optional. |
| 2 | Fix CARDS.md LLM prompt | **Documentation done** | Use revised prompt for future Claude/card generation. |
| 3 | Recast FACTIONS.md as archetype/content bible | **Documentation done** | Convert one mini-set at a time instead of bulk-porting legacy mechanics. |
| 4 | Separate Allegiance/Race/Class/CreatureType/world identity | **Documentation done** | Keep WORLD.md as lore authority; avoid making every culture an engine Faction. |
| 5 | Multi-race support | **Planned engine/schema change** | Migrate TypeScript validators, Supabase card taxonomy and Admin form before dual-race content becomes common. |
| 6 | Explicit Hero Class + Rogue CreatureType | **Planned engine/schema change** | Add Hero `class: fighter|mage|rogue`; add `rogue` CreatureType; review Assassin/Shadow Infiltrator and future cards. |
| 7 | Temporary modifier/duration primitive | **Highest-priority new engine primitive** | Design one generic effect model for “this turn/until next turn/N turns”, then convert faction cards that depend on it. |
| 8 | Harden baked-card/Admin workflow | **Docs flagged; implementation pending** | Safe aspect-ratio upload, full schema form coverage, mechanics-vs-art warning. |
| 9 | Create WORLD.md | **Done** | Expand only as cards establish cultures/places/races. |
| 10 | Begin non-Human/archetype mini-sets | **Next content phase** | Use Neutral Core as balance baseline; author small representative sets rather than all 19 at once. |

## Suggested immediate sequence

1. Review/approve these revised docs.
2. Make the small taxonomy engine changes (#5-6).
3. Add temporary modifiers (#7).
4. Pick one Human and one non-Human archetype mini-set and convert 8-12 cards each against the current Neutral Core.
5. Let those first real sets reveal which bespoke mechanics (Mark, Grudge, Trap, etc.) are actually worth implementing next.
