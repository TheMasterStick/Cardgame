import { useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { CARD_DEFINITIONS } from "./data/cards";
import { STARTER_DECKS } from "./data/decks";
import { BOARD_THEME, cssImage } from "./data/theme";
import { creatureCanAttack, declareCreatureAttack, declareHeroAttack, heroCanAttack, type AttackTarget } from "./engine/combat";
import { awardMatchCoins, canAffordPack, loadCollection, openPack, saveCollection, type Collection } from "./engine/collection";
import { deckSize, deckToIds, loadCustomDeck, saveCustomDeck, type DeckDraft } from "./engine/customDeck";
import type { EffectTargetRef } from "./engine/effects";
import { createInitialGameState } from "./engine/factory";
import { runAiTurn } from "./engine/ai";
import { activateSlotCard, endTurn, playCardFromHand, startGame } from "./engine/game";
import { DECK_SIZE, type GameState, type HeroClass, type PlayerId } from "./engine/types";
import { AccountBar } from "./ui/components/AccountBar";
import { CollectionView } from "./ui/components/CollectionView";
import { DeckBuilder } from "./ui/components/DeckBuilder";
import { GameLog } from "./ui/components/GameLog";
import { HandView } from "./ui/components/HandView";
import { HeroSelect } from "./ui/components/HeroSelect";
import { MainMenu } from "./ui/components/MainMenu";
import { PackOpening } from "./ui/components/PackOpening";
import { PlayerBoard } from "./ui/components/PlayerBoard";
import { ResourceBar } from "./ui/components/ResourceBar";
import { effectNeedsExplicitTarget, type PendingAction } from "./ui/targeting";

const HERO_CLASSES: HeroClass[] = ["fighter", "mage", "rogue"];

type Screen = "menu" | "heroSelect" | "collection" | "packs" | "deckBuilder" | "playing";

const appStyle = { "--app-bg-image": cssImage(BOARD_THEME.appBackground) } as CSSProperties;

export default function App() {
  const gameRef = useRef<GameState | null>(null);
  const matchRewardGivenRef = useRef(false);
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [message, setMessage] = useState<string>("");
  const [screen, setScreen] = useState<Screen>("menu");
  const [collection, setCollection] = useState<Collection>(() => loadCollection());
  const [customDeck, setCustomDeck] = useState<DeckDraft>(() => loadCustomDeck());

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(t);
  }, [message]);

  function commit() {
    const state = gameRef.current;
    if (state?.winner && !matchRewardGivenRef.current) {
      matchRewardGivenRef.current = true;
      setCollection((c) => {
        const updated = awardMatchCoins(c, state.winner === "player");
        saveCollection(updated);
        return updated;
      });
    }
    forceRender();
  }

  function fail(reason: string | undefined) {
    setMessage(reason ?? "That's not allowed right now.");
  }

  function beginMatch(heroClass: HeroClass, deckIds: string[]) {
    const aiClass = HERO_CLASSES[Math.floor(Math.random() * HERO_CLASSES.length)];
    const state = createInitialGameState(heroClass, deckIds, aiClass, STARTER_DECKS[aiClass]);
    startGame(state); // draws hands and begins turn 1 for "player"
    gameRef.current = state;
    matchRewardGivenRef.current = false;
    setPending(null);
    setMessage("");
    setScreen("playing");
    commit();
  }

  function handleSelectHero(heroClass: HeroClass) {
    beginMatch(heroClass, STARTER_DECKS[heroClass]);
  }

  function handlePlayCustomDeck(heroClass: HeroClass) {
    beginMatch(heroClass, deckToIds(customDeck));
  }

  function handleOpenPack(): string[] {
    // openPack is pure and `collection` here is the freshly rendered state for
    // this click, so compute the result directly rather than inside a setState
    // updater — the updater's body isn't guaranteed to run synchronously, so a
    // value captured from it isn't safe to return immediately.
    const result = openPack(collection);
    setCollection(result.collection);
    saveCollection(result.collection);
    return result.cardsWon;
  }

  function handleDeckAdd(defId: string) {
    setCustomDeck((prev) => {
      const owned = collection.owned[defId] ?? 0;
      const current = prev[defId] ?? 0;
      if (current >= owned || deckSize(prev) >= DECK_SIZE) return prev;
      const next = { ...prev, [defId]: current + 1 };
      saveCustomDeck(next);
      return next;
    });
  }

  function handleDeckRemove(defId: string) {
    setCustomDeck((prev) => {
      const current = prev[defId] ?? 0;
      if (current <= 0) return prev;
      const next = { ...prev, [defId]: current - 1 };
      if (next[defId] === 0) delete next[defId];
      saveCustomDeck(next);
      return next;
    });
  }

  function runAiIfNeeded() {
    const state = gameRef.current;
    if (state && state.activePlayer === "opponent" && !state.winner) {
      setTimeout(() => {
        if (gameRef.current) {
          runAiTurn(gameRef.current);
          commit();
        }
      }, 700);
    }
  }

  function handleEndTurn() {
    const state = gameRef.current;
    if (!state || state.activePlayer !== "player" || state.winner) return;
    setPending(null);
    endTurn(state);
    commit();
    runAiIfNeeded();
  }

  function handleHandCardClick(instanceId: string) {
    const state = gameRef.current;
    if (!state || state.activePlayer !== "player" || pending || state.winner) return;
    const card = state.players.player.hand.find((c) => c.instanceId === instanceId);
    if (!card) return;
    const def = CARD_DEFINITIONS[card.defId];

    if (def.archetype === "creature" || def.archetype === "building") {
      const trigger = def.triggers.find((t) => t.on === "onPlay");
      if (trigger && effectNeedsExplicitTarget(trigger.effect)) {
        setPending({ kind: "playCard", instanceId });
        return;
      }
    }
    const result = playCardFromHand(state, "player", instanceId);
    if (!result.ok) fail(result.reason);
    commit();
  }

  function handleSlotClick(owner: PlayerId, slotIndex: number) {
    const state = gameRef.current;
    if (!state) return;
    if (pending) return; // no card in our set is a valid slot-card target
    if (owner !== "player" || state.activePlayer !== "player" || state.winner) return;
    const card = state.players.player.board.spellAbilitySlots[slotIndex];
    if (!card) return;
    const def = CARD_DEFINITIONS[card.defId];
    if (def.archetype !== "spell" && def.archetype !== "ability") return;
    const pool = def.archetype === "spell" ? state.players.player.mana : state.players.player.energy;
    if (pool.current < def.activateCost || card.chargesRemaining === 0) return;

    if (effectNeedsExplicitTarget(def.effect)) {
      setPending({ kind: "activate", slotIndex });
      return;
    }
    const result = activateSlotCard(state, "player", slotIndex, null);
    if (!result.ok) fail(result.reason);
    commit();
  }

  function handleFrontRowClick(owner: PlayerId, instanceId: string) {
    const state = gameRef.current;
    if (!state) return;
    if (pending) {
      resolvePendingCardTarget(owner, instanceId, "creature");
      return;
    }
    if (owner !== "player" || state.activePlayer !== "player" || state.winner) return;
    const card = state.players.player.board.frontRow.find((c) => c?.instanceId === instanceId);
    if (card && creatureCanAttack(state, card)) {
      setPending({ kind: "attack", attackerId: instanceId });
    }
  }

  function handleBackRowClick(owner: PlayerId, instanceId: string) {
    if (pending) resolvePendingCardTarget(owner, instanceId, "building");
  }

  function handlePortraitClick(owner: PlayerId) {
    const state = gameRef.current;
    if (!state) return;
    if (pending) {
      resolvePendingPortraitTarget(owner);
      return;
    }
    if (owner !== "player" || state.activePlayer !== "player" || state.winner) return;
    if (heroCanAttack(state, "player")) {
      setPending({ kind: "attack", attackerId: "hero" });
    }
  }

  function resolvePendingCardTarget(owner: PlayerId, instanceId: string, archetype: "creature" | "building") {
    const state = gameRef.current;
    if (!state || !pending) return;

    if (pending.kind === "attack") {
      if (owner !== "opponent") {
        setPending(null);
        return;
      }
      const target: AttackTarget = archetype === "creature" ? { type: "creature", instanceId } : { type: "building", instanceId };
      const result =
        pending.attackerId === "hero"
          ? declareHeroAttack(state, "player", target)
          : declareCreatureAttack(state, "player", pending.attackerId, target);
      if (!result.ok) fail(result.reason);
      setPending(null);
      commit();
      return;
    }

    const targetRef: EffectTargetRef = { kind: "card", owner, instanceId };
    const result =
      pending.kind === "playCard"
        ? playCardFromHand(state, "player", pending.instanceId, { target: targetRef })
        : activateSlotCard(state, "player", pending.slotIndex, targetRef);
    if (!result.ok) fail(result.reason);
    setPending(null);
    commit();
  }

  function resolvePendingPortraitTarget(owner: PlayerId) {
    const state = gameRef.current;
    if (!state || !pending) return;

    if (pending.kind === "attack") {
      if (owner !== "opponent") {
        setPending(null);
        return;
      }
      const target: AttackTarget = { type: "player" };
      const result =
        pending.attackerId === "hero"
          ? declareHeroAttack(state, "player", target)
          : declareCreatureAttack(state, "player", pending.attackerId, target);
      if (!result.ok) fail(result.reason);
      setPending(null);
      commit();
      return;
    }

    const targetRef: EffectTargetRef = { kind: "player", owner };
    const result =
      pending.kind === "playCard"
        ? playCardFromHand(state, "player", pending.instanceId, { target: targetRef })
        : activateSlotCard(state, "player", pending.slotIndex, targetRef);
    if (!result.ok) fail(result.reason);
    setPending(null);
    commit();
  }

  function handleReturnToMenu() {
    gameRef.current = null;
    setPending(null);
    setMessage("");
    setScreen("menu");
    commit();
  }

  if (screen === "menu") {
    return (
      <div className="app" style={appStyle}>
        <AccountBar />
        <MainMenu
          coins={collection.coins}
          onQuickPlay={() => setScreen("heroSelect")}
          onCollection={() => setScreen("collection")}
          onPacks={() => setScreen("packs")}
          onDeckBuilder={() => setScreen("deckBuilder")}
        />
      </div>
    );
  }

  if (screen === "heroSelect") {
    return (
      <div className="app" style={appStyle}>
        <button className="btn" onClick={() => setScreen("menu")}>
          ← Back
        </button>
        <HeroSelect onSelect={handleSelectHero} />
      </div>
    );
  }

  if (screen === "collection") {
    return (
      <div className="app" style={appStyle}>
        <CollectionView collection={collection} onBack={() => setScreen("menu")} />
      </div>
    );
  }

  if (screen === "packs") {
    return (
      <div className="app" style={appStyle}>
        <PackOpening
          coins={collection.coins}
          canAfford={canAffordPack(collection)}
          onOpenPack={handleOpenPack}
          onBack={() => setScreen("menu")}
        />
      </div>
    );
  }

  if (screen === "deckBuilder") {
    return (
      <div className="app" style={appStyle}>
        <DeckBuilder
          collection={collection}
          deck={customDeck}
          onAdd={handleDeckAdd}
          onRemove={handleDeckRemove}
          onPlay={handlePlayCustomDeck}
          onBack={() => setScreen("menu")}
        />
      </div>
    );
  }

  const state = gameRef.current;
  if (!state) {
    // Shouldn't happen, but fall back to the menu rather than rendering a blank page.
    setScreen("menu");
    return null;
  }

  return (
    <div className="app" style={appStyle}>
      <header className="app__header">
        <h1>Cardgame</h1>
        <div className="app__turn-info">
          Turn {state.turnNumber} — {state.activePlayer === "player" ? "Your turn" : "Opponent's turn"}
        </div>
        {message && <div className="app__message">{message}</div>}
      </header>

      <ResourceBar playerState={state.players.opponent} label="Opponent" />
      <PlayerBoard
        state={state}
        owner="opponent"
        isEnemy
        pending={pending}
        onFrontRowClick={handleFrontRowClick}
        onBackRowClick={handleBackRowClick}
        onSlotClick={handleSlotClick}
        onPortraitClick={handlePortraitClick}
      />

      <PlayerBoard
        state={state}
        owner="player"
        isEnemy={false}
        pending={pending}
        onFrontRowClick={handleFrontRowClick}
        onBackRowClick={handleBackRowClick}
        onSlotClick={handleSlotClick}
        onPortraitClick={handlePortraitClick}
      />
      <ResourceBar playerState={state.players.player} label="You" />

      <div className="app__controls">
        <HandView
          playerState={state.players.player}
          interactive={state.activePlayer === "player" && !pending && !state.winner}
          onCardClick={handleHandCardClick}
        />
        <div className="app__actions">
          {pending && (
            <button className="btn btn--cancel" onClick={() => setPending(null)}>
              Cancel
            </button>
          )}
          <button
            className="btn btn--end-turn"
            onClick={handleEndTurn}
            disabled={state.activePlayer !== "player" || !!state.winner}
          >
            End Turn
          </button>
        </div>
      </div>

      <GameLog log={state.log} />

      {state.winner && (
        <div className="winner-overlay">
          <div className="winner-overlay__box">
            <h2>{state.winner === "player" ? "Victory!" : "Defeat"}</h2>
            <p className="winner-overlay__reward">
              {state.winner === "player" ? "+60 coins" : "+25 coins"} — 🪙 {collection.coins} total
            </p>
            <button className="btn" onClick={handleReturnToMenu}>
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
