import type { CSSProperties, SyntheticEvent } from "react";
import {
  LOCAL_CARD_BASE_FALLBACK,
  cardBaseAssetUrl,
  getRuntimeCardPresentation,
  resourceIconUrl,
} from "../../card-rendering/presentation";
import type { CardDefinition, CreatureDefinition } from "../../engine/types";

interface LayeredCardFaceProps {
  def: CardDefinition;
  attack?: number | null;
  health?: number | null;
  unplayable?: boolean;
}

function offsetStyle(x: number, y: number): CSSProperties {
  return { transform: `translate(${x}%, ${y}%)` };
}

function scaledFont(size: number): string {
  return `${size / 3.84}cqw`;
}

function effectDamage(def: CardDefinition): number | null {
  if (def.archetype !== "spell" && def.archetype !== "ability") return null;
  if (def.effect.kind === "damage") return def.effect.amount;
  if (def.effect.kind === "multi") {
    const damage = def.effect.effects.find((effect) => effect.kind === "damage");
    return damage?.kind === "damage" ? damage.amount : null;
  }
  return null;
}

function useFallbackFrame(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.src.endsWith(LOCAL_CARD_BASE_FALLBACK)) return;
  image.classList.add("layered-card__base--opaque-fallback");
  image.src = LOCAL_CARD_BASE_FALLBACK;
}

/**
 * The runtime equivalent of the Card Builder preview. It consumes the same
 * saved frame/art/layout draft while keeping the engine CardDefinition
 * authoritative for printed name, cost, text and base stats.
 */
export function LayeredCardFace({ def, attack, health, unplayable = false }: LayeredCardFaceProps) {
  const runtime = getRuntimeCardPresentation(def);
  const presentation = runtime.presentation;
  const categories = presentation.categories.filter((category) => category.trim()).join(" • ");
  const damage = effectDamage(def);
  const printedAttack = def.archetype === "creature"
    ? attack ?? (def as CreatureDefinition).attack
    : null;
  const printedHealth = def.archetype === "creature" || def.archetype === "building"
    ? health ?? def.hp
    : null;

  return (
    <div className={`layered-card layered-card--${def.archetype}${unplayable ? " layered-card--unplayable" : ""}`}>
      <div className="layered-card__art-window">
        {runtime.art ? (
          <img
            className="layered-card__art"
            src={runtime.art}
            alt=""
            style={{ transform: `translate(${presentation.artX}%, ${presentation.artY}%) scale(${presentation.artScale})` }}
          />
        ) : (
          <div className="layered-card__art-placeholder">ARTWORK</div>
        )}
      </div>

      <div
        className="layered-card__name"
        style={{
          ...offsetStyle(presentation.layout.nameX, presentation.layout.nameY),
          fontFamily: presentation.titleFont,
          fontSize: scaledFont(presentation.nameSize),
        }}
      >
        {def.name}
      </div>

      <div
        className="layered-card__cost"
        style={{
          ...offsetStyle(presentation.layout.costX, presentation.layout.costY),
          fontFamily: presentation.titleFont,
          fontSize: scaledFont(presentation.costSize),
        }}
      >
        {def.cost}
      </div>

      <div
        className={`layered-card__resource layered-card__resource--${runtime.playPool}`}
        style={offsetStyle(presentation.layout.resourceX, presentation.layout.resourceY)}
      >
        <img src={resourceIconUrl(runtime.playPool, presentation.resourceIcon)} alt={runtime.playPool} />
      </div>

      <div
        className="layered-card__categories"
        style={{
          ...offsetStyle(presentation.layout.categoriesX, presentation.layout.categoriesY),
          fontFamily: presentation.titleFont,
          fontSize: scaledFont(presentation.categorySize),
        }}
      >
        {categories}
      </div>

      <div
        className="layered-card__rules"
        style={{
          ...offsetStyle(presentation.layout.rulesX, presentation.layout.rulesY),
          fontFamily: presentation.bodyFont,
          fontSize: scaledFont(presentation.rulesSize),
        }}
      >
        {def.text}
      </div>

      {printedAttack !== null && (
        <div
          className="layered-card__stat layered-card__stat--attack"
          style={{
            ...offsetStyle(presentation.layout.attackX, presentation.layout.attackY),
            fontFamily: presentation.titleFont,
            fontSize: scaledFont(presentation.statSize),
          }}
        >
          {printedAttack}
        </div>
      )}
      {printedHealth !== null && (
        <div
          className="layered-card__stat layered-card__stat--health"
          style={{
            ...offsetStyle(presentation.layout.healthX, presentation.layout.healthY),
            fontFamily: presentation.titleFont,
            fontSize: scaledFont(presentation.statSize),
          }}
        >
          {printedHealth}
        </div>
      )}
      {def.archetype === "spell" && damage !== null && (
        <div
          className="layered-card__stat layered-card__stat--spell-damage"
          style={{
            ...offsetStyle(presentation.layout.healthX, presentation.layout.healthY),
            fontFamily: presentation.titleFont,
            fontSize: scaledFont(presentation.statSize),
          }}
        >
          {damage}
        </div>
      )}

      <img
        className="layered-card__base"
        src={cardBaseAssetUrl(presentation.baseKey)}
        alt=""
        onError={useFallbackFrame}
      />
    </div>
  );
}
