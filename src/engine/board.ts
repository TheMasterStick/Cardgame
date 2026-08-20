import type { CardInstance } from "./types";

/** First open slot in a row, preferring `preferred` if it's actually open. -1 if the row is full. */
export function findOpenSlot(row: (CardInstance | null)[], preferred?: number): number {
  if (preferred !== undefined && row[preferred] === null) return preferred;
  return row.findIndex((c) => c === null);
}

/**
 * Finds `spaceCost` contiguous open slots in the same row for a Massive
 * creature (DESIGN.md §5) — null if there isn't enough contiguous space
 * anywhere. `spaceCost` 1 is the common case and just wraps findOpenSlot.
 */
export function findOpenContiguousSlots(row: (CardInstance | null)[], spaceCost: number, preferred?: number): number[] | null {
  if (spaceCost <= 1) {
    const idx = findOpenSlot(row, preferred);
    return idx === -1 ? null : [idx];
  }
  const fitsAt = (start: number): number[] | null => {
    if (start < 0 || start + spaceCost > row.length) return null;
    for (let i = start; i < start + spaceCost; i++) {
      if (row[i] !== null) return null;
    }
    return Array.from({ length: spaceCost }, (_, k) => start + k);
  };
  if (preferred !== undefined) {
    const atPreferred = fitsAt(preferred);
    if (atPreferred) return atPreferred;
  }
  for (let start = 0; start + spaceCost <= row.length; start++) {
    const fit = fitsAt(start);
    if (fit) return fit;
  }
  return null;
}

/**
 * Contiguous slots for a Transformation (DESIGN.md §16) — same search as
 * findOpenContiguousSlots, but the creature's own currently-occupied
 * slot(s) count as available (they're being vacated by the transform),
 * anchored at its current column first before searching the rest of the
 * row. Null if the new form doesn't fit anywhere, so the transform fizzles.
 */
export function findTransformSlots(row: (CardInstance | null)[], instanceId: string, spaceCost: number): number[] | null {
  const currentColumn = row.findIndex((c) => c?.instanceId === instanceId);
  if (currentColumn === -1) return null;
  const vacated = row.map((c) => (c?.instanceId === instanceId ? null : c));
  return findOpenContiguousSlots(vacated, spaceCost, currentColumn);
}
