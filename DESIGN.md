# Card Game Design Document (v2)

A browser-based card game blending **Hearthstone** (mana curve,
hero-focused combat), **Gwent** (row-based board, on-field persistent
spell/ability "items", building-driven economy), and the **Pokemon
TCG** (simple status conditions instead of a full elemental chart).
This document is the single source of truth for the target ruleset.

**Implementation status:** this is a v2 architecture, landing in
phases (see §17). **Phase A is live**: the Vanguard/Support/Buildings
board (§4), the Energy/Mana/Resources-by-archetype cost split (§2),
Ready/Exhausted (§3), and the Guard rename (§6, with faction display
labels) are all in `src/engine` and the running UI today. **Phase B1
is also live**: the full reach-tier targeting chain — Base/Reach/
Ranged/Infiltrate (§5), built around a basic combat ladder (Vanguard,
then Support, then Buildings/Hero) that a Base attacker climbs as the
enemy board clears, while Reach/Ranged/Infiltrate skip rungs — plus
deliberate Vanguard-vs-Support placement when playing a creature,
Support creatures attacking if they have Ranged, column-based Building
protection (§11), the enemy Hero being always attackable (no
board-population gate — only a reachable Taunt creature, or a card's
own Creature-only restriction, narrows it), and Ranged retaliation-
immunity being conditional on the defender not also being Ranged
(two Ranged creatures trade normally).
**Phase B2 is also live**: Massive (`spaceCost`, multi-slot placement/
death/AOE-dedup), Flank/Formation (live, continuously re-evaluated
Attack bonuses — Attack only, not HP, see §5), Push (post-combat
reposition into Support), Advance (Support→Vanguard tactical action),
and Protector — with one deliberate simplification: DESIGN.md frames
Protector's redirect as a live, manual, reactive choice for the
defending player; the engine instead applies it automatically via a
heuristic (redirect only when the original target would otherwise die
to the hit) rather than a real-time prompt, symmetrically for both the
human and the AI. A genuine interactive prompt for the human's own
Protector decisions is a possible follow-up, not yet built.
**Phase C is also live**: the Instant/Ritual/Charged Spell split (§1a —
Instant casts straight from hand and resolves immediately; Ritual/
Charged still occupy a Spell/Ability slot exactly as before); Hero
Passive/Power/Signature (§9), with two curated Passive templates
(`auraBuff`, `firstSpellDiscount`) authored onto the three starter
Heroes — Fighter (+1 Attack aura, Hero Power gains Guard, Signature
buffs the whole board), Mage (first-Spell-each-turn Mana discount, Hero
Power/Signature are direct damage), Rogue (a narrower Goblin-only
Attack aura, Hero Power poisons, Signature executes); and Allegiance
deckbuilding validation (§10), enforced in the Deck Builder at
add-card and Play-This-Deck time. Two deliberate notes: (1) an
Instant-cast or Charged-fizzled Spell/Ability goes to `discard`, not
the `graveyard` this section's prose says — the engine's `graveyard`
array is reserved for creature/building deaths (it's what a future
Raise Dead-style Signature would recall from, per the §9 example), and
this already matched the pre-Phase-C charge-exhaustion behavior, so
Instant/Charged disposal was made consistent with it rather than the
other way around; (2) Allegiance is correctly built and unit-tested
but currently inert in play — only one existing card and none of the
three starter Heroes carry a `faction` tag yet, so no deck is actually
restricted until real Faction-tagged content exists. The three starter
Heroes' base Attack numbers (10/20/15) were left exactly as they were
even though this pass touched their card entries — see §9's
open-default note; retiring them to the low/0-base convention is a
separate balance call, not bundled into this rework.
**Phase D is also live**: Battlecry was renamed Warcry throughout (a
pure label rename — no card ever used the old keyword, so there was
nothing to migrate); Stealth, Ward, Cleave, Drain, Bloodied, and Summon
(the new `summonCreature` CardEffect kind) all landed, each with an
example card (`shadow-stalker`, `warded-acolyte`, `warhammer-brawler`,
`blood-leech`, `spider-matriarch`). A few implementation notes: Stealth
and Ward's "hostile Spell or Ability" scoping is checked against the
same `sourceArchetype` `resolveEffect` already threads through for
Immune, so — matching Immune's existing precedent — neither blocks a
creature/building Warcry or a Hero Power/Signature, only literal Spell/
Ability card effects; both are also enforced UI-side (the pending-
target highlight skips Stealthed creatures, and a Spell/Ability whose
only legal target is Stealthed fizzles immediately rather than leaving
the player stuck in a pending state with nothing left to click) and
AI-side (the opponent's targeting heuristics skip Stealthed creatures
too, for the same "don't waste an action on an illegal target" reason
— Hero Power/Signature are included in that heuristic skip even though
Stealth technically doesn't restrict them, a deliberate over-cautious
simplification since the AI never needs to play perfectly). Cleave's
splash targets are read live off the primary target's original column
neighbors, so it stays correct even if the primary target dies or gets
Pushed mid-resolution. Drain triggers on every individual instance of
combat damage this creature deals — including once per Cleave splash
hit — restoring Guard through `restoreGuard` (a cap-respecting sibling
of the existing `gainGuard`, which raises the cap itself and is meant
for a different job). `summonCreature` places into the controller's
Vanguard, falling back to Support, and simply fizzles (like a Warcry
with no legal target) if neither row has room; a summoned creature
gets normal summoning sickness and fires its own onPlay triggers.
Bloodied landed as a keyword label only, per its own §7 "Open default"
note — no card built yet needs its trigger mechanism decided, so
nothing forces that decision prematurely. Separately, this pass also
fixed `src/data/loadCustomCards.ts`'s keyword validator (it guards
`customCards.json`), which had been silently accepting only `ranged`/
`charge` on custom creatures since Phase A — every other keyword now
round-trips correctly, not just the six new ones.
**Phase E is also live**: Buildings as battlefield objects (§11).
Durability, column protection, the Graveyard-on-destruction, and the
On Construction trigger (mapped onto the same `onPlay` trigger a
creature's Warcry uses — a Building is just as much "played" the
moment it's placed) were all already live from earlier phases, so
Phase E's actual new surface is the **passive** and **activated
ability**: a Building's `passive` field is deliberately typed as only
the `auraBuff` template (`Extract<PassiveEffect, { kind: "auraBuff"
}>`), not the full Hero `PassiveEffect` union — `firstSpellDiscount` is
excluded at the type level, not just by convention, since a second
discount-granting source has no defined stacking/interaction model
yet. An `ability` is Resources-costed by default, same as §11 says,
with an optional `pool: "resource" | "mana" | "energy"` override for a
card whose text spends something else — `demon-gate` is the literal
Mana-costed example this section names. Unlike a Spell/Ability card's
charge count, or Hero Power's once-per-turn cap, a Building's
activated ability has **no usage cap at all**: it's repeatable every
turn (by the human, or by the AI's own single-pass-per-turn heuristic)
as long as its owner can afford it, since Buildings are persistent
battlefield objects rather than a consumed resource. Example cards:
`beast-den` (a Beast-only Attack aura) and `demon-gate` (Activate: 3
Mana, summon a Flame Imp). Everything else below (the Equipment
rework, Board-as-resource) is still spec only. CARDS.md/BACKEND.md
describe what's live today; check them (not just this doc) for
current schema.

Sections marked **Open default** are judgment calls made to keep the
spec internally consistent and buildable; flag any of them if they
don't match what you had in mind — they're easy to revisit before the
phase that depends on them starts.

For how to add/generate/reskin cards, see `CARDS.md`. For the
account/admin backend, see `BACKEND.md`.

---

## 1. Card archetypes

| Archetype | Zone when played | Summary |
|---|---|---|
| **Hero** | The Hero slot | Chosen before a match, not played from hand. Faction + Class (Fighter/Mage/Rogue) + Health + Attack + a Passive + a Hero Power, optionally a Signature Ability. See §9. |
| **Creature** | Vanguard (5) or Support (5) | Has HP + Attack. May carry an innate trigger and any Keywords from §7. Normally occupies 1 space; **Massive** creatures occupy more (§5). |
| **Building** | Buildings row (5, one per column) | Has Durability (HP). Passive and/or activated ability, plus an optional On Construction trigger (fires like Warcry). See §11. |
| **Spell** | Instant: none. Ritual/Charged: one of 4 Spell/Ability slots | Three forms — Instant, Ritual, Charged — see §1a. Always costs **Mana**, at every stage. |
| **Ability** | One of the same 4 Spell/Ability slots | Occupies a slot like a Ritual/Charged Spell (unlimited or numbered charges). Always costs **Energy**, at every stage. |
| **Equipment** | One of 4 Equipment slots (a player-owned zone, not Hero-only) | Gear that can be assigned to any eligible creature or the Hero — see §12. Always costs **Resources**. |

Every card can optionally carry an **Element**, a **Faction**, and —
for Hero/Creature cards — a **Race**. Faction additionally *does*
gate deck-building now, via Allegiance (§10); Element/Race remain pure
tags with no built-in rule of their own, available for a card's own
effect text to reference. Full option lists are in §8.

### 1a. Spell forms

- **Instant** — doesn't occupy a slot. Cast straight from hand for its
  Mana `cost`; effect resolves immediately; goes straight to the
  Graveyard. (Fireball, Healing Light, Counterspell, Assassinate.)
- **Ritual** — occupies one of the 4 Spell/Ability slots. Mana `cost`
  to play it into the slot; then has an activated effect with its own
  Mana `activateCost` and **unlimited** charges. Stays until destroyed
  or voluntarily **Dismissed** (a free action, straight to Graveyard).
  (Blizzard, Demonic Pact, Sacred Ground.)
- **Charged** — occupies a slot exactly like Ritual, but is printed
  with a fixed charge count. Each activation spends `activateCost`
  Mana **and** 1 charge; at 0 charges it **Fizzles** into the
  Graveyard. (A 3-charge Chain Lightning.)

Abilities only come in the Ritual/Charged shape (no Instant form) —
same slot pool, same charge rules, Energy instead of Mana throughout.

---

## 2. Resources: three pools, one job each

The three pools are scoped by **which archetype they pay for**, at
every stage of that archetype's life (playing it from hand *and*
activating it), rather than one universal "play anything" pool plus a
second activation-specific pool:

| Pool | Pays for | Refill behavior |
|---|---|---|
| **Energy** | Playing Creatures from hand. Activating Abilities. Hero Power. Tactical actions (Advance — see §5). | Refills fully to its current cap at the start of your turn. Does not carry over. |
| **Mana** | Playing/casting all Spells (Instant, Ritual, Charged) and activating them. | Refills fully to its current cap at the start of your turn. **Open default:** same refill model as Energy for now — a slower/accumulating Mana feels good thematically but adds real complexity; revisit once the rest of v2 is live. |
| **Resources** | Playing Buildings and Equipment from hand. Repairing/assigning Equipment (§12). Building activated abilities (unless a specific card's text overrides this, e.g. a Demon Gate spending Mana instead — card text can always deviate). | **Persists between turns rather than refilling to cap** — but trickles up by a flat **+1 at the start of every turn** (capped at current max), on top of whatever's left from spending or a gainCap effect. Without the trickle, spending down to 0 with no Resources-generating Building already in play was a soft lockout — nothing could ever bring the pool back up. |

All three still **start at 5, cap at 10**, and the cap is raised by
Building/Spell/Ability cards exactly as before. This split is meant to
resolve the "three pools that all just mean points" risk directly:
Energy is the Creature/tempo pool, Mana is the magic pool, Resources
is the construction/gear pool. A deck's identity comes from which pool
it leans on.

---

## 3. Ready & Exhausted

Every creature (and the Hero) has a Ready/Exhausted state:

- Enters play **Exhausted**, unless it has **Charge** (enters Ready).
- **Readies** automatically at the start of its controller's turn.
- **Attacking Exhausts** it. So does **Advancing** (§5). A creature can
  do at most one of {attack, Advance} per turn.
- Attacks are **not** paid for out of Energy — a full board of
  attackers costs nothing beyond having played them. Energy is spent
  earlier (deploying, activating, Hero Power), not on the attack
  itself.

---

## 4. The board

```
                         [   Buildings: 5 slots, one per column   ]
   [Spell/Ability] [Spell/Ability]      HERO      [Spell/Ability] [Spell/Ability]
                         [   Support: 5 slots (col 1-5)   ]
                         [   Vanguard: 5 slots (col 1-5)  ]
```
(Vanguard is drawn closest to the opponent — the front line the
opponent's attacks hit first.)

- **Vanguard** (5 slots, columns 1-5): melee-forward. Any Creature can
  go here.
- **Support** (5 slots, columns 1-5): backline. Any Creature can go
  here, but see §5 — only **Ranged** creatures can actually attack
  while positioned in Support.
- **Buildings** (5 slots): one per column, behind Vanguard+Support in
  that column. See §11 for column protection.
- **Equipment zone** (4 slots): a player-owned inventory of Equipment,
  assigned or unassigned — not tied to a board column. See §12.
- **Spell/Ability slots** (4, split 2-left/2-right of the Hero): shared
  pool for Ritual/Charged Spells and Abilities, in any mix.
- **Hero slot**: centered behind everything. Not directly placed by
  the player — the deck's chosen Hero starts the game there.

**Columns** are the vertical alignment of Vanguard slot *N* + Support
slot *N* + Building slot *N*, numbered 1-5. Columns 1 and 5 are the
**Flank** columns (§7). "Adjacent" means neighboring column, same row,
unless a card says otherwise.

A creature normally occupies exactly 1 space. **Massive** creatures
occupy more — see §5.

Spell/Ability cards and Equipment are **not attackable** by ordinary
creature attacks — only a Spell/Ability effect that explicitly targets
them (e.g. a Dispel/Sabotage-style card) can remove one early.

---

## 5. Positioning & targeting

**Who can attack:**
- A Vanguard creature can always attack (once Ready).
- A Support creature can only attack if it has **Ranged**.
- The Hero can attack once per turn if it has Equipment assigned
  (unchanged from v1).

**Reach tiers** — what an eligible attacker may target. The core idea
is a **combat ladder**: Vanguard, then Support, then Buildings/Hero.
Base attackers climb it one rung at a time as the enemy board clears;
Reach/Ranged/Infiltrate each let an attacker skip rungs.

| Tier | Can target | Notes |
|---|---|---|
| Base (no reach keyword) | Enemy Vanguard freely; enemy Support too, once enemy Vanguard is completely empty; the enemy Hero directly | Free choice among Vanguard creatures, subject to Taunt (below). Once Vanguard is empty, Support becomes the next rung — also free choice, also subject to its own Taunt — so a board of nothing-but-Support creatures is never untouchable just because the attacker lacks a keyword. The Hero has no board-population gate — it's always a legal target regardless of what's on the enemy board — but a reachable Taunt creature still has to be dealt with first, same as it gates ordinary creature-targeting. Enemy Buildings become legal per-column once that column is empty (§11), independent of the rest of the board. |
| **Reach** | + enemy Support directly | Even while the enemy Vanguard is still populated — this is Reach's actual differentiator from Base, which has to wait for Vanguard to clear first. Subject to Taunt if a Support creature has it — and a Support Taunt now also gates Hero-targeting for an attacker with Reach/Ranged, the same way a Vanguard Taunt does. |
| **Ranged** | Same reach as Reach | Plus: usable **from your own Support row** (this is what actually lets a Support creature attack at all). |
| **Infiltrate** | + enemy Buildings directly | Regardless of enemy Vanguard/Support state. Also the one thing that bypasses Taunt for Hero-targeting — an Infiltrate attacker ignores enemy row state (including Taunt) entirely. Doesn't grant Support-row targeting by itself — pair with Reach/Ranged on the same card if that's the intent. |

**Spells and Abilities are not part of this ladder at all.** A
targeted Spell/Ability effect can always reach any creature in either
row directly (subject only to its own printed target restriction —
Creature/Building/Player/Any, §7) and completely ignores Taunt. Taunt
is a *combat* restriction, not a targeting restriction in general.

**Every card can hit the enemy Hero** — that's the default, not a
special case. The only thing that narrows it is a card's own mechanical
restriction (e.g. a Spell worded "deal damage to an enemy creature" is
Creature-only by its own text) or a reachable Taunt creature standing in
the way. A Creature-/Building-restricted card with no legal target at
all (empty board on that side) is still fully playable — it just
fizzles, like a Warcry that whiffs — rather than becoming stuck unplayable
(§7).

**Taunt:** while alive, forces enemy attackers to target it first among
the creatures in *whichever row is actually being attacked* (Vanguard
Taunt gates Vanguard-tier attacks; a Support Taunt — rare, usually
granted by an effect — gates Support-tier attacks the same way, for any
attacker that can currently reach Support — Reach/Ranged always, Base
once enemy Vanguard is empty). It also gates Hero-targeting for any
attacker that can reach the row it's standing in — a Vanguard Taunt
blocks every attacker's Hero-targeting; a Support Taunt blocks
Reach/Ranged attackers' Hero-targeting always, and blocks a Base
attacker's Hero-targeting too once enemy Vanguard is empty (mirroring
the same ladder rule as ordinary creature-targeting above). Infiltrate
bypasses Taunt for Hero-targeting the same way it bypasses everything
else about enemy row state. Doesn't affect Building targeting, and
doesn't affect Spell/Ability targeting (see above — those aren't
gated by Taunt at all).

**Retaliation:** a creature-vs-creature attack is normally a trade —
both sides deal damage. **Ranged is an attacker-side privilege against
a non-Ranged defender only**: a Ranged attacker fires from outside
melee range, so a melee defender can't hit back at all — but a Ranged
defender just shoots back the same way, so two Ranged creatures trade
normally, both taking damage. It's not a blanket defensive immunity
either direction: a Ranged creature being attacked by a melee attacker
still trades damage back exactly like melee vs melee. Only the
*combination* — Ranged attacker vs. non-Ranged defender — skips
retaliation.

**Protector** (replaces the naming collision with the Guard pool —
see §7): when an enemy attack is declared against an allied creature,
if you control a Protector creature in the same row, you may redirect
the attack onto the Protector instead, before damage resolves. Reactive
and optional (defender's choice), unlike Taunt's mandatory
attacker-side restriction. **Implementation note:** the live engine
applies this automatically via a heuristic (redirects only when the
original target would otherwise die to the hit, picking whichever
eligible Protector survives it) rather than a real-time prompt to the
defending player — see the implementation-status note at the top of
this document.

**Positional keywords:**
- **Flank** — this card's printed bonus is active only while it
  occupies column 1 or column 5 (either row). Continuously
  re-evaluated as the board changes, not a one-shot trigger.
  **Implementation note:** the live engine's bonus is Attack-only
  (`flankBonus.attackDelta` on the card definition) — an HP component
  isn't implemented, since a toggling max-HP bonus raises awkward
  questions (does it also heal current HP on gain? un-heal on loss?)
  that no card has needed answered yet. Revisit if a card design
  actually calls for one.
- **Formation** — this card's printed bonus is active only while at
  least one allied creature occupies an adjacent column, same row.
  Also continuously re-evaluated. Same Attack-only implementation note
  as Flank applies (`formationBonus.attackDelta`).
- **Advance** — a Support creature may spend 1 Energy to move into an
  empty Vanguard slot **in the same column**, instead of attacking
  this turn. Exhausts it, same as attacking.
- **Push** — when this creature's attack damages an enemy Vanguard
  creature and it survives, if that column's Support slot is empty,
  move the survivor there instead of leaving it in Vanguard.
- **Massive** — occupies more than 1 space (2 by default, printed
  higher for truly enormous cards) in the **same row**, adjacent
  columns. Can't be played/can't complete a transformation into a
  Massive form without enough contiguous empty space. Occupies all of
  its columns for Building-protection purposes (§11).

---

## 6. Guard & player health

Renamed from "Militia" to the mechanically generic **Guard** — same
mechanic (a damage shield in front of the Hero's real HP), reskinned
per faction so it still reads as Militia for a Human Kingdom deck,
Legion for Demons, Heavenly Host for Angels, etc. Purely a display-name
lookup by faction (same pattern as the existing Element/Faction/Race
label maps in `src/data/taxonomy.ts`) — one mechanic underneath.

- Both players start at **100 Guard** (unchanged number from v1).
  Buildings/effects can raise current/max Guard.
- All damage aimed at the player hits Guard first; once Guard is 0,
  damage overflows into **Hero HP**. Hero HP reaching 0 ends the game.
- **Bypass Guard** (a rare Spell/Ability effect property, not a common
  keyword): damage skips Guard entirely and hits Hero HP directly
  regardless of current Guard. Reserved for a handful of powerful,
  expensive effects — not part of the base keyword pool in §7.

---

## 7. Keywords

Kept deliberately small — a universal pool, with factions layering
their own on top (§9/§10 give Heroes the hook; a full faction keyword
list is future faction-design work, not required for the v2 engine
rebuild itself).

| Keyword | Effect |
|---|---|
| **Taunt** | See §5. |
| **Warcry** | *(renamed from Battlecry.)* Label for a card with an `onPlay` trigger. If the trigger needs an explicit target and there isn't a legal one on the board (e.g. "deal 1 damage to an enemy creature" with no enemy creature out), the card is still fully playable — the Warcry just fizzles, doing nothing, rather than the card becoming unplayable (see §5). |
| **Revenge** | Label for a card with an `onDeath` trigger. |
| **Charge** | Enters play Ready instead of Exhausted (§3). |
| **Ranged** | See §5. |
| **Reach** | See §5. |
| **Infiltrate** | See §5. |
| **Protector** | See §5. *(Deliberately not called "Guard" — that name is reserved for the player's damage-shield pool in §6, and reusing it for a creature keyword was the single most confusing overlap in the original proposal.)* |
| **Armiger** | May be assigned one piece of Equipment from the zone, same as the Hero — see §12. Without this keyword, a creature can't hold gear at all. |
| **Stealth** | Cannot be chosen as the target of an enemy attack or a targeted enemy Spell/Ability. **Open default:** still hit by AOE effects (`allEnemyCreatures`) unless a card says otherwise — matches how Immune is scoped. Attacking, or being hit by a "Reveal" effect, removes Stealth permanently for that creature. |
| **Ward** | Negates the next hostile Spell or Ability that *directly targets* this creature (one-time, then consumed). **Open default:** doesn't stop AOE effects or plain combat damage, same scoping logic as Stealth/Immune. |
| **Cleave** | On attack, also deals the same damage to enemy creatures in adjacent columns, same row as the primary target. |
| **Drain** | When this creature deals combat damage, its controller's Hero regains that much Guard (capped at Guard's max — no overflow into Hero HP). |
| **Frenzy** | Unchanged from v1: taking damage and surviving permanently increases this creature's Attack by the amount taken. |
| **Immune** | Unchanged from v1: blocks hostile Spell effects from landing on this creature. Abilities and triggers are unaffected. |
| **Poison** | Unchanged from v1: a tag conventionally paired with an `onAttack` trigger that applies the Poison status (§13) to whatever was hit. |
| **Summon** | Label for a trigger whose effect creates another specified creature (new `summonCreature` effect kind — needs adding to the effects system; see §17 Phase D). |
| **Bloodied** | Label for a card whose printed effect only applies below 50% Health. **Open default:** exact trigger mechanism (continuous check vs. a dedicated `onBloodied`-style hook) gets decided when the first Bloodied card is actually authored — not needed to lock the whole engine now. |

`spaceCost` (Massive) is a numeric field, not a boolean keyword, since
it needs a magnitude — see §5.

---

## 8. Elements, Factions, Races

Unchanged from v1 — full lists live in `src/data/taxonomy.ts` and
`CARDS.md`. The one behavior change: **Faction now gates deck-building**
via Allegiance (§10). Element and Race remain pure tags.

---

## 9. Hero cards

A Hero card carries:

| Field | Notes |
|---|---|
| Faction | Drives Allegiance (§10). A Faction-less Hero has no Allegiance restriction at all. |
| Class | Fighter / Mage / Rogue — a deckbuilding *identity*, not a strict profession. Fighter = direct confrontation (knights, barbarians, paladins, monstrous bruisers). Mage = supernatural manipulation (wizards, priests, necromancers, witches). Rogue = indirect warfare (archers, assassins, scouts, spies, duelists) — archers live here, not under Fighter. |
| Health, Attack | Attack only matters once Equipment is assigned (unchanged from v1) — but a Hero's own base Attack should now be **low or 0**, since a Weapon's `attackBonus` is meant to be the primary source of a Hero's Attack, not a bonus layered on top of an already-large base. **Open default / known exception:** the three original starter Heroes (Fighter 10, Mage 20, Rogue 15 base Attack) predate this convention and haven't been retconned — they still hit hard the moment *any* Equipment is assigned, weapon or not. Revisit those three numbers whenever they're touched again; every faction Hero authored from here on should follow the low/0-base convention. |
| Passive | An always-on effect. **Open default:** built from a small curated set of templates (aura buff to a matching Faction/Race/Class, a first-spell-cheaper-per-turn discount, an on-reveal-enemy-card effect, etc.) rather than a free-form scripting language — matches how `CardEffect` is already a fixed set of `kind`s, not arbitrary code. The template set grows as new Heroes need new patterns. |
| Hero Power | An activated effect using the same `CardEffect` shape as a Spell/Ability, Energy-costed, usable **once per turn** (not charge-based). |
| Signature Ability *(optional)* | Same shape as Hero Power, but a stronger effect gated to a small number of uses **per match** (e.g. 1) instead of per turn. |
| Rule-Breaks *(optional, Legendary-tier)* | A curated menu of numeric deltas a Hero can carry: extra Spell slots, extra Building slots, Vanguard/Support slot count changes, starting Guard delta, max Energy/Mana/Resources cap delta. **Open default:** only numeric-delta modifiers are supported at first; a fully bespoke rule-break (e.g. "Harpies may overfill Support by forming Flocks") is one-off card-specific code, done when that specific card is actually built, not a general system. |

**Example Signature Ability — Raise Dead** (a Necromancer-archetype
Mage Hero): reveal the top 3 creatures in your Graveyard; play one of
them for free into an empty Vanguard/Support slot, then either shuffle
the remaining two into your Deck or return them to the Graveyard
(your choice). This is a targeted recall effect triggered by the Hero,
usable any time during the match — it has nothing to do with the
empty-deck reshuffle in §15, which never touches the Graveyard for
any Hero.

Pulling a new Hero should feel like unlocking a new deck archetype, not
just a different HP number — that's the point of Passive/Power/
Signature existing at all.

---

## 10. Allegiance & faction deckbuilding

- A deck's **primary Faction** is set by its Hero.
- A deck may contain: any card whose Faction matches the Hero's
  Faction, plus any **Neutral** card (Faction field simply omitted —
  no separate "neutral" enum value needed, matches the existing
  optional `faction` field). Neutral cards never break Allegiance for
  any Hero, by construction.
- A Faction-less Hero (no Faction set) has **no restriction** —
  functions like today's fully-open deckbuilding.
- Some Heroes explicitly bend this, via an optional `allegiance` grant
  on the Hero card:
  - `extraFactions`: additional Factions allowed alongside the Hero's
    own (a Diplomat/Cultist-style Hero).
  - `neutralRaces`: creatures of a listed Race count as in-Faction
    regardless of their own Faction tag (a Beastmaster + Beast, a
    Packmaster + Wolves).
  - `unrestricted`: no Faction restriction at all despite having a
    Faction (a Mercenary Captain).
- A Hero's own Passive can *also* react to how pure the deck's
  Allegiance is (e.g. "+1 Health to Faction creatures if ≥80% of your
  non-Neutral deck matches your Faction") or invert it entirely (a
  Temptress: "-1 Attack to your own Faction, +2 Attack to everyone
  else's Faction while under your control") — these are just Passive
  templates (§9), not a separate system.

The Deck Builder enforces Allegiance at save/validate time; an invalid
deck can't be taken into a match.

---

## 11. Buildings as battlefield objects

Every Building has:
- **Resource cost** (to play, like any card).
- **Durability** (an HP pool — Buildings are attackable, not passive
  scenery).
- A **passive** and/or an **activated** ability (Resources-costed by
  default; a specific card's text can spend a different pool, e.g. a
  Demon Gate spending Mana).
- An optional **On Construction** trigger (fires like Warcry, the
  moment it's played).

**Column protection:** a Building can only be attacked once **both**
the Vanguard and Support slots in its own column are empty — matches
the "protected while allied characters occupy its column" idea. A
specific effect (Siege-tagged damage, a Sabotage/Fire spell, an
Infiltrate attacker) can say it ignores this, same as any other
card-text override elsewhere in this doc.

A destroyed Building goes to the Graveyard, like a destroyed creature,
and its bonus is gone for good.

---

## 12. Equipment

Hero-exclusive by default. Ordinary creatures can't hold gear unless a
card specifically grants that — diluting Equipment down to "any
creature can hold anything" made it feel less special, not more:

- **4 Equipment slots** — a player-owned inventory zone, not a board
  column. Each slot holds one Equipment card, either **assigned** to
  an eligible bearer or sitting **Unassigned**.
- **Eligible bearers**: the Hero, always. A Creature is only eligible
  if it has the **Armiger** keyword (§7) — a plain Footman can't equip
  anything, but a "Footman, Armiger" printing could be handed a
  Legendary Battle Axe and become a real threat. Armiger is a keyword
  like any other — most creatures don't have it.
- Playing an Equipment card from hand costs Resources and either
  assigns it immediately to a chosen eligible bearer, or leaves it
  Unassigned in the zone for later.
- **Categories**: Weapon, Armor, Accessory, Mount — tags on the
  Equipment card. A bearer can optionally restrict which categories it
  can hold (e.g. a Warhound Armiger: Accessory only; a Knight:
  Weapon/Armor/Mount).
- **Open default:** each eligible bearer can hold **at most 1**
  equipped item at a time in this pass (not one-per-category
  simultaneously) — keeps the first build tractable. Multiple
  simultaneous equipped items per unit is a reasonable future
  refinement, not required now.
- **Assigning or reassigning** an Equipment card to a (new) bearer
  costs 1 Energy, as an action.
- **Survives death**: when a bearer dies, its Equipment doesn't vanish
  — it returns to Unassigned in the zone, ready to be reassigned to
  any other eligible bearer later. Equipment is only actually
  destroyed by an effect that targets it directly, or discarded
  outright if the zone is full and nothing can be freed.
- The Hero specifically still **requires an assigned weapon-eligible
  Equipment to attack at all** (preserves the v1 hook) — Equipment on
  an Armiger creature is a bonus, not a gate; that creature can already
  attack normally without it.
- **Weapon is the primary source of a Hero's Attack** (§9) — a
  Hero's own base Attack should be low/0, with the equipped Weapon's
  `attackBonus` doing most of the work. Armor/Accessory/Mount pieces
  are expected to mostly grant Health, damage reduction, or utility
  effects rather than Attack, though nothing in the engine enforces
  that split yet (categories themselves land in Phase F).

---

## 13. Status effects

Unchanged from v1 — intentionally simple, a nod to the Pokemon TCG
rather than a full elemental chart:

- **Burn**: fixed damage at end of each of the affected unit's
  controller's turns, for a fixed number of turns, then expires.
- **Poison**: same, but persists until cured or the unit dies (no
  automatic expiry).

Both can affect creatures, Buildings, or a player's Guard/Hero HP
depending on the source card.

---

## 14. Turn structure

1. **Draw phase:** draw 1 card. Refill Energy and Mana to their
   current caps (Resources does **not** refill — it persists, §2).
2. **Main phase:** play any cards you can afford, activate any
   already-slotted Spells/Abilities, use your Hero Power (once), in
   any order.
3. **Combat phase:** declare attacks with any Ready, eligible attacker
   (Vanguard creatures, Ranged Support creatures, an equipped Hero),
   following §5's reach tiers.
4. **End phase:** Burn/Poison tick down and deal damage; "end of turn"
   triggers resolve; all your creatures/Hero **Ready**; turn passes.

---

## 15. Deck, hand, and card flow

Unchanged from v1, plus Allegiance validation (§10):

- **Deck size:** exactly 30 cards, no copy-count restriction.
- **Piles:** Deck → Hand → Discard (voluntary/one-shot spends) or
  Graveyard (destroyed creatures/Buildings, Fizzled Charged Spells —
  permanently gone).
- **Empty deck:** shuffle Discard back into a new deck. **Graveyard is
  never part of this reshuffle, full stop, for every Hero** — that
  part of the rule has no exceptions. No fatigue damage.
- Separately (and unrelated to the reshuffle above), a Hero or Spell
  can have its own effect that reaches into the Graveyard and pulls
  specific cards back into play mid-match — that's a targeted recall
  effect, not a change to how empty-deck reshuffling works. See §9's
  Raise Dead example for a Necromancer-archetype Hero.
- Starting hand 4, one-time mulligan, max hand size 10, second player
  draws an extra card turn 1 — unchanged Open defaults from v1.

---

## 16. Board-space-as-resource (later-phase content layer)

Documented now so future card design has a target, but **not required
for the v2 engine rebuild** (§17 Phase E+) — these are card-effect
patterns layered on top of a working positional board, not core rules:

- **Swarm**: effects that create several small units at once, filling
  the board fast.
- **Consume**: destroy an allied creature to free its slot and empower
  another (an explicit new effect kind).
- **Garrison**: place a creature *inside* a Building instead of
  occupying a battlefield space (needs a Building-side "housed
  creature" slot concept).
- **Mount**: two creatures merge into one board position (needs a
  composite-creature-instance concept).
- **Transformation**: a card becomes a different, larger card in place
  — e.g. a Massive upgrade that requires contiguous empty space to
  complete, per §5.

---

## 17. Prototype scope & implementation phases

- **Platform:** unchanged — TypeScript + React + Vite, optional
  Supabase backend, local hot-seat or vs. a heuristic AI. No live
  networked multiplayer yet.
- **AI opponent:** the greedy heuristic now has basic position-
  awareness from Wave B1 (places Ranged creatures into Support, picks
  targets by reach tier, opportunistically hits column-clear
  Buildings). Advance and Building-defense judgment are still open —
  scoped into Wave B2, which introduces the mechanics they need.

Suggested build order, each phase individually shippable/testable:

| Phase | Scope |
|---|---|
| **A — Foundation** ✅ *(live)* | Board reshape (Vanguard+Support+columns), the 3-pool resource-by-archetype split, Ready/Exhausted, Guard rename (+ faction display labels), base reach-tier targeting (no Reach/Ranged/Infiltrate yet — just Vanguard-first, matches v1's existing chain shape). |
| **B1 — Reach & position, wave 1** ✅ *(live)* | Reach, Ranged, Infiltrate keywords and the full targeting chain they unlock (§5). Deliberate Vanguard-vs-Support placement on play. Support creatures can attack if Ranged. Column-based Building protection (§11). Hero-targeting has no board-population gate — every attacker can always reach the Hero, gated only by a reachable Taunt creature (Infiltrate bypasses that too). Target-restricted Warcries/Spells with no legal target just fizzle instead of making the card unplayable. |
| **B2 — Reach & position, wave 2** ✅ *(live)* | Protector, Flank, Formation, Advance, Push, Massive. Protector's redirect is heuristic-automatic rather than a live prompt (see the implementation-status note above); everything else matches this section as written. |
| **C — Spell forms & Hero rework** ✅ *(live)* | Instant/Ritual/Charged split for Spells. Hero Passive/Power/Signature. Allegiance deckbuilding validation. See the implementation-status note above for the discard-vs-graveyard deviation and Allegiance's currently-inert status. |
| **D — Keyword expansion** ✅ *(live)* | Stealth, Ward, Cleave, Drain, Bloodied, Summon (+ the `summonCreature` effect kind), Warcry rename. See the implementation-status note above for scoping details and the loadCustomCards.ts validator fix. |
| **E — Buildings as objects** ✅ *(live)* | Durability/attackability, activated abilities, On Construction triggers, enemy interaction (Siege/Sabotage). Durability/column-protection/Graveyard/On Construction were already live from earlier phases; this wave added the passive (auraBuff-only) and activated ability (no usage cap). Siege/Sabotage-style "ignore column protection" effects remain spec-only — no card exercises that escape hatch yet. See the implementation-status note above. |
| **F — Equipment rework** | 4-slot zone, categories, assign/reassign for Energy, survives-death/Unassigned flow. |
| **G — Board-as-resource (§16)** | Swarm/Consume/Garrison/Mount/Transformation, plus Hero Rule-Breaks (§9) once there's enough of the rest in place to make rule-breaking meaningful. |

Each phase gets the same verification pass as prior work: `tsc
--noEmit`, `eslint`, `vitest`, `vite build`, plus a Playwright smoke
pass against the dev server before it's called done.

---

## 18. Card collection, packs, and custom decks

Unchanged from v1 in spirit — Collection/Coins/Packs/Deck Builder — with
one addition: the Deck Builder now validates Allegiance (§10) against
the chosen Hero before a deck can be saved/played. Rarity, pack odds,
card art normalization (512×776), and the admin panel are all
otherwise unaffected by this rework and stay as documented in
`CARDS.md`/`BACKEND.md`.
