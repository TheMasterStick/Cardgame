# Adding cards

There are two ways to add a card. Both produce the exact same in-game
object — pick whichever is easier for the moment.

1. **`src/data/customCards.json`** — no code, no rebuild step beyond a
   page refresh. Add an object to the array. Great for hand-authoring or
   for pasting output from an LLM. A malformed entry is skipped with a
   `console.warn` (check the browser dev console) rather than crashing
   the app.
2. **`src/data/cards.ts`** — add to the `buildings` / `creatures` /
   `spells` / `abilities` / `equipment` arrays directly. Same schema,
   plain TypeScript, so you get autocomplete and compile-time checking.
   Use this if you're already editing the codebase.

Every card needs a globally unique `id` (kebab-case by convention, e.g.
`"lava-hound"`). If a custom card's `id` collides with an existing one,
it's skipped with a warning — it never silently overwrites a built-in
card.

---

## Fields every card has

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique. Used everywhere internally — pack odds, deck lists, save data. |
| `name` | string | Display name. |
| `archetype` | `"creature" \| "building" \| "spell" \| "ability" \| "equipment"` | Which zone it's played into — see DESIGN.md §1/§3. |
| `cost` | number | Resources cost to play it from hand. |
| `rarity` | `"common" \| "rare" \| "epic" \| "legendary"` | Drives pack odds (`src/data/packs.ts`) and the corner pip color. |
| `text` | string (optional) | Flavor/rules text shown on the card. |
| `art` | string (optional) | Image URL or a path into `public/` (e.g. `"/cards/lava-hound.png"`). Omit for the plain text layout. See "Adding images" below. |

## Archetype-specific fields

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
  "keywords": ["ranged"],
  "text": "Ranged. On Play: deal 2 damage to an enemy creature.",
  "triggers": [
    { "on": "onPlay", "effect": { "kind": "damage", "amount": 2, "target": "targetCreature" } }
  ]
}
```
- `attack`, `hp`: numbers.
- `keywords`: array, only `"ranged"` and `"charge"` currently mean anything (see DESIGN.md §4/§1).
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
  "activateCost": 3,
  "charges": 2,
  "text": "Activate (3 Mana): deal 2 damage to all enemy Front Row creatures.",
  "effect": { "kind": "damage", "amount": 2, "target": "allEnemyCreatures" }
}
```
- `activateCost`: Mana (spell) or Energy (ability) cost per activation.
- `charges`: a number, or the string `"unlimited"`.
- `effect`: a single `CardEffect` (see below) — the card's one activated effect.

**Equipment** (`archetype: "equipment"`, fills the Hero's single Equipment slot):
```json
{ "id": "iron-sword", "name": "Iron Sword", "archetype": "equipment", "cost": 2, "rarity": "common",
  "attackBonus": 0, "damageReduction": 0, "text": "Your Hero can attack." }
```
- `attackBonus`: added to the Hero's base Attack once equipped.
- `damageReduction`: subtracted from all incoming damage to that player (Militia + Hero HP) while equipped.

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
| `gainMilitia` | `amount` | Grants Militia to the acting player. No `target`. |
| `gainCap` | `pool` (`"resource"\|"mana"\|"energy"`), `amount` | Raises a resource cap (and current amount) for the acting player. No `target`. |

`target` (on the four kinds that need one) is one of:
`"targetCreature"`, `"targetBuilding"`, `"targetCreatureOrBuilding"`,
`"targetAny"`, `"targetPlayer"`, `"allEnemyCreatures"`,
`"allFriendlyCreatures"`, `"selfHero"`. The first five are picked by
whoever activates the card (the UI asks for a target when needed); the
last three resolve automatically. See DESIGN.md §4/§6 for how targeting
actually plays out on the board.

`triggers` (creatures/buildings only) fire on: `"onPlay"`, `"onAttack"`,
`"onDeath"`, `"startOfTurn"`, `"endOfTurn"`.

---

## Adding images

Drop a file in `public/cards/` (or `public/heroes/` for Hero portraits,
`public/boards/` for board backgrounds) and reference it as
`"/cards/your-file.png"` in the card's `art` field — or use any
external `https://` URL directly. No `art` field means the card just
renders as plain text, which is always valid.

**One thing to know:** the standalone single-file preview you can get
published as a Claude web Artifact runs under a strict content policy
that blocks loading images from external URLs or separate files — only
`data:` URIs (an image already base64-encoded directly into the `art`
string) work there. Local dev (`npm run dev`) and a normal production
build/deploy don't have this restriction — both `public/` files and
external URLs work fine. If you want art to show up in an Artifact
preview specifically, use a `data:image/png;base64,...` string.

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
> `archetype` (one of `creature`, `building`, `spell`, `ability`,
> `equipment`), `cost` (number), `rarity` (one of `common`, `rare`,
> `epic`, `legendary`), `text` (optional flavor/rules string). Creatures
> additionally need `attack`, `hp`, `keywords` (array, only `"ranged"`
> or `"charge"` are meaningful), `triggers` (array of `{on, effect}`,
> `on` one of `onPlay`/`onAttack`/`onDeath`/`startOfTurn`/`endOfTurn`).
> Buildings need `hp` and `triggers`. Spells/abilities need
> `activateCost` (number), `charges` (number or `"unlimited"`), and a
> single `effect`. Equipment needs `attackBonus` and `damageReduction`.
> An `effect` object has a `kind` (`damage`, `heal`, `applyStatus`,
> `buff`, `drawCard`, `gainMilitia`, or `gainCap`) plus kind-specific
> fields: `damage`/`heal` need `amount` + `target`; `applyStatus` needs
> `status` (`"burn"` or `"poison"`) + `amount` + `target`; `buff` needs
> `target` + `attackDelta`/`hpDelta`; `drawCard` needs `amount`;
> `gainMilitia` needs `amount`; `gainCap` needs `pool`
> (`"resource"`/`"mana"`/`"energy"`) + `amount`. `target` is one of
> `targetCreature`, `targetBuilding`, `targetCreatureOrBuilding`,
> `targetAny`, `targetPlayer`, `allEnemyCreatures`,
> `allFriendlyCreatures`, `selfHero`.

Anything that doesn't fit the schema gets skipped at load time with a
console warning, not a crash — so it's safe to iterate.
