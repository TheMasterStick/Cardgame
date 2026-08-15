import type { HeroDefinition } from "../engine/types";

// Base Hero HP/Attack by class, per DESIGN.md §5.
// Attack only matters once an Equipment card is in the hero's Equipment slot.
export const HEROES: Record<string, HeroDefinition> = {
  fighter: { id: "fighter", name: "Fighter", class: "fighter", baseHp: 20, baseAttack: 10 },
  mage: { id: "mage", name: "Mage", class: "mage", baseHp: 10, baseAttack: 20 },
  rogue: { id: "rogue", name: "Rogue", class: "rogue", baseHp: 15, baseAttack: 15 },
};
