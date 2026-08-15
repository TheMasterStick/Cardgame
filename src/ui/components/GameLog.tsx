interface GameLogProps {
  log: string[];
}

export function GameLog({ log }: GameLogProps) {
  const recent = log.slice(-8).reverse();
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
