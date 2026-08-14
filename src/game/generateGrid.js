// Framework-agnostic puzzle generation. No React, no DOM, no browser APIs —
// safe to reuse from a CLI, a test suite, or a future backend.
//
// A puzzle is generated in five steps:
//   1. Find a valid "solution": one cell per row/column such that no two
//      solution cells touch (including diagonally).
//   2. Grow N irregular, roughly-balanced regions outward from the
//      solution cells with a randomised flood fill until every cell on the
//      board belongs to exactly one region.
//   3. Check the resulting board for a unique solution. Region growth alone
//      rarely lands on a uniquely-solvable layout by chance, so instead of
//      discarding and retrying from scratch every time, `repairToUnique`
//      makes small, targeted, connectivity-preserving boundary tweaks that
//      each rule out one duplicate solution, until only one is left (or it
//      gets stuck, in which case the caller does start over).
//   4. Confirm the board is solvable using only small, glanceable
//      deductions — never a guess, and never reasoning a player can't
//      verify by eye. `hints.js`'s `solveByNamedRules` mechanically drives
//      the board using nothing but its named rules (conflict elimination,
//      locked/subset candidates, naked singles); a unique solution turned
//      out NOT to imply this on its own — an early version of this
//      generator only checked uniqueness, and it turned out ~99% of
//      "unique" boards had no such solving path at all, meaning the only
//      way to make progress was genuinely opaque "assume X, check the
//      *entire* rest of the board" reasoning. Any board that isn't
//      solvable this way gets thrown out and regenerated, same as a
//      non-unique one.
//   5. Belt-and-suspenders: also confirm with `solveByPropagation`, a
//      strictly more powerful (but not player-legible) check. Since it can
//      find everything the named rules can and more, this should always
//      already be true once step 4 passes — it's here as a safety net in
//      case of a bug in the named-rule logic, not as an independent gate.
//
// See solver.js for the solution search and validators.js for the shared
// rule predicates (adjacency, row/col/region uniqueness) used at play time.

import { createRng } from "./rng.js";
import { findSolutions, solveByPropagation } from "./solver.js";
import { solveByNamedRules } from "./hints.js";

const MAX_OUTER_ATTEMPTS = 3000;
const MAX_REPAIR_STEPS = 100;
const MAX_SOLUTION_ATTEMPTS = 200;

/**
 * Finds one valid shamrock placement: a permutation of columns (one per row)
 * such that consecutive rows never place their shamrocks in
 * horizontally-adjacent (or same) columns. Non-consecutive rows can never
 * be adjacent, since adjacency requires |rowDiff| <= 1.
 *
 * Uses randomised backtracking so different seeds yield different
 * solutions.
 */
function generateSolution(size, rng) {
  const colOrder = Array.from({ length: size }, (_, i) => i);

  for (let attempt = 0; attempt < MAX_SOLUTION_ATTEMPTS; attempt++) {
    const usedCols = new Set();
    const placement = [];

    const backtrack = (row) => {
      if (row === size) return true;
      const candidates = rng.shuffle(colOrder);
      for (const col of candidates) {
        if (usedCols.has(col)) continue;
        const prevCol = row > 0 ? placement[row - 1] : null;
        if (prevCol !== null && Math.abs(prevCol - col) <= 1) continue;
        placement.push(col);
        usedCols.add(col);
        if (backtrack(row + 1)) return true;
        placement.pop();
        usedCols.delete(col);
      }
      return false;
    };

    if (backtrack(0)) return placement;
  }

  throw new Error(`Could not generate a solution for size ${size} after ${MAX_SOLUTION_ATTEMPTS} attempts.`);
}

const ORTHOGONAL_NEIGHBORS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function inBounds(size, r, c) {
  return r >= 0 && r < size && c >= 0 && c < size;
}

/**
 * Grows `size` regions outward from the solution cells using a randomised
 * flood fill. At every step, growth is offered to whichever *still-growable*
 * region currently has the fewest cells (ties broken randomly), rather than
 * a fixed turn order — a region that gets boxed in by its neighbours simply
 * stops growing. This keeps regions close to evenly sized while their
 * boundaries stay irregular.
 *
 * Returns a size x size array of region ids (0..size-1, matching the row
 * index of the seed shamrock that grew that region).
 */
function growRegions(size, solution, rng) {
  const regionOf = Array.from({ length: size }, () => new Array(size).fill(-1));
  const frontiers = Array.from({ length: size }, () => []);
  const regionSizes = new Array(size).fill(1);

  for (let row = 0; row < size; row++) {
    const col = solution[row];
    regionOf[row][col] = row;
    frontiers[row].push([row, col]);
  }

  let claimed = size;
  const total = size * size;

  const hasUnclaimedNeighbor = (r, c) => {
    for (const [dr, dc] of ORTHOGONAL_NEIGHBORS) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(size, nr, nc) && regionOf[nr][nc] === -1) return true;
    }
    return false;
  };

  const getCandidates = (regionId) => {
    const frontier = frontiers[regionId];
    // Trim fully-surrounded cells off the tail so repeated scans don't
    // keep re-checking interior cells that can never yield a candidate.
    while (frontier.length > 0 && !hasUnclaimedNeighbor(...frontier[frontier.length - 1])) {
      frontier.pop();
    }
    const candidates = [];
    for (const [r, c] of frontier) {
      for (const [dr, dc] of ORTHOGONAL_NEIGHBORS) {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(size, nr, nc) && regionOf[nr][nc] === -1) {
          candidates.push([nr, nc]);
        }
      }
    }
    return candidates;
  };

  while (claimed < total) {
    let smallest = Infinity;
    let smallestRegions = [];

    for (let regionId = 0; regionId < size; regionId++) {
      if (getCandidates(regionId).length === 0) continue;
      if (regionSizes[regionId] < smallest) {
        smallest = regionSizes[regionId];
        smallestRegions = [regionId];
      } else if (regionSizes[regionId] === smallest) {
        smallestRegions.push(regionId);
      }
    }

    if (smallestRegions.length === 0) {
      // Every region is boxed in but cells remain unclaimed (isolated
      // pockets) — swept up below.
      break;
    }

    const regionId = rng.pick(smallestRegions);
    const candidates = getCandidates(regionId);
    const [cr, cc] = rng.pick(candidates);

    regionOf[cr][cc] = regionId;
    frontiers[regionId].push([cr, cc]);
    regionSizes[regionId]++;
    claimed++;
  }

  // Any stray unclaimed cells (isolated pockets fully enclosed before their
  // turn came up) get swept into whichever already-claimed orthogonal
  // neighbour is found first. Repeated until nothing unclaimed remains, so
  // a multi-cell pocket doesn't leave stragglers after a single pass.
  let unclaimedRemain = true;
  while (unclaimedRemain) {
    unclaimedRemain = false;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (regionOf[r][c] !== -1) continue;
        let assigned = false;
        for (const [dr, dc] of ORTHOGONAL_NEIGHBORS) {
          const nr = r + dr;
          const nc = c + dc;
          if (inBounds(size, nr, nc) && regionOf[nr][nc] !== -1) {
            regionOf[r][c] = regionOf[nr][nc];
            assigned = true;
            break;
          }
        }
        if (!assigned) unclaimedRemain = true;
      }
    }
  }

  return regionOf;
}

/** Cell count currently belonging to `regionId`. */
function regionCellCount(size, regionOf, regionId) {
  let count = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (regionOf[r][c] === regionId) count++;
    }
  }
  return count;
}

/**
 * Would `regionId` stay a single connected (orthogonal) blob if the cell
 * at (excludeRow, excludeCol) were removed from it? Used before moving a
 * boundary cell to a neighbouring region, so a repair never splits a
 * region into disconnected pieces.
 */
function staysConnectedWithoutCell(size, regionOf, regionId, excludeRow, excludeCol) {
  const cells = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (regionOf[r][c] === regionId && !(r === excludeRow && c === excludeCol)) cells.push([r, c]);
    }
  }
  if (cells.length === 0) return true;

  const key = (r, c) => r * size + c;
  const remaining = new Set(cells.map(([r, c]) => key(r, c)));
  const seen = new Set([key(cells[0][0], cells[0][1])]);
  const stack = [cells[0]];

  while (stack.length > 0) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of ORTHOGONAL_NEIGHBORS) {
      const nr = r + dr;
      const nc = c + dc;
      const k = key(nr, nc);
      if (remaining.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push([nr, nc]);
      }
    }
  }

  return seen.size === cells.length;
}

/**
 * Nudges a region layout toward a unique solution with small, targeted
 * edits instead of discarding it and starting over.
 *
 * On each step, it asks the solver for up to two valid placements. If
 * there's only one (or none — shouldn't happen, since the layout started
 * from a real solution, but treated as failure defensively), it's done.
 * Otherwise it takes one of those two solutions and looks for a boundary
 * cell it occupies that borders a *different* region also occupied by that
 * same solution — reassigning that one cell to the neighbouring region
 * would give that solution two shamrocks in the same region, invalidating
 * it, without touching any cell the *other* solution uses. The move is
 * only applied if it keeps the donor region in one connected piece and
 * non-empty. Repeated until unique, stuck (no valid move found), or the
 * step budget runs out.
 *
 * Mutates `regionOf` in place. Returns true if it ends in a uniquely
 * solvable state.
 */
function repairToUnique(size, regionOf, rng) {
  for (let step = 0; step < MAX_REPAIR_STEPS; step++) {
    const solutions = findSolutions({ size, regions: regionOf }, 2);
    if (solutions.length <= 1) return solutions.length === 1;

    const [solutionA, solutionB] = solutions;
    let applied = false;

    for (const targetSolution of rng.shuffle([solutionB, solutionA])) {
      for (const [pr, pc] of rng.shuffle(targetSolution)) {
        const donorRegion = regionOf[pr][pc];

        for (const [dr, dc] of rng.shuffle(ORTHOGONAL_NEIGHBORS)) {
          const nr = pr + dr;
          const nc = pc + dc;
          if (!inBounds(size, nr, nc)) continue;

          const receivingRegion = regionOf[nr][nc];
          if (receivingRegion === donorRegion) continue;

          const receivingRegionAlreadyUsed = targetSolution.some(
            ([sr, sc]) => regionOf[sr][sc] === receivingRegion && !(sr === pr && sc === pc)
          );
          if (!receivingRegionAlreadyUsed) continue;
          if (regionCellCount(size, regionOf, donorRegion) <= 1) continue;
          if (!staysConnectedWithoutCell(size, regionOf, donorRegion, pr, pc)) continue;

          regionOf[pr][pc] = receivingRegion;
          applied = true;
          break;
        }
        if (applied) break;
      }
      if (applied) break;
    }

    if (!applied) return false;
  }
  return false;
}

/**
 * Generates a complete Lucky Patch puzzle.
 *
 * @param {object} options
 * @param {number} [options.size=8] - Board dimension N.
 * @param {string|number} [options.seed] - Deterministic seed. Omit for a
 *   random puzzle.
 * @returns {{
 *   size: number,
 *   seed: number,
 *   regions: number[][],   // regionId per [row][col]
 *   solution: number[][],  // [row, col] pairs of the (one) valid answer
 * }}
 */
export function generatePuzzle({ size = 8, seed } = {}) {
  if (!Number.isInteger(size) || size < 4) {
    throw new Error("Puzzle size must be an integer >= 4.");
  }

  const rng = createRng(seed);

  for (let attempt = 0; attempt < MAX_OUTER_ATTEMPTS; attempt++) {
    const solution = generateSolution(size, rng);
    const regions = growRegions(size, solution, rng);

    if (!repairToUnique(size, regions, rng)) continue;

    // Uniqueness alone doesn't guarantee the puzzle is solvable without
    // guessing, and it doesn't guarantee that solving path is something a
    // player can actually follow. Require both: solvable using only
    // small, glanceable deductions (the real requirement), double-checked
    // against the strictly-more-powerful propagation solver as a safety
    // net against a bug in the named-rule logic.
    if (!solveByNamedRules(regions, size)) continue;
    if (!solveByPropagation({ size, regions }).solved) continue;

    const [finalSolution] = findSolutions({ size, regions }, 1);
    return { size, seed: rng.seed, regions, solution: finalSolution };
  }

  throw new Error(
    `Could not generate a uniquely-solvable ${size}x${size} puzzle after ${MAX_OUTER_ATTEMPTS} attempts. Try a different seed.`
  );
}
