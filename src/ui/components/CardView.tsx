import { CARD_DEFINITIONS } from "../../data/cards";
import type { CardInstance, CreatureDefinition } from "../../engine/types";

interface CardViewProps {
  instance: CardInstance;
  onClick?: () => void;
  highlighted?: boolean;
}

export function CardView({ instance, onClick, highlighted }: CardViewProps) {
  const def = CARD_DEFINITIONS[instance.defId];

  const classes = ["card", `card--${def.archetype}`, `card--rarity-${def.rarity}`];
  if (highlighted) classes.push("card--highlight");
  if (onClick) classes.push("card--clickable");
  if (def.art) classes.push("card--has-art");

  return (
    <div className={classes.join(" ")} onClick={onClick} title={def.text ?? def.name}>
      {def.art && (
        <div className="card__art" style={{ backgroundImage: `url("${def.art}")` }} aria-hidden="true" />
      )}
      <span className="card__rarity-dot" aria-hidden="true" />
      <div className="card__top">
        {"cost" in def && <div className="card__cost">{def.cost}</div>}
        <div className="card__name">{def.name}</div>
      </div>
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
