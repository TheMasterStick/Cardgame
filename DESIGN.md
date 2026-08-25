# Card Game Design Document (v2)

A browser-based card game blending **Hearthstone** (mana curve,
hero-focused combat), **Gwent** (row-based board, on-field persistent
spell/ability "items", building-driven economy), and the **Pokemon
TCG** (simple status conditions instead of a full elemental chart).
This document is the single source of truth for the target ruleset.

> **Documentation cleanup (post-Phase K):** the detailed rules sections below have been reconciled to the Phase K implementation notes. `CARDS.md` remains the exact authoring/schema reference. Items explicitly marked **Planned** are not live engine behavior yet.

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
other way around; (2) Allegiance was correctly built and unit-tested
here, but sat inert in play through Phases D-I since none of the three
starter Heroes carried a `faction` tag and only one card
(`arcane-golem`) did — **the Phase J cleanup pass below made it a real,
live restriction**: a new Hero, `archivist` (`faction:
"arcane-industries"`), ships with an actual 30-card starter deck built
around it, so Allegiance now genuinely gates what a real deck can
contain instead of only being provable with synthetic test fixtures.
The three starter Heroes' base Attack numbers (10/20/15) were left exactly as they were
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
Bloodied landed as a keyword label only in this pass, per its own §7
"Open default" note — its trigger mechanism wasn't decided until the
Phase H cleanup below authored the first card that needed it.
Separately, this pass also fixed `src/data/loadCustomCards.ts`'s
keyword validator (it guards
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
Mana, summon a Flame Imp).
**Phase F is also live**: the Equipment rework (§12) — a real 4-slot
Equipment zone (`board.equipment: (CardInstance | null)[]`, length 4)
replaced the old single always-Hero slot, each item either sitting
Unassigned or equipped to a bearer (the Hero, or a Creature with the
new **Armiger** keyword). `EquipmentCategory` (`weapon` | `armor` |
`accessory` | `mount`) landed as a required field on every Equipment
card — the Hero specifically now needs an assigned **Weapon**
specifically to attack at all, not just any item (Armor/Accessory/
Mount alone no longer unlocks it, a real behavior change from pre-
Phase-F: `battle-shield`, an Armor item, used to say "Your Hero can
attack" and no longer does). One deliberate simplification: DESIGN.md
allows a card played from hand to assign to a bearer immediately for
free as part of the play; that path isn't built — an Equipment card
always enters the zone Unassigned when played, and the single paid
1-Energy `assignEquipment` action (`src/engine/equipment.ts`) covers
both a first assignment and any later reassignment, with no separate
free fast path. Each bearer holds at most 1 item (the section's own
"Open default"): assigning a second item to an already-equipped bearer
auto-bumps the old one back to Unassigned in the zone rather than the
action being refused — DESIGN.md doesn't specify swap semantics, and a
refusal seemed like worse UX than a bump for no extra cost. A bearer's
Equipment survives its death, returning to Unassigned rather than
being destroyed, matching this section's text exactly. Category-based
bearer restriction ("a Warhound Armiger: Accessory only") is **not**
enforced — moot for now since every bearer can only hold 1 item total
regardless of category, so nothing yet needs the restriction decided.
`damageCard`/`damagePlayer`/`damageHeroDirect` (in `effects.ts`) were
generalized in the same pass to look up whichever bearer they're
hitting (Hero or Armiger creature) instead of only ever checking the
Hero, and now return the actual post-reduction damage dealt instead of
`void` — Drain and Frenzy both switched to using that returned value,
fixing a latent inaccuracy where a Drain attacker or a damaged
Frenzy creature would react to the raw pre-Armor attack number instead
of what was actually dealt (harmless before Phase F, since nothing
could reduce a creature's incoming damage yet). Example cards:
`royal-squire` (a vanilla Armiger creature) and `steel-barding` (a
generic Armor item any Armiger bearer — Hero or creature — can wear).
**Phase G is also live, in part**: three of the five Board-as-resource
patterns (§16) — Swarm, Consume, Transformation — plus Hero Rule-Breaks
(§9), the mechanism only. Swarm is just `summonCreature`'s `count`
field (default 1): each copy re-checks for room, so a partly-full
board still gets as many as fit instead of an all-or-nothing fizzle.
Consume (a new `consume` CardEffect) destroys a targeted ally —
bypassing its own Armor/damage-reduction entirely, since this is a
self-inflicted sacrifice by its own controller, not a hostile hit —
then permanently buffs every other creature its controller still has
on board. Transformation (a new `transform` CardEffect) replaces a
targeted ally in place with a different named creature, carrying its
exhaustion/summoning-sickness state and statuses forward (it's the
same unit, just bigger) while resetting its stat deltas to the new
form's own base stats, and fires the new form's `onPlay` trigger on
the way in — matching `summonCreature`'s own precedent for "entering
the battlefield" outside a literal hand-play. A Massive new form
fizzles cleanly, leaving the original creature untouched, if there's
no contiguous room for it in the same row (`findTransformSlots` in
`board.ts`, reusing `findOpenContiguousSlots` with the transforming
creature's own slot(s) counted as already vacated). Example cards:
`wolf-pack` (Swarm — three Young Wolves), `blood-sacrifice` (Consume),
`alphas-call` (Transformation, into the new Massive `alpha-wolf`) —
all three live in the Rogue starter deck as a demonstrable combo.
Hero Rule-Breaks (`HeroCardDefinition.ruleBreaks`, applied once in
`createInitialPlayerState`) can resize the Vanguard/Support/Building/
Spell-Ability arrays and adjust starting Guard and the three pool
caps. **Mount is cut — not part of this game.** It would have needed a
genuinely new state-shape concept (a composite-creature-instance
format: how do two merged creatures share one board position, one
Attack/HP, one set of keywords?), and a deliberate decision was made
not to build it: the existing 4-slot Equipment zone (§12, which
already has its own `mount` Equipment *category* — a wholly different,
already-shipped thing, not to be confused with this cut mechanic)
covers the "ride/gear up a unit" space well enough on its own.
**A follow-up cleanup pass (call it Phase H) closed three gaps this
doc had flagged, none of which needed new design decisions:**
(1) Bloodied's trigger mechanism was left open in Phase D ("decided
when the first Bloodied card is actually authored") — it's now a
`bloodiedBonus: PositionalBonus` field on `CreatureDefinition`, live-
recomputed in `getEffectiveCreatureAttack` exactly like Flank/Formation
(active whenever `currentHp * 2 <= maxHp`, no board-position needed so
it still applies off-board), demonstrated by `wounded-berserker` (base
2/6, +4 Attack once at half Health or below). (2) Hero Rule-Breaks now
has a shipped card exercising it — `grand-marshal`, a Legendary Hero
with `vanguardSlotDelta: 1, supportSlotDelta: 1` (a wider battlefront),
engine-tested end to end via `createInitialGameState`. (3) The
Siege/Sabotage "ignore column protection" escape hatch this doc's
Phase E row called spec-only was actually already live and tested
since **Phase B1** — Infiltrate already bypasses column protection for
Building attacks (`shadow-infiltrator`, tested in `combat.ts`'s
`validateTarget`), and Spells/Abilities targeting a Building were never
subject to column protection in the first place (`targeting.ts` never
checks it) — that Phase E note was simply stale, not a real gap; no
code changed for this third item, just the documentation.
**Garrison is also live (call it Phase I)**: a new `garrison` CardEffect
moves a targeted friendly creature off the battlefield into the first
friendly Building with an open "housed creature" slot
(`CardInstance.garrisonedCreature`) — the Building-side state-shape
concept §16 called for, resolved in the end as a single-target
CardEffect exactly like Consume/Transform rather than a bespoke new
player action, so it reuses all the existing targeting/pending UI
plumbing for free. A garrisoned creature can't attack, be attacked, or
be targeted by anything — it isn't in any board row array, so the
existing combat/targeting code simply can't see it, no new exclusion
checks needed anywhere. It's ejected back onto the battlefield (or
destroyed, if there's no room) when its Building is destroyed
(`killCardIfDead`). Fizzles if no friendly Building has room, same
"Warcry with no legal target" philosophy as everywhere else. **Open
default:** every Building can house at most 1 creature, no per-Building
restriction (matches Equipment's 1-item-per-bearer cap); there's no
manual un-garrison action in this pass, only ejection on the Building's
death. Example card: `garrison-post` (an Ability, 1 Energy), in the
Fighter starter deck. Mount is cut, not deferred — see above.
**Phase J made Allegiance a live restriction, not just a tested
mechanism:** `archivist`, a new `faction: "arcane-industries"` Hero,
ships with a real 30-card starter deck (`ARCHIVIST_DECK` in
`decks.ts`) built from `arcane-golem` (pre-existing) plus three cards
retagged/added into the Faction — `arcane-sanctum` and
`arcane-missiles` (both pre-existing, just newly tagged) and
`arcane-turret` (new) — mixed with Neutral filler. Retagging two
already-shipped cards into a Faction is safe by construction: a
Faction-less Hero (the three original starters) has no Allegiance
restriction at all, so nothing already in Fighter/Mage/Rogue's decks
became illegal. Archivist's Passive uses `auraBuff`'s `{faction}`
filter for the first time (previously only `{race}` and `"all"` had a
real card), Hero Power draws a card, Signature raises max Mana.
**Phase K adopted an external, authoritative "Neutral Core Set" spec** —
three documents the user supplied (59 mechanically-defined cards:
34 Creatures, 10 Buildings, 6 Spells, 6 Abilities, 3 Equipment) — as
the source of truth for every card in that set, on top of the engine
built through Phase J, which the user explicitly asked to leave alone
rather than reconcile against the new spec. **The card art itself is
now the card face**: every non-Hero archetype's art already bakes in
name/cost/rarity/type/rules text/stats, so the UI no longer draws a
frame or text overlay for Creature/Building/Spell/Ability/Equipment —
only *live* state that can't be baked into a static image (current
Attack/HP, status badges, Spell/Ability charges remaining) renders on
top of the art, at every size (compact/full/zoom). Hero art stays bare
character art by original design (Guard/Health/Attack come from
Equipment, not the art), so Hero is the one archetype that still shows
a text layout. `src/data/cardFrames.ts` and its `card--framed`/
`frame__*` CSS were removed as dead code once nothing referenced them.
`arrow-archer` (id kept stable for existing deck references) is now
just displayed as "Archer".

> **Superseded going forward, kept as a supported legacy path (see §20).**
> The Phase K assumption above — that every non-Hero card's art is a
> single fully-baked static image with only live stats overlaid — was
> the deliberate design at the time, but the user has since moved to
> the layered Card Builder as the actual card-creation workflow, for
> exactly the reason Phase K's overlay already existed: card stats need
> to change (balance passes, Specialization/Building auras, live combat
> state) without repainting art. The Builder composites card border +
> **default/printed** stats onto the user's raw artwork as separate
> layers instead of baking them in; the live in-game overlay's job
> (current HP, buffs, charges) doesn't go away — it still renders on
> top of whichever face a card uses, baked or layered. Every card
> shipped through Phase K's baked-art pipeline remains fully valid and
> is not being retired or rebuilt on any deadline — the two rendering
> paths coexist by design (§20) while the collection converts
> gradually.

New mechanics landed to match the spec's keyword glossary, each
following the project's existing "live-recompute vs. permanently-
stored vs. attack-instance-scoped" bonus taxonomy (§5/§7) rather than
inventing a fourth pattern where an existing one already fit:
**Vanish** replaces **Stealth** outright (same untargetable-by-
targeted-Spell/Ability/attack behavior, but the old "breaks once this
attacks" condition is gone — the user's explicit call when Stealth and
the spec's Vanish turned out to be the same keyword under two names);
**Enrage** (Berserking Ogre) is live-recomputed Attack equal to
current missing HP, so healing brings it back down and it's never
stored on the `CardInstance` — this absorbed the *keyword name*
"frenzy" freed up by the next mechanic; **Frenzy** (Cimbar Berserker,
a new, different card from the one that used to hold this keyword) is
a permanent +Attack stored via `attackDelta`, applied once per
declared attack regardless of whether the hit lands or the target
survives; **Resistant** (Stone Golem) is a flat per-hit damage
reduction on the defender's own `CreatureDefinition`, additive with
any bearer Armor, floored at 0 in `damageCard`; **Deadeye** (Longbow
Sniper) is the one genuinely new bonus *shape* — attack-instance-
scoped, not live-recomputed and not permanently stored, added only
while resolving one specific attack against a Backline target;
**Double Strike** (Golden Company Captain) tracks
`CardInstance.attacksUsedThisTurn` internally while every other caller
keeps reading `hasAttackedThisTurn` as "exhausted" exactly as before;
**Duel** (Lorthaine Elite Veteran) is deliberately bespoke, single-card
logic (`declareDuelMark` in `combat.ts`) rather than a generic
CardEffect — matching the project's existing Hero-Rule-Breaks
precedent that a one-off mechanic is one-off code, not a new system —
marking one enemy creature (`CardInstance.markedTargetId`) grants a
live Attack/HP bonus and an Infiltrate-equivalent targeting bypass
(Vanguard ladder + Taunt) while the mark holds, with no explicit
cleanup needed when the marked creature dies since the live lookup
just stops finding it; **Crowd Pleaser** (Pit Fighter of Klamet) is a
live, capped Attack/HP bonus scaled by other creatures currently on
the board — **Open default:** both sides count (the spec just says "on
the board," no "friendly" qualifier); **Bleed** and **Burn-on-hit**
(Grey Wolf, Fire Golem) reuse the exact onAttack-trigger pattern Plague
Rat's Poison always should have used — which surfaced a genuine
pre-existing bug: `fireOnAttackTrigger` was fully built but never
actually called from `declareCreatureAttack`, so Poison-on-hit had
never fired in real play since the keyword was introduced; it's wired
in now, firing against whichever creature actually took the damage
(honoring a Protector redirect) and only when a hit actually lands.
**Freeze** is a new control status (`StatusType`, amount always 0) that
gates `creatureCanAttack`/`heroCanAttack`/Advance/Duel-activation via a
shared `isFrozen` helper in `status.ts`; `status.ts`'s tick/duration
logic was generalized from "only Burn decrements" to "any status with
a `turnsRemaining` decrements," so Poison/Bleed/Burn/Freeze all now
carry an explicit duration the same way instead of Poison being the
one that persisted forever. **Formation became type-conditional**: a
new `creatureType?: CreatureType[]` field (Fighter/Ranger/Defender/
Beast/Elemental/Mage/Ogre/Giant/Dragon/Support/Creature — printed as
e.g. "Defender • Elemental" for a dual-typed card, stored as an array)
replaces the old any-adjacent-ally check with "shares a `creatureType`
tag with the neighbor," a deliberately separate field from the
existing `Race` (which still only drives Faction/Allegiance and aura
filters — the two systems don't cross-reference each other). Farm/Gold
Mine's "+N Resource income per turn" needed a genuinely new concept
distinct from the existing cap-raising `gainCap`: `ResourcePool.income`
(defaults to 1, matching the pre-existing hardcoded regen) and a new
`gainIncome` CardEffect that raises it permanently. Recruitment
Station's "draw a creature" is a new `drawCreature` CardEffect (finds
the first creature card in the deck, not necessarily the top card);
its "2 total activations" needed `BuildingActivatedAbility.charges`, a
concept Buildings never had before (unlike a Spell/Ability's charges,
the Building itself stays on the board once its ability runs out, only
the activation stops working) — reusing `CardInstance.chargesRemaining`
rather than adding a parallel field. Elder Flame Imp's "destroy target,
gain half its printed stats" needed a new `devour` CardEffect plus a
`resolveEffect(..., selfInstanceId)` parameter (threaded through every
onPlay-trigger call site) so the effect can identify *which* creature
its own trigger belongs to — the first real use of the "self" concept
the `EffectTarget` union had a placeholder for but nothing used yet.
Frost Nova's "damage + Freeze" needed a `multi` CardEffect that just
resolves a list of sub-effects against the same target/source in
order — **scope note:** every sub-effect used this way must be one
that doesn't need its own separate UI target selection (Frost Nova's
two sub-effects are both `allEnemyCreatures`), not a general multi-
target system. Fixing this surfaced a second genuine pre-existing bug:
`applyStatus`'s CardEffect resolution never had an `allEnemyCreatures`/
`allFriendlyCreatures` branch at all (unlike `damage`/`buff`, which
always did), so an AOE status effect silently did nothing before this
pass. Black Dragon's "choose Vanguard or Backline, damage that row"
needed a new `targetRow` `EffectTarget` and a matching
`{kind:"row"; owner; row}` `EffectTargetRef` variant. Lightning Bolt/
Renewal/Toxic Cloud's "creature or Hero, never a Building" needed a new
`targetCreatureOrPlayer` `EffectTarget`, wired through `targeting.ts`'s
UI click-restriction the same way the existing `targetCreatureOrBuilding`
already was. Ancient Mage Tower's "+2 to every instance of damage/
healing from your Spell cards" is a new `BuildingDefinition.spellAmplify`
field, applied inside `resolveEffect` whenever `sourceArchetype ===
"spell"` — **Open default:** the bonus is baked into the amount once,
at the moment the Spell's effect resolves (including into a Poison/
Bleed/Burn status's stored `amount`, so its remaining ticks keep the
bonus), rather than re-checked live on every future status tick if the
Tower is later destroyed mid-effect — the simpler of two readings the
spec's own worked example left ambiguous. Abilities gained the same
Instant/Activated split Spells already had (`abilityForm`) so Exercise
and Executioner's Strike (both "On Play," no separate activation step)
fit the existing Spell-form pattern instead of a new one; Focus and
Rally's un-printed use counts default to unlimited (an explicit "Open
default," per the spec's own "don't invent a number" instruction).
Equipment gained `keywords?: Keyword[]` (Cloak of Shadows grants the
Hero Vanish while equipped, checked via a new `heroHasVanish` rather
than the existing creature/building-only `hasKeyword`) and `charges?:
number`, decremented once per Hero attack while equipped
(`tickEquipmentChargesOnHeroAttack`) and auto-discarding at 0 — a
generalized mechanism, not hardcoded to the one card that needs it
today. Two spec-mandated stat/effect corrections worth calling out
since they're easy to miss in a diff: Iron Sword's printed +2 Attack
had never actually been wired into `attackBonus` (silently 0 since it
shipped), and Cloak of Shadows previously carried a +3 Attack bonus
the new spec doesn't give it at all (Vanish + charges only) — both
fixed to match the spec exactly. `getEffectiveCreatureMaxHp` (new,
`combat.ts`) is a display-only overlay for Crowd Pleaser/Duel/
Formation's optional HP components — `currentHp`, death checks, and
`healCard`'s cap are computed from base HP only and never consult it,
so losing a live bonus can never retroactively kill a creature; it's
exported for the UI but not yet wired into a display that shows a
live max alongside current HP (today's corner-badge layout only has
room for one HP number, so this is a known gap, not a design decision).
**Two more known gaps, both flagged rather than silently shipped:**
Duel's activation (`declareDuelMark`) has no player-facing UI button
yet — the AI uses it, a human can't trigger it through the interface
in this pass; and Bulletin Board's "look at the top 3, keep 1, bottom 2
in any order" is approximated as a plain extra draw, since a genuine
reveal-then-choose interaction doesn't exist anywhere in the engine
yet and building one is a bigger investment than this one Common card
justifies on its own. Starter decks were **not** reworked to weave in
the 11 new cards (Line Infantry, Grey Wolf, Fire Golem, Golden Company
Captain, Pit Fighter of Klamet, Frost Golem, Lorthaine Elite Veteran,
Elder Flame Imp, Black Dragon, Ancient Mage Tower, Warhorn of
Gestmane) beyond the one mandatory fix (`call-to-arms`, a pre-spec
placeholder Building, replaced by `warhorn-of-gestmane` in the Fighter
deck since both did "gain Guard at start of turn"); every new card
exists and is fully functional but most are only reachable via the
Deck Builder or Admin Panel, not a starter deck, in this pass. The
Fighter/Mage/Rogue Hero cards were explicitly left untouched — the
spec itself says their stats aren't finalized yet and says not to
invent them.

**Phase L landed the first two taxonomy items from ROADMAP.md** (#5
multi-race support, #6 explicit Hero Class + `rogue` CreatureType) — the
two items the August documentation review flagged as "planned
engine/schema change," now live. `race?: Race` became `races?: Race[]`
on every card (`CardDefinitionBase`): a dual-nature creature (Human +
Angel, etc.) no longer needs bespoke text, and the two consumers that
matched against it — `auraBuff`'s `{ race }` Passive filter and a Hero's
`allegiance.neutralRaces` grant — both now check *array membership*
(`def.races?.includes(filter.race)`, `card.races?.some(r =>
neutralRaces.includes(r))`) instead of a single equality check, so a
dual-race creature matches either aura or either listed neutral Race.
The 8 existing cards that had `race: "X"` were migrated to `races:
["X"]`; nothing needed more than one entry yet. A new `HeroClass =
"fighter" | "mage" | "rogue"` type backs a **required** `class` field on
`HeroCardDefinition` — required rather than optional, since an optional
field nobody's forced to fill in would defeat the point of finally
making Class a real declared thing instead of prose-only; all 5 existing
Heroes were assigned one (Fighter→fighter, Mage→mage, Rogue→rogue,
Grand Marshal→fighter — a wide-battlefront martial commander, Archivist
→mage — an arcane scholar). Purely descriptive today, same as Race/
Element until a card's own effect keys off it — no mechanic reads it
yet, matching the "Open default" the roadmap called for. `rogue` was
added to `CreatureType`, and the two cards CARDS.md's own text named as
"obvious future candidates" — `assassin` and `shadow-infiltrator` — had
their `creatureType` retagged from `["fighter"]` to `["rogue"]`, since
that's a strictly more accurate read of their actual identity
(infiltration/assassination/evasion) than the generic Fighter tag was.
Both fields flow through the Admin Panel now too: the old single-select
Race dropdown became a multi-checkbox list (mirroring the existing
Keywords checkboxes) driving `races: Race[]`, and a new Class dropdown
appears for Hero drafts. On the Supabase side, `race` stops being its
own dedicated column — like every other array-valued field (keywords,
creatureType), `races` now lives in the `data` jsonb blob instead;
migration `0004_multi_race.sql` folds any existing single `race` value
into `data.races` as a one-element array before dropping the column and
its check constraint. **Fixed a genuine pre-existing bug found while
touching this path**: `loadCustomCards.ts`'s `validateCard` — the
function `adminCards.ts`'s `fromRow` calls to turn a fetched Supabase
row back into a `CardDefinition` — never actually included `element`,
`faction`, or the old `race` in its returned object at all, only
`id`/`name`/`cost`/`rarity`/`text`/`art`. That meant any Element/
Faction/Race set through the Admin Panel was silently discarded the
next time `fetchRemoteCards()` ran (e.g. on a page refresh) even though
it was correctly saved to its Supabase column — the round-trip was
broken, not just the write path. All three are now parsed and validated
(against the same enum lists CARDS.md documents) in `validateCard`
itself, so this fixes the bug for both the Supabase-Admin path and the
`customCards.json` path (which had the identical gap — a hand-authored
custom card's `element`/`faction`/`races` were quietly dropped too).

**Phase M landed ROADMAP.md #7**, the temporary-modifier/duration
primitive flagged as the highest-leverage missing piece for converting
`FACTIONS.md`'s many "this turn"/"until your next turn" cards. `buff`
(the existing permanent Attack/HP-change `CardEffect`) gained an
optional `duration?: number`: omit it for the original permanent
behavior; give it a number and the same effect becomes temporary
instead. A temporary buff is pushed onto a new
`CardInstance.temporaryModifiers: TemporaryModifier[]` array rather than
touching the permanent `attackDelta`/`hpDelta` fields, summed live into
`getEffectiveCreatureAttack`/`getEffectiveCreatureMaxHp` (the latter
display-only for `hpDelta`, exactly like Formation/Duel/Crowd Pleaser's
optional HP component — never mutates `currentHp`, never affects death
checks). The interesting design decision was the *tick timing*, and it's
deliberately different from how Poison/Bleed/Burn/Freeze already work:
a Status ticks only at the *affected creature's own controller's*
turn-end (`tickStatuses`, called from `processEndOfTurnStatuses` for
just `state.activePlayer`'s board), which is exactly right for a
DOT/control condition but wrong for "this turn" — a hostile "this turn"
debuff cast on an enemy during your turn would otherwise still be sitting
there for their *entire following turn*, since their board doesn't get
ticked until *their* turn ends. A temporary modifier instead ticks via a
new `tickTemporaryModifiers` (status.ts) called from a new
`processEndOfTurnTemporaryModifiers` (game.ts) that sweeps *both*
players' Vanguard+Support every single `endTurn()` call, regardless of
whose turn is ending — so `duration: 1` ("this turn") is symmetric: gone
by the time anyone's next turn starts, whether it was cast on an ally or
an enemy. Each application pushes its own array entry rather than
merging into an existing one (matching the permanent buff's own additive
stacking), so two "this turn" buffs on the same creature really do add
up, each expiring on its own independent schedule. Scope was kept to
Creature targets only, matching the permanent `buff` effect's own
existing scope (it's never supported targeting a Hero). The Admin Panel
gained a "Duration (turns)" field on the buff effect form (0 =
permanent, reusing the `attackDelta`/`hpDelta` fields' existing "0 means
omit" convention rather than a new one). A new Neutral bonus Spell,
`battle-fury` (Instant, "Friendly creatures gain +2 Attack this turn"),
demonstrates it end-to-end — outside the 59-card Neutral Core Set, same
precedent as `wolf-pack`/`alphas-call`'s bonus content. **Also fixed a
second, unrelated pre-existing bug found while touching the JSON
validator**: `loadCustomCards.ts`'s `VALID_RARITIES` never included
`"uncommon"` even though it's been a fully live `Rarity` value since
Phase 0 (many built-in cards already use it) — any custom or
Admin-Panel-saved card with `rarity: "uncommon"` was silently rejected
by `validateCard`. Fixed to match the live `Rarity` type exactly.

**Phase N landed ROADMAP.md #10**, the first two real archetype
mini-sets converted from FACTIONS.md's draft content: **Roseguard
Kingdom** (§1 Human Kingdom, chivalric/heraldic) and **Wildheart
Tribes** (§7 Orc Spirit Tribe, tribal/ancestral), 10 cards each (a
Legendary Hero plus 9 supporting cards) under the two previously-empty
`roseguard-kingdom`/`wildheart-tribes` Faction tags — no engine changes
were needed, since every mechanic used (`formation`, `taunt`, `ranged`,
`charge`, `reach`, `revenge`/`onDeath`, `cleave`, `warcry`/`onPlay`, the
Phase M `buff` `duration`, an `auraBuff` Hero Passive, a Building
`ability`) already existed — this phase is pure content plus two
starter decks (`queen-maerwyn`/`matron-shara-earthsong` in
`decks.ts`, following the `ARCHIVIST_DECK` precedent). Both mini-sets
were deliberately **converted, not transcribed**: several of
FACTIONS.md's original card texts describe effects the engine has no
primitive for (a one-time non-cap "gain 1 Mana now," a live
race-membership Attack bonus, granting a keyword like Vanish via a
spell, an aura that reacts to *other* cards' triggers, auto-reassigning
Equipment on the bearer's death) and were reflavored to use only real
`CardEffect`/keyword primitives rather than inventing new engine
surface for a first content pass — see FACTIONS.md §1/§7 for the
per-card conversion notes. This surfaced one genuine engine
constraint worth flagging for future Revenge-style cards: an `onDeath`
trigger's effect always resolves via `resolveEffect(state, owner,
trigger.effect, null)` (`effects.ts`) — a `targetCreature`-scoped effect
silently fizzles from a trigger since there's no player-supplied target
to fill that slot, so a Revenge effect must use an AOE target
(`allFriendlyCreatures`) or no target at all. Ancestor-Bound Huntress
was designed around this from the start; Totem-Flesh Colossus's
Revenge already used the AOE shape for the same reason.

**Phase O reverses Allegiance (§10) from a deckbuilding gate into pure
flavor/synergy**, per explicit user direction: Heroes are meant to be
collectible (pack/mission/event-pulled), not a fixed roster everyone
freely picks from, so a Faction's cards can't be gated behind owning
that Faction's specific Hero — a "Roseguard Deck" needs to be playable
without Queen Maerwyn. `HeroCardDefinition.allegiance` and
`customDeck.ts`'s `isCardAllowedForHero`/`deckAllegianceViolations`
were deleted outright (no shipped Hero ever used the `allegiance`
grant), and the Deck Builder's Faction-mismatch warnings/save-blocking
were removed with them. Every existing Faction Hero (Archivist, Queen
Maerwyn, Matron Shara Earthsong) already expresses Faction synergy the
right way for this model — an `auraBuff` Passive filtered to their own
Faction, a bonus for fielding it, never a requirement to — so no card
content needed to change, only the restriction layer came out. See
§10 for the full rewrite. A follow-up Hero redesign is planned next but
not yet built: a fixed Hero Power stays exactly as-is (unchanged,
DESIGN.md §9), but the single `passive` field is replaced by three
named **Specializations** — flavorful doctrine choices (not literally
labeled "offensive/defensive/support"), one chosen per match rather
than baked into the card, chosen simultaneously/hidden against the
opponent's own pick (a prediction/bluff layer once the opposing Hero is
known but not their deck, hand, or in-progress choice) and revealed
before the mulligan. See the §19 priorities list for the full spec and
open questions.

**Phase P builds the Hero Specialization system spec'd in §19**, the
direct follow-up to Phase O: `HeroCardDefinition.passive?: PassiveEffect`
(a single, always-on field) is replaced outright by
`specializations: [HeroSpecialization, HeroSpecialization,
HeroSpecialization]` — three named, flavorful doctrine choices, each
just a `{ id, name, text, effect }` wrapper around the same curated
`PassiveEffect` templates a lone `passive` used to hold directly, so no
new mechanical *shape* was invented. `HeroInstance` gained
`chosenSpecializationId: string`; `createHeroInstance`/
`createInitialPlayerState`/`createInitialGameState` all take an optional
specialization id and default to `specializations[0].id` when omitted —
and **every shipped Hero's index 0 is defined to be byte-for-byte what
that Hero's old `passive` used to be**, so the entire pre-Phase-P engine
test suite (150+ tests) needed zero behavioral updates, only a few
`CardDefinition` object-literal fixtures that now require the field at
all. `hero.ts`'s `getAuraAttackBonus`/`peekSpellDiscount` now resolve
through a new `chosenPassiveOf` lookup instead of reading `.passive`
directly. `auraBuff` also gained an optional `hpDelta` alongside
`attackDelta` (both now optional, at least one must be set) — a genuine
new capability, not just a rename: Phase M's temporary-modifier work
already built the "effective max HP" overlay the original `auraBuff`
doc comment cited as the reason Attack-only was a deliberate
simplification, so extending it was now actually cheap. `getAuraHpBonus`
(hero.ts) and `getBuildingAuraHpBonus` (building.ts, for symmetry — a
Building's own `passive` can use `hpDelta` too now) fold into
`getEffectiveCreatureMaxHp`, same display-only convention as Formation/
Duel/Crowd Pleaser/TemporaryModifier's own `hpDelta`. Every shipped Hero
(Fighter/Mage/Rogue/Grand Marshal/Archivist/Queen Maerwyn/Matron Shara
Earthsong) got 3 real Specializations authored — Grand Marshal is the
one deliberate exception to the "index 0 = old behavior" rule, since he
never had a `passive` at all before (nothing tested or depended on that
absence, confirmed by grep before writing his 3). A new
`chooseSpecialization` screen (`SpecializationSelect.tsx`) sits between
Hero+deck selection and the match actually starting — Quick Play and the
Deck Builder's "Play This Deck" both route through it now via App.tsx's
`startPendingMatch`. The player sees the opponent's Hero (not their
deck/hand/pick) and picks one of their own Hero's three; a new
`pickAiSpecialization` (ai.ts) — deliberately typed to take only the AI's
own `HeroCardDefinition`, never the player's choice or Hero, so it can't
become a counter-pick even by accident — computes the AI's pick, and
both are shown together before `startGame` runs, matching the "reveal
after both lock in, before the match really begins" recommendation
(explicitly not finalized canon — see §19). **Two things were
deliberately left alone**, matching explicit user direction: the fixed
Hero Power/optional Signature Ability are completely unaffected by any
of this (Archivist keeps her Signature; new Heroes aren't expected to
define one); and true hidden selection between two humans sharing one
screen (local hot-seat) isn't solved here — only the vs-AI path actually
achieves independence today. Two pre-existing gaps were also closed as a
side effect of the required-field change: `AdminPanel.tsx` never had any
Hero Passive/Power/Signature authoring UI at all (only `class`/`attack`/
`hp`), so it gained a full 3-Specialization authoring fieldset; and
`loadCustomCards.ts`'s `validateCard` never had a `"hero"` case in its
switch at all — `VALID_ARCHETYPES` didn't even list `"hero"` — meaning a
custom or Admin-Panel-saved Hero was silently rejected on every
`fetchRemoteCards()` round-trip. Both are fixed now, with a Hero
validation path covering `specializations`/`heroPower`/`signature`/
`ruleBreaks`.

CARDS.md/BACKEND.md describe what's live today; check them (not just
this doc) for current schema.

Sections marked **Open default** are judgment calls made to keep the
spec internally consistent and buildable; flag any of them if they
don't match what you had in mind — they're easy to revisit before the
phase that depends on them starts.

For how to add/generate/reskin cards, see `CARDS.md`. For the
account/admin backend, see `BACKEND.md`. If you're an AI agent working on
this repo, see `AGENTS.md`/`CLAUDE.md` and check `AGENT_LOG.md` before
starting — another agent may already be mid-task elsewhere in this repo.

---

## 1. Card archetypes

| Archetype | Zone when played | Summary |
|---|---|---|
| **Hero** | The Hero slot | Chosen before a match, not played from hand. Carries a broad Hero **Class fantasy** (Fighter/Mage/Rogue), plus an optional Faction (flavor/synergy tag only — never a deckbuilding restriction, §10), Health, Attack, Passive, Hero Power and optionally a Signature Ability. See §9. |
| **Creature** | Vanguard (5) or Support (5) | Has HP + Attack. May carry Keywords, triggers and one or two `creatureType` combat-role tags. Normally occupies 1 space; Massive creatures occupy more (§5). |
| **Building** | Buildings row (5, one per column) | Has Durability (HP). May have a passive, activated ability, trigger, or card-specific field such as Spell Amplify. See §11. |
| **Spell** | Instant: none. Ritual/Charged: one of 4 Spell/Ability slots | Three forms — Instant, Ritual, Charged — see §1a. Always costs **Mana** at every Spell-stage activation. |
| **Ability** | Instant: none. Activated: one of 4 Spell/Ability slots | Mirrors the Spell split at a simpler level: Instant resolves from hand; Activated occupies a shared slot and can be unlimited or charged. Always costs **Energy**. |
| **Equipment** | One of 4 Equipment slots | Player-owned inventory. Enters Unassigned, then can be assigned to the Hero or an Armiger for 1 Energy. Playing the card itself costs **Resources**. See §12. |

Every card can optionally carry an **Element** and a **Faction** (a flavor/synergy tag, never a deckbuilding restriction — §10). Hero/Creature cards also carry a **Race** in the live schema. `creatureType` is separate: it describes battlefield/combat role rather than species or political identity.

**Taxonomy rule:** gameplay Faction is not the same thing as a world culture, country, house, mercenary company, or order. Names such as Cimbar, Lorthaine, Gestmane or Golden Company should not automatically become engine Factions merely because they recur in lore.

### 1a. Spell and Ability forms

**Spells**
- **Instant** — cast straight from hand for Mana `cost`; resolves immediately; never occupies a slot; goes to **Discard**.
- **Ritual** — pay Mana `cost` to place it in a Spell/Ability slot, then pay Mana `activateCost` per activation. Normally uses `charges: "unlimited"`; voluntarily dismissing it sends it to **Discard**.
- **Charged** — same placement/activation flow as Ritual, but with a fixed charge count; auto-discards when charges reach 0.

**Abilities**
- **Instant** — resolves straight from hand for Energy `cost`; no slot, no `activateCost`, no charges; goes to **Discard**.
- **Activated** — occupies a Spell/Ability slot; Energy `cost` places it and Energy `activateCost` uses it. `charges` may be a number or `"unlimited"`.

A target-restricted Instant/activation with no legal target is still playable/activatable and simply fizzles unless a specific card says otherwise.

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

- Creatures enter play **Exhausted**, unless they have **Charge**.
- At the **start of their controller's turn**, creatures and the Hero Ready and per-turn attack/use counters reset.
- **Attacking Exhausts** a creature/Hero once its permitted attacks are spent. Double Strike tracks two attacks internally before becoming fully exhausted.
- **Advance** uses the same readiness/freeze/summoning-sickness gate as attacking and exhausts the creature.
- Attacks are not paid for with Energy; Energy pays for deployment, Ability/Hero-Power activations, Equipment assignment and tactical actions such as Advance/Duel where printed.

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

The universal keyword pool is intentionally reusable. `CARDS.md` is the exact schema reference; this section is the rules-level summary.

| Keyword | Rules identity |
|---|---|
| **Taunt** | Combat targeting gate for the reachable row; see §5. |
| **Warcry** | Label for an `onPlay` trigger. |
| **Revenge** | Label for an `onDeath` trigger. |
| **Counter** | Label for an `onDefend` trigger. |
| **Charge** | Enters Ready and may attack immediately. |
| **Ranged** | May attack from Support; may directly target enemy Support; skips retaliation only when attacking a non-Ranged defender. |
| **Reach** | May directly target enemy Support from Vanguard, but does not itself permit attacking from Support. |
| **Infiltrate** | May attack Buildings through column protection and bypass Taunt for Hero targeting. |
| **Protector** | May redirect attacks from a same-row ally; live engine currently applies a survival heuristic automatically. |
| **Armiger** | Creature may bear one Equipment item. |
| **Vanish** | Cannot be specifically targeted by enemy attacks or targeted hostile Spell/Ability effects; AOE still hits. Does not break on attack. |
| **Ward** | Negates the next directly targeted hostile Spell/Ability, then is consumed. |
| **Cleave** | Creature attack also damages adjacent enemies in the primary target's row. |
| **Drain** | Combat damage dealt restores that much Guard, capped at max Guard. |
| **Frenzy** | Pair with `frenzyBonus`; permanently gains the printed Attack amount each time the creature attacks. Cimbar Berserker is the anchor example. |
| **Enrage** | Pair with `enrageBonus`; live Attack scales with missing HP, so healing reduces it again. |
| **Bloodied** | Pair with `bloodiedBonus`; live Attack bonus while at/below half HP. |
| **Resistant** | Flat per-hit damage reduction, additive with Equipment reduction. |
| **Deadeye** | Attack-instance bonus when attacking a target in enemy Support. |
| **Double Strike** | Up to two attacks per turn. |
| **Duel** | Bespoke Energy action: mark one enemy; gain the printed live bonus and may attack that target through the normal row/Taunt ladder while it remains. |
| **Crowd Pleaser** | Live capped Attack/HP scaling from the number of other creatures on the board. |
| **Immune** | Blocks hostile Spell-archetype activations from targeting this creature; Abilities/triggers are unaffected. |
| **Poison / Bleed / Burn** | Labels normally paired with status-applying attack/defend triggers. |
| **Frost Armor** | Label normally paired with an `onDefend` Freeze trigger. |
| **Summon** | Label for a trigger that uses `summonCreature`. |
| **Massive** | Descriptive label; numeric `spaceCost` drives the actual multi-slot behavior. |
| **Flank** | Pair with `flankBonus`; live bonus in columns 1 or 5. |
| **Formation** | Pair with `formationBonus`; live bonus when adjacent same-row ally shares at least one `creatureType`. |
| **Advance** | Support creature may spend 1 Energy to move to same-column Vanguard instead of attacking. |
| **Push** | Successful attack may push a surviving enemy Vanguard creature into empty same-column Support. |

### CreatureType vs Hero Class vs Race

These are deliberately different systems:

- **Hero Class** — Fighter / Mage / Rogue. Broad player fantasy and deck direction, not a strict lockout. A Mage can lean harder into Spells; a Fighter can still use Spells; a Rogue hero represents indirect/precision play.
- **CreatureType** — battlefield/combat role. Examples: Fighter, Defender, Ranger, Mage, Support, Beast/Creature. A Defender generally means high durability/defensive tools; a Fighter generally means more offensive pressure, lower durability and/or offensive keywords. A Spiked Turtle can therefore be Race/Creature `beast` while its combat role is **Defender**.
- **Race** — what the being is: Human, Dwarf, Elf, Orc, Beast, Angel, etc. Race is not the creature's combat job.

**Live as of Phase L:** `rogue` is a real CreatureType, retagged onto `assassin`/`shadow-infiltrator`; `class: HeroClass` is a required field on every Hero rather than prose/starter-Hero identity only.

## 8. Elements, Factions, Races, and world identities

Exact live enum lists are maintained in `CARDS.md`/`src/data/taxonomy.ts`.

- **Element** — magical affinity/school; descriptive unless a card keys off it.
- **Faction** — a **flavor/synergy tag** (rewritten in Phase O — never a deckbuilding restriction, §10). Use it when a Hero Passive or other card mechanic genuinely wants to key off Faction membership.
- **Race** — species/type tag on Hero/Creature cards; the fantasy race pool is already intentionally established for future content.
- **CreatureType** — combat-role tag(s), used by mechanics such as Formation.
- **World culture / state / house / organization** — lore identity, documented separately in `WORLD.md`; not automatically an engine Faction.

**Live as of Phase L:** the schema stores `races: Race[]`, not a single value — a dual-nature card (Human + Angel, etc.) doesn't need bespoke text. Most cards still carry just one entry.

## 9. Hero cards

A Hero card carries:

| Field | Notes |
|---|---|
| Faction | A flavor/synergy tag only (§10, rewritten Phase O) — never restricts what a deck can contain. Typically referenced by one of the Hero's own Specializations (`auraBuff` filtered to that Faction, §19 Phase P) as a bonus for fielding it, never a requirement. |
| Class | `class: "fighter" \| "mage" \| "rogue"` (required, Phase L) — broad **class fantasy** for the player's chosen main character, not a strict deck lockout and not the same taxonomy as a CreatureType. Fighter leans toward direct pressure/combat, Mage toward Spell/supernatural synergy, Rogue toward precision/indirect play. Purely descriptive today — no mechanic keys off it yet, same as Race/Element. |
| Health, Attack | Attack only matters once Equipment is assigned (unchanged from v1) — but a Hero's own base Attack should now be **low or 0**, since a Weapon's `attackBonus` is meant to be the primary source of a Hero's Attack, not a bonus layered on top of an already-large base. **Open default / known exception:** the three original starter Heroes (Fighter 10, Mage 20, Rogue 15 base Attack) predate this convention and haven't been retconned — they still hit hard the moment *any* Equipment is assigned, weapon or not. Revisit those three numbers whenever they're touched again; every faction Hero authored from here on should follow the low/0-base convention. |
| Specializations | **Live as of Phase P.** Exactly three named `HeroSpecialization` entries (`{ id, name, text, effect }`), each `effect` an always-on `PassiveEffect` from the same small curated template set the old single `passive` field used (aura buff to a matching Faction/Race/Class — now with an optional `hpDelta` alongside `attackDelta` — or a first-spell-cheaper-per-turn discount). One is chosen per **match**, not baked into the card or picked at deck-build time: the player sees the opponent's Hero (never their deck/hand/in-progress pick) and locks in a choice, the AI's own pick (`pickAiSpecialization`, computed without ever reading the player's choice) is revealed alongside it, before `startGame` runs. `HeroInstance.chosenSpecializationId` tracks the active one for the match; every shipped Hero's index 0 reproduces exactly what that Hero's old `passive` used to be, so untouched code defaults to unchanged behavior. See §19 for the full spec, including the still-open reveal-timing/hot-seat questions. |
| Hero Power | An activated effect using the same `CardEffect` shape as a Spell/Ability, Energy-costed, usable **once per turn** (not charge-based). Fixed regardless of which Specialization is chosen — it's the Hero's one permanent active identity. |
| Signature Ability *(optional)* | Same shape as Hero Power, but a stronger effect gated to a small number of uses **per match** (e.g. 1) instead of per turn. Not assumed for every Hero going forward (§19 Phase P) — kept as-is on Heroes that already have one. |
| Rule-Breaks *(optional, Legendary-tier)* | A curated menu of numeric deltas a Hero can carry: extra Spell slots, extra Building slots, Vanguard/Support slot count changes, starting Guard delta, max Energy/Mana/Resources cap delta. **Open default:** only numeric-delta modifiers are supported at first; a fully bespoke rule-break (e.g. "Harpies may overfill Support by forming Flocks") is one-off card-specific code, done when that specific card is actually built, not a general system. **Implementation status:** live and engine-tested — `HeroCardDefinition.ruleBreaks` is applied once at match start. `grand-marshal` (Legendary, +1 Vanguard/+1 Support slot) is the first shipped Hero to exercise it. |

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

## 10. Faction & deckbuilding (rewritten in Phase O — no longer a gate)

**Faction never restricts deckbuilding.** Any card is legal in any
deck regardless of the chosen Hero's own Faction — a `roseguard-kingdom`
card is exactly as playable under Fighter, Grand Marshal, or Matron
Shara Earthsong as it is under Queen Maerwyn. This replaces the
original "Allegiance" design (Hero's Faction + Neutral only, with
`extraFactions`/`neutralRaces`/`unrestricted` grants to bend it) that
shipped in Phase C/J — that gate is gone outright, not loosened; the
`allegiance` Hero field and `isCardAllowedForHero`/
`deckAllegianceViolations` were removed rather than kept as unused
scaffolding.

The reasoning is a shift in what a Hero *is*: Heroes are meant to be
collectible like any other card — pulled from packs, earned from
missions/events — not a fixed menu everyone always has full access to.
If picking a Faction's own Hero were also the only way to legally play
that Faction's cards, a player without the Roseguard Kingdom Hero
couldn't build a Roseguard-flavored deck at all. Instead:

- **Faction is a flavor/synergy tag**, same standing as Element or
  Race — mechanically inert on a plain card unless something
  specifically keys off it.
- A **"Faction deck"** (e.g. a Roseguard Kingdom-leaning build) is
  fully playable with *any* Hero, own-Faction or not.
- That Faction's **own Hero adds a bonus on top**, not a requirement:
  Queen Maerwyn's Passive (`auraBuff` filtered to `roseguard-kingdom`)
  only pays off *if* the player actually fields Roseguard creatures —
  she doesn't need them to be legal, she rewards choosing to run them.
  Every Faction Hero shipped so far (Archivist, Queen Maerwyn, Matron
  Shara Earthsong) already follows this shape, so no card content
  needed to change.
- Nothing stops a future Hero Passive from flipping this around —
  rewarding *foreign* troops instead of the Hero's own Faction (e.g.
  "creatures without your Faction gain +1 Attack while you lead them"),
  which reads naturally as just another `auraBuff`-style template, not
  a new system.

The Deck Builder no longer validates or blocks on Faction at all — the
only remaining save/play gate is the 30-card size check (`DECK_SIZE`).

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

**Live as of Phase F** — see the implementation-status note near the
top of this document for exactly what shipped, the one deliberate
simplification (Equipment always enters the zone Unassigned when
played; there's no free immediate-assign-at-play path, only the paid
`assignEquipment` action below), and the auto-bump-on-reassign
behavior this section doesn't spell out. Bearer category restriction
(the second bullet below) is the one piece **not** built — moot while
"Open default" caps every bearer at 1 item total anyway.

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
  effects rather than Attack — the `category` field exists and gates
  Hero-attack eligibility (only a `weapon` unlocks it), but nothing
  stops an Armor card from also carrying a nonzero `attackBonus` if a
  future card wants to bend that convention; it's an authoring
  guideline, not an engine-enforced rule.

---

## 13. Status effects

Statuses tick on the affected player's **turn start** when they carry duration. Current status types:

- **Poison** — damage-over-time.
- **Bleed** — separate damage-over-time; may coexist with Poison/Burn.
- **Burn** — separate damage-over-time.
- **Freeze** — control status; blocks attacking and the tactical actions that share the attack/readiness gate (including Advance and Duel activation) while active.

Different status types can coexist. Reapplying the same status type does not stack separate copies; it refreshes amount/duration to the stronger values. Shipped cards normally use explicit durations; an omitted duration can persist indefinitely, though no current shipped card relies on that.

## 14. Turn structure

The live implementation resolves turn-start bookkeeping through the shared start-turn flow. At a rules level:

1. **Start / Draw:** start-of-turn statuses/triggers resolve; the active player's creatures/Hero Ready and per-turn counters reset; draw 1; Energy and Mana refill to cap; Resources persist and gain their normal income/trickle up to cap.
2. **Main phase:** play cards, activate slotted Spells/Abilities/Buildings, assign Equipment, use Hero Power, and take legal tactical actions in any allowed order.
3. **Combat phase:** declare attacks with Ready eligible attackers, following §5.
4. **End phase:** end-of-turn triggers resolve; turn passes. Readying is a **start-of-turn** operation, not an end-of-turn one.

## 15. Deck, hand, and card flow

- **Deck size:** exactly 30 cards in the current prototype. There is currently no copy-count restriction.
- **Piles:** Deck → Hand → **Discard** for one-shot/voluntary Spell/Ability spends and exhausted charged effects; **Graveyard** is reserved for destroyed Creature/Building battlefield objects.
- **Empty deck:** shuffle Discard into a new Deck. Graveyard is never included in this automatic reshuffle.
- Individual Hero/Spell/card effects may explicitly retrieve from Graveyard without changing the empty-deck rule.
- Starting hand 4, one-time mulligan, max hand size 10, second player draws an extra card on turn 1 remain the current defaults.

**Balance review item, not a live change:** once competitive collection/deckbuilding matters, test a copy limit (for example 3 normal / 1 Legendary) against the current unrestricted model. Do not enforce one until playtesting supports it.

## 16. Board-space-as-resource (later-phase content layer)

Documented now so future card design has a target, but **not required
for the v2 engine rebuild** (§17 Phase E+) — these are card-effect
patterns layered on top of a working positional board, not core rules.
**Swarm, Consume, and Transformation are live as of Phase G, and
Garrison as of Phase I** — see the implementation-status note near the
top of this document for the exact mechanics and example cards.
**Mount is cut — a deliberate decision, not a deferral.** It would
have needed a genuinely new composite-creature-instance concept (how
two merged creatures share one board position, one Attack/HP, one set
of keywords), and the existing 4-slot Equipment zone (§12) already
covers the "ride/gear up a unit" space well enough — Mount is not
planned for this game.

- **Swarm** ✅ *(live)*: effects that create several small units at
  once, filling the board fast.
- **Consume** ✅ *(live)*: destroy an allied creature to free its slot
  and empower another (an explicit new effect kind).
- **Garrison** ✅ *(live)*: place a creature *inside* a Building instead
  of occupying a battlefield space (needs a Building-side "housed
  creature" slot concept).
- **Transformation** ✅ *(live)*: a card becomes a different, larger
  card in place — e.g. a Massive upgrade that requires contiguous
  empty space to complete, per §5.

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
  Since Phase Q, it also checks once per combat phase whether its
  current attackers already add up to lethal against the enemy Hero
  (`isLethalAvailable`, ai.ts) and if so goes straight for the Hero
  with every attacker that has a legal path there, instead of trading
  through creatures/Buildings first — a reachable Taunt creature is
  still the one thing that can force an attacker elsewhere.

Suggested build order, each phase individually shippable/testable:

| Phase | Scope |
|---|---|
| **A — Foundation** ✅ *(live)* | Board reshape (Vanguard+Support+columns), the 3-pool resource-by-archetype split, Ready/Exhausted, Guard rename (+ faction display labels), base reach-tier targeting (no Reach/Ranged/Infiltrate yet — just Vanguard-first, matches v1's existing chain shape). |
| **B1 — Reach & position, wave 1** ✅ *(live)* | Reach, Ranged, Infiltrate keywords and the full targeting chain they unlock (§5). Deliberate Vanguard-vs-Support placement on play. Support creatures can attack if Ranged. Column-based Building protection (§11). Hero-targeting has no board-population gate — every attacker can always reach the Hero, gated only by a reachable Taunt creature (Infiltrate bypasses that too). Target-restricted Warcries/Spells with no legal target just fizzle instead of making the card unplayable. |
| **B2 — Reach & position, wave 2** ✅ *(live)* | Protector, Flank, Formation, Advance, Push, Massive. Protector's redirect is heuristic-automatic rather than a live prompt (see the implementation-status note above); everything else matches this section as written. |
| **C — Spell forms & Hero rework** ✅ *(live)* | Instant/Ritual/Charged split for Spells. Hero Passive/Power/Signature. Allegiance deckbuilding validation — built and unit-tested here, made a real live restriction in Phase J. See the implementation-status note above for the discard-vs-graveyard deviation. |
| **D — Keyword expansion** ✅ *(live)* | Stealth, Ward, Cleave, Drain, Bloodied, Summon (+ the `summonCreature` effect kind), Warcry rename. See the implementation-status note above for scoping details and the loadCustomCards.ts validator fix. |
| **E — Buildings as objects** ✅ *(live)* | Durability/attackability, activated abilities, On Construction triggers, enemy interaction (Siege/Sabotage). Durability/column-protection/Graveyard/On Construction were already live from earlier phases; this wave added the passive (auraBuff-only) and activated ability (no usage cap). The Siege/Sabotage "ignore column protection" escape hatch is live and tested — Infiltrate bypasses it for attacks (`shadow-infiltrator`, since Phase B1), and Spells/Abilities targeting a Building were never subject to it at all. See the implementation-status note above. |
| **F — Equipment rework** ✅ *(live)* | 4-slot zone, categories, assign/reassign for Energy, survives-death/Unassigned flow. Equipment always enters the zone Unassigned when played (the free immediate-assign-at-play path isn't built); a second item assigned to an already-equipped bearer auto-bumps the old one rather than being refused; bearer category restriction isn't enforced. See the implementation-status note above. |
| **G — Board-as-resource (§16)** ✅ *(live, in part)* | Swarm (`summonCreature` count), Consume, Transformation, plus the Hero Rule-Breaks (§9) mechanism. Garrison shipped in Phase I. Mount is cut — see the implementation-status note above. |
| **H — Closing flagged gaps** ✅ *(live)* | Not a pre-planned phase — a cleanup pass over three items earlier phases had explicitly left open, none needing new design decisions: Bloodied's trigger mechanism decided (continuous live check, `wounded-berserker`), a shipped Rule-Breaks Hero (`grand-marshal`), and a documentation correction (Siege/Sabotage's column-protection bypass was already live since Phase B1, the Phase E note was just stale). See the implementation-status note above. |
| **I — Garrison (§16)** ✅ *(live)* | A `garrison` CardEffect (single-target, resolved the same way as Consume/Transform) moves a friendly creature into `CardInstance.garrisonedCreature` on a Building, off the battlefield and untargetable, ejected back out (or destroyed) when that Building dies. `garrison-post` demonstrates it in the Fighter starter deck. With this, every §16 Board-as-resource pattern that's actually part of the game is live — Mount was decided against, not deferred; see the implementation-status note above. |
| **J — Allegiance made live (§10)** ✅ *(live)* | Not a pre-planned phase — Allegiance (§10) was built and unit-tested back in Phase C but never actually restricted a real deck, since no starter Hero carried a Faction. `archivist` (`faction: "arcane-industries"`) ships with a real 30-card starter deck, so the restriction now genuinely bites. See the implementation-status note above. |
| **K — Neutral Core Set adoption + card-art-is-the-card UI** ✅ *(live; art model superseded going forward, see below)* | Adopted an external 59-card spec as ground truth for the Neutral Core Set; every existing Phase A-J mechanic was explicitly kept, not reconciled against the new spec. Vanish replaces Stealth; new keywords Enrage, Frenzy (reassigned to a new card), Resistant, Deadeye, Double Strike, Duel, Crowd Pleaser, Bleed, Burn(-on-hit), Frost Armor, Massive; new `creatureType` field drives type-conditional Formation; new `gainIncome`/`drawCreature`/`devour`/`multi` CardEffect kinds; new `targetRow`/`targetCreatureOrPlayer` targeting; Building ability charges; Equipment keywords/charges; Ability gained the Instant/Activated split Spells already had. The card frame/text overlay was removed for every non-Hero archetype — the art itself now carries that information. Two genuine pre-existing bugs surfaced and fixed along the way: the onAttack trigger was built but never wired into combat, and `applyStatus` never supported AOE targets. See the implementation-status note above for the full list, the Open defaults, and the known gaps (no Duel UI button yet, Bulletin Board's scrying simplified, decks not reworked to include the 11 new cards). **The fully-baked-art assumption is superseded as of 2026-08-24** — the layered Card Builder is now the primary card-creation workflow; existing baked cards stay valid as a legacy/fallback path rather than being retired. See the reconciliation note in the implementation-status narrative above and §20. |
| **L — Taxonomy migrations (ROADMAP.md #5/#6)** ✅ *(live)* | `race?: Race` became `races?: Race[]` everywhere (types.ts, the 8 cards that had one, the `auraBuff`/`neutralRaces` array-membership matching, CardView's Hero meta line, the Admin Panel's checkbox multi-select, the Supabase schema — `race` moved from a dedicated column into `data` jsonb like every other array field, migration `0004_multi_race.sql`). New required `class: HeroClass` field on every Hero (`"fighter" \| "mage" \| "rogue"`), purely descriptive today; new `rogue` CreatureType, retagged onto `assassin`/`shadow-infiltrator` in place of the generic `fighter` tag. Fixed a genuine pre-existing bug along the way: `validateCard` never actually included `element`/`faction`/`race` in its returned object, so an Admin-Panel-set Element/Faction/Race silently vanished on the next `fetchRemoteCards()` — fixed for both the Supabase and `customCards.json` paths. See the implementation-status note above for the full writeup. |
| **M — Temporary-modifier primitive (ROADMAP.md #7)** ✅ *(live)* | `buff` gained an optional `duration?: number` — omit for the original permanent buff, give it a number and it becomes temporary instead: pushed onto a new `CardInstance.temporaryModifiers` array, summed live into Attack/effective-max-HP, never touching the permanent `attackDelta`/`hpDelta`. Ticks down at the end of *every* turn — both players', not just the bearer's own controller's — deliberately different timing from Poison/Bleed/Burn/Freeze's per-owner-turn-end tick, so `duration: 1` ("this turn") is symmetric for a self-buff and a hostile debuff alike. New Neutral bonus Spell `battle-fury` demonstrates it. Fixed an unrelated pre-existing bug found along the way: `loadCustomCards.ts`'s `VALID_RARITIES` never included `"uncommon"` despite it being a live `Rarity` value since Phase 0. See the implementation-status note above for the full writeup. |
| **N — First archetype mini-sets (ROADMAP.md #10)** ✅ *(live)* | Roseguard Kingdom (FACTIONS.md §1, Human) and Wildheart Tribes (FACTIONS.md §7, Orc) converted into real cards under the previously-empty `roseguard-kingdom`/`wildheart-tribes` Factions — 10 cards each (a Legendary Hero + 9 supporting cards) plus a 30-card starter deck each, pure content with no engine changes. See the implementation-status note above for the conversion notes and the `onDeath`-trigger-target constraint it surfaced. |
| **O — Allegiance reversed to pure synergy (§10)** ✅ *(live)* | Faction no longer restricts deckbuilding at all — any card is legal in any deck regardless of Hero. `HeroCardDefinition.allegiance` and `customDeck.ts`'s Allegiance-gate functions were deleted, along with the Deck Builder's Faction-mismatch warnings. A Faction's own Hero still grants a bonus for fielding that Faction (unchanged `auraBuff` Passives on Archivist/Queen Maerwyn/Matron Shara Earthsong), just never a requirement. See the implementation-status note above and the rewritten §10. |
| **P — Hero Specializations (§19)** ✅ *(live)* | The single `passive` field is replaced by 3 named Specializations per Hero, chosen once per match (defaulting to index 0 = the old `passive`, so the whole pre-Phase-P test suite needed no behavioral changes). `auraBuff` gained an `hpDelta` alongside `attackDelta`, folded into `getEffectiveCreatureMaxHp` for both Hero and Building auras. A new `chooseSpecialization` screen sits between Hero+deck selection and match start, showing the opponent's Hero (not their deck/hand/pick); the AI's pick (`pickAiSpecialization`, ai.ts) is computed independently of the player's. Hero Power/Signature are unaffected. Fixed two pre-existing gaps found along the way: AdminPanel.tsx had no Hero Passive/Power/Signature authoring UI at all, and `loadCustomCards.ts` never had a `"hero"` case (`VALID_ARCHETYPES` didn't even list it) — both fixed. See the implementation-status note above. |
| **Q — AI lethal-priority (player-reported gameflow fix)** ✅ *(live)* | Not a pre-planned phase — direct feedback from an actual match: the AI cleared a Building then a Vanguard creature before finishing an undefended, low-HP Hero, when it already had enough attack on board to just end the game. `isLethalAvailable(state)` (ai.ts) sums each of the AI's currently-able-to-attack creatures' damage (Double Strike counted twice, reduced by the enemy's equipment damage reduction, excluding any attacker a reachable Taunt creature would force elsewhere) plus the Hero's own attack if it can swing, against the enemy's `guard.current + hero.currentHp`; it's a same-turn snapshot, not a sequential-kill simulation. When true, `chooseAttackTarget`'s new `preferLethal` parameter sends every attacker with a legal path straight at the enemy Hero instead of the usual creature/Building-trade logic — a reachable Taunt creature is still the one thing that can force a given attacker elsewhere (Infiltrate still bypasses it, same as always). See the implementation-status note above. |
| **R — Three settled-rules corrections (from the `chatgpt/phaser-battlefield` integration branch)** ✅ *(live)* | Not built on this line — authored on a parallel integration branch while wiring an engine-backed Phaser battlefield prototype (see §20), then cherry-picked here after independent review confirmed each is a genuine correction, not a stylistic change: (1) Hero status damage (Poison/Bleed/Burn ticks) now routes through `damagePlayer` — Guard soaks it first, same as every other source of Hero damage — instead of hitting `hero.currentHp` directly, correcting a violation of §6's "all damage aimed at the player hits Guard first" rule that predated this fix. (2) Double Strike's per-turn attack counter (`CardInstance.attacksUsedThisTurn`) is now reset in `startTurn` alongside `hasAttackedThisTurn`; previously it was never reset, so a Double Strike creature lost its second swing every turn after the first one it ever used Double Strike in. (3) A card burned by drawing into a full hand now leaves the match permanently instead of being pushed to discard, so it can no longer be reshuffled back in via discard-pile recycling — `player.discard`/`graveyard` are untouched by the burn. `src/engine/settledRules.test.ts` covers all three. |
| **S — Shared Builder card faces + hand legality + placement-first targeting** ✅ *(live on `chatgpt/phaser-battlefield`)* | The normal React match and Phaser battlefield now read the same saved Card Builder presentation data for artwork/crop, frame, typography, categories, resource icon, and offsets while keeping engine definitions authoritative for gameplay text/cost/stats. Both hands visibly distinguish playable cards from cards blocked by Mana/Energy/Resources or full destination zones before the player clicks. Targeted On Play creatures choose their exact Vanguard/Support slot first and their effect target second; `targetRow` On Play cards use the same sequence, eliminating the old implicit Vanguard slot-1 fallback. See §20 and `CARD_RENDERING.md`. |

Each phase gets the same verification pass as prior work: `tsc
--noEmit`, `eslint`, `vitest`, `vite build`, plus a Playwright smoke
pass against the dev server before it's called done.

---

## 18. Card collection, packs, and custom decks

Unchanged from v1 in spirit — Collection/Coins/Packs/Deck Builder. The
Deck Builder's only save/play gate is deck size (`DECK_SIZE`) — it does
not validate Faction against the chosen Hero at all (§10, rewritten in
Phase O). Rarity, pack odds, card art normalization (512×776), and the
admin panel are all otherwise unaffected and stay as documented in
`CARDS.md`/`BACKEND.md`.

## 19. Next rules-layer priorities (planned, not live)

0. **Hero Specializations.** **Done (Phase P).** A direct
   follow-up to Phase O's Allegiance rewrite, specified by the user in
   detail — implementation notes and any deviation from the original
   spec are inline below; the full writeup is in the Phase P
   implementation-status note above:
   - **Hero Power stays exactly as-is** — one fixed, always-on active
     ability per Hero (§9), unaffected by anything below. It already
     functions as the Hero's signature identity; a future Hero doesn't
     need to also define a separate `signature` just because earlier
     Heroes did (existing `signature` code/data is **not** being
     removed — Archivist keeps hers — this is only guidance for new
     Hero design going forward).
   - The single `passive?: PassiveEffect` field is replaced by three
     **Specializations** per Hero: named, flavorful doctrine choices
     (a Hero-specific name, not a literal "Offensive/Defensive/
     Support" label) built from the same curated `PassiveEffect`
     template set (§9) — no new mechanical shape, just three named
     instances of what one `passive` already was.
   - **Chosen once per match, not once at deck-build time** — a player
     brings a Hero with all three available and picks one after seeing
     the opponent's Hero (so match-up reads are possible) but *before*
     seeing the opponent's deck, hand, or in-progress choice.
   - **Selection is simultaneous/hidden**, not a visible counter-pick —
     this is a real design requirement (prediction/bluffing), not just
     flavor. Against the heuristic AI (the only opponent today besides
     local hot-seat), the AI's pick needs to be decided independently
     of the player's in-progress choice, then both reveal together.
     True hidden selection in local two-human hot-seat (pass-the-device)
     isn't solved by this — same open gap as the rest of hot-seat mode.
   - **Recommended (not finalized) reveal timing:** both picks reveal
     immediately after both players lock in, before the opening-hand
     mulligan — preserves the prediction game without hiding a passive
     that's already influencing the board once the match is underway.
     **Implementation note:** this codebase has no mulligan step at all
     (hands are just drawn at match start) — the reveal happens
     immediately after the player locks in, right before `startGame`
     runs, which is the earliest point "before the match really begins"
     actually exists here. Revisit if a mulligan phase is ever added.
   - Every existing Hero (Fighter/Mage/Rogue/Grand Marshal/Archivist/
     Queen Maerwyn/Matron Shara Earthsong) needs three Specializations
     authored, not just the Faction Heroes — Fighter/Mage/Rogue/Grand
     Marshal stay available as always-unlocked starter Heroes so a new
     player can always build and play a deck (Heroes overall are meant
     to be collectible — pack/mission/event-pulled — not a fixed
     everyone-picks-from-day-one roster; that's a content/economy point
     for `packs.ts`/rewards, not an engine gate).
1. ~~Temporary modifiers/durations — a generic way to express "this turn", "until your next turn", or N-turn buffs/debuffs.~~ **Done (Phase M)** — `buff`'s `duration` field, see CARDS.md's Effects table. `FACTIONS.md` conversion can now use it for any card whose text is a straight temporary Attack/HP change; a "look/choose/reorder" or Mark/Grudge/Trap-style card still needs items #2/#4 below.
2. **Deck inspection / choose / reorder** — enough interaction for top-N look, choose one, reorder/bottom the rest. This would replace Bulletin Board's current approximation and unlock many faction drafts.
3. ~~Taxonomy migration — explicit Hero `class`; `rogue` CreatureType; multi-race representation.~~ **Done (Phase L).**
4. **Selective faction mechanics** — Mark/Grudge/Trap/Counter-style systems only when an authored mini-set actually needs them. Prefer bespoke logic for truly one-off cards over a bloated universal scripting layer.

---

## 20. Application architecture: engine, React app, Phaser battlefield, Card Builder

Not new engine rules — a statement of how the pieces of the application
fit together, written once a second front-end (Phaser) and a card-
authoring tool (the layered Card Builder) existed alongside the
original React app and needed a shared frame of reference. Both were
built on a parallel integration branch (`chatgpt/phaser-battlefield`)
rather than this line; this section documents the target shape they're
aimed at, not a claim that it's all merged and live here yet.

- **The TypeScript engine (`src/engine/*`) is the sole source of truth
  for game rules and state**, unchanged by any of this. Every
  presentation layer — React's `PlayerBoard`/`CardView`, the Phaser
  battlefield, the Card Builder's preview — reads engine state and
  calls engine actions; none of them re-derive or duplicate rules
  logic. `EngineBattleScene.ts` (the Phaser prototype) already follows
  this: it imports `createInitialGameState`/`playCardFromHand`/
  `declareCreatureAttack`/`runAiTurn`/etc. straight from `src/engine`,
  the same functions the React UI calls.
- **React remains the surrounding application shell** — main menu,
  Collection, Pack Opening, Deck Builder, Admin Panel, auth — and
  today also the live match itself (`PlayerBoard.tsx`/`CardView.tsx`).
  Nothing here plans to route those screens through Phaser; canvas
  rendering only ever made sense for the battlefield's card-and-board
  presentation, not menus and forms.
- **Phaser is the intended eventual battlefield renderer**, reachable
  today from the Main Menu as a standalone "Phaser Test" page
  (`phaser.html`) once that branch merges — a separate app entry, not
  yet swapped in for `PlayerBoard.tsx`'s live match view. It's real,
  engine-backed, and not a toy: dragging/attacking/casting on that
  page mutates actual `GameState` through the same engine calls React
  uses. Promoting it from "parallel prototype" to "the match screen"
  is a distinct, not-yet-scheduled decision from building it.
- **The Card Builder (`card-builder.html`) is the card-authoring and
  card-presentation tool**, and per explicit user direction (2026-08-24)
  is now the primary way new cards get made, superseding hand-baking
  stats into art in an external image editor. See the Phase K
  reconciliation note earlier in this document (in the implementation-
  status narrative, §17's Phase K row) for the rendering-model split
  this implies, and `CARD_RENDERING.md` (integration branch) for the
  layered geometry/typography spec itself. PNG export from the Builder
  is planned, not yet built as of this writeup.
- **Shared card-presentation model is live on the integration branch.** The Card
  Builder's layered composite (art + base + name + cost + resource
  icon + categories + rules text + stats), React `CardView`, and the Phaser
  battlefield now read the same per-card layer data. Phase S implements that shared data contract
  for the Card Builder, React `CardView`, and Phaser card-face renderer;
  the React/Phaser drawing primitives remain platform-specific while their
  source presentation and engine values are shared.
- **Status as of 2026-08-25:** the Phaser battlefield, Card Builder, and
  Phase S shared runtime rendering live only on `chatgpt/phaser-battlefield`.
  Three engine-rules corrections discovered while building the engine bridge
  were cherry-picked onto this line (Phase R, above) since they're
  genuine rules fixes independent of any UI; the Phaser scenes,
  `EngineBattleScene.ts`, Card Builder app, and shared runtime faces have not
  yet been merged onto Claude's main line; that remains the separate
  ROADMAP.md sequence-item #12 decision.
