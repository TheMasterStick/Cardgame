# Card Rendering & Artwork Standard

This document is the current presentation baseline for the layered Card Builder and the future shared Phaser card renderer.

## Source geometry

- Card base: **1152 × 1728 px**
- Card aspect ratio: **2:3**
- Visible artwork opening: approximately **1005 × 1011 px**
- Recommended source artwork: **2048 × 2048 px**
- Recommended source aspect ratio: **1:1**
- Preferred source format: PNG or high-quality JPG
- Do not bake card borders, names, costs, icons, stats, rules text, or UI into new source artwork.

## Composition safe area

Keep important details inside roughly the central **82.5%** of the square source image whenever possible. Faces, hands, weapons, focal anatomy, spell effects, and other must-preserve details should not rely on the outer ~8.75% on each edge.

The Card Builder shows this safe area when hovering the artwork preview.

## Layered card structure

New cards should render from separate layers:

1. artwork
2. transparent card base/frame
3. name
4. play cost
5. play-resource icon
6. printed categories
7. rules text
8. Attack / Health / damage values where applicable
9. runtime state overlays in the battlefield

The old fully baked JPG cards remain valid transitional/reference assets but are not the target architecture for newly produced art.

## Project default presentation preset

The current approved shared baseline is:

- Display font stack: `Trajan Pro, Cinzel, Georgia, serif`
- Rules font stack: `Cinzel, Georgia, serif`
- Name size: 21
- Cost size: 31
- Resource icon size: 28
- Category size: 13
- Rules size: 12
- Stat size: 29

Element translation offsets in the Card Builder:

- Name: X 7 / Y 18
- Cost: X -27 / Y -8
- Resource icon: X -17 / Y -7
- Categories: X 0 / Y 58
- Rules text: X 0 / Y 18
- Attack: X 4 / Y 22
- Health / Spell damage: X -6 / Y 22

Name and rules font sizes remain card-specific adjustments when necessary.

## Printed categories

Cards support **1–5 presentation categories**. Three is the normal baseline.

Examples:

- `Common • Neutral • Ranger`
- `Rare • Skaldjborn • Human • Fighter`
- `Epic • Lorthaine • Human • Duelist • Veteran`

Printed categories are presentation metadata. They do not automatically create or alter engine taxonomy.

## Play resource

Card archetype and play resource are conceptually separate. Standard defaults remain:

- Creature → Energy
- Ability → Energy
- Spell → Mana
- Building → Resources
- Equipment → Resources

The layered Card Builder already allows choosing Energy, Mana, or Resources independently so future designs such as Mana-summoned creatures can be represented. The engine-side optional per-card play-pool override should preserve these defaults for all existing cards.

## Asset handling

The legacy Admin uploader still uses the older 512 × 776 baked-card normalization path. Do not use that path as the canonical preparation step for new layered raw artwork.

A separate square-art preparation/upload path now exists for the Card Builder and normalizes new raw art to **2048 × 2048**.

## Rendering principle

The Card Builder and battlefield should ultimately use one shared card-presentation model and one shared geometry definition. Phaser should render gameplay state from the real engine; card presentation should not encode or decide game legality.

## Runtime integration status

As of 2026-08-25 on `chatgpt/phaser-battlefield`, the Card Builder, normal
React match UI, and Phaser battlefield consume the same saved per-card
presentation data (`card-builder:draft:<card-id>`): artwork path and crop,
frame selection, typography, printed categories, resource icon, and layer
offsets. Engine `CardDefinition` values remain authoritative for name, cost,
rules text, and base stats; runtime Attack/Health/status/charge changes are
rendered over that presentation rather than written back into Builder data.

Cards in hand are preflighted by the engine before interaction. Playable
cards remain bright and highlighted; unplayable cards are dimmed, show their
cost/resource in red, and expose the precise resource or zone-capacity reason.
Targeted On Play creatures use two distinct UI stages: choose the exact
Vanguard/Support slot first, then choose the effect target. The selected slot
is carried into the final engine action and never falls back to Vanguard slot
1. Row-targeted On Play effects use the same placement-first sequence.
