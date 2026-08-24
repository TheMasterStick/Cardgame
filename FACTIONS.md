# Gameplay Archetype Pool — First Playable Draft

This document is the **content/archetype bible** for the first large non-Neutral card pool. The 19 sections below describe deck fantasies, tone, naming language and candidate card packages. They do **not** automatically define literal geopolitical factions in the world. A future WORLD.md entry may map several archetypes onto one political power, or one race/culture may contain several archetypes.

The card lists were drafted before the current Phase-K Neutral Core Set and therefore contain **legacy mechanical wording**. Their names, tone and intended play patterns remain useful; their costs/effects must be converted against current `CARDS.md`/`DESIGN.md` before implementation. Do not copy a mechanic from this file into code simply because it is written here.

**Notation:** `E`/`M`/`R` means Energy/Mana/Resources. Creature/character stats are Attack/Health; Building stats are Durability. Numbers remain balance targets, not authoritative live values.

**Current mechanical corrections that apply while reading this draft:**
- Ranged avoids retaliation only when it attacks a **non-Ranged** defender; two Ranged creatures trade normally.
- **Vanish** is the current keyword name; legacy `Stealth` text below must be converted.
- **Frenzy** now means permanent Attack gained when the creature attacks (Cimbar Berserker anchor); old damage-survival growth text below needs conversion, usually to Enrage/Bloodied/bespoke logic.
- Equipment cards are played with **Resources**; 1 Energy is the separate assignment/reassignment action. Legacy `1E/2E Equipment` costs below need conversion.
- Abilities may now be Instant or Activated; Spells use Instant/Ritual/Charged. Legacy `Ongoing`/Trap wording is conceptual until converted.

**Class/type note:** Hero Fighter/Mage/Rogue is broad class fantasy. Creature roles are separate `creatureType` tags such as Fighter, Defender, Ranger, Mage, Support, Beast/Creature, with Rogue planned as a creature-role addition where appropriate.

---

## Tone tiers

Every three/four-faction race cluster already splits along a
consistent axis through the naming alone — this is the reference for
checking future card text/flavor against, not a set of rules to
enforce mechanically:

| Cluster | Faction | Tone | Anchor vocabulary |
|---|---|---|---|
| Human | Kingdom | Chivalric, heraldic | Lioness, Gilded, Sky-Lion, Lionguard |
| Human | Mage Order | Arcane, scholarly | Runeblade, Stormbound, Unveiled Stars, Spellforged |
| Human | Church | Liturgical, martyrdom | Chain-Saint, Barefoot, Scourged, Sacred Flesh |
| Human | Assassin Order | Silk, shadow, velvet | Silkblade, Moonlit, Black Silk, Velvet Safehouse |
| Orc | Might | Visceral, direct violence | Dominator, Roar of the Pit, Rip Them Open, War-Matron |
| Orc | Cunning | Grimy, opportunistic | Snare-Mistress, Back-Alley, Gutline, Man-Catcher |
| Orc | Spirit | Tribal, ancestral, painted | Totem-Bound, Painted Spirit-Mother, Grove of Painted Bones |
| Dwarf | Highland | Boisterous expedition | Another Damn Treasure, Drunken Camp, Widowmaker |
| Dwarf | Deep Kingdom | Monumental, stone, ancestral | Vault-Bride, Living Bastion, Thousand Fires |
| Dwarf | Grudge Holds | Legalistic vengeance | Debt-Seeker, Unpaid Debts, Debt Paid in Blood |
| Elf | Wood | Romantic, natural | Lover's Thorns, Hunt Beneath the Moon, Wild Heart |
| Elf | High | Gilded, precise, court | Perfect Rebuttal, Unclouded Sight, Flawless Glass |
| Elf | Dark | Cruel dominance | Obey Me, A Little Pain, Barbed Lash |
| Demon | Dominion (War) | Conquest, slaughter | Give Them No Mercy, Drink the Slaughter, Red Dominion |
| Demon | Whispers | Manipulation, bargains | Just Trust Me, Velvet-Tongued Broker, Borrowed Faces |
| Demon | Excess | Hedonism, indulgence | Just One More, Aching Desire, Lash of Delirium |
| Angel | Celestial Host | Radiant, martial-holy | Golden-Halo, Heaven's Touch, Wrath from Above |
| Angel | Earthbound | Humble, companionable | You Are Not Alone, The Angel's Rest, Roadwarden |
| Angel | Purist | Sterile perfectionism | Remove the Flaw, You Will Be Silent, Perfect Proportion |

---

## Stat/cost curve (working baseline)

| Rarity | Cost | Creature stats | Notes |
|---|---|---|---|
| Common | 2E | 2/3 (1/3 Mage, 2/2 Rogue) | Vanilla or one Warcry line |
| Uncommon | 2E | similar to Common | +1 keyword or small conditional |
| Rare | 3–4E | 3/4–4/5 | One real ability |
| Epic | 5–8E | 5/5–8/8 | Ability bundle, sometimes Massive |
| Legendary (Hero) | — | 18–25 HP | Passive + Hero Power, optional Signature |

Spells: Instant removal ~2M for ~3 damage; stronger Rare effects ~3M.
Buildings: 2–3R for 5–7 Durability.

---

## 1. Human Kingdom

*Chivalric, heraldic.*

**Converted to real content in Phase N** (ROADMAP.md #10) under the live
`roseguard-kingdom` Faction: Queen Maerwyn (Hero), Lioness of the Royal
Guard, Court Enchantress, Sky-Lion Archer, Gilded Knight-Errant, Sky-Lion
Lancer, Raise the Lion Banner, Reinforcements, Roseguard Barracks, and
Lionguard Cuirass — see `src/data/cards.ts`. The draft below is kept for
its remaining unconverted cards and as a naming/tone reference; the
converted cards' actual stats/text follow current CARDS.md primitives,
not this legacy wording verbatim (see the checklist at the bottom of this
file).

**Basic Cards**
1. **Lioness of the Royal Guard** — Common · Fighter · 2E · 2/3
   Gains +1 Attack while adjacent to another Kingdom Fighter.
2. **Court Enchantress** — Common · Mage · 2E · 1/3
   Warcry: Gain 1 Mana.
3. **Velvetwood Huntress** — Common · Rogue · 2E · 2/2
   Ranged.

**Spells**
4. **Raise the Lion Banner** — Common · Instant · 2M
   Friendly characters gain +1 Attack this turn.
5. **Reinforcements** — Rare · Instant · 3M
   Summon two 1/2 Kingdom Militia.

**Faction Cards**
6. **Gilded Knight-Errant** — Rare · Fighter · 4E · 4/5
   Taunt. Gains Charge while your Guard is below half.
7. **Royal Forge-Mistress** — Uncommon · Building · 2R · 5 Durability
   Your first Equipment card each turn costs 1 less Energy to equip.
8. **Sky-Lion Lancer** — Epic · Fighter · 6E · 6/5
   Charge. Can attack characters in the Support row from Vanguard.

**Equipment**
9. **Lionguard Cuirass** — Rare · Equipment · 2E
   +3 Health. Bearer gains Taunt.

**Hero**
10. **Queen Maerwyn, Lion of the Realm** — Legendary · Fighter · 22 Health
    Passive — Royal Muster: If your deck is predominantly Kingdom and Neutral, the first Kingdom character you play each turn gains +1/+1.
    Hero Power — Rally: 2E — One friendly character gains +2 Attack this turn.

---

## 2. Human Mage Order

*Arcane, scholarly.*

**Basic Cards**
1. **Runeblade Sentinel** — Common · Fighter · 2E · 2/3
   Gains Ward when you cast your second Spell in a turn.
2. **Apprentice Evoker (M)** — Common · Mage · 2E · 2/2
   Warcry: Your next Spell this turn costs 1 less Mana.
3. **Velvetglove Relic-Thief** — Common · Rogue · 2E · 2/2
   Warcry: Look at the top two cards of your deck and reorder them.

**Spells**
4. **Arcane Bolt** — Common · Instant · 2M
   Deal 3 damage.
5. **Spell Echo** — Rare · Instant · 3M
   The next Instant Spell you cast this turn resolves twice.

**Faction Cards**
6. **Stormbound Savant** — Rare · Mage · 4E · 3/4
   The first Spell you cast each turn deals 1 additional damage if it deals damage.
7. **Tower of Unveiled Stars** — Rare · Building · 3R · 5 Durability
   +1 maximum Mana while this remains in play.
8. **Spellforged Colossus** — Epic · Fighter · 7E · 7/7
   Ward. Costs 1 less Energy for each Ongoing Spell you control, to a minimum of 4.

**Equipment**
9. **Runed Throat-Charm** — Uncommon · Equipment · 1E
   Mage only. Your first Spell each turn costs 1 less Mana.

**Hero**
10. **Archmagister Seraphine** — Legendary · Mage · 18 Health
    Passive — Arcane Mastery: Your first Spell each turn costs 1 less Mana.
    Hero Power — Channel: 2E — Gain 2 Mana.

---

## 3. Human Church

*Liturgical, martyrdom.*

**Basic Cards**
1. **Chain-Saint Militant** — Common · Fighter · 2E · 2/3
   Taunt.
2. **Barefoot Acolyte** — Common · Mage · 2E · 1/3
   Warcry: Restore 2 Health to a friendly character.
3. **Witch Hunter** — Common · Rogue · 2E · 2/2
   Ranged. +1 Attack against Demons.

**Spells**
4. **Saint's Caress** — Common · Instant · 2M
   Restore 4 Health to a character or 3 Health to your Hero.
5. **Prayer of the Last Breath** — Rare · Ongoing · 3M
   The first friendly character that dies each turn restores 2 Guard.

**Faction Cards**
6. **Scourged Penitent** — Rare · Fighter · 3E · 2/4
   Taunt. Revenge: Restore 4 Guard and give another friendly character +1/+1.
7. **Chapel of Sacred Flesh** — Rare · Building · 3R · 6 Durability
   Whenever one of your Revenge effects activates, gain 1 Mana.
8. **Living Saint** — Epic · Fighter · 6E · 5/6
   Ward. The first time this would die, it remains at 1 Health instead.

**Equipment**
9. **Martyr's Gilded Harness** — Rare · Equipment · 2E
   +3 Health. Negate the first debuff applied to the bearer.

**Hero**
10. **Canoness Aurelia** — Legendary · Fighter · 22 Health
    Passive — Faith Through Sacrifice: The first friendly Revenge effect each turn restores 2 Guard.
    Hero Power — Consecrate: 2E — A friendly character gains +1 Attack and +2 Health this turn.

---

## 4. Human Assassin Order

*Silk, shadow, velvet.*

**Basic Cards**
1. **Silkblade Enforcer** — Common · Fighter · 2E · 2/3
   +1 Attack against Marked characters.
2. **Venom Adept (F)** — Common · Mage · 2E · 1/3
   Warcry: Poison an enemy; it takes 1 damage at the end of its controller's next two turns.
3. **Moonlit Stalker** — Common · Rogue · 2E · 2/2
   Stealth.

**Spells**
4. **Veil of Black Silk** — Common · Instant · 1M
   Give a friendly character Stealth until it attacks or uses an offensive ability.
5. **Mark for Death** — Rare · Charged Spell · 2M · 2 Charges
   Mark an enemy. The next attack against it deals +2 damage. Remove a Charge.

**Faction Cards**
6. **Mistress of Sweet Venoms** — Rare · Rogue · 4E · 3/4
   Enemies damaged by your Rogues take 1 additional poison damage at end of turn.
7. **Velvet Safehouse** — Uncommon · Building · 2R · 4 Durability
   The first Rogue you play each turn enters with Stealth.
8. **The First Knife** — Epic · Rogue · 5E · 5/4
   Stealth. Warcry: Destroy an enemy character with 2 or less Health.

**Equipment**
9. **Venomglass Dagger** — Rare · Equipment · 1E
   +2 Attack. The first character damaged by the bearer becomes Poisoned.

**Hero**
10. **Mistress Vesper, First Blade** — Legendary · Rogue · 18 Health
    Passive — Clean Work: The first Marked enemy you kill each turn draws you a card.
    Hero Power — Mark: 2E — Mark an enemy. Your next Rogue attacking it gains +1 Attack.

---

## 5. Orc Might Tribe

*Visceral, direct violence.*

**Basic Cards**
1. **Orc Dominator** — Common · Fighter · 2E · 3/3
2. **Scar-Tongue Warhowler** — Common · Mage · 2E · 1/3
   Warcry: A friendly Fighter gains +1 Attack this turn.
3. **Bloodrush Huntress** — Common · Rogue · 2E · 3/1
   Charge.

**Spells**
4. **Roar of the Pit** — Common · Instant · 2M
   Damaged friendly characters gain +2 Attack this turn.
5. **Rip Them Open** — Rare · Instant · 3M
   Remove Taunt from an enemy and deal 3 damage to it.

**Faction Cards**
6. **Pit Champion** — Rare · Fighter · 4E · 4/5 *(female)*
   Frenzy: Whenever this survives damage, permanently gain +1 Attack.
7. **Pit-Bred Stud** — Rare · Fighter · 4E · 5/4 *(male counterpart to Pit Champion)*
   After surviving damage, gain +1 Attack. After dealing damage, gain +1 Health.
8. **Dominion Pit** — Uncommon · Building · 2R · 5 Durability
   The first friendly character to kill an enemy each turn gains +1 Attack permanently.
9. **Ironhide War-Matron** — Epic · Fighter · 7E · 8/7
   Cleave.

**Equipment**
10. **Dominator's Cleaver** — Rare · Equipment · 2E
    +2 Attack. Whenever the bearer kills an enemy, it gains another +1 Attack, up to +3 from this effect.

**Hero**
11. **Warboss Ugra Skullbreaker** — Legendary · Fighter · 24 Health
    Passive — Might Makes Right: The first enemy killed each turn gives your other characters +1 Attack this turn.
    Hero Power — Challenge: 2E — A friendly Fighter immediately attacks a chosen enemy and takes 2 damage afterward.

---

## 6. Orc Cunning Tribe

*Grimy, opportunistic.*

**Basic Cards**
1. **Snare-Mistress** — Common · Rogue · 2E · 2/2
   Ranged.
2. **Back-Alley Bruiser** — Common · Fighter · 2E · 2/3
   +1 Attack when attacking an Exhausted enemy.
3. **Ashskin Trick-Shaman** — Common · Mage · 2E · 1/3
   Warcry: An enemy gets -1 Attack this turn.

**Spells**
4. **Gutline Snare** — Common · Ongoing Trap · 1M
   The first enemy that Charges takes 3 damage and becomes Exhausted, then this Fizzles.
5. **Blacktooth Smoke** — Rare · Instant · 2M
   Give up to two friendly characters Stealth until your next turn.

**Faction Cards**
6. **Wolf-Riding Huntress** — Rare · Rogue · 4E · 4/3
   Charge. Warcry: Summon a 1/1 War Wolf.
7. **Crooked-Tusk Hideout** — Uncommon · Building · 2R · 4 Durability
   Your first Rogue each turn costs 1 less Energy.
8. **Cackling Powder-Goblin** — Epic · Rogue · 4E · 3/2
   Stealth. Revenge: Deal 4 damage to an enemy Building or 4 Guard damage.

**Equipment**
9. **Man-Catcher Bow** — Rare · Equipment · 2E
   +1 Attack and Ranged. Once each turn after damaging a Support character, pull it into an empty Vanguard space if possible.

**Hero**
10. **Mograt Two-Plans** — Legendary · Rogue · 19 Health
    Passive — Always Another Trick: Your first Trap each turn costs 1 less Mana.
    Hero Power — Scheme: 2E — Look at your top three cards and reorder them.

---

## 7. Orc Spirit Tribe

*Tribal, ancestral, painted.*

**Converted to real content in Phase N** (ROADMAP.md #10) under the live
`wildheart-tribes` Faction: Matron Shara Earthsong (Hero), Totem-Bound
Spearwoman, Painted Spirit-Mother, Barehide Beast-Stalker, War-Painted
Charger, Ancestor-Bound Huntress, Totem-Flesh Colossus, Blood Calls to
Blood, Grove of Painted Bones, and Spiritbone Spear — see
`src/data/cards.ts`. Revenge (`onDeath` trigger) is the set's signature
mechanic; its effect must be an AOE (`allFriendlyCreatures`) or
untargeted effect, since an `onDeath` trigger always resolves with a
`null` target — a single-target "give another friendly character +2/+1"
as originally drafted below isn't reachable that way. The draft below is
kept for its remaining unconverted cards and as a naming/tone reference.

**Basic Cards**
1. **Totem-Bound Spearwoman** — Common · Fighter · 2E · 2/4
2. **Painted Spirit-Mother** — Common · Mage · 2E · 1/3
   Warcry: If a friendly character is in your Graveyard, gain 1 Mana.
3. **Barehide Beast-Stalker** — Common · Rogue · 2E · 2/2
   Ranged. +1 Attack while you control a Beast.

**Spells**
4. **Blood Calls to Blood** — Common · Instant · 2M
   Give a friendly character Revenge: give another ally +2/+1.
5. **Spirit Walk** — Rare · Instant · 2M
   Give a friendly character Stealth and allow it to change rows without Exhausting.

**Faction Cards**
6. **Ancestor-Bound Huntress** — Rare · Fighter · 4E · 3/5
   Revenge: Give another friendly character +2/+1.
7. **Grove of Painted Bones** — Rare · Building · 3R · 5 Durability
   The first friendly character that dies each turn grants 1 Mana.
8. **Totem-Flesh Colossus** — Epic · Fighter · 6E · 6/6
   Whenever a friendly Revenge effect triggers, restore 1 Health to this and +1 Guard.

**Equipment**
9. **Spiritbone Spear** — Rare · Equipment · 2E
   +2 Attack. When its bearer dies, automatically equip this to another friendly character if possible.

**Hero**
10. **Matron Shara Earthsong** — Legendary · Mage · 20 Health
    Passive — Voices Beyond: The first friendly death each turn grants 1 Mana next turn.
    Hero Power — Ancestral Blessing: 2E — Give an ally +1/+2; if a friendly character died this turn, give +2/+2 instead.

---

## 8. Dwarven Highland Clans

*Boisterous expedition.*

**Basic Cards**
1. **Highland Axe-Maiden** — Common · Fighter · 2E · 2/4
2. **Brew Alchemist (M)** — Common · Mage · 2E · 1/3
   Warcry: Your next Equipment card costs 1 less Energy.
3. **Powder-Belt Sharpshooter** — Common · Rogue · 2E · 2/2
   Ranged.

**Spells**
4. **Blackpowder Charge** — Common · Instant · 2M
   Deal 3 damage to a character or 4 to a Building.
5. **Another Damn Treasure** — Rare · Instant · 2M
   Search the top five cards of your deck for an Equipment or Building card and draw it.

**Faction Cards**
6. **Forge-Mistress Engineer** — Rare · Fighter · 4E · 3/4
   Warcry: Repair 3 Durability to a Building.
7. **Drunken Expedition Camp** — Uncommon · Building · 2R · 5 Durability
   The first time you equip a character each turn, gain 1 Resource.
8. **Ram-Riding Daredevil** — Epic · Fighter · 6E · 5/5
   Charge. Can attack the Support row from Vanguard.

**Equipment**
9. **Widowmaker Boomstick** — Rare · Equipment · 2E
   +2 Attack and Ranged. Bearer gets -1 maximum Health.

**Hero**
10. **Thane Brunna Stormkeg** — Legendary · Fighter · 22 Health
    Passive — Prepared Expedition: Playing your first Building or Equipment each turn restores 1 Guard.
    Hero Power — Field Repairs: 2E — Repair 3 to a Building; if none are damaged, gain 1 Resource.

---

## 9. Dwarven Deep Kingdom

*Monumental, stone, ancestral.*

**Basic Cards**
1. **Vault-Bride** — Common · Fighter · 2E · 2/4
   Taunt.
2. **Runeskin Scribe** — Common · Mage · 2E · 1/3
   Warcry: Repair 2 to a Building.
3. **Deepway Huntress** — Common · Rogue · 2E · 2/2
   Can attack into an exposed backline column.

**Spells**
4. **Bar the Deepgate** — Common · Instant · 2M
   Restore 5 Guard.
5. **Rune of Unbroken Stone** — Rare · Ongoing · 2M
   A chosen Building gains +3 maximum Durability and immediately repairs 3.

**Faction Cards**
6. **Oathbound Iron Matron** — Rare · Fighter · 4E · 3/6
   Taunt. +1 Attack while you control three or more Buildings.
7. **Forge of a Thousand Fires** — Rare · Building · 3R · 7 Durability
   Equipment costs 1 less Energy to equip.
8. **Living Bastion** — Epic · Fighter · 7E · 6/9
   Taunt. Cannot gain Charge.

**Equipment**
9. **Ancestor-Forged Corslet** — Rare · Equipment · 2E
   +4 Health. Bearer cannot be moved by enemy effects.

**Hero**
10. **King Dorim Deepcrown** — Legendary · Fighter · 24 Health
    Passive — Built to Endure: Your Buildings enter play with +1 Durability.
    Hero Power — Fortify: 2E — Restore 3 Guard or repair 3 to a Building.

---

## 10. Dwarven Grudge Holds

*Legalistic vengeance.*

**Basic Cards**
1. **Grudge-Shield Matron** — Common · Fighter · 2E · 2/4
   Taunt.
2. **Hex-Breaking Runepriest** — Common · Mage · 2E · 2/2
   Warcry: Remove one Charge from an enemy Charged Spell.
3. **Debt-Seeker** — Common · Rogue · 2E · 2/2
   Ranged.

**Spells**
4. **Put It in the Damned Book** — Common · Ongoing · 1M
   Mark an enemy with Grudge. Your Dwarves gain +1 Attack against it.
5. **Debt Paid in Blood** — Rare · Instant · 3M
   Deal 4 damage to a Grudged enemy. If it dies, draw a card.

**Faction Cards**
6. **Doom-Sworn Slayer** — Rare · Fighter · 4E · 4/4
   Gains Charge if an enemy killed one of your characters last turn.
7. **Hall of Unpaid Debts** — Rare · Building · 3R · 6 Durability
   Whenever an enemy kills one of your characters, that enemy becomes Grudged.
8. **Wrath of the Ancestors** — Epic · Fighter · 6E · 5/7
   +1 Attack for each active Grudge, up to +3.

**Equipment**
9. **Debt-Collector's Axe** — Rare · Equipment · 2E
   +2 Attack, plus another +1 against Grudged enemies.

**Hero**
10. **High Reckoner Barik Stonevein** — Legendary · Fighter · 23 Health
    Passive — Never Forgotten: Any enemy that kills one of your Dwarves becomes Grudged.
    Hero Power — Collect the Debt: 2E — One ally gains +2 Attack against a Grudged enemy and may attack it.

---

## 11. Wood Elves

*Romantic, natural.*

**Basic Cards**
1. **Glade Spearmistress** — Common · Fighter · 2E · 2/3
2. **Briar Witch** — Common · Mage · 2E · 1/3
   Warcry: Restore 1 Health to a friendly character and give it +1 Attack this turn.
3. **Greenveil Huntress** — Common · Rogue · 2E · 2/2
   Ranged.

**Spells**
4. **Lover's Thorns** — Common · Instant · 2M
   An enemy cannot attack or change position during its next turn.
5. **Hunt Beneath the Moon** — Rare · Instant · 2M
   Friendly characters gain +1 Attack against damaged enemies this turn. Rogues gain +2 instead.

**Faction Cards**
6. **Dryad Dancer** — Rare · Fighter · 4E · 3/4
   Whenever this changes rows, restore 1 Health to it.
7. **Grove of the Wild Heart** — Rare · Building · 3R · 5 Durability
   At the start of your turn, restore 2 Health to your most damaged friendly character.
8. **White-Stag Huntress** — Epic · Rogue · 6E · 5/5
   Can change rows without Exhausting once each turn.

**Equipment**
9. **Moonvine Bow** — Rare · Equipment · 2E
   +2 Attack and Ranged. If the bearer was already Ranged, it deals +1 damage against Support-row enemies.

**Hero**
10. **Sylwen, Huntress of the First Grove** — Legendary · Rogue · 19 Health
    Passive — Unseen Paths: Your first Rogue played each turn gains Stealth until the end of that turn.
    Hero Power — Hunt: 2E — Deal 1 damage to an enemy, or 2 if it is already damaged.

---

## 12. High Elves

*Gilded, precise, court.*

**Basic Cards**
1. **Sunspire Spear-Maiden** — Common · Fighter · 2E · 2/3
   Gains Ward until it first attacks.
2. **Veiled Seeress** — Common · Mage · 2E · 1/3
   Warcry: Look at the top two cards of your deck and reorder them.
3. **Silverwind Archer** — Common · Rogue · 2E · 2/2
   Ranged.

**Spells**
4. **Perfect Rebuttal** — Uncommon · Instant · 2M
   Counter an enemy Spell costing 2 Mana or less.
5. **Unclouded Sight** — Rare · Instant · 2M
   Draw a card, then look at your next two cards and reorder them.

**Faction Cards**
6. **Gilded Sword-Dancer** — Rare · Fighter · 4E · 4/4
   The first damage this takes each turn is reduced by 1.
7. **Spire of Flawless Glass** — Rare · Building · 3R · 5 Durability
   Your first damaging or healing Spell each turn gains +1 potency.
8. **Sun-Dragon Consort** — Epic · Fighter · 7E · 6/6
   Charge. Ward. Can attack Support-row characters.

**Equipment**
9. **Glaive of the Golden Court** — Rare · Equipment · 2E
   +2 Attack. If bearer has Ward, also +1 Health.

**Hero**
10. **Princess Elyra Starweaver** — Legendary · Mage · 19 Health
    Passive — Perfect Foresight: The first card you draw each turn is revealed; if it is a Spell or Mage, gain 1 Mana.
    Hero Power — Foresight: 2E — Look at the top three cards of your deck and reorder them.

---

## 13. Dark Elves

*Cruel dominance.*

**Basic Cards**
1. **House Blade** — Common · Fighter · 2E · 3/2
2. **Blood Witch** — Common · Mage · 2E · 1/3
   Warcry: You may deal 1 damage to another friendly character to gain 2 Mana.
3. **Silkshade Corsair** — Common · Rogue · 2E · 2/2
   Stealth.

**Spells**
4. **A Little Pain** — Common · Instant · 1M
   Deal 2 damage to a friendly character. Draw two cards.
5. **Obey Me** — Rare · Instant · 2M
   A friendly character gains +3 Attack this turn. After it attacks, deal 2 damage to it.

**Faction Cards**
6. **Witchblade Dancer** — Rare · Fighter · 4E · 4/3
   Whenever one of your characters takes damage from your own card, gain +1 Attack this turn.
7. **Menagerie of Chains** — Rare · Building · 3R · 6 Durability
   Your first Beast or Monster character each turn costs 1 less Energy.
8. **Hydra Mistress** — Epic · Mage · 6E · 4/5
   Warcry: Summon two 2/2 Hydra Heads into empty adjacent spaces.

**Equipment**
9. **Mistress's Barbed Lash** — Rare · Equipment · 1E
   +1 Attack. Once per turn, deal 1 damage to another friendly character to give the bearer +2 Attack this turn.

**Hero**
10. **Lady Vaelith, Thorn of Night** — Legendary · Rogue · 19 Health
    Passive — Cruelty: The first ally damaged by one of your own cards each turn permanently gains +1 Attack.
    Hero Power — Bloodletting: 2E — Deal 1 damage to an ally and draw a card.

*Note: Silk Stalker belongs exclusively to Demons of Excess (§16), not here.*

---

## 14. Dominion — Demons of War

*Conquest, slaughter.*

**Basic Cards**
1. **Hell-Bred Dominator** — Common · Fighter · 2E · 3/3
2. **Tongue-of-War Seer** — Common · Mage · 2E · 2/2
   Warcry: If the enemy lost Guard this turn, gain 1 Mana.
3. **Chain-Tongued Huntress** — Common · Rogue · 2E · 3/1
   Can attack Support-row characters.

**Spells**
4. **Give Them No Mercy** — Common · Instant · 2M
   Two friendly characters gain +2 Attack this turn.
5. **Drink the Slaughter** — Rare · Instant · 2M
   For every enemy character that died this turn, gain 1 temporary Energy next turn, up to 3.

**Faction Cards**
6. **Fleshbound Ravager** — Rare · Fighter · 4E · 5/4
   Cleave.
7. **Gate of Red Dominion** — Rare · Building · 3R · 6 Durability
   Your first Demon Fighter each turn costs 1 less Energy.
8. **Fourfold Butcheress** — Epic · Fighter · 8E · 8/8
   Massive — occupies two adjacent spaces. Cleave. May attack twice each turn.

**Equipment**
9. **Cleaver of Submission** — Rare · Equipment · 2E
   +3 Attack. After the bearer attacks, it takes 1 damage.

**Hero**
10. **Vharaxa, Lady of Dominion** — Legendary · Fighter · 25 Health
    Passive — Slaughter Begets Slaughter: The first enemy killed each turn gives your remaining characters +1 Attack that turn.
    Hero Power — Command Slaughter: 2E — One friendly Fighter immediately attacks and takes 2 damage afterward.

---

## 15. Demons of Whispers

*Manipulation, bargains.*

**Basic Cards**
1. **Oath-Bound Seducer** — Common · Fighter · 2E · 2/4
   +1 Attack while you control an Ongoing Spell.
2. **Ink-Tongued Scribe** — Common · Mage · 2E · 1/3
   Warcry: Your next Contract or Ongoing Spell costs 1 less Mana.
3. **Bedroom Whisperer** — Common · Rogue · 2E · 2/2
   Stealth. When it damages the enemy Hero, reveal a random card in their hand.

**Spells**
4. **Devil's Bargain** — Common · Instant · 1M
   Both players draw a card. You gain 1 Mana; your opponent restores 2 Guard.
5. **Just Trust Me** — Rare · Ongoing · 2M
   The next enemy Warcry is also resolved for you where possible, then this Fizzles.

**Faction Cards**
6. **Velvet-Tongued Broker** — Rare · Mage · 4E · 3/5
   Warcry: Opponent chooses: you draw a card, or you gain 2 Mana.
7. **Hall of Borrowed Faces** — Rare · Building · 3R · 5 Durability
   The first time an opponent buffs one of their characters each turn, give a random friendly character +1 Attack.
8. **Face-Stealer** — Epic · Rogue · 5E · 4/4
   Stealth. Warcry: Copy the rules text of an enemy character until that character leaves play.

**Equipment**
9. **Signet of Sweet Lies** — Rare · Equipment · 1E
   +2 Health. The first time the opponent casts a Spell each turn, bearer gains +1 Attack that turn.

**Hero**
10. **Nysara, Broker of Souls** — Legendary · Rogue · 18 Health
    Passive — Corrupting Influence: Your deck may contain up to six non-Whispers faction characters. They gain +1 Attack when played, but your native Demon characters have -1 maximum Health.
    Hero Power — An Offer: 2E — Opponent chooses: you draw a card, or you gain 2 Mana.

---

## 16. Demons of Excess

*Hedonism, indulgence.*

**Basic Cards**
1. **Velvet-Bound Temptress** — Common · Fighter · 2E · 2/3
   Whenever this receives a buff, restore 1 Health to it.
2. **Adept of Aching Desire** — Common · Mage · 2E · 1/3
   Warcry: The next buff you apply this turn gains +1 Attack.
3. **Silk Stalker** — Common · Rogue · 2E · 2/2
   Stealth.

**Spells**
4. **Just One More** — Common · Instant · 1M
   Give an ally +2/+2 this turn. At end of turn, deal 2 damage to it.
5. **Irresistible Invitation** — Rare · Instant · 3M
   Temporarily take control of an enemy with 3 or less Attack until end of turn. It may attack its former controller.

**Faction Cards**
6. **Velvet-Horn Succubus** — Rare · Mage · 4E · 3/4
   Warcry: An enemy gets -2 Attack until your next turn.
7. **Palace of Excess** — Rare · Building · 3R · 5 Durability
   The first time you spend four or more total resources during a turn, draw a card.
8. **Exalted Flesh-Reveler** — Epic · Fighter · 6E · 5/5
   Whenever this receives an Attack buff, increase that buff by another +1. If it reaches 10+ Attack, it takes 2 damage at end of turn.

**Equipment**
9. **Lash of Delirium** — Rare · Equipment · 1E
   +1 Attack. Characters damaged by bearer get -1 Attack during their next turn.

**Hero**
10. **Xyphera, the Unending Want** — Legendary · Mage · 19 Health
    Passive — Never Enough: The first character you buff each turn gains another +1 Attack that turn.
    Hero Power — Tempt: 2E — An enemy gets -1 Attack this turn and a friendly character gains +1 Attack.

---

## 17. Celestial Host

*Radiant, martial-holy.*

**Basic Cards**
1. **Golden-Halo Spear-Maiden** — Common · Fighter · 2E · 2/4
   Taunt.
2. **Barefoot Lightbearer** — Common · Mage · 2E · 1/3
   Warcry: Restore 2 Guard.
3. **Winged Huntress** — Common · Rogue · 2E · 2/2
   Ranged.

**Spells**
4. **Heaven's Touch** — Common · Instant · 2M
   Restore 4 Health to a character or 3 Guard.
5. **Wrath from Above** — Rare · Instant · 3M
   Deal 4 damage, or 6 to a Demon.

**Faction Cards**
6. **Gilded Seraph Champion** — Rare · Fighter · 4E · 4/5
   Ward.
7. **Gate of Dawn** — Rare · Building · 3R · 6 Durability
   The first Angel you play each turn restores 1 Guard.
8. **Thronewarden** — Epic · Fighter · 6E · 5/7
   Taunt. The first other friendly character that would die after this enters play instead survives at 1 Health.

**Equipment**
9. **Dawnshield** — Rare · Equipment · 2E
   +3 Health and Ward.

**Hero**
10. **Archangel Caelia, First Light** — Legendary · Fighter · 23 Health
    Passive — Celestial Aegis: The first friendly Ward broken each turn restores 2 Guard.
    Hero Power — Blessing: 2E — Give a friendly character Ward until your next turn.

---

## 18. Earthbound Angels

*Humble, companionable.*

**Basic Cards**
1. **Roadwarden Angel** — Common · Fighter · 2E · 2/3
2. **Hearthside Angel** — Common · Mage · 2E · 1/3
   Warcry: Restore 2 Health to a friendly character.
3. **Laughing Sky-Huntress** — Common · Rogue · 2E · 2/2
   Ranged. Warcry: If your Guard is damaged, restore 1 Guard.

**Spells**
4. **You Are Not Alone** — Common · Instant · 2M
   Give a friendly character +1/+2.
5. **Not This One** — Rare · Instant · 2M
   Prevent the next 4 damage that would be dealt to a friendly character or your Hero this turn.

**Faction Cards**
6. **Tavern Angel** — Rare · Fighter · 3E · 3/3
   Warcry: Restore 2 Guard. If your Guard was already full, gain 1 Energy next turn instead.
7. **The Angel's Rest** — Uncommon · Building · 2R · 5 Durability
   At the end of your turn, restore 1 Health to your most damaged friendly character.
8. **Heaven-Touched Champion** — Epic · Fighter · 5E · 5/5
   Counts as both Human and Angel. Whenever an Angel buffs it, it gains Ward.

**Equipment**
9. **Travel-Stained Angelcloak** — Uncommon · Equipment · 1E
   +2 Health. The first time bearer heals or protects another character each turn, bearer gains +1 Health.

**Hero**
10. **Tessael, Friend of Mortals** — Legendary · Mage · 20 Health
    Passive — Among Them: Non-Angel characters in your deck may count as Earthbound for Allegiance. The first such character played each turn gains +1 Health.
    Hero Power — Encouragement: 2E — Give a friendly character +1/+1.

---

## 19. Purist Angels

*Sterile perfectionism.*

**Basic Cards**
1. **Immaculate Executioner** — Common · Fighter · 2E · 2/3
   +1 Attack against characters carrying a debuff.
2. **White-Robed Liturgist** — Common · Mage · 2E · 1/3
   Warcry: Remove one debuff from a friendly character.
3. **Unblinking Examiner** — Common · Rogue · 2E · 2/2
   Ranged. Deals +1 damage to buffed enemies.

**Spells**
4. **Remove the Flaw** — Common · Instant · 2M
   Remove all buffs and debuffs from one character. If friendly, restore 2 Health; if enemy, deal 2 damage.
5. **You Will Be Silent** — Rare · Instant · 3M
   Target character loses its rules text until the beginning of your next turn.

**Faction Cards**
6. **Naked Blade of Judgement** — Rare · Fighter · 4E · 4/4
   Warcry: If an enemy is buffed or debuffed, remove one effect and deal 2 damage to it.
7. **Hall of Perfect Proportion** — Rare · Building · 3R · 6 Durability
   Friendly characters with no buffs or debuffs have +1 Health.
8. **Seraph of Perfect Flesh** — Epic · Fighter · 6E · 6/6
   Ward. While none of your characters are debuffed, this has +2 Attack.

**Equipment**
9. **Halo of Flawless Steel** — Rare · Equipment · 2E
   +2 Health. Bearer cannot receive enemy debuffs.

**Hero**
10. **Ilyon, Axiom Seraph** — Legendary · Mage · 21 Health
    Passive — Absolute Order: At the beginning of your turn, if none of your characters are debuffed, restore 2 Guard.
    Hero Power — Purge: 2E — Remove one buff or debuff. If removed from an enemy, deal 1 damage to it; if from an ally, restore 1 Health.

---

## Established Neutral-world cultures, realms and organizations

These identities are currently being established through Neutral cards and worldbuilding. They are **setting cultures, realms, houses, cities or organizations**, not automatically separate playable deck factions. Keep them Neutral unless a later design decision explicitly promotes one into a playable faction identity.

### Lorthaine

Lorthaine is a refined martial culture whose defining tradition is **swordsmanship**. The Lorthaine remain the setting's principal **swordmaster culture**: disciplined, aristocratic and technically accomplished rather than brutish.

The redesigned **Lorthaine Elite Veteran** pushes their visual language further toward a Renaissance duelist/warrior direction — elegant battlefield dress, refined armor and a stronger fencing/dueling influence. This is a visual evolution, not a change to their core identity as swordsmasters.

**Anchor card:** Lorthaine Elite Veteran.

**Important separation:** Captain of the Citadel is **not** Lorthaine.

### Shenkai

Shenkai is the current name for the eastern culture previously being developed under the working name **Demenese**. Its visual and cultural direction blends **Mongolian and Chinese influences** rather than western medieval styling.

The culture should support mobile eastern warfare: skirmishers, scouts, horse archers, lancers, spear troops and disciplined banner-bearing warriors. Exact political structure and deeper history remain open for later worldbuilding.

**Card rename:** Demenese Skirmisher → **Shenkai Skirmisher** (`Shenkai-Skirmisher` as the asset/card ID style).

### Averaine and Whitebough

Averaine is a southern human realm/culture associated with broad **grasslands, forests, river valleys and fertile settled country**. Its visual identity is more prosperous and temperate than Gestmane's demonic frontier or the harsher northern cultures.

Its heraldry is strongly established by **blue-and-white checkering with a silver tree emblem**.

**Whitebough** is the major stronghold/seat associated with this identity. Its formal lore name is:

**The Silver Citadel of Whitebough**

The **Captain of the Citadel** is associated with the Silver Citadel of Whitebough and therefore with the Averaine sphere. She should not be folded into either Lorthaine or Gestmane.

Working relationship:
- **Averaine** — southern realm/culture.
- **Whitebough** — important seat/region within that realm.
- **The Silver Citadel of Whitebough** — major fortress and military/political stronghold.
- **Captain of the Citadel** — officer/commander associated with that stronghold.

### Cult of Embers

The **Cult of Embers** is an established fire-zealot organization centered on reverence for **flame, sacred fire and fire gods**. It should feel religious and fanatical rather than merely like a school of pyromancers: flame can be treated as revelation, purification, destruction and renewal.

**Anchor card:** Salazar of the Ember.

Salazar belongs to the Cult of Embers and is one of its first major named figures.

### Gestmane — working frontier identity

Gestmane is not yet fully locked, but the strongest current direction is:

- **House of Gestmane** — the ruling or central noble house.
- **Gestmane Fortress City** — a great fortified border city.
- The city stands on the frontier between the **demonic wastelands** and the **civilized world**.

This makes Gestmane a natural culture of fortress warfare, vigilance, garrisons, watchtowers, signal fires, siege defense and generations of soldiers shaped by the demonic frontier.

**Anchor card:** Warhorn of Gestmane.

The exact constitutional structure, history and final relationship between House Gestmane and the city remain open. Do not treat the above working direction as more specific than currently established.

**Important separation:** Captain of the Citadel is **not** Gestmane.

### Skaldjborn

A northern Norse/Viking-inspired people with a strong shieldwall and warrior tradition. Their identity includes axes, shields, war paint, braids, runic details and disciplined formation fighting alongside raiding/frontier imagery.

**Anchor cards:** Skaldjborn Shield-Sister, Skaldjborn Shieldwall Veteran, Skaldjborn Shieldbreaker.

### Cimbar

A barbarian culture inspired more by **Conan/Cimmeria** than by the Norse. Their visual language favors leather, black iron or bronze, scars, axes and hard individualistic warbands rather than Skaldjborn-style shieldwall identity.

**Anchor card:** Cimbar Berserker.

### Klamet

A desert/Arabian-inspired town or city known especially for **pit fighting and public arena combat**. Sandstone, bronze, linen, curved weapons, dust and spectacle are natural visual anchors.

**Anchor card:** Pit Fighter of Klamet.

### Golden Company

An independent mercenary organization rather than a nation. Its identity is professional, elite and expensive: disciplined sellswords, blackened steel, gold/brass details and a battle-worn but prestigious military look.

**Anchor card:** Golden Company Captain.

### Arcane Industries Consortium

The **Arcane Industries Consortium** is not a nation. It is a Gnome-founded and predominantly Gnome-run commercial and research establishment devoted to combining **arcane magic with engineering, manufacturing and invention**. In gameplay it may use the live `arcane-industries` Faction tag, but in lore that tag represents organizational affiliation rather than a sovereign realm.

Its core identity is **applied magic**. Gnomish engineers and arcanists build contraptions, arcane-powered machinery, crystal-driven devices, automated defenses, constructs, tools and experimental prototypes. Workshops and research facilities should feel like fantasy industrial laboratories: brass, copper, dark iron, gauges, lenses, rune-work, glowing conduits, violet/blue arcane crystals and magically suspended mechanisms.

Arcane Industries should be capable, wealthy and technologically formidable rather than a purely comedic Gnome faction. Eccentric inventors and dangerous prototypes can exist, but the organization itself takes its work and commerce seriously and can operate workshops, research enclaves and commercial facilities throughout the civilized world.

**Important boundary:** Arcane magic or arcane machinery does **not** automatically mean Arcane Industries. The Consortium is one major organization working in this field, not the inventor or owner of all arcane magic and technology.

**Current anchors:** Archivist and Arcane Turret are direct organizational fits. Other existing arcane cards should only be associated with the Consortium when explicitly decided.

### Currently unaffiliated

**Flankguard Outrider** remains culturally unaffiliated for now. The armored unicorn cavalry concept may eventually seed its own chivalric or regional tradition, but no culture should be assigned yet.

---

## Conversion checklist before an archetype becomes a real card set

The creative identities in this file remain valid, but each mini-set should be converted against the Phase-K engine and the authoritative Neutral Core balance. Priority checks:

1. **Temporary effects:** many cards say “this turn”, “next turn” or “until your next turn”. A generic duration/temporary-modifier primitive is planned and should land before those cards are implemented literally.
2. **Deck look/search/reorder:** several Mage/High-Elf/Rogue concepts need top-N reveal/choose/reorder rather than the current simple draw effects.
3. **Mark / Grudge / Trap / Counter windows:** implement only when the first real mini-set needs them; keep them faction/archetype-specific rather than bloating the universal keyword pool.
4. **Legacy keyword conversion:** Stealth → Vanish; old Frenzy wording → current Frenzy/Enrage/Bloodied/bespoke mechanic as appropriate.
5. **Equipment economy:** convert printed Equipment play costs to Resources; assignment remains 1 Energy.
6. **Temporary control / rules copying / silence / buff removal:** treat as bespoke or new engine primitives only when an authored card justifies the complexity.
7. **Creature roles:** review cards currently called Rogue/Fighter/Mage against the live CreatureType philosophy. Assassin and Shadow Infiltrator are obvious future candidates for a planned `rogue` CreatureType. Defender is a tactical role (high durability/defensive tools), not a Race.
8. **World identity:** do not infer that “Kingdom”, “Mage Order”, “High Elves”, etc. are each one sovereign nation. They are gameplay archetypes until WORLD.md establishes otherwise.
9. **Balance:** compare against the implemented 59-card Neutral Core, not only the old working curve at the top of this file.
10. **Art/fan-service identity:** preserve each archetype's established adult grimdark/fan-service vocabulary when converting names and visuals; mechanical cleanup should not sand away the intended tone.