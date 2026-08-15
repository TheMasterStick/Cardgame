import { CARD_DEFINITIONS } from "../../data/cards";
import { ELEMENT_LABELS, KEYWORD_LABELS, RACE_LABELS } from "../../data/taxonomy";
import type { CardDefinition, CardInstance, CreatureDefinition, HeroCardDefinition } from "../../engine/types";

interface CardViewProps {
  instance: CardInstance;
  onClick?: () => void;
  highlighted?: boolean;
  /** Renders this definition instead of looking `instance.defId` up in CARD_DEFINITIONS — for previewing a card that hasn't been saved yet (e.g. the admin form). */
  defOverride?: CardDefinition;
}

export function CardView({ instance, onClick, highlighted, defOverride }: CardViewProps) {
  const def = defOverride ?? CARD_DEFINITIONS[instance.defId];

  const classes = ["card", `card--${def.archetype}`, `card--rarity-${def.rarity}`];
  if (highlighted) classes.push("card--highlight");
  if (onClick) classes.push("card--clickable");
  if (def.art) classes.push("card--has-art");

  const metaParts: string[] = [];
  if (def.race) metaParts.push(RACE_LABELS[def.race]);
  if (def.element) metaParts.push(ELEMENT_LABELS[def.element]);
  const keywords = def.archetype === "creature" ? def.keywords : [];

  return (
    <div className={classes.join(" ")} onClick={onClick} title={def.text ?? def.name}>
      {def.art && (
        <div className="card__art" style={{ backgroundImage: `url("${def.art}")` }} aria-hidden="true" />
      )}
      <span className="card__rarity-dot" aria-hidden="true" />
      <div className="card__top">
        {"cost" in def && def.archetype !== "hero" && <div className="card__cost">{def.cost}</div>}
        <div className="card__name">{def.name}</div>
      </div>
      {metaParts.length > 0 && <div className="card__meta">{metaParts.join(" · ")}</div>}
      {keywords.length > 0 && (
        <div className="card__keywords">
          {keywords.map((k) => (
            <span key={k} className="card__keyword-tag">
              {KEYWORD_LABELS[k]}
            </span>
          ))}
        </div>
      )}
      {def.text && <div className="card__text">{def.text}</div>}
      <div className="card__bottom">
        {def.archetype === "creature" && (
          <>
            <span className="stat stat--attack">
              {(def as CreatureDefinition).attack + instance.attackDelta}
            </span>
            <span className="stat stat--hp">{instance.currentHp}</span>
          </>
        )}
        {def.archetype === "hero" && (
          <>
            <span className="stat stat--attack">{(def as HeroCardDefinition).attack}</span>
            <span className="stat stat--hp">{(def as HeroCardDefinition).hp}</span>
          </>
        )}
        {def.archetype === "building" && <span className="stat stat--hp">{instance.currentHp}</span>}
        {(def.archetype === "spell" || def.archetype === "ability") && (
          <span className="stat stat--charges">
            {instance.chargesRemaining === "unlimited" ? "∞" : `${instance.chargesRemaining}x`}
          </span>
        )}
      </div>
      {instance.statuses.length > 0 && (
        <div className="card__statuses">
          {instance.statuses.map((s, i) => (
            <span key={i} className={`status status--${s.type}`}>
              {s.type === "burn" ? "🔥" : "☠"}
              {s.amount}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
