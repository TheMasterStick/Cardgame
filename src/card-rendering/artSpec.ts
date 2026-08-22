export const CARD_BASE_WIDTH = 1152;
export const CARD_BASE_HEIGHT = 1728;

/**
 * Current shared artwork opening measured from the layered neutral bases.
 * Percentages match the Card Builder preview geometry.
 */
export const CARD_ART_WINDOW = {
  leftPercent: 6.4,
  topPercent: 12.8,
  widthPercent: 87.2,
  heightPercent: 58.5,
  widthPx: 1005,
  heightPx: 1011,
} as const;

/** Standard source-art target for all newly generated/imported card art. */
export const CARD_ART_SOURCE_SIZE = 2048;
export const CARD_ART_SOURCE_ASPECT = "1:1" as const;

/**
 * Keep faces, hands, weapons, and other must-preserve details inside this
 * central fraction of the source image whenever possible. The renderer can
 * then crop/reposition without sacrificing important composition.
 */
export const CARD_ART_SAFE_AREA_RATIO = 0.825;
export const CARD_ART_SAFE_AREA_PERCENT = CARD_ART_SAFE_AREA_RATIO * 100;

export const CARD_ART_SPEC_SUMMARY = {
  cardBase: `${CARD_BASE_WIDTH} × ${CARD_BASE_HEIGHT}`,
  visibleOpening: `${CARD_ART_WINDOW.widthPx} × ${CARD_ART_WINDOW.heightPx}`,
  recommendedSource: `${CARD_ART_SOURCE_SIZE} × ${CARD_ART_SOURCE_SIZE}`,
  aspectRatio: CARD_ART_SOURCE_ASPECT,
  safeArea: `${CARD_ART_SAFE_AREA_PERCENT}% central area`,
} as const;
