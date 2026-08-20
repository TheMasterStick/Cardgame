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
| `faction` | string (optional) | Faction allegiance — see "Factions" below. Drives Allegiance deckbuilding validation on Hero cards; otherwise descriptive unless a card's own effect keys off it. |
| `race` | string (optional) | Character race/type — see "Races" below. Only meaningful on Creature and Hero cards; mechanically inert unless a card's own effect keys off it. |

## Archetype-specific fields

**Hero** (`archetype: "hero"`) — the card a player picks at the start
of a match; its stats become the starting Hero HP/Attack (see DESIGN.md
§9):
```json
{
  "id": "mage", "name": "Mage", "archetype": "hero", "cost": 0, "rarity": "common",
  "attack": 20, "hp": 10, "faction": "moonveil-coven", "text": "A supernatural manipulator.",
  "passive": { "kind": "firstSpellDiscount", "amount": 1 },
  "heroPower": { "effect": { "kind": "damage", "amount": 2, "target": "targetAny" }, "activateCost": 2, "text": "Deal 2 damage." },
  "signature": { "effect": { "kind": "damage", "amount": 3, "target": "allEnemyCreatures" }, "activateCost": 4, "usesPerMatch": 1, "text": "Deal 3 damage to all enemy creatures." },
  "allegiance": { "extraFactions": ["arcane-industries"] }
}
```
- `attack`, `hp`: the Hero's base stats for the match (before Equipment).
  Attack only matters once Equipment is assigned — a new Hero's base
  Attack should be low/0, since the Weapon's `attackBonus` is meant to
  carry it (the three starter Heroes predate this convention and are a
  documented exception — see DESIGN.md §9).
- `passive` *(optional)*: an always-on `PassiveEffect`, from a small
  curated template set (see DESIGN.md §9) — currently:
  - `{ "kind": "auraBuff", "filter": "all" | { "race": Race } | { "faction": Faction }, "attackDelta": N }` — live +N Attack to every matching friendly creature, recomputed on every Attack read (same "Attack only, never stored" approach as Flank/Formation).
  - `{ "kind": "firstSpellDiscount", "amount": N }` — the controller's first Spell *activation* each turn (an Instant cast, or a Ritual/Charged Spell's `activateCost` step — not a Ritual/Charged Spell's initial slot-placement `cost`) costs N less Mana. Resets every `startTurn`.
- `heroPower` *(optional)*: `{ "effect": CardEffect, "activateCost": N, "text"?: string }` — Energy-costed, usable once per turn (resets every `startTurn`), same `CardEffect` shape and `resolveEffect` machinery as a Spell/Ability.
- `signature` *(optional)*: same shape as `heroPower` plus `"usesPerMatch": N` — gated to N total uses for the whole match, never resets on `startTurn`.
- `allegiance` *(optional)*: bends Allegiance deckbuilding (DESIGN.md §10) beyond the default "Hero's own Faction + Neutral cards only" rule:
  - `extraFactions: Faction[]` — additional Factions allowed alongside the Hero's own.
  - `neutralRaces: Race[]` — creatures of a listed Race count as in-Faction regardless of their own Faction tag.
  - `unrestricted: true` — no Faction restriction at all, despite the Hero having a Faction.
- `ruleBreaks` *(optional, Legendary-tier — DESIGN.md §9)*: a curated
  menu of numeric deltas applied once at match start —
  `extraSpellAbilitySlots`, `extraBuildingSlots`, `vanguardSlotDelta`,
  `supportSlotDelta`, `startingGuardDelta`, `resourceCapDelta`,
  `manaCapDelta`, `energyCapDelta` (all optional numbers; omit any you
  don't need). See `grand-marshal` (`{ "vanguardSlotDelta": 1,
  "supportSlotDelta": 1 }`, a wider battlefront).
- Any string id works as long as it's referenced by a key in
  `STARTER_DECKS` (`src/data/decks.ts`) if you want it selectable from
  Quick Play with a ready-made deck — a Hero without one is still
  selectable in the Deck Builder for a custom deck.

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

**Building** (`archetype: "building"`) — same as Creature minus `attack`/`keywords`, plus two optional fields for its battlefield-object behavior (DESIGN.md §11):
```json
{ "id": "silver-mine", "name": "Silver Mine", "archetype": "building", "cost": 2, "rarity": "common",
  "hp": 3, "triggers": [{ "on": "onPlay", "effect": { "kind": "gainCap", "pool": "resource", "amount": 1 } }] }
```
- `passive` *(optional)*: an aura — only the `auraBuff` template is
  accepted for a Building (not the full Hero `PassiveEffect` union;
  `firstSpellDiscount` has no defined stacking model for a second
  source yet, so it's rejected). `filter` is `"all"`, `{ "race": ... }`,
  or `{ "faction": ... }`; `attackDelta` is added to the Attack of every
  matching **friendly** creature, live and continuously re-evaluated
  (like Flank/Formation), not a one-time buff.
  ```json
  { "id": "beast-den", "name": "Beast Den", "archetype": "building", "cost": 3, "rarity": "rare",
    "hp": 5, "race": "beast", "text": "Passive: your Beast creatures have +2 Attack.",
    "passive": { "kind": "auraBuff", "filter": { "race": "beast" }, "attackDelta": 2 } }
  ```
- `ability` *(optional)*: an activated ability — `{ "effect": CardEffect, "activateCost": number, "pool": "resource" | "mana" | "energy" }`.
  `pool` defaults to `"resource"` (Resources) when omitted, per §11; a
  specific card can spend Mana or Energy instead, like Demon Gate here.
  Unlike a Spell/Ability card, there's **no `charges` field and no cap**
  — a Building's ability stays activatable every turn for as long as
  its owner can pay `activateCost`.
  ```json
  { "id": "demon-gate", "name": "Demon Gate", "archetype": "building", "cost": 4, "rarity": "epic",
    "hp": 6, "race": "demon", "text": "Activate (3 Mana): summon a Flame Imp.",
    "ability": { "effect": { "kind": "summonCreature", "creatureId": "flame-imp" }, "activateCost": 3, "pool": "mana" } }
  ```
- `triggers`: same On Construction / onAttack / onDeath / startOfTurn /
  endOfTurn triggers a Creature can have. A Building only ever uses
  `triggers` OR `ability` in practice — nothing stops both being
  present, but no example card combines them.

**Spell** (`archetype: "spell"`, costs Mana) / **Ability** (`archetype: "ability"`, costs Energy):

A Spell also needs a `spellForm` (DESIGN.md §1a) — Abilities don't;
they're always the Ritual/Charged shape, Energy instead of Mana.

- **Instant** — cast straight from hand for `cost` Mana, resolves
  immediately, never touches a Spell/Ability slot. No `activateCost`/
  `charges`.
  ```json
  {
    "id": "fireball", "name": "Fireball", "archetype": "spell", "spellForm": "instant",
    "cost": 4, "rarity": "rare",
    "text": "Deal 4 damage to a creature, a building, or the enemy Hero.",
    "effect": { "kind": "damage", "amount": 4, "target": "targetAny" }
  }
  ```
- **Ritual** — pay `cost` to place it in a Spell/Ability slot, then pay
  `activateCost` per activation; `charges` is normally `"unlimited"`
  and it's voluntarily discarded when done with it.
- **Charged** — same slot placement, but `charges` is a fixed number;
  it's discarded automatically once activations run it out.
  ```json
  {
    "id": "chain-lightning", "name": "Chain Lightning", "archetype": "spell", "spellForm": "charged",
    "cost": 3, "rarity": "epic", "element": "arcane",
    "activateCost": 3, "charges": 2,
    "text": "Activate (3 Mana): deal 2 damage to all enemy creatures.",
    "effect": { "kind": "damage", "amount": 2, "target": "allEnemyCreatures" }
  }
  ```
- `activateCost`: Mana (spell) or Energy (ability) cost per activation — omit only for an Instant Spell.
- `charges`: a number, or the string `"unlimited"` — omit only for an Instant Spell.
- `effect`: a single `CardEffect` (see below) — the card's one activated effect.
- A creature with the **Immune** keyword blocks Spell-archetype
  activations that target it (see "Keywords" below) — Ability
  activations and creature/building triggers are unaffected.
- An Instant cast, or a Ritual/Charged card that fizzles out of
  charges, goes to `discard` — not the `graveyard`, which is reserved
  for creature/building deaths (see DESIGN.md §17's Phase C
  implementation-status note for why).

**Equipment** (`archetype: "equipment"`, plays into a 4-slot player-owned zone — DESIGN.md §12):
```json
{ "id": "iron-sword", "name": "Iron Sword", "archetype": "equipment", "cost": 2, "rarity": "common",
  "category": "weapon", "attackBonus": 0, "damageReduction": 0, "text": "Weapon. Assign to your Hero so it can attack." }
```
- `category`: one of `"weapon"`, `"armor"`, `"accessory"`, `"mount"` — required. Only a
  `"weapon"` item, once assigned to the Hero, lets the Hero attack at all; the other three
  categories are expected to mostly grant `damageReduction` or utility rather than
  `attackBonus`, though that split isn't engine-enforced.
- `attackBonus`: added to the bearer's Attack once equipped — the Hero's base Attack, or an
  Armiger creature's effective Attack (§7's `armiger` keyword — a plain creature can't hold
  Equipment at all without it).
- `damageReduction`: subtracted from all damage the bearer takes while equipped.
- A card played from hand always enters the zone **Unassigned**. Assigning it to a bearer (the
  Hero, or an on-board Armiger creature) — first assignment or later reassignment alike — is a
  separate action costing 1 Energy; each bearer holds at most 1 item, and assigning a second
  item to an already-equipped bearer bumps the old one back to Unassigned rather than being
  refused. A bearer's Equipment survives its death, returning to Unassigned instead of being
  destroyed.

---

## Keywords

Only meaningful on Creature cards (`keywords: Keyword[]`). See DESIGN.md
§7 for the full mechanics writeup; short version:

| Keyword | Effect |
|---|---|
| `ranged` | Lets a creature attack from Support (the only way a Support creature can attack at all), and can strike enemy Support creatures directly even while the enemy Vanguard is populated. Also fires from outside melee range: a Ranged attacker never takes retaliation damage **from a non-Ranged defender** — but a Ranged defender just shoots back, so two Ranged creatures trade normally. This is attacker-side only in the sense that a Ranged creature being attacked by a melee attacker still trades damage back like anyone else; it's the *combination* of Ranged-attacker-vs-non-Ranged-defender that skips retaliation. |
| `reach` | Same enemy-Support-targeting reach as Ranged, but doesn't grant attacking from Support — a Reach creature must still be in Vanguard to attack at all. |
| `infiltrate` | Can strike enemy Buildings directly regardless of the enemy board's row state, and is the one thing that lets an attacker bypass a Taunt creature to hit the Hero. Doesn't grant Support-row targeting by itself — pair with Reach/Ranged on the same card for that. |
| `charge` | Can attack the same turn it's played, ignoring summoning sickness. |
| `warcry` | *(renamed from `battlecry` in Phase D — no card ever shipped with the old value, so there was nothing to migrate.)* Marks a card whose `onPlay` trigger represents a Warcry effect (fires when played). Purely a label — the actual effect still comes from a `triggers: [{ on: "onPlay", ... }]` entry. |
| `taunt` | While alive, forces enemy attackers to target it first among the creatures in whichever row is actually being attacked — a Vanguard Taunt gates Vanguard-tier attacks; a Support Taunt gates Support-tier attacks the same way, for any attacker that can currently reach Support (Reach/Ranged always, Base once enemy Vanguard is empty — see the combat ladder below). Also gates Hero-targeting for any attacker that can reach the row it's in, the same way — bypassed only by Infiltrate. Doesn't affect Building targeting or Spell/Ability targeting (neither is gated by Taunt at all). |
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
| `stealth` | Can't be chosen as the target of an enemy attack, or of a hostile Spell/Ability that targets a specific creature — still hit by AOE effects (`allEnemyCreatures`), same scoping as Immune. Broken permanently the moment this creature attacks (there's no "Reveal" effect yet to break it early). Enforced in the engine (`combat.ts`'s `validateTarget`, `effects.ts`'s `resolveEffect`), the UI (a Stealthed creature is never highlighted as clickable, and a Spell/Ability whose only legal target is Stealthed fizzles rather than leaving the player stuck), and the AI's targeting heuristics. |
| `ward` | Negates the next hostile Spell or Ability that directly targets this creature — one-time, then consumed (`card.wardConsumed`). Doesn't stop AOE effects or plain combat damage, same scoping as Stealth/Immune. Checked after Stealth/Immune, so a creature that's already blocking the hit some other way doesn't burn its Ward for free. |
| `cleave` | On attack against a creature, also deals the same damage to enemy creatures in the columns directly adjacent to the primary target, same row — no retaliation, redirect, or Push from the splash hits, just damage. Doesn't trigger against Building/Hero targets (there's no "row" to splash into). |
| `drain` | Every time this creature deals *combat* damage (attacking or retaliating, including once per Cleave splash hit), its controller's Hero regains that much Guard, capped at Guard's current max — no overflow into Hero HP, and no effect on Guard's cap itself (that's what `gainCap`/`gainGuard` are for). |
| `bloodied` | Pair with `bloodiedBonus: { attackDelta: N }` on the card. Grants +N Attack while `currentHp * 2 <= maxHp` (at or below half Health) — live, re-evaluated on every Attack read same as `flank`/`formation`, not a stored delta or a discrete trigger. See `wounded-berserker`. |
| `summon` | Label for a trigger whose effect creates another creature via the `summonCreature` CardEffect (see Effects below) — pair with whichever `TriggerName` fits the card (`onPlay` for a Warcry-style summon, `onDeath` for a death-rattle one, etc.). |
| `armiger` | This creature is an eligible Equipment bearer (DESIGN.md §12) — without it, a creature can't hold any Equipment at all, only the Hero can. Doesn't grant anything by itself; the equipped item's `attackBonus`/`damageReduction` is what actually does something once assigned. |

`warcry`, `counter`, and `revenge` are labels that pair with a
matching `triggers` entry (`onPlay`, `onDefend`, `onDeath`
respectively) — the keyword itself doesn't do anything without the
trigger. `summon` is the same idea, paired with a `summonCreature`
effect instead of a specific trigger name. `taunt`, `frenzy`, `immune`,
`poison`, `protector`, `push`, `stealth`, and `drain` are fully handled
by the engine from the keyword alone. `ranged`, `reach`, `infiltrate`,
and `charge` are also engine-handled, no trigger needed. `flank`/
`formation`/`bloodied` each need their matching `flankBonus`/
`formationBonus`/`bloodiedBonus` field to actually do anything, same
as `ward` needing nothing extra (its one-time-use state lives on the
`CardInstance`, not the definition). `advance` is invoked as a player
action (`declareAdvance`), not through a trigger or effect.

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

**Reach-tier targeting chain** (full writeup: DESIGN.md §5) is a
**combat ladder** — Vanguard, then Support, then Buildings/Hero — that
a Base attacker (no reach keyword) climbs one rung at a time as the
enemy board clears: it can target enemy Vanguard freely, and once
enemy Vanguard is *completely empty* it can target enemy Support too
(subject to Support's own Taunt) — so an enemy board of nothing but
Support creatures is never untouchable just because the attacker lacks
a keyword. Reach and Ranged skip straight to Support even while enemy
Vanguard is still populated — that's their actual differentiator from
Base. Infiltrate can hit enemy Buildings regardless of row state.
**The enemy Hero has no board-population gate at all** — every
attacker can always target it directly, the same as any other card —
the only thing that narrows this is a reachable Taunt creature (a
Vanguard Taunt blocks every attacker; a Support Taunt blocks
Reach/Ranged attackers always, and blocks a Base attacker too once
enemy Vanguard is empty), and Infiltrate bypasses even that. Buildings
use **column** protection instead: a Building is attackable once
**both** rows in its own column are empty, or the attacker has
Infiltrate, independent of what's happening in other columns
(DESIGN.md §11). **Spells/Abilities are not part of this ladder** —
a targeted Spell/Ability effect can always reach any creature in
either row directly and ignores Taunt entirely.

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

Drives Allegiance deckbuilding (DESIGN.md §10): a deck may contain any
card whose Faction matches its Hero's Faction, plus any Neutral card
(Faction field simply omitted). A Faction-less Hero has no
restriction; a Hero's optional `allegiance` grant (see the Hero fields
above) can widen this further. Also usable as an `auraBuff` Hero
Passive filter. Valid values: `infernal-court`, `roseguard-kingdom`,
`moonveil-coven`, `velvet-syndicate`, `wildheart-tribes`,
`celestial-academy`, `necropolitan`, `arcane-industries`. Display names
(e.g. "The Infernal Court") live in `src/data/taxonomy.ts`.

## Races

A character-type tag for Creature and Hero cards. Mechanically inert
on its own unless a specific card's effect keys off it — but a Hero's
`allegiance.neutralRaces` or an `auraBuff` Passive can key off it (see
the Hero fields above). Valid values: `beast`, `demon`, `dragon`,
`elemental`, `mech`, `human`, `undead`, `goblin`, `dwarf`, `elf`,
`pixie`, `ogre`, `giant`, `dark-elf`, `angel`, `orc`, `gnome`, `troll`,
`dryad`, `fairy`, `harpy`, `fiend`, `vampire`.

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
| `summonCreature` | `creatureId` (must match an existing Creature card's `id`), `count`? (Swarm, default 1) | Creates `count` copies of that Creature on the acting player's own board — Vanguard preferred, falling back to Support, respecting the summoned creature's own `spaceCost`. Each copy fizzles silently (no crash, nothing created) if there's no room left, so a Swarm effect can partially land. The new creature(s) have ordinary summoning sickness and fire their own `onPlay` triggers. No `target`. |
| `consume` | `target`, `attackDelta`?, `hpDelta`? | Force-destroys the targeted creature (bypasses Armor/damage-reduction — this is a sacrifice, not hostile damage) and then applies `attackDelta`/`hpDelta` as a permanent buff to every *other* friendly creature on the acting player's board. |
| `transform` | `target`, `creatureId` (must match an existing Creature card's `id`) | Replaces the targeted creature in place with a fresh instance of `creatureId`, re-finding room for its `spaceCost` (its own occupied slot(s) count as vacated, so a same-size or smaller upgrade always fits, and a Massive upgrade can too if adjacent space is free) — fizzles silently if there's no room. The new form keeps the old instance's summoning-sickness/exhaustion state and any active statuses (same battle-hardened unit), but its stats reset to the new definition's base (any prior `buff`/Consume deltas are lost) and it fires its own `onPlay` triggers. |

`target` (on the kinds that need one) is one of:
`"targetCreature"`, `"targetBuilding"`, `"targetCreatureOrBuilding"`,
`"targetAny"`, `"targetPlayer"`, `"allEnemyCreatures"`,
`"allFriendlyCreatures"`, `"selfHero"`. The first five are picked by
whoever activates the card (the UI asks for a target when needed); the
last three resolve automatically. See DESIGN.md §4/§6 for how targeting
actually plays out on the board — including how Taunt creatures can
force a different target than the one picked. `consume`/`transform`
are UI-scoped to the acting player's own creatures (see
`ui/targeting.ts`), since both act on a friendly creature.

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
> `warcry`, `taunt`, `counter`, `revenge`, `frenzy`, `immune`,
> `poison`, `protector`, `flank`, `formation`, `advance`, `push`,
> `stealth`, `ward`, `cleave`, `drain`, `bloodied`, `summon`, `armiger`),
> `triggers` (array of `{on, effect}`, `on` one of
> `onPlay`/`onAttack`/`onDeath`/`onDefend`/`startOfTurn`/`endOfTurn`).
> Creatures can optionally add `spaceCost` (number, Massive — default
> 1), `flankBonus`/`formationBonus`/`bloodiedBonus` (`{ attackDelta:
> number }`, paired with the `flank`/`formation`/`bloodied` keywords).
> Buildings need `hp` and `triggers`, and can optionally add `passive`
> (`{ kind: "auraBuff", filter: "all" | { race } | { faction },
> attackDelta: number }`) and/or `ability` (`{ effect: CardEffect,
> activateCost: number, pool?: "resource" | "mana" | "energy" }` —
> `pool` defaults to `"resource"`, and unlike a Spell/Ability there's no
> `charges`/cap). Spells additionally need
> `spellForm` (one of `instant`, `ritual`, `charged`) and a single
> `effect`; `instant` casts straight from hand and takes no
> `activateCost`/`charges`, while `ritual`/`charged` also need
> `activateCost` (number) and `charges` (number, or `"unlimited"` —
> `ritual` normally uses `"unlimited"`, `charged` a fixed number).
> Abilities are always the `ritual`/`charged` shape (no `spellForm`
> field) and need `activateCost`, `charges`, and `effect` the same way.
> Equipment needs `category` (one of `weapon`, `armor`, `accessory`,
> `mount` — only a `weapon`, once assigned, lets its bearer's Hero
> attack), `attackBonus`, and `damageReduction`.
> An `effect` object has a `kind` (`damage`, `heal`, `applyStatus`,
> `buff`, `drawCard`, `gainGuard`, `gainCap`, `summonCreature`,
> `consume`, or `transform`) plus kind-specific fields: `damage`/`heal`
> need `amount` + `target`; `applyStatus` needs `status` (`"burn"` or
> `"poison"`) + `amount` + `target`; `buff` needs `target` +
> `attackDelta`/`hpDelta`; `drawCard` needs `amount`; `gainGuard` needs
> `amount`; `gainCap` needs `pool` (`"resource"`/`"mana"`/`"energy"`) +
> `amount`; `summonCreature` needs `creatureId` (must match an existing
> Creature card's `id`) and optionally `count` (Swarm — defaults to 1),
> no `target`; `consume` needs `target` and optionally
> `attackDelta`/`hpDelta`; `transform` needs `target` + `creatureId`
> (must match an existing Creature card's `id`). `target` is one of
> `targetCreature`, `targetBuilding`, `targetCreatureOrBuilding`,
> `targetAny`, `targetPlayer`, `allEnemyCreatures`,
> `allFriendlyCreatures`, `selfHero`.

Anything that doesn't fit the schema gets skipped at load time with a
console warning, not a crash — so it's safe to iterate.
