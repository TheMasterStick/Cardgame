import type { CardInstance, HeroInstance, StatusEffectInstance, StatusType } from "./types";

type Statused = CardInstance | HeroInstance;

/**
 * Applies a status effect to a card or hero. Stacking rule: a new
 * application of the same status refreshes its amount/duration to the
 * higher of the two (per-card nuance is intentionally out of scope for v1,
 * see DESIGN.md §6). Poison/Bleed/Burn/Freeze all now carry an explicit
 * `duration` normally — a status with no duration passed just persists
 * indefinitely (still supported, unused by any current card).
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
    if (duration !== undefined) {
      existing.turnsRemaining = Math.max(existing.turnsRemaining ?? 0, duration);
    }
    return;
  }
  const instance: StatusEffectInstance = { type: status, amount };
  if (duration !== undefined) instance.turnsRemaining = duration;
  target.statuses.push(instance);
}

/**
 * Ticks all statuses on a target at end of turn, returning total damage to
 * apply. Any status with a `turnsRemaining` counts down and expires at 0;
 * one with no duration persists indefinitely. Freeze's `amount` is always 0
 * (it's a control status, not damage-over-time), so it naturally
 * contributes nothing here while still ticking down and expiring.
 */
export function tickStatuses(target: Statused): number {
  let damage = 0;
  const remaining: StatusEffectInstance[] = [];
  for (const status of target.statuses) {
    damage += status.amount;
    if (status.turnsRemaining !== undefined) {
      const turnsRemaining = status.turnsRemaining - 1;
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

/** Freeze (DESIGN.md §17): a control status — stops the affected creature/Hero from attacking, Advancing, or using an activated ability for as long as it holds. */
export function isFrozen(target: Statused): boolean {
  return target.statuses.some((s) => s.type === "freeze");
}
