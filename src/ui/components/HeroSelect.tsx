import { CARD_DEFINITIONS } from "../../data/cards";
import { STARTER_DECKS } from "../../data/decks";
import type { HeroCardDefinition } from "../../engine/types";

interface HeroSelectProps {
  onSelect: (heroDefId: string) => void;
}

export function HeroSelect({ onSelect }: HeroSelectProps) {
  const heroIds = Object.keys(STARTER_DECKS);

  return (
    <div className="hero-select">
      <h1>Choose Your Hero</h1>
      <p className="hero-select__subtitle">
        Each Hero starts with a themed 30-card deck. Base HP/Attack varies by Hero — a squishy
        Mage hits hard with spells, a tanky Fighter grinds it out in melee.
      </p>
      <div className="hero-select__options">
        {heroIds.map((heroId) => {
          const def = CARD_DEFINITIONS[heroId] as HeroCardDefinition;
          return (
            <button
              key={heroId}
              className={`hero-option ${def.art ? "hero-option--has-art" : ""}`}
              onClick={() => onSelect(heroId)}
              style={def.art ? { backgroundImage: `url("${def.art}")` } : undefined}
            >
              <div className="hero-option__name">{def.name}</div>
              <div className="hero-option__stats">
                HP {def.hp} · ATK {def.attack} (with Equipment)
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
