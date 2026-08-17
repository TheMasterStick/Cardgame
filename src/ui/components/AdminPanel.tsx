import { useState } from "react";
import { CARD_DEFINITIONS } from "../../data/cards";
import {
  ELEMENT_OPTIONS,
  FACTION_OPTIONS,
  KEYWORD_OPTIONS,
  RACE_OPTIONS,
  RARITY_OPTIONS,
  ELEMENT_LABELS,
  FACTION_LABELS,
  RACE_LABELS,
  RARITY_LABELS,
  KEYWORD_LABELS,
} from "../../data/taxonomy";
import { saveRemoteCard, uploadCardArt } from "../../lib/adminCards";
import type { Collection } from "../../engine/collection";
import { createCardInstance } from "../../engine/factory";
import type {
  CardArchetype,
  CardDefinition,
  CardEffect,
  Element,
  Faction,
  Keyword,
  Race,
  Rarity,
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
const EFFECT_KINDS: CardEffect["kind"][] = ["damage", "heal", "applyStatus", "buff", "drawCard", "gainGuard", "gainCap"];
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
  race: Race | "";
  attack: number;
  hp: number;
  keywords: Keyword[];
  activateCost: number;
  charges: number | "unlimited";
  attackBonus: number;
  damageReduction: number;
  triggerOn: TriggerName | "none";
  effectKind: CardEffect["kind"] | "none";
  effectAmount: number;
  effectTarget: (typeof TARGET_OPTIONS)[number];
  effectStatus: "burn" | "poison";
  effectDuration: number;
  effectAttackDelta: number;
  effectHpDelta: number;
  effectPool: "resource" | "mana" | "energy";
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
    race: "",
    attack: 1,
    hp: 1,
    keywords: [],
    activateCost: 1,
    charges: 1,
    attackBonus: 0,
    damageReduction: 0,
    triggerOn: "none",
    effectKind: "none",
    effectAmount: 1,
    effectTarget: "targetCreature",
    effectStatus: "poison",
    effectDuration: 2,
    effectAttackDelta: 1,
    effectHpDelta: 1,
    effectPool: "resource",
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
  } else if (effect.kind === "drawCard" || effect.kind === "gainGuard") {
    draft.effectAmount = effect.amount;
  } else if (effect.kind === "gainCap") {
    draft.effectAmount = effect.amount;
    draft.effectPool = effect.pool;
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
  draft.race = def.race ?? "";

  if (def.archetype === "hero") {
    draft.attack = def.attack;
    draft.hp = def.hp;
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
    if (def.triggers[0]) {
      draft.triggerOn = def.triggers[0].on;
      loadEffectIntoDraft(draft, def.triggers[0].effect);
    }
  } else if (def.archetype === "spell" || def.archetype === "ability") {
    draft.activateCost = def.activateCost;
    draft.charges = def.charges;
    loadEffectIntoDraft(draft, def.effect);
  } else if (def.archetype === "equipment") {
    draft.attackBonus = def.attackBonus;
    draft.damageReduction = def.damageReduction;
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
        duration: draft.effectStatus === "burn" ? draft.effectDuration : undefined,
        target: draft.effectTarget,
      };
    case "buff":
      return {
        kind: "buff",
        attackDelta: draft.effectAttackDelta || undefined,
        hpDelta: draft.effectHpDelta || undefined,
        target: draft.effectTarget,
      };
    case "drawCard":
      return { kind: "drawCard", amount: draft.effectAmount };
    case "gainGuard":
      return { kind: "gainGuard", amount: draft.effectAmount };
    case "gainCap":
      return { kind: "gainCap", pool: draft.effectPool, amount: draft.effectAmount };
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
    race: draft.race || undefined,
  };

  if (draft.archetype === "hero") {
    return { ...base, archetype: "hero", attack: draft.attack, hp: draft.hp };
  }
  if (draft.archetype === "creature") {
    const effect = buildEffect(draft);
    const triggers: Trigger[] = draft.triggerOn !== "none" && effect ? [{ on: draft.triggerOn, effect }] : [];
    return { ...base, archetype: "creature", attack: draft.attack, hp: draft.hp, keywords: draft.keywords, triggers };
  }
  if (draft.archetype === "building") {
    const effect = buildEffect(draft);
    const triggers: Trigger[] = draft.triggerOn !== "none" && effect ? [{ on: draft.triggerOn, effect }] : [];
    return { ...base, archetype: "building", hp: draft.hp, triggers };
  }
  if (draft.archetype === "spell" || draft.archetype === "ability") {
    const effect = buildEffect(draft);
    if (!effect) return { error: "Choose an effect for this Spell/Ability." };
    return { ...base, archetype: draft.archetype, activateCost: draft.activateCost, charges: draft.charges, effect };
  }
  // equipment
  return { ...base, archetype: "equipment", attackBonus: draft.attackBonus, damageReduction: draft.damageReduction };
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
            {(draft.archetype === "hero" || draft.archetype === "creature") && (
              <label>
                Race
                <select value={draft.race} onChange={(e) => setDraft((d) => ({ ...d, race: e.target.value as Race | "" }))}>
                  <option value="">None</option>
                  {RACE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {RACE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
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
              <label>
                HP
                <input type="number" value={draft.hp} onChange={(e) => setDraft((d) => ({ ...d, hp: Number(e.target.value) }))} />
              </label>
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

            {(draft.archetype === "spell" || draft.archetype === "ability") && (
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

            {(draft.archetype === "creature" || draft.archetype === "building") && (
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

            {((draft.archetype === "creature" || draft.archetype === "building") && draft.triggerOn !== "none") ||
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
                    {(draft.archetype === "spell" || draft.archetype === "ability") && <option value="none">Choose one…</option>}
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
                  draft.effectKind === "buff") && (
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
                        onChange={(e) => setDraft((d) => ({ ...d, effectStatus: e.target.value as "burn" | "poison" }))}
                      >
                        <option value="poison">Poison</option>
                        <option value="burn">Burn</option>
                      </select>
                    </label>
                    {draft.effectStatus === "burn" && (
                      <label>
                        Duration (turns)
                        <input
                          type="number"
                          value={draft.effectDuration}
                          onChange={(e) => setDraft((d) => ({ ...d, effectDuration: Number(e.target.value) }))}
                        />
                      </label>
                    )}
                  </>
                )}
                {draft.effectKind === "buff" && (
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
