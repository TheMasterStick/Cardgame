import type { PlayerState } from "../../engine/types";

interface ResourceBarProps {
  playerState: PlayerState;
  label: string;
  /** "horizontal" (default): a single row above/below a board. "vertical": a narrow side panel next to a board (App.tsx's board-row layout). */
  layout?: "horizontal" | "vertical";
}

function Pip({ label, current, cap, className }: { label: string; current: number; cap: number; className: string }) {
  return (
    <div className={`pip pip--${className}`}>
      <span className="pip__label">{label}</span>
      <span className="pip__value">
        {current}/{cap}
      </span>
    </div>
  );
}

export function ResourceBar({ playerState, label, layout = "horizontal" }: ResourceBarProps) {
  return (
    <div className={`resource-bar ${layout === "vertical" ? "resource-bar--vertical" : ""}`}>
      <span className="resource-bar__label">{label}</span>
      <Pip label="Resources" current={playerState.resources.current} cap={playerState.resources.cap} className="resources" />
      <Pip label="Mana" current={playerState.mana.current} cap={playerState.mana.cap} className="mana" />
      <Pip label="Energy" current={playerState.energy.current} cap={playerState.energy.cap} className="energy" />
      <span className="resource-bar__deck">Deck: {playerState.deck.length}</span>
      <span className="resource-bar__deck">Discard: {playerState.discard.length}</span>
    </div>
  );
}
