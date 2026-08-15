interface MainMenuProps {
  coins: number;
  onQuickPlay: () => void;
  onCollection: () => void;
  onPacks: () => void;
  onDeckBuilder: () => void;
}

export function MainMenu({ coins, onQuickPlay, onCollection, onPacks, onDeckBuilder }: MainMenuProps) {
  return (
    <div className="main-menu">
      <h1>Cardgame</h1>
      <div className="main-menu__coins">🪙 {coins} coins</div>
      <div className="main-menu__options">
        <button className="menu-option" onClick={onQuickPlay}>
          <div className="menu-option__title">Quick Play</div>
          <div className="menu-option__desc">Pick a Hero and play with its ready-made starter deck.</div>
        </button>
        <button className="menu-option" onClick={onDeckBuilder}>
          <div className="menu-option__title">Deck Builder</div>
          <div className="menu-option__desc">Build a 30-card deck from your collection and play with it.</div>
        </button>
        <button className="menu-option" onClick={onPacks}>
          <div className="menu-option__title">Card Packs</div>
          <div className="menu-option__desc">Spend coins on packs to grow your collection.</div>
        </button>
        <button className="menu-option" onClick={onCollection}>
          <div className="menu-option__title">My Collection</div>
          <div className="menu-option__desc">Browse every card you own.</div>
        </button>
      </div>
    </div>
  );
}
