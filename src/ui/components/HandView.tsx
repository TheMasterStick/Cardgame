import { getHandCardPlayability } from "../../engine/game";
import type { GameState } from "../../engine/types";
import { CardView } from "./CardView";

interface HandViewProps {
  state: GameState;
  interactive: boolean;
  onCardClick: (instanceId: string) => void;
}

export function HandView({ state, interactive, onCardClick }: HandViewProps) {
  const playerState = state.players.player;
  return (
    <div className="hand">
      {playerState.hand.map((card) => {
        const playability = getHandCardPlayability(state, "player", card.instanceId);
        return (
          <CardView
            key={card.instanceId}
            instance={card}
            highlighted={interactive && playability.playable}
            onClick={interactive ? () => onCardClick(card.instanceId) : undefined}
            playability={playability}
            variant="full"
          />
        );
      })}
      {playerState.hand.length === 0 && <div className="hand__empty">Hand is empty</div>}
    </div>
  );
}
