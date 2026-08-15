# Card Game Design Document

A browser-based card game blending **Hearthstone** (mana curve, board of
creatures, hero-focused combat), **Gwent** (row-based board, on-field
persistent spell/ability "items", building-driven economy) and the
**Pokemon TCG** (simple status conditions instead of a full elemental
chart). This document is the single source of truth for the ruleset
implemented by the engine in `src/engine`.

Everything under "Open defaults" was not explicitly specified and was
chosen to keep the prototype coherent and playable; treat those as easy
to revisit.

For how to add, generate, or reskin cards (including images), see
`CARDS.md`. For the account/admin backend, see `BACKEND.md`.

---

## 1. Card archetypes

Every card belongs to exactly one archetype:

| Archetype | Zone when played | Summary |
|---|---|---|
| **Hero** | The Hero slot | Chosen before a match starts, not played from hand (its `cost` is unused). Has HP + Attack, like a Creature — see §6. Fighter/Mage/Rogue are just the starting roster; any Hero card works the same way, including ones created later with different stats. |
| **Creature** | Front Row (5 slots) | Has HP + Attack. Fights on the front line. May carry an **innate trigger** (a passive/reactive effect baked into the card, not a separate Spell/Ability card) and any of the Keywords in §5. |
| **Building** | Back Row (5 slots) | No HP-in-combat by default; boosts production (Resources / Mana / Energy caps, or Militia) each turn, or grants a one-time/ongoing effect. Stays on the field until destroyed. |
| **Spell** | One of 4 Spell/Ability slots (2 left + 2 right of the Hero) | Placed on the field like an item, then *activated* on demand by spending Mana. Deals damage / effects to creatures, buildings, or players. |
| **Ability** | One of 4 Spell/Ability slots | Same slot pool as Spells, activated by spending Energy instead of Mana. |
| **Equipment** | The single Equipment slot behind the Hero | Unlocks the Hero's own Attack for melee combat, and may add `attackBonus`/`damageReduction`. Only one can be equipped at a time — equipping a new one discards the old. |

Every card (any archetype) can also optionally carry an **Element**, a
**Faction**, and — for Hero/Creature cards — a **Race**. These are pure
tags with no built-in gameplay rule of their own (no elemental
type-effectiveness chart, no faction synergy bonuses); they exist for
flavor, filtering, and as hooks a card's own trigger/effect text can
reference. Full option lists are in §5.

Spells and Abilities share the same 4 slots (any mix of the two, e.g. 3
spells + 1 ability, or 4 abilities). They are **not** one-shot hand
cards — playing one from hand into an empty slot costs **Resources**
(like any other card), and it then sits on the field as a
repeatable, activatable effect:

- **Limited-charge** cards have a fixed number of activations (e.g. 3
  casts) printed on the card; the card is discarded after the last charge
  is used.
- **Unlimited-use** cards stay in their slot indefinitely and can be
  activated every turn (subject to Mana/Energy cost and any per-turn
  activation limit on the card) until the player chooses to discard/replace
  them.

Because Spells/Abilities sit face-up on the field, the opponent can see
them coming and play around them (e.g. holding a removal spell, avoiding
lethal range) — this is the intended counterplay hook.

---

## 2. Resources: three independent pools

All three pools follow the same shape: **start at 5, cap at 10**, and the
cap (not just the current value) is what building/spell cards raise.

| Pool | Spent on | Raised by |
|---|---|---|
| **Resources** | Playing *any* card from hand (Creature, Building, or placing a Spell/Ability into a slot) | Economy buildings: Gold Mine, Lumbermill, Farm |
| **Mana** | Activating a Spell already on the field | Arcane buildings/spells: Arcane Sanctum, Mana Pool |
| **Energy** | Activating an Ability already on the field | Training buildings/spells: Training Field, Exercise |

This is the "caster vs. melee" fork: investing in Mana-cap cards builds
toward a spell-slinging game plan, investing in Energy-cap cards builds
toward an ability/martial game plan. Nothing stops mixing both.

**Open default:** all three pools fully refill to their current cap at
the start of each player's turn (Hearthstone-style refill, not
accumulation). Cap increases are permanent for the rest of the game.
Playing a second copy of a cap-up card while already at the pool's
hard max (10) has no further effect.

---

## 3. The board

Each player's field, front-to-back from the opponent's perspective:

```
              [ Back Row: 5 Building slots ]
[Spell/Ability][Spell/Ability]  HERO  [Spell/Ability][Spell/Ability]
                              [Equipment]
              [ Front Row: 5 Creature slots ]
```

- **Front Row** (5 slots): Creatures only.
- **Back Row** (5 slots): Buildings only.
- **Hero slot**: the player's Hero card (see §6). Not directly placed by
  the player — it's the deck's chosen Hero and starts the game there.
- **Equipment slot** (directly behind the Hero): holds one Equipment
  card. Equipping lets the Hero participate directly in combat —
  granting the Hero an Attack stat so it can make melee attacks, and/or
  changing how much damage the Hero takes. An empty Equipment slot means
  the Hero cannot attack.
- **Spell/Ability slots** (2 left + 2 right of the Hero, 4 total): holds
  Spell and/or Ability cards, in any combination, as described in §1.

Both players have their own full copy of this layout; a match is one
player's field facing the other's.

---

## 4. Targeting & the damage chain

1. **Front Row vs Front Row:** an attacking Front Row creature may
   target *any* enemy Front Row creature — free targeting within the
   row, not lane-locked to the mirrored slot — **unless the enemy has a
   Taunt creature**, in which case a Taunt creature must be targeted
   first (see §5).
2. **Reaching the Back Row:** an attacker may target an enemy Back Row
   building only if the enemy Front Row is empty, **or** the attacker has
   the **Ranged** keyword (Ranged units can hit the Back Row even through
   a full enemy Front Row).
3. **Reaching Militia/Hero:** once the enemy Front Row is empty (or
   bypassed via Ranged), attacks/spells/abilities may target the enemy
   Militia/Hero directly. **Back Row buildings do not block this path** —
   they're optional side targets you can snipe for value (removing their
   production bonus), not a mandatory gate.
4. **Militia then Hero HP:** all damage aimed at the player hits
   **Militia** first. Once Militia is at 0, further damage overflows into
   the Hero's own **Hero HP**. Hero HP reaching 0 ends the game.

```
Front Row creatures  --(clear row, or attacker has Ranged)-->  Back Row buildings (optional target)
        |
        v (row empty / bypassed)
   Militia (100 default, shield)  -->  Hero HP (per-Hero) --> 0 HP = loss
```

**Open defaults:**
- Creatures have **summoning sickness**: they cannot attack the turn
  they're played, unless they have the **Charge** keyword.
- Each creature may attack **once per turn** unless a card effect grants
  extra attacks.
- Buildings have their own small HP pool when they *are* targeted (see
  card data); destroying one permanently removes its production bonus.

---

## 5. Keywords, Elements, Factions, Races

**Keywords** (Creature cards only — the `keywords` list on a card):

| Keyword | Effect |
|---|---|
| **Ranged** | Can attack the Back Row (or Militia/Hero) through a full enemy Front Row — see §4. |
| **Charge** | Can attack the turn it's played, skipping summoning sickness. |
| **Battlecry** | Cosmetic label for a card with an `onPlay` trigger — "does something when played." No separate mechanism from an ordinary onPlay trigger. |
| **Revenge** | Cosmetic label for a card with an `onDeath` trigger — "does something when it dies." No separate mechanism from an ordinary onDeath trigger. |
| **Counter** | Fires the card's `onDefend` trigger when it's targeted by an attack, resolving before the attack's damage — e.g. "deal 2 damage to the attacker." Scoped to being physically attacked, not to being targeted by spells/abilities. |
| **Frenzy** | Whenever this creature takes damage and survives, its Attack permanently increases by that same amount. |
| **Immune** | Blocks any Spell's damage/heal/status/buff from landing on this creature. Does **not** block Abilities, creature attacks, or other creatures'/buildings' triggers — "immune to spells" specifically. |
| **Taunt** | While this creature is alive on its controller's Front Row, enemy creature attacks must target a Taunt creature first (see §4). Doesn't affect Spell/Ability targeting. |
| **Poison** | No automatic engine behavior by itself — cards that poison on attack (e.g. Plague Rat) do it via an explicit `onAttack` trigger with an `applyStatus` poison effect; the keyword is there to tag/search for that pattern. See §7 for the Poison status effect itself. |

**Elements** (any archetype, optional, purely a tag): Frost, Fire,
Nature, Light, Darkness, Arcane, Martial, Blood, Infernal, Chaos.

**Factions** (any archetype, optional, purely a tag): The Infernal
Court, The Roseguard Kingdom, The Moonveil Coven, The Velvet Syndicate,
The Wildheart Tribes, The Celestial Academy, The Necropolitan, Arcane
Industries Consortium.

**Races** (Hero/Creature only, optional, purely a tag): Beast, Demon,
Dragon, Elemental, Mech, Human, Undead, Goblin, Dwarf, Elf, Pixie, Ogre,
Giant, Dark Elf, Angel, Orc, Gnome, Troll, Dryad, Fairy, Harpy, Fiend,
Vampire.

None of Element/Faction/Race gate deck-building or grant automatic
synergy bonuses in this pass — they're metadata a card's own effect
text can reference (e.g. "deal +1 damage to Undead"), and hooks for
future mechanics, not a rule layer that exists yet.

---

## 6. Hero, Militia, and player health

- **Militia**: both players start at **100**. Functions like Hearthstone
  Armor — a damage shield in front of the Hero's real health pool, not a
  win condition by itself. Buildings (Recruitment Station, Call to Arms,
  Bulletin Board) add to current/max Militia.
- **Hero HP**: the real loss condition. Base value depends on the chosen
  Hero card. The three starting Heroes:

  | Hero | Base HP | Base Attack (with Equipment) |
  |---|---|---|
  | Fighter | 20 | 10 |
  | Mage | 10 | 20 |
  | Rogue | 15 | 15 |

  More Hero cards with different stats can be added the same way any
  other card is (see `CARDS.md`) — Heroes aren't a fixed enum, they're
  cards with `archetype: "hero"`.

  A Hero's Attack stat only matters if it has Equipment in its Equipment
  slot; an unequipped Hero cannot attack (but can still be attacked once
  Militia is down).
- **Loss condition:** a player loses immediately when their Hero HP
  reaches 0.

---

## 7. Status effects

Kept intentionally simple — a nod to the Pokemon TCG rather than a full
elemental type chart. No type-effectiveness system exists otherwise.

- **Burn**: deals a fixed amount of damage at the end of each of the
  affected unit's controller's turns, for a fixed number of turns, then
  expires.
- **Poison**: deals a fixed amount of damage at the end of each of the
  affected unit's controller's turns, persisting until cured or the unit
  dies (no automatic expiry).

Both can affect creatures, buildings, or a player's Militia/Hero HP
depending on the source card. Multiple applications refresh/stack per the
source card's own text (kept card-by-card rather than a global stacking
rule for this prototype).

---

## 8. Turn structure

Alternating turns (Hearthstone-style), one player fully resolves a turn
before passing to the other:

1. **Draw phase:** draw 1 card (see §9 for empty-deck behavior). Refill
   Resources/Mana/Energy to their current caps.
2. **Main phase:** play any number of cards you can afford (Creatures,
   Buildings, or Spells/Abilities into open slots), activate any
   already-slotted Spells/Abilities you can afford, in any order.
3. **Combat phase:** declare attacks with eligible creatures (and the
   Hero, if equipped) following the targeting chain in §4.
4. **End phase:** status effects (Burn/Poison) tick down and deal their
   damage; "end of turn" triggered effects resolve; turn passes.

---

## 9. Deck, hand, and card flow

- **Deck size:** exactly 30 cards. No copy-count or archetype-mix
  restrictions beyond that (per design direction — kept deliberately
  open for the prototype).
- **Piles:** Deck (draw pile) → Hand → **Discard pile** (spent one-shot
  effects, and Spells/Abilities you voluntarily replace while they still
  had charges left) or **Graveyard** (creatures/buildings destroyed in
  combat, and Spells/Abilities that ran out of charges — permanently
  gone).
- **Empty deck:** when the deck runs out, shuffle the **Discard pile**
  back into a new deck. The **Graveyard never returns**. There is no
  Hearthstone-style fatigue damage.

**Open defaults:**
- Starting hand: 4 cards, with a one-time mulligan (redraw any subset)
  before turn 1.
- Max hand size: 10; a draw that would exceed it burns the drawn card
  instead (goes straight to the discard pile).
- The player who goes first does not draw on turn 1 (second player draws
  an extra card turn 1) — standard alternating-turn balancing.

---

## 10. Prototype scope

- **Platform:** client-side browser app (TypeScript + React + Vite) with
  an optional Supabase backend (accounts, a shared card catalog, an
  admin panel) — see `BACKEND.md`. Fully playable with no backend
  configured at all, in which case cards/coins/decks just live in
  `localStorage`. Local hot-seat or vs. a basic heuristic AI opponent;
  no live networked multiplayer yet.
- **AI opponent:** greedy heuristic — spends available Resources on the
  best affordable play each turn, activates Spells/Abilities when a
  favorable target exists, attacks when it doesn't lose the trade (or
  when it can push face damage safely), then ends turn. Not
  minimax/lookahead — good enough to playtest against.
- **Card set:** a starter pool covering all 6 archetypes, the 3 starting
  Heroes, the named economy/pool/militia buildings, creatures
  demonstrating each keyword, standalone Spell/Ability cards (including
  limited-charge and unlimited examples), Equipment cards, and
  Burn/Poison sources — enough to build three 30-card starter decks (one
  per starting Hero).

---

## 11. Card collection, packs, and custom decks

On top of Quick Play (a Hero's fixed starter deck), there's a second,
persistent progression loop:

- **Collection:** which cards you own and how many copies. Lives in
  `localStorage` while signed out (a per-browser "guest" save) or in the
  account's own Supabase-backed save once signed in — see `BACKEND.md`
  §5 for exactly how that switch works. Starts empty.
- **Coins:** a currency, same storage rule as the collection. Starts at
  300; a match awards +60 coins for a win, +25 for a loss (paid out
  once, right when a match ends).
- **Packs:** 100 coins buys a 5-card pack. Each card slot rolls
  independently by rarity weight (common 45 / uncommon 28 / rare 18 /
  epic 7 / legendary 2, out of 100 — see `src/data/packs.ts`) and is
  added to the collection; duplicates just stack (no dust/disenchant
  system). Hero cards are never pack contents — they're chosen
  separately, not deck material.
- **Deck Builder:** compose any 30-card deck from owned copies (no
  archetype/element/faction/race restrictions, consistent with §9), pick
  any Hero card to pair it with, and play a match with it. The AI
  opponent still plays a random starter Hero's fixed deck —
  collection/deckbuilding only applies to the player's own deck in this
  pass.

**Rarity** is a property of the card definition itself (`rarity` field:
common/uncommon/rare/epic/legendary) — it drives pack odds and a colored
corner pip on the card, and has no gameplay effect by itself.

**Card art and board theming:** any card can carry an `art` field
(image URL, a `public/`-relative path, or a `data:` URI) rendered behind
its text, with a graceful fallback to the plain layout when unset.
Admin-uploaded art is automatically normalized to 512×776 regardless of
the source image's size/aspect ratio. Board backgrounds are a separate,
code-level theme config. Adding new cards (by hand, via a JSON file with
runtime validation, by generating them with an LLM, or through the admin
panel) and adding images are covered in detail in `CARDS.md`.
