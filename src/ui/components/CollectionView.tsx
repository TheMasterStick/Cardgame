import { CARD_DEFINITIONS } from "../../data/cards";
import type { Collection } from "../../engine/collection";
import { ownedCount } from "../../engine/collection";
import { createCardInstance } from "../../engine/factory";
import { CardView } from "./CardView";

interface CollectionViewProps {
  collection: Collection;
  onBack: () => void;
}

export function CollectionView({ collection, onBack }: CollectionViewProps) {
  const allDefs = Object.values(CARD_DEFINITIONS)
    .filter((def) => def.archetype !== "hero")
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const uniqueOwned = allDefs.filter((def) => ownedCount(collection, def.id) > 0).length;
  const totalOwned = Object.values(collection.owned).reduce((a, b) => a + b, 0);

  return (
    <div className="screen">
      <div className="screen__header">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <h2>My Collection</h2>
        <div className="screen__subtitle">
          {uniqueOwned}/{allDefs.length} unique · {totalOwned} total
        </div>
      </div>
      <div className="collection-grid">
        {allDefs.map((def) => {
          const count = ownedCount(collection, def.id);
          return (
            <div key={def.id} className={`collection-entry ${count === 0 ? "collection-entry--locked" : ""}`}>
              <CardView instance={createCardInstance(def.id, "player")} />
              <div className="collection-entry__count">{count > 0 ? `×${count}` : "Not owned"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
