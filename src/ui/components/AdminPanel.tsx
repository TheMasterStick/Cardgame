import { useState } from "react";
import { CARD_DEFINITIONS } from "../../data/cards";
import {
  ELEMENT_OPTIONS,
  EQUIPMENT_CATEGORY_OPTIONS,
  FACTION_OPTIONS,
  HERO_CLASS_OPTIONS,
  KEYWORD_OPTIONS,
  RACE_OPTIONS,
  RARITY_OPTIONS,
  STATUS_OPTIONS,
  ELEMENT_LABELS,
  EQUIPMENT_CATEGORY_LABELS,
  FACTION_LABELS,
  HERO_CLASS_LABELS,
  RACE_LABELS,
  RARITY_LABELS,
  KEYWORD_LABELS,
  STATUS_LABELS,
} from "../../data/taxonomy";
import { saveRemoteCard, uploadCardArt } from "../../lib/adminCards";
import type { Collection } from "../../engine/collection";
import { createCardInstance } from "../../engine/factory";
import type {
  BuildingDefinition,
  CardArchetype,
  CardDefinition,
  CardEffect,
  Element,
  EquipmentCategory,
  Faction,
  HeroClass,
  Keyword,
  Race,
  Rarity,
  StatusType,
  Trigger,
  TriggerName,
} from "../../engine/types";
import { CardView } from "./CardView";

interface AdminPanelProps {
  collection: Collection;
  userId: string;
  onSetCoins: (coins: number) => void;
  onCardsChanged: () => Promise<void>;
  onBack: () => void;
}

const ARCHETYPES: CardArchetype[] = ["hero", "creature", "building", "spell", "ability", "equipment"];
const EFFECT_KINDS: CardEffect["kind"][] = [
  "damage",
  "heal",
  "applyStatus",
  "buff",
  "drawCard",
  "gainGuard",
  "gainCap",
  "summonCreature",
  "consume",
  "transform",
  "garrison",
];
const CREATURE_TRIGGER_NAMES: TriggerName[] = ["onPlay", "onAttack", "onDeath", "onDefend", "startOfTurn", "endOfTurn"];
const TARGET_OPTIONS = [
  "targetCreature",
  "targetBuilding",
  "targetCreatureOrBuilding",
  "targetAny",
  "targetPlayer",
  "allEnemyCreatures",
  "allFriendlyCreatures",
  "selfHero",
] as const;

interface CardDraft {
  id: string;
  name: string;
  archetype: CardArchetype;
  cost: number;
  rarity: Rarity;
  text: string;
  art: string;
  element: Element | "";
  faction: Faction | "";
  races: Race[];
  heroClass: HeroClass;
  attack: number;
  hp: number;
  keywords: Keyword[];
  spellForm: "instant" | "ritual" | "charged";
  abilityForm: "instant" | "activated";
  activateCost: number;
  charges: number | "unlimited";
  attackBonus: number;
  damageReduction: number;
  equipmentCategory: EquipmentCategory;
  triggerOn: TriggerName | "none";
  effectKind: CardEffect["kind"] | "none";
  effectAmount: number;
  effectTarget: (typeof TARGET_OPTIONS)[number];
  effectStatus: StatusType;
  effectDuration: number;
  effectAttackDelta: number;
  effectHpDelta: number;
  /** Buff only (ROADMAP.md #7): turns until the buff expires. 0 = the original permanent buff. */
  buffDuration: number;
  effectPool: "resource" | "mana" | "energy";
  effectCreatureId: string;
  /** Swarm only (summonCreature's count field, DESIGN.md §16) — how many copies to summon at once. */
  effectCount: number;
  /** Building only: whether the Effect fieldset below describes the On Construction trigger or the activated ability (DESIGN.md §11) — reuses activateCost/effectPool for the ability's cost/pool, same fields Spell/Ability already use. */
  buildingEffectTarget: "trigger" | "ability";
  buildingPassiveEnabled: boolean;
  buildingPassiveFilterKind: "all" | "race" | "faction";
  buildingPassiveFilterValue: Race | Faction | "";
}

function emptyDraft(): CardDraft {
  return {
    id: "",
    name: "",
    archetype: "creature",
    cost: 1,
    rarity: "common",
    text: "",
    art: "",
    element: "",
    faction: "",
    races: [],
    heroClass: "fighter",
    attack: 1,
    hp: 1,
    keywords: [],
    spellForm: "ritual",
    abilityForm: "activated",
    activateCost: 1,
    charges: 1,
    attackBonus: 0,
    damageReduction: 0,
    equipmentCategory: "weapon",
    triggerOn: "none",
    effectKind: "none",
    effectAmount: 1,
    effectTarget: "targetCreature",
    effectStatus: "poison",
    effectDuration: 2,
    effectAttackDelta: 1,
    effectHpDelta: 1,
    buffDuration: 0,
    effectPool: "resource",
    effectCreatureId: "",
    effectCount: 1,
    buildingEffectTarget: "trigger",
    buildingPassiveEnabled: false,
    buildingPassiveFilterKind: "all",
    buildingPassiveFilterValue: "",
  };
}

function loadEffectIntoDraft(draft: CardDraft, effect: CardEffect): void {
  draft.effectKind = effect.kind;
  if (effect.kind === "damage" || effect.kind === "heal") {
    draft.effectAmount = effect.amount;
    draft.effectTarget = effect.target as CardDraft["effectTarget"];
  } else if (effect.kind === "applyStatus") {
    draft.effectAmount = effect.amount;
    draft.effectTarget = effect.target as CardDraft["effectTarget"];
    draft.effectStatus = effect.status;
    draft.effectDuration = effect.duration ?? 2;
  } else if (effect.kind === "buff") {
    draft.effectTarget = effect.target as CardDraft["effectTarget"];
    draft.effectAttackDelta = effect.attackDelta ?? 0;
    draft.effectHpDelta = effect.hpDelta ?? 0;
    draft.buffDuration = effect.duration ?? 0;
  } else if (effect.kind === "drawCard" || effect.kind === "gainGuard") {
    draft.effectAmount = effect.amount;
  } else if (effect.kind === "gainCap") {
    draft.effectAmount = effect.amount;
    draft.effectPool = effect.pool;
  } else if (effect.kind === "summonCreature") {
    draft.effectCreatureId = effect.creatureId;
    draft.effectCount = effect.count ?? 1;
  } else if (effect.kind === "consume") {
    draft.effectTarget = effect.target as CardDraft["effectTarget"];
    draft.effectAttackDelta = effect.attackDelta ?? 0;
    draft.effectHpDelta = effect.hpDelta ?? 0;
  } else if (effect.kind === "transform") {
    draft.effectTarget = effect.target as CardDraft["effectTarget"];
    draft.effectCreatureId = effect.creatureId;
  } else if (effect.kind === "garrison") {
    draft.effectTarget = effect.target as CardDraft["effectTarget"];
  }
}

function draftFromCard(def: CardDefinition): CardDraft {
  const draft = emptyDraft();
  draft.id = def.id;
  draft.name = def.name;
  draft.archetype = def.archetype;
  draft.cost = def.cost;
  draft.rarity = def.rarity;
  draft.text = def.text ?? "";
  draft.art = def.art ?? "";
  draft.element = def.element ?? "";
  draft.faction = def.faction ?? "";
  draft.races = def.races ?? [];

  if (def.archetype === "hero") {
    draft.attack = def.attack;
    draft.hp = def.hp;
    draft.heroClass = def.class;
  } else if (def.archetype === "creature") {
    draft.attack = def.attack;
    draft.hp = def.hp;
    draft.keywords = def.keywords;
    if (def.triggers[0]) {
      draft.triggerOn = def.triggers[0].on;
      loadEffectIntoDraft(draft, def.triggers[0].effect);
    }
  } else if (def.archetype === "building") {
    draft.hp = def.hp;
    if (def.passive) {
      draft.buildingPassiveEnabled = true;
      draft.buildingPassiveFilterKind = def.passive.filter === "all" ? "all" : "race" in def.passive.filter ? "race" : "faction";
      draft.buildingPassiveFilterValue =
        def.passive.filter === "all" ? "" : "race" in def.passive.filter ? def.passive.filter.race : def.passive.filter.faction;
      draft.effectAttackDelta = def.passive.attackDelta;
    }
    if (def.ability) {
      draft.buildingEffectTarget = "ability";
      draft.activateCost = def.ability.activateCost;
      draft.effectPool = def.ability.pool ?? "resource";
      loadEffectIntoDraft(draft, def.ability.effect);
    } else if (def.triggers[0]) {
      draft.buildingEffectTarget = "trigger";
      draft.triggerOn = def.triggers[0].on;
      loadEffectIntoDraft(draft, def.triggers[0].effect);
    }
  } else if (def.archetype === "spell") {
    draft.spellForm = def.spellForm;
    if (typeof def.activateCost === "number") draft.activateCost = def.activateCost;
    if (def.charges !== undefined) draft.charges = def.charges;
    loadEffectIntoDraft(draft, def.effect);
  } else if (def.archetype === "ability") {
    draft.abilityForm = def.abilityForm;
    if (typeof def.activateCost === "number") draft.activateCost = def.activateCost;
    if (def.charges !== undefined) draft.charges = def.charges;
    loadEffectIntoDraft(draft, def.effect);
  } else if (def.archetype === "equipment") {
    draft.attackBonus = def.attackBonus;
    draft.damageReduction = def.damageReduction;
    draft.equipmentCategory = def.category;
  }
  return draft;
}

function buildEffect(draft: CardDraft): CardEffect | null {
  switch (draft.effectKind) {
    case "damage":
      return { kind: "damage", amount: draft.effectAmount, target: draft.effectTarget };
    case "heal":
      return { kind: "heal", amount: draft.effectAmount, target: draft.effectTarget };
    case "applyStatus":
      return {
        kind: "applyStatus",
        status: draft.effectStatus,
        amount: draft.effectAmount,
        duration: draft.effectDuration,
        target: draft.effectTarget,
      };
    case "buff":
      return {
        kind: "buff",
        attackDelta: draft.effectAttackDelta || undefined,
        hpDelta: draft.effectHpDelta || undefined,
        target: draft.effectTarget,
        duration: draft.buffDuration || undefined,
      };
    case "drawCard":
      return { kind: "drawCard", amount: draft.effectAmount };
    case "gainGuard":
      return { kind: "gainGuard", amount: draft.effectAmount };
    case "gainCap":
      return { kind: "gainCap", pool: draft.effectPool, amount: draft.effectAmount };
    case "summonCreature":
      return draft.effectCreatureId.trim()
        ? { kind: "summonCreature", creatureId: draft.effectCreatureId.trim(), count: draft.effectCount > 1 ? draft.effectCount : undefined }
        : null;
    case "consume":
      return {
        kind: "consume",
        target: draft.effectTarget,
        attackDelta: draft.effectAttackDelta || undefined,
        hpDelta: draft.effectHpDelta || undefined,
      };
    case "transform":
      return draft.effectCreatureId.trim()
        ? { kind: "transform", target: draft.effectTarget, creatureId: draft.effectCreatureId.trim() }
        : null;
    case "garrison":
      return { kind: "garrison", target: draft.effectTarget };
    default:
      return null;
  }
}

function buildCardDefinition(draft: CardDraft): CardDefinition | { error: string } {
  const id = draft.id.trim();
  if (!id) return { error: "Card ID is required." };
  if (!/^[a-z0-9-]+$/.test(id)) return { error: "Card ID must be lowercase letters, numbers, and hyphens only." };
  if (!draft.name.trim()) return { error: "Name is required." };

  const base = {
    id,
    name: draft.name.trim(),
    cost: draft.cost,
    rarity: draft.rarity,
    text: draft.text.trim() || undefined,
    art: draft.art || undefined,
    element: draft.element || undefined,
    faction: draft.faction || undefined,
    races: draft.races.length > 0 ? draft.races : undefined,
  };

  if (draft.archetype === "hero") {
    return { ...base, archetype: "hero", attack: draft.attack, hp: draft.hp, class: draft.heroClass };
  }
  if (draft.archetype === "creature") {
    const effect = buildEffect(draft);
    const triggers: Trigger[] = draft.triggerOn !== "none" && effect ? [{ on: draft.triggerOn, effect }] : [];
    return { ...base, archetype: "creature", attack: draft.attack, hp: draft.hp, keywords: draft.keywords, triggers };
  }
  if (draft.archetype === "building") {
    const passive: BuildingDefinition["passive"] = draft.buildingPassiveEnabled
      ? {
          kind: "auraBuff",
          filter:
            draft.buildingPassiveFilterKind === "all"
              ? "all"
              : draft.buildingPassiveFilterKind === "race"
                ? { race: draft.buildingPassiveFilterValue as Race }
                : { faction: draft.buildingPassiveFilterValue as Faction },
          attackDelta: draft.effectAttackDelta,
        }
      : undefined;
    const effect = buildEffect(draft);
    if (draft.buildingEffectTarget === "ability") {
      if (!effect) return { error: "Choose an effect for this Building's activated ability." };
      const ability: BuildingDefinition["ability"] = { effect, activateCost: draft.activateCost, pool: draft.effectPool };
      return { ...base, archetype: "building", hp: draft.hp, triggers: [], passive, ability };
    }
    const triggers: Trigger[] = draft.triggerOn !== "none" && effect ? [{ on: draft.triggerOn, effect }] : [];
    return { ...base, archetype: "building", hp: draft.hp, triggers, passive };
  }
  if (draft.archetype === "spell") {
    const effect = buildEffect(draft);
    if (!effect) return { error: "Choose an effect for this Spell." };
    if (draft.spellForm === "instant") {
      return { ...base, archetype: "spell", spellForm: "instant", effect };
    }
    return { ...base, archetype: "spell", spellForm: draft.spellForm, activateCost: draft.activateCost, charges: draft.charges, effect };
  }
  if (draft.archetype === "ability") {
    const effect = buildEffect(draft);
    if (!effect) return { error: "Choose an effect for this Ability." };
    if (draft.abilityForm === "instant") {
      return { ...base, archetype: "ability", abilityForm: "instant", effect };
    }
    return { ...base, archetype: "ability", abilityForm: "activated", activateCost: draft.activateCost, charges: draft.charges, effect };
  }
  // equipment
  return {
    ...base,
    archetype: "equipment",
    category: draft.equipmentCategory,
    attackBonus: draft.attackBonus,
    damageReduction: draft.damageReduction,
  };
}

export function AdminPanel({ collection, userId, onSetCoins, onCardsChanged, onBack }: AdminPanelProps) {
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<CardDraft>(emptyDraft());
  const [editingExistingId, setEditingExistingId] = useState<string | null>(null);
  const [artFile, setArtFile] = useState<File | null>(null);
  const [artPreview, setArtPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<string>("");
  const [goldInput, setGoldInput] = useState(String(collection.coins));

  const allCards = Object.values(CARD_DEFINITIONS)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  function startCreate() {
    setDraft(emptyDraft());
    setEditingExistingId(null);
    setArtFile(null);
    setArtPreview(null);
    setFormMessage("");
    setMode("edit");
  }

  function startEdit(def: CardDefinition) {
    setDraft(draftFromCard(def));
    setEditingExistingId(def.id);
    setArtFile(null);
    setArtPreview(def.art ?? null);
    setFormMessage("");
    setMode("edit");
  }

  function toggleKeyword(keyword: Keyword) {
    setDraft((d) => ({
      ...d,
      keywords: d.keywords.includes(keyword) ? d.keywords.filter((k) => k !== keyword) : [...d.keywords, keyword],
    }));
  }

  function toggleRace(race: Race) {
    setDraft((d) => ({
      ...d,
      races: d.races.includes(race) ? d.races.filter((r) => r !== race) : [...d.races, race],
    }));
  }

  function handleFileChange(file: File | null) {
    setArtFile(file);
    if (artPreview && artPreview.startsWith("blob:")) URL.revokeObjectURL(artPreview);
    setArtPreview(file ? URL.createObjectURL(file) : draft.art || null);
  }

  async function handleSave() {
    setFormMessage("");
    const isNew = !editingExistingId;
    if (isNew && CARD_DEFINITIONS[draft.id.trim()]) {
      setFormMessage(`A card with id "${draft.id.trim()}" already exists — edit it from the list instead.`);
      return;
    }

    const result = buildCardDefinition(draft);
    if ("error" in result) {
      setFormMessage(result.error);
      return;
    }

    setSaving(true);
    let finalCard = result;
    if (artFile) {
      const { url, error } = await uploadCardArt(artFile, result.id);
      if (error) {
        setSaving(false);
        setFormMessage(`Image upload failed: ${error}`);
        return;
      }
      finalCard = { ...result, art: url ?? undefined };
    }

    const saveError = await saveRemoteCard(finalCard, userId);
    setSaving(false);
    if (saveError) {
      setFormMessage(`Save failed: ${saveError}`);
      return;
    }
    await onCardsChanged();
    setFormMessage(`Saved "${finalCard.name}".`);
    setMode("list");
  }

  function handleSaveGold() {
    const parsed = Number.parseInt(goldInput, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onSetCoins(parsed);
  }

  const previewDef = (() => {
    const result = buildCardDefinition(draft);
    if ("error" in result) return null;
    return artPreview ? { ...result, art: artPreview } : result;
  })();

  return (
    <div className="screen">
      <div className="screen__header">
        <button className="btn" onClick={mode === "edit" ? () => setMode("list") : onBack}>
          ← {mode === "edit" ? "Cancel" : "Back"}
        </button>
        <h2>Admin Panel</h2>
      </div>

      {mode === "list" && (
        <>
          <div className="admin-gold">
            <label>
              Your coins
              <input
                type="number"
                min={0}
                value={goldInput}
                onChange={(e) => setGoldInput(e.target.value)}
              />
            </label>
            <button className="btn btn--small" onClick={handleSaveGold}>
              Save Gold
            </button>
          </div>

          <div className="admin-toolbar">
            <input
              className="admin-search"
              type="text"
              placeholder="Search cards…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn--primary" onClick={startCreate}>
              + New Card
            </button>
          </div>

          <div className="collection-grid">
            {allCards.map((def) => (
              <div key={def.id} className="collection-entry">
                <CardView instance={createCardInstance(def.id, "player")} onClick={() => startEdit(def)} />
                <div className="collection-entry__count">{def.id}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {mode === "edit" && (
        <div className="admin-form">
          <div className="admin-form__fields">
            <label>
              Card ID
              <input
                type="text"
                value={draft.id}
                disabled={!!editingExistingId}
                onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value.toLowerCase() }))}
                placeholder="e.g. lava-hound"
              />
            </label>
            <label>
              Name
              <input type="text" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </label>
            <label>
              Archetype
              <select
                value={draft.archetype}
                onChange={(e) => setDraft((d) => ({ ...d, archetype: e.target.value as CardArchetype }))}
              >
                {ARCHETYPES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            {draft.archetype !== "hero" && (
              <label>
                Cost
                <input
                  type="number"
                  min={0}
                  value={draft.cost}
                  onChange={(e) => setDraft((d) => ({ ...d, cost: Number(e.target.value) }))}
                />
              </label>
            )}
            <label>
              Rarity
              <select value={draft.rarity} onChange={(e) => setDraft((d) => ({ ...d, rarity: e.target.value as Rarity }))}>
                {RARITY_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {RARITY_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Text
              <textarea value={draft.text} onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))} />
            </label>

            <label>
              Element
              <select value={draft.element} onChange={(e) => setDraft((d) => ({ ...d, element: e.target.value as Element | "" }))}>
                <option value="">None</option>
                {ELEMENT_OPTIONS.map((el) => (
                  <option key={el} value={el}>
                    {ELEMENT_LABELS[el]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Faction
              <select value={draft.faction} onChange={(e) => setDraft((d) => ({ ...d, faction: e.target.value as Faction | "" }))}>
                <option value="">None</option>
                {FACTION_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {FACTION_LABELS[f]}
                  </option>
                ))}
              </select>
            </label>
            {draft.archetype === "hero" && (
              <label>
                Class
                <select
                  value={draft.heroClass}
                  onChange={(e) => setDraft((d) => ({ ...d, heroClass: e.target.value as HeroClass }))}
                >
                  {HERO_CLASS_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {HERO_CLASS_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(draft.archetype === "hero" || draft.archetype === "creature") && (
              <div className="admin-keywords">
                <span>Race(s)</span>
                {RACE_OPTIONS.map((r) => (
                  <label key={r} className="admin-keyword-checkbox">
                    <input type="checkbox" checked={draft.races.includes(r)} onChange={() => toggleRace(r)} />
                    {RACE_LABELS[r]}
                  </label>
                ))}
              </div>
            )}

            {(draft.archetype === "hero" || draft.archetype === "creature") && (
              <>
                <label>
                  Attack
                  <input
                    type="number"
                    value={draft.attack}
                    onChange={(e) => setDraft((d) => ({ ...d, attack: Number(e.target.value) }))}
                  />
                </label>
                <label>
                  HP
                  <input type="number" value={draft.hp} onChange={(e) => setDraft((d) => ({ ...d, hp: Number(e.target.value) }))} />
                </label>
              </>
            )}
            {draft.archetype === "building" && (
              <>
                <label>
                  HP
                  <input type="number" value={draft.hp} onChange={(e) => setDraft((d) => ({ ...d, hp: Number(e.target.value) }))} />
                </label>
                <fieldset className="admin-effect">
                  <legend>Passive</legend>
                  <label className="admin-keyword-checkbox">
                    <input
                      type="checkbox"
                      checked={draft.buildingPassiveEnabled}
                      onChange={(e) => setDraft((d) => ({ ...d, buildingPassiveEnabled: e.target.checked }))}
                    />
                    Grants an aura buff to matching creatures
                  </label>
                  {draft.buildingPassiveEnabled && (
                    <>
                      <label>
                        Applies to
                        <select
                          value={draft.buildingPassiveFilterKind}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              buildingPassiveFilterKind: e.target.value as CardDraft["buildingPassiveFilterKind"],
                              buildingPassiveFilterValue: "",
                            }))
                          }
                        >
                          <option value="all">All friendly creatures</option>
                          <option value="race">Creatures of a Race</option>
                          <option value="faction">Creatures of a Faction</option>
                        </select>
                      </label>
                      {draft.buildingPassiveFilterKind === "race" && (
                        <label>
                          Race
                          <select
                            value={draft.buildingPassiveFilterValue}
                            onChange={(e) => setDraft((d) => ({ ...d, buildingPassiveFilterValue: e.target.value as Race }))}
                          >
                            <option value="">Choose…</option>
                            {RACE_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {RACE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {draft.buildingPassiveFilterKind === "faction" && (
                        <label>
                          Faction
                          <select
                            value={draft.buildingPassiveFilterValue}
                            onChange={(e) => setDraft((d) => ({ ...d, buildingPassiveFilterValue: e.target.value as Faction }))}
                          >
                            <option value="">Choose…</option>
                            {FACTION_OPTIONS.map((f) => (
                              <option key={f} value={f}>
                                {FACTION_LABELS[f]}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        Attack Delta
                        <input
                          type="number"
                          value={draft.effectAttackDelta}
                          onChange={(e) => setDraft((d) => ({ ...d, effectAttackDelta: Number(e.target.value) }))}
                        />
                      </label>
                    </>
                  )}
                </fieldset>
                <label>
                  Effect applies to
                  <select
                    value={draft.buildingEffectTarget}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, buildingEffectTarget: e.target.value as CardDraft["buildingEffectTarget"] }))
                    }
                  >
                    <option value="trigger">A trigger (e.g. On Construction)</option>
                    <option value="ability">An activated ability</option>
                  </select>
                </label>
                {draft.buildingEffectTarget === "ability" && (
                  <>
                    <label>
                      Activate Cost
                      <input
                        type="number"
                        value={draft.activateCost}
                        onChange={(e) => setDraft((d) => ({ ...d, activateCost: Number(e.target.value) }))}
                      />
                    </label>
                    <label>
                      Pool
                      <select
                        value={draft.effectPool}
                        onChange={(e) => setDraft((d) => ({ ...d, effectPool: e.target.value as CardDraft["effectPool"] }))}
                      >
                        <option value="resource">Resources</option>
                        <option value="mana">Mana</option>
                        <option value="energy">Energy</option>
                      </select>
                    </label>
                  </>
                )}
              </>
            )}
            {draft.archetype === "creature" && (
              <div className="admin-keywords">
                <span>Keywords</span>
                {KEYWORD_OPTIONS.map((k) => (
                  <label key={k} className="admin-keyword-checkbox">
                    <input type="checkbox" checked={draft.keywords.includes(k)} onChange={() => toggleKeyword(k)} />
                    {KEYWORD_LABELS[k]}
                  </label>
                ))}
              </div>
            )}

            {draft.archetype === "spell" && (
              <label>
                Spell Form
                <select
                  value={draft.spellForm}
                  onChange={(e) => setDraft((d) => ({ ...d, spellForm: e.target.value as CardDraft["spellForm"] }))}
                >
                  <option value="instant">Instant — cast from hand, resolves immediately</option>
                  <option value="ritual">Ritual — placed in a slot, unlimited activations</option>
                  <option value="charged">Charged — placed in a slot, fizzles at 0 charges</option>
                </select>
              </label>
            )}
            {draft.archetype === "ability" && (
              <label>
                Ability Form
                <select
                  value={draft.abilityForm}
                  onChange={(e) => setDraft((d) => ({ ...d, abilityForm: e.target.value as CardDraft["abilityForm"] }))}
                >
                  <option value="instant">Instant — resolves on play, like On Play</option>
                  <option value="activated">Activated — placed in a slot, manually activated</option>
                </select>
              </label>
            )}
            {((draft.archetype === "spell" && draft.spellForm !== "instant") ||
              (draft.archetype === "ability" && draft.abilityForm !== "instant")) && (
              <>
                <label>
                  Activate Cost ({draft.archetype === "spell" ? "Mana" : "Energy"})
                  <input
                    type="number"
                    value={draft.activateCost}
                    onChange={(e) => setDraft((d) => ({ ...d, activateCost: Number(e.target.value) }))}
                  />
                </label>
                <label>
                  Charges
                  <input
                    type="text"
                    value={draft.charges}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        charges: e.target.value === "unlimited" ? "unlimited" : Number(e.target.value) || 1,
                      }))
                    }
                  />
                  <span className="admin-hint">A number, or the word "unlimited".</span>
                </label>
              </>
            )}
            {draft.archetype === "equipment" && (
              <>
                <label>
                  Category
                  <select
                    value={draft.equipmentCategory}
                    onChange={(e) => setDraft((d) => ({ ...d, equipmentCategory: e.target.value as EquipmentCategory }))}
                  >
                    {EQUIPMENT_CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {EQUIPMENT_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                  <span className="admin-hint">Only a Weapon lets the bearer's Hero attack — DESIGN.md §12.</span>
                </label>
                <label>
                  Attack Bonus
                  <input
                    type="number"
                    value={draft.attackBonus}
                    onChange={(e) => setDraft((d) => ({ ...d, attackBonus: Number(e.target.value) }))}
                  />
                </label>
                <label>
                  Damage Reduction
                  <input
                    type="number"
                    value={draft.damageReduction}
                    onChange={(e) => setDraft((d) => ({ ...d, damageReduction: Number(e.target.value) }))}
                  />
                </label>
              </>
            )}

            {(draft.archetype === "creature" ||
              (draft.archetype === "building" && draft.buildingEffectTarget === "trigger")) && (
              <label>
                Trigger
                <select
                  value={draft.triggerOn}
                  onChange={(e) => setDraft((d) => ({ ...d, triggerOn: e.target.value as TriggerName | "none" }))}
                >
                  <option value="none">None</option>
                  {CREATURE_TRIGGER_NAMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {((draft.archetype === "creature" ||
              (draft.archetype === "building" && draft.buildingEffectTarget === "trigger")) &&
              draft.triggerOn !== "none") ||
            (draft.archetype === "building" && draft.buildingEffectTarget === "ability") ||
            draft.archetype === "spell" ||
            draft.archetype === "ability" ? (
              <fieldset className="admin-effect">
                <legend>Effect</legend>
                <label>
                  Kind
                  <select
                    value={draft.effectKind}
                    onChange={(e) => setDraft((d) => ({ ...d, effectKind: e.target.value as CardEffect["kind"] | "none" }))}
                  >
                    {(draft.archetype === "spell" || draft.archetype === "ability" || draft.archetype === "building") && (
                      <option value="none">Choose one…</option>
                    )}
                    {EFFECT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>

                {(draft.effectKind === "damage" ||
                  draft.effectKind === "heal" ||
                  draft.effectKind === "applyStatus" ||
                  draft.effectKind === "buff" ||
                  draft.effectKind === "consume" ||
                  draft.effectKind === "transform" ||
                  draft.effectKind === "garrison") && (
                  <label>
                    Target
                    <select
                      value={draft.effectTarget}
                      onChange={(e) => setDraft((d) => ({ ...d, effectTarget: e.target.value as CardDraft["effectTarget"] }))}
                    >
                      {TARGET_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {(draft.effectKind === "damage" ||
                  draft.effectKind === "heal" ||
                  draft.effectKind === "applyStatus" ||
                  draft.effectKind === "drawCard" ||
                  draft.effectKind === "gainGuard" ||
                  draft.effectKind === "gainCap") && (
                  <label>
                    Amount
                    <input
                      type="number"
                      value={draft.effectAmount}
                      onChange={(e) => setDraft((d) => ({ ...d, effectAmount: Number(e.target.value) }))}
                    />
                  </label>
                )}
                {draft.effectKind === "applyStatus" && (
                  <>
                    <label>
                      Status
                      <select
                        value={draft.effectStatus}
                        onChange={(e) => setDraft((d) => ({ ...d, effectStatus: e.target.value as StatusType }))}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Duration (turns)
                      <input
                        type="number"
                        value={draft.effectDuration}
                        onChange={(e) => setDraft((d) => ({ ...d, effectDuration: Number(e.target.value) }))}
                      />
                      <span className="admin-hint">Leave the default if this status should persist indefinitely instead.</span>
                    </label>
                  </>
                )}
                {(draft.effectKind === "buff" || draft.effectKind === "consume") && (
                  <>
                    <label>
                      Attack Delta
                      <input
                        type="number"
                        value={draft.effectAttackDelta}
                        onChange={(e) => setDraft((d) => ({ ...d, effectAttackDelta: Number(e.target.value) }))}
                      />
                    </label>
                    <label>
                      HP Delta
                      <input
                        type="number"
                        value={draft.effectHpDelta}
                        onChange={(e) => setDraft((d) => ({ ...d, effectHpDelta: Number(e.target.value) }))}
                      />
                    </label>
                    {draft.effectKind === "consume" && (
                      <span className="admin-hint">Target is the ally destroyed — these deltas apply to every other friendly creature.</span>
                    )}
                    {draft.effectKind === "buff" && (
                      <label>
                        Duration (turns)
                        <input
                          type="number"
                          value={draft.buffDuration}
                          onChange={(e) => setDraft((d) => ({ ...d, buffDuration: Number(e.target.value) }))}
                        />
                        <span className="admin-hint">0 = permanent. 1 = "this turn" — gone by the time anyone's next turn starts.</span>
                      </label>
                    )}
                  </>
                )}
                {draft.effectKind === "gainCap" && (
                  <label>
                    Pool
                    <select
                      value={draft.effectPool}
                      onChange={(e) => setDraft((d) => ({ ...d, effectPool: e.target.value as CardDraft["effectPool"] }))}
                    >
                      <option value="resource">Resources</option>
                      <option value="mana">Mana</option>
                      <option value="energy">Energy</option>
                    </select>
                  </label>
                )}
                {draft.effectKind === "summonCreature" && (
                  <>
                    <label>
                      Creature to summon (card ID)
                      <input
                        type="text"
                        value={draft.effectCreatureId}
                        onChange={(e) => setDraft((d) => ({ ...d, effectCreatureId: e.target.value }))}
                        placeholder="e.g. militia-recruit"
                      />
                      <span className="admin-hint">Must match an existing Creature card's ID exactly.</span>
                    </label>
                    <label>
                      Count (Swarm)
                      <input
                        type="number"
                        min={1}
                        value={draft.effectCount}
                        onChange={(e) => setDraft((d) => ({ ...d, effectCount: Number(e.target.value) || 1 }))}
                      />
                      <span className="admin-hint">More than 1 summons several at once (DESIGN.md §16).</span>
                    </label>
                  </>
                )}
                {draft.effectKind === "transform" && (
                  <label>
                    Creature to transform into (card ID)
                    <input
                      type="text"
                      value={draft.effectCreatureId}
                      onChange={(e) => setDraft((d) => ({ ...d, effectCreatureId: e.target.value }))}
                      placeholder="e.g. alpha-wolf"
                    />
                    <span className="admin-hint">Must match an existing Creature card's ID exactly. Target is the ally that transforms.</span>
                  </label>
                )}
              </fieldset>
            ) : null}

            <label>
              Card Art
              <input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
              <span className="admin-hint">Automatically resized/cropped to 512×776.</span>
            </label>
          </div>

          <div className="admin-form__preview">
            <h3>Preview</h3>
            {previewDef && (
              <CardView
                defOverride={previewDef}
                instance={{
                  instanceId: "preview",
                  defId: previewDef.id,
                  archetype: previewDef.archetype,
                  owner: "player",
                  attackDelta: 0,
                  hpDelta: 0,
                  statuses: [],
                  temporaryModifiers: [],
                  currentHp: "hp" in previewDef ? previewDef.hp : undefined,
                  chargesRemaining: "charges" in previewDef ? previewDef.charges : undefined,
                }}
              />
            )}
            {artPreview && (
              <div className="admin-art-preview">
                <img src={artPreview} alt="Card art preview" width={128} height={194} />
              </div>
            )}
            {formMessage && <p className="admin-form__message">{formMessage}</p>}
            <button className="btn btn--primary" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save Card"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
