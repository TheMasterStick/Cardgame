import { HEROES } from "../../data/heroes";
import type { HeroClass } from "../../engine/types";

interface HeroSelectProps {
  onSelect: (heroClass: HeroClass) => void;
}

const CLASS_ORDER: HeroClass[] = ["fighter", "mage", "rogue"];

export function HeroSelect({ onSelect }: HeroSelectProps) {
  return (
    <div className="hero-select">
      <h1>Choose Your Hero</h1>
      <p className="hero-select__subtitle">
        Each class starts with a themed 30-card deck. Base Hero HP/Attack varies by class — a
        squishy Mage hits hard with spells, a tanky Fighter grinds it out in melee.
      </p>
      <div className="hero-select__options">
        {CLASS_ORDER.map((cls) => {
          const def = HEROES[cls];
          return (
            <button key={cls} className="hero-option" onClick={() => onSelect(cls)}>
              <div className="hero-option__name">{def.name}</div>
              <div className="hero-option__stats">
                HP {def.baseHp} · ATK {def.baseAttack} (with Equipment)
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
