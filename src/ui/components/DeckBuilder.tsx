import { useState } from "react";
import { CARD_DEFINITIONS } from "../../data/cards";
import type { Collection } from "../../engine/collection";
import { ownedCount } from "../../engine/collection";
import type { DeckDraft } from "../../engine/customDeck";
import { deckAllegianceViolations, deckSize, isCardAllowedForHero } from "../../engine/customDeck";
import { createCardInstance } from "../../engine/factory";
import { DECK_SIZE, type HeroCardDefinition } from "../../engine/types";
import { CardView } from "./CardView";

interface DeckBuilderProps {
  collection: Collection;
  deck: DeckDraft;
  onAdd: (defId: string) => void;
  onRemove: (defId: string) => void;
  onPlay: (heroDefId: string) => void;
  onBack: () => void;
}

export function DeckBuilder({ collection, deck, onAdd, onRemove, onPlay, onBack }: DeckBuilderProps) {
  const heroCards = Object.values(CARD_DEFINITIONS).filter(
    (def): def is HeroCardDefinition => def.archetype === "hero",
  );
  const [heroDefId, setHeroDefId] = useState<string>(heroCards[0]?.id ?? "");
  const heroDef = CARD_DEFINITIONS[heroDefId] as HeroCardDefinition | undefined;
  const total = deckSize(deck);
  const allDefs = Object.values(CARD_DEFINITIONS)
    .filter((def) => def.archetype !== "hero")
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const deckEntries = Object.entries(deck)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => CARD_DEFINITIONS[a].name.localeCompare(CARD_DEFINITIONS[b].name));
  // DESIGN.md §10 — Allegiance is enforced at save/validate time, not by
  // silently hiding cards: a card added under a different Hero stays in the
  // deck (and visibly flagged) until the player removes it themselves.
  const violations = heroDef ? new Set(deckAllegianceViolations(deck, heroDef).map((c) => c.id)) : new Set<string>();

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
              const allowed = !heroDef || isCardAllowedForHero(heroDef, def);
              const canAdd = inDeck < owned && total < DECK_SIZE && allowed;
              return (
                <div key={def.id} className="deck-builder__row">
                  <CardView instance={createCardInstance(def.id, "player")} />
                  <div className="deck-builder__row-controls">
                    <span className="deck-builder__owned">
                      {inDeck}/{owned} owned
                    </span>
                    {!allowed && <span className="deck-builder__allegiance-warning">Not {heroDef?.name}'s Faction</span>}
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
                <span>
                  {CARD_DEFINITIONS[defId].name}
                  {violations.has(defId) && <span className="deck-builder__allegiance-warning"> ⚠ breaks Allegiance</span>}
                </span>
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
              <select value={heroDefId} onChange={(e) => setHeroDefId(e.target.value)}>
                {heroCards.map((hero) => (
                  <option key={hero.id} value={hero.id}>
                    {hero.name} (HP {hero.hp} / ATK {hero.attack})
                  </option>
                ))}
              </select>
            </label>
            {violations.size > 0 && (
              <p className="deck-builder__allegiance-warning">
                {violations.size} card{violations.size > 1 ? "s" : ""} in this deck don't match {heroDef?.name}'s Faction — remove
                them before playing.
              </p>
            )}
            <button
              className="btn btn--primary"
              disabled={total !== DECK_SIZE || !heroDefId || violations.size > 0}
              onClick={() => onPlay(heroDefId)}
            >
              Play This Deck
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
