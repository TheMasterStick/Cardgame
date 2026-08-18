import type { CardArchetype } from "../engine/types";

/**
 * Card frame art (public/cardframes/) — the ornate border/layout rendered
 * behind a card's name/art/stats. One neutral frame covers every archetype
 * below for now; per-faction and per-archetype variants will slot in here
 * later without touching CardView itself. Hero and Equipment aren't part of
 * this yet (they use their own portrait/plain rendering).
 */
const NEUTRAL_FRAME = "/cardframes/NeutralCardDefault.png";

const CARD_FRAMES: Partial<Record<CardArchetype, string>> = {
  creature: NEUTRAL_FRAME,
  building: NEUTRAL_FRAME,
  spell: NEUTRAL_FRAME,
  ability: NEUTRAL_FRAME,
};

export function cardFrameUrl(archetype: CardArchetype): string | undefined {
  return CARD_FRAMES[archetype];
}
