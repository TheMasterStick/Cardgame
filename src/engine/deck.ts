import { MAX_HAND_SIZE, type CardInstance, type GameState, type PlayerId } from "./types";

/** Fisher-Yates shuffle; returns a new array, does not mutate the input. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Draws one card for `playerId`, mutating `state` in place.
 * If the deck is empty, the discard pile (not the graveyard) is shuffled
 * back into the deck first, per DESIGN.md §8 — there is no fatigue damage.
 * If the deck and discard pile are both empty, drawing is a no-op.
 * A draw that would exceed the hand size limit burns the card to discard.
 */
export function drawCard(state: GameState, playerId: PlayerId): CardInstance | null {
  const player = state.players[playerId];

  if (player.deck.length === 0) {
    if (player.discard.length === 0) return null;
    player.deck = shuffle(player.discard);
    player.discard = [];
    state.log.push(`${playerId}'s deck was empty — reshuffled the discard pile.`);
  }

  const card = player.deck.pop();
  if (!card) return null;

  if (player.hand.length >= MAX_HAND_SIZE) {
    player.discard.push(card);
    state.log.push(`${playerId} drew ${card.defId} but hand was full — it was burned.`);
    return null;
  }

  player.hand.push(card);
  return card;
}

/** Mulligan: redraw any subset of the starting hand (by instance id), once, before turn 1. */
export function mulligan(state: GameState, playerId: PlayerId, instanceIds: string[]): void {
  const player = state.players[playerId];
  const toReplace = player.hand.filter((c) => instanceIds.includes(c.instanceId));
  player.hand = player.hand.filter((c) => !instanceIds.includes(c.instanceId));
  player.deck.push(...toReplace);
  player.deck = shuffle(player.deck);
  for (let i = 0; i < toReplace.length; i++) {
    drawCard(state, playerId);
  }
}

export function drawStartingHand(state: GameState, playerId: PlayerId, count: number): void {
  for (let i = 0; i < count; i++) {
    drawCard(state, playerId);
  }
}
