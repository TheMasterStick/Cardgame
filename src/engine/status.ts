import type { CardInstance, HeroInstance, StatusEffectInstance, StatusType } from "./types";

type Statused = CardInstance | HeroInstance;

/**
 * Applies a status effect to a card or hero. Stacking rule: a new
 * application of the same status refreshes its amount/duration to the
 * higher of the two (per-card nuance is intentionally out of scope for v1,
 * see DESIGN.md §6).
 */
export function applyStatus(
  target: Statused,
  status: StatusType,
  amount: number,
  duration?: number,
): void {
  const existing = target.statuses.find((s) => s.type === status);
  if (existing) {
    existing.amount = Math.max(existing.amount, amount);
    if (status === "burn") {
      existing.turnsRemaining = Math.max(existing.turnsRemaining ?? 0, duration ?? 0);
    }
    return;
  }
  const instance: StatusEffectInstance = { type: status, amount };
  if (status === "burn") instance.turnsRemaining = duration ?? 2;
  target.statuses.push(instance);
}

/**
 * Ticks all statuses on a target at end of turn, returning total damage to
 * apply. Burn counts down and expires; poison persists indefinitely.
 */
export function tickStatuses(target: Statused): number {
  let damage = 0;
  const remaining: StatusEffectInstance[] = [];
  for (const status of target.statuses) {
    damage += status.amount;
    if (status.type === "burn") {
      const turnsRemaining = (status.turnsRemaining ?? 1) - 1;
      if (turnsRemaining > 0) {
        remaining.push({ ...status, turnsRemaining });
      }
    } else {
      remaining.push(status);
    }
  }
  target.statuses = remaining;
  return damage;
}
