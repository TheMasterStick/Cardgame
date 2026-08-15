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

---

## 1. Card archetypes

Every card belongs to exactly one archetype:

| Archetype | Zone when played | Summary |
|---|---|---|
| **Creature** | Front Row (5 slots) | Has HP + Attack. Fights on the front line. May carry an **innate ability** (a passive or triggered effect baked into the card, not a separate Ability card). |
| **Building** | Back Row (5 slots) | No HP-in-combat by default; boosts production (Resources / Mana / Energy caps, or Militia) each turn, or grants a one-time/ongoing effect. Stays on the field until destroyed. |
| **Spell** | One of 4 Spell/Ability slots (2 left + 2 right of the Hero) | Placed on the field like an item, then *activated* on demand by spending Mana. Deals damage / effects to creatures, buildings, or players. |
| **Ability** | One of 4 Spell/Ability slots | Same slot pool as Spells, activated by spending Energy instead of Mana. |

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
- **Hero slot**: the player's Hero card (see §5). Not directly placed by
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
   target *any* enemy Front Row creature (free targeting within the row,
   not lane-locked to the mirrored slot).
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
   Militia (100 default, shield)  -->  Hero HP (class-dependent) --> 0 HP = loss
```

**Open defaults:**
- Creatures have **summoning sickness**: they cannot attack the turn
  they're played, unless they have a **Charge**-type keyword.
- Each creature may attack **once per turn** unless a card effect grants
  extra attacks.
- Buildings have their own small HP pool when they *are* targeted (see
  card data); destroying one permanently removes its production bonus.

---

## 5. Hero, Militia, and player health

- **Militia**: both players start at **100**. Functions like Hearthstone
  Armor — a damage shield in front of the Hero's real health pool, not a
  win condition by itself. Buildings (Recruitment Station, Call to Arms,
  Bulletin Board) add to current/max Militia.
- **Hero HP**: the real loss condition. Base value depends on the Hero's
  class:

  | Class | Base Hero HP | Base Hero Attack (with Equipment) |
  |---|---|---|
  | Fighter | 20 | 10 |
  | Mage | 10 | 20 |
  | Rogue | 15 | 15 |

  A Hero's Attack stat only matters if it has Equipment in its Equipment
  slot; an unequipped Hero cannot attack (but can still be attacked once
  Militia is down).
- **Loss condition:** a player loses immediately when their Hero HP
  reaches 0.

---

## 6. Status effects

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

## 7. Turn structure

Alternating turns (Hearthstone-style), one player fully resolves a turn
before passing to the other:

1. **Draw phase:** draw 1 card (see §8 for empty-deck behavior). Refill
   Resources/Mana/Energy to their current caps.
2. **Main phase:** play any number of cards you can afford (Creatures,
   Buildings, or Spells/Abilities into open slots), activate any
   already-slotted Spells/Abilities you can afford, in any order.
3. **Combat phase:** declare attacks with eligible creatures (and the
   Hero, if equipped) following the targeting chain in §4.
4. **End phase:** status effects (Burn/Poison) tick down and deal their
   damage; "end of turn" triggered effects resolve; turn passes.

---

## 8. Deck, hand, and card flow

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

## 9. Prototype scope

- **Platform:** fully client-side browser app (TypeScript + React +
  Vite). No server/network play in this pass — local hot-seat or vs. a
  basic heuristic AI opponent.
- **AI opponent:** greedy heuristic — spends available Resources on the
  best affordable play each turn, activates Spells/Abilities when a
  favorable target exists, attacks when it doesn't lose the trade (or
  when it can push face damage safely), then ends turn. Not
  minimax/lookahead — good enough to playtest against.
- **Card set:** a starter pool covering all 4 archetypes, the 3 Hero
  classes, the named economy/pool/militia buildings, a handful of
  creatures with innate abilities, standalone Spell/Ability cards
  (including limited-charge and unlimited examples), an Equipment card,
  and Burn/Poison sources — enough to build two 30-card starter decks.
