import { useState } from "react";
import { PACK_COST, PACK_SIZE } from "../../data/packs";
import { createCardInstance } from "../../engine/factory";
import { CardView } from "./CardView";

interface PackOpeningProps {
  coins: number;
  canAfford: boolean;
  onOpenPack: () => string[];
  onBack: () => void;
}

export function PackOpening({ coins, canAfford, onOpenPack, onBack }: PackOpeningProps) {
  const [revealed, setRevealed] = useState<string[] | null>(null);

  function handleOpen() {
    setRevealed(onOpenPack());
  }

  return (
    <div className="screen">
      <div className="screen__header">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <h2>Card Packs</h2>
        <div className="screen__subtitle">🪙 {coins} coins</div>
      </div>
      <p className="screen__blurb">
        Each pack has {PACK_SIZE} cards for {PACK_COST} coins. Odds favor commons, with rarer pulls on
        rare/epic/legendary cards.
      </p>
      <button className="btn btn--primary" onClick={handleOpen} disabled={!canAfford}>
        Open Pack ({PACK_COST} coins)
      </button>
      {revealed && revealed.length === 0 && <p className="screen__blurb">Not enough coins for a pack.</p>}
      {revealed && revealed.length > 0 && (
        <div className="pack-reveal">
          {revealed.map((defId, i) => (
            <CardView key={i} instance={createCardInstance(defId, "player")} />
          ))}
        </div>
      )}
    </div>
  );
}
