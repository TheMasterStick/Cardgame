import type { PlayerState } from "../../engine/types";
import { CardView } from "./CardView";

interface HandViewProps {
  playerState: PlayerState;
  interactive: boolean;
  onCardClick: (instanceId: string) => void;
}

export function HandView({ playerState, interactive, onCardClick }: HandViewProps) {
  return (
    <div className="hand">
      {playerState.hand.map((card) => (
        <CardView
          key={card.instanceId}
          instance={card}
          highlighted={interactive}
          onClick={interactive ? () => onCardClick(card.instanceId) : undefined}
          variant="full"
        />
      ))}
      {playerState.hand.length === 0 && <div className="hand__empty">Hand is empty</div>}
    </div>
  );
}
