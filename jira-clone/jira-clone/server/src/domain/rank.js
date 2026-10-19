'use strict';

/**
 * Lexorank-like numeric ranking. Items are ordered by a floating point rank;
 * moving an item places it half-way between its new neighbours. When two
 * neighbours get too close the whole list is renumbered in STEP increments.
 */
const STEP = 1024;
const GAP = 2048;
const MIN_DISTANCE = 1e-6;

/** Rank for a new item appended after the current maximum. */
const nextRank = (maxRank) => (maxRank || 0) + STEP;

/**
 * Rank between two neighbours. `lower`/`upper` may be null at the ends of the
 * list. Returns null when the neighbours are too close (caller must rebalance).
 */
function between(lower, upper) {
  const lo = lower ?? (upper ?? 0) - GAP;
  const hi = upper ?? (lower ?? 0) + GAP;
  if (hi - lo < MIN_DISTANCE) return null;
  return (lo + hi) / 2;
}

/** Fresh evenly spaced ranks for n items (1024, 2048, …). */
const rebalanced = (count) => Array.from({ length: count }, (_, i) => (i + 1) * STEP);

module.exports = { STEP, GAP, nextRank, between, rebalanced };
