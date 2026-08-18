import type { CSSProperties, ReactNode } from "react";
import { CARD_DEFINITIONS } from "../../data/cards";
import { guardLabel } from "../../data/taxonomy";
import { canAttack, creatureCanAttack, getEffectiveCreatureAttack, heroCanAttack } from "../../engine/combat";
import type { CardInstance, CreatureDefinition, GameState, HeroCardDefinition, PlayerId } from "../../engine/types";
import { BOARD_THEME, cssImage } from "../../data/theme";
import { getPendingEffect, isEffectTargetable, type PendingAction } from "../targeting";
import { CardView } from "./CardView";

/** The first slot index a creature occupies in this row — a Massive creature (DESIGN.md §5) spans more than one. */
function firstOccupiedIndex(row: (CardInstance | null)[], instanceId: string): number {
  return row.findIndex((c) => c?.instanceId === instanceId);
}

interface PlayerBoardProps {
  state: GameState;
  owner: PlayerId;
  isEnemy: boolean;
  pending: PendingAction | null;
  onCreatureClick: (owner: PlayerId, instanceId: string) => void;
  onBuildingClick: (owner: PlayerId, instanceId: string) => void;
  onSlotClick: (owner: PlayerId, slotIndex: number) => void;
  onPortraitClick: (owner: PlayerId) => void;
  onPlaceCreature: (owner: PlayerId, row: "vanguard" | "support", slotIndex: number) => void;
}

function Slot({ children }: { children?: ReactNode }) {
  return <div className={`slot ${children ? "" : "slot--empty"}`}>{children}</div>;
}

function PlaceableSlot({ onClick }: { onClick: () => void }) {
  return (
    <div className="slot slot--placeable" onClick={onClick}>
      +
    </div>
  );
}

export function PlayerBoard({
  state,
  owner,
  isEnemy,
  pending,
  onCreatureClick,
  onBuildingClick,
  onSlotClick,
  onPortraitClick,
  onPlaceCreature,
}: PlayerBoardProps) {
  const playerState = state.players[owner];
  const pendingEffect = getPendingEffect(state, pending);
  const heroDef = CARD_DEFINITIONS[playerState.hero.defId] as HeroCardDefinition | undefined;

  const canInitiate = !pending && owner === "player" && state.activePlayer === "player" && !state.winner;
  const canPlaceHere = pending?.kind === "placeCreature" && owner === "player";

  // All pending attacks are human-initiated, so the attacker's owner is always
  // "player" here — `owner` is which board is being rendered (the *defender*
  // when pending.kind === "attack"), not who's attacking.
  let portraitClickable = false;
  if (pending?.kind === "attack") {
    portraitClickable = owner === "opponent" && canAttack(state, "player", pending.attackerId, { type: "player" });
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
      <div className="row row--buildings">
        {playerState.board.buildings.map((card, i) => {
          let clickable = false;
          if (card) {
            if (pending?.kind === "attack") {
              clickable =
                owner === "opponent" &&
                canAttack(state, "player", pending.attackerId, { type: "building", instanceId: card.instanceId });
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
                  onClick={clickable ? () => onBuildingClick(owner, card.instanceId) : undefined}
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
            <div className="portrait__guard">
              {guardLabel(heroDef?.faction)} {playerState.guard.current}/{playerState.guard.max}
            </div>
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

      <div className="row row--support" title="Support: backline. Only Ranged creatures can attack from here — a creature with Advance can move into Vanguard instead.">
        {playerState.board.support.map((card, i) => {
          if (!card) {
            return <Slot key={i}>{canPlaceHere && <PlaceableSlot onClick={() => onPlaceCreature(owner, "support", i)} />}</Slot>;
          }
          if (firstOccupiedIndex(playerState.board.support, card.instanceId) !== i) {
            return <Slot key={i}><div className="slot--massive-continuation" aria-hidden="true" /></Slot>;
          }
          let clickable = false;
          if (pending?.kind === "attack") {
            clickable =
              owner === "opponent" &&
              canAttack(state, "player", pending.attackerId, { type: "creature", instanceId: card.instanceId });
          } else if (pending && pendingEffect) {
            clickable = isEffectTargetable(pendingEffect, "creature", owner);
          } else if (canInitiate) {
            const keywords = (CARD_DEFINITIONS[card.defId] as CreatureDefinition).keywords;
            const isRanged = keywords.includes("ranged");
            const canAdvance = !isRanged && keywords.includes("advance");
            clickable = (isRanged || canAdvance) && creatureCanAttack(state, card);
          }
          return (
            <Slot key={i}>
              <CardView
                instance={card}
                highlighted={clickable}
                onClick={clickable ? () => onCreatureClick(owner, card.instanceId) : undefined}
                attackOverride={getEffectiveCreatureAttack(state, owner, card)}
              />
            </Slot>
          );
        })}
      </div>

      <div className="row row--vanguard">
        {playerState.board.vanguard.map((card, i) => {
          if (!card) {
            return <Slot key={i}>{canPlaceHere && <PlaceableSlot onClick={() => onPlaceCreature(owner, "vanguard", i)} />}</Slot>;
          }
          if (firstOccupiedIndex(playerState.board.vanguard, card.instanceId) !== i) {
            return <Slot key={i}><div className="slot--massive-continuation" aria-hidden="true" /></Slot>;
          }
          let clickable = false;
          if (pending?.kind === "attack") {
            clickable =
              owner === "opponent" &&
              canAttack(state, "player", pending.attackerId, { type: "creature", instanceId: card.instanceId });
          } else if (pending && pendingEffect) {
            clickable = isEffectTargetable(pendingEffect, "creature", owner);
          } else if (canInitiate) {
            clickable = creatureCanAttack(state, card);
          }
          return (
            <Slot key={i}>
              <CardView
                instance={card}
                highlighted={clickable}
                onClick={clickable ? () => onCreatureClick(owner, card.instanceId) : undefined}
                attackOverride={getEffectiveCreatureAttack(state, owner, card)}
              />
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
