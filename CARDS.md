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
| `faction` | string (optional) | Faction — see "Factions" below. A flavor/synergy tag only (Phase O) — never restricts deckbuilding; mechanically inert unless a card's own effect (typically a Hero Passive's `auraBuff` filter) keys off it. |
| `races` | string array (optional) | Character race/type(s) — see "Races" below. An array as of Phase L, so a dual-nature card (Human + Angel, etc.) doesn't need bespoke text; most cards still carry just one entry. Only meaningful on Creature and Hero cards; mechanically inert unless a card's own effect keys off it. |

## Taxonomy semantics (important)

The card data model separates three ideas:

- **Hero Class** (`class: HeroClass`, required on every Hero as of Phase L): Fighter / Mage / Rogue, describing the player's main-character fantasy and synergy direction. It is not a strict profession or universal deck lockout — and it's purely descriptive today, same as Race/Element, unless a card's own effect keys off it.
- **CreatureType**: battlefield/combat role. Defender means defensive durability/control; Fighter means offensive pressure; Ranger/Mage/Support/Rogue/Beast/Creature describe other combat identities. Multiple roles may be printed where appropriate.
- **Race**: what the being actually is. The fantasy race pool below is already an intentional content decision, not an auto-generated placeholder list.

World cultures, countries, houses, companies and orders (Cimbar, Lorthaine, Gestmane, Golden Company, etc.) are **not automatically `faction` values**. Mechanical `faction` is a flavor/synergy tag, not a deckbuilding restriction (Phase O — see DESIGN.md §10); world identities belong in lore unless a real card mechanic needs a tag.

## Archetype-specific fields

**Hero** (`archetype: "hero"`) — the card a player picks at the start
of a match; its stats become the starting Hero HP/Attack (see DESIGN.md
§9):
```json
{
  "id": "mage", "name": "Mage", "archetype": "hero", "cost": 0, "rarity": "common", "class": "mage",
  "attack": 20, "hp": 10, "faction": "moonveil-coven", "text": "A supernatural manipulator.",
  "passive": { "kind": "firstSpellDiscount", "amount": 1 },
  "heroPower": { "effect": { "kind": "damage", "amount": 2, "target": "targetAny" }, "activateCost": 2, "text": "Deal 2 damage." },
  "signature": { "effect": { "kind": "damage", "amount": 3, "target": "allEnemyCreatures" }, "activateCost": 4, "usesPerMatch": 1, "text": "Deal 3 damage to all enemy creatures." }
}
```
- `class`: `"fighter" | "mage" | "rogue"` — required. Broad class fantasy
  for the player's chosen main character (DESIGN.md §9), not a strict
  deck lockout and not the same taxonomy as `creatureType`. Purely
  descriptive today — no mechanic keys off it yet, same as `element`/
  `races` until a card's own effect chooses to.
- `attack`, `hp`: the Hero's base stats for the match (before Equipment).
  Attack only matters once Equipment is assigned — a new Hero's base
  Attack should be low/0, since the Weapon's `attackBonus` is meant to
  carry it (the three starter Heroes predate this convention and are a
  documented exception — see DESIGN.md §9).
- `passive` *(optional)*: an always-on `PassiveEffect`, from a small
  curated template set (see DESIGN.md §9) — currently:
  - `{ "kind": "auraBuff", "filter": "all" | { "race": Race } | { "faction": Faction }, "attackDelta": N }` — live +N Attack to every matching friendly creature, recomputed on every Attack read (same "Attack only, never stored" approach as Flank/Formation).
  - `{ "kind": "firstSpellDiscount", "amount": N }` — the controller's first Spell *activation* each turn (an Instant cast, or a Ritual/Charged Spell's `activateCost` step — not a Ritual/Charged Spell's initial slot-placement `cost`) costs N less Mana. Resets every `startTurn`.
  - **Planned (not live):** this single fixed field is slated to become three named **Specializations** built from the same `PassiveEffect` templates, one chosen per match rather than baked into the card — see DESIGN.md §19's Phase P spec before authoring new Hero passive content.
- `heroPower` *(optional)*: `{ "effect": CardEffect, "activateCost": N, "text"?: string }` — Energy-costed, usable once per turn (resets every `startTurn`), same `CardEffect` shape and `resolveEffect` machinery as a Spell/Ability.
- `signature` *(optional)*: same shape as `heroPower` plus `"usesPerMatch": N` — gated to N total uses for the whole match, never resets on `startTurn`. Not planned for every new Hero going forward (DESIGN.md §19) — kept as-is on Heroes that already have one.
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
  "races": ["dragon"],
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
- `creatureType` *(optional)*: `CreatureType[]` — a combat-role tag
  (Fighter/Ranger/Defender/Beast/Elemental/Mage/Ogre/Giant/Dragon/
  Support/Creature), printed as e.g. "Defender • Elemental" for a
  dual-typed card, stored as an array of 1-2 values. Distinct from
  `race` (a flavor/synergy tag, not this). Formation
  (`formationBonus`) checks whether an adjacent creature shares one of
  these tags — see "Keywords" below.
- `flankBonus`/`formationBonus`/`bloodiedBonus`/`frenzyBonus`/
  `deadeyeBonus`: `{ "attackDelta": N, "hpDelta"?: N }` — pair with the
  matching keyword. See "Keywords" below for what each one does.
- `enrageBonus`: `{ "attackPerMissingHp": N }` — pair with `enrage`.
- `resistantAmount`: number — pair with `resistant`.
- `crowdPleaserBonus`: `{ "attackPerCreature": N, "hpPerCreature": N, "attackCap": N, "hpCap": N }` — pair with `crowdPleaser`.
- `duel`: `{ "activateCost": N, "bonus": { "attackDelta": N, "hpDelta"?: N } }` — pair with `duel`.

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
    "hp": 5, "races": ["beast"], "text": "Passive: your Beast creatures have +2 Attack.",
    "passive": { "kind": "auraBuff", "filter": { "race": "beast" }, "attackDelta": 2 } }
  ```
- `ability` *(optional)*: an activated ability — `{ "effect": CardEffect, "activateCost": number, "pool": "resource" | "mana" | "energy", "charges"?: number }`.
  `pool` defaults to `"resource"` (Resources) when omitted, per §11; a
  specific card can spend Mana or Energy instead, like Demon Gate here.
  Unlike a Spell/Ability card, `charges` — when given — is a *lifetime*
  activation cap: the Building itself stays on the board once it's
  exhausted, only the ability stops working (Recruitment Station: 2).
  Omit `charges` for the original unlimited-while-affordable default.
  ```json
  { "id": "demon-gate", "name": "Demon Gate", "archetype": "building", "cost": 4, "rarity": "epic",
    "hp": 6, "races": ["demon"], "text": "Activate (3 Mana): summon a Flame Imp.",
    "ability": { "effect": { "kind": "summonCreature", "creatureId": "flame-imp" }, "activateCost": 3, "pool": "mana" } }
  ```
- `spellAmplify` *(optional)*: number — an Ancient Mage Tower-style aura:
  while this Building stands, every damage/heal/status-amount instance
  from the *controller's Spell cards* is increased by this much. Baked
  into the amount once, when the Spell's own effect resolves (including
  into a Poison/Bleed/Burn status's stored amount) — not re-checked
  live on every later status tick if the Tower is destroyed mid-effect.
- `triggers`: same On Construction / onAttack / onDeath / startOfTurn /
  endOfTurn triggers a Creature can have. A Building only ever uses
  `triggers` OR `ability` in practice — nothing stops both being
  present, but no example card combines them.

**Spell** (`archetype: "spell"`, costs Mana) / **Ability** (`archetype: "ability"`, costs Energy):

A Spell needs `spellForm` (DESIGN.md §1a); an Ability needs the
equivalent `abilityForm` (`"instant" | "activated"`) — the same
Instant/(Ritual|Charged) split, just with `"activated"` covering what
used to be an Ability's only shape. `"instant"` resolves immediately
on play for `cost` Energy, no slot, no `activateCost`/`charges`
(Exercise, Executioner's Strike); `"activated"` is the original
placed-in-a-slot, separately-activated shape.

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
- `activateCost`: Mana (spell) or Energy (ability) cost per activation — omit only for an Instant Spell/Ability.
- `charges`: a number, or the string `"unlimited"` — omit only for an Instant Spell/Ability.
- `effect`: a single `CardEffect` (see below) — the card's one activated effect.
- A creature with the **Immune** keyword blocks Spell-archetype
  activations that target it (see "Keywords" below) — Ability
  activations and creature/building triggers are unaffected.
- An Instant cast, or a Ritual/Charged/Activated card that fizzles out
  of charges, goes to `discard` — not the `graveyard`, which is
  reserved for creature/building deaths (see DESIGN.md §17's Phase C
  implementation-status note for why).
- Focus's/Rally's printed card faces have no `×N`/`∞` use marker — the
  built-in cards default that to `"unlimited"` (an explicit Open
  default, not a guess at a specific number).

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
- `keywords` *(optional)*: `Keyword[]` — grants the listed keyword(s) to
  the Hero while this item is equipped to them (checked separately from
  a creature/building's own `hasKeyword`, since Equipment isn't a
  Creature). Cloak of Shadows uses this for Vanish.
- `charges` *(optional)*: number — total charges before this item
  auto-discards, decrementing once per Hero attack while equipped
  (Cloak of Shadows: 3 charges / 3 attacks). Omit for the default
  no-expiry behavior.
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
| `taunt` | While alive, forces enemy attackers to target it first among the creatures in whichever row is actually being attacked — a Vanguard Taunt gates Vanguard-tier attacks; a Support Taunt gates Support-tier attacks the same way, for any attacker that can currently reach Support (Reach/Ranged always, Base once enemy Vanguard is empty — see the combat ladder below). Also gates Hero-targeting for any attacker that can reach the row it's in, the same way — bypassed only by Infiltrate or a Duel mark on that specific target. Doesn't affect Building targeting or Spell/Ability targeting (neither is gated by Taunt at all). |
| `counter` | Marks a card whose `onDefend` trigger fires when it's attacked (pair with a `triggers: [{ on: "onDefend", ... }]` entry, e.g. reflect damage back at the attacker). |
| `revenge` | Marks a card whose `onDeath` trigger fires when it dies (pair with a `triggers: [{ on: "onDeath", ... }]` entry). |
| `frenzy` | Pair with `frenzyBonus: { attackDelta: N }`. Every time this creature attacks — regardless of whether the hit lands or the target survives — it permanently gains +N Attack, stored on `attackDelta`. (Renamed semantics as of Phase K/the Neutral Core Set spec: the old damage-triggered "gains Attack equal to damage taken" behavior is now **Enrage**, below.) |
| `enrage` | Pair with `enrageBonus: { attackPerMissingHp: N }`. Live Attack bonus equal to `N × (current missing HP)` — re-evaluated on every Attack read, never stored, so healing this creature reduces the bonus back down. |
| `immune` | Blocks Spell-archetype activated effects from targeting this creature (see Spell note above). Does not block Ability effects or other creatures' triggers. |
| `poison` | When this creature attacks and the hit lands, it applies a Poison damage-over-time status to whatever it hit, in addition to its normal combat damage. Built into the engine (`fireOnAttackTrigger`, wired into `declareCreatureAttack` as of Phase K — it existed but was never actually called before that) — pair with an `onAttack` trigger, e.g. `{ "on": "onAttack", "effect": { "kind": "applyStatus", "status": "poison", "amount": 1, "duration": 3, "target": "targetCreature" } }`. |
| `bleed` | Same shape and wiring as `poison`, a separate DOT status that can coexist with it. |
| `burn` | Same DOT status shape — typically paired with **both** an `onAttack` trigger (Burn the creature this attacks) **and** an `onDefend` trigger (Burn whatever attacks this), e.g. Fire Golem. |
| `frostArmor` | Label for an `onDefend` trigger that applies the `freeze` status to the attacker, e.g. `{ "on": "onDefend", "effect": { "kind": "applyStatus", "status": "freeze", "amount": 0, "duration": 1, "target": "targetCreature" } }`. |
| `resistant` | Pair with `resistantAmount: N`. Reduces every incoming hit (from any source) by N, floored at 0 — stacks additively with any bearer Armor `damageReduction`. |
| `deadeye` | Pair with `deadeyeBonus: { attackDelta: N }`. Adds +N Attack only while resolving an attack against a target currently in the enemy's Support row — attack-instance-scoped: not live-recomputed, not permanently stored, applies to that one attack only. |
| `doubleStrike` | Can attack up to twice per turn instead of once. `hasAttackedThisTurn` still means "fully exhausted" for every other purpose — the second-swing bookkeeping is internal (`CardInstance.attacksUsedThisTurn`). |
| `duel` | Pair with `duel: { activateCost, bonus }` on the card (see Creature fields above). An Energy-costed player/AI action (`declareDuelMark` in `combat.ts`, not a `CardEffect` — deliberately bespoke, single-card logic) marks one enemy creature; while it remains on the board, this creature gets `bonus` live and may attack it bypassing the Vanguard ladder and Taunt. Re-marking overwrites the old mark ("only one target" falls out naturally); no cleanup needed when the mark dies, the live check just stops finding it. |
| `crowdPleaser` | Pair with `crowdPleaserBonus: { attackPerCreature, hpPerCreature, attackCap, hpCap }`. Live Attack/HP bonus scaling with the number of *other* creatures currently on the board — **both sides count** (an Open default; the spec doesn't say "friendly") — each stat capped independently. |
| `massive` | Descriptive tag alongside `spaceCost` (see below) — `spaceCost` is what actually drives multi-slot placement; the keyword is just for card-face/UI recognition. |
| `protector` | When an attack targets an allied creature in the same row, the engine may automatically redirect it onto this creature instead — a heuristic stand-in for the "defender's manual choice" DESIGN.md §5 describes; it only fires when the original target would otherwise die to the hit. No `triggers` entry needed. |
| `flank` | Pair with `flankBonus: { attackDelta: N }` on the card. Grants +N Attack while this creature occupies column 1 or 5 (0-indexed 0 or 4) of its row — live, re-evaluated on every Attack read, not a stored delta. |
| `formation` | Pair with `formationBonus: { attackDelta: N, hpDelta?: N }`. Grants the bonus while an adjacent, same-row creature shares one of this creature's `creatureType` tags (type-conditional as of Phase K — previously any adjacent ally qualified) — also live. The optional `hpDelta` is a display-only bonus (see `getEffectiveCreatureMaxHp`) — it never affects `currentHp`, death checks, or the heal cap. |
| `advance` | Lets a Support creature spend 1 Energy to move into the same-column Vanguard slot instead of attacking (`declareAdvance` in `combat.ts`). Uses the same Ready/summoning-sickness gate as attacking (also blocked by Freeze), and exhausts the creature the same way. No `triggers` entry needed — it's a player action, not a trigger. |
| `push` | When this creature's attack damages an enemy Vanguard creature and it survives, and that column's Support slot is empty, the defender gets moved there automatically. Doesn't apply to Massive defenders (they don't fit in one Support slot). No `triggers` entry needed. |
| `vanish` | *(replaces `stealth` as of Phase K — same keyword, new name and simpler rule: the old "breaks once this creature attacks" condition is gone.)* Can't be chosen as the target of an enemy attack, or of a hostile Spell/Ability that targets a specific creature — still hit by AOE effects (`allEnemyCreatures`), same scoping as Immune. Enforced in the engine (`combat.ts`'s `validateTarget`, `effects.ts`'s `resolveEffect`), the UI (a Vanished creature is never highlighted as clickable, and a Spell/Ability whose only legal target has Vanish fizzles rather than leaving the player stuck), and the AI's targeting heuristics. Equipment can also grant this to the Hero via its own `keywords` field (see Equipment above). |
| `ward` | Negates the next hostile Spell or Ability that directly targets this creature — one-time, then consumed (`card.wardConsumed`). Doesn't stop AOE effects or plain combat damage, same scoping as Vanish/Immune. Checked after Vanish/Immune, so a creature that's already blocking the hit some other way doesn't burn its Ward for free. |
| `cleave` | On attack against a creature, also deals the same damage to enemy creatures in the columns directly adjacent to the primary target, same row — no retaliation, redirect, or Push from the splash hits, just damage. Doesn't trigger against Building/Hero targets (there's no "row" to splash into). |
| `drain` | Every time this creature deals *combat* damage (attacking or retaliating, including once per Cleave splash hit), its controller's Hero regains that much Guard, capped at Guard's current max — no overflow into Hero HP, and no effect on Guard's cap itself (that's what `gainCap`/`gainGuard` are for). |
| `bloodied` | Pair with `bloodiedBonus: { attackDelta: N }` on the card. Grants +N Attack while `currentHp * 2 <= maxHp` (at or below half Health) — live, re-evaluated on every Attack read same as `flank`/`formation`, not a stored delta or a discrete trigger. See `wounded-berserker`. |
| `summon` | Label for a trigger whose effect creates another creature via the `summonCreature` CardEffect (see Effects below) — pair with whichever `TriggerName` fits the card (`onPlay` for a Warcry-style summon, `onDeath` for a death-rattle one, etc.). |
| `armiger` | This creature is an eligible Equipment bearer (DESIGN.md §12) — without it, a creature can't hold any Equipment at all, only the Hero can. Doesn't grant anything by itself; the equipped item's `attackBonus`/`damageReduction` is what actually does something once assigned. |

`warcry`, `counter`, and `revenge` are labels that pair with a
matching `triggers` entry (`onPlay`, `onDefend`, `onDeath`
respectively) — the keyword itself doesn't do anything without the
trigger. `summon` is the same idea, paired with a `summonCreature`
effect instead of a specific trigger name. `poison`/`bleed`/`burn`/
`frostArmor` pair with an `onAttack`/`onDefend` trigger the same way.
`taunt`, `immune`, `protector`, `push`, `vanish`, `drain`, `frenzy`
(with `frenzyBonus`), `enrage` (with `enrageBonus`), `resistant` (with
`resistantAmount`), `deadeye` (with `deadeyeBonus`), `duel` (with
`duel`), and `crowdPleaser` (with `crowdPleaserBonus`) are fully
handled by the engine from the keyword + its matching field alone —
none of them need a `triggers` entry. `ranged`, `reach`, `infiltrate`,
`charge`, and `doubleStrike` are also engine-handled, no trigger or
extra field needed. `flank`/`formation`/`bloodied` each need their
matching `flankBonus`/`formationBonus`/`bloodiedBonus` field to
actually do anything, same as `ward` needing nothing extra (its
one-time-use state lives on the `CardInstance`, not the definition).
`advance` and `duel`'s mark are invoked as a player/AI action
(`declareAdvance`/`declareDuelMark`), not through a trigger or effect.

**Freeze** is a status, not a keyword — see "Status effects" below.
It's applied via an `applyStatus` effect (e.g. Frost Armor's
`onDefend` trigger, or Frost Nova's Spell effect) and gates
`creatureCanAttack`/`heroCanAttack`/Advance/Duel-activation while it
holds, checked via a shared `isFrozen` helper (`status.ts`).

**Massive creatures** (`spaceCost: N` on a `CreatureDefinition`, driving
the actual multi-slot behavior — pair with the `massive` keyword tag
for card-face recognition, though the keyword itself is descriptive
only) occupy `N` contiguous same-row slots instead of the
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

A flavor/synergy tag, not a deckbuilding restriction (DESIGN.md §10,
rewritten Phase O) — any card is legal in any deck regardless of its
Hero's own Faction. Usable as an `auraBuff` Hero Passive filter, so a
Faction's own Hero can reward (or in principle penalize) fielding that
Faction's creatures without that ever being required. Valid values:
`infernal-court`, `roseguard-kingdom`, `moonveil-coven`,
`velvet-syndicate`, `wildheart-tribes`, `celestial-academy`,
`necropolitan`, `arcane-industries`. Display names (e.g. "The Infernal
Court") live in `src/data/taxonomy.ts`.

## Races

A species/type tag for Creature and Hero cards. The fantasy race pool is intentionally selected for the setting and future card content, including the project's adult-fantasy/fan-service visual direction; it is not merely anticipatory scaffolding. Race is mechanically inert on its own unless a card or aura keys off it.

**Live schema (Phase L):** `races: Race[]` — a dual-nature card (Human + Angel, etc.) doesn't need bespoke text; most cards still carry just one entry. Valid values: `beast`, `demon`, `dragon`, `elemental`, `mech`, `human`, `undead`, `goblin`, `dwarf`, `elf`, `pixie`, `ogre`, `giant`, `dark-elf`, `angel`, `orc`, `gnome`, `troll`, `dryad`, `fairy`, `harpy`, `fiend`, `vampire`. `auraBuff`'s `{ race }` Passive filter matches against *membership* in this array, not a single equality check.

## CreatureType

A **combat-role** tag for Creature cards only, separate from Race and separate from Hero Class. It answers “what job does this unit do on the board?” rather than “what species is it?”

Examples of intended semantics:
- `defender` — usually high HP/durability and defensive abilities/keywords. Spiked Turtle is the model: obviously an animal by Race, but tactically a Defender.
- `fighter` — offensive pressure: typically higher damage relative to durability and/or offensive tools such as Reach, Charge, Cleave, Frenzy, etc.
- `ranger` — ranged/precision role.
- `mage` — creature-level magical/support role; does not mean the player's Hero is a Mage.
- `support` — utility/buff/heal/economy role.
- `beast` / `elemental` / `ogre` / `giant` / `dragon` / `creature` — existing broad formation/type families where the printed combat identity intentionally uses that label.

Formation checks shared `creatureType` tags, so a card may carry 1-2 values.

**Live values:** `fighter`, `ranger`, `defender`, `beast`, `elemental`, `mage`, `ogre`, `giant`, `dragon`, `support`, `creature`, `rogue` (Phase L — for creature cards whose battlefield identity is infiltration/assassination/evasion; `assassin` and `shadow-infiltrator` carry it in place of the generic `fighter` tag they used to have).

## Status effects

Applied via `applyStatus`, ticking once per affected-player turn-start
(`StatusType`: `"poison" | "bleed" | "burn" | "freeze"`). Poison,
Bleed, and Burn are damage-over-time — different types coexist, but
two applications of the *same* type don't stack (the newer application
just refreshes amount/duration to the higher of the two). Freeze is a
control status instead (`amount` is always 0) — see "Keywords" above
for what it gates. Every status now normally carries an explicit
`duration` (turns until it expires); omitting it lets a status persist
indefinitely, which no shipped card currently does.

---

## Effects (`CardEffect`)

Used in a spell/ability's `effect` field, and in any creature/building
`trigger`'s `effect` field. `kind` selects the shape:

| `kind` | Extra fields | What it does |
|---|---|---|
| `damage` | `amount`, `target` | Deals damage. |
| `heal` | `amount`, `target` | Restores HP. |
| `applyStatus` | `status` (`StatusType`), `amount`, `target`, `duration`? | Applies a status — see "Status effects" above. Supports the AOE `target` values (`allEnemyCreatures`/`allFriendlyCreatures`) same as `damage`/`buff`. |
| `buff` | `target`, `attackDelta`? , `hpDelta`?, `duration`? | Stat change (negative deltas work too — a debuff). Omit `duration` for the original permanent buff. With `duration: N` (ROADMAP.md #7), it's temporary instead: N turns, ticking down at the end of *every* turn — both players' — so `duration: 1` ("this turn") is gone by the time anyone's next turn starts, whether cast on an ally or an enemy. Stacks additively with itself and with a permanent buff; `hpDelta` under a duration is display-only (never heals `currentHp` or raises the real cap), matching Formation/Duel/Crowd Pleaser's `hpDelta`. |
| `drawCard` | `amount` | Draws for the acting player. No `target`. |
| `gainGuard` | `amount` | Grants Guard to the acting player. No `target`. |
| `gainCap` | `pool` (`"resource"\|"mana"\|"energy"`), `amount` | Raises a resource cap (and current amount) for the acting player. No `target`. |
| `gainIncome` | `amount` | Permanently raises the acting player's per-turn Resources trickle (`ResourcePool.income`, default 1) — distinct from `gainCap`, which raises the ceiling, not the regen rate. Farm/Gold Mine. No `target`. |
| `drawCreature` | `amount` | Draws the first *creature* card found in the acting player's deck (not necessarily the top card) instead of a plain `drawCard`. Fizzles silently if the deck has no creature left. No `target`. |
| `devour` | `target` | Destroys the targeted creature (bypasses Armor/Resistant — a removal effect, not hostile damage) and buffs *the creature whose trigger produced this effect* by half the destroyed creature's own printed Attack/HP, rounded down. Needs `resolveEffect`'s internal `selfInstanceId` — only usable from a creature's own `onPlay` trigger (threaded automatically when played from hand, summoned, or transformed in). Elder Flame Imp. |
| `multi` | `effects` (`CardEffect[]`) | Resolves each listed effect in order, against the same target/source. **Scope note:** every sub-effect must be one that doesn't need its own separate UI target selection — a self-contained AOE/self/selfHero shape. Frost Nova (damage + Freeze, both `allEnemyCreatures`) is the only card using this today. |
| `summonCreature` | `creatureId` (must match an existing Creature card's `id`), `count`? (Swarm, default 1) | Creates `count` copies of that Creature on the acting player's own board — Vanguard preferred, falling back to Support, respecting the summoned creature's own `spaceCost`. Each copy fizzles silently (no crash, nothing created) if there's no room left, so a Swarm effect can partially land. The new creature(s) have ordinary summoning sickness and fire their own `onPlay` triggers. No `target`. |
| `consume` | `target`, `attackDelta`?, `hpDelta`? | Force-destroys the targeted creature (bypasses Armor/damage-reduction — this is a sacrifice, not hostile damage) and then applies `attackDelta`/`hpDelta` as a permanent buff to every *other* friendly creature on the acting player's board. |
| `transform` | `target`, `creatureId` (must match an existing Creature card's `id`) | Replaces the targeted creature in place with a fresh instance of `creatureId`, re-finding room for its `spaceCost` (its own occupied slot(s) count as vacated, so a same-size or smaller upgrade always fits, and a Massive upgrade can too if adjacent space is free) — fizzles silently if there's no room. The new form keeps the old instance's summoning-sickness/exhaustion state and any active statuses (same battle-hardened unit), but its stats reset to the new definition's base (any prior `buff`/Consume deltas are lost) and it fires its own `onPlay` triggers. |
| `garrison` | `target` | Moves the targeted creature off the battlefield into the first friendly Building with an open housing slot (`CardInstance.garrisonedCreature`) — fizzles silently if no friendly Building has room (every Building holds at most 1). A garrisoned creature can't attack, be attacked, or be targeted by anything (it's not in any board row array). It's ejected back onto the battlefield — or destroyed, if there's no room — if its Building is destroyed. No manual un-garrison action. |

`target` (on the kinds that need one) is one of:
`"targetCreature"`, `"targetBuilding"`, `"targetCreatureOrBuilding"`,
`"targetAny"`, `"targetCreatureOrPlayer"`, `"targetPlayer"`,
`"targetRow"`, `"allEnemyCreatures"`, `"allFriendlyCreatures"`,
`"selfHero"`. `targetCreatureOrPlayer` is like `targetAny` but excludes
Buildings (Lightning Bolt, Renewal, Toxic Cloud). `targetRow` lets the
caster pick an enemy row (Vanguard or Backline) instead of a single
creature — Black Dragon (`{ kind: "row"; owner; row: "vanguard" |
"support" }` as the resolved target ref) — every creature in that row
takes the effect. The explicit-pick values (everything except the last
three) are picked by whoever activates the card (the UI asks for a
target when needed); `allEnemyCreatures`/`allFriendlyCreatures`/
`selfHero` resolve automatically. See DESIGN.md §4/§6 for how targeting
actually plays out on the board — including how Taunt creatures can
force a different target than the one picked. `consume`/`transform`/
`garrison`/`devour` are UI-scoped to the acting player's own creatures
or the enemy's, per each effect's own hostile/friendly direction (see
`ui/targeting.ts`'s `effectTargetSide`).

`triggers` (creatures/buildings only) fire on: `"onPlay"`, `"onAttack"`,
`"onDeath"`, `"onDefend"` (fires on the defending creature, pairs with
Counter), `"startOfTurn"`, `"endOfTurn"`.

---

## Adding images

**Card art (Creature/Hero/Building/Spell/Ability/Equipment):** every
card image is normalized to **512×776** — a portrait card-art aspect
ratio — regardless of the source image's original size or shape.

> **Full-card-face warning:** because non-Hero art now contains the printed name/cost/rules/stats itself, cover-fit cropping can remove mechanically important text or frame elements. The current Admin Panel still cover-crops uploads. Until that uploader is changed, supply a source already matching 512×776 (or the exact same aspect ratio) so no meaningful edge content is lost. A future admin improvement should reject/contain mismatched full-card faces rather than crop them silently.

**As of Phase K, the art *is* the card face for every archetype except
Hero.** `CardView` no longer draws a frame, name, cost, rarity, or
rules-text overlay for Creature/Building/Spell/Ability/Equipment — the
`art` image is expected to already show all of that, and only *live*
state (current Attack/HP, status badges, charges remaining) renders on
top of it. Hero art is the one exception and stays bare character art
by design (a Hero's Attack/Health come from Equipment, not printed
stats), so Hero cards still show a text layout (name/meta/rules
text/base stats).

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

Use the schema in this file as authority; do **not** reuse older prompts that mention Stealth, the pre-Phase-K Frenzy behavior, the old Ability-only-activated model, or a singular `race` field. A compact current prompt:

> Generate browser-card-game cards as a JSON array matching `CARDS.md`. Every card needs unique kebab-case `id`, `name`, `archetype`, `cost`, `rarity`; optional `text`, `art`, `element`, `faction`, `races` (array, usually one entry). Hero: `class` (`fighter|mage|rogue`, required), `attack`, `hp`, optional `passive`, `heroPower`, `signature`, `ruleBreaks`. Creature: `attack`, `hp`, `keywords`, `triggers`, optional `creatureType` (1-2 live values, including `rogue`), `spaceCost`, and matching keyword payloads (`flankBonus`, `formationBonus`, `bloodiedBonus`, `frenzyBonus`, `enrageBonus`, `deadeyeBonus`, `crowdPleaserBonus`, `duel`, `resistantAmount`). Building: `hp`, `triggers`, optional aura `passive`, activated `ability` (which may have lifetime `charges`), or `spellAmplify`. Spell: `spellForm` = `instant|ritual|charged`; Ability: `abilityForm` = `instant|activated`. Instant has only play `cost`; slotted forms also use `activateCost` and `charges`. Equipment: `category`, `attackBonus`, `damageReduction`, optional `keywords`, `charges`. Current keywords include ranged, reach, infiltrate, charge, warcry, taunt, counter, revenge, frenzy, enrage, immune, poison, bleed, burn, frostArmor, resistant, deadeye, doubleStrike, duel, crowdPleaser, massive, protector, flank, formation, advance, push, vanish, ward, cleave, drain, bloodied, summon, armiger. Current status types are poison, bleed, burn, freeze. Current effects include damage, heal, applyStatus, buff, drawCard, gainGuard, gainCap, gainIncome, drawCreature, devour, multi, summonCreature, consume, transform, garrison. Use only target values and enum values documented above; anything unsupported is skipped by validation. Do not invent a world `faction` tag merely because a card belongs to a named culture/company; Faction is a flavor/synergy tag only (never a deckbuilding restriction) — leave it omitted for Neutral cards unless a real card mechanic needs it.

For designs requiring mechanics not currently represented by the schema (especially temporary “this turn/until next turn” modifiers, top-N choose/reorder, Mark/Grudge/Trap/Counterspell windows, temporary control, silence/rules copying), return the card as a **design proposal** and explicitly label the missing engine primitive instead of fabricating JSON that looks valid but cannot work.
