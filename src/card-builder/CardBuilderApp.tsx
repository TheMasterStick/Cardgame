import { useMemo, useState, type CSSProperties } from "react";
import { CARD_BASE_ASSETS, type ResourceKind } from "../card-rendering/presentation";
import { CARD_DEFINITIONS } from "../data/cards";
import type { CardArchetype, CardDefinition, Rarity } from "../engine/types";

const ARCHETYPES: CardArchetype[] = ["creature", "building", "spell", "ability", "equipment", "hero"];
const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const MAX_CATEGORIES = 5;

type BaseKey = "" | "CreatureBase" | "BuildingBase" | "SpellBase" | "AbilityBase" | "BaseAbility";

type LayoutOffsets = {
  nameX: number;
  nameY: number;
  costX: number;
  costY: number;
  resourceX: number;
  resourceY: number;
  categoriesX: number;
  categoriesY: number;
  rulesX: number;
  rulesY: number;
  attackX: number;
  attackY: number;
  healthX: number;
  healthY: number;
};

type BuilderDraft = {
  id: string;
  name: string;
  archetype: CardArchetype;
  rarity: Rarity;
  cost: number;
  playPool: ResourceKind;
  resourceIcon: string;
  text: string;
  art: string;
  attack: number;
  hp: number;
  keywords: string;
  categories: string[];
  baseKey: BaseKey;
  artScale: number;
  artX: number;
  artY: number;
  titleFont: string;
  bodyFont: string;
  nameSize: number;
  costSize: number;
  resourceSize: number;
  categorySize: number;
  rulesSize: number;
  statSize: number;
  layout: LayoutOffsets;
};

const PROJECT_DEFAULT_LAYOUT: LayoutOffsets = {
  nameX: 7,
  nameY: 18,
  costX: -27,
  costY: -8,
  resourceX: -17,
  resourceY: -7,
  categoriesX: 0,
  categoriesY: 58,
  rulesX: 0,
  rulesY: 18,
  attackX: 4,
  attackY: 22,
  healthX: -6,
  healthY: 22,
};

const PROJECT_DEFAULT_PRESENTATION = {
  titleFont: "Trajan Pro, Cinzel, Georgia, serif",
  bodyFont: "Cinzel, Georgia, serif",
  nameSize: 21,
  costSize: 31,
  resourceSize: 28,
  categorySize: 13,
  rulesSize: 12,
  statSize: 29,
} as const;

const FONT_PRESETS = [
  "Georgia, serif",
  "Garamond, Georgia, serif",
  "'Palatino Linotype', Palatino, serif",
  "'Times New Roman', Times, serif",
  "Cinzel, Georgia, serif",
  "Trajan Pro, Cinzel, Georgia, serif",
];

function defaultBase(archetype: CardArchetype): BaseKey {
  if (archetype === "creature") return "CreatureBase";
  if (archetype === "building") return "BuildingBase";
  if (archetype === "spell") return "SpellBase";
  if (archetype === "ability") return "AbilityBase";
  if (archetype === "equipment") return "BaseAbility";
  return "";
}

function defaultPool(archetype: CardArchetype): ResourceKind {
  if (archetype === "spell") return "mana";
  if (archetype === "creature" || archetype === "ability") return "energy";
  return "resource";
}

function humanize(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function defaultCategories(def: CardDefinition): string[] {
  const categories = [humanize(def.rarity), def.faction ? humanize(def.faction) : "Neutral"];
  if (def.archetype === "creature") {
    categories.push(def.creatureType?.[0] ? humanize(def.creatureType[0]) : "Creature");
  } else if (def.archetype === "hero") {
    categories.push(humanize(def.class));
  } else {
    categories.push(humanize(def.archetype));
  }
  return categories;
}

function presentationDefaults() {
  return {
    ...PROJECT_DEFAULT_PRESENTATION,
    layout: { ...PROJECT_DEFAULT_LAYOUT },
  };
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
    playPool: defaultPool(def.archetype),
    resourceIcon: "",
    text: def.text ?? "",
    art: def.art ?? "",
    attack,
    hp,
    keywords,
    categories: defaultCategories(def),
    baseKey: defaultBase(def.archetype),
    artScale: 1,
    artX: 0,
    artY: 0,
    ...presentationDefaults(),
  };
}

function emptyDraft(): BuilderDraft {
  return {
    id: "new-card",
    name: "New Card",
    archetype: "creature",
    rarity: "common",
    cost: 1,
    playPool: "energy",
    resourceIcon: "",
    text: "Card rules text goes here.",
    art: "",
    attack: 1,
    hp: 1,
    keywords: "",
    categories: ["Common", "Neutral", "Creature"],
    baseKey: "CreatureBase",
    artScale: 1,
    artX: 0,
    artY: 0,
    ...presentationDefaults(),
  };
}

function hydrateDraft(raw: Partial<BuilderDraft>, fallback: BuilderDraft): BuilderDraft {
  return {
    ...fallback,
    ...raw,
    playPool: raw.playPool ?? fallback.playPool,
    resourceIcon: raw.resourceIcon ?? "",
    categories: raw.categories?.slice(0, MAX_CATEGORIES) ?? fallback.categories,
    titleFont: raw.titleFont ?? fallback.titleFont,
    bodyFont: raw.bodyFont ?? fallback.bodyFont,
    nameSize: raw.nameSize ?? fallback.nameSize,
    costSize: raw.costSize ?? fallback.costSize,
    resourceSize: raw.resourceSize ?? fallback.resourceSize,
    categorySize: raw.categorySize ?? fallback.categorySize,
    rulesSize: raw.rulesSize ?? fallback.rulesSize,
    statSize: raw.statSize ?? fallback.statSize,
    layout: { ...PROJECT_DEFAULT_LAYOUT, ...raw.layout },
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

function resourceGlyph(pool: ResourceKind) {
  if (pool === "energy") return "⚡";
  if (pool === "mana") return "◆";
  return "⬢";
}

function offsetStyle(x: number, y: number): CSSProperties {
  return { transform: `translate(${x}%, ${y}%)` };
}

function LayoutControl({
  label,
  x,
  y,
  onChange,
}: {
  label: string;
  x: number;
  y: number;
  onChange: (axis: "x" | "y", value: number) => void;
}) {
  return (
    <div className="cb-layout-control">
      <strong>{label}</strong>
      <label>X <span>{x}</span><input type="range" min="-100" max="100" step="1" value={x} onChange={(event) => onChange("x", Number(event.target.value))} /></label>
      <label>Y <span>{y}</span><input type="range" min="-100" max="100" step="1" value={y} onChange={(event) => onChange("y", Number(event.target.value))} /></label>
    </div>
  );
}

function LayeredCardPreview({ draft, sourceDef }: { draft: BuilderDraft; sourceDef?: CardDefinition }) {
  const base = draft.baseKey ? CARD_BASE_ASSETS[draft.baseKey] : null;
  const damage = effectDamage(sourceDef);
  const categories = draft.categories.filter((category) => category.trim()).join(" • ");

  return (
    <div className="cb-preview-wrap">
      <div className={`cb-card cb-card--${draft.archetype}`}>
        <div className="cb-card__art-window">
          {draft.art ? (
            <img
              className="cb-card__art"
              src={draft.art}
              alt=""
              style={{ transform: `translate(${draft.artX}%, ${draft.artY}%) scale(${draft.artScale})` }}
            />
          ) : (
            <div className="cb-card__art-placeholder">ARTWORK</div>
          )}
        </div>

        <div
          className="cb-card__name"
          style={{ ...offsetStyle(draft.layout.nameX, draft.layout.nameY), fontFamily: draft.titleFont, fontSize: `${draft.nameSize}px` }}
        >
          {draft.name || "Untitled Card"}
        </div>

        {draft.archetype !== "hero" && (
          <div
            className="cb-card__cost"
            style={{ ...offsetStyle(draft.layout.costX, draft.layout.costY), fontFamily: draft.titleFont, fontSize: `${draft.costSize}px` }}
          >
            {draft.cost}
          </div>
        )}

        {draft.archetype !== "hero" && (
          <div
            className={`cb-card__resource cb-card__resource--${draft.playPool}`}
            style={{ ...offsetStyle(draft.layout.resourceX, draft.layout.resourceY), fontFamily: draft.titleFont, fontSize: `${draft.resourceSize}px` }}
            title={humanize(draft.playPool === "resource" ? "resources" : draft.playPool)}
          >
            {draft.resourceIcon ? <img src={draft.resourceIcon} alt="" /> : <span>{resourceGlyph(draft.playPool)}</span>}
          </div>
        )}

        <div
          className="cb-card__categories"
          style={{ ...offsetStyle(draft.layout.categoriesX, draft.layout.categoriesY), fontFamily: draft.titleFont, fontSize: `${draft.categorySize}px` }}
        >
          {categories}
        </div>

        <div
          className="cb-card__rules"
          style={{ ...offsetStyle(draft.layout.rulesX, draft.layout.rulesY), fontFamily: draft.bodyFont, fontSize: `${draft.rulesSize}px` }}
        >
          {draft.text}
        </div>

        {draft.archetype === "creature" && (
          <div
            className="cb-card__stat cb-card__stat--attack"
            style={{ ...offsetStyle(draft.layout.attackX, draft.layout.attackY), fontFamily: draft.titleFont, fontSize: `${draft.statSize}px` }}
          >
            {draft.attack}
          </div>
        )}
        {(draft.archetype === "creature" || draft.archetype === "building") && (
          <div
            className="cb-card__stat cb-card__stat--health"
            style={{ ...offsetStyle(draft.layout.healthX, draft.layout.healthY), fontFamily: draft.titleFont, fontSize: `${draft.statSize}px` }}
          >
            {draft.hp}
          </div>
        )}
        {draft.archetype === "spell" && damage !== null && (
          <div
            className="cb-card__stat cb-card__stat--spell-damage"
            style={{ ...offsetStyle(draft.layout.healthX, draft.layout.healthY), fontFamily: draft.titleFont, fontSize: `${draft.statSize}px` }}
          >
            {damage}
          </div>
        )}

        {base ? <img className="cb-card__base" src={base.url} alt={base.label} /> : <div className="cb-card__missing-base">No Hero base uploaded yet</div>}
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

  function persistDraft(currentDraft = draft, currentSelectedId = selectedId) {
    const storageId = (currentSelectedId || currentDraft.id).trim();
    if (!storageId) return;
    localStorage.setItem(`card-builder:draft:${storageId}`, JSON.stringify(currentDraft));
  }

  function selectCard(def: CardDefinition) {
    if (selectedId === def.id) return;

    persistDraft();
    setSelectedId(def.id);
    const fallback = draftFromDefinition(def);
    const stored = localStorage.getItem(`card-builder:draft:${def.id}`);
    if (stored) {
      try {
        setDraft(hydrateDraft(JSON.parse(stored) as Partial<BuilderDraft>, fallback));
        setMessage("Auto-saved the previous card and loaded your local draft.");
        return;
      } catch {
        localStorage.removeItem(`card-builder:draft:${def.id}`);
      }
    }
    setDraft(fallback);
    setMessage("Auto-saved the previous card.");
  }

  function patch<K extends keyof BuilderDraft>(key: K, value: BuilderDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function patchLayout(key: keyof LayoutOffsets, value: number) {
    setDraft((current) => ({ ...current, layout: { ...current.layout, [key]: value } }));
  }

  function applyProjectDefaultPresentation() {
    setDraft((current) => ({
      ...current,
      ...PROJECT_DEFAULT_PRESENTATION,
      layout: { ...PROJECT_DEFAULT_LAYOUT },
    }));
    setMessage("Applied the project default card layout. Card content and artwork were left unchanged.");
  }

  function changeArchetype(next: CardArchetype) {
    setDraft((current) => ({
      ...current,
      archetype: next,
      baseKey: defaultBase(next),
      playPool: defaultPool(next),
    }));
  }

  function changeCategoryCount(count: number) {
    setDraft((current) => {
      const categories = [...current.categories];
      while (categories.length < count) categories.push("");
      return { ...current, categories: categories.slice(0, count) };
    });
  }

  function patchCategory(index: number, value: string) {
    setDraft((current) => {
      const categories = [...current.categories];
      categories[index] = value;
      return { ...current, categories };
    });
  }

  function saveDraft() {
    persistDraft();
    setMessage("Draft saved locally in this browser.");
  }

  function resetDraft() {
    const def = definitions.find((candidate) => candidate.id === selectedId);
    if (!def) return;
    localStorage.removeItem(`card-builder:draft:${def.id}`);
    setDraft(draftFromDefinition(def));
    setMessage("Reset to the canonical card definition with the project default presentation.");
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
    setMessage("Draft JSON copied.");
  }

  function createNew() {
    persistDraft();
    setSelectedId("");
    setDraft(emptyDraft());
    setMessage("Auto-saved the previous card. New unsaved card draft uses the project default presentation.");
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
          <button onClick={applyProjectDefaultPresentation}>Default Layout</button>
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
            {draft.archetype !== "hero" && (
              <label>Play Resource
                <select value={draft.playPool} onChange={(event) => patch("playPool", event.target.value as ResourceKind)}>
                  <option value="energy">Energy</option>
                  <option value="mana">Mana</option>
                  <option value="resource">Resources</option>
                </select>
              </label>
            )}
            {(draft.archetype === "creature" || draft.archetype === "hero") && <label>Attack<input type="number" value={draft.attack} onChange={(event) => patch("attack", Number(event.target.value))} /></label>}
            {(draft.archetype === "creature" || draft.archetype === "building" || draft.archetype === "hero") && <label>Health<input type="number" value={draft.hp} onChange={(event) => patch("hp", Number(event.target.value))} /></label>}
          </div>

          <label>Rules Text<textarea rows={5} value={draft.text} onChange={(event) => patch("text", event.target.value)} /></label>
          {draft.archetype === "creature" && <label>Keywords<input value={draft.keywords} onChange={(event) => patch("keywords", event.target.value)} placeholder="ranged, charge, taunt…" /></label>}

          <div className="cb-section-title">Printed Categories</div>
          <div className="cb-fields cb-fields--two">
            <label>Number of categories
              <select value={draft.categories.length} onChange={(event) => changeCategoryCount(Number(event.target.value))}>
                {Array.from({ length: MAX_CATEGORIES }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
            {draft.categories.map((category, index) => (
              <label key={index}>Category {index + 1}<input value={category} onChange={(event) => patchCategory(index, event.target.value)} /></label>
            ))}
          </div>
          <p className="cb-note">These are presentation labels, so they can read Common • Neutral • Ranger, Rare • Skaldjborn • Human • Fighter, or any other 1–5 label combination without changing the engine taxonomy.</p>

          <div className="cb-section-title">Artwork</div>
          <label>Art path or URL<input value={draft.art} onChange={(event) => patch("art", event.target.value)} placeholder="/cards/My-Card.png" /></label>
          <div className="cb-slider-row">
            <label>Zoom <span>{draft.artScale.toFixed(2)}×</span><input type="range" min="0.75" max="2.2" step="0.01" value={draft.artScale} onChange={(event) => patch("artScale", Number(event.target.value))} /></label>
            <label>X <span>{draft.artX}%</span><input type="range" min="-50" max="50" step="1" value={draft.artX} onChange={(event) => patch("artX", Number(event.target.value))} /></label>
            <label>Y <span>{draft.artY}%</span><input type="range" min="-50" max="50" step="1" value={draft.artY} onChange={(event) => patch("artY", Number(event.target.value))} /></label>
          </div>

          <div className="cb-section-title">Resource Icon</div>
          <label>Custom icon path or URL (optional)<input value={draft.resourceIcon} onChange={(event) => patch("resourceIcon", event.target.value)} placeholder="/icons/mana.png — blank uses the built-in placeholder" /></label>
          <p className="cb-note">The selected play resource controls the built-in Energy / Mana / Resources placeholder icon. A custom image path replaces it, so final resource symbols can be dropped in later without changing the card layout.</p>

          <div className="cb-section-title">Typography</div>
          <div className="cb-fields cb-fields--two">
            <label>Display font
              <input list="cb-font-presets" value={draft.titleFont} onChange={(event) => patch("titleFont", event.target.value)} />
            </label>
            <label>Rules font
              <input list="cb-font-presets" value={draft.bodyFont} onChange={(event) => patch("bodyFont", event.target.value)} />
            </label>
          </div>
          <datalist id="cb-font-presets">{FONT_PRESETS.map((font) => <option key={font} value={font} />)}</datalist>
          <div className="cb-size-grid">
            <label>Name <input type="number" min={6} max={48} value={draft.nameSize} onChange={(event) => patch("nameSize", Number(event.target.value))} /></label>
            <label>Cost <input type="number" min={6} max={48} value={draft.costSize} onChange={(event) => patch("costSize", Number(event.target.value))} /></label>
            <label>Icon <input type="number" min={6} max={48} value={draft.resourceSize} onChange={(event) => patch("resourceSize", Number(event.target.value))} /></label>
            <label>Categories <input type="number" min={6} max={30} value={draft.categorySize} onChange={(event) => patch("categorySize", Number(event.target.value))} /></label>
            <label>Rules <input type="number" min={6} max={30} value={draft.rulesSize} onChange={(event) => patch("rulesSize", Number(event.target.value))} /></label>
            <label>Stats <input type="number" min={8} max={52} value={draft.statSize} onChange={(event) => patch("statSize", Number(event.target.value))} /></label>
          </div>
          <button className="cb-reset-layout" onClick={applyProjectDefaultPresentation}>Apply project default layout</button>
          <p className="cb-note">The project default is the centered layout you approved: Trajan/Cinzel display styling, Cinzel rules text, the tuned font sizes, and the tuned Name / Cost / Resource / Categories / Rules / Attack / Health positions. It does not change card content, artwork, categories, cost, or resource choice.</p>
          <p className="cb-note">You can type any CSS font-family stack here. If the font exists on the machine or is later bundled with the game, the preview will use it; otherwise the next font in the stack is used.</p>

          <div className="cb-section-title">Element Positioning</div>
          <div className="cb-layout-controls">
            <LayoutControl label="Name" x={draft.layout.nameX} y={draft.layout.nameY} onChange={(axis, value) => patchLayout(axis === "x" ? "nameX" : "nameY", value)} />
            <LayoutControl label="Cost" x={draft.layout.costX} y={draft.layout.costY} onChange={(axis, value) => patchLayout(axis === "x" ? "costX" : "costY", value)} />
            <LayoutControl label="Resource icon" x={draft.layout.resourceX} y={draft.layout.resourceY} onChange={(axis, value) => patchLayout(axis === "x" ? "resourceX" : "resourceY", value)} />
            <LayoutControl label="Categories" x={draft.layout.categoriesX} y={draft.layout.categoriesY} onChange={(axis, value) => patchLayout(axis === "x" ? "categoriesX" : "categoriesY", value)} />
            <LayoutControl label="Rules text" x={draft.layout.rulesX} y={draft.layout.rulesY} onChange={(axis, value) => patchLayout(axis === "x" ? "rulesX" : "rulesY", value)} />
            {draft.archetype === "creature" && <LayoutControl label="Attack" x={draft.layout.attackX} y={draft.layout.attackY} onChange={(axis, value) => patchLayout(axis === "x" ? "attackX" : "attackY", value)} />}
            {(draft.archetype === "creature" || draft.archetype === "building" || draft.archetype === "spell") && <LayoutControl label={draft.archetype === "spell" ? "Damage" : "Health"} x={draft.layout.healthX} y={draft.layout.healthY} onChange={(axis, value) => patchLayout(axis === "x" ? "healthX" : "healthY", value)} />}
          </div>
          <button className="cb-reset-layout" onClick={() => patch("layout", { ...PROJECT_DEFAULT_LAYOUT })}>Reset positions to project default</button>

          <div className="cb-section-title">Card Base</div>
          <label>Template
            <select value={draft.baseKey} onChange={(event) => patch("baseKey", event.target.value as BaseKey)}>
              <option value="">None / not uploaded</option>
              {Object.entries(CARD_BASE_ASSETS).map(([key, spec]) => <option key={key} value={key}>{spec.label}</option>)}
            </select>
          </label>
          {draft.archetype === "equipment" && draft.baseKey === "BaseAbility" && (
            <p className="cb-note">Temporary mapping: BaseAbility is the remaining distinct uploaded base, so the builder treats it as the Equipment candidate until you confirm its intended name.</p>
          )}
          {draft.archetype === "hero" && !draft.baseKey && (
            <p className="cb-note">No dedicated Hero base is present in the uploaded set yet. Heroes can remain a battlefield portrait/HUD type if that is intentional.</p>
          )}

          <div className="cb-section-title">Canonical Mechanics</div>
          <pre className="cb-definition-json">{selectedDef ? JSON.stringify(selectedDef, null, 2) : "New card: canonical engine save is not enabled yet."}</pre>
        </section>

        <aside className="cb-preview-panel">
          <div className="cb-panel-title">Live Card Preview</div>
          <LayeredCardPreview draft={draft} sourceDef={selectedDef} />
          <p className="cb-preview-help">The frame, art, typography, categories, resource icon and live values are separate layers. These presentation settings can be handed to the shared Phaser renderer next.</p>
        </aside>
      </section>
    </main>
  );
}
