interface GameLogProps {
  log: string[];
}

export function GameLog({ log }: GameLogProps) {
  // The log now lives in a tall sidebar (see App.tsx) instead of a short
  // strip under the board, so it can afford to show a lot more history —
  // it scrolls internally past that if a long match runs it over.
  const recent = log.slice(-60).reverse();
  return (
    <div className="game-log">
      {recent.map((entry, i) => (
        <div key={log.length - i} className="game-log__entry">
          {entry}
        </div>
      ))}
    </div>
  );
}
