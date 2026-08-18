# Adding cards

There are three ways to add a card. All three produce the exact same
in-game object — pick whichever is easier for the moment.

1. **Admin Panel** (if you have a backend configured and your account
   is flagged admin — see BACKEND.md §4/§6) — a form in the browser:
   fill in fields, upload art (auto-resized, see "Adding images"
   below), save. No file editing, no rebuild, works from any device.
2. **`src/data/customCards.json`** — no code, no rebuild step beyond a
   page refresh. Add an object to the array. Great for hand-authoring or
   for pasting output from an LLM. A malformed entry is skipped with a
   `console.warn` (check the browser dev console) rather than crashing
   the app.
3. **`src/data/cards.ts`** — add to the `heroes` / `buildings` /
   `creatures` / `spells` / `abilities` / `equipment` arrays directly.
   Same schema, plain TypeScript, so you get autocomplete and
   compile-time checking. Use this if you're already editing the
   codebase.

Every card needs a globally unique `id` (kebab-case by convention, e.g.
`"lava-hound"`). For the JSON/TypeScript paths, if a custom card's `id`
collides with an existing one, it's skipped with a warning — it never
silently overwrites a built-in card. The Admin Panel is the one
exception: saving a card there always overwrites whatever has that
`id`, built-in or not, since that's how you edit an existing card from
the panel.

---

## Fields every card has

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique. Used everywhere internally — pack odds, deck lists, save data. |
| `name` | string | Display name. |
| `archetype` | `"hero" \| "creature" \| "building" \| "spell" \| "ability" \| "equipment"` | Which zone it's played into — see DESIGN.md §1/§4. |
| `cost` | number | Cost to play it from hand, paid from the pool its archetype uses: **Energy** for Creature/Ability, **Mana** for Spell, **Resources** for Building/Equipment (DESIGN.md §2). Unused (0) for Hero cards. |
| `rarity` | `"common" \| "uncommon" \| "rare" \| "epic" \| "legendary"` | Drives pack odds (`src/data/packs.ts`) and the corner pip color. |
| `text` | string (optional) | Flavor/rules text shown on the card. |
| `art` | string (optional) | Image URL or a path into `public/` (e.g. `"/cards/lava-hound.png"`). Omit for the plain text layout. See "Adding images" below. |
| `element` | string (optional) | Magic school/affinity — see "Elements" below. Purely descriptive/flavor unless a card's own effect cares about it. |
| `faction` | string (optional) | Faction allegiance — see "Factions" below. Purely descriptive/organizational, no mechanical effect. |
| `race` | string (optional) | Character race/type — see "Races" below. Only meaningful on Creature and Hero cards; mechanically inert unless a card's own effect keys off it. |

## Archetype-specific fields

**Hero** (`archetype: "hero"`) — the card a player picks at the start
of a match; its stats become the starting Hero HP/Attack (see DESIGN.md
§6):
```json
{ "id": "fighter", "name": "Fighter", "archetype": "hero", "cost": 0, "rarity": "common",
  "attack": 10, "hp": 20, "race": "human", "text": "A frontline warrior." }
```
- `attack`, `hp`: the Hero's base stats for the match (before Equipment).
- Any string id works as long as it's referenced by a key in
  `STARTER_DECKS` (`src/data/decks.ts`) if you want it selectable from
  Quick Play with a ready-made deck.

**Creature** (`archetype: "creature"`)
```json
{
  "id": "lava-hound",
  "name": "Lava Hound",
  "archetype": "creature",
  "cost": 4,
  "rarity": "rare",
  "attack": 3,
  "hp": 5,
  "element": "fire",
  "race": "dragon",
  "keywords": ["ranged"],
  "text": "Ranged. On Play: deal 2 damage to an enemy creature.",
  "triggers": [
    { "on": "onPlay", "effect": { "kind": "damage", "amount": 2, "target": "targetCreature" } }
  ]
}
```
- `attack`, `hp`: numbers.
- `keywords`: array — see "Keywords" below for the full list and what
  each one does.
- `triggers`: array of `{ "on": TriggerName, "effect": CardEffect }` — see below. Omit or use `[]` for a vanilla creature.

**Building** (`archetype: "building"`) — same as Creature minus `attack`/`keywords`:
```json
{ "id": "silver-mine", "name": "Silver Mine", "archetype": "building", "cost": 2, "rarity": "common",
  "hp": 3, "triggers": [{ "on": "onPlay", "effect": { "kind": "gainCap", "pool": "resource", "amount": 1 } }] }
```

**Spell** (`archetype: "spell"`, costs Mana to activate) / **Ability** (`archetype: "ability"`, costs Energy):
```json
{
  "id": "chain-lightning",
  "name": "Chain Lightning",
  "archetype": "spell",
  "cost": 3,
  "rarity": "epic",
  "element": "arcane",
  "activateCost": 3,
  "charges": 2,
  "text": "Activate (3 Mana): deal 2 damage to all enemy creatures.",
  "effect": { "kind": "damage", "amount": 2, "target": "allEnemyCreatures" }
}
```
- `activateCost`: Mana (spell) or Energy (ability) cost per activation.
- `charges`: a number, or the string `"unlimited"`.
- `effect`: a single `CardEffect` (see below) — the card's one activated effect.
- A creature with the **Immune** keyword blocks Spell-archetype
  activations that target it (see "Keywords" below) — Ability
  activations and creature/building triggers are unaffected.

**Equipment** (`archetype: "equipment"`, fills the Hero's single Equipment slot):
```json
{ "id": "iron-sword", "name": "Iron Sword", "archetype": "equipment", "cost": 2, "rarity": "common",
  "attackBonus": 0, "damageReduction": 0, "text": "Your Hero can attack." }
```
- `attackBonus`: added to the Hero's base Attack once equipped.
- `damageReduction`: subtracted from all incoming damage to that player (Guard + Hero HP) while equipped.

---

## Keywords

Only meaningful on Creature cards (`keywords: Keyword[]`). See DESIGN.md
§7 for the full mechanics writeup; short version:

| Keyword | Effect |
|---|---|
| `ranged` | Lets a creature attack from Support (the only way a Support creature can attack at all), and can strike enemy Support creatures directly even while the enemy Vanguard is populated. Also fires from outside melee range: a Ranged attacker never takes retaliation damage, no matter what it attacks. This is attacker-only — a Ranged creature that gets attacked still trades damage back normally. |
| `reach` | Same enemy-Support-targeting reach as Ranged, but doesn't grant attacking from Support — a Reach creature must still be in Vanguard to attack at all. |
| `infiltrate` | Can strike enemy Buildings directly regardless of the enemy board's row state, and is the one thing that lets an attacker bypass a Taunt creature to hit the Hero. Doesn't grant Support-row targeting by itself — pair with Reach/Ranged on the same card for that. |
| `charge` | Can attack the same turn it's played, ignoring summoning sickness. |
| `battlecry` | Marks a card whose `onPlay` trigger represents a Battlecry effect (fires when played). Purely a label — the actual effect still comes from a `triggers: [{ on: "onPlay", ... }]` entry. |
| `taunt` | While alive, forces enemy attackers to target it first among the creatures in whichever row is actually being attacked — a Vanguard Taunt gates Vanguard-tier attacks, a Support Taunt gates Support-tier attacks (reachable only via Reach/Ranged) the same way. Also gates Hero-targeting for any attacker that can reach the row it's in (a Vanguard Taunt blocks everyone, a Support Taunt only blocks Reach/Ranged attackers) — bypassed only by Infiltrate. Doesn't affect Building targeting. |
| `counter` | Marks a card whose `onDefend` trigger fires when it's attacked (pair with a `triggers: [{ on: "onDefend", ... }]` entry, e.g. reflect damage back at the attacker). |
| `revenge` | Marks a card whose `onDeath` trigger fires when it dies (pair with a `triggers: [{ on: "onDeath", ... }]` entry). |
| `frenzy` | Every time this creature takes damage and survives, its Attack permanently increases by the damage amount taken. Built into the engine — no trigger needed, just the keyword. |
| `immune` | Blocks Spell-archetype activated effects from targeting this creature (see Spell note above). Does not block Ability effects or other creatures' triggers. |
| `poison` | When this creature attacks, it applies a Poison damage-over-time status to whatever it hit, in addition to its normal combat damage. Built into the engine — no trigger needed, just the keyword. |
| `protector` | When an attack targets an allied creature in the same row, the engine may automatically redirect it onto this creature instead — a heuristic stand-in for the "defender's manual choice" DESIGN.md §5 describes; it only fires when the original target would otherwise die to the hit. No `triggers` entry needed. |
| `flank` | Pair with `flankBonus: { attackDelta: N }` on the card. Grants +N Attack while this creature occupies column 1 or 5 (0-indexed 0 or 4) of its row — live, re-evaluated on every Attack read, not a stored delta. |
| `formation` | Pair with `formationBonus: { attackDelta: N }`. Grants +N Attack while an allied creature occupies an adjacent column, same row — also live. |
| `advance` | Lets a Support creature spend 1 Energy to move into the same-column Vanguard slot instead of attacking (`declareAdvance` in `combat.ts`). Uses the same Ready/summoning-sickness gate as attacking, and exhausts the creature the same way. No `triggers` entry needed — it's a player action, not a trigger. |
| `push` | When this creature's attack damages an enemy Vanguard creature and it survives, and that column's Support slot is empty, the defender gets moved there automatically. Doesn't apply to Massive defenders (they don't fit in one Support slot). No `triggers` entry needed. |

`battlecry`, `counter`, and `revenge` are labels that pair with a
matching `triggers` entry (`onPlay`, `onDefend`, `onDeath`
respectively) — the keyword itself doesn't do anything without the
trigger. `taunt`, `frenzy`, `immune`, `poison`, `protector`, and `push`
are fully handled by the engine from the keyword alone. `ranged`,
`reach`, `infiltrate`, and `charge` are also engine-handled, no trigger
needed. `flank`/`formation` need their matching `flankBonus`/
`formationBonus` field to actually do anything. `advance` is invoked as
a player action (`declareAdvance`), not through a trigger or effect.

**Massive creatures** (`spaceCost: N` on a `CreatureDefinition`, no
keyword needed — it's a numeric field since it needs a magnitude, per
DESIGN.md §5) occupy `N` contiguous same-row slots instead of the
default 1. The engine stores the same `CardInstance` object in every
slot it occupies — damage/buffs/status mutate the one shared instance
regardless of which slot is looked up, and death/AOE-effect code
already dedupes by `instanceId` so a Massive creature isn't hit twice.
`playCardFromHand` fails if there isn't `N` contiguous open slots in
the target row. A Massive creature protects every Building column it
spans (DESIGN.md §11).

**Reach-tier targeting chain** (full writeup: DESIGN.md §5): Base (no
reach keyword) can only target enemy Vanguard, subject to Taunt; Reach
and Ranged can also target enemy Support directly, subject to Support's
own Taunt; Infiltrate can hit enemy Buildings regardless of row state.
**The enemy Hero has no board-population gate at all** — every
attacker can always target it directly, the same as any other card —
the only thing that narrows this is a reachable Taunt creature (a
Vanguard Taunt blocks every attacker, a Support Taunt only blocks
Reach/Ranged attackers), and Infiltrate bypasses even that. Buildings
use **column** protection instead: a Building is attackable once
**both** rows in its own column are empty, or the attacker has
Infiltrate, independent of what's happening in other columns
(DESIGN.md §11).

**A target-restricted effect with no legal target still lets the card
play/activate** — it just fizzles (does nothing) rather than making the
card unplayable. E.g. Apprentice Mage's "On Play: deal 1 damage to an
enemy creature" (`target: "targetCreature"`) is still playable with an
empty enemy board; the Warcry just whiffs and the creature still enters
play. This applies to any effect whose `target` category is
`targetCreature`, `targetBuilding`, or `targetCreatureOrBuilding` with
nothing on the relevant side of the board to hit — `targetPlayer` and
`targetAny` effects never hit this case since the Hero is always a
legal target. See `effectHasLegalTarget` in `src/ui/targeting.ts`.

**Creature row placement:** `playCardFromHand` (see `game.ts`) takes
an optional `row: "vanguard" | "support"` in its options, defaulting
to `"vanguard"`. Any creature can be played into either row — only
attacking from Support requires Ranged.

## Elements

Purely a descriptive/flavor tag (magic school or affinity) unless a
specific card's own trigger or effect chooses to reference it — the
engine doesn't attach any behavior to an element by itself. Valid
values: `frost`, `fire`, `nature`, `light`, `darkness`, `arcane`,
`martial`, `blood`, `infernal`, `chaos`.

## Factions

Purely organizational — a faction allegiance label with no mechanical
effect. Valid values: `infernal-court`, `roseguard-kingdom`,
`moonveil-coven`, `velvet-syndicate`, `wildheart-tribes`,
`celestial-academy`, `necropolitan`, `arcane-industries`. Display names
(e.g. "The Infernal Court") live in `src/data/taxonomy.ts`.

## Races

A character-type tag for Creature and Hero cards, mechanically inert
unless a specific card's effect keys off it. Valid values: `beast`,
`demon`, `dragon`, `elemental`, `mech`, `human`, `undead`, `goblin`,
`dwarf`, `elf`, `pixie`, `ogre`, `giant`, `dark-elf`, `angel`, `orc`,
`gnome`, `troll`, `dryad`, `fairy`, `harpy`, `fiend`, `vampire`.

---

## Effects (`CardEffect`)

Used in a spell/ability's `effect` field, and in any creature/building
`trigger`'s `effect` field. `kind` selects the shape:

| `kind` | Extra fields | What it does |
|---|---|---|
| `damage` | `amount`, `target` | Deals damage. |
| `heal` | `amount`, `target` | Restores HP. |
| `applyStatus` | `status` (`"burn"\|"poison"`), `amount`, `target`, `duration` (optional, burn only) | Applies a DOT. |
| `buff` | `target`, `attackDelta`? , `hpDelta`? | Permanent stat change (negative deltas work too — a debuff). |
| `drawCard` | `amount` | Draws for the acting player. No `target`. |
| `gainGuard` | `amount` | Grants Guard to the acting player. No `target`. |
| `gainCap` | `pool` (`"resource"\|"mana"\|"energy"`), `amount` | Raises a resource cap (and current amount) for the acting player. No `target`. |

`target` (on the four kinds that need one) is one of:
`"targetCreature"`, `"targetBuilding"`, `"targetCreatureOrBuilding"`,
`"targetAny"`, `"targetPlayer"`, `"allEnemyCreatures"`,
`"allFriendlyCreatures"`, `"selfHero"`. The first five are picked by
whoever activates the card (the UI asks for a target when needed); the
last three resolve automatically. See DESIGN.md §4/§6 for how targeting
actually plays out on the board — including how Taunt creatures can
force a different target than the one picked.

`triggers` (creatures/buildings only) fire on: `"onPlay"`, `"onAttack"`,
`"onDeath"`, `"onDefend"` (fires on the defending creature, pairs with
Counter), `"startOfTurn"`, `"endOfTurn"`.

---

## Adding images

**Card art (Creature/Hero/Building/Spell/Ability/Equipment):** every
card image is normalized to **512×776** — a portrait card-art aspect
ratio — regardless of the source image's original size or shape.

- **Admin Panel:** pick any image file; it's automatically resized
  (cover-fit crop, not stretched — think "object-fit: cover") to
  512×776 in the browser before upload, then stored in the `card-art`
  Supabase Storage bucket and its public URL is saved as the card's
  `art` field. You never have to pre-crop anything yourself.
- **JSON/TypeScript paths:** drop a pre-sized file in `public/cards/`
  (or `public/heroes/` for Hero portraits, `public/boards/` for board
  backgrounds) and reference it as `"/cards/your-file.png"` in the
  card's `art` field — or use any external `https://` URL directly. No
  `art` field means the card just renders as plain text, which is
  always valid. These two paths don't auto-resize for you, so aim for
  a 512×776 (or same-ratio) source image if you want it to match the
  Admin-Panel-uploaded cards exactly; slightly-off ratios still render
  fine, just cropped by the CSS instead of pre-cropped.

**One thing to know about the standalone Artifact preview:** the
single-file preview you can get published as a Claude web Artifact runs
under a strict content policy that blocks loading images from external
URLs, separate files, or Supabase Storage — only `data:` URIs (an image
already base64-encoded directly into the `art` string) work there.
Local dev (`npm run dev`) and a normal production build/deploy don't
have this restriction — `public/` files, external URLs, and Supabase
Storage URLs (from the Admin Panel) all work fine there. If you want art
to show up in an Artifact preview specifically, use a
`data:image/png;base64,...` string.

## Board backgrounds & theming

Edit `src/data/theme.ts` — three fields (`appBackground`,
`opponentBoardBackground`, `playerBoardBackground`), each an image path
or URL, or `""` for the plain dark background. No other code involved.

---

## Generating cards with an LLM

Paste this (plus a short description of what you want) to any LLM, and
drop its JSON output straight into the array in
`src/data/customCards.json`:

> Generate cards for a browser card game as a JSON array. Each object
> must match this schema: `id` (unique kebab-case string), `name`,
> `archetype` (one of `hero`, `creature`, `building`, `spell`,
> `ability`, `equipment`), `cost` (number, 0 for hero), `rarity` (one of
> `common`, `uncommon`, `rare`, `epic`, `legendary`), `text` (optional
> flavor/rules string), `element` (optional, one of `frost`, `fire`,
> `nature`, `light`, `darkness`, `arcane`, `martial`, `blood`,
> `infernal`, `chaos`), `faction` (optional, one of `infernal-court`,
> `roseguard-kingdom`, `moonveil-coven`, `velvet-syndicate`,
> `wildheart-tribes`, `celestial-academy`, `necropolitan`,
> `arcane-industries`), `race` (optional, one of `beast`, `demon`,
> `dragon`, `elemental`, `mech`, `human`, `undead`, `goblin`, `dwarf`,
> `elf`, `pixie`, `ogre`, `giant`, `dark-elf`, `angel`, `orc`, `gnome`,
> `troll`, `dryad`, `fairy`, `harpy`, `fiend`, `vampire` — only
> meaningful on `hero`/`creature`). Hero cards additionally need
> `attack`, `hp`. Creatures additionally need `attack`, `hp`,
> `keywords` (array, any of `ranged`, `reach`, `infiltrate`, `charge`,
> `battlecry`, `taunt`, `counter`, `revenge`, `frenzy`, `immune`,
> `poison`, `protector`, `flank`, `formation`, `advance`, `push`),
> `triggers` (array of `{on, effect}`, `on` one of
> `onPlay`/`onAttack`/`onDeath`/`onDefend`/`startOfTurn`/`endOfTurn`).
> Creatures can optionally add `spaceCost` (number, Massive — default
> 1), `flankBonus`/`formationBonus` (`{ attackDelta: number }`, paired
> with the `flank`/`formation` keywords).
> Buildings need `hp` and `triggers`. Spells/abilities need
> `activateCost` (number), `charges` (number or `"unlimited"`), and a
> single `effect`. Equipment needs `attackBonus` and `damageReduction`.
> An `effect` object has a `kind` (`damage`, `heal`, `applyStatus`,
> `buff`, `drawCard`, `gainGuard`, or `gainCap`) plus kind-specific
> fields: `damage`/`heal` need `amount` + `target`; `applyStatus` needs
> `status` (`"burn"` or `"poison"`) + `amount` + `target`; `buff` needs
> `target` + `attackDelta`/`hpDelta`; `drawCard` needs `amount`;
> `gainGuard` needs `amount`; `gainCap` needs `pool`
> (`"resource"`/`"mana"`/`"energy"`) + `amount`. `target` is one of
> `targetCreature`, `targetBuilding`, `targetCreatureOrBuilding`,
> `targetAny`, `targetPlayer`, `allEnemyCreatures`,
> `allFriendlyCreatures`, `selfHero`.

Anything that doesn't fit the schema gets skipped at load time with a
console warning, not a crash — so it's safe to iterate.
