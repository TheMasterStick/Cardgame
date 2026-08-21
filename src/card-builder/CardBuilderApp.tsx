import { useMemo, useState } from "react";
import { CARD_DEFINITIONS } from "../data/cards";
import type { CardArchetype, CardDefinition, Rarity } from "../engine/types";

const ARCHETYPES: CardArchetype[] = ["creature", "building", "spell", "ability", "equipment", "hero"];
const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

type BaseKey = "" | "CreatureBase" | "BuildingBase" | "SpellBase" | "AbilityBase" | "BaseAbility";

type BuilderDraft = {
  id: string;
  name: string;
  archetype: CardArchetype;
  rarity: Rarity;
  cost: number;
  text: string;
  art: string;
  attack: number;
  hp: number;
  keywords: string;
  baseKey: BaseKey;
  artScale: number;
  artX: number;
  artY: number;
};

type BaseSpec = {
  label: string;
  url: string;
};

function drivePreviewUrl(fileId: string) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
}

const BASES: Record<Exclude<BaseKey, "">, BaseSpec> = {
  CreatureBase: {
    label: "Creature Base",
    url: drivePreviewUrl("1VZidSY9g2urE6LzIW2szt4zVCoMB-Yhh"),
  },
  BuildingBase: {
    label: "Building Base",
    url: drivePreviewUrl("1AyqAd-q1GakrrEyuB4gTykWMEZOAgrkV"),
  },
  SpellBase: {
    label: "Spell Base",
    url: drivePreviewUrl("1dj16J2n5GUcQAgRXK0Tj8ZyznAvAde91"),
  },
  AbilityBase: {
    label: "Ability Base",
    url: drivePreviewUrl("1iPfx9VvZo9LgHnNuselSuwtt6cIbO0St"),
  },
  BaseAbility: {
    label: "BaseAbility (alternate / equipment candidate)",
    url: drivePreviewUrl("1mkUEIyk1XV4C6_XJFeHWENj1P1g5aZ7x"),
  },
};

function defaultBase(archetype: CardArchetype): BaseKey {
  if (archetype === "creature") return "CreatureBase";
  if (archetype === "building") return "BuildingBase";
  if (archetype === "spell") return "SpellBase";
  if (archetype === "ability") return "AbilityBase";
  if (archetype === "equipment") return "BaseAbility";
  return "";
}

function draftFromDefinition(def: CardDefinition): BuilderDraft {
  let attack = 0;
  let hp = 0;
  let keywords = "";

  if (def.archetype === "hero" || def.archetype === "creature") attack = def.attack;
  if (def.archetype === "hero" || def.archetype === "creature" || def.archetype === "building") hp = def.hp;
  if (def.archetype === "creature") keywords = def.keywords.join(", ");

  return {
    id: def.id,
    name: def.name,
    archetype: def.archetype,
    rarity: def.rarity,
    cost: def.cost,
    text: def.text ?? "",
    art: def.art ?? "",
    attack,
    hp,
    keywords,
    baseKey: defaultBase(def.archetype),
    artScale: 1,
    artX: 0,
    artY: 0,
  };
}

function emptyDraft(): BuilderDraft {
  return {
    id: "new-card",
    name: "New Card",
    archetype: "creature",
    rarity: "common",
    cost: 1,
    text: "Card rules text goes here.",
    art: "",
    attack: 1,
    hp: 1,
    keywords: "",
    baseKey: "CreatureBase",
    artScale: 1,
    artX: 0,
    artY: 0,
  };
}

function effectDamage(def: CardDefinition | undefined): number | null {
  if (!def || (def.archetype !== "spell" && def.archetype !== "ability")) return null;
  const effect = def.effect;
  if (effect.kind === "damage") return effect.amount;
  if (effect.kind === "multi") {
    const damage = effect.effects.find((candidate) => candidate.kind === "damage");
    return damage?.kind === "damage" ? damage.amount : null;
  }
  return null;
}

function resourceLabel(archetype: CardArchetype) {
  if (archetype === "spell") return "M";
  if (archetype === "creature" || archetype === "ability") return "E";
  if (archetype === "building" || archetype === "equipment") return "R";
  return "";
}

function humanize(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function LayeredCardPreview({ draft, sourceDef }: { draft: BuilderDraft; sourceDef?: CardDefinition }) {
  const base = draft.baseKey ? BASES[draft.baseKey] : null;
  const damage = effectDamage(sourceDef);
  const resource = resourceLabel(draft.archetype);

  return (
    <div className="cb-preview-wrap">
      <div className={`cb-card cb-card--${draft.archetype}`}>
        <div className="cb-card__art-window">
          {draft.art ? (
            <img
              className="cb-card__art"
              src={draft.art}
              alt=""
              style={{
                transform: `translate(${draft.artX}%, ${draft.artY}%) scale(${draft.artScale})`,
              }}
            />
          ) : (
            <div className="cb-card__art-placeholder">ARTWORK</div>
          )}
        </div>

        <div className="cb-card__name">{draft.name || "Untitled Card"}</div>
        {draft.archetype !== "hero" && <div className="cb-card__cost">{draft.cost}</div>}
        {resource && <div className="cb-card__resource">{resource}</div>}

        <div className="cb-card__meta cb-card__meta--left">{humanize(draft.rarity)}</div>
        <div className="cb-card__meta cb-card__meta--right">{humanize(draft.archetype)}</div>
        <div className="cb-card__rules">{draft.text}</div>

        {draft.archetype === "creature" && <div className="cb-card__stat cb-card__stat--attack">{draft.attack}</div>}
        {(draft.archetype === "creature" || draft.archetype === "building") && (
          <div className="cb-card__stat cb-card__stat--health">{draft.hp}</div>
        )}
        {draft.archetype === "spell" && damage !== null && (
          <div className="cb-card__stat cb-card__stat--spell-damage">{damage}</div>
        )}

        {base ? <img className="cb-card__base" src={base.url} alt="" /> : <div className="cb-card__missing-base">No Hero base uploaded yet</div>}
      </div>
      <div className="cb-preview-caption">1152 × 1728 source geometry · live 2:3 preview</div>
    </div>
  );
}

export function CardBuilderApp() {
  const definitions = useMemo(
    () => Object.values(CARD_DEFINITIONS).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CardArchetype | "all">("all");
  const [selectedId, setSelectedId] = useState(definitions.find((def) => def.archetype === "creature")?.id ?? definitions[0]?.id ?? "");
  const selectedDef = definitions.find((def) => def.id === selectedId);
  const [draft, setDraft] = useState<BuilderDraft>(() => (selectedDef ? draftFromDefinition(selectedDef) : emptyDraft()));
  const [message, setMessage] = useState("");

  const visibleCards = definitions.filter((def) => {
    if (filter !== "all" && def.archetype !== filter) return false;
    const haystack = `${def.name} ${def.id} ${def.archetype}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  function selectCard(def: CardDefinition) {
    setSelectedId(def.id);
    const stored = localStorage.getItem(`card-builder:draft:${def.id}`);
    if (stored) {
      try {
        setDraft(JSON.parse(stored) as BuilderDraft);
        setMessage("Loaded your local draft.");
        return;
      } catch {
        localStorage.removeItem(`card-builder:draft:${def.id}`);
      }
    }
    setDraft(draftFromDefinition(def));
    setMessage("");
  }

  function patch<K extends keyof BuilderDraft>(key: K, value: BuilderDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function changeArchetype(next: CardArchetype) {
    setDraft((current) => ({ ...current, archetype: next, baseKey: defaultBase(next) }));
  }

  function saveDraft() {
    localStorage.setItem(`card-builder:draft:${draft.id}`, JSON.stringify(draft));
    setMessage("Draft saved locally in this browser.");
  }

  function resetDraft() {
    const def = definitions.find((candidate) => candidate.id === selectedId);
    if (!def) return;
    localStorage.removeItem(`card-builder:draft:${def.id}`);
    setDraft(draftFromDefinition(def));
    setMessage("Reset to the canonical card definition.");
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
    setMessage("Draft JSON copied.");
  }

  function createNew() {
    setSelectedId("");
    setDraft(emptyDraft());
    setMessage("New unsaved card draft.");
  }

  return (
    <main className="card-builder">
      <header className="cb-header">
        <div>
          <a href="/" className="cb-back">← Main Menu</a>
          <h1>Card Builder</h1>
          <p>Mechanics from the real card definitions. Presentation layered over the uploaded card bases.</p>
        </div>
        <div className="cb-header__actions">
          <button onClick={saveDraft}>Save Draft</button>
          <button onClick={() => void copyDraft()}>Copy JSON</button>
          {selectedDef && <button onClick={resetDraft}>Reset</button>}
        </div>
      </header>

      {message && <div className="cb-message">{message}</div>}

      <section className="cb-layout">
        <aside className="cb-library">
          <div className="cb-panel-title">Card Library</div>
          <button className="cb-new-card" onClick={createNew}>+ New Card</button>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cards…" />
          <select value={filter} onChange={(event) => setFilter(event.target.value as CardArchetype | "all")}>
            <option value="all">All card types</option>
            {ARCHETYPES.map((archetype) => <option key={archetype} value={archetype}>{humanize(archetype)}</option>)}
          </select>
          <div className="cb-card-list">
            {visibleCards.map((def) => (
              <button
                key={def.id}
                className={def.id === selectedId ? "cb-card-list__item cb-card-list__item--selected" : "cb-card-list__item"}
                onClick={() => selectCard(def)}
              >
                <strong>{def.name}</strong>
                <span>{humanize(def.archetype)} · {humanize(def.rarity)}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="cb-editor">
          <div className="cb-panel-title">Definition & Presentation</div>
          <div className="cb-fields cb-fields--two">
            <label>ID<input value={draft.id} onChange={(event) => patch("id", event.target.value)} /></label>
            <label>Name<input value={draft.name} onChange={(event) => patch("name", event.target.value)} /></label>
            <label>Card Type
              <select value={draft.archetype} onChange={(event) => changeArchetype(event.target.value as CardArchetype)}>
                {ARCHETYPES.map((archetype) => <option key={archetype} value={archetype}>{humanize(archetype)}</option>)}
              </select>
            </label>
            <label>Rarity
              <select value={draft.rarity} onChange={(event) => patch("rarity", event.target.value as Rarity)}>
                {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{humanize(rarity)}</option>)}
              </select>
            </label>
            {draft.archetype !== "hero" && <label>Play Cost<input type="number" min={0} value={draft.cost} onChange={(event) => patch("cost", Number(event.target.value))} /></label>}
            {(draft.archetype === "creature" || draft.archetype === "hero") && <label>Attack<input type="number" value={draft.attack} onChange={(event) => patch("attack", Number(event.target.value))} /></label>}
            {(draft.archetype === "creature" || draft.archetype === "building" || draft.archetype === "hero") && <label>Health<input type="number" value={draft.hp} onChange={(event) => patch("hp", Number(event.target.value))} /></label>}
          </div>

          <label>Rules Text<textarea rows={5} value={draft.text} onChange={(event) => patch("text", event.target.value)} /></label>
          {draft.archetype === "creature" && <label>Keywords<input value={draft.keywords} onChange={(event) => patch("keywords", event.target.value)} placeholder="ranged, charge, taunt…" /></label>}

          <div className="cb-section-title">Artwork</div>
          <label>Art path or URL<input value={draft.art} onChange={(event) => patch("art", event.target.value)} placeholder="/cards/My-Card.jpg" /></label>
          <div className="cb-slider-row">
            <label>Zoom <span>{draft.artScale.toFixed(2)}×</span><input type="range" min="0.75" max="2.2" step="0.01" value={draft.artScale} onChange={(event) => patch("artScale", Number(event.target.value))} /></label>
            <label>X <span>{draft.artX}%</span><input type="range" min="-50" max="50" step="1" value={draft.artX} onChange={(event) => patch("artX", Number(event.target.value))} /></label>
            <label>Y <span>{draft.artY}%</span><input type="range" min="-50" max="50" step="1" value={draft.artY} onChange={(event) => patch("artY", Number(event.target.value))} /></label>
          </div>

          <div className="cb-section-title">Card Base</div>
          <label>Template
            <select value={draft.baseKey} onChange={(event) => patch("baseKey", event.target.value as BaseKey)}>
              <option value="">None / not uploaded</option>
              {Object.entries(BASES).map(([key, spec]) => <option key={key} value={key}>{spec.label}</option>)}
            </select>
          </label>
          {draft.archetype === "equipment" && draft.baseKey === "BaseAbility" && (
            <p className="cb-note">Temporary mapping: BaseAbility is the remaining distinct uploaded base, so the builder treats it as the Equipment candidate until you confirm its intended name.</p>
          )}
          {draft.archetype === "hero" && !draft.baseKey && (
            <p className="cb-note">No dedicated Hero base is present in the uploaded set yet. Heroes can remain a battlefield portrait/HUD type if that is intentional.</p>
          )}

          <div className="cb-section-title">Canonical Mechanics</div>
          <pre className="cb-definition-json">{selectedDef ? JSON.stringify(selectedDef, null, 2) : "New card: canonical engine save is not enabled in this first pass."}</pre>
        </section>

        <aside className="cb-preview-panel">
          <div className="cb-panel-title">Live Card Preview</div>
          <LayeredCardPreview draft={draft} sourceDef={selectedDef} />
          <p className="cb-preview-help">The frame is a separate transparent layer over the artwork. Text/stats are live DOM layers now; the shared Phaser renderer can use the same percentage geometry next.</p>
        </aside>
      </section>
    </main>
  );
}
