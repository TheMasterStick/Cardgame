import { useState } from "react";
import { CARD_DEFINITIONS } from "../../data/cards";
import { HEROES } from "../../data/heroes";
import type { Collection } from "../../engine/collection";
import { ownedCount } from "../../engine/collection";
import type { DeckDraft } from "../../engine/customDeck";
import { deckSize } from "../../engine/customDeck";
import { createCardInstance } from "../../engine/factory";
import { DECK_SIZE, type HeroClass } from "../../engine/types";
import { CardView } from "./CardView";

interface DeckBuilderProps {
  collection: Collection;
  deck: DeckDraft;
  onAdd: (defId: string) => void;
  onRemove: (defId: string) => void;
  onPlay: (heroClass: HeroClass) => void;
  onBack: () => void;
}

const HERO_CLASSES: HeroClass[] = ["fighter", "mage", "rogue"];

export function DeckBuilder({ collection, deck, onAdd, onRemove, onPlay, onBack }: DeckBuilderProps) {
  const [heroClass, setHeroClass] = useState<HeroClass>("fighter");
  const total = deckSize(deck);
  const allDefs = Object.values(CARD_DEFINITIONS).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const deckEntries = Object.entries(deck)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => CARD_DEFINITIONS[a].name.localeCompare(CARD_DEFINITIONS[b].name));

  return (
    <div className="screen">
      <div className="screen__header">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <h2>Deck Builder</h2>
        <div className={`screen__subtitle ${total === DECK_SIZE ? "screen__subtitle--ready" : ""}`}>
          {total}/{DECK_SIZE} cards
        </div>
      </div>

      <div className="deck-builder">
        <div className="deck-builder__pane">
          <h3>Collection</h3>
          <div className="deck-builder__list">
            {allDefs.map((def) => {
              const owned = ownedCount(collection, def.id);
              const inDeck = deck[def.id] ?? 0;
              const canAdd = inDeck < owned && total < DECK_SIZE;
              return (
                <div key={def.id} className="deck-builder__row">
                  <CardView instance={createCardInstance(def.id, "player")} />
                  <div className="deck-builder__row-controls">
                    <span className="deck-builder__owned">
                      {inDeck}/{owned} owned
                    </span>
                    <button className="btn btn--small" disabled={!canAdd} onClick={() => onAdd(def.id)}>
                      +
                    </button>
                    <button className="btn btn--small" disabled={inDeck === 0} onClick={() => onRemove(def.id)}>
                      −
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="deck-builder__pane">
          <h3>Your Deck</h3>
          <div className="deck-builder__list">
            {deckEntries.length === 0 && <p className="screen__blurb">Add cards from your collection.</p>}
            {deckEntries.map(([defId, count]) => (
              <div key={defId} className="deck-builder__row deck-builder__row--compact">
                <span>{CARD_DEFINITIONS[defId].name}</span>
                <span className="deck-builder__owned">×{count}</span>
                <button className="btn btn--small" onClick={() => onRemove(defId)}>
                  −
                </button>
              </div>
            ))}
          </div>

          <div className="deck-builder__play">
            <label className="deck-builder__hero-label">
              Hero
              <select value={heroClass} onChange={(e) => setHeroClass(e.target.value as HeroClass)}>
                {HERO_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {HEROES[cls].name} (HP {HEROES[cls].baseHp} / ATK {HEROES[cls].baseAttack})
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn--primary" disabled={total !== DECK_SIZE} onClick={() => onPlay(heroClass)}>
              Play This Deck
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
