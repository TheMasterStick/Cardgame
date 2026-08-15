import type { CSSProperties, ReactNode } from "react";
import { CARD_DEFINITIONS } from "../../data/cards";
import { creatureCanAttack, heroCanAttack } from "../../engine/combat";
import type { CardInstance, GameState, HeroCardDefinition, PlayerId } from "../../engine/types";
import { BOARD_THEME, cssImage } from "../../data/theme";
import { canBypassFrontRow, getPendingEffect, isEffectTargetable, type PendingAction } from "../targeting";
import { CardView } from "./CardView";

interface PlayerBoardProps {
  state: GameState;
  owner: PlayerId;
  isEnemy: boolean;
  pending: PendingAction | null;
  onFrontRowClick: (owner: PlayerId, instanceId: string) => void;
  onBackRowClick: (owner: PlayerId, instanceId: string) => void;
  onSlotClick: (owner: PlayerId, slotIndex: number) => void;
  onPortraitClick: (owner: PlayerId) => void;
}

function Slot({ children }: { children?: ReactNode }) {
  return <div className={`slot ${children ? "" : "slot--empty"}`}>{children}</div>;
}

export function PlayerBoard({
  state,
  owner,
  isEnemy,
  pending,
  onFrontRowClick,
  onBackRowClick,
  onSlotClick,
  onPortraitClick,
}: PlayerBoardProps) {
  const playerState = state.players[owner];
  const pendingEffect = getPendingEffect(state, pending);
  const heroDef = CARD_DEFINITIONS[playerState.hero.defId] as HeroCardDefinition | undefined;

  const canInitiate = !pending && owner === "player" && state.activePlayer === "player" && !state.winner;

  let portraitClickable = false;
  if (pending?.kind === "attack") {
    portraitClickable = owner === "opponent" && canBypassFrontRow(state, owner, pending.attackerId);
  } else if (pending && pendingEffect) {
    portraitClickable = isEffectTargetable(pendingEffect, "portrait", owner);
  } else if (canInitiate) {
    portraitClickable = heroCanAttack(state, "player");
  }

  const boardBgImage = cssImage(
    isEnemy ? BOARD_THEME.opponentBoardBackground : BOARD_THEME.playerBoardBackground,
  );

  return (
    <div
      className={`player-board ${isEnemy ? "player-board--enemy" : "player-board--own"}`}
      style={{ "--board-bg-image": boardBgImage } as CSSProperties}
    >
      <div className="row row--back">
        {playerState.board.backRow.map((card, i) => {
          let clickable = false;
          if (card) {
            if (pending?.kind === "attack") {
              clickable = owner === "opponent" && canBypassFrontRow(state, owner, pending.attackerId);
            } else if (pending && pendingEffect) {
              clickable = isEffectTargetable(pendingEffect, "building", owner);
            }
          }
          return (
            <Slot key={i}>
              {card && (
                <CardView
                  instance={card}
                  highlighted={clickable}
                  onClick={clickable ? () => onBackRowClick(owner, card.instanceId) : undefined}
                />
              )}
            </Slot>
          );
        })}
      </div>

      <div className="row row--hero">
        {playerState.board.spellAbilitySlots.slice(0, 2).map((card, i) => (
          <SlotAbility key={i} card={card} owner={owner} index={i} state={state} onSlotClick={onSlotClick} />
        ))}

        <div className="hero-column">
          <div
            className={`portrait ${portraitClickable ? "portrait--clickable" : ""} ${heroDef?.art ? "portrait--has-art" : ""}`}
            onClick={portraitClickable ? () => onPortraitClick(owner) : undefined}
            style={heroDef?.art ? { backgroundImage: `url("${heroDef.art}")` } : undefined}
          >
            <div className="portrait__name">{playerState.hero.name}</div>
            <div className="portrait__hp">HP {playerState.hero.currentHp}/{playerState.hero.maxHp}</div>
            <div className="portrait__militia">Militia {playerState.militia.current}/{playerState.militia.max}</div>
            {playerState.board.equipment && (
              <div className="portrait__attack">
                ⚔ {playerState.hero.baseAttack +
                  (CARD_DEFINITIONS[playerState.board.equipment.defId] as { attackBonus: number }).attackBonus}
              </div>
            )}
            {playerState.hero.statuses.length > 0 && (
              <div className="card__statuses">
                {playerState.hero.statuses.map((s, idx) => (
                  <span key={idx} className={`status status--${s.type}`}>
                    {s.type === "burn" ? "🔥" : "☠"}
                    {s.amount}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Slot>
            {playerState.board.equipment && <CardView instance={playerState.board.equipment} />}
          </Slot>
        </div>

        {playerState.board.spellAbilitySlots.slice(2, 4).map((card, i) => (
          <SlotAbility key={i + 2} card={card} owner={owner} index={i + 2} state={state} onSlotClick={onSlotClick} />
        ))}
      </div>

      <div className="row row--front">
        {playerState.board.frontRow.map((card, i) => {
          let clickable = false;
          if (card) {
            if (pending?.kind === "attack") clickable = owner === "opponent";
            else if (pending && pendingEffect) clickable = isEffectTargetable(pendingEffect, "creature", owner);
            else if (canInitiate) clickable = creatureCanAttack(state, card);
          }
          return (
            <Slot key={i}>
              {card && (
                <CardView
                  instance={card}
                  highlighted={clickable}
                  onClick={clickable ? () => onFrontRowClick(owner, card.instanceId) : undefined}
                />
              )}
            </Slot>
          );
        })}
      </div>
    </div>
  );
}

function SlotAbility({
  card,
  owner,
  index,
  state,
  onSlotClick,
}: {
  card: CardInstance | null;
  owner: PlayerId;
  index: number;
  state: GameState;
  onSlotClick: (owner: PlayerId, slotIndex: number) => void;
}) {
  let clickable = false;
  if (card && owner === "player" && state.activePlayer === "player" && !state.winner) {
    const def = CARD_DEFINITIONS[card.defId];
    if (def.archetype === "spell" || def.archetype === "ability") {
      const pool = def.archetype === "spell" ? state.players.player.mana : state.players.player.energy;
      clickable = pool.current >= def.activateCost && card.chargesRemaining !== 0;
    }
  }
  return (
    <Slot>
      {card && (
        <CardView instance={card} highlighted={clickable} onClick={clickable ? () => onSlotClick(owner, index) : undefined} />
      )}
    </Slot>
  );
}
